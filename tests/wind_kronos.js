// "Wind Kronos" (Time Ruler Dragon #5955 / #5956 / #6065): the soul is filled up to 1 / 2 at the start of your turn and
// never past it. The old "Use Card Ability" button used to run the same line again, once per turn, with no limit.
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const owns = JSON.parse(env.run(`JSON.stringify([5955, 5956, 6065].map(id => abxOwnsOptionalLines(CARD_MAP.get(id))))`));
  ok(owns.every(Boolean), `the old ability button is not offered: ABX runs Wind Kronos itself (${owns})`);

  for (const [id, cap] of [[6065, 2], [5956, 2], [5955, 1]]) {
    env.run(`battle.start("hotseat", generateFlagDeck(5957,"T",6065,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true;
      { const f = battle.plr; ["left","center","right"].forEach(p => f.monsters[p] = null);
        f.drop = ALL_CARDS.filter(c => c.type === "Monster").slice(0, 10).map(c => c.id);
        f.gauge = f.deck.splice(0, 5); f.hand.push(${id}); battle.activeSide = "plr"; battle.phase = "main";
        battle.completeMonsterCall("plr", "center", f.hand.indexOf(${id}), false); }`);
    await wait(1500);
    const seen = [];
    for (let t = 0; t < 4; t++) {
      env.run(`battle.plr.monsters.center && battle.plr.monsters.center.soul.splice(0, ${t === 2 ? 99 : 0})`);   // turn 3: soul emptied (e.g. by [Soulguard])
      env.run(`battle.startTurn("${t % 2 ? "opp" : "plr"}")`);
      await wait(1500);
      seen.push(+env.run(`battle.plr.monsters.center ? battle.plr.monsters.center.soul.length : -1`));
    }
    ok(seen.every(n => n === cap), `#${id}: soul stays at ${cap} over 4 turn starts and refills after being emptied (${seen})`);
  }
  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
