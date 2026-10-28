/* ==================== ABX ENGINE (core) ====================
 * Runs the abilities produced by abilities_parser.js against the real `battle` state.
 *   - state helpers, card / target matching (filters from parseNP)
 *   - condition evaluation   (ABX.core.evalCond)
 *   - target selection        (human popup / bot heuristic / test hook)
 *   - the step runner         (ABX.core.runAbility)  -> steps are implemented in abilities_ops.js
 *   - triggers + hooks        (ABX.fire, battle.abx* hooks called from game.js)
 *
 * Ownership rule: ABX only takes over a card's ability when the whole ability parsed with NO unparsed text and every
 * step/condition is supported (ABX.isExecutable). Anything else keeps running through the older keyword code in game.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX) return;
  if (typeof battle === "undefined" || typeof CARD_MAP === "undefined") return;   // parser-only environment (Node audit)
  const B = battle;
  const SLOTS = ["center", "left", "right"];
  const core = (ABX.core = ABX.core || {});
  const OPS = (ABX.OPS = ABX.OPS || {});

  /* ============================================================
   * 1. BASIC HELPERS
   * ============================================================ */
  const lc = (s) => String(s || "").toLowerCase();
  const otherSide = (s) => (s === "plr" ? "opp" : "plr");
  const F = (s) => B.getFighter(s);
  const cardOf = (id) => CARD_MAP.get(id);
  const isImpactMon = (c) => !!(root.IMX && c && IMX.isImpactMonster(c));
  const isMonsterCard = (c) => !!c && (c.type === "Monster" || isImpactMon(c));
  const norm = (s) => (typeof normalizeSearchToken === "function" ? normalizeSearchToken(s) : lc(s).replace(/[^a-z0-9]/g, ""));
  const sleep = (ms) => (ABX.fast ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));
  core.lc = lc; core.otherSide = otherSide; core.F = F; core.cardOf = cardOf; core.isMonsterCard = isMonsterCard; core.sleep = sleep; core.SLOTS = SLOTS; core.norm = norm;

  function st(f) {
    if (!f.abx) f.abx = { shields: [], restr: [], onceTurn: {}, onceGame: {}, attacks: 0, oppAttacks: 0, stand: 0, extra: null };
    return f.abx;
  }
  core.st = st;
  // Per-turn counters (attacks declared, spells cast). Stamped with the turn number so they reset by themselves.
  function turnStats(f) {
    const S = st(f);
    if (S.statTurn !== B.turnCount) { S.statTurn = B.turnCount; S.attacks = 0; S.castThisTurn = 0; S.castCards = []; }
    return S;
  }
  core.turnStats = turnStats;

  let unitSeq = 1;
  function uid(unit) { if (unit && !unit.abxId) unit.abxId = unitSeq++; return unit ? unit.abxId : 0; }

  function posOfUnit(f, unit) {
    for (const p of SLOTS) if (f.monsters[p] === unit) return p;
    if (f.item === unit) return "item";
    return null;
  }
  core.posOfUnit = posOfUnit;

  function fieldUnits(f, withItem) {
    const out = [];
    SLOTS.forEach(p => { if (f.monsters[p]) out.push({ unit: f.monsters[p], pos: p }); });
    if (withItem && f.item && !f.item.isEndrulerFlag) out.push({ unit: f.item, pos: "item" });
    return out;
  }
  core.fieldUnits = fieldUnits;

  /* parsed abilities (cached) */
  const PARSE_CACHE = new Map();
  ABX.get = function (card) {
    if (!card) return null;
    let r = PARSE_CACHE.get(card.id);
    if (!r) { r = ABX.parseCard(card); r.abilities.forEach((a, i) => { a.idx = i; a.cardId = card.id; (a.options || []).forEach((o, j) => { o.idx = i + "." + j; o.cardId = card.id; }); }); PARSE_CACHE.set(card.id, r); }
    return r;
  };

  /* ============================================================
   * 2. EXECUTABILITY (what ABX is allowed to own)
   * ============================================================ */
  const COND_OK = new Set(["selfStat", "refType", "refTribe", "selfPosAny", "turn", "phase", "underAttack", "selfPos", "selfOnField", "selfIn", "selfInSoulOf", "selfRested", "selfSoul", "selfSoulName", "selfSet",
    "life", "lifeVs", "gauge", "hand", "flagIs", "flagWorld", "reversal", "hasNot", "has", "count", "itemEquipped", "monsterCount", "onlyThis", "buddyOnField",
    "noBattle", "inBattle", "oppAttackCount", "myAttackCount", "attackedThisTurn", "castThisTurn", "event", "and", "or", "not", "always"]);
  ABX.COND_OK = COND_OK;

  function condExecutable(c) {
    if (!c) return true;
    if (!COND_OK.has(c.t)) return false;
    if (c.list) return c.list.every(condExecutable);
    if (c.t === "not") return condExecutable(c.c);
    if (c.np && c.np.junk) return false;
    if (c.t === "has" || c.t === "count" || c.t === "hasNot") { if (!c.np) return false; }
    return true;
  }
  ABX.condExecutable = condExecutable;

  function stepExecutable(s) {
    if (!s || !OPS[s.op] || !OPS[s.op].run) return false;
    if (s.cond && !condExecutable(s.cond)) return false;
    if (s.np && s.np.junk) return false;
    if (OPS[s.op].check && !OPS[s.op].check(s)) return false;
    return true;
  }
  ABX.stepExecutable = stepExecutable;

  const TRIG_OK = {
    enter: t => t.self, attack: t => t.self && !(t.target && t.target.junk), dealsDamage: t => t.self || !!t.np, damaged: () => true, attackDestroys: t => t.self, attackOutcome: t => t.self, attacked: t => t.self, link: t => t.self, discardedFromHand: t => t.self, otherAttack: t => !!t.np, oppAttack: () => true, battleEnd: () => true,
    turnStart: () => true, turnEnd: () => true, phaseStart: t => ["start", "draw", "main", "attack", "final", "turn"].includes(t.phase),
    otherEnter: t => !!t.np, otherDestroyed: t => !!t.np && !t.np.self, youCast: () => true, oppCast: () => true, leave: t => t.self && !t.byOpp,
    lifeGain: () => true, equipped: t => t.self, soulEmpty: t => t.self, hostAttack: t => !t.np || !t.np.junk, stoodByEffect: t => t.self,
    gevoEnter: () => true, hostGBoost: () => true
  };
  ABX.TRIG_OK = TRIG_OK;
  function triggerSupported(t) { return !!t && !!TRIG_OK[t.event] && TRIG_OK[t.event](t); }
  ABX.triggerSupported = triggerSupported;
  ABX.isExecutable = function (ab) {
    if (!ab) return false;
    if (ab.unparsed && ab.unparsed.length) return false;
    if (ab.kind === "static") {
      if (!(ab.steps && ab.steps.length) || (ab.unparsed && ab.unparsed.length)) return false;
      const c0 = ab.cardId != null ? cardOf(ab.cardId) : null;
      if (c0 && staticBoosts(c0).abs.includes(ab)) return true;
      if (!(ab.conds || []).every(condExecutable)) return false;
      if (ab.steps.every(x => x.op === "shield" && (!x.cond || condExecutable(x.cond)))) return true;   // continuous damage reduction
      return ab.steps.every(x => (x.op === "shield" && ab.steps.some(y => y.op !== "shield") && (!x.cond || condExecutable(x.cond))) || (x.op === "restrict" && x.np && x.np.self && !x.duration && (x.kinds || []).length > 0 && x.kinds.every(k => k === "attack") && (!x.cond || condExecutable(x.cond))) || (x.op === "static" && (x.kind === "protect" || x.kind === "attackThrough" || x.kind === "unnullifiable" || x.kind === "unreducible" || x.kind === "sizeMod" || x.kind === "cannotAttack" || x.kind === "noAttackPos" || (x.kind === "noStatReduce" && x.np && !x.np.junk) || (x.kind === "sizeModOthers" && x.np && !x.np.junk && (!x.cond || condExecutable(x.cond))))) || (x.op === "nullifyAbilities" && x.np && /in battle with this card/i.test(x.np.raw || "") && (!x.cond || condExecutable(x.cond))) || (x.op === "restrict" && isAuraRestrict(ab, c0, x) && (!x.cond || condExecutable(x.cond))) || (x.op === "noop" && x.note === "unnullifiable-ok") || (x.op === "boost" && c0 && staticBoosts(c0).abs.length && false));
    }
    if (ab.kind === "modal") {
      if (!(ab.options && ab.options.length && ab.options.every(o => ABX.isExecutable(o)))) return false;
      if (ab.trigger && !triggerSupported(ab.trigger)) return false;
      return (ab.conds || []).every(condExecutable) && (ab.steps || []).every(stepExecutable);
    }
    if (!ab.steps || !ab.steps.length) return false;
    if (ab.kind === "triggered" || ab.trigger) { if (!triggerSupported(ab.trigger)) return false; }
    if (!(ab.conds || []).every(condExecutable)) return false;
    return ab.steps.every(stepExecutable);
  };

  /* ============================================================
   * 3. CARD / TARGET MATCHING
   * ============================================================ */
  function tribeEq(card, t) {
    const k = norm(t);
    return (card.attrs || []).some(a => norm(a) === k);
  }
  function kwOf(card, kw) {
    // [G.EVO] / [G.BOOST-X-] and other ability tags (abilities_gkw.js): only when printed as the ability's tag
    if (ABX.kwOfExtra) { const r = ABX.kwOfExtra(card, kw); if (r !== undefined) return r; }
    switch (kw) {
      case "set": return !!card.set;
      case "move": return !!card.move;
      case "soulguard": return !!card.sg;
      case "penetrate": return !!card.pen;
      case "double attack": return !!card.da;
      case "triple attack": return !!card.ta;
      case "omni lord": return !!card.omni;
      case "dragod": return !!card.dragod;
      case "counterattack": return !!card.ca;
      case "ride": return !!card.ride;
      case "lifelink": return card.ll != null && card.ll !== false && card.ll !== 0;
      case "act": return !!card.act;
      case "counter": return !!card.cnt;
      case "overturn": return !!card.ot;
      default: return (card.skill || "").toLowerCase().includes("[" + kw);
    }
  }

  // stat of a card; if it is a unit on a field, use the effective (buffed) value.
  function statOf(card, unit, fighter, stat, original) {
    if (stat === "size") return fighter && unit && !original ? getEffectiveCardSize(fighter, card) : (card.size == null ? 0 : card.size);
    if (unit && fighter && !original) {
      const e = getUnitEffectiveCombatStats(fighter, unit);
      return stat === "power" ? e.power : stat === "defense" ? e.defense : e.crit;
    }
    const v = stat === "power" ? card.power : stat === "defense" ? card.defense : card.crit;
    return v == null ? 0 : v;
  }
  const cmpOK = (v, spec) => (spec.cmp === "le" ? v <= spec.n : spec.cmp === "ge" ? v >= spec.n : v === spec.n);

  function matchFilter(card, f, ref, ctx) {
    if (!card) return false;
    if (f.anyOf) return f.anyOf.some(sub => matchFilter(card, sub, ref, ctx));
    // relations to an earlier card of the same ability ("with a different card name from the returned card", "of the same size as that monster")
    if (f.rel && ctx && ctx.bind) {
      const base = [].concat(ctx.bind.lastMoved || [], ctx.bind.chosen || []).filter(x => x && x.card).shift() || (ctx.event && ctx.event.card ? { card: ctx.event.card } : null);
      if (!base) return false;
      if (f.rel === "diffName" && lc(base.card.name) === lc(card.name)) return false;
      if (f.rel === "sameName" && lc(base.card.name) !== lc(card.name)) return false;
      if (f.rel === "sameSize" && (base.card.size == null ? 0 : base.card.size) !== (card.size == null ? 0 : card.size)) return false;
    }
    if (f.notImpact && typeof IMX !== "undefined" && IMX.isImpactMonster && IMX.isImpactMonster(card)) return false;
    if (f.notInBattle && ref && ref.unit) { const b = ABX.curBattle || ABX.battleCtx; if (b && ((b.attUnits || []).includes(ref.unit) || b.defUnit === ref.unit)) return false; }
    const unit = ref && ref.unit;
    const fighter = ref && ref.side ? F(ref.side) : (ctx ? ctx.f : null);
    const t = f.types;
    if (t && t.length) {
      const isMon = isMonsterCard(card);
      const ok = t.some(x => x === "monster" ? isMon : x === "item" ? card.type === "Item" : x === "spell" ? card.type === "Spell" : x === "impact" ? card.type === "Impact" : x === "impactMonster" ? isImpactMon(card) : x === "character" ? (isMon || card.type === "Item") : x === "flag" ? card.type === "Flag" : true);
      if (!ok) return false;
    }
    if (f.notImpact && isImpactMon(card)) return false;
    if (f.names && f.names.length) { const n = lc(card.name); if (!f.names.some(x => n.includes(x))) return false; }
    if (f.notNames && f.notNames.length) { const n2 = lc(card.name); if (f.notNames.some(x => n2.includes(x))) return false; }
    if (f.attrWords && f.attrWords.length) { const a = (card.attrs || []).map(norm); if (!f.attrWords.some(w => a.some(x => x.includes(norm(w))))) return false; }
    if (f.tribesAll && f.tribesAll.length) { if (!f.tribesAll.every(tb => tribeEq(card, tb))) return false; }
    if (f.notWorlds && f.notWorlds.length) { if (f.notWorlds.some(w => (card.worlds || []).includes(w) || card.world === w)) return false; }
    if (f.tribes && f.tribes.length) { if (!f.tribes.some(tb => tribeEq(card, tb))) return false; }
    if (f.worlds && f.worlds.length) { if (!f.worlds.some(w => (card.worlds || []).includes(w) || card.world === w)) return false; }
    if (f.tokens && f.tokens.length) { const nm = norm(card.name); if (!f.tokens.some(tk => tribeEq(card, tk) || nm.includes(norm(tk)))) return false; }
    if (f.cardNames && f.cardNames.length) { const nm = lc(card.name); if (!f.cardNames.some(x => nm.includes(x))) return false; }
    if (f.size && !cmpOK(statOf(card, unit, fighter, "size", f.original), f.size)) return false;
    if (f.power && !cmpOK(statOf(card, unit, fighter, "power", f.original), f.power)) return false;
    if (f.defense && !cmpOK(statOf(card, unit, fighter, "defense", f.original), f.defense)) return false;
    if (f.critical && !cmpOK(statOf(card, unit, fighter, "critical", f.original), f.critical)) return false;
    if (f.kws && f.kws.length) { if (!f.kws.every(k => kwOf(card, k) || (unit && fighter && ABX.unitHasKw && ABX.unitHasKw(fighter, unit, k)))) return false; }   // printed, or given to it right now
    if (f.buddy) { if (!(unit && (unit.isBuddyGift || card.id === (fighter && fighter.buddyId)))) return false; }
    if (f.powerOrDef) { const pw = statOf(card, unit, fighter, "power", f.original), df = statOf(card, unit, fighter, "defense", f.original); if (!(cmpOK(pw, f.powerOrDef) || cmpOK(df, f.powerOrDef))) return false; }
    if (f.soulCount && unit) { const n = (unit.soul || []).length; if (!cmpOK(n, f.soulCount)) return false; }
    if (f.soulName && unit) { if (!(unit.soul || []).some(id => lc((cardOf(id) || {}).name).includes(f.soulName))) return false; }
    if (f.rested && unit && !unit.rested) return false;
    if (f.faceDown || f.faceUp) return false;
    if (f.attacking) { const bc = ABX.battleCtx; if (!bc || !ref || !ref.unit || !(bc.attUnits || []).includes(ref.unit)) return false; }
    if (f.frontOf) { const me = ctx && ctx.unit; const mp = me ? posOfUnit(F(ctx.side), me) : null; if (!mp || !ref || ref.pos !== mp || ref.side === ctx.side) return false; }
    if (f.attacked) { if (!(unit && unit.abxAttacked === B.turnCount)) return false; }
    if (f.statCmp && f.statCmp.length) {
      for (const sc of f.statCmp) {
        const v = statOf(card, unit, fighter, sc.stat, f.original);
        let rv = null;
        const vals = (rs) => rs.filter(x => x.card).map(x => statOf(x.card, x.unit, x.side ? F(x.side) : null, sc.stat2 || sc.stat));
        if (sc.ref === "self") rv = ctx && ctx.card ? statOf(ctx.card, ctx.unit, ctx.unit ? F(ctx.side) : null, sc.stat2 || sc.stat) : null;
        else if (sc.ref === "chosen") { const ch = ctx && ctx.bind && ctx.bind.chosen && ctx.bind.chosen[0]; rv = ch && ch.card ? statOf(ch.card, ch.unit, ch.side ? F(ch.side) : null, sc.stat2 || sc.stat) : null; }
        else if (sc.ref === "pos") { const u2 = ctx && ctx.f ? ctx.f.monsters[sc.pos] : null; rv = u2 ? statOf(u2.card, u2, ctx.f, sc.stat2 || sc.stat) : null; }
        else if (sc.ref === "np" && ctx) { const vs = vals(refsFor(sc.np, ctx, { owner: "you", area: "field" })); rv = vs.length ? Math.max.apply(null, vs) : null; }
        if (rv == null) return false;
        const ok = sc.cmp === "le" ? v <= rv : sc.cmp === "lt" ? v < rv : sc.cmp === "ge" ? v >= rv : sc.cmp === "gt" ? v > rv : v === rv;
        if (!ok) return false;
      }
    }
    if (f.inBattle) {
      const bc = ABX.battleCtx;
      if (!bc || !unit) return false;
      const inB = (bc.attUnits || []).includes(unit) || bc.defUnit === unit;
      if (!inB) return false;
    }
    return true;
  }
  core.matchFilter = matchFilter;

  // Enumerate everything an NP can refer to. -> array of refs
  //   ref = { k:"unit"|"item"|"set"|"zone"|"soul", side, pos, unit, card, id, area, host }
  function refsFor(np, ctx, def) {
    const out = [];
    if (!np) return out;
    if (np.zone && np.zone.alt) {   // "from your deck or drop zone"
      const z1 = Object.assign({}, np.zone, { alt: null }), z2 = Object.assign({}, np.zone, { area: np.zone.alt, alt: null, top: false });
      return refsFor(Object.assign({}, np, { zone: z1 }), ctx, def).concat(refsFor(Object.assign({}, np, { zone: z2 }), ctx, def));
    }
    if (np.parts && np.parts.length) {
      const seen = new Set(), outP = [];
      np.parts.forEach(p => refsFor(p, ctx, def).forEach(r => { const k = [r.side, r.area || r.k, r.idx, r.id, r.pos].join("|"); if (!seen.has(k)) { seen.add(k); outP.push(r); } }));
      return outP;
    }
    if (np.ref === "host") {
      const h = ctx.soulHost;
      if (!h || (np.hostFilter && !matchFilter(h.card, np.hostFilter, null, ctx))) return [];
      return [{ k: h === F(ctx.side).item ? "item" : "unit", side: ctx.side, pos: posOfUnit(F(ctx.side), h), unit: h, card: h.card, id: h.card.id }];
    }
    if (np.ref === "looked") {
      const lr = [].concat(ctx.bind.looked || [], ctx.bind.revealed || []);
      // "among them" after a look/reveal = the cards still waiting; after a mill/move = the cards just put there
      // (looked cards carry pending=true until taken; milled cards never had a pending flag)
      if (lr.length) return lr.filter((r, i, a) => r.pending !== false && a.indexOf(r) === i && r.card && matchFilter(r.card, np.filter || {}, r, ctx));
      return (ctx.bind.chosen || []).filter(r => r.card && matchFilter(r.card, np.filter || {}, r, ctx));
    }
    if (np.ref === "rest") return [].concat(ctx.bind.looked || [], ctx.bind.revealed || []).filter((r, i, a) => r.pending && a.indexOf(r) === i);
    if (np.ref) return (ctx.bind[np.ref === "chosen" ? "chosen" : np.ref] || []).slice();
    if (np.self) {
      if (np.zone && np.zone.area === "soul") return soulRefs(ctx.unit, ctx.side);
      if (ctx.unit) return [{ k: ctx.unit === F(ctx.side).item ? "item" : "unit", side: ctx.side, pos: posOfUnit(F(ctx.side), ctx.unit), unit: ctx.unit, card: ctx.card, id: ctx.card.id }];
      if (ctx.selfRef) return [ctx.selfRef];
      return [];
    }
    const z = np.zone || def || { owner: "any", area: "field" };
    const flt = np.filter || {};
    const owners = z.owner === "you" ? [ctx.side] : z.owner === "opp" ? [otherSide(ctx.side)] : [ctx.side, otherSide(ctx.side)];
    const area = z.area || "field";
    const push = (r) => { if (matchFilter(r.card, flt, r, ctx)) out.push(r); };
    if (np.soulOf || area === "soul") {
      let hosts = [];
      if (np.soulOf) hosts = refsFor(np.soulOf, ctx, { owner: "you", area: "field" }).filter(r => r.unit);
      else if (ctx.unit) hosts = [{ unit: ctx.unit, side: ctx.side }];
      hosts.forEach(h => (h.unit.soul || []).forEach((id, i) => push({ k: "soul", side: h.side, host: h.unit, idx: i, id, card: cardOf(id), unit: null })));
      return out;
    }
    owners.forEach(side => {
      const f = F(side);
      if (area === "field" || area === "center" || area === "left" || area === "right") {
        const wantMon = !flt.types || !flt.types.length || flt.types.some(x => x === "monster" || x === "character" || x === "impactMonster" || x === "card");
        const wantItem = !flt.types || !flt.types.length || flt.types.some(x => x === "item" || x === "character" || x === "card");
        const wantSet = !flt.types || !flt.types.length || flt.types.some(x => x === "spell" || x === "card");
        if (wantMon) SLOTS.forEach(p => { if ((!z.pos || (Array.isArray(z.pos) ? z.pos.includes(p) : z.pos === p)) && f.monsters[p]) { const u = f.monsters[p]; push({ k: "unit", side, pos: p, unit: u, card: u.card, id: u.card.id }); } });
        if (wantItem && !z.pos && f.item && !f.item.isEndrulerFlag) push({ k: "item", side, pos: "item", unit: f.item, card: f.item.card, id: f.item.card.id });
        if (wantSet && !z.pos) (f.setSpells || []).forEach((c, i) => push({ k: "set", side, idx: i, card: c, id: c.id, unit: null }));
        return;
      }
      const arrName = area === "drop zone" ? "drop" : area === "hand" ? "hand" : area === "gauge" ? "gauge" : area === "deck" ? "deck" : null;
      if (!arrName) return;
      let arr = f[arrName];
      let idxs = arr.map((_, i) => i);
      if (area === "deck" && z.top) idxs = idxs.slice(0, np.topN || np.qty.n || 1);
      if (area === "deck" && z.bottom) idxs = idxs.slice(-(np.topN || 1));
      idxs.forEach(i => push({ k: "zone", side, area: arrName, idx: i, id: arr[i], card: cardOf(arr[i]), unit: null }));
    });
    // an NP like "another «X»" must not include the source itself
    if (np.excludeSelf && ctx.unit) return out.filter(r => r.unit !== ctx.unit);
    return out;
  }
  core.refsFor = refsFor;

  function soulRefs(unit, side) {
    if (!unit) return [];
    return (unit.soul || []).map((id, i) => ({ k: "soul", side, host: unit, idx: i, id, card: cardOf(id), unit: null }));
  }
  core.soulRefs = soulRefs;

  /* ============================================================
   * 4. CONDITIONS
   * ============================================================ */
  const cmpN = (v, c) => (c.cmp === "le" ? v <= c.n : c.cmp === "ge" ? v >= c.n : c.cmp === "gt" ? v > c.n : v === c.n);

  function flagCard(f) { return cardOf(f.flagId) || null; }

  function countNP(np, ownerRel, ctx, def) {
    const ctx2 = Object.assign({}, ctx);
    let np2 = np;
    // owner words that are only in the condition ("your opponent has a ...")
    if (ownerRel && !np.zone) np2 = Object.assign({}, np, { zone: { owner: ownerRel, area: (def && def.area) || "field" } });
    const refs = refsFor(np2, ctx2, def || { owner: ownerRel || "any", area: "field" });
    if (np.filter && np.filter.distinct) { const names = new Set(refs.map(r => r.card.name)); return names.size; }
    return refs.length;
  }

  function evalCond(c, ctx) {
    if (!c) return true;
    const f = ctx.f, e = ctx.e;
    switch (c.t) {
      case "always": return true;
      case "and": return c.list.every(x => evalCond(x, ctx));
      case "or": return c.list.some(x => evalCond(x, ctx));
      case "turn": return c.who === "you" ? B.activeSide === ctx.side : B.activeSide !== ctx.side;
      case "phase": return B.phase === c.phase && (!c.who || (c.who === "you" ? B.activeSide === ctx.side : B.activeSide !== ctx.side));
      case "underAttack": { const bc = ABX.battleCtx; return !!(bc && bc.active && bc.defSide === ctx.side) || (!!B.pendingDefenseContext && B.pendingDefenseContext.defSide === ctx.side); }
      case "selfPos": return !!ctx.unit && posOfUnit(f, ctx.unit) === c.pos;
      case "selfOnField": return !!ctx.unit && posOfUnit(f, ctx.unit) !== null || (ctx.card && (f.setSpells || []).includes(ctx.card));
      case "selfIn": return ctx.hostArea === (c.area === "drop zone" ? "drop" : c.area);
      case "selfInSoulOf": { if (!ctx.soulHost) return false; const refs = refsFor(c.np, ctx, { owner: "you", area: "field" }); return refs.some(r => r.unit === ctx.soulHost); }
      case "selfStat": { if (!ctx.unit) return false; const e2 = getUnitEffectiveCombatStats(f, ctx.unit); const v = c.stat === "power" ? e2.power : c.stat === "defense" ? e2.defense : c.stat === "critical" ? e2.crit : getEffectiveCardSize(f, ctx.card); return cmpN(v, c); }
      case "refType": { const r = (ctx.bind.revealed || []).concat(ctx.bind.looked || [], ctx.bind.chosen || []).filter(x => x && x.card).pop(); if (!r) return false; const k = r.card.type; return c.type === "monster" ? isMonsterCard(r.card) : c.type === "spell" ? k === "Spell" : c.type === "item" ? k === "Item" : k === "Impact"; }
      case "refTribe": { const r = (ctx.bind.revealed || []).concat(ctx.bind.looked || [], ctx.bind.chosen || []).filter(x => x && x.card).pop(); return !!r && tribeEq(r.card, c.tribe); }
      case "selfPosAny": return !!ctx.unit && c.pos.includes(posOfUnit(f, ctx.unit));
      case "selfRested":      case "selfRested": return !!ctx.unit && (!!ctx.unit.rested === c.v);
      case "selfSoul": return !!ctx.unit && cmpN((ctx.unit.soul || []).length, c);
      case "selfSoulName": return !!ctx.unit && (ctx.unit.soul || []).some(id => lc((cardOf(id) || {}).name).includes(c.name));
      case "selfSet": return (f.setSpells || []).includes(ctx.card);
      case "life": return cmpN((c.who === "you" ? f : e).life, c);
      case "lifeVs": return c.cmp === "le" ? f.life <= e.life : f.life > e.life;
      case "gauge": return cmpN((c.who === "you" ? f : e).gauge.length, c);
      case "hand": return cmpN((c.who === "you" ? f : e).hand.length, c);
      case "flagIs": { const fc = flagCard(f); const n = lc(fc ? fc.name : ""); return c.names.some(x => n === x || n.includes(x)); }
      case "flagWorld": return f.world === c.world || (flagCard(f) && (flagCard(f).worlds || []).includes(c.world)) || !!(f.abxFlagWorlds && f.abxFlagWorlds.turn === B.turnCount && f.abxFlagWorlds.worlds.some(w => lc(w) === lc(c.world)));
      case "reversal": return getFighterReversalCount(f) >= c.n;
      // "another ..." in a condition never counts the card itself
      case "has": { const n = countNP(c.other ? Object.assign({}, c.np, { excludeSelf: true }) : c.np, c.owner === "any" ? null : c.owner, ctx); return n >= (c.n || 1); }
      case "not": return !evalCond(c.c, ctx);
      case "hasNot": return countNP(c.other ? Object.assign({}, c.np, { excludeSelf: true }) : c.np, c.owner === "any" ? null : c.owner, ctx) === 0;
      case "count": return cmpN(countNP(c.other ? Object.assign({}, c.np, { excludeSelf: true }) : c.np, c.owner === "any" ? null : c.owner, ctx), c);
      case "itemEquipped": { const it = f.item && !f.item.isEndrulerFlag ? f.item : null; if (!it) return false; if (!c.np || c.any) return true; return matchFilter(it.card, c.np.filter || {}, { unit: it, side: ctx.side }, ctx); }
      case "monsterCount": return cmpN(fieldUnits(F(c.who === "you" ? ctx.side : otherSide(ctx.side)), false).length, c);
      case "onlyThis": return fieldUnits(f, false).length === 1 && fieldUnits(f, false)[0].unit === ctx.unit;
      case "buddyOnField": return !!f.buddyCalled && fieldUnits(f, false).some(x => x.unit.isBuddyGift || x.unit.card.id === f.buddyId);
      case "noBattle": return !(ABX.battleCtx && ABX.battleCtx.active);
      case "inBattle": return !!(ABX.battleCtx && ABX.battleCtx.active);
      case "oppAttackCount": return turnStats(e).attacks >= c.n;
      case "myAttackCount": return turnStats(f).attacks >= c.n;
      case "attackedThisTurn": return turnStats(f).attacks >= 1;
      case "castThisTurn": { const S = turnStats(f); if (!c.np || !c.np.filter || !Object.keys(c.np.filter).some(k => k !== "types")) return S.castThisTurn >= 1; return S.castCards.some(id => { const cc = cardOf(id); return cc && matchFilter(cc, c.np.filter, null, ctx); }); }
      case "event": { if (!ctx.event || !ctx.event.name) return true; return ctx.event.name === c.trigger.event; }
      default: { const xf = ABX.extraCond && ABX.extraCond[c.t]; return xf ? !!xf(c, ctx) : false; }   // condition types added by later files (abilities_r9.js)
    }
  }
  core.evalCond = evalCond;

  /* ============================================================
   * 5. TARGET SELECTION
   * ============================================================ */
  function sideIsAuto(side) { return F(side).isBot || ABX.autoPlay === true || ABX.remoteAutoSide === side; }   // remoteAutoSide: the online friend's answer runs here, its small picks are made automatically

  // How "valuable" a card is (for bot picks / which cards to throw away)
  function valueOf(card) { if (!card) return 0; return (card.power || 0) / 1000 + (card.defense || 0) / 2000 + (card.crit || 0) * 2 + (card.size == null ? 0 : card.size) + (card.type === "Monster" ? 1 : 0); }

  function autoPick(cands, n, ctx, intent) {
    const arr = cands.slice();
    if (intent === "harm") arr.sort((a, b) => valueOf(b.card) - valueOf(a.card));
    else if (intent === "cost") arr.sort((a, b) => valueOf(a.card) - valueOf(b.card));
    else arr.sort((a, b) => valueOf(b.card) - valueOf(a.card));
    return arr.slice(0, n);
  }

  // Choose refs for an NP. opts: {intent, title, ordered, min, max, chooser}
  async function pick(cands, np, ctx, opts) {
    if (np && np.qty && (np.qty.eachOf || np.qty.numOf || np.qty.perReversal || np.qty.fromLast)) {
      // "for each «X» on your field" / "equal to the number of ..." / "for each time your flags [Reversal]" / "equal to the number of cards put"
      const cnt = np.qty.perReversal ? getFighterReversalCount(ctx.f) : np.qty.fromLast ? (ctx.lastCount || 0) : countNP(np.qty.eachOf || np.qty.numOf, null, ctx);
      np = Object.assign({}, np, { qty: Object.assign({}, np.qty, { n: (np.qty.numOf || np.qty.fromLast) ? cnt : (np.qty.n || 1) * cnt, all: false, eachOf: null, numOf: null, perReversal: false, fromLast: false }) });
      if (np.qty.n <= 0) return [];
    }
    const out0 = await pick0(cands, np, ctx, opts);
    const fl = (np && np.filter) || {};
    if (!fl.uniqueBy && !fl.sameBy) return out0;
    const keyOf = (r) => fl.uniqueBy === "size" || fl.sameBy === "size" ? statOf(r.card, r.unit, r.side ? F(r.side) : null, "size") : lc(r.card.name);
    const kept = [];
    for (const r of out0) {
      if (fl.uniqueBy && kept.some(k => keyOf(k) === keyOf(r))) continue;
      if (fl.sameBy && kept.length && keyOf(kept[0]) !== keyOf(r)) continue;
      kept.push(r);
    }
    return kept;
  }
  async function pick0(cands, np, ctx, opts) {
    // "up to one «A» and up to one «B»": one pick per part, each from the cards that match that part
    if (np && np.parts && np.parts.length) {
      const out = [];
      for (const part of np.parts) {
        const pc = cands.filter(r => !out.includes(r) && r.card && matchFilter(r.card, part.filter || {}, r, ctx));
        if (!pc.length) continue;
        const sub = await pick(pc, part, ctx, Object.assign({}, opts, { subtitle: ABX.clean(part.raw || "") || (opts && opts.subtitle) }));
        out.push(...sub);
      }
      return out;
    }
    opts = opts || {};
    const q = np && np.qty ? np.qty : { n: 1 };
    let n = q.all ? cands.length : Math.min(q.n || 1, cands.length);
    let min = q.upTo ? 0 : n;
    if (opts.min != null) min = opts.min;
    if (opts.max != null) n = Math.min(n, opts.max);
    if (!cands.length || n <= 0) return [];
    if (q.all) return cands.slice();
    // distinct names (e.g. "monsters each of different sizes") are not auto-handled; pick as normal
    const chooserSide = opts.chooserSide || ctx.side;
    if (!q.upTo && cands.length <= n) return cands.slice();
    if (sideIsAuto(chooserSide)) {
      const intent = opts.intent || (cands[0].side !== ctx.side ? "harm" : "help");
      const k = q.upTo ? n : n;     // bots take as many as allowed
      return autoPick(cands, k, ctx, intent);
    }
    const idxs = await ABX.ui.pickCards({
      title: opts.title || `${ctx.card ? ctx.card.name : "Ability"} — choose`,
      subtitle: opts.subtitle || (np && np.raw ? np.raw : ""),
      cards: cands.map(r => ({ card: r.card, badge: (r.k === "unit" || r.k === "item") ? (r.side === ctx.side ? "Your field" : "Opp field") : (r.k === "zone" ? (r.side === ctx.side ? "Yours" : "Opp") : r.k) })),
      min, max: n, ordered: !!opts.ordered
    });
    return (idxs || []).map(i => cands[i]).filter(Boolean);
  }
  core.pick = pick;
  core.autoPick = autoPick;

  /* ============================================================
   * 6. MOVING CARDS
   * ============================================================ */
  // Take a card out of where it is. Returns card id (or null).
  function detach(ref, why) {
    const f = F(ref.side);
    if (ref.k === "zone") {
      const arr = f[ref.area];
      let i = arr[ref.idx] === ref.id ? ref.idx : arr.indexOf(ref.id);
      if (i < 0) return null;
      arr.splice(i, 1);
      return ref.id;
    }
    if (ref.k === "unit") {
      const p = posOfUnit(f, ref.unit);
      if (!p) return null;
      f.monsters[p] = null;
      if (ref.unit.soul && ref.unit.soul.length) { f.drop.push(...ref.unit.soul); ref.unit.soul = []; }
      if (ref.unit.pairedHalfIds && ref.unit.pairedHalfIds.length > 1) { ref.unit.pairedHalfIds.slice(1).forEach(id => f.drop.push(id)); }
      return ref.card.id;
    }
    if (ref.k === "item") {
      if (f.item !== ref.unit) return null;
      f.item = null;
      if (ref.unit.soul && ref.unit.soul.length) { f.drop.push(...ref.unit.soul); ref.unit.soul = []; }
      return ref.card.id;
    }
    if (ref.k === "set") {
      const i = (f.setSpells || []).indexOf(ref.card);
      if (i < 0) return null;
      f.setSpells.splice(i, 1);
      return ref.card.id;
    }
    if (ref.k === "soul") {
      const i = (ref.host.soul || []).indexOf(ref.id);
      if (i < 0) return null;
      ref.host.soul.splice(i, 1);
      return ref.id;
    }
    return null;
  }
  core.detach = detach;

  function place(id, dest, ctx, fromSide) {
    // owner of the destination zone
    let side = dest.owner === "opp" ? otherSide(ctx.side) : dest.owner === "owner" ? (fromSide || ctx.side) : ctx.side;
    const f = F(side);
    switch (dest.area) {
      case "hand": f.hand.push(id); break;
      case "gauge": f.gauge.push(id); break;
      case "drop zone": f.drop.push(id); break;
      case "deck": if (dest.end === "bottom") f.deck.push(id); else f.deck.unshift(id); break;
      case "soul": {
        const host = dest.hostUnit || ctx.unit;
        if (host) { host.soul = host.soul || []; host.soul.push(id); } else F(ctx.side).drop.push(id);
        break;
      }
      default: f.drop.push(id);
    }
    return side;
  }
  core.place = place;

  /* ============================================================
   * 7. PROTECTION / SHIELDS
   * ============================================================ */
  // Is this unit protected from `kind` ("destroyed","returned to hand","rest",...) ?
  // Kinds a continuous "cannot be ..." restriction protects against. "leave the field" / "put to other areas"
  // cover every way an opponent's effect could take the card off the field.
  const LEAVE_KINDS = ["destroyed", "returned to hand", "put into the drop zone", "put into soul", "put into deck", "put to other areas"];
  const PROTECT_KINDS = ["destroyed", "returned to hand", "rest", "nullified", "put into the drop zone", "put to other areas", "leave the field"];
  function protectKinds(st) {
    const out = new Set();
    (st.kinds || []).forEach(k => { if (k === "put to other areas" || k === "leave the field") LEAVE_KINDS.forEach(x => out.add(x)); else out.add(k); });
    return out;
  }
  ABX.protectKinds = protectKinds;
  // A restrict step written as a continuous ability (static text, or the always-on text of an item / soul card).
  function isAuraRestrict(ab, card, st) {
    if (st.op !== "restrict" || !st.np) return false;
    if (!(st.kinds || []).length || !(st.kinds || []).every(k => PROTECT_KINDS.includes(k))) return false;
    if (ab.trigger || ab.kind === "act" || ab.kind === "triggered") return false;
    // On a normal Spell this is a cast effect (OPS.restrict) unless the text only works while the card sits
    // in a soul / on the field ("If this card is in the soul of ...").
    const whileThere = [].concat(ab.conds || [], st.cond ? [st.cond] : []).some(c => ["selfInSoulOf", "selfIn", "selfOnField"].includes(c.t));
    if (ab.kind === "spell" && card && card.type === "Spell" && !card.set && !whileThere) return false;
    return ab.kind === "static" || ab.kind === "spell";
  }
  ABX.isAuraRestrict = isAuraRestrict;
  function auraTargets(st, sctx, src) {
    const np = st.np;
    const junk = String(np.junk || "").toLowerCase();
    // "The abilities of this card ..." / "this card cannot ..."
    if (np.self || (/\bthis\b/.test(junk) && !(np.filter && (np.filter.tribes || np.filter.names || np.filter.cardNames)))) {
      const me = src.unit || src.host;
      return me ? [me] : [];
    }
    // "... on your field" auras only cover the owner's own field.
    const np2 = Object.assign({}, np, { zone: Object.assign({}, np.zone || { area: "field" }, { owner: "you" }) });
    if (!np2.zone.area || !["field", "center", "left", "right"].includes(np2.zone.area)) np2.zone.area = "field";
    return refsFor(np2, sctx, { owner: "you", area: "field" }).filter(r => r.unit).map(r => r.unit);
  }

  // Is this unit protected from `kind` ("destroyed","returned to hand","rest",...) ?
  function isProtected(unit, side, kind, ctx) {
    if (!unit) return false;
    if (kind === "destroyed" && unit.tempIndestructible) return true;
    if (unit.abxNo && unit.abxNo[kind] === B.turnCount) return true;
    if (unit.abxNo && LEAVE_KINDS.includes(kind) && (unit.abxNo["put to other areas"] === B.turnCount || unit.abxNo["leave the field"] === B.turnCount)) return true;
    const f = F(side);
    const byOppSide = ctx && ctx.side && ctx.side !== side;
    const sources = [];
    fieldUnits(f, true).forEach(x => {
      sources.push({ unit: x.unit, card: x.unit.card, host: null });
      (x.unit.soul || []).forEach(id => { const c = cardOf(id); if (c) sources.push({ unit: null, card: c, host: x.unit }); });
    });
    (f.setSpells || []).forEach(c => sources.push({ unit: null, card: c, host: null }));
    for (const src of sources) {
      const parsed = ABX.get(src.card);
      if (!parsed) continue;
      if ((src.unit && src.unit.abxNullified === B.turnCount) || (src.host && src.host.abxNullified === B.turnCount)) continue;
      for (const ab of parsed.abilities) {
        if (ab.kind !== "static" && ab.kind !== "spell") continue;
        if (ab.unparsed && ab.unparsed.length) continue;
        for (const s of ab.steps || []) {
          const isProt = s.op === "static" && s.kind === "protect";
          const isAura = !isProt && isAuraRestrict(ab, src.card, s);
          if (!isProt && !isAura) continue;
          if (isProt && !s.kinds.includes(kind)) continue;
          if (isAura && !protectKinds(s).has(kind)) continue;
          if (s.byOpp && !byOppSide) continue;
          // Soul cards only work while in a soul; field / set cards only while on the field.
          const sctx = { side, f, e: F(otherSide(side)), unit: src.unit, card: src.card, soulHost: src.host, hostArea: src.host ? "soul" : "field",
            bind: { chosen: src.host ? [{ k: "unit", side, unit: src.host, card: src.host.card, id: src.host.card.id }] : [] } };
          if (!(ab.conds || []).every(c => evalCond(c, sctx))) continue;
          if (s.cond && !evalCond(s.cond, sctx)) continue;
          if (isProt) {
            if (s.self) { if (src.unit === unit) return true; continue; }
            if (s.np) {
              const refs = refsFor(s.np, sctx, { owner: "you", area: "field" });
              if (refs.some(r => r.unit === unit)) return true;
            }
          } else if (auraTargets(s, sctx, src).includes(unit)) return true;
        }
      }
    }
    return false;
  }
  core.isProtected = isProtected;

  // Apply damage to a fighter, respecting shields. Returns the damage that was actually dealt.
  function applyDamage(side, n, src) {
    const f = F(side);
    const S = st(f);
    let dmg = Math.max(0, n);
    src = src || {};
    const fits = (sh) => !((sh.from === "attack" && src.kind !== "attack") || (sh.from === "effect" && src.kind !== "effect") ||
      (sh.from === "notAttack" && src.kind === "attack") || (sh.from === "impact" && src.kind !== "impact"));
    const apply = (sh) => {
      const before = dmg;
      if (sh.toZero) dmg = 0;
      else if (sh.capTo != null) dmg = Math.min(dmg, sh.capTo);
      else dmg = Math.max(0, dmg - (sh.reduceBy || 0));
      if (sh.gainLife && before > dmg) f.life += sh.gainLife;
      return before !== dmg;
    };
    // "for this turn" shields expire when the turn ends
    S.shields = S.shields.filter(sh => sh.turn === B.turnCount || sh.mode === "nextTurn" && sh.turn === B.turnCount - 1);
    if (!src.unreducible) {
      for (let i = 0; i < S.shields.length && dmg > 0; i++) {
        const sh = S.shields[i];
        if (!fits(sh)) continue;
        apply(sh);
        if (sh.mode === "next") { S.shields.splice(i, 1); i--; }
      }
      // continuous shields ("Damage you take are reduced by 1." on a card on your field)
      if (dmg > 0) ABX.staticShields(side).forEach(sh => { if (dmg > 0 && fits(sh)) apply(sh); });
    }
    f.life -= dmg;
    return dmg;
  }
  // Continuous damage reduction from static abilities on `side`'s field (incl. soul and set cards).
  ABX.staticShields = function (side) {
    const f = F(side), out = [];
    const srcs = [];
    fieldUnits(f, true).forEach(x => { srcs.push({ unit: x.unit, card: x.unit.card, host: null }); (x.unit.soul || []).forEach(id => { const c = cardOf(id); if (c) srcs.push({ unit: null, card: c, host: x.unit }); }); });
    (f.setSpells || []).forEach(c => srcs.push({ unit: null, card: c, host: null }));
    for (const src of srcs) {
      if ((src.unit && src.unit.abxNullified === B.turnCount) || (src.host && src.host.abxNullified === B.turnCount)) continue;
      for (const ab of ABX.get(src.card).abilities) {
        if (ab.kind !== "static" || (ab.unparsed && ab.unparsed.length) || !(ab.steps || []).length) continue;
        if (!ab.steps.some(x => x.op === "shield")) continue;
        const ctx = { side, f, e: F(otherSide(side)), card: src.card, unit: src.unit, soulHost: src.host, hostArea: src.host ? "soul" : "field", bind: { chosen: [] } };
        if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
        ab.steps.forEach(x => { if (x.op === "shield" && (!x.cond || evalCond(x.cond, ctx))) out.push({ reduceBy: x.reduceBy || 0, toZero: !!x.toZero, capTo: x.capTo != null ? x.capTo : null, from: x.from || null }); });
      }
    }
    return out;
  };
  core.applyDamage = applyDamage;

  /* ============================================================
   * 8. THE RUNNER
   * ============================================================ */
  function describeStep(s) {
    switch (s.op) {
      case "pay": return `Pay ${[s.gauge ? s.gauge + " gauge" : "", s.life ? s.life + " life" : ""].filter(Boolean).join(" and ")}`;
      case "discard": return "Discard a hand card";
      case "restSelf": return "[Rest] this card";
      case "draw": return `Draw ${typeof s.n === "number" ? s.n : "some"} card(s)`;
      case "destroy": return `Destroy ${s.np ? s.np.raw : "a card"}`;
      case "call": return `Call ${s.np ? s.np.raw : "a card"}`;
      default: return s.src || s.op;
    }
  }
  core.describeStep = describeStep;

  function costAffordable(s, ctx) {
    const f = ctx.f;
    if (s.op === "pay") {
      if (s.gauge && f.gauge.length < s.gauge) return false;
      if (s.life && f.life <= s.life) return false;
      if (s.restSelf && ctx.unit && ctx.unit.rested) return false;
      return true;
    }
    if (s.op === "discard") return s.all ? true : f.hand.length >= (s.n || 1);
    if (s.op === "restSelf") return !!ctx.unit && !ctx.unit.rested;
    return true;
  }
  core.costAffordable = costAffordable;

  async function decideOptional(s, ctx) {
    if (OPS[s.op] && OPS[s.op].canDo && !OPS[s.op].canDo(s, ctx)) return false;
    if (!costAffordable(s, ctx)) return false;
    if (ctx.preApproved) return true;   // already chosen in a response window
    if (ctx.auto || sideIsAuto(ctx.side)) {
      if (F(ctx.side).isBot && s.op === "pay" && s.life) return F(ctx.side).life > 6;
      return true;
    }
    const yes = await ABX.ui.confirm({
      title: `${ctx.card ? ctx.card.name : "Ability"} — use effect?`,
      text: `You may: ${describeStep(s)}`,
      card: ctx.card, yes: "✨ Yes", no: "No / Skip"
    });
    return !!yes;
  }

  async function runSteps(steps, ctx) {
    for (const s of steps) {
      if (B.matchOver) break;
      if (s.gate === "ifYouDo" && !ctx.lastDone) continue;
      if (s.gate === "ifNotDone" && ctx.lastDone) continue;
      if (s.cond && !evalCond(s.cond, ctx)) { ctx.lastDone = false; continue; }
      const op = OPS[s.op];
      if (!op || !op.run) { ctx.log.push("unsupported:" + s.op); continue; }
      if (s.optional && !(await decideOptional(s, ctx))) { ctx.lastDone = false; continue; }
      let ok;
      try { ok = await op.run(s, ctx); }
      catch (err) { ctx.log.push("error:" + s.op + ":" + (err && err.message)); if (ABX.debug) console.error(err); ok = false; }
      ctx.lastDone = ok !== false;
    }
  }

  ABX.stats = ABX.stats || { runs: 0 };
  async function runAbility(side, card, ab, unit, opts) {
    opts = opts || {};
    ABX.stats.runs++;
    const f = F(side), e = F(otherSide(side));
    const ctx = { side, f, e, card, unit: unit || null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, event: opts.event || null, auto: !!opts.auto, log: [], hostArea: opts.hostArea || (unit ? "field" : null), soulHost: opts.soulHost || null, selfRef: opts.selfRef || null, preApproved: !!opts.preApproved };
    // "This card cannot be nullified, and its damage cannot be reduced" / "This damage cannot be reduced" (written after the damage)
    if ((ab.steps || []).some(x => x.op === "static" && !x.cond && (x.kind === "unreducible" || (x.kind === "unnullifiable" && x.noReduce)))) ctx.unreducible = true;
    // hook: [G.BOOST] used this turn, [G.EVO] calls (abilities_gkw.js)
    if (ABX.onAbilityStart) { try { ABX.onAbilityStart(ctx); } catch (e) { if (ABX.debug) console.error(e); } }
    if (ab.kind === "modal") {
      await runSteps(ab.steps || [], ctx);
      if (!ctx.lastDone) return ctx;
      const options = ab.options.filter(o => (o.conds || []).every(c => evalCond(c, ctx)));
      let idx = 0;
      if (options.length > 1) {
        if (ctx.auto || sideIsAuto(side)) idx = Math.max(0, options.findIndex(o => o.steps.every(s => !s.cost)));
        else idx = await ABX.ui.pickOption({ title: `${card.name} — choose one`, options: options.map(o => ({ label: ABX.clean(o.raw).replace(/^-\s*/, "").slice(0, 160) })) });
      }
      if (idx < 0 || !options[idx]) return ctx;
      await runSteps(options[idx].steps, ctx);
    } else {
      await runSteps(ab.steps, ctx);
    }
    // revealed / looked-at cards that were not moved go back where they came from (top of the deck)
    [].concat(ctx.bind.revealed || [], ctx.bind.looked || []).forEach(r => { if (r && r.id != null && r.pending) { F(r.side).deck.unshift(r.id); r.pending = false; } });
    B.renderBattle();
    return ctx;
  }
  core.runAbility = runAbility;
  core.runSteps = runSteps;

  /* once-per-turn / once-per-game bookkeeping */
  function onceKey(card, ab, unit) { return ab.name ? "n:" + lc(ab.name) : "c:" + card.id + ":" + ab.idx + ":" + (unit ? uid(unit) : 0); }
  function onceUsed(f, card, ab, unit) {
    if (!ab.once) return false;
    const S = st(f), k = onceKey(card, ab, unit);
    if (ab.once === "game") return !!S.onceGame[k];
    if (ab.once === "phase") return S.onceTurn[k] === B.turnCount + ":" + B.phase;
    return S.onceTurn[k] === B.turnCount;
  }
  function markOnce(f, card, ab, unit) {
    if (!ab.once) return;
    const S = st(f), k = onceKey(card, ab, unit);
    if (ab.once === "game") S.onceGame[k] = true;
    else S.onceTurn[k] = ab.once === "phase" ? B.turnCount + ":" + B.phase : B.turnCount;
  }
  core.onceUsed = onceUsed; core.markOnce = markOnce;

  /* ============================================================
   * 9. WHICH ABILITIES OF A CARD EXIST (by kind)
   * ============================================================ */
  function abilitiesOf(card, filter) {
    const p = ABX.get(card);
    if (!p) return [];
    return p.abilities.filter(filter || (() => true));
  }
  core.abilitiesOf = abilitiesOf;

  ABX.ownsEnter = function (card) { return abilitiesOf(card, a => a.trigger && a.trigger.event === "enter" && a.trigger.self && ABX.isExecutable(a)).length > 0; };

  // Is this an activated ability usable right now?
  // [Act]s used from the field (ones that discard / call "this card from your hand" are hand abilities)
  const FROM_HAND_RE = /\bthis card from (?:your )?hand\b|\bthis hand card\b|\b(?:discard|drop) this card\b/i;
  ABX.actAbilities = function (card) { return abilitiesOf(card, a => a.kind === "act" && !(a.trigger && a.trigger.event === "oppCast") && ABX.isExecutable(a) && !(a.steps || []).some(x => x.op === "call" && x.np && x.np.self) && !FROM_HAND_RE.test(a.cleaned || "")); };
  ABX.canUseAct = function (side, card, ab, unit) {
    const f = F(side), e = F(otherSide(side));
    const ctx = { side, f, e, card, unit, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "field" };
    if (unit && unit.abxNullified === B.turnCount) return { ok: false, reason: "Abilities are nullified this turn" };
    if (onceUsed(f, card, ab, unit)) return { ok: false, reason: "Already used this turn" };
    if (!(ab.conds || []).every(c => evalCond(c, ctx))) return { ok: false, reason: "Timing / condition not met" };
    // a leading mandatory cost must be payable
    const steps = ab.kind === "modal" ? [] : ab.steps;
    for (const s of steps) {
      if (s.gate || s.optional) break;
      if (s.cost && !costAffordable(s, ctx)) return { ok: false, reason: "Cannot pay the cost" };
      if (!s.cost) break;
    }
    return { ok: true };
  };

  /* ============================================================
   * 10. ENTRY POINTS CALLED FROM game.js
   * ============================================================ */
  let busy = 0;
  // Cut-in banner "ABILITY!" when a card uses one of its abilities (shown to the online friend too).
  const announce = (card, ab) => { try { if (B.showCutin && card) B.showCutin("ABILITY!", card.name, card.img); } catch (e) { /* ignore */ } };
  const done = (cb) => { try { cb && cb(); } catch (e) { if (ABX.debug) console.error(e); } };

  // "When this card enters the field" (and other self-enter triggers). Returns a Promise.
  ABX.fireEnter = async function (side, card, unit, onAfter) {
    busy++;
    try {
      for (const ab of abilitiesOf(card, a => a.trigger && a.trigger.event === "enter" && a.trigger.self && ABX.isExecutable(a))) {
        const f = F(side);
        if (onceUsed(f, card, ab, unit)) continue;
        if (ab.trigger.pos && unit && !ab.trigger.pos.includes(core.posOfUnit(f, unit))) continue;
        const probe = { side, f, e: F(otherSide(side)), card, unit, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "field" };
        if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
        markOnce(f, card, ab, unit);
        announce(card, ab);
        await runAbility(side, card, ab, unit, { event: { name: "enter" } });
      }
    } finally { busy--; }
    done(onAfter);
  };

  // Player pressed "Use Card Ability / [Act]" on a unit. Returns true if ABX handled it.
  ABX.useAct = async function (side, card, unit, onAfter) {
    const list = ABX.actAbilities(card);
    if (!list.length) return false;
    const f = F(side);
    let usable = list.filter(a => ABX.canUseAct(side, card, a, unit).ok);
    if (!usable.length) {
      const why = ABX.canUseAct(side, card, list[0], unit).reason;
      if (!f.isBot && B.setPrompt) B.setPrompt(`✖ "${card.name}" cannot use its [Act] now: ${why}.`);
      done(onAfter);
      return true;
    }
    let ab = usable[0];
    if (usable.length > 1 && !f.isBot) {
      const i = await ABX.ui.pickOption({ title: `${card.name} — which ability?`, options: usable.map(a => ({ label: ABX.clean(a.raw || "").slice(0, 200) })), allowNone: true });
      if (i < 0) { done(onAfter); return true; }
      ab = usable[i];
    }
    markOnce(f, card, ab, unit);
    if (!ab.once && unit) unit.actUsed = true;
    announce(card, ab);
    await runAbility(side, card, ab, unit, { event: { name: "act" } });
    done(onAfter);
    return true;
  };

  /* ---- serialised queue so popups from several triggers never overlap ---- */
  let chain = Promise.resolve();
  ABX.queue = (fn) => { chain = chain.then(fn).catch(e => { if (ABX.debug) console.error(e); }); return chain; };

  // All trigger sources on a side: field units, item, set spells.
  function sources(side) {
    const f = F(side), out = fieldUnits(f, true).map(x => ({ unit: x.unit, card: x.unit.card }));
    (f.setSpells || []).forEach(c => out.push({ unit: null, card: c }));
    return out;
  }
  core.sources = sources;
  core.fireTriggers = (match, info) => fireTriggers(match, info);

  // Run every executable triggered ability matching `match(trigger, src, sideOfSource)`.
  async function fireTriggers(match, info) {
    const order = [B.activeSide, otherSide(B.activeSide)];
    for (const side of order) {
      for (const src of sources(side)) {
        for (const ab of abilitiesOf(src.card, a => a.kind === "triggered" && a.trigger && ABX.isExecutable(a))) {
          if (!match(ab.trigger, src, side)) continue;
          const f = F(side);
          if (src.unit && core.posOfUnit(f, src.unit) === null && !(src.unit === f.item)) continue;
          if (src.unit && src.unit.abxNullified === B.turnCount) continue;
          if (onceUsed(f, src.card, ab, src.unit)) continue;
          const probe = { side, f, e: F(otherSide(side)), card: src.card, unit: src.unit, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "field", event: info };
          if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
          markOnce(f, src.card, ab, src.unit);
          announce(src.card, ab);
          await runAbility(side, src.card, ab, src.unit, { event: info });
          if (B.matchOver) return;
        }
      }
    }
  }

  const whoOK = (t, side) => !t.who || t.who === "any" || t.who === "each" || (t.who === "you" ? B.activeSide === side : B.activeSide !== side);

  ABX.fireAttack = function (attSide, units, defSide, targetPos) {
    turnStats(F(attSide)).attacks++;   // a link attack counts as one attack
    units.forEach(u => { if (u && u.unit) u.unit.abxAttacked = B.turnCount; });
    return ABX.queue(async () => {
      const us = new Set(units.map(u => u.unit));
      const defUnit = ["left", "center", "right"].includes(targetPos) ? F(defSide).monsters[targetPos] : null;
      const tgtOK = (t) => (!t.targetPos || t.targetPos.includes(targetPos)) && (!t.target || (defUnit && matchFilter(defUnit.card, t.target.filter || {}, { unit: defUnit, side: defSide }, { f: F(defSide) })));
      if (ABX.applyBattleNullify) ABX.applyBattleNullify(attSide, units.map(u => u.unit), defSide, defUnit);
      await fireTriggers((t, src, side) => (t.event === "attack" && t.self && tgtOK(t) && side === attSide && us.has(src.unit)) ||
        (t.event === "link" && t.self && units.length > 1 && side === attSide && us.has(src.unit) && (!ABX.linkWithOK || ABX.linkWithOK(t, src.unit, units, attSide))) ||
        (t.event === "otherAttack" && side === attSide && src.unit && !us.has(src.unit) && !t.np.self && units.some(u => matchFilter(u.unit.card, t.np.filter || {}, { unit: u.unit, side: attSide }, { f: F(attSide) }))) ||
        (t.event === "oppAttack" && side === defSide && (!t.fighterTarget || !defUnit)) ||
        (t.event === "attacked" && t.self && side === defSide && defUnit && src.unit === defUnit), { name: "attack", attSide, defSide, attUnits: units.map(u => u.unit), defUnit });
    }).catch(() => {});
  };
  ABX.fireAttackOutcome = function (attSide, units, defSide, outcome) {
    return ABX.queue(async () => {
      const us = new Set(units.map(u => u.unit));
      if (outcome && outcome.dealtDamage) {
        await fireTriggers((t, src, side) => (t.event === "attack" && t.also === "dealsDamage" && side === attSide && us.has(src.unit)) || (t.event === "dealsDamage" && side === attSide && (t.self ? us.has(src.unit) : units.some(u => t.np && matchFilter(u.unit.card, t.np.filter || {}, { unit: u.unit, side: attSide }, { f: F(attSide) })))) ||
          (t.event === "damaged" && ((t.who === "opp" ? side === attSide : side === defSide))), { name: "dealsDamage" });
      }
      if (outcome && (outcome.destroyedMonster || outcome.dealtDamage)) {
        await fireTriggers((t, src, side) => t.event === "attackOutcome" && t.self && side === attSide && us.has(src.unit), { name: "attackOutcome" });
      }
      if (outcome && outcome.destroyedMonster) {
        await fireTriggers((t, src, side) => t.event === "attackDestroys" && t.self && side === attSide && us.has(src.unit), { name: "attackDestroys" });
      }
    });
  };
  ABX.fireDamaged = function (side) {
    return ABX.queue(() => fireTriggers((t, src, s) => t.event === "damaged" && (t.who === "opp" ? s !== side : s === side), { name: "damaged" }));
  };
  ABX.fireDiscarded = function (side, card) {
    return ABX.queue(async () => {
      const f = F(side);
      for (const ab of abilitiesOf(card, a => a.kind === "triggered" && a.trigger && a.trigger.event === "discardedFromHand" && ABX.isExecutable(a))) {
        if (onceUsed(f, card, ab, null)) continue;
        const idx = f.drop.lastIndexOf(card.id);
        if (idx < 0) continue;
        const ctx = { side, f, e: F(otherSide(side)), card, unit: null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "drop", selfRef: { k: "zone", side, area: "drop", idx, id: card.id, card } };
        if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
        markOnce(f, card, ab, null);
        await runAbility(side, card, ab, null, { event: { name: "discarded" }, hostArea: "drop", selfRef: ctx.selfRef });
      }
    });
  };
  ABX.fireBattleEnd = function (attSide, units) {
    if (ABX.clearBattleNullify) ABX.clearBattleNullify();
    return ABX.queue(() => fireTriggers((t, src, side) => t.event === "battleEnd" && side === attSide && (!t.self || units.some(u => u.unit === src.unit)) && (!t.link || units.length > 1) && (!t.with || !ABX.linkWithOK || ABX.linkWithOK(t, src.unit, units, attSide)), { name: "battleEnd" }));
  };
  ABX.fireTurnEvent = function (kind, phase) {
    return ABX.queue(() => fireTriggers((t, src, side) => {
      if (kind === "turnStart") return (t.event === "turnStart" || (t.event === "phaseStart" && t.phase === "turn")) && whoOK(t, side);
      if (kind === "turnEnd") return t.event === "turnEnd" && whoOK(t, side);
      if (kind === "phaseStart") return t.event === "phaseStart" && t.phase === phase && whoOK(t, side);
      return false;
    }, { name: kind }));
  };
  ABX.fireOtherEnter = function (side, unit) {
    return ABX.queue(() => fireTriggers((t, src, s) => t.event === "otherEnter" && src.unit !== unit &&
      ((!t.opp && s === side) || (t.opp && s !== side)) && matchFilter(unit.card, (t.np && t.np.filter) || {}, { unit, side }, { f: F(side) }), { name: "otherEnter" }));
  };
  ABX.fireCast = function (side, card) {
    if (card) { const S = turnStats(F(side)); S.castThisTurn++; S.castCards.push(card.id); }
    return ABX.queue(() => fireTriggers((t, src, s) => (t.event === "youCast" && s === side || t.event === "oppCast" && s !== side) &&
      (!t.np || matchFilter(card, t.np.filter || {}, { side }, { f: F(side) })), { name: "cast" }));
  };
  // "When you equip this card, ..."
  ABX.fireEquipped = function (side, card, unit) {
    return ABX.queue(async () => {
      const f = F(side);
      for (const ab of abilitiesOf(card, a => a.kind === "triggered" && a.trigger && a.trigger.event === "equipped" && ABX.isExecutable(a))) {
        if (f.item !== unit || onceUsed(f, card, ab, unit)) continue;
        const probe = { side, f, e: F(otherSide(side)), card, unit, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "field", event: { name: "equipped" } };
        if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
        markOnce(f, card, ab, unit);
        announce(card, ab);
        await runAbility(side, card, ab, unit, { event: { name: "equipped" } });
      }
    });
  };
  // "When you gain life" / "When your opponent gains life". Gains made while these triggers run do not trigger again
  // (otherwise "when you gain life, ... you gain 1 life" would loop forever).
  let lifeDepth = 0;
  ABX.fireLifeGain = function (side) {
    if (lifeDepth || ABX.noLifeEvents || B.matchOver) return;
    return ABX.queue(async () => {
      lifeDepth++;
      try { await fireTriggers((t, src, s) => t.event === "lifeGain" && (t.who === "opp" ? s !== side : s === side), { name: "lifeGain", side }); }
      finally { lifeDepth--; }
    });
  };
  // "When the number of cards in this card's soul becomes 0"
  ABX.fireSoulEmpty = function (side, unit) {
    return ABX.queue(() => fireTriggers((t, src, s) => t.event === "soulEmpty" && s === side && src.unit === unit, { name: "soulEmpty" }));
  };
  // Watch life totals and soul sizes without touching every place in game.js that changes them.
  const soulSeen = new WeakMap();
  function sideOfF(f) { return B.plr === f ? "plr" : B.opp === f ? "opp" : null; }
  function watchLife(f) {
    if (!f || typeof f !== "object") return;
    const d = Object.getOwnPropertyDescriptor(f, "life");
    if (!d || d.get) return;
    let v = f.life;
    Object.defineProperty(f, "life", {
      configurable: true, enumerable: true,
      get() { return v; },
      set(n) {
        const old = v;
        // "Your opponent cannot gain life" (a continuous ability on the other side)
        if (typeof n === "number" && typeof old === "number" && n > old && ABX.lifeGainBlocked && ABX.lifeGainBlocked(f)) return;
        v = n; if (typeof n === "number" && typeof old === "number" && n > old && ABX.enabled !== false) { const sd = sideOfF(f); if (sd) ABX.fireLifeGain(sd); }
      }
    });
  }
  ABX.watchFighters = function () {
    try {
      [B.plr, B.opp].forEach(watchLife);
      ["plr", "opp"].forEach(side => {
        const f = B.getFighter && B.getFighter(side);
        if (!f || !f.monsters) return;
        fieldUnits(f, true).forEach(x => {
          const u = x.unit, n = (u.soul || []).length, prev = soulSeen.get(u);
          soulSeen.set(u, n);
          if (prev > 0 && n === 0 && ABX.enabled !== false && !B.matchOver) ABX.fireSoulEmpty(side, u);
        });
      });
    } catch (e) { if (ABX.debug) console.error(e); }
  };
  (function hookRender() {
    const orig = B.renderBattle;
    if (typeof orig !== "function" || orig.__abxWrapped) return;
    const w = function () { const r = orig.apply(this, arguments); ABX.watchFighters(); return r; };
    w.__abxWrapped = true;
    B.renderBattle = w;
  })();

  // "When this card is destroyed / leaves the field": the card is already gone, so run with no unit.
  ABX.fireLeave = function (side, card, byAttack) {
    return ABX.queue(async () => {
      for (const ab of abilitiesOf(card, a => a.kind === "triggered" && a.trigger && ((a.trigger.event === "leave" && a.trigger.self && !a.trigger.byOpp && !(a.trigger.byEffect && byAttack) && !(a.trigger.byAttackOnly && !byAttack)) || (a.trigger.event === "attack" && a.trigger.also === "leave")) && ABX.isExecutable(a))) {
        const f = F(side);
        if (onceUsed(f, card, ab, null)) continue;
        const probe = { side, f, e: F(otherSide(side)), card, unit: null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "drop", event: { name: "leave" } };
        if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
        markOnce(f, card, ab, null);
        await runAbility(side, card, ab, null, { event: { name: "leave" }, hostArea: "drop" });
      }
    });
  };

  ABX.fireOtherDestroyed = function (side, card, unit) {
    return ABX.queue(() => fireTriggers((t, src, s) => t.event === "otherDestroyed" && src.unit !== unit && !(t.np && t.np.self) &&
      ((t.opp ? s !== side : s === side)) && (!t.np || matchFilter(card, t.np.filter || {}, { unit: null, side }, { f: F(side) })), { name: "otherDestroyed" }));
  };
  // Spell / impact resolution (kind "spell", no trigger).
  ABX.ownsSpell = function (card) {
    const p = ABX.get(card);
    const sp = p.abilities.filter(a => a.kind === "spell");
    return sp.length > 0 && sp.every(a => ABX.isExecutable(a));
  };
  ABX.fireSpell = async function (side, card, onAfter) {
    busy++;
    try {
      for (const ab of abilitiesOf(card, a => a.kind === "spell")) {
        const f = F(side);
        const probe = { side, f, e: F(otherSide(side)), card, unit: null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], event: { name: "cast" } };
        if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
        await runAbility(side, card, ab, null, { event: { name: "cast" } });
      }
    } finally { busy--; }
    done(onAfter);
    ABX.fireCast(side, card);
  };

  // [Counter] spells cast while defending. Returns {nullified}.
  ABX.ownsCounter = function (card) { return !!card.cnt && ABX.ownsSpell(card); };
  ABX.runCounter = async function (defSide, card, info) {
    const attSide = info.attSide, attF = F(attSide), defF = F(defSide);
    const bc = ABX.battleCtx = {
      active: true, attSide, defSide, nullified: false, link: (info.attackerZones || []).length > 1,
      attUnits: (info.attackerZones || []).map(z => z === "item" ? attF.item : attF.monsters[z]).filter(Boolean),
      defUnit: ["left", "center", "right"].includes(info.targetPos) ? defF.monsters[info.targetPos] : null
    };
    try {
      for (const ab of abilitiesOf(card, a => a.kind === "spell")) {
        const probe = { side: defSide, f: defF, e: attF, card, unit: null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], event: { name: "counter" } };
        if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
        await runAbility(defSide, card, ab, null, { event: { name: "counter" } });
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    ABX.battleCtx = null;
    return { nullified: bc.nullified };
  };

  /* ---- extra [Call Cost] parts the old code ignores: soul from zone, discard, destroy ---- */
  function extraParts(card) {
    const out = [];
    abilitiesOf(card, a => a.kind === "cost" && a.costKind === "call").forEach(a => (a.parts || []).forEach(p => { if (p.soulFrom || p.discard || p.destroy) out.push(p); }));
    return out;
  }
  const AREA = { "drop zone": "drop", hand: "hand", gauge: "gauge", field: "field" };
  function partCands(part, side, card, exclHandIdx) {
    const f = F(side), ctx = { side, f, e: F(otherSide(side)), card, unit: null, bind: {} };
    const spec = part.soulFrom || part.discard || part.destroy;
    const flt = (spec.np && spec.np.filter) || {};
    let area = part.soulFrom ? AREA[spec.area] : part.discard ? "hand" : "field";
    if (area === "field") return refsFor(spec.np, ctx, { owner: "you", area: "field" });
    return f[area].map((id, i) => ({ k: "zone", side, area, idx: i, id, card: cardOf(id) }))
      .filter((r, i) => !(area === "hand" && i === exclHandIdx) && matchFilter(r.card, flt, r, ctx));
  }
  // [Call Cost] "Put this card on top of a «X» on your field": the call goes onto that monster's zone,
  // and the monster (with its soul) becomes the new card's soul.
  ABX.onTopCost = function (card) {
    let np = null;
    abilitiesOf(card, a => a.kind === "cost" && a.costKind === "call").forEach(a => (a.parts || []).forEach(p => { if (p.onTop) np = p.onTop.np; }));
    return np;
  };
  ABX.onTopHosts = function (side, card) {
    const np = ABX.onTopCost(card);
    if (!np) return [];
    const f = F(side), ctx = { side, f, e: F(otherSide(side)), card, unit: null, bind: {} };
    return refsFor(np, ctx, { owner: "you", area: "field" }).filter(r => r.k === "unit" && r.unit);
  };
  ABX.onTopMatches = (side, card, unit) => ABX.onTopHosts(side, card).some(r => r.unit === unit);
  ABX.canPayExtras = function (side, card, exclHandIdx) {
    if (ABX.onTopCost(card) && !ABX.onTopHosts(side, card).length) return false;
    return extraParts(card).every(p => partCands(p, side, card, exclHandIdx).length >= ((p.soulFrom || p.discard || p.destroy).n || 1));
  };
  ABX.hasExtras = (card) => extraParts(card).length > 0;
  // unit may be null (card not on the field yet is fine for discard); soul parts need the new unit
  ABX.payExtras = async function (side, card, unit) {
    const f = F(side);
    for (const part of extraParts(card)) {
      const spec = part.soulFrom || part.discard || part.destroy, n = spec.n || 1;
      const ctx = { side, f, e: F(otherSide(side)), card, unit, bind: {}, auto: true };
      let cands = partCands(part, side, card, -1).filter(r => !(unit && r.unit === unit));
      const np = { qty: { n }, raw: spec.np ? spec.np.raw : "a card" };
      const chosen = await pick(cands, np, ctx, { intent: "cost", title: `${card.name} — pay the Call Cost`, subtitle: part.text, min: Math.min(n, cands.length), max: n });
      for (const r of chosen) {
        if (part.destroy) { const pos = core.posOfUnit(f, r.unit); if (pos) B.destroyMonster(side, pos); continue; }
        const id = detach(r); if (id == null) continue;
        if (part.soulFrom && unit) unit.soul.push(id); else f.drop.push(id);
      }
    }
    fresh_();
  };
  function fresh_() { try { B.renderBattle(); } catch (e) { /* ignore */ } }

  /* ---- static (continuous) stat boosts, replacing the old per-line text guessing for lines ABX fully understands ---- */
  const STATIC_KW = ["penetrate", "counterattack", "double attack", "triple attack", "quadruple attack", "soulguard", "move", "weaponry link"];
  // ("for each time your flags [Reversal]" is read here now: the count is the fighter's real [Reversal] count)
  const SPECIAL_LEGACY = /overgod|endruler/i;
  const STATIC_CACHE = new Map();
  function staticBoosts(card) {
    let r = STATIC_CACHE.get(card.id);
    if (r) return r;
    r = { abs: [], lines: new Set() };
    ABX.get(card).abilities.forEach(a => {
      const soulOnly = a.kind === "spell" && card.type === "Spell" && a.steps && a.steps.length && a.steps.every(x => x.op === "boost" && x.np && x.np.ref === "host");   // a Spell sitting in a soul: "A card with this card in its soul gets …"
      if ((a.kind !== "static" && !soulOnly) || (a.unparsed && a.unparsed.length) || !a.steps || !a.steps.length) return;
      if (SPECIAL_LEGACY.test(a.raw || a.cleaned || "")) return;
      // "If this card is in the soul of X, that card gets A. Then, that card gets B": B keeps the soul condition
      // (before, B also applied while this card was on the field, to itself). e.g. 6142 / 6227.
      let soulC = null;
      a.steps.forEach(x => { if (x.cond && x.cond.t === "selfInSoulOf") soulC = x.cond; else if (soulC && x.op === "boost" && !x.cond && x.np && x.np.ref) x.cond = soulC; });
      const boostOk = x => x.op === "boost" && x.np && !x.np.junk && !(x.np.zone && !["field", "center", "left", "right", "soul"].includes(x.np.zone.area)) && (x.mods.kws || []).every(k => STATIC_KW.includes(k)) && (!x.cond || condExecutable(x.cond));
      // Protection parts of a mixed line ("... get [Penetrate], and cannot be destroyed ...") are enforced by isProtected.
      const sideOk = x => x.op === "shield" || (x.op === "restrict" && isAuraRestrict(a, card, x)) || (x.op === "static" && ["protect", "unnullifiable", "unreducible", "noStatReduce"].includes(x.kind)) || (x.op === "noop" && x.note === "unnullifiable-ok");
      if (!a.steps.some(boostOk) || !a.steps.every(x => boostOk(x) || sideOk(x))) return;
      if (!(a.conds || []).every(condExecutable) || a.trigger) return;
      r.abs.push(a);
      r.lines.add(ABX.norm(a.raw || a.cleaned || ""));
    });
    STATIC_CACHE.set(card.id, r);
    return r;
  }
  ABX.resetCaches = function () { PARSE_CACHE.clear(); STATIC_CACHE.clear(); };   // after later files add parser rules
  ABX.ownsStaticLine = function (card, line) { const r = staticBoosts(card); return r.abs.length > 0 && r.lines.has(ABX.norm(line)); };

  let inStatic = 0;
  // Bonus applied to `unit` (owned by `fighter`) from every static boost on both fields.
  ABX.staticBonus = function (fighter, unit) {
    const zero = { power: 0, defense: 0, crit: 0, pen: false, da: false, ta: false, ca: false, sg: false, move: false, qa: false };
    if (inStatic || !unit || !unit.card) return zero;
    const mySide = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
    if (!mySide) return zero;
    inStatic++;
    const out = Object.assign({}, zero);
    try {
      for (const side of [mySide, otherSide(mySide)]) {
        const f = F(side), e = F(otherSide(side));
        const srcs = [];
        fieldUnits(f, true).forEach(x => { srcs.push({ unit: x.unit, card: x.unit.card, host: null }); (x.unit.soul || []).forEach(id => { const c = cardOf(id); if (c) srcs.push({ unit: null, card: c, host: x.unit }); }); });
        (f.setSpells || []).forEach(c => srcs.push({ unit: null, card: c, host: null }));
        for (const src of srcs) {
          const sb = staticBoosts(src.card);
          if (!sb.abs.length) continue;
          if ((src.unit && src.unit.abxNullified === B.turnCount) || (src.host && src.host.abxNullified === B.turnCount)) continue;
          for (const ab of sb.abs) {
            const ctx = { side, f, e, card: src.card, unit: src.unit, soulHost: src.host, bind: { chosen: src.host ? [{ k: "unit", side, unit: src.host, card: src.host.card, id: src.host.card.id }] : [] }, hostArea: src.host ? "soul" : "field" };
            if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
            for (const st of ab.steps) {
              if (st.op !== "boost") continue;
              if (st.cond && !evalCond(st.cond, ctx)) continue;
              let hit = false;
              if (st.np.self) hit = src.unit === unit;
              else if (st.np.ref) hit = (src.host ? src.host === unit : src.unit === unit) && (!st.np.hostFilter || matchFilter(unit.card, st.np.hostFilter, null, ctx));
              else hit = refsFor(st.np, ctx, { owner: "you", area: "field" }).some(r => r.unit === unit);
              if (!hit) continue;
              const mult = !st.each ? 1 : st.each.perReversal ? (typeof getFighterReversalCount === "function" ? getFighterReversalCount(f) : 0) : refsFor(st.each, ctx, { owner: "you", area: "field" }).length;
              const lock = (stat, v) => (v < 0 && ABX.statLocked && ABX.statLocked(mySide, unit, stat, side !== mySide) ? 0 : v);
              out.power += lock("power", (st.mods.power || 0) * mult); out.defense += lock("defense", (st.mods.defense || 0) * mult); out.crit += lock("critical", (st.mods.critical || 0) * mult);
              (st.mods.kws || []).forEach(k => { if (k === "penetrate") out.pen = true; if (k === "double attack") out.da = true; if (k === "triple attack") out.ta = true; if (k === "counterattack") out.ca = true; if (k === "soulguard") out.sg = true; if (k === "move") out.move = true; if (k === "quadruple attack") out.qa = true; if (k === "weaponry link") out.wl = true; });
            }
          }
        }
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    inStatic--;
    return out;
  };

  /* ---- attack-legality statics: "can attack even if there is a monster in the center" ---- */
  ABX.canAttackThrough = function (side, unit, which) {
    if (!unit || !unit.card) return false;
    const f = F(side), e = F(otherSide(side));
    for (const ab of abilitiesOf(unit.card, a => a.kind === "static" && !(a.unparsed && a.unparsed.length))) {
      const ctx = { side, f, e, card: unit.card, unit, bind: {} };
      if (!(ab.conds || []).every(c => condExecutable(c) && evalCond(c, ctx))) continue;
      for (const st of ab.steps || []) {
        if (st.op !== "static" || st.kind !== "attackThrough") continue;
        const raw = lc(st.raw || "");
        const own = /\byour center\b|\byou have\b/.test(raw) && !/opponent/.test(raw);
        if ((which === "own") !== own) continue;
        if (!own) return true;
        const cm = f.monsters.center;
        if (!cm || !st.np || !st.np.filter || matchFilter(cm.card, st.np.filter, { unit: cm, side }, ctx)) return true;
      }
    }
    return false;
  };

  ABX.attackUnnullifiable = function (bc) {
    for (const u of bc.attUnits || []) {
      if (u.abxUnnull && u.abxUnnull.turn === B.turnCount && !(u.abxUnnull.cond === "alone" && bc.attUnits.length > 1)) return true;
      for (const ab of abilitiesOf(u.card, a => a.kind === "static")) {
        for (const st of ab.steps || []) {
          if (st.op !== "static" || st.kind !== "unnullifiable") continue;
          const ctx = { side: bc.attSide, f: F(bc.attSide), e: F(bc.defSide), card: u.card, unit: u, bind: {} };
          if (!(ab.conds || []).every(c => condExecutable(c) && evalCond(c, ctx))) continue;
          if (st.cond === "alone" && bc.attUnits.length > 1) continue;
          if (st.cond && st.cond !== "alone" && typeof st.cond === "object" && !evalCond(st.cond, ctx)) continue;
          return true;
        }
      }
    }
    return false;
  };

  // "The size of all (originally size N) «X» on your field is reduced by N" from OTHER cards on the same field / set spells,
  // plus the same text on a non-[Set] spell cast this turn (kept in f.abxSizeMods).
  function sizeModMatches(m, card, unit, srcUnit, ctx) {
    if (m.origSize != null && !(m.origLe ? (card.size || 0) <= m.origSize : (card.size || 0) === m.origSize)) return false;
    if (!isMonsterCard(card)) return false;
    if (m.np.excludeSelf && srcUnit && unit && srcUnit === unit) return false;
    if (/\bother\b/i.test(m.np.raw || "") && srcUnit && unit === srcUnit) return false;
    return matchFilter(card, m.np.filter || {}, unit ? { unit, side: ctx.side } : null, ctx);
  }
  function othersSizeDelta(side, f, card, unit) {
    let d = 0;
    (f.abxSizeMods || []).forEach(m => { if (m.turn === B.turnCount && sizeModMatches(m, card, unit, null, { side, f, e: F(otherSide(side)), bind: {} })) d += m.delta; });
    const srcs = fieldUnits(f, true).map(x => ({ unit: x.unit, card: x.unit.card }));
    (f.setSpells || []).forEach(c => srcs.push({ unit: null, card: c }));
    for (const src of srcs) {
      if (src.unit && src.unit.abxNullified === B.turnCount) continue;
      for (const ab of abilitiesOf(src.card, a => (a.kind === "static" || (a.kind === "spell" && src.card.set && !src.unit)) && !(a.unparsed && a.unparsed.length))) {
        const ctx = { side, f, e: F(otherSide(side)), card: src.card, unit: src.unit, bind: {} };
        if (!(ab.conds || []).every(c => condExecutable(c) && evalCond(c, ctx))) continue;
        for (const m of ab.steps || []) {
          if (m.op !== "static" || m.kind !== "sizeModOthers" || !m.np || m.np.junk) continue;
          if (m.cond && !(condExecutable(m.cond) && evalCond(m.cond, ctx))) continue;
          if (sizeModMatches(m, card, unit, src.unit, ctx)) d += m.delta || 0;
        }
      }
    }
    return d;
  }

  // Is a card named `name` on either fighter's field (monster zones or item)?
  ABX.nameOnField = function (name) {
    const want = String(name || "").replace(/[“”"]/g, "").trim().toLowerCase();
    if (!want) return false;
    return [B.plr, B.opp].some(f => f && (["left", "center", "right"].some(p => f.monsters && f.monsters[p] && f.monsters[p].card && String(f.monsters[p].card.name).replace(/[“”"]/g, "").trim().toLowerCase() === want)
      || (f.item && f.item.card && String(f.item.card.name).replace(/[“”"]/g, "").trim().toLowerCase() === want)));
  };

  // Size changes from "this card's size is reduced by N" statics (only the ones the old text code does not already do).
  const LEGACY_SIZE = /dragod|reversal|overgod/i;
  let inSize = 0;
  ABX.sizeDelta = function (fighter, card, unit) {
    if (inSize || !card) return 0;
    const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
    if (!side) return 0;
    if (unit && unit.abxSize0 && unit.abxSize0.whileName && !ABX.nameOnField(unit.abxSize0.whileName)) unit.abxSize0 = false;
    if (unit && unit.abxSize0) return -99;   // "That card becomes size 0 until it leaves the field" / "as long as "X" is on the field"
    inSize++;
    let d = 0;
    try {
      d += othersSizeDelta(side, fighter, card, unit);
      for (const ab of abilitiesOf(card, a => a.kind === "static" && !(a.unparsed && a.unparsed.length))) {
        if (LEGACY_SIZE.test(ab.raw || ab.cleaned || "")) continue;
        const sm = (ab.steps || []).find(x => x.op === "static" && x.kind === "sizeMod");
        if (!sm || (ab.steps || []).length !== 1) continue;
        const ctx = { side, f: fighter, e: F(otherSide(side)), card, unit: unit || null, bind: {} };
        if (!(ab.conds || []).every(c => condExecutable(c) && evalCond(c, ctx))) continue;
        d += sm.delta || 0;
      }
    } catch (e) { /* ignore */ }
    inSize--;
    return d;
  };

  /* ---- abilities activated from the HAND while defending ("call this card from your hand, change the target ...") ---- */
  function isSelfCallAct(ab) { return ab.kind === "act" && ABX.isExecutable(ab) && (ab.steps || []).some(x => x.op === "call" && x.np && x.np.self); }
  ABX.handActs = (card) => abilitiesOf(card, a => isSelfCallAct(a) && (/attack/i.test(a.cleaned || a.raw || "") || (a.tags || []).includes("counter")) && /from your hand/i.test(a.cleaned || a.raw || ""));
  ABX.isDefenseHandAct = (card) => ABX.handActs(card).length > 0;
  // a self-call "on top of a «X» on your field" / with an on-top [Call Cost] needs such a monster
  function onTopOK(call, ctx, card) {
    if (call.np && call.np.onTop && call.np.onTop.np) return refsFor(call.np.onTop.np, ctx, { owner: "you", area: "field" }).some(r => r.k === "unit");
    if (call.np && call.np.onTop && call.np.onTop.self) return !!ctx.unit;
    if (call.pay && ABX.onTopCost(card)) return ABX.onTopHosts(ctx.side, card).length > 0;
    return true;
  }

  // ---- [Act]s used from the hand on your own turn ----
  //  "You may discard this card from your hand. If you do, ..."  /  "Put this hand card into the soul of ..."
  //  "[Counter] [Act] During your attack phase, call this card from your hand by paying its [Call Cost]."
  ABX.handUseActs = (card) => abilitiesOf(card, a => a.kind === "act" && !(a.trigger && a.trigger.event === "oppCast") && ABX.isExecutable(a) &&
    !(a.conds || []).some(c => c.t === "underAttack" || (c.t === "turn" && c.who === "opp") || (c.t === "phase" && c.who === "opp")) &&
    (FROM_HAND_RE.test(a.cleaned || "") || (isSelfCallAct(a) && /from your hand/i.test(a.cleaned || ""))));
  // [Counter] hand abilities (e.g. "[Counter] [Act] You may drop this card from hand. If you do, you gain 3 life.")
  // can also be used when the opponent attacks.
  ABX.counterHandUseActs = (card) => abilitiesOf(card, a => a.kind === "act" && !(a.trigger && a.trigger.event === "oppCast") && ABX.isExecutable(a) && (a.tags || []).includes("counter") && !isSelfCallAct(a) && FROM_HAND_RE.test(a.cleaned || ""));
  ABX.canUseHandAct = function (side, handIdx, ab) {
    const f = F(side), card = cardOf(f.hand[handIdx]);
    if (!card) return { ok: false, reason: "That card is no longer in your hand." };
    const ctx = handCtx(side, card, handIdx, ab);
    if (onceUsed(f, card, ab, null)) return { ok: false, reason: "Already used this turn." };
    if (!(ab.conds || []).every(c => evalCond(c, ctx))) return { ok: false, reason: "Its condition isn't met right now." };
    for (const st of ab.steps) {
      if (st.gate) break;
      if (st.cost && !costAffordable(st, ctx)) return { ok: false, reason: "You can't pay its cost." };
      if (st.op === "call" && st.np && st.np.self) {
        if (st.cond && !evalCond(st.cond, ctx)) return { ok: false, reason: "Its condition isn't met right now." };
        if (st.pay) {
          const cc = parseCardCost(card.cost, card.skill, f, card);
          if (f.gauge.length < cc.gauge || f.life <= cc.life) return { ok: false, reason: "Not enough gauge/life for its [Call Cost]." };
          if (ABX.canPayExtras && !ABX.canPayExtras(side, card, handIdx)) return { ok: false, reason: "You can't pay the rest of its [Call Cost]." };
        }
        if (!onTopOK(st, ctx, card)) return { ok: false, reason: "No monster on your field to call it on top of." };
        if (!SLOTS.some(p => !f.monsters[p]) && !(st.pos && st.pos !== "open area") && !(st.np && st.np.onTop) && !(st.pay && ABX.onTopCost(card))) return { ok: false, reason: "No open monster zone." };
      }
      if (!st.cost && !st.optional) break;
    }
    return { ok: true };
  };
  ABX.runHandUse = function (side, handIdx, ab, onAfter) {
    return ABX.queue(async () => {
      const f = F(side), card = cardOf(f.hand[handIdx]);
      if (!card) return false;
      const ctx = handCtx(side, card, handIdx, ab);
      ctx.auto = !!f.isBot || !!ABX.autoPlay;
      markOnce(f, card, ab, null);
      if (B.showCutin && !ABX.fast) { try { B.showCutin("ABILITY!", card.name, card.img); } catch (e) { /* ignore */ } }
      try { await runSteps(ab.steps, ctx); } catch (e) { if (ABX.debug) console.error(e); }
      [].concat(ctx.bind.revealed || [], ctx.bind.looked || []).forEach(r => { if (r && r.id != null && r.pending) { F(r.side).deck.unshift(r.id); r.pending = false; } });
      try { B.renderBattle(); } catch (e) { /* ignore */ }
      if (onAfter) onAfter();
      return true;
    });
  };
  function makeBc(defSide, info) {
    const attSide = info.attSide, attF = F(attSide), defF = F(defSide);
    return {
      active: true, attSide, defSide, nullified: false, redirectTo: null, link: (info.attackerZones || []).length > 1,
      attUnits: (info.attackerZones || []).map(z => z === "item" ? attF.item : attF.monsters[z]).filter(Boolean),
      defUnit: ["left", "center", "right"].includes(info.targetPos) ? defF.monsters[info.targetPos] : null
    };
  }
  function handCtx(side, card, handIdx, ab) {
    return { side, f: F(side), e: F(otherSide(side)), card, unit: null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "hand",
      selfRef: { k: "zone", side, area: "hand", idx: handIdx, id: card.id, card }, event: { name: "handAct" } };
  }
  ABX.defenseHandOption = function (side, card, handIdx, targetPos, attUnits) {
    const acts = ABX.handActs(card);
    if (!acts.length) return false;
    const prev = ABX.battleCtx;
    ABX.battleCtx = { active: true, attSide: otherSide(side), defSide: side, attUnits: attUnits || [], defUnit: null };
    try {
      return acts.some(ab => {
        const ctx = handCtx(side, card, handIdx, ab);
        if (onceUsed(ctx.f, card, ab, null)) return false;
        if (!(ab.conds || []).every(c => evalCond(c, ctx))) return false;
        for (const st of ab.steps) { if (st.gate || st.optional) break; if (st.cost && !costAffordable(st, ctx)) return false; if (!st.cost) break; }
        const first = ab.steps[0];
        if (first && first.op === "pay" && !costAffordable(first, ctx)) return false;
        const call = ab.steps.find(x => x.op === "call");
        if (call && call.pay) { const cc = parseCardCost(card.cost, card.skill, ctx.f, card); if (ctx.f.gauge.length < cc.gauge || ctx.f.life <= cc.life) return false; }
        if (call && call.pay && ABX.canPayExtras && !ABX.canPayExtras(side, card, handIdx)) return false;   // e.g. [Drop two hand cards]
        // only offer it when the call's own condition holds right now ("if you have four or more spells in your drop zone")
        if (call && call.cond && !evalCond(call.cond, ctx)) return false;
        if (call && !onTopOK(call, ctx, card)) return false;
        return true;
      });
    } finally { ABX.battleCtx = prev; }
  };
  ABX.runHandAct = async function (side, handIdx, info) {
    const f = F(side), card = cardOf(f.hand[handIdx]);
    const bc = ABX.battleCtx = makeBc(side, info);
    let target = info.targetPos;
    try {
      for (const ab of ABX.handActs(card)) {
        const ctx = handCtx(side, card, handIdx, ab);
        if (onceUsed(f, card, ab, null) || !(ab.conds || []).every(c => evalCond(c, ctx))) continue;
        markOnce(f, card, ab, null);
        ctx.bc = bc;
        await runSteps(ab.steps, ctx);
        break;
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    ABX.battleCtx = null;
    if (bc.redirectTo) target = bc.redirectTo;
    return { nullified: bc.nullified, targetPos: target };
  };

  // Observe phase changes without touching every `this.phase = ...` site.
  (function watchPhase() {
    let cur = B.phase;
    try {
      Object.defineProperty(B, "phase", {
        configurable: true, enumerable: true,
        get() { return cur; },
        set(v) {
          const old = cur; cur = v;
          if (v !== old && ABX.enabled !== false && !ABX.noPhaseEvents) {
            if (v === "start") { ABX.fireTurnEvent("turnStart"); ABX.fireTurnEvent("phaseStart", "start"); }
            else ABX.fireTurnEvent("phaseStart", v);
          }
        }
      });
    } catch (e) { /* ignore */ }
  })();

  ABX.runAbility = runAbility;
  ABX.evalCond = evalCond;
  root.ABX = ABX;
})(typeof window !== "undefined" ? window : globalThis);
