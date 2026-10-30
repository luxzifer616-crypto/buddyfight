// [Counter] [Act] that says "during your opponent's turn" must not work on your own turn (#1086 Damage Control).
const { createEnv } = require("./headless.js");
const env = createEnv();
const val = (c) => env.run(c);
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
val(`ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 globalThis.mku=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.setupFor=function(c,active,phase){ const F=battle.plr, E=battle.opp; battle.matchOver=false; battle.activeSide=active; battle.turn=active; battle.phase=phase; battle.turnCount=4; battle.pendingDefenseContext=null;
   [F,E].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.isBot=false; f.timeStoppedThisTurn=false; f.timeStoppedThisBattle=false; });
   const pool=ALL_CARDS.filter(x=>x.type==='Monster' && (x.size||0)<=2).map(x=>x.id);
   F.deck=pool.slice(0,30); F.gauge=pool.slice(30,36); F.hand=pool.slice(36,42); F.drop=pool.slice(42,50); F.life=10;
   E.deck=pool.slice(50,80); E.gauge=pool.slice(80,84); E.hand=pool.slice(84,88); E.drop=[]; E.life=10;
   F.monsters.center=mku(CARD_MAP.get(pool[90])); E.monsters.center=mku(CARD_MAP.get(pool[92]));
   F.setSpells=[c]; };
 globalThis.snap=()=>JSON.stringify({hand:battle.plr.hand.length,drop:battle.plr.drop.length,keys:Object.keys(battle.plr).filter(k=>/shield|reduce|prevent/i.test(k)&&battle.plr[k])});`);
const settle = async () => { for (let i = 0; i < 30; i++) { env.flush(); await new Promise(r => setImmediate(r)); } };
(async () => {
  for (const phase of ["main", "attack"]) {
    val(`setupFor(CARD_MAP.get(1086),'plr','${phase}')`);
    ck(`1086 is not an act option on my own turn (${phase})`, val(`ABX.actAbilities(CARD_MAP.get(1086)).every(a=>ABX.canUseAct('plr',CARD_MAP.get(1086),a,null).reason==='Timing / condition not met')`));
    ck(`1086 is not a free field counter on my own turn (${phase})`, val(`ABX.freeFieldCounterOptions('plr').every(o=>o.card.id!==1086)`));
    const before = val(`snap()`);
    val(`ABX.useAct('plr', CARD_MAP.get(1086), null)`); await settle();
    ck(`1086 forced through useAct on my own turn (${phase}) changes nothing`, val(`snap()`) === before);
  }
  val(`setupFor(CARD_MAP.get(1086),'opp','main')`);
  ck("1086 is an act option on the opponent's turn", val(`ABX.actAbilities(CARD_MAP.get(1086)).some(a=>ABX.canUseAct('plr',CARD_MAP.get(1086),a,null).ok)`));
  val(`globalThis.__info={attUnits:[battle.opp.monsters.center],targetPos:'fighter'}`);
  ck("1086 is offered in the defense window on the opponent's attack", val(`ABX.fieldCounterOptions('plr',__info).some(o=>o.card.id===1086)`));
  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
