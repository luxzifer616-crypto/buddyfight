/* ==================== ABX — round 16: abilities that work from inside a soul ====================
 * Next family from tests/coverage.js: "If this card is in the soul of X, that X gets ..." (41 cards).
 * Monsters already ran these as continuous abilities. Spells that put themselves into a soul ("Put this card into the
 * soul of a «Wild Dragon» ... If this card is in the soul of a «Wild Dragon», that monster gets [Move] and [Soulguard].")
 * did not: the second line was read as a one-time part of the spell, so it ran once when cast (on whatever was chosen)
 * and never applied while the card sat in the soul.
 *  1. On a Spell, a line that starts "If / When this card is in the soul of X" is a continuous ability of the card while
 *     it is in that soul; "that monster / that card / it" is the card whose soul holds it.
 *  2. "When this card is in the soul of X, ..." is the same as "If this card is in the soul of X, ...".
 * Loaded after abilities_r15.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;

  const SOUL_LINE = /^(?:\[[^\]]+\]\s*)*(?:if|when|while) this card is in (?:the )?soul of\b/i;
  const HOST_WORDS = /^(?:that|the) (?:monster|card|item|character|«[^»]+»(?: monster)?)$|^it$|^that (?:[A-Z][\w ]+)$/i;

  // 2. "When this card is in the soul of X, ..." -> "If this card is in the soul of X, ..."
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = String(rawLine || "").replace(/^((?:\[[^\]]+\]\s*)*)when this card is in (the )?soul of\b/i, "$1If this card is in $2soul of");
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    return ab;
  };

  // 1. soul lines of a Spell are continuous abilities of the card in the soul
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      if (!card || card.type !== "Spell" || !r) return r;
      (r.abilities || []).forEach(ab => {
        if (ab.kind !== "spell" || !SOUL_LINE.test(ABX.clean(ab.raw || ""))) return;
        if (ab.unparsed && ab.unparsed.length) return;
        const soulCond = (ab.conds || []).concat((ab.steps || []).map(s => s.cond)).find(c => c && c.t === "selfInSoulOf");
        if (!soulCond) return;
        (ab.steps || []).forEach(s => {
          if (s.op === "boost" && s.np && !s.np.self && (s.np.ref === "chosen" || s.np.ref === "that") && HOST_WORDS.test(String(s.np.raw || "").trim())) {
            s.np = Object.assign({}, s.np, { ref: "host" });
            if (!s.cond) s.cond = soulCond;
          }
        });
        ab.kind = "static";
        ab.r16soul = true;
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
