// Choice abilities with some unread options: the readable options are offered and run, the unread ones are left out.
const { createEnv } = require("./headless.js");
const { run, flush } = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const settle = async () => { for (let i = 0; i < 6; i++) { await flush(); await new Promise(r => setTimeout(r, 2)); } };

(async () => {
  run(`ABX.fast=true; ABX.autoPlay=true; battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true)); battle.renderBattle=function(){}; battle.activeSide='plr'; battle.phase='main'; battle.turnCount=3;`);
  // 1604 Respective Battles: "- You gain 2 life." / "- [Ride] a monster with [Ride] from your drop zone ..." (unread)
  const info = JSON.parse(run(`(function(){ const a = ABX.get(CARD_MAP.get(1604)).abilities.find(x => x.kind === "modal");
    return JSON.stringify({ exec: ABX.isExecutable(a), offered: a.options.map(o => ABX.clean(o.raw)), unread: (a.unreadOptions || []).length }); })()`));
  ok(info.exec, "Respective Battles can run");
  ok(info.offered.length === 1 && /gain 2 life/i.test(info.offered[0]), "only the readable option is offered: " + JSON.stringify(info.offered));
  ok(info.unread === 1, "the unread [Ride] option is kept aside for the coverage report");
  run(`battle.plr.life = 5; ABX.fireSpell('plr', CARD_MAP.get(1604));`); await settle();
  ok(run(`battle.plr.life`) === 7, "casting it gains 2 life (life " + run(`battle.plr.life`) + ")");

  // a modal whose options are all readable is untouched
  const full = run(`(function(){ let n = 0, bad = 0; ALL_CARDS.forEach(c => { const p = c.skill && ABX.get(c); if (!p) return; p.abilities.forEach(a => { if (a.kind === "modal" && !a.unreadOptions && a.options && a.options.every(o => ABX.isExecutable(o))) { n++; } if (a.unreadOptions && a.options.some(o => !ABX.isExecutable(o))) bad++; }); }); return n + ":" + bad; })()`);
  ok(+full.split(":")[0] > 50 && full.split(":")[1] === "0", "fully readable choices unchanged, no unread option offered (" + full + ")");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
