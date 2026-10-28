// Round 12: field [Counter] [Act] is a player choice in the defense window (Time General, Zeitwelg 6046),
// monsters/items are no longer played from the hand like [Counter] spells, flat vs per-[Reversal] bonuses.
const { createEnv } = require("./headless.js");
const env = createEnv();
const run = (c) => env.run("{" + c + "\n}");
const val = (c) => env.run(c);
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=996000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:card.atk_max||1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='opp'; battle.phase='attack'; battle.turnCount=4;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,4); f.life=10; f.hand=[]; f.setSpells=[]; f.drop=[]; f.isBot=false; f.godclock=f.godclock||{}; f.godclock.reversalCount=0; }); };
globalThis.setup=function(){ fresh(); globalThis.__zw=put('plr','left',CARD_MAP.get(6046)); globalThis.__dg=put('plr','center',CARD_MAP.get(5955)); globalThis.__nd=put('plr','right',mk('',{attrs:['TimeDragon']}));
  globalThis.__att=put('opp','center',mk('',{power:99000,crit:3})); };
globalThis.zwOpts=function(pos){ return battle.getAvailableDefenseCards('plr', false, pos, [__att]).filter(o=>o.fieldKey && o.card.id===6046); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 15; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };

(async () => {
  // --- 1. Zeitwelg: field [Counter] [Act] offered as a choice
  run(`setup();`);
  ck("Zeitwelg's [Counter] [Act] is executable", val(`ABX.get(CARD_MAP.get(6046)).abilities.some(a=>a.kind==='act' && ABX.isExecutable(a) && ABX.isDefenseAct(a))`));
  ck("offered in the defense window when a «Dragod» is attacked", val(`zwOpts('center').length===1`), val(`zwOpts('center').length`));
  ck("not offered when a non-«Dragod» is attacked", val(`zwOpts('right').length===0`));
  ck("not offered when you are attacked directly", val(`zwOpts('fighter').length===0`));
  run(`battle.plr.gauge=[];`);
  ck("not offered without 1 gauge", val(`zwOpts('center').length===0`));

  // --- 2. human defender: NOT automatic, player picks it
  run(`setup(); globalThis.__g0=battle.plr.gauge.length; battle.initiateAttackWithDefenseCheck('opp',['center'],'center');`); await settle();
  ck("human: the attack waits for the defender's choice (not auto-used)", val(`!!battle.pendingDefenseContext && battle.plr.gauge.length===__g0 && battle.plr.monsters.center===__dg`));
  run(`battle.resolveDefenseChoice({ fieldKey: zwOpts("center")[0].fieldKey });`); await settle();
  ck("using it pays 1 gauge and ends the battle (the «Dragod» survives, no damage)", val(`battle.plr.gauge.length===__g0-1 && battle.plr.monsters.center===__dg && battle.plr.life===10 && __att.attacksLeft===0`), val(`[battle.plr.gauge.length, !!battle.plr.monsters.center, battle.plr.life, __att.attacksLeft]`));
  run(`setup(); globalThis.__g0=battle.plr.gauge.length; battle.initiateAttackWithDefenseCheck('opp',['center'],'center');`); await settle();
  run(`battle.resolveDefenseChoice(null);`); await settle();
  ck("human: choosing nothing lets the attack go through (no gauge paid)", val(`battle.plr.gauge.length===__g0 && battle.plr.monsters.center!==__dg`));

  // --- 3. bot defender: uses it only when it saves the monster
  run(`setup(); battle.plr.isBot=true; globalThis.__g0=battle.plr.gauge.length; battle.initiateAttackWithDefenseCheck('opp',['center'],'center');`); await settle();
  ck("bot: ends the battle when its «Dragod» would be destroyed", val(`battle.plr.monsters.center===__dg && battle.plr.gauge.length===__g0-1`));
  run(`setup(); battle.plr.isBot=true; __att.card.power=1000; globalThis.__g0=battle.plr.gauge.length; battle.initiateAttackWithDefenseCheck('opp',['center'],'center');`); await settle();
  ck("bot: keeps the gauge when the attack can't destroy it", val(`battle.plr.gauge.length===__g0`));

  // --- 4. hand: monsters / items are not [Counter] spells unless the [Counter] line is a hand ability
  ck("Zeitwelg in the hand is not a hand [Counter] card", val(`classifyDefensiveCounterCard(CARD_MAP.get(6046))===null`));
  ck("field-only [Counter] monsters/items are not hand cards (75, 942, 5108, 6093)", val(`[75,942,5108,6093].every(id=>classifyDefensiveCounterCard(CARD_MAP.get(id))===null)`));
  ck("real hand [Counter] monsters stay (2595 'discard this card from your hand', 5878 'drop this hand card')", val(`[2595,5878].every(id=>!!classifyDefensiveCounterCard(CARD_MAP.get(id)))`));
  ck("[Counter] spells unchanged (Kronos Amena 6029)", val(`!!classifyDefensiveCounterCard(CARD_MAP.get(6029))`));

  // --- 5. Zeitwelg buff: flat +10000 / +1 at 2+ [Reversal], not doubled, not growing
  const st = (rev, u) => val(`(function(){ battle.plr.godclock.reversalCount=${rev}; const s=getUnitEffectiveCombatStats(battle.plr, ${u}); return [s.power,s.crit]; })()`);
  run(`setup();`);
  ck("Time Dragon at 1 [Reversal]: no bonus", JSON.stringify(st(1, "__nd")) === "[5000,1]", st(1, "__nd"));
  ck("Time Dragon at 2 [Reversal]: +10000 / +1 (was +20000 / +2)", JSON.stringify(st(2, "__nd")) === "[15000,2]", st(2, "__nd"));
  ck("Time Dragon at 5 [Reversal]: still +10000 / +1", JSON.stringify(st(5, "__nd")) === "[15000,2]", st(5, "__nd"));
  ck("Zeitwelg itself at 3 [Reversal]: 17000 / 3", JSON.stringify(st(3, "__zw")) === "[17000,3]", st(3, "__zw"));

  // --- 6. "for each time your flags [Reversal]" from a soul (6142 / 6227) and on itself (6055)
  run(`setup(); __zw.soul=[6227];`);
  ck("6227 in a «Time Dragon»'s soul: [Penetrate] and power+5000 per [Reversal]", val(`(function(){ battle.plr.godclock.reversalCount=3; const s=getUnitEffectiveCombatStats(battle.plr,__zw); return s.power===32000 && s.pen; })()`));
  run(`setup(); globalThis.__ms=put('plr','right',CARD_MAP.get(6142));`);
  ck("6142 on the field (not in a soul) gives itself nothing", val(`(function(){ battle.plr.godclock.reversalCount=3; const s=getUnitEffectiveCombatStats(battle.plr,__ms); return s.defense===CARD_MAP.get(6142).defense; })()`));
  run(`fresh(); globalThis.__val=put('plr','right',CARD_MAP.get(6055));`);
  ck("6055 Val: +2000/+2000 per [Reversal], counted once", val(`(function(){ battle.plr.godclock.reversalCount=3; const s=getUnitEffectiveCombatStats(battle.plr,__val); return s.power===CARD_MAP.get(6055).power+6000 && s.defense===CARD_MAP.get(6055).defense+6000; })()`));

  // --- 7. any field [Counter] [Act] is offered while being attacked (not only "nullify the attack")
  run(`fresh(); globalThis.__df=put('plr','center',CARD_MAP.get(3179)); globalThis.__att=put('opp','center',mk('',{power:99000}));`);
  ck("3179 'pay 1 gauge: all cards on your field get defense+1000' is offered when attacked", val(`battle.getAvailableDefenseCards('plr',false,'center',[__att]).some(o=>o.fieldKey && o.card.id===3179)`));
  run(`fresh(); globalThis.__k=put('plr','left',CARD_MAP.get(1189)); globalThis.__att=put('opp','center',mk('',{power:3000})); battle.plr.isBot=false;
       battle.pendingDefenseContext={attSide:'opp',attackerZones:['center'],targetPos:'fighter',defSide:'plr'};
       battle.resolveDefenseChoice({ fieldKey: battle.getAvailableDefenseCards('plr',false,'fighter',[__att]).find(o=>o.fieldKey && o.card.id===1189).fieldKey });`); await settle();
  ck("1189 'pay 1 life: destroy a monster with 4000 or less power' destroys the attacker, no damage taken", val(`!battle.opp.monsters.center && battle.plr.life===9`), val(`[!!battle.opp.monsters.center, battle.plr.life]`));
  run(`fresh(); globalThis.__w=put('plr','item',mk('',{type:'Item',attrs:['Weapon']})); __w.soul=[1683]; __w.rested=true; globalThis.__att=put('opp','center',mk(''));`);
  ck("1683 in a Weapon's soul: '[Stand] your Weapon' is offered from the soul", val(`battle.getAvailableDefenseCards('plr',false,'fighter',[__att]).some(o=>o.fieldKey && o.card.id===1683 && o.fieldKey.startsWith('soul:'))`));
  run(`fresh(); battle.activeSide='plr'; globalThis.__df=put('plr','center',CARD_MAP.get(458)); globalThis.__att=put('opp','center',mk(''));`);
  ck("bots don't spend gauge on a non-stopping [Counter] [Act] (458 power+2000)", val(`ABX.botFieldCounterPick('plr',{attUnits:[__att],targetPos:'center'}, battle.getAvailableDefenseCards('plr',false,'center',[__att]).filter(o=>o.fieldKey).map(o=>({key:o.fieldKey,nullifies:o.info.nullifies})))===null`));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
