// Conditions behind "Then," / "If you do," (abilities_r19.js): they read, and they check the live game state.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };

const r = JSON.parse(run(`(function(){
  battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){};
  const f = battle.plr, e = battle.opp; ["left","center","right"].forEach(p => { f.monsters[p] = null; e.monsters[p] = null; }); f.item = null; f.drop = []; e.drop = [];
  const mk = (id) => ({ card: CARD_MAP.get(id), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 });
  const ctx = (bind) => ({ side: "plr", f, e, card: null, unit: null, bind: bind || {} });
  const ev = (t, bind) => { const c = ABX.parseCondition(t); return c && ABX.condExecutable(c) ? ABX.core.evalCond(c, ctx(bind)) : "unread"; };
  const out = {};
  // 1. number words / the opponent's drop zone
  f.life = 5; out.life5 = ev("if your life is five or less"); f.life = 6; out.life6 = ev("if your life is five or less");
  const any = ALL_CARDS.filter(x => x.type === "Monster").slice(0, 30).map(x => x.id);
  e.drop = any.slice(0, 25); out.drop25 = ev("if your opponent has twenty-five or more cards in the drop zone");
  e.drop = any.slice(0, 24); out.drop24 = ev("if your opponent has twenty-five or more cards in the drop zone");
  // 2. item souls
  const item = ALL_CARDS.find(x => x.type === "Item");
  f.item = mk(item.id); out.soul0 = ev("if your items have souls");
  f.item.soul = [any[0]]; out.soul1 = ev("if your items have souls");
  // 3. the card just handled
  const big = ALL_CARDS.find(x => x.type === "Monster" && x.size === 3 && (x.crit || 0) >= 2), small = ALL_CARDS.find(x => x.type === "Monster" && x.size === 1);
  e.monsters.center = mk(big.id);
  const ref = (u, id) => ({ chosen: [{ k: "unit", side: "opp", unit: u, card: CARD_MAP.get(id), id }] });
  out.onField = ev("if the chosen card is on the field", ref(e.monsters.center, big.id));
  out.inCenter = ev("if that card is in the center", ref(e.monsters.center, big.id));
  out.inLeft = ev("if that card is on the left", ref(e.monsters.center, big.id));
  out.size2big = ev("if the destroyed monster is size 2 or less", { chosen: [{ k: "zone", side: "opp", area: "drop", card: big, id: big.id }] });
  out.size2small = ev("if the destroyed monster is size 2 or less", { chosen: [{ k: "zone", side: "opp", area: "drop", card: small, id: small.id }] });
  out.notMonster = ev("if that card is not a monster", { chosen: [{ k: "zone", side: "plr", area: "drop", card: big, id: big.id }] });
  // 4. all moved cards were monsters
  out.allMon = ev("if all the cards put were monsters", { lastMoved: [{ card: big }, { card: small }] });
  out.allMonNo = ev("if all the cards put were monsters", { lastMoved: [{ card: big }, { card: item }] });
  return JSON.stringify(out);
})()`));

ok(r.life5 === true && r.life6 === false, `"your life is five or less" (5 life: ${r.life5}, 6 life: ${r.life6})`);
ok(r.drop25 === true && r.drop24 === false, `"your opponent has twenty-five or more cards in the drop zone" counts their drop zone (${r.drop25}, ${r.drop24})`);
ok(r.soul0 === false && r.soul1 === true, `"your items have souls" (no soul: ${r.soul0}, one soul: ${r.soul1})`);
ok(r.onField === true && r.inCenter === true && r.inLeft === false, `the chosen card's place (field ${r.onField}, center ${r.inCenter}, left ${r.inLeft})`);
ok(r.size2big === false && r.size2small === true, `"the destroyed monster is size 2 or less" (size 3: ${r.size2big}, size 1: ${r.size2small})`);
ok(r.notMonster === false, `"that card is not a monster" on a monster (${r.notMonster})`);
ok(r.allMon === true && r.allMonNo === false, `"all the cards put were monsters" (${r.allMon}, with an item: ${r.allMonNo})`);

console.log(fail ? "FAILED " + fail : "ALL PASSED");
process.exit(fail ? 1 : 0);
