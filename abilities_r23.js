/* ==================== ABX — round 23: defined-first abilities (see ability_definitions.md) ====================
 * Each card here is built to the plain-words definition written for it first in ability_definitions.md, with one test
 * per definition (tests/vanity_end.js, ...).
 *  #5116 Vile Demonic Husk Deity Dragon, Vanity End Destroyer
 *   2. [Call Cost] "If you have one or more hand cards, put all of them face down into its soul" (paid through
 *      ABX.payExtras: every hand card goes into the new monster's soul; an empty hand is fine).
 *   3. "put your entire deck face down into its soul" -> OPS.deckToSoul (was read as moving 1 card).
 *   4. "You cannot lose the fight, <protection>" -> static "cannotLose" (life 0 / empty deck do not end the fight while
 *      the card is on the field; checked in B.checkWinCondition) + the Round 20 protect step for the rest.
 *   5. "put a soul from this card into your hand" -> OPS.soulToHand, you choose (was read as dropping the soul).
 * Loaded after abilities_r22.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf } = core;
  const stripEnd = (t) => String(t || "").trim().replace(/[.!]+$/, "").trim();
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const toN = (w) => { const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10); return isNaN(n) ? 1 : n; };

  /* ---- 2. [Call Cost] "If you have one or more hand cards, put all of them face down into its soul" ---- */
  const HAND_SOUL_COST = /\[call cost\][^\n]*if you have (?:one or more|any) hand cards?, put all of them (?:face down )?into (?:its|this card's) soul/i;
  const handSoulCost = (card) => !!card && HAND_SOUL_COST.test(card.skill || "");
  const heP = ABX.hasExtras, cpeP = ABX.canPayExtras, peP = ABX.payExtras;
  ABX.hasExtras = function (card) { return handSoulCost(card) || heP.apply(this, arguments); };
  ABX.canPayExtras = function (side, card) { return handSoulCost(card) || cpeP.apply(this, arguments); };   // an empty hand is fine
  ABX.payExtras = async function (side, card, unit) {
    if (!handSoulCost(card)) return peP.apply(this, arguments);
    const f = F(side);
    if (unit && f.hand.length) unit.soul.push(...f.hand.splice(0));
    fresh();
  };

  /* ---- 3 + 5: actions ---- */
  ABX.ACTION_RULES.unshift(
    [/^put your entire deck(?: face down)? into (?:its|this card's) soul$/i, () => ({ op: "deckToSoul" }), false],
    [/^put (a|an|one|two|three|\d+) souls? from this card into your hand$/i, (m) => ({ op: "soulToHand", n: toN(m[1]) }), false]
  );
  OPS.deckToSoul = {
    run(s, ctx) {
      const u = ctx.unit, f = ctx.f;
      if (!u || !f.deck.length) return false;
      u.soul.push(...f.deck.splice(0));
      fresh(); return true;
    },
    check: () => true
  };
  OPS.soulToHand = {
    async run(s, ctx) {
      const u = ctx.unit, f = ctx.f;
      if (!u || !(u.soul || []).length) return false;
      const cands = u.soul.map((id, idx) => ({ k: "soul", side: ctx.side, host: u, idx, id, card: cardOf(id) })).filter(r => r.card);
      const n = Math.min(s.n || 1, cands.length);
      const ch = await core.pick(cands, { qty: { n }, raw: "a soul of this card" }, ctx, { intent: "help", title: `${ctx.card.name} — put a soul into your hand`, min: n, max: n });
      let moved = 0;
      (ch || []).forEach(r => { const i = u.soul.indexOf(r.id); if (i >= 0) { f.hand.push(u.soul.splice(i, 1)[0]); moved++; } });
      fresh(); return moved > 0;
    },
    check: () => true
  };

  /* ---- 4. "You cannot lose the fight, <protection>" ---- */
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        if (ab.kind !== "static") return;
        const text = stripEnd(ABX.norm(ab.cleaned || ab.raw || ""));
        const m = text.match(/^you cannot lose the fight(?:,\s*(.+))?$/i);
        if (!m) return;
        const steps = [{ op: "static", kind: "cannotLose", r23: true }];
        if (m[1]) { const pr = ABX.decomposeProtect && ABX.decomposeProtect(m[1]); if (!pr) return; steps.push(pr); }
        ab.steps = steps; ab.unparsed = []; ab.conds = ab.conds || [];
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && (ab.steps || []).some(s => s.r23 && s.kind === "cannotLose") && !(ab.unparsed && ab.unparsed.length) &&
        (ab.conds || []).every(ABX.condExecutable) && ab.steps.every(s => (s.r23 && s.kind === "cannotLose") || (OPS[s.op] && OPS[s.op].check && OPS[s.op].check(s)))) return true;
    return isExecPrev.apply(this, arguments);
  };
  // Is a "You cannot lose the fight" card on this fighter's field right now?
  ABX.cannotLose = function (side) {
    const f = F(side);
    return core.fieldUnits(f, true).some(x => {
      const u = x.unit;
      if (!u || !u.card || u.abxNullified === B.turnCount) return false;
      return core.abilitiesOf(u.card, a => a.kind === "static" && (a.steps || []).some(s => s.r23 && s.kind === "cannotLose")).some(ab =>
        (ab.conds || []).every(c => core.evalCond(c, { side, f, e: F(otherSide(side)), card: u.card, unit: u, bind: { chosen: [] } })));
    });
  };
  if (typeof B.checkWinCondition === "function") {
    const cwc = B.checkWinCondition;
    B.checkWinCondition = function () {
      // while protected: life 0 and an empty deck are hidden from the loss checks, then put back
      const saved = [];
      try {
        [["plr", B.plr], ["opp", B.opp]].forEach(([side, f]) => {
          if (!f || !ABX.cannotLose(side)) return;
          saved.push([f, f.life, f.deck]);
          if (f.life <= 0) f.life = 1;
          if (!f.deck.length) f.deck = [-1];
        });
      } catch (e) { if (ABX.debug) console.error(e); }
      try { return cwc.apply(this, arguments); }
      finally { saved.forEach(([f, life, deck]) => { f.life = life; f.deck = deck; }); }
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
