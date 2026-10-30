// node tests/genesis_arms.js - #6145 Rightes / #6146 Leftes: timing call "[Call Cost] [When a «Genesis Dragon» monster on your field is put to drop zone, put three cards from your drop zone into its soul]"
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };

(async () => {
  const env = createEnv(); const { flush } = env; const run = (c) => env.run('{' + c + '\n}'); const settle = async () => { for (let i = 0; i < 8; i++) { await new Promise(r => setImmediate(r)); flush(); } }; const val = (c) => env.run('(function(){' + c + '\n})()');
  env.run(`ABX.fast=true; ABX.autoPlay=true;
  globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; };
  globalThis.card=function(id){ return window.BUDDYFIGHT_CARDS.find(c=>c.id===id); };
  globalThis.put=function(side,pos,id){ const u={card:card(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.getFighter(side).monsters[pos]=u; return u; };
  globalThis.setup=function(armId, withBigbang, dropN){ fresh(); const f=battle.plr; ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=[1,2,3];
    put('plr','center', withBigbang?5158:5159); if(!withBigbang) put('plr','left',5159); f.hand=[armId]; f.drop=[]; for(let i=0;i<dropN;i++) f.drop.push(100+i); };`);

  // parser: the cost line is understood (no unparsed text)
  ck("6145 cost line parses", val(`return ABX.parseCard(card(6145)).abilities.every(a=>!a.unparsed||a.unparsed.length===0)`));
  ck("6146 cost line parses", val(`return ABX.parseCard(card(6146)).abilities.every(a=>!a.unparsed||a.unparsed.length===0)`));

  // Rightes: a Genesis Dragon (not Bigbang) is destroyed while Bigbang is on the field -> offered, called on the RIGHT, 3 drop cards into its soul
  run(`setup(6145, true, 5); put('plr','left',5159); battle.destroyMonster('plr','left');`);
  await settle();
  ck("Rightes called on the right", val(`return !!battle.plr.monsters.right && battle.plr.monsters.right.card.id===6145`), val(`return Object.keys(battle.plr.monsters).map(p=>p+':'+(battle.plr.monsters[p]&&battle.plr.monsters[p].card.id))`));
  ck("Rightes has 3 cards in its soul", val(`return battle.plr.monsters.right && battle.plr.monsters.right.soul.length===3`), val(`return battle.plr.monsters.right && battle.plr.monsters.right.soul.length`));
  ck("Rightes left the hand", val(`return !battle.plr.hand.includes(6145)`));

  // Leftes goes to the LEFT
  run(`setup(6146, true, 5); put('plr','right',5159); battle.destroyMonster('plr','right');`);
  await settle();
  ck("Leftes called on the left", val(`return !!battle.plr.monsters.left && battle.plr.monsters.left.card.id===6146`), val(`return Object.keys(battle.plr.monsters).map(p=>p+':'+(battle.plr.monsters[p]&&battle.plr.monsters[p].card.id))`));

  // not enough drop cards for the cost (the destroyed Genesis card itself makes 1) -> not called
  run(`setup(6145, true, 1); put('plr','left',5159); battle.destroyMonster('plr','left');`);
  await settle();
  ck("drop too small: not called", val(`return !battle.plr.monsters.right && battle.plr.hand.includes(6145)`));

  // Bigbang Dragon not on the field -> not called
  run(`setup(6145, false, 5); battle.destroyMonster('plr','center');`);
  await settle();
  ck("no Bigbang on the field: not called", val(`return !battle.plr.monsters.right && battle.plr.hand.includes(6145)`));

  // a non-Genesis monster leaving does not offer the call
  run(`setup(6145, true, 5); const u=put('plr','left',3308); battle.destroyMonster('plr','left');`);
  await settle();
  ck("non-Genesis monster: not called", val(`return !battle.plr.monsters.right && battle.plr.hand.includes(6145)`));

  console.log(`pass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
