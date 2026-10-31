// #3619 Overturn Black Death Dragon, Abygale: [Overturn] is an [Act] (main phase, pay 1 gauge, once per game).
const { createEnv } = require("./headless");
const env = createEnv();
const { run, flush } = env;
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log("  PASS: " + m); } else { failed++; console.error("  FAIL: " + m); } };
const J = (js) => JSON.parse(run(`JSON.stringify(${js})`));
const tick = async () => { for (let i = 0; i < 3; i++) { flush(); await wait(10); } };
(async () => {
  run(`(function(){ABX.fast=true;ABX.autoPlay=true;
    battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
    const mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
    const me=battle.plr; me.gauge=me.deck.splice(0,5); me.life=10;
    me.monsters.center=mk(CARD_MAP.get(3619)); battle.opp.monsters.center=mk(ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill));
    battle.turn='plr'; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=4; return 1;})()`);
  const ab = J(`ABX.actAbilities(CARD_MAP.get(3619)).filter(a=>(a.tags||[]).includes('kw:overturn')).length`);
  ok(ab === 1, "Overturn is an [Act] ability (not an auto trigger)");
  // not usable outside your main phase
  run(`battle.phase='attack'`);
  ok(J(`ABX.canUseAct('plr',CARD_MAP.get(3619),ABX.actAbilities(CARD_MAP.get(3619)).find(a=>(a.tags||[]).includes('kw:overturn')),battle.plr.monsters.center).ok`) === false, "not usable in the attack phase");
  run(`battle.phase='main'`);
  // opponent's turn start does nothing before activation
  run(`ABX.fireTurnEvent('turnStart')`); await tick();
  ok(J(`battle.plr.abxAbygale||0`) === 0, "nothing happens before it is activated");
  run(`ABX.useAct('plr',CARD_MAP.get(3619),battle.plr.monsters.center)`); await tick();
  ok(J(`battle.plr.gauge.length`) === 4, "paid 1 gauge (5 -> " + J(`battle.plr.gauge.length`) + ")");
  ok(J(`battle.plr.abxAbygale`) === 1, "armed");
  // opponent's turn starts -> ends
  run(`battle.activeSide='opp'; battle.turn='opp'; battle.turnCount=5; battle.phase='stand'`);
  run(`ABX.fireTurnEvent('turnStart')`); await tick();
  ok(J(`battle.abxEndTurnTurn`) === 5, "opponent's turn is ended at its start");
  ok(J(`battle.plr.abxNoAttackTurn`) === 6, "turn passed to me");
  ok(J(`battle.isFirstRoundAttackLocked()`) === true, "cannot attack during my next turn");
  run(`battle.activeSide='opp'; battle.turn='opp'; battle.turnCount=7`);
  ok(J(`battle.isFirstRoundAttackLocked()`) === false, "restriction gone afterwards");
  // once per game
  run(`battle.activeSide='plr'; battle.turn='plr'; battle.turnCount=8; battle.phase='main'`);
  ok(J(`ABX.canUseAct('plr',CARD_MAP.get(3619),ABX.actAbilities(CARD_MAP.get(3619)).find(a=>(a.tags||[]).includes('kw:overturn')),battle.plr.monsters.center).ok`) === false, "once per game");
  console.log(`pass ${passed} fail ${failed}`);
  process.exit(failed ? 1 : 0);
})();
