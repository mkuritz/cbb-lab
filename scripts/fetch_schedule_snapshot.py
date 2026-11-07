#!/usr/bin/env python3
"""Read-only ESPN schedule snapshot for the existing daily hub build.

Does not modify data/cbb.json, model probabilities, or props.
A rejected fetch leaves the previous snapshot file untouched.
Final scores are stored only for a verified final.
"""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from schedule_status import public_scores, resolve_kind

ET = ZoneInfo("America/New_York")
UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
MIN_WITH_GAMES = 300
STALE_HOURS = 36
FORBIDDEN = {"dog_win_prob", "home_win", "upset_score", "props"}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def et_date(iso):
    from schedule_status import parse_start
    parsed = parse_start(iso)
    if parsed is None:
        return None
    return parsed.astimezone(ET).date().isoformat()


def season_label(date_key):
    year, month = int(date_key[:4]), int(date_key[5:7])
    start = year if month >= 7 else year - 1
    return f"{start}-{str(start + 1)[2:]}"


def current_season(now):
    local = now.astimezone(ET)
    start = local.year if local.month >= 7 else local.year - 1
    return f"{start}-{str(start + 1)[2:]}", start + 1


def board_days(now):
    """Rolling ET window the daily build refreshes. Fourteen days back and ahead."""
    today = now.astimezone(ET).date()
    start = today - timedelta(days=14)
    return [start + timedelta(days=offset) for offset in range(29)]


def snapshot_is_stale(fetched_at, now, hours=STALE_HOURS):
    from schedule_status import parse_start
    parsed = parse_start(fetched_at)
    if parsed is None:
        return True
    return now.astimezone(timezone.utc) - parsed > timedelta(hours=hours)


def _score_ok(game):
    kind = game.get("kind")
    home, away = game.get("homeScore"), game.get("awayScore")
    if any(key in game for key in FORBIDDEN):
        return False
    if kind == "final":
        return isinstance(home, int) and isinstance(away, int) and not isinstance(home, bool) and not isinstance(away, bool)
    return home is None and away is None


def _accept(new, previous, teams, now=None):
    now = now or datetime.now(timezone.utc)
    season, espn_year = current_season(now)
    if new.get("season") != season or new.get("espn_season") != espn_year:
        return False, "season"
    games = new.get("games") or {}
    if not games:
        return False, "no games"
    if any(not isinstance(game, dict) or not _score_ok(game) for game in games.values()):
        return False, "scores"
    expected = sorted((t["id"], t["team"]) for t in teams if not t.get("espnId"))
    got = sorted((row.get("tid"), row.get("team")) for row in (new.get("unavailable") or []))
    linked = [t for t in teams if t.get("espnId")]
    if got != expected or new.get("teams") != len(teams) or new.get("linked") != len(linked):
        return False, "coverage"
    by_team = new.get("byTeam") or {}
    failed_ids = {row.get("tid") for row in (new.get("failed") or [])}
    for tid in failed_ids:
        if by_team.get(str(tid)):
            return False, "failed team listed as covered"
    actual_with = sum(1 for ids in by_team.values() if ids)
    if actual_with != new.get("with_games"):
        return False, "with_games mismatch"
    if len(new.get("failed") or []) > max(5, int(0.05 * max(len(linked), 1))):
        return False, "too many team fetch failures"
    if len(new.get("board_failed") or []) > 14:
        return False, "board incomplete"
    if actual_with < MIN_WITH_GAMES:
        return False, "with_games below floor"
    if previous:
        prev_with = previous.get("with_games") or 0
        if prev_with and actual_with < int(prev_with * 0.9):
            return False, "with_games collapsed"
    return True, "ok"


def accept_snapshot(new, previous, teams, now):
    if not isinstance(new, dict):
        return False, "not an object"
    if any(key in new for key in ("props", "upset_radar", "home_win", "dog_win_prob")):
        return False, "model fields"
    return _accept(new, previous, teams, now)


def publish_snapshot(dest, new, teams, now):
    """Write only an accepted snapshot. A refusal leaves dest bytes unchanged."""
    previous = None
    if dest.exists():
        previous = json.loads(dest.read_text())
    ok, reason = accept_snapshot(new, previous, teams, now)
    if not ok:
        return False, reason
    temporary = dest.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(new, separators=(",", ":")))
    temporary.replace(dest)
    return True, reason


def event_row(event, now, season):
    comp = (event.get("competitions") or [{}])[0]
    rows = comp.get("competitors") or []
    home = next((row for row in rows if row.get("homeAway") == "home"), None)
    away = next((row for row in rows if row.get("homeAway") == "away"), None)
    if not home or not away or event.get("id") is None:
        return None
    start = comp.get("date") or event.get("date")
    day = et_date(start)
    if not day or season_label(day) != season:
        return None
    status = ((comp.get("status") or {}).get("type") or {})
    kind = resolve_kind(status, start, now)
    home_score, away_score = public_scores(kind, home.get("score"), away.get("score"))
    def name(row):
        team = row.get("team") or {}
        return team.get("displayName") or team.get("shortDisplayName") or team.get("name") or "Unknown"
    def espn(row):
        team = row.get("team") or {}
        return None if team.get("id") is None else str(team.get("id"))
    return str(event["id"]), {
        "start": start,
        "neutral": bool(comp.get("neutralSite")),
        "homeEspn": espn(home),
        "awayEspn": espn(away),
        "homeName": name(home),
        "awayName": name(away),
        "kind": kind,
        "homeScore": home_score,
        "awayScore": away_score,
    }


def main():
    now = datetime.now(timezone.utc)
    season, espn_year = current_season(now)
    cbb = json.load(open(ROOT / "data/cbb.json"))
    teams = cbb["teams"]
    games = {}
    by_team = {}
    by_date = {}
    failed = []
    board_failed = []
    unavailable = [{"tid": t["id"], "team": t["team"], "reason": "no ESPN id"} for t in teams if not t.get("espnId")]

    def team_job(team):
        try:
            url = ("https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/"
                   f"{team['espnId']}/schedule?season={espn_year}")
            payload = get_json(url)
            rows = []
            for event in payload.get("events") or []:
                parsed = event_row(event, now, season)
                if not parsed:
                    continue
                gid, row = parsed
                if str(team["espnId"]) not in (row["homeEspn"], row["awayEspn"]):
                    continue
                rows.append((gid, row))
            return team, rows, None
        except Exception as exc:
            return team, [], type(exc).__name__

    linked = [t for t in teams if t.get("espnId")]
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(team_job, team) for team in linked]
        for future in as_completed(futures):
            team, rows, error = future.result()
            if error:
                failed.append({"tid": team["id"], "team": team["team"], "reason": error})
                continue
            ids = []
            for gid, row in rows:
                games[gid] = row
                ids.append(gid)
            ids.sort(key=lambda gid: games[gid]["start"])
            by_team[str(team["id"])] = ids

    # The hub day board is the Division I scoreboard, not every team-schedule opponent.
    days = board_days(now)
    for day in days:
        key = day.strftime("%Y%m%d")
        iso = day.isoformat()
        url = ("https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
               f"?dates={key}&groups=50&limit=300")
        try:
            payload = get_json(url)
        except Exception as exc:
            board_failed.append({"date": iso, "reason": type(exc).__name__})
            continue
        ids = []
        for event in payload.get("events") or []:
            parsed = event_row(event, now, season)
            if not parsed:
                continue
            gid, row = parsed
            if et_date(row["start"]) != iso:
                continue
            games[gid] = row
            ids.append(gid)
        ids.sort(key=lambda gid: games[gid]["start"])
        by_date[iso] = ids

    snapshot = {
        "fetched_at": now.astimezone(ET).isoformat(timespec="minutes"),
        "season": season,
        "espn_season": espn_year,
        "board_start": days[0].isoformat(),
        "board_end": days[-1].isoformat(),
        "source": "ESPN men's college basketball team schedule and Division I scoreboard",
        "teams": len(teams),
        "linked": len(linked),
        "with_games": sum(1 for ids in by_team.values() if ids),
        "unavailable": unavailable,
        "failed": failed,
        "board_failed": board_failed,
        "games": games,
        "byTeam": by_team,
        "byDate": by_date,
    }
    dest = ROOT / "data/schedule_snapshot.json"
    ok, reason = publish_snapshot(dest, snapshot, teams, now)
    if not ok:
        print(f"snapshot refused ({reason}); previous file kept", file=sys.stderr)
        sys.exit(2)
    print(f"games={len(games)} teams_with_games={snapshot['with_games']} unavailable={len(unavailable)} failed={len(failed)} bytes={dest.stat().st_size} stale={snapshot_is_stale(snapshot['fetched_at'], now)}")


if __name__ == "__main__":
    main()
