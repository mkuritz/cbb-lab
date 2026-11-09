# CBB Matchup Duel: Hub integration (preview, not published)
Base: main 55027a9. Branch preview/cbb-hub-duel-1106.

## Navigation
- `cbb-sidenav.js` builds an in-Hub sidebar from this repo's `SLTOP.by` and mounts the repo's `side.js`. The shared HQ remote script is unchanged.
- The duplicate section nav in the `#v2bar` top bar is hidden on index.html; the sport switcher and Ask stay.
- Duel = `index.html#duel`, active in the sidebar. Hash entries (#upsets, #segments, #hurdles, #class, #sim) keep the Hub tabs in sync, including on back/forward.
- `matchup-duel.html` is now a redirect page (`duel-redirect.js`): `?game=<digits>` becomes `duel_game` and `?team=<digits>` becomes `duel_team`; every other parameter is dropped.

## Metrics: what's shown and the local evidence for it
| field | local evidence | shown as |
|---|---|---|
| adjEM | adjO − adjD for all 361 rated teams in data/cbb.json, to 0.1 | quality, higher better |
| adjO / adjD | index.html footer ("efficiency (AdjO/AdjD)", points per 100 possessions vs avg D-I) and "Torvik O / D" column; Ratings: barttorvik.com | quality, higher / lower better |
| adjT | footer "Tempo (AdjT)"; enrich_cbb_hub.py L120 averages it as game pace (possessions) | style, never highlighted |
| threeRate / threePct / orbPct | enrich_cbb_hub.py L180-185 labels 3PAr / 3P% / ORB; footer says Four-Factors tags use preseason priors | descriptive, never highlighted |
| efg, ftr, tovRate, havoc40, barthag | team-level builder not in repo (havoc appears only as the label "Havoc") | omitted |

Rank universe: the 361 rated (`status==ok`) teams, stated as not a verified D-I census. The narratives compare only same-unit pairs (AdjO vs AdjD, AdjEM vs AdjEM, AdjT vs AdjT, 3PAr style).
The snapshot has no upcoming games, so the default game (Nov 2) is labelled "Historical game … not a current line or a pick". Any team pair not scheduled shows "Comparison only", with no model.

## Tests (all in-repo, jsdom/unit only)
- tests/hub_duel.cjs: 24/24 (sidebar mount, active state, no duplicate nav, 7 metrics, undocumented metrics omitted, historical label, hypothetical label, swap/team/game selectors, hash nav, back/forward, storage kept, redirect ID handling).
- tests/supported_visual_release.cjs: 44 (old standalone duel checks replaced by the integrated-route suite and redirect assertion). Dropped: the native player-modal dispatch from the old duel page; the new Duel has no player buttons.
- tests/matchup-dom.cjs: pass. Python builder tests via the repo's own runner (`python3 -m unittest discover -s tests -p 'test_*.py'`, as in package.json): 8 OK. pytest isn't installed and isn't required by the runner.
- No browser or screenshot verification is claimed.

## Aikido
- Changed files (cbb-duel.js, cbb-sidenav.js, duel-redirect.js, matchup-duel.html, navcfg.js, tests): 0 issues.
- index.html at base 55027a9: 12 findings (AIK_html_insecure-document-method, sev 80) at lines 41, 46, 48, 273(x2), 294, 300, 307, 314, 321, 329, 342(x2). The same 12 appear at the same lines in this branch. The only change to index.html is the script tags on line 1, so these are unchanged baseline findings, not regressions. Assessed risk: low/medium. Text is first-party data/cbb.json, mostly escaped with E(); some numbers (p.line, g.total) are concatenated raw, and the qrib/crib labels are static constants. Not suppressed, and not fixed here (outside integration scope).
