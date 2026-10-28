// Continuous protections (abilities_r20.js): read from one sentence, and enforced against the opponent's effects.
const { createEnv } = require("./headless.js");
const { run } = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };

(async () => {
  run(`battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true;
    window.__f = battle.plr; ["left","center","right"].forEach(p => { battle.plr.monsters[p] = null; battle.opp.monsters[p] = null; }); battle.plr.item = null;
    window.__mk = (id, soul) => ({ card: CARD_MAP.get(id), rested: false, attacksLeft: 1, soul: soul || [], tempPower: 0, tempDef: 0, tempCrit: 0 });
    window.__opp = (card) => ({ side: "opp", f: battle.opp, e: battle.plr, card: card || ALL_CARDS.find(c => c.type === "Spell"), unit: null, bind: { chosen: [] }, ab: { kind: "spell" } });
    window.__mon = ALL_CARDS.find(c => c.type === "Monster" && c.size === 1 && !/cannot/i.test(c.skill || ""));
    window.__spell = ALL_CARDS.find(c => c.type === "Spell");`);
  const r = JSON.parse(await run(`(async function(){
    const f = __f, P = ABX.core.isProtected, out = {};
    // 6214: "This card on the field cannot be destroyed or returned to hand and its souls cannot be dropped by your opponent's card effects."
    out.read6214 = ABX.get(CARD_MAP.get(6214)).abilities.some(a => (a.steps || []).some(s => s.r20 && s.kinds.includes("souls dropped")) && !(a.unparsed || []).length);
    f.monsters.center = __mk(6214, [1, 2]);
    await ABX.OPS.dropSoul.run({ op: "dropSoul", n: 1, hostNP: Object.assign(ABX.parseNP("a card on your opponent's field"), { qty: { n: 1, all: true } }) }, __opp());
    out.soulKept = f.monsters.center.soul.length;
    f.monsters.center = __mk(__mon.id, [1, 2]);
    await ABX.OPS.dropSoul.run({ op: "dropSoul", n: 1, hostNP: Object.assign(ABX.parseNP("a card on your opponent's field"), { qty: { n: 1, all: true } }) }, __opp());
    out.soulLost = f.monsters.center.soul.length;
    // 6322 in a soul: "The «Sun Dragon» with this card in its soul cannot be destroyed ..."
    const sun = CARD_MAP.get(1807);   // a «Sun Dragon» monster
    f.monsters.center = __mk(sun.id, [6322]);
    out.sunHost = P(f.monsters.center, "plr", "destroyed", __opp());
    out.sunHostOwn = P(f.monsters.center, "plr", "destroyed", { side: "plr", card: __spell });
    f.monsters.center = __mk(__mon.id, [6322]);
    out.otherHost = P(f.monsters.center, "plr", "destroyed", __opp());
    // 2853: "This card on your field cannot be destroyed by the effect of a monster."
    f.monsters.center = __mk(2853);
    out.byMonster = P(f.monsters.center, "plr", "destroyed", __opp(__mon));
    out.bySpell = P(f.monsters.center, "plr", "destroyed", __opp(__spell));
    // 4927: "This card's power and critical cannot be reduced by your opponent's card effects."
    f.monsters.center = __mk(4927);
    out.lockPow = ABX.statLocked("plr", f.monsters.center, "power", true);
    out.lockDef = ABX.statLocked("plr", f.monsters.center, "defense", true);
    out.lockOwn = ABX.statLocked("plr", f.monsters.center, "power", false);
    // 4873: "If you have only one monster on your field, all cards on your field cannot be destroyed, returned to hand or be [Rest] ..."
    f.monsters.center = __mk(4873);
    out.alone = [P(f.monsters.center, "plr", "rest", __opp()), P(f.monsters.center, "plr", "returned to hand", __opp())];
    f.monsters.left = __mk(__mon.id);
    out.notAlone = P(f.monsters.center, "plr", "rest", __opp());
    f.monsters.left = null;
    return JSON.stringify(out);
  })()`));

  ok(r.read6214, "6214's soul protection reads as one continuous ability");
  ok(r.soulKept === 2 && r.soulLost === 1, `opponent's "drop a soul" skips 6214 but hits a normal monster (${r.soulKept}, ${r.soulLost})`);
  ok(r.sunHost === true && r.sunHostOwn === false, `6322 in a «Sun Dragon»'s soul: host can't be destroyed by the opponent (${r.sunHost}), own effects still can (${r.sunHostOwn})`);
  ok(r.otherHost === false, `6322 in a non-«Sun Dragon» soul protects nothing (${r.otherHost})`);
  ok(r.byMonster === true && r.bySpell === false, `2853 stops only monster effects (monster ${r.byMonster}, spell ${r.bySpell})`);
  ok(r.lockPow === true && r.lockDef === false && r.lockOwn === false, `4927 locks power (not defense, not own effects) (${r.lockPow}, ${r.lockDef}, ${r.lockOwn})`);
  ok(r.alone.every(Boolean) && r.notAlone === false, `4873 protects only while it is your only monster (${r.alone}, ${r.notAlone})`);

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
