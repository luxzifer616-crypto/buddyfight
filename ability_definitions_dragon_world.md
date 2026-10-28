# Dragon World — definitions of the missing abilities

224 abilities on 217 cards (Dragon World and cards shared with another world) that did not work on 2026-10-29.
Grouped by mechanism: each group is built by one handler. One line per ability: **#card** — when → what.
"You choose" = the owner picks (the bot picks for itself). **JC** = judgment call (the text leaves it open).
Not tested yet (by request); debug later.

**Progress:** 224 → 108 missing.
- `abilities_r26.js`: rewrites (once per main/final phase, drop two souls, equip "Fist" from the drop zone, [Stand]
  chosen card and this card, "if this is the attack phase", "no other monsters", Rock-Paper-Scissors wording, "When you
  use a …"), "… five times", "N+ world names of «X»", "you lose at the end of your next turn", size 0 for every card a
  call put on the field, Round 20 protections on [Set] spells and with "During your turn,".
- `abilities_r24.js`: new trigger events for groups A ([Move]), B (returned to hand), C (opponent's monster destroyed),
  D (attacks alone / link / "this card or a «Weapon»"), E ([Rest] / [Stand] by effects), F (damage other than by
  attacks); "If <event>, <effect>" lines re-read as triggers.
- `abilities_r25.js`: effect wordings (rewrites + rules for damage/gauge equal to a card's stat or the number
  destroyed, shields, both players charge, draw from the bottom, discard-and-draw, world-name counts, "opponent cannot
  draw by card effects", [G EVO] / weekday conditions) and the no-effect / deck-rule lines of group K.
- `abilities_r9.js`: "would be destroyed / would leave" saves (#1702, #3910, #3987, …) were being overwritten by
  Round 22's trigger guesser; they're listed as supported triggers again.
Still to build: the rest of groups D–J (must-attack-this-card, Rock-Paper-Scissors, world-name aliasing, size-0 calls,
"change the target", [Overturn] [Stand], …).

## A. "When … [Move]" triggers (new event: a monster changes area by [Move])

- **#1251** When this card [Move]s → put the top card of your deck into your gauge.
- **#1465** During your opponent's turn, when this card [Move]s → draw a card.
- **#3793** When this card [Move]s to the center → draw a card.
- **#2854** When this card [Move]s to your center → destroy a monster on your opponent's field (you choose).
- **#4244b** When this card enters the field or [Move]s → destroy a monster on your opponent's field (you choose).
- **#2418** When a monster with "Thunder Knights" in its name on your field [Move]s → put the top card of your deck into your gauge.
- **#4243** Same trigger → draw a card. Once per turn.
- **#1471** Same trigger → put a card from the soul of a card on your opponent's field into their drop zone (you choose). Once per turn.
- **#507** If your "Thunder Knights" monster [Move]s during your opponent's turn → put the top card of your deck into your gauge.
- **#3099** When a monster on your field [Move]s → for this turn, all cards on your field get power+2000 and defense+2000.
- **#6463** When a monster on your field [Move]s → for this turn, all "Thunder Knights" cards on your field get power+10000, defense+10000, critical+2, [Penetrate], [Double Attack]. Once per turn.
- **#4244a / #6324** [Counter] [Act] from your hand: if a monster of yours used [Move] this turn → call this card from your hand (#4244 free; #6324 paying its [Call Cost]). #4244 once per turn.
- **#657** [Act] Move this card to an open monster area on your field (works like [Move]). Once per turn.
- **#1484** When you are dealt damage, if your center is empty → you may move this monster to your center.

## B. "Returned to hand" triggers (new event: a card on your field goes back to hand / deck)

- **#454** When a monster on your field is returned to your hand or deck → for this turn, this card gets critical+1. Once per turn.
- **#492** Same trigger → put the top card of your deck into your gauge. Once per turn.
- **#886** When monsters on your field are returned to your deck or hand, while this card is on the field → you gain 1 life.
- **#1490** When your «Dragon Knight» on your field is returned to your hand → put the top card of your deck into your gauge. Once per turn.
- **#2482** When another card on your field is returned to your hand → put the top card of your deck into your gauge. Once per turn.

## C. "Your opponent's monster is destroyed" triggers

- **#2618** When your opponent's center monster is destroyed → for this turn, this card gets critical+1.
- **#2632** Same trigger → deal 1 damage to your opponent. Once per turn.
- **#4916** When a monster on your opponent's field is destroyed by your attacks or card effects → for this turn, this card gets critical+1.
- **#5090** Same trigger → put the top card of your deck into your gauge, and you gain 1 life.
- **#628** When an opponent's monster is destroyed by this card's attack → for this turn, this card gets [Double Attack].
- **#1928** When an attack by a «Sun Dragon» on your field destroys your opponent's monster → deal 1 damage to your opponent.
- **#4982** (in a «Dragonblood Sect»'s soul) During your opponent's turn, when your opponent's monsters are destroyed by your card effects → put the top card of your deck into your gauge, and you gain 1 life.
- **#6397** (in a «Dragonblood Sect» monster's soul) During your opponent's turn, when your opponent's monster is destroyed by your card effects → draw a card and deal 1 damage to your opponent. Once per turn.

## D. Attack triggers

- **#2510** When a «Sun Dragon» on your field link attacks → for this turn, this card gets power+2000 and critical+1. Once per turn.
- **#2511** Same trigger → put the top card of your deck into your gauge. Once per turn.
- **#3095 / #3983** When a monster on your field attacks alone → for this turn, this card gets power+3000 (#3095) / power+2000 (#3983).
- **#3635** When this card or a «Weapon» on your field attacks → put the top card of your deck into your gauge and deal 1 damage to your opponent.
- **#1934** When a "Bal Dragon" monster on your field attacks → for this battle, it gets critical+1. Once per attack phase and once per final phase.
- **#5104** When this card attacks, if you have a «Dragod» on your field → for this turn, critical+1 and [Double Attack].
- **#4649** When this card attacks, if you have 3+ gauge → for this turn [Double Attack]; then, if 5+ gauge, drop 1 of your opponent's gauge and deal 1 damage to them.
- **#4241** When this card attacks, if you have 3+ different world names in your drop zone or 4 life or less → for this turn, [Penetrate] and [Double Attack].
- **#4264** When this card attacks → put the top card of your deck into your gauge or this card's soul (you choose).
- **#4626** When this card attacks → look at the top 3 cards of your deck, put up to 1 into your hand, put the rest on the top or bottom in any order (you choose).
- **#3129** When this card attacks → destroy a monster or item on your opponent's field (you choose); if you do, deal damage equal to that card's critical.
- **#4582** When a «Dragod» on your field attacks → destroy a monster on your opponent's field; if you do, deal damage equal to its size.
- **#2336** When this card attacks → put up to 3 <Dragon World> or «Guardians» cards from your drop zone on the bottom of your deck (you choose, any order). If you put 3, return all cards on your opponent's field to hand and deal damage equal to the number returned.
- **#5026** When a «Dragod» on your field attacks alone → it attacks your opponent and all their monsters instead.
- **#5277** When this card attacks a monster alone → it attacks all your opponent's monsters instead.
- **#459** When this card link attacks with your buddy monster → for this turn, this card's power is infinite.
- **#6199 / #1007** When this card link attacks with you → that attack cannot be nullified and its damage cannot be reduced (#1007: [Counter] [Act], only if you have 5 life or less, pay 1 gauge and discard a card).
- **#3198** When this card link attacks with another «Adventurer» → choose an «Adventurer» on your field, you may pay 1 gauge; if you do, [Stand] it and this card. Once per turn.
- **#505** (spell) For this turn, when you attack with a «Weapon» → choose a soul of an opponent's monster and put it into the drop zone.
- **#2704** (spell) Choose a monster on your opponent's field. This turn, when a «Sun Dragon» attacks → destroy the chosen monster.
- **#3984** (spell) Choose a «Thunder Empire» on your field: for this turn its critical cannot be reduced by your opponent, and when it attacks → destroy a card on your opponent's field.
- **#4260** (soul) At the end of the battle the «Sun Dragon» this card is in attacked, if your opponent's center is empty → put the top card of your deck into your gauge and gain 1 life. Once per turn.
- **#2410a** At the end of the battle in which one or more of your items attacked → put this card from your field into your drop zone.
- **#5405** When this card is attacked → for this turn, nullify the [Penetrate] of the attacking cards.
- **#3951** When your opponent's cards attack → change the target of the attack to this monster.

## E. [Rest] / [Stand] triggers

- **#1475** When a «Dragon Knight» [Rest]s during your main phase → you gain 1 life. Once per turn.
- **#1838** When a «Dragon Knight» on your field is [Rest] by an effect → for this turn, this card gets power+2000 and [Penetrate]. Once per turn.
- **#3147** When a «Dragon Knight» on your field is [Rest] by a card effect → for this turn, this card gets [Double Attack].
- **#2703** When a card on your field is [Stand] by your cards' effects → put the top card of your deck into your gauge, or draw a card (you choose). Once per turn.
- **#4008** When a «Thunder Empire» on your field is [Stand] by card effects → [Stand] this card. Once per turn.
- **#5580** (spell) Draw a card; this turn, when a «Deity Dragon Tribe» on your field is [Stand] by card effects → deal 1 damage to your opponent. Once per turn.
- **#5598** (spell) This turn, all your «Deity Dragon Tribe» cannot be [Rest] or returned to hand by your opponent, and when one is [Stand] by card effects → you gain 1 life. Once per turn.

## F. Damage / life triggers and damage changes

- **#1706** If you are dealt damage other than by an attack → you gain 1 life. Once per turn.
- **#6191** When you take damage other than by attacks → you gain 2 life. Once per turn.
- **#3085** If you are dealt damage other than by an attack → put the top card of your deck into your gauge; for this turn this card gets power+3000. Once per turn.
- **#1464** When you would be dealt damage → you may pay 1 gauge; if you do, that damage is reduced by 1.
- **#3598** If you would be dealt 3+ damage and you have an item equipped → that damage is reduced by 2.
- **#456b** Damage dealt to you by link attacks becomes 2.
- **#6037** If your flags [Reversal]ed 2+ times this fight → this card gets power+5000, defense+5000, critical+1; if 3+ times, damage you take other than by your card effects is reduced by 2.
- **#6474** If this card has souls → damage dealt to you other than by your card effects is reduced by 3, and it gets power+10000, defense+10000, critical+2.
- **#2421** (counter) This turn, each damage you would be dealt is reduced by 1.
- **#1106** (counter) This turn, damage dealt to you by attacks becomes 0.
- **#4004** [Counter] [Act] Pay 1 gauge → this turn, damage dealt to you by attacks is reduced by 1. Once per turn.
- **#4201** (counter) This turn, you take no damage the next time; then, if you have a "Batzz" monster, draw a card.
- **#3813** (counter) Nullify the attack; then you may pay 1 gauge → the next damage this turn is reduced by 2.
- **#3052** (counter) This turn, the next time your life would become 0, you gain 2 life instead, then draw a card. Once per game.
- **#6189** (hand) If your life becomes 0 in stopped time → you may drop this card from your hand; if you do, your life becomes 1 and deal 5 unreducible damage to your opponent.
- **#2800** [Counter] [Act] discard this from hand → if your flag is "Dragon Zwei", the next damage this turn is reduced by 3; if "Dragon Drei", you gain 2 life.
- **#6197** (soul) Damage dealt to your opponent by card effects of the «Sun Dragon» this card is in cannot be reduced.

## G. Continuous boosts and size (statics with a condition)

- **#620** This card gets critical+1 for each «Dragon Knight» monster in your drop zone; its critical can't go above 6.
- **#875** If you have a «Weapon» equipped with 7000+ power → critical+1.
- **#1608** If you have an item with "Fist" in its name equipped → power+2000, defense+2000, [Move].
- **#3051** This card gets critical equal to the critical of your equipped "Fist" item.
- **#5331** If 2+ «Deity Dragon Tribe» monsters are on your field → critical+1.
- **#4779** If its soul has a "Deity Gargantua Punisher!!" → power+50000, critical+2, [Penetrate].
- **#4237** If the card in your buddy zone is [Rest] → [Penetrate], and its power is infinite.
- **#502** (spell, set) If both players have an item equipped → both items get critical+1.
- **#4199a** If you have monsters on your left and right → all monsters on your field get power+3000 and defense+3000.
- **#4199b / #5337** Size: if a "Batzz" monster is on your right (#4199) / on your field (#5337) → your "Drum" / "Bal Dragon" monsters (on your left for #4199) are size −1 (#4199) / −2 (#5337).
- **#3625** If 4+ different world names of «Thunder Empire» are in your drop zone → this card is size −2 on the field.
- **#1389 / #5354** If 10+ «Armordragon»/«Hundred Demons» cards (#1389) / 10+ cards (#5354) are in your drop zone → nullify this card's [Lifelink].
- **#456a** This card cannot be destroyed or returned to hand, and counts as a size 3 «Armordragon» monster on your field.
- **#1082** If today is Saturday → all monsters on your field get power+100 (uses the device's date).
- **#625 / #1080** "If your opponent is your child" → never true here (the game can't know). #1080's first part works: with an item on your field, power+3000.

## H. Protections and "cannot" rules

- **#4622, #5790, #6471** Round 20 protections, written in one sentence with an extra part (#6471: you may also equip one more "Jackknife" item).
- **#4014** During your turn, your «Autodeity Army» cannot be [Rest], returned to hand, or have abilities nullified by your opponent.
- **#6320a** During your turn, your "Thunder Flare" cards cannot be destroyed or [Rest] by your opponent, and your opponent cannot call monsters by card effects.
- **#3329** This card cannot attack your opponent's left or right, and cannot be destroyed by your opponent's spells.
- **#3115** This card cannot attack your opponent's left or right; while it attacks alone, your opponent cannot [Counter].
- **#3039** While this card attacks a center monster, your opponent cannot [Counter].
- **#6465** While this card attacks alone, your opponent cannot [Counter].
- **#3038 / #1479 / #609** Attack-cannot-be-nullified variants: link attacking with you (#3038); a "Fist" item attacking alone (#1479); alone, against "Dragon Shield" cards only (#609).
- **#1950** (spell) Choose a «Dragon Knight»: this turn, if it attacks alone, its attack can't be nullified.
- **#3810** (counter) Choose a size 2 monster of yours: this turn it can't be destroyed by attacks.
- **#471** (counter) This turn, the next time a size 2+ monster of yours would be destroyed, it stays.
- **#2410b** Your items can attack your opponent even if they have a center monster.
- **#2099** (counter) Choose a size 2 or less «Sun Dragon»: this turn it can attack your opponent through a center monster; at end of turn, put it into your gauge.
- **#548** Your opponent cannot draw cards by card effects.
- **#1422** Neither player can call size 1 or less monsters from the drop zone.
- **#597** Your monsters are not affected by "Day of the Dragon".
- **#1473** (spell) Draw a card; this turn, during battles where your cards link attack an opponent's monster, your opponent can't [Counter].
- **#5115** Your opponent cannot [Counter] this card (the rest already works).
- **#5800** When this card is dropped from your hand by your opponent's effect → draw 2; this turn your hand can't be dropped by your opponent.
- **#4070** This card gets the [Overthrow] of cards in its soul; you may use [Overthrow] twice this game.

## I. Enter-the-field and other one-shot effects

- **#559** Enters → you may reveal a «Dragon Knight» from your hand; if you do, put it into your gauge and draw a card.
- **#889** Enters → choose any «Dragon Knight» in your gauge, put them into your drop zone, then put that many top deck cards into your gauge.
- **#1081** Enters, if you have no item → you may equip a "Fist" item from your drop zone, paying its [Equip Cost].
- **#1083** Enters → draw from the bottom of your deck. Once per turn.
- **#1468 / #2631** Enters, if you have no other monsters → you may call a size 1 or less "Fifth Omni" (#1468) / «Dragon Knight» (#2631) monster from your drop zone, paying its [Call Cost].
- **#1493** Enters, with 6 life or less → search for up to one "Fifth Omni Dragon Lord, Drum"; if you took one, you take 1 damage.
- **#2090** Enters → destroy a monster in your opponent's center, or an item, or a spell on their field (you choose).
- **#2126** Enters → both players put the top card of their deck into their gauge.
- **#2406** Enters → put the top 2 cards of your deck into your drop zone; if both are monsters, this turn it gets power+2000.
- **#2512** Enters → [Stand] a «Sun Dragon» item of yours; this turn it can attack in your final phase.
- **#2968** Enters → choose any cards with power on your opponent's field with total power 15000 or less; destroy them.
- **#6462** Enters, or when you take damage → same, total power 50000 or less.
- **#3624** Enters → return a monster on your opponent's field to hand, or destroy it (you choose which).
- **#3949 / #6336** Enters / [Act]: put up to one «Thunder Empire» monster from your deck into your drop zone; this turn this card also has that card's world name. #6336 once per turn.
- **#4160** Enters → from your deck: up to 2 «Thunder Empire» monsters to your drop zone, up to 1 «Thunder Empire» item to your hand; shuffle.
- **#4455** Enters by [G EVO] → call up to 2 size 1 or less «Deity Dragon Tribe» from your drop zone to separate areas for free; they are size 0 until they leave.
- **#4574** Enters → destroy an opponent's monster; then, if it entered by [G EVO], destroy another.
- **#4635** Enters → this turn, critical+1; then, if it entered by a card effect, all your cards get critical+1 this turn.
- **#4671** During your attack phase, when a monster enters your field by [G EVO] → draw 2. Once per turn.
- **#4733** Enters → drop the top 3 cards; put up to one «Deity Dragon Tribe» monster from them into your hand; if it entered by [G EVO], put one more of them into your hand.
- **#6045** Enters → search for up to one «Deity Dragon Tribe» item; then, if a monster that is both «Dragod» and «Deity Dragon Tribe» is on your field and you have no item, you may equip an item from your hand, paying its [Equip Cost].
- **#3882** When a «Shadow Dragon» monster enters your field from your hand → put the top card of your deck into your gauge.
- **#4233** When a size 2+ «Sun Dragon» enters your field → put the top card of your deck into your gauge and draw. Once per main phase and once per final phase.
- **#504** When your «Armordragon» enters your left or right → you may pay 1 gauge to deal 1 damage. Once per turn.
- **#1578** (drop zone) When a "Drum" monster enters your field → you may pay 1 gauge; put this card into its soul, or call this card (you choose). Once per turn.
- **#1395** When a "Dragon"-attribute monster enters your opponent's field, or they cast a "Dragon"-attribute spell → deal 1 damage. Once per turn.
- **#5044** When a soul goes into your «Dragod» → top card to gauge, gain 1 life, draw. Once per turn.
- **#3722** When either player puts a card on the bottom of a deck → gain 1 life and return up to one monster from your opponent's center to hand. Once per turn.
- **#2897** When you cast a spell → top card to gauge; this turn this card gets [Double Attack]. Once per turn.
- **#608** When you use a "Dragonic Destroy" → deal 3 damage. Once per turn.
- **#1480** When this card deals damage, if you have an item → top card to gauge.
- **#633** When this card deals damage → you may discard 2 cards; if you do, deal damage equal to its critical. Once per turn.
- **#615** When this card is destroyed → you may put it into your gauge instead of your drop zone.
- **#1742** Destroyed by a card effect → draw. **#4161** Destroyed by card effects in the attack phase → draw.
- **#4896** Dropped from your hand, with a «Dimension Dragon» on your field → top card to gauge and draw; then, if your flag is "Lost World", draw.
- **#3992 / #3993** At the end of the turn this card was destroyed → you may call a "Flame Dragon, Burn" (paying) / "Fiery Fist Dragon, Burn Pound Dragon" (free) from your drop zone.
- **#5594** At the start of your attack phase → drop the top 3; if all have different names, put all 3 into your hand.
- **#6468** (buddy zone) At the start of your attack phase → this turn, a buddy on your field gets critical+2.
- **#5798 / #4456 / #4457 / #4936** At the start of your opponent's attack phase → choose a [Stand] monster (#4936: all) on their field; it must attack this card (alone) first if able. #4457 / #4936 also nullify its abilities this turn. #4936 also: this card [Counterattack]s all attacking monsters.
- **#1254** When your "Fist" item would be destroyed → you may put this card into your drop zone; if you do, return that item to your hand.
- **#1702** If a size 3 monster on your field would be destroyed → you may put this card into your drop zone; if you do, it stays.
- **#3910 / #5334 / #3987** If another «Thunder Empire» (#3910 also items; by your opponent) / «Autodeity Army» (#3987) would leave / be destroyed → you may put this card into your drop zone; if you do, it stays.

## J. Counter spells, spells and [Act]s

- **#476** [Counter] [Act] With 3 life or less → you may reveal its soul; call up to one «Armordragon» from it paying its [Call Cost], then destroy this card.
- **#483** (counter) Move an «Armordragon» of yours to the center and make it the attack's target.
- **#1486** (counter) Change the attack's target to you, and draw a card.
- **#2485** (counter) Return a monster with 5000 or less defense on the field to hand, or destroy it (you choose).
- **#2634** (counter) Nullify the attack; both players put their top card into the drop zone; if it's a monster, that player takes damage equal to its size.
- **#2861** (counter) Destroy all monsters on your opponent's field; put that many top cards into your gauge.
- **#3034** (counter) Nullify the attack; then, with 1 gauge or less, top card to gauge and gain 1 life.
- **#3124** (counter) Destroy a monster of yours; gain 2 life and put cards equal to its size into your gauge.
- **#3812** (counter) Discard your hand, draw 6; this turn you can't be dealt damage; at the end of your next turn you lose. Once per game.
- **#3814** (counter) Gain 2 life; then, with 5 life or less or a "Dragonic Heal" in your drop zone, gain 3 more. Once per turn.
- **#3888** (counter) Destroy up to N of your opponent's cards (N = cards dropped by its [Cast Cost]); gain life and deal damage equal to the number destroyed.
- **#4253** [Counter] [Act] discard from hand during an attack in your opponent's turn, with 3+ world names in your drop zone → nullify the attack; draw if you have an "Azi Dahaka" on your field or drop zone.
- **#4257** (counter) Nullify the attack; then: «Sun Dragon» on your field → draw; «Neodragon» → top card to gauge; «Black Dragon» → gain 1 life (each that applies).
- **#4259** (counter) [Stand] a «Sun Dragon» of yours; then, if your opponent's center is empty, deal 1 damage.
- **#4580** (counter) Drop the top 4; choose up to one «Dragod» from them: into your hand, or call it on top of a «Deity Dragon Tribe» monster, paying its [Call Cost]. Once per turn.
- **#568** [Counter] [Act] When you are attacked → you may discard a «Dragon Knight» and pay 1 life; if you do, nullify the attack.
- **#677** [Act] You may drop 2 souls from this card; if you do, destroy an opponent's monster.
- **#2252** [Act] Pay 1 gauge and drop your top 2 cards; if you do, destroy an opponent's item. Once per turn.
- **#3274** [Counter] [Act] Choose a "Jackknife" monster in this card's soul; this turn this card gets all its abilities. Once per turn.
- **#3994** [Counter] [Act] (drop zone) For this game: when a size 3 «Fire Dragon» of yours is destroyed, you may discard a «Fire Dragon» to call this card from your drop zone for free. Once per turn.
- **#4774** [Counter] [Act] You may destroy another «Armordragon» of yours; if you do, [Stand] this card; then, in the attack phase, draw.
- **#5358 / #5359** [Act] Choose a world (listed); this turn this card also has that world name. Once per turn.
- **#6320b** [Counter] [Act] During either attack phase: look at the top 5, call up to 2 «Thunder Empire» from them to separate areas paying their costs (size 0 until they leave); the rest go to the bottom. Once per turn.
- **#6393** (counter) Call a «Dimension Dragon» or «Lostvader» from your drop zone paying its cost; then you may reveal a "Lost World" from hand; if you do, this turn they can't be destroyed, returned, or nullified by your opponent.
- **#6459** [Counter] [Act] During your turn, you may pay 1 gauge: your life becomes 5, search for up to 2 differently-named "Jackknife" cards; then equip up to one "Jackknife "Gold Ritter"" from hand for free. Once per turn.
- **#6466** (counter) Top 2 cards to gauge; call up to one each of "Drum", "Bal Dragon", "Batzz" monsters from your drop zone to separate areas, paying their costs; size 0 until they leave. Once per turn.
- **#6562** [Counter] [Act] Choose a size 2 "Garga" or a "Destroyer" monster in your drop zone; you may pay 1 gauge to call it on top of this card for free.
- **#1421** [Counter] [Act] During your opponent's main phase → call a size 2 or less "Thunder Mine" monster from your drop zone, paying its cost. Once per turn.
- **#525** Put your opponent's center monster on their left or right (you choose an open one), and deal 3 damage.
- **#1330** Deal damage equal to the total critical of a monster and an item on your field (you choose); can't be reduced.
- **#1749** Each player discards their hand and draws 4. Once per turn.
- **#3627** If your flag is «Divine Guardians»: choose a card on your field, deal damage equal to its critical. If «Searing Executioners»: deal damage equal to the times your cards attacked this turn.
- **#3746** Deal damage equal to the different world names in your drop zone.
- **#4228** Draw cards equal to the different world names on your field. Once per turn.
- **#469** Draw 2. Once per turn.
- **#5597** (counter) Draw a card, then choose one of two options (option 2 unread — see the card). Once per turn.
- **#5125** Choose-one: see Batch 1 in ability_definitions.md.
- **#3596 / #3629** [Overturn] (pay 1 gauge [+ discard] in your attack phase) → [Stand] all your cards (#3596) / a «Thunder Empire» and this card (#3629).
- **#2051** You may call "Jackknife" monsters from your hand without paying the gauge in their [Call Cost].
- **#6468** see F/I.

## K. Rules, jokes and promo text (no game effect beyond the rule)

- **#468** You may cast any number of "Dragoenergy" at once → treated as a deck/timing rule; no effect to run.
- **#496** You may only have one "Green Dragon Knights "Song of Ancient Lands"" on your field → checked when [Set].
- **#579** If fewer than 4 buddies are in your deck, you may have up to one "My Buddy!" → deck-building rule.
- **#1490b** Stray "[Set]]" text → keyword typo, ignored.
- **#675 / #5112** Rock-Paper-Scissors: #675 when link attacked, if you win, nullify that link attack; #5112 when attacking: win → gain 3 life, draw 3; draw → gain 1 life, draw 1.
- **#3591, #4875, #6469** Promo/thank-you text → no effect.
