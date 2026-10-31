/* ==================== IMPACT MONSTERS ====================
 * Impact Monster = a card of type "Impact" that also has Size / Power / Defense / Critical.
 * Rules implemented here (from the card text: "regarded as both a monster and an impact"):
 *   - It is called ONLY during your Final Phase (or by another card's effect / its own ability).
 *   - You may call only ONE impact monster per turn by paying its [Call Cost].
 *   - It has Size, Power, Defense, Critical like a monster and may ATTACK during the Final Phase.
 *   - It STAYS on the field at the end of the turn, unless one of its abilities says otherwise.
 *
 * This file has two parts:
 *   1) PARSER  (pure functions, no DOM)  - turns every Impact Monster's text into data:
 *        call cost, call requirements, abilities (trigger + condition + effects), keywords.
 *   2) ENGINE  (extends `battle`)        - checks/pays the cost, places the monster, fires its abilities.
 * Anything the parser can't turn into an effect is kept in `unsupported` so it is never silently lost.
 */
(function (root) {
  "use strict";

  const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
  const toNum = (w) => {
    if (w === undefined || w === null) return NaN;
    const k = String(w).toLowerCase();
    return k in WORDNUM ? WORDNUM[k] : parseInt(k, 10);
  };
  const clean = (t) => (t || "")
    .replace(/�([^�\n]+)�/g, "«$1»")
    .replace(/�/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const norm = (s) => (root.normalizeSearchToken ? root.normalizeSearchToken(s) : String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""));

  // game.js declares ALL_CARDS / CARD_MAP with `const` (not window properties), so read them by bare name.
  const allCards = () => (typeof ALL_CARDS !== "undefined" ? ALL_CARDS : (root.BUDDYFIGHT_CARDS || []));
  const getCard = (id) => (typeof CARD_MAP !== "undefined" ? CARD_MAP.get(id) : (allCards().find(c => c.id === id) || undefined));

  const IMX = {};

  IMX.isImpactMonster = function (card) {
    return !!card && card.type === "Impact" &&
      (card.size !== null && card.size !== undefined ||
        card.power !== null && card.power !== undefined ||
        card.defense !== null && card.defense !== undefined ||
        card.crit !== null && card.crit !== undefined);
  };
  IMX.isUnit = function (unit) { return !!unit && IMX.isImpactMonster(unit.card); };

  /* ---------- card filters ("a «Sun Dragon» monster", "a monster with "Crimson" in its card name") ---------- */
  const GENERIC_WORDS = new Set(["originally", "his", "her", "a", "an", "the", "one", "two", "three", "four", "five", "six", "up", "to", "or", "more", "monster", "monsters", "item", "items", "spell", "spells", "card", "cards", "character", "characters", "impact", "other", "another", "your", "from", "field", "size", "of", "different", "with", "and", "in", "its", "name", "on", "that", "is", "not", "an", "any", "number"]);

  IMX.parseFilter = function (text) {
    const t = clean(text);
    const f = { names: [], attrs: [], worlds: [], types: [], size: null, power: null, notImpact: false, onlyImpact: false, tokens: [], distinct: false, raw: t };
    let rest = t;
    f.soulNames = []; f.altNames = []; f.characters = /\bcharacters?\b/i.test(t);
    rest = rest.replace(/with an? soul with "([^"]+)" in its card name/ig, (m, n) => { f.soulNames.push(n.toLowerCase()); return " "; });
    rest = rest.replace(/\b(?:monster|item|card|spell)s? or "([^"]+)"/ig, (m, n) => { f.altNames.push(n.toLowerCase()); return " monster "; });
    rest = rest.replace(/"([^"]+)"/g, (m, n) => { f.names.push(n.toLowerCase()); return " "; });
    rest = rest.replace(/«([^»]+)»/g, (m, n) => { f.attrs.push(n); return " "; });
    rest = rest.replace(/<([^>]+)>/g, (m, n) => { f.worlds.push(n); return " "; });
    const sz = rest.match(/size\s+(\d+)(?:\s+(or less|or greater|or more))?/i);
    if (sz) { f.size = { n: +sz[1], cmp: /less/i.test(sz[2] || "") ? "le" : /greater|more/i.test(sz[2] || "") ? "ge" : "eq" }; rest = rest.replace(sz[0], " "); }
    const pw = rest.match(/(\d+)\s+power\s+or\s+(less|more)/i);
    if (pw) { f.power = { n: +pw[1], cmp: /less/i.test(pw[2]) ? "le" : "ge" }; rest = rest.replace(pw[0], " "); }
    if (/not an? impact monster/i.test(rest)) { f.notImpact = true; rest = rest.replace(/that is not an? impact monster|not an? impact monster/ig, " "); }
    if (/impact monsters?/i.test(rest)) { f.onlyImpact = true; rest = rest.replace(/impact monsters?/ig, " "); }
    if (/different/i.test(rest)) f.distinct = true;
    if (/\bmonsters?\b/i.test(rest)) f.types.push("Monster");
    if (/\bitems?\b/i.test(rest)) f.types.push("Item");
    if (/\bspells?\b/i.test(rest)) f.types.push("Spell");
    // leftover words (e.g. "Black Dragon", "Skull Warrior", "Ninja") are tribe / name tokens
    const words = rest.replace(/[^A-Za-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
    const lefts = words.filter(w => !GENERIC_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));
    if (lefts.length) {
      // keep "Wydar Sarkal or Fairy" style lists as separate alternatives
      const joined = rest.replace(/[^A-Za-z0-9' ]+/g, " ").split(/\s+/).filter(w => w && !/^\d+$/.test(w));
      let cur = [];
      const alts = [];
      joined.forEach(w => {
        const lw = w.toLowerCase();
        if (lw === "or" || lw === "and") { if (cur.length) alts.push(cur.join(" ")); cur = []; }
        else if (!GENERIC_WORDS.has(lw)) cur.push(w);
        else if (cur.length) { alts.push(cur.join(" ")); cur = []; }
      });
      if (cur.length) alts.push(cur.join(" "));
      f.tokens = alts.filter(Boolean);
    }
    return f;
  };

  IMX.matchCard = function (card, f) {
    if (!card) return false;
    if (f.altNames && f.altNames.length && f.altNames.some(n => (card.name || "").toLowerCase().includes(n))) return true;
    if (f.onlyImpact && !IMX.isImpactMonster(card)) return false;
    if (f.notImpact && IMX.isImpactMonster(card)) return false;
    if (f.types.length) {
      const isMon = card.type === "Monster" || IMX.isImpactMonster(card);
      const ok = f.types.some(ty => ty === "Monster" ? isMon : card.type === ty);
      if (!ok) return false;
    }
    const nameN = (card.name || "").toLowerCase();
    if (f.names.length && !f.names.some(n => nameN.includes(n))) return false;
    const attrsN = (card.attrs || []).map(a => norm(a));
    const nameNorm = norm(card.name);
    const hasTribe = (tok) => { const k = norm(tok); return attrsN.some(a => a.includes(k)) || nameNorm.includes(k); };
    if (f.attrs.length && !f.attrs.some(hasTribe)) return false;
    if (f.worlds.length && !f.worlds.some(w => (card.worlds || []).includes(w))) return false;
    if (f.tokens.length && !f.tokens.some(hasTribe)) return false;
    if (f.size && card.size !== null && card.size !== undefined) {
      if (f.size.cmp === "eq" && card.size !== f.size.n) return false;
      if (f.size.cmp === "le" && card.size > f.size.n) return false;
      if (f.size.cmp === "ge" && card.size < f.size.n) return false;
    }
    if (f.power && card.power !== null && card.power !== undefined) {
      if (f.power.cmp === "le" && card.power > f.power.n) return false;
      if (f.power.cmp === "ge" && card.power < f.power.n) return false;
    }
    return true;
  };

  /* ---------- CALL COST ---------- */
  function extractCallCostText(card) {
    const lines = clean(card.skill || "").split(/\n+/);
    let line = lines.find(l => /^\[Call Cost\]/i.test(l.trim()));
    if (!line) { const pay = lines.find(l => /^\[Pay \d+ (gauge|life)/i.test(l.trim())); if (pay) line = "[Call Cost] " + pay.trim(); }
    if (!line) line = clean(card.cost || "");
    if (!line) return "";
    let body = line.replace(/^\[Call Cost\]\s*/i, "");
    if (body.startsWith("[")) {
      // bracketed list: take up to the matching close bracket
      let depth = 0, end = -1;
      for (let i = 0; i < body.length; i++) {
        if (body[i] === "[") depth++;
        else if (body[i] === "]") { depth--; if (depth === 0) { end = i; break; } }
      }
      body = end > 0 ? body.slice(1, end) : body.slice(1);
    } else {
      body = body.split(/\s\/\s|\. /)[0];
    }
    return body.trim();
  }

  const DEST_RULES = [
    { re: /\bon the bottom of your deck|to the bottom of your deck|bottom of your deck/i, dest: "toBottom" },
    { re: /into your gauge|into the gauge/i, dest: "toGauge" },
    { re: /into (?:this card's|its) soul/i, dest: "toSoul" },
    { re: /into (?:your|the) drop zone|to the drop zone|into your drop/i, dest: "toDrop" },
    { re: /(?:to|into) your hand|to his or her hand/i, dest: "toHand" }
  ];

  function parseCostPart(partRaw) {
    const part = partRaw.trim().replace(/\.$/, "");
    const p = part.toLowerCase();
    let m;
    if ((m = p.match(/^pay (\d+) gauge/))) return { kind: "gauge", n: +m[1] };
    if ((m = p.match(/^pay (\d+) life/))) return { kind: "life", n: +m[1] };
    if ((m = part.match(/^put (?:this card|it) on top of (?:an? |one )?(.+?)(?: you are \[transform\] into)?(?: on your field)?$/i))) {
      return { kind: "onTop", filter: IMX.parseFilter(m[1].replace(/\bmonsters?\b/ig, "monster")), text: part };
    }
    if (/^put the top card of your deck into (?:this card's|its) soul/i.test(part)) return { kind: "topSoul", n: 1 };
    if ((m = part.match(/^put (?:a |one )?(.+?) from your drop zone into (?:this card's|its) soul/i))) {
      return { kind: "soulFromDrop", n: 1, filter: IMX.parseFilter(m[1]), text: part };
    }
    if ((m = part.match(/^put (?:up to )?(\w+) impact monsters? from your hand or drop zone/i))) {
      return { kind: "soulImpacts", max: toNum(m[1]) || 3, optional: true, text: part };
    }
    if (/^when /i.test(part)) return { kind: "note", text: part };
    if ((m = part.match(/^discard (?:an? |one |two )?(.+?) from your hand$/i))) {
      const cnt = /^discard two/i.test(part) ? 2 : 1;
      return { kind: "discard", n: cnt, filter: IMX.parseFilter(m[1]), text: part };
    }
    // "<verb> <what> from/on your field ..."
    const verb = (p.match(/^(put|destroy|return)\b/) || [])[1];
    if (verb) {
      let dest = "toDrop";
      if (verb === "destroy") dest = "destroy";
      else if (verb === "return") dest = "toHand";
      else {
        const rule = DEST_RULES.find(r => r.re.test(part));
        if (rule) dest = rule.dest;
      }
      let what = part.replace(/^(put|destroy|return)\s+/i, "");
      let from = "field";
      if (/from your drop zone/i.test(what) && dest === "toSoul") from = "drop";
      what = what.replace(/\s*(from|on)\s+your\s+(field|drop zone).*$/i, "").replace(/\s*(into|to|on the bottom).*$/i, "");
      let n = 1;
      const cm = what.match(/^(?:up to )?(one or more|a|an|one|two|three|four|five|\d+)\b/i);
      if (cm) {
        const w = cm[1].toLowerCase();
        n = w === "one or more" ? 1 : toNum(w) || 1;
      }
      const different = /different/i.test(part);
      const f = IMX.parseFilter(what.replace(/^(?:up to )?(one or more|a|an|one|two|three|four|five|\d+)\s+/i, ""));
      if (!f.types.length && !/(card|character)s?\b/i.test(what) && f.tokens.length === 0 && f.attrs.length === 0 && f.names.length === 0) f.types.push("Monster");
      if (/monster or item|monster or/i.test(what)) f.types = ["Monster", "Item"];
      return { kind: dest, from, n, distinct: different, filter: f, text: part };
    }
    return { kind: "unsupported", text: part };
  }

  IMX.parseCall = function (card) {
    const raw = extractCallCostText(card);
    const call = { raw, gauge: 0, life: 0, parts: [], unsupported: [], reduced: null };
    if (!raw) return call;
    if (/^on top of this monster/i.test(raw)) { call.onlyByEffect = true; return call; }
    if (/^when an? .+? is destroyed,\s*nullify/i.test(raw)) call.onlyByEffect = true;   // Duel Sieger (#2013): only answers a destroyed monster (abilities_r41.js), never the Final Phase
    raw.split(/\s*&\s*|,\s+and\s+(?=put|destroy|return|pay)/i).forEach(seg => {
      if (!seg.trim()) return;
      const part = parseCostPart(seg);
      if (part.kind === "gauge") call.gauge += part.n;
      else if (part.kind === "life") call.life += part.n;
      else if (part.kind === "note") call.notes = (call.notes || []).concat(part.text);
      else if (part.kind === "unsupported") call.unsupported.push(part.text);
      else call.parts.push(part);
    });
    const red = clean(card.skill || "").match(/gauge cost of this card's \[Call Cost\] is reduced by (\d+) if you used \[(Overturn|Overkill|Overthrow)\]/i);
    if (red) call.reduced = { n: +red[1], ifUsedSpecial: true, kind: red[2].toLowerCase() };
    return call;
  };

  /* ---------- REQUIREMENTS ("You may only call this card if ...") ---------- */
  IMX.parseRequirements = function (card) {
    const reqs = [];
    clean(card.skill || "").split(/\n+/).forEach(line => {
      let m = line.match(/(?:you (?:may|can) only call this card|this card can only be called) (?:if|while) (.+?)\.?$/i);
      if (m) reqs.push(m[1].trim());
    });
    return reqs;
  };

  /* ---------- ABILITIES ---------- */
  const KEYWORD_LINE = /^(?:\[[^\]]+\]\s*)+$/;
  function splitSentences(body) {
    return body.split(/(?<=[.!])\s+(?=[A-Z"«\[(-])/).map(s => s.trim()).filter(Boolean);
  }

  IMX.parseAbilities = function (card) {
    const out = { abilities: [], keywords: [], impactTransform: null, unsupported: [] };
    const lines = clean(card.skill || "").split(/\n+/).map(l => l.trim()).filter(Boolean);
    let lastModal = null;
    lines.forEach(line => {
      if (/^\[Call Cost\]/i.test(line)) return;
      if (/^\(This card is regarded/i.test(line)) return;
      if (/^-\s+/.test(line) && lastModal) { lastModal.options.push(line.replace(/^-\s+/, "")); return; }
      let m;
      const kwTags = (line.match(/\[[^\]]+\]/g) || []).map(s => s.toLowerCase());
      if (/\[impact transform\]/i.test(line)) {
        const costM = line.match(/\[Impact Transform\]\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/i);
        out.impactTransform = { costText: costM ? costM[1] : "", cost: null };
        const cp = IMX.parseTransformCost(out.impactTransform.costText);
        out.impactTransform.cost = cp;
        line = line.replace(/\[Impact Transform\].*$/i, "").trim();
        if (!line) return;
      }
      if (KEYWORD_LINE.test(line)) { out.keywords.push(...kwTags); return; }
      const lead = line.match(/^((?:\[[^\]]+\]\s*)+)(.*)$/);
      let isCounter = false, isAct = false, text = line;
      if (lead && /\[act\]/i.test(lead[1])) { isAct = true; isCounter = /\[counter\]/i.test(lead[1]); text = lead[2]; out.keywords.push(...(lead[1].match(/\[[^\]]+\]/g) || []).filter(k => !/act|counter/i.test(k)).map(k => k.toLowerCase())); }
      else if (lead && lead[2] === "") { out.keywords.push(...kwTags); return; }
      text = text.replace(/^"[^"]+"\s*/, "").trim();
      const once = /(only (?:activates|use)[^.]*once per turn|once per turn)/i.test(text);
      const ab = { trigger: "misc", text: line, body: text, once, counter: isCounter };
      if (isAct) { ab.trigger = "act"; }
      else if ((m = text.match(/^When this card enters (?:the|your) field((?: from the drop zone)?)((?: by card effects)?)((?: or \[Impact Transform\])?)((?: during (?:the|your) final phase)?),?\s*(.*)$/i))) {
        ab.trigger = "enter"; ab.fromDrop = !!m[1].trim(); ab.byEffectOnly = !!m[2].trim(); ab.onTransform = !!m[3].trim(); ab.finalOnly = !!m[4].trim(); ab.body = m[5];
      } else if ((m = text.match(/^When this (?:card|monster) attacks and destroys [^,]+,\s*(.*)$/i))) { ab.trigger = "attackDestroy"; ab.body = m[1]; }
      else if ((m = text.match(/^When this (?:card|monster) is attacking alone,\s*(.*)$/i))) { ab.trigger = "attack"; ab.aloneOnly = true; ab.body = m[1]; }
      else if ((m = text.match(/^When this (?:card|monster) attacks(?: alone)?,\s*(.*)$/i))) { ab.trigger = "attack"; ab.body = m[1]; }
      else if ((m = text.match(/^At the end of (?:this card's battle|the battle (?:that|of) this card(?: attacked)?|the attack of this card|the battle that this card attacked),\s*(.*)$/i))) { ab.trigger = "battleEnd"; ab.body = m[1]; }
      else if ((m = text.match(/^At the end of (?:your |the )?turn,\s*(.*)$/i))) { ab.trigger = "turnEnd"; ab.body = m[1]; }
      else if ((m = text.match(/^When this card is destroyed,\s*(.*)$/i))) { ab.trigger = "destroyed"; ab.body = m[1]; }
      else if ((m = text.match(/^When this card deals damage to your opponent,\s*(.*)$/i))) { ab.trigger = "dealtDamage"; ab.body = m[1]; }
      else if ((m = text.match(/^When this card's attack is nullified,\s*(.*)$/i))) { ab.trigger = "nullified"; ab.body = m[1]; }
      else if (/^(?:If|While|For each|This card (?:gets|gains)|All |Items on your field|Abilities of this card|This card (?:cannot|can)|The damage dealt|You cannot|You can only|You may only call|This card on the field|\"Shadow Dive\")/i.test(text)) { ab.trigger = "passive"; }
      if (ab.trigger === "misc") out.unsupported.push(line);
      if (/^-\s/.test(line)) return;
      if (/choose and use one of the following/i.test(text)) { ab.options = []; lastModal = ab; } else lastModal = null;
      out.abilities.push(ab);
    });
    return out;
  };

  IMX.parseTransformCost = function (text) {
    const res = { gauge: 0, life: 0, parts: [], unsupported: [] };
    if (!text) return res;
    text.split(/\s*&\s*/).forEach(seg => {
      const s = seg.trim();
      if (!s) return;
      let m;
      if ((m = s.match(/^pay (\d+) gauge/i))) res.gauge += +m[1];
      else if ((m = s.match(/^pay (\d+) life/i))) res.life += +m[1];
      else if ((m = s.match(/^put (?:this card|it) on top of (?:an? |one )?(.+?) you are \[transform\] into/i))) res.parts.push({ kind: "onTopItem", filter: IMX.parseFilter(m[1]) });
      else if ((m = s.match(/^return (?:an? |one )?(.+?) you are \[transform\] into to your hand/i))) res.parts.push({ kind: "returnItem", filter: IMX.parseFilter(m[1]) });
      else if (/^put one of your equipped item into its soul/i.test(s)) res.parts.push({ kind: "itemToSoul", filter: IMX.parseFilter("") });
      else if (/^put a card you are \[transform\] into, into the drop zone/i.test(s)) res.parts.push({ kind: "itemToDrop", filter: IMX.parseFilter("") });
      else if (/^put a card from your drop zone into its soul/i.test(s)) res.parts.push({ kind: "soulFromDrop", n: 1, filter: IMX.parseFilter("") });
      else res.unsupported.push(s);
    });
    return res;
  };

  /* ---------- DATA BUILD ---------- */
  IMX.data = new Map();
  IMX.build = function (cards) {
    IMX.data.clear();
    (cards || []).forEach(c => {
      if (!IMX.isImpactMonster(c)) return;
      const call = IMX.parseCall(c);
      const ab = IMX.parseAbilities(c);
      IMX.data.set(c.id, {
        id: c.id, name: c.name, world: c.world, size: c.size, power: c.power, defense: c.defense, crit: c.crit,
        call, requirements: IMX.parseRequirements(c), abilities: ab.abilities, keywords: ab.keywords,
        impactTransform: ab.impactTransform, unsupported: ab.unsupported
      });
    });
    return IMX.data;
  };
  IMX.get = function (cardOrId) {
    const id = typeof cardOrId === "object" ? cardOrId.id : cardOrId;
    if (!IMX.data.size) IMX.build(allCards());
    return IMX.data.get(id) || null;
  };

  /* ---------- CONDITIONS (shared by call requirements, abilities and passives) ----------
   * ctx = { f: fighter, enemy: fighter, unit, card }.  Returns true / false / null (= could not understand). */
  function dropCount(list, f, distinct) {
    const cards = list.map(cid => getCard(cid)).filter(c => c && IMX.matchCard(c, f));
    return distinct ? new Set(cards.map(c => c.name)).size : cards.length;
  }
  IMX.cond = function (textRaw, ctx) {
    const text = clean(textRaw).replace(/\.$/, "");
    const t = text.toLowerCase();
    const f = ctx.f, enemy = ctx.enemy;
    let m;
    // "there are six or more cards in your opponent's drop zone" / "you have three or more different «X» in your drop zone"
    if ((m = text.match(/(?:there (?:is|are)|you have|your opponent has|you put)\s+(?:a total of\s+)?(\w+)\s+or\s+more\s+(.+?)\s+(?:in|from among)\s+(.*?drop zone)/i))) {
      const need = toNum(m[1]);
      const what = m[2];
      const owner = /opponent|his or her/i.test(m[3]) ? "enemy" : /either|each/i.test(m[3]) ? "both" : "me";
      if (/monsters? and .*spells?/i.test(what)) return null;
      const flt = IMX.parseFilter(what.replace(/^cards?$/i, ""));
      const dist = /different/i.test(what);
      const cnt = (fighter) => dropCount(fighter.drop, flt, dist);
      if (owner === "me") return cnt(f) >= need;
      if (owner === "enemy") return cnt(enemy) >= need;
      if (/each/i.test(m[3])) return cnt(f) >= need && cnt(enemy) >= need;
      return cnt(f) >= need || cnt(enemy) >= need;
    }
    if ((m = text.match(/(?:there (?:is|are)|you have)\s+(?:a total of\s+)?(\w+)\s+or\s+more\s+(.+?)\s+in\s+(?:this card's soul)/i))) {
      const flt = IMX.parseFilter(m[2]);
      const n = ((ctx.unit && ctx.unit.soul) || []).map(cid => getCard(cid)).filter(c => c && IMX.matchCard(c, flt)).length;
      return n >= toNum(m[1]);
    }
    if ((m = t.match(/your life is (\d+) or (less|greater)|you have (\d+) life or less/))) {
      if (m[3]) return f.life <= +m[3];
      return m[2] === "less" ? f.life <= +m[1] : f.life >= +m[1];
    }
    if (/your life is lower than your opponent's/.test(t)) return f.life < enemy.life;
    if ((m = t.match(/your life is (\d+)$/))) return f.life === +m[1];
    if ((m = t.match(/your opponent's life is (\d+) or less/))) return enemy.life <= +m[1];
    if (/you have no monsters on your field/.test(t)) return !["left", "center", "right"].some(p => f.monsters[p]);
    if (/your opponent has no monsters? (?:on|in) (?:the |his or her |their )?center|no monsters? (?:is|are) on (?:the )?center of your opponent/.test(t)) return !enemy.monsters.center;
    if (/no monsters are on your opponent's field|your opponent has no monsters/.test(t)) return !["left", "center", "right"].some(p => enemy.monsters[p]);
    if ((m = text.match(/you are equipped with (\w+) items/i))) return (f.item ? 1 : 0) >= toNum(m[1]); // only one item slot exists, so 2 items is never met
    if ((m = text.match(/you have (?:an? |one )?(?:«([^»]+)» )?item equipped/i))) {
      if (!f.item || !f.item.card) return false;
      return !m[1] || IMX.matchCard(f.item.card, IMX.parseFilter("«" + m[1] + "»"));
    }
    if ((m = text.match(/you have (?:a card|an item) equipped with "([^"]+)" in its card name/i))) {
      return !!(f.item && f.item.card && (f.item.card.name || "").toLowerCase().includes(m[1].toLowerCase()));
    }
    if (/you have an item with \[release condition!?\] equipped|you are equipped with a card with \[release condition\]/i.test(text)) {
      return !!(f.item && f.item.card && /release condition/i.test(f.item.card.skill || ""));
    }
    if (/you are \[transform\] into this card/i.test(text)) return !!(f.item && ctx.card && f.item.card.id === ctx.card.id);
    if (/you are \[(?:ride|transform)\]/i.test(text)) return !!(f.item && (f.item.card.tr || f.item.card.ride || f.item.isTransformed));
    if ((m = text.match(/there is another (?:«([^»]+)»|"([^"]+)") on your field/i)) || (m = text.match(/you have (?:a|another) (?:«([^»]+)»|card with "([^"]+)" in its card name) on your field/i))) {
      const flt = IMX.parseFilter(m[1] ? "«" + m[1] + "»" : '"' + m[2] + '"');
      return ["left", "center", "right"].some(p => f.monsters[p] && f.monsters[p] !== ctx.unit && IMX.matchCard(f.monsters[p].card, flt)) ||
        (f.item && IMX.matchCard(f.item.card, flt));
    }
    if (/no monsters are on your opponent's field/.test(t)) return !["left", "center", "right"].some(p => enemy.monsters[p]);
    if (/your buddy is an impact monster/.test(t)) return IMX.isImpactMonster(getCard(f.buddyId));
    return null;
  };

  /* ---------- passive stat text ("If ..., this card gets power+2000, defense+2000 and critical+1") ---------- */
  IMX.passives = function (card) {
    const list = [];
    clean(card.skill || "").split(/\n+/).forEach(line => {
      const l = line.trim();
      if (/^\[Call Cost\]|^\(This card is regarded/i.test(l)) return;
      if (/^\[Counter\]|^\[Act\]/i.test(l)) return;
      if (/^(?:When|At the )/i.test(l)) return;
      const m = l.match(/^(?:If (.+?), )?this card gets? ([^.!]*)/i);
      const forEach = l.match(/^(?:For each (.+?), this card gets ([^.!]*)|This card gets ([^.!]*?) for each (.+?)[.!]?$)/i);
      if (forEach) {
        const eff = forEach[2] || forEach[3];
        const unitText = (forEach[1] || forEach[4] || "").trim();
        list.push({ perEach: unitText, eff });
      } else if (m && /power\s*\+|defense\s*\+|critical\s*\+|\[(penetrate|double attack|triple attack|quadruple attack)\]/i.test(m[2])) {
        list.push({ cond: m[1] || null, eff: m[2] });
      }
    });
    return list;
  };

  IMX.coverage = function () {
    let units = 0, withUnsupportedCost = 0, withMisc = 0, transform = 0;
    const gaps = [];
    IMX.data.forEach(d => {
      units++;
      if (d.call.unsupported.length) { withUnsupportedCost++; gaps.push({ id: d.id, name: d.name, cost: d.call.unsupported }); }
      if (d.unsupported.length) withMisc++;
      if (d.impactTransform) transform++;
    });
    return { total: units, costNotFullyParsed: withUnsupportedCost, abilityLinesUnclassified: withMisc, impactTransform: transform, gaps };
  };

  root.IMX = IMX;
  if (typeof module !== "undefined" && module.exports) module.exports = IMX;
})(typeof window !== "undefined" ? window : globalThis);

/* ===================================================================================
 *  PART 2 — ENGINE (adds Impact Monster functions to `battle`)
 * =================================================================================== */
(function (root) {
  "use strict";
  const IMX = root.IMX;
  if (typeof battle === "undefined" || !IMX) return;
  const B = battle;

  const SLOTS = ["center", "left", "right"];
  const getCard = (id) => (typeof CARD_MAP !== "undefined" ? CARD_MAP.get(id) : undefined);
  const num = (w) => { const k = String(w).toLowerCase(); const m = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }; return k in m ? m[k] : parseInt(k, 10); };
  const sideOf = (fighter) => (fighter === B.plr ? "plr" : "opp");
  const otherSide = (side) => (side === "plr" ? "opp" : "plr");
  const cardName = (c) => (c ? c.name : "card");

  /* ---------- small helpers ---------- */
  Object.assign(B, {
    imNewUnit(side, card, soul) {
      const f = this.getFighter(side);
      const u = {
        card, rested: false, attacksLeft: card.atk_max || 1, soul: (soul || []).slice(),
        tempPower: 0, tempDef: 0, tempCrit: 0, actUsed: false, imUsed: {}, imTurn: this.turnCount
      };
      const eff = getUnitEffectiveCombatStats(f, u);
      u.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (card.atk_max || 1);
      return u;
    },

    /* Pick one entry. Bots (and forced single choices) decide automatically. entries: [{card, badge, payload}] */
    imChoose(side, title, subtitle, entries, cb) {
      if (!entries.length) { cb(null); return; }
      const f = this.getFighter(side);
      if (f.isBot || entries.length === 1 || side !== "plr") { cb(entries[0].payload); return; }
      this.openCustomCardChoiceModal({
        title, subtitle,
        cardsList: entries.map(e => ({ card: e.card, badge: e.badge, payload: e.payload })),
        onSelect: (p) => cb(p)
      });
    },

    imChooseMany(side, title, subtitle, entries, n, cb, picked = [], keyFn = null) {
      if (picked.length >= n || !entries.length) { cb(picked); return; }
      this.imChoose(side, `${title} (${picked.length + 1}/${n})`, subtitle, entries, (p) => {
        if (p === null || p === undefined) { cb(picked); return; }
        const chosen = entries.find(e => e.payload === p);
        const rest = entries.filter(e => e.payload !== p && (!keyFn || !chosen || keyFn(e) !== keyFn(chosen)));
        this.imChooseMany(side, title, subtitle, rest, n, cb, picked.concat([p]), keyFn);
      });
    },

    imFieldEntries(f, filter, exclude, includeItem) {
      const out = [];
      const soulOk = (u) => !filter.soulNames || !filter.soulNames.length || (u.soul || []).some(cid => { const c = getCard(cid); return c && filter.soulNames.some(n => (c.name || "").toLowerCase().includes(n)); });
      SLOTS.forEach(pos => {
        const u = f.monsters[pos];
        if (u && u !== exclude && IMX.matchCard(u.card, filter) && soulOk(u)) out.push({ card: u.card, badge: pos.toUpperCase(), payload: { zone: pos, unit: u } });
      });
      const withItem = includeItem || this.imNeedsItem(filter);
      if (withItem && f.item && !f.item.isEndrulerFlag && f.item !== exclude && IMX.matchCard(f.item.card, filter) && soulOk(f.item)) out.push({ card: f.item.card, badge: "ITEM", payload: { zone: "item", unit: f.item } });
      if (filter.altNames && filter.altNames.length && f.setSpells) {
        f.setSpells.forEach((c, i) => { if (IMX.matchCard(c, filter)) out.push({ card: c, badge: "SET", payload: { zone: "set", unit: { card: c, soul: [] }, idx: i } }); });
      }
      if (filter.characters && f.flagId) {
        const flag = getCard(f.flagId);
        if (flag && IMX.matchCard(flag, filter)) out.push({ card: flag, badge: "FLAG", payload: { zone: "flag", unit: { card: flag, soul: [] } } });
      }
      return out;
    },

    imNeedsItem(filter) { return !!(filter && ((filter.types && filter.types.includes("Item")) || filter.characters)); },

    /* ------------------------------------------------------------------
     *  CAN THIS IMPACT MONSTER BE CALLED?  (requirements + cost check, nothing is paid here)
     * ------------------------------------------------------------------ */
    imCallInfo(side, card, opts = {}) {
      const f = this.getFighter(side);
      const enemy = this.getEnemy(side);
      const d = IMX.get(card);
      const reasons = [];
      if (!d) return { ok: false, reasons: ["Not an Impact Monster"], data: null };
      if (!opts.byEffect) {
        if (!opts.ignorePhase && this.phase !== "final") reasons.push("Impact Monsters can only be called during your Final Phase");
        if (this.turnCount === 1) reasons.push("Impact cards can't be used on Turn 1");
        if (f.impactCalledThisTurn) reasons.push("You may only call one Impact Monster per turn");
        if (d.call.onlyByEffect) reasons.push("This card can only be called by another card's ability");
      }
      const ctx = { f, enemy, unit: null, card };
      if (!opts.byEffect) {
        d.requirements.forEach(r => {
          const res = IMX.cond(r, ctx);
          if (res === false) reasons.push(`Requirement not met: ${r}`);
        });
      }
      if (!opts.free) {
        let gauge = d.call.gauge;
        if (d.call.reduced && (f.overUsed ? f.overUsed[d.call.reduced.kind] : f.overturnUsed)) gauge = Math.max(0, gauge - d.call.reduced.n);
        if (f.gauge.length < gauge) reasons.push(`Needs ${gauge} Gauge (you have ${f.gauge.length})`);
        if (d.call.life > 0 && f.life <= d.call.life) reasons.push(`Needs more than ${d.call.life} Life`);
        d.call.parts.forEach(p => {
          if (p.kind === "topSoul") { if (!f.deck.length) reasons.push("Deck is empty (needs the top card for its soul)"); return; }
          if (p.kind === "soulImpacts") return;
          if (p.kind === "discard") {
            const n = f.hand.filter(cid => cid !== card.id || f.hand.filter(x => x === cid).length > 1).map(cid => CARD_MAP.get(cid)).filter(c => c && IMX.matchCard(c, p.filter)).length;
            if (n < p.n) reasons.push(`Needs to discard ${p.n} matching card(s): ${p.text}`);
            return;
          }
          if (p.kind === "soulFromDrop" || p.from === "drop") {
            const n = f.drop.map(cid => CARD_MAP.get(cid)).filter(c => c && IMX.matchCard(c, p.filter)).length;
            if (n < p.n) reasons.push(`Drop Zone needs ${p.n} matching card(s): ${p.text}`);
            return;
          }
          const entries = this.imFieldEntries(f, p.filter, null, this.imNeedsItem(p.filter));
          const need = p.kind === "onTop" ? 1 : p.n;
          const distinct = p.distinct ? new Set(entries.map(e => e.card.name)).size : entries.length;
          if (distinct < need) reasons.push(`Field needs ${need} matching card(s): ${p.text}`);
        });
      }
      // size / zone room (best case): some free zone or a removable monster must exist
      const newSize = getEffectiveCardSize(f, card);
      const maxSize = f.maxSize || 3;
      const used = this.getCurrentSizeUsed(f);
      const hasOnTop = d.call.parts.some(p => p.kind === "onTop");
      const removable = d.call.parts.some(p => ["destroy", "toDrop", "toGauge", "toSoul", "toHand", "toBottom"].includes(p.kind) && p.from !== "drop");
      if (!hasOnTop && !removable && !SLOTS.some(z => !f.monsters[z])) reasons.push("No free Monster Zone");
      if (!hasOnTop && !removable && used + newSize > maxSize) reasons.push(`Size ${newSize} would go over your size limit of ${maxSize}`);
      return { ok: reasons.length === 0, reasons, data: d };
    },

    /* ------------------------------------------------------------------
     *  GATHER cost choices  →  cb(choices | null)
     *  choices = { removes:[{part, zone, unit}], onTop:{zone,unit}, discards:[cid], soulDrop:[cid], soulImpacts:[{cid,from}] }
     * ------------------------------------------------------------------ */
    imGatherCost(side, card, d, cb) {
      const f = this.getFighter(side);
      const choices = { removes: [], onTop: null, discards: [], soulDrop: [], soulImpacts: [], topSoul: 0 };
      const picked = { fieldUnits: new Set(), handIdx: new Set() };
      const parts = d.call.parts.slice();
      const step = (i) => {
        if (i >= parts.length) { cb(choices); return; }
        const p = parts[i];
        const label = `${cardName(card)} — Call Cost`;
        if (p.kind === "topSoul") { choices.topSoul += 1; step(i + 1); return; }
        if (p.kind === "soulImpacts") {
          const pool = [];
          f.hand.forEach((cid, idx) => { const c = CARD_MAP.get(cid); if (c && cid !== card.id && IMX.isImpactMonster(c)) pool.push({ card: c, badge: "HAND", payload: { cid, from: "hand", idx } }); });
          f.drop.forEach((cid, idx) => { const c = CARD_MAP.get(cid); if (c && IMX.isImpactMonster(c)) pool.push({ card: c, badge: "DROP", payload: { cid, from: "drop", idx } }); });
          const seen = new Set(); const uniq = pool.filter(e => { if (seen.has(e.card.name)) return false; seen.add(e.card.name); return true; });
          this.imChooseMany(side, label, p.text, uniq, Math.min(p.max, uniq.length), (res) => { choices.soulImpacts.push(...res); step(i + 1); });
          return;
        }
        if (p.kind === "discard") {
          const pool = [];
          f.hand.forEach((cid, idx) => { const c = CARD_MAP.get(cid); if (c && IMX.matchCard(c, p.filter) && idx !== f.hand.indexOf(card.id)) pool.push({ card: c, badge: "DISCARD", payload: { cid, idx } }); });
          this.imChooseMany(side, label, p.text, pool.filter(e => !picked.handIdx.has(e.payload.idx)), p.n, (res) => {
            if (res.length < p.n) { cb(null); return; }
            res.forEach(r => { picked.handIdx.add(r.idx); choices.discards.push(r.cid); });
            step(i + 1);
          });
          return;
        }
        if (p.kind === "soulFromDrop" || p.from === "drop") {
          const pool = [];
          f.drop.forEach((cid, idx) => { const c = CARD_MAP.get(cid); if (c && IMX.matchCard(c, p.filter)) pool.push({ card: c, badge: "DROP", payload: { cid, idx } }); });
          this.imChooseMany(side, label, p.text, pool.slice().reverse(), p.n, (res) => {
            if (res.length < p.n) { cb(null); return; }
            res.forEach(r => choices.soulDrop.push(r));
            step(i + 1);
          });
          return;
        }
        // field-based parts
        const entries = this.imFieldEntries(f, p.filter, null, this.imNeedsItem(p.filter)).filter(e => !picked.fieldUnits.has(e.payload.unit));
        if (p.kind === "onTop") {
          this.imChoose(side, label, p.text, entries, (res) => {
            if (!res) { cb(null); return; }
            picked.fieldUnits.add(res.unit);
            choices.onTop = res;
            step(i + 1);
          });
          return;
        }
        const need = p.n;
        const keyFn = p.distinct ? (e) => e.card.name : null;
        this.imChooseMany(side, label, p.text, entries, need, (res) => {
          if (res.length < need) { cb(null); return; }
          res.forEach(r => { picked.fieldUnits.add(r.unit); choices.removes.push({ part: p, zone: r.zone, unit: r.unit }); });
          step(i + 1);
        }, [], keyFn);
      };
      step(0);
    },

    /* Remove the cost cards from the field. Returns { soul:[ids], freed:[zones] } */
    imApplyRemovals(side, choices, intoSoul) {
      const f = this.getFighter(side);
      const freed = [];
      choices.removes.forEach(r => {
        const u = r.unit;
        const kind = r.part.kind;
        if (r.zone === "flag") return; // your Flag counts as a character but never leaves the field
        if (r.zone === "set") {
          const i = f.setSpells.findIndex(c => c.id === u.card.id);
          if (i !== -1) { const [sp] = f.setSpells.splice(i, 1); f.drop.push(sp.id); }
          return;
        }
        if (r.zone === "item") {
          if (f.item === u) {
            if (u.soul && u.soul.length) f.drop.push(...u.soul);
            if (kind === "toHand") f.hand.push(u.card.id); else if (kind === "toGauge") f.gauge.push(u.card.id); else if (kind === "toSoul") intoSoul.push(u.card.id); else f.drop.push(u.card.id);
            f.item = null;
          }
          return;
        }
        if (f.monsters[r.zone] !== u) return;
        if (kind === "destroy") { this.destroyMonster(side, r.zone); }
        else if (kind === "toDrop") { this.sendMonsterToDropWithAnimation(side, r.zone, true); }
        else {
          if (u.soul && u.soul.length) f.drop.push(...u.soul);
          if (kind === "toGauge") f.gauge.push(u.card.id);
          else if (kind === "toHand") f.hand.push(u.card.id);
          else if (kind === "toBottom") f.deck.push(u.card.id);
          else if (kind === "toSoul") intoSoul.push(u.card.id);
          f.monsters[r.zone] = null;
        }
        freed.push(r.zone);
      });
      return freed;
    },

    /* ------------------------------------------------------------------
     *  CALL FROM HAND (normal call, pays the Call Cost)
     * ------------------------------------------------------------------ */
    startImpactMonsterCall(side, handIdx, opts = {}) {
      const f = this.getFighter(side);
      const cid = f.hand[handIdx];
      const card = CARD_MAP.get(cid);
      if (!card || !IMX.isImpactMonster(card)) return false;
      if (!opts.force && !this.isLocalTurn() && !f.isBot) return false;
      const info = this.imCallInfo(side, card, { ignorePhase: opts.force });
      if (!info.ok) {
        if (!f.isBot) alert(`Cannot call Impact Monster "${card.name}" yet:\n• ${info.reasons.join("\n• ")}`);
        return false;
      }
      const d = info.data;
      let result = false;
      this.imGatherCost(side, card, d, (choices) => {
        if (!choices) { if (!f.isBot) this.setPrompt("Impact Monster call cancelled (cost not paid)."); this.renderBattle(); return; }
        // re-find the card (the hand may have changed while the player was choosing)
        let hIdx = f.hand[handIdx] === cid ? handIdx : f.hand.indexOf(cid);
        if (hIdx === -1) { this.setPrompt("That card is no longer in your hand — call cancelled."); this.renderBattle(); return; }
        // choices for discard may have picked the very same hand slot as the monster; guard
        if (choices.discards.length) {
          const handCopy = f.hand.slice(); handCopy.splice(hIdx, 1);
          const tmp = handCopy.slice(); let okDisc = true;
          choices.discards.forEach(dc => { const i = tmp.indexOf(dc); if (i === -1) okDisc = false; else tmp.splice(i, 1); });
          if (!okDisc) { this.setPrompt("Not enough cards to discard — call cancelled."); this.renderBattle(); return; }
        }
        // size / zone validation BEFORE anything is paid
        const newSize = getEffectiveCardSize(f, card);
        let removedSize = 0;
        const removedUnits = new Set();
        choices.removes.forEach(r => { if (SLOTS.includes(r.zone) && !removedUnits.has(r.unit)) { removedUnits.add(r.unit); removedSize += getEffectiveCardSize(f, r.unit.card); } });
        if (choices.onTop && choices.onTop.zone !== "item") { removedSize += getEffectiveCardSize(f, choices.onTop.unit.card); }
        const maxSize = f.maxSize || 3;
        if (this.getCurrentSizeUsed(f) - removedSize + newSize > maxSize) {
          if (!f.isBot) alert(`Size ${newSize} would go over your size limit of ${maxSize}. Call cancelled — nothing was paid.`);
          this.renderBattle();
          return;
        }
        const freeNow = SLOTS.some(z => !f.monsters[z]);
        const freeAfter = removedUnits.size > 0 || !!choices.onTop;
        if (!freeNow && !freeAfter) { if (!f.isBot) alert("No free Monster Zone. Call cancelled — nothing was paid."); this.renderBattle(); return; }

        // ---- PAY ----
        let gaugeCost = d.call.gauge;
        if (d.call.reduced && (f.overUsed ? f.overUsed[d.call.reduced.kind] : f.overturnUsed)) gaugeCost = Math.max(0, gaugeCost - d.call.reduced.n);
        for (let i = 0; i < gaugeCost; i++) f.drop.push(f.gauge.pop());
        if (d.call.life > 0) f.life = Math.max(1, f.life - d.call.life);
        f.hand.splice(hIdx, 1);
        choices.discards.forEach(dc => { const i = f.hand.indexOf(dc); if (i !== -1) { f.hand.splice(i, 1); f.drop.push(dc); } });
        const intoSoul = [];
        for (let i = 0; i < choices.topSoul && f.deck.length; i++) intoSoul.push(f.deck.shift());
        choices.soulDrop.slice().sort((a, b) => b.idx - a.idx).forEach(r => { const i = f.drop.indexOf(r.cid); if (i !== -1) { f.drop.splice(i, 1); intoSoul.push(r.cid); } });
        choices.soulImpacts.forEach(r => {
          const arr = r.from === "hand" ? f.hand : f.drop;
          const i = arr.indexOf(r.cid); if (i !== -1) { arr.splice(i, 1); intoSoul.push(r.cid); }
        });
        const freedZones = this.imApplyRemovals(side, choices, intoSoul);
        let zone = null;
        if (choices.onTop) {
          const t = choices.onTop;
          if (t.zone === "item") { /* not allowed for monsters */ }
          else {
            zone = t.zone;
            const u = f.monsters[zone];
            if (u) { intoSoul.push(u.card.id); if (u.soul && u.soul.length) intoSoul.push(...u.soul); f.monsters[zone] = null; }
          }
        }
        if (!zone) zone = freedZones.find(z => !f.monsters[z]) || SLOTS.find(z => !f.monsters[z]);
        f.impactCalledThisTurn = true;
        result = this.imPlaceUnit(side, card, zone, intoSoul, { fromId: side === "plr" ? "bt-plr-hand" : "hud-opp-target", badge: "💥 IMPACT MONSTER CALL!" });
      });
      return result;
    },

    /* Put the unit on the field right away (so later checks see it), animate, then fire its "enters the field" abilities. */
    imPlaceUnit(side, card, zone, soul, opts = {}) {
      const f = this.getFighter(side);
      if (!zone || f.monsters[zone]) zone = SLOTS.find(z => !f.monsters[z]);
      if (!zone) return false;
      const unit = this.imNewUnit(side, card, soul);
      unit.imFromDrop = !!opts.fromDrop;
      unit.imByEffect = !!opts.byEffect;
      f.monsters[zone] = unit;
      this.pendingAction = null;
      const fire = () => {
        this.showCutin("IMPACT MONSTER!", `${card.name}`, card.img);
        this.renderBattle();
        this.imFireImpactMonsterEntered(side, unit);
        this.imRunAbilities("enter", side, unit, { fromDrop: !!opts.fromDrop, byEffect: !!opts.byEffect }, () => { this.renderBattle(); if (opts.onDone) opts.onDone(unit, zone); });
      };
      if (f.isBot || opts.noAnim) { this.renderBattle(); fire(); }
      else this.animateCardFlight(opts.fromId || "bt-plr-hand", `z-${side}-${zone}`, card.img, opts.badge || "💥 IMPACT MONSTER!", 0, fire);
      return zone;
    },

    /* "When an impact monster enters your field" listeners (e.g. critical+1 for this turn) */
    imFireImpactMonsterEntered(side, enteredUnit) {
      const f = this.getFighter(side);
      getAllFieldUnits(f).forEach(u => {
        if (u === enteredUnit || !IMX.isUnit(u)) return;
        const d = IMX.get(u.card);
        if (d && d.unsupported.some(l => /When an impact monster enters your field, for this turn, this card gets critical\+(\d+)/i.test(l))) {
          const m = u.card.skill.match(/When an impact monster enters your field, for this turn, this card gets critical\+(\d+)/i);
          u.tempCrit = (u.tempCrit || 0) + (m ? +m[1] : 1);
        }
      });
    },

    /* ------------------------------------------------------------------
     *  CALL BY ANOTHER CARD'S EFFECT / ITS OWN ABILITY (no cost, no once-per-turn limit)
     *  from: "hand" | "drop" | "deck";  idx = index inside that zone
     * ------------------------------------------------------------------ */
    imCallFromZone(side, from, idx, opts = {}, onDone = null) {
      const f = this.getFighter(side);
      const arr = from === "hand" ? f.hand : from === "drop" ? f.drop : f.deck;
      const cid = arr[idx];
      const card = CARD_MAP.get(cid);
      if (!card || !IMX.isImpactMonster(card)) return false;
      const newSize = getEffectiveCardSize(f, card);
      let zone = null, soul = [];
      if (opts.onTopOf && opts.onTopOf.unit) {
        const t = opts.onTopOf;
        const room = this.getCurrentSizeUsed(f) - getEffectiveCardSize(f, t.unit.card) + newSize <= (f.maxSize || 3);
        if (!room) { if (!f.isBot) alert(`Size ${newSize} is too big to call on top of "${t.unit.card.name}".`); return false; }
        zone = t.zone;
        soul = [t.unit.card.id].concat(t.unit.soul || []);
      } else {
        zone = SLOTS.find(z => !f.monsters[z]);
        if (!zone) { if (!f.isBot) alert(`All of your Monster Zones are full, so "${card.name}" can't be called.`); return false; }
        if (this.getCurrentSizeUsed(f) + newSize > (f.maxSize || 3)) { if (!f.isBot) alert(`Calling "${card.name}" would go over your size limit.`); return false; }
      }
      arr.splice(idx, 1);
      if (opts.onTopOf && opts.onTopOf.unit) f.monsters[zone] = null;
      if (from === "deck") this.shuffleFighterDeck(side);
      const fromId = from === "hand" ? (side === "plr" ? "bt-plr-hand" : "hud-opp-target") : `z-${side}-${from}`;
      return this.imPlaceUnit(side, card, zone, soul, { fromId, badge: "💥 CALLED BY ABILITY!", byEffect: true, fromDrop: from === "drop", onDone });
    },

    /* ------------------------------------------------------------------
     *  ABILITY INTERPRETER
     * ------------------------------------------------------------------ */
    imRunAbilities(trigger, side, unit, extra, done) {
      const d = unit && IMX.get(unit.card);
      if (!d) { if (done) done(); return; }
      const list = d.abilities.filter(a => a.trigger === trigger);
      let i = 0;
      const next = () => {
        if (i >= list.length || this.matchOver) { if (done) done(); return; }
        const ab = list[i++];
        if (ab.finalOnly && this.phase !== "final") { next(); return; }
        if (ab.byEffectOnly && !(unit.imByEffect || (extra && extra.transform))) { next(); return; }
        if (trigger === "enter" && extra && extra.transform && !ab.onTransform) { next(); return; }
        if (ab.aloneOnly && !(extra && extra.alone)) { next(); return; }
        if (ab.once && unit.imUsed && unit.imUsed["t:" + trigger + ":" + i]) { next(); return; }
        if (ab.once) { unit.imUsed = unit.imUsed || {}; unit.imUsed["t:" + trigger + ":" + i] = true; }
        const ctx = Object.assign({ side, unit, card: unit.card, f: this.getFighter(side), enemy: this.getEnemy(side), ab, counters: { destroyed: 0, returned: 0 }, lastOk: true }, extra || {});
        this.imRunBody(ab.body, ctx, next);
      };
      next();
    },

    imRunBody(body, ctx, done) {
      const sentences = this.imSplit(body);
      let i = 0;
      const next = () => {
        if (i >= sentences.length || this.matchOver) { this.checkWinCondition(); this.renderBattle(); if (done) done(); return; }
        this.imSentence(sentences[i++], ctx, next);
      };
      next();
    },

    imSplit(body) {
      return (body || "").split(/(?<=[.!])\s+(?=[A-Z"«\[(-])/).map(s => s.trim()).filter(Boolean);
    },

    imAsk(ctx, question) {
      if (ctx.f.isBot) return true;
      if (ctx.f !== this.plr) return true;
      return confirm(question);
    },

    imSentence(sentRaw, ctx, next) {
      let s = sentRaw.replace(/^Then,\s*/i, "").replace(/[!]+$/, "").trim();
      const f = ctx.f, enemy = ctx.enemy, side = ctx.side, eSide = otherSide(side);
      // "This ability only activates once per turn." / parentheses are notes
      if (/^\(|only activates once per turn|^you may only use/i.test(s)) { next(); return; }
      if (/^if you do,/i.test(s)) { if (!ctx.lastOk) { next(); return; } s = s.replace(/^if you do,\s*/i, ""); }
      if (/^if you (?:dropped|put|paid)\b/i.test(s) && /,/.test(s)) { if (!ctx.lastOk) { next(); return; } s = s.replace(/^if you \w+,\s*/i, ""); }
      // leading condition "If X, Y"
      let cm = s.match(/^(?:If|When) (.+?),\s+(.*)$/i);
      if (cm && !/^this card (?:attacks|enters|is destroyed)/i.test(cm[1])) {
        const res = IMX.cond(cm[1], ctx);
        if (res === null) { ctx.unsupported = (ctx.unsupported || []).concat(sentRaw); ctx.lastOk = false; next(); return; }
        if (!res) { ctx.lastOk = false; next(); return; }
        s = cm[2];
      }
      const may = /\byou may\b/i.test(s);
      s = s.replace(/\byou may\s+/i, "").replace(/\bYou may\s+/, "");
      const lc = s.toLowerCase();
      const finish = (ok = true) => { ctx.lastOk = ok; this.renderBattle(); next(); };
      const confirmOr = (question, run) => { if (may && !this.imAsk(ctx, `${cardName(ctx.card)}: ${question}?`)) { ctx.lastOk = false; next(); return; } run(); };
      const enemyMonsters = () => SLOTS.filter(p => enemy.monsters[p]);
      const destroyEnemyPos = (pos) => { if (enemy.monsters[pos]) { const gone = this.destroyMonster(eSide, pos); if (gone) ctx.counters.destroyed++; } };
      const destroyItem = (fighter) => { if (fighter.item && !fighter.item.isEndrulerFlag) { if (fighter.item.soul && fighter.item.soul.length) fighter.drop.push(...fighter.item.soul); fighter.drop.push(fighter.item.card.id); fighter.item = null; return true; } return false; };
      let m;

      /* ---------- destroy ---------- */
      if (/^destroy all other (?:cards|monsters) on the field/.test(lc)) {
        [ [side, f], [eSide, enemy] ].forEach(([sd, fighter]) => SLOTS.forEach(p => { if (fighter.monsters[p] && fighter.monsters[p] !== ctx.unit) { const g = this.destroyMonster(sd, p); if (g) ctx.counters.destroyed++; } }));
        if (/cards/.test(lc)) { if (destroyItem(f)) ctx.counters.destroyed++; if (destroyItem(enemy)) ctx.counters.destroyed++; }
        return finish();
      }
      if ((m = lc.match(/^destroy all size (\d+) or less monsters and items on your opponent's field/))) {
        enemyMonsters().forEach(p => { if (getEffectiveCardSize(enemy, enemy.monsters[p].card) <= +m[1]) destroyEnemyPos(p); });
        if (enemy.item && enemy.item.card.size !== null && enemy.item.card.size <= +m[1] && destroyItem(enemy)) ctx.counters.destroyed++;
        return finish();
      }
      if (/^destroy all (?:monsters|cards) on your opponent's field/.test(lc)) {
        enemyMonsters().forEach(destroyEnemyPos);
        if (/cards/.test(lc) && destroyItem(enemy)) ctx.counters.destroyed++;
        return finish();
      }
      if (/^destroy all items and spells on each fighters' field/.test(lc)) {
        [f, enemy].forEach(fighter => { if (destroyItem(fighter)) ctx.counters.destroyed++; if (fighter.setSpells && fighter.setSpells.length) { ctx.counters.destroyed += fighter.setSpells.length; fighter.drop.push(...fighter.setSpells.map(c => c.id)); fighter.setSpells = []; } });
        return finish();
      }
      if ((m = s.match(/^destroy (?:up to one |a |one |the chosen )?(?:(.*?)\s+)?(monster|card)s?(?: with ([\d]+) power or less)? (?:on|in) your opponent's (center|field)/i)) || (m = s.match(/^destroy (?:up to one |a |one )?(?:your opponent's )(monster|card)(?: in the center)?/i)) ) {
        const centerOnly = /center/i.test(s);
        const flt = IMX.parseFilter((m[1] && /size|power/.test(m[1]) ? m[1] : "") + " " + (/(\d+) power or less/i.test(s) ? s.match(/(\d+) power or less/i)[0] : ""));
        const pool = SLOTS.filter(p => enemy.monsters[p] && (!centerOnly || p === "center") && IMX.matchCard(enemy.monsters[p].card, flt))
          .map(p => ({ card: enemy.monsters[p].card, badge: p.toUpperCase(), payload: { zone: p } }));
        const wantsCard = /\bcard\b/.test(lc);
        if (wantsCard && enemy.item && !enemy.item.isEndrulerFlag) pool.push({ card: enemy.item.card, badge: "ITEM", payload: { zone: "item" } });
        if (/if your opponent does not have a monster in his or her center/.test(lc)) { /* handled below */ }
        return confirmOr("destroy a card on your opponent's field", () => {
          if (!pool.length) return finish(false);
          const sorted = f.isBot ? pool.slice().sort((a, b) => (b.card.power || 0) - (a.card.power || 0)) : pool;
          this.imChoose(side, `${cardName(ctx.card)} — destroy`, "Choose a card to destroy", sorted, (pick) => {
            if (!pick) return finish(false);
            if (pick.zone === "item") { if (destroyItem(enemy)) ctx.counters.destroyed++; } else destroyEnemyPos(pick.zone);
            finish(true);
          });
        });
      }
      if (/^destroy this card/.test(lc)) {
        const pos = SLOTS.find(p => f.monsters[p] === ctx.unit);
        if (pos) this.destroyMonster(side, pos);
        return finish();
      }
      if (/^return this card to your hand/.test(lc)) {
        return confirmOr("return this card to your hand", () => {
          const pos = SLOTS.find(p => f.monsters[p] === ctx.unit);
          if (pos) { if (ctx.unit.soul && ctx.unit.soul.length) f.drop.push(...ctx.unit.soul); f.hand.push(ctx.card.id); f.monsters[pos] = null; }
          finish(!!pos);
        });
      }
      if (/^put this card from your field into your drop zone/.test(lc)) {
        return confirmOr("put this card into your drop zone", () => {
          const pos = SLOTS.find(p => f.monsters[p] === ctx.unit);
          if (pos) this.sendMonsterToDropWithAnimation(side, pos, true);
          finish(!!pos);
        });
      }

      /* ---------- return to hand ---------- */
      if (/^return all (?:monsters|cards) (?:from|on) your opponent's field to his or her hand/.test(lc)) {
        enemyMonsters().forEach(p => { const u = enemy.monsters[p]; if (u.soul && u.soul.length) enemy.drop.push(...u.soul); enemy.hand.push(u.card.id); enemy.monsters[p] = null; ctx.counters.returned++; });
        if (/cards/.test(lc) && enemy.item && !enemy.item.isEndrulerFlag) { enemy.hand.push(enemy.item.card.id); enemy.item = null; ctx.counters.returned++; }
        return finish();
      }
      if (/^return (?:a|one|up to one) (?:card|monster) (?:from|on) your opponent's field to his or her hand/.test(lc)) {
        const pool = enemyMonsters().map(p => ({ card: enemy.monsters[p].card, badge: p.toUpperCase(), payload: { zone: p } }));
        if (!pool.length) return finish(false);
        return this.imChoose(side, `${cardName(ctx.card)} — return to hand`, "Choose a card", pool, (pick) => {
          if (pick) { const u = enemy.monsters[pick.zone]; if (u) { if (u.soul && u.soul.length) enemy.drop.push(...u.soul); enemy.hand.push(u.card.id); enemy.monsters[pick.zone] = null; ctx.counters.returned++; } }
          finish(!!pick);
        });
      }

      /* ---------- damage / life ---------- */
      if ((m = lc.match(/^deal (\d+) damage to your opponent/))) {
        enemy.life -= +m[1]; this.checkWinCondition(); return finish();
      }
      if (/^deal damage (?:to your opponent )?equal to the number (?:of cards )?(returned|destroyed|put)/.test(lc)) {
        const n = /return/.test(lc) ? ctx.counters.returned : ctx.counters.destroyed;
        enemy.life -= n; this.checkWinCondition(); return finish(n > 0);
      }
      if (/^deal 1 damage to your opponent for each/.test(lc)) { return finish(false); }
      if ((m = lc.match(/^you take (\d+) damage/))) { f.life -= +m[1]; this.checkWinCondition(); return finish(); }
      if ((m = lc.match(/^(?:you )?gain (\d+) life/))) { f.life += +m[1]; return finish(); }
      if (/^you gain life equal to the critical of this card/.test(lc)) { f.life += getUnitEffectiveCombatStats(f, ctx.unit).crit; return finish(); }
      if ((m = lc.match(/^your opponent's life becomes (\d+)/))) { enemy.life = Math.min(enemy.life, +m[1]); this.checkWinCondition(); return finish(); }
      if ((m = lc.match(/^your life becomes (\d+)/))) { f.life = +m[1]; return finish(); }

      /* ---------- draw / gauge / deck ---------- */
      if (/^both players draw a card/.test(lc)) { this.drawCardsWithAnimation("plr", 1); this.drawCardsWithAnimation("opp", 1); return finish(); }
      if ((m = lc.match(/^draw (a|one|two|three|\d+) cards?/))) { this.drawCardsWithAnimation(side, num(m[1]) || 1); return finish(); }
      if (/^both players put the top card of their decks into their gauge/.test(lc)) { this.chargeDeckToGaugeWithAnimation("plr", 1); this.chargeDeckToGaugeWithAnimation("opp", 1); return finish(); }
      if ((m = lc.match(/^put the top (?:(\w+) )?cards? of your deck into (?:your )?gauge/))) { this.chargeDeckToGaugeWithAnimation(side, m[1] ? num(m[1]) || 1 : 1); return finish(); }
      if ((m = lc.match(/^put (?:up to )?(?:the top )?(\w+) cards? (?:from the top of|of) (your opponent's|your) deck into (?:the|your) drop zone/)) || (m = lc.match(/^put the top (\w+) cards? of (your opponent's|your) deck into (?:the|your) drop zone/))) {
        const target = /opponent/.test(m[2]) ? enemy : f; const n = num(m[1]) || 1;
        const moved = target.deck.splice(0, n); target.drop.push(...moved); ctx.lastMilled = moved;
        this.checkWinCondition(); return finish(moved.length > 0);
      }
      if ((m = lc.match(/^(?:drop|put) (\d+|a|one) (?:of your opponent's gauge|cards? from your opponent's gauge)/)) || (m = lc.match(/^put a card from your opponent's gauge into his or her drop zone/))) {
        const n = m[1] ? (num(m[1]) || 1) : 1; for (let i = 0; i < n && enemy.gauge.length; i++) enemy.drop.push(enemy.gauge.pop()); return finish();
      }
      if (/^your opponent chooses a card from his or her hand and discards it|^your opponent chooses and (?:drops|discards) a hand card/.test(lc)) {
        if (enemy.hand.length) { const i = enemy.isBot || enemy !== this.plr ? Math.floor(Math.random() * enemy.hand.length) : 0; enemy.drop.push(enemy.hand.splice(i, 1)[0]); }
        return finish();
      }
      if (/^discard a card from your hand/.test(lc) || /^discard (?:a|one) card from your hand/.test(lc)) {
        return confirmOr("discard a card from your hand", () => { if (!f.hand.length) return finish(false); f.drop.push(f.hand.pop()); finish(true); });
      }

      /* ---------- drop zone → hand / soul ---------- */
      if ((m = s.match(/^put (?:up to )?(one|two|three|four|five|a|\d+) (.+?) from your drop zone into (your hand|this card's soul)/i))) {
        const n = num(m[1]) || 1; const flt = IMX.parseFilter(m[2]); const toSoul = /soul/i.test(m[3]);
        const pool = []; f.drop.forEach((cid, idx) => { const c = CARD_MAP.get(cid); if (c && IMX.matchCard(c, flt)) pool.push({ card: c, badge: "DROP", payload: cid }); });
        return confirmOr(`put ${m[2]} from your drop zone ${toSoul ? "into this card's soul" : "into your hand"}`, () => {
          const seen = new Set(); const uniq = pool.filter(e => { if (seen.has(e.payload)) return false; seen.add(e.payload); return true; });
          this.imChooseMany(side, `${cardName(ctx.card)}`, s, uniq.reverse(), n, (picks) => {
            picks.forEach(cid => { const i = f.drop.lastIndexOf(cid); if (i !== -1) { f.drop.splice(i, 1); if (toSoul) ctx.unit.soul.push(cid); else f.hand.push(cid); } });
            finish(picks.length > 0);
          });
        });
      }
      if (/^put up to one card from your drop zone into this card's soul/.test(lc)) {
        const pool = f.drop.map(cid => ({ card: CARD_MAP.get(cid), badge: "DROP", payload: cid })).filter(e => e.card);
        return this.imChoose(side, cardName(ctx.card), "Choose a card to put into this card's soul", pool.reverse(), (cid) => { if (cid !== null && cid !== undefined) { const i = f.drop.lastIndexOf(cid); f.drop.splice(i, 1); ctx.unit.soul.push(cid); } finish(cid !== null && cid !== undefined); });
      }

      /* ---------- self buffs (this turn) ---------- */
      if ((m = lc.match(/^(?:for this turn, )?this (?:card|monster) gets? (.*)$/))) {
        const eff = m[1]; const u = ctx.unit;
        const p = eff.match(/power\s*\+\s*(\d+)/); const dd = eff.match(/defense\s*\+\s*(\d+)/); const c = eff.match(/critical\s*\+\s*(\d+)/);
        if (p) u.tempPower = (u.tempPower || 0) + +p[1];
        if (dd) u.tempDef = (u.tempDef || 0) + +dd[1];
        if (c) u.tempCrit = (u.tempCrit || 0) + +c[1];
        this.imGrantKeywords(u, eff);
        return finish();
      }
      if ((m = lc.match(/^for this turn, this card gets (.*)$/))) { this.imGrantKeywords(ctx.unit, m[1]); return finish(); }
      if ((m = lc.match(/^for this turn, for each different impact monster in your drop zone this card gets critical\+(\d+)/))) {
        const names = new Set(f.drop.map(cid => CARD_MAP.get(cid)).filter(c => c && IMX.isImpactMonster(c)).map(c => c.name));
        ctx.unit.tempCrit = (ctx.unit.tempCrit || 0) + names.size * +m[1]; return finish();
      }
      if (/^\[stand\] this card/.test(lc)) { if (effectStand(ctx.unit)) { ctx.unit.attacksLeft = Math.max(1, (ctx.unit.attacksLeft || 0) + 1); ctx.unit.canAttackFinal = true; } return finish(); }
      if ((m = s.match(/^\[Stand\] (?:up to (\w+) |another |all |a |your |the )?(.+?) on your field(?:, and,? for this turn, (?:it|that card|those cards|all [^ ]+ [^ ]+ monsters) can attack during (?:the|your) final phase)?/i)) || (m = s.match(/^\[Stand\] (?:another |a )?(.+?) on your field/i))) {
        const flt = IMX.parseFilter((m[2] || m[1] || "").replace(/with .* in its attributes/, ""));
        const own = []; SLOTS.forEach(p => { const u = f.monsters[p]; if (u && u !== (/another/i.test(s) ? ctx.unit : null) && IMX.matchCard(u.card, flt)) own.push(u); });
        if (f.item && IMX.matchCard(f.item.card, flt)) own.push(f.item);
        const lim = m[1] && /^\w+$/.test(m[1]) && num(m[1]) ? num(m[1]) : 99;
        own.slice(0, lim).forEach(u => { if (!effectStand(u)) return; u.attacksLeft = Math.max(1, (u.attacksLeft || 0) + 1); if (/final phase/i.test(s + " " + sentRaw)) u.canAttackFinal = true; });
        return finish(own.length > 0);
      }

      /* ---------- call ---------- */
      if ((m = s.match(/^call (?:up to one |a |an )?(.+?) from your (hand|drop zone)(?: without paying its \[Call Cost\])?(?: on top of this monster)?/i))) {
        const flt = IMX.parseFilter(m[1]); const zone = /hand/i.test(m[2]) ? "hand" : "drop"; const arr = zone === "hand" ? f.hand : f.drop;
        const pool = []; arr.forEach((cid, idx) => { const c = CARD_MAP.get(cid); if (c && (c.type === "Monster" || IMX.isImpactMonster(c)) && IMX.matchCard(c, flt)) pool.push({ card: c, badge: zone.toUpperCase(), payload: cid }); });
        return confirmOr(`call ${m[1]} from your ${zone}`, () => {
          this.imChoose(side, `${cardName(ctx.card)} — call`, s, pool, (cid) => {
            if (cid === null || cid === undefined) return finish(false);
            const idx = arr.indexOf(cid); const c = CARD_MAP.get(cid);
            const onTop = /on top of this monster/i.test(s) ? { zone: SLOTS.find(p => f.monsters[p] === ctx.unit), unit: ctx.unit } : null;
            let ok;
            if (IMX.isImpactMonster(c)) ok = !!this.imCallFromZone(side, zone, idx, { onTopOf: onTop && onTop.zone ? onTop : null }, null);
            else ok = !!this.imCallPlainMonster(side, zone, idx);
            finish(ok);
          });
        });
      }

      // nothing matched: keep it visible instead of pretending it worked
      ctx.unsupported = (ctx.unsupported || []).concat(sentRaw);
      this.imNoteUnsupported(ctx.card, sentRaw);
      ctx.lastOk = false;
      next();
    },

    imNoteUnsupported(card, sentence) {
      this.imUnsupportedLog = this.imUnsupportedLog || [];
      this.imUnsupportedLog.push({ id: card.id, name: card.name, text: sentence });
      this.setPrompt(`⚠️ "${card.name}": part of its text is not automated yet — "${sentence.slice(0, 90)}${sentence.length > 90 ? "…" : ""}"`);
    },

    imGrantKeywords(u, text) {
      const t = (text || "").toLowerCase();
      if (/\[penetrate\]/.test(t)) u.tempPen = true;
      if (/\[double attack\]/.test(t) && !u._imDa) { u._imDa = true; if (effectStand(u)) u.attacksLeft = (u.attacksLeft || 0) + 1; }
      if (/\[triple attack\]/.test(t) && !u._imTa) { u._imTa = true; if (effectStand(u)) u.attacksLeft = (u.attacksLeft || 0) + 2; }
      if (/\[quadruple attack\]/.test(t) && !u._imQa) { u._imQa = true; if (effectStand(u)) u.attacksLeft = (u.attacksLeft || 0) + 3; }
      if (/counterattack/.test(t)) u.tempCA = true;
    },

    imCallPlainMonster(side, from, idx) {
      const f = this.getFighter(side);
      const arr = from === "hand" ? f.hand : f.drop;
      const cid = arr[idx]; const c = CARD_MAP.get(cid);
      if (!c) return false;
      const zone = SLOTS.find(z => !f.monsters[z]);
      if (!zone || this.getCurrentSizeUsed(f) + getEffectiveCardSize(f, c) > (f.maxSize || 3)) { if (!f.isBot) alert(`Can't call "${c.name}": no room (zones/size).`); return false; }
      arr.splice(idx, 1);
      f.monsters[zone] = this.imNewUnit(side, c, []);
      this.renderBattle();
      return true;
    }
  });

  /* ------------------------------------------------------------------
   *  BATTLE HOOKS
   * ------------------------------------------------------------------ */
  Object.assign(B, {
    imOnAttack(attSide, units, defSide, proceed) {
      const ims = units.filter(x => IMX.isUnit(x.unit));
      if (!ims.length) { proceed(); return; }
      const alone = units.length === 1;
      let i = 0;
      const next = () => {
        if (i >= ims.length || this.matchOver) { proceed(); return; }
        const u = ims[i++].unit;
        this.imRunAbilities("attack", attSide, u, { alone }, next);
      };
      next();
    },

    imAfterBattle(attSide, units, outcome) {
      const ims = units.filter(x => IMX.isUnit(x.unit));
      if (!ims.length) return;
      ims.forEach(({ unit }) => {
        if (outcome && outcome.destroyedMonster) this.imRunAbilities("attackDestroy", attSide, unit, {}, null);
        if (outcome && outcome.dealtDamage) this.imRunAbilities("dealtDamage", attSide, unit, {}, null);
        this.imRunAbilities("battleEnd", attSide, unit, {}, null);
      });
    },

    imOnNullified(attSide, units) {
      units.filter(x => IMX.isUnit(x.unit)).forEach(({ unit }) => this.imRunAbilities("nullified", attSide, unit, {}, null));
    },

    imOnDestroyedUnit(side, unit) {
      if (!IMX.isUnit(unit)) return;
      this.imRunAbilities("destroyed", side, unit, {}, null);
    },

    /* End of turn: abilities that say "At the end of your turn, ..." — otherwise impact monsters STAY on the field. */
    imTurnEnd(side) {
      const f = this.getFighter(side);
      SLOTS.forEach(p => { const u = f.monsters[p]; if (u && IMX.isUnit(u)) this.imRunAbilities("turnEnd", side, u, {}, null); });
      [this.plr, this.opp].forEach(fighter => getAllFieldUnits(fighter).forEach(u => { u.canAttackFinal = false; u._imDa = u._imTa = u._imQa = false; }));
    },

    imTurnStart(side) {
      [this.plr, this.opp].forEach(fighter => {
        fighter.impactCalledThisTurn = false;
        fighter.impactTransformedThisTurn = false;
        getAllFieldUnits(fighter).forEach(u => { u.imUsed = {}; u._imDa = u._imTa = u._imQa = false; u.canAttackFinal = false; });
      });
    },

    imCanAttackInFinal(unit) { return !!unit && (IMX.isUnit(unit) || unit.canAttackFinal || unit.permFinal) && unit.attacksLeft > 0 && !unit.rested; },

    /* ---------- [Act] ---------- */
    imActList(unit) {
      const d = unit && IMX.get(unit.card);
      if (!d) return [];
      return d.abilities.map((ab, idx) => ({ ab, idx })).filter(x => x.ab.trigger === "act");
    },

    imParseActCost(body) {
      const cost = { gauge: 0, life: 0, discard: null, soulDrop: 0, restOfBody: body, optional: false, timing: null };
      let b = body;
      let m;
      if ((m = b.match(/^During (?:your turn|your final phase|the attack phase and final phase|the final phase|each player's attack phase and final phase|your final phase),?\s*/i))) { cost.timing = m[0].toLowerCase(); b = b.slice(m[0].length); }
      if (/^When your opponent|^During the battle|^During the battle in which/i.test(b)) cost.timing = "reactive";
      const ifDo = b.split(/\bIf you do,\s*/i);
      const head = ifDo[0];
      cost.restOfBody = ifDo.length > 1 ? ifDo.slice(1).join("If you do, ") : b;
      cost.optional = /\byou may\b/i.test(head);
      if ((m = head.match(/pay (\d+) gauge/i))) cost.gauge = +m[1];
      if ((m = head.match(/pay (\d+) life/i))) cost.life = +m[1];
      if ((m = head.match(/discard (?:an? |one )?(.+?) from your hand/i))) cost.discard = IMX.parseFilter(m[1]);
      if ((m = head.match(/(?:put|drop) (a|one|two|three|four|five) souls? from this card(?: into your drop zone)?/i))) cost.soulDrop = num(m[1]);
      else if (/drop a soul from this card|put a soul from this card into your drop zone/i.test(head)) cost.soulDrop = 1;
      return cost;
    },

    imActStatus(side, unit, ab) {
      const f = this.getFighter(side);
      const enemy = this.getEnemy(side);
      const c = this.imParseActCost(ab.body);
      if (c.timing === "reactive") return { ok: false, reason: "Reactive [Counter] timing is not automated", cost: c };
      if (this.activeSide !== side) return { ok: false, reason: "Only on your own turn", cost: c };
      if (c.timing && /final phase/.test(c.timing) && !/attack phase/.test(c.timing) && this.phase !== "final") return { ok: false, reason: "Final Phase only", cost: c };
      if (ab.once && unit.imUsed && unit.imUsed["act:" + ab.text]) return { ok: false, reason: "Already used this turn", cost: c };
      const lead = ab.body.match(/^(?:During [^,]+,\s*)?If (.+?),\s*you may|^If (.+?),\s*(?:you|\[)/i);
      const condText = lead ? (lead[1] || lead[2]) : null;
      if (condText) { const r = IMX.cond(condText, { f, enemy, unit, card: unit.card }); if (r === false) return { ok: false, reason: `Needs: ${condText}`, cost: c }; }
      if (f.gauge.length < c.gauge) return { ok: false, reason: `Needs ${c.gauge} Gauge`, cost: c };
      if (c.life && f.life <= c.life) return { ok: false, reason: `Needs more than ${c.life} Life`, cost: c };
      if (c.discard && !f.hand.some(cid => IMX.matchCard(CARD_MAP.get(cid), c.discard))) return { ok: false, reason: "Needs a matching card in hand to discard", cost: c };
      if (c.soulDrop && (unit.soul || []).length < c.soulDrop) return { ok: false, reason: `Needs ${c.soulDrop} soul in this card`, cost: c };
      return { ok: true, reason: "", cost: c };
    },

    imUseAct(side, unit, ab) {
      const st = this.imActStatus(side, unit, ab);
      if (!st.ok) { alert(st.reason); return; }
      const f = this.getFighter(side);
      const c = st.cost;
      if (c.optional && !confirm(`Use [Act] of "${unit.card.name}"?`)) return;
      for (let i = 0; i < c.gauge; i++) f.drop.push(f.gauge.pop());
      if (c.life) f.life = Math.max(1, f.life - c.life);
      for (let i = 0; i < c.soulDrop && unit.soul.length; i++) f.drop.push(unit.soul.pop());
      const finishRun = () => {
        unit.imUsed = unit.imUsed || {}; if (ab.once) unit.imUsed["act:" + ab.text] = true;
        const ctx = { side, unit, card: unit.card, f, enemy: this.getEnemy(side), ab, counters: { destroyed: 0, returned: 0 }, lastOk: true };
        this.imRunBody(c.restOfBody, ctx, () => { this.setPrompt(`✨ Used [Act] of "${unit.card.name}"`); this.renderBattle(); });
      };
      if (c.discard) {
        const pool = []; f.hand.forEach((cid, idx) => { const cc = CARD_MAP.get(cid); if (cc && IMX.matchCard(cc, c.discard)) pool.push({ card: cc, badge: "DISCARD", payload: idx }); });
        this.imChoose(side, `${unit.card.name} — discard`, "Choose a card to discard", pool, (idx) => { if (idx !== null && idx !== undefined) f.drop.push(f.hand.splice(idx, 1)[0]); finishRun(); });
      } else finishRun();
    },

    imAppendActButtons(actionsEl, side, unit) {
      this.imActList(unit).forEach(({ ab }) => {
        const st = this.imActStatus(side, unit, ab);
        const b = document.createElement("button");
        b.className = "action-btn";
        b.disabled = !st.ok;
        const short = ab.body.replace(/\s+/g, " ").slice(0, 70);
        b.textContent = st.ok ? `✨ [Act] ${short}…` : `🔒 [Act] ${st.reason}`;
        b.title = ab.text;
        b.onclick = () => { this.closeCardBanner(); this.imUseAct(side, unit, ab); };
        actionsEl.appendChild(b);
      });
    },

    /* ---------- IMPACT TRANSFORM (equip an impact monster from hand in the Final Phase) ---------- */
    imTransformInfo(side, card) {
      const f = this.getFighter(side);
      const d = IMX.get(card);
      const reasons = [];
      if (!d || !d.impactTransform) return { ok: false, reasons: ["No [Impact Transform]"], d };
      if (this.phase !== "final") reasons.push("Final Phase only");
      if (this.turnCount === 1) reasons.push("Impact cards can't be used on Turn 1");
      if (f.impactTransformedThisTurn) reasons.push("Once per turn");
      if (f.item && f.item.isEndrulerFlag) reasons.push("Your Flag/Item slot is held by the Endruler Flag");
      const cost = d.impactTransform.cost;
      if (f.gauge.length < cost.gauge) reasons.push(`Needs ${cost.gauge} Gauge`);
      if (cost.life && f.life <= cost.life) reasons.push(`Needs more than ${cost.life} Life`);
      cost.parts.forEach(p => {
        if (["onTopItem", "returnItem"].includes(p.kind)) {
          if (!f.item || !IMX.matchCard(f.item.card, p.filter)) reasons.push("You are not [Transform]ed into the required card");
        } else if (p.kind === "itemToSoul" || p.kind === "itemToDrop") { if (!f.item) reasons.push("You have no equipped item"); }
        else if (p.kind === "soulFromDrop") { if (!f.drop.length) reasons.push("Drop Zone is empty"); }
      });
      return { ok: reasons.length === 0, reasons, d };
    },

    imStartTransform(side, handIdx) {
      const f = this.getFighter(side);
      const cid = f.hand[handIdx]; const card = CARD_MAP.get(cid);
      const info = this.imTransformInfo(side, card);
      if (!info.ok) { if (!f.isBot) alert(`Cannot [Impact Transform] "${card.name}":\n• ${info.reasons.join("\n• ")}`); return false; }
      const cost = info.d.impactTransform.cost;
      for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
      if (cost.life) f.life = Math.max(1, f.life - cost.life);
      f.hand.splice(handIdx, 1);
      const soul = [];
      const old = f.item;
      let keepOld = false;
      cost.parts.forEach(p => {
        if (p.kind === "onTopItem" && old) { soul.push(old.card.id, ...(old.soul || [])); keepOld = true; }
        else if (p.kind === "itemToSoul" && old) { soul.push(old.card.id, ...(old.soul || [])); keepOld = true; }
        else if (p.kind === "returnItem" && old) { f.hand.push(old.card.id); if (old.soul && old.soul.length) f.drop.push(...old.soul); keepOld = true; }
        else if (p.kind === "itemToDrop" && old) { f.drop.push(old.card.id); if (old.soul && old.soul.length) f.drop.push(...old.soul); keepOld = true; }
        else if (p.kind === "soulFromDrop" && f.drop.length) soul.push(f.drop.pop());
      });
      if (old && !keepOld) { f.drop.push(old.card.id); if (old.soul && old.soul.length) f.drop.push(...old.soul); }
      f.item = { card, rested: false, attacksLeft: card.atk_max || 1, soul, isTransformed: true, canAttackFinal: true, imUsed: {}, tempPower: 0, tempDef: 0, tempCrit: 0 };
      const eff = getUnitEffectiveCombatStats(f, f.item);
      f.item.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (card.atk_max || 1);
      f.impactTransformedThisTurn = true;
      this.showCutin("IMPACT TRANSFORM!", card.name, card.img);
      this.setPrompt(`💥 [Impact Transform] "${card.name}" — it can attack during the Final Phase!`);
      this.renderBattle();
      this.imRunAbilities("enter", side, f.item, { transform: true }, () => this.renderBattle());
      return true;
    },

    /* ---------- BOT: call an impact monster in its Final Phase. Returns the zone it landed in (or null). ---------- */
    imBotCall(bot) {
      if (this.turnCount === 1 || bot.impactCalledThisTurn) return null;
      const side = sideOf(bot);
      for (let h = 0; h < bot.hand.length; h++) {
        const card = CARD_MAP.get(bot.hand[h]);
        if (!card || !IMX.isImpactMonster(card)) continue;
        const info = this.imCallInfo(side, card, { ignorePhase: true });
        if (!info.ok) continue;
        const before = SLOTS.map(z => bot.monsters[z]);
        const ok = this.startImpactMonsterCall(side, h, { force: true });
        const zone = SLOTS.find(z => bot.monsters[z] && bot.monsters[z].card.id === card.id && !before.includes(bot.monsters[z]));
        if (zone) return zone;
        if (ok) return null;
      }
      return null;
    }
  });

  /* ---------- passive combat stats for Impact Monster units ---------- */
  root.imCombatStats = function (fighter, unit) {
    const c = unit.card;
    const enemy = fighter === battle.plr ? battle.opp : battle.plr;
    let power = (c.power !== null && c.power !== undefined ? c.power : 0) + (unit.tempPower || 0);
    let defense = (c.defense !== null && c.defense !== undefined ? c.defense : 0) + (unit.tempDef || 0);
    let crit = (c.crit !== null && c.crit !== undefined ? c.crit : 1) + (unit.tempCrit || 0);
    let pen = Boolean(c.pen || unit.tempPen), da = Boolean(c.da), ta = Boolean(c.ta), qa = Boolean(c.qa);
    const ctx = { f: fighter, enemy, unit, card: c };
    const apply = (eff, times) => {
      const p = eff.match(/power\s*\+\s*(\d+)/i), d = eff.match(/defense\s*\+\s*(\d+)/i), k = eff.match(/critical\s*\+\s*(\d+)/i);
      if (p) power += +p[1] * times; if (d) defense += +d[1] * times; if (k) crit += +k[1] * times;
      if (/\[penetrate\]/i.test(eff)) pen = true;
      if (/\[double attack\]/i.test(eff)) da = true;
      if (/\[triple attack\]/i.test(eff)) ta = true;
      if (/\[quadruple attack\]/i.test(eff)) qa = true;
    };
    IMX.passives(c).forEach(ps => {
      if (ps.perEach) {
        const t = ps.perEach.toLowerCase();
        let n = 0;
        if (/item on the field/.test(t)) n = (fighter.item ? 1 : 0) + (enemy.item ? 1 : 0);
        else if (/card in its soul/.test(t)) n = (unit.soul || []).length;
        else return;
        apply(ps.eff, n);
        return;
      }
      if (ps.cond) {
        const parts = ps.cond.split(/,\s*(?:then,\s*)?/);
        const r = IMX.cond(ps.cond, ctx);
        if (r !== true) return;
      }
      apply(ps.eff, 1);
    });
    if (unit.defenseZeroTurn) defense = 0;
    return { power: Math.max(0, power), defense: Math.max(0, defense), crit: Math.max(0, crit), pen, da, ta, qa };
  };
})(typeof window !== "undefined" ? window : globalThis);
