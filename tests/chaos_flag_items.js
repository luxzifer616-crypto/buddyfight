// "Infinity the Chaos" as a second flag (abilities_r37.js) and more than one item (game.js "item2").
const { createEnv } = require("./headless.js");
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const J = (s) => JSON.parse(env.run(`JSON.stringify(${s})`));

(async () => {
  env.run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true;
    window.__ctx = () => ({ side: "plr", f: battle.plr, e: battle.opp, card: CARD_MAP.get(4072), unit: null, bind: { chosen: [] }, auto: true });`);
  await wait(1200);
  ok(J(`battle.plr.flagUnder`).includes(3941), "The Chaos: \"Infinity the Chaos\" starts face down under the flag");
  ok(J(`battle.plr.deck.includes(4072) || battle.plr.hand.includes(4072)`), "\"The Chaos Upgrade\" is given to the player");
  env.run(`battle.plr.drop = battle.plr.deck.splice(0, 9)`);
  await env.run(`ABX.OPS.r37ChaosUpgrade.run({}, __ctx())`); await wait(300);
  ok(J(`battle.plr.flagId`) === 3337, "with 9 cards in the drop zone the Upgrade does nothing");
  env.run(`battle.plr.drop.push(battle.plr.deck.shift())`);
  await env.run(`ABX.OPS.r37ChaosUpgrade.run({}, __ctx())`); await wait(300);
  ok(J(`battle.plr.flagId`) === 3941 && J(`battle.plr.maxSize`) >= 1e9, "with 10: the flag becomes \"Infinity the Chaos\", size limit infinite");
  const big = J(`(ALL_CARDS.find(c => c.type === "Monster" && (c.size || 0) >= 30) || {}).id || null`);
  if (big) {
    env.run(`battle.plr.monsters.left = { card: CARD_MAP.get(${big}), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 }`);
    ok(J(`ABX.core.isProtected(battle.plr.monsters.left, "plr", "destroyed", { side: "opp", card: ALL_CARDS.find(c => c.type === "Spell") })`), "a size 30+ monster can't be destroyed by effects");
  }
  // more than one item
  env.run(`{ const f = battle.plr; ["left","center","right","center2"].forEach(p => f.monsters[p] = null); f.item = null; f.item2 = null;
    f.item = { card: CARD_MAP.get(3728), rested: false, attacksLeft: 1, soul: [] };
    window.__it = ALL_CARDS.find(c => c.type === "Item" && c.id !== 3728 && c.id !== 6512); f.hand.push(__it.id); }`);
  ok(J(`hasMultiItems(battle.plr)`), "Laevateinn (#3728) on the field allows more than one item");
  ok(J(`ABX.equipFrom("plr", "hand", __it.id, false)`) && J(`!!battle.plr.item2 && battle.plr.item.card.id === 3728`), "a second item goes to the second slot; the first stays");
  ok(J(`ABX.core.fieldUnits(battle.plr, true).some(x => x.pos === "item2")`) && J(`unitAt(battle.plr, "item2") === battle.plr.item2`), "the engine and the attack code see the second item");
  env.run(`battle.destroyMonster("plr", "item2")`);
  ok(J(`!battle.plr.item2 && battle.plr.drop.includes(__it.id)`), "the second item can be destroyed on its own");
  const mon = J(`ALL_CARDS.find(c => c.type === "Monster" && c.size === 1 && /call cost/i.test(c.cost || "")).id`);
  env.run(`battle.plr.hand.push(${mon}); battle.plr.gauge = battle.plr.deck.splice(0, 5); battle.activeSide = "plr"; battle.phase = "main"; battle.completeMonsterCall("plr", "left", battle.plr.hand.indexOf(${mon}), false)`);
  await wait(800);
  ok(!J(`!!battle.plr.monsters.left`), "with Laevateinn on the field you can't put monsters on the field");
  const it2 = J(`ALL_CARDS.find(c => c.type === "Item" && /\\[equip cost\\][^\\n]*pay 1 gauge/i.test(c.cost || "")).id`);
  env.run(`battle.plr.hand.push(${it2})`);
  ok(J(`parseCardCost(CARD_MAP.get(${it2}).cost, CARD_MAP.get(${it2}).skill, battle.plr, CARD_MAP.get(${it2})).gauge`) === 2, "items in your hand cost 1 more gauge to equip (#3728)");
  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
