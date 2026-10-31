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

  console.log(`\npass ${passed} fail ${failed}`);
  process.exit(failed ? 1 : 0);
})();
