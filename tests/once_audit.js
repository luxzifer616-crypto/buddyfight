// Use-limit audit: every ability whose text says "once per turn / fight / game" must carry the matching limit,
// so it can't be used more often than the card allows.  node tests/once_audit.js [--list]
const path = require("path");
global.window = {};
require(path.join(__dirname, "..", "cards_data.js"));
const ABX = require(path.join(__dirname, "..", "abilities_parser.js"));
const CARDS = window.BUDDYFIGHT_CARDS;
const LIMIT = /\bonce per (turn|fight|game)\b|\bonly once\b|\bonce during\b/i;
const want = (t) => { const m = t.match(/once per (turn|fight|game)/i); return m ? (m[1].toLowerCase() === "turn" ? "turn" : "game") : null; };

let checked = 0;
const missing = [], wrong = [];
CARDS.forEach(c => {
  if (!c.skill) return;
  ABX.parseCard(c).abilities.forEach(a => {
    const raw = String(a.raw || "");
    if (!LIMIT.test(raw)) return;
    // "You may only call/cast X once per turn" on the card itself is a deck-wide rule, handled separately.
    if (a.oncePerTurnNamed) return;
    checked++;
    const w = want(raw);
    if (!a.once) missing.push({ id: c.id, name: c.name, w, raw: raw.slice(0, 160) });
    else if (w && a.once !== w) wrong.push({ id: c.id, name: c.name, w, got: a.once, raw: raw.slice(0, 160) });
  });
});
console.log(`abilities with a use limit: ${checked} | limit missing: ${missing.length} | wrong limit: ${wrong.length}`);
if (process.argv.includes("--list")) {
  wrong.forEach(x => console.log("WRONG", x.id, x.name, `want ${x.w} got ${x.got} |`, x.raw));
  missing.forEach(x => console.log("MISSING", x.id, x.name, `want ${x.w} |`, x.raw));
}
process.exit(wrong.length ? 1 : 0);
