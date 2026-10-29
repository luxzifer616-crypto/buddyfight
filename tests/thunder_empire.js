// Thunder Empire gaps found by the attr scan (#3631, #3812, #4070).
//   node tests/thunder_empire.js
const { createEnv } = require("./headless.js");
const { run } = createEnv();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS:", m); } else { fail++; console.error("  FAIL:", m); } };

run(`battle.start("hotseat", generateFlagDeck(447, "T", 571, true), generateFlagDeck(447, "O", 571, true));
  battle.renderBattle = function () {}; battle.activeSide = "plr"; battle.phase = "main";`);

// --- #3631 Turbulent Thunder Spear X Tempest Ulti-Buster!: gauge cost 12 is reduced by the number of attacks this turn
const costAt = (n) => JSON.parse(run(`(function(){ const f = battle.plr; const c = ALL_CARDS.find(x => x.id === 3631);
  ABX.core.turnStats(f).attacks = ${n}; return JSON.stringify(parseCardCost(c.cost, c.skill, f, c)); })()`)).gauge;
ok(costAt(0) === 12, "3631 costs 12 gauge with no attacks");
ok(costAt(4) === 8, "3631 costs 8 gauge after 4 attacks");
ok(costAt(20) === 0, "3631 cost never drops below 0");

// --- #3812 World Linking Key the First, Drago-Uno
const castInfo = (side, worlds) => JSON.parse(run(`(function(){ const f = battle.plr; const c = ALL_CARDS.find(x => x.id === 3812);
  battle.activeSide = "${side}"; battle.phase = "attack";
  const names = ${JSON.stringify(worlds)}; f.drop = names.map(w => (ALL_CARDS.find(x => x.world === w) || {}).id).filter(Boolean);
  f.gauge = f.deck.splice(0, 5);
  const r = evaluateCardConditions(c, f, battle.opp); return JSON.stringify({ met: r.met, reasons: r.reasons }); })()`));
const five = ["Dragon World", "Hero World", "Katana World", "Magic World", "Danger World"];
ok(!castInfo("opp", five.slice(0, 4)).met, "3812 needs five different world names in the drop zone");
ok(castInfo("opp", five).met, "3812 can be cast on the opponent's turn with five world names");
const costFx = JSON.parse(run(`(function(){ const f = battle.plr; const c = ALL_CARDS.find(x => x.id === 3812);
  const mk = (id) => ({ card: ALL_CARDS.find(x => x.id === id), soul: [], rest: false });
  f.monsters.center = mk(46); f.monsters.left = mk(46); f.item = mk(46); f.setSpells = []; f.drop = [];
  const has = ABX.hasExtras(c); const can = ABX.canPayExtras("plr", c, 0);
  ABX.payExtras("plr", c, null);
  return JSON.stringify({ has, can, mon: ["left", "center", "center2", "right"].filter(p => f.monsters[p]).length, item: !!f.item, drop: f.drop.length }); })()`));
ok(costFx.has && costFx.can, "3812 field-drop cost is recognised and payable");
ok(costFx.mon === 0 && !costFx.item && costFx.drop === 3, "3812 cost puts every card on your field into the drop zone: " + JSON.stringify(costFx));
const empty = run(`(function(){ const f = battle.plr; const c = ALL_CARDS.find(x => x.id === 3812);
  ["left","center","center2","right"].forEach(p => f.monsters[p] = null); f.item = null; f.drop = []; ABX.payExtras("plr", c, null); return f.drop.length; })()`);
ok(empty === 0, "3812 cost with an empty field changes nothing");

// --- #4070 Batzz's Protection, "Dragonificator" Gao: cannot be called
const callRes = run(`(function(){ const c = ALL_CARDS.find(x => x.id === 4070); const side = "plr";
  return String(ABX.callBlock ? ABX.callBlock(side, c, "center") : "nofn"); })()`);
ok(/cannot be called/.test(callRes), "4070 cannot be called (callBlock): " + callRes);
const st = run(`(function(){ const c = ALL_CARDS.find(x => x.id === 4070); const g = ABX.get(c);
  return JSON.stringify(g.abilities.filter(a => a.kind === "rule").map(a => ABX.isExecutable(a))); })()`);
ok(st === "[true]", "4070 'cannot be called' ability counts as runnable: " + st);

console.log(`\nthunder_empire: pass ${pass}, fail ${fail}`);
process.exit(fail ? 1 : 0);
