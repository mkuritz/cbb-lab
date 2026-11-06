# CBB player-profile Matchup workspace — LOCAL PREVIEW ONLY

Continues the existing preview on branch `preview/cbb-profile-matchup`, on top of
commit `262c846`. No push, deployment, workflow, app-nav rebuild, or model changes.
The shared **Profile | Matchup** shell stays intact, with Profile default and its
original body unchanged (DOM-compared to baseline commit 143008a).

## Preview and verify

```sh
npm ci --ignore-scripts
python3 scripts/build_matchup_analyzer.py
npm test
# Optional local preview only:
python3 -m http.server 8766 --bind 127.0.0.1
# Open /players.html, find Milan Momcilovic, click his name, then Matchup.
```

All seven shared-modal entrypoints load the cache-busted analyzer before cbb.js:
players, props, index/matchups, team, teams, transfers, and method. Tab rows have
arrow/Home/End navigation, labelled panels and selected state. Matchup data loads
on demand. No page navigation is triggered by player or analyzer-tab clicks.

## Richer workspace

Available sections appear in this order; unsupported ones are hidden:
**Graph | Matchup | Share | Similar | Lineup**.

- **Graph:** actual game-by-game results, stat chips, supported L3/L6/L10/Season
  windows, H2H when available, green/red bars against a yellow benchmark, observed
  above-threshold percentage, and an unplayed `?` placeholder. A published line
  must match this exact player/team/upcoming game/market; otherwise use only an
  existing published role projection, explicitly labelled *not a betting line*.
  Every past result is compared with the same upcoming threshold, not fictitious
  historical lines. Without a threshold, omit above-threshold percentages and
  comparison colors/line. Tables provide accessible actual results.
- **Matchup:** published opponent adjusted defense/tempo; logged H2H summary,
  player percentile radar and recent production chips when real logs exist.
  Missing axes are hidden. The radar is clearly player-only: no opponent-allowed
  shape or dual percentile bars can be drawn from the current published dataset.
- **Share:** projected teammate rotation opportunity, ranked by projected minutes,
  position filters, selected-player emphasis, projected role usage, and minute-
  share bars. All are labelled **projected rotation, not logged opportunity**.
  Share is projected minutes divided by the published roster total, not a claim
  of observed regulation team-minute share or measured team possession share.
  That total is shown because the existing model does not constrain it to 200.
- **Similar:** same-position players whose logged season minutes are within 30%,
  actual results against this opponent, and each player's own logged average.
  Comparison KPIs/columns appear only when there is a real published line or
  existing projection to use; otherwise plain actual-stat comps only. No fake
  historical lines or hit-rate claims.
- **Lineup:** existing opposing rotation, full/proj-starter filters, projected
  minutes/role usage. Clearly labelled **projected, not an official lineup**.
  No invented confirmed starters, injury statuses, weather, or shot-location maps.

The workspace uses CBB Hub colors/styles, not outside product names or branding.
The twelve supplied reference-image paths returned `File not found` to this
executor. Implementation therefore used the detailed accompanying descriptions;
no claim of direct visual inspection of those unavailable images is made.

## Real-data walkthrough and limitation

`data/cbb.json` snapshot: **Oct 22, 2026, 1:38 PM ET**. It has prior-season
aggregates and role projections, but **zero current-season per-game player logs**.
The new builder never treats gp/ppg/usg/proj_* as logged current-season outcomes.
Its 20 opening-slate games are past; additional future schedule metadata comes
from published `upset_radar` records (identity/time/teams/neutral only, never model
scores, probabilities, tiers or projected tempo).

Generated coverage: **8,159** team/player identities; **0** with valid logs;
**29** future games; **984** insufficient-log profiles with a future opponent;
**7,175** profiles without an upcoming game. There is no valid real fully
populated Graph/radar/Similar example in the permitted published data.

**Verified real example:** Milan Momcilovic, Kentucky, ID `135|4848637`, neutral vs
Kansas on **Nov 10, 2026, 9:30 PM ET** (game 401909786).

- **Matchup**: Kansas AdjD **93.6 points/100 possessions**, AdjT **72.2 possessions/
  40 minutes**, snapshot label and `Ratings: barttorvik.com` credit.
- **Share**: Kentucky's **14-player** projected rotation; Milan **28.0 projected
  minutes**, **22.4% projected role usage**, **12.7%** of the published projected
  rotation-minute total (**219.7**). The denominator is disclosed; this is not
  measured game share. G/F/C filters work without changing the denominator.
- **Lineup**: Kansas's **15-player** published projected rotation, including five
  projected starters. Trey Kaufman-Renn: **28.7 projected minutes**, **27.0%**
  projected role usage. This is not an official/confirmed game lineup.
- **Graph and Similar** are hidden, with an explicit **0 logged games; 3 required**
  notice. Radar, H2H and recent logged windows are likewise hidden.
- Existing Profile body is unchanged; switching tabs stays on the same page.

Without a future game the real Share section can remain useful, clearly projected;
all opponent-dependent sections disappear. An expired cached next game is also
removed at runtime. Missing JSON produces a readable unavailable state.

## Data pipeline / remaining integration

`scripts/build_matchup_analyzer.py` reads only published `data/cbb.json`, makes no
network calls, and writes `data/matchup_an.json`. Shared team rotations are stored
once, not duplicated for every player. Output includes source hash/provenance.
The builder is deliberately **not wired to any deployment workflow**.

To populate logged views, the existing data publisher must first supply actual
per-player `game_logs`. This preview does **not** pretend that ingestion exists.
Accepted row fields:

- `gid`, timezone-qualified `start`, `season` (`2026-27`), `completed: true`.
- `tid`, `opp_tid` using CBB Hub team IDs; optional boolean `home`.
- Actual `min`, `pts`, `reb`, `ast`, `tpm`; optional measured `usg`, `fgm`, `fga`,
  `fta` (for shooting efficiency).

Only this-season completed games before build time, for that roster team and
with positive played minutes, are eligible. Duplicate games, DNPs, prior-season
rows, missing fields and projections never fill in samples. Composite team/player
keys prevent transfer collisions. All/L3/L6/L10 require their stated game sample;
Home/Away require two games. Each metric discloses its own sample. eFG% and TS%
use summed attempts. Season percentiles require 3+ logged games and 3+ same-
position peers; radar needs at least three populated axes.

The current published data has no complete defensive-position allowances,
confirmed availability, actual lineup feed, or weather. Those features are
omitted rather than inferred or invented. No core projection builder,
Highlighted/model/prop/grading input was modified, and nothing reads this display
output back into those systems.

## Verification and security

`npm test`: eight builder tests plus jsdom tests for the real Milan profile,
unchanged original Profile body, all seven entrypoint imports, lazy loading,
keyboard tabbing, no navigation, position filters with fixed share denominator,
Kansas projected-starter filter, absent/expired opponents, all five sections
with explicitly named TEST FIXTURE data, line/projection fallback, graph colors,
recent windows, unplayed `?`, omitted KPIs without thresholds, and hostile text
escaping including chip-driven re-renders. No fixture is written to data/.
`node --check` for both JS files and `git diff --check` pass.

Latest Aikido scan: 29 generic `innerHTML` pattern warnings, severity 80: 28 at
pre-existing sinks in cbb.js/index/players/props; one new warning at analyzer
line 128 (`panel.innerHTML = render()`). That renderer uses only local render
functions with escaped text/numeric coercion; hostile-input re-render tests
confirm no elements or handlers can be injected. Assessed false positive for the
new renderer. Legacy warnings are outside scope and were not remediated; this
is not an all-clear security assessment of the existing hub.
