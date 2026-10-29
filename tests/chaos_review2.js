// Chaos review wave 3: "if attacking alone" must be kept when the ability also has an "If you have..." condition.
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.clear=()=>{ for (const f of [battle.plr,battle.opp]) { ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.hand=[]; f.drop=[]; f.life=10; f.deck=Array(30).fill(46); f.gauge=[46,46,46,46,46,46]; } };`);
const settle = async () => { for (let i = 0; i < 40; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
(async () => {
  const chaos = J(`ALL_CARDS.filter(c=>c.type==='Monster'&&(c.attrs||[]).some(a=>/^chaos$/i.test(a))&&c.id!==3369&&c.size<=3).slice(0,4).map(c=>c.id)`);
  // #3369: 4+ Chaos monsters -> attack unnullifiable, but ONLY when attacking alone
  run(`clear(); battle.plr.monsters.center=mku(3369); battle.plr.monsters.left=mku(${chaos[0]}); battle.plr.monsters.right=mku(${chaos[1]}); battle.plr.monsters.center2=mku(${chaos[2]});`);
  const un = (units) => !!J(`ABX.attackUnnullifiable({attSide:'plr',defSide:'opp',attUnits:[${units.map(p => `battle.plr.monsters.${p}`).join(",")}]})`);
  ok(un(["center"]) === true, "#3369 with 4 Chaos monsters attacking alone: cannot be nullified");
  ok(un(["center", "left"]) === false, "#3369 attacking together with another monster: CAN be nullified");
  run(`battle.plr.monsters.center2=null;`);
  ok(un(["center"]) === false, "#3369 only 3 Chaos monsters: can be nullified");

  // #4050 Beleth: 3+ critical -> damage cannot be reduced, only when attacking alone
  run(`clear(); battle.plr.monsters.center=mku(4050); battle.plr.monsters.left=mku(46); battle.plr.monsters.right=mku(46); battle.plr.monsters.center2=mku(46);`);
  const ur = (units) => J(`ABX.attackUnreducible('plr',[${units.map(p => `battle.plr.monsters.${p}`).join(",")}])`);
  ok(ur(["center"]) === true, "#4050 with 3+ critical attacking alone: damage cannot be reduced");
  ok(ur(["center", "left"]) === false, "#4050 not alone: damage can be reduced");

  // #3915 / #4092 Overkill acts: the "cannot be nullified if attacking alone" half must apply
  run(`clear(); battle.plr.monsters.center=mku(3915); battle.plr.monsters.left=mku(46); battle.activeSide='plr'; battle.phase='main';
    { const c=CARD_MAP.get(3915); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); ABX.runAbility('plr',c,ab,battle.plr.monsters.center,{preApproved:true,auto:true}); }`); await settle();
  ok(J(`battle.plr.monsters.center.tempCrit`) === 4 && un(["center"]) === true && un(["center", "left"]) === false, "#3915 Overkill: critical+4 and unnullifiable only while attacking alone");
  run(`clear(); battle.plr.monsters.center=mku(4092); battle.plr.monsters.left=mku(46); battle.activeSide='plr'; battle.phase='main';
    { const c=CARD_MAP.get(4092); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); ABX.runAbility('plr',c,ab,battle.plr.monsters.center,{preApproved:true,auto:true}); }`); await settle();
  const ch = J(`['center','left'].filter(p=>battle.plr.monsters[p].abxUnnull)`);
  ok(ch.length === 1, "#4092 Overkill: exactly the chosen monster gets the unnullifiable-when-alone effect (" + ch + ")");
  if (ch.length === 1) ok(un([ch[0]]) === true && un(["center", "left"]) === false, "#4092 chosen monster: unnullifiable alone, nullifiable in a link attack");


  const oppDestroy = J(`ALL_CARDS.find(c=>c.type==='Spell'&&!c.set&&/destroy a monster on your opponent's field/i.test(c.skill||'')&&ABX.get(c).abilities.filter(a=>a.kind==='spell').length===1&&ABX.get(c).abilities.find(a=>a.kind==='spell').steps.length===1&&ABX.get(c).abilities.find(a=>a.kind==='spell').steps[0].op==='destroy').id`);
  const effDestroy = () => { run(`{ const c=CARD_MAP.get(${oppDestroy}); const ab=ABX.get(c).abilities.find(a=>a.kind==='spell'); ABX.runAbility('opp',c,ab,null,{preApproved:true,auto:true}); }`); return settle(); };
  const act = (id, unitPos, kind) => run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='${kind || "act"}'); ABX.runAbility('plr',c,ab,${unitPos ? `battle.plr.monsters.${unitPos}` : "null"},{preApproved:true,auto:true}); }`);

  // #5357 Overkill: [Stand] all Chaos, they get critical+1, and another attack phase
  run(`clear(); battle.plr.monsters.center=mku(5357); battle.plr.monsters.left=mku(2804); battle.plr.monsters.right=mku(46); ["center","left","right"].forEach(p=>battle.plr.monsters[p].rested=true);`);
  act(5357, "center"); await settle();
  const r57 = J(`({cl:[battle.plr.monsters.left.rested, battle.plr.monsters.center.rested], lc:battle.plr.monsters.left.tempCrit, rc:battle.plr.monsters.right.tempCrit, rr:battle.plr.monsters.right.rested, x:battle.plr.abxExtraAttack&&battle.plr.abxExtraAttack.n})`);
  ok(r57.cl[0] === false && r57.cl[1] === false, "#5357 stands all Chaos monsters on your field (" + JSON.stringify(r57.cl) + ")");
  ok(r57.lc === 1 && r57.rc === 0 && r57.rr === true, "#5357 only Chaos monsters get critical+1 / stand " + JSON.stringify(r57));
  ok(r57.x === 1, "#5357 you get another attack phase");

  // #5710 size reduction only if your flag is "Dungeon World"
  const dl = J(`ALL_CARDS.find(c=>c.type==='Monster'&&c.size===3&&(c.attrs||[]).includes('DemonLord')&&c.id!==5710).id`);
  run(`clear(); battle.plr.monsters.center=mku(5710); battle.plr.monsters.left=mku(${dl});`);
  const sz = () => J(`ABX.sizeDelta(battle.plr, CARD_MAP.get(${dl}), battle.plr.monsters.left)`);
  ok(sz() === 0, "#5710 with the Chaos flag: other Demon Lords are NOT reduced (" + sz() + ")");
  run(`battle.plr.flagId=198;`);
  ok(sz() === -3, "#5710 with the Dungeon World flag: other Demon Lords are reduced by 3 (" + sz() + ")");

  // #4091: only a called Demon Lord becomes size 0
  const dlh = dl;
  run(`clear(); battle.plr.monsters.center=mku(4091); battle.plr.hand=[${dlh}]; battle.plr.gauge=Array(6).fill(46);`);
  act(4091, "center", "triggered"); await settle();
  const called = J(`['left','right','center2'].map(p=>battle.plr.monsters[p]).filter(Boolean)`);
  ok(called.length === 1, "#4091 calls the Demon Lord from hand (" + called.length + " called)");
  if (called.length) ok(J(`ABX.sizeDelta(battle.plr, CARD_MAP.get(${dlh}), ['left','right','center2'].map(p=>battle.plr.monsters[p]).find(Boolean))`) <= -3, "#4091 the called Demon Lord is size 0");
  const nd = J(`ALL_CARDS.find(c=>c.type==='Monster'&&c.size===1&&!(c.attrs||[]).includes('DemonLord')&&(c.attrs||[]).includes('Chaos')).id`);
  run(`clear(); battle.plr.monsters.center=mku(4091); battle.plr.hand=[${nd}]; battle.plr.gauge=Array(6).fill(46);`);
  act(4091, "center", "triggered"); await settle();
  const u2 = J(`['left','right','center2'].map(p=>battle.plr.monsters[p]).filter(Boolean).map(u=>!!u.abxSize0)`);
  ok(u2.length === 1 && u2[0] === false, "#4091 a called non-Demon-Lord (Chaos) does NOT become size 0 (" + JSON.stringify(u2) + ")");

  // #4019 Arabone Overkill: nullify AND destroy the SAME chosen card (the other one is untouched)
  run(`clear(); battle.plr.monsters.center=mku(4019); battle.opp.monsters.left=mku(46); battle.opp.monsters.right=mku(46);`);
  act(4019, "center"); await settle();
  ok(J(`['left','right'].filter(p=>battle.opp.monsters[p]).length`) === 1, "#4019 destroys exactly one opponent card");

  // #3741 Death Tallica: would leave -> put 3 monsters from drop on the bottom of the deck, remains on the field
  run(`clear(); battle.plr.monsters.center=mku(3741); battle.plr.drop=[46,46,46,46]; globalThis.__dk=battle.plr.deck.length;`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`!!battle.plr.monsters.center && battle.plr.monsters.center.card.id===3741`) === true && J(`battle.plr.deck.length`) === J(`__dk`) + 3 && J(`battle.plr.drop.length`) === 1, "#3741 with 3+ monsters in the drop zone: moves 3 to the deck bottom and stays");
  run(`clear(); battle.plr.monsters.center=mku(3741); battle.plr.drop=[];`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`!battle.plr.monsters.center`) === true, "#3741 with nothing to put: it is destroyed normally");

  // #3737 Gravity Rest: a monster entering the OPPONENT's field -> pay 1 gauge + discard => [Rest] it
  run(`clear(); battle.plr.monsters.center=mku(3737); battle.plr.hand=[46]; battle.opp.monsters.left=mku(46); globalThis.__gg=battle.plr.gauge.length; ABX.fireOtherEnter('opp', battle.opp.monsters.left);`); await settle();
  ok(J(`battle.opp.monsters.left.rested`) === true && J(`battle.plr.gauge.length`) === J(`__gg`) - 1 && J(`battle.plr.hand.length`) === 0, "#3737 paying 1 gauge + discarding rests the entering monster");
  run(`clear(); battle.plr.monsters.center=mku(3737); battle.plr.hand=[]; battle.opp.monsters.left=mku(46); ABX.fireOtherEnter('opp', battle.opp.monsters.left);`); await settle();
  ok(J(`battle.opp.monsters.left.rested`) === false, "#3737 with no card to discard nothing is rested");
  run(`clear(); battle.plr.monsters.center=mku(3737); battle.plr.hand=[46]; battle.plr.monsters.left=mku(46); ABX.fireOtherEnter('plr', battle.plr.monsters.left);`); await settle();
  ok(J(`battle.plr.monsters.left.rested`) === false, "#3737 does not trigger for your OWN monster entering");


  // #3464 Nine-headed Dragon Sword: from the drop zone pay 1 gauge -> call it; at the end of the turn destroy it
  run(`clear(); battle.plr.drop=[3464]; battle.activeSide='plr'; battle.phase='main';
    { const c=CARD_MAP.get(3464); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); ABX.runAbility('plr',c,ab,null,{preApproved:true,auto:true,hostArea:'drop',selfRef:{k:'zone',side:'plr',area:'drop',idx:0,id:3464,card:c}}); }`); await settle();
  const sw = J(`['left','right','center','center2'].map(p=>battle.plr.monsters[p]).filter(u=>u&&u.card.id===3464).length`);
  ok(sw === 1 && J(`battle.plr.gauge.length`) === 5 && J(`battle.plr.drop.length`) === 1, "#3464 from the drop zone: pays 1 gauge and is called (called " + sw + ", gauge " + J(`battle.plr.gauge.length`) + ", drop " + J(`battle.plr.drop.length`) + ")");
  run(`ABX.fireTurnEvent('turnEnd')`); await settle();
  ok(J(`['left','right','center','center2'].map(p=>battle.plr.monsters[p]).filter(u=>u&&u.card.id===3464).length`) === 0, "#3464 is destroyed at the end of the turn");
  run(`clear(); battle.plr.drop=[3464]; battle.plr.gauge=[]; battle.activeSide='plr'; battle.phase='main';
    { const c=CARD_MAP.get(3464); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); ABX.runAbility('plr',c,ab,null,{preApproved:true,auto:true,hostArea:'drop',selfRef:{k:'zone',side:'plr',area:'drop',idx:0,id:3464,card:c}}); }`); await settle();
  ok(J(`['left','right','center','center2'].map(p=>battle.plr.monsters[p]).filter(Boolean).length`) === 0, "#3464 with no gauge to pay: not called");


  // ---- Overkill cards ----
  // #3594: all cards on your field (monsters AND the item) get critical+2
  run(`clear(); battle.plr.monsters.center=mku(3594); battle.plr.monsters.left=mku(46); battle.plr.item=mku(3409);`);
  act(3594, "center"); await settle();
  ok(J(`battle.plr.monsters.center.tempCrit`) === 2 && J(`battle.plr.monsters.left.tempCrit`) === 2 && J(`battle.plr.item.tempCrit`) === 2, "#3594 Overkill: critical+2 for every card on your field (incl. item)");
  // #3595: the chosen monster cannot be destroyed this turn
  run(`clear(); battle.plr.monsters.center=mku(3595); globalThis.__r=0;`);
  act(3595, "center"); await settle();
  await effDestroy();
  ok(J(`!!battle.plr.monsters.center`) === true, "#3595 Overkill: the chosen monster survives destruction this turn");
  // #3643: destroy a monster or item, then damage equal to its critical
  run(`clear(); battle.plr.monsters.center=mku(3643); battle.opp.monsters.center=mku(46); battle.opp.monsters.center.tempCrit=0; globalThis.__crit=ABX.core.statOf ? 0 : 0; globalThis.__l=battle.opp.life;`);
  act(3643, "center"); await settle();
  const crit46 = J(`CARD_MAP.get(46).crit`);
  ok(J(`!battle.opp.monsters.center`) === true && J(`__l - battle.opp.life`) === crit46, `#3643 destroys it and deals damage equal to its critical (${crit46}): lost ${J(`__l - battle.opp.life`)}`);
  // #3743: destroy all opp monsters, gain life equal to the number destroyed
  run(`clear(); battle.plr.monsters.center=mku(3743); battle.opp.monsters.left=mku(46); battle.opp.monsters.center=mku(46); battle.opp.monsters.right=mku(46); battle.plr.life=5;`);
  act(3743, "center"); await settle();
  ok(J(`['left','center','right'].filter(p=>battle.opp.monsters[p]).length`) === 0 && J(`battle.plr.life`) === 8, "#3743 destroys all 3 and gains 3 life (life " + J(`battle.plr.life`) + ")");

  // ---- replacement saves / triggers ----
  // #3769 Ladis: would be destroyed -> discard a monster from hand, stays on the field
  run(`clear(); battle.plr.monsters.center=mku(3769); battle.plr.hand=[46];`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`!!battle.plr.monsters.center`) === true && J(`battle.plr.hand.length`) === 0, "#3769 discards a monster and remains on the field");
  run(`clear(); battle.plr.monsters.center=mku(3769); battle.plr.hand=[];`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`!battle.plr.monsters.center`) === true, "#3769 with no monster in hand it is destroyed");
  // #3976 Parasite Yggdrasil: size 3 monsters cannot be destroyed by opponent's effects; when destroyed by opp effect, monster from drop -> hand
  const sz3 = J(`ALL_CARDS.find(c=>c.type==='Monster'&&c.size===3&&c.id!==3976).id`);
  run(`clear(); battle.plr.setSpells=[CARD_MAP.get(3976)]; battle.plr.monsters.center=mku(${sz3});`);
  await effDestroy();
  ok(J(`!!battle.plr.monsters.center`) === true, "#3976 a size 3 monster cannot be destroyed by the opponent's effect (spell " + oppDestroy + ")");
  // #5344 Van Glacier: would leave by opponent's cards -> drop a hand card, stays
  run(`clear(); battle.plr.monsters.center=mku(5344); battle.plr.hand=[46]; battle.activeSide='opp';`);
  await effDestroy();
  ok(J(`!!battle.plr.monsters.center`) === true && J(`battle.plr.hand.length`) === 0, "#5344 destroyed by the opponent's card: drops a hand card and remains");
  run(`clear(); battle.plr.monsters.center=mku(5344); battle.plr.hand=[46]; battle.activeSide='plr';`);
  run(`battle.destroyMonster('plr','center')`); await settle();
  ok(J(`!battle.plr.monsters.center`) === true, "#5344 destroyed by your OWN effect/battle rule (not the opponent's card): not saved");

  // ---- continuous / noop ----
  // #4046 Chaos Arms: the host card (with it in its soul) gets power+3000 and [Penetrate]
  run(`clear(); battle.plr.monsters.center=mku(46); battle.plr.monsters.center.soul=[4046];`);
  const st46 = J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center)`);
  run(`clear(); battle.plr.monsters.center=mku(46);`);
  const st46b = J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center)`);
  ok(st46.power === st46b.power + 3000 && !!st46.pen && !st46b.pen, `#4046 host with Chaos Arms in its soul: power+3000 and [Penetrate] (${st46b.power} -> ${st46.power}, pen ${!!st46.pen})`);

  // #3929: with two or more Chaos monsters on your field the spell cannot be nullified; with fewer it can
  run(`clear(); battle.plr.monsters.left=mku(${chaos[0]}); battle.plr.monsters.right=mku(${chaos[1]});`);
  ok(J(`!!ABX.castUnnullifiable(CARD_MAP.get(3929), 'plr')`) === true, "#3929 with 2 Chaos on the field: cannot be nullified");
  run(`battle.plr.monsters.right=null;`);
  ok(J(`!!ABX.castUnnullifiable(CARD_MAP.get(3929), 'plr')`) === false, "#3929 with only 1 Chaos: can be nullified");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
})();
