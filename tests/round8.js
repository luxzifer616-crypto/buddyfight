// Round 8: the response window works online (the friend's device is asked), and
// "That card becomes a size 0 monster as long as "X" is on the field" ends when X leaves.
const { createEnv } = require("./headless.js");
const mkEnv = () => {
  const env = createEnv();
  env.run(`ABX.fast=true; globalThis.__n=980000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,5); f.life=10; f.hand=[]; f.setSpells=[]; }); };
globalThis.__sent=[]; globalThis.goOnline=function(){ battle.mode='online_p2p'; battle.opp.isBot=false; app.peerConn={open:true, send:(m)=>__sent.push(m)}; };`);
  return env;
};
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };

(async () => {
  const A = mkEnv();   // the caster's device
  const settle = async (env) => { for (let i = 0; i < 10; i++) { await env.flush(); await new Promise(r => setTimeout(r, 5)); } };
  const run = (c) => A.run("{" + c + "\n}");

  // 1. online: friend holds "Nullify the spell" (7) -> the friend is asked, answers, spell is nullified
  run(`fresh(); goOnline(); battle.opp.hand=[7]; globalThis.__sp=mk('',{type:'Spell',skill:'Draw a card.'}); globalThis.__res=null; ABX.castWindow('plr', __sp, 'spell').then(v=>__res=v);`);
  await Promise.resolve();
  const prompt = A.run(`__sent.find(m=>m.type==='P2P_CAST_PROMPT')`);
  ck("caster sends P2P_CAST_PROMPT to the friend", !!prompt && prompt.kind === "spell" && prompt.cardId === A.run(`__sp.id`), A.run(`__sent.map(m=>m.type)`));
  ck("…with a board snapshot", !!(prompt && prompt.stateSnapshot && prompt.stateSnapshot.senderOpp));
  ck("…and waits (not resolved yet)", A.run(`__res===null`));
  const label = A.run(`ABX.responseOptions('opp', __sp, 'spell')[0].label`);
  A.run(`ABX.receiveCastResponse({reqId:${prompt.reqId}, label:${JSON.stringify(label)}, cardId:7})`);
  await settle(A);
  ck("friend's answer nullifies the spell", A.run(`__res===true && battle.opp.drop.includes(7) && !battle.opp.hand.includes(7)`), A.run(`[__res, battle.opp.hand]`));
  ck("board is synced back after the answer", A.run(`__sent.some(m=>m.type==='P2P_STATE_SYNC')`));
  ck("remote auto flag is cleared", A.run(`ABX.remoteAutoSide==null`));

  // 2. friend lets it resolve
  run(`fresh(); goOnline(); __sent.length=0; battle.opp.hand=[7]; globalThis.__res=null; ABX.castWindow('plr', __sp, 'spell').then(v=>__res=v);`);
  const p2 = A.run(`__sent.find(m=>m.type==='P2P_CAST_PROMPT')`);
  A.run(`ABX.receiveCastResponse({reqId:${p2.reqId}, label:null})`); await settle(A);
  ck("'Let it resolve' -> not nullified", A.run(`__res===false && battle.opp.hand.includes(7)`));

  // 3. friend has nothing -> no message, no waiting
  run(`fresh(); goOnline(); __sent.length=0; globalThis.__res=null; ABX.castWindow('plr', __sp, 'spell').then(v=>__res=v);`);
  await settle(A);
  ck("no options -> friend is not asked", A.run(`__res===false && !__sent.some(m=>m.type==='P2P_CAST_PROMPT')`));

  // 4. a forged answer (card the friend doesn't have) does nothing
  run(`fresh(); goOnline(); __sent.length=0; battle.opp.hand=[7]; globalThis.__res=null; ABX.castWindow('plr', __sp, 'spell').then(v=>__res=v);`);
  const p4 = A.run(`__sent.find(m=>m.type==='P2P_CAST_PROMPT')`);
  A.run(`ABX.receiveCastResponse({reqId:${p4.reqId}, label:'✨ Cast "Fake"', cardId:123})`); await settle(A);
  ck("forged answer is ignored", A.run(`__res===false && battle.opp.hand.includes(7)`));

  // 5. timeout -> resolves
  run(`fresh(); goOnline(); __sent.length=0; battle.opp.hand=[7]; ABX.onlineWaitMs=20; globalThis.__res=null; ABX.castWindow('plr', __sp, 'spell').then(v=>__res=v);`);
  await new Promise(r => setTimeout(r, 80)); await settle(A);
  ck("no answer in time -> spell resolves", A.run(`__res===false`));
  A.run(`ABX.onlineWaitMs=0`);

  // 6. "Nullify the call" (9) works online too
  run(`fresh(); goOnline(); __sent.length=0; battle.opp.hand=[9]; globalThis.__mon=mk('',{type:'Monster'}); globalThis.__res=null; ABX.castWindow('plr', __mon, 'call').then(v=>__res=v);`);
  const p6 = A.run(`__sent.find(m=>m.type==='P2P_CAST_PROMPT')`);
  const l6 = A.run(`ABX.responseOptions('opp', __mon, 'call')[0].label`);
  A.run(`ABX.receiveCastResponse({reqId:${p6.reqId}, label:${JSON.stringify(l6)}, cardId:9})`); await settle(A);
  ck("online friend nullifies a call", A.run(`__res===true`));

  // 7. the friend's device: gets the prompt, shows options, answers with what was picked
  const Bd = mkEnv();
  Bd.run(`fresh(); goOnline(); battle.plr.hand=[7]; ABX.hooks=ABX.hooks||{}; ABX.hooks.castResponse=async (s,c,k,o)=>0;`);
  const snap = Bd.run(`({turnCount:3, activeSideForReceiver:'opp', phase:'main', senderPlr: JSON.parse(JSON.stringify(battle.opp)), senderOpp: JSON.parse(JSON.stringify(battle.plr))})`);
  Bd.run(`battle.receiveOnlineCastPromptFromPeer(${JSON.stringify({ reqId: 5, cardId: 7, kind: "spell", stateSnapshot: snap })})`.replace('"cardId":7', '"cardId":7'));
  // cardId must be a real spell card the caster cast; use card 1 if 7 can't nullify itself — any spell id works for the prompt
  await settle(Bd);
  const r7 = Bd.run(`__sent.find(m=>m.type==='P2P_CAST_RESPONSE')`);
  ck("friend's device replies with the picked option", !!r7 && r7.reqId === 5 && r7.cardId === 7 && typeof r7.label === "string", r7);
  Bd.run(`__sent.length=0; battle.receiveOnlineCastPromptFromPeer(${JSON.stringify({ reqId: 6, cardId: 999999999, kind: "spell", stateSnapshot: snap })})`);
  await settle(Bd);
  const r8 = Bd.run(`__sent.find(m=>m.type==='P2P_CAST_RESPONSE')`);
  ck("unknown card -> 'let it resolve' reply", !!r8 && r8.label === null, r8);

  // 8. size 0 as long as X is on the field
  const s = A.run(`(function(){ const c=[...CARD_MAP.values()].find(c=>/size 0 monster as long as/.test(c.skill||'')); const ab=ABX.get(c); return JSON.stringify(ab.abilities.map(a=>a.steps||[]).flat().filter(x=>x.op==='setSize0')); })()`);
  ck("parser keeps the 'as long as' name", /"whileName":"(Great Leader, Anson|Dragon Knight, Napoleon)"/.test(s), s);
  run(`fresh(); ABX.onlineWaitMs=0; battle.mode='hotseat'; globalThis.__anson=put('plr','center', mk('',{name:'Great Leader, Anson', size:2})); globalThis.__t=put('plr','left', mk('',{size:2})); __t.abxSize0={whileName:'Great Leader, Anson'};`);
  ck("size 0 while Anson is on the field", A.run(`getEffectiveCardSize(battle.plr, __t.card, __t)===0`), A.run(`getEffectiveCardSize(battle.plr, __t.card, __t)`));
  run(`battle.plr.monsters.center=null;`);
  ck("…back to size 2 when Anson leaves", A.run(`getEffectiveCardSize(battle.plr, __t.card, __t)===2`), A.run(`getEffectiveCardSize(battle.plr, __t.card, __t)`));
  run(`battle.plr.monsters.center=__anson;`);
  ck("…and stays size 2 if Anson comes back", A.run(`getEffectiveCardSize(battle.plr, __t.card, __t)===2`));
  run(`__t.abxSize0=true;`);
  ck("plain 'until it leaves the field' size 0 unchanged", A.run(`getEffectiveCardSize(battle.plr, __t.card, __t)===0`));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
