// Round 5 ability functions: hand [Act]s (own turn + [Counter] in the defense window), untagged activated lines,
// "up to one «A» and up to one «B»" (separate picks), deck-or-drop, call on top of a card / from a soul,
// "the next time that card would be destroyed, it remains", damage shields in battle + continuous + expiry,
// attack counter conditions.
const { createEnv } = require("./headless.js");
const env = createEnv(); const { flush } = env;
const run = (c) => env.run("{" + c + "\n}");
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=940000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'Q'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.actUse=function(side,u){ return ABX.runAbility(side, u.card, ABX.actAbilities(u.card)[0], u); };
globalThis.__realEAR=battle.executeAttackResolution;
globalThis.fresh=function(){ battle.executeAttackResolution=__realEAR; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,5); f.life=10; }); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 10; i++) { await flush(); await new Promise(r => setTimeout(r, 5)); } };

(async () => {
  // 1. hand [Act] on your own turn: "Rebellion of the Shadow Lion" (1818) discard this card -> «Shadow Shade» from drop to hand
  run(`fresh(); const f=battle.plr; globalThis.__ss=mk('',{attrs:['Shadow Shade']}).id; f.drop.push(__ss); f.hand=[1818, mk('').id]; globalThis.__ab=ABX.handUseActs(CARD_MAP.get(1818))[0];`);
  ck("1818 is a hand [Act], not a field [Act]", run(`!!__ab && ABX.actAbilities(CARD_MAP.get(1818)).length===0`));
  ck("…usable now", run(`ABX.canUseHandAct('plr',0,__ab).ok`));
  run(`ABX.hooks.pickCards=(o)=>{ const i=(o.cards||[]).findIndex(x=>x.card&&x.card.id===__ss); return [i<0?0:i]; }; ABX.runHandUse('plr',0,__ab)`); await settle(); run(`ABX.hooks.pickCards=null`);
  // (1818 is a «Shadow Shade» itself, so getting either back is legal; the other hand card must stay)
  ck("discarded THIS card (not another) and got a «Shadow Shade» back", run(`(function(){ const h=battle.plr.hand, d=battle.plr.drop; return h.length===2 && h.some(id=>CARD_MAP.get(id).name.startsWith('Q')&&id!==__ss) && (h.includes(__ss)||h.includes(1818)) && (d.includes(1818)||d.includes(__ss)); })()`), run(`[battle.plr.hand, battle.plr.drop.slice(-2)]`));

  // 2. "Put this hand card into the soul of a size 3 monster on your field" (2787)
  run(`fresh(); globalThis.__big=put('plr','center', mk('',{size:3})); battle.plr.hand=[2787]; globalThis.__ab=ABX.handUseActs(CARD_MAP.get(2787))[0];`);
  ck("2787 hand [Act] exists", run(`!!__ab`));
  run(`ABX.runHandUse('plr',0,__ab)`); await settle();
  ck("2787 went from hand into the size 3 monster's soul", run(`__big.soul.includes(2787) && !battle.plr.hand.includes(2787)`));

  // 3. own-turn hand call: 5825 is offered as a hand [Act] (its [Call Cost] needs an "Emperor, Backbeard" -> locked)
  run(`fresh(); battle.phase='attack'; battle.plr.hand=[5825]; globalThis.__ab=ABX.handUseActs(CARD_MAP.get(5825))[0];`);
  ck("5825 own-turn hand call found, locked without its Call Cost target", run(`!!__ab && !ABX.canUseHandAct('plr',0,__ab).ok`), run(`__ab && ABX.canUseHandAct('plr',0,__ab)`));

  // 4. [Counter] hand ability in the defense window: Time General Tubocas (5937) "drop this card from hand, gain 3 life"
  run(`fresh(); battle.activeSide='opp'; battle.phase='attack'; globalThis.__a=put('opp','center', mk('')); battle.plr.hand=[5937]; globalThis.__l0=battle.plr.life;
    battle.executeAttackResolution=function(a,z,t,n){ globalThis.__res=[t,n]; };
    globalThis.__opts=battle.getAvailableDefenseCards('plr', false, 'fighter', [__a]);`);
  ck("5937 offered in the defense window", run(`__opts.some(o=>o.info&&o.info.category==='abx_hand_use')`));
  run(`battle.applyDefensiveCounterCard('plr',0,'opp',['center'],'fighter')`); await settle();
  ck("…dropped from hand, gained 3 life, attack continues", run(`battle.plr.life===__l0+3 && battle.plr.drop.includes(5937) && Array.isArray(__res)`), run(`[battle.plr.life-__l0]`));

  // 5. "[Counter] Call this card from your hand." (380) is a defense hand call
  ck("380 [Counter] self-call is a defense hand act", run(`ABX.isDefenseHandAct(CARD_MAP.get(380))`));

  // 6. untagged named activated ability (43 "Fatal Ripper": pay 1 gauge -> power+3000)
  run(`fresh(); globalThis.__u=put('plr','center', CARD_MAP.get(43)); globalThis.__g0=battle.plr.gauge.length;`);
  ck("named early-set ability is an [Act]", run(`ABX.actAbilities(__u.card).length===1`));
  run(`actUse('plr', __u)`); await settle();
  ck("…paid 1 gauge, +3000 power", run(`battle.plr.gauge.length===__g0-1 && __u.tempPower===3000`), run(`[__g0-battle.plr.gauge.length, __u.tempPower]`));

  // 7. "up to one size 1 monster and up to one size 2 monster from your drop zone" (896): one of each
  run(`fresh(); const f=battle.plr; globalThis.__s1=[mk('',{size:1}).id, mk('',{size:1}).id]; globalThis.__s2=mk('',{size:2}).id; f.drop=[...__s1, __s2]; globalThis.__h0=f.hand.length; globalThis.__u=put('plr','center', CARD_MAP.get(896));`);
  run(`ABX.fireEnter('plr', __u.card, 'center')`); await settle();
  ck("separate picks: one size 1 + one size 2 (not two size 1)", run(`battle.plr.hand.length===__h0+2 && battle.plr.hand.includes(__s2) && __s1.filter(id=>battle.plr.hand.includes(id)).length===1`), run(`battle.plr.hand.slice(-2)`));

  // 8. search with two parts (4470: size 3 «Mobile Aerial Team» + «Weaponry» from deck)
  ck("4470 search parses into two parts", run(`(function(){ const a=ABX.get(CARD_MAP.get(4470)).abilities.find(a=>(a.steps||[]).some(s=>s.np&&s.np.parts)); return !!a && ABX.isExecutable(a); })()`));

  // 9. "from your deck or drop zone"
  run(`fresh(); globalThis.__z=mk('',{name:'Zerb Test'}); battle.plr.drop.push(__z.id); globalThis.__c=mk('[Act] Put up to one "Zerb Test" from your deck or drop zone into your hand.'); globalThis.__u=put('plr','left',__c);`);
  ck("deck-or-drop is executable", run(`ABX.actAbilities(__c).length===1`));
  run(`actUse('plr', __u)`); await settle();
  ck("…found it in the drop zone", run(`battle.plr.hand.includes(__z.id) && !battle.plr.drop.includes(__z.id)`));

  // 10. call on top of this card (1577-style): old card + soul go into the new card's soul
  run(`fresh(); globalThis.__nd=mk('',{attrs:['Neodragon'],size:2}); battle.plr.drop.push(__nd.id); globalThis.__c=mk('[Act] Call a size 2 «Neodragon» from your drop zone on top of this card without paying its [Call Cost].'); globalThis.__u=put('plr','center',__c); __u.soul.push(7);`);
  ck("on-top call executable", run(`ABX.actAbilities(__c).length===1`));
  run(`actUse('plr', __u)`); await settle();
  ck("…new card on top; old card and its soul in the new soul", run(`(function(){ const m=battle.plr.monsters.center; return m && m.card.id===__nd.id && m.soul.includes(__c.id) && m.soul.includes(7) && !battle.plr.drop.includes(__c.id); })()`), run(`battle.plr.monsters.center && [battle.plr.monsters.center.card.id, battle.plr.monsters.center.soul]`));

  // 11. call from this card's soul
  run(`fresh(); globalThis.__dm=mk('',{attrs:['Dragonarms']}); globalThis.__c=mk('[Act] Call a «Dragonarms» monster from this card\\'s soul without paying its [Call Cost].'); globalThis.__u=put('plr','center',__c); __u.soul.push(__dm.id);`);
  run(`actUse('plr', __u)`); await settle();
  ck("called a monster out of the soul", run(`['left','right'].some(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id===__dm.id) && !__u.soul.includes(__dm.id)`));

  // 12. "the next time that card would be destroyed, it remains on the field" (+life)
  run(`fresh(); globalThis.__m=put('plr','center', mk('')); globalThis.__c=mk('[Act] Choose a monster on your field, for this turn, the next time that card would be destroyed, you gain 1 life and that card remains on the field.'); globalThis.__u=put('plr','left',__c); globalThis.__l0=battle.plr.life;`);
  ck("save-once executable", run(`ABX.actAbilities(__c).length===1`));
  run(`globalThis.__ab=ABX.actAbilities(__c)[0]; ABX.hooks.pickCards=(o)=>{ const i=(o.cards||[]).findIndex(x=>x.card&&x.card.id===__m.card.id); return [i<0?0:i]; }; ABX.runAbility('plr', __c, __ab, __u)`); await settle();
  run(`ABX.hooks.pickCards=null; globalThis.__r1=battle.destroyMonster('plr','center');`); await settle();
  ck("…first destruction prevented, +1 life", run(`battle.plr.monsters.center===__m && battle.plr.life===__l0+1`), run(`[!!battle.plr.monsters.center, battle.plr.life-__l0]`));
  run(`battle.destroyMonster('plr','center')`); await settle();
  ck("…second destruction goes through", run(`!battle.plr.monsters.center || battle.plr.monsters.center!==__m`));

  // 13. damage shields in a real attack
  run(`fresh(); battle.activeSide='opp'; battle.phase='attack'; globalThis.__a=put('opp','center', mk('',{crit:2})); globalThis.__l0=battle.plr.life; ABX.core.st(battle.plr).shields=[]; ABX.OPS.shield.run({mode:'next',toZero:true,from:'attack'},{f:battle.plr,side:'plr'});`);
  run(`battle.executeAttackResolution('opp',['center'],'fighter',false)`); await settle();
  ck("'next damage from attacks is reduced to 0' works on a direct attack", run(`battle.plr.life===__l0`), run(`[__l0-battle.plr.life]`));
  run(`globalThis.__l0=battle.plr.life; __a.rested=false; __a.attacksLeft=1; battle.executeAttackResolution('opp',['center'],'fighter',false)`); await settle();
  ck("…used up: the next attack deals full damage", run(`battle.plr.life===__l0-2`), run(`[__l0-battle.plr.life]`));

  // 14. continuous "Damage you take are reduced by 1." and expiry of turn shields
  run(`fresh(); put('plr','left', mk('Damage you take are reduced by 1.')); globalThis.__l0=battle.plr.life; ABX.core.applyDamage('plr',3,{kind:'attack'});`);
  ck("continuous reduction: 3 damage -> 2", run(`battle.plr.life===__l0-2`), run(`__l0-battle.plr.life`));
  run(`fresh(); globalThis.__l0=battle.plr.life; ABX.core.st(battle.plr).shields=[]; ABX.OPS.shield.run({mode:'turn',reduceBy:5},{f:battle.plr,side:'plr'}); battle.turnCount++; ABX.core.applyDamage('plr',2,{kind:'attack'});`);
  ck("'for this turn' shield expired next turn", run(`battle.plr.life===__l0-2`));
  ck("'For this turn, damage you take are reduced by 3.' parses", run(`(function(){ const c=mk('[Act] For this turn, damage you take are reduced by 3.'); return ABX.actAbilities(c).length===1; })()`));

  // 15. attack counter condition
  run(`fresh(); globalThis.__c=mk('[Act] If your cards attacked two times or more during this turn, draw a card.'); globalThis.__u=put('plr','left',__c); globalThis.__x=put('plr','right',mk('')); globalThis.__h0=battle.plr.hand.length;`);
  run(`ABX.fireAttack('plr',[{unit:__x,zone:'right'}],'opp','fighter'); ABX.fireAttack('plr',[{unit:__x,zone:'right'}],'opp','fighter');`); await settle();
  run(`actUse('plr', __u)`); await settle();
  ck("'your cards attacked two times' counts attacks", run(`battle.plr.hand.length===__h0+1`), run(`battle.plr.hand.length-__h0`));

  console.log(`\npass ${pass} fail ${fail}`);
})();
