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
