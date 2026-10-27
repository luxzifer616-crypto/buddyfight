// Round 7: "cannot be nullified / cannot be reduced", "stat cannot be reduced", nullify a spell / impact / call (response window),
// size 0 / size of others reduced, extra attack phase / extra turn / end phase, life-gain / equip / soul-empty triggers,
// "nullify the attacking card's [Penetrate]", "nullify all abilities of the monster in battle with this card".
const { createEnv } = require("./headless.js");
const env = createEnv(); const { flush } = env;
const run = (c) => env.run("{" + c + "\n}");
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=970000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.spell=function(side,card){ return ABX.runAbility(side, card, ABX.get(card).abilities.find(a=>a.kind==='spell'), null); };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,5); f.life=10; f.hand=[]; f.setSpells=[]; }); battle.opp.isBot=true; };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 10; i++) { await flush(); await new Promise(r => setTimeout(r, 5)); } };

(async () => {
  // 1. unreducible spell damage goes through a shield
  run(`fresh(); ABX.core.st(battle.opp).shields.push({mode:'turn',reduceBy:3,turn:battle.turnCount}); globalThis.__c=CARD_MAP.get(4278);`);
  ck("4278 (cannot be nullified, damage cannot be reduced) is executable", run(`ABX.ownsSpell(__c)`));
  run(`spell('plr',__c)`); await settle();
  ck("…its 5 damage ignores a 3-reduction shield", run(`battle.opp.life===5`), run(`battle.opp.life`));
  run(`fresh(); ABX.core.st(battle.opp).shields.push({mode:'turn',reduceBy:3,turn:battle.turnCount}); spell('plr', mk('', {type:'Spell', skill:'Deal 5 damage to your opponent.'}))`); await settle();
  ck("a normal 5-damage spell is still reduced", run(`battle.opp.life===8`), run(`battle.opp.life`));

  // 2. response window: the bot nullifies a spell with a [Counter] from hand
  run(`fresh(); globalThis.__nul=CARD_MAP.get(7); battle.opp.hand=[7]; globalThis.__res=null; ABX.castWindow('plr', mk('',{type:'Spell',skill:'Draw a card.'}), 'spell').then(v=>__res=v);`); await settle();
  ck("bot nullifies the spell with card 7", run(`__res===true && battle.opp.drop.includes(7) && !battle.opp.hand.includes(7)`), run(`[__res, battle.opp.hand]`));
  run(`fresh(); battle.opp.hand=[7]; globalThis.__res=null; ABX.castWindow('plr', CARD_MAP.get(4278), 'spell').then(v=>__res=v);`); await settle();
  ck("…but not an unnullifiable spell", run(`__res===false && battle.opp.hand.includes(7)`), run(`__res`));
  run(`fresh(); battle.opp.hand=[7]; globalThis.__res=null; ABX.castWindow('plr', mk('',{type:'Monster'}), 'call').then(v=>__res=v);`); await settle();
  ck("a spell-nullifier is not offered against a call", run(`__res===false`));
  run(`fresh(); battle.opp.hand=[9]; globalThis.__res=null; ABX.castWindow('plr', mk('',{type:'Monster'}), 'call').then(v=>__res=v);`); await settle();
  ck("'Nullify the call' (9) answers a call", run(`__res===true`), run(`[__res, CARD_MAP.get(9).skill]`));

  // 3. size 0 and size of others reduced
  run(`fresh(); globalThis.__u=put('plr','left', mk('',{size:2})); __u.abxSize0=true;`);
  ck("size-0 unit counts as size 0", run(`battle.getCurrentSizeUsed(battle.plr)===0`), run(`battle.getCurrentSizeUsed(battle.plr)`));
  run(`fresh(); put('plr','left', CARD_MAP.get(3126)); globalThis.__ct=mk('',{size:1,attrs:['Crew Trooper']}); put('plr','right', __ct);`);
  ck("3126: originally size 1 «Crew Trooper» is size 0", run(`getEffectiveCardSize(battle.plr, __ct, battle.plr.monsters.right)===0`), run(`getEffectiveCardSize(battle.plr, __ct, battle.plr.monsters.right)`));

  // 4. extra attack phase / extra turn
  run(`fresh(); battle.phase='attack'; globalThis.__a=put('plr','left', mk('')); __a.attacksLeft=0; spell('plr', CARD_MAP.get(2190));`); await settle();
  run(`battle.advancePhase();`);
  ck("'another attack phase': stays in the attack phase once", run(`battle.phase==='attack'`), run(`battle.phase`));
  run(`battle.advancePhase();`);
  ck("…then goes to the final phase", run(`battle.phase==='final'`));
  run(`fresh(); battle.plr.abxExtraTurn=1; battle.startTurn=function(s){ globalThis.__next=s; }; battle.endTurn();`);
  ck("'another turn': the same player goes again", run(`__next==='plr'`), run(`__next`));

  // 5. triggers: life gain, equip, soul empty
  run(`fresh(); globalThis.__l=put('plr','center', CARD_MAP.get(3834)); ABX.watchFighters(); battle.plr.life+=2;`); await settle();
  ck("'when you gain life' (3834) fires", run(`__l.tempPower===2000 && __l.tempCrit===1`), run(`[__l.tempPower,__l.tempCrit]`));
  run(`fresh(); globalThis.__eq=CARD_MAP.get(455); battle.plr.item={card:__eq,rested:false,attacksLeft:1,soul:[]}; ABX.fireEquipped('plr',__eq,battle.plr.item);`); await settle();
  ck("'when you equip this card, gain 3 life' (455)", run(`battle.plr.life===13`), run(`battle.plr.life`));
  run(`fresh(); globalThis.__s=put('plr','center', CARD_MAP.get(356)); __s.soul=[1]; ABX.watchFighters(); __s.soul=[]; globalThis.__h0=battle.plr.hand.length; ABX.watchFighters();`); await settle();
  ck("'soul becomes 0, draw a card' (356)", run(`battle.plr.hand.length===__h0+1`));

  // 6. nullify [Penetrate], stat lock, unnullifiable attack
  run(`fresh(); globalThis.__p=put('opp','center', mk('',{pen:true})); ABX.runAbility('plr', CARD_MAP.get(247), ABX.get(CARD_MAP.get(247)).abilities.find(a=>a.kind==='triggered'), null, {event:{attUnits:[__p]}});`); await settle();
  ck("attacker's [Penetrate] is nullified", run(`getUnitEffectiveCombatStats(battle.opp,__p).pen===false`));
  run(`fresh(); put('plr','left', CARD_MAP.get(5264)); globalThis.__v=put('plr','center', mk('',{attrs:['Dangerous Veggies']})); ABX.runAbility('opp', mk('[Act] All monsters on your opponent\\'s field get critical-1.'), {kind:'act',steps:[{op:'boost',np:{raw:'all monsters on your opponent\\'s field',qty:{all:true,n:99},filter:{types:['monster']},zone:{owner:'opp',area:'field'}},mods:{power:0,defense:0,critical:-1,kws:[]}}]}, null);`); await settle();
  ck("'critical cannot be reduced' (5264) keeps critical", run(`(__v.tempCrit||0)===0`), run(`__v.tempCrit`));
  run(`fresh(); globalThis.__x=put('plr','center', CARD_MAP.get(1172)); __x.abxUnnull={turn:battle.turnCount,cond:'alone'};`);
  ck("'attack cannot be nullified if attacking alone' (for this turn)", run(`ABX.attackUnnullifiable({attUnits:[__x]}) && !ABX.attackUnnullifiable({attUnits:[__x, put('plr','left',mk(''))]})`));

  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
