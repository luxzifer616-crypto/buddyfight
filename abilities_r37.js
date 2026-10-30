/* ==================== ABX — round 37: "Infinity the Chaos" and more than one item ====================
 * 1. "Infinity the Chaos" (#3941) as a second flag: with "The Chaos" (#3337) as your flag it starts face down under it,
 *    and "The Chaos Upgrade" (#4072) is put into your deck. Casting the Upgrade (10+ cards in your drop zone) flips it
 *    face up on top: your flag becomes "Infinity the Chaos" and your size limit becomes infinite (1e9, shown as ∞).
 *    Both flags: size 30+ monsters on your field can't be destroyed or have abilities nullified by effects.
 * 2. More than one item (game.js hasMultiItems / "item2"): #3728 (on your field) and #6512 (in your buddy zone) also
 *    stop you putting monsters on the field; #3728's +1 gauge [Equip Cost]; the [Overkill]s of #3728, #6512, #4115.
 * Loaded after abilities_r36.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const hasAttr = (c, a) => !!c && (c.attrs || []).some(x => lc(x).replace(/\s+/g, "") === lc(a).replace(/\s+/g, ""));
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };
  const INFINITE = 1e9;   // not Infinity: the state is sent as JSON to an online opponent

  /* ---- 1. "Infinity the Chaos" under "The Chaos" ---- */
  if (typeof B.createFighterState === "function") {
    const cfs = B.createFighterState;
    B.createFighterState = function (name, deckDef) {
      const f = cfs.apply(this, arguments);
      try {
        if (f && f.flagId === 3337) {
          f.flagUnder = deckDef && deckDef.infinityChaos ? [3941] : [];   // only when unlocked in the deck; never part of the play deck
        }
      } catch (e) { /* ignore */ }
      return f;
    };
  }
  OPS.r37ChaosUpgrade = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.drop.length < 10) return false;
      const i = (f.flagUnder || []).indexOf(3941);
      if (i < 0) return false;   // not unlocked / already flipped
      if (i >= 0) {
        f.flagUnder.splice(i, 1);
        f.flagBefore = f.flagId; f.flagId = 3941; f.maxSize = INFINITE;
        const infCard = Object.assign({}, cardOf(3941), {
          id: 3941,
          type: "Flag",
          power: 15000,
          crit: 2,
          defense: 5000,
          atk_max: 1
        });
        f.flagCard = infCard;
        f.chaosUpgradeActive = true;
        if (!f.item) {
          f.item = {
            card: infCard,
            cardId: 3941,
            rested: false,
            attacksLeft: 1,
            soul: [],
            isFlagUnit: true,
            isEndrulerFlag: true,
            cannotLeaveField: true,
            cannotNullify: true,
            canAttackWithCenter: true
          };
        }
        try { B.showCutin("INFINITY THE CHAOS!", "Your flag is now \"Infinity the Chaos\" — size limit ∞", cardOf(3941).img); } catch (e) { /* ignore */ }
      }
      const gear = f.deck.map((id, idx) => ({ k: "zone", side: ctx.side, area: "deck", idx, id, card: cardOf(id) })).filter(r => r.card && lc(r.card.name).includes("geargod"));
      const ch = gear.length ? (await core.pick(gear, { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — a "Geargod" card` })) || [] : [];
      ch.forEach(r => { const j = f.deck.indexOf(r.id); if (j >= 0) f.hand.push(f.deck.splice(j, 1)[0]); });
      shuffle(f.deck);
      fresh(); return true;
    },
    check: () => true
  };
  // size 30+ monsters and "Infinity the Chaos" (#3941) can't be destroyed / nullified by effects under either Chaos flag
  const ipPrev = core.isProtected;
  core.isProtected = function (unit, side, kind, ctx) {
    if (ipPrev.apply(this, arguments)) return true;
    try {
      if (unit && (unit.isFlagUnit || (unit.card && Number(unit.card.id) === 3941) || Number(unit.cardId) === 3941)) return true;
      const f = F(side);
      if ((kind === "destroyed" || kind === "nullified") && (f.flagId === 3337 || f.flagId === 3941) && unit && unit.card) {
        const size = typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, unit.card, unit) : (unit.card.size || 0);
        if (size >= 30) return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  };

  /* ---- 2. more than one item ---- */
  const noMonsters = (f) => [f.item, f.item2].some(u => u && u.card && u.card.id === 3728) || (f.buddyId === 6512 && ![f.item, f.item2].some(u => u && u.card && u.card.id === 6512));
  if (typeof B.completeMonsterCall === "function") {
    const cmc = B.completeMonsterCall;
    B.completeMonsterCall = function (side) {
      const f = this.getFighter(side);
      if (noMonsters(f)) { if (!f.isBot) { this.pendingAction = null; this.setPrompt("You cannot put monsters on the field (\"Laevateinn\")."); this.renderBattle(); } return; }
      return cmc.apply(this, arguments);
    };
  }
  if (ABX.placeFromZone) { const pfz = ABX.placeFromZone; ABX.placeFromZone = function (side) { if (noMonsters(F(side))) return Promise.resolve(null); return pfz.apply(this, arguments); }; }
  // #3728: items in your hand cost 1 more gauge to equip
  if (typeof root.parseCardCost === "function") {
    const pcc = root.parseCardCost;
    root.parseCardCost = function (costStr, skill, fighter, card) {
      const r = pcc.apply(this, arguments);
      try { if (r && fighter && card && card.type === "Item" && [fighter.item, fighter.item2].some(u => u && u.card && u.card.id === 3728) && fighter.hand.includes(card.id)) return Object.assign({}, r, { gauge: (r.gauge || 0) + 1 }); } catch (e) { /* ignore */ }
      return r;
    };
  }
  // put `id` (from `area`) into an item slot: the empty one, the second one while more than one item is allowed, else replace
  function equipFrom(side, area, id, pay) {
    const f = F(side), c = cardOf(id); if (!c) return false;
    if (pay) {
      const cost = root.parseCardCost ? root.parseCardCost(c.cost, c.skill, f, c) : { gauge: 0, life: 0 };
      if (f.gauge.length < (cost.gauge || 0) || (cost.life > 0 && f.life <= cost.life)) return false;
      for (let i = 0; i < (cost.gauge || 0); i++) f.drop.push(f.gauge.pop());
      if (cost.life > 0) f.life -= cost.life;
    }
    const i = f[area].indexOf(id); if (i < 0) return false;
    f[area].splice(i, 1);
    const unit = { card: c, rested: false, attacksLeft: c.atk_max || 1, soul: [], itemMode: "equip" };
    if (typeof root.addEquippedItemToFighter === "function" && typeof root.getMaxAllowedItems === "function" && typeof root.getEquippedItems === "function") {
      const eqCount = root.getEquippedItems(f).length;
      const maxAllowed = root.getMaxAllowedItems(f, c);
      if (f.item && !f.item.isEndrulerFlag && eqCount >= maxAllowed) {
        f.drop.push(...(f.item.soul || []), f.item.card.id);
        f.item = unit;
      } else {
        root.addEquippedItemToFighter(f, unit, c);
      }
    } else if (!f.item || f.item.isEndrulerFlag) f.item = unit;
    else if (!f.item2 && typeof hasMultiItems === "function" && hasMultiItems(f, c)) f.item2 = unit;
    else { f.drop.push(...(f.item.soul || []), f.item.card.id); f.item = unit; }
    try { if (ABX.fireEquipped) ABX.fireEquipped(side, c, unit); } catch (e) { /* ignore */ }
    return true;
  }
  ABX.equipFrom = equipFrom;
  const slotsFree = (f) => (typeof root.getMaxAllowedItems === "function" ? root.getMaxAllowedItems(f) : (typeof hasMultiItems === "function" && hasMultiItems(f) ? 2 : 1));
  async function equipSome(ctx, area, pred, max, pay, title) {
    const f = ctx.f;
    const cands = f[area].map((id, idx) => ({ k: "zone", side: ctx.side, area, idx, id, card: cardOf(id) })).filter(r => r.card && r.card.type === "Item" && pred(r.card));
    const ch = cands.length ? (await core.pick(cands, { qty: { n: Math.min(max, cands.length), upTo: true } }, ctx, { intent: "help", title })) || [] : [];
    let n = 0; for (const r of ch) if (equipFrom(ctx.side, area, r.id, pay)) n++;
    return n;
  }
  OPS.r37Overkill3728 = {
    async run(s, ctx) {
      const f = ctx.f; f.drop.push(...f.deck.splice(0, 5));
      // shortcut: "up to three" is capped by the item slots the game has (two)
      await equipSome(ctx, "drop", () => true, Math.min(3, slotsFree(f)), false, `${ctx.card.name} — equip items from among them`);
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r37Overkill6512 = {
    async run(s, ctx) {
      const f = ctx.f; if (f.gauge.length < 1 || !f.hand.length) return false;
      f.drop.push(f.gauge.pop());
      const d = (await core.pick(f.hand.map((id, idx) => ({ k: "zone", side: ctx.side, area: "hand", idx, id, card: cardOf(id) })), { qty: { n: 1 } }, ctx, { intent: "cost", title: `${ctx.card.name} — drop a hand card` })) || [];
      d.forEach(r => { const i = f.hand.indexOf(r.id); if (i >= 0) f.drop.push(f.hand.splice(i, 1)[0]); });
      f.drop.push(...f.deck.splice(0, 7));
      await equipSome(ctx, "drop", c => hasAttr(c, "Hero"), slotsFree(f), false, `${ctx.card.name} — equip «Hero» items`);
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r37Overkill4115 = {
    async run(s, ctx) {
      const f = ctx.f; if (!f.hand.length) return false;
      const d = (await core.pick(f.hand.map((id, idx) => ({ k: "zone", side: ctx.side, area: "hand", idx, id, card: cardOf(id) })).filter(r => r.card !== ctx.card), { qty: { n: 1 } }, ctx, { intent: "cost", title: `${ctx.card.name} — discard a card` })) || [];
      if (!d[0]) return false;
      f.drop.push(f.hand.splice(f.hand.indexOf(d[0].id), 1)[0]);
      await equipSome(ctx, "deck", () => true, Math.min(2, slotsFree(f)), true, `${ctx.card.name} — equip up to two items`);
      shuffle(f.deck); fresh(); return true;
    },
    check: () => true
  };

  /* ---- 3. per-card readings ---- */
  const C = (op, extra) => Object.assign({ op }, extra || {});
  const OV = [
    [4072, /put up to one face down card from under your flag face up on top of your flag/i, (ab) => ({ kind: ab.kind, steps: [C("r37ChaosUpgrade")] })],
    [3941, /^before the game, put one "infinity the chaos" face down under "the chaos"/i, () => ({ kind: "rule", steps: [] })],   // done when the fighter is set up
    [3941, /^you may use «chaos» cards, and put monsters up to a total size of infinity/i, () => ({ kind: "rule", steps: [] })],   // done when it is flipped
    [3941, /^all size 30 or greater monsters on your field cannot be destroyed/i, () => ({ kind: "rule", steps: [] })],          // core.isProtected above
    [3728, /you cannot put monsters on the field, and you may equip any number of items/i, () => ({ kind: "static", steps: [{ op: "static", kind: "protect", kinds: ["destroyed"], self: true }] })],
    [3728, /all items in your hand get an additional "\[equip cost\] \[pay 1 gauge\]"/i, () => ({ kind: "rule", steps: [] })],   // parseCardCost above
    [3728, /put the top five cards of your deck into the drop zone, and equip up to three items/i, () => ({ kind: "act", tags: ["kw:overkill", "act"], once: "game", steps: [C("r37Overkill3728")] })],
    [6512, /if this card is in your buddy zone, you cannot put monsters on the field, and you may equip any number of items/i, () => ({ kind: "rule", steps: [] })],
    [6512, /equip any number of «hero» items from your drop zone without paying/i, () => ({ kind: "act", tags: ["kw:overkill", "act"], once: "game", steps: [C("r37Overkill6512")] })],
    [4115, /equip up to two items from your deck by paying their \[equip cost\]/i, () => ({ kind: "act", tags: ["kw:overkill", "act"], once: "game", steps: [C("r37Overkill4115")] })],
  ];
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        const full = String(ab.raw || "");
        for (const [id, re, build] of OV) {
          if (card.id !== id || !(re.test(raw) || re.test(full))) continue;
          const o = build(ab); if (!o) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.r31 = true; ab.parsed = true;
          if (o.once) ab.once = o.once;
          break;
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
