/* ==================== ABX — round 28: Dragon World, next batch ====================
 * Built to ability_definitions_dragon_world.md:
 *  - "a monster (with "X" in its card name) on your field used [Move] during this turn" (condition; #4244, #6324)
 *  - "for this turn, nullify the [Penetrate] of the attacking cards" (#5405; read in getUnitEffectiveCombatStats)
 *  - wording fixes: #1493, #4671 ([G EVO] enter), #5334 («Thunder Empire»),
 *    #5594 ("If all of them have different card names" as a whole sentence)
 * Loaded after abilities_r27.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, matchFilter } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };

  const RW = [
    [/\bif you put it into your hand, you take\b/gi, "if you put it, you take"],
    [/\bduring your attack phase, if a monster enters your field by \[g ?\.?evo\]/gi, "During your attack phase, when a monster enters your field by [G EVO]"],
    [/\bif another thunder empire would leave your field\b/gi, "If another «Thunder Empire» would leave your field"],
  ];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };

  /* ---- rules ---- */
  ABX.ACTION_RULES.unshift(
    // whole sentence, or the "If all of them …," part is taken as a condition first
    [/^if all of them have different card names, put all of those cards (?:in)?to your hand$/i, () => ({ op: "distinctToHand" }), true],
    [/^(?:for this turn, )?nullify the \[(penetrate|double attack|triple attack|counterattack)\] of the attacking cards$/i, (m) => ({ op: "loseKwAttackers", kw: m[1].toLowerCase() }), false]
  );
  OPS.loseKwAttackers = {
    run(s, ctx) {
      const bc = ABX.curBattle || ABX.battleCtx, us = (bc && bc.attUnits) || [];
      us.forEach(u => { u.abxLost = u.abxLost || {}; u.abxLost[s.kw] = B.turnCount; });
      return us.length > 0;
    },
    check: () => true
  };
  if (typeof root.getUnitEffectiveCombatStats === "function") {
    const gues = root.getUnitEffectiveCombatStats;
    root.getUnitEffectiveCombatStats = function (fighter, unit) {
      const r = gues.apply(this, arguments);
      try {
        if (r && unit && ABX.kwLost) {
          if (ABX.kwLost(unit, "penetrate")) r.pen = false;
          if (ABX.kwLost(unit, "counterattack")) r.ca = false;
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  /* ---- condition: used [Move] this turn ---- */
  const XC = ABX.extraCond = ABX.extraCond || {};
  XC.xMovedThisTurn = (c, ctx) => core.fieldUnits(ctx.f, false).some(x => x.unit.abxMovedTurn === B.turnCount && (!c.np || matchFilter(x.unit.card, c.np.filter || {}, { unit: x.unit, side: ctx.side }, ctx)));
  ABX.COND_OK.add("xMovedThisTurn");
  ABX.COND_RULES.unshift([/^(?:a |an )?monsters?(?: with ("[^"]+") in its card name)? on your field used \[move\] (?:during|for) this turn$/i,
    (m) => ({ t: "xMovedThisTurn", np: m[1] ? NP("a monster with " + m[1] + " in its card name") : null })]);

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
