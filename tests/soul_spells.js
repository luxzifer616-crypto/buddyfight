// Spells that put themselves into a soul (abilities_r16.js): "If this card is in the soul of X, that X gets ..." is a
// continuous ability of the card while it sits in that soul, not a one-time part of the spell.
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const settle = async () => { for (let i = 0; i < 8; i++) { await flush(); await new Promise(r => setTimeout(r, 2)); } };

(async () => {
  run(`(function(){ ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true));
    battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
    const f=battle.plr; ['left','center','right'].forEach(p=>f.monsters[p]=null); f.gauge=f.deck.splice(0,6); f.hand=[2238]; })()`);
  // a size 3 «Wild Dragon», and another monster beside it (staticBonus only counts bonuses from other cards)
  const wd = run(`(ALL_CARDS.find(c => c.type==='Monster' && c.size===3 && (c.attrs||[]).includes('WildDragon')) || {}).id || 0`);
  const other = run(`(ALL_CARDS.find(c => c.type==='Monster' && c.size===1 && !(c.attrs||[]).includes('WildDragon') && c.power>0) || {}).id || 0`);
  ok(wd && other, "test monsters found (" + wd + ", " + other + ")");
  run(`(function(){ const f=battle.plr; f.monsters.center={card:CARD_MAP.get(${wd}),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
       f.monsters.left={card:CARD_MAP.get(${other}),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; })()`);
  const kw = (pos) => run(`(function(){ const u = battle.plr.monsters.${pos}; const b = ABX.staticBonus(battle.plr, u); return [b.sg, b.move].join(","); })()`);
  ok(kw("center") === "false,false", "before: the «Wild Dragon» has no [Soulguard] / [Move]");

  // Cintamani Stone: "Put this card into the soul of a size 3 «Wild Dragon» on your field.
  //                   If this card is in the soul of a «Wild Dragon» monster, that monster gets [Move] and [Soulguard]."
  ok(run(`ABX.get(CARD_MAP.get(2238)).abilities.some(a => a.kind === 'static' && a.r16soul)`), "the soul line is a continuous ability, not part of the cast");
  run(`battle.castSpellFromHand('plr', 0)`); await settle();
  ok(run(`battle.plr.monsters.center.soul.includes(2238)`), "casting puts Cintamani Stone into the «Wild Dragon»'s soul");
  ok(kw("center") === "true,true", "while it is there, the «Wild Dragon» has [Soulguard] and [Move] (" + kw("center") + ")");
  ok(kw("left") === "false,false", "the other monster gets nothing");
  run(`battle.plr.monsters.center.soul = []`);
  ok(kw("center") === "false,false", "once it leaves the soul, the bonus is gone");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
