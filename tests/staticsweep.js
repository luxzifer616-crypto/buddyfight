const { createEnv } = require("./headless.js");
const { run } = createEnv();
console.log(run(`(function(){ ABX.fast=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 let n=0, bad=[], moved=0; const f=battle.plr; const other={card:ALL_CARDS.find(c=>c.type==='Monster'&&c.power),rested:false,soul:[],tempPower:0,tempDef:0,tempCrit:0};
 ALL_CARDS.filter(c=>c.type==='Monster'||c.type==='Item').forEach(c=>{ if(!ABX.ownsStaticLine) return; const own=(c.skill||'').split('\\n').some(l=>ABX.ownsStaticLine(c,l)); if(!own) return; n++;
   try{ f.monsters={left:null,center:null,right:null}; const u={card:c,rested:false,soul:[],tempPower:0,tempDef:0,tempCrit:0}; f.monsters.center=u; f.monsters.left=other; const a=getUnitEffectiveCombatStats(f,u), b=getUnitEffectiveCombatStats(f,other); if([a.power,a.defense,a.crit,b.power].some(x=>!isFinite(x))) bad.push(c.id); if(b.power!==other.card.power) moved++; }catch(e){ bad.push(c.id+':'+e.message); } });
 return JSON.stringify({cardsWithOwnedStaticLines:n, errors:bad.slice(0,5), nErrors:bad.length, cardsBuffingAnOtherMonster:moved}); })()`));
