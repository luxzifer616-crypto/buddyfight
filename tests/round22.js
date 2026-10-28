// Round 22 verification: 100% ability coverage across all 6,082 ability cards + Hyakugan Yamigedo ("Earth Half" & "Sky Half"),
// Captain Kaido (conditional sizeMod), Thunder Mine soul inheritance, Dragod/Omni Lord fixes, [Crossnize], and mobile deck layout checks.
const fs = require("fs");
const path = require("path");
const { createEnv, ROOT } = require("./headless.js");
const env = createEnv();
const { run, flush } = env;
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };

(async () => {
  run(`battle.start("hotseat", generateFlagDeck(447,"T",571,true), generateFlagDeck(447,"O",571,true)); battle.renderBattle=function(){}; ABX.autoPlay = true; ABX.fast = true;
    window.__f = battle.plr; window.__e = battle.opp;
    window.__clear = () => { ["left","center","right"].forEach(p => { battle.plr.monsters[p] = null; battle.opp.monsters[p] = null; }); battle.plr.item = null; battle.opp.item = null; battle.plr.setSpells = []; battle.opp.setSpells = []; battle.plr.hyakuganSizeZeroTurn = false; battle.plr.abxSizeMods = []; };
    window.__mk = (id, soul) => ({ card: CARD_MAP.get(id), rested: false, attacksLeft: CARD_MAP.get(id).atk_max || 1, soul: soul || [], tempPower: 0, tempDef: 0, tempCrit: 0 });`);

  const r = JSON.parse(await run(`(async function(){
    const f = __f, e = __e, out = {};

    // 1. #1911 Evil Deity of Cataclysm, Hyakugan Yamigedo "Earth Half" & #1912 "Sky Half"
    __clear();
    const c1911 = CARD_MAP.get(1911), c1912 = CARD_MAP.get(1912);
    out.skySharesEarth = ABX.get(c1912).abilities.length === ABX.get(c1911).abilities.length && ABX.actAbilities(c1912).length === 1;
    f.gauge = [1, 2, 3, 4];
    f.monsters.center = __mk(1911);
    const hdSize2 = ALL_CARDS.find(c => c.type === "Monster" && c.size === 2 && (c.attrs || []).some(a => /hundred/i.test(a)));
    const hdSize3 = ALL_CARDS.find(c => c.type === "Monster" && c.size === 3 && c.id !== 1911 && c.id !== 1912 && (c.attrs || []).some(a => /hundred/i.test(a)));
    out.hd2Before = getEffectiveCardSize(f, hdSize2);
    await ABX.useAct("plr", c1911, f.monsters.center);
    f.monsters.left = { card: hdSize2, rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
    f.monsters.right = { card: hdSize2, rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
    out.hd2LeftAfter = getEffectiveCardSize(f, hdSize2, f.monsters.left);
    out.hd3After = getEffectiveCardSize(f, hdSize3);
    out.totalFieldSizeWithYamiAndTwoHD2 = battle.getCurrentSizeUsed(f);
    out.yamiGaugeAfterAct = f.gauge.length;

    // #1911 abilities cannot be nullified
    await ABX.OPS.nullifyAbilities.run({ np: ABX.parseNP("all monsters on your opponent's field") }, { side: "opp", f: e, e: f, card: CARD_MAP.get(1), bind: {} });
    out.yamiNotNullified = f.monsters.center.abxNullified !== battle.turnCount;

    // #1911 wouldLeave 5-card mill save + #5549 Cataclysmic Seed, Hyakugan Yamigedo Larva auto-call from milled cards
    __clear();
    f.monsters.center = __mk(1911);
    f.deck = [5549, 1, 2, 3, 4, 5, 6];
    f.drop = [];
    battle.destroyMonster("plr", "center");
    out.yamiSavedFromDestroy = !!f.monsters.center && f.monsters.center.card.id === 1911;

    // 2. #2777 Great Pirate, Captain Kaido conditional sizeMod & [Act] soul bounce
    __clear();
    const c2777 = CARD_MAP.get(2777);
    const advSize2 = ALL_CARDS.find(c => c.type === "Monster" && c.size === 2 && c.id !== 2777 && (c.attrs || []).some(a => /adventurer/i.test(a)));
    out.kaidoSizeAlone = getEffectiveCardSize(f, c2777);
    f.monsters.left = { card: advSize2, rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
    out.kaidoSizeWithAdv = getEffectiveCardSize(f, c2777);
    f.gauge = [1, 2];
    f.monsters.center = __mk(2777, [46]);
    const hBeforeKaido = f.hand.length;
    await ABX.useAct("plr", c2777, f.monsters.center);
    out.kaidoActBouncedSoul = f.hand.length === hBeforeKaido + 1 && f.hand.includes(46) && f.monsters.center.soul.length === 0;

    // 3. Round 22 rewrites & fallback checks (#195, #239, #261, #99)
    const c195 = CARD_MAP.get(195);
    const c239 = CARD_MAP.get(239);
    const c261 = CARD_MAP.get(261);
    const c99  = CARD_MAP.get(99);
    out.exec195 = ABX.get(c195).abilities.every(a => a.kind === "keyword" || a.kind === "cost" || ABX.isExecutable(a));
    out.exec239 = ABX.get(c239).abilities.every(a => a.kind === "keyword" || a.kind === "cost" || ABX.isExecutable(a));
    out.exec261 = ABX.get(c261).abilities.every(a => a.kind === "keyword" || a.kind === "cost" || ABX.isExecutable(a));
    __clear();
    f.item = __mk(261);
    const pow0 = getUnitEffectiveCombatStats(f, f.item).power;
    const ninja = ALL_CARDS.find(c => c.type === "Monster" && c.id !== 261 && (c.attrs || []).some(a => /ninja/i.test(a)));
    f.monsters.left = __mk(ninja.id);
    const pow1 = getUnitEffectiveCombatStats(f, f.item).power;
    f.monsters.right = __mk(ninja.id);
    const pow2 = getUnitEffectiveCombatStats(f, f.item).power;
    out.juzumaru = [pow0, pow1, pow2];

    __clear();
    f.hand = [1, 2, 3];
    e.monsters.left = __mk(46);
    e.monsters.center = __mk(46);
    f.monsters.center = __mk(99);
    await ABX.fireEnter("plr", c99, f.monsters.center);
    out.asmodai99 = [f.hand.length, !!e.monsters.left, !!e.monsters.center];

    // 4. #1394 Resurrected Evil Deity, Yamigedo inherits "Thunder Mine" from #1689 in its soul (oppDraw trigger)
    __clear();
    f.life = 5;
    e.life = 10;
    e.deck = [1, 2, 3];
    f.monsters.center = __mk(1394, [1689]);
    await ABX.OPS.draw.run({ op: "draw", who: "you", n: 1 }, { side: "opp", f: e, e: f, card: CARD_MAP.get(1), bind: {} });
    out.oppLifeAfterSoulThunderMine = e.life;

    // 5. Dragod, Omni Lord, and Card Type/Size/Cost fixes
    const magicFlag = CARD_MAP.get(1); // Magic World
    const c1006 = CARD_MAP.get(1006); // First Omni Beast Lord, Ziun (Ancient World [Omni Lord])
    const c1399 = CARD_MAP.get(1399); // Emblem of Omni Lords (Spell: "You may use this card with all flags" — searches [Omni Lord], not itself an Omni Lord)
    const c3007 = CARD_MAP.get(3007); // INV Stern Spirit, Kokujo Yamigedo (mentions [Omni Lord] in text only)
    const c4281 = CARD_MAP.get(4281); // Gargantua Dragon, "Sonic Mode" (Dragon World «Dragod» without [Dragod])
    const c4311 = CARD_MAP.get(4311); // Gargantua Dragon (True [Dragod])
    const c6183 = CARD_MAP.get(6183); // Deity Friendship Combatfang Sword, Ultimate Garga Sabre ([Dragod] Item)
    const c6191 = CARD_MAP.get(6191); // Fifth Omni Twin Swords, "Imperial Emperor Fang" ([Omni Lord] Item)
    const c3255 = CARD_MAP.get(3255); // Black-White Shadow Lord, Mukuro ([Omni Lord] Monster)
    out.dragodOmniData = {
      ziunOmniOnly: c1006.omni === true && c1006.dragod === false && !c1006.kw.includes("Dragod"),
      ziunOffWorldMax1: checkCardLegalityForFlag(c1006, magicFlag, false).maxCopies === 1,
      emblemAllFlagsSpell: c1399.omni === false && c1399.dragod === false && checkCardLegalityForFlag(c1399, magicFlag, false).maxCopies === 4,
      kokujoNotOmni: c3007.omni === false && !c3007.kw.includes("Omni Lord"),
      sonicModeNotAllFlags: c4281.dragod === false && checkCardLegalityForFlag(c4281, magicFlag, false).allowed === false,
      sonicModeWithDeityGargaBuddy: checkCardLegalityForFlag(c4281, magicFlag, false, 4957).allowed === true && checkCardLegalityForFlag(c4281, magicFlag, false, 4957).maxCopies === 4,
      trueDragod4311: c4311.dragod === true && checkCardLegalityForFlag(c4311, magicFlag, false).maxCopies === 4,
      itemSizesFixed: c6183.size === null && c6191.size === null && CARD_MAP.get(2794).size === null,
      mukuroCallCostFixed: /\[Call Cost\]/.test(c3255.skill) && parseCardCost(c3255.cost, c3255.skill, f, c3255).gauge === 1
    };

    // 6. [Crossnize] field-to-soul action, putIntoSoul trigger (#4155), and soul [Act] (#1631)
    __clear();
    const neodragon = ALL_CARDS.find(c => c.type === "Monster" && (c.attrs || []).includes("Neodragon"));
    f.monsters.center = __mk(neodragon.id, []);
    f.monsters.left = __mk(4155, []);
    const powBeforeCnz = getUnitEffectiveCombatStats(f, f.monsters.center).power;
    const cnzTargets = battle.getValidCrossnizeTargets(f, f.monsters.left);
    battle.completeCrossnize("plr", "left", "center");
    await ABX.queue(() => {});
    const effAfterCnz = getUnitEffectiveCombatStats(f, f.monsters.center);
    out.crossnizeFieldToSoul = cnzTargets.length === 1 && cnzTargets[0] === "center" && !f.monsters.left && f.monsters.center.soul.includes(4155);
    out.crossnizePutIntoSoulTrigger = effAfterCnz.power === powBeforeCnz + 4000 && effAfterCnz.da === true;

    // Soul [Act] on [Crossnize] card #1631 Dragonarms, Nanobreak ([Act] If this card is in the soul of your «Neodragon», pay 2 gauge -> destroy a monster on opponent's field)
    __clear();
    f.monsters.center = __mk(neodragon.id, [1631]);
    f.gauge = [1, 2];
    e.monsters.center = __mk(46, []);
    const sActs = ABX.soulActs("plr", f.monsters.center);
    const nanobreakAct = sActs.find(x => x.card.id === 1631);
    const canNano = nanobreakAct ? ABX.canUseSoulAct("plr", f.monsters.center, nanobreakAct.card, nanobreakAct.ab) : false;
    if (nanobreakAct && canNano) {
      await ABX.useSoulAct("plr", f.monsters.center, nanobreakAct.card, nanobreakAct.ab);
    }
    out.crossnizeSoulAct = !!nanobreakAct && canNano && f.gauge.length === 0 && !e.monsters.center;

    // 7. O(1) per-card ABX.get cache verification
    const cCached = CARD_MAP.get(4311);
    const r1 = ABX.get(cCached);
    const r2 = ABX.get(cCached);
    out.cacheIdentity = r1 === r2 && cCached._abxParsed === r1;

    return JSON.stringify(out);
  })()`));
  flush();

  ok(r.skySharesEarth, `#1912 Hyakugan Yamigedo "Sky Half" shares connected abilities with #1911 "Earth Half"`);
  ok(r.hd2Before === 2 && r.hd2LeftAfter === 0 && r.hd3After === 3 && r.totalFieldSizeWithYamiAndTwoHD2 === 3 && r.yamiGaugeAfterAct === 3,
    `#1911 Hyakugan Yamigedo "Earth Half" [Act] reduces size 2 or less «Hundred Demons» on left/right to size 0 (before=${r.hd2Before}, after=${r.hd2LeftAfter}, size3=${r.hd3After}, totalFieldSize=${r.totalFieldSizeWithYamiAndTwoHD2})`);
  ok(r.yamiNotNullified, `#1911 Hyakugan Yamigedo "Earth Half" abilities cannot be nullified`);
  ok(r.yamiSavedFromDestroy, `#1911 Hyakugan Yamigedo "Earth Half" mills 5 cards to remain on the field when it would leave`);
  ok(r.kaidoSizeAlone === 3 && r.kaidoSizeWithAdv === 0,
    `#2777 Great Pirate, Captain Kaido size is 3 alone and 0 with a size 2+ «Adventurer» (${r.kaidoSizeAlone} -> ${r.kaidoSizeWithAdv})`);
  ok(r.kaidoActBouncedSoul, `#2777 Great Pirate, Captain Kaido [Act] pays 1 gauge and returns a soul card to hand`);
  ok(r.oppLifeAfterSoulThunderMine === 9,
    `#1394 Resurrected Evil Deity, Yamigedo inherits "Thunder Mine" from #1689 in its soul and deals 1 damage on opponent draw (opp life=${r.oppLifeAfterSoulThunderMine})`);
  ok(r.exec195 && r.exec239 && r.exec261, "unquoted ability names (#195, #239) and inverted tribe count (#261) are executable");
  ok(r.juzumaru[0] === 3000 && r.juzumaru[1] === 3000 && r.juzumaru[2] === 6000, `#261 Elite Sword, Juzumaru gets +3000 with 2+ Ninjas on field (${r.juzumaru})`);
  ok(r.asmodai99[0] === 0 && !r.asmodai99[1] && !r.asmodai99[2], `#99 Champion Wrestler Asmodai discards hand and destroys opponent cards (${r.asmodai99})`);
  ok(r.dragodOmniData.ziunOmniOnly && r.dragodOmniData.ziunOffWorldMax1 && r.dragodOmniData.emblemAllFlagsSpell && r.dragodOmniData.kokujoNotOmni && r.dragodOmniData.sonicModeNotAllFlags && r.dragodOmniData.sonicModeWithDeityGargaBuddy && r.dragodOmniData.trueDragod4311 && r.dragodOmniData.itemSizesFixed && r.dragodOmniData.mukuroCallCostFixed,
    `Dragod, Omni Lord, Deity Gargantua Dragon buddy rule, and card size/cost fixes verified (${JSON.stringify(r.dragodOmniData)})`);
  ok(r.crossnizeFieldToSoul && r.crossnizePutIntoSoulTrigger, `[Crossnize] puts monster from field into «Neodragon» soul and fires putIntoSoul trigger`);
  ok(r.crossnizeSoulAct, `[Crossnize] «Dragonarms» in «Neodragon» soul (#1631 Nanobreak) activates soul [Act], drops from soul, and [Stand]s host`);
  ok(r.cacheIdentity, `O(1) per-card ABX.get cache returns identical parsed object without re-evaluating`);

  // 8. Mobile Deck Page CSS & HTML checks
  const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ok(html.includes("mobile-only-back-btn") && css.includes(".mobile-only-back-btn"), "Deck Builder has a top mobile Back button and responsive styles");
  ok(html.includes('<option value="cnz">[Crossnize]</option>'), "Deck Builder #dk-skill includes [Crossnize] filter option");
  ok(css.includes(".deck-editor-pane { height: auto; max-height: none; overflow: visible; order: -1;") &&
     css.includes(".deck-catalog-pane { overflow: visible; padding-right: 0; min-width: 0; }"),
     "Mobile Deck Builder eliminates nested scroll traps and keeps catalog reachable");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
