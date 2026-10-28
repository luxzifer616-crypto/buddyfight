// [Move] protects the fighter like a [Counter] spell: when you are attacked directly and your center is open, a monster
// with [Move] on your left / right can move into the center and take the attack. "cannot [Move]" cards stop it.
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const setup = (botDefends) => env.run(`battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true;
    ["plr","opp"].forEach(s => { ["left","center","right"].forEach(p => battle[s].monsters[p] = null); battle[s].item = null; battle[s].hand = []; });
    window.__mk = (id) => ({ card: CARD_MAP.get(id), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 });
    battle.plr.monsters.left = __mk(298);   // Accelerate Ninja, Hayate: [Move]
    battle.opp.monsters.center = __mk(ALL_CARDS.find(c => c.type === "Monster" && c.size === 1 && !c.move && (c.power || 0) >= 3000 && !/when this card attacks/i.test(c.skill || "")).id);
    battle.activeSide = "opp"; battle.phase = "attack"; battle.plr.life = 10;
    battle.plr.isBot = ${!!botDefends};`);

  setup(false);
  let r = JSON.parse(env.run(`JSON.stringify(battle.getAvailableDefenseCards("plr", false, "fighter", [battle.opp.monsters.center]).filter(o => o.moveFrom).map(o => o.moveFrom))`));
  ok(r.length === 1 && r[0] === "left", `attacked directly, center open: [Move] from the left is offered (${r})`);
  r = JSON.parse(env.run(`JSON.stringify(battle.getAvailableDefenseCards("plr", false, "left", [battle.opp.monsters.center]).filter(o => o.moveFrom).length)`));
  ok(r === 0, `not offered when a monster (not you) is attacked (${r})`);

  env.run(`battle.applyMoveBlock("plr", "left", "opp", ["center"], "fighter")`);
  await wait(1500);
  r = JSON.parse(env.run(`JSON.stringify({ left: !!battle.plr.monsters.left, center: battle.plr.monsters.center ? battle.plr.monsters.center.card.id : (battle.plr.drop.includes(298) ? "destroyed" : null), life: battle.plr.life })`));
  ok(!r.left && (r.center === 298 || r.center === "destroyed") && r.life === 10, `the block moves it to the center, it takes the attack, you take no damage (${JSON.stringify(r)})`);

  // "During the attack phase, all monsters on your opponent's field cannot [Move]" (#2672) stops the block
  setup(false);
  env.run(`battle.opp.item = __mk(2672)`);
  r = JSON.parse(env.run(`JSON.stringify(battle.getAvailableDefenseCards("plr", false, "fighter", [battle.opp.monsters.center]).filter(o => o.moveFrom).length)`));
  ok(r === 0, `#2672 on the attacker's side: no [Move] block (${r})`);

  // the bot blocks when its life is low
  setup(true);
  env.run(`battle.plr.life = 4; battle.initiateAttackWithDefenseCheck("opp", ["center"], "fighter")`);
  await wait(2000);
  r = JSON.parse(env.run(`JSON.stringify({ left: !!battle.plr.monsters.left, life: battle.plr.life })`));
  ok(!r.left && r.life === 4, `bot at 4 life blocks with [Move] (${JSON.stringify(r)})`);

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
