#!/usr/bin/env python3
"""Attach real 2026-27 per-player game logs (completed games only) to the rotation players of teams on the featured slate.

Source: free ESPN team schedules + game box scores, 0 Odds API credits. Box-score rows are cached in data/game_logs.json (one entry per
completed game, fetched once) so each daily run only fetches games played since the last run. Fills the `game_logs` contract that
scripts/build_matchup_analyzer.py reads (gid, start, season, completed, tid, opp_tid, home, min/pts/reb/ast/tpm/fgm/fga/fta/tpa).
Fail-soft: a failed fetch leaves the cache and cbb.json as they were.
"""
import json, sys, os, urllib.request, concurrent.futures as cf
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CBB = Path(os.environ.get("CBB_JSON") or ROOT / "data/cbb.json")
CACHE = ROOT / "data/game_logs.json"
SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball"
SEASON = "2026-27"
SEASON_START = "2026-11-01"

def get(url):
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=25))
        except Exception:
            pass
    return None

def num(v):
    try:
        return float(str(v).split("-")[0])
    except ValueError:
        return None

def made_att(v):
    try:
        a, b = str(v).split("-"); return float(a), float(b)
    except ValueError:
        return None, None

def box_rows(eid):
    b = get(f"{SITE}/summary?event={eid}")
    if not b:
        return None
    comp = ((b.get("header") or {}).get("competitions") or [{}])[0]
    if not (comp.get("status") or {}).get("type", {}).get("completed"):
        return None
    out = {"start": comp.get("date"), "teams": {}, "rows": []}
    for c in comp.get("competitors", []):
        out["teams"][str(c["team"]["id"])] = c.get("homeAway")
    for tb in (b.get("boxscore") or {}).get("players", []):
        tid = str(tb["team"]["id"])
        for grp in tb.get("statistics", []):
            keys = grp.get("keys", [])
            for a in grp.get("athletes", []):
                if a.get("didNotPlay") or not a.get("stats"):
                    continue
                st = dict(zip(keys, a["stats"]))
                m = num(st.get("minutes"))
                if not m or m <= 0:
                    continue
                fgm, fga = made_att(st.get("fieldGoalsMade-fieldGoalsAttempted"))
                tpm, tpa = made_att(st.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted"))
                _, fta = made_att(st.get("freeThrowsMade-freeThrowsAttempted"))
                out["rows"].append([tid, str(a["athlete"]["id"]), m, num(st.get("points")), num(st.get("rebounds")), num(st.get("assists")), tpm, fgm, fga, fta, tpa])
    return out

def main():
    D = json.loads(CBB.read_text())
    tbi = {str(t["id"]): t for t in D["teams"]}
    espn_to_hub = {str(t["espnId"]): t["id"] for t in D["teams"] if t.get("espnId")}
    slate = {g[k] for g in D.get("games", []) for k in ("away_tid", "home_tid")}
    teams = [tbi[str(t)] for t in slate if str(t) in tbi]
    if not teams:
        print("game logs: no slate teams; nothing to do"); return 0
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    def sched(t):
        s = get(f"{SITE}/teams/{t['espnId']}/schedule")
        if not s:
            return None
        return [e["id"] for e in s.get("events", []) if e["competitions"][0]["status"]["type"]["completed"] and e["date"][:10] >= SEASON_START]
    with cf.ThreadPoolExecutor(10) as ex:
        res = list(ex.map(sched, teams))
    if sum(r is None for r in res) > len(res) * 0.2:
        print("game logs: too many schedule fetch failures; keeping existing logs"); return 0
    eids = sorted({e for r in res if r for e in r})
    new = [e for e in eids if e not in cache]
    with cf.ThreadPoolExecutor(10) as ex:
        for eid, r in zip(new, ex.map(box_rows, new)):
            if r:
                cache[eid] = r
    CACHE.write_text(json.dumps(cache, separators=(",", ":")) + "\n")
    # attach to rotation players
    by_player = {}
    for eid in eids:
        g = cache.get(eid)
        if not g:
            continue
        for tid, aid, mi, pts, reb, ast, tpm, fgm, fga, fta, tpa in g["rows"]:
            hub, opp = espn_to_hub.get(tid), None
            for ot in g["teams"]:
                if ot != tid:
                    opp = espn_to_hub.get(ot)
            if hub is None or opp is None:
                continue
            row = {"gid": eid, "start": g["start"], "season": SEASON, "completed": True, "tid": hub, "opp_tid": opp,
                   "home": g["teams"].get(tid) == "home", "min": mi}
            for k, v in (("pts", pts), ("reb", reb), ("ast", ast), ("tpm", tpm), ("fgm", fgm), ("fga", fga), ("fta", fta), ("tpa", tpa)):
                if v is not None:
                    row[k] = v
            by_player.setdefault((hub, aid), []).append(row)
    n = 0
    for t in teams:
        for p in t.get("rot", []):
            rs = by_player.get((t["id"], str(p.get("id"))))
            if rs:
                p["game_logs"] = sorted(rs, key=lambda r: r["start"], reverse=True)[:12]; n += 1
            else:
                p.pop("game_logs", None)
    CBB.write_text(json.dumps(D, separators=(",", ":")))
    print(f"game logs: {len(teams)} slate teams, {len(eids)} completed games ({len(new)} newly fetched), logs on {n} rotation players")
    return 0

if __name__ == "__main__":
    sys.exit(main())
