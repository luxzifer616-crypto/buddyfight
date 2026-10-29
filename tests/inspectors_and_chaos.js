// Verification suite for all 5 Slot Abilities & Inspector UIs (1.png - 5.png):
// 1. [CHAOS Territory] full-size dual-center (.chaos-pair.chaos-connected.both-active) (1.png)
// 2. Multi-Buddy Zone ([Double Buddy] 2 Buddies & [Triple Buddy] 3 Buddies .buddy-fan-stack + openBuddyZoneViewer) (2.png & 3.png)
// 3. Multi-Item equipping (2, 3, 4+ items in .item-fan-stack + openItemZoneViewer + ABX fieldUnits) (4.png)
// 4. [Set] Spell Zone horizontal fan (.set-fan-stack) & [Set] Zone Inspector (openSetZoneViewer) (5.png)
// 5. Soul / [Soulguard] Inspector (openSoulViewer) & Soul [Act] activation from the Soul Inspector
const { createEnv } = require("./headless.js");
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

  // 2. Multi-Buddy Zone: 2 Buddies ([Double Buddy] #5418/#5419, 3.png) & 3 Buddies ([Triple Buddy] #5717, 2.png)
  const doubleBuddyRes = JSON.parse(env.run(`{
    const ids2 = getDefaultBuddyZoneIds(5418);
    battle.plr.buddyId = 5418;
    battle.plr.buddyIds = ids2;
    battle.plr.buddyZone = ids2.map(id => ({ id, rested: false, isFaceDown: false }));
    battle.plr.buddyCalled = false;
    const html2 = battle.renderBuddyZoneHtml(battle.plr, "plr");
    markFighterBuddyCalled(battle.plr, 5418);
    const canCallSecond = canFighterBuddyCallCard(battle.plr, 5419);
    const canCallFirstAgain = canFighterBuddyCallCard(battle.plr, 5418);
    const ids3 = getDefaultBuddyZoneIds(5717);
    battle.plr.buddyId = 5717;
    battle.plr.buddyIds = ids3;
    battle.plr.buddyZone = ids3.map(id => ({ id, rested: false, isFaceDown: false }));
    const html3 = battle.renderBuddyZoneHtml(battle.plr, "plr");
    battle.openBuddyZoneViewer("plr");
    const viewerCount = document.getElementById("ds-grid").children.length;
    JSON.stringify({ ids2, html2, canCallSecond, canCallFirstAgain, ids3, html3, viewerCount });
  }`));
  ok(doubleBuddyRes.ids2.length === 2 && doubleBuddyRes.html2.includes("buddy-fan-stack") && doubleBuddyRes.html2.includes("buddy-count-2"), "2 Buddies ([Double Buddy] #5418 & #5419) render overlapping .buddy-fan-stack.buddy-count-2 (3.png)");
  ok(doubleBuddyRes.canCallSecond && !doubleBuddyRes.canCallFirstAgain, "Buddy Calling 1st Buddy rests only that Buddy while 2nd Buddy remains ready for Buddy Call");
  ok(doubleBuddyRes.ids3.length === 3 && doubleBuddyRes.html3.includes("buddy-fan-stack") && doubleBuddyRes.html3.includes("buddy-count-3") && doubleBuddyRes.viewerCount === 3, "3 Buddies ([Triple Buddy] #5717 Voltic Ra + Magma Horus + Freeza Horus) render .buddy-fan-stack.buddy-count-3 and openBuddyZoneViewer lists all 3 Buddies (2.png)");

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

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})();
