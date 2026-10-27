// Debug helper: node tests/abx_try.js "sentence text"   or   node tests/abx_try.js --card 5999
const path = require("path");
global.window = {};
require(path.join(__dirname, "..", "cards_data.js"));
const ABX = require(path.join(__dirname, "..", "abilities_parser.js"));
const a = process.argv.slice(2);
if (a[0] === "--card") {
  const c = window.BUDDYFIGHT_CARDS.find(x => x.id === +a[1]);
  console.log(c.name, "|", c.type); console.log(JSON.stringify(ABX.parseCard(c), (k, v) => (k === "src" ? undefined : v), 1));
} else {
  const ab = ABX.parseAbilityLine(a.join(" "), {});
  console.log(JSON.stringify(ab, (k, v) => (k === "src" || k === "raw" ? undefined : v), 1));
}
