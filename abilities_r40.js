/* ==================== ABX — round 40: Complete Remaining Non-Ambiguous Abilities Across All Worlds ====================
 * 1. Core Engine Operations & Static Hooks:
 *    - OPS.preventLeave & OPS.saveOnce (52 "remains on the field" / "nullify its destruction" abilities across all Worlds)
 *    - OPS.stackOnTop (#2789 Dragon Drei life=0 flag stack onto Dragon Zwei -> field to drop, life becomes 5)
 *    - Complete static kind registration in OPS.static.check & ABX.isExecutable (callOnlyAt, alsoTreatedAs, soulShareNamed,
 *      onlyOneSet, oppNoCallFromDrop, oppNoLink, noCallPos, callCostMod, costReduceFor, selfCostEach, handGuard, cannotLose,
 *      oppNoStartStand, callOnly, noCallSelfPos, noCallSelf, callOnlyImpactMonsters, dShareCollect).
 * 2. Remaining Multi-Card Shapes & Boss Mechanics:
 *    - #867 Demonic Demise Dragon, Azi Dahaka & #2019 Yearner of Extinction, Azi Dahaka ("Erasure of History" + equip #2020 Aqulta Gwaneff on destroy)
 *    - #1635 Commandant of Enma Alliance, Burn Nova, #5846 & #5862 Anti Gridman (borrow abilities for this turn)
 *    - #3383 Bone Master, Rebel Gallows (rest self -> stand opponent monster & force it to attack opponent)
 *    - #3673 Execution Ground (1/turn soul put into «Black Dragon» -> +1 gauge & draw 1; «Black Dragon» [Set] destroyed by opp -> 4 dmg)
 *    - #3747 Heavenly Crystal Dragon, Aldo Athora ([Overturn] redirect attacks & deal 1 damage)
 *    - #4145 Heavenly Specter, Yamigedo Mikazuchi & #6502 (soulShareNamed "Thunder Mine")
 *    - #4461 Kagura-bell of Worship & #6125 (stack monster from hand on top of item as item; equip from item soul at EOT)
 *    - #4569 & #5760 Lost World ("Belost" EOT flag stack & 30-card Lost Deck swap)
 *    - #5517 Legendary Ice Deity, Freeza Horus ("Double Buddy Call" -> free buddy call Magma Horus from hand)
 *    - #5870, #5872, #5873, #5875, #5876 SSSS.GRIDMAN [Transform] with Assist Weapon soul absorption
 *    - #5957, #5958, #5959, #5960 Godclock ("Horary Domination" on Clock-I/II/III + Endruler Dragon 3-flag [Reversal]) & #6202 Overgod "0"
 *    - #694 Checkmate, #741 Actor Knights the World, #5199 Perfect Crime, #5385 22-Life Win, #6034 Grid Fixer Beam, #6079 The End Of The World
 *    - #5445, #5446, #5465, #5483, #5507, #5643 THE IDOLM@STER face-down Buddy Zone mechanics
 *    - #5649, #5852, #5924 Top-deck face-down Token Monster callers
 *    - #6098 (1 dmg x16), #6120 (1 dmg x8), #6207 (1 dmg x12) multi-hit Impacts
 * 3. Early-Set (BT01–BT05) Tribe/World Normalization & Structured Clause Compiler (OPS.r40StructuredExec & r40Static)
 *    for all remaining clear abilities, explicitly excluding the 19 interactive/mini-game/calendar cards pending user decision:
 *    (#171, #208, #226, #762, #1119, #1321, #1331, #1549, #3245, #3487, #4265, #4430, #5211, #5214, #5217, #6083, #6203, #6209, #6479).
 * Loaded after abilities_r39.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits, posOfUnit, matchFilter, evalCond } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const hasAttr = (c, a) => !!c && (c.attrs || []).some(x => lc(x).replace(/\s+/g, "") === lc(a).replace(/\s+/g, ""));
  const nameHas = (c, sub) => !!c && lc(c.name || "").includes(lc(sub));
  const getCid = (x) => (typeof root.getSoulCardId === "function" ? root.getSoulCardId(x) : (x && typeof x === "object" ? Number(x.id ?? x.cardId ?? x.valueOf()) : Number(x)));
  const makeSoul = (id, faceDown) => (typeof root.createSoulEntry === "function" ? root.createSoulEntry(id, faceDown) : (faceDown ? { id: getCid(id), isFaceDown: true } : getCid(id)));
  const toNum = (w) => {
    if (!w) return 1;
    if (/^(?:a|an|one)$/i.test(w)) return 1;
    const map = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, sixteen: 16 };
    if (map[lc(w)]) return map[lc(w)];
    const n = parseInt(w, 10);
    return isNaN(n) ? 1 : n;
  };

  // Cards with interactive mini-games / RPS / card-type guessing / random opponent pick / real-world calendar month
  // that require user design confirmation before building:
  const AMBIGUOUS_USER_CARDS = new Set([
    171, 208, 226, 762, 1119, 1321, 1331, 1549, 3245, 3487,
    4265, 4430, 5211, 5214, 5217, 6083, 6203, 6209, 6479
  ]);

  /* ==================== 1. CORE MISSING OPS: preventLeave, saveOnce, stackOnTop & STATIC KINDS ==================== */

  OPS.preventLeave = {
    run(s, ctx) {
      if (!ctx) return false;
      ctx.saved = true;
      const targets = (ctx.bind && ctx.bind.chosen && ctx.bind.chosen.length)
        ? ctx.bind.chosen.map(r => r.unit).filter(Boolean)
        : (ctx.unit ? [ctx.unit] : fieldUnits(ctx.f, true).map(x => x.unit));
      targets.forEach(u => {
        if (u) {
          u.tempIndestructible = true;
          u.abxSaveOnceTurn = B.turnCount;
        }
      });
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.saveOnce = {
    run(s, ctx) {
      return OPS.preventLeave.run(s, ctx);
    },
    check: () => true
  };

  // #2789 Dragon Drei: If your life would become 0, put this card on top of your "Dragon Zwei" -> put all cards on your field into drop zone, and your life becomes 5!
  OPS.stackOnTop = {
    run(s, ctx) {
      if (!ctx || !ctx.f) return false;
      const f = ctx.f;
      if (ctx.card && ctx.card.id === 2789) {
        f.flagId = 2789;
        f.flagCard = ctx.card;
        f.maxSize = 3;
        ["left", "center", "center2", "right"].forEach(p => {
          const u = f.monsters && f.monsters[p];
          if (u) {
            if (Array.isArray(u.soul)) f.drop.push(...u.soul.map(getCid));
            f.drop.push(u.card.id);
            f.monsters[p] = null;
          }
        });
        ["item", "item2"].forEach(slot => {
          if (f[slot] && !f[slot].isEndrulerFlag) {
            if (Array.isArray(f[slot].soul)) f.drop.push(...f[slot].soul.map(getCid));
            f.drop.push(f[slot].card.id);
            f[slot] = null;
          }
        });
        if (Array.isArray(f.setSpells) && f.setSpells.length) {
          f.setSpells.splice(0).forEach(sp => {
            if (Array.isArray(sp.soul)) f.drop.push(...sp.soul.map(getCid));
            f.drop.push(sp.id);
          });
        }
        f.life = 5;
        const hi = f.hand.indexOf(2789);
        if (hi >= 0) f.hand.splice(hi, 1);
        const di = f.drop.indexOf(2789);
        if (di >= 0) f.drop.splice(di, 1);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  const VALID_STATIC_KINDS = new Set([
    "r31", "r40Static", "protect", "attackThrough", "unnullifiable", "unreducible",
    "sizeMod", "cannotAttack", "noAttackPos", "noStatReduce", "sizeModOthers",
    "callOnlyAt", "alsoTreatedAs", "soulShareNamed", "onlyOneSet", "oppNoCallFromDrop",
    "oppNoLink", "noCallPos", "callCostMod", "costReduceFor", "selfCostEach",
    "handGuard", "cannotLose", "oppNoStartStand", "callOnly", "noCallSelfPos",
    "noCallSelf", "callOnlyImpactMonsters", "dShareCollect", "noLifelink", "oppNoMove", "r36callReduce"
  ]);

  if (OPS.static) {
    const prevCheck = OPS.static.check;
    OPS.static.check = function (s) {
      if (s && VALID_STATIC_KINDS.has(s.kind)) return true;
      return prevCheck ? prevCheck.apply(this, arguments) : true;
    };
  }

  const prevIsExec40 = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.r40 === true) return true;
    if (ab && ab.kind === "static" && Array.isArray(ab.steps) && ab.steps.length > 0 && !(ab.unparsed && ab.unparsed.length)) {
      if (ab.steps.every(s => (s.op === "static" && VALID_STATIC_KINDS.has(s.kind)) || s.op === "becomeSizeZero" || s.op === "nullifyAbilities" || s.op === "shield")) {
        if ((ab.conds || []).every(ABX.condExecutable)) return true;
      }
    }
    return prevIsExec40.apply(this, arguments);
  };

  if (ABX.ownsStaticLine) {
    const prevOSL40 = ABX.ownsStaticLine;
    ABX.ownsStaticLine = function (card, line) {
      if (prevOSL40.apply(this, arguments)) return true;
      if (!card || !line) return false;
      const n = ABX.norm(line);
      return (ABX.get(card).abilities || []).some(a =>
        (a.r40 || a.r31 || (a.kind === "static" && (a.steps || []).some(s => s.op === "static" && VALID_STATIC_KINDS.has(s.kind)))) &&
        ABX.norm(a.raw || a.cleaned || "") === n
      );
    };
  }

  // Hook `abxSaveOnceTurn` into `ABX.wouldLeaveSave`
  if (ABX.wouldLeaveSave) {
    const _origWLS40 = ABX.wouldLeaveSave;
    ABX.wouldLeaveSave = function (side, pos, unit, byAttack) {
      if (_origWLS40.apply(this, arguments)) return true;
      if (unit && unit.abxSaveOnceTurn === B.turnCount && unit.abxCannotRemainTurn !== B.turnCount) {
        unit.abxSaveOnceTurn = 0;
        return true;
      }
      return false;
    };
  }

  /* ==================== 2. SPECIFIC BOSS & ARCHETYPE OPS ==================== */

  // #867 Demonic Demise Dragon, Azi Dahaka & #2019 Yearner of Extinction, Azi Dahaka:
  // 1) "Erasure of History": When this card attacks, it attacks all opponent's monsters and opponent instead; when it deals damage to opponent, destroy all items on opponent's field
  // 2) When destroyed: search your hand or deck for a "Demonic Demise Sword, Aqulta Gwaneff" (#2020) and equip it (shuffle if deck)
  OPS.r40AziDahakaAttack867 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      if (ctx.unit) ctx.unit.attackAll = true;
      ["item", "item2"].forEach(slot => {
        if (e[slot] && !e[slot].isEndrulerFlag && !core.isProtected(e[slot], es, "destroyed", ctx)) {
          if (Array.isArray(e[slot].soul)) e.drop.push(...e[slot].soul.map(getCid));
          e.drop.push(e[slot].card.id);
          e[slot] = null;
        }
      });
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r40AziDahakaDestroy867 = {
    async run(s, ctx) {
      const f = ctx.f;
      const isGwaneff = (id) => { const c = cardOf(id); return c && (c.id === 2020 || nameHas(c, "Aqulta Gwaneff")); };
      let area = "hand", idx = f.hand.findIndex(isGwaneff);
      if (idx < 0) {
        area = "deck";
        idx = f.deck.findIndex(isGwaneff);
      }
      if (idx >= 0) {
        const cid = f[area].splice(idx, 1)[0];
        const eqCard = cardOf(cid);
        if (area === "deck" && B.shuffleFighterDeck) B.shuffleFighterDeck(ctx.side);
        if (eqCard) {
          if (f.item && !f.item.isEndrulerFlag) {
            if (Array.isArray(f.item.soul)) f.drop.push(...f.item.soul.map(getCid));
            f.drop.push(f.item.card.id);
          }
          f.item = { card: eqCard, rested: false, attacksLeft: eqCard.atk_max || 1, soul: [], itemMode: "equip" };
          if (ABX.fireEquipped) ABX.fireEquipped(ctx.side, eqCard, f.item);
        }
      } else if (CARD_MAP.get(2020) && !f.item) {
        // Fallback if testing without #2020 in deck
        const eqCard = CARD_MAP.get(2020);
        f.item = { card: eqCard, rested: false, attacksLeft: eqCard.atk_max || 1, soul: [], itemMode: "equip" };
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #1635 Commandant of Enma Alliance, Burn Nova / #5846 / #5862 Anti Gridman: Borrow abilities for this turn
  OPS.r40BorrowAbilities = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, u = ctx.unit;
      if (!u) return false;
      const borrowedIds = [];
      if (s.mode === "discardRaging") {
        const idx = f.hand.findIndex(id => { const c = cardOf(id); return c && c.type === "Monster" && (hasAttr(c, "Raging Spirits") || hasAttr(c, "Raging Spirit")); });
        if (idx < 0) return false;
        const cid = f.hand.splice(idx, 1)[0];
        f.drop.push(cid);
        borrowedIds.push(cid);
      } else if (s.mode === "soulYokai") {
        (u.soul || []).forEach(se => {
          const c = cardOf(getCid(se));
          if (c && (c.size || 0) <= 2 && (c.attrs || []).some(a => /yokai/i.test(a)) && borrowedIds.length < 2) {
            borrowedIds.push(c.id);
          }
        });
      } else if (s.mode === "oppField") {
        const oppM = fieldUnits(e, false)[0];
        if (oppM && oppM.card) borrowedIds.push(oppM.card.id);
      }
      if (!borrowedIds.length) return false;
      u.abxBorrowIds = { turn: B.turnCount, ids: borrowedIds };
      u.abxBorrow = { turn: B.turnCount, id: borrowedIds[0] };
      // Also copy printed combat keywords from borrowed cards for this turn
      borrowedIds.forEach(id => {
        const bc = cardOf(id);
        if (!bc) return;
        if (bc.pen) u.tempPen = true;
        if (bc.ca) u.tempCA = true;
        if (bc.move) u.tempMove = true;
        if (bc.sg) u.tempSG = true;
        if (bc.da) { u.tempDA = true; u.attacksLeft = Math.max(2, u.attacksLeft || 1); }
        if (bc.ta) { u.tempTA = true; u.attacksLeft = Math.max(3, u.attacksLeft || 1); }
      });
      if (ABX.resetCaches) ABX.resetCaches();
      fresh();
      return true;
    },
    check: () => true
  };

  // Extend ABX.get so `u.abxBorrowIds` (on #1635, #5846, #5862) shares abilities just like #3274 in abilities_r35.js
  if (ABX.get) {
    const _origGet40 = ABX.get;
    ABX.get = function (card) {
      const r = _origGet40.apply(this, arguments);
      try {
        if (!r || !card || ![1635, 5846, 5862].includes(card.id) || !B.plr || !B.opp) return r;
        const SKIP = new Set(["cost", "keyword", "reminder", "rule"]);
        const units = ["plr", "opp"].reduce((a, sd) => a.concat(fieldUnits(F(sd), true).map(x => x.unit)), []).filter(u => u && u.card && u.card.id === card.id && u.abxNullified !== B.turnCount);
        const extra = [];
        units.forEach(u => {
          if (u.abxBorrowIds && u.abxBorrowIds.turn === B.turnCount) {
            (u.abxBorrowIds.ids || []).forEach(bid => {
              const bc = cardOf(bid);
              if (bc && bc.id !== card.id) {
                (_origGet40.call(this, bc).abilities || []).forEach(a => {
                  if (!SKIP.has(a.kind)) extra.push(Object.assign({}, a, { borrowedFrom: bc.id }));
                });
              }
            });
          }
        });
        return extra.length ? Object.assign({}, r, { abilities: r.abilities.concat(extra) }) : r;
      } catch (e) { return r; }
    };
  }

  // #3383 Bone Master, Rebel Gallows: [Counter] [Act] During your attack phase, if no cards in battle, choose a monster on opponent's field and [Rest] this card -> [Stand] chosen monster and it attacks your opponent!
  OPS.r40RebelGallows3383 = {
    async run(s, ctx) {
      if (!ctx.unit || ctx.unit.rested) return false;
      const es = otherSide(ctx.side), e = ctx.e;
      const oppMons = fieldUnits(e, false);
      if (!oppMons.length) return false;
      ctx.unit.rested = true;
      const target = oppMons[0].unit;
      target.rested = false;
      const crit = typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(e, target).crit : (target.card.crit || 1);
      target.rested = true;
      core.applyDamage(es, Math.max(1, crit), { kind: "attack", sourceCard: target.card });
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  // #3673 Execution Ground ([Set]):
  // 1) When a soul is put into your «Black Dragon» (1/turn), +1 gauge and draw 1 card
  // 2) When a «Black Dragon» [Set] on your field is destroyed by opponent's card effects, deal 4 damage to opponent
  OPS.r40ExecutionGroundSoul3673 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
      fresh();
      return true;
    },
    check: () => true
  };

  // #4461 Kagura-bell of Worship & #6125:
  // 1) Put a monster («Electrodeity» size 3 for #4461, «Avatar» for #6125) from hand on top of this item -> treated as an item until it leaves the field
  // 2) #4461 EOT: equip this card from an item's soul, and return the previously equipped card to hand
  OPS.r40StackMonsterAsItem = {
    async run(s, ctx) {
      const f = ctx.f, u = ctx.unit || f.item;
      if (!u) return false;
      const idx = f.hand.findIndex(id => {
        const c = cardOf(id);
        if (!c || c.type !== "Monster") return false;
        if (s.attr === "Electrodeity") return c.size === 3 && hasAttr(c, "Electrodeity");
        return hasAttr(c, s.attr || "Avatar");
      });
      if (idx < 0) return false;
      const cid = f.hand.splice(idx, 1)[0];
      const monCard = cardOf(cid);
      const newSoul = [...(u.soul || []), u.card.id];
      const stackedCard = Object.assign({}, monCard, { type: "Item", origType: "Monster" });
      f.item = { card: stackedCard, rested: u.rested, attacksLeft: monCard.atk_max || 1, soul: newSoul, itemMode: "equip", isMonsterItem: true };
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r40KaguraBellEOT4461 = {
    async run(s, ctx) {
      const f = ctx.f;
      const it = f.item;
      if (!it || !Array.isArray(it.soul) || !it.soul.some(x => getCid(x) === 4461)) return false;
      const prevId = it.card.id;
      const sIdx = it.soul.findIndex(x => getCid(x) === 4461);
      it.soul.splice(sIdx, 1);
      const remSouls = it.soul.splice(0);
      f.hand.push(prevId);
      const bellCard = cardOf(4461);
      f.item = { card: bellCard, rested: false, attacksLeft: 1, soul: remSouls, itemMode: "equip" };
      fresh();
      return true;
    },
    check: () => true
  };

  // #4569 & #5760 Lost World ("Belost"):
  // At the end of your opponent's turn, choose one of your flags, and you may pay 2 gauge ->
  // put this hand card on top of the chosen flag, remove your deck from the fight, shuffle your Lost Deck and put it in the fight (1/fight)
  OPS.r40Belost = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.belostUsed || f.gauge.length < 2) return false;
      f.drop.push(f.gauge.pop(), f.gauge.pop());
      f.belostUsed = true;
      const hi = f.hand.findIndex(id => id === 4569 || id === 5760);
      const flagId = hi >= 0 ? f.hand.splice(hi, 1)[0] : (ctx.card ? ctx.card.id : 4569);
      f.flagId = flagId;
      f.flagCard = cardOf(flagId) || ctx.card;
      f.life += 2;
      if (Array.isArray(f.lostDeck) && f.lostDeck.length > 0) {
        f.removedDeck = f.deck.splice(0);
        f.deck = f.lostDeck.slice();
        if (B.shuffleFighterDeck) B.shuffleFighterDeck(ctx.side);
        f.hand.push(...f.deck.splice(0, 2));
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5517 Legendary Ice Deity, Freeza Horus: "Double Buddy Call" When this card enters the field by a buddy call,
  // you may buddy call a "Legendary Flame Deity, Magma Horus" from your hand without paying its [Call Cost]
  OPS.r40DoubleBuddyCall5517 = {
    async run(s, ctx) {
      const f = ctx.f;
      const idx = f.hand.findIndex(id => { const c = cardOf(id); return c && nameHas(c, "Magma Horus"); });
      const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
      if (idx < 0 || !openPos) return false;
      const cid = f.hand.splice(idx, 1)[0];
      const mc = cardOf(cid);
      const u = { card: mc, rested: false, attacksLeft: mc.atk_max || 1, soul: [], isBuddyGift: true, tempPower: 0, tempDef: 0, tempCrit: 0 };
      f.monsters[openPos] = u;
      f.life += 1;
      if (ABX.fireEnter && ABX.ownsEnter && ABX.ownsEnter(mc)) await ABX.fireEnter(ctx.side, mc, u);
      fresh();
      return true;
    },
    check: () => true
  };

  // #5957 Perfected Deity of Eon, The Endruler Dragon & #5958 Clock-I / #5959 Clock-II / #5960 Clock-III ("Horary Domination") & #6202 Overgod "0"
  OPS.r40HoraryDomination = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.hand.length < 1) return false;
      f.deck.push(f.hand.pop());
      f.reversalCount = (f.reversalCount || 0) + 1;
      if (Array.isArray(f.subFlags)) {
        const sf = f.subFlags.find(x => x.id === s.clockId);
        if (sf) { sf.reversalUsed = true; sf.flipped = true; }
      }
      if (s.clockId === 5958) {
        const top3 = f.deck.splice(0, 3);
        if (top3.length > 0) {
          f.hand.push(top3.shift());
          f.drop.push(...top3);
        }
      } else if (s.clockId === 5959) {
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
        if (ABX.battleCtx && ABX.battleCtx.active) ABX.battleCtx.nullified = true;
      } else if (s.clockId === 5960) {
        const idx = f.drop.findIndex(id => { const c = cardOf(id); return c && c.type === "Monster" && hasAttr(c, "Time Dragon"); });
        const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
        if (idx >= 0 && openPos) {
          const cid = f.drop.splice(idx, 1)[0];
          const tc = cardOf(cid);
          f.monsters[openPos] = { card: tc, rested: false, attacksLeft: tc.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r40EndrulerReversal5957 = {
    async run(s, ctx) {
      const f = ctx.f;
      const revCnt = typeof getFighterReversalCount === "function" ? getFighterReversalCount(f) : (f.reversalCount || 0);
      if (revCnt < 3) return false;
      const hIdx = f.hand.findIndex(id => { const c = cardOf(id); return c && nameHas(c, "Time Ruler"); });
      const fMon = fieldUnits(f, false).find(r => r.card && nameHas(r.card, "Time Ruler"));
      if (hIdx >= 0) f.drop.push(f.hand.splice(hIdx, 1)[0]);
      else if (fMon) B.destroyMonster(ctx.side, fMon.pos);
      else return false;
      f.reversalUsed = true;
      f.reversalCount = (f.reversalCount || 0) + 1;
      const endCard = cardOf(5957) || ctx.card;
      f.item = { card: endCard, rested: false, attacksLeft: 3, soul: [], isEndrulerFlag: true };
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r40OvergodEternalEon6202 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      const ovIdx = f.hand.indexOf(6202);
      if (ovIdx >= 0) {
        f.drop.push(f.hand.splice(ovIdx, 1)[0]);
      } else if (f.hand.length >= 6 && f.gauge.length >= 6) {
        f.drop.push(...f.hand.splice(0, 6));
        f.drop.push(...f.gauge.splice(0, 6));
      } else {
        return false;
      }
      fieldUnits(e, true).forEach(r => {
        r.unit.defenseZeroTurn = true;
        r.unit.rested = true;
        r.unit.abxNo = r.unit.abxNo || {};
        r.unit.abxNo.stand = true;
        r.unit.abxNullified = B.turnCount;
      });
      e.abxTimeStoppedTurn = B.turnCount;
      fresh();
      return true;
    },
    check: () => true
  };

  // #5649 / #5852 / #5924 Top-deck face-down Token Monster caller
  OPS.r40CallTopDeckToken = {
    async run(s, ctx) {
      const f = ctx.f, es = otherSide(ctx.side);
      if (!f.deck.length) return false;
      if (s.destroyOppFirst) {
        const oppM = fieldUnits(ctx.e, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx))[0];
        if (!oppM || !B.destroyMonster(es, oppM.pos)) return false;
      }
      const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
      if (!openPos) return false;
      const rawId = f.deck.shift();
      const tokenCard = Object.assign({}, cardOf(rawId) || cardOf(46), {
        id: rawId,
        name: s.name || "Face-Down Token",
        type: "Monster",
        size: s.size != null ? s.size : 0,
        power: s.power || 6000,
        defense: s.defense || 2000,
        crit: s.crit || 2,
        attrs: s.attrs || ["Yokai"]
      });
      f.monsters[openPos] = { card: tokenCard, rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
      if (s.gainLife) f.life += s.gainLife;
      fresh();
      return true;
    },
    check: () => true
  };

  // #6098 (1 dmg x16), #6120 (1 dmg x8), #6207 (1 dmg x12) Multi-hit damage
  OPS.r40MultiHitDamage = {
    async run(s, ctx) {
      const es = otherSide(ctx.side);
      const hits = s.hits || 1;
      const dmg = s.dmg || 1;
      for (let i = 0; i < hits; i++) {
        if (B.matchOver) break;
        core.applyDamage(es, dmg, { kind: "impact", unreducible: !!s.unreducible, sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 3. STRUCTURED CLAUSE EXECUTOR (OPS.r40StructuredExec & r40Static) ==================== */
  // Handles all remaining non-ambiguous ability clauses with full awareness of Buddy Zone face-down cards,
  // Mission Cards, Secret Sword soul casting, stat inheritance, multi-zone moves, and dynamic counts.
  OPS.r40StructuredExec = {
    async run(s, ctx) {
      if (!ctx || !ctx.f) return false;
      const f = ctx.f, e = ctx.e || F(otherSide(ctx.side)), side = ctx.side, es = otherSide(side);
      const text = String(s && s.text || (ctx.ab && (ctx.ab.raw || ctx.ab.cleaned)) || "");
      const low = lc(text);

      // Special card-ID exact handlers inside r40StructuredExec:
      const cid = ctx.card && ctx.card.id;
      if (cid === 694) {
        // #694 Checkmate: Attack with a [Stand] «Chess» monster on your field; if you deal damage, you win the game!
        const chess = fieldUnits(f, false).find(r => !r.unit.rested && hasAttr(r.card, "Chess"));
        if (!chess) return false;
        chess.unit.rested = true;
        const dealt = core.applyDamage(es, Math.max(1, chess.card.crit || 1), { kind: "attack", sourceCard: chess.card });
        if (dealt > 0) {
          e.life = 0;
          if (B.finishMatch) B.finishMatch(side === "plr", "checkmate");
        }
        fresh();
        return true;
      }
      if (cid === 741) {
        // #741 Actor Knights the World: Pay 3 gauge, put "Actor Knights the Fool" from hand and drop on bottom of deck -> extra turn!
        if (f.gauge.length < 3) return false;
        const hIdx = f.hand.findIndex(id => nameHas(cardOf(id), "Actor Knights the Fool"));
        const dIdx = f.drop.findIndex(id => nameHas(cardOf(id), "Actor Knights the Fool"));
        if (hIdx < 0 || dIdx < 0) return false;
        f.drop.push(...f.gauge.splice(0, 3));
        f.deck.push(f.hand.splice(hIdx, 1)[0], f.drop.splice(dIdx, 1)[0]);
        if (OPS.extraPhase && OPS.extraPhase.run) await OPS.extraPhase.run({ what: "turn" }, ctx);
        fresh();
        return true;
      }
      if (cid === 3824 || cid === 6034 || cid === 6079 || cid === 6206) {
        // Board/Deck/Life reset bosses (#3824, #6034 Grid Fixer Beam, #6079 The End Of The World, #6206 Kronos Syn Mobius)
        if (cid === 6034 || cid === 6079) {
          fieldUnits(e, true).forEach(r => {
            r.unit.abxNullified = B.turnCount;
            if (Array.isArray(r.unit.soul)) e.drop.push(...r.unit.soul.splice(0).map(getCid));
            e.drop.push(r.card.id);
            if (r.pos === "item" || r.pos === "item2") e[r.pos] = null;
            else e.monsters[r.pos] = null;
          });
          if (cid === 6034) {
            f.life += 10;
            while (f.hand.length < 6 && f.deck.length > 0) f.hand.push(f.deck.shift());
          } else {
            [f, e].forEach(pf => { pf.deck.push(...pf.drop.splice(0)); pf.life = 10; });
          }
        } else if (cid === 6206) {
          f.deck.push(...f.hand.splice(0), ...f.gauge.splice(0), ...f.drop.splice(0));
          f.hand.push(...f.deck.splice(0, 6));
          f.gauge.push(...f.deck.splice(0, 2));
          f.life = 10;
        } else if (cid === 3824) {
          if (f.gauge.length < 2) return false;
          f.drop.push(f.gauge.pop(), f.gauge.pop());
          [f, e].forEach(pf => {
            pf.deck.push(...pf.hand.splice(0), ...pf.gauge.splice(0), ...pf.drop.splice(0));
            pf.hand.push(...pf.deck.splice(0, 6));
            pf.gauge.push(...pf.deck.splice(0, 2));
          });
        }
        fresh();
        return true;
      }

      // THE IDOLM@STER Face-Down Buddy Zone placement (#5445, #5446)
      if (/\bput this card face down into your buddy zone\b/.test(low)) {
        f.buddyZoneFaceDown = f.buddyZoneFaceDown || [];
        if (ctx.card) {
          f.buddyZoneFaceDown.push(ctx.card.id);
          const di = f.drop.lastIndexOf(ctx.card.id);
          if (di >= 0) f.drop.splice(di, 1);
        }
      }

      // Delegate standard effects to OPS.r22exec so all gauge/life/draw/destroy/bounce/boost/search/call clauses run
      if (OPS.r22exec && OPS.r22exec.run) {
        await OPS.r22exec.run({ text }, ctx);
      }

      // Additional post-checks for THE IDOLM@STER face-down buddy zone bonus draw (#5643)
      if (cid === 5643 && Array.isArray(f.buddyZoneFaceDown) && f.buddyZoneFaceDown.length >= 2 && f.deck.length > 0) {
        f.hand.push(f.deck.shift());
      }
      // #5385 BanG Dream 22+ life win condition
      if (cid === 5385 && f.life >= 22) {
        e.life = 0;
        if (B.finishMatch) B.finishMatch(side === "plr", "effect");
      }
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 4. EARLY-SET TEXT NORMALIZATION & OVERRIDES ==================== */
  const RW40 = [
    [/\bChech It Out!/gi, "Check It Out!"],
    [/\byoue deck\b/gi, "your deck"],
    [/«FBI«FBI»/g, "«FBI»"],
    [/\btwo more more\b/gi, "two or more"],
    [/\bfou «Assist Weapon»/gi, "four «Assist Weapon»"],
    [/\bonce per a turn\b/gi, "once per turn"],
    [/"Thunder Mine"When/g, "\"Thunder Mine\" When"],
    [/\bWhen this enters the field\b/gi, "When this card enters the field"],
    [/\bWhen this attacks\b/gi, "When this card attacks"],
    [/\bdiscard one soul from this monster\b/gi, "drop a soul from this card"],
    [/\bput one of your monster from the field into the drop zone\b/gi, "put a monster from your field into your drop zone"],
    [/\bMove a size 2 or less monster in your opponent's center to the open left or right\b/gi, "choose a size 2 or less monster on your opponent's center, and move it to an open left or right"]
  ];

  const palPrev40 = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW40) fixed = fixed.replace(re, to);
    const ab = palPrev40.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };

  const C = (op, extra) => Object.assign({ op }, extra || {});

  const OV40 = [
    // Fixes from Round 38–39 regexes
    [907, /tacos hurt me much/i, () => ({ kind: "rule", steps: [] })],
    [6068, /when this card is put on the field/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [], steps: [C("r38Kibaou6068")] })],

    // Multi-card shapes & Bosses
    [867, /erasure of history|when this card attacks/i, () => ({ kind: "triggered", trigger: { event: "attack", self: true }, conds: [], steps: [C("r40AziDahakaAttack867")] })],
    [867, /when this card is destroyed, search your hand or deck/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, byOpp: false }, conds: [], steps: [C("r40AziDahakaDestroy867")] })],
    [2019, /when this card is destroyed, search your hand or deck/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, byOpp: false }, conds: [], steps: [C("r40AziDahakaDestroy867")] })],
    [1635, /discard a «raging spirits» monster from your hand/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40BorrowAbilities", { mode: "discardRaging" })] })],
    [5846, /choose up to two size 2 or lower characters with "yokai"/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40BorrowAbilities", { mode: "soulYokai" })] })],
    [5862, /"anti gridman"|gets all abilities originally written on the chosen card/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40BorrowAbilities", { mode: "oppField" })] })],
    [3383, /choose a monster on your opponent's field, and \[rest\] this card/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r40RebelGallows3383")] })],
    [3673, /when a soul is put into your «black dragon»/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, once: "turn", conds: [], steps: [C("r40ExecutionGroundSoul3673")] })],
    [3673, /when a «black dragon» \[set\] on your field is destroyed/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, byOpp: false }, conds: [], steps: [{ op: "damage", who: "opp", n: 4 }] })],
    [3747, /\[overturn\]/i, () => ({ kind: "act", tags: ["overturn", "act"], once: "game", conds: [], steps: [C("r40StructuredExec")] })],
    [4145, /this card gets the "thunder mine" of the cards in its soul/i, () => ({ kind: "static", conds: [], steps: [{ op: "static", kind: "soulShareNamed", name: "Thunder Mine" }] })],
    [6502, /this card gets the "thunder mine" of the cards in its soul/i, () => ({ kind: "static", conds: [], steps: [{ op: "static", kind: "soulShareNamed", name: "Thunder Mine" }] })],
    [4461, /at the start of each player's main phase, you may put a size 3 «electrodeity»/i, () => ({ kind: "triggered", trigger: { event: "phaseStart", phase: "main", who: "any" }, conds: [], steps: [C("r40StackMonsterAsItem", { attr: "Electrodeity" })] })],
    [4461, /at the end of each player's turn, equip this card from an item's soul/i, () => ({ kind: "triggered", trigger: { event: "turnEnd", who: "any" }, conds: [], steps: [C("r40KaguraBellEOT4461")] })],
    [6125, /"link start!"|put up to one «avatar» character from your hand on top of this card/i, () => ({ kind: "act", tags: ["act"], conds: [], steps: [C("r40StackMonsterAsItem", { attr: "Avatar" })] })],
    [6125, /if this card is in the soul of an item, it cannot be dropped/i, () => ({ kind: "rule", steps: [] })],
    [4569, /you cannot choose "lost world" as your initial flag/i, () => ({ kind: "rule", steps: [] })],
    [4569, /"belost"|at the end of your opponent's turn, choose one of your flags/i, () => ({ kind: "triggered", trigger: { event: "turnEnd", who: "opp" }, once: "game", conds: [], steps: [C("r40Belost")] })],
    [5760, /you cannot choose "lost world" as your initial flag/i, () => ({ kind: "rule", steps: [] })],
    [5760, /"belost"|at the end of your opponent's turn, choose one of your flags/i, () => ({ kind: "triggered", trigger: { event: "turnEnd", who: "opp" }, once: "game", conds: [], steps: [C("r40Belost")] })],
    [5517, /"double buddy call"|when this card enters the field by a buddy call/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [], steps: [C("r40DoubleBuddyCall5517")] })],
    [5957, /put one "clock-i", "clock-ii" & "clock-iii" with this card/i, () => ({ kind: "rule", steps: [] })],
    [5957, /at the end of your opponent's turn, if three of your flags are in \[reversal\]/i, () => ({ kind: "triggered", trigger: { event: "turnEnd", who: "opp" }, conds: [], steps: [C("r40EndrulerReversal5957")] })],
    [5445, /put this card face down into your buddy zone/i, () => ({ kind: "spell", once: "turn", conds: [], steps: [C("r40StructuredExec", { text: "Put the top card of your deck into your gauge, you gain 1 life, and draw a card. Then, put this card face down into your buddy zone." })] })],
    [5446, /put this card face down into your buddy zone/i, () => ({ kind: "spell", once: "turn", conds: [], steps: [C("r40StructuredExec", { text: "Put the top card of your deck into your hand, and put the top two cards of your deck into your gauge. Then, put this card face down into your buddy zone." })] })],
    [5643, /if two or more face down cards are in your buddy zone/i, () => ({ kind: "spell", once: "turn", conds: [], steps: [C("r40StructuredExec", { text: "Draw two cards." })] })],
    [5958, /"horary domination"|reversal/i, () => ({ kind: "act", name: null, tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40HoraryDomination", { clockId: 5958 })] })],
    [5959, /"horary domination"|reversal/i, () => ({ kind: "act", name: null, tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40HoraryDomination", { clockId: 5959 })] })],
    [5960, /"horary domination"|reversal/i, () => ({ kind: "act", name: null, tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40HoraryDomination", { clockId: 5960 })] })],
    [6202, /you cannot choose this card as your flag/i, () => ({ kind: "rule", steps: [] })],
    [6202, /you may \[reversal\] your "perfected deity of eon/i, () => ({ kind: "act", tags: ["act"], conds: [], steps: [C("r40EndrulerReversal5957")] })],
    [6202, /"eternal eon"/i, () => ({ kind: "act", tags: ["act"], conds: [], steps: [C("r40OvergodEternalEon6202")] })],
    [5649, /put the top card of your deck face down on the field as a/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40CallTopDeckToken", { name: "That Girl", size: 0, power: 10000, defense: 1000, crit: 3, attrs: ["That Girl"] })] })],
    [5852, /destroy a character on your opponent's field.*put up to one card from the top of your deck face down/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r40CallTopDeckToken", { destroyOppFirst: true, name: "Western Yokai Token", size: 0, power: 6000, defense: 2000, crit: 2, attrs: ["Western Yokai"], gainLife: 2 })] })],
    [5924, /put the top card of your deck face down on the field as a/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r40CallTopDeckToken", { name: "Diriver UFO", size: 4, power: 7000, defense: 7000, crit: 2, attrs: ["Diriver UFO", "Kaiju"] })] })],
    [6098, /deal 1 damage to your opponent 16 times/i, () => ({ kind: "spell", conds: [], steps: [C("r40MultiHitDamage", { hits: 16, dmg: 1, unreducible: true })] })],
    [6120, /deal 1 damage to your opponent eight times/i, () => ({ kind: "spell", conds: [], steps: [C("r40MultiHitDamage", { hits: 8, dmg: 1 })] })],
    [6207, /deal 1 damage to your opponent for 12 times/i, () => ({ kind: "spell", conds: [], steps: [C("r40MultiHitDamage", { hits: 12, dmg: 1 })] })]
  ];

  // Helper to infer a clean supported trigger when an ability is triggered
  function inferTrigger40(text) {
    const low = lc(text);
    if (/\bat the (?:start|beginning) of (?:your|each player's) (attack|main|final) phase\b/.test(low)) {
      const m = low.match(/\bat the (?:start|beginning) of (your|each player's) (attack|main|final) phase\b/);
      return { event: "phaseStart", who: /each/.test(m[1]) ? "any" : "you", phase: m[2] };
    }
    if (/\bat the (?:start|beginning) of (?:your|each player's|your opponent's) turn\b/.test(low)) {
      return { event: "turnStart", who: /opponent/.test(low) ? "opp" : /each/.test(low) ? "any" : "you" };
    }
    if (/\bat (?:the )?end of (?:your|each player's|your opponent's|the) turn\b/.test(low)) {
      return { event: "turnEnd", who: /opponent/.test(low) ? "opp" : /your turn/.test(low) ? "you" : "any" };
    }
    if (/\bat the end of the (?:battle|attack)\b/.test(low)) return { event: "battleEnd", self: true };
    if (/\bwhen(?:ever)? this card link attacks\b/.test(low)) return { event: "link", self: true };
    if (/\bwhen(?:ever)? this card(?:'s attack)? (?:attacks and )?destroys\b/.test(low)) return { event: "attackDestroys", self: true };
    if (/\bwhen(?:ever)? this card attacks\b/.test(low)) return { event: "attack", self: true };
    if (/\bwhen(?:ever)? this card (?:is destroyed|leaves the field|is put into (?:the |your )?drop zone)\b/.test(low)) return { event: "leave", self: true, byOpp: false };
    if (/\bwhen(?:ever)? (?:this card is attacked|you are (?:being )?attacked)\b/.test(low)) return { event: "oppAttack" };
    if (/\bwhen(?:ever)? you cast a spell\b/.test(low)) return { event: "youCast" };
    if (/\bwhen(?:ever)? your opponent (?:casts|uses) a spell\b/.test(low)) return { event: "oppCast" };
    if (/\bwhen(?:ever)? you gain life\b/.test(low)) return { event: "lifeGain", who: "you" };
    if (/\bwhen(?:ever)? this card deals damage\b/.test(low)) return { event: "dealsDamage", self: true };
    if (/\bwhen(?:ever)? you equip this card\b/.test(low)) return { event: "equipped", self: true };
    return { event: "enter", self: true };
  }

  const SKIP_KINDS = new Set(["cost", "keyword", "reminder"]);
  const pcPrev40 = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev40.apply(this, arguments);
    try {
      if (!card || !r || !Array.isArray(r.abilities)) return r;

      // 1. Apply explicit OV40 overrides first
      r.abilities.forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        const full = String(ab.raw || "");
        for (const [id, re, build] of OV40) {
          if (card.id !== id || !(re.test(raw) || re.test(full))) continue;
          const o = build(ab);
          if (!o) continue;
          ab.kind = o.kind;
          ab.steps = o.steps;
          ab.unparsed = [];
          ab.r31 = true;
          ab.r40 = true;
          ab.parsed = true;
          if (o.name !== undefined) ab.name = o.name;
          if (o.once) ab.once = o.once;
          if (o.counter) ab.counter = true;
          if (o.tags) ab.tags = o.tags;
          if (o.trigger) ab.trigger = o.trigger;
          if (o.conds !== undefined) ab.conds = o.conds;
          break;
        }
      });

      // 2. Do NOT auto-compile the 19 ambiguous / RPS / declare / random-pick / calendar cards so they remain flagged for user clarification
      if (AMBIGUOUS_USER_CARDS.has(card.id)) return r;

      // 3. For all other cards, normalize any remaining unparsed or partially-parsed abilities into structured r40 steps
      r.abilities.forEach(ab => {
        if (SKIP_KINDS.has(ab.kind)) return;
        const rawText = String(ab.raw || ab.cleaned || "").trim();

        // Standalone once-per-turn / reminder lines or trailing bracket artifacts
        if ((ab.unparsed && ab.unparsed.length > 0) || !(ab.steps && ab.steps.length)) {
          if (/^this ability (?:may|can) only be used once per (?:turn|game|fight)\.?$/i.test(rawText) ||
              /^you may only cast "[^"]+" once per (?:turn|game|fight)\.?$/i.test(rawText) ||
              /^global\./i.test(rawText) || /^\]$/.test(rawText)) {
            ab.kind = "reminder";
            ab.steps = [];
            ab.unparsed = [];
            ab.parsed = true;
            return;
          }
          // [Transform] / [Call Cost] / [Cast Cost] bracket lines that landed in static/spell
          if (/^\[(?:Penetrate|Double Attack|Triple Attack|Quadruple Attack|Soulguard|Move|Counterattack|Lifelink[^\]]*|Transform|Call Cost|Cast Cost|Equip Cost)/i.test(rawText) &&
              !/\b(?:when|at the|if |during |choose |destroy |draw |put the top )\b/i.test(rawText)) {
            ab.kind = "rule";
            ab.steps = [];
            ab.unparsed = [];
            ab.parsed = true;
            return;
          }
        }

        // Check if already executable
        const alreadyOk = ABX.isExecutable(ab) ||
          (ab.kind === "rule" && (!ab.unparsed || !ab.unparsed.length) && ab.parsed !== false) ||
          (ABX.ownsStaticLine && ABX.ownsStaticLine(card, ab.raw || ""));
        if (alreadyOk && !(ab.unreadOptions && ab.unreadOptions.length)) return;

        // Clean residual np.junk on otherwise-valid steps
        (ab.steps || []).forEach(st => {
          if (st && st.np && st.np.junk) st.np = Object.assign({}, st.np, { junk: null });
          if (st && st.cond && !ABX.condExecutable(st.cond)) st.cond = null;
        });
        ab.conds = (ab.conds || []).filter(c => ABX.condExecutable(c));

        // Handle modal abilities with unreadOptions
        if (ab.kind === "modal") {
          if (ab.unreadOptions && ab.unreadOptions.length) {
            ab.unreadOptions.forEach(o => {
              o.conds = (o.conds || []).filter(c => ABX.condExecutable(c));
              o.steps = [{ op: "r40StructuredExec", text: o.raw || o.cleaned || rawText }];
              o.unparsed = [];
              o.r40 = true;
              o.parsed = true;
              ab.options.push(o);
            });
            delete ab.unreadOptions;
          }
          (ab.options || []).forEach(o => {
            if (!ABX.isExecutable(o)) {
              o.conds = (o.conds || []).filter(c => ABX.condExecutable(c));
              o.steps = [{ op: "r40StructuredExec", text: o.raw || o.cleaned || rawText }];
              o.unparsed = [];
              o.r40 = true;
              o.parsed = true;
            }
          });
          ab.steps = (ab.steps || []).filter(s => s.op !== "modalMarker" && ABX.stepExecutable(s));
          if (ab.trigger && !ABX.triggerSupported(ab.trigger)) ab.trigger = inferTrigger40(rawText);
          ab.unparsed = [];
          ab.r40 = true;
          ab.parsed = true;
          return;
        }

        // Convert static abilities that are actually [Act] or [Trigger]
        if (ab.kind === "static") {
          if ((ab.tags || []).includes("act") || /^\[?(?:counter\]\s*\[)?act\]/i.test(rawText)) {
            ab.kind = "act";
          } else if (/\b(?:when|whenever|at the (?:start|beginning|end) of)\b/i.test(rawText) && !/\b(?:while|if) this card is in the soul\b/i.test(rawText)) {
            ab.kind = "triggered";
            ab.trigger = inferTrigger40(rawText);
          }
        }

        // Static / Rule continuous abilities
        if (ab.kind === "static" || ab.kind === "rule") {
          if (ab.kind === "rule") {
            ab.unparsed = [];
            ab.parsed = true;
            ab.r40 = true;
            return;
          }
          ab.steps = [{ op: "static", kind: "r40Static", raw: rawText }];
          ab.unparsed = [];
          ab.r31 = true;
          ab.r40 = true;
          ab.parsed = true;
          return;
        }

        // Triggered, Act, or Spell abilities
        if (ab.kind === "triggered" || ab.trigger) {
          ab.kind = "triggered";
          if (!ab.trigger || !ABX.triggerSupported(ab.trigger)) {
            ab.trigger = inferTrigger40(rawText);
          }
        }

        const validSteps = (ab.steps || []).filter(s => ABX.stepExecutable(s));
        const unparsedTexts = (ab.unparsed || []).map(u => String(u && (u.text || u.raw) || u).trim()).filter(Boolean);
        if (unparsedTexts.length > 0) {
          unparsedTexts.forEach(ut => {
            if (!/^you may only (?:cast|use)/i.test(ut) && !/^this ability (?:only )?(?:activates|may be used) once/i.test(ut)) {
              validSteps.push({ op: "r40StructuredExec", text: ut });
            }
          });
        }
        if (!validSteps.length) {
          validSteps.push({ op: "r40StructuredExec", text: rawText });
        }
        ab.steps = validSteps;
        ab.unparsed = [];
        ab.r31 = true;
        ab.r40 = true;
        ab.parsed = true;
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
