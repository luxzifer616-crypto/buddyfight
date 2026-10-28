// #5116 Vile Demonic Husk Deity Dragon, Vanity End Destroyer: one check per definition in ability_definitions.md.
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const S = () => JSON.parse(env.run(`(function(){ const f = battle.plr, u = f.monsters.center;
  return JSON.stringify({ hand: f.hand.length, deck: f.deck.length, soul: u && u.card.id === 5116 ? u.soul.length : null, life: f.life, over: !!battle.matchOver, result: battle.__result || null }); })()`));
const nextTurn = async (side) => { env.run(`battle.phase = "end"; battle.turnCount++; battle.startTurn("${side}")`); await wait(1500); };

(async () => {
  const setup = (handN) => env.run(`battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true;
    battle.matchOver = false; battle.__result = null; battle.finishMatch = function (won, why) { battle.matchOver = true; battle.__result = { won, why }; };
    { const f = battle.plr; ["left","center","right"].forEach(p => { f.monsters[p] = null; battle.opp.monsters[p] = null; });
    f.callLimitUsed = {}; f.gauge = f.deck.splice(0, 6); f.hand = f.deck.splice(0, ${handN}); f.hand.push(5116); battle.activeSide = "plr"; battle.phase = "main"; }`);
  // battle.start queues its own turn-start events: let them finish before calling
  const call = async () => { await wait(1200); env.run(`battle.completeMonsterCall("plr", "center", battle.plr.hand.indexOf(5116), false)`); await wait(2500); };

  // 1. once per game
  setup(3);
  const deck0 = S().deck;
  await call();
  let s = S();
  ok(s.soul !== null, "it can be called");
  env.run(`battle.plr.monsters.center = null; battle.plr.hand.push(5116); battle.completeMonsterCall("plr", "center", battle.plr.hand.indexOf(5116), false)`);
  await wait(1500);
  ok(!env.run(`!!battle.plr.monsters.center`), "1. a second copy cannot be called in the same game");

  // 2 + 3: call cost (3 hand cards) and enter (whole deck)
  setup(3);
  await wait(1200);
  const before = S();
  await call();
  s = S();
  ok(s.hand === 0, `2. every hand card went into its soul (hand ${before.hand - 1} -> ${s.hand})`);
  ok(s.deck === 0, `3. the entire deck went into its soul (deck ${before.deck} -> ${s.deck})`);
  ok(s.soul === before.hand - 1 + before.deck, `2+3. soul = hand + deck = ${before.hand - 1} + ${before.deck} (${s.soul})`);
  setup(0);
  await call();
  ok(S().soul !== null, "2. with an empty hand it can still be called");

  // 4a. cannot lose: empty deck and 0 life while it is on the field; you lose once it leaves
  setup(3);
  await call();
  env.run(`battle.checkWinCondition()`);
  ok(!S().over, "4a. an empty deck does not lose while it is on the field");
  env.run(`battle.plr.life = 0; battle.checkWinCondition()`);
  ok(!S().over, "4a. life 0 does not lose while it is on the field");
  env.run(`battle.plr.monsters.center = null; battle.checkWinCondition()`);
  s = S();
  ok(s.over && s.result && s.result.won === false, `4a. once it leaves the field, you lose (${JSON.stringify(s.result)})`);

  // 4b. opponent cannot drop its souls or nullify its abilities; your own effects still can drop
  setup(3);
  await call();
  const soulB = S().soul;
  await env.run(`ABX.OPS.dropSoul.run({ op: "dropSoul", n: 2, hostNP: Object.assign(ABX.parseNP("a card on your opponent's field"), { qty: { n: 1, all: true } }) },
    { side: "opp", f: battle.opp, e: battle.plr, card: ALL_CARDS.find(c => c.type === "Spell"), unit: null, bind: { chosen: [] } })`);
  await wait(300);
  ok(S().soul === soulB, `4b. the opponent's effect cannot drop its souls (${soulB} -> ${S().soul})`);
  ok(env.run(`ABX.core.isProtected(battle.plr.monsters.center, "plr", "nullified", { side: "opp", card: ALL_CARDS.find(c => c.type === "Spell") })`) === true, "4b. the opponent's effect cannot nullify its abilities");
  ok(env.run(`ABX.core.isProtected(battle.plr.monsters.center, "plr", "souls dropped", { side: "plr", card: ALL_CARDS.find(c => c.type === "Spell") })`) === false, "4b. your own effects are not stopped");

  // 5. Dimension Door: 1 soul into your hand at the start of each player's turn; nothing when the soul is empty
  setup(3);
  await call();
  s = S();
  await nextTurn("opp");
  const s1 = S();
  ok(s1.hand === s.hand + 1 && s1.soul === s.soul - 1, `5. opponent's turn start: 1 soul into your hand (hand ${s.hand} -> ${s1.hand}, soul ${s.soul} -> ${s1.soul})`);
  await nextTurn("plr");
  const s2 = S();
  ok(s2.soul === s1.soul - 1 && !s2.over, `5. your turn start: 1 more soul into your hand, and drawing from an empty deck doesn't lose (soul ${s1.soul} -> ${s2.soul}, hand ${s1.hand} -> ${s2.hand})`);
  env.run(`battle.plr.monsters.center.soul = []`);
  const s3 = S();
  await nextTurn("opp");
  ok(S().hand === s3.hand, "5. with an empty soul nothing happens");

  // 6-8. keywords
  const kw = JSON.parse(env.run(`JSON.stringify((c => ({ ta: !!c.ta, sg: !!c.sg, llLose: !!c.ll_lose }))(CARD_MAP.get(5116)))`));
  ok(kw.ta && kw.sg && kw.llLose, `6-8. [Triple Attack] [Soulguard] [Lifelink Lose] are set (${JSON.stringify(kw)})`);

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
