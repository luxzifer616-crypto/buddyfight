// "At the end of the battle this card attacked, you may pay N gauge. If you do not, destroy this card."
//  - only fires when THIS card attacked; paying keeps the card, not paying destroys it ("if you do not" must not be "if you do").
const { createEnv } = require("./headless.js");
const env = createEnv(); const run = env.run; const J = (c) => JSON.parse(run(`JSON.stringify(${c})`));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,false), generateFlagDeck(447,"O",571,false)); battle.renderBattle=function(){}; ABX.autoPlay=true; ABX.fast=true;
 globalThis.mku=(id)=>({card:CARD_MAP.get(id),rested:false,attacksLeft:1,soul:[],tempPower:0,tempDef:0,tempCrit:0});`);
// structure
for (const id of [3658, 4043, 4087]) {
  const s = J(`(function(){ const ab=ABX.get(CARD_MAP.get(${id})).abilities.find(a=>a.trigger&&a.trigger.event==='battleEnd'); const d=ab.steps.find(s=>s.op==='destroy'); return {self:ab.trigger.self, gate:d&&d.gate}; })()`);
  ok(s.self === true, `#${id} battle-end trigger is only for this card (self)`);
  ok(s.gate === "ifNotDone", `#${id} destroy happens only if you did NOT pay (gate=${s.gate})`);
}
// no card text is parsed as "if you do" when it says "if you do not"
const bad = J(`(function(){const b=[];for(const c of ALL_CARDS){for(const a of ABX.get(c).abilities){ if(/if you do not(?!\\s+(?:have|control|own))/i.test(a.raw||"") && (a.steps||[]).some(s=>s.gate==="ifYouDo")) b.push(c.id)}}return b})()`);
ok(bad.length === 0, `no 'if you do not' text keeps the ifYouDo gate (${bad.length} left: ${bad.slice(0,10)})`);
// behaviour (#4087: pay 2 gauge, otherwise destroyed)
const bm = (gauge, attacker) => {
  run(`{ const f=battle.plr; ["left","center","right"].forEach(p=>f.monsters[p]=null); f.monsters.center=mku(4087); f.monsters.left=mku(46); f.gauge=f.deck.splice(0,${gauge}); f.drop=[]; battle.activeSide='plr'; battle.phase='attack'; }`);
  run(`ABX.fireBattleEnd('plr', [{unit: battle.plr.monsters.${attacker}}]);`);
};
(async () => {
  const settle = async () => { for (let i = 0; i < 40; i++) { env.flush(); await new Promise(r => setTimeout(r, 2)); } };
  bm(5, "left"); await settle();
  ok(J(`!!battle.plr.monsters.center && battle.plr.gauge.length===5`), "#4087 does nothing when ANOTHER monster attacked");
  bm(5, "center"); await settle();
  ok(J(`!!battle.plr.monsters.center && battle.plr.gauge.length===3`), "#4087 pays 2 gauge and stays when it attacked (autoPlay pays)");
  bm(1, "center"); await settle();
  ok(J(`!battle.plr.monsters.center`), "#4087 is destroyed when it attacked and cannot pay");
  console.log(fail ? "FAILED " + fail : "ALL PASSED"); process.exit(fail ? 1 : 0);
})();
