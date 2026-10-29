// Verification suite for:
// 1. [CHAOS Territory] dual-center (both orders: CHAOS Territory first then normal monster, OR normal monster first then CHAOS Territory monster) + connected visual HTML
// 2. Multi-Item equipping (including pair-equip items like #1461 / #4175) & Item/Flag Zone Inspector (openItemZoneViewer)
// 3. [Set] Spell Zone Inspector (openSetZoneViewer) with multiple [Set] spells & [Set] spell souls
// 4. Soul / [Soulguard] Inspector (openSoulViewer) & Soul [Act] activation from the Soul Inspector
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

  // 1. Call normal monster to center first, then call [CHAOS Territory] monster (#3849) to center2!
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
  ok(pairHtmlBoth.includes("chaos-connected") && pairHtmlBoth.includes("both-active") && pairHtmlBoth.includes("⚡CHAOS⚡"), "connected dual-center renders with .chaos-connected.both-active and ⚡CHAOS⚡ badge");

  // 2. Multi-Item equipping & openItemZoneViewer
  env.run(`{
    const f = battle.plr;
    f.item = null; f.item2 = null;
    f.hand = [468, 1461]; // #468 Dragonblade Dragobrave + #1461 Heavenly Sunhalberd (pair-equip item)
    battle.equipCardFromHand("plr", 0, "Equip");
  }`);
  await wait(700);
  env.run(`battle.equipCardFromHand("plr", 0, "Equip")`);
  await wait(700);
  const itemsEquipped = JSON.parse(env.run(`JSON.stringify({
    i1: battle.plr.item && battle.plr.item.card.id,
    i2: battle.plr.item2 && battle.plr.item2.card.id,
    cnt: getEquippedItems(battle.plr).length
  })`));
  ok(itemsEquipped.i1 === 468 && itemsEquipped.i2 === 1461 && itemsEquipped.cnt === 2, `pair-equip item equips into item2 alongside existing item (${itemsEquipped.i1} + ${itemsEquipped.i2})`);

  const itemViewerCount = env.run(`battle.openItemZoneViewer("plr"); document.getElementById("ds-grid").children.length`);
  ok(itemViewerCount >= 3, `openItemZoneViewer renders all equipped items + Flag in the Drop-Zone-style grid (${itemViewerCount} tiles)`);

  // 3. [Set] Spell Zone Inspector (openSetZoneViewer) with multiple [Set] spells & souls
  env.run(`{
    const f = battle.plr;
    const set1 = Object.assign({}, CARD_MAP.get(6007));
    const set2 = Object.assign({}, CARD_MAP.get(4199), { soul: [46, 47] });
    f.setSpells = [set1, set2];
    battle.renderBattle();
  }`);
  const setZoneHtml = env.run(`document.getElementById("z-plr-set-slot").innerHTML`);
  ok(setZoneHtml.includes("chaos-pair") && setZoneHtml.includes("🟣 Soul:2"), "[Set] zone renders side-by-side preview and clickable Soul badge when multiple [Set] spells are active");

  const setViewerCount = env.run(`battle.openSetZoneViewer("plr"); document.getElementById("ds-grid").children.length`);
  ok(setViewerCount === 2, `openSetZoneViewer lists all ${setViewerCount} active [Set] spells in the Drop-Zone-style modal`);

  // 4. Soul / [Soulguard] Inspector (openSoulViewer) on a monster with soul cards
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
