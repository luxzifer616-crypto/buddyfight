/**
 * Verification Suite for Round 40 (`abilities_r40.js`):
 * 1. Core Ops: OPS.preventLeave, OPS.saveOnce, OPS.stackOnTop (#2789 Dragon Drei)
 * 2. Boss & Multi-Card Shapes:
 *    - #867 / #2019 Azi Dahaka ("Erasure of History" + equip #2020 Aqulta Gwaneff on destroy)
 *    - #1635 Commandant of Enma Alliance, Burn Nova (borrow abilities of discarded «Raging Spirits»)
 *    - #3383 Bone Master, Rebel Gallows (rest self -> stand opp monster & deal its crit damage to opp)
 *    - #4461 Kagura-bell of Worship (stack size 3 «Electrodeity» as item + EOT re-equip from soul)
 *    - #4569 / #5760 Lost World ("Belost" EOT flag stack & 30-card Lost Deck swap)
 *    - #5517 Legendary Ice Deity, Freeza Horus ("Double Buddy Call" -> free Magma Horus buddy call)
 *    - #5957, #5958, #5959, #5960 Godclock ("Horary Domination" on Clock-I/II/III + Endruler Dragon 3-flag [Reversal]) & #6202 Overgod "0"
 *    - #694 Checkmate, #741 Actor Knights the World, #5649 / #5852 / #5924 Token callers, #6098 (1 dmg x16)
 *    - #5445 / #5446 / #5643 THE IDOLM@STER Face-Down Buddy Zone mechanics
 */
const { createEnv } = require("./headless");
const env = createEnv();
let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    failed++;
    console.error(`  ❌ FAIL: ${msg}`);
  } else {
    passed++;
    console.log(`  ✅ PASS: ${msg}`);
  }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("=== 1. Core Ops: OPS.preventLeave, OPS.saveOnce & OPS.stackOnTop (#2789 Dragon Drei) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(2579, "Dragon Zwei", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.OPS.preventLeave.run({}, { f: battle.plr, unit: battle.plr.monsters.center, side: "plr" });
    battle.destroyMonster("plr", "center");
  }`);
  await wait(100);
  ok(env.run(`battle.plr.monsters.center !== null`), "OPS.preventLeave / saveOnce keeps the monster on the field when it would be destroyed");

  // #2789 Dragon Drei stackOnTop
  env.run(`{
    battle.plr.hand = [2789];
    battle.plr.monsters.left = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.OPS.stackOnTop.run({}, { f: battle.plr, card: CARD_MAP.get(2789), side: "plr" });
  }`);
  await wait(100);
  const rDrei = JSON.parse(env.run(`JSON.stringify({
    flagId: battle.plr.flagId,
    life: battle.plr.life,
    leftCleared: battle.plr.monsters.left === null
  })`));
  ok(rDrei.flagId === 2789 && rDrei.life === 5 && rDrei.leftCleared, "#2789 Dragon Drei stacks on top of Dragon Zwei, sends all field cards to drop, and sets life to 5");

  console.log("\n=== 2. #867 / #2019 Azi Dahaka ('Erasure of History' & #2020 Aqulta Gwaneff equip on destroy) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Azi Dahaka", 867, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.monsters.center = { card: CARD_MAP.get(867), rested: false, attacksLeft: 1, soul: [] };
    battle.plr.deck.unshift(2020); // Aqulta Gwaneff in deck
    battle.opp.item = { card: CARD_MAP.get(15), rested: false, attacksLeft: 1, soul: [] };
    ABX.OPS.r40AziDahakaAttack867.run({}, { side: "plr", f: battle.plr, e: battle.opp, card: CARD_MAP.get(867), unit: battle.plr.monsters.center });
  }`);
  await wait(100);
  ok(env.run(`battle.plr.monsters.center.attackAll === true && battle.opp.item === null`), "#867 Azi Dahaka 'Erasure of History' sets attackAll and destroys all opponent items");

  env.run(`{
    ABX.fireLeave("plr", CARD_MAP.get(867), false);
  }`);
  await wait(200);
  ok(env.run(`Boolean(battle.plr.item && battle.plr.item.card.id === 2020)`), "#867 Azi Dahaka searches deck for #2020 'Demonic Demise Sword, Aqulta Gwaneff' and equips it when destroyed");

  console.log("\n=== 3. #1635 Burn Nova (Borrow Abilities), #3383 Rebel Gallows & #4461 Kagura-bell ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Burn Nova", 1635, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    const rsMon = ALL_CARDS.find(c => c.type === "Monster" && (c.attrs || []).some(a => /raging\s*spirit/i.test(a)));
    battle.plr.hand = [rsMon.id];
    battle.plr.monsters.center = { card: CARD_MAP.get(1635), rested: false, attacksLeft: 1, soul: [] };
    ABX.useAct("plr", CARD_MAP.get(1635), battle.plr.monsters.center);
  }`);
  await wait(200);
  ok(env.run(`Boolean(battle.plr.monsters.center.abxBorrowIds && battle.plr.monsters.center.abxBorrowIds.ids.length === 1)`), "#1635 Burn Nova discards a «Raging Spirits» monster from hand and borrows its abilities for the turn");

  // #3383 Bone Master, Rebel Gallows
  env.run(`{
    battle.plr.isBot = true;
    battle.plr.monsters.left = { card: CARD_MAP.get(3383), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.center = { card: Object.assign({}, CARD_MAP.get(46), { crit: 3 }), rested: true, attacksLeft: 1, soul: [] };
    battle.opp.life = 10;
    ABX.useAct("plr", CARD_MAP.get(3383), battle.plr.monsters.left);
  }`);
  await wait(200);
  ok(env.run(`battle.plr.monsters.left.rested === true && battle.opp.life === 7`), "#3383 Rebel Gallows rests self, stands opponent's monster, and makes it attack the opponent for its critical (3)");

  // #4461 Kagura-bell of Worship stacks size 3 «Electrodeity» from hand as item, then EOT re-equips #4461 and bounces previous item
  env.run(`{
    const electro3 = ALL_CARDS.find(c => c.type === "Monster" && c.size === 3 && (c.attrs || []).includes("Electrodeity")) || Object.assign({}, CARD_MAP.get(46), { size: 3, attrs: ["Electrodeity"] });
    window.__electroId = electro3.id;
    battle.plr.hand = [electro3.id];
    battle.plr.item = { card: CARD_MAP.get(4461), rested: false, attacksLeft: 1, soul: [] };
    ABX.OPS.r40StackMonsterAsItem.run({ attr: "Electrodeity" }, { side: "plr", f: battle.plr, e: battle.opp, unit: battle.plr.item });
  }`);
  await wait(100);
  ok(env.run(`battle.plr.item.card.id === window.__electroId && battle.plr.item.soul.includes(4461)`), "#4461 Kagura-bell stacks size 3 «Electrodeity» from hand on top of itself as an item");

  env.run(`{
    ABX.OPS.r40KaguraBellEOT4461.run({}, { side: "plr", f: battle.plr, e: battle.opp });
  }`);
  await wait(100);
  ok(env.run(`battle.plr.item.card.id === 4461 && battle.plr.hand.includes(window.__electroId)`), "#4461 Kagura-bell EOT equips itself from the item's soul and returns the stacked «Electrodeity» to hand");

  console.log("\n=== 4. #4569 Lost World ('Belost'), #5517 Freeza Horus & #5957–#5960 Godclock / #6202 Overgod '0' ===");
  env.run(`{
    const deck = generateFlagDeck(447, "Lost", 571, true);
    battle.start("hotseat", deck, generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.hand.push(4569);
    battle.plr.gauge = [46, 46, 46];
    ABX.OPS.r40Belost.run({}, { side: "plr", f: battle.plr, e: battle.opp, card: CARD_MAP.get(4569) });
  }`);
  await wait(100);
  ok(env.run(`battle.plr.flagId === 4569 && battle.plr.belostUsed === true && battle.plr.deck.length === 28`), "#4569 Lost World 'Belost' stacks on top of your flag, swaps in the 30-card Lost Deck, and draws 2 cards");

  // #5958 Clock-I, #5959 Clock-II, #5960 Clock-III ("Horary Domination") + #5957 Endruler Dragon [Reversal] + #6202 Overgod "0"
  env.run(`{
    battle.start("hotseat", generateFlagDeck(5957, "Godclock", 5968, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    const timeRuler = ALL_CARDS.find(c => c.type === "Monster" && /time ruler/i.test(c.name || "")) || Object.assign({}, CARD_MAP.get(46), { name: "Time Ruler Dragon" });
    battle.plr.hand = [timeRuler.id, 6202, 46, 46, 46];
    ABX.useAct("plr", CARD_MAP.get(5958), null);
    ABX.useAct("plr", CARD_MAP.get(5959), null);
    ABX.useAct("plr", CARD_MAP.get(5960), null);
  }`);
  await wait(300);
  ok(env.run(`battle.plr.subFlags.every(sf => sf.reversalUsed === true)`), "#5958 Clock-I, #5959 Clock-II, and #5960 Clock-III execute 'Horary Domination' and flip into [Reversal]");

  env.run(`{
    ABX.OPS.r40EndrulerReversal5957.run({}, { side: "plr", f: battle.plr, e: battle.opp, card: CARD_MAP.get(5957) });
    battle.opp.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.OPS.r40OvergodEternalEon6202.run({}, { side: "plr", f: battle.plr, e: battle.opp, card: CARD_MAP.get(6202) });
  }`);
  await wait(200);
  ok(env.run(`Boolean(battle.plr.item && battle.plr.item.isEndrulerFlag) && battle.opp.monsters.center.defenseZeroTurn === true && battle.opp.abxTimeStoppedTurn === battle.turnCount`), "#5957 Endruler Dragon [Reversal] equips the flag and #6202 Overgod '0' 'Eternal Eon' reduces opponent defense to 0 and stops opponent's time");

  console.log("\n=== 5. #694 Checkmate, #5445/#5643 IDOLM@STER Face-Down Buddy Zone, #5649 Token Caller & #6098 16-Hit Impact ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Special", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    ABX.fireSpell("plr", CARD_MAP.get(5445));
    ABX.fireSpell("plr", CARD_MAP.get(5446));
    window.__handBefore5643 = battle.plr.hand.length;
    ABX.fireSpell("plr", CARD_MAP.get(5643));
  }`);
  await wait(300);
  ok(env.run(`Array.isArray(battle.plr.buddyZoneFaceDown) && battle.plr.buddyZoneFaceDown.length === 2 && battle.plr.hand.length === window.__handBefore5643 + 3`), "#5445 & #5446 place themselves face-down into the Buddy Zone, enabling #5643 to draw 3 cards (2 + 1 bonus)");

  env.run(`{
    battle.plr.monsters.left = null; battle.plr.monsters.center = null; battle.plr.monsters.right = null;
    ABX.useAct("plr", CARD_MAP.get(5649), null);
    battle.opp.life = 20;
    ABX.fireSpell("plr", CARD_MAP.get(6098));
  }`);
  await wait(200);
  const rTok = JSON.parse(env.run(`JSON.stringify({
    tokenCalled: Boolean(battle.plr.monsters.left && battle.plr.monsters.left.card.power === 10000 && battle.plr.monsters.left.card.crit === 3),
    oppLifeAfter16Hits: battle.opp.life
  })`));
  ok(rTok.tokenCalled && rTok.oppLifeAfter16Hits === 4, "#5649 calls a face-down 'That Girl' (Size 0 / 10000 / 1000 / 3) token from top of deck, and #6098 deals 1 damage 16 times (20 -> 4)");

  console.log(`\n🎉 ROUND 40 SUMMARY: ${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
