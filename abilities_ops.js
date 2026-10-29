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
    if (n.lastCount) return (n.per || 1) * (ctx.lastCount || 0) + (n.plus || 0);   // "equal to the number of cards destroyed / put"
    if (n.each) {
      let k;
      if (n.each.perReversal) k = getFighterReversalCount(ctx.f);
      else { const refs = refsFor(n.each, ctx, { owner: "you", area: "field" }); k = n.each.filter && n.each.filter.distinct ? new Set(refs.map(r => r.card && r.card.name)).size : refs.length; }
      return (n.per || 1) * k + (n.plus || 0);
    }
    if (n.fromRef) {
      const r = (ctx.bind.chosen || [])[0] || (ctx.bind.revealed || [])[0];
      return r && r.card ? (r.card.size || 0) : 0;
    }
    if (n.fromSelf) return ctx.card ? (ctx.card[n.fromSelf === "critical" ? "crit" : n.fromSelf] || 0) : 0;
    if (n.fromItem) { const it = ctx.f.item; return it && it.card ? (it.card[n.fromItem === "critical" ? "crit" : n.fromItem] || 0) + (n.fromItem === "critical" ? (it.tempCrit || 0) : 0) : 0; }
    if (n.refStat) {   // "equal to that card's critical / power / size"
      const r = [].concat(ctx.bind.lastMoved || [], ctx.bind.chosen || [], ctx.bind.revealed || []).filter(x => x && x.card).shift() || (ctx.event && ctx.event.card ? { card: ctx.event.card } : null);
      return r && r.card ? (r.card[n.refStat === "critical" ? "crit" : n.refStat] || 0) : 0;
    }
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
    check: (s) => typeof s.n === "number" || (s.n && (s.n.each || s.n.fromRef || s.n.lastCount || s.n.refStat || s.n.fromItem)),
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
      if (dealt > 0 && ABX.fireDamaged) ABX.fireDamaged(side);
      afterChange();
      return dealt > 0 || n === 0;
    },
    check: (s) => typeof s.n === "number" || (s.n && (s.n.each || s.n.fromRef || s.n.fromSelf || s.n.lastCount || s.n.refStat || s.n.fromItem))
  };
  OPS.shield = {
    run(s, ctx) {
      const S = st(ctx.f);
      S.shields.push({ mode: s.mode, reduceBy: s.reduceBy || 0, toZero: !!s.toZero, capTo: s.capTo != null ? s.capTo : null, gainLife: s.gainLife || 0, from: s.from || null, turn: B.turnCount });
      return true;
    },
    check: (s) => s.mode === "next" || s.mode === "turn" || s.mode === "nextTurn"
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
      if (s.self) {   // "discard this card from your hand": only works while the card is in the hand
        const sr = ctx.selfRef;
        if (!sr || sr.area !== "hand") return false;
        const i = f.hand[sr.idx] === sr.id ? sr.idx : f.hand.indexOf(sr.id);
        if (i < 0) return false;
        f.hand.splice(i, 1); f.drop.push(sr.id); sr.area = "drop"; sr.idx = f.drop.length - 1;
        ABX.fireDiscarded && ABX.fireDiscarded(ctx.side, cardOf(sr.id));
        fresh(); return true;
      }
      let cands = f.hand.map((id, i) => ({ k: "zone", side: ctx.side, area: "hand", idx: i, id, card: cardOf(id) }));
      if (s.np && s.np.filter) cands = cands.filter(r => core.matchFilter(r.card, s.np.filter, r, ctx));
      if (s.all) { const ids = f.hand.splice(0); f.drop.push(...ids); fresh(); return ids.length > 0; }
      const n = s.n || 1;
      if (cands.length < n) return false;
      const chosen = await pick(cands, { qty: { n }, raw: "a card from your hand" }, ctx, { intent: "cost", title: `${ctx.card.name} — discard`, min: n, max: n });
      if (chosen.length < n) return false;
      chosen.forEach(r => { const id = detach(r); if (id != null) { f.drop.push(id); ABX.fireDiscarded && ABX.fireDiscarded(ctx.side, cardOf(id)); } });
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
      ch.forEach(r => { const id = detach(r); if (id != null) { e.drop.push(id); ABX.fireDiscarded && ABX.fireDiscarded(otherSide(ctx.side), cardOf(id)); } });
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
    // the follow-up steps pick "from among them" / move "the rest"; anything left returns to the top of the deck
    check: (s) => (s.n || 0) > 0
  };
  OPS.reveal = {
    run(s, ctx) {
      const f = ctx.f;
      const ids = f.deck.splice(0, s.n || 1);
      ctx.bind.revealed = ids.map(id => ({ k: "zone", side: ctx.side, area: "deck", id, card: cardOf(id), pending: true }));
      ctx.bind.chosen = ctx.bind.revealed.slice();
      if (ids.length && !f.isBot && B.setPrompt) B.setPrompt(`Revealed: ${ids.map(i => cardOf(i).name).join(", ")}`);
      return ids.length > 0;
    }
  };

  /* ---------- moving ---------- */
  function destOwnerSide(dest, ref, ctx) { return dest.owner === "owner" ? ref.side : dest.owner === "opp" ? otherSide(ctx.side) : ctx.side; }

  async function moveRefs(refs, dest, ctx, order) {
    if (!refs.length) return false;
    refs = refs.slice();
    if (ctx && ctx.bind) ctx.bind.lastMoved = refs.slice();
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
      else if (dest.host === "chosen") { const hr = (ctx.bind.chosen || []).find(r => r.unit && !refs.some(x => x.unit === r.unit)); host = hr && hr.unit; }
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
      const id = r.pending ? r.id : detach(r);
      r.pending = false;
      if (id == null) continue;
      const ownerSide = destOwnerSide(dest, r, ctx);
      place(id, Object.assign({}, dest, { owner: ownerSide === ctx.side ? "you" : "opp" }), ctx, r.side);
      moved++;
    }
    ctx.lastCount = moved;
    afterChange();
    return moved > 0;
  }
  core.moveRefs = moveRefs;

  OPS.move = {
    async run(s, ctx) {
      let refs;
      if (s.np.ref === "looked") {
        const cands = refsFor(s.np, ctx);
        refs = s.np.qty.all ? cands : await pick(cands, s.np, ctx, { intent: "help", title: `${ctx.card.name} — choose from among them`, subtitle: ABX.clean(s.np.raw) });
      } else if (s.np.ref) refs = s.np.ref === "rest" ? refsFor(s.np, ctx) : (ctx.bind[s.np.ref === "chosen" ? "chosen" : s.np.ref] || []).slice();
      else {
        const cands = refsFor(s.np, ctx);
        refs = await pick(cands, s.np, ctx, { intent: s.np.zone && s.np.zone.owner === "opp" ? "harm" : "help", title: `${ctx.card.name} — choose`, subtitle: ABX.clean(s.np.raw), ordered: s.order === "any" });
      }
      const ok = await moveRefs(refs, s.to, ctx, s.order);
      // (moveRefs clears `pending` on every card it actually placed; cards it could not place stay pending)
      return ok;
    },
    check: (s) => !!s.np && !!s.to && ["hand", "gauge", "drop zone", "deck", "soul"].includes(s.to.area) && (s.to.area !== "soul" || s.to.host === "self" || s.to.host === "chosen" || !!s.to.hostNP)
  };
  OPS.moveSelf = {
    async run(s, ctx) {
      const f = ctx.f;
      if (ctx.unit) {
        const up = core.posOfUnit(f, ctx.unit);
        const ref = { k: (up && up.startsWith("item")) ? "item" : "unit", side: ctx.side, pos: up, unit: ctx.unit, card: ctx.card, id: ctx.card.id };
        return moveRefs([ref], s.to, ctx);
      }
      if (ctx.selfRef) {
        return moveRefs([ctx.selfRef], s.to, ctx);
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
      ctx.bind.chosen = ids.map(id => ({ k: "zone", side, area: to === "soul" ? "drop" : to === "drop zone" ? "drop" : to, id, card: cardOf(id) }));
      ctx.bind.revealed = ctx.bind.chosen.slice();
      ids.forEach(id => {
        if (to === "gauge") f.gauge.push(id);
        else if (to === "hand") f.hand.push(id);
        else if (to === "soul") { if (ctx.unit) ctx.unit.soul.push(id); else f.drop.push(id); }
        else f.drop.push(id);
      });
      afterChange(); return ids.length > 0;
    },
    check: (s) => (typeof s.n === "number" || (s.n && (s.n.each || s.n.lastCount))) && !s.hostNP
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
      ctx.bind.chosen = chosen;
      let ok = chosen.length > 0;
      if (s.to && chosen.length) ok = await moveRefs(chosen, s.to, ctx);
      if (s.to) OPS.shuffle.run({ who: "you" }, ctx); else ctx.needShuffle = true;
      return ok;
    },
    check: (s) => !!s.np && (!s.to || s.to.area !== "soul")
  };

  /* ---------- destroy / rest / stand ---------- */
  OPS.destroy = {
    async run(s, ctx) {
      const cands = s.np.self ? refsFor(s.np, ctx) : (s.np.ref ? (ctx.bind.chosen || []).slice() : refsFor(s.np, ctx, { owner: "any", area: "field" }));
      const targets = s.np.ref ? cands : (s.np.qty.all ? cands : await pick(cands, s.np, ctx, { intent: "harm", title: `${ctx.card.name} — destroy`, subtitle: ABX.clean(s.np.raw) }));
      let did = 0;
      let groupMode = null;
      if (s.orDamage && !(F(ctx.side).isBot || ABX.autoPlay || ctx.auto)) {
        const i = await ABX.ui.pickOption({ title: `${ctx.card.name} — choose one`, options: [{ label: "💥 Destroy" }, { label: `🔥 Deal ${s.orDamage} damage to your opponent` }] });
        if (i === 1) { core.applyDamage(otherSide(ctx.side), s.orDamage, { kind: "effect" }); fresh(); return true; }
      }
      for (const r of targets) {
        if (r.k === "set") {   // a [Set] spell on the field: destroying it sends it to its owner's drop zone
          const sf = F(r.side), si = (sf.setSpells || []).indexOf(r.card);
          if (si >= 0) { sf.setSpells.splice(si, 1); sf.drop.push(r.card.id); did++; }
          continue;
        }
        if (r.k !== "unit" && r.k !== "item") continue;
        if (s.orReturn) {
          // "destroy or return to hand": the player decides (once for an "all" group); bots / auto-play destroy
          let mode = groupMode;
          if (!mode) {
            if (F(ctx.side).isBot || ABX.autoPlay || ctx.auto) mode = "destroy";
            else { const i = await ABX.ui.pickOption({ title: `${ctx.card.name} — ${r.card.name}`, options: [{ label: "💥 Destroy it" }, { label: "↩️ Return it to hand" }] }); mode = i === 1 ? "return" : "destroy"; }
            if (s.np.qty.all) groupMode = mode;
          }
          if (mode === "return") {
            if (r.side !== ctx.side && isProtected(r.unit, r.side, "returned to hand", ctx)) continue;
            if (await moveRefs([r], { area: "hand", owner: "owner" }, ctx)) did++;
            continue;
          }
        }
        if (r.side !== ctx.side && isProtected(r.unit, r.side, "destroyed", ctx)) continue;
        if (isProtected(r.unit, r.side, "destroyed", { side: ctx.side }) && r.side !== ctx.side) continue;
        const pos = core.posOfUnit(F(r.side), r.unit);
        if (!pos) continue;
        if (pos === "item") { const f = F(r.side); const it = f.item; f.item = null; f.drop.push(it.card.id, ...(it.soul || [])); did++; continue; }
        if (B.destroyMonster(r.side, pos) !== false) did++;
      }
      ctx.lastCount = did;
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
        ctx.lastCount = n;
        fresh(); return n > 0;
      },
      check: (s) => !!s.np && !(s.np.zone && !["field", "center", "left", "right"].includes(s.np.zone.area))
    };
  }
  OPS.rest = setRest(true);
  OPS.stand = setRest(false);

  /* ---------- boosts ---------- */
  // "give it power+3000, defense+3000, and [Counterattack]": the parser can leave the numbers in np.refTail and only the keyword in mods.
  ABX.effectiveBoostMods = function (s) {
    const m = s.mods || {};
    if (!m.power && !m.defense && !m.critical && s.np && s.np.refTail && ABX.parseStatMods) {
      const t = ABX.parseStatMods(s.np.refTail);
      if (t && (t.power || t.defense || t.critical)) return Object.assign({}, m, { power: t.power, defense: t.defense, critical: t.critical });
    }
    return m;
  };
  OPS.boost = {
    async run(s, ctx) {
      const mods = ABX.effectiveBoostMods(s);
      const refs = s.np.ref ? (ctx.bind.chosen || []).filter(r => r.unit) : s.np.self ? refsFor(s.np, ctx) : refsFor(s.np, ctx, { owner: "you", area: "field" }).filter(r => r.unit);
      const ch = s.np.ref || s.np.self || s.np.qty.all ? refs : await pick(refs, s.np, ctx, { intent: "help", title: `${ctx.card.name} — choose` });
      const mult = s.each ? (s.each.perReversal ? getFighterReversalCount(ctx.f) : refsFor(s.each, ctx, { owner: "you", area: "field" }).length) : 1;
      if (s.alsoSelf && ctx.unit && !ch.some(r => r.unit === ctx.unit)) ch.push({ k: "unit", side: ctx.side, unit: ctx.unit, card: ctx.card, id: ctx.card.id });
      ch.forEach(r => {
        r.unit.tempPower = (r.unit.tempPower || 0) + (mods.power || 0) * mult;
        r.unit.tempDef = (r.unit.tempDef || 0) + (mods.defense || 0) * mult;
        r.unit.tempCrit = (r.unit.tempCrit || 0) + (mods.critical || 0) * mult;
        (mods.kws || []).forEach(k => { if (k === "penetrate") r.unit.tempPen = true; if (k === "counterattack") r.unit.tempCA = true; if (k === "double attack") { r.unit.tempDA = true; r.unit.attacksLeft = Math.max(r.unit.attacksLeft || 0, 2); } if (k === "triple attack") { r.unit.tempTA = true; r.unit.attacksLeft = Math.max(r.unit.attacksLeft || 0, 3); } if (k === "quadruple attack") { r.unit.tempQA = true; r.unit.attacksLeft = Math.max(r.unit.attacksLeft || 0, 4); } if (k === "hextuple attack") { r.unit.tempHA = true; r.unit.attacksLeft = Math.max(r.unit.attacksLeft || 0, 6); } if (k === "soulguard") r.unit.tempSG = true; if (k === "move") r.unit.tempMove = true; });
      });
      fresh(); return ch.length > 0;
    },
    check: (s) => s.mods && (s.mods.kws || []).every(k => ["penetrate", "counterattack", "double attack", "triple attack", "quadruple attack", "hextuple attack", "soulguard", "move", "weaponry link"].includes(k)) && !(s.np && s.np.zone && !["field", "center", "left", "right"].includes(s.np.zone.area))
  };

  /* ---------- call ---------- */
  OPS.call = {
    async run(s, ctx) {
      const f = ctx.f;
      let cands;
      if (s.np.self) cands = ctx.selfRef && ctx.selfRef.card && ctx.selfRef.card.type === "Monster" ? [ctx.selfRef] : [];
      else if (s.np.ref === "looked") cands = refsFor(s.np, ctx).filter(r => r.card && r.card.type === "Monster");
      else if (s.np.ref) cands = (ctx.bind.chosen || []).filter(r => r.k === "zone" && ["drop", "hand", "deck"].includes(r.area) && r.card && r.card.type === "Monster");
      else {
        const area = (s.np.zone && s.np.zone.area) || "hand";
        if (area === "soul") cands = refsFor(s.np, ctx).filter(r => r.k === "soul" && r.card && r.card.type === "Monster");
        else if (!["hand", "drop zone", "deck"].includes(area)) return false;
        else {
        cands = refsFor(Object.assign({}, s.np, { zone: Object.assign({}, s.np.zone || {}, { owner: "you", area }) }), ctx).filter(r => r.card.type === "Monster");
        }
      }
      cands = cands.filter(r => {
        const effSz = typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, r.card) : (r.card.size || 0);
        if (effSz > (f.maxSize || 3)) return false;
        if (!s.pay) return true;
        const cost = parseCardCost(r.card.cost, r.card.skill, f, r.card);
        return f.gauge.length >= cost.gauge && f.life > cost.life && ABX.canPayExtras(ctx.side, r.card, -1);
      });
      const ch = ((s.np.ref && s.np.ref !== "looked") || s.np.self) ? cands : await pick(cands, s.np, ctx, { intent: "help", title: `${ctx.card.name} — call`, subtitle: ABX.clean(s.np.raw) });
      // "on top of this card / a «X» on your field": that monster's spot; it and its soul go into the new card's soul
      let topHost = null;
      if (s.np.onTop) {
        if (s.np.onTop.self) topHost = ctx.unit && ctx.unit !== f.item ? ctx.unit : null;
        else {
          const hs = refsFor(s.np.onTop.np, ctx, { owner: "you", area: "field" }).filter(r => r.unit && r.k === "unit");
          const hc = await pick(hs, Object.assign({}, s.np.onTop.np, { qty: { n: 1 } }), ctx, { intent: "help", title: `${ctx.card.name} — call on top of which monster?` });
          topHost = hc[0] && hc[0].unit;
        }
        if (!topHost || !core.posOfUnit(f, topHost)) return false;
      }
      let n = 0;
      for (const r of ch) {
        let defaultOpen = SLOTS.find(p => !f.monsters[p]);
        if (!defaultOpen && typeof canPlaceSecondCenter === "function" && canPlaceSecondCenter(f, r.card)) defaultOpen = "center2";
        let pos = (s.pos && s.pos !== "open area") ? (s.pos === "center" && f.monsters.center && typeof canPlaceSecondCenter === "function" && canPlaceSecondCenter(f, r.card) ? "center2" : s.pos) : (defaultOpen || "center");
        let under = null;
        if (topHost) { pos = core.posOfUnit(f, topHost); if (!pos) break; under = topHost; }
        else if (s.pay && ABX.onTopCost(r.card)) {   // its [Call Cost] puts it on top of another monster
          const hs = ABX.onTopHosts(ctx.side, r.card);
          const hc = await pick(hs, { qty: { n: 1 }, raw: "the monster to call it on top of" }, ctx, { intent: "help", title: `${r.card.name} — call on top of which monster?` });
          if (!hc[0]) continue;
          under = hc[0].unit; pos = core.posOfUnit(f, under);
        }
        const cost = s.pay ? parseCardCost(r.card.cost, r.card.skill, f, r.card) : { gauge: 0, life: 0 };
        if (s.pay && (f.gauge.length < cost.gauge || f.life <= cost.life)) continue;
        if (r.k === "soul") { const id = detach(r); if (id == null) continue; f.hand.push(id); }   // from a soul
        else if (r.pending) { r.pending = false; f.hand.push(r.id); }  // a looked-at / revealed card is already out of the deck
        else if (r.area !== "hand") { const arr = f[r.area]; const i = arr.indexOf(r.id); if (i < 0) continue; arr.splice(i, 1); f.hand.push(r.id); }
        const hi = (r.area === "hand" && f.hand[r.idx] === r.id) ? r.idx : f.hand.lastIndexOf(r.id);
        if (hi < 0) continue;
        for (let g = 0; g < cost.gauge; g++) f.drop.push(f.gauge.pop());
        f.life -= cost.life;
        let underIds = null;
        if (under) { underIds = (under.soul || []).concat([under.card.id]); f.monsters[pos] = null; }
        B.completeMonsterCall(ctx.side, pos, hi, false, true);
        if (!f.monsters[pos]) { if (underIds) { f.drop.push(...underIds); } continue; }
        if (underIds) { f.monsters[pos].soul.unshift(...underIds); topHost = null; }
        ctx.calledPos = pos;
        if (s.pay && ABX.hasExtras(r.card)) await ABX.payExtras(ctx.side, r.card, f.monsters[pos]);
        n++;
      }
      return n > 0;
    },
    check: (s) => !!s.np && !s.np.junk && (s.free || s.pay || s.np.self || s.np.ref) && (!s.np.soulOf || s.np.soulOf.ref === "chosen") && s.np.qty &&
      (s.np.self ? /hand|drop zone/i.test((s.np.selfTail || "") + " " + (s.np.raw || "")) : (s.np.ref || (s.np.zone && ["hand", "drop zone", "deck", "soul"].includes(s.np.zone.area)))) && !(s.np.onTop && s.np.onTop.np && s.np.onTop.np.junk)
  };
  OPS.redirectAttack = {
    run(s, ctx) {
      const bc = ABX.battleCtx;
      let pos = ctx.calledPos;
      if (!pos && s.toChosen) { const r = (ctx.bind.chosen || []).find(x => x.unit); pos = r && core.posOfUnit(F(r.side), r.unit); if (pos === "item") pos = null; }
      if (!bc || !bc.active || !pos) return false;
      bc.redirectTo = pos;
      if (B.setPrompt) B.setPrompt(`🎯 The attack's target was changed to "${ctx.card.name}"!`);
      return true;
    }
  };

  OPS.lookPick = {
    async run(s, ctx) {
      const f = ctx.f;
      const ids = f.deck.splice(0, s.n);
      if (!ids.length) return false;
      const refs = ids.map((id, i) => ({ k: "zone", side: ctx.side, area: "deck", id, card: cardOf(id), idx: i }));
      const cands = refs.filter(r => core.matchFilter(r.card, (s.np.filter || {}), r, ctx));
      const np = Object.assign({}, s.np, { qty: Object.assign({}, s.np.qty, { upTo: true }) });
      const chosen = cands.length ? await pick(cands, np, ctx, { intent: "help", title: `${ctx.card.name} — look at the top ${ids.length} cards`, subtitle: ABX.clean(s.np.raw), min: s.np.qty.upTo ? 0 : Math.min(s.np.qty.n || 1, cands.length) }) : [];
      const left = refs.filter(r => !chosen.includes(r));
      const dest = (arr) => (arr.area === "drop zone" ? f.drop : arr.area === "hand" ? f.hand : f.gauge);
      chosen.forEach(r => dest(s.to).push(r.id));
      let order = left;
      if (s.rest.area === "deck" && s.rest.order === "any" && left.length > 1 && !(f.isBot || ABX.autoPlay)) {
        const idxs = await ABX.ui.pickCards({ title: `${ctx.card.name} — order the rest`, subtitle: `Pick the order (first = placed first) for the bottom of your deck.`, cards: left.map(r => ({ card: r.card, badge: "" })), min: left.length, max: left.length, ordered: true });
        if (idxs && idxs.length === left.length) order = idxs.map(i => left[i]);
      }
      if (s.rest.area === "deck") {
        if (s.rest.end === "bottom") order.forEach(r => f.deck.push(r.id)); else order.slice().reverse().forEach(r => f.deck.unshift(r.id));
      } else order.forEach(r => dest(s.rest).push(r.id));
      if (s.gainLife) f.life += s.gainLife;
      afterChange();
      return true;
    }
  };

  OPS.dropSoul = {
    async run(s, ctx) {
      let hosts;
      if (s.hostNP && s.hostNP.self) hosts = ctx.unit ? [{ unit: ctx.unit, side: ctx.side }] : [];
      else if (s.hostNP && s.hostNP.ref) hosts = (ctx.bind.chosen || []).filter(r => r.unit);
      else if (s.hostNP) { const c = refsFor(s.hostNP, ctx, { owner: "any", area: "field" }).filter(r => r.unit && (r.unit.soul || []).length); hosts = s.hostNP.qty.all ? c : await pick(c, s.hostNP, ctx, { intent: "harm", title: `${ctx.card.name} — choose a card to drop souls from` }); }
      else hosts = [];
      let n = 0;
      for (const h of hosts) {
        const u = h.unit, f = F(h.side);
        if (!u || !(u.soul || []).length) continue;
        const cnt = Math.min(s.n || 1, u.soul.length);
        for (let i = 0; i < cnt; i++) { f.drop.push(u.soul.pop()); n++; }
      }
      fresh(); return n > 0;
    },
    check: (s) => !!s.hostNP && !s.host
  };
  OPS.nullifyAbilities = {
    async run(s, ctx) {
      const refs = s.np.ref ? (ctx.bind.chosen || []).filter(r => r.unit) : s.np.self ? refsFor(s.np, ctx) : refsFor(s.np, ctx, { owner: "any", area: "field" }).filter(r => r.unit);
      const ch = s.np.ref || s.np.self || s.np.qty.all ? refs : await pick(refs, s.np, ctx, { intent: "harm", title: `${ctx.card.name} — nullify abilities of`, subtitle: ABX.clean(s.np.raw) });
      let n = 0;
      for (const r of ch) {
        if (r.side !== ctx.side && isProtected(r.unit, r.side, "nullified", ctx)) continue;
        r.unit.abxNullified = B.turnCount; n++;
        if (s.thenDestroy) { const pos = core.posOfUnit(F(r.side), r.unit); if (pos && pos !== "item") B.destroyMonster(r.side, pos); }
      }
      fresh(); return n > 0;
    },
    check: (s) => !!s.np && !s.np.junk
  };
  core.isNullified = function (unit) { return !!(unit && unit.abxNullified === B.turnCount); };

  /* ---------- battle ---------- */
  OPS.nullifyAttack = {
    run(s, ctx) {
      const bc = ABX.battleCtx;
      if (!bc || !bc.active) return false;
      if (s.unlessLink && bc.link) return false;
      if (ABX.attackUnnullifiable && ABX.attackUnnullifiable(bc)) { if (B.setPrompt) B.setPrompt(`⚠️ That attack cannot be nullified!`); return false; }
      bc.nullified = true;
      if (B.setPrompt) B.setPrompt(`🛡️ "${ctx.card.name}" nullified the attack!`);
      return true;
    }
  };
  OPS.noCounter = { run() { return true; }, check: () => false };

  /* ---------- restrictions that the game loop can enforce ---------- */
  OPS.restrict = {
    async run(s, ctx) {
      const refs = s.np.ref ? (ctx.bind.chosen || []).filter(r => r.unit) : s.np.self ? refsFor(s.np, ctx) : refsFor(s.np, ctx, { owner: "any", area: "field" }).filter(r => r.unit);
      const ch = s.np.ref || s.np.self || s.np.qty.all ? refs : await pick(refs, s.np, ctx, { intent: "harm", title: `${ctx.card.name} — choose`, subtitle: ABX.clean(s.np.raw) });
      ch.forEach(r => {
        const u = r.unit; u.abxNo = u.abxNo || {};
        const ks = new Set(s.kinds || []);
        if (ABX.protectKinds) ABX.protectKinds(s).forEach(k => ks.add(k));
        ks.forEach(k => { u.abxNo[k] = k === "stand" ? true : B.turnCount; });
        if ((s.kinds || []).includes("destroyed")) u.tempIndestructible = true;
      });
      fresh(); return ch.length > 0;
    },
    check: (s) => s.np && (s.kinds || []).length > 0 && (s.kinds || []).every(k => ["attack", "stand", "destroyed", "returned to hand", "rest", "nullified", "put into the drop zone", "put to other areas", "leave the field"].includes(k)) && (s.duration === "turn" || !!s.duration || true) && !(s.np.zone && !["field", "center", "left", "right"].includes(s.np.zone.area))
  };
  core.isRestricted = function (unit, kind) {
    if (!unit) return false;
    if (unit.abxNo && unit.abxNo[kind] === B.turnCount) return true;
    if (kind === "attack" && unit.card && !(unit.abxNullified === B.turnCount)) {
      // continuous "this card cannot attack" (optionally behind a condition)
      const side = ["plr", "opp"].find(sd => core.fieldUnits(F(sd), true).some(x => x.unit === unit));
      if (!side) return false;
      for (const ab of ABX.get(unit.card).abilities) {
        if (ab.kind !== "static" || (ab.unparsed && ab.unparsed.length)) continue;
        for (const st of ab.steps || []) {
          const no = (st.op === "static" && st.kind === "cannotAttack") || (st.op === "restrict" && st.np && st.np.self && !st.duration && (st.kinds || []).includes("attack"));
          if (!no) continue;
          const ctx = { side, f: F(side), e: F(otherSide(side)), card: unit.card, unit, bind: { chosen: [] } };
          if ((ab.conds || []).every(c => ABX.condExecutable(c) && evalCond(c, ctx)) && (!st.cond || evalCond(st.cond, ctx))) return true;
        }
      }
    }
    return false;
  };

  /* ---------- "the next time that card would be destroyed this turn, it remains on the field" ---------- */
  OPS.saveOnce = {
    run(s, ctx) {
      const refs = s.np.self ? refsFor(s.np, ctx) : (ctx.bind.chosen || []).filter(r => r.unit);
      let n = 0;
      refs.forEach(r => { if (!r.unit) return; r.unit.abxSave = { turn: B.turnCount, life: s.life || 0, side: ctx.side, by: ctx.card.name }; if (s.kw === "counterattack") r.unit.tempCA = true; n++; });
      fresh(); return n > 0;
    },
    check: (s) => !!s.np && (s.np.self || !!s.np.ref)
  };
  // Called by battle.destroyMonster: true = the destruction is replaced (the monster stays).
  core.useSave = function (side, unit) {
    const sv = unit && unit.abxSave;
    if (!sv || sv.turn !== B.turnCount) return false;
    delete unit.abxSave;
    if (sv.life) F(sv.side || side).life += sv.life;
    if (B.setPrompt) B.setPrompt(`🛡️ "${unit.card.name}" stays on the field ("${sv.by}")!`);
    return true;
  };

  /* ---------- statics / markers handled elsewhere ---------- */
  OPS.static = { run() { return true; }, check: (s) => s.kind === "protect" };
  OPS.noop = { run() { return true; }, check: (s) => !s.note || s.note === "unnullifiable-ok" };
  OPS.modalMarker = { run() { return true; } };
})(typeof window !== "undefined" ? window : globalThis);
