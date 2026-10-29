# Buddyfight Engine (`ABX` & `IMX`) — Complete Ability Functions Specification & World Audit

This document provides the complete technical specification of all ability functions built across the Buddyfight engine (`abilities_parser.js`, `abilities_engine.js`, `abilities_ops.js`, `abilities_more.js`, `abilities_gkw.js`, `abilities_r9.js`–`abilities_r37.js`, and `impact_monsters.js`), the World-by-World completion audit, and the formal Buddyfight ability definitions (`Trigger`, `Cost`, `Condition`, `Target`, `Resolution Effect`, `Duration`) for both built and remaining unbuilt mechanics.

---

## 1. World-by-World Completion Status (Round 37 Audit)

Across the database of **6,078 cards with ability text** (**9,690 non-cost/non-reminder ability functions**):
- **Implemented & Verified Cards**: **5,104 / 6,078 cards (84.0%)**
- **Partially Done Cards**: **582 cards (9.6%)**
- **Not Started Cards**: **392 cards (6.4%)** (excluding `r22exec` / `r22static` keyword-guesser fallbacks)
- **Working Ability Functions**: **8,638 / 9,690 abilities (89.1%)** (**1,052** remaining unbuilt ability functions)

| World | Total Cards | Implemented & Verified | Partially Done | Not Started | Working Abilities | Missing Abilities |
|---|---|---|---|---|---|---|
| **Dragon World** (incl. dual-world Dragon cards) | 1,329 | 1,329 (100%) | 0 | 0 | 1,996 / 1,996 | 0 |
| **Star Dragon World** | 582 | 484 (83.2%) | 60 | 38 | 801 / 904 | 103 |
| **Darkness Dragon World** | 582 | 452 (77.7%) | 71 | 59 | 762 / 905 | 143 |
| **Hero World** | 477 | 363 (76.1%) | 78 | 36 | 682 / 804 | 122 |
| **Legend World** | 408 | 327 (80.1%) | 44 | 37 | 549 / 636 | 87 |
| **Katana World** | 396 | 307 (77.5%) | 45 | 44 | 517 / 612 | 95 |
| **Ancient World** | 386 | 327 (84.7%) | 31 | 28 | 534 / 598 | 64 |
| **Magic World** | 355 | 287 (80.8%) | 37 | 31 | 463 / 534 | 71 |
| **Danger World** | 295 | 242 (82.0%) | 32 | 21 | 427 / 482 | 55 |
| **Dungeon World** | 289 | 235 (81.3%) | 30 | 24 | 397 / 456 | 59 |
| **Generic** | 224 | 181 (80.8%) | 26 | 17 | 334 / 383 | 49 |
| **THE IDOLM@STER Cinderella Girls Theater** | 108 | 82 (75.9%) | 18 | 8 | 194 / 223 | 29 |
| **Detective Conan** | 104 | 83 (79.8%) | 16 | 5 | 167 / 191 | 24 |
| **BanG Dream! Girls Band Party! PICO** | 72 | 59 (81.9%) | 9 | 4 | 134 / 151 | 17 |
| **Lost World** | 66 | 50 (75.8%) | 10 | 6 | 93 / 111 | 18 |
| **Medabots** | 63 | 44 (69.8%) | 13 | 6 | 88 / 108 | 20 |
| **Sword Art Online** | 61 | 46 (75.4%) | 13 | 2 | 111 / 127 | 16 |
| **GeGeGe no Kitaro** | 61 | 50 (82.0%) | 8 | 3 | 92 / 103 | 11 |
| **SSSS.GRIDMAN** | 60 | 39 (65.0%) | 19 | 2 | 93 / 117 | 24 |
| **Other Dual-World Combinations** | 160 | 127 (79.4%) | 21 | 12 | 221 / 257 | 36 |

---

## 2. All Built Ability Functions (`ABX.OPS`, Triggers, Conditions & Static Auras)

Every ability in `ABX` is parsed into a formal structure:
- **`kind`**: `"cost"` | `"keyword"` | `"rule"` | `"static"` | `"triggered"` | `"act"` | `"spell"` | `"modal"`
- **`tags`**: Leading tags (`"counter"`, `"act"`, `"kw:g.evo"`, `"kw:g.boost-base-"`, `"kw:overturn"`, `"kw:overkill"`, `"kw:overthrow"`)
- **`once`**: `"turn"` | `"phase"` | `"game"` | `null`
- **`trigger`**: Event descriptor (`{ event, who, phase, self, np, ... }`) checked against `ABX.TRIG_OK` (51 supported trigger types)
- **`conds`**: Array of condition descriptors checked by `ABX.core.evalCond` against `ABX.COND_OK` (88 supported condition types)
- **`steps`**: Ordered execution steps run by `ABX.core.runSteps` via `ABX.OPS[step.op]` (151 built operations)

### 2.1 Core Resource, Life, Damage & Shield Operations (`abilities_ops.js`, `abilities_more.js`, `abilities_r9.js`, `abilities_r25.js`)

| Operation (`op`) | Parameters | Formal Definition (Cost / Target / Effect / Duration) |
|---|---|---|
| `draw` | `{ who: "you"\|"opp", n }` | **Effect**: Moves `n` cards from top of `who`'s deck to `who`'s hand (`n` can be fixed, `each`, `fromRef`, `lastCount`, `refStat`, `fromItem`). Blocked if `oppNoEffDraw` static is active on opponent's field. |
| `drawUntil` | `{ n }` | **Effect**: Draws cards from top of your deck until your hand size is `n` (or deck is empty). |
| `drawBottom` | `{ n }` | **Effect**: Draws `n` cards from the bottom of your deck into your hand. |
| `life` | `{ who: "you"\|"opp", n }` | **Effect**: Increases `who`'s life by `n`. Blocked if `ABX.lifeGainBlocked` (`noLifeGain` static) is active. Fires `ABX.fireLifeGain`. |
| `setLife` | `{ who: "you"\|"opp", n }` | **Effect**: Sets `who`'s life total directly to `n`. |
| `damage` | `{ who: "you"\|"opp", n }` | **Effect**: Deals `n` effect damage to `who` via `core.applyDamage` (respecting shields unless `ctx.unreducible` or `unreducibleTurn` is active). Fires `ABX.fireDamaged` and `effDamage`. |
| `shield` | `{ mode: "next"\|"turn"\|"nextTurn"\|"this", reduceBy, toZero, capTo, gainLife, from }` | **Effect / Duration**: Registers a damage shield on `ctx.f` that reduces incoming damage (filtered by `from`: `"attack"`, `"effect"`, `"notAttack"`, `"impact"`, or `"any"`) by `reduceBy`, to `0` (`toZero`), or caps it at `capTo` for the next instance (`"next"`/`"this"`), current turn (`"turn"`), or next turn (`"nextTurn"`). |
| `minShield` | `{ min, from, reduceBy, capTo }` | **Continuous**: Reduces incoming damage of `min` or greater by `reduceBy` (or caps it to `capTo`). |
| `shieldRev` | `{}` | **Effect / Duration**: For this turn, reduces damage you take by `1` for each time your flags have `[Reversal]` during this fight. |
| `lifeFloor` | `{ persist }` | **Effect / Duration**: For this turn, the next time (or every time if `persist: true`) your life would become `0`, your life becomes `1` instead. |
| `lifeLock` | `{}` | **Effect**: Marks damage dealt by this card so that if the opponent's life becomes `0`, it cannot be saved or changed by the opponent's cards (`abxLifeLocked`). |
| `noLose` | `{}` | **Effect / Duration**: Prevents you from losing the fight until the start of your opponent's next turn (`abxNoLose`). |
| `unreducibleTurn` | `{}` | **Effect / Duration**: For this turn, effect damage your cards deal to your opponent cannot be reduced. |

### 2.2 Cost Payment & Hand Manipulation Operations (`abilities_ops.js`, `abilities_r9.js`, `abilities_r25.js`)

| Operation (`op`) | Parameters | Formal Definition (Cost / Target / Effect / Duration) |
|---|---|---|
| `pay` | `{ gauge, life, restSelf, cost: true }` | **Cost**: Atomic check and payment of `gauge` (top of gauge to drop), `life` (subtracted from life), and/or `[Rest]` of `ctx.unit`. Returns `false` if unaffordable. |
| `restSelf` | `{ cost: true }` | **Cost**: Put `ctx.unit` into `[Rest]` if currently `[Stand]`. |
| `discard` | `{ n, self, all, np, cost: true }` | **Cost / Effect**: Discards `this card` from hand (`self: true`), all hand cards (`all: true`), or `n` chosen hand cards matching `np.filter`. Fires `ABX.fireDiscarded`. |
| `oppDiscard` | `{ n }` | **Effect**: Opponent chooses and drops `n` card(s) from their hand (checked against `handGuard` reveals and `abxHandSafe`). |
| `dropOppGauge` | `{ n, upTo }` | **Effect**: Drops `n` (or up to `n`) cards from your opponent's gauge into their drop zone; records count in `ctx.lastCount`. |
| `handReset` | `{ who: "you"\|"both", n }` | **Effect**: Discards entire hand and draws `n` cards for `you` or `both` fighters. |

### 2.3 Target Selection, Deck Inspection & Zone Movement Operations (`abilities_ops.js`, `abilities_r13.js`, `abilities_r23.js`)

| Operation (`op`) | Parameters | Formal Definition (Cost / Target / Effect / Duration) |
|---|---|---|
| `choose` | `{ np, bind: "chosen" }` | **Targeting**: Resolves candidates via `core.refsFor(s.np, ctx)` and prompts owner/bot via `core.pick`, storing chosen references in `ctx.bind.chosen`. |
| `look` | `{ n, who }` | **Effect**: Removes the top `n` cards of `who`'s deck into `ctx.bind.looked` (`pending: true`). Any unmoved cards return to the top of the deck after resolution. |
| `reveal` | `{ n }` | **Effect**: Reveals the top `n` cards of your deck into `ctx.bind.revealed` and `ctx.bind.chosen`. |
| `lookPick` | `{ n, np, to, rest, gainLife }` | **Effect**: Looks at top `n` cards of your deck, picks matching `np` to move to `to` (`hand`/`gauge`/`drop zone`), places the rest into `rest` (`deck` top/bottom in chosen order, or `drop zone`/`gauge`), and optionally gains `gainLife`. |
| `topOrBottom` | `{}` | **Effect**: Looks at the top card of your deck and puts it on either the top or the bottom of your deck. |
| `search` | `{ np, to, shuffle: true }` | **Effect**: Searches your deck for `np` (up to `np.qty.n`), moves chosen card(s) to `to` (or binds to `ctx.bind.chosen`), and shuffles your deck. |
| `move` | `{ np, to, order, verb }` | **Effect**: Moves chosen/bound `np` cards from their current zone to `to` (`hand`, `gauge`, `drop zone`, `deck` top/bottom, or `soul` of `self`/`chosen`/`hostNP`), respecting `isProtected` (`"returned to hand"` / `"put into the drop zone"`). |
| `moveSelf` | `{ to }` | **Effect**: Moves `ctx.unit` from the field to `to`. |
| `moveZone` | `{ from, to, n }` | **Effect**: Moves `n` cards from top of zone `from` (`gauge`/`drop`) to `to`. |
| `mill` | `{ who, n, to, hostNP }` | **Effect**: Puts top `n` cards of `who`'s deck into `gauge`, `drop zone`, `hand`, or `soul` (of `self` or `hostNP`). Fires `ABX.fireDeckToDrop` / `oppDeckToDrop`. |
| `deckToBottom` | `{ n }` | **Effect**: Moves top `n` cards of your deck to the bottom of your deck. |
| `shuffle` | `{ who }` | **Effect**: Shuffles `who`'s deck. |
| `deckToSoul` | `{}` | **Effect**: Puts your entire deck into `ctx.unit`'s soul (#5116 Vanity End Destroyer). |
| `soulToHand` | `{ n }` | **Effect**: Owner chooses `n` card(s) from `ctx.unit`'s soul and puts them into hand (#5116). |
| `soulFill` | `{ from, n }` | **Effect**: Chooses cards from `from` (`drop zone`/`hand`/`gauge`) and puts them into `ctx.unit`'s soul until its soul count reaches `n`. |
| `soulsToDeck` | `{}` | **Effect**: Chooses a card with soul on your opponent's field, returns all of its souls to their deck, and shuffles it. |

### 2.4 Field Control, Combat, Stat Modification & Call/Equip/Cast Operations (`abilities_ops.js`, `abilities_r9.js`, `abilities_r15.js`, `abilities_r21.js`, `abilities_r27.js`)

| Operation (`op`) | Parameters | Formal Definition (Cost / Target / Effect / Duration) |
|---|---|---|
| `destroy` | `{ np, orReturn, orDamage }` | **Effect**: Destroys target unit(s)/item(s) matching `np` (or lets player choose destroy vs. return to hand / deal damage), respecting `isProtected(unit, side, "destroyed", ctx)` and `[Soulguard]` / `wouldLeaveSave`. |
| `destroyBattleTarget` | `{}` | **Effect**: Destroys the monster currently in battle with this card. |
| `destroySet` | `{ who }` | **Effect**: Destroys all `[Set]` spells on `who`'s field. |
| `rest` / `stand` | `{ np, alsoBuddyZone }` | **Effect**: `[Rest]`s or `[Stand]`s target unit(s) on the field (respecting `isProtected(..., "rest")` and `abxNo.stand`). If `alsoBuddyZone: true`, also stands your buddy zone card. Fires `r24:rest` / `r24:stand` / `stoodByEffect`. |
| `standBuddyZone` | `{}` | **Effect**: Sets `ctx.f.buddyZoneRested = false`. |
| `boost` | `{ np, mods, each, alsoSelf, duration }` | **Effect / Duration**: Grants temporary (or static) `power`, `defense`, `critical`, and keywords (`[Penetrate]`, `[Counterattack]`, `[Double Attack]`, `[Triple Attack]`, `[Quadruple Attack]`, `[Hextuple Attack]`, `[Soulguard]`, `[Move]`), scaled by `each`, respecting `ABX.statLocked` on negative mods. |
| `loseKw` / `loseKwAttackers` | `{ kw }` | **Effect / Duration**: Removes keyword `kw` (`[Soulguard]`, `[Penetrate]`, etc.) from `ctx.unit` or all attacking cards for this turn (`abxLost[kw]`). |
| `nullifyAbilities` | `{ np, thenDestroy }` | **Effect / Duration**: Nullifies all abilities of target unit(s) matching `np` for this turn (`unit.abxNullified = B.turnCount`), respecting `isProtected(..., "nullified")`, and optionally destroys them (`thenDestroy`). |
| `dropSoul` | `{ hostNP, n, upTo }` | **Effect**: Drops `n` soul card(s) from target unit(s) matching `hostNP` into their owner's drop zone (skipping units protected against `"souls dropped"`). Fires `ABX.fireSoulToDrop`. |
| `call` | `{ np, pay, free, pos }` | **Effect**: Calls monster(s) matching `np` from `hand`, `drop zone`, `deck`, or `soul` (or `onTop` of a host monster), paying `[Call Cost]` if `pay: true` or free if `free: true`. Blocked if `ABX.effCallBlocked(ctx.side)` is active. |
| `callFromSoul` | `{ host, pay }` | **Effect**: Calls `this card` from the soul of `ctx.soulHost` to an open monster zone. |
| `equipFrom` | `{ np, ref, from, pay, upTo }` | **Effect**: Equips an item matching `np` (or `ctx.bind.chosen`) from `drop zone`, `hand`, or `deck`, paying `[Equip Cost]` if `pay: true`. Fires `ABX.fireEquipped`. |
| `transformSelf` / `transformFrom` | `{ np, areas, shuffle, free }` | **Effect**: `[Transform]`s into `this card` or a chosen card with `[Transform]` from `hand`, `drop zone`, or `deck`, paying or waiving its `[Transform]` cost (`abilities_r15.js`). |
| `castFrom` / `castFromSelfSoul` / `castSelfFromSoul` | `{ np, from, pay }` | **Effect**: Casts a spell from `drop zone`, `hand`, or `soul` by paying its `[Cast Cost]`. |
| `nullifyAttack` | `{ unlessLink }` | **Effect**: Nullifies the current attack in `ABX.battleCtx` (unless `unlessLink: true` and it is a link attack, or `ABX.attackUnnullifiable(bc)` is true). |
| `endBattle` / `endPhase` / `endTurn` | `{ phase }` | **Effect**: Immediately ends the current battle (bypasses `attackUnnullifiable`), phase (`main`/`attack`/`final`), or turn. |
| `extraPhase` | `{ what: "attack"\|"turn" }` | **Effect**: Grants an additional attack phase after this phase or an extra turn after this turn. |
| `redirectAttack` / `redirectPos` | `{ toChosen, toFighter, toSelf, pos, np }` | **Effect**: Changes the attack target in `ABX.battleCtx` to `this card`, `the chosen card`, `you` (the fighter), or the monster in `pos`. |
| `mustAttack` | `{ alone }` | **Effect / Duration**: Forces the chosen opponent's monster(s) to attack `ctx.unit` (alone if `alone: true`) first during this attack phase if able (`abxMustAttack`). |
| `saveOnce` / `preventLeave` | `{ np, life, kw }` | **Replacement Effect**: Replaces the next destruction of `np` this turn (or current destruction in `wouldLeaveSave`) so the card remains on the field, optionally gaining `life` and granting `[Counterattack]`. |
| `restrict` | `{ np, kinds, byOpp, duration }` | **Effect / Continuous**: Applies restrictions/protections (`attack`, `stand`, `destroyed`, `returned to hand`, `rest`, `nullified`, `put into the drop zone`, `put to other areas`, `leave the field`) to `np`. |
| `setSize0` / `becomeSizeZero` | `{ np, whileName, allCalled, delta, origSize, origLe, leftRightOnly }` | **Effect / Duration**: Sets called/chosen unit(s) to size 0 until they leave the field (or while `whileName` is on the field), or reduces size of matching monsters for this turn. |
| `placeAt` / `moveSelfTo` / `swapLR` / `oppToCenter` / `moveSelfToOppOpen` | `{ pos }` | **Effect**: Moves a unit between monster zones (`left`, `center`, `right`), swaps your left and right monsters, moves an opponent's side monster to their empty center, or moves `this card` to an opponent's open left/right as an oppressed area (`abilities_r21.js`). |
| `rps` | `{}` | **Effect**: Plays Rock-Paper-Scissors with the opponent and stores `"win"`, `"lose"`, or `"tie"` in `ctx.rps`. |
| `declareType` | `{ two }` | **Effect**: Prompts player to declare a card type (`monster`, `spell`, `item`, `impact`) and stores it in `ctx.declared`. |
| `winGame` / `loseLater` | `{}` | **Effect**: Wins the fight immediately (`winGame`), or causes you to lose at the end of your next turn (`loseLater`, #3812). |

---

## 3. Formal Definitions of the RemainingUnbuilt Ability Families & Open Clarification Questions

Per the `buddyfight-engine-dev` workflow, before coding the remaining **1,052 unbuilt abilities**, here are the formal definitions of the major unbuilt mechanical families and the specific questions that require your confirmation so we never guess or assume rules:

### Family 1 — `[Ambush]` Mechanic (16 abilities across Katana World / Dungeon World)
- **Affected Cards**: `#2804 Oni Boss, Kid Ibuki`, `#2868 Lesser Fiend, Amanojaku`, `#2869 Dark Arms, Soaring Blade`, `#2872 Red Lady Oni, Kureha`, `#2875 Dusk Fiend, Yagyo`, `#2964 Fiend of Ailments, Affliction Oni`, `#2966 Body of Dark Arms, Kid Ibuki`, `#3604 Blue Fiend, Kid Kuma`, `#3927 Grudge Fiend, Hannya`, `#3958 Lady Oni, Uji Bridge Princess`, `#4022 Yatsuka Fiend, Tsuchigumo`, `#4026 Oni Horde, Underworld Legion`, `#4027 Dark Arms, Demonic Poison Fumes Cube`, `#4178 Rampaging Evil Demon, Akuro-oh`, `#4766 Mountain Deity Oni Blade, Kid Ibuki`, `#6497 Oni Boss, Kid Ibuki "Re:B"`.
- **Formal Definition**:
  - **Ability Type**: Keyword (`[Ambush]`) + Auto Trigger (`When this card enters the field` / `When a monster enters your field by [Ambush]`).
  - **Trigger**: When a face-down card in a monster/spell/item soul that has `[Ambush]` is put into the drop zone (when the host leaves the field or has its soul dropped).
  - **Resolution Effect**: Call that `[Ambush]` card from the drop zone onto your field by paying its `[Call Cost]`, and mark `unit.abxEnteredByAmbush = true` so `"if this card entered by [Ambush]"` bonus effects and `"When an «Oni Assassin» enters your field by [Ambush]"` triggers fire.

### Family 2 — Cards Under the Opponent's Flag / «Curse Dragon» (20 abilities in Darkness Dragon World)
- **Affected Cards**: `#4942`, `#4943`, `#4997 Sentence of Curse`, `#4998`, `#4999`, `#5000`, `#5006`, `#5039`, `#5058`, `#5061`, `#5063`, `#5064`, `#5065`, `#5066`, `#5067`, `#5068`, `#5069`, `#5070 Curse Field`, `#6363`, `#6364`, `#6424`.
- **Formal Definition**:
  - **State**: `fighter.flagUnderFaceUp` (array of card IDs placed face up under a fighter's flag).
  - **Effects & Conditions**: Putting cards from top of opponent's deck or opponent's field face up under their flag (`putUnderOppFlag`), counting `e.flagUnderFaceUp.length >= N` (`oppUnderFlagCount`), triggering when a card is put under opponent's flag (`#5070 Curse Field`), and winning the fight at the start of opponent's turn if 15+ cards are under their flag (`#4997 Sentence of Curse`).

### Family 3 — `"Magic Treasure"` Face-Down Spell Zone Mechanic (8 abilities in Magic World)
- **Affected Cards**: `#5968 Grand Phantom Thief, Winds Harry`, `#5969 Sky Castle of Drago Phantom Thief, "Lebla Maurice"`, `#5970 My Funny Venus`, `#5972 Steal Time, "We say good bye!"`, `#5973 Chaser Beetle`, `#5989 Adorable Phantom Thief, Sophie Parker`, `#6169 Dignified Phantom Thief, Bellamy Heart`.
- **Formal Definition**:
  - **Effect**: Places cards from top of opponent's deck or opponent's drop zone face down into opponent's `setSpells` area marked with `{ isMagicTreasure: true, name: "Magic Treasure" }`.
  - **Triggers & Conditions**: Fires `magicTreasurePlaced` when placed (`#5970`, `#5989`, `#6169`) and counts `"Magic Treasure"` on opponent's field (`#5972`, `#5973`, `#5989`).

### Family 4 — Oppressed Areas / «Drametal» & «Lostknight» (12 abilities in Star Dragon World & Lost World)
- **Affected Cards**: `#4677`, `#4697`, `#4699`, `#4702 Grandmaster Cane`, `#4861`, `#4965`, `#5004`, `#5043`, `#6154 Zug Zwang`, `#6374`, `#6448`, `#6449`.
- **Formal Definition**:
  - **State & Condition**: Tracks whether you have an oppressed area (`hasOppressedArea`) and whether a specific unit is currently on an oppressed area (`unitOnOppressedArea`).
  - **Triggers & Effects**: End-of-turn triggers on oppressed areas (`#4677`, `#4697`, `#5043`, `#6374`), continuous boosts to monsters on oppressed areas (`#4699`, `#6449`), and standing a «Drametal» monster + dealing 1 damage if it is on an oppressed area (`#4702`, `#6154`).

### Family 5 — Face-Down Token Monsters & Face-Down Soul/Buddy Zone Cards (26 abilities across Katana, Darkness Dragon, Cinderella Girls, Conan, Dungeon)
- **Affected Cards**: `#330`, `#3521`, `#4682`, `#4770`, `#5023`, `#5193`, `#5199 Criminal`, `#5219`, `#5225`, `#5445`, `#5446`, `#5465`, `#5483`, `#5507`, `#5628`, `#5643`, `#5649`, `#5852`, `#5924`, `#6349`, `#6447`.
- **Formal Definition**:
  - **Token Monsters**: Puts a card from hand, top of deck, or opponent's drop zone face down into a monster slot as a monster with specified `size`, `power`, `defense`, `critical`, and `attrs` (e.g., `«Dragod» size 0 / 6000 / 6000 / 2`).
  - **Face-Down Buddy Zone / Soul**: Tracks face-down cards in `f.buddyZoneFaceDown` (Cinderella Girls `#5445`, `#5446`, `#5465`, `#5483`, `#5507`, `#5628`, `#5643`) and face-down soul cards (`#5193`, `#5199 Criminal`, `#5219`, `#5225`).
-*/
