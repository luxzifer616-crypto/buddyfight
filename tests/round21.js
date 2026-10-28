// Round 21 tests: Dragon Force & [Release Condition!] completeness, costReduceFor, alsoTreatedAs, D-Share, and new triggers/ops.
const assert = require("assert");
const { createEnv } = require("./headless.js");
const env = createEnv();

const res = JSON.parse(env.run(`(function(){
  ABX.fast = true;
  ABX.autoPlay = true;
  const log = [];
  const check = (name, ok, detail) => { log.push({ name, ok: !!ok, detail }); };

  // 1. All 31 Dragon Force / [Release Condition!] cards have 0 unbuilt abilities
  const SKIP = new Set(["cost", "keyword", "reminder"]);
  const isOK = (c, a) => ABX.isExecutable(a) || (a.kind === "rule" && (!a.unparsed || !a.unparsed.length) && a.parsed !== false) || (ABX.ownsStaticLine && ABX.ownsStaticLine(c, a.raw || ""));
  const badDf = [];
  ALL_CARDS.forEach(c => {
    if (/dragon force|release condition/i.test(c.name + " " + (c.skill || ""))) {
      const abs = (ABX.get(c).abilities || []).filter(a => !SKIP.has(a.kind));
      if (abs.some(a => !isOK(c, a))) badDf.push(c.id);
    }
  });
  check("All 31 Dragon Force / [Release Condition!] cards are 100% built", badDf.length === 0, badDf);

  // 2. Final phase attack on #2396 Dragon Force, #2509 Style of the Straight Fist, #2669 Style of Impact
  battle.start("hotseat", generateFlagDeck(447, "T", 571, true), generateFlagDeck(447, "O", 571, true));
  battle.renderBattle = function(){};
  const f = battle.plr, e = battle.opp;
  ["left", "center", "right"].forEach(p => { f.monsters[p] = null; e.monsters[p] = null; });
  f.item = null; e.item = null; f.drop = []; e.drop = [];
  const df2396 = CARD_MAP.get(2396);
  f.item = { card: df2396, rested: false, attacksLeft: 1, soul: [] };
  check("#2396 Dragon Force can attack in Final Phase", battle.imCanAttackInFinal(f.item) === true);

  // 3. Name aliasing (alsoTreatedAs) on #4169 Jackknife "Granthese" and #297 Super Lethal Formation
  const c4169 = CARD_MAP.get(4169);
  const c297 = CARD_MAP.get(297);
  check("#4169 Jackknife 'Granthese' matches 'Jackknife Gold Ritter'",
    ABX.core.matchFilter(c4169, { names: ["jackknife gold ritter"] }, null, { side: "plr", f, e }));
  check("#297 Super Lethal Formation matches 'Secret Sword, Lethal Formation'",
    ABX.core.matchFilter(c297, { names: ["secret sword, lethal formation"] }, null, { side: "plr", f, e }));

  // 4. Continuous cost reductions: #4170 Future Force "DX" (-2 on Impact when buddy on field) & #82 Zagan (-1 on Magic World Spell)
  const dx4170 = CARD_MAP.get(4170);
  const imp3Gauge = ALL_CARDS.find(c => c.type === "Impact" && /\\[Cast Cost\\]\\s*\\[Pay 3 gauge\\]/i.test((c.cost || "") + " " + (c.skill || "")));
  f.item = { card: dx4170, rested: false, attacksLeft: 1, soul: [] };
  f.buddyCalled = false;
  const costNoBuddy = parseCardCost(imp3Gauge.cost, imp3Gauge.skill, f, imp3Gauge);
  f.buddyCalled = true;
  f.buddyId = 46;
  f.monsters.left = { card: CARD_MAP.get(46), rested: false, attacksLeft: 1, soul: [], isBuddyGift: true };
  const costWithDx = parseCardCost(imp3Gauge.cost, imp3Gauge.skill, f, imp3Gauge);
  check("#4170 Future Force 'DX' reduces Impact gauge cost by 2 when buddy is on field (3 -> 1)",
    costNoBuddy.gauge === 3 && costWithDx.gauge === 1, { costNoBuddy: costNoBuddy.gauge, costWithDx: costWithDx.gauge });

  const zagan82 = CARD_MAP.get(82);
  f.monsters.center = { card: zagan82, rested: false, attacksLeft: 1, soul: [] };
  const mwSpell = ALL_CARDS.find(c => c.type === "Spell" && c.world === "Magic World" && /\\[Cast Cost\\]\\s*\\[Pay 1 gauge\\]/i.test(c.cost + " " + c.skill));
  const mwCost = parseCardCost(mwSpell.cost, mwSpell.skill, f, mwSpell);
  check("#82 Demon Sommerlier, Zagan reduces Magic World spell gauge cost by 1 (1 -> 0)", mwCost.gauge === 0, mwCost.gauge);

  // 5. Reactive life-0 equip on #2675 Dragon Force, "Style of Retaliation"
  f.item = null;
  f.monsters = { left: null, center: null, right: null };
  const abygale = ALL_CARDS.find(c => c.type === "Monster" && /abygale/i.test(c.name));
  f.drop = [abygale.id];
  f.gauge = [1, 2, 3];
  f.hand = [2675, 46];
  f.life = 2;
  ABX.core.applyDamage("plr", 5, { kind: "attack" });
  check("#2675 Style of Retaliation reactively equips at 0 life, sets life to 1, and pays 2 gauge + 1 hand card",
    f.life === 1 && f.item && f.item.card.id === 2675 && f.gauge.length === 1 && f.hand.length === 0,
    { life: f.life, item: f.item && f.item.card.id, gauge: f.gauge.length, hand: f.hand.length });

  return JSON.stringify(log);
})()`));

let failed = 0;
res.forEach(r => {
  if (r.ok) console.log("ok:", r.name);
  else { console.error("FAIL:", r.name, r.detail); failed++; }
});
assert.strictEqual(failed, 0, `${failed} test(s) failed`);
console.log("ALL PASSED");
