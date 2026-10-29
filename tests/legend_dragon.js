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

  // ---- wave 2 ----
  const modalOpt = async (id, i) => { run(`{ const c=CARD_MAP.get(${id}); const m=ABX.get(c).abilities.find(a=>a.kind==='modal'); ABX.runAbility('plr',c,m.options[${i}],null,{preApproved:true,auto:true,event:{name:'counter'}}); }`); await settle(); };
  const zone = (ids) => run(`battle.plr.buddyZone=${JSON.stringify(ids)}.map(id=>({id,rested:false,isFaceDown:false}))`);

  // #5544 Alamgar: power+5000 and defense+5000 for each card in your buddy zone
  for (const n of [1, 2]) { run(`clear(); battle.plr.monsters.center=mku(5544);`); zone([FLAME, ICE].slice(0, n)); const st = stats("center"), base = J(`CARD_MAP.get(5544).power`);
    ok(st.power === base + 5000 * n && st.defense === J(`CARD_MAP.get(5544).defense`) + 5000 * n, `#5544 ${n} buddy zone card(s): power ${st.power} (base ${base})`); }

  // #5516 Grand Sage: in the center, this card AND all of your buddy monsters get power+10000 and critical+1
  run(`clear(); battle.plr.monsters.center=mku(5516); battle.plr.monsters.left=mku(battle.plr.buddyId); battle.plr.monsters.right=mku(46);`); zone([FLAME]);
  const gs = (p) => stats(p); const bm = J(`CARD_MAP.get(battle.plr.buddyId).power`);
  ok(gs("left").power === bm + 10000 && gs("right").power === J(`CARD_MAP.get(46).power`), `#5516 buddy monster on the left gets +10000, other monster does not (${gs("left").power}/${bm})`);

  // #5718 Talla Bu Luucy: up to ONE monster for each Dragod in your buddy zone (2 Dragod -> 2 monsters)
  run(`clear(); battle.plr.monsters.center=mku(${FLAME}); ["left","center","right"].forEach(p=>battle.opp.monsters[p]=mku(46));`); zone([FLAME, ICE]);
  await modalOpt(5718, 0);
  ok(J(`["left","center","right"].filter(p=>!battle.opp.monsters[p]).length`) === 2, "#5718 returns up to two monsters when two Dragod are in the buddy zone");
  // #5720 The Grand Guidance: [Rest] up to one opp card per Dragod in buddy zone
  run(`clear(); battle.plr.monsters.center=mku(${FLAME}); ["left","center","right"].forEach(p=>battle.opp.monsters[p]=mku(46));`); zone([FLAME, ICE]);
  await modalOpt(5720, 1);
  ok(J(`["left","center","right"].filter(p=>battle.opp.monsters[p].rested).length`) === 2, "#5720 rests up to two opponent cards when two Dragod are in the buddy zone");

  // #5538 Sector Collapse: for this turn, when a size<=1 Legend Dragon monster on your field attacks, destroy up to one opp card, then 1 damage
  run(`clear(); battle.plr.monsters.left=mku(${FLAME}); battle.opp.monsters.center=mku(46); globalThis.__ol=battle.opp.life;`); await spell(5538);
  ok(J(`!!battle.opp.monsters.center && __ol===battle.opp.life`), "#5538 casting does nothing by itself");
  run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.left}],'opp','center')`); await settle();
  ok(J(`!battle.opp.monsters.center && __ol-battle.opp.life===1`), "#5538 then a size<=1 Legend Dragon attacks: destroys an opp card and deals 1 damage");

  // #5757 Karkade: when put into the drop zone from HAND, if a Legend Dragon is on your field, destroy an opp spell/item
  run(`clear(); battle.plr.monsters.center=mku(${LD_PLAIN}); battle.opp.item=mku(5514); battle.plr.drop=[5757];`); run(`ABX.fireDiscarded('plr', CARD_MAP.get(5757))`); await settle();
  ok(J(`!battle.opp.item`), "#5757 dropped from hand with a Legend Dragon on the field destroys the opponent's item");

  // #6140 Cremaza Sith Nokima: put a Legend Dragon from drop into hand, return ALL other drop cards to the deck, shuffle
  run(`clear(); battle.plr.deck=Array(5).fill(46); battle.plr.drop=[${LD_PLAIN},46,46,46]; globalThis.__d=battle.plr.deck.length;`); await spell(6140);
  ok(J(`battle.plr.hand.includes(${LD_PLAIN}) && battle.plr.drop.length===0 && battle.plr.deck.length===__d+3`), `#6140 LD to hand, whole drop zone back into the deck (hand ${J(`battle.plr.hand.length`)}, drop ${J(`battle.plr.drop.length`)}, deck ${J(`battle.plr.deck.length`)})`);

  // #5422 De Ju Mau: only monsters with BOTH Dragod and Legend Dragon, different names
  run(`clear(); battle.plr.deck=[46,46,${FLAME},${FLAME},${ICE},46]; battle.plr.hand=[46];`); await spell(5422);
  const got = J(`battle.plr.hand.concat(battle.plr.drop).filter(id=>id!==46)`);   // two cards put -> one hand card is dropped (it may be one of them)
  ok(got.length === 2 && new Set(got).size === 2 && got.every(id => [FLAME, ICE].includes(id)), `#5422 fetched only Dragod+Legend Dragon monsters with different names (${JSON.stringify(got)})`);

  // #5419 Ice Deity: "Dragod and King" filter must match a Dragod
  ok(J(`ABX.core.matchFilter(CARD_MAP.get(${FLAME}), ABX.get(CARD_MAP.get(${ICE})).abilities.find(a=>a.kind==='static').steps[0].np.filter, {}, {})`) === true, "#5419 protection filter matches a Dragod monster");

  console.log(fail ? `\nlegend_dragon: fail ${fail}` : "\nlegend_dragon: fail 0");
  process.exitCode = fail ? 1 : 0;
})();
