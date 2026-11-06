# CBB player-profile Matchup tab — LOCAL PREVIEW ONLY

No push, deployment, workflow, or model changes. NHL's `Profile | Matchup`
interaction is reproduced in the shared CBB modal, not in a new standalone
profile. The original Profile body is unchanged (DOM-compared to commit 143008a).
Clicking a player stays on the current page. Both tab rows support arrow keys,
Home/End, selected state, and labelled panels; Profile remains the default.

## Run / verify

```sh
npm ci --ignore-scripts
python3 scripts/build_matchup_analyzer.py
npm test
# Optional local preview (no publishing):
python3 -m http.server 8766 --bind 127.0.0.1
# Open /players.html, find Milan Momcilovic, click his name, then Matchup.
```

The analyzer is loaded before the shared modal on all seven pages using `cbb.js`:
players, props, matchups/index, team, teams, transfers, and method. New/changed
scripts and modal CSS are cache-busted. Matchup data is lazy-loaded once per page.
The builder is intentionally **not wired to any deployment workflow**.

## Important data gap: do not describe this as a fully populated analyzer

`data/cbb.json` was built **Oct 22, 2026, 1:38 PM ET**. It publishes prior-season
player aggregates and next-season projections, but **no current-season per-game
player logs**. Its 20 opening-slate games are already past. The published
`upset_radar` contains additional future scheduled-game metadata; the new builder
uses only game identity/time/team/neutral fields from those records, never their
scores, probabilities, tiers, or projected tempo.

The generated snapshot has 8,159 distinct team/player identities, zero players
with valid game logs, 29 future scheduled games, 984 profiles with a future game
but insufficient logs, and 7,175 without a future game. Do not interpret any of
those profiles as game-log analysis. None has fabricated current-season numbers.

**Real-data walkthrough, verified by DOM test:** Milan Momcilovic, Kentucky
(player 4848637 / team 135), has Kansas next in the published schedule, at a
neutral venue on **Nov 10, 2026, 9:30 PM ET**. Matchup displays:

- Explicit empty state: no upcoming game with logged games for this player yet;
  0 valid logged games, with 3 required.
- **Opponent** tab only: Kansas adjusted defense **93.6 points / 100 possessions**
  and adjusted tempo **72.2 possessions / 40 minutes**, clearly labelled published
  rating context, with the Oct 22 snapshot date and `Ratings: barttorvik.com`.
- Overview/radar, Splits, and Similar players are hidden because their required
  logged data does not exist. Prior-season profile numbers are not repurposed as
  this-season logs. Existing Profile content remains accessible unchanged.

There is currently **no real player with a populated current-season radar/splits/
similar sample available in the allowed published files**. Full four-section
rendering is verified with explicitly named TEST FIXTURE data in tests only;
no fixture data is written to `data/` or shown on real profiles.

## Implemented analysis rules / future published-log contract

Builder: `scripts/build_matchup_analyzer.py` → `data/matchup_an.json`. No network
access. It reads only published `data/cbb.json`. Real existing team ratings supply
opponent context. No model/prop/hurdle/Highlighted/grading code reads the output.

When the existing publisher can supply real per-game data, each player object may
include `game_logs` with these explicit fields (this preview does **not** add an
external data fetcher or pretend the current publisher already emits this):

- `gid`: game ID; `start`: timezone-qualified actual game-start ISO timestamp.
- `season`: fall/spring label, e.g. `2026-27`; `completed`: boolean true.
- `tid`, `opp_tid`: CBB Hub team IDs; `home`: boolean (omit for unknown/neutral).
- `min`, `pts`, `reb`, `ast`, `tpm`: actual played-game boxscore fields.
- Optional measured `usg` (percentage), and `fgm`, `fga`, `fta` for shooting splits.

Only current-season completed games before build time, for that roster team,
with positive actual minutes, are eligible. Duplicate games, DNPs, prior-season
rows, projections and missing values cannot fill in a sample. Team + player ID
keys avoid collisions between transfer identities.

- **Overview:** actual minutes, points, rebounds, assists, 3PM, measured usage,
  eFG%, TS% when available. Percentiles require 3+ logged games and at least 3
  same-position peers; radar requires 3 populated axes. Higher percentile means
  higher value, not necessarily better efficiency. No invented opponent overlay.
- **Splits:** All, L5, L10 (3+ games), Home/Away (2+ games). Each stat shows its
  own sample; unavailable metrics/windows are omitted. eFG% and TS% use summed
  attempts, not the mean of per-game percentages.
- **Opponent:** available published adjusted defense and adjusted tempo only,
  labelled rating snapshot, never alleged current-season position allowances.
- **Similar players:** same position, logged season minutes within 30%; actual
  games against this opponent this season, with points results and each player's
  own logged season average. No lines, odds, or estimated hits.

No real positional-allowance dataset or complete opposing boxscores are published
here, so the component does not manufacture opponent percentiles or defensive
player matchups. An expired cached matchup is hidden at runtime as well as build
time. Missing JSON yields a clear unavailable state, not empty fake tiles.

## Verification / security

`npm test`: six builder tests plus jsdom assertions covering the real Milan
profile, exact original Profile body, lazy load, keyboard switching, no navigation,
all seven entrypoint imports, missing-schedule and stale-cache empty states,
all four sections with test-only fixtures, and hostile text-field escaping.
`node --check` for both JS files and `git diff --check` pass.

Aikido scan and re-scan completed. It reports 30 generic `innerHTML` warnings
(severity 80): 28 at pre-existing sinks in cbb.js/index/players/props and 2 in the
new renderer. The new renderer escapes all source text and numeric display
fields; hostile-data DOM tests confirm they cannot create elements/handlers.
Its two remaining pattern warnings are assessed false positives. Existing-page
warnings are outside this preview's changes and were not remediated; this is not
an all-clear security assessment of the legacy hub.
