// Abilities that ran before round 13 but not after (regressions from the rewrites), and parse changes in ones that ran.
const { createEnv } = require("./headless.js");
const base = ["cards_data.js", "game.js", "impact_monsters.js", "abilities_parser.js", "abilities_ui.js", "abilities_engine.js", "abilities_ops.js", "abilities_more.js", "abilities_r9.js", "abilities_r10.js", "abilities_gkw.js"];
const q = `(function(){ const out={}; ALL_CARDS.forEach(c=>{ (ABX.get(c).abilities||[]).forEach(a=>{ if(!ABX.isExecutable(a)) return; const k=c.id+'|'+ABX.norm(a.raw||'').slice(0,120); out[k]=JSON.stringify([a.kind,a.trigger&&a.trigger.event,(a.steps||[]).map(s=>s.op+(s.kind||'')),(a.conds||[]).map(x=>x.t)]); }); }); return out; })()`;
const before = createEnv({ files: base }).run(q);
const after = createEnv({ files: base.concat(["abilities_r13.js"]) }).run(q);
const lost = Object.keys(before).filter(k => !(k in after));
const changed = Object.keys(before).filter(k => k in after && after[k] !== before[k]);
console.log("ran before:", Object.keys(before).length, "after:", Object.keys(after).length, "| lost:", lost.length, "| changed:", changed.length);
lost.slice(0, 40).forEach(k => console.log("  LOST", k.slice(0, 150)));
changed.slice(0, 40).forEach(k => console.log("  CHG ", k.slice(0, 110), "\n        ", before[k], "\n     -> ", after[k]));
