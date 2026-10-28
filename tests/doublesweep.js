// Sweep: find stat bonuses applied by BOTH the old code and ABX (double counting), e.g. Zeitwelg 6046.
const { createEnv } = require("./headless.js");
const env = createEnv({files:["cards_data.js","game.js","impact_monsters.js","abilities_parser.js","abilities_ui.js","abilities_engine.js","abilities_ops.js","abilities_more.js","abilities_r9.js","abilities_r10.js"]});
const res = env.run(`(function(){
 battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 const f=battle.plr; let nid=990000;
 const mku=(card)=>({card,rested:false,attacksLeft:1,soul:[1,2,3],tempPower:0,tempDef:0,tempCrit:0});
 const clear=()=>{ ['left','center','right'].forEach(p=>{f.monsters[p]=null; battle.opp.monsters[p]=null;}); f.item=null; f.setSpells=[]; };
 const out=[];
 const measure=(u)=>{ const c=u.card; const T=getUnitEffectiveCombatStats(f,u); const A=ABX.staticBonus?ABX.staticBonus(f,u):{power:0,defense:0,crit:0};
   const L={power:T.power-(c.power||0)-A.power, defense:T.defense-(c.defense||0)-A.defense, crit:T.crit-(c.crit==null?1:c.crit)-A.crit}; return {A,L}; };
 const bad=(m)=>['power','defense','crit'].some(k=>m.A[k]>0 && m.L[k]>0);
 ALL_CARDS.forEach(c=>{ const s=c.skill||''; if(!/power\\+|defense\\+|critical\\+/i.test(s)) return; if(c.type==='Flag'||c.type==='Impact') return;
   for (const rev of [0,2,4]) {
     f.godclock=f.godclock||{}; f.godclock.reversalCount=rev; f.godclock.overgodActive=rev===4;
     if (ABX.resetCaches) ABX.resetCaches();
     clear();
     const tribes=[...s.matchAll(/«([^»]+)»/g)].map(m=>m[1].replace(/\\s+/g,''));
     const dummy={id:++nid,name:'Dummy',type:'Monster',skill:'',cost:'',attrs:[...new Set([...(c.attrs||[]),...tribes])],worlds:c.worlds||[],world:c.world,img:'',size:1,power:5000,defense:5000,crit:1};
     CARD_MAP.set(dummy.id,dummy);
     let self=null;
     try {
       if (c.type==='Monster') { self=mku(c); f.monsters.left=self; }
       else if (c.type==='Item') { self=mku(c); f.item=self; }
       else if (c.type==='Spell') { if(!/\\[set\\]/i.test(s)) return; f.setSpells=[c]; }
       else return;
       const d=mku(dummy); f.monsters.center=d;
       const md=measure(d); const ms=self?measure(self):null;
       if (bad(md) || (ms && bad(ms))) { out.push({id:c.id,name:c.name,rev,aura:bad(md)?md:null,self:ms&&bad(ms)?ms:null}); break; }
     } catch(e) { out.push({id:c.id,err:String(e)}); break; }
   }
 });
 return out; })()`);
console.log(res.length);
res.forEach(r=>console.log(JSON.stringify(r)));
