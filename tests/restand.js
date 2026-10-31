// A card stood by an ability can attack again (#2371 / #6521 Great Demonic End Dragon).
const { createEnv } = require("./headless");
const env = createEnv();
const { run, flush } = env;
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log("  PASS: " + m); } else { failed++; console.error("  FAIL: " + m); } };
const J = (js) => JSON.parse(run(`JSON.stringify(${js})`));
const tick = async () => { for (let i = 0; i < 4; i++) { flush(); await wait(10); } };
(async () => {
  for (const id of [2371, 6521]) {
    run(`(function(){ABX.fast=true;ABX.autoPlay=true;
      battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
      const me=battle.plr; me.gauge=me.deck.splice(0,5); me.life=8;
      me.monsters.center={card:CARD_MAP.get(${id}),rested:true,attacksLeft:0,soul:[],tempPower:0,tempDef:0,tempCrit:0};
      battle.turn='plr'; battle.activeSide='plr'; battle.phase='attack'; battle.turnCount=4; return 1;})()`);
    const ab = J(`ABX.actAbilities(CARD_MAP.get(${id})).length`);
    run(`ABX.useAct('plr',CARD_MAP.get(${id}),battle.plr.monsters.center)`); await tick();
    const r = J(`({rested:battle.plr.monsters.center.rested,left:battle.plr.monsters.center.attacksLeft,life:battle.plr.life})`);
    ok(!r.rested && r.left >= 1, `#${id} stood by its [Act] -> can attack again (acts=${ab}, rested=${r.rested}, attacksLeft=${r.left}, life=${r.life})`);
  }
  // generic stand effect (Double Attack unit gets 2 attacks back)
  run(`(function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
    battle.plr.monsters.center={card:CARD_MAP.get(2371),rested:true,attacksLeft:0,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.activeSide='plr'; battle.phase='attack'; return 1;})()`);
  run(`ABX.OPS.stand.run({np:{ref:true}},{side:'plr',f:battle.plr,e:battle.opp,card:CARD_MAP.get(2371),bind:{chosen:[{unit:battle.plr.monsters.center,side:'plr'}]},log:[]})`); await tick();
  ok(J(`battle.plr.monsters.center.attacksLeft`) === 2, "Double Attack unit regains 2 attacks (" + J(`battle.plr.monsters.center.attacksLeft`) + ")");
  // Aqulta Gwaneff swords: not equippable from hand, only by Azi Dahaka's ability
  const eq = () => run(`(function(){ABX.fast=true;ABX.autoPlay=true;
    battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
    const me=battle.plr; me.gauge=me.deck.splice(0,8); me.hand=[942]; me.item=null; me.monsters.center=null;
    battle.turn='plr'; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=4; window.alert=function(){}; return 1;})()`);
  eq(); run(`battle.equipCardFromHand('plr',0)`); await tick();
  ok(J(`!battle.plr.item`) && J(`battle.plr.hand.length`) === 1, "#942 cannot be equipped from hand normally");
  eq(); run(`battle.plr.hand=[]; battle.plr.monsters.center={card:CARD_MAP.get(867),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.plr.deck.unshift(942);`);
  run(`ABX.fireLeave('plr',CARD_MAP.get(867),false,false)`); await tick(); await tick();
  ok(J(`!!battle.plr.item && battle.plr.item.card.id===942`), "#867 Azi Dahaka's ability can still equip #942 (item=" + J(`battle.plr.item&&battle.plr.item.card.id`) + ")");
  console.log(`pass ${passed} fail ${failed}`); process.exit(failed ? 1 : 0);
})();
