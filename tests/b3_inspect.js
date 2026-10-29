// B3: while it is NOT your turn (bot / online friend), you can still open any card's banner to read its skill,
// but the banner is read-only (no Attack / Call / Act buttons).
const { createEnv } = require("./headless.js");
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(extra ?? "")); };

(async () => {
  const env = createEnv(); const { flush } = env; const run = (c) => env.run('{' + c + '\n}');
  run(`ABX.fast=true; ABX.autoPlay=true; globalThis.__n=930000;
  globalThis.__origOpen=battle.openCardBanner;
  globalThis.fresh=function(){ battle.openCardBanner=__origOpen; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; };
  globalThis.mk=function(type,extra){ const id=++__n; const c=Object.assign({id,name:'B'+id,type,skill:'[Act] Draw a card.',cost:'',attrs:[],worlds:[],world:'Dragon World',img:'',power:3000,defense:2000,crit:1,size:1,rawText:''},extra||{}); CARD_MAP.set(id,c); return c; };
  globalThis.unit=function(side,pos,extra){ const c=mk('Monster',extra); const u={card:c,rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0}; battle.getFighter(side).monsters[pos]=u; return u; };
  // "not my turn": the bot is active.
  globalThis.botTurn=function(){ fresh(); battle.mode='vs_bot'; battle.opp.isBot=true; battle.activeSide='opp'; battle.phase='main'; };
  globalThis.spy=function(){ globalThis.__opened=[]; battle.openCardBanner=function(o){ __opened.push(o); }; };`);

  // 1. Own hand card can be opened on the opponent's turn (and it is the PLAYER's hand, not the bot's).
  run(`botTurn(); spy(); const c=mk('Monster'); battle.plr.hand=[c.id]; battle.opp.hand=[mk('Spell').id]; globalThis.__c=c; battle.onHandCardClick(0);`);
  ck("B3 hand card opens its banner on the opponent's turn", run(`__opened.length===1 && __opened[0].card.id===__c.id`), run(`__opened.length`));
  ck("B3 ...it is the player's own hand", run(`__opened.length===1 && __opened[0].side==='plr'`), run(`__opened.map(o=>o.side)`));

  // 2. Own and enemy field cards open on the opponent's turn.
  run(`botTurn(); spy(); globalThis.__u1=unit('plr','left'); globalThis.__u2=unit('opp','center'); battle.onZoneClick('plr','left'); battle.onZoneClick('opp','center');`);
  ck("B3 own field monster opens on the opponent's turn", run(`__opened.some(o=>o.card.id===__u1.card.id && o.side==='plr')`), run(`__opened.length`));
  ck("B3 enemy field monster opens on the opponent's turn", run(`__opened.some(o=>o.card.id===__u2.card.id && o.side==='opp')`), run(`__opened.length`));

  // 3. The real banner is read-only on the opponent's turn: only the Close button, no Attack / Act / Call.
  run(`botTurn(); globalThis.__u3=unit('opp','center'); globalThis.__u3.card.skill='[Act] Draw a card.'; battle.openCardBanner({card:__u3.card,context:'field',side:'opp',zonePos:'center',unit:__u3});`);
  ck("B3 bot's unit banner has no action buttons (Close only)", run(`document.getElementById('bnr-actions').__children.length===1`), run(`document.getElementById('bnr-actions').__children.map(c=>c.textContent)`));
  run(`botTurn(); const hc=mk('Monster'); battle.plr.hand=[hc.id]; battle.onHandCardClick(0);`);
  ck("B3 own hand banner on the opponent's turn has no Call/Charge buttons", run(`document.getElementById('bnr-actions').__children.length===1`), run(`document.getElementById('bnr-actions').__children.map(c=>c.textContent)`));

  // 4. Nothing changed for your own turn: hand click still opens the hand banner with actions, and charge mode still works.
  run(`fresh(); battle.phase='main'; battle.activeSide='plr'; const hc=mk('Monster'); battle.plr.hand=[hc.id]; battle.onHandCardClick(0);`);
  ck("own turn: hand banner still has action buttons", run(`document.getElementById('bnr-actions').__children.length>1`), run(`document.getElementById('bnr-actions').__children.map(c=>c.textContent)`));

  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
