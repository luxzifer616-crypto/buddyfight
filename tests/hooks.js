const { createEnv } = require("./headless.js");
const env = createEnv(); const { run, flush } = env;
run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=910000;
globalThis.fake=function(side,pos,skill,type){ const id=++__n; const c={id,name:'H'+id,type:type||'Monster',skill,cost:'',attrs:[],worlds:[],img:'',size:1,power:5000,defense:5000,crit:1}; CARD_MAP.set(id,c); const f=battle.getFighter(side); f.monsters[pos]={card:c,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0,actUsed:false}; return f.monsters[pos]; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; return {me:battle.plr,op:battle.opp}; };`);
let pass=0, fail=0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : (extra||"")); };
(async () => {
  let r;
  run(`fresh(); globalThis.__h=battle.plr.hand.length; fake('plr','center','[Auto] At the end of your turn, draw a card.')`);
  run(`ABX.fireTurnEvent('turnEnd')`); await flush(); await new Promise(r=>setTimeout(r,20)); await flush();
  ck("turnEnd trigger draws", run(`battle.plr.hand.length===__h+1`), run(`[battle.plr.hand.length,__h]`));
  run(`fresh(); globalThis.__l=battle.plr.life; fake('plr','left','[Auto] When this card attacks, you gain 1 life.'); globalThis.__au=battle.plr.monsters.left`);
  run(`ABX.fireAttack('plr',[{unit:__au,zone:'left'}],'opp')`); await new Promise(r=>setTimeout(r,20)); await flush();
  ck("attack trigger (self)", run(`battle.plr.life===__l+1`), run(`[battle.plr.life,__l]`));
  run(`fresh(); globalThis.__l=battle.opp.life; fake('opp','left','[Auto] When this card attacks, you gain 1 life.'); globalThis.__au=battle.opp.monsters.left; globalThis.__lp=battle.plr.life`);
  run(`ABX.fireAttack('plr',[{unit:battle.plr.monsters.left||fake('plr','left','x'),zone:'left'}],'opp')`); await new Promise(r=>setTimeout(r,20)); await flush();
  ck("opponent's attack trigger does not fire on my attack", run(`battle.opp.life===__l`));
  run(`fresh()`); for (let i=0;i<6;i++){ await flush(); await new Promise(r=>setTimeout(r,5)); } run(`globalThis.__h=battle.plr.hand.length; globalThis.__src=fake('plr','center','[Auto] At the beginning of your main phase, draw a card.'); battle.phase='start'; battle.phase='main'`);
  await new Promise(r=>setTimeout(r,20)); await flush();
  ck("phaseStart main trigger via phase watcher", run(`battle.plr.hand.length===__h+1`), run(`[battle.plr.hand.length,__h,battle.phase]`));
  run(`fresh(); globalThis.__h=battle.plr.hand.length; fake('plr','center','[Auto] When this card is destroyed, draw a card.'); ABX.fireLeave('plr', battle.plr.monsters.center.card)`);
  await new Promise(r=>setTimeout(r,20)); await flush();
  ck("leave trigger", run(`battle.plr.hand.length===__h+1`));
  run(`fresh(); globalThis.__c=battle.plr.life; fake('plr','center','[Auto] When you cast a spell, you gain 1 life.')`);
  run(`ABX.fireCast('plr', {id:1,type:'Spell',name:'x',attrs:[],worlds:[]})`); await new Promise(r=>setTimeout(r,20)); await flush();
  ck("youCast trigger", run(`battle.plr.life===__c+1`), run(`[battle.plr.life,__c]`));
  ck("phase accessor works", run(`(function(){fresh(); battle.phase='attack'; return battle.phase==='attack'})()`));
  ck("once-per-turn blocks 2nd fire", (()=>{ run(`fresh(); globalThis.__h=battle.plr.hand.length; fake('plr','center','[Auto] At the end of your turn, draw a card. You may only use this ability once per turn.')`); return true; })());
  run(`ABX.fireTurnEvent('turnEnd'); ABX.fireTurnEvent('turnEnd')`); await new Promise(r=>setTimeout(r,30)); await flush();
  ck("  ...once only", run(`battle.plr.hand.length===__h+1`), run(`[battle.plr.hand.length,__h]`));
  run(`fresh()`); for (let i=0;i<6;i++){ await flush(); await new Promise(r=>setTimeout(r,5)); }
  run(`globalThis.__l=battle.plr.life; fake('plr','left','[Auto] When a monster on your field is destroyed, you gain 1 life.'); const v=fake('plr','center',''); battle.destroyMonster('plr','center')`);
  for (let i=0;i<6;i++){ await new Promise(r=>setTimeout(r,10)); await flush(); }
  ck("otherDestroyed trigger", run(`battle.plr.life===__l+1`), run(`[battle.plr.life,__l]`));
  console.log(`\npass ${pass} fail ${fail}`);
})();
