// "would be destroyed / would leave the field" replacement effects (abilities_r17.js wordings + "non-monster" filters).
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const settle = async () => { for (let i = 0; i < 6; i++) { await flush(); await new Promise(r => setTimeout(r, 2)); } };
const fresh = (setup) => run(`(function(){ ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true));
  battle.renderBattle=function(){}; battle.activeSide='opp'; battle.phase='main'; battle.turnCount=3;
  const f=battle.plr; ['left','center','right'].forEach(p=>f.monsters[p]=null); f.gauge=f.deck.splice(0,4); f.hand=[]; f.drop=[]; f.life=10;
  const put=(pos,id)=>{ f.monsters[pos]={card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; };
  ${setup || ""} })()`);
const at = (pos) => run(`battle.plr.monsters.${pos} ? battle.plr.monsters.${pos}.card.id : 0`);

(async () => {
  // 1790: "When this card would leave the field, you may pay 2 gauge. If you do, this card remains on the field."
  fresh(`put('center', 1790);`);
  run(`battle.destroyMonster('plr', 'center')`); await settle();
  ok(at("center") === 1790 && run(`battle.plr.gauge.length`) === 2, "1790 pays 2 gauge and stays on the field");
  fresh(`put('center', 1790); f.gauge = f.gauge.slice(0, 1);`);
  run(`battle.destroyMonster('plr', 'center')`); await settle();
  ok(at("center") === 0, "…and is destroyed when you can't pay");

  // 317 Nanomachine Body Replacement: "discard a non-monster card from your hand. If you do, this card remains"
  const spell = run(`ALL_CARDS.find(c => c.type === 'Spell').id`), mon = run(`ALL_CARDS.find(c => c.type === 'Monster' && c.id !== 317).id`);
  fresh(`put('center', 317); f.hand = [${mon}, ${spell}];`);
  run(`battle.destroyMonster('plr', 'center')`); await settle();
  ok(at("center") === 317, "317 stays on the field");
  ok(run(`battle.plr.hand.join()`) === String(mon) && run(`battle.plr.drop.includes(${spell})`), "…discarding the spell, not the monster");
  fresh(`put('center', 317); f.hand = [${mon}];`);
  run(`battle.destroyMonster('plr', 'center')`); await settle();
  ok(at("center") === 0 && run(`battle.plr.hand.length`) === 1, "…and is destroyed when only monsters are in hand");

  // 1597: "If your other «Raging Spirits» would leave the field, you may put this card into your drop zone. If you do, that card remains"
  const other = run(`(ALL_CARDS.find(c => c.id !== 1597 && c.type === 'Monster' && (c.attrs || []).some(a => /ragingspirit/i.test(a))) || {}).id || 0`);
  ok(other > 0, "a second «Raging Spirits» found (" + other + ")");
  fresh(`put('left', 1597); put('center', ${other});`);
  run(`battle.destroyMonster('plr', 'center')`); await settle();
  ok(at("center") === other && at("left") === 0 && run(`battle.plr.drop.includes(1597)`), "1597 goes to the drop zone so the other «Raging Spirits» stays");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
