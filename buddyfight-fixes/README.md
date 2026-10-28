# Buddyfight fixes (2026-10-29)

## How to apply
Copy everything in `files/` over the same paths in your repo, then commit.
This includes the hidden `files/.gitignore`.
`fixes.patch` contains the same changes as a diff, if you prefer `git apply fixes.patch`.

Changed: `game.js`, `abilities_parser.js`, `abilities_engine.js`, `abilities_more.js`, `index.html`
(the cache version is bumped so players' browsers load the new code).
New tests: `tests/p2p_room.js`, `tests/limits.js`, `tests/once_audit.js`. New: `.gitignore`.

## What was fixed

### Online play (game.js)
1. **A second player could take over a room.** The host now turns away anyone else while a friend is connected.
   A friend who rejoins mid-match gets the current board instead of restarting the match.
2. **"Could not join" popped up mid-match** on any network hiccup, and could even start a local battle.
   Errors after joining now show a "connection problem" message instead.
3. **A cut-in banner sent inside a board update** skipped the image check and echoed back to the sender. It now goes through the same safe path as other cut-ins.

### Card use limits
4. **Spell cast limits were never enforced (biggest bug).** "You may only cast X once per turn / fight" is on 472 spells.
   In testing, 255 of 257 could be cast again the same turn,
   and once-per-fight comebacks like **I'm Still Alive!**, **Return to Hades**, **Awakening** and **Kronos Syn Mobius** could be cast every turn.
   This is now checked when casting from hand, in counters on defense, and in counters that answer a cast.
5. **Monster call limits were never enforced.** "You may only call X once per turn / game" (26 testable monsters, 21 broken).
6. **"Once per fight" abilities were treated as once per turn** (21 abilities).
7. **Sun Fist, Bal Knuckle Charge** and **Dragon Force "Style of Partner"** now trigger once in the attack phase and once in the final phase.
   Before, they had no limit at all.

## Test results
All existing tests still pass. New tests: `p2p_room.js` 12/12, `limits.js` 5/5 (0 of 26 monsters and 0 of 374 spells can break their limit).
`smoke.js` / `smoke11.js` need Playwright (`npm i playwright`), which wasn't installed here, so they were not run.

## Unbuilt card abilities
See `unbuilt_cards.csv` (open it in Excel or Numbers): 2,611 cards, with the first sentence the engine can't read yet.
- 253 cards: no ability works yet.
- 2,358 cards: some abilities work, others don't.
- Abilities the engine doesn't fully understand are switched off, never run half-way. So these cards play as vanilla in those parts; they don't run with wrong conditions.

The biggest groups are Dragon World (472), Darkness Dragon World (260), Star Dragon World (244) and Hero World (243).
Run `node tests/abx_audit.js --top 60` to see the sentence patterns that would fix the most cards at once.
