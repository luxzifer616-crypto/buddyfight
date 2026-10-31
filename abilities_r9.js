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
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
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
  cr(/^your equipped («[^»]+»|"[^"]+"|item) is \[?(stand|rest)\]?$/i, (m) => ({ t: "xItemState", np: /^item$/i.test(m[1]) ? undefined : ABX.parseNP(m[1]), rested: /rest/i.test(m[2]) }));
  cr(/^you are \[transform\] into this card$|^you are \[transform\]ed into this card$/i, () => ({ t: "xSelfItemMode", mode: "tr" }));
  cr(/^you are \[ride\] on this card$/i, () => ({ t: "xSelfItemMode", mode: "ride" }));
  cr(/^you are \[transform\](?: into (?:a |an )?(.+))?$/i, (m) => ({ t: "xItemMode", mode: "tr", np: m[1] && !/^card$/i.test(m[1]) ? ABX.parseNP(m[1]) : undefined }));
  cr(/^you are \[ride\](?: on (?:a |an )?(.+))?$/i, (m) => ({ t: "xItemMode", mode: "ride", np: m[1] && !/^card$/i.test(m[1]) ? ABX.parseNP(m[1]) : undefined }));
  cr(/^you are \[station\](?: at (?:a |an )?(.+))?$/i, (m) => ({ t: "xItemMode", mode: "st", np: m[1] && !/^card$/i.test(m[1]) ? ABX.parseNP(m[1]) : undefined }));
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
  cr(/^you (?:have )?used \[(?:overturn|overkill|overthrow)\](?: or \[(?:overturn|overkill|overthrow)\])*(?: during)? this (?:fight|game)$/i, (m) => ({ t: "xOverturnUsed", kinds: (m[0].match(/overturn|overkill|overthrow/gi) || []).map(x => x.toLowerCase()) }));
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

  cr(/^you have more life than your opponent$/i, () => ({ t: "lifeVs", cmp: "gt" }));
  cr(/^you have less life than your opponent$/i, () => ({ t: "lifeVs", cmp: "le" }));
  cr(new RegExp("^you have " + NUM + " or more different worlds among (?:cards|the cards) on your field$", "i"), (m) => ({ t: "xWorldNames", area: "field", n: N(m[1]) }));
  cr(new RegExp("^you (?:do )?put " + NUM + "(?: cards?)?$", "i"), (m) => ({ t: "xLastCount", n: N(m[1]) }));
  cr(/^you (?:destroyed|put|returned|dropped) (?:any|one or more|a card)$/i, () => ({ t: "xLastCount", n: 1 }));
  cr(/^(?:returned|destroyed)$/i, () => ({ t: "xLastCount", n: 1 }));
  cr(/^(?:this|it) is during the (attack|main|final) phase$/i, (m) => ({ t: "phase", phase: lc(m[1]) }));
  cr(/^(?:a|an) (.+?) is among them$/i, (m) => { const np = NP(m[1]); return np ? { t: "xAmong", np } : null; });
  cr(new RegExp("^you or your opponent (?:has|have) " + NUM + " life or (less|more)$", "i"), (m) => ({ t: "or", list: [{ t: "life", who: "you", n: N(m[1]), cmp: CMP(m[2]) }, { t: "life", who: "opp", n: N(m[1]), cmp: CMP(m[2]) }] }));
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
  XC.xOverturnUsed = (c, ctx) => {
    const f = ctx.f, u = f.overUsed;
    if (c.kinds && c.kinds.length && u) return c.kinds.some(k => u[k]);   // only the [Over...] kinds the card names count
    return !!f.overturnUsed;
  };
  XC.xDamageTaken = (c, ctx) => { const S = core.st(ctx.f); return S.dmgTurn === B.turnCount && (S.dmgTaken || 0) >= c.n; };
  XC.xLastCount = (c, ctx) => (ctx.lastCount || 0) >= c.n;
  XC.xAmong = (c, ctx) => [].concat(ctx.bind.looked || [], ctx.bind.revealed || []).some(r => r && r.card && matchFilter(r.card, c.np.filter || {}, r, ctx));
  XC.rideOn = (c, ctx) => { const it = itemOf(ctx.f); return itemMode(it, "ride") && (!c.np || matchFilter(it.card, c.np.filter || {}, { unit: it, side: ctx.side }, ctx)); };
  addOk("rideOn", "xLastCount", "xAmong");

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


  /* ============================================================
   * 4. PARSER: compound conditions / sentences, "instead", "either ... or ..."
   * ============================================================ */
  const OPS = ABX.OPS;
  const stripEnd = (t) => String(t || "").trim().replace(/[.!]+$/, "").trim();
  function insideAt(s, idx) { let q = 0, b = 0; for (let i = 0; i < idx; i++) { const c = s[i]; if (c === '"') q ^= 1; else if (!q) { if ("[«(<".includes(c)) b++; else if ("]»)>".includes(c)) b--; } } return q || b > 0; }
  // split `s` at `re`, only outside quotes / brackets
  function topSplit(s, re) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    const out = []; let last = 0, m;
    while ((m = g.exec(s))) { if (!m[0].length) { g.lastIndex++; continue; } if (insideAt(s, m.index)) continue; out.push(s.slice(last, m.index)); last = m.index + m[0].length; }
    out.push(s.slice(last));
    return out.map(x => x.trim()).filter(Boolean);
  }
  const fullOK = (r) => !!r && r.steps && r.steps.length > 0 && !(r.unparsed && r.unparsed.length) && r.steps.every(x => !x.np || !x.np.junk);

  // --- compound conditions: "If A, or if B, ..." / "If A, and B, ..." / "an «X» on your center and left" ---
  const origPC = ABX.parseCondition;
  const SUBJ_RE = /^(?:you |your |this |there |a |an |another |neither |it |the |that |no |all |each |during )/i;
  let pcDepth = 0;
  ABX.parseCondition = function (text) {
    const r = origPC.call(this, text);
    if (r || pcDepth > 3) return r;
    const t = stripEnd(ABX.norm(text)).replace(/^(?:if|while)\s+/i, "");
    if (!t || t.length > 260) return null;
    pcDepth++;
    try {
      let m = t.match(/^(you have (?:a|an|another) (.+?) on your )(center|left|right) and (?:your )?(center|left|right)$/i);
      if (m) { const a = ABX.parseCondition(m[1] + m[3]), b = ABX.parseCondition(m[1] + m[4]); if (a && b) return { t: "and", list: [a, b] }; }
      for (const [re, kind] of [[/,?\s+or\s+(?:if\s+)?(?=you |your |this |there |a |an |another |if |the |it )/i, "or"], [/,\s*and\s+(?:if\s+)?|\s+and\s+if\s+/i, "and"]]) {
        const parts = topSplit(t, re);
        if (parts.length < 2) continue;
        const subs = []; let prevSubj = null;
        for (const p of parts) {
          let c = ABX.parseCondition(p);
          if (!c && prevSubj && !SUBJ_RE.test(p)) c = ABX.parseCondition(prevSubj + p);
          if (!c) break;
          subs.push(c);
          const sm = p.match(/^(you have |your opponent has |there (?:is|are) )/i); if (sm) prevSubj = sm[1];
        }
        if (subs.length === parts.length) return { t: kind, list: subs };
      }
      return null;
    } finally { pcDepth--; }
  };

  // --- sentences ---
  const origPSS = ABX.parseSentenceSteps;
  const pss = (t, st) => origPSS.call(ABX, t, st || { conds: [] });
  // "If A, B, C, ..." where the condition itself contains commas: take the longest head that reads as a condition
  function leadCond(s, minK) {
    const lm = s.match(/^((?:then,?\s*)?(?:if|while)\s+)/i);
    if (!lm || /^(?:then,?\s*)?if you (?:do|did|can)\b/i.test(s)) return null;
    const body = s.slice(lm[0].length);
    const parts = topSplit(body, /,\s*/);
    let best = null;
    for (let k = 1; k < parts.length; k++) {
      const head = parts.slice(0, k).join(", ");
      const c = ABX.parseCondition(head);
      if (c) best = { k, c };
    }
    if (!best || best.k < (minK || 2)) return null;   // a one-comma condition is read fine already
    return { cond: best.c, rest: parts.slice(best.k).join(", ") };
  }
  // split a compound sentence and parse each part ("all «X» cannot be destroyed ..., get defense+5000, and damage ... cannot be reduced")
  function splitRetry(text, st) {
    const r0 = pss(text, st);
    if (fullOK(r0)) return r0;
    let pre = "", t = stripEnd(ABX.norm(text));
    const pm = t.match(/^((?:for|during) (?:this|that) (turn|battle|fight),?\s*)/i);
    if (pm) { pre = "for this " + lc(pm[2]) + ", "; t = t.slice(pm[0].length); }
    const parts = topSplit(t, /,\s*(?:and\s+)?(?:then,?\s*)?|\s+and\s+(?=(?:damage|all|the|this card|that card|it|its|your|you|items?|monsters?|cards?|draw|put|destroy|deal|call)\b)/i);
    if (parts.length < 2 || parts.length > 6) return r0;
    const sm = parts[0].match(/^(.+?)\s+(?:cannot|can|gets?)\b/i);
    const subj = sm ? sm[1] : null;
    const steps = [];
    for (let p of parts) {
      if (subj && /^(?:gets?|cannot|can)\b/i.test(p)) p = subj + " " + p;
      const r = pss(pre + p, st);
      if (!fullOK(r)) return r0;
      steps.push(...r.steps);
    }
    return { steps, unparsed: [] };
  }
  ABX.parseSentenceSteps = function (sentence, st) {
    let s = stripEnd(ABX.norm(sentence));
    let instead = false;
    if (/,?\s+instead$/i.test(s)) { instead = true; s = s.replace(/,?\s+instead$/i, ""); }
    else if (/,\s*instead,\s*/i.test(s)) { instead = true; s = s.replace(/,\s*instead,\s*/i, ", "); }
    let r = null;
    const lead = leadCond(s);
    if (lead) {
      const rr = splitRetry(lead.rest, st);
      if (fullOK(rr)) { rr.steps.forEach(x => { x.cond = x.cond ? { t: "and", list: [lead.cond, x.cond] } : lead.cond; }); r = rr; }
    }
    if (!r) r = instead ? splitRetry(s, st) : (() => { const r0 = pss(sentence, st); return fullOK(r0) ? r0 : splitRetry(s, st); })();
    if (!fullOK(r)) {   // "if C, A, B, and C2" where only splitting the effects helps
      const l1 = leadCond(s, 1);
      if (l1) { const rr = splitRetry(l1.rest, st); if (fullOK(rr)) { rr.steps.forEach(x => { x.cond = x.cond ? { t: "and", list: [l1.cond, x.cond] } : l1.cond; }); r = rr; } }
    }
    if (instead && fullOK(r)) { const wc = r.steps.filter(x => x.cond); (wc.length ? wc : r.steps).forEach(x => { x.instead = true; }); }
    return r;
  };
  // "Destroy A. If C, destroy B instead." -> A only when not C
  function applyInstead(steps) {
    for (let i = 1; i < steps.length; i++) {
      const x = steps[i];
      if (!x.instead || !x.cond) continue;
      let j = i - 1; while (j >= 0 && steps[j].instead) j--;
      if (j < 0) continue;
      const notC = { t: "not", c: x.cond };
      steps[j].cond = steps[j].cond ? { t: "and", list: [steps[j].cond, notC] } : notC;
    }
  }

  /* ---------- more line rewrites ---------- */
  function rewrite2(s) {
    s = s.replace(/\bchoose and (\[rest\]|\[stand\]|destroy|rest|stand) (up to [^.]+?|an? [^.]+?|all [^.]+?)(?=\.|$)/ig, (all, verb, np) => `choose ${np}, and ${verb} the chosen cards`);
    s = s.replace(/\b(card|monster|item)s? on your opponent's turn\b/ig, (m, w) => m.replace(/turn$/i, "field"));
    s = s.replace(/\bsize (\d+) or (less|greater) on (your|your opponent's) field/ig, "size $1 or $2 monster on $3 field");
    s = s.replace(/\bevents? or items?\b/ig, "item");
    s = s.replace(/\bcall or \[ride\] /ig, "call ").replace(/ or \[ride\] cost\b/ig, "");
    s = s.replace(/\blook at (two|three|four|five|six|\d+) cards from the top of your deck\b/ig, "look at the top $1 cards of your deck");
    s = s.replace(/\bfor this turn, for each (.+?) this card gets (.+?)(?=\.|$)/ig, "for this turn, this card gets $2 for each $1");
    s = s.replace(/\bduring the battle (?:that )?this card is attacking alone, (?:it|this card) gets\b/ig, "If this card is attacking alone, this card gets");
    s = s.replace(/\byou may choose to put\b/ig, "you may put");
    s = s.replace(/\bduring the attack phase of this turn,\s*/ig, "for this turn, ");
    s = s.replace(/, and during this turn, the next time\b/ig, ". For this turn, the next time");
    if (/in your drop zone/i.test(s)) s = s.replace(/\bcall this card on your field\b/ig, "call this card from your drop zone");
    s = s.replace(/\bif you do put\b/ig, "if you put");
    s = s.replace(/\bput the top (\w+) cards? of both players'? decks? into the drop zone(?: and then|, and then|, then)?/ig, "put the top $1 cards of your deck into your drop zone, put the top $1 cards of your opponent's deck into their drop zone, then");
    s = s.replace(/\bfrom the soul of this card\b/ig, "from this card's soul");
    s = s.replace(/\bup to one size (\d+) and one size (\d+) («[^»]+»(?: monsters?)?)/ig, "up to one size $1 $3 and up to one size $2 $3");
    s = s.replace(/\b(put (?:up to \w+|an?|one|two|three) [^,.]+?) into your hand from among them\b/ig, "$1 from among them into your hand");
    s = s.replace(/\b(a card|cards?) from among them face up or down\b/ig, "$1 from among them");
    s = s.replace(/\ba total of up to (\w+) items and spells\b/ig, "up to $1 items or spells");
    s = s.replace(/ (?:five|two|three) times(?=\.|$)/ig, "");
    s = s.replace(/\. if you have\b/ig, ". If you have").replace(/ and if you have\b/ig, ". If you have");
    s = s.replace(/,? and drop the rest\b/ig, ", and put the rest into the drop zone");
    s = s.replace(/\bnullify the abilities of\b/ig, "nullify all abilities of");
    s = s.replace(/\ba face down soul\b/ig, "a soul");
    s = s.replace(/ in total on your opponent's field/ig, " on your opponent's field");
    s = s.replace(/\bif (it|that card) would be destroyed, (it|that card) remains on the field\b/ig, "the next time $1 would be destroyed, $2 remains on the field");
    s = s.replace(/\bthe next time (that card|it|this card) would leave the field by your opponent's card effects\b/ig, "the next time $1 would be destroyed");
    const lk = s.match(/\blook at the top (two|three|four|five|six|seven|\d+) cards\b/i);
    if (lk) s = s.replace(/\b(?:any number of|as many of) (them|those cards|«[^»]+»(?: monsters?)?)(?: as you like)?\b/ig, (m, what) => `up to ${lk[1]} ${/^(them|those cards)$/i.test(what) ? "of them" : what}`);
    return s;
  }
  const prevRewrite = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite2(prevRewrite(t));

  /* ---------- action rules ---------- */
  const NEW_ACT = [];
  const ar = (re, fn) => NEW_ACT.push([re, fn, false]);
  const arw = (re, fn) => NEW_ACT.push([re, fn, true]);
  const subSteps = (t) => { const r = ABX.parseSentenceSteps(t, { conds: [] }); return fullOK(r) ? r.steps : null; };
  const EITHER_VERB = /^(?:destroy|put|return|deal|draw|call|discard|drop|give|for this turn|you gain|\[rest\]|\[stand\])\b/i;
  function eitherOf(verb, body) {
    // try every " or " split point (", or " first)
    const pts = [];
    const re = /,?\s+or\s+/g; let m;
    while ((m = re.exec(body))) if (!insideAt(body, m.index)) pts.push([m.index, m[0]]);
    pts.sort((a, b) => (b[1].startsWith(",") ? 1 : 0) - (a[1].startsWith(",") ? 1 : 0));
    for (const [i, sep] of pts) {
      let a = body.slice(0, i).trim(), b = body.slice(i + sep.length).trim();
      if (verb) { a = verb + " " + a; if (!EITHER_VERB.test(b)) b = verb + " " + b; }
      const zone = b.match(/ on your opponent's field$/i);
      if (zone && !/\bfield\b|\bcenter\b|\bleft\b|\bright\b/i.test(a)) a += zone[0];
      const sa = subSteps(a), sb = subSteps(b);
      if (sa && sb) return { op: "either", opts: [sa, sb], labels: [a, b] };
    }
    return null;
  }
  ar(/^(?:(destroy|put|return|deal|draw|call|discard|drop) )?either (.+)$/i, (m) => eitherOf(m[1] ? lc(m[1]) : null, m[2]));
  ar(/^(destroy .+?) or ((?:put|return|deal|draw|destroy) .+)$/i, (m) => { const sa = subSteps(m[1]), sb = subSteps(m[2]); return sa && sb ? { op: "either", opts: [sa, sb], labels: [m[1], m[2]] } : null; });
  // opponent's gauge / life
  ar(/^drop (up to )?(\d+|one|two|three|four|five) of your opponent's gauge$/i, (m) => ({ op: "dropOppGauge", n: toNum(m[2]), upTo: !!m[1] }));
  ar(/^(?:then,? )?put the top card of your deck into your gauge for each gauge dropped$/i, () => ({ op: "mill", who: "you", n: { lastCount: true }, to: "gauge" }));
  ar(/^each player gains (\d+|one|two|three|four|five) life$/i, (m) => ({ op: "seq", steps: [{ op: "life", who: "you", n: toNum(m[1]) }, { op: "life", who: "opp", n: toNum(m[1]) }] }));
  ar(/^(?:your opponent's|their) life becomes (\d+)$/i, (m) => ({ op: "setLife", who: "opp", n: +m[1] }));
  // damage / draw / charge by count
  ar(/^deal damage to (?:your|the) opponent equal to (?:(\d+|one|two|three) plus )?the number of (cards? (?:destroyed|put|\[rest\]|returned|dropped))$/i, (m) => ({ op: "damage", who: "opp", n: { lastCount: true, plus: m[1] ? toNum(m[1]) : 0 } }));
  ar(/^deal damage to (?:your|the) opponent equal to (?:(\d+|one|two|three) plus )?the number of (.+)$/i, (m) => { const np = NP(m[2]); return np ? { op: "damage", who: "opp", n: { each: np, plus: m[1] ? toNum(m[1]) : 0 } } : null; });
  ar(/^draw (?:cards|a card) equal to the number of (.+)$/i, (m) => { const np = NP(m[1]); return np ? { op: "draw", who: "you", n: { each: np } } : null; });
  ar(/^put cards from the top of your deck into your gauge,? equal to the number of (.+)$/i, (m) => { const np = NP(m[1]); return np ? { op: "mill", who: "you", n: { each: np }, to: "gauge" } : null; });
  ar(/^destroy (?:the number of )?(cards?|monsters?) on your opponent's field equal to the number of (cards? (?:put|destroyed|dropped|returned))$/i, (m) => ({ op: "destroy", np: { raw: m[1] + " on your opponent's field", qty: { n: 1, fromLast: true }, filter: /monster/i.test(m[1]) ? { types: ["monster"] } : {}, zone: { owner: "opp", area: "field" } } }));
  ar(/^destroy (?:the number of )?(cards?|monsters?) on your opponent's field equal to the number of (.+)$/i, (m) => { const each = NP(m[2]); return each ? { op: "destroy", np: { raw: m[1] + " on your opponent's field", qty: { n: 1, numOf: each }, filter: /monster/i.test(m[1]) ? { types: ["monster"] } : {}, zone: { owner: "opp", area: "field" } } } : null; });
  ar(/^destroy (?:one|all) of (?:those|the attacked) monsters?$|^destroy that monster$/i, () => ({ op: "destroyBattleTarget" }));
  ar(/^destroy all (?:\[set\] )?spells on your opponent's field$/i, () => ({ op: "destroySet", who: "opp" }));
  // shields / life floor / cannot lose
  ar(/^the next time you would be dealt damage,? (?:it|that damage) is reduced (?:to 0|by (\d+|one|two|three))$/i, (m) => ({ op: "shield", mode: "next", toZero: !m[1], reduceBy: m[1] ? toNum(m[1]) : 0 }));
  ar(/^(?:the )?damage (?:dealt to you|you take|you would take) (?:are|is) reduced by (\d+|one|two|three)$/i, (m) => ({ op: "shield", mode: "turn", reduceBy: toNum(m[1]) }));
  ar(/^the next time your life would become 0,? it becomes 1 instead$|^the next time your life would become 0,? your life becomes 1$/i, () => ({ op: "lifeFloor" }));
  ar(/^until the (?:beginning|start) of your opponent's next turn,? you cannot lose the (?:game|fight)$/i, () => ({ op: "noLose" }));
  ar(/^damage (?:your opponent takes|dealt to your opponent) by your card effects cannot be reduced$/i, () => ({ op: "unreducibleTurn" }));
  // boosts with keywords only
  ar(/^give (.+?) ((?:\[[^\]]+\])(?:(?:,\s*|,?\s*and\s+)\[[^\]]+\])*)$/i, (m) => { const np = /^(it|them|that card|the chosen cards?)$/i.test(m[1]) ? { ref: "chosen", qty: { all: true, n: 99 }, filter: {}, raw: m[1] } : NP(m[1]); const mods = ABX.parseStatMods(m[2]); return np && mods ? { op: "boost", np, mods } : null; });
  // zone moves
  ar(/^add (.+?) from your (drop zone|deck|gauge) to your hand$/i, (m) => { const np = NP(m[1] + " from your " + m[2]); return np ? { op: "move", np, to: { area: "hand", owner: "you", end: "top" } } : null; });
  arw(/^put all cards (?:from|in) your drop zone on the bottom of (?:the|your) deck,? and shuffle (?:it|your deck|the deck)$/i, () => ({ op: "seq", steps: [{ op: "move", np: { qty: { all: true, n: 99 }, filter: {}, zone: { owner: "you", area: "drop zone" }, raw: "all cards in your drop zone" }, to: { area: "deck", owner: "you", end: "bottom" } }, { op: "shuffle", who: "you" }] }));
  arw(/^return up to (\w+) cards from your opponent's drop zone (?:in)?to (?:the|their) deck,? and shuffle (?:the|their) deck$/i, (m) => ({ op: "seq", steps: [{ op: "move", np: { qty: { n: toNum(m[1]), upTo: true }, filter: {}, zone: { owner: "opp", area: "drop zone" }, raw: "cards from your opponent's drop zone" }, to: { area: "deck", owner: "owner", end: "bottom" } }, { op: "shuffle", who: "opp" }] }));
  arw(/^your opponent chooses and drops a hand card,? and you draw a card$/i, () => ({ op: "seq", steps: [{ op: "oppDiscard", n: 1 }, { op: "draw", who: "you", n: 1 }] }));
  // equip / cast from a zone
  ar(/^(?:you may )?equip (?:up to one |an? |one )?(.+?) from your (drop zone|hand|deck)(?: or (drop zone|hand|deck))? (by paying|without paying) its \[equip cost\]$/i, (m) => { const np = NP(m[1]); return np ? { op: "equipFrom", np, from: [m[2], m[3]].filter(Boolean).map(lc), pay: /^by/i.test(m[4]), upTo: /up to/i.test(m[0]) } : null; });
  ar(/^(?:you may )?equip (?:up to one |an? |one )?(.+?) from your (drop zone|hand|deck)(?: or (drop zone|hand|deck))?$/i, (m) => { const np = NP(m[1]); return np ? { op: "equipFrom", np, from: [m[2], m[3]].filter(Boolean).map(lc), pay: false, upTo: /up to/i.test(m[0]) } : null; });
  ar(/^cast (?:a|an|up to one) (.+?) from your (drop zone|hand) by paying its \[cast cost\]$/i, (m) => { const np = NP(m[1]); return np ? { op: "castFrom", np, from: lc(m[2]), pay: true } : null; });
  ar(/^cast (?:it|that card|the chosen card) by paying its \[cast cost\]$/i, () => ({ op: "castFrom", ref: "chosen", pay: true }));
  // free costs (static)
  ar(/^you may call (?:this|this card) without paying its \[call cost\]$/i, () => ({ op: "freeCost", what: "call" }));
  ar(/^you may choose not to pay the \[cast cost\] of this card$/i, () => ({ op: "freeCost", what: "cast" }));
  // call this card from a soul
  ar(/^call this card from (?:the|a|its) soul(?: of (.+?))?(?: (by paying|without paying) its \[call cost\])?$/i, (m) => ({ op: "callFromSoul", host: m[1] ? NP(m[1]) : null, pay: /^by/i.test(m[2] || "") }));

  ar(/^(?:you may )?choose not to pay the \[cast cost\] of this card$/i, () => ({ op: "freeCost", what: "cast" }));
  ar(/^put all cards in both (?:fighter|player)'?s'? gauges? into the(?:ir)? drop zones?$/i, () => ({ op: "seq", steps: [{ op: "moveZone", from: { owner: "you", area: "gauge" }, to: { owner: "you", area: "drop zone" }, n: 99 }, { op: "moveZone", from: { owner: "opp", area: "gauge" }, to: { owner: "opp", area: "drop zone" }, n: 99 }] }));
  ar(/^(?:you may )?put (?:a card|cards) from your (drop zone|hand|gauge) into this card's soul until (\w+) cards? (?:are|is) in (?:its|this card's) soul$/i, (m) => ({ op: "soulFill", from: lc(m[1]), n: toNum(m[2]) }));
  ar(/^put (.+? from .+?) and ((?:a|an|one|up to \w+) .+? from .+?|this card) into (.+)$/i, (m) => { const a = subSteps("put " + m[1] + " into " + m[3]), b = subSteps("put " + m[2] + " into " + m[3]); return a && b ? { op: "seq", steps: a.concat(b) } : null; });
  ar(/^the next time your life would become 0,? (?:it becomes 1|your life becomes 1)(?: instead)?$/i, () => ({ op: "lifeFloor" }));
  ar(/^equip (?:it|that card|the chosen card) (by paying|without paying) its \[equip cost\]$/i, (m) => ({ op: "equipFrom", ref: "chosen", np: { raw: "the chosen card", filter: {} }, from: [], pay: /^by/i.test(m[1]) }));
  ar(/^nullify (?:your opponent's|the opponent's) (spell|impact)$/i, (m) => ({ op: "nullifyCast", what: lc(m[1]) }));
  ar(/^(all cards|all monsters|all items) on your opponent's field cannot \[stand\] during their next (?:start|stand) phase$/i, (m) => { const np = NP(m[1] + " on your opponent's field"); return np ? { op: "restrict", np, kinds: ["stand"], duration: "next" } : null; });
  ar(/^(?:that card's|the chosen card's|its) attacks? cannot be nullified(?: and its damage cannot be reduced)?(?: if it is attacking alone)?$/i, (m) => ({ op: "unnullChosen", alone: /alone/i.test(m[0]), noReduce: /reduced/i.test(m[0]) }));
  ar(/^(?:that card's|the chosen card's|the chosen cards'|their) ((?:power|defense|critical|attack)(?:,? (?:and )?(?:power|defense|critical))*) cannot be reduced(?: by your opponent's card effects)?$/i, (m) => ({ op: "noReduceChosen", stats: (m[1].match(/power|defense|critical|attack/ig) || []).map(x => lc(x) === "attack" ? "power" : lc(x)) }));
  ar(/^the (attack|power), defense and critical of all cards on your field cannot be reduced by your opponent's card effects$/i, () => ({ op: "noReduceAll", stats: ["power", "defense", "critical"] }));
  ar(/^(?:during the battle that (?:it|the chosen card) (?:attacks alone|is attacking alone|link attacks),? )?your opponent cannot \[counter\](?: during the battle that (?:it|the chosen card) (?:attacks alone|is attacking alone|link attacks))?$/i, (m) => ({ op: "noCounterChosen", mode: /link/i.test(m[0]) ? "link" : "alone" }));
  ar(/^during the battle that (?:it|the chosen card) (attacks alone|link attacks),? your opponent cannot \[counter\](?: and that damage dealt cannot be reduced)?$/i, (m) => ({ op: "noCounterChosen", mode: /link/i.test(m[1]) ? "link" : "alone" }));
  ar(/^(?:it|this card) loses \[soulguard\]$/i, () => ({ op: "loseKw", kw: "soulguard" }));
  ar(/^your flag is (?:regarded|treated) as (?:both )?"([^"]+)" and "([^"]+)"$/i, (m) => ({ op: "flagAsWorlds", worlds: [m[1], m[2]] }));
  ar(/^put (?:it|that card|the chosen card) on your open (left|right|center)$/i, (m) => ({ op: "placeAt", pos: lc(m[1]) }));
  ar(/^swap (?:the )?(.+?) on your left and right$/i, (m) => ({ op: "swapLR" }));
  ar(/^move (?:a|one) monster on their left or right to the center$/i, () => ({ op: "oppToCenter" }));
  ar(/^drop a soul of a card on your opponent's field,? and destroy that card$/i, () => ({ op: "seq", steps: [{ op: "choose", np: { raw: "a card with a soul on your opponent's field", qty: { n: 1 }, filter: {}, zone: { owner: "opp", area: "field" }, hasSoul: true } }, { op: "dropSoul", hostNP: { ref: "chosen", qty: { n: 1 }, filter: {}, raw: "chosen" }, n: 1 }, { op: "destroy", np: { ref: "chosen", qty: { all: true, n: 99 }, filter: {}, raw: "that card" }, gate: "ifYouDo" }] }));
  ar(/^return all souls of a card on your opponent's field to their deck,? and shuffle it$/i, () => ({ op: "soulsToDeck" }));
  ar(/^(?:the )?damage you take (?:are|is) reduced by 1 for each time your flags? \[reversal\] during this fight$/i, () => ({ op: "shieldRev" }));
  ar(/^end this (phase|turn)$/i, (m) => /turn/i.test(m[1]) ? { op: "endTurnNow" } : { op: "endPhaseNow" });
  ABX.ACTION_RULES.unshift(...NEW_ACT);
  // tried only after every older rule (so the continuous protection auras keep their own reading)
  ABX.ACTION_RULES.push([/^(all cards|all monsters|all items|all «[^»]+»(?: monsters)?|all monsters with "[^"]+" in their card names) on your field cannot be (destroyed|returned to hand)(?:,? (?:or )?(returned to hand|leave the field))?(?:,? and their abilities cannot be nullified)?(?:,? (?:by|due to) your opponent's (?:card effects|cards))?$/i,
    (m) => { const np = NP(m[1] + " on your field"); if (!np) return null; const kinds = [lc(m[2])]; if (m[3]) kinds.push(lc(m[3])); if (/nullified/i.test(m[0])) kinds.push("nullified"); return { op: "restrict", np, kinds, byOpp: /opponent's/i.test(m[0]) }; }, false]);

  // trailing "... if you have five or more" etc. already handled; now the card-level post-processing
  function fixNP(np) {
    if (!np) return;
    const raw = String(np.raw || "");
    if (/for each time your flags? \[reversal\]/i.test(raw)) { np.qty = Object.assign({}, np.qty, { perReversal: true }); delete np.junk; if (np.filter) { delete np.filter.cardNames; if (np.filter.types && np.filter.types.includes("flag")) delete np.filter.types; } }
    if (np.junk === "up to one" && np.qty && np.qty.eachOf) { np.qty.upTo = true; delete np.junk; }
  }
  function postSteps(steps) {
    (steps || []).forEach(x => {
      fixNP(x.np);
      if (x.each && /time your flags? \[reversal\]/i.test(x.each.raw || "")) { x.each = { perReversal: true, raw: x.each.raw }; if (x.mods && x.mods.kws) x.mods.kws = x.mods.kws.filter(k => k !== "reversal"); }
      if (x.n && x.n.each && /time your flags? \[reversal\]/i.test(x.n.each.raw || "")) x.n.each = { perReversal: true };
      // "you may call this card without paying its [Call Cost]" parsed by the old rules as a call
      if (x.op === "call" && x.np && x.np.self && x.free && /^(?:this|this card)$/i.test(String(x.np.raw || "").trim())) { const c = x.cond; Object.keys(x).forEach(k => delete x[k]); Object.assign(x, { op: "freeCost", what: "call" }); if (c) x.cond = c; }
      if (x.op === "call" && x.np && !x.np.self) {
        const raw = String(x.np.raw || "");
        const REL = [[/\s*with (?:a )?different (?:card|character) names? (?:from|than) (?:that chosen card|the returned card|that card|the chosen card)/i, "diffName"],
          [/\s*with the same (?:card|character) name as (?:the card returned|the returned card|that card)/i, "sameName"],
          [/\s*of the same size as (?:that monster|that card|the destroyed monster)/i, "sameSize"], [/\s*that is not an impact monster/i, "notImpact"]];
        for (const [re, rel] of REL) {
          if (!re.test(raw)) continue;
          const np2 = ABX.parseNP(raw.replace(re, ""));
          if (!np2 || np2.junk) continue;
          np2.filter = Object.assign({}, np2.filter, rel === "notImpact" ? { notImpact: true } : { rel });
          x.np = np2;
        }
        // an effect that calls a card without saying "by paying its [Call Cost]" does not pay it
        if (!x.pay && !x.free && !x.np.ref) x.free = true;
        if (!x.np.zone && !x.np.ref && !x.np.self && !x.np.onTop) x.np.zone = { owner: "you", area: "hand" };
      }
      if (x.np && /\s*that (?:is|are) not in battle/i.test(String(x.np.raw || ""))) {
        const np2 = ABX.parseNP(String(x.np.raw).replace(/\s*that (?:is|are) not in battle/i, ""));
        if (np2 && !np2.junk) { np2.filter = Object.assign({}, np2.filter, { notInBattle: true }); x.np = np2; }
      }
      if (x.op === "seq") postSteps(x.steps);
      if (x.op === "either") x.opts.forEach(postSteps);
    });
    applyInstead(steps || []);
  }
  const palNow = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewrite2(rawLine);
    const ab = palNow.call(this, fixed, card);
    if (fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    postSteps(ab.steps);
    return ab;
  };
  // a static whose only effect is a free cost is "executable" (it is read by parseCardCost below)
  const origIsExec = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && ab.steps && ab.steps.length && ab.steps.every(x => x.op === "freeCost") && !(ab.unparsed && ab.unparsed.length))
      return (ab.conds || []).every(ABX.condExecutable) && ab.steps.every(x => !x.cond || ABX.condExecutable(x.cond));
    return origIsExec.call(this, ab);
  };

  /* ============================================================
   * 5. NEW EFFECTS
   * ============================================================ */
  const fresh = () => { try { B.renderBattle && B.renderBattle(); } catch (e) { /* ignore */ } };
  const say = (t) => { try { B.setPrompt && B.setPrompt(t); } catch (e) { /* ignore */ } };
  const isAuto = (ctx) => !!(ctx.auto || F(ctx.side).isBot || ABX.autoPlay === true || ABX.remoteAutoSide === ctx.side);
  const stepsOk = (steps) => (steps || []).every(x => ABX.stepExecutable(x));

  OPS.seq = {
    async run(s, ctx) { await core.runSteps(s.steps, ctx); return ctx.lastDone; },
    check: (s) => stepsOk(s.steps)
  };
  OPS.either = {
    async run(s, ctx) {
      let idx = 0;
      if (!isAuto(ctx)) idx = await ABX.ui.pickOption({ title: `${ctx.card.name} — choose one`, options: s.labels.map(l => ({ label: ABX.clean(l).slice(0, 160) })) });
      if (idx == null || idx < 0 || !s.opts[idx]) idx = 0;
      await core.runSteps(s.opts[idx], ctx);
      if (!ctx.lastDone && isAuto(ctx) && s.opts[1 - idx]) await core.runSteps(s.opts[1 - idx], ctx);   // bots: the other one if the first did nothing
      return ctx.lastDone;
    },
    check: (s) => Array.isArray(s.opts) && s.opts.length === 2 && s.opts.every(stepsOk)
  };
  OPS.dropOppGauge = {
    async run(s, ctx) {
      const e = ctx.e;
      let k = Math.min(s.n || 1, e.gauge.length);
      if (s.upTo && k > 0 && !isAuto(ctx)) {
        const opts = []; for (let i = k; i >= 0; i--) opts.push({ label: `Drop ${i}` });
        const i = await ABX.ui.pickOption({ title: `${ctx.card.name} — drop how many of your opponent's gauge?`, options: opts });
        if (i != null && i >= 0) k = k - i;
      }
      for (let i = 0; i < k; i++) e.drop.push(e.gauge.pop());
      ctx.lastCount = k;
      fresh(); return k > 0;
    },
    check: () => true
  };
  OPS.destroyBattleTarget = {
    run(s, ctx) {
      const b = battleNow(); if (!b || !b.defUnit) return false;
      const df = F(b.defSide), pos = posOfUnit(df, b.defUnit);
      if (!pos || pos === "item") return false;
      if (core.isProtected(b.defUnit, b.defSide, "destroyed", ctx)) return false;
      const ok = B.destroyMonster(b.defSide, pos) !== false; ctx.lastCount = ok ? 1 : 0; fresh(); return ok;
    },
    check: () => true
  };
  OPS.destroySet = {
    run(s, ctx) { const f = F(s.who === "opp" ? otherSide(ctx.side) : ctx.side); const n = (f.setSpells || []).length; f.drop.push(...f.setSpells.map(c => c.id)); f.setSpells = []; ctx.lastCount = n; fresh(); return n > 0; },
    check: () => true
  };
  OPS.lifeFloor = { run(s, ctx) { core.st(ctx.f).lifeFloor = B.turnCount; return true; }, check: () => true };
  OPS.noLose = { run(s, ctx) { ctx.f.abxNoLose = { side: ctx.side, turn: B.turnCount }; say(`🛡️ ${ctx.f.name || "You"} cannot lose until the start of the opponent's next turn!`); return true; }, check: () => true };
  OPS.unreducibleTurn = { run(s, ctx) { core.st(ctx.f).unreducibleTurn = B.turnCount; return true; }, check: () => true };
  OPS.freeCost = { run() { return true; }, check: () => true };
  const chosenUnits = (ctx) => (ctx.bind.chosen || []).filter(r => r.unit).map(r => r.unit);
  OPS.unnullChosen = { run(s, ctx) { const us = chosenUnits(ctx); us.forEach(u => { u.abxUnnull = { turn: B.turnCount, cond: s.alone ? "alone" : null }; if (s.noReduce) u.abxUnreducible = { turn: B.turnCount, alone: !!s.alone }; }); fresh(); return us.length > 0; }, check: () => true };
  OPS.noReduceChosen = { run(s, ctx) { const us = chosenUnits(ctx); us.forEach(u => { u.abxNoReduce = u.abxNoReduce || {}; s.stats.forEach(k => { u.abxNoReduce[k] = B.turnCount; }); }); return us.length > 0; }, check: (s) => (s.stats || []).length > 0 };
  OPS.noReduceAll = { run(s, ctx) { fieldUnits(ctx.f, true).forEach(x => { const u = x.unit; u.abxNoReduce = u.abxNoReduce || {}; s.stats.forEach(k => { u.abxNoReduce[k] = B.turnCount; }); }); return true; }, check: () => true };
  OPS.noCounterChosen = { run(s, ctx) { const us = chosenUnits(ctx); us.forEach(u => { u.abxNoCounter = { turn: B.turnCount, mode: s.mode }; }); return us.length > 0; }, check: () => true };
  ABX.noCounterThisBattle = function (attSide, units) {
    const us = (units || []).map(x => (x && x.unit) || x).filter(Boolean);
    return us.some(u => u.abxNoCounter && u.abxNoCounter.turn === B.turnCount && (u.abxNoCounter.mode === "link" ? us.length > 1 : us.length === 1));
  };
  OPS.loseKw = { run(s, ctx) { const u = ctx.unit; if (!u) return false; u.abxLost = u.abxLost || {}; u.abxLost[s.kw] = B.turnCount; return true; }, check: () => true };
  ABX.kwLost = (u, kw) => !!(u && u.abxLost && u.abxLost[kw] === B.turnCount);
  OPS.flagAsWorlds = { run(s, ctx) { ctx.f.abxFlagWorlds = { turn: B.turnCount, worlds: s.worlds.slice() }; return true; }, check: () => true };
  OPS.placeAt = {
    run(s, ctx) { const f = ctx.f; const r = (ctx.bind.chosen || []).find(x => x.unit && x.side === ctx.side); if (!r || f.monsters[s.pos]) return false; const from = posOfUnit(f, r.unit); if (!from || from === "item") return false; f.monsters[s.pos] = r.unit; f.monsters[from] = null; fresh(); return true; },
    check: () => true
  };
  OPS.swapLR = { run(s, ctx) { const f = ctx.f; const a = f.monsters.left, b = f.monsters.right; if (!a && !b) return false; f.monsters.left = b; f.monsters.right = a; fresh(); return true; }, check: () => true };
  OPS.oppToCenter = {
    async run(s, ctx) {
      const e = ctx.e; if (e.monsters.center) return false;
      const cands = ["left", "right"].filter(p => e.monsters[p]).map(p => ({ k: "unit", side: otherSide(ctx.side), unit: e.monsters[p], card: e.monsters[p].card, id: e.monsters[p].card.id, pos: p }));
      const ch = await core.pick(cands, { qty: { n: 1 }, raw: "a monster on their left or right" }, ctx, { intent: "harm", title: `${ctx.card.name} — move to the center` });
      if (!ch[0]) return false;
      e.monsters.center = ch[0].unit; e.monsters[ch[0].pos] = null; fresh(); return true;
    },
    check: () => true
  };
  OPS.soulsToDeck = {
    async run(s, ctx) {
      const e = ctx.e;
      const cands = fieldUnits(e, true).filter(x => (x.unit.soul || []).length).map(x => ({ k: x.pos === "item" ? "item" : "unit", side: otherSide(ctx.side), unit: x.unit, card: x.unit.card, id: x.unit.card.id }));
      const ch = await core.pick(cands, { qty: { n: 1 }, raw: "a card on your opponent's field" }, ctx, { intent: "harm", title: `${ctx.card.name} — return its souls` });
      if (!ch[0]) return false;
      const ids = ch[0].unit.soul.splice(0); e.deck.push(...ids);
      for (let i = e.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [e.deck[i], e.deck[j]] = [e.deck[j], e.deck[i]]; }
      ctx.lastCount = ids.length; fresh(); return ids.length > 0;
    },
    check: () => true
  };
  OPS.shieldRev = { run(s, ctx) { const n = typeof getFighterReversalCount === "function" ? getFighterReversalCount(ctx.f) : 0; if (!n) return false; core.st(ctx.f).shields.push({ mode: "turn", reduceBy: n, toZero: false, capTo: null, gainLife: 0, from: null, turn: B.turnCount }); return true; }, check: () => true };
  OPS.endPhaseNow = { run(s, ctx) { return OPS.endPhase.run({ phase: B.phase === "final" ? "final" : B.phase === "attack" ? "attack" : "main" }, ctx); }, check: () => !!OPS.endPhase };
  OPS.endTurnNow = { run(s, ctx) { return OPS.endPhase.run({ phase: "final" }, ctx); }, check: () => !!OPS.endPhase };
  // does `unit` have keyword `k` right now (printed, given for the turn, or by a continuous ability)?
  ABX.unitHasKw = function (fighter, unit, k) {
    if (!unit || !unit.card) return false;
    const t = { "penetrate": "tempPen", "double attack": "tempDA", "triple attack": "tempTA", "quadruple attack": "tempQA", "soulguard": "tempSG", "counterattack": "tempCA", "move": "tempMove" }[k];
    if (t && unit[t]) return true;
    const sb = ABX.staticBonus ? ABX.staticBonus(fighter, unit) : {};
    const key = { "penetrate": "pen", "double attack": "da", "triple attack": "ta", "quadruple attack": "qa", "soulguard": "sg", "counterattack": "ca", "move": "move", "weaponry link": "wl" }[k];
    return !!(key && sb[key]);
  };
  // "the chosen card's attacks cannot be nullified and its damage cannot be reduced if it is attacking alone"
  if (ABX.attackUnreducible) {
    const oau = ABX.attackUnreducible;
    ABX.attackUnreducible = function (attSide, units) {
      const us = (units || []).map(x => (x && x.unit) || x).filter(Boolean);
      if (us.some(u => u.abxUnreducible && u.abxUnreducible.turn === B.turnCount && (!u.abxUnreducible.alone || us.length === 1))) return true;
      return oau.apply(this, arguments);
    };
  }
  // "put cards from your drop zone into this card's soul until two cards are in its soul"
  OPS.soulFill = {
    async run(s, ctx) {
      const u = ctx.unit, f = ctx.f; if (!u) return false;
      const need = Math.max(0, (s.n || 1) - (u.soul || []).length);
      const arr = zoneArr(f, s.from || "drop zone");
      if (!need || !arr || !arr.length) return false;
      const cands = arr.map((id, idx) => ({ k: "zone", side: ctx.side, area: s.from === "drop zone" || !s.from ? "drop" : s.from, idx, id, card: cardOf(id) })).filter(r => r.card);
      const ch = await core.pick(cands, { qty: { n: need, upTo: true }, raw: "cards for this card's soul" }, ctx, { intent: "help", title: `${ctx.card.name} — put into its soul` });
      let n = 0;
      ch.forEach(r => { const i = arr.indexOf(r.id); if (i >= 0) { arr.splice(i, 1); u.soul.push(r.id); n++; } });
      ctx.lastCount = n; fresh(); return n > 0;
    },
    check: (s) => ["drop zone", "hand", "gauge"].includes(s.from || "drop zone")
  };

  // damage that "cannot be reduced" for the rest of the turn; next-time life floor
  const applyNow = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    src = src || {};
    const atk = F(otherSide(side));
    if (src.kind === "effect" && core.st(atk).unreducibleTurn === B.turnCount) src = Object.assign({}, src, { unreducible: true });
    const f = F(side), lifeBefore = f.life;
    const dealt = applyNow.call(this, side, n, src);
    const S = core.st(f);
    if (f.life <= 0 && lifeBefore > 0 && S.lifeFloor === B.turnCount) { f.life = 1; S.lifeFloor = null; say(`💫 ${f.name || "You"} stayed at 1 life!`); }
    return dealt;
  };
  // "you cannot lose the game" until the opponent's next turn starts
  wrap(B, "startTurn", function (side) { [B.plr, B.opp].forEach(f => { if (f && f.abxNoLose && f.abxNoLose.side !== side) f.abxNoLose = null; }); });
  if (typeof B.checkWinCondition === "function") {
    const ocw = B.checkWinCondition;
    B.checkWinCondition = function () {
      const saved = [];
      [B.plr, B.opp].forEach(f => { if (f && f.abxNoLose && f.life <= 0) { saved.push([f, f.life]); f.life = 1; } });
      try { return ocw.apply(this, arguments); } finally { saved.forEach(([f, l]) => { f.life = l; }); }
    };
  }

  // equip an item from a zone
  function payCost(f, card) {
    const cost = typeof parseCardCost === "function" ? parseCardCost(card.cost, card.skill, f, card) : { gauge: 0, life: 0 };
    if (f.gauge.length < (cost.gauge || 0) || (cost.life > 0 && f.life <= cost.life)) return false;
    for (let g = 0; g < (cost.gauge || 0); g++) f.drop.push(f.gauge.pop());
    if (cost.life > 0) f.life -= cost.life;
    return true;
  }
  const zoneArr = (f, a) => a === "drop zone" ? f.drop : a === "hand" ? f.hand : a === "deck" ? f.deck : a === "gauge" ? f.gauge : null;
  OPS.equipFrom = {
    async run(s, ctx) {
      const f = ctx.f;
      let cands = [];
      if (s.ref === "chosen") cands = (ctx.bind.chosen || []).filter(r => r.k === "zone" && r.card && r.card.type === "Item");
      else (s.from || ["drop zone"]).forEach(a => (zoneArr(f, a) || []).forEach((id, idx) => { const c = cardOf(id); if (c && c.type === "Item" && matchFilter(c, s.np.filter || {}, null, ctx)) cands.push({ k: "zone", side: ctx.side, area: a === "drop zone" ? "drop" : a, idx, id, card: c }); }));
      if (s.pay) cands = cands.filter(r => { const cost = parseCardCost(r.card.cost, r.card.skill, f, r.card); return f.gauge.length >= (cost.gauge || 0) && !(cost.life > 0 && f.life <= cost.life); });
      // [Release Condition!] items can only be equipped while their condition is met
      if (typeof getReleaseConditionStatus === "function") cands = cands.filter(r => getReleaseConditionStatus(r.card, f).met);
      if (typeof abilityMayEquip === "function") cands = cands.filter(r => abilityMayEquip(r.card, ctx.card));
      if (!cands.length) return false;
      const ch = await core.pick(cands, { qty: { n: 1, upTo: !!s.upTo }, raw: s.np.raw }, ctx, { intent: "help", title: `${ctx.card.name} — equip` });
      const r = ch[0]; if (!r) return false;
      if (s.pay && !payCost(f, r.card)) return false;
      const arr = f[r.area]; const i = arr.indexOf(r.id); if (i < 0) return false; arr.splice(i, 1);
      if ((s.from || []).includes("deck")) OPS.shuffle.run({ who: "you" }, ctx);
      if (f.item && !f.item.isEndrulerFlag) { f.drop.push(f.item.card.id, ...(f.item.soul || [])); }
      f.item = { card: r.card, rested: false, attacksLeft: r.card.atk_max || 1, soul: [] };
      cut("EQUIP!", r.card.name, r.card.img);
      fresh();
      if (ABX.fireEquipped) await ABX.fireEquipped(ctx.side, r.card, f.item);
      return true;
    },
    check: (s) => s.ref === "chosen" || (!!s.np && (s.from || []).every(a => ["drop zone", "hand", "deck"].includes(a)))
  };
  const cut = (a, b, img) => { try { if (B.showCutin && !ABX.fast) B.showCutin(a, b, img); } catch (e) { /* ignore */ } };
  // cast a spell from a zone (or the chosen card) by paying its [Cast Cost]
  OPS.castFrom = {
    async run(s, ctx) {
      const f = ctx.f;
      let r;
      if (s.ref === "chosen") r = (ctx.bind.chosen || []).find(x => x.k === "zone" && x.card && x.card.type === "Spell");
      else {
        const a = s.from || "drop zone";
        const cands = (zoneArr(f, a) || []).map((id, idx) => ({ k: "zone", side: ctx.side, area: a === "drop zone" ? "drop" : a, idx, id, card: cardOf(id) })).filter(x => x.card && x.card.type === "Spell" && matchFilter(x.card, s.np.filter || {}, null, ctx));
        r = (await core.pick(cands, { qty: { n: 1 }, raw: s.np.raw }, ctx, { intent: "help", title: `${ctx.card.name} — cast` }))[0];
      }
      if (!r) return false;
      const c = r.card;
      if (typeof evaluateCardConditions === "function" && !evaluateCardConditions(c, f, ctx.e).met) return false;
      if (s.pay && !payCost(f, c)) return false;
      const arr = f[r.area]; const i = arr.indexOf(r.id); if (i < 0) return false; arr.splice(i, 1);
      if (c.set) f.setSpells.push(c); else f.drop.push(c.id);
      cut("CAST!", c.name, c.img);
      fresh();
      for (const ab of core.abilitiesOf(c, a => a.kind === "spell" && ABX.isExecutable(a))) await core.runAbility(ctx.side, c, ab, null, { event: { name: "cast" } });
      if (ABX.fireCast) ABX.fireCast(ctx.side, c);
      return true;
    },
    check: (s) => s.ref === "chosen" || (!!s.np && ["drop zone", "hand"].includes(s.from))
  };
  // call this card from the soul it is in
  OPS.callFromSoul = {
    async run(s, ctx) {
      const f = ctx.f, host = ctx.soulHost, sr = ctx.selfRef;
      if (!host || !sr || sr.k !== "soul") return false;
      if (s.host && !refsFor(s.host, ctx, { owner: "you", area: "field" }).some(r => r.unit === host)) return false;
      const si = (host.soul || []).indexOf(ctx.card.id);
      if (si < 0) return false;
      const pos = core.SLOTS.find(p => !f.monsters[p]);
      if (!pos) { say("✖ No open monster area."); return false; }
      if (s.pay && !payCost(f, ctx.card)) return false;
      host.soul.splice(si, 1);
      f.hand.push(ctx.card.id);
      B.completeMonsterCall(ctx.side, pos, f.hand.length - 1, false, true);
      if (!f.monsters[pos]) return false;
      ctx.unit = f.monsters[pos]; ctx.calledPos = pos; ctx.soulHost = null; ctx.hostArea = "field";
      fresh(); return true;
    },
    check: (s) => !s.host || !s.host.junk
  };
  // [Act]s that a card in a soul can use (game.js shows them as buttons on the host's menu)
  ABX.soulActs = function (side, hostUnit) {
    const out = [];
    if (!hostUnit || !hostUnit.soul) return out;
    hostUnit.soul.forEach((id, idx) => {
      const c = cardOf(id); if (!c) return;
      core.abilitiesOf(c, a => a.kind === "act" && ABX.isExecutable(a) && (a.steps || []).some(x => x.op === "callFromSoul")).forEach(ab => out.push({ card: c, ab, idx }));
    });
    return out;
  };
  ABX.canUseSoulAct = function (side, hostUnit, card, ab) {
    const f = F(side);
    const ctx = { side, f, e: F(otherSide(side)), card, unit: null, ab, soulHost: hostUnit, hostArea: "soul", bind: { chosen: [{ k: "unit", side, unit: hostUnit, card: hostUnit.card, id: hostUnit.card.id }] }, lastDone: true, auto: true, log: [] };
    if (hostUnit.abxNullified === B.turnCount) return false;
    if (core.onceUsed(f, card, ab, null)) return false;
    if (!(ab.conds || []).every(c => evalCond(c, ctx))) return false;
    return !!core.SLOTS.find(p => !f.monsters[p]);
  };
  ABX.useSoulAct = async function (side, hostUnit, card, ab) {
    const f = F(side);
    const idx = hostUnit.soul.indexOf(card.id);
    if (idx < 0) return;
    core.markOnce(f, card, ab, null);
    cut("ABILITY!", card.name, card.img);
    await core.runAbility(side, card, ab, null, { event: { name: "act" }, hostArea: "soul", soulHost: hostUnit, selfRef: { k: "soul", side, unit: hostUnit, idx, id: card.id, card } });
    fresh();
  };

  // free [Call Cost] / [Cast Cost] when a "you may call/cast this without paying" static is active
  function freeCostActive(card, fighter, what) {
    if (!card || !fighter) return false;
    const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
    if (!side) return false;
    for (const ab of core.abilitiesOf(card, a => a.kind === "static" || a.kind === "spell")) {
      const st = (ab.steps || []).find(x => x.op === "freeCost" && x.what === what);
      if (!st) continue;
      const ctx = { side, f: fighter, e: F(otherSide(side)), card, unit: null, bind: { chosen: [] }, hostArea: "hand" };
      if (!(ab.conds || []).every(c => ABX.condExecutable(c) && evalCond(c, ctx))) continue;
      if (st.cond && !(ABX.condExecutable(st.cond) && evalCond(st.cond, ctx))) continue;
      return true;
    }
    return false;
  }
  ABX.freeCostActive = freeCostActive;
  if (typeof root.parseCardCost === "function") {
    const opcc = root.parseCardCost;
    root.parseCardCost = function (costStr, skill, fighter, card) {
      const r = opcc.apply(this, arguments);
      try {
        if (card && r && ((card.type === "Monster" && freeCostActive(card, fighter, "call")) || (card.type === "Spell" && freeCostActive(card, fighter, "cast")))) return Object.assign({}, r, { gauge: 0, life: 0, abxFree: true });
      } catch (e) { /* ignore */ }
      return r;
    };
    if (ABX.hasExtras) { const ohe = ABX.hasExtras; ABX.hasExtras = function (card) { const f = B.activeSide ? F(B.activeSide) : null; if (card && f && card.type === "Monster" && freeCostActive(card, f, "call")) return false; return ohe.apply(this, arguments); }; }
    if (ABX.canPayExtras) { const ocp = ABX.canPayExtras; ABX.canPayExtras = function (side, card) { if (card && card.type === "Monster" && freeCostActive(card, F(side), "call")) return true; return ocp.apply(this, arguments); }; }
  }


  /* ============================================================
   * 6. UNREAD TEXT, PART 1: triggers and common clauses
   * ============================================================ */
  // --- trigger wordings ---
  const NEW_TRIG = [];
  const tr = (re, fn) => NEW_TRIG.push([re, fn]);
  const withOf = (w) => {
    if (!w) return {};
    if (/^you$/i.test(w)) return { withYou: true };
    const t = w.replace(/^(?:another|an|a)\s+/i, "");
    const np = NP(t); return np ? { with: np } : { withBad: true };
  };
  tr(/^(?:when|whenever) this card link attacks(?: with (.+))?$/i, (m) => Object.assign({ event: "link", self: true }, withOf(m[1])));
  tr(/^at the end of the battle (?:that|in which) this card link attacked(?: with (.+))?$/i, (m) => Object.assign({ event: "battleEnd", self: true, link: true }, withOf(m[1])));
  tr(/^at the end of this card's battle$/i, () => ({ event: "battleEnd", self: true }));
  tr(/^when this card is dropped from (?:your )?hand(?: by (?:a )?card effects?)?$/i, () => ({ event: "discardedFromHand", self: true }));
  tr(/^when this card (?:enters your field|is put on(?:to)? (?:the|your) field)$/i, () => ({ event: "enter", self: true }));
  tr(/^when this card enters the field on (?:your |the )?(left|right|center)(?: or (?:your |the )?(left|right|center))?$/i, (m) => ({ event: "enter", self: true, pos: [m[1], m[2]].filter(Boolean).map(lc) }));
  tr(/^when this card is destroyed by (?:a |your |your opponent's |an opponent's )?(?:card|monster|spell)(?: card)? effects?$/i, () => ({ event: "leave", self: true, destroyedOnly: true, byEffect: true }));
  tr(/^when you \[(?:transform|ride)\] (?:into|on) this card$/i, () => ({ event: "equipped", self: true }));
  tr(/^(?:when|whenever) (?:your |the |a |an )(.+?) with this card in its soul attacks$/i, (m) => { const np = NP(m[1]); return np ? { event: "hostAttack", np } : null; });
  tr(/^when you are attacked$/i, () => ({ event: "oppAttack", fighterTarget: true }));
  tr(/^when (?:a|an) (?:card|monster) on your opponent's field attacks$/i, () => ({ event: "oppAttack" }));
  ABX.TRIGGER_RULES.unshift(...NEW_TRIG);
  ABX.linkWithOK = function (t, unit, units, attSide) {
    if (t.withBad) return false;
    const others = (units || []).map(x => (x && x.unit) || x).filter(u => u && u !== unit);
    const f = F(attSide);
    if (t.withYou) return others.some(u => u === f.item);
    if (t.with) return others.some(u => matchFilter(u.card, t.with.filter || {}, { unit: u, side: attSide }, { f }));
    return true;
  };
  // trigger rewrites (text)
  function rewrite3(s) {
    s = s.replace(/\bwhen this card enters the field during (your|the) (final|main|attack) phase,\s*/ig, "During $1 $2 phase, when this card enters the field, ");
    s = s.replace(/\bwhen this card is put (?:into (?:your|the) drop zone from (?:your|the) field|from (?:your|the) field (?:into|to) (?:your|the) drop zone)\b/ig, "When this card is put from the field into the drop zone");
    s = s.replace(/\bwhen another (.+?) enters your field\b/ig, "When a $1 enters your field");
    s = s.replace(/\bwhen your opponent's monster is destroyed by an attack\b/ig, "When a monster on your opponent's field is destroyed by an attack");
    // clauses
    s = s.replace(/\bput the rest on the bottom of the deck\b/ig, "put the rest on the bottom of your deck");
    s = s.replace(/\bfrom your drop zone to deck\b/ig, "from your drop zone to your deck");
    s = s.replace(/(^|[,.]\s*|\band\s+)you draw\b/ig, "$1draw");
    s = s.replace(/\bthis card's attacks cannot be nullified\b/ig, "this card's attack cannot be nullified");
    s = s.replace(/\bnullify abilities of\b/ig, "nullify all abilities of");
    s = s.replace(/\bplay "rock-paper-scissors?" with your opponent(?: once| only once)?\b/ig, 'play "Rock-Paper-Scissors" with your opponent');
    return s;
  }
  const prevRw2 = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite3(prevRw2(t));
  const palNow2 = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewrite3(rawLine);
    const ab = palNow2.call(this, fixed, card);
    if (fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    fixElse(ab.steps);
    return ab;
  };
  // "If it is a monster, A. If it is not, B." -> B when the previous condition is false
  function fixElse(steps) {
    let last = null;
    (steps || []).forEach(x => {
      if (!x.cond) return;
      if (x.cond.t === "xElse") { if (last) { const c = last; Object.keys(x.cond).forEach(k => delete x.cond[k]); Object.assign(x.cond, { t: "not", c }); } return; }
      if (x.cond.t !== "not" || !x.cond.__else) last = x.cond;
    });
  }
  // --- "When this card A or B": two abilities with the same effect ---
  const origParseCard = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = origParseCard.apply(this, arguments);
    const out = [];
    r.abilities.forEach(ab => {
      const t = ab.trigger;
      if (!(t && t.event === "unknown" && t.src)) { out.push(ab); return; }
      const m = ABX.norm(t.src).match(/^(when|whenever) this card (.+?),? or (?:when |whenever )?(?:this card |it )?(.+)$/i);
      if (!m) { out.push(ab); return; }
      const body = String(ab.cleaned || "").slice(String(ab.cleaned || "").indexOf(t.src) + t.src.length).replace(/^,\s*/, "");
      const name = ab.name ? '"' + ab.name + '" ' : "";
      const onceTxt = ab.once ? " This ability only activates once per " + ab.once + "." : "";
      const a1 = ABX.parseAbilityLine(name + "When this card " + m[2] + ", " + body + onceTxt, card);
      const a2 = ABX.parseAbilityLine(name + "When this card " + m[3] + ", " + body + onceTxt, card);
      const ok = (a) => a.trigger && a.trigger.event !== "unknown" && !(a.unparsed && a.unparsed.length);
      if (!ok(a1) || !ok(a2)) { out.push(ab); return; }
      [a1, a2].forEach(a => { a.raw = ab.raw; a.kind = ab.tags && ab.tags.includes("act") ? "act" : "triggered"; if (ab.once && !ab.name) a.name = "__or:" + card.id + ":" + out.length; out.push(a); });
    });
    r.abilities = out;
    return r;
  };
  // --- "When the «X» with this card in its soul attacks" (abilities of soul cards) ---
  const ofa = ABX.fireAttack;
  ABX.fireAttack = function (attSide, units, defSide, targetPos) {
    const p = ofa.apply(this, arguments);
    ABX.queue(async () => {
      const f = F(attSide);
      for (const x of units || []) {
        const host = x && x.unit; if (!host || !(host.soul || []).length) continue;
        for (const id of host.soul.slice()) {
          const c = cardOf(id); if (!c) continue;
          for (const ab of core.abilitiesOf(c, a => a.kind === "triggered" && a.trigger && a.trigger.event === "hostAttack" && ABX.isExecutable(a))) {
            if (ab.trigger.np && !matchFilter(host.card, ab.trigger.np.filter || {}, { unit: host, side: attSide }, { f })) continue;
            if (host.abxNullified === B.turnCount || core.onceUsed(f, c, ab, host)) continue;
            const idx = host.soul.indexOf(id); if (idx < 0) continue;
            const selfRef = { k: "soul", side: attSide, unit: host, idx, id, card: c };
            const probe = { side: attSide, f, e: F(otherSide(attSide)), card: c, unit: null, ab, soulHost: host, hostArea: "soul", selfRef, bind: { chosen: [{ k: "unit", side: attSide, unit: host, card: host.card, id: host.card.id }] }, lastDone: true, auto: true, log: [] };
            if (!(ab.conds || []).every(cd => evalCond(cd, probe))) continue;
            core.markOnce(f, c, ab, host);
            cut("ABILITY!", c.name, c.img);
            const ctx = await core.runAbility(attSide, c, ab, null, { event: { name: "attack" }, hostArea: "soul", soulHost: host, selfRef });
            if (B.matchOver) return;
          }
        }
      }
    });
    return p;
  };

  // --- clause rules ---
  const ACT3 = [];
  const ar3 = (re, fn) => ACT3.push([re, fn, false]);
  ar3(/^shuffle (?:it|them|your deck|the deck)$/i, () => ({ op: "shuffle", who: "you" }));
  ar3(/^deal (\d+|one|two|three|four|five) damage$/i, (m) => ({ op: "damage", who: "opp", n: toNum(m[1]) }));
  ar3(/^look at the top card of your deck$/i, () => ({ op: "look", n: 1, who: "you" }));
  ar3(/^(?:you may )?cast this card without paying (?:its|the) \[cast cost\]$/i, () => ({ op: "freeCost", what: "cast" }));
  ar3(/^deal damage to (?:your|the) opponent equal to (?:that card's|its|the chosen card's|the revealed card's) (critical|power|size)$/i, (m) => ({ op: "damage", who: "opp", n: { refStat: lc(m[1]) } }));
  ar3(/^(it|this card|that card|the chosen card|they|these cards|all (.+?)) can (?:also )?attack during (?:this|the|your) final phase$/i, (m) => ({ op: "finalAttack", who: /^all /i.test(m[1]) ? "np" : /^(this card)$/i.test(m[1]) ? "self" : "chosen", np: m[2] ? NP(m[2]) : null }));
  ar3(/^you cannot be dealt damage(?: (by card effects|by attacks))?$/i, (m) => ({ op: "shield", mode: "turn", toZero: true, from: m[1] ? (/effects/i.test(m[1]) ? "effect" : "attack") : null }));
  ar3(/^play "rock-paper-scissors" with your opponent$/i, () => ({ op: "rps" }));
  ar3(/^your opponent cannot \[counter\] during the battle that this card is attacking alone$/i, () => ({ op: "noCounterSelf" }));
  ABX.ACTION_RULES.unshift(...ACT3);
  // --- clause conditions ---
  const C3 = [];
  const cr3 = (re, fn) => C3.push([re, fn]);
  cr3(/^(?:it|that card) is (?:a|an) (monster|spell|item|impact)(?: card)?$/i, (m) => ({ t: "refType", type: lc(m[1]) }));
  cr3(/^(?:it is not|not|it is not so|otherwise|they are not|it was not)$/i, () => ({ t: "xElse" }));
  cr3(/^you do not have (?:a|any) monsters? (?:in|on) (?:the|your) center$/i, () => ({ t: "xCenterEmpty", who: "you" }));
  cr3(/^you win$/i, () => ({ t: "xRps", v: "win" }));
  cr3(/^you lose$/i, () => ({ t: "xRps", v: "lose" }));
  cr3(/^you (?:didn't|did not|do not) lose$/i, () => ({ t: "xRps", v: "notLose" }));
  cr3(/^(?:it is a tie|it's a tie|you tie|it is a draw)$/i, () => ({ t: "xRps", v: "tie" }));
  ABX.COND_RULES.unshift(...C3);
  XC.xElse = () => false;   // replaced at parse time by "not <previous condition>"
  XC.xRps = (c, ctx) => { const r = ctx.rps; if (!r) return false; return c.v === "notLose" ? r !== "lose" : r === c.v; };
  addOk("xElse", "xRps");

  // --- new effects ---
  OPS.finalAttack = {
    run(s, ctx) {
      let us = [];
      if (s.who === "self") us = ctx.unit ? [ctx.unit] : [];
      else if (s.who === "np") us = s.np ? refsFor(s.np, ctx, { owner: "you", area: "field" }).filter(r => r.unit).map(r => r.unit) : [];
      else us = chosenUnits(ctx).length ? chosenUnits(ctx) : (ctx.unit ? [ctx.unit] : []);
      us.forEach(u => { u.canAttackFinal = true; if (!u.rested) u.attacksLeft = Math.max(u.attacksLeft || 0, 1); });
      fresh(); return us.length > 0;
    },
    check: (s) => s.who !== "np" || !!s.np
  };
  OPS.noCounterSelf = { run(s, ctx) { if (!ctx.unit) return false; ctx.unit.abxNoCounter = { turn: B.turnCount, mode: "alone" }; return true; }, check: () => true };
  const RPS = ["✊ Rock", "✋ Paper", "✌️ Scissors"];
  OPS.rps = {
    async run(s, ctx) {
      for (let round = 0; round < 5; round++) {
        let me = Math.floor(Math.random() * 3);
        if (!isAuto(ctx)) { const i = await ABX.ui.pickOption({ title: `${ctx.card.name} — Rock-Paper-Scissors!`, subtitle: "Choose your hand.", options: RPS.map(l => ({ label: l })) }); if (i != null && i >= 0) me = i; }
        const opp = Math.floor(Math.random() * 3);   // the other player's hand is picked at random (their device / the bot can't be asked here)
        const res = me === opp ? "tie" : (me + 1) % 3 === opp ? "lose" : "win";
        say(`✊✋✌️ ${RPS[me]} vs ${RPS[opp]} — ${res === "win" ? "you WIN!" : res === "lose" ? "you lose." : "tie, again!"}`);
        if (res !== "tie" || /once/i.test(s.src || "")) { ctx.rps = res; return true; }
      }
      ctx.rps = "tie"; return true;
    },
    check: () => true
  };


  /* ============================================================
   * 7. UNREAD TEXT, PART 2
   * ============================================================ */
  // --- triggers ---
  const T4 = [];
  const tr4 = (re, fn) => T4.push([re, fn]);
  tr4(/^when this card \[(?:ride|transform)\]$|^when you \[(?:transform|ride)\] (?:into|on) it$/i, () => ({ event: "equipped", self: true }));
  tr4(/^when this card enters on the (left|right|center)$/i, (m) => ({ event: "enter", self: true, pos: [lc(m[1])] }));
  tr4(/^when this hand card is (?:dropped|discarded)$/i, () => ({ event: "discardedFromHand", self: true }));
  tr4(/^when you gained life$/i, () => ({ event: "lifeGain", who: "you" }));
  tr4(/^when this card is destroyed by (?:an |your opponent's )?attacks?$/i, () => ({ event: "leave", self: true, destroyedOnly: true, byAttackOnly: true }));
  tr4(/^when this card is destroyed by the effect of (?:a|an|your opponent's) (?:monster|card|spell)$/i, () => ({ event: "leave", self: true, destroyedOnly: true, byEffect: true }));
  tr4(/^when this card is put from the field$/i, () => ({ event: "leave", self: true }));
  tr4(/^when this card is \[stand\] by (?:a )?card effects?$/i, () => ({ event: "stoodByEffect", self: true }));
  ABX.TRIGGER_RULES.unshift(...T4);
  // [Stand] by card effects: fire for units an ABX effect stood up
  const ostand = OPS.stand.run;
  OPS.stand.run = async function (s, ctx) {
    const before = new Map();
    ["plr", "opp"].forEach(sd => fieldUnits(F(sd), true).forEach(x => before.set(x.unit, { rested: !!x.unit.rested, side: sd })));
    const res = await ostand.call(this, s, ctx);
    for (const [u, b] of before) {
      if (!b.rested || u.rested) continue;
      for (const ab of core.abilitiesOf(u.card, a => a.kind === "triggered" && a.trigger && a.trigger.event === "stoodByEffect" && ABX.isExecutable(a))) {
        const f = F(b.side);
        if (u.abxNullified === B.turnCount || core.onceUsed(f, u.card, ab, u)) continue;
        core.markOnce(f, u.card, ab, u);
        ABX.queue(() => core.runAbility(b.side, u.card, ab, u, { event: { name: "stood" } }));
      }
    }
    return res;
  };

  // --- "Then, if five or more, ..." repeats the last count condition with a new number ---
  const C4 = [];
  const cr4 = (re, fn) => C4.push([re, fn]);
  cr4(new RegExp("^" + NUM + " or more$", "i"), (m) => ({ t: "xChainMore", n: N(m[1]) }));
  cr4(/^you destroyed(?: (?:a|an|one|any) .+)?$|^you called(?: (?:a|an|one) .+)?$|^put$|^you put a card into your hand$|^called$/i, () => ({ t: "xLastCount", n: 1 }));
  cr4(/^you are \[station\] at (?:a |an )?card$/i, () => ({ t: "xItemMode", mode: "st" }));
  cr4(/^you are \[transform\] into (?:a|an) card$/i, () => ({ t: "xItemMode", mode: "tr" }));
  cr4(/^your flags? (?:is|are) in \[reversal\]$/i, () => ({ t: "reversal", n: 1, cmp: "ge" }));
  cr4(/^during each player's (attack|main|final) phase and (attack|main|final) phase$/i, (m) => ({ t: "or", list: [{ t: "phase", phase: lc(m[1]) }, { t: "phase", phase: lc(m[2]) }] }));
  cr4(/^during the battle (?:that|in which) this card is attacking alone$/i, () => ({ t: "xAlone" }));
  cr4(/^during the battle of this card$|^this card is in battle$/i, () => ({ t: "xOwnBattle" }));
  cr4(/^there is a card of the declared (?:card )?type among them$/i, () => ({ t: "xDeclared", among: true }));
  cr4(/^(?:that card|it|the revealed card|the dropped card) is (?:of )?the declared (?:card )?type$/i, () => ({ t: "xDeclared" }));
  ABX.COND_RULES.unshift(...C4);
  XC.xChainMore = () => false;   // replaced at parse time
  XC.xOwnBattle = (c, ctx) => { const b = battleNow(); return !!(b && ctx.unit && ((b.attUnits || []).includes(ctx.unit) || b.defUnit === ctx.unit)); };
  const typeIs = (card, t) => !!card && (t === "monster" ? core.isMonsterCard(card) : t === "spell" ? card.type === "Spell" : t === "item" ? card.type === "Item" : card.type === "Impact");
  XC.xDeclared = (c, ctx) => {
    if (!ctx.declared) return false;
    const refs = [].concat(ctx.bind.looked || [], ctx.bind.revealed || [], ctx.bind.chosen || []).filter(r => r && r.card);
    return c.among ? refs.some(r => typeIs(r.card, ctx.declared)) : (refs.length > 0 && typeIs(refs[refs.length - 1].card, ctx.declared));
  };
  addOk("xChainMore", "xOwnBattle", "xDeclared");
  const NUMERIC = (c) => c && typeof c.n === "number" && c.t !== "xChainMore" && c.t !== "xLastCount";
  function findNumeric(c) { if (!c) return null; if (NUMERIC(c) && c.cmp !== "le" && c.cmp !== "eq") return c; if (c.list) { for (const x of c.list) { const r = findNumeric(x); if (r) return r; } } if (c.c) return findNumeric(c.c); return null; }
  function replaceChain(c, base) {
    if (!c) return;
    if (c.t === "xChainMore") { if (base) { const n = c.n; Object.keys(c).forEach(k => delete c[k]); Object.assign(c, JSON.parse(JSON.stringify(base)), { n, cmp: "ge" }); } return; }
    (c.list || []).forEach(x => replaceChain(x, base));
    if (c.c) replaceChain(c.c, base);
  }
  function fixChains(steps, conds) {
    let base = null;
    (conds || []).forEach(c => { const b = findNumeric(c); if (b) base = b; });
    (steps || []).forEach(x => {
      if (x.cond) { replaceChain(x.cond, base); const b = findNumeric(x.cond); if (b) base = b; }
      if (x.op === "seq") fixChains(x.steps, []);
    });
  }

  // --- clauses ---
  const A4 = [];
  const ar4 = (re, fn) => A4.push([re, fn, false]);
  ar4(/^(?:you may )?reveal this (?:hand )?card(?: from your hand)?$/i, () => ({ op: "noop", note: "reveal" }));
  ar4(/^declare (?:a|one) card type(?: \(monster, spell, item(?:,| or) impact\))?$|^declare either monster or spell$/i, (m) => ({ op: "declareType", two: /either/i.test(m[0]) }));
  ar4(/^pay (\d+|one|two|three) gauge and (\d+|one|two|three) life$/i, (m) => ({ op: "pay", gauge: toNum(m[1]), life: toNum(m[2]), cost: true }));
  ar4(/^drop (?:up to )?the top (\w+) cards? of your opponent's deck$/i, (m) => ({ op: "mill", who: "opp", n: toNum(m[1]), to: "drop zone" }));
  ar4(/^your opponent cannot (?:use|cast|use or cast) \[counter\]$/i, () => ({ op: "oppNoCounter" }));
  ar4(/^change the target of the attack to your (center|left|right) (.+)$/i, (m) => ({ op: "redirectPos", pos: lc(m[1]), np: NP(m[2]) }));
  ar4(/^deal (\d+|one|two) damage to you or your opponent$/i, (m) => ({ op: "either", opts: [[{ op: "damage", who: "opp", n: toNum(m[1]) }], [{ op: "damage", who: "you", n: toNum(m[1]) }]], labels: ["Deal " + m[1] + " damage to your opponent", "Deal " + m[1] + " damage to yourself"] }));
  ar4(/^your opponent cannot gain life$/i, () => ({ op: "noLifeGain" }));
  ABX.ACTION_RULES.unshift(...A4);
  function rewrite4(s) {
    s = s.replace(/(^|[.!,]\s+|\]\s+)during this turn,\s*/ig, "$1for this turn, ");
    s = s.replace(/\breturn (.+?) on your opponent's field to the hand\b/ig, "return $1 on your opponent's field to hand");
    return s;
  }
  const prevRw3 = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite4(prevRw3(t));
  const palNow3 = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewrite4(rawLine);
    const ab = palNow3.call(this, fixed, card);
    if (fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    fixChains(ab.steps, ab.conds);
    return ab;
  };
  // "When this card enters the field or when you [Transform] into it": the second trigger has its own subject
  const pcOr = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcOr.apply(this, arguments);
    const out = [];
    r.abilities.forEach(ab => {
      const t = ab.trigger;
      const m = t && t.event === "unknown" && t.src && ABX.norm(t.src).match(/^(when|whenever) this card (.+?),? or (?:when |whenever )?((?:you|your|a|an|another) .+)$/i);
      if (!m) { out.push(ab); return; }
      const body = String(ab.cleaned || "").slice(String(ab.cleaned || "").indexOf(t.src) + t.src.length).replace(/^,\s*/, "");
      const onceTxt = ab.once ? " This ability only activates once per " + ab.once + "." : "";
      const a1 = ABX.parseAbilityLine("When this card " + m[2] + ", " + body + onceTxt, card);
      const a2 = ABX.parseAbilityLine("When " + m[3] + ", " + body + onceTxt, card);
      const ok = (a) => a.trigger && a.trigger.event !== "unknown" && !(a.unparsed && a.unparsed.length);
      if (!ok(a1) || !ok(a2)) { out.push(ab); return; }
      [a1, a2].forEach(a => { a.raw = ab.raw; a.kind = "triggered"; if (ab.once) a.name = "__or:" + card.id + ":" + out.length; out.push(a); });
    });
    r.abilities = out;
    return r;
  };

  // --- effects ---
  OPS.declareType = {
    async run(s, ctx) {
      const types = s.two ? ["monster", "spell"] : ["monster", "spell", "item", "impact"];
      let i = 0;
      if (!isAuto(ctx)) { const k = await ABX.ui.pickOption({ title: `${ctx.card.name} — declare a card type`, options: types.map(t => ({ label: t[0].toUpperCase() + t.slice(1) })) }); if (k != null && k >= 0) i = k; }
      ctx.declared = types[i];
      say(`📢 ${ctx.f.name || "You"} declared: ${types[i].toUpperCase()}`);
      return true;
    },
    check: () => true
  };
  OPS.oppNoCounter = {
    run(s, ctx) { const e = ctx.e; if (s.duration === "battle" || battleNow()) e.timeStoppedThisBattle = true; else e.timeStoppedThisTurn = true; say(`⛔ ${e.name || "Your opponent"} cannot use [Counter]!`); return true; },
    check: () => true
  };
  OPS.noCounter.run = function (s, ctx) { return OPS.oppNoCounter.run(s, ctx); };   // was a no-op
  OPS.redirectPos = {
    run(s, ctx) {
      const bc = ABX.battleCtx; const u = ctx.f.monsters[s.pos];
      if (!bc || !bc.active || !u) return false;
      if (s.np && !matchFilter(u.card, s.np.filter || {}, { unit: u, side: ctx.side }, ctx)) return false;
      bc.redirectTo = s.pos; say(`🎯 The attack's target was changed to "${u.card.name}"!`); return true;
    },
    check: () => true
  };
  OPS.noLifeGain = { run() { return true; }, check: () => true };   // continuous; read by ABX.lifeGainBlocked
  ABX.lifeGainBlocked = function (f) {
    const side = B.plr === f ? "plr" : B.opp === f ? "opp" : null;
    if (!side) return false;
    const other = F(otherSide(side));
    return fieldUnits(other, true).some(x => x.unit.abxNullified !== B.turnCount && core.abilitiesOf(x.unit.card, a => a.kind === "static").some(a => (a.steps || []).some(st => st.op === "noLifeGain") && (a.conds || []).every(c => ABX.condExecutable(c) && evalCond(c, { side: otherSide(side), f: other, e: f, card: x.unit.card, unit: x.unit, bind: { chosen: [] } }))));
  };
  // statics made only of "passive" effects are executable
  const PASSIVE = new Set(["freeCost", "noLifeGain"]);
  const ie2 = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && ab.steps && ab.steps.length && ab.steps.every(x => PASSIVE.has(x.op)) && !(ab.unparsed && ab.unparsed.length))
      return (ab.conds || []).every(ABX.condExecutable) && ab.steps.every(x => !x.cond || ABX.condExecutable(x.cond));
    return ie2.call(this, ab);
  };
  // "cannot use [Counter]" also closes the spell / call response window
  if (ABX.castWindow) { const ocw2 = ABX.castWindow; ABX.castWindow = function (casterSide, card, kind) { const r = F(otherSide(casterSide)); if (r && (r.timeStoppedThisTurn || r.timeStoppedThisBattle)) return Promise.resolve(false); return ocw2.apply(this, arguments); }; }


  /* ============================================================
   * 8. REPLACEMENT EFFECTS: "If this card would be destroyed / leave the field, you may …
   *    If you do, this card remains on the field" and "If your life would become 0, …"
   *    These run in the middle of a destroy / a loss check, so they run synchronously:
   *    the owner answers yes / no (bots and the online friend's cards decide by themselves),
   *    and cards to pay with are picked automatically (the least valuable ones).
   * ============================================================ */
  const T5 = [];
  T5.push([/^if (?:another|a|an) (.+?) on your field would (?:be destroyed|leave the field)(?: and be put into the drop zone)?(?: by your opponent's (?:card effects|cards|card|effects?))?$/i, (m) => { const np = NP(m[1] + " on your field"); return np ? { event: "wouldLeaveOther", np, byOpp: /opponent/i.test(m[0]) } : null; }]);
  T5.push([/^if this card would (?:leave the field|be destroyed)(?: by your opponent's (?:card effects|cards|card|effects?))$/i, (m) => ({ event: "wouldLeave", self: true, byOppOnly: true })]);
  ABX.TRIGGER_RULES.unshift(...T5);
  const A5 = [];
  A5.push([/^nullify its destruction$|^(?:it|this card|that card) remains on (?:the|your) field$/i, () => ({ op: "preventLeave" }), false]);
  A5.push([/^put the top (\w+) cards? of your deck into (?:your|the) drop zone$/i, (m) => ({ op: "mill", who: "you", n: toNum(m[1]), to: "drop zone" }), false]);
  A5.push([/^(?:for this turn,? )?if your life would become 0(?: with that impact| by (?:an|that) (?:attack|impact))?,? (?:it|your life) becomes 1(?: instead)?$/i, () => ({ op: "lifeFloor", persist: true }), true]);
  A5.push([/^if your life would become 0(?: with that impact)?,? (?:it|your life) becomes 1(?: instead)?$/i, () => ({ op: "lifeFloor", persist: true }), false]);
  ABX.ACTION_RULES.unshift(...A5);
  OPS.lifeFloor.run = function (s, ctx) { const S = core.st(ctx.f); S.lifeFloor = B.turnCount; S.lifeFloorPersist = !!s.persist; return true; };
  // keep a turn-long floor ("for this turn, if your life would become 0, it becomes 1 instead")
  const apFloor = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    const f = F(side), S = core.st(f), keep = S.lifeFloorPersist && S.lifeFloor === B.turnCount;
    const r = apFloor.apply(this, arguments);
    if (keep && S.lifeFloor == null) S.lifeFloor = B.turnCount;
    return r;
  };

  const REPL = new Set(["wouldLeave", "wouldDie", "wouldLeaveOther"]);
  // these run through ABX.wouldLeaveSave / runSync (below), not fireTriggers; listed so code asking "is this trigger supported?" keeps them
  REPL.forEach(e => { ABX.TRIG_OK[e] = () => true; });
  // "If this card would ..., <effect>" starts with "if", so the normal parser never looks for a trigger there
  const palRepl = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const ab = palRepl.apply(this, arguments);
    try {
      const txt = ABX.norm(ABX.clean(rawLine));
      const pm = txt.match(/^((?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?)(if (?:this card|your life|another|a|an) .+)$/i);
      if (!pm || !/\bwould\b/i.test(pm[2])) return ab;
      const body = pm[2];
      const commas = [...body.matchAll(/,\s*/g)];
      for (const cm of commas) {
        const head = body.slice(0, cm.index);
        let trig = null;
        for (const [re, fn] of ABX.TRIGGER_RULES) { const mm = head.match(re); if (mm) { const t = fn(mm); if (t && REPL.has(t.event)) { trig = t; break; } } }
        if (!trig) continue;
        const rest = body.slice(cm.index + cm[0].length);
        const ab2 = palRepl.call(this, pm[1] + "When this card enters the field, " + rest, card);
        if (ab2.unparsed && ab2.unparsed.length) return ab;
        ab2.trigger = Object.assign(trig, { src: head });
        ab2.kind = "triggered"; ab2.raw = ab.raw; ab2.cleaned = ab.cleaned;
        return ab2;
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    return ab;
  };
  const valueOf = (c) => !c ? 0 : (c.power || 0) / 1000 + (c.defense || 0) / 2000 + (c.crit || 0) * 2 + (c.size || 0) + (c.type === "Monster" ? 1 : 0);
  const remoteSide = (side) => B.mode === "online_p2p" && side === "opp";
  const autoSide = (side) => F(side).isBot || ABX.autoPlay === true || remoteSide(side);
  function askYes(side, card, text) {
    if (autoSide(side)) return true;
    try { return typeof root.confirm === "function" ? !!root.confirm(`${card.name}: ${text}`) : true; } catch (e) { return true; }
  }
  const leastValuable = (ids, n) => ids.map((id, i) => ({ id, i, v: valueOf(cardOf(id)) })).sort((a, b) => a.v - b.v).slice(0, n);
  const SYNC = {
    pay(s, ctx) { const f = ctx.f; if ((s.gauge || 0) > f.gauge.length || (s.life && f.life <= s.life)) return false; for (let i = 0; i < (s.gauge || 0); i++) f.drop.push(f.gauge.pop()); if (s.life) f.life -= s.life; return true; },
    discard(s, ctx) {
      const f = ctx.f, n = s.all ? f.hand.length : (s.n || 1);
      const ok = f.hand.map((id, i) => ({ id, i })).filter(x => !s.np || !s.np.filter || matchFilter(cardOf(x.id), s.np.filter, null, ctx));
      if (ok.length < n) return false;
      const pick = leastValuable(ok.map(x => x.id), n).map(x => x.id);
      pick.forEach(id => { const i = f.hand.indexOf(id); if (i >= 0) { f.hand.splice(i, 1); f.drop.push(id); } });
      ctx.lastCount = pick.length; return true;
    },
    dropSoul(s, ctx) { const u = ctx.unit; if (!u || !(u.soul || []).length) return false; const n = Math.min(s.n || 1, u.soul.length); if ((s.n || 1) > u.soul.length) return false; for (let i = 0; i < n; i++) ctx.f.drop.push(u.soul.pop()); ctx.lastCount = n; return true; },
    mill(s, ctx) { const f = F(s.who === "opp" ? otherSide(ctx.side) : ctx.side); const n = typeof s.n === "number" ? s.n : 1; if (f.deck.length < n) return false; const ids = f.deck.splice(0, n); if (s.to === "gauge") f.gauge.push(...ids); else { f.drop.push(...ids); if (ABX.fireDeckToDrop) ABX.fireDeckToDrop(s.who === "opp" ? otherSide(ctx.side) : ctx.side, ids); } ctx.bind.revealed = ids.map(id => ({ k: "zone", side: ctx.side, area: "drop", id, card: cardOf(id) })); ctx.bind.chosen = ctx.bind.revealed.slice(); ctx.lastCount = ids.length; return ids.length === n; },
    moveSelf(s, ctx) { return removeSelf(ctx); },
    move(s, ctx) { if (s.np && s.np.self && s.to && s.to.area === "drop zone") return removeSelf(ctx); return false; },
    destroy(s, ctx) {
      if (!s.np) return false;
      if (s.np.self) return removeSelf(ctx);
      const cands = refsFor(s.np, ctx, { owner: "you", area: "field" }).filter(r => r.unit && r.unit !== ctx.protect && r.side === ctx.side);
      if (!cands.length) return false;
      const r = cands.sort((a, b) => valueOf(a.card) - valueOf(b.card))[0];
      const pos = posOfUnit(F(r.side), r.unit); if (!pos || pos === "item") return false;
      const ok = B.destroyMonster(r.side, pos) !== false; ctx.lastCount = ok ? 1 : 0; return ok;
    },
    preventLeave(s, ctx) { ctx.saved = true; return true; },
    saveOnce(s, ctx) { ctx.saved = true; return true; },
    setLife(s, ctx) { F(s.who === "opp" ? otherSide(ctx.side) : ctx.side).life = s.n; ctx.lifeSet = true; return true; },
    draw(s, ctx) { const f = ctx.f; let k = 0; for (let i = 0; i < (typeof s.n === "number" ? s.n : 1) && f.deck.length; i++) { f.hand.push(f.deck.shift()); k++; } return k > 0; },
    damage(s, ctx) { const n = typeof s.n === "number" ? s.n : 0; core.applyDamage(s.who === "opp" ? otherSide(ctx.side) : ctx.side, n, { kind: "effect" }); return true; },
    life(s, ctx) { F(s.who === "opp" ? otherSide(ctx.side) : ctx.side).life += (typeof s.n === "number" ? s.n : 0); return true; },
    noop() { return true; }
  };
  // the saver card itself goes to the drop zone (from the field or from a soul)
  function removeSelf(ctx) {
    const f = ctx.f;
    if (ctx.unit) { const pos = posOfUnit(f, ctx.unit); if (!pos) return false; if (pos === "item") f.item = null; else f.monsters[pos] = null; f.drop.push(ctx.unit.card.id, ...(ctx.unit.soul || [])); ctx.unit.soul = []; ctx.selfGone = true; return true; }
    return false;
  }
  const syncStepOK = (x) => !!SYNC[x.op] && !(x.np && x.np.junk) && (!x.cond || ABX.condExecutable(x.cond)) && (x.op !== "move" || (x.np && x.np.self)) && (x.op !== "destroy" || (x.np && (x.np.self || !x.np.ref)));
  const syncOK = (ab) => !!ab && !(ab.unparsed && ab.unparsed.length) && (ab.steps || []).length > 0 && ab.steps.every(syncStepOK) && (ab.conds || []).every(ABX.condExecutable) &&
    (ab.trigger.event === "wouldDie" ? ab.steps.some(x => x.op === "setLife") : ab.steps.some(x => x.op === "preventLeave" || x.op === "saveOnce"));
  const ie3 = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.trigger && REPL.has(ab.trigger.event)) return syncOK(ab);
    return ie3.call(this, ab);
  };
  function describe(x) { return x.op === "pay" ? `pay ${[x.gauge ? x.gauge + " gauge" : "", x.life ? x.life + " life" : ""].filter(Boolean).join(" and ")}` : x.op === "discard" ? `discard ${x.n || 1} card(s) from your hand` : x.op === "dropSoul" ? `drop ${x.n || 1} soul(s)` : x.op === "destroy" ? `destroy ${ABX.clean(x.np.raw || "a monster")}` : x.op === "mill" ? `put the top ${x.n} card(s) of your deck into the drop zone` : ABX.clean(x.src || x.op); }
  function runSync(side, card, unit, ab, extra) {
    const f = F(side);
    const ctx = Object.assign({ side, f, e: F(otherSide(side)), card, unit, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, log: [], hostArea: "field" }, extra || {});
    if (!(ab.conds || []).every(c => evalCond(c, ctx))) return ctx;
    // the whole "you may ..." part is one question
    const opt = ab.steps.filter(x => x.optional);
    if (opt.length) {
      if (!opt.every(x => (x.op !== "pay" || ((x.gauge || 0) <= f.gauge.length && !(x.life && f.life <= x.life))) && (x.op !== "mill" || f.deck.length >= (x.n || 1)))) return ctx;
      if (!askYes(side, card, `${extra && extra.question || "Use this ability"}? (${opt.map(describe).join(", ")})`)) return ctx;
    }
    for (const x of ab.steps) {
      if (x.gate === "ifYouDo" && !ctx.lastDone) continue;
      if (x.gate === "ifNotDone" && ctx.lastDone) continue;
      if (x.cond && !evalCond(x.cond, ctx)) { ctx.lastDone = false; continue; }
      let ok = false;
      try { ok = SYNC[x.op](x, ctx) !== false; } catch (e) { if (ABX.debug) console.error(e); ok = false; }
      ctx.lastDone = ok;
    }
    return ctx;
  }
  let replDepth = 0;
  // called by battle.destroyMonster; true = the monster stays
  ABX.wouldLeaveSave = function (side, pos, unit, byAttack) {
    if (replDepth > 2 || !unit || !unit.card || B.matchOver) return false;
    replDepth++;
    try {
      const f = F(side);
      if (unit.abxNullified !== B.turnCount) {
        for (const ab of core.abilitiesOf(unit.card, a => a.trigger && a.trigger.event === "wouldLeave" && a.trigger.self && ABX.isExecutable(a))) {
          if (ab.trigger.byOppOnly && !(B.activeSide !== side || byAttack)) continue;
          if (core.onceUsed(f, unit.card, ab, unit)) continue;
          const ctx = runSync(side, unit.card, unit, ab, { protect: unit, question: `"${unit.card.name}" would be destroyed — keep it` });
          if (ctx.saved) { core.markOnce(f, unit.card, ab, unit); say(`🛡️ "${unit.card.name}" remained on the field!`); return true; }
        }
      }
      // "If another «X» on your field would be destroyed, you may put this card into the drop zone. If you do, that card remains"
      for (const x of fieldUnits(f, true)) {
        const sv = x.unit; if (sv === unit || sv.abxNullified === B.turnCount) continue;
        for (const ab of core.abilitiesOf(sv.card, a => a.trigger && a.trigger.event === "wouldLeaveOther" && ABX.isExecutable(a))) {
          if (!matchFilter(unit.card, ab.trigger.np.filter || {}, { unit, side }, { f })) continue;
          if (ab.trigger.byOpp && !(B.activeSide !== side || byAttack)) continue;
          if (core.onceUsed(f, sv.card, ab, sv)) continue;
          const ctx = runSync(side, sv.card, sv, ab, { protect: unit, question: `"${unit.card.name}" would be destroyed — save it with "${sv.card.name}"` });
          if (ctx.saved) { core.markOnce(f, sv.card, ab, sv); say(`🛡️ "${sv.card.name}" kept "${unit.card.name}" on the field!`); return true; }
        }
      }
      return false;
    } finally { replDepth--; }
  };
  // "If your life would become 0, ..." (cards on your field and in souls)
  ABX.lifeZeroSave = function (side) {
    const f = F(side);
    if (f.life > 0 || replDepth > 2) return false;
    replDepth++;
    try {
      for (const x of fieldUnits(f, true)) {
        const u = x.unit; if (u.abxNullified === B.turnCount) continue;
        for (const ab of core.abilitiesOf(u.card, a => a.trigger && a.trigger.event === "wouldDie" && ABX.isExecutable(a))) {
          if (core.onceUsed(f, u.card, ab, u)) continue;
          const ctx = runSync(side, u.card, u, ab, { question: "Your life would become 0 — use it" });
          if (ctx.lifeSet && f.life > 0) { core.markOnce(f, u.card, ab, u); say(`💫 "${u.card.name}": ${f.name || "You"} stayed in the fight!`); return true; }
        }
      }
      return false;
    } finally { replDepth--; }
  };
  if (typeof B.checkWinCondition === "function") {
    const ocw3 = B.checkWinCondition;
    B.checkWinCondition = function () {
      try { if (!B.matchOver) [B.plr, B.opp].forEach((f, i) => { if (f && f.life <= 0 && !f.abxNoLose) ABX.lifeZeroSave(i === 0 ? "plr" : "opp"); }); } catch (e) { if (ABX.debug) console.error(e); }
      return ocw3.apply(this, arguments);
    };
  }


  /* ============================================================
   * 9. UNREAD TEXT, PART 3
   * ============================================================ */
  const C6 = [];
  const cr6 = (re, fn) => C6.push([re, fn]);
  cr6(new RegExp("^you (?:dropped|put|returned|called|destroyed)(?: (" + "\\d+|a|an|one|two|three|four|five" + ")[^,]*| it| them| any)?$", "i"), (m) => ({ t: "xLastCount", n: m[1] ? (N(m[1]) || 1) : 1 }));
  cr6(new RegExp("^(?:there (?:is|are)|you have) " + NUM + " or more$", "i"), (m) => ({ t: "xChainMore", n: N(m[1]) }));
  cr6(/^this card entered(?: the field)? by (?:a )?card effects?$|^(?:it|this card) (?:was )?called by (?:a )?card effects?$/i, () => ({ t: "xByEffect" }));
  cr6(new RegExp("^(?:an|a|your) (.+?) (?:on your field )?(?:has|have) " + NUM + " or more (.+?) in (?:its|their) souls?$", "i"), (m) => { const host = NP(m[1].replace(/ on your field$/i, "")); const what = /^souls?$|^cards?$/i.test(m[3]) ? null : NP(m[3]); return host ? { t: "xItemSoul", host, what, n: N(m[2]) } : null; });
  cr6(/^(?:an|a|your) (.+?) (?:on your field )?(?:has|have) (?:an? )?(.+?) in (?:its|their) souls?$/i, (m) => { const host = NP(m[1].replace(/ on your field$/i, "")); const what = NP(m[2]); return host && what ? { t: "xItemSoul", host, what, n: 1 } : null; });
  cr6(/^(?:your|the) (.+?) (?:items?|monsters?)?(?: on your field)? (?:has|have) souls?$|^you have an? (.+?) with souls?(?: on (?:the|your) field)?$/i, (m) => { const t = m[1] || m[2]; const host = NP(t); return host ? { t: "xItemSoul", host, what: null, n: 1 } : null; });
  cr6(new RegExp("^(?:it|this card) has " + NUM + " or more souls?$", "i"), (m) => ({ t: "selfSoul", n: N(m[1]), cmp: "ge" }));
  cr6(/^(?:a|an|one or more) (.+?) on your field (?:is|are) being attacked$/i, (m) => { const np = NP(m[1] + " on your field"); return np ? { t: "xAllyAttacked", np } : null; });
  cr6(/^(?:a|an) (.+?) on your opponent's field is attacking(?: you)? alone$|^an opponent's (card|monster) is attacking alone$/i, (m) => { const np = NP((m[1] || m[2]) + " on your opponent's field"); return np ? { t: "xOppAlone", np, fighter: /you alone/i.test(m[0]) } : null; });
  cr6(/^your opponent's (?:card|monster) attacks you alone$/i, () => ({ t: "xOppAlone", np: null, fighter: true }));
  cr6(/^no cards? (?:is|are) in battle$/i, () => ({ t: "noBattle" }));
  cr6(/^(?:the|that) (?:card|monster) (?:revealed|dropped|put into (?:the|your) drop zone|chosen) is (not )?(?:a|an) (.+?)(?: card)?$|^the (?:revealed|dropped) card is (not )?(?:a|an) (.+?)(?: card)?$/i, (m) => {
    const not = !!(m[1] || m[3]); const w = (m[2] || m[4] || "").trim();
    const tp = w.match(/^(monster|spell|item|impact)$/i);
    const c = tp ? { t: "refType", type: lc(tp[1]) } : (() => { const np = NP(w); return np ? { t: "xRefIs", np } : null; })();
    return c ? (not ? { t: "not", c } : c) : null;
  });
  cr6(/^(?:a|an) (card|impact|spell) is \[set\] on your field$/i, (m) => ({ t: "xSetHas", np: /card/i.test(m[1]) ? undefined : NP("a " + m[1]) }));
  cr6(/^you have no items? equipped$/i, () => ({ t: "not", c: { t: "itemEquipped", any: true } }));
  cr6(new RegExp("^your opponent has " + NUM + " or (less|more) cards in (?:their |his or her )?hand$", "i"), (m) => ({ t: "hand", who: "opp", n: N(m[1]), cmp: CMP(m[2]) }));
  cr6(new RegExp("^the total (size|power|critical|defense) of (.+?) on your field is ([\\d,]+) or (greater|more|less)$", "i"), (m) => { const np = NP(m[2] + " on your field"); return np ? { t: "xTotal", stat: lc(m[1]), np, n: +m[3].replace(/,/g, ""), cmp: CMP(m[4]) } : null; });
  cr6(/^you have («[^»]+»|"[^"]+")(?: monsters?| items?| cards?)? on (?:your|the) field$/i, (m) => { const np = NP(m[1] + " on your field"); return np ? { t: "has", owner: "you", np, n: 1 } : null; });
  cr6(/^\[([^\]]+)\] is on your field$/i, (m) => { const np = NP('"' + m[1] + '" on your field'); return np ? { t: "has", owner: "you", np, n: 1 } : null; });
  cr6(/^your flag is "overgod, "0""$/i, () => ({ t: "flagIs", names: ["overgod"] }));
  ABX.COND_RULES.unshift(...C6);
  XC.xByEffect = (c, ctx) => !!(ctx.unit && ctx.unit.abxByEffect);
  XC.xItemSoul = (c, ctx) => fieldUnits(ctx.f, true).some(x => matchFilter(x.unit.card, c.host.filter || {}, { unit: x.unit, side: ctx.side }, ctx) &&
    (x.unit.soul || []).filter(id => !c.what || matchFilter(cardOf(id), c.what.filter || {}, null, ctx)).length >= (c.n || 1));
  XC.xAllyAttacked = (c, ctx) => { const b = battleNow(); const pd = B.pendingDefenseContext; const u = (b && b.defSide === ctx.side && b.defUnit) || (pd && pd.defSide === ctx.side && ctx.f.monsters[pd.targetPos]); return !!u && matchFilter(u.card, c.np.filter || {}, { unit: u, side: ctx.side }, ctx); };
  XC.xOppAlone = (c, ctx) => { const b = battleNow(); if (!b || b.attSide === ctx.side || (b.attUnits || []).length !== 1) return false; if (c.fighter && b.defUnit) return false; const u = b.attUnits[0]; return !c.np || matchFilter(u.card, c.np.filter || {}, { unit: u, side: b.attSide }, ctx); };
  XC.xRefIs = (c, ctx) => { const r = [].concat(ctx.bind.lastMoved || [], ctx.bind.revealed || [], ctx.bind.chosen || []).filter(x => x && x.card).pop(); return !!r && matchFilter(r.card, c.np.filter || {}, r, ctx); };
  XC.xTotal = (c, ctx) => {
    const us = refsFor(c.np, ctx, { owner: "you", area: "field" }).filter(r => r.unit);
    const sum = us.reduce((a, r) => { const e = typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(ctx.f, r.unit) : {}; return a + (c.stat === "size" ? (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(ctx.f, r.card, r.unit) : (r.card.size || 0)) : c.stat === "power" ? e.power : c.stat === "defense" ? e.defense : e.crit) || 0; }, 0);
    return cmpN(sum, c);
  };
  addOk("xByEffect", "xItemSoul", "xAllyAttacked", "xOppAlone", "xRefIs", "xTotal");
  // remember monsters called by an effect ("If this card entered the field by card effects")
  if (OPS.call) { const oc = OPS.call.run; OPS.call.run = async function () { ABX.callingByEffect = (ABX.callingByEffect || 0) + 1; try { return await oc.apply(this, arguments); } finally { ABX.callingByEffect--; } }; }
  if (typeof B.completeMonsterCall === "function") {
    const ocm = B.completeMonsterCall;
    B.completeMonsterCall = function (side, pos) { const r = ocm.apply(this, arguments); try { const u = this.getFighter(side).monsters[pos]; if (u && ABX.callingByEffect) u.abxByEffect = true; } catch (e) { /* ignore */ } return r; };
  }

  const A6 = [];
  const ar6 = (re, fn) => A6.push([re, fn, false]);
  ar6(/^your opponent puts (?:the top )?(\w+) cards? from the top of their deck into (?:the|their) gauge$|^your opponent puts the top (\w+) cards? of their deck into (?:the|their) gauge$/i, (m) => ({ op: "mill", who: "opp", n: toNum(m[1] || m[2]), to: "gauge" }));
  ar6(/^deal damage to (?:your|the) opponent equal to the critical of (?:one of )?your (.+)$/i, (m) => ({ op: "damage", who: "opp", n: { fromItem: "critical" } }));
  ar6(/^change the target of the attack to (?:a|an) (.+?) on your field$/i, (m) => { const np = NP("a " + m[1] + " on your field"); return np ? { op: "seq", steps: [{ op: "choose", np }, { op: "redirectAttack", toChosen: true }] } : null; });
  ar6(/^return all cards (?:from|in) your gauge (?:in)?to your deck$/i, () => ({ op: "moveZone", from: { owner: "you", area: "gauge" }, to: { owner: "you", area: "deck" }, n: 99 }));
  ar6(/^look at this card's soul$|^look at (?:the|your) opponent's hand$|^look at your opponent's hand$/i, () => ({ op: "noop", note: "look" }));
  ABX.ACTION_RULES.unshift(...A6);
  function rewrite6(s) {
    s = s.replace(/\bthis monster's soul\b/ig, "this card's soul");
    s = s.replace(/\bthe top (\w+) cards? from your deck\b/ig, "the top $1 cards of your deck").replace(/\bthe top card from your deck\b/ig, "the top card of your deck");
    s = s.replace(/\bput the top card of your deck to\b/ig, "put the top card of your deck into");
    s = s.replace(/\s*\(link attacks count as one attack\.?\)/ig, "");
    s = s.replace(/\b(\w+) of more\b/ig, "$1 or more").replace(/\batack\b/ig, "attack").replace(/\bguage\b/ig, "gauge");
    return s;
  }
  const prevRw6 = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite6(prevRw6(t));
  const pal6 = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewrite6(rawLine);
    const ab = pal6.call(this, fixed, card);
    if (fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    return ab;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
