// Counter spells whose "only cast" text needs game state (G.BOOST used, Flag [Reversal], 3 tribe monsters, a named monster):
// blocked without the state, offered / castable once the state exists.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;
 globalThis.plain=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
 globalThis.mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.setup=function(id,fn,tp){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const me=battle.opp; me.gauge=me.deck.splice(0,8); me.life=10; me.hand=[id]; me.drop=me.deck.splice(0,8); me.monsters.center=mk(plain);
  const a=battle.plr; a.monsters.center=mk(plain); battle.turn='plr'; battle.activeSide='plr'; battle.phase='attack'; battle.turnCount=5; if(fn) fn(me,a);
  return battle.getAvailableDefenseCards('opp',false,tp||'center',[a.monsters.center]).some(o=>o.handIdx===0); };`);
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
// the rest of the state-gated spells: each is blocked on a plain board and offered once its state exists
run(`globalThis.boostCard=(sub)=>ALL_CARDS.find(c=>c.type==='Monster' && (c.skill||'').includes(sub?'[G.BOOST-'+sub+'-]':'[G.BOOST-'));
 globalThis.oppress=ALL_CARDS.find(c=>c.type==='Monster' && /oppress/i.test(c.name+' '+(c.skill||'')));`);
const cases = [
  [5580, "G.BOOST-Craft- used", `(me)=>{ me.abxGBoostUsed={turn:battle.turnCount,subs:['craft']}; }`],
  [5791, "G.BOOST-Will- used", `(me)=>{ me.abxGBoostUsed={turn:battle.turnCount,subs:['will']}; }`],
  [5803, "a [G.BOOST-Will-] card on the field", `(me)=>{ me.monsters.left=mk(boostCard('Will')); }`],
  [6038, "a [G.BOOST-Base-] card on the field", `(me)=>{ me.monsters.left=mk(boostCard('Base')); }`],
  [6039, "a [G.BOOST] card on the field", `(me)=>{ me.monsters.left=mk(boostCard('Base')); }`],
  [6041, "a [G.BOOST-Will-] card on the field", `(me)=>{ me.monsters.left=mk(boostCard('Will')); }`],
  [6042, "a [G.BOOST-Craft-] card on the field", `(me)=>{ me.monsters.left=mk(boostCard('Craft')); }`],
  [6155, "the Flag used [Reversal]", `(me)=>{ me.godclock=Object.assign(me.godclock||{},{reversalCount:1}); }`],
  [6190, "the Flag used [Reversal]", `(me)=>{ me.godclock=Object.assign(me.godclock||{},{reversalCount:1}); }`],
  [6154, "a monster with Oppress on the field", `(me)=>{ me.monsters.left=mk(oppress); }`],
];
for (const [id, what, fn] of cases) {
  const tp = id === 6041 ? "'fighter'" : "'center'";   // 6041 is a damage-reduction spell: only offered when I am attacked directly
  const blocked = t(`setup(${id},null,${tp})`) === false;
  const offered = t(`setup(${id},${fn},${tp})`) === true;
  ck(`${id}: blocked on a plain board, offered with ${what}`, blocked && offered);
}
// 6467 Evolution Future: the hand line is "during your turn" (not a defense card); its [Counter] [Act] works from a monster's soul
ck("6467 is not a defense card from the hand", t(`setup(6467)`) === false);
ck("6467 in the soul of my monster is offered while I am attacked (pay 1 gauge: nullify the attack)", t(`(function(){ setup(6467,null,'center'); const me=battle.opp; me.hand=[]; me.monsters.center.soul=[6467]; const a=battle.plr;
  return battle.getAvailableDefenseCards('opp',false,'center',[a.monsters.center]).some(o=>o.fieldKey && o.card.id===6467 && o.info.nullifies); })()`) === true);
console.log(`\npass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
