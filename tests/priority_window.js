// Counter window while the bot plays: prompt only when the human has a usable free [Counter]; Pass keeps the card, choosing it casts it.
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
run(`ABX.fast=true;`);
let pass = 0, fail = 0;
const ck = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n); };
const t = (js) => JSON.parse(run(`JSON.stringify((function(){${js}})())`));
const settle = async () => { for (let i = 0; i < 20; i++) { flush(); await new Promise(r => setImmediate(r)); } };
run(`globalThis.prompts=[]; globalThis.answer=null; ABX.ui.pickOption=function(o){ prompts.push(o.title); const a=(typeof answer==='function')?answer(o):answer; return Promise.resolve(a); };
 globalThis.setup=function(hand){ ABX.autoPlay=false; battle.start('bot', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  battle.plr.isBot=false; const me=battle.plr; me.gauge=me.deck.splice(0,8); me.life=5; me.hand=hand.slice(); me.drop=me.deck.splice(0,8);
  battle.activeSide='opp'; battle.turn='opp'; battle.phase='attack'; battle.turnCount=5; battle.matchOver=false; prompts.length=0; globalThis.cont=0; };`);
(async () => {
  run(`setup([3814]); answer=(o)=>o.options.length-1;`);   // Pass
  ck("3814 is a free counter in this setup", t(`return ABX.freeCounterOption('plr',CARD_MAP.get(3814));`));
  run(`battle.botPriority('test', ()=>{ cont++; });`); await settle();
  ck("prompt shown, Pass -> card kept, game continues", t(`return prompts.length>=1 && /Counter window/.test(prompts[0]) && battle.plr.hand.length===1 && cont===1;`));
  run(`setup([3814]); answer=(o)=>/Counter window/.test(o.title)?0:o.options.length-1; globalThis.__l0=battle.plr.life;`);
  run(`battle.botPriority('test', ()=>{ cont++; });`); await settle();
  ck("choosing the counter casts it (card left the hand, life went up), game continues", t(`return battle.plr.hand.length===0 && battle.plr.life>__l0 && cont===1;`));
  run(`setup([]); answer=0;`);
  run(`battle.botPriority('test', ()=>{ cont++; });`); await settle();
  ck("nothing usable -> no prompt, game continues", t(`return prompts.length===0 && cont===1;`));
  run(`setup([3814]); battle.mode='online_p2p'; answer=0;`);
  run(`battle.botPriority('test', ()=>{ cont++; });`); await settle();
  ck("online P2P -> no prompt", t(`return prompts.length===0 && cont===1 && battle.plr.hand.length===1;`));
  // a whole bot turn still runs to the end with the window hooks in place (with and without a usable counter)
  for (const hand of [[], [3814]]) {
    run(`ABX.autoPlay=false; battle.start('vs_bot', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; prompts.length=0; answer=(o)=>o.options.length-1;
     battle.plr.isBot=false; battle.plr.hand=${JSON.stringify(hand)}; battle.plr.gauge=battle.plr.deck.splice(0,8); battle.plr.life=40;
     globalThis.__t0=battle.turnCount; battle.activeSide='opp'; battle.turn='opp'; battle.phase='main'; battle.runBotTurn();`);
    for (const end = Date.now() + 15000; Date.now() < end;) { flush(); run(`if (battle.pendingDefenseContext) battle.resolveDefenseChoice(null);`); await new Promise(r => setTimeout(r, 2)); if (t(`return battle.activeSide==='plr' && battle.turnCount>__t0;`)) break; }
    ck(`a full bot turn finishes (plr hand ${JSON.stringify(hand)}), counter prompts shown: ` + t(`return prompts.filter(p=>/Counter window/.test(p)).length;`), t(`return battle.activeSide==='plr' && battle.turnCount>__t0;`));
  }
  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
