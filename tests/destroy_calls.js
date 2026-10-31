// node tests/destroy_calls.js - "on destroys" call costs: #3650 (monster on your center), #4140 ("Miserea"), #5202 (character destroyed by opponent's card), #5307 ([Shuichi Akai])
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };

(async () => {
  const env = createEnv(); const { flush } = env; const run = (c) => env.run('{' + c + '\n}');
  const settle = async () => { for (let i = 0; i < 10; i++) { await new Promise(r => setImmediate(r)); flush(); } };
  const val = (c) => env.run('(function(){' + c + '\n})()');
  env.run(`ABX.fast=true; ABX.autoPlay=true;
  globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; };
  globalThis.card=function(id){ return window.BUDDYFIGHT_CARDS.find(c=>c.id===id); };
  globalThis.put=function(side,pos,id){ const u={card:card(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.getFighter(side).monsters[pos]=u; return u; };
  // victim goes to pos; hand = arm card; gauge n; turn = active side
  globalThis.setup=function(victimId, pos, handId, gaugeN, active){ fresh(); const f=battle.plr; ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null;
    f.gauge=[]; for(let i=0;i<gaugeN;i++) f.gauge.push(100+i); f.life=10; f.maxSize=100; f.hand=[handId]; f.drop=[]; battle.activeSide=active||'plr'; put('plr',pos,victimId); };
  globalThis.called=function(id){ return ['left','center','right'].map(p=>battle.plr.monsters[p]).find(m=>m&&m.card.id===id)||null; };`);

  [3650, 4140, 5202, 5307].forEach(id => ck(id + " cost parses", val(`return ABX.parseCard(card(${id})).abilities.every(a=>!a.unparsed||a.unparsed.length===0)`)));

  // #3650: only a monster on your CENTER; pay 2 gauge
  run(`setup(43, 'center', 3650, 2); battle.destroyMonster('plr','center');`); await settle();
  ck("3650 called when the center monster is destroyed", val(`return !!called(3650) && battle.plr.gauge.length===0`), val(`return [battle.plr.hand.slice(), battle.plr.gauge.length]`));
  run(`setup(43, 'left', 3650, 2); battle.destroyMonster('plr','left');`); await settle();
  ck("3650 not called for a left monster", val(`return !called(3650) && battle.plr.hand.includes(3650) && battle.plr.gauge.length===2`));
  run(`setup(43, 'center', 3650, 1); battle.destroyMonster('plr','center');`); await settle();
  ck("3650 not called with 1 gauge", val(`return !called(3650)`));

  // #4140: a monster with "Miserea" in its card name; pay 2 gauge & top card of the deck into its soul
  run(`setup(1449, 'left', 4140, 2); globalThis.__top=battle.plr.deck[0]; globalThis.__dn=battle.plr.deck.length; battle.destroyMonster('plr','left');`); await settle();
  ck("4140 called for a Miserea monster", val(`return !!called(4140) && battle.plr.gauge.length===0`), val(`return [battle.plr.hand.slice(), battle.plr.gauge.length]`));
  ck("4140 got the top card of the deck in its soul", val(`const u=called(4140); return !!u && u.soul.length===1 && (typeof u.soul[0]==='object'?u.soul[0].id:u.soul[0])===__top && battle.plr.deck.length===__dn-1`), val(`const u=called(4140); return [u&&u.soul, __top]`));
  run(`setup(43, 'left', 4140, 2); battle.destroyMonster('plr','left');`); await settle();
  ck("4140 not called for another monster", val(`return !called(4140)`));

  // #5202: a character on your field destroyed by your OPPONENT's card (attack or effect); not by your own card, not by the rules
  run(`setup(43, 'left', 5202, 2, 'opp'); battle._destroyByAttack=true; try{ battle.destroyMonster('plr','left'); } finally { battle._destroyByAttack=false; }`); await settle();
  ck("5202 called when the opponent's attack destroys it", val(`return !!called(5202) && battle.plr.gauge.length===0`), val(`return [battle.plr.hand.slice(), battle.plr.gauge.length]`));
  run(`setup(43, 'left', 5202, 2, 'plr'); battle.abxEffectSide='opp'; try{ battle.destroyMonster('plr','left'); } finally { battle.abxEffectSide=undefined; }`); await settle();
  ck("5202 called when an opponent's card effect destroys it (even on your turn)", val(`return !!called(5202)`));
  run(`setup(43, 'left', 5202, 2, 'opp'); battle.abxEffectSide='plr'; try{ battle.destroyMonster('plr','left'); } finally { battle.abxEffectSide=undefined; }`); await settle();
  ck("5202 not called when your own effect destroys it (even on their turn)", val(`return !called(5202)`));
  run(`setup(43, 'left', 5202, 2, 'plr'); battle.destroyMonster('plr','left');`); await settle();
  ck("5202 not called when nobody's card destroyed it", val(`return !called(5202)`));
  // end to end: an opponent's [Act]-style destroy ability really sets the destroyer
  run(`setup(43, 'left', 5202, 2, 'plr'); const c=card(1905), ab=ABX.get(c).abilities.find(a=>(a.steps||[]).some(s=>s.op==='destroy')); ABX.core.runAbility('opp', c, ab, null, {auto:true});`); await settle();
  ck("5202 called when a real opponent destroy ability (#1905) resolves", val(`return !!called(5202)`), val(`return [battle.plr.hand.slice(), battle.plr.monsters.left&&battle.plr.monsters.left.card.id]`));

  // #5307: a [Shuichi Akai] (card name) destroyed: pay 2 gauge & top card into its soul
  run(`setup(5200, 'right', 5307, 2); globalThis.__top=battle.plr.deck[0]; battle.destroyMonster('plr','right');`); await settle();
  ck("5307 called for Shuichi Akai", val(`const u=called(5307); return !!u && u.soul.length===1 && (typeof u.soul[0]==='object'?u.soul[0].id:u.soul[0])===__top && battle.plr.gauge.length===0`), val(`return [battle.plr.hand.slice(), battle.plr.gauge.length]`));
  run(`setup(43, 'right', 5307, 2); battle.destroyMonster('plr','right');`); await settle();
  ck("5307 not called for another monster", val(`return !called(5307)`));

  // none of them can be called from the hand in the main phase
  ck("main-phase call blocked (timing info)", val(`return [3650,4140,5202,5307].every(id=>!!ABX.timingCallInfo(card(id)))`));

  console.log(`pass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
