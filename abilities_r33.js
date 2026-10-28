/* ==================== ABX — round 33: Dragon World, card-by-card (3) ====================
 * Built to ability_definitions_dragon_world.md:
 *  - #2099 the chosen «Sun Dragon» attacks through a center monster this turn, then goes to your gauge at end of turn
 *  - #2410 your items can attack through a center monster (ABX.canAttackThrough)
 *  - #2512 "that item can attack during your final phase" (Round 9's finalAttack)
 *  - #5277 attacking a monster alone -> it attacks all your opponent's monsters instead (Round 21's attackAllOpp)
 *  - #5597 option 2: this turn, when a card on your opponent's field is destroyed, deal 2 damage
 *  - #6045 search a «Deity Dragon Tribe» item; then you may equip an item from your hand (paying)
 *  - #5044 "When a soul goes into your «Dragod»" (souls watched on each redraw)
 * Loaded after abilities_r32.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits, posOfUnit } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const hasAttr = (c, a) => !!c && (c.attrs || []).some(x => lc(x).replace(/\s+/g, "") === lc(a).replace(/\s+/g, ""));
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;
  const active = (u) => !!u && u.abxNullified !== B.turnCount;

  const RW = [[/\band for this turn, that item can attack during your final phase\b/gi, "and for this turn, that card can attack during your final phase"]];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };

  const C = (op, extra) => Object.assign({ op }, extra || {});
  const OV = [
    [2099, /choose a size 2 or less «sun dragon» on your field, and for this turn, that card can attack your opponent even if/i, (ab) => ({ kind: ab.kind, steps: [{ op: "choose", np: NP("a size 2 or less «Sun Dragon» on your field") }, C("r33ThroughThenGauge")] })],
    [2410, /^item on your field can attack your opponent even if there is a monster in your opponent's center/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "itemThrough" })] })],
    [5277, /when this card attacks a monster alone, it attacks all your opponent's monsters instead/i, () => ({ kind: "triggered", trigger: { event: "attack", self: true, targetPos: ["left", "center", "right"] }, conds: [{ t: "xAlone" }],
      steps: [{ op: "static", kind: "attackAllOpp", includeFighter: false, instead: true }] })],
    [6045, /put up to one «deity dragon tribe» item from your deck into your hand, and shuffle your deck\. then, if a monster with both/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, steps: [C("r33Equip6045")] })],
    [5044, /when a soul goes into your «dragod»/i, () => ({ kind: "triggered", trigger: { event: "r33SoulIn", np: NP("a «Dragod»") }, once: "turn", steps: [{ op: "mill", who: "you", n: 1, to: "gauge" }, { op: "life", who: "you", n: 1 }, { op: "draw", who: "you", n: 1 }] })],
  ];
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        for (const [id, re, build] of OV) {
          if (card.id !== id || !re.test(raw)) continue;
          const o = build(ab); if (!o || (o.steps || []).some(s => s.np === null)) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.r31 = true;
          if (o.trigger) ab.trigger = o.trigger;
          if (o.conds) ab.conds = o.conds;
          if (o.once) ab.once = o.once;
          break;
        }
        // #5597 option 2
        if (card.id === 5597 && ab.kind === "modal") (ab.options || []).forEach(o => {
          if (/when a card is destroyed on your opponent's field, deal 2 damage/i.test(o.raw || "")) { o.steps = [C("r33OppDestroyDmg", { n: 2 })]; o.unparsed = []; }
        });
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  ABX.TRIG_OK.r33SoulIn = (t) => !!t.np;

  /* ---- ops ---- */
  OPS.r33ThroughThenGauge = {
    run(s, ctx) { const us = (ctx.bind.chosen || []).filter(r => r.unit); us.forEach(r => { r.unit.abxAttackThrough = B.turnCount; r.unit.abxEndToGauge = B.turnCount; }); return us.length > 0; },
    check: () => true
  };
  OPS.r33OppDestroyDmg = { run(s, ctx) { ctx.f.abxOppDestroyDmg = { turn: B.turnCount, n: s.n, card: ctx.card }; return true; }, check: () => true };
  OPS.r33Equip6045 = {
    async run(s, ctx) {
      const f = ctx.f;
      const items = f.deck.map((id, idx) => ({ k: "zone", side: ctx.side, area: "deck", idx, id, card: cardOf(id) })).filter(r => r.card && r.card.type === "Item" && hasAttr(r.card, "Deity Dragon Tribe"));
      const ch = items.length ? (await core.pick(items, { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — a «Deity Dragon Tribe» item` })) || [] : [];
      ch.forEach(r => { const i = f.deck.indexOf(r.id); if (i >= 0) f.hand.push(f.deck.splice(i, 1)[0]); });
      for (let i = f.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [f.deck[i], f.deck[j]] = [f.deck[j], f.deck[i]]; }
      const both = fieldUnits(f, false).some(x => hasAttr(x.unit.card, "Dragod") && hasAttr(x.unit.card, "Deity Dragon Tribe"));
      const hand = f.hand.map((id, idx) => ({ k: "zone", side: ctx.side, area: "hand", idx, id, card: cardOf(id) })).filter(r => r.card && r.card.type === "Item");
      if (both && !f.item && hand.length) {
        const pick = (await core.pick(hand, { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — equip an item (pay its [Equip Cost])` })) || [];
        const r = pick[0];
        if (r) {
          const cost = typeof root.parseCardCost === "function" ? root.parseCardCost(r.card.cost, r.card.skill, f, r.card) : { gauge: 0, life: 0 };
          if (f.gauge.length >= (cost.gauge || 0) && !(cost.life > 0 && f.life <= cost.life)) {
            for (let i = 0; i < (cost.gauge || 0); i++) f.drop.push(f.gauge.pop());
            if (cost.life > 0) f.life -= cost.life;
            f.hand.splice(f.hand.indexOf(r.id), 1);
            f.item = { card: r.card, rested: false, attacksLeft: r.card.atk_max || 1, soul: [], itemMode: "equip" };
          }
        }
      }
      fresh(); return true;
    },
    check: () => true
  };

  /* ---- hooks ---- */
  const hasTag = (card, tag) => !!card && core.abilitiesOf(card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0;
  const cat = ABX.canAttackThrough;
  ABX.canAttackThrough = function (side, unit, which) {
    if (cat && cat.apply(this, arguments)) return true;
    const f = F(side);
    return which !== "own" && !!unit && unit === f.item && fieldUnits(f, false).some(x => active(x.unit) && hasTag(x.unit.card, "itemThrough"));
  };
  // end of turn: #2099's card goes to the gauge
  const fte = ABX.fireTurnEvent;
  ABX.fireTurnEvent = function (kind) {
    try {
      if (kind === "turnEnd") ["plr", "opp"].forEach(side => {
        const f = F(side);
        ["left", "center", "right"].forEach(p => { const u = f.monsters[p]; if (u && u.abxEndToGauge === B.turnCount) { f.monsters[p] = null; f.gauge.push(u.card.id); f.drop.push(...(u.soul || [])); } });
      });
    } catch (e) { /* ignore */ }
    return fte.apply(this, arguments);
  };
  // #5597 option 2: this turn, a card destroyed on the opponent's field deals 2 damage
  if (typeof B.destroyMonster === "function") {
    const dm = B.destroyMonster;
    B.destroyMonster = function (side, pos) {
      const f = this.getFighter(side), m = f && f.monsters[pos];
      const r = dm.apply(this, arguments);
      try {
        const me = otherSide(side), mf = F(me), o = mf.abxOppDestroyDmg;
        if (m && f.monsters[pos] !== m && r !== false && o && o.turn === this.turnCount) { core.applyDamage(side, o.n, { kind: "effect", card: o.card }); this.checkWinCondition(); }
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  // #5044: watch souls of «Dragod» units on every redraw; a soul count going up fires "a soul goes into your «Dragod»"
  if (typeof B.renderBattle === "function") {
    const rb = B.renderBattle;
    B.renderBattle = function () {
      const r = rb.apply(this, arguments);
      try {
        ["plr", "opp"].forEach(side => fieldUnits(F(side), true).forEach(x => {
          const u = x.unit, n = (u.soul || []).length, was = u._r33soul;
          u._r33soul = n;
          if (was != null && n > was && hasAttr(u.card, "Dragod"))
            ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "r33SoulIn" && s === side && core.matchFilter(u.card, t.np.filter || {}, { unit: u, side }, { f: F(side) }), { name: "r33SoulIn" }));
        }));
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
