// Chaos card costs: typo'd gauge costs, "when you have no monsters" equip gates, destroy-a-monster cast cost.
const { createEnv } = require("./headless.js");
const env = createEnv(); const J = (c) => JSON.parse(env.run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
env.run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.clear=()=>{ const f=battle.plr; ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.item=null; f.item2=null; f.extraItems=[]; f.gauge=f.deck.splice(0,8); f.hand=[]; f.drop=[]; battle.activeSide='plr'; battle.phase='main'; battle.matchOver=false; };`);
const cost = (id) => J(`parseCardCost(CARD_MAP.get(${id}).cost, CARD_MAP.get(${id}).skill, battle.plr, CARD_MAP.get(${id}))`);
ok(cost(3193).gauge === 2, "#3193 CHAOS Azrael: 'Pay 2 Guage' costs 2 gauge");
ok(cost(4733).gauge === 2 && cost(4733).soul === 1, "#4733: 'Pay 2 guage' typo costs 2 gauge + 1 soul");

for (const id of [3728, 4759]) {
  env.run(`clear(); battle.plr.monsters.left=mku(46);`);
  ok(!J(`evaluateCardConditions(CARD_MAP.get(${id}), battle.plr, battle.opp).met`), `#${id} cannot be equipped while you have a monster`);
  env.run(`battle.alert=null; globalThis.alert=function(){}; battle.plr.hand=[${id}]; battle.plr.gauge=battle.plr.deck.splice(0,8); battle.equipCardFromHand("plr",0);`);
  ok(J(`battle.plr.hand.includes(${id}) && !battle.plr.item`), `#${id} equipCardFromHand refuses while you have a monster`);
  env.run(`clear();`);
  ok(J(`evaluateCardConditions(CARD_MAP.get(${id}), battle.plr, battle.opp).met`), `#${id} can be equipped with no monsters`);
}

// #3705 Collapse Roar: [Cast Cost] destroy a size 3 monster on your field; [Counter] destroy a monster on your opponent's field.
const size3 = J(`ALL_CARDS.find(c=>c.type==='Monster'&&c.size===3&&!/\\[chaos territory\\]/i.test(c.skill||'')).id`);
const size1 = J(`ALL_CARDS.find(c=>c.type==='Monster'&&c.size===1).id`);
env.run(`clear(); battle.plr.hand=[3705]; battle.plr.monsters.left=mku(${size1});`);
ok(J(`ABX.canPayExtras("plr", CARD_MAP.get(3705), 0)`) === false, "#3705 cannot be cast without a size 3 monster on your field");
env.run(`clear(); battle.plr.hand=[3705]; battle.plr.monsters.left=mku(${size3}); battle.opp.monsters.center=mku(${size1});`);
ok(J(`ABX.canPayExtras("plr", CARD_MAP.get(3705), 0)`) === true, "#3705 can be cast with a size 3 monster on your field");
console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
