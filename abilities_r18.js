/* ==================== ABX — round 18: "for each" counts ====================
 * Next family from tests/coverage.js (38 cards). The counts themselves ("each other «X» on your field", "each «Dragod» in
 * your buddy zone", "each different «Fire» in your drop zone") were already readable; these wordings around them were not:
 *  1. SIZE: "This card('s size) on the field (gets size / is) reduced by N for each X", "Reduce the size of this card on
 *     the field by N for each X", "For each X, this card's size on the field is reduced by N" (counted by core.countEach in
 *     ABX.sizeDelta).
 *  2. OWN COST: "The gauge cost written in this card's [Cast Cost] / [Equip Cost] / [Call Cost] is reduced by N for each X".
 *  3. STATS: "This card gets power+1000 and defense+1000, for each card in this card's soul" (the comma hid the count).
 * Loaded after abilities_r17.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core;
  const { F, otherSide } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const num = (w) => { const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10); return isNaN(n) ? null : n; };

  /* ---- 3. "..., for each X" -> "... for each X" on stat lines ---- */
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = String(rawLine || "").replace(/(\bgets? (?:power|defense|critical)[+-]\d+(?:,? and (?:power|defense|critical)[+-]\d+)*),\s+for each\b/gi, "$1 for each");
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    return ab;
  };

  /* ---- 1 + 2: rules ---- */
  const A18 = [];
  const sizeEach = (n, what) => { const np = NP("each " + what); return np ? { op: "static", kind: "sizeMod", delta: -num(n), each: np } : null; };
  A18.push([/^(?:this card's size on (?:the|your) field|this card on (?:the|your) field gets size|this card gets size|the size of this card on (?:the|your) field|this card's size) (?:is |gets )?reduced by (\d+),? for each (.+)$/i, (m) => sizeEach(m[1], m[2]), false]);
  A18.push([/^reduce the size of this card on (?:the|your) field by (\d+) for each (.+)$/i, (m) => sizeEach(m[1], m[2]), false]);
  A18.push([/^for each (.+?), (?:this card's size on (?:the|your) field|the size of this card on (?:the|your) field) is reduced by (\d+)$/i, (m) => sizeEach(m[2], m[1]), false]);
  A18.push([/^the gauge cost written in this card's \[(cast|equip|call) cost\] is reduced by (\d+) for each (.+)$/i, (m) => {
    const np = NP("each " + m[3]); if (!np) return null;
    return { op: "static", kind: "selfCostEach", what: m[1].toLowerCase(), n: num(m[2]), each: np };
  }, false]);
  ABX.ACTION_RULES.unshift(...A18);

  // On a Spell the cost line was read as part of the spell (kind "spell"): it isn't something the spell does when cast,
  // and as an unrunnable spell part it also kept the engine from running the spell's real text.
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        if (ab.kind === "spell" && (ab.steps || []).length === 1 && (ab.steps[0].kind === "selfCostEach" || (ab.steps[0].kind === "sizeMod" && ab.steps[0].each))) ab.kind = "static";
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  // the cost reader applies "this card's cost is reduced by N for each X"; report these abilities as runnable
  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && (ab.steps || []).length === 1 && ab.steps[0].kind === "selfCostEach" && !(ab.unparsed && ab.unparsed.length) && (ab.conds || []).every(ABX.condExecutable)) return true;
    if (ab && ab.kind === "static" && (ab.steps || []).length === 1 && ab.steps[0].kind === "sizeMod" && ab.steps[0].each && !(ab.unparsed && ab.unparsed.length) && (ab.conds || []).every(ABX.condExecutable)) return true;
    return isExecPrev.apply(this, arguments);
  };

  const KIND = { Spell: "cast", Impact: "cast", Item: "equip", Monster: "call" };
  if (typeof root.parseCardCost === "function") {
    const pcc = root.parseCardCost;
    root.parseCardCost = function (costStr, skill, fighter, card) {
      const r = pcc.apply(this, arguments);
      try {
        if (!r || !fighter || !card || !(r.gauge > 0)) return r;
        const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
        if (!side) return r;
        let cut = 0;
        core.abilitiesOf(card, a => a.kind === "static" && (a.steps || []).some(x => x.kind === "selfCostEach")).forEach(ab => {
          const st = ab.steps.find(x => x.kind === "selfCostEach");
          if (st.what !== KIND[card.type]) return;
          const ctx = { side, f: fighter, e: F(otherSide(side)), card, unit: null, bind: {} };
          if (!(ab.conds || []).every(c => core.evalCond(c, ctx))) return;
          cut += (st.n || 1) * core.countEach(st.each, ctx);
        });
        if (cut > 0) return Object.assign({}, r, { gauge: Math.max(0, r.gauge - cut), abxEachCut: cut });
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
