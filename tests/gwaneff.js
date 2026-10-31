// Aqulta Gwaneff: #942 counter only vs a single attack + ignores [Soulguard]; #4175 counter only vs a link attack.
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
const val = (js) => JSON.parse(run(`JSON.stringify((function(){${js}})())`));
run(`ABX.fast=true; ABX.autoPlay=true; window.alert=function(){};
 globalThis.plain=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
 globalThis.mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.board=function(id,two){
  battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const me=battle.opp; me.gauge=me.deck.splice(0,8); me.life=10; me.hand=[id,plain.id]; me.monsters.center=mk(plain);
  const a=battle.plr; a.monsters.center=mk(plain); a.monsters.left=mk(plain);
  battle.turn='plr'; battle.activeSide='plr'; battle.phase='attack'; return me; };
 globalThis.offered=(id,units)=>{ board(id); const a=battle.plr, me=battle.opp; me.item=mk(CARD_MAP.get(id)); const us=units.map(z=>a.monsters[z]);
   ABX.battleCtx={active:true,attSide:'plr',defSide:'opp',link:us.length>1,attUnits:us,defUnit:me.monsters.center};
   const ab=ABX.actAbilities(CARD_MAP.get(id)).find(x=>(x.tags||[]).includes('counter')); const r=ABX.canUseAct('opp',CARD_MAP.get(id),ab,me.item); ABX.battleCtx=null; return r.ok; };`);
(async () => {
  ck("#942 offered vs a single attack", val(`return offered(942,['center']);`));
  ck("#942 NOT offered vs a link attack", val(`return !offered(942,['center','left']);`));
  ck("#4175 NOT offered vs a single attack", val(`return !offered(4175,['center']);`));
  ck("#4175 offered vs a link attack", val(`return offered(4175,['center','left']);`));
  // soulguard: #942 attacking ignores it no matter how many souls
  run(`(function(){ board(942); const d=battle.opp.monsters.center; d.card=Object.assign({},plain,{sg:true}); d.soul=[plain.id,plain.id,plain.id];
    battle.plr.item=mk(CARD_MAP.get(942)); battle._destroyByAttack=true; battle._attackersNow=[battle.plr.item]; battle.destroyMonster('opp','center'); battle._destroyByAttack=false; battle._attackersNow=null; return 1;})()`);
  await wait(20); flush();
  ck("#942 attacking: soulguard monster (3 souls) is destroyed", val(`return !battle.opp.monsters.center;`));
  run(`(function(){ board(2020); const d=battle.opp.monsters.center; d.card=Object.assign({},plain,{sg:true}); d.soul=[plain.id,plain.id,plain.id];
    battle.plr.item=mk(CARD_MAP.get(2020)); battle._destroyByAttack=true; battle._attackersNow=[battle.plr.item]; battle.destroyMonster('opp','center'); battle._destroyByAttack=false; battle._attackersNow=null; return 1;})()`);
  await wait(20); flush();
  ck("#2020 has no such effect: soulguard still works (monster stays, 2 souls)", val(`return !!battle.opp.monsters.center && battle.opp.monsters.center.soul.length===2;`));
  run(`(function(){ board(4175); const a=battle.plr, me=battle.opp; me.item=mk(CARD_MAP.get(4175)); me.hand=[plain.id,plain.id]; me.life=10;
    ABX.battleCtx={active:true,attSide:'plr',defSide:'opp',link:true,attUnits:[a.monsters.center,a.monsters.left],defUnit:me.monsters.center};
    ABX.useAct('opp',CARD_MAP.get(4175),me.item); return 1;})()`);
  await wait(30); flush(); await wait(30); flush();
  ck("#4175 used vs link: discarded 1 card, paid 1 life, attack nullified", val(`return battle.opp.hand.length===1 && battle.opp.life===9 && !!(ABX.battleCtx&&ABX.battleCtx.nullified);`));
  console.log(`pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})();
