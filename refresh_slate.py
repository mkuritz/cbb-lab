"""CBB Hub daily slate refresh: today + tomorrow (ET) Featured Matchups, starters and model props.

Why this exists: cbb.json "games" (and the props/starters hanging off them) were written once for the Nov 1-3 opening week by the
private-cache box build and were never refreshed by the daily workflow, which only restamped teams / Upset Radar / conference board.
This step needs ONLY published data (cbb.json teams + rotations, the free ESPN scoreboard, and Bet Lab's published cbb_lines.json), so it
runs on the GitHub-hosted runner every build. 0 Odds API credits. Fail-soft: if ESPN returns nothing the existing slate is left untouched.
Game model: same efficiency/tempo formula the hub has always used (HCA 1.6, SD 12.2); when Bet Lab's in-season walk-forward pricer has the
game (cbb_lines.json) its model spread / total / win probability are used instead. Credit stays 'Ratings: barttorvik.com'.
"""
import json, math, os, sys, urllib.request, datetime as dt
from zoneinfo import ZoneInfo
import enrich_cbb_hub as E
from build_players_props import select_players, build_props

CBB_JSON = E.CBB_JSON
ET = ZoneInfo("America/New_York")
SLATE_DAYS = 2        # today + tomorrow (ET)
TOP_RK = 100          # featured when either team is AP-ranked or Torvik top-100
HCA, SD, AVG_EFF, PACE_K = 1.6, 12.2, 104.0, 0.983

def lines_by_game():
    try:
        j = json.load(urllib.request.urlopen(urllib.request.Request("https://betlab.sportslabshq.com/data/cbb_lines.json", headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
    except Exception as ex:
        print("cbb_lines fetch warn:", ex); return {}
    out = {}
    for g in j.get("games", []):
        ml = next((m for m in g.get("markets", []) if m.get("market") == "moneyline"), {})
        out[str(g.get("game_id"))] = (g.get("sl_model_spread_home"), g.get("sl_model_total"), ml.get("p_home"))
    return out

def team_badge_kinds(t):
    return {b.get("kind"): b for b in (t.get("badges") or [])}

def game_badges(aw, hm, pace, total):
    out = []
    if pace >= 70.5:
        out.append({"kind": "tempo", "txt": f"⚡ Tempo Track Meet ({pace} Proj Poss · O/U {total})"})
    cand = [t for t in (aw, hm) if (t.get("threeRate") or 0) >= 38]
    if cand:
        t = max(cand, key=lambda x: x.get("threeRate") or 0); out.append({"kind": "three", "txt": f"🎯 3PT Perimeter Funnel: {t['ab']} ({round(t['threeRate'])}% 3PAr)"})
    cand = [t for t in (aw, hm) if (t.get("orbPct") or 0) >= 26]
    if cand:
        t = max(cand, key=lambda x: x.get("orbPct") or 0); out.append({"kind": "orb", "txt": f"💪 Glass / ORB Bully: {t['ab']} ({t['orbPct']:.1f}% ORB)"})
    cand = [t for t in (aw, hm) if (t.get("havoc40") or 0) >= 10]
    if cand:
        t = max(cand, key=lambda x: x.get("havoc40") or 0); out.append({"kind": "press", "txt": f"🔒 Turnover Press: {t['ab']} Defense"})
    return out

def main():
    D = json.load(open(CBB_JSON))
    espn_to_t = {str(t.get("espnId")): t for t in D["teams"] if t.get("espnId")}
    now = dt.datetime.now(ET)
    days = {(now.date() + dt.timedelta(days=k)).isoformat() for k in range(SLATE_DAYS)}
    raw = [g for g in E.fetch_espn_nov_games(espn_to_t)
           if dt.datetime.fromisoformat(g["start"].replace("Z", "+00:00")).astimezone(ET).date().isoformat() in days]
    if not raw:
        print("slate refresh: ESPN returned no games for", sorted(days), "- keeping existing slate"); return 0
    lines = lines_by_game()
    games = []
    for g in raw:
        aw, hm = g["away_t"], g["home_t"]
        if not ((aw.get("ap") or hm.get("ap")) or min(aw.get("torvikRk") or 999, hm.get("torvikRk") or 999) <= TOP_RK):
            continue
        neutral = g["neutral"]
        pace = round(PACE_K * 0.5 * ((aw.get("adjT") or 68.5) + (hm.get("adjT") or 68.5)), 1)
        pts_a = (aw.get("adjO") or 104) * (hm.get("adjD") or 104) / AVG_EFF
        pts_h = (hm.get("adjO") or 104) * (aw.get("adjD") or 104) / AVG_EFF
        margin = (pts_h - pts_a) * pace / 100.0 + (0.0 if neutral else HCA)
        spread, total = round(-margin, 1), round((pts_a + pts_h) * pace / 100.0, 1)
        p_home = round(min(0.995, max(0.005, E.norm_cdf(margin / SD))), 3)
        src = "preseason prior"
        sl = lines.get(str(g["id"]))
        if sl and sl[0] is not None and sl[1] is not None:
            spread, total = sl[0], sl[1]
            p_home = round(sl[2], 3) if sl[2] is not None else round(min(0.995, max(0.005, E.norm_cdf(-spread / SD))), 3)
            src = "in-season ratings"
        games.append({
            "id": g["id"], "start": g["start"], "neutral": neutral, "venue": g["venue"], "tv": g["tv"],
            "away": aw["ab"], "home": hm["ab"], "away_name": aw["team"], "home_name": hm["team"],
            "away_tid": aw["id"], "home_tid": hm["id"], "away_rk": aw.get("ap"), "home_rk": hm.get("ap"),
            "away_conf": aw.get("conf"), "home_conf": hm.get("conf"),
            "pace": pace, "spread_home": spread, "total": total, "home_win": p_home, "model_src": src,
            "game_state": g.get("game_state"), "home_score": g.get("home_score"), "away_score": g.get("away_score"),
            "badges": game_badges(aw, hm, pace, total),
        })
    if not games:
        print("slate refresh: no featured games in window - keeping existing slate"); return 0
    games.sort(key=lambda x: x["start"])
    D["games"] = games
    all_players = [p for t in D["teams"] for p in (t.get("rot") or [])]
    select_players(D, all_players)
    # props only for games that have not started (live / final games keep their card without new picks)
    keep = D["games"]
    D["games"] = [g for g in keep if g.get("game_state") == "scheduled"]
    build_props(D)
    done = {g["id"]: g for g in D["games"]}
    D["games"] = [done.get(g["id"], g) for g in keep]
    for g in D["games"]:
        if g["id"] not in done:   # starters for the card even when no new props are generated
            tb = {t["id"]: t for t in D["teams"]}
            for side, tid in (("away_starters", g["away_tid"]), ("home_starters", g["home_tid"])):
                g[side] = [{"id": p["id"], "n": p["n"], "pos": p["pos"], "slot": p.get("slot", "G"), "min": p["proj_min"], "usg": p["usg"], "pts": p["proj_pts"], "reb": p["proj_reb"], "ast": p["proj_ast"], "is_star": p.get("is_star"), "nba_tier": p.get("nba_tier")} for p in (tb[tid].get("rot") or [])[:5]]
            g["top_props"] = []
    D["slate_updated"] = now.strftime("%Y-%m-%dT%H:%M%z")
    D["slate_dates"] = sorted(days)
    D["ratings_credit"] = "Ratings: barttorvik.com"
    json.dump(D, open(CBB_JSON, "w"), separators=(",", ":"))
    print(f"slate refresh: {len(games)} featured games ({sorted(days)}), {len(D['props'])} props, {len(D['players'])} players")
    return 0

if __name__ == "__main__":
    sys.exit(main())
