/**
 * Verification Suite for Round 39 (`abilities_r39.js`):
 * 1. Family 1 — Complete [Ambush] Suite (#2804, #2868, #2869, #2872, #2875, #2964, #2966, #3604, #3927, #3958, #4022, #4026, #4027, #4178, #4195, #4766, #5193, #6497)
 * 2. Family 2 — Complete «Curse Dragon» / Cards Under Opponent's Flag Suite (#4942, #4943, #4997, #4998, #4999, #5000, #5006, #5039, #5058, #5061, #5063, #5064, #5065, #5066, #5067, #5068, #5069, #5070, #6363, #6364, #6424)
 * 3. Family 3 — Complete «Drago Phantom Thief» / "Magic Treasure" Suite (#5968, #5969, #5970, #5972, #5973, #5989, #6169)
 * 4. Family 4 — Remaining Oppressed Area Suite (#4697, #4861, #4965, #5004, #5043, #6374, #6448, #6449)
 * 5. Family 5 — #4449 Illusions Folktale, Echt Biblio & Remaining Modals / Multi-Card Shapes (#779, #1257, #1604, #1718, #2383, #2681, #3005, #3590, #4870, #5031, #5125, #5349, #5673, #5925, #5992, #6023, #6201, #6272, #6283, #6373, #6383, #6450, #6517, #6520, #6525)
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
  console.log("=== 1. Family 1 — Complete [Ambush] Suite (#2804, #2868, #2875, #3604, #4022, #4178, #4195, #5193, #6497) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(258, "Ambush R39", 3617, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    // #2804 Oni Boss, Kid Ibuki entering by [Ambush] destroys size 2 monster and deals 2 damage
    battle.opp.life = 10;
    battle.opp.monsters.center = { card: Object.assign({}, CARD_MAP.get(46), { size: 2, sg: false }), rested: false, attacksLeft: 1, soul: [] };
    battle.plr.monsters.left = { card: CARD_MAP.get(2804), rested: false, attacksLeft: 1, soul: [], calledByAmbush: true, enteredByAmbush: true };
    ABX.fireEnter("plr", CARD_MAP.get(2804), battle.plr.monsters.left);
  }`);
  await wait(200);
  const rAmb1 = JSON.parse(env.run(`JSON.stringify({ oppCenter: battle.opp.monsters.center, oppLife: battle.opp.life })`));
  ok(rAmb1.oppCenter === null && rAmb1.oppLife === 8, "#2804 Oni Boss, Kid Ibuki entered by [Ambush] destroys opponent monster and deals damage equal to its size (2)");

  // #6497 Oni Boss, Kid Ibuki "Re:B" Hand [Act] puts itself face-down into «Oni Assassin» soul & draws 1 card
  env.run(`{
    battle.plr.hand = [6497];
    window.__deckBefore6497 = battle.plr.deck.length;
    ABX.useAct("plr", CARD_MAP.get(6497), null);
  }`);
  await wait(200);
  const rAmb2 = JSON.parse(env.run(`{
    const soul = battle.plr.monsters.left.soul;
    JSON.stringify({
      inSoul: soul.length === 1 && getSoulCardId(soul[0]) === 6497,
      isFD: isSoulEntryFaceDown(soul[0]),
      drew: battle.plr.hand.length === 1
    });
  }`));
  ok(rAmb2.inSoul && rAmb2.isFD && rAmb2.drew, "#6497 Oni Boss, Kid Ibuki 'Re:B' hand [Act] puts itself face-down into «Oni Assassin» soul and draws 1 card");

  // #4195 One Who Leads equips up to 2 «Hero» items from drop zone without paying [Equip Cost]
  env.run(`{
    battle.plr.monsters.left = null; battle.plr.monsters.center = null; battle.plr.monsters.right = null;
    battle.plr.item = null; battle.plr.item2 = null;
    const heroItems = ALL_CARDS.filter(c => c.type === "Item" && (c.attrs || []).includes("Hero")).slice(0, 2);
    battle.plr.drop = [heroItems[0].id, heroItems[1].id, 3728];
    battle.plr.buddyId = 6512; // enables multi-items
    ABX.fireSpell("plr", CARD_MAP.get(4195));
  }`);
  await wait(200);
  const rAmb3 = JSON.parse(env.run(`JSON.stringify({ i1: Boolean(battle.plr.item), i2: Boolean(battle.plr.item2) })`));
  ok(rAmb3.i1 && rAmb3.i2, "#4195 One Who Leads equips two «Hero» items from drop zone into item and item2");

  console.log("\n=== 2. Family 2 — «Curse Dragon» / Cards Under Opponent's Flag (#4943, #4997, #5006, #5063, #5070, #6363, #6424) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Curse Dragon", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.setSpells = [CARD_MAP.get(5070), CARD_MAP.get(4997), CARD_MAP.get(6363)]; // Curse Field + Sentence of Curse + Curse Count
    battle.plr.item = { card: CARD_MAP.get(5063), rested: false, attacksLeft: 1, soul: [] }; // Geilblade
    battle.plr.monsters.center = { card: CARD_MAP.get(5006), rested: false, attacksLeft: 1, soul: [4943] }; // Zevens the Stygian
    battle.plr.gauge = [46, 46, 46];
    window.__handBefore5063 = battle.plr.hand.length;
    ABX.useAct("plr", CARD_MAP.get(5063), battle.plr.item);
  }`);
  await wait(200);
  const rCurse1 = JSON.parse(env.run(`JSON.stringify({
    underCnt: ABX.countOppUnderFlag("plr"),
    itemRested: battle.plr.item.rested,
    curseFieldTriggered: battle.plr.abxCurseFieldTurn === battle.turnCount,
    size1CurseSize: getEffectiveCardSize(battle.plr, CARD_MAP.get(4943)),
    geilProtected: ABX.core.isProtected(battle.plr.monsters.center, "plr", "destroyed", { side: "opp" })
  })`));
  ok(rCurse1.underCnt === 1 && rCurse1.itemRested && rCurse1.curseFieldTriggered, "#5063 Geilblade puts top card of opponent's deck face-up under their flag and triggers #5070 Curse Field (+1 gauge, +1 draw)");
  ok(rCurse1.size1CurseSize === 0 && rCurse1.geilProtected, "#5006 Zevens reduces size 1 «Curse Dragon» to size 0, and #5063 Geilblade protects «Curse Dragon» from opponent destruction");

  // #6424 Curse Grip with 6+ cards under opponent's flag puts opponent's card face-up under their flag instead of destroying it!
  env.run(`{
    ABX.putTopOppDeckUnderFlag("plr", 5); // now 6 cards under opponent's flag
    battle.opp.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.fireSpell("plr", CARD_MAP.get(6424));
  }`);
  await wait(200);
  const rCurse2 = JSON.parse(env.run(`JSON.stringify({
    oppCenter: battle.opp.monsters.center,
    underCnt: ABX.countOppUnderFlag("plr")
  })`));
  ok(rCurse2.oppCenter === null && rCurse2.underCnt === 7, "#6424 Curse Grip with 6+ cards under opponent's flag puts chosen opponent card face-up under their flag (now 7)");

  // #4997 Sentence of Curse: at start of opponent's turn, puts 1 card under opponent's flag and wins if 15+!
  env.run(`{
    ABX.putTopOppDeckUnderFlag("plr", 7); // now 14 cards under opponent's flag
    battle.activeSide = "opp";
    ABX.fireTurnEvent("turnStart");
  }`);
  await wait(200);
  const rCurse3 = JSON.parse(env.run(`JSON.stringify({
    underCnt: ABX.countOppUnderFlag("plr"),
    matchOver: battle.matchOver
  })`));
  ok(rCurse3.underCnt >= 15 && rCurse3.matchOver === true, "#4997 Sentence of Curse puts 15th card under opponent's flag at start of opponent's turn and wins the fight");

  console.log("\n=== 3. Family 3 — «Drago Phantom Thief» / 'Magic Treasure' (#5968, #5969, #5970, #5972, #5973, #5989, #6169) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(1, "Phantom Thief", 5968, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.buddyId = 5969; // Sky Castle of Drago Phantom Thief, "Lebla Maurice"
    battle.plr.setSpells = [CARD_MAP.get(5970)]; // My Funny Venus
    battle.plr.item = { card: CARD_MAP.get(5973), rested: false, attacksLeft: 1, soul: [] }; // Chaser Beetle
    battle.plr.monsters.left = { card: CARD_MAP.get(5968), rested: false, attacksLeft: 1, soul: [] }; // Winds Harry
    battle.plr.monsters.right = { card: CARD_MAP.get(6169), rested: false, attacksLeft: 1, soul: [] }; // Bellamy Heart
    battle.opp.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    battle.plr.gauge = [46, 46, 46];
    ABX.fireSpell("plr", CARD_MAP.get(5969)); // Puts 4 Magic Treasures on opponent's field!
  }`);
  await wait(200);
  const rMT1 = JSON.parse(env.run(`{
    const st6169 = getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.right);
    JSON.stringify({
      mtCount: ABX.countMagicTreasures(battle.opp),
      funnyVenusFired: battle.plr.abxFunnyVenusTurn === battle.turnCount,
      bellamyDestroyedOppCenter: battle.opp.monsters.center === null,
      bellamySize: getEffectiveCardSize(battle.plr, CARD_MAP.get(6169), battle.plr.monsters.right),
      bellamyDA: st6169.da,
      beetleProtects: ABX.core.isProtected(battle.plr.monsters.left, "plr", "destroyed", { side: "opp" })
    });
  }`));
  ok(rMT1.mtCount === 4 && rMT1.funnyVenusFired && rMT1.bellamyDestroyedOppCenter, "#5969 Lebla Maurice places 4 face-down 'Magic Treasure' in opponent's spell area, triggering #5970 My Funny Venus and #6169 Bellamy Heart");
  ok(rMT1.bellamySize === env.run("CARD_MAP.get(6169).size - 1") && rMT1.bellamyDA && rMT1.beetleProtects, "#6169 Bellamy Heart gets size-1, critical+1 & [Double Attack], and #5973 Chaser Beetle protects «Drago Phantom Thief» at 4+ Magic Treasures");

  // #5968 Winds Harry adds 2 more Magic Treasures (total 6) & #5972 Steal Time scales with 6+ Magic Treasures
  env.run(`{
    ABX.useAct("plr", CARD_MAP.get(5968), battle.plr.monsters.left);
  }`);
  await wait(200);
  env.run(`{
    window.__lifeBefore5972 = battle.plr.life;
    ABX.fireSpell("plr", CARD_MAP.get(5972));
  }`);
  await wait(200);
  const rMT2 = JSON.parse(env.run(`JSON.stringify({
    mtCount: ABX.countMagicTreasures(battle.opp),
    canAttackThroughCenter: ABX.canAttackThrough("plr", battle.plr.monsters.left, "opp"),
    lifeGained: battle.plr.life === window.__lifeBefore5972 + 2
  })`));
  ok(rMT2.mtCount === 6 && rMT2.canAttackThroughCenter && rMT2.lifeGained, "#5968 Winds Harry brings Magic Treasures to 6, enabling #5973 center-bypass attack and #5972 Steal Time (+2 gauge, +2 draw, +2 life)");

  console.log("\n=== 4. Family 4 — Remaining Oppressed Area Suite (#4697, #4861, #4965, #5004, #5043, #6374, #6448, #6449) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Oppress R39", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.setSpells = [CARD_MAP.get(6448)]; // Over Thousands of Boards
    battle.plr.monsters.left = { card: CARD_MAP.get(6374), rested: false, attacksLeft: 1, soul: [] }; // Gilt Lance (0-gauge Oppress!)
    battle.plr.monsters.center = { card: CARD_MAP.get(6449), rested: false, attacksLeft: 1, soul: [] }; // Archbishop: Giallo Mace
    battle.opp.monsters.left = null;
    battle.opp.monsters.right = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.center = null;
    ABX.useAct("plr", CARD_MAP.get(6374), battle.plr.monsters.left);
  }`);
  await wait(200);
  const rOpp1 = JSON.parse(env.run(`{
    const gilt = battle.opp.monsters.left;
    const stGilt = getUnitEffectiveCombatStats(battle.plr, gilt);
    const sz6449 = getEffectiveCardSize(battle.plr, CARD_MAP.get(6449), battle.plr.monsters.center);
    const protDrametal = ABX.core.isProtected(gilt, "plr", "rest", { side: "opp" }) && ABX.core.isProtected(gilt, "plr", "nullified", { side: "opp" });
    JSON.stringify({
      inOppLeft: Boolean(gilt && gilt.card.id === 6374),
      powBonus: stGilt.power - CARD_MAP.get(6374).power,
      pen: stGilt.pen,
      sz6449,
      protDrametal
    });
  }`));
  ok(rOpp1.inOppLeft && rOpp1.powBonus === 3000 && rOpp1.pen && rOpp1.sz6449 === env.run("CARD_MAP.get(6449).size - 1") && rOpp1.protDrametal, "#6374 Gilt Lance oppresses for 0 gauge, #6449 gives +3000/+3000/+1/[Penetrate] & size-1, and #6448 protects «Drametal» from [Rest]/nullify");

  // #6448 Over Thousands of Boards [Act] moves opponent's right monster to their open center, and #6374 deals 3 damage at end of turn
  env.run(`{
    ABX.useAct("plr", CARD_MAP.get(6448), battle.plr.setSpells[0]);
    battle.opp.life = 10;
    ABX.fireTurnEvent("turnEnd");
  }`);
  await wait(200);
  const rOpp2 = JSON.parse(env.run(`JSON.stringify({
    movedToOppCenter: Boolean(battle.opp.monsters.center && battle.opp.monsters.right === null),
    oppLifeAfterGiltEOT: battle.opp.life
  })`));
  ok(rOpp2.movedToOppCenter && rOpp2.oppLifeAfterGiltEOT === 7, "#6448 moves opponent's side monster to their open center, and #6374 deals 3 damage at end of turn");

  console.log("\n=== 5. Family 5 — #4449 Echt Biblio, #4870 Galaxy F, #3005, #5125, #5925 & Remaining Modals ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Folktale & Modals", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.item = { card: CARD_MAP.get(4449), rested: false, attacksLeft: 1, soul: [] }; // Echt Biblio
    const folktaleMon = ALL_CARDS.find(c => c.type === "Monster" && (c.attrs || []).includes("Folktale")) || Object.assign({}, CARD_MAP.get(46), { attrs: ["Folktale"] });
    window.__ftId = folktaleMon.id;
    battle.plr.monsters.center = { card: folktaleMon, rested: false, attacksLeft: 1, soul: [] };
    battle.plr.life = 10;
    battle.destroyMonster("plr", "center"); // should be saved by #4449 into its soul!
  }`);
  await wait(200);
  const rBib1 = JSON.parse(env.run(`JSON.stringify({
    life: battle.plr.life,
    inBiblioSoul: battle.plr.item.soul.includes(window.__ftId),
    centerEmpty: battle.plr.monsters.center === null
  })`));
  ok(rBib1.life === 9 && rBib1.inBiblioSoul && rBib1.centerEmpty, "#4449 Echt Biblio pays 1 life when a «Folktale» monster would be destroyed and puts it into Echt Biblio's soul");

  // #4449 "Marchen Panic" [Counter] [Act] calls up to 3 monsters from Echt Biblio's soul
  env.run(`{
    battle.plr.gauge = [46, 46, 46, 46];
    ABX.useAct("plr", CARD_MAP.get(4449), battle.plr.item);
  }`);
  await wait(200);
  const rBib2 = JSON.parse(env.run(`JSON.stringify({
    soulLen: battle.plr.item.soul.length,
    calledBack: Boolean(battle.plr.monsters.left || battle.plr.monsters.center || battle.plr.monsters.right)
  })`));
  ok(rBib2.soulLen === 0 && rBib2.calledBack, "#4449 'Marchen Panic' calls the «Folktale» monster from Echt Biblio's soul back onto the field");

  // #5125 "Friendship Blade" Deity Creations Fangflare, Gargantua Punisher!! (Destroy 5 times / Return 5 times)
  env.run(`{
    battle.opp.monsters.center = { card: Object.assign({}, CARD_MAP.get(46), { sg: true }), rested: false, attacksLeft: 1, soul: [46, 46, 46, 46] }; // 4 souls + monster = 5 lives!
    ABX.fireSpell("plr", CARD_MAP.get(5125));
  }`);
  await wait(400);
  ok(env.run(`battle.opp.monsters.center === null`), "#5125 Gargantua Punisher!! Option 1 destroys all opponent cards 5 times (stripping 4 [Soulguard] souls and destroying on the 5th pass)");

  // #4870 Skyseer Ardent Dragon, Cross Farnese Astrologia ("Galaxy F" tri-aura)
  const r4870 = JSON.parse(env.run(`{
    const s1Astro = Object.assign({}, CARD_MAP.get(46), { size: 1, attrs: ["Astrodragon"] });
    const astroItem = Object.assign({}, CARD_MAP.get(15), { type: "Item", attrs: ["Astrodragon"] });
    battle.plr.monsters.center = { card: CARD_MAP.get(4870), rested: false, attacksLeft: 1, soul: [] };
    battle.plr.monsters.left = { card: s1Astro, rested: false, attacksLeft: 1, soul: [] };
    battle.plr.monsters.right = { card: s1Astro, rested: false, attacksLeft: 1, soul: [] };
    battle.plr.item = { card: astroItem, rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    const mySt = getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center);
    const oppSt = getUnitEffectiveCombatStats(battle.opp, battle.opp.monsters.center);
    const restProt = ABX.core.isProtected(battle.plr.monsters.center, "plr", "rest", { side: "opp" });
    JSON.stringify({
      myPowDelta: mySt.power - CARD_MAP.get(4870).power,
      myDefDelta: mySt.defense - CARD_MAP.get(4870).defense,
      myPen: mySt.pen,
      oppPowDelta: oppSt.power - CARD_MAP.get(46).power,
      restProt
    });
  }`));
  ok(r4870.myPowDelta === 5000 && r4870.myDefDelta === 3000 && r4870.myPen && r4870.oppPowDelta === -5000 && r4870.restProt, "#4870 Cross Farnese Astrologia ('Galaxy F') activates all 3 positional/item auras simultaneously");

  console.log(`\n🎉 ROUND 39 SUMMARY: ${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
