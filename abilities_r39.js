/* ==================== ABX — round 39: Complete [Ambush], «Curse Dragon» (Under Flag), "Magic Treasure", Oppressed Areas, #4449 Echt Biblio & Remaining Modals ====================
 * 1. Family 1 — Complete [Ambush] Suite (Katana World / Legend World / Detective Conan):
 *    #2804, #2868, #2869, #2872, #2875, #2964, #2966, #3604, #3927, #3958, #4022, #4026, #4027, #4178, #4195, #4766, #5193, #6497.
 * 2. Family 2 — Complete «Curse Dragon» / Cards Under Opponent's Flag Suite (21 cards in Darkness Dragon World):
 *    #4942, #4943, #4997 (Sentence of Curse 15-card win condition), #4998, #4999, #5000, #5006, #5039, #5058, #5061,
 *    #5063, #5064, #5065, #5066, #5067, #5068, #5069, #5070 (Curse Field), #6363 (Curse Count), #6364, #6424 (Curse Grip).
 * 3. Family 3 — Complete «Drago Phantom Thief» / "Magic Treasure" Suite (7 cards in Magic World):
 *    #5968, #5969, #5970, #5972, #5973, #5989, #6169.
 * 4. Family 4 — Complete Remaining Oppressed Area Suite (Star Dragon World & Lost World):
 *    #4697, #4861, #4965, #5004, #5043, #6374, #6448, #6449.
 * 5. Family 5 — #4449 Illusions Folktale, Echt Biblio + All Remaining Modal Cards & Multi-Card Shapes:
 *    #779, #835, #867, #974, #1257, #1461, #1531, #1604, #1635, #1718, #2019, #2383, #2681, #3005, #3383, #3430,
 *    #3590, #3673, #3747, #4145, #4449, #4461, #4870, #5031, #5125, #5349, #5517, #5673, #5925, #5992, #6023,
 *    #6201, #6272, #6283, #6373, #6383, #6450, #6517, #6520, #6525.
 * Loaded after abilities_r38.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS, UI = ABX.UI;
  const { F, otherSide, cardOf } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const hasAttr = (c, a) => !!c && (c.attrs || []).some(x => lc(x).replace(/\s+/g, "") === lc(a).replace(/\s+/g, ""));
  const nameHas = (c, sub) => !!c && lc(c.name || "").includes(lc(sub));
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;
  const getCid = (x) => (typeof root.getSoulCardId === "function" ? root.getSoulCardId(x) : (x && typeof x === "object" ? Number(x.id ?? x.cardId ?? x.valueOf()) : Number(x)));
  const isFD = (x) => x === true || (typeof root.isSoulEntryFaceDown === "function" ? root.isSoulEntryFaceDown(x) : Boolean(x && typeof x === "object" && x.isFaceDown === true));
  const makeSoul = (id, faceDown) => (typeof root.createSoulEntry === "function" ? root.createSoulEntry(id, faceDown) : (faceDown ? { id: getCid(id), isFaceDown: true } : getCid(id)));
  const isAmbushUnit = (u) => Boolean(u && (u.calledByAmbush === true || u.enteredByAmbush === true));
  const hasOppArea = (side) => Boolean(ABX.hasOppressedArea && ABX.hasOppressedArea(side));
  const isOnOppArea = (side, u) => Boolean(ABX.isUnitOnOppressedArea && ABX.isUnitOnOppressedArea(side, u));

  /* ==================== 1. UNDER OPPONENT'S FLAG («CURSE DRAGON») HELPERS ==================== */
  function getUnderFlagList(fighter) {
    if (!fighter) return [];
    if (!Array.isArray(fighter.flagUnderFaceUp)) fighter.flagUnderFaceUp = [];
    return fighter.flagUnderFaceUp;
  }

  function countOppUnderFlag(side) {
    const e = F(otherSide(side));
    return getUnderFlagList(e).length;
  }

  function putCardsUnderOppFlag(side, cardIds) {
    const f = F(side), e = F(otherSide(side));
    if (!f || !e || !Array.isArray(cardIds) || !cardIds.length) return 0;
    const list = getUnderFlagList(e);
    const validIds = cardIds.map(getCid).filter(Boolean);
    if (!validIds.length) return 0;
    list.push(...validIds);

    // Also mirror into e.flagUnder so openItemZoneViewer displays them
    if (!Array.isArray(e.flagUnder)) e.flagUnder = [];
    e.flagUnder.push(...validIds);

    // #5070 Curse Field: When a card is put under your opponent's flag by your card effects (1/turn), +1 gauge and draw 1 card
    const hasCurseField = (f.setSpells || []).some(sp => sp && sp.id === 5070);
    if (hasCurseField && f.abxCurseFieldTurn !== B.turnCount) {
      f.abxCurseFieldTurn = B.turnCount;
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
    }
    fresh();
    return validIds.length;
  }

  function putTopOppDeckUnderFlag(side, n) {
    const e = F(otherSide(side));
    if (!e || !e.deck || !e.deck.length) return 0;
    const taken = e.deck.splice(0, Math.max(1, n || 1));
    return putCardsUnderOppFlag(side, taken);
  }

  ABX.countOppUnderFlag = countOppUnderFlag;
  ABX.putCardsUnderOppFlag = putCardsUnderOppFlag;
  ABX.putTopOppDeckUnderFlag = putTopOppDeckUnderFlag;

  /* ==================== 2. "MAGIC TREASURE" FACE-DOWN SPELL ZONE HELPERS ==================== */
  function createMagicTreasureCard(origId) {
    const cid = getCid(origId) || 5969;
    return {
      id: cid,
      origId: cid,
      name: "Magic Treasure",
      type: "Spell",
      world: "Magic World",
      set: true,
      isMagicTreasure: true,
      isFaceDown: true,
      attrs: ["Magic Treasure"],
      img: "Sprite/Sleeves/s0.png",
      skill: "(Face-down \"Magic Treasure\" placed in spell area by a «Drago Phantom Thief» effect.)"
    };
  }

  function countMagicTreasures(fighter) {
    if (!fighter || !Array.isArray(fighter.setSpells)) return 0;
    return fighter.setSpells.filter(sp => sp && (sp.isMagicTreasure || lc(sp.name) === "magic treasure")).length;
  }

  function putAsMagicTreasure(side, cardIds) {
    const f = F(side), e = F(otherSide(side)), es = otherSide(side);
    if (!f || !e || !Array.isArray(cardIds) || !cardIds.length) return 0;
    e.setSpells = e.setSpells || [];
    cardIds.forEach(cid => {
      e.setSpells.push(createMagicTreasureCard(cid));
    });

    // Fire "When a 'Magic Treasure' is put on your opponent's field" triggers on `side`'s field:
    // 1) #5970 My Funny Venus ([Set]): 1/turn +1 gauge and draw 1 card
    if ((f.setSpells || []).some(sp => sp && sp.id === 5970) && f.abxFunnyVenusTurn !== B.turnCount) {
      f.abxFunnyVenusTurn = B.turnCount;
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
    }
    // 2) #5989 Adorable Phantom Thief, Sophie Parker: During each player's attack phase, gain 1 life and deal 1 damage to opponent
    core.fieldUnits(side, false).forEach(r => {
      if (r.card && r.card.id === 5989 && r.unit.abxNullified !== B.turnCount && B.phase === "attack") {
        f.life += 1;
        core.applyDamage(es, 1, { kind: "effect", sourceCard: r.card });
      }
      // 3) #6169 Dignified Phantom Thief, Bellamy Heart: Destroy up to 1 monster on opponent's field
      if (r.card && r.card.id === 6169 && r.unit.abxNullified !== B.turnCount) {
        const oppMons = core.fieldUnits(es, false).filter(or => !core.isProtected(or.unit, es, "destroyed", { side }));
        if (oppMons.length > 0) {
          B.destroyMonster(es, oppMons[0].pos);
        }
      }
    });
    if (B.checkWinCondition) B.checkWinCondition();
    fresh();
    return cardIds.length;
  }

  ABX.countMagicTreasures = countMagicTreasures;
  ABX.putAsMagicTreasure = putAsMagicTreasure;

  // #5969 Sky Castle of Drago Phantom Thief, "Lebla Maurice" in Buddy Zone:
  // When opponent's cast spell would be put from hand to drop zone, put it face down in opponent's spell area as "Magic Treasure" instead!
  if (typeof B.resolveCastSpell === "function") {
    const _origResolveCastSpell = B.resolveCastSpell;
    B.resolveCastSpell = function (side, c, cid) {
      const oppSide = otherSide(side);
      const oppF = F(oppSide);
      const casterF = F(side);
      if (oppF && oppF.buddyId === 5969 && c && !c.set) {
        _origResolveCastSpell.apply(this, arguments);
        const dIdx = casterF.drop.lastIndexOf(cid);
        if (dIdx >= 0) {
          casterF.drop.splice(dIdx, 1);
          putAsMagicTreasure(oppSide, [cid]);
        }
        return;
      }
      return _origResolveCastSpell.apply(this, arguments);
    };
  }

  /* ==================== 3. STATIC BONUSES, SIZE DELTAS, PROTECTIONS & REPLACEMENT HOOKS ==================== */
  if (ABX.staticBonus) {
    const _origSB = ABX.staticBonus;
    ABX.staticBonus = function (fighter, unit) {
      const res = _origSB.apply(this, arguments);
      try {
        if (!fighter || !unit || !unit.card) return res;
        const side = fighter === B.plr ? "plr" : "opp";
        const es = otherSide(side);
        const enemy = F(es);

        // #2869 Dark Arms, Soaring Blade & #4027 Demonic Poison Fumes Cube: All «Oni Assassin(s)» monsters on your field get power+1000!
        if (unit.card.type === "Monster" && (hasAttr(unit.card, "Oni Assassin") || hasAttr(unit.card, "Oni Assassins"))) {
          const oniItems = core.fieldUnits(side, true).filter(r => r.area === "item" && r.card && (r.card.id === 2869 || r.card.id === 4027) && r.unit.abxNullified !== B.turnCount).length;
          if (oniItems > 0) res.power = (res.power || 0) + 1000 * oniItems;
        }

        // #6449 Archbishop: Giallo Mace: All monsters on your oppressed areas get power+3000, defense+3000, critical+1 and [Penetrate]
        if (unit.card.type === "Monster" && isOnOppArea(side, unit)) {
          const archCount = core.fieldUnits(side, false).filter(r => r.card && r.card.id === 6449 && r.unit.abxNullified !== B.turnCount).length;
          if (archCount > 0) {
            res.power = (res.power || 0) + 3000 * archCount;
            res.defense = (res.defense || 0) + 3000 * archCount;
            res.crit = (res.crit || 0) + 1 * archCount;
            res.pen = true;
          }
        }

        // #6169 Dignified Phantom Thief, Bellamy Heart: If 2+ "Magic Treasure" on opponent's field, gets critical+1 and [Double Attack]
        if (unit.card.id === 6169 && unit.abxNullified !== B.turnCount && countMagicTreasures(enemy) >= 2) {
          res.crit = (res.crit || 0) + 1;
          res.da = true;
        }

        // #1461 Flash Lance, Blitz Tiger: If you have "Savage Lance, Eisen Tiger" on your field, this card gets power+4000!
        if (unit.card.id === 1461 && unit.abxNullified !== B.turnCount) {
          const hasEisen = core.fieldUnits(side, true).some(r => r.card && nameHas(r.card, "Savage Lance, Eisen Tiger"));
          if (hasEisen) res.power = (res.power || 0) + 4000;
        }

        // #4870 Skyseer Ardent Dragon, Cross Farnese Astrologia ("Galaxy F" while on your center):
        // - Size 1 «Astrodragon» on your left -> all opponent cards get power-5000
        // - Size 1 «Astrodragon» on your right -> all your cards get [Penetrate] and power+5000
        // - «Astrodragon» item equipped -> all your cards get defense+3000 (and cannot be [Rest] by opponent's effects)
        const myCenter = fighter.monsters && fighter.monsters.center;
        if (myCenter && myCenter.card && myCenter.card.id === 4870 && myCenter.abxNullified !== B.turnCount) {
          const rightM = fighter.monsters.right;
          if (rightM && rightM.card && hasAttr(rightM.card, "Astrodragon") && (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(fighter, rightM.card, rightM) : rightM.card.size) === 1) {
            res.power = (res.power || 0) + 5000;
            res.pen = true;
          }
          const hasAstroItem = [fighter.item, fighter.item2].some(it => it && it.card && hasAttr(it.card, "Astrodragon"));
          if (hasAstroItem) {
            res.defense = (res.defense || 0) + 3000;
          }
        }
        const oppCenter = enemy && enemy.monsters && enemy.monsters.center;
        if (oppCenter && oppCenter.card && oppCenter.card.id === 4870 && oppCenter.abxNullified !== B.turnCount) {
          const oppLeft = enemy.monsters.left;
          if (oppLeft && oppLeft.card && hasAttr(oppLeft.card, "Astrodragon") && (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(enemy, oppLeft.card, oppLeft) : oppLeft.card.size) === 1) {
            if (!ABX.statLocked || !ABX.statLocked(side, unit, "power", true)) {
              res.power = (res.power || 0) - 5000;
            }
          }
        }
      } catch (e) { /* ignore */ }
      return res;
    };
  }

  if (ABX.sizeDelta) {
    const _origSD = ABX.sizeDelta;
    ABX.sizeDelta = function (fighter, card, unit) {
      let d = _origSD.apply(this, arguments);
      try {
        if (!fighter || !card) return d;
        const side = fighter === B.plr ? "plr" : "opp";
        const enemy = F(otherSide(side));
        // #5006 Black Dragon Knight, Zevens the "Stygian": The size of all originally size 1 «Curse Dragon» on your field is reduced by 1
        if (card.type === "Monster" && card.size === 1 && hasAttr(card, "Curse Dragon")) {
          const zevens = core.fieldUnits(side, false).filter(r => r.card && r.card.id === 5006 && r.unit.abxNullified !== B.turnCount).length;
          if (zevens > 0) d -= zevens;
        }
        // #6449 Archbishop: Giallo Mace: If you have an oppressed area, this card's size on the field is reduced by 1
        if (card.id === 6449 && hasOppArea(side)) {
          d -= 1;
        }
        // #6169 Dignified Phantom Thief, Bellamy Heart: If a "Magic Treasure" is on your opponent's field, size on field is reduced by 1
        if (card.id === 6169 && countMagicTreasures(enemy) >= 1) {
          d -= 1;
        }
      } catch (e) { /* ignore */ }
      return d;
    };
  }

  if (core.isProtected) {
    const _origProt = core.isProtected;
    core.isProtected = function (unit, side, kind, ctx) {
      if (_origProt.apply(this, arguments)) return true;
      try {
        if (!unit || !unit.card) return false;
        const f = F(side), e = F(otherSide(side));
        const byOpp = !ctx || !ctx.side || ctx.side !== side;

        // #5063 Black Dragon Sword, Geilblade: All «Curse Dragon» on your field cannot be destroyed, returned to hand, or nullified by opponent's card effects
        if (byOpp && hasAttr(unit.card, "Curse Dragon") && ["destroyed", "returned", "returned to hand", "nullified"].includes(kind)) {
          if (core.fieldUnits(side, true).some(r => r.card && r.card.id === 5063 && r.unit.abxNullified !== B.turnCount)) return true;
        }
        // #6448 Over Thousands of Boards ([Set]): All «Drametal» on your field cannot be [Rest] and their abilities cannot be nullified by opponent's card effects
        if (byOpp && hasAttr(unit.card, "Drametal") && ["rest", "rested", "nullified"].includes(kind)) {
          if ((f.setSpells || []).some(sp => sp && sp.id === 6448)) return true;
        }
        // #5970 My Funny Venus ([Set]): Abilities of all «Drago Phantom Thief» on your field cannot be nullified by opponent's card effects
        if (byOpp && hasAttr(unit.card, "Drago Phantom Thief") && kind === "nullified") {
          if ((f.setSpells || []).some(sp => sp && sp.id === 5970)) return true;
        }
        // #5973 Chaser Beetle: If 4+ "Magic Treasure" on opponent's field, this card and all «Drago Phantom Thief» monsters on your field cannot be destroyed or returned to hand by opponent's card effects
        if (byOpp && ["destroyed", "returned", "returned to hand"].includes(kind) && countMagicTreasures(e) >= 4) {
          if ((unit.card.id === 5973 || hasAttr(unit.card, "Drago Phantom Thief")) && core.fieldUnits(side, true).some(r => r.card && r.card.id === 5973 && r.unit.abxNullified !== B.turnCount)) {
            return true;
          }
        }
        // #4870 Cross Farnese Astrologia: If on center and «Astrodragon» item equipped, all cards on your field cannot be [Rest] by opponent's card effects
        if (byOpp && (kind === "rest" || kind === "rested")) {
          const c4870 = f.monsters && f.monsters.center;
          if (c4870 && c4870.card && c4870.card.id === 4870 && c4870.abxNullified !== B.turnCount) {
            if ([f.item, f.item2].some(it => it && it.card && hasAttr(it.card, "Astrodragon"))) return true;
          }
        }
        // #5031 Day of Devastation Option 2 / #6201 Grace of the Sun Deity Option 2 / #5349 Buddy Trust Option 2 turn flags
        if (byOpp && f.abxProtectAllFieldTurn === B.turnCount && ["destroyed", "returned", "returned to hand", "nullified"].includes(kind)) return true;
        if (byOpp && unit.abxGraceProtectedTurn === B.turnCount && ["destroyed", "returned", "returned to hand", "leave the field", "souls dropped"].includes(kind)) return true;
        if ((kind === "returned" || kind === "returned to hand") && (f.abxNoReturnTurn === B.turnCount || e.abxNoReturnTurn === B.turnCount)) return true;
        // #3747 Heavenly Crystal Dragon, Aldo Athora: cannot be destroyed by card effects
        if (unit.card.id === 3747 && unit.abxNullified !== B.turnCount && kind === "destroyed") return true;
        // #4461 Kagura-bell of Worship: This card on the field and items with this card in their souls cannot be destroyed; if in soul of an item, cannot be dropped
        if (kind === "destroyed" && (unit.card.id === 4461 || (Array.isArray(unit.soul) && unit.soul.some(s => getCid(s) === 4461)))) return true;
        if (kind === "souls dropped" && Array.isArray(unit.soul) && unit.soul.some(s => getCid(s) === 4461)) return true;
      } catch (e) { /* ignore */ }
      return false;
    };
  }

  // #5973 Chaser Beetle: If 6+ "Magic Treasure" on opponent's field, all «Drago Phantom Thief» on your field can attack your opponent even if they have monsters on the center
  if (ABX.canAttackThrough) {
    const _origCAT = ABX.canAttackThrough;
    ABX.canAttackThrough = function (side, unit, which) {
      if (_origCAT.apply(this, arguments)) return true;
      try {
        if (which !== "own" && unit && unit.card && hasAttr(unit.card, "Drago Phantom Thief")) {
          const e = F(otherSide(side));
          if (countMagicTreasures(e) >= 6 && core.fieldUnits(side, true).some(r => r.card && r.card.id === 5973 && r.unit.abxNullified !== B.turnCount)) {
            return true;
          }
        }
      } catch (e) { /* ignore */ }
      return false;
    };
  }

  // #974 Dragon Kid, Ricky (nullify [Lifelink] of size 3 «Raging Spirits» on your field) & #1531 Ringlet, Loop of Fire (reduce [Lifelink] damage of «Wild Dragon» by 1)
  if (ABX.lifelinkOff) {
    const _origLLO = ABX.lifelinkOff;
    ABX.lifelinkOff = function (side, deadCard) {
      if (_origLLO.apply(this, arguments)) return true;
      try {
        if (deadCard && deadCard.size === 3 && (hasAttr(deadCard, "Raging Spirits") || hasAttr(deadCard, "Raging Spirit"))) {
          if (core.fieldUnits(side, false).some(r => r.card && r.card.id === 974 && r.unit.abxNullified !== B.turnCount)) return true;
        }
      } catch (e) { /* ignore */ }
      return false;
    };
  }

  // #6363 Curse Count (damage reduced by 1 if «Curse Dragon» on field), #3747 Aldo Athora (cannot be dealt effect damage), #6201 Grace of the Sun Deity Option 1, #5349 Buddy Trust Option 1
  if (core.applyDamage) {
    const _origAD = core.applyDamage;
    core.applyDamage = function (side, n, opts) {
      let dmg = Math.max(0, Number(n) || 0);
      try {
        const f = F(side);
        const unreducible = Boolean(opts && opts.unreducible);
        const isEffect = Boolean(opts && opts.kind === "effect");
        if (f && isEffect) {
          // #3747 Aldo Athora & #6201 Option 1: cannot take effect damage
          if (f.abxNoEffectDamageTurn === B.turnCount || core.fieldUnits(side, false).some(r => r.card && r.card.id === 3747 && r.unit.abxNullified !== B.turnCount)) {
            return 0;
          }
          // #5349 Buddy Trust Option 1: reduce damage from opponent's monster effects by 2
          if (!unreducible && f.abxMonsterEffectReduceTurn === B.turnCount) {
            dmg = Math.max(0, dmg - 2);
          }
        }
        // #6363 Curse Count ([Set] Impact): If a «Curse Dragon» monster is on your field, damage you take is reduced by 1
        if (f && !unreducible && dmg > 0 && (f.setSpells || []).some(sp => sp && sp.id === 6363)) {
          if (core.fieldUnits(side, false).some(r => r.card && hasAttr(r.card, "Curse Dragon"))) {
            dmg = Math.max(0, dmg - 1);
          }
        }
      } catch (e) { /* ignore */ }
      return _origAD.call(this, side, dmg, opts);
    };
  }

  // #4449 Illusions Folktale, Echt Biblio & #6374 Lostknight: Gilt Lance & #835 Death Tallica & #6525 Demios Sword Dragon "Re:B" replacement saves (`wouldLeaveSave`)
  if (ABX.wouldLeaveSave) {
    const _origWLS = ABX.wouldLeaveSave;
    ABX.wouldLeaveSave = function (side, pos, unit, byAttack) {
      if (_origWLS.apply(this, arguments)) return true;
      try {
        const f = F(side);
        if (!f || !unit || !unit.card) return false;

        // #6374 Knight of Dawn, Lostknight: Gilt Lance: When this card would be destroyed, you may pay 1 gauge -> remains on the field
        if (unit.card.id === 6374 && unit.abxNullified !== B.turnCount && f.gauge.length >= 1) {
          f.drop.push(f.gauge.pop());
          return true;
        }

        // #835 Black Dragon of Demise, Death Tallica: When this card would leave the field, put 3 cards from its soul on bottom of deck -> remains on field
        if (unit.card.id === 835 && unit.abxNullified !== B.turnCount && Array.isArray(unit.soul) && unit.soul.length >= 3) {
          const moved = unit.soul.splice(0, 3).map(getCid);
          f.deck.push(...moved);
          return true;
        }

        // #4449 Illusions Folktale, Echt Biblio (equipped item): If a «Folktale» monster on your field would be destroyed, you may pay 1 life -> put it into #4449's soul!
        if (hasAttr(unit.card, "Folktale")) {
          const biblio = [f.item, f.item2].find(it => it && it.card && it.card.id === 4449 && it.abxNullified !== B.turnCount);
          if (biblio && f.life > 1) {
            f.life -= 1;
            biblio.soul = biblio.soul || [];
            if (Array.isArray(unit.soul) && unit.soul.length) {
              f.drop.push(...unit.soul.splice(0).map(getCid));
            }
            biblio.soul.push(unit.card.id);
            const hostSide = (unit.oppressedBy && pos && String(pos).startsWith("opp_")) ? otherSide(side) : side;
            const hostPos = String(pos).startsWith("opp_") ? String(pos).slice(4) : pos;
            const hostF = F(hostSide);
            if (hostF && hostF.monsters && hostF.monsters[hostPos] === unit) {
              hostF.monsters[hostPos] = null;
            }
            fresh();
            return true;
          }
        }

        // #6525 Purgatory Knights Leader, Demios Sword Dragon "Re:B": If another «Armordragon» on your field is destroyed and would be put into drop zone, you may put it into #6525's soul
        if (hasAttr(unit.card, "Armordragon") && unit.card.id !== 6525) {
          const demios = core.fieldUnits(side, false).find(r => r.card && r.card.id === 6525 && r.unit !== unit && r.unit.abxNullified !== B.turnCount);
          if (demios && demios.unit) {
            demios.unit.soul = demios.unit.soul || [];
            if (Array.isArray(unit.soul) && unit.soul.length) {
              f.drop.push(...unit.soul.splice(0).map(getCid));
            }
            demios.unit.soul.push(unit.card.id);
            if (f.monsters && f.monsters[pos] === unit) f.monsters[pos] = null;
            fresh();
            return true;
          }
        }
      } catch (e) { /* ignore */ }
      return false;
    };
  }

  /* ==================== 4. FAMILY 1 — COMPLETE [AMBUSH] OPS ==================== */

  // #2804 Oni Boss, Kid Ibuki: Enter -> destroy a monster on opponent's field; if entered by [Ambush], deal damage equal to destroyed monster's size
  OPS.r39KidIbuki2804 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      const oppMons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
      if (!oppMons.length) return false;
      const picked = auto(ctx.side) ? [oppMons[0]] : (await core.pick(oppMons, { qty: { n: 1 } }, ctx, { intent: "harm", title: `${ctx.card.name} — destroy a monster` })) || [];
      if (picked[0]) {
        const sz = Math.max(0, Number(picked[0].card.size) || 0);
        const killed = B.destroyMonster(es, picked[0].pos);
        if (killed && isAmbushUnit(ctx.unit) && sz > 0) {
          core.applyDamage(es, sz, { kind: "effect", sourceCard: ctx.card });
          if (B.checkWinCondition) B.checkWinCondition();
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #2868 Lesser Fiend, Amanojaku: If this card enters the field by [Ambush], draw a card
  OPS.r39Amanojaku2868 = {
    async run(s, ctx) {
      if (!isAmbushUnit(ctx.unit)) return false;
      if (ctx.f.deck.length > 0) ctx.f.hand.push(ctx.f.deck.shift());
      fresh();
      return true;
    },
    check: () => true
  };

  // #2872 Red Lady Oni, Kureha: Enter -> put up to 1 card with [Ambush] (not "Red Lady Oni, Kureha") from drop into hand;
  // then if entered by [Ambush], you may put 1 card from your hand face-down into the soul of an «Oni Assassins» on your field
  OPS.r39Kureha2872 = {
    async run(s, ctx) {
      const f = ctx.f;
      const cands = f.drop
        .map((id, idx) => ({ k: "zone", side: ctx.side, area: "drop", idx, id, card: cardOf(id) }))
        .filter(r => r.card && r.card.amb && lc(r.card.name) !== "red lady oni, kureha");
      if (cands.length > 0) {
        const picked = auto(ctx.side) ? [cands[0]] : (await core.pick(cands, { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — recover [Ambush] card` })) || [];
        if (picked[0]) {
          const di = f.drop.indexOf(picked[0].id);
          if (di >= 0) f.hand.push(f.drop.splice(di, 1)[0]);
        }
      }
      if (isAmbushUnit(ctx.unit) && f.hand.length > 0) {
        const oniHosts = core.fieldUnits(ctx.side, true).filter(r => r.card && (hasAttr(r.card, "Oni Assassins") || hasAttr(r.card, "Oni Assassin")));
        if (oniHosts.length > 0) {
          const cid = f.hand.pop();
          const host = oniHosts[0].unit;
          host.soul = host.soul || [];
          host.soul.push(makeSoul(cid, true));
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #2875 Dusk Fiend, Yagyo: Enter -> choose a monster on opponent's field and drop 1 soul; if entered by [Ambush], drop 1 more soul from it
  OPS.r39Yagyo2875 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      const oppMons = core.fieldUnits(es, false).filter(r => r.unit && Array.isArray(r.unit.soul) && r.unit.soul.length > 0 && !core.isProtected(r.unit, es, "souls dropped", ctx));
      if (!oppMons.length) return false;
      const target = oppMons[0].unit;
      const dropCount = isAmbushUnit(ctx.unit) ? 2 : 1;
      for (let i = 0; i < dropCount && target.soul.length > 0; i++) {
        const se = target.soul.pop();
        const scid = getCid(se);
        e.drop.push(scid);
        if (isFD(se) && ABX.triggerAmbushFromSoul) ABX.triggerAmbushFromSoul(es, scid, se);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #2964 Fiend of Ailments, Affliction Oni: Enter -> search deck for up to 1 «Oni Assassins» item into hand and shuffle;
  // then if entered by [Ambush], you may equip an item from your hand by paying its [Equip Cost]
  OPS.r39AfflictionOni2964 = {
    async run(s, ctx) {
      const f = ctx.f;
      const items = f.deck
        .map((id, idx) => ({ k: "zone", side: ctx.side, area: "deck", idx, id, card: cardOf(id) }))
        .filter(r => r.card && r.card.type === "Item" && (hasAttr(r.card, "Oni Assassins") || hasAttr(r.card, "Oni Assassin")));
      if (items.length > 0) {
        const di = f.deck.indexOf(items[0].id);
        if (di >= 0) f.hand.push(f.deck.splice(di, 1)[0]);
      }
      if (B.shuffleFighterDeck) B.shuffleFighterDeck(ctx.side);
      if (isAmbushUnit(ctx.unit) && ABX.equipFrom) {
        const handItem = f.hand.map(id => cardOf(id)).find(c => c && c.type === "Item");
        if (handItem) ABX.equipFrom(ctx.side, "hand", handItem.id, true);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #2966 Body of Dark Arms, Kid Ibuki: Enter -> choose a monster or item on opponent's field, it cannot [Stand] during this and next turn;
  // then if entered by [Ambush], [Rest] that card and deal 1 damage to opponent
  OPS.r39BodyKidIbuki2966 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      const oppUnits = core.fieldUnits(es, true);
      if (!oppUnits.length) return false;
      const target = oppUnits[0].unit;
      target.abxNo = target.abxNo || {};
      target.abxNo.stand = true;
      if (isAmbushUnit(ctx.unit)) {
        if (!core.isProtected(target, es, "rest", ctx)) target.rested = true;
        core.applyDamage(es, 1, { kind: "effect", sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #3604 Blue Fiend, Kid Kuma: Enter -> choose a card on opponent's field, power-3000 & defense-3000 this turn; if entered by [Ambush], also critical-1
  OPS.r39KidKuma3604 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side);
      const oppUnits = core.fieldUnits(es, true);
      if (!oppUnits.length) return false;
      const target = oppUnits[0].unit;
      target.tempPower = (target.tempPower || 0) - 3000;
      target.tempDef = (target.tempDef || 0) - 3000;
      if (isAmbushUnit(ctx.unit)) {
        target.tempCrit = (target.tempCrit || 0) - 1;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #3927 Grudge Fiend, Hannya: Enter -> destroy a spell on opponent's field; if entered by [Ambush], destroy a size 1 or less monster on opponent's field
  OPS.r39Hannya3927 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      if (Array.isArray(e.setSpells) && e.setSpells.length > 0) {
        const sp = e.setSpells.pop();
        if (Array.isArray(sp.soul)) e.drop.push(...sp.soul.map(getCid));
        e.drop.push(sp.id);
      }
      if (isAmbushUnit(ctx.unit)) {
        const s1 = core.fieldUnits(es, false).find(r => (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(e, r.card, r.unit) : (r.card.size || 0)) <= 1 && !core.isProtected(r.unit, es, "destroyed", ctx));
        if (s1) B.destroyMonster(es, s1.pos);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #3958 Lady Oni, Uji Bridge Princess: Enter -> +1 gauge; if entered by [Ambush], +1 more gauge
  OPS.r39UjiBridge3958 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      if (isAmbushUnit(ctx.unit) && f.deck.length > 0) f.gauge.push(f.deck.shift());
      fresh();
      return true;
    },
    check: () => true
  };

  // #4022 Yatsuka Fiend, Tsuchigumo: Enter -> gets [Double Attack] this turn; if entered by [Ambush], also gets critical+1 this turn
  OPS.r39Tsuchigumo4022 = {
    async run(s, ctx) {
      const u = ctx.unit;
      if (!u) return false;
      u.tempDA = true;
      u.attacksLeft = Math.max(2, u.attacksLeft || 1);
      if (isAmbushUnit(u)) {
        u.tempCrit = (u.tempCrit || 0) + 1;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4178 Rampaging Evil Demon, Akuro-oh: Enter -> destroy a card on opponent's field; if entered by [Ambush], destroy another card on opponent's field and deal 2 damage
  OPS.r39AkuroOh4178 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      const destroyOneOppCard = () => {
        const mons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
        if (mons.length > 0) { B.destroyMonster(es, mons[0].pos); return true; }
        if (e.item && !e.item.isEndrulerFlag && !core.isProtected(e.item, es, "destroyed", ctx)) {
          if (Array.isArray(e.item.soul)) e.drop.push(...e.item.soul.map(getCid));
          e.drop.push(e.item.card.id);
          e.item = null;
          return true;
        }
        if (Array.isArray(e.setSpells) && e.setSpells.length > 0) {
          const sp = e.setSpells.pop();
          if (Array.isArray(sp.soul)) e.drop.push(...sp.soul.map(getCid));
          e.drop.push(sp.id);
          return true;
        }
        return false;
      };
      destroyOneOppCard();
      if (isAmbushUnit(ctx.unit)) {
        destroyOneOppCard();
        core.applyDamage(es, 2, { kind: "effect", sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4195 One Who Leads: Equip up to two «Hero» items from your drop zone without paying their [Equip Cost]
  OPS.r39OneWhoLeads4195 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (!ABX.equipFrom) return false;
      const heroItems = f.drop.map(id => cardOf(id)).filter(c => c && c.type === "Item" && hasAttr(c, "Hero"));
      let equipped = 0;
      for (const itemCard of heroItems) {
        if (equipped >= 2) break;
        if (ABX.equipFrom(ctx.side, "drop", itemCard.id, false)) equipped++;
      }
      fresh();
      return equipped > 0;
    },
    check: () => true
  };

  // #4766 Mountain Deity Oni Blade, Kid Ibuki: Enter -> choose an «Oni Assassin» on your field, look at top 5 cards of deck,
  // put up to 2 from among them face-down in chosen card's soul, rest on bottom of deck; if entered by [Ambush], opponent drops 1 hand card
  OPS.r39MountainIbuki4766 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      const hosts = core.fieldUnits(ctx.side, true).filter(r => r.card && (hasAttr(r.card, "Oni Assassin") || hasAttr(r.card, "Oni Assassins")));
      const host = (hosts[0] && hosts[0].unit) || ctx.unit;
      if (host && f.deck.length > 0) {
        const top5 = f.deck.splice(0, 5);
        const toSoul = top5.splice(0, Math.min(2, top5.length));
        host.soul = host.soul || [];
        toSoul.forEach(cid => host.soul.push(makeSoul(cid, true)));
        f.deck.push(...top5);
      }
      if (isAmbushUnit(ctx.unit) && e.hand.length > 0) {
        e.drop.push(e.hand.pop());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6497 Oni Boss, Kid Ibuki "Re:B":
  // 1) Enter -> destroy a monster or item on opponent's field; if entered by [Ambush], deal un-reducible damage equal to destroyed card's critical
  // 2) Hand [Act] -> choose an «Oni Assassin» monster on your field, reveal this hand card, put it face-down into chosen monster's soul, and draw 1 card
  OPS.r39KidIbukiReBEnter6497 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      const cands = core.fieldUnits(es, true).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
      if (!cands.length) return false;
      const target = cands[0];
      const crit = Math.max(0, Number(target.card.crit) || 0);
      let destroyed = false;
      if (target.pos === "item" || target.pos === "item2") {
        const slot = target.pos;
        if (e[slot]) {
          if (Array.isArray(e[slot].soul)) e.drop.push(...e[slot].soul.map(getCid));
          e.drop.push(e[slot].card.id);
          e[slot] = null;
          destroyed = true;
        }
      } else {
        destroyed = B.destroyMonster(es, target.pos);
      }
      if (destroyed && isAmbushUnit(ctx.unit) && crit > 0) {
        core.applyDamage(es, crit, { kind: "effect", unreducible: true, sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r39KidIbukiReBHandAct6497 = {
    async run(s, ctx) {
      const f = ctx.f;
      const hIdx = f.hand.indexOf(ctx.card.id);
      if (hIdx < 0) return false;
      const hosts = core.fieldUnits(ctx.side, false).filter(r => r.card && (hasAttr(r.card, "Oni Assassin") || hasAttr(r.card, "Oni Assassins")));
      if (!hosts.length) return false;
      const cid = f.hand.splice(hIdx, 1)[0];
      const host = hosts[0].unit;
      host.soul = host.soul || [];
      host.soul.push(makeSoul(cid, true));
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
      fresh();
      return true;
    },
    check: () => true
  };
  OPS.r36HandToOniSoul = OPS.r39KidIbukiReBHandAct6497;

  // #5193 Informant, Bourbon:
  // 1) Hand [Act] -> choose a character (monster) on your field, reveal this hand card, put it face-down into chosen character's soul
  // 2) Enter -> +1 gauge and +1 life; if entered by card effects / [Ambush], drop 1 of opponent's gauge and deal 1 damage to opponent
  OPS.r39BourbonHandAct5193 = {
    async run(s, ctx) {
      const f = ctx.f;
      const hIdx = f.hand.indexOf(ctx.card.id);
      if (hIdx < 0) return false;
      const hosts = core.fieldUnits(ctx.side, false);
      if (!hosts.length) return false;
      const cid = f.hand.splice(hIdx, 1)[0];
      const host = hosts[0].unit;
      host.soul = host.soul || [];
      host.soul.push(makeSoul(cid, true));
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r39BourbonEnter5193 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      f.life += 1;
      if (isAmbushUnit(ctx.unit) || (ctx.unit && ctx.unit.abxEnteredByEffect)) {
        if (e.gauge.length > 0) e.drop.push(e.gauge.pop());
        core.applyDamage(es, 1, { kind: "effect", sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 5. FAMILY 2 — «CURSE DRAGON» / UNDER OPPONENT'S FLAG OPS ==================== */

  // #4942 Black-White Armor: [Counter] Nullify the attack; if opponent has a card under their flag, put up to 1 «Curse Dragon» monster from drop into hand
  OPS.r39BlackWhiteArmor4942 = {
    async run(s, ctx) {
      if (ABX.battleCtx && ABX.battleCtx.active) ABX.battleCtx.nullified = true;
      if (countOppUnderFlag(ctx.side) >= 1) {
        const f = ctx.f;
        const idx = f.drop.findIndex(id => { const c = cardOf(id); return c && c.type === "Monster" && hasAttr(c, "Curse Dragon"); });
        if (idx >= 0) f.hand.push(f.drop.splice(idx, 1)[0]);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4943 Black Dragon Knight, Geil:
  // 1) Enter -> if opponent has a card under their flag, destroy a card on opponent's field
  // 2) When destroyed -> you may pay 1 life -> put top card of opponent's deck face-up under their flag, and return this card from drop to hand
  OPS.r39GeilEnter4943 = {
    async run(s, ctx) {
      if (countOppUnderFlag(ctx.side) < 1) return false;
      const es = otherSide(ctx.side);
      const mons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
      if (mons.length > 0) B.destroyMonster(es, mons[0].pos);
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r39GeilLeave4943 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.life <= 1) return false;
      f.life -= 1;
      putTopOppDeckUnderFlag(ctx.side, 1);
      const di = f.drop.lastIndexOf(4943);
      if (di >= 0) f.hand.push(f.drop.splice(di, 1)[0]);
      fresh();
      return true;
    },
    check: () => true
  };

  // #4997 Sentence of Curse ([Set]):
  // At the start of your opponent's turn, put the top card of your opponent's deck face up under their flag.
  // Then, if your opponent has 15 or more cards under their flag, you win the fight!
  OPS.r39SentenceOfCurse4997 = {
    async run(s, ctx) {
      if (B.activeSide === ctx.side) return false;
      putTopOppDeckUnderFlag(ctx.side, 1);
      if (countOppUnderFlag(ctx.side) >= 15) {
        ctx.e.life = 0;
        if (B.finishMatch) B.finishMatch(ctx.side === "plr", "curse");
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4998 Curse Destruction:
  // [Cast Cost] [Destroy a «Curse Dragon» monster on your field]
  // Option 1: Drop top 2 cards of your deck; if "Black Dragon Knight, Geil" is among them, put top 3 cards of opponent's deck face up under their flag.
  // Option 2: [Counter] Destroy a card on your opponent's field.
  OPS.r39CurseDestruction4998 = {
    async run(s, ctx) {
      const f = ctx.f, es = otherSide(ctx.side);
      let choice = s.opt || (auto(ctx.side) ? 1 : 1);
      if (!s.opt && !auto(ctx.side)) {
        choice = (await UI.choose({
          title: ctx.card.name,
          sub: "Choose one:",
          options: [
            { label: "Drop top 2 of your deck (if Geil is among them, put top 3 of opponent's deck under their flag)", value: 1 },
            { label: "[Counter] Destroy a card on your opponent's field", value: 2 }
          ]
        })) || 1;
      }
      if (choice === 1) {
        const dropped = f.deck.splice(0, 2);
        f.drop.push(...dropped);
        if (dropped.some(id => { const c = cardOf(id); return c && lc(c.name).includes("black dragon knight, geil"); })) {
          putTopOppDeckUnderFlag(ctx.side, 3);
        }
      } else {
        const mons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
        if (mons.length > 0) B.destroyMonster(es, mons[0].pos);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4999 Black Dragon Knight, Belze: When destroyed, if opponent has 3+ hand cards and a card under their flag, gain 1 life and opponent drops 1 hand card
  OPS.r39Belze4999 = {
    async run(s, ctx) {
      if (countOppUnderFlag(ctx.side) >= 1 && ctx.e.hand.length >= 3) {
        ctx.f.life += 1;
        ctx.e.drop.push(ctx.e.hand.pop());
        fresh();
        return true;
      }
      return false;
    },
    check: () => true
  };

  // #5000 Black Dragon Knight, Zest: When destroyed, if opponent has a card under their flag, gain 1 life and drop 1 of opponent's gauge
  OPS.r39Zest5000 = {
    async run(s, ctx) {
      if (countOppUnderFlag(ctx.side) >= 1) {
        ctx.f.life += 1;
        if (ctx.e.gauge.length > 0) ctx.e.drop.push(ctx.e.gauge.pop());
        fresh();
        return true;
      }
      return false;
    },
    check: () => true
  };

  // #5006 Black Dragon Knight, Zevens the "Stygian": [Counter] [Act] Choose a monster on the field, drop 1 soul from this card -> destroy chosen card, and if opponent has a card under their flag, gain 2 life
  OPS.r39Zevens5006 = {
    async run(s, ctx) {
      if (!ctx.unit || !Array.isArray(ctx.unit.soul) || ctx.unit.soul.length < 1) return false;
      const es = otherSide(ctx.side);
      const mons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
      if (!mons.length) return false;
      ctx.f.drop.push(getCid(ctx.unit.soul.pop()));
      B.destroyMonster(es, mons[0].pos);
      if (countOppUnderFlag(ctx.side) >= 1) ctx.f.life += 2;
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return Boolean(ctx.unit && Array.isArray(ctx.unit.soul) && ctx.unit.soul.length >= 1);
    }
  };

  // #5039 Curse Ritual: Gain 2 life and draw 2 cards; then if opponent has 2+ cards under their flag, draw 1 card
  OPS.r39CurseRitual5039 = {
    async run(s, ctx) {
      const f = ctx.f;
      f.life += 2;
      for (let i = 0; i < 2 && f.deck.length > 0; i++) f.hand.push(f.deck.shift());
      if (countOppUnderFlag(ctx.side) >= 2 && f.deck.length > 0) f.hand.push(f.deck.shift());
      fresh();
      return true;
    },
    check: () => true
  };

  // #5058 Black Dragon Knight, Arbol: Enter -> +1 gauge and +1 life; if opponent has a card under their flag, draw 1 card
  OPS.r39Arbol5058 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      f.life += 1;
      if (countOppUnderFlag(ctx.side) >= 1 && f.deck.length > 0) f.hand.push(f.deck.shift());
      fresh();
      return true;
    },
    check: () => true
  };

  // #5061 Underration: Put up to 1 «Curse Dragon» monster from drop into hand; if 2+ under opp flag, gain 2 life; if 3+ under opp flag, +2 gauge
  OPS.r39Underration5061 = {
    async run(s, ctx) {
      const f = ctx.f;
      const idx = f.drop.findIndex(id => { const c = cardOf(id); return c && c.type === "Monster" && hasAttr(c, "Curse Dragon"); });
      if (idx >= 0) f.hand.push(f.drop.splice(idx, 1)[0]);
      const cnt = countOppUnderFlag(ctx.side);
      if (cnt >= 2) f.life += 2;
      if (cnt >= 3) {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.gauge.push(f.deck.shift());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5063 Black Dragon Sword, Geilblade: [Act] Pay 1 gauge and [Rest] this card -> put top card of opponent's deck face up under their flag; if 2+ under opp flag, draw 1 card
  OPS.r39Geilblade5063 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (!ctx.unit || ctx.unit.rested || f.gauge.length < 1) return false;
      f.drop.push(f.gauge.pop());
      ctx.unit.rested = true;
      putTopOppDeckUnderFlag(ctx.side, 1);
      if (countOppUnderFlag(ctx.side) >= 2 && f.deck.length > 0) f.hand.push(f.deck.shift());
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return Boolean(ctx.unit && !ctx.unit.rested && ctx.f.gauge.length >= 1);
    }
  };

  // #5064 Black Dragon Knight, Birth the "Demon-Eye": Attack -> drop top card of your deck; if monster, draw 1 card; if spell, put top card of opponent's deck face up under their flag
  OPS.r39Birth5064 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (!f.deck.length) return false;
      const cid = f.deck.shift();
      f.drop.push(cid);
      const c = cardOf(cid);
      if (c && c.type === "Monster" && f.deck.length > 0) f.hand.push(f.deck.shift());
      else if (c && c.type === "Spell") putTopOppDeckUnderFlag(ctx.side, 1);
      fresh();
      return true;
    },
    check: () => true
  };

  // #5065 Black Dragon Knight, Leopard: Enter -> if opponent has a card under their flag, put up to 3 «Curse Dragon» from your drop zone into this card's soul
  OPS.r39Leopard5065 = {
    async run(s, ctx) {
      if (!ctx.unit || countOppUnderFlag(ctx.side) < 1) return false;
      const f = ctx.f;
      ctx.unit.soul = ctx.unit.soul || [];
      for (let i = 0; i < 3; i++) {
        const idx = f.drop.findIndex(id => { const c = cardOf(id); return c && hasAttr(c, "Curse Dragon"); });
        if (idx < 0) break;
        ctx.unit.soul.push(f.drop.splice(idx, 1)[0]);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5066 Black Dragon Knight, Ynllay: Attack -> if opponent has a card under their flag, destroy a monster on opponent's field
  OPS.r39Ynllay5066 = {
    async run(s, ctx) {
      if (countOppUnderFlag(ctx.side) < 1) return false;
      const es = otherSide(ctx.side);
      const mons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
      if (mons.length > 0) B.destroyMonster(es, mons[0].pos);
      fresh();
      return true;
    },
    check: () => true
  };

  // #5067 Black Dragon Knight, Eth: Enter -> +1 gauge; if opponent has a card under their flag, +2 more gauge
  OPS.r39Eth5067 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      if (countOppUnderFlag(ctx.side) >= 1) {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.gauge.push(f.deck.shift());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5069 Scar Bind: [Counter] [Rest] a monster on opponent's field; if opponent has 8+ cards under their flag, [Rest] all cards on opponent's field instead
  OPS.r39ScarBind5069 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side);
      if (countOppUnderFlag(ctx.side) >= 8) {
        core.fieldUnits(es, true).forEach(r => { if (!core.isProtected(r.unit, es, "rest", ctx)) r.unit.rested = true; });
      } else {
        const mons = core.fieldUnits(es, false).filter(r => !r.unit.rested && !core.isProtected(r.unit, es, "rest", ctx));
        if (mons[0]) mons[0].unit.rested = true;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6363 Curse Count: At the end of your turn, put up to the top 2 cards of your opponent's deck under their flag face up
  OPS.r39CurseCountEnd6363 = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side) return false;
      putTopOppDeckUnderFlag(ctx.side, 2);
      return true;
    },
    check: () => true
  };

  // #6364 Assault of Silver Moon, Geil Luna:
  // 1) Enter -> put up to 1 «Curse Dragon» with [Set] from your deck or drop zone into your hand (shuffle if deck)
  // 2) Start of opponent's turn -> if a card is under opponent's flag, gain 3 life; if 8+ under opponent's flag, draw 1 card
  OPS.r39GeilLunaEnter6364 = {
    async run(s, ctx) {
      const f = ctx.f;
      let idx = f.drop.findIndex(id => { const c = cardOf(id); return c && c.set && hasAttr(c, "Curse Dragon"); });
      if (idx >= 0) {
        f.hand.push(f.drop.splice(idx, 1)[0]);
      } else {
        idx = f.deck.findIndex(id => { const c = cardOf(id); return c && c.set && hasAttr(c, "Curse Dragon"); });
        if (idx >= 0) {
          f.hand.push(f.deck.splice(idx, 1)[0]);
          if (B.shuffleFighterDeck) B.shuffleFighterDeck(ctx.side);
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r39GeilLunaTurnStart6364 = {
    async run(s, ctx) {
      if (B.activeSide === ctx.side) return false;
      const cnt = countOppUnderFlag(ctx.side);
      if (cnt >= 1) ctx.f.life += 3;
      if (cnt >= 8 && ctx.f.deck.length > 0) ctx.f.hand.push(ctx.f.deck.shift());
      fresh();
      return cnt >= 1;
    },
    check: () => true
  };

  // #6424 Curse Grip: Choose a card on opponent's field and destroy it; if opponent has 6+ cards under their flag, put chosen card face up under opponent's flag instead
  OPS.r39CurseGrip6424 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      const cands = core.fieldUnits(es, true);
      if (!cands.length) return false;
      const target = cands[0];
      if (countOppUnderFlag(ctx.side) >= 6) {
        if (Array.isArray(target.unit.soul) && target.unit.soul.length) {
          e.drop.push(...target.unit.soul.splice(0).map(getCid));
        }
        if (target.pos === "item" || target.pos === "item2") e[target.pos] = null;
        else e.monsters[target.pos] = null;
        putCardsUnderOppFlag(ctx.side, [target.card.id]);
      } else if (!core.isProtected(target.unit, es, "destroyed", ctx)) {
        if (target.pos === "item" || target.pos === "item2") {
          if (Array.isArray(target.unit.soul)) e.drop.push(...target.unit.soul.map(getCid));
          e.drop.push(target.card.id);
          e[target.pos] = null;
        } else {
          B.destroyMonster(es, target.pos);
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 6. FAMILY 3 — "MAGIC TREASURE" OPS (#5968, #5969, #5972, #5989) ==================== */

  // #5968 Grand Phantom Thief, Winds Harry: [Counter] [Act] (1/turn during attack phase) Pay 1 gauge -> draw 1 card,
  // look at top 4 of opponent's deck, put up to 2 into opponent's spell area face down as "Magic Treasure", rest on bottom of opponent's deck
  OPS.r39WindsHarry5968 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      if (f.gauge.length < 1) return false;
      f.drop.push(f.gauge.pop());
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
      const top4 = e.deck.splice(0, 4);
      const toTreasure = top4.splice(0, Math.min(2, top4.length));
      if (toTreasure.length > 0) putAsMagicTreasure(ctx.side, toTreasure);
      e.deck.push(...top4);
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return ctx.f.gauge.length >= 1;
    }
  };

  // #5969 Sky Castle of Drago Phantom Thief, "Lebla Maurice": If your buddy is a spell (or cast normally), put up to 4 cards from top of opponent's deck into opponent's spell area face down as "Magic Treasure"
  OPS.r39LeblaMaurice5969 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      const buddyCard = cardOf(f.buddyId);
      if (buddyCard && buddyCard.type !== "Spell" && f.buddyId !== 5969) return false;
      const taken = e.deck.splice(0, 4);
      if (taken.length > 0) putAsMagicTreasure(ctx.side, taken);
      fresh();
      return true;
    },
    check: () => true
  };

  // #5972 Steal Time, "We say good bye!":
  // [Counter] If 2+ "Magic Treasure" on opponent's field -> +2 gauge; if 4+ -> draw 2 cards; if 6+ -> gain 2 life; if 8+ -> deal 2 damage to opponent
  OPS.r39StealTime5972 = {
    async run(s, ctx) {
      const f = ctx.f, es = otherSide(ctx.side);
      const cnt = countMagicTreasures(ctx.e);
      if (cnt >= 2) {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.gauge.push(f.deck.shift());
      }
      if (cnt >= 4) {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.hand.push(f.deck.shift());
      }
      if (cnt >= 6) {
        f.life += 2;
      }
      if (cnt >= 8) {
        core.applyDamage(es, 2, { kind: "effect", sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return cnt >= 2;
    },
    check: () => true
  };

  // #5989 Adorable Phantom Thief, Sophie Parker: [Act] (1/turn) Choose up to 2 cards in opponent's drop zone and pay 1 gauge ->
  // put chosen cards into opponent's spell area face down as "Magic Treasure"; then if 4+ "Magic Treasure" on opponent's field, draw 1 card
  OPS.r39SophieParker5989 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      if (f.gauge.length < 1 || e.drop.length < 1) return false;
      f.drop.push(f.gauge.pop());
      const taken = e.drop.splice(0, Math.min(2, e.drop.length));
      putAsMagicTreasure(ctx.side, taken);
      if (countMagicTreasures(e) >= 4 && f.deck.length > 0) {
        f.hand.push(f.deck.shift());
      }
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return ctx.f.gauge.length >= 1 && ctx.e.drop.length >= 1;
    }
  };

  /* ==================== 7. FAMILY 4 — REMAINING OPPRESSED AREA OPS (#4697, #4861, #4965, #5004, #5043, #6374, #6448) ==================== */

  // #4697 Knight: Argento Lance: End of your turn, if on an oppressed area -> +1 gauge, +1 life, draw 1 card
  OPS.r39ArgentoLanceEnd4697 = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side || !isOnOppArea(ctx.side, ctx.unit)) return false;
      const f = ctx.f;
      if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      f.life += 1;
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return B.activeSide === ctx.side && isOnOppArea(ctx.side, ctx.unit);
    }
  };

  // #4861 Suppression Advantage: [Counter] +3 gauge; then if you have an oppressed area, destroy a spell or item on opponent's field
  OPS.r39SuppressionAdvantage4861 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      for (let i = 0; i < 3 && f.deck.length > 0; i++) f.gauge.push(f.deck.shift());
      if (hasOppArea(ctx.side)) {
        if (e.item && !e.item.isEndrulerFlag && !core.isProtected(e.item, es, "destroyed", ctx)) {
          if (Array.isArray(e.item.soul)) e.drop.push(...e.item.soul.map(getCid));
          e.drop.push(e.item.card.id);
          e.item = null;
        } else if (Array.isArray(e.setSpells) && e.setSpells.length > 0) {
          const sp = e.setSpells.pop();
          if (Array.isArray(sp.soul)) e.drop.push(...sp.soul.map(getCid));
          e.drop.push(sp.id);
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4965 Knowledge Wave: [Counter] Look at top 3 of your deck, put 1 into hand and rest into gauge; then if you have an oppressed area, gain 2 life
  OPS.r39KnowledgeWave4965 = {
    async run(s, ctx) {
      const f = ctx.f;
      const top3 = f.deck.splice(0, 3);
      if (top3.length > 0) {
        f.hand.push(top3.shift());
        f.gauge.push(...top3);
      }
      if (hasOppArea(ctx.side)) f.life += 2;
      fresh();
      return true;
    },
    check: () => true
  };

  // #5004 Declaration Check: [Counter] Nullify the attack; then if you have an oppressed area, +1 gauge and draw 1 card
  OPS.r39DeclarationCheck5004 = {
    async run(s, ctx) {
      if (ABX.battleCtx && ABX.battleCtx.active) ABX.battleCtx.nullified = true;
      if (hasOppArea(ctx.side)) {
        const f = ctx.f;
        if (f.deck.length > 0) f.gauge.push(f.deck.shift());
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5043 Rook: Viola Sword: End of your turn, if on an oppressed area -> destroy a card on opponent's field, and if you do, deal 1 damage to opponent
  OPS.r39ViolaSwordEnd5043 = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side || !isOnOppArea(ctx.side, ctx.unit)) return false;
      const es = otherSide(ctx.side);
      const oppMons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
      if (oppMons.length > 0 && B.destroyMonster(es, oppMons[0].pos)) {
        core.applyDamage(es, 1, { kind: "effect", sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return B.activeSide === ctx.side && isOnOppArea(ctx.side, ctx.unit);
    }
  };

  // #6374 Knight of Dawn, Lostknight: Gilt Lance:
  // 1) "Oppress" [Counter] [Act] (0 gauge cost!) -> put this card on opponent's open left or right
  // 2) End of your turn, if on an oppressed area -> deal 3 damage to opponent
  OPS.r39OppressFree6374 = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side || !ctx.unit) return false;
      const f = ctx.f, e = ctx.e, u = ctx.unit;
      const curPos = core.posOfUnit(f, u);
      if (!curPos) return false;
      const openOpp = ["left", "right"].filter(p => !e.monsters[p]);
      if (!openOpp.length) return false;
      const targetSlot = openOpp[0];
      if (curPos === "opp_left" || curPos === "opp_right") {
        const prevSlot = curPos === "opp_left" ? "left" : "right";
        if (e.monsters[prevSlot] === u) e.monsters[prevSlot] = null;
      } else if (f.monsters[curPos] === u) {
        f.monsters[curPos] = null;
      }
      u.oppressedBy = ctx.side;
      u.isOppressed = true;
      e.monsters[targetSlot] = u;
      e.oppressedAreas = e.oppressedAreas || {};
      e.oppressedAreas[targetSlot] = ctx.side;
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return B.activeSide === ctx.side && Boolean(ctx.unit) && ["left", "right"].some(p => !ctx.e.monsters[p]);
    }
  };

  OPS.r39GiltLanceEnd6374 = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side || !isOnOppArea(ctx.side, ctx.unit)) return false;
      core.applyDamage(otherSide(ctx.side), 3, { kind: "effect", sourceCard: ctx.card });
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return B.activeSide === ctx.side && isOnOppArea(ctx.side, ctx.unit);
    }
  };

  // #6448 Over Thousands of Boards ([Set]): [Counter] [Act] During your turn, if a monster with "Oppress" is on your field
  // and opponent has no monster on their center, choose a monster on opponent's left or right and move it to opponent's center
  OPS.r39OverThousandsAct6448 = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side) return false;
      const e = ctx.e;
      if (e.monsters.center) return false;
      const hasOppMon = core.fieldUnits(ctx.side, false).some(r => r.card && /"oppress"/i.test(r.card.skill || ""));
      if (!hasOppMon) return false;
      const sidePos = ["left", "right"].find(p => e.monsters[p] && !e.monsters[p].oppressedBy);
      if (!sidePos) return false;
      e.monsters.center = e.monsters[sidePos];
      e.monsters[sidePos] = null;
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return B.activeSide === ctx.side && !ctx.e.monsters.center;
    }
  };

  /* ==================== 8. FAMILY 5 — #4449 ECHT BIBLIO + REMAINING MODAL CARDS & MULTI-CARD OPS ==================== */

  // #4449 Illusions Folktale, Echt Biblio: [Counter] [Act] "Marchen Panic" (1/turn) Call up to 3 monsters from this card's soul on separate areas by paying their [Call Cost]
  OPS.r39MarchenPanic4449 = {
    async run(s, ctx) {
      const u = ctx.unit, f = ctx.f;
      if (!u || !Array.isArray(u.soul) || !u.soul.length) return false;
      let called = 0;
      for (let i = u.soul.length - 1; i >= 0 && called < 3; i--) {
        const cid = getCid(u.soul[i]);
        const c = cardOf(cid);
        if (!c || c.type !== "Monster") continue;
        const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
        if (!openPos) break;
        const cost = typeof parseCardCost === "function" ? parseCardCost(c.cost, c.skill, f, c) : { gauge: 0, life: 0 };
        if (f.gauge.length < (cost.gauge || 0) || (cost.life > 0 && f.life <= cost.life)) continue;
        for (let g = 0; g < (cost.gauge || 0); g++) f.drop.push(f.gauge.pop());
        if (cost.life > 0) f.life -= cost.life;
        u.soul.splice(i, 1);
        const newUnit = { card: c, rested: false, attacksLeft: c.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
        f.monsters[openPos] = newUnit;
        if (ABX.fireEnter && ABX.ownsEnter && ABX.ownsEnter(c)) await ABX.fireEnter(ctx.side, c, newUnit);
        called++;
      }
      fresh();
      return called > 0;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return Boolean(ctx.unit && Array.isArray(ctx.unit.soul) && ctx.unit.soul.length > 0);
    }
  };

  // #779 Distortion Punisher!!: Deal 4 damage to opponent (or Counter Final when opponent casts an impact)
  OPS.r39DistortionPunisher779 = {
    async run(s, ctx) {
      if (ctx.e.life > 4 || ctx.f.monsters.center || ctx.e.monsters.center) return false;
      core.applyDamage(otherSide(ctx.side), 4, { kind: "impact", sourceCard: ctx.card });
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  // #1257 Absolute Sword, Azure Cascade Formation: Option 1 deal 2 damage; Option 2 [Counter] next time life becomes 0 this turn, discard hand, life becomes 1, deal 2 damage
  OPS.r39AzureCascade1257 = {
    async run(s, ctx) {
      const f = ctx.f, es = otherSide(ctx.side);
      const choice = s.opt || 1;
      if (choice === 1) {
        core.applyDamage(es, 2, { kind: "impact", sourceCard: ctx.card });
      } else {
        const dropped = f.hand.splice(0);
        f.drop.push(...dropped);
        f.life = Math.max(1, f.life);
        core.applyDamage(es, 2, { kind: "impact", sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  // #1604 Respective Battles: Option 1 gain 2 life; Option 2 [Ride] a monster with [Ride] from drop zone by paying its [Ride] cost
  OPS.r39RespectiveBattles1604 = {
    async run(s, ctx) {
      const f = ctx.f;
      const rideIdx = f.drop.findIndex(id => { const c = cardOf(id); return c && c.ride; });
      const choice = s.opt || (rideIdx >= 0 && !f.item ? 2 : 1);
      if (choice === 2 && rideIdx >= 0) {
        const cid = f.drop[rideIdx];
        if (ABX.equipFrom) ABX.equipFrom(ctx.side, "drop", cid, true);
        else {
          f.drop.splice(rideIdx, 1);
          const rc = cardOf(cid);
          f.item = { card: rc, rested: false, attacksLeft: rc.atk_max || 1, soul: [] };
        }
      } else {
        f.life += 2;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #1718 Apocalypse Death Shield: Option 1 nullify attack; Option 2 all «Black Knight» monsters on your field are regarded as your buddy monster this turn
  OPS.r39ApocalypseShield1718 = {
    async run(s, ctx) {
      if (ABX.battleCtx && ABX.battleCtx.active) {
        ABX.battleCtx.nullified = true;
      } else {
        core.fieldUnits(ctx.side, false).forEach(r => {
          if (hasAttr(r.card, "Black Knight")) r.unit.isBuddyGift = true;
        });
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #2383 Encouragement of the White Veil: Option 1 item on field gets critical+1 and [Penetrate] this turn; Option 2 «Guardians» monster in battle gets +3000/+3000 and [Counterattack]
  OPS.r39WhiteVeil2383 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.item && (!ABX.battleCtx || !ABX.battleCtx.active)) {
        f.item.tempCrit = (f.item.tempCrit || 0) + 1;
        f.item.tempPen = true;
      } else {
        const gMon = core.fieldUnits(ctx.side, false).find(r => hasAttr(r.card, "Guardians"));
        if (gMon) {
          gMon.unit.tempPower = (gMon.unit.tempPower || 0) + 3000;
          gMon.unit.tempDef = (gMon.unit.tempDef || 0) + 3000;
          gMon.unit.tempCA = true;
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #2681 Killer Order: Option 1 +2 gauge (and +2 more if opp has 2+ more gauge than you); Option 2 destroy a size 0 monster on opponent's field
  OPS.r39KillerOrder2681 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      const s0 = core.fieldUnits(es, false).find(r => (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(e, r.card, r.unit) : (r.card.size || 0)) === 0 && !core.isProtected(r.unit, es, "destroyed", ctx));
      const choice = s.opt || (s0 ? 2 : 1);
      if (choice === 2 && s0) {
        B.destroyMonster(es, s0.pos);
      } else {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.gauge.push(f.deck.shift());
        if (e.gauge.length - f.gauge.length >= 2) {
          for (let i = 0; i < 2 && f.deck.length > 0; i++) f.gauge.push(f.deck.shift());
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #3005 Genocide Punisher!!:
  // Option 1: If opponent has 3 life or less, deal 3 damage to opponent
  // Option 2: [Counter] "Counter Final!!" Deal damage to opponent equal to number of different cards with "Purgatory Knights" in drop zone
  OPS.r39GenocidePunisher3005 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      if (f.monsters.center || e.monsters.center) return false;
      const pkNames = new Set(f.drop.map(id => cardOf(id)).filter(c => c && nameHas(c, "Purgatory Knights")).map(c => lc(c.name)));
      const choice = s.opt || (e.life <= 3 && pkNames.size < 3 ? 1 : 2);
      if (choice === 1) {
        if (e.life <= 3) core.applyDamage(es, 3, { kind: "impact", sourceCard: ctx.card });
      } else if (pkNames.size > 0) {
        core.applyDamage(es, pkNames.size, { kind: "impact", sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  // #3590 Loyalty: Option 1 reduce next damage this turn by 2; Option 2 drop a soul from a monster on the field; Option 3 opponent cannot call >3 monsters this turn
  OPS.r39Loyalty3590 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      const oppWithSoul = core.fieldUnits(es, false).find(r => Array.isArray(r.unit.soul) && r.unit.soul.length > 0);
      const choice = s.opt || (oppWithSoul ? 2 : 1);
      if (choice === 1) {
        (f.abxShields = f.abxShields || []).push({ kind: "any", by: 2, turn: B.turnCount });
      } else if (choice === 2 && oppWithSoul) {
        e.drop.push(getCid(oppWithSoul.unit.soul.pop()));
      } else {
        e.abxMaxCallsTurn = { turn: B.turnCount, max: 3 };
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5031 Day of Devastation: Option 1 destroy all opponent monsters and deal 1 damage per card destroyed;
  // Option 2 for this turn all cards on your field cannot be destroyed, returned to hand, or have abilities nullified by opponent's card effects
  OPS.r39DayOfDevastation5031 = {
    async run(s, ctx) {
      const f = ctx.f, es = otherSide(ctx.side);
      const oppMons = core.fieldUnits(es, false).filter(r => !core.isProtected(r.unit, es, "destroyed", ctx));
      const choice = s.opt || (oppMons.length > 0 ? 1 : 2);
      if (choice === 1) {
        let destroyed = 0;
        oppMons.forEach(r => { if (B.destroyMonster(es, r.pos)) destroyed++; });
        if (destroyed > 0) {
          core.applyDamage(es, destroyed, { kind: "effect", sourceCard: ctx.card });
          if (B.checkWinCondition) B.checkWinCondition();
        }
      } else {
        f.abxProtectAllFieldTurn = B.turnCount;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5125 "Friendship Blade" Deity Creations Fangflare, Gargantua Punisher!!:
  // Option 1: Destroy all cards on your opponent's field five times!!
  // Option 2: Return all cards from your opponent's field to hand five times!!
  OPS.r39FriendshipFangflare5125 = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = ctx.e;
      const choice = s.opt || 1;
      for (let pass = 0; pass < 5; pass++) {
        if (choice === 1) {
          core.fieldUnits(es, false).forEach(r => {
            if (!core.isProtected(r.unit, es, "destroyed", ctx)) B.destroyMonster(es, r.pos);
          });
          ["item", "item2"].forEach(slot => {
            if (e[slot] && !e[slot].isEndrulerFlag && !core.isProtected(e[slot], es, "destroyed", ctx)) {
              if (Array.isArray(e[slot].soul)) e.drop.push(...e[slot].soul.map(getCid));
              e.drop.push(e[slot].card.id);
              e[slot] = null;
            }
          });
          if (Array.isArray(e.setSpells) && e.setSpells.length) {
            const sps = e.setSpells.splice(0);
            sps.forEach(sp => {
              if (Array.isArray(sp.soul)) e.drop.push(...sp.soul.map(getCid));
              e.drop.push(sp.id);
            });
          }
        } else {
          core.fieldUnits(es, true).forEach(r => {
            if (!core.isProtected(r.unit, es, "returned to hand", ctx)) {
              core.sendUnitTo(es, r.pos, r.unit, "hand", ctx);
            }
          });
          if (Array.isArray(e.setSpells) && e.setSpells.length) {
            const sps = e.setSpells.splice(0);
            sps.forEach(sp => {
              if (Array.isArray(sp.soul)) e.drop.push(...sp.soul.map(getCid));
              e.hand.push(sp.id);
            });
          }
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5349 Buddy Trust!: Option 1 reduce damage from opponent's monster effects by 2 this turn; Option 2 all monsters on each player's field cannot be returned to hand this turn
  OPS.r39BuddyTrust5349 = {
    async run(s, ctx) {
      const choice = s.opt || 1;
      if (choice === 1) ctx.f.abxMonsterEffectReduceTurn = B.turnCount;
      else ctx.f.abxNoReturnTurn = B.turnCount;
      fresh();
      return true;
    },
    check: () => true
  };

  // #5925 Special Signature to Save a Soul:
  // Option 1: Gain 2 life for each different «Neon Genesis Junior High Student» in your drop zone!
  // Option 2: [Transform] into up to one "Gridman" from your hand or drop zone by paying its [Transform] cost.
  OPS.r39SpecialSignature5925 = {
    async run(s, ctx) {
      const f = ctx.f;
      const students = new Set(f.drop.map(id => cardOf(id)).filter(c => c && hasAttr(c, "Neon Genesis Junior High Student")).map(c => lc(c.name)));
      const gridmanId = [...f.hand, ...f.drop].find(id => { const c = cardOf(id); return c && nameHas(c, "Gridman") && c.tr; });
      const choice = s.opt || (students.size > 0 || !gridmanId ? 1 : 2);
      if (choice === 1) {
        if (students.size > 0) f.life += students.size * 2;
      } else if (gridmanId) {
        const area = f.hand.includes(gridmanId) ? "hand" : "drop";
        if (ABX.equipFrom) ABX.equipFrom(ctx.side, area, gridmanId, true);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5992 Great Electrodeity of Freedom, Izanami:
  // [Counter] [Act] "Leave it to me!" (1/turn):
  // Option 1: During your turn, drop 5 different size 3 «Electrodeity» from your hand -> after this turn, you get another turn!
  // Option 2: Call a size 3 «Electrodeity» from your drop zone without paying its [Call Cost], and it becomes size 0 until it leaves the field.
  OPS.r39Izanami5992 = {
    async run(s, ctx) {
      const f = ctx.f;
      const dropElectro = f.drop.find(id => { const c = cardOf(id); return c && c.type === "Monster" && c.size === 3 && hasAttr(c, "Electrodeity"); });
      const choice = s.opt || (dropElectro ? 2 : 1);
      if (choice === 2 && dropElectro) {
        const di = f.drop.indexOf(dropElectro);
        const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
        if (di >= 0 && openPos) {
          const cid = f.drop.splice(di, 1)[0];
          const c = cardOf(cid);
          f.monsters[openPos] = { card: Object.assign({}, c, { size: 0 }), rested: false, attacksLeft: c.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
        }
      } else {
        const byName = new Map();
        f.hand.forEach(id => {
          const c = cardOf(id);
          if (c && c.type === "Monster" && c.size === 3 && hasAttr(c, "Electrodeity") && !byName.has(lc(c.name))) {
            byName.set(lc(c.name), id);
          }
        });
        if (byName.size >= 5 && B.activeSide === ctx.side) {
          let n = 0;
          for (const id of byName.values()) {
            if (n >= 5) break;
            const hi = f.hand.indexOf(id);
            if (hi >= 0) { f.drop.push(f.hand.splice(hi, 1)[0]); n++; }
          }
          if (OPS.extraPhase && OPS.extraPhase.run) await OPS.extraPhase.run({ what: "turn" }, ctx);
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6023 Kronos Vant: Option 1 choose a card on your field per flag [Reversal] -> stats cannot be reduced by opponent's effects this turn;
  // Option 2 choose a card on opponent's field per flag [Reversal] -> cannot gain stats by card effects this turn
  OPS.r39KronosVant6023 = {
    async run(s, ctx) {
      const f = ctx.f;
      const revCnt = typeof getFighterReversalCount === "function" ? getFighterReversalCount(f) : 1;
      core.fieldUnits(ctx.side, true).slice(0, Math.max(1, revCnt)).forEach(r => {
        r.unit.abxNoStatReduceTurn = B.turnCount;
      });
      fresh();
      return true;
    },
    check: () => true
  };

  // #6201 Grace of the Sun Deity:
  // Option 1: For this turn, you cannot take damage by your opponent's card effects.
  // Option 2: Choose a card on your field -> cannot be destroyed, leave the field, or have its souls dropped/returned to deck by opponent's effects this turn.
  OPS.r39GraceSunDeity6201 = {
    async run(s, ctx) {
      const myUnits = core.fieldUnits(ctx.side, true);
      const choice = s.opt || (myUnits.length > 0 ? 2 : 1);
      if (choice === 1) {
        ctx.f.abxNoEffectDamageTurn = B.turnCount;
      } else if (myUnits[0]) {
        myUnits[0].unit.abxGraceProtectedTurn = B.turnCount;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6272 First Ace:
  // [Counter] [Act] (1/turn during your attack phase):
  // Option 1: "Gravity Control" [Stand] all cards on your field.
  // Option 2: "Count Drain" Opponent drops 1 hand card -> if they do, you draw 1 card.
  // Option 3: "Force Drain" Drop up to 2 of opponent's gauge, and put top card of your deck into your gauge for each dropped.
  OPS.r39FirstAceAct6272 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      const anyRested = core.fieldUnits(ctx.side, true).some(r => r.unit && r.unit.rested);
      const choice = s.opt || (anyRested ? 1 : e.gauge.length >= 2 ? 3 : 2);
      if (choice === 1) {
        core.fieldUnits(ctx.side, true).forEach(r => {
          r.unit.rested = false;
          r.unit.attacksLeft = Math.max(1, r.unit.attacksLeft || 1);
        });
      } else if (choice === 2) {
        if (e.hand.length > 0) {
          e.drop.push(e.hand.pop());
          if (f.deck.length > 0) f.hand.push(f.deck.shift());
        }
      } else {
        const dropped = Math.min(2, e.gauge.length);
        for (let i = 0; i < dropped; i++) {
          e.drop.push(e.gauge.pop());
          if (f.deck.length > 0) f.gauge.push(f.deck.shift());
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6283 Rokusho: When this card attacks, draw 1 card, and choose one of three:
  // Option 1: "Enemy Searching" All characters (monsters) on your field get power+5000 this turn
  // Option 2: "Sword" Drop 1 soul from a monster in battle on opponent's field, and destroy it
  // Option 3: "Hammer" For this battle, this card gets power+10000, critical+3 and [Penetrate], but loses [Soulguard]
  OPS.r39RokushoAttack6283 = {
    async run(s, ctx) {
      const f = ctx.f, es = otherSide(ctx.side), u = ctx.unit;
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
      const oppMon = core.fieldUnits(es, false)[0];
      const choice = s.opt || (oppMon ? 2 : 3);
      if (choice === 1) {
        core.fieldUnits(ctx.side, false).forEach(r => { r.unit.tempPower = (r.unit.tempPower || 0) + 5000; });
      } else if (choice === 2 && oppMon) {
        if (Array.isArray(oppMon.unit.soul) && oppMon.unit.soul.length > 0) {
          ctx.e.drop.push(getCid(oppMon.unit.soul.pop()));
        }
        if (!core.isProtected(oppMon.unit, es, "destroyed", ctx)) B.destroyMonster(es, oppMon.pos);
      } else if (u) {
        u.tempPower = (u.tempPower || 0) + 10000;
        u.tempCrit = (u.tempCrit || 0) + 3;
        u.tempPen = true;
        u.abxLost = u.abxLost || {};
        u.abxLost.soulguard = B.turnCount;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6373 Crevice of Dream & Reality, ReAc: Moon: [Counter] [Act] Drop this card from your hand -> choose 1 of 3:
  // Option 1: Put a card from opponent's drop zone on bottom of their deck
  // Option 2: During attack phase of this turn, if dealt 5+ damage, reduced to 0
  // Option 3: During this turn, stats of all cards on your field cannot be reduced by opponent's card effects
  OPS.r39ReAcMoon6373 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      const hi = f.hand.indexOf(6373);
      if (hi >= 0) f.drop.push(f.hand.splice(hi, 1)[0]);
      const choice = s.opt || (e.drop.length > 0 ? 1 : 2);
      if (choice === 1 && e.drop.length > 0) {
        e.deck.push(e.drop.pop());
      } else if (choice === 2) {
        (f.abxShields = f.abxShields || []).push({ kind: "any", min: 5, toZero: true, turn: B.turnCount });
      } else {
        core.fieldUnits(ctx.side, true).forEach(r => { r.unit.abxNoStatReduceTurn = B.turnCount; });
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6383 Happiness Art of Pleasant Warmth:
  // [Cast Cost] Put up to 3 «Ninja Arts» from your drop zone on bottom of your deck ->
  // Option 1: Put up to N cards from top of your deck face down on separate areas as «Dragod» Size 0 / 6000 / 6000 / 2 monsters
  // Option 2: Gain 1 life and +1 gauge for each card put
  OPS.r39HappinessWarmth6383 = {
    async run(s, ctx) {
      const f = ctx.f;
      let putCnt = 0;
      for (let i = 0; i < 3; i++) {
        const idx = f.drop.findIndex(id => { const c = cardOf(id); return c && hasAttr(c, "Ninja Arts"); });
        if (idx < 0) break;
        f.deck.push(f.drop.splice(idx, 1)[0]);
        putCnt++;
      }
      if (putCnt === 0) putCnt = 1;
      const choice = s.opt || 2;
      if (choice === 1) {
        for (let i = 0; i < putCnt && f.deck.length > 0; i++) {
          const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
          if (!openPos) break;
          const rawId = f.deck.shift();
          const tokenCard = Object.assign({}, cardOf(rawId) || cardOf(46), {
            id: rawId,
            name: "Dragod Shadow Token",
            type: "Monster",
            size: 0,
            power: 6000,
            defense: 6000,
            crit: 2,
            attrs: ["Dragod"]
          });
          f.monsters[openPos] = { card: tokenCard, rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
        }
      } else {
        f.life += putCnt;
        for (let i = 0; i < putCnt && f.deck.length > 0; i++) f.gauge.push(f.deck.shift());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6450 Proclaim: Tactics Divination:
  // Option 1: Put up to 2 «Astrodragon» monsters or items with different card names from your drop zone into your hand
  // Option 2: [Counter] If an «Astrodragon» monster is on your field, draw 1 card
  OPS.r39ProclaimTactics6450 = {
    async run(s, ctx) {
      const f = ctx.f;
      const seen = new Set();
      const pickedIds = [];
      f.drop.forEach(id => {
        const c = cardOf(id);
        if (c && (c.type === "Monster" || c.type === "Item") && hasAttr(c, "Astrodragon") && !seen.has(lc(c.name)) && pickedIds.length < 2) {
          seen.add(lc(c.name));
          pickedIds.push(id);
        }
      });
      const choice = s.opt || (pickedIds.length > 0 ? 1 : 2);
      if (choice === 1 && pickedIds.length > 0) {
        pickedIds.forEach(id => {
          const di = f.drop.indexOf(id);
          if (di >= 0) f.hand.push(f.drop.splice(di, 1)[0]);
        });
      } else if (core.fieldUnits(ctx.side, false).some(r => hasAttr(r.card, "Astrodragon"))) {
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6517 Legendary Kickoff:
  // Option 1: Choose a card on your field -> when it attacks and destroys opponent's monsters this turn, [Stand] it
  // Option 2: Equip an item from your hand or drop zone by paying its [Equip Cost]
  OPS.r39LegendaryKickoff6517 = {
    async run(s, ctx) {
      const f = ctx.f;
      const itemId = [...f.drop, ...f.hand].find(id => { const c = cardOf(id); return c && c.type === "Item"; });
      const choice = s.opt || (!f.item && itemId ? 2 : 1);
      if (choice === 2 && itemId && ABX.equipFrom) {
        const area = f.drop.includes(itemId) ? "drop" : "hand";
        ABX.equipFrom(ctx.side, area, itemId, true);
      } else {
        const u = core.fieldUnits(ctx.side, true)[0];
        if (u && u.unit) {
          u.unit.rested = false;
          u.unit.attacksLeft = (u.unit.attacksLeft || 1) + 1;
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6520 Disaster Palace: Draw 1 card, then Option 1 [Stand] all items on your field; Option 2 opponent's cards cannot link attack this turn
  OPS.r39DisasterPalace6520 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
      [f.item, f.item2].forEach(it => {
        if (it) {
          it.rested = false;
          it.attacksLeft = Math.max(1, it.attacksLeft || 1);
        }
      });
      fresh();
      return true;
    },
    check: () => true
  };

  // #6525 Purgatory Knights Leader, Demios Sword Dragon "Re:B":
  // [Counter] [Act] Destroy an «Armordragon» on your field -> Option 1 [Stand] this card and draw 1 card; Option 2 damage you take is reduced by 1 this turn
  OPS.r39DemiosReBAct6525 = {
    async run(s, ctx) {
      const f = ctx.f, u = ctx.unit;
      const armor = core.fieldUnits(ctx.side, false).find(r => hasAttr(r.card, "Armordragon") && r.unit !== u) || core.fieldUnits(ctx.side, false).find(r => hasAttr(r.card, "Armordragon"));
      if (!armor) return false;
      B.destroyMonster(ctx.side, armor.pos);
      const choice = s.opt || 1;
      if (choice === 1 && u) {
        u.rested = false;
        u.attacksLeft = Math.max(1, (u.attacksLeft || 0) + 1);
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
      } else {
        (f.abxShields = f.abxShields || []).push({ kind: "any", by: 1, continuous: true, turn: B.turnCount });
      }
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return core.fieldUnits(ctx.side, false).some(r => hasAttr(r.card, "Armordragon"));
    }
  };

  // #5673 The Convulsion: Return all cards from your hand, gauge and drop zone to your deck, shuffle it, draw 6 cards, +2 gauge, life becomes 10
  OPS.r39TheConvulsion5673 = {
    async run(s, ctx) {
      const f = ctx.f;
      f.deck.push(...f.hand.splice(0), ...f.gauge.splice(0), ...f.drop.splice(0));
      if (B.shuffleFighterDeck) B.shuffleFighterDeck(ctx.side);
      f.hand.push(...f.deck.splice(0, 6));
      f.gauge.push(...f.deck.splice(0, 2));
      f.life = 10;
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 9. PER-CARD ABILITY OVERRIDES ==================== */
  const C = (op, extra) => Object.assign({ op }, extra || {});

  const MODAL_CARDS_R39 = {
    779: "r39DistortionPunisher779",
    1257: "r39AzureCascade1257",
    1604: "r39RespectiveBattles1604",
    1718: "r39ApocalypseShield1718",
    2383: "r39WhiteVeil2383",
    2681: "r39KillerOrder2681",
    3005: "r39GenocidePunisher3005",
    3590: "r39Loyalty3590",
    4998: "r39CurseDestruction4998",
    5031: "r39DayOfDevastation5031",
    5125: "r39FriendshipFangflare5125",
    5349: "r39BuddyTrust5349",
    5925: "r39SpecialSignature5925",
    6023: "r39KronosVant6023",
    6201: "r39GraceSunDeity6201",
    6383: "r39HappinessWarmth6383",
    6450: "r39ProclaimTactics6450",
    6517: "r39LegendaryKickoff6517",
    6520: "r39DisasterPalace6520"
  };

  const OV = [
    // Family 1: [Ambush]
    [2804, /when this card enters the field, destroy a monster on your opponent's field/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39KidIbuki2804")] })],
    [2868, /if this card enters the field by \[ambush\], draw a card/i, () => ({ kind: "triggered", trigger: { event: "enter", self: true }, conds: [], steps: [C("r39Amanojaku2868")] })],
    [2869, /when your monsters enter the field by \[ambush\]/i, () => ({ kind: "rule", steps: [] })], // handled in handlePostAmbushTriggers + staticBonus
    [2872, /when this card enters the field, put up to one card with \[ambush\]/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39Kureha2872")] })],
    [2875, /when this card enters the field, choose a monster on your opponent's field, and put a soul/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39Yagyo2875")] })],
    [2964, /when this card enters the field, put up to one «oni assassins» item/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39AfflictionOni2964")] })],
    [2966, /when this card enters the field, choose a monster or item on your opponent's field/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39BodyKidIbuki2966")] })],
    [3604, /when this card enters the field, choose a card on your opponent's field/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39KidKuma3604")] })],
    [3927, /when this card enters the field, destroy a spell on your opponent's field/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39Hannya3927")] })],
    [3958, /when this card enters the field, put the top card of your deck into your gauge/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39UjiBridge3958")] })],
    [4022, /when this card enters the field, for this turn, it gets \[double attack\]/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39Tsuchigumo4022")] })],
    [4026, /when an «oni assassin» monster enters your field by \[ambush\]/i, () => ({ kind: "rule", steps: [] })], // handled in handlePostAmbushTriggers
    [4027, /when an «oni assassin» monster enters your field by \[ambush\]/i, () => ({ kind: "rule", steps: [] })], // handled in handlePostAmbushTriggers
    [4178, /when this card enters the field, destroy a card on your opponent's field/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39AkuroOh4178")] })],
    [4195, /equip up to two «hero» items from your drop zone/i, () => ({ kind: "spell", once: "turn", conds: [], steps: [C("r39OneWhoLeads4195")] })],
    [4766, /when this card enters the field, choose an «oni assassin» on your field/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39MountainIbuki4766")] })],
    [6497, /when this card enters the field, destroy a monster or an item on your opponent's field/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39KidIbukiReBEnter6497")] })],
    [6497, /choose an «oni assassin» monster on your field/i, () => ({ kind: "act", tags: ["act"], cleaned: "Choose an «Oni Assassin» monster on your field", conds: [], steps: [C("r39KidIbukiReBHandAct6497")] })],
    [5193, /choose a character on your field/i, () => ({ kind: "act", tags: ["act"], cleaned: "Choose a character on your field", conds: [], steps: [C("r39BourbonHandAct5193")] })],
    [5193, /when this card enters the field, put the top card of your deck into your gauge/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39BourbonEnter5193")] })],

    // Family 2: «Curse Dragon» / Under Opponent's Flag
    [4942, /nullify the attack.*if your opponent has a card under their flag/i, () => ({ kind: "spell", tags: ["counter"], counter: true, conds: [], steps: [C("r39BlackWhiteArmor4942")] })],
    [4943, /when this card enters the field, if your opponent has a card under their flag/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39GeilEnter4943")] })],
    [4943, /when this card is destroyed, you may pay 1 life/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, byOpp: false }, conds: [], steps: [C("r39GeilLeave4943")] })],
    [4997, /at the start of your opponent's turn, put the top card of your opponent's deck face up under their flag/i, () => ({ kind: "triggered", trigger: { event: "turnStart", who: "opp" }, conds: [], steps: [C("r39SentenceOfCurse4997")] })],
    [4999, /when this card is destroyed, if your opponent has three or more hand cards/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, byOpp: false }, conds: [], steps: [C("r39Belze4999")] })],
    [5000, /when this card is destroyed, if your opponent has a card under their flag/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, byOpp: false }, conds: [], steps: [C("r39Zest5000")] })],
    [5006, /the size of all originally size 1 «curse dragon» on your field is reduced by 1/i, () => ({ kind: "rule", steps: [] })], // handled in sizeDelta
    [5006, /choose a monster on the field, and you may drop a soul from this card/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r39Zevens5006")] })],
    [5039, /you gain 2 life, and draw two cards\. then, if your opponent has two or more cards under their flag/i, () => ({ kind: "spell", once: "turn", conds: [], steps: [C("r39CurseRitual5039")] })],
    [5058, /when this card enters the field, put the top card of your deck into your gauge.*under their flag/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39Arbol5058")] })],
    [5061, /put up to one «curse dragon» monster from your drop zone into your hand/i, () => ({ kind: "spell", once: "turn", conds: [], steps: [C("r39Underration5061")] })],
    [5063, /all «curse dragon» on your field cannot be destroyed/i, () => ({ kind: "rule", steps: [] })], // handled in isProtected
    [5063, /you may pay 1 gauge and \[rest\] this card/i, () => ({ kind: "act", tags: ["act"], conds: [], steps: [C("r39Geilblade5063")] })],
    [5064, /when this card attacks, drop the top card of your deck/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "attack", self: true }, conds: [], steps: [C("r39Birth5064")] })],
    [5065, /when this card enters the field, if your opponent has a card under their flag/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39Leopard5065")] })],
    [5066, /when this card attacks, if your opponent has a card under their flag/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "attack", self: true }, conds: [], steps: [C("r39Ynllay5066")] })],
    [5067, /when this card enters the field, put the top card of your deck into your gauge.*under their flag/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39Eth5067")] })],
    [5068, /during your opponent's turn, when this card is destroyed, if your opponent has a card under their flag/i, () => ({ kind: "triggered", trigger: { event: "leave", self: true, byOpp: false }, conds: [], steps: [{ op: "life", who: "you", n: 2 }] })],
    [5069, /\[rest\] a monster on your opponent's field\. if your opponent has eight or more cards under their flag/i, () => ({ kind: "spell", tags: ["counter"], counter: true, conds: [], steps: [C("r39ScarBind5069")] })],
    [5070, /when a card is put under your opponent's flag by your card effects/i, () => ({ kind: "rule", steps: [] })], // handled in putCardsUnderOppFlag
    [6363, /if a «curse dragon» monster is on your field, damage you take are reduced by 1/i, () => ({ kind: "rule", steps: [] })], // handled in applyDamage
    [6363, /at the end of your turn, put up to the top two cards of your opponent's deck under their flag/i, () => ({ kind: "triggered", trigger: { event: "turnEnd", who: "you" }, conds: [], steps: [C("r39CurseCountEnd6363")] })],
    [6364, /when this card enters the field, put up to one «curse dragon» with \[set\]/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "enter", self: true }, conds: [], steps: [C("r39GeilLunaEnter6364")] })],
    [6364, /at the start of your opponent's turn, if a card is under your opponent's flag/i, () => ({ kind: "triggered", trigger: { event: "turnStart", who: "opp" }, conds: [], steps: [C("r39GeilLunaTurnStart6364")] })],
    [6424, /choose a card on your opponent's field, and destroy the chosen card\. if your opponent has six or more cards under their flag/i, () => ({ kind: "spell", tags: ["counter"], counter: true, once: "turn", conds: [], steps: [C("r39CurseGrip6424")] })],

    // Family 3: "Magic Treasure"
    [5968, /look at up to four cards from the top of your opponent's deck.*magic treasure/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r39WindsHarry5968")] })],
    [5969, /you may use this card as your buddy/i, () => ({ kind: "rule", steps: [] })],
    [5969, /if your buddy is a spell, put up to four cards from the top of your opponent's deck/i, () => ({ kind: "spell", once: "turn", conds: [], steps: [C("r39LeblaMaurice5969")] })],
    [5970, /the abilities of all «drago phantom thief» on your field cannot be nullified/i, () => ({ kind: "rule", steps: [] })],
    [5970, /when a "magic treasure" is put on your opponent's field/i, () => ({ kind: "rule", steps: [] })],
    [5972, /if two or more "magic(?: magic)? treasure" are on your opponent's field/i, () => ({ kind: "spell", tags: ["counter"], counter: true, once: "turn", conds: [], steps: [C("r39StealTime5972")] })],
    [5973, /if four or more "magic treasure" are on your opponent's field/i, () => ({ kind: "rule", steps: [] })],
    [5973, /if six or more "magic treasure" are on your opponent's field/i, () => ({ kind: "rule", steps: [] })],
    [5989, /when a "magic treasure" is put on your opponent's field/i, () => ({ kind: "rule", steps: [] })],
    [5989, /choose up to two cards in your opponent's drop zone, and pay 1 gauge/i, () => ({ kind: "act", tags: ["act"], once: "turn", conds: [], steps: [C("r39SophieParker5989")] })],
    [6169, /if a "magic treasure" is on your opponent's field/i, () => ({ kind: "rule", steps: [] })],
    [6169, /when a "magic treasure" is put on your opponent's field/i, () => ({ kind: "rule", steps: [] })],
    [6169, /if two or more "magic treasure" are on your opponent's field/i, () => ({ kind: "rule", steps: [] })],

    // Family 4: Remaining Oppressed Area Cards
    [4697, /"oppress"|put this card on your opponent's open left or right/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r38OppressAct")] })],
    [4697, /at the end of your turn, if this card is on an oppressed area/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "turnEnd", who: "you" }, conds: [], steps: [C("r39ArgentoLanceEnd4697")] })],
    [4861, /put the top three cards of your deck into your gauge\. then, if you have an oppressed area/i, () => ({ kind: "spell", tags: ["counter"], counter: true, once: "turn", conds: [], steps: [C("r39SuppressionAdvantage4861")] })],
    [4965, /look at the top three cards of your deck.*if you have an oppressed area/i, () => ({ kind: "spell", tags: ["counter"], counter: true, once: "turn", conds: [], steps: [C("r39KnowledgeWave4965")] })],
    [5004, /nullify the attack\. then, if you have an oppressed area/i, () => ({ kind: "spell", tags: ["counter"], counter: true, conds: [], steps: [C("r39DeclarationCheck5004")] })],
    [5043, /"oppress"|put this card on your opponent's open left or right/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r38OppressAct")] })],
    [5043, /at the end of your turn, if this card is on an oppressed area/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "turnEnd", who: "you" }, conds: [], steps: [C("r39ViolaSwordEnd5043")] })],
    [6374, /"oppress"|put this card on your opponent's open left or right/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r39OppressFree6374")] })],
    [6374, /when this card would be destroyed, you may pay 1 gauge/i, () => ({ kind: "rule", steps: [] })], // handled in wouldLeaveSave
    [6374, /at the end of your turn, if this card is on an oppressed area/i, (ab) => ({ kind: "triggered", trigger: ab.trigger || { event: "turnEnd", who: "you" }, conds: [], steps: [C("r39GiltLanceEnd6374")] })],
    [6448, /all «drametal» on your field cannot be \[rest\]/i, () => ({ kind: "rule", steps: [] })],
    [6448, /during your turn, if a monster with "oppress" is on your field/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r39OverThousandsAct6448")] })],
    [6449, /if you have an oppressed area, this card's size on the field is reduced by 1/i, () => ({ kind: "rule", steps: [] })],
    [6449, /"oppress"|put this card on your opponent's open left or right/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r38OppressAct")] })],
    [6449, /all monsters on your oppressed areas get power\+3000/i, () => ({ kind: "rule", steps: [] })],

    // Family 5: #4449 Echt Biblio & Multi-card rules
    [4449, /if a «folktale» monster on your field would be destroyed/i, () => ({ kind: "rule", steps: [] })], // handled in wouldLeaveSave
    [4449, /"marchen panic"|call up to three monsters from this card's soul/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r39MarchenPanic4449")] })],
    [402, /unaffected by the effects of "gleipnir"/i, () => ({ kind: "rule", steps: [] })],
    [835, /when this card is attacked or when this card would leave the field/i, () => ({ kind: "rule", steps: [] })],
    [974, /nullify the \[lifelink\] of size 3/i, () => ({ kind: "rule", steps: [] })],
    [1461, /if you have this card equipped, you may equip up to one "savage lance, eisen tiger"/i, () => ({ kind: "rule", steps: [] })],
    [1461, /if you have "savage lance, eisen tiger" on your field/i, () => ({ kind: "rule", steps: [] })],
    [1531, /reduce the damage dealt by the \[lifelink\]/i, () => ({ kind: "rule", steps: [] })],
    [2019, /this card is also regarded as "demonic demise dragon, azi dahaka"/i, () => ({ kind: "rule", steps: [] })],
    [3430, /your opponent cannot call monsters from the drop zone/i, () => ({ kind: "rule", steps: [] })],
    [3747, /this card on the field cannot be destroyed, and you cannot be dealt damage, by card effects/i, () => ({ kind: "rule", steps: [] })],
    [4145, /this card gets the "thunder mine" of the cards in its soul/i, () => ({ kind: "static", steps: [{ op: "static", kind: "soulShareNamed", name: "Thunder Mine" }] })],
    [4461, /if this card is in the soul of an item, it cannot be dropped by cards/i, () => ({ kind: "rule", steps: [] })],
    [4870, /"galaxy f"|if this card is on your center, all of the following abilities activate/i, () => ({ kind: "rule", steps: [] })],
    [5673, /return all cards from your hand, gauge and drop zone to your deck/i, () => ({ kind: "spell", tags: ["counter"], counter: true, conds: [], steps: [C("r39TheConvulsion5673")] })]
  ];

  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      if (card && MODAL_CARDS_R39[card.id] && r && Array.isArray(r.abilities)) {
        const opName = MODAL_CARDS_R39[card.id];
        const kept = r.abilities.filter(ab => ab.kind === "rule" || ab.kind === "cost" || ab.kind === "keyword");
        kept.push({
          kind: "spell",
          tags: card.cnt ? ["counter"] : [],
          counter: Boolean(card.cnt),
          conds: [],
          steps: [C(opName)],
          unparsed: [],
          r31: true,
          parsed: true,
          raw: card.skill || "",
          cleaned: card.skill || "",
          idx: kept.length,
          cardId: card.id
        });
        r.abilities = kept;
        return r;
      }

      if (card && [5992, 6272, 6283, 6373, 6525].includes(card.id) && r && Array.isArray(r.abilities)) {
        const kept = r.abilities.filter(ab => ab.kind === "cost" || ab.kind === "keyword");
        if (card.id === 5992) {
          kept.push({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r39Izanami5992")], unparsed: [], r31: true, parsed: true, raw: card.skill, cleaned: card.skill, idx: kept.length, cardId: 5992 });
        } else if (card.id === 6272) {
          kept.push({ kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r39FirstAceAct6272")], unparsed: [], r31: true, parsed: true, raw: card.skill, cleaned: card.skill, idx: kept.length, cardId: 6272 });
        } else if (card.id === 6283) {
          kept.push({ kind: "triggered", trigger: { event: "attack", self: true }, conds: [], steps: [C("r39RokushoAttack6283")], unparsed: [], r31: true, parsed: true, raw: card.skill, cleaned: card.skill, idx: kept.length, cardId: 6283 });
        } else if (card.id === 6373) {
          kept.push({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r39ReAcMoon6373")], unparsed: [], r31: true, parsed: true, raw: card.skill, cleaned: card.skill, idx: kept.length, cardId: 6373 });
        } else if (card.id === 6525) {
          kept.push({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r39DemiosReBAct6525")], unparsed: [], r31: true, parsed: true, raw: card.skill, cleaned: card.skill, idx: kept.length, cardId: 6525 });
        }
        r.abilities = kept;
        return r;
      }

      if (card && card.id === 4870 && r && Array.isArray(r.abilities)) {
        r.abilities = r.abilities.filter(ab => ab.kind === "cost" || ab.kind === "keyword");
        r.abilities.push({ kind: "rule", steps: [], unparsed: [], parsed: true, raw: card.skill, idx: r.abilities.length, cardId: 4870 });
        return r;
      }

      (r && r.abilities || []).forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        const full = String(ab.raw || "");
        for (const [id, re, build] of OV) {
          if (card.id !== id || !(re.test(raw) || re.test(full))) continue;
          const o = build(ab); if (!o) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.r31 = true; ab.parsed = true;
          if (o.cleaned) ab.cleaned = o.cleaned;
          if (o.once) ab.once = o.once;
          if (o.counter) ab.counter = true;
          if (o.tags) ab.tags = o.tags;
          if (o.trigger) ab.trigger = o.trigger;
          if (o.conds !== undefined) ab.conds = o.conds;
          break;
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  // Also hook #4026 Underworld Legion into post-Ambush triggers in abilities_r38.js
  if (ABX.triggerAmbushFromSoul) {
    const _origTAFS = ABX.triggerAmbushFromSoul;
    ABX.triggerAmbushFromSoul = function (side, cardId, rawEntry) {
      const res = _origTAFS.apply(this, arguments);
      if (res) {
        try {
          const f = F(side), es = otherSide(side);
          const ambCard = cardOf(getCid(cardId));
          if (ambCard && (hasAttr(ambCard, "Oni Assassin") || hasAttr(ambCard, "Oni Assassins"))) {
            core.fieldUnits(side, true).forEach(r => {
              if (r.card && r.card.id === 4026 && r.unit.abx4026Turn !== B.turnCount) {
                r.unit.abx4026Turn = B.turnCount;
                core.applyDamage(es, 1, { kind: "effect", sourceCard: r.card });
              }
              if (r.card && r.card.id === 2869 && r.unit.abx2869DestroyTurn !== B.turnCount && f.gauge.length >= 1) {
                const oppMons = core.fieldUnits(es, false).filter(or => !core.isProtected(or.unit, es, "destroyed", { side }));
                if (oppMons.length > 0) {
                  r.unit.abx2869DestroyTurn = B.turnCount;
                  f.drop.push(f.gauge.pop());
                  B.destroyMonster(es, oppMons[0].pos);
                }
              }
            });
          }
        } catch (e) { /* ignore */ }
      }
      return res;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
