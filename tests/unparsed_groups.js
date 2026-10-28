// Groups the unread (unparsed) ability text by shape, most common first.
// node tests/unparsed_groups.js [outfile.json]
const { createEnv } = require("./headless.js");
const fs = require("fs");
const env = createEnv();
const rows = env.run(`(function(){ const out=[]; ALL_CARDS.forEach(c=>{ (ABX.get(c).abilities||[]).forEach((a,i)=>{ if(!a.unparsed||!a.unparsed.length) return; a.unparsed.forEach(u=>out.push({id:c.id,i,kind:a.kind,frag:typeof u==='string'?u:(u.text||u.raw||JSON.stringify(u)),raw:(a.cleaned||a.raw||'').slice(0,300)})); }); }); return out; })()`);
const shape = (t) => String(t).toLowerCase()
  .replace(/«[^»]*»/g, "«X»").replace(/"[^"]*"/g, '"N"').replace(/\[[^\]]*\]/g, m => /\[(penetrate|double attack|triple attack|soulguard|counterattack|move|stand|rest|counter|act|transform|set|call cost|cast cost|equip cost)\]/.test(m) ? m : "[K]")
  .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/g, "N").replace(/\s+/g, " ").trim();
const g = new Map();
rows.forEach(r => { const k = shape(r.frag); if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
const groups = [...g.entries()].map(([k, v]) => ({ shape: k, n: v.length, cards: [...new Set(v.map(x => x.id))], ex: v[0].frag, raw: v[0].raw })).sort((a, b) => b.n - a.n);
console.log("unread fragments:", rows.length, "| abilities:", new Set(rows.map(r => r.id + ":" + r.i)).size, "| shapes:", groups.length, "| shapes seen 2+:", groups.filter(x => x.n > 1).length, "covering", groups.filter(x => x.n > 1).reduce((a, x) => a + x.n, 0));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ rows, groups }, null, 1));
groups.slice(0, +(process.argv[3] || 60)).forEach(x => console.log(String(x.n).padStart(3), "|", x.shape.slice(0, 150)));
