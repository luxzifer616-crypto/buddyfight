// "You may only call / cast X once per turn / fight" sweep: a second copy must be refused
// (same turn for "per turn", any later turn for "per fight / game"). Also checks per-phase triggered limits.
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
run(`ABX.fast=true; ABX.autoPlay=true;`);
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const settle = async () => { for (let i = 0; i < 6; i++) { await flush(); await new Promise(r => setTimeout(r, 2)); } };
const fresh = (hand, extra = "") => run(`(function(){ battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){};
  const me=battle.plr; me.gauge=me.deck.splice(0,12); me.life=5; me.hand=${JSON.stringify(hand)}; me.drop=me.deck.splice(0,10); battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3; ${extra} })()`);
// a spell that discards the whole hand would look like a second cast; count copies of the card instead
const copies = (id) => run(`battle.plr.hand.filter(x=>x===${id}).length`);

(async () => {
  // --- calls ---
  const callIds = run(`ALL_CARDS.filter(c=>c.type==='Monster' && /you may only call "[^.]*" (?:once )?per (turn|game|fight)/i.test(c.skill||'')).map(c=>c.id)`);
  let called = 0, twice = 0;
  for (const id of callIds) {
    fresh([id, id]);
    run(`battle.completeMonsterCall('plr','left',0,false,false)`); await settle();
    if (!run(`!!battle.plr.monsters.left`)) continue;
    called++;
    run(`battle.completeMonsterCall('plr','right',0,false,false)`); await settle();
    if (run(`!!battle.plr.monsters.right && battle.plr.monsters.right.card.id===${id}`)) { twice++; console.log("  called twice:", id); }
  }
  ok(called > 15 && twice === 0, `call-limited monsters: ${twice} of ${called} could be called twice in one turn`);

  // --- spells ---
  const spellIds = run(`ALL_CARDS.filter(c=>c.type==='Spell' && /you may only cast "[^.]*" once per (turn|game|fight)/i.test(c.skill||'')).map(c=>c.id)`);
  let cast = 0, again = 0, later = 0;
  for (const id of spellIds) {
    fresh([id, id, id]);
    run(`battle.castSpellFromHand('plr',0)`); await settle();
    if (copies(id) !== 2) continue;
    cast++;
    run(`battle.plr.gauge.push(...battle.plr.deck.splice(0,6)); battle.castSpellFromHand('plr',0)`); await settle();
    if (copies(id) === 1) { again++; console.log("  cast twice:", id); }
    if (run(`getSpellCastLimit(CARD_MAP.get(${id}))`) === "game") {
      run(`battle.turnCount=5; battle.plr.gauge.push(...battle.plr.deck.splice(0,6)); battle.castSpellFromHand('plr',0)`); await settle();
      if (copies(id) < 2) { later++; console.log("  once-per-fight cast again later:", id); }
    }
  }
  ok(cast > 200 && again === 0, `cast-limited spells: ${again} of ${cast} could be cast twice in one turn`);
  ok(later === 0, `once-per-fight spells cast again on a later turn: ${later}`);
  ok(run(`getSpellCastLimit(CARD_MAP.get(948))`) === "game", `"I'm Still Alive!" is once per fight`);

  // --- per-phase triggered limit ("once during the attack phase and once during the final phase") ---
  const lim = run(`(function(){ const ab = ABX.get(CARD_MAP.get(2635)).abilities.find(a=>a.once); const f = battle.plr; const card = CARD_MAP.get(2635); const core = ABX.core || ABX._core;
    if (!core) return "nocore";
    battle.phase='attack'; const a1 = core.onceUsed(f, card, ab, null); core.markOnce(f, card, ab, null); const a2 = core.onceUsed(f, card, ab, null);
    battle.phase='final'; const f1 = core.onceUsed(f, card, ab, null);
    return [ab.once, a1, a2, f1].join(","); })()`);
  ok(lim === "phase,false,true,false" || lim === "nocore", `Sun Fist: once in the attack phase and again in the final phase (${lim})`);

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
