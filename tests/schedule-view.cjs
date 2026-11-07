const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/cbb.json'), 'utf8'));
const dom = new JSDOM('<!doctype html><body></body>', {url: 'http://localhost/team.html', runScripts: 'outside-only'});
dom.window.eval(fs.readFileSync(path.join(root, 'schedule-view.js'), 'utf8'));
const SV = dom.window.ScheduleView;
const wait = () => new Promise(r => setTimeout(r, 0));
const NOW = new Date('2026-11-07T16:59:00Z');

function event(spec) {
  return {
    id: spec.id,
    date: spec.start,
    competitions: [{
      date: spec.start,
      neutralSite: !!spec.neutral,
      status: {type: spec.status},
      competitors: [
        {homeAway: 'home', score: spec.homeScore, team: {id: spec.homeId, displayName: spec.homeName}},
        {homeAway: 'away', score: spec.awayScore, team: {id: spec.awayId, displayName: spec.awayName}}
      ]
    }]
  };
}

const michigan = event({
  id: '401920685', start: '2026-11-07T01:00Z', neutral: true,
  status: {name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final'},
  homeId: '130', homeName: 'Michigan Wolverines', homeScore: '77',
  awayId: '41', awayName: 'UConn Huskies', awayScore: '85'
});

(async () => {
  assert.equal(SV.etDateKey('2026-11-07T01:00:00Z'), '2026-11-06');
  assert.equal(SV.etDateKey('2026-11-07T04:59:00Z'), '2026-11-06');
  assert.equal(SV.etDateKey('2026-11-07T05:00:00Z'), '2026-11-07');
  assert.equal(SV.etDateKey('2026-11-08T00:00:00Z'), '2026-11-07');
  assert.equal(SV.etDateKey('2026-11-01T05:30:00Z'), '2026-11-01');
  assert.equal(SV.etDateKey('2026-11-01T06:30:00Z'), '2026-11-01');
  assert.equal(SV.etDateKey('2027-03-14T06:30:00Z'), '2027-03-14');
  assert.equal(SV.etDateKey('2027-03-14T07:30:00Z'), '2027-03-14');
  assert.equal(SV.etDateKey('2026-07-15T04:30:00Z'), '2026-07-15');
  assert.equal(SV.seasonFromDateKey('2026-11-06'), '2026-27');
  assert.equal(SV.seasonFromDateKey('2026-04-02'), '2025-26');
  assert.equal(SV.seasonLabel(NOW), '2026-27');
  assert.equal(SV.seasonBounds(NOW).espnYear, 2027);

  const parsed = SV.parseEvent(michigan);
  const finalState = SV.displayState(parsed, NOW);
  assert.equal(finalState.kind, 'final');
  assert.equal(finalState.past, true);
  assert.equal(finalState.showScore, true);
  assert.equal(finalState.awayScore, 85);
  assert.equal(finalState.homeScore, 77);

  const fromPublished = SV.stateForPublished({
    start: '2026-11-07T01:00Z', game_state: 'final', home_score: 77, away_score: 85
  }, null, NOW);
  assert.equal(fromPublished.showScore, true);
  assert.equal(fromPublished.homeScore, 77);
  assert.equal(SV.stateForPublished({start: '2026-11-07T01:00Z', dog_win_prob: 0.533}, null, NOW).kind, 'unknown');
  const bare = SV.displayState({start: '2026-11-07T01:00Z'}, NOW);
  assert.equal(bare.kind, 'unknown');
  assert.equal(bare.showScore, false);
  assert.equal(bare.past, true);
  assert.equal(bare.homeScore, null);

  const scheduled = SV.parseEvent(event({
    id: '2', start: '2026-11-08T00:00:00Z',
    status: {name: 'STATUS_SCHEDULED', state: 'pre', completed: false},
    homeId: '1', homeName: 'Home', homeScore: '0', awayId: '2', awayName: 'Away', awayScore: '0'
  }));
  const scheduledState = SV.displayState(scheduled, NOW);
  assert.equal(scheduledState.kind, 'scheduled');
  assert.equal(scheduledState.showScore, false);

  const live = SV.parseEvent(event({
    id: '3', start: '2026-11-07T18:00:00Z',
    status: {name: 'STATUS_IN_PROGRESS', state: 'in', completed: false},
    homeId: '1', homeName: 'Home', homeScore: '40', awayId: '2', awayName: 'Away', awayScore: '38'
  }));
  const liveState = SV.displayState(live, NOW);
  assert.equal(liveState.kind, 'live');
  assert.equal(liveState.showScore, false);
  assert.equal(SV.displayState(Object.assign({}, SV.parseEvent(event({
    id: '4', start: '2026-11-10T00:00:00Z',
    status: {name: 'STATUS_POSTPONED', state: 'pre', completed: false},
    homeId: '1', homeName: 'Home', homeScore: null, awayId: '2', awayName: 'Away', awayScore: null
  }))), NOW).label, 'Postponed');
  assert.equal(SV.displayState(Object.assign({}, SV.parseEvent(event({
    id: '5', start: '2026-11-10T00:00:00Z',
    status: {name: 'STATUS_CANCELED', state: 'post', completed: true, description: 'Canceled'},
    homeId: '1', homeName: 'Home', homeScore: null, awayId: '2', awayName: 'Away', awayScore: null
  }))), NOW).label, 'Cancelled');

  const prior = SV.parseEvent(event({
    id: 'old', start: '2025-11-06T01:00:00Z',
    status: {name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final'},
    homeId: '130', homeName: 'Prior', homeScore: '1', awayId: '41', awayName: 'Prior Away', awayScore: '2'
  }));
  assert.equal(SV.inCurrentSeason(prior, '2026-27'), false);
  assert.equal(SV.inCurrentSeason(parsed, '2026-27'), true);

  const dates = ['2026-11-03', '2026-11-06', '2026-11-08'];
  assert.equal(SV.nearestDate(dates, '2026-11-07'), '2026-11-08');
  assert.equal(SV.nearestDate(['2026-11-07', '2026-11-08'], '2026-11-07'), '2026-11-07');
  assert.equal(SV.nearestDate(['2026-11-01', '2026-11-03'], '2026-11-07'), '2026-11-03');
  assert.equal(SV.nearestDate([], '2026-11-07'), null);

  const slate = [
    {id: 'a', start: '2026-11-07T01:00:00Z', p: 0.9},
    {id: 'b', start: '2026-11-08T00:00:00Z', p: 0.2},
    {id: 'c', start: '2026-11-08T00:30:00Z', p: 0.5},
    {id: 'd', start: '2026-11-09T00:00:00Z', p: 0.8}
  ];
  const day = SV.filterDay(slate, '2026-11-07', g => SV.etDateKey(g.start));
  assert.deepEqual(day.map(g => g.id), ['b', 'c']);
  const sorted = SV.sortStableDesc(day, g => g.p);
  assert.deepEqual(sorted.map(g => g.id), ['c', 'b']);
  assert.equal(day[0].id, 'b');
  const ties = [{id: 'a', p: 0.5}, {id: 'b', p: 0.5}, {id: 'c', p: 0.4}, {id: 'd', p: 0.9}];
  assert.deepEqual(SV.sortStableDesc(ties, g => g.p).map(g => g.id), ['d', 'a', 'b', 'c']);
  assert.deepEqual(ties.map(g => g.p), [0.5, 0.5, 0.4, 0.9]);

  const gameKeys = source.games.map(g => SV.etDateKey(g.start));
  const latestSlate = gameKeys.slice().sort().pop();
  assert.equal(source.games.length, 20);
  assert.equal(source.props.length, 762);
  assert.ok(gameKeys.every(key => key >= '2026-11-01' && key <= '2026-11-03' && SV.seasonFromDateKey(key) === '2026-27'));
  assert.ok(latestSlate < '2026-11-07');
  assert.equal(SV.nearestDate(gameKeys, '2026-11-07'), latestSlate);
  const published = source.upset_radar.find(row => row.id === '401920685');
  assert.equal(published.dog, 'Michigan');
  assert.equal(published.fav, 'UConn');
  assert.equal(published.dog_win_prob, 0.533);
  assert.equal(SV.etDateKey(published.start), '2026-11-06');
  assert.equal(published.home_score, undefined);
  const nov7 = SV.sortStableDesc(
    SV.filterDay(source.upset_radar, '2026-11-07', row => SV.etDateKey(row.start)),
    row => row.dog_win_prob
  );
  assert.deepEqual(nov7.map(row => row.dog), ['Maryland', 'Providence']);
  assert.ok(nov7[0].dog_win_prob > nov7[1].dog_win_prob);

  const host = dom.window.document.createElement('div');
  host.innerHTML = '<section id="profile"><h3>Roster</h3><p>Existing stars</p></section>';
  const before = host.querySelector('#profile').outerHTML;
  const payload = {
    events: [
      michigan,
      event({
        id: 'old', start: '2025-11-06T01:00:00Z',
        status: {name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final'},
        homeId: '130', homeName: 'Michigan Wolverines', homeScore: '50',
        awayId: '9', awayName: 'Prior Season Opponent', awayScore: '40'
      }),
      event({
        id: 'next', start: '2026-11-12T00:00:00Z',
        status: {name: 'STATUS_SCHEDULED', state: 'pre', completed: false},
        homeId: '130', homeName: 'Michigan Wolverines', homeScore: '0',
        awayId: '269', awayName: 'Marquette Golden Eagles', awayScore: '0'
      }),
      event({
        id: 'live', start: '2026-11-07T18:00:00Z',
        status: {name: 'STATUS_IN_PROGRESS', state: 'in', completed: false},
        homeId: '130', homeName: 'Michigan Wolverines', homeScore: '40',
        awayId: '41', awayName: 'UConn Huskies', awayScore: '38'
      })
    ]
  };
  const mini = {
    fetched_at: '2026-11-07T11:00-05:00', season: '2026-27', failed: [],
    games: Object.fromEntries(SV.parseScoreboard(payload).filter(game => SV.inCurrentSeason(game, '2026-27')).map(game => [game.id, game])),
    byTeam: {170: SV.parseScoreboard(payload).filter(game => SV.inCurrentSeason(game, '2026-27')).map(game => game.id)},
    byDate: {}
  };
  SV.mountTeamScheduleToggle(host, {
    teamName: 'Michigan', espnId: '130', tid: 170, now: NOW, snapshot: mini
  });
  assert.equal(host.querySelector('#profile').outerHTML, before);
  assert.equal(host.querySelector('#team-schedule-panel').hidden, true);
  host.querySelector('#team-schedule-toggle').click();
  await wait();
  await wait();
  const panel = host.querySelector('#team-schedule-panel');
  assert.equal(panel.hidden, false);
  assert.equal(host.querySelector('#profile').outerHTML, before);
  assert.match(panel.textContent, /Final/);
  assert.match(panel.textContent, /UConn Huskies 85, Michigan Wolverines 77/);
  assert.match(panel.textContent, /Marquette Golden Eagles/);
  assert.match(panel.textContent, /Scheduled/);
  assert.doesNotMatch(panel.textContent, /Prior Season Opponent/);
  assert.doesNotMatch(panel.textContent, /Marquette Golden Eagles 0/);
  assert.match(panel.textContent, /Live/);
  assert.doesNotMatch(panel.textContent, /UConn Huskies 38/);
  host.querySelector('#team-schedule-toggle').click();
  assert.equal(panel.hidden, true);
  assert.equal(host.querySelector('#profile').outerHTML, before);

  const missing = dom.window.document.createElement('div');
  missing.innerHTML = '<section id="profile">Kept</section>';
  const kept = missing.querySelector('#profile').outerHTML;
  SV.mountTeamScheduleToggle(missing, {teamName: 'St. Francis (PA)', espnId: null, now: NOW});
  missing.querySelector('#team-schedule-toggle').click();
  await wait();
  assert.match(missing.querySelector('#team-schedule-panel').textContent, /Schedule unavailable/);
  assert.equal(missing.querySelector('#profile').outerHTML, kept);

  const board = dom.window.document.createElement('div');
  const games = [parsed, scheduled, live].map(row => Object.assign({}, row));
  SV.renderHubSchedule(board, {
    date: '2026-11-06', season: '2026-27', coverage: ['St. Francis (PA)'], linked: 364, teamCount: 365,
    loading: false, error: false, games: games, now: NOW, tidByEspn: {130: 170, 41: 314},
    bounds: SV.seasonBounds(NOW), onDate: () => {}
  });
  assert.match(board.textContent, /Unavailable: St\. Francis \(PA\)/);
  assert.match(board.textContent, /UConn Huskies 85, Michigan Wolverines 77/);
  assert.doesNotMatch(board.textContent, /Home 0/);
  assert.ok(board.querySelectorAll('.sched-row').length > 0);
  const nov7board = dom.window.document.createElement('div');
  SV.renderHubSchedule(nov7board, {
    date: '2026-11-07', season: '2026-27', coverage: [], linked: 364, teamCount: 365,
    loading: false, error: false, games: games, now: NOW, tidByEspn: {},
    bounds: SV.seasonBounds(NOW), onDate: () => {}
  });
  assert.match(nov7board.textContent, /Live/);
  assert.match(nov7board.textContent, /Scheduled/);
  assert.doesNotMatch(nov7board.textContent, /Away 38/);
  assert.doesNotMatch(nov7board.textContent, /Home 0/);
  assert.match(nov7board.textContent, /No model win probability/);

  const card = dom.window.document.createElement('div');
  SV.decorateStatus(card, liveState, 'Away 38, Home 40');
  assert.match(card.textContent, /Live/);
  assert.doesNotMatch(card.textContent, /38/);
  SV.decorateStatus(card, finalState, 'UConn Huskies 85, Michigan Wolverines 77');
  assert.match(card.textContent, /Final/);
  assert.match(card.textContent, /85/);
  assert.equal(card.querySelectorAll('.game-state').length, 1);

  const snap = JSON.parse(fs.readFileSync(path.join(root, 'data/schedule_snapshot.json'), 'utf8'));
  assert.equal(snap.season, '2026-27');
  assert.equal(snap.unavailable.some(row => row.team === 'St. Francis (PA)' && row.reason === 'no ESPN id'), true);
  const teamGames = SV.snapshotTeamGames(snap, 170, '130', '2026-27');
  const nov6game = teamGames.find(game => game.id === '401920685');
  assert.equal(SV.etDateKey(nov6game.start), '2026-11-06');
  const nov6state = SV.displayState(nov6game, NOW);
  assert.equal(nov6state.kind, 'final');
  assert.equal(nov6state.awayScore, 85);
  assert.equal(nov6state.homeScore, 77);
  assert.equal(SV.snapshotDateGames(snap, '2026-11-07', '2025-26'), null);
  const todayBoard = SV.snapshotDateGames(snap, '2026-11-07', '2026-27');
  assert.ok(todayBoard.length > 0);
  assert.equal(todayBoard.some(game => game.id === '401920685'), false);
  assert.ok(teamGames.some(game => game.kind === 'scheduled' && SV.displayState(game, NOW).showScore === false));
  assert.ok(Object.values(snap.games).filter(game => game.kind === 'live').every(game => game.homeScore == null && game.awayScore == null));
  const fallbackHost = dom.window.document.createElement('div');
  fallbackHost.innerHTML = '<section id="profile">Kept profile</section>';
  const keptProfile = fallbackHost.querySelector('#profile').outerHTML;
  SV.mountTeamScheduleToggle(fallbackHost, {
    teamName: 'Michigan', espnId: '130', tid: 170, now: NOW, snapshot: snap,
    fetchImpl: async () => { throw new Error('denied'); }
  });
  fallbackHost.querySelector('#team-schedule-toggle').click();
  await wait();
  await wait();
  assert.equal(fallbackHost.querySelector('#profile').outerHTML, keptProfile);
  assert.match(fallbackHost.querySelector('#team-schedule-panel').textContent, /UConn Huskies 85, Michigan Wolverines 77/);
  assert.match(fallbackHost.querySelector('#team-schedule-panel').textContent, /daily hub build/);
  assert.match(fallbackHost.querySelector('#team-schedule-panel').textContent, /not a live ESPN page/);
  assert.equal(SV.snapshotFreshness({fetched_at: '2026-11-07T11:00-05:00'}, NOW).stale, false);
  assert.equal(SV.snapshotFreshness({fetched_at: '2026-11-05T11:00-05:00'}, NOW).stale, true);
  assert.match(SV.snapshotCaption({fetched_at: '2026-11-05T11:00-05:00', failed: []}, NOW), /older than 36 hours/);
  assert.doesNotMatch(SV.snapshotCaption({fetched_at: '2026-11-07T11:00-05:00', failed: []}, NOW), /older than 36 hours/);
  assert.doesNotMatch(fallbackHost.querySelector('#team-schedule-panel').textContent, /Marquette Golden Eagles 0/);

  console.log('schedule-view tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
