// Legend Dragon tribe review (attr "LegendDragon", Legend World). Each check is verified against the card text.
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.clear=()=>{ for (const f of [battle.plr,battle.opp]) { ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.item=null; f.hand=[]; f.drop=[]; f.life=10; f.setSpells=[]; } battle.plr.gauge=battle.plr.deck.splice(0,8); battle.plr.deck=Array(30).fill(46); battle.matchOver=false; battle.activeSide="plr"; battle.phase="main"; battle.turnCount=6; };`);
const settle = async () => { for (let i = 0; i < 40; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
const FIRE = 328, WATER = 303, THUNDER = 5717, FLAME = 5418, ICE = 5419, LD_PLAIN = 5509;
const spell = async (id, extra) => { run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='spell'||a.kind==='modal'); ABX.runAbility('plr',c,ab,null,Object.assign({preApproved:true,auto:true,event:{name:'counter'}},${JSON.stringify(extra || {})})); }`); await settle(); };
const enter = async (id, pos) => { run(`ABX.fireEnter('plr', CARD_MAP.get(${id}), battle.plr.monsters.${pos})`); await settle(); };
const place = (pos, id) => run(`battle.plr.monsters.${pos}=mku(${id})`);
const stats = (pos) => J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.${pos})`);
(async () => {
  // #6138 King's Privilege: three INDEPENDENT conditions (Fire -> 2 damage, Water -> gain 2 life, Thunder -> draw 2)
  for (const [mon, dmg, life, draw, label] of [[FIRE, 2, 0, 0, "Fire only"], [WATER, 0, 2, 0, "Water only"], [THUNDER, 0, 0, 2, "Thunder only"]]) {
    run(`clear(); battle.plr.monsters.center=mku(${mon}); globalThis.__ol=battle.opp.life; globalThis.__pl=battle.plr.life; globalThis.__h=battle.plr.hand.length;`);
    await spell(6138);
    const r = J(`[__ol-battle.opp.life, battle.plr.life-__pl, battle.plr.hand.length-__h]`);
    ok(r[0] === dmg && r[1] === life && r[2] === draw, `#6138 ${label}: damage/life/draw = ${JSON.stringify(r)} expected ${JSON.stringify([dmg, life, draw])}`);
  }

  // #5527 Warrior of Zeal: NO damage when it enters; while in the center, deal 1 when a Legend Dragon on left/right attacks
  run(`clear(); battle.plr.monsters.center=mku(5527); globalThis.__ol=battle.opp.life;`); await enter(5527, "center");
  ok(J(`battle.opp.life`) === J(`__ol`), "#5527 entering the field deals no damage");
  run(`clear(); battle.plr.monsters.center=mku(5527); battle.plr.monsters.left=mku(${LD_PLAIN}); battle.opp.monsters.center=mku(46); globalThis.__ol=battle.opp.life;`);
  run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.left}],'opp','center')`); await settle();
  ok(J(`__ol-battle.opp.life`) === 1, "#5527 center: a Legend Dragon on the left attacks -> 1 damage to the opponent");
  run(`clear(); battle.plr.monsters.left=mku(5527); battle.plr.monsters.center=mku(${LD_PLAIN}); battle.opp.monsters.center=mku(46); globalThis.__ol=battle.opp.life;`);
  run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.center}],'opp','center')`); await settle();
  ok(J(`__ol-battle.opp.life`) === 0, "#5527 NOT in the center: no damage");

  // #5514 Sceptre of Midan: only Legend Dragon monsters on LEFT and RIGHT get power+5000
  run(`clear(); battle.plr.item=mku(5514); battle.plr.monsters.left=mku(${LD_PLAIN}); battle.plr.monsters.center=mku(${LD_PLAIN}); battle.plr.monsters.right=mku(${LD_PLAIN});`);
  const b = (p) => stats(p).power; const baseP = J(`CARD_MAP.get(${LD_PLAIN}).power`);
  ok(b("left") === baseP + 5000 && b("right") === baseP + 5000 && b("center") === baseP, `#5514 left/right +5000, center unchanged (${b("left")}/${b("center")}/${b("right")}, base ${baseP})`);

  // #5418 Flame Deity: start-of-attack [Triple Attack] for size 1 Dragod ONLY if "Ice Deity, Freeza Horus" is on your field
  const startAtk = async () => { run(`ABX.fireTurnEvent('phaseStart','attack','plr')`); await settle(); };
  run(`clear(); battle.plr.monsters.center=mku(${FLAME}); battle.plr.monsters.left=mku(${FLAME});`); await startAtk();
  ok(J(`!!getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center).ta`) === false, "#5418 no Ice Deity on the field -> no Triple Attack");
  run(`clear(); battle.plr.monsters.center=mku(${FLAME}); battle.plr.monsters.left=mku(${ICE});`); await startAtk();
  ok(J(`!!getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center).ta`) === true, "#5418 Ice Deity on the field -> Triple Attack");

  // #5737 SD: Triple Attack only if you buddy called during this fight
  run(`clear(); battle.plr.monsters.center=mku(5737); battle.opp.monsters.center=mku(46); battle.plr.buddyCalledThisFight=false;`);
  run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.center}],'opp','center')`); await settle();
  ok(J(`!!getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center).ta`) === false, "#5737 no buddy call this fight -> no Triple Attack");

  run(`battle.plr.buddyCallEver=true; ABX.fireAttack('plr',[{unit:battle.plr.monsters.center}],'opp','center')`); await settle();
  ok(J(`!!getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center).ta`) === true, "#5737 buddy called -> Triple Attack");
  run(`clear(); battle.plr.monsters.center=mku(${FLAME}); battle.plr.monsters.left=mku(5517);`); await startAtk();
  ok(J(`!!getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center).ta`) === false, "#5418 'Legendary' Ice Deity is a different card -> no Triple Attack");

  console.log(fail ? `\nlegend_dragon: fail ${fail}` : "\nlegend_dragon: fail 0");
  process.exitCode = fail ? 1 : 0;
})();
