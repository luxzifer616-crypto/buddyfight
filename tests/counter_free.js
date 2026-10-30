// [Counter] spells outside the attack window: (1) hand counters the engine owns are offered while defending,
// (2) non-attack counters can be cast on the opponent's turn (banner "Counter" button -> ABX.castFreeCounter).
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
run(`ABX.fast=true; ABX.autoPlay=true;`);
const val = (js) => JSON.parse(run(`JSON.stringify((function(){${js}})())`));
const setup = (id) => run(`(function(){
  battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const mon = ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
  const me = battle.opp; me.gauge=me.deck.splice(0,8); me.life=10; me.hand=[${id}]; me.drop=me.deck.splice(0,8);
  const att = battle.plr; att.monsters.center={card:mon,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
  battle.turn='plr'; battle.activeSide='plr'; battle.phase='attack';
})()`);

(async () => {
  // 8 Bastin Caps: "[Counter] Destroy a card on the field."
  setup(8);
  ck("8 is an engine counter spell", val(`return ABX.ownsCounter(CARD_MAP.get(8));`));
  ck("8 is offered in the defense window (fighter)", val(`return battle.getAvailableDefenseCards('opp',false,'fighter',[battle.plr.monsters.center]).some(o=>o.handIdx===0);`));
  ck("8 is castable on the opponent's turn (free counter)", val(`return ABX.freeCounterOption('opp', CARD_MAP.get(8));`));
  const before = val(`return battle.plr.monsters.center ? 1 : 0;`);
  run(`battle.opp.monsters.left={card:ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill),rested:false,soul:[],tempPower:0,tempDef:0,tempCrit:0};`);
  run(`globalThis.__r = ABX.castFreeCounter('opp', CARD_MAP.get(8)); `);
  for (let i = 0; i < 8; i++) await flush();
  ck("auto-pick destroyed the enemy card, not the caster's own monster", val(`return !!battle.opp.monsters.left;`));
  ck("8 left the hand and went to the drop zone", val(`return battle.opp.hand.length===0 && battle.opp.drop.includes(8);`));
  ck("8 destroyed the attacker's monster (" + before + " -> 0)", val(`return !battle.plr.monsters.center;`));

  // attack nullifiers are NOT free counters (277 Ninja Arts, Half-kill needs a Soulguard attacker)
  setup(286);
  ck("286 (nullify attack) is not a free counter", val(`return !ABX.freeCounterOption('opp', CARD_MAP.get(286));`));
  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
