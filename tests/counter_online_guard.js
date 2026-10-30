// The opponent's-turn Counter buttons are local-only: in online P2P the waiting player's changes are not synced, so they stay hidden.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
const buttons = (mode) => JSON.parse(run(`(function(){
 battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
 const mon=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
 const me=battle.plr; me.gauge=me.deck.splice(0,8); me.life=10; me.hand=[8]; me.drop=me.deck.splice(0,8);
 battle.opp.monsters.center={card:mon,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
 battle.activeSide='opp'; battle.turn='opp'; battle.phase='main'; battle.mode='${mode}'; battle.pendingDefenseContext=null;
 const el=document.getElementById('bnr-actions');
 battle.openCardBanner({card:CARD_MAP.get(8),context:'hand',side:'plr',handIdx:0});
 return JSON.stringify(Array.from(el.children||[]).map(b=>String(b.textContent||'')));})()`));
const local = buttons("hotseat"), online = buttons("online_p2p");
console.log("hotseat buttons:", local, "| online buttons:", online);
const ok = local.some(t => /Counter/.test(t)) && !online.some(t => /Counter/.test(t));
console.log(ok ? "PASS" : "FAIL"); process.exit(ok ? 0 : 1);
