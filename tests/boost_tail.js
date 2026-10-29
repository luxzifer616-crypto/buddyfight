// "give the chosen card power+3000, defense+3000 and [Counterattack]" used to lose the numbers (kept only in np.refTail).
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run;
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.cm=ALL_CARDS.find(c=>c.type==="Monster"&&(c.attrs||[]).some(a=>/^chaos$/i.test(a))&&c.size<=2).id;`);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
(async () => {
  // 1. every boost step whose numbers sit in refTail must have non-zero effective mods
  const bad = JSON.parse(run(`JSON.stringify((function(){ const b=[]; for(const c of ALL_CARDS){ for(const a of ABX.get(c).abilities){ for(const s of [].concat(a.steps||[],...(a.options||[]).map(o=>o.steps||[]))){
    if(s.op==="boost"&&s.np&&s.np.refTail&&/[+-]\\s*\\d/.test(s.np.refTail)){ const m=ABX.effectiveBoostMods(s); if(!m.power&&!m.defense&&!m.critical) b.push(c.id); } } } } return b; })())`));
  ok(bad.length === 0, "every boost with stat numbers in refTail has effective power/defense/critical (" + bad.length + " still empty)");
  // 2. end to end
  for (const [id, p, d] of [[3391, 3000, 3000], [4085, 6000, 6000]]) {
    run(`{ const f=battle.plr; ["left","center","right"].forEach(p=>f.monsters[p]=null); f.monsters.center=mku(cm); battle.activeSide='opp'; battle.phase='attack'; battle.opp.monsters.center=mku(46); ABX.battleCtx={active:true,attSide:'opp',defSide:'plr',attUnits:[battle.opp.monsters.center],defUnit:f.monsters.center,targetPos:'center'};
      const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='spell'||a.kind==='act'); ABX.runAbility('plr',c,ab,null,{preApproved:true,auto:true,event:{name:'counter'}}); }`);
    for (let i = 0; i < 30; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); }
    const r = JSON.parse(run(`JSON.stringify({tp:battle.plr.monsters.center.tempPower,td:battle.plr.monsters.center.tempDef,ca:battle.plr.monsters.center.tempCA})`));
    ok(r.tp === p && r.td === d && r.ca === true, `#${id} gives power+${p}, defense+${d} and [Counterattack] (${JSON.stringify(r)})`);
  }
  console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
})();
