/* ==================== ABX — round 10 (part 3) ====================
 *  1. Field [Counter] [Act] abilities are a PLAYER CHOICE in the defense window (when the opponent attacks):
 *     monsters and the item on your field, [Set] spells, cards in a soul ("put this card from the soul of ..."),
 *     and cards in the drop zone ("put this card from your drop zone on the bottom of your deck ...").
 *     Before, these were never offered while defending (only your own turn's "Use Card Ability" button),
 *     and the old code let you play some of these MONSTERS / ITEMS from the hand like a [Counter] spell.
 *  2. New text: "During the battle a «X» on your field is being attacked" (condition) and "end that battle" (effect).
 *     e.g. Time General, Zeitwelg (6046).
 *  3. ABX.ownsTriggerLine: lets the old code skip a "When this card link attacks ..." line the new engine runs itself.
 * Loaded after abilities_r9.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, evalCond, cardOf, fieldUnits, abilitiesOf, onceUsed, markOnce, costAffordable, runAbility } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const cut = (t, s, img) => { try { if (B.showCutin && !ABX.fast) B.showCutin(t, s, img); } catch (e) { /* ignore */ } };
  const fresh = () => { try { B.renderBattle(); } catch (e) { /* ignore */ } };

  /* ============================================================
   * 1. PARSER: "During the battle a «X» on your field is being attacked" / "end that battle"
   * ============================================================ */
  const C = [];
  C.push([/^during the battle (?:where |in which |when |that )?(?:a|an|one or more|your) (.+?) on your field (?:is|are) being attacked$/i,
    (m) => { const np = NP("a " + m[1] + " on your field"); return np ? { t: "xAllyAttacked", np } : null; }]);
  C.push([/^during the battle (?:where |in which |when |that )?(?:a|an|your) (?:monster|card) on your field (?:is|are) being attacked$/i, () => ({ t: "underAttack" })]);
  C.push([/^during the battle (?:where |in which |when |that )?you are being attacked$/i, () => ({ t: "underAttack" })]);
  ABX.COND_RULES.unshift(...C);

  const A = [];
  A.push([/^end (?:that|the|this) battle$/i, () => ({ op: "endBattle" }), false]);
  ABX.ACTION_RULES.unshift(...A);

  // Ending a battle is not "nullifying an attack": "this attack cannot be nullified" does not stop it.
  OPS.endBattle = {
    run(s, ctx) {
      const bc = ABX.battleCtx;
      if (!bc || !bc.active) return false;
      bc.nullified = true; bc.ended = true;
      if (B.setPrompt) B.setPrompt(`⏹️ "${ctx.card.name}" ended the battle!`);
      return true;
    }
  };

  /* ============================================================
   * 2. FIELD [Counter] [Act] IN THE DEFENSE WINDOW
   * ============================================================ */
  const FROM_HAND = /\bthis card from (?:your )?hand\b|\bthis hand card\b|\b(?:discard|drop) this card\b(?! from (?:the|your) (?:field|soul|drop))|\bthis card in your hand\b|\breveal this card\b|\bcall this card\b/i;
  const FROM_DROP = /\bthis card from (?:your |the )?drop zone\b/i;
  const FROM_SOUL = /\bthis card from (?:the |its |this card's )?soul\b|\bthis card from the soul of\b/i;
  const DEF_OPS = new Set(["nullifyAttack", "endBattle", "shield", "redirectAttack", "nullifyKeyword", "nullifyAbilities"]);

  function allSteps(ab) {
    const out = [];
    const walk = (ss) => (ss || []).forEach(s => { if (!s) return; out.push(s); walk(s.steps); walk(s.then); walk(s.else); });
    walk(ab.steps); (ab.options || []).forEach(o => walk(o.steps));
    return out;
  }
  // is this a [Counter] [Act] that makes sense while the opponent is attacking?
  function isDefenseAct(ab) {
    if (!ab || (ab.kind !== "act" && ab.kind !== "modal")) return false;
    if (!(ab.tags || []).includes("counter")) return false;
    if (ab.trigger && ab.trigger.event === "oppCast") return false;          // answered in the spell response window
    if (!ABX.isExecutable(ab)) return false;
    const txt = ab.cleaned || ab.raw || "";
    if (FROM_HAND.test(txt)) return false;                                   // used from the hand (handled elsewhere)
    // Any [Counter] [Act] may be used while the opponent attacks (its own conditions decide when it works),
    // e.g. "this card gets defense+5000", "destroy a size 1 or less monster", not only "nullify the attack".
    return true;
  }
  ABX.stopsAttack = (ab) => allSteps(ab).some(s => DEF_OPS.has(s.op));
  function srcArea(ab) {
    const txt = ab.cleaned || ab.raw || "";
    if ((ab.conds || []).concat(allSteps(ab).map(x => x.cond).filter(Boolean)).some(c => c && c.t === "selfInSoulOf")) return "soul";   // "If this card is in the soul of ..."
    if (FROM_DROP.test(txt)) return "drop";
    if (FROM_SOUL.test(txt)) return "soul";
    return "field";
  }
  ABX.isDefenseAct = isDefenseAct;

  function battleCtxFor(defSide, info) {
    const attSide = otherSide(defSide), attF = F(attSide), defF = F(defSide);
    const zones = info.attackerZones || [];
    const attUnits = info.attUnits || zones.map(z => z === "item" ? attF.item : attF.monsters[z]).filter(Boolean);
    return {
      active: true, attSide, defSide, nullified: false, redirectTo: null, link: attUnits.length > 1, attUnits,
      defUnit: ["left", "center", "right"].includes(info.targetPos) ? defF.monsters[info.targetPos] : null, targetPos: info.targetPos
    };
  }
  const leadCostsOK = (ab, ctx) => {
    const steps = ab.kind === "modal" ? (ab.steps || []) : (ab.steps || []);
    for (const st of steps) {
      if (st.gate) break;
      if ((st.cost || st.optional || st.op === "pay") && !costAffordable(st, ctx)) return false;
      if (st.cond && !evalCond(st.cond, ctx)) return false;
      if (!st.cost && !st.optional && st.op !== "pay") break;
    }
    return true;
  };
  const optKey = (src, ab) => [src.area, src.card.id, ab.idx, src.pos || "", src.idx == null ? "" : src.idx].join(":");

  // Everything `defSide` can use from the field / soul / drop zone right now, while being attacked.
  // info: { attackerZones | attUnits, targetPos }
  ABX.fieldCounterOptions = function (defSide, info) {
    const f = F(defSide), e = F(otherSide(defSide)), out = [];
    if (!f || ABX.enabled === false || f.timeStoppedThisTurn || f.timeStoppedThisBattle) return out;
    const srcs = [];
    fieldUnits(f, true).forEach(x => {
      srcs.push({ unit: x.unit, card: x.unit.card, area: "field", pos: x.pos || core.posOfUnit(f, x.unit) || "item" });
      (x.unit.soul || []).forEach((sid, si) => { const c = cardOf(sid); if (c) srcs.push({ unit: null, card: c, area: "soul", host: x.unit, idx: si }); });
    });
    (f.setSpells || []).forEach((c, si) => srcs.push({ unit: null, card: c, area: "set", idx: si }));
    (f.drop || []).forEach((id, di) => { const c = cardOf(id); if (c && /drop zone/i.test(c.skill || "") && /\[counter\]/i.test(c.skill || "")) srcs.push({ unit: null, card: c, area: "drop", idx: di }); });
    const prev = ABX.battleCtx;
    ABX.battleCtx = battleCtxFor(defSide, info);
    try {
      const seen = new Set();
      for (const src of srcs) {
        if (src.unit && src.unit.abxNullified === B.turnCount) continue;
        if (src.host && src.host.abxNullified === B.turnCount) continue;
        for (const ab of abilitiesOf(src.card, isDefenseAct)) {
          const where = srcArea(ab);
          if (where === "drop" ? src.area !== "drop" : where === "soul" ? src.area !== "soul" : !(src.area === "field" || src.area === "set")) continue;
          if (onceUsed(f, src.card, ab, src.unit)) continue;
          const selfRef = src.area === "drop" ? { k: "zone", side: defSide, area: "drop", idx: src.idx, id: src.card.id, card: src.card }
            : src.area === "soul" ? { k: "soul", side: defSide, unit: src.host, idx: src.idx, id: src.card.id, card: src.card } : null;
          const hostArea = src.area === "set" ? "field" : src.area;
          const ctx = { side: defSide, f, e, card: src.card, unit: src.unit, ab, bind: { chosen: src.host ? [{ k: "unit", side: defSide, unit: src.host, card: src.host.card, id: src.host.card.id }] : [], revealed: [], looked: [] },
            lastDone: true, auto: true, log: [], hostArea, soulHost: src.host || null, selfRef, event: { name: "counter" } };
          if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
          if (!leadCostsOK(ab, ctx)) continue;
          const key = optKey(src, ab);
          if (seen.has(key)) continue;
          seen.add(key);
          const nullifies = allSteps(ab).some(s => s.op === "nullifyAttack" || s.op === "endBattle");
          out.push({
            key, card: src.card, ab, area: src.area, unit: src.unit, nullifies,
            label: `✨ "${src.card.name}"${src.area === "drop" ? " (drop zone)" : src.area === "soul" ? " (soul)" : src.area === "set" ? " ([Set])" : ""}`,
            sub: ABX.clean(ab.raw || ab.cleaned || "").slice(0, 160),
            run: async () => {
              markOnce(f, src.card, ab, src.unit);
              cut("COUNTER — ABILITY!", src.card.name, src.card.img);
              await runAbility(defSide, src.card, ab, src.unit, { event: { name: "counter" }, hostArea, soulHost: src.host || null, selfRef, preApproved: true, auto: !!f.isBot || (B.mode === "online_p2p" && defSide === "opp") });
            }
          });
        }
      }
    } catch (err) { if (ABX.debug) console.error(err); }
    finally { ABX.battleCtx = prev; }
    return out;
  };

  // Run the option with this key. Resolves to { nullified, targetPos }.
  ABX.useFieldCounter = async function (defSide, key, info) {
    const opt = ABX.fieldCounterOptions(defSide, info).find(o => o.key === key);
    if (!opt) return { nullified: false, targetPos: info.targetPos, used: false };
    const bc = ABX.battleCtx = battleCtxFor(defSide, info);
    try { await opt.run(); } catch (e) { if (ABX.debug) console.error(e); }
    ABX.battleCtx = null;
    fresh();
    return { nullified: !!bc.nullified, ended: !!bc.ended, targetPos: bc.redirectTo || info.targetPos, used: true };
  };

  // Bot: use a field ability that stops the attack when it is worth it.
  ABX.botFieldCounterPick = function (defSide, info, opts) {
    const f = F(defSide), attF = F(otherSide(defSide));
    const stop = (opts || []).filter(o => o.nullifies);
    if (!stop.length) return null;
    const units = info.attUnits || (info.attackerZones || []).map(z => z === "item" ? attF.item : attF.monsters[z]).filter(Boolean);
    const stat = (fi, u) => (typeof getUnitEffectiveCombatStats === "function" ? getUnitEffectiveCombatStats(fi, u) : { power: 0, defense: 0, crit: 1 });
    if (info.targetPos === "fighter") {
      const dmg = units.reduce((a, u) => a + stat(attF, u).crit, 0);
      return f.life - dmg <= 4 ? stop[0] : null;
    }
    const m = f.monsters[info.targetPos];
    if (!m) return null;
    const pow = units.reduce((a, u) => a + stat(attF, u).power, 0);
    return pow >= stat(f, m).defense ? stop[0] : null;
  };

  /* ============================================================
   * 3. HELPERS FOR THE OLD CODE
   * ============================================================ */
  // Does the new engine run this (triggered / activated) line itself?
  const OWN_CACHE = new Map();
  ABX.ownsTriggerLine = function (card, line) {
    if (!card) return false;
    const k = card.id + "|" + line;
    if (OWN_CACHE.has(k)) return OWN_CACHE.get(k);
    const n = ABX.norm(ABX.clean ? ABX.clean(line) : line);
    let r = false;
    try { r = abilitiesOf(card, a => a.kind !== "static" && ABX.isExecutable(a)).some(a => ABX.norm(a.raw || a.cleaned || "") === n || ABX.norm(ABX.clean ? ABX.clean(a.raw || "") : (a.raw || "")) === n); } catch (e) { r = false; }
    OWN_CACHE.set(k, r);
    return r;
  };
  // Is `unit` taking part in a link attack right now?
  ABX.inLinkAttack = function (unit) {
    const b = ABX.curBattle && ABX.curBattle.turn === B.turnCount ? ABX.curBattle : (ABX.battleCtx && ABX.battleCtx.active ? ABX.battleCtx : null);
    return !!(b && (b.attUnits || []).length > 1 && b.attUnits.includes(unit));
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
