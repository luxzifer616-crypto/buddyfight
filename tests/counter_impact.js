// Impact [Counter] spells (the ones the old text classifier does not know; classified attack-cancel impacts keep their any-phase rule): offered in the defense window and as the opponent's-turn Counter button during the Final Phase only.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
const r = JSON.parse(run(`(function(){
 const ids=ALL_CARDS.filter(c=>c.type==='Impact' && ABX.ownsCounter(c) && !(window.IMX&&IMX.isImpactMonster(c))).map(c=>c.id);
 const plain=ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill), item=ALL_CARDS.find(x=>x.type==='Item'&&!x.skill);
 const mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 let finalOff=0, otherOff=0, freeFinal=0, freeOther=0, errs=0;
 for (const id of ids){ const c=CARD_MAP.get(id), tribes=[...(c.skill||'').matchAll(/[«<]([^»>]+)[»>]/g)].map(m=>m[1]);
  for (const phase of ['final','attack']) { let hit=false, free=false;
   for (const low of [false,true]) for (const withT of [false,true]) for (const mon of [false,true]) { try{
    battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
    const me=battle.opp; me.gauge=me.deck.splice(0,10); me.life=low?4:10; me.hand=[id]; me.drop=me.deck.splice(0,8);
    if (mon) me.monsters.center=mk(withT?Object.assign({},plain,{attrs:tribes}):plain); if (withT) me.item=mk(Object.assign({},item,{attrs:tribes}));
    const a=battle.plr; a.monsters.center=mk(plain); battle.turn='plr'; battle.activeSide='plr'; battle.phase=phase; battle.turnCount=4;
    if (battle.getAvailableDefenseCards('opp',false,'fighter',[a.monsters.center]).some(o=>o.handIdx===0)) hit=true;
    if (ABX.freeCounterOption('opp',c)) free=true;
   }catch(e){errs++;} }
   if (phase==='final'){ if(hit) finalOff++; if(free) freeFinal++; } else { if(hit && !classifyDefensiveCounterCard(c)) otherOff++; if(free) freeOther++; } } }
 return JSON.stringify({impacts:ids.length,finalOff,otherOff,freeFinal,freeOther,errs}); })()`));
console.log(r);
const ok = r.impacts > 0 && r.finalOff > 0 && r.otherOff === 0 && r.freeOther === 0 && r.errs === 0;
console.log(ok ? "PASS" : "FAIL"); process.exit(ok ? 0 : 1);
