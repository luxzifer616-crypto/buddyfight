/* ==================== ABX — round 19: conditions after "Then," / "If you do," ====================
 * Next family from tests/coverage.js: chained sentences ("Then, if X, Y." / "If you do, ... if X, Y."). The lead-in was
 * already peeled off; the condition behind it was what stayed unread. Wordings added here:
 *  1. NUMBERS: "your life is five or less", "twenty-five or more" (number words / hyphenated), "oppponent" typo,
 *     "this is during your opponent's turn", "the drop zone" for the opponent's own drop zone.
 *  2. ITEM SOULS: "your item(s) has/have souls", "an «X» item on your field has (three or more) souls", "that item has
 *     souls", "there is a card with two or more souls on your field".
 *  3. THE CARD JUST HANDLED: "that card / the chosen card / the destroyed monster / the card put into your drop zone ..."
 *     + "is (not) a «X» spell", "has "X" in its card name", "is "Name"", "is size 2 or less", "is on the field",
 *     "is in the center", "'s critical is 0", "has 0 defense", "has 4 or more critical".
 *  4. MOVED / REVEALED GROUPS: "all cards put into your drop zone were «X»", "all the cards put were monsters",
 *     "there are three or more «X» monsters revealed".
 *  5. TURN COUNTS: "you took damage during this turn", "your opponent's cards attack N times or more during this turn".
 * Loaded after abilities_r18.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core;
  const { F, lc, otherSide, cardOf, isMonsterCard } = core;
  const XC = ABX.extraCond = ABX.extraCond || {};
  const addOk = (...ts) => ts.forEach(t => ABX.COND_OK.add(t));
  const stripEnd = (t) => String(t || "").trim().replace(/[.!]+$/, "").trim();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const CMP = (w) => /less|fewer|below/i.test(w) ? "le" : /more|greater|higher|above/i.test(w) ? "ge" : "eq";
  const cmpN = (v, c) => c.cmp === "le" ? v <= c.n : c.cmp === "eq" ? v === c.n : v >= c.n;

  /* ---- 1. number words -> digits (outside quotes / «» / []), so the older rules read them ---- */
  const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };
  const WORD_RE = new RegExp("\\b(?:(" + Object.keys(TENS).join("|") + ")(?:-(" + Object.keys(ONES).join("|") + "))?|(" + Object.keys(ONES).join("|") + "))\\b(?= or (?:more|less|fewer|greater)| times?\\b| (?:cards?|life|gauge|souls?|monsters?|damage)\\b)", "gi");
  const digits = (t) => String(t).split(/("[^"]*"|«[^»]*»|\[[^\]]*\])/).map((p, i) => i % 2 ? p : p.replace(WORD_RE, (m, tn, on, o) => String(tn ? TENS[lc(tn)] + (on ? ONES[lc(on)] : 0) : ONES[lc(o)]))).join("");
  const N = (w) => { const n = parseInt(digits(w + " or more"), 10); return isNaN(n) ? (/^an?$/i.test(w) ? 1 : NaN) : n; };
  const NUM = "(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";

  /* ---- the card the previous steps handled ---- */
  const lastRef = (ctx) => [].concat(ctx.bind.lastMoved || [], ctx.bind.revealed || [], ctx.bind.chosen || []).filter(x => x && x.card).pop();
  function refStat(r, stat) {
    if (r.unit && r.side) {
      const f = F(r.side);
      if (stat === "size") return typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, r.card) : r.card.size;
      if (typeof getUnitEffectiveCombatStats === "function") { const s = getUnitEffectiveCombatStats(f, r.unit); return stat === "critical" ? s.crit : s[stat]; }
    }
    return stat === "critical" ? (r.card.crit || 0) : (r.card[stat] || 0);
  }
  XC.xRefStat = (c, ctx) => { const r = lastRef(ctx); return !!r && cmpN(refStat(r, c.stat), c); };
  XC.xRefWhere = (c, ctx) => {
    const r = lastRef(ctx); if (!r || !r.unit) return false;
    const pos = core.posOfUnit(F(r.side), r.unit);
    return c.pos ? pos === c.pos : !!pos;
  };
  // every card the last step moved matches ("all cards put into your drop zone were «X»")
  XC.xAllMoved = (c, ctx) => {
    const m = (ctx.bind.lastMoved || []).filter(x => x && x.card);
    return m.length > 0 && m.every(r => c.type === "monster" ? isMonsterCard(r.card) : core.matchFilter(r.card, c.np.filter || {}, r, ctx));
  };
  XC.xRevealedCount = (c, ctx) => cmpN((ctx.bind.revealed || []).filter(r => r && r.card && core.matchFilter(r.card, c.np.filter || {}, r, ctx)).length, c);
  // any card on your field (monster or item) with N or more souls
  XC.xAnySoul = (c, ctx) => core.fieldUnits(ctx.f, true).some(x => (x.unit.soul || []).length >= c.n);
  addOk("xRefStat", "xRefWhere", "xAllMoved", "xRevealedCount", "xAnySoul");

  const A19 = [];
  const cr = (re, fn) => A19.push([re, fn]);
  const REF = "(?:the|that) (?:chosen |destroyed |revealed |dropped |discarded |called |returned |put )?(?:card|monster|character|item|spell|«[^»]+»(?: monster| item)?)(?: \\[stand\\]| (?:put|dropped|discarded|returned) (?:into|to) (?:your|the|their) (?:drop zone|hand|soul)| that was (?:called|destroyed|put|dropped)| destroyed)?";

  /* 3. the card just handled */
  cr(new RegExp("^" + REF + "(?:'s| has) (power|defense|critical|size) (?:is |of )?(\\d+)(?: or (more|less|greater))?$", "i"), (m) => ({ t: "xRefStat", stat: lc(m[1]), n: +m[2], cmp: m[3] ? CMP(m[3]) : "eq" }));
  cr(new RegExp("^" + REF + " has (\\d+)(?: or (more|less|greater))? (power|defense|critical)$", "i"), (m) => ({ t: "xRefStat", stat: lc(m[3]), n: +m[1], cmp: m[2] ? CMP(m[2]) : "eq" }));
  cr(new RegExp("^" + REF + " is size (\\d+)(?: or (more|less|greater))?$", "i"), (m) => ({ t: "xRefStat", stat: "size", n: +m[1], cmp: m[2] ? CMP(m[2]) : "eq" }));
  cr(new RegExp("^" + REF + " is (?:still )?on (?:the|your|your opponent's) field$", "i"), () => ({ t: "xRefWhere" }));
  cr(new RegExp("^" + REF + " is (?:in|on) (?:the |your |your opponent's )?(center|left|right)$", "i"), (m) => ({ t: "xRefWhere", pos: lc(m[1]) }));
  cr(new RegExp("^" + REF + " has (\"[^\"]+\"(?:,? (?:or|and) \"[^\"]+\")*(?:, \"[^\"]+\")*(?:,? or \"[^\"]+\")?) in its card name$", "i"), (m) => { const np = NP("a card with " + m[1] + " in its card name"); return np ? { t: "xRefIs", np } : null; });
  cr(new RegExp("^" + REF + " is (\"[^\"]+\")$", "i"), (m) => { const np = NP(m[1]); return np ? { t: "xRefIs", np } : null; });
  cr(new RegExp("^" + REF + " is (not )?(?:a |an )?(.+)$", "i"), (m) => {
    const w = m[2].trim().replace(/ card$/i, "");
    const tp = w.match(/^(monster|spell|item|impact)$/i);
    const c = tp ? { t: "refType", type: lc(tp[1]) } : (() => { const np = NP(/^[«"\[]/.test(w) ? w : "a " + w); return np ? { t: "xRefIs", np } : null; })();
    return c ? (m[1] ? { t: "not", c } : c) : null;
  });

  /* 4. moved / revealed groups */
  cr(/^all (?:the |of the )?cards put(?: into (?:your|the) drop zone| (?:on|into) .+?)? (?:were|are) (monsters|«[^»]+»(?: monsters)?|"[^"]+")$/i, (m) => {
    if (/^monsters$/i.test(m[1])) return { t: "xAllMoved", type: "monster" };
    const np = NP(m[1]); return np ? { t: "xAllMoved", np } : null;
  });
  cr(new RegExp("^there (?:is|are) " + NUM + " or more (.+?) revealed$", "i"), (m) => { const np = NP(m[2]); return np ? { t: "xRevealedCount", np, n: N(m[1]), cmp: "ge" } : null; });

  /* 2. item souls */
  cr(/^(?:your|that|the) items? (?:has|have) souls?$/i, () => ({ t: "xItemSoul", host: NP("item"), what: null, n: 1 }));
  cr(new RegExp("^(?:an?|your|that) (.+? )?items? (?:on your field )?(?:has|have) (?:" + NUM + " or more )?souls?$", "i"), (m) => {
    const host = NP(((m[1] || "").trim() + " item").trim()); return host ? { t: "xItemSoul", host, what: null, n: m[2] ? N(m[2]) : 1 } : null;
  });
  cr(new RegExp("^there (?:is|are) (?:a|an) (?:card|monster|item) with " + NUM + " or more souls? on your field$", "i"), (m) => ({ t: "xAnySoul", n: N(m[1]) }));

  /* 5. turn counts */
  cr(/^you (?:took|have taken|were dealt) damage (?:during|in) this turn$/i, () => ({ t: "xDamageTaken", n: 1 }));
  cr(/^your opponent's cards attack(?:ed)? (\d+) times or more (?:during|in) this turn$/i, (m) => ({ t: "oppAttackCount", n: +m[1] }));

  // 1. "you or your opponent has N or more cards in the drop zone"
  cr(/^you or your opponent ha(?:s|ve) (\d+) or (more|less) cards in (?:the|their|your) (drop zone|gauge|hand)$/i, (m) => ({ t: "or", list: ["you", "opp"].map(who => ({ t: "xZoneCount", who, area: lc(m[3]), kind: null, n: +m[1], cmp: CMP(m[2]) })) }));

  const pcPrev = ABX.parseCondition;
  let depth = 0;
  ABX.parseCondition = function (text) {
    const r = pcPrev.apply(this, arguments);
    if (r || depth > 2) return r;
    const t0 = stripEnd(ABX.norm(text)).replace(/^(?:if|while)\s+/i, "");
    if (!t0 || t0.length > 260) return null;
    depth++;
    try {
      const t = digits(t0).replace(/\boppponent\b/gi, "opponent").replace(/^(?:this|it) is (during )/i, "$1");
      for (const [re, fn] of A19) {
        const m = t.match(re); if (!m) continue;
        let c = null; try { c = fn(m); } catch (e) { c = null; }
        if (c && !(c.np === null) && !(c.host === null)) return c;
      }
      if (t !== t0) {
        // "your opponent has 25 or more cards in the drop zone": the drop zone is theirs
        const t2 = /^your opponent\b/i.test(t) ? t.replace(/ in the (drop zone|gauge|hand)$/i, " in their $1") : t;
        const c = ABX.parseCondition(t2);
        if (c) return c;
      } else if (/^your opponent\b.* in the (drop zone|gauge|hand)$/i.test(t)) {
        return ABX.parseCondition(t.replace(/ in the (drop zone|gauge|hand)$/i, " in their $1"));
      }
      return null;
    } finally { depth--; }
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
