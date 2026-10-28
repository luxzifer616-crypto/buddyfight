// Sweep: every field / soul / [Set] / drop-zone [Counter] [Act] offered in the defense window is used once
// during an opponent's attack. Checks: no errors, no cards created or lost, the match does not get stuck.
const { createEnv } = require("./headless.js");
const env = createEnv();
const val = (c) => env.run(c);
env.run(`ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 globalThis.mku=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.count=()=>{ let n=0; [battle.plr,battle.opp].forEach(f=>{ n+=f.deck.length+f.hand.length+f.gauge.length+f.drop.length+(f.setSpells||[]).length; ['left','center','right'].forEach(p=>{ const u=f.monsters[p]; if(u){ n+=1+(u.soul||[]).length; } }); if(f.item) n+=1+(f.item.soul||[]).length; }); return n; };
 globalThis.setupFor=function(c, where){ const F=battle.plr, E=battle.opp; battle.matchOver=false; battle.activeSide='opp'; battle.phase='attack'; battle.turnCount=4;
   [F,E].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.isBot=false; f.timeStoppedThisTurn=false; f.timeStoppedThisBattle=false; });
   const pool=ALL_CARDS.filter(x=>x.type==='Monster' && (x.size||0)<=2).map(x=>x.id);
   F.deck=pool.slice(0,30); F.gauge=pool.slice(30,36); F.hand=pool.slice(36,42); F.drop=pool.slice(42,50).concat(where==='drop'?[c.id]:[]); F.life=10;
   E.deck=pool.slice(50,80); E.gauge=pool.slice(80,84); E.hand=pool.slice(84,88); E.drop=[]; E.life=10;
   const host=mku(CARD_MAP.get(pool[90])); F.monsters.center=host;
   if (where==='field') { if(c.type==='Item') F.item=mku(c); else F.monsters.left=mku(c); F.monsters.right=mku(CARD_MAP.get(pool[91])); }
   if (where==='soul') { host.soul=[c.id]; }
   if (where==='set') F.setSpells=[c];
   const att=mku(CARD_MAP.get(pool[92])); att.card=Object.assign({},att.card); E.monsters.center=att; E.monsters.left=mku(CARD_MAP.get(pool[93]));
   return att; };
 { const oe=battle.executeAttackResolution; battle.executeAttackResolution=function(){ globalThis.__done=true; return oe.apply(this,arguments); }; }`);
const cands = val(`ALL_CARDS.filter(c=>/\\[counter\\]/i.test(c.skill||'') && /\\[act\\]/i.test(c.skill||'') && ['Monster','Item','Spell'].includes(c.type)).map(c=>c.id)`);
const settle = async () => { for (let i = 0; i < 30; i++) { env.flush(); await new Promise(r => setImmediate(r)); } };
(async () => {
  let offered = 0, used = 0, errs = [], lost = [], stuck = [], cardsWith = 0;
  for (const id of cands) {
    for (const where of ["field", "soul", "set", "drop"]) {
      const ok = val(`(function(){ const c=CARD_MAP.get(${id}); if('${where}'==='set' && !(c.type==='Spell' && c.set)) return false; if('${where}'!=='set' && c.type==='Spell') return false; return true; })()`);
      if (!ok) continue;
      const opts = val(`(function(){ setupFor(CARD_MAP.get(${id}),'${where}'); return battle.getAvailableDefenseCards('plr',false,'center',[battle.opp.monsters.center]).filter(o=>o.fieldKey && o.card.id===${id}).map(o=>o.fieldKey); })()`);
      if (!opts.length) continue;
      cardsWith++;
      for (const key of opts) {
        offered++;
        env.sandbox.__timerErrors = [];
        val(`ABX.debug=false; setupFor(CARD_MAP.get(${id}),'${where}'); globalThis.__c0=count(); globalThis.__done=false;
          battle.pendingDefenseContext={attSide:'opp',attackerZones:['center'],targetPos:'center',defSide:'plr'};
          try { battle.resolveDefenseChoice({fieldKey:${JSON.stringify(key)}}); } catch(e) { globalThis.__err=String(e&&e.stack||e); }`);
        await settle();
        const r = val(`(function(){ const r={err:globalThis.__err||null, c0:__c0, c1:count(), done:__done || !battle.opp.monsters.center, life:[battle.plr.life,battle.opp.life]}; globalThis.__err=null; return r; })()`);
        const te = (env.sandbox.__timerErrors || []).filter(e => !/is not a function|Cannot read properties of undefined \(reading 'classList'\)/.test(e));
        if (r.err || te.length) errs.push(`${id}/${where}: ${(r.err || te[0]).split("\n")[0]}`);
        else used++;
        if (r.c0 !== r.c1) lost.push(`${id}/${where}: ${r.c0}->${r.c1}`);
        if (!r.done) stuck.push(`${id}/${where}`);
      }
    }
  }
  console.log(`cards with an offered field [Counter] [Act]: ${cardsWith}, options: ${offered}, ran clean: ${used}`);
  console.log(`errors: ${errs.length}`); errs.slice(0, 30).forEach(e => console.log("  ERR", e));
  console.log(`card count changed: ${lost.length}`); lost.slice(0, 30).forEach(e => console.log("  CNT", e));
  console.log(`attack never resolved (waiting): ${stuck.length}`); console.log("  " + stuck.slice(0, 40).join(" "));
})();
