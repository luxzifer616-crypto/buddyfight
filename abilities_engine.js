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
  const COND_OK = new Set(["turn", "phase", "underAttack", "selfPos", "selfOnField", "selfIn", "selfInSoulOf", "selfRested", "selfSoul", "selfSoulName", "selfSet",
    "life", "lifeVs", "gauge", "hand", "flagIs", "flagWorld", "reversal", "hasNot", "has", "count", "itemEquipped", "monsterCount", "onlyThis", "buddyOnField",
    "noBattle", "inBattle", "oppAttackCount", "myAttackCount", "attackedThisTurn", "castThisTurn", "event", "and", "or", "always"]);
  ABX.COND_OK = COND_OK;

  function condExecutable(c) {
    if (!c) return true;
    if (!COND_OK.has(c.t)) return false;
    if (c.list) return c.list.every(condExecutable);
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

  ABX.isExecutable = function (ab) {
    if (!ab) return false;
    if (ab.unparsed && ab.unparsed.length) return false;
    if (ab.kind === "modal") return !!(ab.options && ab.options.length && ab.options.every(o => ABX.isExecutable(o)));
    if (!ab.steps || !ab.steps.length) return false;
    if (ab.trigger && ab.trigger.event === "unknown") return false;
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
    if (f.attrWords && f.attrWords.length) { const a = (card.attrs || []).map(norm); if (!f.attrWords.some(w => a.some(x => x.includes(norm(w))))) return false; }
    if (f.tribes && f.tribes.length) { if (!f.tribes.some(tb => tribeEq(card, tb))) return false; }
    if (f.worlds && f.worlds.length) { if (!f.worlds.some(w => (card.worlds || []).includes(w) || card.world === w)) return false; }
    if (f.tokens && f.tokens.length) { const nm = norm(card.name); if (!f.tokens.some(tk => tribeEq(card, tk) || nm.includes(norm(tk)))) return false; }
    if (f.cardNames && f.cardNames.length) { const nm = lc(card.name); if (!f.cardNames.some(x => nm.includes(x))) return false; }
    if (f.size && !cmpOK(statOf(card, unit, fighter, "size", f.original), f.size)) return false;
    if (f.power && !cmpOK(statOf(card, unit, fighter, "power", f.original), f.power)) return false;
    if (f.defense && !cmpOK(statOf(card, unit, fighter, "defense", f.original), f.defense)) return false;
    if (f.critical && !cmpOK(statOf(card, unit, fighter, "critical", f.original), f.critical)) return false;
    if (f.kws && f.kws.length) { if (!f.kws.every(k => kwOf(card, k))) return false; }
    if (f.soulCount && unit) { const n = (unit.soul || []).length; if (!cmpOK(n, f.soulCount)) return false; }
    if (f.soulName && unit) { if (!(unit.soul || []).some(id => lc((cardOf(id) || {}).name).includes(f.soulName))) return false; }
    if (f.rested && unit && !unit.rested) return false;
    if (f.faceDown || f.faceUp) return false;
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
        if (wantMon) SLOTS.forEach(p => { if ((!z.pos || z.pos === p) && f.monsters[p]) { const u = f.monsters[p]; push({ k: "unit", side, pos: p, unit: u, card: u.card, id: u.card.id }); } });
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
      case "phase": return B.phase === c.phase;
      case "underAttack": { const bc = ABX.battleCtx; return !!(bc && bc.active && bc.defSide === ctx.side) || (!!B.pendingDefenseContext && B.pendingDefenseContext.defSide === ctx.side); }
      case "selfPos": return !!ctx.unit && posOfUnit(f, ctx.unit) === c.pos;
      case "selfOnField": return !!ctx.unit && posOfUnit(f, ctx.unit) !== null || (ctx.card && (f.setSpells || []).includes(ctx.card));
      case "selfIn": return ctx.hostArea === (c.area === "drop zone" ? "drop" : c.area);
      case "selfInSoulOf": { if (!ctx.soulHost) return false; const refs = refsFor(c.np, ctx, { owner: "you", area: "field" }); return refs.some(r => r.unit === ctx.soulHost); }
      case "selfRested": return !!ctx.unit && (!!ctx.unit.rested === c.v);
      case "selfSoul": return !!ctx.unit && cmpN((ctx.unit.soul || []).length, c);
      case "selfSoulName": return !!ctx.unit && (ctx.unit.soul || []).some(id => lc((cardOf(id) || {}).name).includes(c.name));
      case "selfSet": return (f.setSpells || []).includes(ctx.card);
      case "life": return cmpN((c.who === "you" ? f : e).life, c);
      case "lifeVs": return c.cmp === "le" ? f.life <= e.life : f.life > e.life;
      case "gauge": return cmpN((c.who === "you" ? f : e).gauge.length, c);
      case "hand": return cmpN((c.who === "you" ? f : e).hand.length, c);
      case "flagIs": { const fc = flagCard(f); const n = lc(fc ? fc.name : ""); return c.names.some(x => n === x || n.includes(x)); }
      case "flagWorld": return f.world === c.world || (flagCard(f) && (flagCard(f).worlds || []).includes(c.world));
      case "reversal": return getFighterReversalCount(f) >= c.n;
      case "has": { const n = countNP(c.np, c.owner === "any" ? null : c.owner, ctx); return n >= (c.n || 1); }
      case "hasNot": return countNP(c.np, c.owner === "any" ? null : c.owner, ctx) === 0;
      case "count": return cmpN(countNP(c.np, c.owner === "any" ? null : c.owner, ctx), c);
      case "itemEquipped": { const it = f.item && !f.item.isEndrulerFlag ? f.item : null; if (!it) return false; if (!c.np || c.any) return true; return matchFilter(it.card, c.np.filter || {}, { unit: it, side: ctx.side }, ctx); }
      case "monsterCount": return cmpN(fieldUnits(F(c.who === "you" ? ctx.side : otherSide(ctx.side)), false).length, c);
      case "onlyThis": return fieldUnits(f, false).length === 1 && fieldUnits(f, false)[0].unit === ctx.unit;
      case "buddyOnField": return !!f.buddyCalled && fieldUnits(f, false).some(x => x.unit.isBuddyGift || x.unit.card.id === f.buddyId);
      case "noBattle": return !(ABX.battleCtx && ABX.battleCtx.active);
      case "inBattle": return !!(ABX.battleCtx && ABX.battleCtx.active);
      case "oppAttackCount": return st(e).attacks >= c.n;
      case "myAttackCount": return st(f).attacks >= c.n;
      case "attackedThisTurn": return st(f).attacks >= 1;
      case "castThisTurn": return (st(f).castThisTurn || 0) >= 1;
      case "event": { if (!ctx.event || !ctx.event.name) return true; return ctx.event.name === c.trigger.event; }
      default: return false;
    }
  }
  core.evalCond = evalCond;

  /* ============================================================
   * 5. TARGET SELECTION
   * ============================================================ */
  function sideIsAuto(side) { return F(side).isBot || ABX.autoPlay === true; }

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
  function isProtected(unit, side, kind, ctx) {
    if (!unit) return false;
    if (kind === "destroyed" && unit.tempIndestructible) return true;
    const f = F(side);
    const byOppSide = ctx && ctx.side && ctx.side !== side;
    const sources = fieldUnits(f, true).map(x => ({ unit: x.unit, card: x.unit.card })).concat((f.setSpells || []).map(c => ({ unit: null, card: c })));
    for (const src of sources) {
      const parsed = ABX.get(src.card);
      if (!parsed) continue;
      for (const ab of parsed.abilities) {
        if (ab.kind !== "static" && ab.kind !== "spell") continue;
        for (const s of ab.steps || []) {
          if (s.op !== "static" || s.kind !== "protect") continue;
          if (!s.kinds.includes(kind)) continue;
          if (s.byOpp && !byOppSide) continue;
          const sctx = { side, f, e: F(otherSide(side)), unit: src.unit, card: src.card, bind: {} };
          if (!(ab.conds || []).every(c => evalCond(c, sctx))) continue;
          if (s.cond && !evalCond(s.cond, sctx)) continue;
          if (s.self) { if (src.unit === unit) return true; continue; }
          if (s.np) {
            const refs = refsFor(s.np, sctx, { owner: "you", area: "field" });
            if (refs.some(r => r.unit === unit)) return true;
          }
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
    // shields (oldest first)
    for (let i = 0; i < S.shields.length && dmg > 0; i++) {
      const sh = S.shields[i];
      if (sh.from === "attack" && src.kind !== "attack") continue;
      if (sh.from === "effect" && src.kind !== "effect") continue;
      if (sh.from === "impact" && src.kind !== "impact") continue;
      if (src.unreducible) continue;
      const before = dmg;
      dmg = sh.toZero ? 0 : Math.max(0, dmg - (sh.reduceBy || 0));
      if (sh.gainLife && before > dmg) f.life += sh.gainLife;
      if (sh.mode === "next") { S.shields.splice(i, 1); i--; }
    }
    f.life -= dmg;
    return dmg;
  }
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

  async function runAbility(side, card, ab, unit, opts) {
    opts = opts || {};
    const f = F(side), e = F(otherSide(side));
    const ctx = { side, f, e, card, unit: unit || null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, event: opts.event || null, auto: !!opts.auto, log: [], hostArea: opts.hostArea || (unit ? "field" : null), soulHost: opts.soulHost || null, selfRef: opts.selfRef || null };
    if (ab.kind === "modal") {
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
    return S.onceTurn[k] === B.turnCount;
  }
  function markOnce(f, card, ab, unit) {
    if (!ab.once) return;
    const S = st(f), k = onceKey(card, ab, unit);
    if (ab.once === "game") S.onceGame[k] = true; else S.onceTurn[k] = B.turnCount;
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
  ABX.actAbilities = function (card) { return abilitiesOf(card, a => a.kind === "act" && ABX.isExecutable(a)); };
  ABX.canUseAct = function (side, card, ab, unit) {
    const f = F(side), e = F(otherSide(side));
    const ctx = { side, f, e, card, unit, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "field" };
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
  const done = (cb) => { try { cb && cb(); } catch (e) { if (ABX.debug) console.error(e); } };

  // "When this card enters the field" (and other self-enter triggers). Returns a Promise.
  ABX.fireEnter = async function (side, card, unit, onAfter) {
    busy++;
    try {
      for (const ab of abilitiesOf(card, a => a.trigger && a.trigger.event === "enter" && a.trigger.self && ABX.isExecutable(a))) {
        const f = F(side);
        if (onceUsed(f, card, ab, unit)) continue;
        const probe = { side, f, e: F(otherSide(side)), card, unit, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "field" };
        if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
        markOnce(f, card, ab, unit);
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
    await runAbility(side, card, ab, unit, { event: { name: "act" } });
    done(onAfter);
    return true;
  };

  ABX.runAbility = runAbility;
  ABX.evalCond = evalCond;
  root.ABX = ABX;
})(typeof window !== "undefined" ? window : globalThis);
