/* ==================== ABX — round 27: Dragon World, attacks ====================
 * Built to ability_definitions_dragon_world.md (groups D, H, I, J):
 *  - "the chosen card must attack this card (alone) first for this attack phase if able" (#5798, #4456, #4457, #4936):
 *    the chosen opponent's monster, when it attacks this turn, attacks this card alone while this card is on the field
 *  - change the target: "to you" (#1486), "to this monster" (#3951), "move an «X» to the center and change the target
 *    to that monster" (#483)
 *  - static "during the battle this card attacks alone, your opponent cannot use [Counter]" (#6465, #3115)
 *  - "for this turn, if that is the only card attacking, that card's attack cannot be nullified" (#1950)
 * Loaded after abilities_r26.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };

  /* ---- rewrites ---- */
  const RW = [
    [/\bthis card cannot attack the left or right, and during the battle that this card is attacking alone, your opponent cannot use \[counter\]/gi,
      "This card cannot attack the left or right. During the battle that this card is attacking alone, your opponent cannot use [Counter]"],
    [/\bfor this turn, nullify (?:all |the )?abilities of the chosen cards?, and (?:that card|they) must attack this card( alone)? first for this attack phase if able\b/gi,
      "for this turn, nullify all abilities of the chosen card. For this turn, the chosen card must attack this card$1 first for this attack phase if able"],
    // the [Stand] right after an [Overturn] cost was taken as another tag
    [/(\[overturn\] \[[^\]]+\]) \[stand\]/gi, "$1 Then, [Stand]"],
    [/\bif you put a "[^"]+" into your hand, you take\b/gi, "if you put it, you take"],   // the count condition reads "you put it"
  ];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };

  /* ---- rules ---- */
  const A = [];
  const ar = (re, fn) => A.push([re, fn, false]);
  ar(/^(?:for this turn, )?the chosen cards? must attack this card( alone)? first for this attack phase if able$/i, (m) => ({ op: "mustAttack", alone: !!m[1] }));
  ar(/^change the target of the attack to you$/i, () => ({ op: "redirectAttack", toFighter: true }));
  ar(/^change the target of the attacks? to this (?:monster|card)$/i, () => ({ op: "redirectAttack", toSelf: true }));
  ar(/^move (?:a|an) (.+?) on your field to the center, and change the target of the attack to that monster$/i, (m) => {
    const np = NP("a " + m[1] + " on your field");
    return np ? { op: "seq", steps: [{ op: "choose", np }, { op: "placeAt", pos: "center" }, { op: "redirectAttack", toChosen: true }] } : null;
  });
  ar(/^during the battle (?:that )?this card (?:attacks|is attacking) alone, your opponent cannot use \[counter\]$/i, () => ({ op: "static", kind: "noCounterAlone" }));
  // shortcut: "an open monster area" takes the first open one (center, left, right); add an area choice if it matters
  ar(/^move this card to an open monster area on your field$/i, () => ({ op: "moveSelfTo", pos: null }));
  ar(/^(?:you may )?move this monster to your (center|left|right)$/i, (m) => ({ op: "moveSelfTo", pos: m[1].toLowerCase(), optional: /you may/i.test(m[0]) }));
  ar(/^(?:you may )?put it into the gauge instead of the drop zone$/i, (m) => ({ op: "selfDropToGauge", optional: /you may/i.test(m[0]) }));
  ar(/^if all of them have different card names, put all of those cards (?:in)?to your hand$/i, () => ({ op: "distinctToHand" }));
  ar(/^nullify the \[?lifelink\]? of this card on (?:the|your) field$/i, () => ({ op: "static", kind: "noLifelink" }));
  // whole sentence: otherwise "if that is the only card attacking," is taken as a condition first
  A.push([/^(?:for this turn, )?if that is the only card attacking, that card's attack cannot be nullified$/i, () => ({ op: "unnullChosen", alone: true, duration: "turn" }), true]);
  ABX.ACTION_RULES.unshift(...A);

  /* ---- must attack this card first ---- */
  OPS.mustAttack = {
    run(s, ctx) {
      const us = (ctx.bind.chosen || []).filter(r => r.unit && r.side !== ctx.side);
      us.forEach(r => { r.unit.abxMustAttack = { turn: B.turnCount, target: ctx.unit, side: ctx.side, alone: !!s.alone }; });
      return us.length > 0 && !!ctx.unit;
    },
    check: () => true
  };
  if (typeof B.initiateAttackWithDefenseCheck === "function") {
    const iad = B.initiateAttackWithDefenseCheck;
    B.initiateAttackWithDefenseCheck = function (attSide, attackerZones, targetPos) {
      try {
        const f = this.getFighter(attSide), d = this.getFighter(otherSide(attSide));
        for (const z of attackerZones || []) {
          const u = z === "item" ? f.item : f.monsters[z], m = u && u.abxMustAttack;
          if (!m || m.turn !== this.turnCount) continue;
          const tpos = ["left", "center", "right"].find(p => d.monsters[p] === m.target);
          if (!tpos) { u.abxMustAttack = null; continue; }   // the card it must attack is gone: no longer able
          if (tpos !== targetPos || (m.alone && attackerZones.length > 1)) {
            if (!f.isBot) this.setPrompt(`🎯 "${u.card.name}" must attack "${m.target.card.name}"${m.alone ? " alone" : ""} first this attack phase.`);
            attackerZones = m.alone ? [z] : attackerZones; targetPos = tpos;
          }
          u.abxMustAttack = null;   // its first attack this phase is made
          break;
        }
      } catch (e) { if (ABX.debug) console.error(e); }
      return iad.call(this, attSide, attackerZones, targetPos);
    };
  }

  /* ---- change the target to you / to this card ---- */
  const rdRun = OPS.redirectAttack.run;
  OPS.redirectAttack.run = function (s, ctx) {
    if (!s.toFighter && !s.toSelf) return rdRun.apply(this, arguments);
    const bc = ABX.battleCtx;
    if (!bc || !bc.active) return false;
    const pos = s.toFighter ? "fighter" : core.posOfUnit(ctx.f, ctx.unit);
    if (!pos || pos === "item") return false;
    bc.redirectTo = pos;
    try { B.setPrompt(`🎯 The attack's target was changed to ${pos === "fighter" ? "the fighter" : `"${ctx.card.name}"`}!`); } catch (e) { /* ignore */ }
    return true;
  };

  /* ---- static "your opponent cannot use [Counter] during the battle this card attacks alone" ---- */
  const sChk = OPS.static.check;
  OPS.static.check = function (s) { return (s && s.kind === "noCounterAlone") || sChk.apply(this, arguments); };
  const ncPrev = ABX.noCounterThisBattle;
  ABX.noCounterThisBattle = function (attSide, units) {
    if (ncPrev && ncPrev.apply(this, arguments)) return true;
    const us = (units || []).map(x => (x && x.unit) || x).filter(Boolean);
    return us.length === 1 && us[0].abxNullified !== B.turnCount &&
      core.abilitiesOf(us[0].card, a => a.kind === "static" && (a.steps || []).some(st => st.kind === "noCounterAlone")).length > 0;
  };
  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && (ab.steps || []).some(s => s.kind === "noCounterAlone") && !(ab.unparsed && ab.unparsed.length) &&
      ab.steps.every(s => OPS[s.op] && (!OPS[s.op].check || OPS[s.op].check(s)))) return true;
    return isExecPrev.apply(this, arguments);
  };

  /* ---- [Move]-like moves of this card, gauge instead of drop zone, all-different-names ---- */
  OPS.moveSelfTo = {
    run(s, ctx) {
      const f = ctx.f, u = ctx.unit, from = u && core.posOfUnit(f, u);
      if (!from || from === "item") return false;
      const to = s.pos || ["center", "left", "right"].find(p => p !== from && !f.monsters[p]);
      if (!to || to === from || f.monsters[to]) return false;
      f.monsters[from] = null; f.monsters[to] = u;
      u.abxMovedTurn = B.turnCount;
      if (ABX.fireEv) ABX.fireEv("move", { side: ctx.side, unit: u, from, to });
      try { B.renderBattle(); } catch (e) { /* ignore */ }
      return true;
    },
    check: () => true
  };
  OPS.selfDropToGauge = {
    run(s, ctx) { const f = ctx.f, i = ctx.card ? f.drop.lastIndexOf(ctx.card.id) : -1; if (i < 0) return false; f.gauge.push(f.drop.splice(i, 1)[0]); return true; },
    check: () => true
  };
  OPS.distinctToHand = {
    run(s, ctx) {
      const f = ctx.f, refs = (ctx.bind.chosen || []).filter(r => r && r.card);
      if (!refs.length || new Set(refs.map(r => r.card.name)).size !== refs.length) return false;
      refs.forEach(r => { const i = f.drop.lastIndexOf(r.id); if (i >= 0) f.hand.push(f.drop.splice(i, 1)[0]); });
      return true;
    },
    check: () => true
  };

  /* ---- "nullify the [Lifelink] of this card": checked when the card is destroyed (game.js) ---- */
  ABX.lifelinkOff = function (side, card) {
    const f = F(side);
    return core.abilitiesOf(card, a => a.kind === "static" && (a.steps || []).some(st => st.kind === "noLifelink")).some(ab =>
      (ab.conds || []).every(c => core.evalCond(c, { side, f, e: F(otherSide(side)), card, unit: null, bind: { chosen: [] } })));
  };

  /* ---- statics that combine kinds other rounds already enforce ---- */
  const OK_STATIC = new Set(["noCounterAlone", "noLifelink", "noAttackPos", "oppNoEffCall"]);
  OPS.static.check = (function (prev) { return function (s) { return (s && OK_STATIC.has(s.kind)) || prev.apply(this, arguments); }; })(OPS.static.check);
  const ie2 = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && (ab.steps || []).length && !(ab.unparsed && ab.unparsed.length) && (ab.conds || []).every(ABX.condExecutable) &&
      ab.steps.some(s => OK_STATIC.has(s.kind) || s.op === "oppNoEffCall") &&
      ab.steps.every(s => s.op === "oppNoEffCall" || (s.op === "static" && OPS.static.check(s)))) return true;
    return ie2.apply(this, arguments);
  };
  // a static "your opponent cannot call monsters by card effects" is the r13 static kind, not the one-turn op
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try { (r && r.abilities || []).forEach(ab => { if (ab.kind === "static") (ab.steps || []).forEach((s, i) => { if (s.op === "oppNoEffCall") ab.steps[i] = { op: "static", kind: "oppNoEffCall" }; }); }); } catch (e) { /* ignore */ }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
