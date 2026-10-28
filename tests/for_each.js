// "for each" counts (abilities_r18.js): own cost, size and stats change with the live count.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };

const r = JSON.parse(run(`(function(){
  battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){};
  const f = battle.plr; ["left","center","right"].forEach(p => f.monsters[p] = null); f.item = null; f.drop = [];
  const mk = (id) => ({ card: CARD_MAP.get(id), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 });
  const cost = (id) => { const c = CARD_MAP.get(id); return parseCardCost(c.cost, c.skill, f, c).gauge; };
  const size = (id) => getEffectiveCardSize(f, CARD_MAP.get(id), f.monsters.center);
  const out = {};
  // 4847 Revolution of Red: [Cast Cost] 5 gauge, -1 for each different «Fire» in your drop zone
  out.owns4847 = ABX.ownsSpell(CARD_MAP.get(4847));
  out.c4847a = cost(4847);
  const fire = ALL_CARDS.filter(x => (x.attrs || []).some(a => /^fire$/i.test(a)));
  f.drop = [fire[0].id, fire[0].id, fire[1].id, fire[2].id];
  out.c4847b = cost(4847);
  f.drop = [];
  // 5029 Lostless Heizer: [Equip Cost] 3 gauge, -1 for each card on your field
  out.c5029a = cost(5029);
  const m1 = ALL_CARDS.find(x => x.type === "Monster" && x.size === 1);
  f.monsters.left = mk(m1.id); f.monsters.right = mk(m1.id);
  out.c5029b = cost(5029);
  // 5543: on the center, size -1 for each card on your left or right
  f.monsters.left = null; f.monsters.right = null; f.monsters.center = mk(5543);
  out.s0 = size(5543); f.monsters.left = mk(m1.id); out.s1 = size(5543); f.monsters.right = mk(m1.id); out.s2 = size(5543);
  // 2685: power+1000 and defense+1000, for each card in this card's soul
  f.monsters.left = null; f.monsters.right = null; f.monsters.center = mk(2685);
  out.p0 = getUnitEffectiveCombatStats(f, f.monsters.center).power;
  f.monsters.center.soul = [1, 2, 3];
  out.p3 = getUnitEffectiveCombatStats(f, f.monsters.center).power;
  return JSON.stringify(out);
})()`));

ok(r.owns4847, "Revolution of Red's own text runs through the engine (its cost line no longer blocks it)");
ok(r.c4847a === 5 && r.c4847b === 2, `Revolution of Red: 5 gauge, 2 with 3 different «Fire» (4 cards) in the drop zone (${r.c4847a} -> ${r.c4847b})`);
ok(r.c5029a === 3 && r.c5029b === 1, `Lostless Heizer: 3 gauge, 1 with 2 cards on your field (${r.c5029a} -> ${r.c5029b})`);
ok(r.s0 === 3 && r.s1 === 2 && r.s2 === 1, `5543 on the center: size 3 / 2 / 1 with 0 / 1 / 2 cards beside it (${r.s0}, ${r.s1}, ${r.s2})`);
ok(r.p3 - r.p0 === 3000, `2685: +1000 power for each of 3 soul cards (${r.p0} -> ${r.p3})`);

console.log(fail ? "FAILED " + fail : "ALL PASSED");
process.exit(fail ? 1 : 0);
