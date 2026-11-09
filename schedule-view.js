/* Current-season schedule display. Does not compute or edit model probabilities. */
(function (root) {
  var TZ = "America/New_York";

  function etDateKey(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(d);
    var bag = {};
    parts.forEach(function (p) { if (p.type !== "literal") bag[p.type] = p.value; });
    if (!bag.year || !bag.month || !bag.day) return null;
    return bag.year + "-" + bag.month + "-" + bag.day;
  }

  function seasonFromDateKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return null;
    var year = +key.slice(0, 4), month = +key.slice(5, 7);
    var start = month >= 7 ? year : year - 1;
    return start + "-" + String(start + 1).slice(2);
  }

  function seasonLabel(now) {
    return seasonFromDateKey(etDateKey(now.toISOString()));
  }

  function seasonBounds(now) {
    var label = seasonLabel(now);
    var start = label ? +label.slice(0, 4) : null;
    return {
      label: label,
      espnYear: start ? start + 1 : null,
      min: start ? start + "-07-01" : "",
      max: start ? (start + 1) + "-06-30" : ""
    };
  }

  function inCurrentSeason(game, label) {
    var key = etDateKey(game && game.start);
    return !!(key && label && seasonFromDateKey(key) === label);
  }

  function dayLabel(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return "";
    var d = new Date(key + "T12:00:00Z");
    return new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, weekday: "short", month: "short", day: "numeric", year: "numeric"
    }).format(d);
  }

  function timeLabel(iso, timeTBD) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "Unknown time";
    var date = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, weekday: "short", month: "short", day: "numeric"
    }).format(d);
    if (timeTBD) return date + " · Time TBA";
    var time = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour: "numeric", minute: "2-digit"
    }).format(d);
    return date + " · " + time + " ET";
  }

  function tipSortKey(game) {
    return [(game && game.timeTBD) ? 1 : 0, String((game && game.start) || "")];
  }

  function sortByTip(games) {
    return (games || []).slice().sort(function (a, b) {
      var ka = tipSortKey(a), kb = tipSortKey(b);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      return ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0;
    });
  }

  function uniqueDates(items, dateFn) {
    var seen = {};
    (items || []).forEach(function (item) {
      var key = dateFn(item);
      if (key) seen[key] = 1;
    });
    return Object.keys(seen).sort();
  }

  function nearestDate(keys, today) {
    var uniq = [];
    var seen = {};
    (keys || []).forEach(function (key) {
      if (key && !seen[key]) { seen[key] = 1; uniq.push(key); }
    });
    uniq.sort();
    if (!uniq.length) return null;
    if (seen[today]) return today;
    var upcoming = uniq.filter(function (key) { return key > today; });
    if (upcoming.length) return upcoming[0];
    var past = uniq.filter(function (key) { return key < today; });
    return past.length ? past[past.length - 1] : null;
  }

  function filterDay(items, dateKey, dateFn) {
    return (items || []).filter(function (item) { return dateFn(item) === dateKey; });
  }

  function sortStableDesc(items, prob) {
    return (items || []).map(function (item, index) {
      var value = Number(prob(item));
      return { item: item, index: index, value: Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY };
    }).sort(function (a, b) {
      if (a.value !== b.value) return b.value - a.value;
      return a.index - b.index;
    }).map(function (row) { return row.item; });
  }

  function scoreNum(value) {
    if (typeof value === "boolean" || value == null) return null;
    if (typeof value === "object") value = value.displayValue != null ? value.displayValue : value.value;
    if (typeof value === "boolean" || value == null) return null;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) return null;
      return value;
    }
    var text = String(value).trim();
    if (!/^\d+$/.test(text)) return null;
    return parseInt(text, 10);
  }

  function kindFromStatus(statusType) {
    var status = statusType || {};
    var name = String(status.name || "");
    var desc = String(status.description || status.detail || "");
    var state = String(status.state || "");
    var completed = status.completed === true;
    if (name === "STATUS_CANCELED" || name === "STATUS_CANCELLED") return "cancelled";
    if (name === "STATUS_POSTPONED") return "postponed";
    if (name === "STATUS_DELAYED" || name === "STATUS_RAIN_DELAY") return "delayed";
    if (name === "STATUS_SUSPENDED") return "suspended";
    if (name === "STATUS_FINAL" || name === "STATUS_FINAL_OT" || name === "STATUS_FULL_TIME" || (completed && desc.toLowerCase().indexOf("final") === 0)) return "final";
    if (name === "STATUS_IN_PROGRESS" || name === "STATUS_HALFTIME" || name === "STATUS_END_PERIOD" || name === "STATUS_END_OF_PERIOD" || state === "in") return "live";
    if (name === "STATUS_SCHEDULED" || name === "STATUS_PRE_GAME" || state === "pre") return "scheduled";
    return "unknown";
  }

  var LABELS = {
    final: "Final", live: "Live", scheduled: "Scheduled", postponed: "Postponed",
    cancelled: "Cancelled", delayed: "Delayed", suspended: "Suspended", unknown: "Unknown"
  };

  function stateForPublished(row, verified, now) {
    if (verified) return displayState(verified, now);
    if (row && row.game_state) {
      return displayState({
        start: row.start, kind: row.game_state, homeScore: row.home_score, awayScore: row.away_score
      }, now);
    }
    return displayState({start: row && row.start}, now);
  }

  function displayState(game, now) {
    var source = game || {};
    var kind = source.kind || kindFromStatus(source.statusType || source.status);
    if (!LABELS[kind]) kind = "unknown";
    var start = source.start ? new Date(source.start) : null;
    var past = !!(start && !isNaN(start.getTime()) && start.getTime() <= now.getTime());
    if (kind === "scheduled" && past) kind = "unknown";
    if (kind === "final") {
      var homeScore = scoreNum(source.homeScore);
      var awayScore = scoreNum(source.awayScore);
      var show = homeScore != null && awayScore != null;
      return {
        kind: "final", label: "Final", past: true, showScore: show,
        homeScore: show ? homeScore : null, awayScore: show ? awayScore : null
      };
    }
    return {
      kind: kind, label: LABELS[kind] || "Unknown", past: past, showScore: false,
      homeScore: null, awayScore: null
    };
  }

  function competitor(list, side) {
    return (list || []).filter(function (row) { return row && row.homeAway === side; })[0] || null;
  }

  function teamName(row) {
    var team = (row && row.team) || {};
    return team.displayName || team.shortDisplayName || team.location || team.name || "Unknown";
  }

  function teamEspn(row) {
    var id = row && row.team && row.team.id;
    return id == null ? "" : String(id);
  }

  function parseEvent(event) {
    if (!event || event.id == null) return null;
    var comp = (event.competitions || [])[0] || {};
    var rows = comp.competitors || [];
    var home = competitor(rows, "home");
    var away = competitor(rows, "away");
    if (!home || !away) return null;
    var start = comp.date || event.date;
    if (!etDateKey(start)) return null;
    var status = ((comp.status || {}).type) || {};
    var detail = [status.detail, status.shortDetail, status.description].join(" ");
    var timeTBD = comp.timeValid === false || event.timeValid === false || /TBD/i.test(detail);
    return {
      id: String(event.id),
      start: start,
      neutral: comp.neutralSite === true,
      venue: (comp.venue && comp.venue.fullName) || "",
      homeEspn: teamEspn(home),
      awayEspn: teamEspn(away),
      homeName: teamName(home),
      awayName: teamName(away),
      homeScore: home.score,
      awayScore: away.score,
      statusType: status,
      kind: kindFromStatus(status),
      timeTBD: !!timeTBD
    };
  }

  function parseScoreboard(payload) {
    return ((payload && payload.events) || []).map(parseEvent).filter(Boolean);
  }

  function hydrateSnapshotGame(id, row) {
    if (!row) return null;
    return {
      id: String(id),
      start: row.start,
      neutral: row.neutral === true,
      homeEspn: row.homeEspn == null ? "" : String(row.homeEspn),
      awayEspn: row.awayEspn == null ? "" : String(row.awayEspn),
      homeName: row.homeName || "Unknown",
      awayName: row.awayName || "Unknown",
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      kind: row.kind || "unknown",
      timeTBD: row.timeTBD === true
    };
  }

  function snapshotDateGames(snapshot, dateKey, season) {
    if (!snapshot || snapshot.season !== season || !snapshot.byDate || !snapshot.games) return null;
    return (snapshot.byDate[dateKey] || []).map(function (id) {
      return hydrateSnapshotGame(id, snapshot.games[id]);
    }).filter(function (game) { return game && inCurrentSeason(game, season); });
  }

  var STALE_HOURS = 36;

  function snapshotFreshness(snapshot, now) {
    var fetched = snapshot && snapshot.fetched_at ? new Date(snapshot.fetched_at) : null;
    var known = !!(fetched && !isNaN(fetched.getTime()));
    var hours = known ? (now.getTime() - fetched.getTime()) / 36e5 : null;
    return { known: known, hours: hours, stale: !known || hours > STALE_HOURS };
  }

  function snapshotCaption(snapshot, now) {
    var fresh = snapshotFreshness(snapshot, now || new Date());
    var when = (snapshot && snapshot.fetched_at) || "an unknown time";
    var text = "Schedule snapshot from the daily hub build, fetched " + when + ". This is the published file, not a live page.";
    if (snapshot && snapshot.board_start && snapshot.board_end) {
      text += " Division I board dates " + snapshot.board_start + " through " + snapshot.board_end + ".";
    }
    if (fresh.stale) text += " This snapshot is older than 36 hours.";
    var failed = (snapshot && snapshot.failed) || [];
    if (failed.length) text += " " + failed.length + " team schedule fetches failed and are not shown as covered.";
    return text;
  }

  function snapshotTeamGames(snapshot, tid, espnId, season) {
    if (!snapshot || snapshot.season !== season || !snapshot.byTeam || !snapshot.games) return null;
    var ids = snapshot.byTeam[String(tid)];
    if (!ids) return null;
    return ids.map(function (id) {
      return hydrateSnapshotGame(id, snapshot.games[id]);
    }).filter(function (game) {
      return game && inCurrentSeason(game, season) && (String(game.homeEspn) === String(espnId) || String(game.awayEspn) === String(espnId));
    });
  }

  function renderDayBar(el, opts) {
    el.replaceChildren();
    var label = document.createElement("label");
    label.className = "sm";
    label.style.cssText = "display:inline-flex;align-items:center;gap:6px;font-weight:700";
    label.append(document.createTextNode((opts.label || "Day") + " "));
    var select = document.createElement("select");
    select.className = "v2";
    if (opts.id) select.id = opts.id;
    select.setAttribute("aria-label", opts.aria || opts.label || "Day");
    (opts.dates || []).forEach(function (key) {
      var option = document.createElement("option");
      option.value = key;
      option.textContent = dayLabel(key);
      if (key === opts.selected) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", function () { if (opts.onChange) opts.onChange(select.value); });
    label.appendChild(select);
    el.appendChild(label);
    if (opts.hint) {
      var hint = document.createElement("span");
      hint.className = "mut sm";
      hint.textContent = opts.hint;
      el.appendChild(hint);
    }
  }

  function decorateStatus(card, state, scoreText) {
    var prior = card.querySelector(":scope > .game-state");
    if (prior) prior.remove();
    var row = document.createElement("div");
    row.className = "game-state sm";
    row.style.marginTop = "4px";
    var pill = document.createElement("span");
    pill.className = "role-pill " + (state.kind === "final" ? "st" : state.kind === "live" ? "tr" : "bn");
    pill.textContent = state.label;
    row.appendChild(pill);
    if (state.showScore && scoreText) {
      row.appendChild(document.createTextNode(" " + scoreText));
    } else if (state.kind === "final") {
      var missing = document.createElement("span");
      missing.className = "mut sm";
      missing.textContent = " score unavailable";
      row.appendChild(missing);
    } else if (state.kind === "unknown") {
      var unknown = document.createElement("span");
      unknown.className = "mut sm";
      unknown.textContent = " result not verified";
      row.appendChild(unknown);
    }
    card.appendChild(row);
  }

  function teamLink(name, tid) {
    if (tid == null || !/^\d+$/.test(String(tid))) {
      var span = document.createElement("span");
      span.textContent = name || "Unknown";
      return span;
    }
    var link = document.createElement("a");
    link.href = "team.html?id=" + String(tid);
    link.textContent = name || "Unknown";
    return link;
  }

  function renderHubSchedule(el, opts) {
    el.replaceChildren();
    var card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "14px";
    var title = document.createElement("h3");
    title.style.margin = "0 0 6px";
    title.textContent = "D-I schedule and results";
    card.appendChild(title);
    var bar = document.createElement("div");
    bar.className = "ctl";
    var label = document.createElement("label");
    label.className = "sm";
    label.style.cssText = "display:inline-flex;align-items:center;gap:6px;font-weight:700";
    label.append(document.createTextNode("Day "));
    var input = document.createElement("input");
    input.type = "date";
    input.className = "v2";
    input.id = "hub-scoreboard-day";
    input.setAttribute("aria-label", "Hub schedule day");
    input.value = opts.date || "";
    if (opts.bounds) { input.min = opts.bounds.min; input.max = opts.bounds.max; }
    input.addEventListener("change", function () {
      if (/^\d{4}-\d{2}-\d{2}$/.test(input.value) && opts.onDate) opts.onDate(input.value);
    });
    label.appendChild(input);
    bar.appendChild(label);
    card.appendChild(bar);
    var note = document.createElement("p");
    note.className = "mut sm";
    var coverage = (opts.linked || 0) + " of " + (opts.teamCount || 0) + " teams are linked to the schedule feed.";
    if (opts.coverage && opts.coverage.length) coverage += " Unavailable: " + opts.coverage.join(", ") + ".";
    note.textContent = "Season " + (opts.season || "unavailable") + ". America/New_York. Listed by tip time. No model win probability is on this board. " + coverage + (opts.fallbackNote ? " " + opts.fallbackNote : "");
    card.appendChild(note);
    if (opts.loading) {
      var loading = document.createElement("p");
      loading.textContent = "Loading the schedule snapshot.";
      card.appendChild(loading);
    } else if (opts.error) {
      var error = document.createElement("p");
      error.textContent = "Schedule snapshot unavailable for this day. No scores were added.";
      card.appendChild(error);
    } else {
      var games = sortByTip((opts.games || []).filter(function (game) { return etDateKey(game.start) === opts.date; }));
      if (!games.length) {
        var empty = document.createElement("p");
        empty.textContent = "No Division I games on this date in the schedule snapshot.";
        card.appendChild(empty);
      } else {
        var list = document.createElement("div");
        games.forEach(function (game) {
          var state = displayState(game, opts.now || new Date());
          var row = document.createElement("div");
          row.className = "sched-row";
          var main = document.createElement("div");
          var time = document.createElement("div");
          time.className = "mut sm";
          time.textContent = timeLabel(game.start, game.timeTBD) + (game.neutral ? " · Neutral" : "");
          var match = document.createElement("div");
          match.appendChild(teamLink(game.awayName, opts.tidByEspn && opts.tidByEspn[game.awayEspn]));
          match.appendChild(document.createTextNode(" at "));
          match.appendChild(teamLink(game.homeName, opts.tidByEspn && opts.tidByEspn[game.homeEspn]));
          main.append(time, match);
          var status = document.createElement("div");
          status.className = "sched-status";
          status.textContent = state.label + (state.showScore ? " · " + game.awayName + " " + state.awayScore + ", " + game.homeName + " " + state.homeScore : (state.kind === "final" ? " · score unavailable" : state.kind === "unknown" ? " · result not verified" : ""));
          row.append(main, status);
          list.appendChild(row);
        });
        card.appendChild(list);
      }
    }
    el.appendChild(card);
  }

  function siteLabel(game, espnId) {
    var mine = String(espnId);
    if (game.neutral) return "Neutral";
    if (String(game.homeEspn) === mine) return "Home";
    if (String(game.awayEspn) === mine) return "Away";
    return "";
  }

  function renderTeamSchedule(panel, games, opts) {
    panel.replaceChildren();
    var note = document.createElement("p");
    note.className = "mut sm";
    note.textContent = "Season " + opts.season + ". America/New_York. Final scores appear only when the published snapshot status is final. This does not replace the roster, ratings, or props.";
    panel.appendChild(note);
    if (!games.length) {
      var empty = document.createElement("p");
      empty.textContent = "No " + opts.season + " games were returned for this team.";
      panel.appendChild(empty);
      return;
    }
    var list = document.createElement("div");
    sortByTip(games).forEach(function (game) {
      var home = String(game.homeEspn) === String(opts.espnId);
      var opp = home ? game.awayName : game.homeName;
      var state = displayState(game, opts.now);
      var row = document.createElement("div");
      row.className = "sched-row";
      var main = document.createElement("div");
      var time = document.createElement("div");
      time.className = "mut sm";
      time.textContent = timeLabel(game.start, game.timeTBD) + " · " + siteLabel(game, opts.espnId);
      var who = document.createElement("div");
      who.textContent = opp;
      main.append(time, who);
      var status = document.createElement("div");
      status.className = "sched-status";
      status.textContent = state.label + (state.showScore ? " · " + game.awayName + " " + state.awayScore + ", " + game.homeName + " " + state.homeScore : (state.kind === "final" ? " · score unavailable" : state.kind === "unknown" ? " · result not verified" : ""));
      row.append(main, status);
      list.appendChild(row);
    });
    panel.appendChild(list);
  }

  function mountTeamScheduleToggle(container, opts) {
    if (!container || container.querySelector("#team-schedule-toggle")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.id = "team-schedule-toggle";
    button.className = "chip";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "team-schedule-panel");
    button.textContent = "Show season schedule and results";
    var panel = document.createElement("div");
    panel.id = "team-schedule-panel";
    panel.hidden = true;
    panel.style.margin = "8px 0 12px";
    container.appendChild(button);
    container.appendChild(panel);
    var loaded = false;
    var loading = false;
    button.addEventListener("click", function () {
      var open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.textContent = open ? "Hide season schedule and results" : "Show season schedule and results";
      panel.hidden = !open;
      if (!open || loaded || loading) return;
      var bounds = seasonBounds(opts.now || new Date());
      if (opts.espnId == null || String(opts.espnId) === "") {
        panel.textContent = "Schedule unavailable for " + (opts.teamName || "this team") + ". No schedule link is stored on the team profile.";
        loaded = true;
        return;
      }
      if (!bounds.label) {
        panel.textContent = "Schedule unavailable. The season could not be verified.";
        loaded = true;
        return;
      }
      loading = true;
      panel.textContent = "Loading the " + bounds.label + " schedule snapshot.";
      var snapPromise = opts.snapshot ? Promise.resolve(opts.snapshot) : (root.fetch ? root.fetch("data/schedule_snapshot.json").then(function (response) {
        return response && response.ok ? response.json() : null;
      }).catch(function () { return null; }) : Promise.resolve(null));
      snapPromise.then(function (snap) {
        var failed = ((snap && snap.failed) || []).some(function (row) { return String(row.tid) === String(opts.tid); });
        var games = snapshotTeamGames(snap, opts.tid, opts.espnId, bounds.label);
        if (failed) {
          panel.textContent = "Schedule fetch failed for " + (opts.teamName || "this team") + " on the last hub build. No scores were added.";
        } else if (!games) {
          panel.textContent = "Schedule snapshot unavailable for " + (opts.teamName || "this team") + ". No scores were added.";
        } else {
          renderTeamSchedule(panel, games, { season: bounds.label, espnId: opts.espnId, now: opts.now || new Date() });
          var caption = document.createElement("p");
          caption.className = "mut sm";
          caption.textContent = snapshotCaption(snap, opts.now || new Date());
          panel.insertBefore(caption, panel.firstChild);
        }
        loaded = true;
        loading = false;
      });
    });
  }

  root.ScheduleView = {
    etDateKey: etDateKey,
    seasonFromDateKey: seasonFromDateKey,
    seasonLabel: seasonLabel,
    seasonBounds: seasonBounds,
    inCurrentSeason: inCurrentSeason,
    dayLabel: dayLabel,
    timeLabel: timeLabel,
    uniqueDates: uniqueDates,
    nearestDate: nearestDate,
    filterDay: filterDay,
    sortStableDesc: sortStableDesc,
    scoreNum: scoreNum,
    kindFromStatus: kindFromStatus,
    displayState: displayState,
    stateForPublished: stateForPublished,
    parseEvent: parseEvent,
    parseScoreboard: parseScoreboard,
    snapshotDateGames: snapshotDateGames,
    snapshotTeamGames: snapshotTeamGames,
    snapshotFreshness: snapshotFreshness,
    snapshotCaption: snapshotCaption,
    sortByTip: sortByTip,
    renderDayBar: renderDayBar,
    decorateStatus: decorateStatus,
    renderHubSchedule: renderHubSchedule,
    renderTeamSchedule: renderTeamSchedule,
    mountTeamScheduleToggle: mountTeamScheduleToggle
  };
})(typeof window !== "undefined" ? window : globalThis);
