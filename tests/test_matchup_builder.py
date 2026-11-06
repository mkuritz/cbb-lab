"""Synthetic unit fixtures ONLY. No fixture is written to published data/."""
import copy
from datetime import datetime, timezone
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('builder', Path(__file__).parents[1] / 'scripts/build_matchup_analyzer.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
NOW = datetime(2026, 11, 6, 19, tzinfo=timezone.utc)


def fixture():
    players = []
    for i in range(3):
        p = dict(id=str(i), n=f'TEST FIXTURE {i}', tid=1, pos='G', team='TEST TEAM', role='Starter',
                 gp=35, ppg=99, proj_min=40, proj_pts=12, proj_usg=22, usg=99, game_logs=[])
        for day in range(1, 5):
            p['game_logs'].append(dict(gid=str(day), start=f'2026-11-0{day}T00:00:00Z',
                completed=True, season='2026-27', tid=1, opp_tid=2, home=day%2==0,
                min=20+i, pts=10+i, reb=3, ast=2, tpm=2, fgm=4, fga=10, fta=4))
        players.append(p)
    return dict(built='TEST FIXTURE', players=players,
                teams=[dict(id=1, team='TEST TEAM', rot=players), dict(id=2, team='TEST OPPONENT', adjD=100, adjT=70, rot=[dict(id='opp', n='TEST OPPONENT STARTER', tid=2, pos='F', starter=True, role='Starter', proj_min=30, proj_usg=23)])],
                games=[dict(id='future', start='2026-11-10T00:00:00Z', away_tid=1, home_tid=2)])


class BuilderTest(unittest.TestCase):
    def test_no_aggregate_fallback(self):
        d=fixture()
        for p in d['players']: p.pop('game_logs')
        out=b.build(d,NOW)
        self.assertEqual(out['coverage']['logged_players'],0)
        for p in out['players'].values():
            self.assertEqual(p['status'],'insufficient_logs')
            self.assertNotIn('windows',p)
        self.assertEqual(len(out['players']['1|0']['opponent_context']),2)

    def test_real_log_math_and_hidden_missing_metrics(self):
        out=b.build(fixture(),NOW)
        p=out['players']['1|0']
        self.assertEqual(p['status'],'ready')
        self.assertEqual(p['windows']['All']['n'],4)
        self.assertEqual(p['windows']['All']['v']['efg'],50)
        self.assertEqual(p['windows']['All']['v']['ts'],42.52)
        self.assertNotIn('usg',p['windows']['All']['v'])
        self.assertGreaterEqual(len(p['axes']),3)
        self.assertEqual(p['axes'][0]['peers'],3)
        self.assertEqual(len(p['similar']),8)
        self.assertEqual(p['windows']['Home']['n'],2)

    def test_prior_future_dnp_duplicates_and_wrong_team_rejected(self):
        d=fixture();p=d['players'][0];good=p['game_logs'][0]
        p['game_logs']=[good,copy.deepcopy(good)]
        for patch in [dict(season='2025-26'),dict(completed=False),dict(min=0),dict(tid=9),
                      dict(start='2026-12-01T00:00:00Z'),dict(min=None),dict(start='bad')]:
            p['game_logs'].append(dict(good,**dict(patch,gid=str(patch))))
        out=b.build(d,NOW)['players']['1|0']
        self.assertEqual(out['logged_games'],1)
        self.assertEqual(out['status'],'insufficient_logs')

    def test_future_games_only_and_season_rollover(self):
        d=fixture();d['games'][0]['start']='2026-11-01T00:00:00Z'
        self.assertEqual(b.build(d,NOW)['players']['1|0']['status'],'no_upcoming')
        self.assertEqual(b.current_season(datetime(2027,2,1,tzinfo=timezone.utc)),'2026-27')

    def test_sparse_metrics_and_small_peer_pop_hide_radar(self):
        d=fixture();d['players']=d['players'][:1];d['teams'][0]['rot']=d['players']
        for r in d['players'][0]['game_logs']: r.pop('pts')
        p=b.build(d,NOW)['players']['1|0']
        self.assertEqual(p['axes'],[])
        self.assertNotIn('pts',p['windows']['All']['v'])
        self.assertNotIn('ts',p['windows']['All']['v'])

    def test_projected_rotation_share_is_explicit_and_unchanged(self):
        d=fixture();out=b.build(d,NOW)
        rot=out['rotations']['1']
        self.assertEqual(rot['total_minutes'],120)
        self.assertAlmostEqual(sum(r['share'] for r in rot['rows']),100,places=1)
        self.assertEqual(rot['rows'][0]['usage'],22)
        self.assertNotIn('availability',rot['rows'][0])
        self.assertEqual(d['players'][0]['proj_min'],40)

    def test_graph_benchmark_is_exact_game_market_else_existing_projection(self):
        d=fixture();p=b.build(d,NOW)['players']['1|0']
        self.assertEqual(p['graph']['pts']['benchmark']['kind'],'projection')
        self.assertEqual(p['graph']['pts']['benchmark']['value'],12)
        self.assertIsNone(p['graph']['reb']['benchmark'])
        self.assertEqual(len(p['graph']['pts']['games']),4)
        self.assertEqual(p['h2h']['n'],4)
        self.assertNotIn('L6',p['windows'])
        d['props']=[dict(aid='0',t=1,gid='past',mk='Points',line=99),
                    dict(aid='0',t=1,gid='future',mk='Points',line=10.5)]
        p=b.build(d,NOW)['players']['1|0']
        self.assertEqual(p['graph']['pts']['benchmark']['value'],10.5)
        self.assertEqual(p['similar'][0]['benchmark']['kind'],'line')
        self.assertTrue(all(r['value']!=12 for r in p['graph']['pts']['games']))

    def test_radar_schedule_metadata_only(self):
        d=fixture();d['games']=[]
        d['upset_radar']=[dict(id='future',start='2026-11-10T00:00:00Z',dog_id=1,fav_id=2,
                              dog='TEST TEAM',fav='TEST OPPONENT',dog_home=False,dog_win_prob=.99)]
        p=b.build(d,NOW)['players']['1|0']
        self.assertEqual(p['next']['opp_tid'],'2')
        self.assertNotIn('dog_win_prob',p)

if __name__=='__main__': unittest.main()
