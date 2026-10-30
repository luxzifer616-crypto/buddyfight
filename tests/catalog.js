// node tests/catalog.js - keyword-indexed card catalog sanity checks
global.window = global;
require("../cards_data.js");
const ABX = require("../abilities_parser.js");
const CardCatalog = require("../card_catalog.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("FAIL", m)); };

const db = CardCatalog.fromGlobals();
ok(db.size === window.BUDDYFIGHT_CARDS.length, "all cards indexed");
const na = db.find({ any: ["nullifies attack"] });
ok(na.length > 100, "nullifies attack has many cards: " + na.length);
ok(na.every(e => e.hasKeyword("nullifies attack")), "index matches entry keywords");
const cd = db.find({ all: ["counter", "check deck"] });
ok(cd.length > 0 && cd.every(e => e.hasKeyword("counter") && e.hasKeyword("check deck")), "all[] intersection: " + cd.length);
ok(db.find({ any: ["counter"], none: ["nullifies attack"] }).every(e => !e.hasKeyword("nullifies attack")), "none[] excludes");
ok(db.find({ all: ["draw"], type: "Spell", limit: 3 }).length <= 3, "limit/type filter");
ok(db.get(6) && db.get(6).abilities.length > 0, "get(id) returns entry");
console.log(db.keywordCounts().slice(0, 12).map(k => k.keyword + ":" + k.count).join("  "));
console.log("uncategorized with skill text:", db.uncategorized().length);
console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
