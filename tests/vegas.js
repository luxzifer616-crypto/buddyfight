const { createEnv } = require("./headless.js");
const env = createEnv();
const { run, flush } = env;
const r = run(`(function(){
  ABX.fast = true; ABX.debug = true;
  const v = ALL_CARDS.find(c => /Time Scout, Vegas/i.test(c.name));
  battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true));
  const me = battle.plr, op = battle.opp;
  me.monsters.center = { card: v, rested:false, attacksLeft:1, soul:[], tempPower:0,tempDef:0,tempCrit:0, actUsed:false };
  // opponent drop zone: 4 known cards, my gauge 2
  op.drop = op.deck.splice(0,5);
  me.gauge = me.deck.splice(0,2); me.godclock = {reversalCount:2}; battle.renderBattle = function(){};
  const before = { opDrop: op.drop.slice(), opDeck: op.deck.length, hand: me.hand.length, gauge: me.gauge.length };
  let picked = null;
  ABX.hooks.pickCards = (o) => { picked = o.cards.length; return [2,0,1].slice(0, Math.min(3,o.cards.length)); };
  ABX.hooks.confirm = () => true;
  const acts = ABX.actAbilities(v);
  globalThis.__res = { acts: acts.length, before, canUse: ABX.canUseAct('plr', v, acts[0], me.monsters.center) };
  globalThis.__me = me; globalThis.__op = op; globalThis.__v = v;
  return ABX.useAct('plr', v, me.monsters.center).then(() => 'ok');
})()`);
r.then(async () => {
  await flush();
  const out = run(`(function(){ const me=__me, op=__op; return { res: __res, after: { opDrop: op.drop.length, opDeckLen: op.deck.length, deckBottom3: op.deck.slice(-3), gauge: me.gauge.length, hand: me.hand.length, rev: getFighterReversalCount(me) } }; })()`);
  console.log(JSON.stringify(out, null, 1));
  const again = run(`ABX.canUseAct('plr', __v, ABX.actAbilities(__v)[0], __me.monsters.center)`);
  console.log("second use:", JSON.stringify(again));
}).catch(e => { console.error("FAIL", e); process.exit(1); });
