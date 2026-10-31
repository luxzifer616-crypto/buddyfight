// node tests/catalog.js - keyword-indexed card catalog, checked against the FULL game (all round files loaded)
const fs = require("fs"), path = require("path");
const { createEnv } = require("./headless.js");
const env = createEnv();
env.run(fs.readFileSync(path.join(__dirname, "..", "card_catalog.js"), "utf8"));
const r = JSON.parse(env.run(`(function(){ const db=CardCatalog.fromGlobals(); const all=window.BUDDYFIGHT_CARDS;
  const na=db.find({any:["nullifies attack"]}), cd=db.find({all:["counter","check deck"]});
  return JSON.stringify({ size:db.size, total:all.length, unc:db.uncategorized().map(e=>e.id),
    na:na.length, naOk:na.every(e=>e.hasKeyword("nullifies attack")),
    cd:cd.length, cdOk:cd.every(e=>e.hasKeyword("counter")&&e.hasKeyword("check deck")),
    none:db.find({any:["counter"],none:["nullifies attack"]}).every(e=>!e.hasKeyword("nullifies attack")),
    lim:db.find({all:["draw"],type:"Spell",limit:3}).length<=3, get:!!db.get(6) });})()`));
const lg = JSON.parse(env.run(`(function(){ const db=CardCatalog.fromGlobals(); const ein=db.legalFor(969), zwei=db.legalFor('dragon zwei');
  return JSON.stringify({ ein:ein.length, zwei:zwei.length, einSpell:ein.some(e=>e.type==='Spell'), zweiSpell:zwei.some(e=>e.type==='Spell'&&!/all flags/i.test(e.card.skill||'')), zweiImpact:zwei.some(e=>e.type==='Impact'), einFlag:ein.some(e=>e.type==='Flag'), both:db.find({all:['legal: dragon ein','counter']}).length>0 }); })()`));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("FAIL", m)); };
ok(r.size === r.total, "all cards indexed " + r.size + "/" + r.total);
ok(r.unc.length === 0, "every card with skill text has a keyword; untagged: " + r.unc.join(","));
ok(r.na > 100 && r.naOk, "nullifies attack index: " + r.na);
ok(r.cd > 0 && r.cdOk, "all[] intersection: " + r.cd);
ok(r.none, "none[] excludes");
ok(r.lim, "limit/type filter");
ok(r.get, "get(id)");
ok(lg.ein > 3000 && lg.einSpell && !lg.einFlag, "legal: dragon ein " + lg.ein);
ok(lg.zwei > 2000 && !lg.zweiSpell && lg.zweiImpact, "legal: dragon zwei " + lg.zwei);
ok(lg.both, "legal: + ability keyword combine");
console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
