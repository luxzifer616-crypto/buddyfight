// "When a monster on your center is destroyed ..." must not fire for left/right monsters (#3608, #4124, #2597, #5391; left/right: #932, #4964).
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.setup=()=>{ const f=battle.plr; ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.monsters.left=mku(3608); f.monsters.center=mku(46); f.monsters.right=mku(46); f.gauge=f.deck.splice(0,3); battle.activeSide='opp'; battle.phase='attack'; };`);
const settle = async () => { for (let i = 0; i < 40; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
(async () => {
  run(`setup(); battle.destroyMonster('plr','center');`); await settle();
  ok(J(`battle.plr.gauge.length`) === 4, "#3608: a monster destroyed on the CENTER puts the top card into the gauge");
  run(`setup(); battle.destroyMonster('plr','right');`); await settle();
  ok(J(`battle.plr.gauge.length`) === 3, "#3608: a monster destroyed on the RIGHT does nothing");
  run(`setup(); battle.destroyMonster('opp','center');`); await settle();
  ok(J(`battle.plr.gauge.length`) === 3, "#3608: an opponent's destroyed monster does nothing");
  console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
})();
