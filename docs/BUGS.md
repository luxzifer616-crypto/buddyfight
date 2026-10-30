# Open bugs (ability system) - audited 2026-10-29

## How to fix one (saves tokens)
1. New Claude Code session in this folder, `/model sonnet`, paste: `Fix B1 in docs/BUGS.md. Follow CLAUDE.md.`
2. When it commits, open a NEW session, `/model opus`, paste: `Review the last commit for B1 against the card text in docs/BUGS.md. Run its test and node tests/bugfixes.js. Report problems only.`
3. Tick the box below. One bug per session.

## Reported by you
- [x] B1 "Come to hand at end of turn" abilities do not fire. Commit bbe5aca says it fixed endTurn return-to-hand: first write a headless test; if it already passes, just tick it. -> Verified fixed by bbe5aca; regression test tests/b1_eot_hand.js (#5185, #2645 own+opp turn, #6036) passes.
- [ ] B2 Counter skills/abilities cannot be used on the opponent's turn. Not tested yet. Test style: tests/counter.js. Engine: abilities_engine.js (counter / defense options).
- [x] B3 During a fight a player cannot open a card's skill banner to read its skill when it is not their turn. -> Fixed in game.js: `onHandCardClick` / `onZoneClick` no longer bail out when `isLocalTurn()` is false (bot / online friend / match over); they open the banner read-only, and `openCardBanner` only builds hand/field action buttons on a local turn (a bot's own units used to show Attack/Act buttons). Test: tests/b3_inspect.js.

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

## Chaos review, wave 2 (fixed, tests/chaos_review.js)
- #3441 Soul Reset: "all souls" now drops every soul (parser n:99 was ignored by the r38 dropSoul override) and sets lastCount so the "draw a card" step runs.
- #3195 / #3373: "enters the field on your left or right" trigger now parses its position (was firing on any position).
- #3409: "power +2000 for each monster on your center" (equals-to-number-of boost) parses correctly.
- #3850 / #3851 / #3852 Mini Geargod: payment is optional; moving itself to the drop zone and destroying the chosen card only happen if you paid ("if you do").
- Generic destroy now destroys a chosen [Set] spell (previously silently skipped).

## Chaos review, wave 3 (fixed, tests/chaos_review2.js)
- "...cannot be nullified / reduced if it is attacking alone": the "alone" part was dropped when the ability also had an "If you have ..." condition (#3369, #4050). Overkill acts #3915 and #4092 never gave the unnullifiable-when-alone effect at all (now added).
- #5357 Overkill: [Stand] all Chaos was missing, and "all Chaos" (no «») parsed with an empty filter so critical+1 hit every monster. Now stands and boosts only Chaos.
- #5710: "If your flag is \"Dungeon World\"" condition was lost on the Demon Lord size reduction (it applied under every flag). Same loss exists on #4503, #5337, #5628, #6214 (other worlds, not fixed yet).
- #4091: only a called Demon Lord becomes size 0 (a called Chaos monster no longer does).
- #4019: Overkill "nullify a card ... and destroy it" never destroyed anything (the chosen card was not remembered).
- #3737 Gravity Rest: "[Rest] that monster" did nothing (the entering monster is now bound as "that monster" for other-enter triggers).
- #3741: Death Tallica's leave-the-field save (3 monsters/«Deep» from drop to deck bottom) was never wired.
- #3643: "damage equal to that card's critical" after destroying it dealt 0. #3743: "gain life equal to the number destroyed" gained 1.
- Spells with a conditional "this card cannot be nullified" (#3929, #1948, #2313, #2375, #2440, #3015, #2356, #6039) were ALWAYS un-nullifiable; the condition is now evaluated.
- Verified OK without changes: #3594, #3595, #3769, #3976, #5344, #4046, #3464, #4114 (parse only), #5710 call.
- Pre-existing failures found while regressing (not from these changes): tests/round20.js ("drop a soul" skips #6214), tests/round22.js (#99 Champion Wrestler Asmodai).

## Lost World review (72 cards)
Fixed (tests/lost_world.js): #5012 return-to-hand + draw lock (+#548), drop-zone phase triggers (#5110 +10), #5047 life per Lostvader, modal triggers on attack/battle-end/leave (33 cards), free calls skip soul cost, "that monster" after a call (#4604), #6435 draw gate, #4591/#5769 opponent drops two, "two or more «X»" cast rule (19 cards), timing calls #4941/#5013/#6440, #5116 hand-to-soul cost, #5107 static front-nullify, Belost: removed invented +2 life/draw, once per fight enforced.
Open: Belost is still activated via the game's draw/hand-click prompt rather than strictly at the end of the opponent's turn.

## Thunder Empire (attr ThunderEmpire, 317 cards)
- [x] TE1 #3631 attack-based gauge cost cut, #3812 "put all field cards into drop" cost, #4070 "cannot be called" - fixed in abilities_r41.js, test: tests/thunder_empire.js. Scan: 310 done, 0 partly, 0 none, 7 no effect text.

## [Counter] spells on the opponent's turn
- [x] Hand [Counter] spells the engine owns (ABX.ownsCounter) were never offered in the defense window (only the old text classifier was used): now offered via ABX.counterSpellOption when conditions + cost pass (sweep: 415 -> 1019 of 1794 counter cards offered; the rest need an equipped item / tribe / soulguard attacker etc.). Test: tests/counter_free.js.
- [x] Non-attack [Counter] spells (destroy, draw, call, life, gauge) can be cast from the hand banner ("Counter" button) on the opponent's turn when no defense prompt is open (ABX.freeCounterOption / castFreeCounter).
- [x] Bot / auto-play "harm" picks no longer destroy the caster's own cards while an enemy card is a candidate (autoPick).
- [x] Monster / item [Counter] [Act] on the field that does not need an attack (destroy, draw, call, life, gauge ...) can be used on the opponent's turn from the card's banner (ABX.freeFieldCounterOptions / useFreeFieldCounter). Sweep: 253 of 656 [Counter][Act] monsters/items have a usable free option in a bare setup (rest need a condition / an attack). Test: tests/counter_free_field.js.
- Open: no pass/priority window at each phase change, attack declaration and resolution (the Counter button is only reachable by tapping a hand card). Impact [Counter] cards (70) are still only offered in the final phase response window. Hand-banner Counter button is not yet usable for online P2P opponents' turns (local engine only).
- [x] #3894 Life in Space Colony ([Counter] [Act] top-or-bottom): the op ignored ABX.autoPlay and waited on a prompt nobody answers in auto-play / headless (fieldcounter_sweep "attack never resolved"). Live game was not affected (a real prompt opens).
- [x] [Set] spells: the "50 counter spells the engine can't run" are [Set] spells whose [Counter] [Act] already runs from the [Set] zone (the engine only 'owns' spell bodies, and a [Set] spell's body is the keyword). Real gap was using them outside an attack: [Set] zone banner now shows a Counter button on the opponent's turn (sweep: 30 [Set] spells added, 283 of 697 monsters/items/[Set] spells have a free option).
- [x] Hotseat: the waiting player's hand was never shown, so the opponent's-turn [Counter] button was unreachable. New "🔄 Other player's hand (⚡ Counter)" toggle under the hand (game.handViewSide / togglePeekHand, resets each turn). Test: tests/hotseat_counter.js. Note: it shows that hand on the shared screen.
- [x] Cast requirements were read from the WHOLE skill text: an effect branch ("... if you have 2 life or less, draw a card" #3144, "... if your flag [Reversal] ..." #6029) became a cast requirement, "do not have a monster in the center" (#217, #1610) could demand the opposite, "on your center" wording was missed (Shield spells #467, #753, #2182, #3034 ... could be cast with a center monster), and "attacking your monster with a Weapon" (#286) matched "attacking you". Now evaluateCardConditions reads the "only cast ..." sentence only, and the engine's own cast conditions also gate the known attack-cancel spells in the defense window. 53 cards changed cast eligibility (A/B over all 6573 cards on 4 boards). Tests: tests/counter_cond.js, tests/counter_cond_sweep.js (counter spells offered on some board: 940 -> 955 of 976; the 21 left need G.BOOST / flag Reversal / tribe-count state). tests/counter.js is flaky on #1429 (random deck top), with or without this change.
- [x] Impact [Counter] spells (engine-owned, not impact monsters) were never offered on defense: now offered in the defense window and as the opponent's-turn Counter button during the Final Phase (same rule as the spell response window). Sweep: 35 of 39 offered while defending in the Final Phase, 31 castable freely (the rest need an attack / a condition). Classified attack-cancel impacts keep their any-phase rule. Test: tests/counter_impact.js.
- [x] Online P2P: the opponent's-turn Counter buttons (hand / field / [Set]) only changed the local state and the waiting player's changes are not synced to the peer, so they are hidden in online_p2p (local, hotseat and bot games keep them). Test: tests/counter_online_guard.js. Open: real P2P sync (a P2P_FREE_COUNTER message) would be needed to enable them online; not testable headless.
- [x] tests/counter.js no longer flaky on #1429 (the deck top is now a monster).
- [x] The 21 counter spells still hidden in tests/counter_cond_sweep.js are correctly gated on state the sweep cannot build (G.BOOST used / on field, Flag [Reversal] count, 3 tribe monsters, a named monster, buff spells needing a tribe defender). Verified both ways in tests/counter_state.js.
- [x] Counter window while the bot plays: at the end of the bot's Main Phase and before its turn ends, a human with a usable free [Counter] (hand spell / impact, field or [Set] ability) gets a use-or-Pass prompt (battle.botPriority -> ABX.priorityWindow). No prompt when nothing is usable; none in online P2P or hotseat. Test: tests/priority_window.js (includes a whole bot turn). Open: no prompt at the start of each bot attack (the defense window already covers attacks) and none during the human's own turn.
- [x] Verified (tests/counter_state.js, 18 checks): every state-gated counter spell from the sweep is blocked on a plain board and offered once its state exists - G.BOOST used (5141 5580 5791), G.BOOST card on field (5803 6038 6039 6041 6042), Flag [Reversal] (5975 6155 6190 6206), 3 «Genesis Dragon» (5235), Oppress monster (6154); 6467's hand line is a "during your turn" spell and its [Counter] [Act] is offered from a monster's soul. 6041 is a damage-reduction spell, offered only when attacked directly. The 5 tribe-buff spells (38 275 279 359 365) are offered when a matching tribe monster defends.
- [x] "About 50 counter spells the engine can't run": there are 50 [Set] counter spells and all 50 abilities are executable (0 not executable); 33 are offered from the [Set] zone on some board. The other 17 are passive [Set] effects that merely mention [Counter], or acts with their own timing (e.g. #1421 "during the main phase of your opponent's turn", #3324 "during your attack phase"). Not an engine gap.

- FIXED #1086 Damage Control (and 3825, 4112, 5343, 5677): `[Counter] [Act]` / Overkill-type acts whose text says "during your opponent's turn" lost that timing in the parser (no cond), so the own-turn "Use [Set] Card Ability / [Act]" offered them in the main and attack phases. `abilities_r41.js` now adds `{t:"turn",who:"opp"}` at parse time; the [Set] and field banners hide the act button when only the timing blocks it. Test: `tests/counter_timing.js`.

## Dimension Dragon review (49 cards, tests/dimension_dragon.js)
- [x] «Dimension Dragon» or "Lost World" filter was AND-matched (#4606 #4620 #4909 #4655 #5807 never found a card): parser now emits filter.anyOf. "Put the rest" no longer skipped when an "up to one" pick took nothing (runSteps `lookRan`).
- [x] #4625 Agonia: "put from the field into the drop zone" now fires for effects/costs (OPS.move wrapper in r24) and retires (call over a card, size limit in game.js); `ABX.fireLeave(..., notDestroyed)` skips destroyed-only triggers for those.
- [x] #4633 Zorune (looked cards go back on top before the draw, draw gated on the drop), #4668 Deugaine (hand [Counter][Act] redirect used ctx.unit = null, now the called zone), #6458 Deily (modal `repeatLW`: Lost World = choose 3 times, else once).
- Note (not fixed): look-and-return at the end of runAbility (`unshift` loop in abilities_engine.js runAbility) puts unmoved looked cards back in reversed order. Legal ("any order") but surprising.
