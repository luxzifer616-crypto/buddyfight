/**
 * #6526 Demonic Demise Dragon, Azi Dahaka "Re:B" (Dragon Ein deck):
 *  1. When destroyed: put itself into the soul of a spell on your field, and equip #2020 Aqulta Gwaneff from hand/deck.
 *  2. While in the soul of "Dragon Throne" (#941): when an item on your field attacks alone, that item attacks all
 *     opponent's monsters + opponent instead, and this turn gets power+10000 and [Triple Attack].
 */
const { createEnv } = require("./headless");
const env = createEnv();
let passed = 0, failed = 0;
function ok(cond, msg) {
  if (!cond) { failed++; console.error(`  ❌ FAIL: ${msg}`); } else { passed++; console.log(`  ✅ PASS: ${msg}`); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("=== #6526 Azi Dahaka Re:B: legal in Dragon Ein ===");
  ok(env.run(`checkCardLegalityForFlag(CARD_MAP.get(6526), CARD_MAP.get(969)).allowed`), "#6526 is allowed in a Dragon Ein deck");

  console.log("=== destroyed -> soul of set spell + equip Aqulta Gwaneff ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(969, "Dragon Ein", 6526, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.setSpells = [Object.assign({}, CARD_MAP.get(941), { soul: [] })];
    battle.plr.monsters.center = { card: CARD_MAP.get(6526), rested: false, attacksLeft: 1, soul: [] };
    battle.plr.deck.unshift(2020);
    battle.destroyMonster("plr", "center");
  }`);
  await wait(300);
  const r1 = JSON.parse(env.run(`JSON.stringify({
    inSoul: (battle.plr.setSpells[0].soul || []).some(x => (x && x.id !== undefined ? x.id : x) === 6526),
    item: battle.plr.item && battle.plr.item.card.id,
    inDrop: battle.plr.drop.includes(6526)
  })`));
  ok(r1.inSoul && !r1.inDrop, "#6526 goes into the soul of the set spell (not the drop zone) when destroyed");
  ok(r1.item === 2020, "#6526 equips Aqulta Gwaneff (#2020) from the deck when destroyed");

  console.log("=== Dragon Throne soul: item attacks alone ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(969, "Dragon Ein", 6526, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.setSpells = [Object.assign({}, CARD_MAP.get(941), { soul: [6526] })];
    battle.plr.item = { card: CARD_MAP.get(2020), rested: false, attacksLeft: 1, soul: [], itemMode: "equip", tempPower: 0 };
    battle.opp.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.fireAttack("plr", [{ unit: battle.plr.item }], "opp", "center");
  }`);
  await wait(300);
  const r2 = JSON.parse(env.run(`JSON.stringify({
    allOpp: battle.plr.item.abxAttackAllOpp === battle.turnCount,
    power: battle.plr.item.tempPower,
    ta: Boolean(battle.plr.item.tempTA)
  })`));
  ok(r2.allOpp, "item attacks all opponent's monsters + opponent (flag set)");
  ok(r2.power === 10000, "item gets power+10000 this turn");
  ok(r2.ta, "item gets [Triple Attack] this turn");

  console.log("=== no Dragon Throne soul -> no effect ===");
  env.run(`{
    battle.plr.setSpells = [Object.assign({}, CARD_MAP.get(941), { soul: [] })];
    battle.plr.item.tempPower = 0; battle.plr.item.tempTA = false; battle.plr.item.abxAttackAllOpp = 0;
    ABX.fireAttack("plr", [{ unit: battle.plr.item }], "opp", "center");
  }`);
  await wait(300);
  ok(env.run(`battle.plr.item.tempPower === 0 && !battle.plr.item.tempTA`), "no bonus when #6526 is not in Dragon Throne's soul");

  console.log(`\n#6526 Re:B: ${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
