// Round 9: keywords only when the card really has them / the condition is met; new conditions.
const { createEnv } = require("./headless.js");
const env = createEnv();
const run = (c) => env.run(c);
run(`ABX.fast=true; globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:card.atk_max||1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
 [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.life=10; f.hand=[]; f.setSpells=[]; f.drop=[]; }); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const eff = (id, pos, setup) => JSON.parse(run(`(function(){ fresh(); const c=CARD_MAP.get(${id}); const u=put('plr','${pos || "left"}',c); ${setup || ""}; return JSON.stringify(getUnitEffectiveCombatStats(battle.plr,u)); })()`));

ck("Time Scout, Luke: no Double Attack without Overgod", eff(6205).da === false);
ck("…1 attack per turn", run(`CARD_MAP.get(6205).atk_max`) === 1);
ck("…Double Attack + power with Overgod", (e => e.da && e.power === 12000)(eff(6205, "left", "battle.plr.godclock=battle.plr.godclock||{}; battle.plr.godclock.overgodActive=true;")));
ck("650: Double Attack only with a soul", !eff(650).da && eff(650, "left", "u.soul=[1]").da);
ck("1244: Double Attack on left, not center", eff(1244, "left").da && !eff(1244, "center").da);
ck("2685: printed [Double Attack] kept, [Penetrate] needs 3 souls", (a => a.da && !a.pen)(eff(2685)) && eff(2685, "left", "u.soul=[1,2,3]").pen);
ck("2354: [Penetrate] needs 15 cards in drop", !eff(2354).pen && eff(2354, "left", "battle.plr.drop=Array(15).fill(1)").pen);
ck("5024: no Double Attack without Lost World flag", !eff(5024).da);
ck("printed [Double Attack] monster keeps it", run(`(function(){ const c=CARD_MAP.get(89); return c.da && c.atk_max===2; })()`));
ck("'cannot [Move]' restriction no longer gives [Move] (232)", run(`CARD_MAP.get(232).move`) === false);
ck("'not a link attack' still parses for counters", run(`ABX.isExecutable(ABX.get(CARD_MAP.get(34)).abilities.find(a=>a.kind==='spell'))`));
ck("then-if chain: 1855 line owned or condition read", run(`(function(){ const c=CARD_MAP.get(1855); const l=(c.skill||'').split(/\\n+/).find(x=>/Double Attack/.test(x)); return ABX.ownsStaticLine(c,l) || ABX.lineCond(c,l,battle.plr,null)!==null; })()`));

// ---- blocked groups (conditions / boosts / calls / move / choose / destroy) ----
run(`globalThis.__n=990000; globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
 globalThis.spellRun=function(side,card){ return ABX.runAbility(side, card, ABX.get(card).abilities.find(a=>a.kind==='spell'), null); }; ABX.autoPlay=true;`);
const settle = async () => { for (let i = 0; i < 10; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
const execOf = (id) => run(`ABX.get(CARD_MAP.get(${id})).abilities.filter(a=>!['keyword','reminder','cost','rule'].includes(a.kind)).every(a=>ABX.isExecutable(a))`);
(async () => {
  ck("2357 'destroy … instead': first destroy only when the condition is NOT met", run(`(function(){ const ab=ABX.get(CARD_MAP.get(2357)).abilities.find(a=>a.kind==='spell'); return ABX.isExecutable(ab) && ab.steps[0].cond && ab.steps[0].cond.t==='not'; })()`));
  ck("2586 'either destroy … or this card gets critical+2' is executable", run(`ABX.isExecutable(ABX.get(CARD_MAP.get(2586)).abilities.find(a=>a.trigger))`));
  ck("3178 'if A, and B, …' compound condition is executable", run(`ABX.isExecutable(ABX.get(CARD_MAP.get(3178)).abilities.find(a=>a.trigger))`));
  ck("880 free call when you have 5 life or less", run(`(function(){ fresh(); const c=CARD_MAP.get(880); battle.plr.life=8; const a=parseCardCost(c.cost,c.skill,battle.plr,c).gauge; battle.plr.life=5; const b=parseCardCost(c.cost,c.skill,battle.plr,c).gauge; return (a>0 || !c.cost) && b===0; })()`));
  run(`fresh(); battle.opp.gauge=battle.opp.deck.splice(0,4); spellRun('plr', mk("",{type:"Spell",skill:"Drop up to 3 of your opponent's gauge."}))`); await settle();
  ck("'drop up to 3 of your opponent's gauge'", run(`battle.opp.gauge.length===1`), run(`battle.opp.gauge.length`));
  run(`fresh(); put('opp','left',mk('',{size:1})); put('opp','right',mk('',{size:1})); battle.opp.life=10; spellRun('plr', mk("",{type:"Spell",skill:"Destroy all monsters on your opponent's field, and deal damage to your opponent equal to the number of cards destroyed."}))`); await settle();
  ck("damage equal to the number of cards destroyed", run(`battle.opp.life===8`), run(`battle.opp.life`));
  run(`fresh(); spellRun('plr', mk("",{type:"Spell",skill:"For this turn, the next time your life would become 0, it becomes 1 instead."}))`); await settle();
  run(`battle.plr.life=2; ABX.core.applyDamage('plr', 5, {kind:'effect'});`);
  ck("'next time your life would become 0, it becomes 1'", run(`battle.plr.life===1`), run(`battle.plr.life`));
  run(`fresh(); globalThis.__neo=put('plr','center', mk('',{attrs:['Neodragon']})); __neo.soul=[3883];`);
  ck("3883 soul [Act] is offered on its host", run(`ABX.soulActs('plr', __neo).length===1 && ABX.canUseSoulAct('plr', __neo, CARD_MAP.get(3883), ABX.soulActs('plr', __neo)[0].ab)`));
  run(`ABX.useSoulAct('plr', __neo, CARD_MAP.get(3883), ABX.soulActs('plr', __neo)[0].ab)`); await settle();
  ck("…and calls it from the soul", run(`!__neo.soul.includes(3883) && ['left','right'].some(p=>battle.plr.monsters[p] && battle.plr.monsters[p].card.id===3883)`));
  run(`fresh(); globalThis.__u=put('plr','left', CARD_MAP.get(5956)); battle.plr.drop=battle.plr.deck.splice(0,3);`);
  run(`ABX.runAbility('plr', CARD_MAP.get(5956), ABX.get(CARD_MAP.get(5956)).abilities.find(a=>a.trigger && (a.trigger.event==='turnStart' || a.trigger.event==='phaseStart')), __u)`); await settle();
  ck("5956 'put cards into this card's soul until two cards are in it'", run(`__u.soul.length===2`), run(`__u.soul.length`));
  run(`fresh(); globalThis.__a=put('plr','left',mk('')); globalThis.__b=put('plr','right',mk('')); spellRun('plr', mk("",{type:"Spell",skill:"Swap the «Astrodragon» on your left and right."}))`); await settle();
  ck("swap left and right", run(`battle.plr.monsters.left===__b && battle.plr.monsters.right===__a`));
  run(`fresh(); globalThis.__x=put('plr','left',mk('')); __x.abxNoCounter={turn:battle.turnCount, mode:'alone'};`);
  ck("'opponent cannot [Counter]' when the chosen card attacks alone", run(`ABX.noCounterThisBattle('plr',[__x]) && !ABX.noCounterThisBattle('plr',[__x, mk('')])`));
  run(`(function(){ fresh(); const it=[...CARD_MAP.values()].find(c=>c.type==='Item' && !c.cost); battle.plr.drop=[it.id]; globalThis.__it=it; })()`);
  run(`spellRun('plr', mk("",{type:"Spell",skill:"Equip an item from your drop zone by paying its [Equip Cost]."}))`); await settle();
  ck("equip an item from the drop zone", run(`battle.plr.item && battle.plr.item.card===__it`));
  for (const id of [1957, 4021, 6375, 2142, 3322, 5955]) ck(`card ${id} fully runs in the new engine`, execOf(id));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
