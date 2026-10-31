// node tests/dragon_flags.js - deck legality for Dragon Ein / Zwei / Drei
// Ein: cards with "Dragon" in attribute (any type) + <Generic>. Zwei: Dragon Monsters + Impact monsters only. Drei: sub-flag of Zwei.
const { createEnv } = require("./headless.js");
const env = createEnv();
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : (fail++, console.log("FAIL", n, JSON.stringify(extra ?? ""))); };
const r = JSON.parse(env.run(`(function(){
  const ein=CARD_MAP.get(969), zwei=CARD_MAP.get(2370), drei=CARD_MAP.get(2789), einS=CARD_MAP.get(3060);
  const cards=window.BUDDYFIGHT_CARDS.filter(c=>c.type!=="Flag");
  const L=(c,f)=>checkCardLegalityForFlag(c,f).allowed;
  const bad={ein:[],zwei:[],einS:[]}; const cnt={ein:0,zwei:0};
  for(const c of cards){
    const dr=hasDragonInCard(c), gen=isTrueGenericCard(c);
    const expEin=(dr&&["Monster","Item","Spell","Impact"].includes(c.type))||gen;
    const expZwei=dr&&["Monster","Impact"].includes(c.type);
    const a=L(c,ein), b=L(c,zwei), s=L(c,einS);
    if(a!==expEin&&!(a&&!expEin)) bad.ein.push([c.id,c.type,expEin,a]);   // extra allowances (omni/dragod) tolerated
    if(b!==expZwei&&!(b&&!expZwei)) bad.zwei.push([c.id,c.type,expZwei,b]);
    if(s!==a) bad.einS.push(c.id);
    if(a)cnt.ein++; if(b)cnt.zwei++;
  }
  const pick=(f)=>cards.find(f);
  const dSpell=pick(c=>c.type==="Spell"&&hasDragonInCard(c)&&!c.omni&&!c.dragod), dImpact=pick(c=>c.type==="Impact"&&hasDragonInCard(c)&&!c.omni&&!c.dragod), dItem=pick(c=>c.type==="Item"&&hasDragonInCard(c)&&!c.omni&&!c.dragod),
        gMon=pick(c=>c.type==="Monster"&&isTrueGenericCard(c)&&!hasDragonInCard(c)&&!c.omni&&!c.dragod), nMon=pick(c=>c.type==="Monster"&&!hasDragonInCard(c)&&!isTrueGenericCard(c)&&!c.omni&&!c.dragod&&!/all flags/i.test(c.skill||""));
  return JSON.stringify({bad,cnt,
    einSpell:L(dSpell,ein), einImpact:L(dImpact,ein), einItem:L(dItem,ein), einGeneric:L(gMon,ein), einOther:L(nMon,ein),
    zweiSpell:L(dSpell,zwei), zweiImpact:L(dImpact,zwei), zweiItem:L(dItem,zwei), zweiGeneric:L(gMon,zwei), zweiOther:L(nMon,zwei),
    dreiInZwei:checkCardLegalityForFlag(drei,zwei).allowed, dreiInEin:checkCardLegalityForFlag(drei,ein).allowed,
    cfg:[getFlagConfig?1:0]});
})()`));
ck("Ein allows Dragon Spell", r.einSpell); ck("Ein allows Dragon Impact", r.einImpact); ck("Ein allows Dragon Item", r.einItem);
ck("Ein allows Generic (non-dragon) monster", r.einGeneric); ck("Ein rejects non-dragon non-generic", !r.einOther);
ck("Zwei rejects Dragon Spell", !r.zweiSpell); ck("Zwei allows Dragon Impact", r.zweiImpact); ck("Zwei rejects Dragon Item", !r.zweiItem);
ck("Zwei rejects Generic non-dragon", !r.zweiGeneric); ck("Zwei rejects non-dragon", !r.zweiOther);
ck("Drei is a legal sub-flag in Zwei only", r.dreiInZwei && !r.dreiInEin);
ck("Ein: every card matches the rule", r.bad.ein.length === 0, r.bad.ein.slice(0, 5));
ck("Zwei: every card matches the rule", r.bad.zwei.length === 0, r.bad.zwei.slice(0, 5));
ck("Dragon Ein (Summer) = Dragon Ein", r.bad.einS.length === 0, r.bad.einS.slice(0, 5));
console.log("legal cards  Ein:", r.cnt.ein, " Zwei:", r.cnt.zwei);
console.log(`pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
