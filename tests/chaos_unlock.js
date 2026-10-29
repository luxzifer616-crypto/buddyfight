// "Infinity the Chaos" must be unlocked in the deck (deck.infinityChaos): it sits under "The Chaos" and is never in the play deck.
// "The Chaos Upgrade" can only be cast when it is under the flag. Nothing is added to the deck automatically.
const { createEnv } = require("./headless.js");
const env = createEnv(); const J = (c) => JSON.parse(env.run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const start = (unlocked, withUpgrade) => env.run(`(function(){ const d=generateFlagDeck(3337,"T",3338,false); d.infinityChaos=${unlocked};
  d.cards=d.cards.filter(id=>id!==4072); ${withUpgrade ? "d.cards.push(4072);" : ""}
  battle.start("hotseat", d, generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
  const f=battle.plr; if(${withUpgrade}){ f.deck=f.deck.filter(id=>id!==4072); f.hand=f.hand.filter(id=>id!==4072); f.hand.push(4072); }
  f.drop=f.deck.splice(0,12); battle.activeSide='plr'; battle.phase='main'; })()`);
const castable = () => J(`evaluateCardConditions(CARD_MAP.get(4072), battle.plr, battle.opp).met`);

start(false, true);
ok(J(`(battle.plr.flagUnder||[]).length`) === 0, "not unlocked: nothing under the flag");
ok(!castable(), "not unlocked: 'The Chaos Upgrade' cannot be cast");
ok(J(`[...battle.plr.deck,...battle.plr.hand].includes(3941)`) === false, "not unlocked: Infinity is not in the deck or hand");

start(true, true);
ok(J(`battle.plr.flagUnder`).includes(3941), "unlocked: Infinity starts face down under the flag");
ok(J(`[...battle.plr.deck,...battle.plr.hand].includes(3941)`) === false, "unlocked: Infinity is never in the play deck / hand");
ok(castable(), "unlocked: 'The Chaos Upgrade' can be cast with 10+ cards in drop");
env.run(`ABX.fireSpell("plr", CARD_MAP.get(4072))`); for (let i = 0; i < 20; i++) env.flush();
ok(J(`battle.plr.flagId`) === 3941, "unlocked: casting flips the flag to Infinity the Chaos");
ok(!castable(), "after the flip it cannot be cast again (nothing left under the flag)");

start(true, false);
ok(J(`[...battle.plr.deck,...battle.plr.hand].includes(4072)`) === false, "'The Chaos Upgrade' is not added automatically when the deck lacks it");

const g = J(`(function(){const d=generateFlagDeck(3337,"T",3338,false);return {inf:d.infinityChaos,up:d.cards.includes(4072),has3941:d.cards.includes(3941)}})()`);
ok(g.inf === true && g.up && !g.has3941, "generated 'The Chaos' deck: unlocked and contains The Chaos Upgrade");
console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
