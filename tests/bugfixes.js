// Behaviour checks for the 1A bug fixes #1–11 (catalog in the project doc "buddyfight-bugs-and-functions").
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };

function battleEnv() {
  const env = createEnv();
  env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=920000;
  globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3; battle.pendingAction=null; return battle.plr; };
  globalThis.mk=function(type,extra){ const id=++__n; const c=Object.assign({id,name:'B'+id,type,skill:'',cost:'',attrs:[],worlds:[],world:'Dragon World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
  globalThis.unit=function(side,pos,extra){ const c=mk('Monster',extra); const u={card:c,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.getFighter(side).monsters[pos]=u; return u; };`);
  return env;
}

(async () => {
  const env = battleEnv(); const { flush } = env; const run = (c) => env.run('{' + c + '\n}');

  // #1 Call: the hand changes after pressing Call -> the right card (found by id) is placed, or the call is cancelled.
  run(`fresh(); const f=battle.plr; f.gauge=[1,2,3,4,5]; ['left','center','right'].forEach(p=>f.monsters[p]=null);
    globalThis.__mon=mk('Monster',{cost:''}); const sp=mk('Spell'); f.hand=[sp.id, __mon.id];
    battle.startMonsterCall('plr',1,false); f.hand.splice(0,1); /* hand changed: monster is now at index 0 */
    f.hand.unshift(mk('Spell').id); /* and a spell now sits at the old index? keep index 1 = monster? make it wrong: */
    f.hand=[mk('Spell').id, mk('Spell').id, __mon.id]; battle.onZoneClick('plr','left');`);
  await flush();
  ck("#1 call uses the card id, not the old hand slot", run(`!!battle.plr.monsters.left && battle.plr.monsters.left.card.id===__mon.id`), run(`battle.plr.monsters.left && battle.plr.monsters.left.card.type`));
  run(`fresh(); const f=battle.plr; f.gauge=[1,2,3]; ['left','center','right'].forEach(p=>f.monsters[p]=null); const m=mk('Monster'); f.hand=[m.id]; battle.startMonsterCall('plr',0,false); f.hand=[mk('Spell').id]; battle.onZoneClick('plr','left');`);
  await flush();
  ck("#1 card gone from hand -> call cancelled, nothing placed", run(`!battle.plr.monsters.left && battle.pendingAction===null`));
  ck("#1 a spell can never be 'called'", run(`(function(){ fresh(); const f=battle.plr; f.monsters.left=null; const s=mk('Spell'); f.hand=[s.id]; battle.completeMonsterCall('plr','left',0,false); return !f.monsters.left; })()`));

  // #2 "draw a card" text containing "two" draws only 1.
  run(`fresh(); globalThis.__h=battle.plr.hand.length; const c=mk('Monster',{skill:'[Act] If you have two or more monsters, draw a card.'}); battle.executeCardAbilityEffect('plr', c, null, null);`);
  await flush();
  ck("#2 'two or more ... draw a card' draws 1", run(`battle.plr.hand.length===__h+1`), run(`[battle.plr.hand.length,__h]`));
  run(`fresh(); globalThis.__h=battle.plr.hand.length; const c=mk('Monster',{skill:'[Act] Draw two cards.'}); battle.executeCardAbilityEffect('plr', c, null, null);`);
  await flush();
  ck("#2 'draw two cards' still draws 2", run(`battle.plr.hand.length===__h+2`), run(`[battle.plr.hand.length,__h]`));

  // #3 Replacing an equipped item: its soul goes to the drop zone.
  run(`fresh(); const f=battle.plr; f.gauge=[1,2,3,4]; const old=mk('Item'); globalThis.__s1=mk('Monster').id; globalThis.__s2=mk('Monster').id;
    f.item={card:old,rested:false,attacksLeft:1,soul:[__s1,__s2]}; globalThis.__old=old.id; const nw=mk('Item'); f.hand=[nw.id]; battle.equipCardFromHand('plr',0);`);
  await flush();
  ck("#3 old item's soul goes to drop", run(`battle.plr.drop.includes(__s1)&&battle.plr.drop.includes(__s2)&&battle.plr.drop.includes(__old)`));
  ck("#3 old item removed right away (can't attack during animation)", run(`!battle.plr.item || battle.plr.item.card.id!==__old`));

  // #4 Failed / cancelled Link Attack never leaves you stuck in the Attack Phase.
  run(`fresh(); ['left','center','right'].forEach(p=>battle.plr.monsters[p]=null); battle.plr.item=null; unit('plr','left'); battle.startLinkAttackMode();`);
  ck("#4 link with <2 attackers keeps Main Phase", run(`battle.phase==='main'`), run(`battle.phase`));
  run(`fresh(); ['left','center','right'].forEach(p=>battle.plr.monsters[p]=null); battle.plr.item=null; unit('plr','left'); unit('plr','right'); battle.startLinkAttackMode();`);
  ck("#4 link selection itself stays in Main Phase", run(`battle.phase==='main' && battle.pendingAction && battle.pendingAction.type==='link_select'`), run(`battle.phase`));
  run(`battle.startLinkAttackMode();`);
  ck("#4 cancelling link selection: still Main Phase", run(`battle.phase==='main' && !battle.pendingAction`), run(`battle.phase`));
  run(`fresh(); battle.opp.monsters.center=null; ['left','center','right'].forEach(p=>battle.plr.monsters[p]=null); battle.plr.item=null; unit('plr','left'); unit('plr','right'); battle.startLinkAttackMode(); battle.toggleLinkAttackerZone('plr','left'); battle.toggleLinkAttackerZone('plr','right'); battle.onEnemyFighterClick();`);
  await flush();
  ck("#4 declaring the link attack enters the Attack Phase", run(`battle.phase!=='main'`), run(`battle.phase`));

  // #5 "This turn" boosts (incl. ability [Penetrate], Double Attack…) end at the turn change.
  run(`fresh(); const u=unit('plr','center'); Object.assign(u,{tempPower:5000,tempCrit:1,tempPen:true,tempDA:true,tempCA:true}); globalThis.__u=u; battle.plr.tempDamageReduce=2; battle.startTurn('opp');`);
  await flush();
  ck("#5 boosts cleared at turn change", run(`__u.tempPower===0&&__u.tempCrit===0&&!__u.tempPen&&!__u.tempDA&&!__u.tempCA&&!battle.plr.tempDamageReduce`), run(`[__u.tempPower,__u.tempPen,__u.tempDA]`));

  // #6 Charge & Draw is ignored when it isn't your turn.
  run(`fresh(); battle.mode='bot'; battle.opp.isBot=true; battle.activeSide='opp'; globalThis.__oh=battle.opp.hand.length; globalThis.__og=battle.opp.gauge.length; globalThis.__pa=battle.pendingAction; battle.startChargeMode();`);
  ck("#6 Charge & Draw does nothing on the bot's turn", run(`battle.opp.hand.length===__oh && battle.opp.gauge.length===__og && battle.pendingAction===__pa`));

  // #8 A newer cut-in restarts the hide timer.
  run(`fresh(); globalThis.__ct=[]; const st=setTimeout, ct=clearTimeout; globalThis.clearTimeout=(id)=>__ct.push(id); battle.showCutin('A','a',''); battle.showCutin('B','b',''); globalThis.clearTimeout=ct;`);
  ck("#8 second cut-in clears the first one's timer", run(`__ct.length>=2 && __ct[1]!==undefined`), run(`__ct`));

  // #9 Bot timers from a finished match stop when a new match starts.
  run(`fresh(); globalThis.__g=battle.matchGen; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true));`);
  ck("#9 new match gets a new match id (old bot timers stop)", run(`battle.matchGen===__g+1`));

  // #11 Card names are escaped before going into the page.
  ck("#11 escapeHtml", run(`escapeHtml('<img src=x onerror=alert(1)>')`).indexOf("<") === -1);

  // #7 Damaged or old saves load safely (separate environment so the save is read at start-up).
  const e2 = createEnv();
  let ok7 = true, err7 = "";
  try {
    e2.run(`localStorage.setItem('buddyfight_save_v5', JSON.stringify({owned:[1,2], coins:'abc', decks:[null, {name:'', flagId:99999999, cards:['x',1], buddyId:-1}], activeDeckIndex:'7'})); app.loadState();`);
    ok7 = e2.run(`typeof app.state.owned==='object' && !Array.isArray(app.state.owned) && app.state.coins===2500 && app.state.decks.length===1 && app.state.decks[0].name==='Custom Deck' && app.state.activeDeckIndex===0`);
  } catch (e) { ok7 = false; err7 = String(e); }
  ck("#7 damaged save is repaired, no crash", ok7, err7 || e2.run(`JSON.stringify({c:app.state.coins,d:app.state.decks.length,i:app.state.activeDeckIndex})`));
  try { e2.run(`localStorage.setItem('buddyfight_save_v5','{not json'); app.loadState();`); ck("#7 unreadable save doesn't crash", true); }
  catch (e) { ck("#7 unreadable save doesn't crash", false, String(e)); }

  // #10 Card search uses the cached search text (2nd search much faster than building it).
  const t = run(`(function(){ const q='dragon'; let t0=Date.now(); ALL_CARDS.forEach(c=>cardMatchesTextQuery(c,q,normalizeSearchToken(q))); const first=Date.now()-t0; t0=Date.now(); for(let i=0;i<5;i++) ALL_CARDS.forEach(c=>cardMatchesTextQuery(c,'sword'+i,normalizeSearchToken('sword'+i))); return [first,(Date.now()-t0)/5]; })()`);
  ck(`#10 cached search: ${t[1].toFixed(1)} ms per search over all cards (first build ${t[0]} ms)`, t[1] < 40, t);

  console.log(`\npass ${pass} fail ${fail}`);
})();
