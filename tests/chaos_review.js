// Fixes from the Opus review of the Chaos tribe (each verified against the engine first).
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.clear=()=>{ for (const f of [battle.plr,battle.opp]) { ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.item=null; f.hand=[]; f.drop=[]; f.life=10; } battle.plr.gauge=battle.plr.deck.splice(0,8); battle.matchOver=false; };
 globalThis.offered=(id,pos)=>{ clear(); const f=battle.plr,e=battle.opp; f.monsters.center=mku(46); f.monsters.left=mku(46); e.monsters.center=mku(46); f.hand=[id]; battle.activeSide="opp"; battle.phase="attack"; battle.turnCount=6;
   return battle.getAvailableDefenseCards("plr",false,pos,[e.monsters.center]).filter(o=>o.card&&o.card.id===id&&!o.fieldKey).length; };`);
const settle = async () => { for (let i = 0; i < 40; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
(async () => {
  // #3820 / #2886: only when the CENTER monster is being attacked
  ok(J(`offered(3820,"center")`) === 1, "#3820 Isolation Barrier is offered when the center is attacked");
  ok(J(`offered(3820,"left")`) === 0, "#3820 Isolation Barrier is NOT offered when the left monster is attacked");
  const enter = async (id, pos) => { run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='triggered'&&a.trigger&&a.trigger.event==='enter'); ABX.runAbility('plr',c,ab,battle.plr.monsters.${pos},{event:{name:'enter'},preApproved:true,auto:true}); }`); await settle(); };
  const place = (pos, id) => run(`battle.plr.monsters.${pos}=mku(${id})`);

  // #4017 Mini Geargod Silver: only monsters with "Mini Geargod" in the name get power+3000 and [Penetrate]
  const mini = J(`ALL_CARDS.find(c=>c.type==='Monster'&&/mini geargod/i.test(c.name)&&c.id!==4017).id`);
  run(`clear()`); place("center", 4017); place("left", mini); place("right", 46);
  await enter(4017, "center");
  const st = J(`["left","center","right"].map(p=>{const u=battle.plr.monsters[p];return [u.tempPower,!!u.tempPen]})`);
  ok(st[0][0] === 3000 && st[0][1] && st[1][0] === 3000 && st[2][0] === 0 && !st[2][1], `#4017 only 'Mini Geargod' monsters get power+3000 and [Penetrate] (${JSON.stringify(st)})`);

  // #3939: "give a buddy on your field power+5000 and [Penetrate]" -> only the buddy
  run(`clear()`); const bid = J(`battle.plr.buddyId`); place("left", bid); place("right", 46);
  run(`{ const c=CARD_MAP.get(3939); const m=ABX.get(c).abilities.find(a=>a.kind==='modal'); ABX.runAbility('plr',c,m.options[0],null,{preApproved:true,auto:true}); }`); await settle();
  ok(J(`battle.plr.monsters.left.tempPower`) === 5000 && J(`battle.plr.monsters.right.tempPower`) === 0, "#3939 buddy-only boost: the buddy gets +5000, the other monster does not");

  // #3370 CHAOS Beimder: critical+1 for each monster among the 4 milled cards
  run(`clear(); { const mon=ALL_CARDS.filter(c=>c.type==='Monster').slice(0,2).map(c=>c.id), sp=ALL_CARDS.filter(c=>c.type==='Spell').slice(0,2).map(c=>c.id); battle.opp.deck=[mon[0],sp[0],mon[1],sp[1]].concat(battle.opp.deck); }`);
  place("center", 3370); await enter(3370, "center");
  ok(J(`battle.plr.monsters.center.tempCrit`) === 2, "#3370 gets critical+2 for 2 monsters among the 4 milled cards (got " + J(`battle.plr.monsters.center.tempCrit`) + ")");

  // #2189 / #4089: destroy a monster AND a spell on the opponent's field (two targets)
  const spellSet = J(`ALL_CARDS.find(c=>c.type==='Spell'&&c.set).id`);
  for (const [id, mon] of [[2189, J(`ALL_CARDS.find(c=>c.type==='Monster'&&c.size<=2&&(c.power||0)<5000).id`)], [4089, J(`ALL_CARDS.find(c=>c.type==='Monster'&&(c.power||0)>=5000).id`)]]) {
    run(`clear(); battle.opp.monsters.center=mku(${mon}); battle.opp.setSpells=[CARD_MAP.get(${spellSet})]; battle.plr.monsters.left=mku(46);`);
    run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='spell'); ABX.runAbility('plr',c,ab,null,{preApproved:true,auto:true,event:{name:'counter'}}); }`); await settle();
    ok(J(`!battle.opp.monsters.center && battle.opp.setSpells.length===0`), `#${id} destroys BOTH the monster and the spell`);
  }

  // #3754 CHAOS Orser Kleinz: two monsters AND a spell go to the bottom of the deck, then gauge +1, life +1, draw 1
  run(`clear(); { const mon=ALL_CARDS.filter(c=>c.type==='Monster').slice(0,3).map(c=>c.id), sp=ALL_CARDS.find(c=>c.type==='Spell').id; battle.plr.drop=[mon[0],mon[1],mon[2],sp]; globalThis.__g=battle.plr.gauge.length; globalThis.__l=battle.plr.life; }`);
  place("center", 3754); await enter(3754, "center");
  ok(J(`battle.plr.drop.length===1 && CARD_MAP.get(battle.plr.drop[0]).type==='Monster'`), "#3754 puts two monsters AND a spell from the drop zone on the bottom of the deck (drop left: " + J(`battle.plr.drop.length`) + ")");
  ok(J(`battle.plr.gauge.length===__g+1 && battle.plr.life===__l+1`), "#3754 then gauge +1 and life +1");

  // #3933: "If this card has souls, it gets critical+1 and [Penetrate]" (continuous, this card only)
  run(`clear(); battle.plr.monsters.center=mku(3933); battle.plr.monsters.left=mku(46);`);
  const noSoul = J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center)`);
  run(`battle.plr.monsters.center.soul=[46]`);
  const soul = J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.center)`);
  const other = J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.monsters.left)`);
  ok(soul.crit === noSoul.crit + 1 && soul.pen === true && noSoul.pen !== true && other.crit === 1, `#3933 gets critical+1 and [Penetrate] only while it has souls (${noSoul.crit}->${soul.crit}, pen ${noSoul.pen}->${soul.pen})`);


  // #3441 Soul Reset: ALL souls from a card on the opponent's field, then draw
  run(`clear(); battle.plr.deck=Array(30).fill(46); battle.plr.monsters.left=mku(46); battle.plr.monsters.center=mku(46); battle.plr.monsters.right=mku(46); battle.opp.monsters.center=mku(46); battle.opp.monsters.center.soul=[46,46,46]; globalThis.__h=battle.plr.hand.length; globalThis.__d=battle.opp.drop.length;`);
  run(`{ const c=CARD_MAP.get(3441); const ab=ABX.get(c).abilities.find(a=>a.kind==='spell'); ABX.runAbility('plr',c,ab,null,{preApproved:true,auto:true}); }`); await settle();
  ok(J(`battle.opp.monsters.center.soul.length`) === 0 && J(`battle.opp.drop.length`) === J(`__d`) + 3 && J(`battle.plr.hand.length`) === J(`__h`) + 1, "#3441 Soul Reset drops ALL 3 souls, then you draw");

  // #3195 / #3373: "when this card enters the field on your left or right, if you have a monster on your center ..."
  const enterAt = async (id, pos) => { run(`clear(); battle.plr.deck=Array(30).fill(46); battle.plr.monsters.center=mku(46); ${pos !== "center" ? `battle.plr.monsters.${pos}=mku(${id});` : `battle.plr.monsters.center=mku(${id}); battle.plr.monsters.center2=mku(46);`} globalThis.__h=battle.plr.hand.length; ABX.fireEnter('plr', CARD_MAP.get(${id}), battle.plr.monsters.${pos});`); await settle(); return J(`battle.plr.hand.length`) - J(`__h`); };
  ok(await enterAt(3195, "left") === 1, "#3195 enters on the LEFT with a center monster: draws a card");
  ok(await enterAt(3195, "center") === 0, "#3195 enters on the CENTER: does nothing");

  // #3409 Chaos Ejecter: power+2000 for each monster on your center
  const pw = (n) => { run(`clear(); battle.plr.deck=Array(30).fill(46); battle.plr.item=mku(3409); ${n >= 1 ? "battle.plr.monsters.center=mku(46);" : ""} ${n >= 2 ? "battle.plr.monsters.center2=mku(46);" : ""}`); return J(`getUnitEffectiveCombatStats(battle.plr, battle.plr.item).power`); };
  const base = pw(0);
  ok(pw(1) === base + 2000 && pw(2) === base + 4000, `#3409 power+2000 per center monster (${base} / ${pw(1)} / ${pw(2)})`);

  // #3850 / #3852 Mini Geargod: paying is optional and moving itself to the drop zone only happens if you paid
  for (const [id, target] of [[3852, "item"], [3850, "set"]]) {
    for (const gauge of [0, 3]) {
      run(`clear(); battle.plr.deck=Array(30).fill(46); battle.plr.gauge=battle.plr.deck.splice(0,${gauge}); battle.plr.monsters.left=mku(${id}); ${target === "item" ? "battle.opp.item=mku(3409);" : `battle.opp.setSpells=[CARD_MAP.get(${spellSet})];`} battle.activeSide='plr'; battle.phase='main';
        { const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); ABX.runAbility('plr',c,ab,battle.plr.monsters.left,{preApproved:true,auto:true}); }`); await settle();
      const stayed = J(`!!battle.plr.monsters.left`), destroyed = J(target === "item" ? `!battle.opp.item` : `battle.opp.setSpells.length===0`);
      if (gauge === 0) ok(stayed && !destroyed, `#${id} cannot pay: it stays on the field and destroys nothing`);
      else ok(!stayed && destroyed, `#${id} pays 1 gauge: it goes to the drop zone and destroys the chosen card`);
    }
  }
  const s51 = J(`(function(){const st=ABX.get(CARD_MAP.get(3851)).abilities.find(a=>a.kind==='triggered').steps;return {pay:st.find(x=>x.op==='pay'),mv:st.find(x=>x.op==='move')}})()`);
  ok(s51.pay.optional === true && s51.pay.gate === "ifYouDo" && s51.mv.gate === "ifYouDo", "#3851 pay is optional and the self-move only follows a payment");

  console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
})();
