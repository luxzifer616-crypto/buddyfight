/* ==================== ABX — [G.EVO], [G.BOOST] and [Release Condition] ====================
 *  1. Ability tags as keywords (like [Penetrate]): a card "has [G.EVO]" / "has [G.BOOST-Base-]" only when the tag is
 *     printed at the start of one of its abilities ("[G.EVO] At the end of the battle…", "D-[G.EVO] …",
 *     "[G.BOOST-Craft-] At the start of your attack phase…"). Cards that only *mention* the tag in a condition no
 *     longer count (before, any card whose text contained "[G.BOOST" counted as a card with [G.BOOST]).
 *     [G.BOOST-Ex-] is also treated as [G.BOOST-Base-], [G.BOOST-Craft-] and [G.BOOST-Will-]; D-[G.EVO] as [G.EVO].
 *     Keyword chips in the card details show the real tag ("G.BOOST-Base-", "G.EVO", "D-G.EVO").
 *  2. [G.EVO]: a monster called by a [G.EVO] ability "entered by [G.EVO]".
 *     - "Then, if it entered (the field) by [G.EVO], …"            (condition)
 *     - "When this card enters the field by [G.EVO], …"            (only then, not on every call)
 *     - "When a monster enters your field by [G.EVO], …"           (new trigger)
 *     - "If this card has a soul with [G.EVO], …"                  (a soul card with the tag printed)
 *  3. [G.BOOST]: using a [G.BOOST] ability is remembered for the turn.
 *     - "you used [G.BOOST] / [G.BOOST-Will-] during this turn"   (conditions and cast rules)
 *     - "When the card with this card in its soul uses [G.BOOST]" (soul trigger)
 *     - [G.BOOST-Ex-] [Act] "…this card gets the chosen card's [G.BOOST]": the borrowed [G.BOOST] abilities run
 *       for this card at the start of your attack phase this turn.
 *     - "You may only cast this card if a card with [G.BOOST] is on your field / you used [G.BOOST] …" and
 *       "…if you have an item with [Release Condition!] equipped" are now enforced (they were never checked).
 *  Loaded after abilities_r9.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits, matchFilter } = core;
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const XC = ABX.extraCond = ABX.extraCond || {};
  const addOk = (...ts) => ts.forEach(t => ABX.COND_OK.add(t));
  const say = (t) => { try { if (B.setPrompt && !ABX.fast) B.setPrompt(t); } catch (e) { /* ignore */ } };
  const cut = (a, b, img) => { try { if (B.showCutin && !ABX.fast) B.showCutin(a, b, img); } catch (e) { /* ignore */ } };

  /* ============================================================
   * 1. PRINTED TAGS
   * ============================================================ */
  const SUBS = ["base", "craft", "will", "ex"];
  function gTags(card) {
    if (!card) return { gevo: false, dgevo: false, gboost: [] };
    if (card.__gTags && card.__gTags.skill === card.skill) return card.__gTags;
    const g = { skill: card.skill, gevo: false, dgevo: false, gboost: [] };
    String(card.skill || "").split(/\n+/).forEach(line => {
      let s = line.trim().replace(/^-\s*/, "");
      for (let i = 0; i < 6; i++) {
        let m;
        if ((m = s.match(/^\[(counter|act)\]\s*/i))) { s = s.slice(m[0].length); continue; }
        if ((m = s.match(/^D-\[G\.?EVO\]\s*/i))) { g.gevo = g.dgevo = true; s = s.slice(m[0].length); continue; }
        if ((m = s.match(/^\[G\.?EVO\]\s*/i))) { g.gevo = true; s = s.slice(m[0].length); continue; }
        if ((m = s.match(/^\[G\.?BOOST-(\w+)-?\]\s*/i))) { const k = lc(m[1]); if (SUBS.includes(k) && !g.gboost.includes(k)) g.gboost.push(k); s = s.slice(m[0].length); continue; }
        break;
      }
    });
    Object.defineProperty(card, "__gTags", { value: g, enumerable: false, configurable: true, writable: true });
    return g;
  }
  // subtypes a card counts as ([G.BOOST-Ex-] is also Base, Craft and Will)
  const gboostSubs = (card) => { const s = gTags(card).gboost.slice(); if (s.includes("ex")) ["base", "craft", "will"].forEach(k => { if (!s.includes(k)) s.push(k); }); return s; };
  ABX.gTags = gTags;
  ABX.gboostSubs = gboostSubs;

  // "[G.BOOST-Base-]" / "g.boost" / "gboost" -> { boost: true, sub: "base" | null } ; "[G.EVO]" -> { evo: true }
  function gKw(kw) {
    const k = lc(kw).replace(/^\[|\]$/g, "").trim();
    let m;
    if (/^d-g\.?evo$/.test(k)) return { evo: true, d: true };
    if (/^g\.?evo$/.test(k)) return { evo: true };
    if (/^g\.?\s?boost$/.test(k)) return { boost: true, sub: null };
    if ((m = k.match(/^g\.?\s?boost-(\w+)-?$/))) return { boost: true, sub: m[1] };
    if (/^release condition!?$/.test(k)) return { release: true };
    return null;
  }
  function cardHasG(card, q) {
    if (!card || !q) return false;
    if (q.release) return /\[Release Condition!?\]/i.test(card.skill || "");
    const g = gTags(card);
    if (q.evo) return q.d ? g.dgevo : g.gevo;
    if (q.boost) return q.sub ? gboostSubs(card).includes(q.sub) : g.gboost.length > 0;
    return false;
  }
  ABX.kwOfExtra = function (card, kw) {
    const q = gKw(kw);
    return q ? cardHasG(card, q) : undefined;
  };
  // a unit that borrowed a [G.BOOST] this turn ([G.BOOST-Ex-]) also counts as a card with it
  const lentSubs = (unit) => {
    const L = unit && unit.abxGLent;
    if (!L || L.turn !== B.turnCount) return [];
    const out = [];
    (L.ids || []).forEach(id => gboostSubs(cardOf(id)).forEach(k => { if (!out.includes(k)) out.push(k); }));
    return out;
  };
  const ouhk = ABX.unitHasKw;
  ABX.unitHasKw = function (fighter, unit, k) {
    const q = gKw(k);
    if (q && q.boost && unit) { const ls = lentSubs(unit); if (q.sub ? ls.includes(q.sub) : ls.length > 0) return true; }
    return ouhk ? ouhk.apply(this, arguments) : false;
  };

  // keyword chips: only the tags really printed, with their sub-type
  // (also [Penetrate] / [Double Attack] / … chips, like the keyword flags fixed in round 9: "… get [Penetrate]" is not a chip)
  const FLAG_CHIPS = { "Penetrate": "penetrate", "Double Attack": "double attack", "Triple Attack": "triple attack", "Quadruple Attack": "quadruple attack", "Soulguard": "soulguard", "Counterattack": "counterattack", "Move": "move" };
  function fixChips() {
    const seen = new Set();
    const all = [];
    if (typeof CARD_MAP !== "undefined") CARD_MAP.forEach(c => all.push(c));
    for (const c of all) {
      if (!c || seen.has(c) || !Array.isArray(c.kw)) continue;
      seen.add(c);
      if (ABX.printedKeywords && c.kw.some(k => FLAG_CHIPS[k])) {
        const printed = ABX.printedKeywords(c);
        c.kw = c.kw.filter(k => !FLAG_CHIPS[k] || printed.has(FLAG_CHIPS[k]));
      }
      if (!c.kw.some(k => /^G\.(EVO|BOOST)/i.test(k)) && !/\[G\.?(EVO|BOOST)/i.test(c.skill || "")) continue;
      const g = gTags(c);
      const kw = c.kw.filter(k => !/^(D-)?G\.(EVO|BOOST)/i.test(k));
      if (g.dgevo) kw.push("D-G.EVO"); else if (g.gevo) kw.push("G.EVO");
      g.gboost.forEach(s => kw.push(`G.BOOST-${s === "ex" ? "Ex" : s[0].toUpperCase() + s.slice(1)}-`));
      c.kw = kw;
    }
  }
  fixChips();

  /* ============================================================
   * 2. READING THE TEXT
   * ============================================================ */
  function rewriteG(s) {
    s = String(s);
    s = s.replace(/\[GBOOST\]/g, "[G.BOOST]").replace(/\[G BOOST\]/g, "[G.BOOST]");
    // "D-[G.EVO] At the end …" -> a normal leading tag; "D-[G.EVO] only activates once per turn."
    s = s.replace(/D-\[G\.EVO\] only activates once per turn\.?/gi, "This ability only activates once per turn.");
    s = s.replace(/^(\s*-?\s*)D-\[G\.EVO\]/i, "$1[D-G.EVO]");
    // "You may only use [G.BOOST-Ex-] once per turn." (the "." in the tag hid it from the once-per-turn reader)
    s = s.replace(/You may only use \[G\.BOOST-\w+-\] once per turn\.?/gi, "This ability only activates once per turn.");
    // "[G.BOOST-Ex-] [Act] …": [Act] must be read as the ability's tag (it was swallowed with the G tag)
    s = s.replace(/^(\s*)(\[G\.[^\]]+\])\s*((?:\[(?:Counter|Act)\]\s*)+)/i, "$1$3$2 ");
    // "When …, and a card with [G.BOOST] is on your field, …" -> "When …, if a card with [G.BOOST] is on your field, …"
    s = s.replace(/^(\s*When [^,]+), and (a card with \[G\.BOOST[^\]]*\] is on your field), /i, "$1, if $2, ");
    // "draw a card and, for this turn, all …" -> "draw a card, and for this turn, all …"
    s = s.replace(/\bdraw a card and, for this turn,/gi, "draw a card, and for this turn,");
    // "When this card …, (for this turn,) it gets …": "it" is this card (nothing was chosen)
    s = s.replace(/^(\s*When this card [^,]+, (?:for this turn, )?)it gets\b/i, "$1this card gets");
    // "[Stand] a «X» item you have equipped" -> the item on your field
    s = s.replace(/\b(an? «[^»]+» item) you have equipped\b/gi, "$1 on your field");
    return s;
  }
  const prevRw = ABX.rewriteLine;
  if (prevRw) ABX.rewriteLine = (t) => rewriteG(prevRw(t));

  // --- triggers ---
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const TG = [];
  const tg = (re, fn) => TG.push([re, fn]);
  tg(/^(?:when|whenever) this (?:card|monster) enters the field by \[(?:d-)?g\.?evo\]$/i, () => ({ event: "enter", self: true, gevo: true }));
  tg(/^(?:when|whenever) this (?:card|monster) enters the field by (?:a )?card effects?$/i, () => ({ event: "enter", self: true, byEffect: true }));
  tg(/^(?:when|whenever) (?:a|an|another) (.+?) enters your field by \[(?:d-)?g\.?evo\]$/i, (m) => ({ event: "gevoEnter", np: NP(m[1] + " on your field") }));
  tg(/^(?:when|whenever) the (?:card|monster) with this card in its soul uses \[g\.?boost(?:-\w+-)?\]$/i, () => ({ event: "hostGBoost" }));
  tg(/^(?:when|whenever) you gain life by (?:your )?card effects?$/i, () => ({ event: "lifeGain", who: "you" }));
  ABX.TRIGGER_RULES.unshift(...TG);

  // --- conditions ---
  const CG = [];
  const cg = (re, fn) => CG.push([re, fn]);
  cg(/^(?:it|this card|this monster) (?:has )?entered(?: the field| your field)? by \[(?:d-)?g\.?evo\]$/i, () => ({ t: "gevoEntered" }));
  cg(/^(?:it|this card|this monster) has (?:a |an )?souls? with \[(d-)?g\.?evo\]$/i, () => ({ t: "gSoul" }));
  cg(/^you (?:have )?used (?:an? )?\[g\.?boost(?:-(\w+)-)?\](?: (?:during|in) (?:this|the) turn| this turn)?$/i, (m) => ({ t: "gboostUsed", sub: m[1] ? lc(m[1]) : null }));
  cg(/^(?:you have )?(?:an|a) item with \[release condition!?\] equipped$|^you are equipped with (?:a|an) (?:card|item) with \[release condition!?\]$/i, () => ({ t: "releaseEquipped" }));
  ABX.COND_RULES.unshift(...CG);
  XC.gevoEntered = (c, ctx) => !!(ctx.unit && ctx.unit.abxGEvo);
  XC.gSoul = (c, ctx) => { const u = ctx.unit || ctx.soulHost; return !!u && (u.soul || []).some(id => gTags(cardOf(id)).gevo); };
  XC.gboostUsed = (c, ctx) => gboostUsed(ctx.f, c.sub);
  XC.releaseEquipped = (c, ctx) => !!(ctx.f && ctx.f.item && ctx.f.item.card && /\[Release Condition!?\]/i.test(ctx.f.item.card.skill || ""));
  addOk("gevoEntered", "gSoul", "gboostUsed", "releaseEquipped");

  // --- actions ([G.BOOST-Ex-]) ---
  const AG = [];
  const ag = (re, fn) => AG.push([re, fn, false]);
  ag(/^(?:this card|it) gets the chosen cards?'?s?'? \[g\.?boost\]$/i, () => ({ op: "gboostLend" }));
  ag(/^choose up to one card each with ((?:\[g\.?boost-\w+-\](?:,? (?:and )?)?)+) in your drop zone$/i, (m) => ({ op: "gboostPick", subs: (m[1].match(/g\.?boost-(\w+)-/gi) || []).map(x => lc(x.match(/-(\w+)-/)[1])) }));
  ABX.ACTION_RULES.unshift(...AG);

  const pal = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewriteG(rawLine);
    const ab = pal.call(this, fixed, card);
    if (fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    if (ab.trigger && ab.trigger.gevo) ab.conds = (ab.conds || []).concat([{ t: "gevoEntered" }]);
    if (ab.trigger && ab.trigger.byEffect && ABX.COND_OK.has("xByEffect")) ab.conds = (ab.conds || []).concat([{ t: "xByEffect" }]);
    return ab;
  };
  const opc = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = opc.apply(this, arguments);
    try { (r && r.abilities || []).forEach(fixUnnull); } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  // "Then, if …, for this turn, this card's attacks cannot be nullified (and its damage cannot be reduced) if it is
  // attacking alone": the step's condition slot held the "if …" part, so it was refused (it only takes "alone").
  // Continuous "If …, its attacks cannot be nullified if it is attacking alone" is a static of this card.
  const SELF_ATK = /^(?:this card's|its) attacks? cannot be nullified/i;
  function fixUnnull(ab) {
    (ab.steps || []).forEach((x, i) => {
      if (!x || !SELF_ATK.test(x.src || "")) return;
      const alone = /attacking alone/i.test(x.src || "");
      const noReduce = !!x.noReduce || /damage cannot be reduced/i.test(x.src || "");
      const cond = x.cond && typeof x.cond === "object" ? x.cond : null;
      if (ab.kind === "static") {
        if (x.op !== "unnullChosen" || ab.steps.length !== 1) return;
        if (cond) ab.conds = (ab.conds || []).concat([cond]);
        ab.steps[i] = { op: "static", kind: "unnullifiable", cond: alone ? "alone" : null, noReduce, src: x.src };
      } else if (x.op === "static" && x.kind === "unnullifiable" && cond) {
        ab.steps[i] = Object.assign({}, x, { op: "unnullSelf", alone, noReduce, kind: undefined });
      }
    });
  }
  OPS.unnullSelf = {
    run(s, ctx) {
      const u = ctx.unit; if (!u) return false;
      u.abxUnnull = { turn: B.turnCount, cond: s.alone ? "alone" : null };
      if (s.noReduce) u.abxUnreducible = { turn: B.turnCount, alone: !!s.alone };
      return true;
    },
    check: () => true
  };


  /* ============================================================
   * 3. [G.EVO] CALLS
   * ============================================================ */
  const isGEvoAb = (ab) => (ab && ab.tags || []).some(t => /^kw:(d-)?g\.?evo$/.test(t));
  const gboostTagSubs = (ab) => { const out = []; (ab && ab.tags || []).forEach(t => { const m = t.match(/^kw:g\.?boost-(\w+)-$/); if (m) out.push(lc(m[1])); }); return out; };
  ABX.gevoCalling = 0;
  if (OPS.call) {
    const oc = OPS.call.run;
    OPS.call.run = async function (s, ctx) {
      const g = !!(ctx && (ctx.gevo || isGEvoAb(ctx.ab)));
      if (g) ABX.gevoCalling++;
      try { return await oc.apply(this, arguments); } finally { if (g) ABX.gevoCalling--; }
    };
  }
  ABX.fireGEvoEnter = function (side, unit) {
    return ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "gevoEnter" && s === side &&
      (!t.np || matchFilter(unit.card, t.np.filter || {}, { unit, side }, { f: F(side) })), { name: "gevoEnter", unit }));
  };
  // mark the unit before its own "enters the field" abilities look at it (the call can land at once or after an animation)
  if (typeof B.completeMonsterCall === "function") {
    const ocm = B.completeMonsterCall;
    B.completeMonsterCall = function (side, pos) {
      const g = ABX.gevoCalling > 0, ef = (ABX.callingByEffect || 0) > 0;
      const r = ocm.apply(this, arguments);
      try { const u = this.getFighter(side).monsters[pos]; if (u && g) u.abxGEvo = true; if (u && ef) u.abxByEffect = true; } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (typeof B.afterMonsterCallLanded === "function") {
    const oal = B.afterMonsterCallLanded;
    B.afterMonsterCallLanded = function (side, c, unit) {
      if (unit) { if (ABX.gevoCalling > 0) unit.abxGEvo = true; if ((ABX.callingByEffect || 0) > 0) unit.abxByEffect = true; }
      const r = oal.apply(this, arguments);
      if (unit && unit.abxGEvo && !unit.abxGEvoFired) {
        unit.abxGEvoFired = true;
        try { cut("G.EVO!", unit.card.name, unit.card.img); } catch (e) { /* ignore */ }
        ABX.fireGEvoEnter(side, unit);
      }
      return r;
    };
  }

  /* ============================================================
   * 4. [G.BOOST] USED THIS TURN
   * ============================================================ */
  function gboostUsed(f, sub) {
    const u = f && f.abxGBoostUsed;
    if (!u || u.turn !== B.turnCount) return false;
    return sub ? u.subs.includes(sub) : u.subs.length > 0;
  }
  ABX.gboostUsed = (side, sub) => gboostUsed(F(side), sub);
  function markGBoost(f, subs) {
    if (!f.abxGBoostUsed || f.abxGBoostUsed.turn !== B.turnCount) f.abxGBoostUsed = { turn: B.turnCount, subs: [] };
    const all = subs.slice(); if (all.includes("ex")) ["base", "craft", "will"].forEach(k => all.push(k));
    all.forEach(k => { if (!f.abxGBoostUsed.subs.includes(k)) f.abxGBoostUsed.subs.push(k); });
  }
  // "When the card with this card in its soul uses [G.BOOST]"
  function fireHostGBoost(side, host) {
    if (!host || !(host.soul || []).length) return;
    ABX.queue(async () => {
      const f = F(side);
      for (const id of host.soul.slice()) {
        const c = cardOf(id); if (!c) continue;
        for (const ab of core.abilitiesOf(c, a => a.kind === "triggered" && a.trigger && a.trigger.event === "hostGBoost" && ABX.isExecutable(a))) {
          if (host.abxNullified === B.turnCount || core.onceUsed(f, c, ab, host)) continue;
          const idx = host.soul.indexOf(id); if (idx < 0) continue;
          const selfRef = { k: "soul", side, unit: host, idx, id, card: c };
          core.markOnce(f, c, ab, host);
          cut("ABILITY!", c.name, c.img);
          await core.runAbility(side, c, ab, null, { event: { name: "gboost" }, hostArea: "soul", soulHost: host, selfRef });
          if (B.matchOver) return;
        }
      }
    });
  }
  const prevStart = ABX.onAbilityStart;
  ABX.onAbilityStart = function (ctx) {
    if (prevStart) prevStart(ctx);
    if (!ctx || !ctx.ab) return;
    if (isGEvoAb(ctx.ab)) ctx.gevo = true;
    const subs = gboostTagSubs(ctx.ab);
    if (subs.length) {
      markGBoost(ctx.f, subs);
      cut("G.BOOST!", ctx.card ? ctx.card.name : "", ctx.card && ctx.card.img);
      const host = ctx.gboostHost || ctx.unit;
      if (host) fireHostGBoost(ctx.side, host);
    }
  };

  // [G.BOOST-Ex-]: pick cards with [G.BOOST] in the drop zone, this card "gets" their [G.BOOST] for this turn
  const dropRefs = (f, pred) => f.drop.map((id, idx) => ({ k: "zone", side: null, area: "drop", idx, id, card: cardOf(id) })).filter(r => r.card && pred(r.card));
  OPS.gboostPick = {
    async run(s, ctx) {
      const f = ctx.f;
      let any = false;
      for (const sub of s.subs || []) {
        const cands = dropRefs(f, c => gboostSubs(c).includes(sub) && !(ctx.bind.chosen || []).some(r => r.id === c.id)).map(r => Object.assign(r, { side: ctx.side }));
        if (!cands.length) continue;
        const ch = await core.pick(cands, { qty: { n: 1, upTo: true }, raw: `a card with [G.BOOST-${sub}-] in your drop zone` }, ctx, { intent: "help", title: `${ctx.card.name} — [G.BOOST-${sub[0].toUpperCase() + sub.slice(1)}-]` });
        if (ch[0]) { ctx.bind.chosen.push(ch[0]); any = true; }
      }
      return any;
    },
    check: () => true
  };
  OPS.gboostLend = {
    run(s, ctx) {
      const u = ctx.unit; if (!u) return false;
      const ids = (ctx.bind.chosen || []).filter(r => r && r.card && gTags(r.card).gboost.length).map(r => r.id);
      if (!ids.length) return false;
      if (!u.abxGLent || u.abxGLent.turn !== B.turnCount) u.abxGLent = { turn: B.turnCount, ids: [] };
      ids.forEach(id => { if (!u.abxGLent.ids.includes(id)) u.abxGLent.ids.push(id); });
      say(`⚡ "${u.card.name}" gets the [G.BOOST] of ${ids.map(id => `"${(cardOf(id) || {}).name}"`).join(", ")} for this turn!`);
      return true;
    },
    check: () => true
  };
  // borrowed "[G.BOOST-X-] At the start of your attack phase, …" abilities run for the borrowing card
  const ofte = ABX.fireTurnEvent;
  ABX.fireTurnEvent = function (kind, phase) {
    const r = ofte.apply(this, arguments);
    if (kind === "phaseStart") {
      const side = B.activeSide;
      ABX.queue(async () => {
        const f = F(side);
        for (const x of fieldUnits(f, true)) {
          const u = x.unit, L = u.abxGLent;
          if (!L || L.turn !== B.turnCount || u.abxNullified === B.turnCount) continue;
          for (const id of L.ids) {
            const c = cardOf(id); if (!c) continue;
            const key = B.turnCount + ":" + phase + ":" + id;
            if ((L.ran || []).includes(key)) continue;
            (L.ran = L.ran || []).push(key);
            for (const ab of core.abilitiesOf(c, a => a.kind === "triggered" && a.trigger && a.trigger.event === "phaseStart" && a.trigger.phase === phase && gboostTagSubs(a).length && ABX.isExecutable(a))) {
              if (core.onceUsed(f, c, ab, u)) continue;
              const probe = { side, f, e: F(otherSide(side)), card: c, unit: u, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "field" };
              if (!(ab.conds || []).every(cd => core.evalCond(cd, probe))) continue;
              core.markOnce(f, c, ab, u);
              cut("G.BOOST!", `${u.card.name} (${c.name})`, u.card.img);
              await core.runAbility(side, c, ab, u, { event: { name: "phaseStart" } });
              if (B.matchOver) return;
            }
          }
        }
      });
    }
    return r;
  };

  /* ============================================================
   * 5. CAST / CALL RULES THAT NAME [G.BOOST] / [G.EVO] / [Release Condition]
   *    ("You may only cast this card if a card with [G.BOOST] is on your field" was never checked)
   * ============================================================ */
  const fieldCards = (f) => fieldUnits(f, true).map(x => ({ card: x.unit.card, unit: x.unit })).concat((f.setSpells || []).map(c => ({ card: c, unit: null })));
  const hasGOnField = (f, q, alsoDrop) => fieldCards(f).some(x => cardHasG(x.card, q) || (q.boost && x.unit && (q.sub ? lentSubs(x.unit).includes(q.sub) : lentSubs(x.unit).length > 0))) ||
    (alsoDrop && f.drop.some(id => cardHasG(cardOf(id), q)));
  function gRuleReasons(card, f, e) {
    const reasons = [];
    const lines = String(card.skill || "").split(/\n+/).filter(l => /^\s*you may (?:only )?(?:cast|call|equip|use) this card\b/i.test(l) && /\[(?:G\.?\s?BOOST|GBOOST|G\.?EVO|Release Condition)/i.test(l));
    for (const line of lines) {
      const t = rewriteG(line);
      let m;
      const reBoostField = /(?:a|an) (card|monster|item) with \[(G\.BOOST(?:-\w+-)?)\] (?:is )?on your field( or in your drop zone)?|you have (?:a|an) (card|monster|item) with \[(G\.BOOST(?:-\w+-)?)\] on your field/gi;
      while ((m = reBoostField.exec(t))) {
        const tag = m[2] || m[5], q = gKw(tag);
        if (q && !hasGOnField(f, q, !!m[3])) reasons.push(`Requires a card with [${tag}] on your field`);
      }
      const reUsed = /you used \[G\.BOOST(?:-(\w+)-)?\]/gi;
      while ((m = reUsed.exec(t))) {
        const sub = m[1] ? lc(m[1]) : null;
        if (!gboostUsed(f, sub)) reasons.push(`Requires that you used [G.BOOST${m[1] ? "-" + m[1] + "-" : ""}] this turn`);
      }
      if (/(?:you have )?an item with \[Release Condition!?\] equipped/i.test(t) && !(f.item && f.item.card && /\[Release Condition!?\]/i.test(f.item.card.skill || ""))) reasons.push("Requires an item with [Release Condition!] equipped");
      if (/no monsters? (?:is|are) on each player's center/i.test(t) && (f.monsters.center || (e && e.monsters.center))) reasons.push("Requires no monster on either player's center");
      else if (/no monsters? (?:is|are) on your opponent's center/i.test(t) && e && e.monsters.center) reasons.push("Requires no monster on your opponent's center");
      if (/a monster with "([^"]+)" in its card name is on your field/i.test(t)) {
        const nm = lc(t.match(/a monster with "([^"]+)" in its card name is on your field/i)[1]);
        if (!["left", "center", "right"].some(p => f.monsters[p] && lc(f.monsters[p].card.name).includes(nm))) reasons.push(`Requires a monster with "${nm}" in its card name on your field`);
      }
    }
    return reasons;
  }
  ABX.gRuleReasons = gRuleReasons;
  if (typeof root.evaluateCardConditions === "function") {
    const oec = root.evaluateCardConditions;
    const wrapped = function (card, fighter, enemy) {
      const r = oec.apply(this, arguments);
      try {
        const extra = card && fighter ? gRuleReasons(card, fighter, enemy) : [];
        if (extra.length) {
          const reasons = (r.reasons || []).concat(extra.filter(x => !(r.reasons || []).includes(x)));
          return Object.assign({}, r, { met: false, reasons, summary: `⚠️ ${reasons[0]}` });
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
    root.evaluateCardConditions = wrapped;
    try { if (typeof globalThis !== "undefined") globalThis.evaluateCardConditions = wrapped; } catch (e) { /* ignore */ }
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
