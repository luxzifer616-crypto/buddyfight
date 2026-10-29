// B1: "come to hand at end of turn / start of final phase" abilities must fire when End Turn is used.
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const setup = (side, js) => env.run(`{
  battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); ABX.autoPlay = true; ABX.fast = true;
  battle.renderBattle = function(){};
  for (const s of [battle.plr, battle.opp]) { ["left","center","right","center2"].forEach(p => s.monsters[p] = null); s.hand = []; s.gauge = s.deck.splice(0, 8); s.maxSize = 99; }
  battle.activeSide = "${side}"; battle.phase = "main";
  const f = battle["${side}"]; ${js}
  battle.endTurn();
}`);
const mon = (id) => `{ card: CARD_MAP.get(${id}), rested: false, attacksLeft: 1, soul: [], tempPower:0, tempDef:0, tempCrit:0 }`;
(async () => {
  // #5185 final-phase "return this card from the field to hand"
  setup("plr", `f.monsters.left = ${mon(5185)};`); await wait(600);
  ok(env.run(`battle.plr.hand.includes(5185) && !battle.plr.monsters.left`), "#5185 returns to hand at start of final phase / end turn");
  // #2645 impact monster "At the end of turn, you may return this card to your hand" (own turn)
  setup("plr", `f.monsters.center = ${mon(2645)};`); await wait(600);
  ok(env.run(`battle.plr.hand.includes(2645) && !battle.plr.monsters.center`), "#2645 returns to hand at end of own turn");
  // #2645 on the opponent's turn ("At the end of the turn" - any turn)
  setup("opp", `battle.plr.monsters.center = ${mon(2645)};`); await wait(600);
  ok(env.run(`battle.plr.hand.includes(2645) && !battle.plr.monsters.center`), "#2645 returns to hand at end of opponent's turn");
  // #6036 dropped from hand this turn, Dragon item equipped
  const dragonItem = env.run(`(ALL_CARDS.find(c=>c.type==='Item' && (c.attrs||[]).some(a=>/dragon/i.test(a)))||{}).id`);
  setup("plr", `f.item = { card: CARD_MAP.get(${dragonItem}), rested:false, attacksLeft:1, soul:[] }; f.drop.push(6036); ABX.fireDiscarded("plr", CARD_MAP.get(6036));`); await wait(600);
  ok(env.run(`battle.plr.hand.includes(6036)`), "#6036 returns to hand when dropped from hand this turn with Dragon item");
  console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
})();
