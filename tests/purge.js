// [Purge]: [Counter] put a «Weaponry» from this card's soul into the gauge. Once per turn.
const { createEnv } = require("./headless.js");
const env = createEnv(); const val = (c) => env.run(c);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const settle = async () => { for (let i = 0; i < 30; i++) { env.flush(); await new Promise(r => setImmediate(r)); } };
val(`ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 globalThis.mku=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.weap=ALL_CARDS.filter(c=>(c.attrs||[]).some(a=>/weaponry/i.test(a))).slice(0,3).map(c=>c.id);
 globalThis.plain=ALL_CARDS.find(c=>c.type==='Monster'&&!(c.attrs||[]).some(a=>/weaponry/i.test(a))).id;
 globalThis.setup=function(id, soul){ const F=battle.plr,E=battle.opp; battle.matchOver=false; battle.activeSide='opp'; battle.phase='attack'; battle.turnCount=(globalThis.__t=(globalThis.__t||4)+2);
   [F,E].forEach(f=>{['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.isBot=false;});
   F.deck=ALL_CARDS.filter(c=>c.type==='Monster'&&c.size<=2).slice(0,30).map(c=>c.id); F.gauge=[]; F.hand=[]; F.drop=[]; F.life=10; E.life=10; E.deck=F.deck.slice();
   const u=mku(CARD_MAP.get(id)); u.soul=soul.slice(); F.monsters.left=u;
   E.monsters.center=mku(CARD_MAP.get(F.deck[5])); return u; };
 globalThis.offered=(id)=>battle.getAvailableDefenseCards('plr',false,'center',[battle.opp.monsters.center]).filter(o=>o.fieldKey&&o.card.id===id&&/^\\[Purge\\]/.test(o.fieldSub||"")).map(o=>o.fieldKey);`);
(async () => {
  for (const id of [4433, 4468, 4467, 6219, 6417]) {
    val(`setup(${id}, [weap[0], plain])`);
    const keys = JSON.parse(val(`JSON.stringify(offered(${id}))`));
    ok(keys.length === 1, `#${id} offers Purge as a field [Counter] with a Weaponry in soul`);
    if (!keys.length) continue;
    val(`battle.pendingDefenseContext={attSide:'opp',attackerZones:['center'],targetPos:'center',defSide:'plr'}; battle.resolveDefenseChoice({fieldKey:${JSON.stringify(keys[0])}});`);
    await settle();
    ok(val(`battle.plr.gauge.length===1 && battle.plr.gauge[0]===weap[0] && battle.plr.monsters.left.soul.length===1`), `#${id} Purge moved the Weaponry from soul to gauge`);
    val(`battle.plr.monsters.left.soul.push(weap[1])`);
    ok(JSON.parse(val(`JSON.stringify(offered(${id}))`)).length === 0, `#${id} Purge is once per turn`);
  }
  val(`setup(4433,[weap[0]])`);
  val(`setup(4433,[plain])`);
  ok(JSON.parse(val(`JSON.stringify(offered(4433))`)).length === 0, "Purge not offered without a Weaponry in soul");
  console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
})();
