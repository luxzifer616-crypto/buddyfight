const { createEnv } = require("./headless.js");
const { run } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
const out = JSON.parse(run(`(function(){
 const ids = ALL_CARDS.filter(c=>c.cnt || /\\[counter\\]/i.test(c.skill||'')).map(c=>c.id);
 const res=[];
 const mon = ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
 for (const id of ids){
  const c=CARD_MAP.get(id); let hits={fighter:false,center:false}, err=null;
  for (const tp of ['fighter','center']){
   try{
    battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
    const me=battle.opp; me.gauge=me.deck.splice(0,8); me.life=10; me.hand=[c.id]; me.drop=me.deck.splice(0,8);
    if (tp==='center') me.monsters.center={card:mon,rested:false,soul:[],tempPower:0,tempDef:0,tempCrit:0};
    const att=battle.plr; att.monsters.center={card:mon,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
    battle.turn='plr'; battle.phase='attack';
    const v=battle.getAvailableDefenseCards('opp',false,tp,[att.monsters.center]);
    if (v.some(o=>o.handIdx===0)) hits[tp]=true;
   }catch(e){err=String(e.message||e).slice(0,80);}
  }
  res.push({id,n:c.name,t:c.type,w:(c.worlds||[]).join('/'),abx:!!(ABX.ownsCounter&&ABX.ownsCounter(c)),cls:(classifyDefensiveCounterCard(c)||{}).category||null,f:hits.fighter,c:hits.center,err,sk:(c.skill||'').replace(/\\s+/g,' ').slice(0,160)});
 }
 return JSON.stringify(res);})()`));
require("fs").writeFileSync(process.argv[2]||"/tmp/counter_sweep.json", JSON.stringify(out));
const none=out.filter(r=>!r.f&&!r.c);
console.log("counter cards:",out.length,"usable(any target):",out.length-none.length,"never offered:",none.length);
const by={}; none.forEach(r=>{const k=r.t+(r.abx?' abx':' noabx')+(r.cls?' cls':' nocls')+(r.err?' ERR':''); by[k]=(by[k]||0)+1}); console.log(by);
