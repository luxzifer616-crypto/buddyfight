/**
 * Verification Suite for User Rulings (Batch 1, Verbal/Physical Auto-Triggers,
 * Infinity the Chaos Flag, Lost World & Godclock SubFlags, Oppressed Areas, and Face-Down [Ambush]).
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
  console.log("=== 1. 'Infinity the Chaos' (#3941) Treated as Flag & 'The Chaos Upgrade' (#4072) ===");
  const r1 = JSON.parse(env.run(`{
    const infCard = CARD_MAP.get(3941);
    const cfg = getFlagConfig(infCard);
    const theChaosFlag = CARD_MAP.get(3337);
    const legMain = checkCardLegalityForFlag(infCard, theChaosFlag, false);
    const legLost = checkCardLegalityForFlag(infCard, theChaosFlag, true);
    battle.start("hotseat", generateFlagDeck(3337, "Chaos Test", 3338, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    const startedUnder = Array.isArray(battle.plr.flagUnder) && battle.plr.flagUnder.includes(3941);
    battle.plr.drop = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    JSON.stringify({
      type: infCard && infCard.type,
      cannotStart: cfg.cannotStartAsFlag,
      cannotAdd: cfg.cannotAddToDeck,
      legMain,
      legLost,
      startedUnder
    });
  }`));
  ok(r1.type === "Flag", "#3941 Infinity the Chaos is treated as a Flag card");
  ok(r1.cannotStart === true && r1.cannotAdd === true, "#3941 cannot start as Flag and cannot be added to deck");
  ok(!r1.legMain.allowed && r1.legMain.maxCopies === 0, "#3941 is disallowed in Main Deck (maxCopies: 0)");
  ok(!r1.legLost.allowed && r1.legLost.maxCopies === 0, "#3941 is disallowed in Lost Deck (maxCopies: 0)");
  ok(r1.startedUnder, "Before the game, #3941 starts face-down under 'The Chaos' (#3337)");

  env.run(`ABX.fireSpell("plr", CARD_MAP.get(4072))`);
  await wait(300);
  const r1b = JSON.parse(env.run(`JSON.stringify({
    flagId: battle.plr.flagId,
    maxSize: battle.plr.maxSize,
    itemId: battle.plr.item && battle.plr.item.card.id,
    pow: battle.plr.item && battle.plr.item.card.power,
    crit: battle.plr.item && battle.plr.item.card.crit,
    def: battle.plr.item && battle.plr.item.card.defense,
    prot: ABX.core.isProtected(battle.plr.item, "plr", "destroyed", { side: "opp" })
  })`));
  ok(r1b.flagId === 3941 && r1b.maxSize >= 1e9, "'The Chaos Upgrade' (#4072) flips #3941 face-up onto your Flag and sets maxSize to Infinity");
  ok(r1b.itemId === 3941 && r1b.pow === 15000 && r1b.crit === 2 && r1b.def === 5000, "#3941 on Flag has 15000 Power / 2 Crit / 5000 Defense and can attack");
  ok(r1b.prot === true, "#3941 on Flag cannot be destroyed by card effects");

  console.log("\n=== 2. Batch 1 Modal Judgment Calls (#2439, #5371, #5560, #6255) ===");
  // #2439 Option 1: highest power among all «Weapon» cards (Items + Monsters)
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Test", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    const weaponItem = Object.assign({}, CARD_MAP.get(15), { type: "Item", attrs: ["Weapon"], power: 5000 });
    const weaponMonster = Object.assign({}, CARD_MAP.get(46), { type: "Monster", attrs: ["Weapon"], power: 9000 });
    battle.plr.item = { card: weaponItem, rested: false, attacksLeft: 1, soul: [] };
    battle.plr.monsters.left = { card: weaponMonster, rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.center = { card: Object.assign({}, CARD_MAP.get(46), { defense: 8000, sg: false }), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.setSpells = [];
    ABX.fireSpell("plr", CARD_MAP.get(2439));
  }`);
  await wait(800);
  ok(env.run(`battle.opp.monsters.center === null`), "#2439 Option 1 evaluates against highest power among ALL «Weapon» cards on field (Monster 9000 > Opp Def 8000)");

  // #2439 Option 2: destroy all spells on opponent's field
  env.run(`{
    battle.opp.setSpells = [CARD_MAP.get(6007)];
    ABX.fireSpell("plr", CARD_MAP.get(2439));
  }`);
  await wait(300);
  ok(env.run(`battle.opp.setSpells.length === 0`), "#2439 Option 2 destroys all spells on opponent's field");

  // #5371 Ghost Story Cornet Loop: blocks Spells only, NOT Impacts
  env.run(`{
    battle.opp.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.left = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.right = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.fireSpell("plr", CARD_MAP.get(5371));
  }`);
  await wait(300);
  const r5371 = JSON.parse(env.run(`{
    const sampleSpell = ALL_CARDS.find(c => c.type === "Spell" && !c.set);
    const sampleImpact = ALL_CARDS.find(c => c.type === "Impact" && (!window.IMX || !IMX.isImpactMonster(c)));
    const spellCond = evaluateCardConditions(sampleSpell, battle.opp, battle.plr);
    const impactCond = evaluateCardConditions(sampleImpact, battle.opp, battle.plr);
    JSON.stringify({
      spellBlocked: !spellCond.met && spellCond.reasons.some(r => r.includes("Ghost Story Cornet Loop")),
      impactBlocked: impactCond.reasons.some(r => r.includes("Ghost Story Cornet Loop"))
    });
  }`));
  ok(r5371.spellBlocked, "#5371 Option 1 blocks Opponent from casting Spells ('Events')");
  ok(!r5371.impactBlocked, "#5371 Option 1 does NOT block Opponent from casting Impacts");

  // #5560 Melody of the Evil Moon: Option 2 caps life payment at (Current Life - 1) and reduces turn damage
  env.run(`{
    battle.plr.life = 4;
    battle.plr.r38ChosenLifePay = 99;
    battle.opp.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.left = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.fireSpell("plr", CARD_MAP.get(5560));
  }`);
  await wait(300);
  const r5560 = JSON.parse(env.run(`{
    const lifeAfterPay = battle.plr.life;
    const red = battle.plr.r38TurnDamageReduce;
    const dmgTaken = ABX.core.applyDamage("plr", 5, { kind: "attack" });
    battle.plr.life = 10;
    battle.plr.r38TurnDamageReduce = 0;
    delete battle.plr.r38ChosenLifePay;
    JSON.stringify({ lifeAfterPay, red, dmgTaken });
  }`));
  ok(r5560.lifeAfterPay === 1 && r5560.red === 3, "#5560 Option 2 caps life paid at (Current Life - 1) = 3 (leaving 1 life) and sets turn damage reduction to 3");
  ok(r5560.dmgTaken === 2, "#5560 turn damage reduction reduces 5 damage by 3 -> 2 damage");

  // #6255 First Ace (Medachange): affects Monsters ONLY, leaving equipped Items untouched
  env.run(`{
    const firstAceMedachange = CARD_MAP.get(6255);
    battle.plr.monsters.center = { card: firstAceMedachange, rested: false, attacksLeft: 1, soul: [] };
    battle.opp.item = { card: CARD_MAP.get(15), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.left = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.right = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [] };
    ABX.useAct("plr", firstAceMedachange, battle.plr.monsters.center);
  }`);
  await wait(300);
  const r6255 = JSON.parse(env.run(`JSON.stringify({
    oppLeft: battle.opp.monsters.left,
    oppRight: battle.opp.monsters.right,
    oppItemId: battle.opp.item && battle.opp.item.card.id,
    protDestroy: ABX.core.isProtected(battle.plr.monsters.center, "plr", "destroyed", { side: "opp" }),
    protRest: ABX.core.isProtected(battle.plr.monsters.center, "plr", "rest", { side: "opp" })
  })`));
  ok(!r6255.oppLeft && !r6255.oppRight && r6255.oppItemId === 15, "#6255 'Home Sick' returns all opponent Monsters ('Characters') to hand while leaving opponent's equipped Item untouched");
  ok(r6255.protDestroy && r6255.protRest, "#6255 cannot be destroyed or [Rest] by opponent's card effects");

  console.log("\n=== 3. Verbal / Joke / Physical Condition Cards (#907, #1795, #6068, #5021, #4148) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Test", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.monsters.center = { card: CARD_MAP.get(907), rested: false, attacksLeft: 1, soul: [] };
    window.__hBefore907 = battle.plr.hand.length;
    ABX.fireAttack("plr", [{ zone: "center", unit: battle.plr.monsters.center }], "opp", "fighter");
  }`);
  await wait(600);
  const r907 = JSON.parse(env.run(`{
    const drew = battle.plr.hand.length === window.__hBefore907 + 1;
    battle.activeSide = "opp";
    battle.plr.life = 10;
    const dmgTaken = ABX.core.applyDamage("plr", 3, { kind: "attack" });
    battle.activeSide = "plr";
    JSON.stringify({ drew, dmgTaken, life: battle.plr.life });
  }`));
  ok(r907.drew, "#907 Amigo Takata automatically draws 1 card on attack without UI prompt");
  ok(r907.dmgTaken === 2 && r907.life === 8, "#907 Amigo Takata automatically reduces 2+ damage taken during opponent's turn by 1 without UI prompt");

  // #1795 Buddyfight World Deity, (Self-Proclaimed) God Khoushan
  env.run(`{
    battle.plr.life = 10; battle.opp.life = 10;
    battle.plr.hand = [46]; battle.opp.hand = [];
    window.__oppGaugeBefore = battle.opp.gauge.length;
    battle.plr.monsters.left = { card: CARD_MAP.get(1795), rested: false, attacksLeft: 1, soul: [] };
    ABX.fireEnter("plr", CARD_MAP.get(1795), battle.plr.monsters.left);
  }`);
  await wait(300);
  const r1795 = JSON.parse(env.run(`JSON.stringify({
    plrLife: battle.plr.life,
    plrHand: battle.plr.hand.length,
    oppGaugeDelta: battle.opp.gauge.length - window.__oppGaugeBefore
  })`));
  ok(r1795.plrLife === 11 && r1795.plrHand === 0 && r1795.oppGaugeDelta === 1, "#1795 automatically executes for both players on enter (hand>=1 -> +1 life & discard 1; hand==0 -> +1 gauge)");

  // #6068 Prejudice Against Testers, Kibaou
  env.run(`{
    battle.plr.life = 10;
    battle.plr.monsters.right = { card: CARD_MAP.get(6068), rested: false, attacksLeft: 1, soul: [] };
    ABX.fireEnter("plr", CARD_MAP.get(6068), battle.plr.monsters.right);
  }`);
  await wait(300);
  ok(env.run(`battle.plr.life === 12`), "#6068 automatically treats 'Why!' as said and gains 2 life on enter");

  // #5021 Silver Soul Release, Deity Gargantua Dragon
  const r5021 = JSON.parse(env.run(`{
    const c5021 = CARD_MAP.get(5021);
    battle.plr.monsters.center = { card: c5021, rested: false, attacksLeft: 1, soul: [] };
    const st = getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center);
    JSON.stringify({ base: c5021.power, eff: st.power });
  }`));
  ok(r5021.eff === r5021.base + 10000, "#5021 Silver Soul Release hardcodes silver coating scraped out to true (+10000 Power)");

  // #4148 Crabgantua Punisher!!
  env.run(`{
    battle.plr.monsters.center = null;
    battle.opp.monsters.center = null;
    battle.opp.life = 10;
    window.__cond4148 = evaluateCardConditions(CARD_MAP.get(4148), battle.plr, battle.opp);
    ABX.fireSpell("plr", CARD_MAP.get(4148));
  }`);
  await wait(300);
  const r4148 = JSON.parse(env.run(`JSON.stringify({ met: window.__cond4148.met, oppLife: battle.opp.life })`));
  ok(r4148.met && r4148.oppLife === 6, "#4148 Crabgantua Punisher!! pre-fulfills 4 crab legs condition and deals 4 unnullifiable, unreducible damage");

  console.log("\n=== 4. Lost World (30-Card lostDeck) & Godclock (subFlags Array) ===");
  const r4 = JSON.parse(env.run(`{
    const lostDeckDef = generateFlagDeck(447, "Lost World Test", 571, true);
    const plrState = battle.createFighterState("Player", lostDeckDef, false);
    const gcDeckDef = generateFlagDeck(5957, "Godclock Test", 6065, false);
    const gcState = battle.createFighterState("Time Ruler", gcDeckDef, false);
    battle.start("hotseat", gcDeckDef, lostDeckDef);
    battle.executeClockFlipWithHandCard("plr", 0, 0, null, false);
    JSON.stringify({
      lostDeckBuilderLen: lostDeckDef.lostDeck.length,
      lostStateLen: plrState.lostDeck.length,
      isLostActive: plrState.isLostWorldActive,
      subFlagsLen: gcState.subFlags.length,
      subFlagIds: gcState.subFlags.map(s => s.id),
      flippedAfterClockI: battle.plr.subFlags.map(s => s.reversed)
    });
  }`));
  ok(r4.lostDeckBuilderLen === 30 && r4.lostStateLen === 30 && !r4.isLostActive, "Lost Deck is a distinct 30-card array transferred into fighterState.lostDeck separately from main deck until Belost resolves");
  ok(r4.subFlagsLen === 3 && r4.subFlagIds[0] === 5958 && r4.subFlagIds[1] === 5959 && r4.subFlagIds[2] === 5960, "Godclock flag automatically populates fighterState.subFlags with Clock-I (#5958), Clock-II (#5959), and Clock-III (#5960)");
  ok(r4.flippedAfterClockI[0] === true && r4.flippedAfterClockI[1] === false && r4.flippedAfterClockI[2] === false, "subFlags track their respective [Reversal] states independently");

  console.log("\n=== 5. Oppressed Areas (#4677, #4699, #4702, #6154) ===");
  env.run(`{
    battle.start("hotseat", generateFlagDeck(447, "Drametal Test", 571, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    battle.plr.monsters.left = { card: CARD_MAP.get(4677), rested: false, attacksLeft: 1, soul: [] };
    battle.plr.monsters.center = { card: CARD_MAP.get(4699), rested: false, attacksLeft: 1, soul: [] };
    battle.plr.item = { card: CARD_MAP.get(4702), rested: false, attacksLeft: 1, soul: [] };
    battle.opp.monsters.left = null;
    battle.opp.monsters.right = null;
    battle.plr.gauge = [46, 46, 46];
    ABX.useAct("plr", CARD_MAP.get(4677), battle.plr.monsters.left);
  }`);
  await wait(300);
  const r5a = JSON.parse(env.run(`{
    const oppLeft = battle.opp.monsters.left;
    const st = getUnitEffectiveCombatStats(battle.plr, oppLeft);
    JSON.stringify({
      plrLeftNull: battle.plr.monsters.left === null,
      inOppLeft: Boolean(oppLeft && oppLeft.card.id === 4677),
      oppressedBy: oppLeft && oppLeft.oppressedBy,
      oppressedAreaOwner: battle.opp.oppressedAreas.left,
      inPlrFieldUnits: getAllFieldUnits(battle.plr).includes(oppLeft),
      inOppFieldUnits: getAllFieldUnits(battle.opp).includes(oppLeft),
      basePow: CARD_MAP.get(4677).power,
      effPow: st.power,
      baseDef: CARD_MAP.get(4677).defense,
      effDef: st.defense
    });
  }`));
  ok(r5a.plrLeftNull && r5a.inOppLeft && r5a.oppressedBy === "plr" && r5a.oppressedAreaOwner === "plr", "#4677 Oppress moves monster into opponent's open left/right slot, frees your own slot, and marks oppressedBy='plr'");
  ok(r5a.inPlrFieldUnits && !r5a.inOppFieldUnits, "Monster in oppressed area counts as on YOUR field, not opponent's field");
  ok(r5a.effPow === r5a.basePow + 3000 && r5a.effDef === r5a.baseDef + 3000, "#4699 Bishop: Giallo Mace gives +3000 Power and +3000 Defense while you have an oppressed area");

  // #4702 Grandmaster Cane & #6154 Zug Zwang & #4677 End of Turn
  env.run(`{
    battle.opp.monsters.left.rested = true;
    battle.opp.life = 10;
    ABX.useAct("plr", CARD_MAP.get(4702), battle.plr.item);
  }`);
  await wait(300);
  const r5b = JSON.parse(env.run(`JSON.stringify({
    stood4677: battle.opp.monsters.left.rested === false,
    rested4702: battle.plr.item.rested === true,
    oppLife: battle.opp.life,
    zugZwangMet: evaluateCardConditions(CARD_MAP.get(6154), battle.plr, battle.opp).met
  })`));
  ok(r5b.stood4677 && r5b.rested4702 && r5b.oppLife === 9, "#4702 rests self to [Stand] a «Drametal» monster and deals 1 damage because it is on an oppressed area");
  ok(r5b.zugZwangMet, "#6154 Zug Zwang cast condition recognizes monster with 'Oppress' on oppressed area as on your field");

  env.run(`{
    battle.opp.monsters.left.rested = true;
    ABX.fireSpell("plr", CARD_MAP.get(6154));
    ABX.fireTurnEvent("turnEnd");
  }`);
  await wait(300);
  const r5c = JSON.parse(env.run(`JSON.stringify({
    stoodAfterZug: battle.opp.monsters.left.rested === false,
    oppLifeAfterZugAndEOT: battle.opp.life
  })`));
  ok(r5c.stoodAfterZug && r5c.oppLifeAfterZugAndEOT === 6, "#6154 Zug Zwang stands «Drametal» on oppressed area (+1 dmg -> 8) and #4677 deals 2 damage at end of turn (-> 6)");

  console.log("\n=== 6. [Ambush] Face-Down Soul Tracking ===");
  // Case A: Face-Up Ambush card in soul (e.g. standard soulcharge) -> does NOT trigger [Ambush]
  env.run(`{
    battle.start("hotseat", generateFlagDeck(258, "Ambush Test", 3617, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    window.__ambushCard = ALL_CARDS.find(c => c.amb && c.type === "Monster") || CARD_MAP.get(1867);
    const hostCard = Object.assign({}, CARD_MAP.get(46), { sg: true });
    battle.plr.monsters.center = { card: hostCard, rested: false, attacksLeft: 1, soul: [window.__ambushCard.id] };
    battle.plr.monsters.left = null;
    battle.plr.monsters.right = null;
    battle.destroyMonster("plr", "center");
  }`);
  await wait(800);
  ok(env.run(`battle.plr.monsters.left === null && battle.plr.monsters.right === null`), "Face-up [Ambush] card in soul does NOT trigger [Ambush] when sent to Drop Zone");

  // Case B: Face-Down Ambush card in soul ({ id, isFaceDown: true }) -> triggers [Ambush]!
  env.run(`{
    const hostCard = Object.assign({}, CARD_MAP.get(46), { sg: true });
    battle.plr.monsters.center = { card: hostCard, rested: false, attacksLeft: 1, soul: [createSoulEntry(window.__ambushCard.id, true)] };
    battle.plr.monsters.left = null;
    battle.plr.monsters.right = null;
    battle.destroyMonster("plr", "center");
  }`);
  await wait(800);
  const r6b = JSON.parse(env.run(`{
    const u = battle.plr.monsters.left || battle.plr.monsters.right;
    JSON.stringify({
      called: Boolean(u && u.card.id === window.__ambushCard.id),
      enteredByAmbush: Boolean(u && u.enteredByAmbush)
    });
  }`));
  ok(r6b.called && r6b.enteredByAmbush, "Face-down [Ambush] card in soul ({ isFaceDown: true }) triggers [Ambush] and calls itself to the field");

  console.log(`\n🎉 SUMMARY: ${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
