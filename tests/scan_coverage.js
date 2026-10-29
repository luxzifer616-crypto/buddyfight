// Final-layer coverage scan (all abilities_r*.js applied). No model tokens.
//   node tests/scan_coverage.js [filter]   filter: chaos | world name substring | (none = everything)
// done   = every effect ability is executable and nothing is left unparsed
// partly = some effect abilities run, but something is unparsed / not executable
// none   = the card has effect text but nothing runs
// noText = vanilla or only keywords/costs/rules
const { createEnv } = require("./headless.js");
const { run } = createEnv();
const filter = (process.argv[2] || "").toLowerCase();
const R = JSON.parse(run(`(function(){
  const filter=${JSON.stringify(filter)}; const INFO=["cost","keyword","reminder"];
  const inGroup=(c)=> !filter || (filter==="chaos" ? ((c.attrs||[]).some(a=>/chaos/i.test(a))||/chaos/i.test(c.name)||/the chaos/i.test((c.worlds||[]).join())) : ((c.world||"")+" "+(c.worlds||[]).join()).toLowerCase().includes(filter));
  const R={n:0,done:0,partly:0,none:0,noText:0,partlyIds:[],noneIds:[],byType:{},abil:{total:0,exec:0,unparsed:0,nonExec:0}};
  for(const c of ALL_CARDS){ if(!inGroup(c)) continue; R.n++; const g=ABX.get(c); const abs=(g&&g.abilities)||[];
    const eff=abs.filter(a=>!INFO.includes(a.kind) && !(a.kind==="rule" && !(a.steps||[]).length));
    const unp=abs.filter(a=>a.unparsed&&a.unparsed.length);
    if(!eff.length && !unp.length){R.noText++;continue}
    let ex=0,bad=0; for(const a of eff){ R.abil.total++; if(ABX.isExecutable(a)){ex++;R.abil.exec++} else {bad++;R.abil.nonExec++} }
    R.abil.unparsed+=unp.length;
    const st=(bad===0&&!unp.length)?"done":(ex===0?"none":"partly"); R[st]++; if(st==="partly")R.partlyIds.push(c.id); if(st==="none")R.noneIds.push(c.id);
    const t=c.type||"?"; R.byType[t]=R.byType[t]||{done:0,partly:0,none:0}; R.byType[t][st]++; }
  return JSON.stringify(R); })()`));
console.log(`GROUP "${filter || "all"}": ${R.n} cards | done ${R.done} | partly ${R.partly} | none ${R.none} | no effect text ${R.noText}`);
console.log("effect abilities:", JSON.stringify(R.abil), "| by type:", JSON.stringify(R.byType));
if (R.partlyIds.length) console.log("partly ids:", R.partlyIds.join(","));
if (R.noneIds.length) console.log("none ids:", R.noneIds.join(","));
