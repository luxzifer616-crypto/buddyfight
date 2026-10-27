const { createEnv } = require("./headless.js");
const { run } = createEnv();
const want = process.argv.slice(2);
console.log(run(`(function(){ const out={}; const w=${JSON.stringify(want)}; ALL_CARDS.forEach(c=>{ ABX.get(c).abilities.forEach(a=>{ if(['keyword','reminder','cost','rule','static'].includes(a.kind)||ABX.isExecutable(a)||(a.unparsed&&a.unparsed.length)) return; (a.steps||[]).forEach(s=>{ if(!ABX.stepExecutable(s)&&w.includes(s.op)){ (out[s.op]=out[s.op]||[]); if(out[s.op].length<9) out[s.op].push((s.src||s.np&&s.np.raw||'')+' || '+ (a.cleaned||'').slice(0,140)); } }); }); }); return JSON.stringify(out,null,1); })()`));
