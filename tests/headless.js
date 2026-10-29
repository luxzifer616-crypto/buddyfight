// Headless harness: loads the REAL game scripts (cards_data.js, game.js, impact_monsters.js, abilities_*.js)
// into a Node vm context with a stub DOM, so card abilities can be run against real battle state.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");

function makeStub(name) {
  const target = function () {};
  target.__children = [];
  const handler = {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => "";
      if (p === "then") return undefined;
      if (p === "length") return (t.__children || []).length;
      if (["firstChild", "lastChild", "parentNode", "parentElement", "nextSibling", "previousSibling", "firstElementChild", "lastElementChild", "nextElementSibling", "offsetParent"].includes(p)) return null;
      if (["value", "textContent", "innerHTML", "innerText", "src", "className", "id", "title", "placeholder", "href"].includes(p)) return t["__" + String(p)] ?? "";
      if (p === "checked" || p === "disabled" || p === "hidden") return t["__" + String(p)] ?? false;
      if (p === "classList") return t.__classList || (t.__classList = {
        _set: new Set(),
        add(... names) { names.forEach(n => this._set.add(n)); },
        remove(...names) { names.forEach(n => this._set.delete(n)); },
        toggle(n, force) { if (force === undefined ? !this._set.has(n) : force) { this._set.add(n); return true; } this._set.delete(n); return false; },
        contains(n) { return this._set.has(n); }
      });
      if (p === "style") return t.__style || (t.__style = { setProperty() {}, removeProperty() {} });
      if (p === "dataset") return t.__dataset || (t.__dataset = {});
      if (p === "children" || p === "childNodes") return t.__children || [];
      if (p === "appendChild") return (child) => { (t.__children = t.__children || []).push(child); return child; };
      if (p === "replaceChildren") return (...kids) => {
        const flat = [];
        kids.forEach(k => {
          if (k && Array.isArray(k.__children) && k.__isFrag) flat.push(...k.__children);
          else if (k) flat.push(k);
        });
        t.__children = flat;
      };
      if (p === "remove") return () => {};
      if (p === "getBoundingClientRect") return () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 });
      if ("__" + String(p) in t) return t["__" + String(p)];
      if (p in t) return t[p];
      return makeStub(String(p));
    },
    set(t, p, v) {
      t["__" + String(p)] = v;
      if (p === "innerHTML" && v === "") t.__children = [];
      return true;
    },
    apply() { return makeStub("call"); },
    construct() { return makeStub("new"); },
  };
  return new Proxy(target, handler);
}

function createEnv(opts = {}) {
  const timers = [];
  const doc = makeStub("document");
  const elCache = new Map();
  const overrides = {
    getElementById: (id) => {
      if (id === "fx-layer") return null;
      if (!elCache.has(id)) elCache.set(id, makeStub(id));
      return elCache.get(id);
    },
    querySelector: () => makeStub("qs"),
    querySelectorAll: () => [],
    createElement: (tag) => makeStub(tag || "el"),
    createDocumentFragment: () => { const f = makeStub("frag"); f.__isFrag = true; return f; },
    addEventListener: () => {},
    body: makeStub("body"),
  };
  const document = new Proxy(doc, { get: (t, p) => (p in overrides ? overrides[p] : t[p]) });
  const store = {};
  const sandbox = {
    console, document, window: null, navigator: { clipboard: {}, userAgent: "node", language: "en" },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    alert: (m) => { (sandbox.__alerts = sandbox.__alerts || []).push(String(m)); },
    confirm: () => true, prompt: () => "",
    requestAnimationFrame: (fn) => { fn(); return 0; },
    setTimeout: (fn, ms) => { timers.push({ fn, ms: ms || 0 }); return timers.length; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    Promise, Math, JSON, Date, Map, Set, Array, Object, String, Number, RegExp, Error, Symbol, parseInt, parseFloat, isNaN,
    Peer: function () {}, URL, URLSearchParams, Intl, encodeURIComponent, decodeURIComponent,
    BF_UI_ZOOM: 1, innerWidth: 1400, innerHeight: 900,
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }), getComputedStyle: () => ({}), scrollTo() {}, open() {}, history: { pushState() {}, replaceState() {} }, location: { href: "http://localhost/", search: "", hash: "", host: "localhost", protocol: "http:" },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const load = (file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  const files = opts.files || ["cards_data.js", "game.js", "impact_monsters.js", "abilities_parser.js", "abilities_ui.js", "abilities_engine.js", "abilities_ops.js", "abilities_more.js", "abilities_r9.js", "abilities_r10.js", "abilities_gkw.js", "abilities_r13.js", "abilities_r14.js", "abilities_r15.js", "abilities_r16.js", "abilities_r17.js", "abilities_r18.js", "abilities_r19.js", "abilities_r20.js", "abilities_r21.js", "abilities_r22.js", "abilities_r23.js", "abilities_r24.js", "abilities_r25.js", "abilities_r26.js", "abilities_r27.js", "abilities_r28.js", "abilities_r29.js", "abilities_r30.js", "abilities_r31.js", "abilities_r32.js", "abilities_r33.js", "abilities_r34.js", "abilities_r35.js", "abilities_r36.js", "abilities_r37.js", "abilities_r38.js", "abilities_r39.js", "abilities_r40.js"];
  files.forEach((f) => { if (fs.existsSync(path.join(ROOT, f))) load(f); });
  // flush timers (animations etc.) so everything resolves synchronously
  const flush = (max = 5000) => { let n = 0; while (timers.length && n++ < max) { const t = timers.shift(); try { t.fn(); } catch (e) { sandbox.__timerErrors = (sandbox.__timerErrors || []); sandbox.__timerErrors.push(String(e && e.stack || e)); } } };
  const run = (code) => vm.runInContext(code, ctx);
  return { ctx, sandbox, run, flush, load, timers };
}

module.exports = { createEnv, makeStub, ROOT };
