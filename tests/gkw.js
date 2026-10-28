// [G.EVO], [G.BOOST] (ability tags read like keywords) and [Release Condition!] (Dragon Force items).
const { createEnv } = require("./headless.js");
const env = createEnv();
const run = (c) => env.run("{" + c + "\n}");
const val = (c) => env.run(c);
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=996000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1,kw:[]},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:card.atk_max||1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,6); f.life=10; f.hand=[]; f.setSpells=[]; f.drop=[]; f.abxGBoostUsed=null; }); };
globalThis.ab=function(id,re){ return ABX.get(CARD_MAP.get(id)).abilities.find(a=>new RegExp(re,'i').test(a.raw||'')); };
globalThis.cond=function(id){ return evaluateCardConditions(CARD_MAP.get(id), battle.plr, battle.opp); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 15; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };

(async () => {
  /* ---------- 1. tags read like keywords ---------- */
  ck("5128 has [G.BOOST-Base-] (printed tag)", val(`ABX.kwOfExtra(CARD_MAP.get(5128),'g.boost-base-') && ABX.kwOfExtra(CARD_MAP.get(5128),'g.boost')`));
  ck("5144 only mentions [G.BOOST] -> does not have it", val(`ABX.kwOfExtra(CARD_MAP.get(5144),'g.boost')===false`));
  ck("6200 [G.BOOST-Ex-] also counts as Base / Craft / Will", val(`['g.boost-ex-','g.boost-base-','g.boost-craft-','g.boost-will-'].every(k=>ABX.kwOfExtra(CARD_MAP.get(6200),k))`));
  ck("4311 has [G.EVO]; 4957 D-[G.EVO] counts as [G.EVO]", val(`ABX.kwOfExtra(CARD_MAP.get(4311),'g.evo') && ABX.kwOfExtra(CARD_MAP.get(4957),'g.evo') && ABX.kwOfExtra(CARD_MAP.get(4957),'d-g.evo')`));
  ck("4281 (mentions 'entered by [G.EVO]') does not have [G.EVO]", val(`ABX.kwOfExtra(CARD_MAP.get(4281),'g.evo')===false`));
  ck("keyword chips: 5128 'G.BOOST-Base-', 5144 none, 4957 'D-G.EVO', 4281 none", val(`CARD_MAP.get(5128).kw.includes('G.BOOST-Base-') && !CARD_MAP.get(5144).kw.some(k=>/G\\.BOOST/.test(k)) && CARD_MAP.get(4957).kw.includes('D-G.EVO') && !CARD_MAP.get(4281).kw.some(k=>/G\\.EVO/.test(k))`), val(`[CARD_MAP.get(5128).kw, CARD_MAP.get(5144).kw, CARD_MAP.get(4957).kw, CARD_MAP.get(4281).kw]`));
  ck("6200 / 6064 [G.BOOST-Ex-] [Act] are [Act] abilities now", val(`ab(6200,'G\\\\.BOOST-Ex').kind==='act' && ABX.isExecutable(ab(6200,'G\\\\.BOOST-Ex')) && ab(6064,'G\\\\.BOOST-Ex').kind==='act' && ABX.isExecutable(ab(6064,'G\\\\.BOOST-Ex'))`));

  /* ---------- 2. "a card with [G.BOOST] is on your field" ---------- */
  run(`fresh(); globalThis.__g=put('plr','left',CARD_MAP.get(5144)); globalThis.__h=battle.plr.hand.length;`);
  run(`ABX.fireEnter('plr', CARD_MAP.get(5144), __g)`); await settle();
  ck("5144 alone: no card with [G.BOOST] -> no draw", val(`battle.plr.hand.length===__h`), val(`battle.plr.hand.length-__h`));
  run(`put('plr','center',CARD_MAP.get(5128)); globalThis.__h=battle.plr.hand.length;`);
  run(`ABX.fireEnter('plr', CARD_MAP.get(5144), __g)`); await settle();
  ck("5144 with 5128 on the field -> draws", val(`battle.plr.hand.length===__h+1`), val(`battle.plr.hand.length-__h`));

  /* ---------- 3. cast rules ---------- */
  run(`fresh();`);
  ck("5140 Garknight Strash: blocked without a [G.BOOST] card", val(`!cond(5140).met && cond(5140).reasons.some(r=>/G\\.BOOST/.test(r))`), val(`cond(5140)`));
  run(`put('plr','center',CARD_MAP.get(5144));`);
  ck("5140: a card that only mentions [G.BOOST] does not unlock it", val(`!cond(5140).met`));
  run(`put('plr','left',CARD_MAP.get(5128));`);
  ck("5140: unlocked with 5128 on the field", val(`cond(5140).met`), val(`cond(5140)`));
  ck("5141: 'you used [G.BOOST-Base-]' blocked before using it", val(`!cond(5141).met`));
  run(`battle.phase='attack';`); await settle();
  ck("5128 G.BOOST at the start of the attack phase -> marked as used (Base)", val(`ABX.gboostUsed('plr','base') && !ABX.gboostUsed('plr','will')`), val(`battle.plr.abxGBoostUsed`));
  ck("5141 unlocked after [G.BOOST-Base-] was used; 5580 (Craft) still blocked", val(`cond(5141).met && !cond(5580).met`), val(`[cond(5141), cond(5580)]`));
  run(`battle.opp.life=5; battle.plr.monsters.center=null; battle.plr.monsters.left=null;`);
  ck("5129: 'no monsters on each player's center' + used [G.BOOST] + opp life 5 -> castable", val(`cond(5129).met`), val(`cond(5129)`));
  run(`put('opp','center',mk(''));`);
  ck("5129: blocked when your opponent has a center monster", val(`!cond(5129).met`));
  run(`battle.turnCount=4;`);
  ck("'used [G.BOOST]' is for this turn only", val(`!ABX.gboostUsed('plr')`));

  /* ---------- 4. [G.EVO] ---------- */
  run(`fresh(); globalThis.__base=put('plr','center',CARD_MAP.get(4311)); battle.plr.hand=[4283]; globalThis.__l0=battle.plr.life; globalThis.__h0=battle.plr.hand.length;`);
  run(`ABX.runAbility('plr', CARD_MAP.get(4280), ab(4280,'G\\\\.EVO'), null)`); await settle();
  ck("4280 [G.EVO] spell: 'Sonic Mode' called on top of the «Dragod»", val(`battle.plr.monsters.center && battle.plr.monsters.center.card.id===4283 && battle.plr.monsters.center.soul.includes(4311)`), val(`battle.plr.monsters.center && battle.plr.monsters.center.card.id`));
  ck("…it 'entered by [G.EVO]'", val(`!!battle.plr.monsters.center.abxGEvo`));
  ck("4283 enter: gain 2 life, then (G.EVO) draw two", val(`battle.plr.life===__l0+2 && battle.plr.hand.length===__h0-1+2`), val(`[battle.plr.life-__l0, battle.plr.hand.length-__h0]`));
  run(`fresh(); battle.plr.hand=[4283]; globalThis.__l0=battle.plr.life;`);
  run(`battle.completeMonsterCall('plr','center',0,false,true);`); await settle();
  ck("4283 called normally: gains 2 life, no G.EVO draw", val(`battle.plr.life===__l0+2 && battle.plr.hand.length===0 && !battle.plr.monsters.center.abxGEvo`), val(`[battle.plr.life-__l0, battle.plr.hand.length]`));
  run(`fresh(); battle.plr.hand=[5019];`);
  run(`battle.completeMonsterCall('plr','center',0,false,true);`); await settle();
  ck("5019 'enters the field by [G.EVO]': nothing on a normal call", val(`!battle.plr.monsters.center.tempQA`));
  run(`fresh(); put('plr','center',CARD_MAP.get(4311)); battle.plr.hand=[5019]; globalThis.__dren=put('plr','left',CARD_MAP.get(4954));`);
  run(`ABX.runAbility('plr', CARD_MAP.get(4280), ab(4280,'G\\\\.EVO'), null)`); await settle();
  ck("5019 called by [G.EVO] -> [Quadruple Attack]", val(`battle.plr.monsters.center.card.id===5019 && !!battle.plr.monsters.center.tempQA`), val(`[battle.plr.monsters.center.card.id, battle.plr.monsters.center.tempQA]`));
  ck("4954 Dren Gardra: 'a monster enters your field by [G.EVO]' -> [Penetrate] and [Double Attack]", val(`!!__dren.tempPen && !!__dren.tempDA`), val(`[__dren.tempPen, __dren.tempDA, __dren.tempCrit]`));
  // soul with [G.EVO]
  run(`fresh(); globalThis.__wd=put('plr','left',CARD_MAP.get(5023)); globalThis.__o=put('plr','right',mk('',{power:5000})); __wd.soul=[1];`);
  globalThis.p0 = val(`getUnitEffectiveCombatStats(battle.plr, __o).power`);
  run(`__wd.soul=[4311];`);
  ck("5023 'has a soul with [G.EVO]' -> all monsters power+5000 (and not without it)", val(`getUnitEffectiveCombatStats(battle.plr, __o).power`) === p0 + 5000, [p0, val(`getUnitEffectiveCombatStats(battle.plr, __o).power`)]);

  /* ---------- 5. [G.BOOST-Ex-] borrows a [G.BOOST]; soul trigger ---------- */
  run(`fresh(); globalThis.__ex=put('plr','center',CARD_MAP.get(6200)); globalThis.__o=put('plr','left',mk('',{power:5000})); battle.plr.drop=[5137];`);
  run(`ABX.useAct('plr', CARD_MAP.get(6200), __ex)`); await settle();
  ck("6200 [G.BOOST-Ex-] [Act]: borrows 5137's [G.BOOST]", val(`__ex.abxGLent && __ex.abxGLent.ids.includes(5137)`), val(`__ex.abxGLent`));
  globalThis.p1 = val(`getUnitEffectiveCombatStats(battle.plr, __o).power`);
  run(`battle.phase='attack';`); await settle();
  ck("…the borrowed [G.BOOST-Base-] runs at the start of the attack phase (power+10000)", val(`getUnitEffectiveCombatStats(battle.plr, __o).power`) === p1 + 10000, [p1, val(`getUnitEffectiveCombatStats(battle.plr, __o).power`)]);
  run(`fresh(); globalThis.__host=put('plr','center',CARD_MAP.get(5128)); __host.soul=[6315]; put('opp','left',mk('')); battle.phase='attack';`); await settle();
  ck("6315 in the soul: 'when the card with this card in its soul uses [G.BOOST]' destroys an opponent's card", val(`!battle.opp.monsters.left`));

  /* ---------- 6. [Release Condition!] ---------- */
  run(`fresh(); battle.plr.hand=[2396]; globalThis.st=function(id){ return getReleaseConditionStatus(CARD_MAP.get(id), battle.plr); };`);
  ck("2396 Dragon Force: 10 life, no «Bal Dragon» -> locked", val(`!st(2396).met && st(2396).reasons.length===2`), val(`st(2396)`));
  run(`battle.plr.life=6;`);
  ck("…6 life but no 'Bal Dragon' monster -> still locked", val(`!st(2396).met && st(2396).reasons.length===1`));
  run(`battle.equipCardFromHand('plr',0,'Equip');`);
  ck("…equipCardFromHand refuses it (stays in hand, no gauge paid)", val(`!battle.plr.item && battle.plr.hand.includes(2396) && battle.plr.gauge.length===6`));
  run(`put('plr','center',CARD_MAP.get(1814));`);
  ck("…6 life + 'Dragon of the Sun, Bal Dragon' -> released", val(`st(2396).met && cond(2396).met`), val(`st(2396)`));
  run(`battle.equipCardFromHand('plr',0,'Equip');`); await settle();
  ck("…and it can be equipped", val(`battle.plr.item && battle.plr.item.card.id===2396`));
  run(`battle.plr.life=10;`);
  ck("once equipped it stays when the condition stops being met", val(`battle.plr.item && battle.plr.item.card.id===2396`));
  run(`fresh(); globalThis.__nd=put('plr','center',mk('',{name:'Jackknife Test',attrs:['Neodragon']})); globalThis.__da=mk('',{attrs:['Dragonarms']}).id;`);
  ck("2672: «Neodragon» Jackknife with 0 «Dragonarms» in soul -> locked", val(`!st(2672).met`));
  run(`__nd.soul=[__da, __da];`);
  ck("2672: …with two «Dragonarms» in its soul -> released", val(`st(2672).met`), val(`st(2672)`));
  run(`fresh(); ['left','center','right'].forEach((p,i)=>put('plr',p,mk('',{name:'LD'+i,attrs:['Dragod','LegendDragon']})));`);
  ck("6136: three different «Dragod» «Legend Dragon» -> released", val(`st(6136).met`));
  run(`battle.plr.monsters.right=null;`);
  ck("6136: only two -> locked", val(`!st(6136).met`));
  run(`fresh(); battle.plr.life=5;`);
  ck("4169: 5 life, nothing equipped -> locked", val(`!st(4169).met`));
  run(`put('plr','item',CARD_MAP.get(456));`);
  ck("4169: with 'Jackknife \"Gold Ritter\"' equipped -> released", val(`st(4169).met`), val(`st(4169)`));
  run(`fresh(); battle.plr.drop=[2396]; ABX.runAbility('plr', mk('[Act] Equip an item from your drop zone by paying its [Equip Cost].'), ABX.get(CARD_MAP.get(__n)).abilities.find(a=>a.kind==='act'), null)`); await settle();
  ck("equip-by-effect also respects the release condition", val(`!battle.plr.item`));
  run(`fresh(); battle.opp.life=5; put('plr','center',mk('',{name:'Jackknife X'}));`);
  ck("5684: needs an item with [Release Condition!] equipped", val(`!cond(5684).met`), val(`cond(5684)`));
  run(`put('plr','item',CARD_MAP.get(2457));`);
  ck("5684: …castable with Dragon Force equipped", val(`cond(5684).met`), val(`cond(5684)`));
  // the bot only equips Dragon Force when it is released
  run(`fresh(); battle.opp.isBot=true; battle.opp.hand=[2396]; battle.opp.life=10;`);
  ck("bot item pick skips a locked Dragon Force", val(`getReleaseConditionStatus(CARD_MAP.get(2396), battle.opp).met===false`));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
