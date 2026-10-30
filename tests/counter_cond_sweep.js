// Counter spells that the plain sweep never saw offered: retry each on boards that satisfy its "only cast if ..." text
// (tribe monster / equipped item named in «», empty center, Soulguard or Weapon attacker, every attacked zone).
// Anything still hidden after that is a real gap. Usage: node tests/counter_cond_sweep.js [out.json]
const { createEnv } = require("./headless.js");
const { run } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
const out = JSON.parse(run(`(function(){
 const ids = ALL_CARDS.filter(c=>c.type==='Spell' && (c.cnt || /\\[counter\\]/i.test(c.skill||'')) && !c.set).map(c=>c.id);
 const plain = ALL_CARDS.find(x=>x.type==='Monster'&&x.size===1&&!x.skill);
 const anyItem = ALL_CARDS.find(x=>x.type==='Item'&&!x.skill);
 const mk=(card)=>({card,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});
 const withAttr=(base,attrs)=>Object.assign({},base,{attrs:(base.attrs||[]).concat(attrs)});
 const res=[];
 for (const id of ids){
  const c=CARD_MAP.get(id), sk=c.skill||'';
  const tribes=[...sk.matchAll(/[«<]([^»>]+)[»>]/g)].map(m=>m[1]).concat([...sk.matchAll(/(?:choose an?|if you have an?|reveal an?) ((?:[A-Z][\\w\\-']*)(?: [A-Z][\\w\\-']*)*)/g)].map(m=>m[1]));
  let hit=null, tried=0, err=null;
  const wantSG=/soulguard/i.test(sk), wantWeapon=/weapon/i.test(sk);
  outer: for (const defMon of [false,true]) for (const withTribe of (tribes.length?[false,true]:[false])) for (const att of ['plain','sg','weapon']) for (const lifeLow of [false,true]) for (const defItem of [false,true]) for (const tp of ['fighter','center','left','right']) {
   try{
    battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
    const me=battle.opp; me.gauge=me.deck.splice(0,8); me.life=lifeLow?4:10; me.hand=[c.id]; me.drop=me.deck.splice(0,8);
    const tm = withTribe ? withAttr(plain,tribes) : plain;
    if (defMon || tp!=='fighter') me.monsters[tp==='fighter'?'center':tp]=mk(tm);
    if (withTribe) { me.item=mk(withAttr(anyItem,tribes)); me.drop.push(...ALL_CARDS.filter(x=>(x.attrs||[]).some(t=>tribes.includes(t))).slice(0,10).map(x=>x.id)); } else if (defItem) me.item=mk(anyItem);
    const a=battle.plr; const am = att==='sg'? Object.assign({},plain,{sg:true}) : plain;
    a.monsters.center=mk(am); if (att==='weapon') a.item=mk(anyItem);
    battle.turn='plr'; battle.activeSide='plr'; battle.phase='attack'; tried++;
    const v=battle.getAvailableDefenseCards('opp',false,tp,[att==='weapon'?a.item:a.monsters.center]);
    if (v.some(o=>o.handIdx===0)) { hit={defMon,withTribe,att,lifeLow,defItem,tp}; break outer; }
   }catch(e){err=String(e.message||e).slice(0,80);}
  }
  res.push({id,n:c.name,hit,err,tried,sk:sk.replace(/\\s+/g,' ').slice(0,170)});
 }
 return JSON.stringify(res);})()`));
require("fs").writeFileSync(process.argv[2] || "/tmp/counter_cond_sweep.json", JSON.stringify(out));
const miss = out.filter(r => !r.hit);
console.log("counter spells:", out.length, "| offered on some board:", out.length - miss.length, "| never offered:", miss.length, "| errors:", out.filter(r => r.err).length);
