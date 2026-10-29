# «Chaos» tribe — definitions of the missing abilities

64 abilities on 55 cards that have the «Chaos» attribute or "Chaos" in their name (all worlds), missing on 2026-10-29.
One line per ability: **#card** — when → what. "You choose" = the owner picks. **JC** = judgment call.
**Can't build yet** = needs a game mechanic that doesn't exist (listed at the end). Not tested yet (by request).

**Progress:** 64 → 17 missing (`abilities_r36.js`). Left: the 16 under "Can't build yet", and #4104 (its line still
isn't reaching the new [Call Cost] rule).

## Triggers
- **#3641** When monsters on your field attack → top card of your deck into your gauge. Once per turn.
- **#3709** When your center monster attacks, if this card is on your left or right → destroy a monster on your opponent's field (you choose).
- **#3819** When your center monster attacks, if this card is on your left or right → for this turn, that monster gets [Double Attack].
- **#3787** When your center monster is attacked → for this turn, the attacking card loses [Penetrate].
- **#3789a** When your center monster attacks and destroys your opponent's monster → deal 2 damage.
- **#3789b** When the attack of your center monster is nullified → put a card from your opponent's gauge into their drop zone.
- **#3345** When this card's attack destroys a monster or deals damage to your opponent → destroy a monster on their field.
- **#4082** (soul) When the monster this card is in is attacked → you gain 1 life. Once per turn.
- **#4105** When you equip an item → destroy a size 2+ monster on your opponent's field. Once per turn.
- **#4116** When a "Mini Geargod" monster is destroyed from your field → top card to gauge, draw. Once per turn.
- **#4122** When your "Infinity the Chaos" attacks → destroy a monster on your opponent's field.
- **#3650** If this card enters the field during your opponent's turn → you may call a size 3 or less «Chaos» from your drop zone to your center, free.
- **#4088** Enters → top card to gauge; then, if it entered by a card effect, draw.
- **#3641b** (drop zone) In your main phase, when a size 3+ monster enters your field → you may pay 1 life to cast this card from the drop zone.

## Effects
- **#3192** Enters → put cards from the top of your deck into your gauge equal to your other monsters.
- **#3379** Deal damage equal to the total critical of your center monster(s).
- **#3388** [Counter] [Act] Put this card into the drop zone; if you do, this turn all cards on your opponent's field lose [Penetrate].
- **#3392** Enters → gain life equal to the monsters on your center.
- **#3393** [Counter] [Act] Move this card from your left or right to your center (counts as [Move]).
- **#3412** Gain 1 life; top cards into your gauge equal to the monsters on your field.
- **#3441** Put all souls of a card on your opponent's field into their drop zone; if one or more, draw.
- **#3534** Enters → look at up to 5 top cards, put them back in any order (you choose), draw; then you may call a monster from hand paying.
- **#3705** (counter) Destroy a monster on your opponent's field ("Destory" typo).
- **#3800** When your opponent's cards attack → change the target to this monster.
- **#3825 / #5341** [Overkill] … then, if your opponent's cards attacked 6+ / 4+ times this turn, end the turn.
- **#3828** [Counter] [Act] During an attack in your opponent's turn, you may pay 1 gauge and 1 life → nullify the attack. Once per turn.
- **#3940** [Overkill] (main phase, discard 1) Equip up to one «Chaos» item free and call up to one «Chaos» monster free from your deck; shuffle.
- **#4095** Enters → draw cards, or gain life (you choose), equal to your «Hundred Demons» monsters.
- **#4100** (counter) Choose a card on your opponent's field: this turn, when it attacks → put a card from your opponent's gauge into their drop zone and deal 1 damage.
- **#4102** [Counter] [Act] Choose a monster on your opponent's field; you may discard a card; if you do, return it to hand. Once per turn.
- **#4121** Destroy a size 3 or less monster; then gauge cards or life (you choose) equal to its size.
- **#6497b** [Act] (hand) Choose your «Oni Assassin» monster and reveal this card → put it face down into that monster's soul; then draw.
- **#3925 / #5362 / #6489** You may cast a «Plague» spell from this card's soul paying its [Cast Cost] (used as an [Act]).
- **#4071** If this card would leave the field → you may destroy a size 3 or less monster of yours; if you do, it stays.

## Continuous
- **#3429** 'Shadow Dive': this card can attack your opponent through a center monster.
- **#3643** All your center monsters can attack your opponent through a center monster. **#3796** (spell) same, this turn.
- **#3641c** 3+ damage dealt to you by monster effects becomes 0.
- **#3735 / #4076** The gauge cost of this card's [Equip Cost] / [Cast Cost] is reduced by 1 per card / monster on your field.
- **#4104** With an item equipped, this card's [Call Cost] gauge is reduced by 1.
- **#4050** While its critical is 3+ and it attacks alone, its damage can't be reduced.
- **#3866a** Cards on your opponent's field can't [Move] or be returned to hand. **#3866b** Your opponent can't call from the drop zone.
- **#5707** If your items have souls, this card is size −2 on the field.

## New mechanic: [CHAOS Territory] (built)
On 26 Geargod / Mini Geargod cards: "If this card is on your center, you can put two monsters on your center, including
this card." While a [CHAOS Territory] monster is on your center, your center has a second area ("center2"): a monster
can be called there; each of the two is its own monster (own stats, attacks on its own, can be attacked on its own);
both count as "on your center". If the first one leaves, the second moves up. Size limits are the flag's
("The Chaos": total size 99). The bot doesn't use the second area yet. Test: `tests/chaos_territory.js`.

## New mechanic: "Infinity the Chaos" second flag (built, `abilities_r37.js`)
With "The Chaos" (#3337) as your flag, "Infinity the Chaos" (#3941) starts face down under it and "The Chaos Upgrade"
(#4072) is shuffled into your deck. Casting the Upgrade with 10+ cards in your drop zone flips it face up on top: your
flag becomes "Infinity the Chaos" (cards that check "your flag is "Infinity the Chaos"" now see it) and your size limit
becomes ∞; it also searches up to one "Geargod". Under either Chaos flag, size 30+ monsters can't be destroyed or have
their abilities nullified by effects. **Not built:** #3941 attacking as a card (it would need its own attacker slot —
the item slot is used by weapons).

## New mechanic: more than one item (built, game.js `item2`, `abilities_r37.js`)
While #3728 "Laevateinn" is on your field, or #6512 is in your buddy zone, a second item goes to a second item slot
(drawn side by side); each keeps its stats and attacks on its own. Both also stop you putting monsters on the field.
#3728: items in your hand cost 1 more gauge; [Overkill]s of #3728, #6512, #4115 equip into the slots.
shortcut: two item slots, not "any number". Test: `tests/chaos_flag_items.js`.

**Progress:** 64 → 8 missing. Left: [Ambush] parts (#2804, #2966, #4766, #6497), #3741, #4078, #3923 (flip the
opponent's flag face down), #3941 attacking.

## Can't build yet (missing game mechanics)
- **[Ambush] entry** (the game has no [Ambush]): the "if it entered by [Ambush]" parts of #2804, #2966, #4766, #6497a.
- **More than one item**: #3728 (×3), #6512 (×2), #4115.
- **Flag face down / cards under the flag**: #3923, #3941 (×2), #4072.
- **#3741** (save by returning 3 cards to the deck) and **#4078** (soul dropped from a «Plague» by the opponent): need the save / soul-drop hooks extended.
