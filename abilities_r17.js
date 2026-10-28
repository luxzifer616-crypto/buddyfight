/* ==================== ABX — round 17: "would be destroyed / would leave the field" ====================
 * Next family from tests/coverage.js (40 cards). The engine already runs these replacement effects
 * (abilities_r9.js: ABX.wouldLeaveSave, saveOnce); these cards used other wordings:
 *  - "When this card would be destroyed / leave the field, you may ... If you do, this card remains on the field."
 *  - "If your other «X» would leave the field", "When another monster on your field would be destroyed by your
 *    opponent's cards, you may put this card from the field into the drop zone. If you do, ..."
 *  - one-time saves: "the next time the chosen card would leave the field, it remains on the field instead",
 *    "nullify the destruction of this card", "the next time that that monster ..."
 * ("non-monster card" / "non-«X»" in the same cards is read by abilities_parser.js + matchFilter.)
 * Loaded after abilities_r16.js.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX;
  if (!ABX || !ABX.core || typeof battle === "undefined") return;

  const RW = [];
  const rw = (re, to) => RW.push([re, to]);
  // typos
  rw(/^((?:\[[^\]]+\]\s*)*)f a size (\d) monster on your field would/i, "$1If a size $2 monster on your field would");
  rw(/\bthe next time that that\b/gi, "the next time that");
  // self: "When this card would be destroyed / leave the field, ..." -> "If this card would ..."
  rw(/^((?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?)when this card would (be destroyed|leave the field),/i, "$1If this card would $2,");
  // guardians
  rw(/^((?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?)if your other («[^»]+»)(?: monsters?| characters?)? would (?:leave the field|be destroyed),/i, "$1If another $2 on your field would be destroyed,");
  rw(/^((?:\[[^\]]+\]\s*)*(?:"[^"]+"\s*)?)when another (monster|«[^»]+»(?: monster)?) on your field would be destroyed( by your opponent's (?:cards|card effects))?,/i, "$1If another $2 on your field would be destroyed$3,");
  rw(/\byou may put this card from the field into (?:the|your) drop zone\. if you do, (?:that card|it) remains on (?:the|your) field\b/gi, "you may put this card into your drop zone. If you do, that card remains on your field");
  // one-time saves
  rw(/\bthe next time (the chosen card|that card|it|this card) would leave the field,? (?:it|that card|this card) remains (?:on )?the field(?: instead)?\b/gi, "the next time $1 would be destroyed, it remains on the field");
  rw(/\bthe next time this card would be destroyed, nullify the destruction of this card\b/gi, "the next time this card would be destroyed, it remains on the field");
  rw(/\bwould leave the field it remains the field instead\b/gi, "would be destroyed, it remains on the field");

  function rewrite17(raw) {
    let s = String(raw || "");
    for (const [re, to] of RW) s = s.replace(re, to);
    return s;
  }
  const palPrev = ABX.parseAbilityLine;
  ABX.parseAbilityLine = function (rawLine, card) {
    const fixed = rewrite17(rawLine);
    const ab = palPrev.call(this, fixed, card);
    if (ab && fixed !== rawLine) ab.raw = ABX.clean(rawLine);
    return ab;
  };

  if (ABX.resetCaches) ABX.resetCaches();
})(typeof window !== "undefined" ? window : globalThis);
