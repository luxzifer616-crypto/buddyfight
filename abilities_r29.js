/* ==================== ABX — round 29: Dragon World, more trigger shapes ====================
 * Built to ability_definitions_dragon_world.md, on Round 24's event channel (ABX.fireEv):
 *  - "At the end of the turn that this card was destroyed, …" (#3992, #3993): runs from the drop zone at turn end
 *  - "When you or your opponent puts a card on the bottom of the deck" (#3722): fired by moves to a deck's bottom
 *  - "When your «X» enters the field on the left or right" (#504)
 * Loaded after abilities_r28.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, matchFilter } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };

  /* ---- wordings ---- */
  const RW = [
    // the definition: "you may call … from your drop zone" (no cost named) pays the [Call Cost]
    [/(at the end of the turn that this card was destroyed, you may call a "[^"]+" from your drop zone)\.?$/gim, "$1 by paying its [Call Cost]."],
  ];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };
  ABX.TRIGGER_RULES.unshift(
    [/^at the end of the turn (?:that|in which) this card was destroyed$/i, () => ({ event: "r29destroyedTurnEnd" })],
    [/^(?:when|whenever) you or your opponent puts? a card on the bottom of (?:the|a|their) deck$/i, () => ({ event: "r24", ev: "bottom" })],
    [/^(?:when|whenever) (?:your|a|an) («[^»]+»)(?: monster)?(?: on your field)? enters the field on the (left or right|right or left|left|right|center)$/i,
      (m) => ({ event: "r24", ev: "enterPos", np: NP(m[1]), pos: m[2].toLowerCase().split(" or ") })]
  );
  ABX.TRIG_OK.r29destroyedTurnEnd = () => true;

  /* ---- 1. end of the turn this card was destroyed (from the drop zone) ---- */
  if (typeof B.destroyMonster === "function") {
    const dm = B.destroyMonster;
    B.destroyMonster = function (side, pos) {
      const f = this.getFighter(side), m = f && f.monsters[pos];
      const r = dm.apply(this, arguments);
      try { if (m && f.monsters[pos] !== m && r !== false) (f.abxDestroyedTurn = f.abxDestroyedTurn || {})[m.card.id] = this.turnCount; } catch (e) { /* ignore */ }
      return r;
    };
  }
  const fte = ABX.fireTurnEvent;
  ABX.fireTurnEvent = function (kind) {
    const r = fte.apply(this, arguments);
    if (kind === "turnEnd") {
      ABX.queue(async () => {
        for (const side of ["plr", "opp"]) {
          const f = F(side), dt = f.abxDestroyedTurn || {};
          for (const id of Object.keys(dt)) {
            if (dt[id] !== B.turnCount) continue;
            delete dt[id];
            const card = core.cardOf(+id);
            if (!card || !f.drop.includes(card.id)) continue;
            for (const ab of core.abilitiesOf(card, a => a.kind === "triggered" && a.trigger && a.trigger.event === "r29destroyedTurnEnd" && ABX.isExecutable(a))) {
              const idx = f.drop.lastIndexOf(card.id);
              await core.runAbility(side, card, ab, null, { event: { name: "destroyedTurnEnd" }, hostArea: "drop", selfRef: { k: "zone", side, area: "drop", idx, id: card.id, card } });
              if (B.matchOver) return;
            }
          }
        }
      });
    }
    return r;
  };

  /* ---- 2. a card put on the bottom of a deck ---- */
  ["move", "moveZone"].forEach(op => {
    if (!OPS[op] || !OPS[op].run) return;
    const orun = OPS[op].run;
    OPS[op].run = async function (s, ctx) {
      const before = ["plr", "opp"].map(sd => F(sd).deck.length);
      const r = await orun.apply(this, arguments);
      try {
        if (s && s.to && s.to.area === "deck" && s.to.end === "bottom" && ["plr", "opp"].some((sd, i) => F(sd).deck.length > before[i])) ABX.fireEv("bottom", {});
      } catch (e) { /* ignore */ }
      return r;
    };
  });

  /* ---- 3. "When your «X» enters the field on the left or right" ---- */
  if (ABX.fireOtherEnter) {
    const foe = ABX.fireOtherEnter;
    ABX.fireOtherEnter = function (side, unit) {
      const r = foe.apply(this, arguments);
      try { ABX.fireEv("enterPos", { side, unit }); } catch (e) { /* ignore */ }
      return r;
    };
  }
  // matchers for the two new events, on Round 24's channel
  const EVX = {
    bottom: () => true,
    enterPos: (t, i, src, side) => side === i.side && i.unit && (!t.np || matchFilter(i.unit.card, t.np.filter || {}, { unit: i.unit, side }, { f: F(side) })) &&
      t.pos.includes(core.posOfUnit(F(side), i.unit))
  };
  const fev = ABX.fireEv;
  ABX.fireEv = function (name, info) {
    if (!EVX[name]) return fev.apply(this, arguments);
    return ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "r24" && t.ev === name && EVX[name](t, info, src, side), Object.assign({ name: "r24:" + name }, info)));
  };
  const tok = ABX.TRIG_OK.r24;
  ABX.TRIG_OK.r24 = (t) => !!EVX[t.ev] || tok(t);

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
