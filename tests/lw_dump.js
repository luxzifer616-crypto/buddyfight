// dump card text + parsed ability summary for a list of ids: node tests/lw_dump.js a,b,c
const {createEnv}=require("./headless.js");const e=createEnv();
const ids=process.argv[2].split(",").map(Number);
for (const id of ids) {
  const t=e.run(`(function(){const c=CARD_MAP.get(${id});return c.name+" ["+c.type+" s"+c.size+" p"+c.power+" d"+c.defense+" c"+c.crit+"] "+String(c.skill||"").replace(/\\s+/g," ")})()`);
  const j=JSON.parse(e.run(`JSON.stringify(ABX.get(CARD_MAP.get(${id})).abilities.filter(a=>!/^(cost|keyword|reminder)$/.test(a.kind)).map(a=>({k:a.kind,tr:a.trigger&&(a.trigger.event+(a.trigger.pos?":"+a.trigger.pos:"")+(a.trigger.opp?":opp":"")),c:(a.conds||[]).map(x=>x.t),o:a.once,u:(a.unparsed||[]).length?a.unparsed:undefined,s:(a.steps||[]).map(s=>s.op+(s.kind?"."+s.kind:"")+(s.gate?"/"+s.gate:"")+(s.cond?"?"+s.cond.t:""))})))`));
  console.log("#"+id, t.slice(0,620)); console.log("   ->", JSON.stringify(j).slice(0,520),"\n");
}
