/* ==================== ABX — round 15: [Transform] / [Ride] / [Station] ====================
 * The biggest family of unbuilt abilities (tests/coverage.js): 63 cards mention [Transform].
 *  1. MODE COSTS: the "[Transform] [Pay 1 gauge & Return a «X» you are [Transform] into to your hand]" line (also [Ride],
 *     [Station]) is read on its own. Before, equipping used the card's general cost: the [Call Cost] when it had one, and
 *     nothing at all when the line started with a keyword ("[Penetrate] [Transform] [Pay 2 gauge ...]") or had a nested
 *     "[Transform]" in it — so many of these cards transformed for free and the extra parts were ignored.
 *  2. EQUIPPING: battle.equipCardFromHand pays that cost, checks "you are [Transform] into a «X»" requirements, and returns /
 *     drops the old card as the cost says. Cards that "cannot [Transform] other than by the [Act] of X" only transform
 *     through a card effect.
 *  3. EFFECTS: "[Transform] into this card from your hand by paying the [Transform] cost" and "[Transform] into
 *     (up to one) <cards> from your hand / drop zone / deck by paying its [Transform] cost".
 * Loaded after abilities_r14.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, cardOf, matchFilter } = core;
  const toNum = (w) => { if (/^(?:a|an|one)$/i.test(w)) return 1; const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10); return isNaN(n) ? null : n; };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const MODES = { transform: "Transform", ride: "Ride", station: "Station" };

  /* ============================================================
   * 1. MODE COSTS
   * ============================================================ */
  // body of the bracket that follows "[Transform]" / "[Ride]" / "[Station]" on a cost line (nested brackets allowed)
  function modeCostBody(line) {
    const re = /\[(transform|ride|station)\]\s*\[/ig;
    let m;
    while ((m = re.exec(line))) {
      let depth = 0, i = m.index + m[0].length - 1, start = i + 1;
      for (; i < line.length; i++) {
        if (line[i] === "[") depth++;
        else if (line[i] === "]" && --depth === 0) break;
      }
      const body = line.slice(start, i).trim();
      // "[Ride] [Double Attack]" is a keyword list, not a cost
      if (/\b(?:pay|return|put|drop|discard)\b/i.test(body)) return { mode: m[1].toLowerCase(), body };
    }
    return null;
  }
  const COST_CACHE = new Map();
  function modeCost(card) {
    if (!card) return null;
    if (COST_CACHE.has(card.id)) return COST_CACHE.get(card.id);
    let out = null;
    for (const line of String(card.skill || "").split(/\n+/)) {
      if (/^\s*\[(?:counter|act)\]/i.test(line)) continue;   // "[Counter] [Act] ... [Transform] into this card" is an effect
      const mb = modeCostBody(line);
      if (!mb) continue;
      out = { mode: mb.mode, gauge: 0, life: 0, parts: [], unknown: [] };
      mb.body.split(/\s*&\s*|\.\s+(?=then,)/i).forEach(raw => {
        const p = raw.trim().replace(/\.$/, "");
        let m;
        if ((m = p.match(/^pay (\d+|one|two|three) gauge$/i))) out.gauge += toNum(m[1]);
        else if ((m = p.match(/^pay (\d+|one|two|three) life$/i))) out.life += toNum(m[1]);
        else if ((m = p.match(/^return (up to one |a |an )?(.+?) (?:that )?you are \[(?:transform|ride)\](?: into| as| on)? (?:back )?(?:in)?to (?:your )?hand$/i)))
          out.parts.push({ kind: "returnItem", np: NP(m[2]), optional: /up to/i.test(m[1] || ""), raw: p });
        else if (/^return up to one item on your field to your hand$/i.test(p)) out.parts.push({ kind: "returnAnyItem", optional: true, raw: p });
        else if ((m = p.match(/^put (?:a |an )?(.+?) you are \[(?:transform|ride)\](?: into| as| on)?,? into (?:the|your) drop zone$/i)))
          out.parts.push({ kind: "itemToDrop", np: NP(m[1]), raw: p });
        else if ((m = p.match(/^(?:then, )?put (up to )?(\w+) (.+?) from your drop zone into (?:this card's|its) soul$/i)))
          out.parts.push({ kind: "soulFromDrop", n: toNum(m[2]) || 1, upTo: !!m[1], np: NP(m[3]), raw: p });
        // "Put this card on top of a «X» you are [Ride] on / [Station] at (on your field)" / "Put this on top of your equipped "X""
        else if ((m = p.match(/^put (?:this|it)(?: card)? on top of (?:a |an )?(.+?) you are \[(?:transform|ride|station)\](?: into| on| at| as)?(?: on your field)?$/i)) ||
                 (m = p.match(/^put (?:this|it)(?: card)? on top of your equipped (.+)$/i)))
          out.parts.push({ kind: "onTopItem", np: /^card$/i.test(m[1].trim()) ? null : NP(m[1]), raw: p });
        // "Discard / Drop a «X» from your hand"
        else if ((m = p.match(/^(?:discard|drop) (?:a |an |one )?(.+?) from your hand$/i)))
          out.parts.push({ kind: "discard", np: NP(m[1]), raw: p });
        // "Put the top N cards of your deck into its soul"
        else if ((m = p.match(/^put the top (?:(\w+) cards?|card)(?: from the top)? (?:of|or) your deck into (?:this card's|its) soul$/i)) ||
                 (m = p.match(/^put the top (\w+) cards from the top of your deck into (?:this card's|its) soul$/i)))
          out.parts.push({ kind: "soulFromDeck", n: m[1] ? toNum(m[1]) || 1 : 1, raw: p });
        else out.unknown.push(p);
      });
      break;
    }
    COST_CACHE.set(card.id, out);
    return out;
  }
  ABX.modeCost = modeCost;
  const itemMatches = (f, np) => !!(f.item && !f.item.isEndrulerFlag && (!np || matchFilter(f.item.card, np.filter || {}, null, { f })));
  // "This card cannot [Transform] other than by the [Act] of "X"": only a card effect may transform into it
  const effectOnly = (card) => /cannot \[(?:transform|ride)\] other than by (?:the )?\[act\] of/i.test(card && card.skill || "");

  // hand index of a card that pays "Discard a «X» from your hand" (not the card being equipped)
  function discardPick(f, card, p) {
    let skipped = false;
    for (let i = 0; i < f.hand.length; i++) {
      if (f.hand[i] === card.id && !skipped) { skipped = true; continue; }
      const c = cardOf(f.hand[i]);
      if (c && (!p.np || matchFilter(c, p.np.filter || {}, null, { f }))) return { idx: i };
    }
    return null;
  }

  // can `side` pay this card's mode cost right now? -> { ok, reasons, cost }
  function canModeEquip(side, card, byEffect) {
    const f = F(side), cost = modeCost(card), reasons = [];
    if (f.item && f.item.isEndrulerFlag) reasons.push(`Your Flag/Item slot is held by "${f.item.card.name}"`);
    if (effectOnly(card) && !byEffect) reasons.push("It can only be [Transform]ed into by another card's ability");
    if (!cost) return { ok: reasons.length === 0, reasons, cost };
    if (f.gauge.length < cost.gauge) reasons.push(`Needs ${cost.gauge} gauge`);
    if (cost.life && f.life <= cost.life) reasons.push(`Needs more than ${cost.life} life`);
    cost.parts.forEach(p => {
      if ((p.kind === "returnItem" && !p.optional) || p.kind === "itemToDrop" || p.kind === "onTopItem") {
        if (!itemMatches(f, p.np)) reasons.push(`You must be [${MODES[cost.mode]}] into ${p.np && p.np.raw ? p.np.raw : "the required card"}`);
      }
      if (p.kind === "discard" && !discardPick(f, card, p)) reasons.push(`You need ${p.np && p.np.raw ? p.np.raw : "a card"} in your hand to discard`);
    });
    return { ok: reasons.length === 0, reasons, cost };
  }
  ABX.canModeEquip = canModeEquip;

  /* ============================================================
   * 2. EQUIPPING FROM HAND
   * ============================================================ */
  if (typeof B.equipCardFromHand === "function") {
    const origEquip = B.equipCardFromHand;
    B.equipCardFromHand = function (side, handIdx, modeLabel) {
      const f = this.getFighter(side);
      const c = CARD_MAP.get(f.hand[handIdx]);
      const cost = c && modeCost(c);
      const isMode = modeLabel === "Transform" || modeLabel === "Ride" || modeLabel === "Station";
      // a cost this round can't read yet keeps the old behavior instead of becoming unplayable
      if (!c || !isMode || (!cost && !effectOnly(c)) || (cost && cost.unknown.length)) return origEquip.apply(this, arguments);
      const byEffect = !!ABX._modeByEffect;
      const chk = canModeEquip(side, c, byEffect);
      const rel = typeof getReleaseConditionStatus === "function" ? getReleaseConditionStatus(c, f) : { met: true, reasons: [] };
      if (!rel.met) chk.reasons.push(...rel.reasons);
      if (chk.reasons.length) {
        if (!f.isBot && !byEffect) alert(`Cannot [${modeLabel}] "${c.name}":\n• ${chk.reasons.join("\n• ")}`);
        else if (B.setPrompt) B.setPrompt(`✖ Cannot [${modeLabel}] "${c.name}": ${chk.reasons[0]}.`);
        return false;
      }
      const free = !!ABX._modeFree;
      const parts = (cost && !free) ? cost.parts : [];
      if (cost && !free) {
        for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
        if (cost.life > 0) f.life = Math.max(1, f.life - cost.life);
        parts.filter(p => p.kind === "discard").forEach(p => { const d = discardPick(f, c, p); if (d) f.drop.push(f.hand.splice(d.idx, 1)[0]); });
      }
      const soul = [];
      // the card you are transformed into goes where the cost says (otherwise: drop zone, or hand for [Equipment Change])
      const old = f.item && !f.item.isEndrulerFlag ? f.item : null;
      if (old) {
        const onTop = parts.some(p => p.kind === "onTopItem");
        const toHand = parts.some(p => (p.kind === "returnItem" && itemMatches(f, p.np)) || p.kind === "returnAnyItem") || c.eqc;
        if (onTop) soul.push(...(old.soul || []), old.card.id);   // "put this on top of it": it and its soul go under
        else {
          if (old.soul && old.soul.length) f.drop.push(...old.soul);
          (toHand ? f.hand : f.drop).push(old.card.id);
        }
        f.item = null;
      }
      f.hand.splice(f.hand.indexOf(c.id), 1);
      if (c.sg && f.deck.length) soul.push(f.deck.shift());
      parts.filter(p => p.kind === "soulFromDeck").forEach(p => { for (let n = 0; n < p.n && f.deck.length; n++) soul.push(f.deck.shift()); });
      parts.filter(p => p.kind === "soulFromDrop").forEach(p => {
        for (let n = 0; n < p.n; n++) {
          const i = f.drop.findIndex(id => { const dc = cardOf(id); return dc && (!p.np || matchFilter(dc, p.np.filter || {}, null, { f })); });
          if (i < 0) break;
          soul.push(f.drop.splice(i, 1)[0]);
        }
      });
      const fromHandId = side === "plr" ? "bt-plr-hand" : "hud-opp-target";
      const toItemZone = side === "plr" ? "z-plr-item" : "z-opp-fighter";
      this.animateCardFlight(fromHandId, toItemZone, c.img, `🗡️ ${modeLabel.toUpperCase()}!`, 0, () => {
        f.item = { card: c, rested: false, attacksLeft: c.atk_max || 1, soul, itemMode: cost ? cost.mode : modeLabel.toLowerCase() };
        const eff = typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(f, f.item) : null;
        if (eff) f.item.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (c.atk_max || 1);
        this.showCutin(`${modeLabel.toUpperCase()}!`, c.name, c.img);
        this.setPrompt(`🗡️ [${modeLabel}] "${c.name}" (Pow ${c.power || 0} / Crit ${c.crit || 1})!`);
        this.renderBattle();
        if (ABX.fireEquipped) ABX.fireEquipped(side, c, f.item);
        if (this.mode === "online_p2p" && this.sendOnlineStateToPeer) this.sendOnlineStateToPeer();
      });
      return true;
    };
  }

  /* ============================================================
   * 3. RULE: "This card cannot [Transform] other than by the [Act] of "X""
   * ============================================================ */
  const pal15 = ABX.parseAbilityLine;
  // a sentence that starts with "[Transform] into ..." lost its verb: a leading "[...]" is read as a keyword tag
  const lead = (t) => String(t || "").replace(/(^|\]\s*|[.!]\s+)\[transform\] into\b/gi, "$1Transform into");
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = lead(rawLine);
    const ab = pal15.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    const body = ABX.clean(rawLine || "").trim();
    if (ab && /^this card cannot \[(?:transform|ride)\] other than by (?:the )?\[act\] of "[^"]+"[.!]?$/i.test(body))
      return Object.assign(ab, { kind: "rule", steps: [], unparsed: [], parsed: true, r15modeRule: true });
    // mode cost lines ("[Penetrate] [Transform] [Pay 1 gauge & Return ...]") are costs, read by modeCost above
    if (ab && card && modeCostBody(body) && !/^\s*\[(?:counter|act)\]/i.test(body) && ab.unparsed && ab.unparsed.length) {
      const mc = modeCost(card);
      if (mc && !mc.unknown.length) return Object.assign(ab, { kind: "cost", costKind: mc.mode, steps: [], unparsed: [], parsed: true });
    }
    return ab;
  };
  const prl15 = ABX.parseRuleLine;
  if (prl15) {
    ABX.parseRuleLine = function (line, card) {
      const ab = prl15.call(this, line, card);
      if (ab && /^this card cannot \[(?:transform|ride)\] other than by (?:the )?\[act\] of "[^"]+"[.!]?$/i.test(ABX.clean(line || "").trim()))
        return Object.assign(ab, { kind: "rule", steps: [], unparsed: [], parsed: true, r15modeRule: true });
      return ab;
    };
  }

  /* ============================================================
   * 4. EFFECTS
   * ============================================================ */
  // equip `cardId` (already in hand) through the mode path, as a card effect
  function equipByEffect(side, cardId, free) {
    const f = F(side), i = f.hand.lastIndexOf(cardId);
    if (i < 0) return false;
    ABX._modeByEffect = true; ABX._modeFree = !!free;
    try { return B.equipCardFromHand(side, i, "Transform") !== false; }
    finally { ABX._modeByEffect = false; ABX._modeFree = false; }
  }
  OPS.transformSelf = {
    run(s, ctx) {
      const card = ctx.card;
      if (!card || !canModeEquip(ctx.side, card, true).ok) return false;
      const ok = equipByEffect(ctx.side, card.id, false);
      fresh();
      return ok;
    },
    check: () => true
  };
  OPS.transformFrom = {
    async run(s, ctx) {
      const f = ctx.f, side = ctx.side;
      const areas = s.areas || ["hand"];
      const cands = [];
      areas.forEach(area => {
        const arr = area === "drop zone" ? f.drop : area === "deck" ? f.deck : f.hand;
        const key = area === "drop zone" ? "drop" : area;
        arr.forEach((id, idx) => {
          const c = cardOf(id);
          if (!c || c.type !== "Monster" || !(c.tr || modeCost(c))) return;
          if (s.np && !matchFilter(c, s.np.filter || {}, null, ctx)) return;
          if (!s.free && !canModeEquip(side, c, true).ok) return;
          cands.push({ k: "zone", side, area: key, idx, id, card: c });
        });
      });
      if (s.areas && s.areas.includes("deck") && s.shuffle) { /* shuffled below */ }
      if (!cands.length) { if (s.shuffle && B.shuffleFighterDeck) B.shuffleFighterDeck(side); return false; }
      const ch = await core.pick(cands, { qty: { n: 1, upTo: true } }, ctx, { intent: "help", title: `${ctx.card.name} — [Transform] into` });
      const r = ch && ch[0];
      let ok = false;
      if (r) {
        const arr = r.area === "drop" ? f.drop : r.area === "deck" ? f.deck : f.hand;
        if (r.area !== "hand") { const i = arr.indexOf(r.id); if (i >= 0) { arr.splice(i, 1); f.hand.push(r.id); } }
        ok = equipByEffect(side, r.id, s.free);
        if (!ok && r.area !== "hand") { const i = f.hand.lastIndexOf(r.id); if (i >= 0) { f.hand.splice(i, 1); arr.push(r.id); } }
      }
      if (s.shuffle && B.shuffleFighterDeck) B.shuffleFighterDeck(side);
      fresh();
      return ok;
    },
    check: () => true
  };

  const A15 = [];
  // "[Transform] into this card (from your hand / from the field) by paying the/its [Transform] cost"
  A15.push([/^(?:you may )?(?:\[transform\]|transform) into this card(?: from (?:your hand|the field))? by paying (?:the|its|it's) \[transform\] cost$/i, () => ({ op: "transformSelf" }), false]);
  A15.push([/^(?:you may )?(?:\[transform\]|transform) into this card from (?:your hand|the field)$/i, () => ({ op: "transformSelf" }), false]);
  // "[Transform] into (up to one) <cards> from your hand / drop zone / deck (or ...) by paying its [Transform] cost(, and shuffle your deck)"
  A15.push([/^(?:you may )?(?:\[transform\]|transform) into (up to one |a |an )?(.+?) from your (hand|drop zone|deck)(?: or (hand|drop zone|deck))? by paying its \[transform\] cost(?:,? and shuffle your deck)?$/i, (m) => {
    const np = /^card with \[transform\]$/i.test(m[2].trim()) ? null : NP(m[2]);
    if (m[2] && !np && !/^card with \[transform\]$/i.test(m[2].trim())) return null;
    const areas = [m[3], m[4]].filter(Boolean).map(a => a.toLowerCase());
    return { op: "transformFrom", np, areas, shuffle: areas.includes("deck"), optional: /up to/i.test(m[1] || "") };
  }, false]);
  // "choose (up to one) <cards> with [Transform] in your deck, [Transform] into it by paying its [Transform] cost, and shuffle your deck"
  A15.push([/^choose (up to one |a |an )?(.+?) in your (deck|hand|drop zone), \[transform\] into it by paying its \[transform\] cost,? and shuffle your deck$/i, (m) => {
    const np = NP(m[2]); if (!np) return null;
    return { op: "transformFrom", np, areas: [m[3].toLowerCase()], shuffle: true, optional: true };
  }, false]);
  // Card Winder: "choose a monster with "Caardian" in its card name from your hand or deck and [Transform] into it" (+ "If you searched your deck, shuffle it.")
  A15.push([/^choose (?:a |an |up to one )?(.+?) from your (hand|deck|drop zone)(?: or (hand|deck|drop zone))? and \[transform\] into it$/i, (m) => {
    const np = NP(m[1]); if (!np) return null;
    const areas = [m[2], m[3]].filter(Boolean).map(a => a.toLowerCase());
    return { op: "transformFrom", np, areas, shuffle: areas.includes("deck"), free: true };
  }, false]);
  A15.push([/^if you searched your deck, shuffle it$/i, () => ({ op: "noop", note: "shuffled by transformFrom" }), false]);
  ABX.ACTION_RULES.unshift(...A15);

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
