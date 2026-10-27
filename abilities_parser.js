/* ==================== ABX PARSER ====================
 * Turns every card's skill text into structured abilities (pure functions, no DOM, runs in browser and Node).
 *
 *   ABX.parseCard(card) -> { cardId, abilities:[...], stats:{lines, full, partial, none} }
 *
 * ability = {
 *   kind:    "keyword" | "cost" | "rule" | "static" | "triggered" | "act" | "spell" | "modal"
 *   tags:    ["counter","act"]            leading [Counter]/[Act] tags
 *   name:    "Horary Domination"          quoted ability name, if any
 *   trigger: {event, subject:{...}} | null
 *   conds:   [cond...]                    ability-level conditions ("if you have a «X» on your field")
 *   steps:   [step...]                    ordered effects (see ABX_OPS in abilities_engine.js)
 *   once:    "turn" | "game" | null       "You may only use this ability once per turn."
 *   unparsed:[string...]                  sentences the grammar could not turn into steps
 *   raw:     original line
 * }
 *
 * Anything that cannot be turned into steps is kept in `unparsed` (never silently dropped) so the coverage
 * report and the card catalog can list exactly which sentences are NOT automated.
 */
(function (root) {
  "use strict";

  const ABX = root.ABX || (root.ABX = {});

  /* ============================================================
   * 1. TEXT HELPERS
   * ============================================================ */
  const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
  const toNum = (w) => {
    if (w === undefined || w === null) return NaN;
    const k = String(w).toLowerCase().trim();
    return k in WORDNUM ? WORDNUM[k] : parseInt(k, 10);
  };
  ABX.toNum = toNum;
  const N = "(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)";

  ABX.clean = function (t) {
    return (t || "")
      .replace(/�([^�\n]+)�/g, "«$1»")
      .replace(/�/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/ /g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  };

  // Case is kept (tribe / card names matter); spelling variants of "opponent's" are unified.
  ABX.norm = function (t) {
    return ABX.clean(t)
      .replace(/\bopponent(?:s'|s)(?=\s)/gi, "opponent's")
      .replace(/\bopponents\b/gi, "opponent's")
      .replace(/\b(?:his or her|his\/her|his|her)\b(?=\s+(?:drop zone|hand|gauge|deck|soul|field|center|left|right))/gi, "their")
      .replace(/\bhis or her\b/gi, "their")
      .replace(/!+/g, ".")
      .replace(/\.{2,}/g, ".")
      .replace(/\s+/g, " ")
      .trim();
  };
  ABX.normalize = (t) => ABX.norm(t).toLowerCase();

  const lc = (s) => (s || "").toLowerCase();
  const stripEnd = (s) => s.replace(/[\s.!,;:]+$/, "").trim();

  /* ============================================================
   * 2. KEYWORD-ONLY LINES  ([Soulguard] [Double Attack] ...)
   * ============================================================ */
  const NOT_KEYWORD = new Set(["counter", "act", "call cost", "cast cost", "equip cost", "rest", "stand"]);
  function isKeywordOnlyLine(line) {
    let rest = line.replace(/\([^)]*\)/g, " ").replace(/"[^"]*"/g, " ").trim();
    if (!rest) return false;
    const tags = rest.match(/\[[^\]]*\]/g);
    if (!tags) return false;
    const stripped = rest.replace(/\[[^\]]*\]/g, " ").replace(/[\s.!,\-&]+/g, "");
    if (stripped) return false;
    return tags.every(t => !NOT_KEYWORD.has(t.slice(1, -1).toLowerCase().trim()));
  }
  ABX.isKeywordOnlyLine = isKeywordOnlyLine;

  /* ============================================================
   * 3. NOUN PHRASES / FILTERS ("up to two «Black Dragon» monsters with size 2 or less on your opponent's field")
   * ============================================================ */
  const ZONE_AREAS = "field|center|left|right|drop zone|hand|gauge|deck|soul|buddy zone|set area|item area|flag area";
  const OWNER_RE = "your opponent's|the opponent's|your|their|the|that monster's|this card's|its|that card's|each player's|both player's";
  const ZONE_RE = new RegExp("(?:\\b(?:on|in|from|into|to|onto|of|at)\\s+)?(?:(" + OWNER_RE + ")\\s+)(" + ZONE_AREAS + ")\\b", "i");

  function ownerOf(w) {
    w = lc(w || "");
    if (w === "your opponent's" || w === "the opponent's" || w === "their") return "opp";
    if (w === "both player's") return "both";
    if (w === "your") return "you";
    if (w === "each player's") return "both";
    if (w === "this card's" || w === "its" || w === "that card's" || w === "that monster's") return "host";
    return "any";
  }

  // A noun phrase -> { qty, ref, self, filter, zones[], excludeSelf, raw } or null when it has unknown junk.
  function parseNP(raw) {
    let t = stripEnd(ABX.norm(raw || ""));
    if (!t) return null;
    const np = { raw: t, qty: { n: 1, upTo: false, all: false, any: false, each: false }, ref: null, self: false, filter: {}, zone: null, excludeSelf: false, topN: null, soulOf: null };

    // --- references to earlier choices ---
    let m;
    if ((m = t.match(/^(?:the chosen|the selected|that|those|these|the same|the discarded|the revealed|the called|the dropped)\s+(card|cards|monster|monsters|item|items|spell|spells|character|characters)(?:\s+(.*))?$/i)) ||
        (m = t.match(/^(it|them)(?:\s+(.*))?$/i))) {
      np.ref = "chosen";
      np.qty.all = /s$/i.test(m[1]) || /^them$/i.test(m[1]);
      const tail = m[2] || (m[3] || "");
      np.refTail = tail;
      // e.g. "that card on the field" - zone words are ignored, it IS the chosen card
      return np;
    }
    // --- this card ---
    if ((m = t.match(/^this (?:card|monster|item|spell|impact|flag|character|card on the field)(?:'s (soul|power|defense|critical|size))?(?:\s+(.*))?$/i))) {
      np.self = true;
      if (m[1] && lc(m[1]) === "soul") { np.zone = { owner: "host", area: "soul" }; }
      np.selfTail = m[2] || "";
      return np;
    }
    if ((m = t.match(/^(?:its|this card's) soul$/i))) { np.self = true; np.zone = { owner: "host", area: "soul" }; return np; }

    // --- "the top N cards of your deck" ---
    if ((m = t.match(/^the top (?:(card)|(?:(\w+) )?cards?)(?: of (your|your opponent's|their) deck)?$/i)) ) {
      np.topN = m[1] ? 1 : (toNum(m[2]) || 1);
      np.zone = { owner: m[3] ? ownerOf(m[3]) : "you", area: "deck", top: true };
      np.qty.n = np.topN;
      return np;
    }
    if ((m = t.match(/^the (top|bottom) card of (your|your opponent's|their) deck$/i))) {
      np.topN = 1; np.qty.n = 1; np.zone = { owner: ownerOf(m[2]), area: "deck", top: lc(m[1]) === "top", bottom: lc(m[1]) === "bottom" };
      return np;
    }

    // --- quantity ---
    let q = t;
    if ((m = q.match(new RegExp("^(?:up to (" + N + ")|(?:any number of)|(all(?: of)?)|(each)|(" + N + ")(?: or more)?)\\b\\s*", "i")))) {
      if (m[1]) { np.qty.n = toNum(m[1]); np.qty.upTo = true; }
      else if (/^any number of/i.test(m[0])) { np.qty.any = true; np.qty.upTo = true; np.qty.n = 99; }
      else if (m[2]) { np.qty.all = true; np.qty.n = 99; }
      else if (m[3]) { np.qty.each = true; np.qty.all = true; np.qty.n = 99; }
      else if (m[4]) { np.qty.n = toNum(m[4]); }
      q = q.slice(m[0].length);
    } else if ((m = q.match(/^(?:the)\s+/i))) {
      q = q.slice(m[0].length);
    }
    if (/^another\b/i.test(q)) { np.excludeSelf = true; q = q.replace(/^another\s+/i, ""); }
    if (/^other\b/i.test(q)) { np.excludeSelf = true; q = q.replace(/^other\s+/i, ""); }
    if (/^different\b/i.test(q)) { np.filter.distinct = true; q = q.replace(/^different\s+/i, ""); }

    let topFlag = false;
    q = q.replace(/\bfrom the top of (your|your opponent's|their|the opponent's) deck\b/ig, (mm, w) => { topFlag = true; return "from " + w + " deck"; });
    // --- zone phrase(s) ---
    let guard = 0;
    while ((m = q.match(ZONE_RE)) && guard++ < 3) {
      const area = lc(m[2]);
      const z = { owner: ownerOf(m[1]), area };
      // centre / left / right are sub-areas of the field
      if (area === "center" || area === "left" || area === "right") { z.pos = area; z.area = "field"; }
      if (!np.zone || np.zone.area === "field") np.zone = np.zone && np.zone.area !== "field" ? np.zone : z;
      q = (q.slice(0, m.index) + " " + q.slice(m.index + m[0].length)).trim();
    }
    if (topFlag && np.zone && np.zone.area === "deck") { np.zone.top = true; np.topN = np.qty.n; }
    // "in the soul of a «X» on your field" / "in a «X»'s soul"
    if ((m = q.match(/\b(?:in|from|into) (?:the )?soul of (.+)$/i))) {
      np.soulOf = parseNP(m[1]);
      np.zone = { owner: "host", area: "soul" };
      q = q.slice(0, m.index).trim();
    }
    // zone fragments left behind by the loop, e.g. "on the field"
    q = q.replace(/\b(?:on|in|from) the field\b/i, () => { if (!np.zone) np.zone = { owner: "any", area: "field" }; return " "; });
    q = q.replace(/\b(?:from|in) (?:the )?(?:drop zone)\b/i, () => { if (!np.zone) np.zone = { owner: "you", area: "drop zone" }; return " "; });
    q = q.replace(/\b(?:on|in) (?:the )?(?:center|left|right)\b/i, (mm) => { return " "; });

    // --- filters ---
    const f = np.filter;
    q = q.replace(/\bwith an? soul with "([^"]+)" in its card name\b/ig, (mm, n) => { f.soulName = n.toLowerCase(); return " "; });
    q = q.replace(/\bwith ([\d,]+) or (less|more|greater) (power|defense|critical)\b/ig, (mm, v, cmp, stat) => {
      f[lc(stat)] = { n: +v.replace(/,/g, ""), cmp: /less/i.test(cmp) ? "le" : "ge" }; return " ";
    });
    q = q.replace(/\bwith (power|defense|critical) (?:of )?([\d,]+) or (less|more|greater)\b/ig, (mm, stat, v, cmp) => {
      f[lc(stat)] = { n: +v.replace(/,/g, ""), cmp: /less/i.test(cmp) ? "le" : "ge" }; return " ";
    });
    q = q.replace(/\b(power|defense|critical) ([\d,]+) or (less|more|greater)\b/ig, (mm, stat, v, cmp) => {
      f[lc(stat)] = { n: +v.replace(/,/g, ""), cmp: /less/i.test(cmp) ? "le" : "ge" }; return " ";
    });
    q = q.replace(/\bfrom the top of (your|your opponent's|their) deck\b/ig, (mm, w) => { np.zone = { owner: ownerOf(w), area: "deck", top: true }; return " "; });
    q = q.replace(/\bwith ([\d,]+) (power|defense) or (less|more|greater)\b/ig, (mm, v, stat, cmp) => {
      f[lc(stat)] = { n: +v.replace(/,/g, ""), cmp: /less/i.test(cmp) ? "le" : "ge" }; return " ";
    });
    q = q.replace(/\bwith (\d+) or (less|more) (?:souls?|soul cards?)\b/ig, (mm, v, cmp) => { f.soulCount = { n: +v, cmp: /less/i.test(cmp) ? "le" : "ge" }; return " "; });
    q = q.replace(/\bwith (?:1 or more|one or more) souls?\b/ig, () => { f.soulCount = { n: 1, cmp: "ge" }; return " "; });
    q = q.replace(/\b(?:that )?(?:has|have) (?:no souls?|0 souls?)\b|\bwith no souls?\b/ig, () => { f.soulCount = { n: 0, cmp: "eq" }; return " "; });
    q = q.replace(/\bwith "([^"]+)" in (?:its|their|the) (?:card )?(name|attribute|attributes)\b/ig, (mm, v, w) => {
      (lc(w) === "name" ? (f.names = f.names || []) : (f.attrWords = f.attrWords || [])).push(v.toLowerCase()); return " ";
    });
    q = q.replace(/\bwith "([^"]+)" in (?:its|their) (?:card )?name\b/ig, (mm, v) => { (f.names = f.names || []).push(v.toLowerCase()); return " "; });
    q = q.replace(/\bwith (?:the )?(?:\[([^\]]+)\])/ig, (mm, kw) => { (f.kws = f.kws || []).push(lc(kw)); return " "; });
    q = q.replace(/\bwith (?:the )?name "([^"]+)"/ig, (mm, v) => { (f.names = f.names || []).push(v.toLowerCase()); return " "; });
    q = q.replace(/\boriginally\s+/ig, () => { f.original = true; return " "; });
    q = q.replace(/\bsize (\d+) or (less|greater|more)\b/ig, (mm, v, cmp) => { f.size = { n: +v, cmp: /less/i.test(cmp) ? "le" : "ge" }; return " "; });
    q = q.replace(/\bsize (\d+)\b/ig, (mm, v) => { f.size = { n: +v, cmp: "eq" }; return " "; });
    q = q.replace(/\b(\d+) or (less|more|greater) size\b/ig, (mm, v, cmp) => { f.size = { n: +v, cmp: /less/i.test(cmp) ? "le" : "ge" }; return " "; });
    q = q.replace(/\b(\d+) (?:power|defense|critical) or (?:less|more|greater)\b/ig, (mm) => { const mm2 = mm.match(/(\d+) (power|defense|critical) or (less|more|greater)/i); f[lc(mm2[2])] = { n: +mm2[1], cmp: /less/i.test(mm2[3]) ? "le" : "ge" }; return " "; });
    q = q.replace(/\bin battle\b/ig, () => { f.inBattle = true; return " "; });
    q = q.replace(/\bface[- ]?down\b/ig, () => { f.faceDown = true; return " "; });
    q = q.replace(/\bface[- ]?up\b/ig, () => { f.faceUp = true; return " "; });
    q = q.replace(/\bthat is (?:\[rest\]|rested)\b|\b(?:\[rest\]|rested)\b/ig, () => { f.rested = true; return " "; });
    q = q.replace(/\bnot an? impact monsters?\b/ig, () => { f.notImpact = true; return " "; });
    q = q.replace(/"([^"]+)"(?:\s+or\s+"([^"]+)")?/g, (mm, a, b) => { f.names = (f.names || []).concat([a.toLowerCase()].concat(b ? [b.toLowerCase()] : [])); return " "; });
    q = q.replace(/«([^»]+)»(?:\s*(?:,|or|and)\s*«([^»]+)»)*/g, (mm) => { (mm.match(/«([^»]+)»/g) || []).forEach(x => (f.tribes = f.tribes || []).push(x.slice(1, -1))); return " "; });
    q = q.replace(/<([^>]+)>/g, (mm, w) => { (f.worlds = f.worlds || []).push(w); return " "; });
    q = q.replace(/\[([^\]]+)\]/g, (mm, w) => {
      const k = lc(w);
      if (/^(set|ride|omni lord|dragod|crossnize|ambush|move|soulguard|penetrate|double attack|lifelink|counterattack|transform|overturn|overkill|d-share|station)/.test(k)) (f.kws = f.kws || []).push(k.replace(/\s+\d+$/, ""));
      else (f.cardNames = f.cardNames || []).push(k);   // "[Conan]" style named characters
      return " ";
    });
    // type words
    const types = [];
    q = q.replace(/\b(monsters?|items?|spells?|impacts?(?: monsters?)?|characters?|cards?|flags?)\b/ig, (mm, w) => {
      const k = lc(w).replace(/s$/, "");
      if (k === "monster") types.push("monster");
      else if (k === "item") types.push("item");
      else if (k === "spell") types.push("spell");
      else if (/^impact/.test(k)) types.push(/monster/.test(k) ? "impactMonster" : "impact");
      else if (k === "character") types.push("character");
      else if (k === "flag") types.push("flag");
      else types.push("card");
      return " ";
    });
    if (types.length) f.types = Array.from(new Set(types.filter(x => x !== "card")));
    // attribute-style leftovers ("Detective", "Dragon World" tokens, ...)
    const left = q.replace(/\b(?:a|an|the|of|and|or|that|which|with|in|on|from|has|have|having|its|their|attribute|attributes|name|names|each|different|other|another|your|opponent's|are|is|only|also)\b/ig, " ")
      .replace(/[^A-Za-z0-9'\-]+/g, " ").trim();
    if (left) {
      const words = left.split(/\s+/).filter(w => w && !/^\d+$/.test(w));
      if (words.length) {
        // an unexplained word that is not capitalised in the source is most likely a parse miss, not a tribe
        const orig = words.filter(w => /^[A-Z]/.test(w) || /^\d/.test(w));
        if (orig.length === words.length && orig.length <= 4) f.tokens = [orig.join(" ")];
        else { np.junk = left; }
      }
    }
    return np;
  }
  ABX.parseNP = parseNP;

  /* ============================================================
   * 4. CONDITIONS
   * ============================================================ */
  const CMP = (w) => /less|fewer|below/i.test(w) ? "le" : /more|greater|higher|above/i.test(w) ? "ge" : "eq";

  // Each rule: [regex, builder]. A condition must match the WHOLE text.
  const COND_RULES = [];
  const cr = (re, fn) => COND_RULES.push([re, fn]);

  cr(/^during (?:your|this) turn$/i, () => ({ t: "turn", who: "you" }));
  cr(/^during your opponent's turn$/i, () => ({ t: "turn", who: "opp" }));
  cr(/^during (?:your|the) (main|attack|final|start|end) phase$/i, (m) => ({ t: "phase", phase: lc(m[1]) }));
  cr(/^during (?:an? )?attack(?: on your opponent's turn)?$/i, () => ({ t: "underAttack" }));
  cr(/^(?:if )?(?:you are|it is) (?:during|in) (?:an|the) attack on your opponent's turn$/i, () => ({ t: "underAttack" }));
  cr(/^during an attack on your opponent's turn$/i, () => ({ t: "underAttack" }));
  cr(/^(?:it is|this is) during an attack on your opponent's turn$/i, () => ({ t: "underAttack" }));
  cr(/^you are being attacked(?: by (.+))?$/i, (m) => ({ t: "underAttack", by: m[1] ? parseNP(m[1]) : null }));
  cr(/^(?:your|a) (?:monster|card|item|flag)s? (?:is|are) being attacked$/i, () => ({ t: "underAttack" }));
  cr(/^this card is on (?:your |the )?(center|left|right)$/i, (m) => ({ t: "selfPos", pos: lc(m[1]) }));
  cr(/^this card is on the field$/i, () => ({ t: "selfOnField" }));
  cr(/^this card is on your field$/i, () => ({ t: "selfOnField" }));
  cr(/^this card is in your (drop zone|hand|gauge|deck)$/i, (m) => ({ t: "selfIn", area: lc(m[1]) }));
  cr(/^this card is in (?:the )?soul of (.+)$/i, (m) => ({ t: "selfInSoulOf", np: parseNP(m[1]) }));
  cr(/^this card is (?:\[)?(rest|rested|stand|standing)(?:\])?$/i, (m) => ({ t: "selfRested", v: /^rest/i.test(m[1]) }));
  cr(/^this card has no souls?$/i, () => ({ t: "selfSoul", n: 0, cmp: "eq" }));
  cr(/^this card has (\d+|one|two|three|four|five) or (more|less) souls?$/i, (m) => ({ t: "selfSoul", n: toNum(m[1]), cmp: CMP(m[2]) }));
  cr(/^this card has (?:a|an|1 or more|one or more) souls?$/i, () => ({ t: "selfSoul", n: 1, cmp: "ge" }));
  cr(/^this card has (?:a )?soul with "([^"]+)" in its card name$/i, (m) => ({ t: "selfSoulName", name: lc(m[1]) }));
  cr(/^there (?:is|are) (?:a |an )?(?:"([^"]+)"|«([^»]+)») in this card's soul$/i, (m) => ({ t: "selfSoulName", name: lc(m[1] || m[2]) }));
  cr(/^this card is \[set\]$/i, () => ({ t: "selfSet" }));
  cr(/^this card is attacking$/i, () => ({ t: "selfAttacking" }));
  cr(/^this card (?:is |was )?(?:equipped|called|cast)$/i, () => ({ t: "always" }));

  cr(/^your life is (\d+) or (less|more)$/i, (m) => ({ t: "life", who: "you", n: +m[1], cmp: CMP(m[2]) }));
  cr(/^you have (\d+) or (less|more) life$/i, (m) => ({ t: "life", who: "you", n: +m[1], cmp: CMP(m[2]) }));
  cr(/^you have (\d+) life or (less|more)$/i, (m) => ({ t: "life", who: "you", n: +m[1], cmp: CMP(m[2]) }));
  cr(/^your opponent's life is (\d+) or (less|more)$/i, (m) => ({ t: "life", who: "opp", n: +m[1], cmp: CMP(m[2]) }));
  cr(/^your opponent has (\d+) or (less|more) life$/i, (m) => ({ t: "life", who: "opp", n: +m[1], cmp: CMP(m[2]) }));
  cr(/^your life is (?:equal to or )?(?:less|lower) than (?:your )?opponent's(?: life)?$/i, () => ({ t: "lifeVs", cmp: "le" }));
  cr(/^your life is (?:more|higher|greater) than (?:your )?opponent's(?: life)?$/i, () => ({ t: "lifeVs", cmp: "gt" }));
  cr(/^your opponent's life is (?:more|higher|greater) than yours$/i, () => ({ t: "lifeVs", cmp: "le" }));
  cr(/^your opponent's life is (?:less|lower) than yours$/i, () => ({ t: "lifeVs", cmp: "gt" }));
  cr(/^you have (?:a |1 or more )?(\d+) or (more|less) (?:cards? in your )?gauge$/i, (m) => ({ t: "gauge", who: "you", n: +m[1], cmp: CMP(m[2]) }));
  cr(/^you have (\d+|one|two|three|four|five|six|seven) or (more|less) (?:cards? in your )?hand cards?$/i, (m) => ({ t: "hand", who: "you", n: toNum(m[1]), cmp: CMP(m[2]) }));
  cr(/^you have (?:no|0) (?:hand )?cards? in your hand$|^you have no hand cards?$|^your hand is empty$/i, () => ({ t: "hand", who: "you", n: 0, cmp: "eq" }));
  cr(/^your opponent has (?:no|0) (?:hand )?cards?(?: in their hand)?$/i, () => ({ t: "hand", who: "opp", n: 0, cmp: "eq" }));

  cr(/^your (?:flag|flags) (?:is|are) (?:in )?"([^"]+)"(?: or "([^"]+)")?$/i, (m) => ({ t: "flagIs", names: [lc(m[1])].concat(m[2] ? [lc(m[2])] : []) }));
  cr(/^you have (?:a |the )?(?:flag|flags) (?:of |named )?"([^"]+)"$/i, (m) => ({ t: "flagIs", names: [lc(m[1])] }));
  cr(/^your flag is <([^>]+)>$/i, (m) => ({ t: "flagWorld", world: m[1] }));
  cr(/^your flags? \[reversal\]s? (?:(\w+) times? or more|(\w+) times?)?(?: during this fight)?$/i, (m) => ({ t: "reversal", n: toNum(m[1] || m[2] || "1"), cmp: "ge" }));
  cr(/^your flags? \[reversal\]s? during this fight$/i, () => ({ t: "reversal", n: 1, cmp: "ge" }));
  cr(/^your flag has (?:not )?\[reversal\]$/i, () => ({ t: "reversal", n: 1, cmp: "ge" }));

  cr(/^your opponent does not have (?:a|any) (.+)$/i, (m) => ({ t: "hasNot", owner: "opp", np: parseNP(m[1]) }));
  cr(/^your opponent has no (.+)$/i, (m) => ({ t: "hasNot", owner: "opp", np: parseNP(m[1]) }));
  cr(/^you do not have (?:a|an|any) (.+)$/i, (m) => ({ t: "hasNot", owner: "you", np: parseNP(m[1]) }));
  cr(/^you have no (.+)$/i, (m) => ({ t: "hasNot", owner: "you", np: parseNP(m[1]) }));
  cr(/^you have only (?:one|1) (.+)$/i, (m) => ({ t: "count", owner: "you", np: parseNP(m[1]), n: 1, cmp: "eq" }));
  cr(/^your opponent has (?:a|an|1 or more|one or more) (.+)$/i, (m) => ({ t: "has", owner: "opp", np: parseNP(m[1]), n: 1 }));
  cr(/^your opponent has (\d+|one|two|three|four|five|six) or (more|less) (.+)$/i, (m) => ({ t: "count", owner: "opp", np: parseNP(m[3]), n: toNum(m[1]), cmp: CMP(m[2]) }));
  cr(/^you have (?:a|an|another|1 or more|one or more) (.+)$/i, (m) => ({ t: "has", owner: "you", np: parseNP(m[1]), n: 1, other: /^another/i.test(m[0].replace(/^you have /i, "")) }));
  cr(/^you have (\d+|one|two|three|four|five|six|seven|eight|nine|ten) or (more|less|fewer) (.+)$/i, (m) => ({ t: "count", owner: "you", np: parseNP(m[3]), n: toNum(m[1]), cmp: CMP(m[2]) }));
  cr(/^you have (\d+|one|two|three|four|five|six|seven|eight|nine|ten) (?!or)(.+)$/i, (m) => ({ t: "count", owner: "you", np: parseNP(m[2]), n: toNum(m[1]), cmp: "ge" }));
  cr(/^you (?:are|were) \[ride\] on (?:a|an) (.+)$/i, (m) => ({ t: "rideOn", np: parseNP(m[1]) }));
  cr(/^you (?:are|were) \[ride\] on this card$/i, () => ({ t: "always" }));

  cr(/^there (?:is|are) (?:no|0) (.+)$/i, (m) => ({ t: "hasNot", owner: "any", np: parseNP(m[1]) }));
  cr(/^there (?:is|are) (?:a|an|1 or more|one or more|another) (.+)$/i, (m) => ({ t: "has", owner: "any", np: parseNP(m[1]), n: 1 }));
  cr(/^there (?:is|are) (\d+|one|two|three|four|five|six|seven|eight|nine|ten) or (more|less|fewer) (.+)$/i, (m) => ({ t: "count", owner: "any", np: parseNP(m[3]), n: toNum(m[1]), cmp: CMP(m[2]) }));
  cr(/^(?:a|an|another) (.+?) (?:is|are) on (?:your|the) field$/i, (m) => ({ t: "has", owner: "you", np: parseNP(m[1] + " on your field"), n: 1, other: /^another/i.test(m[0]) }));
  cr(/^(?:a|an|another) (.+?) (?:is|are) (?:in|on) (.+)$/i, (m) => ({ t: "has", owner: "any", np: parseNP(m[1] + " " + (/^(?:in|on)/i.test(m[2]) ? m[2] : "in " + m[2])), n: 1, other: /^another/i.test(m[0]) }));
  cr(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten) or (more|less) (?:different )?(.+?) (?:is|are) (?:in|on) (your|the|your opponent's) (field|drop zone|gauge|hand|center|left|right)$/i,
    (m) => ({ t: "count", owner: ownerOf(m[4]) === "any" ? "any" : ownerOf(m[4]), np: parseNP(m[3] + " " + m[5] === "field" ? m[3] : (m[3] + " in " + m[4] + " " + m[5])), n: toNum(m[1]), cmp: CMP(m[2]) }));
  cr(/^this card is (?:the )?only (?:card|monster) on your field$/i, () => ({ t: "onlyThis" }));
  cr(/^you have only (?:one|1) monsters? on your field$/i, () => ({ t: "monsterCount", who: "you", n: 1, cmp: "eq" }));
  cr(/^(?:your opponent|they) (?:has|have) (\d+|one|two|three) or (more|less) monsters$/i, (m) => ({ t: "monsterCount", who: "opp", n: toNum(m[1]), cmp: CMP(m[2]) }));

  cr(/^you (?:have )?(?:cast|casted|cast a) (.+) this turn$/i, (m) => ({ t: "castThisTurn", np: parseNP(m[1]) }));
  cr(/^you (?:have )?attacked this turn$/i, () => ({ t: "attackedThisTurn" }));

  cr(/^you have (?:an? |another )?(.+?) (?:item )?equipped$/i, (m) => ({ t: "itemEquipped", np: parseNP(m[1].replace(/\s+item$/i, "")), any: /^(?:item|card)$/i.test(m[1].trim()) }));
  cr(/^you have (?:a |an )?(?:card )?equipped with (.+)$/i, (m) => ({ t: "itemEquipped", np: parseNP(m[1]) }));
  cr(/^you have (?:an? )?item equipped$/i, () => ({ t: "itemEquipped", any: true }));
  cr(/^you have («[^»]+»|"[^"]+") on your (field|center|left|right)$/i, (m) => ({ t: "has", owner: "you", np: parseNP(m[1] + " on your " + m[2]), n: 1 }));
  cr(/^(«[^»]+»|"[^"]+") is on your (field|center|left|right)$/i, (m) => ({ t: "has", owner: "you", np: parseNP(m[1] + " on your " + m[2]), n: 1 }));
  cr(/^(?:a|an) («[^»]+»|"[^"]+"|<[^>]+>)(?: (?:monster|item|card|character))? is on your opponent's field$/i, (m) => ({ t: "has", owner: "opp", np: parseNP(m[1] + " on your opponent's field"), n: 1 }));
  cr(/^a buddy is on your field$/i, () => ({ t: "buddyOnField" }));
  cr(/^neither you nor your opponent has (?:a |any )?(.+)$/i, (m) => ({ t: "hasNot", owner: "any", np: parseNP(m[1]) }));
  cr(/^there are no cards in battle$/i, () => ({ t: "noBattle" }));
  cr(/^there is a card in battle$/i, () => ({ t: "inBattle" }));
  cr(/^during each player's (attack|main|final) phase$/i, (m) => ({ t: "phase", phase: lc(m[1]) }));
  cr(/^(?:your|a) opponent's cards? attacked (\w+) times? or more during this turn$|^your opponent's cards attacked (\w+) times or more during this turn$/i, (m) => ({ t: "oppAttackCount", n: toNum(m[1] || m[2]) }));
  cr(/^your cards attacked (\w+) times or more during this turn$/i, (m) => ({ t: "myAttackCount", n: toNum(m[1]) }));
  ABX.parseCondition = function (text) {
    const t = stripEnd(ABX.norm(text)).replace(/^(?:if|when|while)\s+/i, "");
    if (!t) return null;
    // "A and B" / "A or B" of full conditions
    for (const [re, fn] of COND_RULES) {
      const m = t.match(re);
      if (m) {
        const c = fn(m);
        if (!c) continue;
        if (c.np === null) continue;
        if (c.np && c.np.junk) continue;
        return c;
      }
    }
    // event windows: "when you are dealt damage", "when a monster on your field is destroyed"
    if (/^(?:when|whenever)\s/i.test(ABX.norm(text))) {
      const head = stripEnd(ABX.norm(text));
      for (const [re, fn] of ABX.TRIGGER_RULES || []) { const mm = head.match(re); if (mm) { const tg = fn(mm); return { t: "event", trigger: tg }; } }
    }
    // composite: split on ", and " / " and " / " or " when both halves are conditions
    const parts = t.split(/,\s*and\s+(?:if\s+)?|,\s*(?=if\s)|\s+and\s+(?:if\s+)?(?=you |your |this |there |a |an |another |neither )/i);
    if (parts.length > 1) {
      const subs = parts.map(p => ABX.parseCondition(p));
      if (subs.every(Boolean)) return { t: "and", list: subs };
    }
    const orParts = t.split(/,?\s+or\s+(?=you |your |this |there |a |an |another )/i);
    if (orParts.length > 1) {
      const subs = orParts.map(p => ABX.parseCondition(p));
      if (subs.every(Boolean)) return { t: "or", list: subs };
    }
    return null;
  };

  /* ============================================================
   * 5. STEPS (effects)
   * ============================================================ */
  // value that may scale: "1", "two", "equal to the size of that card", "for each ..."
  function parseValue(w) { const n = toNum(w); return isNaN(n) ? null : n; }

  const ACTION_RULES = [];
  const ar = (re, fn) => ACTION_RULES.push([re, fn, false]);
  const arw = (re, fn) => ACTION_RULES.push([re, fn, true]);   // only tried on a whole, unsplit sentence

  const PROP = "(power|defense|critical|size)";
  const SIGNED = "([+\\-]\\s*[\\d,]+)";

  // ---- helpers for zone destinations ----
  function destOf(txt, ownerHint) {
    // returns {area, owner, bottom?, top?} for "into your hand" / "on the bottom of your deck" / "into the gauge" ...
    const t = ABX.norm(txt);
    let m;
    if ((m = t.match(/^(?:on |to |into |onto )?(?:the )?(top|bottom) of (your|your opponent's|their|its owner's|the owner's) deck$/i)))
      return { area: "deck", owner: m[2] && /opponent|their/i.test(m[2]) ? "opp" : /owner/i.test(m[2]) ? "owner" : "you", end: lc(m[1]) };
    if ((m = t.match(/^(?:into|to|onto|in) (?:the |your |their |your opponent's |its owner's |the owner's )?(hand|gauge|drop zone|deck)$/i))) {
      const owner = /your opponent's|their/i.test(t) ? "opp" : /its owner's|the owner's|owner's/i.test(t) ? "owner" : /^(?:into|to|onto|in) the /i.test(t) && !/your/i.test(t) ? "owner" : "you";
      return { area: lc(m[1]), owner, end: "top" };
    }
    if ((m = t.match(/^(?:into|to|in) (?:its|this card's) soul$/i))) return { area: "soul", owner: "host", host: "self" };
    if ((m = t.match(/^(?:into|in) the soul of (.+)$/i))) return { area: "soul", owner: "host", hostNP: parseNP(m[1]) };
    if ((m = t.match(/^(?:into|in) (?:their|your) (?:opponent's )?soul$/i))) return { area: "soul", owner: "host", host: "self" };
    if (/^(?:on|to) the field$/i.test(t)) return { area: "field", owner: "you" };
    return null;
  }
  ABX.destOf = destOf;

  /* ---------- draw / life / damage ---------- */
  ar(/^draw (?:(\d+|a|an|one|two|three|four|five|six) )?cards?(?: from your deck)?$/i, (m) => ({ op: "draw", who: "you", n: toNum(m[1] || "a") }));
  ar(/^draw (?:cards )?equal to (?:the size of )?(?:that|the chosen|the discarded|the revealed) (?:monster|card)(?:'s size)?$/i, () => ({ op: "draw", who: "you", n: { fromRef: "size" } }));
  ar(/^draw (?:cards )?equal to that monster's size$/i, () => ({ op: "draw", who: "you", n: { fromRef: "size" } }));
  ar(/^draw (?:a card|(\w+) cards?) for each (.+)$/i, (m) => ({ op: "draw", who: "you", n: { each: parseNP(m[2]), per: toNum(m[1] || "a") } }));
  ar(/^draw cards until you have (\d+|one|two|three|four|five|six|seven|eight|nine|ten) (?:hand )?cards?(?: in your hand)?$/i, (m) => ({ op: "drawUntil", n: toNum(m[1]) }));
  ar(/^your opponent draws? (\d+|a|an|one|two|three) cards?$/i, (m) => ({ op: "draw", who: "opp", n: toNum(m[1]) }));
  ar(/^(?:you )?gain (\d+|one|two|three|four|five|six) life$/i, (m) => ({ op: "life", who: "you", n: toNum(m[1]) }));
  ar(/^(?:you )?gain (\d+|one|two|three|four|five) life for each (.+)$/i, (m) => ({ op: "life", who: "you", n: { each: parseNP(m[2]), per: toNum(m[1]) } }));
  ar(/^(?:you )?gain life equal to (?:the size of )?(?:that|the chosen|the discarded) (?:monster|card)(?:'s size)?$/i, () => ({ op: "life", who: "you", n: { fromRef: "size" } }));
  ar(/^(?:you )?gain life equal to the (?:number of|total)? ?(.+)$/i, (m) => ({ op: "life", who: "you", n: { each: parseNP(m[1].replace(/^cards? /, "")), per: 1 } }));
  ar(/^your opponent gains? (\d+|one|two|three) life$/i, (m) => ({ op: "life", who: "opp", n: toNum(m[1]) }));
  ar(/^deal (\d+|a|one|two|three|four|five|six|seven|eight|nine|ten) damage to your opponent(?: for each (.+))?$/i, (m) => ({ op: "damage", who: "opp", n: m[2] ? { each: parseNP(m[2]), per: toNum(m[1]) } : toNum(m[1]) }));
  ar(/^deal (\d+|a|one|two|three|four|five|six) damage to you$/i, (m) => ({ op: "damage", who: "you", n: toNum(m[1]) }));
  ar(/^deal damage to your opponent equal to (?:the size of )?(?:that|the chosen|the destroyed|the discarded|the revealed) (?:destroyed )?(?:monster|card)(?:'s size)?$/i, () => ({ op: "damage", who: "opp", n: { fromRef: "size" } }));
  ar(/^deal damage to your opponent equal to this card's (critical|power|size)$/i, (m) => ({ op: "damage", who: "opp", n: { fromSelf: lc(m[1]) } }));
  ar(/^deal (?:an? )?(\d+|one|two|three) damage to (?:the chosen|that) (?:card|monster)$/i, (m) => ({ op: "damageCard", n: toNum(m[1]) }));
  ar(/^your opponent takes? (\d+|one|two|three|four|five) damage$/i, (m) => ({ op: "damage", who: "opp", n: toNum(m[1]) }));
  ar(/^you take (\d+|one|two|three) damage$/i, (m) => ({ op: "damage", who: "you", n: toNum(m[1]) }));

  /* ---------- pay (costs inside abilities) ---------- */
  ar(/^pay (\d+|a|one|two|three|four|five|six) gauge$/i, (m) => ({ op: "pay", gauge: toNum(m[1]), cost: true }));
  ar(/^pay (\d+|a|one|two|three|four|five) life$/i, (m) => ({ op: "pay", life: toNum(m[1]), cost: true }));
  ar(/^pay (\d+|one|two|three) gauge(?:,| and) (?:and )?pay (\d+|one|two|three) life$/i, (m) => ({ op: "pay", gauge: toNum(m[1]), life: toNum(m[2]), cost: true }));
  ar(/^(?:discard|drop) (?:a|an|one|1) (?:hand )?cards?(?: from your hand)?$|^(?:discard|drop) a hand card$/i, () => ({ op: "discard", n: 1, cost: true }));
  ar(/^(?:discard|drop) (\w+) (?:hand )?cards?(?: from your hand)?$/i, (m) => ({ op: "discard", n: toNum(m[1]) || 1, cost: true }));
  ar(/^(?:discard|drop) (?:a|an|one) (.+?) (?:from your hand|in your hand)$/i, (m) => ({ op: "discard", n: 1, np: parseNP(m[1]), cost: true }));
  ar(/^(?:discard|drop) all (?:cards |hand cards )?(?:from your hand|in your hand)$|^(?:discard|drop) all (?:of )?your hand(?: cards)?$/i, () => ({ op: "discard", all: true }));
  ar(/^\[rest\] this card$/i, () => ({ op: "restSelf", cost: true }));
  ar(/^\[rest\] (?:this card|it)(?: and (?:discard|drop) (?:a|one) hand card)?$/i, () => ({ op: "restSelf", cost: true }));
  ar(/^destroy this card$/i, () => ({ op: "destroy", np: { self: true, raw: "this card", qty: { n: 1 }, filter: {} } }));
  ar(/^(?:you may )?(?:put|return) this card (?:on the field )?(?:into|to) (?:the )?(?:your )?(drop zone|hand|gauge|deck)$/i, (m) => ({ op: "moveSelf", to: { area: lc(m[1]), owner: "you", end: "top" } }));

  /* ---------- gauge / drop manipulation of opponent ---------- */
  ar(/^drop (\d+|a|one|two|three|four|five) (?:of )?your opponent's gauge$|^put (\d+|a|one|two|three|four|five) cards? (?:from )?your opponent's gauge (?:into|to) (?:their|the) drop zone$/i, (m) => ({ op: "moveZone", from: { area: "gauge", owner: "opp" }, to: { area: "drop zone", owner: "opp" }, n: toNum(m[1] || m[2]) }));
  ar(/^put (?:a|one|1) card from your opponent's gauge (?:into|to) (?:their|the) drop zone$/i, () => ({ op: "moveZone", from: { area: "gauge", owner: "opp" }, to: { area: "drop zone", owner: "opp" }, n: 1 }));
  ar(/^drop (?:the )?top (?:(\w+) )?cards? of your (?:opponent's )?deck$/i, (m) => ({ op: "mill", who: /opponent/i.test(m[0]) ? "opp" : "you", n: toNum(m[1] || "a") || 1, to: "drop zone" }));
  ar(/^put the top (?:(\w+) )?cards? of (your|your opponent's|their) deck (?:into|to|in) (?:the |your |their )?(drop zone|gauge|hand)$/i, (m) => ({ op: "mill", who: /opponent|their/i.test(m[2]) ? "opp" : "you", n: toNum(m[1] || "a") || 1, to: lc(m[3]) }));
  ar(/^put the top (?:(\w+) )?cards? of your deck (?:into|to|in) (?:your )?(gauge|drop zone|hand) for each (.+)$/i, (m) => ({ op: "mill", who: "you", n: { each: parseNP(m[3]), per: toNum(m[1] || "a") || 1 }, to: lc(m[2]) }));
  ar(/^put the top (?:(\w+) )?cards? of your deck (?:into|in|on) (?:this card's|its|their|the) soul$/i, (m) => ({ op: "mill", who: "you", n: toNum(m[1] || "a") || 1, to: "soul", host: "self" }));
  ar(/^put the top (?:(\w+) )?cards? of your deck (?:into|in) the soul of (.+)$/i, (m) => ({ op: "mill", who: "you", n: toNum(m[1] || "a") || 1, to: "soul", hostNP: parseNP(m[2]) }));
  ar(/^put the top (?:(\w+) )?cards? of your deck on the bottom of your deck$/i, (m) => ({ op: "deckToBottom", n: toNum(m[1] || "a") || 1 }));
  ar(/^put the top card of your deck into (?:the )?(gauge|drop zone)(?: and (?:the )?top card of your opponent's deck into (?:their )?(gauge|drop zone))?$/i, (m) => ({ op: "mill", who: "you", n: 1, to: lc(m[1]) }));

  /* ---------- shuffle / look / search ---------- */
  ar(/^shuffle your deck$/i, () => ({ op: "shuffle", who: "you" }));
  ar(/^shuffle your opponent's deck$/i, () => ({ op: "shuffle", who: "opp" }));
  ar(/^(?:end|finish) the (?:battle|attack)$/i, () => ({ op: "endBattle" }));
  ar(/^end the turn$/i, () => ({ op: "endTurn" }));
  ar(/^nullify (?:the|that) attack$/i, () => ({ op: "nullifyAttack" }));
  ar(/^nullify the attack(?: and (.+))?$/i, (m) => ({ op: "nullifyAttack" }));
  ar(/^nullify (?:that|the) (?:spell|card|impact|cast)$/i, () => ({ op: "nullifyCast" }));
  ar(/^look at the top (\d+|one|two|three|four|five|six|seven|eight|nine|ten) cards? of your deck$/i, (m) => ({ op: "look", n: toNum(m[1]), who: "you" }));
  ar(/^look at the top (\d+|one|two|three|four|five|six|seven) cards? of your opponent's deck$/i, (m) => ({ op: "look", n: toNum(m[1]), who: "opp" }));
  ar(/^look at (?:your|your opponent's) hand$/i, () => ({ op: "noop" }));
  ar(/^reveal the top (\d+|one|two|three|four|five|six|seven) cards? of your deck$/i, (m) => ({ op: "reveal", n: toNum(m[1]) }));

  /* ---------- moving cards ---------- */
  // put <NP> <dest>
  function parsePut(m) {
    // "put NP from ZONE into DEST" -- NP may carry its own source zone
    const np = parseNP(m[1]);
    const dest = destOf(m[2]);
    if (!np || !dest) return null;
    return { op: "move", np, to: dest };
  }
  ar(/^put (.+?) ((?:into|to|in|onto|on) (?:the |your |their |your opponent's |its owner's |its |this card's )?(?:hand|gauge|drop zone|deck|soul|top of .+|bottom of .+|the soul of .+))(?: in any order)?$/i, (m) => {
    const r = parsePut([m[0], m[1], m[2]]);
    if (r && /in any order$/i.test(m[0])) r.order = "any";
    return r;
  });
  ar(/^put (.+?) on (?:the )?(top|bottom) of (your|your opponent's|their|its owner's|the owner's) deck(?: in any order)?$/i, (m) => {
    const np = parseNP(m[1]); if (!np) return null;
    return { op: "move", np, to: { area: "deck", owner: /opponent|their/i.test(m[3]) ? "opp" : /owner/i.test(m[3]) ? "owner" : "you", end: lc(m[2]) }, order: /in any order$/i.test(m[0]) ? "any" : null };
  });
  ar(/^return (.+?) (?:to|into) (?:its owner's |their owner's |the owner's |your |their )?hand$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "move", np, to: { area: "hand", owner: "owner" }, verb: "return" } : null; });
  ar(/^return (.+?) to (?:its owner's |the owner's |their |your )?(?:the )?(?:top|bottom) of (?:its owner's |the owner's |their |your )?deck$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "move", np, to: { area: "deck", owner: "owner", end: /bottom/i.test(m[0]) ? "bottom" : "top" }, verb: "return" } : null; });
  ar(/^return (.+?) to the drop zone$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "move", np, to: { area: "drop zone", owner: "owner" }, verb: "return" } : null; });
  ar(/^(?:drop|discard) (.+?) (?:from your (field|gauge|soul))$/i, (m) => { const np = parseNP(m[1] + " from your " + m[2]); return np ? { op: "move", np, to: { area: "drop zone", owner: "owner" } } : null; });
  ar(/^put (.+?) into (?:the )?(?:your opponent's |their )?soul$/i, () => null);

  /* ---------- destroy / rest / stand ---------- */
  ar(/^destroy (?:all|each) (.+)$/i, (m) => { const np = parseNP("all " + m[1]); return np ? { op: "destroy", np } : null; });
  ar(/^(?:choose and )?destroy (.+)$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "destroy", np } : null; });
  ar(/^\[rest\] (.+)$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "rest", np } : null; });
  ar(/^\[stand\] (.+)$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "stand", np } : null; });
  ar(/^(?:rest) (.+)$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "rest", np } : null; });

  /* ---------- choose ---------- */
  ar(/^choose (.+)$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "choose", np, bind: "chosen" } : null; });

  /* ---------- boosts ---------- */
  // "for this turn, X gets power+1000, defense+2000, critical+1 and [Penetrate]"
  const STATS = /(power|defense|critical)\s*([+\-])\s*(\d[\d,]*)/ig;
  function parseStatMods(text) {
    const mods = { power: 0, defense: 0, critical: 0, kws: [] };
    let any = false, mm;
    STATS.lastIndex = 0;
    while ((mm = STATS.exec(text))) { mods[lc(mm[1])] += (mm[2] === "-" ? -1 : 1) * parseInt(mm[3].replace(/,/g, ""), 10); any = true; }
    (text.match(/\[[^\]]+\]/g) || []).forEach(k => { mods.kws.push(lc(k.slice(1, -1))); any = true; });
    return any ? mods : null;
  }
  ABX.parseStatMods = parseStatMods;
  ar(/^(.+?) (?:gets?|has|have|gains?) (.*(?:power|defense|critical)\s*[+\-]\s*\d.*|\[[^\]]+\].*)$/i, (m) => {
    const subj = m[1];
    if (/^(?:for this turn|for that turn)$/i.test(subj)) return null;
    const mods = parseStatMods(m[2]); if (!mods) return null;
    const each = m[2].match(/for each (.+)$/i);
    const np = parseNP(subj.replace(/^the /i, "the "));
    if (!np) return null;
    return { op: "boost", np, mods, each: each ? parseNP(each[1]) : null };
  });
  ar(/^give (.+?) (power|defense|critical)\s*([+\-])\s*(\d[\d,]*)$/i, (m) => { const np = parseNP(m[1]); if (!np) return null; const mods = { power: 0, defense: 0, critical: 0, kws: [] }; mods[lc(m[2])] = (m[3] === "-" ? -1 : 1) * parseInt(m[4].replace(/,/g, ""), 10); return { op: "boost", np, mods }; });
  ar(/^(?:the |that )?(?:size|power|defense|critical) of (.+?) (?:is|are) (?:reduced|increased) by (\d+)$/i, () => null);

  /* ---------- restrictions ---------- */
  ar(/^(.+?) cannot (?:be )?(attack|destroyed|\[?rest\]?|returned to hand|called|\[?stand\]?|nullified|put into the drop zone|put to other areas)(?:(?: or| and| nor) (?:be )?(?:destroyed|returned to hand|\[?rest\]?|\[?stand\]?|nullified|put into the drop zone))*(?: by (?:your opponent's |the )?(?:card )?(?:effects?|abilities))?$/i, (m) => {
    const np = parseNP(m[1]); if (!np) return null;
    const kinds = (m[0].match(/destroyed|returned to hand|\[?rest\]?|\[?stand\]?|nullified|put into the drop zone|attack|called|put to other areas/ig) || []).map(x => lc(x).replace(/[\[\]]/g, ""));
    return { op: "restrict", np, kinds: Array.from(new Set(kinds)), byOpp: /opponent/i.test(m[0]) };
  });

  /* ---------- call ---------- */
  ar(/^call (.+?)(?: (?:from|in) (your (?:hand|drop zone|soul|deck)|(?:this card's|its) soul|the soul of .+|your hand or drop zone|your drop zone or hand))?(?: (?:to|on|onto) (?:the |your )?(center|left|right|open area))?(?: by paying its \[call cost\]| without paying its \[call cost\]| without paying its call cost| by paying its call cost)?$/i, (m) => {
    const text = m[0];
    const np = parseNP(m[1] + (m[2] ? " from " + m[2].replace(/^(?:this card's|its) soul$/i, "this card's soul") : ""));
    if (!np) return null;
    return { op: "call", np, pay: /by paying/i.test(text), free: /without paying/i.test(text), pos: m[3] ? lc(m[3]) : null };
  });

  /* ---------- search ---------- */
  ar(/^search your deck for (.+?)(?:,? (?:and )?(?:put|add) (?:it|them|that card|those cards) (?:into|to|in) (?:your )?(hand|drop zone|gauge|the soul of .+|this card's soul|its soul))?(?:,? and shuffle your deck)?$/i, (m) => {
    const np = parseNP(m[1]); if (!np) return null;
    const to = m[2] ? (/soul/i.test(m[2]) ? { area: "soul", owner: "host", host: "self" } : { area: lc(m[2]), owner: "you", end: "top" }) : null;
    return { op: "search", np, to, shuffle: /shuffle/i.test(m[0]) || true };
  });

  /* ---------- misc ---------- */
  ar(/^(?:you may )?(?:charge|\[charge\]) (?:and draw)$/i, () => null);
  ar(/^(?:flip|reverse) this card$/i, () => ({ op: "noop" }));


  /* ===================== BATCH 2: statics, shields, size, stack, hand/soul/life ===================== */
  const SDEF = (kind, extra) => (extra ? Object.assign({ op: "static", kind }, extra) : { op: "static", kind });

  // --- attack permissions / restrictions (checked by the attack code) ---
  ar(/^(?:this card|it) can attack (?:your opponent |the opponent )?even if (?:there (?:is|are)|(?:your opponent|they|you) (?:has|have)) (.+)$/i, (m) => SDEF("attackThrough", { np: parseNP(m[1]), raw: m[1] }));
  ar(/^you can attack with this card even if (?:you have|there (?:is|are)) (.+)$/i, (m) => SDEF("attackThrough", { np: parseNP(m[1]), raw: m[1] }));
  ar(/^this card can attack even if (?:you have|there (?:is|are)|an? |a ) ?(.+)$/i, (m) => SDEF("attackThrough", { np: parseNP(m[1]), raw: m[1] }));
  ar(/^this card can attack during your final phase$/i, () => SDEF("attackInFinal"));
  ar(/^(?:this card|it) cannot attack(?: the)? (?:the )?(left|center) or (?:the )?(right|center)(?: with this card)?$|^you cannot attack the (left|center) or (right|center) with this card$/i, () => SDEF("noAttackPos", { pos: ["left", "right"] }));
  ar(/^this card cannot attack$/i, () => SDEF("cannotAttack"));
  ar(/^this card can only be called (?:to|on) (?:the |your )?(center|left|right)$/i, (m) => SDEF("callOnlyAt", { pos: lc(m[1]) }));
  ar(/^this card cannot be called(?: to the (center|left|right))?$/i, (m) => SDEF("cannotCall", { pos: m[1] ? lc(m[1]) : null }));
  ar(/^this card cannot enter the field other than by (.+)$/i, (m) => SDEF("callOnlyBy", { raw: m[1] }));
  ar(/^this card can only be called by (.+?) effects?$/i, (m) => SDEF("callOnlyBy", { raw: m[1] }));
  ar(/^this card can only enter the field if (.+)$/i, (m) => { const c = ABX.parseCondition(m[1]); return c ? SDEF("callIf", { cond: c }) : null; });
  ar(/^this card can be your buddy$/i, () => SDEF("canBeBuddy"));
  ar(/^this card can attack your opponent even if (?:they|your opponent) (?:has|have) (.+)$/i, (m) => SDEF("attackThrough", { np: parseNP(m[1]), raw: m[1] }));
  ar(/^you cannot call monsters to your (center|left|right)$/i, (m) => SDEF("noCallPos", { pos: lc(m[1]) }));
  ar(/^your opponent cannot call monsters from the drop zone$/i, () => SDEF("oppNoCallFromDrop"));
  ar(/^this card cannot get \[([^\]]+)\]$/i, (m) => SDEF("cannotGetKw", { kw: lc(m[1]) }));

  // --- nullify / reduce immunity ---
  ar(/^(?:this card|it|this monster)(?:'s attack)? cannot be nullified(?:,? (?:and|nor) (?:its|the|this card's) damage cannot be reduced)?(?: if (?:it is|this card is) attacking alone| if it is not a link attack)?$/i, (m) => SDEF("unnullifiable", { noReduce: /damage/i.test(m[0]), cond: /attacking alone/i.test(m[0]) ? "alone" : /not a link/i.test(m[0]) ? "notLink" : null }));
  ar(/^(?:this card's|its|this|the) (?:attack |damage )?(?:damage )?cannot be reduced(?: if (?:it is|this card is) attacking alone)?$/i, (m) => SDEF("unreducible", { cond: /alone/i.test(m[0]) ? "alone" : null }));
  ar(/^(?:the )?damage (?:dealt )?(?:by this card|to your opponent by this card) cannot be reduced(?: if (?:it is|this card is) attacking alone)?$/i, (m) => SDEF("unreducible", { cond: /alone/i.test(m[0]) ? "alone" : null }));
  ar(/^(?:this card|it) cannot be nullified,? and (?:the )?damage cannot be reduced$/i, () => SDEF("unnullifiable", { noReduce: true }));
  ar(/^this damage cannot be reduced$/i, () => SDEF("unreducible"));
  ar(/^this card(?: on the field)? cannot be (destroyed|returned to hand|\[?rest\]?|put into the drop zone)(?:(?:,| or| nor|, nor|,? and) (?:be )?(?:its abilities cannot be nullified|destroyed|returned to hand|\[?rest\]?|nullified))*(?: by (?:your opponent's|effects from your opponent's) (?:card )?(?:effects?|cards?|abilities))?$/i, (m) => {
    const kinds = (m[0].match(/destroyed|returned to hand|\[?rest\]?|put into the drop zone|nullified/ig) || []).map(x => lc(x).replace(/[\[\]]/g, ""));
    return SDEF("protect", { kinds: Array.from(new Set(kinds)), byOpp: /opponent/i.test(m[0]), self: true });
  });
  ar(/^this card(?: on the field)? cannot be destroyed(?: or returned to hand)?,? (?:nor returned to hand )?(?:and )?(?:its|their) abilities cannot be nullified(?:,? and it can attack during your final phase)?$/i, () => SDEF("protect", { kinds: ["destroyed", "returned to hand", "nullified"], self: true }));
  ar(/^(?:all |the )?(.+?) (?:on (?:your|the) field )?cannot be (destroyed|returned to hand|\[?rest\]?|nullified)(?:(?:,| or| nor|, nor|,? and) (?:be )?(?:their abilities cannot be nullified|destroyed|returned to hand|\[?rest\]?|nullified))*(?: by (?:your opponent's|effects from your opponent's) (?:card )?(?:effects?|cards?|abilities))?$/i, (m) => {
    const np = parseNP(m[1].replace(/\s+on your field$/i, "") + " on your field"); if (!np) return null;
    const kinds = (m[0].match(/destroyed|returned to hand|\[?rest\]?|nullified/ig) || []).map(x => lc(x).replace(/[\[\]]/g, ""));
    return SDEF("protect", { np, kinds: Array.from(new Set(kinds)), byOpp: /opponent/i.test(m[0]) });
  });

  // --- damage shields / replacement of damage ---
  ar(/^(?:for this turn, )?(?:the )?next (?:time )?(?:that )?damage (?:you take|would be dealt to you|dealt to you)(?: this turn)?(?: from attacks)?,? (?:is |it is )?reduced (?:by (\d+)|to (0|zero))$/i, (m) => ({ op: "shield", mode: "next", reduceBy: m[1] ? +m[1] : null, toZero: !!m[2], from: /from attacks/i.test(m[0]) ? "attack" : "any" }));
  ar(/^(?:for this turn, )?the next time damage would be dealt to you(?: this turn)?,? it is reduced (?:by (\d+)|to (0|zero))(?:,? and you gain (\d+) life)?$/i, (m) => ({ op: "shield", mode: "next", reduceBy: m[1] ? +m[1] : null, toZero: !!m[2], gainLife: m[3] ? +m[3] : 0 }));
  ar(/^for this turn, the next (?:time )?(?:damage|that damage)(?: you take| would be dealt to you)(?: from attacks)?,? (?:is |it is )?reduced (?:by (\d+)|to (0|zero))$/i, (m) => ({ op: "shield", mode: "next", reduceBy: m[1] ? +m[1] : null, toZero: !!m[2] }));
  ar(/^for this turn, damage (?:you take|dealt to you) (?:are|is) reduced by (\d+)$/i, (m) => ({ op: "shield", mode: "turn", reduceBy: +m[1] }));
  ar(/^for this turn, (?:you do not take|you will not take|you cannot take) damage(?: from (attacks|impact effects|your opponent's card effects))?(?: by your opponent's card effects)?$/i, (m) => ({ op: "shield", mode: "turn", toZero: true, from: m[1] ? (/attack/i.test(m[1]) ? "attack" : /impact/i.test(m[1]) ? "impact" : "effect") : (/effects/i.test(m[0]) ? "effect" : "any") }));
  ar(/^that damage is reduced (?:by (\d+)|to (0|zero))(?:,? and you gain (\d+) life)?$/i, (m) => ({ op: "shield", mode: "this", reduceBy: m[1] ? +m[1] : null, toZero: !!m[2], gainLife: m[3] ? +m[3] : 0 }));
  ar(/^other than damage dealt by an attack, damage dealt to you is reduced by (\d+)$/i, (m) => SDEF("damageReduceStatic", { reduceBy: +m[1], from: "nonAttack" }));
  ar(/^if you would be dealt (\d+) or greater damage,? that damage is reduced by (\d+)$/i, (m) => SDEF("damageReduceStatic", { reduceBy: +m[2], min: +m[1] }));
  ar(/^for this turn, you cannot take damage by your opponent's card effects$/i, () => ({ op: "shield", mode: "turn", toZero: true, from: "effect" }));

  // --- size modification statics ---
  ar(/^(?:this card's size on the field|the size of this card on your (?:field|left or right)|this card on the field gets size|this card's size) (?:is )?(?:reduced|gets reduced) by (\d+)$/i, (m) => SDEF("sizeMod", { delta: -(+m[1]) }));
  ar(/^(?:this card on the field gets size reduced by|reduce the size of this card on your field by) (\d+)$/i, (m) => SDEF("sizeMod", { delta: -(+m[1]) }));
  ar(/^(?:that card|this card) becomes (?:a )?size 0(?: monster)?(?: until it leaves the field| as long as .+)?$/i, (m) => ({ op: "setSize0", np: /^this/i.test(m[0]) ? { self: true, qty: { n: 1 }, filter: {}, raw: "this card" } : { ref: "chosen", qty: { n: 1 }, filter: {}, raw: "that card" } }));
  ar(/^the size of (?:all )?(?:originally size (\d+) )?(.+?) on your field is reduced by (\d+)$/i, (m) => { const np = parseNP(m[2] + " on your field"); return np ? SDEF("sizeModOthers", { np, delta: -(+m[3]), origSize: m[1] ? +m[1] : null }) : null; });
  ar(/^the gauge cost written in its \[call cost\] is reduced by (\d+)$/i, (m) => SDEF("callCostReduce", { delta: +m[1] }));
  ar(/^the \[(cast|call|equip) cost\] of each of your (.+?) is reduced by (\d+) gauge$/i, (m) => SDEF("costReduceFor", { kind: lc(m[1]), np: parseNP(m[2]), delta: +m[3] }));

  // --- stack / ride-like ---
  ar(/^put (?:this card|this|it) on top of (?:up to one |a |an )?(.+?)(?: on your field)?$/i, (m) => { const np = parseNP(m[1] + " on your field"); return np ? { op: "stackOnTop", np } : null; });
  ar(/^put (?:this card|this|it) (?:into|in) (?:the )?soul of (?:a |an |up to one )?(.+?)$/i, (m) => { const np = parseNP(m[1]); return np ? { op: "putSelfInSoul", np } : null; });
  ar(/^put this card (?:into|in) its soul$/i, () => ({ op: "noop", note: "self-soul" }));
  ar(/^put (?:the top )?(?:(\w+) )?cards? of your deck (?:into|in|on) this monster's soul$/i, (m) => ({ op: "mill", who: "you", n: toNum(m[1] || "a") || 1, to: "soul", host: "self" }));
  ar(/^put up to (\w+) cards? from your hand (?:face down )?(?:into|in) this card's soul$/i, (m) => ({ op: "handToSoul", n: toNum(m[1]), host: "self" }));
  ar(/^put (?:a|an|one) (.+?) from your hand (?:face down )?(?:into|in) this card's soul$/i, (m) => ({ op: "handToSoul", n: 1, np: parseNP(m[1]), host: "self" }));
  ar(/^(?:you may )?(?:drop|discard) (?:up to )?(\w+) souls? from (?:this card|a card on your opponent's field|a character on your opponent's field|a monster on your opponent's field)$/i, (m) => ({ op: "dropSoul", n: toNum(m[1]), host: /opponent/i.test(m[0]) ? "oppChoose" : "self" }));
  ar(/^(?:drop|discard) a soul from this card$/i, () => ({ op: "dropSoul", n: 1, host: "self" }));
  ar(/^put up to (\w+) souls? from (?:a|an) (?:card|character|monster) on your opponent's field (?:into|in) the drop zone$/i, (m) => ({ op: "dropSoul", n: toNum(m[1]), host: "oppChoose" }));

  // --- hand / life / turn-flow ---
  ar(/^(?:you )?(?:discard|drop) (?:your entire hand|all (?:your )?hand cards)$/i, () => ({ op: "discard", all: true }));
  ar(/^(?:you )?(?:discard|drop) (\w+) hand cards?$/i, (m) => ({ op: "discard", n: toNum(m[1]) || 1 }));
  ar(/^your opponent chooses (?:a|one) (?:card )?(?:from their hand )?and (?:discards|drops) it$|^your opponent chooses and (?:drops|discards) (?:a|one) hand card$|^your opponent chooses a card from their hand and discards it$/i, () => ({ op: "oppDiscard", n: 1 }));
  ar(/^your life becomes (\d+)$/i, (m) => ({ op: "setLife", who: "you", n: +m[1] }));
  ar(/^(?:you )?take (\d+|one|two|three) damage$/i, (m) => ({ op: "damage", who: "you", n: toNum(m[1]) }));
  ar(/^deal (\d+|a|one|two|three|four|five|six|seven|eight|nine|ten) damage to (?:the|your) opponent$/i, (m) => ({ op: "damage", who: "opp", n: toNum(m[1]) }));
  ar(/^deal (\d+|a|one|two|three) damage to yourself$/i, (m) => ({ op: "damage", who: "you", n: toNum(m[1]) }));
  ar(/^end the (?:final|attack|main) phase$/i, (m) => ({ op: "endPhase", phase: lc(m[0].match(/final|attack|main/i)[0]) }));
  ar(/^(?:you get|get) another (attack phase|turn)$/i, (m) => ({ op: "extraPhase", what: /turn/i.test(m[1]) ? "turn" : "attack" }));
  ar(/^after this turn,? you get another turn$/i, () => ({ op: "extraPhase", what: "turn" }));
  ar(/^reveal the top (?:(\d+|one|two|three|four|five|six|seven) )?cards? of your deck$/i, (m) => ({ op: "reveal", n: toNum(m[1] || "one") || 1 }));
  ar(/^pay (\d+|a|one|two|three) (?:of )?(?:your )?opponent's gauge$/i, (m) => ({ op: "moveZone", from: { area: "gauge", owner: "opp" }, to: { area: "drop zone", owner: "opp" }, n: toNum(m[1]), cost: true }));
  ar(/^(?:then,? )?shuffle (?:your|the) deck$/i, () => ({ op: "shuffle", who: "you" }));
  arw(/^if you (?:looked in|searched) your deck,? shuffle it$/i, () => ({ op: "shuffle", who: "you" }));
  ar(/^then,? put the (?:revealed )?cards? (?:revealed )?on the bottom of (?:your|the) deck(?: in any order)?$/i, (m) => ({ op: "move", np: { ref: "revealed", qty: { all: true, n: 99 }, filter: {}, raw: "revealed" }, to: { area: "deck", owner: "you", end: "bottom" }, order: /any order/i.test(m[0]) ? "any" : null }));
  ar(/^put the (?:revealed )?cards? revealed on the bottom of (?:your|the) deck$/i, () => ({ op: "move", np: { ref: "revealed", qty: { all: true, n: 99 }, filter: {}, raw: "revealed" }, to: { area: "deck", owner: "you", end: "bottom" } }));
  ar(/^put the revealed cards on the bottom of your deck(?: in any order)?$/i, (m) => ({ op: "move", np: { ref: "revealed", qty: { all: true, n: 99 }, filter: {}, raw: "revealed" }, to: { area: "deck", owner: "you", end: "bottom" }, order: /any order/i.test(m[0]) ? "any" : null }));
  ar(/^nullify the (spell|impact|call|cast)(?: cast| that was cast)? (?:by your opponent|of your opponent)?$|^nullify the (?:spell|impact) cast by your opponent$|^nullify the call$/i, (m) => ({ op: "nullifyCast" }));
  ar(/^nullify the attack if it is not a link attack$|^if it is not a link attack,? nullify the attack$/i, () => ({ op: "nullifyAttack", unlessLink: true }));
  ar(/^that (?:card|monster)? ?remains on (?:the|your) field$|^this card remains on (?:the|your) field$|^(?:it|that card) remains on (?:the|your) field$/i, () => ({ op: "preventLeave" }));
  ar(/^(?:you may )?prevent (?:it|that card|this card) from leaving the field$/i, () => ({ op: "preventLeave" }));
  ar(/^(?:the chosen (?:card|monster)|that (?:card|monster)|it) cannot (attack|destroyed|be destroyed)(?: this turn)?$/i, (m) => ({ op: "restrict", np: { ref: "chosen", qty: { n: 1 }, filter: {}, raw: "chosen" }, kinds: [/destroy/i.test(m[1]) ? "destroyed" : "attack"], duration: "turn" }));
  ar(/^(?:the chosen card|that card|it) cannot \[?stand\]?(?: this turn)?$/i, () => ({ op: "restrict", np: { ref: "chosen", qty: { n: 1 }, filter: {}, raw: "chosen" }, kinds: ["stand"], duration: "turn" }));
  ar(/^nullify all abilities of (.+)$/i, (m) => { const np = parseNP(m[1].replace(/ and destroy it$/i, "")); return np ? { op: "nullifyAbilities", np, thenDestroy: /destroy it$/i.test(m[1]) } : null; });
  ar(/^look at all of your gauge$|^look at your gauge$/i, () => ({ op: "noop" }));
  ar(/^declare (?:either )?monster or spell$/i, () => ({ op: "noop" }));
  ar(/^that card (?:is|are) put (?:into|to) the drop zone$/i, () => ({ op: "move", np: { ref: "chosen", qty: { all: true, n: 99 }, filter: {}, raw: "chosen" }, to: { area: "drop zone", owner: "owner" } }));
  ar(/^(?:then,? )?(?:put|drop) it (?:into|in) the drop zone$/i, () => ({ op: "move", np: { ref: "chosen", qty: { all: true, n: 99 }, filter: {}, raw: "chosen" }, to: { area: "drop zone", owner: "owner" } }));
  ar(/^no ability text$/i, () => ({ op: "noop" }));

  // --- more movement forms ("Put a monster from your field into the drop zone" with plural / numbers) ---
  ar(/^put (\w+) (.+?) from your (field|hand|gauge) (?:into|to) (?:the |your )?(drop zone|gauge|hand)$/i, (m) => {
    const np = parseNP(m[1] + " " + m[2] + " from your " + m[3]); if (!np) return null;
    return { op: "move", np, to: { area: lc(m[4]), owner: "you", end: "top" } };
  });
  ar(/^return (?:all )?cards? from your drop zone to your deck$/i, () => ({ op: "move", np: { qty: { all: true, n: 99 }, filter: {}, zone: { owner: "you", area: "drop zone" }, raw: "all cards from your drop zone" }, to: { area: "deck", owner: "you", end: "top" } }));
  arw(/^return all cards from your drop zone to your deck(?:, and shuffle your deck)?$/i, () => ({ op: "move", np: { qty: { all: true, n: 99 }, filter: {}, zone: { owner: "you", area: "drop zone" }, raw: "all cards from your drop zone" }, to: { area: "deck", owner: "you", end: "top" }, thenShuffle: true }));
  ar(/^(?:put|move) (.+?) (?:from|in) your (?:drop zone|gauge|hand) (?:to|into|on) (?:the )?(?:bottom|top) of your deck$/i, () => null);

  // --- boost phrasing: "Choose a «X» in battle, and for this battle, give it power+3000 ..." ---
  ar(/^give (it|them|that card|the chosen card|the chosen cards) (.+)$/i, (m) => {
    const mods = parseStatMods(m[2]); if (!mods) return null;
    return { op: "boost", np: { ref: "chosen", qty: { all: true, n: 99 }, filter: {}, raw: m[1] }, mods };
  });
  ar(/^give (.+?) (.*(?:power|defense|critical)\s*[+\-]\s*\d.*)$/i, (m) => { const np = parseNP(m[1]); const mods = parseStatMods(m[2]); return np && mods ? { op: "boost", np, mods } : null; });
  ar(/^for (?:this|that) (?:turn|battle|fight),? (.+)$/i, () => null);


  /* ===================== BATCH 3 ===================== */
  ar(/^change the target of the attack to (?:this card|this monster|this item)$/i, () => ({ op: "redirectAttack" }));
  ar(/^(?:for this turn, )?nullify the attacking card's \[?([^\]]+?)\]?$/i, (m) => ({ op: "nullifyKeyword", kw: lc(m[1]) }));
  ar(/^your opponent cannot \[counter\](?: against this ability)?$/i, () => ({ op: "noCounter" }));
  ar(/^(?:you )?pay (\d+|a|one|two|three) gauge and \[rest\] this card$/i, (m) => ({ op: "pay", gauge: toNum(m[1]), cost: true, restSelf: true }));
  ar(/^(?:then,? )?you take (\d+|one|two|three) damage$/i, (m) => ({ op: "damage", who: "you", n: toNum(m[1]) }));
  ar(/^(?:the )?(?:power|defense|critical) of (.+?) cannot be reduced(?: by your opponent's card effects)?$/i, (m) => { const np = parseNP(m[1]); return np ? SDEF("noStatReduce", { np }) : null; });
  ar(/^this card is (?:also )?treated as "[^"]+"$/i, () => SDEF("alsoTreatedAs"));
  ar(/^play "rock-paper-scissors" with your opponent(?: only once)?$/i, () => ({ op: "rps" }));
  ar(/^start the fight with this side of the card$/i, () => ({ op: "noop" }));
  ar(/^you may buddy call using this card$/i, () => SDEF("buddyCallUsing"));
  ar(/^(?:use|choose and use) one of the following(?: abilities| two| three)?$/i, () => ({ op: "modalMarker" }));
  ar(/^this card gets all the \[d\] of \[d-share\] in its soul$/i, () => SDEF("dShareCollect"));
  ar(/^if (?:it|that card) is not,? put it on the bottom of your deck$/i, () => ({ op: "noop", note: "reveal-not-matching" }));

  /*@@MORE_ACTIONS@@*/

  /* ============================================================
   * 6. SENTENCE -> STEPS
   * ============================================================ */
  const VERB_START = "(?:draw|destroy|deal|gain|put|call|drop|return|\\[rest\\]|\\[stand\\]|rest|stand|choose|look|search|shuffle|reveal|discard|pay|nullify|you |your |for |this |that |the chosen|it |they |each |all |another|up to|add|move|set|equip|transform|take|lose|replace|if |when |then|also|instead|but |end |give |cannot|a |an |one )";
  const SEG_SPLIT = new RegExp(",\\s*(?:and\\s+)?(?:then,?\\s*)?(?=" + VERB_START + ")|\\s+and\\s+(?=(?:draw|destroy|deal|gain|put|call|drop|return|\\[rest\\]|\\[stand\\]|choose|look|search|shuffle|reveal|discard|pay|nullify|give|you |your opponent|end )\\b)|\\.\\s*(?=then,?\\s)|,?\\s+then,?\\s+|\\s*\\bthen,\\s*", "i");

  function splitSegments(sentence) {
    // avoid splitting inside quotes / brackets
    const out = [];
    let depth = 0, cur = "", inQ = false;
    const s = sentence;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') inQ = !inQ;
      if (!inQ) { if (ch === "[" || ch === "«" || ch === "(") depth++; else if (ch === "]" || ch === "»" || ch === ")") depth--; }
      cur += ch;
      if (!inQ && depth === 0 && (ch === "," || ch === "." || ch === ";")) {
        const rest = s.slice(i + 1);
        out.push(cur); cur = "";
        if (!rest.trim()) break;
      }
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  // Break one sentence into clause chunks, splitting only where a new clause starts.
  function splitClauses(sentence) {
    const s = stripEnd(ABX.norm(sentence));
    const pieces = [];
    const re = /,\s*(?:and\s+)?(?:then,?\s*)?|\s+and\s+(?=(?:draw|destroy|deal|gain|put|call|drop|return|\[rest\]|\[stand\]|choose|look|search|shuffle|reveal|discard|pay|nullify|give|end|you |your opponent|this card)\b)|\s+then,?\s+|\.\s+(?=then\b)/ig;
    let last = 0, m;
    // iterate over split points, but don't split inside quotes / brackets
    const inside = (idx) => {
      let q = 0, b = 0;
      for (let i = 0; i < idx; i++) { const c = s[i]; if (c === '"') q ^= 1; else if (!q) { if (c === "[" || c === "«" || c === "(" || c === "<") b++; else if (c === "]" || c === "»" || c === ")" || c === ">") b--; } }
      return q || b > 0;
    };
    while ((m = re.exec(s))) {
      if (inside(m.index)) continue;
      const nextStart = s.slice(m.index + m[0].length);
      // only split where the next text begins a clause (action verb / pronoun / condition)
      if (!new RegExp("^" + VERB_START, "i").test(nextStart) && !/^(?:and |then)/i.test(m[0].trim())) continue;
      pieces.push({ text: s.slice(last, m.index), sep: m[0] });
      last = m.index + m[0].length;
    }
    pieces.push({ text: s.slice(last), sep: "" });
    return pieces.filter(p => p.text.trim());
  }

  ABX.splitClauses = splitClauses;

  function parseAction(text, wholeOnly) {
    const t = stripEnd(ABX.norm(text));
    for (const [re, fn, isWhole] of ACTION_RULES) {
      if (isWhole && !wholeOnly) continue;
      if (wholeOnly && !isWhole) continue;
      const m = t.match(re);
      if (m) {
        let r = null;
        try { r = fn(m); } catch (e) { r = null; }
        if (r) { r.src = t; return r; }
      }
    }
    return null;
  }
  ABX.parseAction = parseAction;
  ABX.ACTION_RULES = ACTION_RULES; ABX.COND_RULES = COND_RULES;

  /* sentence-level prefix handling -> {optional, forThisTurn, text} */
  function peelPrefix(t) {
    const info = { optional: false, turn: null, ifYouDo: false };
    let s = t;
    let again = true;
    while (again) {
      again = false;
      let m;
      if ((m = s.match(/^(?:for|during) (?:this|that) (turn|battle|fight)(?: and the next turn)?,?\s*/i))) { info.turn = lc(m[1]) === "turn" ? "turn" : lc(m[1]); if (/next turn/i.test(m[0])) info.turn = "next"; s = s.slice(m[0].length); again = true; }
      else if ((m = s.match(/^you may /i))) { info.optional = true; s = s.slice(m[0].length); again = true; }
      else if ((m = s.match(/^(?:if you do|if you did|if you can),?\s*/i))) { info.ifYouDo = true; s = s.slice(m[0].length); again = true; }
      else if ((m = s.match(/^(?:then|also|and),?\s*/i))) { s = s.slice(m[0].length); again = true; }
      else if ((m = s.match(/^up to /i)) && false) { s = s; }
    }
    info.text = s;
    return info;
  }

  // Returns { steps, unparsed } for one sentence (already stripped of tags/trigger).
  ABX.parseSentenceSteps = function (sentence, ctxState) {
    const steps = [];
    const unparsed = [];
    let condStack = (ctxState && ctxState.conds ? ctxState.conds.slice() : []);
    let ifYouDoPending = false;
    let elsePending = false;
    {
      const whole = parseAction(sentence, true);
      if (whole) { return { steps: [whole], unparsed: [] }; }
    }
    const pieces = splitClauses(sentence);
    for (let pi = 0; pi < pieces.length; pi++) {
      let txt = pieces[pi].text;
      let carry = "";
      // glue a piece that failed to parse onto its neighbour (the split may have been wrong)
      const info = peelPrefix(stripEnd(txt));
      let work = info.text;
      if (info.ifYouDo && !work) { ifYouDoPending = true; continue; }
      if (!work) continue;
      if (/^if you do not\b|^otherwise\b|^if you did not\b/i.test(stripEnd(txt))) {
        const rest = stripEnd(txt).replace(/^(?:if you do not|if you did not|otherwise),?\s*/i, "");
        if (!rest) { elsePending = true; continue; }
        txt = rest; work = rest; elsePending = true;
      }
      // condition clause ("if ..." / "when ...") applies to the clauses that follow
      let cm = work.match(/^(if|when|while)\s+(.+)$/i);
      if (cm && !/^if you do\b/i.test(work)) {
        const cond = ABX.parseCondition(work);
        if (cond) { condStack.push(cond); continue; }
        // "if X, Y" where the comma was not split: try to find the comma
        const commaIdx = [...work.matchAll(/,\s*/g)].map(x => x.index);
        let done = false;
        for (const ci of commaIdx) {
          const c2 = ABX.parseCondition(work.slice(0, ci));
          const rest = work.slice(ci).replace(/^,\s*/, "");
          if (c2) { condStack.push(c2); pieces.splice(pi + 1, 0, { text: rest, sep: "" }); done = true; break; }
        }
        if (done) continue;
        unparsed.push(txt.trim());
        continue;
      }
      let act = parseAction(work);
      // try merging with following pieces when the split cut an NP in half
      let extra = 0;
      while (!act && extra < 3 && pi + 1 + extra < pieces.length) {
        work = work + (pieces[pi + extra].sep || ", ") + pieces[pi + 1 + extra].text;
        act = parseAction(work);
        extra++;
        if (act) pi += extra;
      }
      if (!act) { unparsed.push(txt.trim()); continue; }
      if (info.optional) act.optional = true;
      if (info.turn) act.duration = info.turn;
      if (info.ifYouDo || ifYouDoPending) act.gate = "ifYouDo";
      if (elsePending) act.gate = "ifNotDone";
      if (condStack.length) act.cond = condStack.length === 1 ? condStack[0] : { t: "and", list: condStack.slice() };
      steps.push(act);
    }
    return { steps, unparsed };
  };

  /* ============================================================
   * 7. LINE-LEVEL PARSE (tags, names, triggers, limits)
   * ============================================================ */
  const TRIGGER_RULES = [];
  const tr = (re, fn) => TRIGGER_RULES.push([re, fn]);
  ABX.TRIGGER_RULES = TRIGGER_RULES;

  const SUBJ_THIS = "this (?:card|monster|item|spell|impact|flag)";
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " enters the field(?: (?:from|by) .+?)?$", "i"), () => ({ event: "enter", self: true }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:is |was )?(?:called|put onto the field)$", "i"), () => ({ event: "enter", self: true }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " attacks(?: (.+))?$", "i"), (m) => ({ event: "attack", self: true, target: m[1] ? parseNP(m[1]) : null }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:attacks|attacked) and (?:is )?(?:blocked|not nullified)$", "i"), () => ({ event: "attack", self: true }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:is )?(?:destroyed|put into the drop zone|put from the field into the drop zone|put from the field to the drop zone|leaves the field|is put to the drop zone)(?: by (?:your opponent's|an opponent's) (?:card|attack|card effect|effect)s?)?$", "i"), (m) => ({ event: "leave", self: true, byOpp: /opponent/i.test(m[0]), destroyedOnly: /destroyed/i.test(m[0]) && !/leaves|put/i.test(m[0]) }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:is )?(?:put into the drop zone|discarded|dropped)$", "i"), () => ({ event: "dropped", self: true }));
  tr(new RegExp("^(?:when|whenever|each time) (?:an attack by|the attack of|the attack by) " + SUBJ_THIS + " (?:is )?(?:destroys? (?:an? |your |the )?(?:opponent's )?(?:monsters?|cards?)|nullified|destroys a monster)$", "i"), (m) => ({ event: /nullified/i.test(m[0]) ? "attackNullified" : "attackDestroys", self: true }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:destroys|destroyed) (?:an? )?(.+?) (?:in battle|by an attack)?$", "i"), (m) => ({ event: "attackDestroys", self: true, np: parseNP(m[1]) }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:is attacked|is being attacked)$", "i"), () => ({ event: "attacked", self: true }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:links?|link attacks?)$", "i"), () => ({ event: "link", self: true }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " (?:is )?(?:equipped|cast|set|put into the soul|put into the gauge|put into the hand|returned to hand)$", "i"), (m) => ({ event: lc(m[0]).includes("cast") ? "cast" : "etc", self: true }));
  tr(/^(?:at|on) the (start|beginning) of (your|your opponent's|each player's|the) (main|attack|final|start|draw|turn)(?: phase)?$/i, (m) => ({ event: "phaseStart", who: ownerOf(m[2]), phase: lc(m[3]) }));
  tr(/^at the (start|beginning) of (your|your opponent's|each player's|the) turn$/i, (m) => ({ event: "turnStart", who: ownerOf(m[2]) }));
  tr(/^at the end of (your|your opponent's|each player's|the) turn$/i, (m) => ({ event: "turnEnd", who: ownerOf(m[1]) }));
  tr(/^at (?:the )?end of (?:the )?turn$/i, () => ({ event: "turnEnd", who: "any" }));
  tr(/^at the end of (?:your|each player's) (?:attack|main|final) phase$/i, (m) => ({ event: "phaseEnd" }));
  tr(/^at the end of (?:the|a) battle(?: that (?:this card|a monster) attacked)?$/i, () => ({ event: "battleEnd", self: /this card/i.test("") }));
  tr(new RegExp("^at the end of the battle (?:that|in which) " + SUBJ_THIS + " attacked$", "i"), () => ({ event: "battleEnd", self: true }));
  tr(/^at the end of the battle of this card$/i, () => ({ event: "battleEnd", self: true }));
  tr(/^at the end of the (?:final|attack|main) phase$/i, () => ({ event: "phaseEnd" }));
  tr(/^(?:when|whenever|each time) you cast (.+)$/i, (m) => ({ event: "youCast", np: parseNP(m[1]) }));
  tr(/^(?:when|whenever|each time) your opponent casts (.+)$/i, (m) => ({ event: "oppCast", np: parseNP(m[1]) }));
  tr(/^(?:when|whenever|each time) (?:a|an) (.+?) enters (?:the field|your field|your opponent's field)$/i, (m) => ({ event: "otherEnter", np: parseNP(m[1] + (/opponent's field/i.test(m[0]) ? " on your opponent's field" : "")), opp: /opponent's field/i.test(m[0]) }));
  tr(/^(?:when|whenever|each time) (?:a|an|another) (.+?) (?:on|from) (?:your|the|your opponent's) field is destroyed$/i, (m) => ({ event: "otherDestroyed", np: parseNP(m[1] + " " + (/opponent's field/i.test(m[0]) ? "on your opponent's field" : "on your field")), opp: /opponent's field/i.test(m[0]) }));
  tr(/^(?:when|whenever|each time) (?:a|an|another) (.+?) on your field attacks$/i, (m) => ({ event: "otherAttack", np: parseNP(m[1] + " on your field") }));
  tr(/^(?:when|whenever|each time) (?:you|your opponent) (?:take|takes|are dealt|is dealt) damage$|^(?:when|whenever|each time) damage is dealt to you$/i, (m) => ({ event: "damaged", who: /your opponent/i.test(m[0]) ? "opp" : "you" }));
  tr(/^(?:when|whenever|each time) (?:you|your opponent) (?:gain|gains) life$/i, () => ({ event: "lifeGain" }));
  tr(/^(?:when|whenever|each time) (?:a|an) (.+?) (?:is destroyed|leaves the field)$/i, (m) => ({ event: "otherDestroyed", np: parseNP(m[1]) }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " deals damage to your opponent$", "i"), () => ({ event: "dealsDamage", self: true }));
  tr(/^(?:when|whenever|each time) (?:your|a) (.+?) deals damage to your opponent$/i, (m) => ({ event: "dealsDamage", np: parseNP(m[1] + " on your field") }));
  tr(/^(?:when|whenever|each time) you equip this card$/i, () => ({ event: "equipped", self: true }));
  tr(/^(?:when|whenever|each time) your opponent equips an? (.+)$/i, (m) => ({ event: "oppEquip", np: parseNP(m[1]) }));
  tr(/^(?:when|whenever|each time) (?:your opponent's|an opponent's) (?:cards?|monsters?|items?) attacks?$/i, () => ({ event: "oppAttack" }));
  tr(/^(?:when|whenever|each time) your opponent's cards? attacks?$/i, () => ({ event: "oppAttack" }));
  tr(/^(?:when|whenever|each time) (?:a|an) (.+?) on your field is destroyed$/i, (m) => ({ event: "otherDestroyed", np: parseNP(m[1] + " on your field") }));
  tr(/^(?:when|whenever|each time) (?:a|an|another) (.+?) on your opponent's field is destroyed(?: by an attack)?$/i, (m) => ({ event: "otherDestroyed", opp: true, np: parseNP(m[1] + " on your opponent's field") }));
  tr(/^(?:when|whenever|each time) your opponent(?: casts?| cast) (?:an? )?(spell|impact|monster|item)s?$/i, (m) => ({ event: "oppCast", np: parseNP("a " + m[1]) }));
  tr(/^(?:when|whenever|each time) (?:you|your opponent) \[(station|transform|ride)\]$/i, (m) => ({ event: "kwUsed", kw: lc(m[1]) }));
  tr(/^(?:when|whenever|each time) (?:a|an) (.+?) enters (?:the opponent's field|your opponent's field)$/i, (m) => ({ event: "otherEnter", opp: true, np: parseNP(m[1] + " on your opponent's field") }));
  tr(/^(?:when|whenever|each time) (?:a|an) (.+?) enters your field$/i, (m) => ({ event: "otherEnter", np: parseNP(m[1] + " on your field") }));
  tr(new RegExp("^(?:when|whenever|each time) " + SUBJ_THIS + " enters the field on the (left|right|center)(?: or (left|right|center))?$", "i"), (m) => ({ event: "enter", self: true, pos: [m[1], m[2]].filter(Boolean).map(lc) }));
  // replacement-style ("would") triggers
  tr(new RegExp("^if " + SUBJ_THIS + " would (?:leave the field|be destroyed|be put into the drop zone|be returned to hand)$", "i"), (m) => ({ event: "wouldLeave", self: true, destroyed: /destroyed/i.test(m[0]) }));
  tr(/^if your life would become 0$|^when your life would become 0$/i, () => ({ event: "wouldDie" }));
  tr(/^when this card is discarded(?: from (?:your )?hand)?$/i, () => ({ event: "discardedFromHand", self: true }));
  tr(/^when the number of cards in this card's soul becomes 0$/i, () => ({ event: "soulEmpty", self: true }));

  // strip "During your turn, " style prefixes into conds before the trigger
  function parseTriggerAndBody(t) {
    // returns {trigger, body, conds} ; trigger may be null
    let s = t;
    const conds = [];
    let trigger = null;
    let m;
    // "During your attack phase, " / "During your turn, " (timing conditions)
    for (let i = 0; i < 3; i++) {
      if ((m = s.match(/^(during [^,]+?),\s*/i))) {
        const c = ABX.parseCondition(m[1]);
        if (c) { conds.push(c); s = s.slice(m[0].length); continue; }
      }
      break;
    }
    // find the trigger phrase up to the first comma where the head parses as a trigger
    if (/^(?:when|whenever|each time|at (?:the )?(?:end|start|beginning))\b/i.test(s)) {
      const commas = [...s.matchAll(/,\s*/g)];
      for (const cm of commas) {
        const head = s.slice(0, cm.index);
        for (const [re, fn] of TRIGGER_RULES) {
          const mm = head.match(re);
          if (mm) { trigger = fn(mm); trigger.src = head; return { trigger, body: s.slice(cm.index + cm[0].length), conds }; }
        }
      }
      // trigger without a comma at all (e.g. "At the start of your turn draw a card")
      for (const [re, fn] of TRIGGER_RULES) {
        const mm = s.match(re);
        if (mm) { trigger = fn(mm); return { trigger, body: "", conds }; }
      }
      return { trigger: { event: "unknown", src: s.split(",")[0] }, body: s.slice(s.indexOf(",") + 1).trim(), conds, unknownTrigger: true };
    }
    return { trigger: null, body: s, conds };
  }

  const ONCE_RE = /\s*(?:you may only (?:use|cast|activate|set|call) (?:this ability|this card|"[^"]+"|[^.]*?) once per (turn|game|fight|battle)\.?|this (?:ability|effect) (?:can|may) only be used once per (turn|game)\.?|"[^"]+" only activates once per (turn|game)\.?|(?:this ability|this effect) (?:only activates|activates only) once per (turn|game)\.?|once per (turn|game)\.?)/ig;

  function splitSentences(body) {
    // split on ". " / ".\"" outside brackets/quotes; keep "Then," continuations with the previous sentence
    const out = [];
    let cur = "", depth = 0, inQ = false;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '"') inQ = !inQ;
      if (!inQ) { if (ch === "(" || ch === "[" || ch === "«") depth++; else if (ch === ")" || ch === "]" || ch === "»") depth--; }
      cur += ch;
      if (!inQ && depth <= 0 && ch === "." && (i === body.length - 1 || /\s/.test(body[i + 1]))) {
        out.push(cur.trim()); cur = "";
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
  }
  ABX.splitSentences = splitSentences;

  const ABILITY_TAGS = ["counter", "act"];

  ABX.parseAbilityLine = function (rawLine, card) {
    const raw = ABX.clean(rawLine);
    const ab = { kind: "ability", tags: [], name: null, trigger: null, conds: [], steps: [], once: null, optional: false, unparsed: [], raw };
    let s = ABX.norm(raw);

    // leading dash (modal option)
    s = s.replace(/^-\s*/, "");
    // tags
    let m;
    while ((m = s.match(/^\[(counter|act|auto|set)\]\s*/i)) && /^\[(counter|act|auto)\]/i.test(s)) { ab.tags.push(lc(m[1])); s = s.slice(m[0].length); }
    // "- [Counter]" style repeated
    s = s.replace(/^-\s*/, "");
    // other leading bracket tags that are keyword-ish ([G.BOOST-Will-], [Overturn] ...) -> remember and strip
    while ((m = s.match(/^\[([^\]]+)\](?:\s*\[[^\]]+\])*\s*/)) && !/^\[(counter|act|call cost|cast cost|equip cost|rest|stand)\]/i.test(s)) {
      ab.tags.push("kw:" + lc(m[1])); s = s.slice(m[0].length);
      if (/^[A-Za-z]/.test(m[1]) === false) break;
    }
    // quoted ability name:  "Horary Domination" When this card ...
    if ((m = s.match(/^"([^"]+)"\s+(?=[A-Z\[])/)) || (m = s.match(/^""([^"]+)"[^"]*"\s+/))) { ab.name = m[1]; s = s.slice(m[0].length); }
    // once per turn / game
    let once = null;
    s = s.replace(ONCE_RE, (mm, a, b, c, d, e) => { once = lc(a || b || c || d || e || "turn"); return " "; }).trim();
    if (once) ab.once = once === "game" ? "game" : "turn";
    // reminder text in parentheses is rules text, not an effect
    s = s.replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    ab.cleaned = s;

    // trigger + body
    const tb = parseTriggerAndBody(s);
    ab.trigger = tb.trigger;
    ab.conds = tb.conds;
    if (tb.unknownTrigger) { ab.unparsed.push(s); ab.kind = ab.tags.includes("act") ? "act" : "triggered"; return ab; }

    // sentences -> steps
    const sentences = splitSentences(tb.body || "");
    const state = { conds: [] };
    let first = true;
    for (const sent of sentences) {
      if (!stripEnd(sent)) continue;
      // static "this card gets X if..." sentences are handled in the static pass
      const r = ABX.parseSentenceSteps(sent, { conds: [] });
      if (r.unparsed.length || (!r.steps.length)) {
        ab.unparsed.push(sent);
      }
      // "If you do" at sentence start gates the whole sentence on the previous optional step
      const startsIfYouDo = /^(?:then,?\s*)?if you do\b/i.test(sent);
      r.steps.forEach((st, i) => { if (startsIfYouDo && i === 0) st.gate = "ifYouDo"; ab.steps.push(st); });
    }
    ab.kind = ab.tags.includes("act") ? "act" : (ab.trigger ? "triggered" : "spell");
    return ab;
  };

  /* ============================================================
   * 8. CARD-LEVEL PARSE
   * ============================================================ */
  const RULE_LINE = /^(?:you may only (?:cast|call|set|equip|ride|use|put)|you may (?:have|use|put) |this card (?:cannot|can only|can't) (?:be )?(?:called|cast|equipped|set|enter|put)|you cannot (?:cast|call|set|equip)|this card can only enter|you may only \[set\]|you can only (?:cast|call)|you may call this card|you may cast this card|you may equip this card|you may (?:only )?(?:call|cast|equip) this card)/i;

  ABX.parseCard = function (card) {
    const lines = ABX.clean(card.skill || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
    const out = { cardId: card.id, abilities: [], stats: { lines: 0, full: 0, partial: 0, none: 0 } };
    let modal = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const low = ABX.normalize(line);
      let ab;
      if (/^\(.*\)$/.test(line)) { out.abilities.push({ kind: "reminder", raw: line, steps: [], unparsed: [] }); continue; }
      if (/^\[?\s*(call|cast|equip) cost\]/i.test(line) || /^(call|cast|equip) cost\]/i.test(line) || /^\[(?:pay \d+ (?:gauge|life)|put [^\]]*|discard[^\]]*|drop[^\]]*|destroy[^\]]*|rest[^\]]*)\]\s*$/i.test(line) && i === 0 && false) {
        out.abilities.push(ABX.parseCostLine(line)); continue;
      }
      if (isKeywordOnlyLine(line)) { out.abilities.push({ kind: "keyword", raw: line, steps: [], unparsed: [] }); continue; }
      if (RULE_LINE.test(low)) { out.abilities.push(ABX.parseRuleLine(line, card)); continue; }
      // modal bullets
      if (/^- ?/.test(line) && modal) { const opt = ABX.parseAbilityLine(line, card); modal.options.push(opt); continue; }
      ab = ABX.parseAbilityLine(line, card);
      if (/choose and use one of the following|choose one of the following|use one of the following/i.test(low)) {
        ab.kind = "modal"; ab.options = []; modal = ab;
      } else if (!/^- ?/.test(line)) { modal = null; }
      out.abilities.push(ab);
    }
    // static classification: an ability with no trigger/tags whose steps are boosts/restrictions/etc. is "static"
    out.abilities.forEach(ab => {
      if (ab.kind !== "spell") return;
      if (card.type === "Spell" || card.type === "Impact") return;
      ab.kind = "static";
    });
    // stats
    out.abilities.forEach(ab => {
      if (ab.kind === "cost") { out.stats.lines++; if (ab.parsed) out.stats.full++; else out.stats.none++; return; }
      if (["keyword", "reminder"].includes(ab.kind)) return;
      const subs = ab.kind === "modal" ? ab.options.concat([ab]) : [ab];
      subs.forEach(a => {
        out.stats.lines++;
        const un = a.unparsed ? a.unparsed.length : 0;
        if (a.kind === "rule") { if (a.parsed) out.stats.full++; else out.stats.none++; }
        else if (un === 0 && (a.steps.length || a.kind === "modal")) out.stats.full++;
        else if (a.steps && a.steps.length && un) out.stats.partial++;
        else out.stats.none++;
      });
    });
    return out;
  };

  // [Call Cost] / [Cast Cost] / [Equip Cost] lines
  ABX.parseCostLine = function (line) {
    const t = ABX.norm(line);
    const m = t.match(/^\[?(call|cast|equip) cost\]\s*(.*)$/i);
    const kind = m ? lc(m[1]) : "call";
    let body = m ? m[2] : t;
    if (body.startsWith("[")) {
      let depth = 0, end = -1;
      for (let i = 0; i < body.length; i++) { if (body[i] === "[") depth++; else if (body[i] === "]") { depth--; if (depth === 0) { end = i; break; } } }
      body = end > 0 ? body.slice(1, end) : body.slice(1);
    }
    body = stripEnd(body);
    const parts = body.split(/\s*&\s*|,?\s+and\s+(?=pay|put|discard|drop|destroy|\[rest\])/i).map(p => p.trim()).filter(Boolean);
    const parsed = parts.map(p => ABX.parseCostPart(p));
    return { kind: "cost", costKind: kind, raw: line, parts: parsed, steps: [], unparsed: parsed.filter(p => !p.ok).map(p => p.text), parsed: parsed.every(p => p.ok) };
  };
  ABX.parseCostPart = function (p) {
    const t = stripEnd(p);
    let m;
    if ((m = t.match(/^pay (\d+|a|one|two|three|four|five|six|seven) gauge$/i))) return { ok: true, text: t, gauge: toNum(m[1]) };
    if ((m = t.match(/^pay (\d+|a|one|two|three|four|five) life$/i))) return { ok: true, text: t, life: toNum(m[1]) };
    if ((m = t.match(/^(?:put|place) the top (?:(\w+) )?cards? of your deck (?:into|in) (?:its|this card's) soul$/i))) return { ok: true, text: t, soulFromDeck: toNum(m[1] || "a") || 1 };
    if ((m = t.match(/^(?:put|place) (?:a|an|one|(\w+)) (.+?) (?:from|in) your (hand|drop zone|field|gauge) (?:into|in|to) (?:its|this card's) soul$/i))) return { ok: true, text: t, soulFrom: { area: lc(m[3]), n: toNum(m[1] || "a") || 1, np: parseNP(m[2]) } };
    if ((m = t.match(/^(?:discard|drop) (?:a|an|one|(\w+)) (.+?)(?: from your hand)?$/i))) return { ok: true, text: t, discard: { n: toNum(m[1] || "a") || 1, np: parseNP(m[2]) } };
    if ((m = t.match(/^destroy (?:a|an|one|(\w+)) (.+)$/i))) return { ok: true, text: t, destroy: { n: toNum(m[1] || "a") || 1, np: parseNP(m[2]) } };
    if ((m = t.match(/^\[rest\] (?:a|an|one|(\w+)) (.+)$/i))) return { ok: true, text: t, rest: { n: toNum(m[1] || "a") || 1, np: parseNP(m[2]) } };
    const act = parseAction(t);
    if (act) return { ok: true, text: t, step: act };
    return { ok: false, text: t };
  };

  ABX.parseRuleLine = function (line, card) {
    const t = ABX.norm(line);
    const ab = { kind: "rule", raw: line, steps: [], unparsed: [], conds: [], parsed: false };
    let m;
    if ((m = t.match(/^you may only (cast|call|equip|set|ride) this card ((?:if|when|during|only if) .+?)\.?$/i)) || (m = t.match(/^you may only (cast|call|equip|set|ride) this card (.+?)\.?$/i))) {
      ab.action = lc(m[1]);
      const c = ABX.parseCondition(m[2].replace(/^only if /i, "if "));
      if (c) { ab.conds.push(c); ab.parsed = true; }
      else ab.unparsed.push(m[2]);
      return ab;
    }
    if (/^you may only (?:call|cast|set|equip|use) (?:one )?"[^"]+"(?: once)? (?:per turn|once per turn)\.?$/i.test(t) || /^you may only (?:call|cast|set|equip) (?:one )?"[^"]+" per turn\.?$/i.test(t)) { ab.parsed = true; ab.oncePerTurnNamed = true; return ab; }
    if (/^you (?:may|can) only \[?set\]? (?:one|1) "[^"]+" on your field\.?$/i.test(t)) { ab.parsed = true; ab.onlyOneSet = true; return ab; }
    if (/^this card cannot be called to the (center|left|right)/i.test(t)) { ab.parsed = true; ab.noCallPos = lc(t.match(/(center|left|right)/i)[1]); return ab; }
    if (/^you may use <[^>]+>/i.test(t) || /^you may (?:have|use) /i.test(t) || /^you may only \[set\]/i.test(t) || /^you may put /i.test(t)) { ab.parsed = true; ab.deckRule = true; return ab; }
    const viaAction = parseAction(t);
    if (viaAction) { ab.parsed = true; ab.steps = [viaAction]; return ab; }
    ab.unparsed.push(t);
    return ab;
  };

  ABX.parseAll = function (cards) {
    const out = new Map();
    (cards || []).forEach(c => { if (c && c.skill) out.set(c.id, ABX.parseCard(c)); });
    return out;
  };

  root.ABX = ABX;
  if (typeof module !== "undefined" && module.exports) module.exports = ABX;
})(typeof window !== "undefined" ? window : globalThis);
