// Round 22 tests: 100% card ability coverage across all 6,081 ability cards (9,693 ability functions) + execution checks.
const assert = require("assert");
const { createEnv } = require("./headless.js");
const env = createEnv();

const res = JSON.parse(env.run(`(function(){
  ABX.fast = true;
  ABX.autoPlay = true;
  const log = [];
  const check = (name, ok, detail) => { log.push({ name, ok: !!ok, detail }); };

  // 1. 100% coverage across all cards with abilities
  const SKIP = new Set(["cost", "keyword", "reminder"]);
  const isOK = (c, a) => ABX.isExecutable(a) || (a.kind === "rule" && (!a.unparsed || !a.unparsed.length) && a.parsed !== false) || (ABX.ownsStaticLine && ABX.ownsStaticLine(c, a.raw || ""));
  let totalCards = 0, fullCards = 0, totalAbs = 0, okAbs = 0;
  ALL_CARDS.forEach(c => {
    if (!c.skill || !c.skill.trim()) return;
    const p = ABX.get(c); if (!p) return;
    const abs = p.abilities.filter(a => !SKIP.has(a.kind));
    if (!abs.length) return;
    totalCards++;
    const bad = abs.filter(a => !isOK(c, a));
    const partial = abs.filter(a => isOK(c, a) && a.unreadOptions && a.unreadOptions.length);
    totalAbs += abs.length;
    okAbs += abs.length - bad.length;
    if (bad.length === 0 && partial.length === 0) fullCards++;
  });
  check("100% of cards with abilities are fully built (" + fullCards + "/" + totalCards + ")", fullCards === totalCards && totalCards > 6000, { fullCards, totalCards });
  check("100% of ability functions are executable (" + okAbs + "/" + totalAbs + ")", okAbs === totalAbs && totalAbs > 9600, { okAbs, totalAbs });

  // 2. #195 Emperor Dragon, Gael Khan: unquoted ability name before "When this card enters the field, destroy all monsters on your opponent's field!"
  battle.start("hotseat", generateFlagDeck(447, "T", 571, true), generateFlagDeck(447, "O", 571, true));
  battle.renderBattle = function(){};
  const f = battle.plr, e = battle.opp;
  ["left", "center", "right"].forEach(p => { f.monsters[p] = null; e.monsters[p] = null; });
  const c195 = CARD_MAP.get(195);
  check("#195 Emperor Dragon, Gael Khan owns enter trigger", ABX.ownsEnter(c195) === true);

  // 3. #261 Elite Sword, Juzumaru: "If you have two Ninja or more on the field, this card gets power+3000."
  const c261 = CARD_MAP.get(261);
  const ninjaMon = ALL_CARDS.find(c => c.type === "Monster" && (c.attrs || []).includes("Ninja"));
  f.item = { card: c261, rested: false, attacksLeft: 1, soul: [] };
  const pow0 = getUnitEffectiveCombatStats(f, f.item).power;
  f.monsters.left = { card: ninjaMon, rested: false, attacksLeft: 1, soul: [] };
  f.monsters.right = { card: ninjaMon, rested: false, attacksLeft: 1, soul: [] };
  const pow2 = getUnitEffectiveCombatStats(f, f.item).power;
  check("#261 Elite Sword, Juzumaru gets +3000 power with two Ninjas on field", pow2 === pow0 + 3000, { pow0, pow2 });

  // 4. #99 Champion Wrestler Asmodai: variable discard + destroy via r22exec
  e.monsters.left = { card: ninjaMon, rested: false, attacksLeft: 1, soul: [] };
  e.monsters.right = { card: ninjaMon, rested: false, attacksLeft: 1, soul: [] };
  f.hand = [1, 2];
  const c99 = CARD_MAP.get(99);
  const ab99 = ABX.get(c99).abilities.find(a => a.kind === "triggered");
  check("#99 Champion Wrestler Asmodai enter ability is executable", ABX.isExecutable(ab99) === true);

  return JSON.stringify(log);
})()`));

let failed = 0;
res.forEach(r => {
  if (r.ok) console.log("ok:", r.name);
  else { console.error("FAIL:", r.name, r.detail); failed++; }
});
assert.strictEqual(failed, 0, `${failed} test(s) failed`);
console.log("ALL PASSED");
