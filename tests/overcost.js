// [Overturn]/[Overkill]/[Overthrow] [<cost>] acts must charge the printed cost (gauge / life / hand discard) when used.
const { createEnv } = require("./headless");
const { run, flush } = createEnv();
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
const J = (js) => JSON.parse(run(`JSON.stringify(${js})`));
const tick = async () => { for (let i = 0; i < 5; i++) { flush(); await wait(10); } };
const setup = (id, o) => run(`(function(){ABX.fast=true;ABX.autoPlay=true;
  battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const plain=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
  const me=battle.plr; me.gauge=me.deck.splice(0,${o.gauge}); me.life=${o.life||10}; me.hand=me.deck.splice(0,${o.hand}); 
  me.monsters.center={card:CARD_MAP.get(${id}),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
  battle.opp.monsters.center={card:plain,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
  battle.turn='plr'; battle.activeSide='plr'; battle.phase='${o.phase||"attack"}'; battle.turnCount=4; return 1;})()`);
const act = (id) => J(`(function(){const c=CARD_MAP.get(${id}); const a=ABX.actAbilities(c).find(x=>(x.tags||[]).some(t=>/(?:^|:)over/.test(t))); return ABX.canUseAct('plr',c,a,battle.plr.monsters.center);})()`);
(async () => {
  // 3629: pay 1 gauge (attack phase)
  setup(3629, { gauge: 5, hand: 3 });
  run(`ABX.useAct('plr',CARD_MAP.get(3629),battle.plr.monsters.center)`); await tick();
  ck(`#3629 pays 1 gauge (5 -> ${J(`battle.plr.gauge.length`)})`, J(`battle.plr.gauge.length`) === 4);
  // 3745: 1 gauge + 1 life
  setup(3745, { gauge: 5, hand: 3 });
  run(`ABX.useAct('plr',CARD_MAP.get(3745),battle.plr.monsters.center)`); await tick();
  ck(`#3745 pays 1 gauge + 1 life (gauge ${J(`battle.plr.gauge.length`)}, life ${J(`battle.plr.life`)})`, J(`battle.plr.gauge.length`) === 4 && J(`battle.plr.life`) === 9);
  // 3643: discard a hand card
  setup(3643, { gauge: 5, hand: 3 });
  run(`ABX.useAct('plr',CARD_MAP.get(3643),battle.plr.monsters.center)`); await tick();
  ck(`#3643 discards 1 hand card (3 -> ${J(`battle.plr.hand.length`)})`, J(`battle.plr.hand.length`) === 2);
  // cannot use without the cost
  setup(3629, { gauge: 0, hand: 3 });
  ck("#3629 not usable with 0 gauge", act(3629).ok === false);
  setup(3643, { gauge: 3, hand: 0 });
  ck("#3643 not usable with an empty hand", act(3643).ok === false);
  // self-paying cards are not charged twice
  setup(6512, { gauge: 5, hand: 3, phase: "main" });
  run(`ABX.useAct('plr',CARD_MAP.get(6512),battle.plr.monsters.center)`); await tick();
  ck(`#6512 charged once (gauge 5 -> ${J(`battle.plr.gauge.length`)})`, J(`battle.plr.gauge.length`) === 4);
  // #3824 Miserea: pay 2 gauge, everything else back to the decks, 6 cards in hand + 2 in gauge
  setup(3824, { gauge: 6, hand: 4, phase: "main" });
  const total = J(`[battle.plr,battle.opp].map(f=>f.deck.length+f.hand.length+f.gauge.length+f.drop.length)`);
  run(`battle.plr.drop=battle.plr.deck.splice(0,3); ABX.useAct('plr',CARD_MAP.get(3824),battle.plr.monsters.center)`); await tick();
  ck(`#3824 resets both sides (hand ${J(`battle.plr.hand.length`)}, gauge ${J(`battle.plr.gauge.length`)}, opp field ${J(`!battle.opp.monsters.center`)}, own unit stays ${J(`!!battle.plr.monsters.center`)})`,
     J(`battle.plr.hand.length`) === 6 && J(`battle.plr.gauge.length`) === 2 && J(`battle.plr.drop.length`) === 0 && J(`!battle.opp.monsters.center`) && J(`!!battle.plr.monsters.center`) && J(`battle.opp.hand.length`) === 6);
  console.log(`pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})();
