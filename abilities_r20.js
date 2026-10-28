/* ==================== ABX — round 20: continuous protections ====================
 * Biggest family among the partly-working cards (tests/coverage.js): "X cannot be destroyed, returned to hand or [Rest],
 * and its souls cannot be dropped, by your opponent's card effects". core.isProtected already enforced most kinds; the
 * sentences were not read when they joined several protections, or named a subject / kind the old rules did not know:
 *  1. ONE SENTENCE, SEVERAL PROTECTIONS: "... cannot be destroyed or returned to hand and its souls cannot be dropped
 *     and its critical cannot be reduced, by your opponent's card effects" -> one protect step with every kind.
 *  2. SUBJECTS: "this card (on the field)", "this card and all «X»", "the «X» with this card in its soul" (the soul's
 *     host), "abilities of X", "souls in / of X", "this card's power and critical", "the power, defense and critical of X".
 *  3. NEW KINDS: "souls dropped" (checked by OPS.dropSoul: protected souls are not offered) and "<stat> reduced"
 *     (checked through ABX.statLocked).
 *  4. "by monster effects" / "by the effect of a monster": only a monster's effect is stopped (engine: s.byMonster).
 * Only continuous (static) abilities are rewritten; "for this turn, the chosen card cannot ..." stays a one-shot effect.
 * Loaded after abilities_r19.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core;
  const { F, lc, otherSide } = core;
  const OPS = ABX.OPS;
  const stripEnd = (t) => String(t || "").trim().replace(/[.!]+$/, "").trim();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };

  const BY_RE = /,?\s+by (?:the effects? of (?:a |an |your opponent's )?monsters?|(?:your opponent's |the opponent's |opponent's |effects from your opponent's )?(?:(card|monster) )?(?:effects?|abilities)|an effect|card effects)/gi;
  const STAT = "(?:power|defense|critical)";
  const STATS = "(" + STAT + "(?:(?:,\\s*|,? and |,? or )" + STAT + ")*)";
  const statList = (s) => (String(s).match(/power|defense|critical/gi) || []).map(x => lc(x) + " reduced");

  // the protected cards: { self } | { np } | { self, np } | { host, np }
  function subjectOf(x) {
    x = ABX.norm(x).trim().replace(/^(?:all |the )/i, "").trim();
    let m;
    if (/^(?:this card|this monster|this item|this)(?: on (?:the|your) field)?$/i.test(x)) return { self: true };
    if ((m = x.match(/^(?:this card|this monster)(?: on (?:the|your) field)? and (?:all |the )?(.+)$/i))) { const s = subjectOf(m[1]); return s && s.np && !s.self && !s.host ? { self: true, np: s.np } : null; }
    if ((m = x.match(/^(?:a |an |the )?(.+?) with this card in its soul$/i))) { const np = NP(m[1]); return np ? { host: true, np } : null; }
    if (/\b(?:that|chosen|those|it|they|them|this card's)\b/i.test(x)) return null;
    if (/\bopponent's\b/i.test(x)) return null;   // protecting the opponent's cards is not a protection of yours
    const np = NP(/ on (?:your|the) |\bin your (?:center|left|right)\b/i.test(x) ? x : x + " on your field");
    if (!np || np.ref || np.self) return null;
    return { np };
  }

  // The protections named by one clause list ("cannot be destroyed or returned to hand and its souls cannot be dropped")
  const KIND_WORDS = [
    [/\b(?:abilities|ability) (?:cannot be )?nullified\b|\bhave (?:its|their) abilities nullified\b|\b(?:its|their) abilities cannot be nullified\b/gi, ["nullified"]],
    [/\b(?:souls?|the souls? of those cards) cannot (?:be )?(?:dropped|put (?:in)?to (?:the|your) drop zone|sent to the drop zone|returned to (?:the )?deck)(?: or (?:dropped|returned to (?:the )?deck))*\b|\b(?:have )?(?:its|their) souls? dropped\b|\bits souls? cannot be dropped\b/gi, ["souls dropped"]],
    [new RegExp("\\b(?:its|their) " + STATS + " cannot be reduced\\b", "gi"), null],
    [/\b(?:be )?destroyed\b/gi, ["destroyed"]],
    [/\b(?:be )?returned (?:from the field )?to (?:your |their owner's |its owner's )?hand\b|\breturn to hand\b/gi, ["returned to hand"]],
    [/(?:\bbe )?\[rest\]/gi, ["rest"]],
    [/\bleave the field\b/gi, ["leave the field"]],
    [/\b(?:be )?put to other areas\b/gi, ["put to other areas"]],
    [/\b(?:be )?nullified\b/gi, ["nullified"]],
  ];
  const GLUE = /\b(?:cannot|be|have|its|their|it|they|or|and|nor|on the field|on your field|by)\b|[,\s]+/gi;
  function kindsOf(rest) {
    let t = " " + rest + " ";
    const kinds = new Set();
    for (const [re, ks] of KIND_WORDS) {
      t = t.replace(re, (mm, st) => { (ks || statList(st)).forEach(k => kinds.add(k)); return " "; });
    }
    if (t.replace(GLUE, "").trim()) return null;   // something we do not understand ("cannot gain", "[Stand]", "attack" ...)
    return kinds.size ? [...kinds] : null;
  }

  // "X cannot be ... by your opponent's card effects" -> protect step, or null
  function decompose(text) {
    let t = stripEnd(ABX.norm(text)).replace(/«s\b/g, "'s").replace(/»s\b/g, "'s");
    let byOpp = false, byMonster = false, bys = 0;
    t = t.replace(BY_RE, (mm, kind) => { bys++; if (/opponent/i.test(mm)) byOpp = true; if (/monster/i.test(mm) || lc(kind || "") === "monster") byMonster = true; return ""; }).replace(/,\s*$/, "").trim();
    if (!/\bcannot\b/i.test(t)) return null;
    let m, subj, kinds = [];
    if ((m = t.match(/^(?:the )?abilities of (.+?) cannot be nullified(.*)$/i))) { subj = m[1].replace(/ on (?:the|your) field$/i, (x) => x); kinds.push("nullified"); t = m[2]; }
    else if ((m = t.match(new RegExp("^(?:all |the )?" + STATS + " of (?:all |the )?(.+?) cannot be reduced(.*)$", "i")))) { subj = m[2]; kinds.push(...statList(m[1])); t = m[3]; }
    else if ((m = t.match(new RegExp("^this card's " + STATS + "(?: on the field)? cannot be reduced(.*)$", "i")))) { subj = "this card"; kinds.push(...statList(m[1])); t = m[2]; }
    else if ((m = t.match(/^this card's souls? cannot (?:be )?(?:dropped|put (?:in)?to (?:the|your) drop zone)(.*)$/i))) { subj = "this card"; kinds.push("souls dropped"); t = m[1]; }
    else if ((m = t.match(/^souls (?:in|of) (?:the |your )?(.+?) cannot (?:be )?(?:dropped|put (?:in)?to (?:the|your) drop zone|sent to the drop zone)(.*)$/i))) {
      subj = /^this card$/i.test(m[1]) ? "this card" : m[1].replace(/ monster in your center$/i, " in your center"); kinds.push("souls dropped"); t = m[2];
    }
    else if ((m = t.match(/^(.+?) cannot (.+)$/i))) { subj = m[1]; t = "cannot " + m[2]; }
    else return null;
    const sj = subjectOf(subj);
    if (!sj) return null;
    if (t.trim()) {
      const more = kindsOf(t);
      if (!more) return null;
      kinds.push(...more);
    }
    if (!kinds.length) return null;
    return Object.assign({ op: "static", kind: "protect", kinds: [...new Set(kinds)], byOpp, byMonster: byMonster || undefined, r20: true }, sj);
  }
  ABX.decomposeProtect = decompose;

  // continuous abilities only: rewrite the ones that were left (partly) unread
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        if (ab.kind !== "static" || !(ab.unparsed && ab.unparsed.length)) return;
        let text = stripEnd(ABX.norm(ab.cleaned || ab.raw || "")).replace(/^"[^"]+"\s*/, "");
        if (/[.!]\s+\S/.test(text)) return;   // one sentence only
        const conds = [];
        const cm = text.match(/^(?:if|while) /i) && (() => {
          const parts = text.split(/,\s*/);
          for (let k = parts.length - 1; k >= 1; k--) {
            const c = ABX.parseCondition(parts.slice(0, k).join(", "));
            if (c) return { c, rest: parts.slice(k).join(", ") };
          }
          return null;
        })();
        if (/^(?:if|while) /i.test(text)) { if (!cm) return; conds.push(cm.c); text = cm.rest; }
        const st = decompose(text);
        if (!st) return;
        st.src = text;
        ab.steps = [st];
        ab.conds = (ab.conds || []).concat(conds);
        ab.unparsed = [];
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  /* ---- 3a. "souls cannot be dropped": protected souls are not offered to (or taken by) OPS.dropSoul ---- */
  if (OPS.dropSoul && OPS.dropSoul.run) {
    const dsPrev = OPS.dropSoul.run;
    OPS.dropSoul.run = async function (s, ctx) {
      const hidden = [];
      try {
        ["plr", "opp"].forEach(side => core.fieldUnits(F(side), true).forEach(x => {
          const u = x.unit;
          if ((u.soul || []).length && core.isProtected(u, side, "souls dropped", ctx)) { hidden.push([u, u.soul]); u.soul = []; }
        }));
      } catch (e) { if (ABX.debug) console.error(e); }
      try { return await dsPrev.apply(this, arguments); }
      finally { hidden.forEach(([u, soul]) => { u.soul = soul.concat(u.soul || []); }); }
    };
  }

  /* ---- 3b. "its power / critical cannot be reduced" ---- */
  const slPrev = ABX.statLocked;
  ABX.statLocked = function (side, unit, stat, byOpp) {
    if (slPrev && slPrev.apply(this, arguments)) return true;
    try { return !!unit && core.isProtected(unit, side, stat + " reduced", { side: byOpp ? otherSide(side) : side }); } catch (e) { return false; }
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
