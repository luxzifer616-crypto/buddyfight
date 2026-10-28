/* ==================== ABX — round 9 ====================
 *  1. Keyword flags. The card data switches [Double Attack] / [Penetrate] / [Soulguard] / ... on whenever the word
 *     appears anywhere in the text, so "If your flag is X, this card gets [Double Attack]" gave Double Attack always.
 *     Here a card keeps a keyword only when it is printed as a keyword (a line that starts with "[Double Attack]" ...).
 *     Conditional / effect-given keywords come from the abilities (new engine, or the old code's checked line).
 *  2. More conditions the engine can read (soul counts, positions, attacking alone, world names, zone counts, buddy,
 *     [Transform]/[Ride], [Overturn] used, ...), and "Then, if you have N or more" that repeats the previous count.
 *  3. ABX.lineCond: the old code asks this to check the condition of a keyword line it handles itself.
 * Loaded after abilities_more.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core;
  const { F, otherSide, evalCond, cardOf, fieldUnits, matchFilter, refsFor, posOfUnit, turnStats } = core;
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const toNum = ABX.toNum || ((w) => +w);

  /* ============================================================
   * 1. KEYWORD FLAGS FROM THE PRINTED KEYWORDS ONLY
   * ============================================================ */
  const KW = { da: "double attack", ta: "triple attack", qa: "quadruple attack", pen: "penetrate", sg: "soulguard", ca: "counterattack", move: "move" };
  // the keywords in the run of [..] tags a line starts with ("[Penetrate] [Transform] [Pay 2 gauge & ...]" -> penetrate, transform)
  function leadingTags(line) {
    const s = String(line || "").replace(/\((?:[^()]|\([^()]*\))*\)/g, " ").trim();
    const out = [];
    let i = 0;
    while (i < s.length) {
      while (i < s.length && /[\s\-•■]/.test(s[i])) i++;
      if (s[i] !== "[") break;
      let d = 0, j = i;
      for (; j < s.length; j++) { if (s[j] === "[") d++; else if (s[j] === "]") { d--; if (d === 0) break; } }
      out.push(lc(s.slice(i + 1, j)).trim());
      i = j + 1;
      while (i < s.length && /[\s.!]/.test(s[i])) i++;
    }
    return out;
  }
  function printedKeywords(card) {
    const set = new Set();
    String(card.skill || "").split(/\n+/).forEach(line => leadingTags(line).forEach(t => set.add(t.replace(/\s+\d+$/, ""))));
    return set;
  }
  ABX.printedKeywords = printedKeywords;
  let kwFixed = 0;
  function fixKeywordFlags() {
    const seen = new Set();
    const all = [];
    if (typeof CARD_MAP !== "undefined") CARD_MAP.forEach(c => all.push(c));
    if (typeof ALL_CARDS !== "undefined" && Array.isArray(ALL_CARDS)) ALL_CARDS.forEach(c => all.push(c));
    for (const c of all) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      if (c.abxKwFixed) continue;
      const printed = printedKeywords(c);
      const before = {};
      let changed = false;
      for (const [f, k] of Object.entries(KW)) {
        before[f] = !!c[f];
        if (c[f] && !printed.has(k)) { c[f] = false; changed = true; }
      }
      if (changed) {
        // attacks per turn came from the same flags
        const wasMax = before.qa ? 4 : before.ta ? 3 : before.da ? 2 : 1;
        const nowMax = c.qa ? 4 : c.ta ? 3 : c.da ? 2 : 1;
        if ((c.atk_max || 1) === wasMax && nowMax < wasMax) c.atk_max = nowMax;
        kwFixed++;
      }
      Object.defineProperty(c, "abxKwFixed", { value: before, enumerable: false, configurable: true });
    }
  }
  fixKeywordFlags();
  ABX.kwFixedCount = () => kwFixed;

  /* ============================================================
   * 2. CONDITIONS
   * ============================================================ */
  const XC = ABX.extraCond = ABX.extraCond || {};
  const addOk = (...ts) => ts.forEach(t => ABX.COND_OK.add(t));
  const CMP = (w) => /less|fewer|below/i.test(w) ? "le" : /more|greater|higher|above/i.test(w) ? "ge" : "eq";
  const cmpN = (v, c) => c.cmp === "le" ? v <= c.n : c.cmp === "eq" ? v === c.n : c.cmp === "lt" ? v < c.n : v >= c.n;
  const NUM = "(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty)";
  const N = (w) => { const n = toNum(w); return isNaN(n) ? (/^an?$/i.test(w) ? 1 : NaN) : n; };
  // new rules go first, so they win over the broad "there are N or more ..." rules
  const NEW_RULES = [];
  const cr = (re, fn) => NEW_RULES.push([re, fn]);

  // --- soul of this card ---
  cr(new RegExp("^there (?:is|are) " + NUM + " or (more|less) (?:cards? |souls? )?in (?:this card's|this monster's|its) soul$", "i"), (m) => ({ t: "selfSoul", n: N(m[1]), cmp: CMP(m[2]) }));
  cr(new RegExp("^there (?:is|are) " + NUM + " or (more|less) souls? in this (?:card|monster)$", "i"), (m) => ({ t: "selfSoul", n: N(m[1]), cmp: CMP(m[2]) }));
  cr(/^there (?:is|are) (?:a |one or more )?(?:cards? |souls? )in (?:this card's|this monster's|its) soul$/i, () => ({ t: "selfSoul", n: 1, cmp: "ge" }));
  cr(/^there (?:are|is) no (?:cards? |souls? )?in (?:this card's|this monster's|its) soul$|^there are no souls in this card$/i, () => ({ t: "selfSoul", n: 0, cmp: "eq" }));
  cr(new RegExp("^this card has " + NUM + " or (more|less) (?:cards in its )?souls?$", "i"), (m) => ({ t: "selfSoul", n: N(m[1]), cmp: CMP(m[2]) }));
  // --- position ---
  cr(/^(?:this card|this|it|this monster) is on (?:your |the )?(left|right|center)$/i, (m) => ({ t: "selfPos", pos: lc(m[1]) }));
  cr(/^(?:this card|this|it) is on (?:your |the )?(left|right|center) or (?:the |your )?(left|right|center)$/i, (m) => ({ t: "selfPosAny", pos: [lc(m[1]), lc(m[2])] }));
  cr(/^no monsters? (?:is|are) on your center$|^there (?:is|are) no monsters? (?:on|in) your center$|^your center is empty$/i, () => ({ t: "xCenterEmpty", who: "you" }));
  cr(/^there (?:is|are) (?:no|0) monsters? (?:on|in) your opponent's center$|^your opponent's center is empty$/i, () => ({ t: "xCenterEmpty", who: "opp" }));
  // --- battle ---
  cr(/^this card is attacking alone$|^this (?:card )?is the only card attacking$|^(?:this card's|its) attack is not a link attack$|^this card is not link attacking$/i, () => ({ t: "xAlone" }));
  cr(/^it is not a link attack$|^the attack is not a link attack$|^(?:it|the attack) is a link attack$/i, (m) => ({ t: "xLinkAttack", v: !/not/i.test(m[0]) }));
  cr(/^this card is (?:being )?attacked$|^this card is being attacked$/i, () => ({ t: "xBeingAttacked" }));
  cr(/^this card is (?:link )?attacking$/i, () => ({ t: "selfAttacking" }));
  cr(/^this card is link attacking$/i, () => ({ t: "xLinking" }));
  // --- turn ---
  cr(/^(?:this|it) is your turn$/i, () => ({ t: "turn", who: "you" }));
  cr(/^(?:this|it) is your opponent's turn$/i, () => ({ t: "turn", who: "opp" }));
  // --- gauge / zones ---
  cr(new RegExp("^your opponent has " + NUM + " or (more|less) (?:cards in their )?gauge$", "i"), (m) => ({ t: "gauge", who: "opp", n: N(m[1]), cmp: CMP(m[2]) }));
  cr(new RegExp("^(?:you have|there (?:is|are)) " + NUM + " or (more|less|fewer) (non-monster |monster |spell |item )?cards? in your (drop zone|gauge|hand|deck)$", "i"), (m) => ({ t: "xZoneCount", who: "you", area: lc(m[4]), kind: m[3] ? lc(m[3]).trim() : null, n: N(m[1]), cmp: CMP(m[2]) }));
  cr(new RegExp("^(?:there (?:is|are)|your opponent has) " + NUM + " or (more|less|fewer) (non-monster |monster |spell |item )?cards? in (?:your opponent's|their) (drop zone|gauge|hand|deck)$", "i"), (m) => ({ t: "xZoneCount", who: "opp", area: lc(m[4]), kind: m[3] ? lc(m[3]).trim() : null, n: N(m[1]), cmp: CMP(m[2]) }));
  cr(new RegExp("^your (drop zone|gauge|hand) has " + NUM + " or (more|less) cards$", "i"), (m) => ({ t: "xZoneCount", who: "you", area: lc(m[1]), n: N(m[2]), cmp: CMP(m[3]) }));
  cr(new RegExp("^you have " + NUM + " or (less|more|fewer),? or " + NUM + " or (more|less),? cards in your (drop zone|gauge|hand)$", "i"), (m) => ({ t: "or", list: [{ t: "xZoneCount", who: "you", area: lc(m[5]), n: N(m[1]), cmp: CMP(m[2]) }, { t: "xZoneCount", who: "you", area: lc(m[5]), n: N(m[3]), cmp: CMP(m[4]) }] }));
  // "you have three or more «Dragon Chief Emperor» in your drop zone", "your drop zone has three or more different «X»"
  cr(new RegExp("^(?:you have|there (?:is|are)) " + NUM + " or (more|less) (different |a total of )?(.+?) in your (drop zone|gauge|hand|soul)$", "i"), (m) => {
    const np = ABX.parseNP(m[4] + " in your " + m[5]); if (!np || np.junk) return null;
    if (m[3] && /different/i.test(m[3])) np.filter = Object.assign({}, np.filter, { distinct: true });
    return { t: "count", owner: "you", np, n: N(m[1]), cmp: CMP(m[2]) };
  });
  cr(new RegExp("^your drop zone has " + NUM + " or (more|less) (different )?(.+)$", "i"), (m) => {
    const np = ABX.parseNP(m[4] + " in your drop zone"); if (!np || np.junk) return null;
    if (m[3]) np.filter = Object.assign({}, np.filter, { distinct: true });
    return { t: "count", owner: "you", np, n: N(m[1]), cmp: CMP(m[2]) };
  });
  // --- world names ---
  cr(new RegExp("^(?:you have )?" + NUM + " or more different world names (?:of|on) cards (?:are )?(in your drop zone|on your field|in its soul|in this card's soul)$", "i"), (m) => ({ t: "xWorldNames", area: /drop/i.test(m[2]) ? "drop" : /soul/i.test(m[2]) ? "soul" : "field", n: N(m[1]) }));
  cr(new RegExp("^this card has " + NUM + " or more different world names (?:of|on) cards in its soul$", "i"), (m) => ({ t: "xWorldNames", area: "soul", n: N(m[1]) }));
  cr(new RegExp("^you have " + NUM + " or more different world names on cards (?:on|in) your (field|drop zone)$", "i"), (m) => ({ t: "xWorldNames", area: /drop/i.test(m[2]) ? "drop" : "field", n: N(m[1]) }));
  // --- items / transform / ride ---
  cr(/^you are equipped with (?:an? )?item$/i, () => ({ t: "itemEquipped", any: true }));
  cr(/^you are equipped with (?:an? )?(.+)$/i, (m) => { const np = ABX.parseNP(m[1]); return np && !np.junk ? { t: "itemEquipped", np } : null; });
  cr(/^your equipped («[^»]+»|"[^"]+"|item) is \[?(stand|rest)\]?$/i, (m) => ({ t: "xItemState", np: /^item$/i.test(m[1]) ? null : ABX.parseNP(m[1]), rested: /rest/i.test(m[2]) }));
  cr(/^you are \[transform\] into this card$|^you are \[transform\]ed into this card$/i, () => ({ t: "xSelfItemMode", mode: "tr" }));
  cr(/^you are \[ride\] on this card$/i, () => ({ t: "xSelfItemMode", mode: "ride" }));
  cr(/^you are \[transform\](?: into (?:a |an )?(.+))?$/i, (m) => ({ t: "xItemMode", mode: "tr", np: m[1] && !/^card$/i.test(m[1]) ? ABX.parseNP(m[1]) : null }));
  cr(/^you are \[ride\](?: on (?:a |an )?(.+))?$/i, (m) => ({ t: "xItemMode", mode: "ride", np: m[1] && !/^card$/i.test(m[1]) ? ABX.parseNP(m[1]) : null }));
  cr(/^you are \[station\](?: at (?:a |an )?(.+))?$/i, (m) => ({ t: "xItemMode", mode: "st", np: m[1] && !/^card$/i.test(m[1]) ? ABX.parseNP(m[1]) : null }));
  cr(/^you are \[ride\] or \[station\](?: (?:at|on) (?:a |an )?card)?$/i, () => ({ t: "or", list: [{ t: "xItemMode", mode: "ride" }, { t: "xItemMode", mode: "st" }] }));
  cr(/^this card is in the soul of (?:a|the) card you are \[ride\] (?:on|into)$/i, () => ({ t: "xInSoulOfItemMode", mode: "ride" }));
  cr(/^this card is in the soul of (?:a|the) card you are \[transform\] into$/i, () => ({ t: "xInSoulOfItemMode", mode: "tr" }));
  // --- buddy ---
  cr(/^this card is your buddy(?: monster)?$/i, () => ({ t: "xIsBuddy" }));
  cr(/^your buddy has "([^"]+)" in its card name$/i, (m) => ({ t: "xBuddyName", name: lc(m[1]) }));
  cr(/^this card is in the soul of your buddy$/i, () => ({ t: "xInSoulOfBuddy" }));
  // --- set spells ---
  cr(/^(?:a|an) («[^»]+»|"[^"]+") is \[set\] on your field$|^you have (?:a|an) («[^»]+»|"[^"]+") \[set\]$/i, (m) => ({ t: "xSetHas", np: ABX.parseNP(m[1] || m[2]) }));
  // --- fight history ---
  cr(/^you (?:have )?used \[overturn\](?: or \[overthrow\]| or \[overkill\])* during this fight$/i, () => ({ t: "xOverturnUsed" }));
  // --- on field or in a soul ---
  cr(/^this card is on (?:your|the) field or in the soul of (.+)$/i, (m) => { const np = ABX.parseNP(m[1]); return np && !np.junk ? { t: "or", list: [{ t: "selfOnField" }, { t: "selfInSoulOf", np }] } : null; });
  cr(/^there (?:is|are) («[^»]+»|"[^"]+")(?: monsters?)? on your left and right$/i, (m) => { const a = ABX.parseNP(m[1] + " on your left"), b = ABX.parseNP(m[1] + " on your right"); return a && b ? { t: "and", list: [{ t: "has", owner: "you", np: a, n: 1 }, { t: "has", owner: "you", np: b, n: 1 }] } : null; });
  cr(/^this card has (\d+) (power|defense|critical) or (more|less)$/i, (m) => ({ t: "selfStat", stat: lc(m[2]), n: +m[1], cmp: CMP(m[3]) }));
  cr(/^this card has (\d+) or (more|less) (power|defense|critical)$/i, (m) => ({ t: "selfStat", stat: lc(m[3]), n: +m[1], cmp: CMP(m[2]) }));
  // --- your flag (no comma after it is handled by the line rewrite below) ---
  cr(/^your flag is not "([^"]+)"$/i, (m) => ({ t: "not", c: { t: "flagIs", names: [lc(m[1])] } }));
  cr(/^your flag is not <([^>]+)>$/i, (m) => ({ t: "not", c: { t: "flagWorld", world: m[1] } }));
  // damage taken this turn
  cr(new RegExp("^you (?:took|have taken) " + NUM + " or more damage(?: in total)? (?:during|in) this turn$", "i"), (m) => ({ t: "xDamageTaken", n: N(m[1]) }));

  ABX.COND_RULES.unshift(...NEW_RULES);
  addOk("xCenterEmpty", "xLinkAttack", "xAlone", "xBeingAttacked", "selfAttacking", "xLinking", "xZoneCount", "xWorldNames", "xItemState", "xSelfItemMode", "xItemMode", "xInSoulOfItemMode", "xIsBuddy", "xBuddyName", "xInSoulOfBuddy", "xSetHas", "xOverturnUsed", "xDamageTaken");

  // --- battle state: who is attacking whom right now (for "attacking alone", "being attacked", "link attacking") ---
  ABX.curBattle = null;
  const wrap = (obj, name, before, after) => {
    const orig = obj[name];
    if (typeof orig !== "function") return;
    obj[name] = function () { try { before && before.apply(this, arguments); } catch (e) { /* ignore */ } const r = orig.apply(this, arguments); try { after && after.apply(this, arguments); } catch (e) { /* ignore */ } return r; };
  };
  const setBattle = function (attSide, zones, targetPos) {
    const af = F(attSide), df = F(otherSide(attSide));
    ABX.curBattle = { turn: B.turnCount, attSide, defSide: otherSide(attSide), attUnits: (zones || []).map(z => z === "item" ? af.item : af.monsters[z]).filter(Boolean),
      defUnit: ["left", "center", "right"].includes(targetPos) ? df.monsters[targetPos] : null, targetPos };
  };
  wrap(B, "initiateAttackWithDefenseCheck", setBattle);
  wrap(B, "executeAttackResolution", setBattle);
  wrap(B, "startTurn", () => { ABX.curBattle = null; });
  if (ABX.fireBattleEnd) { const ofbe = ABX.fireBattleEnd; ABX.fireBattleEnd = function () { const r = ofbe.apply(this, arguments); ABX.curBattle = null; return r; }; }
  const battleNow = () => { const b = ABX.curBattle; if (b && b.turn === B.turnCount) return b; const bc = ABX.battleCtx; return bc && bc.active ? bc : null; };

  // --- damage taken this turn (for "you took N or more damage during this turn") ---
  const origApply = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    const dealt = origApply.apply(this, arguments);
    const S = core.st(F(side));
    if (S.dmgTurn !== B.turnCount) { S.dmgTurn = B.turnCount; S.dmgTaken = 0; }
    S.dmgTaken += dealt || 0;
    return dealt;
  };

  // --- evaluators ---
  const itemOf = (f) => (f.item && !f.item.isEndrulerFlag ? f.item : null);
  const itemMode = (it, mode) => !!(it && it.card && (mode === "tr" ? it.card.tr : mode === "ride" ? it.card.ride : it.card.st));
  const buddyUnit = (f) => fieldUnits(f, false).map(x => x.unit).find(u => u.isBuddyGift || (f.buddyId != null && u.card.id === f.buddyId)) || null;
  XC.xCenterEmpty = (c, ctx) => !F(c.who === "opp" ? otherSide(ctx.side) : ctx.side).monsters.center;
  XC.xAlone = (c, ctx) => { const b = battleNow(); return !!(b && ctx.unit && b.attUnits && b.attUnits.length === 1 && b.attUnits[0] === ctx.unit); };
  XC.xLinkAttack = (c, ctx) => { const b = battleNow(); if (!b) return false; const link = b.link != null ? !!b.link : (b.attUnits || []).length > 1; return link === c.v; };
  XC.xLinking = (c, ctx) => { const b = battleNow(); return !!(b && ctx.unit && b.attUnits && b.attUnits.length > 1 && b.attUnits.includes(ctx.unit)); };
  XC.selfAttacking = (c, ctx) => { const b = battleNow(); return !!(b && ctx.unit && (b.attUnits || []).includes(ctx.unit)); };
  XC.xBeingAttacked = (c, ctx) => { const b = battleNow(); if (!b || !ctx.unit) return false; if (b.defUnit) return b.defUnit === ctx.unit; const pd = B.pendingDefenseContext; return !!(pd && pd.defSide === ctx.side && F(ctx.side).monsters[pd.targetPos] === ctx.unit); };
  XC.xZoneCount = (c, ctx) => {
    const f = F(c.who === "opp" ? otherSide(ctx.side) : ctx.side);
    const arr = c.area === "drop zone" ? f.drop : c.area === "gauge" ? f.gauge : c.area === "hand" ? f.hand : f.deck;
    let ids = arr || [];
    if (c.kind) ids = ids.filter(id => { const cc = cardOf(id); if (!cc) return false; const mon = core.isMonsterCard(cc); return c.kind === "non-monster" ? !mon : c.kind === "monster" ? mon : c.kind === "spell" ? cc.type === "Spell" : cc.type === "Item"; });
    return cmpN(ids.length, c);
  };
  XC.xWorldNames = (c, ctx) => {
    const f = ctx.f, names = new Set();
    const add = (cc) => { if (!cc) return; (cc.worlds && cc.worlds.length ? cc.worlds : [cc.world]).forEach(w => { if (w && !/^generic$/i.test(w)) names.add(lc(w)); }); };
    if (c.area === "drop") f.drop.forEach(id => add(cardOf(id)));
    else if (c.area === "soul") { const u = ctx.unit || ctx.soulHost; (u && u.soul || []).forEach(id => add(cardOf(id))); }
    else fieldUnits(f, true).forEach(x => add(x.unit.card));
    return names.size >= c.n;
  };
  XC.xItemState = (c, ctx) => { const it = itemOf(ctx.f); if (!it) return false; if (c.np && !matchFilter(it.card, c.np.filter || {}, { unit: it, side: ctx.side }, ctx)) return false; return !!it.rested === c.rested; };
  XC.xSelfItemMode = (c, ctx) => { const it = itemOf(ctx.f); return !!it && it.card === ctx.card && itemMode(it, c.mode); };
  XC.xItemMode = (c, ctx) => { const it = itemOf(ctx.f); if (!itemMode(it, c.mode)) return false; return !c.np || matchFilter(it.card, c.np.filter || {}, { unit: it, side: ctx.side }, ctx); };
  XC.xInSoulOfItemMode = (c, ctx) => { const it = itemOf(ctx.f); return !!it && ctx.soulHost === it && itemMode(it, c.mode); };
  XC.xIsBuddy = (c, ctx) => { const bu = buddyUnit(ctx.f); return !!bu && bu === ctx.unit; };
  XC.xBuddyName = (c, ctx) => { const f = ctx.f; const bc = f.buddyId != null ? cardOf(f.buddyId) : null; return !!bc && lc(bc.name).includes(c.name); };
  XC.xInSoulOfBuddy = (c, ctx) => { const bu = buddyUnit(ctx.f); return !!bu && ctx.soulHost === bu; };
  XC.xSetHas = (c, ctx) => (ctx.f.setSpells || []).some(sp => !c.np || matchFilter(sp, c.np.filter || {}, null, ctx));
  XC.xOverturnUsed = (c, ctx) => !!ctx.f.overturnUsed;
  XC.xDamageTaken = (c, ctx) => { const S = core.st(ctx.f); return S.dmgTurn === B.turnCount && (S.dmgTaken || 0) >= c.n; };
  XC.rideOn = (c, ctx) => { const it = itemOf(ctx.f); return itemMode(it, "ride") && (!c.np || matchFilter(it.card, c.np.filter || {}, { unit: it, side: ctx.side }, ctx)); };
  addOk("rideOn");

  /* ---------- line rewrites before parsing ---------- */
  // "If you have three or more «X» in your drop zone, this card gets A, then, if you have five or more, this card gets B"
  //   -> the second condition repeats the count: "if you have five or more «X» in your drop zone"
  function chainCounts(s) {
    const m = s.match(/\bif (you have|there (?:is|are)|your opponent has) (\w+) or more ((?:different )?[^,]+?)(?=,)/i);
    if (!m) return s;
    const verb = m[1], noun = m[3];
    return s.replace(/((?:^|[,.]\s*)(?:then,?\s*)?if)\s+(?:(you have|there are|there is|your opponent has)\s+)?(\w+) or more(?=\s*,|\s+this card\b|\s+it\b)/ig, (all, pre, v, n) => {
      return `${pre} ${v || verb} ${n} or more ${noun}`;
    });
  }
  function rewriteLine(raw) {
    let s = String(raw || "");
    s = s.replace(/\bis"/g, 'is "');
    // "If your flag is "Lost World" this card gets ..." (missing comma)
    s = s.replace(/\b(if your flag is (?:not )?(?:"[^"]+"|<[^>]+>))\s+(?=this card\b|all\b|it\b)/ig, "$1, ");
    // "If your flag is <A>, this card gets X, if it is <B>, this card gets Y"
    if (/\byour flag is\b/i.test(s)) s = s.replace(/\bif it is (<[^>]+>|"[^"]+")/ig, "if your flag is $1");
    // "If this is on the right"
    s = s.replace(/\bif this is on\b/ig, "if this card is on");
    s = chainCounts(s);
    return s;
  }
  ABX.rewriteLine = rewriteLine;
  const origPAL = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewriteLine(rawLine);
    const ab = origPAL.call(this, fixed, card);
    if (fixed !== rawLine) ab.raw = ABX.clean(rawLine);   // keep the printed text (the old code matches lines by it)
    return ab;
  };

  /* ============================================================
   * 3. CONDITION OF A LINE THE OLD CODE HANDLES
   * ============================================================ */
  // true / false when the engine can read the "If ..." part of `line`, null when it can't.
  ABX.lineCond = function (card, line, fighter, unit) {
    try {
      const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
      if (!side) return null;
      let s = ABX.norm(rewriteLine(ABX.clean(line))).replace(/^(?:\[[^\]]+\]\s*|"[^"]+"\s*)+/, "");
      const m = s.match(/^(?:if|while)\s+(.+)$/i);
      if (!m) return null;
      const body = m[1];
      const commas = [...body.matchAll(/,\s*/g)].map(x => x.index);
      for (const ci of commas) {
        const cond = ABX.parseCondition(body.slice(0, ci));
        if (!cond) continue;
        if (!ABX.condExecutable(cond)) return null;
        const ctx = { side, f: fighter, e: F(otherSide(side)), card, unit, bind: { chosen: [] }, hostArea: "field" };
        return !!evalCond(cond, ctx);
      }
      return null;
    } catch (e) { if (ABX.debug) console.error(e); return null; }
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
