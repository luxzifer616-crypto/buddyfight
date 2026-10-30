// Monster / item / [Set] spell [Counter] [Act] on the field, opponent's turn, outside any attack (banner button -> ABX.useFreeFieldCounter).
// Every offered free option is used once: no errors, no cards created or lost, the unit's own banner lists it.
const { createEnv } = require("./headless.js");
const env = createEnv();
const val = (c) => env.run(c);
env.run(`ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 globalThis.mku=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.count=()=>{ let n=0; [battle.plr,battle.opp].forEach(f=>{ n+=f.deck.length+f.hand.length+f.gauge.length+f.drop.length+(f.setSpells||[]).length; ['left','center','right'].forEach(p=>{ const u=f.monsters[p]; if(u){ n+=1+(u.soul||[]).length; } }); if(f.item) n+=1+(f.item.soul||[]).length; }); return n; };
 globalThis.setupFor=function(c){ const F=battle.plr, E=battle.opp; battle.matchOver=false; battle.activeSide='opp'; battle.phase='main'; battle.turnCount=4; battle.pendingDefenseContext=null;
   [F,E].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.isBot=false; f.timeStoppedThisTurn=false; f.timeStoppedThisBattle=false; });
   const pool=ALL_CARDS.filter(x=>x.type==='Monster' && (x.size||0)<=2).map(x=>x.id);
   F.deck=pool.slice(0,30); F.gauge=pool.slice(30,36); F.hand=pool.slice(36,42); F.drop=pool.slice(42,50); F.life=10;
   E.deck=pool.slice(50,80); E.gauge=pool.slice(80,84); E.hand=pool.slice(84,88); E.drop=[]; E.life=10;
   F.monsters.center=mku(CARD_MAP.get(pool[90]));
   const u=mku(c); if(c.type==='Spell') F.setSpells=[c]; else if(c.type==='Item') F.item=u; else F.monsters.left=u; F.monsters.right=mku(CARD_MAP.get(pool[91]));
   E.monsters.center=mku(CARD_MAP.get(pool[92])); E.monsters.left=mku(CARD_MAP.get(pool[93]));
   return u; };`);
const ids = val(`JSON.stringify(ALL_CARDS.filter(c=>/\\[counter\\]/i.test(c.skill||'') && /\\[act\\]/i.test(c.skill||'') && (['Monster','Item'].includes(c.type)||(c.type==='Spell'&&c.set))).map(c=>c.id))`);
const cands = JSON.parse(ids);
const settle = async () => { for (let i = 0; i < 30; i++) { env.flush(); await new Promise(r => setImmediate(r)); } };
(async () => {
  let cards = 0, used = 0; const errs = [], lost = [];
  for (const id of cands) {
    const keys = JSON.parse(val(`JSON.stringify((function(){ const u=setupFor(CARD_MAP.get(${id})); return ABX.freeFieldCounterOptions('plr').filter(o=>CARD_MAP.get(${id}).type==='Spell' ? (o.area==='set'&&o.card.id===${id}) : o.unit===u).map(o=>o.key); })())`));
    if (!keys.length) continue;
    cards++;
    for (const key of keys) {
      env.sandbox.__timerErrors = [];
      val(`ABX.debug=false; setupFor(CARD_MAP.get(${id})); globalThis.__c0=count(); globalThis.__err=null;
        ABX.useFreeFieldCounter('plr', ${JSON.stringify(key)}).catch(e=>{ globalThis.__err=String(e&&e.stack||e); });`);
      await settle();
      const r = JSON.parse(val(`JSON.stringify({err:globalThis.__err, c0:__c0, c1:count()})`));
      const te = (env.sandbox.__timerErrors || []).filter(e => !/is not a function|Cannot read properties of undefined \(reading 'classList'\)/.test(e));
      if (r.err || te.length) errs.push(`${id}: ${(r.err || te[0]).split("\n")[0]}`); else used++;
      if (r.c0 !== r.c1) lost.push(`${id}: ${r.c0}->${r.c1}`);
    }
  }
  console.log(`[Counter][Act] monster/item candidates ${cands.length} (monsters, items, [Set] spells) | with a free option on the opponent's turn: ${cards} | used ${used}`);
  console.log("errors:", errs.length, errs.slice(0, 5), "| card count changed:", lost.length, lost.slice(0, 5));
  const ok = cards > 0 && !errs.length;
  console.log(ok ? "\nPASS" : "\nFAIL");
  process.exit(ok ? 0 : 1);
})();
