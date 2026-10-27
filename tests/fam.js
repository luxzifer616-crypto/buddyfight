const { createEnv } = require("./headless.js");
const { run } = createEnv();
const op = process.argv[2];
console.log(run(`(function(){ const out=[]; ALL_CARDS.forEach(c=>{ ABX.get(c).abilities.forEach(a=>{ if(['keyword','reminder','cost','rule','static'].includes(a.kind)||ABX.isExecutable(a)||(a.unparsed&&a.unparsed.length)) return; const steps=a.kind==='modal'?[]:(a.steps||[]); const bad=steps.find(s=>!ABX.stepExecutable(s)); if(bad&&bad.op===${JSON.stringify(op)}&&out.length<${+process.argv[3]||14}) out.push((a.trigger?a.trigger.event+(a.trigger.self?'(self)':''):a.kind)+' :: '+(a.cleaned||'').slice(0,200)); }); }); return out.join('\\n'); })()`));
