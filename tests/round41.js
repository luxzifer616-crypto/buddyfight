// Round 41 Behavioral Verification Suite:
// Tests all 4 user-ruled groups and every one of the final 19 cards (20 ability blocks):
// 1. Rock-Paper-Scissors (Janken) 3-button modal + 5-second auto-pick timer & all RPS cards (#171, #226, #762, #1119, #1321, #1331, #1549, #3245, #4265, #6083)
// 2. Card Guessing, Declaration, Shuffle-Pick & Smart Probability Bot Logic (#208, #3487, #5211, #5214, #5217, #6203, #6209, #6479)
// 3. Real-World Calendar & Tournament Joke Cards (#4430 July/August date check via new Date().getMonth() + 1 & fallback-true)
// 4. Special Mechanic Challenges (Top-Deck <= 10,000 Power Sum Challenge & Buddyfight "the 10th anniversary" 3-option modal [Counter])
const { createEnv } = require("./headless.js");
const env = createEnv();

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log("  ✅ PASS:", msg); }
  else { fail++; console.error("  ❌ FAIL:", msg); }
}

(async () => {
  env.run(`
    battle.start("hotseat", generateFlagDeck(1, "Plr", 46, false), generateFlagDeck(447, "Opp", 571, false));
    ABX.autoPlay = true;
    window.__resetBoard = function() {
      const f = battle.plr, e = battle.opp;
      ["left", "center", "right", "center2"].forEach(p => { f.monsters[p] = null; e.monsters[p] = null; });
      f.item = null; f.item2 = null; e.item = null; e.item2 = null;
      f.setSpells = []; e.setSpells = [];
      f.hand = []; e.hand = [];
      f.drop = []; e.drop = [];
      f.gauge = [46, 46, 46, 46, 46, 46];
      e.gauge = [571, 571, 571, 571];
      f.deck = [46, 46, 46, 46, 46, 46, 46, 46, 46, 46];
      e.deck = [571, 571, 571, 571, 571, 571, 571, 571];
      f.life = 10; e.life = 10;
      battle.activeSide = "plr";
      battle.phase = "main";
      battle.matchOver = false;
      ABX.forceRpsResult = null;
      ABX.forceRpsSequence = null;
      ABX.forceDeclaredType = null;
      ABX.forceRandomPickIdx = null;
      ABX.forceOppHandPickIdx = null;
    };
  `);

  console.log("=== 1. Rock-Paper-Scissors (3-Button Modal, 5s Timer & All 10 RPS Cards) ===");

  // 1a. Verify 5-second auto-pick timer on ABX.ui.pickOption when idle
  const timerPromise = env.run(`
    ABX.autoPlay = false;
    ABX.hooks.pickOption = null;
    ABX.ui.pickOption({
      title: "RPS Test",
      subtitle: "Choose hand",
      options: [{ label: "✊ Rock" }, { label: "✋ Paper" }, { label: "✌️ Scissors" }],
      timeoutMs: 5000
    });
  `);
  env.flush();
  const resolvedTimerIdx = await timerPromise;
  env.run(`ABX.autoPlay = true;`);
  assert([0, 1, 2].includes(resolvedTimerIdx), `5-second idle auto-pick timer resolves a valid RPS option (${resolvedTimerIdx})`);

  // 1b. #171 Armorknight Sphinx: [Counter] [Act] on left/right when attacked directly -> pay 1 gauge -> win RPS -> nullify attack
  const r171 = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr;
    const c171 = CARD_MAP.get(171);
    f.monsters.left = { card: c171, rested: false, attacksLeft: 1, soul: [] };
    ABX.battleCtx = { active: true, nullified: false };
    ABX.forceRpsResult = "win";
    const ab = ABX.get(c171).abilities.find(a => a.kind === "act");
    await ABX.core.runAbility("plr", c171, ab, f.monsters.left, {});
    return JSON.stringify({ gauge: f.gauge.length, nullified: ABX.battleCtx.nullified });
  })()`));
  assert(r171.gauge === 5 && r171.nullified === true, `#171 Armorknight Sphinx pays 1 gauge and nullifies the direct attack on RPS win (gauge=${r171.gauge}, nullified=${r171.nullified})`);

  // 1c. #226 Big Surprise Pandora: destroyed -> RPS only once -> draw deals 1 damage to BOTH players
  const r226 = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr, e = battle.opp;
    const c226 = CARD_MAP.get(226);
    ABX.forceRpsResult = "tie";
    const ab = ABX.get(c226).abilities.find(a => a.kind === "triggered");
    await ABX.core.runAbility("plr", c226, ab, null, {});
    return JSON.stringify({ plrLife: f.life, oppLife: e.life });
  })()`));
  assert(r226.plrLife === 9 && r226.oppLife === 9, `#226 Big Surprise Pandora deals 1 damage to both players on an RPS draw (plr=${r226.plrLife}, opp=${r226.oppLife})`);

  // 1d. #762 Death Game & #1321 Mysterious Decarabia (enter + pay 2 gauge replay)
  const r762_1321 = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr, e = battle.opp;
    e.monsters.center = { card: CARD_MAP.get(571), rested: false, attacksLeft: 1, soul: [] };
    e.monsters.left = { card: CARD_MAP.get(571), rested: false, attacksLeft: 1, soul: [] };
    ABX.forceRpsResult = "win";
    const c762 = CARD_MAP.get(762);
    await ABX.core.runAbility("plr", c762, ABX.get(c762).abilities.find(a => a.kind === "spell"), null, {});
    const after762 = !!e.monsters.center && !!e.monsters.left;
    const c1321 = CARD_MAP.get(1321);
    const replayAb = ABX.get(c1321).abilities.find(a => a.kind === "act");
    await ABX.core.runAbility("plr", c1321, replayAb, null, {});
    return JSON.stringify({ after762, oppRemaining: ABX.core.fieldUnits(e, false).length, gaugeLeft: f.gauge.length });
  })()`));
  assert(r762_1321.after762 === false && r762_1321.oppRemaining === 0 && r762_1321.gaugeLeft === 4, `#762 Death Game and #1321 Mysterious Decarabia (2-gauge replay) destroy opponent field cards on RPS win`);

  // 1e. #1119 Judge Asmodai's 3 Rounds RPS (2 wins + 1 loss -> draw 2; 0 wins + 3 losses -> opponent draws 3)
  const r1119 = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr, e = battle.opp;
    const c1119 = CARD_MAP.get(1119);
    const ab = ABX.get(c1119).abilities.find(a => a.kind === "spell");
    ABX.forceRpsSequence = ["win", "lose", "win"];
    await ABX.core.runAbility("plr", c1119, ab, null, {});
    const plrHandAfter2Wins = f.hand.length;
    ABX.forceRpsSequence = ["lose", "lose", "lose"];
    await ABX.core.runAbility("plr", c1119, ab, null, {});
    return JSON.stringify({ plrHandAfter2Wins, oppHandAfter3Losses: e.hand.length });
  })()`));
  assert(r1119.plrHandAfter2Wins === 2 && r1119.oppHandAfter3Losses === 3, `#1119 Judge Asmodai's 3 Rounds draws 2 on 2 wins and makes opponent draw 3 on 3 losses`);

  // 1f. #1331 Dead or Alive!, #1549 Purgatory Block, #3245 Gagnar, #4265 XL Pandora & #6083 DUEL
  const rRpsRest = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr, e = battle.opp;
    f.deck = [1331, 46, 46, 46, 46, 46];
    ABX.forceRpsResult = "win";
    const c1331 = CARD_MAP.get(1331);
    await ABX.core.runAbility("plr", c1331, ABX.get(c1331).abilities.find(a => a.kind === "spell"), null, {});
    const doaSearched = f.hand.includes(1331) && e.life === 7;

    const c1549 = CARD_MAP.get(1549);
    f.monsters.left = { card: c1549, rested: false, attacksLeft: 1, soul: [] };
    await ABX.core.runAbility("plr", c1549, ABX.get(c1549).abilities[0], f.monsters.left, {});
    const purgatoryOk = !f.monsters.left && f.drop.includes(1549) && e.life === 5;

    const c3245 = CARD_MAP.get(3245);
    f.monsters.center = { card: c3245, rested: false, attacksLeft: 1, soul: [] };
    await ABX.core.runAbility("plr", c3245, ABX.get(c3245).abilities.find(a => a.kind === "act"), f.monsters.center, {});
    const gagnarDA = f.monsters.center.tempDA === true && f.monsters.center.attacksLeft === 2;

    const c4265 = CARD_MAP.get(4265);
    await ABX.core.runAbility("plr", c4265, ABX.get(c4265).abilities.find(a => a.kind === "triggered"), null, {});
    const xlPandoraOk = e.life === 2;

    const c6083 = CARD_MAP.get(6083);
    await ABX.core.runAbility("plr", c6083, ABX.get(c6083).abilities.find(a => a.kind === "spell"), null, {});
    const duelOk = e.life === -1;

    return JSON.stringify({ doaSearched, purgatoryOk, gagnarDA, xlPandoraOk, duelOk });
  })()`));
  assert(rRpsRest.doaSearched && rRpsRest.purgatoryOk && rRpsRest.gagnarDA && rRpsRest.xlPandoraOk && rRpsRest.duelOk, `#1331 Dead or Alive!, #1549 Purgatory Block, #3245 Gagnar, #4265 XL Pandora, and #6083 DUEL all resolve accurately`);

  console.log("\n=== 2. Card Guessing, Declaration, Shuffle-Pick & Smart Probability Bot Logic ===");

  // 2a. Verify Smart Bot Probability Calculation (#5211 Conan, #5214 Heiji, #5217 Shinichi, #6209 Captain Answer, #6479 Takosuke)
  const rGuess = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr, e = battle.opp;
    const spellId = ALL_CARDS.find(c => c.type === "Spell").id;
    const monId = ALL_CARDS.find(c => c.type === "Monster").id;
    // Put 3 Spells in opponent's hand -> smart bot MUST declare "spell" (highest probability = 3/3 = 100%)
    e.hand = [spellId, spellId, spellId];

    // #5211 Seeking the Truth, Conan Edogawa -> deals 5 unreducible damage when opponent's chosen hand card matches declared type
    const c5211 = CARD_MAP.get(5211);
    await ABX.core.runAbility("plr", c5211, ABX.get(c5211).abilities[0], null, {});
    const conan5211Dmg = e.life === 5;

    // #6479 Martian UFO, Takosuke "Re:B" -> pays 1 life, declares "spell" (3 in opp hand) -> deals 2 dmg AND draws 2 cards!
    const handBefore6479 = f.hand.length;
    const c6479 = CARD_MAP.get(6479);
    await ABX.core.runAbility("plr", c6479, ABX.get(c6479).abilities.find(a => a.kind === "act"), null, {});
    const takosukeOk = f.life === 9 && e.life === 3 && f.hand.length === handBefore6479 + 2;

    // #5217 Shinichi Kudo -> attacks, declares "spell" -> opponent drops 1 Spell from hand (3 -> 2)
    const c5217 = CARD_MAP.get(5217);
    await ABX.core.runAbility("plr", c5217, ABX.get(c5217).abilities.find(a => a.kind === "triggered"), null, {});
    const shinichiAtkOk = e.hand.length === 2;

    // #5214 Heiji Hattori -> opponent's deck is all Monsters -> smart bot declares "monster", mills top card, drops 1 from opp hand, deals 2 dmg
    e.deck = [monId, monId, monId];
    const c5214 = CARD_MAP.get(5214);
    await ABX.core.runAbility("plr", c5214, ABX.get(c5214).abilities.find(a => a.kind === "triggered"), null, {});
    const heijiOk = e.hand.length === 1 && e.life === 1;

    // #6209 Mirror Hero, Captain Answer "Answer Question!!" -> both decks have Monsters -> smart bot declares "monster", gets [Quadruple Attack] & destroys all opponent field cards!
    f.deck = [monId, monId];
    e.deck = [monId, monId];
    e.monsters.center = { card: CARD_MAP.get(monId), rested: false, attacksLeft: 1, soul: [] };
    const c6209 = CARD_MAP.get(6209);
    f.monsters.center = { card: c6209, rested: false, attacksLeft: 1, soul: [] };
    await ABX.core.runAbility("plr", c6209, ABX.get(c6209).abilities.find(a => a.kind === "act"), f.monsters.center, {});
    const cap6209Ok = f.monsters.center.tempQA === true && f.monsters.center.attacksLeft === 4 && !e.monsters.center;

    return JSON.stringify({ conan5211Dmg, takosukeOk, shinichiAtkOk, heijiOk, cap6209Ok });
  })()`));
  assert(rGuess.conan5211Dmg && rGuess.takosukeOk && rGuess.shinichiAtkOk && rGuess.heijiOk && rGuess.cap6209Ok, `Smart probability bot & declaration abilities (#5211, #5214, #5217, #6209, #6479) calculate exact zone probabilities and resolve all effects`);

  // 2b. Verify Shuffle-Pick cards (#208 Dangerous Fuse, #3487 Charismatic Asmodai, #6203 Gargantua Evolution)
  const rShufflePick = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr;
    // #208 Dangerous Fuse: top 2 cards have different names; force random pick = 0 (matches revealed card 0) -> both go to hand!
    f.deck = [46, 571, 46, 46];
    ABX.forceRandomPickIdx = 0;
    const c208 = CARD_MAP.get(208);
    await ABX.core.runAbility("plr", c208, ABX.get(c208).abilities[0], null, {});
    const fuseMatchHand = f.hand.length === 2;

    // #208 Dangerous Fuse: force random pick = 1 (different name) -> both go to gauge!
    f.deck = [46, 571, 46, 46];
    const gBefore = f.gauge.length;
    ABX.forceRandomPickIdx = 1;
    await ABX.core.runAbility("plr", c208, ABX.get(c208).abilities[0], null, {});
    const fuseMissGauge = f.gauge.length === gBefore + 2;

    // #3487 Charismatic Demon Lord Teacher, Asmodai: 2 distinct monsters in drop -> calls the randomly picked one!
    f.drop = [46, 571];
    ABX.forceRandomPickIdx = 0;
    const c3487 = CARD_MAP.get(3487);
    await ABX.core.runAbility("plr", c3487, ABX.get(c3487).abilities[0], null, {});
    const charismagicCalled = ABX.core.fieldUnits(f, false).some(r => r.card.id === 46);

    // #6203 Gargantua Evolution: 3 distinct [G.BOOST] monsters in deck -> 1 to hand, 2 to drop, deck shuffled!
    const gboostMons = ALL_CARDS.filter(c => c.type === "Monster" && /\\[g\\.boost/i.test(c.skill || ""));
    const gb3 = [];
    const seen = new Set();
    for (const c of gboostMons) { if (!seen.has(c.name)) { seen.add(c.name); gb3.push(c.id); if (gb3.length === 3) break; } }
    f.hand = []; f.drop = []; f.deck = [...gb3, 46, 571];
    ABX.forceRandomPickIdx = 1;
    const c6203 = CARD_MAP.get(6203);
    await ABX.core.runAbility("plr", c6203, ABX.get(c6203).abilities.find(a => a.kind === "spell"), null, {});
    const gargaEvoOk = f.hand.length === 1 && f.hand[0] === gb3[1] && f.drop.length === 2;

    return JSON.stringify({ fuseMatchHand, fuseMissGauge, charismagicCalled, gargaEvoOk });
  })()`));
  assert(rShufflePick.fuseMatchHand && rShufflePick.fuseMissGauge && rShufflePick.charismagicCalled && rShufflePick.gargaEvoOk, `#208 Dangerous Fuse, #3487 Charismatic Asmodai, and #6203 Gargantua Evolution shuffle-pick mechanics work in all outcomes`);

  console.log("\n=== 3. Real-World Calendar Date Check (#4430 Summer With Ace of Games! Yuga & Garga 'SD') ===");
  const r4430 = JSON.parse(env.run(`(() => {
    __resetBoard();
    const f = battle.plr;
    const c4430 = CARD_MAP.get(4430);
    f.monsters.center = { card: c4430, rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };

    ABX.mockMonth = 7; // July
    const julyStats = getUnitEffectiveCombatStats(f, f.monsters.center);

    ABX.mockMonth = 10; // October
    const octStats = getUnitEffectiveCombatStats(f, f.monsters.center);
    ABX.mockMonth = null;

    return JSON.stringify({
      basePow: c4430.power,
      baseCrit: c4430.crit,
      julyPow: julyStats.power,
      julyDef: julyStats.defense,
      julyCrit: julyStats.crit,
      octPow: octStats.power,
      octCrit: octStats.crit
    });
  })()`));
  assert(r4430.julyPow === r4430.basePow + 3000 && r4430.julyCrit === r4430.baseCrit + 3 && r4430.octPow === r4430.basePow, `#4430 Yuga & Garga "SD" grants +3000/+3000/+3 in July/August (${r4430.julyPow}/${r4430.julyDef}/${r4430.julyCrit}) and base stats in other months (${r4430.octPow})`);

  console.log("\n=== 4. Special Mechanic Challenges (Top-Deck <= 10,000 Power Sum & 10th Anniversary 3-Option Modal) ===");
  const rSpecial = JSON.parse(await env.run(`(async () => {
    __resetBoard();
    const f = battle.plr, e = battle.opp;
    const m4000 = ALL_CARDS.find(c => c.type === "Monster" && c.power === 4000).id;
    const m5000 = ALL_CARDS.find(c => c.type === "Monster" && c.power === 5000).id;
    const m3000 = ALL_CARDS.find(c => c.type === "Monster" && c.power === 3000).id;
    f.deck = [m4000, m5000, m3000]; // 4000 + 5000 = 9000 <= 10000 (stops before 3000 would make 12000)
    e.deck = [m3000, m3000, m3000]; // 3000 + 3000 + 3000 = 9000 <= 10000
    const ctx = { side: "plr", f, e, card: CARD_MAP.get(20) };
    await ABX.OPS.r41TopDeckPowerSumChallenge.run({ ceiling: 10000, maxCards: 3, damageOnWin: 2 }, ctx);

    // 10th Anniversary 3-option modal (Option 1: return drop to deck +2 life +1 draw; Option 2: +10000/+10000/+1 to buddy-attr; Option 3: recycle 2 monsters/items)
    f.drop = [46, 571, 46];
    const lifeBefore = f.life;
    await ABX.OPS.r41TenthAnniversaryCounter.run({ optionIdx: 0 }, ctx);
    const opt1Ok = f.life === lifeBefore + 2;

    f.buddyId = 46;
    f.monsters.center = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
    await ABX.OPS.r41TenthAnniversaryCounter.run({ optionIdx: 1 }, ctx);
    const opt2Ok = f.monsters.center.tempPower === 10000 && f.monsters.center.tempDef === 10000 && f.monsters.center.tempCrit === 1;

    f.drop = [46, 571];
    const handBeforeOpt3 = f.hand.length;
    await ABX.OPS.r41TenthAnniversaryCounter.run({ optionIdx: 2 }, ctx);
    const opt3Ok = f.hand.length === handBeforeOpt3 + 2;

    return JSON.stringify({ mySum: ctx.myPowerSum, oppSum: ctx.oppPowerSum, opt1Ok, opt2Ok, opt3Ok });
  })()`));
  assert(rSpecial.mySum === 9000 && rSpecial.oppSum === 9000 && rSpecial.opt1Ok && rSpecial.opt2Ok && rSpecial.opt3Ok, `Top-deck <= 10,000 power sum challenge (${rSpecial.mySum} vs ${rSpecial.oppSum}) and 10th Anniversary 3-option modal [Counter] all pass`);

  console.log(`\n🎉 ROUND 41 SUMMARY: ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})();
