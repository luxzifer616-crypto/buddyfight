/* ==================== ABX — round 36: «Chaos» tribe ====================
 * Built to ability_definitions_chaos.md: rewrites into wordings the parser reads, center-monster attack events,
 * per-card readings (same table approach as Rounds 31–35), and hooks for attack-through, damage and equip.
 * Can't build yet (no game mechanic): [Ambush] entry, more than one item, flags face down / cards under the flag.
 * Loaded after abilities_r35.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits, posOfUnit, matchFilter } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const hasAttr = (c, a) => !!c && (c.attrs || []).some(x => lc(x).replace(/\s+/g, "") === lc(a).replace(/\s+/g, ""));
  const nameHas = (c, s) => !!c && lc(c.name).includes(lc(s));
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;
  const active = (u) => !!u && u.abxNullified !== B.turnCount;
  const once = (f, k) => { const S = core.st(f); if (S.onceTurn[k] === B.turnCount) return false; S.onceTurn[k] = B.turnCount; return true; };
  const hasTag = (card, tag) => !!card && core.abilitiesOf(card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0;
  const tagOn = (side, tag) => fieldUnits(F(side), true).some(x => active(x.unit) && hasTag(x.unit.card, tag)) || (F(side).setSpells || []).some(c => hasTag(c, tag)) || hasTag(cardOf(F(side).flagId), tag);

  /* ---- 1. rewrites ---- */
  const RW = [
    [/\bDestory\b/g, "Destroy"],
    [/^'[^']+'\s*/, ""],
    [/\byou gain 1 life equal to number of monsters on your center\b/gi, "you gain life equal to the number of monsters on your center"],
    [/\bchange the targets of the attacks to this monster\b/gi, "change the target of the attacks to this monster"],
    [/\bmove this card from left or right to your center\b/gi, "move this monster to your center"],
    [/\byou may pay 1 gauge, and 1 life\b/gi, "you may pay 1 gauge and 1 life"],
    [/\bif one or more cards are put, draw a card\b/gi, "if you put one, draw a card"],
    [/\bif this card enters the field by card effects\b/gi, "if this card entered by card effects"],
    [/\bwhen this cards? attack destroys a monster or deals damage to your opponent\b/gi, "When this card attacks and destroys your opponent's monster or deals damage to your opponent"],
    [/\bdestroy a monster on their field\b/gi, "destroy a monster on your opponent's field"],
    [/\bput a card from your opponent's gauge into his or her drop zone\b/gi, "put a card from your opponent's gauge into their drop zone"],
    [/\breturn the chosen card to your opponent's hand\b/gi, "return the chosen card to hand"],
    [/\bnullify the \[penetrate\] of the attacking card\b/gi, "nullify the [Penetrate] of the attacking cards"],
    [/\byour opponent cannot call cards from the drop zone\b/gi, "Your opponent cannot call monsters from the drop zone"],
    [/\bthe damage dealt to your opponent by this card with 3 or more critical cannot be reduced if it is attacking alone\b/gi, "If this card's critical is 3 or more, this card's damage cannot be reduced if it is attacking alone"],
    [/\bthe gauge cost of this card's \[(equip|cast) cost\] is reduced by the number of (cards|monsters) on your field\b/gi, (m, k, w) => `The gauge cost written in this card's [${k[0].toUpperCase() + k.slice(1)} Cost] is reduced by 1 for each ${w === "cards" ? "card" : "monster"} on your field`],
    [/\bif this card would leave the field, if you destroy a size 3 or less monster on your field, it remains on the field\b/gi, "If this card would leave the field, you may destroy a size 3 or less monster on your field. If you do, it remains on the field"],
    [/\bif items on your field have souls, this card on the field gets size reduced by 2\b/gi, "If your items have souls, this card on the field gets size reduced by 2"],
    [/\bwhen monsters on your field attack\b/gi, "When a monster on your field attacks"],
  ];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };
  // some continuous lines are read by the rule-line reader instead
  if (ABX.parseRuleLine) {
    const prl = ABX.parseRuleLine;
    ABX.parseRuleLine = function (line, card) {
      let fixed = String(line || "");
      for (const [re, to] of RW) fixed = fixed.replace(re, to);
      return prl.call(this, fixed, card);
    };
  }

  /* ---- 2. events: center-monster attacks / attacked / attack destroys / nullified; your equip ---- */
  const EV = {
    centerAttack: (t, i, src, side) => side === i.attSide && i.centerUnit && (!t.np || matchFilter(i.centerUnit.card, t.np.filter || {}, { unit: i.centerUnit, side }, { f: F(side) })),
    centerAttacked: (t, i, src, side) => side === i.defSide && i.targetPos === "center",
    centerDestroys: (t, i, src, side) => side === i.attSide && !!i.centerUnit,
    centerNullified: (t, i, src, side) => side === i.attSide && !!i.centerUnit,
    youEquip: (t, i, src, side) => side === i.side,
    namedAttack: (t, i, src, side) => side === i.attSide && (i.units || []).some(u => nameHas(u.card, t.name)),
  };
  const fire = (name, info) => ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "r36" && t.ev === name && EV[name](t, info, src, side), Object.assign({ name: "r36:" + name }, info)));
  ABX.TRIG_OK.r36 = (t) => !!EV[t.ev];
  ABX.TRIGGER_RULES.unshift(
    [/^(?:when|whenever) a monster on your center attacks and destroys your opponent's monster$/i, () => ({ event: "r36", ev: "centerDestroys" })],
    [/^(?:when|whenever) a monster on your center attacks$/i, () => ({ event: "r36", ev: "centerAttack" })],
    [/^(?:when|whenever) a monster on your center is attacked$/i, () => ({ event: "r36", ev: "centerAttacked" })],
    [/^(?:when|whenever) an attack of a monster on your center is nullified$/i, () => ({ event: "r36", ev: "centerNullified" })],
    [/^(?:when|whenever) you equip an item$/i, () => ({ event: "r36", ev: "youEquip" })],
    [/^(?:when|whenever) your ("[^"]+") attacks$/i, (m) => ({ event: "r36", ev: "namedAttack", name: m[1].replace(/"/g, "") })],
    [/^(?:when|whenever) a monster with ("[^"]+") in its card name is put from your field into the drop zone$/i, (m) => ({ event: "r24", ev: "leave", own: true, kinds: ["destroyed"], np: NP("a monster with " + m[1] + " in its card name") })]
  );
  const unitsOf = (units) => (units || []).map(u => (u && u.unit) || u).filter(Boolean);
  if (ABX.fireAttack) {
    const fa = ABX.fireAttack;
    ABX.fireAttack = function (attSide, units, defSide, targetPos) {
      const r = fa.apply(this, arguments);
      try {
        const us = unitsOf(units), f = F(attSide), cu = us.find(u => f.monsters.center === u);
        if (cu) fire("centerAttack", { attSide, centerUnit: cu, units: us });
        fire("namedAttack", { attSide, units: us });
        if (targetPos === "center") fire("centerAttacked", { defSide, targetPos, units: us });
        // #4082: the monster this card is in is attacked -> 1 life, once per turn
        const d = F(defSide), du = ["left", "center", "right"].includes(targetPos) ? d.monsters[targetPos] : null;
        if (du && (du.soul || []).includes(4082) && once(d, "r36-4082")) { d.life += 1; fresh(); }
        ABX._r36Battle = { attSide, centerUnit: cu || null };
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }
  if (ABX.fireAttackOutcome) {
    const fao = ABX.fireAttackOutcome;
    ABX.fireAttackOutcome = function (attSide, units, defSide, outcome) {
      const r = fao.apply(this, arguments);
      try { const us = unitsOf(units), cu = us.find(u => F(attSide).monsters.center === u); if (cu && outcome && outcome.destroyedMonster) fire("centerDestroys", { attSide, centerUnit: cu }); } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (typeof B.executeAttackResolution === "function") {
    const ear = B.executeAttackResolution;
    B.executeAttackResolution = function (attSide, attackerZones, targetPos, attackNullified) {
      try { if (attackNullified && (attackerZones || []).includes("center")) { const cu = this.getFighter(attSide).monsters.center; if (cu) fire("centerNullified", { attSide, centerUnit: cu }); } } catch (e) { /* ignore */ }
      return ear.apply(this, arguments);
    };
  }
  // your equip: a new item on your field (seen on redraw)
  if (typeof B.renderBattle === "function") {
    const rb = B.renderBattle;
    B.renderBattle = function () {
      const r = rb.apply(this, arguments);
      try { ["plr", "opp"].forEach(side => { const f = F(side), it = f.item && !f.item.isEndrulerFlag ? f.item : null; if (it && f._r36item !== it && f._r36item !== undefined) fire("youEquip", { side }); f._r36item = it; }); } catch (e) { /* ignore */ }
      return r;
    };
  }

  /* ---- 3. per-card readings ---- */
  const C = (op, extra) => Object.assign({ op }, extra || {});
  const P = (t) => { const r = ABX.parseSentenceSteps(t, { conds: [] }); return r && r.steps.length && !r.unparsed.length ? r.steps : null; };
  const OV = [
    [3192, /equal to the number of monsters other than this card on your field/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, steps: [{ op: "mill", who: "you", to: "gauge", n: { each: Object.assign({}, NP("monsters on your field"), { excludeSelf: true }) } }] })],
    [3379, /equal to the total critical of all monsters on your center/i, (ab) => ({ kind: ab.kind, steps: [C("r36CenterCritDamage")] })],
    [3388, /nullify \[penetrate\] from all cards on your opponent's field/i, (ab) => ({ kind: ab.kind, steps: [{ op: "moveSelf", to: { area: "drop zone", owner: "you", end: "top" } }, C("r36OppLoseKw", { kw: "penetrate", gate: "ifYouDo" })] })],
    [3412, /you gain 1 life, and put cards from the top of your deck into the gauge equal to the number of monsters on your field/i, (ab) => ({ kind: ab.kind, steps: [{ op: "life", who: "you", n: 1 }, { op: "mill", who: "you", to: "gauge", n: { each: NP("monsters on your field") } }] })],
    [3534, /look at up to five cards from the top of your deck, put them on top of your deck in any order, and draw a card/i, () => {
      const call = P("you may call a monster from your hand by paying its [Call Cost]");
      return call ? { kind: "triggered", trigger: { event: "enter", self: true }, steps: [C("r36ReorderTop", { n: 5 }), { op: "draw", who: "you", n: 1 }].concat(call) } : null;
    }],
    [3641, /^3 or greater damage dealt to you by monster effects are reduced to 0/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "mon3to0" })] })],
    [3641, /when a size 3 or greater monster enters your field, if this card is in your drop zone, you may pay 1 life/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "cast3641" })] })],
    [3643, /all monsters on your center may attack your opponent even if your opponent has monsters on the center/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "centerThrough" })] })],
    [3796, /for this turn, all monster on your center can attack your opponent even if there is a monster in your opponent's center/i, (ab) => ({ kind: ab.kind, steps: [C("r36CenterThroughTurn")] })],
    [3650, /if this card enters the field during your opponent's turn, you may call a size 3 or less «chaos» monster/i, () => {
      const st = P("you may call a size 3 or less «Chaos» monster from your drop zone to your center without paying its [Call Cost]");
      return st ? { kind: "triggered", trigger: { event: "enter", self: true }, conds: [{ t: "turn", who: "opp" }], steps: st } : null;
    }],
    [3819, /that monster gets \[double attack\]/i, () => ({ kind: "triggered", trigger: { event: "r36", ev: "centerAttack" }, conds: [{ t: "selfPosAny", pos: ["left", "right"] }], steps: [C("r36CenterDA")] })],
    [3825, /call up to three «chaos» monsters from your drop zone without paying their \[call cost\]/i, null],
    [3866, /cards on your opponent's field cannot \[move\] or be returned to hand/i, () => ({ kind: "static", steps: [{ op: "static", kind: "oppNoMove" }, C("static", { kind: "r31", tag: "oppNoReturn" })] })],
    [3925, /you may cast a «plague» spell in this card's soul by paying their \[cast cost\]/i, () => ({ kind: "act", steps: [{ op: "castFromSelfSoul", np: NP("a «Plague» spell"), pay: true }] })],
    [5362, /you may cast a plague spell from this card's soul by paying its \[cast cost\]/i, () => ({ kind: "act", steps: [{ op: "castFromSelfSoul", np: NP("a «Plague» spell"), pay: true }] })],
    [6489, /you may cast a «plague» spell from this card's soul by paying its \[cast cost\]/i, () => ({ kind: "act", steps: [{ op: "castFromSelfSoul", np: NP("a «Plague» spell"), pay: true }] })],
    [3940, /equip up to one «chaos» item without paying its \[equip cost\] and call up to one «chaos» monster/i, () => ({ kind: "act", once: "game", steps: [C("r36ChaosDeck")] })],
    [4095, /draw cards or gain life equal to the number of «hundred demons» monsters on your field/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, steps: [C("r36DrawOrLife", { np: "monsters on your field", attr: "Hundred Demons" })] })],
    [4100, /for this turn, when the chosen card attacks, put a card from your opponent's gauge/i, (ab) => ({ kind: ab.kind, steps: [{ op: "choose", np: NP("a card on your opponent's field") }, C("r36WhenChosenAttacks")] })],
    [4121, /put cards from the top of your deck into your gauge or gain life equal to the destroyed card's size/i, (ab) => {
      const d = P("destroy a size 3 or less monster on the field");
      return d ? { kind: ab.kind, steps: d.concat([C("r36GaugeOrLifeSize")]) } : null;
    }],
    [6497, /choose an «oni assassin» monster on your field, and reveal this hand card/i, (ab) => ({ kind: ab.kind, steps: [C("r36HandToOniSoul")] })],
    [4082, /when a monster with this card in its soul is attacked, you gain 1 life/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "soul4082" })] })],   // run by the fireAttack hook below
  ];
  // "cards on your opponent's field cannot [Move]" is enforced by canUseMove (game.js)
  OPS.static.check = (function (prev) { return function (s) { return (s && s.kind === "oppNoMove") || prev.apply(this, arguments); }; })(OPS.static.check);
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        for (const [id, re, build] of OV) {
          if (card.id !== id || !re.test(raw) || !build) continue;
          const o = build(ab); if (!o || (o.steps || []).some(s => !s || s.np === null)) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.r31 = true;
          if (o.trigger) ab.trigger = o.trigger;
          if (o.conds) ab.conds = o.conds;
          if (o.once) ab.once = o.once;
          break;
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  // #4104: "(If …,) the gauge cost written in this card's [Call Cost] is reduced by N" — applied in parseCardCost below
  ABX.ACTION_RULES.unshift([/^the gauge cost written in this card's \[call cost\] is reduced by (\d+)$/i, (m) => ({ op: "static", kind: "r36callReduce", delta: +m[1] }), false]);
  OPS.static.check = (function (prev) { return function (s) { return (s && s.kind === "r36callReduce") || prev.apply(this, arguments); }; })(OPS.static.check);
  const ieCall = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && (ab.steps || []).length && ab.steps.every(x => x.kind === "r36callReduce" && (!x.cond || ABX.condExecutable(x.cond))) && !(ab.unparsed && ab.unparsed.length)) return true;
    return ieCall.apply(this, arguments);
  };
  if (typeof root.parseCardCost === "function") {
    const pcc = root.parseCardCost;
    root.parseCardCost = function (costStr, skill, fighter, card) {
      const r = pcc.apply(this, arguments);
      try {
        if (!r || !fighter || !card || card.type !== "Monster" || !(r.gauge > 0)) return r;
        const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null; if (!side) return r;
        let cut = 0;
        core.abilitiesOf(card, a => a.kind === "static" && (a.steps || []).some(x => x.kind === "r36callReduce")).forEach(ab => {
          const ctx = { side, f: fighter, e: F(otherSide(side)), card, unit: null, bind: {} };
          if ((ab.conds || []).every(c => core.evalCond(c, ctx))) ab.steps.forEach(x => { if (x.kind === "r36callReduce" && (!x.cond || core.evalCond(x.cond, ctx))) cut += x.delta; });
        });
        if (cut > 0) return Object.assign({}, r, { gauge: Math.max(0, r.gauge - cut) });
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  // "end the turn" (#3825, #5341)
  if (!OPS.endTurn && OPS.endTurnNow) OPS.endTurn = OPS.endTurnNow;

  /* ---- 4. ops ---- */
  OPS.r36CenterCritDamage = {
    run(s, ctx) { const u = ctx.f.monsters.center; if (!u) return false; const c = (root.getUnitEffectiveCombatStats ? root.getUnitEffectiveCombatStats(ctx.f, u).crit : u.card.crit) || 0; core.applyDamage(otherSide(ctx.side), c, { kind: "effect", card: ctx.card }); try { B.checkWinCondition(); } catch (e) { /* ignore */ } fresh(); return true; },
    check: () => true
  };
  OPS.r36OppLoseKw = { run(s, ctx) { const us = fieldUnits(ctx.e, true).map(x => x.unit); us.forEach(u => { u.abxLost = u.abxLost || {}; u.abxLost[s.kw] = B.turnCount; }); return us.length > 0; }, check: () => true };
  OPS.r36ReorderTop = {
    async run(s, ctx) {
      const f = ctx.f, top = f.deck.slice(0, s.n); if (!top.length) return false;
      const refs = top.map((id, idx) => ({ k: "zone", side: ctx.side, area: "deck", idx, id, card: cardOf(id) }));
      const order = auto(ctx.side) ? refs : ((await core.pick(refs, { qty: { n: refs.length } }, ctx, { intent: "help", title: `${ctx.card.name} — put them back (first = top)`, ordered: true })) || refs);
      const ids = order.map(r => r.id).concat(top.filter(id => !order.some(r => r.id === id)));
      f.deck.splice(0, top.length, ...ids); return true;
    },
    check: () => true
  };
  OPS.r36CenterThroughTurn = { run(s, ctx) { ctx.f.abxCenterThrough = B.turnCount; return true; }, check: () => true };
  OPS.r36CenterDA = {
    run(s, ctx) { const u = ctx.f.monsters.center; if (!u) return false; u.tempDA = true; if ((u.attacksLeft || 0) < 2) u.attacksLeft = (u.attacksLeft || 0) + 1; fresh(); return true; },
    check: () => true
  };
  OPS.r36ChaosDeck = {
    async run(s, ctx) {
      const f = ctx.f, deck = (pred) => f.deck.map((id, idx) => ({ k: "zone", side: ctx.side, area: "deck", idx, id, card: cardOf(id) })).filter(r => r.card && pred(r.card));
      const it = ((await core.pick(deck(c => c.type === "Item" && hasAttr(c, "Chaos")), { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — equip a «Chaos» item` })) || [])[0];
      if (it && !f.item) { f.deck.splice(f.deck.indexOf(it.id), 1); f.item = { card: it.card, rested: false, attacksLeft: it.card.atk_max || 1, soul: [], itemMode: "equip" }; }
      const mo = ((await core.pick(deck(c => c.type === "Monster" && hasAttr(c, "Chaos")), { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — call a «Chaos» monster` })) || [])[0];
      if (mo && ABX.placeFromZone) await ABX.placeFromZone(ctx.side, "deck", mo.id, { pay: false });
      for (let i = f.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [f.deck[i], f.deck[j]] = [f.deck[j], f.deck[i]]; }
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r36DrawOrLife = {
    async run(s, ctx) {
      const f = ctx.f, n = fieldUnits(f, false).filter(x => hasAttr(x.unit.card, s.attr)).length; if (!n) return false;
      const i = auto(ctx.side) ? 0 : await ABX.ui.pickOption({ title: ctx.card.name, options: [{ label: `Draw ${n}` }, { label: `Gain ${n} life` }] });
      if (i === 1) f.life += n; else for (let k = 0; k < n && f.deck.length; k++) f.hand.push(f.deck.shift());
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r36GaugeOrLifeSize = {
    async run(s, ctx) {
      const r = [].concat(ctx.bind.lastMoved || [], ctx.bind.chosen || []).filter(x => x && x.card).shift(); if (!r) return false;
      const n = r.card.size || 0; if (!n) return false;
      const f = ctx.f, i = auto(ctx.side) ? 0 : await ABX.ui.pickOption({ title: ctx.card.name, options: [{ label: `Put ${n} into your gauge` }, { label: `Gain ${n} life` }] });
      if (i === 1) f.life += n; else for (let k = 0; k < n && f.deck.length; k++) f.gauge.push(f.deck.shift());
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r36WhenChosenAttacks = {
    run(s, ctx) { const r = (ctx.bind.chosen || []).find(x => x.unit); if (!r) return false; r.unit.abxR36Tax = { turn: B.turnCount, side: ctx.side, card: ctx.card }; return true; },
    check: () => true
  };
  OPS.r36HandToOniSoul = {
    async run(s, ctx) {
      const f = ctx.f, i = ctx.card ? f.hand.indexOf(ctx.card.id) : -1; if (i < 0) return false;
      const hosts = fieldUnits(f, false).filter(x => x.unit.card.type === "Monster" && hasAttr(x.unit.card, "Oni Assassin")).map(x => ({ k: "unit", side: ctx.side, unit: x.unit, card: x.unit.card, id: x.unit.card.id }));
      const h = ((await core.pick(hosts, { qty: { n: 1 } }, ctx, { intent: "help", title: `${ctx.card.name} — into whose soul?` })) || [])[0]; if (!h) return false;
      h.unit.soul.push(f.hand.splice(i, 1)[0]);
      if (f.deck.length) f.hand.push(f.deck.shift());
      fresh(); return true;
    },
    check: () => true
  };

  /* ---- 5. hooks ---- */
  const cat = ABX.canAttackThrough;
  ABX.canAttackThrough = function (side, unit, which) {
    if (cat && cat.apply(this, arguments)) return true;
    const f = F(side);
    return which !== "own" && !!unit && f.monsters.center === unit && (tagOn(side, "centerThrough") || f.abxCenterThrough === B.turnCount);
  };
  // #3641: 3+ damage from monster effects becomes 0
  const adPrev = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    try { const c = ABX.curEffectCard; if (n >= 3 && src && src.kind === "effect" && c && c.type === "Monster" && ABX.curEffectSide !== side && tagOn(side, "mon3to0")) n = 0; } catch (e) { /* ignore */ }
    return adPrev.call(this, side, n, src);
  };
  // #3866: cards on your opponent's field can't be returned to hand
  const ipPrev = core.isProtected;
  core.isProtected = function (unit, side, kind, ctx) {
    if (ipPrev.apply(this, arguments)) return true;
    try { return kind === "returned to hand" && tagOn(otherSide(side), "oppNoReturn"); } catch (e) { return false; }
  };
  // #4100: the chosen card attacks this turn -> its owner's gauge card to the drop zone and 1 damage to them
  if (ABX.fireAttack) {
    const fa = ABX.fireAttack;
    ABX.fireAttack = function (attSide, units) {
      const r = fa.apply(this, arguments);
      try {
        unitsOf(units).forEach(u => {
          const t = u.abxR36Tax; if (!t || t.turn !== B.turnCount) return;
          const a = F(attSide); if (a.gauge.length) a.drop.push(a.gauge.pop());
          core.applyDamage(attSide, 1, { kind: "effect", card: t.card }); B.checkWinCondition(); fresh();
        });
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  // #3641 (drop zone): in your main phase, a size 3+ monster enters your field -> you may pay 1 life to cast it
  if (ABX.fireOtherEnter) {
    const foe = ABX.fireOtherEnter;
    ABX.fireOtherEnter = function (side, unit) {
      const r = foe.apply(this, arguments);
      try {
        const f = F(side), c = cardOf(3641);
        const size = unit && (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, unit.card, unit) : unit.card.size);
        if (c && unit && size >= 3 && B.phase === "main" && B.activeSide === side && f.drop.includes(3641) && f.life > 1 && hasTag(c, "cast3641")) {
          ABX.queue(async () => {
            if (!f.drop.includes(3641) || !(auto(side) || await ABX.ui.confirm({ title: c.name, text: "Pay 1 life to cast this card from your drop zone?" }))) return;
            f.life -= 1;
            if (ABX.fireSpell) await ABX.fireSpell(side, c);
            fresh();
          });
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
