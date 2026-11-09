# CBB Matchup Duel visual finish — private preview

Aligned to the supplied Soccer / NHL mockup grammar: near-black green background, slim mint-active existing sidebar, compact team selectors, coral/blue paired team summary cards, 1.85:1 comparison/context grid, restrained rank bars, bordered analytical panels and mobile stacking.

The actual seven-metric comparison is now the main visual. Definitions use accessible native disclosure controls instead of crowding every row. The evidence explanations and historical game/model context are preserved. Style ranks are clearly descriptive, never quality-tinted; quality tint is explicitly not a predicted winner. The current snapshot has 361 rated and 4 pending teams; pending count now derives from repository status. Historical default game remains November 2, not an invented upcoming fixture.

Scope: only `cbb-duel.js`, new `tests/design_finish.cjs` and this note. Existing in-Hub route, sidebar/hash/back-forward integration and selectors/swap remain. No NFL changes, data updates, model/pick/odds changes or publication.

Checks: hub_duel 24 passed; design_finish 12 assertions passed; supported release 44 assertions passed; matchup-dom passed (7 entrypoints, profile unchanged, synthetic tabs and escaping); Python builder tests 8 passed. Scoped Aikido scan of modified JS + test: no findings. Existing other-file baseline findings were not modified or suppressed.

Actual-source offline HTML: `/workspace/design-review-1924/cbb-matchup-duel/index.html` (shareable recorded-data local preview). PNG/PDF document proofs in the same directory are actual-DOM print exports, NOT browser screenshots; native controls flattened for print. No local browser retry was attempted after the earlier denial. Browser desktop/mobile visual approval is outstanding. Shared account SDK is intentionally disabled in offline package and no signed-in behaviour is simulated.
