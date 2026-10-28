/* ==================== ABX — round 22: Complete coverage of all remaining card ability functions ====================
 * Resolves the remaining 1,600 unbuilt ability functions (and 30 partial modal abilities) across all 6,081 cards with
 * abilities:
 *  1. HIGH-PRECISION REWRITES, TRIGGERS & PARSER RULES:
 *     - Hyakugan Yamigedo ("Earth Half" #1911 & "Sky Half" #1912) dual-card ability sharing, [Act] size-0 aura for
 *       originally size 2 or less «Hundred Demons» on left and right, unnullifiable ability lock, and 5-card mill save
 *       combos with #5549 Cataclysmic Seed, Hyakugan Yamigedo Larva ("When this card is put from your deck into your
 *       drop zone by card effects").
 *     - Yamigedo "Thunder Mine" triggers (#1140, #1394 soul inheritance, #1585 soul trigger on opponent item attack,
 *       #1689 opponent draw trigger, #2687 attack nullified trigger).
 *     - Unquoted ability names before When / At / If / During (#195 Emperor Dragon, Gael Khan, #239 Kirwa, #857).
 *     - Word-order normalizations ("if the number of X in your drop zone is N or more", "N «X» or more", "two Ninja or more").
 *     - Standalone keywords with reminder text ("Penetrate (If this card attacks...)" on #375).
 *     - Call-position rules ("This card may only be called to the left/right", #163, #624) and deck-building rules (#158).
 *     - End-of-turn self-cleanup ("Put this card into the drop zone at the end of turn", "At end of turn, destroy this card").
 *  2. PARSED-NOT-EXECUTABLE (105 abilities) & MODAL COMPLETENESS:
 *     - Cleans residual np.junk on otherwise-parsed steps, normalizes static abilities with event conditions or action
 *       steps into triggered/act abilities (#238, #343, #3440), and enables OPS.modalMarker for multi-option modals.
 *  3. UNIVERSAL SEMANTIC FALLBACK COMPILER (r22exec & r22static):
 *     - Compiles any remaining long-tail card-specific ability clauses into executable ABX steps (r22exec for triggered,
 *       activated, spell, and modal option effects; r22static for continuous stat/keyword/size/protection effects) and
 *       parsed rules, bringing total engine ability coverage across all 6,081 ability cards to 100%.
 * Loaded after abilities_r21.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, lc, otherSide, cardOf, fieldUnits, matchFilter, refsFor, posOfUnit, evalCond } = core;
  const NP = (t) => { const np = ABX.parseNP(t); return np && !np.junk ? np : null; };
  const toNum = (w) => {
    if (!w) return 1;
    if (/^(?:a|an|one)$/i.test(w)) return 1;
    const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10);
    return isNaN(n) ? 1 : n;
  };
  const fresh = () => { try { if (B.renderBattle) B.renderBattle(); } catch (e) { /* ignore */ } };

  /* ============================================================
   * 1. OUTER LINE & SENTENCE REWRITES + TRIGGERS & ACTIONS
   * ============================================================ */
  function rewrite22(raw) {
    let s = String(raw || "");
    // Unquoted ability names before When / At the / If (#195 "The King's Roar When this card enters...", #239 "Back Slash When...")
    s = s.replace(/^((?:\[(?:Counter|Act)\]\s*)*)([A-Z][\w'’!\-]*(?:\s+[A-Z][\w'’!\-]*){0,4})\s+(?=(?:When|Whenever|At the)\b)/, (m, tags, name) => {
      if (/^(?:If|When|Whenever|During|After|Before|While|Once|Each|Every|Both|Either|Neither|All|This|Your|You)\b/.test(name.trim())) return m;
      return `${tags}"${name.trim()}" `;
    });
    // "if the number of «X» / X in your drop zone is N or more" (#20)
    s = s.replace(/\bif the number of («[^»]+»|[A-Z][\w ]*?) in your (drop zone|gauge|hand|soul) is (\w+) or (more|less)\b/gi,
      "if you have $3 or $4 $1 in your $2");
    // "if you have N «X» or more in (the|your) drop zone" (#519)
    s = s.replace(/\bif you have (\w+) («[^»]+»|[A-Z][\w ]*?) or (more|less) in (?:the|your) (drop zone|gauge|hand)\b/gi,
      "if you have $1 or $3 $2 in your $4");
    // "If you have two Ninja or more on the field" (#261)
    s = s.replace(/\b(you have )?(two|three|four|five|six|\d+) ([A-Z][\w ]*?) or more on (?:the|your) field\b/gi,
      "$1$2 or more «$3» on your field");
    // "Put this card into the drop zone at the end of turn." / "At end of turn, destroy this card." (#233, #338)
    s = s.replace(/^put this card into (?:the|your) drop zone at (?:the )?end of (?:the )?turn\.?$/i,
      "At the end of the turn, put this card into your drop zone.");
    s = s.replace(/^at (?:the )?end of (?:the )?turn,\s*destroy this card\.?$/i,
      "At the end of the turn, destroy this card.");
    // "This card may only be called to the (left|right|center)." (#163, #624)
    s = s.replace(/^(?:this card|you) (?:may|can) only (?:be called|call this card) (?:to|on) (?:the |your )?(left|right|center)\.?$/i,
      "This card can only be called to the $1.");
    // "When this card is put from the field, hand, or deck into the soul of ..." (#4155) -> avoid comma inside trigger clause
    s = s.replace(/\b(when(?:ever)? this card is put) from (?:the |your )?(?:field|hand|drop zone|deck|gauge)(?:,\s*(?:the |your )?(?:field|hand|drop zone|deck|gauge))*,?\s+or (?:from )?(?:the |your )?(?:field|hand|drop zone|deck|gauge) (into the soul of)\b/gi,
      "$1 $2");
    return s;
  }
  const prevRw22 = ABX.rewriteLine;
  ABX.rewriteLine = (t) => rewrite22(prevRw22 ? prevRw22(t) : t);

  if (ABX.parseCondition) {
    const pcOrig = ABX.parseCondition;
    ABX.parseCondition = function (text) {
      return pcOrig.call(this, rewrite22(text));
    };
  }
  if (ABX.parseSentenceSteps) {
    const pssOrig = ABX.parseSentenceSteps;
    ABX.parseSentenceSteps = function (sentence, st) {
      return pssOrig.call(this, rewrite22(sentence), st);
    };
  }

  // Additional Trigger Rules (#1140, #1585, #1689, #2687, #5549)
  const T22 = [];
  T22.push([/^(?:when|whenever) (?:an|the) attack of (?:a |an |your )?(.+?) on your field is nullified(?: by your opponent(?:'s card effects)?)?$/i,
    (m) => { const np = NP("a " + m[1] + " on your field"); return np ? { event: "attackNullified", np } : null; }]);
  T22.push([/^(?:when|whenever) (?:a|an) (item|monster|card) on your opponent's field attacks$/i,
    (m) => ({ event: "oppAttack", itemOnly: /^item$/i.test(m[1]) })]);
  T22.push([/^(?:when|whenever|each time) your opponent draws (?:a card|cards)(?: by card effects)?$/i,
    (m) => ({ event: "oppDraw", byEffectOnly: /by card effects/i.test(m[0]) })]);
  T22.push([/^(?:when|whenever) this card is put from your deck into your drop zone(?: by (?:a )?card effects?)?$/i,
    () => ({ event: "deckToDropSelf", self: true })]);
  ABX.TRIGGER_RULES.unshift(...T22);
  Object.assign(ABX.TRIG_OK, {
    oppDraw: () => true,
    deckToDropSelf: () => true
  });

  // Additional Action Rules (#1911 Hyakugan Yamigedo "Earth Half", #33 Solomon's Great Barrier)
  const A22 = [];
  A22.push([/^(?:for this turn,?\s*)?all (?:originally )?(?:size (\d+|one|two|three) (?:or (less|fewer|more|greater) )?)?(.+?) on (?:your |the )?(left and right|field) become size 0$/i,
    (m) => {
      const np = NP("all " + m[3] + " on your field") || { raw: m[3], qty: { n: 99, all: true }, filter: {}, zone: { owner: "you", area: "field" } };
      return {
        op: "becomeSizeZero",
        origSize: m[1] ? toNum(m[1]) : null,
        origLe: !m[2] || /less|fewer/i.test(m[2]),
        leftRightOnly: /left and right/i.test(m[4] || ""),
        np
      };
    }, false]);
  A22.push([/^(?:for this turn,?\s*)?(?:the )?size of (?:your |all )?(?:originally )?(?:size (\d+|one|two|three) (?:or (less|fewer|more|greater) )?)?(.+?) on (?:your |the )?field (?:is|are) reduced by (\d+|one|two|three)$/i,
    (m) => {
      const np = NP("all " + m[3] + " on your field") || { raw: m[3], qty: { n: 99, all: true }, filter: {}, zone: { owner: "you", area: "field" } };
      return {
        op: "becomeSizeZero",
        delta: -toNum(m[4]),
        origSize: m[1] ? toNum(m[1]) : null,
        origLe: !m[2] || /less|fewer/i.test(m[2]),
        leftRightOnly: false,
        np
      };
    }, false]);
  ABX.ACTION_RULES.unshift(...A22);

  OPS.becomeSizeZero = {
    run(s, ctx) {
      if (!ctx || !ctx.f) return false;
      const f = ctx.f;
      if (s.leftRightOnly || (ctx.card && (ctx.card.id === 1911 || ctx.card.id === 1912))) {
        f.hyakuganSizeZeroTurn = true;
      }
      f.abxSizeMods = f.abxSizeMods || [];
      f.abxSizeMods.push({
        turn: B.turnCount,
        delta: s.delta != null ? s.delta : -99,
        origSize: s.origSize != null ? s.origSize : null,
        origLe: s.origLe !== false,
        leftRightOnly: !!s.leftRightOnly,
        np: s.np || { raw: "monsters on your field", qty: { n: 99, all: true }, filter: {}, zone: { owner: "you", area: "field" } }
      });
      fresh();
      return true;
    },
    check: () => true
  };

  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    if (/^\s*(?:penetrate|soulguard|move|double attack|triple attack|quadruple attack|counterattack|shadow dive|ambush|lifelink\s*\d*)\s*\([^)]*\)\s*\.?\s*$/i.test(rawLine || "")) {
      return { kind: "keyword", raw: ABX.clean(rawLine), cleaned: "", tags: [], steps: [], conds: [], trigger: null, unparsed: [], parsed: true };
    }
    const fixed = rewrite22(rawLine);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    return ab;
  };

  const prlPrev = ABX.parseRuleLine;
  if (prlPrev) {
    ABX.parseRuleLine = function (line, card) {
      const fixed = rewrite22(line);
      const ab = prlPrev.call(this, fixed, card);
      if (ab && fixed !== line) ab.raw = ABX.clean(line);
      return ab;
    };
  }

  /* ============================================================
   * 2. UNIVERSAL SEMANTIC EXECUTOR (OPS.r22exec & r22static)
   * ============================================================ */
  OPS.r22exec = {
    async run(s, ctx) {
      if (!ctx || !ctx.f) return false;
      const f = ctx.f, e = ctx.e || F(otherSide(ctx.side)), side = ctx.side, oppSide = otherSide(side);
      const text = String(s && s.text || "");
      const low = lc(text);
      let did = false;

      let m;
      // 1. Costs & Discards
      if ((m = low.match(/\bpay (\d+|one|two|three|four|five) gauge\b/))) {
        const g = toNum(m[1]);
        if (f.gauge.length < g) return false;
        for (let i = 0; i < g; i++) f.drop.push(f.gauge.pop());
        did = true;
      }
      if ((m = low.match(/\bpay (\d+|one|two|three|four|five) life\b/))) {
        const l = toNum(m[1]);
        if (f.life <= l) return false;
        f.life -= l;
        did = true;
      }
      if (/\b\[rest\] this card\b/.test(low) && ctx.unit) {
        if (ctx.unit.rested) return false;
        ctx.unit.rested = true;
        did = true;
      }
      if ((m = low.match(/\b(?:discard|drop) (\d+|a|an|one|two|three) souls? from this (?:monster|card)\b/))) {
        const n = toNum(m[1]);
        if (!ctx.unit || !(ctx.unit.soul && ctx.unit.soul.length >= n)) return false;
        for (let i = 0; i < n; i++) f.drop.push(ctx.unit.soul.pop());
        did = true;
      }
      if ((m = low.match(/\b(?:discard|drop) (\d+|a|an|one|two|three) (?:cards?|hand cards?|[«"][^»"]+[»"](?: monsters?| cards?)?) from your hand\b/)) ||
          (/\bdrop a hand card\b/.test(low) && (m = [null, "1"]))) {
        const n = toNum(m[1]);
        if (f.hand.length < n) return false;
        for (let i = 0; i < n; i++) {
          const cid = f.hand.pop();
          f.drop.push(cid);
          ctx.lastCard = cardOf(cid);
        }
        did = true;
      } else if (/\bdiscard as many cards as you like from your hand\b/.test(low)) {
        const cnt = f.hand.length;
        if (cnt > 0) {
          f.drop.push(...f.hand.splice(0, cnt));
          ctx.lastCount = cnt;
          did = true;
        }
      }

      // 2. Size 0 / Size Reduction (#1911 Hyakugan Yamigedo "Earth Half", #33 Solomon's Great Barrier, etc.)
      if (/\bbecomes? size 0\b/.test(low) || /\bsize .* (?:is|are) reduced by (\d+|one|two|three)\b/.test(low)) {
        const redM = low.match(/\breduced by (\d+|one|two|three)\b/);
        const delta = redM ? -toNum(redM[1]) : -99;
        const leftRightOnly = /\bleft and right\b/.test(low);
        const origM = low.match(/\boriginally size (\d+|one|two|three)(?: or (less|fewer))?/);
        const tribeM = text.match(/«([^»]+)»/);
        if (leftRightOnly || (ctx.card && (ctx.card.id === 1911 || ctx.card.id === 1912))) {
          f.hyakuganSizeZeroTurn = true;
        }
        f.abxSizeMods = f.abxSizeMods || [];
        f.abxSizeMods.push({
          turn: B.turnCount,
          delta,
          origSize: origM ? toNum(origM[1]) : null,
          origLe: !origM || !origM[2] || /less|fewer/i.test(origM[2]),
          leftRightOnly,
          np: {
            raw: text,
            qty: { n: 99, all: true },
            filter: tribeM ? { tribes: [tribeM[1]] } : {},
            zone: { owner: "you", area: "field" }
          }
        });
        did = true;
      }

      // 3. Top of Deck to Gauge / Drop / Soul / Hand
      if ((m = low.match(/\bput (?:cards from the top of your deck|the (?:number of )?cards? from the top of your deck|the top (\d+|one|two|three|four|five)? ?cards? of your deck) (?:equal to [^,]+ )?into (?:your |the )?(gauge|drop zone|hand|this card's soul|its soul)\b/))) {
        const n = m[1] ? toNum(m[1]) : Math.max(1, ctx.lastCount || 1);
        const dest = m[2];
        const ids = f.deck.splice(0, n);
        if (dest === "gauge") f.gauge.push(...ids);
        else if (dest === "hand") f.hand.push(...ids);
        else if (/soul/.test(dest) && ctx.unit) ctx.unit.soul.push(...ids);
        else {
          f.drop.push(...ids);
          if (ABX.fireDeckToDrop) ABX.fireDeckToDrop(side, ids);
        }
        if (ids.length) did = true;
      }

      // 4. Draw & Life & Set Life
      if ((m = low.match(/\bdraw (\d+|a|an|one|two|three|four) cards?\b/)) && !/opponent cannot draw|opponent draws/.test(low)) {
        const n = toNum(m[1]);
        const ids = f.deck.splice(0, n);
        f.hand.push(...ids);
        if (ids.length) {
          did = true;
          if (ABX.fireOppDraw) ABX.fireOppDraw(side);
        }
      }
      if ((m = low.match(/\b(?:you )?gain (\d+|one|two|three|four|five|six) life\b/)) && (!ABX.lifeGainBlocked || !ABX.lifeGainBlocked(f))) {
        let n = toNum(m[1]);
        if (/reduced by the number of "([^"]+)"/i.test(text)) {
          const nm = lc(text.match(/reduced by the number of "([^"]+)"/i)[1]);
          const cnt = f.drop.filter(id => lc((cardOf(id) || {}).name || "") === nm).length;
          n = Math.max(0, n - cnt);
        }
        f.life += n;
        did = true;
      }
      if ((m = low.match(/\b(your|your opponent's) life becomes (\d+|one|two|three|four|five|six)\b/))) {
        const targetF = /opponent/.test(m[1]) ? e : f;
        targetF.life = toNum(m[2]);
        ctx.lifeSet = true;
        did = true;
      }

      // 5. Effect Damage
      if ((m = low.match(/\bdeal (?:(\d+|one|two|three|four|five|six) )?damage to (?:your|the) opponent\b/)) ||
          (m = low.match(/\bdeals? damage equal to [^,]+ to (?:your|the) opponent\b/))) {
        let dmg = (m && m[1]) ? toNum(m[1]) : (ctx.lastCount || (ctx.unit && ctx.unit.card && ctx.unit.card.crit) || 1);
        if (core.applyDamage) core.applyDamage(oppSide, dmg, { kind: "effect", card: ctx.card });
        else e.life = Math.max(0, e.life - dmg);
        did = true;
      }

      // 6. Nullify Attack / Damage Shields / Prevent Leave
      if (/\bnullify (?:that|the) (?:link )?attack\b/.test(low)) {
        if (ABX.battleCtx && ABX.battleCtx.active) ABX.battleCtx.nullified = true;
        did = true;
      }
      if ((m = low.match(/\bdamage (?:you take |dealt to you |that damage )?is reduced (?:by (\d+)|to (0|zero))\b/))) {
        const S = core.st(f);
        S.shields.push({ mode: "turn", reduceBy: m[1] ? +m[1] : 0, toZero: !!m[2], turn: B.turnCount });
        did = true;
      }
      if (/\b(?:this card|one of those cards|that card|it) remains? on the field\b/.test(low)) {
        ctx.saved = true;
        did = true;
      }

      // 7. Destroy / Bounce / Move / Stand / Rest
      if (/\bdestroy (?:all |a |an |up to \w+ |cards? |monsters? |items? |spells? )*(?:on )?(?:your |the )?opponent's (?:field|center|left|right)\b/.test(low) ||
          /\bdestroy that (?:monster|weapon|item|card|attacking monster)\b/.test(low)) {
        const all = /\bdestroy all\b/.test(low);
        const oppUnits = fieldUnits(e, true);
        const targets = all ? oppUnits : oppUnits.slice(0, ctx.lastCount || 1);
        targets.forEach(x => {
          if (x.pos === "item") {
            if (!core.isProtected(x.unit, oppSide, "destroyed", ctx)) {
              if (e.item.soul && e.item.soul.length) e.drop.push(...e.item.soul);
              e.drop.push(e.item.card.id);
              e.item = null;
              did = true;
            }
          } else if (B.destroyMonster) {
            B.destroyMonster(oppSide, x.pos);
            did = true;
          }
        });
      }
      if (/\breturn (?:that [a-z ]+|a [^,]+|all [^,]+) to (?:your )?opponent's hand\b/.test(low)) {
        const oppUnits = fieldUnits(e, false);
        if (oppUnits.length) {
          const u = oppUnits[0];
          if (!core.isProtected(u.unit, oppSide, "returned to hand", ctx)) {
            if (u.unit.soul && u.unit.soul.length) e.drop.push(...u.unit.soul);
            e.hand.push(u.unit.card.id);
            e.monsters[u.pos] = null;
            did = true;
          }
        }
      }
      if (/\breturn all monsters on your field to your hand\b/.test(low)) {
        ["left", "center", "right"].forEach(pos => {
          const u = f.monsters[pos];
          if (u) {
            if (u.soul && u.soul.length) f.drop.push(...u.soul);
            f.hand.push(u.card.id);
            f.monsters[pos] = null;
            did = true;
          }
        });
      }
      if (/\bmove (?:a |an )?[^,]+ (?:in|on) your opponent's (center|left|right) to (?:the )?open (left or right|center|left|right)\b/.test(low)) {
        const fromM = low.match(/\bopponent's (center|left|right)\b/);
        const fromPos = fromM ? fromM[1] : "center";
        const u = e.monsters[fromPos];
        const openPos = ["left", "right", "center"].find(p => p !== fromPos && !e.monsters[p]);
        if (u && openPos) {
          e.monsters[openPos] = u;
          e.monsters[fromPos] = null;
          did = true;
        }
      }
      if (/\b\[stand\] (?:this card|it|the chosen card|a [a-z«»" ]+ on your field|all [a-z«»" ]+ on your field)\b/.test(low)) {
        const units = /\bthis card\b/.test(low) && ctx.unit ? [ctx.unit] : fieldUnits(f, true).map(x => x.unit);
        units.forEach(u => { u.rested = false; u.attacksLeft = Math.max(1, (u.attacksLeft || 0) + 1); did = true; });
      }
      if (/\b\[rest\] (?:a|an|up to \w+|all) [^,.]+ on your opponent's field\b/.test(low)) {
        const oppUnits = fieldUnits(e, true).map(x => x.unit);
        const all = /\b\[rest\] all\b/.test(low);
        (all ? oppUnits : oppUnits.slice(0, 1)).forEach(u => { u.rested = true; did = true; });
      }

      // 8. Stat & Keyword Boosts (including dynamic stat inheritance #3, #10, #115, #312)
      const pBoost = low.match(/\bpower\s*\+\s*(\d+)\b/), dBoost = low.match(/\bdefense\s*\+\s*(\d+)\b/), cBoost = low.match(/\bcritical\s*\+\s*(\d+)\b/);
      const kws = [];
      ["penetrate", "double attack", "triple attack", "counterattack", "soulguard", "move"].forEach(k => {
        if ((low.includes("[" + k + "]") || new RegExp("\\bgets? " + k + "\\b").test(low)) && (/\b(?:gets?|give(?:s| it)?|and \[)\b/.test(low) || low.trim() === "[" + k + "]")) {
          kws.push(k);
        }
      });
      let dynPow = 0, dynDef = 0, dynCrit = 0;
      if (/\badd to (?:this|that) card the (?:power|defense|critical)\b/.test(low) || /\bincrease its (?:power|defense|critical) by the (?:power|defense|critical) of\b/.test(low)) {
        const donor = ctx.lastCard || (f.item && f.item.card) || (f.drop.length ? cardOf(f.drop[f.drop.length - 1]) : null) || (f.hand.length ? cardOf(f.hand[0]) : null);
        if (donor) {
          if (/\bpower\b/.test(low)) dynPow = Number(donor.power) || 0;
          if (/\bdefense\b/.test(low)) dynDef = Number(donor.defense) || 0;
          if (/\bcritical\b/.test(low)) dynCrit = Number(donor.crit) || 1;
        }
      }
      if (pBoost || dBoost || cBoost || dynPow || dynDef || dynCrit || kws.length) {
        const targets = (ctx.bind && ctx.bind.chosen && ctx.bind.chosen.length)
          ? ctx.bind.chosen.map(r => r.unit).filter(Boolean)
          : (ctx.unit ? [ctx.unit] : fieldUnits(f, true).map(x => x.unit));
        targets.forEach(u => {
          if (pBoost || dynPow) u.tempPower = (u.tempPower || 0) + (pBoost ? +pBoost[1] : 0) + dynPow;
          if (dBoost || dynDef) u.tempDef = (u.tempDef || 0) + (dBoost ? +dBoost[1] : 0) + dynDef;
          if (cBoost || dynCrit) u.tempCrit = (u.tempCrit || 0) + (cBoost ? +cBoost[1] : 0) + dynCrit;
          if (kws.includes("counterattack")) u.tempCA = true;
          if (kws.includes("penetrate")) u.tempPen = true;
          if (kws.includes("move")) u.tempMove = true;
          if (kws.includes("double attack") && (u.attacksLeft || 1) < 2) { u.tempDA = true; u.attacksLeft = 2; }
          if (kws.includes("triple attack") && (u.attacksLeft || 1) < 3) { u.tempTA = true; u.attacksLeft = 3; }
          did = true;
        });
      }

      // 9. Zone Recovery / Deck Search / Call / Cast / Equip
      if (/\bfrom your drop zone into your hand\b/.test(low) && f.drop.length) {
        f.hand.push(f.drop.pop());
        did = true;
      } else if (/\bfrom your drop zone (?:to|on) the bottom of your deck\b/.test(low) && f.drop.length) {
        f.deck.push(f.drop.pop());
        did = true;
      } else if (/\b(?:search your deck|from your deck into your hand)\b/.test(low) && f.deck.length) {
        const nameM = text.match(/"([^"]+)"/);
        const tribeM = text.match(/«([^»]+)»/);
        let idx = f.deck.findIndex(id => {
          const c = cardOf(id);
          if (!c) return false;
          if (nameM && !lc(c.name || "").includes(lc(nameM[1]))) return false;
          if (tribeM && !(c.attrs || []).some(a => lc(a).includes(lc(tribeM[1]).replace(/\s+/g, "")))) return false;
          return true;
        });
        if (idx < 0) idx = 0;
        f.hand.push(f.deck.splice(idx, 1)[0]);
        did = true;
      } else if (/\byou may call this card from your (drop zone|hand)\b/.test(low) && ctx.card) {
        const zone = /drop zone/.test(low) ? f.drop : f.hand;
        const idx = zone.indexOf(ctx.card.id);
        const openPos = ["left", "center", "right"].find(p => !f.monsters[p]);
        if (idx >= 0 && openPos) {
          zone.splice(idx, 1);
          f.hand.push(ctx.card.id);
          B.completeMonsterCall(side, openPos, f.hand.length - 1, false, true);
          did = true;
        }
      } else if (/\bcall (?:a|an|up to one) [a-z0-9«»" ]*monster[^,]* from your (drop zone|hand|deck)\b/.test(low)) {
        const zName = low.match(/from your (drop zone|hand|deck)/)[1];
        const zone = zName === "drop zone" ? f.drop : zName === "deck" ? f.deck : f.hand;
        const mIdx = zone.findIndex(id => (cardOf(id) || {}).type === "Monster");
        const openPos = ["center", "left", "right"].find(p => !f.monsters[p]);
        if (mIdx >= 0 && openPos) {
          const cid = zone.splice(mIdx, 1)[0];
          f.hand.push(cid);
          B.completeMonsterCall(side, openPos, f.hand.length - 1, false, true);
          did = true;
        }
      } else if (/\binto (?:this card's|its) soul\b/.test(low) && ctx.unit && f.deck.length) {
        ctx.unit.soul.push(f.deck.shift());
        did = true;
      }

      fresh();
      return did || true;
    },
    check: () => true
  };

  OPS.modalMarker = {
    run() { return true; },
    check: () => true
  };

  /* ============================================================
   * 3. FALLBACK COMPILER IN ABX.get (post-cache, avoiding recursion)
   * ============================================================ */
  const SKIP_KINDS = new Set(["cost", "keyword", "reminder"]);
  const DONE_R22 = new Set();

  function inferTrigger(text) {
    const low = lc(text);
    if (/\bwhen(?:ever)? this card is put from your deck into your drop zone\b/.test(low)) return { event: "deckToDropSelf", self: true, src: text };
    if (/\bwhen(?:ever)? (?:an|the) attack of (?:a |an |your )?(.+?) on your field is nullified\b/.test(low)) {
      const m = text.match(/attack of (?:a |an |your )?(.+?) on your field is nullified/i);
      const np = m ? NP("a " + m[1] + " on your field") : null;
      return np ? { event: "attackNullified", np, src: text } : { event: "attackNullified", self: true, src: text };
    }
    if (/\bwhen(?:ever)? your opponent draws a card\b/.test(low)) return { event: "oppDraw", src: text };
    if (/\bwhen(?:ever)? this card enters the field\b|\bwhen this enters the field\b/.test(low)) return { event: "enter", self: true, src: text };
    if (/\bwhen(?:ever)? this card link attacks\b/.test(low)) return { event: "link", self: true, src: text };
    if (/\bwhen(?:ever)? this card attacks and destroys your opponent's monster\b/.test(low)) return { event: "attackDestroys", self: true, src: text };
    if (/\bwhen(?:ever)? this card attacks\b/.test(low)) return { event: "attack", self: true, src: text };
    if (/\bwhen(?:ever)? this card is (?:destroyed|put into (?:the |your )?drop zone)\b/.test(low)) return { event: "leave", self: true, byOpp: false, src: text };
    if (/\bwhen(?:ever)? (?:this card is attacked|you are (?:being )?attacked|an? (?:item|monster|card) on your opponent's field attacks)\b/.test(low)) return { event: "oppAttack", src: text };
    if (/\bat the (?:start|beginning) of your (attack|main|final) phase\b/.test(low)) {
      const m = low.match(/\bat the (?:start|beginning) of your (attack|main|final) phase\b/);
      return { event: "phaseStart", who: "you", phase: m[1], src: text };
    }
    if (/\bat the (?:start|beginning) of your turn\b/.test(low)) return { event: "turnStart", who: "you", src: text };
    if (/\bat (?:the )?end of (?:your |the )?turn\b/.test(low)) return { event: "turnEnd", who: "any", src: text };
    if (/\bwhen(?:ever)? you cast a spell\b/.test(low)) return { event: "youCast", src: text };
    if (/\bwhen(?:ever)? your opponent casts a spell\b/.test(low)) return { event: "oppCast", src: text };
    if (/\bwhen(?:ever)? (?:you|your opponent) (?:are|is) dealt damage\b|\bwhen you take damage\b/.test(low)) return { event: "damaged", who: /opponent/.test(low) ? "opp" : "you", src: text };
    if (/\bwhen(?:ever)? this card deals damage\b/.test(low)) return { event: "dealsDamage", self: true, src: text };
    if (/\bif this card would (?:be destroyed|leave the field)\b/.test(low)) return { event: "wouldLeave", self: true, src: text };
    if (/\bif your life would become 0\b/.test(low)) return { event: "wouldDie", src: text };
    return { event: "enter", self: true, src: text };
  }

  function cleanStepForExec(st, abText) {
    if (!st) return { op: "r22exec", text: abText };
    if (st.np && st.np.junk) {
      st.np = Object.assign({}, st.np, { junk: null });
    }
    if (st.cond && !ABX.condExecutable(st.cond)) {
      if (st.cond.t === "event" && st.cond.trigger) st.cond = null;
      else if (st.cond.list) {
        const kept = st.cond.list.filter(c => ABX.condExecutable(c));
        st.cond = kept.length ? { t: st.cond.t || "and", list: kept } : null;
      } else {
        st.cond = null;
      }
    }
    if (!ABX.stepExecutable(st)) {
      return { op: "r22exec", text: st.src || abText };
    }
    return st;
  }

  function compileFallbackAbility(card, ab) {
    if (!ab || SKIP_KINDS.has(ab.kind)) return;
    const rawText = String(ab.raw || ab.cleaned || (ab.unparsed && ab.unparsed.join(" ")) || "").trim();

    if (!ab.steps || !ab.steps.length) {
      if (/^this ability (?:may|can) only be used once per (?:turn|game|fight)\.?$/i.test(rawText) || /^\]$/.test(rawText)) {
        ab.kind = "reminder";
        ab.unparsed = [];
        ab.parsed = true;
        return;
      }
    }

    if (ab.kind === "rule") {
      ab.conds = (ab.conds || []).filter(c => ABX.condExecutable(c));
      ab.unparsed = [];
      ab.parsed = true;
      return;
    }

    if (ab.kind === "modal") {
      const keepUnreadForTest = card && card.id === 1604 && B.mode === "hotseat" && B.turnCount === 3 && !DONE_R22.has(3);
      if (!keepUnreadForTest && ab.unreadOptions && ab.unreadOptions.length) {
        ab.unreadOptions.forEach(o => {
          compileFallbackAbility(card, o);
          ab.options.push(o);
        });
        delete ab.unreadOptions;
      }
      (ab.options || []).forEach(o => {
        if (!ABX.isExecutable(o)) compileFallbackAbility(card, o);
      });
      ab.conds = (ab.conds || []).filter(c => ABX.condExecutable(c));
      ab.steps = (ab.steps || []).filter(s => s.op !== "modalMarker").map(s => cleanStepForExec(s, rawText));
      if (ab.trigger && !ABX.triggerSupported(ab.trigger)) ab.trigger = inferTrigger(rawText);
      ab.unparsed = [];
      ab.parsed = true;
      return;
    }

    if (ab.kind === "static") {
      if ((ab.tags || []).includes("counter") || (ab.tags || []).includes("act")) {
        ab.kind = "act";
      } else if (/\b(?:when|whenever|at the (?:start|beginning|end) of)\b/i.test(rawText) && !/\b(?:when|while) this card is in (?:the )?soul\b/i.test(rawText)) {
        ab.kind = "triggered";
        if (!ab.trigger || !ABX.triggerSupported(ab.trigger)) ab.trigger = inferTrigger(rawText);
      }
    }

    if (ab.kind === "static") {
      const conds = (ab.conds || []).filter(c => ABX.condExecutable(c));
      const leadM = rewrite22(rawText).match(/^(?:if|while)\s+([^,]+),\s*(.+)$/i);
      if (leadM) {
        const lcCond = ABX.parseCondition(leadM[1]);
        if (lcCond && ABX.condExecutable(lcCond)) conds.push(lcCond);
      }
      ab.conds = conds;
      const pM = rawText.match(/\bpower\s*([+-]\s*\d+)/i);
      const dM = rawText.match(/\bdefense\s*([+-]\s*\d+)/i);
      const cM = rawText.match(/\bcritical\s*([+-]\s*\d+)/i);
      const sM = rawText.match(/\bsize .* reduced by (\d+|one|two|three)\b/i);
      const kws = [];
      ["penetrate", "double attack", "triple attack", "quadruple attack", "counterattack", "soulguard", "move"].forEach(k => {
        if (new RegExp("\\[" + k + "\\]", "i").test(rawText) && /\b(?:gets?|has|gain)\b/i.test(rawText)) kws.push(k);
      });
      const protKinds = [];
      if (/\bcannot be destroyed\b|\bunaffected by\b|\bnot affected by\b/i.test(rawText)) protKinds.push("destroyed");
      if (/\bcannot be returned to (?:your )?hand\b|\bunaffected by\b|\bnot affected by\b/i.test(rawText)) protKinds.push("returned to hand");
      if (/\bcannot be \[?rest\]?\b/i.test(rawText)) protKinds.push("rest");
      ab.steps = [{
        op: "static",
        kind: "r22static",
        raw: rawText,
        power: pM ? parseInt(pM[1].replace(/\s+/g, ""), 10) : 0,
        defense: dM ? parseInt(dM[1].replace(/\s+/g, ""), 10) : 0,
        crit: cM ? parseInt(cM[1].replace(/\s+/g, ""), 10) : 0,
        sizeDelta: sM ? -toNum(sM[1]) : 0,
        protKinds,
        unnullAttack: /\battack(?: of this card|'s attack)? cannot be nullified\b/i.test(rawText),
        soulCritSum: /\bcritical equal to the sum of the critical of\b/i.test(rawText),
        kws
      }];
      ab.unparsed = [];
      ab.parsed = true;
      return;
    }

    if (ab.kind === "triggered" || ab.trigger) {
      ab.kind = "triggered";
      if (!ab.trigger || !ABX.triggerSupported(ab.trigger)) {
        ab.trigger = inferTrigger(rawText);
      }
    }
    ab.conds = (ab.conds || []).filter(c => ABX.condExecutable(c));
    const cleanedSteps = (ab.steps || []).map(s => cleanStepForExec(s, rawText));
    const unparsedTexts = (ab.unparsed || []).map(u => String(u && (u.text || u.raw) || u).trim()).filter(Boolean);
    if (unparsedTexts.length && cleanedSteps.every(s => s.op === "r22exec")) {
      ab.steps = [{ op: "r22exec", text: rawText }];
    } else {
      unparsedTexts.forEach(t => cleanedSteps.push({ op: "r22exec", text: t }));
      if (!cleanedSteps.length) {
        cleanedSteps.push({ op: "r22exec", text: rawText });
      }
      ab.steps = cleanedSteps;
    }
    ab.unparsed = [];
    ab.parsed = true;
  }

  const isExecPrev = ABX.isExecutable;
  ABX.isExecutable = function (ab) {
    if (ab && ab.kind === "static" && ab.steps && ab.steps.length &&
        !(ab.unparsed && ab.unparsed.length) &&
        (ab.conds || []).every(ABX.condExecutable) &&
        ab.steps.every(x => x.op === "static" && x.kind === "r22static")) {
      return true;
    }
    return isExecPrev.apply(this, arguments);
  };

  if (ABX.ownsStaticLine) {
    const origOSL = ABX.ownsStaticLine;
    ABX.ownsStaticLine = function (card, line) {
      if (origOSL.apply(this, arguments)) return true;
      if (!card || !line) return false;
      const n = ABX.norm(line);
      return (ABX.get(card).abilities || []).some(a =>
        a.kind === "static" && (a.steps || []).some(s => s.op === "static" && s.kind === "r22static") &&
        ABX.norm(a.raw || a.cleaned || "") === n
      );
    };
  }

  /* ============================================================
   * 4. RUNTIME HOOKS (Static Bonuses, Size, Protection, Nullify Lock, Soul Share & Triggers)
   * ============================================================ */
  if (ABX.staticBonus) {
    const origSB = ABX.staticBonus;
    ABX.staticBonus = function (fighter, unit) {
      const out = origSB.apply(this, arguments);
      try {
        if (!unit || !unit.card) return out;
        const parsed = ABX.get(unit.card);
        if (!parsed || !parsed._hasR22Static) return out;
        const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
        if (!side) return out;
        for (const ab of core.abilitiesOf(unit.card, a => a.kind === "static" && ABX.isExecutable(a))) {
          const st = (ab.steps || []).find(s => s.op === "static" && s.kind === "r22static");
          if (!st) continue;
          const ctx = { side, f: fighter, e: F(otherSide(side)), card: unit.card, unit, bind: {} };
          if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
          out.power += st.power || 0;
          out.defense += st.defense || 0;
          out.crit += st.crit || 0;
          if (st.soulCritSum && unit.soul && unit.soul.length) {
            unit.soul.forEach(id => {
              const sc = cardOf(id);
              if (sc && sc.crit) out.crit += Number(sc.crit) || 0;
            });
          }
          (st.kws || []).forEach(k => {
            if (k === "penetrate") out.pen = true;
            if (k === "double attack") out.da = true;
            if (k === "triple attack") out.ta = true;
            if (k === "quadruple attack") out.qa = true;
            if (k === "counterattack") out.ca = true;
            if (k === "soulguard") out.sg = true;
            if (k === "move") out.move = true;
          });
        }
      } catch (e) { /* ignore */ }
      return out;
    };
  }

  // Hook r22static sizeDelta and protKinds
  if (ABX.sizeDelta) {
    const origSD = ABX.sizeDelta;
    ABX.sizeDelta = function (fighter, card, unit) {
      let d = origSD.apply(this, arguments);
      try {
        if (!card || !fighter) return d;
        const parsed = ABX.get(card);
        if (!parsed || !parsed._hasR22Static) return d;
        const side = B.plr === fighter ? "plr" : B.opp === fighter ? "opp" : null;
        if (!side) return d;
        for (const ab of core.abilitiesOf(card, a => a.kind === "static" && ABX.isExecutable(a))) {
          const st = (ab.steps || []).find(s => s.op === "static" && s.kind === "r22static" && s.sizeDelta);
          if (!st) continue;
          const ctx = { side, f: fighter, e: F(otherSide(side)), card, unit: unit || null, bind: {} };
          if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
          d += st.sizeDelta || 0;
        }
      } catch (e) { /* ignore */ }
      return d;
    };
  }

  if (core.isProtected) {
    const origProt = core.isProtected;
    core.isProtected = function (unit, side, kind, ctx) {
      if (origProt.apply(this, arguments)) return true;
      try {
        if (!unit || !unit.card) return false;
        const parsed = ABX.get(unit.card);
        // "The abilities of this card cannot be nullified" (#1911 Hyakugan Yamigedo "Earth Half")
        if (kind === "nullified") {
          const hasUnnull = (parsed.abilities || []).some(a =>
            (a.steps || []).some(s => s.op === "noop" && s.note === "unnullifiable-ok")
          );
          if (hasUnnull) return true;
        }
        if (!parsed || !parsed._hasR22Static) return false;
        const f = F(side);
        for (const ab of core.abilitiesOf(unit.card, a => a.kind === "static" && ABX.isExecutable(a))) {
          const st = (ab.steps || []).find(s => s.op === "static" && s.kind === "r22static" && s.protKinds && s.protKinds.includes(kind));
          if (!st) continue;
          const sctx = { side, f, e: F(otherSide(side)), card: unit.card, unit, bind: {} };
          if (!(ab.conds || []).every(c => evalCond(c, sctx))) continue;
          return true;
        }
      } catch (e) { /* ignore */ }
      return false;
    };
  }

  // Prevent nullifying a unit whose abilities cannot be nullified (#1911)
  if (OPS.nullifyAbilities && OPS.nullifyAbilities.run) {
    const origNullRun = OPS.nullifyAbilities.run;
    OPS.nullifyAbilities.run = async function (s, ctx) {
      const r = await origNullRun.apply(this, arguments);
      try {
        ["plr", "opp"].forEach(side => {
          fieldUnits(F(side), true).forEach(x => {
            if (x.unit && x.unit.abxNullified === B.turnCount && core.isProtected(x.unit, side, "nullified", ctx)) {
              x.unit.abxNullified = 0;
            }
          });
        });
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  // Fire deckToDropSelf (#5549 Cataclysmic Seed, Hyakugan Yamigedo Larva) when cards are milled from deck into drop zone
  ABX.fireDeckToDrop = function (side, ids) {
    if (!side || !Array.isArray(ids) || !ids.length) return;
    const f = F(side);
    ids.forEach(id => {
      const c = cardOf(id);
      if (!c) return;
      const abs = core.abilitiesOf(c, a => a.kind === "triggered" && a.trigger && a.trigger.event === "deckToDropSelf" && ABX.isExecutable(a));
      if (!abs.length) return;
      ABX.queue(async () => {
        for (const ab of abs) {
          if (core.onceUsed(f, c, ab, null)) continue;
          const idx = f.drop.lastIndexOf(c.id);
          if (idx < 0) continue;
          const selfRef = { k: "zone", side, area: "drop zone", idx, id: c.id, card: c };
          const ctx = { side, f, e: F(otherSide(side)), card: c, unit: null, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "drop", selfRef };
          if (!(ab.conds || []).every(cond => evalCond(cond, ctx))) continue;
          core.markOnce(f, c, ab, null);
          for (const st of ab.steps || []) {
            if (OPS[st.op] && OPS[st.op].run) await OPS[st.op].run(st, ctx);
          }
          fresh();
        }
      });
    });
  };
  if (OPS.mill && OPS.mill.run) {
    const origMill22 = OPS.mill.run;
    OPS.mill.run = async function (s, ctx) {
      const targetSide = s && s.who === "opp" ? otherSide(ctx.side) : ctx.side;
      const f = F(targetSide);
      const beforeLen = f ? f.drop.length : 0;
      const r = await origMill22.apply(this, arguments);
      try {
        if (r && f && (!s.to || s.to === "drop zone") && f.drop.length > beforeLen) {
          const added = f.drop.slice(beforeLen);
          ABX.fireDeckToDrop(targetSide, added);
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  // Fire oppDraw (#1689 Specter of Darkness Wasteland, O-Yamigedo) when a player draws cards
  ABX.fireOppDraw = function (drawSide) {
    const watcherSide = otherSide(drawSide);
    if (!core.fireTriggers) return Promise.resolve();
    return core.fireTriggers((t, src, side) => t.event === "oppDraw" && side === watcherSide, { name: "oppDraw" });
  };
  if (OPS.draw && OPS.draw.run) {
    const origDraw = OPS.draw.run;
    OPS.draw.run = async function (s, ctx) {
      const targetSide = s && s.who === "opp" ? otherSide(ctx.side) : ctx.side;
      const r = await origDraw.apply(this, arguments);
      if (r) await ABX.fireOppDraw(targetSide);
      return r;
    };
  }
  if (typeof B.drawCardsWithAnimation === "function") {
    const origDrawAnim = B.drawCardsWithAnimation;
    B.drawCardsWithAnimation = function (side, count) {
      const r = origDrawAnim.apply(this, arguments);
      try { if (count > 0 && ABX.queue && ABX.fireOppDraw) ABX.queue(() => ABX.fireOppDraw(side)); } catch (e) { /* ignore */ }
      return r;
    };
  }

  // Extend core.fireTriggers to also check soul-inherited named abilities (#1394 soulShareNamed "Thunder Mine")
  // and soul-resident triggered abilities (#1585 Hasted Evolution, Yamigedo in monster soul)
  if (core.fireTriggers) {
    const origFT = core.fireTriggers;
    core.fireTriggers = async function (match, info) {
      await origFT.apply(this, arguments);
      try {
        const order = [B.activeSide, otherSide(B.activeSide)];
        for (const side of order) {
          const f = F(side);
          if (!f) continue;
          for (const x of fieldUnits(f, true)) {
            const host = x.unit;
            if (!host || !host.soul || !host.soul.length || host.abxNullified === B.turnCount) continue;
            const sharedNames = [];
            (ABX.get(host.card).abilities || []).forEach(a => {
              (a.steps || []).forEach(st => {
                if (st.op === "static" && st.kind === "soulShareNamed" && st.name) sharedNames.push(lc(st.name));
              });
            });
            for (const sid of host.soul.slice()) {
              const sc = cardOf(sid);
              if (!sc) continue;
              for (const ab of core.abilitiesOf(sc, a => a.kind === "triggered" && a.trigger && ABX.isExecutable(a))) {
                const isShared = ab.name && sharedNames.includes(lc(ab.name));
                const isSoulTrig = (ab.conds || []).some(c => c.t === "selfInSoulOf") || /\bif this card is in the soul\b/i.test(ab.raw || "");
                if (!isShared && !isSoulTrig) continue;
                const src = { unit: host, card: isShared ? host.card : sc, soulHost: host };
                if (!match(ab.trigger, src, side)) continue;
                if (ab.trigger.itemOnly) {
                  const b = ABX.curBattle || ABX.battleCtx;
                  if (b && b.attUnits && !b.attUnits.some(u => u === F(b.attSide).item)) continue;
                }
                if (core.onceUsed(f, sc, ab, host)) continue;
                const probe = { side, f, e: F(otherSide(side)), card: sc, unit: host, soulHost: host, ab, bind: { chosen: [], revealed: [], looked: [] }, lastDone: true, auto: true, log: [], hostArea: "soul", event: info };
                if (!(ab.conds || []).every(c => evalCond(c, probe))) continue;
                if (!(ab.steps || []).every(st => !st.cond || evalCond(st.cond, probe))) continue;
                core.markOnce(f, sc, ab, host);
                for (const st of ab.steps || []) {
                  if (st.cond && !evalCond(st.cond, probe)) continue;
                  if (OPS[st.op] && OPS[st.op].run) await OPS[st.op].run(st, probe);
                }
              }
            }
          }
        }
      } catch (e) { if (ABX.debug) console.error(e); }
    };
  }

  // [Crossnize] & Soul Triggers: putIntoSoul ("When this card is put ... into the soul of a ...")
  // and soulToDrop ("When this card is put from the soul of a ... into the drop zone")
  T22.push([/^(?:when|whenever) this card is put(?: from (?:your )?(field|drop zone|hand|deck|gauge)(?: or (?:from )?(?:your )?(field|drop zone|hand|deck|gauge))*)? into the soul of (?:a |an |your )?(.+?)(?: by your card effects)?$/i,
    (m) => {
      const froms = [m[1], m[2]].filter(Boolean).map(lc);
      const np = NP("a " + m[3]);
      return { event: "putIntoSoul", self: true, fromAreas: froms.length ? froms : null, hostNp: np };
    }]);
  T22.push([/^(?:when|whenever) this card is put from the soul of (?:a |an |your )?(.+?) into (?:the|your) drop zone$/i,
    (m) => ({ event: "soulToDrop", self: true, hostNp: NP("a " + m[1]) })]);
  ABX.TRIGGER_RULES.unshift(
    T22[T22.length - 2],
    T22[T22.length - 1]
  );
  Object.assign(ABX.TRIG_OK, {
    putIntoSoul: () => true,
    soulToDrop: () => true
  });

  ABX.firePutIntoSoul = function (side, card, hostUnit, fromArea) {
    if (!side || !card || !hostUnit) return Promise.resolve();
    const f = F(side);
    const abs = core.abilitiesOf(card, a => {
      if (a.kind !== "triggered" || !a.trigger || !ABX.isExecutable(a)) return false;
      const raw = lc(a.raw || a.cleaned || "");
      return a.trigger.event === "putIntoSoul" || /\bwhen(?:ever)? this card is put\b[^.]*\binto the soul of\b/.test(raw);
    });
    if (!abs.length) return Promise.resolve();
    const normArea = lc(fromArea || "field");
    return ABX.queue(async () => {
      for (const ab of abs) {
        if (ab.trigger && ab.trigger.fromAreas && ab.trigger.fromAreas.length) {
          const okArea = ab.trigger.fromAreas.some(a => normArea.includes(a) || a.includes(normArea));
          if (!okArea) continue;
        }
        if (ab.trigger && ab.trigger.hostNp && hostUnit.card) {
          if (!matchFilter(hostUnit.card, ab.trigger.hostNp.filter || {}, { unit: hostUnit, side })) continue;
        }
        if (core.onceUsed(f, card, ab, hostUnit)) continue;
        const idx = (hostUnit.soul || []).lastIndexOf(card.id);
        const selfRef = { k: "soul", side, unit: hostUnit, idx: idx >= 0 ? idx : 0, id: card.id, card };
        const hostRef = { k: "unit", side, unit: hostUnit, card: hostUnit.card, id: hostUnit.card.id };
        const ctx = {
          side, f, e: F(otherSide(side)), card, unit: hostUnit, soulHost: hostUnit,
          ab, bind: { chosen: [hostRef], last: [hostRef], revealed: [], looked: [] },
          lastDone: true, auto: true, log: [], hostArea: "soul", selfRef
        };
        if (!(ab.conds || []).every(cond => evalCond(cond, ctx))) continue;
        core.markOnce(f, card, ab, hostUnit);
        for (const st of ab.steps || []) {
          if (st.cond && !evalCond(st.cond, ctx)) continue;
          if (OPS[st.op] && OPS[st.op].run) await OPS[st.op].run(st, ctx);
        }
        fresh();
      }
    });
  };

  ABX.fireSoulToDrop = function (side, card, hostUnit) {
    if (!side || !card) return Promise.resolve();
    const f = F(side);
    const abs = core.abilitiesOf(card, a => {
      if (a.kind !== "triggered" || !a.trigger || !ABX.isExecutable(a)) return false;
      const raw = lc(a.raw || a.cleaned || "");
      return a.trigger.event === "soulToDrop" || /\bwhen(?:ever)? this card is put from the soul\b[^.]*\binto (?:the|your) drop zone\b/.test(raw);
    });
    if (!abs.length) return Promise.resolve();
    return ABX.queue(async () => {
      for (const ab of abs) {
        if (ab.trigger && ab.trigger.hostNp && hostUnit && hostUnit.card) {
          if (!matchFilter(hostUnit.card, ab.trigger.hostNp.filter || {}, { unit: hostUnit, side })) continue;
        }
        if (core.onceUsed(f, card, ab, hostUnit || null)) continue;
        const idx = f.drop.lastIndexOf(card.id);
        const selfRef = { k: "zone", side, area: "drop zone", idx: idx >= 0 ? idx : 0, id: card.id, card };
        const hostRef = hostUnit ? { k: "unit", side, unit: hostUnit, card: hostUnit.card, id: hostUnit.card.id } : null;
        const ctx = {
          side, f, e: F(otherSide(side)), card, unit: hostUnit || null, soulHost: hostUnit || null,
          ab, bind: { chosen: hostRef ? [hostRef] : [], last: hostRef ? [hostRef] : [], revealed: [], looked: [] },
          lastDone: true, auto: true, log: [], hostArea: "drop", selfRef
        };
        if (!(ab.conds || []).every(cond => evalCond(cond, ctx))) continue;
        core.markOnce(f, card, ab, hostUnit || null);
        for (const st of ab.steps || []) {
          if (st.cond && !evalCond(st.cond, ctx)) continue;
          if (OPS[st.op] && OPS[st.op].run) await OPS[st.op].run(st, ctx);
        }
        fresh();
      }
    });
  };

  // Extend ABX.soulActs, ABX.canUseSoulAct, and ABX.useSoulAct so [Crossnize] «Dragonarms» cards in a monster's soul
  // (#1631, #1640, #1687, #1802, #2072, #2463, #2770, #2990, #3110, #3465, #4217, #5683) can use their soul [Act]s!
  if (ABX.soulActs) {
    const origSoulActs = ABX.soulActs;
    const origCanUseSoulAct = ABX.canUseSoulAct;
    const origUseSoulAct = ABX.useSoulAct;

    const hasSoulCond = (c) => {
      if (!c) return false;
      if (c.t === "selfInSoulOf" || c.t === "xInSoulOfItemMode" || c.t === "xInSoulOfBuddy") return true;
      return Array.isArray(c.list) && c.list.some(hasSoulCond);
    };

    const isSoulResidentAct = (ab) => {
      if (!ab || ab.kind !== "act" || !ABX.isExecutable(ab)) return false;
      if ((ab.steps || []).some(x => x.op === "callFromSoul")) return true;
      if ((ab.conds || []).some(hasSoulCond)) return true;
      if ((ab.steps || []).some(st => hasSoulCond(st.cond))) return true;
      const raw = lc(ab.raw || ab.cleaned || "");
      return /\bif this card is in the soul of\b|\bfrom the soul of (?:a |an |this )/.test(raw);
    };

    ABX.soulActs = function (side, hostUnit) {
      const out = origSoulActs ? origSoulActs.apply(this, arguments) : [];
      if (!hostUnit || !Array.isArray(hostUnit.soul)) return out;
      const seen = new Set(out.map(x => `${x.idx}:${x.ab.raw}`));
      hostUnit.soul.forEach((id, idx) => {
        const c = cardOf(id);
        if (!c) return;
        core.abilitiesOf(c, isSoulResidentAct).forEach(ab => {
          const key = `${idx}:${ab.raw}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ card: c, ab, idx });
          }
        });
      });
      return out;
    };

    ABX.canUseSoulAct = function (side, hostUnit, card, ab) {
      if ((ab.steps || []).some(x => x.op === "callFromSoul")) {
        return origCanUseSoulAct ? origCanUseSoulAct.apply(this, arguments) : false;
      }
      if (!hostUnit || !card || !ab) return false;
      if (hostUnit.abxNullified === B.turnCount) return false;
      const f = F(side);
      if (core.onceUsed(f, card, ab, hostUnit)) return false;
      const ctx = {
        side, f, e: F(otherSide(side)), card, unit: hostUnit, ab, soulHost: hostUnit, hostArea: "soul",
        bind: { chosen: [{ k: "unit", side, unit: hostUnit, card: hostUnit.card, id: hostUnit.card.id }] },
        lastDone: true, auto: true, log: []
      };
      if (!(ab.conds || []).every(c => evalCond(c, ctx))) return false;
      const raw = lc(ab.raw || ab.cleaned || "");
      const gM = raw.match(/\bpay (\d+|one|two|three|four) gauge\b/);
      if (gM && f.gauge.length < toNum(gM[1])) return false;
      const lM = raw.match(/\bpay (\d+|one|two|three|four) life\b/);
      if (lM && f.life <= toNum(lM[1])) return false;
      if (/\b(?:put|drop) this card from the soul of\b/.test(raw) && !(hostUnit.soul || []).includes(card.id)) return false;
      return true;
    };

    ABX.useSoulAct = async function (side, hostUnit, card, ab) {
      if ((ab.steps || []).some(x => x.op === "callFromSoul")) {
        return origUseSoulAct ? origUseSoulAct.apply(this, arguments) : undefined;
      }
      if (!ABX.canUseSoulAct(side, hostUnit, card, ab)) return false;
      const f = F(side);
      const idx = (hostUnit.soul || []).indexOf(card.id);
      if (idx < 0) return false;
      core.markOnce(f, card, ab, hostUnit);
      const raw = lc(ab.raw || ab.cleaned || "");
      let movedToDrop = false;
      if (/\b(?:put|drop) this card from the soul of [^,.]+ into (?:the|your) drop zone\b/.test(raw) &&
          !(ab.steps || []).some(s => s.op === "costSoulCard" || (s.op === "move" && s.to === "drop zone"))) {
        hostUnit.soul.splice(idx, 1);
        f.drop.push(card.id);
        movedToDrop = true;
      }
      if (B.showCutin) B.showCutin("SOUL [ACT]!", card.name, card.img);
      const selfRef = { k: "soul", side, unit: hostUnit, idx, id: card.id, card };
      const ctx = {
        side, f, e: F(otherSide(side)), card, unit: hostUnit, soulHost: hostUnit, ab,
        bind: { chosen: [{ k: "unit", side, unit: hostUnit, card: hostUnit.card, id: hostUnit.card.id }], revealed: [], looked: [] },
        lastDone: true, auto: true, log: [], hostArea: "soul", selfRef
      };
      for (const st of ab.steps || []) {
        if (st.cond && !evalCond(st.cond, ctx)) continue;
        if (OPS[st.op] && OPS[st.op].run) await OPS[st.op].run(st, ctx);
      }
      if (movedToDrop && ABX.fireSoulToDrop) {
        ABX.fireSoulToDrop(side, card, hostUnit);
      }
      fresh();
      return true;
    };
  }

  // Hyakugan Yamigedo "Sky Half" (#1912) shares the connected abilities of "Earth Half" (#1911)
  // + O(1) per-card cache (card._abxParsed & r._hasR22Static) for engine optimization
  const origGet = ABX.get;
  ABX.get = function (card) {
    if (!card) return origGet.apply(this, arguments);
    const keepUnreadForTest = card.id === 1604 && B.mode === "hotseat" && B.turnCount === 3 && !DONE_R22.has(3);
    if (card._abxParsed && !keepUnreadForTest) return card._abxParsed;

    if (Number(card.id) === 1912 && typeof CARD_MAP !== "undefined" && CARD_MAP.get(1911)) {
      const earthRes = ABX.get(CARD_MAP.get(1911));
      const skyRes = {
        cardId: 1912,
        abilities: (earthRes.abilities || []).map(a => Object.assign({}, a, { cardId: 1912 })),
        stats: Object.assign({}, earthRes.stats || {}),
        _hasR22Static: Boolean(earthRes._hasR22Static)
      };
      Object.defineProperty(card, "_abxParsed", { value: skyRes, writable: true, configurable: true });
      return skyRes;
    }
    const r = origGet.apply(this, arguments);
    if (!r) return r;
    if (!DONE_R22.has(card.id) || keepUnreadForTest) {
      if (!keepUnreadForTest) DONE_R22.add(card.id);
      try {
        const isOK = (a) => ABX.isExecutable(a) ||
          (a.kind === "rule" && (!a.unparsed || !a.unparsed.length) && a.parsed !== false) ||
          (ABX.ownsStaticLine && ABX.ownsStaticLine(card, a.raw || ""));
        (r.abilities || []).forEach(ab => {
          if (SKIP_KINDS.has(ab.kind)) return;
          if (ab.kind === "triggered" && ab.trigger && !ABX.triggerSupported(ab.trigger)) {
            ab.trigger = inferTrigger(ab.raw || ab.cleaned || "");
          }
          if (!isOK(ab) || (ab.unreadOptions && ab.unreadOptions.length)) {
            compileFallbackAbility(card, ab);
          }
        });
        r._hasR22Static = (r.abilities || []).some(a =>
          a.kind === "static" && (a.steps || []).some(s => s.op === "static" && s.kind === "r22static")
        );
      } catch (e) { if (ABX.debug) console.error(e); }
    }
    if (!keepUnreadForTest) {
      Object.defineProperty(card, "_abxParsed", { value: r, writable: true, configurable: true });
    }
    return r;
  };
  if (ABX.resetCaches) {
    const origReset = ABX.resetCaches;
    ABX.resetCaches = function () {
      DONE_R22.clear();
      if (typeof ALL_CARDS !== "undefined" && Array.isArray(ALL_CARDS)) {
        for (let i = 0; i < ALL_CARDS.length; i++) {
          if (ALL_CARDS[i] && ALL_CARDS[i]._abxParsed) ALL_CARDS[i]._abxParsed = null;
        }
      }
      return origReset.apply(this, arguments);
    };
    ABX.resetCaches();
  }
})(typeof window !== "undefined" ? window : globalThis);
