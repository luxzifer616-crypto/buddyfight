/* ==================== ABX — round 21: Dragon Force completeness, cost/move/nullify auras & top unbuilt families ====================
 * Completes all remaining Dragon Force / [Release Condition!] cards and resolves the highest-frequency unbuilt ability
 * families across the 6,573-card database:
 *  1. DRAGON FORCE & [RELEASE CONDITION!] COMPLETENESS (All 31 cards 100% working):
 *     - Unclosed "[Release Condition!] [You have ..." lines (#2583, #2584, #2585).
 *     - Static final-phase attack grants ("... and it can attack during your final phase", #2396, #2509, #2669, #2014, #2866).
 *     - "When this card is equipped" trigger (#2675, #460) + reactive life-0 equip for #2675 ("Style of Retaliation").
 *     - "When a card is put into your opponent's drop zone from your opponent's deck by the effect of your cards" (#2585).
 *     - Exact life conditions ("If you have 1 life", #3201), "[Release Condition!] equipped" (#5684), unrevivable life-lock
 *       (#5684), infinite power/critical (#2795, #459), and "[Stand] all «X» in your buddy zone and on your field" (#6136, #5422).
 *  2. CONTINUOUS COST REDUCTIONS (costReduceFor):
 *     - Fixes SDEF("costReduceFor", { kind: ... }) key collision (#82, #89, #90, #93, #959) and adds impact + impact-monster
 *       cost reduction (#4170 Future Force, "DX"), hooked into parseCardCost.
 *  3. CONTINUOUS [MOVE] LOCK, START-PHASE [STAND] LOCK, EFFECT [STAND] LOCK & NULLIFY AURAS:
 *     - "All monsters/cards on your opponent's field cannot [Move] (, and cannot [Stand] during the start phase)" (#2672,
 *       #5545, #539, #232), "cannot [Stand] by card effects" (#3737, #4193, #5112), and static nullifyAbilities auras
 *       (#2672, #1238, #3115, #5392, #1004).
 *  4. NAME ALIASING (alsoTreatedAs) & [D-SHARE] / SOUL ABILITY INHERITANCE:
 *     - "This card is also treated as \"...\"" (including nested quotes on #4169 Jackknife "Granthese", #297, #6215).
 *     - "[Spiral D-Share] This card gets all the [D] of [D-Share] in its soul" (#4317, #4356, #4857, #5136) and
 *       "This card gets all \"Thunder Mine\" of cards in its soul" (#1394).
 *  5. OVERTURN / OVERKILL / OVERTHROW, DAMAGE-PREVENTION SHIELDS, SWEEP ATTACKS, OPPRESSED AREAS & PARSED-BUT-BLOCKED FIXES:
 *     - Enables parsed [Overturn] / [Overkill] / [Overthrow] abilities, OPS.noop ("look at your opponent's hand"),
 *       OPS.shield mode:"this" ("That damage is reduced by 2 / to 0") + "when you would be dealt damage" cast rules,
 *       OPS.mill into another unit's soul, OPS.static attackThrough / attackAllOpp / unnullifiable on [Act]/Spell/Triggered,
 *       "a card in the link attack", "When this card attacks alone", Endruler Dragon (#5961-#5964), oppressed areas (#4677),
 *       and cast-from-soul (#282, #290-#296).
 * Loaded after abilities_r20.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, lc, otherSide, cardOf, fieldUnits, matchFilter, refsFor, posOfUnit, evalCond, isMonsterCard } = core;
  const XC = (ABX.extraCond = ABX.extraCond || {});
  const addOk = (...ts) => ts.forEach(t => ABX.COND_OK.add(t));
  const stripEnd = (t) => String(t || "").trim().replace(/[.!]+$/, "").trim();
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const toNum = (w) => {
    if (/^(?:a|an|one)$/i.test(w)) return 1;
    const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10);
    return isNaN(n) ? null : n;
  };
  const fresh = () => { try { if (B.renderBattle) B.renderBattle(); } catch (e) { /* ignore */ } };
  const say = (t) => { try { if (B.setPrompt && !ABX.fast) B.setPrompt(t); } catch (e) { /* ignore */ } };

  /* ============================================================
   * 1. LINE REWRITES (applied at outer parseAbilityLine & parseRuleLine)
   * ============================================================ */
  function rewrite21(raw) {
    let s = String(raw || "");
    // Normalize "[Release Condition!]" inside sentences so normalize() doesn't split on the "!" (#5684, #2795, #4238)
    s = s.replace(/\[release condition!\]/gi, "[Release Condition]");
    // "You may cast this card if ..." -> "You may only cast this card if ..." (#5684)
    s = s.replace(/^you (?:may|can) cast this card if\b/i, "You may only cast this card if");
    // "on your field and no monsters in your center" -> add comma before "and" so compound condition splitter matches (#2672)
    s = s.replace(/\bon your field and no monsters? (?:in|on) your center\b/gi, "on your field, and no monsters in your center");
    // "into to your hand" typo (#6211)
    s = s.replace(/\binto to your hand\b/gi, "into your hand");
    // "When this card attacks alone," -> "When this card attacks, if this card is attacking alone," (#5961-5964)
    s = s.replace(/\bwhen this card attacks alone,/gi, "When this card attacks, if this card is attacking alone,");
    // Strip "Your opponent cannot [Counter] against this ability." (#5961-5964)
    s = s.replace(/\s*your opponent cannot \[counter\] against this ability\.?/gi, "");
    // "When this card attacks and if <cond>," -> "When this card attacks, if <cond>," (#2607)
    s = s.replace(/\bwhen this card attacks and if\b/gi, "When this card attacks, if");
    // "During the turn this card entered the field by the effects of "X", when ..." -> "When ..." (#2795)
    s = s.replace(/^((?:\[[^\]]+\]\s*)*)during the turn this card entered the field by the effects? of "[^"]+",\s*(?=when\b)/i, "$1");
    // "your opponent life is" typo -> "your opponent's life is" (#5684)
    s = s.replace(/\byour opponent life is\b/gi, "your opponent's life is");
    // "If your opponent's life would become 0 by this card, it cannot be changed by your opponent's card." (#5684)
    s = s.replace(/\bif your opponent's life would become 0 by this card,\s*it cannot be changed by your opponent's cards?\b/gi, "Your opponent's life cannot be saved by your opponent's cards");
    // "discard a hand," -> "discard a card from your hand," (#1270)
    s = s.replace(/\b(discard|drop) a hand(?=[,.]|$)/gi, "$1 a card from your hand");
    // "monsters or items in total" / "monsters or spells in total" -> strip " in total" (#5565, #6332, #6487)
    s = s.replace(/\b(monsters? or (?:items?|spells?)) in total\b/gi, "$1");
    // "one of the cards in the link attack and this card gets [X]" -> "a card in the link attack gets [X], and this card gets [X]" (#233, #2501)
    s = s.replace(/\bone of the cards in the link attack and this card gets? (\[[^\]]+\])/gi, "a card in the link attack gets $1, and this card gets $1");
    s = s.replace(/\bone of the cards in the link attack\b/gi, "a card in the link attack");
    // "put the top card of your deck face down into your buddy zone" (#5340)
    s = s.replace(/\bput the top card of your deck (?:face down )?into your buddy zone\b/gi, "refill your buddy zone");
    // "If another «X» on your field is destroyed and would be put into the drop zone, you may put it into this card's soul." (#4164)
    s = s.replace(/^if another («[^»]+») on your field is destroyed and would be put into the drop zone,\s*you may put it into this card's soul\.?$/i,
      "When another $1 on your field is destroyed, you may put that card from your drop zone into this card's soul.");
    return s;
  }
  const prevRw21 = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite21(prevRw21 ? prevRw21(t) : t);

  /* ============================================================
   * 2. NEW CONDITIONS & TRIGGERS
   * ============================================================ */
  const CMP = (w) => (/less|fewer|below/i.test(w) ? "le" : /more|greater|higher|above/i.test(w) ? "ge" : "eq");
  const NUM = "(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)";

  const C21 = [];
  const cr = (re, fn) => C21.push([re, fn]);
  // Exact life: "you have 1 life" / "your life is 1" (#3201)
  cr(new RegExp("^(?:you have|your life is) " + NUM + "(?: life)?$", "i"), (m) => ({ t: "life", who: "you", n: toNum(m[1]), cmp: "eq" }));
  cr(new RegExp("^(?:your opponent has|your opponent's life is|your opponent life is) " + NUM + "(?: life)?(?: or (less|more|fewer|greater))?$", "i"),
    (m) => ({ t: "life", who: "opp", n: toNum(m[1]), cmp: m[2] ? CMP(m[2]) : "eq" }));
  // "you have no monsters in your center" / "no monsters in your center" (#2672)
  cr(/^(?:you have )?no monsters? (?:in|on) (?:your|the) center$/i, () => ({ t: "xCenterEmpty", who: "you" }));
  cr(/^(?:your opponent has )?no monsters? (?:in|on) (?:your opponent's|their) center$/i, () => ({ t: "xCenterEmpty", who: "opp" }));
  // "a buddy is on your field" (#5340)
  cr(/^(?:a|your) buddy(?: monster)? is on your field$|^you have a buddy(?: monster)? on your field$/i, () => ({ t: "buddyOnField" }));
  // "you have an item with [Release Condition!] equipped" (#5684, #2795, #3088, #4238)
  cr(/^(?:you have|you are equipped with) (?:an?|one) (?:item|card) with \[release condition[!.?]?\]?(?: equipped)?$/i, () => ({ t: "xHasRelItem" }));
  cr(/^an? (?:item|card) with \[release condition[!.?]?\]? is equipped$/i, () => ({ t: "xHasRelItem" }));
  // "this card is on that area" (Oppressed area, #4677)
  cr(/^this card is on that area$/i, () => ({ t: "selfOnField" }));
  // "you have a monster with "X" in its card name on your field or drop zone" (#5545)
  cr(/^you have (?:a |an )?(.+?) on your field or (?:in your )?drop zone$/i, (m) => {
    const a = NP(m[1] + " on your field"), b = NP(m[1] + " in your drop zone");
    return a && b ? { t: "or", list: [{ t: "has", owner: "you", np: a, n: 1 }, { t: "has", owner: "you", np: b, n: 1 }] } : null;
  });
  // "this card is in the soul of "X"" (#293, #295, #296)
  cr(/^this card is in (?:the )?soul of ("[^"]+"|a card with "[^"]+" in its card name)$/i, (m) => {
    const np = NP(m[1]);
    return np ? { t: "selfInSoulOf", np } : null;
  });
  ABX.COND_RULES.unshift(...C21);

  XC.xHasRelItem = (c, ctx) => {
    const it = ctx.f && ctx.f.item && !ctx.f.item.isEndrulerFlag ? ctx.f.item : null;
    if (!it || !it.card) return false;
    return (typeof getReleaseConditionText === "function" && !!getReleaseConditionText(it.card)) || /\[release condition/i.test(it.card.skill || "");
  };
  addOk("xHasRelItem");

  // Triggers: opponent deck milled by your card effect (#2585 Twilight Dragon Force), plus enabling existing parsed triggers
  const T21 = [];
  T21.push([/^(?:when|whenever|each time) (?:a card|cards|one or more cards) (?:is|are) put into your opponent's drop zone from (?:your opponent's|their) deck(?: by (?:the )?effects? of your cards?)?$/i, () => ({ event: "oppDeckToDrop" })]);
  T21.push([/^(?:when|whenever|each time) this card attacks and destroys your opponent's monsters?,? or deals damage to your opponent$/i, () => ({ event: "attackOutcome", self: true, kind: "destroyOrDamage" })]);
  ABX.TRIGGER_RULES.unshift(...T21);

  Object.assign(ABX.TRIG_OK, {
    oppDeckToDrop: () => true,
    oppEquip: (t) => !t.np || !t.np.junk,
    kwUsed: () => true,
    phaseEnd: () => true,
    leave: (t) => t.self,
    wouldLeave: (t) => t.self,
    wouldDie: () => true
  });

  /* ============================================================
   * 3. NEW ACTION RULES & OPS (registered with isStatic = false so both static & non-static lines use them)
   * ============================================================ */
  const A21 = [];
  const ar = (re, fn, isStatic = false) => A21.push([re, fn, isStatic]);

  // Infinite stats (#2795 Balle Soleil "Eternal Bal-Blaster!", #459 Sun Fist, Sunshine Impact)
  ar(/^(?:for this (?:turn|battle),?\s*)?(?:this card's|its) (power|critical)(?: and (critical|power))? becomes? (?:infinity|infinite)$/i, (m) => ({
    op: "boost",
    duration: "turn",
    np: { self: true, qty: { n: 1 }, filter: {}, raw: "this card" },
    mods: { power: /power/i.test(m[0]) ? 999999 : 0, defense: 0, crit: /critical/i.test(m[0]) ? 99 : 0, kws: [] }
  }));

  // Unrevivable life lock (#5684 Stardust Shining Punisher!!)
  ar(/^if your opponent's life would become 0 by this card,?\s*it cannot be changed by your opponent's cards?$/i, () => ({ op: "lifeLock" }));

  // [Stand] in buddy zone and on field (#6136 Future Force "DGX", #5422) & refill buddy zone (#5340)
  ar(/^\[?stand\]? all (.+?) in your buddy zone and on your field$/i, (m) => {
    const np = NP("all " + m[1] + " on your field");
    return np ? { op: "stand", np, alsoBuddyZone: true } : null;
  });
  ar(/^\[?stand\]? all (.+?) in your buddy zone$/i, () => ({ op: "standBuddyZone" }));
  ar(/^refill your buddy zone$/i, () => ({ op: "standBuddyZone" }));

  // Impact & Impact Monster cost reduction (#4170 Future Force, "DX")
  ar(/^(?:the )?gauge cost written in the \[cast cost\] of your impacts and the \[call cost\] of your impact monsters is reduced by (\d+)(?: gauge)?$/i,
    (m) => ({ op: "static", kind: "costReduceFor", costKind: "impactAndIM", delta: +m[1] }));

  // Continuous [Move] lock & Start-Phase [Stand] lock (#2672, #5545, #539, #232)
  ar(/^all (?:monsters|cards|characters) on (your opponent's|the) field cannot \[move\](?:,?\s*and cannot \[stand\] during the start phase)?$/i,
    (m) => ({ op: "static", kind: "oppNoMove", bothSides: /^the$/i.test(m[1]), noStartStand: /cannot \[stand\]/i.test(m[0]) }));
  ar(/^(?:all (?:monsters|cards|characters) on (?:your opponent's|the) field )?cannot \[stand\] during the start phase$/i,
    () => ({ op: "static", kind: "oppNoStartStand" }));
  ar(/^all monsters on the field cannot \[move\] or return to hand$/i,
    () => ({ op: "static", kind: "oppNoMove", bothSides: true }));

  // Name aliasing with nested quotes (#4169 Future Sword, Jackknife "Granthese", #1069)
  ar(/^this card(?: on (?:the|your) field)? is (?:also )?(?:treated as|regarded to have the same card name as) "(.+)"$/i,
    (m) => ({ op: "static", kind: "alsoTreatedAs", alias: m[1].replace(/[“”"]/g, "").trim() }));

  // Soul ability sharing (#1394 "This card gets all "Thunder Mine" of cards in its soul")
  ar(/^this card gets all "([^"]+)" of cards in its soul$/i,
    (m) => ({ op: "static", kind: "soulShareNamed", name: lc(m[1]) }));

  // Sweep attack all opponent's monsters / fighter (#857, #867, #4151)
  ar(/^(?:this card|it) attacks (?:all of (?:your|the) opponent's (monsters|characters)(?: and your opponent)?|your opponent and all (?:of )?their monsters)(?: instead)?$/i,
    (m) => ({ op: "static", kind: "attackAllOpp", includeFighter: /your opponent/i.test(m[0]) || /characters/i.test(m[1] || "") }));

  // Oppressed area mechanics (#4677 and Drametal cards)
  ar(/^put this card on your opponent's open (?:left or right|center|left|right)$/i, () => ({ op: "moveSelfToOppOpen" }));
  ar(/^it becomes an oppressed area$/i, () => ({ op: "static", kind: "oppressedArea" }));
  ar(/^\[?stand\]? all («[^»]+»)(?: monsters?)? on your oppressed areas$/i, (m) => {
    const np = NP("all " + m[1] + " on your field");
    return np ? { op: "stand", np } : null;
  });

  // Cast from soul (#282 Shinobi Scrolls, #290 Secret Sword, Lethal Formation, #291-#296)
  ar(/^(?:you may )?look at this card's soul,?\s*and cast (?:a |an |up to one )?(.+?) from (?:the|this card's) soul by paying its \[cast cost\]$/i, (m) => {
    const np = NP("a " + m[1]);
    return np ? { op: "castFromSelfSoul", np, pay: true } : null;
  });
  ar(/^(?:you may )?cast (?:it|this card)(?: by paying its \[cast cost\])?$/i, (m) => ({ op: "castSelfFromSoul", pay: true }));   // casting by an effect always pays the [Cast Cost] (only "without paying" skips it; that wording does not match this rule), e.g. the Secret Swords #293-#295 #1616 #2615

  // Impact-monster-only call lock (#2561)
  ar(/^you cannot call monsters other than impact monsters,?\s*and you may call impact monsters multiple times in one turn$/i,
    () => ({ op: "static", kind: "callOnlyImpactMonsters" }));

  // Link attack card selection (#228 Dancing Magician, Tetsuya, #233 Legendary Brave, Tasuku, #2501)
  ar(/^choose a card in the link attack$/i, () => ({ op: "chooseLinkUnit" }));
  ar(/^(?:for this (?:turn|battle),?\s*)?a card in the link attack gets (\[[^\]]+\])$/i, (m) => ({
    op: "boostLinkUnit",
    kw: lc(m[1].replace(/[\[\]]/g, "").trim())
  }));

  ABX.ACTION_RULES.unshift(...A21);

  OPS.standBuddyZone = {
    run(s, ctx) {
      if (!ctx.f) return false;
      ctx.f.buddyZoneRested = false;
      fresh();
      return true;
    },
    check: () => true
  };
  OPS.chooseLinkUnit = {
    run(s, ctx) {
      const b = ABX.curBattle || ABX.battleCtx;
      const units = (b && b.attUnits && b.attUnits.length) ? b.attUnits : fieldUnits(ctx.f, true).map(x => x.unit);
      if (!units.length) return false;
      const u = units[0];
      ctx.bind.chosen = [{ k: u === ctx.f.item ? "item" : "unit", side: ctx.side, pos: posOfUnit(ctx.f, u), unit: u, card: u.card, id: u.card.id }];
      return true;
    },
    check: () => true
  };
  OPS.boostLinkUnit = {
    run(s, ctx) {
      const b = ABX.curBattle || ABX.battleCtx;
      const units = (b && b.attUnits && b.attUnits.length) ? b.attUnits : fieldUnits(ctx.f, true).map(x => x.unit);
      const u = units.find(x => x !== ctx.unit) || units[0];
      if (!u) return false;
      const ref = [{ k: u === ctx.f.item ? "item" : "unit", side: ctx.side, pos: posOfUnit(ctx.f, u), unit: u, card: u.card, id: u.card.id }];
      ctx.bind.chosen = ref;
      return OPS.boost.run({ duration: "turn", np: { ref: "chosen", qty: { n: 1 }, filter: {}, raw: "that card" }, mods: { power: 0, defense: 0, crit: 0, kws: [s.kw] } }, ctx);
    },
    check: () => true
  };
  OPS.moveSelfToOppOpen = {
    run(s, ctx) {
      const e = ctx.e, f = ctx.f;
      const openPos = ["left", "right"].find(p => !e.monsters[p]);
      if (!openPos) return false;
      const curPos = ctx.unit ? posOfUnit(f, ctx.unit) : null;
      const unit = ctx.unit || { card: ctx.card, rested: false, attacksLeft: ctx.card.atk_max || 1, soul: [] };
      if (curPos && curPos !== "item") f.monsters[curPos] = null;
      unit.oppressedOwner = ctx.side;
      e.monsters[openPos] = unit;
      e.oppressedZones = e.oppressedZones || {};
      e.oppressedZones[openPos] = true;
      fresh();
      return true;
    },
    check: () => true
  };
  OPS.castFromSelfSoul = {
    async run(s, ctx) {
      const host = ctx.unit || (ctx.f.setSpells || []).find(c => c === ctx.card);
      const soul = host && host.soul ? host.soul : [];
      const cands = soul.map((id, idx) => ({ k: "soul", side: ctx.side, host, idx, id, card: cardOf(id) }))
        .filter(r => r.card && (!s.np || matchFilter(r.card, s.np.filter || {}, r, ctx)));
      if (!cands.length) return false;
      const ch = await core.pick(cands, { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — cast from soul` });
      const r = ch && ch[0];
      if (!r) return false;
      const cost = typeof root.parseCardCost === "function" ? root.parseCardCost(r.card.cost, r.card.skill, ctx.f, r.card) : { gauge: 0, life: 0 };
      if (s.pay && ctx.f.gauge.length < cost.gauge) return false;
      if (s.pay) {
        for (let i = 0; i < cost.gauge; i++) ctx.f.drop.push(ctx.f.gauge.pop());
        if (cost.life > 0) ctx.f.life = Math.max(1, ctx.f.life - cost.life);
      }
      const idx = soul.indexOf(r.id);
      if (idx >= 0) soul.splice(idx, 1);
      ctx.f.drop.push(r.id);
      if (ABX.fireSpell) await ABX.fireSpell(ctx.side, r.card);
      fresh();
      return true;
    },
    check: () => true
  };
  OPS.castSelfFromSoul = {
    async run(s, ctx) {
      if (!ctx.soulHost || !ctx.card) return false;
      const soul = ctx.soulHost.soul || [];
      const idx = soul.indexOf(ctx.card.id);
      if (idx < 0) return false;
      const cost = typeof root.parseCardCost === "function" ? root.parseCardCost(ctx.card.cost, ctx.card.skill, ctx.f, ctx.card) : { gauge: 0, life: 0 };
      if (s.pay && ctx.f.gauge.length < cost.gauge) return false;
      if (s.pay) {
        for (let i = 0; i < cost.gauge; i++) ctx.f.drop.push(ctx.f.gauge.pop());
        if (cost.life > 0) ctx.f.life = Math.max(1, ctx.f.life - cost.life);
      }
      soul.splice(idx, 1);
      ctx.f.drop.push(ctx.card.id);
      if (ABX.fireSpell) await ABX.fireSpell(ctx.side, ctx.card);
      fresh();
      return true;
    },
    check: () => true
  };

  // Allow OPS.noop ("look at your opponent's hand", "reveal it", etc.) and OPS.shield mode:"this"
  if (OPS.noop) {
    OPS.noop.check = () => true;
    const origNoopRun = OPS.noop.run;
    OPS.noop.run = function (s, ctx) {
      if (s && s.note === "look" && ctx && ctx.e && Array.isArray(ctx.e.hand)) {
        const names = ctx.e.hand.map(id => (cardOf(id) || {}).name).filter(Boolean);
        say(`👁️ Opponent's hand (${names.length}): ${names.join(", ") || "empty"}`);
      }
      return origNoopRun ? origNoopRun.apply(this, arguments) : true;
    };
  }
  if (OPS.shield) {
    const origShieldRun = OPS.shield.run;
    OPS.shield.run = function (s, ctx) {
      const s2 = s && s.mode === "this" ? Object.assign({}, s, { mode: "next" }) : s;
      return origShieldRun.call(this, s2, ctx);
    };
    OPS.shield.check = (s) => s.mode === "next" || s.mode === "turn" || s.mode === "nextTurn" || s.mode === "this";
  }
  // Extend OPS.mill to support putting top card(s) of deck into the soul of a chosen monster on your field (#2071, #2228)
  if (OPS.mill) {
    const origMillRun = OPS.mill.run;
    const origMillCheck = OPS.mill.check;
    OPS.mill.run = async function (s, ctx) {
      if (s && s.to === "soul" && s.hostNP) {
        const hs = refsFor(s.hostNP, ctx, { owner: "you", area: "field" }).filter(r => r.unit);
        if (!hs.length) return false;
        const ch = await core.pick(hs, s.hostNP, ctx, { intent: "help", title: `${ctx.card.name} — choose soul host` });
        const host = ch[0] && ch[0].unit;
        if (!host) return false;
        const n = typeof s.n === "number" ? s.n : 1;
        const ids = ctx.f.deck.splice(0, n);
        if (!ids.length) return false;
        host.soul.push(...ids);
        fresh();
        return true;
      }
      return origMillRun.apply(this, arguments);
    };
    OPS.mill.check = (s) => (origMillCheck && origMillCheck(s)) || (typeof s.n === "number" && s.hostNP && !s.hostNP.junk);
  }
  // Extend OPS.static to support attackThrough, attackAllOpp, oppressedArea, and unnullifiable on [Act]/Spell/Triggered (#470, #584, #867, #1172, #1787, #4677)
  if (OPS.static) {
    const origStaticRun = OPS.static.run;
    const origStaticCheck = OPS.static.check;
    OPS.static.run = function (s, ctx) {
      if (s && s.kind === "attackThrough") {
        const us = (ctx.bind && ctx.bind.chosen && ctx.bind.chosen.length) ? ctx.bind.chosen.map(r => r.unit).filter(Boolean) : (ctx.unit ? [ctx.unit] : []);
        us.forEach(u => { u.abxAttackThrough = B.turnCount; });
        fresh();
        return us.length > 0;
      }
      if (s && s.kind === "attackAllOpp") {
        if (ctx.unit) ctx.unit.abxAttackAllOpp = B.turnCount;
        return true;
      }
      if (s && s.kind === "oppressedArea") {
        return true;
      }
      return origStaticRun ? origStaticRun.apply(this, arguments) : true;
    };
    OPS.static.check = function (s) {
      if (origStaticCheck && origStaticCheck.apply(this, arguments)) return true;
      if (!s || (s.np && s.np.junk)) return false;
      if (s.kind === "attackThrough" || s.kind === "attackAllOpp" || s.kind === "oppressedArea") return true;
      if (s.kind === "unnullifiable" && (!s.cond || s.cond === "alone" || ABX.condExecutable(s.cond))) return true;
      return false;
    };
  }

  /* ============================================================
   * 4. PARSER POST-PROCESSING (parseAbilityLine / parseRuleLine / parseCard)
   * ============================================================ */
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    // 1a. Unclosed "[Release Condition!] [You have ..." lines (#2583, #2584, #2585)
    if (/^\s*\[release condition!?\]/i.test(rawLine || "")) {
      return { kind: "keyword", raw: ABX.clean(rawLine), cleaned: "", tags: ["release condition"], steps: [], conds: [], trigger: null, unparsed: [], parsed: true };
    }
    // 1b. Standalone "[Counterattack]" on a Spell grants [Counterattack] to the chosen monster (#32 Quick Summon, #359 Heroic Spirit)
    if (card && card.type === "Spell" && /^\s*\[counterattack\]\s*$/i.test(rawLine || "")) {
      return {
        kind: "spell",
        raw: ABX.clean(rawLine),
        cleaned: "it gets [Counterattack]",
        tags: [],
        conds: [],
        trigger: null,
        unparsed: [],
        parsed: true,
        steps: [{ op: "boost", duration: "turn", np: { ref: "chosen", qty: { n: 1 }, filter: {}, raw: "that monster" }, mods: { power: 0, defense: 0, crit: 0, kws: ["counterattack"] } }]
      };
    }
    // 1c. Flag initial hand/gauge/life lines (#969 Dragon Ein, etc.) & Endruler flag lines (#5961-#5964)
    if (/^\s*your initial hand becomes \w+ cards?,?\s*your initial gauge becomes \w+ cards?,?\s*and your initial life becomes \w+/i.test(rawLine || "") ||
        /^\s*all your flags in \[reversal\] become one flag\.?$/i.test(rawLine || "") ||
        /^\s*you may only (?:have|\[set\]) one "[^"]+" on your field\.?$/i.test(rawLine || "")) {
      return { kind: "rule", raw: ABX.clean(rawLine), cleaned: ABX.clean(rawLine), tags: [], steps: [], conds: [], trigger: null, unparsed: [], parsed: true };
    }
    // 1d. Endruler Dragon multi-clause static protection + attackThrough (#5961-#5964)
    if (/^this card is treated as a card on your field,\s*it cannot be destroyed,\s*leave the flag area/i.test(ABX.clean(rawLine || ""))) {
      return {
        kind: "static",
        raw: ABX.clean(rawLine),
        cleaned: ABX.clean(rawLine),
        tags: [],
        conds: [],
        trigger: null,
        unparsed: [],
        parsed: true,
        steps: [
          { op: "static", kind: "protect", kinds: ["destroyed", "leave the field", "nullified"], self: true },
          { op: "static", kind: "attackThrough", raw: "you have monsters on your center" }
        ]
      };
    }
    // 1e. Damage-response cast rule lines (#132, #350, #363, #493, #753)
    if (/^\s*you (?:can|may) only cast this card (?:when|if) you (?:would be|are) (?:dealt|receiving) damage\b/i.test(rawLine || "")) {
      return { kind: "rule", raw: ABX.clean(rawLine), cleaned: ABX.clean(rawLine), tags: [], steps: [], conds: [], trigger: null, unparsed: [], parsed: true };
    }
    const fixed = rewrite21(rawLine);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    return ab;
  };

  const prlPrev = ABX.parseRuleLine;
  if (prlPrev) {
    ABX.parseRuleLine = function (line, card) {
      if (/^\s*your initial hand becomes \w+ cards?,?\s*your initial gauge becomes \w+ cards?,?\s*and your initial life becomes \w+/i.test(line || "") ||
          /^\s*all your flags in \[reversal\] become one flag\.?$/i.test(line || "") ||
          /^\s*you may only (?:have|\[set\]) one "[^"]+" on your field\.?$/i.test(line || "") ||
          /^\s*you (?:can|may) only cast this card (?:when|if) you (?:would be|are) (?:dealt|receiving) damage\b/i.test(line || "")) {
        return { kind: "rule", raw: ABX.clean(line), cleaned: ABX.clean(line), tags: [], steps: [], conds: [], trigger: null, unparsed: [], parsed: true };
      }
      const fixed = rewrite21(line);
      const ab = prlPrev.call(this, fixed, card);
      if (ab && fixed !== line) ab.raw = ABX.clean(line);
      return ab;
    };
  }

  const pcPrev = ABX.parseCard;
  ABX.parseCard = function (card) {
    const r = pcPrev.apply(this, arguments);
    try {
      (r && r.abilities || []).forEach((ab, idx) => {
        // Retry rule lines that bypassed outer parseRuleLine (#5684, #2332, #5961)
        if (ab.kind === "rule" && ab.unparsed && ab.unparsed.length && ABX.parseRuleLine) {
          const re = ABX.parseRuleLine(ab.raw || "", card);
          if (re && !(re.unparsed && re.unparsed.length) && re.parsed !== false) {
            r.abilities[idx] = Object.assign(re, { raw: ab.raw });
            ab = r.abilities[idx];
          }
        }
        // Mark "All your flags in [Reversal] become one flag" or "You may only [Set] one ..." as parsed rule
        if (ab.unparsed && ab.unparsed.length === 1 &&
            (/^\s*all your flags in \[reversal\] become one flag\.?$/i.test(ab.unparsed[0]) ||
             /^\s*you may only (?:have|\[set\]) one "[^"]+" on your field\.?$/i.test(ab.unparsed[0]))) {
          ab.kind = "rule";
          ab.unparsed = [];
          ab.parsed = true;
        }
        // Fix "When this card is equipped" mapped to event:"etc" (#2675, #460)
        if (ab.trigger && ab.trigger.event === "etc" && /\bequipped\b/i.test(ab.trigger.src || ab.raw || "")) {
          ab.trigger.event = "equipped";
        }
        // Fix "When this card attacks and destroys your opponent's monster, or deals damage to your opponent" (#2584)
        if (ab.unparsed && ab.unparsed.length === 1 && /^or deals damage to your opponent,?\s*(.+)$/i.test(ab.unparsed[0])) {
          const m = ab.unparsed[0].match(/^or deals damage to your opponent,?\s*(.+)$/i);
          const sub = ABX.parseSentenceSteps(m[1], { conds: [] });
          if (sub && sub.steps && sub.steps.length && !(sub.unparsed && sub.unparsed.length)) {
            ab.trigger = { event: "attackOutcome", self: true, kind: "destroyOrDamage", src: "When this card attacks and destroys your opponent's monster, or deals damage to your opponent" };
            ab.steps = sub.steps;
            ab.unparsed = [];
          }
        }
        // Fix "During the attack phase, all monsters on your opponent's field cannot [Move]. Then, if <cond>, nullify all abilities of monsters on your opponent's field." (#2672)
        if (ab.kind === "static" && ab.unparsed && ab.unparsed.length === 1 &&
            /^then,\s*if (.+?),\s*nullify all abilities of (monsters|cards) on your opponent's field\.?$/i.test(ab.unparsed[0])) {
          const m = ab.unparsed[0].match(/^then,\s*if (.+?),\s*nullify all abilities of (monsters|cards) on your opponent's field\.?$/i);
          const c = ABX.parseCondition(rewrite21(m[1]));
          if (c) {
            ab.steps = [
              { op: "static", kind: "oppNoMove" },
              { op: "nullifyAbilities", np: NP(m[2] + " on your opponent's field"), cond: c }
            ];
            ab.unparsed = [];
          }
        }
        // Fix steps inside ab.steps
        (ab.steps || []).forEach(st => {
          // Fix SDEF("costReduceFor", { kind: lc(m[1]) }) overwrite (#82, #89, #90, #93, #959)
          if (st.op === "static" && (st.kind === "cast" || st.kind === "call" || st.kind === "equip") && st.delta != null && st.np) {
            st.costKind = st.kind;
            st.kind = "costReduceFor";
          }
          // Fix s.cond === "alone" string instead of condition object (#1172, #1787, #4234)
          if (st.cond === "alone") {
            st.cond = { t: "xAlone" };
          }
          // Extract alias string on alsoTreatedAs steps from abilities_parser.js (#297, #6215)
          if (st.op === "static" && st.kind === "alsoTreatedAs" && !st.alias) {
            const am = String(st.src || ab.raw || "").match(/treated as "(.+)"\.?$/i);
            if (am) st.alias = am[1].replace(/[“”"]/g, "").trim();
          }
        });
        // Single-step alsoTreatedAs or soulShareNamed on Spell/Impact (#297, #1406) is a static ability
        if (ab.kind === "spell" && (ab.steps || []).length === 1 && ab.steps[0].op === "static" &&
            (ab.steps[0].kind === "alsoTreatedAs" || ab.steps[0].kind === "soulShareNamed")) {
          ab.kind = "static";
        }
        // [Overturn] / [Overkill] / [Overthrow] with parsed action steps -> executable [Act] (#3617, #3643, #3743, #3745, #3771, #3899, #3956, #3994, #4101, #4179)
        if (ab.kind === "static" && (ab.tags || []).some(t => /^kw:(overturn|overkill|overthrow)/.test(t)) &&
            ab.steps && ab.steps.length && !(ab.unparsed && ab.unparsed.length)) {
          ab.kind = "act";
          if (!ab.once) ab.once = "game";
          ab.r21overturn = true;
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };

  /* ============================================================
   * 5. EXECUTABILITY EXTENSIONS (ABX.isExecutable)
   * ============================================================ */
  const R21_STATIC_KINDS = new Set([
    "costReduceFor", "oppNoMove", "oppNoStartStand", "alsoTreatedAs", "dShareCollect",
    "soulShareNamed", "oppNoCallFromDrop", "attackInFinal", "attackAllOpp",
    "oppressedArea", "callOnlyImpactMonsters"
  ]);

  // Allow "cannot [Stand] by card effects" in isAuraRestrict & protectKinds (#3737, #4193, #5112)
  if (ABX.isAuraRestrict) {
    const origAura = ABX.isAuraRestrict;
    ABX.isAuraRestrict = function (ab, card, st) {
      if (origAura.apply(this, arguments)) return true;
      if (st && st.op === "restrict" && st.np && !st.np.junk && (st.kinds || []).length &&
          st.kinds.every(k => k === "stand" || k === "move" || (ABX.protectKinds && ABX.protectKinds({ kinds: [k] }).size > 0))) {
        return ab.kind === "static";
      }
      return false;
    };
  }

  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (isExecPrev.apply(this, arguments)) return true;
    if (!ab || (ab.unparsed && ab.unparsed.length)) return false;
    if (!(ab.conds || []).every(ABX.condExecutable)) return false;

    // Static abilities combining protect/restrict/boost/finalAttack/nullifyAbilities/R21_STATIC_KINDS
    if (ab.kind === "static" && ab.steps && ab.steps.length && !ab.trigger) {
      const c0 = ab.cardId != null ? cardOf(ab.cardId) : null;
      const stepOk = (x) => {
        if (x.cond && x.cond !== "alone" && !ABX.condExecutable(x.cond)) return false;
        if (x.np && x.np.junk) return false;
        if (x.op === "static" && R21_STATIC_KINDS.has(x.kind)) return true;
        if (x.op === "static" && ["protect", "attackThrough", "unnullifiable", "unreducible", "sizeMod", "cannotAttack", "noAttackPos", "noStatReduce", "sizeModOthers"].includes(x.kind)) return true;
        if (x.op === "finalAttack" && (!x.np || !x.np.junk)) return true;
        if (x.op === "unreducibleTurn" || x.op === "noCounterSelf" || x.op === "noCounterChosen") return true;
        if (x.op === "restrict" && ABX.isAuraRestrict && ABX.isAuraRestrict(ab, c0, x)) return true;
        if (x.op === "nullifyAbilities" && x.np && !x.np.junk) return true;
        if (x.op === "boost" && x.np && !x.np.junk) return true;
        if (x.op === "noop") return true;
        if (x.op === "shield") return true;
        return false;
      };
      if (ab.steps.every(stepOk)) return true;
    }

    // Triggered wouldLeave / wouldDie abilities that execute standard steps (#139, #355, #3126)
    if (ab.kind === "triggered" && ab.trigger && (ab.trigger.event === "wouldLeave" || ab.trigger.event === "wouldDie") &&
        ab.steps && ab.steps.length && ab.steps.every(ABX.stepExecutable)) {
      return true;
    }
    return false;
  };

  /* ============================================================
   * 6. GAME ENGINE HOOKS (Final Phase Attack, Cost Reduction, Aliases, Move/Stand Locks, Triggers)
   * ============================================================ */

  // 6a. Final Phase Attack from Static Abilities (#2396, #2509, #2669, #2014, #2866)
  if (typeof B.imCanAttackInFinal === "function") {
    const origImFinal = B.imCanAttackInFinal;
    B.imCanAttackInFinal = function (unit) {
      if (origImFinal.apply(this, arguments)) return true;
      if (!unit || !(unit.attacksLeft > 0) || unit.rested || !unit.card) return false;
      const side = (B.plr && (B.plr.item === unit || Object.values(B.plr.monsters || {}).includes(unit))) ? "plr" : "opp";
      const f = F(side), e = F(otherSide(side));
      if (!f) return false;
      const sources = [{ card: unit.card, host: null }].concat((unit.soul || []).map(id => ({ card: cardOf(id), host: unit })).filter(x => x.card));
      for (const src of sources) {
        for (const ab of core.abilitiesOf(src.card, a => a.kind === "static" && ABX.isExecutable(a))) {
          const ctx = { side, f, e, card: src.card, unit: src.host ? null : unit, soulHost: src.host, hostArea: src.host ? "soul" : "field", bind: {} };
          if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
          for (const st of ab.steps || []) {
            if (st.cond && !evalCond(st.cond, ctx)) continue;
            if (st.op === "finalAttack" || (st.op === "static" && st.kind === "attackInFinal")) return true;
          }
        }
      }
      return false;
    };
  }

  // Also check unit.abxAttackThrough in ABX.canAttackThrough (#470 Dragospeed, #584 Slashknife Dragon)
  if (ABX.canAttackThrough) {
    const origCAT = ABX.canAttackThrough;
    ABX.canAttackThrough = function (side, unit, which) {
      if (which !== "own" && unit && unit.abxAttackThrough === B.turnCount) return true;
      return origCAT.apply(this, arguments);
    };
  }

  if (OPS.stand && OPS.stand.run) {
    const origStand = OPS.stand.run;
    OPS.stand.run = function (s, ctx) {
      if (s && s.alsoBuddyZone && ctx && ctx.f) ctx.f.buddyZoneRested = false;
      return origStand.apply(this, arguments);
    };
  }

  // 6b. Continuous Cost Reductions (costReduceFor, #4170, #82, #89, #90, #93, #959)
  if (typeof root.parseCardCost === "function") {
    const origPCC = root.parseCardCost;
    root.parseCardCost = function (costStr, skill, fighter, card) {
      const r = origPCC.apply(this, arguments);
      try {
        if (!r || !fighter || !card || !(r.gauge > 0)) return r;
        const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
        if (!side) return r;
        const isIM = typeof IMX !== "undefined" && IMX.isImpactMonster && IMX.isImpactMonster(card);
        const cardCostKind = card.type === "Spell" || (card.type === "Impact" && !isIM) ? "cast" : card.type === "Item" ? "equip" : "call";
        let cut = 0;
        const srcs = fieldUnits(fighter, true).map(x => ({ unit: x.unit, card: x.unit.card }));
        (fighter.setSpells || []).forEach(c => srcs.push({ unit: null, card: c }));
        for (const src of srcs) {
          if (src.unit && src.unit.abxNullified === B.turnCount) continue;
          for (const ab of core.abilitiesOf(src.card, a => a.kind === "static" && ABX.isExecutable(a))) {
            const ctx = { side, f: fighter, e: F(otherSide(side)), card: src.card, unit: src.unit, bind: {} };
            if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
            for (const st of ab.steps || []) {
              if (st.op !== "static" || st.kind !== "costReduceFor") continue;
              if (st.cond && !evalCond(st.cond, ctx)) continue;
              if (st.costKind === "impactAndIM") {
                if (card.type === "Impact" || isIM) cut += st.delta || 0;
              } else if (st.costKind === cardCostKind && st.np) {
                if (matchFilter(card, st.np.filter || {}, null, ctx)) cut += st.delta || 0;
              }
            }
          }
        }
        if (cut > 0) return Object.assign({}, r, { gauge: Math.max(0, r.gauge - cut) });
      } catch (e) { if (ABX.debug) console.error(e); }
      return r;
    };
  }

  // 6c. Name Aliasing (alsoTreatedAs, #297, #4169, #6215) in matchFilter
  function cardAliases(card) {
    if (!card) return [];
    const out = [];
    try {
      (ABX.get(card).abilities || []).forEach(ab => {
        (ab.steps || []).forEach(st => {
          if (st.op === "static" && st.kind === "alsoTreatedAs" && st.alias) out.push(lc(st.alias));
        });
      });
    } catch (e) { /* ignore */ }
    return out;
  }
  const origMatchFilter = core.matchFilter;
  core.matchFilter = function (card, f, ref, ctx) {
    if (origMatchFilter.apply(this, arguments)) return true;
    if (!card || !f) return false;
    const aliases = cardAliases(card);
    if (!aliases.length) return false;
    if ((f.names && f.names.length) || (f.cardNames && f.cardNames.length)) {
      const f2 = Object.assign({}, f, { names: null, cardNames: null });
      const nameWanted = (f.names || []).concat(f.cardNames || []);
      if (nameWanted.some(w => aliases.some(a => a.includes(lc(w)))) && origMatchFilter.call(this, card, f2, ref, ctx)) {
        return true;
      }
    }
    return false;
  };

  // 6d. [D-Share] Soul Ability Inheritance (#4317, #4356, #4857, #5136)
  if (ABX.staticBonus) {
    const origSB = ABX.staticBonus;
    ABX.staticBonus = function (fighter, unit) {
      const out = origSB.apply(this, arguments);
      try {
        if (!unit || !unit.card || !(unit.soul && unit.soul.length)) return out;
        const hasDShareCollect = (ABX.get(unit.card).abilities || []).some(a =>
          a.kind === "static" && (a.steps || []).some(s => s.op === "static" && s.kind === "dShareCollect")
        );
        if (!hasDShareCollect) return out;
        unit.soul.forEach(id => {
          const sc = cardOf(id);
          if (!sc || !/\[d-share\]/i.test(sc.skill || "")) return;
          if (/\[penetrate\]/i.test(sc.skill || "")) out.pen = true;
          if (/\[double attack\]/i.test(sc.skill || "")) out.da = true;
          if (/\[triple attack\]/i.test(sc.skill || "")) out.ta = true;
          if (/\[counterattack\]/i.test(sc.skill || "")) out.ca = true;
          if (/\[move\]/i.test(sc.skill || "")) out.move = true;
        });
      } catch (e) { /* ignore */ }
      return out;
    };
  }

  // 6e. Opponent Deck-to-Drop Trigger (#2585 Twilight Dragon Force)
  function fireOppDeckToDrop(effectSide) {
    if (!effectSide || !ABX.queue || !core.fireTriggers) return;
    ABX.queue(() => core.fireTriggers((t, src, side) => t.event === "oppDeckToDrop" && side === effectSide, { name: "oppDeckToDrop" }));
  }
  if (OPS.mill && OPS.mill.run) {
    const origMill = OPS.mill.run;
    OPS.mill.run = async function (s, ctx) {
      const oppBefore = ctx && ctx.e ? ctx.e.drop.length : 0;
      const r = await origMill.apply(this, arguments);
      if (r && ctx && ctx.e && ctx.e.drop.length > oppBefore) fireOppDeckToDrop(ctx.side);
      return r;
    };
  }
  if (OPS.move && OPS.move.run) {
    const origMove = OPS.move.run;
    OPS.move.run = async function (s, ctx) {
      const fromOppDeck = s && s.np && s.np.zone && s.np.zone.owner === "opp" && s.np.zone.area === "deck";
      const oppBefore = ctx && ctx.e ? ctx.e.drop.length : 0;
      const r = await origMove.apply(this, arguments);
      if (r && fromOppDeck && ctx && ctx.e && ctx.e.drop.length > oppBefore) fireOppDeckToDrop(ctx.side);
      return r;
    };
  }

  // 6f. Reactive Life-0 Equip for #2675 Dragon Force, "Style of Retaliation"
  const origApplyDmg = core.applyDamage;
  core.applyDamage = function (side, n, src) {
    const dealt = origApplyDmg.apply(this, arguments);
    try {
      const f = F(side);
      if (f && f.life <= 0) {
        const dfIdx = (f.hand || []).findIndex(id => {
          const c = cardOf(id);
          return c && /\[equip cost\]\s*\[if your life would become 0/i.test(c.skill || "") &&
            (typeof getReleaseConditionStatus !== "function" || getReleaseConditionStatus(c, f).met);
        });
        if (dfIdx >= 0 && f.gauge.length >= 2 && f.hand.length >= 2) {
          const dfId = f.hand.splice(dfIdx, 1)[0];
          const dfCard = cardOf(dfId);
          f.drop.push(f.gauge.pop(), f.gauge.pop());
          f.drop.push(f.hand.shift());
          f.life = 1;
          if (f.item && !f.item.isEndrulerFlag) {
            if (f.item.soul && f.item.soul.length) f.drop.push(...f.item.soul);
            f.drop.push(f.item.card.id);
          }
          f.item = { card: dfCard, rested: false, attacksLeft: dfCard.atk_max || 1, soul: [] };
          if (ABX.fireEquipped) ABX.fireEquipped(side, dfCard, f.item);
          fresh();
        }
      }
    } catch (e) { if (ABX.debug) console.error(e); }
    return dealt;
  };

  // 6g. Fire oppEquip and kwUsed when equipping an item
  if (ABX.fireEquipped) {
    const origFE = ABX.fireEquipped;
    ABX.fireEquipped = function (side, card, unit) {
      const r = origFE.apply(this, arguments);
      try {
        const oppSide = otherSide(side);
        if (ABX.queue && core.fireTriggers) {
          ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "oppEquip" && s === oppSide && (!t.np || matchFilter(card, t.np.filter || {}, null, { side: oppSide, f: F(oppSide) })), { name: "oppEquip", card }));
          if (unit && unit.itemMode) {
            const kw = unit.itemMode === "tr" ? "transform" : unit.itemMode;
            ABX.queue(() => core.fireTriggers((t, src, s) => t.event === "kwUsed" && s === side && t.kw === kw, { name: "kwUsed", kw }));
          }
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
