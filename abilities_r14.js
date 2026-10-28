/* ==================== ABX — round 14: early-set wordings, data cleanup ====================
 * Built from tests/coverage.js (full-engine coverage, every round loaded).
 *  1. DATA CLEANUP: scraper leftovers ("global.CardFlavor[CardText] = ...") and "No ability text" removed from card text.
 *  2. REWRITES: older / unusual translations rewritten into wordings the engine already runs, e.g.
 *     - unquoted ability names after [Act] ("[Act] Ether Boost You may ...")
 *     - "nullify the link attack", "You may only cast this if ...", "deal N damage to yourself or your opponent"
 *     - "When your «X» enters the field / attacks / is destroyed" -> "When a «X» on your field ..."
 *     - "Other than damage dealt by an attack, damage dealt to you is reduced by N"
 *     - "If you have two Ninja or more on the field" -> "If you have two or more «Ninja» on your field"
 *  3. INFO LINES: deck-building / setup text that needs no effect during a match ("This card can be your Buddy.")
 * Loaded after abilities_r13.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;

  /* ============================================================
   * 1. DATA CLEANUP
   * ============================================================ */
  if (typeof ALL_CARDS !== "undefined") {
    ALL_CARDS.forEach(c => {
      if (!c || typeof c.skill !== "string") return;
      let s = c.skill;
      if (/global\.CardFlavor/.test(s)) s = s.replace(/"?\s*\n?\s*global\.CardFlavor\[CardText\]\s*=\s*"[\s\S]*$/, "").trim();
      if (/^\s*No ability text\.?\s*$/i.test(s)) s = "";
      c.skill = s;
    });
  }

  /* ============================================================
   * 2. REWRITES
   * ============================================================ */
  const RW = [];
  const rw = (re, to) => RW.push([re, to]);
  // ability names printed without quotes: "[Act] Ether Boost You may ..." -> "[Act] "Ether Boost" You may ..."
  rw(/^((?:\[(?:Counter|Act)\]\s*)+)((?:[A-Z][\w'’!\-]*\s+){1,4}?)(?=(?:You|If|When|Pay|Choose|For|Destroy|Draw|Put|Call|Deal|Return|Discard|Drop|Look|Search|Nullify|Rest|Stand|Your|All|This|During)\b)/, (m, tags, name) => {
    const n = name.trim();
    // a real effect verb at the start is not a name ("[Act] Pay 1 gauge ...")
    if (/^(?:You|If|When|Pay|Choose|For|Destroy|Draw|Put|Call|Deal|Return|Discard|Drop|Look|Search|Nullify|Rest|Stand|Your|All|This|During|Then|Each|Both|Until|Once)\b/.test(n)) return m;
    return `${tags}"${n}" `;
  });
  rw(/\bnullify the link attack\b/gi, "nullify that attack");
  rw(/\byou may only cast this if\b/gi, "You may only cast this card if");
  rw(/\byou can only cast this if\b/gi, "You may only cast this card if");
  rw(/\bdeal (\d+|one|two|three) damage to yourself or (?:to )?your opponent\b/gi, "deal $1 damage to you or your opponent");
  // "When your «X» ..." -> "When a «X» on your field ..."
  rw(/\bwhen your («[^»]+»)(?: monsters?| cards?)? (enters the field|attacks|is destroyed|link attacks)\b/gi, "When a $1 on your field $2");
  rw(/\bwhenever your («[^»]+»)(?: monsters?| cards?)? (enters the field|attacks|is destroyed|link attacks)\b/gi, "When a $1 on your field $2");
  // damage reduction wordings
  rw(/\bother than damage dealt by an attack, damage dealt to you is reduced by (\d+|one|two)\b/gi, "Damage dealt to you other than by attacks is reduced by $1");
  rw(/\bdamage dealt to you other than by attacks are reduced by\b/gi, "Damage dealt to you other than by attacks is reduced by");
  rw(/\bdamage dealt to you other than by an attack is reduced by\b/gi, "Damage dealt to you other than by attacks is reduced by");
  // "If you have two Ninja or more on the field" -> "If you have two or more «Ninja» on your field"
  rw(/\bif you have (two|three|four|five|six|\d+) ([A-Z][\w ]*?) or more on (?:the|your) field\b/g, "If you have $1 or more «$2» on your field");
  // typos / spacing
  rw(/\bcritical \+(\d)/gi, "critical+$1");
  rw(/\bpower \+(\d)/gi, "power+$1");
  rw(/\bdefense \+(\d)/gi, "defense+$1");
  rw(/\bthe the\b/gi, "the");

  function rewrite14(raw) {
    let s = String(raw || "");
    for (const [re, to] of RW) s = s.replace(re, to);
    return s;
  }
  const prevRw = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite14(prevRw ? prevRw(t) : t);
  // like round 13: rewrite before each ability / rule line is parsed, keep the printed text
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewrite14(rawLine);
    const ab = palPrev.call(this, fixed, card);
    if (fixed !== rawLine && ab) ab.raw = ABX.clean(rawLine);
    return ab;
  };
  const prlPrev = ABX.parseRuleLine;
  if (prlPrev) {
    ABX.parseRuleLine = function (line, card) {
      const fixed = rewrite14(line);
      const ab = prlPrev.call(this, fixed, card);
      if (fixed !== line && ab) ab.raw = line;
      return ab;
    };
  }

  /* ============================================================
   * 3. INFO LINES (no effect during a match)
   * ============================================================ */
  const INFO = [
    /^this card can be your buddy[.!]*$/i,
    /^start the fight with this side of the card[.!]*$/i,
    /^you may buddy call using this card[.!]*$/i,
    /^you cannot choose this card as your flag during the start of the fight[.!]*$/i,
  ];
  // treated like reminder text: nothing to run, nothing missing
  const palInfo = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const ab = palInfo.call(this, rawLine, card);
    const body = ABX.clean(rawLine || "").replace(/^(?:\[[^\]]+\]\s*)+/, "").trim();
    if (ab && INFO.some(re => re.test(body))) return Object.assign(ab, { kind: "reminder", steps: [], unparsed: [], parsed: true });
    return ab;
  };

  /* ============================================================
   * 4. FREE CAST / CALL / EQUIP WHEN A CONDITION HOLDS
   * ============================================================ */
  // "If X, you may cast this card without paying its [Cast Cost]." starts like a rule ("You may ..."), so it went to the
  // rule reader and never became the freeCost step that round 9's cost reader looks for.
  const FREE_RE = /^if (.+?), you may (cast|call|equip) this card without paying its \[(?:cast|call|equip) cost\][.!]*$/i;
  function freeLine(line) {
    const body = ABX.clean(rewrite14(line || "")).replace(/^(?:\[[^\]]+\]\s*)+/, "").trim();
    const m = body.match(FREE_RE);
    if (!m) return null;
    const cond = ABX.parseCondition(m[1]);
    if (!cond || !ABX.condExecutable(cond)) return null;
    return { kind: "static", steps: [{ op: "freeCost", what: m[2].toLowerCase() }], conds: [cond], unparsed: [], parsed: true, r14free: true };
  }
  const prlFree = ABX.parseRuleLine;
  if (prlFree) {
    ABX.parseRuleLine = function (line, card) {
      const ab = prlFree.call(this, line, card);
      const fl = ab && ab.unparsed && ab.unparsed.length ? freeLine(line) : null;
      return fl ? Object.assign(ab, fl, { raw: line }) : ab;
    };
  }
  const palFree = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const ab = palFree.call(this, rawLine, card);
    const fl = ab && ((ab.unparsed && ab.unparsed.length) || !ABX.isExecutable(ab)) ? freeLine(rawLine) : null;
    return fl ? Object.assign(ab, fl) : ab;
  };
  // the cost reader (round 9, freeCostActive) runs these directly; report them as runnable
  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.r14free) return true;
    return isExecPrev.apply(this, arguments);
  };

  /* ============================================================
   * 5. CHOICE ABILITIES WITH SOME UNREAD OPTIONS
   * ============================================================ */
  // "Choose and use one of the following two/three": a modal only ran when every option was readable, so one unread
  // option left the whole card doing nothing. Now the readable options are offered and the unread ones are left out
  // (kept in ab.unreadOptions so tests/coverage.js still reports them).
  const pcModal = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcModal.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        if (ab.kind !== "modal" || !(ab.options && ab.options.length > 1)) return;
        const ok = ab.options.filter(o => ABX.isExecutable(o));
        if (!ok.length || ok.length === ab.options.length) return;
        ab.unreadOptions = ab.options.filter(o => !ok.includes(o));
        ab.options = ok;
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
