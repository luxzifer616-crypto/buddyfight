// [Equipment Change]: when equipping, the replaced item returns to hand instead of the drop zone - once per turn.
const { createEnv } = require("./headless.js");
const env = createEnv(); const val = (c) => env.run(c);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
val(`ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.animateCardFlight=(a,b,c,d,e,cb)=>cb&&cb();
 globalThis.eq=(side)=>{ const f=battle.plr; battle.activeSide='plr'; battle.phase='main'; battle.matchOver=false; f.gauge=f.deck.splice(0,8); f.item=null; f.item2=null; f.extraItems=[]; f.hand=[]; f.drop=[]; };`);
val(`eq(); { const f=battle.plr; f.item={card:CARD_MAP.get(1225),rested:false,attacksLeft:1,soul:[]}; f.hand=[343]; battle.equipCardFromHand('plr',0); }`);
ok(val(`battle.plr.hand.includes(1225) && !battle.plr.drop.includes(1225) && battle.plr.item.card.id===343`), "1st Equipment Change in a turn returns the old item to hand");
val(`{ const f=battle.plr; f.hand=[344]; battle.equipCardFromHand('plr',0); }`);
ok(val(`battle.plr.drop.includes(343) && !battle.plr.hand.includes(343) && battle.plr.item.card.id===344`), "2nd Equipment Change in the same turn: old item goes to the drop zone");
val(`{ battle.turnCount+=2; const f=battle.plr; f.hand=[345]; battle.equipCardFromHand('plr',0); }`);
ok(val(`battle.plr.hand.includes(344) && battle.plr.item.card.id===345`), "next turn Equipment Change works again");
console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
