/* ==================== ABX — round 13: families of unread text ====================
 * Built from a sweep of every unread sentence (tests/unparsed_groups.js, tests/unparsed_atoms.js).
 *  1. REWRITES: wordings that mean the same as text the engine already runs
 *     (size reductions, "look at N cards from the top", "draw an additional card", "the main phase ends",
 *      "both players draw", Rock-Paper-Scissors "the winner …", "when this card enters the field other than from
 *      your hand", "when this card is link attacked", protect wordings, typos, "(Link attacks count as one attack.)").
 *  2. CONDITIONS: "A, B, and C" lists (subject carried over), e.g. Impact cast rules.
 *  3. CONTINUOUS (static) abilities:
 *     - call cost reduction  "If you would call a «X» (from your hand), the gauge cost written in its [Call Cost] is reduced by N"
 *     - damage reduction     "Damage dealt to you by attacks / other than by attacks is reduced by N",
 *                            "If you would be dealt N or greater damage (by an attack), that damage is reduced by M / to M"
 *     - call restrictions    "You cannot call monsters other than «X»", "… non-«X» monsters", "You cannot call (a monster)
 *                            to / on your center", "This card cannot be called to the center", "You cannot call this card"
 *     - link restriction     "Cards on your opponent's field cannot link attack (you directly)"
 *  4. TRIGGERS:
 *     - "When a card / monster on your opponent's field is destroyed (or returned to hand / deck) by your card effects"
 *     - "When a monster on your opponent's field is destroyed during your turn"
 *     - "When your opponent is dealt damage by the effect of your card / of "X" / by your card effects"
 *     - "When the attack of a card on your field is nullified (by your opponent)"
 *     - "When a «X» on your field attacks and destroys your opponent's monster"
 *     - "When a card / monster / «X» on your field is attacked"
 * Loaded after abilities_gkw.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, evalCond, cardOf, fieldUnits, matchFilter, refsFor } = core;
  const toNum = (w) => { const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10); return isNaN(n) ? null : n; };
  const NUM = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)";
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };

  /* ============================================================
   * 1. REWRITES
   * ============================================================ */
  const RW = [];
  const rw = (re, to) => RW.push([re, to]);
  // reminder text and typos
  rw(/\s*\((?:link attacks? (?:only )?counts? as (?:one|1) attacks?|a link attack (?:only )?counts? as (?:one|1) attacks?|link attacks are counted as (?:one|1) attack)[.!]?\)/gi, "");
  rw(/\bguage\b/gi, "gauge");
  rw(/\bdestoryed\b/gi, "destroyed");
  rw(/\bopponent' turn\b/gi, "opponent's turn");
  rw(/\bcalled th the\b/gi, "called to the");
  rw(/\bcan not\b/gi, "cannot");
  rw(/\bthe the\b/gi, "the");
  // size reductions -> "this card's size on the field is reduced by N"
  rw(/\b(?:the size of this card on (?:the|your) field|the size of this card) is reduced by (\d+)(?: on (?:the|your) field)?/gi, "this card's size on the field is reduced by $1");
  rw(/\breduce the size of this card(?: on (?:the|your) field)? by (\d+)/gi, "this card's size on the field is reduced by $1");
  rw(/\bthis card gets size reduced by (\d+) on the field\b/gi, "this card's size on the field is reduced by $1");
  rw(/(^|\.\s+|\]\s*)this card's size on (?:the |your )?left or right is reduced by (\d+)/gi, "$1If this card is on your left or right, this card's size on the field is reduced by $2");
  rw(/(^|\.\s+|\]\s*)this card's size on (?:the |your )?(center|left|right) is reduced by (\d+)/gi, "$1If this card is on your $2, this card's size on the field is reduced by $3");
  // deck looks
  rw(new RegExp("\\blook at " + NUM + " cards? from the top of your deck", "gi"), "look at the top $1 cards of your deck");
  rw(new RegExp("\\breveal " + NUM + " cards? from the top of your deck", "gi"), "reveal the top $1 cards of your deck");
  rw(/\breveal the five cards from the top of your deck\b/gi, "reveal the top five cards of your deck");
  // draws
  rw(/\bdraw an additional card\b/gi, "draw a card");
  rw(/\b(?:both players|each player) draws? a card\b/gi, "draw a card, and your opponent draws a card");
  rw(new RegExp("\\b(?:both players|each player) draws? " + NUM + " cards\\b", "gi"), "draw $1 cards, and your opponent draws $1 cards");
  // Rock-Paper-Scissors "the winner …"
  rw(new RegExp("\\bthe winner draws " + NUM + " cards?\\.?", "gi"), "If you win, draw $1 cards. If it is not, your opponent draws $1 cards.");
  rw(/\bthe winner draws a card\.?/gi, "If you win, draw a card. If it is not, your opponent draws a card.");
  rw(new RegExp("\\bthe winner gains " + NUM + " life\\.?", "gi"), "If you win, you gain $1 life. If it is not, your opponent gains $1 life.");
  // phases
  rw(/\bthe main phase ends(?:,? and (?:you )?(?:proceed|move|go) to (?:your|the) final phase)?/gi, "end the main phase");
  rw(/\bthe attack phase ends(?:,? and (?:you )?(?:proceed|move|go) to (?:your|the) final phase)?/gi, "end the attack phase");
  // triggers
  rw(/\bwhen this card enters the field other than (?:from )?(?:your )?hand,\s*/gi, "When this card enters the field, if this card entered the field by card effects, ");
  rw(/\bwhen this card is link attacked,\s*/gi, "When this card is attacked, if it is a link attack, ");
  rw(/^((?:\[[^\]]+\]\s*)*when this card attacks), if it is attacking alone,/gi, "$1, if this card is attacking alone,");
  // protection wordings -> "… by your opponent's card effects" / "… by card effects"
  rw(/\bby (?:the )?effects? (?:from|of) (?:your )?opponent's cards?\b/gi, "by your opponent's card effects");
  rw(/\bby (?:the )?effects? (?:from|of) cards\b/gi, "by card effects");
  rw(/\bcannot be destroyed by your opponent's card effects,? nor (?:be )?returned to (?:your )?hand\b/gi, "cannot be destroyed or returned to hand by your opponent's card effects");
  rw(/\bcannot be destroyed,? nor (?:be )?returned to (?:your )?hand,? by your opponent's card effects\b/gi, "cannot be destroyed or returned to hand by your opponent's card effects");

  // batch 2
  rw(/\b(attacks and destroys (?:your opponent's monster|a monster on your opponent's field)),\s+or (deals damage to your opponent)/gi, "$1 or $2");
  rw(/\bwhen this card's attack destroys (a monster on your opponent's field|your opponent's monster) or deals damage to your opponent\b/gi, "When this card attacks and destroys $1 or deals damage to your opponent");
  rw(/^((?:\[[^\]]+\]\s*)*If [^.]+?), this card's size on (?:the |your )?left or right is reduced by (\d+)/gi, "$1, and this card is on your left or right, this card's size on the field is reduced by $2");
  rw(/\bwhen this card is \[set\]\.\s+if\b/gi, "When this card is [Set], if");
  rw(/\bfor this battle, stop the time of your opponent and all of your opponent's cards\b/gi, "for this battle, your opponent cannot use [Counter]");
  rw(/\bstop the time of your opponent and all of your opponent's cards\b/gi, "your opponent cannot use [Counter]");
  rw(/\blook at the top card of your deck, and put it on the top or bottom of (?:your|the) deck\b/gi, "put the top card of your deck on the top or bottom of your deck");
  // batch 3: trigger wordings
  rw(/\bwhen this card destroys (a monster|your opponent's monster|a monster on your opponent's field)(?! by)/gi, "When this card attacks and destroys $1");
  rw(/\b(when [^,.]+?) during your opponent's turn,\s*/gi, "$1, if it is your opponent's turn, ");
  rw(/\b(when [^,.]+?) during your turn,\s*/gi, "$1, if it is your turn, ");
  rw(/(^|\]\s*|\.\s+)when this card's attack is nullified\b/gi, "$1When the attack of this card is nullified");
  rw(/\bat the beginning of your (main|attack|final|draw) phase\b/gi, "At the start of your $1 phase");
  rw(/\bat the beginning of your turn\b/gi, "At the start of your turn");
  rw(/\bat the end of turn\b/gi, "At the end of the turn");
  rw(/\bwhen you \[set\] this card\b/gi, "When this card is [Set]");
  rw(/\bwhen your opponent attacks,\s*/gi, "When your opponent's monster attacks, ");
  // batch 4: small effect wordings
  rw(/\byou may cast this card without paying its \[cast cost\] if ([^.]+)\./gi, "If $1, you may cast this card without paying its [Cast Cost].");
  rw(/\byour opponent chooses (?:a|one) card in their hand and (discards|drops) it\b/gi, "your opponent chooses a card from their hand and discards it");
  rw(/\byour opponent (?:discards|drops) a card from their hand\b/gi, "your opponent chooses a card from their hand and discards it");
  rw(/\bdeal (\d+|one|two|three) additional damage to your opponent\b/gi, "deal $1 damage to your opponent");
  rw(/(^|\.\s+)(put the top card of your deck into your gauge), or (you gain \w+ life)\./gi, "$1Either $2, or $3.");
  rw(/\bpay (\d+) gauge & pay (\d+) life\b/gi, "pay $1 gauge and $2 life");
  rw(/& (\d+) life\]/gi, "& Pay $1 life]");
  rw(/\bdraw until you have (\w+) (?:hand )?cards(?: in your hand)?\b/gi, "draw cards until you have $1 cards in your hand");
  rw(/\byou cannot call this card to (?:the |your )?(center|left|right)\b/gi, "This card cannot be called to the $1");
  // batch 5
  rw(/\bif your opponent's life would become 0 by this card,? it cannot be changed by your opponent's cards\b/gi, "Your opponent's life cannot be saved by your opponent's cards");
  rw(/\b(?:if|when) your (?:hand )?cards would be dropped by your opponent's card effects?, you may reveal this hand card and pay (\d+) life\. if you do, your hand cards cannot be dropped by that effect\b/gi, "Your hand cards are guarded by revealing this hand card and paying $1 life");
  function rewrite5(raw) {
    let s = String(raw || "");
    for (const [re, to] of RW) s = s.replace(re, to);
    return s;
  }
  const prevRw = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite5(prevRw ? prevRw(t) : t);

  /* ============================================================
   * 2. CONDITIONS: "A, B, and C"
   * ============================================================ */
  // split on top-level commas (not inside quotes / brackets)
  function topCommaSplit(t) {
    const out = []; let depth = 0, q = false, cur = "";
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '"') q = !q;
      if (!q && (ch === "[" || ch === "(" || ch === "«")) depth++;
      if (!q && (ch === "]" || ch === ")" || ch === "»")) depth = Math.max(0, depth - 1);
      if (ch === "," && !q && depth === 0) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(Boolean);
  }
  const SUBJ = /^(?:you |your |this |there |a |an |another |neither |it |the |that |no |all |each |during |both )/i;
  const pcPrev = ABX.parseCondition;
  let pcDepth = 0;
  ABX.parseCondition = function (text) {
    const r = pcPrev.call(this, text);
    if (r || pcDepth > 2) return r;
    const t = ABX.norm(text || "").replace(/[\s.]+$/, "").replace(/^(?:if|while)\s+/i, "");
    if (!t || t.length > 300 || t.indexOf(",") < 0) return null;
    const parts = topCommaSplit(t);
    if (parts.length < 2) return null;
    const isOr = /^or\s/i.test(parts[parts.length - 1]) && !parts.slice(0, -1).some(p => /^and\s/i.test(p));
    pcDepth++;
    try {
      const subs = []; let prevSubj = null;
      for (let p of parts) {
        p = p.replace(/^(?:and|or)\s+(?:if\s+)?/i, "").replace(/^if\s+/i, "");
        let c = ABX.parseCondition(p);
        if (!c && prevSubj && !SUBJ.test(p)) c = ABX.parseCondition(prevSubj + p);
        if (!c) return null;
        subs.push(c);
        const sm = p.match(/^(you have |your opponent has |there (?:is|are) |you do not have )/i);
        if (sm) prevSubj = sm[1];
      }
      return { t: isOr ? "or" : "and", list: subs };
    } finally { pcDepth--; }
  };

  /* ============================================================
   * 3. CONTINUOUS ABILITIES (whole lines)
   * ============================================================ */
  // Each builder returns { steps, conds } or null. The line may start with "If <condition>, ".
  const STATIC_LINES = [];
  const sl = (re, fn) => STATIC_LINES.push([re, fn]);
  const callNP = (who) => {
    let w = who.replace(/^(?:a|an)\s+/i, "").trim();
    if (/^(?:monsters?|cards?)$/i.test(w)) return { raw: "a monster", filter: {} };
    // "Wizard" / "72 Pillars" written without «»
    const np = NP("a " + w) || NP("a «" + w.replace(/\s+monsters?$/i, "") + "» monster");
    return np;
  };
  const fromOf = (s) => !s ? "any" : /other than/i.test(s) ? "notHand" : "hand";
  // call cost reduction
  sl(new RegExp("^if you (?:would )?call (.+?)( from (?:your )?hand| other than from (?:your )?hand)?,? (?:the |its |their )?(?:gauge cost written (?:in|on) (?:its|their|the) \\[call cost\\]|amount of gauge (?:needed|required) to pay (?:for )?(?:its|their) \\[call cost\\]|\\[call cost\\]|gauge (?:cost )?(?:of|for) (?:its|their) \\[call cost\\]) (?:is|are) reduced by " + NUM + "(?: gauge)?$", "i"),
    (m) => { const np = callNP(m[1]); return np ? { steps: [{ op: "static", kind: "callCostMod", np, delta: toNum(m[3]), from: fromOf(m[2]) }] } : null; });
  sl(new RegExp("^if (?:a|an) (.+?) would be called( from (?:your )?hand)?,? its \\[call cost\\] is reduced by " + NUM + "(?: gauge)?$", "i"),
    (m) => { const np = callNP(m[1]); return np ? { steps: [{ op: "static", kind: "callCostMod", np, delta: toNum(m[3]), from: fromOf(m[2]) }] } : null; });
  // damage reduction
  sl(new RegExp("^(?:the )?damage (?:that would be |you would be )?dealt to you (?:by|from) (?:an )?attacks? (?:are|is) reduced by " + NUM + "$", "i"), (m) => ({ steps: [{ op: "shield", mode: "turn", reduceBy: toNum(m[1]), from: "attack" }] }));
  sl(new RegExp("^(?:the )?damage (?:that would be |you would be )?dealt to you other than (?:by|from) (?:an )?attacks? (?:are|is) reduced by " + NUM + "$", "i"), (m) => ({ steps: [{ op: "shield", mode: "turn", reduceBy: toNum(m[1]), from: "notAttack" }] }));
  sl(new RegExp("^if you would be dealt " + NUM + " (?:or (?:greater|more) )?damage( by (?:an )?attacks?| by card effects| other than (?:by|from) (?:an )?attacks?)?,? (?:that damage|it) is reduced (?:by " + NUM + "|to " + NUM + ")$", "i"),
    (m) => ({ steps: [{ op: "minShield", min: toNum(m[1]), from: !m[2] ? "any" : /other than/i.test(m[2]) ? "notAttack" : /attack/i.test(m[2]) ? "attack" : "effect", reduceBy: m[3] ? toNum(m[3]) : null, capTo: m[4] != null ? toNum(m[4]) : null }] }));
  // call restrictions
  sl(/^you cannot call (?:monsters? )?other than (.+?)(?: monsters?)?$/i, (m) => { const np = NP("a " + m[1].replace(/^(?:a|an)\s+/i, "")); return np ? { steps: [{ op: "static", kind: "callOnly", np }] } : null; });
  sl(/^you cannot call non-(«[^»]+»|<[^>]+>)(?: monsters?)?$/i, (m) => { const np = NP("a " + m[1]); return np ? { steps: [{ op: "static", kind: "callOnly", np }] } : null; });
  sl(/^you cannot call (?:a monster|monsters|any monsters?) (?:to|on|in) (?:the |your )?(center|left|right)$/i, (m) => ({ steps: [{ op: "static", kind: "noCallPos", pos: m[1].toLowerCase() }] }));
  sl(/^(?:this card|this monster) cannot be called (?:to|on|in) (?:the |your )?(center|left|right)$/i, (m) => ({ steps: [{ op: "static", kind: "noCallSelfPos", pos: m[1].toLowerCase() }] }));
  sl(/^you cannot call this card$/i, () => ({ steps: [{ op: "static", kind: "noCallSelf" }] }));
  // link restriction
  sl(/^(?:cards|monsters) on your opponent's field cannot link attack( you directly)?$/i, (m) => ({ steps: [{ op: "static", kind: "oppNoLink", directOnly: !!m[1] }] }));

  sl(/^you (?:may|can) only \[set\] (?:one|1) "(.+)" on your field$/i, () => ({ steps: [{ op: "static", kind: "onlyOneSet" }] }));
  sl(/^your hand cards are guarded by revealing this hand card and paying (\d+) life$/i, (m) => ({ steps: [{ op: "static", kind: "handGuard", life: +m[1] }] }));
  sl(/^your opponent cannot call monsters by card effects$/i, () => ({ steps: [{ op: "static", kind: "oppNoEffCall" }] }));
  const NEW_STATIC_KINDS = new Set(["callCostMod", "callOnly", "noCallPos", "noCallSelfPos", "noCallSelf", "oppNoLink", "onlyOneSet", "oppNoEffCall", "handGuard"]);
  OPS.minShield = OPS.minShield || { run() { return true; } };

  function staticLine(body) {
    let t = ABX.norm(String(body).replace(/\s*\([^)]*\)\.?/g, "")).replace(/[\s.]+$/, "");
    let conds = [];
    // optional leading "If <condition>, "
    for (let k = 0; k < 2; k++) {
      for (const [re, fn] of STATIC_LINES) { const m = t.match(re); if (m) { const r = fn(m); if (r) return { steps: r.steps, conds }; } }
      const pm = t.match(/^(?:if|while) (.+?), (.+)$/i);
      if (!pm) return null;
      const c = ABX.parseCondition(pm[1]);
      if (!c) return null;
      conds = conds.concat([c]); t = pm[2];
    }
    return null;
  }

  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewrite5(rawLine);
    let ab = palPrev.call(this, fixed, card);
    if (fixed !== rawLine && ab) ab.raw = ABX.clean(rawLine);
    try {
      const stuck = ab && ((ab.unparsed && ab.unparsed.length) || (ab.kind === "static" && !(ab.steps || []).length));
      const alwaysOn = !card || card.type !== "Spell" || card.set;
      if (stuck && !ab.trigger && ab.kind !== "keyword" && ab.kind !== "cost") {
        const body = ABX.clean(fixed).replace(/^(?:\[[^\]]+\]\s*)+/, "").replace(/^"[^"]+"\s*/, "");
        const sentences = body.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean);
        if (sentences.length === 1) {
          const r = staticLine(sentences[0]);
          const fromHand = r && r.steps.every(x => x.op === "static" && x.kind === "handGuard");
          if (r && (alwaysOn || fromHand)) ab = Object.assign({}, ab, { kind: "static", steps: r.steps, conds: (ab.conds || []).concat(r.conds), unparsed: [], parsed: true, r13: true });
        }
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    return ab;
  };
  // rules ("You cannot call this card.", "This card cannot be called to center.") go through parseRuleLine
  const prlPrev = ABX.parseRuleLine;
  if (prlPrev) {
    ABX.parseRuleLine = function (line, card) {
      const fixed = rewrite5(line);
      const ab = prlPrev.call(this, fixed, card);
      try {
        if (ab && ab.unparsed && ab.unparsed.length) {
          const r = staticLine(ABX.clean(fixed));
          if (r) return Object.assign(ab, { kind: "static", steps: r.steps, conds: r.conds, unparsed: [], parsed: true, r13: true, raw: line });
        }
        if (ab && ab.noCallPos && !ab.r13) ab.steps = [{ op: "static", kind: "noCallSelfPos", pos: ab.noCallPos }];
      } catch (e) { if (ABX.debug) console.error(e); }
      return ab;
    };
  }

  // after parsing a whole card:
  //  - "this card's attack cannot be nullified (if this card is attacking alone / is not a link attack)" was read as a
  //    generic restriction; it is the existing "unnullifiable" static (ABX.attackUnnullifiable reads its condition)
  //  - a static line mixing a size reduction with a stat boost becomes two abilities (each runs on its own)
  const pcPrev2 = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev2.apply(this, arguments);
    try {
      const out = [];
      (r.abilities || []).forEach(ab => {
        (ab.steps || []).forEach((st, i) => {
          if (st.op === "restrict" && st.np && /^this card's (?:link )?attacks?$/i.test(ABX.clean(st.np.raw || "")) && (st.kinds || []).includes("nullified") && st.kinds.every(k => k === "nullified" || k === "attack")) {
            const c = st.cond || null;
            ab.steps[i] = { op: "static", kind: "unnullifiable", cond: c && c.t === "xAlone" ? "alone" : c, src: st.src, r13: true };
          }
        });
        if (ab.kind === "static" && (ab.steps || []).length > 1 && !(ab.unparsed && ab.unparsed.length)) {
          const size = ab.steps.filter(x => x.op === "static" && x.kind === "sizeMod");
          const rest = ab.steps.filter(x => !(x.op === "static" && x.kind === "sizeMod"));
          if (size.length && rest.length && rest.every(x => x.op === "boost")) {
            out.push(Object.assign({}, ab, { steps: size, r13split: true }));
            out.push(Object.assign({}, ab, { steps: rest, r13split: true }));
            return;
          }
        }
        out.push(ab);
      });
      // rule lines are parsed on a path that skips the rewrites: retry them here
      out.forEach((ab, i) => {
        if (ab.kind === "rule" && ab.unparsed && ab.unparsed.length && ABX.parseRuleLine) {
          const re = ABX.parseRuleLine(rewrite5(ab.raw || ""), card);
          if (re && !(re.unparsed && re.unparsed.length)) out[i] = Object.assign(re, { raw: ab.raw });
        }
        // "… is destroyed by your card effects": the trigger checks that itself (not "this card entered by effects")
        if (ab.trigger && ab.trigger.event === "xLeave" && ab.trigger.byEffect && ab.conds) ab.conds = ab.conds.filter(c => c.t !== "xByEffect");
      });
      r.abilities = out;
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  if (OPS.static && OPS.static.check) {
    const osc = OPS.static.check;
    OPS.static.check = function (s) { if (s && s.kind === "unnullifiable" && s.r13 && (!s.cond || s.cond === "alone" || (typeof s.cond === "object" && ABX.condExecutable(s.cond)))) return true; return osc.apply(this, arguments); };
  }

  // executability of the new continuous kinds
  const isExPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && (ab.steps || []).length && !(ab.unparsed && ab.unparsed.length) &&
        ab.steps.every(x => (x.op === "static" && NEW_STATIC_KINDS.has(x.kind)) || x.op === "minShield" || x.op === "oppNoEffCall") &&
        (ab.conds || []).every(c => ABX.condExecutable(c))) return true;
    if (ab && ab.kind === "rule" && ab.r13) return true;
    return isExPrev.apply(this, arguments);
  };

  // All active continuous steps of `kind` on `side` (field units, souls, [Set] spells).
  function activeStatics(side, pred) {
    const f = F(side), out = [];
    if (!f) return out;
    const srcs = [];
    fieldUnits(f, true).forEach(x => { srcs.push({ unit: x.unit, card: x.unit.card, host: null }); (x.unit.soul || []).forEach(id => { const c = cardOf(id); if (c) srcs.push({ unit: null, card: c, host: x.unit }); }); });
    (f.setSpells || []).forEach(c => srcs.push({ unit: null, card: c, host: null }));
    for (const src of srcs) {
      if ((src.unit && src.unit.abxNullified === B.turnCount) || (src.host && src.host.abxNullified === B.turnCount)) continue;
      let parsed; try { parsed = ABX.get(src.card); } catch (e) { continue; }
      for (const ab of (parsed && parsed.abilities) || []) {
        if (ab.kind !== "static" || (ab.unparsed && ab.unparsed.length)) continue;
        for (const st of ab.steps || []) {
          if (!pred(st)) continue;
          const ctx = { side, f, e: F(otherSide(side)), card: src.card, unit: src.unit, soulHost: src.host, hostArea: src.host ? "soul" : "field", bind: { chosen: src.host ? [{ k: "unit", side, unit: src.host, card: src.host.card, id: src.host.card.id }] : [] } };
          // a card in a soul only works there if the line says so ("If this card is in the soul of …")
          const conds = (ab.conds || []).concat(st.cond ? [st.cond] : []);
          if (src.host && !conds.some(c => c && (c.t === "selfInSoulOf" || c.t === "or"))) continue;
          if (!src.host && conds.some(c => c && c.t === "selfInSoulOf")) continue;
          let ok = true; try { ok = conds.every(c => evalCond(c, ctx)); } catch (e) { ok = false; }
          if (ok) out.push({ st, ab, src, ctx });
        }
      }
    }
    return out;
  }
  ABX.activeStatics = activeStatics;
  const sideOfFighter = (fighter) => B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;

  // --- call cost reduction (wraps the game's cost reader) ---
  ABX.callArea = null;   // set by effect calls ("drop zone", "deck", "soul" …); null = from the hand
  if (typeof root.parseCardCost === "function") {
    const pcc = root.parseCardCost;
    root.parseCardCost = function (costStr, skill, fighter, card) {
      const r = pcc.apply(this, arguments);
      try {
        if (!r || !fighter || !card || card.type !== "Monster" || !(r.gauge > 0) || r.abxFree) return r;
        const side = sideOfFighter(fighter); if (!side) return r;
        const area = ABX.callArea || "hand";
        let cut = 0;
        activeStatics(side, st => st.op === "static" && st.kind === "callCostMod").forEach(({ st, ctx }) => {
          if (st.from === "hand" && area !== "hand") return;
          if (st.from === "notHand" && area === "hand") return;
          if (st.np && st.np.filter && !matchFilter(card, st.np.filter, null, ctx)) return;
          cut += st.delta || 0;
        });
        if (cut > 0) return Object.assign({}, r, { gauge: Math.max(0, r.gauge - cut), abxCut: cut });
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }
  // effect calls tell the cost reader where the card comes from
  if (OPS.call && OPS.call.run) {
    const ocr = OPS.call.run;
    OPS.call.run = async function (s, ctx) {
      const prev = ABX.callArea;
      const a = (s.np && s.np.zone && s.np.zone.area) || (s.from) || null;
      ABX.callArea = a && a !== "hand" ? a : null;
      try { return await ocr.apply(this, arguments); } finally { ABX.callArea = prev; }
    };
  }

  // --- damage reduction "if you would be dealt N or greater damage" ---
  const apPrev = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    try {
      src = src || {};
      if (!src.unreducible && n > 0) {
        activeStatics(side, st => st.op === "minShield").forEach(({ st }) => {
          if (n < (st.min || 0)) return;
          if (st.from === "attack" && src.kind !== "attack") return;
          if (st.from === "notAttack" && src.kind === "attack") return;
          if (st.from === "effect" && src.kind !== "effect") return;
          if (st.capTo != null) n = Math.min(n, st.capTo); else n = Math.max(0, n - (st.reduceBy || 0));
        });
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    const dealt = apPrev.call(this, side, n, src);
    // "When your opponent is dealt damage by the effect of your card / of "X""
    try { if (dealt > 0 && src && src.kind === "effect" && ABX.curEffectCard) fireEffDamage(side, dealt, ABX.curEffectCard, ABX.curEffectSide); } catch (e) { /* ignore */ }
    return dealt;
  };

  // --- call restrictions ---
  function callBlock(side, card, pos) {
    if (!card || card.type !== "Monster") return null;
    for (const { st, src } of activeStatics(side, st => st.op === "static" && ["callOnly", "noCallPos"].includes(st.kind))) {
      if (st.kind === "callOnly" && st.np && !matchFilter(card, st.np.filter || {}, null, { side, f: F(side) })) return `"${src.card.name}": you cannot call monsters other than ${ABX.clean(st.np.raw || "").replace(/^an? /, "")}`;
      if (st.kind === "noCallPos" && pos && pos === st.pos) return `"${src.card.name}": you cannot call monsters to your ${st.pos}`;
    }
    for (const ab of (ABX.get(card).abilities || [])) {
      for (const st of ab.steps || []) {
        if (st.op !== "static") continue;
        if (st.kind === "noCallSelf") return `"${card.name}" cannot be called`;
        if (st.kind === "noCallSelfPos" && pos && pos === st.pos) return `"${card.name}" cannot be called to the ${st.pos}`;
      }
    }
    return null;
  }
  ABX.callBlock = callBlock;
  if (typeof root.evaluateCardConditions === "function") {
    const ecc = root.evaluateCardConditions;
    root.evaluateCardConditions = function (card, fighter, enemy, isAbilityCall) {
      const r = ecc.apply(this, arguments);
      try {
        if (r && card && card.type === "Monster" && fighter) {
          const side = sideOfFighter(fighter);
          const why = side && callBlock(side, card, null);
          if (why && !(isAbilityCall && /cannot be called$/.test(why))) {
            const reasons = (r.reasons || []).concat([why]);
            return Object.assign({}, r, { met: false, reasons, summary: `⚠️ ${reasons[0]}` });
          }
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }
  if (typeof B.completeMonsterCall === "function") {
    const cmc = B.completeMonsterCall;
    B.completeMonsterCall = function (side, zonePos, handIdx, isBuddyCall, isAbilityCall) {
      try {
        const f = this.getFighter(side), c = CARD_MAP.get(f.hand[handIdx]);
        const why = c && callBlock(side, c, zonePos);
        if (why && !(isAbilityCall && /cannot be called$/.test(why))) {
          if (!f.isBot) { this.pendingAction = null; this.setPrompt(`✖ ${why}.`); this.renderBattle(); }
          return;
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return cmc.apply(this, arguments);
    };
  }
  // --- link restriction ---
  function linkBlocked(attSide, targetPos) {
    const defSide = otherSide(attSide);
    return activeStatics(defSide, st => st.op === "static" && st.kind === "oppNoLink").some(({ st }) => !st.directOnly || targetPos === "fighter");
  }
  ABX.linkBlocked = linkBlocked;
  if (typeof B.initiateAttackWithDefenseCheck === "function") {
    const iad = B.initiateAttackWithDefenseCheck;
    B.initiateAttackWithDefenseCheck = function (attSide, attackerZones, targetPos) {
      try {
        if ((attackerZones || []).length > 1 && linkBlocked(attSide, targetPos)) {
          const f = this.getFighter(attSide);
          if (f.isBot) return iad.call(this, attSide, [attackerZones[0]], targetPos);
          this.pendingAction = null; this.linkAttackers = [];
          this.setPrompt(`✖ Your opponent's card says you cannot link attack${targetPos === "fighter" ? " them directly" : ""}. Attack with one card.`);
          this.renderBattle();
          return;
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return iad.apply(this, arguments);
    };
  }

  /* ============================================================
   * 4. TRIGGERS
   * ============================================================ */
  const NEW_TRIG = [];
  const tr = (re, fn) => NEW_TRIG.push([re, fn]);
  const BY_YOUR = "(?: by (?:the effects? of )?your (?:card effects?|cards?(?:'s)? effects?|cards?))";
  // opponent's cards leaving the field
  tr(new RegExp("^(?:when|whenever) (?:a|an) (.+?) on your opponent's field is (destroyed|returned to (?:their |your opponent's )?hand|destroyed or returned to (?:their |your opponent's )?hand(?: or deck)?|returned to (?:their |your opponent's )?hand or (?:their )?deck|put into (?:the |their )?drop zone)" + BY_YOUR + "(?: during your turn)?$", "i"),
    (m) => { const np = NP("a " + m[1] + " on your opponent's field"); return np ? { event: "xLeave", np, opp: true, kinds: leaveKinds(m[2]), byEffect: true } : null; });
  tr(/^(?:when|whenever) (?:a|an) (.+?) on your opponent's field is destroyed during your turn$/i,
    (m) => { const np = NP("a " + m[1] + " on your opponent's field"); return np ? { event: "xLeave", np, opp: true, kinds: ["destroyed"], myTurn: true } : null; });
  tr(/^(?:when|whenever) (?:a|an) (.+?) on your opponent's field is destroyed by (?:a |an )?link attack$/i,
    (m) => { const np = NP("a " + m[1] + " on your opponent's field"); return np ? { event: "xLeave", np, opp: true, kinds: ["destroyed"], byLink: true } : null; });
  function leaveKinds(w) {
    const k = [];
    if (/destroyed|drop zone/i.test(w)) k.push("destroyed");
    if (/hand/i.test(w)) k.push("hand");
    if (/deck/i.test(w)) k.push("deck");
    return k;
  }
  // damage by effects
  tr(/^(?:when|whenever) your opponent is dealt damage by (?:the |an |a )?(?:effects? (?:of|from) )?(?:your (?:card effects?|cards?(?:'s)? effects?|card)|"([^"]+)"(?: effects?)?|a "([^"]+)" effect|a card with "([^"]+)" in its card name(?: on your field)?)$/i,
    (m) => ({ event: "effDamage", opp: true, name: m[1] || m[2] || null, nameIn: m[3] || null }));
  tr(/^(?:when|whenever) your opponent is dealt damage by your card effects$/i, () => ({ event: "effDamage", opp: true }));
  // attack nullified
  tr(/^(?:when|whenever) the attack of (?:a |an |your )?(.+?) on your field is nullified(?: by your opponent(?:'s card effects)?)?$/i,
    (m) => { const np = NP("a " + m[1] + " on your field"); return np ? { event: "attackNullified", np } : null; });
  tr(/^(?:when|whenever) (?:the )?attack of this card is nullified(?: by your opponent(?:'s card effects)?)?$/i, () => ({ event: "attackNullified", self: true }));
  // another card attacks and destroys
  tr(/^(?:when|whenever) (?:a|an|your) (.+?) on your field attacks and destroys (?:a |an )?(?:monster|card) on your opponent's field$|^(?:when|whenever) (?:a|an|your) (.+?) on your field attacks and destroys your opponent's monster$/i,
    (m) => { const np = NP("a " + (m[1] || m[2]) + " on your field"); return np ? { event: "otherAttackDestroys", np } : null; });
  // ally attacked
  tr(/^(?:when|whenever) (?:a|an|your) (.+?) on your field is attacked$/i,
    (m) => { const np = NP("a " + m[1] + " on your field"); return np && !np.self ? { event: "allyAttacked", np } : null; });
  tr(/^(?:when|whenever) you are (?:being )?attacked directly$/i, () => ({ event: "oppAttack", fighterTarget: true }));
  tr(/^(?:when|whenever) (?:a |an )?(?:your )?opponent's (?:monster|card) attacks (?:a |the |your )?monster (?:in|on) your (center|left|right)$/i, (m) => ({ event: "oppAttackPos", pos: m[1].toLowerCase() }));
  ABX.TRIGGER_RULES.unshift(...NEW_TRIG);
  Object.assign(ABX.TRIG_OK, {
    xLeave: t => !!t.np, effDamage: () => true, oppAttackPos: t => !!t.pos, attackNullified: t => t.self || !!t.np, otherAttackDestroys: t => !!t.np, allyAttacked: t => !!t.np
  });

  // which card's effect is running right now (for "dealt damage by the effect of …")
  const oas = ABX.onAbilityStart;
  ABX.onAbilityStart = function (ctx) {
    if (oas) oas.apply(this, arguments);
    if (ctx && ctx.card) { ABX.curEffectCard = ctx.card; ABX.curEffectSide = ctx.side; }
  };

  function fireEffDamage(dmgSide, n, card, cardSide) {
    if (!cardSide || cardSide === dmgSide) return;
    const nm = (card.name || "").toLowerCase();
    ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "effDamage" && side === cardSide &&
      (!t.name || nm === t.name.toLowerCase().replace(/[.]$/, "") || nm.includes(t.name.toLowerCase().replace(/[.]$/, ""))) &&
      (!t.nameIn || nm.includes(t.nameIn.toLowerCase())), { name: "effDamage", card }));
  }

  // opponent's cards leaving the field: destroyed (game.destroyMonster) / returned to hand or deck (ABX moves)
  function fireLeaveOther(side, card, kind, byAttack, link) {
    const byEff = !byAttack;
    ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "xLeave" && s !== side && t.opp &&
      (!t.kinds || t.kinds.includes(kind)) && (!t.byEffect || byEff) && (!t.myTurn || B.activeSide === s) && (!t.byLink || (byAttack && link)) &&
      matchFilter(card, (t.np && t.np.filter) || {}, { unit: null, side }, { f: F(side) }), { name: "xLeave", card }));
  }
  if (typeof B.destroyMonster === "function") {
    const dm = B.destroyMonster;
    B.destroyMonster = function (side, pos) {
      const f = this.getFighter(side), m = f && f.monsters[pos];
      const byAttack = !!this._destroyByAttack, link = !!(ABX.curBattle && (ABX.curBattle.attUnits || []).length > 1);
      const r = dm.apply(this, arguments);
      try { if (m && f.monsters[pos] !== m && r !== false) fireLeaveOther(side, m.card, "destroyed", byAttack, link); } catch (e) { /* ignore */ }
      return r;
    };
  }
  // returned to hand / deck by an ABX effect: compare the fields before and after a move
  ["move", "moveZone", "deckToBottom"].forEach(op => {
    if (!OPS[op] || !OPS[op].run) return;
    const orun = OPS[op].run;
    OPS[op].run = async function (s, ctx) {
      const snap = ["plr", "opp"].map(side => ({ side, units: fieldUnits(F(side), true).map(x => x.unit) }));
      const r = await orun.apply(this, arguments);
      try {
        snap.forEach(({ side, units }) => {
          const f = F(side), now = new Set(fieldUnits(f, true).map(x => x.unit));
          units.forEach(u => {
            if (now.has(u) || !u || !u.card) return;
            const id = u.card.id;
            if (f.hand.includes(id)) fireLeaveOther(side, u.card, "hand", false, false);
            else if (f.deck.includes(id)) fireLeaveOther(side, u.card, "deck", false, false);
          });
        });
      } catch (e) { /* ignore */ }
      return r;
    };
  });

  // attack nullified / another card attacks and destroys / ally attacked
  if (typeof B.executeAttackResolution === "function") {
    const ear = B.executeAttackResolution;
    B.executeAttackResolution = function (attSide, attackerZones, targetPos, attackNullified) {
      const f = this.getFighter(attSide);
      const units = (attackerZones || []).map(z => z === "item" ? f.item : f.monsters[z]).filter(Boolean);
      const r = ear.apply(this, arguments);
      try {
        if (attackNullified && units.length) {
          ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "attackNullified" && side === attSide &&
            (t.self ? units.includes(src.unit) : units.some(u => matchFilter(u.card, (t.np && t.np.filter) || {}, { unit: u, side: attSide }, { f }))), { name: "attackNullified" }));
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (ABX.fireAttackOutcome) {
    const fao = ABX.fireAttackOutcome;
    ABX.fireAttackOutcome = function (attSide, units, defSide, outcome) {
      const r = fao.apply(this, arguments);
      try {
        if (outcome && outcome.destroyedMonster) {
          const us = (units || []).map(u => u.unit).filter(Boolean);
          ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "otherAttackDestroys" && side === attSide &&
            us.some(u => u !== src.unit && matchFilter(u.card, (t.np && t.np.filter) || {}, { unit: u, side: attSide }, { f: F(attSide) })), { name: "otherAttackDestroys" }));
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (ABX.fireAttack) {
    const fa = ABX.fireAttack;
    ABX.fireAttack = function (attSide, units, defSide, targetPos) {
      const r = fa.apply(this, arguments);
      try {
        const defUnit = ["left", "center", "right"].includes(targetPos) ? F(defSide).monsters[targetPos] : null;
        if (defUnit) ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "oppAttackPos" && side === defSide && t.pos === targetPos, { name: "oppAttackPos", defUnit }));
        if (defUnit) ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "allyAttacked" && side === defSide && src.unit !== defUnit &&
          matchFilter(defUnit.card, (t.np && t.np.filter) || {}, { unit: defUnit, side: defSide }, { f: F(defSide) }), { name: "allyAttacked", defUnit }));
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  /* ============================================================
   * 5. BATCH 2: effects and triggers
   * ============================================================ */
  const A13 = [];
  // "you win the game / the fight"
  A13.push([/^you win (?:the )?(?:game|fight)$/i, () => ({ op: "winGame" }), false]);
  // "for this turn, your opponent cannot call monsters by card effects"
  A13.push([/^(?:for this turn, )?your opponent cannot call monsters by card effects$/i, () => ({ op: "oppNoEffCall" }), false]);
  // "put the top card of your deck on the top or bottom of your deck"
  A13.push([/^put the top card of your deck on the top or bottom of your deck$/i, () => ({ op: "topOrBottom" }), false]);
  ABX.ACTION_RULES.unshift(...A13);

  OPS.winGame = { run(s, ctx) {
    if (B.matchOver) return true;
    if (B.showCutin && !ABX.fast) { try { B.showCutin("YOU WIN!", ctx.card.name, ctx.card.img); } catch (e) { /* ignore */ } }
    B.finishMatch(ctx.side === "plr", "card");
    return true;
  } };
  OPS.oppNoEffCall = { run(s, ctx) { F(otherSide(ctx.side)).abxNoEffCall = B.turnCount; return true; } };
  OPS.topOrBottom = { async run(s, ctx) {
    const f = ctx.f; if (!f.deck.length) return false;
    const c = cardOf(f.deck[0]);
    let bottom = false;
    if (!ctx.auto && !f.isBot && !ABX.autoPlay && ABX.ui && ABX.ui.pickOption) {
      const i = await ABX.ui.pickOption({ title: `${ctx.card.name} — top card of your deck: "${c ? c.name : "?"}"`, options: [{ label: "Keep it on top" }, { label: "Put it on the bottom" }] });
      bottom = i === 1;
    } else bottom = !!(c && c.type === "Flag");
    if (bottom) f.deck.push(f.deck.shift());
    fresh();
    return true;
  } };

  // effect calls are blocked while the caller's opponent has "Your opponent cannot call monsters by card effects"
  function effCallBlocked(side) {
    const f = F(side);
    if (f && f.abxNoEffCall === B.turnCount) return true;
    return activeStatics(otherSide(side), st => (st.op === "static" && st.kind === "oppNoEffCall") || st.op === "oppNoEffCall").length > 0;
  }
  ABX.effCallBlocked = effCallBlocked;
  if (OPS.call && OPS.call.run) {
    const ocr3 = OPS.call.run;
    OPS.call.run = async function (s, ctx) {
      if (ctx && effCallBlocked(ctx.side)) { if (B.setPrompt && !ctx.f.isBot) B.setPrompt("✖ Your opponent's card: you cannot call monsters by card effects."); return false; }
      return ocr3.apply(this, arguments);
    };
  }
  // only one "X" [Set] on your field
  if (typeof root.evaluateCardConditions === "function") {
    const ecc2 = root.evaluateCardConditions;
    root.evaluateCardConditions = function (card, fighter, enemy, isAbilityCall) {
      const r = ecc2.apply(this, arguments);
      try {
        if (r && card && card.type === "Spell" && card.set && fighter && (ABX.get(card).abilities || []).some(a => (a.steps || []).some(x => x.op === "static" && x.kind === "onlyOneSet")) &&
            (fighter.setSpells || []).some(c => c.id === card.id || c.name === card.name)) {
          const reasons = (r.reasons || []).concat([`You may only [Set] one "${card.name}" on your field`]);
          return Object.assign({}, r, { met: false, reasons, summary: `⚠️ ${reasons[0]}` });
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  // triggers: "When this card is [Set]" / "At the end of the battle that a «X» on your field was attacked"
  const T13 = [];
  T13.push([/^(?:when|whenever) this card is \[set\]$/i, () => ({ event: "setPlaced", self: true })]);
  T13.push([/^at the end of the battle (?:that|in which) (?:a|an|your) (.+?) (?:on your field )?was attacked$/i,
    (m) => { const np = NP("a " + m[1].replace(/ on your field$/i, "") + " on your field"); return np ? { event: "defBattleEnd", np } : null; }]);
  T13.push([/^at the end of the battle (?:that|in which) (?:a|an) monster on your (center|left|right) was attacked$/i, (m) => ({ event: "defBattleEnd", pos: m[1].toLowerCase(), np: NP("a monster on your field") })]);
  ABX.TRIGGER_RULES.unshift(...T13);
  Object.assign(ABX.TRIG_OK, { setPlaced: t => t.self, defBattleEnd: t => !!t.np });

  if (typeof B.resolveCastSpell === "function") {
    const rcs = B.resolveCastSpell;
    B.resolveCastSpell = function (side, c, cid) {
      const r = rcs.apply(this, arguments);
      try {
        if (c && c.set && (this.getFighter(side).setSpells || []).includes(c))
          ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "setPlaced" && t.self && s === side && src.card === c, { name: "setPlaced" }));
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (ABX.fireBattleEnd) {
    const fbe = ABX.fireBattleEnd;
    ABX.fireBattleEnd = function (attSide, units) {
      const cb = ABX.curBattle;
      const defSide = otherSide(attSide);
      const defUnit = cb && cb.defSide === defSide ? cb.defUnit : null, pos = cb && cb.targetPos;
      const r = fbe.apply(this, arguments);
      try {
        if (defUnit) ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "defBattleEnd" && s === defSide && (!t.pos || t.pos === pos) &&
          matchFilter(defUnit.card, (t.np && t.np.filter) || {}, { unit: defUnit, side: defSide }, { f: F(defSide) }), { name: "defBattleEnd", defUnit }));
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  /* ============================================================
   * 6. BATCH 5: life lock, hand-drop guard, "put from the soul into the drop zone"
   * ============================================================ */
  // --- "If your opponent's life would become 0 by this card, it cannot be changed by your opponent's cards"
  ABX.ACTION_RULES.unshift([/^your opponent's life cannot be saved by your opponent's cards$/i, () => ({ op: "lifeLock" }), false]);
  OPS.lifeLock = { run() { return true; } };   // a marker: read by the damage below
  const hasLifeLock = (card) => { try { return (ABX.get(card).abilities || []).some(a => (a.steps || []).some(x => x.op === "lifeLock")); } catch (e) { return false; } };
  const apLock = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    try {
      const c = ABX.curEffectCard;
      if (src && src.kind === "effect" && c && ABX.curEffectSide && side === otherSide(ABX.curEffectSide) && hasLifeLock(c) && n >= F(side).life) {
        const f = F(side), S = core.st(f);
        S.lifeFloor = null; S.lifeFloorPersist = false; f.abxNoLose = null;
        f.abxLifeLocked = B.turnCount;
      }
    } catch (e) { /* ignore */ }
    return apLock.apply(this, arguments);
  };
  if (typeof B.checkWinCondition === "function") {
    const cwc = B.checkWinCondition;
    B.checkWinCondition = function () {
      try {
        if (!this.matchOver) for (const [f, won] of [[this.opp, true], [this.plr, false]]) {
          if (f && f.life <= 0 && f.abxLifeLocked === this.turnCount) { this.finishMatch(won); return; }
        }
      } catch (e) { /* ignore */ }
      return cwc.apply(this, arguments);
    };
  }

  // --- hand-drop guard: "you may reveal this hand card and pay 1 life. If you do, your hand cards cannot be dropped by that effect."
  if (OPS.oppDiscard && OPS.oppDiscard.run) {
    const odr = OPS.oppDiscard.run;
    OPS.oppDiscard.run = async function (s, ctx) {
      try {
        const tgt = otherSide(ctx.side), e = F(tgt);
        for (const id of e.hand) {
          const c = cardOf(id); if (!c) continue;
          const g = (ABX.get(c).abilities || []).map(a => (a.steps || []).find(x => x.op === "static" && x.kind === "handGuard")).find(Boolean);
          if (!g || e.life <= g.life) continue;
          let yes = true;
          const online = B.mode === "online_p2p" && tgt === "opp";
          if (!e.isBot && !online && ABX.ui && ABX.ui.pickOption) {
            const i = await ABX.ui.pickOption({ title: `"${ctx.card.name}" would drop a card from your hand`, options: [{ label: `Reveal "${c.name}" and pay ${g.life} life: no card is dropped` }, { label: "Don't" }] });
            yes = i === 0;
          }
          if (!yes) break;
          e.life -= g.life;
          if (B.showCutin && !ABX.fast) { try { B.showCutin("REVEAL!", `${c.name}: hand cards can't be dropped`, c.img); } catch (er) { /* ignore */ } }
          if (B.setPrompt) B.setPrompt(`🛡️ "${c.name}" was revealed: your hand cards cannot be dropped by "${ctx.card.name}".`);
          fresh();
          return false;
        }
      } catch (er) { if (ABX.debug) console.error(er); }
      return odr.apply(this, arguments);
    };
  }

  // --- "When this (face down) card is put from the soul of a «X» (on your field) into your drop zone"
  ABX.TRIGGER_RULES.unshift([/^(?:when|whenever) this (?:face down )?card is put from (?:the )?soul of (?:a |an |your )?(.+?)(?: on (?:your|the) field)? into (?:your |the )?drop zone$/i,
    (m) => { const w = m[1].trim(); const np = /^(?:monster|card)$/i.test(w) ? { raw: "a monster", filter: {} } : NP("a " + w); return np ? { event: "soulToDrop", self: true, np } : null; }]);
  ABX.TRIG_OK.soulToDrop = t => t.self && !!t.np;
  function soulSnap() {
    const out = [];
    ["plr", "opp"].forEach(side => fieldUnits(F(side), true).forEach(x => out.push({ side, unit: x.unit, host: x.unit.card, soul: (x.unit.soul || []).slice() })));
    return { list: out, drops: { plr: F("plr").drop.slice(), opp: F("opp").drop.slice() } };
  }
  function soulDiff(before) {
    const res = [];
    const countIn = (arr, id) => arr.reduce((a, x) => a + (x === id ? 1 : 0), 0);
    before.list.forEach(({ side, unit, host, soul }) => {
      const now = unit.soul || [];
      const stillOn = fieldUnits(F(side), true).some(x => x.unit === unit);
      soul.forEach(id => {
        if (stillOn && countIn(now, id) >= countIn(soul, id)) return;
        if (countIn(F(side).drop, id) > countIn(before.drops[side], id)) res.push({ side, id, host });
      });
    });
    // one fire per card id
    const seen = new Set(); return res.filter(r => { const k = r.side + r.id; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  function fireSoulToDrop(items) {
    items.forEach(({ side, id, host }) => {
      const card = cardOf(id); if (!card) return;
      const abs = core.abilitiesOf(card, a => a.kind === "triggered" && a.trigger && a.trigger.event === "soulToDrop" && ABX.isExecutable(a));
      if (!abs.length) return;
      ABX.queue(async () => {
        const f = F(side);
        for (const ab of abs) {
          if (!matchFilter(host, (ab.trigger.np && ab.trigger.np.filter) || {}, null, { side, f })) continue;
          if (core.onceUsed(f, card, ab, null)) continue;
          const idx = f.drop.lastIndexOf(id); if (idx < 0) continue;
          const selfRef = { k: "zone", side, area: "drop", idx, id, card };
          const probe = { side, f, e: F(otherSide(side)), card, unit: null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "drop", selfRef };
          if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
          core.markOnce(f, card, ab, null);
          await core.runAbility(side, card, ab, null, { event: { name: "soulToDrop" }, hostArea: "drop", selfRef, auto: !!f.isBot });
          if (B.matchOver) return;
        }
      });
    });
  }
  ABX.fireSoulToDrop = fireSoulToDrop;
  ["dropSoul", "pay", "move", "moveZone", "destroy", "soulsToDeck"].forEach(op => {
    if (!OPS[op] || !OPS[op].run) return;
    const orun = OPS[op].run;
    OPS[op].run = async function () {
      const before = soulSnap();
      const r = await orun.apply(this, arguments);
      try { fireSoulToDrop(soulDiff(before)); } catch (e) { /* ignore */ }
      return r;
    };
  });
  if (typeof B.destroyMonster === "function") {
    const dm2 = B.destroyMonster;
    B.destroyMonster = function () {
      const before = soulSnap();
      const r = dm2.apply(this, arguments);
      try { fireSoulToDrop(soulDiff(before)); } catch (e) { /* ignore */ }
      return r;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
