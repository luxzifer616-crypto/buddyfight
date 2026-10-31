/* ==================== ABX — round 7 ====================
 * Effects that need a hook into the game's turn / cast flow:
 *   - "This card cannot be nullified" / "... damage cannot be reduced" (spells, attacks, [Act] for this turn)
 *   - "The power/defense/critical of X cannot be reduced"
 *   - a response window when a spell / impact / monster call is made: "Nullify the spell cast by your opponent",
 *     "Nullify the call", "When your opponent casts a spell, ... If you do, nullify ..."
 *   - "That card becomes size 0 until it leaves the field", "The size of all «X» on your field is reduced by N"
 *   - "You get another attack phase / another turn", "End the attack / final phase"
 *   - "Nullify the attacking card's [Penetrate]", "Nullify all abilities of your opponent's monster in battle with this card"
 * Loaded after abilities_ops.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || !ABX.OPS || typeof battle === "undefined") return;
  const B = battle, core = ABX.core, OPS = ABX.OPS;
  const { F, otherSide, refsFor, pick, evalCond, cardOf, abilitiesOf, onceUsed, markOnce, matchFilter, costAffordable, fieldUnits, runAbility } = core;
  const fresh = () => { try { B.renderBattle && B.renderBattle(); } catch (e) { /* ignore */ } };
  const say = (t) => { try { B.setPrompt && B.setPrompt(t); } catch (e) { /* ignore */ } };
  const cut = (a, b, img) => { try { if (B.showCutin && !ABX.fast) B.showCutin(a, b, img); } catch (e) { /* ignore */ } };
  const isAuto = (side) => !!F(side).isBot || ABX.autoPlay === true;

  /* ---------- statics that only mark things (read by the hooks below) ---------- */
  const STATIC_KINDS = ["protect", "unnullifiable", "unreducible", "noStatReduce", "sizeModOthers"];
  OPS.static = {
    run(s, ctx) {
      // "[Act] ... for this turn, this card's attack cannot be nullified (if it is attacking alone)"
      if (s.kind === "unnullifiable" && ctx.unit && ctx.ab && ctx.ab.kind !== "static" && ctx.ab.kind !== "spell") ctx.unit.abxUnnull = { turn: B.turnCount, cond: s.cond || null };
      // "For this turn, the critical of all «X» on your field cannot be reduced ..."
      if (s.kind === "noStatReduce" && ctx.ab && ctx.ab.kind !== "static") {
        refsFor(s.np, ctx, { owner: "you", area: "field" }).forEach(r => { if (!r.unit) return; r.unit.abxNoReduce = r.unit.abxNoReduce || {}; r.unit.abxNoReduce[s.stat || "critical"] = B.turnCount; });
      }
      // a normal (not [Set]) spell: "The size of all «X» on your field is reduced by 1" for the rest of the turn
      if (s.kind === "sizeModOthers" && ctx.ab && ctx.ab.kind === "spell" && !(ctx.card && ctx.card.set)) {
        ctx.f.abxSizeMods = (ctx.f.abxSizeMods || []).filter(m => m.turn === B.turnCount);
        ctx.f.abxSizeMods.push({ turn: B.turnCount, np: s.np, delta: s.delta || 0, origSize: s.origSize, origLe: s.origLe });
      }
      fresh();
      return true;
    },
    check: (s) => STATIC_KINDS.includes(s.kind) && !(s.np && s.np.junk) && (s.kind !== "unnullifiable" || !s.cond || s.cond === "alone")
  };

  // "the critical of X cannot be reduced": is `unit` (on `side`) protected from a reduction of `stat`?
  ABX.statLocked = function (side, unit, stat, byOpp) {
    if (!unit) return false;
    if (unit.abxNoReduce && unit.abxNoReduce[stat] === B.turnCount) return true;
    const f = F(side);
    for (const x of fieldUnits(f, true)) {
      if (x.unit.abxNullified === B.turnCount) continue;
      for (const ab of abilitiesOf(x.unit.card, a => a.kind === "static" && !(a.unparsed && a.unparsed.length))) {
        for (const st of ab.steps || []) {
          if (st.op !== "static" || st.kind !== "noStatReduce" || (st.stat || "critical") !== stat) continue;
          if (st.byOpp && !byOpp) continue;
          const ctx = { side, f, e: F(otherSide(side)), card: x.unit.card, unit: x.unit, bind: { chosen: [] } };
          if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
          if (st.cond && !evalCond(st.cond, ctx)) continue;
          if (refsFor(st.np, ctx, { owner: "you", area: "field" }).some(r => r.unit === unit)) return true;
        }
      }
    }
    return false;
  };
  // boosts: an opponent's "gets critical-1" does nothing to a locked card
  const origBoost = OPS.boost.run;
  OPS.boost.run = function (s, ctx) {
    const neg = ["power", "defense", "critical"].filter(k => (s.mods[k] || 0) < 0);
    if (!neg.length) return origBoost.call(this, s, ctx);
    // run normally, then give back the reductions a locked card should not have taken
    const before = new Map();
    const all = core.fieldUnits(F("plr"), true).concat(core.fieldUnits(F("opp"), true));
    all.forEach(x => before.set(x.unit, { p: x.unit.tempPower || 0, d: x.unit.tempDef || 0, c: x.unit.tempCrit || 0 }));
    return Promise.resolve(origBoost.call(this, s, ctx)).then(res => {
      ["plr", "opp"].forEach(side => core.fieldUnits(F(side), true).forEach(x => {
        const u = x.unit, b = before.get(u);
        if (!b) return;
        const byOpp = side !== ctx.side;
        if ((u.tempPower || 0) < b.p && ABX.statLocked(side, u, "power", byOpp)) u.tempPower = b.p;
        if ((u.tempDef || 0) < b.d && ABX.statLocked(side, u, "defense", byOpp)) u.tempDef = b.d;
        if ((u.tempCrit || 0) < b.c && ABX.statLocked(side, u, "critical", byOpp)) u.tempCrit = b.c;
      }));
      fresh();
      return res;
    });
  };

  // Attack damage that cannot be reduced: "Damage dealt to your opponent by this card cannot be reduced if it is attacking alone",
  // "This card's attack cannot be nullified, and its damage cannot be reduced".
  ABX.attackUnreducible = function (attSide, units) {
    const us = (units || []).map(x => x.unit || x).filter(Boolean);
    for (const u of us) {
      if (u.abxNullified === B.turnCount) continue;
      for (const ab of abilitiesOf(u.card, a => a.kind === "static" && !(a.unparsed && a.unparsed.length))) {
        for (const st of ab.steps || []) {
          if (st.op !== "static" || !(st.kind === "unreducible" || (st.kind === "unnullifiable" && st.noReduce))) continue;
          if ((st.cond === "alone" || /attacking alone/i.test((st.src || "") + " " + (ab.raw || ""))) && us.length > 1) continue;
          const ctx = { side: attSide, f: F(attSide), e: F(otherSide(attSide)), card: u.card, unit: u, bind: {} };
          if (!(ab.conds || []).every(c => ABX.condExecutable(c) && evalCond(c, ctx))) continue;
          if (st.cond && st.cond !== "alone" && typeof st.cond === "object" && !(ABX.condExecutable(st.cond) && evalCond(st.cond, ctx))) continue;
          return true;
        }
      }
    }
    return false;
  };
  // effect damage: honour ctx.unreducible (set by the runner when the ability says the damage cannot be reduced)
  const origDamage = OPS.damage.run;
  OPS.damage.run = function (s, ctx) {
    if (!ctx.unreducible) return origDamage.call(this, s, ctx);
    const side = s.who === "opp" ? otherSide(ctx.side) : ctx.side;
    const n = core.amount(s.n, ctx);
    const dealt = core.applyDamage(side, n, { kind: "effect", unreducible: true });
    if (dealt > 0 && ABX.fireDamaged) ABX.fireDamaged(side);
    try { B.checkWinCondition(); } catch (e) { /* ignore */ }
    fresh();
    return dealt > 0 || n === 0;
  };

  /* ---------- cannot be nullified (cast side) ---------- */
  ABX.castUnnullifiable = function (card, casterSide) {
    if (!card) return false;
    // "If you have two or more «Chaos» on your field, this card cannot be nullified" (a conditional no-op marker on the spell)
    if (casterSide && abilitiesOf(card, a => a.kind === "spell").some(a => (a.steps || []).some(x => x.op === "noop" && x.note === "unnullifiable-ok" && x.cond && ABX.condExecutable(x.cond) &&
        evalCond(x.cond, { side: casterSide, f: F(casterSide), e: F(otherSide(casterSide)), card, bind: {} })))) return true;
    // sentences that start with "If ..." are conditional (handled by the cond-checked marker above), so they do not make the card unconditionally un-nullifiable
    if (String(card.skill || "").split(/(?<=[.!?])\s+/).some(t => !/^\s*(?:\(|if\b|when\b)/i.test(t) && /this card(?:'s cast)? cannot be nullified|this (?:spell|impact) cannot be nullified/i.test(t))) return true;
    return abilitiesOf(card, a => a.kind === "spell").some(a => (a.steps || []).some(x => x.op === "static" && x.kind === "unnullifiable" && !x.cond));
  };

  /* ---------- response window: nullify a spell / impact / call ---------- */
  const kindOk = (what, kind) => !what || what === "any" ? kind !== "call" : what === kind;
  OPS.nullifyCast = {
    run(s, ctx) {
      const cc = ABX.castCtx;
      if (!cc || !cc.active || cc.side === ctx.side) return false;
      if (!kindOk(s.what, cc.kind)) return false;
      if (ABX.castUnnullifiable(cc.card, cc.side)) { say(`⚠️ "${cc.card.name}" cannot be nullified!`); return false; }
      cc.nullified = true;
      say(`🚫 "${ctx.card.name}" nullified ${cc.kind === "call" ? "the call of" : ""} "${cc.card.name}"!`);
      return true;
    },
    check: () => true
  };
  const hasNullify = (ab, kind) => {
    const steps = ab.kind === "modal" ? [].concat(...(ab.options || []).map(o => o.steps || [])) : (ab.steps || []);
    return steps.some(x => x.op === "nullifyCast" && kindOk(x.what, kind));
  };
  const leadCostsOK = (ab, ctx) => {
    for (const st of ab.steps || []) {
      if (st.gate) break;
      if ((st.cost || st.optional) && !costAffordable(st, ctx)) return false;
      if (st.cond && !evalCond(st.cond, ctx)) return false;
      if (!st.cost && !st.optional) break;
    }
    return true;
  };

  // Everything `rSide` could use right now to nullify `card` (cast / called by the other player).
  function responseOptions(rSide, card, kind) {
    const f = F(rSide), e = F(otherSide(rSide)), out = [];
    // 1) [Counter] spells / impacts in hand: "Nullify the spell cast by your opponent", "Nullify the call"
    f.hand.forEach((id, idx) => {
      const c = cardOf(id);
      if (!c || (c.type !== "Spell" && c.type !== "Impact") || !c.cnt) return;
      const sps = abilitiesOf(c, a => a.kind === "spell");
      if (!sps.length || !sps.every(a => ABX.isExecutable(a)) || !sps.some(a => hasNullify(a, kind))) return;
      if (c.type === "Impact" && !(B.phase === "final")) return;
      const cost = typeof parseCardCost === "function" ? parseCardCost(c.cost, c.skill, f, c) : { gauge: 0, life: 0 };
      if (f.gauge.length < cost.gauge || (cost.life > 0 && f.life <= cost.life)) return;
      if (typeof evaluateCardConditions === "function" && !evaluateCardConditions(c, f, e).met) return;
      out.push({ label: `✨ Cast "${c.name}"`, sub: (c.skill || "").slice(0, 120), card: c, run: () => runCounterSpell(rSide, c, cost) });
    });
    // 2) abilities: "When your opponent casts a spell, you may ... If you do, nullify the spell" (field, item, soul, set, hand)
    const srcs = [];
    fieldUnits(f, true).forEach(x => {
      srcs.push({ unit: x.unit, card: x.unit.card, area: "field" });
      (x.unit.soul || []).forEach((sid, si) => { const c = cardOf(sid); if (c) srcs.push({ unit: null, card: c, area: "soul", host: x.unit, idx: si }); });
    });
    (f.setSpells || []).forEach(c => srcs.push({ unit: null, card: c, area: "set" }));
    f.hand.forEach((id, idx) => { const c = cardOf(id); if (c) srcs.push({ unit: null, card: c, area: "hand", idx }); });
    for (const src of srcs) {
      if (src.unit && src.unit.abxNullified === B.turnCount) continue;
      if (src.host && src.host.abxNullified === B.turnCount) continue;
      for (const ab of abilitiesOf(src.card, a => a.trigger && a.trigger.event === "oppCast" && ABX.isExecutable(a) && hasNullify(a, kind))) {
        if (ab.trigger.np && !matchFilter(card, ab.trigger.np.filter || {}, { side: otherSide(rSide) }, { f: e })) continue;
        if (onceUsed(f, src.card, ab, src.unit)) continue;
        const selfRef = src.area === "hand" ? { k: "zone", side: rSide, area: "hand", idx: src.idx, id: src.card.id, card: src.card }
          : src.area === "soul" ? { k: "soul", side: rSide, unit: src.host, idx: src.idx, id: src.card.id, card: src.card } : null;
        const ctx = { side: rSide, f, e, card: src.card, unit: src.unit, ab, bind: { chosen: src.host ? [{ k: "unit", side: rSide, unit: src.host, card: src.host.card, id: src.host.card.id }] : [], revealed: [], looked: [] },
          lastDone: true, auto: true, log: [], hostArea: src.area === "set" ? "field" : src.area, soulHost: src.host || null, selfRef, event: { name: "cast" } };
        if (!(ab.conds || []).every(c => evalCond(c, ctx))) continue;
        if (!leadCostsOK(ab, ctx)) continue;
        out.push({
          label: `✨ Use "${src.card.name}"${src.area === "hand" ? " (from hand)" : src.area === "soul" ? " (from a soul)" : ""}`, sub: ABX.clean(ab.raw || ab.cleaned || "").slice(0, 140), card: src.card,
          run: async () => {
            markOnce(f, src.card, ab, src.unit);
            cut("ABILITY!", src.card.name, src.card.img);
            await runAbility(rSide, src.card, ab, src.unit, { event: { name: "cast" }, hostArea: ctx.hostArea, soulHost: ctx.soulHost, selfRef, preApproved: true });
          }
        });
      }
    }
    return out;
  }
  ABX.responseOptions = responseOptions;

  async function runCounterSpell(side, c, cost) {
    const f = F(side);
    const i = f.hand.indexOf(c.id);
    if (i < 0) return;
    for (let g = 0; g < cost.gauge; g++) f.drop.push(f.gauge.pop());
    if (cost.life > 0) f.life -= cost.life;
    f.hand.splice(i, 1);
    if (c.set) f.setSpells.push(c); else f.drop.push(c.id);
    if (typeof noteSpellCast === "function") noteSpellCast(f, c);
    cut("COUNTER!", c.name, c.img);
    fresh();
    for (const ab of abilitiesOf(c, a => (ABX.isSpellBody ? ABX.isSpellBody(a) : a.kind === "spell"))) {
      const probe = { side, f, e: F(otherSide(side)), card: c, unit: null, ab, bind: { chosen: [] }, lastDone: true, auto: true, log: [] };
      if (!(ab.conds || []).every(x => evalCond(x, probe))) continue;
      await runAbility(side, c, ab, null, { event: { name: "counter" }, selfRef: ABX.castSelfRef ? ABX.castSelfRef(side, c) : null });
    }
    if (ABX.fireCast) ABX.fireCast(side, c);
  }

  // [Counter] spell cast from the hand on the OPPONENT'S turn, outside any attack (destroy / draw / call / life / gauge ...).
  // Attack-nullifying spells stay in the defense window. Returns true when the card can be cast right now.
  ABX.freeCounterOption = function (side, c) {
    if (!c || (c.type !== "Spell" && c.type !== "Impact") || ABX.enabled === false || B.matchOver || !ABX.ownsCounter || !ABX.ownsCounter(c)) return false;
    const f = F(side), e = F(otherSide(side));
    if (f.timeStoppedThisTurn || f.timeStoppedThisBattle) return false;
    const cs = ABX.counterSpellOption(side, c, { free: true });
    if (!cs || cs.nullifies) return false;
    const cost = typeof parseCardCost === "function" ? parseCardCost(c.cost, c.skill, f, c) : { gauge: 0, life: 0 };
    if (f.gauge.length < cost.gauge || (cost.life > 0 && f.life <= cost.life)) return false;
    return typeof evaluateCardConditions !== "function" || evaluateCardConditions(c, f, e).met;
  };
  ABX.castFreeCounter = async function (side, c) {
    if (!ABX.freeCounterOption(side, c)) return false;
    const f = F(side);
    const cost = typeof parseCardCost === "function" ? parseCardCost(c.cost, c.skill, f, c) : { gauge: 0, life: 0 };
    await runCounterSpell(side, c, cost);
    return true;
  };

  // Priority window: while the bot plays its turn, a human with a usable free [Counter] (hand spell / impact, field / [Set] ability)
  // gets a short "use it or pass" prompt at the end of the bot's Main Phase and before its turn ends. No prompt when nothing is usable.
  ABX.priorityWindow = async function (side, label) {
    const f = F(side);
    if (!f || f.isBot || ABX.autoPlay === true || B.matchOver || B.mode === "online_p2p" || !ABX.ui || typeof ABX.ui.pickOption !== "function") return;
    for (let round = 0; round < 6; round++) {
      const opts = [];
      f.hand.forEach(id => {
        const c = cardOf(id);
        if (c && !opts.some(o => o.card === c) && ABX.freeCounterOption(side, c)) opts.push({ card: c, label: `⚡ Cast "${c.name}"`, run: () => ABX.castFreeCounter(side, c) });
      });
      ABX.freeFieldCounterOptions(side).forEach(o => opts.push({ card: o.card, label: `⚡ ${o.card.name}: ${(o.sub || "").slice(0, 60)}`, run: () => ABX.useFreeFieldCounter(side, o.key) }));
      if (!opts.length) return;
      const i = await ABX.ui.pickOption({ title: `⚡ Counter window — ${label}`, options: opts.map(o => ({ label: o.label })).concat([{ label: "Pass" }]) });
      if (typeof i !== "number" || i < 0 || i >= opts.length) return;
      await opts[i].run();
      if (B.matchOver) return;
    }
  };

  // Called by game.js before a spell / impact resolves and when a monster is called from the hand.
  // Resolves to true when the other player nullified it.
  ABX.castWindow = async function (casterSide, card, kind) {
    if (!card || ABX.enabled === false || B.matchOver) return false;
    const rSide = otherSide(casterSide);
    if (ABX.castUnnullifiable(card, casterSide)) return false;
    if (B.mode === "online_p2p" && rSide === "opp") return askOnlineFriend(casterSide, card, kind);
    let opts;
    try { opts = responseOptions(rSide, card, kind); } catch (e) { if (ABX.debug) console.error(e); return false; }
    if (!opts.length) return false;
    let idx = -1;
    if (ABX.hooks && ABX.hooks.castResponse) idx = await ABX.hooks.castResponse(rSide, card, kind, opts);
    else if (isAuto(rSide)) idx = 0;
    else {
      const what = kind === "call" ? "is calling" : kind === "impact" ? "is casting the Impact" : "is casting";
      idx = await ABX.ui.pickOption({
        title: `${F(casterSide).name || "Opponent"} ${what} "${card.name}" — respond?`,
        subtitle: "You can nullify it now.",
        options: opts.map(o => ({ label: o.label, sub: o.sub })).concat([{ label: "➡️ Let it resolve" }])
      });
      if (idx >= opts.length) idx = -1;
    }
    if (idx == null || idx < 0 || !opts[idx]) return false;
    const prev = ABX.castCtx;
    const cc = ABX.castCtx = { active: true, side: casterSide, card, kind, nullified: false };
    try { await opts[idx].run(); } catch (e) { if (ABX.debug) console.error(e); }
    finally { ABX.castCtx = prev; }
    fresh();
    return cc.nullified;
  };

  /* ---------- online: ask the friend's device ---------- */
  // The friend's device gets the board, works out its own options and answers with the label + card id it picked.
  // The answer is then run here (this device owns the cast), with the friend's small follow-up picks made automatically.
  let onlineReq = 0;
  const pendingOnline = new Map();
  const ONLINE_WAIT_MS = 90000;
  const peer = () => (typeof app !== "undefined" && app.peerConn && app.peerConn.open) ? app.peerConn : null;
  async function askOnlineFriend(casterSide, card, kind) {
    const conn = peer();
    if (!conn) return false;
    let opts;
    try { opts = responseOptions("opp", card, kind); } catch (e) { if (ABX.debug) console.error(e); return false; }
    if (!opts.length) return false;   // nothing the friend could answer with: don't make them wait
    const reqId = ++onlineReq;
    say(`⏳ Waiting for Online Friend to respond to "${card.name}"…`);
    const answer = await new Promise(resolve => {
      const timer = setTimeout(() => { pendingOnline.delete(reqId); resolve(null); }, ABX.onlineWaitMs || ONLINE_WAIT_MS);
      pendingOnline.set(reqId, (a) => { clearTimeout(timer); pendingOnline.delete(reqId); resolve(a); });
      try {
        conn.send({
          type: "P2P_CAST_PROMPT", reqId, cardId: card.id, kind,
          stateSnapshot: { turnCount: B.turnCount, turn1AttackUsed: !!B.turn1AttackUsed, activeSideForReceiver: B.activeSide === "plr" ? "opp" : "plr", phase: B.phase,
            senderPlr: JSON.parse(JSON.stringify(B.plr)), senderOpp: JSON.parse(JSON.stringify(B.opp)) }
        });
      } catch (e) { clearTimeout(timer); pendingOnline.delete(reqId); resolve(null); }
    });
    if (B.matchOver || !answer || answer.label == null) { say(`▶️ "${card.name}" resolves.`); return false; }
    opts = responseOptions("opp", card, kind);   // re-check: the board may only be answered from what is still possible
    const pickIdx = opts.findIndex(o => o.label === answer.label && o.card && Number(o.card.id) === Number(answer.cardId));
    if (pickIdx < 0) return false;
    const prev = ABX.castCtx, prevAuto = ABX.remoteAutoSide;
    const cc = ABX.castCtx = { active: true, side: casterSide, card, kind, nullified: false };
    ABX.remoteAutoSide = "opp";
    try { await opts[pickIdx].run(); } catch (e) { if (ABX.debug) console.error(e); }
    finally { ABX.castCtx = prev; ABX.remoteAutoSide = prevAuto; }
    fresh();
    try { B.sendOnlineStateToPeer && B.sendOnlineStateToPeer(cc.nullified ? `🚫 You nullified "${card.name}"!` : null); } catch (e) { /* ignore */ }
    return cc.nullified;
  }
  // the friend's answer arrived (game.js routes P2P_CAST_RESPONSE here)
  ABX.receiveCastResponse = function (msg) {
    const done = msg && pendingOnline.get(Number(msg.reqId));
    if (done) done({ label: typeof msg.label === "string" ? msg.label.slice(0, 300) : null, cardId: Number(msg.cardId) || 0 });
  };
  // On the friend's device: show the "respond?" window and send back what was picked (game.js routes P2P_CAST_PROMPT here).
  ABX.answerCastPrompt = async function (msg) {
    const conn = peer();
    const reply = (label, cardId) => { try { conn && conn.send({ type: "P2P_CAST_RESPONSE", reqId: msg.reqId, label: label == null ? null : label, cardId: cardId || 0 }); } catch (e) { /* ignore */ } };
    const card = typeof CARD_MAP !== "undefined" ? CARD_MAP.get(Number(msg.cardId)) : null;
    if (!card || !["spell", "impact", "call"].includes(msg.kind) || ABX.castUnnullifiable(card)) return reply(null);
    let opts = [];
    try { opts = responseOptions("plr", card, msg.kind); } catch (e) { if (ABX.debug) console.error(e); }
    if (!opts.length) return reply(null);
    let idx = -1;
    if (ABX.hooks && ABX.hooks.castResponse) idx = await ABX.hooks.castResponse("plr", card, msg.kind, opts);
    else {
      const what = msg.kind === "call" ? "is calling" : msg.kind === "impact" ? "is casting the Impact" : "is casting";
      idx = await ABX.ui.pickOption({
        title: `🌐 Online Friend ${what} "${card.name}" — respond?`,
        subtitle: "You can nullify it now.",
        options: opts.map(o => ({ label: o.label, sub: o.sub })).concat([{ label: "➡️ Let it resolve" }])
      });
    }
    if (idx == null || idx < 0 || !opts[idx]) return reply(null);
    reply(opts[idx].label, opts[idx].card && opts[idx].card.id);
  };

  /* ---------- size 0 ---------- */
  OPS.setSize0 = {
    run(s, ctx) {
      let units = [];
      if (s.np && s.np.self) units = ctx.unit ? [ctx.unit] : [];
      else {
        if (ctx.calledPos && ctx.f.monsters[ctx.calledPos]) units = [ctx.f.monsters[ctx.calledPos]];
        else units = (ctx.bind.chosen || []).filter(r => r.unit).map(r => r.unit);
      }
      // "... as long as "X" is on the field": remember X; the size 0 ends as soon as no X is on either field
      units.forEach(u => { u.abxSize0 = s.whileName ? { whileName: s.whileName } : true; });
      fresh();
      return units.length > 0;
    },
    check: (s) => !!s.np
  };

  /* ---------- extra phases / ending phases ---------- */
  OPS.extraPhase = {
    run(s, ctx) {
      const f = ctx.f;
      if (s.what === "turn") f.abxExtraTurn = (f.abxExtraTurn || 0) + 1;
      else f.abxExtraAttack = { turn: B.turnCount, n: ((f.abxExtraAttack && f.abxExtraAttack.turn === B.turnCount) ? f.abxExtraAttack.n : 0) + 1 };
      say(s.what === "turn" ? `⏩ ${f.name || "You"} will get another turn after this one!` : `⚔️ ${f.name || "You"} get another attack phase this turn!`);
      return true;
    },
    check: (s) => s.what === "turn" || s.what === "attack"
  };
  // game.js asks these when a phase / turn ends
  ABX.takeExtraAttack = function (side) {
    const f = F(side), x = f.abxExtraAttack;
    if (!x || x.turn !== B.turnCount || x.n <= 0) return false;
    x.n--;
    // standing cards may attack again
    fieldUnits(f, true).forEach(u => { if (!u.unit.rested) u.unit.attacksLeft = Math.max(u.unit.attacksLeft || 0, u.unit.card.atk_max || 1); });
    return true;
  };
  ABX.takeExtraTurn = function (side) {
    const f = F(side);
    if (!f.abxExtraTurn) return false;
    f.abxExtraTurn--;
    return true;
  };
  OPS.endPhase = {
    run(s, ctx) {
      if (s.phase === "attack") {
        B.abxEndAttackTurn = B.turnCount;
        if (ABX.battleCtx && ABX.battleCtx.active) ABX.battleCtx.nullified = true;   // the battle in progress ends with the phase
        if (B.phase === "attack" && B.activeSide === ctx.side && !ABX.battleCtx) { B.phase = "final"; say("🔥 The attack phase ended — Final Phase."); fresh(); }
        else say("🛑 The attack phase will end after this battle.");
        return true;
      }
      if (s.phase === "final") {
        const side = ctx.side, turn = B.turnCount;
        if (B.activeSide !== side) {
          // Used on the OPPONENT's turn (#5341 REB00T): their turn ends once the battle in progress is over.
          // No more attacks meanwhile; a bot attacker stops too (its own loop then ends its turn).
          const actSide = B.activeSide;
          B.abxEndAttackTurn = turn; B.abxEndTurnTurn = turn;
          const tryEnd = (n) => {
            if (B.matchOver || B.turnCount !== turn || B.activeSide !== actSide) return;
            if ((ABX.battleCtx && ABX.battleCtx.active) || B.pendingDefenseContext) { if (n < 200) setTimeout(() => tryEnd(n + 1), ABX.fast ? 0 : 300); return; }
            say("🔚 The turn ended."); B.endTurn();
          };
          setTimeout(() => tryEnd(0), ABX.fast ? 0 : 300);
          return true;
        }
        setTimeout(() => {
          if (B.matchOver || B.turnCount !== turn || B.activeSide !== side) return;
          if (B.phase === "final" && (!B.isLocalTurn || B.isLocalTurn())) { say("🔚 The final phase ended."); B.endTurn(); }
        }, ABX.fast ? 0 : 900);
        return true;
      }
      if (s.phase === "main") { if (B.phase === "main" && B.activeSide === ctx.side) { B.phase = "attack"; fresh(); } return true; }
      return false;
    },
    check: (s) => ["attack", "final", "main"].includes(s.phase)
  };
  ABX.attackPhaseEnded = () => B.abxEndAttackTurn === B.turnCount;
  ABX.turnEnded = () => B.abxEndTurnTurn === B.turnCount;   // "end the turn" used on the opponent's turn

  /* ---------- keywords / abilities nullified in battle ---------- */
  OPS.nullifyKeyword = {
    run(s, ctx) {
      const units = (ctx.event && ctx.event.attUnits) || (ABX.battleCtx && ABX.battleCtx.attUnits) || [];
      let n = 0;
      units.forEach(u => { if (!u) return; u.abxNoKw = u.abxNoKw || {}; u.abxNoKw[s.kw] = B.turnCount; n++; });
      if (n) say(`🛡️ "${ctx.card.name}" nullified the attacker's [${s.kw.replace(/\b\w/g, m => m.toUpperCase())}]!`);
      fresh();
      return n > 0;
    },
    check: (s) => ["penetrate", "double attack", "triple attack", "counterattack", "soulguard"].includes(s.kw)
  };
  ABX.kwNullified = (unit, kw) => !!(unit && unit.abxNoKw && unit.abxNoKw[kw] === B.turnCount);

  // "Nullify all abilities of your opponent's monster(s) in battle with this card." (static) — lasts until the battle ends.
  let battleNull = [];
  function inBattleNullifiers(unit) {
    return abilitiesOf(unit.card, a => a.kind === "static" && !(a.unparsed && a.unparsed.length)).filter(ab => (ab.steps || []).some(x => x.op === "nullifyAbilities" && x.np && /in battle with this card/i.test(x.np.raw || "")));
  }
  ABX.applyBattleNullify = function (attSide, attUnits, defSide, defUnit) {
    ABX.clearBattleNullify();
    const pairs = [];
    (attUnits || []).forEach(u => { if (u && defUnit) pairs.push({ side: attSide, unit: u, victims: [{ side: defSide, unit: defUnit }] }); });
    if (defUnit) pairs.push({ side: defSide, unit: defUnit, victims: (attUnits || []).filter(Boolean).map(u => ({ side: attSide, unit: u })) });
    for (const p of pairs) {
      if (!p.unit || !p.unit.card || p.unit.abxNullified === B.turnCount) continue;
      for (const ab of inBattleNullifiers(p.unit)) {
        const ctx = { side: p.side, f: F(p.side), e: F(otherSide(p.side)), card: p.unit.card, unit: p.unit, bind: {} };
        if (!(ab.conds || []).every(c => ABX.condExecutable(c) && evalCond(c, ctx))) continue;
        const st = ab.steps.find(x => x.op === "nullifyAbilities");
        if (st.cond && !evalCond(st.cond, ctx)) continue;
        const monOnly = /monsters?\b/i.test(st.np.raw || "") && !/characters?/i.test(st.np.raw || "");
        p.victims.forEach(v => {
          if (monOnly && v.unit === F(v.side).item) return;
          if (core.isProtected && core.isProtected(v.unit, v.side, "nullified", ctx)) return;
          if (v.unit.abxNullified === B.turnCount) return;
          battleNull.push({ unit: v.unit, prev: v.unit.abxNullified });
          v.unit.abxNullified = B.turnCount;
        });
      }
    }
    if (battleNull.length) fresh();
  };
  ABX.clearBattleNullify = function () {
    battleNull.forEach(x => { x.unit.abxNullified = x.prev; });
    battleNull = [];
  };
})(typeof window !== "undefined" ? window : globalThis);
