# Ability definitions

Every card ability is defined here in plain words **before** it is built. Each definition says when it happens, what it
does step by step, who chooses, and what happens in edge cases. Open questions (things the card text does not settle)
are marked **Judgment call** so they can be checked. Each definition has a matching check in the card's test.

---

## #5116 Vile Demonic Husk Deity Dragon, Vanity End Destroyer

Monster · 70000 / 1000 / 2 · Test: `tests/vanity_end.js`

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only call "Vile Demonic Husk Deity Dragon, Vanity End Destroyer" once per game. | After you call one copy, you cannot call any copy again for the rest of the game, even if the first one left the field. | Already worked (`getCallLimit` = "game") |
| 2 | [Call Cost] [If you have one or more hand cards, put all of them face down into its soul] | Calling it costs no gauge. When it is called, **every card left in your hand** (not counting this card) goes face down into its soul. With an empty hand it can still be called, and nothing moves. | Built (was ignored: hand stayed) |
| 3 | When this card enters the field, put your entire deck face down into its soul. | When it enters the field by any means, **every card in your deck** goes face down into its soul. Your deck becomes 0 cards. | Built (only moved 1 card) |
| 4a | You cannot lose the fight, … | While this card is on your field, you **do not lose** when your life is 0 or less, and you **do not lose** for having no cards in your deck. Drawing with an empty deck just draws nothing. The moment it leaves the field, the normal checks apply again, so if your life is 0 or your deck is empty then, you lose. | Built (was the Round 22 guess; you lost at 0 life) |
| 4b | … this card on the field cannot have its abilities nullified or its souls dropped by your opponent's card effects. | Your opponent's card effects cannot nullify this card's abilities, and cannot drop (send to the drop zone) cards from its soul. Your own effects still can. | Built (Round 20 protection kinds "nullified" + "souls dropped") |
| 5 | "Dimension Door -Desist-" At the start of each player's turn, put a soul from this card into your hand. | At the start of **your turn and your opponent's turn**, **1 card** from its soul goes into your hand. It is not optional. **You choose** which card (they are your own cards). If the soul is empty, nothing happens. | Built (was sending the soul to the drop zone, and only firing on the opponent's turn: the engine read "each player's turn" as "opponent's turn" — fixed for all 62 such abilities) |
| 6 | [Triple Attack] | It can attack up to three times per turn. | Already worked |
| 7 | [Soulguard] | When it would be destroyed and it has a soul, drop one soul instead and it stays. | Already worked |
| 8 | [Lifelink Lose] | When it is destroyed, you lose the fight. (It is off the field then, so ability 4a no longer protects you.) | Already worked (`ll_lose`) |

**Judgment calls**
- **5 — who picks the soul card:** you choose (the bot takes the first card). The text says "a soul" without "random"
  or "top", and the cards are your own.
- **Soulguard's free soul:** the game gives every [Soulguard] monster 1 soul from the top of the deck when it is called
  (a house rule in `completeMonsterCall`, applied to all cards). It still happens here, before ability 3 moves the rest
  of the deck, so the soul ends up with the same cards either way.
- **Size:** the card data has no size (`size: null`), so it counts as size 0. Not changed here.

---

# Batch 1 — partly-working cards: "Choose and use one of the following" (8 cards)

**Status: proposed, not built yet — waiting for your check.** In every card below, the parts marked ✅ already work;
the parts marked 🔨 are what will be built. "Modal" means: when you use it, you pick exactly one option, then only that
option happens.

## #2439 Demon Slay Interment Formation (Spell)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only cast this card if you do not have a monster in the center. | You can cast it only while your center is empty. | ✅ |
| 2 | [Cast Cost] [Pay 1 gauge & Pay 1 life] | Pay 1 gauge and 1 life to cast it. | ✅ |
| 3a | · Destroy all monsters on your opponent's field with defense lower than the power of the «Weapon» on your field! | Look at the power of your «Weapon» on your field. Destroy every monster on your opponent's field whose current defense is **strictly lower** than that power. With no «Weapon» on your field, nothing is destroyed. | 🔨 |
| 3b | · Destroy all spells on your opponent's field! | Destroy every spell on your opponent's field (their [Set] spells). | 🔨 |

**Judgment call:** if you have more than one «Weapon» on your field (item and monster), use the **highest** power.

## #3005 Genocide Punisher!! (Impact)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only cast this card if both players have no monsters on the center. | Castable only while both centers are empty. | ✅ |
| 2 | [Cast Cost] [Pay 2 gauge] | Pay 2 gauge. | ✅ |
| 3a | - If your opponent has 3 life or less, deal 3 damage to your opponent!! | If your opponent has 3 life or less, deal 3 damage to them. Otherwise nothing happens. | ✅ |
| 3b | - [Counter] "Counter Final!!" You may only use this when your opponent casts an impact. Deal damage to your opponent equal to the number of different cards with "Purgatory Knights" in their card names in your drop zone!! | This option can be picked **only as an answer when your opponent casts an impact** (at [Counter] timing, during their turn). Count the **different card names** containing "Purgatory Knights" in your drop zone; deal that much damage to your opponent. | 🔨 |

**Judgment call:** casting it in answer to the opponent's impact still needs both centers empty (ability 1 applies to
every cast).

## #5125 "Friendship Blade" Deity Creations Fangflare, Gargantua Punisher!! (Impact)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only cast this card if no monsters are on your center, and a «Dragod» monster is on your field. | Castable only while your center is empty and you have a «Dragod» monster on your field. | ✅ |
| 2 | [Cast Cost] [Drop a "Deity Gargantua Punisher!!" from your hand] | Put a "Deity Gargantua Punisher!!" from your hand into your drop zone to cast it. | ✅ |
| 3a | - Destroy all cards on your opponent's field five times!! | Destroy every card on your opponent's field; **repeat 5 times**. Each repeat only hits what is still there (for example a [Soulguard] monster that stayed loses one soul each time). | ✅ |
| 3b | - Return all cards from your opponent's field to hand five times!! | Return every card on your opponent's field to its owner's hand; repeat 5 times (later repeats hit only cards that stayed). | 🔨 |

## #5371 Ghost Story Cornet Loop (Spell)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only cast this card during your opponent's attack phase. | Castable only in your opponent's attack phase. | ✅ |
| 2 | [Counter] | Can be cast at [Counter] timing. | ✅ |
| 3a | - Your opponent cannot cast events until the end of your next main phase. | From now until the end of **your next main phase**, your opponent cannot cast spells. | 🔨 |
| 3b | - For this turn, the next damage you take is reduced to 0. | The next damage you take this turn becomes 0. | ✅ |

**Judgment call:** "events" isn't a card type in this game; I read it as **spells**. (Impacts would stay castable.)

## #5560 Melody of the Evil Moon (Spell)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only cast this card during your opponent's turn, and if an «Evil Demonic Dragon» is on your field. | Castable only in your opponent's turn while you have an «Evil Demonic Dragon» on your field. | ✅ |
| 2 | [Counter] | [Counter] timing. | ✅ |
| 3a | - Draw a card, for this turn, the next damage you take is reduced to 0. | Draw 1 card; the next damage you take this turn becomes 0. | ✅ |
| 3b | - Pay as much life as you like. If you do, for this turn, the damage you take is reduced by the number of life you paid. | **You choose** how much life to pay (1 up to your life − 1). For the rest of this turn, **every** damage you take is reduced by that number. Paying 0 does nothing. | 🔨 |

**Judgment call:** you can't pay your last life point (paying to 0 would lose the fight).

## #5925 Special Signature to Save a Soul (Spell)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only cast this card if a [Rikka Takarada] or [Sho Utsumi] is on your field. | Castable only while one of them is on your field. | ✅ |
| 2 | [Counter] … You may only cast "Special Signature to Save a Soul" once per turn. | [Counter] timing; once per turn. | ✅ |
| 3a | - You gain 2 life for each different «Neon Genesis Junior High Student» in your drop zone! | Count the **different card names** of «Neon Genesis Junior High Student» in your drop zone; gain 2 life per name. | ✅ |
| 3b | - [Transform] into up to one "Gridman" from your hand or drop zone by paying its [Transform] cost. | You may [Transform] into one card with "Gridman" in its name from your hand or drop zone, paying its [Transform] cost. If you can't pay or have none, nothing happens. | 🔨 |

## #6154 Zug Zwang (Spell)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | You may only cast this card if a monster with "Oppress" is on your field. | Castable only while you have a monster with "Oppress" in its name on your field. | ✅ |
| 2 | [Counter] | [Counter] timing. | ✅ |
| 3a | - [Stand] a «Drametal» monster on your field. Then, if the card [Stand] is on an oppressed area, deal 1 damage to your opponent! | You choose a [Rest] «Drametal» monster of yours and [Stand] it. If that monster is on an **oppressed area** (an area of your opponent's field your card was put on), deal 1 damage to your opponent. | 🔨 |
| 3b | - For this turn, your opponent cannot call monsters by card effects. | For the rest of this turn, your opponent's card effects cannot call monsters (normal calls from hand still work). | ✅ |

## #6255 First Ace (Medachange) (Monster)

| # | Text | Definition | Status |
|---|---|---|---|
| 1 | This card on the field cannot be destroyed or [Rest] by your opponent's card effects. | Your opponent's effects can't destroy or [Rest] it. | ✅ |
| 2 | [Counter] [Act] … You may only use this ability once per turn. | Usable at [Counter] timing, once per turn; pick one option. | ✅ |
| 3a | - "Home Sick" Return all characters from your opponent's field to hand. | Return every monster on your opponent's field to its owner's hand. | ✅ (check) |
| 3b | - "Reflect" During the battle that this card is being attacked, nullify the attack, and destroy all attacking cards. | Only while **this card is being attacked**: nullify that attack and destroy every attacking card. | 🔨 |
| 3c | - "Tumble" [Rest] all characters on your opponent's field. | [Rest] every monster on your opponent's field. | ✅ |

**Judgment call:** "characters" = monsters only (an equipped item would also count in some readings — say if you want
it included).
