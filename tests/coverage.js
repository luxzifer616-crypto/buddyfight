// Real coverage: loads the full engine (all ability rounds, like the game does) and counts which card abilities run.
//   node tests/coverage.js [--top N] [--csv out.csv] [--json out.json]
// An ability "works" when ABX.isExecutable says the engine can run it; cost / keyword / reminder lines are not counted.
const fs = require("fs");
const { createEnv } = require("./headless.js");
const env = createEnv();
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const topN = +opt("--top", 40);

const res = JSON.parse(env.run(`(function(){
  const SKIP = new Set(["cost", "keyword", "reminder"]);
  const out = [];
  ALL_CARDS.forEach(c => {
    if (!c.skill || !c.skill.trim()) return;
    const p = ABX.get(c); if (!p) return;
    const abs = p.abilities.filter(a => !SKIP.has(a.kind));
    if (!abs.length) return;
    // rule lines ("You may only cast this card if ...") are checked by game.js when they aren't run by ABX
    const isOK = (a) => ABX.isExecutable(a) || (a.kind === "rule" && (!a.unparsed || !a.unparsed.length) && a.parsed !== false) || (ABX.ownsStaticLine && ABX.ownsStaticLine(c, a.raw || ""));
    const bad = abs.filter(a => !isOK(a));
    const unread = [];
    bad.forEach(a => { (a.unparsed && a.unparsed.length ? a.unparsed : [a.cleaned || a.raw || ""]).forEach(u => unread.push(String(u && (u.text || u.raw) || u))); });
    out.push({ id: c.id, name: c.name, type: c.type, world: c.world || c.flag || "", total: abs.length, ok: abs.length - bad.length, unread });
  });
  return JSON.stringify(out);
})()`));

const full = res.filter(r => r.ok === r.total), none = res.filter(r => r.ok === 0), part = res.filter(r => r.ok > 0 && r.ok < r.total);
const lines = res.reduce((s, r) => s + r.total, 0), okLines = res.reduce((s, r) => s + r.ok, 0);
console.log(`cards with abilities: ${res.length} | fully working: ${full.length} (${(full.length / res.length * 100).toFixed(1)}%) | partly: ${part.length} | none: ${none.length}`);
console.log(`abilities: ${lines} | working: ${okLines} (${(okLines / lines * 100).toFixed(1)}%)`);

const shape = (t) => String(t).toLowerCase().replace(/«[^»]*»/g, "«X»").replace(/"[^"]*"/g, '"N"').replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/g, "N").replace(/\s+/g, " ").replace(/[.!]+$/, "").trim();
const g = new Map();
res.forEach(r => r.unread.forEach(u => { const k = shape(u).slice(0, 150); const e = g.get(k) || { ids: new Set(), ex: u }; e.ids.add(r.id); g.set(k, e); }));
const arr = [...g.entries()].sort((a, b) => b[1].ids.size - a[1].ids.size);
console.log(`unread sentence shapes: ${arr.length} | on 2+ cards: ${arr.filter(x => x[1].ids.size > 1).length}`);
arr.slice(0, topN).forEach(([k, v]) => console.log(String(v.ids.size).padStart(4), [...v.ids][0], "|", String(v.ex).replace(/\s+/g, " ").slice(0, 160)));

const csv = opt("--csv");
if (csv) {
  const esc = (v) => { v = String(v ?? ""); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = [["id", "name", "type", "world", "status", "abilities", "working", "first_unread_sentence"]];
  [...none, ...part].sort((a, b) => a.id - b.id).forEach(r => rows.push([r.id, r.name, r.type, r.world, r.ok === 0 ? "NOT BUILT" : "PARTLY BUILT", r.total, r.ok, String(r.unread[0] || "").replace(/\s+/g, " ").slice(0, 200)]));
  fs.writeFileSync(csv, rows.map(r => r.map(esc).join(",")).join("\n"));
  console.log("wrote", csv);
}
const js = opt("--json");
if (js) fs.writeFileSync(js, JSON.stringify({ cards: res.length, full: full.length, part: part.length, none: none.length, lines, okLines }));
