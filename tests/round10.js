// Round 10: abilities whose text could not be read before (new triggers, replacement effects, common clauses).
const { createEnv } = require("./headless.js");
const env = createEnv();
const run = (c) => env.run("{" + c + "\n}");
const val = (c) => env.run(c);
env.run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=995000;
globalThis.mk=function(skill,extra){ const id=++__n; const c=Object.assign({id,name:'S'+id,type:'Monster',skill:skill||'',cost:'',attrs:[],worlds:[],world:'Hero World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
globalThis.put=function(side,pos,card){ const u={card,rested:false,attacksLeft:card.atk_max||1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; const f=battle.getFighter(side); if(pos==='item') f.item=u; else f.monsters[pos]=u; return u; };
globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='attack'; battle.turnCount=3;
  [battle.plr,battle.opp].forEach(f=>{ ['left','center','right'].forEach(p=>f.monsters[p]=null); f.item=null; f.gauge=f.deck.splice(0,4); f.life=10; f.hand=[]; f.setSpells=[]; f.drop=[]; }); };`);
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
const settle = async () => { for (let i = 0; i < 12; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
const exec = (id, pred) => val(`ABX.get(CARD_MAP.get(${id})).abilities.some(a=>(${pred})(a) && ABX.isExecutable(a))`);

(async () => {
  // link attack with another «Sun Dragon»
  run(`fresh(); globalThis.__a=put('plr','left',CARD_MAP.get(2404)); globalThis.__b=put('plr','right',mk('',{attrs:['SunDragon']})); globalThis.__c=put('plr','center',mk(''));`);
  run(`ABX.fireAttack('plr',[{unit:__a,zone:'left'},{unit:__c,zone:'center'}],'opp','fighter')`); await settle();
  ck("2404: link with a non-«Sun Dragon» gives nothing", val(`!__a.tempDA`));
  run(`ABX.fireAttack('plr',[{unit:__a,zone:'left'},{unit:__b,zone:'right'}],'opp','fighter')`); await settle();
  ck("2404: link with another «Sun Dragon» gives [Double Attack]", val(`!!__a.tempDA`));
  // soul card triggers when its host attacks
  ck("1617-style 'the «X» with this card in its soul attacks' is executable", exec(1655, `a=>a.trigger&&a.trigger.event==='hostAttack'`));
  // [Stand] by card effects
  run(`fresh(); globalThis.__r=put('plr','left',CARD_MAP.get(5581)); __r.rested=true; globalThis.__h0=battle.plr.hand.length; globalThis.__l0=battle.opp.life;`);
  run(`ABX.runAbility('plr', mk('[Act] [Stand] a monster on your field.'), ABX.get(CARD_MAP.get(__n)).abilities.find(a=>a.kind==='act'), null)`); await settle();
  ck("5581: stood by an effect -> draws and deals 1 damage", val(`!__r.rested && battle.plr.hand.length===__h0+1 && battle.opp.life===__l0-1`), val(`[__r.rested, battle.plr.hand.length-__h0, __l0-battle.opp.life]`));
  // "When this card A or B" is split
  ck("1534: 'enters the field or is destroyed' -> two abilities", val(`(function(){ const ab=ABX.get(CARD_MAP.get(1534)).abilities.filter(a=>a.trigger && ABX.isExecutable(a)); return ab.some(a=>a.trigger.event==='enter') && ab.some(a=>a.trigger.event==='leave'); })()`));
  // then-if chains
  ck("4226: 'Then, if five or more, …' repeats the world-name count", val(`(function(){ const a=ABX.get(CARD_MAP.get(4226)).abilities.find(a=>a.trigger); return ABX.isExecutable(a) && a.steps.some(x=>x.cond && x.cond.t==='xWorldNames' && x.cond.n===5); })()`));
  // if it is not
  ck("3054: 'If it is not, …' becomes the opposite of the previous condition", exec(3054, `a=>(a.steps||[]).some(x=>x.cond&&x.cond.t==='not')`));
  // rock-paper-scissors
  ck("242: rock-paper-scissors + 'If you win' is executable", exec(242, `a=>(a.steps||[]).some(x=>x.op==='rps')`));
  // declare either monster or spell
  ck("945: 'declare either monster or spell … if that card is of the declared card type' is executable", exec(945, `a=>a.kind==='act'`));
  // replacement effects
  run(`fresh(); battle.activeSide='opp'; globalThis.__s=put('plr','left',CARD_MAP.get(263)); globalThis.__g0=battle.plr.gauge.length;`);
  ck("263: would be destroyed -> pays 1 gauge and stays", val(`battle.destroyMonster('plr','left')===false && battle.plr.monsters.left===__s && battle.plr.gauge.length===__g0-1`));
  run(`battle.plr.gauge=[];`);
  ck("263: …can't pay -> destroyed", val(`battle.destroyMonster('plr','left')!==false`));
  run(`fresh(); battle.activeSide='opp'; globalThis.__keep=put('plr','left',mk('',{attrs:['AutodeityArmy']})); globalThis.__sv=put('plr','right',CARD_MAP.get(3987));`);
  ck("3987: another «Autodeity Army» would be destroyed -> this card goes instead", val(`battle.destroyMonster('plr','left')===false && battle.plr.monsters.left===__keep && !battle.plr.monsters.right && battle.plr.drop.includes(3987)`), val(`[!!battle.plr.monsters.left, !!battle.plr.monsters.right]`));
  run(`fresh(); globalThis.__z=put('plr','center',CARD_MAP.get(1681)); __z.soul=[1]; battle.plr.life=0; battle.checkWinCondition();`);
  ck("1681: life would become 0 -> drop a soul, life becomes 1", val(`battle.plr.life===1 && !battle.matchOver && __z.soul.length===0`));
  // cannot gain life
  run(`fresh(); put('opp','left',mk('Your opponent cannot gain life.')); ABX.watchFighters(); battle.plr.life=5; battle.plr.life=8;`);
  ck("'Your opponent cannot gain life' blocks life gain", val(`battle.plr.life===5`), val(`battle.plr.life`));
  // opponent cannot use [Counter]
  run(`fresh(); ABX.runAbility('plr', mk('[Act] Your opponent cannot use [Counter].'), ABX.get(CARD_MAP.get(__n)).abilities.find(a=>a.kind==='act'), null)`); await settle();
  ck("'your opponent cannot use [Counter]' stops their counters", val(`battle.opp.timeStoppedThisTurn===true || battle.opp.timeStoppedThisBattle===true`));
  // called by an effect
  run(`fresh(); globalThis.__cid=mk('',{size:0}).id; battle.plr.drop=[__cid]; ABX.runAbility('plr', mk('[Act] Call a monster from your drop zone.'), ABX.get(CARD_MAP.get(__n)).abilities.find(a=>a.kind==='act'), null)`); await settle();
  ck("monsters called by an effect are marked (for 'if this card entered the field by card effects')", val(`['left','center','right'].some(p=>battle.plr.monsters[p] && battle.plr.monsters[p].card.id===__cid && battle.plr.monsters[p].abxByEffect)`));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
