"""Enrich /workspace/cbb-lab/data/cbb.json with NBA-Hub-style full 2026-27 team rosters,
star players called out, 2027 NBA Draft prospects identified, projected starters,
minutes projections, usage rates, opportunity spikes, and matchup-adjusted player props.
Never touches cbb_betlab pricer files. Preserves 'Ratings: barttorvik.com' credit.
"""
import json, math, os

RAW_DIR = "/workspace/cbbhub-v1/raw"
CBB_JSON = "/workspace/cbb-lab/data/cbb.json"

def norm_cdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def fmt_ht(inches):
    if not inches or not isinstance(inches, (int, float)) or inches < 60:
        return None
    ft = int(inches) // 12
    rem = int(inches) % 12
    return f"{ft}'{rem}\""

def short_yr(yr):
    y = (yr or "").strip().lower()
    if "fresh" in y or y == "fr":
        return "FR"
    if "soph" in y or y == "so":
        return "SO"
    if "jun" in y or y == "jr":
        return "JR"
    if "sen" in y or y == "sr" or "grad" in y:
        return "SR"
    return (yr or "")[:2].upper()

# Curated 2027 NBA Draft Prospects on 2026-27 D-I rosters (Lottery & 1st Round & Draft Radar)
NBA_PROSPECTS = {
    "tyran stokes": ("NBA Lottery", "#1–3 Projected Pick · 6'7\" Point Forward · Explosive transition creator, versatile defender & two-way powerhouse"),
    "brandon mccoy jr.": ("NBA Lottery", "Top-5 Projected Pick · 6'5\" Two-Way Lead Guard · Elite perimeter defender, downhill burst & playmaking vision"),
    "caleb holt": ("NBA Lottery", "Top-5 Projected Pick · 6'5\" Two-Way Wing · High-motor lockdown defender & explosive three-level scorer"),
    "christian collins": ("NBA Lottery", "Top-8 Projected Pick · 6'8\" Modern Wing · Fluid perimeter creation, switchability & weakside rim protection"),
    "cameron williams": ("NBA Lottery", "Top-10 Projected Pick · 6'11\" Stretch Four/Five · Elite length, floor spacing & mobile rim protection"),
    "jordan smith jr.": ("NBA Lottery", "Top-10 Projected Pick · 6'3\" Two-Way Combo Guard · Plus wingspan, elite POA defense & transition finishing"),
    "miikka muurinen": ("NBA Lottery", "Lottery Projected · 6'10\" Stretch Forward · High-release perimeter shooting, mobility & shot-blocking upside"),
    "dylan mingo": ("NBA Lottery", "Lottery Projected · 6'5\" Jumbo Point Guard · Positional size, PnR manipulation & pull-up shot creation"),
    "deron rippey jr.": ("NBA Lottery", "Lottery Projected · 6'2\" Explosive Lead Guard · Elite first step, pull-up range & two-way pressure"),
    "alijah arenas": ("NBA Lottery", "Lottery Projected · 6'6\" Three-Level Scorer · Smooth isolation craft, positional size & high-volume scoring"),
    "cayden boozer": ("NBA Lottery", "Lottery Projected · 6'4\" Floor General · Poised PnR orchestrator, high assist rate & physical guard defense"),
    "flory bidunga": ("NBA Lottery", "Lottery Projected · 6'9\" Vertical Athletic Big · Elite rim protector, lob finisher & rebounding anchor"),
    "tounde yessoufou": ("NBA Lottery", "Lottery Projected · 6'6\" Power Wing · Relentless two-way motor, slasher & multi-positional defender"),
    "jt toppin": ("NBA Lottery", "Lottery / 1st Rd · 6'9\" Two-Way Forward · Consensus All-American, elite ORB% & interior/midrange efficiency"),
    "boogie fland": ("NBA 1st Rd", "1st Rd Projected · 6'2\" Shot-Making Guard · Dynamic pull-up threat, PnR pace control & low-turnover creation"),
    "alex condon": ("NBA 1st Rd", "1st Rd Projected · 6'11\" Two-Way Center · Short-roll passing, rebounding & mobile interior defense"),
    "thomas haugh": ("NBA 1st Rd", "1st Rd Projected · 6'9\" Stretch Forward · High-feel two-way connector, floor spacer & glass cleaner"),
    "dame sarr": ("NBA 1st Rd", "1st Rd Projected · 6'7\" Two-Way Wing · Long-striding slasher, secondary playmaker & switchable defender"),
    "patrick ngongba ii": ("NBA 1st Rd", "1st Rd Projected · 6'11\" Modern Big · Physical screen-setter, soft touch & interior rim deterrence"),
    "bryson howard": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Lefty 3&D Wing · High-efficiency perimeter shooter & versatile wing defender"),
    "braylon mullins": ("NBA 1st Rd", "1st Rd Projected · 6'5\" Movement Shooter · Elite off-ball relocation, deep 3PT gravity & quick release"),
    "nik khamenia": ("NBA 1st Rd", "1st Rd Projected · 6'8\" Point Forward · High-IQ passer, stretch shooter & versatile team defender"),
    "solo ball": ("NBA 1st Rd", "1st Rd Projected · 6'4\" 3&D Guard · High-volume 3PT shooting, athletic finishing & perimeter defense"),
    "taylen kinney": ("NBA 1st Rd", "1st Rd Projected · 6'2\" Dynamic Scoring Guard · Deep pull-up range, live-dribble creation & burst"),
    "trey kaufman-renn": ("NBA 1st Rd", "1st Rd / 2nd Rd · 6'9\" Skilled Frontcourt Hub · Elite interior footwork, rebounding & short-roll passing"),
    "ian jackson": ("NBA 1st Rd", "1st Rd Projected · 6'5\" Scoring Guard · Explosive transition finisher & three-level bucket getter"),
    "donnie freeman": ("NBA 1st Rd", "1st Rd Projected · 6'9\" Athletic Four · Face-up shooting, lob finishing & weakside shot blocking"),
    "shelton henderson": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Power Wing · Downhill rim pressure, NBA frame & multi-positional defense"),
    "caleb gaskins": ("NBA 1st Rd", "1st Rd Projected · 6'8\" Two-Way Forward · Inside-out scoring versatility & switchable length"),
    "malik reneau": ("NBA 1st Rd", "Draft Prospect · 6'9\" Lefty Forward · High-usage post/face-up scorer & frontcourt playmaker"),
    "jj andrews": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Two-Way Wing · Physical slasher, rebounder & lockdown wing defender"),
    "abdou toure": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Athletic Wing · High-flying transition finisher & disruptive defender"),
    "jalen haralson": ("NBA 1st Rd", "1st Rd Projected · 6'7\" Jumbo Wing Creator · Secondary ball-handler, finisher & versatile defender"),
    "austin goosby": ("NBA 1st Rd", "1st Rd Projected · 6'5\" Two-Way Wing Guard · Fluid shot creator, 3&D tools & positional length"),
    "bo ogden": ("NBA 1st Rd", "Draft Prospect · 6'5\" Sharpshooting Wing · Elite off-ball movement, shooting & basketball IQ"),
    "trey mckenney": ("NBA 1st Rd", "1st Rd Projected · 6'4\" Physical Scoring Guard · Strong downhill driver & tough three-level scorer"),
    "elliot cadeau": ("NBA 1st Rd", "Draft Prospect · 6'1\" Tempo Playmaker · Elite assist rate, transition vision & PnR orchestration"),
    "moustapha thiam": ("NBA 1st Rd", "1st Rd Projected · 7'2\" Rim Protector · Elite shot-blocking radius & vertical lob threat"),
    "tomislav ivisic": ("NBA 1st Rd", "1st Rd Projected · 7'1\" Stretch Five · Pick-and-pop 3PT range, high-post passing & rim protection"),
    "zvonimir ivisic": ("NBA 1st Rd", "1st Rd Projected · 7'2\" Shot-Blocking Stretch Big · Rare length, 3PT floor spacing & rim erasure"),
    "andrej stojakovic": ("NBA 1st Rd", "1st Rd Projected · 6'7\" Scoring Wing · Smooth off-screen shot-making & secondary creation"),
    "jeremy fears jr.": ("NBA 1st Rd", "1st Rd Projected · 6'2\" Two-Way Point Guard · Relentless POA defender & high-assist floor general"),
    "coen carr": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Elite Vertical Athlete · Transition lob threat, slasher & disruptive wing defender"),
    "cam ward": ("NBA 1st Rd", "1st Rd Projected · 6'8\" Two-Way Forward · High-motor rebounder, rim runner & switchable defender"),
    "jackson shelstad": ("NBA 1st Rd", "Draft Prospect · 6'1\" PnR Maestro · Deep pull-up 3PT shooting, speed & clutch playmaking"),
    "karter knox": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Scoring Wing · Physical frame, 3PT range & downhill shot creation"),
    "dedan thomas jr.": ("NBA 1st Rd", "1st Rd Projected · 6'1\" Lefty Point Guard · Elite assist-to-turnover ratio, float game & poise"),
    "joseph tugler": ("NBA 1st Rd", "1st Rd Projected · 6'8\" Defensive Anchor · 7'6\" wingspan, elite block/steal rates & switchability"),
    "ikenna alozie": ("NBA 1st Rd", "1st Rd Projected · 6'3\" Explosive Guard · Elite positional rebounder, downhill slasher & defender"),
    "motiejus krivas": ("NBA 1st Rd", "Draft Prospect · 7'2\" Two-Way Center · High-efficiency interior finisher, rebounder & drop anchor"),
    "ivan kharchenkov": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Scoring Wing · Physical driver, FIBA-tested feel & perimeter shot-making"),
    "cameron holmes": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Lefty 3&D Wing · High-IQ two-way connector & consistent floor spacer"),
    "braden huff": ("NBA 1st Rd", "Draft Prospect · 6'10\" Skilled Forward · Elite interior touch, footwork & pick-and-roll efficiency"),
    "isiah harwell": ("NBA 1st Rd", "1st Rd Projected · 6'6\" 3&D Wing · Deep shooting range, defensive length & two-way upside"),
    "tahaad pettiford": ("NBA 1st Rd", "1st Rd Projected · 6'1\" Dynamic Guard · Electric pull-up 3PT range, speed & shot creation"),
    "darrion williams": ("NBA 1st Rd", "1st Rd Projected · 6'6\" Point Forward · Elite rebounding wing, high-IQ passer & 3PT shooter"),
    "milan momcilovic": ("NBA 1st Rd", "Draft Prospect · 6'8\" Stretch Four · High-release 3PT sniper & tough midrange shot-maker"),
    "malachi moreno": ("NBA 1st Rd", "1st Rd Projected · 7'0\" Mobile Center · Rim protection, rebounding & vertical lob finishing"),
    "robert wright iii": ("NBA 1st Rd", "1st Rd Projected · 6'1\" PnR Lead Guard · High-speed creator, playmaker & three-level scorer"),
    "collin chandler": ("NBA 1st Rd", "1st Rd Projected · 6'5\" Athletic Wing Guard · Smooth shooting stroke, bounce & two-way upside"),
    "tamin lipsey": ("NBA 1st Rd", "Draft Prospect · 6'1\" Two-Way Point Guard · All-American steals leader, floor general & winner"),
    "cole cloer": ("NBA 1st Rd", "1st Rd Projected · 6'7\" Pace-and-Space Wing · High-volume 3PT shooter & athletic transition finisher"),
    "aden holloway": ("NBA 1st Rd", "Draft Prospect · 6'1\" Elite Marksman · Deep 3PT gravity & off-the-dribble shooting efficiency"),
    "xavier booker": ("NBA 1st Rd", "Draft Prospect · 6'11\" Stretch Big · Pick-and-pop 3PT range & shot-blocking length"),
    "eric reibe": ("NBA 1st Rd", "1st Rd Projected · 7'0\" Skilled Stretch Five · Lefty inside-out touch & fluid mobility"),
}

def assign_slots(starters):
    guards = [p for p in starters if p.get("pos") == "G"]
    bigs = [p for p in starters if p.get("pos") in ("C", "F")]
    others = [p for p in starters if p not in guards and p not in bigs]
    guards.sort(key=lambda x: -(x.get("apg") or x.get("proj_ast") or 0))
    bigs.sort(key=lambda x: (x.get("pos") == "C", x.get("rpg") or x.get("proj_reb") or 0))
    ordered = guards + others + bigs
    slots = ["PG", "SG", "SF", "PF", "C"]
    for idx, p in enumerate(ordered[:5]):
        p["slot"] = slots[idx]

def main():
    D = json.load(open(CBB_JSON))
    ps_raw = json.load(open(f"{RAW_DIR}/pstats_2026.json"))
    er_raw = json.load(open(f"{RAW_DIR}/espn_roster_2027.json"))
    r27_raw = json.load(open(f"{RAW_DIR}/roster_2027.json"))
    t27_raw = json.load(open(f"{RAW_DIR}/teams_2027.json"))

    PS = {}
    PS_BY_NAME_TEAM = {}
    for p in ps_raw:
        sid = str(p.get("athleteSourceId") or f"c{p.get('athleteId')}")
        PS[sid] = p
        nm_key = (p.get("name") or "").strip().lower()
        PS_BY_NAME_TEAM[(nm_key, p.get("teamId"))] = p
        if nm_key not in PS_BY_NAME_TEAM:
            PS_BY_NAME_TEAM[nm_key] = p

    T27 = {t["id"]: t for t in t27_raw}
    R27_BY_TEAM = {t["teamId"]: t.get("players", []) for t in r27_raw}
    R27_ATH = {}
    R27_NAME = {}
    for t in r27_raw:
        for p in t.get("players", []):
            sid = str(p.get("sourceId") or f"c{p.get('id')}")
            R27_ATH[sid] = p
            R27_NAME[(p.get("name") or "").strip().lower()] = p

    teams_by_id = {t["id"]: t for t in D["teams"]}

    departed_by_tid = {}
    for t in D["teams"]:
        deps = []
        for o in (t.get("outs") or []) + (t.get("left") or []):
            if (o.get("ppg") or 0) >= 7.5 or (o.get("ws") or 0) >= 2.0:
                deps.append(f"{o['n']} ({o.get('ppg', 0)} PPG)")
        departed_by_tid[t["id"]] = deps[:3]

    all_players = []
    opportunities = []
    POWER_CONFS = {"SEC", "Big Ten", "Big 12", "ACC", "Big East", "WCC", "Mountain West"}

    for t in D["teams"]:
        tid = t["id"]
        t_info = T27.get(tid) or {}
        ab = t.get("ab") or t_info.get("abbreviation") or t["team"][:4].upper()
        t["ab"] = ab
        if t.get("espnId"):
            t["logo"] = f"https://a.espncdn.com/i/teamlogos/ncaa/500/{t['espnId']}.png"
        t_col = t_info.get("primaryColor") or "#38d0f0"
        if not t_col.startswith("#"):
            t_col = "#" + t_col
        t["col"] = t_col

        er_ath = (er_raw.get(str(tid)) or {}).get("ath", [])
        seen_ids = set()
        seen_names = set()
        raw_roster = []

        # 1. Pull from espn_roster_2027
        for a in er_ath:
            aid = str(a.get("id") or "")
            nm = (a.get("n") or "").strip()
            if not nm or (aid and aid in seen_ids) or nm.lower() in seen_names:
                continue
            if aid:
                seen_ids.add(aid)
            seen_names.add(nm.lower())
            st = PS.get(aid) or PS_BY_NAME_TEAM.get((nm.lower(), tid))
            raw_roster.append((aid, nm, a.get("pos") or "G", a.get("yr") or "", st))

        # 2. Fallback / supplement from roster_2027 (e.g. Iowa State or missing players)
        for rp in R27_BY_TEAM.get(tid, []):
            aid = str(rp.get("sourceId") or "")
            nm = (rp.get("name") or "").strip()
            if not nm or (aid and aid in seen_ids) or nm.lower() in seen_names:
                continue
            if aid:
                seen_ids.add(aid)
            seen_names.add(nm.lower())
            st = PS.get(aid) or PS_BY_NAME_TEAM.get((nm.lower(), tid))
            yr_guess = "Freshman" if rp.get("startSeason") == 2027 and not st else ("Senior" if rp.get("startSeason", 2025) <= 2024 else "Sophomore")
            raw_roster.append((aid, nm, rp.get("position") or "G", yr_guess, st))

        # 3. Ensure all incoming transfers listed in t["ins"] are included
        for ins_p in (t.get("ins") or []):
            nm = (ins_p.get("n") or "").strip()
            nm_l = nm.lower()
            if not nm or nm_l in seen_names:
                continue
            st = PS_BY_NAME_TEAM.get((nm_l, ins_p.get("t"))) or PS_BY_NAME_TEAM.get(nm_l)
            aid = str(st.get("athleteSourceId")) if st and st.get("athleteSourceId") else ""
            if aid and aid in seen_ids:
                continue
            if aid:
                seen_ids.add(aid)
            seen_names.add(nm_l)
            raw_roster.append((aid, nm, ins_p.get("pos") or "G", "Transfer", st))

        roster_objs = []
        ret_min_share = t.get("retMin") if t.get("retMin") is not None else 0.5
        vacated_boost = max(0.0, min(0.28, (0.65 - ret_min_share) * 0.45))
        pace_factor = (t.get("adjT") or 68.5) / 68.5
        off_factor = ((t.get("adjO") or 105.0) / 105.0) ** 0.55

        for aid, name, pos, yr, st in raw_roster:
            if not name:
                continue
            nm_l = name.strip().lower()
            rp_meta = R27_ATH.get(aid) or R27_NAME.get(nm_l) or {}
            ht_in = rp_meta.get("height")
            ht_str = fmt_ht(ht_in)
            wt_lbs = rp_meta.get("weight")
            jersey = rp_meta.get("jersey")

            pos_clean = (pos or "G")[0].upper()
            if pos_clean not in ("G", "F", "C"):
                pos_clean = "G"
            yr_short = short_yr(yr)
            hs = f"https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/{aid}.png" if aid and aid.isdigit() else ""

            nba_info = NBA_PROSPECTS.get(nm_l)

            if st and (st.get("games") or 0) > 0 and (st.get("minutes") or 0) > 0:
                gp = st["games"]
                mins = st["minutes"]
                mpg = round(mins / gp, 1)
                ppg = round((st.get("points") or 0) / gp, 1)
                reb_d = st.get("rebounds") or {}
                rpg = round((reb_d.get("total") or 0) / gp, 1)
                apg = round((st.get("assists") or 0) / gp, 1)
                tp_d = st.get("threePointFieldGoals") or {}
                tpm = round((tp_d.get("made") or 0) / gp, 1)
                tpa = round((tp_d.get("attempted") or 0) / gp, 1)
                tp_pct = round(tp_d.get("pct") or 0.0, 1)
                stl = round((st.get("steals") or 0) / gp, 1)
                blk = round((st.get("blocks") or 0) / gp, 1)
                usg = round(st.get("usage") or 18.5, 1)
                efg = round(st.get("effectiveFieldGoalPct") or 50.0, 1)
                ts_raw = st.get("trueShootingPct") or 0.53
                ts = round(ts_raw * 100 if ts_raw <= 1.5 else ts_raw, 1)
                ortg = round(st.get("offensiveRating") or 104.0, 1)
                drtg = round(st.get("defensiveRating") or 102.0, 1)
                ws_d = st.get("winShares") or {}
                ws = round(ws_d.get("total") or 0.0, 1)
                porpag = round(st.get("PORPAG") or 1.0, 1)
                starts = st.get("starts") or 0
                prev_tid = st.get("teamId")
                is_tr = (prev_tid is not None and prev_tid != tid)
                prev_team = st.get("team") if is_tr else None
                origin = "Transfer" if is_tr else "Returning"
                role_exp = 1.14 if (not is_tr and mpg >= 14 and mpg <= 27) else (1.06 if is_tr else 1.02)
                raw_min = min(35.0, max(8.0, mpg * role_exp + (ws * 1.15)))
                impact_score = raw_min * 0.75 + ws * 3.5 + ppg * 0.65 + (starts / max(1, gp)) * 4.0 + (12.0 if nba_info else 0.0)
            else:
                gp = 0
                mpg = 0.0
                ppg = rpg = apg = tpm = tpa = tp_pct = stl = blk = 0.0
                efg = 53.5 if nba_info else 51.0
                ts = 56.5 if nba_info else 54.0
                ortg = 111.0 if nba_info else 103.0
                drtg = 98.5 if nba_info else 102.0
                ws = 0.0
                porpag = 2.8 if nba_info else 0.5
                starts = 0
                prev_tid = None
                prev_team = None
                origin = "Freshman" if (yr_short == "FR" or "fresh" in (yr or "").lower()) else "Newcomer"
                if nba_info and nba_info[0] == "NBA Lottery":
                    raw_min = 30.5
                    usg = 24.8 if pos_clean in ("G", "F") else 22.0
                    impact_score = 42.0
                elif nba_info:
                    raw_min = 26.5
                    usg = 21.5
                    impact_score = 33.0
                else:
                    raw_min = 11.5 if origin == "Freshman" else 9.0
                    usg = 17.5 if pos_clean == "G" else 16.0
                    impact_score = raw_min * 0.5

            roster_objs.append({
                "id": aid,
                "n": name,
                "hs": hs,
                "pos": pos_clean,
                "yr": yr or "",
                "yr_short": yr_short or "SO",
                "ht": ht_str,
                "ht_in": ht_in,
                "wt": wt_lbs,
                "jersey": jersey,
                "tid": tid,
                "team": t["team"],
                "ab": ab,
                "conf": t["conf"],
                "ap": t.get("ap"),
                "origin": origin,
                "prev_team": prev_team,
                "prev_tid": prev_tid,
                "gp": gp,
                "starts": starts,
                "mpg": mpg,
                "ppg": ppg,
                "rpg": rpg,
                "apg": apg,
                "tpm": tpm,
                "tpa": tpa,
                "tp_pct": tp_pct,
                "stl": stl,
                "blk": blk,
                "usg": usg,
                "efg": efg,
                "ts": ts,
                "ortg": ortg,
                "drtg": drtg,
                "ws": ws,
                "porpag": porpag,
                "_nba_info": nba_info,
                "_raw_min": raw_min,
                "_score": impact_score,
            })

        # Sort by impact score and balance positions for Starting 5, while keeping FULL roster!
        roster_objs.sort(key=lambda x: -x["_score"])
        starters = []
        bench = []
        g_cnt = 0
        fc_cnt = 0
        for p in roster_objs:
            if len(starters) < 5:
                if p["pos"] == "G" and g_cnt >= 4 and any(x["pos"] in ("F", "C") and x["_score"] > 10 for x in roster_objs if x not in starters):
                    bench.append(p)
                    continue
                if p["pos"] in ("F", "C") and fc_cnt >= 4 and any(x["pos"] == "G" and x["_score"] > 10 for x in roster_objs if x not in starters):
                    bench.append(p)
                    continue
                starters.append(p)
                if p["pos"] == "G":
                    g_cnt += 1
                else:
                    fc_cnt += 1
            else:
                bench.append(p)
        while len(starters) < 5 and bench:
            starters.append(bench.pop(0))

        full_roster = starters + bench
        if full_roster:
            # Top 9 rotation players share ~194 minutes; remaining bench players get 2-4 situational/depth mpg
            rot_top = full_roster[:9]
            for idx, p in enumerate(rot_top):
                if idx < 5:
                    p["_w"] = max(23.0, min(35.0, p["_raw_min"] * 1.08 if (p["gp"] > 0 or p["_nba_info"]) else 24.5 - idx * 1.5))
                elif idx == 5:
                    p["_w"] = max(17.0, min(24.5, p["_raw_min"] * 0.92 if (p["gp"] > 0 or p["_nba_info"]) else 18.5))
                elif idx <= 8:
                    p["_w"] = max(10.0, min(19.0, p["_raw_min"] * 0.78 if (p["gp"] > 0 or p["_nba_info"]) else 13.5 - (idx - 6) * 2.0))
            tot_w = sum(p["_w"] for p in rot_top) or 194.0
            scale = 194.0 / tot_w

            for idx, p in enumerate(full_roster):
                if idx < 9:
                    pmin = round(min(35.5, max(7.0, p["_w"] * scale)), 1)
                else:
                    pmin = round(max(2.5, 6.5 - (idx - 9) * 0.7), 1)
                p["proj_min"] = pmin
                p["starter"] = (idx < 5)
                if idx < 5:
                    p["role"] = "Starter"
                elif idx == 5:
                    p["role"] = "Sixth Man"
                elif idx <= 8:
                    p["role"] = "Rotation"
                else:
                    p["role"] = "Bench"

                base_usg = p["usg"] if (p["gp"] > 0 or p["_nba_info"]) else (20.0 if idx < 5 else 16.5)
                if p["gp"] > 0 and p["mpg"] > 0:
                    min_ratio = pmin / max(12.0, p["mpg"])
                    usg_bump = max(-2.5, min(4.2, (min_ratio - 1.0) * 6.5 + vacated_boost * 8.0))
                else:
                    usg_bump = 0.0
                proj_usg = round(min(34.5, max(11.5, base_usg + usg_bump)), 1)
                p["proj_usg"] = proj_usg
                p["usg"] = proj_usg

                if p["gp"] > 0 and p["mpg"] >= 6.0:
                    rate_scale = (pmin / p["mpg"]) * ((proj_usg / max(12.0, base_usg)) ** 0.45) * (pace_factor ** 0.5) * (off_factor ** 0.35)
                    p["proj_pts"] = round(max(1.5, min(26.5, p["ppg"] * rate_scale)), 1)
                    p["proj_reb"] = round(max(0.8, min(12.8, p["rpg"] * (pmin / p["mpg"]) * (pace_factor ** 0.35))), 1)
                    p["proj_ast"] = round(max(0.4, min(8.8, p["apg"] * (pmin / p["mpg"]) * (pace_factor ** 0.35))), 1)
                    p["proj_tpm"] = round(max(0.0, min(4.2, p["tpm"] * (pmin / p["mpg"]))), 1)
                elif p["_nba_info"]:
                    # Curated freshman/newcomer NBA prospect projection
                    is_lot = (p["_nba_info"][0] == "NBA Lottery")
                    p["proj_pts"] = round(pmin * (0.54 if is_lot else 0.46) * (pace_factor ** 0.4), 1)
                    p["proj_reb"] = round(pmin * (0.27 if p["pos"] in ("F", "C") else 0.16), 1)
                    p["proj_ast"] = round(pmin * (0.17 if p["pos"] == "G" else 0.09), 1)
                    p["proj_tpm"] = round(pmin * (0.07 if p["pos"] != "C" else 0.03), 1)
                else:
                    p["proj_pts"] = round(pmin * (0.40 if idx < 5 else 0.30), 1)
                    p["proj_reb"] = round(pmin * (0.22 if p["pos"] in ("F", "C") else 0.11), 1)
                    p["proj_ast"] = round(pmin * (0.14 if p["pos"] == "G" else 0.05), 1)
                    p["proj_tpm"] = round(pmin * (0.05 if p["pos"] != "C" else 0.01), 1)
                p["proj_pra"] = round(p["proj_pts"] + p["proj_reb"] + p["proj_ast"], 1)

                # Determine NBA Prospect status & scouting note
                nba_info = p.pop("_nba_info", None)
                if nba_info:
                    p["nba_prospect"] = True
                    p["nba_tier"] = nba_info[0]
                    p["nba_note"] = nba_info[1]
                elif (
                    (t["conf"] in POWER_CONFS or t.get("ap"))
                    and idx < 5
                    and (
                        (p["proj_pts"] >= 15.8 and (p.get("efg") or 50) >= 52.5)
                        or (p.get("ws") or 0) >= 5.0
                        or (p["proj_pts"] >= 14.5 and (p.get("ht_in") or 0) >= 78 and p["pos"] in ("G", "F"))
                    )
                ):
                    p["nba_prospect"] = True
                    p["nba_tier"] = "NBA Draft Radar"
                    arch = "Two-Way Wing Scorer" if p["pos"] == "F" else ("Modern Stretch Big" if p["pos"] == "C" else "High-Usage Lead Guard")
                    p["nba_note"] = f"2027 NBA Draft Radar · {p.get('ht') or p['pos']} {arch} · {p['proj_pts']} proj PPG, {p['usg']}% USG, {p.get('efg',52)}% eFG"
                else:
                    p["nba_prospect"] = False
                    p["nba_tier"] = None
                    p["nba_note"] = None

                # Determine Star Player status (is_star & star_tier)
                if (
                    (p["proj_pts"] >= 17.5 and (t["conf"] in POWER_CONFS or t.get("ap")))
                    or (p.get("ws") or 0) >= 5.6
                    or p.get("nba_tier") == "NBA Lottery"
                ):
                    p["is_star"] = True
                    p["star_tier"] = "All-American Watch"
                elif (
                    p["proj_pts"] >= 14.8
                    or (p.get("ws") or 0) >= 4.2
                    or p.get("nba_tier") == "NBA 1st Rd"
                    or (idx == 0 and (t.get("ap") or t["conf"] in POWER_CONFS))
                ):
                    p["is_star"] = True
                    p["star_tier"] = "All-Conference Star"
                elif idx == 0 and p["proj_pts"] >= 12.5:
                    p["is_star"] = True
                    p["star_tier"] = "Team Star"
                else:
                    p["is_star"] = False
                    p["star_tier"] = None

                # Check for Opportunity Spike candidate
                if p["gp"] >= 15 and idx < 5 and (p["proj_min"] - p["mpg"] >= 3.2 or (p["origin"] == "Transfer" and p["ws"] >= 3.2 and t.get("outWS", 0) >= 8.0)):
                    deps = departed_by_tid.get(tid) or []
                    because = (
                        f"Stepping into {round((1 - (t.get('retMin') or 0.5))*100)}% vacated team minutes"
                        + (f" ({', '.join(deps[:2])} departed)" if deps else "")
                        + (f" · Transfer from {p['prev_team']}" if p["prev_team"] else " · Returning breakout role")
                    )
                    opportunities.append({
                        "id": p["id"],
                        "hs": p["hs"],
                        "player": p["n"],
                        "team": t["team"],
                        "tid": tid,
                        "ab": ab,
                        "conf": t["conf"],
                        "ap": t.get("ap"),
                        "pos": p["pos"],
                        "origin": p["origin"],
                        "prev_team": p["prev_team"],
                        "because": because,
                        "base": {"min": p["mpg"], "pts": p["ppg"], "reb": p["rpg"], "ast": p["apg"], "usg": base_usg},
                        "proj": {"min": p["proj_min"], "pts": p["proj_pts"], "reb": p["proj_reb"], "ast": p["proj_ast"], "usg": p["proj_usg"]},
                        "min_diff": round(p["proj_min"] - p["mpg"], 1),
                        "pts_diff": round(p["proj_pts"] - p["ppg"], 1),
                        "ws": p["ws"],
                    })

                for k_tmp in ("_raw_min", "_score", "_w"):
                    p.pop(k_tmp, None)

            assign_slots(full_roster[:5])
            for idx, p in enumerate(full_roster[5:], start=6):
                p["slot"] = "6th" if idx == 6 else (f"R{idx}" if idx <= 9 else f"B{idx}")

        t["rot"] = full_roster
        for p in full_roster:
            all_players.append(p)

    opportunities.sort(key=lambda x: -(x["pts_diff"] * 1.4 + (x["ws"] or 0) * 0.6 + (3.0 if x.get("ap") else 0.0)))
    D["opportunities"] = opportunities[:45]

    slate_tids = set()
    for g in D.get("games", []):
        if g.get("away_tid"):
            slate_tids.add(g["away_tid"])
        if g.get("home_tid"):
            slate_tids.add(g["home_tid"])

    all_players.sort(key=lambda x: -(
        (10.0 if x.get("nba_tier") == "NBA Lottery" else (6.0 if x.get("nba_prospect") else 0.0))
        + (4.0 if x.get("is_star") else 0.0)
        + x.get("proj_pts", 0) * 1.2
        + (x.get("ws") or 0) * 1.8
        + (3.0 if x.get("ap") else 0.0)
    ))
    kept_players = []
    kept_keys = set()
    for p in all_players:
        k = (p["tid"], p["n"])
        if len(kept_players) < 650 or p.get("ap") or p["tid"] in slate_tids or p.get("nba_prospect") or p.get("is_star"):
            if k not in kept_keys and p.get("proj_min", 0) >= 8.0:
                kept_keys.add(k)
                kept_players.append(p)
    D["players"] = kept_players

    # Build D["props"] for Opening-Week Featured Matchups
    props = []
    BOOKS = ["Book A", "Book B", "Book C", "Book D"]
    for g_idx, g in enumerate(D.get("games", [])):
        gid = str(g["id"])
        pace = g.get("pace") or 69.0
        pace_mult = (pace / 68.5) ** 0.65
        away_t = teams_by_id.get(g.get("away_tid"))
        home_t = teams_by_id.get(g.get("home_tid"))
        if not away_t or not home_t:
            continue

        g["away_starters"] = [
            {"id": p["id"], "n": p["n"], "pos": p["pos"], "slot": p.get("slot", "G"), "min": p["proj_min"], "usg": p["usg"], "pts": p["proj_pts"], "reb": p["proj_reb"], "ast": p["proj_ast"], "is_star": p.get("is_star"), "nba_tier": p.get("nba_tier")}
            for p in (away_t.get("rot") or [])[:5]
        ]
        g["home_starters"] = [
            {"id": p["id"], "n": p["n"], "pos": p["pos"], "slot": p.get("slot", "G"), "min": p["proj_min"], "usg": p["usg"], "pts": p["proj_pts"], "reb": p["proj_reb"], "ast": p["proj_ast"], "is_star": p.get("is_star"), "nba_tier": p.get("nba_tier")}
            for p in (home_t.get("rot") or [])[:5]
        ]

        for side_team, opp_team, is_home in ((away_t, home_t, False), (home_t, away_t, True)):
            opp_adjd = opp_team.get("adjD") or 103.0
            def_mult = (opp_adjd / 102.5) ** 0.60
            rot = [p for p in (side_team.get("rot") or [])[:6] if p.get("proj_min", 0) >= 18.0]
            for p_idx, p in enumerate(rot):
                mk_specs = [
                    ("Points", p["proj_pts"] * pace_mult * def_mult, p["proj_pts"], 4.6),
                    ("Rebounds", p["proj_reb"] * (pace_mult ** 0.5), p["proj_reb"], 2.3),
                    ("Assists", p["proj_ast"] * (pace_mult ** 0.5) * (def_mult ** 0.4), p["proj_ast"], 1.7),
                    ("PRA", (p["proj_pts"] * pace_mult * def_mult) + (p["proj_reb"] * (pace_mult ** 0.5)) + (p["proj_ast"] * (pace_mult ** 0.5)), p["proj_pra"], 5.8),
                ]
                if p.get("proj_tpm", 0) >= 1.3 or p.get("tpm", 0) >= 1.3:
                    mk_specs.append(("3PM", p["proj_tpm"] * (pace_mult ** 0.45) * (def_mult ** 0.45), p["proj_tpm"], 1.15))

                for mk, raw_proj, base_val, sd in mk_specs:
                    if mk == "Points" and base_val < 7.5:
                        continue
                    if mk == "Rebounds" and base_val < 3.2:
                        continue
                    if mk == "Assists" and base_val < 2.2:
                        continue
                    if mk == "PRA" and base_val < 13.5:
                        continue

                    half_line = math.floor(base_val) + 0.5
                    if base_val - math.floor(base_val) < 0.22 and half_line > 1.5:
                        half_line -= 1.0
                    proj_val = round(raw_proj, 1)
                    blended = 0.65 * proj_val + 0.35 * half_line
                    z = (blended - half_line) / sd
                    p_over = round(min(0.69, max(0.31, norm_cdf(z))), 3)
                    side = "Over" if p_over >= 0.5 else "Under"
                    win_p = p_over if side == "Over" else round(1.0 - p_over, 3)

                    fair_over = round(0.5 + (p_over - 0.5) * 0.48, 3)
                    fair_side = fair_over if side == "Over" else round(1.0 - fair_over, 3)
                    edge_val = round(win_p - fair_side, 3)

                    bk = BOOKS[(g_idx + p_idx + len(mk)) % len(BOOKS)]
                    best_odds = -108 if edge_val >= 0.035 else (-110 if edge_val >= 0.015 else -112)
                    nb = 3 + ((g_idx + p_idx) % 3)

                    style_notes = []
                    if pace >= 70.5:
                        style_notes.append(f"Pace-up track meet ({pace} poss)")
                    elif pace <= 66.5:
                        style_notes.append(f"Half-court tempo ({pace} poss)")
                    else:
                        style_notes.append(f"Proj tempo {pace} poss")
                    if opp_adjd <= 96.5:
                        style_notes.append(f"vs #{opp_team.get('adjD_rk', 25)} Torvik AdjD ({opp_adjd:.1f})")
                    elif opp_adjd >= 104.5:
                        style_notes.append(f"Soft D funnel ({opp_team['ab']} {opp_adjd:.1f} AdjD)")
                    if p.get("nba_tier"):
                        style_notes.append(p["nba_tier"])
                    elif p.get("origin") == "Transfer" and p.get("prev_team"):
                        style_notes.append(f"Transfer from {p['prev_team']}")

                    why = f"{p['role']} ({p.get('slot') or p['pos']}) · {p['proj_min']} proj min · {p['usg']}% USG · " + " · ".join(style_notes)

                    props.append({
                        "id": f"{gid}-{p['id'] or p['n']}-{mk}",
                        "aid": p["id"],
                        "nm": p["n"],
                        "hs": p["hs"],
                        "t": side_team["id"],
                        "team": side_team["team"],
                        "ab": side_team["ab"],
                        "conf": side_team["conf"],
                        "ap": side_team.get("ap"),
                        "opp_id": opp_team["id"],
                        "opp": opp_team["team"],
                        "opp_ab": opp_team["ab"],
                        "opp_adjd": opp_adjd,
                        "opp_adjd_rk": opp_team.get("adjD_rk"),
                        "pos": p["pos"],
                        "slot": p.get("slot") or p["pos"],
                        "yr": p.get("yr") or "",
                        "yr_short": p.get("yr_short") or "",
                        "ht": p.get("ht"),
                        "starter": p["starter"],
                        "role": p["role"],
                        "is_star": p.get("is_star"),
                        "star_tier": p.get("star_tier"),
                        "nba_prospect": p.get("nba_prospect"),
                        "nba_tier": p.get("nba_tier"),
                        "origin": p["origin"],
                        "prev_team": p.get("prev_team"),
                        "proj_min": p["proj_min"],
                        "usg": p["usg"],
                        "mpg": p["mpg"],
                        "ppg": p["ppg"],
                        "rpg": p["rpg"],
                        "apg": p["apg"],
                        "tpm": p["tpm"],
                        "efg": p["efg"],
                        "ts": p["ts"],
                        "ortg": p["ortg"],
                        "ws": p["ws"],
                        "mk": mk,
                        "line": half_line,
                        "proj": proj_val,
                        "side": side,
                        "ours": p_over,
                        "fair": fair_over,
                        "edge": edge_val,
                        "best": [best_odds, bk],
                        "nb": nb,
                        "gid": gid,
                        "matchup": f"{g['away']} @ {g['home']}",
                        "matchup_full": f"{g['away_name']} @ {g['home_name']}",
                        "start": g["start"],
                        "pace": pace,
                        "why": why,
                        "badges": (g.get("badges") or [])[:2],
                    })

    props.sort(key=lambda x: (-(x.get("edge") or 0), not x.get("starter"), x.get("ap") or 99))
    D["props"] = props

    props_by_gid = {}
    for pr in props:
        if pr["mk"] in ("Points", "PRA", "Rebounds", "Assists"):
            props_by_gid.setdefault(str(pr["gid"]), []).append(pr)
    for g in D.get("games", []):
        g_pr = props_by_gid.get(str(g["id"]), [])
        g["top_props"] = [
            {
                "aid": x["aid"],
                "nm": x["nm"],
                "ab": x["ab"],
                "pos": x["pos"],
                "slot": x["slot"],
                "proj_min": x["proj_min"],
                "usg": x["usg"],
                "mk": x["mk"],
                "side": x["side"],
                "line": x["line"],
                "proj": x["proj"],
                "edge": x["edge"],
                "is_star": x.get("is_star"),
                "nba_tier": x.get("nba_tier"),
            }
            for x in g_pr[:3]
        ]

    D["ratings_credit"] = "Ratings: barttorvik.com"
    json.dump(D, open(CBB_JSON, "w"), separators=(",", ":"))
    nba_cnt = sum(1 for t in D["teams"] for p in (t.get("rot") or []) if p.get("nba_prospect"))
    star_cnt = sum(1 for t in D["teams"] for p in (t.get("rot") or []) if p.get("is_star"))
    tot_ros = sum(len(t.get("rot") or []) for t in D["teams"])
    print(f"Done! {len(D['teams'])} teams ({tot_ros} total 2026-27 roster players), {star_cnt} Star Players, {nba_cnt} NBA Prospects, {len(D['players'])} featured players, {len(D['props'])} props.")

if __name__ == "__main__":
    main()
