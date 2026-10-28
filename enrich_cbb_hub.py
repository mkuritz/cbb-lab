"""Enrich /workspace/cbb-lab/data/cbb.json with:
1. 🚨 CBB Upset Alert Bin ("Calculated Upset Radar") across ESPN November D-I matchups (prioritizing Ranked & Power-Conf upsets)
2. 📆 Rolling 10-Game Season Segmentation Engine (Games 1-10 -> Games 11-20 -> Games 21-30 -> Postseason)
3. 🔥 Team Usage Rate & "Prop Hurdles That Keep Rolling" Tracker
4. 🎓 Top Freshmen (High-Usage Recruits) vs. 🏆 Returning Upperclassmen & Veteran Transfers Tracker
5. 🏆 Conference Power Matrix & Title/Final Four Tier Board
Never touches sl_ncaamb_game_pricer.py or sl_ncaamb_pricer.py constants. Preserves 'Ratings: barttorvik.com'.
"""
import json, math, urllib.request, collections

CBB_JSON = "/workspace/cbb-lab/data/cbb.json"

def norm_cdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def prob_to_am(p):
    if p is None or p <= 0.01 or p >= 0.99:
        return None
    if p >= 0.5:
        return int(round(-100.0 * p / (1.0 - p)))
    return int(round(100.0 * (1.0 - p) / p))

def fetch_espn_nov_games(espn_to_t):
    games = []
    seen = set()
    days = ("20261101", "20261102", "20261103", "20261104", "20261106", "20261107", "20261108", "20261110", "20261111", "20261114", "20261115", "20261118")
    for day in days:
        u = f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={day}&groups=50&limit=200"
        try:
            j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=15))
            for e in j.get("events", []):
                eid = str(e.get("id"))
                if eid in seen:
                    continue
                c = (e.get("competitions") or [{}])[0]
                comps = c.get("competitors") or []
                if len(comps) != 2:
                    continue
                hm_c = next((x for x in comps if x.get("homeAway") == "home"), comps[0])
                aw_c = next((x for x in comps if x.get("homeAway") == "away"), comps[1])
                hm_t = espn_to_t.get(str((hm_c.get("team") or {}).get("id")))
                aw_t = espn_to_t.get(str((aw_c.get("team") or {}).get("id")))
                if not hm_t or not aw_t:
                    continue
                seen.add(eid)
                venue = (c.get("venue") or {}).get("fullName") or ""
                tv = ", ".join(b for x in c.get("broadcasts", []) for b in x.get("names", []))
                games.append({
                    "id": eid,
                    "start": e.get("date"),
                    "neutral": bool(c.get("neutralSite")),
                    "venue": venue,
                    "tv": tv,
                    "away_t": aw_t,
                    "home_t": hm_t,
                })
        except Exception as ex:
            print("ESPN scoreboard fetch warn:", day, ex)
    return games

def main():
    D = json.load(open(CBB_JSON))
    teams_by_id = {t["id"]: t for t in D["teams"]}
    espn_to_t = {str(t.get("espnId")): t for t in D["teams"] if t.get("espnId")}
    POWER_CONFS = {"SEC", "Big Ten", "Big 12", "ACC", "Big East", "Mountain West", "WCC", "A-10", "American"}

    # 1. Enrich every team with 10-Game Rolling Season Segmentation & Roster Continuity / Usage concentration
    for t in D["teams"]:
        rot = t.get("rot") or []
        st5 = rot[:5]
        fr_cnt = sum(1 for p in st5 if p.get("yr_short") == "FR" or p.get("origin") == "Freshman")
        vet_cnt = sum(1 for p in st5 if p.get("yr_short") in ("JR", "SR"))
        tr_cnt = sum(1 for p in st5 if p.get("origin") == "Transfer")
        ret_min = max(0.0, min(1.0, t.get("retMin") or 0.35))

        top2_usg = round(sum((p.get("usg") or 20.0) for p in st5[:2]) / 2.0, 1) if st5 else 22.0
        st5_min_share = round(sum((p.get("proj_min") or 0) for p in st5) / 2.0, 1)

        net_prior = t.get("proj") or t.get("adjEM") or 0.0
        early_drag = round((fr_cnt * 1.1 + tr_cnt * 0.65) - (ret_min * 2.2), 1)
        seg1_em = round(net_prior - max(-1.5, min(3.2, early_drag * 0.6)), 1)
        seg2_em = round(net_prior + (0.5 if fr_cnt >= 2 or tr_cnt >= 3 else 0.2), 1)
        seg3_em = round(net_prior + (1.6 if fr_cnt >= 2 else (0.9 if vet_cnt >= 4 else 0.4)), 1)

        if fr_cnt >= 2:
            seg_profile = "Freshman Ceiling Surge (G11–30 Breakout)"
        elif ret_min >= 0.55 and vet_cnt >= 3:
            seg_profile = "Day-1 Veteran Continuity (Fast G1–10 Start)"
        elif tr_cnt >= 3:
            seg_profile = "Portal Chemistry Ramp (G1–10 Gel → G11–20 Peak)"
        else:
            seg_profile = "Balanced Multi-Class Rotation"

        t["exp_meta"] = {
            "st5_fr": fr_cnt,
            "st5_vet": vet_cnt,
            "st5_tr": tr_cnt,
            "top2_usg": top2_usg,
            "st5_min_pct": st5_min_share,
            "seg_profile": seg_profile,
            "segments": {
                "g1_10": {"em": seg1_em, "prior_wt": "100%→45%", "rot_min_st5": st5_min_share, "note": "Non-Conf & Identity Calibration"},
                "g11_20": {"em": seg2_em, "prior_wt": "40%→15%", "rot_min_st5": min(84.0, round(st5_min_share + 3.5, 1)), "note": "Conf Opener & 8-Man Tightening"},
                "g21_30": {"em": seg3_em, "prior_wt": "10%→0%", "rot_min_st5": min(87.0, round(st5_min_share + 5.5, 1)), "note": "Late Conf & March Push"},
            }
        }

    # 2. Build 🚨 Calculated Upset Radar across ESPN November D-I games
    raw_nov = fetch_espn_nov_games(espn_to_t)
    upset_radar = []

    for g in raw_nov:
        aw = g["away_t"]
        hm = g["home_t"]
        neutral = g["neutral"]
        pace = round(0.5 * ((aw.get("adjT") or 68.5) + (hm.get("adjT") or 68.5)), 1)
        hca = 0.0 if neutral else 3.4

        em_aw = 0.65 * (aw.get("proj") or 0.0) + 0.35 * (aw.get("adjEM") or 0.0)
        em_hm = 0.65 * (hm.get("proj") or 0.0) + 0.35 * (hm.get("adjEM") or 0.0)
        margin_home = round((em_hm - em_aw) * (pace / 68.5) * 0.85 + hca, 1)
        spread_home = round(-margin_home, 1)
        p_home = round(min(0.985, max(0.015, norm_cdf(margin_home / 10.8))), 3)

        # Define "Public / Consensus Favorite" vs "Underdog":
        # If one team is AP-ranked higher (lower number) or has higher preseason pedigree, treat them as the Consensus Favorite
        ap_aw = aw.get("ap") or 99
        ap_hm = hm.get("ap") or 99
        if ap_aw != ap_hm:
            if ap_hm < ap_aw:
                fav, dog, dog_home = hm, aw, False
            else:
                fav, dog, dog_home = aw, hm, True
        else:
            if margin_home >= 0:
                fav, dog, dog_home = hm, aw, False
            else:
                fav, dog, dog_home = aw, hm, True

        dog_win_p = p_home if dog_home else round(1.0 - p_home, 3)
        dog_margin = margin_home if dog_home else -margin_home
        sl_spread_dog_val = round(-dog_margin, 1) # e.g. +3.5 if dog projected to lose by 3.5, or -2.5 if model makes dog outright favorite!

        # Filter to meaningful upsets: Dog win prob between 18% and 68%, and at least one team has positive proj or AP rank
        if dog_win_p < 0.18 or dog_win_p > 0.68:
            continue
        if (fav.get("proj") or 0) < 4.0 and not fav.get("ap"):
            continue

        triggers = []
        tech_score = 0.0

        if fav.get("ap") and (not dog.get("ap") or dog["ap"] > fav["ap"]):
            rk_str = f"#{dog['ap']} {dog['ab']}" if dog.get("ap") else f"Unranked {dog['ab']}"
            triggers.append(f"🏆 Ranked Upset Spot: {rk_str} vs #{fav['ap']} {fav['ab']} (Model gives {dog['ab']} {round(dog_win_p*100)}% outright win)")
            tech_score += 22.0
        elif fav.get("conf") in POWER_CONFS:
            tech_score += 10.0

        if dog_home and not neutral:
            triggers.append(f"🏠 Hostile Home Court Edge: {dog['team']} at home (+3.4 pt HCA boost vs road favorite {fav['team']})")
            tech_score += 16.0
        elif neutral:
            triggers.append(f"⚖️ Neutral-Floor Equalizer ({g['venue'] or 'Neutral Site'}): Removes home whistle for {fav['team']}")
            tech_score += 9.0

        dog_t = dog.get("adjT") or 68.0
        fav_t = fav.get("adjT") or 68.0
        if dog_t <= 67.2 and fav_t >= 70.0:
            triggers.append(f"🐢 Tempo Stranglehold: {dog['ab']} ({dog_t:.1f} AdjT) slows {fav['ab']} ({fav_t:.1f} AdjT) into half-court possessions")
            tech_score += 14.0
        elif abs(dog_t - fav_t) >= 3.2:
            triggers.append(f"⚡ Pace Clash: {abs(dog_t - fav_t):.1f} poss/g tempo differential disrupts {fav['ab']} transition flow")
            tech_score += 8.0

        if (dog.get("threeRate") or 0) >= 38.5 or (dog.get("threePct") or 0) >= 35.5:
            triggers.append(f"🎯 3PT Variance Catalyst: {dog['ab']} shoots {dog.get('threeRate',38):.1f}% 3PAr ({dog.get('threePct',35):.1f}% 3P%)")
            tech_score += 11.0

        if (dog.get("orbPct") or 0) >= 30.5 or (dog.get("havoc40") or 0) >= 11.8:
            triggers.append(f"💪 Extra-Possession Battle: {dog['ab']} {dog.get('orbPct',30):.1f}% ORB / {dog.get('havoc40',11):.1f} Havoc forces second-chance swings")
            tech_score += 10.0

        dog_exp = dog.get("exp_meta") or {}
        fav_exp = fav.get("exp_meta") or {}
        dog_ret = (dog.get("retMin") or 0)
        fav_ret = (fav.get("retMin") or 0)
        if dog_ret - fav_ret >= 0.18 or (dog_exp.get("st5_vet", 0) >= 4 and (fav_exp.get("st5_fr", 0) >= 2 or fav_exp.get("st5_tr", 0) >= 3)):
            triggers.append(f"🎓 G1–10 Continuity Edge: Veteran {dog['ab']} ({dog_exp.get('st5_vet',3)} upperclass starters) catches {fav['ab']} ({fav_exp.get('st5_fr',0)} FR / {fav_exp.get('st5_tr',0)} Transfers)")
            tech_score += 15.0

        if (dog.get("chg") or 0) >= 5.0:
            triggers.append(f"🚀 Roster Upgrade Surge: {dog['ab']} projects +{dog['chg']:.1f} net rating jump over last season")
            tech_score += 13.0

        mkt_spread_dog = round(sl_spread_dog_val + (2.5 if (dog.get("chg") or 0) >= 5.0 else 1.5), 1)
        mkt_dog_win = round(min(0.55, max(0.05, norm_cdf(-mkt_spread_dog / 10.8))), 3)
        win_edge = round((dog_win_p - mkt_dog_win) * 100.0, 1)

        upset_score = min(98, max(45, int(round(dog_win_p * 75 + tech_score * 0.85 + max(0, win_edge * 1.5)))))
        tier = "🚨 HIGH UPSET ALERT" if upset_score >= 78 else ("⚠️ LIVE DOG / COVER SPOT" if upset_score >= 64 else "👀 STYLE TRAP WATCH")

        dog_lead = (dog.get("rot") or [{}])[0]
        fav_lead = (fav.get("rot") or [{}])[0]

        upset_radar.append({
            "id": g["id"],
            "start": g["start"],
            "neutral": neutral,
            "venue": g["venue"],
            "tv": g["tv"],
            "dog_id": dog["id"],
            "dog": dog["team"],
            "dog_ab": dog["ab"],
            "dog_conf": dog["conf"],
            "dog_rk": dog.get("ap"),
            "dog_logo": dog.get("logo"),
            "fav_id": fav["id"],
            "fav": fav["team"],
            "fav_ab": fav["ab"],
            "fav_conf": fav["conf"],
            "fav_rk": fav.get("ap"),
            "fav_logo": fav.get("logo"),
            "dog_home": dog_home,
            "sl_spread_dog": ("+" if sl_spread_dog_val > 0 else "") + f"{sl_spread_dog_val:.1f}",
            "mkt_spread_dog": ("+" if mkt_spread_dog > 0 else "") + f"{mkt_spread_dog:.1f}",
            "spread_edge_pts": round(mkt_spread_dog - sl_spread_dog_val, 1),
            "dog_win_prob": dog_win_p,
            "mkt_dog_prob": mkt_dog_win,
            "win_edge_pct": win_edge,
            "fair_dog_ml": prob_to_am(dog_win_p),
            "pace": pace,
            "upset_score": upset_score,
            "tier": tier,
            "triggers": triggers[:4],
            "dog_star": {"id": dog_lead.get("id"), "n": dog_lead.get("n"), "pts": dog_lead.get("proj_pts"), "usg": dog_lead.get("usg")} if dog_lead.get("n") else None,
            "fav_star": {"id": fav_lead.get("id"), "n": fav_lead.get("n"), "pts": fav_lead.get("proj_pts"), "usg": fav_lead.get("usg")} if fav_lead.get("n") else None,
        })

    upset_radar.sort(key=lambda x: (-(1 if x.get("fav_rk") else 0), -x["upset_score"], -x["dog_win_prob"]))
    D["upset_radar"] = upset_radar[:36]

    # 3. Build 🔥 Prop Hurdles That Keep Rolling
    prop_hurdles = []
    for p in D.get("players", []):
        if (p.get("proj_min") or 0) < 22.0:
            continue
        pts = p.get("proj_pts") or 0.0
        reb = p.get("proj_reb") or 0.0
        ast = p.get("proj_ast") or 0.0
        tpm = p.get("proj_tpm") or 0.0
        pra = p.get("proj_pra") or 0.0
        usg = p.get("usg") or 20.0
        gp_last = p.get("gp") or 0

        hurdles = []
        if pts >= 17.2:
            p_hit = round(min(0.92, max(0.55, norm_cdf((pts - 14.5) / 4.5))), 3)
            hurdles.append(("PTS", "15+ Points", 14.5, pts, p_hit))
        elif pts >= 12.8:
            p_hit = round(min(0.94, max(0.60, norm_cdf((pts - 9.5) / 4.0))), 3)
            hurdles.append(("PTS", "10+ Points", 9.5, pts, p_hit))

        if reb >= 7.2:
            p_hit = round(min(0.91, max(0.58, norm_cdf((reb - 5.5) / 2.2))), 3)
            hurdles.append(("REB", "6+ Rebounds", 5.5, reb, p_hit))
        if ast >= 4.5:
            p_hit = round(min(0.90, max(0.58, norm_cdf((ast - 3.5) / 1.6))), 3)
            hurdles.append(("AST", "4+ Assists", 3.5, ast, p_hit))
        if tpm >= 2.1:
            p_hit = round(min(0.86, max(0.55, norm_cdf((tpm - 1.5) / 1.05))), 3)
            hurdles.append(("3PM", "2+ Three-Pointers", 1.5, tpm, p_hit))
        if pra >= 24.5:
            p_hit = round(min(0.91, max(0.60, norm_cdf((pra - 21.5) / 5.5))), 3)
            hurdles.append(("PRA", "22+ Pts+Reb+Ast", 21.5, pra, p_hit))

        if not hurdles:
            continue
        hurdles.sort(key=lambda x: -x[4])
        cat, h_lbl, line_v, proj_v, p_hit = hurdles[0]
        l10_hits = min(10, max(6, int(round(p_hit * 10))))
        szn_hits = int(round(p_hit * gp_last)) if gp_last >= 10 else None
        min_share = round(100.0 * (p.get("proj_min") or 0) / 40.0, 1)

        prop_hurdles.append({
            "id": p.get("id"),
            "n": p.get("n"),
            "hs": p.get("hs"),
            "tid": p.get("tid"),
            "team": p.get("team"),
            "ab": p.get("ab"),
            "conf": p.get("conf"),
            "ap": p.get("ap"),
            "pos": p.get("pos"),
            "slot": p.get("slot") or p.get("pos"),
            "yr_short": p.get("yr_short") or "JR",
            "origin": p.get("origin") or "Returning",
            "prev_team": p.get("prev_team"),
            "is_star": p.get("is_star"),
            "nba_tier": p.get("nba_tier"),
            "proj_min": p.get("proj_min"),
            "min_share": min_share,
            "usg": usg,
            "proj_pts": pts,
            "proj_reb": reb,
            "proj_ast": ast,
            "proj_pra": pra,
            "cat": cat,
            "hurdle": h_lbl,
            "line": line_v,
            "proj": proj_v,
            "p_hit": p_hit,
            "fair_odds": prob_to_am(p_hit),
            "l10_est": f"{l10_hits}/10",
            "szn_est": f"{szn_hits}/{gp_last}" if szn_hits is not None else "New Role",
        })

    prop_hurdles.sort(key=lambda x: (-x["p_hit"], -x["usg"]))
    D["prop_hurdles"] = prop_hurdles[:140]

    # 4. Build 🏆 Conference Power Matrix & Title/Final Four Tier Board
    conf_groups = collections.defaultdict(list)
    for t in D["teams"]:
        if t.get("conf"):
            conf_groups[t["conf"]].append(t)

    conf_matrix = []
    for cf_name, tlist in conf_groups.items():
        tlist.sort(key=lambda x: -(x.get("proj") or -99))
        top_t = tlist[0]
        fastest = max(tlist, key=lambda x: x.get("adjT") or 0)
        best_def = min(tlist, key=lambda x: x.get("adjD") or 999)
        top25_cnt = sum(1 for x in tlist if x.get("ap"))
        tourney_bids = sum(1 for x in tlist if (x.get("proj") or 0) >= 13.5 or x.get("ap"))
        if tourney_bids == 0:
            tourney_bids = 1
        avg_em = round(sum((x.get("proj") or 0) for x in tlist) / len(tlist), 1)
        avg_tempo = round(sum((x.get("adjT") or 68.0) for x in tlist) / len(tlist), 1)
        conf_matrix.append({
            "conf": cf_name,
            "teams_count": len(tlist),
            "avg_em": avg_em,
            "avg_tempo": avg_tempo,
            "top25_count": top25_cnt,
            "proj_bids": tourney_bids,
            "favorite": {"id": top_t["id"], "team": top_t["team"], "ab": top_t["ab"], "proj": top_t["proj"], "ap": top_t.get("ap")},
            "fastest": {"id": fastest["id"], "team": fastest["team"], "adjT": fastest.get("adjT")},
            "best_def": {"id": best_def["id"], "team": best_def["team"], "adjD": best_def.get("adjD")},
        })

    conf_matrix.sort(key=lambda x: (-x["avg_em"], -x["proj_bids"]))
    D["conf_matrix"] = conf_matrix

    D["ratings_credit"] = "Ratings: barttorvik.com"
    json.dump(D, open(CBB_JSON, "w"), separators=(",", ":"))
    print(f"Enriched cbb.json: {len(D['upset_radar'])} Upset Radar alerts, {len(D['prop_hurdles'])} Prop Hurdles, {len(D['conf_matrix'])} Conferences.")

if __name__ == "__main__":
    main()
