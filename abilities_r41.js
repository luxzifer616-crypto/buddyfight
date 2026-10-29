/* ==================== ABX — round 41: Final 19 Mini-Game, Guessing, Calendar & Special Challenge Cards (100% Coverage) ====================
 * Implements the user's 4 rulings for the final 19 cards (20 ability blocks):
 * 1. Rock-Paper-Scissors (Janken) Cards:
 *    - 3-button modal ("✊ Rock" / "✋ Paper" / "✌️ Scissors") with a 5-second auto-pick timer (5000ms) if the player idles.
 *    - Full support for #171 Armorknight Sphinx, #226 Big Surprise Pandora, #762 Death Game, #1119 Judge Asmodai's 3 Rounds RPS,
 *      #1321 Mysterious Decarabia (enter + pay 2 gauge replay), #1331 Dead or Alive!, #1549 Purgatory Block,
 *      #3245 Demon Lord Gagnar "Second Form: Ironhand", #4265 XL Pandora, #6083 DUEL, plus all existing OPS.rps cards.
 * 2. Card Guessing, Declaration, Shuffle-Pick & Secret Bet Cards:
 *    - Candidate type/card modal for human players + smart probability-calculating bot logic based on public/known zone distributions.
 *    - Full support for #208 Dangerous Fuse, #3487 Charismatic Demon Lord Teacher Asmodai, #5211 Seeking the Truth Conan Edogawa,
 *      #5214 High School Detective Heiji Hattori, #5217 Modern-day Sherlock Holmes Shinichi Kudo, #6203 Gargantua Evolution,
 *      #6209 Mirror Hero Captain Answer "Answer Question!!", #6479 Martian UFO Takosuke "Re:B", plus all OPS.declareType cards.
 * 3. Real-World Calendar & Tournament / Sleeve Joke Cards:
 *    - Checks actual system date via `new Date().getMonth() + 1` (with `ABX.mockMonth` override for testing) on #4430 Summer With Ace of Games! Yuga & Garga "SD" (July/August +3000/+3000/+3), with fallback-true for physical sleeve/tournament conditions.
 * 4. Special Mechanic Challenges:
 *    - Automated top-deck reveal, summation, and comparison up to the 10,000 power ceiling (`OPS.r41TopDeckPowerSumChallenge`).
 *    - Strict 3-option modal [Counter] for Buddyfight "the 10th anniversary" (`OPS.r41TenthAnniversaryCounter`: return to deck to heal/draw, buff cards matching buddy's attribute, or recycle monsters/items from drop zone — never copying drop zone spells).
 * Loaded after abilities_r40.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits, posOfUnit, matchFilter, evalCond } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const fresh = () => { try { B.renderBattle && B.renderBattle(); } catch (e) { /* ignore */ } };
  const say = (t) => { try { B.setPrompt && B.setPrompt(t); } catch (e) { /* ignore */ } };
  const getCid = (x) => (typeof root.getSoulCardId === "function" ? root.getSoulCardId(x) : (x && typeof x === "object" ? Number(x.id ?? x.cardId ?? x.valueOf()) : Number(x)));
  const isAuto = (ctx) => !!(ctx && (ctx.auto || F(ctx.side).isBot || ABX.autoPlay === true || ABX.remoteAutoSide === ctx.side));

  /* ==================== 1. 3-BUTTON ROCK-PAPER-SCISSORS MODAL WITH 5-SECOND AUTO-PICK TIMER ==================== */

  const RPS_LABELS = ["✊ Rock", "✋ Paper", "✌️ Scissors"];

  // Enhance ABX.ui.pickOption to support `timeoutMs` (e.g., 5000ms for Rock-Paper-Scissors)
  if (ABX.ui && typeof ABX.ui.pickOption === "function" && !ABX.ui._r41TimerWrapped) {
    const origPickOption = ABX.ui.pickOption;
    ABX.ui.pickOption = function (o) {
      if (!o || !o.timeoutMs || (ABX.hooks && ABX.hooks.pickOption)) {
        return origPickOption.apply(this, arguments);
      }
      const timeoutMs = Number(o.timeoutMs) || 5000;
      const opts = o.options || [];
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            if (typeof document !== "undefined" && document.querySelectorAll) {
              document.querySelectorAll(".abx-ov").forEach(el => { try { el.remove(); } catch (e) {} });
            }
          } catch (e) {}
          const autoIdx = opts.length > 0 ? Math.floor(Math.random() * opts.length) : 0;
          resolve(autoIdx);
        }, timeoutMs);

        origPickOption.call(this, Object.assign({}, o, {
          subtitle: `${o.subtitle ? o.subtitle + " " : ""}(⏱️ Auto-picks in ${Math.round(timeoutMs / 1000)}s if idle)`
        })).then((idx) => {
          if (settled) return;
          settled = true;
          try { clearTimeout(timer); } catch (e) {}
          resolve(idx);
        });
      });
    };
    ABX.ui._r41TimerWrapped = true;
  }

  // Play a Rock-Paper-Scissors round (with 3-button modal + 5s auto-pick timer for human players, or deterministic test override)
  ABX.playRpsRound = async function (ctx, opts = {}) {
    const onlyOnce = !!opts.onlyOnce;
    const maxRounds = onlyOnce ? 1 : (opts.maxRounds || 5);
    const cardName = (ctx && ctx.card && ctx.card.name) || "Rock-Paper-Scissors";

    for (let round = 0; round < maxRounds; round++) {
      if (Array.isArray(ABX.forceRpsSequence) && ABX.forceRpsSequence.length > 0) {
        const forced = ABX.forceRpsSequence.shift();
        if (forced !== "tie" || onlyOnce || round === maxRounds - 1) {
          if (ctx) ctx.rps = forced;
          return forced;
        }
        continue;
      }
      if (typeof ABX.forceRpsResult === "string" && ["win", "lose", "tie"].includes(ABX.forceRpsResult)) {
        const forced = ABX.forceRpsResult;
        if (ctx) ctx.rps = forced;
        return forced;
      }

      let me = Math.floor(Math.random() * 3);
      if (!isAuto(ctx) && ABX.ui && typeof ABX.ui.pickOption === "function") {
        const picked = await ABX.ui.pickOption({
          title: `✊✋✌️ ${cardName} — Rock-Paper-Scissors!`,
          subtitle: onlyOnce ? "Choose your hand (1 round only — ties count as a draw!):" : "Choose your hand:",
          options: RPS_LABELS.map(l => ({ label: l })),
          timeoutMs: 5000
        });
        if (picked != null && picked >= 0 && picked < 3) me = picked;
      }
      const opp = (typeof ABX.forceOppRpsHand === "number" && ABX.forceOppRpsHand >= 0 && ABX.forceOppRpsHand < 3)
        ? ABX.forceOppRpsHand
        : Math.floor(Math.random() * 3);
      const res = me === opp ? "tie" : (me + 1) % 3 === opp ? "lose" : "win";
      say(`✊✋✌️ ${RPS_LABELS[me]} vs ${RPS_LABELS[opp]} — ${res === "win" ? "You WIN!" : res === "lose" ? "You lose!" : (onlyOnce ? "It's a DRAW!" : "Tie — go again!")}`);
      if (res !== "tie" || onlyOnce) {
        if (ctx) ctx.rps = res;
        return res;
      }
    }
    if (ctx) ctx.rps = "tie";
    return "tie";
  };

  // Upgrade global OPS.rps so all existing RPS cards use the 5-second auto-pick timer and test hooks
  OPS.rps = {
    async run(s, ctx) {
      const onlyOnce = /once/i.test((s && s.src) || "");
      await ABX.playRpsRound(ctx, { onlyOnce });
      return true;
    },
    check: () => true
  };

  // Helper: destroy 1 card on a target fighter's field (used by #762 Death Game and #1321 Mysterious Decarabia)
  async function destroyOneFieldCardByWinner(winnerSide, ctx) {
    const loserSide = otherSide(winnerSide);
    const lf = F(loserSide), wf = F(winnerSide);
    let cands = fieldUnits(lf, true).filter(r => !core.isProtected(r.unit, loserSide, "destroyed", { side: winnerSide }));
    if (!cands.length) {
      cands = fieldUnits(wf, true).filter(r => !core.isProtected(r.unit, winnerSide, "destroyed", { side: winnerSide }));
    }
    if (!cands.length) return false;
    const target = cands[0];
    const targetSide = fieldUnits(lf, true).some(r => r.unit === target.unit) ? loserSide : winnerSide;
    if (target.pos === "item" || target.pos === "item2") {
      const tf = F(targetSide);
      if (tf[target.pos] && !tf[target.pos].isEndrulerFlag) {
        if (Array.isArray(tf[target.pos].soul)) tf.drop.push(...tf[target.pos].soul.map(getCid));
        tf.drop.push(tf[target.pos].card.id);
        tf[target.pos] = null;
        fresh();
        return true;
      }
      return false;
    }
    const ok = B.destroyMonster(targetSide, target.pos) !== false;
    fresh();
    return ok;
  }

  // #171 Armorknight Sphinx: [Counter] [Act] When you are attacked directly and this card is on the left or right, pay 1 gauge -> play RPS -> if win, nullify the attack!
  OPS.r41Sphinx171 = {
    async run(s, ctx) {
      const f = ctx.f, u = ctx.unit;
      if (u) {
        const pos = posOfUnit(f, u);
        if (pos && pos !== "left" && pos !== "right") return false;
      }
      if (f.gauge.length < 1) return false;
      f.drop.push(f.gauge.pop());
      const res = await ABX.playRpsRound(ctx, { onlyOnce: false });
      if (res === "win") {
        if (ABX.battleCtx && ABX.battleCtx.active) ABX.battleCtx.nullified = true;
        ctx.nullified = true;
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #226 Big Surprise Pandora: When destroyed, play RPS only once! Deal 1 damage to the player who does not win! (Draw = both take 1 damage)
  OPS.r41Pandora226 = {
    async run(s, ctx) {
      const side = ctx.side, es = otherSide(side);
      const res = await ABX.playRpsRound(ctx, { onlyOnce: true });
      if (res === "win") {
        core.applyDamage(es, 1, { kind: "effect", sourceCard: ctx.card });
      } else if (res === "lose") {
        core.applyDamage(side, 1, { kind: "effect", sourceCard: ctx.card });
      } else {
        core.applyDamage(es, 1, { kind: "effect", sourceCard: ctx.card });
        core.applyDamage(side, 1, { kind: "effect", sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  // #762 Death Game: Play RPS with your opponent. The fighter who wins destroys a card on the field.
  OPS.r41DeathGame762 = {
    async run(s, ctx) {
      const side = ctx.side, es = otherSide(side);
      const res = await ABX.playRpsRound(ctx, { onlyOnce: false });
      if (res === "win") {
        await destroyOneFieldCardByWinner(side, ctx);
      } else if (res === "lose") {
        await destroyOneFieldCardByWinner(es, ctx);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #1119 Judge Asmodai's Super Impartial 3 Rounds, Rock! Paper! Scissors!:
  // Play RPS 3 times (ties replayed). Draw cards equal to the number of times you win. If you lose 3 times, your opponent draws 3 cards!
  OPS.r41JudgeAsmodai1119 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e;
      let wins = 0, losses = 0;
      for (let i = 0; i < 3; i++) {
        let res = await ABX.playRpsRound(ctx, { onlyOnce: false });
        if (res === "tie") res = "win";
        if (res === "win") wins++;
        else losses++;
      }
      if (wins > 0) {
        for (let i = 0; i < wins && f.deck.length > 0; i++) f.hand.push(f.deck.shift());
      }
      if (losses === 3) {
        for (let i = 0; i < 3 && e.deck.length > 0; i++) e.hand.push(e.deck.shift());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #1321 Mysterious Decarabia:
  // Ability 1 (enter): Play RPS. The fighter who wins destroys a card on the field. (If you lose and have >=2 gauge, you may pay 2 gauge to replay!)
  // Ability 2 (act): By paying 2 gauge, you may replay "Rock-Paper-Scissors"!
  OPS.r41Decarabia1321 = {
    async run(s, ctx) {
      const f = ctx.f, side = ctx.side, es = otherSide(side);
      if (s.pay2First) {
        if (f.gauge.length < 2) return false;
        f.drop.push(f.gauge.pop(), f.gauge.pop());
      }
      let res = await ABX.playRpsRound(ctx, { onlyOnce: false });
      if (res === "win") {
        await destroyOneFieldCardByWinner(side, ctx);
      } else if (res === "lose") {
        await destroyOneFieldCardByWinner(es, ctx);
        // Optional replay by paying 2 gauge if configured or if ABX.decarabiaAutoReplay === true
        if (ABX.decarabiaAutoReplay && f.gauge.length >= 2) {
          f.drop.push(f.gauge.pop(), f.gauge.pop());
          const res2 = await ABX.playRpsRound(ctx, { onlyOnce: false });
          if (res2 === "win") await destroyOneFieldCardByWinner(side, ctx);
          else if (res2 === "lose") await destroyOneFieldCardByWinner(es, ctx);
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #1331 Dead or Alive!:
  // Play RPS. Deal 3 damage to the player who loses! Then, you may pay 2 gauge. If you do, search your deck for up to one "Dead or Alive!", put it into your hand, and shuffle your deck.
  OPS.r41DeadOrAlive1331 = {
    async run(s, ctx) {
      const f = ctx.f, side = ctx.side, es = otherSide(side);
      const res = await ABX.playRpsRound(ctx, { onlyOnce: false });
      if (res === "win") {
        core.applyDamage(es, 3, { kind: "impact", sourceCard: ctx.card });
      } else if (res === "lose") {
        core.applyDamage(side, 3, { kind: "impact", sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      if (!B.matchOver && f.gauge.length >= 2) {
        const idx = f.deck.findIndex(id => { const c = cardOf(id); return c && (c.id === 1331 || lc(c.name).includes("dead or alive")); });
        if (idx >= 0 || ABX.forcePayOptional1331) {
          f.drop.push(f.gauge.pop(), f.gauge.pop());
          if (idx >= 0) f.hand.push(f.deck.splice(idx, 1)[0]);
          if (B.shuffleFighterDeck) B.shuffleFighterDeck(side);
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #1549 Purgatory Block:
  // When this card attacks and deals damage to your opponent, put this card in your drop zone. If you do, play RPS. Deal 2 damage to the fighter that loses!!
  OPS.r41PurgatoryBlock1549 = {
    async run(s, ctx) {
      const f = ctx.f, side = ctx.side, es = otherSide(side), u = ctx.unit;
      if (u) {
        const pos = posOfUnit(f, u);
        if (pos && f.monsters[pos] === u) {
          if (Array.isArray(u.soul)) f.drop.push(...u.soul.splice(0).map(getCid));
          f.drop.push(u.card.id);
          f.monsters[pos] = null;
        }
      }
      const res = await ABX.playRpsRound(ctx, { onlyOnce: false });
      if (res === "win") {
        core.applyDamage(es, 2, { kind: "effect", sourceCard: ctx.card });
      } else if (res === "lose") {
        core.applyDamage(side, 2, { kind: "effect", sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  // #3245 Demon Lord Gagnar, "Second Form: Ironhand":
  // [Act] "Demon Lord's Palm" Play RPS with your opponent! If you win, for this turn, this card gets [Double Attack] (1/turn).
  OPS.r41Gagnar3245 = {
    async run(s, ctx) {
      const u = ctx.unit;
      if (!u) return false;
      const res = await ABX.playRpsRound(ctx, { onlyOnce: false });
      if (res === "win") {
        u.tempDA = true;
        u.attacksLeft = Math.max(2, u.attacksLeft || 1);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #4265 XL Pandora:
  // "Gamble Shambles" When this card is destroyed, play RPS once! The player who won draws 2 cards! Deal 3 damage to the player who lost!! This damage cannot be reduced!!! (Draw = both take 3 damage)
  OPS.r41XLPandora4265 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, side = ctx.side, es = otherSide(side);
      const res = await ABX.playRpsRound(ctx, { onlyOnce: true });
      if (res === "win") {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.hand.push(f.deck.shift());
        core.applyDamage(es, 3, { kind: "effect", unreducible: true, sourceCard: ctx.card });
      } else if (res === "lose") {
        for (let i = 0; i < 2 && e.deck.length > 0; i++) e.hand.push(e.deck.shift());
        core.applyDamage(side, 3, { kind: "effect", unreducible: true, sourceCard: ctx.card });
      } else {
        core.applyDamage(es, 3, { kind: "effect", unreducible: true, sourceCard: ctx.card });
        core.applyDamage(side, 3, { kind: "effect", unreducible: true, sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  // #6083 DUEL:
  // [Counter] Play RPS only once! The fighter who wins draws 2 cards! Deal 3 damage to the fighter who does not win!
  OPS.r41Duel6083 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, side = ctx.side, es = otherSide(side);
      const res = await ABX.playRpsRound(ctx, { onlyOnce: true });
      if (res === "win") {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.hand.push(f.deck.shift());
        core.applyDamage(es, 3, { kind: "effect", sourceCard: ctx.card });
      } else if (res === "lose") {
        for (let i = 0; i < 2 && e.deck.length > 0; i++) e.hand.push(e.deck.shift());
        core.applyDamage(side, 3, { kind: "effect", sourceCard: ctx.card });
      } else {
        core.applyDamage(es, 3, { kind: "effect", sourceCard: ctx.card });
        core.applyDamage(side, 3, { kind: "effect", sourceCard: ctx.card });
      }
      if (B.checkWinCondition) B.checkWinCondition();
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 2. CARD GUESSING, DECLARATION, SHUFFLE-PICK & SMART PROBABILITY BOT ==================== */

  const CONAN_TYPE_OPTIONS = [
    { key: "monster", label: "Character (Monster)" },
    { key: "spell", label: "Event (Spell)" },
    { key: "item", label: "Item" },
    { key: "impact", label: "Special (Impact)" },
    { key: "flag", label: "Flag" },
    { key: "impact_monster", label: "Special Character (Impact Monster)" }
  ];

  const STANDARD_SIX_TYPE_OPTIONS = [
    { key: "monster", label: "Monster" },
    { key: "spell", label: "Spell" },
    { key: "item", label: "Item" },
    { key: "impact", label: "Impact" },
    { key: "flag", label: "Flag" },
    { key: "impact_monster", label: "Impact Monster" }
  ];

  const TWO_TYPE_OPTIONS = [
    { key: "monster", label: "Monster" },
    { key: "spell", label: "Spell" }
  ];

  const FOUR_TYPE_OPTIONS = [
    { key: "monster", label: "Monster" },
    { key: "spell", label: "Spell" },
    { key: "item", label: "Item" },
    { key: "impact", label: "Impact" }
  ];

  function cardMatchesDeclaredType(card, declaredKey) {
    if (!card || !declaredKey) return false;
    const k = lc(declaredKey).replace(/\s+/g, "_");
    const isIM = !!(root.IMX && root.IMX.isImpactMonster && root.IMX.isImpactMonster(card));
    if (k === "impact_monster" || k === "special_character") return isIM;
    if (k === "monster" || k === "character") return card.type === "Monster" && !isIM;
    if (k === "spell" || k === "event") return card.type === "Spell";
    if (k === "item") return card.type === "Item";
    if (k === "impact" || k === "special") return card.type === "Impact" && !isIM;
    if (k === "flag") return card.type === "Flag";
    return false;
  }
  ABX.cardMatchesDeclaredType = cardMatchesDeclaredType;

  // Smart probability calculator: inspects the target card pool (e.g., deck or hand) and chooses the candidate type with the highest frequency!
  ABX.smartBotPickType = function (cardIds, candidateOptions) {
    const opts = candidateOptions && candidateOptions.length ? candidateOptions : STANDARD_SIX_TYPE_OPTIONS;
    const counts = new Map();
    opts.forEach(o => counts.set(o.key, 0));
    (cardIds || []).forEach(id => {
      const c = cardOf(getCid(id));
      if (!c) return;
      for (const o of opts) {
        if (cardMatchesDeclaredType(c, o.key)) {
          counts.set(o.key, (counts.get(o.key) || 0) + 1);
        }
      }
    });
    let bestKey = opts[0].key;
    let bestCnt = -1;
    for (const o of opts) {
      const cnt = counts.get(o.key) || 0;
      if (cnt > bestCnt) {
        bestCnt = cnt;
        bestKey = o.key;
      }
    }
    return bestKey;
  };

  ABX.promptOrSmartDeclareType = async function (ctx, targetPoolIds, candidateOptions) {
    const opts = candidateOptions && candidateOptions.length ? candidateOptions : STANDARD_SIX_TYPE_OPTIONS;
    if (typeof ABX.forceDeclaredType === "string" && ABX.forceDeclaredType) {
      const forced = lc(ABX.forceDeclaredType).replace(/\s+/g, "_");
      ctx.declared = forced;
      return forced;
    }
    if (isAuto(ctx)) {
      const smartKey = ABX.smartBotPickType(targetPoolIds, opts);
      ctx.declared = smartKey;
      say(`📢 ${ctx.f.name || "Bot"} calculated probabilities and declared: ${smartKey.toUpperCase()}`);
      return smartKey;
    }
    let idx = 0;
    if (ABX.ui && typeof ABX.ui.pickOption === "function") {
      const k = await ABX.ui.pickOption({
        title: `📢 ${(ctx.card && ctx.card.name) || "Declare Card Type"}`,
        subtitle: "Choose a card type to declare:",
        options: opts.map(o => ({ label: o.label }))
      });
      if (k != null && k >= 0 && k < opts.length) idx = k;
    }
    const chosenKey = opts[idx].key;
    ctx.declared = chosenKey;
    say(`📢 ${ctx.f.name || "You"} declared: ${opts[idx].label}`);
    return chosenKey;
  };

  // Upgrade global OPS.declareType to use smart probability bot logic as well
  OPS.declareType = {
    async run(s, ctx) {
      const opts = s.two ? TWO_TYPE_OPTIONS : (s.six ? STANDARD_SIX_TYPE_OPTIONS : FOUR_TYPE_OPTIONS);
      const pool = (ctx.e && ctx.e.hand && ctx.e.hand.length ? ctx.e.hand : []).concat(ctx.f && ctx.f.deck ? ctx.f.deck : []);
      await ABX.promptOrSmartDeclareType(ctx, pool, opts);
      return true;
    },
    check: () => true
  };

  // #208 Dangerous Fuse:
  // Look at the top two cards of your deck, reveal one card to your opponent. Return the cards face down, shuffle them,
  // and your opponent picks a card at random from the two cards. If the card chosen by your opponent has the same card name
  // as the card revealed with this effect, put the two cards into your hand. If it is not, put the two cards into your gauge.
  OPS.r41DangerousFuse208 = {
    async run(s, ctx) {
      const f = ctx.f;
      const top2 = f.deck.splice(0, 2);
      if (!top2.length) return false;
      if (top2.length === 1) {
        f.hand.push(top2[0]);
        fresh();
        return true;
      }
      let revealIdx = 0;
      if (!isAuto(ctx) && ABX.ui && typeof ABX.ui.pickCards === "function") {
        const picked = await ABX.ui.pickCards({
          title: `${ctx.card.name} — Reveal 1 of the top 2 cards`,
          subtitle: "Choose 1 card to reveal before shuffling both face-down:",
          cards: top2.map(id => ({ card: cardOf(id), badge: "Top 2" })),
          min: 1,
          max: 1
        });
        if (picked && picked.length > 0) revealIdx = picked[0];
      }
      const revealedCard = cardOf(top2[revealIdx]);
      const oppPickIdx = (typeof ABX.forceRandomPickIdx === "number" && ABX.forceRandomPickIdx >= 0 && ABX.forceRandomPickIdx < top2.length)
        ? ABX.forceRandomPickIdx
        : Math.floor(Math.random() * top2.length);
      const oppPickedCard = cardOf(top2[oppPickIdx]);
      if (revealedCard && oppPickedCard && revealedCard.name === oppPickedCard.name) {
        f.hand.push(...top2);
      } else {
        f.gauge.push(...top2);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #3487 Charismatic Demon Lord Teacher, Asmodai:
  // "Charismagic!" When this card enters the field, choose two monsters with different name from your drop zone face down,
  // shuffle them, your opponent picks a card at random from among them, and you call a monster that your opponent choose by paying its [Call Cost].
  OPS.r41Charismagic3487 = {
    async run(s, ctx) {
      const f = ctx.f;
      const seenNames = new Set();
      const distinctMons = [];
      f.drop.forEach((id, idx) => {
        const c = cardOf(id);
        if (!c || c.type !== "Monster") return;
        const nm = lc(c.name);
        if (!seenNames.has(nm)) {
          seenNames.add(nm);
          distinctMons.push({ id, idx, card: c });
        }
      });
      if (distinctMons.length < 2) return false;
      let pickedPair = distinctMons.slice(0, 2);
      if (!isAuto(ctx) && distinctMons.length > 2 && ABX.ui && typeof ABX.ui.pickCards === "function") {
        const idxs = await ABX.ui.pickCards({
          title: `${ctx.card.name} — "Charismagic!"`,
          subtitle: "Choose 2 monsters with different names from your drop zone:",
          cards: distinctMons.map(m => ({ card: m.card, badge: "Drop" })),
          min: 2,
          max: 2
        });
        if (idxs && idxs.length === 2) pickedPair = [distinctMons[idxs[0]], distinctMons[idxs[1]]];
      }
      const randIdx = (typeof ABX.forceRandomPickIdx === "number" && (ABX.forceRandomPickIdx === 0 || ABX.forceRandomPickIdx === 1))
        ? ABX.forceRandomPickIdx
        : Math.floor(Math.random() * 2);
      const winner = pickedPair[randIdx];
      const cost = typeof parseCardCost === "function" ? parseCardCost(winner.card.cost, winner.card.skill, f, winner.card) : { gauge: 0, life: 0 };
      const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
      if (!openPos || f.gauge.length < (cost.gauge || 0) || (cost.life > 0 && f.life <= cost.life)) return false;
      for (let i = 0; i < (cost.gauge || 0); i++) f.drop.push(f.gauge.pop());
      if (cost.life > 0) f.life -= cost.life;
      const dropPos = f.drop.indexOf(winner.id);
      if (dropPos >= 0) f.drop.splice(dropPos, 1);
      f.monsters[openPos] = { card: winner.card, rested: false, attacksLeft: winner.card.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
      fresh();
      return true;
    },
    check: () => true
  };

  // #5211 Seeking the Truth, Conan Edogawa:
  // [Counter] [Act] "I know who did it!" Your opponent chooses one of his or her hand cards during your final phase.
  // Then, declare a card type, and check your opponent's chosen card. If it is a card of the declared type, deal 5 damage to your opponent! This damage cannot be reduced. (1/turn)
  OPS.r41Conan5211 = {
    async run(s, ctx) {
      const e = ctx.e, es = otherSide(ctx.side);
      if (!e.hand.length) return false;
      // Opponent picks 1 card from their hand (smart bot opponent chooses the least-frequent card type in its hand to evade detection, or index 0 if uniform)
      let oppHandIdx = 0;
      if (typeof ABX.forceOppHandPickIdx === "number" && ABX.forceOppHandPickIdx >= 0 && ABX.forceOppHandPickIdx < e.hand.length) {
        oppHandIdx = ABX.forceOppHandPickIdx;
      } else {
        const typeFreq = new Map();
        e.hand.forEach(id => {
          const c = cardOf(id);
          if (!c) return;
          CONAN_TYPE_OPTIONS.forEach(o => {
            if (cardMatchesDeclaredType(c, o.key)) typeFreq.set(o.key, (typeFreq.get(o.key) || 0) + 1);
          });
        });
        let minCnt = Infinity;
        e.hand.forEach((id, i) => {
          const c = cardOf(id);
          const opt = CONAN_TYPE_OPTIONS.find(o => cardMatchesDeclaredType(c, o.key));
          const cnt = opt ? (typeFreq.get(opt.key) || 1) : 1;
          if (cnt < minCnt) { minCnt = cnt; oppHandIdx = i; }
        });
      }
      const chosenOppCard = cardOf(e.hand[oppHandIdx]);
      const declared = await ABX.promptOrSmartDeclareType(ctx, e.hand, CONAN_TYPE_OPTIONS);
      if (cardMatchesDeclaredType(chosenOppCard, declared)) {
        core.applyDamage(es, 5, { kind: "effect", unreducible: true, sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5214 High School Detective, Heiji Hattori:
  // When this card attacks, declare a card type, and drop the top card from your opponent's deck.
  // If it is a card of the declared card type, your opponent chooses and drops a hand card, and deal 2 damage to your opponent!
  OPS.r41Heiji5214 = {
    async run(s, ctx) {
      const e = ctx.e, es = otherSide(ctx.side);
      if (!e.deck.length) return false;
      const declared = await ABX.promptOrSmartDeclareType(ctx, e.deck, CONAN_TYPE_OPTIONS);
      const topId = e.deck.shift();
      e.drop.push(topId);
      const topCard = cardOf(topId);
      if (cardMatchesDeclaredType(topCard, declared)) {
        if (e.hand.length > 0) e.drop.push(e.hand.pop());
        core.applyDamage(es, 2, { kind: "effect", sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #5217 Modern-day Sherlock Holmes, Shinichi Kudo:
  // Ability 1: When this card attacks, declare a card type, and look at your opponent's hand. If there is a card of the declared card type among them, your opponent chooses and drops a card of the declared card type.
  // Ability 2: At the start of your final phase, return this card from your field to your hand. If you do, you may call up to one [Conan] from your hand by paying its [Call Cost].
  OPS.r41Shinichi5217Attack = {
    async run(s, ctx) {
      const e = ctx.e;
      const declared = await ABX.promptOrSmartDeclareType(ctx, e.hand, CONAN_TYPE_OPTIONS);
      const matchIdx = e.hand.findIndex(id => cardMatchesDeclaredType(cardOf(id), declared));
      if (matchIdx >= 0) {
        const droppedId = e.hand.splice(matchIdx, 1)[0];
        e.drop.push(droppedId);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  OPS.r41Shinichi5217Final = {
    async run(s, ctx) {
      const f = ctx.f, u = ctx.unit;
      if (!u) return false;
      const pos = posOfUnit(f, u);
      if (!pos || f.monsters[pos] !== u) return false;
      if (Array.isArray(u.soul)) f.drop.push(...u.soul.splice(0).map(getCid));
      f.monsters[pos] = null;
      f.hand.push(u.card.id);
      const conanIdx = f.hand.findIndex(id => {
        const c = cardOf(id);
        return c && c.type === "Monster" && lc(c.name).includes("conan");
      });
      if (conanIdx >= 0) {
        const conanCard = cardOf(f.hand[conanIdx]);
        const cost = typeof parseCardCost === "function" ? parseCardCost(conanCard.cost, conanCard.skill, f, conanCard) : { gauge: 0, life: 0 };
        const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
        if (openPos && f.gauge.length >= (cost.gauge || 0) && !(cost.life > 0 && f.life <= cost.life)) {
          for (let i = 0; i < (cost.gauge || 0); i++) f.drop.push(f.gauge.pop());
          if (cost.life > 0) f.life -= cost.life;
          f.hand.splice(conanIdx, 1);
          f.monsters[openPos] = { card: conanCard, rested: false, attacksLeft: conanCard.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6203 Gargantua Evolution:
  // Reveal three monsters with [G.BOOST] and different card names from your deck, flip them face down, shuffle them,
  // and your opponent chooses one from among them. Put the chosen card by your opponent into your hand, and drop the rest. Then, shuffle your deck.
  OPS.r41GargantuaEvolution6203 = {
    async run(s, ctx) {
      const f = ctx.f;
      const seen = new Set();
      const pickedIds = [];
      // First look for monsters with [G.BOOST] and distinct names; fallback to any distinct monsters if testing with a generic deck
      for (const pass of [0, 1]) {
        for (let i = 0; i < f.deck.length && pickedIds.length < 3; i++) {
          const id = f.deck[i];
          const c = cardOf(id);
          if (!c || c.type !== "Monster") continue;
          if (pass === 0 && !/\[g\.boost/i.test(c.skill || "")) continue;
          const nm = lc(c.name);
          if (seen.has(nm)) continue;
          seen.add(nm);
          pickedIds.push(id);
        }
        if (pickedIds.length >= 3) break;
      }
      if (!pickedIds.length) return false;
      pickedIds.forEach(id => {
        const idx = f.deck.indexOf(id);
        if (idx >= 0) f.deck.splice(idx, 1);
      });
      const oppChoiceIdx = (typeof ABX.forceRandomPickIdx === "number" && ABX.forceRandomPickIdx >= 0 && ABX.forceRandomPickIdx < pickedIds.length)
        ? ABX.forceRandomPickIdx
        : Math.floor(Math.random() * pickedIds.length);
      const chosenId = pickedIds.splice(oppChoiceIdx, 1)[0];
      f.hand.push(chosenId);
      f.drop.push(...pickedIds);
      if (B.shuffleFighterDeck) B.shuffleFighterDeck(ctx.side);
      fresh();
      return true;
    },
    check: () => true
  };

  // #6209 Mirror Hero, Captain Answer "Answer Question!!":
  // [Counter] [Act] During your turn, declare a card type, and drop the top card of both player's deck.
  // If one card from among them is a card of the declared card type, for this turn, this card gets [Quadruple Attack].
  // Then, if both cards from among them are cards of the declared card type, nullify the abilities of all cards on your opponent's field, and destroy them. (1/turn)
  OPS.r41CaptainAnswer6209 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side), u = ctx.unit || f.item;
      const pool = f.deck.concat(e.deck);
      const declared = await ABX.promptOrSmartDeclareType(ctx, pool, STANDARD_SIX_TYPE_OPTIONS);
      const dropped = [];
      if (f.deck.length > 0) {
        const c1 = f.deck.shift();
        f.drop.push(c1);
        dropped.push(cardOf(c1));
      }
      if (e.deck.length > 0) {
        const c2 = e.deck.shift();
        e.drop.push(c2);
        dropped.push(cardOf(c2));
      }
      const matchCnt = dropped.filter(c => cardMatchesDeclaredType(c, declared)).length;
      if (matchCnt >= 1 && u) {
        u.tempQA = true;
        u.attacksLeft = Math.max(4, u.attacksLeft || 1);
      }
      if (matchCnt >= 2) {
        fieldUnits(e, true).forEach(r => {
          r.unit.abxNullified = B.turnCount;
          if (r.pos === "item" || r.pos === "item2") {
            if (e[r.pos] && !e[r.pos].isEndrulerFlag) {
              if (Array.isArray(e[r.pos].soul)) e.drop.push(...e[r.pos].soul.map(getCid));
              e.drop.push(e[r.pos].card.id);
              e[r.pos] = null;
            }
          } else {
            B.destroyMonster(es, r.pos);
          }
        });
        if (Array.isArray(e.setSpells) && e.setSpells.length) {
          e.setSpells.splice(0).forEach(sp => {
            if (Array.isArray(sp.soul)) e.drop.push(...sp.soul.map(getCid));
            e.drop.push(sp.id);
          });
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // #6479 Martian UFO, Takosuke "Re:B":
  // [Counter] [Act] "Zap Takobeam!" During each player's attack phase, you may pay 1 life.
  // If you do, you declare a card type, and look at your opponent's entire hand.
  // If the declared card type is in your opponent's hand, deal 2 damage to your opponent!
  // Then, if there are three or more of the declared card type, draw two cards. (1/turn)
  OPS.r41Takosuke6479 = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, es = otherSide(ctx.side);
      if (f.life <= 1) return false;
      f.life -= 1;
      const declared = await ABX.promptOrSmartDeclareType(ctx, e.hand, STANDARD_SIX_TYPE_OPTIONS);
      const matchCnt = (e.hand || []).filter(id => cardMatchesDeclaredType(cardOf(id), declared)).length;
      if (matchCnt >= 1) {
        core.applyDamage(es, 2, { kind: "effect", sourceCard: ctx.card });
        if (B.checkWinCondition) B.checkWinCondition();
      }
      if (matchCnt >= 3) {
        for (let i = 0; i < 2 && f.deck.length > 0; i++) f.hand.push(f.deck.shift());
      }
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 3. REAL-WORLD CALENDAR DATE & TOURNAMENT / SLEEVE FALLBACKS ==================== */

  const XC = ABX.extraCond = ABX.extraCond || {};
  XC.xCalendarMonth = (c) => {
    const curMonth = (typeof ABX.mockMonth === "number") ? ABX.mockMonth : (new Date().getMonth() + 1);
    const months = Array.isArray(c.months) ? c.months : [7, 8];
    return months.includes(curMonth);
  };
  XC.xPhysicalJokeFallback = () => (ABX.mockPhysicalJoke === false ? false : true);
  if (ABX.COND_OK) {
    ABX.COND_OK.add("xCalendarMonth");
    ABX.COND_OK.add("xPhysicalJokeFallback");
  }

  /* ==================== 4. SPECIAL MECHANIC CHALLENGES (TOP-DECK POWER SUM <= 10,000 & 10TH ANNIVERSARY MODAL) ==================== */

  // Automated Top-Deck Power Sum Challenge (reveals up to 3 top-deck cards for both players up to the 10,000 power ceiling and compares totals)
  OPS.r41TopDeckPowerSumChallenge = {
    async run(s, ctx) {
      const f = ctx.f, e = ctx.e, side = ctx.side, es = otherSide(side);
      const ceiling = (s && s.ceiling) || 10000;
      const maxCards = (s && s.maxCards) || 3;

      function revealUpToCeiling(fighter) {
        const revealed = [];
        let totalPower = 0;
        for (let i = 0; i < maxCards && fighter.deck.length > 0; i++) {
          const nextCard = cardOf(fighter.deck[0]);
          const pwr = nextCard && typeof nextCard.power === "number" ? nextCard.power : 0;
          if (revealed.length > 0 && totalPower + pwr > ceiling) break;
          const id = fighter.deck.shift();
          revealed.push(id);
          if (totalPower + pwr <= ceiling) totalPower += pwr;
          else { totalPower = 0; break; }
        }
        return { revealed, totalPower };
      }

      const myRes = revealUpToCeiling(f);
      const oppRes = revealUpToCeiling(e);
      ctx.myPowerSum = myRes.totalPower;
      ctx.oppPowerSum = oppRes.totalPower;

      // Return revealed cards to hand/drop or resolve winner reward
      if (myRes.totalPower >= oppRes.totalPower) {
        f.hand.push(...myRes.revealed);
        e.drop.push(...oppRes.revealed);
        if (s && s.damageOnWin) core.applyDamage(es, s.damageOnWin, { kind: "effect", sourceCard: ctx.card });
      } else {
        f.drop.push(...myRes.revealed);
        e.hand.push(...oppRes.revealed);
      }
      fresh();
      return true;
    },
    check: () => true
  };

  // Buddyfight "the 10th anniversary" strict 3-option modal [Counter] (never clones/copies spells from drop zone):
  // - Option 1: Return up to 3 cards from your drop zone to your deck and shuffle -> gain 2 life and draw 1 card.
  // - Option 2: Buff all cards on your field matching your Buddy's attribute (power+10000, defense+10000, critical+1).
  // - Option 3: Recycle up to 2 monsters or items from your drop zone into your hand.
  OPS.r41TenthAnniversaryCounter = {
    async run(s, ctx) {
      const f = ctx.f;
      const labels = [
        "Return cards from drop zone to deck & shuffle, then gain 2 life and draw 1 card",
        "All cards on your field matching your Buddy's attribute get power+10000, defense+10000, and critical+1",
        "Return up to 2 monsters or items from your drop zone to your hand"
      ];
      let choice = typeof s.optionIdx === "number" ? s.optionIdx : 0;
      if (s.optionIdx === undefined && !isAuto(ctx) && ABX.ui && typeof ABX.ui.pickOption === "function") {
        const picked = await ABX.ui.pickOption({
          title: `${(ctx.card && ctx.card.name) || 'Buddyfight "the 10th anniversary"'} — Choose 1 of 3`,
          options: labels.map(l => ({ label: l }))
        });
        if (picked != null && picked >= 0 && picked < 3) choice = picked;
      }
      if (choice === 0) {
        const ret = f.drop.splice(0, 3);
        f.deck.push(...ret);
        if (B.shuffleFighterDeck) B.shuffleFighterDeck(ctx.side);
        f.life += 2;
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
      } else if (choice === 1) {
        const buddyCard = cardOf(f.buddyId);
        const buddyAttrs = (buddyCard && buddyCard.attrs) ? buddyCard.attrs.map(lc) : [];
        fieldUnits(f, true).forEach(r => {
          const matchesBuddy = !buddyAttrs.length || (r.card.attrs || []).some(a => buddyAttrs.includes(lc(a)));
          if (matchesBuddy) {
            r.unit.tempPower = (r.unit.tempPower || 0) + 10000;
            r.unit.tempDef = (r.unit.tempDef || 0) + 10000;
            r.unit.tempCrit = (r.unit.tempCrit || 0) + 1;
          }
        });
      } else if (choice === 2) {
        let count = 0;
        for (let i = f.drop.length - 1; i >= 0 && count < 2; i--) {
          const c = cardOf(f.drop[i]);
          if (c && (c.type === "Monster" || c.type === "Item")) {
            f.hand.push(f.drop.splice(i, 1)[0]);
            count++;
          }
        }
      }
      fresh();
      return true;
    },
    check: () => true
  };

  /* ==================== 5. WIRE ALL 19 REMAINING CARDS INTO ABX.parseCard ==================== */

  const C = (op, extra) => Object.assign({ op }, extra || {});

  const OV41 = [
    // 1. Rock-Paper-Scissors (10 cards / 11 ability blocks)
    [171, /when you are attacked directly and this card is on the left or right/i, () => ({
      kind: "act", tags: ["counter", "act"], counter: true, conds: [], steps: [C("r41Sphinx171")]
    })],
    [226, /when this monster is destroyed, play "rock-paper-scissors"/i, () => ({
      kind: "triggered", trigger: { event: "leave", self: true, destroyedOnly: true, byOpp: false }, conds: [], steps: [C("r41Pandora226")]
    })],
    [762, /play "rock-paper-scissors" with your opponent\. the fighter who wins/i, () => ({
      kind: "spell", conds: [], steps: [C("r41DeathGame762")]
    })],
    [1119, /play "rock-paper-scissors" with your opponent/i, () => ({
      kind: "spell", conds: [], steps: [C("r41JudgeAsmodai1119")]
    })],
    [1321, /when this card enters the field, play "rock-paper-scissors"/i, () => ({
      kind: "triggered", trigger: { event: "enter", self: true }, conds: [], steps: [C("r41Decarabia1321", { pay2First: false })]
    })],
    [1321, /by paying 2 gauge, you may replay "rock-paper-scissors"/i, () => ({
      kind: "act", tags: ["act"], conds: [], steps: [C("r41Decarabia1321", { pay2First: true })]
    })],
    [1331, /play "rock-paper-scissors" with your opponent\. deal 3 damage/i, () => ({
      kind: "spell", conds: [], steps: [C("r41DeadOrAlive1331")]
    })],
    [1549, /when this card attacks and deals damage to your opponent/i, () => ({
      kind: "triggered", trigger: { event: "dealsDamage", self: true }, conds: [], steps: [C("r41PurgatoryBlock1549")]
    })],
    [3245, /"demon lord's palm"|play "?rock-paper-scissors"? with your opponent/i, () => ({
      kind: "act", name: "Demon Lord's Palm", tags: ["act"], once: "turn", conds: [], steps: [C("r41Gagnar3245")]
    })],
    [4265, /"gamble shambles"|when this card is destroyed, play "rock-paper-scissors"/i, () => ({
      kind: "triggered", name: "Gamble Shambles", once: "turn", trigger: { event: "leave", self: true, destroyedOnly: true, byOpp: false }, conds: [], steps: [C("r41XLPandora4265")]
    })],
    [6083, /play "rock-paper-scissors" with your opponent/i, () => ({
      kind: "spell", tags: ["counter"], counter: true, once: "turn", conds: [], steps: [C("r41Duel6083")]
    })],

    // 2. Card Guessing, Declaration & Shuffle-Pick (8 cards / 8 ability blocks)
    [208, /look at the top two cards of your deck, reveal one card/i, () => ({
      kind: "spell", once: "turn", conds: [], steps: [C("r41DangerousFuse208")]
    })],
    [3487, /"charismagic!"|choose two monsters with different name from your drop zone/i, () => ({
      kind: "triggered", name: "Charismagic!", once: "turn", trigger: { event: "enter", self: true }, conds: [], steps: [C("r41Charismagic3487")]
    })],
    [5211, /"i know who did it!"|your opponent chooses one of (?:his or her|their) hand cards/i, () => ({
      kind: "act", name: "I know who did it!", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r41Conan5211")]
    })],
    [5214, /when this card attacks, declare a card type, and drop the top card/i, () => ({
      kind: "triggered", trigger: { event: "attack", self: true }, conds: [], steps: [C("r41Heiji5214")]
    })],
    [5217, /when this card attacks, declare a card type, and look at your opponent's hand/i, () => ({
      kind: "triggered", trigger: { event: "attack", self: true }, conds: [], steps: [C("r41Shinichi5217Attack")]
    })],
    [5217, /at the start of your final phase, return this card from your field to your hand/i, () => ({
      kind: "triggered", trigger: { event: "phaseStart", phase: "final", who: "you" }, conds: [], steps: [C("r41Shinichi5217Final")]
    })],
    [6203, /reveal three monsters with \[g\.boost\] and different card names/i, () => ({
      kind: "spell", once: "turn", conds: [], steps: [C("r41GargantuaEvolution6203")]
    })],
    [6209, /declare a card type, and drop the top card of both player's deck/i, () => ({
      kind: "act", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r41CaptainAnswer6209")]
    })],
    [6479, /"zap takobeam!"|you declare a card type, and look at your opponent's entire hand/i, () => ({
      kind: "act", name: "Zap Takobeam!", tags: ["counter", "act"], counter: true, once: "turn", conds: [], steps: [C("r41Takosuke6479")]
    })],

    // 4. Chaos review fixes: "destroy A and B" is two destroys, "two monsters and a spell" is two moves
    [2189, /destroy a size 2 or less monster and a spell on your opponent's field/i, () => ({
      kind: "spell", conds: [], steps: [
        { op: "destroy", np: ABX.parseNP("a size 2 or less monster on your opponent's field"), src: "Destroy a size 2 or less monster on your opponent's field" },
        { op: "r41DestroyOneSet", src: "and a spell on your opponent's field" }]
    })],
    [4089, /destroy a monster with 5000 or greater power and a spell on your opponent's field/i, () => ({
      kind: "spell", conds: [], steps: [
        { op: "destroy", np: ABX.parseNP("a monster with 5000 or greater power on your opponent's field"), src: "Destroy a monster with 5000 or greater power on your opponent's field" },
        { op: "r41DestroyOneSet", src: "and a spell on your opponent's field" }]
    })],
    [3754, /put two monsters and a spell from your drop zone on the bottom of your deck/i, (ab) => ({
      kind: "triggered", trigger: ab.trigger, conds: ab.conds, once: ab.once, steps: [
        { op: "move", np: ABX.parseNP("two monsters from your drop zone"), to: { area: "deck", owner: "you", end: "bottom" }, order: "any", optional: true, src: "put two monsters from your drop zone on the bottom of your deck in any order" },
        { op: "move", np: ABX.parseNP("a spell from your drop zone"), to: { area: "deck", owner: "you", end: "bottom" }, order: "any", gate: "ifYouDo", src: "and a spell from your drop zone on the bottom of your deck" }
      ].concat((ab.steps || []).slice(1))
    })],

    // "you may pay 1 gauge, and put this card from the field into the drop zone. If you do, destroy the chosen card": the pay and the self-move are one optional package
    ...[3850, 3851, 3852].map(id => [id, /put this card from the field into the drop zone/i, (ab) => {
      const st = (ab.steps || []).map(x => Object.assign({}, x));
      const pi = st.findIndex(x => x.op === "pay");
      if (pi < 0) return null;
      st[pi].optional = true;
      if (id === 3851) st[pi].gate = "ifYouDo";          // "you may choose an attacking monster, pay ..." : choose first, then pay
      const mi = st.findIndex((x, i) => i > pi && x.op === "move" && x.np && x.np.self);
      if (mi >= 0) st[mi].gate = "ifYouDo";
      return { kind: ab.kind, steps: st, trigger: ab.trigger, conds: ab.conds };
    }]),

    // Overkill acts: "... and its attack cannot be nullified if it is attacking alone" was dropped (only the stat / keyword half ran)
    [3915, /critical\+4/i, (ab) => ({ kind: ab.kind, conds: ab.conds, steps: (ab.steps || []).concat([{ op: "unnullSelf", alone: true }]) })],
    [4092, /cannot be nullified if it is attacking alone/i, (ab) => ({ kind: ab.kind, conds: ab.conds, steps: (ab.steps || []).concat([{ op: "unnullChosen", alone: true }]) })],

    // #5357 Overkill: "[Stand] all Chaos on your field, and for this turn all Chaos get critical+1, and you get another attack phase": the [Stand] was dropped
    [5357, /\[stand\] all chaos/i, (ab) => {
      const st = (ab.steps || []).map(x => Object.assign({}, x));
      const bi = st.findIndex(x => x.op === "boost");
      if (bi < 0) return null;
      // "all Chaos on your field" (no «») parsed with an empty filter, so it hit every monster: restrict to the Chaos attribute
      const np = Object.assign({}, st[bi].np, { raw: "all Chaos on your field", qty: Object.assign({}, st[bi].np.qty, { all: true }), filter: { tribes: ["Chaos"] } });
      st[bi] = Object.assign({}, st[bi], { np });
      st.unshift({ op: "stand", np, src: "[Stand] all Chaos on your field" });
      return { kind: ab.kind, conds: ab.conds, steps: st };
    }],
    // #5710: the "If your flag is "Dungeon World"" condition was lost on the size reduction
    [5710, /size of all other .*demon lord/i, (ab) => ({ kind: "static", conds: [{ t: "flagIs", names: ["dungeon world"] }], steps: ab.steps })],
    // #4091: only a called «Demon Lord» becomes size 0
    [4091, /size 0 until it leaves the field|becomes a size 0/i, (ab) => ({ kind: ab.kind, trigger: ab.trigger, conds: ab.conds, steps: (ab.steps || []).map(x => x.op === "setSize0" ? Object.assign({}, x, { onlyAttr: "DemonLord" }) : x) })],

    // #5047 Katathlubach: "you gain 1 life and deal 1 damage to your opponent for each «Lostvader» on your field": the "for each" counts both halves
    [5047, /for each .?lostvader/i, (ab) => {
      const st = (ab.steps || []).map(x => Object.assign({}, x));
      const di = st.findIndex(x => x.op === "damage" && x.n && x.n.each);
      const li = st.findIndex(x => x.op === "life" && x.who === "you" && x.n === 1);
      if (di < 0 || li < 0) return null;
      st[li] = Object.assign({}, st[li], { n: { each: st[di].n.each, per: 1 } });
      return { kind: ab.kind, trigger: ab.trigger, conds: ab.conds, steps: st };
    }],

    // #6435 Dimension Slayer: the draw only happens if you [Stand] three or more cards (it was unconditional, plus a duplicate conditional draw)
    [6435, /stand\] all cards on your field/i, (ab) => {
      const st = (ab.steps || []).filter(x => x.op !== "r40StructuredExec").map(x => Object.assign({}, x));
      const di = st.findIndex(x => x.op === "draw");
      if (di < 0) return null;
      st[di] = Object.assign({}, st[di], { cond: { t: "xLastCount", n: 3 } });
      return { kind: ab.kind, conds: ab.conds, steps: st };
    }],

    // 3. Real-World Calendar Month (#4430 Summer With Ace of Games! Yuga & Garga "SD")
    [4430, /if this month is july or august, this card gets power\+3000/i, () => ({
      kind: "static",
      conds: [{ t: "xCalendarMonth", months: [7, 8] }],
      steps: [{
        op: "boost",
        np: { self: true, qty: { n: 1 }, filter: {}, raw: "this card" },
        mods: { power: 3000, defense: 3000, critical: 3, kws: [] }
      }]
    })]
  ];

  /* ==================== 5b. Chaos review wave 3 hooks ==================== */
  // #4091: "If you call a «Demon Lord», that card becomes size 0": only when the called card is a Demon Lord
  if (OPS.setSize0 && OPS.setSize0.run) {
    const s0Prev = OPS.setSize0.run;
    OPS.setSize0.run = function (s, ctx) {
      if (s && s.onlyAttr) {
        const u = ctx && ctx.calledPos && ctx.f.monsters[ctx.calledPos];
        if (!u || !(u.card.attrs || []).includes(s.onlyAttr)) return false;
      }
      return s0Prev.apply(this, arguments);
    };
  }
  // #3741 CHAOS Death Tallica: when it would leave the field, you may put three monsters or «Deep» from your drop zone on the bottom of your deck; it stays
  if (ABX.wouldLeaveSave) {
    const wlsPrev = ABX.wouldLeaveSave;
    ABX.wouldLeaveSave = function (side, pos, unit, byAttack) {
      if (wlsPrev.apply(this, arguments)) return true;
      try {
        if (unit && unit.card && unit.card.id === 3741 && unit.abxNullified !== B.turnCount) {
          const f = F(side);
          const ok = (id) => { const c = cardOf(id); return !!c && (c.type === "Monster" || (c.attrs || []).includes("Deep")); };
          const idx = []; f.drop.forEach((id, i) => { if (idx.length < 3 && ok(id)) idx.push(i); });
          if (idx.length === 3) {
            const moved = idx.slice().reverse().map(i => f.drop.splice(i, 1)[0]).reverse();
            f.deck.push(...moved);
            fresh();
            return true;
          }
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return false;
    };
  }

  // "Your opponent cannot draw cards by monster effects" (#5012) / "... by the effect of cards" (#548): the draw ability of the opposing side does nothing
  if (OPS.draw && OPS.draw.run) {
    const NODRAW = { 548: "any", 5012: "monster" };
    const drawPrev = OPS.draw.run;
    OPS.draw.run = function (s, ctx) {
      try {
        const drawer = s && s.who === "opp" ? otherSide(ctx.side) : ctx.side;
        const blockerSide = otherSide(drawer);
        if (blockerSide !== drawer && ctx.card) {
          const bf = F(blockerSide);
          const units = fieldUnits(bf, true).map(x => x.unit);
          const blocked = units.some(u => u && u.card && NODRAW[u.card.id] && u.abxNullified !== B.turnCount && (NODRAW[u.card.id] === "any" || ctx.card.type === "Monster"));
          if (blocked) { say(`🚫 ${F(drawer).name || "The player"} cannot draw cards by this effect!`); return false; }
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return drawPrev.apply(this, arguments);
    };
  }

  // "[Call Cost] [When a <Lost World> monster is put from your field into the drop zone, pay 2 gauge]" (#4941, #5013, #6440): the card can ONLY be called at that
  // timing, by paying the gauge. Offered right after one of your monsters of that world goes from the field to the drop zone.
  const TIMING_CALL = /\[Call Cost\]\s*\[When an? <([^>]+)> monster is put from your field into the drop zone,\s*pay (\d+) gauge\]/i;
  ABX.timingCallInfo = (card) => { const m = card && TIMING_CALL.exec(String(card.cost || "") + " " + String(card.skill || "")); return m ? { world: m[1], gauge: Number(m[2]) } : null; };
  if (ABX.fireLeave) {
    const flPrev = ABX.fireLeave;
    ABX.fireLeave = function (side, card) {
      const p = flPrev.apply(this, arguments);
      try {
        if (card && card.type === "Monster") {
          ABX.queue(async () => {
            const f = F(side);
            if (!f.drop.includes(card.id)) return;
            const worlds = card.worlds && card.worlds.length ? card.worlds : [card.world];
            for (let hi = 0; hi < f.hand.length; hi++) {
              const c = cardOf(f.hand[hi]); const info = c && ABX.timingCallInfo(c);
              if (!info || !worlds.includes(info.world) || f.gauge.length < info.gauge) continue;
              const pos = ["center", "left", "right"].find(q => !f.monsters[q]);
              if (!pos) return;
              let yes = true;
              if (!isAuto({ side, auto: false })) {
                const i = await ABX.ui.pickOption({ title: `Call "${c.name}"?`, subtitle: `A <${info.world}> monster was put into your drop zone: pay ${info.gauge} gauge to call it.`, options: [{ label: `✅ Call it (pay ${info.gauge} gauge)` }, { label: "No" }] });
                yes = i === 0;
              }
              if (!yes) continue;
              for (let g = 0; g < info.gauge; g++) f.drop.push(f.gauge.pop());
              const before = f.hand.length;
              B.abxFreeCall = true;
              try { B.completeMonsterCall(side, pos, hi, false, true); } finally { B.abxFreeCall = false; }
              if (f.hand.length === before) { for (let g = 0; g < info.gauge; g++) f.gauge.push(f.drop.pop()); }   // the call did not happen: refund
              fresh();
              return;
            }
          });
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return p;
    };
  }

  /* ==================== 6. [Purge] (9 cards): [Counter] put a «Weaponry» from this card's soul into the gauge. Once per turn. ==================== */
  const isWeaponry = (id) => { const c = cardOf(getCid(id)); return !!(c && (c.attrs || []).some(a => lc(a).replace(/\s+/g, "") === "weaponry")); };
  (ABX.extraCond = ABX.extraCond || {}).xSoulHasWeaponry = (c, ctx) => !!(ctx && ctx.unit && Array.isArray(ctx.unit.soul) && ctx.unit.soul.some(isWeaponry));
  if (ABX.COND_OK) ABX.COND_OK.add("xSoulHasWeaponry");
  // "destroy ... and a spell on your opponent's field": a spell on the field is a [Set] spell; destroy ONE of them (not all like destroySet)
  OPS.r41DestroyOneSet = {
    async run(s, ctx) {
      const es = otherSide(ctx.side), e = F(es), sets = e.setSpells || [];
      if (!sets.length) return false;
      let idx = 0;
      if (sets.length > 1 && !isAuto(ctx)) {
        const cands = sets.map((c, i) => ({ k: "zone", side: es, area: "set", idx: i, id: c.id, card: c }));
        const ch = await core.pick(cands, { qty: { n: 1 }, raw: "a spell on your opponent's field" }, ctx, { intent: "harm", title: `${ctx.card.name} - destroy a spell` });
        if (ch && ch[0] && typeof ch[0].idx === "number") idx = ch[0].idx;
      }
      const c = e.setSpells.splice(idx, 1)[0];
      if (c) e.drop.push(c.id);
      fresh();
      return !!c;
    },
    check: () => true
  };
  OPS.r41Purge = {
    async run(s, ctx) {
      const f = ctx.f, u = ctx.unit;
      if (!u || !Array.isArray(u.soul)) return false;
      const idxs = u.soul.map((x, i) => (isWeaponry(x) ? i : -1)).filter(i => i >= 0);
      if (!idxs.length) return false;
      const pick = idxs[0];
      f.gauge.push(getCid(u.soul.splice(pick, 1)[0]));
      fresh();
      return true;
    },
    check: (s, ctx) => !ctx || !!(ctx.unit && Array.isArray(ctx.unit.soul) && ctx.unit.soul.some(isWeaponry))
  };

  const pcPrev41 = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev41.apply(this, arguments);
    try {
      if (!card || !r || !Array.isArray(r.abilities)) return r;
      if (/\[purge\]/i.test(card.skill || "") && !r.abilities.some(a => a.purge41)) {
        r.abilities.push({ kind: "act", name: "Purge", tags: ["counter", "act"], counter: true, once: "turn", conds: [{ t: "xSoulHasWeaponry" }], steps: [C("r41Purge")], unparsed: [], optional: false, raw: "[Purge] [Counter] Put a «Weaponry» from this card's soul into the gauge. Once per turn.", cleaned: "[Counter] Put a «Weaponry» from this card's soul into the gauge. Once per turn.", idx: r.abilities.length, cardId: card.id, purge41: true });
      }
      r.abilities.forEach(ab => {
        const raw = String(ab.cleaned || ab.raw || "").replace(/^\s*(?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?/, "");
        const full = String(ab.raw || "");
        for (const [id, re, build] of OV41) {
          if (card.id !== id || !(re.test(raw) || re.test(full))) continue;
          const o = build(ab);
          if (!o) continue;
          ab.kind = o.kind;
          ab.steps = o.steps;
          ab.unparsed = [];
          ab.r31 = true;
          ab.r40 = true;
          ab.r41 = true;
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
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
