// node tests/duel_sieger.js - "lifelink" call costs: #441 #442 #2013 #2689 #5939 (destroyed -> nullify [Lifelink] & pay gauge) and #6504 (nullify + put on top)
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };

(async () => {
  const env = createEnv(); const { flush } = env; const run = (c) => env.run('{' + c + '\n}');
  const settle = async () => { for (let i = 0; i < 10; i++) { await new Promise(r => setImmediate(r)); flush(); } };
  const val = (c) => env.run('(function(){' + c + '\n})()');
  env.run(`ABX.fast=true; ABX.autoPlay=true;
  globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; };
  globalThis.card=function(id){ return window.BUDDYFIGHT_CARDS.find(c=>c.id===id); };
  globalThis.put=function(side,pos,id){ const u={card:card(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.getFighter(side).monsters[pos]=u; return u; };
  // field: victim on the left; hand: the arm card; gauge n; life 10
  globalThis.setup=function(victimId, handId, gaugeN, drop){ fresh(); const f=battle.plr; ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null;
    f.gauge=[]; for(let i=0;i<gaugeN;i++) f.gauge.push(100+i); f.life=10; f.hand=[handId]; f.drop=(drop||[]).slice(); put('plr','left',victimId); };`);

  // parser: every call-cost line is understood
  [441, 442, 2013, 2689, 5939, 6504].forEach(id => ck(id + " cost parses", val(`return ABX.parseCard(card(${id})).abilities.every(a=>!a.unparsed||a.unparsed.length===0)`)));

  // #442 Tempest Enforcer: "Spartand" (#441, Lifelink 5) is destroyed, pay 3 gauge -> called, no lifelink damage
  run(`setup(441, 442, 3); battle.destroyMonster('plr','left');`);
  await settle();
  ck("442 called when Spartand is destroyed", val(`return ['left','center','right'].some(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id===442)`));
  ck("442 paid 3 gauge", val(`return battle.plr.gauge.length===0`));
  ck("Spartand destroyed: life untouched", val(`return battle.plr.life===10`), val(`return battle.plr.life`));

  // not enough gauge -> no call, the Lifelink damage happens
  run(`setup(444, 441, 2); battle.destroyMonster('plr','left');`);
  await settle();
  ck("2 gauge: not called, Lifelink 5 hits", val(`return battle.plr.hand.includes(441) && battle.plr.life===5`), val(`return [battle.plr.hand.slice(), battle.plr.life]`));

  // wrong monster destroyed -> no call
  run(`setup(43, 442, 3); battle.destroyMonster('plr','left');`);
  await settle();
  ck("wrong monster: not called", val(`return battle.plr.hand.includes(442) && battle.plr.gauge.length===3`));

  // #441 Spartand: "Martial Arts Dragon Emperor, Duel Sieger" (#444, Lifelink 5) destroyed: nullify, pay 3, put it from the drop zone into the soul
  run(`setup(444, 441, 3); battle.destroyMonster('plr','left');`);
  await settle();
  ck("441 called", val(`return ['left','center','right'].some(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id===441)`));
  ck("441 has the Duel Sieger in its soul", val(`const u=['left','center','right'].map(p=>battle.plr.monsters[p]).find(m=>m&&m.card.id===441); return !!u && u.soul.some(s=>(typeof s==='object'?s.id:s)===444) && !battle.plr.drop.includes(444)`));
  ck("441 nullified Lifelink 5", val(`return battle.plr.life===10`), val(`return battle.plr.life`));

  // #2013: size 3 «Dragon Lord» with [Lifelink] (#439 Gatastol, LL1) destroyed
  run(`setup(439, 2013, 3); battle.destroyMonster('plr','left');`);
  await settle();
  // (an Impact Monster: placed by impact_monsters.js; its own "When this card enters your field, your life becomes 1" runs, so life 1 = entered, 9 = Lifelink hit)
  ck("2013 called for a size 3 Dragon Lord with Lifelink", val(`return !battle.plr.hand.includes(2013) && battle.plr.life===1 && battle.plr.gauge.length===0`), val(`return [battle.plr.hand.slice(), battle.plr.life, battle.plr.gauge.length]`));
  // size 3 but not a Dragon Lord -> not called (#2192 is a size 3 Dragon Chief Emperor with Lifelink)
  run(`setup(2192, 2013, 3); battle.destroyMonster('plr','left');`);
  await settle();
  ck("2013 not called for a non-Dragon Lord", val(`return battle.plr.hand.includes(2013)`));

  // #5939: any size 3 monster with [Lifelink]
  run(`setup(2192, 5939, 3); battle.destroyMonster('plr','left');`);
  await settle();
  ck("5939 called for any size 3 monster with Lifelink", val(`return ['left','center','right'].some(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id===5939) && battle.plr.life===10`), val(`return [battle.plr.hand.slice(), battle.plr.life]`));

  // #2689 pays 2 gauge when Tempest Enforcer (#442, [Lifelink Lose]) is destroyed: the lose condition is nullified
  run(`setup(442, 2689, 2); battle.destroyMonster('plr','left');`);
  await settle();
  ck("2689 called, [Lifelink Lose] nullified", val(`return ['left','center','right'].some(p=>battle.plr.monsters[p]&&battle.plr.monsters[p].card.id===2689) && battle.plr.life===10`), val(`return [battle.plr.hand.slice(), battle.plr.life]`));
  // without the call, Lifelink Lose still kills
  run(`setup(442, 43, 2); battle.destroyMonster('plr','left');`);
  await settle();
  ck("no arm card in hand: Lifelink Lose still applies", val(`return battle.plr.life===0`), val(`return battle.plr.life`));

  // #6504: not callable from the hand in the main phase? it is: it goes on top of an originally size 3 «Dragon Chief Emperor» on the field
  ck("6504 has an on-top cost", val(`return !!ABX.onTopCost(card(6504))`));

  // #2013 (Impact Monster) cannot be called in the Final Phase without the "destroyed" timing
  ck("2013 not callable in the Final Phase", val(`fresh(); battle.plr.gauge=[1,2,3,4]; battle.plr.hand=[2013]; battle.turnCount=3; battle.phase='final'; const i=battle.imCallInfo('plr', card(2013)); return i.ok===false && i.reasons.some(r=>/only be called by another card/.test(r))`));
  // data: cards whose text prints [Lifelink N] now have that ll value (#441 was 0)
  ck("441 has ll 5", val(`return card(441).ll===5`));

  console.log(`pass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
