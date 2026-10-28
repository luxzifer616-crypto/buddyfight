/* ==================== ABX — round 25: Dragon World effect wordings ====================
 * Built to ability_definitions_dragon_world.md (groups D–K). Mostly REWRITES: a card's wording is turned into one the
 * parser already reads ("… gauge or draw a card" -> "either … or draw a card"), plus a few rules, conditions and ops:
 *  - damage equal to that card's / this card's critical, gauge equal to the number destroyed / the destroyed size
 *  - shields: "the next damage that would be dealt to you is reduced by N", "damage dealt to you by attacks … reduced"
 *  - "both players put the top card of their decks into their gauge", "draw a card from the bottom of your deck"
 *  - "Discard your hand, and draw N" / "Each player discards their hand, and draws N"
 *  - damage / draw equal to the different world names (drop zone / field)
 *  - "Your opponent cannot draw cards by card effects" (enforced in OPS.draw)
 *  - conditions: "this card entered by [G EVO]", "today is <weekday>"
 *  - no-effect lines (thank-you / promo text, "if your opponent is your child") and deck-building rules
 * Loaded after abilities_r24.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, cardOf } = core;
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const toN = (w) => { const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10); return isNaN(n) ? 1 : n; };

  /* ---- 1. rewrites of whole lines ---- */
  const RW = [
    [/\bput the top card of your deck into (?:your|the) gauge or draw a card\b/gi, "either put the top card of your deck into your gauge or draw a card"],
    [/\bput the top card of your deck into your gauge or this card's soul\b/gi, "either put the top card of your deck into your gauge or put the top card of your deck into this card's soul"],
    [/\byou have (\d+|one|two|three|four|five) gauge or (less|more)\b/gi, "you have $1 or $2 gauge"],
    [/\bfor this turn, damage dealt to you by an? attacks? becomes 0\b/gi, "for this turn, you do not take damage from attacks"],
    [/\bfor this turn, if you would be dealt damage, that damage is reduced by (\d+)/gi, "for this turn, the damage you take is reduced by $1"],
    [/\bduring this turn, if you would be dealt damage, that damage is reduced by (\d+)/gi, "for this turn, the damage you take is reduced by $1"],
    [/\bfor this turn, you will not take the next damage\b/gi, "for this turn, the next damage you take is reduced to 0"],
    [/\bif (?:it|this card) entered by \[g ?\.?evo\]/gi, "if this card entered by [G EVO]"],
    [/\bif it entered by card effects\b/gi, "if this card entered by card effects"],
    [/\bdeal (\d+) damage to them\b/gi, "deal $1 damage to your opponent"],
    [/"Lost World,"/g, '"Lost World",'],
    [/\bif you have a («[^»]+») equipped with power (\d+) or greater\b/gi, "if you have a $1 with power $2 or more equipped"],
    [/\byou have an item equipped with ("[^"]+") in its card name\b/gi, "you have an item with $1 in its card name equipped"],
    [/\bif two or more deity dragon tribe monsters is on your field, this card gets critial\+1/gi, "If there are 2 or more «Deity Dragon Tribe» monsters on your field, this card gets critical+1"],
    [/\bif this card has a ("[^"]+") in its soul\b/gi, "if there is a $1 in this card's soul"],
    [/\breturn a monster with (\d+) or less defense from the field to hand, or destroy it\b/gi, "either return a monster with $1 or less defense on the field to hand or destroy a monster with $1 or less defense on the field"],
    [/\breturn a monster from your opponent's field to their hand, or destroy it\b/gi, "either return a monster on your opponent's field to hand or destroy a monster on your opponent's field"],
    [/\bdestroy a monster in your opponent's center, an item, or a spell on your opponent's field\b/gi, "either destroy a monster in your opponent's center or destroy an item or spell on your opponent's field"],
    [/\[stand\] a («[^»]+») on your field and this card\b/gi, "[Stand] a $1 on your field, and [Stand] this card"],
    [/\s*if your opponent is your child, this card gets power\+\d+!*/gi, ""],
    [/\bthen, if you have (\d+) life or less, or a card with\b/gi, "Then, if you have $1 life or less, or you have a card with"],
    // usage limits written with the card's (quoted) name, at a sentence start; the plain form is read already, so only a
    // name with quotes inside ("Ninja Arts, "Inazuma Clone"") and "may only be cast" need help
    [/(^|[.!]\s+)"[^"]+" may only be cast once per (turn|game)\.?/gi, "$1You may only cast this card once per $2."],
    [/(^|[.!]\s+)"[^"]+"[^"]+""? only activates once per turn\.?/gi, "$1This ability only activates once per turn."],
    [/\byou can only use this ability once per turn\b/gi, "You may only use this ability once per turn"],
    [/^"[^"]+"[^"]+""\s*/, ""],   // ability name with quotes inside: "Ninja Arts, "Inazuma Clone""
    [/\byou gain life, and deal damage to your opponent, equal to the number of cards destroyed\b/gi, "you gain life equal to the number of cards destroyed, and deal damage to your opponent equal to the number of cards destroyed"],
    [/\bor (\d+) life or less\b/gi, "or you have $1 life or less"],
    [/\bif you have monsters on your left and right\b/gi, "if you have a monster on your left and right"],
    [/\breturn all cards on your opponent's field into (?:their|his or her) hand\b/gi, "return all cards on your opponent's field to hand"],
    [/\bdeal damage equal to the number of cards returned to your opponent\b/gi, "deal damage to your opponent equal to the number of cards returned"],
  ];
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    let fixed = String(rawLine || "");
    for (const [re, to] of RW) fixed = fixed.replace(re, to);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean ? ABX.clean(rawLine) : rawLine;
    return ab;
  };

  /* ---- 2. actions ---- */
  const A = [];
  const ar = (re, fn) => A.push([re, fn, false]);
  ar(/^(?:if you do, )?deal damage to your opponent equal to the (critical|power|size) of (?:that card|the chosen card|the destroyed (?:card|monster)|the monster destroyed)$/i, (m) => ({ op: "damage", who: "opp", n: { refStat: m[1].toLowerCase() } }));
  ar(/^(?:if you do, )?deal damage to your opponent equal to the critical of this card$/i, () => ({ op: "damage", who: "opp", n: { fromSelf: "critical" } }));
  ar(/^put (?:the number of )?cards from the top of your deck into your gauge equal to the number of (?:cards|monsters) (?:destroyed|you put into the drop zone)$/i, () => ({ op: "mill", who: "you", to: "gauge", n: { lastCount: true } }));
  ar(/^put the number of cards from the top of your deck into your gauge equal to the size of the destroyed monster$/i, () => ({ op: "mill", who: "you", to: "gauge", n: { refStat: "size" } }));
  ar(/^(?:for this turn, )?the next damage that would be dealt to you is reduced by (\d+)$/i, (m) => ({ op: "shield", mode: "next", reduceBy: +m[1], toZero: false, from: "any", duration: "turn" }));
  ar(/^(?:for this turn, )?damage dealt to you by attacks (?:are|is) reduced by (\d+)$/i, (m) => ({ op: "shield", mode: "turn", reduceBy: +m[1], from: "attack" }));
  ar(/^both players put the top card of their decks? into their gauge$/i, () => ({ op: "seq", steps: [{ op: "mill", who: "you", n: 1, to: "gauge" }, { op: "mill", who: "opp", n: 1, to: "gauge" }] }));
  ar(/^draw a card from the bottom of your deck$/i, () => ({ op: "drawBottom", n: 1 }));
  ar(/^discard your hand,? and draw (\w+) cards$/i, (m) => ({ op: "handReset", who: "you", n: toN(m[1]) }));
  ar(/^each player discards (?:their|his or her) hand,? and draws (\w+) cards$/i, (m) => ({ op: "handReset", who: "both", n: toN(m[1]) }));
  ar(/^deal damage to your opponent equal to the number of different world names of cards in your drop zone$/i, () => ({ op: "worldCount", act: "damage", area: "drop" }));
  ar(/^draw cards equal to the number of different world names of cards on your field$/i, () => ({ op: "worldCount", act: "draw", area: "field" }));
  ar(/^your opponent cannot draw cards by (?:the effects? of )?card(?:s| effects)$/i, () => ({ op: "static", kind: "oppNoEffDraw" }));
  ABX.ACTION_RULES.unshift(...A);

  OPS.drawBottom = { run(s, ctx) { const f = ctx.f; let n = 0; for (let i = 0; i < (s.n || 1) && f.deck.length; i++) { f.hand.push(f.deck.pop()); n++; } fresh(); return n > 0; }, check: () => true };
  OPS.handReset = {
    run(s, ctx) {
      (s.who === "both" ? ["plr", "opp"] : [ctx.side]).forEach(side => {
        const f = F(side);
        f.drop.push(...f.hand.splice(0));
        for (let i = 0; i < s.n && f.deck.length; i++) f.hand.push(f.deck.shift());
      });
      try { B.checkWinCondition(); } catch (e) { /* ignore */ }
      fresh(); return true;
    },
    check: (s) => s.n > 0
  };
  // different world names among cards (a card with "A / B" counts both)
  const worldsOf = (ids) => { const w = new Set(); ids.forEach(id => { const c = cardOf(id); String(c && c.world || "").split(" / ").filter(Boolean).forEach(x => w.add(x)); }); return w.size; };
  OPS.worldCount = {
    run(s, ctx) {
      const f = ctx.f;
      const ids = s.area === "drop" ? f.drop : core.fieldUnits(f, true).map(x => x.unit.card.id);
      const n = worldsOf(ids);
      if (!n) return false;
      if (s.act === "damage") { core.applyDamage(otherSide(ctx.side), n, { kind: "effect", card: ctx.card }); try { B.checkWinCondition(); } catch (e) { /* ignore */ } }
      else for (let i = 0; i < n && f.deck.length; i++) f.hand.push(f.deck.shift());
      fresh(); return true;
    },
    check: () => true
  };
  // "Your opponent cannot draw cards by card effects": checked whenever an effect makes that fighter draw
  const sChk = OPS.static.check;
  OPS.static.check = function (s) { return (s && s.kind === "oppNoEffDraw") || sChk.apply(this, arguments); };
  const noEffDraw = (side) => core.fieldUnits(F(otherSide(side)), true).some(x => x.unit.abxNullified !== B.turnCount &&
    core.abilitiesOf(x.unit.card, a => a.kind === "static" && (a.steps || []).some(st => st.kind === "oppNoEffDraw")).length > 0);
  const drawRun = OPS.draw.run;
  OPS.draw.run = function (s, ctx) {
    const side = s.who === "opp" ? otherSide(ctx.side) : ctx.side;
    if (noEffDraw(side)) return false;
    return drawRun.apply(this, arguments);
  };

  // amount() already resolves these counts; the checks didn't list them
  const millChk = OPS.mill.check;
  OPS.mill.check = function (s) { return !!(s && s.n && (s.n.refStat || s.n.lastCount)) || millChk.apply(this, arguments); };
  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && (ab.steps || []).length && ab.steps.every(s => s.op === "static" && s.kind === "oppNoEffDraw") && !(ab.unparsed && ab.unparsed.length)) return true;
    return isExecPrev.apply(this, arguments);
  };

  /* ---- 3. conditions ---- */
  const XC = ABX.extraCond = ABX.extraCond || {};
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  XC.xWeekday = (c) => new Date().getDay() === c.day;
  ["xWeekday", "gevoEntered", "xByEffect"].forEach(t => ABX.COND_OK.add(t));
  ABX.COND_RULES.unshift(
    [/^today is (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i, (m) => ({ t: "xWeekday", day: DAYS.indexOf(m[1].toLowerCase()) })],
    [/^this card entered(?: the field)? by \[g ?\.?evo\]$/i, () => ({ t: "gevoEntered" })]
  );

  /* ---- 4. lines with no effect, and deck-building rules ---- */
  const NO_EFFECT = /^(?:thank you for|you've become a buddyfight postcard master|nice to meet you|\]$|if your opponent is your child, this card gets critical\+\d+)/i;
  const DECK_RULE = /^(?:you may cast any number of "[^"]+" at the same time|you may only have one "(?:[^"]|"[^"]*")+" on your field|if less than four buddies are in your deck)/i;
  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach(ab => {
        if (!(ab.unparsed && ab.unparsed.length) || !["static", "spell", "triggered"].includes(ab.kind)) return;
        const t = String(ab.cleaned || ab.raw || "").trim();
        if (NO_EFFECT.test(t)) { ab.kind = "reminder"; ab.steps = []; ab.unparsed = []; }
        else if (DECK_RULE.test(t)) { ab.kind = "rule"; ab.steps = []; ab.unparsed = []; ab.parsed = true; }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
