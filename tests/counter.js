const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
const ids = JSON.parse(run(`JSON.stringify(ALL_CARDS.filter(c=>ABX.ownsCounter(c)&&ABX.get(c).abilities.some(a=>a.kind==='spell'&&a.steps.some(s=>s.op==='nullifyAttack'))).map(c=>c.id))`));
console.log("executable nullify-attack counters:", ids.length);
(async()=>{ let ok=0, bad=[];
 for (const id of ids) {
  run(`(function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; globalThis.__res=null;
   const c=CARD_MAP.get(${id}); const me=battle.opp; me.gauge=me.deck.splice(0,5); me.life=10; me.hand=[c.id]; me.drop=me.deck.splice(0,5); me.deck.unshift(ALL_CARDS.find(x=>x.type==='Monster').id);
   const att=battle.plr; att.monsters.center={card:ALL_CARDS.find(x=>x.type==='Monster'),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
   battle.executeAttackResolution=function(a,z,t,n){ globalThis.__res=n; };
   battle.applyDefensiveCounterCard("opp",0,"plr",["center"],"fighter"); })()`);
  for (let i=0;i<4;i++){ await flush(); await new Promise(r=>setTimeout(r,3)); }
  const r = run(`__res`); if (r===true) ok++; else bad.push([id, r]);
 }
 console.log("resolved", ok, "of", ids.length, "| not nullifying/unresolved:", bad.length, JSON.stringify(bad.slice(0,8)));
})();
