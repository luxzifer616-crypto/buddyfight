/* ==================== ABX — round 42: Legend Dragon tribe review fixes ====================
 * Per-card overrides found by tests/legend_dragon.js (same OV mechanism as r38/r40). Loaded after abilities_r41.js.
 *  #6138 King's Privilege: Fire / Water / Thunder are three INDEPENDENT conditions (damage 2 / gain 2 life / draw 2).
 *  #5527 Warrior of Zeal: no damage on enter; while in the center, deal 1 when another Legend Dragon attacks.
 *  #5418 Flame Deity: the [Triple Attack] grant needs "Ice Deity, Freeza Horus" (exact name) on your field.
 *  #5737 Magma/Freeza "SD": [Triple Attack] only if you buddy called during this fight.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core) return;
  const lc = (s) => String(s || "").toLowerCase();
  const np = (filter) => ({ qty: { n: 1, upTo: false, all: false, any: false, each: false }, ref: null, self: false, filter, zone: { owner: "you", area: "field" }, excludeSelf: false, topN: null, soulOf: null });
  const has = (filter) => ({ t: "has", owner: "you", np: np(filter), n: 1, other: false });

  const OV42 = [
    [6138, /if a «?fire»? is on your field/i, () => ({
      kind: "spell", once: "turn", steps: [
        { op: "damage", who: "opp", n: 2, cond: has({ tribes: ["Fire"] }) },
        { op: "life", who: "you", n: 2, cond: has({ tribes: ["Water"] }) },
        { op: "draw", who: "you", n: 2, cond: has({ tribes: ["Thunder"] }) }
      ]
    })],
    [5527, /if this card is in the center, when a «?legend dragon»? monster/i, () => ({
      kind: "triggered",
      trigger: { event: "otherAttack", np: np({ tribes: ["Legend Dragon"], types: ["monster"] }) },
      conds: [{ t: "selfPos", pos: "center" }],
      steps: [{ op: "damage", who: "opp", n: 1 }]
    })],
    [5418, /at the start of your attack phase/i, (ab) => ({
      kind: "triggered", trigger: ab.trigger || { event: "phaseStart", who: "you", phase: "attack" }, conds: [],
      steps: [Object.assign({}, (ab.steps || []).find(s => s.op === "boost"), { cond: has({ exactNames: ["ice deity, freeza horus"] }) })]
    })],
    [5737, /when this card attacks, if you buddy called/i, (ab) => ({
      kind: "triggered", trigger: { event: "attack", self: true }, once: "turn", conds: [{ t: "buddyCalledEver" }],
      steps: [{ op: "boost", np: { self: true, selfTail: "" }, mods: { power: 0, defense: 0, critical: 0, kws: ["triple attack"] } }]
    })]
  ];

  const prev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = prev.apply(this, arguments);
    try {
      if (!card || !r || !Array.isArray(r.abilities)) return r;
      if (!OV42.some(o => o[0] === card.id)) return r;
      r.abilities.forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "");
        const full = String(ab.raw || "");
        for (const [id, re, build] of OV42) {
          if (card.id !== id || !(re.test(raw) || re.test(full) || re.test(lc(raw)))) continue;
          const o = build(ab);
          if (!o) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.parsed = true; ab.r42 = true;
          if (o.once) ab.once = o.once;
          if (o.trigger) ab.trigger = o.trigger;
          if (o.conds !== undefined) ab.conds = o.conds;
          break;
        }
      });
    } catch (e) { /* keep the parsed card as is */ }
    return r;
  };
})(typeof window !== "undefined" ? window : globalThis);
