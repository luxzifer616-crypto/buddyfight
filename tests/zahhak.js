// #1094 Twin Demon Dragon, Zahhak: on enter, may pay 2 life -> search deck for "Demonic Demise Dragon, Azi Dahaka" or "Dragon Throne" into hand.
const { createEnv } = require("./headless");
const { run, flush } = createEnv();
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
const J = (js) => JSON.parse(run(`JSON.stringify(${js})`));
const tick = async () => { for (let i = 0; i < 5; i++) { flush(); await wait(10); } };
const setup = (deckIds, life) => run(`(function(){ABX.fast=true;ABX.autoPlay=true;
  battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const me=battle.plr; me.life=${life}; me.hand=[]; me.deck=[${deckIds}].concat(me.deck.slice(0,20)); me.gauge=me.deck.splice(25,6);
  me.monsters.center={card:CARD_MAP.get(1094),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
  battle.turn='plr'; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=4; return 1;})()`);
(async () => {
  for (const [id, nm] of [[867, "Azi Dahaka"], [941, "Dragon Throne"]]) {
    setup(`${id}`, 10);
    run(`ABX.fireEnter('plr',CARD_MAP.get(1094),battle.plr.monsters.center)`); await tick();
    ck(`fetches ${nm}: hand=${J(`battle.plr.hand`)} life=${J(`battle.plr.life`)}`, J(`battle.plr.hand.includes(${id})`) && J(`battle.plr.life`) === 8 && !J(`battle.plr.deck.includes(${id})`));
  }
  setup("6526", 10);
  run(`ABX.fireEnter('plr',CARD_MAP.get(1094),battle.plr.monsters.center)`); await tick();
  ck("does not fetch the Re:B version", !J(`battle.plr.hand.includes(6526)`));
  setup("867", 2);
  run(`ABX.fireEnter('plr',CARD_MAP.get(1094),battle.plr.monsters.center)`); await tick();
  ck(`life 2: cannot pay 2 life (life stays above 0, nothing fetched): life=${J(`battle.plr.life`)}`, J(`battle.plr.life`) >= 1 && !J(`battle.plr.hand.includes(867)`));
  setup("867", 10);
  run(`ABX.fireEnter('plr',CARD_MAP.get(1094),battle.plr.monsters.center)`); await tick();
  ck("not in deck any more, deck size consistent", J(`battle.plr.deck.filter(i=>i===867).length`) === 0);
  console.log(`pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})();
