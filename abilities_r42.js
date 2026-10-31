/* ==================== ABX — round 42: Legend Dragon tribe review fixes ====================
 * Per-card overrides found by tests/legend_dragon.js (same OV mechanism as r38/r40). Loaded after abilities_r41.js.
 * Wave 1: #6138 independent Fire/Water/Thunder conditions, #5527 attack trigger, #5418/#5737 gated [Triple Attack].
 * Wave 2: "for each card in your buddy zone" counts (#5544 #5516 #5742 #5524 #5543 #5718 #5720), #5516 buddy monsters,
 *         #5538 Sector Collapse (turn-long attack trigger), #5757 dropped-from-hand trigger, #6140 whole drop zone to deck,
 *         #5422 Dragod+Legend Dragon filter, #5419 "Dragod and King", #5515/#5534 Dragod AND King, #5421 left+right Dragod,
 *         #5429 size reduction on left/right, "different Dragod" counts (#5532 #5748 #5759).
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core) return;
  const core = ABX.core, OPS = ABX.OPS, F = core.F, otherSide = core.otherSide;
  const lc = (s) => String(s || "").toLowerCase();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const np = (filter, area, pos, owner) => {
    const zone = { owner: owner || "you", area: area || "field" }; if (pos) zone.pos = pos;
    return { qty: { n: 1, upTo: false, all: false, any: false, each: false }, ref: null, self: false, filter, zone, excludeSelf: false, topN: null, soulOf: null };
  };
  const has = (filter, area, pos) => ({ t: "has", owner: "you", np: np(filter, area, pos), n: 1, other: false });
  const walk = (o, fn) => { if (Array.isArray(o)) o.forEach(x => walk(x, fn)); else if (o && typeof o === "object") { fn(o); Object.values(o).forEach(v => walk(v, fn)); } };
  const DRAGOD_BUDDIES = np({ tribes: ["Dragod"] }, "buddy zone");
  const ANY_BUDDY_CARD = np({}, "buddy zone");

  const buddyCallRow = (name) => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [{ t: "enterByBuddyCall" }], steps: [{ op: "r42BuddyCall", name }] });

  const OV42 = [
    /* ---- catalog check: #2920 Vermolt only triggers when it enters the CENTER ---- */
    [2920, /when this card enters your center/i, (ab) => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [{ t: "selfPos", pos: "center" }], steps: clone(ab.steps || []) })],
    /* ---- Dimension Dragon review ---- */
    // #4633 Zorune: the looked cards go back on top (any order) and ONLY then, if a DD was dropped, a card is drawn
    [4633, /look at the top three cards of your deck/i, (ab) => {
      const st = clone(ab.steps || []);
      const dis = st.find(x => x.op === "discard"), mv = st.find(x => x.op === "move"), dr = st.find(x => x.op === "draw");
      if (!dis || !mv || !dr) return null;
      st[st.indexOf(mv)] = { op: "r42LookBack", gate: "ifYouDo", src: mv.src };
      dr.gate = "ifYouDo";
      return { kind: "act", steps: st, once: "turn" };
    }],
    // #6394 Gazley: "you may pay 1 gauge, and [Rest] this card. If you do" - both costs, so an unpaid gauge skips the rest
    [6394, /choose up to two/i, (ab) => {
      const st = clone(ab.steps || []), rs = st.find(x => x.op === "restSelf");
      if (!rs) return null;
      rs.gate = "ifYouDo";
      return { kind: "act", steps: st };
    }],
    // #5706 Ranma: the drop-instead-of-destroy and the destroy are one "if you do" result (a failed cond of one must not cancel the other)
    [5706, /choose a card on your opponent's field/i, (ab) => {
      const st = clone(ab.steps || []);
      const ch = st.find(x => x.op === "choose"), di = st.find(x => x.op === "discard"), de = st.find(x => x.op === "destroy"), mv = st.find(x => x.op === "move");
      if (!ch || !di || !de || !mv) return null;
      delete de.cond; delete de.gate; delete mv.cond; delete mv.instead;
      return { kind: "act", steps: [ch, di, { op: "r42RanmaResolve", gate: "ifYouDo", destroy: de, move: mv }] };
    }],
    // #4667 Odio: the 2 life is part of the "if you do" cost; the chosen card is shuffled out of the way, then put on top of the deck
    [4667, /put another/i, (ab) => {
      const st = clone(ab.steps || []);
      const mv = st[0], pay = st.find(x => x.op === "pay"), ch = st.find(x => x.op === "choose");
      if (!mv || !pay || !ch || mv.op !== "move") return null;
      pay.gate = "ifYouDo"; ch.gate = "ifYouDo";
      return { kind: "act", steps: [mv, pay, ch, { op: "r42OdioFetch", gate: "ifYouDo" }] };
    }],
    // #5118 D. Aura Burst, option 2: a turn-long "cannot be destroyed" on the left/right DD monsters (the parsed static was a no-op inside a spell)
    [5118, /choose and use one of the following two/i, (ab) => {
      const opts = clone(ab.options || []);
      const o2 = opts[1];
      if (!o2 || !o2.steps || !o2.steps[0] || o2.steps[0].op !== "static") return null;
      const old = o2.steps[0];
      o2.steps = [{ op: "restrict", kinds: ["destroyed"], src: old.src, np: Object.assign(np({ tribes: ["Dimension Dragon"], types: ["monster"] }, "field", ["left", "right"]), { qty: { n: 99, upTo: false, all: true, any: false, each: false } }) }];
      return { kind: "modal", steps: ab.steps, options: opts };
    }],
    // #4626 Ire: "put the rest on the top or bottom of your deck" - the r26 rewrite made it bottom only; the player chooses (auto / bots: bottom)
    [4626, /put the rest on the (?:top or )?bottom of your deck/i, (ab) => {
      const st = clone(ab.steps || []), lp = st.find(x => x.op === "lookPick");
      if (!lp) return null;
      lp.rest.topOrBottom = true;
      return { kind: ab.kind, steps: st, trigger: ab.trigger, conds: ab.conds };
    }],
    // #6458 Deily: "If your flag is Lost World, choose and use three times instead" = repeat the modal choice, not a leftover step
    [6458, /choose and use one of the following three/i, () => ({ kind: "modal", steps: [], once: "turn", repeatLW: 3 })],

    /* ---- wave 1 ---- */
    [6138, /if a «?fire»? is on your field/i, () => ({
      kind: "spell", once: "turn", steps: [
        { op: "damage", who: "opp", n: 2, cond: has({ tribes: ["Fire"] }) },
        { op: "life", who: "you", n: 2, cond: has({ tribes: ["Water"] }) },
        { op: "draw", who: "you", n: 2, cond: has({ tribes: ["Thunder"] }) }
      ]
    })],
    [5527, /if this card is in the center, when a «?legend dragon»? monster/i, () => ({
      kind: "triggered",
      trigger: { event: "otherAttack", np: np({ tribes: ["Legend Dragon"], types: ["monster"] }) },
      conds: [{ t: "selfPos", pos: "center" }],
      steps: [{ op: "damage", who: "opp", n: 1 }]
    })],
    [5418, /at the start of your attack phase/i, (ab) => ({
      kind: "triggered", trigger: ab.trigger || { event: "phaseStart", who: "you", phase: "attack" }, conds: [],
      steps: [Object.assign({}, (ab.steps || []).find(s => s.op === "boost"), { cond: has({ exactNames: ["ice deity, freeza horus"] }) })]
    })],
    [5737, /when this card attacks, if you buddy called/i, () => ({
      kind: "triggered", trigger: { event: "attack", self: true }, once: "turn", conds: [{ t: "buddyCalledEver" }],
      steps: [{ op: "boost", np: { self: true, selfTail: "" }, mods: { power: 0, defense: 0, critical: 0, kws: ["triple attack"] } }]
    })],

    /* ---- wave 3: Double / Triple Buddy chains (Thunder -> Ice -> Flame, Legendary set, One Wing set) ---- */
    [5717, /you may buddy call/i, () => buddyCallRow("Ice Deity, Freeza Horus")],
    [5419, /you may buddy call/i, () => buddyCallRow("Flame Deity, Magma Horus")],
    [5418, /by the effect of/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [{ t: "calledByCard", id: 5419 }],
      steps: [{ op: "destroy", np: Object.assign(np({}, "field", null, "opp"), { qty: { n: 2, upTo: true, all: false, any: false, each: false } }) }, { op: "draw", who: "you", n: 2 }] })],
    [5717, /cannot \[?stand\]?/i, () => ({ kind: "static", steps: [{ op: "restrict", np: np({}, "field", null, "opp"), kinds: ["stand"], byEffect: true }] })],
    [5717, /cannot be destroyed/i, (ab) => { const st = clone(ab.steps); const pr = st.find(x => x.kind === "protect"); if (pr) pr.np.filter = { exactNames: ["flame deity, magma horus", "ice deity, freeza horus"] }; return { kind: "static", steps: st }; }],
    [5749, /you may buddy call/i, () => buddyCallRow("Legendary Ice Deity, Freeza Horus")],
    [5517, /you may buddy call/i, () => buddyCallRow("Legendary Flame Deity, Magma Horus")],
    [5523, /by the effect of/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [{ t: "calledByCard", id: 5517 }], steps: [{ op: "r42DestroyAllDamage", scope: "monsters" }] })],
    [5511, /you may buddy call/i, () => buddyCallRow("One Wing of the King, Magma Horus")],
    [5513, /by the effect of/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [{ t: "calledByCard", id: 5511 }], steps: [{ op: "r42DestroyAllDamage", scope: "spellsItems" }] })],

    /* ---- wave 2: buddy zone counts ---- */
    [5544, /for each card in your buddy zone/i, (ab) => { const st = clone(ab.steps); st[0].each = clone(ANY_BUDDY_CARD); return { kind: "static", steps: st }; }],
    [5516, /size reduced by 1 for each «?dragod»? in your buddy zone/i, (ab) => { const st = clone(ab.steps); st[0].each = clone(DRAGOD_BUDDIES); return { kind: "static", steps: st }; }],
    [5742, /size reduced by 1 for each «?dragod»? in your buddy zone/i, (ab) => { const st = clone(ab.steps); st[0].each = clone(DRAGOD_BUDDIES); return { kind: "static", steps: st }; }],
    [5516, /this card and all of your buddy monsters/i, (ab) => {
      const self = clone(ab.steps[0]); const buddies = clone(ab.steps[0]);
      buddies.np = np({ buddy: true, types: ["monster"] }); buddies.np.excludeSelf = true;
      return { kind: "static", steps: [self, buddies] };
    }],
    [5524, /gain 1 life for each card in your buddy zone/i, (ab) => { const st = clone(ab.steps); const l = st.find(s => s.op === "life"); if (l) l.n = { each: clone(ANY_BUDDY_CARD), per: 1 }; return { kind: "spell", steps: st }; }],
    [5543, /reduce the size of this card on the field by 1 for each card on your left or right/i, (ab) => { const st = clone(ab.steps); st[0].each = np({}, "field", ["left", "right"]); return { kind: "static", steps: st }; }],
    [5543, /choose monsters on your opponent's field up to the number of cards in your buddy zone/i, (ab) => {
      const st = clone(ab.steps); const ch = st.find(s => s.op === "choose");
      ch.np = np({ types: ["monster"] }, "field", null, "opp"); ch.qtyEach = clone(ANY_BUDDY_CARD);
      return { kind: ab.kind, steps: st };
    }],
    [5429, /size reduced by 1 for each monster on your left and right/i, (ab) => { const st = clone(ab.steps); st[0].each = np({ types: ["monster"] }, "field", ["left", "right"]); return { kind: "static", steps: st }; }],
    [5718, /choose and use one of the following two/i, (ab) => ({ kind: "modal", steps: ab.steps, options: clone(ab.options).map(o => { const ch = o.steps[0]; ch.np = np({ types: ["monster"] }, "field", null, "opp"); ch.qtyEach = clone(DRAGOD_BUDDIES); return o; }) })],
    [5720, /choose and use one of the following two/i, (ab) => ({ kind: "modal", steps: ab.steps, options: clone(ab.options).map((o, i) => { const ch = o.steps[0]; ch.np = np({}, "field", null, i === 0 ? "you" : "opp"); ch.qtyEach = clone(DRAGOD_BUDDIES); return o; }) })],

    /* ---- wave 2: single-card fixes ---- */
    [5538, /for this turn, the critical of all/i, (ab) => ({ kind: "spell", steps: [clone(ab.steps[0]), { op: "r42SectorCollapse" }] })],
    [5757, /put into the drop zone from your hand or the field/i, () => ({
      kind: "triggered", trigger: { event: "leave", self: true }, conds: [has({ tribes: ["Legend Dragon"] })],
      steps: [{ op: "destroy", np: np({ types: ["spell", "item"] }, "field", null, "opp") }]
    })],
    [6140, /put a «?legend dragon»? from your drop zone into your hand/i, () => ({
      kind: "spell", once: "game", steps: [
        { op: "move", np: np({ tribes: ["Legend Dragon"], types: ["monster"] }, "drop zone"), to: { area: "hand", owner: "you", end: "top" } },
        { op: "move", np: Object.assign(np({}, "drop zone"), { qty: { n: 99, upTo: false, all: true, any: false, each: false } }), to: { area: "deck", owner: "you", end: "top" } },
        { op: "shuffle", who: "you" }
      ]
    })],
    [5422, /put up to two monsters with both/i, () => null],   // handled below (filter patch on the existing step)
    /* #941 Dragon Throne: your items on the field cannot be returned to hand nor destroyed (field size 4 is handled by the maxSize accessor in game.js) */
    [941, /items on your field cannot be returned to hand/i, () => ({ kind: "static", steps: [{ op: "static", kind: "protect", kinds: ["destroyed", "returned to hand"], self: true, np: np({ types: ["item"] }, "field") }] })],
    [5419, /all dragod and king on your field cannot be destroyed/i, (ab) => { const st = clone(ab.steps); st[0].np.filter = { tribes: ["Dragod", "King"] }; return { kind: "static", steps: st }; }],
    [5515, /you may only cast this card if your opponent's life is 4 or less/i, () => ({ kind: "rule", action: "cast", steps: [], conds: [{ t: "and", list: [{ t: "life", who: "opp", n: 4, cmp: "le" }, has({ tribes: ["Dragod"] }), has({ tribes: ["King"] })] }] })],
    [5534, /you may only cast this card if a «?dragod»? and «?king»? are on your field/i, () => ({ kind: "rule", action: "cast", steps: [], conds: [{ t: "and", list: [has({ tribes: ["Dragod"] }), has({ tribes: ["King"] })] }] })],
    [5421, /counter\]?\s*nullify the attack/i, () => ({
      kind: "spell", steps: [
        { op: "nullifyAttack" },
        { op: "discard", n: 1, cost: true, optional: true, cond: { t: "and", list: [has({ tribes: ["Dragod"] }, "field", ["left"]), has({ tribes: ["Dragod"] }, "field", ["right"])] } },
        { op: "moveSelf", to: { area: "hand", owner: "you", end: "top" }, gate: "ifYouDo" }
      ]
    })],
    /* "different" Dragod counts */
    [5748, /two or more «?dragod»? with different card names/i, () => null],
    [5759, /two or more different «?dragod»?/i, () => null],
    [5532, /choose and use one of the following two/i, (ab) => ({ kind: "modal", steps: ab.steps, options: clone(ab.options).map(o => { walk(o.steps, x => { if (x.t === "count" && x.np && x.np.filter && x.np.filter.tribes) x.np.filter.distinct = true; }); return o; }) })]
  ];

  /* ---- ops ---- */
  const B = typeof battle !== "undefined" ? battle : root.battle;
  const fresh = () => { try { B.renderBattle && B.renderBattle(); } catch (e) { /* ignore */ } };
  // "you may buddy call <exact card name> from your hand without paying its [Call Cost]": a REAL buddy call (buddy gift +1 life, buddy zone entry rested)
  // and the called unit remembers which card called it (for "enters the field by the effect of <card>").
  OPS.r42BuddyCall = {
    async run(s, ctx) {
      const f = ctx.f, side = ctx.side, want = lc(s.name);
      const hi0 = f.hand.findIndex(id => {
        const c = core.cardOf(id);
        return c && lc(c.name) === want && c.type === "Monster" && !(typeof canFighterBuddyCallCard === "function" && !canFighterBuddyCallCard(f, id));
      });
      if (hi0 < 0) return false;
      const card = core.cardOf(f.hand[hi0]);
      // Which zones can it legally go to? The TOTAL size on the field may not exceed the limit once it lands (a monster it replaces goes to the drop zone first).
      const max = f.maxSize || 3, sizeOf = (c, u) => (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, c, u) : (c.size || 0));
      const used = B.getCurrentSizeUsed(f), sz = sizeOf(card);
      const zones = [];
      ["left", "center", "right"].forEach(p => {
        const m = f.monsters[p];
        if (m && m.oppressedBy && m.oppressedBy !== side) return;   // an Oppressed Area controlled by the opponent
        if (used - (m ? sizeOf(m.card, m) : 0) + sz > max) return;
        zones.push({ pos: p, replaces: m || null });
      });
      if (f.monsters.center && !f.monsters.center2 && typeof canPlaceSecondCenter === "function" && canPlaceSecondCenter(f, card) && used + sz <= max) zones.push({ pos: "center2", replaces: null });
      if (!zones.length) return false;
      let pick;
      const auto = ctx.auto || f.isBot || ABX.autoPlay === true || ABX.remoteAutoSide === side;
      if (auto) {
        pick = ["left", "right", "center", "center2"].map(p => zones.find(z => z.pos === p && !z.replaces)).find(Boolean);   // never overwrites one of its own monsters on its own
        if (!pick) return false;
      } else {
        const label = (z) => (z.pos === "center2" ? "Second center" : z.pos[0].toUpperCase() + z.pos.slice(1)) + (z.replaces ? ` — replaces ${z.replaces.card.name} (it goes to the drop zone)` : " — open");
        const i = await ABX.ui.pickOption({ title: `${ctx.card.name} — buddy call`, subtitle: `You may buddy call "${card.name}" from your hand without paying its [Call Cost]. Choose a zone, or don't call.`, options: zones.map(z => ({ label: label(z) })).concat([{ label: "Don't call" }]) });
        if (!(i >= 0 && i < zones.length)) return false;
        pick = zones[i];
      }
      f.abxPendingCallBy = { by: ctx.card.id, target: card.id };
      B.completeMonsterCall(side, pick.pos, f.hand.indexOf(card.id), true, true);
      const u = f.monsters[pick.pos];
      if (!u || u.card.id !== card.id) { delete f.abxPendingCallBy; return false; }
      ctx.calledPos = pick.pos;
      fresh();
      return true;
    },
    check: () => true
  };
  // "destroy all monsters (or all spells and items) on your opponent's field, and deal 1 damage to your opponent for each card destroyed"
  OPS.r42DestroyAllDamage = {
    async run(s, ctx) {
      const flt = s.scope === "monsters" ? { types: ["monster"] } : { types: ["spell", "item"] };
      const step = { op: "destroy", np: Object.assign(np(flt, "field", null, "opp"), { qty: { n: 99, upTo: false, all: true, any: false, each: false } }) };
      await OPS.destroy.run(step, ctx);
      const n = ctx.lastCount || 0;
      if (n > 0) core.applyDamage(otherSide(ctx.side), n, { kind: "effect" });
      fresh();
      return n > 0;
    },
    check: () => true
  };
  // Static "cards cannot [Stand] by card effects" (#5717 Thunder Deity): any card effect that would [Stand] a locked card leaves it rested.
  function standLocked(unit, unitSide) {
    for (const srcSide of ["plr", "opp"]) {
      const sf = F(srcSide);
      for (const src of core.fieldUnits(sf, true)) {
        if (!src.unit || !src.unit.card || src.unit.abxNullified === B.turnCount) continue;
        for (const ab of (ABX.get(src.unit.card).abilities || [])) {
          if (ab.kind !== "static") continue;
          for (const st of (ab.steps || [])) {
            if (st.op !== "restrict" || !(st.kinds || []).includes("stand") || !st.np || !st.np.zone || !st.np.zone.owner) continue;
            if ((st.np.zone.owner === "opp" ? otherSide(srcSide) : srcSide) !== unitSide) continue;
            if (st.cond && !core.evalCond(st.cond, { side: srcSide, f: sf, e: F(otherSide(srcSide)), unit: src.unit, card: src.unit.card, bind: { chosen: [], revealed: [], looked: [] }, hostArea: "field" })) continue;
            if (core.matchFilter(unit.card, st.np.filter || {}, { unit, side: unitSide }, { f: F(unitSide) })) return true;
          }
        }
      }
    }
    return false;
  }
  core.standLocked = standLocked;
  // the unit that lands from r42BuddyCall remembers its caller before its [enter] abilities fire
  if (B && typeof B.afterMonsterCallLanded === "function") {
    const prevLanded = B.afterMonsterCallLanded;
    B.afterMonsterCallLanded = function (side, c, unit) {
      try {
        const f = this.getFighter(side), p = f && f.abxPendingCallBy;
        if (p && unit && c && p.target === c.id) { unit.abxCalledBy = p.by; delete f.abxPendingCallBy; }
      } catch (e) { /* ignore */ }
      return prevLanded.apply(this, arguments);
    };
  }


  // Zorune: the looked-at cards go back on top of the deck (any order = the order they were in), BEFORE the following draw
  OPS.r42LookBack = { run(s, ctx) { const l = (ctx.bind.looked || []).filter(x => x && x.pending); for (let i = l.length - 1; i >= 0; i--) { F(l[i].side).deck.unshift(l[i].id); l[i].pending = false; } return true; }, check: () => true };

  // Ranma: Lost World -> put the chosen card into the drop zone instead of destroying it
  OPS.r42RanmaResolve = { run(s, ctx) { return core.evalCond({ t: "flagIs", names: ["lost world"] }, ctx) ? OPS.move.run(s.move, ctx) : OPS.destroy.run(s.destroy, ctx); }, check: () => true };
  // Odio: the chosen deck card goes into the drop zone, the deck is shuffled, then that card is put on top of the deck
  OPS.r42OdioFetch = {
    async run(s, ctx) {
      const r = (ctx.bind.chosen || []).find(x => x && x.id != null && x.area === "deck");
      if (!r) return false;
      const f = F(r.side || ctx.side), i = f.deck.indexOf(r.id);
      if (i < 0) return false;
      f.deck.splice(i, 1);
      f.drop.push(r.id);
      await OPS.shuffle.run({ op: "shuffle", who: "you" }, ctx);
      const j = f.drop.lastIndexOf(r.id);
      if (j >= 0) f.drop.splice(j, 1);
      f.deck.unshift(r.id);
      return true;
    }, check: () => true
  };

  // #4669 D. Scapegoat: "[Cast Cost] Destroy any number of «Dimension Dragon» monsters on your field" (0 is allowed);
  // "You gain 1 life and draw a card for each card destroyed by this card's [Cast Cost]"
  const isScapegoat = (card) => !!card && card.id === 4669;
  const ddOnField = (side) => core.fieldUnits(F(side), false).filter(x => x.unit && x.unit.card && core.matchFilter(x.unit.card, { tribes: ["Dimension Dragon"], types: ["monster"] }, { unit: x.unit, side }, { f: F(side) }));
  [["hasExtras", () => true], ["canPayExtras", () => true]].forEach(([n, fn]) => { const p = ABX[n]; ABX[n] = function (side, card) { return isScapegoat(card) ? fn() : p.apply(this, arguments); }; });
  const prevPay42 = ABX.payExtras;
  ABX.payExtras = function (side, card) { return isScapegoat(card) ? undefined : prevPay42.apply(this, arguments); };   // the cost is paid when the spell resolves (r42ScapegoatGain)
  OPS.r42ScapegoatGain = {
    async run(s, ctx) {
      const side = ctx.side, f = ctx.f, cands = ddOnField(side);
      if (!cands.length || f.isBot) return false;
      let picks = cands;
      if (!ABX.autoPlay) {
        const idxs = await ABX.ui.pickCards({ title: `${ctx.card.name} — destroy any number of «Dimension Dragon» monsters (cost)`, subtitle: "Pick 0 or more.", cards: cands.map(x => ({ card: x.unit.card, badge: "" })), min: 0, max: cands.length });
        picks = (idxs || []).map(i => cands[i]).filter(Boolean);
      }
      let n = 0;
      for (const x of picks) { if (f.monsters[x.pos] === x.unit && B.destroyMonster(side, x.pos) !== false) n++; }
      if (!n) return false;
      await OPS.life.run({ op: "life", who: "you", n }, ctx);
      await OPS.draw.run({ op: "draw", who: "you", n }, ctx);
      return true;
    }, check: () => true
  };
  OV42.push([4669, /you gain 1 life and draw a card/i, () => ({ kind: "spell", steps: [{ op: "r42ScapegoatGain" }], once: "turn" })]);

  // #6526 Azi Dahaka "Re:B" (Dragon Ein): when destroyed it goes into the soul of up to one spell on your field (prefers "Dragon Throne" #941),
  // then equips #2020 Aqulta Gwaneff from hand/deck (same equip logic as #867).
  OPS.r42AziRebDestroy = {
    async run(s, ctx) {
      const f = ctx.f, sid = ctx.card && ctx.card.id;
      const hosts = f.setSpells || [];
      const host = hosts.find(c => c.id === 941) || hosts[0];
      const di = f.drop.lastIndexOf(sid);
      if (host && di >= 0) { f.drop.splice(di, 1); (host.soul = host.soul || []).push(sid); }
      if (OPS.r40AziDahakaDestroy867) await OPS.r40AziDahakaDestroy867.run(s, ctx);
      fresh();
      return true;
    }, check: () => true
  };
  OV42.push([6526, /when this card is destroyed, put this card into the soul/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, destroyedOnly: true }, conds: [], steps: [{ op: "r42AziRebDestroy" }] })]);
  // #1541 Darkness Final Mission Card "World End" ([Set] impact): "When your Demon Lord on your field attacks, put the top card of your deck face down into this card's soul."
  // It used to parse as a one-shot on cast; now it is an attack trigger of the set card (fires from the set zone, see ABX.fireAttack otherAttack).
  // #6356 Last Symphony -Epilogue- ([Set] impact): "At the start of each player's turn, if your opponent's life is 4 or more, and three or more different «Dark Burial» are [Set] on your field,
  // your opponent's life becomes 3". The generic parse set the life to 3 on the life check alone; the three-different-Dark-Burial check was lost.
  OPS.r42LastSymphony = {
    run(s, ctx) {
      const f = ctx.f, e = ctx.e || F(otherSide(ctx.side));
      if (e.life < 4) return false;
      const names = new Set((f.setSpells || []).filter(c => c && (c.attrs || []).some(a => lc(a).replace(/\s+/g, "") === "darkburial")).map(c => lc(c.name)));
      if (names.size < 3) return false;
      e.life = 3;
      if (B.renderBattle) B.renderBattle();
      return true;
    }, check: () => true
  };
  OV42.push([6356, /at the start of each player's turn, if your opponent's life is 4 or more/i, (ab) => ({ kind: "triggered", trigger: clone(ab.trigger), conds: [], steps: [{ op: "r42LastSymphony" }] })]);
  // #297 Super Lethal Formation ([Set] impact): "All Ninja on your field gets power+1000 and defense+1000" lasts while it is set; it parsed as a one-shot spell effect (temp boost on cast only).
  OV42.push([297, /all ninja on your field gets power\+1000/i, (ab) => ({ kind: "static", steps: clone(ab.steps || []) })]);
  // #4243 Tempest Thunder Knights Formation! ([Set] impact): "The size of all monsters with 'Thunder Knights' in their card names on your field is reduced by 1" is continuous while set;
  // as a "spell" ability it parsed to a one-shot becomeSizeZero that never applied.
  OV42.push([4243, /the size of all monsters with .thunder knights/i, (ab) => { const st = (ab.steps || []).find(x => x.np); return st ? { kind: "static", steps: [{ op: "static", kind: "sizeModOthers", np: clone(st.np), delta: -1, origSize: null, origLe: true, src: st.src }] } : null; }]);
  // #6414 Finish Effect: MIRRORS SPACE ([Set] impact): "[Counter] [Act] ... call a «Super Warrior» monster from this card's soul by paying its [Call Cost]." The «Super Warrior» monsters are
  // Impact Monsters, which the generic call op (type "Monster" only) never offered; they are called through the impact-monster engine (B.imCallFromZone), paying their gauge / life.
  OPS.r42MirrorsCall = {
    async run(s, ctx) {
      const f = ctx.f, side = ctx.side, host = ctx.soulHost || ctx.card;
      if (!(root.IMX && B.imCallInfo && B.imCallFromZone) || !host || !Array.isArray(host.soul)) return false;
      const sw = (c) => c && (c.attrs || []).some(a => lc(a).replace(/\s+/g, "") === "superwarrior");
      const cands = [];
      host.soul.forEach((e, si) => {
        const id = typeof root.getSoulCardId === "function" ? root.getSoulCardId(e) : e, c = core.cardOf(id);
        if (!sw(c) || !IMX.isImpactMonster(c)) return;
        const info = B.imCallInfo(side, c, { byEffect: true, ignorePhase: true }), d = info && info.data;
        if (!info || !info.ok || !d || (d.call.parts || []).length) return;
        if (!MONSTER_POSITIONS.some(p => !f.monsters[p]) || B.getCurrentSizeUsed(f) + getEffectiveCardSize(f, c) > (f.maxSize || 3)) return;
        cands.push({ k: "soul", side, host, idx: si, id, card: c, d, unit: null });
      });
      if (!cands.length) return false;
      const ch = await core.pick(cands, { qty: { n: 1 }, raw: "a «Super Warrior» monster from this card's soul", filter: {} }, ctx, { intent: "help", title: `${ctx.card.name} - call a Super Warrior from its soul` });
      const r = ch && ch[0]; if (!r) return false;
      const d = r.d || (cands.find(x => x.card === r.card) || {}).d; if (!d) return false;
      const si = host.soul.findIndex(e => (typeof root.getSoulCardId === "function" ? root.getSoulCardId(e) : e) === r.id);
      if (si < 0) return false;
      const entry = host.soul.splice(si, 1)[0];
      f.hand.push(r.id);
      for (let g = 0; g < d.call.gauge; g++) f.drop.push(f.gauge.pop());
      if (d.call.life > 0) f.life = Math.max(1, f.life - d.call.life);
      const ok = !!B.imCallFromZone(side, "hand", f.hand.lastIndexOf(r.id), {}, null);
      if (!ok) { const hi = f.hand.lastIndexOf(r.id); if (hi >= 0) f.hand.splice(hi, 1); host.soul.splice(si, 0, entry); }
      return ok;
    }, check: () => true
  };
  OV42.push([6414, /call a .super warrior. monster from this card's soul/i, (ab) => Object.assign(clone(ab), { steps: [{ op: "r42MirrorsCall" }] })]);
  // #1152 New-Era Great Spell, The Creation ([Set] impact): "When you draw by the effect of a card, put the top card of your deck into your gauge, and you gain 1 life. Once per turn."
  // It used to parse as a one-shot on cast. "effectDraw" fires from OPS.draw (a draw by a card effect, not the draw phase).
  Object.assign(ABX.TRIG_OK, { effectDraw: () => true });
  if (OPS.draw && OPS.draw.run && !OPS.draw.__r42Fire) {
    const origDraw = OPS.draw.run;
    OPS.draw.run = function (s, ctx) {
      const r = origDraw.apply(this, arguments);
      try { const side = ctx.side && (s && s.who === "opp" ? otherSide(ctx.side) : ctx.side); if (r && side) ABX.queue(() => core.fireTriggers((t, src, sd) => t.event === "effectDraw" && sd === side, { name: "effectDraw" })); } catch (e) { /* ignore */ }
      return r;
    };
    OPS.draw.__r42Fire = true;
  }
  OV42.push([1152, /when you draw by the effect of a card/i, () => ({ kind: "triggered", trigger: { event: "effectDraw" }, once: "turn", conds: [], steps: [{ op: "mill", who: "you", n: 1, to: "gauge", src: "put the top card of your deck into your gauge" }, { op: "life", who: "you", n: 1, src: "you gain 1 life" }] })]);
  OV42.push([1541, /when your demon lord on your field attacks/i, () => ({ kind: "triggered", trigger: { event: "otherAttack", np: np({ tribes: ["Demon Lord"] }) }, conds: [], steps: [{ op: "mill", who: "you", n: 1, to: "soul", host: "self", faceDown: true, src: "put the top card of your deck face down into this card's soul" }] })]);

  // #6526 in the soul of "Dragon Throne": when an item on your field attacks ALONE it attacks all opp monsters + opp, and gets power+10000 and [Triple Attack] this turn.
  // (Soul cards of set spells are not trigger sources in the engine, so this is applied from a fireAttack hook.)
  const origFireAttackReb = ABX.fireAttack;
  ABX.fireAttack = function (attSide, units) {
    try {
      const f = B[attSide];
      const u = units && units.length === 1 && units[0] && units[0].unit;
      if (f && u && u === f.item && u.abxRebTurn !== B.turnCount) {
        const throne = (f.setSpells || []).find(c => c.id === 941 && (c.soul || []).some(x => Number(x && typeof x === "object" ? x.id : x) === 6526));
        if (throne) {
          u.abxRebTurn = B.turnCount;
          u.abxAttackAllOpp = B.turnCount;
          u.tempPower = (u.tempPower || 0) + 10000;
          if (!u.tempTA) { u.tempTA = true; u.attacksLeft = (u.attacksLeft || 0) + 2; }
        }
      }
    } catch (e) { /* ignore */ }
    return origFireAttackReb.apply(this, arguments);
  };

  // #5538: remember that Sector Collapse is active this turn (the attack hook below applies it)
  OPS.r42SectorCollapse = { run(s, ctx) { ctx.f.abxSectorCollapse = battle.turnCount; return true; }, check: () => true };

  const prev = ABX.parseCard;
  /* catalog check: "unaffected by / not affected by the effects of \"<Name>\"" (#402 #405 #2068 vs Gleipnir).
   * A restriction coming from that named card is undone for the immune unit. */
  const immuneTo = (unit, srcName) => {
    if (!unit || !unit.card || !srcName) return false;
    const m = String(unit.card.skill || "").match(/(?:unaffected by|not affected by) the effects? of "([^"]+)"/i);
    return !!m && lc(m[1]) === lc(srcName);
  };
  if (OPS.restrict && !OPS.restrict._r42Immune) {
    const prevRun = OPS.restrict.run;
    OPS.restrict.run = async function (s, ctx) {
      const units = ["plr", "opp"].flatMap(sd => core.fieldUnits(F(sd), true)).map(x => x.unit).filter(u => immuneTo(u, ctx && ctx.card && ctx.card.name));
      const before = units.map(u => [u, JSON.stringify(u.abxNo || null), u.tempIndestructible]);
      const r = await prevRun.call(this, s, ctx);
      before.forEach(([u, no, ti]) => { u.abxNo = JSON.parse(no) || undefined; if (u.abxNo === undefined) delete u.abxNo; u.tempIndestructible = ti; });
      return r;
    };
    OPS.restrict._r42Immune = true;
  }
  ABX.immuneTo = immuneTo;

  ABX.parseCard = function (card) {
    const r = prev.apply(this, arguments);
    try {
      if (!card || !r || !Array.isArray(r.abilities)) return r;
      if (!OV42.some(o => o[0] === card.id) && ![5422, 5748, 5759].includes(card.id)) return r;
      const extra = [];
      r.abilities.forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "");
        const full = String(ab.raw || "");
        // plain filter patches: only the filter of the existing steps changes
        if (card.id === 5422 && Array.isArray(ab.steps)) walk(ab.steps, x => { if (x.filter && x.filter.uniqueBy === "cardName") { x.filter.tribesAll = ["Dragod", "Legend Dragon"]; } });
        if ((card.id === 5748 || card.id === 5759) && Array.isArray(ab.steps)) walk(ab.steps, x => { if (x.t === "count" && x.np && x.np.filter && x.np.filter.tribes && x.np.filter.tribes.includes("Dragod")) x.np.filter.distinct = true; if (x.filter && x.filter.uniqueBy && x.filter.tribes) { x.filter.distinct = true; } });
        for (const [id, re, build] of OV42) {
          if (card.id !== id || !(re.test(raw) || re.test(full) || re.test(lc(raw)))) continue;
          const o = build(ab);
          if (!o) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.parsed = true; ab.r42 = true;
          if (o.options) ab.options = o.options;
          if (o.action) ab.action = o.action;
          if (o.once) ab.once = o.once;
          if (o.repeatLW) ab.repeatLW = o.repeatLW;
          if (o.trigger) ab.trigger = o.trigger;
          if (o.conds !== undefined) ab.conds = o.conds;
          // #5757: the same effect also happens when it is dropped from the hand
          if (card.id === 5757 && o.kind === "triggered") { const c2 = clone(ab); c2.trigger = { event: "discardedFromHand", self: true }; extra.push(c2); }
          break;
        }
      });
      extra.forEach(x => r.abilities.push(x));
    } catch (e) { /* keep the parsed card as is */ }
    return r;
  };

  // #5538 Sector Collapse: for this turn, when a size 1 or less Legend Dragon monster on your field attacks, destroy up to one card on the opponent's field; if you do, 1 damage
  const prevAttack = ABX.fireAttack;
  ABX.fireAttack = function (attSide, units, defSide, targetPos) {
    const r = prevAttack.apply(this, arguments);
    try {
      const f = F(attSide);
      if (f && f.abxSectorCollapse === battle.turnCount && (units || []).some(u => u && u.unit && core.matchFilter(u.unit.card, { tribes: ["Legend Dragon"], types: ["monster"], size: { n: 1, cmp: "le" } }, { unit: u.unit, side: attSide }, { f }))) {
        const card = core.cardOf(5538);
        const ab = { kind: "spell", steps: [{ op: "destroy", np: Object.assign(np({}, "field", null, "opp"), { qty: { n: 1, upTo: true, all: false, any: false, each: false } }) }, { op: "damage", who: "opp", n: 1, gate: "ifYouDo" }] };
        return ABX.queue(async () => { await r; await ABX.runAbility(attSide, card, ab, null, { preApproved: true }); });
      }
    } catch (e) { /* ignore */ }
    return r;
  };

  /* ==================== Stand lock coverage ==================== */
  // Ruling note: no official Q&A on Voltic Ra vs. Double Attack was found. Q1192 (Gojinmaru) calls the keyword's re-stand a "[Stand]", so a "cannot [Stand]"
  // lock stops [Double/Triple/Quadruple Attack] here. Set ABX.standLockStopsMultiAttack = false to allow them again.
  ABX.standLockStopsMultiAttack = true;
  const lockSrcCache = new Map();
  const isLockSrc = (card) => {
    if (!lockSrcCache.has(card.id)) lockSrcCache.set(card.id, (ABX.get(card).abilities || []).some(ab => ab.kind === "static" && (ab.steps || []).some(st => st.op === "restrict" && (st.kinds || []).includes("stand") && st.np && st.np.zone && st.np.zone.owner)));
    return lockSrcCache.get(card.id);
  };
  const anyLockSource = () => ["plr", "opp"].some(sd => core.fieldUnits(F(sd), true).some(x => x.unit && x.unit.card && isLockSrc(x.unit.card)));
  const lockedRested = () => {
    const out = [];
    ["plr", "opp"].forEach(sd => core.fieldUnits(F(sd), true).forEach(x => { if (x.unit.rested && standLocked(x.unit, sd)) out.push({ u: x.unit, attacksLeft: x.unit.attacksLeft }); }));
    return out;
  };
  // Every ability step (OPS.stand and the older round files that set rested=false directly) leaves a locked, rested card rested.
  const guardOp = (op) => {
    if (!op || typeof op.run !== "function" || op._r42Guard) return op;
    const orig = op.run;
    op.run = function () {
      if (!anyLockSource()) return orig.apply(this, arguments);
      const snap = lockedRested();
      if (!snap.length) return orig.apply(this, arguments);
      const restore = () => snap.forEach(x => { if (!x.u.rested) { x.u.rested = true; x.u.attacksLeft = x.attacksLeft; } });
      const r = orig.apply(this, arguments);
      if (r && typeof r.then === "function") return r.then(v => { restore(); return v; }, e => { restore(); throw e; });
      restore();
      return r;
    };
    op._r42Guard = true;
    return op;
  };
  core.guardStandLock = guardOp;
  Object.keys(OPS).forEach(name => guardOp(OPS[name]));
  // [Double / Triple / Quadruple Attack] stand the card again after its attack: a locked card stays rested after its first attack.
  const prevBattleEnd = ABX.fireBattleEnd;
  ABX.fireBattleEnd = function (attSide, units) {
    try {
      if (ABX.standLockStopsMultiAttack) (units || []).forEach(x => { const u = x && x.unit; if (u && u.attacksLeft > 0 && standLocked(u, attSide)) { u.attacksLeft = 0; u.rested = true; } });
    } catch (e) { /* ignore */ }
    return prevBattleEnd.apply(this, arguments);
  };
})(typeof window !== "undefined" ? window : globalThis);
