// node tests/transform_cost.js - #1386 "[Cast Cost] [Pay 1 gauge. If you are not [Transform] into a card, pay another 1 gauge.]"
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const env = createEnv(); const val = (c) => env.run('(function(){' + c + '\n})()');
env.run(`ABX.fast=true; ABX.autoPlay=true;
  globalThis.card=function(id){ return window.BUDDYFIGHT_CARDS.find(c=>c.id===id); };
  globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; };`);

ck("1386 cost line parses", val(`return ABX.parseCard(card(1386)).abilities.every(a=>!a.unparsed||a.unparsed.length===0)`));
const cost = (itemId) => val(`fresh(); const f=battle.plr; f.item = ${itemId} ? {card:card(${itemId}),rested:false,soul:[]} : null; const c=card(1386); return parseCardCost(c.cost, c.skill, f, c).gauge`);
ck("not transformed: costs 2 gauge", cost(0) === 2, cost(0));
ck("[Transform] into a card (Transform Belt): costs 1 gauge", cost(2149) === 1, cost(2149));
ck("a non-transform item still costs 2", cost(val(`return window.BUDDYFIGHT_CARDS.find(c=>c.type==='Item'&&!c.tr&&!c.ride&&!c.st).id`)) === 2);
// the cast really needs / pays the right amount
ck("cannot cast with 1 gauge when not transformed", val(`fresh(); const f=battle.plr; f.item=null; f.gauge=[1]; const c=card(1386); return parseCardCost(c.cost,c.skill,f,c).gauge > f.gauge.length`));
console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
