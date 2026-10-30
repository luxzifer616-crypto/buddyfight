// [Overturn]/[Overkill]/[Overthrow]: using one must be recorded so "if you used [Overturn]" cards work; once per GAME not per copy.
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.clear=()=>{ for (const f of [battle.plr,battle.opp]) { ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.overturnUsed=false; f.overUsed={}; if (f.abx) f.abx.onceGame={}; } };`);
const settle = async () => { for (let i = 0; i < 40; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
(async () => {
  // 1. running a real [Overturn] / [Overkill] act records it (kind-aware)
  run(`clear(); battle.plr.monsters.center=mku(5357); battle.activeSide='plr'; battle.phase='main';
    { const c=CARD_MAP.get(5357); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); ABX.core.markOnce(battle.plr,c,ab,battle.plr.monsters.center); }`);
  ok(J(`battle.plr.overturnUsed`) === true && J(`battle.plr.overUsed.overkill`) === true && J(`!!battle.plr.overUsed.overturn`) === false, "#5357 Overkill sets overturnUsed + overUsed.overkill only");
  // 2. "if you used [Overturn] or [Overthrow]" is NOT satisfied by [Overkill], but is by [Overturn]
  const cond = (kinds) => J(`ABX.evalCond({t:'xOverturnUsed',kinds:${JSON.stringify(kinds)}},{side:'plr',f:battle.plr,e:battle.opp,bind:{}})`);
  ok(cond(["overturn", "overthrow"]) === false, "Overkill alone does not count as [Overturn]/[Overthrow]");
  run(`battle.plr.overUsed.overturn=true`);
  ok(cond(["overturn", "overthrow"]) === true, "[Overturn] used satisfies 'used [Overturn] or [Overthrow]'");
  // 3. cast restriction text variants now parse a condition (#3840 'this game', #5678 / #6331 'this fight')
  for (const id of [3840, 5678, 6331]) {
    const rule = J(`ABX.get(CARD_MAP.get(${id})).abilities.find(a=>a.kind==='rule')`);
    ok(rule && (rule.conds || []).some(c => JSON.stringify(c).includes("xOverturnUsed")), `#${id} 'only cast if you used [Overturn]' has a condition`);
  }
  // 4. once per GAME survives the unit leaving and the card being called again
  run(`clear(); battle.plr.monsters.center=mku(5357); battle.activeSide='plr'; battle.phase='main';
    { const c=CARD_MAP.get(5357); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'); globalThis.__ab=ab; ABX.core.markOnce(battle.plr,c,ab,battle.plr.monsters.center); }`);
  run(`battle.plr.monsters.center=mku(5357);`); // a fresh unit object (card destroyed and called again)
  ok(J(`ABX.core.onceUsed(battle.plr,CARD_MAP.get(5357),__ab,battle.plr.monsters.center)`) === true, "#5357 Overkill stays used after the card is re-called");
  // 5. #4764 Monster call cost -4 only after [Overturn]; #4154 Impact reduction is kind-aware
  run(`clear();`);
  const g = () => J(`parseCardCost(CARD_MAP.get(4764).cost, CARD_MAP.get(4764).skill, battle.plr, CARD_MAP.get(4764)).gauge`);
  ok(g() === 4, "#4764 costs 4 gauge before [Overturn]");
  run(`battle.plr.overturnUsed=true; battle.plr.overUsed={overkill:true}`);
  ok(g() === 4, "#4764 not reduced by [Overkill]");
  run(`battle.plr.overUsed={overturn:true}`);
  ok(g() === 0, "#4764 costs 0 gauge after [Overturn]");
  // 6. #3822 Overturn: link attacks of this card cannot be nullified this turn (a single attack still can be)
  run(`clear(); battle.plr.monsters.center=mku(3822); battle.plr.monsters.left=mku(46); battle.activeSide='plr'; battle.phase='attack';
    (async()=>{ const c=CARD_MAP.get(3822); const ab=ABX.get(c).abilities.find(a=>(a.tags||[]).some(t=>/over/.test(t))); await ABX.runAbility('plr',c,ab,battle.plr.monsters.center,{preApproved:true,auto:true,event:{name:'act'}}); })()`);
  await settle();
  const unl = (u) => J(`!!ABX.attackUnnullifiable({attSide:'plr',defSide:'opp',attUnits:[${u.map(p => `battle.plr.monsters.${p}`).join(",")}]})`);
  ok(unl(["center", "left"]) === true, "#3822 link attack cannot be nullified");
  ok(unl(["center"]) === false, "#3822 a non-link attack can still be nullified");
  // 7. #4112 Gedomaru Overkill: up to three deck cards go face down into its soul (a face-down FILTER matched nothing)
  run(`clear(); battle.plr.monsters.center=mku(4112); battle.plr.deck=ALL_CARDS.filter(c=>c.type==='Monster').slice(0,10); battle.activeSide='opp'; battle.phase='attack';
    (async()=>{ const c=CARD_MAP.get(4112); const ab=ABX.get(c).abilities.find(a=>(a.tags||[]).some(t=>/over/.test(t))); await ABX.runAbility('plr',c,ab,battle.plr.monsters.center,{preApproved:true,auto:true,event:{name:'act'}}); })()`);
  await settle();
  ok(J(`battle.plr.monsters.center.soul.length`) === 3 && J(`battle.plr.deck.length`) === 7, "#4112 puts three deck cards into its soul");
  // 8. #4179 Overturn: call an impact monster from the deck by paying its [Call Cost] (generic call step ignored impact monsters)
  {
    const im = J(`ALL_CARDS.filter(c=>c.type==='Impact'&&IMX.isImpactMonster(c)&&IMX.get(c).requirements.length===0&&IMX.get(c).call.parts.length===0&&IMX.get(c).call.gauge<=2&&!IMX.get(c).call.onlyByEffect)[0].id`);
    run(`clear(); battle.plr.monsters.center=mku(4179); battle.plr.deck=[${im}].concat(ALL_CARDS.filter(c=>c.type==='Monster').slice(0,5).map(c=>c.id)); battle.plr.gauge=ALL_CARDS.slice(0,6).map(c=>c.id); battle.turnCount=5; battle.activeSide='plr'; battle.phase='final';
      (async()=>{ const c=CARD_MAP.get(4179); const ab=ABX.get(c).abilities.find(a=>(a.tags||[]).some(t=>/over/.test(t))); await ABX.runAbility('plr',c,ab,battle.plr.monsters.center,{preApproved:true,auto:true,event:{name:'act'}}); })()`);
    await settle();
    ok(J(`["left","center","center2","right"].some(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id===${im})`) === true && J(`battle.plr.gauge.length`) < 6, "#4179 calls an impact monster from the deck and pays its gauge");
  }
  // 9. [Overturn]/[Overkill] timing in the cost bracket is enforced (it was dropped, so they worked in any phase / turn)
  const can = (id, side, phase) => J(`(()=>{ for (const f of [battle.plr,battle.opp]) {["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.life=10; f.gauge=ALL_CARDS.slice(0,8).map(c=>c.id); f.hand=ALL_CARDS.slice(0,5).map(c=>c.id); f.deck=ALL_CARDS.slice(0,20).map(c=>c.id); if(f.abx) f.abx.onceGame={}; }
    battle.plr.monsters.center=mku(${id}); battle.opp.monsters.center=mku(46); battle.turnCount=5; battle.activeSide='${side}'; battle.phase='${phase}';
    const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(a=>a.kind==='act'&&(a.tags||[]).some(t=>/over/.test(t))); return ABX.canUseAct('plr',c,ab,battle.plr.monsters.center).ok; })()`);
  ok(can(4092, "plr", "main") === true && can(4092, "plr", "attack") === false && can(4092, "opp", "main") === false, "#4092 Overkill only in your main phase");
  ok(can(4179, "plr", "final") === true && can(4179, "plr", "main") === false, "#4179 Overturn only in your final phase");
  ok(can(3596, "plr", "attack") === true && can(3596, "plr", "main") === false && can(3596, "opp", "attack") === false, "#3596 Overturn only in your attack phase");
  ok(can(3617, "plr", "main") === true && can(3617, "opp", "attack") === false, "#3617 Overturn only during your turn");
  ok(can(4019, "opp", "attack") === true && can(4019, "plr", "attack") === false, "#4019 Overkill only in your opponent's attack phase");
  ok(can(3745, "plr", "attack") === true && can(3745, "plr", "main") === false, "#3745 'at the beginning of your attack phase' only in your attack phase");
  console.log(fail ? "fail " + fail : "fail 0"); process.exit(fail ? 1 : 0);
})();
