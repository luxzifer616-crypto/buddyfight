// Counter spells whose "only cast" text needs game state (G.BOOST used, Flag [Reversal], 3 tribe monsters, a named monster):
// blocked without the state, offered / castable once the state exists.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;
 globalThis.plain=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
 globalThis.mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.setup=function(id,fn){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const me=battle.opp; me.gauge=me.deck.splice(0,8); me.life=10; me.hand=[id]; me.drop=me.deck.splice(0,8); me.monsters.center=mk(plain);
  const a=battle.plr; a.monsters.center=mk(plain); battle.turn='plr'; battle.activeSide='plr'; battle.phase='attack'; battle.turnCount=5; if(fn) fn(me,a);
  return battle.getAvailableDefenseCards('opp',false,'center',[a.monsters.center]).some(o=>o.handIdx===0); };`);
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
const t = (js) => JSON.parse(run(`JSON.stringify(${js})`));
ck("5141 Gar-E-Burst blocked without [G.BOOST-Base-]", t(`setup(5141)`) === false);
ck("5141 offered after [G.BOOST-Base-] was used this turn", t(`setup(5141,(me)=>{ me.abxGBoostUsed={turn:battle.turnCount,subs:['base']}; })`) === true);
ck("5975 Kronos Syn Blockend blocked at 0 Reversals", t(`setup(5975)`) === false);
ck("5975 offered after the Flag used [Reversal]", t(`setup(5975,(me)=>{ me.godclock=Object.assign(me.godclock||{},{reversalCount:1}); })`) === true);
ck("6206 Kronos Syn Mobius needs 4 Reversals (3 -> no, 4 -> yes)", t(`setup(6206,(me)=>{ me.godclock=Object.assign(me.godclock||{},{reversalCount:3}); })`) === false && t(`setup(6206,(me)=>{ me.godclock=Object.assign(me.godclock||{},{reversalCount:4}); })`) === true);
ck("5235 Genesis Tenacity blocked with 1 monster, offered with 3 «Genesis Dragon»", t(`setup(5235)`) === false &&
   t(`setup(5235,(me)=>{ const g=Object.assign({},plain,{attrs:['Genesis Dragon']}); me.monsters.center=mk(g); me.monsters.left=mk(g); me.monsters.right=mk(g); })`) === true);
console.log(`\npass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
