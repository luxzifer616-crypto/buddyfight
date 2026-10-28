// Headless harness: loads the REAL game scripts (cards_data.js, game.js, impact_monsters.js, abilities_*.js)
// into a Node vm context with a stub DOM, so card abilities can be run against real battle state.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");

function makeStub(name) {
  const handler = {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => "";
      if (p === "then") return undefined;
      if (p === "length") return 0;
      if (["firstChild", "lastChild", "parentNode", "parentElement", "nextSibling", "previousSibling", "firstElementChild", "lastElementChild", "nextElementSibling", "offsetParent"].includes(p)) return null;
      if (["value", "textContent", "innerHTML", "innerText", "src", "className", "id", "title", "placeholder", "href"].includes(p)) return t["__" + String(p)] ?? "";
      if (p === "checked" || p === "disabled" || p === "hidden") return t["__" + String(p)] ?? false;
      if (p === "classList") return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (p === "style") return t.__style || (t.__style = {});
      if (p === "dataset") return {};
      if (p === "children" || p === "childNodes") return [];
      if (p === "getBoundingClientRect") return () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 });
      if (p in t) return t[p];
      return makeStub(String(p));
    },
    set(t, p, v) { t["__" + String(p)] = v; return true; },
    apply() { return makeStub("call"); },
    construct() { return makeStub("new"); },
  };
  return new Proxy(function () {}, handler);
}

function createEnv(opts = {}) {
  const timers = [];
  const doc = makeStub("document");
  const overrides = {
    getElementById: (id) => (id === "fx-layer" ? null : makeStub(id)),
    querySelector: () => makeStub("qs"),
    querySelectorAll: () => [],
    createElement: () => makeStub("el"),
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
  const files = opts.files || ["cards_data.js", "game.js", "impact_monsters.js", "abilities_parser.js", "abilities_ui.js", "abilities_engine.js", "abilities_ops.js", "abilities_more.js", "abilities_r9.js", "abilities_r10.js", "abilities_gkw.js", "abilities_r13.js", "abilities_r14.js", "abilities_r15.js", "abilities_r16.js"];
  files.forEach((f) => { if (fs.existsSync(path.join(ROOT, f))) load(f); });
  // flush timers (animations etc.) so everything resolves synchronously
  const flush = (max = 5000) => { let n = 0; while (timers.length && n++ < max) { const t = timers.shift(); try { t.fn(); } catch (e) { sandbox.__timerErrors = (sandbox.__timerErrors || []); sandbox.__timerErrors.push(String(e && e.stack || e)); } } };
  const run = (code) => vm.runInContext(code, ctx);
  return { ctx, sandbox, run, flush, load, timers };
}

module.exports = { createEnv, makeStub, ROOT };
