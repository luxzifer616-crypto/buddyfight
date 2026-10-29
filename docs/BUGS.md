# Open bugs (ability system) - audited 2026-10-29

## How to fix one (saves tokens)
1. New Claude Code session in this folder, `/model sonnet`, paste: `Fix B1 in docs/BUGS.md. Follow CLAUDE.md.`
2. When it commits, open a NEW session, `/model opus`, paste: `Review the last commit for B1 against the card text in docs/BUGS.md. Run its test and node tests/bugfixes.js. Report problems only.`
3. Tick the box below. One bug per session.

## Reported by you
- [x] B1 "Come to hand at end of turn" abilities do not fire. Commit bbe5aca says it fixed endTurn return-to-hand: first write a headless test; if it already passes, just tick it. -> Verified fixed by bbe5aca; regression test tests/b1_eot_hand.js (#5185, #2645 own+opp turn, #6036) passes.
- [ ] B2 Counter skills/abilities cannot be used on the opponent's turn. Not tested yet. Test style: tests/counter.js. Engine: abilities_engine.js (counter / defense options).
- [ ] B3 During a fight a player cannot open a card's skill banner to read its skill when it is not their turn. Not tested yet. Look in abilities_ui.js and game.js (inspect).

## Failing tests found by audit (all also fail on older code, so not new regressions)
The test already exists. Check the test's expectation against the real card text first (query the card with node, never open cards_data.js), then fix the code or the test.
- [ ] T1 tests/round20.js - opponent's "drop a soul" skips 6214 but still hits a normal monster
- [ ] T2 tests/round22.js - #99 Champion Wrestler Asmodai discards hand and destroys opponent cards
- [ ] T3 tests/round39.js - #4195 One Who Leads equips two Hero items from drop zone into item and item2
- [ ] T4 tests/round5.js - "first destruction prevented, +1 life" (1 of 26 fails)
- [ ] T5 tests/vanity_end.js - 4b: opponent's effect cannot drop its souls (35 -> 34)

## Suspects from the crash sweep (card count changed during the ability; may be legitimate)
- [ ] S1 #4943, #5760, #2019, #867, #4569, #4997, #6363 - compare what each does with its card text

## Broken test scripts (not card bugs)
- [ ] tests/modal_partial.js: TypeError reading 'options'
- [ ] tests/would_destroy.js: does not finish within 35 s
- [ ] tests/smoke.js, tests/smoke11.js: need `playwright` (optional)

## Found by the 2026-10-29 audit (fixed)
- [x] [Purge] keyword (9 cards: 4433 4467 4468 4469 4481 4495 4518 6219 6417) had no engine function -> added counter [Act] in abilities_r41.js, test tests/purge.js
- [x] [Equipment Change] (20 cards) ignored its once-per-turn limit -> game.js equipCardFromHand, test tests/equip_change.js
- [ ] Other 'limit missing' lines in tests/once_audit.js are false alarms (keyword reminder text; Double Attack = 2 attacks, call limits handled in game.js getCallLimit)
- [x] "Infinity the Chaos" had no unlock: now a deck option (deck.infinityChaos, checkbox in Deck Edit for The Chaos), never in the play deck; "The Chaos Upgrade" cannot be cast without it under the flag and is no longer auto-added. Test tests/chaos_unlock.js
- [x] Card-data typos fixed at load (game.js CARD_TEXT_TYPOS): "Guage" #3193 #4733 (cost was 0), "Destory" #3705 #3710 (cost unparsed), "oponent" x5. Test tests/chaos_costs.js
- [x] #3728 / #4759 Laevateinn: equip only while you have no monsters (game.js costNeedsNoMonsters)
- [ ] #3650 Proto Chaos Machina: [Call Cost] [When a monster on your center is destroyed, pay 2 gauge] only charges 2 gauge; the "when center monster destroyed" timing is not enforced. Needs a ruling (same group: 24 other conditional call costs).
- [x] (Opus review of Chaos) boost "give it power+N, defense+N and [Keyword]" lost the numbers (53 cards game-wide) -> ABX.effectiveBoostMods, tests/boost_tail.js
- [x] (Opus review of Chaos) "At the end of the battle that this card attacked" fired for any attacker (parser test on "" -> self always false) and "If you do not, ..." was gated as "If you do" (20 cards, opposite effect) -> abilities_parser.js, tests/battle_end_gate.js
- [x] (Opus review of Chaos) "when a monster on your CENTER is destroyed" ignored the zone (6 cards: 932 2597 3608 4124 4964 5391) -> ABX.fireOtherDestroyed(pos), tests/destroyed_position.js
- [x] (Opus review of Chaos) #3820 / #2886 offered when a non-center monster is attacked -> game.js defense window
- [x] (Opus review of Chaos) parser: "give all «X» monsters on your field power+N and [kw]" lost the target (np "all"/"a"/"one"; 15 cards incl. 4017 4388 5233 3939 5340 5666-5669), "buddy on your field" junk, boost "equal to the number of monsters from among them" (3370) -> abilities_parser.js
- [x] (Opus review of Chaos) 2189 / 4089 destroyed only one of "a monster and a spell"; 3754 moved 2 of "two monsters and a spell" -> abilities_r41.js (r41DestroyOneSet). Tests tests/chaos_review.js
- [ ] Opus review claims NOT yet verified (see report in session): 3441 Soul Reset all souls, 3737 Gravity Rest target, 4019 Arabone bind, 3850-3852 optional package, 3409/3195/3373/3741/3369/3915/4050/4092 conditions, 5357 Overkill, 5710 flag cond, 4091 Demon Lord size 0, 4114 OR filter, 3464 Nine-headed sword
