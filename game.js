// Big 2x2 connected art shown when Overgod, "0" becomes the flag
const OVERGOD_FLAG_ART = "Sprite/OvergodZeroFlag.png";
// Godclock's 4 connected flag cards in grid order: Clock-I, Clock-II / Godclock, Clock-III
const GODCLOCK_FRONT_IDS = [5958, 5959, 5957, 5960];
/* ==================== FUTURE CARD BUDDYFIGHT — COMPLETE GAME ENGINE (V5) ==================== */

const ALL_CARDS = window.BUDDYFIGHT_CARDS || [];
const CARD_MAP = new Map();
const _origCardMapGet = CARD_MAP.get.bind(CARD_MAP);
CARD_MAP.get = function(key) {
  if (key && typeof key === "object") {
    const id = Number(key.id !== undefined ? key.id : key.cardId);
    return _origCardMapGet(id);
  }
  return _origCardMapGet(Number(key));
};
const OFFICIAL_MONSTER_SIZE_FIXES = {
  // Size 4
  867: 4, 2019: 4, 4174: 4, 4886: 4,
  5858: 4, 5862: 4, 5863: 4, 5864: 4, 5865: 4, 5866: 4, 5867: 4, 5868: 4, 5869: 4, 5889: 4, 5924: 4,
  6417: 4, 6419: 4, 6526: 4,
  // Size 5
  2107: 5, 3125: 5, 3233: 5, 3934: 5, 4885: 5, 5164: 5,
  5385: 5, 5386: 5, 5387: 5, 5388: 5, 5389: 5,
  5861: 5, 6476: 5,
  // Size 6
  4436: 6, 4873: 6, 4967: 6,
  // Size 9
  6214: 9,
  // Size 10
  2790: 10, 4147: 10, 6314: 10,
  // Size 30
  3338: 30, 3345: 30, 3348: 30, 3369: 30, 3650: 30, 3918: 30, 4119: 30, 4804: 30, 6500: 30,
  // Size 90
  3743: 90, 3825: 90, 3940: 90, 5341: 90,
  // Size 10000
  4071: 10000
};
// Typos in the card data ("Guage" #3193 #4733, "Destory" #3705 #3710, "oponent" #847 #2725 #2726 #5426 #6354) broke cost / ability parsing.
const CARD_TEXT_TYPOS = [[/\bGuage\b/g, "Gauge"], [/\bguage\b/g, "gauge"], [/\bDestory\b/g, "Destroy"], [/\bdestory\b/g, "destroy"], [/\bOponent\b/g, "Opponent"], [/\boponent\b/g, "opponent"]];
ALL_CARDS.forEach(c => {
  for (const k of ["skill", "cost"]) if (typeof c[k] === "string") for (const [re, to] of CARD_TEXT_TYPOS) c[k] = c[k].replace(re, to);
  if (Number(c.id) === 3941) c.type = "Flag"; // Treat "Infinity the Chaos" (#3941) as a Flag
  if (OFFICIAL_MONSTER_SIZE_FIXES[c.id] !== undefined) c.size = OFFICIAL_MONSTER_SIZE_FIXES[c.id];
  CARD_MAP.set(c.id, c);
});

// Soul Entry Helpers (supports both numeric cardId and { id, isFaceDown } objects for [Ambush])
function getSoulCardId(entry) {
  if (entry === null || entry === undefined) return null;
  if (typeof entry === "object") return Number(entry.id !== undefined ? entry.id : entry.cardId);
  return Number(entry);
}
function isSoulEntryFaceDown(entry) {
  return Boolean(entry && typeof entry === "object" && entry.isFaceDown === true);
}
function createSoulEntry(cardId, isFaceDown = false) {
  const id = getSoulCardId(cardId);
  return isFaceDown ? { id, isFaceDown: true } : id;
}

/* ==================== HYAKUGAN YAMIGEDO ("EARTH HALF" #1911 & "SKY HALF" #1912) DUAL-CARD HELPERS ==================== */
const YAMIGEDO_EARTH_ID = 1911;
const YAMIGEDO_SKY_ID = 1912;

function isYamigedoHalfId(id) {
  const n = Number(id);
  return n === YAMIGEDO_EARTH_ID || n === YAMIGEDO_SKY_ID;
}

function getOtherYamigedoHalfId(id) {
  const n = Number(id);
  if (n === YAMIGEDO_EARTH_ID) return YAMIGEDO_SKY_ID;
  if (n === YAMIGEDO_SKY_ID) return YAMIGEDO_EARTH_ID;
  return null;
}

function fighterHasBothYamigedoHalvesInHand(fighter) {
  if (!fighter || !Array.isArray(fighter.hand)) return false;
  return fighter.hand.includes(YAMIGEDO_EARTH_ID) && fighter.hand.includes(YAMIGEDO_SKY_ID);
}

function isFighterBuddyMatch(buddyOrFighter, cardId) {
  const cid = Number(cardId);
  if (buddyOrFighter && typeof buddyOrFighter === "object") {
    const entries = getFighterBuddyZoneEntries(buddyOrFighter);
    if (entries.some(e => !e.isFaceDown && (Number(e.id) === cid || (isYamigedoHalfId(e.id) && isYamigedoHalfId(cid))))) return true;
    return Number(buddyOrFighter.buddyId) === cid || (isYamigedoHalfId(buddyOrFighter.buddyId) && isYamigedoHalfId(cid));
  }
  const bid = Number(buddyOrFighter);
  if (bid === cid) return true;
  if (isYamigedoHalfId(bid) && isYamigedoHalfId(cid)) return true;
  for (const g of MULTI_BUDDY_GROUPS) {
    if (g.includes(bid) && g.includes(cid)) return true;
  }
  return false;
}

// Official [Double Buddy], [Triple Buddy], and Apocalypse 4-Knight Buddy groups
const MULTI_BUDDY_GROUPS = [
  [5418, 5419],       // [Double Buddy] Flame Deity, Magma Horus & Ice Deity, Freeza Horus
  [5511, 5513],       // [Double Buddy] One Wing of the King, Freeza Horus & One Wing of the King, Magma Horus
  [5517, 5523],       // [Double Buddy] Legendary Ice Deity, Freeza Horus & Legendary Flame Deity, Magma Horus
  [5717, 5418, 5419], // [Triple Buddy] Thunder Deity, Voltic Ra + Magma Horus + Freeza Horus
  [5749, 5523, 5517], // [Triple Buddy] Legendary Thunder Deity, Voltic Ra + Legendary Magma Horus + Legendary Freeza Horus
  [6518, 1716, 1719, 1721] // First Knight of the Apocalypse, Gratos "Re:B" + Voremos, Aberrucia & Thanatos
];

function getDefaultBuddyZoneIds(primaryBuddyId, customBuddyIds = null) {
  if (Array.isArray(customBuddyIds) && customBuddyIds.length > 0) {
    return customBuddyIds.map(Number).filter(id => CARD_MAP.has(id));
  }
  const bid = Number(primaryBuddyId);
  if (bid === 5717) return [5717, 5418, 5419];
  if (bid === 5749) return [5749, 5523, 5517];
  if (bid === 5418 || bid === 5419) return [bid, bid === 5418 ? 5419 : 5418];
  if (bid === 5511 || bid === 5513) return [bid, bid === 5511 ? 5513 : 5511];
  if (bid === 5517 || bid === 5523) return [bid, bid === 5517 ? 5523 : 5517];
  if (bid === 6518) {
    const voremos = ALL_CARDS.find(c => /second knight of the apocalypse,\s*voremos/i.test(c.name || ""));
    const aberrucia = ALL_CARDS.find(c => /third knight of the apocalypse,\s*aberrucia/i.test(c.name || ""));
    const thanatos = ALL_CARDS.find(c => /fourth knight of the apocalypse,\s*thanatos/i.test(c.name || ""));
    return [6518, voremos && voremos.id, aberrucia && aberrucia.id, thanatos && thanatos.id].filter(Boolean);
  }
  return CARD_MAP.has(bid) ? [bid] : [46];
}

function getFighterBuddyZoneEntries(fighter) {
  if (!fighter) return [];
  if (!Array.isArray(fighter.buddyZone) || fighter.buddyZone.length === 0) {
    const ids = getDefaultBuddyZoneIds(fighter.buddyId, fighter.buddyIds);
    fighter.buddyZone = ids.map(id => ({ id: Number(id), rested: Boolean(fighter.buddyCalled), isFaceDown: false }));
  }
  const out = fighter.buddyZone.slice();
  if (Array.isArray(fighter.buddyZoneFaceDown)) {
    fighter.buddyZoneFaceDown.forEach(fid => {
      out.push({ id: getSoulCardId(fid), rested: false, isFaceDown: true });
    });
  }
  return out;
}

function canFighterBuddyCallCard(fighter, cardId) {
  if (!fighter) return false;
  const entries = getFighterBuddyZoneEntries(fighter).filter(e => !e.isFaceDown);
  if (entries.length <= 1) return !fighter.buddyCalled && isFighterBuddyMatch(fighter, cardId);
  return entries.some(e => !e.rested && (Number(e.id) === Number(cardId) || (isYamigedoHalfId(e.id) && isYamigedoHalfId(cardId))));
}

// A card EFFECT [Stand]s a card (not the stand phase). Returns false and leaves the card rested when a static "cannot [Stand]" (Thunder Deity, Voltic Ra) locks it.
function effectStand(unit) {
  if (!unit) return false;
  try {
    const side = [["plr", battle.plr], ["opp", battle.opp]].find(([, f]) => f && (f.item === unit || f.item2 === unit || Object.values(f.monsters || {}).includes(unit)));
    if (unit.rested && side && window.ABX && ABX.core && ABX.core.standLocked && ABX.core.standLocked(unit, side[0])) return false;
  } catch (e) { /* no lock info: stand normally */ }
  unit.rested = false;
  return true;
}

function markFighterBuddyCalled(fighter, cardId) {
  if (!fighter) return;
  const entries = getFighterBuddyZoneEntries(fighter);
  const target = fighter.buddyZone.find(e => !e.isFaceDown && !e.rested && (Number(e.id) === Number(cardId) || (isYamigedoHalfId(e.id) && isYamigedoHalfId(cardId))))
    || fighter.buddyZone.find(e => !e.isFaceDown && !e.rested);
  if (target) target.rested = true;
  fighter.buddyCallEver = true;
  const faceUpMonsters = fighter.buddyZone.filter(e => !e.isFaceDown && (CARD_MAP.get(e.id) || {}).type === "Monster");
  fighter.buddyCalled = faceUpMonsters.length > 0 ? faceUpMonsters.every(e => e.rested) : true;
}

function standFighterBuddyZone(fighter, filterFn = null) {
  if (!fighter) return 0;
  getFighterBuddyZoneEntries(fighter);
  let count = 0;
  (fighter.buddyZone || []).forEach(e => {
    const c = CARD_MAP.get(e.id);
    if (e.rested && (!filterFn || (c && filterFn(c)))) {
      e.rested = false;
      count++;
    }
  });
  const faceUpMonsters = (fighter.buddyZone || []).filter(e => !e.isFaceDown && (CARD_MAP.get(e.id) || {}).type === "Monster");
  fighter.buddyCalled = faceUpMonsters.length > 0 ? faceUpMonsters.every(e => e.rested) : false;
  return count;
}

function getCanonicalYamigedoCard() {
  return CARD_MAP.get(YAMIGEDO_EARTH_ID) || CARD_MAP.get(YAMIGEDO_SKY_ID);
}

function renderYamigedoDualStackHtml(extraClass = "") {
  const sky = CARD_MAP.get(YAMIGEDO_SKY_ID);
  const earth = CARD_MAP.get(YAMIGEDO_EARTH_ID);
  const skyImg = sky ? sky.img : "CardSprite/n1912.png";
  const earthImg = earth ? earth.img : "CardSprite/n1911.png";
  return `
    <div class="yamigedo-dual-stack ${extraClass}" title="Evil Deity of Cataclysm, Hyakugan Yamigedo (Sky Half Top + Earth Half Bottom)">
      <div class="yami-half-slot yami-sky-top">
        <img src="${skyImg}" alt="Hyakugan Yamigedo Sky Half" />
      </div>
      <div class="yami-half-slot yami-earth-bottom">
        <img src="${earthImg}" alt="Hyakugan Yamigedo Earth Half" />
      </div>
    </div>
  `;
}

function getBuddyDisplayName(buddyCard) {
  if (!buddyCard) return "Unknown Buddy";
  if (isYamigedoHalfId(buddyCard.id)) {
    return 'Evil Deity of Cataclysm, Hyakugan Yamigedo ("Sky Half" & "Earth Half")';
  }
  return buddyCard.name;
}

const WORLDS_LIST = [
  "Dragon World",
  "Magic World",
  "Katana World",
  "Danger World",
  "Legend World",
  "Ancient World",
  "Dungeon World",
  "Darkness Dragon World",
  "Hero World",
  "Star Dragon World",
  "Lost World",
  "Generic",
  "Detective Conan",
  "BanG Dream! Girls Band Party! PICO",
  "THE IDOLM@STER Cinderella Girls Theater",
  "GeGeGe no Kitaro",
  "SSSS.GRIDMAN",
  "Sword Art Online",
  "Medabots"
];

const SET_TITLES = {
  "BT01": "BT01 — Dragon Chief",
  "BT02": "BT02 — Cyber Ninja Squad",
  "BT03": "BT03 — Drum's Adventures",
  "BT04": "BT04 — Darkness Fable",
  "BT05": "BT05 — Break to the Future",
  "TD01": "TD01 — Dominate Dragon",
  "TD02": "TD02 — Savage Steel",
  "TD03": "TD03 — Dragnarok",
  "TD04": "TD04 — Braves Explosion",
  "TD05": "TD05 — Ninja Onslaught",
  "TD06": "TD06 — Evil Dragon's Rosario",
  "TD07": "TD07 — The Solomon's Shield",
  "EB01": "EB01 — Immortal Entities",
  "EB02": "EB02 — Great Clash!! Dragon vs Danger",
  "CP01": "CP01 — Burning Valor",
  "PP01": "PP01 — Buddy Ragnarok",
  "SS01": "SS01 — Beginning of the Legend",
  "HBT01": "H-BT01 — Giga Future",
  "HBT02": "H-BT02 — Galaxy Burst",
  "HBT03": "H-BT03 — Assault of the Omni Lords",
  "HBT04": "H-BT04 — Mikado Evolution",
  "HTD01": "H-TD01 — Hundred Red Dragon",
  "HTD02": "H-TD02 — Hundred Purgatory",
  "HEB01": "H-EB01 — Miracle Impack!",
  "HEB02": "H-EB02 — Shadow vs Hero",
  "HEB03": "H-EB03 — Lord of Hundred Thunders",
  "HEB04": "H-EB04 — Buddy All-Stars+",
  "HPP01": "H-PP01 — Evolution & Ambition",
  "HSD01": "H-SD01 — Dragonic Star",
  "HSD02": "H-SD02 — Luminize! Star Dragon",
  "DBT01": "D-BT01 — Unleash! Impact Dragon!",
  "DBT01A": "D-BT01A — Roar! Invincible Dragon!!",
  "DBT02": "D-BT02 — Four Dimensions",
  "DBT02A": "D-BT02A — Change! Impact Monster!!",
  "DBT03": "D-BT03 — Annihilate! Great Demonic Dragon!!",
  "DBT04": "D-BT04 — Shine! Super Sun Dragon!!",
  "DTD01": "D-TD01 — Scorching Sun Dragon",
  "DEB01": "D-EB01 — Miracle Fighter Collection",
  "DEB02": "D-EB02 — Dual Cards",
  "DEB03": "D-EB03 — Heave Ho! Dragon Lord Festival!!",
  "DSD01": "D-SD01 — Scorching Sun",
  "DSD02": "D-SD02 — Cross Dragoner",
  "DSD03": "D-SD03 — Graveyard of Abyss",
  "DSS02": "D-SS02 — Super BF Deck: The Chaos",
  "DSS03": "D-SS03 — Golden Buddy Champion Box",
  "XBT01": "X-BT01 — The Dark Lord's Rebirth!",
  "XBT02": "X-BT02 — Chaos Control Crisis",
  "XBT03": "X-BT03 — Overturn! Thunder Empire!!",
  "XBT04": "X-BT04 — Rainbow Striker",
  "XCBT01": "X-CBT01 — All-Star Fight",
  "XCP01": "X-CP01 — Dual Revival",
  "XCP02": "X-CP02 — Four World Duel",
  "XCP03": "X-CP03 — Five World Champions",
  "XTD02": "X-TD02 — Ruler of Chaos",
  "XTD03": "X-TD03 — Empire of Thunder",
  "XSD01": "X-SD01 — Batzz's Thunder Empire",
  "XSD02": "X-SD02 — Wisdom's Chaos",
  "XSS01": "X-SS01 — Batzz vs Gao",
  "XSS02": "X-SS02 — Roaring Thunder",
  "XSS03": "X-SS03 — Secret Sword! Lethal Formation",
  "XUB01": "X-UB01 — Heroes & Adventurers",
  "XUB02": "X-UB02 — Purgatory & Darkness",
  "XSP01": "X-SP01 — Overturn Special Pack",
  "SBT01": "S-BT01 — Gargantua Awakened (Lost World)",
  "SBT02": "S-BT02 — Dimension Destroyer",
  "SBT03": "S-BT03 — True Awakening of Deities",
  "SBT04": "S-BT04 — Drago Knight",
  "SBT05": "S-BT05 — Godcross",
  "SCBT03": "S-CBT03 — Ultimate Unite (Godclock & Time Dragon)",
  "SBT07_REB": "S-BT07 / Re:B — Future Card Buddyfight Revival",
  "SUB_CONAN": "S-UB-C01 — Detective Conan Crossover",
  "SUB_BANGDREAM": "S-UB-C02 — BanG Dream! Garupa PICO",
  "SUB_IDOLMASTER": "S-UB-C03 — THE IDOLM@STER Cinderella Girls",
  "SUB_KITARO": "S-UB-C04 — GeGeGe no Kitaro",
  "SUB_GRIDMAN": "S-UB-C05 — SSSS.GRIDMAN",
  "SUB_SAO": "S-UB-C06 — Sword Art Online",
  "SUB_MEDABOTS": "S-UB-C07 — Medabots",
  "PR": "PR — Official Promo & Special Cards"
};

// Escape text before putting it inside innerHTML (deck names, rule text like "<Dragon World>", card names in attributes).
function escapeHtml(str) {
  return String(str === null || str === undefined ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Validate a deck that came from a Deck Code, room or friend so bad data can't break the game.
function sanitizeImportedDeck(raw) {
  if (!raw || typeof raw !== "object") return null;
  const flag = CARD_MAP.get(Number(raw.flagId));
  if (!flag || flag.type !== "Flag") return null;
  const toIds = (arr, limit) => (Array.isArray(arr) ? arr : [])
    .map(Number)
    .filter(id => Number.isInteger(id) && CARD_MAP.has(id))
    .slice(0, limit);
  const cards = toIds(raw.cards, 200);
  if (cards.length === 0) return null;
  const buddy = CARD_MAP.get(Number(raw.buddyId));
  return {
    name: String(raw.name || "Imported Deck").slice(0, 60),
    world: getFlagConfig(flag).world,
    flagId: flag.id,
    buddyId: buddy ? buddy.id : cards.find(id => CARD_MAP.get(id).type === "Monster") || 46,
    cards,
    infinityChaos: flag.id === 3337 && !!raw.infinityChaos,
    lostDeck: toIds(raw.lostDeck, 30)
  };
}

function getSetDisplayName(setCode) {
  return SET_TITLES[setCode] || `${setCode} — Booster Pack`;
}


const FEATURED_TRIBES = [
  { val: "TimeDragon", label: "⏳ Time Dragon («Time Dragon»)" },
  { val: "Dragod", label: "👑 Dragod («Dragod»)" },
  { val: "HundredDemons", label: "👹 Hundred Demons («Hundred Demons»)" },
  { val: "Executioners", label: "⚔️ Executioners («Executioners»)" },
  { val: "Guardians", label: "🛡️ Guardians («Guardians»)" },
  { val: "Chaos", label: "⚙️ Chaos («Chaos»)" },
  { val: "ThunderEmpire", label: "⚡ Thunder Empire («Thunder Empire»)" },
  { val: "Armordragon", label: "🐉 Armordragon («Armordragon»)" },
  { val: "SunDragon", label: "☀️ Sun Dragon («Sun Dragon»)" },
  { val: "BlackDragon", label: "🌑 Black Dragon («Black Dragon»)" },
  { val: "Neodragon", label: "🌌 Neodragon («Neodragon»)" },
  { val: "DragonKnight", label: "🗡️ Dragon Knight («Dragon Knight»)" },
  { val: "DragonLord", label: "👑 Dragon Lord («Dragon Lord»)" },
  { val: "72Pillars", label: "😈 72 Pillars («72 Pillars»)" },
  { val: "DragoPhantomThief", label: "🎩 Drago Phantom Thief" },
  { val: "SkullWarrior", label: "💀 Skull Warrior («Skull Warrior»)" },
  { val: "Ninja", label: "🥷 Ninja («Ninja»)" },
  { val: "Superhero", label: "🦸 Superhero («Superhero»)" },
  { val: "BraveMachine", label: "🤖 Brave Machine («Brave Machine»)" },
  { val: "Adventurer", label: "🧭 Adventurer («Adventurer»)" },
  { val: "DungeonEnemy", label: "👾 Dungeon Enemy («Dungeon Enemy»)" },
  { val: "Asgard", label: "⚡ Asgard («Asgard»)" },
  { val: "Hero", label: "🗡️ Hero («Hero»)" },
  { val: "Olympus", label: "🏛️ Olympus («Olympus»)" },
  { val: "Tyrant", label: "🦖 Tyrant («Tyrant»)" },
  { val: "RagingSpirits", label: "🔥 Raging Spirits («Raging Spirits»)" },
  { val: "DuelDragon", label: "🐲 Duel Dragon («Duel Dragon»)" }
];

function formatTribeDisplayName(rawAttr) {
  if (!rawAttr) return "";
  return rawAttr
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function normalizeSearchToken(str) {
  return (str || "")
    .toLowerCase()
    .replace(/excuitoners/g, "executioner")
    .replace(/executioners/g, "executioner")
    .replace(/hundreds?\s*demons?/g, "hundreddemon")
    .replace(/guardians?/g, "guardian")
    .replace(/time\s*dragons?/g, "timedragon")
    .replace(/[\s«»"'\-_,.:;!?()\[\]]+/g, "");
}

// Card text never changes, so build each card's search text once and reuse it.
// (Before, every keystroke in the Collection / Deck search re-built and re-normalized the text of all 6,573 cards.)
const CARD_SEARCH_CACHE = new Map();
function getCardSearchData(c) {
  let data = CARD_SEARCH_CACHE.get(c.id);
  if (!data) {
    const raw = `${c.id} ${c.name} ${c.skill} ${c.skill_th || ""} ${(c.sets || []).join(" ")} ${(c.attrs || []).join(" ")} ${(c.attrs || []).map(formatTribeDisplayName).join(" ")} ${c.world}`.toLowerCase();
    data = {
      raw,
      norm: normalizeSearchToken(raw),
      attrsNorm: (c.attrs || []).map(a => normalizeSearchToken(a))
    };
    CARD_SEARCH_CACHE.set(c.id, data);
  }
  return data;
}

function cardMatchesTextQuery(c, q, qNorm) {
  if (!q) return true;
  const data = getCardSearchData(c);
  return data.raw.includes(q) || Boolean(qNorm && data.norm.includes(qNorm));
}

function cardHasTribe(c, tribeValue) {
  if (!tribeValue) return true;
  const tNorm = normalizeSearchToken(tribeValue);
  return getCardSearchData(c).attrsNorm.some(a => a.includes(tNorm));
}

// Cards grouped by set code (BT01, TD01...). Built once, used by the Shop.
let SET_POOLS_CACHE = null;
function getSetPools() {
  if (!SET_POOLS_CACHE) {
    SET_POOLS_CACHE = new Map();
    ALL_CARDS.forEach(c => {
      (c.sets || []).forEach(sCode => {
        if (!SET_POOLS_CACHE.has(sCode)) SET_POOLS_CACHE.set(sCode, []);
        SET_POOLS_CACHE.get(sCode).push(c);
      });
    });
  }
  return SET_POOLS_CACHE;
}

/* ==================== THAI / ENGLISH (i18n) DICTIONARY ==================== */
const I18N = {
  en: {
    subtitle: "6,573-Card Complete Anime Simulator",
    nav_hub: "Main Lobby",
    nav_shop: "Card Shop",
    nav_collection: "Collection",
    nav_deck: "Decks",
    hub_profile_header: "FIGHTER LICENSE & RANKING",
    wins: "WINS",
    losses: "LOSSES",
    streak: "STREAK",
    equipped_deck: "EQUIPPED FIGHT DECK",
    btn_sandbox: "🔓 Sandbox Mode: Unlock All 6,573 Cards & +10,000 BP",
    hub_bot_title: "🤖 Battle vs. Anime AI Rivals",
    hub_bot_desc: "Experience full Buddyfight anime battles on Field1.png with 2x2 connected Godclock Reversal & Overgod \"0\", Link Attacks, Universal Card Ability & Condition checks, Lost World Sub-Decks, and Attack/Drop animations!",
    select_rival: "Select Rival:",
    btn_start_bot: "🔥 LUMINIZE! RAISE THE FLAG! (START BATTLE)",
    hub_friend_title: "🌐 Play Online Room / Friends",
    hub_friend_desc: "Create an Online Room Code for another player to join, paste a Room/Deck Code, or play 2-Player Local Hotseat!",
    btn_room_lobby: "🌐 Create / Join Room Code",
    btn_hotseat: "⚔️ 2-Player Local Hotseat",
    hub_shortcuts: "⚡ Quick Navigation",
    shop_short_desc: "Dynamic World Packs",
    deck_short_desc: "Build & Deck Codes",
    shop_title: "🛒 BUDDYFIGHT BOOSTER PACK SHOP",
    shop_subtitle: "Pack prices scale by rarity & World size — rare mini-sets with fewer cards cost more BP, while large main sets are more affordable!",
    btn_free_bp: "🎁 Claim +500 Free BP",
    deck_gallery_title: "⚔️ YOUR FIGHT DECKS",
    deck_gallery_sub: "Select a deck banner to edit or equip for battle, create a brand-new deck, or import a friend's Deck Code!",
    btn_build_new_deck: "➕ Build New Deck",
    btn_import_deck: "📥 Import Deck Code",
    btn_back_decks: "⬅️ Back to Decks"
  },
  th: {
    subtitle: "ซิมูเลเตอร์บัดดี้ไฟท์ครบ 6,573 การ์ด",
    nav_hub: "หน้าหลัก",
    nav_shop: "ร้านค้าแพ็คการ์ด",
    nav_collection: "คลังการ์ด",
    nav_deck: "จัดเด็ค",
    hub_profile_header: "ข้อมูลไฟท์เตอร์ & แรงค์",
    wins: "ชนะ",
    losses: "แพ้",
    streak: "ชนะต่อเนื่อง",
    equipped_deck: "เด็คที่ใช้ต่อสู้ปัจจุบัน",
    btn_sandbox: "🔓 โหมดปลดล็อกการ์ดทั้งหมด 6,573 ใบ & +10,000 BP",
    hub_bot_title: "🤖 ต่อสู้กับบอทตัวละครอนิเมะ",
    hub_bot_desc: "สัมผัสการต่อสู้บัดดี้ไฟท์บนสนาม Field1.png พร้อมระบบ Godclock 4 ใบเชื่อมต่อกัน & Overgod \"0\", Link Attack ประสานการโจมตี, ค้นหาการ์ดตามชื่อ/เผ่า, Lost World เด็ครอง และอนิเมชันครบครัน!",
    select_rival: "เลือกคู่ต่อสู้:",
    btn_start_bot: "🔥 ลูมิไนซ์! เรสเดอะแฟล็ก! (เริ่มการต่อสู้)",
    hub_friend_title: "🌐 เล่นกับเพื่อน / ห้องออนไลน์",
    hub_friend_desc: "สร้างรหัสห้อง (Room Code) เพื่อให้เพื่อนเข้าร่วม หรือวางโค้ดเด็คเพื่อดวลกันได้เลย!",
    btn_room_lobby: "🌐 สร้างห้อง / เข้าร่วมด้วยรหัสห้อง",
    btn_hotseat: "⚔️ เล่น 2 คนบนเครื่องเดียวกัน",
    hub_shortcuts: "⚡ เมนูด่วน",
    shop_short_desc: "สุ่มแพ็คการ์ด 19 เวิลด์",
    deck_short_desc: "จัดเด็ค & แชร์โค้ด",
    shop_title: "🛒 ร้านค้าสุ่มแพ็คการ์ดบัดดี้ไฟท์",
    shop_subtitle: "ราคาแพ็คการ์ดขึ้นอยู่กับความหายากและจำนวนการ์ดในเวิลด์ — ชุดการ์ดพิเศษที่มีจำนวนน้อยจะมีราคาสูงกว่าชุดหลัก!",
    btn_free_bp: "🎁 รับฟรี +500 BP",
    deck_gallery_title: "⚔️ เด็คของคุณทั้งหมด",
    deck_gallery_sub: "เลือกเด็คเพื่อใช้ต่อสู้หรือแก้ไข กดปุ่ม '+ สร้างเด็คใหม่' หรือนำเข้าโค้ดเด็คจากเพื่อน!",
    btn_build_new_deck: "➕ สร้างเด็คใหม่ (Build Deck)",
    btn_import_deck: "📥 นำเข้าโค้ดเด็ค",
    btn_back_decks: "⬅️ กลับไปหน้าเลือกเด็ค"
  }
};


/* ==================== COMPLETE THAI TRANSLATION ENGINE (ALL 6,573 CARDS & UI) ==================== */
const THAI_WORLD_MAP = {
  "Dragon World": "ดราก้อนเวิลด์ (Dragon World)",
  "Magic World": "เมจิกเวิลด์ (Magic World)",
  "Katana World": "คาตานะเวิลด์ (Katana World)",
  "Danger World": "เดนเจอร์เวิลด์ (Danger World)",
  "Legend World": "เลเจนด์เวิลด์ (Legend World)",
  "Ancient World": "เอนเชียนท์เวิลด์ (Ancient World)",
  "Dungeon World": "ดันเจี้ยนเวิลด์ (Dungeon World)",
  "Darkness Dragon World": "ดาร์คเนสดราก้อนเวิลด์ (Darkness Dragon World)",
  "Hero World": "ฮีโร่เวิลด์ (Hero World)",
  "Star Dragon World": "สตาร์ดราก้อนเวิลด์ (Star Dragon World)",
  "Lost World": "ลอสต์เวิลด์ (Lost World)",
  "Generic": "เจเนอริก (Generic)",
  "Godclock": "ก๊อดคล็อก (Godclock)",
  "Dragon Ein": "ดราก้อน ไอน์ (Dragon Ein)",
  "Dragon Zwei": "ดราก้อน ซไว (Dragon Zwei)",
  "Dragon Drei": "ดราก้อน เดรย์ (Dragon Drei)",
  "The Chaos": "เดอะ เคออส (The Chaos)",
  "Thunder Empire": "ธันเดอร์เอ็มไพร์ (Thunder Empire)",
  "Divine Guardians": "ดีไวน์ การ์เดียนส์ (Divine Guardians)",
  "Searing Executioners": "เซียร์ริ่ง เอ็กซิคิวชันเนอร์ส (Searing Executioners)",
  "Parade of Hundred Demons": "ขบวนร้อยอสูร (Hundred Demons)"
};

const THAI_TYPE_MAP = {
  "Monster": "มอนสเตอร์ (Monster)",
  "Item": "ไอเทม (Item)",
  "Spell": "เวทมนตร์ (Spell)",
  "Impact": "ไม้ตาย (Impact)",
  "Flag": "แฟล็ก (Flag)"
};

const THAI_KEYWORD_MAP = {
  "Move": "[Move] (มูฟ - ย้ายช่องได้)",
  "Penetrate": "[Penetrate] (เพเนเทรต - ทะลุทะลวง)",
  "Soulguard": "[Soulguard] (โซลการ์ด)",
  "Counterattack": "[Counterattack] (เคาน์เตอร์แอทแทค - สวนกลับ)",
  "Double Attack": "[Double Attack] (โจมตี 2 ครั้ง)",
  "Triple Attack": "[Triple Attack] (โจมตี 3 ครั้ง)",
  "Quadruple Attack": "[Quadruple Attack] (โจมตี 4 ครั้ง)",
  "Hextuple Attack": "[Hextuple Attack] (โจมตี 6 ครั้ง)",
  "Set": "[Set] (เซ็ตค้างบนสนาม)",
  "Lifelink": "[Lifelink] (ไลฟ์ลิงก์)",
  "Overturn": "[Overturn] (โอเวอร์เทิร์น)",
  "Overkill": "[Overkill] (โอเวอร์คิล)",
  "Overkill:REBOOT": "[Overkill:REBOOT] (โอเวอร์คิล รีบูต)",
  "Overthrow": "[Overthrow] (โอเวอร์โธรว์)",
  "Shadow Dive": "[Shadow Dive] (ชาโดว์ไดฟ์ - โจมตีผู้เล่นโดยตรง)",
  "Ambush": "[Ambush] (แอมบุช - ซุ่มโจมตีจากโซล)",
  "Equipment Change": "[Equipment Change] (สลับสวมใส่ไอเทม)",
  "Transform": "[Transform] (ทรานส์ฟอร์ม - แปลงร่างสวมใส่)",
  "Impact Transform": "[Impact Transform] (อิมแพ็คทรานส์ฟอร์ม)",
  "Ride": "[Ride] (ไรด์ - ขับขี่สวมใส่)",
  "Station": "[Station] (สเตชัน)",
  "Crossnize": "[Crossnize] (ครอสไนซ์)",
  "Omni Lord": "[Omni Lord] (อัศวินเขา - ใส่เด็คเวิลด์อื่นได้ 1 ใบ)",
  "Dragod": "[Dragod] (ดราก้อนก๊อด - ใช้ได้กับทุกแฟล็ก 4 ใบ)",
  "Reversal": "[Reversal] (รีเวอร์ซัล - พลิกการ์ด)",
  "Counter": "[Counter] (เคาน์เตอร์)",
  "Act": "[Act] (แอค - กดใช้สกิล)"
};

const THAI_TRIBE_MAP = {
  "TimeDragon": "ไทม์ดราก้อน (Time Dragon)",
  "Dragod": "ดราก้อนก๊อด (Dragod)",
  "HundredDemons": "ร้อยอสูร (Hundred Demons)",
  "Executioners": "เอ็กซิคิวชันเนอร์ส (Executioners)",
  "Guardians": "การ์เดียนส์ (Guardians)",
  "Chaos": "เคออส (Chaos)",
  "ThunderEmpire": "ธันเดอร์เอ็มไพร์ (Thunder Empire)",
  "Armordragon": "อาร์เมอร์ดราก้อน (Armordragon)",
  "SunDragon": "ซันดราก้อน (Sun Dragon)",
  "BlackDragon": "แบล็คดราก้อน (Black Dragon)",
  "Neodragon": "นีโอดราก้อน (Neodragon)",
  "DragonKnight": "ดราก้อนไนท์ (Dragon Knight)",
  "DragonLord": "ดราก้อนลอร์ด (Dragon Lord)",
  "72Pillars": "72 เสาหลัก (72 Pillars)",
  "DragoPhantomThief": "จอมโจรดราโก (Drago Phantom Thief)",
  "SkullWarrior": "นักรบโครงกระดูก (Skull Warrior)",
  "Ninja": "นินจา (Ninja)",
  "Superhero": "ซูเปอร์ฮีโร่ (Superhero)",
  "BraveMachine": "เบรฟแมชชีน (Brave Machine)",
  "Adventurer": "นักผจญภัย (Adventurer)",
  "DungeonEnemy": "ศัตรูดันเจี้ยน (Dungeon Enemy)",
  "Asgard": "แอสการ์ด (Asgard)",
  "Hero": "ฮีโร่ (Hero)",
  "Olympus": "โอลิมปัส (Olympus)",
  "Tyrant": "ไทแรนท์ (Tyrant)",
  "RagingSpirits": "เรจจิ้งสปิริตส์ (Raging Spirits)",
  "DuelDragon": "ดูเอลดราก้อน (Duel Dragon)",
  "Defense": "ป้องกัน (Defense)",
  "Draw": "จั่วการ์ด (Draw)",
  "Charge": "ชาร์จเกจ (Charge)",
  "Get": "ค้นหาการ์ด (Get)",
  "Recovery": "ฟื้นฟูพลังชีวิต (Recovery)",
  "Enhance": "เสริมพลัง (Enhance)",
  "Summon": "อัญเชิญ (Summon)",
  "Weapon": "อาวุธ (Weapon)",
  "Fire": "ไฟ (Fire)",
  "Water": "น้ำ (Water)",
  "Wind": "ลม (Wind)",
  "Earth": "ดิน (Earth)"
};

function tWorld(w) {
  if (app && app.lang === "th") return THAI_WORLD_MAP[w] || w;
  return w;
}

function tType(t) {
  if (app && app.lang === "th") return THAI_TYPE_MAP[t] || t;
  return t;
}

function tKeyword(k, llVal = null) {
  if (app && app.lang === "th") {
    if (k === "Lifelink" && llVal) return `[Lifelink ${llVal}] (ไลฟ์ลิงก์ ${llVal})`;
    return THAI_KEYWORD_MAP[k] || k;
  }
  return k === "Lifelink" && llVal ? `Lifelink ${llVal}` : k;
}

function tTribe(rawAttr) {
  const clean = formatTribeDisplayName(rawAttr);
  if (app && app.lang === "th") {
    return THAI_TRIBE_MAP[rawAttr] || clean;
  }
  return clean;
}

function translateCardSkillToThai(skillText, cardObj = null) {
  if (!app || app.lang !== "th") {
    return skillText || "No special skill text.";
  }
  if (cardObj && cardObj.skill_th !== undefined) {
    return cardObj.skill_th || "ไม่มีความสามารถพิเศษ";
  }
  if (!skillText) return "ไม่มีความสามารถพิเศษ";
  return skillText;
}

/* ==================== SPECIAL FLAG & DECK LEGALITY ENGINE ==================== */
function getFlagConfig(flagCard) {
  if (!flagCard) {
    return {
      key: "standard",
      world: "Dragon World",
      life: 10,
      hand: 6,
      gauge: 2,
      maxSize: 3,
      ruleSummary: "Life: 10 • Hand: 6 • Gauge: 2 • Size: 3"
    };
  }
  const n = (flagCard.name || "").toLowerCase();

  if (n.includes("dragon ein")) {
    return {
      key: "dragon_ein",
      world: "Dragon Ein",
      life: 12,
      hand: 4,
      gauge: 2,
      maxSize: 3,
      ruleSummary: "Life: 12 • Hand: 4 • Gauge: 2 • «Dragon» cards (Monsters, Items, Spells, Impacts) + Generic"
    };
  }
  if (n.includes("dragon zwei")) {
    return {
      key: "dragon_zwei",
      world: "Dragon Zwei",
      life: 20,
      hand: 4,
      gauge: 2,
      maxSize: 3,
      ruleSummary: "Life: 20 • Hand: 4 • Gauge: 2 • «Dragon» Monsters & Impact Monsters only (no Items / Spells) + Dragon Drei"
    };
  }
  if (n.includes("dragon drei")) {
    return {
      key: "dragon_drei",
      world: "Dragon Drei",
      life: 5,
      hand: 4,
      gauge: 2,
      maxSize: 3,
      cannotStartAsFlag: true,
      ruleSummary: "Put in Dragon Zwei Deck • Revives to 5 Life when Life hits 0!"
    };
  }
  if (n.includes("overgod")) {
    return {
      key: "overgod_0",
      world: "Godclock",
      life: 10,
      hand: 6,
      gauge: 2,
      maxSize: 3,
      cannotStartAsFlag: true,
      ruleSummary: "Put in Godclock Deck • [Act] [Reversal] Endruler Dragon from Hand (0 Pow / 12 Crit / Eternal Eon!)"
    };
  }
  if (n.includes("endruler dragon")) {
    return {
      key: "endruler",
      world: "Godclock",
      life: 10,
      hand: 6,
      gauge: 2,
      maxSize: 3,
      cannotStartAsFlag: true,
      ruleSummary: "Awakened 2x2 Connected Godclock Flag (12000 Pow / 4 Crit / 12000 Def / [Triple Attack] / Eternal Eon)"
    };
  }
  if (Number(flagCard.id) === 3941 || n.includes("infinity the chaos")) {
    return {
      key: "infinity_chaos",
      world: "The Chaos",
      life: 10,
      hand: 4,
      gauge: 2,
      maxSize: 1e9,
      cannotStartAsFlag: true,
      cannotAddToDeck: true,
      ruleSummary: "Starts Face-Down under The Chaos • Flipped by 'The Chaos Upgrade' (#4072) • Size: ∞ • 15000/2/5000"
    };
  }
  if (n.includes("the chaos")) {
    return {
      key: "chaos",
      world: "The Chaos",
      life: 10,
      hand: 4,
      gauge: 2,
      maxSize: 99,
      ruleSummary: "Life: 10 • Hand: 4 • Gauge: 2 • Max Size: 99 • «Chaos» Cards"
    };
  }
  if (n.includes("thunder emperor")) {
    return {
      key: "thunder_empire",
      world: "Thunder Empire",
      life: 11,
      hand: 7,
      gauge: 1,
      maxSize: 3,
      ruleSummary: "Life: 11 • Hand: 7 • Gauge: 1 • «Thunder Empire» Cards"
    };
  }
  if (n.includes("divine guardians") || n.includes("guardians")) {
    return {
      key: "guardians",
      world: "Divine Guardians",
      life: 12,
      hand: 6,
      gauge: 1,
      maxSize: 3,
      ruleSummary: "Life: 12 • Hand: 6 • Gauge: 1 • «Guardians» Cards + Generic"
    };
  }
  if (n.includes("searing executioners") || n.includes("executioners")) {
    return {
      key: "executioners",
      world: "Searing Executioners",
      life: 8,
      hand: 6,
      gauge: 4,
      maxSize: 3,
      ruleSummary: "Life: 8 • Hand: 6 • Gauge: 4 • «Executioners» Cards + Generic"
    };
  }
  if (n.includes("parade of hundred demons") || n.includes("hundred demons")) {
    return {
      key: "hundred_demons",
      world: "Parade of Hundred Demons",
      life: 10,
      hand: 6,
      gauge: 2,
      maxSize: 3,
      ruleSummary: "Life: 10 • Hand: 6 • Gauge: 2 • «Hundred Demons» + Generic"
    };
  }
  if (n.includes("godclock") || n.includes("clock-")) {
    return {
      key: "godclock",
      world: "Godclock",
      life: 10,
      hand: 6,
      gauge: 2,
      maxSize: 3,
      cannotStartAsFlag: n.includes("clock-"),
      ruleSummary: "2x2 Connected 4-Card Flag (#5958->#5962, #5959->#5963, #5957->#5961, #5960->#5964) • 1 Flip/Turn"
    };
  }
  if (n.includes("lost world")) {
    return {
      key: "lost_world",
      world: "Lost World",
      life: 10,
      hand: 6,
      gauge: 2,
      maxSize: 3,
      cannotStartAsFlag: true,
      ruleSummary: "Put in Main Deck (Max 2) • Unlocks 30-Card Lost World Sub-Deck!"
    };
  }
  if (n.includes("bang dream")) {
    return {
      key: "bang_dream",
      world: flagCard.worlds[0] || "BanG Dream! Girls Band Party! PICO",
      life: 10,
      hand: 6,
      gauge: 2,
      maxSize: 5,
      ruleSummary: "Life: 10 • Hand: 6 • Gauge: 2 • Max Size: 5"
    };
  }

  const w = (flagCard.worlds && flagCard.worlds[0]) || flagCard.world || "Dragon World";
  return {
    key: "standard",
    world: w,
    life: 10,
    hand: 6,
    gauge: 2,
    maxSize: 3,
    ruleSummary: `Life: 10 • Hand: 6 • Gauge: 2 • <${w}> & <Generic>`
  };
}

function isTrueGenericCard(card) {
  if (!card.worlds || !card.worlds.includes("Generic")) return false;
  if (card.type === "Flag") return false;
  const attrs = (card.attrs || []).map(a => a.toLowerCase());
  const lockedAttrs = ["chaos", "hundreddemons", "guardians", "executioners", "timedragon", "thunderempire"];
  if (attrs.some(a => lockedAttrs.includes(a))) return false;
  return true;
}

function hasDragonInCard(card) {
  const nameHas = (card.name || "").toLowerCase().includes("dragon");
  const worldHas = (card.worlds || []).some(w => w.toLowerCase().includes("dragon"));
  const attrHas = (card.attrs || []).some(a => a.toLowerCase().includes("dragon") || a.toLowerCase() === "drago");
  return nameHas || worldHas || attrHas;
}

const DEITY_GARGA_BUDDY_IDS = [4957, 5021]; // Deity Gargantua Dragon: "if it is your buddy, you may use «Dragod» monsters from all worlds!"

function isAllFlagsRuleCard(card) {
  if (!card || card.omni || card.dragod) return false;
  return /you may use this card with all flags|this card can be used with all flags/i.test(card.skill || "");
}

function checkCardLegalityForFlag(card, flagCard, editingLostDeck = false, buddyId = null) {
  if (!card || !flagCard) return { allowed: false, maxCopies: 0 };

  // "Infinity the Chaos" (#3941) is treated as a Flag and cannot be put into any Main Deck or Lost Deck
  if (Number(card.id) === 3941 || (card.name || "").toLowerCase() === "infinity the chaos") {
    return { allowed: false, maxCopies: 0 };
  }

  if (editingLostDeck) {
    if (card.type === "Flag") return { allowed: false, maxCopies: 0 };
    const isLost = (card.worlds || []).includes("Lost World");
    return { allowed: isLost, maxCopies: isLost ? 4 : 0 };
  }

  const cfg = getFlagConfig(flagCard);
  const cn = (card.name || "").toLowerCase();

  if (card.id === 6202 || cn.includes("overgod")) {
    if (cfg.key === "godclock") {
      return { allowed: true, maxCopies: 4, isSubFlag: "overgod_0" };
    }
    return { allowed: false, maxCopies: 0 };
  }

  if (card.type === "Flag") {
    if (cn.includes("lost world")) {
      return { allowed: true, maxCopies: 2, isSubFlag: "lost_world" };
    }
    if (cn.includes("dragon drei") && cfg.key === "dragon_zwei") {
      return { allowed: true, maxCopies: 4, isSubFlag: "dragon_drei" };
    }
    return { allowed: false, maxCopies: 0 };
  }

  const attrs = (card.attrs || []).map(a => a.toLowerCase());
  const nameLower = (card.name || "").toLowerCase();

  let nativeMatch = false;

  // Dragon Ein: cards with "Dragon" in their name, world or tribe (Monster, Item, Spell, Impact) + <Generic> cards.
  // Dragon Zwei: Dragon Monsters and Impact monsters only (no Items / Spells / Generic). Dragon Drei is allowed as a sub-flag above.
  if (cfg.key === "dragon_ein" || cfg.key === "dragon_zwei") {
    const allowedTypes = cfg.key === "dragon_ein" ? ["Monster", "Item", "Spell", "Impact"] : ["Monster", "Impact"];
    const ok = (allowedTypes.includes(card.type) && hasDragonInCard(card))
      || (cfg.key === "dragon_ein" && isTrueGenericCard(card))
      || (cfg.key === "dragon_ein" && card.type === "Spell" && /flag is "Dragon Ein"/i.test(card.skill || ""));
    if (ok) return { allowed: true, maxCopies: 4 };
  } else if (cfg.key === "chaos") {
    nativeMatch = attrs.some(a => a.includes("chaos")) || nameLower.includes("chaos") || isTrueGenericCard(card);
  } else if (cfg.key === "thunder_empire") {
    nativeMatch = attrs.some(a => a.includes("thunderempire")) || nameLower.includes("thunder empire") || isTrueGenericCard(card);
  } else if (cfg.key === "guardians") {
    nativeMatch = attrs.some(a => a.includes("guardian")) || nameLower.includes("guardian") || isTrueGenericCard(card);
  } else if (cfg.key === "executioners") {
    nativeMatch = attrs.some(a => a.includes("executioner")) || nameLower.includes("executioner") || isTrueGenericCard(card);
  } else if (cfg.key === "hundred_demons") {
    nativeMatch = attrs.some(a => a.includes("hundreddemons")) || nameLower.includes("hundred demons") || isTrueGenericCard(card);
  } else if (cfg.key === "godclock") {
    nativeMatch = attrs.some(a => a.includes("timedragon") || a.includes("godclock")) || nameLower.includes("time ") || isTrueGenericCard(card);
  } else {
    nativeMatch = (card.worlds || []).includes(cfg.world) || isTrueGenericCard(card);
  }

  if (nativeMatch) {
    return { allowed: true, maxCopies: 4 };
  }

  // [Omni Lord]: max 1 copy per deck when off-world
  if (card.omni) {
    return { allowed: true, maxCopies: 1, isOffWorldOmni: true };
  }

  // [Dragod] or "You may use this card with all flags": max 4 copies with all flags
  if (card.dragod || isAllFlagsRuleCard(card)) {
    return { allowed: true, maxCopies: 4, isDragod: Boolean(card.dragod), isAllFlags: !card.dragod };
  }

  // Deity Gargantua Dragon (#4957 / #5021): "if it is your buddy, you may use «Dragod» monsters from all worlds!"
  const activeBuddyId = buddyId !== null && buddyId !== undefined
    ? Number(buddyId)
    : (typeof app !== "undefined" && app.state && Array.isArray(app.state.decks) && app.state.decks[app.state.activeDeckIndex]
      ? Number(app.state.decks[app.state.activeDeckIndex].buddyId)
      : null);
  if (activeBuddyId && DEITY_GARGA_BUDDY_IDS.includes(activeBuddyId) && card.type === "Monster" && attrs.includes("dragod")) {
    return { allowed: true, maxCopies: 4, isDragod: true };
  }

  return { allowed: false, maxCopies: 0 };
}

/* ==================== UNIVERSAL CARD CONDITION & DYNAMIC BUFF ENGINE ==================== */
function getFighterReversalCount(fighter) {
  if (!fighter || !fighter.godclock) return 0;
  return fighter.godclock.reversalCount || 0;
}

function fighterHasDragodOnField(fighter) {
  if (!fighter) return false;
  if (fighter.godclock && (fighter.godclock.awakened || fighter.godclock.overgodActive)) return true;
  return getAllFieldUnits(fighter).some(u => u.card && (u.card.attrs || []).some(a => a.toLowerCase() === "dragod"));
}

function getEffectiveCardSize(fighter, card, unit) {
  if (!card || card.size === null || card.size === undefined) return 0;
  let sz = card.size;
  const s = (card.skill || "").toLowerCase();
  const revCnt = getFighterReversalCount(fighter);

  if (fighter && fighter.hyakuganSizeZeroTurn && sz <= 2 && !(unit && fighter.monsters && fighter.monsters.center === unit) && (card.attrs || []).some(a => normalizeSearchToken(a).includes("hundreddemon"))) {
    return 0;
  }

  if (s.includes("flag is \"overgod, \"0\"\"") && fighter && fighter.godclock && fighter.godclock.overgodActive) {
    const redMatch = s.match(/size\s+on\s+the\s+field\s+is\s+reduced\s+by\s+(\d+)/i);
    if (redMatch) sz -= parseInt(redMatch[1], 10);
  }
  if (s.includes("if a «dragod»") && fighterHasDragodOnField(fighter)) {
    const redMatch = s.match(/size\s+(?:on\s+the\s+field\s+)?(?:is\s+|gets\s+)?reduced\s+by\s+(\d+)/i);
    if (redMatch) sz -= parseInt(redMatch[1], 10);
  }
  if ((s.includes("if your flag [reversal]") || s.includes("if your flag is in [reversal]") || s.includes("if your flags [reversal]")) && revCnt >= 1) {
    const redMatch = s.match(/size\s+(?:on\s+the\s+field\s+)?(?:is\s+|gets\s+)?reduced\s+by\s+(\d+)/i);
    if (redMatch) sz -= parseInt(redMatch[1], 10);
  }
  if (window.ABX && ABX.sizeDelta) sz += ABX.sizeDelta(fighter, card, unit);
  return Math.max(0, sz);
}

function parseCardCost(costStr, skillStr, fighter = null, cardObj = null) {
  if (cardObj && Number(cardObj.id) === YAMIGEDO_SKY_ID) {
    const earthCard = CARD_MAP.get(YAMIGEDO_EARTH_ID);
    if (earthCard) {
      costStr = earthCard.cost;
      skillStr = earthCard.skill;
    }
  }
  const combined = (costStr || "") + "\n" + (skillStr || "");
  let gauge = 0;
  let life = 0;
  let soul = 0;

  const costLineMatch = combined.match(/\[(Call Cost|Cast Cost|Equip Cost)\]\s*([^\n]+)/i);
  if (costLineMatch) {
    const line = costLineMatch[2];
    const gMatch = line.match(/Pay\s+(\d+)\s+gauge/i);
    if (gMatch) gauge = parseInt(gMatch[1], 10);
    // "If you are not [Transform] into a card, pay another N gauge" (#1386): only a fighter with a [Transform] item on the field pays the base cost
    const ntMatch = String(skillStr || line).match(/\[(?:Call|Cast|Equip) Cost\][^\n]*?If you are not \[Transform\][^,]*,\s*pay another (\d+) gauge/i);
    if (ntMatch && !(fighter && getEquippedItems(fighter).some(x => x.unit.card.tr || x.unit.isTransformed))) gauge += parseInt(ntMatch[1], 10);
    const lMatch = line.match(/Pay\s+(\d+)\s+life/i);
    if (lMatch) life = parseInt(lMatch[1], 10);
    const sMatch = line.match(/Put\s+(?:the\s+)?top\s+(?:(one|two|three|\d+)\s+)?cards?\s+of\s+your\s+deck\s+into\s+(?:this\s+(?:card|monster)'s\s+|its\s+)?soul/i);
    if (sMatch) {
      const word = (sMatch[1] || "1").toLowerCase();
      soul = word === "two" ? 2 : word === "three" ? 3 : parseInt(word, 10) || 1;
    }
  }

  if (fighter && cardObj && cardObj.type === "Monster" && gauge > 0) {
    const isTimeDragon = (cardObj.attrs || []).some(a => a.toLowerCase() === "timedragon");
    if (isTimeDragon) {
      const hasLange = getAllFieldUnits(fighter).some(u => u.card && u.card.id === 6022);
      if (hasLange) {
        gauge = Math.max(0, gauge - getFighterReversalCount(fighter));
      }
    }
  }

  // "[Call Cost] is reduced by N gauge if you used [Overturn] ..." on a normal Monster (#4764); Impact Monsters are handled in impact_monsters.js
  if (fighter && cardObj && cardObj.type !== "Impact" && gauge > 0) {
    const rm = combined.match(/\[Call Cost\] is reduced by (\d+) gauge if you (?:have )?used \[(Overturn|Overkill|Overthrow)\]/i);
    if (rm && (fighter.overUsed ? fighter.overUsed[rm[2].toLowerCase()] : fighter.overturnUsed)) gauge = Math.max(0, gauge - parseInt(rm[1], 10));
  }

  return { gauge, life, soul };
}

// [CHAOS Territory]: while a monster with it is on your center (or being called to your center), your center holds two monsters ("center" and "center2").
const MONSTER_POSITIONS = ["left", "center", "center2", "right"];
function cardHasChaosTerritory(card) {
  return !!card && /\[chaos territory\]/i.test(card.skill || "");
}
function hasChaosTerritory(fighter) {
  return !!fighter && ["center", "center2"].some(p => { const u = fighter.monsters[p]; return u && u.card && cardHasChaosTerritory(u.card) && u.abxNullified !== battle.turnCount; });
}
function canPlaceSecondCenter(fighter, incomingCard = null) {
  return !!fighter && !!fighter.monsters && !!fighter.monsters.center && !fighter.monsters.center2 && (hasChaosTerritory(fighter) || cardHasChaosTerritory(incomingCard));
}

// More than one item: supports equipping 2, 3, or any number of items ("item", "item2", "item3", "item4", ...)
const MULTI_ITEM_CARD_IDS = [3728, 6512, 1461, 2553, 2554, 3676, 3869, 4175, 5345, 5346, 6471, 6226];
function cardAllowsMultiItems(card) {
  if (!card) return false;
  if (MULTI_ITEM_CARD_IDS.includes(Number(card.id))) return true;
  return /you may equip (?:any number of|up to two|up to three|two|three|another) [^\n]*items?|equip this card even if you have/i.test(card.skill || "");
}
function cardAllowsUnlimitedItems(card) {
  if (!card) return false;
  if ([3728, 6512, 3869, 4175, 5345, 5346].includes(Number(card.id))) return true;
  return /equip any number of [^\n]*items?/i.test(card.skill || "");
}
function getMaxAllowedItems(fighter, incomingCard = null) {
  if (!fighter) return 1;
  const eq = getEquippedItems(fighter).map(x => x.unit.card);
  const allSources = [
    ...eq,
    ...(fighter.setSpells || []),
    ...MONSTER_POSITIONS.map(p => fighter.monsters && fighter.monsters[p] && fighter.monsters[p].card).filter(Boolean),
    ...getFighterBuddyZoneEntries(fighter).map(e => CARD_MAP.get(e.id)).filter(Boolean),
    incomingCard
  ].filter(Boolean);
  if (allSources.some(c => cardAllowsUnlimitedItems(c))) return 99;
  if (allSources.some(c => /equip up to three/i.test(c.skill || ""))) return 3;
  if (allSources.some(c => cardAllowsMultiItems(c))) return 2;
  return 1;
}
function hasMultiItems(fighter, incomingCard = null) {
  return getMaxAllowedItems(fighter, incomingCard) >= 2;
}
function getEquippedItems(fighter) {
  if (!fighter) return [];
  const list = [];
  if (fighter.item && fighter.item.card && !fighter.item.isEndrulerFlag) list.push({ slot: "item", unit: fighter.item });
  if (fighter.item2 && fighter.item2.card) list.push({ slot: "item2", unit: fighter.item2 });
  if (Array.isArray(fighter.extraItems)) {
    fighter.extraItems.forEach((u, i) => {
      if (u && u.card) list.push({ slot: `item${i + 3}`, unit: u });
    });
  }
  return list;
}
function setEquippedItemAtSlot(fighter, slot, unit) {
  if (!fighter) return;
  if (slot === "item") { fighter.item = unit; return; }
  if (slot === "item2") { fighter.item2 = unit; return; }
  const m = String(slot || "").match(/^item(\d+)$/);
  if (m) {
    const idx = parseInt(m[1], 10) - 3;
    if (idx >= 0) {
      if (!Array.isArray(fighter.extraItems)) fighter.extraItems = [];
      if (unit === null) {
        fighter.extraItems.splice(idx, 1);
      } else {
        fighter.extraItems[idx] = unit;
      }
    }
  }
}
function addEquippedItemToFighter(fighter, newItem, incomingCard = null) {
  if (!fighter || !newItem) return "item";
  const maxItems = getMaxAllowedItems(fighter, incomingCard || newItem.card);
  if (!fighter.item || fighter.item.isEndrulerFlag) {
    fighter.item = newItem;
    return "item";
  }
  if (maxItems >= 2 && !fighter.item2) {
    fighter.item2 = newItem;
    return "item2";
  }
  if (maxItems > 2) {
    if (!Array.isArray(fighter.extraItems)) fighter.extraItems = [];
    if (2 + fighter.extraItems.length < maxItems) {
      fighter.extraItems.push(newItem);
      return `item${2 + fighter.extraItems.length}`;
    }
  }
  fighter.item = newItem;
  return "item";
}
function unitAt(fighter, zone) {
  if (zone === "item") return fighter.item;
  if (zone === "item2") return fighter.item2;
  if (typeof zone === "string" && /^item(\d+)$/.test(zone)) {
    const idx = parseInt(zone.slice(4), 10) - 3;
    return (fighter && Array.isArray(fighter.extraItems) && idx >= 0) ? (fighter.extraItems[idx] || null) : null;
  }
  if (typeof zone === "string" && zone.startsWith("opp_")) {
    const oppPos = zone.slice(4);
    const enemy = (typeof battle !== "undefined" && battle.plr && battle.opp)
      ? (fighter === battle.plr ? battle.opp : battle.plr)
      : null;
    const u = enemy && enemy.monsters ? enemy.monsters[oppPos] : null;
    const mySide = (typeof battle !== "undefined" && battle.plr === fighter) ? "plr" : "opp";
    return (u && u.oppressedBy === mySide) ? u : null;
  }
  return fighter.monsters[zone];
}

function getAllFieldUnits(fighter) {
  const units = [];
  const mySide = (typeof battle !== "undefined" && battle.plr === fighter) ? "plr" : (typeof battle !== "undefined" && battle.opp === fighter ? "opp" : null);
  MONSTER_POSITIONS.forEach(pos => {
    const m = fighter.monsters[pos];
    if (m && (!m.oppressedBy || m.oppressedBy === mySide)) units.push(m);
  });
  if (mySide && typeof battle !== "undefined" && battle.plr && battle.opp) {
    const enemy = mySide === "plr" ? battle.opp : battle.plr;
    if (enemy && enemy.monsters) {
      ["left", "right", "center", "center2"].forEach(pos => {
        const em = enemy.monsters[pos];
        if (em && em.oppressedBy === mySide) units.push(em);
      });
    }
  }
  if (fighter.item) units.push(fighter.item);
  if (fighter.item2) units.push(fighter.item2);
  if (Array.isArray(fighter.extraItems)) {
    fighter.extraItems.forEach(u => { if (u) units.push(u); });
  }
  return units;
}

function fighterHasOmniLordOnField(fighter) {
  return getAllFieldUnits(fighter).some(u => u.card && u.card.omni);
}

function fighterHasEquippedItemMatching(fighter, substring) {
  if (!fighter.item || !fighter.item.card) return false;
  if (!substring) return true;
  const sub = normalizeSearchToken(substring);
  const n = normalizeSearchToken(fighter.item.card.name || "");
  const a = normalizeSearchToken((fighter.item.card.attrs || []).join(" "));
  return n.includes(sub) || a.includes(sub);
}

function fighterHasFieldCardMatching(fighter, substring, excludeUnit = null) {
  const sub = normalizeSearchToken(substring);
  if (!sub) return false;
  if (sub === "dragod" && fighterHasDragodOnField(fighter)) return true;
  if (sub === "timedragon" && fighter.godclock) return true;
  return getAllFieldUnits(fighter).some(u => {
    if (excludeUnit && u === excludeUnit) return false;
    const n = normalizeSearchToken(u.card.name || "");
    const a = normalizeSearchToken((u.card.attrs || []).join(" "));
    return n.includes(sub) || a.includes(sub);
  });
}

function getUnitEffectiveCombatStats(fighter, unit) {
  if (!unit || !unit.card) return { power: 0, defense: 0, crit: 0, pen: false, da: false, ta: false, qa: false };
  // Impact Monsters have their own, exact reader (impact_monsters.js)
  if (window.IMX && IMX.isImpactMonster(unit.card) && window.imCombatStats) return window.imCombatStats(fighter, unit);
  const c = unit.card;
  const s = c.skill || "";
  const revCnt = getFighterReversalCount(fighter);

  let power = (c.power !== null && c.power !== undefined ? c.power : 0) + (unit.tempPower || 0);
  let defense = (c.defense !== null && c.defense !== undefined ? c.defense : 0) + (unit.tempDef || 0);
  let crit = (c.crit !== null && c.crit !== undefined ? c.crit : 1) + (unit.tempCrit || 0);
  let pen = Boolean(c.pen || unit.tempPen);
  let da = Boolean(c.da || unit.tempDA);
  let ta = Boolean(c.ta || unit.tempTA);
  let qa = Boolean(c.qa);

  // Check Time Dragon field auras (e.g. Kronos Valex #6007, Zeitwelg #6046)
  const isTimeDragon = (c.attrs || []).some(a => a.toLowerCase() === "timedragon");
  if (isTimeDragon) {
    fighter.setSpells.forEach(sp => {
      if (sp.id === 6007) {
        power += 4000;
        defense += 4000;
      }
    });
    // (only if the new engine doesn't apply this aura itself — before, both did: +20000 / +2)
    const zeit = CARD_MAP.get(6046);
    const zeitLine = zeit ? (zeit.skill || "").split(/\n+/).find(l => /time dragon/i.test(l) && /power\+10000/i.test(l)) : null;
    const abxOwnsZeit = !!(zeitLine && window.ABX && ABX.ownsStaticLine && ABX.ownsStaticLine(zeit, zeitLine));
    if (!abxOwnsZeit && revCnt >= 2 && getAllFieldUnits(fighter).some(u => u.card && u.card.id === 6046)) {
      power += 10000;
      crit += 1;
    }
  }

  // Check per-Reversal scaling (e.g. Time Scout, Val #6055)
  const perRevMatch = s.match(/gets?\s+power\+(\d+)\s+and\s+defense\+(\d+)\s+for\s+each\s+time\s+your\s+flags\s+\[reversal\]/i);
  if (perRevMatch && revCnt > 0 && !(window.ABX && ABX.ownsStaticLine && ABX.ownsStaticLine(c, (s.split(/\n+/).find(l => perRevMatch[0] && l.includes(perRevMatch[0])) || "")))) {
    power += parseInt(perRevMatch[1], 10) * revCnt;
    defense += parseInt(perRevMatch[2], 10) * revCnt;
  }

  // Check Overgod "0" bonus (e.g. Time Scout, Luke #6205)
  if (fighter.godclock && fighter.godclock.overgodActive && s.toLowerCase().includes("if your flag is \"overgod, \"0\"\"")) {
    const pM = s.match(/power\+(\d+)/i);
    const dM = s.match(/defense\+(\d+)/i);
    const cM = s.match(/critical\+(\d+)/i);
    if (pM) power += parseInt(pM[1], 10);
    if (dM) defense += parseInt(dM[1], 10);
    if (cM) crit += parseInt(cM[1], 10);
    if (s.toLowerCase().includes("[double attack]")) da = true;
  }

  const clauses = s.split(/\n+/);
  clauses.forEach(line => {
    if (window.ABX && ABX.ownsStaticLine && ABX.ownsStaticLine(c, line)) return;
    const l = line.toLowerCase();
    if (!l.startsWith("if ") && !l.startsWith("while ") && !l.startsWith("this card gets") && !l.startsWith("when this card link attacks")) return;
    if (l.includes("for each time your flags [reversal]")) return;
    if (l.includes("if your flag is \"overgod")) return;

    let condSatisfied = true;
    // Lines that grant a keyword ("If ..., this card gets [Double Attack]") must have their condition checked:
    // the new engine reads it when it can; if neither it nor the checks below understand it, nothing is granted.
    const grantsKw = /\[(penetrate|double attack|triple attack)\]/i.test(line) && /^(if|while) /.test(l);
    const abxCond = (grantsKw && window.ABX && ABX.lineCond) ? ABX.lineCond(c, line, fighter, unit) : null;
    let recognized = false;

    const eqNameMatch = line.match(/item\s+with\s+"([^"]+)"\s+in\s+its\s+card\s+name/i);
    if (eqNameMatch) {
      recognized = true;
      if (!fighterHasEquippedItemMatching(fighter, eqNameMatch[1])) condSatisfied = false;
    } else if (l.includes("item equipped") || l.includes("equipping an item")) {
      recognized = true;
      if (!fighter.item) condSatisfied = false;
    }

    if (l.includes("omni lord") && l.includes("field")) {
      recognized = true;
      if (!fighterHasOmniLordOnField(fighter)) condSatisfied = false;
    }

    if (/flags? \[reversal\]|flag is in \[reversal\]/.test(l)) recognized = true;
    if (l.includes("flags [reversal] two times or more")) {
      if (revCnt < 2) condSatisfied = false;
    } else if (l.includes("flags [reversal] three times or more")) {
      if (revCnt < 3) condSatisfied = false;
    } else if (l.includes("flags [reversal]") || l.includes("flag [reversal]") || l.includes("flag is in [reversal]")) {
      if (revCnt < 1) condSatisfied = false;
    }

    const fieldQuoteMatch = line.match(/"([^"]+)"\s+in\s+its\s+card\s+name\s+is\s+on\s+your\s+field|if\s+"([^"]+)"\s+is\s+on\s+your\s+field/i);
    if (fieldQuoteMatch) {
      recognized = true;
      const targetName = fieldQuoteMatch[1] || fieldQuoteMatch[2];
      if (!fighterHasFieldCardMatching(fighter, targetName, unit)) condSatisfied = false;
    }

    const attrFieldMatch = line.match(/«([^»]+)»\s+(?:monster\s+)?is\s+on\s+your\s+field/i);
    if (attrFieldMatch) {
      recognized = true;
      if (!fighterHasFieldCardMatching(fighter, attrFieldMatch[1], unit)) condSatisfied = false;
    }

    const lifeCondMatch = line.match(/if\s+you\s+have\s+(\d+)\s+life\s+or\s+less/i);
    if (lifeCondMatch) {
      recognized = true;
      if (fighter.life > parseInt(lifeCondMatch[1], 10)) condSatisfied = false;
    }

    const dropCondMatch = line.match(/(three|four|five|six|ten|\d+)\s+or\s+more\s+[^\.\n]+\s+in\s+your\s+drop\s+zone/i);
    if (dropCondMatch) {
      recognized = true;
      const wMap = { three: 3, four: 4, five: 5, six: 6, ten: 10 };
      const req = wMap[dropCondMatch[1].toLowerCase()] || parseInt(dropCondMatch[1], 10) || 3;
      if (fighter.drop.length < req) condSatisfied = false;
    }

    if (grantsKw) {
      if (abxCond === true || abxCond === false) condSatisfied = abxCond;   // the new engine read the condition: trust it
      else if (!recognized) condSatisfied = false;                          // nobody understands the requirement: don't grant
    }
    if (!condSatisfied) {
      // (keywords the card really has, or got from an effect this turn, stay)
      if (l.includes("gets [penetrate]") || l.includes("get [penetrate]")) {
        pen = Boolean(c.pen || unit.tempPen);
      }
      if (l.includes("gets [double attack]") || l.includes("get [double attack]")) {
        da = Boolean(c.da || unit.tempDA);
      }
    } else {
      const pBoost = line.match(/power\s*\+\s*(\d+)/i);
      if (pBoost) power += parseInt(pBoost[1], 10);
      const dBoost = line.match(/defense\s*\+\s*(\d+)/i);
      if (dBoost) defense += parseInt(dBoost[1], 10);
      const cBoost = line.match(/critical\s*\+\s*(\d+)/i);
      if (cBoost) crit += parseInt(cBoost[1], 10);
      if (l.includes("[penetrate]")) pen = true;
      if (l.includes("[double attack]")) da = true;
      if (l.includes("[triple attack]")) ta = true;
    }
  });

  if (window.ABX && ABX.staticBonus) {
    const sb = ABX.staticBonus(fighter, unit);
    power += sb.power; defense += sb.defense; crit += sb.crit;
    if (sb.pen) pen = true; if (sb.da) da = true; if (sb.ta) ta = true; if (sb.qa) qa = true;
  }
  if (unit.tempQA) qa = true;
  // "Nullify the attacking card's [Penetrate]" (ABX, for this turn)
  if (window.ABX && ABX.kwNullified) {
    if (ABX.kwNullified(unit, "penetrate")) pen = false;
    if (ABX.kwNullified(unit, "double attack")) da = false;
    if (ABX.kwNullified(unit, "triple attack")) ta = false;
  }

  if (unit.defenseZeroTurn) {
    defense = 0;
  }

  return { power: Math.max(0, power), defense: Math.max(0, defense), crit: Math.max(0, crit), pen, da, ta, qa };
}

/* ==================== [RELEASE CONDITION!] (Dragon Force & other "Force" items) ====================
 * "[Release Condition!] [You have 6 life or less & You have a monster with "Bal Dragon" in its card name on your field]"
 * The item can only be equipped while every part of its release condition is met. Once equipped it stays.
 * A part this reader does not understand counts as NOT met (with the reason shown), never as met. */
function getReleaseConditionText(card) {
  if (!card || !card.skill) return null;
  const line = String(card.skill).split(/\n+/).find(l => /^\s*\[Release Condition!?\]/i.test(l));
  if (!line) return null;
  let t = line.replace(/^\s*\[Release Condition!?\]\s*/i, "").trim();
  t = t.replace(/^\[/, "").replace(/\]\s*$/, "").replace(/[.!]\s*$/, "").trim();
  return t || null;
}

function releaseNameNorm(s) {
  return String(s || "").toLowerCase().replace(/[“”"'’]/g, "").replace(/\s+/g, " ").trim();
}
function releaseTribeEq(card, tribe) {
  const k = String(tribe || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (card.attrs || []).some(a => String(a).toLowerCase().replace(/[^a-z0-9]/g, "") === k);
}
const RELEASE_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const releaseNum = (w) => RELEASE_NUM[String(w).toLowerCase()] || parseInt(w, 10) || 1;

// One part of a release condition -> { known, met, text }
function checkReleaseClause(clause, fighter) {
  const raw = clause.trim().replace(/[.!]+$/, "").replace(/\s+/g, " ");
  const t = raw.toLowerCase();
  const out = (known, met) => ({ known, met: known && met, text: raw });
  let m;
  if ((m = t.match(/^you have (\d+) life or less$/))) return out(true, fighter.life <= parseInt(m[1], 10));
  if ((m = t.match(/^you have (\d+) life or more$/))) return out(true, fighter.life >= parseInt(m[1], 10));

  const fieldMons = MONSTER_POSITIONS.map(p => fighter.monsters[p]).filter(Boolean);
  const sizeOf = (u) => (typeof getEffectiveCardSize === "function" ? getEffectiveCardSize(fighter, u.card, u) : (u.card.size || 0));

  // "You have X or Y equipped"
  if ((m = raw.match(/^you have (.+) equipped$/i))) {
    const item = fighter.item && fighter.item.card;
    const alts = m[1].split(/\s+or\s+(?=a |an |")/i);
    let known = true;
    const met = !!item && alts.some(alt => {
      let a;
      if ((a = alt.match(/^an? (?:<([^>]+)> )?(?:item|card) with "([^"]+)" in its card name$/i))) {
        if (a[1] && releaseNameNorm(item.world) !== releaseNameNorm(a[1]) && !(item.worlds || []).some(w => releaseNameNorm(w) === releaseNameNorm(a[1]))) return false;
        return releaseNameNorm(item.name).includes(releaseNameNorm(a[2]));
      }
      if (/^".+"$/.test(alt.trim())) {
        const want = releaseNameNorm(alt);
        return releaseNameNorm(item.name) === want || releaseNameNorm(item.skill || "").includes("also treated as " + want);
      }
      known = false;
      return false;
    });
    return out(known, met);
  }

  // where to look: field (monsters) and maybe the drop zone
  let body = raw.replace(/^you have /i, "");
  let inDrop = false;
  if ((m = body.match(/^(.+?) (?:is |are )?on your field or (?:in your )?drop zone$/i))) { body = m[1]; inDrop = true; }
  else if ((m = body.match(/^(.+?) (?:is |are )?on (?:your|the) field$/i))) body = m[1];
  else return out(false, false);
  const pool = fieldMons.map(u => ({ card: u.card, unit: u }));
  if (inDrop) fighter.drop.forEach(id => { const c = CARD_MAP.get(id); if (c && c.type === "Monster") pool.push({ card: c, unit: null }); });

  // "Three or more different monsters with both «A» and «B»"
  if ((m = body.match(/^(\w+) or more different monsters with both «([^»]+)» and «([^»]+)»$/i))) {
    const names = new Set(pool.filter(x => x.unit && releaseTribeEq(x.card, m[2]) && releaseTribeEq(x.card, m[3])).map(x => releaseNameNorm(x.card.name)));
    return out(true, names.size >= releaseNum(m[1]));
  }
  // "monsters with "Drum", "Bal Dragon", and "Batzz" in their card names" (each one)
  if ((m = body.match(/^monsters with (.+) in their card names$/i))) {
    const names = (m[1].match(/"([^"]+)"/g) || []).map(q => releaseNameNorm(q));
    if (!names.length) return out(false, false);
    return out(true, names.every(n => pool.some(x => releaseNameNorm(x.card.name).includes(n))));
  }
  // "a [size N (or greater)] monster/«X» [with "A" (or "B") in its card name] [and two or more «Y» (cards) in its soul]"
  m = body.match(/^(?:a|an|one) (?:size (\d+)(?: or (greater|more|less))? )?(monster|«[^»]+»)(?: with ((?:"[^"]+"(?:\s*,?\s*(?:or )?)?)+) in its card name)?(?: and (\w+) or more «([^»]+)»(?: cards?)? in its soul)?$/i);
  if (m) {
    const size = m[1] != null ? parseInt(m[1], 10) : null, cmp = m[2] ? (/less/i.test(m[2]) ? "le" : "ge") : "eq";
    const tribe = /^«/.test(m[3]) ? m[3].slice(1, -1) : null;
    const names = m[4] ? (m[4].match(/"([^"]+)"/g) || []).map(q => releaseNameNorm(q)) : [];
    const soulN = m[5] ? releaseNum(m[5]) : 0, soulTribe = m[6] || null;
    const ok = pool.some(x => {
      if (tribe && !releaseTribeEq(x.card, tribe)) return false;
      if (names.length && !names.some(n => releaseNameNorm(x.card.name).includes(n))) return false;
      if (size != null) {
        const sz = x.unit ? sizeOf(x.unit) : (x.card.size || 0);
        if (cmp === "eq" ? sz !== size : cmp === "ge" ? sz < size : sz > size) return false;
      }
      if (soulN) {
        if (!x.unit) return false;
        const cnt = (x.unit.soul || []).filter(id => { const c = CARD_MAP.get(id); return c && releaseTribeEq(c, soulTribe); }).length;
        if (cnt < soulN) return false;
      }
      return true;
    });
    return out(true, ok);
  }
  return out(false, false);
}

// { has, met, reasons, parts } for a card's release condition (has=false when the card has none)
// "You may not equip this card other than by the ability of "<Name>"" -> the card can't be equipped from hand normally (only by card effects).
function equipOnlyByAbility(card) {
  const m = String(card && card.skill || "").match(/you (?:may not|cannot|can't) equip this card(?: other than| except)? by the abilit(?:y|ies) of ("[^"]+"(?:\s*(?:,|or)\s*"[^"]+")*)|you (?:may not|cannot|can't) equip this card other than by the abilit(?:y|ies) of ("[^"]+")/i);
  return m ? (m[1] || m[2]) : null;
}

function getReleaseConditionStatus(card, fighter) {
  const text = getReleaseConditionText(card);
  if (!text || !fighter) return { has: false, met: true, reasons: [], parts: [] };
  const parts = text.split(/\s*&\s*/).filter(Boolean).map(p => checkReleaseClause(p, fighter));
  const reasons = parts.filter(p => !p.met).map(p => p.known ? `[Release Condition] not met: ${p.text}` : `[Release Condition] can't be checked yet: ${p.text}`);
  return { has: true, met: reasons.length === 0, reasons, parts };
}

// "turn" / "game" when a spell says "You may only cast "<this card>" once per turn / game / fight", else null.
function getSpellCastLimit(card) {
  const m = String(card && card.skill || "").match(/you may only cast "(.*?)" once per (turn|game|fight)\b/i);
  if (!m) return null;
  return m[2].toLowerCase() === "turn" ? "turn" : "game";
}

// Remember a cast so the limit above can be checked (counts even if the opponent nullifies it).
function noteSpellCast(fighter, card) {
  if (!fighter || !getSpellCastLimit(card)) return;
  (fighter.castLimitUsed = fighter.castLimitUsed || {})[card.name] = battle.turnCount;
}

function spellCastLimitReached(fighter, card) {
  const limit = getSpellCastLimit(card);
  if (!limit || !fighter) return false;
  const used = (fighter.castLimitUsed || {})[card.name];
  return limit === "game" ? used != null : used === battle.turnCount;
}

function costNeedsNoMonsters(card, fighter) {
  return !!(card && fighter && fighter.monsters && /\[(?:equip|call|cast) cost\][^\n]*no monsters on your field/i.test((card.cost || "") + "\n" + (card.skill || "")) &&
    ["left", "center", "center2", "right"].some(p => fighter.monsters[p]));
}
function evaluateCardConditions(card, fighter, enemy, isAbilityCall = false) {
  const s = card.skill || "";
  const sLower = s.toLowerCase();
  const cost = parseCardCost(card.cost, card.skill, fighter, card);
  const reasons = [];
  const revCnt = getFighterReversalCount(fighter);

  // [Equip/Call Cost] that only applies "when you have no monsters on your field" (Laevateinn #3728, #4759): cannot be used otherwise
  if (costNeedsNoMonsters(card, fighter)) reasons.push(`You can only use "${card.name}" when you have no monsters on your field.`);

  // "[Call Cost] [When a <World> monster is put from your field into the drop zone, pay N gauge]": it can only be called at that timing, not from your hand during the main phase
  if (!isAbilityCall && window.ABX && ABX.timingCallInfo && card.type === "Monster") {
    const tci = ABX.timingCallInfo(card);
    if (tci) reasons.push(`"${card.name}" can only be called when a <${tci.world}> monster is put from your field into the drop zone (it is offered to you then).`);
  }

  // "The Chaos Upgrade" needs "Infinity the Chaos" face down under the flag (it must be unlocked in the deck first)
  if (Number(card.id) === 4072 && !(fighter.flagUnder || []).includes(3941)) {
    reasons.push(`"Infinity the Chaos" is not unlocked in your deck (or already flipped), so "${card.name}" cannot be cast.`);
  }

  if (spellCastLimitReached(fighter, card)) {
    reasons.push(`You may only cast "${card.name}" once per ${getSpellCastLimit(card) === "game" ? "fight" : "turn"}.`);
  }

  // Items with [Release Condition!] (Dragon Force ...): can only be equipped while the condition is met
  const rel = getReleaseConditionStatus(card, fighter);
  if (rel.has && !rel.met) reasons.push(...rel.reasons);

  if (card.id === 6202) {
    if (!fighter.godclock || !fighter.godclock.awakened) {
      reasons.push("Requires all 4 Godclock cards flipped into Perfected Deity of Eon, The Endruler Dragon first!");
    }
    return {
      met: reasons.length === 0,
      reasons,
      summary: reasons.length === 0 ? "✅ Ready to [Reversal] Endruler Dragon!" : `⚠️ ${reasons[0]}`
    };
  }

  if (isYamigedoHalfId(card.id) && !isAbilityCall) {
    if (!fighterHasBothYamigedoHalvesInHand(fighter)) {
      const missingId = getOtherYamigedoHalfId(card.id);
      const missingCard = CARD_MAP.get(missingId);
      reasons.push(`[Evil Deity] Requires BOTH "Earth Half" (#1911) and "Sky Half" (#1912) in your hand to call normally (missing ${missingCard ? `"${missingCard.name}"` : "the other half"}) — or call via a card ability!`);
    }
  }

  if (fighter.gauge.length < cost.gauge) {
    reasons.push(`Needs ${cost.gauge} Gauge (You have ${fighter.gauge.length})`);
  }
  if (cost.life > 0 && fighter.life <= cost.life) {
    reasons.push(`Needs >${cost.life} Life`);
  }

  // Cast requirements live in the "You may only cast / call this card ..." sentence. Reading the whole skill text mixed in
  // effect branches ("... if you have 2 life or less, draw a card", "... if your flag [Reversal] ...") and negative
  // requirements ("do not have a monster in the center").
  const castSent = (sLower.match(/only cast[^.]*\./g) || []).join(" ");
  const castOrCallSent = (sLower.match(/only (?:cast|call)[^.]*\./g) || []).join(" ");

  if (castSent.includes("flags [reversal] four times or more") && revCnt < 4) {
    reasons.push(`Requires 4+ Flag [Reversal] flips (Current: ${revCnt})`);
  } else if (castSent.includes("flags [reversal] two times or more") && revCnt < 2) {
    reasons.push(`Requires 2+ Flag [Reversal] flips (Current: ${revCnt})`);
  } else if (castSent && (castSent.includes("flag is in [reversal]") || castSent.includes("flag [reversal]") || castSent.includes("flags [reversal]")) && revCnt < 1) {
    reasons.push(`Requires your Flag to have used [Reversal] (Current: ${revCnt})`);
  }

  const oppLifeLessMatch = castSent.match(/opponent's\s+life\s+is\s+(\d+)\s+or\s+less/i);
  if (oppLifeLessMatch && enemy) {
    const reqOppL = parseInt(oppLifeLessMatch[1], 10);
    if (enemy.life > reqOppL) {
      reasons.push(`Requires Opponent's Life to be ${reqOppL} or less (Opponent: ${enemy.life})`);
    }
  }

  const lifeLessMatch = castSent.match(/if\s+you\s+have\s+(\d+)\s+(?:or\s+less\s+life|life\s+or\s+less)/i);
  if (lifeLessMatch) {
    const reqLife = parseInt(lifeLessMatch[1], 10);
    if (fighter.life > reqLife) {
      reasons.push(`Requires ${reqLife} Life or less (Current: ${fighter.life})`);
    }
  }

  const dropCountMatch = castSent.match(/(three|four|five|six|seven|eight|ten|\d+)\s+or\s+more\s+[^\.\n]+\s+in\s+(?:your\s+|the\s+)?drop\s+zone/i);
  if (dropCountMatch) {
    const wordMap = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10 };
    const raw = dropCountMatch[1].toLowerCase();
    const reqDrop = wordMap[raw] || parseInt(raw, 10) || 3;
    if (fighter.drop.length < reqDrop) {
      reasons.push(`Requires ${reqDrop}+ cards in Drop Zone (Current: ${fighter.drop.length})`);
    }
  }

  const needsCenterOpen = /(?:do not have|no|don't have) (?:a )?monsters? (?:in|on) (?:the|your) center|have no monsters on your center/.test(castOrCallSent);
  if (needsCenterOpen && fighter.monsters.center) {
    reasons.push("Requires your Center zone to be open (no monster in Center)");
  }

  if (!needsCenterOpen && castSent.includes("in the center") && castSent.includes("only cast this card if you have") && !fighter.monsters.center) {
    reasons.push("Requires a monster in your Center");
  }

  if (sLower.includes("only cast") && sLower.includes("omni lord") && !fighterHasOmniLordOnField(fighter)) {
    reasons.push("Requires an [Omni Lord] on your field");
  }

  const attrCastMatch = s.match(/only\s+(?:cast|call)\s+this\s+card\s+if\s+(?:you\s+have\s+)?(a|an|two\s+or\s+more|three\s+or\s+more|four\s+or\s+more|five\s+or\s+more)\s+«([^»]+)»([^.,]*)/i);
  if (attrCastMatch) {
    const need = { two: 2, three: 3, four: 4, five: 5 }[String(attrCastMatch[1]).split(/\s+/)[0].toLowerCase()] || 1;
    const inDrop = /in your drop zone/i.test(attrCastMatch[3] || "");
    const sub = normalizeSearchToken(attrCastMatch[2]);
    let have;
    if (inDrop) have = fighter.drop.filter(id => { const c = CARD_MAP.get(id); return c && (normalizeSearchToken(c.name || "").includes(sub) || normalizeSearchToken((c.attrs || []).join(" ")).includes(sub)); }).length;
    else if (need === 1) have = fighterHasFieldCardMatching(fighter, attrCastMatch[2]) ? 1 : 0;
    else have = getAllFieldUnits(fighter).filter(u => normalizeSearchToken(u.card.name || "").includes(sub) || normalizeSearchToken((u.card.attrs || []).join(" ")).includes(sub)).length;
    if (have < need) {
      reasons.push(`Requires ${need > 1 ? need + "+ " : ""}«${attrCastMatch[2]}» ${inDrop ? "in your drop zone" : "on your field"} (Current: ${have})`);
    }
  }

  if (card.type === "Monster" && !(window.IMX && IMX.isImpactMonster(card))) {
    const effSz = getEffectiveCardSize(fighter, card);
    const maxAllowed = (fighter && fighter.maxSize) || 3;
    if (effSz > maxAllowed && !(card.tr || card.ride || card.st)) {
      const limitStr = maxAllowed >= 1e9 ? "∞" : maxAllowed;
      reasons.push(`Monster Size (${effSz}) exceeds your Flag's Max Size limit (${limitStr})${fighter && fighter.flagId === 3337 ? ' — flip into "Infinity the Chaos" (#3941) via "The Chaos Upgrade" (#4072) first!' : '!'}`);
    }
  }

  return {
    met: reasons.length === 0,
    reasons,
    summary: reasons.length === 0 ? "✅ Conditions Met" : `⚠️ ${reasons[0]}`
  };
}

// True when the new engine (ABX) runs every optional ("you may") / search line of this card itself, so the old
// "Use Card Ability" fallback must not run them again. (Before, "Wind Kronos" — run by ABX at the start of the turn —
// could also be used from that button once per turn, putting a card into the soul each time with no limit.)
function abxOwnsOptionalLines(card) {
  if (!card || !window.ABX || !ABX.ownsTriggerLine) return false;
  const crit = parseDeckSearchCriteria(card);
  // "you may" inside a reminder ("[Dragod] (You may use this card with all flags)") is not an ability
  const lines = (card.skill || "").split(/\n+/).map(l => l.trim()).filter(l => /\byou may\b/i.test(l.replace(/\([^)]*\)/g, "")) || (crit && crit.rawText && l.includes(crit.rawText)));
  return lines.length > 0 && lines.every(l => ABX.ownsTriggerLine(card, l) || (ABX.ownsStaticLine && ABX.ownsStaticLine(card, l)));
}

// Can this monster use [Move] now? It needs [Move] (printed, for this turn, or from an ability), and no card may forbid it
// ("All monsters on your opponent's field cannot [Move]", read by abilities_r21.js as the static "oppNoMove").
function canUseMove(side, unit) {
  if (!unit || !unit.card) return false;
  const f = battle.getFighter(side);
  const has = unit.card.move || unit.tempMove || !!(window.ABX && ABX.staticBonus && ABX.staticBonus(f, unit).move);
  if (!has) return false;
  if (!(window.ABX && ABX.core && ABX.core.evalCond)) return true;
  const core = ABX.core;
  return !["plr", "opp"].some(srcSide => {
    const sf = battle.getFighter(srcSide);
    return getAllFieldUnits(sf).some(u => {
      if (!u || !u.card || u.abxNullified === battle.turnCount) return false;
      return (ABX.get(u.card).abilities || []).some(ab => ab.kind === "static" && !(ab.unparsed && ab.unparsed.length) &&
        (ab.steps || []).some(st => st.op === "static" && st.kind === "oppNoMove" && (st.bothSides || srcSide !== side)) &&
        (ab.conds || []).every(c => core.evalCond(c, { side: srcSide, f: sf, e: battle.getFighter(srcSide === "plr" ? "opp" : "plr"), card: u.card, unit: u, bind: { chosen: [] } })));
    });
  });
}

/* ==================== UNIVERSAL DECK SEARCH & TOP-DECK LOOK PARSER ==================== */
// The matched "look at the top N / search" line belongs to a non-enter ability (e.g. "When this card is put from the field into the drop zone", [Act], [Counter]),
// so it must not pop up when the card enters the field.
function deckSearchIsNotEnterTimed(card) {
  const crit = parseDeckSearchCriteria(card);
  return !!(crit && /when this card (?:is put from|is destroyed|leaves|is put into|is discarded)|\[(?:act|counter|auto)\]/i.test(crit.rawText || ""));
}

function parseDeckSearchCriteria(card) {
  if (!card || !card.skill) return null;
  const s = card.skill || "";
  const lines = s.split(/\n+/);

  // 1. Check for "look at the top N cards of your deck"
  const topLine = lines.find(l => /look\s+at\s+(?:up\s+to\s+)?(?:the\s+)?(?:top\s+)?(two|three|four|five|six|\d+)\s+cards?\s+(?:of|from\s+the\s+top\s+of)\s+your\s+deck/i.test(l));
  if (topLine) {
    const m = topLine.match(/look\s+at\s+(?:up\s+to\s+)?(?:the\s+)?(?:top\s+)?(two|three|four|five|six|\d+)\s+cards?\s+(?:of|from\s+the\s+top\s+of)\s+your\s+deck/i);
    const wordMap = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    const rawCnt = (m[1] || "3").toLowerCase();
    const topCount = wordMap[rawCnt] || parseInt(rawCnt, 10) || 3;
    const restToGauge = /rest\s+into\s+(?:your\s+|the\s+)?gauge/i.test(topLine);
    const restToDrop = /drop\s+the\s+rest|rest\s+into\s+(?:your\s+|the\s+)?drop/i.test(topLine);
    return {
      isTopLook: true,
      topCount,
      restAction: restToGauge ? "gauge" : restToDrop ? "drop" : "bottom",
      rawText: topLine,
      nameSubstrings: [],
      attrSubstrings: [],
      requireSet: false,
      requireOmni: false,
      wantTypes: [],
      maxSize: null,
      exactSize: null,
      allowDropZone: false
    };
  }

  // 2. Check for full deck search ("search your deck" or "from your deck ... into your hand / call / drop / gauge")
  const searchLine = lines.find(l => {
    const low = l.toLowerCase();
    if (low.includes("top ") && low.includes("cards of your deck")) return false;
    return (
      low.includes("search your deck") ||
      (low.includes("from your deck") && (low.includes("into your hand") || low.includes("to your hand") || low.includes("call ") || low.includes("into your gauge") || low.includes("into your drop")))
    );
  });

  if (!searchLine) return null;

  // Strip out "You may only cast/use "..." once per..." and leading ability titles like `"Ability Name" When...`
  let cleaned = searchLine
    .replace(/You\s+may\s+only\s+(?:cast|use|activate)\s+"[^"]+(?:"[^"]+")?[^"]*"\s+once\s+per\s+\w+\.?/gi, "")
    .replace(/^\s*"[^"]+"\s+(?=When|At|If|\[)/i, "");

  // Extract target clause between "search your deck for" / "put" / "call" and "from your deck" / "into your hand" / "and shuffle"
  const nameSubstrings = [];
  if (/Overgod,\s*"0"/i.test(cleaned)) {
    nameSubstrings.push('Overgod, "0"');
  } else if (/Jackknife\s+"Gold\s+Ritter"/i.test(cleaned)) {
    nameSubstrings.push('Jackknife "Gold Ritter"');
  } else {
    const quoteRegex = /"([^"]+)"/g;
    let qm;
    while ((qm = quoteRegex.exec(cleaned)) !== null) {
      const candidate = qm[1].trim();
      if (candidate && candidate.toLowerCase() !== (card.name || "").toLowerCase() || cleaned.toLowerCase().includes("same card name") || cleaned.toLowerCase().includes(`for up to one "${(card.name || "").toLowerCase()}"`)) {
        nameSubstrings.push(candidate);
      }
    }
  }

  const attrSubstrings = [];
  const attrRegex = /«([^»]+)»/g;
  let am;
  while ((am = attrRegex.exec(cleaned)) !== null) {
    const attrVal = (am[1] || "").trim();
    if (attrVal) attrSubstrings.push(attrVal);
  }

  // Also check unquoted tribe names commonly used in early text files (e.g. "for an Adventurer", "for a Staff", "Olympus monster", "Hundred Demons spell", "Asgard spell", "Ninja", "Knight item", "Hero", "Duel Dragon")
  const knownUnquotedTribes = [
    "Adventurer", "Staff", "Olympus", "Hundred Demons", "Demon Way",
    "Asgard", "Ninja", "Knight", "Hero", "Duel Dragon", "Time Dragon", "Dragod",
    "Guardians", "Executioners", "Thunder Empire", "Chaos"
  ];
  knownUnquotedTribes.forEach(tr => {
    const rx = new RegExp(`\\b${tr.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (rx.test(cleaned) && !attrSubstrings.some(a => normalizeSearchToken(a) === normalizeSearchToken(tr))) {
      attrSubstrings.push(tr);
    }
  });

  const requireSet = /\[Set\]|\bwith\s+Set\b/i.test(cleaned);
  const requireOmni = /\[Omni Lord\]/i.test(cleaned);
  const allowDropZone = /from\s+your\s+deck\s+or\s+drop\s+zone/i.test(cleaned);

  const wantTypes = [];
  if (/\bmonster\b/i.test(cleaned)) wantTypes.push("Monster");
  if (/\bitem\b/i.test(cleaned)) wantTypes.push("Item");
  if (/\bspell\b/i.test(cleaned)) wantTypes.push("Spell");
  if (/\bimpact\b/i.test(cleaned)) wantTypes.push("Impact");

  let maxSize = null;
  let exactSize = null;
  const sizeLessMatch = cleaned.match(/size\s+(\d+)\s+or\s+less/i);
  const sizeExactMatch = cleaned.match(/size\s+(\d+)(?!\s+or)/i);
  if (sizeLessMatch) maxSize = parseInt(sizeLessMatch[1], 10);
  else if (sizeExactMatch) exactSize = parseInt(sizeExactMatch[1], 10);

  const lowCleaned = cleaned.toLowerCase();
  const destAction = (lowCleaned.includes("call ") && !lowCleaned.includes("into your hand") && !lowCleaned.includes("to your hand"))
    ? "call"
    : "hand";

  return {
    isTopLook: false,
    destAction,
    rawText: searchLine,
    nameSubstrings,
    attrSubstrings,
    requireSet,
    requireOmni,
    wantTypes,
    maxSize,
    exactSize,
    allowDropZone
  };
}

function cardMatchesSearchCriteria(card, criteria) {
  if (!card) return false;
  if (!criteria || criteria.isTopLook) return true;

  // 1. Check card name / words in card name
  if (criteria.nameSubstrings && criteria.nameSubstrings.length > 0) {
    const cNameLower = (card.name || "").toLowerCase();
    const cNameNorm = normalizeSearchToken(card.name || "");
    const nameMatched = criteria.nameSubstrings.some(sub => {
      const subLower = sub.toLowerCase();
      const subNorm = normalizeSearchToken(sub);
      return cNameLower.includes(subLower) || (subNorm && cNameNorm.includes(subNorm));
    });
    // Note: Some cards say `monster with "Harry" in its card name, or up to one «Drago Phantom Thief» item`
    if (!nameMatched) {
      if (!(criteria.wantTypes.includes("Item") && card.type === "Item" && criteria.attrSubstrings.length > 0)) {
        return false;
      }
    }
  }

  // 2. Check attributes / tribes («Attribute»)
  if (criteria.attrSubstrings && criteria.attrSubstrings.length > 0) {
    const cardAttrsNorm = (card.attrs || []).map(a => normalizeSearchToken(a));
    const cardNameNorm = normalizeSearchToken(card.name || "");
    const requireAll = /both\s+«/i.test(criteria.rawText || "");
    if (requireAll) {
      const allMatched = criteria.attrSubstrings.every(reqA => {
        const normReq = normalizeSearchToken(reqA);
        return cardAttrsNorm.some(ca => ca.includes(normReq)) || cardNameNorm.includes(normReq);
      });
      if (!allMatched) return false;
    } else {
      const anyMatched = criteria.attrSubstrings.some(reqA => {
        const normReq = normalizeSearchToken(reqA);
        return cardAttrsNorm.some(ca => ca.includes(normReq)) || cardNameNorm.includes(normReq);
      });
      if (!anyMatched && (!criteria.nameSubstrings || criteria.nameSubstrings.length === 0)) {
        return false;
      }
    }
  }

  if (criteria.requireSet && !card.set) return false;
  if (criteria.requireOmni && !card.omni) return false;

  if (criteria.wantTypes && criteria.wantTypes.length > 0) {
    if (!criteria.wantTypes.includes(card.type)) {
      // Allow Overgod "0" when searching by exact name
      if (!(criteria.nameSubstrings.length > 0 && criteria.nameSubstrings.some(s => (card.name || "").toLowerCase().includes(s.toLowerCase())))) {
        return false;
      }
    }
  }

  if (criteria.maxSize !== null && card.type === "Monster") {
    if (card.size === null || card.size > criteria.maxSize) return false;
  }
  if (criteria.exactSize !== null && card.type === "Monster") {
    if (card.size !== criteria.exactSize) return false;
  }

  return true;
}


function parseDropZoneCriteria(card) {
  if (!card || !card.skill) return null;
  const s = card.skill || "";
  const lines = s.split(/\n+/);
  const dropLine = lines.find(l => {
    const low = l.toLowerCase();
    if (low.includes("from your deck or drop zone")) return false;
    if (low.includes("when this card is put from") || low.includes("or more") && low.includes("in your drop zone")) return false;
    return (
      (low.includes("from your drop zone") || low.includes("from the drop zone") || low.includes("in your drop zone")) &&
      (low.includes("into your hand") || low.includes("to your hand") || low.includes("call ") || low.includes("into its soul") || low.includes("into the soul") || low.includes("into this card's soul"))
    );
  });
  if (!dropLine) return null;

  let cleaned = dropLine
    .replace(/You\s+may\s+only\s+(?:cast|use|activate)\s+"[^"]+(?:"[^"]+")?[^"]*"\s+once\s+per\s+\w+\.?/gi, "")
    .replace(/^\s*"[^"]+"\s+(?=When|At|If|\[)/i, "");

  const nameSubstrings = [];
  const quoteRegex = /"([^"]+)"/g;
  let qm;
  while ((qm = quoteRegex.exec(cleaned)) !== null) {
    const candidate = qm[1].trim();
    if (candidate && candidate.toLowerCase() !== (card.name || "").toLowerCase()) {
      nameSubstrings.push(candidate);
    }
  }

  const attrSubstrings = [];
  const attrRegex = /«([^»]+)»/g;
  let am;
  while ((am = attrRegex.exec(cleaned)) !== null) {
    if (am[1]) attrSubstrings.push(am[1].trim());
  }

  const wantTypes = [];
  if (/\bmonster\b/i.test(cleaned)) wantTypes.push("Monster");
  if (/\bitem\b/i.test(cleaned)) wantTypes.push("Item");
  if (/\bspell\b/i.test(cleaned)) wantTypes.push("Spell");
  if (/\bimpact\b/i.test(cleaned)) wantTypes.push("Impact");

  const low = cleaned.toLowerCase();
  const destAction = (low.includes("into your hand") || low.includes("to your hand"))
    ? "hand"
    : (low.includes("into its soul") || low.includes("into the soul") || low.includes("into this card's soul"))
    ? "soul"
    : "call";

  return {
    isDropSearch: true,
    destAction,
    rawText: dropLine,
    nameSubstrings,
    attrSubstrings,
    requireSet: false,
    requireOmni: false,
    wantTypes,
    maxSize: null,
    exactSize: null
  };
}

function classifyDefensiveCounterCard(card) {
  if (!card) return null;
  const s = card.skill || "";
  const sLow = s.toLowerCase();

  // Exclude spell-nullifiers ("when your opponent casts a spell")
  if (sLow.includes("when your opponent cast") && sLow.includes("spell") && !sLow.includes("nullify the attack")) {
    return null;
  }

  // Monsters / items are only [Counter] HAND cards if a [Counter] line is used from the hand
  // ("discard this card from your hand", "drop this hand card", "call this card from your hand").
  // Their other [Counter] [Act] abilities are used from the field / soul / drop zone (ABX.fieldCounterOptions),
  // e.g. Time General, Zeitwelg (6046) — before, the old code let you play it from the hand like a spell.
  if (card.type === "Monster" || card.type === "Item") {
    const HAND_LINE = /\b(?:discard|drop) this (?:hand )?card\b(?! from (?:the|your) (?:field|soul|drop))|\bthis hand card\b|\bthis card from (?:your )?hand\b|\bthis card in your hand\b/i;
    const counterLines = s.split(/\n+/).filter(l => /\[counter\]/i.test(l));
    if (!counterLines.some(l => HAND_LINE.test(l))) return null;
  }

  // 1. Attack Nullifiers / Battle Enders
  if (
    sLow.includes("nullify the attack") ||
    sLow.includes("nullify that attack") ||
    sLow.includes("end the battle") ||
    sLow.includes("end that battle") ||
    sLow.includes("end this phase") ||
    sLow.includes("end the attack phase")
  ) {
    return {
      category: "nullify_attack",
      bonusPower: 0,
      bonusDef: 0,
      bonusCrit: 0,
      grantsCA: false,
      grantsIndestructible: false
    };
  }

  // 2. Monster-in-Battle Stat Buff / [Counterattack] / Indestructible Spells
  const isBattleBuff =
    (card.cnt || sLow.includes("[counter]")) &&
    (sLow.includes("in battle") || sLow.includes("monster on your field") || sLow.includes("card on your field")) &&
    (sLow.includes("power+") || sLow.includes("defense+") || sLow.includes("counterattack") || sLow.includes("would be destroyed, that monster remains") || sLow.includes("cannot be destroyed"));

  if (isBattleBuff) {
    const pMatches = [...s.matchAll(/power\s*\+\s*(\d+)/gi)];
    const dMatches = [...s.matchAll(/defense\s*\+\s*(\d+)/gi)];
    const cMatches = [...s.matchAll(/critical\s*\+\s*(\d+)/gi)];

    const bonusPower = pMatches.length > 0 ? parseInt(pMatches[0][1], 10) : (sLow.includes("power") ? 3000 : 0);
    const bonusDef = dMatches.length > 0 ? parseInt(dMatches[0][1], 10) : (sLow.includes("defense") ? 3000 : 0);
    const bonusCrit = cMatches.length > 0 ? parseInt(cMatches[0][1], 10) : 0;
    const grantsCA = sLow.includes("counterattack");
    const grantsIndestructible = sLow.includes("would be destroyed") && (sLow.includes("remains on the field") || sLow.includes("nullify its destruction")) || sLow.includes("cannot be destroyed");

    // Check if the buff spell requires a specific tribe/attribute on the monster in battle
    let requiredTribe = null;
    const attrM = s.match(/Choose\s+(?:a|an)\s+«([^»]+)»/i);
    if (attrM) {
      requiredTribe = attrM[1];
    } else {
      const knownTribes = ["Armordragon", "Dragon Knight", "Wild Dragon", "Dragon Lord", "Shinsengumi", "Wizard", "72 Pillars", "Skull Warrior", "Ninja", "Hero", "Wydar Sarkal", "Time Dragon", "Dragod"];
      for (const tr of knownTribes) {
        if (new RegExp(`Choose\\s+(?:a|an)\\s+${tr}`, "i").test(s)) {
          requiredTribe = tr;
          break;
        }
      }
    }

    return {
      category: "monster_battle_buff",
      bonusPower,
      bonusDef,
      bonusCrit,
      grantsCA,
      grantsIndestructible,
      requiredTribe
    };
  }

  // 3. Fighter Damage Reduction Spells
  if (
    (card.cnt || sLow.includes("[counter]")) &&
    (sLow.includes("damage you take is reduced") || sLow.includes("damage is reduced") || sLow.includes("next damage you take is reduced"))
  ) {
    const redZero = sLow.includes("reduced to 0");
    const redM = sLow.match(/reduced\s+by\s+(\d+)/i);
    const reduceAmt = redZero ? 99 : (redM ? parseInt(redM[1], 10) : 2);
    return {
      category: "damage_reduce",
      reduceAmt
    };
  }

  return null;
}

function isDefensiveCounterCard(card) {
  return Boolean(classifyDefensiveCounterCard(card));
}

function generateLostDeck() {
  const lostPool = ALL_CARDS.filter(c => c.type !== "Flag" && (c.worlds || []).includes("Lost World"));
  const lostCards = [];
  const counts = {};
  lostPool.forEach(c => {
    for (let i = 0; i < 2; i++) {
      if (lostCards.length < 30 && (counts[c.id] || 0) < 4) {
        lostCards.push(c.id);
        counts[c.id] = (counts[c.id] || 0) + 1;
      }
    }
  });
  return lostCards;
}

const DECK_SIZE = 50; // Buddyfight main decks require at least 50 cards (50+)

// "The Chaos" decks: "The Chaos Upgrade" (#4072) must be in the deck to flip the flag (generated decks get one copy).
function chaosDeckCards(flagCard, cards) {
  if (Number(flagCard.id) !== 3337 || cards.includes(4072)) return cards;
  const out = cards.slice(); out[out.length - 1] = 4072; return out;
}
function generateFlagDeck(flagId, customTitle, preferredBuddyId, includeLostWorld = false) {
  const flagCard = CARD_MAP.get(flagId) || ALL_CARDS.find(c => c.type === "Flag" && c.worlds.includes("Dragon World")) || ALL_CARDS[0];
  const cfg = getFlagConfig(flagCard);

  const legalPool = ALL_CARDS.filter(c => checkCardLegalityForFlag(c, flagCard, false).allowed && (c.type !== "Flag" || c.id === 6202));
  const monsters = legalPool.filter(c => c.type === "Monster");
  const s1 = monsters.filter(c => c.size === 1 || c.size === 0);
  const s2 = monsters.filter(c => c.size === 2);
  const s3 = monsters.filter(c => c.size >= 3);
  const items = legalPool.filter(c => c.type === "Item");
  const defSpells = legalPool.filter(c => c.type === "Spell" && isDefensiveCounterCard(c));
  const otherSpells = legalPool.filter(c => c.type === "Spell" && !isDefensiveCounterCard(c));
  const impacts = legalPool.filter(c => c.type === "Impact");

  let buddyCard = CARD_MAP.get(preferredBuddyId);
  if (!buddyCard || !checkCardLegalityForFlag(buddyCard, flagCard, false).allowed || buddyCard.type === "Flag") {
    if (cfg.key === "godclock") {
      buddyCard = CARD_MAP.get(6065) || CARD_MAP.get(5956) || CARD_MAP.get(5955);
    } else {
      buddyCard = s2.find(c => c.sg || c.pen || c.da || c.move) || s3[0] || s1[0] || monsters[0] || ALL_CARDS[45];
    }
  }

  const cards = [];
  const counts = {};
  function addCopies(card, qty, maxLim = 4) {
    if (!card) return;
    for (let i = 0; i < qty; i++) {
      if (cards.length >= DECK_SIZE) return;
      if ((counts[card.id] || 0) >= maxLim) return;
      cards.push(card.id);
      counts[card.id] = (counts[card.id] || 0) + 1;
    }
  }

  if (cfg.key === "dragon_zwei") {
    const dreiCard = CARD_MAP.get(2789);
    if (dreiCard) addCopies(dreiCard, 2, 4);
  }

  if (cfg.key === "godclock") {
    // Include Overgod "0" (#6202), Time Scout Luke (#6205), Time Ruler Dragons (#6065, #5955, #5956), and Kronos Syn Epita (#5948)
    addCopies(CARD_MAP.get(6202), 2, 4);
    addCopies(CARD_MAP.get(6205), 3, 4);
    addCopies(CARD_MAP.get(6065), 3, 4);
    addCopies(CARD_MAP.get(5955), 3, 4);
    addCopies(CARD_MAP.get(5948), 3, 4);
    addCopies(CARD_MAP.get(6010), 2, 4);
  }

  if (includeLostWorld) {
    const lostFlag = CARD_MAP.get(4569);
    if (lostFlag) addCopies(lostFlag, 2, 2);
  }

  addCopies(buddyCard, 4);

  const priorityS1 = [...s1].sort((a, b) => ((b.move ? 2 : 0) + (b.sg ? 2 : 0) + (b.pen ? 1 : 0)) - ((a.move ? 2 : 0) + (a.sg ? 2 : 0) + (a.pen ? 1 : 0)));
  priorityS1.slice(0, 7).forEach(c => addCopies(c, 3));
  s2.slice(0, 5).forEach(c => addCopies(c, 2));
  s3.slice(0, 4).forEach(c => addCopies(c, 2));

  if (cfg.key !== "dragon_zwei") {
    items.slice(0, 2).forEach(c => addCopies(c, 2));
    defSpells.slice(0, 3).forEach(c => addCopies(c, 3));
    otherSpells.slice(0, 3).forEach(c => addCopies(c, 2));
    impacts.slice(0, 2).forEach(c => addCopies(c, 2));
  }

  let idx = 0;
  while (cards.length < DECK_SIZE && idx < legalPool.length) {
    addCopies(legalPool[idx], 2);
    idx++;
  }

  return {
    name: customTitle || `${cfg.world} Deck`,
    world: cfg.world,
    flagId: flagCard.id,
    buddyId: buddyCard ? buddyCard.id : 46,
    cards: chaosDeckCards(flagCard, cards),
    infinityChaos: Number(flagCard.id) === 3337,
    lostDeck: includeLostWorld ? generateLostDeck() : []
  };
}

/* ==================== SMART RANDOM AUTO-BUILD (Deck editor "⚡ Auto") ==================== */
// Builds a different deck every time, but themed around the player's Flag and Buddy:
// cards of the Buddy's tribes, cards of tribes the Flag names (e.g. «Chaos», «Thunder Empire»),
// and spells/items/impacts that support those tribes or mention the Buddy by name are picked first.
function normTribeKey(t) {
  return (t || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^\d+/, "").replace(/s$/, "");
}

function getSkillTribeKeys(card) {
  const out = [];
  const txt = card && card.skill ? card.skill : "";
  const re = /«([^»]+)»/g;
  let m;
  while ((m = re.exec(txt))) out.push(normTribeKey(m[1]));
  return out;
}

function generateSmartDeck(flagId, customTitle, preferredBuddyId, includeLostWorld = false) {
  const flagCard = CARD_MAP.get(flagId) || ALL_CARDS.find(c => c.type === "Flag" && c.worlds.includes("Dragon World")) || ALL_CARDS[0];
  const cfg = getFlagConfig(flagCard);
  const legality = new Map();
  const legalPool = [];
  ALL_CARDS.forEach(c => {
    if (c.type === "Flag" && c.id !== 6202) return;
    const leg = checkCardLegalityForFlag(c, flagCard, false);
    if (!leg.allowed) return;
    legality.set(c.id, leg.maxCopies || 4);
    legalPool.push(c);
  });
  const monsters = legalPool.filter(c => c.type === "Monster");

  // How many legal monsters belong to each tribe (used to pick themes that actually have cards).
  const tribeCount = new Map();
  monsters.forEach(c => (c.attrs || []).forEach(a => {
    const k = normTribeKey(a);
    tribeCount.set(k, (tribeCount.get(k) || 0) + 1);
  }));

  // 1) Buddy: keep the player's buddy if it's legal, otherwise pick a random size 1–3 monster.
  let buddyCard = CARD_MAP.get(preferredBuddyId);
  const buddyLegal = buddyCard && buddyCard.type !== "Flag" && legality.has(buddyCard.id);
  if (!buddyLegal) {
    if (cfg.key === "godclock") {
      buddyCard = CARD_MAP.get(6065) || CARD_MAP.get(5956) || CARD_MAP.get(5955);
    } else {
      const choices = monsters.filter(c => c.size >= 1 && c.size <= 3 && (c.attrs || []).some(a => (tribeCount.get(normTribeKey(a)) || 0) >= 12));
      const pool = choices.length ? choices : monsters;
      buddyCard = pool[Math.floor(Math.random() * pool.length)] || ALL_CARDS[45];
    }
  }

  // 2) Theme tribes: the Buddy's tribes + any tribe the Flag names. Very common tribes count for less.
  const theme = new Map();
  const addTheme = (k, w) => { if (k) theme.set(k, Math.max(theme.get(k) || 0, w)); };
  (buddyCard.attrs || []).forEach(a => {
    const k = normTribeKey(a);
    const n = tribeCount.get(k) || 0;
    addTheme(k, n === 0 ? 0 : (n > monsters.length * 0.35 ? 0.5 : 1));
  });
  getSkillTribeKeys(flagCard).forEach(k => addTheme(k, 1.2));
  if (![...theme.values()].some(w => w > 0)) {
    const common = [...tribeCount.entries()].filter(([, n]) => n >= 12);
    if (common.length) addTheme(common[Math.floor(Math.random() * common.length)][0], 1);
  }
  const buddyNameRef = `"${buddyCard.name}"`;

  // 3) Score every legal card: synergy first, plus a random shake so each build is different.
  const scored = legalPool.map(c => {
    let score = Math.random() * 2.5;
    let tribeW = 0;
    (c.attrs || []).forEach(a => { tribeW = Math.max(tribeW, theme.get(normTribeKey(a)) || 0); });
    score += tribeW * 4;
    const refs = getSkillTribeKeys(c);
    if (refs.length) {
      const refW = Math.max(0, ...refs.map(k => theme.get(k) || 0));
      if (refW > 0) score += refW * 3;
      else if (c.type !== "Monster") score -= 3; // support card for a tribe this deck doesn't run
      else score -= 1;
    }
    if (c.skill && c.skill.includes(buddyNameRef)) score += 5;
    if (c.type === "Monster") score += (c.move ? 0.5 : 0) + (c.sg ? 0.5 : 0) + (c.pen ? 0.3 : 0);
    if (c.id === buddyCard.id) score -= 100; // added separately
    return { c, score };
  }).sort((a, b) => b.score - a.score);

  const cards = [];
  const counts = {};
  function addCopies(card, qty) {
    if (!card) return;
    const maxLim = legality.get(card.id) || (card.id === 4569 ? 2 : 4);
    for (let i = 0; i < qty; i++) {
      if (cards.length >= DECK_SIZE) return;
      if ((counts[card.id] || 0) >= maxLim) return;
      cards.push(card.id);
      counts[card.id] = (counts[card.id] || 0) + 1;
    }
  }
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const pick = (filter, n, lo, hi) => {
    scored.filter(x => filter(x.c) && !counts[x.c.id]).slice(0, n).forEach(x => addCopies(x.c, rnd(lo, hi)));
  };

  // Flag-specific core cards (same as the starter decks).
  if (cfg.key === "dragon_zwei") addCopies(CARD_MAP.get(2789), 2);
  if (cfg.key === "godclock") {
    [[6202, 2], [6205, 3], [6065, 3], [5955, 3], [5948, 3], [6010, 2]].forEach(([id, q]) => addCopies(CARD_MAP.get(id), q));
  }
  if (includeLostWorld) addCopies(CARD_MAP.get(4569), 2);

  addCopies(buddyCard, 4);

  const isDef = c => c.type === "Spell" && isDefensiveCounterCard(c);
  // Roughly 30 monsters + 20 spells/items/impacts, like a normal tournament deck.
  pick(c => c.type === "Monster" && (c.size === 0 || c.size === 1), 5, 3, 4);
  pick(c => c.type === "Monster" && c.size === 2, 3, 2, 3);
  pick(c => c.type === "Monster" && c.size >= 3, 2, 2, 2);
  pick(isDef, 3, 2, 3);
  pick(c => c.type === "Impact", rnd(1, 2), 2, 2);
  pick(c => c.type === "Item", rnd(1, 2), 2, 2);
  pick(c => c.type === "Spell" && !isDef(c), 3, 2, 3);

  // Top up to 50 with the next-best on-theme cards (no more monsters once there are ~32).
  const monsterCount = () => cards.filter(id => (CARD_MAP.get(id) || {}).type === "Monster").length;
  for (const pass of [0, 1]) {
    for (const x of scored) {
      if (cards.length >= DECK_SIZE) break;
      if (x.c.type === "Flag") continue;
      if (pass === 0 && x.c.type === "Monster" && monsterCount() >= 32) continue;
      addCopies(x.c, 2);
    }
  }

  return {
    name: customTitle || `${cfg.world} Deck`,
    world: cfg.world,
    flagId: flagCard.id,
    buddyId: buddyCard ? buddyCard.id : 46,
    cards: chaosDeckCards(flagCard, cards),
    infinityChaos: Number(flagCard.id) === 3337,
    lostDeck: includeLostWorld ? generateLostDeck() : []
  };
}

function getPackPriceAndRarity(cardCount) {
  if (cardCount <= 80) {
    return { price: 350, tier: "💎 Limited / Ultra Rare Set" };
  }
  if (cardCount <= 150) {
    return { price: 280, tier: "✨ Special Crossover Set" };
  }
  if (cardCount <= 420) {
    return { price: 200, tier: "⭐ Core World Set" };
  }
  if (cardCount <= 700) {
    return { price: 150, tier: "🔥 Major World Set" };
  }
  return { price: 120, tier: "🐉 Mega World Pool" };
}

/* ==================== ONLINE PLAY: OPTIONAL TURN RELAY SERVERS ==================== */
// Add TURN server entries here to make online rooms work across mobile data / strict networks.
// Example: { urls: "turn:a.relay.example.com:443?transport=tcp", username: "USER", credential: "PASS" }
const ONLINE_TURN_SERVERS = [];

// Free public relay (Metered "Open Relay", no signup, ~20 GB/month shared) so two phones on
// different networks / mobile data can still connect. Uses the standard TURN shared-secret
// scheme: username = "<expiry>:<name>", password = base64(HMAC-SHA1(secret, username)).
const OPEN_RELAY_HOST = "staticauth.openrelay.metered.ca";
const OPEN_RELAY_SECRET = "openrelayprojectsecret";

async function buildOpenRelayTurnServers() {
  try {
    if (!window.crypto || !crypto.subtle) return [];
    const enc = new TextEncoder();
    const expiry = Math.floor(Date.now() / 1000) + 24 * 3600;
    const username = `${expiry}:buddyfight`;
    const key = await crypto.subtle.importKey("raw", enc.encode(OPEN_RELAY_SECRET), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(username)));
    const credential = btoa(String.fromCharCode(...sig));
    return [{
      urls: [
        `turn:${OPEN_RELAY_HOST}:80`,
        `turn:${OPEN_RELAY_HOST}:80?transport=tcp`,
        `turn:${OPEN_RELAY_HOST}:443`,
        `turns:${OPEN_RELAY_HOST}:443?transport=tcp`
      ],
      username,
      credential
    }];
  } catch (e) {
    console.warn("Could not prepare relay server credentials:", e);
    return [];
  }
}

/* ==================== MAIN APPLICATION CONTROLLER ==================== */
const app = {
  lang: "en",
  state: {
    coins: 2500,
    rp: 1000,
    wins: 0,
    losses: 0,
    streak: 0,
    owned: {},
    decks: [],
    activeDeckIndex: 0
  },
  colPage: 1,
  colPageSize: 40,
  dkPage: 1,
  dkPageSize: 30,
  deckEditTab: "main",
  isEditingDeck: false,
  currentInspectCardId: null,
  lastPackWorld: "Dragon World",
  roomChannel: null,
  activeRoomCode: null,

  init() {
    try { this.applyMat(); } catch (e) { console.warn("Playmat init failed", e); }
    this.loadState();
    this.initMultiplayerChannel();
    this.populateWorldAndTribeDropdowns();
    this.applyLanguage();
    this.renderHub();
    this.renderShop();
    this.renderCollection(1);
    this.renderDeckScreen();
  },

  loadState() {
    try {
      const saved = localStorage.getItem("buddyfight_save_v5") || localStorage.getItem("buddyfight_save_v4");
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this.state, parsed);
      }
    } catch (e) {
      console.warn("Could not load save:", e);
    }

    // Repair a damaged or very old save so the game can't crash on start-up.
    const st = this.state;
    if (!st.owned || typeof st.owned !== "object" || Array.isArray(st.owned)) st.owned = {};
    ["coins", "rp", "wins", "losses", "streak"].forEach(k => {
      if (!Number.isFinite(Number(st[k]))) st[k] = k === "coins" ? 2500 : k === "rp" ? 1000 : 0;
      else st[k] = Number(st[k]);
    });
    st.decks = (Array.isArray(st.decks) ? st.decks : []).filter(d => d && typeof d === "object");
    st.decks.forEach(d => {
      // Unknown flag: use the same fallback flag the screens already showed for it.
      d.flagId = CARD_MAP.has(Number(d.flagId)) ? Number(d.flagId) : (ALL_CARDS[0] ? ALL_CARDS[0].id : 1);
      d.cards = (Array.isArray(d.cards) ? d.cards : []).map(Number).filter(id => CARD_MAP.has(id));
      d.lostDeck = (Array.isArray(d.lostDeck) ? d.lostDeck : []).map(Number).filter(id => CARD_MAP.has(id));
      d.infinityChaos = d.flagId === 3337 && !!d.infinityChaos;   // "Infinity the Chaos" unlocked in this deck (only with "The Chaos")
      if (!CARD_MAP.has(Number(d.buddyId))) d.buddyId = 46;
      d.buddyId = Number(d.buddyId);
      if (typeof d.name !== "string" || !d.name.trim()) d.name = "Custom Deck";
    });

    if (!this.state.decks || this.state.decks.length === 0) {
      const d1 = generateFlagDeck(447, "🐉 Dragon World — Gargantua & Lost World", 571, true);
      const d2 = generateFlagDeck(5957, "⏳ Godclock — Endruler Dragon & Overgod \"0\"", 6065, false);
      const d3 = generateFlagDeck(2370, "🌑 Dragon Zwei & Drei — 20 Life Revival", 2371, false);
      this.state.decks = [d1, d2, d3];

      this.state.decks.forEach(dk => {
        this.state.owned[dk.flagId] = Math.max(this.state.owned[dk.flagId] || 0, 1);
        this.state.owned[dk.buddyId] = Math.max(this.state.owned[dk.buddyId] || 0, 4);
        dk.cards.forEach(cid => {
          this.state.owned[cid] = Math.max(this.state.owned[cid] || 0, 4);
        });
        (dk.lostDeck || []).forEach(cid => {
          this.state.owned[cid] = Math.max(this.state.owned[cid] || 0, 4);
        });
      });
      this.saveState();
    } else {
      // Ensure existing Godclock decks have a valid monster buddy & Overgod "0" (#6202) + Time Scout Luke (#6205) unlocked
      this.state.owned[6202] = Math.max(this.state.owned[6202] || 0, 4);
      this.state.owned[6205] = Math.max(this.state.owned[6205] || 0, 4);
      this.state.owned[6065] = Math.max(this.state.owned[6065] || 0, 4);
      this.state.owned[5955] = Math.max(this.state.owned[5955] || 0, 4);
      this.state.decks.forEach(dk => {
        if (dk.flagId === 5957) {
          if (dk.buddyId === 5961) dk.buddyId = 6065;
        }
      });
    }

    const idx = parseInt(this.state.activeDeckIndex, 10);
    this.state.activeDeckIndex = Number.isInteger(idx) ? Math.max(0, Math.min(idx, this.state.decks.length - 1)) : 0;
  },

  saveState() {
    try {
      localStorage.setItem("buddyfight_save_v5", JSON.stringify(this.state));
    } catch (e) {}
    this.updateTopNav();
  },

  toggleLanguage() {
    this.lang = this.lang === "en" ? "th" : "en";
    this.applyLanguage();
    this.renderHub();
    this.renderShop();
    this.renderCollection(this.colPage);
    this.renderDeckScreen();
  },

  applyLanguage() {
    const dict = I18N[this.lang] || I18N.en;
    const isTh = this.lang === "th";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });
    const btn = document.getElementById("btn-lang-toggle");
    if (btn) {
      btn.textContent = isTh ? "🇬🇧 English / ไทย" : "🇹🇭 ภาษาไทย / EN";
    }

    const colSearch = document.getElementById("col-search");
    if (colSearch) colSearch.placeholder = isTh ? "ค้นหาชื่อการ์ด, เผ่า (Time Dragon, ร้อยอสูร, การ์เดียนส์), สกิล หรือ #ID..." : "Search card name, tribe (Time Dragon, Hundred Demons, Executioners, Guardians), skill, or #ID...";

    const dkSearch = document.getElementById("dk-search");
    if (dkSearch) dkSearch.placeholder = isTh ? "ค้นหาการ์ดเพื่อใส่เด็ค (ชื่อการ์ด, เผ่า, Overgod, Dragod)..." : "Search card name, tribe (Time Dragon, Hundred Demons, Guardians...), or 'Overgod'...";

    // Update World & Tribe dropdown labels for current language
    ["col-world", "dk-world"].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      Array.from(sel.options).forEach(opt => {
        if (WORLDS_LIST.includes(opt.value)) {
          opt.textContent = tWorld(opt.value);
        } else if (opt.value === "" && id === "col-world") {
          opt.textContent = isTh ? "ทุกเวิลด์ (19 เวิลด์)" : "All 19 Worlds";
        } else if (opt.value === "" && id === "dk-world") {
          opt.textContent = isTh ? "การ์ดที่ใช้ได้ตามแฟล็กปัจจุบัน" : "Legal For Current Flag";
        } else if (opt.value === "FLAGS_ONLY") {
          opt.textContent = isTh ? "🏳️ แสดงแฟล็กทั้งหมด (Flags)" : "🏳️ Show All Flags";
        } else if (opt.value === "DRAGOD_ONLY") {
          opt.textContent = isTh ? "🐉 แสดง [Dragod] ทั้งหมด (ใส่ได้ทุกเวิลด์ 4 ใบ)" : "🐉 Show All [Dragod] (All Flags — Max 4)";
        } else if (opt.value === "OMNI_LORDS") {
          opt.textContent = isTh ? "👑 แสดง [Omni Lord] ทั้งหมด (ข้ามเวิลด์ได้ 1 ใบ)" : "👑 Show All [Omni Lord] (Off-World — Max 1)";
        } else if (opt.value === "ALL") {
          opt.textContent = isTh ? "แสดงทุกเวิลด์ทั้งหมด" : "Show All Worlds (Unrestricted)";
        }
      });
    });
  },

  getRankTitle(rp) {
    if (rp >= 2500) return "👑 Buddy Champion";
    if (rp >= 2000) return "💎 Master Fighter";
    if (rp >= 1600) return "🥇 Gold Fighter";
    if (rp >= 1300) return "🥈 Silver Fighter";
    if (rp >= 1100) return "🥉 Bronze Fighter";
    return "🛡️ Rookie Fighter";
  },

  updateTopNav() {
    const ownedUnique = Object.keys(this.state.owned).filter(k => this.state.owned[k] > 0).length;
    document.getElementById("nav-coins").textContent = this.state.coins.toLocaleString();
    document.getElementById("nav-owned").textContent = ownedUnique.toLocaleString();
    document.getElementById("nav-rank-badge").textContent = `${this.getRankTitle(this.state.rp)} (${this.state.rp} RP)`;
  },

  showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.screen === screenId);
    });

    const topNav = document.getElementById("top-nav");
    if (screenId === "battle") {
      topNav.classList.add("hidden");
      this.playBgm();
    } else {
      topNav.classList.remove("hidden");
      this.stopBgm();
    }

    if (screenId === "hub") this.renderHub();
    if (screenId === "collection") this.renderCollection(this.colPage);
    if (screenId === "deck") {
      this.isEditingDeck = false;
      this.renderDeckScreen();
    }
  },

  populateWorldAndTribeDropdowns() {
    const colSet = document.getElementById("col-set");
    if (colSet) {
      const setCounts = new Map();
      ALL_CARDS.forEach(c => {
        (c.sets || []).forEach(s => setCounts.set(s, (setCounts.get(s) || 0) + 1));
      });
      const orderedSets = Array.from(setCounts.keys()).sort((a, b) => a.localeCompare(b));
      orderedSets.forEach(sCode => {
        const opt = document.createElement("option");
        opt.value = sCode;
        opt.textContent = `${getSetDisplayName(sCode)} (${setCounts.get(sCode)} Cards)`;
        colSet.appendChild(opt);
      });
    }
    const colWorld = document.getElementById("col-world");
    const dkWorld = document.getElementById("dk-world");
    WORLDS_LIST.forEach(w => {
      if (colWorld) {
        const opt1 = document.createElement("option");
        opt1.value = w;
        opt1.textContent = w;
        colWorld.appendChild(opt1);
      }
      if (dkWorld) {
        const opt2 = document.createElement("option");
        opt2.value = w;
        opt2.textContent = w;
        dkWorld.appendChild(opt2);
      }
    });

    // Collect all unique attributes across all 6,573 cards
    const attrCounts = new Map();
    ALL_CARDS.forEach(c => {
      (c.attrs || []).forEach(a => {
        if (a && a.length > 1) {
          attrCounts.set(a, (attrCounts.get(a) || 0) + 1);
        }
      });
    });

    const featuredSet = new Set(FEATURED_TRIBES.map(t => t.val));
    const remainingAttrs = Array.from(attrCounts.keys())
      .filter(a => !featuredSet.has(a))
      .sort((a, b) => formatTribeDisplayName(a).localeCompare(formatTribeDisplayName(b)));

    ["col-tribe", "dk-tribe", "ds-tribe"].forEach(selectId => {
      const sel = document.getElementById(selectId);
      if (!sel) return;

      const grpPop = document.createElement("optgroup");
      grpPop.label = "⭐ Popular Tribes / Attributes";
      FEATURED_TRIBES.forEach(ft => {
        const opt = document.createElement("option");
        opt.value = ft.val;
        opt.textContent = `${ft.label} (${attrCounts.get(ft.val) || 0})`;
        grpPop.appendChild(opt);
      });
      sel.appendChild(grpPop);

      const grpAll = document.createElement("optgroup");
      grpAll.label = "📚 All Tribes (A–Z)";
      remainingAttrs.forEach(rawA => {
        const opt = document.createElement("option");
        opt.value = rawA;
        opt.textContent = `«${formatTribeDisplayName(rawA)}» (${attrCounts.get(rawA)})`;
        grpAll.appendChild(opt);
      });
      sel.appendChild(grpAll);
    });
  },

  renderHub() {
    this.updateTopNav();
    const deck = this.state.decks[this.state.activeDeckIndex] || this.state.decks[0];
    const buddy = CARD_MAP.get(deck.buddyId) || ALL_CARDS[45];
    const flag = CARD_MAP.get(deck.flagId) || ALL_CARDS[0];
    const cfg = getFlagConfig(flag);

    const hubBuddyIds = getDefaultBuddyZoneIds(buddy.id, deck.buddyIds);
    const hubBuddyCards = hubBuddyIds.map(id => CARD_MAP.get(id)).filter(Boolean);
    const hubBuddyVis = document.getElementById("hub-buddy-visual");
    if (hubBuddyVis) {
      if (hubBuddyCards.length > 1) {
        const n = Math.min(4, hubBuddyCards.length);
        const focusIdx = ((this.deckBuddyPreviewIdx || 0) % n + n) % n;
        const ordered = [];
        for (let i = 1; i < n; i++) ordered.push({ card: hubBuddyCards[(focusIdx + i) % n], origIdx: (focusIdx + i) % n, isFront: false });
        ordered.push({ card: hubBuddyCards[focusIdx], origIdx: focusIdx, isFront: true });
        const stepPct = n === 2 ? 42 : n === 3 ? 30 : 22;
        const startLeft = -Math.floor((stepPct * (n - 1)) / 2);
        hubBuddyVis.innerHTML = `<div class="slot-fan-stack buddy-fan-stack buddy-count-${n}">${ordered.map((it, slotPos) => `
          <div class="fan-card-slot ${it.isFront ? "active-front-buddy" : ""}" style="--fan-offset:${startLeft + slotPos * stepPct}%; z-index:${slotPos + 2};" title="Buddy #${it.origIdx + 1}: ${escapeHtml(it.card.name)}">
            <img src="${it.card.img}" alt="${escapeHtml(it.card.name)}" />
          </div>`).join("")}
        </div>`;
      } else {
        hubBuddyVis.innerHTML = isYamigedoHalfId(buddy.id)
          ? renderYamigedoDualStackHtml()
          : `<img id="hub-buddy-img" src="${buddy.img}" alt="Buddy" />`;
      }
    }
    document.getElementById("hub-rank-title").textContent = `${this.getRankTitle(this.state.rp)} (${this.state.rp} RP)`;
    const rpPct = Math.min(100, Math.max(8, ((this.state.rp - 800) / 1800) * 100));
    document.getElementById("hub-rp-bar").style.width = `${rpPct}%`;

    document.getElementById("hub-wins").textContent = this.state.wins;
    document.getElementById("hub-losses").textContent = this.state.losses;
    document.getElementById("hub-streak").textContent = `${this.state.streak}🔥`;

    const sel = document.getElementById("hub-deck-select");
    sel.innerHTML = "";
    this.state.decks.forEach((d, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = d.name;
      if (idx === this.state.activeDeckIndex) opt.selected = true;
      sel.appendChild(opt);
    });

    const hasLost = deck.cards.some(cid => [4569, 5760].includes(cid));
    const missingTotal = this.getDeckMissingCardCount(deck);
    document.getElementById("hub-deck-summary").innerHTML = `
      <div>🏳️ <strong>Flag:</strong> ${escapeHtml(flag.name)} (${escapeHtml(cfg.ruleSummary)})</div>
      <div>🌟 <strong>Buddy:</strong> ${escapeHtml(getBuddyDisplayName(buddy))}</div>
      <div>🃏 <strong>Main Deck:</strong> ${deck.cards.length} Cards (Min 50)${hasLost ? ` • 🌌 <strong>Lost Deck:</strong> ${(deck.lostDeck || []).length}/30` : ""}</div>
      ${missingTotal > 0 ? `<div style="color:#fca5a5; font-weight:800;">⚠️ Missing ${missingTotal} card copies in Collection (Open Packs or Unlock Sandbox)</div>` : ""}
    `;
  },

  getDeckMissingCardCount(deck) {
    const counts = {};
    (deck.cards || []).forEach(cid => counts[cid] = (counts[cid] || 0) + 1);
    let missing = 0;
    Object.entries(counts).forEach(([cid, reqQty]) => {
      const ownedQty = this.state.owned[cid] || 0;
      if (ownedQty < reqQty) missing += (reqQty - ownedQty);
    });
    return missing;
  },

  previewActiveBuddy() {
    const deck = this.state.decks[this.state.activeDeckIndex] || this.state.decks[0];
    const ids = getDefaultBuddyZoneIds(deck.buddyId, deck.buddyIds);
    const focusIdx = ((this.deckBuddyPreviewIdx || 0) % ids.length + ids.length) % ids.length;
    this.openCardModal(ids[focusIdx] || deck.buddyId, true);
    this.setModalNav(ids.length > 1);
  },

  // ===== Playmats: each mat is ONE player's side; two copies are joined (top one rotated 180°) =====
  MATS: [
    { id: "neon",     name: "Neon Arena (animated)",         img: "" },
    { id: "classic",  name: "Classic Field (printed zones)", img: "Sprite/Field1.png" },
    { id: "godclock", name: "Godclock Reversal",             img: "Sprite/Mats/mat-godclock.jpg" },
    { id: "heroes",   name: "Buddyfight Heroes",             img: "Sprite/Mats/mat-heroes.jpg" },
    { id: "endruler", name: "Endruler Twin Dragons",         img: "Sprite/Mats/mat-endruler.jpg" }
  ],

  // Battle music: plays while the battle screen is up, volume remembered per browser.
  getBgmVolume() {
    let v = 0.5;
    try {
      const saved = localStorage.getItem("bf_bgm_volume");
      if (saved !== null && !isNaN(parseFloat(saved))) v = parseFloat(saved);
    } catch (e) {}
    return Math.min(1, Math.max(0, v));
  },

  isBgmMuted() {
    try { return localStorage.getItem("bf_bgm_muted") === "1"; } catch (e) { return false; }
  },

  syncBgmControls() {
    const audio = document.getElementById("battle-bgm");
    const vol = this.getBgmVolume();
    const muted = this.isBgmMuted();
    if (audio) {
      audio.volume = vol;
      audio.muted = muted;
    }
    const slider = document.getElementById("bgm-volume-slider");
    if (slider) slider.value = Math.round(vol * 100);
    const btn = document.getElementById("bgm-mute-btn");
    if (btn) {
      btn.textContent = muted || vol === 0 ? "🔇" : vol < 0.5 ? "🔉" : "🔊";
      btn.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
    }
  },

  setBgmVolume(v) {
    try {
      localStorage.setItem("bf_bgm_volume", String(v));
      // Dragging the slider up un-mutes, like most players expect.
      if (v > 0) localStorage.setItem("bf_bgm_muted", "0");
    } catch (e) {}
    this.syncBgmControls();
    this.keepBgmControlOpen();
  },

  toggleBgmMute() {
    // Phones show only the speaker button: the first tap opens the slider, a tap while open mutes / unmutes.
    const ctl = document.querySelector(".bgm-volume");
    if (ctl && window.matchMedia && window.matchMedia("(max-width: 600px)").matches && !ctl.classList.contains("open")) {
      ctl.classList.add("open");
      this.keepBgmControlOpen();
      const close = (ev) => {
        if (ctl.contains(ev.target)) return;
        ctl.classList.remove("open");
        document.removeEventListener("pointerdown", close, true);
      };
      document.addEventListener("pointerdown", close, true);
      requestAnimationFrame(() => this.placeBgmControl());
      return;
    }
    try { localStorage.setItem("bf_bgm_muted", this.isBgmMuted() ? "0" : "1"); } catch (e) {}
    this.syncBgmControls();
    this.keepBgmControlOpen();
  },

  // the phone slider folds back after a few seconds without use
  keepBgmControlOpen() {
    const ctl = document.querySelector(".bgm-volume");
    if (!ctl || !ctl.classList.contains("open")) return;
    clearTimeout(this._bgmCloseTimer);
    this._bgmCloseTimer = setTimeout(() => { ctl.classList.remove("open"); this.placeBgmControl(); }, 4000);
  },

  // Keep the volume control in the bottom-left corner, but lift it above the hand when they would overlap
  // (narrow / phone screens), so it never covers a hand card.
  placeBgmControl() {
    const ctl = document.querySelector(".bgm-volume");
    const hand = document.getElementById("bt-plr-hand");
    if (!ctl) return;
    ctl.style.bottom = "";
    if (!hand) return;
    const c = ctl.getBoundingClientRect(), h = hand.getBoundingClientRect();
    if (!h.width || !c.width) return;
    const overlaps = c.left < h.right && c.right > h.left && c.top < h.bottom && c.bottom > h.top;
    if (overlaps) ctl.style.bottom = `${12 + (c.bottom - h.top) + 6}px`;
  },

  watchBgmControl() {
    if (this._bgmWatch) return;
    this._bgmWatch = true;
    const place = () => this.placeBgmControl();
    window.addEventListener("resize", place);
    const hand = document.getElementById("bt-plr-hand");
    if (hand && typeof ResizeObserver !== "undefined") new ResizeObserver(place).observe(hand);
  },

  playBgm() {
    const audio = document.getElementById("battle-bgm");
    if (!audio) return;
    this.syncBgmControls();
    this.watchBgmControl();
    requestAnimationFrame(() => this.placeBgmControl());
    if (!audio.paused) return;
    const p = audio.play();
    // Browsers block autoplay until the page has been clicked; retry on the next click.
    if (p && p.catch) {
      p.catch(() => {
        const retry = () => {
          if (document.getElementById("screen-battle").classList.contains("active")) audio.play().catch(() => {});
        };
        document.addEventListener("pointerdown", retry, { once: true });
      });
    }
  },

  stopBgm() {
    const audio = document.getElementById("battle-bgm");
    if (!audio || audio.paused) return;
    audio.pause();
    audio.currentTime = 0;
  },

  getMatId() {
    let id = "neon";
    try { id = localStorage.getItem("bf_mat") || "neon"; } catch (e) {}
    return this.MATS.some(m => m.id === id) ? id : "neon";
  },

  selectMat(id) {
    try { localStorage.setItem("bf_mat", id); } catch (e) {}
    this.applyMat();
  },

  applyMat() {
    const id = this.getMatId();
    const mat = this.MATS.find(m => m.id === id) || this.MATS[0];
    const pm = document.getElementById("field-playmat");
    if (pm) {
      pm.classList.toggle("custom-mat", id !== "classic");
      pm.classList.toggle("neon-mat", id === "neon");
      pm.style.setProperty("--mat-img", mat.img ? `url("${mat.img}")` : "none");
    }
    const sel = document.getElementById("hub-mat-select");
    if (sel) {
      if (!sel.options.length) sel.innerHTML = this.MATS.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
      sel.value = id;
    }
    const pv = document.getElementById("hub-mat-preview");
    if (pv) {
      pv.classList.toggle("neon-preview", id === "neon");
      pv.style.setProperty("--mat-img", mat.img ? `url("${mat.img}")` : "none");
    }
  },

  selectActiveDeck(idx) {
    this.state.activeDeckIndex = parseInt(idx, 10) || 0;
    this.saveState();
    this.renderHub();
  },

  unlockAllCards() {
    ALL_CARDS.forEach(c => {
      this.state.owned[c.id] = 4;
    });
    this.state.coins += 10000;
    this.saveState();
    this.renderHub();
    alert("🔓 All 6,573 Buddyfight cards (4 copies each) and +10,000 BP have been unlocked!");
  },

  renderShop() {
    const grid = document.getElementById("shop-packs-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const isTh = this.lang === "th";
    const searchQ = (document.getElementById("shop-search")?.value || "").trim().toLowerCase();
    const eraFilter = document.getElementById("shop-era-filter")?.value || "ALL";

    // Group all 6,573 cards by their Set Code (BT01, TD01, HBT01, DBT01, XBT01, SBT01, SCBT03, etc.)
    const setPools = getSetPools();

    const setOrderWeight = (code) => {
      if (code.startsWith("BT")) return 10 + (parseInt(code.slice(2), 10) || 0);
      if (code.startsWith("TD")) return 30 + (parseInt(code.slice(2), 10) || 0);
      if (code.startsWith("EB") || code.startsWith("CP") || code.startsWith("PP") || code.startsWith("SS")) return 50;
      if (code.startsWith("HBT")) return 100 + (parseInt(code.slice(3), 10) || 0);
      if (code.startsWith("HTD") || code.startsWith("HSD") || code.startsWith("HEB") || code.startsWith("HPP")) return 130;
      if (code.startsWith("DBT")) return 200;
      if (code.startsWith("DTD") || code.startsWith("DSD") || code.startsWith("DEB") || code.startsWith("DSS")) return 230;
      if (code.startsWith("XBT")) return 300;
      if (code.startsWith("X")) return 330;
      if (code.startsWith("SBT") || code.startsWith("SCBT")) return 400;
      if (code.startsWith("SUB")) return 450;
      return 900;
    };

    const sortedSetCodes = Array.from(setPools.keys()).sort((a, b) => {
      const wa = setOrderWeight(a);
      const wb = setOrderWeight(b);
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b);
    });

    sortedSetCodes.forEach(sCode => {
      const packCards = setPools.get(sCode) || [];
      if (packCards.length === 0) return;
      const title = getSetDisplayName(sCode);

      if (searchQ) {
        const hay = `${sCode} ${title}`.toLowerCase();
        if (!hay.includes(searchQ)) return;
      }

      if (eraFilter !== "ALL") {
        if (eraFilter === "BT" && !/(^BT|^HBT|^DBT|^XBT|^SBT)/.test(sCode)) return;
        if (eraFilter === "TD" && !/(TD|SD)/.test(sCode)) return;
        if (eraFilter === "EB" && !/(EB|CP|PP|SS|CBT|UB|SP)/.test(sCode)) return;
        if (eraFilter === "S1" && !/^(BT0|TD0|EB0|CP0|PP0|SS0)/.test(sCode)) return;
        if (eraFilter === "H" && !sCode.startsWith("H")) return;
        if (eraFilter === "D" && !sCode.startsWith("D")) return;
        if (eraFilter === "X" && !sCode.startsWith("X")) return;
        if (eraFilter === "S" && !sCode.startsWith("S")) return;
      }

      const repCard = packCards.find(c => c.size === 3 || c.dragod || c.omni) || packCards.find(c => c.size === 2) || packCards[0];
      const { price, tier } = getPackPriceAndRarity(packCards.length);
      const ownedInSet = packCards.filter(c => (this.state.owned[c.id] || 0) > 0).length;

      const div = document.createElement("div");
      div.className = "pack-card";
      div.innerHTML = `
        <div class="pack-rarity-tag">${tier}</div>
        <div class="pack-cover" style="margin-top:16px;">
          <img src="${repCard.img}" alt="${sCode}" loading="lazy" />
        </div>
        <div class="pack-title">${title}</div>
        <div class="pack-count">${isTh ? `การ์ดในชุด ${packCards.length} ใบ (มีแล้ว ${ownedInSet}/${packCards.length}) • สุ่มได้ 5 ใบ/แพ็ค` : `${packCards.length} Cards in Set (Owned ${ownedInSet}/${packCards.length}) • 5 Cards / Pack`}</div>
        <button class="secondary-btn full-width pack-preview-btn" onclick="app.openPackPreview('${sCode.replace(/'/g, "\'")}')">
          👁 ${isTh ? `ดูการ์ดในแพ็ค (${packCards.length} ใบ)` : `Preview Cards (${packCards.length})`}
        </button>
        <button class="primary-cta-btn full-width" onclick="app.buyPack('${sCode.replace(/'/g, "\'")}')">
          🪙 ${isTh ? `เปิดแพ็ค ${sCode} (${price} BP)` : `Buy ${sCode} Pack (${price} BP)`}
        </button>
      `;
      grid.appendChild(div);
    });
  },

  // ===== Pack Preview: see every card that can be pulled from a pack before buying =====
  openPackPreview(setCode) {
    const cards = getSetPools().get(setCode) || [];
    if (cards.length === 0) return;
    this.previewSetCode = setCode;
    const isTh = this.lang === "th";
    const { price } = getPackPriceAndRarity(cards.length);

    document.getElementById("pack-preview-title").textContent = isTh
      ? `👁 การ์ดในแพ็ค ${getSetDisplayName(setCode)}`
      : `👁 ${getSetDisplayName(setCode)} — Cards in this Pack`;

    const searchEl = document.getElementById("pack-preview-search");
    searchEl.value = "";
    searchEl.placeholder = isTh ? "ค้นหาชื่อการ์ด..." : "Search card name...";

    const typeSel = document.getElementById("pack-preview-type");
    const types = Array.from(new Set(cards.map(c => c.type).filter(Boolean))).sort();
    typeSel.innerHTML = `<option value="">${isTh ? "ทุกประเภท" : "All Types"}</option>` +
      types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

    const ownedSel = document.getElementById("pack-preview-owned");
    ownedSel.innerHTML = `
      <option value="">${isTh ? "ทั้งหมด" : "All Cards"}</option>
      <option value="owned">${isTh ? "มีแล้ว" : "Owned"}</option>
      <option value="missing">${isTh ? "ยังไม่มี" : "Not Owned"}</option>`;

    document.getElementById("pack-preview-buy").textContent = isTh
      ? `🪙 เปิดแพ็ค ${setCode} (${price} BP)`
      : `🪙 Buy ${setCode} Pack (${price} BP)`;
    document.getElementById("pack-preview-close").textContent = isTh ? "ปิด" : "Close";

    this.renderPackPreview();
    document.getElementById("pack-preview-modal").classList.remove("hidden");
  },

  renderPackPreview() {
    const setCode = this.previewSetCode;
    const cards = getSetPools().get(setCode) || [];
    const isTh = this.lang === "th";
    const q = (document.getElementById("pack-preview-search").value || "").trim().toLowerCase();
    const typeF = document.getElementById("pack-preview-type").value;
    const ownedF = document.getElementById("pack-preview-owned").value;
    const ownedCount = id => this.state.owned[id] || 0;

    const shown = cards.filter(c => {
      if (q && !String(c.name || "").toLowerCase().includes(q)) return false;
      if (typeF && c.type !== typeF) return false;
      if (ownedF === "owned" && ownedCount(c.id) === 0) return false;
      if (ownedF === "missing" && ownedCount(c.id) > 0) return false;
      return true;
    });

    const ownedTotal = cards.filter(c => ownedCount(c.id) > 0).length;
    document.getElementById("pack-preview-sub").textContent = isTh
      ? `${cards.length} ใบในแพ็ค • มีแล้ว ${ownedTotal}/${cards.length} • สุ่มได้ 5 ใบต่อแพ็ค (ทุกใบมีโอกาสเท่ากัน) • กดการ์ดเพื่อดูรายละเอียด`
      : `${cards.length} cards in this pack • You own ${ownedTotal}/${cards.length} • 5 random cards per pack (every card has the same chance) • Click a card for details`;

    const grid = document.getElementById("pack-preview-grid");
    if (shown.length === 0) {
      grid.innerHTML = `<div class="pack-preview-empty">${isTh ? "ไม่พบการ์ดที่ตรงกับตัวกรอง" : "No cards match these filters."}</div>`;
      return;
    }
    grid.innerHTML = shown.map(c => {
      const n = ownedCount(c.id);
      const lim = c.type === "Flag" ? 1 : 4;
      const badge = n >= lim
        ? `<span class="pp-badge owned">MAX x${n}</span>`
        : n > 0
        ? `<span class="pp-badge owned">${isTh ? "มี" : "Owned"} x${n}</span>`
        : `<span class="pp-badge missing">${isTh ? "ยังไม่มี" : "New"}</span>`;
      const sizeTxt = c.size !== null && c.size !== undefined ? ` • ${isTh ? "ไซส์" : "Size"} ${c.size}` : "";
      return `
        <div class="pack-preview-card ${n > 0 ? "" : "not-owned"}" onclick="app.openCardModal(${c.id})" title="${escapeHtml(c.name)}">
          ${badge}
          <img src="${c.img}" alt="${escapeHtml(c.name)}" loading="lazy" />
          <div class="pp-name">${escapeHtml(c.name)}</div>
          <div class="pp-sub">${escapeHtml(c.type || "")}${sizeTxt}</div>
        </div>`;
    }).join("");
  },

  buyFromPackPreview() {
    const code = this.previewSetCode;
    this.closePackPreview();
    if (code) this.buyPack(code);
  },

  closePackPreview() {
    document.getElementById("pack-preview-modal").classList.add("hidden");
  },

  claimFreeCoins() {
    this.state.coins += 500;
    this.saveState();
  },

  buyPack(setCode) {
    let pool = ALL_CARDS.filter(c => (c.sets || []).includes(setCode));
    if (pool.length === 0) {
      pool = ALL_CARDS.filter(c => c.worlds.includes(setCode));
    }
    const { price } = getPackPriceAndRarity(pool.length);

    // Collection limit: max 4 copies per card (Flags = 1). Maxed cards no longer drop.
    const ownLimit = c => (c.type === "Flag" ? 1 : 4);
    const canDrop = c => (this.state.owned[c.id] || 0) < ownLimit(c);
    if (!pool.some(canDrop)) {
      alert(this.lang === "th"
        ? `คุณมีการ์ดในแพ็ค ${setCode} ครบลิมิตแล้ว (ไม่เสีย BP)`
        : `You already own every card in ${setCode} at the max limit. No BP spent.`);
      return;
    }

    if (this.state.coins < price) {
      alert(this.lang === "th"
        ? `BP ไม่พอ! แพ็คนี้ใช้ ${price} BP (คุณมี ${this.state.coins} BP) กดปุ่ม '🎁 รับฟรี +500 BP' ด้านขวาบนของร้านค้าได้เลย!`
        : `Not enough BP! This pack costs ${price} BP (you have ${this.state.coins} BP). Click '🎁 Claim +500 Free BP' in the top right of the Shop!`);
      return;
    }
    this.state.coins -= price;
    this.lastPackWorld = setCode;

    const pulled = [];
    for (let i = 0; i < 5; i++) {
      const avail = pool.filter(canDrop);
      if (avail.length === 0) break;
      const pick = avail[Math.floor(Math.random() * avail.length)];
      pulled.push(pick);
      this.state.owned[pick.id] = (this.state.owned[pick.id] || 0) + 1;
    }
    this.saveState();
    this.renderShop();

    const setTitle = getSetDisplayName(setCode);
    document.getElementById("pack-modal-title").textContent = this.lang === "th"
      ? `✨ เปิดแพ็ค ${setTitle} สำเร็จ! ✨`
      : `✨ ${setTitle.toUpperCase()} OPENED! ✨`;
    document.getElementById("btn-reopen-pack").textContent = this.lang === "th"
      ? `🔄 เปิดแพ็ค ${setCode} อีกครั้ง (${price} BP)`
      : `🔄 Open Another ${setCode} (${price} BP)`;

    const row = document.getElementById("pack-cards-reveal");
    row.innerHTML = "";
    pulled.forEach((c, idx) => {
      const item = document.createElement("div");
      item.className = "reveal-card-item";
      item.style.animationDelay = `${idx * 0.08}s`;
      item.onclick = () => this.openCardModal(c.id);
      item.innerHTML = `
        <img src="${c.img}" alt="${escapeHtml(c.name)}" />
        <div class="reveal-card-name">${escapeHtml(c.name)}</div>
        <div class="tile-sub">${c.type} ${c.size !== null ? "• Size " + c.size : ""} (Owned: x${this.state.owned[c.id]})</div>
      `;
      row.appendChild(item);
    });

    document.getElementById("pack-opening-modal").classList.remove("hidden");
  },

  reopenLastPack() {
    this.buyPack(this.lastPackWorld);
  },

  closePackModal() {
    document.getElementById("pack-opening-modal").classList.add("hidden");
  },

  getFilteredCollection() {
    const q = (document.getElementById("col-search").value || "").trim().toLowerCase();
    const qNorm = normalizeSearchToken(q);
    const setFilter = document.getElementById("col-set")?.value || "";
    const world = document.getElementById("col-world").value;
    const tribe = (document.getElementById("col-tribe")?.value || "");
    const type = document.getElementById("col-type").value;
    const size = document.getElementById("col-size").value;
    const skillKey = document.getElementById("col-skill").value;
    const ownedFilter = document.getElementById("col-owned").value;

    return ALL_CARDS.filter(c => {
      if (setFilter && !(c.sets || []).includes(setFilter)) return false;
      if (world && !c.worlds.includes(world)) return false;
      if (tribe && !cardHasTribe(c, tribe)) return false;
      if (type && c.type !== type) return false;
      if (size !== "" && String(c.size) !== size && !(size === "1000" && c.size === 10000)) return false;
      if (skillKey) {
        if (skillKey === "ll" && !c.ll && !c.ll_lose) return false;
        else if (skillKey !== "ll" && !c[skillKey]) return false;
      }
      const qty = this.state.owned[c.id] || 0;
      if (ownedFilter === "owned" && qty <= 0) return false;
      if (ownedFilter === "missing" && qty > 0) return false;

      if (!cardMatchesTextQuery(c, q, qNorm)) return false;
      return true;
    });
  },

  renderCollection(page = 1) {
    const filtered = this.getFilteredCollection();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.colPageSize));
    this.colPage = Math.min(Math.max(1, page), totalPages);

    document.getElementById("col-results-count").textContent = `Showing ${filtered.length.toLocaleString()} matching cards`;
    document.getElementById("col-page-indicator").textContent = `Page ${this.colPage} of ${totalPages}`;

    const slice = filtered.slice((this.colPage - 1) * this.colPageSize, this.colPage * this.colPageSize);
    const grid = document.getElementById("collection-grid");
    const frag = document.createDocumentFragment();

    slice.forEach(c => {
      const qty = this.state.owned[c.id] || 0;
      const tile = document.createElement("div");
      tile.className = `card-tile ${qty === 0 ? "unowned" : ""}`;
      tile.onclick = () => this.openCardModal(c.id);
      const tribeTag = c.attrs && c.attrs.length ? `«${formatTribeDisplayName(c.attrs[0])}»` : c.type;
      const statStr = c.type === "Monster"
        ? `Sz ${c.size} • ${c.power}/${c.crit}/${c.defense}`
        : c.type === "Item"
        ? `Item • ${c.power || 0}/${c.crit || 0}`
        : `${c.type} • ${tribeTag}`;
      tile.innerHTML = `
        <div class="tile-owned-badge">x${qty}</div>
        <img src="${c.img}" alt="${escapeHtml(c.name)}" loading="lazy" />
        <div class="tile-name">#${c.id} ${escapeHtml(c.name)}</div>
        <div class="tile-sub">${statStr}</div>
      `;
      frag.appendChild(tile);
    });
    grid.replaceChildren(frag);
  },

  changeCollectionPage(delta) {
    this.renderCollection(this.colPage + delta);
  },

  renderDeckScreen() {
    const overviewEl = document.getElementById("deck-overview-view");
    const editorEl = document.getElementById("deck-editor-view");

    if (!this.isEditingDeck) {
      overviewEl.classList.remove("hidden");
      editorEl.classList.add("hidden");
      this.renderDeckOverviewGallery();
    } else {
      overviewEl.classList.add("hidden");
      editorEl.classList.remove("hidden");
      this.renderCurrentDeckPane();
      this.renderDeckCatalog(this.dkPage);
    }
  },

  renderDeckOverviewGallery() {
    const list = document.getElementById("deck-banners-list");
    list.innerHTML = "";

    this.state.decks.forEach((dk, idx) => {
      const flag = CARD_MAP.get(dk.flagId) || ALL_CARDS[0];
      const buddy = CARD_MAP.get(dk.buddyId) || ALL_CARDS[45];
      const cfg = getFlagConfig(flag);
      const isEquipped = idx === this.state.activeDeckIndex;
      const missingCnt = this.getDeckMissingCardCount(dk);
      const hasLost = (dk.cards || []).some(cid => [4569, 5760].includes(cid));

      const card = document.createElement("div");
      card.className = `deck-banner-card ${isEquipped ? "active-equipped" : ""}`;
      const buddyThumbHtml = isYamigedoHalfId(buddy.id)
        ? renderYamigedoDualStackHtml()
        : `<img src="${buddy.img}" alt="${escapeHtml(buddy.name)}" title="Buddy: ${escapeHtml(buddy.name)}" />`;
      // Godclock: the whole connected 2x2 flag instead of one of its four cards
      const flagThumbHtml = cfg.key === "godclock"
        ? `<div class="deck-gc-grid" title="Flag: ${escapeHtml(flag.name)} (2x2 connected)">${GODCLOCK_FRONT_IDS.map(id => {
            const c = CARD_MAP.get(id);
            return `<img src="${c ? c.img : flag.img}" alt="${escapeHtml(c ? c.name : flag.name)}" />`;
          }).join("")}</div>`
        : `<img src="${flag.img}" alt="${escapeHtml(flag.name)}" title="Flag: ${escapeHtml(flag.name)}" />`;
      card.innerHTML = `
        <div class="deck-banner-art-pair">
          ${flagThumbHtml}
          ${buddyThumbHtml}
        </div>
        <div class="deck-banner-info">
          <div class="deck-banner-title">${escapeHtml(dk.name)} ${isEquipped ? "⭐(Equipped)" : ""}</div>
          <div class="deck-banner-sub">
            🏳️ <strong>Flag:</strong> ${escapeHtml(flag.name)}<br/>
            🌟 <strong>Buddy:</strong> ${escapeHtml(getBuddyDisplayName(buddy))}<br/>
            🃏 <strong>Cards:</strong> ${dk.cards.length} Main (Min 50)${hasLost ? ` + ${(dk.lostDeck || []).length} Lost Deck` : ""} • ${escapeHtml(cfg.ruleSummary)}
          </div>
          ${missingCnt > 0 ? `<div class="deck-banner-missing-warn">⚠️ Need ${missingCnt} unowned card(s) to complete</div>` : ""}
          <div class="deck-banner-btns">
            <button class="primary-cta-btn" style="padding:7px 14px; font-size:12px;" onclick="app.openDeckEditor(${idx})">🛠️ Edit / Build Deck</button>
            <button class="action-btn" style="padding:7px 12px; font-size:12px;" onclick="app.selectActiveDeck(${idx}); app.renderDeckOverviewGallery();">
              ${isEquipped ? "✅ Equipped" : "⚔️ Equip Deck"}
            </button>
            <button class="action-btn" style="padding:7px 10px; font-size:12px;" onclick="app.copyDeckCodeByIndex(${idx})">📋 Copy Code</button>
            ${this.state.decks.length > 1 ? `<button class="action-btn danger" style="padding:7px 10px; font-size:12px;" onclick="app.deleteDeckSlot(${idx})">🗑️</button>` : ""}
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  },

  createNewDeckAndEdit() {
    const newDeck = {
      name: `Custom Deck #${this.state.decks.length + 1}`,
      world: "Dragon World",
      flagId: 447,
      buddyId: 571,
      cards: [],
      lostDeck: []
    };
    this.state.decks.push(newDeck);
    this.state.activeDeckIndex = this.state.decks.length - 1;
    this.deckEditTab = "main";
    this.isEditingDeck = true;
    this.saveState();
    this.renderDeckScreen();
  },

  openDeckEditor(idx) {
    this.state.activeDeckIndex = idx;
    this.deckEditTab = "main";
    this.isEditingDeck = true;
    const dkWorld = document.getElementById("dk-world");
    if (dkWorld && dkWorld.value === "NEEDED") dkWorld.value = "";
    this.saveState();
    this.renderDeckScreen();
  },

  backToDeckOverview() {
    this.isEditingDeck = false;
    this.renderDeckScreen();
  },

  deleteDeckSlot(idx) {
    if (this.state.decks.length <= 1) return;
    if (!confirm(`Delete "${this.state.decks[idx].name}"?`)) return;
    this.state.decks.splice(idx, 1);
    if (idx < this.state.activeDeckIndex) this.state.activeDeckIndex -= 1;
    this.state.activeDeckIndex = Math.max(0, Math.min(this.state.activeDeckIndex, this.state.decks.length - 1));
    this.saveState();
    this.renderDeckOverviewGallery();
  },

  renameCurrentDeck(newName) {
    const deck = this.state.decks[this.state.activeDeckIndex];
    if (!deck) return;
    deck.name = newName.trim() || "Custom Deck";
    this.saveState();
  },

  copyDeckCodeByIndex(idx) {
    const deck = this.state.decks[idx];
    if (!deck) return;
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(deck))));
    // Clipboard can be blocked (e.g. no permission / non-HTTPS); the prompt below still shows the code.
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(code);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
    prompt("📋 Copy your shareable Deck Code below:", code);
  },

  exportCurrentDeckCode() {
    this.copyDeckCodeByIndex(this.state.activeDeckIndex);
  },

  openImportDeckCodeModal() {
    const raw = prompt("📥 Paste a Deck Code below to import it into your Decks (any cards you don't own yet will be shown as transparent with how many copies you still need):");
    if (!raw || !raw.trim()) return;
    try {
      const imported = sanitizeImportedDeck(JSON.parse(decodeURIComponent(escape(atob(raw.trim())))));
      if (!imported) throw new Error("Invalid format");
      imported.name = `${imported.name} (Imported)`;
      this.state.decks.push(imported);
      this.state.activeDeckIndex = this.state.decks.length - 1;
      this.saveState();
      this.openDeckEditor(this.state.activeDeckIndex);
      // Unowned cards in the imported deck: jump straight to the "Cards Needed" list in the card search.
      if (this.getDeckMissingCardCount(imported) > 0) this.showNeededCardsInSearch();
    } catch (e) {
      alert("Invalid Deck Code! Please make sure you copied the complete code.");
    }
  },

  // Card search (deck edit page) -> only the cards this deck still needs to own.
  showNeededCardsInSearch() {
    const sel = document.getElementById("dk-world");
    if (!sel) return;
    sel.value = "NEEDED";
    const search = document.getElementById("dk-search");
    if (search) search.value = "";
    this.renderDeckCatalog(1);
  },

  // Blocks play while the deck uses cards the player doesn't own. Returns true when blocked.
  blockIfDeckMissingCards(deck) {
    const missing = this.getDeckMissingCardCount(deck);
    if (missing <= 0) return false;
    alert(`You can't play with this deck yet: you are missing ${missing} card cop${missing === 1 ? "y" : "ies"}. Open the deck editor and check "Cards Needed" in the card search to see what to get (Open Packs or Unlock Sandbox).`);
    const idx = this.state.decks.indexOf(deck);
    if (idx >= 0) {
      this.showScreen("deck");
      this.openDeckEditor(idx);
      this.showNeededCardsInSearch();
    }
    return true;
  },

  toggleInfinityChaos(on) {
    const deck = this.state.decks[this.state.activeDeckIndex];
    if (!deck) return;
    deck.infinityChaos = deck.flagId === 3337 && !!on;
    this.saveState();
  },

  switchDeckEditTab(tab) {
    this.deckEditTab = tab;
    this.renderCurrentDeckPane();
    this.renderDeckCatalog(1);
  },

  previewDeckFlag() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    this.openCardModal(deck.flagId);
  },

  deckBuddyPreviewIdx: 0,

  previewDeckBuddy() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    const ids = getDefaultBuddyZoneIds(deck.buddyId, deck.buddyIds);
    const focusIdx = ((this.deckBuddyPreviewIdx || 0) % ids.length + ids.length) % ids.length;
    this.openCardModal(ids[focusIdx] || deck.buddyId, true);
    this.setModalNav(ids.length > 1);
  },

  // Big ◀ ▶ arrows on both sides of the card banner (Deck Edit / Hub buddy stack): flip through the buddies.
  setModalNav(on) {
    [["mdl-nav-prev", -1], ["mdl-nav-next", 1]].forEach(([id, dir]) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.classList.toggle("hidden", !on);
      b.onclick = on ? (e => { e.stopPropagation(); this.stepDeckBuddyModal(dir); }) : null;
    });
  },

  stepDeckBuddyModal(dir) {
    const deck = this.state.decks[this.state.activeDeckIndex];
    if (!deck) return;
    const ids = getDefaultBuddyZoneIds(deck.buddyId, deck.buddyIds);
    if (ids.length <= 1) return;
    this.deckBuddyPreviewIdx = ((this.deckBuddyPreviewIdx || 0) + dir + ids.length) % ids.length;
    this.renderCurrentDeckPane();
    this.renderHub();
    this.previewDeckBuddy();
  },

  renderCurrentDeckPane() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    if (!deck) return;
    if (!deck.lostDeck) deck.lostDeck = [];

    const nameInput = document.getElementById("dk-name-input");
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = deck.name;
    }

    const flag = CARD_MAP.get(deck.flagId) || ALL_CARDS[0];
    const buddy = CARD_MAP.get(deck.buddyId) || ALL_CARDS[45];
    const cfg = getFlagConfig(flag);

    // Godclock is one flag made of 4 connected cards: show all four, full size, like on the field
    const dkFlagVis = document.getElementById("dk-flag-visual");
    if (dkFlagVis) {
      dkFlagVis.innerHTML = cfg.key === "godclock"
        ? `<div class="dk-gc-grid" title="Godclock — 2x2 connected flag">${GODCLOCK_FRONT_IDS.map(id => {
            const c = CARD_MAP.get(id);
            return `<img src="${c ? c.img : flag.img}" alt="${escapeHtml(c ? c.name : flag.name)}" />`;
          }).join("")}</div>`
        : `<img id="dk-flag-img" src="${flag.img}" alt="Flag" />`;
    }
    document.getElementById("dk-flag-name").textContent = flag.name;
    document.getElementById("dk-flag-rule-tag").textContent = cfg.ruleSummary;
    const dkBuddyIds = getDefaultBuddyZoneIds(buddy.id, deck.buddyIds);
    const dkBuddyCards = dkBuddyIds.map(id => CARD_MAP.get(id)).filter(Boolean);
    const nBuddies = Math.min(4, dkBuddyCards.length);
    const focusIdx = nBuddies > 0 ? (((this.deckBuddyPreviewIdx || 0) % nBuddies + nBuddies) % nBuddies) : 0;
    const focusedBuddy = dkBuddyCards[focusIdx] || buddy;
    const dkBuddyVis = document.getElementById("dk-buddy-visual");
    if (dkBuddyVis) {
      if (nBuddies > 1) {
        const ordered = [];
        for (let i = 1; i < nBuddies; i++) {
          const idx = (focusIdx + i) % nBuddies;
          ordered.push({ card: dkBuddyCards[idx], origIdx: idx, isFront: false });
        }
        ordered.push({ card: dkBuddyCards[focusIdx], origIdx: focusIdx, isFront: true });
        const stepPct = nBuddies === 2 ? 42 : nBuddies === 3 ? 30 : 22;
        const startLeft = -Math.floor((stepPct * (nBuddies - 1)) / 2);
        dkBuddyVis.innerHTML = `<div class="slot-fan-stack buddy-fan-stack buddy-count-${nBuddies}" data-count="${nBuddies}">${ordered.map((it, slotPos) => `
          <div class="fan-card-slot ${it.isFront ? "active-front-buddy" : ""}" style="--fan-offset:${startLeft + slotPos * stepPct}%; z-index:${slotPos + 2};" title="Buddy #${it.origIdx + 1}: ${escapeHtml(it.card.name)}">
            <img src="${it.card.img}" alt="${escapeHtml(it.card.name)}" />
          </div>`).join("")}
        </div>`;
      } else {
        dkBuddyVis.innerHTML = isYamigedoHalfId(buddy.id)
          ? renderYamigedoDualStackHtml()
          : `<img id="dk-buddy-img" src="${buddy.img}" alt="Buddy" />`;
      }
    }
    document.getElementById("dk-buddy-name").textContent = nBuddies > 1
      ? `[${focusIdx + 1}/${nBuddies}] ${focusedBuddy.name}`
      : getBuddyDisplayName(buddy);

    const hasLostWorldFlag = deck.cards.some(cid => [4569, 5760].includes(cid));
    const lostTabBtn = document.getElementById("tab-lost-deck");
    lostTabBtn.classList.toggle("hidden", !hasLostWorldFlag);
    const infRow = document.getElementById("dk-infinity-row"), infChk = document.getElementById("dk-infinity-check");
    if (infRow && infChk) { infRow.classList.toggle("hidden", deck.flagId !== 3337); infChk.checked = deck.flagId === 3337 && !!deck.infinityChaos; }
    if (!hasLostWorldFlag && this.deckEditTab === "lost") {
      this.deckEditTab = "main";
    }

    document.getElementById("tab-main-deck").classList.toggle("active", this.deckEditTab === "main");
    lostTabBtn.classList.toggle("active", this.deckEditTab === "lost");

    document.getElementById("dk-total-count").textContent = deck.cards.length;
    document.getElementById("dk-lost-count").textContent = deck.lostDeck.length;

    const activeList = this.deckEditTab === "lost" ? deck.lostDeck : deck.cards;
    document.getElementById("dk-editing-label").textContent = this.deckEditTab === "lost"
      ? `🌌 Lost World Sub-Deck (${activeList.length} / 30)`
      : `🃏 Main Deck (${activeList.length} Cards — Min 50)`;

    let mCnt = 0, iCnt = 0, sCnt = 0, impCnt = 0;
    const grouped = new Map();
    activeList.forEach(cid => {
      const c = CARD_MAP.get(cid);
      if (!c) return;
      if (c.type === "Monster") mCnt++;
      else if (c.type === "Item") iCnt++;
      else if (c.type === "Spell") sCnt++;
      else impCnt++;
      grouped.set(cid, (grouped.get(cid) || 0) + 1);
    });

    document.getElementById("dk-type-breakdown").textContent = `M:${mCnt} I:${iCnt} S:${sCnt} Imp/Flg:${impCnt}`;

    const listEl = document.getElementById("dk-card-list");
    const frag = document.createDocumentFragment();
    Array.from(grouped.entries()).forEach(([cid, qty]) => {
      const c = CARD_MAP.get(cid);
      if (!c) return;
      const legality = checkCardLegalityForFlag(c, flag, this.deckEditTab === "lost", deck.buddyId);
      const maxC = legality.maxCopies || 4;
      const ownedQty = this.state.owned[cid] || 0;
      const missingQty = Math.max(0, qty - ownedQty);

      const row = document.createElement("div");
      row.className = `deck-row-item ${missingQty > 0 ? "missing-copies" : ""}`;
      row.innerHTML = `
        <img src="${c.img}" alt="${escapeHtml(c.name)}" onclick="app.openCardModal(${c.id})" style="cursor:pointer" />
        <div class="deck-row-info" onclick="app.openCardModal(${c.id})" style="cursor:pointer">
          <div class="deck-row-title">
            ${escapeHtml(c.name)}
            ${legality.isOffWorldOmni ? "👑(Omni 1x)" : ""}
            ${missingQty > 0 ? `<span class="need-tag">(Need x${missingQty} — Own ${ownedQty}/${qty})</span>` : ""}
          </div>
          <div class="deck-row-meta">${c.type} ${c.size !== null ? "Sz " + c.size : ""} ${(c.attrs && c.attrs.length) ? "• «" + formatTribeDisplayName(c.attrs[0]) + "»" : ""}</div>
        </div>
        <div class="deck-row-qty">
          <button class="qty-btn" onclick="app.removeCardFromDeck(${c.id})">-</button>
          <strong>${qty}/${maxC}</strong>
          <button class="qty-btn" onclick="app.addCardToDeck(${c.id})">+</button>
        </div>
      `;
      frag.appendChild(row);
    });
    listEl.replaceChildren(frag);
  },

  renderDeckCatalog(page = 1) {
    const deck = this.state.decks[this.state.activeDeckIndex];
    if (!deck) return;
    const flagCard = CARD_MAP.get(deck.flagId) || ALL_CARDS[0];
    const q = (document.getElementById("dk-search").value || "").trim().toLowerCase();
    const qNorm = normalizeSearchToken(q);
    const worldFilter = document.getElementById("dk-world").value;
    const tribeFilter = (document.getElementById("dk-tribe")?.value || "");
    const typeFilter = document.getElementById("dk-type").value;
    const skillFilter = document.getElementById("dk-skill").value;
    const isLostTab = this.deckEditTab === "lost";
    const neededCounts = new Map();
    if (worldFilter === "NEEDED") (deck.cards || []).forEach(cid => neededCounts.set(cid, (neededCounts.get(cid) || 0) + 1));

    const filtered = ALL_CARDS.filter(c => {
      if (isLostTab) {
        if (!checkCardLegalityForFlag(c, flagCard, true).allowed) return false;
      } else if (worldFilter === "NEEDED") {
        if ((neededCounts.get(c.id) || 0) <= (this.state.owned[c.id] || 0)) return false;
      } else if (worldFilter === "FLAGS_ONLY") {
        if (c.type !== "Flag") return false;
      } else if (worldFilter === "DRAGOD_ONLY") {
        if (!c.dragod) return false;
      } else if (worldFilter === "OMNI_LORDS") {
        if (!c.omni) return false;
      } else if (worldFilter === "") {
        const leg = checkCardLegalityForFlag(c, flagCard, false);
        if (!leg.allowed && c.type !== "Flag") return false;
      } else if (worldFilter !== "ALL") {
        if (!c.worlds.includes(worldFilter)) return false;
      }

      if (tribeFilter && !cardHasTribe(c, tribeFilter)) return false;

      if (typeFilter && c.type !== typeFilter) return false;
      if (skillFilter) {
        if (skillFilter === "ll" && !c.ll && !c.ll_lose) return false;
        else if (skillFilter !== "ll" && !c[skillFilter]) return false;
      }
      if (!cardMatchesTextQuery(c, q, qNorm)) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.dkPageSize));
    this.dkPage = Math.min(Math.max(1, page), totalPages);
    document.getElementById("dk-page-indicator").textContent = `${this.dkPage} / ${totalPages}`;

    const slice = filtered.slice((this.dkPage - 1) * this.dkPageSize, this.dkPage * this.dkPageSize);
    const grid = document.getElementById("deck-catalog-grid");
    const frag = document.createDocumentFragment();

    const activeList = isLostTab ? (deck.lostDeck || []) : deck.cards;
    const deckCounts = new Map();
    for (let i = 0; i < activeList.length; i++) {
      const cid = activeList[i];
      deckCounts.set(cid, (deckCounts.get(cid) || 0) + 1);
    }

    slice.forEach(c => {
      const inDeckQty = deckCounts.get(c.id) || 0;
      const ownedQty = this.state.owned[c.id] || 0;
      const leg = checkCardLegalityForFlag(c, flagCard, isLostTab, deck.buddyId);
      const maxC = leg.maxCopies || 4;
      const needMore = inDeckQty > ownedQty;

      const tile = document.createElement("div");
      tile.className = `card-tile ${ownedQty === 0 ? "unowned" : ""}`;
      tile.onclick = () => {
        if (c.type === "Flag") {
          const cn = (c.name || "").toLowerCase();
          if (cn.includes("lost world") || cn.includes("dragon drei") || cn.includes("overgod")) {
            this.addCardToDeck(c.id);
          } else {
            this.setDeckFlag(c.id);
          }
        } else {
          this.addCardToDeck(c.id);
        }
      };
      tile.oncontextmenu = (e) => {
        e.preventDefault();
        this.openCardModal(c.id);
      };
      let badgeLabel = `${inDeckQty}/${maxC}`;
      if (c.type === "Flag") {
        const cn = (c.name || "").toLowerCase();
        badgeLabel = cn.includes("lost world")
          ? `LOST (${inDeckQty}/2)`
          : cn.includes("dragon drei")
          ? `DREI (${inDeckQty}/4)`
          : cn.includes("overgod")
          ? `OVERGOD (${inDeckQty}/4)`
          : "SET FLAG";
      } else if (leg.isDragod) {
        badgeLabel = `🐉 DRAGOD (${inDeckQty}/4)`;
      } else if (leg.isAllFlags) {
        badgeLabel = `🌐 ALL FLAGS (${inDeckQty}/4)`;
      } else if (leg.isOffWorldOmni) {
        badgeLabel = `👑 OMNI (${inDeckQty}/1)`;
      }
      tile.innerHTML = `
        <div class="tile-owned-badge">${badgeLabel}</div>
        ${ownedQty === 0 ? `<div class="tile-missing-badge">Unowned (0)</div>` : needMore ? `<div class="tile-missing-badge">Need x${inDeckQty - ownedQty}</div>` : ""}
        <img src="${c.img}" alt="${escapeHtml(c.name)}" loading="lazy" />
        <div class="tile-name">${escapeHtml(c.name)}</div>
        <div class="tile-sub">${c.type} ${c.size !== null ? "• Sz " + c.size : ""} (Own: ${ownedQty})</div>
      `;
      // Phones have no right-click, so give every tile a visible "card details" button.
      const infoBtn = document.createElement("button");
      infoBtn.className = "tile-info-btn";
      infoBtn.type = "button";
      infoBtn.title = "Card details";
      infoBtn.textContent = "i";
      infoBtn.onclick = (e) => {
        e.stopPropagation();
        this.openCardModal(c.id);
      };
      tile.appendChild(infoBtn);
      frag.appendChild(tile);
    });
    grid.replaceChildren(frag);
  },

  changeDeckCatalogPage(delta) {
    this.renderDeckCatalog(this.dkPage + delta);
  },

  setDeckFlag(flagId) {
    const flagCard = CARD_MAP.get(flagId);
    if (!flagCard) return;
    const cfg = getFlagConfig(flagCard);
    if (cfg.cannotStartAsFlag) {
      alert(`"${flagCard.name}" cannot be chosen as your starting Flag at the start of the fight! Add it inside your Main Deck instead (like Overgod "0" in a Godclock deck, Dragon Drei in a Dragon Zwei deck, or Lost World).`);
      this.addCardToDeck(flagId);
      return;
    }
    const deck = this.state.decks[this.state.activeDeckIndex];
    deck.flagId = flagCard.id;
    deck.world = cfg.world;

    const dkWorldEl = document.getElementById("dk-world");
    const dkTypeEl = document.getElementById("dk-type");
    const dkTribeEl = document.getElementById("dk-tribe");
    if (dkWorldEl) dkWorldEl.value = "";
    if (dkTypeEl) dkTypeEl.value = "";
    if (dkTribeEl) dkTribeEl.value = "";

    deck.cards = deck.cards.filter(cid => {
      const c = CARD_MAP.get(cid);
      return c && checkCardLegalityForFlag(c, flagCard, false).allowed;
    });

    const currentBuddy = CARD_MAP.get(deck.buddyId);
    if (!currentBuddy || !checkCardLegalityForFlag(currentBuddy, flagCard, false).allowed || currentBuddy.type === "Flag") {
      const replacementBuddy = cfg.key === "godclock"
        ? (CARD_MAP.get(6065) || CARD_MAP.get(5955))
        : ALL_CARDS.find(c => c.type === "Monster" && checkCardLegalityForFlag(c, flagCard, false).allowed);
      if (replacementBuddy) deck.buddyId = replacementBuddy.id;
    }

    this.saveState();
    this.renderCurrentDeckPane();
    this.renderDeckCatalog(1);
    this.renderHub();
  },

  addCardToDeck(cardId) {
    const c = CARD_MAP.get(cardId);
    if (!c) return;
    const deck = this.state.decks[this.state.activeDeckIndex];
    if (!deck.lostDeck) deck.lostDeck = [];
    const flagCard = CARD_MAP.get(deck.flagId) || ALL_CARDS[0];
    const isLostTab = this.deckEditTab === "lost";

    const leg = checkCardLegalityForFlag(c, flagCard, isLostTab);
    if (!leg.allowed) {
      if (c.type === "Flag" && !getFlagConfig(c).cannotStartAsFlag) {
        this.setDeckFlag(cardId);
        return;
      }
      if (c.id === 6202) {
        alert(`"Overgod, "0"" can only be included inside a Godclock deck! Set your deck Flag to Godclock (#5957) first.`);
        return;
      }
      alert(`"${c.name}" (${c.world}) cannot be used with the Flag "${flagCard.name}" unless it has [Omni Lord] / [Dragod] or matches the Flag's World/Tribe requirements!`);
      return;
    }

    const targetList = isLostTab ? deck.lostDeck : deck.cards;
    if (isLostTab && targetList.length >= 30) {
      alert("Your Lost World Sub-Deck is full (30 cards maximum)!");
      return;
    }

    const copies = targetList.filter(id => id === cardId).length;
    if (copies >= leg.maxCopies) {
      if (leg.isOffWorldOmni) {
        alert(`[Omni Lord] Rule: Because "${c.name}" is from outside your Flag's World, you may only include 1 copy in your deck!`);
      } else {
        alert(`You can include at most ${leg.maxCopies} copies of "${c.name}" in your deck.`);
      }
      return;
    }

    targetList.push(cardId);

    if ([4569, 5760].includes(cardId) && deck.lostDeck.length === 0) {
      deck.lostDeck = generateLostDeck();
      alert("🌌 Lost World Flag added to your Main Deck! A 30-card Lost World Sub-Deck tab has been unlocked and pre-filled for you.");
    }

    this.saveState();
    this.renderCurrentDeckPane();
    this.renderDeckCatalog(this.dkPage);
  },

  removeCardFromDeck(cardId) {
    const deck = this.state.decks[this.state.activeDeckIndex];
    const targetList = this.deckEditTab === "lost" ? deck.lostDeck : deck.cards;
    const idx = targetList.indexOf(cardId);
    if (idx !== -1) {
      targetList.splice(idx, 1);
      this.saveState();
      this.renderCurrentDeckPane();
      this.renderDeckCatalog(this.dkPage);
    }
  },

  autoBuildDeck() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    // The "⚡ Auto" button fills empty slots; it only rebuilds from scratch when the deck already has at least 50 cards.
    if (deck.cards.length < DECK_SIZE) {
      this.completeCurrentDeck();
      this.renderCurrentDeckPane();
      this.renderDeckCatalog(1);
      return;
    }
    if (!confirm(`Your deck already has ${deck.cards.length} cards (50+ required). Rebuild a 50-card deck automatically from scratch? (This replaces your current cards.)`)) return;
    const hasLost = deck.cards.some(cid => [4569, 5760].includes(cid));
    const built = generateSmartDeck(deck.flagId, deck.name, deck.buddyId, hasLost);
    this.state.decks[this.state.activeDeckIndex] = built;
    this.saveState();
    this.renderCurrentDeckPane();
    this.renderDeckCatalog(1);
  },

  // Fill the current deck up to 50 cards, keeping every card the player already chose.
  completeCurrentDeck() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    const flagCard = CARD_MAP.get(deck.flagId) || ALL_CARDS[0];
    const hasLost = deck.cards.some(cid => [4569, 5760].includes(cid));
    const suggestion = generateSmartDeck(deck.flagId, deck.name, deck.buddyId, hasLost);
    const extra = generateSmartDeck(deck.flagId, deck.name, suggestion.buddyId, false);
    // If the current buddy isn't legal for this flag, use the buddy the builder picked.
    const curBuddy = CARD_MAP.get(deck.buddyId);
    if (!curBuddy || curBuddy.type === "Flag" || !checkCardLegalityForFlag(curBuddy, flagCard, false).allowed) {
      deck.buddyId = suggestion.buddyId;
    }
    const fallback = ALL_CARDS.filter(c => c.type !== "Flag" && checkCardLegalityForFlag(c, flagCard, false).allowed).map(c => c.id);
    for (let i = fallback.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fallback[i], fallback[j]] = [fallback[j], fallback[i]];
    }
    const pool = [...suggestion.cards, ...extra.cards, ...fallback];
    const counts = {};
    deck.cards.forEach(cid => counts[cid] = (counts[cid] || 0) + 1);
    for (const cid of pool) {
      if (deck.cards.length >= DECK_SIZE) break;
      const c = CARD_MAP.get(cid);
      if (!c) continue;
      const leg = checkCardLegalityForFlag(c, flagCard, false);
      if (!leg.allowed || (counts[cid] || 0) >= (leg.maxCopies || 4)) continue;
      deck.cards.push(cid);
      counts[cid] = (counts[cid] || 0) + 1;
    }
    if (hasLost && (!deck.lostDeck || deck.lostDeck.length === 0)) deck.lostDeck = suggestion.lostDeck;
    this.saveState();
  },

  clearCurrentDeck() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    if (this.deckEditTab === "lost") deck.lostDeck = [];
    else deck.cards = [];
    this.saveState();
    this.renderCurrentDeckPane();
    this.renderDeckCatalog(this.dkPage);
  },

  openCardModal(cardId, showCombinedYamigedo = false) {
    const c = CARD_MAP.get(cardId);
    if (!c) return;
    this.setModalNav(false);
    this.currentInspectCardId = cardId;

    const mdlArtWrap = document.getElementById("mdl-art-wrap");
    if (mdlArtWrap) {
      if (showCombinedYamigedo && isYamigedoHalfId(c.id)) {
        mdlArtWrap.innerHTML = renderYamigedoDualStackHtml();
      } else {
        mdlArtWrap.innerHTML = `<img id="mdl-card-img" src="${c.img}" alt="Card" />`;
      }
    }
    const ownedQty = this.state.owned[c.id] || 0;
    document.getElementById("mdl-card-id").textContent = `CardStat #${c.id} • Owned: x${ownedQty} • ${(c.sets || []).join(", ") || "Standard"}`;
    document.getElementById("mdl-card-name").textContent = c.name;
    document.getElementById("mdl-card-world").textContent = `${c.world} • ${c.type}`;

    let statsHtml = "";
    if (c.type === "Monster") {
      statsHtml = `Size: ${c.size} &nbsp;|&nbsp; Power: ${c.power} &nbsp;|&nbsp; Critical: ${c.crit} &nbsp;|&nbsp; Defense: ${c.defense} &nbsp;|&nbsp; Max Attacks: ${c.atk_max}`;
    } else if (c.type === "Item") {
      statsHtml = `Power: ${c.power || 0} &nbsp;|&nbsp; Critical: ${c.crit || 0} ${c.defense ? "&nbsp;|&nbsp; Defense: " + c.defense : ""}`;
    } else if (c.type === "Flag") {
      const cfg = getFlagConfig(c);
      statsHtml = `Flag Rules: ${escapeHtml(cfg.ruleSummary)}`;
      if (c.power !== null && c.power !== undefined) {
        statsHtml += ` &nbsp;|&nbsp; Power: ${c.power} &nbsp;|&nbsp; Critical: ${c.crit} &nbsp;|&nbsp; Defense: ${c.defense}`;
      }
    } else {
      statsHtml = `${c.type} Card ${c.cost ? "• " + c.cost : ""}`;
    }
    if (c.attrs && c.attrs.length) {
      statsHtml += ` &nbsp;•&nbsp; «${c.attrs.map(formatTribeDisplayName).join("» «")}»`;
    }
    document.getElementById("mdl-card-stats").innerHTML = statsHtml;

    const kwContainer = document.getElementById("mdl-card-kw");
    kwContainer.innerHTML = "";
    (c.kw || []).forEach(k => {
      const span = document.createElement("span");
      span.className = `kw-tag ${["Overturn", "Overkill", "Overkill:REBOOT", "Overthrow"].includes(k) ? "special" : ""}`;
      span.textContent = k === "Lifelink" && c.ll ? `Lifelink ${c.ll}` : k;
      kwContainer.appendChild(span);
    });

    document.getElementById("mdl-card-world").textContent = `${tWorld(c.world)} • ${tType(c.type)}`;
    document.getElementById("mdl-card-skill").textContent = translateCardSkillToThai(c.skill, c);
    document.getElementById("mdl-card-flavor").textContent = c.flavor ? `"${c.flavor}"` : "";

    const btnAddDeck = document.getElementById("mdl-add-deck-btn");
    const btnSetFlag = document.getElementById("mdl-set-flag-btn");
    const btnSetBuddy = document.getElementById("mdl-set-buddy-btn");

    const cfg = getFlagConfig(c);
    const isSubDeckFlag = c.type === "Flag" && Boolean(cfg.cannotStartAsFlag);

    btnSetFlag.classList.toggle("hidden", c.type !== "Flag" || isSubDeckFlag);
    btnSetBuddy.classList.toggle("hidden", c.type !== "Monster" && c.type !== "Item");
    btnAddDeck.classList.toggle("hidden", c.type === "Flag" && !isSubDeckFlag);

    document.getElementById("global-card-modal").classList.remove("hidden");
  },

  closeCardModal() {
    document.getElementById("global-card-modal").classList.add("hidden");
  },

  addModalCardToDeck() {
    if (this.currentInspectCardId) {
      this.addCardToDeck(this.currentInspectCardId);
      this.closeCardModal();
    }
  },

  setModalCardAsFlag() {
    if (!this.currentInspectCardId) return;
    this.setDeckFlag(this.currentInspectCardId);
    this.closeCardModal();
  },

  setModalCardAsBuddy() {
    const c = CARD_MAP.get(this.currentInspectCardId);
    if (!c) return;
    if (c.type !== "Monster" && c.type !== "Item") return;
    const deck = this.state.decks[this.state.activeDeckIndex];
    deck.buddyId = c.id;
    this.saveState();
    this.renderCurrentDeckPane();
    this.renderDeckCatalog(this.dkPage);
    this.renderHub();
    this.closeCardModal();
  },

  peer: null,
  peerConn: null,
  isOnlineHost: false,

  // WebRTC connection settings. STUN alone only works when both players' networks allow
  // a direct connection; many mobile networks (carrier-grade NAT) need a TURN relay.
  // To enable one, sign up for a TURN service (e.g. Metered, Twilio, Cloudflare Calls)
  // and add its entry here, e.g. { urls: "turn:your.turn.host:443?transport=tcp", username: "...", credential: "..." }.
  async getIceServers() {
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      ...ONLINE_TURN_SERVERS,
      ...(await buildOpenRelayTurnServers())
    ];
  },

  // Keep the room alive when a phone switches apps (e.g. to send the code in LINE):
  // the browser drops the signalling connection, so reconnect when the tab is visible again.
  keepPeerAlive(peer) {
    peer.on("disconnected", () => {
      if (!peer.destroyed && document.visibilityState === "visible") {
        try { peer.reconnect(); } catch (e) {}
      }
    });
    if (!this._visibilityHooked) {
      this._visibilityHooked = true;
      document.addEventListener("visibilitychange", () => {
        const p = this.peer;
        if (document.visibilityState === "visible" && p && p.disconnected && !p.destroyed) {
          try { p.reconnect(); } catch (e) {}
        }
      });
    }
  },

  initMultiplayerChannel() {
    try {
      this.roomChannel = new BroadcastChannel("buddyfight_online_rooms_v8");
      this.roomChannel.onmessage = (ev) => {
        const data = ev.data || {};
        if (data.type === "JOIN_ROOM" && this.activeRoomCode && data.roomCode === this.activeRoomCode && !this.peerConn) {
          const myDeck = this.state.decks[this.state.activeDeckIndex];
          this.roomChannel.postMessage({
            type: "START_MATCH",
            roomCode: this.activeRoomCode,
            hostDeck: myDeck
          });
          this.closeRoomModal();
          this.startBattle("friend_code", data.guestDeck);
        } else if (data.type === "START_MATCH" && this.joiningRoomCode && data.roomCode === this.joiningRoomCode && !this.peerConn) {
          this.joiningRoomCode = null;
          this.closeRoomModal();
          this.startBattle("friend_code", data.hostDeck);
        }
      };
    } catch (e) {}
  },

  openRoomModal() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(deck))));
    document.getElementById("my-deck-code").value = code;
    document.getElementById("room-modal").classList.remove("hidden");
  },

  closeRoomModal() {
    document.getElementById("room-modal").classList.add("hidden");
  },

  async createMultiplayerRoom() {
    const deck = this.state.decks[this.state.activeDeckIndex];
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const roomCode = `BF-${randNum}`;
    this.activeRoomCode = roomCode;
    this.isOnlineHost = true;

    try {
      localStorage.setItem(`bf_room_${roomCode}`, JSON.stringify(deck));
    } catch (e) {}

    document.getElementById("generated-room-code").textContent = roomCode;
    const statusEl = document.getElementById("room-host-status");
    statusEl.textContent = `⏳ Registering Online WebRTC Room ${roomCode} (works on GitHub Pages across any device)...`;

    if (typeof window.Peer !== "undefined") {
      try {
        if (this.peer) this.peer.destroy();
        this.peerConn = null;
        const peerId = `buddyfight-online-room-${randNum}`;
        this.peer = new window.Peer(peerId, {
          debug: 1,
          config: { iceServers: await this.getIceServers() }
        });
        this.keepPeerAlive(this.peer);

        this.peer.on("open", () => {
          statusEl.textContent = `🟢 Online Room ${roomCode} is LIVE Worldwide! Give code "${roomCode}" to your friend so they can join from anywhere!`;
        });

        this.peer.on("connection", (conn) => {
          // Only one friend per room: turn away anyone else who enters this code while a friend is connected.
          if (this.peerConn && this.peerConn.open) {
            conn.on("open", () => { try { conn.close(); } catch (e) {} });
            return;
          }
          this.peerConn = conn;
          this.setupPeerConnectionHandlers(conn, true);
        });

        this.peer.on("error", (err) => {
          console.warn("PeerJS error:", err);
          if (err.type === "unavailable-id") {
            // Someone else is already using this room number: pick a new one.
            this.createMultiplayerRoom();
            return;
          }
          if (err.type === "network" || err.type === "server-error" || err.type === "socket-error" || err.type === "socket-closed") {
            statusEl.textContent = `🔴 Lost connection to the online room server (${err.type}). Keep this page open and check your internet; it will reconnect, or tap Create Room again.`;
            return;
          }
          statusEl.textContent = `🟡 Room ${roomCode}: ${err.type || "connection problem"}. Try tapping Create Room again.`;
        });
      } catch (e) {
        statusEl.textContent = `🟢 Room ${roomCode} is LIVE! Waiting for friend to enter ${roomCode}...`;
      }
    } else {
      statusEl.textContent = `🟢 Room ${roomCode} is LIVE! Waiting for friend to enter ${roomCode}...`;
    }
  },

  async joinMultiplayerRoom() {
    const raw = (document.getElementById("join-room-input").value || "").trim();
    if (!raw) {
      alert("Please enter a Room Code (e.g. BF-4829) or a Deck Code!");
      return;
    }

    let normRoom = raw.toUpperCase();
    if (/^\d{4}$/.test(normRoom)) {
      normRoom = `BF-${normRoom}`;
    }
    const myDeck = this.state.decks[this.state.activeDeckIndex];

    // 1. If it looks like a Room Code (BF-XXXX), connect via PeerJS WebRTC across the internet!
    if (normRoom.startsWith("BF-") && normRoom.length === 7 && typeof window.Peer !== "undefined") {
      const digits = normRoom.slice(3);
      const targetPeerId = `buddyfight-online-room-${digits}`;
      this.isOnlineHost = false;
      this.joiningRoomCode = normRoom;

      try {
        if (this.peer) this.peer.destroy();
        this.peerConn = null;
        this.peer = new window.Peer(undefined, {
          debug: 1,
          config: { iceServers: await this.getIceServers() }
        });
        this.keepPeerAlive(this.peer);
        // If the data channel never opens (usually two networks that can't connect directly), say so.
        clearTimeout(this._joinTimer);
        this._joinTimer = setTimeout(() => {
          if (this.joiningRoomCode === normRoom && (!this.peerConn || !this.peerConn.open)) {
            alert(`Found room ${normRoom}, but couldn't connect to your friend's device. This usually happens when one of you is on mobile data or a strict network. Try both joining the same Wi-Fi, or ask the game owner to add a TURN relay server.`);
          }
        }, 15000);

        this.peer.on("open", () => {
          const conn = this.peer.connect(targetPeerId, { reliable: true });
          this.peerConn = conn;
          this.setupPeerConnectionHandlers(conn, false);
        });

        this.peer.on("error", (err) => {
          console.warn("PeerJS join error:", err);
          // Already joined: this is a connection problem during the match, not a failed join.
          if (this.joiningRoomCode !== normRoom) {
            if (battle.mode === "online_p2p") battle.setPrompt(`⚠️ Connection problem (${err.type || "unknown"}). Trying to reconnect...`);
            return;
          }
          // Fallback to localStorage / BroadcastChannel if on same computer
          let savedRoomDeck = null;
          try {
            savedRoomDeck = JSON.parse(localStorage.getItem(`bf_room_${normRoom}`) || "null");
          } catch (e) {
            savedRoomDeck = null;
          }
          if (savedRoomDeck) {
            clearTimeout(this._joinTimer);
            this.closeRoomModal();
            this.startBattle("friend_code", savedRoomDeck);
          } else {
            clearTimeout(this._joinTimer);
            const reason = err.type === "peer-unavailable"
              ? "Room not found. Check the code, and make sure your friend tapped Create Room and still has the game open on screen."
              : `Connection problem (${err.type || "unknown"}). Check your internet and try again.`;
            alert(`Could not join Online Room ${normRoom}. ${reason}`);
          }
        });
        return;
      } catch (e) {}
    }

    // 2. Fallback: Same-browser localStorage / BroadcastChannel
    const savedRoomDeck = localStorage.getItem(`bf_room_${normRoom}`);
    if (savedRoomDeck) {
      try {
        const oppDeck = JSON.parse(savedRoomDeck);
        if (this.roomChannel) {
          this.roomChannel.postMessage({
            type: "JOIN_ROOM",
            roomCode: normRoom,
            guestDeck: myDeck
          });
        }
        this.closeRoomModal();
        this.startBattle("friend_code", oppDeck);
        return;
      } catch (e) {}
    }

    // 3. Fallback: Full Base64 Deck Code
    try {
      const oppDeck = sanitizeImportedDeck(JSON.parse(decodeURIComponent(escape(atob(raw)))));
      if (!oppDeck) throw new Error("Invalid Deck Code");
      this.closeRoomModal();
      this.startBattle("friend_code", oppDeck);
    } catch (e) {
      alert("Could not find an active room or valid Deck Code with that input.");
    }
  },

  setupPeerConnectionHandlers(conn, isHost) {
    conn.on("open", () => {
      clearTimeout(this._joinTimer);
      if (!isHost) this.joiningRoomCode = null;
      const myDeck = this.state.decks[this.state.activeDeckIndex];
      if (!isHost) {
        conn.send({
          type: "P2P_HELLO_JOIN",
          guestDeck: myDeck,
          guestName: "Friend (Online)"
        });
      }
    });

    conn.on("data", (msg) => {
      if (!msg || !msg.type) return;
      // Ignore anything from a connection that isn't the current friend (e.g. a turned-away second joiner).
      if (conn !== this.peerConn) return;
      if (msg.type === "P2P_HELLO_JOIN" && isHost) {
        // A friend rejoining mid-match gets the current board instead of restarting the match.
        if (battle.mode === "online_p2p" && !battle.matchOver && document.getElementById("screen-battle").classList.contains("active")) {
          battle.sendOnlineStateToPeer("🔄 Reconnected to the match!");
          return;
        }
        const myDeck = this.state.decks[this.state.activeDeckIndex];
        this.closeRoomModal();
        this.startBattle("online_p2p", msg.guestDeck);
        setTimeout(() => {
          battle.sendOnlineStateToPeer("🔥 Online Match Started! Host's Turn 1!");
        }, 250);
      } else if (msg.type === "P2P_STATE_SYNC") {
        if (!document.getElementById("screen-battle").classList.contains("active")) {
          // First sync of a new online match: reset anything left over from a previous match.
          battle.matchOver = false;
          battle.oppContinueCallback = null;
          battle.pendingAction = null;
          battle.pendingDefenseContext = null;
          this.closeRoomModal();
          this.showScreen("battle");
        }
        battle.receiveOnlineStateFromPeer(msg);
      } else if (msg.type === "P2P_CUTIN") {
        battle.receiveCutinFromPeer(msg);
      } else if (msg.type === "P2P_ATTACK_PROMPT") {
        battle.receiveOnlineAttackPromptFromPeer(msg);
      } else if (msg.type === "P2P_DEFENSE_RESPONSE") {
        battle.receiveOnlineDefenseResponseFromPeer(msg);
      } else if (msg.type === "P2P_CAST_PROMPT") {
        battle.receiveOnlineCastPromptFromPeer(msg);
      } else if (msg.type === "P2P_CAST_RESPONSE") {
        if (window.ABX && ABX.receiveCastResponse) ABX.receiveCastResponse(msg);
      }
    });

    conn.on("close", () => {
      if (conn !== this.peerConn) return;
      this.peerConn = null;
      if (document.getElementById("screen-battle").classList.contains("active") && battle.mode === "online_p2p") {
        battle.setPrompt("⚠️ Online Friend disconnected from the room.");
      }
    });
  },

  startBattle(mode, customOppDeck = null) {
    if (customOppDeck) {
      customOppDeck = sanitizeImportedDeck(customOppDeck);
      if (!customOppDeck) {
        alert("Your opponent's deck data is invalid, so the match can't start.");
        return;
      }
    }
    const deck = this.state.decks[this.state.activeDeckIndex] || this.state.decks[0];
    if (this.blockIfDeckMissingCards(deck)) return;
    if (deck.cards.length < DECK_SIZE) {
      if (confirm(`Buddyfight Rule: Your Main Deck has ${deck.cards.length} cards (it needs at least ${DECK_SIZE} cards). Fill the rest up to ${DECK_SIZE} automatically and start? Your chosen cards are kept.`)) {
        this.completeCurrentDeck();
        if (this.blockIfDeckMissingCards(deck)) return; // auto-fill may add cards the player doesn't own
      } else {
        return;
      }
    }

    const hasLostWorld = deck.cards.some(cid => [4569, 5760].includes(cid));
    if (hasLostWorld && (!deck.lostDeck || deck.lostDeck.length === 0)) {
      deck.lostDeck = generateLostDeck();
      this.saveState();
    }

    this.showScreen("battle");
    battle.start(mode, this.state.decks[this.state.activeDeckIndex], customOppDeck);
  }
};

/* ==================== ANIME BATTLE ARENA ENGINE (V5) ==================== */
const battle = {
  mode: "bot",
  turnCount: 1,
  activeSide: "plr",
  phase: "main",
  pendingAction: null,
  pendingDefenseContext: null,
  deckSearchState: null,
  linkAttackers: [],
  plr: null,
  opp: null,

  createFighterState(name, deckDef, isBot = false) {
    const flagCard = CARD_MAP.get(deckDef.flagId) || ALL_CARDS[0];
    const cfg = getFlagConfig(flagCard);

    const shuffled = [...deckDef.cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const hand = shuffled.splice(0, cfg.hand);
    const gauge = shuffled.splice(0, cfg.gauge);

    // Fixed V5 Godclock 2x2 Connected Pairing:
    // Top-Left: Clock-I (#5958 ➔ #5962)
    // Top-Right: Clock-II (#5959 ➔ #5963)
    // Bottom-Left: Godclock (#5957 ➔ #5961)
    // Bottom-Right: Clock-III (#5960 ➔ #5964)
    let godclockState = null;
    if (cfg.key === "godclock") {
      godclockState = {
        quadrants: [
          {
            pos: "Top-Left",
            frontId: 5958,
            backId: 5962,
            name: "Clock-I",
            reversed: false,
            desc: "[Counter] [Act] \"Horary Domination\" Put 1 hand card on bottom of deck & [Reversal]: Look at top 3 cards of deck, put 1 into hand, drop the rest."
          },
          {
            pos: "Top-Right",
            frontId: 5959,
            backId: 5963,
            name: "Clock-II",
            reversed: false,
            desc: "[Counter] [Act] \"Horary Domination\" Put 1 hand card on bottom of deck & [Reversal]: Draw 1 card, and if there are any cards in battle, end the battle!"
          },
          {
            pos: "Bottom-Left",
            frontId: 5957,
            backId: 5961,
            name: "Godclock",
            reversed: false,
            desc: "When Clock-I, Clock-II & Clock-III are in [Reversal], put a monster with \"Time Ruler\" in its name from field or hand into Drop Zone to [Reversal]!"
          },
          {
            pos: "Bottom-Right",
            frontId: 5960,
            backId: 5964,
            name: "Clock-III",
            reversed: false,
            desc: "[Counter] [Act] \"Horary Domination\" Choose a «Time Dragon» monster in Drop Zone, put 1 hand card on bottom of deck & [Reversal]: Call that monster by paying its [Call Cost]!"
          }
        ],
        horaryDominationUsedThisTurn: false,
        reversalCount: 0,
        awakened: false,
        overgodActive: false,
        eternalEonActive: false
      };
    }

    const subFlags = cfg.key === "godclock" ? [
      { id: 5958, backId: 5962, name: "Clock-I", reversed: false, card: CARD_MAP.get(5958) },
      { id: 5959, backId: 5963, name: "Clock-II", reversed: false, card: CARD_MAP.get(5959) },
      { id: 5960, backId: 5964, name: "Clock-III", reversed: false, card: CARD_MAP.get(5960) }
    ] : [];

    const hasLostWorldInDeck = (deckDef.cards || []).some(cid => [4569, 5760].includes(Number(cid)));
    const resolvedLostDeck = Array.isArray(deckDef.lostDeck) && deckDef.lostDeck.length > 0
      ? [...deckDef.lostDeck]
      : (hasLostWorldInDeck ? generateLostDeck() : []);

    const __fighter = {
      name,
      isBot,
      world: cfg.world,
      flagKey: cfg.key,
      flagId: deckDef.flagId,
      buddyId: deckDef.buddyId,
      buddyIds: getDefaultBuddyZoneIds(deckDef.buddyId, deckDef.buddyIds),
      buddyZone: getDefaultBuddyZoneIds(deckDef.buddyId, deckDef.buddyIds).map(id => ({ id: Number(id), rested: false, isFaceDown: false })),
      life: cfg.life,
      maxSize: cfg.maxSize,
      deck: shuffled,
      lostDeck: resolvedLostDeck,
      isLostWorldActive: false,
      subFlags,
      oppressedAreas: {},
      hand,
      gauge,
      drop: [],
      setSpells: [],
      item: null,
      item2: null,
      extraItems: [],
      godclock: godclockState,
      timeStoppedThisBattle: false,
      timeStoppedThisTurn: false,
      buddyCalled: false,
      chargedThisTurn: false,
      overturnUsed: false, overUsed: {},
      dreiUsed: false,
      monsters: {
        left: null,
        center: null,
        right: null
      }
    };
    // "Dragon Throne" (#941) in your set zone lets you hold monsters up to a total size of 4 (never lowers a bigger limit).
    let __baseMax = __fighter.maxSize;
    Object.defineProperty(__fighter, "maxSize", {
      enumerable: true, configurable: true,
      get() { return (__fighter.setSpells || []).some(c => c && c.id === 941) ? Math.max(__baseMax, 4) : __baseMax; },
      set(v) { __baseMax = v; }
    });
    return __fighter;
  },

  start(mode, plrDeck, customOppDeck = null) {
    // New match id: timers left over from a previous match (e.g. after leaving mid bot turn) check it and stop.
    this.matchGen = (this.matchGen || 0) + 1;
    this.matchOver = false;
    this.oppContinueCallback = null;
    this.mode = mode;
    this.turnCount = 1;
    this.turn1AttackUsed = false;
    this.activeSide = "plr";
    this.phase = "main";
    this.pendingAction = null;
    this.pendingDefenseContext = null;
    this.linkAttackers = [];

    let oppName = "AI Rival";
    let oppDeck = customOppDeck;

    if (!oppDeck) {
      const botKey = document.getElementById("bot-difficulty").value;
      if (mode === "hotseat") {
        oppName = "Player 2 (Friend)";
        oppDeck = generateFlagDeck(447, "Player 2 Deck", 571, true);
      } else if (botKey === "tasuku") {
        oppName = "🐉 Tasuku Ryuenji";
        oppDeck = generateFlagDeck(447, "Tasuku Deck", 571, true);
      } else if (botKey === "tetsuya") {
        oppName = "😈 Tetsuya Kurodake";
        oppDeck = generateFlagDeck(1, "Tetsuya Deck", 46, false);
      } else if (botKey === "kyoya_ein") {
        oppName = "🐲 Kyoya Gaen (Dragon Ein)";
        oppDeck = generateFlagDeck(969, "Dragon Ein Deck", 2372, false);
      } else if (botKey === "kyoya_zwei") {
        oppName = "🌑 Kyoya Gaen (Dragon Zwei)";
        oppDeck = generateFlagDeck(2370, "Dragon Zwei Deck", 2371, false);
      } else if (botKey === "wisdom") {
        oppName = "⚙️ Wisdom (The Chaos)";
        oppDeck = generateFlagDeck(3337, "The Chaos Deck", 3338, false);
      } else if (botKey === "time_god") {
        oppName = "⏳ Time Ruler (Godclock)";
        oppDeck = generateFlagDeck(5957, "Godclock Deck", 6065, false);
      } else if (botKey === "zanya") {
        oppName = "🥷 Zanya Kisaragi";
        oppDeck = generateFlagDeck(258, "Zanya Deck", 3617, false);
      } else {
        oppName = "🪞 Mirror Rival";
        oppDeck = JSON.parse(JSON.stringify(plrDeck));
      }
    } else {
      oppName = `Challenger (${oppDeck.name || oppDeck.world})`;
    }

    this.plr = this.createFighterState("You", plrDeck, false);
    this.opp = this.createFighterState(oppName, oppDeck, mode !== "hotseat" && mode !== "online_p2p");

    const flagCard = CARD_MAP.get(this.plr.flagId) || ALL_CARDS[0];
    this.showCutin("RAISE THE FLAG!", `${flagCard.name} — Luminize!`, flagCard.img, this.connectedFlagArt(this.plr));

    this.startTurn("plr");
  },

  setPrompt(msg) {
    const el = document.getElementById("bt-action-prompt");
    if (el) el.textContent = msg;
  },

  // grid: optional 4 image paths (top-left, top-right, bottom-left, bottom-right) for a connected 2x2 flag (Godclock)
  showCutin(title, sub, imgSrc, grid = null) {
    // Online match: the friend sees the same cut-in (spell, flag, ability...) on their screen.
    if (this.mode === "online_p2p" && !this._cutinFromPeer) this.sendCutinToPeer(title, sub, imgSrc, grid);
    const el = document.getElementById("anime-cutin");
    document.getElementById("cutin-title").textContent = title;
    document.getElementById("cutin-sub").textContent = sub;
    const imgEl = document.getElementById("cutin-card-img");
    const gridEl = document.getElementById("cutin-card-grid");
    const useGrid = Array.isArray(grid) && grid.length === 4 && gridEl;
    imgEl.src = imgSrc || "Sprite/Sleeves/s0.png";
    imgEl.classList.toggle("hidden", !!useGrid);
    if (gridEl) {
      gridEl.classList.toggle("hidden", !useGrid);
      gridEl.innerHTML = "";
      if (useGrid) grid.forEach(src => { const im = document.createElement("img"); im.src = src; im.alt = ""; gridEl.appendChild(im); });
    }
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "fadeInOut 1.65s ease forwards";
    // Restart the hide timer so an earlier cut-in can't hide this newer one early.
    clearTimeout(this._cutinTimer);
    this._cutinTimer = setTimeout(() => {
      el.classList.add("hidden");
    }, 1650);
  },

  animateCardFlight(fromElId, toElId, imgSrc, badgeText = "", rotateEndDeg = 0, callback = null) {
    const fromEl = document.getElementById(fromElId);
    const toEl = document.getElementById(toElId);
    const fxLayer = document.getElementById("fx-layer");
    if (!fromEl || !toEl || !fxLayer) {
      if (callback) callback();
      return;
    }

    // Screen rects are in real pixels; the effect layer lives inside the
    // big-screen zoom, so convert back to layout pixels.
    const z = window.BF_UI_ZOOM || 1;
    const r1 = fromEl.getBoundingClientRect();
    const r2 = toEl.getBoundingClientRect();

    const startX = (r1.left + r1.width / 2) / z - 43;
    const startY = (r1.top + r1.height / 2) / z - 60;
    const endX = (r2.left + r2.width / 2) / z - 43;
    const endY = (r2.top + r2.height / 2) / z - 60;

    const cardFx = document.createElement("div");
    cardFx.className = "flying-card-fx";
    cardFx.style.backgroundImage = `url("${imgSrc || "Sprite/Sleeves/s0.png"}")`;
    cardFx.style.left = `${startX}px`;
    cardFx.style.top = `${startY}px`;
    cardFx.style.transform = `translate(0px, 0px) scale(0.85) rotate(0deg)`;

    if (badgeText) {
      const b = document.createElement("div");
      b.className = "flying-card-badge";
      b.textContent = badgeText;
      cardFx.appendChild(b);
    }

    fxLayer.appendChild(cardFx);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dx = endX - startX;
        const dy = endY - startY;
        cardFx.style.transform = `translate(${dx}px, ${dy}px) scale(1.04) rotate(${rotateEndDeg}deg)`;
      });
    });

    setTimeout(() => {
      cardFx.style.opacity = "0";
      setTimeout(() => {
        cardFx.remove();
        if (callback) callback();
      }, 140);
    }, 520);
  },

  animateAttackStrike(attSide, attackerZone, defSide, targetPos, attackerImg, callback = null) {
    const fromId = attackerZone === "item"
      ? (attSide === "plr" ? "z-plr-item" : "z-opp-fighter")
      : `z-${attSide}-${attackerZone}`;
    const toId = targetPos === "fighter"
      ? (defSide === "plr" ? "z-plr-item" : "z-opp-fighter")
      : `z-${defSide}-${targetPos}`;

    const toEl = document.getElementById(toId);
    const fxLayer = document.getElementById("fx-layer");

    this.animateCardFlight(fromId, toId, attackerImg, "⚔️ ATTACK!", -8, () => {
      if (toEl && fxLayer) {
        const r = toEl.getBoundingClientRect();
        const burst = document.createElement("div");
        burst.className = "impact-burst-fx";
        const bz = window.BF_UI_ZOOM || 1;
        burst.style.left = `${(r.left + r.width / 2) / bz}px`;
        burst.style.top = `${(r.top + r.height / 2) / bz}px`;
        burst.textContent = "💥";
        fxLayer.appendChild(burst);
        setTimeout(() => burst.remove(), 500);
      }
      if (callback) callback();
    });
  },

  drawCardsWithAnimation(side, count = 1, onComplete = null) {
    const f = this.getFighter(side);
    if (count <= 0 || f.deck.length === 0) {
      this.renderBattle();
      if (onComplete) onComplete();
      return;
    }

    const cid = f.deck.shift();
    const c = CARD_MAP.get(cid);
    const fromId = side === "plr" ? "z-plr-deck" : "z-opp-deck";
    const toId = side === "plr" ? "bt-plr-hand" : "hud-opp-target";
    const imgToShow = side === "plr" && c ? c.img : "Sprite/Sleeves/s0.png";

    this.animateCardFlight(fromId, toId, imgToShow, "🃏 DRAW!", 0, () => {
      if (this.matchOver) return;
      f.hand.push(cid);
      this.renderBattle();
      if (f.deck.length === 0) {
        this.checkWinCondition();
        if (this.matchOver) return;
      }

      if (side === "plr" && [4569, 5760].includes(cid) && !f.isLostWorldActive) {
        this.promptActivateLostWorldFlag(side, f.hand.length - 1, () => {
          if (count > 1) this.drawCardsWithAnimation(side, count - 1, onComplete);
          else if (onComplete) onComplete();
        });
        return;
      }

      if (count > 1) {
        this.drawCardsWithAnimation(side, count - 1, onComplete);
      } else if (onComplete) {
        onComplete();
      }
    });
  },

  chargeDeckToGaugeWithAnimation(side, count = 1, onComplete = null) {
    const f = this.getFighter(side);
    if (count <= 0 || f.deck.length === 0) {
      this.renderBattle();
      if (onComplete) onComplete();
      return;
    }

    const cid = f.deck.shift();
    const fromId = side === "plr" ? "z-plr-deck" : "z-opp-deck";
    const toId = side === "plr" ? "z-plr-gauge" : "z-opp-gauge";

    this.animateCardFlight(fromId, toId, "Sprite/Sleeves/s0.png", "⚡ +1 GAUGE", 90, () => {
      f.gauge.push(cid);
      this.renderBattle();
      if (count > 1) {
        this.chargeDeckToGaugeWithAnimation(side, count - 1, onComplete);
      } else if (onComplete) {
        onComplete();
      }
    });
  },

  getFighter(side) {
    return side === "plr" ? this.plr : this.opp;
  },

  // True when the person at this screen is allowed to act right now.
  // Blocks input during a bot's turn, during an online friend's turn, and after the match ends.
  isLocalTurn() {
    if (this.matchOver) return false;
    if (this.activeSide === "opp" && (this.opp.isBot || this.mode === "online_p2p")) return false;
    return true;
  },

  getEnemy(side) {
    return side === "plr" ? this.opp : this.plr;
  },

  getCurrentSizeUsed(fighter) {
    let total = 0;
    const mySide = (this.plr === fighter) ? "plr" : "opp";
    MONSTER_POSITIONS.forEach(pos => {
      const m = fighter.monsters[pos];
      if (m && m.card && (!m.oppressedBy || m.oppressedBy === mySide)) {
        total += getEffectiveCardSize(fighter, m.card, m);
      }
    });
    return total;
  },

  promptActivateLostWorldFlag(side, handIdx, onContinue = null) {
    const f = this.getFighter(side);
    const cid = f.hand[handIdx];
    const lostFlag = CARD_MAP.get(cid) || CARD_MAP.get(4569);
    if (!lostFlag || f.isLostWorldActive) {
      if (onContinue) onContinue();
      return;
    }

    document.getElementById("abp-img").src = lostFlag.img;
    document.getElementById("abp-pill-tag").textContent = "🌌 LOST WORLD FLAG DRAWN — BELOST!";
    const condBadge = document.getElementById("abp-cond-badge");
    const canPay = f.gauge.length >= 2;
    condBadge.textContent = canPay ? "✅ 2 Gauge Ready" : "⚠️ Needs 2 Gauge";
    condBadge.classList.toggle("unmet", !canPay);

    document.getElementById("abp-title").textContent = `Switch Flag to "${lostFlag.name}"?`;
    document.getElementById("abp-desc").textContent = `You drew Lost World! Activate "Belost" (Pay 2 Gauge) to place Lost World as your Flag, replace your Main Deck with your 30-card Lost World Deck, and draw 2 Lost World cards!`;
    document.getElementById("abp-skill").textContent = lostFlag.skill;

    const btnRow = document.getElementById("abp-buttons");
    btnRow.innerHTML = "";

    const bYes = document.createElement("button");
    bYes.className = "primary-cta-btn";
    bYes.disabled = !canPay;
    bYes.textContent = "🌌 Activate Belost! (Switch to Lost World Deck)";
    bYes.onclick = () => {
      document.getElementById("ability-prompt-modal").classList.add("hidden");
      this.executeLostWorldBelost(side, handIdx, onContinue);
    };
    btnRow.appendChild(bYes);

    const bNo = document.createElement("button");
    bNo.className = "secondary-btn";
    bNo.textContent = "Keep in Hand for Later";
    bNo.onclick = () => {
      document.getElementById("ability-prompt-modal").classList.add("hidden");
      if (onContinue) onContinue();
    };
    btnRow.appendChild(bNo);

    document.getElementById("ability-prompt-modal").classList.remove("hidden");
  },

  executeLostWorldBelost(side, handIdx, onContinue = null) {
    const f = this.getFighter(side);
    if (f.belostUsed) {
      if (!f.isBot) alert(`You may only use "Belost" once per fight.`);
      if (onContinue) onContinue();
      return;
    }
    if (f.gauge.length < 2) {
      if (!f.isBot) alert(`"Belost" costs 2 Gauge (you have ${f.gauge.length}).`);
      if (onContinue) onContinue();
      return;
    }
    const cid = f.hand.splice(handIdx, 1)[0];
    const lostFlag = CARD_MAP.get(cid) || CARD_MAP.get(4569);

    for (let i = 0; i < 2 && f.gauge.length > 0; i++) {
      f.drop.push(f.gauge.pop());
    }

    f.belostUsed = true;
    f.flagId = lostFlag.id;
    f.world = "Lost World";
    f.isLostWorldActive = true;
    if (!f.lostDeck || f.lostDeck.length === 0) {
      f.lostDeck = generateLostDeck();
    }
    f.deck = [...f.lostDeck];
    this.shuffleFighterDeck(side);

    this.showCutin("BELOST — LOST WORLD!", "Main Deck Replaced by 30-Card Lost Deck!", lostFlag.img);
    this.renderBattle();
    this.drawCardsWithAnimation(side, 2, () => {
      this.setPrompt("🌌 LOST WORLD ACTIVE! Your Flag and Deck are now Lost World!");
      if (onContinue) onContinue();
    });
  },

  /* ==================== GODCLOCK 2x2 CONNECTED FLAG, HORARY DOMINATION & OVERGOD "0" ==================== */
  canUseHoraryDominationNow(side) {
    const f = this.getFighter(side);
    if (!f || !f.godclock || f.godclock.awakened) return { ok: false, reason: "Already Awakened" };
    if (f.godclock.horaryDominationUsedThisTurn) {
      return { ok: false, reason: "Already used \"Horary Domination\" once this turn!" };
    }
    // Allowed on your own turn (Main or Attack Phase) OR during opponent's Attack Phase!
    if (this.activeSide !== side && this.phase !== "attack" && !this.pendingDefenseContext) {
      return { ok: false, reason: "On opponent's turn, can only use during Attack Phase!" };
    }
    if (f.hand.length === 0) {
      return { ok: false, reason: "Requires at least 1 card in hand to put on the bottom of your deck!" };
    }
    return { ok: true, reason: "Ready (1 Flip / Turn)" };
  },

  getDropZoneTimeDragonMonsters(fighter) {
    const res = [];
    fighter.drop.forEach((cid, dropIdx) => {
      const c = CARD_MAP.get(cid);
      if (!c || c.type !== "Monster") return;
      const isTD = (c.attrs || []).some(a => normalizeSearchToken(a) === "timedragon");
      if (!isTD) return;
      const cost = parseCardCost(c.cost, c.skill, fighter, c);
      if (fighter.gauge.length >= cost.gauge) {
        res.push({ card: c, dropIdx, cost });
      }
    });
    return res;
  },

  findTimeRulerMonsterForGodclockReversal(fighter) {
    // Check field first
    for (const pos of MONSTER_POSITIONS) {
      const m = fighter.monsters[pos];
      if (m && m.card && (m.card.name || "").toLowerCase().includes("time ruler")) {
        return { source: "field", pos, card: m.card };
      }
    }
    // Check hand next
    for (let i = 0; i < fighter.hand.length; i++) {
      const c = CARD_MAP.get(fighter.hand[i]);
      if (c && c.type === "Monster" && (c.name || "").toLowerCase().includes("time ruler")) {
        return { source: "hand", handIdx: i, card: c };
      }
    }
    return null;
  },

  openGodclockModal() {
    const f = this.plr;
    if (!f.godclock) return;

    const hdCheck = this.canUseHoraryDominationNow("plr");
    const titleEl = document.getElementById("godclock-modal-title");
    const subEl = document.getElementById("godclock-modal-subtitle");
    if (titleEl) {
      titleEl.textContent = f.godclock.overgodActive
        ? `👑 OVERGOD, "0" — SUPREME TIME DRAGON FLAG ([Reversal] Count: ${f.godclock.reversalCount})`
        : f.godclock.awakened
        ? `👑 PERFECTED DEITY OF EON, THE ENDRULER DRAGON ([Reversal] Count: ${f.godclock.reversalCount})`
        : `⏳ GODCLOCK — 2x2 CONNECTED 4-CARD FLAG ([Reversal] Count: ${f.godclock.reversalCount})`;
    }
    if (subEl) {
      subEl.innerHTML = `Top-Left: <strong>Clock-I (#5958 ➔ #5962)</strong> • Top-Right: <strong>Clock-II (#5959 ➔ #5963)</strong> • Bottom-Left: <strong>Godclock (#5957 ➔ #5961)</strong> • Bottom-Right: <strong>Clock-III (#5960 ➔ #5964)</strong><br/>` +
        `<span style="color:${hdCheck.ok ? "#fde047" : "#fca5a5"}; font-weight:700;">⏱️ "Horary Domination" (Max 1 Flip / Turn, Usable on Either Player's Attack Phase): ${hdCheck.reason}</span>`;
    }

    const artPreview = document.getElementById("godclock-2x2-art");
    if (f.godclock.overgodActive) {
      const overgodCard = CARD_MAP.get(6202);
      artPreview.innerHTML = `<img src="${OVERGOD_FLAG_ART}" onerror="this.src='${overgodCard.img}'" alt="Overgod 0" style="grid-column: span 2; grid-row: span 2; width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="battle.closeGodclockModal(); battle.openEndrulerOrOvergodBanner('plr');" title="Click to open Overgod '0' Skill Banner!" />`;
    } else {
      artPreview.innerHTML = f.godclock.quadrants.map((q, idx) => {
        const activeId = (f.godclock.awakened || q.reversed) ? q.backId : q.frontId;
        const c = CARD_MAP.get(activeId) || CARD_MAP.get(5957);
        return `<img src="${c.img}" alt="${escapeHtml(q.name)}" style="cursor:pointer;" onclick="battle.closeGodclockModal(); ${f.godclock.awakened || q.reversed ? "battle.openEndrulerOrOvergodBanner('plr')" : `battle.openCardBanner({ card: CARD_MAP.get(${activeId}), context: 'view', side: 'plr' })`}" title="${q.pos}: ${q.name} (#${q.frontId} ➔ #${q.backId}) — Click to view Skill Banner!" />`;
      }).join("");
    }

    const row = document.getElementById("godclock-cards-row");
    row.innerHTML = "";

    f.godclock.quadrants.forEach((q, idx) => {
      const div = document.createElement("div");
      div.className = `godclock-slot-card ${q.reversed ? "reversed" : ""}`;
      div.innerHTML = `
        <div class="slot-label">${q.pos}: ${q.name} (#${q.frontId} ➔ #${q.backId})</div>
        <div style="font-size:11px; color:#cbd5e1;">${q.reversed ? "✨ [Reversal] Active — Endruler Quadrant #" + q.backId : q.desc}</div>
      `;

      if (!f.godclock.awakened && idx !== 2 && !q.reversed) {
        let canThisClock = hdCheck.ok;
        let extraWarn = "";
        if (idx === 3) {
          const tdDrops = this.getDropZoneTimeDragonMonsters(f);
          if (tdDrops.length === 0) {
            canThisClock = false;
            extraWarn = " (Needs a «Time Dragon» monster in Drop Zone)";
          }
        }

        const btn = document.createElement("button");
        btn.className = "primary-cta-btn full-width";
        btn.style.padding = "7px 10px";
        btn.style.fontSize = "11.5px";
        btn.disabled = !canThisClock;
        btn.textContent = `🔄 [Reversal] Flip ${q.name} (#${q.frontId} ➔ #${q.backId})${extraWarn}`;
        btn.onclick = () => {
          this.closeGodclockModal();
          this.initiateClockFlipInteractive("plr", idx);
        };
        div.appendChild(btn);
      }

      if (idx === 2 && !f.godclock.awakened) {
        const clocksFlipped = [0, 1, 3].every(i => f.godclock.quadrants[i].reversed);
        const trFound = this.findTimeRulerMonsterForGodclockReversal(f);
        const btnG = document.createElement("button");
        btnG.className = "primary-cta-btn full-width";
        btnG.style.padding = "7px 10px";
        btnG.style.fontSize = "11.5px";
        btnG.disabled = !clocksFlipped || !trFound;
        btnG.textContent = clocksFlipped
          ? (trFound ? `👑 Drop "${trFound.card.name}" (${trFound.source.toUpperCase()}) & Flip Godclock (#5957 ➔ #5961)!` : `🔒 Needs a "Time Ruler" monster on your field or in hand`)
          : `🔒 Flip Clock-I, Clock-II & Clock-III first (${[0, 1, 3].filter(i => f.godclock.quadrants[i].reversed).length}/3 Flipped)`;
        btnG.onclick = () => {
          this.closeGodclockModal();
          this.awakenEndrulerDragon("plr");
        };
        div.appendChild(btnG);
      }

      row.appendChild(div);
    });

    const actRow = document.getElementById("godclock-actions");
    actRow.innerHTML = "";

    // Button to open Perfected Deity of Eon, The Endruler Dragon (or Overgod "0") Skill Banner!
    const bBanner = document.createElement("button");
    bBanner.className = "action-btn";
    bBanner.textContent = f.godclock.overgodActive
      ? "📜 Open Overgod, \"0\" Skill Banner & Abilities"
      : "📜 Open Perfected Deity of Eon, The Endruler Dragon Skill Banner";
    bBanner.onclick = () => {
      this.closeGodclockModal();
      this.openEndrulerOrOvergodBanner("plr");
    };
    actRow.appendChild(bBanner);

    if (f.godclock.awakened && !f.godclock.overgodActive && f.hand.includes(6202)) {
      const bOvergod = document.createElement("button");
      bOvergod.className = "primary-cta-btn";
      bOvergod.textContent = "👑 [Act] [Reversal] Endruler Dragon ➔ Place Overgod, \"0\" (#6202) on Flag!";
      bOvergod.onclick = () => {
        this.closeGodclockModal();
        this.activateOvergodZeroFromHand("plr", f.hand.indexOf(6202));
      };
      actRow.appendChild(bOvergod);
    }

    if (f.godclock.awakened && f.item && f.item.isEndrulerFlag && f.item.attacksLeft > 0 && this.activeSide === "plr") {
      const bAtk = document.createElement("button");
      bAtk.className = "primary-cta-btn";
      bAtk.textContent = `⚔️ Attack with ${f.item.card.name} (${f.item.attacksLeft} Attacks Left)`;
      bAtk.onclick = () => {
        this.closeGodclockModal();
        this.startAttackSelection("plr", "item"); // switches to the Attack Phase once the attack is allowed
      };
      actRow.appendChild(bAtk);
    }

    const bClose = document.createElement("button");
    bClose.className = "secondary-btn";
    bClose.textContent = "Close";
    bClose.onclick = () => this.closeGodclockModal();
    actRow.appendChild(bClose);

    document.getElementById("godclock-modal").classList.remove("hidden");
  },

  closeGodclockModal() {
    document.getElementById("godclock-modal").classList.add("hidden");
  },

  openEndrulerOrOvergodBanner(side = "plr") {
    const f = this.getFighter(side);
    if (!f) return;
    if (f.item && f.item.isEndrulerFlag) {
      this.openCardBanner({
        card: f.item.card,
        context: "field",
        side,
        zonePos: "item",
        unit: f.item
      });
    } else {
      const endrulerCard = CARD_MAP.get(5961);
      this.openCardBanner({
        card: endrulerCard,
        context: "endruler_preview",
        side
      });
    }
  },

  // Interactive step-by-step Horary Domination for Clock-I (0), Clock-II (1), Clock-III (3)
  initiateClockFlipInteractive(side, quadIdx, fromDefenseModal = false) {
    const f = this.getFighter(side);
    if (!f || !f.godclock || f.godclock.awakened) return;
    const q = f.godclock.quadrants[quadIdx];
    if (!q || q.reversed) return;

    const hdCheck = this.canUseHoraryDominationNow(side);
    if (!hdCheck.ok) {
      if (!f.isBot) alert(`Cannot use "${q.name}" [Horary Domination]:\n• ${hdCheck.reason}`);
      return;
    }

    if (f.isBot) {
      this.executeClockFlipWithHandCard(side, quadIdx, 0, null, fromDefenseModal);
      return;
    }

    // For Clock-III (quadIdx === 3), first choose a «Time Dragon» monster in Drop Zone!
    if (quadIdx === 3) {
      const tdDrops = this.getDropZoneTimeDragonMonsters(f);
      if (tdDrops.length === 0) {
        alert("Clock-III Requirement: You need at least 1 «Time Dragon» monster in your Drop Zone (and enough Gauge to pay its [Call Cost])!");
        return;
      }
      this.openCustomCardChoiceModal({
        title: `⏳ Clock-III (#5960 ➔ #5964) — Step 1: Choose a «Time Dragon» Monster in Your Drop Zone`,
        subtitle: `Choose 1 «Time Dragon» monster from your Drop Zone to call after putting 1 hand card on the bottom of your deck:`,
        cardsList: tdDrops.map(d => ({
          card: d.card,
          badge: `Call Cost: ${d.cost.gauge}G`,
          payload: d.dropIdx
        })),
        onSelect: (chosenDropIdx) => {
          this.promptHandCardToBottomForClock(side, quadIdx, chosenDropIdx, fromDefenseModal);
        }
      });
      return;
    }

    this.promptHandCardToBottomForClock(side, quadIdx, null, fromDefenseModal);
  },

  promptHandCardToBottomForClock(side, quadIdx, chosenDropIdx = null, fromDefenseModal = false) {
    const f = this.getFighter(side);
    const q = f.godclock.quadrants[quadIdx];
    this.openCustomCardChoiceModal({
      title: `⏳ ${q.name} (#${q.frontId} ➔ #${q.backId}) — Put 1 Hand Card on Bottom of Your Deck`,
      subtitle: `[Horary Domination] Select 1 card from your hand to place on the bottom of your deck and [Reversal] (flip over) ${q.name}:`,
      cardsList: f.hand.map((cid, hIdx) => ({
        card: CARD_MAP.get(cid),
        badge: "Hand Card",
        payload: hIdx
      })),
      onSelect: (chosenHandIdx) => {
        this.executeClockFlipWithHandCard(side, quadIdx, chosenHandIdx, chosenDropIdx, fromDefenseModal);
      }
    });
  },

  executeClockFlipWithHandCard(side, quadIdx, handIdx, chosenDropIdx = null, fromDefenseModal = false) {
    const f = this.getFighter(side);
    if (!f || !f.godclock) return;
    const q = f.godclock.quadrants[quadIdx];
    if (!q || q.reversed) return;

    // 1. Put chosen hand card on bottom of deck
    if (f.hand.length > 0) {
      const idxToUse = (handIdx !== null && handIdx !== undefined && f.hand[handIdx] !== undefined) ? handIdx : 0;
      const bottomCid = f.hand.splice(idxToUse, 1)[0];
      f.deck.push(bottomCid);
    }

    // 2. Flip this Clock card & record 1/turn Horary Domination + Reversal count
    q.reversed = true;
    if (Array.isArray(f.subFlags)) {
      const sf = f.subFlags.find(s => s.id === q.frontId || s.name === q.name);
      if (sf) { sf.reversed = true; sf.card = CARD_MAP.get(q.backId) || sf.card; }
    }
    f.godclock.horaryDominationUsedThisTurn = true;
    f.godclock.reversalCount = (f.godclock.reversalCount || 0) + 1;

    const flippedCard = CARD_MAP.get(q.backId) || CARD_MAP.get(q.frontId);
    this.showCutin(`[REVERSAL] ${q.name.toUpperCase()}!`, `Horary Domination (#${q.frontId} ➔ #${q.backId})`, flippedCard.img);

    // Trigger "When your flag [Reversal]" abilities on field «Time Dragon» monsters (e.g. #6050 Condrol, #6063 Radra Pando)
    this.triggerOnFlagReversalFieldAbilities(side);

    // 3. Resolve specific Clock effect
    if (quadIdx === 0) {
      // Clock-I: Look at top 3 cards of deck, put 1 into hand, drop the rest
      const top3 = f.deck.splice(0, 3);
      if (top3.length === 0) {
        this.renderBattle();
        if (fromDefenseModal) this.resumePendingAttackAfterClock(false);
        return;
      }
      if (f.isBot) {
        f.hand.push(top3.shift());
        f.drop.push(...top3);
        this.renderBattle();
        return;
      }
      this.openCustomCardChoiceModal({
        title: `⏳ Clock-I [Reversal] — Look at Top ${top3.length} Cards of Your Deck`,
        subtitle: `Choose 1 card from among the top ${top3.length} cards to put into your Hand (the rest will be sent to your Drop Zone):`,
        cardsList: top3.map((cid, idx) => ({
          card: CARD_MAP.get(cid),
          badge: `Top #${idx + 1}`,
          payload: idx
        })),
        onSelect: (pickIdx) => {
          const pickedCid = top3.splice(pickIdx, 1)[0];
          const pickedCard = CARD_MAP.get(pickedCid);
          f.drop.push(...top3);
          this.animateCardFlight("z-plr-deck", "bt-plr-hand", pickedCard ? pickedCard.img : "Sprite/Sleeves/s0.png", "⏳ CLOCK-I PICK!", 0, () => {
            f.hand.push(pickedCid);
            this.setPrompt(`⏳ Clock-I (#5958 ➔ #5962): Added "${pickedCard ? pickedCard.name : "card"}" to Hand and dropped the other ${top3.length} card(s)!`);
            this.renderBattle();
            if (fromDefenseModal) this.resumePendingAttackAfterClock(false);
          });
        }
      });
    } else if (quadIdx === 1) {
      // Clock-II: Draw 1 card, and if there are any cards in battle, end the battle!
      this.drawCardsWithAnimation(side, 1, () => {
        if (fromDefenseModal || this.pendingDefenseContext) {
          this.setPrompt(`⏳ Clock-II (#5959 ➔ #5963) [Reversal]: Drew 1 card and ENDED THE BATTLE!`);
          this.resumePendingAttackAfterClock(true);
        } else {
          this.setPrompt(`⏳ Clock-II (#5959 ➔ #5963) [Reversal]: Drew 1 card!`);
          this.renderBattle();
        }
      });
    } else if (quadIdx === 3) {
      // Clock-III: Call the chosen «Time Dragon» monster from Drop Zone by paying its [Call Cost]
      const tdList = this.getDropZoneTimeDragonMonsters(f);
      let dropIdxToCall = chosenDropIdx;
      if (dropIdxToCall === null || dropIdxToCall === undefined || !f.drop[dropIdxToCall]) {
        dropIdxToCall = tdList.length > 0 ? tdList[0].dropIdx : -1;
      }
      const callPreview = dropIdxToCall !== -1 ? CARD_MAP.get(f.drop[dropIdxToCall]) : null;
      const targetZone = ["center", "left", "right"].find(z => !f.monsters[z]);
      const fitsSize = callPreview && this.getCurrentSizeUsed(f) + getEffectiveCardSize(f, callPreview) <= (f.maxSize || 3);
      if (callPreview && (!targetZone || !fitsSize)) {
        this.setPrompt(`⏳ Clock-III flipped, but "${callPreview.name}" couldn't be called (${!targetZone ? "no open Monster Zone" : "over your size limit"}).`);
      } else if (dropIdxToCall !== -1 && f.drop[dropIdxToCall]) {
        const callCid = f.drop.splice(dropIdxToCall, 1)[0];
        const callCard = CARD_MAP.get(callCid);
        const cost = parseCardCost(callCard.cost, callCard.skill, f, callCard);
        for (let i = 0; i < cost.gauge && f.gauge.length > 0; i++) f.drop.push(f.gauge.pop());
        const soulArr = [];
        for (let i = 0; i < Math.max(cost.soul, callCard.sg ? 1 : 0) && f.deck.length > 0; i++) {
          soulArr.push(f.deck.shift());
        }
        f.monsters[targetZone] = {
          card: callCard,
          rested: false,
          attacksLeft: callCard.atk_max || 1,
          soul: soulArr,
          tempPower: 0,
          tempDef: 0,
          tempCrit: 0,
          actUsed: false
        };
        this.setPrompt(`⏳ Clock-III (#5960 ➔ #5964) [Reversal]: Called "${callCard.name}" from your Drop Zone to ${targetZone.toUpperCase()}!`);
      }
      this.renderBattle();
      if (fromDefenseModal) this.resumePendingAttackAfterClock(false);
    }
  },

  resumePendingAttackAfterClock(battleEndedByClockII = false) {
    const ctx = this.pendingDefenseContext;
    this.pendingDefenseContext = null;
    if (!ctx) return;
    if (battleEndedByClockII) {
      // Clock-II ends the battle immediately!
      const attFighter = this.getFighter(ctx.attSide);
      ctx.attackerZones.forEach(zp => {
        const u = unitAt(attFighter, zp);
        if (u) {
          u.attacksLeft -= 1;
          if (u.attacksLeft <= 0) u.rested = true;
        }
      });
      this.renderBattle();
      if (ctx.attSide === "opp" && this.opp.isBot && this.oppContinueCallback) {
        setTimeout(this.oppContinueCallback, 650);
      }
    } else {
      this.executeAttackResolution(ctx.attSide, ctx.attackerZones, ctx.targetPos, false);
    }
  },

  triggerOnFlagReversalFieldAbilities(side) {
    const f = this.getFighter(side);
    const enemy = this.getEnemy(side);
    const oppSide = side === "plr" ? "opp" : "plr";

    getAllFieldUnits(f).forEach(u => {
      if (!u.card) return;
      const s = (u.card.skill || "").toLowerCase();
      if (s.includes("when your flag [reversal]")) {
        if (s.includes("gain 2 life")) f.life += 2;
        if (s.includes("deal 2 damage")) enemy.life -= 2;
        const oppPos = ["center", "left", "right"].find(p => enemy.monsters[p] && !this.isEffectProtected(oppSide, p, "destroyed", oppSide === "plr" ? "opp" : "plr"));
        if (oppPos && (s.includes("destroy") || s.includes("return"))) {
          this.destroyMonster(oppSide, oppPos);
        }
      }
    });
    this.checkWinCondition();
  },

  awakenEndrulerDragon(side) {
    const f = this.getFighter(side);
    if (!f.godclock || f.godclock.awakened) return;

    const clocksFlipped = [0, 1, 3].every(i => f.godclock.quadrants[i].reversed);
    if (!clocksFlipped && !f.isBot) {
      alert("You must flip Clock-I (#5958), Clock-II (#5959), and Clock-III (#5960) in [Reversal] before flipping Godclock (#5957)!");
      return;
    }

    // Cost: put a monster with "Time Ruler" in its card name from your field or hand into the Drop Zone
    const trFound = this.findTimeRulerMonsterForGodclockReversal(f);
    if (!trFound) {
      if (!f.isBot) alert(`Godclock's [Reversal] costs a monster with "Time Ruler" in its card name from your field or hand. You don't have one right now.`);
      return;
    }
    if (trFound) {
      if (trFound.source === "field") {
        const m = f.monsters[trFound.pos];
        if (m.soul) f.drop.push(...m.soul);
        f.drop.push(m.card.id);
        f.monsters[trFound.pos] = null;
      } else if (trFound.source === "hand") {
        const cid = f.hand.splice(trFound.handIdx, 1)[0];
        f.drop.push(cid);
      }
    }

    // The Endruler Dragon takes the Flag/Item slot, so any equipped item goes to the Drop Zone.
    if (f.item && !f.item.isEndrulerFlag) {
      if (f.item.soul) f.drop.push(...f.item.soul);
      f.drop.push(f.item.card.id);
      f.item = null;
    }

    f.godclock.awakened = true;
    f.godclock.quadrants.forEach(q => q.reversed = true);
    if (Array.isArray(f.subFlags)) f.subFlags.forEach(sf => { sf.reversed = true; sf.card = CARD_MAP.get(sf.backId) || sf.card; });
    f.godclock.reversalCount = Math.max(4, (f.godclock.reversalCount || 0) + 1);

    const endrulerCard = Object.assign({}, CARD_MAP.get(5961), {
      id: 5961,
      name: "Perfected Deity of Eon, The Endruler Dragon",
      type: "Flag",
      power: 12000,
      crit: 4,
      defense: 12000,
      atk_max: 3,
      ta: true,
      skill: CARD_MAP.get(5961).skill
    });

    f.item = {
      card: endrulerCard,
      rested: false,
      attacksLeft: 3,
      soul: [],
      isEndrulerFlag: true,
      isOvergodZero: false
    };

    this.triggerOnFlagReversalFieldAbilities(side);
    this.showCutin("OVERGOD REVERSAL!", "Perfected Deity of Eon, The Endruler Dragon (12000/4/12000)!", endrulerCard.img);
    this.setPrompt("👑 All 4 Godclock Cards Merged into Perfected Deity of Eon, The Endruler Dragon (12000 Pow / 4 Crit / 12000 Def / [Triple Attack] / \"Eternal Eon\")! Click the Flag to open its Skill Banner!");
    this.renderBattle();
  },

  activateOvergodZeroFromHand(side, handIdx) {
    const f = this.getFighter(side);
    if (!f.godclock || !f.godclock.awakened) {
      alert("Overgod, \"0\" Requirement: You must first flip all 4 Godclock cards into \"Perfected Deity of Eon, The Endruler Dragon\" before using Overgod, \"0\" from your hand!");
      return;
    }
    if (handIdx < 0 || handIdx >= f.hand.length) return;

    const cid = f.hand.splice(handIdx, 1)[0];
    const overgodCard = Object.assign({}, CARD_MAP.get(cid) || CARD_MAP.get(6202), {
      id: 6202,
      name: "Overgod, \"0\"",
      type: "Flag",
      power: 0,
      crit: 12,
      defense: 0,
      atk_max: 1
    });

    f.flagId = 6202;
    f.godclock.overgodActive = true;
    f.godclock.reversalCount = (f.godclock.reversalCount || 4) + 1;

    f.item = {
      card: overgodCard,
      rested: false,
      attacksLeft: 1,
      soul: [],
      isEndrulerFlag: true,
      isOvergodZero: true,
      actUsed: false
    };

    this.triggerOnFlagReversalFieldAbilities(side);
    this.showCutin("OVERGOD, \"0\" DESCENT!", "Placed Overgod, \"0\" on Top of All Flags (12 Critical)!", OVERGOD_FLAG_ART);
    this.setPrompt("👑 OVERGOD, \"0\" ACTIVE ON FLAG SLOT! Click your Flag to open Overgod, \"0\"'s Skill Banner, unleash [Act] \"Eternal Eon\", or Attack for 12 Critical!");
    this.renderBattle();
  },

  activateOvergodEternalEon(side) {
    const f = this.getFighter(side);
    const enemy = this.getEnemy(side);
    if (!f.godclock || !f.godclock.overgodActive) return;

    // Cost option 1: Drop another "Overgod, "0"" (#6202) from hand
    // Cost option 2: Drop 6 hand cards and pay 6 gauge
    const otherOvergodIdx = f.hand.indexOf(6202);
    const canPaySix = f.hand.length >= 6 && f.gauge.length >= 6;

    if (otherOvergodIdx === -1 && !canPaySix) {
      alert(`Cannot activate Overgod, "0" [Act] "Eternal Eon" yet:\n• Requires dropping an "Overgod, "0"" from your hand, OR dropping 6 hand cards and paying 6 gauge (You have ${f.hand.length} hand cards and ${f.gauge.length} gauge).`);
      return;
    }

    if (otherOvergodIdx !== -1) {
      const dropped = f.hand.splice(otherOvergodIdx, 1)[0];
      f.drop.push(dropped);
    } else {
      for (let i = 0; i < 6; i++) f.drop.push(f.hand.pop());
      for (let i = 0; i < 6; i++) f.drop.push(f.gauge.pop());
    }

    enemy.timeStoppedThisTurn = true;
    MONSTER_POSITIONS.forEach(pos => {
      if (enemy.monsters[pos]) {
        enemy.monsters[pos].defenseZeroTurn = true;
      }
    });

    const overgodCard = CARD_MAP.get(6202);
    this.showCutin("ETERNAL EON — TIME STOP!", "All Opponent Defense Reduced to 0 & Time Stopped!", OVERGOD_FLAG_ART);
    this.setPrompt("⏱️ [ETERNAL EON] Time is stopped for your opponent! All opponent monsters' Defense is now 0, and your opponent cannot [Counter] this turn!");
    this.renderBattle();
  },

  openCustomCardChoiceModal({ title, subtitle, cardsList, onSelect }) {
    document.getElementById("ds-title").textContent = title;
    document.getElementById("ds-subtitle").textContent = subtitle;
    document.getElementById("ds-filter").value = "";
    const tribeSel = document.getElementById("ds-tribe");
    if (tribeSel) tribeSel.value = "";

    const grid = document.getElementById("ds-grid");
    grid.innerHTML = "";

    // A forced choice: remember it so closing the popup still resolves it
    // (auto-picks the first option) instead of losing the cards being chosen from.
    const firstItem = cardsList.find(it => it.card);
    this.activeChoice = firstItem ? { onSelect, firstPayload: firstItem.payload } : null;
    this.setDeckSearchFiltersEnabled(false);
    const footerEl = document.getElementById("ds-footer-actions");
    if (footerEl) {
      footerEl.innerHTML = `<button class="secondary-btn" onclick="battle.closeDeckSearch()">Close (auto-picks the first card)</button>`;
    }

    cardsList.forEach(item => {
      const c = item.card;
      if (!c) return;
      const tile = document.createElement("div");
      tile.className = "card-tile";
      tile.onclick = () => {
        this.activeChoice = null;
        this.setDeckSearchFiltersEnabled(true);
        document.getElementById("deck-search-modal").classList.add("hidden");
        onSelect(item.payload);
      };
      tile.innerHTML = `
        <div class="tile-owned-badge">${item.badge || "SELECT"}</div>
        <img src="${c.img}" alt="${escapeHtml(c.name)}" />
        <div class="tile-name">${escapeHtml(c.name)}</div>
        <div class="tile-sub">${c.type} ${c.size !== null ? "• Sz " + c.size : ""}</div>
      `;
      grid.appendChild(tile);
    });

    document.getElementById("deck-search-modal").classList.remove("hidden");
  },

  sendOnlineStateToPeer(customPrompt = null, cutinData = null, extra = {}) {
    if (this.mode !== "online_p2p" || !app.peerConn || !app.peerConn.open) return;
    try {
      app.peerConn.send({
        ...extra,
        type: "P2P_STATE_SYNC",
        turnCount: this.turnCount,
        turn1AttackUsed: !!this.turn1AttackUsed,
        // Flip perspective for the receiving peer: our plr is their opp, our opp is their plr!
        activeSideForReceiver: this.activeSide === "plr" ? "opp" : "plr",
        phase: this.phase,
        senderPlr: JSON.parse(JSON.stringify(this.plr)),
        senderOpp: JSON.parse(JSON.stringify(this.opp)),
        prompt: customPrompt,
        cutin: cutinData
      });
    } catch (e) {
      console.warn("P2P sync error:", e);
    }
  },

  // Tell the online friend to show the same cut-in banner. Names are flipped to the friend's point of view.
  sendCutinToPeer(title, sub, imgSrc, grid = null) {
    if (!app.peerConn || !app.peerConn.open) return;
    try {
      const friend = (this.opp && this.opp.name) || "🌐 Online Friend";
      const flip = (t) => String(t == null ? "" : t)
        .replace(/\bYou\b/g, "\u0001")
        .split(friend).join("You")
        .replace(/\u0001/g, "🌐 Online Friend");
      app.peerConn.send({ type: "P2P_CUTIN", title: flip(title), sub: flip(sub), imgSrc: imgSrc || "", grid: Array.isArray(grid) ? grid : null });
    } catch (e) {
      console.warn("P2P cut-in error:", e);
    }
  },

  // A cut-in from the online friend is untrusted: text only, and the picture must be one of our own local images.
  receiveCutinFromPeer(msg) {
    if (this.mode !== "online_p2p" || !msg) return;
    const scr = document.getElementById("screen-battle");
    if (!scr || !scr.classList.contains("active")) return;
    const clean = (t, n) => String(t == null ? "" : t).slice(0, n);
    const safe = (src) => (typeof src === "string" && /^(CardSprite|Sprite)\/[A-Za-z0-9_\-\/.]+$/.test(src) && !src.includes("..")) ? src : "";
    const img = safe(msg.imgSrc);
    const grid = Array.isArray(msg.grid) && msg.grid.length === 4 && msg.grid.every(safe) ? msg.grid.slice(0, 4) : null;
    this._cutinFromPeer = true;
    try {
      this.showCutin(clean(msg.title, 80), clean(msg.sub, 200), img, grid);
    } finally {
      this._cutinFromPeer = false;
    }
  },

  // Board state from an online peer is untrusted: rebuild every card object from the local card database
  // (by id) so a modified client can't inject HTML/scripts through card names or image paths.
  rehydrateFighterFromPeer(f) {
    if (!f || typeof f !== "object") return f;
    const known = (card) => {
      const base = card && CARD_MAP.get(Number(card.id));
      if (!base) return null;
      if (Number(card.id) === 5961 || Number(card.id) === 6202) {
        return Object.assign({}, base, {
          type: "Flag",
          power: Number(card.power) || 0,
          crit: Number(card.crit) || 0,
          defense: Number(card.defense) || 0,
          atk_max: Number(card.atk_max) || 1,
          ta: Boolean(card.ta)
        });
      }
      return base;
    };
    const fixUnit = (u) => {
      if (!u || typeof u !== "object") return null;
      const card = known(u.card);
      return card ? Object.assign(u, { card }) : null;
    };
    MONSTER_POSITIONS.forEach(pos => {
      if (f.monsters) f.monsters[pos] = fixUnit(f.monsters[pos]);
    });
    f.item = fixUnit(f.item);
    f.item2 = fixUnit(f.item2);
    f.setSpells = (f.setSpells || []).map(known).filter(Boolean);
    ["hand", "deck", "drop", "gauge", "lostDeck"].forEach(k => {
      f[k] = (Array.isArray(f[k]) ? f[k] : []).map(Number).filter(id => CARD_MAP.has(id));
    });
    f.life = Number(f.life) || 0;
    return f;
  },

  receiveOnlineStateFromPeer(msg) {
    this.mode = "online_p2p";
    this.turnCount = msg.turnCount || 1;
    this.turn1AttackUsed = !!msg.turn1AttackUsed;
    this.activeSide = msg.activeSideForReceiver || "opp";
    this.phase = msg.phase || "main";
    // Flip perspective so local player is always this.plr at the bottom of the screen!
    this.plr = this.rehydrateFighterFromPeer(msg.senderOpp);
    this.opp = this.rehydrateFighterFromPeer(msg.senderPlr);
    if (this.plr) {
      this.plr.name = "You";
      this.plr.isBot = false;
    }
    if (this.opp) {
      this.opp.name = "🌐 Online Friend";
      this.opp.isBot = false;
    }
    if (msg.cutin) {
      // Same checks as a P2P_CUTIN message, and don't echo it back to the friend.
      this.receiveCutinFromPeer(msg.cutin);
    }
    if (msg.prompt) {
      this.setPrompt(msg.prompt);
    } else {
      this.setPrompt(this.activeSide === "plr" ? "🟢 YOUR TURN! Make your move!" : "⏳ Waiting for Online Friend's move...");
    }
    this.isReceivingP2P = true;
    this.renderBattle();
    this.isReceivingP2P = false;

    // The friend's action may have ended the match (life or deck at 0): finish it on this side too.
    this.checkWinCondition();
    if (this.matchOver) return;

    // The friend ended their turn: run our own Start Phase (reset + draw), which then syncs back.
    if (msg.beginTurn && this.activeSide === "plr") {
      this.startTurn("plr");
    }
  },

  receiveOnlineAttackPromptFromPeer(msg) {
    // First apply the latest board state from attacker
    if (msg.stateSnapshot) {
      this.receiveOnlineStateFromPeer(msg.stateSnapshot);
    }
    const attackerZones = msg.attackerZones || ["center"];
    const targetPos = msg.targetPos || "fighter";
    const units = attackerZones.map(zp => unitAt(this.opp, zp)).filter(Boolean);
    const isLink = units.length > 1;
    const defOptions = this.getAvailableDefenseCards("plr", isLink, targetPos, units);
    const canDefUseGodclock = !this.plr.timeStoppedThisTurn && !this.plr.timeStoppedThisBattle && this.plr.godclock && !this.plr.godclock.awakened && !this.plr.godclock.horaryDominationUsedThisTurn && this.plr.hand.length > 0;

    if (defOptions.length === 0 && !canDefUseGodclock) {
      if (app.peerConn && app.peerConn.open) {
        app.peerConn.send({ type: "P2P_DEFENSE_RESPONSE", chosenHandIdx: null });
      }
      return;
    }

    this.pendingDefenseContext = { attSide: "opp", attackerZones, targetPos, defSide: "plr", isOnlineP2P: true };
    document.getElementById("def-attacker-img").src = units[0] ? units[0].card.img : "Sprite/Sleeves/s0.png";
    const attNames = units.map(u => `"${u.card.name}"`).join(" + ");
    const targetName = targetPos === "fighter"
      ? "YOU directly"
      : `your ${targetPos.toUpperCase()} monster "${this.plr.monsters[targetPos]?.card.name}"`;
    document.getElementById("def-prompt-title").textContent = `⚔️ ONLINE ATTACK! ${attNames} attacking ${targetName}!`;

    const strip = document.getElementById("def-cards-list");
    strip.innerHTML = "";
    defOptions.forEach(opt => strip.appendChild(this.buildDefenseOptionTile(opt, this.plr)));
    document.getElementById("defense-prompt-modal").classList.remove("hidden");
  },

  // The friend cast a spell / impact or called a monster: they ask if we want to nullify it.
  receiveOnlineCastPromptFromPeer(msg) {
    if (this.mode !== "online_p2p" && !(msg && msg.stateSnapshot)) return;
    if (msg.stateSnapshot) this.receiveOnlineStateFromPeer(msg.stateSnapshot);
    if (this.matchOver) return;
    if (window.ABX && ABX.answerCastPrompt) ABX.answerCastPrompt(msg);
    else if (app.peerConn && app.peerConn.open) app.peerConn.send({ type: "P2P_CAST_RESPONSE", reqId: msg.reqId, label: null });
  },

  receiveOnlineDefenseResponseFromPeer(msg) {
    const ctx = this.pendingOnlineAttackCtx;
    this.pendingOnlineAttackCtx = null;
    if (!ctx) return;
    if (msg.chosenHandIdx === null || msg.chosenHandIdx === undefined) {
      this.executeAttackResolution(ctx.attSide, ctx.attackerZones, ctx.targetPos, false);
    } else if (typeof msg.chosenHandIdx === "object" && typeof msg.chosenHandIdx.fieldKey === "string") {
      // the friend used a field [Counter] [Act]: re-checked here against the real board (ABX.useFieldCounter)
      this.applyFieldCounterAbility("opp", msg.chosenHandIdx.fieldKey, ctx.attSide, ctx.attackerZones, ctx.targetPos);
    } else if (typeof msg.chosenHandIdx === "object" && ["left", "right"].includes(msg.chosenHandIdx.moveFrom)) {
      // the friend blocked with [Move]: re-checked against the real board in applyMoveBlock
      this.applyMoveBlock("opp", msg.chosenHandIdx.moveFrom, ctx.attSide, ctx.attackerZones, ctx.targetPos);
    } else {
      this.applyDefensiveCounterCard("opp", msg.chosenHandIdx, ctx.attSide, ctx.attackerZones, ctx.targetPos);
    }
    setTimeout(() => this.sendOnlineStateToPeer(), 650);
  },

  startTurn(side) {
    if (this.matchOver) return;
    this.activeSide = side;
    this.pendingAction = null;
    this.linkAttackers = [];
    const f = this.getFighter(side);
    const enemy = this.getEnemy(side);
    f.chargedThisTurn = false;
    if (this.imTurnStart) this.imTurnStart(side);
    f.hyakuganSizeZeroTurn = false;
    enemy.hyakuganSizeZeroTurn = false;
    f.timeStoppedThisTurn = false;
    f.timeStoppedThisBattle = false;
    enemy.timeStoppedThisTurn = false;
    enemy.timeStoppedThisBattle = false;

    // Reset 1-flip-per-turn "Horary Domination" for BOTH fighters at the start of every turn!
    if (this.plr.godclock) this.plr.godclock.horaryDominationUsedThisTurn = false;
    if (this.opp.godclock) this.opp.godclock.horaryDominationUsedThisTurn = false;

    // Clear previous turn's temporary boosts and stand units BEFORE firing "start" phase triggers,
    // so buffs granted by "At the beginning/start of your turn" abilities are NOT wiped out!
    const clearTurnBoosts = (u) => {
      if (!u) return;
      u.tempPower = 0;
      u.tempDef = 0;
      u.tempCrit = 0;
      u.tempCA = false;
      u.tempDA = false; u.tempTA = false; u.tempQA = false; u.tempHA = false; u.tempSG = false; u.tempMove = false;
      u.tempIndestructible = false;
      u.tempPen = false;
    };
    [f, enemy].forEach(fighter => {
      MONSTER_POSITIONS.forEach(pos => clearTurnBoosts(fighter.monsters[pos]));
      clearTurnBoosts(fighter.item);
      clearTurnBoosts(fighter.item2);
      fighter.tempDamageReduce = 0;
    });

    MONSTER_POSITIONS.forEach(pos => {
      const m = f.monsters[pos];
      if (m) {
        if (m.abxNo && m.abxNo.stand === true) { m.abxNo.stand = false; } else m.rested = false;
        m.defenseZeroTurn = false;
        const eff = getUnitEffectiveCombatStats(f, m);
        m.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (m.card.atk_max || 1);
        m.actUsed = false;

        const kronosLine = (m.card.skill || "").split(/\n+/).find(l => l.includes("Wind Kronos"));
        if (kronosLine && f.drop.length > 0 && !(window.ABX && ABX.ownsTriggerLine && ABX.ownsTriggerLine(m.card, kronosLine))) {
          const targetSoul = m.card.id === 5955 ? 1 : 2;
          while ((m.soul || []).length < targetSoul && f.drop.length > 0) {
            m.soul.push(f.drop.pop());
          }
        }
      }
      if (enemy.monsters[pos]) {
        enemy.monsters[pos].defenseZeroTurn = false;
      }
    });

    getEquippedItems(f).forEach(({ unit: it }) => {
      if (!it) return;
      it.rested = false;
      it.attacksLeft = it.card.atk_max || 1;
      it.actUsed = false;
    });

    // [Double Buddy] / [Triple Buddy] automatic start-of-turn search:
    // "This card will automatically search for its double buddy at the start of turn"
    const bzEntries = getFighterBuddyZoneEntries(f).filter(e => !e.isFaceDown);
    if (bzEntries.length >= 2) {
      const hasAutoSearchBuddy = bzEntries.some(e => {
        const bc = CARD_MAP.get(e.id);
        return bc && /automatically search for its double buddy|double buddy|triple buddy/i.test(bc.skill || "");
      });
      if (hasAutoSearchBuddy) {
        let searchedAny = false;
        for (const p of bzEntries) {
          if (!f.hand.includes(p.id) && f.deck.includes(p.id)) {
            const dIdx = f.deck.indexOf(p.id);
            if (dIdx >= 0) {
              f.hand.push(f.deck.splice(dIdx, 1)[0]);
              searchedAny = true;
            }
          }
        }
        if (searchedAny) this.shuffleFighterDeck(side);
      }
    }

    this.phase = "start";
    this.phase = "main";
    // First Round Rule: the first player does not draw on Turn 1 (they can only Charge & Draw).
    const firstRound = this.turnCount === 1;
    this.setPrompt(firstRound
      ? `🔄 Turn 1: ${f.name}'s Start Phase — First Round: no draw this turn (you can only Charge & Draw).`
      : `🔄 Turn ${this.turnCount}: ${f.name}'s Start Phase — Drawing 1 card from Deck...`);
    this.renderBattle();

    const gen = this.matchGen;
    this.drawCardsWithAnimation(side, firstRound ? 0 : 1, () => {
      if (gen !== this.matchGen || this.matchOver) return;
      if (side === "plr" || !f.isBot) {
        this.setPrompt("Main Phase: Click any card for its Detail Banner, Call, Equip, Cast, Search Deck, [Move] to Center, or Charge & Draw!");
      }
      if (f.isBot && side === "opp") {
        setTimeout(() => {
          if (gen === this.matchGen) this.runBotTurn();
        }, 500);
      }
    });
  },

  // [Final Phase] button: from the Main Phase it passes through the Attack Phase (so its start / end abilities still
  // happen), then into the Final Phase. An extra attack phase given by a card still comes first.
  goToFinalPhase() {
    if (!this.isLocalTurn()) return;
    if (this.phase === "main") this.advancePhase();
    if (this.phase === "attack") this.advancePhase();
  },

  advancePhase() {
    if (!this.isLocalTurn()) return;
    this.pendingAction = null;
    this.linkAttackers = [];

    if (this.phase === "main") {
      this.phase = "attack";
      this.setPrompt(this.turnCount === 1
        ? "⚔️ Attack Phase (First Round: only 1 attack this turn): Click a Monster/Item/Flag to Attack, or click '🔗 Link Attack' to combine attackers (a Link Attack counts as your 1 attack)!"
        : "⚔️ Attack Phase: Click a Monster/Item/Flag to Attack, [Move], or click '🔗 Link Attack' to combine multiple attackers!");
      this.renderBattle();
    } else if (this.phase === "attack" && !(window.ABX && ABX.attackPhaseEnded && ABX.attackPhaseEnded()) && window.ABX && ABX.takeExtraAttack && ABX.takeExtraAttack(this.activeSide)) {
      this.setPrompt("⚔️ Extra Attack Phase! Your standing cards can attack again.");
      if (ABX.fireTurnEvent) ABX.fireTurnEvent("phaseStart", "attack");
      this.renderBattle();
    } else if (this.phase === "attack") {
      this.fireAttackPhaseEnd(this.activeSide);
      this.phase = "final";
      this.setPrompt("🔥 Final Phase: Cast an Impact card to finish the fight, or click End Turn!");
      this.renderBattle();
    } else {
      this.endTurn();
    }
  },

  endTurn() {
    if (this.activeSide === "opp" && (this.opp.isBot || this.mode === "online_p2p")) return;
    const endingSide = this.activeSide;
    this.pendingAction = null;
    this.linkAttackers = [];
    // If the player clicked End Turn directly from Main or Attack Phase without entering Final Phase,
    // fire Final Phase start triggers first so cards that return/come to hand at the start of Final Phase still trigger!
    if (this.phase !== "final") {
      if (this.phase === "attack") this.fireAttackPhaseEnd(endingSide);
      this.phase = "final";
    }
    if (this.imTurnEnd) this.imTurnEnd(endingSide);
    if (window.ABX && ABX.fireTurnEvent) ABX.fireTurnEvent("turnEnd", null, endingSide);
    let nextSide = endingSide === "plr" ? "opp" : "plr";
    // "After this turn, you get another turn" (ABX)
    if (window.ABX && ABX.takeExtraTurn && ABX.takeExtraTurn(this.activeSide)) {
      nextSide = this.activeSide;
      this.turnCount++;
      this.showCutin("EXTRA TURN!", `${this.getFighter(nextSide).name} takes another turn!`, null);
      this.startTurn(nextSide);
      return;
    }
    this.turnCount++;
    if (this.mode === "online_p2p") {
      // Online: hand the turn over and let the friend's device run its own Start Phase,
      // so their draw happens (and is synced) on their side instead of racing an animation here.
      this.activeSide = nextSide;
      this.phase = "start";
      this.setPrompt("⏳ Waiting for Online Friend's move...");
      this.renderBattle();
      this.sendOnlineStateToPeer(`🔄 Turn ${this.turnCount}: YOUR TURN!`, null, { beginTurn: true });
      return;
    }
    this.startTurn(nextSide);
  },

  startChargeMode() {
    // Ignore the button during the bot's / online friend's turn (it used to act on the opponent's hand).
    if (!this.isLocalTurn()) return;
    const f = this.getFighter(this.activeSide);
    if (this.phase !== "main") {
      alert("You can only Charge & Draw during your Main Phase!");
      return;
    }
    if (f.chargedThisTurn) {
      alert("You already used Charge & Draw this turn!");
      return;
    }
    if (f.hand.length === 0) {
      alert("Your hand is empty!");
      return;
    }
    this.pendingAction = { type: "charge" };
    this.setPrompt("⚡ CHARGE & DRAW: Click a card in your hand to fly it into your Gauge and draw 1 card!");
  },

  executeChargeAndDraw(side, handIdx, onDone = null) {
    const f = this.getFighter(side);
    if (f.chargedThisTurn) return;
    const cid = f.hand.splice(handIdx, 1)[0];
    const c = CARD_MAP.get(cid);
    f.chargedThisTurn = true;
    this.pendingAction = null;
    this.renderBattle();

    const fromId = side === "plr" ? "bt-plr-hand" : "hud-opp-target";
    const gaugeId = side === "plr" ? "z-plr-gauge" : "z-opp-gauge";

    this.animateCardFlight(fromId, gaugeId, c ? c.img : "Sprite/Sleeves/s0.png", "⚡ CHARGE TO GAUGE", 90, () => {
      f.gauge.push(cid);
      this.renderBattle();
      this.drawCardsWithAnimation(side, 1, () => {
        this.setPrompt(`⚡ Charged "${c ? c.name : "card"}" to Gauge and drew 1 card!`);
        if (onDone) onDone();
      });
    });
  },

  startLinkAttackMode() {
    if (!this.isLocalTurn()) return;
    if (this.isFirstRoundAttackLocked()) {
      alert("🚫 First Round Rule: you already used your 1 attack on Turn 1!");
      return;
    }
    const f = this.getFighter(this.activeSide);

    if (this.pendingAction && this.pendingAction.type === "link_select") {
      this.pendingAction = null;
      this.linkAttackers = [];
      this.setPrompt("Cancelled Link Attack selection.");
      this.renderBattle();
      return;
    }

    const readyZones = MONSTER_POSITIONS.filter(p => f.monsters[p] && !f.monsters[p].rested && f.monsters[p].attacksLeft > 0);
    const canItemLink = f.item && !f.item.rested && f.item.attacksLeft > 0 && (!f.monsters.center || f.item.isEndrulerFlag || (f.item.card.skill || "").toLowerCase().includes("even if you have a monster in the center") || !!(window.ABX && ABX.canAttackThrough && ABX.canAttackThrough(this.activeSide, f.item, "own")));
    if (canItemLink) readyZones.push("item");

    if (readyZones.length < 2) {
      alert("Link Attack requires at least 2 standing Monsters (or Monster + Item/Endruler Flag when allowed) ready to attack!");
      return;
    }

    // Move to the Attack Phase only once the Link Attack can really start
    // (before, a failed attempt left you stuck in the Attack Phase, unable to call monsters).
    // Stay in the Main Phase while picking link attackers: the Attack Phase starts when the attack is
    // declared (initiateAttackWithDefenseCheck). Cancelling therefore never leaves you stuck in the Attack Phase.
    this.linkAttackers = [];
    this.pendingAction = { type: "link_select" };
    this.setPrompt("🔗 LINK ATTACK: Click 2 or more of your standing Monsters/Item to link them together, then click an Enemy Target to strike with combined Power!");
    this.renderBattle();
  },

  toggleLinkAttackerZone(side, zonePos) {
    const f = this.getFighter(side);
    const unit = unitAt(f, zonePos);
    if (!unit || unit.rested || unit.attacksLeft <= 0) return;

    if ((zonePos === "item" || zonePos === "item2") && f.monsters.center && !unit.isEndrulerFlag && !(unit.card.skill || "").toLowerCase().includes("even if you have a monster in the center") && !(window.ABX && ABX.canAttackThrough && ABX.canAttackThrough(side, unit, "own"))) {
      alert("Your equipped Item cannot join a Link Attack while you have a monster in your Center zone!");
      return;
    }

    const idx = this.linkAttackers.indexOf(zonePos);
    if (idx !== -1) {
      this.linkAttackers.splice(idx, 1);
    } else {
      this.linkAttackers.push(zonePos);
    }

    const totalPow = this.linkAttackers.reduce((sum, zp) => {
      const u = unitAt(f, zp);
      return sum + (u ? getUnitEffectiveCombatStats(f, u).power : 0);
    }, 0);

    this.setPrompt(`🔗 LINK ATTACK (${this.linkAttackers.length} Linked • Combined Power: ${totalPow}): Click more friendly units to add, or click an Enemy Target to strike!`);
    this.renderBattle();
  },

  // Hotseat shows ONE hand on the shared screen: the active player's. "Peek" shows the waiting player's hand instead
  // (for the opponent's-turn [Counter] button); it only lasts for the current turn.
  handViewSide() {
    if (this.mode !== "hotseat") return "plr";
    const peeking = this.hotseatPeek === `${this.activeSide}:${this.turnCount}`;
    return peeking ? (this.activeSide === "opp" ? "plr" : "opp") : this.activeSide;
  },
  togglePeekHand() {
    const key = `${this.activeSide}:${this.turnCount}`;
    this.hotseatPeek = this.hotseatPeek === key ? null : key;
    this.renderBattle();
  },

  onHandCardClick(handIdx) {
    // Not your turn (bot / online friend / match over): you can still open your own hand cards to read their skill,
    // but the banner is read-only (openCardBanner only adds action buttons on a local turn).
    const localTurn = this.isLocalTurn();
    const side = this.mode === "hotseat" ? this.handViewSide() : (localTurn ? this.activeSide : "plr");
    const f = this.getFighter(side);
    const cid = f.hand[handIdx];
    const c = CARD_MAP.get(cid);
    if (!c) return;

    if (localTurn && side === this.activeSide && this.pendingAction && this.pendingAction.type === "charge") {
      this.executeChargeAndDraw(side, handIdx);
      return;
    }

    this.openCardBanner({
      card: c,
      context: "hand",
      side,
      handIdx
    });
  },

  openCardBanner({ card, context, side, handIdx, zonePos, unit, showCombinedYamigedo = false }) {
    const f = this.getFighter(side || "plr");
    const enemy = this.getEnemy(side || "plr");
    const cost = parseCardCost(card.cost, card.skill, f, card);
    const cond = evaluateCardConditions(card, f, enemy);

    const isCombinedYami = (showCombinedYamigedo || context === "field") && isYamigedoHalfId(card.id);
    const bnrArtWrap = document.getElementById("bnr-art-wrap");
    if (bnrArtWrap) {
      if (isCombinedYami) {
        bnrArtWrap.innerHTML = renderYamigedoDualStackHtml();
      } else {
        bnrArtWrap.innerHTML = `<img id="bnr-img" src="${card.img}" alt="Card" />`;
      }
    }
    document.getElementById("bnr-world").textContent = `${card.world} • ${card.type}`;

    const condEl = document.getElementById("bnr-cond-status");
    condEl.textContent = cond.summary;
    condEl.classList.toggle("unmet", !cond.met);

    document.getElementById("bnr-name").textContent = isCombinedYami ? getBuddyDisplayName(card) : card.name;

    let statsStr = "";
    if (card.type === "Monster" || (unit && unit.isEndrulerFlag)) {
      const eff = unit ? getUnitEffectiveCombatStats(f, unit) : { power: card.power, defense: card.defense, crit: card.crit };
      const effSz = card.type === "Monster" ? getEffectiveCardSize(f, card) : "-";
      statsStr = `Size: ${effSz}  |  Power: ${eff.power}  |  Critical: ${eff.crit}  |  Defense: ${eff.defense}  |  Attacks: ${unit ? unit.attacksLeft : (card.atk_max || 1)}`;
      if (unit && unit.soul && unit.soul.length) statsStr += `  |  Soul: ${unit.soul.length}`;
    } else if (card.type === "Item") {
      const eff = unit ? getUnitEffectiveCombatStats(f, unit) : { power: card.power || 0, defense: card.defense || 0, crit: card.crit || 0 };
      statsStr = `Item  |  Power: ${eff.power}  |  Critical: ${eff.crit} ${eff.defense ? " | Defense: " + eff.defense : ""}`;
      if (unit && unit.soul && unit.soul.length) statsStr += `  |  Soul: ${unit.soul.length}`;
    } else if (card.type === "Flag") {
      const cfg = getFlagConfig(card);
      statsStr = cfg.ruleSummary;
      if (card.power !== null && card.power !== undefined) {
        statsStr += `  |  Power: ${card.power}  |  Critical: ${card.crit}  |  Defense: ${card.defense}`;
      }
    } else {
      statsStr = `${card.type}  ${cost.gauge ? "|  Cost: " + cost.gauge + " Gauge" : ""}`;
      const setSoul = (unit && unit.soul && unit.soul.length) ? unit.soul.length : (card.soul && card.soul.length ? card.soul.length : 0);
      if (setSoul > 0) statsStr += `  |  Soul: ${setSoul}`;
    }
    if (card.attrs && card.attrs.length) {
      statsStr += `  •  «${card.attrs.map(formatTribeDisplayName).join("» «")}»`;
    }
    document.getElementById("bnr-stats").textContent = statsStr;

    const kwEl = document.getElementById("bnr-kw");
    kwEl.innerHTML = (card.kw || []).map(k => {
      const isSpec = ["Overturn", "Overkill", "Overkill:REBOOT", "Overthrow"].includes(k);
      return `<span class="kw-tag ${isSpec ? "special" : ""}">${k === "Lifelink" && card.ll ? "Lifelink " + card.ll : k}</span>`;
    }).join("");

    document.getElementById("bnr-world").textContent = `${tWorld(card.world)} • ${tType(card.type)}`;
    document.getElementById("bnr-skill").textContent = translateCardSkillToThai(card.skill, card);

    const actionsEl = document.getElementById("bnr-actions");
    actionsEl.innerHTML = "";

    // Opponent's turn: a hand [Counter] spell that is not an attack-nullifier (destroy / draw / call / life / gauge ...)
    // can be cast from here, as long as no defense prompt is open. Attack-nullifiers stay in the defense window.
    if (context === "hand" && side !== this.activeSide && !this.matchOver && !this.pendingDefenseContext
        && this.mode !== "online_p2p" && window.ABX && ABX.freeCounterOption && ABX.freeCounterOption(side, card)) {
      const bCounter = document.createElement("button");
      bCounter.className = "primary-cta-btn";
      bCounter.textContent = "⚡ Counter";
      bCounter.onclick = () => {
        this.closeCardBanner();
        ABX.castFreeCounter(side, card).then(() => { if (!this.matchOver) this.renderBattle(); });
      };
      actionsEl.appendChild(bCounter);
    }

    // Opponent's turn: a monster / item on my field whose [Counter] [Act] does not need an attack can be used from here.
    if (context === "field" && unit && side !== this.activeSide && !this.matchOver && !this.pendingDefenseContext
        && !f.isBot && this.mode !== "online_p2p"
        && window.ABX && ABX.freeFieldCounterOptions) {
      ABX.freeFieldCounterOptions(side).filter(o => o.unit === unit).forEach(o => {
        const b = document.createElement("button");
        b.className = "primary-cta-btn";
        b.textContent = `⚡ [Counter] ${o.sub ? o.sub.slice(0, 70) : card.name}`;
        b.onclick = () => {
          this.closeCardBanner();
          ABX.useFreeFieldCounter(side, o.key).then(() => { if (!this.matchOver) this.renderBattle(); });
        };
        actionsEl.appendChild(b);
      });
    }

    if (context === "hand" && side === this.activeSide && this.isLocalTurn()) {
      if (this.phase === "main" && !f.chargedThisTurn) {
        const bCharge = document.createElement("button");
        bCharge.className = "action-btn";
        bCharge.textContent = "⚡ Charge & Draw";
        bCharge.onclick = () => {
          this.closeCardBanner();
          this.executeChargeAndDraw(side, handIdx);
        };
        actionsEl.appendChild(bCharge);
      }

      if ([4569, 5760].includes(card.id) && !f.isLostWorldActive) {
        const bLost = document.createElement("button");
        bLost.className = "primary-cta-btn";
        bLost.textContent = "🌌 Activate Belost! (Switch Flag & Deck to Lost World)";
        bLost.onclick = () => {
          this.closeCardBanner();
          this.executeLostWorldBelost(side, handIdx);
        };
        actionsEl.appendChild(bLost);
      }

      // Overgod "0" (#6202) in hand!
      if (card.id === 6202) {
        const canOvergod = f.godclock && f.godclock.awakened && !f.godclock.overgodActive;
        const bOver = document.createElement("button");
        bOver.className = "primary-cta-btn";
        bOver.disabled = !canOvergod;
        bOver.textContent = canOvergod
          ? "👑 [Act] [Reversal] Endruler Dragon ➔ Place Overgod, \"0\" on Top of All Flags!"
          : "🔒 Requires All 4 Godclock Cards Flipped (Endruler Dragon) First!";
        bOver.onclick = () => {
          this.closeCardBanner();
          this.activateOvergodZeroFromHand(side, handIdx);
        };
        actionsEl.appendChild(bOver);
      }

      if (card.type === "Monster" && this.phase === "main") {
        const isYami = isYamigedoHalfId(card.id);
        const hasBothYami = !isYami || fighterHasBothYamigedoHalvesInHand(f);
        const effSz = getEffectiveCardSize(f, card);
        const maxAllowed = f.maxSize || 3;
        const sizeFitsFlag = effSz <= maxAllowed;
        const maxLabel = maxAllowed >= 1e9 ? "∞" : maxAllowed;
        const bCall = document.createElement("button");
        bCall.className = "primary-cta-btn";
        bCall.disabled = !sizeFitsFlag || (isYami && !hasBothYami);
        bCall.textContent = !sizeFitsFlag
          ? `🔒 Size ${effSz} Exceeds Flag Limit (Max Size ${maxLabel})`
          : isYami
          ? (hasBothYami
            ? `🐉 Call Connected Hyakugan Yamigedo (Both Halves • ${cost.gauge} Gauge • Size ${effSz})`
            : `🔒 Requires Both "Earth Half" & "Sky Half" in Hand (or Call by Ability)`)
          : `🐉 Call Monster (${cost.gauge} Gauge • Size ${effSz})`;
        bCall.onclick = () => {
          if (!sizeFitsFlag) return;
          this.closeCardBanner();
          this.startMonsterCall(side, handIdx, false);
        };
        actionsEl.appendChild(bCall);

        if (canFighterBuddyCallCard(f, card.id)) {
          const bBuddy = document.createElement("button");
          bBuddy.className = "primary-cta-btn";
          bBuddy.disabled = !sizeFitsFlag;
          bBuddy.textContent = !sizeFitsFlag
            ? `🔒 Buddy Call Locked (Size ${effSz} > Flag Max ${maxLabel})`
            : isYami
            ? `🌟 BUDDY CALL CONNECTED HYAKUGAN YAMIGEDO! (+1 Life)`
            : `🌟 BUDDY CALL! (+1 Life)`;
          bBuddy.onclick = () => {
            if (!sizeFitsFlag) return;
            this.closeCardBanner();
            this.startMonsterCall(side, handIdx, true);
          };
          actionsEl.appendChild(bBuddy);
        }

        if (card.tr || card.ride || card.st) {
          const modeLabel = card.tr ? "Transform" : card.ride ? "Ride" : "Station";
          const bTr = document.createElement("button");
          bTr.className = "action-btn";
          bTr.textContent = `✨ [${modeLabel}] Equip`;
          bTr.onclick = () => {
            this.closeCardBanner();
            this.equipCardFromHand(side, handIdx, modeLabel);
          };
          actionsEl.appendChild(bTr);
        }
      }

      // Hand [Act] abilities (e.g. Time General Tubocas #5937 drop from hand to gain 3 life, Duel Sieger SD #1595, etc.)
      const sLow = (card.skill || "").toLowerCase();
      // ABX hand [Act]s on your own turn (discard this card / put this hand card into a soul / call this card from your hand)
      const abxHandActs = (window.ABX && ABX.handUseActs) ? ABX.handUseActs(card) : [];
      if (abxHandActs.length && side === this.activeSide && this.isLocalTurn() && !this.pendingDefenseContext) {
        abxHandActs.forEach(ab => {
          const chk = ABX.canUseHandAct(side, handIdx, ab);
          const b = document.createElement("button");
          b.className = "action-btn";
          const label = ab.name ? `"${ab.name}"` : (ab.cleaned || "").replace(/^(?:\[[^\]]+\]\s*)+/, "").slice(0, 60);
          b.textContent = chk.ok ? `✨ Use from Hand: ${label}` : `🔒 ${label} — ${chk.reason}`;
          b.disabled = !chk.ok;
          b.onclick = () => {
            if (!chk.ok) return;
            this.closeCardBanner();
            ABX.runHandUse(side, handIdx, ab, () => this.renderBattle());
          };
          actionsEl.appendChild(b);
        });
      }
      if (!abxHandActs.length && card.type === "Monster" && (sLow.includes("drop this card from hand") || sLow.includes("drop this card from your hand") || sLow.includes("discard this card from your hand"))) {
        const bHandAct = document.createElement("button");
        bHandAct.className = "action-btn";
        bHandAct.textContent = `✨ Use Hand [Act] (Discard "${card.name}")`;
        bHandAct.onclick = () => {
          this.closeCardBanner();
          this.executeHandDiscardAbility(side, handIdx);
        };
        actionsEl.appendChild(bHandAct);
      }

      if (card.type === "Item" && this.phase === "main") {
        const bEq = document.createElement("button");
        bEq.className = "primary-cta-btn";
        const relSt = getReleaseConditionStatus(card, f);
        const onlyBy = equipOnlyByAbility(card);
        if (onlyBy) { relSt.met = false; relSt.reasons = [`Only by the ability of ${onlyBy}`]; }
        bEq.textContent = relSt.met ? `🗡️ Equip Item (${cost.gauge} Gauge)` : `🔒 ${relSt.reasons[0]}`;
        bEq.disabled = !relSt.met;
        bEq.onclick = () => {
          if (!relSt.met) return;
          this.closeCardBanner();
          this.equipCardFromHand(side, handIdx, "Equip");
        };
        actionsEl.appendChild(bEq);
      }

      if (card.type === "Spell") {
        const bCast = document.createElement("button");
        bCast.className = "primary-cta-btn";
        bCast.textContent = card.set ? `🔮 Cast & [Set] (${cost.gauge} Gauge)` : `✨ Cast Spell (${cost.gauge} Gauge)`;
        bCast.onclick = () => {
          this.closeCardBanner();
          this.castSpellFromHand(side, handIdx);
        };
        actionsEl.appendChild(bCast);
      }

      if (window.IMX && IMX.isImpactMonster(card)) {
        // IMPACT MONSTER: called (not cast). Final Phase only, one per turn, has Size/Power/Defense/Critical and stays on the field.
        const imInfo = this.imCallInfo(side, card);
        const bIm = document.createElement("button");
        bIm.className = "primary-cta-btn";
        bIm.disabled = !imInfo.ok;
        const imd = imInfo.data;
        bIm.textContent = imInfo.ok
          ? `💥 Call Impact Monster (${imd.call.gauge} Gauge • Size ${getEffectiveCardSize(f, card)}${imd.call.parts.length ? " • +extra cost" : ""})`
          : `🔒 ${imInfo.reasons[0]}`;
        bIm.title = imInfo.reasons.join("\n");
        bIm.onclick = () => {
          this.closeCardBanner();
          this.startImpactMonsterCall(side, handIdx);
        };
        actionsEl.appendChild(bIm);
        if (imd && imd.impactTransform) {
          const tInfo = this.imTransformInfo(side, card);
          const bTr = document.createElement("button");
          bTr.className = "action-btn";
          bTr.disabled = !tInfo.ok;
          bTr.textContent = tInfo.ok ? `✨ [Impact Transform] (${imd.impactTransform.cost.gauge} Gauge)` : `🔒 [Impact Transform] ${tInfo.reasons[0]}`;
          bTr.onclick = () => { this.closeCardBanner(); this.imStartTransform(side, handIdx); };
          actionsEl.appendChild(bTr);
        }
      } else if (card.type === "Impact" && card.id !== 6202) {
        const bImp = document.createElement("button");
        bImp.className = "primary-cta-btn";
        bImp.disabled = this.phase !== "final";
        bImp.textContent = this.phase === "final"
          ? `💥 Cast Impact (${cost.gauge} Gauge)`
          : `🔒 Impact — Final Phase Only (${cost.gauge} Gauge)`;
        bImp.onclick = () => {
          this.closeCardBanner();
          this.castImpactFromHand(side, handIdx);
        };
        actionsEl.appendChild(bImp);
      }
    } else if (context === "field" && side === this.activeSide && this.isLocalTurn() && unit) {
      if (window.IMX && IMX.isUnit(unit)) this.imAppendActButtons(actionsEl, side, unit);
      if ((this.phase === "attack" || this.phase === "main" || (this.phase === "final" && this.imCanAttackInFinal(unit))) && unit.attacksLeft > 0 && !unit.rested) {
        const bAtk = document.createElement("button");
        bAtk.className = "primary-cta-btn";
        const firstRoundLocked = this.isFirstRoundAttackLocked();
        bAtk.disabled = firstRoundLocked;
        const isEndrulerSolo = unit.isEndrulerFlag && !unit.isOvergodZero;
        bAtk.textContent = firstRoundLocked
          ? `🚫 First Round: your 1 attack is already used`
          : isEndrulerSolo
          ? `⚔️ Solo Attack with Endruler Dragon ("Eternal Eon" — Stops Opponent's Time!)`
          : `⚔️ Solo Attack with "${card.name}"`;
        bAtk.onclick = () => {
          this.closeCardBanner();
          if (this.isFirstRoundAttackLocked()) return;
          this.startAttackSelection(side, zonePos); // switches to the Attack Phase once the attack is allowed
        };
        actionsEl.appendChild(bAtk);

        if (!firstRoundLocked) {
          const bLink = document.createElement("button");
          bLink.className = "action-btn";
          bLink.textContent = `🔗 Start Link Attack with "${card.name}"`;
          bLink.onclick = () => {
            this.closeCardBanner();
            // Phase switches to Attack only when the attack is declared (see initiateAttackWithDefenseCheck).
            this.linkAttackers = [zonePos];
            this.pendingAction = { type: "link_select" };
            this.setPrompt(`🔗 LINK ATTACK started with "${card.name}": Click another standing Monster/Item on your field to link, then click an Enemy Target!`);
            this.renderBattle();
          };
          actionsEl.appendChild(bLink);
        }
      }

      // Special buttons for Perfected Deity of Eon, The Endruler Dragon & Overgod, "0"
      if (unit.isEndrulerFlag) {
        if (unit.isOvergodZero) {
          const bEon = document.createElement("button");
          bEon.className = "primary-cta-btn";
          bEon.textContent = `🔥 [Act] "Eternal Eon" (Reduce All Enemy Def to 0 & Stop Opponent's Time!)`;
          bEon.onclick = () => {
            this.closeCardBanner();
            this.activateOvergodEternalEon(side);
          };
          actionsEl.appendChild(bEon);
        } else if (f.hand.includes(6202)) {
          const bOver = document.createElement("button");
          bOver.className = "primary-cta-btn";
          bOver.textContent = `👑 [Act] [Reversal] Endruler Dragon ➔ Place Overgod, "0" (#6202) on Flag!`;
          bOver.onclick = () => {
            this.closeCardBanner();
            this.activateOvergodZeroFromHand(side, f.hand.indexOf(6202));
          };
          actionsEl.appendChild(bOver);
        }

        const bBoard = document.createElement("button");
        bBoard.className = "action-btn";
        bBoard.textContent = `⏳ View 2x2 Connected Godclock Board`;
        bBoard.onclick = () => {
          this.closeCardBanner();
          this.openGodclockModal();
        };
        actionsEl.appendChild(bBoard);
      }

      if (canUseMove(side, unit) && zonePos !== "item") {
        const openZones = ["left", "center", "right"].filter(p => !f.monsters[p]);
        if (openZones.length > 0) {
          const bMove = document.createElement("button");
          bMove.className = "action-btn";
          bMove.textContent = `💨 Use [Move] (to ${openZones.map(z => z.toUpperCase()).join(" / ")})`;
          bMove.onclick = () => {
            this.closeCardBanner();
            this.pendingAction = { type: "move", fromPos: zonePos };
            this.setPrompt(`💨 [Move]: Click an open Monster Zone (${openZones.map(z => z.toUpperCase()).join(", ")}) to move "${card.name}"!`);
            this.renderBattle();
          };
          actionsEl.appendChild(bMove);
        }
      }

      if (card.cnz && zonePos !== "item" && this.phase === "main" && this.isLocalTurn()) {
        const cnzTargets = this.getValidCrossnizeTargets(f, unit);
        const bCnz = document.createElement("button");
        bCnz.className = "action-btn";
        bCnz.disabled = cnzTargets.length === 0;
        bCnz.textContent = cnzTargets.length > 0
          ? `✨ Use [Crossnize] (Put into ${cnzTargets.length === 1 ? `"${f.monsters[cnzTargets[0]].card.name}"'s` : "a «Neodragon»'s"} Soul)`
          : `🔒 [Crossnize] — Requires a «Neodragon» on your field`;
        bCnz.onclick = () => {
          if (cnzTargets.length === 0) return;
          this.closeCardBanner();
          this.startCrossnizeMode(side, zonePos);
        };
        actionsEl.appendChild(bCnz);
      }

      const abxActs = (window.ABX && ABX.actAbilities) ? ABX.actAbilities(card).filter(a => !ABX.canUseAct || ABX.canUseAct(side, card, a, unit).reason !== "Timing / condition not met") : [];
      if (!unit.isEndrulerFlag && (card.act || abxActs.length || ((parseDeckSearchCriteria(card) || (card.skill || "").toLowerCase().includes("you may")) && !abxOwnsOptionalLines(card))) && !unit.actUsed) {
        const bAct = document.createElement("button");
        bAct.className = "action-btn";
        bAct.textContent = `✨ Use Card Ability / [Act]`;
        bAct.onclick = () => {
          this.closeCardBanner();
          if (abxActs.length) { ABX.useAct(side, card, unit); return; }
          this.promptOptionalAbility(side, card, unit);
        };
        actionsEl.appendChild(bAct);
      }

      // [Act]s of cards in this card's soul ("Call this card from the soul of a «Neodragon»")
      if (window.ABX && ABX.soulActs && side === this.activeSide && this.isLocalTurn()) {
        ABX.soulActs(side, unit).forEach(sa => {
          const ok = ABX.canUseSoulAct(side, unit, sa.card, sa.ab);
          const bSoul = document.createElement("button");
          bSoul.className = "action-btn";
          bSoul.textContent = `${ok ? "✨" : "🔒"} Soul [Act]: "${sa.card.name}"`;
          bSoul.disabled = !ok;
          bSoul.onclick = () => { this.closeCardBanner(); ABX.useSoulAct(side, unit, sa.card, sa.ab); };
          actionsEl.appendChild(bSoul);
        });
      }

      if ((card.ot || card.ok || card.oth) && !f.overturnUsed && !(window.ABX && ABX.actAbilities && ABX.actAbilities(card).some(a => (a.tags || []).some(t => /^kw:(overturn|overkill|overthrow)/.test(t))))) {
        const tag = card.ot ? "Overturn" : card.ok ? "Overkill" : "Overthrow";
        const bSpec = document.createElement("button");
        bSpec.className = "primary-cta-btn";
        bSpec.textContent = `🔥 Unleash [${tag}]!`;
        bSpec.onclick = () => {
          this.closeCardBanner();
          this.triggerUnitOverturn(side, unit, tag);
        };
        actionsEl.appendChild(bSpec);
      }
    } else if (context === "set") {
      const setHost = unit || card;
      if (side === this.activeSide && this.isLocalTurn()) {
        const abxActs = (window.ABX && ABX.actAbilities) ? ABX.actAbilities(card).filter(a => !ABX.canUseAct || ABX.canUseAct(side, card, a, setHost).reason !== "Timing / condition not met") : [];
        if (abxActs.length > 0 || card.act) {
          const bSetAct = document.createElement("button");
          bSetAct.className = "primary-cta-btn";
          bSetAct.textContent = `✨ Use [Set] Card Ability / [Act]`;
          bSetAct.onclick = () => {
            this.closeCardBanner();
            if (abxActs.length > 0) {
              ABX.useAct(side, card, setHost);
            } else {
              this.promptOptionalAbility(side, card, null);
            }
          };
          actionsEl.appendChild(bSetAct);
        }
      }
      // Opponent's turn: a [Set] spell on my field whose [Counter] [Act] does not need an attack can be used from here.
      if (side !== this.activeSide && !this.matchOver && !this.pendingDefenseContext
          && !f.isBot && this.mode !== "online_p2p"
          && window.ABX && ABX.freeFieldCounterOptions) {
        ABX.freeFieldCounterOptions(side).filter(o => o.area === "set" && o.card === card).forEach(o => {
          const b = document.createElement("button");
          b.className = "primary-cta-btn";
          b.textContent = `⚡ [Counter] ${o.sub ? o.sub.slice(0, 70) : card.name}`;
          b.onclick = () => {
            this.closeCardBanner();
            ABX.useFreeFieldCounter(side, o.key).then(() => { if (!this.matchOver) this.renderBattle(); });
          };
          actionsEl.appendChild(b);
        });
      }
      const bBackSet = document.createElement("button");
      bBackSet.className = "action-btn";
      bBackSet.textContent = `🔮 Back to [Set] Zone List (${f.setSpells.length})`;
      bBackSet.onclick = () => {
        this.closeCardBanner();
        this.openSetZoneViewer(side || "plr");
      };
      actionsEl.appendChild(bBackSet);
    } else if (context === "soul") {
      const hostUnit = unit && unit.hostUnit;
      const hostZonePos = unit && unit.hostZonePos;
      if (hostUnit && side === this.activeSide && this.isLocalTurn() && window.ABX && ABX.soulActs) {
        const matchingActs = ABX.soulActs(side, hostUnit).filter(sa => sa.card && sa.card.id === card.id);
        matchingActs.forEach(sa => {
          const ok = ABX.canUseSoulAct(side, hostUnit, sa.card, sa.ab);
          const bSoulAct = document.createElement("button");
          bSoulAct.className = "primary-cta-btn";
          bSoulAct.disabled = !ok;
          bSoulAct.textContent = `${ok ? "✨" : "🔒"} Activate Soul [Act]: "${sa.card.name}"`;
          bSoulAct.onclick = () => {
            this.closeCardBanner();
            ABX.useSoulAct(side, hostUnit, sa.card, sa.ab);
          };
          actionsEl.appendChild(bSoulAct);
        });
      }
      if (hostUnit) {
        const bBackSoul = document.createElement("button");
        bBackSoul.className = "action-btn";
        const hostName = (hostUnit.card && hostUnit.card.name) || hostUnit.name || "Card";
        bBackSoul.textContent = `🟣 Back to "${hostName}"'s Soul (${(hostUnit.soul || []).length})`;
        bBackSoul.onclick = () => {
          this.closeCardBanner();
          this.openSoulViewer(side || "plr", hostUnit, hostZonePos);
        };
        actionsEl.appendChild(bBackSoul);
      }
    } else if (context === "drop") {
      // Cards in the Drop Zone can only be moved by a card ability, so this view is read-only.
      const bBackDrop = document.createElement("button");
      bBackDrop.className = "action-btn";
      bBackDrop.textContent = `📂 Back to Drop Zone List (${f.drop.length})`;
      bBackDrop.onclick = () => {
        this.closeCardBanner();
        this.openDropZoneViewer(side);
      };
      actionsEl.appendChild(bBackDrop);
    } else if (context === "endruler_preview") {
      const bBackGc = document.createElement("button");
      bBackGc.className = "primary-cta-btn";
      bBackGc.textContent = "⏳ Back to 2x2 Connected Godclock Board";
      bBackGc.onclick = () => {
        this.closeCardBanner();
        this.openGodclockModal();
      };
      actionsEl.appendChild(bBackGc);
    }

    // Universal Soul Inspector button whenever the inspected field/set card has Soul cards!
    const soulHostObj = (unit && Array.isArray(unit.soul) && unit.soul.length > 0)
      ? unit
      : (card && Array.isArray(card.soul) && card.soul.length > 0 ? { card, soul: card.soul, isSetCard: true } : null);
    if (soulHostObj && context !== "soul") {
      const bInspectSoul = document.createElement("button");
      bInspectSoul.className = "action-btn";
      bInspectSoul.textContent = `🟣 Inspect Soul (${soulHostObj.soul.length} Card${soulHostObj.soul.length === 1 ? "" : "s"})`;
      bInspectSoul.onclick = () => {
        this.closeCardBanner();
        this.openSoulViewer(side || "plr", soulHostObj, zonePos);
      };
      actionsEl.appendChild(bInspectSoul);
    }

    // Universal Equipped Items & Flag Inspector button when inspecting the Item/Flag area
    const eqItems = getEquippedItems(f);
    if ((zonePos === "item" || zonePos === "item2" || (context === "view" && card.type === "Flag")) && (eqItems.length > 0 || (f.flagUnder && f.flagUnder.length > 0))) {
      const bInspectItems = document.createElement("button");
      bInspectItems.className = "action-btn";
      bInspectItems.textContent = `🗡️ Inspect Equipped Items & Flag (${eqItems.length} Item${eqItems.length === 1 ? "" : "s"})`;
      bInspectItems.onclick = () => {
        this.closeCardBanner();
        this.openItemZoneViewer(side || "plr");
      };
      actionsEl.appendChild(bInspectItems);
    }

    const bClose = document.createElement("button");
    bClose.className = "secondary-btn";
    bClose.textContent = "Close Banner";
    bClose.onclick = () => this.closeCardBanner();
    actionsEl.appendChild(bClose);

    document.getElementById("card-detail-banner").classList.remove("hidden");
  },

  executeHandDiscardAbility(side, handIdx) {
    const f = this.getFighter(side);
    const cid = f.hand.splice(handIdx, 1)[0];
    const c = CARD_MAP.get(cid);
    if (!c) return;
    f.drop.push(cid);
    this.executeCardAbilityEffect(side, c, null);
  },

  closeCardBanner() {
    document.getElementById("card-detail-banner").classList.add("hidden");
    ["bnr-nav-prev", "bnr-nav-next"].forEach(id => { const b = document.getElementById(id); if (b) b.classList.add("hidden"); });
  },

  showBannerForZone(side, zoneType) {
    const f = this.getFighter(side);
    if (zoneType === "drop") {
      this.openDropZoneViewer(side);
      return;
    }
    if (zoneType === "set") {
      this.openSetZoneViewer(side);
      return;
    }
    if (zoneType === "item") {
      this.openItemZoneViewer(side);
      return;
    }
    let c = null;
    if (zoneType === "buddy") c = isYamigedoHalfId(f.buddyId) ? getCanonicalYamigedoCard() : CARD_MAP.get(f.buddyId);
    else if (zoneType === "deck" && side === "plr") {
      this.openDeckMenu();
      return;
    }
    if (c) this.openCardBanner({ card: c, context: "view", side, showCombinedYamigedo: zoneType === "buddy" });
  },

  promptOptionalAbility(side, card, unit = null, onAfterResolve = null) {
    const f = this.getFighter(side);
    if (f.isBot) {
      this.executeCardAbilityEffect(side, card, unit, onAfterResolve);
      return;
    }

    const s = card.skill || "";
    const sLower = s.toLowerCase();

    let optGauge = 0;
    let optLife = 0;
    let optDiscard = 0;
    const payG = sLower.match(/you\s+may\s+(?:\[rest\]\s+this\s+card\s+and\s+|drop\s+a\s+hand\s+card\s+and\s+)?pay\s+(\d+)\s+gauge/i);
    if (payG) optGauge = parseInt(payG[1], 10);
    const payL = sLower.match(/you\s+may\s+pay\s+(\d+)\s+life/i);
    if (payL) optLife = parseInt(payL[1], 10);
    if (sLower.includes("you may discard a") || sLower.includes("you may drop a hand card") || sLower.includes("you may discard one card")) optDiscard = 1;

    let canPayOpt = true;
    let optReason = "✅ Ready to Activate";
    if (f.gauge.length < optGauge) {
      canPayOpt = false;
      optReason = `⚠️ Needs ${optGauge} Gauge for ability`;
    }
    if (f.life <= optLife) {
      canPayOpt = false;
      optReason = `⚠️ Needs >${optLife} Life for ability`;
    }
    if (f.hand.length < optDiscard) {
      canPayOpt = false;
      optReason = `⚠️ Needs ${optDiscard} card in hand to discard`;
    }
    if (sLower.includes("omni lord") && sLower.includes("field") && !fighterHasOmniLordOnField(f)) {
      canPayOpt = false;
      optReason = `⚠️ Requires an [Omni Lord] on your field`;
    }

    const searchCrit = parseDeckSearchCriteria(card);

    document.getElementById("abp-img").src = card.img;
    document.getElementById("abp-pill-tag").textContent = "✨ OPTIONAL CARD ABILITY";
    const badge = document.getElementById("abp-cond-badge");
    badge.textContent = optReason;
    badge.classList.toggle("unmet", !canPayOpt);

    document.getElementById("abp-title").textContent = `Use "${card.name}"'s Ability?`;
    document.getElementById("abp-desc").textContent = searchCrit
      ? (searchCrit.isTopLook
        ? `This ability looks at the top ${searchCrit.topCount} cards of your deck (${searchCrit.rawText})! Would you like to use it now?`
        : `This ability searches your deck${searchCrit.allowDropZone ? " or drop zone" : ""} (${searchCrit.rawText}) and shuffles your deck! Would you like to use it now?`)
      : `Would you like to activate "${card.name}"'s ability (${optGauge ? "Pay " + optGauge + " Gauge" : optLife ? "Pay " + optLife + " Life" : optDiscard ? "Discard 1 Hand Card" : "Free Trigger"})?`;
    document.getElementById("abp-skill").textContent = translateCardSkillToThai(card.skill, card);

    const btnRow = document.getElementById("abp-buttons");
    btnRow.innerHTML = "";

    const bYes = document.createElement("button");
    bYes.className = "primary-cta-btn";
    bYes.disabled = !canPayOpt;
    bYes.textContent = searchCrit
      ? (searchCrit.isTopLook ? `🔍 Yes, Look at Top ${searchCrit.topCount} Cards!` : "🔍 Yes, Search Matching Cards & Shuffle!")
      : "✨ Yes, Activate Ability!";
    bYes.onclick = () => {
      document.getElementById("ability-prompt-modal").classList.add("hidden");
      if (optGauge > 0) {
        for (let i = 0; i < optGauge && f.gauge.length > 0; i++) f.drop.push(f.gauge.pop());
      }
      if (optLife > 0) f.life = Math.max(1, f.life - optLife);
      if (optDiscard > 0 && f.hand.length > 0) {
        f.drop.push(f.hand.pop());
      }
      if (unit) {
        unit.actUsed = true;
        if (sLower.includes("[rest] this card")) unit.rested = true;
      }
      this.executeCardAbilityEffect(side, card, unit, onAfterResolve);
    };
    btnRow.appendChild(bYes);

    const bNo = document.createElement("button");
    bNo.className = "secondary-btn";
    bNo.textContent = "Do Not Use (Skip)";
    bNo.onclick = () => {
      document.getElementById("ability-prompt-modal").classList.add("hidden");
      if (onAfterResolve) onAfterResolve();
    };
    btnRow.appendChild(bNo);

    document.getElementById("ability-prompt-modal").classList.remove("hidden");
  },

  executeCardAbilityEffect(side, card, unit = null, onAfterResolve = null) {
    // A card on the field using its own ability: show the banner (and send it to the online friend).
    if (unit) this.showCutin("ABILITY!", card.name, card.img);
    const f = this.getFighter(side);
    const enemy = this.getEnemy(side);
    const s = card.skill || "";
    const sLower = s.toLowerCase();
    const revCnt = getFighterReversalCount(f);

    const searchCrit = parseDeckSearchCriteria(card);
    if (searchCrit) {
      if (searchCrit.isTopLook) {
        const topCards = f.deck.splice(0, searchCrit.topCount);
        if (topCards.length > 0) {
          if (f.isBot) {
            f.hand.push(topCards.shift());
            if (searchCrit.restAction === "gauge") f.gauge.push(...topCards);
            else if (searchCrit.restAction === "drop") f.drop.push(...topCards);
            else f.deck.push(...topCards);
          } else {
            this.openCustomCardChoiceModal({
              title: `🔍 "${card.name}" — Look at Top ${topCards.length} Cards of Your Deck`,
              subtitle: `${searchCrit.rawText}`,
              cardsList: topCards.map((cid, idx) => ({
                card: CARD_MAP.get(cid),
                badge: `Top #${idx + 1}`,
                payload: idx
              })),
              onSelect: (pickIdx) => {
                const pickedCid = topCards.splice(pickIdx, 1)[0];
                const pickedCard = CARD_MAP.get(pickedCid);
                if (searchCrit.restAction === "gauge" || (revCnt >= 2 && sLower.includes("put the rest into the gauge instead"))) {
                  f.gauge.push(...topCards);
                } else if (searchCrit.restAction === "drop") {
                  f.drop.push(...topCards);
                } else {
                  f.deck.push(...topCards);
                }
                this.animateCardFlight("z-plr-deck", "bt-plr-hand", pickedCard ? pickedCard.img : "Sprite/Sleeves/s0.png", "🃏 ADDED TO HAND!", 0, () => {
                  f.hand.push(pickedCid);
                  this.renderBattle();
                  if (onAfterResolve) onAfterResolve();
                });
              }
            });
            return;
          }
        }
      } else {
        if (!f.isBot) {
          this.openDeckSearchModal(card.name, searchCrit, onAfterResolve);
          return;
        } else if (f.deck.length > 0) {
          const foundIdx = f.deck.findIndex(cid => cardMatchesSearchCriteria(CARD_MAP.get(cid), searchCrit));
          if (foundIdx !== -1) f.hand.push(f.deck.splice(foundIdx, 1)[0]);
          else f.hand.push(f.deck.shift());
          this.shuffleFighterDeck(side);
        }
      }
    }

    const dropCrit = parseDropZoneCriteria(card);
    if ((dropCrit || (sLower.includes("drop zone") && (sLower.includes("into your hand") || sLower.includes("call ") || sLower.includes("into its soul")))) && !searchCrit && f.drop.length > 0) {
      const actionType = dropCrit ? dropCrit.destAction : sLower.includes("call ") ? "call" : sLower.includes("soul") ? "soul" : "hand";
      if (!f.isBot) {
        this.openDropZoneViewer(side, {
          sourceLabel: card.name,
          criteria: dropCrit,
          actionType,
          targetUnit: unit,
          onDone: onAfterResolve
        });
        return;
      } else {
        const recoveredId = f.drop.pop();
        if (actionType === "soul" && unit) {
          unit.soul.push(recoveredId);
        } else {
          f.hand.push(recoveredId);
        }
        this.renderBattle();
      }
    }

    if (sLower.includes("into your gauge") || sLower.includes("into the gauge")) {
      let gCnt = sLower.includes("top three cards") ? 3 : sLower.includes("top two cards") ? 2 : 1;
      if (sLower.includes("for each time your flags [reversal]")) {
        gCnt = Math.max(1, revCnt);
      }
      this.chargeDeckToGaugeWithAnimation(side, gCnt);
    }

    if (sLower.includes("draw a card") || sLower.includes("draw 1 card") || sLower.includes("draw two cards")) {
      // Only "draw two cards" draws 2. (Before, any "two" anywhere in the text, e.g. "two or more", drew 2.)
      let cnt = sLower.includes("draw two cards") ? 2 : 1;
      if (sLower.includes("flags [reversal] two times or more") && revCnt >= 2) cnt += 1;
      this.drawCardsWithAnimation(side, cnt);
    }

    const lMatch = sLower.match(/gain\s+(\d+)\s+life/i);
    if (lMatch) {
      let lGain = parseInt(lMatch[1], 10) || 1;
      if (sLower.includes("for each time your flags [reversal]")) lGain = Math.max(1, revCnt);
      f.life += lGain;
    }

    if (sLower.includes("destroy a") || sLower.includes("destroy all") || sLower.includes("destroy up to one") || sLower.includes("bottom of their deck")) {
      const oppSide = side === "plr" ? "opp" : "plr";
      const toDeck = sLower.includes("bottom of their deck") || sLower.includes("bottom of your opponent");
      // Skip monsters protected by a "cannot be destroyed / leave the field" ability.
      const targets = ["center", "left", "right"].filter(p => enemy.monsters[p] && !this.isEffectProtected(oppSide, p, toDeck ? "put into deck" : "destroyed", side));
      if (targets.length > 0) {
        if (toDeck) {
          const m = enemy.monsters[targets[0]];
          if (m) {
            if (m.soul) enemy.drop.push(...m.soul);
            enemy.deck.push(m.card.id);
            enemy.monsters[targets[0]] = null;
          }
        } else {
          this.destroyMonster(oppSide, targets[0]);
        }
      }
    }

    const dmgMatch = sLower.match(/deal\s+(\d+)\s+damage\s+to\s+your\s+opponent/i);
    if (dmgMatch) {
      enemy.life -= parseInt(dmgMatch[1], 10) || 1;
      this.checkWinCondition();
    }

    const pMatch = s.match(/power\s*\+\s*(\d+)/i);
    const dMatch = s.match(/defense\s*\+\s*(\d+)/i);
    const cMatch = s.match(/critical\s*\+\s*(\d+)/i);
    const grantsCA = sLower.includes("[counterattack]") || sLower.includes("gets counterattack");
    const grantsPen = sLower.includes("gets [penetrate]") || sLower.includes("get [penetrate]");
    const grantsStand = sLower.includes("[stand]");

    if (unit) {
      if (pMatch) unit.tempPower = (unit.tempPower || 0) + parseInt(pMatch[1], 10);
      if (dMatch) unit.tempDef = (unit.tempDef || 0) + parseInt(dMatch[1], 10);
      if (cMatch) unit.tempCrit = (unit.tempCrit || 0) + parseInt(cMatch[1], 10);
      if (grantsCA) unit.tempCA = true;
      if (grantsPen) unit.tempPen = true;
      if (grantsStand && effectStand(unit)) {
        unit.attacksLeft = Math.max(1, (unit.attacksLeft || 0) + 1);
      }
    } else if (pMatch || dMatch || cMatch || grantsCA || grantsPen || grantsStand) {
      MONSTER_POSITIONS.forEach(pos => {
        const m = f.monsters[pos];
        if (m) {
          if (pMatch) m.tempPower = (m.tempPower || 0) + parseInt(pMatch[1], 10);
          if (dMatch) m.tempDef = (m.tempDef || 0) + parseInt(dMatch[1], 10);
          if (cMatch) m.tempCrit = (m.tempCrit || 0) + parseInt(cMatch[1], 10);
          if (grantsCA) m.tempCA = true;
          if (grantsPen) m.tempPen = true;
          if (grantsStand && effectStand(m)) {
            m.attacksLeft = Math.max(1, (m.attacksLeft || 0) + 1);
          }
        }
      });
    }

    if (isYamigedoHalfId(card.id) && sLower.includes("left and right become size 0")) {
      f.hyakuganSizeZeroTurn = true;
      this.setPrompt(`✨ [Evil Deity] "${getBuddyDisplayName(card)}" reduced all Size 2 or less «Hundred Demons» on your field to Size 0 for this turn!`);
      this.renderBattle();
      if (onAfterResolve) onAfterResolve();
      return;
    }

    this.setPrompt(`✨ Activated "${card.name}"'s ability!`);
    this.renderBattle();
    if (onAfterResolve) onAfterResolve();
  },

  openDeckMenu() {
    // Your deck is hidden information: tapping it only shows how many cards are left.
    // Deck searches are opened by card abilities (openDeckSearchModal with criteria).
    const f = this.plr;
    this.setPrompt(`🂠 Your Deck has ${f.deck.length} card(s) left. Cards can only be searched from it by a card ability.`);
  },

  setDeckSearchFiltersEnabled(enabled) {
    ["ds-filter", "ds-tribe", "ds-only-matching"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  },

  openDeckSearchModal(sourceLabel = "Card Ability", criteria = null, onDone = null) {
    this.activeChoice = null;
    this.setDeckSearchFiltersEnabled(true);
    this.deckSearchState = { sourceLabel, criteria, onDone };
    document.getElementById("ds-title").textContent = `🔍 SEARCH YOUR DECK${criteria && criteria.allowDropZone ? " OR DROP ZONE" : ""} (${this.plr.deck.length} Cards) — ${sourceLabel}`;

    let reqDesc = "";
    if (criteria) {
      const parts = [];
      if (criteria.nameSubstrings && criteria.nameSubstrings.length) parts.push(`Name/Words: "${criteria.nameSubstrings.join('" or "')}"`);
      if (criteria.attrSubstrings && criteria.attrSubstrings.length) parts.push(`Tribe: «${criteria.attrSubstrings.join("» / «")}»`);
      if (criteria.wantTypes && criteria.wantTypes.length) parts.push(`Type: ${criteria.wantTypes.join("/")}`);
      if (criteria.requireSet) parts.push(`Keyword: [Set]`);
      if (criteria.requireOmni) parts.push(`Keyword: [Omni Lord]`);
      if (criteria.exactSize !== null) parts.push(`Size: ${criteria.exactSize}`);
      if (criteria.maxSize !== null) parts.push(`Size: ≤${criteria.maxSize}`);
      reqDesc = parts.length > 0 ? `[Filter: ${parts.join(" • ")}] ` : "";
    }

    document.getElementById("ds-subtitle").textContent = criteria && criteria.rawText
      ? `${reqDesc}"${criteria.rawText}" — Select a matching card to add to your hand, then your deck will be shuffled!`
      : `Select a card from your deck to add to your hand, or filter by Name/Tribe, then your deck will be shuffled!`;

    document.getElementById("ds-filter").value = "";
    const tribeSel = document.getElementById("ds-tribe");
    if (tribeSel) tribeSel.value = "";
    const onlyMatchChk = document.getElementById("ds-only-matching");
    if (onlyMatchChk) onlyMatchChk.checked = Boolean(criteria);

    const footerEl = document.getElementById("ds-footer-actions");
    if (footerEl) {
      footerEl.innerHTML = `<button class="action-btn" onclick="battle.shuffleDeckAndClose()">🔀 Shuffle Deck & Close</button>`;
    }
    this.renderDeckSearchGrid();
    document.getElementById("deck-search-modal").classList.remove("hidden");
  },

  renderDeckSearchGrid() {
    if (this.activeChoice) return; // a forced-choice popup is showing; don't replace it
    const q = (document.getElementById("ds-filter").value || "").trim().toLowerCase();
    const qNorm = normalizeSearchToken(q);
    const tribeFilter = (document.getElementById("ds-tribe")?.value || "");
    const onlyMatching = document.getElementById("ds-only-matching")?.checked;
    const criteria = this.deckSearchState ? this.deckSearchState.criteria : null;
    const grid = document.getElementById("ds-grid");
    grid.innerHTML = "";

    const isDropMode = Boolean(this.deckSearchState && this.deckSearchState.isDropZoneMode);
    const isSetMode = Boolean(this.deckSearchState && this.deckSearchState.isSetZoneMode);
    const isItemMode = Boolean(this.deckSearchState && this.deckSearchState.isItemZoneMode);
    const isBuddyMode = Boolean(this.deckSearchState && this.deckSearchState.isBuddyZoneMode);
    const isSoulMode = Boolean(this.deckSearchState && this.deckSearchState.isSoulMode);
    const dropSide = (this.deckSearchState && this.deckSearchState.dropSide) || "plr";
    const dropFighter = this.getFighter(dropSide);

    const combinedPool = [];
    if (isBuddyMode) {
      getFighterBuddyZoneEntries(dropFighter).forEach((entry, idx) => {
        const bc = CARD_MAP.get(entry.id);
        if (!bc) return;
        const inHand = dropFighter.hand.includes(Number(entry.id)) || (isYamigedoHalfId(entry.id) && fighterHasBothYamigedoHalvesInHand(dropFighter));
        combinedPool.push({
          cid: bc.id,
          cardObj: bc,
          buddyEntry: entry,
          zone: "buddy",
          idx,
          badge: entry.isFaceDown
            ? `🂠 FACE-DOWN IN BUDDY ZONE #${idx + 1}`
            : `🌟 BUDDY #${idx + 1} (${entry.rested ? "[Rest] Called" : inHand ? "[Stand] Ready in Hand!" : "[Stand]"})`
        });
      });
    } else if (isSetMode) {
      (dropFighter.setSpells || []).forEach((sp, idx) => {
        if (!sp) return;
        const soulCnt = Array.isArray(sp.soul) ? sp.soul.length : 0;
        combinedPool.push({
          cid: sp.id,
          cardObj: sp,
          zone: "set",
          idx,
          badge: `🔮 [SET] #${idx + 1}${soulCnt ? ` • 🟣 Soul:${soulCnt}` : ""}`
        });
      });
    } else if (isItemMode) {
      getEquippedItems(dropFighter).forEach(({ slot, unit }, idx) => {
        const soulCnt = Array.isArray(unit.soul) ? unit.soul.length : 0;
        combinedPool.push({
          cid: unit.card.id,
          cardObj: unit.card,
          unitObj: unit,
          slotKey: slot,
          zone: "item",
          idx,
          badge: `🗡️ EQUIPPED ITEM #${idx + 1}${soulCnt ? ` • 🟣 Soul:${soulCnt}` : ""}`
        });
      });
      const flagC = CARD_MAP.get(dropFighter.flagId);
      if (flagC) {
        combinedPool.push({
          cid: flagC.id,
          cardObj: flagC,
          zone: "flag",
          idx: 0,
          badge: `🏳️ ACTIVE FLAG`
        });
      }
      (dropFighter.flagUnder || []).forEach((fid, idx) => {
        const fc = CARD_MAP.get(fid);
        if (fc) {
          combinedPool.push({
            cid: fc.id,
            cardObj: fc,
            zone: "flag_under",
            idx,
            badge: `🂠 UNDER FLAG`
          });
        }
      });
    } else if (isSoulMode) {
      const hostUnit = this.deckSearchState.hostUnit;
      const soulArr = (hostUnit && Array.isArray(hostUnit.soul)) ? hostUnit.soul : [];
      const hostCard = (hostUnit && hostUnit.card) || hostUnit;
      const hasSG = Boolean(hostCard && (hostCard.sg || (hostUnit && hostUnit.tempSG)));
      for (let i = soulArr.length - 1; i >= 0; i--) {
        const rawEntry = soulArr[i];
        const faceDownTag = isSoulEntryFaceDown(rawEntry) ? " • 🂠 Face-Down [Ambush]" : "";
        combinedPool.push({
          cid: getSoulCardId(rawEntry),
          soulEntry: rawEntry,
          zone: "soul",
          idx: i,
          badge: `🟣 SOUL #${i + 1}${hasSG ? " [Soulguard]" : ""}${faceDownTag}`
        });
      }
    } else if (isDropMode) {
      for (let i = dropFighter.drop.length - 1; i >= 0; i--) {
        combinedPool.push({ cid: dropFighter.drop[i], zone: "drop", idx: i });
      }
    } else {
      this.plr.deck.forEach((cid, deckIdx) => {
        combinedPool.push({ cid, zone: "deck", idx: deckIdx });
      });
      if (criteria && criteria.allowDropZone) {
        this.plr.drop.forEach((cid, dropIdx) => {
          combinedPool.push({ cid, zone: "drop", idx: dropIdx });
        });
      }
    }

    let shownCount = 0;
    combinedPool.forEach(entry => {
      const c = entry.cardObj || CARD_MAP.get(entry.cid);
      if (!c) return;

      if (tribeFilter && !cardHasTribe(c, tribeFilter)) return;

      if (q) {
        const hayRaw = `${c.name} ${c.type} ${(c.attrs || []).join(" ")} ${(c.attrs || []).map(formatTribeDisplayName).join(" ")} ${c.skill}`.toLowerCase();
        const hayNorm = normalizeSearchToken(hayRaw);
        if (!hayRaw.includes(q) && (!qNorm || !hayNorm.includes(qNorm))) return;
      }

      const matchesCrit = cardMatchesSearchCriteria(c, criteria);
      if (criteria && onlyMatching && !matchesCrit) return;

      shownCount++;
      const tile = document.createElement("div");
      tile.className = `card-tile ${!matchesCrit ? "unowned" : ""}`;
      tile.onclick = () => {
        if (criteria && !matchesCrit) {
          alert(`"${c.name}" does not match the card ability requirement:\n"${criteria.rawText}"`);
          return;
        }
        if (isBuddyMode) {
          document.getElementById("deck-search-modal").classList.add("hidden");
          const canCallThis = dropSide === this.activeSide && this.phase === "main" && canFighterBuddyCallCard(dropFighter, c.id) && (isYamigedoHalfId(c.id) ? fighterHasBothYamigedoHalvesInHand(dropFighter) : dropFighter.hand.includes(Number(c.id)));
          if (canCallThis) {
            this.triggerBuddyCallFromZone(c.id);
          } else {
            this.openCardBanner({
              card: c,
              context: "view",
              side: dropSide,
              showCombinedYamigedo: isYamigedoHalfId(c.id)
            });
          }
          return;
        }
        if (isSetMode) {
          document.getElementById("deck-search-modal").classList.add("hidden");
          this.openCardBanner({
            card: c,
            context: "set",
            side: dropSide,
            zonePos: `set:${entry.idx}`,
            unit: entry.cardObj
          });
          return;
        }
        if (isItemMode) {
          document.getElementById("deck-search-modal").classList.add("hidden");
          if (entry.zone === "item" && entry.unitObj) {
            this.openCardBanner({
              card: c,
              context: "field",
              side: dropSide,
              zonePos: entry.slotKey,
              unit: entry.unitObj
            });
          } else {
            this.openCardBanner({
              card: c,
              context: "view",
              side: dropSide
            });
          }
          return;
        }
        if (isSoulMode) {
          document.getElementById("deck-search-modal").classList.add("hidden");
          this.openCardBanner({
            card: c,
            context: "soul",
            side: dropSide,
            unit: {
              soulIdx: entry.idx,
              hostUnit: this.deckSearchState.hostUnit,
              hostZonePos: this.deckSearchState.hostZonePos
            }
          });
          return;
        }
        if (isDropMode) {
          const actType = this.deckSearchState.actionType;
          document.getElementById("deck-search-modal").classList.add("hidden");
          if (actType) {
            this.executeDropZoneCardAction(dropSide, entry.idx, actType, this.deckSearchState.targetUnit, this.deckSearchState.onDone);
          } else {
            this.openCardBanner({
              card: c,
              context: "drop",
              side: dropSide,
              unit: { dropIdx: entry.idx }
            });
          }
          return;
        }
        this.pickCardFromDeckSearch(entry.idx, entry.zone);
      };
      const zoneTag = entry.badge || (entry.zone === "drop" ? "♻️ DROP ZONE" : "✅ MATCH");
      tile.innerHTML = `
        ${(matchesCrit && criteria) || entry.zone === "drop" || entry.badge ? `<div class="tile-owned-badge">${zoneTag}</div>` : ""}
        <img src="${c.img}" alt="${escapeHtml(c.name)}" loading="lazy" />
        <div class="tile-name">${escapeHtml(c.name)}</div>
        <div class="tile-sub">${c.type} ${c.size !== null ? "• Sz " + c.size : ""} ${(c.attrs && c.attrs.length) ? "• «" + formatTribeDisplayName(c.attrs[0]) + "»" : ""}</div>
      `;
      grid.appendChild(tile);
    });

    if (shownCount === 0) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:28px; color:#cbd5e1;">No matching cards found for this filter.</div>`;
    }
  },

  pickCardFromDeckSearch(idx, zone = "deck") {
    let cid;
    if (zone === "drop") {
      cid = this.plr.drop.splice(idx, 1)[0];
    } else {
      cid = this.plr.deck.splice(idx, 1)[0];
      this.shuffleFighterDeck("plr");
    }
    const c = CARD_MAP.get(cid);
    document.getElementById("deck-search-modal").classList.add("hidden");

    const fromZone = zone === "drop" ? "z-plr-drop" : "z-plr-deck";
    const criteria = this.deckSearchState ? this.deckSearchState.criteria : null;
    // Impact Monsters can be called by a card ability too (no Call Cost, not limited to one per turn).
    if (criteria && criteria.destAction === "call" && c && window.IMX && IMX.isImpactMonster(c) && this.imCallFromZone) {
      const srcArr = zone === "drop" ? this.plr.drop : this.plr.deck;
      srcArr.push(cid);
      const calledZone = this.imCallFromZone("plr", zone === "drop" ? "drop" : "deck", srcArr.length - 1, {}, () => {
        if (this.deckSearchState && this.deckSearchState.onDone) this.deckSearchState.onDone();
      });
      if (calledZone) return;
      srcArr.pop();
    }
    const shouldCallToField = criteria && criteria.destAction === "call" && c && c.type === "Monster";

    if (shouldCallToField) {
      const f = this.plr;
      const isYami = isYamigedoHalfId(c.id);
      const effectiveCard = isYami ? (getCanonicalYamigedoCard() || c) : c;
      const cost = parseCardCost(effectiveCard.cost, effectiveCard.skill, f, effectiveCard);
      const targetZone = ["center", "left", "right"].find(z => !f.monsters[z]) || (canPlaceSecondCenter(f, effectiveCard) ? "center2" : null);
      if (targetZone && f.gauge.length >= cost.gauge && (this.getCurrentSizeUsed(f) + getEffectiveCardSize(f, effectiveCard) <= (f.maxSize || 3))) {
        for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
        let pairedHalfIds = [c.id];
        if (isYami) {
          const otherId = getOtherYamigedoHalfId(c.id);
          const otherDeckIdx = f.deck.indexOf(otherId);
          const otherHandIdx = f.hand.indexOf(otherId);
          const otherDropIdx = f.drop.indexOf(otherId);
          if (otherDeckIdx !== -1) {
            f.deck.splice(otherDeckIdx, 1);
            pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
          } else if (otherHandIdx !== -1) {
            f.hand.splice(otherHandIdx, 1);
            pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
          } else if (otherDropIdx !== -1) {
            f.drop.splice(otherDropIdx, 1);
            pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
          }
        }
        const soulArr = [];
        for (let i = 0; i < Math.max(cost.soul, effectiveCard.sg ? 1 : 0) && f.deck.length > 0; i++) {
          soulArr.push(f.deck.shift());
        }
        const newUnit = {
          card: effectiveCard,
          isYamigedoConnected: isYami,
          pairedHalfIds,
          rested: false,
          attacksLeft: effectiveCard.atk_max || 1,
          soul: soulArr,
          tempPower: 0,
          tempDef: 0,
          tempCrit: 0,
          actUsed: false
        };
        const eff = getUnitEffectiveCombatStats(f, newUnit);
        newUnit.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (effectiveCard.atk_max || 1);
        this.animateCardFlight(fromZone, `z-plr-${targetZone === "center2" ? "center" : targetZone}`, effectiveCard.img, "🐉 ABILITY CALL!", 0, () => {
          f.monsters[targetZone] = newUnit;
          this.setPrompt(`🐉 Called "${isYami ? getBuddyDisplayName(effectiveCard) : effectiveCard.name}" to ${targetZone.toUpperCase()} by card ability!`);
          this.renderBattle();
          if (this.deckSearchState && this.deckSearchState.onDone) {
            this.deckSearchState.onDone();
          }
        });
        return;
      }
    }

    const badge = zone === "drop" ? "♻️ FROM DROP ZONE!" : "🔍 SEARCHED & SHUFFLED!";

    this.animateCardFlight(fromZone, "bt-plr-hand", c ? c.img : "Sprite/Sleeves/s0.png", badge, 0, () => {
      this.plr.hand.push(cid);
      this.setPrompt(`🔍 Added "${c ? c.name : "card"}" from your ${zone === "drop" ? "Drop Zone" : "Deck"} to your Hand${zone === "deck" ? " and shuffled your Deck" : ""}!`);
      this.renderBattle();
      if (this.deckSearchState && this.deckSearchState.onDone) {
        this.deckSearchState.onDone();
      }
    });
  },

  shuffleFighterDeck(side) {
    const f = this.getFighter(side);
    for (let i = f.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [f.deck[i], f.deck[j]] = [f.deck[j], f.deck[i]];
    }
  },

  shuffleDeckAndClose() {
    this.shuffleFighterDeck("plr");
    document.getElementById("deck-search-modal").classList.add("hidden");
    this.setPrompt("🔀 Shuffled your Deck!");
    this.renderBattle();
  },

  closeDeckSearch() {
    if (this.activeChoice) {
      const choice = this.activeChoice;
      this.activeChoice = null;
      this.setDeckSearchFiltersEnabled(true);
      document.getElementById("deck-search-modal").classList.add("hidden");
      choice.onSelect(choice.firstPayload);
      return;
    }
    if (this.deckSearchState && (this.deckSearchState.isDropZoneMode || this.deckSearchState.isSetZoneMode || this.deckSearchState.isItemZoneMode || this.deckSearchState.isSoulMode)) {
      document.getElementById("deck-search-modal").classList.add("hidden");
      return;
    }
    this.shuffleDeckAndClose();
  },

  openSetZoneViewer(side = "plr") {
    const f = this.getFighter(side);
    if (!f.setSpells || f.setSpells.length === 0) {
      alert(`${f.name}'s [Set] Zone is currently empty (0 cards cast with [Set]).`);
      return;
    }
    this.activeChoice = null;
    this.setDeckSearchFiltersEnabled(true);
    this.deckSearchState = {
      isSetZoneMode: true,
      dropSide: side,
      sourceLabel: `${f.name}'s [Set] Zone`,
      criteria: null
    };
    document.getElementById("ds-title").textContent = `🔮 ${f.name.toUpperCase()}'S [SET] ZONE (${f.setSpells.length} Card${f.setSpells.length === 1 ? "" : "s"} Set on Field)`;
    document.getElementById("ds-subtitle").textContent = `Click any [Set] card below to inspect its Card Detail Banner, check its Soul, or activate its [Act] ability!`;
    document.getElementById("ds-filter").value = "";
    const tribeSel = document.getElementById("ds-tribe");
    if (tribeSel) tribeSel.value = "";
    const onlyMatchChk = document.getElementById("ds-only-matching");
    if (onlyMatchChk) onlyMatchChk.checked = false;

    const footerEl = document.getElementById("ds-footer-actions");
    if (footerEl) {
      footerEl.innerHTML = `<button class="secondary-btn" onclick="document.getElementById('deck-search-modal').classList.add('hidden')">Close [Set] Zone</button>`;
    }
    this.renderDeckSearchGrid();
    document.getElementById("deck-search-modal").classList.remove("hidden");
  },

  openItemZoneViewer(side = "plr") {
    const f = this.getFighter(side);
    if (f.godclock) {
      if (side === "plr") this.openGodclockModal();
      else this.openEndrulerOrOvergodBanner(side);
      return;
    }
    const eqItems = getEquippedItems(f);
    this.activeChoice = null;
    this.setDeckSearchFiltersEnabled(true);
    this.deckSearchState = {
      isItemZoneMode: true,
      dropSide: side,
      sourceLabel: `${f.name}'s Equipped Items & Flag`,
      criteria: null
    };
    document.getElementById("ds-title").textContent = `🗡️ ${f.name.toUpperCase()}'S EQUIPPED ITEMS (${eqItems.length}) & FLAG`;
    document.getElementById("ds-subtitle").textContent = `Click any equipped Item or Flag card below to inspect its Card Detail Banner, Attack, use its [Act] ability, or inspect its Soul!`;
    document.getElementById("ds-filter").value = "";
    const tribeSel = document.getElementById("ds-tribe");
    if (tribeSel) tribeSel.value = "";
    const onlyMatchChk = document.getElementById("ds-only-matching");
    if (onlyMatchChk) onlyMatchChk.checked = false;

    const footerEl = document.getElementById("ds-footer-actions");
    if (footerEl) {
      footerEl.innerHTML = `<button class="secondary-btn" onclick="document.getElementById('deck-search-modal').classList.add('hidden')">Close Item / Flag Viewer</button>`;
    }
    this.renderDeckSearchGrid();
    document.getElementById("deck-search-modal").classList.remove("hidden");
  },

  openSoulViewer(side = "plr", hostUnit = null, zonePos = null) {
    const f = this.getFighter(side);
    let resolvedHost = hostUnit;
    if (!resolvedHost && zonePos) {
      if (zonePos === "item") resolvedHost = f.item;
      else if (zonePos === "item2") resolvedHost = f.item2;
      else if (zonePos.startsWith("set:")) {
        const idx = parseInt(zonePos.split(":")[1], 10);
        resolvedHost = f.setSpells && f.setSpells[idx] ? f.setSpells[idx] : null;
      } else if (f.monsters && f.monsters[zonePos]) {
        resolvedHost = f.monsters[zonePos];
      }
    }
    const soulList = resolvedHost && Array.isArray(resolvedHost.soul) ? resolvedHost.soul : [];
    if (!resolvedHost || soulList.length === 0) {
      alert(`This card currently has 0 cards in its Soul.`);
      return;
    }
    const hostCard = resolvedHost.card || resolvedHost;
    const hostName = hostCard && hostCard.name ? hostCard.name : "Card";
    const hasSG = Boolean((hostCard && hostCard.sg) || resolvedHost.tempSG || (window.ABX && ABX.staticBonus && resolvedHost.card && ABX.staticBonus(f, resolvedHost).sg));

    this.activeChoice = null;
    this.setDeckSearchFiltersEnabled(true);
    this.deckSearchState = {
      isSoulMode: true,
      dropSide: side,
      hostUnit: resolvedHost,
      hostZonePos: zonePos,
      sourceLabel: `"${hostName}"'s Soul`,
      criteria: null
    };
    document.getElementById("ds-title").textContent = `🟣 "${hostName.toUpperCase()}" — SOUL INSPECTOR (${soulList.length} Card${soulList.length === 1 ? "" : "s"}${hasSG ? " • 🛡️ [Soulguard]" : ""})`;
    document.getElementById("ds-subtitle").textContent = `Click any Soul card below to inspect its Card Detail Banner, check its continuous Soul skills, or activate its Soul [Act] abilities!`;
    document.getElementById("ds-filter").value = "";
    const tribeSel = document.getElementById("ds-tribe");
    if (tribeSel) tribeSel.value = "";
    const onlyMatchChk = document.getElementById("ds-only-matching");
    if (onlyMatchChk) onlyMatchChk.checked = false;

    const footerEl = document.getElementById("ds-footer-actions");
    if (footerEl) {
      footerEl.innerHTML = `<button class="secondary-btn" onclick="document.getElementById('deck-search-modal').classList.add('hidden')">Close Soul Viewer</button>`;
    }
    this.renderDeckSearchGrid();
    document.getElementById("deck-search-modal").classList.remove("hidden");
  },

  openDropZoneViewer(side = "plr", abilityOptions = null) {
    const f = this.getFighter(side);
    if (f.drop.length === 0) {
      alert(`${f.name}'s Drop Zone is currently empty (0 cards).`);
      return;
    }

    const criteria = abilityOptions ? abilityOptions.criteria : null;
    const actionType = abilityOptions ? abilityOptions.actionType : null;
    const sourceLabel = abilityOptions ? abilityOptions.sourceLabel : null;

    this.activeChoice = null;
    this.setDeckSearchFiltersEnabled(true);
    this.deckSearchState = {
      isDropZoneMode: true,
      dropSide: side,
      sourceLabel: sourceLabel || `${f.name}'s Drop Zone`,
      criteria,
      actionType,
      targetUnit: abilityOptions ? abilityOptions.targetUnit : null,
      onDone: abilityOptions ? abilityOptions.onDone : null
    };

    const actionVerb = actionType === "call"
      ? "Choose a card from your Drop Zone to CALL to the field"
      : actionType === "soul"
      ? "Choose a card from your Drop Zone to put into SOUL"
      : actionType === "hand"
      ? "Choose a card from your Drop Zone to return to your HAND"
      : "Click any card in the Drop Zone to inspect its Card Detail Banner";

    document.getElementById("ds-title").textContent = `♻️ ${f.name.toUpperCase()}'S DROP ZONE (${f.drop.length} Cards)${sourceLabel ? " — " + sourceLabel : ""}`;
    document.getElementById("ds-subtitle").textContent = criteria && criteria.rawText
      ? `Ability Requirement: "${criteria.rawText}" — ${actionVerb}!`
      : `${actionVerb}!`;

    document.getElementById("ds-filter").value = "";
    const tribeSel = document.getElementById("ds-tribe");
    if (tribeSel) tribeSel.value = "";
    const onlyMatchChk = document.getElementById("ds-only-matching");
    if (onlyMatchChk) onlyMatchChk.checked = Boolean(criteria);

    const footerEl = document.getElementById("ds-footer-actions");
    if (footerEl) {
      footerEl.innerHTML = `<button class="secondary-btn" onclick="document.getElementById('deck-search-modal').classList.add('hidden')">Close Drop Zone</button>`;
    }

    this.renderDeckSearchGrid();
    document.getElementById("deck-search-modal").classList.remove("hidden");
  },

  executeDropZoneCardAction(side, dropIdx, actionType = "hand", targetUnit = null, onDone = null) {
    const f = this.getFighter(side);
    if (dropIdx < 0 || dropIdx >= f.drop.length) return;
    const cid = f.drop[dropIdx];
    const c = CARD_MAP.get(cid);
    if (!c) return;

    if (actionType === "call" && window.IMX && IMX.isImpactMonster(c) && this.imCallFromZone) {
      this.imCallFromZone(side, "drop", dropIdx, {}, onDone);
      return;
    }

    if (actionType === "call") {
      if (c.type !== "Monster") {
        alert(`Only Monster cards can be called to a Monster Zone! ("${c.name}" is a ${c.type}).`);
        return;
      }
      const isYami = isYamigedoHalfId(c.id);
      const effectiveCard = isYami ? ( getCanonicalYamigedoCard() || c ) : c;
      const cost = parseCardCost(effectiveCard.cost, effectiveCard.skill, f, effectiveCard);
      if (f.gauge.length < cost.gauge) {
        alert(`Not enough Gauge to call "${effectiveCard.name}" from the Drop Zone! Need ${cost.gauge} Gauge.`);
        return;
      }
      const targetZone = ["center", "left", "right"].find(z => !f.monsters[z]);
      if (!targetZone) {
        alert(`All of your Monster Zones are full, so "${effectiveCard.name}" can't be called.`);
        return;
      }
      if (this.getCurrentSizeUsed(f) + getEffectiveCardSize(f, effectiveCard) > (f.maxSize || 3)) {
        alert(`Calling "${effectiveCard.name}" would go over your size limit of ${f.maxSize || 3}.`);
        return;
      }
      f.drop.splice(dropIdx, 1);
      // If calling Hyakugan Yamigedo by card ability, also pull its other half if available in drop/hand/deck
      let pairedHalfIds = [c.id];
      if (isYami) {
        const otherId = getOtherYamigedoHalfId(c.id);
        const otherDropIdx = f.drop.indexOf(otherId);
        const otherHandIdx = f.hand.indexOf(otherId);
        const otherDeckIdx = f.deck.indexOf(otherId);
        if (otherDropIdx !== -1) {
          f.drop.splice(otherDropIdx, 1);
          pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
        } else if (otherHandIdx !== -1) {
          f.hand.splice(otherHandIdx, 1);
          pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
        } else if (otherDeckIdx !== -1) {
          f.deck.splice(otherDeckIdx, 1);
          pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
        }
      }
      for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
      const soulArr = [];
      for (let i = 0; i < Math.max(cost.soul, effectiveCard.sg ? 1 : 0) && f.deck.length > 0; i++) {
        soulArr.push(f.deck.shift());
      }
      const newUnit = {
        card: effectiveCard,
        isYamigedoConnected: isYami,
        pairedHalfIds,
        rested: false,
        attacksLeft: effectiveCard.atk_max || 1,
        soul: soulArr,
        tempPower: 0,
        tempDef: 0,
        tempCrit: 0,
        actUsed: false
      };
      const eff = getUnitEffectiveCombatStats(f, newUnit);
      newUnit.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (effectiveCard.atk_max || 1);
      this.animateCardFlight(`z-${side}-drop`, `z-${side}-${targetZone}`, effectiveCard.img, "🐉 CALL FROM DROP!", 0, () => {
        f.monsters[targetZone] = newUnit;
        this.setPrompt(`🐉 Called "${isYami ? getBuddyDisplayName(effectiveCard) : effectiveCard.name}" from Drop Zone to ${targetZone.toUpperCase()}!`);
        this.renderBattle();
        if (onDone) onDone();
      });
      return;
    }

    if (actionType === "soul") {
      const hostUnit = targetUnit || f.monsters.center || f.monsters.left || f.monsters.right || f.item;
      if (!hostUnit) {
        alert("You need a Monster or Item on your field to put a card into its Soul!");
        return;
      }
      f.drop.splice(dropIdx, 1);
      if (!hostUnit.soul) hostUnit.soul = [];
      hostUnit.soul.push(cid);
      this.setPrompt(`🟣 Put "${c.name}" from your Drop Zone into "${hostUnit.card.name}"'s Soul (Now ${hostUnit.soul.length} Soul)!`);
      this.renderBattle();
      if (onDone) onDone();
      return;
    }

    if (actionType === "bottom") {
      f.drop.splice(dropIdx, 1);
      f.deck.push(cid);
      this.setPrompt(`⬇️ Put "${c.name}" from your Drop Zone on the bottom of your Deck!`);
      this.renderBattle();
      if (onDone) onDone();
      return;
    }

    // Default: return from Drop Zone to Hand
    f.drop.splice(dropIdx, 1);
    this.animateCardFlight(`z-${side}-drop`, side === "plr" ? "bt-plr-hand" : "hud-opp-target", c.img, "♻️ FROM DROP TO HAND!", 0, () => {
      f.hand.push(cid);
      this.setPrompt(`♻️ Returned "${c.name}" from your Drop Zone to your Hand!`);
      this.renderBattle();
      if (onDone) onDone();
    });
  },

  startMonsterCall(side, handIdx, isBuddyCall) {
    const f = this.getFighter(side);
    const c = CARD_MAP.get(f.hand[handIdx]);
    if (!c) return;

    const cond = evaluateCardConditions(c, f, this.getEnemy(side));
    if (!cond.met) {
      alert(`Cannot call "${c.name}" yet:\n• ${cond.reasons.join("\n• ")}`);
      return;
    }

    this.pendingAction = { type: "call", side, handIdx, cardId: f.hand[handIdx], isBuddyCall };
    const callName = isYamigedoHalfId(c.id) ? getBuddyDisplayName(c) : c.name;
    this.setPrompt(`🐉 Select Your Left, Center, or Right Monster Zone on Field1 to call "${callName}"!`);
    this.renderBattle();
  },

  openBuddyZoneViewer(side = "plr") {
    const f = this.getFighter(side);
    const entries = getFighterBuddyZoneEntries(f);
    this.activeChoice = null;
    this.setDeckSearchFiltersEnabled(true);
    this.deckSearchState = {
      isBuddyZoneMode: true,
      dropSide: side,
      sourceLabel: `${f.name}'s Buddy Zone`,
      criteria: null
    };
    document.getElementById("ds-title").textContent = `🌟 ${f.name.toUpperCase()}'S BUDDY ZONE (${entries.length} Card${entries.length === 1 ? "" : "s"})`;
    document.getElementById("ds-subtitle").textContent = `Click any Buddy card below to inspect its Card Detail Banner or perform a 🌟 Buddy Call if it is in your hand!`;
    document.getElementById("ds-filter").value = "";
    const tribeSel = document.getElementById("ds-tribe");
    if (tribeSel) tribeSel.value = "";
    const onlyMatchChk = document.getElementById("ds-only-matching");
    if (onlyMatchChk) onlyMatchChk.checked = false;

    const footerEl = document.getElementById("ds-footer-actions");
    if (footerEl) {
      footerEl.innerHTML = `<button class="secondary-btn" onclick="document.getElementById('deck-search-modal').classList.add('hidden')">Close Buddy Zone</button>`;
    }
    this.renderDeckSearchGrid();
    document.getElementById("deck-search-modal").classList.remove("hidden");
  },

  triggerBuddyCallFromZone(specificBuddyId = null) {
    if (!this.isLocalTurn()) return;
    const f = this.getFighter(this.activeSide);
    const entries = getFighterBuddyZoneEntries(f).filter(e => !e.isFaceDown);
    const standingEntries = entries.filter(e => !e.rested);
    if (standingEntries.length === 0 || f.buddyCalled) {
      alert("All of your Buddy cards in the Buddy Zone have already been Buddy Called ([Rest])!");
      return;
    }
    const candidateEntries = specificBuddyId !== null
      ? standingEntries.filter(e => Number(e.id) === Number(specificBuddyId) || (isYamigedoHalfId(e.id) && isYamigedoHalfId(specificBuddyId)))
      : standingEntries;
    const inHandEntry = candidateEntries.find(e => {
      if (isYamigedoHalfId(e.id)) return fighterHasBothYamigedoHalvesInHand(f);
      return f.hand.includes(Number(e.id));
    });
    if (!inHandEntry && entries.length > 1 && specificBuddyId === null) {
      this.openBuddyZoneViewer(this.activeSide);
      return;
    }
    const targetEntry = inHandEntry || candidateEntries[0] || standingEntries[0];
    const buddyCard = CARD_MAP.get(targetEntry.id);
    if (!buddyCard) return;

    if (isYamigedoHalfId(targetEntry.id)) {
      if (!fighterHasBothYamigedoHalvesInHand(f)) {
        alert(`Buddy Call for "${getBuddyDisplayName(buddyCard)}" requires BOTH "Earth Half" (#1911) and "Sky Half" (#1912) in your hand!`);
        return;
      }
      const handIdx = f.hand.indexOf(YAMIGEDO_EARTH_ID);
      this.startMonsterCall(this.activeSide, handIdx, true);
      return;
    }

    const handIdx = f.hand.indexOf(Number(targetEntry.id));
    if (handIdx === -1) {
      alert(`Buddy Call needs "${buddyCard.name}" in your hand. Draw or search for it first!`);
      return;
    }
    this.startMonsterCall(this.activeSide, handIdx, true);
  },

  // Multi-Buddy Zone: click the stack -> card banner of the front Buddy with ◀ ▶ on both sides to view the next Buddy.
  openBuddyBanner(side = "plr", dir = 0) {
    const f = this.getFighter(side);
    const entries = getFighterBuddyZoneEntries(f);
    if (!entries.length) return;
    const n = Math.min(4, entries.length);
    f.buddyPreviewIdx = ((((f.buddyPreviewIdx || 0) + dir) % n) + n) % n;
    const e = entries[f.buddyPreviewIdx];
    const c = e && !e.isFaceDown ? CARD_MAP.get(e.id) : null;
    if (!c) { this.openBuddyZoneViewer(side); return; }
    this.openCardBanner({ card: c, context: "view", side, showCombinedYamigedo: isYamigedoHalfId(c.id) });
    const canCall = side === "plr" && this.activeSide === "plr" && this.phase === "main" && canFighterBuddyCallCard(f, e.id) && (isYamigedoHalfId(e.id) ? fighterHasBothYamigedoHalvesInHand(f) : f.hand.includes(Number(e.id)));
    if (canCall) {
      const b = document.createElement("button");
      b.className = "primary-cta-btn";
      b.textContent = "🌟 Buddy Call";
      b.onclick = () => { this.closeCardBanner(); this.triggerBuddyCallFromZone(e.id); };
      document.getElementById("bnr-actions").prepend(b);
    }
    [["bnr-nav-prev", -1], ["bnr-nav-next", 1]].forEach(([id, d]) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.classList.toggle("hidden", n < 2);
      b.onclick = ev => { ev.stopPropagation(); this.openBuddyBanner(side, d); };
    });
    this.renderBattle();
  },

  onBuddyZoneClick(specificBuddyId = null) {
    const f = this.getFighter("plr");
    const entries = getFighterBuddyZoneEntries(f);
    if (entries.length > 1) {
      if (specificBuddyId !== null) {
        const vis = Math.min(4, entries.length);
        const i = entries.slice(0, vis).findIndex(x => Number(x.id) === Number(specificBuddyId));
        if (i >= 0) f.buddyPreviewIdx = i;
      }
      this.openBuddyBanner("plr", 0);
      return;
    }
    if (specificBuddyId === null && entries.length > 1) {
      const n = Math.min(4, entries.length);
      const focusIdx = ((f.buddyPreviewIdx || 0) % n + n) % n;
      specificBuddyId = entries[focusIdx] ? entries[focusIdx].id : null;
    }
    if (specificBuddyId !== null) {
      const canCall = this.activeSide === "plr" && this.phase === "main" && canFighterBuddyCallCard(f, specificBuddyId) && (isYamigedoHalfId(specificBuddyId) ? fighterHasBothYamigedoHalvesInHand(f) : f.hand.includes(Number(specificBuddyId)));
      if (canCall) {
        this.triggerBuddyCallFromZone(specificBuddyId);
        return;
      }
      if (entries.length > 1) {
        this.openBuddyZoneViewer("plr");
        return;
      }
      const c = CARD_MAP.get(specificBuddyId);
      if (c) {
        this.openCardBanner({ card: c, context: "view", side: "plr", showCombinedYamigedo: isYamigedoHalfId(c.id) });
        return;
      }
    }
    if (entries.length > 1) {
      this.openBuddyZoneViewer("plr");
      return;
    }
    const buddyCard = isYamigedoHalfId(f.buddyId) ? getCanonicalYamigedoCard() : CARD_MAP.get(f.buddyId);
    if (!f.buddyCalled && this.activeSide === "plr" && this.phase === "main") {
      this.triggerBuddyCallFromZone();
    } else if (buddyCard) {
      this.openCardBanner({ card: buddyCard, context: "view", side: "plr", showCombinedYamigedo: true });
    }
  },

  // "turn" / "game" when the card says "You may only call "<this card>" once per turn / game / fight", else null.
  getCallLimit(card) {
    const m = String(card && card.skill || "").match(/you may only call "(.*?)" (?:once )?per (turn|game|fight)\b/i);
    if (!m) return null;
    return m[2].toLowerCase() === "turn" ? "turn" : "game";
  },

  completeMonsterCall(side, zonePos, handIdx, isBuddyCall, isAbilityCall = false) {
    const f = this.getFighter(side);
    const cid = f.hand[handIdx];
    const rawCard = CARD_MAP.get(cid);
    if (!rawCard || rawCard.type !== "Monster") return;

    const isYami = isYamigedoHalfId(rawCard.id);
    if (isYami && !isAbilityCall && !fighterHasBothYamigedoHalvesInHand(f)) {
      if (!f.isBot) {
        alert(`[Evil Deity] You need both "Earth Half" (#1911) and "Sky Half" (#1912) in your hand to call Hyakugan Yamigedo from hand!`);
      }
      return;
    }

    const c = isYami ? (getCanonicalYamigedoCard() || rawCard) : rawCard;

    // "You may only call "X" once per turn / once per game" (was never checked, so a second copy could be called).
    const callLimit = this.getCallLimit(c);
    if (callLimit) {
      const used = (f.callLimitUsed || {})[c.name];
      if (callLimit === "game" ? used != null : used === this.turnCount) {
        if (!f.isBot) {
          this.pendingAction = null;
          this.setPrompt(`Cannot call "${c.name}": you may only call it once per ${callLimit === "game" ? "game" : "turn"}.`);
          this.renderBattle();
        }
        return;
      }
    }

    const maxAllowedSize = f.maxSize || 3;
    const newSize = getEffectiveCardSize(f, c);
    if (newSize > maxAllowedSize) {
      if (!f.isBot) {
        this.pendingAction = null;
        const limitStr = maxAllowedSize >= 1e9 ? "∞" : maxAllowedSize;
        this.setPrompt(`Cannot call "${c.name}": its Size (${newSize}) exceeds your Flag's Max Size limit (${limitStr})${f.flagId === 3337 ? ' — flip into "Infinity the Chaos" (#3941) first!' : '!'}`);
        this.renderBattle();
      }
      return;
    }

    const cost = parseCardCost(c.cost, c.skill, f, c);
    if (!isAbilityCall && f.gauge.length < cost.gauge) {
      if (!f.isBot) {
        this.pendingAction = null;
        this.setPrompt(`Not enough Gauge to call "${c.name}" (needs ${cost.gauge}, you have ${f.gauge.length}). Call cancelled.`);
        this.renderBattle();
      }
      return;
    }

    if (!isAbilityCall && window.ABX && ABX.canPayExtras && !ABX.canPayExtras(side, c, handIdx)) {
      if (!f.isBot) {
        this.pendingAction = null;
        this.setPrompt(`Cannot call "${c.name}": its [Call Cost] needs a card you don't have (see card text). Call cancelled.`);
        this.renderBattle();
      }
      return;
    }

    // [Call Cost] "Put this card on top of a «X» on your field": must be called onto that monster's zone.
    let onTopHost = null;
    if (!isAbilityCall && window.ABX && ABX.onTopCost && ABX.onTopCost(c)) {
      const host = f.monsters[zonePos];
      if (!host || !ABX.onTopMatches(side, c, host)) {
        if (!f.isBot) {
          this.pendingAction = null;
          this.setPrompt(`"${c.name}" is called ON TOP of a monster (see its [Call Cost]): press Call again and click that monster's zone.`);
          this.renderBattle();
        }
        return;
      }
      onTopHost = host;
    }

    if (!isAbilityCall) {
      for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
      if (cost.life > 0) f.life = Math.max(1, f.life - cost.life);
    }

    if (onTopHost && f.monsters[zonePos] === onTopHost) {
      f.monsters[zonePos] = null;   // goes under the new card (into its soul), not to the drop zone
    } else if (f.monsters[zonePos]) {
      const retC = f.monsters[zonePos].card, retO = f.monsters[zonePos].oppressedBy || side;
      this.sendMonsterToDropWithAnimation(side, zonePos, true);
      if (window.ABX && ABX.fireLeave) ABX.fireLeave(retO, retC, false, true);
    }

    if (this.getCurrentSizeUsed(f) + newSize > maxAllowedSize) {
      MONSTER_POSITIONS.forEach(pos => {
        if (pos !== zonePos && f.monsters[pos] && this.getCurrentSizeUsed(f) + newSize > maxAllowedSize) {
          const retC = f.monsters[pos].card, retO = f.monsters[pos].oppressedBy || side;
          this.sendMonsterToDropWithAnimation(side, pos, true);
          if (window.ABX && ABX.fireLeave) ABX.fireLeave(retO, retC, false, true);
        }
      });
    }

    f.hand.splice(handIdx, 1);
    let pairedHalfIds = [rawCard.id];
    if (isYami) {
      const otherId = getOtherYamigedoHalfId(rawCard.id);
      const otherHandIdx = f.hand.indexOf(otherId);
      const otherDeckIdx = isAbilityCall ? f.deck.indexOf(otherId) : -1;
      const otherDropIdx = isAbilityCall ? f.drop.indexOf(otherId) : -1;
      if (otherHandIdx !== -1) {
        f.hand.splice(otherHandIdx, 1);
        pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
      } else if (otherDeckIdx !== -1) {
        f.deck.splice(otherDeckIdx, 1);
        pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
      } else if (otherDropIdx !== -1) {
        f.drop.splice(otherDropIdx, 1);
        pairedHalfIds = [YAMIGEDO_SKY_ID, YAMIGEDO_EARTH_ID];
      }
    }

    const soulCount = this.abxFreeCall ? 0 : Math.max(cost.soul, c.sg ? 1 : 0);
    const soulArr = [];
    for (let i = 0; i < soulCount; i++) {
      if (f.deck.length > 0) soulArr.push(f.deck.shift());
    }

    const unit = {
      card: c,
      isYamigedoConnected: isYami,
      pairedHalfIds,
      rested: false,
      attacksLeft: c.atk_max || 1,
      soul: soulArr,
      isBuddyGift: isBuddyCall,
      tempPower: 0,
      tempDef: 0,
      tempCrit: 0,
      actUsed: false
    };

    this.pendingAction = null;
    const fromHandId = side === "plr" ? "bt-plr-hand" : "hud-opp-target";
    const toZoneId = `z-${side}-${zonePos}`;

    // Occupy the zone right away (not after the animation) so size checks and
    // back-to-back calls (e.g. the bot's turn) see the real board state.
    f.monsters[zonePos] = unit;
    if (callLimit) (f.callLimitUsed = f.callLimitUsed || {})[c.name] = this.turnCount;
    if (onTopHost) unit.soul.unshift(...(onTopHost.soul || []), onTopHost.card.id);
    if (!isAbilityCall && window.ABX && ABX.payExtras && ABX.hasExtras(c)) ABX.payExtras(side, c, unit);
    const eff = getUnitEffectiveCombatStats(f, unit);
    unit.attacksLeft = eff.qa ? 4 : eff.ta ? 3 : eff.da ? 2 : (c.atk_max || 1);
    if (isBuddyCall) markFighterBuddyCalled(f, c.id);

    this.animateCardFlight(fromHandId, toZoneId, c.img, isBuddyCall ? "🌟 BUDDY CALL!" : "🐉 CALL!", 0, () => {
      // The opponent may answer with "Nullify the call" (ABX). A nullified monster goes to the drop zone with its soul.
      if (!isAbilityCall && window.ABX && ABX.castWindow) {
        ABX.castWindow(side, c, "call").then(nullified => {
          if (nullified && f.monsters[zonePos] === unit) {
            f.monsters[zonePos] = null;
            f.drop.push(...(unit.soul || []), ...(unit.pairedHalfIds && unit.pairedHalfIds.length ? unit.pairedHalfIds : [c.id]));
            if (isBuddyCall) standFighterBuddyZone(f, bc => bc.id === c.id);
            this.showCutin("NULLIFIED!", `The call of "${c.name}" was nullified!`, c.img);
            this.setPrompt(`🚫 The call of "${c.name}" was nullified!`);
            this.renderBattle();
            return;
          }
          this.afterMonsterCallLanded(side, c, unit, isBuddyCall);
        }, () => this.afterMonsterCallLanded(side, c, unit, isBuddyCall));
        return;
      }
      this.afterMonsterCallLanded(side, c, unit, isBuddyCall);
    });
  },

  afterMonsterCallLanded(side, c, unit, isBuddyCall) {
    const f = this.getFighter(side);
    {
      if (isBuddyCall) {
        f.life += 1;
        this.showCutin("BUDDY CALL!", `${c.name} (+1 Buddy Gift Life!)`, c.img);
      }
      this.renderBattle();

      const s = (c.skill || "").toLowerCase();
      if (window.ABX && ABX.fireOtherEnter) ABX.fireOtherEnter(side, unit);
      if (window.ABX && ABX.ownsEnter && ABX.ownsEnter(c)) {
        ABX.fireEnter(side, c, unit);
      } else if (s.includes("when this card enters the field") || (parseDeckSearchCriteria(c) && !deckSearchIsNotEnterTimed(c))) {
        this.promptOptionalAbility(side, c, unit);
      }
    }
  },

  equipCardFromHand(side, handIdx, modeLabel = "Equip") {
    const f = this.getFighter(side);
    const cid = f.hand[handIdx];
    const c = CARD_MAP.get(cid);
    if (!c) return;

    if (f.item && f.item.isEndrulerFlag) {
      if (!f.isBot) alert(`Your Flag/Item slot is held by "${f.item.card.name}", so you can't ${modeLabel.toLowerCase()} "${c.name}" right now.`);
      return;
    }

    if (costNeedsNoMonsters(c, f)) {
      if (!f.isBot) alert(`You can only ${modeLabel.toLowerCase()} "${c.name}" when you have no monsters on your field.`);
      return;
    }

    // [Release Condition!] (Dragon Force ...) must be met to equip
    const onlyBy = equipOnlyByAbility(c);
    if (onlyBy) {
      if (!f.isBot) alert(`"${c.name}" cannot be equipped normally — only by the ability of ${onlyBy}.`);
      return;
    }
    const rel = getReleaseConditionStatus(c, f);
    if (!rel.met) {
      if (!f.isBot) alert(`Cannot ${modeLabel.toLowerCase()} "${c.name}" yet:\n• ${rel.reasons.join("\n• ")}`);
      return;
    }

    const cost = parseCardCost(c.cost, c.skill, f, c);
    if (f.gauge.length < cost.gauge) {
      if (!f.isBot) alert(`Not enough Gauge to ${modeLabel}! Need ${cost.gauge} Gauge.`);
      return;
    }
    if (window.ABX && ABX.canPayExtras && !ABX.canPayExtras(side, c, handIdx)) {
      if (!f.isBot) alert(`Cannot ${modeLabel.toLowerCase()} "${c.name}": its [Equip Cost] requires a card you don't have.`);
      return;
    }

    for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
    if (cost.life > 0) f.life = Math.max(1, f.life - cost.life);

    const eqCount = getEquippedItems(f).length;
    const maxItems = getMaxAllowedItems(f, c);
    const canKeepExisting = eqCount > 0 && eqCount < maxItems;
    if (f.item && !f.item.isEndrulerFlag && !canKeepExisting) {
      if (f.item.soul && f.item.soul.length) f.drop.push(...f.item.soul.map(getSoulCardId));
      if (c.eqc && f.eqcTurn !== this.turnCount) {   // [Equipment Change]: only once per turn, otherwise the old item is dropped
        f.eqcTurn = this.turnCount;
        f.hand.push(f.item.card.id);
      } else {
        f.drop.push(f.item.card.id);
      }
      f.item = null;
    }

    f.hand.splice(handIdx, 1);
    const fromHandId = side === "plr" ? "bt-plr-hand" : "hud-opp-target";
    const toItemZone = side === "plr" ? "z-plr-item" : "z-opp-fighter";

    this.animateCardFlight(fromHandId, toItemZone, c.img, `🗡️ ${modeLabel.toUpperCase()}!`, 0, () => {
      const soulCount = Math.max(cost.soul || 0, c.sg ? 1 : 0);
      const soulArr = [];
      for (let i = 0; i < soulCount; i++) {
        if (f.deck.length > 0) soulArr.push(f.deck.shift());
      }
      const newItem = {
        card: c,
        rested: false,
        attacksLeft: c.atk_max || 1,
        soul: soulArr
      };
      const placedSlot = addEquippedItemToFighter(f, newItem, c);
      if (window.ABX && ABX.payExtras && ABX.hasExtras && ABX.hasExtras(c)) ABX.payExtras(side, c, newItem);

      if (modeLabel !== "Equip") {
        this.showCutin(`${modeLabel.toUpperCase()}!`, c.name, c.img);
      }
      this.setPrompt(`🗡️ Equipped "${c.name}" (Pow ${c.power || 0} / Crit ${c.crit || 1})!`);
      this.renderBattle();
      if (window.ABX && ABX.fireEquipped) ABX.fireEquipped(side, c, unitAt(f, placedSlot) || newItem);
    });
  },

  castSpellFromHand(side, handIdx) {
    const f = this.getFighter(side);
    const enemy = this.getEnemy(side);
    const cid = f.hand[handIdx];
    const c = CARD_MAP.get(cid);
    if (!c) return;

    const cond = evaluateCardConditions(c, f, enemy);
    if (!cond.met) {
      alert(`Cannot cast "${c.name}" yet:\n• ${cond.reasons.join("\n• ")}`);
      return;
    }
    if (window.ABX && ABX.canPayExtras && !ABX.canPayExtras(side, c, handIdx)) {
      alert(`Cannot cast "${c.name}": its [Cast Cost] requires a card you don't have.`);
      return;
    }

    const cost = parseCardCost(c.cost, c.skill, f, c);
    for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
    if (cost.life > 0) f.life = Math.max(1, f.life - cost.life);
    f.hand.splice(handIdx, 1);
    noteSpellCast(f, c);

    const setHost = c.set ? Object.assign({}, c, { soul: Array.isArray(c.soul) ? c.soul.slice() : [] }) : null;
    if (c.set && cost.soul > 0) {
      const isFD = /face\s*down/i.test(c.skill || "");
      for (let i = 0; i < cost.soul && f.deck.length > 0; i++) {
        setHost.soul.push(createSoulEntry(f.deck.shift(), isFD));
      }
    }
    if (window.ABX && ABX.payExtras && ABX.hasExtras && ABX.hasExtras(c)) ABX.payExtras(side, c, setHost);

    const fromHandId = side === "plr" ? "bt-plr-hand" : "hud-opp-target";
    const destId = c.set ? `z-${side}-set` : `z-${side}-drop`;

    this.animateCardFlight(fromHandId, destId, c.img, c.set ? "🔮 [SET]!" : "✨ CAST!", 0, () => {
      // The opponent may answer with "Nullify the spell cast by your opponent" (ABX) before it resolves.
      if (window.ABX && ABX.castWindow) {
        ABX.castWindow(side, c, "spell").then(nullified => {
          if (!nullified) { this.resolveCastSpell(side, setHost || c, cid); return; }
          if (setHost && Array.isArray(setHost.soul) && setHost.soul.length) f.drop.push(...setHost.soul.map(getSoulCardId));
          f.drop.push(cid);
          this.showCutin("NULLIFIED!", `"${c.name}" was nullified!`, c.img);
          this.setPrompt(`🚫 "${c.name}" was nullified by ${enemy.name}!`);
          this.renderBattle();
        }, () => this.resolveCastSpell(side, setHost || c, cid));
        return;
      }
      this.resolveCastSpell(side, setHost || c, cid);
    });
  },

  resolveCastSpell(side, c, cid) {
    const f = this.getFighter(side);
    {
      if (c.set) {
        f.setSpells.push(c);
        this.showCutin("[SET]!", c.name, c.img);
        // Resolve the spell's own text instead of a generic stat aura.
        if (window.ABX && ABX.ownsSpell && ABX.ownsSpell(c)) ABX.fireSpell(side, c); else this.executeCardAbilityEffect(side, c, null);
        this.setPrompt(`🔮 [Set] "${c.name}" remains on the field!`);
        return;
      }

      f.drop.push(cid);
      this.showCutin("CAST!", c.name, c.img);

      // Special spell Kronos Syn Mobius (#6206): return all hand, gauge, drop to deck, shuffle, draw 6, gauge 2, life 10!
      if (c.id === 6206) {
        f.deck.push(...f.hand, ...f.gauge, ...f.drop);
        f.hand = [];
        f.gauge = [];
        f.drop = [];
        this.shuffleFighterDeck(side);
        f.life = 10;
        this.chargeDeckToGaugeWithAnimation(side, 2, () => {
          this.drawCardsWithAnimation(side, 6);
        });
        return;
      }

      if (window.ABX && ABX.ownsSpell && ABX.ownsSpell(c)) ABX.fireSpell(side, c); else this.executeCardAbilityEffect(side, c, null);
    }
  },

  castImpactFromHand(side, handIdx) {
    const f = this.getFighter(side);
    const enemy = this.getEnemy(side);
    const cid = f.hand[handIdx];
    const c = CARD_MAP.get(cid);
    if (!c) return;

    if (c.id === 6202) {
      this.activateOvergodZeroFromHand(side, handIdx);
      return;
    }

    if (window.IMX && IMX.isImpactMonster(c)) {
      this.startImpactMonsterCall(side, handIdx);
      return;
    }

    const allowsNonFinal = Boolean(c.cnt || /during (?:your|each player's) attack phase|during an attack/i.test(c.skill || ""));
    if ((this.phase !== "final" && !allowsNonFinal) || (this.phase === "final" && this.turnCount === 1)) {
      alert(`Impact cards can only be cast during your Final Phase (after your Attack Phase, not on Turn 1).`);
      return;
    }

    const cond = evaluateCardConditions(c, f, enemy);
    if (!cond.met) {
      alert(`Cannot cast Impact "${c.name}" yet:\n• ${cond.reasons.join("\n• ")}`);
      return;
    }
    if (window.ABX && ABX.canPayExtras && !ABX.canPayExtras(side, c, handIdx)) {
      alert(`Cannot cast Impact "${c.name}": its [Cast Cost] requires a card you don't have.`);
      return;
    }

    const cost = parseCardCost(c.cost, c.skill, f, c);
    for (let i = 0; i < cost.gauge; i++) f.drop.push(f.gauge.pop());
    if (cost.life > 0) f.life = Math.max(1, f.life - cost.life);
    f.hand.splice(handIdx, 1);
    noteSpellCast(f, c);

    const setHost = c.set ? Object.assign({}, c, { soul: Array.isArray(c.soul) ? c.soul.slice() : [] }) : null;
    if (c.set && cost.soul > 0) {
      const isFD = /face\s*down/i.test(c.skill || "");
      for (let i = 0; i < cost.soul && f.deck.length > 0; i++) {
        setHost.soul.push(createSoulEntry(f.deck.shift(), isFD));
      }
    }
    if (window.ABX && ABX.payExtras && ABX.hasExtras && ABX.hasExtras(c)) ABX.payExtras(side, c, setHost);
    if (!c.set) f.drop.push(cid);

    let dmg = Math.max(2, cost.gauge);
    if (c.id === 6207) {
      dmg = 12;
    } else {
      const dmgMatch = (c.skill || "").match(/deal\s+(\d+)\s+damage/i);
      if (dmgMatch) dmg = parseInt(dmgMatch[1], 10);
    }

    const resolveImpact = () => {
      if (c.set) {
        f.setSpells.push(setHost || c);
        this.showCutin("[SET] IMPACT!", c.name, c.img);
        if (window.ABX && ABX.ownsSpell && ABX.ownsSpell(c)) {
          ABX.fireSpell(side, setHost || c, () => { this.checkWinCondition(); this.renderBattle(); });
        }
        this.setPrompt(`🔮 [Set] Impact "${c.name}" remains on the field!`);
        this.renderBattle();
        return;
      }
      if (window.ABX && ABX.ownsSpell && ABX.ownsSpell(c)) {
        this.showCutin("FINAL PHASE — IMPACT!", c.name, c.img);
        ABX.fireSpell(side, c, () => {
          this.checkWinCondition();
          this.renderBattle();
        });
        return;
      }
      this.showCutin("FINAL PHASE — IMPACT!", `${c.name} (${dmg} Damage!)`, c.img);
      const es0 = side === "plr" ? "opp" : "plr";
      if (window.ABX && ABX.core && ABX.core.applyDamage) ABX.core.applyDamage(es0, dmg, { kind: "impact", unreducible: /cannot be reduced/i.test(c.skill || "") });
      else enemy.life -= dmg;

      if ((c.skill || "").toLowerCase().includes("destroy all monsters")) {
        MONSTER_POSITIONS.forEach(pos => {
          const es = side === "plr" ? "opp" : "plr";
          if (enemy.monsters[pos] && !this.isEffectProtected(es, pos, "destroyed", side)) this.destroyMonster(es, pos);
        });
      }

      this.checkWinCondition();
      this.renderBattle();
    };
    // The opponent may answer with "Nullify the impact cast by your opponent" (ABX).
    if (window.ABX && ABX.castWindow) {
      ABX.castWindow(side, c, "impact").then(nullified => {
        if (!nullified) { resolveImpact(); return; }
        if (c.set) {
          if (setHost && Array.isArray(setHost.soul) && setHost.soul.length) f.drop.push(...setHost.soul.map(getSoulCardId));
          f.drop.push(cid);
        }
        this.showCutin("NULLIFIED!", `"${c.name}" was nullified!`, c.img);
        this.setPrompt(`🚫 Impact "${c.name}" was nullified by ${enemy.name}!`);
        this.renderBattle();
      }, resolveImpact);
      return;
    }
    resolveImpact();
  },

  onZoneClick(zoneSide, zonePos) {
    if (!this.isLocalTurn()) {
      // Even during bot's Attack Phase, allow player to click their Godclock Flag!
      if (zoneSide === "plr" && zonePos === "item" && this.plr.godclock) {
        if (this.plr.godclock.awakened) this.openEndrulerOrOvergodBanner("plr");
        else this.openGodclockModal();
        return;
      }
      // Read-only: any monster / item / flag can still be opened to read its skill (no action buttons off-turn).
      const roFighter = this.getFighter(zoneSide);
      const roUnit = unitAt(roFighter, zonePos);
      if (roUnit) {
        this.openCardBanner({ card: roUnit.card, context: "field", side: zoneSide, zonePos, unit: roUnit });
      } else if (zonePos === "item") {
        const roFlag = CARD_MAP.get(roFighter.flagId);
        if (roFlag) this.openCardBanner({ card: roFlag, context: "view", side: zoneSide });
      }
      return;
    }
    const mySide = this.activeSide;
    const f = this.getFighter(mySide);

    if (this.pendingAction && this.pendingAction.type === "call") {
      const pa = this.pendingAction;
      let handIdx = pa.handIdx;
      if (pa.cardId !== undefined && f.hand[handIdx] !== pa.cardId) handIdx = f.hand.indexOf(pa.cardId);
      const callingCard = handIdx !== -1 ? CARD_MAP.get(f.hand[handIdx]) : null;
      const isOnTopCall = Boolean(callingCard && window.ABX && ABX.onTopCost && ABX.onTopCost(callingCard));
      // [CHAOS Territory]: when calling to the Center while a second Center slot is available, shift the existing Center monster left and call into "center2" on the right half!
      if (zoneSide === mySide && zonePos === "center" && canPlaceSecondCenter(f, callingCard) && !isOnTopCall) {
        zonePos = "center2";
      }
      const canReplaceCenter2 = Boolean(f.monsters.center2 && (hasChaosTerritory(f) || cardHasChaosTerritory(callingCard)));
      if (zoneSide === mySide && (["left", "center", "right"].includes(zonePos) || (zonePos === "center2" && (canPlaceSecondCenter(f, callingCard) || canReplaceCenter2)))) {
        if (handIdx === -1) {
          this.pendingAction = null;
          this.setPrompt("That card is no longer in your hand, so the call was cancelled.");
          this.renderBattle();
          return;
        }
        this.completeMonsterCall(mySide, zonePos, handIdx, pa.isBuddyCall);
      }
      return;
    }

    if (this.pendingAction && this.pendingAction.type === "move") {
      const fromPos = this.pendingAction.fromPos;
      if (zoneSide === mySide && ["left", "center", "right"].includes(zonePos) && zonePos !== fromPos && !f.monsters[zonePos]) {
        const movingUnit = f.monsters[fromPos];
        f.monsters[fromPos] = null;
        this.pendingAction = null;
        this.renderBattle();
        this.animateCardFlight(`z-${mySide}-${fromPos}`, `z-${mySide}-${zonePos}`, movingUnit.card.img, "💨 [MOVE]!", 0, () => {
          f.monsters[zonePos] = movingUnit;
          movingUnit.abxMovedTurn = this.turnCount;   // "used [Move] during this turn"
          if (window.ABX && ABX.fireEv) ABX.fireEv("move", { side: mySide, unit: movingUnit, from: fromPos, to: zonePos });
          this.setPrompt(`💨 [Move] "${movingUnit.card.name}" moved from ${fromPos.toUpperCase()} to ${zonePos.toUpperCase()}!${zonePos === "center" ? " (Now guarding your Center!)" : ""}`);
          this.renderBattle();
        });
      }
      return;
    }

    if (this.pendingAction && this.pendingAction.type === "crossnize") {
      const fromPos = this.pendingAction.fromPos;
      const validPositions = this.pendingAction.validPositions || [];
      if (zoneSide === mySide && validPositions.includes(zonePos)) {
        this.completeCrossnize(mySide, fromPos, zonePos);
      }
      return;
    }

    if (this.pendingAction && this.pendingAction.type === "link_select") {
      if (zoneSide === mySide && [...MONSTER_POSITIONS, "item", "item2"].includes(zonePos)) {
        this.toggleLinkAttackerZone(mySide, zonePos);
        return;
      }
      if (zoneSide !== mySide && MONSTER_POSITIONS.includes(zonePos)) {
        if (this.linkAttackers.length === 0) {
          alert("Select at least 1 of your standing Monsters/Item first!");
          return;
        }
        const enemy = this.getFighter(zoneSide);
        if (enemy.monsters[zonePos]) {
          this.initiateAttackWithDefenseCheck(mySide, [...this.linkAttackers], zonePos);
          return;
        } else if (zonePos === "center" && !enemy.monsters.center) {
          this.initiateAttackWithDefenseCheck(mySide, [...this.linkAttackers], "fighter");
          return;
        }
      }
      return;
    }

    if (this.pendingAction && this.pendingAction.type === "attack") {
      if (zoneSide !== mySide && MONSTER_POSITIONS.includes(zonePos)) {
        const enemy = this.getFighter(zoneSide);
        if (enemy.monsters[zonePos]) {
          this.initiateAttackWithDefenseCheck(mySide, [this.pendingAction.attackerZone], zonePos);
          return;
        } else if (zonePos === "center" && !enemy.monsters.center) {
          this.initiateAttackWithDefenseCheck(mySide, [this.pendingAction.attackerZone], "fighter");
          return;
        }
      }
      return;
    }

    if (zoneSide === "plr" && zonePos === "item" && f.godclock) {
      if (f.godclock.awakened && f.item && f.item.isEndrulerFlag) {
        // Open Perfected Deity of Eon, The Endruler Dragon (or Overgod "0") Skill Banner directly!
        this.openEndrulerOrOvergodBanner("plr");
      } else {
        this.openGodclockModal();
      }
      return;
    }

    const clickedFighter = this.getFighter(zoneSide);
    const unit = unitAt(clickedFighter, zonePos);
    if (!unit) {
      if (zonePos === "item") {
        const flagC = CARD_MAP.get(clickedFighter.flagId);
        if (flagC) this.openCardBanner({ card: flagC, context: "view", side: zoneSide });
      }
      return;
    }

    this.openCardBanner({
      card: unit.card,
      context: "field",
      side: zoneSide,
      zonePos,
      unit
    });
  },

  onEnemyFighterClick() {
    if (!this.isLocalTurn()) return;
    const mySide = this.activeSide;
    const attFighter = this.getFighter(mySide);
    const defFighter = this.getEnemy(mySide);

    if (this.pendingAction && (this.pendingAction.type === "attack" || this.pendingAction.type === "link_select")) {
      const attackerZones = this.pendingAction.type === "link_select" ? [...this.linkAttackers] : [this.pendingAction.attackerZone];
      if (attackerZones.length === 0) return;

      const allHaveShadowDive = attackerZones.every(zp => {
        const u = unitAt(attFighter, zp);
        return u && (u.card.sd || (window.ABX && ABX.canAttackThrough && ABX.canAttackThrough(mySide, u, "opp")));
      });

      if (defFighter.monsters.center && !allHaveShadowDive) {
        alert(`🛡️ ${defFighter.name}'s Center monster ("${defFighter.monsters.center.card.name}") is guarding the Center! You must destroy the Center monster before attacking the fighter directly.`);
        return;
      }
      this.initiateAttackWithDefenseCheck(mySide, attackerZones, "fighter");
    } else {
      const oppFlag = CARD_MAP.get(this.opp.flagId);
      if (oppFlag) this.openCardBanner({ card: oppFlag, context: "view", side: "opp" });
    }
  },

  // First Round Rule: on Turn 1 the first player may attack only ONCE (a Link Attack counts as that one attack).
  isFirstRoundAttackLocked() {
    return this.turnCount === 1 && !!this.turn1AttackUsed;
  },

  startAttackSelection(side, attackerZone) {
    if (this.isFirstRoundAttackLocked()) {
      alert("🚫 First Round Rule: you already used your 1 attack on Turn 1!");
      return;
    }
    const f = this.getFighter(side);
    const enemy = this.getEnemy(side);
    const unit = unitAt(f, attackerZone);
    if (!unit) return;

    const canAttackWithCenter = unit.isEndrulerFlag || (unit.card.skill || "").toLowerCase().includes("even if you have a monster in the center") || (unit.card.skill || "").toLowerCase().includes("even if you have monsters on your center") || (unit.card.skill || "").toLowerCase().includes("even if a «") || !!(window.ABX && ABX.canAttackThrough && ABX.canAttackThrough(side, unit, "own"));
    if ((attackerZone === "item" || attackerZone === "item2") && f.monsters.center && !canAttackWithCenter) {
      alert("Buddyfight Rule: Your equipped Item cannot attack while you have a monster in your Center zone! (Use [Move] to shift your Center monster to Left/Right first, or attack with your monsters.)");
      return;
    }

    if (this.phase === "main") this.phase = "attack";
    this.linkAttackers = [attackerZone];
    this.pendingAction = { type: "attack", attackerZone };
    const blockedByCenter = enemy.monsters.center && !unit.card.sd && !(window.ABX && ABX.canAttackThrough && ABX.canAttackThrough(side, unit, "opp"));
    if (blockedByCenter) {
      this.setPrompt(`🎯 SELECT TARGET: Click an Enemy Monster on the Playmat to attack!`);
    } else {
      this.setPrompt(`🎯 SELECT TARGET: Click the Glowing Red "Opp Fighter / Flag" Zone (or Top Opponent HUD) to attack the Fighter directly, or click an Enemy Monster!`);
    }
    this.renderBattle();
  },

  getAvailableDefenseCards(defSide, isLinkAttack = false, targetPos = "fighter", attUnits = []) {
    const defFighter = this.getFighter(defSide);
    const attFighter = this.getEnemy(defSide);
    if (defFighter.timeStoppedThisTurn || defFighter.timeStoppedThisBattle) return [];
    const valid = [];
    const defendingMonster = targetPos !== "fighter" ? defFighter.monsters[targetPos] : null;

    defFighter.hand.forEach((cid, handIdx) => {
      const c = CARD_MAP.get(cid);
      if (!c) return;
      if (window.ABX && ABX.defenseHandOption && ABX.defenseHandOption(defSide, c, handIdx, targetPos, attUnits)) {
        valid.push({ card: c, handIdx, info: { category: "abx_hand_act" } });
        return;
      }
      if (window.ABX && ABX.counterHandUseActs) {
        const hu = ABX.counterHandUseActs(c).find(ab => ABX.canUseHandAct(defSide, handIdx, ab).ok);
        if (hu) { valid.push({ card: c, handIdx, info: { category: "abx_hand_use", ab: hu } }); return; }
      }
      let info = classifyDefensiveCounterCard(c);
      // Hand [Counter] spells the ability engine owns (destroy / draw / call / life / gauge ...) that the old text
      // classifier does not know: offer them when their conditions and cost are met. Known categories keep their
      // zone / link checks below.
      if (!info && (c.type === "Spell" || c.type === "Impact") && window.ABX && ABX.counterSpellOption) {
        const cs = ABX.counterSpellOption(defSide, c, { targetPos, attUnits });
        if (cs && evaluateCardConditions(c, defFighter, attFighter).met) {
          valid.push({ card: c, handIdx, info: { category: "abx_counter_spell", nullifies: cs.nullifies } });
        }
        return;
      }
      if (!info) return;

      const cond = evaluateCardConditions(c, defFighter, attFighter);
      if (!cond.met) return;
      // the engine's own cast conditions (a tribe on the field, an item equipped, ...) also apply to the known categories
      if (c.type === "Spell" && window.ABX && ABX.counterSpellOption && ABX.ownsCounter && ABX.ownsCounter(c) && !ABX.counterSpellOption(defSide, c, { targetPos, attUnits })) return;

      const s = (c.skill || "").toLowerCase();

      // Category 1: Monster Battle Buff spells can ONLY be used when a Monster is being attacked!
      if (info.category === "monster_battle_buff") {
        if (targetPos === "fighter" || !defendingMonster) return;
        if (info.requiredTribe) {
          const reqNorm = normalizeSearchToken(info.requiredTribe);
          const mAttrsNorm = (defendingMonster.card.attrs || []).map(a => normalizeSearchToken(a));
          const mNameNorm = normalizeSearchToken(defendingMonster.card.name || "");
          if (!mAttrsNorm.some(a => a.includes(reqNorm)) && !mNameNorm.includes(reqNorm)) return;
        }
        valid.push({ card: c, handIdx, info });
        return;
      }

      // Category 2: Damage reduction spells can only be used when the Fighter is taking damage
      if (info.category === "damage_reduce") {
        if (targetPos !== "fighter") return;
        valid.push({ card: c, handIdx, info });
        return;
      }

      // Category 3: Attack Nullifiers — check strict target position, Center open/occupied, Link Attack, Soulguard, Weapon
      if (info.category === "nullify_attack") {
        if ((s.includes("do not have a monster in the center") || s.includes("no monster in the center") || s.includes("have no monsters on your center") || s.includes("no monster on your center")) && defFighter.monsters.center) {
          return;
        }
        if ((s.includes("attacks a monster in your center") || s.includes("attacks a monster on your center")) && targetPos !== "center") {
          return;
        }
        if (s.includes("attacks a monster on your right") && targetPos !== "right") {
          return;
        }
        if (s.includes("attacks a monster on your left") && targetPos !== "left") {
          return;
        }
        // "You may only cast this card if a monster on your center is being attacked" (#3820, #2886): the attacked zone must match
        const attackedZone = s.match(/only cast this card (?:if|when|during) [^.]*?monster on your (center|left|right)[^.]*?(?:is|are) being attacked/);
        if (attackedZone && (attackedZone[1] === "center" ? !["center", "center2"].includes(targetPos) : targetPos !== attackedZone[1])) {
          return;
        }
        if ((s.includes("you are being attacked") || /attacking you(?![a-z])/.test(s)) && targetPos !== "fighter") {
          return;
        }
        if (isLinkAttack && s.includes("not a link attack")) {
          return;
        }
        if (s.includes("monster with soulguard is attacking") && !attUnits.some(u => u && u.card && u.card.sg)) {
          return;
        }
        if (s.includes("attacking your monster with a weapon") && (targetPos === "fighter" || !attUnits.some(u => u && u.card && u.card.type === "Item"))) {
          return;
        }
        valid.push({ card: c, handIdx, info });
      }
    });

    // [Counter] [Act] abilities of cards on the field / in a soul / [Set] spells / drop zone (ABX):
    // the defending player CHOOSES to use them here (never automatic). e.g. Zeitwelg "end that battle".
    if (window.ABX && ABX.fieldCounterOptions) {
      ABX.fieldCounterOptions(defSide, { attUnits, targetPos }).forEach(o => {
        valid.push({ card: o.card, handIdx: null, fieldKey: o.key, fieldLabel: o.label, fieldSub: o.sub, info: { category: "abx_field_act", nullifies: o.nullifies } });
      });
    }

    // [Move]: when you are attacked directly and your center is open, a monster with [Move] on your left or right can
    // move into the center and take the attack instead of you (like a [Counter] spell)
    if (targetPos === "fighter" && !defFighter.monsters.center) {
      ["left", "right"].forEach(pos => {
        const u = defFighter.monsters[pos];
        if (u && canUseMove(defSide, u)) valid.push({ card: u.card, handIdx: null, moveFrom: pos, info: { category: "move_block" } });
      });
    }

    return valid;
  },

  // One option tile in the defense window (hand card or field ability).
  buildDefenseOptionTile(opt, fighter) {
    const div = document.createElement("div");
    div.className = "def-option-card";
    if (opt.moveFrom) {
      div.style.borderColor = "#34d399";
      div.title = `[Move] "${opt.card.name}" from your ${opt.moveFrom} to your center — it is attacked instead of you`;
      div.onclick = () => this.resolveDefenseChoice({ moveFrom: opt.moveFrom });
      div.innerHTML = `
        <img src="${opt.card.img}" alt="${escapeHtml(opt.card.name)}" />
        <div class="def-option-title">${escapeHtml(opt.card.name)}</div>
        <div class="tile-sub">💨 [Move] ${opt.moveFrom.toUpperCase()} → CENTER: block the attack</div>
      `;
      return div;
    }
    if (opt.fieldKey) {
      div.style.borderColor = "#38bdf8";
      div.title = opt.fieldSub || "";
      div.onclick = () => this.resolveDefenseChoice({ fieldKey: opt.fieldKey });
      div.innerHTML = `
        <img src="${opt.card.img}" alt="${escapeHtml(opt.card.name)}" />
        <div class="def-option-title">${escapeHtml(opt.card.name)}</div>
        <div class="tile-sub">✨ ${escapeHtml((opt.fieldSub || "Field [Counter] [Act]").replace(/^\[counter\]\s*\[act\]\s*/i, "").slice(0, 70))}</div>
      `;
      return div;
    }
    const cost = parseCardCost(opt.card.cost, opt.card.skill, fighter, opt.card);
    div.onclick = () => this.resolveDefenseChoice(opt.handIdx);
    div.innerHTML = `
      <img src="${opt.card.img}" alt="${escapeHtml(opt.card.name)}" />
      <div class="def-option-title">${escapeHtml(opt.card.name)}</div>
      <div class="tile-sub">${cost.gauge ? cost.gauge + " Gauge" : "0 Gauge"}</div>
    `;
    return div;
  },

  // [Move] picked in the defense window: the monster moves into the open center and the attack hits it instead.
  applyMoveBlock(defSide, fromPos, attSide, attackerZones, targetPos) {
    const f = this.getFighter(defSide);
    const unit = f.monsters[fromPos];
    if (targetPos !== "fighter" || f.monsters.center || !canUseMove(defSide, unit)) {
      this.executeAttackResolution(attSide, attackerZones, targetPos, false);
      return;
    }
    f.monsters[fromPos] = null;
    f.monsters.center = unit;
    unit.abxMovedTurn = this.turnCount;
    if (window.ABX && ABX.fireEv) ABX.fireEv("move", { side: defSide, unit, from: fromPos, to: "center" });
    this.setPrompt(`💨 [Move] "${unit.card.name}" moved from ${fromPos.toUpperCase()} to CENTER and blocks the attack!`);
    this.renderBattle();
    this.animateCardFlight(`z-${defSide}-${fromPos}`, `z-${defSide}-center`, unit.card.img, "💨 [MOVE] BLOCK!", 0, () => {
      if (this.matchOver) return;
      this.executeAttackResolution(attSide, attackerZones, "center", false);
    });
  },

  // Use a field [Counter] [Act] picked in the defense window, then resolve the attack.
  applyFieldCounterAbility(defSide, fieldKey, attSide, attackerZones, targetPos) {
    if (!(window.ABX && ABX.useFieldCounter)) {
      this.executeAttackResolution(attSide, attackerZones, targetPos, false);
      return;
    }
    ABX.useFieldCounter(defSide, fieldKey, { attackerZones, targetPos }).then(res => {
      if (this.matchOver) return;
      // the ability may have removed every attacker (e.g. "destroy a monster on your opponent's field")
      const attF = this.getFighter(attSide);
      const left = attackerZones.some(z => (unitAt(attF, z)));
      if (!left) {
        this.setPrompt("🛡️ The attacking card left the field — the attack ends.");
        this.renderBattle();
        if (attSide === "opp" && this.opp.isBot && this.oppContinueCallback) setTimeout(this.oppContinueCallback, 650);
        return;
      }
      this.executeAttackResolution(attSide, attackerZones, res.targetPos || targetPos, !!res.nullified);
    });
  },

  // "End the attack phase" (ABX): move the attacker to the Final Phase once the current battle is over.
  // "At the end of your attack phase" triggers (ABX phaseEnd), e.g. [Set] #1541 World End
  fireAttackPhaseEnd(side) { if (window.ABX && ABX.fireTurnEvent) ABX.fireTurnEvent("phaseEnd", "attack", side); },

  abxCheckEndAttack(attSide) {
    if (!(window.ABX && ABX.attackPhaseEnded && ABX.attackPhaseEnded())) return false;
    if (this.activeSide !== attSide || this.phase !== "attack") return false;
    this.fireAttackPhaseEnd(attSide);
    this.phase = "final";
    if (!this.getFighter(attSide).isBot) this.setPrompt("🛑 Your attack phase was ended by a card effect — Final Phase.");
    return true;
  },

  initiateAttackWithDefenseCheck(attSide, attackerZones, targetPos) {
    const attFighter = this.getFighter(attSide);
    if (attSide === this.activeSide && window.ABX && ABX.attackPhaseEnded && ABX.attackPhaseEnded() && (this.phase === "attack" || this.phase === "final")) {
      this.pendingAction = null; this.linkAttackers = [];
      if (this.phase === "attack") this.phase = "final";
      this.setPrompt("🛑 The attack phase was ended by a card effect — you can't attack any more this turn.");
      this.renderBattle();
      return;
    }
    const defSide = attSide === "plr" ? "opp" : "plr";
    const defFighter = this.getFighter(defSide);

    const units = attackerZones.map(zp => unitAt(attFighter, zp)).filter(Boolean);
    if (units.length === 0) return;
    if (window.ABX && ABX.core && units.some(u => ABX.core.isRestricted && ABX.core.isRestricted(u, "attack"))) {
      this.pendingAction = null; this.linkAttackers = [];
      this.setPrompt("✖ That card cannot attack this turn (card effect).");
      this.renderBattle();
      return;
    }

    this.pendingAction = null;
    this.linkAttackers = [];
    // Declaring an attack from the Main Phase starts the Attack Phase (fires "start of attack phase" abilities once).
    if (attSide === this.activeSide && this.phase === "main") this.phase = "attack";
    this.renderBattle();

    // Check if Perfected Deity of Eon, The Endruler Dragon attacks alone -> "Eternal Eon" stops opponent's time for this battle!
    const isEndrulerSoloAttack = units.length === 1 && units[0].isEndrulerFlag && !units[0].isOvergodZero;
    if (isEndrulerSoloAttack) {
      defFighter.timeStoppedThisBattle = true;
      this.showCutin("ETERNAL EON!", "Time Stopped — Opponent Cannot [Counter]!", units[0].card.img);
    } else {
      defFighter.timeStoppedThisBattle = false;
    }
    // "for this turn, your opponent cannot [Counter] during the battle that the chosen card attacks alone" (ABX)
    if (window.ABX && ABX.noCounterThisBattle && ABX.noCounterThisBattle(attSide, units)) defFighter.timeStoppedThisBattle = true;

    const isLink = units.length > 1;
    if (this.mode === "online_p2p" && attSide === "plr" && app.peerConn && app.peerConn.open) {
      this.pendingOnlineAttackCtx = { attSide, attackerZones, targetPos };
      this.setPrompt("⏳ Waiting for Online Friend to respond to your attack ([Counter] timing)...");
      app.peerConn.send({
        type: "P2P_ATTACK_PROMPT",
        attackerZones,
        targetPos,
        stateSnapshot: {
          turnCount: this.turnCount,
          activeSideForReceiver: "opp",
          phase: this.phase,
          senderPlr: JSON.parse(JSON.stringify(this.plr)),
          senderOpp: JSON.parse(JSON.stringify(this.opp))
        }
      });
      return;
    }
    const defOptions = this.getAvailableDefenseCards(defSide, isLink, targetPos, units);
    const canDefUseGodclock = !defFighter.timeStoppedThisTurn && !defFighter.timeStoppedThisBattle && defFighter.godclock && !defFighter.godclock.awakened && !defFighter.godclock.horaryDominationUsedThisTurn && defFighter.hand.length > 0;

    if (!defFighter.isBot && (defOptions.length > 0 || canDefUseGodclock)) {
      this.pendingDefenseContext = { attSide, attackerZones, targetPos, defSide };
      document.getElementById("def-attacker-img").src = units[0].card.img;
      const attNames = units.map(u => `"${u.card.name}"`).join(" + ");
      const targetName = targetPos === "fighter"
        ? "YOU directly"
        : `your ${targetPos.toUpperCase()} monster "${defFighter.monsters[targetPos]?.card.name}"`;
      document.getElementById("def-prompt-title").textContent = `⚔️ ${isLink ? "LINK ATTACK! " : ""}${attNames} attacking ${targetName}!`;

      const strip = document.getElementById("def-cards-list");
      strip.innerHTML = "";

      // Add Godclock [Counter] [Act] "Horary Domination" options during Opponent's Attack Phase!
      if (canDefUseGodclock) {
        [0, 1, 3].forEach(qIdx => {
          const q = defFighter.godclock.quadrants[qIdx];
          if (!q || q.reversed) return;
          if (qIdx === 3 && this.getDropZoneTimeDragonMonsters(defFighter).length === 0) return;
          const qCard = CARD_MAP.get(q.frontId);
          const div = document.createElement("div");
          div.className = "def-option-card";
          div.style.borderColor = "#fde047";
          div.onclick = () => {
            document.getElementById("defense-prompt-modal").classList.add("hidden");
            this.initiateClockFlipInteractive(defSide, qIdx, true);
          };
          div.innerHTML = `
            <img src="${qCard.img}" alt="${escapeHtml(q.name)}" />
            <div class="def-option-title">⏳ [Reversal] ${q.name}</div>
            <div class="tile-sub">${qIdx === 1 ? "Draw 1 & END BATTLE!" : qIdx === 0 ? "Top 3 Deck Pick" : "Call Time Dragon"}</div>
          `;
          strip.appendChild(div);
        });
      }

      defOptions.forEach(opt => strip.appendChild(this.buildDefenseOptionTile(opt, defFighter)));

      document.getElementById("defense-prompt-modal").classList.remove("hidden");
      return;
    }

    if (defFighter.isBot && defOptions.length > 0) {
      // Field [Counter] [Act] that stops the attack (e.g. Zeitwelg "end that battle"), when it is worth it
      const fieldOpts = defOptions.filter(o => o.fieldKey);
      if (fieldOpts.length && window.ABX && ABX.botFieldCounterPick) {
        const pick = ABX.botFieldCounterPick(defSide, { attUnits: units, targetPos }, fieldOpts.map(o => ({ key: o.fieldKey, nullifies: o.info.nullifies })));
        if (pick) { this.applyFieldCounterAbility(defSide, pick.key, attSide, attackerZones, targetPos); return; }
      }
      // [Move] block: when it survives the attack, or when the bot's life is low
      const moveOpt = targetPos === "fighter" && defOptions.find(o => o.moveFrom);
      if (moveOpt) {
        const blocker = defFighter.monsters[moveOpt.moveFrom];
        const atkPow = units.reduce((sum, u) => sum + getUnitEffectiveCombatStats(attFighter, u).power, 0);
        if (defFighter.life <= 6 || getUnitEffectiveCombatStats(defFighter, blocker).defense > atkPow) {
          this.applyMoveBlock(defSide, moveOpt.moveFrom, attSide, attackerZones, targetPos);
          return;
        }
      }
      if (targetPos === "fighter" && defFighter.life <= 6) {
        // When fighter is attacked directly, bot can only use nullify_attack or damage_reduce spells!
        const fighterDefOpt = defOptions.find(o => !o.fieldKey && o.info && (o.info.category === "nullify_attack" || o.info.category === "damage_reduce"));
        if (fighterDefOpt) {
          this.applyDefensiveCounterCard(defSide, fighterDefOpt.handIdx, attSide, attackerZones, targetPos);
          return;
        }
      } else if (targetPos !== "fighter" && defFighter.monsters[targetPos]) {
        // When a bot monster is attacked, check if a monster_battle_buff spell saves the monster or lets it Counterattack!
        const defMon = defFighter.monsters[targetPos];
        const defEff = getUnitEffectiveCombatStats(defFighter, defMon);
        const attCombinedPow = units.reduce((sum, u) => sum + getUnitEffectiveCombatStats(attFighter, u).power, 0);
        const leadAttEff = getUnitEffectiveCombatStats(attFighter, units[0]);

        const helpfulBuffOpt = defOptions.find(o => {
          if (!o.info) return false;
          if (o.info.category === "monster_battle_buff") {
            const savesMonster = (defEff.defense <= attCombinedPow && (defEff.defense + o.info.bonusDef) > attCombinedPow) || o.info.grantsIndestructible;
            const canCounterKill = (defMon.card.ca || o.info.grantsCA) && ((defEff.power + o.info.bonusPower) >= leadAttEff.defense);
            return savesMonster || canCounterKill;
          }
          return false;
        });
        if (helpfulBuffOpt) {
          this.applyDefensiveCounterCard(defSide, helpfulBuffOpt.handIdx, attSide, attackerZones, targetPos);
          return;
        }
      }
    }

    this.executeAttackResolution(attSide, attackerZones, targetPos, false);
  },

  resolveDefenseChoice(chosenHandIdx) {
    document.getElementById("defense-prompt-modal").classList.add("hidden");
    const ctx = this.pendingDefenseContext;
    this.pendingDefenseContext = null;
    if (!ctx) return;

    if (ctx.isOnlineP2P && app.peerConn && app.peerConn.open) {
      app.peerConn.send({
        type: "P2P_DEFENSE_RESPONSE",
        chosenHandIdx
      });
      return;
    }

    if (chosenHandIdx === null || chosenHandIdx === undefined) {
      this.executeAttackResolution(ctx.attSide, ctx.attackerZones, ctx.targetPos, false);
    } else if (typeof chosenHandIdx === "object" && chosenHandIdx.fieldKey) {
      this.applyFieldCounterAbility(ctx.defSide, chosenHandIdx.fieldKey, ctx.attSide, ctx.attackerZones, ctx.targetPos);
    } else if (typeof chosenHandIdx === "object" && chosenHandIdx.moveFrom) {
      this.applyMoveBlock(ctx.defSide, chosenHandIdx.moveFrom, ctx.attSide, ctx.attackerZones, ctx.targetPos);
    } else {
      this.applyDefensiveCounterCard(ctx.defSide, chosenHandIdx, ctx.attSide, ctx.attackerZones, ctx.targetPos);
    }
  },

  applyDefensiveCounterCard(defSide, handIdx, attSide, attackerZones, targetPos) {
    const defFighter = this.getFighter(defSide);
    const cid = defFighter.hand[handIdx];
    const c = CARD_MAP.get(cid);
    if (!c) {
      this.executeAttackResolution(attSide, attackerZones, targetPos, false);
      return;
    }

    if (window.ABX && ABX.counterHandUseActs && !(ABX.isDefenseHandAct && ABX.isDefenseHandAct(c))) {
      const hu = ABX.counterHandUseActs(c).find(ab => ABX.canUseHandAct(defSide, handIdx, ab).ok);
      if (hu) {
        ABX.runHandUse(defSide, handIdx, hu, () => {
          if (this.matchOver) return;
          this.executeAttackResolution(attSide, attackerZones, targetPos, false);
        });
        return;
      }
    }
    if (window.ABX && ABX.isDefenseHandAct && ABX.isDefenseHandAct(c) && ABX.defenseHandOption(defSide, c, handIdx, targetPos, [])) {
      ABX.runHandAct(defSide, handIdx, { attSide, attackerZones, targetPos }).then(res => {
        if (this.matchOver) return;
        this.executeAttackResolution(attSide, attackerZones, res.targetPos, !!res.nullified);
      });
      return;
    }

    const cost = parseCardCost(c.cost, c.skill, defFighter, c);
    for (let i = 0; i < cost.gauge && defFighter.gauge.length > 0; i++) {
      defFighter.drop.push(defFighter.gauge.pop());
    }
    defFighter.hand.splice(handIdx, 1);
    defFighter.drop.push(cid);
    noteSpellCast(defFighter, c);

    const s = (c.skill || "").toLowerCase();
    const revCnt = getFighterReversalCount(defFighter);
    this.showCutin("COUNTER — DEFENSE!", `${defFighter.name} cast ${c.name}!`, c.img);

    if (window.ABX && ABX.ownsCounter && ABX.ownsCounter(c)) {
      ABX.runCounter(defSide, c, { attSide, attackerZones, targetPos }).then(res => {
        if (this.matchOver) return;
        this.executeAttackResolution(attSide, attackerZones, targetPos, !!res.nullified);
      });
      return;
    }

    if (s.includes("gain 1 life for each time your flags [reversal]")) {
      defFighter.life += Math.max(1, revCnt);
    } else if (s.includes("gain 1 life")) {
      defFighter.life += 1;
    } else if (s.includes("gain 2 life")) {
      defFighter.life += 2;
    }

    if (s.includes("into the gauge") || s.includes("into your gauge")) {
      const gCnt = s.includes("for each time your flags [reversal]") ? Math.max(1, revCnt) : 1;
      this.chargeDeckToGaugeWithAnimation(defSide, gCnt);
    }

    const info = classifyDefensiveCounterCard(c);

    if (info && info.category === "monster_battle_buff") {
      if (targetPos !== "fighter" && defFighter.monsters[targetPos]) {
        const m = defFighter.monsters[targetPos];
        m.tempPower = (m.tempPower || 0) + (info.bonusPower || 0);
        m.tempDef = (m.tempDef || 0) + (info.bonusDef || 0);
        m.tempCrit = (m.tempCrit || 0) + (info.bonusCrit || 0);
        if (info.grantsCA) m.tempCA = true;
        if (info.grantsIndestructible) m.tempIndestructible = true;

        const buffParts = [];
        if (info.bonusPower) buffParts.push(`+${info.bonusPower} Power`);
        if (info.bonusDef) buffParts.push(`+${info.bonusDef} Defense`);
        if (info.grantsCA) buffParts.push(`[Counterattack]`);
        if (info.grantsIndestructible) buffParts.push(`Indestructible`);

        this.setPrompt(`⚡ [Counter] "${c.name}" buffed "${m.card.name}" (${buffParts.join(", ")}) for this battle!`);
        this.renderBattle();
      }
      // Do NOT nullify the attack — let the monster battle resolve with the new stats & [Counterattack]!
      this.executeAttackResolution(attSide, attackerZones, targetPos, false);
      return;
    }

    if (info && info.category === "damage_reduce") {
      defFighter.tempDamageReduce = (defFighter.tempDamageReduce || 0) + (info.reduceAmt || 2);
      this.setPrompt(`🛡️ [Counter] "${c.name}" reduces the next damage ${defFighter.name} takes by ${info.reduceAmt >= 90 ? "ALL (to 0)" : info.reduceAmt}!`);
      this.executeAttackResolution(attSide, attackerZones, targetPos, false);
      return;
    }

    // Nullify attack side-effects (e.g. deal 1 damage, draw 1 card, destroy attacker)
    if (s.includes("deal 1 damage to your opponent")) {
      const attFighter = this.getFighter(attSide);
      attFighter.life -= 1;
      this.checkWinCondition();
    }
    if (s.includes("draw a card")) {
      this.drawCardsWithAnimation(defSide, 1);
    }

    this.executeAttackResolution(attSide, attackerZones, targetPos, true);
  },

  executeAttackResolution(attSide, attackerZones, targetPos, attackNullified = false) {
    const attFighter = this.getFighter(attSide);
    const defSide = attSide === "plr" ? "opp" : "plr";
    const defFighter = this.getFighter(defSide);

    const units = attackerZones.map(zp => ({
      zone: zp,
      unit: unitAt(attFighter, zp)
    })).filter(x => x.unit && x.unit.attacksLeft > 0);

    if (units.length === 0) return;

    // First Round Rule: this was the one allowed attack of Turn 1.
    if (this.turnCount === 1) this.turn1AttackUsed = true;

    let combinedPower = 0;
    let combinedCrit = 0;
    let anyPenetrate = false;

    units.forEach(({ unit }) => {
      const eff = getUnitEffectiveCombatStats(attFighter, unit);
      combinedPower += eff.power;
      combinedCrit += eff.crit;
      if (eff.pen) anyPenetrate = true;

      if (units.length > 1 && (unit.card.skill || "").toLowerCase().includes("link attacks")) {
        if ((unit.card.skill || "").toLowerCase().includes("[penetrate]")) anyPenetrate = true;
        combinedPower += 2000;
      }

      // Check on-attack triggers (e.g. Time Ruler Dragon #5955/#5956/#6010/#6204 putting opponent monster on bottom of deck!)
      const uSkill = (unit.card.skill || "").toLowerCase();
      if (uSkill.includes("when this card attacks") && (uSkill.includes("bottom of their deck") || uSkill.includes("bottom of your opponent"))) {
        const oppPositions = ["left", "right", "center"].filter(p => p !== targetPos && defFighter.monsters[p]);
        if (oppPositions.length > 0) {
          const m = defFighter.monsters[oppPositions[0]];
          if (m.soul) defFighter.drop.push(...m.soul);
          defFighter.deck.push(m.card.id);
          defFighter.monsters[oppPositions[0]] = null;
        }
      }

      unit.attacksLeft -= 1;
      if (unit.attacksLeft <= 0) {
        unit.rested = true;
      }
    });

    const leadAttacker = units[0].unit;
    const attDisplayNames = units.map(x => `"${x.unit.card.name}"`).join(" + ");

    if (attackNullified) {
      defFighter.timeStoppedThisBattle = false;
      if (this.imOnNullified) this.imOnNullified(attSide, units);
      this.setPrompt(`🛡️ Attack by ${attDisplayNames} was nullified by ${defFighter.name}'s [Counter]!`);
      this.abxCheckEndAttack(attSide);
      this.renderBattle();
      if (attSide === "opp" && this.opp.isBot && this.oppContinueCallback) {
        setTimeout(this.oppContinueCallback, 650);
      }
      return;
    }

    // Impact Monster "When this card attacks, ..." abilities resolve first, then the strike happens.
    const strike = () => {
    if (this.matchOver) return;
    // Abilities may have changed the numbers (e.g. "this card gets power+6000"), so read them again.
    if (units.some(x => window.IMX && IMX.isUnit(x.unit))) {
      combinedPower = 0; combinedCrit = 0; anyPenetrate = false;
      units.forEach(({ unit }) => {
        const e = getUnitEffectiveCombatStats(attFighter, unit);
        combinedPower += e.power; combinedCrit += e.crit; if (e.pen) anyPenetrate = true;
        if (units.length > 1 && (unit.card.skill || "").toLowerCase().includes("link attacks")) { combinedPower += 2000; }
      });
    }
    // an "is attacked" ability may have nullified [Penetrate]
    if (window.ABX && ABX.kwNullified && units.some(({ unit }) => ABX.kwNullified(unit, "penetrate"))) {
      anyPenetrate = units.some(({ unit }) => getUnitEffectiveCombatStats(attFighter, unit).pen);
    }
    const unreducible = !!(window.ABX && ABX.attackUnreducible && ABX.attackUnreducible(attSide, units));
    units.slice(1).forEach(({ zone, unit }) => {
      this.animateAttackStrike(attSide, zone, defSide, targetPos, unit.card.img);
    });

    this.animateAttackStrike(attSide, units[0].zone, defSide, targetPos, leadAttacker.card.img, () => {
      if (this.matchOver) return;
      defFighter.timeStoppedThisBattle = false;
      const targetMonster = MONSTER_POSITIONS.includes(targetPos) ? defFighter.monsters[targetPos] : null;
      const outcome = { destroyedMonster: false, dealtDamage: false };

      if (targetMonster) {
        outcome.destroyedMonster = !!this.resolveMonsterVsMonster(attSide, units, defSide, targetPos, combinedPower, combinedCrit, anyPenetrate);
        outcome.dealtDamage = outcome.destroyedMonster && (targetPos === "center" || targetPos === "center2") && anyPenetrate;
      } else {
        let finalDmg = combinedCrit;
        if (defFighter.tempDamageReduce && defFighter.tempDamageReduce > 0 && !unreducible) {
          finalDmg = Math.max(0, finalDmg - defFighter.tempDamageReduce);
          defFighter.tempDamageReduce = 0;
        }
        // ABX damage shields ("the next damage you take from attacks is reduced to 0", continuous reductions, ...)
        if (window.ABX && ABX.core && ABX.core.applyDamage) finalDmg = ABX.core.applyDamage(defSide, finalDmg, { kind: "attack", unreducible });
        else defFighter.life -= finalDmg;
        outcome.dealtDamage = finalDmg > 0;
        this.setPrompt(`💥 ${units.length > 1 ? "LINK ATTACK " : ""}DIRECT HIT! ${attDisplayNames} dealt ${finalDmg} Critical damage to ${defFighter.name}!`);
      }

      this.checkWinCondition();
      this.renderBattle();
      if (this.imAfterBattle && !this.matchOver) this.imAfterBattle(attSide, units, outcome);
      if (window.ABX && ABX.fireBattleEnd && !this.matchOver) ABX.fireBattleEnd(attSide, units);
      if (window.ABX && ABX.fireAttackOutcome && !this.matchOver) ABX.fireAttackOutcome(attSide, units, defSide, outcome);
      this.abxCheckEndAttack(attSide);

      if (attSide === "opp" && this.opp.isBot && this.oppContinueCallback) {
        setTimeout(this.oppContinueCallback, 650);
      }
    });
    };
    const goStrike = () => { if (this.imOnAttack) this.imOnAttack(attSide, units, defSide, strike); else strike(); };
    if (window.ABX && ABX.fireAttack) ABX.fireAttack(attSide, units, defSide, targetPos).then(goStrike, goStrike); else goStrike();
  },

  resolveMonsterVsMonster(attSide, attUnits, defSide, targetPos, combinedPower, combinedCrit, anyPenetrate) {
    const attFighter = this.getFighter(attSide);
    const defFighter = this.getFighter(defSide);
    const defender = defFighter.monsters[targetPos];
    if (!defender) return;

    const defEff = getUnitEffectiveCombatStats(defFighter, defender);
    const defStat = defEff.defense;
    const defPower = defEff.power;
    const attNames = attUnits.map(x => `"${x.unit.card.name}"`).join(" + ");

    let defenderSurvived = false;
    let destroyedFlag = false;
    if (combinedPower >= defStat) {
      if (defender.tempIndestructible) {
        defender.tempIndestructible = false;
        defenderSurvived = true;
        this.setPrompt(`🛡️ "${defender.card.name}" prevented destruction by card effect and remained on the field!`);
      } else {
        this._destroyByAttack = true; this._attackersNow = attUnits.map(x => x.unit);
        let destroyed;
        try { destroyed = this.destroyMonster(defSide, targetPos); } finally { this._destroyByAttack = false; this._attackersNow = null; }
        destroyedFlag = !!destroyed;
        defenderSurvived = !destroyed;
        if ((targetPos === "center" || targetPos === "center2") && anyPenetrate && destroyed) {
          let penDmg = combinedCrit;
          const unreducible = !!(window.ABX && ABX.attackUnreducible && ABX.attackUnreducible(attSide, attUnits));
          if (defFighter.tempDamageReduce && defFighter.tempDamageReduce > 0 && !unreducible) {
            penDmg = Math.max(0, penDmg - defFighter.tempDamageReduce);
            defFighter.tempDamageReduce = 0;
          }
          if (window.ABX && ABX.core && ABX.core.applyDamage) penDmg = ABX.core.applyDamage(defSide, penDmg, { kind: "attack", unreducible });
          else defFighter.life -= penDmg;
          this.showCutin("PENETRATE!", `${attNames} deals ${penDmg} Piercing Damage!`, attUnits[0].unit.card.img);
        }
        if (destroyed) {
          this.setPrompt(`💥 ${attNames} (Pow ${combinedPower}) destroyed "${defender.card.name}" (Def ${defStat})!`);
        }
      }
    } else {
      defenderSurvived = true;
      this.setPrompt(`🛡️ "${defender.card.name}" (Def ${defStat}) withstood ${attNames} (Pow ${combinedPower})!`);
    }

    // Trigger [Counterattack] (either native or granted by a [Counter] buff spell!) if the defending monster is still on the field!
    const abxCA = !!(window.ABX && ABX.staticBonus && defFighter.monsters[targetPos] && ABX.staticBonus(defFighter, defender).ca);
    if (defenderSurvived && defFighter.monsters[targetPos] && (defender.card.ca || defender.tempCA || abxCA)) {
      attUnits.forEach(({ zone, unit }) => {
        if (zone !== "item" && attFighter.monsters[zone]) {
          const attEff = getUnitEffectiveCombatStats(attFighter, unit);
          if (defPower >= attEff.defense) {
            this.showCutin("COUNTERATTACK!", `"${defender.card.name}" (Pow ${defPower}) destroys "${unit.card.name}" (Def ${attEff.defense})!`, defender.card.img);
            this._destroyByAttack = true;
            try { this.destroyMonster(attSide, zone); } finally { this._destroyByAttack = false; }
            this.setPrompt(`⚡ [COUNTERATTACK!] "${defender.card.name}" (Pow ${defPower}) survived with Def ${defStat} and counter-destroyed "${unit.card.name}" (Def ${attEff.defense})!`);
          }
        }
      });
    }
    return destroyedFlag;
  },

  // True when the monster at side/pos can't be removed by `bySide`'s card effect (ABX protection auras,
  // "cannot be destroyed / leave the field" for this turn, etc.).
  isEffectProtected(side, pos, kind, bySide) {
    const u = this.getFighter(side).monsters[pos];
    if (!u || !window.ABX || !ABX.core || !ABX.core.isProtected) return false;
    try { return !!ABX.core.isProtected(u, side, kind, { side: bySide }); } catch (e) { return false; }
  },

  destroyMonster(side, pos) {
    const f = this.getFighter(side);
    if (typeof pos === "string" && /^item(\d+)$/.test(pos)) {
      const it = unitAt(f, pos);
      if (!it) return false;
      f.drop.push(...(it.soul || []).map(getSoulCardId), it.card.id);
      setEquippedItemAtSlot(f, pos, null);
      this.renderBattle();
      return true;
    }
    const m = f.monsters[pos];
    if (!m) return false;

    const ownerSide = m.oppressedBy || side;
    const ownerFighter = this.getFighter(ownerSide);

    // "The next time this card would be destroyed this turn, it remains on the field" (ABX saveOnce)
    if (window.ABX && ABX.core && ABX.core.useSave && ABX.core.useSave(ownerSide, m)) { this.renderBattle(); return false; }
    const abxSG = !!(window.ABX && ABX.staticBonus && ABX.staticBonus(ownerFighter, m).sg);
    // #942 Demonic Demise Sword, Aqulta Gwaneff: nullify the [Soulguard] of monsters this card attacks (no soul is spent, the monster is destroyed)
    const sgNullified = !!this._destroyByAttack && (this._attackersNow || []).some(u => u && u.card && /nullify the \[soulguard\] of monsters this card attacks/i.test(u.card.skill || ""));
    if (!sgNullified && (m.card.sg || m.tempSG || abxSG) && !(window.ABX && ABX.kwLost && ABX.kwLost(m, "soulguard")) && m.soul && m.soul.length > 0) {
      const discardedSoul = m.soul.pop();
      const wasFaceDown = isSoulEntryFaceDown(discardedSoul);
      const soulCardId = getSoulCardId(discardedSoul);
      const soulCard = CARD_MAP.get(soulCardId);
      const fromZoneId = `z-${side}-${pos}`;
      const toDropId = `z-${ownerSide}-drop`;

      this.animateCardFlight(fromZoneId, toDropId, soulCard ? soulCard.img : "Sprite/Sleeves/s0.png", "🟣 [SOULGUARD]!", 15, () => {
        ownerFighter.drop.push(soulCardId);
        this.setPrompt(`🟣 [Soulguard] "${m.card.name}" sent 1 Soul card to the Drop Zone (${m.soul.length} Soul left) and remained on the field!`);
        // [Ambush] triggers ONLY if the card was explicitly placed into the soul face-down!
        if (wasFaceDown && soulCard && soulCard.amb) {
          if (window.ABX && ABX.triggerAmbushFromSoul) {
            ABX.triggerAmbushFromSoul(ownerSide, soulCardId, true);
          } else {
            const openPos = ["left", "right", "center"].find(p => !ownerFighter.monsters[p]);
            if (openPos) {
              ownerFighter.monsters[openPos] = { card: soulCard, rested: false, attacksLeft: soulCard.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0, enteredByAmbush: true };
            }
          }
        }
        this.renderBattle();
      });
      return false;
    }

    // "If this card would be destroyed, you may pay 1 gauge. If you do, this card remains on the field." (ABX replacement effects)
    if (window.ABX && ABX.wouldLeaveSave && ABX.wouldLeaveSave(ownerSide, pos, m, !!this._destroyByAttack)) { this.renderBattle(); return false; }

    if ((m.isYamigedoConnected || isYamigedoHalfId(m.card.id)) && ownerFighter.deck.length >= 5) {
      const canPrevent = ownerFighter.isBot || confirm(`[Evil Deity] "${getBuddyDisplayName(m.card)}" would leave the field! Put the top 5 cards of your deck into your Drop Zone so it remains on the field?`);
      if (canPrevent) {
        const milled = ownerFighter.deck.splice(0, 5);
        ownerFighter.drop.push(...milled);
        this.setPrompt(`🛡️ [Evil Deity] Put the top 5 cards of ${ownerFighter.name}'s deck into the Drop Zone — "${getBuddyDisplayName(m.card)}" remained on the field!`);
        this.checkWinCondition();
        this.renderBattle();
        return false;
      }
    }

    if (this.imOnDestroyedUnit && window.IMX && IMX.isUnit(m)) this.imOnDestroyedUnit(ownerSide, m);
    m.abxDestroyed = true; m.abxDestroyedPos = pos;
    m.abxDestroyedBy = this._destroyByAttack ? (side === "plr" ? "opp" : "plr") : (this.abxEffectSide || null);   // side of the attacker / of the card effect that destroyed it   // (Duel Sieger call costs: only a destroyed monster may be answered by a call)
    this.sendMonsterToDropWithAnimation(side, pos, false);
    if (window.ABX && ABX.fireLeave) ABX.fireLeave(ownerSide, m.card, !!this._destroyByAttack);
    if (window.ABX && ABX.fireOtherDestroyed) ABX.fireOtherDestroyed(ownerSide, m.card, m, pos);
    return true;
  },

  sendMonsterToDropWithAnimation(side, pos, isRetire) {
    const f = this.getFighter(side);
    const m = f.monsters[pos];
    if (!m) return;

    const ownerSide = m.oppressedBy || side;
    const ownerFighter = this.getFighter(ownerSide);
    const deadCard = m.card;
    const deadSoul = m.soul ? [...m.soul] : [];
    const deadHalfIds = (m.pairedHalfIds && m.pairedHalfIds.length) ? [...m.pairedHalfIds] : [deadCard.id];
    f.monsters[pos] = null;
    this.renderBattle();

    const fromZoneId = `z-${side}-${pos}`;
    const toDropId = `z-${ownerSide}-drop`;

    this.animateCardFlight(fromZoneId, toDropId, deadCard.img, isRetire ? "♻️ RETIRED" : "💥 DESTROYED", -20, () => {
      const faceDownAmbushIds = [];
      if (deadSoul.length > 0) {
        deadSoul.forEach(entry => {
          const cid = getSoulCardId(entry);
          ownerFighter.drop.push(cid);
          if (isSoulEntryFaceDown(entry)) faceDownAmbushIds.push(cid);
        });
      }
      ownerFighter.drop.push(...deadHalfIds);

      faceDownAmbushIds.forEach(cid => {
        const sc = CARD_MAP.get(cid);
        if (sc && sc.amb) {
          if (window.ABX && ABX.triggerAmbushFromSoul) {
            ABX.triggerAmbushFromSoul(ownerSide, cid, true);
          } else {
            const openPos = ["left", "right", "center"].find(p => !ownerFighter.monsters[p]);
            if (openPos) {
              ownerFighter.monsters[openPos] = { card: sc, rested: false, attacksLeft: sc.atk_max || 1, soul: [], tempPower: 0, tempDef: 0, tempCrit: 0, enteredByAmbush: true };
            }
          }
        }
      });

      const applyLifelink = () => {
        if (isRetire) {
          // [Lifelink] only triggers when the monster is destroyed.
        } else if (deadCard.ll_lose) {
          if (!(window.ABX && ABX.lifelinkLoseOff && ABX.lifelinkLoseOff(m))) {   // Duel Sieger call costs: "nullify the [Lifelink] of ..."
            ownerFighter.life = 0;
            this.checkWinCondition();
          }
        } else if (deadCard.ll > 0 && !(window.ABX && ABX.lifelinkOff && ABX.lifelinkOff(ownerSide, deadCard, m))) {   // "nullify the [Lifelink] of this card"
          ownerFighter.life -= deadCard.ll;
          this.setPrompt(`💔 [Lifelink ${deadCard.ll}] "${deadCard.name}" left the field — ${ownerFighter.name} took ${deadCard.ll} damage!`);
          this.checkWinCondition();
        }
        this.renderBattle();
      };
      // a hand card may be called now by nullifying this [Lifelink]: resolve that choice first
      if (!isRetire && window.ABX && ABX.deferLifelink && ABX.deferLifelink(ownerSide, deadCard, m, applyLifelink)) { /* runs after the call decision */ }
      else applyLifelink();
      this.renderBattle();
    });
  },

  activateOncePerFightSpecial() {
    if (!this.isLocalTurn()) return;
    const f = this.getFighter(this.activeSide);
    if (f.overturnUsed) {
      alert("You can only use [Overturn], [Overkill], or [Overthrow] once per fight!");
      return;
    }

    const unit = ["center", "left", "right"].map(p => f.monsters[p]).find(m => m && (m.card.ot || m.card.ok || m.card.oth));
    if (!unit) {
      alert("You need a monster with [Overturn], [Overkill] or [Overthrow] on your field to use this.");
      return;
    }
    const cardForCutin = unit ? unit.card : CARD_MAP.get(f.buddyId) || ALL_CARDS[0];
    const tag = (unit && unit.card.ok) ? "OVERKILL" : (unit && unit.card.oth) ? "OVERTHROW" : "OVERTURN";
    this.triggerUnitOverturn(this.activeSide, unit, tag, cardForCutin);
  },

  triggerUnitOverturn(side, unit, tag, fallbackCard) {
    const f = this.getFighter(side);
    if (f.overturnUsed) return;
    f.overturnUsed = true;
    (f.overUsed = f.overUsed || {})[String(tag).toLowerCase()] = true;

    const c = unit ? unit.card : fallbackCard;
    this.showCutin(`${tag}!`, `${c.name} — Turn the Tide!`, c.img);

    MONSTER_POSITIONS.forEach(pos => {
      const m = f.monsters[pos];
      if (m) {
        if (effectStand(m)) m.attacksLeft = (m.attacksLeft || 0) + 1;
        m.tempPower = (m.tempPower || 0) + 5000;
        m.tempCrit = (m.tempCrit || 0) + 1;
      }
    });
    [f.item, f.item2].forEach(it => {
      if (!it) return;
      if (effectStand(it)) it.attacksLeft = (it.attacksLeft || 0) + 1;
    });
    this.chargeDeckToGaugeWithAnimation(side, 1);
    this.setPrompt(`🔥 [${tag}] Stood all cards on the field with +5000 Power, +1 Critical, and +1 Gauge!`);
    this.renderBattle();
  },

  getValidCrossnizeTargets(fighter, sourceUnit) {
    if (!fighter || !fighter.monsters) return [];
    return ["center", "left", "right"].filter(pos => {
      const u = fighter.monsters[pos];
      if (!u || !u.card || u === sourceUnit) return false;
      if ((u.card.attrs || []).some(a => normalizeSearchToken(a).includes("neodragon"))) return true;
      if (window.ABX && ABX.core && ABX.core.matchFilter) {
        return Boolean(ABX.core.matchFilter(u.card, { tribes: ["Neodragon"] }, { unit: u }));
      }
      return false;
    });
  },

  startCrossnizeMode(side, fromPos) {
    const f = this.getFighter(side);
    const unit = f && f.monsters ? f.monsters[fromPos] : null;
    if (!unit || !unit.card || !unit.card.cnz) return false;
    const validPositions = this.getValidCrossnizeTargets(f, unit);
    if (validPositions.length === 0) {
      this.setPrompt(`🔒 [Crossnize]: Requires a «Neodragon» monster on your field!`);
      return false;
    }
    if (validPositions.length === 1) {
      return this.completeCrossnize(side, fromPos, validPositions[0]);
    }
    this.pendingAction = { type: "crossnize", fromPos, validPositions };
    this.setPrompt(`✨ [Crossnize]: Click a «Neodragon» on your field (${validPositions.map(z => z.toUpperCase()).join(", ")}) to put "${unit.card.name}" into its soul!`);
    this.renderBattle();
    return true;
  },

  completeCrossnize(side, fromPos, targetPos) {
    const f = this.getFighter(side);
    const sourceUnit = f && f.monsters ? f.monsters[fromPos] : null;
    const targetUnit = f && f.monsters ? f.monsters[targetPos] : null;
    if (!sourceUnit || !targetUnit || sourceUnit === targetUnit) return false;
    const validPositions = this.getValidCrossnizeTargets(f, sourceUnit);
    if (!validPositions.includes(targetPos)) return false;

    f.monsters[fromPos] = null;
    this.pendingAction = null;
    if (!Array.isArray(targetUnit.soul)) targetUnit.soul = [];
    if (Array.isArray(sourceUnit.soul) && sourceUnit.soul.length > 0) {
      targetUnit.soul.push(...sourceUnit.soul);
    }
    targetUnit.soul.push(sourceUnit.card.id);

    this.showCutin("CROSSNIZE!", `${sourceUnit.card.name} ➔ ${targetUnit.card.name}`, sourceUnit.card.img);
    if (window.ABX && ABX.firePutIntoSoul) {
      ABX.firePutIntoSoul(side, sourceUnit.card, targetUnit, "field");
    }
    this.animateCardFlight(`z-${side}-${fromPos}`, `z-${side}-${targetPos}`, sourceUnit.card.img, "✨ [CROSSNIZE]!", 0, () => {
      this.setPrompt(`✨ [Crossnize] Put "${sourceUnit.card.name}" into the soul of "${targetUnit.card.name}" (Soul: ${targetUnit.soul.length})!`);
      this.renderBattle();
    });
    this.renderBattle();
    return true;
  },

  // Counter window while the bot plays: pause so a human with a usable free [Counter] can use it or pass, then continue.
  botPriority(label, cont) {
    if (this.mode === "online_p2p" || this.plr.isBot || !(window.ABX && ABX.priorityWindow)) { cont(); return; }
    const gen = this.matchGen;
    ABX.priorityWindow("plr", label).catch(() => {}).then(() => { if (gen === this.matchGen && !this.matchOver) cont(); });
  },

  runBotTurn() {
    if (this.matchOver || this.activeSide !== "opp" || !this.opp.isBot) return;
    const bot = this.opp;
    const gen = this.matchGen;
    const stillThisMatch = () => gen === this.matchGen && !this.matchOver && this.opp === bot;

    if (bot.godclock && !bot.godclock.awakened) {
      const nextQuadIdx = [0, 1, 3].find(i => !bot.godclock.quadrants[i].reversed);
      if (nextQuadIdx !== undefined && !bot.godclock.horaryDominationUsedThisTurn && bot.hand.length > 0) {
        this.initiateClockFlipInteractive("opp", nextQuadIdx, false);
      }
      if ([0, 1, 3].every(i => bot.godclock.quadrants[i].reversed) && this.findTimeRulerMonsterForGodclockReversal(bot)) {
        this.awakenEndrulerDragon("opp");
      }
    }

    const afterChargeStep = () => {
      if (!stillThisMatch()) return;
      const itemIdx = bot.hand.findIndex(cid => {
        const c = CARD_MAP.get(cid);
        return c && c.type === "Item" && !equipOnlyByAbility(c) && parseCardCost(c.cost, c.skill, bot, c).gauge <= bot.gauge.length && getReleaseConditionStatus(c, bot).met;
      });
      if (itemIdx !== -1 && !bot.item) {  // (bot.item is also set while its Endruler flag is active)
        this.equipCardFromHand("opp", itemIdx, "Equip");
      }

      const botBuddyIdx = isYamigedoHalfId(bot.buddyId)
        ? (fighterHasBothYamigedoHalvesInHand(bot) ? bot.hand.indexOf(YAMIGEDO_EARTH_ID) : -1)
        : bot.hand.indexOf(bot.buddyId);
      if (!bot.buddyCalled && botBuddyIdx !== -1) {
        const bCard = CARD_MAP.get(bot.hand[botBuddyIdx]);
        const bCost = bCard ? parseCardCost(bCard.cost, bCard.skill, bot, bCard) : null;
        const targetZone = ["center", "left", "right"].find(z => !bot.monsters[z]);
        if (bCard && targetZone && bCost.gauge <= bot.gauge.length &&
            this.getCurrentSizeUsed(bot) + getEffectiveCardSize(bot, bCard) <= (bot.maxSize || 3)) {
          this.completeMonsterCall("opp", targetZone, botBuddyIdx, true);
        }
      }

      ["left", "right", "center"].forEach(zonePos => {
        if (!bot.monsters[zonePos]) {
          const mIdx = bot.hand.findIndex(cid => {
            const c = CARD_MAP.get(cid);
            if (!c || c.type !== "Monster") return false;
            if (isYamigedoHalfId(c.id) && !fighterHasBothYamigedoHalvesInHand(bot)) return false;
            const cost = parseCardCost(c.cost, c.skill, bot, c);
            return cost.gauge <= bot.gauge.length && (this.getCurrentSizeUsed(bot) + getEffectiveCardSize(bot, c) <= (bot.maxSize || 3));
          });
          if (mIdx !== -1) {
            this.completeMonsterCall("opp", zonePos, mIdx, false);
          }
        }
      });

      // Bot AI: Use [Crossnize] on field monsters if a «Neodragon» is on the field
      ["left", "right", "center"].forEach(zonePos => {
        const u = bot.monsters[zonePos];
        if (u && u.card && u.card.cnz) {
          const targets = this.getValidCrossnizeTargets(bot, u);
          if (targets.length > 0) {
            this.completeCrossnize("opp", zonePos, targets[0]);
          }
        }
      });

      this.renderBattle();

      setTimeout(() => this.botPriority("the opponent's Main Phase ends", () => {
        if (!stillThisMatch() || this.activeSide !== "opp") return;
        this.phase = "attack";
        this.renderBattle();

        const attackers = MONSTER_POSITIONS.filter(p => bot.monsters[p]);
        if (bot.item && (!bot.monsters.center || bot.item.isEndrulerFlag)) attackers.push("item");

        let step = 0;
        let botImpactTried = false;
        const runNextBotAttack = () => {
          if (!stillThisMatch()) return;
          if (this.activeSide === "opp" && window.ABX && ABX.attackPhaseEnded && ABX.attackPhaseEnded()) step = attackers.length;
          else if (this.activeSide === "opp" && step >= attackers.length && window.ABX && ABX.takeExtraAttack && ABX.takeExtraAttack("opp")) {
            // "You get another attack phase": go round again with whatever is still standing
            attackers.length = 0;
            ["left", "center", "right"].filter(p => bot.monsters[p]).forEach(p => attackers.push(p));
            if (bot.item && (!bot.monsters.center || bot.item.isEndrulerFlag)) attackers.push("item");
            step = 0;
            this.setPrompt("⚔️ Rival gets an extra Attack Phase!");
          }
          if (this.activeSide === "opp" && step >= attackers.length && !botImpactTried && this.imBotCall && !(window.ABX && ABX.turnEnded && ABX.turnEnded())) {
            // Final Phase: the bot may call one Impact Monster, and it may attack right away.
            botImpactTried = true;
            const prevPhase = this.phase;
            if (prevPhase === "attack") this.fireAttackPhaseEnd("opp");
            this.phase = "final";
            const zone = this.imBotCall(bot);
            if (zone) { attackers.push(zone); this.renderBattle(); setTimeout(runNextBotAttack, 700); return; }
            this.phase = prevPhase;
          }
          if (this.activeSide !== "opp" || step >= attackers.length) {
            this.oppContinueCallback = null;
            // Check end-of-opponent's-turn Godclock #5957 awakening for Player!
            if (this.plr.godclock && !this.plr.godclock.awakened && [0, 1, 3].every(i => this.plr.godclock.quadrants[i].reversed) && this.findTimeRulerMonsterForGodclockReversal(this.plr)) {
              this.awakenEndrulerDragon("plr");
            }
            setTimeout(() => this.botPriority("the opponent's turn is ending", () => {
              if (stillThisMatch() && this.activeSide === "opp") {
                if (this.imTurnEnd) this.imTurnEnd("opp");
                if (window.ABX && ABX.fireTurnEvent) ABX.fireTurnEvent("turnEnd");
                this.turnCount++;
                // "After this turn, you get another turn" (ABX)
                if (window.ABX && ABX.takeExtraTurn && ABX.takeExtraTurn("opp")) { this.startTurn("opp"); return; }
                this.startTurn("plr");
              }
            }), 600);
            return;
          }

          const attZone = attackers[step];
          const unit = unitAt(bot, attZone);
          if (unit && unit.attacksLeft > 0 && !unit.rested) {
            const target = this.plr.monsters.center ? "center" : "fighter";
            this.oppContinueCallback = () => {
              if (unit.attacksLeft <= 0 || unit.rested) step++;
              runNextBotAttack();
            };
            this.initiateAttackWithDefenseCheck("opp", [attZone], target);
          } else {
            step++;
            runNextBotAttack();
          }
        };

        runNextBotAttack();
      }), 750);
    };

    if (!bot.chargedThisTurn && bot.hand.length > 2) {
      this.executeChargeAndDraw("opp", 0, afterChargeStep);
    } else {
      afterChargeStep();
    }
  },

  tryTriggerDragonDrei(side) {
    const f = this.getFighter(side);
    if (f.dreiUsed || f.flagKey !== "dragon_zwei") return false;

    const dreiHandIdx = f.hand.indexOf(2789);
    if (dreiHandIdx === -1) return false; // Dragon Drei must be in your hand

    f.dreiUsed = true;
    f.hand.splice(dreiHandIdx, 1);
    f.flagId = 2789;
    f.flagKey = "dragon_drei";
    f.world = "Dragon Drei";

    MONSTER_POSITIONS.forEach(pos => {
      if (f.monsters[pos]) {
        if (f.monsters[pos].soul) f.drop.push(...f.monsters[pos].soul);
        f.drop.push(f.monsters[pos].card.id);
        f.monsters[pos] = null;
      }
    });
    f.life = 5;

    const dreiCard = CARD_MAP.get(2789);
    this.showCutin("DRAGON DREI!", `${f.name} Revived to 5 Life!`, dreiCard ? dreiCard.img : "CardSprite/n2789.png");
    this.setPrompt(`🔥 DRAGON DREI ACTIVATED! ${f.name} placed Dragon Drei on top of Dragon Zwei, sent all field cards to the Drop Zone, and revived to 5 Life!`);
    this.renderBattle();
    return true;
  },

  checkWinCondition() {
    if (this.matchOver || !this.plr || !this.opp) return;
    if (this.plr.life <= 0) {
      if (this.tryTriggerDragonDrei("plr")) return;
      this.finishMatch(false);
    } else if (this.opp.life <= 0) {
      if (this.tryTriggerDragonDrei("opp")) return;
      this.finishMatch(true);
    } else if (this.plr.deck.length === 0) {
      // Buddyfight rule: a fighter with no cards left in their deck loses.
      this.finishMatch(false, "deck");
    } else if (this.opp.deck.length === 0) {
      this.finishMatch(true, "deck");
    }
  },

  finishMatch(playerWon, reason = "life") {
    if (this.matchOver) return;
    this.matchOver = true;
    this.oppContinueCallback = null;
    this.pendingAction = null;
    this.pendingDefenseContext = null;
    // Music ends with the match, not when the result popup is closed.
    app.stopBgm();
    ["defense-prompt-modal", "ability-prompt-modal", "deck-search-modal", "card-detail-banner", "godclock-modal"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
    if (playerWon) {
      app.state.wins += 1;
      app.state.streak += 1;
      app.state.rp += 45;
      app.state.coins += 300;
      app.saveState();
      setTimeout(() => {
        alert(`🏆 WINNER! You defeated ${this.opp.name}!\n\nRewards:\n• +300 BP (Booster Pack Coins)\n• +45 Rank Points (Now ${app.state.rp} RP)`);
        app.showScreen("hub");
      }, 450);
    } else {
      app.state.losses += 1;
      app.state.streak = 0;
      app.state.rp = Math.max(800, app.state.rp - 20);
      app.state.coins += 100;
      app.saveState();
      setTimeout(() => {
        const why = reason === "deck" ? "Your deck ran out of cards." : `${this.opp.name} reduced your Life to 0.`;
        alert(`💔 DEFEAT! ${why}\n\nConsolation Reward: +100 BP`);
        app.showScreen("hub");
      }, 450);
    }
  },

  confirmLeave() {
    if (confirm("Leave the current battle and return to the Main Lobby?")) {
      // Stop the match so bot timers and animations can't keep playing it in the background.
      this.matchOver = true;
      this.oppContinueCallback = null;
      this.pendingAction = null;
      this.pendingDefenseContext = null;
      app.stopBgm();
      app.showScreen("hub");
    }
  },

  renderFieldCardHtml(fighter, unit, side = null, zonePos = null) {
    if (!unit || !unit.card) return "";
    const c = unit.card;
    const eff = getUnitEffectiveCombatStats(fighter, unit);
    const statLabel = (c.type === "Monster" || unit.isEndrulerFlag)
      ? `${eff.power}/${eff.crit}/${eff.defense}${eff.pen ? " [P]" : ""}`
      : `${eff.power}/${eff.crit}`;
    const resolvedSide = side || (fighter === this.plr ? "plr" : "opp");
    const resolvedPos = zonePos || (window.ABX && ABX.core && ABX.core.posOfUnit ? ABX.core.posOfUnit(fighter, unit) : "") || "";
    const hasSG = Boolean(c.sg || unit.tempSG || (window.ABX && ABX.staticBonus && ABX.staticBonus(fighter, unit).sg));
    const soulHtml = unit.soul && unit.soul.length > 0
      ? `<div class="soul-badge" onclick="event.stopPropagation(); battle.openSoulViewer('${resolvedSide}', null, '${resolvedPos}')" title="Click to inspect ${unit.soul.length} Soul card(s)${hasSG ? " [Soulguard]" : ""}">🟣 Soul:${unit.soul.length}</div>`
      : "";
    const isYami = unit.isYamigedoConnected || isYamigedoHalfId(c.id);
    const artHtml = isYami
      ? renderYamigedoDualStackHtml()
      : `<img src="${c.img}" alt="${escapeHtml(c.name)}" />`;
    return `
      <div class="field-card ${isYami ? "yamigedo-connected-card" : ""} ${unit.rested ? "rested" : ""} ${unit.isBuddyGift || unit.isEndrulerFlag ? "buddy-gift" : ""}">
        ${soulHtml}
        ${artHtml}
        <div class="field-stat-overlay">${statLabel}</div>
      </div>
    `;
  },

  // the 4 images of a connected 2x2 flag (Godclock), in grid order; null for a normal one-card flag
  connectedFlagArt(fighter) {
    const gc = fighter && fighter.godclock;
    if (!gc || !Array.isArray(gc.quadrants) || gc.quadrants.length !== 4) return null;
    return gc.quadrants.map(q => {
      const c = CARD_MAP.get((gc.awakened || q.reversed) ? q.backId : q.frontId) || CARD_MAP.get(5957);
      return c ? c.img : "Sprite/Sleeves/s0.png";
    });
  },

  renderFlagZoneHtml(fighter) {
    const side = fighter === this.plr ? "plr" : "opp";
    if (fighter.godclock) {
      if (fighter.godclock.overgodActive && fighter.item) {
        // Overgod, "0" placed on top of the 4 connected Endruler cards: show the full 2x2 Overgod art as one big flag
        const ogRested = fighter.item.rested ? "rested" : "";
        return `
          <div class="godclock-seamless-board overgod-flag-board ${ogRested}" title="Overgod, &quot;0&quot; — click to open its Skill Banner">
            <img class="overgod-flag-art" src="${OVERGOD_FLAG_ART}" alt="Overgod, &quot;0&quot;" />
            <div class="overgod-flag-glow"></div>
            <div class="godclock-stat-overlay overgod-stat">0 / 12 Crit</div>
          </div>
        `;
      }
      const restedClass = fighter.item && fighter.item.rested ? "rested" : "";
      const statOverlay = fighter.godclock.awakened
        ? `<div class="godclock-stat-overlay">12000 / 4 / 12000 [3x ATK]</div>`
        : "";
      return `
        <div class="godclock-seamless-board ${restedClass}">
          ${fighter.godclock.quadrants.map(q => {
            const activeId = (fighter.godclock.awakened || q.reversed) ? q.backId : q.frontId;
            const c = CARD_MAP.get(activeId) || CARD_MAP.get(5957);
            return `
              <div class="gc-quad ${q.reversed ? "reversed" : ""}">
                <img src="${c.img}" alt="${escapeHtml(q.name)}" />
              </div>
            `;
          }).join("")}
          ${statOverlay}
        </div>
      `;
    }

    const eqItems = getEquippedItems(fighter);
    if (eqItems.length >= 2) {
      const visible = eqItems.slice(-6);
      const n = visible.length;
      const stepPct = Math.min(22, Math.floor(68 / Math.max(1, n - 1)));
      const totalShift = stepPct * (n - 1);
      const startLeft = -Math.floor(totalShift / 2);
      return `
        <div class="slot-fan-stack item-fan-stack chaos-pair" title="${eqItems.length} Equipped Items — Click any Item to Attack/Act, or inspect all Items & Flag">
          ${visible.map(({ slot, unit }, idx) => {
            const offsetPct = startLeft + idx * stepPct;
            return `<div class="fan-card-slot chaos-half" style="--fan-offset:${offsetPct}%; z-index:${idx + 2};" onclick="event.stopPropagation(); battle.onZoneClick('${side}','${slot}')">${this.renderFieldCardHtml(fighter, unit, side, slot)}</div>`;
          }).join("")}
        </div>
      `;
    }
    if (fighter.item) {
      return this.renderFieldCardHtml(fighter, fighter.item, side, "item");
    }

    const flagCard = CARD_MAP.get(fighter.flagId) || ALL_CARDS[0];
    return `<div class="field-card"><img src="${flagCard.img}" alt="${escapeHtml(flagCard.name)}" /></div>`;
  },

  renderBuddyZoneHtml(fighter, side) {
    const entries = getFighterBuddyZoneEntries(fighter);
    if (entries.length === 0) return "";
    if (entries.length === 1) {
      const e = entries[0];
      const bc = CARD_MAP.get(e.id);
      if (!bc) return "";
      if (isYamigedoHalfId(bc.id)) {
        return `<div class="field-card yamigedo-connected-card ${e.rested || fighter.buddyCalled ? "rested" : ""}">${renderYamigedoDualStackHtml()}</div>`;
      }
      return `<div class="field-card ${e.rested || fighter.buddyCalled ? "rested" : ""}"><img src="${e.isFaceDown ? "Sprite/Sleeves/s0.png" : bc.img}" alt="${escapeHtml(bc.name)}" /></div>`;
    }
    const visible = entries.slice(0, 4);
    const n = visible.length;
    const focusIdx = ((fighter.buddyPreviewIdx || 0) % n + n) % n;
    // Order cards so the focused Buddy is rendered last (on top of the stack)
    const ordered = [];
    for (let i = 1; i < n; i++) {
      const idx = (focusIdx + i) % n;
      ordered.push({ entry: visible[idx], origIdx: idx, isFront: false });
    }
    ordered.push({ entry: visible[focusIdx], origIdx: focusIdx, isFront: true });
    const isBuddyCallActive = visible.some(e => e.rested) || Boolean(fighter.buddyCalled);
    const stepPct = n === 2 ? 46 : n === 3 ? 34 : 26;
    const totalShift = stepPct * (n - 1);
    const startLeft = -Math.floor(totalShift / 2);
    const vOffsets = n === 2 ? [-20, 20] : n === 3 ? [-28, 0, 28] : [-33, -11, 11, 33];
    return `
      <div class="slot-fan-stack buddy-fan-stack ${isBuddyCallActive ? "buddy-active-vertical-stack" : ""} buddy-count-${n}" title="${entries.length} Cards in Buddy Zone — Use ◀ ▶ to cycle or click to Buddy Call / Inspect">
        ${ordered.map(({ entry: e, origIdx, isFront }, slotPos) => {
          const bc = CARD_MAP.get(e.id);
          if (!bc) return "";
          const offsetPct = startLeft + slotPos * stepPct;
          const vOff = vOffsets[slotPos] !== undefined ? vOffsets[slotPos] : 0;
          const clickHandler = side === "plr"
            ? `event.stopPropagation(); battle.onBuddyZoneClick(${e.id})`
            : `event.stopPropagation(); battle.openBuddyZoneViewer('${side}')`;
          return `<div class="fan-card-slot buddy-fan-card ${isFront ? "active-front-buddy" : ""}" style="--fan-offset:${offsetPct}%; --v-offset:${vOff}%; z-index:${slotPos + 2};" onclick="${clickHandler}"><div class="field-card ${e.rested ? "rested" : ""}"><img src="${e.isFaceDown ? "Sprite/Sleeves/s0.png" : bc.img}" alt="${escapeHtml(bc.name)}" /></div></div>`;
        }).join("")}
      </div>
    `;
  },

  renderGaugeStackHtml(gaugeArr) {
    const visible = Math.min(gaugeArr.length, 10);
    let html = "";
    for (let i = 0; i < visible; i++) {
      html += `<img src="Sprite/Sleeves/s0.png" class="gauge-sleeve-horiz" alt="Gauge" />`;
    }
    return html;
  },

  renderSetZoneSlotHtml(side) {
    const f = this.getFighter(side);
    const list = f && Array.isArray(f.setSpells) ? f.setSpells : [];
    if (list.length === 0) return "";
    const renderOneSet = (sp, idx) => {
      const soulCnt = Array.isArray(sp.soul) ? sp.soul.length : 0;
      const soulBadge = soulCnt > 0
        ? `<div class="soul-badge" onclick="event.stopPropagation(); battle.openSoulViewer('${side}', null, 'set:${idx}')" title="Click to inspect ${soulCnt} Soul card(s)">🟣 Soul:${soulCnt}</div>`
        : "";
      return `<div class="field-card">${soulBadge}<img src="${sp.img}" alt="${escapeHtml(sp.name)}" /></div>`;
    };
    if (list.length === 1) {
      return renderOneSet(list[0], 0);
    }
    const visible = list.slice(-5);
    const startIdx = list.length - visible.length;
    const n = visible.length;
    const stepPct = Math.min(26, Math.floor(64 / Math.max(1, n - 1)));
    const totalShift = stepPct * (n - 1);
    const startLeft = -Math.floor(totalShift / 2);
    return `
      <div class="slot-fan-stack set-fan-stack chaos-pair" title="Click to inspect all ${list.length} [Set] cards">
        ${visible.map((sp, i) => {
          const offsetPct = startLeft + i * stepPct;
          return `<div class="fan-card-slot chaos-half" style="--fan-offset:${offsetPct}%; z-index:${i + 2};">${renderOneSet(sp, startIdx + i)}</div>`;
        }).join("")}
      </div>
    `;
  },

  // [CHAOS Territory]: when a single monster is in the center (even with [CHAOS Territory]), it fits the slot normally like left/right.
  // Only when the player is calling a second monster to the center (or 2 monsters are on the center) does the first card shift left (right edge/corner aligned with slot center) and connect with the second card on the right half!
  renderCenterPairHtml(side) {
    const f = this.getFighter(side);
    if (!f.monsters.center && f.monsters.center2) { f.monsters.center = f.monsters.center2; f.monsters.center2 = null; }   // the first one left: the second moves up
    let pendingChaosCall = false;
    if (this.pendingAction && this.pendingAction.type === "call" && this.pendingAction.side === side) {
      const c = CARD_MAP.get(this.pendingAction.cardId !== undefined ? this.pendingAction.cardId : f.hand[this.pendingAction.handIdx]);
      const isOnTopCall = Boolean(c && window.ABX && ABX.onTopCost && ABX.onTopCost(c));
      if (canPlaceSecondCenter(f, c) && !isOnTopCall) pendingChaosCall = true;
    }
    const bothPresent = Boolean(f.monsters.center && f.monsters.center2);
    if (!bothPresent && !pendingChaosCall) return this.renderFieldCardHtml(f, f.monsters.center, side, "center");
    const half = (pos, inner, sideClass) => `<div class="chaos-half ${sideClass}" onclick="event.stopPropagation(); battle.onZoneClick('${side}','${pos}')">${inner}</div>`;
    return `<div class="chaos-pair chaos-connected ${bothPresent ? "both-active" : "calling-second"}">${half("center", this.renderFieldCardHtml(f, f.monsters.center, side, "center"), "chaos-left-half")}${half("center2", f.monsters.center2 ? this.renderFieldCardHtml(f, f.monsters.center2, side, "center2") : '<div class="chaos-empty">⚡ CALL HERE<br>(CHAOS Territory)</div>', "chaos-right-half")}</div>`;
  },

  renderBattle() {
    if (!this.plr || !this.opp) return;

    document.getElementById("bt-opp-name").textContent = this.opp.name;
    document.getElementById("bt-opp-life").textContent = this.opp.life;
    document.getElementById("bt-opp-gauge").textContent = this.opp.gauge.length;
    document.getElementById("bt-opp-hand-cnt").textContent = this.opp.hand.length;
    document.getElementById("bt-opp-deck-cnt").textContent = this.opp.deck.length;
    document.getElementById("bt-opp-drop-cnt").textContent = this.opp.drop.length;

    document.getElementById("bt-plr-name").textContent = `${this.plr.name} (${this.plr.world})`;
    document.getElementById("bt-plr-life").textContent = this.plr.life;
    document.getElementById("bt-plr-gauge").textContent = this.plr.gauge.length;
    document.getElementById("bt-plr-size").textContent = this.getCurrentSizeUsed(this.plr);
    document.getElementById("bt-plr-max-size").textContent = this.plr.maxSize >= 1e9 ? "∞" : (this.plr.maxSize || 3);
    document.getElementById("bt-plr-hand-cnt").textContent = this.plr.hand.length;

    document.getElementById("bt-turn-label").textContent = `TURN ${this.turnCount} — ${this.activeSide === "plr" ? "YOUR TURN" : this.opp.name.toUpperCase() + "'S TURN"}`;
    ["start", "main", "attack", "final"].forEach(ph => {
      document.getElementById(`ph-${ph}`).classList.toggle("active", this.phase === ph);
    });

    // Main Phase: [Attack Phase] and [Final Phase]; Attack Phase: [Final Phase]; Final Phase: only [End Turn]
    const nextBtn = document.getElementById("btn-next-phase");
    if (nextBtn) nextBtn.classList.toggle("hidden", this.phase !== "main");
    const finalBtn = document.getElementById("btn-final-phase");
    if (finalBtn) finalBtn.classList.toggle("hidden", this.phase !== "main" && this.phase !== "attack");

    document.getElementById("z-opp-deck-cnt").textContent = this.opp.deck.length;
    document.getElementById("z-opp-drop-cnt").textContent = this.opp.drop.length;
    document.getElementById("z-opp-set-cnt").textContent = this.opp.setSpells.length;
    document.getElementById("z-opp-gauge-cnt").textContent = this.opp.gauge.length;
    document.getElementById("z-opp-gauge-visual").innerHTML = this.renderGaugeStackHtml(this.opp.gauge);

    document.getElementById("z-plr-deck-cnt").textContent = this.plr.deck.length;
    document.getElementById("z-plr-drop-cnt").textContent = this.plr.drop.length;
    document.getElementById("z-plr-set-cnt").textContent = this.plr.setSpells.length;
    document.getElementById("z-plr-gauge-cnt").textContent = this.plr.gauge.length;
    document.getElementById("z-plr-gauge-visual").innerHTML = this.renderGaugeStackHtml(this.plr.gauge);

    const oppTopDrop = this.opp.drop.length ? CARD_MAP.get(this.opp.drop[this.opp.drop.length - 1]) : null;
    document.getElementById("z-opp-drop-slot").innerHTML = oppTopDrop ? `<div class="field-card"><img src="${oppTopDrop.img}" /></div>` : "";

    const plrTopDrop = this.plr.drop.length ? CARD_MAP.get(this.plr.drop[this.plr.drop.length - 1]) : null;
    document.getElementById("z-plr-drop-slot").innerHTML = plrTopDrop ? `<div class="field-card"><img src="${plrTopDrop.img}" /></div>` : "";

    document.getElementById("z-opp-set-slot").innerHTML = this.renderSetZoneSlotHtml("opp");
    document.getElementById("z-plr-set-slot").innerHTML = this.renderSetZoneSlotHtml("plr");

    document.getElementById("z-opp-buddy-slot").innerHTML = this.renderBuddyZoneHtml(this.opp, "opp");
    document.getElementById("slot-plr-buddy").innerHTML = this.renderBuddyZoneHtml(this.plr, "plr");

    document.getElementById("z-opp-item-slot").innerHTML = this.renderFlagZoneHtml(this.opp);
    document.getElementById("slot-plr-item").innerHTML = this.renderFlagZoneHtml(this.plr);
    const plrEqCnt = getEquippedItems(this.plr).length;
    const plrFlagBadgeEl = document.getElementById("z-plr-flag-badge");
    if (plrFlagBadgeEl) {
      plrFlagBadgeEl.textContent = this.plr.godclock
        ? (this.plr.godclock.overgodActive ? "👑 Overgod \"0\" (Click for Banner)" : this.plr.godclock.awakened ? "👑 Endruler (Click for Banner)" : "⏳ Godclock (2x2)")
        : plrEqCnt > 0
        ? `🗡️ Items (${plrEqCnt}) / Flag 🔍`
        : "Flag / Item";
      plrFlagBadgeEl.style.pointerEvents = "auto";
      plrFlagBadgeEl.style.cursor = "pointer";
      plrFlagBadgeEl.onclick = (e) => {
        e.stopPropagation();
        this.openItemZoneViewer("plr");
      };
    }

    ["left", "center", "right"].forEach(pos => {   // the second center ("center2") is drawn inside the center zone
      document.getElementById(`slot-opp-${pos}`).innerHTML = pos === "center" ? this.renderCenterPairHtml("opp") : this.renderFieldCardHtml(this.opp, this.opp.monsters[pos], "opp", pos);
      document.getElementById(`slot-plr-${pos}`).innerHTML = pos === "center" ? this.renderCenterPairHtml("plr") : this.renderFieldCardHtml(this.plr, this.plr.monsters[pos], "plr", pos);

      const plrZoneEl = document.getElementById(`z-plr-${pos}`);
      const oppZoneEl = document.getElementById(`z-opp-${pos}`);

      const isCallHighlight = this.pendingAction && (
        (this.pendingAction.type === "call" && this.pendingAction.side === "plr") ||
        (this.pendingAction.type === "move" && pos !== this.pendingAction.fromPos && !this.plr.monsters[pos]) ||
        (this.pendingAction.type === "crossnize" && Array.isArray(this.pendingAction.validPositions) && this.pendingAction.validPositions.includes(pos))
      );
      plrZoneEl.classList.toggle("selectable", Boolean(isCallHighlight));
      plrZoneEl.classList.toggle("link-selected", this.linkAttackers.includes(pos));

      const isAttackTarget = this.pendingAction && (this.pendingAction.type === "attack" || this.pendingAction.type === "link_select") && Boolean(this.opp.monsters[pos]);
      oppZoneEl.classList.toggle("attack-target", Boolean(isAttackTarget));
    });

    document.getElementById("z-plr-item").classList.toggle("link-selected", this.linkAttackers.includes("item"));

    const canHitFighterDirect = this.pendingAction && (this.pendingAction.type === "attack" || this.pendingAction.type === "link_select") && !this.opp.monsters.center;
    document.getElementById("z-opp-fighter").classList.toggle("attack-target", Boolean(canHitFighterDirect));
    document.getElementById("hud-opp-target").classList.toggle("attack-target", Boolean(canHitFighterDirect));

    const handOwner = this.getFighter(this.handViewSide());
    const handEl = document.getElementById("bt-plr-hand");
    const handFrag = document.createDocumentFragment();
    handOwner.hand.forEach((cid, idx) => {
      const c = CARD_MAP.get(cid);
      if (!c) return;
      const cost = parseCardCost(c.cost, c.skill, handOwner, c);
      const isBuddy = isFighterBuddyMatch(handOwner.buddyId, c.id) && !handOwner.buddyCalled;
      const isYami = isYamigedoHalfId(c.id);
      const yamiReady = isYami && fighterHasBothYamigedoHalvesInHand(handOwner);
      const isSpecialFlag = [4569, 5760, 2789, 6202].includes(c.id);
      const div = document.createElement("div");
      div.className = "hand-card-item";
      div.onclick = () => this.onHandCardClick(idx);
      div.innerHTML = `
        <div class="hand-cost-tag">${isBuddy ? "🌟 BUDDY" : isSpecialFlag ? "🏳️ FLAG" : isYami ? (yamiReady ? "👹 2/2 READY" : "🔒 1/2 HALF") : `${cost.gauge}G`}</div>
        <img src="${c.img}" alt="${escapeHtml(c.name)}" />
      `;
      handFrag.appendChild(div);
    });
    // Hotseat: switch between the active player's hand and the waiting player's hand (to use a [Counter] on their opponent's turn)
    if (this.mode === "hotseat" && !this.matchOver) {
      const peeking = this.handViewSide() !== this.activeSide;
      const bPeek = document.createElement("button");
      bPeek.className = "secondary-btn";
      bPeek.textContent = peeking ? "🔄 Back to my hand" : "🔄 Other player's hand (⚡ Counter)";
      bPeek.onclick = () => this.togglePeekHand();
      handFrag.appendChild(bPeek);
    }
    handEl.replaceChildren(handFrag);

    if (this.mode === "online_p2p" && !this.isReceivingP2P && this.activeSide === "plr") {
      this.sendOnlineStateToPeer();
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
