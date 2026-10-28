// [Transform] / [Ride] / [Station] (abilities_r15.js): the mode cost is paid instead of the general cost, its extra parts
// are checked and applied, and card effects can [Transform] you into a card.
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const settle = async () => { for (let i = 0; i < 8; i++) { await flush(); await new Promise(r => setTimeout(r, 2)); } };
const fresh = (setup) => run(`(function(){ ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true));
  battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
  const f=battle.plr; f.gauge=f.deck.splice(0,5); f.life=10; f.drop=[]; f.item=null; f.hand=[]; ${setup || ""} })()`);
const equip = (id) => run(`battle.equipCardFromHand('plr', battle.plr.hand.indexOf(${id}), 'Transform')`);
const itemId = () => run(`battle.plr.item ? battle.plr.item.card.id : 0`);
const put = (id) => `f.item={card:CARD_MAP.get(${id}),rested:false,attacksLeft:1,soul:[]};`;

(async () => {
  // 1384 Gaigrander, "Finish Form": [Transform] [Pay 1 gauge & Return a card with "Gaigrander" in its card name you are [Transform] into back into your hand]
  fresh(`f.hand=[1384];`);
  equip(1384); await settle();
  ok(itemId() === 0 && run(`battle.plr.gauge.length`) === 5, "Finish Form is refused when you are not [Transform] into a Gaigrander");
  fresh(`f.hand=[1384]; ${put(3228)}`);
  equip(1384); await settle();
  ok(itemId() === 1384, "Finish Form transforms onto a Gaigrander");
  ok(run(`battle.plr.gauge.length`) === 4, "…paying its [Transform] cost of 1 gauge, not its [Call Cost] of 2 (gauge " + run(`battle.plr.gauge.length`) + ")");
  ok(run(`battle.plr.hand.includes(3228)`), "…and the old Gaigrander goes back to the hand");

  // 3228 Gaigrander 04: [Transform] [Return up to one ... & Pay 1 gauge] (used to be free)
  fresh(`f.hand=[3228];`);
  equip(3228); await settle();
  ok(itemId() === 3228 && run(`battle.plr.gauge.length`) === 4, "Gaigrander 04 now costs 1 gauge (it was free)");

  // 4971 Ultra Cosmoman: [Transform] [Put a «Galaxy Exalt» you are [Transform] as into the drop zone & Pay 2 gauge]
  const exalt = run(`(ALL_CARDS.find(c => c.id !== 4971 && c.type === 'Monster' && (c.attrs||[]).includes('Galaxy Exalt') && c.tr) || {}).id || 0`);
  fresh(`f.hand=[4971];`);
  equip(4971); await settle();
  ok(itemId() === 0, "Ultra Cosmoman is refused without a «Galaxy Exalt»");
  if (exalt) {
    fresh(`f.hand=[4971]; ${put(exalt)}`);
    equip(4971); await settle();
    ok(itemId() === 4971 && run(`battle.plr.drop.includes(${exalt})`) && run(`battle.plr.gauge.length`) === 3, "…and with one, it goes to the drop zone and 2 gauge are paid");
  }

  // 2128 Caardian: "This card cannot [Transform] other than by the [Act] of "Transform Belt, Card Winder""
  fresh(`f.hand=[2128];`);
  equip(2128); await settle();
  ok(itemId() === 0 && run(`battle.plr.hand.includes(2128)`), "Caardian can't be equipped from the hand");
  // Card Winder's [Act]: pay 2 gauge, return it to hand, choose a "Caardian" monster from hand or deck and [Transform] into it
  fresh(`f.hand=[2128]; ${put(2149)}`);
  const act = run(`(function(){ const a = ABX.actAbilities(CARD_MAP.get(2149)); return a.length && ABX.isExecutable(a[0]); })()`);
  ok(act, "Card Winder's [Act] can run");
  run(`ABX.useAct('plr', CARD_MAP.get(2149), battle.plr.item)`); await settle();
  ok(itemId() === 2128, "…and transforms into Caardian (item " + itemId() + ")");
  ok(run(`battle.plr.hand.includes(2149)`), "…with Card Winder back in the hand");

  // 1066 "I Knew Something Like This Would Happen...": [Transform] into a card with [Transform] from your drop zone by paying its [Transform] cost
  fresh(`f.hand=[1066]; f.drop=[945];`);
  ok(run(`ABX.ownsSpell(CARD_MAP.get(1066))`), "I Knew Something Like This Would Happen... runs through the engine");
  run(`battle.castSpellFromHand('plr', 0)`); await settle();
  ok(itemId() === 945, "…and transforms into the [Transform] card from the drop zone (item " + itemId() + ")");
  ok(run(`battle.plr.gauge.length`) === 5 - 1 - 2, "…paying the cast cost (1) and its [Transform] cost (2)");

  // 1384 "Crimson Spin!": [Counter] [Act] During your attack phase, [Transform] into this card from your hand by paying the [Transform] cost
  fresh(`f.hand=[1384]; ${put(3228)} battle.phase='attack';`);
  const hu = run(`(function(){ const list = ABX.handUseActs ? ABX.handUseActs(CARD_MAP.get(1384)) : []; const cl = ABX.counterHandUseActs ? ABX.counterHandUseActs(CARD_MAP.get(1384)) : []; return list.length + cl.length; })()`);
  ok(hu > 0, "Crimson Spin! is offered as a hand ability");
  run(`(function(){ const ab = [].concat(ABX.handUseActs(CARD_MAP.get(1384)), ABX.counterHandUseActs(CARD_MAP.get(1384)))[0]; return ABX.runHandUse('plr', battle.plr.hand.indexOf(1384), ab); })()`); await settle();
  ok(itemId() === 1384, "…and transforms into Finish Form from the hand (item " + itemId() + ")");

  // every mode cost line is read, except a few Gridman / Card Burn ones that keep the old behavior
  const unknown = run(`ALL_CARDS.filter(c => { const m = ABX.modeCost(c); return m && m.unknown.length; }).length`);
  ok(unknown <= 6, "mode cost lines not read yet: " + unknown);

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
