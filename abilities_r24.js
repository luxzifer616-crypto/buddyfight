/* ==================== ABX — round 24: Dragon World, new trigger events ====================
 * Built to ability_definitions_dragon_world.md (groups A, B, C, E, F). One event channel, ABX.fireEv(name, info), and
 * trigger rules that map the card wordings onto it ({ event: "r24", ev, ... }):
 *  move   — a monster changes area by [Move] (game.js fires it).                     group A
 *  leave  — a card leaves a field: destroyed / returned to hand / deck.              groups B, C
 *  rest / stand — a card is [Rest] / [Stand] by an effect.                           group E
 *  damage — a fighter is dealt damage (byAttack or not).                             group F
 * Loaded after abilities_r23.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, matchFilter, fieldUnits } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const lc = (s) => String(s || "").toLowerCase();

  /* ---- event matchers: (trigger, info, src, sideOfSource) -> bool ---- */
  const npOK = (t, card, unit, side) => !t.np || matchFilter(card, t.np.filter || {}, { unit, side }, { f: F(side) });
  const EV = {
    move: (t, i, src, side) => (t.self ? i.unit === src.unit : side === i.side && npOK(t, i.unit.card, i.unit, i.side)) &&
      (!t.to || i.to === t.to) && (!t.oppTurn || B.activeSide !== side),
    leave: (t, i, src, side) => {
      if (t.own ? side !== i.side : side === i.side) return false;
      if (t.kinds && !t.kinds.includes(i.kind)) return false;
      if (t.pos && i.pos !== t.pos) return false;
      if (t.other && i.unit === src.unit) return false;
      if (!npOK(t, i.card, null, i.side)) return false;
      // with no effect running (effSide unknown), a non-attack destroy counts as yours, like Round 13's xLeave
      if (t.byYou && !(i.byAttack ? i.attSide === side : (i.effSide == null || i.effSide === side))) return false;
      if (t.byEffect && (i.byAttack || (i.effSide != null && i.effSide !== side))) return false;
      if (t.byThisAttack && !(i.byAttack && (i.attUnits || []).includes(src.unit))) return false;
      if (t.attackerNP && !(i.byAttack && (i.attUnits || []).some(u => matchFilter(u.card, t.attackerNP.filter || {}, { unit: u, side }, { f: F(side) })))) return false;
      return true;
    },
    rest: (t, i, src, side) => side === i.side && npOK(t, i.unit.card, i.unit, i.side) && (!t.byEffect || i.byEffect) && (!t.phase || B.phase === t.phase && B.activeSide === side),
    stand: (t, i, src, side) => side === i.side && npOK(t, i.unit.card, i.unit, i.side) && (!t.byEffect || i.byEffect) && (!t.byMine || i.effSide === side) && (!t.self || i.unit === src.unit) && (!t.other || i.unit !== src.unit),
    damage: (t, i, src, side) => side === i.side && (!t.notAttack || !i.byAttack),
    attack: (t, i, src, side) => side === i.attSide && (!t.alone || i.units.length === 1) && (!t.link || i.units.length > 1) &&
      ((t.selfOrNP && i.units.includes(src.unit)) || i.units.some(u => npOK(t, u.card, u, side)))
  };
  ABX.fireEv = function (name, info) {
    if (!EV[name]) return;
    return ABX.queue(() => core.fireTriggers((t, src, side) =>
      (t.event === "r24" && t.ev === name && EV[name](t, info, src, side)) ||
      (name === "move" && t.event === "enter" && t.alsoMove && info.unit === src.unit), Object.assign({ name: "r24:" + name }, info)));
  };
  ABX.TRIG_OK.r24 = (t) => !!EV[t.ev];

  /* ---- trigger wordings ---- */
  const T = [];
  const tr = (re, fn) => T.push([re, fn]);
  const KINDS = (s) => (lc(s).match(/hand|deck/g) || []);
  // A. [Move]
  tr(/^(?:when|whenever) this card \[move\](?:s)?(?: to (?:the|your) (center|left|right))?$/i, (m) => ({ event: "r24", ev: "move", self: true, to: m[1] ? lc(m[1]) : null }));
  tr(/^(?:when|whenever) (?:a|your) monster(?: on your field)?(?: with ("[^"]+") in its card name)?(?: on your field)? \[move\]$/i, (m) => ({ event: "r24", ev: "move", np: m[1] ? NP("a monster with " + m[1] + " in its card name") : null }));
  tr(/^if your monster with ("[^"]+") in its card name \[move\] during your opponent's turn$/i, (m) => ({ event: "r24", ev: "move", np: NP("a monster with " + m[1] + " in its card name"), oppTurn: true }));
  tr(/^(?:when|whenever) this card enters the field or \[move\]$/i, () => ({ event: "enter", self: true, alsoMove: true }));
  // B. returned to hand / deck (your field)
  tr(/^(?:when|whenever) (?:a |your )?(another card|monsters?|cards?|«[^»]+»(?: monsters?)?)(?: on your field)? (?:is|are) returned to (?:your )?(hand or deck|deck or hand|hand|deck)$/i,
    (m) => ({ event: "r24", ev: "leave", own: true, kinds: KINDS(m[2]), other: /another/i.test(m[1]), np: /^(another card|cards?)$/i.test(m[1]) ? null : NP(m[1].replace(/s$/, "")) }));
  tr(/^(?:when|whenever) your («[^»]+») on your field is returned to your hand$/i, (m) => ({ event: "r24", ev: "leave", own: true, kinds: ["hand"], np: NP(m[1]) }));
  // C. opponent's monster destroyed
  tr(/^(?:when|whenever) your opponent's center monster is destroyed$/i, () => ({ event: "r24", ev: "leave", kinds: ["destroyed"], pos: "center" }));
  // ("a monster on your opponent's field is destroyed by your card effects" alone is Round 13's xLeave)
  tr(/^(?:when|whenever) (?:a monster on your opponent's field is destroyed by your attacks or card effects|your opponent's monsters are destroyed by your card effects)$/i,
    (m) => ({ event: "r24", ev: "leave", kinds: ["destroyed"], np: NP("a monster"), byYou: /attacks/i.test(m[0]), byEffect: !/attacks/i.test(m[0]) }));
  tr(/^(?:when|whenever) an opponent's monster is destroyed (?:with|by) this card's attack$/i, () => ({ event: "r24", ev: "leave", kinds: ["destroyed"], byThisAttack: true }));
  tr(/^(?:when|whenever) an attack by (?:a |an )?(.+?) on your field destroys your opponent's monster$/i, (m) => ({ event: "r24", ev: "leave", kinds: ["destroyed"], attackerNP: NP(m[1]) }));
  // E. [Rest] / [Stand]
  tr(/^(?:when|whenever) (?:a |an )?(«[^»]+»)(?: on your field)? \[rest\](?: during your (main) phase)?$/i, (m) => ({ event: "r24", ev: "rest", np: NP(m[1]), phase: m[2] ? "main" : null }));
  tr(/^(?:when|whenever) (?:a |an )?(«[^»]+»)(?: monster)? on your field (?:is )?\[rest\] by (?:an |a )?(?:card )?effects?(?: of (?:a )?cards?)?$/i, (m) => ({ event: "r24", ev: "rest", np: NP(m[1]), byEffect: true }));
  tr(/^(?:when|whenever) (?:a |an )?(card|«[^»]+»)(?: monster)? on your field (?:is )?\[?stand\]? by (the effects of your cards|card effects)$/i,
    (m) => ({ event: "r24", ev: "stand", np: /^card$/i.test(m[1]) ? null : NP(m[1]), byEffect: true, byMine: /your cards/i.test(m[2]) }));
  // F. damage other than by attacks
  tr(/^(?:when|whenever|if) you (?:are dealt|take) damage other than by (?:an )?attacks?$/i, () => ({ event: "r24", ev: "damage", notAttack: true }));
  // D. attacks by other cards: alone / link / "this card or a «Weapon»"
  tr(/^(?:when|whenever) (?:a |an )?(monster|«[^»]+»(?: monster)?) on your field (?:attacks|is attacking) alone$/i, (m) => ({ event: "r24", ev: "attack", alone: true, np: NP(m[1]) }));
  tr(/^(?:when|whenever) (?:a |an )?(«[^»]+»)(?: monster)? on your field link attacks$/i, (m) => ({ event: "r24", ev: "attack", link: true, np: NP(m[1]) }));
  tr(/^(?:when|whenever) this card or (?:a |an )?(«[^»]+»|item|monster) on your field attacks$/i, (m) => ({ event: "r24", ev: "attack", selfOrNP: true, np: NP(m[1]) }));
  tr(/^(?:when|whenever) this card attack$/i, () => ({ event: "attack", self: true }));   // "attack" typo on #5104
  // existing events, new wordings
  tr(/^(?:when|whenever) this card deals damage$/i, () => ({ event: "dealsDamage", self: true }));
  tr(/^(?:when|whenever) this card is destroyed by (?:an |the )?effects? of (?:a )?cards?$/i, () => ({ event: "leave", self: true, byEffect: true }));
  // shortcut: "enters your field from your hand" fires on any enter (almost every call is from the hand); track the zone if it matters
  tr(/^(?:when|whenever) (?:a |an )?(.+?) enters your field from your hand$/i, (m) => ({ event: "otherEnter", np: NP(m[1] + " on your field") }));
  ABX.TRIGGER_RULES.unshift(...T);
  if (ABX.fireAttack) {
    const faPrev = ABX.fireAttack;
    ABX.fireAttack = function (attSide, units, defSide, targetPos) {
      const r = faPrev.apply(this, arguments);
      try { ABX.fireEv("attack", { attSide, defSide, targetPos, units: (units || []).map(u => u.unit).filter(Boolean) }); } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }

  /* ---- firing points ---- */
  // leave: destroyed (game.destroyMonster) ...
  if (typeof B.destroyMonster === "function") {
    const dm = B.destroyMonster;
    B.destroyMonster = function (side, pos) {
      const f = this.getFighter(side), m = f && f.monsters[pos];
      const bc = ABX.curBattle;
      const info = m && { side, card: m.card, unit: m, pos, kind: "destroyed", byAttack: !!this._destroyByAttack,
        attSide: bc && bc.attSide, attUnits: bc && bc.attUnits ? bc.attUnits.slice() : [], effSide: ABX.curEffectSide };
      const r = dm.apply(this, arguments);
      try { if (info && f.monsters[pos] !== m && r !== false) ABX.fireEv("leave", info); } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }
  // ... returned to hand / deck by an ABX effect (fields compared before / after)
  ["move", "moveZone", "deckToBottom"].forEach(op => {
    if (!OPS[op] || !OPS[op].run) return;
    const orun = OPS[op].run;
    OPS[op].run = async function (s, ctx) {
      const snap = ["plr", "opp"].map(side => ({ side, units: fieldUnits(F(side), true).map(x => ({ u: x.unit, pos: x.pos, nDrop: F(side).drop.filter(d => d === x.unit.card.id).length })) }));
      const r = await orun.apply(this, arguments);
      try {
        snap.forEach(({ side, units }) => {
          const f = F(side), now = new Set(fieldUnits(f, true).map(x => x.unit));
          units.forEach(({ u, pos, nDrop }) => {
            if (!u || !u.card || now.has(u)) return;
            const kind = f.hand.includes(u.card.id) ? "hand" : f.deck.includes(u.card.id) ? "deck" : null;
            // put from the field into the drop zone by an effect / cost ("When this card is put from the field into the drop zone")
            if (!kind && f.drop.filter(d => d === u.card.id).length > nDrop && ABX.fireLeave && u.card.type === "Monster") { ABX.fireLeave(side, u.card, false, true); return; }
            if (kind) ABX.fireEv("leave", { side, card: u.card, unit: u, pos, kind, byAttack: false, effSide: ctx && ctx.side });
          });
        });
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  });
  // rest / stand by effects
  ["rest", "stand"].forEach(op => {
    if (!OPS[op] || !OPS[op].run) return;
    const orun = OPS[op].run;
    OPS[op].run = async function (s, ctx) {
      const before = new Map();
      ["plr", "opp"].forEach(sd => fieldUnits(F(sd), true).forEach(x => before.set(x.unit, { rested: !!x.unit.rested, side: sd })));
      const r = await orun.apply(this, arguments);
      try {
        for (const [u, b] of before) if (b.rested !== !!u.rested && !!u.rested === (op === "rest")) ABX.fireEv(op, { side: b.side, unit: u, byEffect: true, effSide: ctx && ctx.side });
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  });
  // damage
  const adPrev = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    const dealt = adPrev.apply(this, arguments);
    try { if (dealt > 0) ABX.fireEv("damage", { side, n: dealt, byAttack: !!(src && src.kind === "attack") }); } catch (e) { if (ABX.debug) console.error(e); }
    return dealt;
  };

  /* ---- "If/When <event>, <effect>" read as a static (or left unread): re-read it as a triggered ability ---- */
  const stripEnd = (t) => String(t || "").trim().replace(/[.!]+$/, "").trim();
  function asTriggered(text) {
    const sents = stripEnd(text).replace(/^"[^"]+"\s*/, "").split(/(?<=[.!])\s+/);
    let once = null;
    const body = sents.filter(s => {
      if (/^(?:this ability|"[^"]+") (?:only )?activates once per turn\.?$|^this ability only activates once per turn\.?$/i.test(s)) { once = "turn"; return false; }
      return true;
    }).join(" ");
    const parts = body.split(/,\s*/);
    for (let k = 1; k < parts.length; k++) {
      const head = parts.slice(0, k).join(", ");
      let trig = null;
      for (const [re, fn] of ABX.TRIGGER_RULES) { const m = head.match(re); if (m) { try { trig = fn(m); } catch (e) { trig = null; } if (trig) break; } }
      if (!trig || !ABX.triggerSupported(trig)) continue;
      const r = ABX.parseSentenceSteps(stripEnd(parts.slice(k).join(", ")), { conds: [] });
      if (!r || !r.steps.length || (r.unparsed && r.unparsed.length)) return null;
      return { trigger: trig, steps: r.steps, once };
    }
    return null;
  }
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        if (!(["static", "triggered"].includes(ab.kind) || (ab.kind === "spell" && card && card.set)) || !(ab.unparsed && ab.unparsed.length || (ab.trigger && !ABX.triggerSupported(ab.trigger)))) return;
        const t = asTriggered(ab.cleaned || ab.raw || "");
        if (!t) return;
        ab.kind = "triggered"; ab.trigger = t.trigger; ab.steps = t.steps; ab.unparsed = [];
        if (t.once && !ab.once) ab.once = t.once;
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
