// [CHAOS Territory]: with such a monster on your center, a second monster can be called to your center ("center2").
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  env.run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true;
    { const f = battle.plr; ["left","center","right","center2"].forEach(p => { f.monsters[p] = null; battle.opp.monsters[p] = null; });
      f.gauge = f.deck.splice(0, 8); f.maxSize = 99; battle.activeSide = "plr"; battle.phase = "main";
      window.__mon = ALL_CARDS.find(c => c.type === "Monster" && c.size === 1 && /call cost/i.test(c.cost || ""));
      f.hand = [3849, __mon.id]; }`);
  await wait(1200);
  // without a [CHAOS Territory] monster there is no second center
  env.run(`battle.pendingAction = { type: "call", side: "plr", handIdx: 1, cardId: __mon.id }; battle.onZoneClick("plr", "center2")`);
  ok(!env.run(`!!battle.plr.monsters.center2`), "no [CHAOS Territory] on the center: center2 can't be used");
  env.run(`battle.pendingAction = null; battle.completeMonsterCall("plr", "center", battle.plr.hand.indexOf(3849), false)`);
  await wait(1500);
  ok(env.run(`hasChaosTerritory(battle.plr)`), "Mini Geargod Green (#3849) on the center turns on CHAOS Territory");
  // When only 1 [CHAOS Territory] monster is in the center and not calling a 2nd monster, it fits the slot at full normal size like Left/Right!
  const singleCenterHtml = env.run(`battle.renderCenterPairHtml("plr")`);
  ok(!singleCenterHtml.includes("chaos-pair") && singleCenterHtml.includes("field-card"), "lone [CHAOS Territory] monster fits the center slot normally like left/right slots");
  // When choosing to call a monster to the center, the existing card shifts left (chaos-left-half) and clicking 'center' calls to the right half (center2) connected together!
  env.run(`battle.pendingAction = { type: "call", side: "plr", handIdx: battle.plr.hand.indexOf(__mon.id), cardId: __mon.id }`);
  const callingPairHtml = env.run(`battle.renderCenterPairHtml("plr")`);
  ok(callingPairHtml.includes("chaos-left-half") && callingPairHtml.includes("chaos-right-half"), "while calling a 2nd monster to center, first card shifts left (chaos-left-half) and right half opens (chaos-right-half)");
  env.run(`battle.onZoneClick("plr", "center")`);
  await wait(1500);
  const r = JSON.parse(env.run(`JSON.stringify({ c2: battle.plr.monsters.center2 && battle.plr.monsters.center2.card.id, units: ABX.core.fieldUnits(battle.plr, false).length,
    pos: battle.plr.monsters.center2 ? ABX.core.posOfUnit(battle.plr, battle.plr.monsters.center2) : null,
    onCenter: battle.plr.monsters.center2 ? ABX.core.evalCond({ t: "selfPos", pos: "center" }, { side: "plr", f: battle.plr, e: battle.opp, unit: battle.plr.monsters.center2, bind: {} }) : null })`));
  ok(r.c2 === JSON.parse(env.run(`__mon.id`)) && r.units === 2, `clicking center calls the second monster to the right half (center2 ${r.c2}, units ${r.units})`);
  ok(r.pos === "center2" && r.onCenter === true, `the engine counts it as "on your center" (${r.pos}, ${r.onCenter})`);
  // the opponent can attack it; destroying it leaves the first at full slot size again
  env.run(`battle._destroyByAttack = false; battle.destroyMonster("plr", "center2")`);
  await wait(1200);
  ok(!env.run(`!!battle.plr.monsters.center2`) && env.run(`!!battle.plr.monsters.center`), "center2 can be destroyed on its own; the first stays");
  // the first leaves: the second moves up to the center and fits the full slot
  env.run(`battle.plr.monsters.center2 = { card: __mon, rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 }; battle.destroyMonster("plr", "center")`);
  await wait(1500);
  const afterLeaveHtml = env.run(`battle.renderCenterPairHtml("plr")`);
  ok(env.run(`!!battle.plr.monsters.center && !battle.plr.monsters.center2 && battle.plr.monsters.center.card.id === __mon.id`) && !afterLeaveHtml.includes("chaos-pair"), "the first leaves: the second moves up to the center and fits the slot normally");
  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
