const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
const ids = JSON.parse(run(`JSON.stringify(ALL_CARDS.filter(c=>ABX.isDefenseHandAct(c)).map(c=>c.id))`));
console.log("hand-act cards:", ids.length);
(async()=>{ let ok=0, bad=[];
 for (const id of ids) {
  run(`(function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; globalThis.__res=null; ABX.noPhaseEvents=true; battle.activeSide='plr'; battle.phase='attack'; battle.turnCount=3; ABX.noPhaseEvents=false;
   const c=CARD_MAP.get(${id}); const me=battle.opp; me.gauge=me.deck.splice(0,6); me.life=10; me.hand=[c.id]; me.monsters={left:null,center:null,right:null};
   const att=battle.plr; att.monsters.center={card:ALL_CARDS.find(x=>x.type==='Monster'),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
   battle.executeAttackResolution=function(a,z,t,n){ globalThis.__res=[t,n]; };
   globalThis.__opt = battle.getAvailableDefenseCards('opp', false, 'fighter', [att.monsters.center]).some(o=>o.handIdx===0);
   if (__opt) battle.applyDefensiveCounterCard('opp',0,'plr',['center'],'fighter'); })()`);
  for (let i=0;i<5;i++){ await flush(); await new Promise(r=>setTimeout(r,3)); }
  const r = JSON.parse(run(`JSON.stringify({opt:__opt,res:__res,onField:Object.values(battle.opp.monsters).filter(Boolean).length})`));
  if (r.opt && r.res && r.onField===1) ok++; else bad.push([id,r]);
 }
 console.log("offered+called:", ok, "of", ids.length, "| other:", bad.length, JSON.stringify(bad.map(b=>b[0])));
})();
