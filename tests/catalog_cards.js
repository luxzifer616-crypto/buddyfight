// node tests/catalog_cards.js - the last cards the catalog could only tag by text (#2920, #402)
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };
(async () => {
  const env = createEnv(); const { flush } = env; const run = (c) => env.run('{' + c + '\n}');
  const settle = async () => { for (let i = 0; i < 30; i++) { flush(); await new Promise(r => setImmediate(r)); } };
  run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=930000;
  globalThis.fresh=function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;
    ['left','center','right'].forEach(p=>{battle.plr.monsters[p]=null;battle.opp.monsters[p]=null;}); };
  globalThis.mk=function(type,extra){ const id=++__n; const c=Object.assign({id,name:'B'+id,type,skill:'',cost:'',attrs:[],worlds:[],world:'Dragon World',img:'',size:1,power:5000,defense:5000,crit:1},extra||{}); CARD_MAP.set(id,c); return c; };
  globalThis.unit=function(side,pos){ const c=mk('Monster'); const u={card:c,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.getFighter(side).monsters[pos]=u; return u; };
  globalThis.callTo=function(pos){ fresh(); const f=battle.plr; f.gauge=[1,2,3,4,5]; globalThis.__victim=unit('opp','left'); f.hand=[2920]; battle.completeMonsterCall('plr',pos,0,false); };`);
  run(`callTo('center');`); await flush();
  ck("#2920 called to center destroys an opponent monster", run(`battle.plr.monsters.center && battle.plr.monsters.center.card.id===2920 && !battle.opp.monsters.left`), run(`[!!battle.plr.monsters.center, !!battle.opp.monsters.left]`));
  run(`callTo('right');`); await flush();
  ck("#2920 called to right does NOT destroy", run(`battle.plr.monsters.right && battle.plr.monsters.right.card.id===2920 && !!battle.opp.monsters.left`), run(`[!!battle.plr.monsters.right, !!battle.opp.monsters.left]`));
  // #402/#405/#2068: "unaffected by the effects of \"Gleipnir\"" -> Gleipnir's "cannot attack" does not stick
  for (const id of [402, 405, 2068]) {
    run(`fresh(); const c=CARD_MAP.get(${id}); globalThis.__u={card:c,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.plr.monsters.center=__u;
      globalThis.__o=unit('plr','left');
      const g=CARD_MAP.get(355); const ab={kind:'spell',tags:[],conds:[],steps:[{op:'restrict',kinds:['attack'],np:{raw:'all monsters',qty:{n:1,all:true},ref:null,self:false,filter:{types:['monster']},zone:{owner:'you',area:'field'}}}],unparsed:[]}; ABX.runAbility('plr', g, ab, null, {});`);
    await flush();
    ck("#" + id + " can still attack after Gleipnir's restriction", run(`!ABX.core.isRestricted(__u,'attack')`), run(`__u.abxNo`));
    ck("#" + id + " test sanity: a normal monster IS restricted", run(`ABX.core.isRestricted(__o,'attack')`), run(`__o.abxNo`));
  }
  // #3709 CHAOS Terrorizer: only when IT is on left/right and a center monster attacks
  for (const [pos, want] of [["left", true], ["center", false]]) {
    run(`fresh(); const c=CARD_MAP.get(3709); battle.plr.monsters['${pos}']={card:c,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0};
      globalThis.__att = battle.plr.monsters.center || unit('plr','center'); globalThis.__victim=unit('opp','right');
      battle.mode='bot'; battle.opp.isBot=true; battle.phase='attack'; ABX.fireAttack('plr',[{zone:'center',zp:'center',unit:__att}],'opp','fighter');`);
    await settle();
    ck("#3709 on " + pos + ": destroy " + (want ? "happens" : "does NOT happen"), run(`!battle.opp.monsters.right === ${want}`), run(`!!battle.opp.monsters.right`));
  }
  console.log(`pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})();
