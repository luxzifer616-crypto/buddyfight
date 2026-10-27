// Stress: scripted player vs the built-in bot over many random-flag matches. Reports exceptions + card-count drift + stuck games.
const { createEnv } = require("./headless.js");
const N = +(process.argv[2] || 20), TURNS = +(process.argv[3] || 12);
const env = createEnv(); const { run, flush } = env;
run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__errs=[]; ABX.debug=false;
 globalThis.__flags = ALL_CARDS.filter(c=>c.type==='Flag').map(c=>c.id);
 globalThis.__total=()=>[battle.plr,battle.opp].reduce((n,f)=>n+f.deck.length+f.hand.length+f.drop.length+f.gauge.length+(f.setSpells||[]).length+['left','center','right'].reduce((k,p)=>k+(f.monsters[p]?(f.monsters[p].pairedHalfIds?f.monsters[p].pairedHalfIds.length:1)+f.monsters[p].soul.length:0),0)+(f.item&&!f.item.isEndrulerFlag?1+(f.item.soul||[]).length:0),0);`);
const spin = async (n=40) => { for (let i=0;i<n;i++){ try { await flush(); } catch(e){ errs.push(String(e&&e.stack||e).slice(0,300)); } await new Promise(r=>setTimeout(r,1)); } };
const errs = []; let stuck=0, finished=0, drift=0, plays=0;
(async()=>{
 for (let g=0; g<N; g++) {
  const ok = run(`(function(){ try{ const fl=__flags; const a=fl[Math.floor(Math.random()*fl.length)], b=fl[Math.floor(Math.random()*fl.length)];
    battle.start('bot', generateFlagDeck(a,'A',null,true), generateFlagDeck(b,'B',null,true)); battle.opp.isBot=true; battle.renderBattle=function(){}; globalThis.__t0=__total(); return true;}catch(e){ __errs.push('start:'+e.message); return false; } })()`);
  if (!ok) { continue; }
  await spin(30);
  for (let t=0; t<TURNS; t++) {
    if (run(`battle.matchOver`)) break;
    // scripted player's main phase
    const acted = run(`(function(){ let n=0; try{ const f=battle.plr; if(battle.activeSide!=='plr') return -1;
      for(let i=0;i<4;i++){ const idx=f.hand.findIndex(id=>{const c=CARD_MAP.get(id); return c&&c.type==='Monster';}); if(idx<0)break; const pos=['center','left','right'].find(p=>!f.monsters[p]); if(!pos)break; battle.completeMonsterCall('plr',pos,idx,false,false); n++; }
      const si=f.hand.findIndex(id=>{const c=CARD_MAP.get(id); return c&&c.type==='Spell';}); if(si>=0){ battle.castSpellFromHand('plr',si); n++; }
      }catch(e){ __errs.push('turn:'+(e.stack||e.message).slice(0,300)); } return n; })()`);
    plays += Math.max(0, acted);
    await spin(30);
    // use act abilities
    run(`(function(){ try{ ['left','center','right'].forEach(p=>{ const u=battle.plr.monsters[p]; if(u && ABX.actAbilities(u.card).length) ABX.useAct('plr',u.card,u); }); }catch(e){ __errs.push('act:'+e.message);} })()`);
    await spin(20);
    run(`try{ battle.endTurn(); }catch(e){ __errs.push('end:'+e.message); }`);
    for (let k=0;k<80 && !run(`battle.matchOver || battle.activeSide==='plr' && battle.phase==='main'`);k++) await spin(5);
  }
  const over = run(`battle.matchOver`);
  if (over) finished++;
  const d = run(`__total()-__t0`);
  if (d !== 0 && !over) drift++;
  const e = JSON.parse(run(`JSON.stringify(__errs.splice(0))`)); e.forEach(x=>errs.push(x));
 }
 console.log('ABX ability runs during matches:', run('ABX.stats.runs'));
 console.log(`matches ${N}, finished ${finished}, card-count drift (not finished) ${drift}, scripted plays ${plays}, errors ${errs.length}`);
 const uniq = [...new Set(errs.map(e=>e.split('\n')[0]))]; uniq.slice(0,10).forEach(x=>console.log(' -',x));
})();
