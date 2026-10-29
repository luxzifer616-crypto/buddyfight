// Verification suite for all 5 Slot Abilities, Multi-Buddy Arrow Cycling & Active Vertical Stack (3 buddy active.png),
// End-of-Turn Return-to-Hand Abilities, and Inspector UIs:
const { createEnv } = require("./tests/headless.js".replace("./tests/", "./"));
const env = createEnv();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  env.run(`battle.start("hotseat", generateFlagDeck(3337,"T",3338,true), generateFlagDeck(447,"O",571,true)); ABX.autoPlay = true;
    { const f = battle.plr; ["left","center","right","center2"].forEach(p => { f.monsters[p] = null; battle.opp.monsters[p] = null; });
      f.gauge = f.deck.splice(0, 12); f.maxSize = 99; battle.activeSide = "plr"; battle.phase = "main";
      window.__mon = ALL_CARDS.find(c => c.type === "Monster" && c.size === 1 && !/chaos territory/i.test(c.skill || ""));
      f.hand = [__mon.id, 3849]; }`);
  await wait(800);

  // 1. Call normal monster to center first, then call [CHAOS Territory] monster (#3849) to center2! (1.png)
  env.run(`battle.completeMonsterCall("plr", "center", 0, false)`);
  await wait(800);
  ok(env.run(`!!battle.plr.monsters.center && !hasChaosTerritory(battle.plr)`), "normal monster is on center first");

  // Start calling #3849 (which has [CHAOS Territory]) — renderCenterPairHtml should show the connected slot for center2!
  const pairHtmlDuringCall = env.run(`battle.startMonsterCall("plr", 0, false); battle.renderCenterPairHtml("plr")`);
  ok(pairHtmlDuringCall.includes("chaos-pair") && pairHtmlDuringCall.includes("center2"), "renderCenterPairHtml shows connected second center slot when calling a [CHAOS Territory] monster onto a normal center monster");

  env.run(`battle.onZoneClick("plr", "center2")`);
  await wait(1000);
  ok(env.run(`!!battle.plr.monsters.center && !!battle.plr.monsters.center2 && battle.plr.monsters.center2.card.id === 3849`), "calling a [CHAOS Territory] monster into center2 succeeds when a normal monster is already on center");

  const pairHtmlBoth = env.run(`battle.renderCenterPairHtml("plr")`);
  ok(pairHtmlBoth.includes("chaos-connected") && pairHtmlBoth.includes("both-active") && pairHtmlBoth.includes("chaos-left-half") && pairHtmlBoth.includes("chaos-right-half"), "connected dual-center renders full-size side-by-side cards with .chaos-connected.both-active (1.png)");

  // 2. Multi-Buddy Zone: Standing Stack + Arrow Cycling (Deck Edit & Battle) + Active Vertical Landscape Stack for 2, 3, and 4 Buddies (3 buddy active.png)
  const multiBuddyRes = JSON.parse(env.run(`{
    // Deck Edit Buddy Preview arrow cycling (#5717 Triple Buddy)
    if (!app.state.decks || !app.state.decks.length) {
      app.state.decks = [generateFlagDeck(5957, "Godclock", 5717, false)];
      app.state.activeDeckIndex = 0;
    }
    const dk = app.state.decks[app.state.activeDeckIndex];
    dk.buddyId = 5717;
    app.deckBuddyPreviewIdx = 0;
    app.renderCurrentDeckPane();
    const dkName0 = document.getElementById("dk-buddy-name").textContent;
    const dkHtml0 = document.getElementById("dk-buddy-visual").innerHTML;
    app.stepDeckBuddyModal(1);
    const dkName1 = document.getElementById("dk-buddy-name").textContent;

    // 2 Buddies (#5418 & #5419): Standing vs Active Buddy Call
    const ids2 = getDefaultBuddyZoneIds(5418);
    battle.plr.buddyId = 5418;
    battle.plr.buddyIds = ids2;
    battle.plr.buddyZone = ids2.map(id => ({ id, rested: false, isFaceDown: false }));
    battle.plr.buddyCalled = false;
    battle.plr.buddyPreviewIdx = 0;
    const html2Stand = battle.renderBuddyZoneHtml(battle.plr, "plr");
    markFighterBuddyCalled(battle.plr, 5418);
    const html2Active = battle.renderBuddyZoneHtml(battle.plr, "plr");
    const canCallSecond = canFighterBuddyCallCard(battle.plr, 5419);
    const canCallFirstAgain = canFighterBuddyCallCard(battle.plr, 5418);

    // 3 Buddies (#5717 Voltic Ra + Magma Horus + Freeza Horus): Standing vs Active + Arrow Cycling
    const ids3 = getDefaultBuddyZoneIds(5717);
    battle.plr.buddyId = 5717;
    battle.plr.buddyIds = ids3;
    battle.plr.buddyZone = ids3.map(id => ({ id, rested: false, isFaceDown: false }));
    battle.plr.buddyCalled = false;
    battle.plr.buddyPreviewIdx = 0;
    const html3Stand = battle.renderBuddyZoneHtml(battle.plr, "plr");
    battle.openBuddyBanner("plr", 1);
    const previewIdxAfterCycle = battle.plr.buddyPreviewIdx;
    markFighterBuddyCalled(battle.plr, 5717);
    const html3Active = battle.renderBuddyZoneHtml(battle.plr, "plr");
    battle.openBuddyZoneViewer("plr");
    const viewerCount3 = document.getElementById("ds-grid").children.length;

    // 4 Buddies (#6518 First Knight of the Apocalypse, Gratos "Re:B" + Voremos + Aberrucia + Thanatos): Active Vertical Stack
    const ids4 = getDefaultBuddyZoneIds(6518);
    battle.plr.buddyId = 6518;
    battle.plr.buddyIds = ids4;
    battle.plr.buddyZone = ids4.map(id => ({ id, rested: false, isFaceDown: false }));
    markFighterBuddyCalled(battle.plr, 6518);
    const html4Active = battle.renderBuddyZoneHtml(battle.plr, "plr");

    JSON.stringify({
      dkName0, dkName1, hasDkNav: !dkHtml0.includes("buddy-stack-nav") && !dkHtml0.includes("buddy-stack-arrow") && !document.getElementById("mdl-nav-prev").classList.contains("hidden") && !document.getElementById("mdl-nav-next").classList.contains("hidden"),
      ids2, html2Stand, html2Active, canCallSecond, canCallFirstAgain,
      ids3, html3Stand, html3Active, previewIdxAfterCycle, viewerCount3,
      ids4, html4Active
    });
  }`));
  ok(multiBuddyRes.hasDkNav && multiBuddyRes.dkName0.includes("[1/3]") && multiBuddyRes.dkName1.includes("[2/3]"), `Deck Edit Buddy preview renders stacked cards with ◀ ▶ arrow cycling (${multiBuddyRes.dkName0} -> ${multiBuddyRes.dkName1})`);
  ok(multiBuddyRes.ids2.length === 2 && multiBuddyRes.html2Stand.includes("buddy-fan-stack") && !multiBuddyRes.html2Stand.includes("buddy-active-vertical-stack") && multiBuddyRes.html2Active.includes("buddy-active-vertical-stack") && multiBuddyRes.html2Active.includes("buddy-count-2"), "2 Buddies switch from horizontal stack to vertical landscape stack (.buddy-active-vertical-stack.buddy-count-2) when Buddy Call activates");
  ok(multiBuddyRes.canCallSecond && !multiBuddyRes.canCallFirstAgain, "Buddy Calling 1st Buddy rests only that Buddy while 2nd Buddy remains ready for Buddy Call");
  ok(multiBuddyRes.ids3.length === 3 && multiBuddyRes.previewIdxAfterCycle === 1 && multiBuddyRes.html3Active.includes("buddy-active-vertical-stack") && multiBuddyRes.html3Active.includes("buddy-count-3") && multiBuddyRes.viewerCount3 === 3, "3 Buddies support ◀ ▶ arrow cycling in Battle Buddy Zone and switch to .buddy-active-vertical-stack.buddy-count-3 when Buddy Call activates (3 buddy active.png)");
  ok(multiBuddyRes.ids4.length === 4 && multiBuddyRes.html4Active.includes("buddy-active-vertical-stack") && multiBuddyRes.html4Active.includes("buddy-count-4"), "4 Buddies (#6518 Gratos 'Re:B' + 3 Knights) adapt to .buddy-active-vertical-stack.buddy-count-4 when Buddy Call activates");

  // 3. Multi-Item equipping (2, 3+ items in .item-fan-stack + openItemZoneViewer + ABX fieldUnits) (4.png)
  env.run(`{
    const f = battle.plr;
    f.item = null; f.item2 = null; f.extraItems = [];
    f.hand = [468, 1461]; // #468 Dragonblade Dragobrave + #1461 Heavenly Sunhalberd (pair-equip item)
    battle.equipCardFromHand("plr", 0, "Equip");
  }`);
  await wait(700);
  env.run(`battle.equipCardFromHand("plr", 0, "Equip")`);
  await wait(700);
  const itemsEquipped = JSON.parse(env.run(`{
    battle.plr.monsters.left = { card: CARD_MAP.get(3728), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 };
    addEquippedItemToFighter(battle.plr, { card: CARD_MAP.get(6002), rested: false, attacksLeft: 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0 });
    battle.renderBattle();
    const eq = getEquippedItems(battle.plr);
    const abxItems = ABX.core.fieldUnits(battle.plr, true).filter(r => r.pos.startsWith("item"));
    const flagHtml = document.getElementById("slot-plr-item").innerHTML;
    const badgeTxt = (document.getElementById("z-plr-flag-badge") || {}).textContent || "";
    battle.plr.monsters.left = null;
    JSON.stringify({
      i1: battle.plr.item && battle.plr.item.card.id,
      i2: battle.plr.item2 && battle.plr.item2.card.id,
      i3: battle.plr.extraItems[0] && battle.plr.extraItems[0].card.id,
      cnt: eq.length,
      abxCnt: abxItems.length,
      hasItemFan: flagHtml.includes("item-fan-stack") && badgeTxt.includes("Items (3)")
    });
  }`));
  ok(itemsEquipped.i1 === 468 && itemsEquipped.i2 === 1461 && itemsEquipped.i3 === 6002 && itemsEquipped.cnt === 3 && itemsEquipped.abxCnt === 3 && itemsEquipped.hasItemFan, `3+ equipped items render .item-fan-stack with 🗡️ Items (3) badge and are tracked by ABX (${itemsEquipped.i1}, ${itemsEquipped.i2}, ${itemsEquipped.i3}) (4.png)`);

  const itemViewerCount = env.run(`battle.openItemZoneViewer("plr"); document.getElementById("ds-grid").children.length`);
  ok(itemViewerCount >= 4, `openItemZoneViewer renders all 3 equipped items + Flag in the Drop-Zone-style grid (${itemViewerCount} tiles)`);

  // 4. [Set] Spell Zone Inspector (openSetZoneViewer) with multiple [Set] spells in .set-fan-stack (5.png)
  env.run(`{
    const f = battle.plr;
    const set1 = Object.assign({}, CARD_MAP.get(6007));
    const set2 = Object.assign({}, CARD_MAP.get(4199), { soul: [46, 47] });
    f.setSpells = [set1, set2];
    battle.renderBattle();
  }`);
  const setZoneHtml = env.run(`document.getElementById("z-plr-set-slot").innerHTML`);
  ok(setZoneHtml.includes("set-fan-stack") && setZoneHtml.includes("🟣 Soul:2"), "[Set] zone renders horizontal overlapping .set-fan-stack and clickable Soul badge when multiple [Set] spells are active (5.png)");

  const setViewerCount = env.run(`battle.openSetZoneViewer("plr"); document.getElementById("ds-grid").children.length`);
  ok(setViewerCount === 2, `openSetZoneViewer lists all ${setViewerCount} active [Set] spells in the Drop-Zone-style modal`);

  // 5. Soul / [Soulguard] Inspector (openSoulViewer) on a monster with soul cards
  env.run(`{
    const f = battle.plr;
    f.monsters.center.soul = [571, 6065, 46];
    battle.renderBattle();
  }`);
  const centerCardHtml = env.run(`battle.renderFieldCardHtml(battle.plr, battle.plr.monsters.center, "plr", "center")`);
  ok(centerCardHtml.includes("battle.openSoulViewer('plr', null, 'center')") && centerCardHtml.includes("🟣 Soul:3"), "field card renders clickable 🟣 Soul:3 badge wired to battle.openSoulViewer");

  const soulViewerInfo = JSON.parse(env.run(`{
    battle.openSoulViewer("plr", null, "center");
    const grid = document.getElementById("ds-grid");
    const title = document.getElementById("ds-title").textContent;
    const tileCount = grid.children.length;
    grid.children[0].onclick();
    const bnrName = document.getElementById("bnr-name").textContent;
    const bnrActions = Array.from(document.getElementById("bnr-actions").children).map(b => b.textContent);
    JSON.stringify({ title, tileCount, bnrName, bnrActions });
  }`));
  ok(soulViewerInfo.tileCount === 3 && soulViewerInfo.title.includes("SOUL INSPECTOR"), `openSoulViewer displays all 3 Soul cards (${soulViewerInfo.title})`);
  ok(soulViewerInfo.bnrActions.some(t => t.includes("Back to") && t.includes("Soul")), `clicking a Soul card opens its Card Detail Banner with a Back to Soul button (${soulViewerInfo.bnrName})`);

  // 6. End-of-Turn & Final-Phase Return-to-Hand Abilities when clicking End Turn (#4434, #2109 [Transform], #4079, #5536)
  env.run(`{
    const f = battle.plr;
    f.item = { card: CARD_MAP.get(2109), rested: false, attacksLeft: 1, soul: [], itemMode: "Transform" };
    f.item2 = null; f.extraItems = [];
    f.monsters.center = { card: CARD_MAP.get(4434), rested: false, attacksLeft: 2, soul: [] };
    f.monsters.center2 = null;
    f.monsters.left = { card: CARD_MAP.get(4079), rested: false, attacksLeft: 1, soul: [] };
    f.monsters.right = { card: CARD_MAP.get(5418), rested: false, attacksLeft: 1, soul: [] }; // «Legend Dragon» for #5536
    f.hand = [];
    f.drop.push(5536);
    ABX.fireDiscarded("plr", CARD_MAP.get(5536));
    battle.activeSide = "plr";
    battle.phase = "main";
    battle.endTurn();
  }`);
  await wait(500);
  const eotRes = JSON.parse(env.run(`JSON.stringify({
    center: battle.plr.monsters.center && battle.plr.monsters.center.card.id,
    left: battle.plr.monsters.left && battle.plr.monsters.left.card.id,
    item: battle.plr.item && battle.plr.item.card.id,
    hand4434: battle.plr.hand.includes(4434),
    hand2109: battle.plr.hand.includes(2109),
    hand4079: battle.plr.hand.includes(4079),
    hand5536: battle.plr.hand.includes(5536)
  })`));
  ok(!eotRes.center && !eotRes.left && !eotRes.item && eotRes.hand4434 && eotRes.hand2109 && eotRes.hand4079 && eotRes.hand5536, "End Turn returns field monsters (#4434), [Transform] items (#2109), final-phase returners (#4079), and dropped-this-turn cards (#5536) to hand");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
