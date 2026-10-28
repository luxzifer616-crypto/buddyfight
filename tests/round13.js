// Round 13: families of unread text (abilities_r13.js), checked with real cards.
const { createEnv } = require("./headless.js");
const env = createEnv();
const run = (c) => env.run("{" + c + "\n}");
const val = (c) => env.run(c);
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=997000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:card.atk_max||1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,4); f.life=10; f.hand=[]; f.setSpells=[]; f.drop=[]; f.isBot=false; }); };
globalThis.act=function(side,text){ const c=mk(text,{type:'Spell'}); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); return ABX.runAbility(side,c,ab,null); };
globalThis.exec=function(id,pred){ return ABX.get(CARD_MAP.get(id)).abilities.some(a=>(!pred||pred(a)) && ABX.isExecutable(a)); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 15; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };

(async () => {
  // --- conditions: "A, B, and C"
  ck("220 Impact rule 'if your opponent has 3 life or less, you have an Adventurer…, and you have a Weapon equipped' is read", val(`ABX.get(CARD_MAP.get(220)).abilities.some(a=>a.kind==='rule' && !(a.unparsed||[]).length && (a.conds||[]).some(c=>c.t==='and'))`));
  ck("2859 rule with '(Link attacks count as one attack!)' reminder is read", val(`ABX.get(CARD_MAP.get(2859)).abilities.some(a=>a.kind==='rule' && !(a.unparsed||[]).length)`));

  // --- size wording
  ck("1596 'the size of this card is reduced by 3 on the field' runs", val(`exec(1596, a=>a.kind==='static' && a.steps.some(s=>s.kind==='sizeMod'))`));

  // --- call cost reduction
  run(`fresh(); put('plr','left',CARD_MAP.get(3996)); globalThis.__neo=mk('',{attrs:['Neodragon'],cost:'[Call Cost] [Pay 2 gauge]',skill:'[Call Cost] [Pay 2 gauge]'}); globalThis.__oth=mk('',{cost:'[Call Cost] [Pay 2 gauge]',skill:'[Call Cost] [Pay 2 gauge]'});`);
  ck("3996: «Neodragon» from the hand costs 1 gauge less", val(`parseCardCost(__neo.cost,__neo.skill,battle.plr,__neo).gauge===1`), val(`parseCardCost(__neo.cost,__neo.skill,battle.plr,__neo)`));
  ck("3996: other monsters cost the same", val(`parseCardCost(__oth.cost,__oth.skill,battle.plr,__oth).gauge===2`));
  ck("3996: calls from the drop zone are not reduced ('from your hand')", val(`(function(){ ABX.callArea='drop zone'; const g=parseCardCost(__neo.cost,__neo.skill,battle.plr,__neo).gauge; ABX.callArea=null; return g===2; })()`));
  ck("3996: the opponent's cost is not reduced", val(`parseCardCost(__neo.cost,__neo.skill,battle.opp,__neo).gauge===2`));

  // --- damage reduction
  run(`fresh(); put('plr','item',CARD_MAP.get(342));`);
  ck("342: effect damage to you is reduced by 1", val(`(ABX.core.applyDamage('plr',3,{kind:'effect'}), battle.plr.life===8)`), val(`battle.plr.life`));
  ck("342: attack damage is not reduced", val(`(ABX.core.applyDamage('plr',3,{kind:'attack'}), battle.plr.life===5)`), val(`battle.plr.life`));
  run(`fresh(); put('plr','item',CARD_MAP.get(1476));`);
  ck("1476: 2 damage stays 2", val(`(ABX.core.applyDamage('plr',2,{kind:'attack'}), battle.plr.life===8)`), val(`battle.plr.life`));
  ck("1476: 3 or greater damage is reduced by 1", val(`(ABX.core.applyDamage('plr',3,{kind:'attack'}), battle.plr.life===6)`), val(`battle.plr.life`));

  // --- call restrictions
  run(`fresh(); put('plr','item',CARD_MAP.get(457)); globalThis.__dk=mk('',{attrs:['DragonKnight'],cost:''}); globalThis.__no=mk('',{cost:''});`);
  ck("457: a non-«Dragon Knight» cannot be called", val(`!evaluateCardConditions(__no,battle.plr,battle.opp).met`));
  ck("457: a «Dragon Knight» can", val(`evaluateCardConditions(__dk,battle.plr,battle.opp).met`), val(`evaluateCardConditions(__dk,battle.plr,battle.opp).reasons`));
  run(`fresh(); put('plr','item',CARD_MAP.get(109)); globalThis.__m=mk('',{cost:''}); battle.plr.hand=[__m.id];`);
  run(`battle.completeMonsterCall('plr','center',0,false);`);
  ck("109: calling to the center is refused", val(`!battle.plr.monsters.center && battle.plr.hand.length===1`));
  run(`battle.completeMonsterCall('plr','left',0,false);`); await settle();
  ck("109: calling to the left works", val(`!!battle.plr.monsters.left && battle.plr.monsters.left.card.id===__m.id`));

  // --- link restriction
  run(`fresh(); battle.phase='attack'; put('opp','center',CARD_MAP.get(146)); globalThis.__a1=put('plr','left',mk('')); globalThis.__a2=put('plr','right',mk(''));`);
  run(`battle.initiateAttackWithDefenseCheck('plr',['left','right'],'center');`); await settle();
  ck("146: you cannot link attack its owner", val(`__a1.attacksLeft===1 && __a2.attacksLeft===1`));

  // --- opponent's cards leaving the field by your effects
  run(`fresh(); put('plr','left',CARD_MAP.get(4456)); put('opp','left',mk('')); put('opp','right',mk('')); battle._destroyByAttack=false; battle.destroyMonster('opp','left');`); await settle();
  ck("4456: an opponent's monster destroyed by your card effects -> you gain 1 life", val(`battle.plr.life===11`), val(`battle.plr.life`));
  run(`battle._destroyByAttack=true; battle.destroyMonster('opp','right'); battle._destroyByAttack=false;`); await settle();
  ck("4456: destroyed by an attack -> nothing", val(`battle.plr.life===11`), val(`battle.plr.life`));

  // --- opponent dealt damage by your card's effect
  run(`fresh(); put('plr','left',CARD_MAP.get(1403)); globalThis.__h0=battle.plr.hand.length; act('plr','[Act] Deal 1 damage to your opponent.');`); await settle();
  ck("1403: opponent dealt damage by your effect -> draw a card", val(`battle.opp.life===9 && battle.plr.hand.length===__h0+1`), val(`[battle.opp.life, battle.plr.hand.length-__h0]`));

  // --- When this card is [Set]
  run(`fresh(); put('plr','left',mk('',{attrs:['BlackDragon']})); battle.resolveCastSpell('plr',CARD_MAP.get(6352),6352);`); await settle();
  ck("6352: When this card is [Set], with another «Black Dragon» -> gain 2 life", val(`battle.plr.life===12`), val(`battle.plr.life`));

  // --- At the end of the battle that a «Prism Dragon» on your field was attacked
  run(`fresh(); battle.activeSide='opp'; put('plr','item',CARD_MAP.get(2891)); globalThis.__pd=put('plr','center',mk('',{attrs:['PrismDragon']})); globalThis.__at=put('opp','left',mk(''));
       ABX.curBattle={turn:battle.turnCount,attSide:'opp',defSide:'plr',attUnits:[__at],defUnit:__pd,targetPos:'center'}; ABX.fireBattleEnd('opp',[{unit:__at,zone:'left'}]);`); await settle();
  ck("2891: end of the battle a «Prism Dragon» was attacked -> deal 1 damage", val(`battle.opp.life===9`), val(`battle.opp.life`));

  // --- you win the game
  run(`fresh(); act('plr','[Act] You win the game.');`); await settle();
  ck("'you win the game' ends the match with your win", val(`battle.matchOver===true && battle.opp.life>0`));

  // --- life lock
  run(`fresh(); battle.opp.life=3; ABX.core.st(battle.opp).lifeFloor=battle.turnCount; ABX.fireSpell('plr',CARD_MAP.get(2859));`); await settle();
  ck("2859: its lethal damage can't be saved by 'life becomes 1'", val(`battle.matchOver===true`), val(`[battle.opp.life, battle.matchOver]`));
  run(`fresh(); battle.opp.life=3; ABX.core.st(battle.opp).lifeFloor=battle.turnCount; act('plr','[Act] Deal 5 damage to your opponent.');`); await settle();
  ck("…a normal damage spell is still saved (life 1)", val(`battle.opp.life===1 && !battle.matchOver`), val(`[battle.opp.life, battle.matchOver]`));

  // --- hand-drop guard
  run(`fresh(); battle.opp.isBot=true; battle.opp.hand=[4780, CARD_MAP.get(4780)?1:1]; globalThis.__oh=battle.opp.hand.length; act('plr','[Act] Your opponent chooses a card from their hand and discards it.');`); await settle();
  ck("4780: revealed from the hand, pay 1 life -> nothing is dropped", val(`battle.opp.hand.length===__oh && battle.opp.life===9`), val(`[battle.opp.hand.length, battle.opp.life]`));

  // --- put from the soul into the drop zone
  run(`fresh(); battle.activeSide='opp'; globalThis.__host=put('plr','center',mk('',{attrs:['Neodragon']})); __host.soul=[3021]; globalThis.__g0=battle.plr.gauge.length; battle.destroyMonster('plr','center');`); await settle();
  ck("3021: put from a «Neodragon»'s soul into the drop zone -> 2 cards into the gauge", val(`battle.plr.gauge.length===__g0+2`), val(`battle.plr.gauge.length-__g0`));

  // --- opponent cannot call monsters by card effects
  run(`fresh(); put('opp','item',CARD_MAP.get(5108)); globalThis.__cid=mk('',{size:0}).id; battle.plr.drop=[__cid]; act('plr','[Act] Call a monster from your drop zone.');`); await settle();
  ck("5108: your effect call is blocked", val(`!['left','center','right'].some(p=>battle.plr.monsters[p])`));

  // --- only one [Set]
  run(`fresh(); battle.plr.setSpells=[CARD_MAP.get(2215)];`);
  ck("2215: a second 'Transportation Air Lane' can't be [Set]", val(`!evaluateCardConditions(CARD_MAP.get(2215),battle.plr,battle.opp).met`));

  // --- trigger wordings
  ck("1408: 'attacks and destroys your opponent's monster, or deals damage' runs", val(`exec(1408, a=>a.trigger && a.trigger.event==='attackOutcome')`));
  ck("display text keeps the printed wording", val(`ABX.get(CARD_MAP.get(1596)).abilities.some(a=>/size of this card is reduced by 3 on the field/.test(a.raw||''))`));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
