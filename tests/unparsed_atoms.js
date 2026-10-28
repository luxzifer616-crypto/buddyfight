// Finds the smallest failing pieces inside the unread ability text and groups them by shape.
// node tests/unparsed_atoms.js [top] [filterRegex]
const { createEnv } = require("./headless.js");
const env = createEnv();
const top = +(process.argv[2] || 70), filt = process.argv[3] || "";
const res = env.run(`(function(){
  const SPLIT=/,\\s*and\\s+(?:if\\s+)?|,\\s+(?=(?:you|your|there|neither|this|a|an|another|no|the)\\s)|\\s+and\\s+(?=(?:you|your|there|neither|this card|no)\\s)/i;
  const atoms=[];
  const condAtoms=(t,id)=>{ let subj=null; t.split(SPLIT).forEach(p=>{ p=p.trim().replace(/\\.$/,''); if(!p) return; let c=ABX.parseCondition(p); if(!c && subj) c=ABX.parseCondition(subj+p); const sm=p.match(/^(you have |your opponent has |there (?:is|are) )/i); if(sm) subj=sm[1]; if(!c) atoms.push({k:'cond',t:p,id}); }); };
  ALL_CARDS.forEach(card=>{ (ABX.get(card).abilities||[]).forEach(a=>{ (a.unparsed||[]).forEach(u=>{ let f=String(typeof u==='string'?u:(u.text||u.raw||'')).replace(/\\s*\\((?:link attacks?|a link attack)[^)]*\\)/ig,'').trim();
     if(!f) return;
     f=f.replace(/^(?:then, )?if you do(?: not)?,\s*/i,'').replace(/^then,\s*/i,'');
     // rule / condition fragments
     if(a.kind==='rule' || /^(?:if|while|during|when you|only if)\\b/i.test(f) && !/,\\s/.test(f.replace(/^if [^,]+,/i,''))) { const m=f.match(/^(?:only )?(?:if|while)\\s+(.+?)(?:,\\s*(.+))?$/i); if(m){ condAtoms(m[1],card.id); if(m[2]) { const r=ABX.parseSentenceSteps(m[2],{}); (r.unparsed||[]).forEach(x=>atoms.push({k:'eff',t:String(x.text||x),id:card.id})); } return; } }
     // trigger-led
     let r=null; try{ r=ABX.parseSentenceSteps(f,{}); }catch(e){}
     const un=(r&&r.unparsed&&r.unparsed.length)?r.unparsed.map(x=>String(x.text||x)):[f];
     un.forEach(x=>{ const m=x.match(/^(?:if|then, if)\\s+(.+?),\\s*(.+)$/i); if(m){ const c=ABX.parseCondition(m[1]); if(!c){ condAtoms(m[1],card.id); } else { const r2=ABX.parseSentenceSteps(m[2],{}); (r2.unparsed&&r2.unparsed.length?r2.unparsed:[]).forEach(y=>atoms.push({k:'eff',t:String(y.text||y),id:card.id})); } } else if (/^(?:when|whenever|at the (?:start|end|beginning))\\b/i.test(x)) atoms.push({k:'trig',t:x.split(',')[0],id:card.id}); else atoms.push({k:'eff',t:x,id:card.id}); });
  }); }); });
  return atoms; })()`);
const shape = (t) => String(t).toLowerCase().replace(/«[^»]*»/g, "«X»").replace(/"[^"]*"/g, '"N"').replace(/<[^>]*>/g, "<W>")
  .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/g, "N").replace(/\b(?:a|an|the)\b /g, "").replace(/\s+/g, " ").replace(/[.!]+$/, "").trim();
const g = new Map();
res.filter(a => !filt || new RegExp(filt, "i").test(a.t)).forEach(a => { const k = a.k + " | " + shape(a.t); if (!g.has(k)) g.set(k, { n: 0, ids: new Set(), ex: a.t }); const e = g.get(k); e.n++; e.ids.add(a.id); });
const arr = [...g.entries()].sort((a, b) => b[1].ids.size - a[1].ids.size);
const byKind = {}; res.forEach(a => byKind[a.k] = (byKind[a.k] || 0) + 1);
console.log("failing pieces:", res.length, JSON.stringify(byKind), "| shapes:", arr.length, "| shapes on 2+ cards:", arr.filter(x => x[1].ids.size > 1).length, "covering", arr.filter(x => x[1].ids.size > 1).reduce((s, x) => s + x[1].ids.size, 0), "cards");
arr.slice(0, top).forEach(([k, v]) => console.log(String(v.ids.size).padStart(3), k.slice(0, 160)));
