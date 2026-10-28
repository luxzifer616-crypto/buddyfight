/* ==================== ABX — round 32: Dragon World, card-by-card (2) ====================
 * Built to ability_definitions_dragon_world.md, same per-card approach as Round 31:
 *  - put a card onto the field from a zone (optionally on top of a monster, paying or not): #476, #1421, #1578, #4580,
 *    #6393, #6466, #6562
 *  - link attacks that include your item ("link attacks with you"): #1007, #3038, #6199
 *  - #609 "Dragon Shield" can't nullify it alone · #1464 pay 1 gauge to reduce damage · #1473 no [Counter] in link battles
 *    vs a monster · #2410 / #4260 end of battle · #4199 "Batzz" on your right · #6197 unreducible «Sun Dragon» effects ·
 *    #6397 soul trigger · #6459 "Blade Terminate of Bonds"
 * Loaded after abilities_r31.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits, posOfUnit } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const hasAttr = (c, a) => !!c && (c.attrs || []).some(x => lc(x).replace(/\s+/g, "") === lc(a).replace(/\s+/g, ""));
  const nameHas = (c, s) => !!c && lc(c.name).includes(lc(s));
  const active = (u) => !!u && u.abxNullified !== B.turnCount;
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;
  const open = (f) => ["left", "center", "right"].filter(p => !f.monsters[p]);
  const sizeOf = (c) => (c && c.size != null ? c.size : 0);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };
  const zoneRefs = (side, area, pred) => F(side)[area].map((id, idx) => ({ k: "zone", side, area, idx, id, card: cardOf(id) })).filter(r => r.card && (!pred || pred(r.card)));
  const pickN = async (cands, n, ctx, title, upTo) => (cands.length ? (await core.pick(cands, { qty: { n, upTo: upTo !== false } }, ctx, { intent: "help", title })) || [] : []);
  const callCost = (f, c) => (typeof root.parseCardCost === "function" ? root.parseCardCost(c.cost, c.skill, f, c) : { gauge: 0, life: 0 });

  // Put card `id` from `area` onto the field: at `pos` (or the first open area), or on top of `onTop` (that monster and its
  // soul become the new card's soul). pay: pay its gauge / life cost. Returns the new unit, or null.
  async function place(side, area, id, opts) {
    const f = F(side), c = cardOf(id); if (!c) return null;
    let pos = opts.onTop ? posOfUnit(f, opts.onTop) : (opts.pos && !f.monsters[opts.pos] ? opts.pos : open(f)[0]);
    if (!pos || pos === "item") return null;
    if (opts.pay) {
      const cost = callCost(f, c);
      if (f.gauge.length < (cost.gauge || 0) || (cost.life > 0 && f.life <= cost.life)) return null;
      for (let i = 0; i < (cost.gauge || 0); i++) f.drop.push(f.gauge.pop());
      if (cost.life > 0) f.life -= cost.life;
    }
    const i = f[area].indexOf(id); if (i < 0) return null;
    f[area].splice(i, 1);
    const soul = opts.onTop ? [...(opts.onTop.soul || []), opts.onTop.card.id] : [];
    const unit = { card: c, rested: false, attacksLeft: c.atk_max || 1, soul, tempPower: 0, tempDef: 0, tempCrit: 0, actUsed: false };
    f.monsters[pos] = unit;
    if (opts.size0) unit.abxSize0 = true;
    fresh();
    try { if (ABX.fireOtherEnter) ABX.fireOtherEnter(side, unit); if (ABX.ownsEnter && ABX.ownsEnter(c)) ABX.fireEnter(side, c, unit); } catch (e) { /* ignore */ }
    return unit;
  }
  ABX.placeFromZone = place;

  /* ============ 1. per-card readings ============ */
  const C = (op, extra) => Object.assign({ op }, extra || {});
  const parse1 = (t) => { const r = ABX.parseSentenceSteps(t, { conds: [] }); return r && r.steps.length && !r.unparsed.length ? r.steps : null; };
  const OV = [
    [476, /if your life is 3 or less, you may reveal all cards in this card's soul/i, (ab) => ({ kind: ab.kind, conds: [{ t: "life", who: "you", n: 3, cmp: "le" }], steps: [C("r32SoulCall", { attr: "Armordragon" })] })],
    [609, /cannot be nullified by a card with "dragon shield"/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "shield609" })] })],
    [1007, /when this card link attacks with you, if you have 5 life or less, you may pay 1 gauge and discard a card/i, (ab) => ({ kind: ab.kind === "triggered" ? "act" : ab.kind, trigger: null,
      conds: [{ t: "life", who: "you", n: 5, cmp: "le" }, { t: "xLinkItem" }], steps: [C("r32PayDiscard", { gauge: 1, discard: 1 }), C("r32UnnullBattle", { gate: "ifYouDo" })] })],
    [3038, /if this card link attacks with you, the attack cannot be nullified/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "linkItemUnnull" })] })],
    [6199, /when this card link attacks with you, that attack cannot be nullified and its damage cannot be reduced/i, () => ({ kind: "triggered", trigger: { event: "link", self: true }, conds: [{ t: "xLinkItem" }], steps: [C("r32UnnullBattle")] })],
    [1421, /during the main phase of your opponent's turn, call a size 2 or less monster with "thunder mine" from your drop zone/i, (ab) => {
      const st = parse1('call a size 2 or less monster with "Thunder Mine" in its card name from your drop zone by paying its [Call Cost]');
      return st ? { kind: ab.kind, conds: [{ t: "phase", phase: "main", who: "opp" }], steps: st } : null;
    }],
    [1464, /^when you would be dealt damage, you may pay 1 gauge/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "pay1dmg" })] })],
    [1473, /during the battle in which cards on your field link attack your opponent's monster, your opponent cannot/i, () => ({ kind: "spell", steps: [{ op: "draw", who: "you", n: 1 }, C("r32NoCounterLink")] })],
    [1578, /when a monster with "drum" in its card name enters your field, if this card is in your drop zone/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "drum1578" })] })],
    [2410, /at the end of the battle that one or more items on your field attacked, put this card/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "itemBattleEnd" })] })],
    [4199, /if you have a monster with "batzz" in its card name on your right, the size of monsters with "drum"/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "batzzRight" })] })],
    [4260, /at the end of the battle that the «sun dragon» with this card in its soul attacked/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "sun4260" })] })],
    [4580, /drop the top four cards of your deck\. then, choose up to one «dragod» from among them/i, (ab) => ({ kind: ab.kind, steps: [C("r32Dragod4580")] })],
    [6197, /damage dealt to your opponent by card effects of «sun dragon» monster with this card in its soul cannot be reduced/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "sun6197" })] })],
    [6393, /call a «dimension dragon» or «lostvader» monster from your drop zone by paying its \[call cost\]/i, (ab) => ({ kind: ab.kind, steps: [C("r32Lost6393")] })],
    [6397, /if this card is in the soul of a «dragonblood sect» monster, when your opponent's monster is destroyed by your card effects/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "blood6397" })] })],
    [6459, /make your life 5, put up to two cards with "jackknife"/i, (ab) => ({ kind: ab.kind, conds: [{ t: "turn", who: "you" }], steps: [C("r32Blade6459")] })],
    [6466, /call up to one monster with "drum" in its card name, and up to one monster with "bal dragon"/i, (ab) => ({ kind: ab.kind, steps: [{ op: "mill", who: "you", n: 2, to: "gauge" }, C("r32Party6466")] })],
    [6562, /choose from your drop zone, up to one size 2 monster with "garga" in its card name or up to one monster with "destroyer"/i, (ab) => ({ kind: ab.kind, steps: [C("r32Garga6562")] })],
  ];
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        for (const [id, re, build] of OV) {
          if (card.id !== id || !re.test(raw)) continue;
          const o = build(ab); if (!o) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.r31 = true;
          if ("trigger" in o) ab.trigger = o.trigger;
          if (o.conds) ab.conds = o.conds;
          break;
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  const tagUnits = (side, tag) => fieldUnits(F(side), true).map(x => x.unit).filter(u => active(u) && core.abilitiesOf(u.card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0);
  const hasTag = (card, tag) => !!card && core.abilitiesOf(card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0;
  const bc = () => (ABX.battleCtx && ABX.battleCtx.active ? ABX.battleCtx : ABX.curBattle);

  /* ============ 2. conditions ============ */
  ABX.extraCond.xLinkItem = (c, ctx) => { const b = bc(); return !!(b && (b.attUnits || []).length > 1 && ctx.f.item && b.attUnits.includes(ctx.f.item) && (!ctx.unit || b.attUnits.includes(ctx.unit))); };
  ABX.COND_OK.add("xLinkItem");

  /* ============ 3. ops ============ */
  OPS.r32UnnullBattle = { run(s, ctx) { const b = bc(); const us = (b && b.attUnits) || []; us.forEach(u => { u.abxUnnull = { turn: B.turnCount, cond: null }; u.abxUnreducible = { turn: B.turnCount, alone: false }; }); return us.length > 0; }, check: () => true };
  OPS.r32PayDiscard = {
    async run(s, ctx) {
      const f = ctx.f; if (f.gauge.length < s.gauge || f.hand.length < s.discard) return false;
      if (!auto(ctx.side) && !(await ABX.ui.confirm({ title: ctx.card.name, text: `Pay ${s.gauge} gauge and discard ${s.discard} card?` }))) return false;
      const ch = await pickN(zoneRefs(ctx.side, "hand"), s.discard, ctx, `${ctx.card.name} — discard`, false);
      ch.forEach(r => { const i = f.hand.indexOf(r.id); if (i >= 0) f.drop.push(f.hand.splice(i, 1)[0]); });
      for (let i = 0; i < s.gauge; i++) f.drop.push(f.gauge.pop());
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r32NoCounterLink = { run(s, ctx) { ctx.f.abxNoCounterLink = B.turnCount; return true; }, check: () => true };
  OPS.r32SoulCall = {
    async run(s, ctx) {
      const u = ctx.unit, f = ctx.f; if (!u) return false;
      const cands = (u.soul || []).map((id, idx) => ({ k: "soul", side: ctx.side, host: u, idx, id, card: cardOf(id) })).filter(r => r.card && r.card.type === "Monster" && hasAttr(r.card, s.attr));
      const ch = await pickN(cands, 1, ctx, `${ctx.card.name} — call from its soul`);
      if (!ch[0]) return false;
      const i = u.soul.indexOf(ch[0].id); if (i < 0) return false;
      u.soul.splice(i, 1); f.drop.push(ch[0].id);           // via the drop zone so place() can pay and put it on the field
      const nu = await place(ctx.side, "drop", ch[0].id, { pay: true });
      if (!nu) { const j = f.drop.lastIndexOf(ch[0].id); if (j >= 0) u.soul.push(f.drop.splice(j, 1)[0]); return false; }
      const p = posOfUnit(f, u); if (p && p !== "item") B.destroyMonster(ctx.side, p);
      return true;
    },
    check: () => true
  };
  OPS.r32Dragod4580 = {
    async run(s, ctx) {
      const f = ctx.f, ids = f.deck.splice(0, 4); f.drop.push(...ids);
      const cands = ids.map(id => ({ k: "zone", side: ctx.side, area: "drop", id, card: cardOf(id) })).filter(r => hasAttr(r.card, "Dragod"));
      const ch = await pickN(cands, 1, ctx, `${ctx.card.name} — choose up to one «Dragod»`);
      if (!ch[0]) { fresh(); return true; }
      const hosts = fieldUnits(f, false).filter(x => hasAttr(x.unit.card, "Deity Dragon Tribe")).map(x => x.unit);
      let toField = false;
      if (hosts.length && ch[0].card.type === "Monster") toField = auto(ctx.side) ? false : (await ABX.ui.pickOption({ title: ctx.card.name, options: [{ label: "Put it into your hand" }, { label: "Call it on top of a «Deity Dragon Tribe» (pay its [Call Cost])" }] })) === 1;
      if (toField) {
        const h = (await pickN(hosts.map(u => ({ k: "unit", side: ctx.side, unit: u, card: u.card, id: u.card.id })), 1, ctx, "on top of which monster?", false))[0];
        if (h && await place(ctx.side, "drop", ch[0].id, { pay: true, onTop: h.unit })) return true;
      }
      const i = f.drop.lastIndexOf(ch[0].id); if (i >= 0) f.hand.push(f.drop.splice(i, 1)[0]);
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r32Lost6393 = {
    async run(s, ctx) {
      const f = ctx.f;
      const cands = zoneRefs(ctx.side, "drop", c => c.type === "Monster" && (hasAttr(c, "Dimension Dragon") || hasAttr(c, "Lostvader")));
      const ch = await pickN(cands, 1, ctx, `${ctx.card.name} — call from your drop zone`, false);
      if (!ch[0] || !(await place(ctx.side, "drop", ch[0].id, { pay: true }))) return false;
      const lw = zoneRefs(ctx.side, "hand", c => /^lost world$/i.test(c.name));
      if (lw.length && (auto(ctx.side) || await ABX.ui.confirm({ title: ctx.card.name, text: 'Reveal a "Lost World" from your hand?' }))) {
        fieldUnits(f, false).forEach(x => { if (hasAttr(x.unit.card, "Dimension Dragon") || hasAttr(x.unit.card, "Lostvader")) { x.unit.abxNo = x.unit.abxNo || {}; ["destroyed", "returned to hand", "nullified"].forEach(k => { x.unit.abxNo[k] = B.turnCount; }); } });
      }
      return true;
    },
    check: () => true
  };
  OPS.r32Blade6459 = {
    async run(s, ctx) {
      const f = ctx.f; if (f.gauge.length < 1) return false;
      if (!auto(ctx.side) && !(await ABX.ui.confirm({ title: ctx.card.name, text: "Pay 1 gauge?" }))) return false;
      f.drop.push(f.gauge.pop()); f.life = 5;
      const picked = [];
      for (let k = 0; k < 2; k++) {
        const cands = zoneRefs(ctx.side, "deck", c => nameHas(c, "Jackknife") && !picked.includes(c.name));
        const ch = await pickN(cands, 1, ctx, `${ctx.card.name} — a "Jackknife" card (${k + 1}/2)`);
        if (!ch[0]) break;
        picked.push(ch[0].card.name); const i = f.deck.indexOf(ch[0].id); if (i >= 0) f.hand.push(f.deck.splice(i, 1)[0]);
      }
      shuffle(f.deck);
      const gr = f.hand.find(id => /jackknife "gold ritter"/i.test((cardOf(id) || {}).name || ""));
      if (gr != null && (auto(ctx.side) || await ABX.ui.confirm({ title: ctx.card.name, text: 'Equip "Jackknife "Gold Ritter"" for free?' }))) {
        if (f.item && !f.item.isEndrulerFlag) { f.drop.push(...(f.item.soul || []), f.item.card.id); }
        f.hand.splice(f.hand.indexOf(gr), 1);
        const c = cardOf(gr); f.item = { card: c, rested: false, attacksLeft: c.atk_max || 1, soul: [], itemMode: "equip" };
      }
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r32Party6466 = {
    async run(s, ctx) {
      for (const nm of ["Drum", "Bal Dragon", "Batzz"]) {
        if (!open(ctx.f).length) break;
        const ch = await pickN(zoneRefs(ctx.side, "drop", c => c.type === "Monster" && nameHas(c, nm)), 1, ctx, `${ctx.card.name} — call a "${nm}" monster`);
        if (ch[0]) await place(ctx.side, "drop", ch[0].id, { pay: true, size0: true });
      }
      return true;
    },
    check: () => true
  };
  OPS.r32Garga6562 = {
    async run(s, ctx) {
      const f = ctx.f, u = ctx.unit; if (!u || f.gauge.length < 1) return false;
      const cands = zoneRefs(ctx.side, "drop", c => c.type === "Monster" && ((nameHas(c, "Garga") && sizeOf(c) === 2) || nameHas(c, "Destroyer")));
      const ch = await pickN(cands, 1, ctx, `${ctx.card.name} — call on top of this card`);
      if (!ch[0]) return false;
      if (!auto(ctx.side) && !(await ABX.ui.confirm({ title: ctx.card.name, text: "Pay 1 gauge?" }))) return false;
      f.drop.push(f.gauge.pop());
      return !!(await place(ctx.side, "drop", ch[0].id, { pay: false, onTop: u }));
    },
    check: () => true
  };

  /* ============ 4. hooks ============ */
  // #609: a "Dragon Shield" card can't nullify it while it attacks alone
  const nar = OPS.nullifyAttack.run;
  OPS.nullifyAttack.run = function (s, ctx) {
    const b = bc();
    if (b && ctx && ctx.card && nameHas(ctx.card, "Dragon Shield") && (b.attUnits || []).length === 1 && active(b.attUnits[0]) && hasTag(b.attUnits[0].card, "shield609")) return false;
    return nar.apply(this, arguments);
  };
  // #3038: a link attack with your item can't be nullified
  const au = ABX.attackUnnullifiable;
  ABX.attackUnnullifiable = function (b) {
    if (au && au.apply(this, arguments)) return true;
    const us = (b && b.attUnits) || [], f = b && F(b.attSide);
    return us.length > 1 && f && f.item && us.includes(f.item) && us.some(u => active(u) && hasTag(u.card, "linkItemUnnull"));
  };
  // #1473: no [Counter] during this turn's link attacks on a monster
  const nc = ABX.noCounterThisBattle;
  ABX.noCounterThisBattle = function (attSide, units) {
    if (nc && nc.apply(this, arguments)) return true;
    const us = (units || []).map(x => (x && x.unit) || x).filter(Boolean);
    return us.length > 1 && F(attSide).abxNoCounterLink === B.turnCount && ABX._r31Target && ABX._r31Target !== "fighter";
  };
  // damage: #1464 pay 1 gauge to reduce by 1, #6197 unreducible «Sun Dragon» effects
  const adPrev = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    try {
      const f = F(side);
      if (n > 0 && f.gauge.length && tagUnits(side, "pay1dmg").length) {
        // shortcut: a sync yes/no (the browser's confirm) for people, always for bots; replace with the game's prompt if it matters
        const yes = auto(side) ? true : (typeof root.confirm === "function" ? root.confirm(`Pay 1 gauge to reduce this ${n} damage by 1?`) : false);
        if (yes) { f.drop.push(f.gauge.pop()); n -= 1; }
      }
      const es = ABX.curEffectSide;
      if (src && src.kind === "effect" && es && es !== side) {
        const card = ABX.curEffectCard;
        if (card && hasAttr(card, "Sun Dragon") && fieldUnits(F(es), false).some(x => x.unit.card === card && (x.unit.soul || []).includes(6197))) src = Object.assign({}, src, { unreducible: true });
      }
    } catch (e) { /* ignore */ }
    return adPrev.call(this, side, n, src);
  };
  // #4199 ([Set]): with a "Batzz" monster on your right, your "Drum" / "Bal Dragon" monster on your left is size -1
  if (typeof root.getEffectiveCardSize === "function") {
    const gecs = root.getEffectiveCardSize;
    root.getEffectiveCardSize = function (fighter, card, unit) {
      let s = gecs.apply(this, arguments);
      try {
        if (fighter && unit && fighter.monsters.left === unit && (nameHas(card, "Drum") || nameHas(card, "Bal Dragon")) && fighter.monsters.right && nameHas(fighter.monsters.right.card, "Batzz") &&
          (fighter.setSpells || []).some(c => c.id === 4199)) s = Math.max(0, s - 1);
      } catch (e) { /* ignore */ }
      return s;
    };
  }
  // end of battle: #2410 (an item attacked -> this card to the drop zone), #4260 (the «Sun Dragon» it is in attacked)
  if (ABX.fireBattleEnd) {
    const fbe = ABX.fireBattleEnd;
    ABX.fireBattleEnd = function (attSide, units) {
      const r = fbe.apply(this, arguments);
      try {
        const f = F(attSide), us = (units || []).map(u => (u && u.unit) || u).filter(Boolean), e = F(otherSide(attSide));
        if (f.item && us.includes(f.item)) tagUnits(attSide, "itemBattleEnd").forEach(u => { const p = posOfUnit(f, u); if (p && p !== "item") { f.monsters[p] = null; f.drop.push(u.card.id, ...(u.soul || [])); } });
        us.forEach(u => {
          if (!hasAttr(u.card, "Sun Dragon") || !(u.soul || []).includes(4260) || e.monsters.center) return;
          const S = core.st(f), k = "r32-4260";
          if (S.onceTurn[k] === B.turnCount) return; S.onceTurn[k] = B.turnCount;
          if (f.deck.length) f.gauge.push(f.deck.shift()); f.life += 1;
        });
        fresh();
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }
  // #1578 (drop zone): when a "Drum" monster enters your field, you may pay 1 gauge: this card into its soul, or call it
  // #6397 (soul of a «Dragonblood Sect»): on your opponent's turn, their monster destroyed by your card effects -> draw + 1 damage
  if (ABX.fireOtherEnter) {
    const foe = ABX.fireOtherEnter;
    ABX.fireOtherEnter = function (side, unit) {
      const r = foe.apply(this, arguments);
      try {
        const f = F(side), S = core.st(f);
        if (unit && nameHas(unit.card, "Drum") && f.drop.includes(1578) && f.gauge.length && S.onceTurn["r32-1578"] !== B.turnCount) {
          ABX.queue(async () => {
            if (!f.drop.includes(1578) || !f.gauge.length || !posOfUnit(f, unit)) return;
            const i = auto(side) ? 0 : await ABX.ui.pickOption({ title: "GO, Towards Tomorrow!", options: [{ label: "Pay 1 gauge: into its soul" }, { label: "Pay 1 gauge: call this card" }, { label: "Don't use" }] });
            if (i !== 0 && i !== 1) return;
            S.onceTurn["r32-1578"] = B.turnCount; f.drop.push(f.gauge.pop());
            if (i === 0) { f.drop.splice(f.drop.lastIndexOf(1578), 1); unit.soul.push(1578); fresh(); }
            else await place(side, "drop", 1578, { pay: true });
          });
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (typeof B.destroyMonster === "function") {
    const dm = B.destroyMonster;
    B.destroyMonster = function (side, pos) {
      const f = this.getFighter(side), m = f && f.monsters[pos], byAttack = !!this._destroyByAttack, es = ABX.curEffectSide;
      const r = dm.apply(this, arguments);
      try {
        const me = otherSide(side);
        if (m && f.monsters[pos] !== m && r !== false && !byAttack && es === me && this.activeSide === side) {
          const mf = F(me), S = core.st(mf);
          const hosts = fieldUnits(mf, false).filter(x => hasAttr(x.unit.card, "Dragonblood Sect") && (x.unit.soul || []).includes(6397));
          if (hosts.length && S.onceTurn["r32-6397"] !== this.turnCount) {
            S.onceTurn["r32-6397"] = this.turnCount;
            if (mf.deck.length) mf.hand.push(mf.deck.shift());
            core.applyDamage(side, 1, { kind: "effect", card: cardOf(6397) });
            try { this.checkWinCondition(); } catch (e) { /* ignore */ }
          }
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
