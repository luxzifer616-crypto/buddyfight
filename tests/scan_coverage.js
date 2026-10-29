// Free coverage scan (no model tokens). node tests/scan_coverage.js
// done = every skill line fully executable; partly = some lines; none = no line executable.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
const R = JSON.parse(run(`(function(){
  const R={cards:{done:0,partly:0,none:0,noText:0},lines:{full:0,partial:0,none:0,total:0},byType:{},byWorld:{}};
  for(const c of ALL_CARDS){ const g=ABX.get(c); if(!g||!g.stats||!g.stats.lines){R.cards.noText++;continue}
    const s=g.stats; R.lines.full+=s.full;R.lines.partial+=s.partial;R.lines.none+=s.none;R.lines.total+=s.lines;
    const st=s.full===s.lines?"done":(s.full+s.partial===0?"none":"partly"); R.cards[st]++;
    for(const [m,k] of [[R.byType,c.type||"?"],[R.byWorld,(c.world||"?").split(" / ")[0]]]){m[k]=m[k]||{done:0,partly:0,none:0};m[k][st]++;} }
  return JSON.stringify(R); })()`));
console.log("CARDS", JSON.stringify(R.cards), "\nSKILL LINES", JSON.stringify(R.lines), "(" + (100*R.lines.full/R.lines.total).toFixed(1) + "% full)");
for (const [n, m] of [["TYPE", R.byType], ["WORLD", R.byWorld]]) { console.log(n); for (const [k, v] of Object.entries(m)) console.log(" ", k.padEnd(28), v.done, v.partly, v.none); }
