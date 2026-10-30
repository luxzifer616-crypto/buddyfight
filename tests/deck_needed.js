// Imported deck with unowned cards: "Cards Needed" search filter + play is blocked.
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const env = createEnv(); const run = (c) => env.run('{' + c + '\n}');

run(`globalThis.__alerts=[]; alert=function(m){__alerts.push(m)}; globalThis.__battles=0;
  const orig=battle.start; battle.start=function(){ __battles++; };
  const d=generateFlagDeck(447,'T',571,true); app.state.decks=[d]; app.state.activeDeckIndex=0; app.state.owned={}; globalThis.__deck=d;
  const ids=[...new Set(d.cards)]; globalThis.__id=ids[0];
  app.state.owned[__id]=0;`);
ck("deck with an unowned card counts as missing", run(`app.getDeckMissingCardCount(__deck)`) > 0);
run(`app.startBattle('bot')`);
ck("play is blocked when cards are missing", run(`__battles===0 && __alerts.length>=1`), run(`__alerts`));

run(`__deck.cards.forEach(c=>{ app.state.owned[c]=Math.max(app.state.owned[c]||0, __deck.cards.filter(x=>x===c).length); }); __alerts.length=0;`);
ck("no missing cards after owning them", run(`app.getDeckMissingCardCount(__deck)`) === 0);
run(`app.startBattle('bot')`);
ck("play starts once the deck is complete", run(`__battles===1`), run(`__alerts`));

console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
