/* ==================== ABX — round 26: Dragon World, next batch ====================
 * Built to ability_definitions_dragon_world.md. Rewrites into wordings the parser reads, plus:
 *  - "Destroy / Return all cards on your opponent's field … five times" -> the step repeated 5 times
 *  - "N or more different world names of «X» in your drop zone" (condition, counts only «X» cards)
 *  - "At the end of your next turn, you lose the game." (#3812)
 *  - Round 20 protections also on [Set] spells, and with a "During your turn," lead
 * Loaded after abilities_r25.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, matchFilter } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const toN = (w) => { const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10); return isNaN(n) ? 1 : n; };
  const stripEnd = (t) => String(t || "").trim().replace(/[.!]+$/, "").trim();

  /* ---- 1. rewrites ---- */
  const RW = [
    [/\b(?:this ability )?(?:only )?activates once per (?:main|attack) phase and once per final phase\.?/gi, "This ability only activates once per phase."],
    [/\byou may discard two soul from this card's soul\b/gi, "You may drop two souls from this card"],
    [/\bif you are not equipped with an item, you may equip an item from your drop zone with ("[^"]+") in its card name by paying its \[equip cost\]/gi, "if you have no item equipped, you may equip an item with $1 in its card name from your drop zone by paying its [Equip Cost]"],
    [/\[stand\] the chosen card and this card\b/gi, "[Stand] the chosen card, and [Stand] this card"],
    [/\bif this is the attack phase\b/gi, "if during the attack phase"],
    [/\bwhen this card enters the field and if there are no other monsters on your field\b/gi, "When this card enters the field, if you have no other monsters on your field"],
    [/\bif you do not have other monsters on your field\b/gi, "if you have no other monsters on your field"],
    [/\bwhen this card is destroyed by card effects during the attack phase\b/gi, "During the attack phase, when this card is destroyed by card effects"],
    [/\bwhen you use a ("[^"]+")/gi, "When you cast a $1"],
    [/\bplay rock-paper-scissors with your opponent(?: once| only once)?\b/gi, 'play "Rock-Paper-Scissors" with your opponent'],
    [/\bif it's a draw\b/gi, "if it is a draw"],
    [/\bnullify that link attack\b/gi, "nullify the attack"],
    // shortcut: "put the rest on the top or bottom of your deck in any order" -> always the bottom; add a top/bottom choice if it matters
    [/\bput up to one from among them into your hand, and put the rest on the top or bottom of your deck in any order\b/gi, "put up to one card from among them into your hand, and put the rest on the bottom of your deck in any order"],
  ];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };
  // "destroyed by card effects" (plural) as well as "by an effect of a card"
  ABX.TRIGGER_RULES.unshift([/^(?:when|whenever) this card is destroyed by card effects$/i, () => ({ event: "leave", self: true, byEffect: true })]);

  /* ---- 2. "… five times" ---- */
  ABX.ACTION_RULES.unshift(
    [/^(destroy all cards on your opponent's field|return all cards (?:on|from) your opponent's field to hand) (\w+) times$/i, (m) => {
      const one = ABX.parseSentenceSteps(m[1].replace(/ from your opponent's field/i, " on your opponent's field"), { conds: [] });
      if (!one || one.steps.length !== 1 || (one.unparsed && one.unparsed.length)) return null;
      return { op: "seq", steps: Array.from({ length: toN(m[2]) }, () => Object.assign({}, one.steps[0])) };
    }, false],
    [/^at the end of your next turn, you lose the game$/i, () => ({ op: "loseLater" }), false]
  );

  /* ---- 2b. "The cards called / These cards become size 0 until they leave the field" (calls of several cards) ---- */
  ABX.ACTION_RULES.unshift([/^(?:the cards called|these cards|those cards) becomes? size 0 until they leave the field$/i, () => ({ op: "setSize0", allCalled: true, np: { raw: "the cards called", qty: { n: 99, all: true }, filter: {} } }), false]);
  if (OPS.call && OPS.call.run) {
    const callRun = OPS.call.run;
    OPS.call.run = async function (s, ctx) {
      const before = new Set(core.fieldUnits(ctx.f, true).map(x => x.unit));
      const r = await callRun.apply(this, arguments);
      try { core.fieldUnits(ctx.f, true).forEach(x => { if (!before.has(x.unit)) (ctx.calledUnits = ctx.calledUnits || []).push(x.unit); }); } catch (e) { /* ignore */ }
      return r;
    };
  }
  const s0Run = OPS.setSize0.run;
  OPS.setSize0.run = function (s, ctx) {
    if (!s.allCalled) return s0Run.apply(this, arguments);
    const us = (ctx.calledUnits || []).filter(u => core.posOfUnit(ctx.f, u));
    us.forEach(u => { u.abxSize0 = true; });
    try { B.renderBattle(); } catch (e) { /* ignore */ }
    return us.length > 0;
  };

  /* ---- 3. "you lose at the end of your next turn" ---- */
  OPS.loseLater = { run(s, ctx) { ctx.f.abxLoseAfter = B.turnCount + 2; return true; }, check: () => true };   // your next turn = two turns from now
  const fte = ABX.fireTurnEvent;
  ABX.fireTurnEvent = function (kind) {
    try {
      if (kind === "turnEnd" && !B.matchOver) {
        const side = B.activeSide, f = F(side);
        if (f && f.abxLoseAfter && B.turnCount >= f.abxLoseAfter) { f.abxLoseAfter = null; B.finishMatch(side === "opp"); }
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    return fte.apply(this, arguments);
  };

  /* ---- 4. "N or more different world names of «X» in your drop zone" ---- */
  const XC = ABX.extraCond = ABX.extraCond || {};
  XC.xWorldNamesOf = (c, ctx) => {
    const w = new Set();
    (ctx.f.drop || []).forEach(id => { const cd = cardOf(id); if (cd && matchFilter(cd, c.np.filter || {}, null, ctx)) String(cd.world || "").split(" / ").filter(Boolean).forEach(x => w.add(x)); });
    return w.size >= c.n;
  };
  ABX.COND_OK.add("xWorldNamesOf");
  ABX.COND_RULES.unshift([/^you have (\w+) or more different world names of («[^»]+»|"[^"]+") in your drop zone$/i, (m) => { const np = NP(m[2]); return np ? { t: "xWorldNamesOf", n: toN(m[1]), np } : null; }]);

  /* ---- 5. Round 20 protections: [Set] spells, and "During your turn, …" ---- */
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        if (!(ab.unparsed && ab.unparsed.length) || !ABX.decomposeProtect) return;
        if (!(ab.kind === "static" || (ab.kind === "spell" && card && card.set))) return;
        let text = stripEnd(ABX.norm(ab.cleaned || ab.raw || "")).replace(/^"[^"]+"\s*/, "");
        if (/[.!]\s+\S/.test(text)) return;
        const conds = [];
        const lead = text.match(/^(during (?:your|your opponent's) turn),\s*(.+)$/i);
        if (lead) { const c = ABX.parseCondition(lead[1]); if (!c) return; conds.push(c); text = lead[2]; }
        const st = ABX.decomposeProtect(text);
        if (!st) return;
        ab.kind = "static"; ab.steps = [st]; ab.conds = (ab.conds || []).concat(conds); ab.unparsed = [];
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
