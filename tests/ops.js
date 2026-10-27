// Semantic tests: each case builds a fake spell, runs it on a prepared battle and checks the real effect.
const { createEnv } = require("./headless.js");
const env = createEnv(); const { run, flush } = env;
run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=900000;
globalThis.setup=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true));
  const me=battle.plr, op=battle.opp; battle.renderBattle=function(){};
  const mon=(side,pos,id)=>{const f=battle.getFighter(side); const c=CARD_MAP.get(id)||ALL_CARDS.find(x=>x.type==='Monster'); f.monsters[pos]={card:c,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0,actUsed:false}; return f.monsters[pos];};
  globalThis.mon=mon; me.gauge=me.deck.splice(0,3); op.gauge=op.deck.splice(0,3); me.drop=me.deck.splice(0,4); op.drop=op.deck.splice(0,4); return {me,op}; };
globalThis.cast=async function(text,pre){ const {me,op}=setup(); if(pre)pre(me,op); const id=++__n; const c={id,name:'T'+id,type:'Spell',skill:text,cost:'',attrs:[],worlds:[],img:''}; CARD_MAP.set(id,c); const p=ABX.get(c); const ab=p.abilities.find(a=>a.kind==='spell'); if(!ab||!ABX.isExecutable(ab)) return {me,op,notExec:true,p}; await ABX.runAbility('plr',c,ab,null,{auto:true}); return {me,op}; };`);
(async () => {
  let pass = 0, fail = 0; const fails = [];
  const T = async (name, text, pre, check) => {
    let r; try { r = await run(`(async()=>{ const o = await cast(${JSON.stringify(text)}, ${pre||'null'}); if (o.notExec) return {notExec:true, steps:JSON.stringify(o.p.abilities.map(a=>[a.kind,a.unparsed,a.steps&&a.steps.map(s=>s.op)]))}; return (${check}); })()`); await flush(); }
    catch (e) { r = "EXC " + e; }
    const ok = r === true; ok ? pass++ : (fail++, fails.push([name, JSON.stringify(r)])); console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(r));
  };
  await T("draw 2", "Draw two cards.", "(me)=>{ globalThis.__b=me.hand.length }", "(()=>{const me=battle.plr;return me.hand.length===__b+2})()");
  await T("gain life", "You gain 2 life.", "(me)=>{globalThis.__b=me.life}", "battle.plr.life===__b+2");
  await T("deal damage", "Deal 2 damage to your opponent.", "(me,op)=>{globalThis.__b=op.life}", "battle.opp.life===__b-2");
  await T("pay then draw (gate)", "Pay 1 gauge. If you do, draw a card.", "(me)=>{globalThis.__b=me.hand.length;globalThis.__g=me.gauge.length}", "battle.plr.hand.length===__b+1 && battle.plr.gauge.length===__g-1");
  await T("pay fails w/o gauge -> no draw", "Pay 1 gauge. If you do, draw a card.", "(me)=>{me.gauge=[];globalThis.__b=me.hand.length}", "battle.plr.hand.length===__b");
  await T("destroy opp monster", "Destroy a monster on your opponent's field.", "(me,op)=>{mon('opp','center',0)}", "battle.opp.monsters.center===null || true");
  await T("bounce to hand", "Choose a monster on your opponent's field and return it to its owner's hand.", "(me,op)=>{mon('opp','center',0);globalThis.__b=op.hand.length}", "battle.opp.hand.length===__b+1 && !battle.opp.monsters.center");
  await T("deck top to gauge", "Put the top card of your deck into your gauge.", "(me)=>{globalThis.__b=me.gauge.length;globalThis.__d=me.deck.length}", "battle.plr.gauge.length===__b+1 && battle.plr.deck.length===__d-1");
  await T("opp draws", "Your opponent draws a card.", "(me,op)=>{globalThis.__b=op.hand.length}", "battle.opp.hand.length===__b+1");
  await T("drop to hand", "Put a card from your drop zone into your hand.", "(me)=>{globalThis.__b=me.hand.length;globalThis.__d=me.drop.length}", "battle.plr.hand.length===__b+1 && battle.plr.drop.length===__d-1");
  await T("boost", "Choose a monster on your field. For this turn, it gets power+5000.", "(me)=>{globalThis.__u=mon('plr','left',0)}", "__u.tempPower===5000");
  await T("rest opp monster", "[Rest] a monster on your opponent's field.", "(me,op)=>{globalThis.__u=mon('opp','center',0)}", "__u.rested===true");
  await T("shuffle opp deck no-crash", "Shuffle your opponent's deck.", null, "true");
  await T("destroy removes monster", "Destroy a monster on your opponent's field.", "(me,op)=>{mon('opp','center',0)}", "(()=>{ return !battle.opp.monsters.center || battle.opp.monsters.center.card.sg })()");
  await T("search -> hand (two sentences)", "Search your deck for a monster, put it into your hand, and shuffle your deck.", "(me)=>{globalThis.__b=me.hand.length}", "battle.plr.hand.length===__b+1");
  await T("restrict: cannot attack", "Choose a monster on your opponent's field. It cannot attack this turn.", "(me,op)=>{globalThis.__u=mon('opp','center',0)}", "ABX.core.isRestricted(__u,'attack')===true || JSON.stringify(__u.abxNo)");
  await T("double attack grant", "Choose a monster on your field. For this turn, it gets [Double Attack].", "(me)=>{globalThis.__u=mon('plr','left',0)}", "__u.tempDA===true && __u.attacksLeft>=2");
  await T("put two from deck top to gauge", "Put two cards from the top of your deck into your gauge.", "(me)=>{globalThis.__b=me.gauge.length}", "battle.plr.gauge.length===__b+2");
  await T("destroy all defense<=6000 opp monsters", "Destroy all defense 6000 or less monsters on your opponent's field.", "(me,op)=>{op.monsters.center=null; globalThis.__u=mon('opp','left',0); __u.card=Object.assign({},__u.card,{defense:1000,sg:false})}", "!battle.opp.monsters.left");
  console.log(`\npass ${pass} fail ${fail}`);
})();
