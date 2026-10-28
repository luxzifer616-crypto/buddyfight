/* ==================== ABX — round 34: Dragon World, the last ones ====================
 * Built to ability_definitions_dragon_world.md:
 *  - #1254 a "Fist" item that would be destroyed goes to your hand instead (this card to the drop zone)
 *  - #1422 neither player can call a size 1 or less monster from the drop zone (ABX calls)
 *  - #2800 / #4253 [Counter] [Act] from the hand: discard this card, then its effect
 *  - #3994 a size 3 «Fire Dragon» of yours destroyed -> discard a «Fire Dragon» to call this card from the drop zone
 *  - #4237 buddy zone [Rest] -> [Penetrate] and infinite power · #6468 buddy in the buddy zone -> buddy critical+2
 *  - #4936 [Counterattack] (the game's [Counterattack] already hits every attacking card)
 *  - #5115 cannot be answered with [Counter] · #5597 option 2 (stored as an unread option) · #5800 dropped by the opponent
 *  - #6189 life 0 in stopped time · #6471 protections (the extra item slot is not in the game: see the shortcut below)
 * Loaded after abilities_r33.js.
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
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;
  const active = (u) => !!u && u.abxNullified !== B.turnCount;
  const onField = (side, id) => fieldUnits(F(side), true).some(x => x.unit.card && x.unit.card.id === id && active(x.unit)) || (F(side).setSpells || []).some(c => c.id === id);
  const once = (f, k) => { const S = core.st(f); if (S.onceTurn[k] === B.turnCount) return false; S.onceTurn[k] = B.turnCount; return true; };
  const ask = async (side, text) => auto(side) || !!(await ABX.ui.confirm({ title: "Ability", text }));

  /* ---- per-card readings ---- */
  const C = (op, extra) => Object.assign({ op }, extra || {});
  const OV = [
    [1254, /when an item with "fist" in its card name on your field would be destroyed/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "fist1254" })] })],
    [1422, /you and your opponent cannot call size 1 or less monsters from the drop zone/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "noDropCall1" })] })],
    [2800, /you may discard this hand card\. if you do, if your flag is "dragon zwei"/i, (ab) => ({ kind: ab.kind, steps: [C("r34DiscardSelf"), C("r34Zwei", { gate: "ifYouDo" })] })],
    [4253, /you may discard this hand card during an attack on your opponent's turn if you have three or more different world names/i, (ab) => ({ kind: ab.kind,
      conds: [{ t: "underAttack" }, { t: "xWorldNames", area: "drop", n: 3 }], steps: [C("r34DiscardSelf"), { op: "nullifyAttack", gate: "ifYouDo" }, C("r34AziDraw", { gate: "ifYouDo" })] })],
    [3994, /for this game, when a size 3 «fire dragon» monster on your field is destroyed/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "burn3994" })] })],
    [4237, /if the card in your buddy zone is in \[rest\], this card gets \[penetrate\], and its power becomes infinite/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "buddyRest4237" })] })],
    [6468, /if this card is in your buddy zone, for this turn, a buddy on your field gets critical\+2/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "buddy6468" })] })],
    [4936, /^this card \[counterattack\] all attacking monsters/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "caAll" })] })],
    [5115, /your opponent cannot \[counter\] against this card/i, (ab) => {
      const r = ABX.parseSentenceSteps("Destroy all cards on your opponent's field five times", { conds: [] });
      return r && r.steps.length && !r.unparsed.length ? { kind: ab.kind, steps: r.steps } : null;
    }],
    [5800, /when this card is dropped from your hand by your opponent's card effect/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "drop5800" })] })],
    [6189, /if your life becomes 0 in stopped time, you may drop this card from your hand/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "stopped6189" })] })],
    // shortcut: the game has one item slot, so "you may equip one additional item with "Jackknife"" is not playable; add a second slot to use it
    [6471, /all cards with "jackknife" in their card names on your field cannot have their abilities nullified/i, () => ({ kind: "static",
      steps: [{ op: "static", kind: "protect", np: core.parseNP ? core.parseNP('cards with "Jackknife" in their card names on your field') : ABX.parseNP('cards with "Jackknife" in their card names on your field'), kinds: ["nullified", "souls dropped", "rest"], byOpp: true }] })],
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
          if (o.conds) ab.conds = o.conds;
          break;
        }
        // #5597 option 2 (Round 14 keeps unread options in ab.unreadOptions)
        if (card.id === 5597 && ab.kind === "modal") {
          const fix = (o) => { if (/when a card is destroyed on your opponent's field, deal 2 damage/i.test(o.raw || o.cleaned || "")) { o.steps = [{ op: "r33OppDestroyDmg", n: 2 }]; o.unparsed = []; return true; } return false; };
          (ab.options || []).forEach(fix);
          if (ab.unreadOptions) { const ok = ab.unreadOptions.filter(fix); ab.options = (ab.options || []).concat(ok); ab.unreadOptions = ab.unreadOptions.filter(o => !ok.includes(o)); if (!ab.unreadOptions.length) delete ab.unreadOptions; }
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  const tagOn = (side, tag) => fieldUnits(F(side), true).filter(x => active(x.unit)).some(x => core.abilitiesOf(x.unit.card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0) ||
    (F(side).setSpells || []).some(c => core.abilitiesOf(c, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0);
  const hasTag = (card, tag) => !!card && core.abilitiesOf(card, a => a.r31 && (a.steps || []).some(s => s.tag === tag)).length > 0;

  /* ---- ops ---- */
  OPS.r34DiscardSelf = { run(s, ctx) { const f = ctx.f, i = ctx.card ? f.hand.indexOf(ctx.card.id) : -1; if (i < 0) return false; f.drop.push(f.hand.splice(i, 1)[0]); fresh(); return true; }, check: () => true };
  OPS.r34Zwei = {
    run(s, ctx) {
      const fc = cardOf(ctx.f.flagId), n = lc(fc && fc.name);
      if (/dragon zwei/.test(n) && OPS.shield) return OPS.shield.run({ op: "shield", mode: "next", reduceBy: 3, toZero: false, from: "any", duration: "turn" }, ctx);
      if (/dragon drei/.test(n)) { ctx.f.life += 2; fresh(); return true; }
      return false;
    },
    check: () => true
  };
  OPS.r34AziDraw = {
    run(s, ctx) {
      const f = ctx.f, has = fieldUnits(f, true).some(x => nameHas(x.unit.card, "Azi Dahaka")) || f.drop.some(id => nameHas(cardOf(id), "Azi Dahaka"));
      if (!has || !f.deck.length) return false;
      f.hand.push(f.deck.shift()); fresh(); return true;
    },
    check: () => true
  };

  /* ---- hooks ---- */
  // #1254: an own "Fist" item destroyed by an ABX effect goes to the hand; this card goes to the drop zone
  ["destroy"].forEach(op => {
    const orun = OPS[op] && OPS[op].run; if (!orun) return;
    OPS[op].run = async function (s, ctx) {
      const before = ["plr", "opp"].map(side => ({ side, it: F(side).item }));
      const r = await orun.apply(this, arguments);
      try {
        for (const { side, it } of before) {
          const f = F(side);
          if (!it || f.item === it || !nameHas(it.card, "Fist")) continue;
          const saver = fieldUnits(f, false).find(x => active(x.unit) && hasTag(x.unit.card, "fist1254"));
          if (!saver || !f.drop.includes(it.card.id) || !(await ask(side, `Put "${saver.unit.card.name}" into your drop zone to return "${it.card.name}" to your hand?`))) continue;
          const p = posOfUnit(f, saver.unit); if (p && p !== "item") { f.monsters[p] = null; f.drop.push(saver.unit.card.id, ...(saver.unit.soul || [])); }
          f.hand.push(f.drop.splice(f.drop.lastIndexOf(it.card.id), 1)[0]);
          fresh();
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  });
  // #1422: a size 1 or less monster called from a drop zone by an ABX effect is put back
  if (OPS.call && OPS.call.run) {
    const callRun = OPS.call.run;
    OPS.call.run = async function (s, ctx) {
      const lock = tagOn("plr", "noDropCall1") || tagOn("opp", "noDropCall1");
      const before = lock ? ["plr", "opp"].map(side => ({ side, units: new Set(fieldUnits(F(side), false).map(x => x.unit)), drop: F(side).drop.slice() })) : null;
      const r = await callRun.apply(this, arguments);
      if (lock) try {
        before.forEach(({ side, units, drop }) => {
          const f = F(side);
          fieldUnits(f, false).forEach(x => {
            const u = x.unit;
            if (units.has(u) || !drop.includes(u.card.id) || f.drop.includes(u.card.id)) return;
            const size = typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, u.card, u) : (u.card.size || 0);
            if (size <= 1) { f.monsters[x.pos] = null; f.drop.push(u.card.id); }
          });
        });
        fresh();
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (ABX.placeFromZone) {
    const pfz = ABX.placeFromZone;
    ABX.placeFromZone = function (side, area, id, opts) {
      const c = cardOf(id);
      if (area === "drop" && c && (c.size || 0) <= 1 && (tagOn("plr", "noDropCall1") || tagOn("opp", "noDropCall1"))) return Promise.resolve(null);
      return pfz.apply(this, arguments);
    };
  }
  // #3994: your size 3 «Fire Dragon» destroyed -> you may discard a «Fire Dragon» to call this card from your drop zone (free), once per turn
  if (typeof B.destroyMonster === "function") {
    const dm = B.destroyMonster;
    B.destroyMonster = function (side, pos) {
      const f = this.getFighter(side), m = f && f.monsters[pos];
      const size = m && (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(f, m.card, m) : m.card.size);
      const r = dm.apply(this, arguments);
      try {
        if (m && f.monsters[pos] !== m && r !== false && size === 3 && hasAttr(m.card, "Fire Dragon") && f.drop.includes(3994) && f.hand.some(id => hasAttr(cardOf(id), "Fire Dragon")) && once(f, "r34-3994")) {
          ABX.queue(async () => {
            if (!f.drop.includes(3994) || !(await ask(side, 'Discard a «Fire Dragon» to call "Burn Revival" from your drop zone?'))) return;
            const i = f.hand.findIndex(id => hasAttr(cardOf(id), "Fire Dragon")); if (i < 0) return;
            f.drop.push(f.hand.splice(i, 1)[0]);
            if (ABX.placeFromZone) await ABX.placeFromZone(side, "drop", 3994, { pay: false });
          });
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  // stats: #4237, #6468; [Counterattack]: #4936
  if (typeof root.getUnitEffectiveCombatStats === "function") {
    const gues = root.getUnitEffectiveCombatStats;
    root.getUnitEffectiveCombatStats = function (fighter, unit) {
      const r = gues.apply(this, arguments);
      try {
        if (!r || !unit || !unit.card || !fighter) return r;
        if (active(unit) && hasTag(unit.card, "buddyRest4237") && fighter.buddyZoneRested) { r.pen = true; r.power += 99999999; }
        if (fighter.buddyId === 6468 && !fieldUnits(fighter, true).some(x => x.unit.card.id === 6468) && B.phase === "attack" && B.activeSide === (fighter === B.plr ? "plr" : "opp") &&
          (unit.isBuddyGift || unit.card.id === fighter.buddyId)) r.crit = (r.crit || 0) + 2;
      } catch (e) { /* ignore */ }
      return r;
    };
  }
  if (ABX.staticBonus) {
    const sb = ABX.staticBonus;
    ABX.staticBonus = function (fighter, unit) { const out = sb.apply(this, arguments); try { if (out && unit && active(unit) && hasTag(unit.card, "caAll")) out.ca = true; } catch (e) { /* ignore */ } return out; };
  }
  // #5115: the opponent can't answer it with [Counter]
  if (ABX.castUnnullifiable) { const cu = ABX.castUnnullifiable; ABX.castUnnullifiable = function (card) { return (card && card.id === 5115) || cu.apply(this, arguments); }; }
  if (ABX.castWindow) { const cw = ABX.castWindow; ABX.castWindow = function (casterSide, card) { if (card && card.id === 5115) return Promise.resolve(false); return cw.apply(this, arguments); }; }
  // #5800: dropped from your hand by your opponent's effect -> draw 2; your hand can't be dropped by them this turn
  if (OPS.oppDiscard && OPS.oppDiscard.run) {
    const od = OPS.oppDiscard.run;
    OPS.oppDiscard.run = async function (s, ctx) {
      const tgt = otherSide(ctx.side), e = F(tgt);
      if (e.abxHandSafe === B.turnCount) return false;
      const had = e.hand.filter(id => id === 5800).length;
      const r = await od.apply(this, arguments);
      try {
        if (e.hand.filter(id => id === 5800).length < had && e.drop.includes(5800)) {
          for (let i = 0; i < 2 && e.deck.length; i++) e.hand.push(e.deck.shift());
          e.abxHandSafe = B.turnCount; fresh();
        }
      } catch (e2) { /* ignore */ }
      return r;
    };
  }
  // #6189: your life becomes 0 while your time is stopped -> you may drop this card from your hand: life 1, 5 unreducible damage
  if (typeof B.checkWinCondition === "function") {
    const cwc = B.checkWinCondition;
    B.checkWinCondition = function () {
      try {
        ["plr", "opp"].forEach(side => {
          const f = F(side);
          if (this.matchOver || !f || f.life > 0 || !(f.timeStoppedThisTurn || f.timeStoppedThisBattle)) return;
          const i = f.hand.indexOf(6189); if (i < 0) return;
          const yes = auto(side) ? true : (typeof root.confirm === "function" ? root.confirm('Drop this card to make your life 1 and deal 5 damage?') : false);   // shortcut: the browser's own yes/no box
          if (!yes) return;
          f.drop.push(f.hand.splice(i, 1)[0]); f.life = 1;
          core.applyDamage(otherSide(side), 5, { kind: "effect", unreducible: true, card: cardOf(6189) });
        });
      } catch (e) { /* ignore */ }
      return cwc.apply(this, arguments);
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
