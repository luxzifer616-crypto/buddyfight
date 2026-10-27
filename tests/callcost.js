const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
const setup = (withTD) => run(`(function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 const v=ALL_CARDS.find(c=>/Time Scout, Vegas/i.test(c.name)); const td=ALL_CARDS.find(c=>c.type==='Monster'&&(c.attrs||[]).some(a=>/timedragon/i.test(a))&&c.id!==v.id);
 const me=battle.plr; me.gauge=me.deck.splice(0,4); me.drop=${withTD}?[td.id]:[]; me.hand=[v.id]; battle.activeSide='plr'; battle.phase='main';
 battle.completeMonsterCall('plr','center',0,false,false); globalThis.__td=td.id; return 1; })()`);
(async()=>{
  setup(false); for(let i=0;i<5;i++){await flush();await new Promise(r=>setTimeout(r,3));}
  console.log("without Time Dragon -> blocked:", run(`!battle.plr.monsters.center && battle.plr.hand.length===1`));
  setup(true); for(let i=0;i<8;i++){await flush();await new Promise(r=>setTimeout(r,3));}
  console.log("with Time Dragon -> called, TD in soul:", run(`!!battle.plr.monsters.center && battle.plr.monsters.center.soul.includes(__td) && !battle.plr.drop.includes(__td)`), run(`JSON.stringify(battle.plr.monsters.center&&battle.plr.monsters.center.soul)`));
})();
