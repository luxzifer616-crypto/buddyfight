// Round 4 ability functions: protection auras, static Move/Soulguard, Quadruple Attack, look + "among them" + "the rest",
// top-of-deck moves, call from hand-or-drop, new attack triggers, unbulleted modal options, soul-host boosts.
const { createEnv } = require("./headless.js");
const env = createEnv(); const { flush } = env;
const run = (c) => env.run("{" + c + "\n}");
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=930000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'R'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.actUse=function(side,u){ return ABX.runAbility(side, u.card, ABX.actAbilities(u.card)[0], u); };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; }); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 8; i++) { await flush(); await new Promise(r => setTimeout(r, 5)); } };

(async () => {
  // 1. team protection aura (static restrict) vs the opponent's ABX destroy and the old keyword destroy
  run(`fresh(); put('plr','left', mk('All «Hero» on your field cannot be destroyed by your opponent\\'s card effects.')); globalThis.__h=put('plr','center', mk('',{attrs:['Hero']})); put('plr','right', mk(''));`);
  ck("aura line is executable", run(`ABX.isExecutable(ABX.get(battle.plr.monsters.left.card).abilities[0])`));
  ck("«Hero» protected from opponent's effect", run(`ABX.core.isProtected(__h,'plr','destroyed',{side:'opp'})`));
  ck("…but not from your own effect", run(`!ABX.core.isProtected(__h,'plr','destroyed',{side:'plr'})`));
  ck("non-«Hero» not protected", run(`!ABX.core.isProtected(battle.plr.monsters.right,'plr','destroyed',{side:'opp'})`));
  ck("old keyword destroy respects the aura", run(`battle.isEffectProtected('plr','center','destroyed','opp') && !battle.isEffectProtected('plr','right','destroyed','opp')`));
  run(`put('opp','center', mk('[Act] Destroy a monster on your opponent\\'s field.'));`);
  run(`actUse('opp', battle.opp.monsters.center)`);
  await settle();
  ck("opponent's ABX destroy can't pick the protected «Hero»", run(`battle.plr.monsters.center===__h`), run(`[!!battle.plr.monsters.center, !!battle.plr.monsters.right]`));

  // 2. soul card aura: Corrosion Prosthesis (4082) in a soul -> monsters can't be put to other areas by opponent
  run(`fresh(); globalThis.__m=put('plr','center', mk('')); __m.soul.push(4082);`);
  ck("soul aura: can't be returned to hand by opponent", run(`ABX.core.isProtected(__m,'plr','returned to hand',{side:'opp'}) && ABX.core.isProtected(__m,'plr','destroyed',{side:'opp'})`));
  run(`__m.soul=[];`);
  ck("soul aura gone when the card leaves the soul", run(`!ABX.core.isProtected(__m,'plr','returned to hand',{side:'opp'})`));

  // 3. static [Move] (Thunder Knights, Main-gauche Dragon 593)
  run(`fresh(); globalThis.__tk=put('plr','left', CARD_MAP.get(593));`);
  ck("static Move off without another Thunder Knights", run(`!ABX.staticBonus(battle.plr,__tk).move`));
  run(`put('plr','right', mk('',{name:'Thunder Knights, Test'}));`);
  ck("static Move on with another Thunder Knights", run(`ABX.staticBonus(battle.plr,__tk).move`));

  // 4. [Quadruple Attack] boost
  run(`fresh(); globalThis.__q=put('plr','center', mk('[Act] For this turn, this card gets [Quadruple Attack].'));`);
  run(`actUse('plr', __q)`); await settle();
  ck("Quadruple Attack: 4 attacks", run(`__q.attacksLeft===4 && getUnitEffectiveCombatStats(battle.plr,__q).qa===true`), run(`__q.attacksLeft`));

  // 5. look -> pick from among them -> rest (card 4080: up to a total of two "Corrosion Code"/"The Chaos Upgrade", rest to drop)
  run(`fresh(); const f=battle.plr; globalThis.__cc=ALL_CARDS.filter(c=>/corrosion code/i.test(c.name)).slice(0,3).map(c=>c.id); globalThis.__other=ALL_CARDS.filter(c=>c.type==='Spell'&&!/corrosion|chaos/i.test(c.name)).slice(0,2).map(c=>c.id);
    f.deck=[__cc[0],__other[0],__cc[1],__other[1],__cc[2], 1,2,3]; globalThis.__h0=f.hand.length; globalThis.__d0=f.drop.length;
    globalThis.__u=put('plr','center', CARD_MAP.get(4080));`);
  run(`ABX.fireEnter('plr', __u.card, 'center')`); await settle();
  ck("look: took 2 matching cards into hand", run(`battle.plr.hand.length===__h0+2 && battle.plr.hand.slice(-2).every(id=>__cc.includes(id))`), run(`[battle.plr.hand.length-__h0]`));
  ck("look: the rest (3) went to the drop zone, deck continues", run(`battle.plr.drop.length===__d0+3 && battle.plr.deck[0]===1`), run(`[battle.plr.drop.length-__d0, battle.plr.deck.slice(0,3)]`));

  // 6. "Put the top two cards from your deck into your gauge" (3475)
  run(`fresh(); globalThis.__g0=battle.plr.gauge.length; globalThis.__top=battle.plr.deck.slice(0,2); globalThis.__c=mk('[Act] Put the top two cards from your deck into your gauge.'); globalThis.__u=put('plr','left',__c);`);
  run(`actUse('plr', __u)`); await settle();
  ck("top two cards -> gauge", run(`battle.plr.gauge.length===__g0+2 && __top.every(id=>battle.plr.gauge.includes(id))`));

  // 7. call from "your hand or drop zone"
  run(`fresh(); globalThis.__hero=mk('',{attrs:['Hero'],name:'DropHero'}); battle.plr.hand=battle.plr.hand.filter(id=>!(CARD_MAP.get(id)||{}).attrs||!CARD_MAP.get(id).attrs.includes('Hero')); battle.plr.drop.push(__hero.id);
    globalThis.__c=mk('[Act] Call a «Hero» from your hand or drop zone without paying its [Call Cost].'); globalThis.__u=put('plr','left',__c);`);
  ck("hand-or-drop call is executable", run(`ABX.actAbilities(__c).length===1`));
  run(`actUse('plr', __u)`); await settle();
  ck("called the «Hero» from the drop zone", run(`['center','right'].some(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id===__hero.id) && !battle.plr.drop.includes(__hero.id)`));

  // 8. "When this card attacks and destroys an opponent's monster" / "...or deals damage"
  run(`fresh(); globalThis.__h0=battle.plr.hand.length; globalThis.__a=put('plr','left', mk('When this card attacks and destroys an opponent\\'s monster, draw a card.'));`);
  ck("attacks-and-destroys trigger executable", run(`ABX.isExecutable(ABX.get(__a.card).abilities[0])`));
  run(`ABX.fireAttackOutcome('plr',[{unit:__a,zone:'left'}],'opp',{destroyedMonster:true})`); await settle();
  ck("attacks-and-destroys fires", run(`battle.plr.hand.length===__h0+1`));
  run(`fresh(); globalThis.__l0=battle.plr.life; globalThis.__a=put('plr','left', mk('When this card attacks and destroys your opponent\\'s monster or deals damage to your opponent, you gain 1 life.'));`);
  run(`ABX.fireAttackOutcome('plr',[{unit:__a,zone:'left'}],'opp',{dealtDamage:true})`); await settle();
  ck("destroys-or-damage fires once on damage", run(`battle.plr.life===__l0+1`), run(`battle.plr.life-__l0`));

  // 9. "When this card is attacked"
  run(`fresh(); globalThis.__l0=battle.plr.life; globalThis.__d=put('plr','center', mk('When this card is attacked, you gain 1 life.')); globalThis.__x=put('opp','left', mk(''));`);
  run(`ABX.fireAttack('opp',[{unit:__x,zone:'left'}],'plr','center')`); await settle();
  ck("is-attacked trigger fires for the target", run(`battle.plr.life===__l0+1`));
  run(`globalThis.__l0=battle.plr.life; ABX.fireAttack('opp',[{unit:__x,zone:'left'}],'plr','fighter')`); await settle();
  ck("…and not when the fighter is attacked", run(`battle.plr.life===__l0`));

  // 10. modal options written without "- " bullets (Emblem of Omni Lords 1399)
  ck("unbulleted modal options parsed and executable", run(`(function(){ const m=ABX.get(CARD_MAP.get(1399)).abilities.find(a=>a.kind==='modal'); return m.options.length===2 && ABX.isExecutable(m); })()`));

  // 11. soul card boosting its host ("The «Neodragon» with this card in its soul gets [Move]", 1099)
  run(`fresh(); globalThis.__nd=put('plr','center', mk('',{attrs:['Neodragon']})); __nd.soul.push(1099); globalThis.__ot=put('plr','left', mk('',{attrs:['Other']})); __ot.soul.push(1099);`);
  ck("soul card gives its «Neodragon» host [Move]", run(`ABX.staticBonus(battle.plr,__nd).move`));
  ck("…but not a non-«Neodragon» host", run(`!ABX.staticBonus(battle.plr,__ot).move`));

  // 12. static Soulguard from an aura keeps the monster
  run(`fresh(); put('plr','left', mk('All «Hero» on your field get [Soulguard].')); globalThis.__s=put('plr','center', mk('',{attrs:['Hero']})); __s.soul.push(1);`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ck("aura [Soulguard] saves the monster", run(`battle.plr.monsters.center===__s && __s.soul.length===0`));

  console.log(`\npass ${pass} fail ${fail}`);
})();
