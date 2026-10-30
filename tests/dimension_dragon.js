// Dimension Dragon ability fixes (review dd_review.md). Run: node tests/dimension_dragon.js
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 globalThis.clear=()=>{ for (const f of [battle.plr,battle.opp]) { ["left","center","center2","right"].forEach(p=>f.monsters[p]=null); f.item=null; f.setSpells=[]; f.hand=[]; f.drop=[]; f.life=10; f.deck=Array.from({length:30},(_,i)=>[46,4619,4621,4626,4628,4569][i%6]); f.gauge=[46,46,46,46,46,46]; } battle.activeSide="plr"; battle.phase="main"; battle.matchOver=false; battle.turnCount++; };`);
const settle = async () => { for (let i = 0; i < 60; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
const S = () => J(`({hand:battle.plr.hand,gauge:battle.plr.gauge.length,drop:battle.plr.drop,deck:battle.plr.deck.length,deckTop:battle.plr.deck.slice(0,6),deckBottom:battle.plr.deck.slice(-6),life:battle.plr.life,field:["left","center","right"].map(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id),oppField:["left","center","right"].map(p=>battle.opp.monsters[p]&&battle.opp.monsters[p].card.id),oppLife:battle.opp.life})`);
// run the ability of card `id` whose step ops include `op` (or the nth with kind)
const ab = async (id, pos, pred, side = "plr") => { run(`{ const c=CARD_MAP.get(${id}); const ab=ABX.get(c).abilities.find(${pred}); globalThis.__ctx=null; ABX.runAbility('${side}',c,ab,${pos ? (pos === "item" ? `battle.${side}.item` : `battle.${side}.monsters.${pos}`) : "null"},{auto:true}).then(x=>globalThis.__ctx=x); }`); await settle(); };
const hasLook = `a=>(a.steps||[]).some(s=>s.op==='look')`;

(async () => {
  // ---- group 1: «Dimension Dragon» or "Lost World" is a choice, rest goes where the card says even if nothing was picked
  const f1 = J(`ABX.get(CARD_MAP.get(4655)).abilities[0].steps[0].np.filter`);
  ck("g1 filter is anyOf", !!f1.anyOf && f1.anyOf.length === 2, f1);
  run(`clear(); battle.plr.deck=[46,4569,46,46,46,46,46,46,46]; battle.plr.monsters.center=mku(5807); `);
  // Lost World flag card 4569 must be pickable, a DD (4619) too
  run(`globalThis.__f=ABX.get(CARD_MAP.get(4655)).abilities[0].steps[0].np.filter; globalThis.__m=(id)=>ABX.core.matchFilter(CARD_MAP.get(id),__f,null,{bind:{}});`);
  ck("g1 matchFilter DD monster", run(`__m(4619)`));
  ck("g1 matchFilter Lost World", run(`__m(4569)`));
  ck("g1 matchFilter junk card no", !run(`__m(46)`));
  // Aplistos enter: look 3, DD to hand, rest to drop
  run(`clear(); battle.plr.deck=[46,4619,46,46,46,46]; battle.plr.monsters.center=mku(4620);`);
  await ab(4620, "center", hasLook);
  let s = S(); ck("g1 Aplistos picks the DD into hand", s.hand.includes(4619), s);
  ck("g1 Aplistos rest to drop", s.drop.length === 2 && s.deck === 3, s);
  // Endless Enmity: nothing pickable -> the rest is still dropped (not put back on top)
  run(`clear(); battle.plr.deck=[46,46,46,46,46,46]; battle.plr.setSpells=[CARD_MAP.get(5807)];`);
  await ab(5807, null, hasLook);
  s = S(); ck("g1 Enmity nothing picked: the 3 rest cards go to drop", s.drop.length === 4 && s.deck === 3, s);
  // Whistle: nothing picked -> rest to bottom (deck keeps 6, top changes)
  run(`clear(); battle.plr.deck=[4621,4621,4621,4621,4621,4626,4626]; battle.plr.monsters.center=mku(4606);`);
  await ab(4606, "center", hasLook);
  s = S(); ck("g1 Whistle nothing picked: rest to bottom", s.deck >= 6 && s.deckTop[0] === 4626, s);
  // ---- group 2: 4625 Agonia triggers on every field -> drop route, not only destroy
  run(`globalThis.__n=930000; globalThis.mk=(type,extra)=>{ const id=++__n; const c=Object.assign({id,name:'B'+id,type,skill:'',cost:'',attrs:[],worlds:[],world:'Dragon World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };`);
  run(`clear(); battle.plr.monsters.left=mku(4625); battle.plr.hand=[4619]; battle.plr.deck=[46,4619,4621,4626,46,46,46,46]; battle.plr.monsters.center=mku(4667);`);
  await ab(4667, "center", `a=>a.kind==='act'`);
  s = S(); ck("g2 Agonia put to drop by Odio's cost: look 4, 2 to hand, rest to gauge", !s.field.includes(4625) && s.drop.includes(4625) && s.gauge === 8, s);
  run(`clear(); battle.plr.monsters.left=mku(4625); battle.plr.hand=[4619]; battle.plr.deck=[46,4619,4621,4626,46,46,46,46]; battle.plr.gauge=[46,46,46]; globalThis.__m2=mk('Monster'); battle.plr.hand.push(__m2.id);`);
  run(`battle.plr.monsters.center=mku(46); battle.plr.monsters.right=mku(46); battle.completeMonsterCall('plr','left',battle.plr.hand.indexOf(__m2.id),false);`);
  await settle(); s = S();
  ck("g2 Agonia retired by a call over it triggers", s.drop.includes(4625) && s.gauge === 5, s);
  // ---- group 3: Zorune 4633, Deugaine 4668, Deily 6458
  run(`clear(); battle.plr.monsters.center=mku(4633); battle.plr.hand=[4619]; battle.plr.deck=[4621,4626,4628,46,46,46,46,46];`);
  await ab(4633, "center", `a=>a.kind==='act'`);
  s = S(); ck("g3 Zorune: looked 3 return on top, then the TOP card is drawn", s.hand.length === 1 && s.hand[0] === 4621 && s.deck === 7 && s.deckTop[0] === 4626 && s.deckTop[1] === 4628, s);
  run(`clear(); battle.plr.monsters.center=mku(4633); battle.plr.hand=[46]; battle.plr.deck=[4621,4626,4628,46,46,46,46,46];`);
  await ab(4633, "center", `a=>a.kind==='act'`);
  s = S(); ck("g3 Zorune: nothing dropped -> no look, no draw", s.hand.length === 1 && s.deck === 8, s);
  run(`clear(); battle.plr.hand=[4668]; battle.plr.monsters.left=mku(4619); battle.activeSide='opp'; battle.opp.monsters.center=mku(46);
    ABX.runHandAct('plr',0,{attSide:'opp',attackerZones:['center'],targetPos:'fighter'}).then(r=>globalThis.__r=r);`);
  await settle();
  s = J(`[globalThis.__r, ["left","center","right"].map(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id)]`);
  ck("g3 Deugaine from hand redirects the attack to itself", JSON.stringify(s[0]).includes("center") || JSON.stringify(s[0]).includes("right"), s);
  run(`globalThis.__st=0; const O=ABX.OPS.stand; if(!O.__cnt){ const o=O.run; O.run=function(){ globalThis.__st++; return o.apply(this,arguments); }; O.__cnt=1; }`);
  run(`clear(); battle.plr.monsters.center=mku(6458); battle.plr.monsters.left=mku(4619); battle.plr.monsters.left.rested=true; battle.phase='attack'; globalThis.__st=0;`);
  await ab(6458, "center", `a=>a.kind==='modal'`);
  ck("g3 Deily without Lost World: one effect", run(`__st`) === 1, run(`__st`));
  run(`clear(); battle.plr.flagId=4569; battle.plr.monsters.center=mku(6458); battle.plr.monsters.left=mku(4619); battle.plr.monsters.left.rested=true; battle.phase='attack'; globalThis.__st=0;`);
  await ab(6458, "center", `a=>a.kind==='modal'`);
  ck("g3 Deily with Lost World: three effects", run(`__st`) === 3, run(`__st`));
  // ---- END
  console.log("pass", pass, "fail", fail); process.exit(fail ? 1 : 0);
})();
