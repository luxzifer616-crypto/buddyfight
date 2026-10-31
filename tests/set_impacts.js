// [Set] Impact cards must stay in the Set zone after casting (never the drop zone) and keep working until their condition is met.
const { createEnv } = require("./headless");
const env = createEnv();
const { run, flush } = env;
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log("  PASS: " + m); } else { failed++; console.error("  FAIL: " + m); } };
const IDS = [290, 297, 1152, 1406, 1541, 3180, 3355, 4243, 6356, 6363, 6414];
const setup = (id, extra) => run(`(function(){
  ABX.fast=true; ABX.autoPlay=true;
  battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const plain=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
  const mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
  const me=battle.plr; me.gauge=me.deck.splice(0,10); me.life=10; me.hand=[${id}]; me.drop=me.deck.splice(0,6);
  me.monsters.center=mk(plain); battle.opp.monsters.center=mk(plain);
  battle.turn='plr'; battle.activeSide='plr'; battle.phase='final'; battle.turnCount=4;
  ${extra || ""}
  return 1;})()`);
(async () => {
  console.log("=== [Set] Impacts stay in the set zone ===");
  for (const id of IDS) {
    setup(id, id === 3180 || id === 3355 ? `me.monsters.left=mk(ALL_CARDS.find(c=>c.type==='Monster'&&(c.attrs||[]).includes('BlackDragon')));` : id === 6414 ? `me.drop=ALL_CARDS.filter(c=>(c.attrs||[]).includes('SuperWarrior')).slice(0,3).map(c=>c.id);` : "");
    run(`battle.castImpactFromHand('plr',0)`); flush(); await wait(5); flush();
    const r = JSON.parse(run(`JSON.stringify({set:battle.plr.setSpells.some(s=>s.id===${id}),drop:battle.plr.drop.includes(${id}),hand:battle.plr.hand.length})`));
    ok(r.set && !r.drop, `#${id} ${run(`CARD_MAP.get(${id}).name`)} -> set zone (set=${r.set} drop=${r.drop} hand=${r.hand})`);
  }
  const put = (id, soulN, extra) => run(`(function(){ABX.fast=true;ABX.autoPlay=true;
    battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
    const mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
    const me=battle.plr, en=battle.opp; me.setSpells.push(Object.assign({},CARD_MAP.get(${id}),{soul:me.deck.splice(0,${soulN})}));
    battle.activeSide='plr';battle.turn='plr';battle.phase='main';battle.turnCount=4; ${extra || ""} return 1;})()`);
  const J = (js) => JSON.parse(run(`JSON.stringify(${js})`));
  const tick = async () => { flush(); await wait(10); flush(); };

  console.log("=== Death Count: soul grows at the end of the OPPONENT's turn, 3 souls -> drop (+ win / opp life 1) ===");
  for (const id of [3180, 3355]) {
    put(id, 0);
    run(`ABX.fireTurnEvent('turnEnd',null,'plr')`); await tick();
    ok(J(`battle.plr.setSpells[0].soul.length`) === 0, `#${id} no soul at the end of your own turn`);
    for (let i = 1; i <= 2; i++) { run(`ABX.fireTurnEvent('turnEnd',null,'opp')`); await tick(); }
    ok(J(`battle.plr.setSpells.length`) === 1 && J(`battle.plr.setSpells[0].soul.length`) === 2, `#${id} stays in the set zone with 2 souls (cards went into its soul, not the drop zone)`);
    run(`ABX.fireTurnEvent('turnEnd',null,'opp')`); await tick();
    const r = J(`{set:battle.plr.setSpells.length,drop:battle.plr.drop.includes(${id}),oppLife:battle.opp.life,over:!!battle.matchOver}`);
    ok(r.set === 0 && r.drop, `#${id} goes to the drop zone once it has 3 souls`);
    if (id === 3180) ok(r.over, "#3180 you win the game"); else ok(r.oppLife === 1 && !r.over, "#3355 opponent's life becomes 1");
  }

  console.log("=== World End: Demon Lord attacks fill the soul, end of attack phase with 5 souls wipes the opponent's field ===");
  put(1541, 0, `const dl=ALL_CARDS.find(c=>c.type==='Monster'&&(c.attrs||[]).includes('DemonLord')); me.monsters.center=mk(dl); en.monsters.center=mk(dl); en.monsters.left=mk(dl); battle.phase='attack';`);
  for (let i = 1; i <= 5; i++) { run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.center,card:battle.plr.monsters.center.card}],'opp','center')`); await tick(); if (i === 4) {
    run(`ABX.fireTurnEvent('phaseEnd','attack','plr')`); await tick();
    ok(J(`battle.plr.setSpells.length`) === 1 && J(`Object.values(battle.opp.monsters).filter(Boolean).length`) === 2, "#1541 with 4 souls the end of the attack phase does nothing"); } }
  ok(J(`battle.plr.setSpells[0].soul.length`) === 5, "#1541 5 Demon Lord attacks -> 5 souls");
  run(`ABX.fireTurnEvent('phaseEnd','attack','plr')`); await tick();
  const w = J(`{set:battle.plr.setSpells.length,drop:battle.plr.drop.includes(1541),oppLife:battle.opp.life,oppMons:Object.values(battle.opp.monsters).filter(Boolean).length}`);
  ok(w.set === 0 && w.drop && w.oppLife === 1 && w.oppMons === 0, "#1541 end of attack phase with 5 souls: opponent field destroyed, life 1, World End destroyed");

  console.log("=== Last Symphony: needs 3 different Dark Burial [Set] ===");
  put(6356, 0);
  run(`battle.opp.life=8; ABX.fireTurnEvent('turnStart',null,'plr')`); await tick();
  ok(J(`battle.opp.life`) === 8, "#6356 alone: opponent's life is NOT set to 3");
  put(6356, 0, `[6352,6353,6357].forEach(id=>me.setSpells.push(Object.assign({},CARD_MAP.get(id),{soul:[]}))); en.life=8;`);
  run(`ABX.fireTurnEvent('turnStart',null,'plr')`); await tick();
  ok(J(`battle.opp.life`) === 3, "#6356 with 3 different Dark Burial set: opponent's life becomes 3");

  console.log("=== New-Era Great Spell: draw by a card effect -> gauge + 1 life, once per turn ===");
  put(1152, 0, `me.hand=[]; me.life=10;`);
  const dr = `ABX.OPS.draw.run({op:'draw',who:'you',n:1},{side:'plr',f:battle.plr,e:battle.opp,bind:{},card:CARD_MAP.get(1152)})`;
  const g0 = J(`battle.plr.gauge.length`);
  run(dr); await tick(); run(dr); await tick();
  ok(J(`battle.plr.life`) === 11 && J(`battle.plr.gauge.length`) === g0 + 1, "#1152 first effect draw: +1 gauge, +1 life; second draw the same turn: nothing");

  console.log("=== Remaining [Set] impacts ===");
  // #6363 Curse Count: damage reduced by 1 while a «Curse Dragon» monster is on your field
  const dmg = async (n) => { const l0 = J(`battle.plr.life`); run(`ABX.core.applyDamage('plr',${n},{kind:'effect'})`); await tick(); return l0 - J(`battle.plr.life`); };
  put(6363, 0, `me.monsters.center=mk(CARD_MAP.get(4943));`);
  ok(await dmg(3) === 2, "#6363 with a Curse Dragon: 3 damage -> 2");
  put(6363, 0, `me.monsters.center=mk(ALL_CARDS.find(c=>c.type==='Monster'&&c.size===1&&!c.skill));`);
  ok(await dmg(3) === 3, "#6363 without a Curse Dragon: 3 damage -> 3");
  put(6363, 0);
  run(`ABX.fireTurnEvent('turnEnd',null,'plr')`); await tick();
  ok(J(`battle.opp.flagUnder.length`) === 2, "#6363 end of your turn: top 2 cards of the opponent's deck go under their flag");
  // #4243 Tempest Thunder Knights Formation!: size -1 and draw on [Move], once per turn
  put(4243, 0, `me.monsters.center=mk(CARD_MAP.get(589)); me.hand=[];`);
  ok(Number(run(`battle.getCurrentSizeUsed(battle.plr)`)) === 0, "#4243 a size 1 Thunder Knights counts as size 0");
  run(`ABX.fireEv('move',{side:'plr',unit:battle.plr.monsters.center,from:'center',to:'left'})`); await tick();
  run(`ABX.fireEv('move',{side:'plr',unit:battle.plr.monsters.left||battle.plr.monsters.center,from:'left',to:'center'})`); await tick();
  ok(J(`battle.plr.hand.length`) === 1, "#4243 [Move] draws one card, once per turn");
  // #297 Super Lethal Formation: all Ninja +1000/+1000 while set
  const ninja = J(`ALL_CARDS.find(c=>c.type==='Monster'&&(c.attrs||[]).includes('Ninja')).id`);
  put(297, 0, `me.monsters.center=mk(CARD_MAP.get(${ninja})); me.monsters.left=mk(ALL_CARDS.find(c=>c.type==='Monster'&&c.size===1&&!c.skill)); me.setSpells.length=0;`);
  const stat = () => J(`[getUnitEffectiveCombatStats(battle.plr,battle.plr.monsters.center),getUnitEffectiveCombatStats(battle.plr,battle.plr.monsters.left)].map(x=>[x.power,x.defense])`);
  const base = stat();
  run(`battle.plr.setSpells.push(Object.assign({},CARD_MAP.get(297),{soul:[]}))`); await tick();
  const withSet = stat();
  ok(withSet[0][0] === base[0][0] + 1000 && withSet[0][1] === base[0][1] + 1000 && withSet[1][0] === base[1][0], "#297 Ninja get power+1000 / defense+1000 while set, others unchanged");
  run(`battle.plr.setSpells.length=0`); await tick();
  ok(JSON.stringify(stat()) === JSON.stringify(base), "#297 the bonus ends when it leaves the set zone");
  // #290 + Secret Sword (#293): in the soul of Lethal Formation, cast when the opponent casts an impact
  const oppImp = J(`ALL_CARDS.find(c=>c.type==='Impact'&&!c.set&&c.power==null&&/Deal \\d+ damage/.test(c.skill||'')).id`);
  put(290, 0, `me.setSpells[0].soul=[293]; me.gauge=me.deck.splice(0,10); battle.activeSide='opp';battle.turn='opp';battle.phase='final';`);
  run(`ABX.fireCast('opp',CARD_MAP.get(${oppImp}))`); await tick();
  ok(J(`battle.plr.setSpells[0].soul.length`) === 0 && J(`battle.plr.drop.includes(293)`) && J(`battle.opp.life`) === 7, "#293 in the soul of #290: cast when the opponent casts an impact (3 damage, soul emptied)");
  ok(J(`battle.plr.gauge.length`) === 7, "#293 casting it pays its [Cast Cost] (3 gauge)");
  put(290, 0, `me.setSpells[0].soul=[293]; me.gauge=me.deck.splice(0,2); battle.activeSide='opp';battle.turn='opp';battle.phase='final';`);
  run(`ABX.fireCast('opp',CARD_MAP.get(${oppImp}))`); await tick();
  ok(J(`battle.plr.setSpells[0].soul.length`) === 1 && J(`battle.opp.life`) === 10, "#293 with only 2 gauge it cannot be cast and stays in the soul");
  // #1406 There are no Places for You to Run!: cast cost = 2 drop cards into its soul; inherits "Thunder Mine"
  setup(1406, ``); run(`battle.castImpactFromHand('plr',0)`); flush(); await wait(10); flush();
  ok(J(`battle.plr.setSpells.length`) === 1 && J(`battle.plr.setSpells[0].soul.length`) === 2 && J(`battle.plr.drop.length`) === 6 - 0 + 2 - 2, "#1406 cast cost puts two drop cards into its soul (drop: -2 +2 gauge paid)");
  put(1406, 0, `me.setSpells[0].soul=[1215]; en.monsters.left=mk(ALL_CARDS.find(c=>c.type==='Monster'&&c.size===1&&!c.skill)); battle.activeSide='opp';battle.turn='opp';battle.phase='main';`);
  run(`ABX.fireOtherEnter('opp',battle.opp.monsters.left)`); await tick();
  ok(J(`battle.opp.life`) === 9, "#1406 inherits the \"Thunder Mine\" of a card in its soul (size 1 enters the opponent's field: 1 damage)");
  // #6414 Mirrors Space: counter act calls a Super Warrior from its soul, once per turn
  const swIds = J(`ALL_CARDS.filter(c=>(c.attrs||[]).includes('SuperWarrior')).slice(0,2).map(c=>c.id)`);
  put(6414, 0, `me.setSpells[0].soul=${JSON.stringify(swIds)}; battle.activeSide='opp';battle.turn='opp';battle.phase='main';`);
  const opts = () => J(`ABX.freeFieldCounterOptions('plr').filter(o=>o.card.id===6414).map(o=>o.key)`);
  ok(opts().length === 0, "#6414 not usable in the main phase");
  run(`battle.phase='final'`); const o = opts();
  ok(o.length === 1, "#6414 usable in the final phase");
  const g1 = J(`battle.plr.gauge.length`);
  run(`ABX.useFreeFieldCounter('plr','${o[0]}')`); await tick();
  ok(J(`Object.values(battle.plr.monsters).filter(Boolean).length`) === 1 && J(`battle.plr.setSpells[0].soul.length`) === 1 && J(`battle.plr.gauge.length`) < g1, "#6414 a Super Warrior is called from its soul, paying its call cost");
  ok(opts().length === 0, "#6414 once per turn");

  console.log(`\npass ${passed} fail ${failed}`);
  process.exit(failed ? 1 : 0);
})();
