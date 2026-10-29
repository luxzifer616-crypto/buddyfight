// "Infinity the Chaos" as a second flag (abilities_r37.js), Chaos Size 30/90/10000 limits, and more than one item (game.js "item2").
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const J = (s) => JSON.parse(env.run(`JSON.stringify(${s})`));

(async () => {
  env.run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true;
    window.__ctx = () => ({ side: "plr", f: battle.plr, e: battle.opp, card: CARD_MAP.get(4072), unit: null, bind: { chosen: [] }, auto: true });`);
  await wait(1200);

  // 1. Verify official Chaos monster sizes (Size 30, Size 90, Size 10000 — not Size 3!)
  const sizes = J(`({
    s30: [3338, 3345, 3348, 3369, 3650, 3918, 4119, 4804, 6500].every(id => CARD_MAP.get(id).size === 30),
    s90: [3743, 3825, 3940, 5341].every(id => CARD_MAP.get(id).size === 90),
    s10000: CARD_MAP.get(4071).size === 10000
  })`);
  ok(sizes.s30, "All 9 Size-30 Geargod / Mini Geargod monsters have size === 30 (not 3)");
  ok(sizes.s90, "All 4 Size-90 Geargod monsters (#3743, #3825, #3940, #5341) have size === 90 (not 3)");
  ok(sizes.s10000, "#4071 Ultimate CHAOS, Geargod COMPLETE has size === 10000 (not 3)");

  ok(J(`battle.plr.flagUnder`).includes(3941), "The Chaos: \"Infinity the Chaos\" starts face down under the flag");
  ok(J(`battle.plr.deck.includes(4072) || battle.plr.hand.includes(4072)`), "\"The Chaos Upgrade\" is given to the player");

  // 2. Verify normal "The Chaos" (#3337, maxSize = 99) size enforcement:
  //    - Can call Size 30 (#3338) -> uses 30/99 size
  //    - Calling Size 90 (#3940) while Size 30 is on field -> 30 + 90 = 120 > 99, so #3338 is sent to drop and size used is 90/99
  //    - Cannot call #4071 Ultimate CHAOS, Geargod COMPLETE (Size 10000 > 99) from hand or via ability!
  env.run(`{
    const f = battle.plr;
    ["left","center","right","center2"].forEach(p => f.monsters[p] = null);
    f.gauge = f.deck.splice(0, 10);
    f.hand.push(3338, 3940, 4071);
    battle.activeSide = "plr";
    battle.phase = "main";
    battle.completeMonsterCall("plr", "left", f.hand.indexOf(3338), false);
  }`);
  ok(J(`battle.plr.monsters.left && battle.plr.monsters.left.card.id === 3338 && battle.getCurrentSizeUsed(battle.plr) === 30`), "Normal The Chaos (maxSize 99): calling #3338 Geargod VII uses 30 size (30/99)");

  env.run(`battle.completeMonsterCall("plr", "right", battle.plr.hand.indexOf(3940), false)`);
  ok(J(`!battle.plr.monsters.left && battle.plr.monsters.right && battle.plr.monsters.right.card.id === 3940 && battle.getCurrentSizeUsed(battle.plr) === 90`), "Normal The Chaos (maxSize 99): calling Size-90 #3940 Geargod ver.1000 sends Size-30 #3338 to drop (30+90=120 > 99)");

  const cond4071Before = J(`evaluateCardConditions(CARD_MAP.get(4071), battle.plr, battle.opp)`);
  env.run(`battle.completeMonsterCall("plr", "center", battle.plr.hand.indexOf(4071), false)`);
  ok(!cond4071Before.met && J(`!battle.plr.monsters.center && battle.plr.hand.includes(4071)`), "Normal The Chaos (maxSize 99): #4071 Geargod COMPLETE (Size 10000) CANNOT be called before flipping into Infinity the Chaos");

  // 3. Flip into "Infinity the Chaos" (#3941) via "The Chaos Upgrade" (#4072) -> maxSize becomes infinite (1e9)
  env.run(`battle.plr.drop = battle.plr.deck.splice(0, 9)`);
  await env.run(`ABX.OPS.r37ChaosUpgrade.run({}, __ctx())`); await wait(300);
  ok(J(`battle.plr.flagId`) === 3337, "with 9 cards in the drop zone the Upgrade does nothing");
  env.run(`battle.plr.drop.push(battle.plr.deck.shift())`);
  await env.run(`ABX.OPS.r37ChaosUpgrade.run({}, __ctx())`); await wait(300);
  ok(J(`battle.plr.flagId`) === 3941 && J(`battle.plr.maxSize`) >= 1e9, "with 10: the flag becomes \"Infinity the Chaos\", size limit infinite");

  // Now under "Infinity the Chaos", #4071 (Size 10000) + #3940 (Size 90) + #3338 (Size 30) can all be on the field together!
  env.run(`{
    const f = battle.plr;
    if (!f.hand.includes(3338)) f.hand.push(3338);
    battle.completeMonsterCall("plr", "left", f.hand.indexOf(3338), false);
    battle.completeMonsterCall("plr", "center", f.hand.indexOf(4071), false);
  }`);
  ok(J(`battle.plr.monsters.left && battle.plr.monsters.right && battle.plr.monsters.center && battle.plr.monsters.center.card.id === 4071 && battle.getCurrentSizeUsed(battle.plr) === 10120`), "Infinity the Chaos (maxSize ∞): #3338 (Size 30) + #3940 (Size 90) + #4071 (Size 10000) all coexist on the field (total Size 10120)");

  const big = J(`(ALL_CARDS.find(c => c.type === "Monster" && (c.size || 0) >= 30) || {}).id || null`);
  if (big) {
    env.run(`battle.plr.monsters.left = { card: CARD_MAP.get(${big}), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 }`);
    ok(J(`ABX.core.isProtected(battle.plr.monsters.left, "plr", "destroyed", { side: "opp", card: ALL_CARDS.find(c => c.type === "Spell") })`), "a size 30+ monster can't be destroyed by effects");
  }
  // more than one item
  env.run(`{ const f = battle.plr; ["left","center","right","center2"].forEach(p => f.monsters[p] = null); f.item = null; f.item2 = null;
    f.item = { card: CARD_MAP.get(3728), rested: false, attacksLeft: 1, soul: [] };
    window.__it = ALL_CARDS.find(c => c.type === "Item" && c.id !== 3728 && c.id !== 6512); f.hand.push(__it.id); }`);
  ok(J(`hasMultiItems(battle.plr)`), "Laevateinn (#3728) on the field allows more than one item");
  ok(J(`ABX.equipFrom("plr", "hand", __it.id, false)`) && J(`!!battle.plr.item2 && battle.plr.item.card.id === 3728`), "a second item goes to the second slot; the first stays");
  ok(J(`ABX.core.fieldUnits(battle.plr, true).some(x => x.pos === "item2")`) && J(`unitAt(battle.plr, "item2") === battle.plr.item2`), "the engine and the attack code see the second item");
  env.run(`battle.destroyMonster("plr", "item2")`);
  ok(J(`!battle.plr.item2 && battle.plr.drop.includes(__it.id)`), "the second item can be destroyed on its own");
  const mon = J(`ALL_CARDS.find(c => c.type === "Monster" && c.size === 1 && /call cost/i.test(c.cost || "")).id`);
  env.run(`battle.plr.hand.push(${mon}); battle.plr.gauge = battle.plr.deck.splice(0, 5); battle.activeSide = "plr"; battle.phase = "main"; battle.completeMonsterCall("plr", "left", battle.plr.hand.indexOf(${mon}), false)`);
  await wait(800);
  ok(!J(`!!battle.plr.monsters.left`), "with Laevateinn on the field you can't put monsters on the field");
  const it2 = J(`ALL_CARDS.find(c => c.type === "Item" && /\\[equip cost\\][^\\n]*pay 1 gauge/i.test(c.cost || "")).id`);
  env.run(`battle.plr.hand.push(${it2})`);
  ok(J(`parseCardCost(CARD_MAP.get(${it2}).cost, CARD_MAP.get(${it2}).skill, battle.plr, CARD_MAP.get(${it2})).gauge`) === 2, "items in your hand cost 1 more gauge to equip (#3728)");
  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
