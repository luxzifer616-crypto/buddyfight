// Round 9: keywords only when the card really has them / the condition is met; new conditions.
const { createEnv } = require("./headless.js");
const env = createEnv();
const run = (c) => env.run(c);
run(`ABX.fast=true; globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:card.atk_max||1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
 [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.life=10; f.hand=[]; f.setSpells=[]; f.drop=[]; }); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const eff = (id, pos, setup) => JSON.parse(run(`(function(){ fresh(); const c=CARD_MAP.get(${id}); const u=put('plr','${pos || "left"}',c); ${setup || ""}; return JSON.stringify(getUnitEffectiveCombatStats(battle.plr,u)); })()`));

ck("Time Scout, Luke: no Double Attack without Overgod", eff(6205).da === false);
ck("…1 attack per turn", run(`CARD_MAP.get(6205).atk_max`) === 1);
ck("…Double Attack + power with Overgod", (e => e.da && e.power === 12000)(eff(6205, "left", "battle.plr.godclock=battle.plr.godclock||{}; battle.plr.godclock.overgodActive=true;")));
ck("650: Double Attack only with a soul", !eff(650).da && eff(650, "left", "u.soul=[1]").da);
ck("1244: Double Attack on left, not center", eff(1244, "left").da && !eff(1244, "center").da);
ck("2685: printed [Double Attack] kept, [Penetrate] needs 3 souls", (a => a.da && !a.pen)(eff(2685)) && eff(2685, "left", "u.soul=[1,2,3]").pen);
ck("2354: [Penetrate] needs 15 cards in drop", !eff(2354).pen && eff(2354, "left", "battle.plr.drop=Array(15).fill(1)").pen);
ck("5024: no Double Attack without Lost World flag", !eff(5024).da);
ck("printed [Double Attack] monster keeps it", run(`(function(){ const c=CARD_MAP.get(89); return c.da && c.atk_max===2; })()`));
ck("'cannot [Move]' restriction no longer gives [Move] (232)", run(`CARD_MAP.get(232).move`) === false);
ck("'not a link attack' still parses for counters", run(`ABX.isExecutable(ABX.get(CARD_MAP.get(34)).abilities.find(a=>a.kind==='spell'))`));
ck("then-if chain: 1855 line owned or condition read", run(`(function(){ const c=CARD_MAP.get(1855); const l=(c.skill||'').split(/\\n+/).find(x=>/Double Attack/.test(x)); return ABX.ownsStaticLine(c,l) || ABX.lineCond(c,l,battle.plr,null)!==null; })()`));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
