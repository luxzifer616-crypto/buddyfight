/* ==================== ABX — round 35: Dragon World, done ====================
 * Built to ability_definitions_dragon_world.md:
 *  - #3627 by flag: "Divine Guardians" (#2327) -> choose a card on your field, damage = its critical;
 *    "Searing Executioners" (#2328) -> damage = how many times your cards attacked this turn
 *  - #3791 drop one or more hand cards (its [Cast Cost], paid as part of the effect), then this turn all cards on your
 *    opponent's field get power-3000, defense-3000, critical-1 for each card dropped
 *  - #3274 "this card gets all abilities of the chosen card" (a "Jackknife" monster in its soul) for this turn
 *  - #4070 "this card gets the [Overthrow] of the cards in its soul"
 *    (both through ABX.get: while such a unit is on the field, the card also has those abilities)
 * Loaded after abilities_r34.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf, fieldUnits } = core;
  const lc = (s) => String(s || "").toLowerCase();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const auto = (side) => !!F(side).isBot || ABX.autoPlay === true;

  const C = (op, extra) => Object.assign({ op }, extra || {});
  const OV = [
    [3627, /^if your flag is «divine guardians», choose a card on your field/i, (ab) => ({ kind: ab.kind, steps: [
      { op: "choose", np: NP("a card on your field"), cond: { t: "flagIs", names: ["divine guardians"] } },
      { op: "damage", who: "opp", n: { refStat: "critical" }, cond: { t: "flagIs", names: ["divine guardians"] } },
      C("r35AttackDamage", { cond: { t: "flagIs", names: ["searing executioners"] } })] })],
    [3791, /get power-3000, defense-3000, and critical-1 for each card dropped by this card's \[cast cost\]/i, (ab) => ({ kind: ab.kind, steps: [C("r35DropDebuff", { power: 3000, defense: 3000, crit: 1 })] })],
    [3274, /for this turn, this card gets all abilities of the chosen card/i, (ab) => ({ kind: ab.kind, steps: [C("r35Borrow", { name: "Jackknife" })] })],
    [4070, /this card gets the \[overthrow\] of the cards in its soul/i, () => ({ kind: "static", steps: [C("static", { kind: "r31", tag: "soulOverthrow" })] })],
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
          break;
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  /* ---- ops ---- */
  OPS.r35AttackDamage = {
    run(s, ctx) { const n = core.turnStats(ctx.f).attacks || 0; if (!n) return false; core.applyDamage(otherSide(ctx.side), n, { kind: "effect", card: ctx.card }); try { B.checkWinCondition(); } catch (e) { /* ignore */ } fresh(); return true; },
    check: () => true
  };
  OPS.r35DropDebuff = {
    async run(s, ctx) {
      const f = ctx.f; if (!f.hand.length) return false;
      const cands = f.hand.map((id, idx) => ({ k: "zone", side: ctx.side, area: "hand", idx, id, card: cardOf(id) })).filter(r => r.card && r.card !== ctx.card);
      const ch = (await core.pick(cands, { qty: { n: cands.length, upTo: true } }, ctx, { intent: "cost", title: `${ctx.card.name} — drop one or more hand cards`, min: 1, max: cands.length })) || [];
      ch.forEach(r => { const i = f.hand.indexOf(r.id); if (i >= 0) f.drop.push(f.hand.splice(i, 1)[0]); });
      const n = ch.length; if (!n) return false;
      const e = ctx.e, eside = otherSide(ctx.side);
      fieldUnits(e, true).forEach(x => {
        const u = x.unit, lock = (st) => ABX.statLocked && ABX.statLocked(eside, u, st, true);
        if (!lock("power")) u.tempPower = (u.tempPower || 0) - s.power * n;
        if (!lock("defense")) u.tempDef = (u.tempDef || 0) - s.defense * n;
        if (!lock("critical")) u.tempCrit = (u.tempCrit || 0) - s.crit * n;
      });
      fresh(); return true;
    },
    check: () => true
  };
  OPS.r35Borrow = {
    async run(s, ctx) {
      const u = ctx.unit; if (!u) return false;
      const cands = (u.soul || []).map((id, idx) => ({ k: "soul", side: ctx.side, host: u, idx, id, card: cardOf(id) })).filter(r => r.card && r.card.type === "Monster" && lc(r.card.name).includes(lc(s.name)));
      if (!cands.length) return false;
      const ch = (await core.pick(cands, { qty: { n: 1 } }, ctx, { intent: "help", title: `${ctx.card.name} — gets all abilities of …` })) || [];
      if (!ch[0]) return false;
      u.abxBorrow = { turn: B.turnCount, id: ch[0].id };
      if (ABX.resetCaches) ABX.resetCaches();   // static boosts are cached per card
      fresh(); return true;
    },
    check: () => true
  };

  /* ---- ABX.get: borrowed abilities while the unit is on the field ---- */
  const SKIP = new Set(["cost", "keyword", "reminder", "rule"]);
  const getPrev = ABX.get;
  ABX.get = function (card) {
    const r = getPrev.apply(this, arguments);
    try {
      if (!r || !card || (card.id !== 3274 && card.id !== 4070) || typeof B === "undefined" || !B.plr || !B.opp) return r;
      const units = ["plr", "opp"].reduce((a, sd) => a.concat(fieldUnits(F(sd), true).map(x => x.unit)), []).filter(u => u.card === card && u.abxNullified !== B.turnCount);
      const extra = [];
      units.forEach(u => {
        if (card.id === 3274 && u.abxBorrow && u.abxBorrow.turn === B.turnCount) {
          const c = cardOf(u.abxBorrow.id); if (c) getPrev.call(this, c).abilities.forEach(a => { if (!SKIP.has(a.kind)) extra.push(Object.assign({}, a, { borrowedFrom: c.id })); });
        }
        if (card.id === 4070) (u.soul || []).forEach(id => {
          const c = cardOf(id); if (!c) return;
          // shortcut: each borrowed [Overthrow] is once per game on its own; "twice in this game" is not counted across them
          getPrev.call(this, c).abilities.forEach(a => { if (a.r21overturn && (a.tags || []).some(t => /^kw:overthrow/.test(t))) extra.push(Object.assign({}, a, { borrowedFrom: c.id })); });
        });
      });
      return extra.length ? Object.assign({}, r, { abilities: r.abilities.concat(extra) }) : r;
    } catch (e) { return r; }
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
