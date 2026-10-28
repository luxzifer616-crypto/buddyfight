/* ==================== ABX — round 30: Dragon World, world names and free calls ====================
 * Built to ability_definitions_dragon_world.md:
 *  - "this card's world name on the field is also treated as …" for this turn: the chosen world (#5358, #5359; you pick
 *    with ABX.ui.pickOption) or the world of the card put into the drop zone (#3949, #6336). Counted by the
 *    "different world names on your field" checks (Round 9 condition, Round 25 counts).
 *  - "you may call "Jackknife" monsters from your hand without paying the gauge in their [Call Cost]" (#2051) as the
 *    existing [Call Cost] reduction.
 * Loaded after abilities_r29.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, cardOf } = core;

  const RW = [
    // shortcut: any call of such a monster is free of gauge (calls are almost always from the hand); check the zone if it matters
    [/\bif you would call a monster with ("[^"]+") in its card name from your hand, you may call it without paying the gauge written in its \[call cost\]/gi,
      "The [Call Cost] of each of your monsters with $1 in their card names is reduced by 99 gauge"],
  ];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };

  /* ---- world name aliases ---- */
  const splitWorlds = (t) => String(t).split(/\s*(?:,|\bor\b)\s*/i).map(w => w.replace(/[<>]/g, "").trim()).filter(Boolean);
  ABX.ACTION_RULES.unshift(
    [/^choose (.+?),? and for this turn, this card's world name on the field is also treated as the chosen world name$/i, (m) => {
      const worlds = splitWorlds(m[1]); return worlds.length > 1 ? { op: "worldAlias", choose: worlds } : null;
    }, true],   // whole sentence: split at the comma, "Choose <X World>" reads as a plain choose
    [/^(?:for this turn, )?(?:the world name of this card|this card's world name) on the field is also treated as the world name of the card put into the drop zone$/i,
      () => ({ op: "worldAlias", fromLast: true }), false],
    [/^(?:for this turn, )?(?:the world name of this card|this card's world name) on the field is also treated as the world name of the card put into the drop zone$/i,
      () => ({ op: "worldAlias", fromLast: true }), true]
  );
  OPS.worldAlias = {
    async run(s, ctx) {
      const u = ctx.unit; if (!u) return false;
      let worlds = [];
      if (s.choose) {
        const auto = ctx.f.isBot || ABX.autoPlay === true;
        const i = auto ? 0 : await ABX.ui.pickOption({ title: `${ctx.card.name} — choose a world`, options: s.choose.map(w => ({ label: w })) });
        worlds = [s.choose[i >= 0 ? i : 0]];
      } else {
        const r = [].concat(ctx.bind.lastMoved || [], ctx.bind.chosen || []).filter(x => x && x.card).shift();
        if (!r) return false;
        worlds = String(r.card.world || "").split(" / ").filter(Boolean);
      }
      if (!worlds.length) return false;
      u.abxWorldAlias = { turn: B.turnCount, worlds };
      return true;
    },
    check: () => true
  };
  // world names a card on the field has right now (its own + this turn's alias)
  ABX.unitWorlds = (u) => {
    const own = u && u.card ? (u.card.worlds && u.card.worlds.length ? u.card.worlds : String(u.card.world || "").split(" / ")) : [];
    const al = u && u.abxWorldAlias && u.abxWorldAlias.turn === B.turnCount ? u.abxWorldAlias.worlds : [];
    return own.concat(al).filter(w => w && !/^generic$/i.test(w));
  };
  const XC = ABX.extraCond;
  if (XC && XC.xWorldNames) {
    const xw = XC.xWorldNames;
    XC.xWorldNames = (c, ctx) => {
      if (c.area !== "field") return xw(c, ctx);
      const names = new Set();
      core.fieldUnits(ctx.f, true).forEach(x => ABX.unitWorlds(x.unit).forEach(w => names.add(w.toLowerCase())));
      return names.size >= c.n;
    };
  }
  if (OPS.worldCount) {
    const wc = OPS.worldCount.run;
    OPS.worldCount.run = function (s, ctx) {
      if (s.area !== "field") return wc.apply(this, arguments);
      const names = new Set();
      core.fieldUnits(ctx.f, true).forEach(x => ABX.unitWorlds(x.unit).forEach(w => names.add(w.toLowerCase())));
      const n = names.size, f = ctx.f;
      if (!n) return false;
      if (s.act === "damage") core.applyDamage(core.otherSide(ctx.side), n, { kind: "effect", card: ctx.card });
      else for (let i = 0; i < n && f.deck.length; i++) f.hand.push(f.deck.shift());
      try { B.renderBattle(); } catch (e) { /* ignore */ }
      return true;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
