// First round: the first player does not draw in the start phase (only Charge & Draw). Later turns still draw 1.
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  env.run(`battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); ABX.autoPlay = true; ABX.fast = true; battle.renderBattle = function(){};`);
  await wait(800);
  const first = env.run(`battle.activeSide`), turn = env.run(`battle.turnCount`);
  const hand0 = env.run(`battle.${first}.hand.length`);
  ok(turn === 1, "game starts on turn 1");
  ok(hand0 === 6, "turn 1: first player hand is the opening 6 (no start-phase draw), got " + hand0);
  // Charge & Draw still works on turn 1
  env.run(`battle.phase = "main"; battle.${first}.chargedThisTurn = false; battle.executeChargeAndDraw("${first}", 0);`); await wait(800);
  ok(env.run(`battle.${first}.hand.length`) === 6 && env.run(`battle.${first}.gauge.length`) >= 1, "turn 1: Charge & Draw still charges 1 and draws 1");
  // turn 2 (other player) draws normally
  env.run(`battle.endTurn();`); await wait(1500);
  const other = first === "plr" ? "opp" : "plr";
  ok(env.run(`battle.turnCount`) === 2 && env.run(`battle.${other}.hand.length`) === 7, "turn 2: other player draws 1 (hand 7), got " + env.run(`battle.${other}.hand.length`));
  console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
})();
