/* ==================== ABX — round 38: User Rulings Batch 1, Verbal/Physical Auto-Triggers, Oppressed Areas & Face-Down [Ambush] ====================
 * 1. Batch 1 Modal Judgment Calls:
 *    - #2439 Demon Slay Interment Formation: Option 1 evaluates against the highest power among all valid «Weapon» cards currently on your field
 *      (whether it is an equipped Item or a Monster with the «Weapon» attribute). Option 2 destroys all spells on your opponent's field.
 *    - #5371 Ghost Story Cornet Loop: Option 1 blocks Spells only ("Events" = Spells, NOT Impacts) until the end of your next main phase.
 *      Option 2 reduces the next damage you take this turn to 0.
 *    - #5560 Melody of the Evil Moon: Option 1 draws a card and reduces the next damage you take this turn to 0.
 *      Option 2 caps life payment from 1 up to (Current Life - 1) and reduces damage you take for this turn by the life paid.
 *    - #6255 First Ace (Medachange): Affects Monsters only ("Characters" = standard Monster units on the field, not equipped Items).
 *      Includes [Call Cost] (drop all souls from a "First Ace" with 3+ souls on your field, then put that card into drop zone),
 *      cannot be destroyed or [Rest] by opponent's card effects, and [Counter] [Act] 1/turn modal ("Home Sick", "Reflect", "Tumble").
 * 2. Cards with Verbal / Joke / Physical Conditions (Trigger automatically without a UI prompt; physical requirements pre-fulfilled):
 *    - #907 Wandering Salaryman Buddyfighter, Amigo Takata: Attack -> draw 1 card; during opponent's turn when dealt 2+ damage -> auto-reduce by 1.
 *    - #1795 Buddyfight World Deity, (Self-Proclaimed) God Khoushan: Enter -> auto-execute for both players (1+ hand -> +1 life & discard 1; 0 hand -> +1 gauge).
 *    - #6068 Prejudice Against Testers, Kibaou: Put on field -> auto-gain 2 life immediately.
 *    - #5021 Silver Soul Release, Deity Gargantua Dragon: Silver coating hardcoded true -> always gets power+10000 on the field, plus D-[G.EVO].
 *    - #4148 Crabgantua Punisher!!: Crab legs condition hardcoded true -> requires no center monster on either field, deals 4 unnullifiable/unreducible damage.
 * 3. Oppressed Areas (#4677, #4699, #4702, #6154):
 *    - Monster resides visually and mechanically in enemy.monsters[openPos] ("left" or "right") with unit.oppressedBy = side, unit.isOppressed = true.
 *    - Does not occupy your own Left/Right/Center slots, blocks opponent from calling to that slot, counts as on your field for card counts,
 *      can declare attacks, stands at start of your turn, and can be chosen as a valid target for your own card effects/costs.
 * 4. [Ambush] Face-Down Soul Tracking:
 *    - [Ambush] triggers ONLY if the card was explicitly placed into the soul face-down ({ id, isFaceDown: true }).
 *    - If a card with [Ambush] enters a soul face-up (e.g. standard soulcharge) and is later sent to the drop zone, [Ambush] does NOT trigger.
 * Loaded after abilities_r37.js.
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
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;
  const getCid = (x) => (typeof root.getSoulCardId === "function" ? root.getSoulCardId(x) : (x && typeof x === "object" ? Number(x.id ?? x.cardId ?? x.valueOf()) : Number(x)));
  const isFD = (x) => x === true || (typeof root.isSoulEntryFaceDown === "function" ? root.isSoulEntryFaceDown(x) : Boolean(x && typeof x === "object" && x.isFaceDown === true));
  const makeSoul = (id, faceDown) => (typeof root.createSoulEntry === "function" ? root.createSoulEntry(id, faceDown) : (faceDown ? { id: getCid(id), isFaceDown: true } : getCid(id)));

  /* ==================== 1. OPPRESSED AREAS CORE INTEGRATION ==================== */
  // Extend core.fieldUnits and core.posOfUnit so a monster on an opponent's oppressed area belongs to `oppressedBy`!
  core.fieldUnits = function (fighterOrSide, includeItem) {
    const f = typeof fighterOrSide === "string" ? F(fighterOrSide) : fighterOrSide;
    const side = typeof fighterOrSide === "string" ? fighterOrSide : (f === B.plr ? "plr" : "opp");
    const enemy = F(otherSide(side));
    const out = [];
    if (f && f.monsters) {
      ["left", "center", "center2", "right"].forEach(p => {
        const u = f.monsters[p];
        if (u && (!u.oppressedBy || u.oppressedBy === side)) {
          out.push({ side, pos: p, unit: u, card: u.card, area: "monster" });
        }
      });
    }
    if (enemy && enemy.monsters) {
      ["left", "right"].forEach(p => {
        const u = enemy.monsters[p];
        if (u && u.oppressedBy === side) {
          out.push({ side, pos: "opp_" + p, hostSide: otherSide(side), hostPos: p, unit: u, card: u.card, area: "monster", isOppressed: true });
        }
      });
    }
    if (includeItem && f) {
      if (f.item && f.item.card && !f.item.isEndrulerFlag) out.push({ side, pos: "item", unit: f.item, card: f.item.card, area: "item" });
      if (f.item2 && f.item2.card) out.push({ side, pos: "item2", unit: f.item2, card: f.item2.card, area: "item" });
    }
    return out;
  };

  core.posOfUnit = function (f, u) {
    if (!f || !u) return null;
    for (const p of ["left", "center", "center2", "right"]) {
      if (f.monsters && f.monsters[p] === u) return p;
    }
    if (f.item === u) return "item";
    if (f.item2 === u) return "item2";
    const mySide = f === B.plr ? "plr" : (f === B.opp ? "opp" : null);
    if (mySide) {
      const enemy = mySide === "plr" ? B.opp : B.plr;
      if (enemy && enemy.monsters) {
        for (const p of ["left", "right"]) {
          if (enemy.monsters[p] === u && u.oppressedBy === mySide) return "opp_" + p;
        }
      }
    }
    return null;
  };

  // Prevent a player from calling a monster onto their own Left/Right slot while it is occupied by an opponent's oppressed monster
  if (typeof B.completeMonsterCall === "function") {
    const _origCMC = B.completeMonsterCall;
    B.completeMonsterCall = function (side, zonePos, handIdx, isBuddyCall, isAbilityCall) {
      const f = this.getFighter(side);
      const existing = f && f.monsters ? f.monsters[zonePos] : null;
      if (existing && existing.oppressedBy && existing.oppressedBy !== side) {
        if (!f.isBot) {
          this.pendingAction = null;
          this.setPrompt(`🚫 Your ${zonePos.toUpperCase()} zone is an Oppressed Area controlled by your opponent — you cannot call a monster there!`);
          this.renderBattle();
        }
        return;
      }
      return _origCMC.apply(this, arguments);
    };
  }

  // Stand oppressed monsters at the start of their controller's turn (and do NOT stand them on the opponent's turn)
  if (typeof B.startTurn === "function") {
    const _origStartTurn = B.startTurn;
    B.startTurn = function (side) {
      const enemy = this.getEnemy(side);
      const f = this.getFighter(side);
      // Save rested state of oppressed monsters on `f`'s board that belong to `enemy` so `f`'s startTurn doesn't stand them
      const enemyOwnedOnMyBoard = [];
      if (f && f.monsters) {
        ["left", "right"].forEach(p => {
          const u = f.monsters[p];
          if (u && u.oppressedBy && u.oppressedBy !== side) {
            enemyOwnedOnMyBoard.push({ unit: u, rested: u.rested, attacksLeft: u.attacksLeft });
          }
        });
      }
      if (f) f.r38TurnDamageReduce = 0;
      if (enemy) enemy.r38TurnDamageReduce = 0;
      const res = _origStartTurn.apply(this, arguments);
      enemyOwnedOnMyBoard.forEach(({ unit, rested, attacksLeft }) => {
        unit.rested = rested;
        unit.attacksLeft = attacksLeft;
      });
      // Stand `side`'s own oppressed monsters residing in `enemy.monsters`
      if (enemy && enemy.monsters) {
        ["left", "right"].forEach(p => {
          const u = enemy.monsters[p];
          if (u && u.oppressedBy === side) {
            if (u.abxNo && u.abxNo.stand === true) { u.abxNo.stand = false; } else u.rested = false;
            u.defenseZeroTurn = false;
            const eff = typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(f, u) : { qa: false, ta: false, da: false };
            u.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (u.card.atk_max || 1);
            u.tempPower = 0; u.tempDef = 0; u.tempCrit = 0;
            u.tempCA = false; u.tempDA = false; u.tempTA = false; u.tempQA = false; u.tempHA = false; u.tempSG = false; u.tempMove = false;
            u.tempIndestructible = false;
            u.actUsed = false;
          }
        });
      }
      return res;
    };
  }

  // Allow clicking an oppressed monster on the opponent's playmat to open your own field banner (Attack / Act / etc.)
  if (typeof B.onZoneClick === "function") {
    const _origOnZoneClick = B.onZoneClick;
    B.onZoneClick = function (zoneSide, zonePos) {
      if (this.isLocalTurn && this.isLocalTurn() && !this.pendingAction) {
        const mySide = this.activeSide;
        if (zoneSide !== mySide && (zonePos === "left" || zonePos === "right")) {
          const enemy = this.getFighter(zoneSide);
          const u = enemy && enemy.monsters ? enemy.monsters[zonePos] : null;
          if (u && u.oppressedBy === mySide) {
            this.openCardBanner({
              card: u.card,
              context: "field",
              side: mySide,
              zonePos: "opp_" + zonePos,
              unit: u
            });
            return;
          }
        }
      }
      return _origOnZoneClick.apply(this, arguments);
    };
  }

  // Helper: does `side` currently control an oppressed area (or a monster on an oppressed area)?
  function hasOppressedArea(side) {
    const enemy = F(otherSide(side));
    if (!enemy) return false;
    if (enemy.oppressedAreas && (enemy.oppressedAreas.left === side || enemy.oppressedAreas.right === side)) return true;
    return ["left", "right"].some(p => enemy.monsters && enemy.monsters[p] && enemy.monsters[p].oppressedBy === side);
  }
  function isUnitOnOppressedArea(side, unit) {
    if (!unit) return false;
    const enemy = F(otherSide(side));
    if (!enemy || !enemy.monsters) return Boolean(unit.isOppressed && unit.oppressedBy === side);
    return ["left", "right"].some(p => enemy.monsters[p] === unit && unit.oppressedBy === side);
  }
  ABX.hasOppressedArea = hasOppressedArea;
  ABX.isUnitOnOppressedArea = isUnitOnOppressedArea;

  /* ==================== 2. [AMBUSH] FACE-DOWN SOUL TRACKING & RESOLUTION ==================== */
  // Cards that explicitly place a card into soul FACE-DOWN:
  const FACEDOWN_SOUL_CARD_IDS = new Set([
    2799, 2800, 2801, 2803, 2804, 2868, 2869, 2870, 2872, 2874, 2875, 2877,
    2913, 2917, 2964, 2965, 2966, 2992, 3604, 3927, 3958, 3959, 4022, 4026,
    4027, 4178, 4195, 4766, 6497
  ]);

  function shouldPutSoulFaceDown(ctx, step) {
    if (step && step.faceDown) return true;
    if (!ctx) return false;
    const raw = lc((ctx.ab && (ctx.ab.raw || ctx.ab.cleaned)) || (ctx.card && ctx.card.skill) || "");
    if (raw.includes("face down into") && raw.includes("soul")) return true;
    if (raw.includes("into") && raw.includes("soul face down")) return true;
    if (ctx.card && FACEDOWN_SOUL_CARD_IDS.has(Number(ctx.card.id)) && raw.includes("face down")) return true;
    return false;
  }

  function markNewSoulEntriesFaceDown(unit, prevLen) {
    if (!unit || !Array.isArray(unit.soul)) return;
    for (let i = prevLen; i < unit.soul.length; i++) {
      unit.soul[i] = makeSoul(unit.soul[i], true);
    }
  }

  // Wrap OPS.putSoul and OPS.topDeckToUnitSoul so face-down soul insertions set `isFaceDown: true`
  if (OPS.putSoul) {
    const _origPutSoul = OPS.putSoul.run;
    OPS.putSoul.run = async function (s, ctx) {
      const fd = shouldPutSoulFaceDown(ctx, s);
      const host = (s.into === "chosen" && ctx.bind.chosen && ctx.bind.chosen[0] && ctx.bind.chosen[0].unit) ? ctx.bind.chosen[0].unit : ctx.unit;
      const prevLen = (host && Array.isArray(host.soul)) ? host.soul.length : 0;
      const r = await _origPutSoul.apply(this, arguments);
      if (fd && host && Array.isArray(host.soul)) markNewSoulEntriesFaceDown(host, prevLen);
      return r;
    };
  }
  if (OPS.topDeckToUnitSoul) {
    const _origTopSoul = OPS.topDeckToUnitSoul.run;
    OPS.topDeckToUnitSoul.run = async function (s, ctx) {
      const fd = shouldPutSoulFaceDown(ctx, s);
      const host = (s.into === "chosen" && ctx.bind.chosen && ctx.bind.chosen[0] && ctx.bind.chosen[0].unit) ? ctx.bind.chosen[0].unit : ctx.unit;
      const prevLen = (host && Array.isArray(host.soul)) ? host.soul.length : 0;
      const r = await _origTopSoul.apply(this, arguments);
      if (fd && host && Array.isArray(host.soul)) markNewSoulEntriesFaceDown(host, prevLen);
      return r;
    };
  }

  // Central [Ambush] trigger when a soul card is sent from a field card's soul to the drop zone:
  // ONLY triggers if `wasFaceDown === true`!
  const _ambushQueue = [];
  let _ambushRunning = false;

  async function processAmbushQueue() {
    if (_ambushRunning) return;
    _ambushRunning = true;
    try {
      while (_ambushQueue.length > 0) {
        const item = _ambushQueue.shift();
        const { side, cid } = item;
        const f = F(side);
        const c = cardOf(cid);
        if (!f || !c || !c.amb) continue;
        // Must still be in f.drop to be called by [Ambush]
        const dropIdx = f.drop.lastIndexOf(cid);
        if (dropIdx < 0) continue;

        let calledUnit = null;
        if (ABX.placeFromZone) {
          const beforeUnits = new Set(core.fieldUnits(side, false).map(r => r.unit));
          const u = await ABX.placeFromZone(side, "drop", cid, { free: false, byAmbush: true });
          calledUnit = u || core.fieldUnits(side, false).map(r => r.unit).find(x => !beforeUnits.has(x));
        }
        if (!calledUnit) {
          const openPos = ["left", "center", "right"].find(z => !f.monsters[z]);
          if (openPos) {
            const idxNow = f.drop.lastIndexOf(cid);
            if (idxNow >= 0) f.drop.splice(idxNow, 1);
            calledUnit = { card: c, rested: false, attacksLeft: c.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0, calledByAmbush: true, enteredByAmbush: true };
            f.monsters[openPos] = calledUnit;
          }
        }
        if (calledUnit) {
          calledUnit.calledByAmbush = true;
          calledUnit.enteredByAmbush = true;
          await handlePostAmbushTriggers(side, calledUnit);
        }
      }
    } finally {
      _ambushRunning = false;
    }
  }

  function triggerAmbushFromSoul(side, cardId, rawEntry) {
    if (!isFD(rawEntry)) return false; // Strictly require isFaceDown: true!
    const cid = getCid(cardId);
    const c = cardOf(cid);
    if (!c || !c.amb) return false;
    _ambushQueue.push({ side, cid });
    processAmbushQueue();
    return true;
  }
  ABX.triggerAmbushFromSoul = triggerAmbushFromSoul;

  async function handlePostAmbushTriggers(side, ambushedUnit) {
    const f = F(side);
    const e = F(otherSide(side));
    if (!f || !ambushedUnit || !ambushedUnit.card) return;
    // #2992 Secret Sword, Apex of Ambush ([Set] spell): when a monster enters your field by [Ambush],
    // you may put this card from your field into the drop zone -> all «Ninja» on your field get power+3000 & critical+1, and draw a card!
    const apexIdx = (f.setSpells || []).findIndex(sp => sp && sp.id === 2992);
    if (apexIdx >= 0) {
      const sp = f.setSpells.splice(apexIdx, 1)[0];
      f.drop.push(sp.id);
      core.fieldUnits(side, true).forEach(r => {
        if (hasAttr(r.card, "Ninja")) {
          r.unit.tempPower = (r.unit.tempPower || 0) + 3000;
          r.unit.tempCrit = (r.unit.tempCrit || 0) + 1;
        }
      });
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
    }
    // #2869 / #4026 / #4027 field triggers when a card with [Ambush] enters by [Ambush]
    core.fieldUnits(side, false).forEach(r => {
      if (r.card.id === 2869 && r.unit !== ambushedUnit && r.unit.abx2869Turn !== B.turnCount) {
        r.unit.abx2869Turn = B.turnCount;
        if (f.deck.length > 0) f.gauge.push(f.deck.shift());
      }
      if (r.card.id === 4027 && r.unit.abx4027Turn !== B.turnCount) {
        r.unit.abx4027Turn = B.turnCount;
        if (f.deck.length > 0) f.gauge.push(f.deck.shift());
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
      }
    });
    fresh();
  }

  // Wrap ABX.placeFromZone so `opts.byAmbush` marks `unit.calledByAmbush = true` BEFORE `fireEnter` runs!
  if (ABX.placeFromZone) {
    const _origPFZ = ABX.placeFromZone;
    ABX.placeFromZone = async function (side, area, cardId, opts) {
      const f = F(side);
      const beforeUnits = new Set(core.fieldUnits(side, false).map(r => r.unit));
      const u = await _origPFZ.apply(this, arguments);
      const placed = u || core.fieldUnits(side, false).map(r => r.unit).find(x => !beforeUnits.has(x));
      if (placed && opts && opts.byAmbush) {
        placed.calledByAmbush = true;
      }
      return u;
    };
  }

  // Also hook `OPS.dropSoul` and `core.sendUnitTo` so any soul card sent from a field card's soul to drop checks `isFaceDown`!
  if (OPS.dropSoul) {
    OPS.dropSoul.run = async function (s, ctx) {
      const pool = core.refsFor(s.from || { zone: "field", side: "opp", type: "any" }, ctx).filter(r => r.unit && (r.unit.soul || []).length);
      if (!pool.length) return false;
      const picked = s.all ? pool : await core.pick(pool, s.from, ctx, { intent: "harm", title: `${ctx.card.name} — drop soul` });
      picked.forEach(r => {
        const tf = F(r.side);
        if (s.count === "all") {
          const removed = r.unit.soul.splice(0);
          removed.forEach(se => {
            const scid = getCid(se);
            tf.drop.push(scid);
            if (isFD(se)) triggerAmbushFromSoul(r.side, scid, se);
          });
        } else {
          for (let i = 0; i < (s.count || 1) && r.unit.soul.length; i++) {
            const se = r.unit.soul.pop();
            const scid = getCid(se);
            tf.drop.push(scid);
            if (isFD(se)) triggerAmbushFromSoul(r.side, scid, se);
          }
        }
      });
      fresh();
      return picked.length > 0;
    };
  }

  core.sendUnitTo = function (side, pos, unit, dest, ctx) {
    if (!unit) return false;
    const ownerSide = (unit && unit.oppressedBy) || side;
    const ownerF = F(ownerSide);
    const faceDownSouls = [];
    if (Array.isArray(unit.soul)) {
      unit.soul = unit.soul.map(se => {
        const cid = getCid(se);
        if (isFD(se)) faceDownSouls.push({ cid, se });
        return cid;
      });
    }
    const hostSide = (pos === "opp_left" || pos === "opp_right") ? otherSide(ownerSide) : side;
    const hostPos = pos === "opp_left" ? "left" : (pos === "opp_right" ? "right" : pos);
    const hostF = F(hostSide);
    if (hostPos === "item" && hostF.item === unit) {
      hostF.item = null;
    } else if (hostPos === "item2" && hostF.item2 === unit) {
      hostF.item2 = null;
    } else if (hostF && hostF.monsters && hostF.monsters[hostPos] === unit) {
      if (dest === "drop") {
        B.sendMonsterToDropWithAnimation(hostSide, hostPos, !!(ctx && ctx.isRetire));
        faceDownSouls.forEach(({ cid, se }) => triggerAmbushFromSoul(ownerSide, cid, se));
        return true;
      }
      hostF.monsters[hostPos] = null;
    } else {
      return false;
    }
    const souls = (unit.soul || []).splice(0);
    ownerF.drop.push(...souls);
    const ids = (unit.pairedHalfIds && unit.pairedHalfIds.length) ? unit.pairedHalfIds : [unit.card.id];
    if (dest === "hand") ownerF.hand.push(...ids);
    else if (dest === "gauge") ownerF.gauge.push(...ids);
    else if (dest === "bottomDeck") ownerF.deck.push(...ids);
    else if (dest === "deck") { ownerF.deck.push(...ids); if (B.shuffleFighterDeck) B.shuffleFighterDeck(ownerSide); }
    else ownerF.drop.push(...ids);
    faceDownSouls.forEach(({ cid, se }) => triggerAmbushFromSoul(ownerSide, cid, se));
    return true;
  };

  /* ==================== 3. SPELL LOCK ("Cornet Loop" #5371) ==================== */
  // Blocks Spells only (NOT Impacts!) while `f.abxSpellLockUntilMainEnd` is active
  if (typeof root.evaluateCardConditions === "function") {
    const _origEvalCond = root.evaluateCardConditions;
    root.evaluateCardConditions = function (card, fighter, enemy, isAbilityCall) {
      const res = _origEvalCond.apply(this, arguments);
      if (card && card.type === "Spell" && fighter && fighter.abxSpellLockActive) {
        res.met = false;
        const msg = "🚫 Locked by \"Ghost Story Cornet Loop\" — You cannot cast Spells until the end of your main phase! (Impacts are still allowed.)";
        if (!res.reasons.includes(msg)) res.reasons.unshift(msg);
        res.summary = `⚠️ ${res.reasons[0]}`;
      }
      return res;
    };
  }
  // Clear `abxSpellLockActive` when the locked player's main phase ends (advancing from main -> attack/final or ending turn)
  if (typeof B.advancePhase === "function") {
    const _origAdv = B.advancePhase;
    B.advancePhase = function () {
      const wasMain = this.phase === "main";
      const curSide = this.activeSide;
      const r = _origAdv.apply(this, arguments);
      if (wasMain && this.phase !== "main") {
        const f = this.getFighter(curSide);
        if (f && f.abxSpellLockActive && B.turnCount > (f.abxSpellLockSetTurn || 0)) {
          f.abxSpellLockActive = false;
        }
      }
      return r;
    };
  }
  if (typeof B.endTurn === "function") {
    const _origEndTurn = B.endTurn;
    B.endTurn = function () {
      const curSide = this.activeSide;
      const f = this.getFighter(curSide);
      if (f && f.abxSpellLockActive && B.turnCount > (f.abxSpellLockSetTurn || 0)) {
        f.abxSpellLockActive = false;
      }
      return _origEndTurn.apply(this, arguments);
    };
  }

  /* ==================== 4. BATCH 1 MODAL OPS (#2439, #5371, #5560, #6255) ==================== */

  // #2439 Demon Slay Interment Formation
  // Cast Condition: You have a «Weapon» on your field. [Cast Cost] [Pay 1 gauge]
  // Option 1: Destroy all monsters on your opponent's field with defense lower than the power of a «Weapon» on your field (evaluated against the HIGHEST power among all «Weapon» cards on your field — Monster or Item).
  // Option 2: Destroy all spells on your opponent's field.
  function highestWeaponPowerOnField(side) {
    const f = F(side);
    let maxPow = -1;
    core.fieldUnits(side, true).forEach(r => {
      if (r.card && hasAttr(r.card, "Weapon")) {
        const st = typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(f, r.unit) : { power: r.card.power || 0 };
        if (st.power > maxPow) maxPow = st.power;
      }
    });
    return maxPow;
  }

  OPS.r38DemonSlay2439 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      const maxWeaponPow = highestWeaponPowerOnField(ctx.side);
      if (maxWeaponPow < 0) return false;
      let choice = s.opt;
      if (!choice) {
        const opts = [
          { label: `Destroy all opponent monsters with defense < ${maxWeaponPow} (highest «Weapon» power)`, val: 1 },
          { label: `Destroy all spells on your opponent's field (${(e.setSpells || []).length})`, val: 2 }
        ];
        if (auto(ctx.side)) {
          choice = (e.setSpells && e.setSpells.length > 0 && !core.fieldUnits(es, false).some(r => (typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(e, r.unit).defense : (r.card.defense || 0)) < maxWeaponPow)) ? 2 : 1;
        } else {
          const picked = await UI.choose({ title: ctx.card.name, sub: "Choose one:", options: opts.map(o => ({ label: o.label, value: o.val })) });
          choice = picked || 1;
        }
      }
      if (choice === 1) {
        core.fieldUnits(es, false).forEach(r => {
          const def = typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(e, r.unit).defense : (r.card.defense || 0);
          if (def < maxWeaponPow && !core.isProtected(r.unit, es, "destroyed", ctx)) {
            B.destroyMonster(es, r.pos);
          }
        });
      } else {
        const spList = (e.setSpells || []).splice(0);
        spList.forEach(sp => {
          if (Array.isArray(sp.soul)) e.drop.push(...sp.soul.map(getCid));
          e.drop.push(sp.id);
        });
      }
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return highestWeaponPowerOnField(ctx.side) >= 0 || (ctx.e && Array.isArray(ctx.e.setSpells) && ctx.e.setSpells.length > 0);
    }
  };

  // #5371 Ghost Story Cornet Loop
  // [Cast Cost] [Pay 1 gauge & Pay 1 life]
  // Option 1: Your opponent cannot cast events (Spells only, NOT Impacts) until the end of your next main phase.
  // Option 2: For this turn, the next time you take damage, it is reduced to 0.
  OPS.r38CornetLoop5371 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      let choice = s.opt;
      if (!choice) {
        if (auto(ctx.side)) {
          choice = 1;
        } else {
          const picked = await UI.choose({
            title: ctx.card.name,
            sub: "Choose one:",
            options: [
              { label: "Your opponent cannot cast Spells (Events) until the end of your next main phase", value: 1 },
              { label: "For this turn, the next time you take damage, it is reduced to 0", value: 2 }
            ]
          });
          choice = picked || 1;
        }
      }
      if (choice === 1) {
        e.abxSpellLockActive = true;
        e.abxSpellLockSetTurn = B.turnCount;
      } else {
        (f.abxShields = f.abxShields || []).push({ kind: "any", toZero: true, turn: B.turnCount });
        f.tempDamageReduce = 999;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5560 Melody of the Evil Moon
  // [Counter] Choose one of the following two:
  // Option 1: Draw a card, and for this turn, the next damage you take is reduced to 0.
  // Option 2: Pay any amount of life (from 1 up to Current Life - 1). If you do, for this turn, damage you take is reduced by the amount of life paid.
  OPS.r38MelodyEvilMoon5560 = {
    async run(s, ctx) {
      const f = ctx.f;
      const maxPayableLife = Math.max(0, f.life - 1);
      let choice = s.opt;
      if (!choice) {
        if (f.r38ChosenLifePay !== undefined && maxPayableLife >= 1) {
          choice = 2;
        } else if (auto(ctx.side) || maxPayableLife < 1) {
          choice = 1;
        } else {
          const picked = await UI.choose({
            title: ctx.card.name,
            sub: "Choose one:",
            options: [
              { label: "Draw a card, and reduce the next damage you take this turn to 0", value: 1 },
              { label: `Pay life (1 to ${maxPayableLife}) to reduce all damage you take this turn by that amount`, value: 2 }
            ]
          });
          choice = picked || 1;
        }
      }
      if (choice === 1 || maxPayableLife < 1) {
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
        (f.abxShields = f.abxShields || []).push({ kind: "any", toZero: true, turn: B.turnCount });
      } else {
        let payAmt = (s.payLife !== undefined ? s.payLife : f.r38ChosenLifePay);
        if (payAmt !== undefined) {
          payAmt = Math.min(maxPayableLife, Math.max(1, Number(payAmt)));
        } else if (!auto(ctx.side)) {
          const lifeOpts = [];
          for (let k = 1; k <= maxPayableLife; k++) {
            lifeOpts.push({ label: `Pay ${k} Life (Leaves you at ${f.life - k} Life • Reduces all damage this turn by ${k})`, value: k });
          }
          const chosenAmt = await UI.choose({
            title: `${ctx.card.name} — Pay Life (1 to ${maxPayableLife})`,
            sub: "You cannot pay life that would reduce your total to 0 or lower:",
            options: lifeOpts
          });
          payAmt = Math.min(maxPayableLife, Math.max(1, Number(chosenAmt) || 1));
        } else {
          payAmt = 1;
        }
        f.life -= payAmt;
        f.r38TurnDamageReduce = (f.r38TurnDamageReduce || 0) + payAmt;
        (f.abxShields = f.abxShields || []).push({ kind: "any", by: payAmt, continuous: true, turn: B.turnCount });
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6255 First Ace (Medachange)
  // - [Call Cost] [Drop all souls from a "First Ace" on your field with three or more souls, then put that card into the drop zone]
  // - Cannot be destroyed or [Rest] by your opponent's card effects.
  // - [Counter] [Act] Choose one of the following three. You may only use this ability once per turn:
  //   • "Home Sick" Return all characters (Monsters only!) on your opponent's field to hand.
  //   • "Reflect" During a battle that this card is being attacked, nullify the attack, and destroy all attacking cards.
  //   • "Tumble" [Rest] all characters (Monsters only!) on your opponent's field.
  function findFirstAceForCallCost(side) {
    return core.fieldUnits(side, false).find(r => r.card && lc(r.card.name).includes("first ace") && Array.isArray(r.unit.soul) && r.unit.soul.length >= 3);
  }

  if (typeof root.evaluateCardConditions === "function") {
    const _origECC = root.evaluateCardConditions;
    root.evaluateCardConditions = function (card, fighter, enemy, isAbilityCall) {
      const res = _origECC.apply(this, arguments);
      if (card && card.id === 6255 && !isAbilityCall) {
        const side = fighter === B.plr ? "plr" : "opp";
        if (!findFirstAceForCallCost(side)) {
          res.met = false;
          const msg = "Requires a \"First Ace\" on your field with 3 or more souls";
          if (!res.reasons.includes(msg)) res.reasons.unshift(msg);
          res.summary = `⚠️ ${res.reasons[0]}`;
        }
      }
      return res;
    };
  }

  if (ABX.canPayExtras) {
    const _origCPE = ABX.canPayExtras;
    ABX.canPayExtras = function (side, card, handIdx) {
      if (card && card.id === 6255) return Boolean(findFirstAceForCallCost(side));
      return _origCPE.apply(this, arguments);
    };
  }
  if (ABX.hasExtras) {
    const _origHE = ABX.hasExtras;
    ABX.hasExtras = function (card) {
      if (card && card.id === 6255) return true;
      return _origHE.apply(this, arguments);
    };
  }
  if (ABX.payExtras) {
    const _origPE = ABX.payExtras;
    ABX.payExtras = function (side, card, newUnit) {
      if (card && card.id === 6255) {
        const target = findFirstAceForCallCost(side);
        if (target && target.unit !== newUnit) {
          const f = F(side);
          const souls = (target.unit.soul || []).splice(0);
          souls.forEach(se => {
            const scid = getCid(se);
            f.drop.push(scid);
            if (isFD(se)) triggerAmbushFromSoul(side, scid, se);
          });
          core.sendUnitTo(side, target.pos, target.unit, "drop", { isRetire: true });
        }
        return true;
      }
      return _origPE.apply(this, arguments);
    };
  }

  OPS.r38FirstAceMedachange6255 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      let choice = s.opt;
      if (!choice) {
        if (auto(ctx.side)) {
          choice = 1;
        } else {
          const picked = await UI.choose({
            title: `${ctx.card.name} — [Counter] [Act]`,
            sub: "Choose one (affects Opponent's Monster units only, not Items):",
            options: [
              { label: "\"Home Sick\" — Return all Monsters on your opponent's field to hand", value: 1 },
              { label: "\"Reflect\" — During a battle this card is attacked, nullify the attack & destroy all attacking cards", value: 2 },
              { label: "\"Tumble\" — [Rest] all Monsters on your opponent's field", value: 3 }
            ]
          });
          choice = picked || 1;
        }
      }
      if (choice === 1) {
        // "Home Sick": Return all Monsters on opponent's field to hand (strictly Monsters only, NOT equipped Items!)
        core.fieldUnits(es, false).forEach(r => {
          if (!core.isProtected(r.unit, es, "returned", ctx)) {
            core.sendUnitTo(es, r.pos, r.unit, "hand", ctx);
          }
        });
      } else if (choice === 2) {
        // "Reflect": Nullify the attack and destroy all attacking cards
        if (ctx.battleCtx) ctx.battleCtx.nullified = true;
        if (B.pendingDefenseContext) B.pendingDefenseContext.nullifiedByFieldAct = true;
        const attSide = otherSide(ctx.side);
        const attUnits = (ctx.battleCtx && ctx.battleCtx.attUnits) || [];
        if (attUnits.length > 0) {
          attUnits.forEach(au => {
            const u = au.unit || au;
            const pos = core.posOfUnit(F(attSide), u);
            if (pos && pos !== "item" && !core.isProtected(u, attSide, "destroyed", ctx)) {
              B.destroyMonster(attSide, pos);
            }
          });
        } else {
          core.fieldUnits(attSide, false).filter(r => r.unit && r.unit.rested).forEach(r => {
            if (!core.isProtected(r.unit, attSide, "destroyed", ctx)) {
              B.destroyMonster(attSide, r.pos);
            }
          });
        }
      } else if (choice === 3) {
        // "Tumble": [Rest] all Monsters on opponent's field (strictly Monsters only, NOT equipped Items!)
        core.fieldUnits(es, false).forEach(r => {
          if (!core.isProtected(r.unit, es, "rested", ctx)) {
            r.unit.rested = true;
          }
        });
      }
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 5. VERBAL / JOKE / PHYSICAL CONDITION CARDS (#907, #1795, #6068, #5021, #4148) ==================== */

  // #907 Wandering Salaryman Buddyfighter, Amigo Takata:
  // - When this card attacks, draw a card! (Auto-trigger without prompt)
  // - During your opponent's turn, when you are dealt 2 or more damage, reduce that damage by 1! (Auto-trigger without prompt)
  OPS.r38AmigoDraw907 = {
    async run(s, ctx) {
      if (ctx.f.deck.length > 0) ctx.f.hand.push(ctx.f.deck.shift());
      fresh();
      return true;
    },
    check: () => true
  };

  if (core.applyDamage) {
    const _origApplyDamage = core.applyDamage;
    core.applyDamage = function (side, n, opts) {
      let dmg = Math.max(0, Number(n) || 0);
      try {
        const f = F(side);
        if (f && f.r38TurnDamageReduce > 0 && !(opts && opts.unreducible)) {
          dmg = Math.max(0, dmg - f.r38TurnDamageReduce);
        }
        // #907 Amigo Takata: During your opponent's turn, when you are dealt 2 or more damage, automatically reduce that damage by 1
        if (dmg >= 2 && !(opts && opts.unreducible) && B.activeSide !== side) {
          const amigoCount = core.fieldUnits(side, false).filter(r => r.card && r.card.id === 907 && r.unit.abxNullified !== B.turnCount).length;
          if (amigoCount > 0) {
            dmg = Math.max(0, dmg - amigoCount);
          }
        }
      } catch (e) { /* ignore */ }
      return _origApplyDamage.call(this, side, dmg, opts);
    };
  }

  // #1795 Buddyfight World Deity, (Self-Proclaimed) God Khoushan:
  // When this card enters the field, automatically execute for both players without a prompt:
  // If a player has 1+ cards in hand, gain 1 life and discard 1 card from hand; if 0 cards in hand, put top deck card into gauge.
  OPS.r38Khoushan1795 = {
    async run(s, ctx) {
      for (const side of [ctx.side, otherSide(ctx.side)]) {
        const pf = F(side);
        if (!pf) continue;
        if (pf.hand.length > 0) {
          pf.life += 1;
          pf.drop.push(pf.hand.pop());
        } else if (pf.deck.length > 0) {
          pf.gauge.push(pf.deck.shift());
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6068 Prejudice Against Testers, Kibaou:
  // When this card is put on the field, automatically treat "Why!" as said -> gain 2 life immediately.
  OPS.r38Kibaou6068 = {
    async run(s, ctx) {
      ctx.f.life += 2;
      fresh();
      return true;
    },
    check: () => true
  };

  // #5021 Silver Soul Release, Deity Gargantua Dragon:
  // Hardcode silver coating state to true (always scraped out) -> always gets power+10000 on the field!
  // Plus D-[G.EVO] at the end of the battle of this card: draw 1 card, then call up to 1 «Dragod» monster from your hand on top of this card without paying its [Call Cost].
  if (ABX.staticBonus) {
    const _origSB = ABX.staticBonus;
    ABX.staticBonus = function (fighter, unit) {
      const res = _origSB.apply(this, arguments);
      try {
        // #4699 Bishop: Giallo Mace: If you have an oppressed area on your field, all monsters on your field get power+3000 and defense+3000!
        if (fighter && unit && unit.card && unit.card.type === "Monster") {
          const side = fighter === B.plr ? "plr" : "opp";
          if (hasOppressedArea(side)) {
            const maceCount = core.fieldUnits(side, false).filter(r => r.card && r.card.id === 4699 && r.unit.abxNullified !== B.turnCount).length;
            if (maceCount > 0) {
              res.power = (res.power || 0) + 3000 * maceCount;
              res.defense = (res.defense || 0) + 3000 * maceCount;
            }
          }
        }
      } catch (e) { /* ignore */ }
      return res;
    };
  }

  OPS.r38GargaGEvo5021 = {
    async run(s, ctx) {
      const f = ctx.f;
      if (f.deck.length > 0) f.hand.push(f.deck.shift());
      const pos = core.posOfUnit(f, ctx.unit);
      if (pos && f.monsters[pos] === ctx.unit) {
        const dragods = f.hand
          .map((id, idx) => ({ k: "zone", side: ctx.side, area: "hand", idx, id, card: cardOf(id) }))
          .filter(r => r.card && r.card.type === "Monster" && hasAttr(r.card, "Dragod"));
        if (dragods.length > 0) {
          const picked = auto(ctx.side)
            ? [dragods[0]]
            : (await core.pick(dragods, { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — D-[G.EVO] Call a «Dragod» on top` })) || [];
          if (picked[0]) {
            const hi = f.hand.indexOf(picked[0].id);
            if (hi >= 0) {
              const newCard = picked[0].card;
              f.hand.splice(hi, 1);
              const oldUnit = ctx.unit;
              const newSoul = [...(oldUnit.soul || []), oldUnit.card.id];
              const newUnit = {
                card: newCard,
                rested: false,
                attacksLeft: newCard.atk_max || 1,
                soul: newSoul,
                tempPower: 0,
                tempDef: 0,
                tempCrit: 0,
                actUsed: false
              };
              f.monsters[pos] = newUnit;
              if (ABX.fireEnter && ABX.ownsEnter && ABX.ownsEnter(newCard)) ABX.fireEnter(ctx.side, newCard, newUnit);
            }
          }
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4148 Crabgantua Punisher!!:
  // Treat "eaten four or more crab legs during this fight" as always true!
  // Only check that neither player has a monster in the center (and 4 gauge cost), then deal 4 unnullifiable, unreducible damage!
  if (typeof root.evaluateCardConditions === "function") {
    const _origECC2 = root.evaluateCardConditions;
    root.evaluateCardConditions = function (card, fighter, enemy, isAbilityCall) {
      const res = _origECC2.apply(this, arguments);
      if (card && card.id === 4148) {
        // Remove false positive "Requires a monster in your Center" caused by "only cast this card if you have ... in the center"
        res.reasons = (res.reasons || []).filter(r => !r.includes("Requires a monster in your Center"));
        if ((fighter && fighter.monsters && fighter.monsters.center) || (enemy && enemy.monsters && enemy.monsters.center)) {
          const msg = "Requires neither player to have a monster in the center";
          if (!res.reasons.includes(msg)) res.reasons.unshift(msg);
        }
        res.met = res.reasons.length === 0;
        res.summary = res.met ? "✅ Conditions Met" : `⚠️ ${res.reasons[0]}`;
      }
      return res;
    };
  }

  OPS.r38CrabPunisher4148 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      if ((f.monsters && f.monsters.center) || (e.monsters && e.monsters.center)) return false;
      core.applyDamage(es, 4, { kind: "impact", unreducible: true, sourceCard: ctx.card });
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return !(ctx.f.monsters && ctx.f.monsters.center) && !(ctx.e.monsters && ctx.e.monsters.center);
    }
  };

  /* ==================== 6. OPPRESSED AREAS CARDS (#4677, #4699, #4702, #6154) ==================== */

  // Shared "Oppress" [Counter] [Act] for #4677 (Lostknight: Nero Lance) and #4699 (Lostknight: Bishop: Giallo Mace):
  // During your turn, choose an open area on your opponent's left or right, and you may pay 1 gauge.
  // If you do, move this card to that area (an "oppressed area").
  OPS.r38OppressAct = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side) return false;
      const f = ctx.f, e = ctx.e, u = ctx.unit;
      if (!u || f.gauge.length < 1) return false;
      const curPos = core.posOfUnit(f, u);
      if (!curPos) return false;
      const openOppSlots = ["left", "right"].filter(p => !e.monsters[p]);
      if (!openOppSlots.length) return false;

      let targetSlot = openOppSlots[0];
      if (openOppSlots.length > 1 && !auto(ctx.side)) {
        const picked = await UI.choose({
          title: `${ctx.card.name} — "Oppress"`,
          sub: "Choose an open Left or Right area on your opponent's field to Oppress:",
          options: openOppSlots.map(p => ({ label: `Opponent's ${p.toUpperCase()} Zone`, value: p }))
        });
        if (picked && openOppSlots.includes(picked)) targetSlot = picked;
      }

      // Pay 1 gauge
      f.drop.push(f.gauge.pop());

      // Remove from current slot (whether on your field or already on the other opponent slot)
      if (curPos === "opp_left" || curPos === "opp_right") {
        const prevSlot = curPos === "opp_left" ? "left" : "right";
        if (e.monsters[prevSlot] === u) e.monsters[prevSlot] = null;
      } else if (f.monsters[curPos] === u) {
        f.monsters[curPos] = null;
      }

      // Place in enemy.monsters[targetSlot] with owner-control pointing to `ctx.side`
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
      if (B.activeSide !== ctx.side) return false;
      if (!ctx.unit || ctx.f.gauge.length < 1) return false;
      return ["left", "right"].some(p => !ctx.e.monsters[p]);
    }
  };

  // #4677 Lostknight: Nero Lance:
  // At the end of your turn, if this card is on an oppressed area, deal 2 damage to your opponent!
  OPS.r38NeroLanceEnd4677 = {
    async run(s, ctx) {
      if (B.activeSide !== ctx.side) return false;
      if (!isUnitOnOppressedArea(ctx.side, ctx.unit)) return false;
      core.applyDamage(otherSide(ctx.side), 2, { kind: "effect", sourceCard: ctx.card });
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return B.activeSide === ctx.side && isUnitOnOppressedArea(ctx.side, ctx.unit);
    }
  };

  // #4702 Chess Break, Grandmaster Cane (Item):
  // [Counter] [Act] Choose a «Drametal» monster on your field, and you may [Rest] this card. If you do, [Stand] the chosen card. Then, if the card [Stand] is on an oppressed area, deal 1 damage to your opponent!
  OPS.r38GrandmasterCane4702 = {
    async run(s, ctx) {
      if (!ctx.unit || ctx.unit.rested) return false;
      const drametals = core.fieldUnits(ctx.side, false).filter(r => r.card && hasAttr(r.card, "Drametal"));
      if (!drametals.length) return false;
      ctx.unit.rested = true;
      const picked = auto(ctx.side)
        ? [drametals.find(r => r.unit.rested) || drametals[0]]
        : (await core.pick(drametals, { qty: { n: 1 } }, ctx, { intent: "help", title: `${ctx.card.name} — [Stand] a «Drametal» monster` })) || [];
      if (picked[0] && picked[0].unit) {
        const targetUnit = picked[0].unit;
        targetUnit.rested = false;
        targetUnit.attacksLeft = Math.max(1, targetUnit.attacksLeft || 1);
        if (isUnitOnOppressedArea(ctx.side, targetUnit)) {
          core.applyDamage(otherSide(ctx.side), 1, { kind: "effect", sourceCard: ctx.card });
          if (B.checkWinCondition) B.checkWinCondition();
        }
      }
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return Boolean(ctx.unit && !ctx.unit.rested && core.fieldUnits(ctx.side, false).some(r => r.card && hasAttr(r.card, "Drametal")));
    }
  };

  // #6154 Zug Zwang (Spell):
  // You may only cast this card if a monster with "Oppress" is on your field.
  // [Counter] Choose one of the following two:
  // Option 1: [Stand] a «Drametal» on your field, and if that card is on an oppressed area, deal 1 damage to your opponent!
  // Option 2: For this turn, your opponent cannot call monsters by card effects.
  function hasMonsterWithOppressOnField(side) {
    return core.fieldUnits(side, false).some(r => r.card && /"oppress"/i.test(r.card.skill || ""));
  }

  if (typeof root.evaluateCardConditions === "function") {
    const _origECC3 = root.evaluateCardConditions;
    root.evaluateCardConditions = function (card, fighter, enemy, isAbilityCall) {
      const res = _origECC3.apply(this, arguments);
      if (card && card.id === 6154) {
        const side = fighter === B.plr ? "plr" : "opp";
        if (!hasMonsterWithOppressOnField(side)) {
          res.met = false;
          const msg = "Requires a monster with \"Oppress\" on your field";
          if (!res.reasons.includes(msg)) res.reasons.unshift(msg);
          res.summary = `⚠️ ${res.reasons[0]}`;
        }
      }
      return res;
    };
  }

  OPS.r38ZugZwang6154 = {
    async run(s, ctx) {
      if (!hasMonsterWithOppressOnField(ctx.side)) return false;
      const drametals = core.fieldUnits(ctx.side, false).filter(r => r.card && hasAttr(r.card, "Drametal"));
      let choice = s.opt;
      if (!choice) {
        if (auto(ctx.side)) {
          choice = drametals.some(r => r.unit.rested || isUnitOnOppressedArea(ctx.side, r.unit)) ? 1 : 2;
        } else {
          const picked = await UI.choose({
            title: ctx.card.name,
            sub: "Choose one:",
            options: [
              { label: "[Stand] a «Drametal» on your field (and deal 1 damage if on an oppressed area)", value: 1 },
              { label: "For this turn, your opponent cannot call monsters by card effects", value: 2 }
            ]
          });
          choice = picked || 1;
        }
      }
      if (choice === 1 && drametals.length > 0) {
        const picked = auto(ctx.side)
          ? [drametals.find(r => r.unit.rested) || drametals[0]]
          : (await core.pick(drametals, { qty: { n: 1 } }, ctx, { intent: "help", title: `${ctx.card.name} — [Stand] a «Drametal»` })) || [];
        if (picked[0] && picked[0].unit) {
          const targetUnit = picked[0].unit;
          targetUnit.rested = false;
          targetUnit.attacksLeft = Math.max(1, targetUnit.attacksLeft || 1);
          if (isUnitOnOppressedArea(ctx.side, targetUnit)) {
            core.applyDamage(otherSide(ctx.side), 1, { kind: "effect", sourceCard: ctx.card });
            if (B.checkWinCondition) B.checkWinCondition();
          }
        }
      } else {
        ctx.e.abxNoEffectCallTurn = B.turnCount;
      }
      fresh();
      return true;
    },
    check(s, ctx) {
      if (!ctx) return true;
      return hasMonsterWithOppressOnField(ctx.side);
    }
  };

  // Enforce `abxNoEffectCallTurn` (blocks calling monsters by card effects for this turn)
  if (ABX.placeFromZone) {
    const _origPFZ2 = ABX.placeFromZone;
    ABX.placeFromZone = function (side) {
      const f = F(side);
      if (f && f.abxNoEffectCallTurn === B.turnCount) return Promise.resolve(null);
      return _origPFZ2.apply(this, arguments);
    };
  }

  /* ==================== 7. "ENTERED BY [AMBUSH]" CONDITIONAL OVERRIDES ==================== */
  // Ensure `evalCond` recognizes `{ k: "enteredByAmbush" }` and `{ k: "hasOppressedArea" }`
  const _origEvalCondAbx = core.evalCond;
  core.evalCond = function (c, ctx) {
    if (c && c.k === "enteredByAmbush") {
      return Boolean(ctx && ctx.unit && (ctx.unit.calledByAmbush === true || ctx.unit.enteredByAmbush === true));
    }
    if (c && c.k === "hasOppressedArea") {
      return Boolean(ctx && hasOppressedArea(ctx.side));
    }
    if (c && c.k === "onOppressedArea") {
      return Boolean(ctx && isUnitOnOppressedArea(ctx.side, ctx.unit));
    }
    return _origEvalCondAbx.apply(this, arguments);
  };

  /* ==================== 8. PER-CARD ABILITY OVERRIDES ==================== */
  const C = (op, extra) => Object.assign({ op }, extra || {});
  const MODAL_SPELL_MAP = {
    2439: "r38DemonSlay2439",
    5371: "r38CornetLoop5371",
    5560: "r38MelodyEvilMoon5560",
    6154: "r38ZugZwang6154"
  };

  const OV = [
    // Verbal / Joke / Physical Condition Cards
    [907, /when this card attacks, say/i, (ab) => ({ kind: ab.kind || "triggered", trigger: ab.trigger || { event: "attack", self: true }, steps: [C("r38AmigoDraw907")] })],
    [907, /during your opponent's turn, when you are dealt 2 or more damage/i, () => ({ kind: "rule", steps: [] })],
    [1795, /when this card enters the field, both players (?:may )?say/i, (ab) => ({ kind: ab.kind || "triggered", trigger: ab.trigger || { event: "enter", self: true }, steps: [C("r38Khoushan1795")] })],
    [6068, /when this card is put on the field, say "why!"/i, (ab) => ({ kind: ab.kind || "triggered", trigger: ab.trigger || { event: "enter", self: true }, steps: [C("r38Kibaou6068")] })],
    [5021, /if the silver (?:coating on|from) this card is scraped out/i, () => ({ kind: "rule", steps: [] })],
    [5021, /at the end of the battle of this card, draw a card[.,]?\s*then, call up to one «dragod»/i, (ab) => ({ kind: ab.kind || "triggered", trigger: ab.trigger || { event: "battleEnd", self: true }, once: "turn", steps: [C("r38GargaGEvo5021")] })],
    [4148, /you may only cast this card if you have eaten four or more crab legs/i, () => ({ kind: "rule", action: "cast", conds: [], steps: [] })],
    [4148, /deal 4 damage to (?:your|the) opponent!!/i, () => ({ kind: "spell", steps: [C("r38CrabPunisher4148")] })],

    // Oppressed Areas (#4677, #4699, #4702)
    [4677, /"oppress"|put this card on your opponent's open left or right/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r38OppressAct")] })],
    [4677, /at the end of your turn, if this card is on an oppressed area, deal 2 damage/i, (ab) => ({ kind: ab.kind || "triggered", trigger: ab.trigger || { event: "turnEnd", who: "you" }, conds: [], steps: [C("r38NeroLanceEnd4677")] })],
    [4699, /"oppress"|put this card on your opponent's open left or right/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r38OppressAct")] })],
    [4699, /if you have an oppressed area on your field|while you have an oppressed area/i, () => ({ kind: "rule", steps: [] })],
    [4702, /choose a «drametal» monster on your field, and you may \[rest\] this card|during your turn, \[rest\] this card/i, () => ({ kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r38GrandmasterCane4702")] })]
  ];

  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      if (card && MODAL_SPELL_MAP[card.id] && r && Array.isArray(r.abilities)) {
        const opName = MODAL_SPELL_MAP[card.id];
        const kept = r.abilities.filter(ab => ab.kind === "rule" || ab.kind === "cost");
        kept.push({
          kind: "spell",
          tags: [5371, 5560, 6154].includes(card.id) ? ["counter"] : [],
          counter: [5371, 5560, 6154].includes(card.id),
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

      if (card && card.id === 6255 && r && Array.isArray(r.abilities)) {
        const kept = r.abilities.filter(ab => ab.kind === "cost" || ab.kind === "keyword");
        kept.push({
          kind: "static",
          tags: [],
          conds: [],
          steps: [{ op: "static", kind: "protect", kinds: ["destroyed", "rest", "rested"], self: true }],
          unparsed: [],
          r31: true,
          parsed: true,
          raw: "This card on the field cannot be destroyed or [Rest] by your opponent's card effects.",
          cleaned: "This card on the field cannot be destroyed or [Rest] by your opponent's card effects.",
          idx: kept.length,
          cardId: 6255
        });
        kept.push({
          kind: "act",
          tags: ["counter", "act"],
          counter: true,
          once: "turn",
          conds: [],
          steps: [C("r38FirstAceMedachange6255")],
          unparsed: [],
          r31: true,
          parsed: true,
          raw: "[Counter] [Act] Choose and use one of the following three. You may only use this ability once per turn.",
          cleaned: "[Counter] [Act] Choose and use one of the following three. You may only use this ability once per turn.",
          idx: kept.length,
          cardId: 6255
        });
        r.abilities = kept;
        return r;
      }

      (r && r.abilities || []).forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        const full = String(ab.raw || "");
        if (/when this card enters the field by \[ambush\]|if this card entered the field by \[ambush\]/i.test(full)) {
          ab.conds = ab.conds || [];
          if (!ab.conds.some(c => c && c.k === "enteredByAmbush")) {
            ab.conds.push({ k: "enteredByAmbush" });
          }
        }
        for (const [id, re, build] of OV) {
          if (card.id !== id || !(re.test(raw) || re.test(full))) continue;
          const o = build(ab); if (!o) continue;
          ab.kind = o.kind; ab.steps = o.steps; ab.unparsed = []; ab.r31 = true; ab.parsed = true;
          if (o.once) ab.once = o.once;
          if (o.counter) ab.counter = true;
          if (o.tags) ab.tags = o.tags;
          if (o.trigger) ab.trigger = o.trigger;
          if (o.conds !== undefined) ab.conds = o.conds;
          break;
        }
      });
      if (card && (card.id === 5021 || card.id === 4699)) {
        r._hasR22Static = false;
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
