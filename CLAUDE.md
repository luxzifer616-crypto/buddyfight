# Buddyfight fan game

Browser card game (Future Card Buddyfight). Plain static JS/HTML, no build step, hosted on GitHub Pages.
Current focus: **card ability functions** (~9.7k abilities, ~89% built) and fixing ability bugs.

## Run / test
- Serve: `python3 -m http.server 8765` (see `.claude/launch.json`).
- Tests are headless Node (no browser): `node tests/<name>.js`. They load the real game scripts via `tests/headless.js` (`createEnv()` -> `run(js)`, `flush()`).
- After any change run the one relevant test plus `node tests/bugfixes.js` (must stay `fail 0`). Never run all 60 tests unless asked.

## Code map (read only the file you need)
- `cards_data.js` - 9.7 MB, ONE line, `window.BUDDYFIGHT_CARDS`. NEVER open it. Query it with node, e.g. `node -e` + `JSON.stringify` on one card id.
- `game.js` (~9.3k lines) - battle engine, turn flow, phases, UI, online (PeerJS) play.
- `abilities_parser.js` - turns card skill text into `{kind, steps:[{op}]}` ability objects (global `ABX`).
- `abilities_engine.js` - runs ability steps, triggers, counters, defense options.
- `abilities_ops.js`, `abilities_more.js`, `abilities_gkw.js`, `abilities_r9.js` ... `abilities_r41.js` - add/override ops and per-card abilities in "rounds". Later rounds load later and win. A new fix usually goes in the newest round file or the file that owns the op.
- `abilities_ui.js` - ability prompts, banners, skill inspect.
- `impact_monsters.js` - `IMX`, impact monster logic.
- `index.html` - script load order. Every script has `?v=YYYYMMDDx`; **bump the `v` of any JS file you change** or players keep the old cached file.

## Docs (open only when the task needs them)
- `ability_functions_reference.md` (21 KB) - op/trigger spec and per-world status.
- `ability_definitions*.md` - formal ability term definitions.
- `docs/BUGS.md` - open bug list. Update it when a bug is fixed.
- Do NOT read: `missing_abilities_by_world.md`, `remaining_abilities.csv`, `buddyfight-fixes/` (old patch drop), `CardSprite/`, `Sprite/`, `audio/`.

## Working rules (save tokens)
1. Find code with `grep -n` / Grep with a tight pattern and a line limit. Read ranges (offset/limit), not whole files. `game.js` is 400 KB.
2. For a bug: write a small failing headless test first (copy the style of `tests/counter.js` / `tests/bugfixes.js`), then the smallest fix, then rerun.
3. One bug or one card group per session. Report in 2-3 lines: what changed, test result. No recaps of the code.
4. Prefer edits (diffs) over rewriting files. Do not reformat untouched code.
5. Do not add new `abilities_rNN.js` files for a single fix unless the existing owner file is wrong for it; if you do, add its `<script>` to `index.html` in order.
6. Commit small, one fix per commit.
