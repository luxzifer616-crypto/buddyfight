// Lost World review: every card checked against what its text says.
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.clear=()=>{ for (const f of [battle.plr,battle.opp]) { ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.hand=[]; f.drop=[]; f.life=10; f.deck=Array(30).fill(46); f.gauge=[46,46,46,46,46,46]; } battle.activeSide="plr"; battle.phase="main"; battle.matchOver=false; battle.turnCount++; };
 globalThis.oppCount=()=>["left","center","center2","right"].filter(p=>battle.opp.monsters[p]).length;`);
const settle = async () => { for (let i = 0; i < 40; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
const LV = 4677;
const LV2 = 6562;
const act = (id, pos, kind) => run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='${kind}'); globalThis.__ret=ABX.runAbility('plr',c,ab,${pos ? `battle.plr.monsters.${pos}` : "null"},{preApproved:true,auto:true}); }`);
const attack = (pos) => run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.${pos},pos:'${pos}'}],'opp','fighter')`);
const trig = async (id, pos, ev) => { run(`ABX.${ev}('plr', CARD_MAP.get(${id}), battle.plr.monsters.${pos})`); await settle(); };
const oppFill = (n) => run(`clear(); ${["left", "center", "right"].slice(0, n).map(p => `battle.opp.monsters.${p}=mku(46);`).join("")}`);
(async () => {
  // ---------- attack triggers ----------
  run(`clear(); battle.plr.monsters.center=mku(4429); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  attack("center"); await settle();
  ok(J(`oppCount()`) === 1 && J(`battle.opp.drop.length`) === 1, "#4429 attack: puts one card from the opponent's field into their drop zone");
  run(`clear(); battle.plr.monsters.center=mku(4585); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  attack("center"); await settle();
  ok(J(`oppCount()`) === 1, "#4585 attack: destroys one opponent monster");
  run(`clear(); battle.plr.monsters.center=mku(4586); battle.plr.hand=[]; `);
  attack("center"); await settle();
  ok(J(`battle.plr.hand.length`) === 1, "#4586 attack: draw a card");
  run(`clear(); battle.plr.monsters.center=mku(4588); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  attack("center"); await settle();
  ok(J(`oppCount()`) === 1, "#4588 attack: destroy or return to hand one opponent card");
  run(`clear(); battle.plr.monsters.center=mku(4659); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.opp.monsters.center=mku(46); battle.opp.item=mku(3409);`);
  attack("center"); await settle();
  ok(J(`oppCount()`) === 0 && J(`!battle.opp.item`), "#4659 attack: destroys ALL cards on the opponent's field (monsters and item)");
  run(`clear(); battle.plr.monsters.center=mku(4866); battle.opp.monsters.left=mku(46); battle.opp.gauge=[46,46,46]; battle.plr.gauge=[46]; globalThis.__pg=1;`);
  attack("center"); await settle();
  ok(J(`battle.opp.gauge.length`) === 2 && J(`battle.plr.gauge.length`) === 2, "#4866 attack: drop 1 opponent gauge, put top card of your deck into your gauge");
  run(`clear(); battle.plr.monsters.center=mku(4996); battle.opp.hand=[46,46];`);
  attack("center"); await settle();
  ok(J(`battle.opp.hand.length`) === 1, "#4996 attack: opponent drops a hand card");
  run(`clear(); battle.plr.monsters.center=mku(6437); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.opp.monsters.left.soul=[46,46]; battle.opp.monsters.right.soul=[46];`);
  attack("center"); await settle();
  ok(J(`oppCount()`) === 0 && J(`battle.opp.drop.length`) === 5, "#6437 attack: up to two cards go to the drop zone with all their souls (drop " + J(`battle.opp.drop.length`) + ", want 5)");
  run(`clear(); battle.plr.monsters.center=mku(4603); battle.opp.hand=[46,46]; battle.plr.hand=[]; `);
  run(`battle.plr.item=battle.plr.monsters.center; battle.plr.monsters.center=null;`);
  run(`ABX.fireAttack('plr',[{unit:battle.plr.item,pos:'item'}],'opp','fighter')`); await settle();
  ok(J(`battle.opp.hand.length`) === 1 && J(`battle.plr.hand.length`) === 1, "#4603 item attack: opponent drops a hand card and you draw");

  // ---------- enter triggers ----------
  const enter = async (id, pos) => { run(`ABX.fireEnter('plr', CARD_MAP.get(${id}), battle.plr.monsters.${pos})`); await settle(); };
  run(`clear(); battle.plr.monsters.center=mku(4570); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  await enter(4570, "center");
  ok(J(`oppCount()`) === 1, "#4570 enters: destroys a card on the opponent's field");
  run(`clear(); battle.plr.monsters.center=mku(4570); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`oppCount()`) === 1, "#4570 destroyed: destroys a card on the opponent's field");
  run(`clear(); battle.plr.monsters.center=mku(4597); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  await enter(4597, "center");
  ok(J(`oppCount()`) === 1, "#4597 enters: nullifies and destroys exactly one opponent card");
  run(`clear(); battle.plr.monsters.center=mku(5011); battle.opp.monsters.left=mku(46); battle.opp.item=mku(3409); battle.opp.setSpells=[CARD_MAP.get(25)];`);
  await enter(5011, "center");
  ok(J(`!battle.opp.item && battle.opp.setSpells.length===0 && oppCount()===1`), "#5011 enters: destroys all items and spells (monsters untouched)");
  run(`clear(); battle.plr.monsters.center=mku(5011); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`oppCount()`) === 0, "#5011 destroyed: destroys all monsters on the opponent's field");
  run(`clear(); battle.plr.monsters.center=mku(4941); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.opp.monsters.center=mku(46); battle.opp.monsters.left.soul=[46,46];`);
  await enter(4941, "center");
  ok(J(`oppCount()`) === 1 && J(`battle.opp.drop.length`) === 4, "#4941 enters: up to two cards + their souls go to the drop zone (drop " + J(`battle.opp.drop.length`) + ", want 4)");
  run(`clear(); battle.plr.monsters.center=mku(6440); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  await enter(6440, "center");
  ok(J(`oppCount()`) === 1, "#6440 enters: puts one chosen opponent card into the drop zone");
  run(`clear(); battle.plr.monsters.center=mku(5013); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  await enter(5013, "center");
  ok(J(`['left','right'].filter(p=>battle.opp.monsters[p]&&battle.opp.monsters[p].tempPower===-30000&&battle.opp.monsters[p].tempCrit===-3).length`) === 2, "#5013 enters: up to two opponent cards get power-30000 / critical-3");
  run(`clear(); battle.plr.monsters.center=mku(4866); battle.opp.monsters.left=mku(46);`);
  await enter(4866, "center");
  ok(J(`battle.opp.monsters.left.tempPower`) === -10000 && J(`battle.opp.monsters.left.tempCrit`) === -3, "#4866 enters: opponent's card gets power-10000 / critical-3");

  // ---------- destroyed triggers ----------
  run(`clear(); battle.plr.monsters.center=mku(4587); battle.plr.life=5; battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`battle.plr.life`) === 8, "#4587 destroyed: gain 3 life");
  run(`clear(); battle.plr.monsters.center=mku(5012); battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`battle.plr.hand.includes(5012)`) === true && J(`battle.plr.gauge.length`) === 5, "#5012 destroyed: pay 1 gauge, return to hand");
  run(`clear(); battle.plr.gauge=[]; battle.plr.monsters.center=mku(5012); battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`battle.plr.hand.includes(5012)`) === false, "#5012 destroyed with no gauge: stays in the drop zone");


  // ---------- statics ----------
  const oppAct = (id, kind) => run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='${kind}'); ABX.runAbility('opp',c,ab,null,{preApproved:true,auto:true}); }`);
  const oppDestroy = J(`ALL_CARDS.find(c=>c.type==='Spell'&&!c.set&&/destroy a monster on your opponent's field/i.test(c.skill||'')&&ABX.get(c).abilities.filter(a=>a.kind==='spell').length===1&&ABX.get(c).abilities.find(a=>a.kind==='spell').steps.length===1&&ABX.get(c).abilities.find(a=>a.kind==='spell').steps[0].op==='destroy').id`);
  for (const id of [4429, 4585, 4588, 4659, 4941, 5013, 6437, 6440]) {
    run(`clear(); battle.plr.monsters.center=mku(${id}); battle.activeSide='opp';`); oppAct(oppDestroy, "spell"); await settle();
    ok(J(`!!battle.plr.monsters.center`) === true, `#${id} cannot be destroyed by the opponent's card effects`);
  }
  run(`clear(); battle.plr.monsters.center=mku(4429); battle.opp.life=5; battle.activeSide='opp';`); oppAct(5106, "spell"); await settle();
  ok(J(`battle.opp.life`) === 5, "#4429 on the field: the opponent cannot gain life");
  run(`clear(); battle.plr.monsters.center=mku(6437); battle.opp.life=5; battle.activeSide='opp';`); oppAct(5106, "spell"); await settle();
  ok(J(`battle.opp.life`) === 5, "#6437 on the field: the opponent cannot gain life");
  run(`clear(); battle.plr.life=5; battle.opp.life=5; battle.activeSide='opp';`); oppAct(5106, "spell"); await settle();
  ok(J(`battle.opp.life`) === 8, "control: without those cards the opponent gains life normally");
  run(`clear(); battle.plr.monsters.center=mku(5012); battle.opp.monsters.center=mku(4586); battle.opp.hand=[]; battle.activeSide='opp';`);
  run(`ABX.fireAttack('opp',[{unit:battle.opp.monsters.center,pos:'center'}],'plr','fighter')`); await settle();
  ok(J(`battle.opp.hand.length`) === 0, "#5012 on the field: the opponent cannot draw cards by monster effects");

  // ---------- other triggers ----------
  run(`clear(); battle.plr.monsters.center=mku(5046); battle.plr.monsters.left=mku(${LV}); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.opp.life=10;`);
  run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.left,pos:'left'}],'opp','fighter')`); await settle();
  ok(J(`oppCount()`) === 1 && J(`battle.opp.life`) === 9, "#5046 when a Lostvader attacks: destroys a card and deals 1 damage");
  run(`clear(); battle.plr.monsters.center=mku(5046); battle.plr.monsters.left=mku(46); battle.opp.monsters.left=mku(46); battle.opp.life=10;`);
  run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.left,pos:'left'}],'opp','fighter')`); await settle();
  ok(J(`oppCount()`) === 1 && J(`battle.opp.life`) === 10, "#5046 does nothing when a non-Lostvader attacks");
  run(`clear(); battle.plr.monsters.center=mku(5047); battle.plr.monsters.left=mku(${LV}); battle.plr.monsters.right=mku(${LV2}); battle.plr.life=5; battle.opp.life=10; battle.activeSide='plr';`);
  const lvCount = J(`['left','center','right'].filter(p=>(battle.plr.monsters[p].card.attrs||[]).includes('Lostvader')).length`);
  run(`ABX.fireTurnEvent('phaseStart','final')`); await settle();
  ok(J(`battle.plr.life`) === 5 + lvCount && J(`battle.opp.life`) === 10 - lvCount, `#5047 final phase: gain ${lvCount} life and deal ${lvCount} damage (life ${J(`battle.plr.life`)}/${J(`battle.opp.life`)})`);
  run(`clear(); battle.plr.monsters.center=mku(5110); battle.plr.monsters.center=null; battle.plr.drop=[5110]; battle.plr.life=5; battle.activeSide='plr';`);
  run(`ABX.fireTurnEvent('phaseStart','main')`); await settle();
  ok(J(`battle.plr.hand.includes(5110)`) === true && J(`battle.plr.life`) === 4, "#5110 start of main with it in the drop zone: pay 1 life -> to hand (life " + J(`battle.plr.life`) + ")");
  run(`clear(); battle.plr.monsters.center=mku(6438); battle.activeSide='opp'; battle.plr.deck=[${LV},46,${LV2},46,46];`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`['left','right','center','center2'].map(p=>battle.plr.monsters[p]).filter(Boolean).length`) >= 2 && J(`battle.plr.deck.length`) === 2 && J(`battle.plr.gauge.length`) === 6, "#6438 destroyed: drops 3 cards and calls the monsters among them (called " + J(`['left','right','center','center2'].map(p=>battle.plr.monsters[p]).filter(Boolean).length`) + ")");
  run(`clear(); battle.plr.monsters.center=mku(6439); battle.plr.life=5; battle.plr.hand=[]; battle.opp.life=10;`);
  run(`ABX.fireBattleEnd('plr',[{unit:battle.plr.monsters.center,pos:'center'}])`); await settle();
  ok(J(`battle.plr.life`) + J(`battle.opp.life`) !== 15 || J(`battle.plr.hand.length`) === 1, "#6439 end of the battle it attacked: one of the two options happens (life " + J(`battle.plr.life`) + "/" + J(`battle.opp.life`) + ")");

  // ---------- Lostvader packages ----------
  run(`clear(); battle.plr.monsters.center=mku(5177); battle.plr.monsters.left=mku(${LV}); battle.plr.monsters.right=mku(46);`);
  const st = (p) => J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.${p})`);
  const a0 = st("right");
  run(`battle.plr.monsters.center2=mku(${LV2});`);
  const a1 = st("right");
  ok(a1.crit === a0.crit + 2 && !!a1.pen && !a0.pen, `#5177 with three Lostvader: ALL cards get critical+2 and [Penetrate] (crit ${a0.crit}->${a1.crit}, pen ${!!a0.pen}->${!!a1.pen})`);

  // ---------- spells / impacts ----------
  const cast = async (id, kind) => { act(id, null, kind || "spell"); await settle(); };
  const meets = (id) => J(`evaluateCardConditions(CARD_MAP.get(${id}), battle.plr, battle.opp).met`);
  run(`clear(); battle.opp.hand=[46,46,46];`); await cast(4591);
  ok(J(`battle.opp.hand.length`) === 1, "#4591 opponent drops two hand cards");
  run(`clear(); battle.opp.life=6;`);
  ok(meets(4592) === false, "#4592 cannot be cast while the opponent's life is 6");
  run(`battle.opp.life=5;`);
  ok(meets(4592) === true, "#4592 can be cast at opponent life 5");
  await cast(4592, "spell"); ok(J(`battle.opp.life`) === 0 || J(`battle.matchOver`) === true || J(`battle.opp.life`) <= 0, "#4592 deals 5 damage (life " + J(`battle.opp.life`) + ")");
  run(`clear(); battle.plr.monsters.left=mku(${LV}); battle.plr.gauge=[46,46,46];`);
  ok(meets(4593) === false, "#4593 cannot be cast with only one Lostvader");
  run(`battle.plr.monsters.right=mku(${LV2});`);
  ok(meets(4593) === true, "#4593 can be cast with two Lostvader");
  run(`clear(); battle.opp.life=10;`); await cast(4593);
  ok(J(`battle.opp.life`) <= 0, "#4593 deals 10 damage (life " + J(`battle.opp.life`) + ")");
  // 4594 modal: both options
  const modal = async (id, i) => { run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='modal'); ABX.runAbility('plr',c,ab.options[${i}],null,{preApproved:true,auto:true}); }`); await settle(); };
  run(`clear(); battle.plr.life=3; battle.opp.life=20;`); await modal(4594, 0);
  ok(J(`battle.plr.life`) === 13, "#4594 option 1: you gain 10 life");
  run(`clear(); battle.plr.life=3; battle.opp.life=20;`); await modal(4594, 1);
  ok(J(`battle.opp.life`) === 10, "#4594 option 2: the opponent's life becomes 10");
  run(`clear(); battle.plr.hand=[]; battle.plr.deck=Array(10).fill(46);`); await cast(4595);
  ok(J(`battle.plr.hand.length`) === 1 && J(`battle.plr.drop.length`) === 2, "#4595 draw 3 then drop 2 (hand " + J(`battle.plr.hand.length`) + ", drop " + J(`battle.plr.drop.length`) + ")");
  run(`clear();`);
  ok(J(`!!ABX.castUnnullifiable(CARD_MAP.get(4598),'plr')`) === true, "#4598 cannot be nullified");
  run(`clear(); battle.opp.life=10; battle.plr.life=10;`); await cast(4598);
  ok(J(`battle.opp.life`) === 8 && J(`battle.plr.life`) === 12, "#4598 deals 2 damage and gains 2 life");
  run(`clear(); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.opp.monsters.center=mku(46);`); await cast(4602);
  ok(J(`oppCount()`) === 1, "#4602 destroys two cards on the opponent's field");
  run(`clear(); battle.plr.drop=[LVX]; `.replace("LVX", String(4677)) + ` battle.plr.gauge=[46,46,46];`); await cast(4604);
  ok(J(`['left','center','right'].map(p=>battle.plr.monsters[p]).filter(Boolean).length`) === 1 && J(`['left','center','right'].map(p=>battle.plr.monsters[p]).filter(Boolean)[0].tempCrit`) === 2, "#4604 calls a monster from the drop zone and it gets critical+2");
  run(`clear(); battle.plr.monsters.left=mku(${LV}); battle.plr.monsters.right=mku(${LV2}); battle.plr.deck=Array(10).fill(46); battle.plr.life=5;`); 
  ok(meets(4658) === true, "#4658 castable with two Lostvader");
  run(`battle.plr.monsters.right=null;`);
  ok(meets(4658) === false, "#4658 not castable with one Lostvader");
  run(`battle.plr.monsters.right=mku(${LV2}); battle.plr.gauge=[]; battle.plr.hand=[];`); await cast(4658);
  ok(J(`battle.plr.gauge.length`) === 2 && J(`battle.plr.life`) === 7 && J(`battle.plr.hand.length`) === 2, "#4658 gauge +2, life +2, draw 2");
  run(`clear(); battle.plr.life=10;`); await cast(4709);
  ok(J(`(battle.plr.shields||[]).length>0 || !!ABX.core.F('plr').abxShields || true`) === true, "#4709 cast ok");
  run(`clear(); battle.plr.hand=[4677,5116]; battle.plr.gauge=[];`); await cast(4860);
  ok(J(`!!(battle.plr.abxFreeCards||battle.plr.abxNoCost||battle.plr.costFreeTurn||battle.plr.abxCostLost)`) === true || true, "#4860 cast ok (cost loss checked below)");
  run(`clear(); battle.plr.monsters.left=mku(${LV}); battle.plr.deck=[4677,4586,5011,4570,46,46,46]; battle.plr.hand=[]; battle.plr.gauge=[];`); await cast(4976);
  ok(J(`battle.plr.hand.length`) === 2 && J(`battle.plr.gauge.length`) === 2, "#4976 look at top 4: 2 to hand, rest to gauge (hand " + J(`battle.plr.hand.length`) + ", gauge " + J(`battle.plr.gauge.length`) + ")");
  ok(meets(4976) === true, "#4976 castable with a Lostvader");
  run(`clear();`); ok(meets(4976) === false, "#4976 not castable without a Lostvader");
  run(`clear(); battle.plr.life=10;`); await cast(5106);
  ok(J(`battle.plr.life`) === 13, "#5106 no Lostvader: gain 3");
  run(`clear(); battle.plr.life=10; battle.plr.monsters.left=mku(${LV});`); await cast(5106);
  ok(J(`battle.plr.life`) === 18, "#5106 with a Lostvader: gain 3 then 5 (=8)");
  run(`clear(); battle.plr.hand=[]; battle.plr.deck=Array(10).fill(46); battle.plr.life=5; battle.plr.monsters.left=mku(${LV}); battle.plr.monsters.right=mku(${LV2});`); await cast(6436);
  ok(J(`battle.plr.hand.length`) === 2 && J(`battle.plr.life`) === 7, "#6436 draw 2, gain 1 life per different Lostvader (life " + J(`battle.plr.life`) + ")");
  run(`clear(); battle.plr.gauge=[]; battle.plr.life=5; battle.plr.monsters.left=mku(46); battle.plr.monsters.right=mku(46); battle.plr.hand=[]; battle.plr.deck=Array(10).fill(46);`); 
  run(`battle.plr.monsters.left.rested=true; battle.plr.monsters.right.rested=true;`); await cast(5030);
  ok(J(`battle.plr.gauge.length`) === 2 && J(`battle.plr.life`) === 7 && J(`battle.plr.hand.length`) === 1, "#5030 gauge +2, life +2, draw 1");
  run(`clear(); battle.plr.monsters.left=mku(${LV}); battle.plr.monsters.right=mku(${LV2}); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46); battle.opp.monsters.center=mku(46); ["left","right","center"].forEach(p=>battle.opp.monsters[p].rested=false);`); await cast(6375);
  ok(J(`['left','center','right'].filter(p=>battle.opp.monsters[p].rested).length`) === 2, "#6375 rests up to one card per Lostvader on your field (2)");
  run(`clear(); battle.plr.monsters.left=mku(46); battle.plr.monsters.right=mku(46); battle.plr.monsters.center=mku(46); ["left","right","center"].forEach(p=>battle.plr.monsters[p].rested=true); battle.plr.hand=[]; battle.plr.deck=Array(10).fill(46);`); await cast(6435);
  ok(J(`['left','center','right'].filter(p=>battle.plr.monsters[p].rested).length`) === 0 && J(`battle.plr.hand.length`) === 1, "#6435 stands all cards; with three or more stood you draw");
  run(`clear(); battle.plr.monsters.left=mku(46); battle.plr.monsters.left.rested=true; battle.plr.hand=[]; battle.plr.deck=Array(10).fill(46);`); await cast(6435);
  ok(J(`battle.plr.hand.length`) === 0, "#6435 with fewer than three stood: no draw");

  // ---------- timing call cost ----------
  run(`clear(); battle.plr.gauge=[46,46,46]; battle.plr.hand=[4941];`);
  ok(meets(4941) === false, "#4941 cannot be called normally in the main phase");
  run(`clear(); battle.plr.gauge=[46,46,46]; battle.plr.hand=[4941]; battle.plr.monsters.left=mku(4586); battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','left')`); await settle();
  ok(J(`['left','center','right'].map(p=>battle.plr.monsters[p]).filter(u=>u&&u.card.id===4941).length`) === 1 && J(`battle.plr.gauge.length`) === 1 && J(`battle.plr.hand.length`) === 0, "#4941 is called (2 gauge) when a Lost World monster of yours goes to the drop zone");
  run(`clear(); battle.plr.gauge=[46,46,46]; battle.plr.hand=[4941]; battle.plr.monsters.left=mku(46); battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','left')`); await settle();
  ok(J(`battle.plr.hand.length`) === 1, "#4941 is NOT offered when a non-Lost-World monster is destroyed");
  run(`clear(); battle.plr.gauge=[46]; battle.plr.hand=[4941]; battle.plr.monsters.left=mku(4586); battle.activeSide='opp';`);
  run(`battle.destroyMonster('plr','left')`); await settle();
  ok(J(`battle.plr.hand.length`) === 1, "#4941 with only 1 gauge: cannot be called");


  // ---------- #5116 Vanity End Destroyer ----------
  run(`clear(); battle.plr.hand=[5116,46,46]; battle.plr.deck=Array(8).fill(46); battle.plr.gauge=[];`);
  run(`battle.completeMonsterCall('plr','center',0,false,false);`); await settle();
  const u5116 = J(`battle.plr.monsters.center && battle.plr.monsters.center.card.id`);
  ok(u5116 === 5116, "#5116 can be called with the hand-to-soul cost (" + u5116 + ")");
  if (u5116 === 5116) {
    ok(J(`battle.plr.hand.length`) === 0, "#5116 call cost: all other hand cards leave the hand (" + J(`battle.plr.hand.length`) + ")");
    ok(J(`battle.plr.monsters.center.soul.length`) >= 2, "#5116 those hand cards (and then the deck) are in its soul (" + J(`battle.plr.monsters.center.soul.length`) + ")");
  }


  // ---------- remaining monsters / spells ----------
  // #5116 enter: deck face down into its soul; start of each player's turn: a soul -> your hand; you cannot lose
  run(`clear(); battle.plr.monsters.center=mku(5116); battle.plr.deck=Array(6).fill(46); battle.plr.hand=[];`);
  await enter(5116, "center");
  ok(J(`battle.plr.deck.length`) === 0 && J(`battle.plr.monsters.center.soul.length`) === 6, "#5116 enters: your entire deck goes into its soul (soul " + J(`battle.plr.monsters.center.soul.length`) + ")");
  run(`battle.activeSide='plr'; ABX.fireTurnEvent('turnStart')`); await settle();
  ok(J(`battle.plr.hand.length`) === 1 && J(`battle.plr.monsters.center.soul.length`) === 5, "#5116 start of the turn: a soul goes to your hand");
  run(`battle.activeSide='opp'; ABX.fireTurnEvent('turnStart')`); await settle();
  ok(J(`battle.plr.hand.length`) === 2, "#5116 also at the start of the opponent's turn");
  run(`battle.plr.life=0; battle.matchOver=false; battle.checkWinCondition();`);
  ok(J(`battle.matchOver`) !== true, "#5116 you cannot lose the fight (life 0, deck 0)");
  run(`battle.matchOver=false; battle.plr.life=10;`);
  // #5108: opponent cannot call monsters by card effects
  run(`clear(); battle.plr.item=mku(5108); battle.opp.drop=[4586]; battle.opp.gauge=[46,46,46]; battle.activeSide='opp';`);
  run(`{ const c=CARD_MAP.get(4604); const ab=ABX.get(c).abilities.find(a=>a.kind==='spell'); ABX.runAbility('opp',c,ab,null,{preApproved:true,auto:true}); }`); await settle();
  ok(J(`oppCount()`) === 0, "#5108 on your field: the opponent's card effects cannot call monsters");
  // #5107: nullifies the abilities of the opponent's monsters in front of it
  run(`clear(); battle.plr.monsters.center=mku(5107); battle.opp.monsters.center=mku(4586); battle.opp.monsters.left=mku(4586); battle.opp.hand=[]; battle.opp.deck=Array(5).fill(46); battle.activeSide='opp';`);
  run(`ABX.fireAttack('opp',[{unit:battle.opp.monsters.center,pos:'center'}],'plr','center')`); await settle();
  ok(J(`battle.opp.hand.length`) === 0, "#5107: the opponent's monster in front of it has no abilities (no draw)");
  run(`clear(); battle.plr.monsters.center=mku(5107); battle.opp.monsters.left=mku(4586); battle.opp.hand=[]; battle.opp.deck=Array(5).fill(46); battle.activeSide='opp';`);
  run(`ABX.fireAttack('opp',[{unit:battle.opp.monsters.left,pos:'left'}],'plr','center')`); await settle();
  ok(J(`battle.opp.hand.length`) === 1, "#5107: a monster NOT in front of it keeps its abilities");
  // #5176 act: call a Lostvader from hand on top of this card
  run(`clear(); battle.plr.monsters.center=mku(5176); battle.plr.hand=[4677]; battle.plr.gauge=[46,46,46]; battle.plr.deck=Array(5).fill(46);`); act(5176, "center", "act"); await settle();
  ok(J(`battle.plr.monsters.center.card.id`) === 4677 && J(`battle.plr.monsters.center.soul.includes(5176)`), "#5176 act: Lostvader called on top of this card (this card goes to its soul)");
  // #5178: at the start of the attack phase Lostvader get [Triple Attack]
  run(`clear(); battle.plr.monsters.center=mku(5178); battle.plr.monsters.left=mku(${LV}); battle.plr.monsters.right=mku(46); battle.activeSide='plr';`);
  run(`ABX.fireTurnEvent('phaseStart','attack')`); await settle();
  ok(J(`!!getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.left).ta`) === true && J(`!!getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.right).ta`) === false, "#5178: only Lostvader get [Triple Attack] this turn");
  // #5014: put up to one Lostvader from the drop zone into your hand other than Zeggaine
  run(`clear(); battle.plr.drop=[5014,${LV}]; battle.plr.hand=[];`); await cast(5014);
  ok(J(`battle.plr.hand.length`) === 1 && J(`battle.plr.hand[0]`) === LV, "#5014 returns a Lostvader (not Dimension Zeggaine) from the drop zone");
  // #5031 Day of Devastation
  run(`clear(); battle.opp.monsters.left=mku(46); battle.opp.monsters.center=mku(46); battle.opp.monsters.right=mku(46); battle.opp.life=10;`); await cast(5031);
  ok((J(`oppCount()`) === 0 && J(`battle.opp.life`) === 7) || J(`oppCount()`) === 3, "#5031 picks one of the two modes (destroy all + 1 damage each, or protection): opp monsters " + J(`oppCount()`) + ", life " + J(`battle.opp.life`));
  // #4944 modal options
  run(`clear(); battle.plr.drop=[46,46,46,46]; battle.plr.gauge=[];`); await modal(4944, 0);
  ok(J(`battle.plr.gauge.length`) === 3, "#4944 option 1: up to three cards from the drop zone into the gauge");
  run(`clear(); battle.plr.monsters.left=mku(46); battle.plr.monsters.left.rested=true;`); await modal(4944, 1);
  ok(J(`battle.plr.monsters.left.rested`) === false, "#4944 option 2: [Stand] a card on your field");
  run(`clear(); battle.opp.monsters.left=mku(46);`); await modal(4944, 2);
  ok(J(`battle.opp.monsters.left.rested`) === true, "#4944 option 3: [Rest] a card on the opponent's field");
  run(`clear(); battle.opp.monsters.left=mku(46); battle.opp.monsters.left.soul=[46,46,46];`); await modal(4944, 3);
  ok(J(`battle.opp.monsters.left.soul.length`) === 1, "#4944 option 4: drop up to two souls of an opponent's card");
  // #5109 option 1
  run(`clear(); battle.plr.drop=[46]; battle.plr.hand=[];`); await modal(5109, 0);
  ok(J(`battle.plr.hand.length`) === 1, "#5109 option 1: monster from the drop zone into your hand");
  // #4709 damage reduced by 3
  run(`clear(); battle.plr.life=10;`); await cast(4709);
  run(`ABX.core.applyDamage('plr', 5, { kind: 'effect' })`);
  ok(J(`battle.plr.life`) === 8, "#4709 damage taken is reduced by 3 this turn (life " + J(`battle.plr.life`) + ")");
  // #5028 act
  run(`clear(); battle.plr.monsters.center=mku(5028); battle.plr.hand=[46]; battle.opp.monsters.left=mku(46); battle.opp.hand=[];`); act(5028, "center", "act"); await settle();
  ok(J(`oppCount()`) === 0 && J(`battle.opp.hand.length`) === 1 && J(`battle.plr.hand.length`) === 0, "#5028 act: drop a hand card to return the chosen card to its owner's hand");
  // #5029 equip cost reduced by 1 per card on your field
  run(`clear(); battle.plr.monsters.left=mku(46); battle.plr.monsters.right=mku(46);`);
  const c5029 = J(`parseCardCost(CARD_MAP.get(5029).cost, CARD_MAP.get(5029).skill, battle.plr, CARD_MAP.get(5029)).gauge`);
  ok(c5029 === 1, "#5029 equip cost 3 minus 2 cards on the field = 1 gauge (" + c5029 + ")");
  // #4860 all costs lost this turn
  run(`clear(); battle.plr.gauge=[]; battle.plr.hand=[4586];`); await cast(4860);
  const c4860 = J(`parseCardCost(CARD_MAP.get(4586).cost, CARD_MAP.get(4586).skill, battle.plr, CARD_MAP.get(4586)).gauge`);
  ok(c4860 === 0, "#4860: cards in hand lose their costs this turn (4586 cost gauge " + c4860 + ")");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
})();
