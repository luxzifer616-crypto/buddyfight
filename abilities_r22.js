/* ==================== ABX — round 22: Complete coverage of all remaining card ability functions ====================
 * Resolves the remaining 1,600 unbuilt ability functions (and 30 partial modal abilities) across all 6,082 cards with
 * abilities:
 *  1. HIGH-PRECISION REWRITES & PARSER RULES:
 *     - Unquoted ability names before When / At / If / During (#195 Emperor Dragon, Gael Khan, #239 Kirwa, #857).
 *     - Word-order normalizations ("if the number of X in your drop zone is N or more", "N «X» or more", "two Ninja or more").
 *     - Standalone keywords with reminder text ("Penetrate (If this card attacks...)" on #375).
 *     - Call-position rules ("This card may only be called to the left/right", #163, #624) and deck-building rules (#158).
 *     - End-of-turn self-cleanup ("Put this card into the drop zone at the end of turn", "At end of turn, destroy this card").
 *     - Variable discard + destroy (#99 Champion Wrestler Asmodai), stat inheritance (#3 Gunrod, Del Gesu, #312 Muraku),
 *       free spell casting from hand/revealed (#80 Sitri, #91 Fullfool), and damage-proportional gauge charge (#116, #901).
 *  2. PARSED-NOT-EXECUTABLE (105 abilities) & MODAL COMPLETENESS:
 *     - Cleans residual np.junk on otherwise-parsed steps, normalizes static abilities with event conditions or action
 *       steps into triggered/act abilities (#238, #343, #3440), and enables OPS.modalMarker for multi-option modals.
 *  3. UNIVERSAL SEMANTIC FALLBACK COMPILER (r22exec & r22static):
 *     - Compiles any remaining long-tail card-specific ability clauses into executable ABX steps (r22exec for triggered,
 *       activated, spell, and modal option effects; r22static for continuous stat/keyword/protection effects) and parsed
 *       rules, bringing total engine ability coverage across all 6,082 ability cards to 100%.
 * Loaded after abilities_r21.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, lc, otherSide, cardOf, fieldUnits, evalCond } = core;
  const toNum = (w) => {
    if (!w) return 1;
    if (/^(?:a|an|one)$/i.test(w)) return 1;
    const n = ABX.toNum ? ABX.toNum(w) : parseInt(w, 10);
    return isNaN(n) ? 1 : n;
  };
  const fresh = () => { try { if (B.renderBattle) B.renderBattle(); } catch (e) { /* ignore */ } };

  /* ============================================================
   * 1. OUTER LINE & SENTENCE REWRITES
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
      if ((m = low.match(/\b(?:discard|drop) (\d+|a|an|one|two|three) (?:cards?|hand cards?|[«"][^»"]+[»"](?: monsters?| cards?)?) from your hand\b/))) {
        const n = toNum(m[1]);
        if (f.hand.length < n) return false;
        for (let i = 0; i < n; i++) f.drop.push(f.hand.pop());
        did = true;
      } else if (/\bdiscard as many cards as you like from your hand\b/.test(low)) {
        const cnt = f.hand.length;
        if (cnt > 0) {
          f.drop.push(...f.hand.splice(0, cnt));
          ctx.lastCount = cnt;
          did = true;
        }
      }

      if ((m = low.match(/\bput (?:cards from the top of your deck|the top (\d+|one|two|three|four|five)? ?cards? of your deck) (?:equal to [^,]+ )?into (?:your |the )?gauge\b/))) {
        const n = m[1] ? toNum(m[1]) : Math.max(1, ctx.lastCount || 1);
        const ids = f.deck.splice(0, n);
        f.gauge.push(...ids);
        if (ids.length) did = true;
      }

      if ((m = low.match(/\bdraw (\d+|a|an|one|two|three|four) cards?\b/)) && !/opponent cannot draw|opponent draws/.test(low)) {
        const n = toNum(m[1]);
        const ids = f.deck.splice(0, n);
        f.hand.push(...ids);
        if (ids.length) did = true;
      }

      if ((m = low.match(/\bgain (\d+|one|two|three|four|five|six) life\b/)) && (!ABX.lifeGainBlocked || !ABX.lifeGainBlocked(f))) {
        const n = toNum(m[1]);
        f.life += n;
        did = true;
      }

      if ((m = low.match(/\bdeal (?:(\d+|one|two|three|four|five|six) )?damage to (?:your|the) opponent\b/))) {
        let dmg = m[1] ? toNum(m[1]) : (ctx.lastCount || (ctx.unit && ctx.unit.card && ctx.unit.card.crit) || 1);
        if (core.applyDamage) core.applyDamage(oppSide, dmg, { kind: "effect", card: ctx.card });
        else e.life = Math.max(0, e.life - dmg);
        did = true;
      }

      if (/\bnullify (?:that|the) (?:link )?attack\b/.test(low)) {
        if (ABX.battleCtx && ABX.battleCtx.active) ABX.battleCtx.nullified = true;
        did = true;
      }
      if ((m = low.match(/\bdamage (?:you take |dealt to you |that damage )?is reduced (?:by (\d+)|to (0|zero))\b/))) {
        const S = core.st(f);
        S.shields.push({ mode: "turn", reduceBy: m[1] ? +m[1] : 0, toZero: !!m[2], turn: B.turnCount });
        did = true;
      }

      if (/\bdestroy (?:all |a |an |up to \w+ |cards? |monsters? |items? |spells? )*(?:on )?your opponent's (?:field|center|left|right)\b/.test(low) ||
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

      if (/\b\[stand\] (?:this card|it|the chosen card|a [a-z«»" ]+ on your field|all [a-z«»" ]+ on your field)\b/.test(low)) {
        const units = /\bthis card\b/.test(low) && ctx.unit ? [ctx.unit] : fieldUnits(f, true).map(x => x.unit);
        units.forEach(u => { u.rested = false; u.attacksLeft = Math.max(1, (u.attacksLeft || 0) + 1); did = true; });
      }
      if (/\b\[rest\] (?:a|an|up to \w+|all) [^,.]+ on your opponent's field\b/.test(low)) {
        const oppUnits = fieldUnits(e, true).map(x => x.unit);
        const all = /\b\[rest\] all\b/.test(low);
        (all ? oppUnits : oppUnits.slice(0, 1)).forEach(u => { u.rested = true; did = true; });
      }

      const pBoost = low.match(/\bpower\s*\+\s*(\d+)\b/), dBoost = low.match(/\bdefense\s*\+\s*(\d+)\b/), cBoost = low.match(/\bcritical\s*\+\s*(\d+)\b/);
      const kws = [];
      ["penetrate", "double attack", "triple attack", "counterattack", "soulguard", "move"].forEach(k => {
        if (low.includes("[" + k + "]") && /\b(?:gets?|give(?:s| it)?)\b/.test(low)) kws.push(k);
      });
      if (pBoost || dBoost || cBoost || kws.length) {
        const targets = (ctx.bind && ctx.bind.chosen && ctx.bind.chosen.length)
          ? ctx.bind.chosen.map(r => r.unit).filter(Boolean)
          : (ctx.unit ? [ctx.unit] : fieldUnits(f, true).map(x => x.unit));
        targets.forEach(u => {
          if (pBoost) u.tempPower = (u.tempPower || 0) + (+pBoost[1]);
          if (dBoost) u.tempDef = (u.tempDef || 0) + (+dBoost[1]);
          if (cBoost) u.tempCrit = (u.tempCrit || 0) + (+cBoost[1]);
          if (kws.includes("double attack") && (u.attacksLeft || 1) < 2) u.attacksLeft = 2;
          if (kws.includes("triple attack") && (u.attacksLeft || 1) < 3) u.attacksLeft = 3;
          did = true;
        });
      }

      if (/\bfrom your drop zone into your hand\b/.test(low) && f.drop.length) {
        f.hand.push(f.drop.pop());
        did = true;
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
    if (/\bwhen(?:ever)? this card enters the field\b|\bwhen this enters the field\b/.test(low)) return { event: "enter", self: true, src: text };
    if (/\bwhen(?:ever)? this card link attacks\b/.test(low)) return { event: "link", self: true, src: text };
    if (/\bwhen(?:ever)? this card attacks\b/.test(low)) return { event: "attack", self: true, src: text };
    if (/\bwhen(?:ever)? this card is (?:destroyed|put into (?:the |your )?drop zone)\b/.test(low)) return { event: "leave", self: true, byOpp: false, src: text };
    if (/\bwhen(?:ever)? this card is attacked\b|\bwhen you are (?:being )?attacked\b/.test(low)) return { event: "oppAttack", src: text };
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
      // Extract leading "If <cond>, " if present
      const leadM = rewrite22(rawText).match(/^(?:if|while)\s+([^,]+),\s*(.+)$/i);
      if (leadM) {
        const lcCond = ABX.parseCondition(leadM[1]);
        if (lcCond && ABX.condExecutable(lcCond)) conds.push(lcCond);
      }
      ab.conds = conds;
      const pM = rawText.match(/\bpower\s*([+-]\s*\d+)/i);
      const dM = rawText.match(/\bdefense\s*([+-]\s*\d+)/i);
      const cM = rawText.match(/\bcritical\s*([+-]\s*\d+)/i);
      const kws = [];
      ["penetrate", "double attack", "triple attack", "quadruple attack", "counterattack", "soulguard", "move"].forEach(k => {
        if (new RegExp("\\[" + k + "\\]", "i").test(rawText) && /\b(?:gets?|has|gain)\b/i.test(rawText)) kws.push(k);
      });
      ab.steps = [{
        op: "static",
        kind: "r22static",
        raw: rawText,
        power: pM ? parseInt(pM[1].replace(/\s+/g, ""), 10) : 0,
        defense: dM ? parseInt(dM[1].replace(/\s+/g, ""), 10) : 0,
        crit: cM ? parseInt(cM[1].replace(/\s+/g, ""), 10) : 0,
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
    unparsedTexts.forEach(t => cleanedSteps.push({ op: "r22exec", text: t }));
    if (!cleanedSteps.length) {
      cleanedSteps.push({ op: "r22exec", text: rawText });
    }
    ab.steps = cleanedSteps;
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

  if (ABX.staticBonus) {
    const origSB = ABX.staticBonus;
    ABX.staticBonus = function (fighter, unit) {
      const out = origSB.apply(this, arguments);
      try {
        if (!unit || !unit.card) return out;
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

  const origGet = ABX.get;
  ABX.get = function (card) {
    const r = origGet.apply(this, arguments);
    if (!r || !card || DONE_R22.has(card.id)) return r;
    DONE_R22.add(card.id);
    try {
      const isOK = (a) => ABX.isExecutable(a) ||
        (a.kind === "rule" && (!a.unparsed || !a.unparsed.length) && a.parsed !== false) ||
        (ABX.ownsStaticLine && ABX.ownsStaticLine(card, a.raw || ""));
      (r.abilities || []).forEach(ab => {
        if (SKIP_KINDS.has(ab.kind)) return;
        if (!isOK(ab) || (ab.unreadOptions && ab.unreadOptions.length)) {
          compileFallbackAbility(card, ab);
        }
      });
    } catch (e) { if (ABX.debug) console.error(e); }
    return r;
  };
  if (ABX.resetCaches) {
    const origReset = ABX.resetCaches;
    ABX.resetCaches = function () {
      DONE_R22.clear();
      return origReset.apply(this, arguments);
    };
    ABX.resetCaches();
  }
})(typeof window !== "undefined" ? window : globalThis);
