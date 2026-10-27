// Coverage audit: parses every card with ABX and reports what is / is not understood.
//   node tests/abx_audit.js [--json out.json] [--top N] [--show-unparsed]
const path = require("path");
global.window = {};
require(path.join(__dirname, "..", "cards_data.js"));
const ABX = require(path.join(__dirname, "..", "abilities_parser.js"));
const CARDS = window.BUDDYFIGHT_CARDS;
const args = process.argv.slice(2);
const topN = +(args[args.indexOf("--top") + 1] || 40);

const tmpl = (l) => ABX.normalize(l)
  .replace(/"[^"]*"/g, '"N"').replace(/«[^»]*»/g, "«T»").replace(/<[^>]*>/g, "<W>")
  .replace(/\b\d[\d,]*\b/g, "#").replace(/\b(a|an|one|two|three|four|five|six|seven|eight)\b (?=card|monster|item|spell|life|damage|gauge)/g, "# ")
  .replace(/\s+/g, " ").trim();

let cardsWithAbility = 0, cardsFull = 0, cardsPartial = 0, cardsNone = 0;
let lines = 0, full = 0, partial = 0, none = 0;
const unparsed = new Map();
const kindCount = {};
const perCard = [];
CARDS.forEach(c => {
  if (!c.skill || !c.skill.trim()) return;
  const r = ABX.parseCard(c);
  r.abilities.forEach(a => { kindCount[a.kind] = (kindCount[a.kind] || 0) + 1;
    (a.unparsed || []).forEach(u => { const k = tmpl(u); const e = unparsed.get(k) || { n: 0, ex: c.id, txt: u }; e.n++; unparsed.set(k, e); });
    (a.options || []).forEach(o => (o.unparsed || []).forEach(u => { const k = tmpl(u); const e = unparsed.get(k) || { n: 0, ex: c.id, txt: u }; e.n++; unparsed.set(k, e); }));
  });
  const s = r.stats;
  if (s.lines === 0) return;        // keyword/cost-only card
  cardsWithAbility++;
  lines += s.lines; full += s.full; partial += s.partial; none += s.none;
  if (s.full === s.lines) cardsFull++; else if (s.full + s.partial === 0) cardsNone++; else cardsPartial++;
  perCard.push({ id: c.id, name: c.name, type: c.type, ...s });
});
console.log("ability kinds:", kindCount);
console.log(`cards with abilities: ${cardsWithAbility}   fully parsed: ${cardsFull} (${(cardsFull / cardsWithAbility * 100).toFixed(1)}%)   partly: ${cardsPartial}   none: ${cardsNone}`);
console.log(`ability lines: ${lines}   full: ${full} (${(full / lines * 100).toFixed(1)}%)   partial: ${partial}   none: ${none}`);
const arr = [...unparsed.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`unique unparsed sentence templates: ${arr.length}`);
if (args.includes("--show-unparsed") || true) {
  console.log("\nTOP UNPARSED SENTENCES:");
  arr.slice(0, topN).forEach(([k, v]) => console.log(String(v.n).padStart(4), v.ex, "|", v.txt.slice(0, 170)));
}
const ji = args.indexOf("--json");
if (ji >= 0) require("fs").writeFileSync(args[ji + 1], JSON.stringify({ cardsWithAbility, cardsFull, lines, full, partial, none, perCard }, null, 1));
