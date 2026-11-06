#!/usr/bin/env python3
"""Display-only CBB profile analysis. Reads published cbb.json; writes matchup_an.json.

NEVER use gp/ppg/usg/proj_* aggregates as current-season game logs: those fields
currently contain prior-season baselines and projections. The optional published
player game_logs contract is documented in MATCHUP_PREVIEW.md. No network calls.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATS = [('min', 'Minutes'), ('pts', 'Points'), ('reb', 'Rebounds'),
         ('ast', 'Assists'), ('tpm', '3PM'), ('usg', 'Usage %'),
         ('efg', 'eFG%'), ('ts', 'True shooting %')]
MIN_GAMES = 3


def number(v):
    return isinstance(v, (float, int)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0


def stamp(value):
    try:
        d = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return d if d.tzinfo else None
    except (ValueError, TypeError):
        return None


def player_key(p):
    return str(p['tid']) + '|' + str(p.get('id') or p['n'].lower())


def current_season(now):
    # College basketball uses fall-to-spring seasons; no prior-season carryover.
    start = now.year if now.month >= 7 else now.year - 1
    return f'{start}-{str(start + 1)[2:]}'


def logs(p, season, now):
    out, seen = [], set()
    for r in p.get('game_logs', []):
        dt = stamp(r.get('start'))
        gid = str(r.get('gid') or '')
        if (r.get('season') != season or r.get('completed') is not True or not dt
                or dt >= now or current_season(dt) != season or not gid or gid in seen or r.get('opp_tid') is None
                or r.get('tid') != p['tid'] or not number(r.get('min')) or r['min'] <= 0):
            continue
        seen.add(gid)
        clean = {k: r[k] for k in ('min', 'pts', 'reb', 'ast', 'tpm', 'usg',
                                  'fgm', 'fga', 'fta', 'tpa') if number(r.get(k))}
        out.append(dict(gid=gid, start=dt.isoformat(), opp_tid=str(r['opp_tid']),
                        home=r.get('home'), v=clean))
    return sorted(out, key=lambda r: r['start'], reverse=True)


def window(rs, minimum=MIN_GAMES):
    if len(rs) < minimum:
        return None
    v, samples = {}, {}
    for k, _ in STATS:
        values = [r['v'][k] for r in rs if number(r['v'].get(k))]
        if len(values) >= minimum:
            v[k] = round(sum(values) / len(values), 2)
            samples[k] = len(values)
    # Shooting percentages use summed attempts, not averages of percentages.
    for k, fields in [('efg', ('fgm', 'fga', 'tpm')), ('ts', ('pts', 'fga', 'fta'))]:
        valid = [r['v'] for r in rs if all(number(r['v'].get(f)) for f in fields)]
        if len(valid) < minimum:
            continue
        totals = {f: sum(r[f] for r in valid) for f in fields}
        den = totals['fga'] if k == 'efg' else 2 * (totals['fga'] + .44 * totals['fta'])
        num = totals['fgm'] + .5 * totals['tpm'] if k == 'efg' else totals['pts']
        if den:
            v[k], samples[k] = round(100 * num / den, 2), len(valid)
    return dict(n=len(rs), v=v, samples=samples)


def build(source, now):
    season = current_season(now)
    teams = {str(t['id']): t for t in source.get('teams', [])}
    players = {}
    # Rotation-first mirrors findPlayer(tid); composite keys avoid transfer collisions.
    for t in teams.values():
        for p in t.get('rot', []):
            players[player_key(p)] = p
    for p in source.get('players', []):
        players.setdefault(player_key(p), p)
    history = {k: logs(p, season, now) for k, p in players.items()}
    all_windows = {k: window(rs) for k, rs in history.items()}
    upcoming = []
    for g in source.get('games', []):
        start = stamp(g.get('start'))
        if start and start > now and current_season(start) == season and not g.get('completed'):
            upcoming.append(g)
    # The published upset radar also carries scheduled-game metadata beyond the
    # short opening slate. Reuse ONLY identity/time/venue fields, never its scores.
    seen_games = {str(g['id']) for g in source.get('games', [])}
    for r in source.get('upset_radar', []):
        start = stamp(r.get('start'))
        if not start or start <= now or current_season(start) != season or str(r.get('id')) in seen_games:
            continue
        dog_home = r.get('dog_home')
        if not isinstance(dog_home, bool):
            continue
        upcoming.append(dict(id=r['id'], start=r['start'], neutral=r.get('neutral', False),
                             home_tid=r['dog_id'] if dog_home else r['fav_id'],
                             away_tid=r['fav_id'] if dog_home else r['dog_id'],
                             home_name=r['dog'] if dog_home else r['fav'],
                             away_name=r['fav'] if dog_home else r['dog']))
        seen_games.add(str(r['id']))
    upcoming.sort(key=lambda g: g['start'])
    result = {}
    counts = Counter()
    for key, p in players.items():
        tid = str(p['tid'])
        g = next((g for g in upcoming if tid in (str(g.get('away_tid')), str(g.get('home_tid')))), None)
        rs, all_w = history[key], all_windows[key]
        status = 'no_upcoming' if not g else 'insufficient_logs' if not all_w else 'ready'
        counts[status] += 1
        entry = dict(name=p['n'], tid=tid, id=str(p.get('id') or ''), role=p.get('role'),
                     pos=p.get('pos'), status=status, logged_games=len(rs))
        result[key] = entry
        if not g:
            continue
        home = str(g['home_tid']) == tid
        oid = str(g['away_tid'] if home else g['home_tid'])
        ot = teams.get(oid, {})
        entry['next'] = dict(gid=str(g['id']), start=g['start'], home=home,
                             neutral=bool(g.get('neutral')), opp_tid=oid,
                             opponent=ot.get('team') or g.get('away_name' if home else 'home_name'))
        # Explicitly labelled published rating snapshot, never alleged current-season allowances.
        context = []
        for k, label, unit in [('adjD', 'Adjusted defense', 'points / 100 possessions'),
                               ('adjT', 'Adjusted tempo', 'possessions / 40 min')]:
            if number(ot.get(k)):
                context.append(dict(label=label, value=ot[k], unit=unit))
        entry['opponent_context'] = context
        if not all_w:
            continue
        wins = {'All': all_w}
        for name, rows, minimum in [('L5', rs[:5], 3), ('L10', rs[:10], 3),
                                    ('Home', [r for r in rs if r['home'] is True], 2),
                                    ('Away', [r for r in rs if r['home'] is False], 2)]:
            if w := window(rows, minimum):
                wins[name] = w
        axes = []
        for k, label in STATS:
            if k not in all_w['v']:
                continue
            pop = [w['v'][k] for q, w in all_windows.items()
                   if w and players[q].get('pos') == p.get('pos') and k in w['v']]
            if len(pop) < 3:
                continue
            val = all_w['v'][k]
            pct = round(100 * (sum(x < val for x in pop) + .5 * sum(x == val for x in pop)) / len(pop))
            axes.append(dict(k=k, label=label, value=val, percentile=pct, peers=len(pop), n=all_w['samples'][k]))
        entry.update(windows=wins, axes=axes)
        similar = []
        minutes = all_w['v'].get('min')
        if minutes:
            for q, w in all_windows.items():
                if q == key or not w or players[q].get('pos') != p.get('pos'):
                    continue
                qm = w['v'].get('min')
                if qm is None or abs(qm - minutes) / minutes > .3:
                    continue
                for r in history[q]:
                    if r['opp_tid'] == oid and 'pts' in r['v'] and 'pts' in w['v']:
                        similar.append(dict(name=players[q]['n'], team=players[q].get('team'),
                                            start=r['start'], points=r['v']['pts'],
                                            average=w['v']['pts'], minutes=qm))
        entry['similar'] = sorted(similar, key=lambda r: r['start'], reverse=True)[:12]
    return dict(version=1, season=season, built_at=now.isoformat(), source='data/cbb.json',
                source_built=source.get('built'), stats=STATS, minimum_games=MIN_GAMES,
                coverage=dict(players=len(players), logged_players=sum(bool(rs) for rs in history.values()),
                              upcoming_games=len(upcoming), **counts), players=result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--as-of', help='Explicit ISO timestamp for reproducible local tests')
    args = parser.parse_args()
    now = stamp(args.as_of) if args.as_of else datetime.now(timezone.utc)
    if now is None:
        parser.error('--as-of requires an explicit timezone')
    path = ROOT / 'data/cbb.json'
    raw = path.read_bytes()
    output = build(json.loads(raw), now)
    output['source_sha256'] = hashlib.sha256(raw).hexdigest()
    (ROOT / 'data/matchup_an.json').write_text(json.dumps(output, separators=(',', ':')) + '\n')
    print(json.dumps(output['coverage'], sort_keys=True))


if __name__ == '__main__':
    main()
