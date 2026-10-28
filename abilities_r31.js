/* ==================== ABX — round 31: Dragon World, card-by-card ====================
 * Built to ability_definitions_dragon_world.md. The cards left are one-offs, so each gets a purpose-built reading
 * (OVERRIDES: card id + its wording -> steps), on shared hooks:
 *  - stats (getUnitEffectiveCombatStats): #620 critical per «Dragon Knight», max 6 · #3051 critical of your "Fist" item ·
 *    #502 both items critical+1 · #6037 / #6474 stat parts
 *  - damage (core.applyDamage): #456 link attacks deal 2 · #3598 3+ damage with an item -2 · #6037 / #6474 reductions ·
 *    #3052 next time your life would become 0
 *  - destroy (B.destroyMonster): #471 next size 2+ monster stays · #3810 not destroyed by attacks
 *  - attacks: #2704 / #3984 / #505 "this turn, when … attacks" · #3039 no [Counter] vs a center attack · #1479 "Fist" alone
 *  - protection: #597 not affected by "Day of the Dragon" · #3329 not destroyed by spells · #456 cannot be destroyed / returned
 *  - one-shots: #525, #559, #568, #889, #1330, #2634, #4160, #4257 · triggers: #459, #1395, #6462 · #1389 [Lifelink] off
 * Loaded after abilities_r30.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, matchFilter, fieldUnits, posOfUnit } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const hasAttr = (c, a) => !!c && (c.attrs || []).some(x => lc(x).replace(/\s+/g, "") === lc(a).replace(/\s+/g, ""));
  const nameHas = (c, s) => !!c && lc(c.name).includes(lc(s));
  const active = (u) => !!u && u.abxNullified !== B.turnCount;
  // a card with id `id` is on `side`'s field (monster / item / [Set] spell) and not nullified
  const onField = (side, id) => { const f = F(side); return fieldUnits(f, true).some(x => x.unit.card && x.unit.card.id === id && active(x.unit)) || (f.setSpells || []).some(c => c.id === id); };
  const unitOf = (side, id) => { const x = fieldUnits(F(side), true).find(x => x.unit.card && x.unit.card.id === id && active(x.unit)); return x && x.unit; };
  const bc = () => (ABX.battleCtx && ABX.battleCtx.active ? ABX.battleCtx : ABX.curBattle);
  const pickOne = async (cands, ctx, title, intent) => { if (!cands.length) return null; const ch = await core.pick(cands, { qty: { n: 1 } }, ctx, { intent: intent || "help", title }); return ch && ch[0]; };
  const fieldRefs = (side, pred) => fieldUnits(F(side), true).filter(x => !pred || pred(x.unit)).map(x => ({ k: "unit", side, unit: x.unit, card: x.unit.card, id: x.unit.card.id }));

  /* ============ 1. per-card readings ============ */
  const C = (op, extra) => Object.assign({ op }, extra || {});
  const OV = [
    // #456 "This card cannot be destroyed, nor returned to your hand, and it is treated as if there is a size 3 «Armordragon» …"
    // shortcut: the "treated as a size 3 «Armordragon»" part is not counted by conditions yet
    [456, /cannot be destroyed, nor returned to your hand, and it is treated as/i, () => ({ kind: "static", steps: [{ op: "static", kind: "protect", kinds: ["destroyed", "returned to hand"], self: true }] })],
    [456, /^damage dealt to you from link attacks become 2 instead/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "link2" })] })],
    [459, /link attacks with your buddy monster/i, () => ({ kind: "triggered", trigger: { event: "link", self: true }, conds: [{ t: "xLinkBuddy" }], steps: [C("r31InfPower")] })],
    [471, /next time a size 2 or greater monster on your field would be destroyed/i, () => ({ kind: "spell", steps: [C("r31SaveNext", { minSize: 2 })] })],
    [502, /both your item and your opponent's on the field get critical\+1/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "items+1" })] })],
    [505, /when you attack with a «weapon», choose a card in the soul/i, () => ({ kind: "spell", steps: [C("r31OnAttack", { np: "a «Weapon»", act: "dropOppSoul" })] })],
    [525, /^put the monster from your opponent's center to the left or right/i, () => ({ kind: "spell", steps: [C("r31CenterAside"), { op: "damage", who: "opp", n: 3 }] })],
    [559, /reveal a dragon knight from your hand/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, steps: [C("r31HandToGauge", { attr: "Dragon Knight" }), { op: "draw", who: "you", n: 1, gate: "ifYouDo" }] })],
    [568, /if you are being attacked, you may discard a «dragon knight» and pay 1 life/i, (ab) => ({ kind: ab.kind, conds: [{ t: "underAttack" }], steps: [C("r31DiscardPay", { attr: "Dragon Knight", life: 1 }), { op: "nullifyAttack", gate: "ifYouDo" }] })],
    [597, /not affected by the effect of "day of the dragon"/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "dayOfDragon" })] })],
    [620, /critical\+1 for each «dragon knight» monster in your drop zone/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "crit620" })] })],
    [889, /look at all your gauge, choose as many «dragon knight»/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, steps: [C("r31GaugeSwap", { attr: "Dragon Knight" })] })],
    [1330, /total critical of a monster and an item on your field/i, () => ({ kind: "spell", steps: [C("r31CritDamage")] })],
    [1389, /nullify the lifelink of this card/i, () => ({ kind: "static", conds: [{ t: "xDropAttrs", attrs: ["Armordragon", "Hundred Demons"], n: 10 }], steps: [C("static", { kind: "noLifelink" })] })],
    [1395, /enters your opponent's field, or if your opponent casts a spell with "dragon" in its attribute/i, () => ({ kind: "triggered", trigger: { event: "r31Dragon" }, steps: [{ op: "damage", who: "opp", n: 1 }], once: "turn" })],
    [1479, /item on your field with "fist" is the only card attacking/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "fistAlone" })] })],
    [2634, /put the top card of each player's deck into the drop zone/i, (ab) => ({ kind: ab.kind, steps: [{ op: "nullifyAttack" }, C("r31MillSizeDamage")] })],
    [2704, /when a «sun dragon» monster attacks, destroy the chosen monster/i, () => ({ kind: "spell", steps: [{ op: "choose", np: NP("a monster on your opponent's field") }, C("r31OnAttack", { np: "a «Sun Dragon»", act: "destroyChosen" })] })],
    [3039, /attacking a monster on the center, your opponent cannot use \[counter\]/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "noCounterCenter" })] })],
    [3051, /critical equal to the critical of the item with "fist"/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "critFist" })] })],
    [3052, /next time your life would become 0, you gain 2 life instead/i, (ab) => ({ kind: ab.kind, steps: [C("r31LifeSave2")] })],
    [3329, /cannot attack the left and right, and cannot be destroyed by your opponent's spell effects/i, () => ({ kind: "static", steps: [{ op: "static", kind: "noAttackPos", pos: ["left", "right"] }, { op: "static", kind: "protect", kinds: ["destroyed"], self: true, byOpp: true, bySpell: true }] })],
    [3598, /if you would be dealt 3 or greater damage, if you have an item equipped/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "dmg3item" })] })],
    [3810, /the chosen monster cannot be destroyed by attacks/i, (ab) => ({ kind: ab.kind, steps: [{ op: "choose", np: NP("a size 2 monster on your field") }, C("r31NoDestroyByAttack")] })],
    [3984, /when the chosen card attacks, destroy a card on your opponent's field/i, () => ({ kind: "spell", steps: [{ op: "choose", np: NP("a «Thunder Empire» on your field") }, { op: "noReduceChosen", stats: ["critical"] }, C("r31OnAttack", { chosenAttacker: true, act: "destroyPick" })] })],
    [4160, /up to two «thunder empire» monsters into the drop zone, up to one «thunder empire» item into your hand/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, steps: [C("r31ThunderSearch")] })],
    [4257, /a «neodragon», put the top card of your deck into your gauge, a «black dragon», you gain 1 life/i, (ab) => ({ kind: ab.kind, steps: [{ op: "nullifyAttack" }, C("r31TribeBonus")] })],
    [6037, /if your flags \[reversal\] two times or more during this fight, this card gets power\+5000/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "rev6037" })] })],
    [6462, /when this card enters the field or when you take damage/i, (ab) => {
      const r = ABX.parseSentenceSteps("choose any number of cards with power on your opponent's field. If the total power of the chosen cards is 50000 or less, destroy all chosen cards", { conds: [] });
      return r && r.steps.length && !r.unparsed.length ? { kind: "triggered", trigger: { event: "enter", self: true, alsoDamage: true }, steps: r.steps } : null;
    }],
    [6474, /if this card has souls, damage dealt to you other than by your card effects is reduced by 3/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "souls6474" })] })],
  ];
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        for (const [id, re, build] of OV) {
          if (card.id !== id || !re.test(raw)) continue;
          const o = build(ab);
          if (!o || (o.steps || []).some(s => !s || (s.np === null))) continue;
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
  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.r31) return (ab.steps || []).every(s => (s.op === "static" && (s.kind === "r31" || OPS.static.check(s))) || (OPS[s.op] && (!OPS[s.op].check || OPS[s.op].check(s)))) &&
      (ab.conds || []).every(c => ABX.condExecutable(c));
    return isExecPrev.apply(this, arguments);
  };
  const tagOn = (side, tag) => fieldUnits(F(side), true).filter(x => active(x.unit)).concat((F(side).setSpells || []).map(c => ({ unit: { card: c } })))
    .some(x => core.abilitiesOf(x.unit.card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0);
  const tagUnits = (side, tag) => fieldUnits(F(side), true).map(x => x.unit).filter(u => active(u) && core.abilitiesOf(u.card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0);

  /* ============ 2. conditions / triggers ============ */
  const XC = ABX.extraCond;
  XC.xLinkBuddy = (c, ctx) => { const b = bc(); const f = ctx.f; return !!(b && (b.attUnits || []).length > 1 && b.attUnits.some(u => u !== ctx.unit && u.card && u.card.id === f.buddyId)); };
  XC.xDropAttrs = (c, ctx) => ctx.f.drop.filter(id => { const cd = cardOf(id); return cd && c.attrs.some(a => hasAttr(cd, a)); }).length >= c.n;
  ["xLinkBuddy", "xDropAttrs"].forEach(t => ABX.COND_OK.add(t));
  ABX.TRIG_OK.r31Dragon = () => true;
  const dragonAttr = (c) => !!c && (c.attrs || []).some(a => /dragon/i.test(a));
  const fireDragon = (side, card) => { if (!dragonAttr(card)) return; ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "r31Dragon" && s !== side, { name: "r31Dragon" })); };
  if (ABX.fireOtherEnter) { const p = ABX.fireOtherEnter; ABX.fireOtherEnter = function (side, unit) { const r = p.apply(this, arguments); try { fireDragon(side, unit && unit.card); } catch (e) { /* ignore */ } return r; }; }
  if (ABX.fireCast) { const p = ABX.fireCast; ABX.fireCast = function (side, card) { const r = p.apply(this, arguments); try { if (card && card.type === "Spell") fireDragon(side, card); } catch (e) { /* ignore */ } return r; }; }
  // #6462 "or when you take damage": the same ability on Round 24's damage event
  if (ABX.fireEv) {
    const fev = ABX.fireEv;
    ABX.fireEv = function (name, info) {
      const r = fev.apply(this, arguments);
      if (name === "damage") ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "enter" && t.alsoDamage && side === info.side, { name: "r31:damage" }));
      return r;
    };
  }

  /* ============ 3. ops ============ */
  OPS.r31InfPower = { run(s, ctx) { if (!ctx.unit) return false; ctx.unit.tempPower = (ctx.unit.tempPower || 0) + 99999999; fresh(); return true; }, check: () => true };   // "infinite"
  OPS.r31SaveNext = { run(s, ctx) { ctx.f.abxSaveNext = { turn: B.turnCount, minSize: s.minSize }; return true; }, check: () => true };
  OPS.r31NoDestroyByAttack = { run(s, ctx) { const us = (ctx.bind.chosen || []).filter(r => r.unit); us.forEach(r => { r.unit.abxNoAttackDestroy = B.turnCount; }); return us.length > 0; }, check: () => true };
  OPS.r31LifeSave2 = { run(s, ctx) { ctx.f.abxLifeSave2 = B.turnCount; return true; }, check: () => true };
  OPS.r31OnAttack = {
    run(s, ctx) {
      const f = ctx.f, ch = (ctx.bind.chosen || []).filter(r => r.unit);
      const entry = { turn: B.turnCount, act: s.act, side: ctx.side, card: ctx.card, np: s.np ? NP(s.np + " on your field") : null,
        attacker: s.chosenAttacker ? (ch[0] && ch[0].unit) : null, target: s.act === "destroyChosen" ? (ch[0] && ch[0].unit) : null };
      (f.abxOnAttack = f.abxOnAttack || []).push(entry);
      return true;
    },
    check: () => true
  };
  OPS.r31CenterAside = {
    run(s, ctx) {
      const e = ctx.e, u = e.monsters.center; if (!u) return false;
      const to = ["left", "right"].find(p => !e.monsters[p]); if (!to) return false;
      if (core.isProtected(u, otherSide(ctx.side), "put to other areas", ctx)) return false;
      e.monsters.center = null; e.monsters[to] = u; fresh(); return true;
    },
    check: () => true
  };
  OPS.r31HandToGauge = {
    async run(s, ctx) {
      const f = ctx.f, cands = f.hand.map((id, idx) => ({ k: "zone", side: ctx.side, area: "hand", idx, id, card: cardOf(id) })).filter(r => hasAttr(r.card, s.attr));
      if (!cands.length) return false;
      if (!(f.isBot || ABX.autoPlay === true) && !(await ABX.ui.confirm({ title: `${ctx.card.name}`, text: `Reveal a «${s.attr}» from your hand and put it into your gauge?` }))) return false;
      const r = await pickOne(cands, ctx, `${ctx.card.name} — reveal a «${s.attr}»`, "cost"); if (!r) return false;
      const i = f.hand.indexOf(r.id); if (i < 0) return false;
      f.gauge.push(f.hand.splice(i, 1)[0]); fresh(); return true;
    },
    check: () => true
  };
  OPS.r31DiscardPay = {
    async run(s, ctx) {
      const f = ctx.f, cands = f.hand.map((id, idx) => ({ k: "zone", side: ctx.side, area: "hand", idx, id, card: cardOf(id) })).filter(r => hasAttr(r.card, s.attr));
      if (!cands.length || f.life <= s.life) return false;
      const r = await pickOne(cands, ctx, `${ctx.card.name} — discard a «${s.attr}»`, "cost"); if (!r) return false;
      f.drop.push(f.hand.splice(f.hand.indexOf(r.id), 1)[0]); f.life -= s.life; fresh(); return true;
    },
    check: () => true
  };
  OPS.r31GaugeSwap = {
    async run(s, ctx) {
      const f = ctx.f, cands = f.gauge.map((id, idx) => ({ k: "zone", side: ctx.side, area: "gauge", idx, id, card: cardOf(id) })).filter(r => hasAttr(r.card, s.attr));
      if (!cands.length) return false;
      const ch = await core.pick(cands, { qty: { n: cands.length, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — «${s.attr}» from your gauge to the drop zone` });
      let n = 0;
      (ch || []).forEach(r => { const i = f.gauge.indexOf(r.id); if (i >= 0) { f.drop.push(f.gauge.splice(i, 1)[0]); n++; } });
      for (let i = 0; i < n && f.deck.length; i++) f.gauge.push(f.deck.shift());
      fresh(); return n > 0;
    },
    check: () => true
  };
  OPS.r31CritDamage = {
    async run(s, ctx) {
      const f = ctx.f, it = f.item;
      const mons = fieldRefs(ctx.side, u => u !== f.item);
      if (!it || !mons.length) return false;
      const m = await pickOne(mons, ctx, `${ctx.card.name} — choose a monster`, "help"); if (!m) return false;
      const crit = (u) => (root.getUnitEffectiveCombatStats ? root.getUnitEffectiveCombatStats(f, u).crit : u.card.crit) || 0;
      core.applyDamage(otherSide(ctx.side), crit(m.unit) + crit(it), { kind: "effect", unreducible: true, card: ctx.card });
      try { B.checkWinCondition(); } catch (e) { /* ignore */ }
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r31MillSizeDamage = {
    run(s, ctx) {
      ["plr", "opp"].forEach(side => {
        const f = F(side); if (!f.deck.length) return;
        const id = f.deck.shift(); f.drop.push(id);
        const cd = cardOf(id);
        if (cd && cd.type === "Monster" && (cd.size || 0) > 0) core.applyDamage(side, cd.size, { kind: "effect", card: ctx.card });
      });
      try { B.checkWinCondition(); } catch (e) { /* ignore */ }
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r31ThunderSearch = {
    async run(s, ctx) {
      const f = ctx.f, deckRefs = (pred) => f.deck.map((id, idx) => ({ k: "zone", side: ctx.side, area: "deck", idx, id, card: cardOf(id) })).filter(r => r.card && pred(r.card));
      const te = (c) => hasAttr(c, "Thunder Empire");
      const mons = await core.pick(deckRefs(c => te(c) && c.type === "Monster"), { qty: { n: 2, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — up to two «Thunder Empire» monsters to the drop zone` });
      (mons || []).forEach(r => { const i = f.deck.indexOf(r.id); if (i >= 0) f.drop.push(f.deck.splice(i, 1)[0]); });
      const item = await core.pick(deckRefs(c => te(c) && c.type === "Item"), { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — up to one «Thunder Empire» item to your hand` });
      (item || []).forEach(r => { const i = f.deck.indexOf(r.id); if (i >= 0) f.hand.push(f.deck.splice(i, 1)[0]); });
      for (let i = f.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [f.deck[i], f.deck[j]] = [f.deck[j], f.deck[i]]; }
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r31TribeBonus = {
    run(s, ctx) {
      const f = ctx.f, has = (a) => fieldUnits(f, true).some(x => hasAttr(x.unit.card, a));
      if (has("Sun Dragon") && f.deck.length) f.hand.push(f.deck.shift());
      if (has("Neodragon") && f.deck.length) f.gauge.push(f.deck.shift());
      if (has("Black Dragon")) f.life += 1;
      fresh(); return true;
    },
    check: () => true
  };

  /* ============ 4. hooks ============ */
  // stats
  if (typeof root.getUnitEffectiveCombatStats === "function") {
    const gues = root.getUnitEffectiveCombatStats;
    root.getUnitEffectiveCombatStats = function (fighter, unit) {
      const r = gues.apply(this, arguments);
      try {
        if (!r || !unit || !unit.card || !fighter) return r;
        const side = fighter === B.plr ? "plr" : fighter === B.opp ? "opp" : null; if (!side) return r;
        const tags = active(unit) ? core.abilitiesOf(unit.card, a => a.r31).reduce((acc, a) => acc.concat((a.steps || []).map(s => s.tag).filter(Boolean)), []) : [];
        if (tags.includes("crit620")) { const n = fighter.drop.filter(id => { const c = cardOf(id); return c && c.type === "Monster" && hasAttr(c, "Dragon Knight"); }).length; r.crit = Math.min(6, (r.crit || 0) + n); }
        if (tags.includes("critFist")) { const it = fighter.item; if (it && nameHas(it.card, "Fist")) r.crit = (r.crit || 0) + ((gues(fighter, it) || {}).crit || 0); }
        if (tags.includes("rev6037") && typeof getFighterReversalCount === "function" && getFighterReversalCount(fighter) >= 2) { r.power += 5000; r.defense += 5000; r.crit = (r.crit || 0) + 1; }
        if (tags.includes("souls6474") && (unit.soul || []).length) { r.power += 10000; r.defense += 10000; r.crit = (r.crit || 0) + 2; }
        // #502 ([Set] on either side): both items get critical+1 while both fighters have an item
        if (unit === fighter.item && B.plr.item && B.opp.item && ["plr", "opp"].some(sd => (F(sd).setSpells || []).some(c => c.id === 502))) r.crit = (r.crit || 0) + 1;
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  // damage
  const adPrev = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    try {
      const f = F(side), notOwn = !(src && src.kind === "effect" && ABX.curEffectSide === side);
      const b = bc();
      if (src && src.kind === "attack" && b && (b.attUnits || []).length > 1 && tagOn(side, "link2")) n = 2;
      if (n >= 3 && f.item && tagOn(side, "dmg3item")) n -= 2;
      if (notOwn && !(src && src.unreducible)) {
        if (tagUnits(side, "rev6037").length && typeof getFighterReversalCount === "function" && getFighterReversalCount(f) >= 3) n = Math.max(0, n - 2);
        if (tagUnits(side, "souls6474").some(u => (u.soul || []).length)) n = Math.max(0, n - 3);
      }
    } catch (e) { /* ignore */ }
    const before = F(side).life;
    const dealt = adPrev.call(this, side, n, src);
    try {
      const f = F(side);
      if (f.life <= 0 && before > 0 && f.abxLifeSave2 === B.turnCount) { f.abxLifeSave2 = null; f.life = 2; if (f.deck.length) f.hand.push(f.deck.shift()); }
    } catch (e) { /* ignore */ }
    return dealt;
  };
  // destroy
  if (typeof B.destroyMonster === "function") {
    const dm = B.destroyMonster;
    B.destroyMonster = function (side, pos) {
      try {
        const f = this.getFighter(side), u = f && f.monsters[pos];
        if (u && this._destroyByAttack && u.abxNoAttackDestroy === this.turnCount) return false;
        if (u && f.abxSaveNext && f.abxSaveNext.turn === this.turnCount && (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, u.card, u) : u.card.size) >= f.abxSaveNext.minSize) {
          f.abxSaveNext = null; this.setPrompt && this.setPrompt(`🛡️ "${u.card.name}" remains on the field!`); return false;
        }
      } catch (e) { /* ignore */ }
      return dm.apply(this, arguments);
    };
  }
  // protection: #597 (Day of the Dragon) and "by spells" (#3329)
  const ipPrev = core.isProtected;
  core.isProtected = function (unit, side, kind, ctx) {
    if (ipPrev.apply(this, arguments)) return true;
    try {
      if (ctx && ctx.card && nameHas(ctx.card, "Day of the Dragon") && tagOn(side, "dayOfDragon")) return true;
      if (kind === "destroyed" && ctx && ctx.card && ctx.card.type === "Spell" && ctx.side !== side && unit && active(unit) &&
        core.abilitiesOf(unit.card, a => a.r31 && (a.steps || []).some(s => s.bySpell)).length) return true;
    } catch (e) { /* ignore */ }
    return false;
  };
  // attacks: "this turn, when … attacks", no [Counter] vs center, "Fist" item alone can't be nullified
  if (ABX.fireAttack) {
    const fa = ABX.fireAttack;
    ABX.fireAttack = function (attSide, units, defSide, targetPos) {
      const r = fa.apply(this, arguments);
      try {
        const f = F(attSide), us = (units || []).map(u => u.unit).filter(Boolean);
        (f.abxOnAttack || []).filter(en => en.turn === B.turnCount).forEach(en => {
          const hit = en.attacker ? us.includes(en.attacker) : us.some(u => en.np && matchFilter(u.card, en.np.filter || {}, { unit: u, side: attSide }, { f }));
          if (!hit) return;
          ABX.queue(async () => {
            const ctx = { side: attSide, f, e: F(defSide), card: en.card, unit: null, bind: { chosen: [] }, auto: f.isBot || ABX.autoPlay === true };
            if (en.act === "destroyChosen" && en.target) { const p = posOfUnit(F(defSide), en.target); if (p && p !== "item") B.destroyMonster(defSide, p); }
            else if (en.act === "destroyPick") { const c = fieldRefs(defSide).filter(x => x.unit !== F(defSide).item); const t = await pickOne(c, ctx, `${en.card.name} — destroy a card`, "harm"); if (t) { const p = posOfUnit(F(defSide), t.unit); if (p && p !== "item") B.destroyMonster(defSide, p); } }
            else if (en.act === "dropOppSoul") { const c = fieldRefs(defSide, u => (u.soul || []).length > 0); const t = await pickOne(c, ctx, `${en.card.name} — drop a soul`, "harm"); if (t && !core.isProtected(t.unit, defSide, "souls dropped", ctx)) F(defSide).drop.push(t.unit.soul.pop()); }
            fresh();
          });
        });
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }
  if (typeof B.initiateAttackWithDefenseCheck === "function") {
    const iad = B.initiateAttackWithDefenseCheck;
    B.initiateAttackWithDefenseCheck = function (attSide, attackerZones, targetPos) { ABX._r31Target = targetPos; return iad.apply(this, arguments); };
  }
  const nc = ABX.noCounterThisBattle;
  ABX.noCounterThisBattle = function (attSide, units) {
    if (nc && nc.apply(this, arguments)) return true;
    const us = (units || []).map(x => (x && x.unit) || x).filter(Boolean);
    return ABX._r31Target === "center" && us.some(u => active(u) && core.abilitiesOf(u.card, a => a.r31 && (a.steps || []).some(s => s.tag === "noCounterCenter")).length > 0);
  };
  const au = ABX.attackUnnullifiable;
  ABX.attackUnnullifiable = function (b) {
    if (au && au.apply(this, arguments)) return true;
    const us = (b && b.attUnits) || [];
    return us.length === 1 && us[0] === F(b.attSide).item && nameHas(us[0].card, "Fist") && tagOn(b.attSide, "fistAlone");
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
