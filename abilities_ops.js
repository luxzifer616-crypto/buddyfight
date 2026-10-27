/* ==================== ABX OPS ====================
 * The actual effects. Each op: { run(step, ctx) -> Promise<boolean|undefined>, check?(step) -> bool, canDo?(step, ctx) }
 * run() returns false when nothing happened ("if you do" gates read that).
 * Only ops listed here are "executable" - parsed text for anything else keeps going through the old game.js code.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, refsFor, pick, detach, place, st, evalCond, isProtected, SLOTS, cardOf } = core;

  const sideOf = (ctx, who) => (who === "opp" ? otherSide(ctx.side) : ctx.side);
  const fresh = () => B.renderBattle && B.renderBattle();

  // numeric value of an amount spec
  function amount(n, ctx) {
    if (typeof n === "number") return n;
    if (!n) return 0;
    if (n.each) return (n.per || 1) * refsFor(n.each, ctx, { owner: "you", area: "field" }).length;
    if (n.fromRef) {
      const r = (ctx.bind.chosen || [])[0] || (ctx.bind.revealed || [])[0];
      return r && r.card ? (r.card.size || 0) : 0;
    }
    if (n.fromSelf) return ctx.card ? (ctx.card[n.fromSelf === "critical" ? "crit" : n.fromSelf] || 0) : 0;
    return 0;
  }
  core.amount = amount;

  function afterChange() { try { B.checkWinCondition(); } catch (e) { /* ignore */ } fresh(); }

  /* ---------- draw / life / damage ---------- */
  OPS.draw = {
    run(s, ctx) {
      const side = sideOf(ctx, s.who), f = F(side);
      const n = amount(s.n, ctx);
      let got = 0;
      for (let i = 0; i < n && f.deck.length; i++) { f.hand.push(f.deck.shift()); got++; }
      afterChange();
      return got > 0;
    },
    check: (s) => typeof s.n === "number" || (s.n && (s.n.each || s.n.fromRef)),
    canDo: (s, ctx) => F(sideOf(ctx, s.who)).deck.length > 0
  };
  OPS.drawUntil = {
    run(s, ctx) { const f = ctx.f; let got = 0; while (f.hand.length < s.n && f.deck.length) { f.hand.push(f.deck.shift()); got++; } afterChange(); return got > 0; }
  };
  OPS.life = {
    run(s, ctx) { const f = F(sideOf(ctx, s.who)); f.life += amount(s.n, ctx); afterChange(); return true; },
    check: (s) => typeof s.n === "number" || (s.n && (s.n.each || s.n.fromRef))
  };
  OPS.setLife = { run(s, ctx) { F(sideOf(ctx, s.who)).life = s.n; afterChange(); return true; } };
  OPS.damage = {
    run(s, ctx) {
      const side = sideOf(ctx, s.who);
      const n = amount(s.n, ctx);
      const dealt = core.applyDamage(side, n, { kind: "effect" });
      afterChange();
      return dealt > 0 || n === 0;
    },
    check: (s) => typeof s.n === "number" || (s.n && (s.n.each || s.n.fromRef || s.n.fromSelf))
  };
  OPS.shield = {
    run(s, ctx) {
      const S = st(ctx.f);
      S.shields.push({ mode: s.mode, reduceBy: s.reduceBy || 0, toZero: !!s.toZero, gainLife: s.gainLife || 0, from: s.from || null, turn: B.turnCount });
      return true;
    },
    check: (s) => s.mode === "next" || s.mode === "turn"
  };

  /* ---------- costs ---------- */
  OPS.pay = {
    run(s, ctx) {
      const f = ctx.f;
      if (s.gauge && f.gauge.length < s.gauge) return false;
      if (s.life && f.life <= s.life && !s.optional) { /* paying all life is legal but risky; allow */ }
      if (s.restSelf && ctx.unit && ctx.unit.rested) return false;
      for (let i = 0; i < (s.gauge || 0); i++) f.drop.push(f.gauge.pop());
      if (s.life) f.life -= s.life;
      if (s.restSelf && ctx.unit) ctx.unit.rested = true;
      afterChange();
      return true;
    }
  };
  OPS.restSelf = {
    run(s, ctx) { if (!ctx.unit || ctx.unit.rested) return false; ctx.unit.rested = true; fresh(); return true; }
  };
  OPS.discard = {
    async run(s, ctx) {
      const f = ctx.f;
      let cands = f.hand.map((id, i) => ({ k: "zone", side: ctx.side, area: "hand", idx: i, id, card: cardOf(id) }));
      if (s.np && s.np.filter) cands = cands.filter(r => core.matchFilter(r.card, s.np.filter, r, ctx));
      if (s.all) { const ids = f.hand.splice(0); f.drop.push(...ids); fresh(); return ids.length > 0; }
      const n = s.n || 1;
      if (cands.length < n) return false;
      const chosen = await pick(cands, { qty: { n }, raw: "a card from your hand" }, ctx, { intent: "cost", title: `${ctx.card.name} — discard`, min: n, max: n });
      if (chosen.length < n) return false;
      chosen.forEach(r => { const id = detach(r); if (id != null) f.drop.push(id); });
      fresh();
      return true;
    },
    check: (s) => !s.np || !s.np.junk
  };
  OPS.oppDiscard = {
    async run(s, ctx) {
      const e = ctx.e; if (!e.hand.length) return false;
      const cands = e.hand.map((id, i) => ({ k: "zone", side: otherSide(ctx.side), area: "hand", idx: i, id, card: cardOf(id) }));
      const ch = await pick(cands, { qty: { n: 1 } }, ctx, { chooserSide: otherSide(ctx.side), intent: "cost", title: "Choose a card to drop" });
      ch.forEach(r => { const id = detach(r); if (id != null) e.drop.push(id); });
      fresh(); return ch.length > 0;
    }
  };

  /* ---------- choose / look / reveal ---------- */
  OPS.choose = {
    async run(s, ctx) {
      const cands = refsFor(s.np, ctx);
      const chosen = await pick(cands, s.np, ctx, { title: `${ctx.card.name} — choose`, subtitle: ABX.clean(s.np.raw), intent: "help" });
      ctx.bind.chosen = chosen;
      return chosen.length > 0;
    }
  };
  OPS.look = {
    async run(s, ctx) {
      const side = sideOf(ctx, s.who), f = F(side);
      const ids = f.deck.splice(0, s.n);
      ctx.bind.looked = ids.map((id, i) => ({ k: "zone", side, area: "deck", id, card: cardOf(id), pending: true, idx: i }));
      return ids.length > 0;
    },
    check: (s) => false      // look needs a follow-up pick op ("from among them"); not owned yet
  };
  OPS.reveal = {
    run(s, ctx) {
      const f = ctx.f;
      const ids = f.deck.splice(0, s.n || 1);
      ctx.bind.revealed = ids.map(id => ({ k: "zone", side: ctx.side, area: "deck", id, card: cardOf(id), pending: true }));
      if (ids.length && !f.isBot && B.setPrompt) B.setPrompt(`Revealed: ${ids.map(i => cardOf(i).name).join(", ")}`);
      return ids.length > 0;
    }
  };

  /* ---------- moving ---------- */
  function destOwnerSide(dest, ref, ctx) { return dest.owner === "owner" ? ref.side : dest.owner === "opp" ? otherSide(ctx.side) : ctx.side; }

  async function moveRefs(refs, dest, ctx, order) {
    if (!refs.length) return false;
    refs = refs.slice();
    if (order === "any" && refs.length > 1 && !(F(ctx.side).isBot || ABX.autoPlay)) {
      const idxs = await ABX.ui.pickCards({
        title: `${ctx.card.name} — choose the order`, subtitle: "Pick the cards in the order you want them placed (first = placed first).",
        cards: refs.map(r => ({ card: r.card, badge: "" })), min: refs.length, max: refs.length, ordered: true
      });
      if (idxs && idxs.length === refs.length) refs = idxs.map(i => refs[i]);
    }
    // soul destinations need a host unit (resolved before anything leaves its zone)
    if (dest.area === "soul") {
      let host = null;
      if (dest.host === "self") host = ctx.unit;
      else if (dest.hostNP) {
        const movingUnits = new Set(refs.map(r => r.unit).filter(Boolean));
        const hs = refsFor(dest.hostNP, ctx, { owner: "you", area: "field" }).filter(r => r.unit && !movingUnits.has(r.unit));
        const ch = await pick(hs, dest.hostNP, ctx, { intent: "help", title: `${ctx.card.name} — choose the card to put it into the soul of` });
        host = ch[0] && ch[0].unit;
      }
      if (!host || refs.some(r => r.unit === host)) return false;
      dest = Object.assign({}, dest, { hostUnit: host });
    }
    let moved = 0;
    for (const r of refs) {
      // protection (only matters for units on a field)
      if ((r.k === "unit" || r.k === "item") && r.side !== ctx.side) {
        const kind = dest.area === "hand" ? "returned to hand" : "put into the drop zone";
        if (isProtected(r.unit, r.side, kind, ctx)) continue;
      }
      const id = detach(r);
      if (id == null) continue;
      const ownerSide = destOwnerSide(dest, r, ctx);
      place(id, Object.assign({}, dest, { owner: ownerSide === ctx.side ? "you" : "opp" }), ctx, r.side);
      moved++;
    }
    afterChange();
    return moved > 0;
  }
  core.moveRefs = moveRefs;

  OPS.move = {
    async run(s, ctx) {
      let refs;
      if (s.np.ref) refs = (ctx.bind[s.np.ref === "chosen" ? "chosen" : s.np.ref] || []).slice();
      else {
        const cands = refsFor(s.np, ctx);
        refs = await pick(cands, s.np, ctx, { intent: s.np.zone && s.np.zone.owner === "opp" ? "harm" : "help", title: `${ctx.card.name} — choose`, subtitle: ABX.clean(s.np.raw), ordered: s.order === "any" });
      }
      const ok = await moveRefs(refs, s.to, ctx, s.order);
      // anything revealed/looked that was moved no longer returns to the deck
      refs.forEach(r => { r.pending = false; });
      return ok;
    },
    check: (s) => !!s.np && !!s.to && ["hand", "gauge", "drop zone", "deck", "soul"].includes(s.to.area) && (s.to.area !== "soul" || s.to.host === "self" || !!s.to.hostNP)
  };
  OPS.moveSelf = {
    async run(s, ctx) {
      const f = ctx.f;
      if (ctx.unit) {
        const ref = { k: ctx.unit === f.item ? "item" : "unit", side: ctx.side, unit: ctx.unit, card: ctx.card, id: ctx.card.id };
        return moveRefs([ref], s.to, ctx);
      }
      return false;
    }
  };
  OPS.moveZone = {
    run(s, ctx) {
      const from = F(s.from.owner === "opp" ? otherSide(ctx.side) : ctx.side), arr = from[s.from.area === "drop zone" ? "drop" : s.from.area];
      const to = F(s.to.owner === "opp" ? otherSide(ctx.side) : ctx.side), toArr = to[s.to.area === "drop zone" ? "drop" : s.to.area];
      let n = 0;
      for (let i = 0; i < (s.n || 1) && arr.length; i++) { toArr.push(arr.pop()); n++; }
      afterChange(); return n > 0;
    }
  };
  OPS.mill = {
    run(s, ctx) {
      const side = sideOf(ctx, s.who), f = F(side);
      const n = amount(s.n, ctx);
      const ids = f.deck.splice(0, n);
      const to = s.to;
      ids.forEach(id => {
        if (to === "gauge") f.gauge.push(id);
        else if (to === "hand") f.hand.push(id);
        else if (to === "soul") { if (ctx.unit) ctx.unit.soul.push(id); else f.drop.push(id); }
        else f.drop.push(id);
      });
      afterChange(); return ids.length > 0;
    },
    check: (s) => (typeof s.n === "number" || (s.n && s.n.each)) && !s.hostNP
  };
  OPS.deckToBottom = { run(s, ctx) { const f = ctx.f; const ids = f.deck.splice(0, s.n || 1); f.deck.push(...ids); fresh(); return ids.length > 0; } };
  OPS.shuffle = { run(s, ctx) { const f = F(sideOf(ctx, s.who)); for (let i = f.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [f.deck[i], f.deck[j]] = [f.deck[j], f.deck[i]]; } return true; } };

  OPS.search = {
    async run(s, ctx) {
      const f = ctx.f;
      const cands = f.deck.map((id, i) => ({ k: "zone", side: ctx.side, area: "deck", idx: i, id, card: cardOf(id) })).filter(r => core.matchFilter(r.card, s.np.filter || {}, r, ctx));
      let chosen = [];
      if (cands.length) {
        // searching is optional - you may find nothing; humans see only the matching cards
        const np = Object.assign({}, s.np, { qty: Object.assign({}, s.np.qty, { upTo: true }) });
        chosen = await pick(cands, np, ctx, { title: `${ctx.card.name} — search your deck`, subtitle: ABX.clean(s.np.raw), intent: "help", min: 0 });
      }
      const ok = chosen.length ? await moveRefs(chosen, s.to.area === "soul" ? { area: "soul", owner: "you" } : s.to, ctx) : false;
      OPS.shuffle.run({ who: "you" }, ctx);
      return ok;
    },
    check: (s) => !!s.np && s.to && s.to.area !== "soul"
  };

  /* ---------- destroy / rest / stand ---------- */
  OPS.destroy = {
    async run(s, ctx) {
      const cands = s.np.self ? refsFor(s.np, ctx) : (s.np.ref ? (ctx.bind.chosen || []).slice() : refsFor(s.np, ctx, { owner: "any", area: "field" }));
      const targets = s.np.ref ? cands : (s.np.qty.all ? cands : await pick(cands, s.np, ctx, { intent: "harm", title: `${ctx.card.name} — destroy`, subtitle: ABX.clean(s.np.raw) }));
      let did = 0;
      for (const r of targets) {
        if (r.k !== "unit" && r.k !== "item") continue;
        if (r.side !== ctx.side && isProtected(r.unit, r.side, "destroyed", ctx)) continue;
        if (isProtected(r.unit, r.side, "destroyed", { side: ctx.side }) && r.side !== ctx.side) continue;
        const pos = core.posOfUnit(F(r.side), r.unit);
        if (!pos) continue;
        if (pos === "item") { const f = F(r.side); const it = f.item; f.item = null; f.drop.push(it.card.id, ...(it.soul || [])); did++; continue; }
        if (B.destroyMonster(r.side, pos) !== false) did++;
      }
      fresh();
      return did > 0;
    },
    check: (s) => s.np && !s.np.junk && !(s.np.zone && ["hand", "deck", "gauge", "drop zone"].includes(s.np.zone.area))
  };
  function setRest(val) {
    return {
      async run(s, ctx) {
        const cands = refsFor(s.np, ctx, { owner: "any", area: "field" }).filter(r => r.unit && !!r.unit.rested !== val);
        const ch = s.np.ref ? (ctx.bind.chosen || []).filter(r => r.unit) : s.np.qty.all ? cands : await pick(cands, s.np, ctx, { intent: val ? "harm" : "help", title: `${ctx.card.name} — ${val ? "[Rest]" : "[Stand]"}` });
        let n = 0;
        ch.forEach(r => { if (r.side !== ctx.side && isProtected(r.unit, r.side, "rest", ctx)) return; r.unit.rested = val; n++; });
        fresh(); return n > 0;
      },
      check: (s) => !!s.np && !(s.np.zone && !["field", "center", "left", "right"].includes(s.np.zone.area))
    };
  }
  OPS.rest = setRest(true);
  OPS.stand = setRest(false);

  /* ---------- boosts ---------- */
  OPS.boost = {
    async run(s, ctx) {
      const refs = s.np.ref ? (ctx.bind.chosen || []).filter(r => r.unit) : s.np.self ? refsFor(s.np, ctx) : refsFor(s.np, ctx, { owner: "you", area: "field" }).filter(r => r.unit);
      const ch = s.np.ref || s.np.self || s.np.qty.all ? refs : await pick(refs, s.np, ctx, { intent: "help", title: `${ctx.card.name} — choose` });
      const mult = s.each ? refsFor(s.each, ctx, { owner: "you", area: "field" }).length : 1;
      ch.forEach(r => {
        r.unit.tempPower = (r.unit.tempPower || 0) + (s.mods.power || 0) * mult;
        r.unit.tempDef = (r.unit.tempDef || 0) + (s.mods.defense || 0) * mult;
        r.unit.tempCrit = (r.unit.tempCrit || 0) + (s.mods.critical || 0) * mult;
        (s.mods.kws || []).forEach(k => { if (k === "penetrate") r.unit.tempPen = true; if (k === "counterattack") r.unit.tempCA = true; });
      });
      fresh(); return ch.length > 0;
    },
    check: (s) => s.mods && (s.mods.kws || []).every(k => k === "penetrate" || k === "counterattack") && !(s.np && s.np.zone && !["field", "center", "left", "right"].includes(s.np.zone.area))
  };

  /* ---------- call ---------- */
  OPS.call = {
    async run(s, ctx) {
      const f = ctx.f;
      const area = (s.np.zone && s.np.zone.area) || "hand";
      const arrName = area === "drop zone" ? "drop" : area === "hand" ? "hand" : null;
      if (!arrName) return false;
      const cands = refsFor(Object.assign({}, s.np, { zone: Object.assign({}, s.np.zone || {}, { owner: "you", area }) }), ctx).filter(r => r.card.type === "Monster");
      const ch = await pick(cands, s.np, ctx, { intent: "help", title: `${ctx.card.name} — call`, subtitle: ABX.clean(s.np.raw) });
      let n = 0;
      for (const r of ch) {
        const pos = (s.pos && !f.monsters[s.pos]) ? s.pos : SLOTS.find(p => !f.monsters[p]);
        if (!pos) break;
        if (B.getCurrentSizeUsed(f) + (r.card.size || 0) > (f.maxSize || 3)) continue;
        if (arrName === "drop") { const i = f.drop.indexOf(r.id); if (i < 0) continue; f.drop.splice(i, 1); f.hand.push(r.id); }
        const hi = f.hand.lastIndexOf(r.id);
        if (hi < 0) continue;
        B.completeMonsterCall(ctx.side, pos, hi, false, true);
        n++;
      }
      return n > 0;
    },
    check: (s) => s.free && s.np && s.np.zone && ["hand", "drop zone"].includes(s.np.zone.area) && !s.np.soulOf
  };

  /* ---------- statics / markers handled elsewhere ---------- */
  OPS.static = { run() { return true; }, check: (s) => s.kind === "protect" };
  OPS.noop = { run() { return true; }, check: (s) => !s.note };
  OPS.modalMarker = { run() { return true; } };
})(typeof window !== "undefined" ? window : globalThis);
