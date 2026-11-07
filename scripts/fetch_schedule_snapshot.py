#!/usr/bin/env python3
"""Read-only ESPN schedule snapshot for static display.

Does not modify data/cbb.json, model probabilities, props, or the daily workflow.
Final scores are stored only for a verified final.
"""
import json
import os
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
NOW = datetime.now(timezone.utc)


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


def event_row(event, now):
    comp = (event.get("competitions") or [{}])[0]
    rows = comp.get("competitors") or []
    home = next((row for row in rows if row.get("homeAway") == "home"), None)
    away = next((row for row in rows if row.get("homeAway") == "away"), None)
    if not home or not away or event.get("id") is None:
        return None
    start = comp.get("date") or event.get("date")
    day = et_date(start)
    if not day or season_label(day) != "2026-27":
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
    cbb = json.load(open(ROOT / "data/cbb.json"))
    teams = cbb["teams"]
    games = {}
    by_team = {}
    by_date = {}
    failed = []
    unavailable = [{"tid": t["id"], "team": t["team"], "reason": "no ESPN id"} for t in teams if not t.get("espnId")]

    def team_job(team):
        try:
            url = ("https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/"
                   f"{team['espnId']}/schedule?season=2027")
            payload = get_json(url)
            rows = []
            for event in payload.get("events") or []:
                parsed = event_row(event, NOW)
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
    start = datetime(2026, 11, 1).date()
    for offset in range(22):
        day = start + timedelta(days=offset)
        key = day.strftime("%Y%m%d")
        iso = day.isoformat()
        url = ("https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
               f"?dates={key}&groups=50&limit=300")
        try:
            payload = get_json(url)
        except Exception as exc:
            failed.append({"date": iso, "reason": type(exc).__name__})
            continue
        ids = []
        for event in payload.get("events") or []:
            parsed = event_row(event, NOW)
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
        "fetched_at": NOW.astimezone(ET).isoformat(timespec="minutes"),
        "season": "2026-27",
        "espn_season": 2027,
        "source": "ESPN men's college basketball team schedule and Division I scoreboard",
        "teams": len(teams),
        "linked": len(linked),
        "with_games": sum(1 for ids in by_team.values() if ids),
        "unavailable": unavailable,
        "failed": failed,
        "games": games,
        "byTeam": by_team,
        "byDate": by_date,
    }
    dest = ROOT / "data/schedule_snapshot.json"
    dest.write_text(json.dumps(snapshot, separators=(",", ":")))
    print(f"games={len(games)} teams_with_games={snapshot['with_games']} unavailable={len(unavailable)} failed={len(failed)} bytes={dest.stat().st_size}")


if __name__ == "__main__":
    main()
