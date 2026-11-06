/* CBB profile analyzer. Display only; never writes models, props or probabilities. */
(function () {
  'use strict';
  var request;
  function E(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }
  function num(v) { return Number(v).toFixed(1); }
  function width(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }
  function date(s) {
    return new Date(s).toLocaleString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }) + ' ET';
  }
  function day(s) {
    return new Date(s).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric'
    });
  }
  function load() {
    if (!request) request = fetch('data/matchup_an.json?v=cbb-matchup-2')
      .then(function (r) { if (!r.ok) throw Error('unavailable'); return r.json(); })
      .catch(function (e) { request = null; throw e; });
    return request;
  }
  function table(head, rows) {
    return '<div class="cma-table"><table><thead><tr>' + head.map(function (h) {
      return '<th>' + E(h) + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr>' + r.map(function (v) { return '<td>' + E(v) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  function tabs(root, attribute) {
    var buttons = Array.from(root.querySelectorAll('[' + attribute + ']'));
    function select(b) {
      buttons.forEach(function (x) {
        var on = x === b;
        x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
        var panel = root.querySelector('#' + x.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    }
    buttons.forEach(function (b, i) {
      b.onclick = function () { select(b); };
      b.onkeydown = function (e) {
        var j = e.key === 'ArrowRight' ? (i + 1) % buttons.length :
          e.key === 'ArrowLeft' ? (i + buttons.length - 1) % buttons.length :
          e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : -1;
        if (j >= 0) { e.preventDefault(); buttons[j].focus(); select(buttons[j]); }
      };
    });
  }
  function chips(values, selected, attr, label) {
    return '<div class="cma-chips" role="group" aria-label="' + E(label) + '">' + values.map(function (v) {
      return '<button type="button" ' + attr + '="' + E(v[0]) + '" aria-pressed="' +
        (selected === v[0]) + '">' + E(v[1]) + '</button>';
    }).join('') + '</div>';
  }
  function radar(axes) {
    var n = axes.length, c = 160, r = 92;
    function xy(i, p) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [c + Math.cos(a) * r * width(p) / 100, c + Math.sin(a) * r * width(p) / 100];
    }
    var svg = [25, 50, 75, 100].map(function (p) {
      return '<polygon points="' + axes.map(function (_, i) { return xy(i, p).join(','); }).join(' ') +
        '" fill="none" stroke="#334155"/>';
    }).join('');
    axes.forEach(function (a, i) {
      var p = xy(i, 100), angle = -Math.PI / 2 + i * 2 * Math.PI / n;
      var tx = c + Math.cos(angle) * 128, ty = c + Math.sin(angle) * 128;
      svg += '<line x1="160" y1="160" x2="' + p[0] + '" y2="' + p[1] +
        '" stroke="#334155"/><text x="' + tx + '" y="' + ty +
        '" text-anchor="middle" fill="#cbd5e1" font-size="10">' + E(a.label) + '</text>';
    });
    svg += '<polygon points="' + axes.map(function (a, i) { return xy(i, a.percentile).join(','); }).join(' ') +
      '" fill="#38d0f033" stroke="#38d0f0" stroke-width="2"/>';
    return '<svg class="cma-radar" viewBox="0 0 320 320" role="img" aria-label="Season player percentiles among same-position players with at least three logged games">' +
      svg + '</svg><p class="mut sm">Season radar: higher value among same-position players with 3+ logged games. Not an opponent-allowed comparison.</p>' +
      table(['Metric', 'Per game / %', 'Percentile', 'Games'], axes.map(function (a) {
        return [a.label, num(a.value), a.percentile + ' (' + a.peers + ' peers)', a.n];
      }));
  }
  function mount(el, p, D) {
    var next = p.next, rotation = D.rotations && D.rotations[p.tid];
    var opponent = next && D.rotations && D.rotations[next.opp_tid];
    var graph = p.graph || {}, wins = p.windows || {};
    var state = {metric: Object.keys(graph)[0], window: 'All', split: 'All', pos: 'All', starters: 'All'};
    var parts = [];
    if (Object.keys(graph).length) parts.push(['graph', 'Graph', renderGraph]);
    if ((p.axes && p.axes.length >= 3) || Object.keys(wins).length || (p.opponent_context || []).length)
      parts.push(['matchup', 'Matchup', renderMatchup]);
    if (rotation && rotation.rows.length) parts.push(['share', 'Share', renderShare]);
    if (p.similar && p.similar.length) parts.push(['similar', 'Similar', renderSimilar]);
    if (opponent && opponent.rows.length) parts.push(['lineup', 'Lineup', renderLineup]);
    function heading() {
      var title = next ? (next.neutral ? 'Neutral vs ' : next.home ? 'vs ' : '@ ') + next.opponent : 'Next matchup unavailable';
      return '<div class="cma-heading"><div><span class="cma-eyebrow">CBB Hub · Player context</span><h3>Matchup Analyzer</h3></div>' +
        '<span class="cma-badge">Display only</span></div><p class="cma-next">' + E(p.name) + ' · ' + E(title) +
        (next ? ' · ' + E(date(next.start)) : '') + '</p><p class="mut sm">' + E(D.season) + ' · ' +
        E(p.role || p.pos || '') + '. Does not change Highlighted plays or probabilities.</p>';
    }
    function emptyNotice() {
      if (p.status === 'ready') return '';
      return '<div class="cma-notice" role="status"><b>No upcoming game with logged games for this player yet.</b><p>' +
        (next ? 'At least ' + E(D.minimum_games) + ' completed games this season are required; ' + E(p.logged_games) +
          ' valid logged games are available. Graph and Similar stay hidden.' : 'No future game is available in the published schedule.') +
        '</p><p>Published projected rotation and rating context are labelled separately. Prior-season averages are never used as this-season logs.</p></div>';
    }
    function draw() {
      el.innerHTML = '<section class="cma">' + heading() + emptyNotice() +
        (!parts.length ? '<p>No supported matchup sections with enough real data yet.</p>' :
          '<div class="cma-tabs" role="tablist" aria-label="Analyzer sections">' + parts.map(function (t, i) {
            return '<button type="button" role="tab" data-cma-section="' + t[0] + '" id="cma-tab-' + t[0] +
              '" aria-controls="cma-panel-' + t[0] + '" aria-selected="' + (!i) + '" tabindex="' + (i ? -1 : 0) + '">' + t[1] + '</button>';
          }).join('') + '</div>' + parts.map(function (t, i) {
            return '<section role="tabpanel" id="cma-panel-' + t[0] + '" aria-labelledby="cma-tab-' + t[0] +
              '"' + (i ? ' hidden' : '') + '>' + t[2]() + '</section>';
          }).join('')) + '<p class="mut sm cma-source">Published snapshot: ' + E(D.source_built || 'date unavailable') + '</p></section>';
      tabs(el, 'data-cma-section');
      bindChips();
    }
    function updatePanel(id, render) {
      var panel = el.querySelector('#cma-panel-' + id);
      panel.innerHTML = render(); bindChips();
    }
    function bindChips() {
      [['data-cma-metric', 'metric', 'graph', renderGraph], ['data-cma-window', 'window', 'graph', renderGraph],
       ['data-cma-split', 'split', 'matchup', renderMatchup], ['data-cma-pos', 'pos', 'share', renderShare],
       ['data-cma-starters', 'starters', 'lineup', renderLineup]].forEach(function (cfg) {
        el.querySelectorAll('[' + cfg[0] + ']').forEach(function (button) {
          button.onclick = function () {
            state[cfg[1]] = button.getAttribute(cfg[0]); updatePanel(cfg[2], cfg[3]);
            var current = el.querySelector('[' + cfg[0] + '="' + state[cfg[1]] + '"]');
            if (current) current.focus({preventScroll: true});
          };
        });
      });
    }
    function renderGraph() {
      var metric = graph[state.metric], games = metric.games;
      var windows = [['All', 'Season']];
      [3, 6, 10].forEach(function (n) { if (games.length >= n) windows.push(['L' + n, 'L' + n]); });
      if (games.some(function (r) { return next && r.opp_tid === next.opp_tid; })) windows.push(['H2H', 'H2H']);
      if (!windows.some(function (x) { return x[0] === state.window; })) state.window = 'All';
      var rows = state.window === 'H2H' ? games.filter(function (r) { return r.opp_tid === next.opp_tid; }) :
        state.window === 'All' ? games : games.slice(0, Number(state.window.slice(1)));
      var benchmark = metric.benchmark;
      var hits = benchmark ? rows.filter(function (r) { return r.value > benchmark.value; }).length : 0;
      var ties = benchmark ? rows.filter(function (r) { return r.value === benchmark.value; }).length : 0;
      var average = rows.reduce(function (a, r) { return a + r.value; }, 0) / rows.length;
      var max = Math.max.apply(null, rows.map(function (r) { return Number(r.value); }).concat([benchmark ? Number(benchmark.value) : 0, 1])) * 1.15;
      var lineHeight = benchmark ? width(benchmark.value / max * 100) : 0;
      return chips(Object.keys(graph).map(function (k) { return [k, graph[k].label]; }), state.metric, 'data-cma-metric', 'Logged production metric') +
        chips(windows, state.window, 'data-cma-window', 'Logged game window') +
        '<div class="cma-kpis"><div>Logged average<b>' + num(average) + '</b><small>' + rows.length + ' games</small></div>' +
        (benchmark ? '<div>' + E(benchmark.label) + '<b>' + num(benchmark.value) + '</b><small>Upcoming benchmark</small></div><div>' +
          (benchmark.kind === 'line' ? 'Above line' : 'Above projection') + '<b>' + Math.round(hits / rows.length * 100) +
          '%</b><small>' + hits + '/' + rows.length + (ties ? ' · ' + ties + ' equal' : '') + '</small></div>' : '') + '</div>' +
        '<p class="mut sm">' + (benchmark ? 'Each logged result is compared with the same upcoming ' +
          (benchmark.kind === 'line' ? 'published line' : 'published role projection (not a betting line)') + '. These are not historical lines.' :
          'No published line or projection is available. Only actual logged production is shown.') + '</p>' +
        '<div class="cma-graph-scroll"><div class="cma-graph" style="min-width:' + Math.max(320, (rows.length + 1) * 42) + 'px">' +
        (benchmark ? '<div class="cma-threshold" style="bottom:' + lineHeight + '%"><span>' + E(benchmark.label) + ' ' + num(benchmark.value) + '</span></div>' : '') +
        rows.slice().reverse().map(function (r) {
          var cls = !benchmark ? 'neutral' : r.value > benchmark.value ? 'above' : r.value < benchmark.value ? 'below' : 'equal';
          return '<div class="cma-game" title="' + E(day(r.start)) + ': ' + E(r.value) + '"><b style="bottom:' + width(r.value / max * 100) + '%">' + E(r.value) +
            '</b><div class="cma-bar ' + cls + '" style="height:' + width(r.value / max * 100) + '%"></div><span>' + E(day(r.start)) + '</span></div>';
        }).join('') + '<div class="cma-game upcoming"><b>?</b><div class="cma-upcoming">?</div><span>Next</span></div></div></div>' +
        '<p class="mut sm">Upcoming game is unplayed: ? is a placeholder, not a result. Full logged results:</p>' +
        table(['Date (ET)', metric.label], rows.map(function (r) { return [date(r.start), r.value]; }));
    }
    function renderMatchup() {
      var html = '';
      if ((p.opponent_context || []).length) {
        html += '<h4>' + E(next.opponent) + ' · Rating context</h4><span class="cma-badge">Published snapshot</span>' +
          table(['Factor', 'Value', 'Units'], p.opponent_context.map(function (r) { return [r.label, num(r.value), r.unit]; })) +
          '<p class="mut sm">Ratings: barttorvik.com. These are published team ratings, not current-season position allowances.</p>';
      }
      if (p.h2h) html += '<h4>Head-to-head · ' + E(p.h2h.n) + ' logged games this season</h4>' +
        table(['Metric', 'Per game / %'], D.stats.filter(function (s) { return p.h2h.v[s[0]] != null; }).map(function (s) { return [s[1], num(p.h2h.v[s[0]])]; }));
      if (p.axes && p.axes.length >= 3) html += radar(p.axes);
      if (Object.keys(wins).length) {
        if (!wins[state.split]) state.split = 'All';
        html += '<h4>Logged production splits</h4>' + chips(Object.keys(wins).map(function (k) { return [k, k]; }), state.split, 'data-cma-split', 'Production split');
        var w = wins[state.split];
        html += table(['Metric', 'Per game / %', 'Sample'], D.stats.filter(function (s) { return w.v[s[0]] != null; }).map(function (s) {
          return [s[1], num(w.v[s[0]]), w.samples[s[0]] + ' games'];
        })) + '<p class="mut sm">Shooting percentages use combined attempts. Missing metrics are omitted, never zero-filled. Dual player/opponent percentile bars are omitted without real positional allowances.</p>';
      }
      return html;
    }
    function renderShare() {
      var positions = [['All', 'All']];
      ['G', 'F', 'C'].forEach(function (pos) { if (rotation.rows.some(function (r) { return r.pos === pos; })) positions.push([pos, pos]); });
      var rows = rotation.rows.filter(function (r) { return state.pos === 'All' || r.pos === state.pos; });
      var usage = rows.some(function (r) { return r.usage != null; });
      return '<h4>' + E(rotation.team) + ' · Rotation opportunity</h4><span class="cma-badge">Projected rotation · not logged share</span>' +
        '<p class="mut sm">Share = published projected minutes ÷ all published rotation minutes (' + num(rotation.total_minutes) +
        '). This roster total is not constrained to 200 minutes; this is not observed team-minute share. Role usage is the existing projected usage rate, not a normalized team share.</p>' +
        chips(positions, state.pos, 'data-cma-pos', 'Teammate position') +
        '<div class="cma-table"><table><thead><tr><th>Player</th><th>Proj MIN</th>' + (usage ? '<th>Role USG%</th>' : '') + '<th>Rotation share</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr' + (r.id === p.id ? ' class="cma-selected"' : '') + '><td><b>' + E(r.name) + '</b><small>' + E(r.pos || '') +
            (r.starter ? ' · Proj starter' : ' · ' + E(r.role || 'Rotation')) + (r.availability ? ' · ' + E(r.availability) : '') +
            '</small></td><td>' + num(r.minutes) + '</td>' + (usage ? '<td>' + (r.usage == null ? '' : num(r.usage)) + '</td>' : '') +
            '<td>' + (r.share == null ? '' : '<span class="cma-share-value">' + num(r.share) + '%</span><span class="cma-share-track"><i style="width:' + width(r.share) + '%"></i></span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function renderSimilar() {
      var rows = p.similar, benchmark = rows[0] && rows[0].benchmark;
      var html = '<h4>Comparable players vs ' + E(next.opponent) + '</h4><p class="mut sm">Same position, season minutes within 30%. Actual points in this season’s games. Each player’s own logged average is shown.</p>';
      if (benchmark) {
        var diff = rows.reduce(function (a, r) { return a + r.points - benchmark.value; }, 0) / rows.length;
        var hits = rows.filter(function (r) { return r.points > benchmark.value; }).length;
        html += '<p class="mut sm">Compared with this player’s upcoming ' + E(benchmark.label.toLowerCase()) + ': ' + num(benchmark.value) +
          '. Not historical lines for these games.</p><div class="cma-kpis"><div>Average difference<b>' + (diff > 0 ? '+' : '') + num(diff) +
          '</b></div>' + (benchmark.value ? '<div>Average difference %<b>' + num(diff / benchmark.value * 100) + '%</b></div>' : '') +
          '<div>Above ' + (benchmark.kind === 'line' ? 'line' : 'projection') + '<b>' + Math.round(hits / rows.length * 100) + '%</b><small>' + hits + '/' + rows.length + '</small></div></div>';
      }
      return html + table(['Date (ET)', 'Player', 'Team', 'Minutes avg', 'Points avg', 'Result'].concat(benchmark ? [benchmark.label, 'Difference'] : []), rows.map(function (r) {
        return [date(r.start), r.name, r.team, num(r.minutes), num(r.average), r.points].concat(benchmark ? [num(benchmark.value), num(r.points - benchmark.value)] : []);
      }));
    }
    function renderLineup() {
      var rows = opponent.rows.filter(function (r) { return state.starters === 'All' || r.starter; });
      var usage = rows.some(function (r) { return r.usage != null; });
      return '<h4>' + E(opponent.team) + ' · Published opposing rotation</h4><span class="cma-badge">Projected · not an official lineup</span>' +
        '<p class="mut sm">Starter flags and minutes come from the existing CBB Hub rotation snapshot. No confirmed availability or official game lineup is published here.</p>' +
        chips([['All', 'Full rotation'], ['Starters', 'Projected starters']], state.starters, 'data-cma-starters', 'Opposing rotation') +
        table(['Player', 'Position', 'Published role', 'Proj MIN'].concat(usage ? ['Role USG%'] : []), rows.map(function (r) {
          return [r.name + (r.availability ? ' · ' + r.availability : ''), r.pos, r.starter ? 'Projected starter' : r.role || 'Rotation', num(r.minutes)]
            .concat(usage ? [r.usage == null ? '' : num(r.usage)] : []);
        }));
    }
    draw();
  }
  function open(el, p) {
    el.innerHTML = '<section class="cma" aria-live="polite"><h3>Matchup Analyzer</h3><p>Loading matchup…</p></section>';
    return load().then(function (D) {
      var key = String(p.tid) + '|' + String(p.id || p.n.toLowerCase());
      var row = D.players && D.players[key];
      if (!row) {
        el.innerHTML = '<section class="cma"><h3>Matchup Analyzer</h3><p>No published player context is available yet.</p></section>';
        return;
      }
      // Do not keep showing an already-started game from a cached generated snapshot.
      if (row.next && new Date(row.next.start) <= new Date()) {
        row = Object.assign({}, row, {status: 'no_upcoming', next: null, axes: [], windows: {}, graph: {},
          opponent_context: [], h2h: null, similar: []});
      }
      mount(el, row, D);
    }).catch(function () {
      el.innerHTML = '<section class="cma" aria-live="polite"><h3>Matchup Analyzer</h3><p>Matchup data is unavailable. Please try again.</p></section>';
    });
  }
  window.CBBMatchup = {open: open, mount: mount, tabs: tabs};
})();
