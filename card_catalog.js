/* ==================== CARD CATALOG (OOP) ====================
 * Object-oriented card database indexed by ability keyword. Pure JS, no DOM; runs in browser and Node.
 * Needs window.BUDDYFIGHT_CARDS (cards_data.js) and ABX (abilities_parser.js).
 *
 *   const db = CardCatalog.fromGlobals();           // builds + indexes every card once
 *   db.find({ any: ["nullifies attack"] })           // -> CardEntry[]
 *   db.find({ all: ["counter", "check deck"], type: "Spell", world: "Dragon World" })
 *   db.get(6).keywords                               // -> ["destroy", "boost", ...]
 *   db.keywordCounts()                               // -> [{keyword, category, count}] biggest first
 *
 * Classes: KeywordDef (one taxonomy entry) / KeywordRegistry (the taxonomy) / Ability (one skill line)
 *          / CardEntry (one card) / CardCatalog (index + queries).
 * Add a new keyword by adding ONE line to KeywordRegistry.DEFAULTS (by parser op, by text regex, or by trigger).
 */
(function (root) {
  "use strict";

  /* ---------- KeywordDef: one searchable ability keyword ---------- */
  class KeywordDef {
    // by: { ops:[parser op names], text:RegExp tested on the raw ability line, trigger:[event names], tag:[ability tags] }
    constructor(id, category, by) {
      this.id = id;
      this.category = category;
      this.ops = new Set(by.ops || []);
      this.text = by.text || null;
      this.trigger = new Set(by.trigger || []);
      this.tag = new Set(by.tag || []);
    }
    matches(ability) {
      if (ability.tags.some(t => this.tag.has(t))) return true;
      if (ability.trigger && this.trigger.has(ability.trigger)) return true;
      if (ability.ops.some(o => this.ops.has(o))) return true;
      return !!(this.text && this.text.test(ability.raw));
    }
  }

  /* ---------- KeywordRegistry: the taxonomy ---------- */
  class KeywordRegistry {
    constructor(defs) {
      this.defs = new Map();
      (defs || KeywordRegistry.DEFAULTS).forEach(d => this.add(d));
    }
    add(def) { this.defs.set(def.id, def instanceof KeywordDef ? def : new KeywordDef(def[0], def[1], def[2])); return this; }
    has(id) { return this.defs.has(id); }
    list() { return [...this.defs.values()]; }
    categories() { return [...new Set(this.list().map(d => d.category))]; }
    ofCategory(cat) { return this.list().filter(d => d.category === cat).map(d => d.id); }
    classify(ability) { return this.list().filter(d => d.matches(ability)).map(d => d.id); }
  }
  // [id, category, by]
  KeywordRegistry.DEFAULTS = [
    // --- Negation ---
    ["nullifies attack",    "Negation", { ops: ["nullifyAttack"] }],
    ["nullifies abilities", "Negation", { ops: ["nullifyAbilities"] }],
    ["nullifies cast",      "Negation", { ops: ["nullifyCast"] }],
    ["nullifies keyword",   "Negation", { ops: ["nullifyKeyword"] }],
    ["no counter",          "Negation", { ops: ["noCounter"] }],
    ["restrict",            "Negation", { ops: ["restrict"], text: /\bcannot \[(?:move|stand|rest)\]/i }],
    // --- Defense ---
    ["counter",             "Defense",  { tag: ["counter"], text: /^\s*\[counter\]/i }],
    ["soulguard",           "Defense",  { text: /\bsoulguard\b/i }],
    ["redirect attack",     "Defense",  { ops: ["redirectAttack"] }],
    ["shield",              "Defense",  { ops: ["shield", "minShield"], text: /damage is reduced by/i }],
    ["prevent leave",       "Defense",  { ops: ["preventLeave"] }],
    ["save once",           "Defense",  { ops: ["saveOnce"] }],
    // --- Deck ---
    ["check deck",          "Deck",     { ops: ["look", "lookPick"], text: /\b(look at|check) the top\b|\bcheck (?:your|the) (?:opponent's )?deck\b/i }],
    ["search deck",         "Deck",     { ops: ["search"] }],
    ["reveal",              "Deck",     { ops: ["reveal"] }],
    ["mill",                "Deck",     { ops: ["mill"] }],
    ["shuffle",             "Deck",     { ops: ["shuffle"] }],
    ["stack on top",        "Deck",     { ops: ["stackOnTop"] }],
    // --- Hand ---
    ["draw",                "Hand",     { ops: ["draw", "drawUntil"] }],
    ["discard",             "Hand",     { ops: ["discard"] }],
    ["opponent discards",   "Hand",     { ops: ["oppDiscard"] }],
    // --- Life / Gauge / Soul ---
    ["life change",         "Life",     { ops: ["life", "setLife"] }],
    ["damage",              "Life",     { ops: ["damage"] }],
    ["pay cost",            "Life",     { ops: ["pay"] }],
    ["drop soul",           "Life",     { ops: ["dropSoul"] }],
    // --- Board ---
    ["call",                "Board",    { ops: ["call"] }],
    ["destroy",             "Board",    { ops: ["destroy"], text: /\bdestroy (?:a|an|all|up to|one|two)\b/i }],
    ["move",                "Board",    { ops: ["move", "moveSelf", "moveZone"], text: /^move a\b|to the open (?:left|right)/i }],
    ["stand",               "Board",    { ops: ["stand"] }],
    ["rest",                "Board",    { ops: ["rest", "restSelf"] }],
    ["set size 0",          "Board",    { ops: ["setSize0"] }],
    // --- Combat ---
    ["boost",               "Combat",   { ops: ["boost"] }],
    ["extra phase",         "Combat",   { ops: ["extraPhase"] }],
    ["end phase/turn",      "Combat",   { ops: ["endPhase", "endTurn", "endBattle"] }],
    ["penetrate",           "Combat",   { text: /\bpenetrate\b/i }],
    ["double attack",       "Combat",   { text: /\bdouble attack\b/i }],
    ["triple attack",       "Combat",   { text: /\btriple attack\b/i }],
    ["lifelink",            "Combat",   { text: /\blifelink\b/i }],
    ["counterattack",       "Combat",   { text: /\bcounterattack\b/i }],
    // --- Keyword abilities ---
    ["act",                 "Keyword",  { tag: ["act"] }],
    ["transform",           "Keyword",  { text: /\b(impact )?transform\b/i }],
    ["ambush",              "Keyword",  { text: /\bambush\b/i }],
    ["overturn/overkill",   "Keyword",  { text: /\b(overturn|overkill|overthrow)\b/i }],
    ["shadow dive",         "Keyword",  { text: /\bshadow dive\b/i }],
    ["reversal",            "Keyword",  { text: /\breversal\b/i }],
    ["rock-paper-scissors", "Keyword",  { ops: ["rps"], text: /rock-paper-scissors/i }],
    // --- Timing (trigger) ---
    ["on enter",            "Timing",   { trigger: ["enter", "otherEnter"] }],
    ["on attack",           "Timing",   { trigger: ["attack", "otherAttack", "oppAttack", "attacked"], text: /when you are being attacked/i }],
    ["on leave/destroyed",  "Timing",   { trigger: ["leave", "otherDestroyed", "attackDestroys"] }],
    ["on damage",           "Timing",   { trigger: ["dealsDamage", "damaged", "lifeGain"] }],
    ["on cast",             "Timing",   { trigger: ["youCast", "oppCast"] }],
    ["phase start/end",     "Timing",   { trigger: ["phaseStart", "phaseEnd", "turnEnd", "battleEnd"] }],
    // --- Rules / static ---
    ["deck rule",           "Rule",     { text: /\bin your deck\b|\byour deck (?:can|may)\b|\bcards? in your deck\b/i }],
    ["cost reduce",         "Rule",     { ops: ["freeCost"], text: /without paying (?:its|their) \[|cost\]? (?:of [^.]*)?is reduced|reduce[sd]? [^.]*cost/i }],
    ["call condition",      "Rule",     { text: /\bmay only (?:be )?call|\bcan only be called|only be called to|this card can only enter/i }],
    ["call restriction",    "Rule",     { text: /\bcannot call\b|\bcan't call\b|\bcannot be called\b/i }],
    ["attack rule",         "Rule",     { text: /\bcan attack with this card\b|\bcannot (?:link )?attack\b|\bcan(?:not)? attack (?:even|from|while)/i }],
    ["cannot be destroyed", "Rule",     { text: /cannot be (?:destroyed|affected|returned|chosen|rested)|\bis unaffected by\b/i }],
    ["stays on field (set)","Rule",     { text: /\[set\]|remains on the field/i }],
    ["mission",             "Rule",     { text: /mission card|\bmission\b/i }],
    ["cast condition",      "Rule",     { text: /\bmay only (?:cast|equip)\b|\bonly be cast\b|\bmay (?:cast|equip) this card without/i }],
    ["once per turn",       "Rule",     { text: /\bonce per turn\b|\bonly activates once\b/i }],
    ["flag",                "Rule",     { text: /^you may use (?:<|cards?|monsters?|card with|«)|initial hand becomes|initial gauge/i }],
    ["ride",                "Keyword",  { text: /\[ride\]/i }],
    ["d-share / dragod",    "Keyword",  { text: /\[d-share\]|\[dragod\]|double buddy|\[evil deity\]|release condition/i }],
    ["on destroyed by effect","Timing", { text: /destroyed (?:by|due to) (?:an? |the )?(?:monster |card )?effect|destroyed by (?:an |the )?effect/i }],
    ["on put into drop",    "Timing",   { text: /\b(?:put|dropped) (?:in)?to (?:your |the |his or her )?drop zone|\bdropped from your hand|put from (?:your )?(?:field|deck) into/i }],
    ["on destroys",         "Timing",   { text: /attacks and destroys|destroyed by an attack|attack destroys|is destroyed\b|\bdestoryed\b/i }],
    ["on enter (text)","Timing",{ text: /enters? the field|is put on the field|enters your field/i }],
    ["on battle end",       "Timing",   { text: /at the end of (?:this card's|the) battle/i }],
    ["on attack nullified", "Timing",   { text: /attack[^.]{0,30}is nullified|cannot be nullified/i }],
    ["on opponent draws/damaged","Timing",{ text: /opponent (?:draws|is dealt damage)|deal[st]? damage to your opponent|cannot draw/i }],
    ["on rest/discard/deck","Timing",   { text: /\[rest\]|is discarded|bottom of the deck|returned from the drop zone|opponent's deck into/i }],
    ["on call named",       "Timing",   { text: /when you (?:call|use) a|when another monster with|when a «[^»]+» on your field/i }],
    ["named-card synergy",  "Rule",     { text: /"[^"]+" in its card name|with "[^"]+" in its|«[^»]+»|effect of "[^"]+"/i }],
    ["size / stat change",  "Combat",   { text: /\bsize of this card\b|\bgets critical\b|\bgets power[+-]|attacks all of|change the target|damage dealt to you[^.]*reduced|\bfor this turn, all\b/i }],
    ["no ability (flavor)", "Rule",     { text: /^\s*(?:no ability text|thank you|you've become|\(.*\)\s*$)/i }],
    ["link attack",         "Combat",   { text: /\blink attack/i }],
    ["gauge charge",        "Life",     { text: /into (?:your |the )?gauge/i }],
    ["soul",                "Life",     { text: /\bsoul\b/i }],
    ["return to hand",      "Board",    { text: /return[^.]{0,50}to (?:its owner's |your |the )?hand|returned to your deck or hand/i }],
    ["vanilla (cost only)", "Rule",     {}]   // card-level: set in CardEntry when every ability is just a cost
  ].map(a => new KeywordDef(a[0], a[1], a[2]));

  /* ---------- Ability: one parsed skill line + its keywords ---------- */
  class Ability {
    constructor(parsed, registry) {
      this.raw = parsed.raw || "";
      this.kind = parsed.kind;
      this.name = parsed.name || null;
      this.tags = parsed.tags || [];
      this.trigger = parsed.trigger ? parsed.trigger.event : null;
      this.ops = (parsed.steps || []).map(s => s.op).concat((parsed.options || []).flatMap(o => (o.steps || []).map(s => s.op)));
      this.unparsed = parsed.unparsed || [];
      this.keywords = registry.classify(this);
    }
    get automated() { return this.unparsed.length === 0; }
    has(keyword) { return this.keywords.includes(keyword); }
  }

  /* ---------- CardEntry: one card, its abilities, merged keywords ---------- */
  class CardEntry {
    constructor(card, abilities, registry) {
      this.card = card;
      this.abilities = abilities;
      const set = new Set();
      abilities.forEach(a => a.keywords.forEach(k => set.add(k)));
      // printed keyword list / flags on the card record itself (Counter, Soulguard, Double Attack, ...)
      (card.kw || []).forEach(k => { const id = String(k).toLowerCase(); if (registry.has(id)) set.add(id); });
      if (card.pen && registry.has("penetrate")) set.add("penetrate");
      if (card.da && registry.has("double attack")) set.add("double attack");
      if (card.ta && registry.has("triple attack")) set.add("triple attack");
      if (card.ll && registry.has("lifelink")) set.add("lifelink");
      if (card.ca && registry.has("counterattack")) set.add("counterattack");
      if (registry.has("vanilla (cost only)") && card.skill && abilities.length && abilities.every(a => a.kind === "cost" || /^\s*\[(?:call|cast|equip) cost\]/i.test(a.raw))) set.add("vanilla (cost only)");
      if (!set.size && card.skill && registry.has("no ability (flavor)") && !abilities.some(a => a.raw && !/^\s*\(/.test(a.raw))) set.add("no ability (flavor)");
      this.keywordSet = set;
    }
    get id() { return this.card.id; }
    get name() { return this.card.name; }
    get type() { return this.card.type; }
    get world() { return this.card.world; }
    get keywords() { return [...this.keywordSet]; }
    get unparsedCount() { return this.abilities.reduce((n, a) => n + a.unparsed.length, 0); }
    hasKeyword(k) { return this.keywordSet.has(k); }
    abilitiesWith(k) { return this.abilities.filter(a => a.has(k)); }
  }

  /* ---------- CardCatalog: index + queries ---------- */
  class CardCatalog {
    constructor(cards, abx, registry) {
      this.registry = registry || new KeywordRegistry();
      this.entries = new Map();
      this.index = new Map(); // keyword -> Set<card id>
      this.registry.list().forEach(d => this.index.set(d.id, new Set()));
      (cards || []).forEach(c => this.add(c, abx));
    }
    static fromGlobals(registry) {
      const g = typeof window !== "undefined" ? window : globalThis;
      return new CardCatalog(g.BUDDYFIGHT_CARDS, g.ABX, registry);
    }
    add(card, abx) {
      const parsed = card.skill && abx ? abx.parseCard(card) : { abilities: [] };
      const abilities = parsed.abilities.filter(a => a.kind !== "reminder").map(a => new Ability(a, this.registry));
      const entry = new CardEntry(card, abilities, this.registry);
      this.entries.set(card.id, entry);
      entry.keywordSet.forEach(k => { if (!this.index.has(k)) this.index.set(k, new Set()); this.index.get(k).add(card.id); });
      return entry;
    }
    get(id) { return this.entries.get(id) || null; }
    get size() { return this.entries.size; }

    // opts: { all:[kw], any:[kw], none:[kw], type, world, name(substring), limit }
    find(opts) {
      const o = opts || {};
      const norm = (a) => (a || []).map(k => String(k).toLowerCase());
      const all = norm(o.all), any = norm(o.any), none = norm(o.none);
      let ids = null;
      const meet = (s) => { ids = ids === null ? new Set(s) : new Set([...ids].filter(i => s.has(i))); };
      all.forEach(k => meet(this.index.get(k) || new Set()));
      if (any.length) { const u = new Set(); any.forEach(k => (this.index.get(k) || []).forEach(i => u.add(i))); meet(u); }
      let out = (ids === null ? [...this.entries.values()] : [...ids].map(i => this.entries.get(i)));
      if (none.length) out = out.filter(e => !none.some(k => e.hasKeyword(k)));
      if (o.type) out = out.filter(e => e.type === o.type);
      if (o.world) out = out.filter(e => e.card.worlds && e.card.worlds.includes(o.world));
      if (o.name) { const n = String(o.name).toLowerCase(); out = out.filter(e => (e.name || "").toLowerCase().includes(n)); }
      return o.limit ? out.slice(0, o.limit) : out;
    }
    keywordCounts() {
      return [...this.index.entries()]
        .map(([keyword, s]) => ({ keyword, category: (this.registry.defs.get(keyword) || {}).category || "Printed", count: s.size }))
        .sort((a, b) => b.count - a.count);
    }
    byCategory(cat) { return this.find({ any: this.registry.ofCategory(cat) }); }
    // cards with skill text but no keyword at all -> candidates for new taxonomy entries
    uncategorized() { return [...this.entries.values()].filter(e => e.card.skill && e.keywordSet.size === 0); }
  }

  const api = { KeywordDef, KeywordRegistry, Ability, CardEntry, CardCatalog };
  root.CardCatalog = CardCatalog;
  root.CardCatalogClasses = api;
  if (typeof module !== "undefined" && module.exports) module.exports = Object.assign(CardCatalog, api);
})(typeof window !== "undefined" ? window : globalThis);
