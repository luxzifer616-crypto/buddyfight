// Cast requirements come from the "You may only cast ..." sentence, not from effect branches later in the text,
// and a negative requirement ("do not have a monster in the center") is not read as the opposite.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
const val = (js) => JSON.parse(run(`JSON.stringify((function(){${js}})())`));
run(`ABX.fast=true; ABX.autoPlay=true;
 globalThis.plain=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill); globalThis.anyItem=ALL_CARDS.find(x=>x.type==='Item'&&!x.skill);
 globalThis.mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.board=function(id,o){ o=o||{};
  battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const me=battle.opp; me.gauge=me.deck.splice(0,8); me.life=o.life||10; me.hand=[id]; me.drop=me.deck.splice(0,8);
  if (o.center) me.monsters.center=mk(o.centerCard||plain); if (o.left) me.monsters.left=mk(plain); if (o.item) me.item=mk(anyItem);
  const a=battle.plr; a.monsters.center=mk(plain); if (o.weapon) a.item=mk(anyItem);
  battle.turn='plr'; battle.activeSide='plr'; battle.phase='attack'; return me; };
 globalThis.met=(id,o)=>{ const me=board(id,o); return evaluateCardConditions(CARD_MAP.get(id),me,battle.plr).met; };
 globalThis.offered=(id,tp,o)=>{ board(id,o); const a=battle.plr; return battle.getAvailableDefenseCards('opp',false,tp,[o&&o.weapon?a.item:a.monsters.center]).some(x=>x.handIdx===0); };`);

// effect-branch conditions must not become cast requirements
ck("3144 Blade Dragon Shield: no center monster, life 10 -> castable (the '2 life or less' is an effect branch)", val(`return met(3144,{});`));
ck("3144 is offered when attacked directly", val(`return offered(3144,'fighter',{});`));
ck("3144 is NOT castable with a monster in the center", val(`return !met(3144,{center:true});`));
ck("6029 Kronos Amena: [Reversal] later in the text is not a cast requirement (needs a Time Dragon)", val(`return met(6029,{center:true,centerCard:Object.assign({},plain,{attrs:['Time Dragon']})});`));
// negative requirement
ck("217 Pillar of Fire: 'no monster in the center' is met with an empty center", val(`return met(217,{});`));
ck("217 is NOT castable with a center monster", val(`return !met(217,{center:true});`));
ck("1610 Divine Crash: Weapon equipped + empty center -> castable", val(`return met(1610,{item:true});`));
// the real cast requirement in the cast sentence still blocks
ck("6190 -Damuna-: 'if your flag [Reversal] during this fight' still blocks at 0 reversals", val(`return !met(6190,{});`));
ck("2508 Sunshine Rush: 5 life or less still blocks at life 10, passes at 4", val(`return !met(2508,{}) && met(2508,{life:4});`));
// 'attacking your monster' is not 'attacking you'
ck("286 Sword Skill Bare Hand Intercept: offered when a Weapon attacks my monster", val(`return offered(286,'center',{center:true,weapon:true});`));
ck("286 is NOT offered when I am attacked directly", val(`return !offered(286,'fighter',{weapon:true});`));
console.log(`\npass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
