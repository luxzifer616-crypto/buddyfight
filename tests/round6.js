// Round 6 ability functions: "cannot be nullified / [Rest]" protections, conditional "cannot attack", "If you do not have …",
// "for each …" boosts, power/critical comparison filters, "that attacked", "destroy or return to hand", "up to one A or up to one B",
// "with both «A» and «B»", different/same size picks, souls taken from cards on the field, "into the chosen card's soul",
// "in front of this card", "a card with this card in its soul", both-fields boosts, attack redirection, pending-card bug.
const { createEnv } = require("./headless.js");
const env = createEnv(); const { flush } = env;
const run = (c) => env.run("{" + c + "\n}");
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=950000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.actUse=function(side,u){ return ABX.runAbility(side, u.card, ABX.actAbilities(u.card)[0], u); };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,5); f.life=10; }); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 10; i++) { await flush(); await new Promise(r => setTimeout(r, 5)); } };

(async () => {
  // 1. "Abilities of all «X» on your field cannot be nullified by your opponent's card effects" (aura)
  run(`fresh(); put('plr','left', mk('Abilities of all «Hero» on your field cannot be nullified by your opponent\\'s card effects.')); globalThis.__h=put('plr','center', mk('',{attrs:['Hero']})); globalThis.__o=put('plr','right', mk(''));`);
  ck("nullify-immunity aura is executable", run(`ABX.isExecutable(ABX.get(battle.plr.monsters.left.card).abilities[0])`));
  ck("«Hero» abilities can't be nullified by the opponent", run(`ABX.core.isProtected(__h,'plr','nullified',{side:'opp'})`));
  ck("…but a non-«Hero» can", run(`!ABX.core.isProtected(__o,'plr','nullified',{side:'opp'})`));
  run(`put('opp','center', mk('[Act] Nullify all abilities of a monster on your opponent\\'s field.'));`);
  run(`ABX.hooks.pickCards=(o)=>{ const i=(o.cards||[]).findIndex(x=>x.card&&x.card.id===__h.card.id); return [i<0?0:i]; }; actUse('opp', battle.opp.monsters.center)`); await settle(); run(`ABX.hooks.pickCards=null`);
  ck("the opponent's nullify can't hit the protected «Hero»", run(`!ABX.core.isNullified(__h)`));

  // 2. combined: "All «X» cannot be destroyed or [Rest] and their abilities cannot be nullified by …"
  run(`fresh(); put('plr','left', mk('All «Hero» on your field cannot be destroyed or [Rest] and their abilities cannot be nullified by your opponent\\'s card effects.')); globalThis.__h=put('plr','center', mk('',{attrs:['Hero']}));`);
  ck("combined protection is executable", run(`ABX.isExecutable(ABX.get(battle.plr.monsters.left.card).abilities[0])`));
  ck("…protects from destroy, rest and nullify", run(`['destroyed','rest','nullified'].every(k=>ABX.core.isProtected(__h,'plr',k,{side:'opp'}))`));
  ck("…but not from returning to hand", run(`!ABX.core.isProtected(__h,'plr','returned to hand',{side:'opp'})`));
  ck("…and not from your own effects", run(`!ABX.core.isProtected(__h,'plr','destroyed',{side:'plr'})`));

  // 3. "If you do not have another «Tarot» card on your field, this card cannot attack." (722)
  run(`fresh(); globalThis.__t=put('plr','center', CARD_MAP.get(722));`);
  ck("722 is executable", run(`ABX.get(CARD_MAP.get(722)).abilities.filter(a=>a.kind==='static').every(a=>ABX.isExecutable(a))`));
  ck("722 alone: can't attack", run(`ABX.core.isRestricted(__t,'attack')`));
  run(`put('plr','right', mk('',{attrs:['Tarot']}));`);
  ck("722 with another «Tarot»: can attack", run(`!ABX.core.isRestricted(__t,'attack')`));

  // 4. "If you do not have an item equipped, this card gets power-10000" (4288)
  run(`fresh(); globalThis.__g=put('plr','center', CARD_MAP.get(4288));`);
  ck("no item: -10000 power", run(`ABX.staticBonus(battle.plr,__g).power===-10000`), run(`ABX.staticBonus(battle.plr,__g)`));
  run(`put('plr','item', mk('',{type:'Item'}));`);
  ck("with an item: no penalty", run(`ABX.staticBonus(battle.plr,__g).power===0`));

  // 5. "For each item on the field, this card gets critical+1" (2095)
  run(`fresh(); globalThis.__r=put('plr','center', CARD_MAP.get(2095)); put('plr','item', mk('',{type:'Item'})); put('opp','item', mk('',{type:'Item'}));`);
  ck("for-each boost: 2 items on the field -> +2 critical", run(`ABX.staticBonus(battle.plr,__r).crit===2`), run(`ABX.staticBonus(battle.plr,__r)`));

  // 6. "destroy a monster … with power less than or equal to this card's power"
  run(`fresh(); globalThis.__c=mk('[Act] Destroy a monster on your opponent\\'s field with power less than or equal to this card\\'s power.',{power:5000}); globalThis.__m=put('plr','center',__c);
    globalThis.__lo=put('opp','left', mk('',{power:3000})); globalThis.__hi=put('opp','right', mk('',{power:9000}));`);
  ck("comparison destroy is executable", run(`ABX.actAbilities(__c).length===1`));
  run(`actUse('plr', __m)`); await settle();
  ck("destroyed only the power ≤ 5000 monster", run(`!battle.opp.monsters.left && battle.opp.monsters.right===__hi`), run(`[!!battle.opp.monsters.left, !!battle.opp.monsters.right]`));

  // 7. "that attacked"
  run(`fresh(); globalThis.__c=mk('[Act] Destroy a monster that attacked on your opponent\\'s field.'); globalThis.__m=put('plr','center',__c);
    globalThis.__a=put('opp','left', mk('')); globalThis.__b=put('opp','right', mk('')); __a.abxAttacked=battle.turnCount;`);
  run(`actUse('plr', __m)`); await settle();
  ck("destroyed only the monster that attacked", run(`!battle.opp.monsters.left && battle.opp.monsters.right===__b`));

  // 8. "destroy or return to hand": the player chooses
  run(`fresh(); globalThis.__c=mk('[Act] Destroy or return to hand a card on your opponent\\'s field.'); globalThis.__m=put('plr','center',__c); globalThis.__v=put('opp','center', mk('')); globalThis.__h0=battle.opp.hand.length;
    ABX.autoPlay=false; ABX.hooks.pickOption=()=>1; ABX.hooks.pickCards=(o)=>[0];`);
  run(`actUse('plr', __m)`); await settle();
  ck("chose 'return to hand' -> it went back to the opponent's hand", run(`!battle.opp.monsters.center && battle.opp.hand.length===__h0+1 && !battle.opp.drop.includes(__v.card.id)`));
  run(`fresh(); globalThis.__c=mk('[Act] Destroy or return to hand a card on your opponent\\'s field.'); globalThis.__m=put('plr','center',__c); globalThis.__v=put('opp','center', mk('')); ABX.hooks.pickOption=()=>0; ABX.hooks.pickCards=(o)=>[0];`);
  run(`actUse('plr', __m)`); await settle();
  ck("chose 'destroy' -> it went to the drop zone", run(`!battle.opp.monsters.center && battle.opp.drop.includes(__v.card.id)`));
  run(`ABX.autoPlay=true; ABX.hooks.pickOption=null; ABX.hooks.pickCards=null;`);

  // 9. "up to one «A» spell with [Set] or up to one «B» item from your deck": one pick from either kind
  run(`fresh(); const f=battle.plr; globalThis.__sa=mk('',{type:'Spell',set:true,attrs:['Alpha']}).id; globalThis.__ib=mk('',{type:'Item',attrs:['Beta']}).id; globalThis.__no=mk('',{type:'Item',attrs:['Gamma']}).id;
    f.deck=[__no,__sa,__ib,1,2,3]; globalThis.__h0=f.hand.length;
    globalThis.__c=mk('[Act] Put up to one «Alpha» spell with [Set] or up to one «Beta» item from your deck into your hand.'); globalThis.__m=put('plr','center',__c);
    ABX.hooks.pickCards=(o)=>{ const i=(o.cards||[]).findIndex(x=>x.card&&x.card.id===__ib); globalThis.__offered=(o.cards||[]).map(x=>x.card.id); return [i<0?0:i]; };`);
  ck("either-kind search is executable", run(`ABX.actAbilities(__c).length===1`));
  run(`ABX.autoPlay=false; actUse('plr', __m)`); await settle(); run(`ABX.autoPlay=true; ABX.hooks.pickCards=null;`);
  ck("offered both kinds, not the third card", run(`__offered.includes(__sa) && __offered.includes(__ib) && !__offered.includes(__no)`), run(`__offered`));
  ck("took exactly one (the «Beta» item)", run(`battle.plr.hand.length===__h0+1 && battle.plr.hand.includes(__ib)`));

  // 10. "with both «A» and «B»"
  run(`fresh(); const f=battle.plr; globalThis.__both=mk('',{attrs:['Alpha','Beta']}).id; globalThis.__one=mk('',{attrs:['Alpha']}).id; f.deck=[__one,__both,1,2,3]; globalThis.__h0=f.hand.length;
    globalThis.__c=mk('[Act] Put up to one monster with both «Alpha» and «Beta» from your deck into your hand.'); globalThis.__m=put('plr','center',__c);`);
  ck("'both' filter is executable", run(`ABX.actAbilities(__c).length===1`));
  run(`actUse('plr', __m)`); await settle();
  ck("only the card with both tribes was taken", run(`battle.plr.hand.includes(__both) && !battle.plr.hand.includes(__one)`));

  // 11. different sizes: two same-size candidates -> only one is taken
  run(`fresh(); const f=battle.plr; globalThis.__d=[mk('',{size:2}).id, mk('',{size:2}).id, mk('',{size:1}).id]; f.drop=__d.slice(); globalThis.__h0=f.hand.length;
    globalThis.__c=mk('[Act] Put up to two monsters with different sizes from your drop zone into your hand.'); globalThis.__m=put('plr','center',__c);`);
  run(`actUse('plr', __m)`); await settle();
  const sizes = run(`battle.plr.hand.slice(__h0).map(id=>CARD_MAP.get(id).size)`);
  ck("different sizes: never two cards of the same size", sizes.length >= 1 && sizes.length <= 2 && new Set(sizes).size === sizes.length, sizes);

  // 12. souls taken from a card on your field
  run(`fresh(); globalThis.__host=put('plr','left', mk('')); __host.soul=[101,102,103]; globalThis.__d0=battle.plr.drop.length;
    globalThis.__c=mk('[Act] Put a soul from a card on your field into your drop zone.'); globalThis.__m=put('plr','center',__c);`);
  ck("soul-from-field is executable", run(`ABX.actAbilities(__c).length===1`));
  run(`actUse('plr', __m)`); await settle();
  ck("one soul moved to the drop zone", run(`battle.plr.drop.length===__d0+1 && __host.soul.length+(__m.soul||[]).length===2`), run(`[battle.plr.drop.length-__d0, __host.soul.length]`));

  // 13. "into the chosen card's soul"
  run(`fresh(); globalThis.__t=put('plr','left', mk('')); globalThis.__top=battle.plr.deck[0];
    globalThis.__c=mk('[Act] Choose a monster on your field other than this card. Put the top card of your deck into the chosen card\\'s soul.'); globalThis.__m=put('plr','center',__c);`);
  ck("chosen-card's-soul move is executable", run(`ABX.actAbilities(__c).length===1`));
  run(`actUse('plr', __m)`); await settle();
  ck("the top card went into the chosen monster's soul", run(`__t.soul.includes(__top) && !__m.soul.includes(__top)`), run(`[__t.soul, __m.soul]`));

  // 14. "on you and your opponent's field" (both fields)
  run(`fresh(); globalThis.__c=mk('[Act] For this turn, all monsters on you and your opponent\\'s field get power+1000.'); globalThis.__m=put('plr','center',__c); globalThis.__e=put('opp','center', mk(''));`);
  run(`actUse('plr', __m)`); await settle();
  ck("both players' monsters got +1000", run(`__m.tempPower===1000 && __e.tempPower===1000`), run(`[__m.tempPower, __e.tempPower]`));

  // 15. "in front of this card" (3468): the opponent monster facing it gets the penalty, the others don't
  run(`fresh(); put('plr','left', CARD_MAP.get(3468)); put('plr','right', mk('',{attrs:['Computer']})); globalThis.__f=put('opp','left', mk('')); globalThis.__s=put('opp','right', mk(''));`);
  ck("3468 is executable", run(`ABX.get(CARD_MAP.get(3468)).abilities.filter(a=>a.kind==='static').every(a=>ABX.isExecutable(a))`));
  ck("monster in front: power -3000", run(`ABX.staticBonus(battle.opp,__f).power===-3000`), run(`ABX.staticBonus(battle.opp,__f)`));
  ck("monster not in front: unchanged", run(`ABX.staticBonus(battle.opp,__s).power===0`));

  // 16. "A card with this card in its soul gets power+3000 and [Penetrate]" (4046)
  run(`fresh(); globalThis.__host=put('plr','center', mk('')); __host.soul.push(4046); globalThis.__other=put('plr','left', mk(''));`);
  ck("4046 soul card boosts its host", run(`ABX.staticBonus(battle.plr,__host).power===3000 && ABX.staticBonus(battle.plr,__host).pen`), run(`ABX.staticBonus(battle.plr,__host)`));
  ck("…but not another monster", run(`ABX.staticBonus(battle.plr,__other).power===0`));

  // 17. attack redirection after a call (2732 / 3225 / 5755)
  ck("'change the target of the attack to it' counters are executable", run(`[2732,3225,5755].every(id=>ABX.get(CARD_MAP.get(id)).abilities.filter(a=>!['keyword','reminder','cost','rule'].includes(a.kind)).every(a=>ABX.isExecutable(a)))`),
    run(`[2732,3225,5755].map(id=>ABX.get(CARD_MAP.get(id)).abilities.filter(a=>!['keyword','reminder','cost','rule'].includes(a.kind)).map(a=>ABX.isExecutable(a)))`));

  // 18. the looked-at card stays pending when it can't be placed (bug found by the sweep)
  run(`fresh(); const f=battle.plr; globalThis.__d0=f.deck.length; globalThis.__g0=f.gauge.length;
    globalThis.__c=mk('[Act] Look at the top three cards of your deck. Put up to one card from among them into the chosen card\\'s soul, and put the rest into your gauge.'); globalThis.__m=put('plr','center',__c);`);
  const tot0 = run(`battle.plr.deck.length+battle.plr.gauge.length+battle.plr.hand.length+battle.plr.drop.length+__m.soul.length`);
  run(`actUse('plr', __m)`); await settle();
  const tot1 = run(`battle.plr.deck.length+battle.plr.gauge.length+battle.plr.hand.length+battle.plr.drop.length+__m.soul.length`);
  ck("no card lost when the chosen host is missing", tot0 === tot1, [tot0, tot1]);

  // 19. "If you do not" (else) still works on its own; "If you do not have" is a real condition
  run(`fresh(); globalThis.__l0=battle.plr.life; globalThis.__c=mk('[Act] If you do not have an item equipped, you gain 2 life.'); globalThis.__m=put('plr','center',__c);`);
  run(`actUse('plr', __m)`); await settle();
  ck("'If you do not have an item equipped' gates the effect (no item -> life)", run(`battle.plr.life===__l0+2`));
  run(`fresh(); put('plr','item', mk('',{type:'Item'})); globalThis.__l0=battle.plr.life; globalThis.__c=mk('[Act] If you do not have an item equipped, you gain 2 life.'); globalThis.__m=put('plr','center',__c);`);
  run(`actUse('plr', __m)`); await settle();
  ck("…and does nothing when an item is equipped", run(`battle.plr.life===__l0`));

  // 20. coverage floor
  const cov = JSON.parse(run(`(function(){ let t=0,e=0; ALL_CARDS.forEach(c=>ABX.get(c).abilities.forEach(a=>{ if(['keyword','reminder','cost','rule'].includes(a.kind)) return; t++; if(ABX.isExecutable(a)) e++; })); return JSON.stringify({t,e}); })()`));
  ck(`coverage ${cov.e}/${cov.t} (>= 5,050)`, cov.e >= 5050, cov);

  console.log(`\npass ${pass} fail ${fail}`);
})();
