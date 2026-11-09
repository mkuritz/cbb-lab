import importlib.util
import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("snapshot", ROOT / "scripts/fetch_schedule_snapshot.py")
snap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snap)

NOW = datetime(2026, 11, 7, 16, 59, tzinfo=timezone.utc)


def teams():
    rows = [{"id": 1000 + i, "team": f"Team {i}", "espnId": str(5000 + i)} for i in range(364)]
    rows.append({"id": 278, "team": "St. Francis (PA)"})
    return rows


def good(now=NOW, with_ids=None):
    ids = with_ids or list(range(364))
    game = {
        "start": "2026-11-07T01:00Z", "kind": "final", "homeScore": 77, "awayScore": 85,
        "homeEspn": "41", "awayEspn": "130", "homeName": "Michigan", "awayName": "UConn", "neutral": True,
    }
    by_team = {str(1000 + i): ["401920685"] for i in ids}
    return {
        "fetched_at": now.astimezone(snap.ET).isoformat(timespec="minutes"),
        "season": "2026-27",
        "espn_season": 2027,
        "teams": 365,
        "linked": 364,
        "with_games": len(by_team),
        "unavailable": [{"tid": 278, "team": "St. Francis (PA)", "reason": "no schedule link"}],
        "failed": [],
        "board_failed": [],
        "games": {"401920685": game},
        "byTeam": by_team,
        "byDate": {"2026-11-06": ["401920685"]},
    }


class PublishTests(unittest.TestCase):
    def test_daily_build_publishes_snapshot_without_changing_cron(self):
        text = (ROOT / ".github/workflows/build-hub.yml").read_text()
        self.assertEqual(text.count("cron:"), 1)
        self.assertIn('cron: "40 11 * * *"', text)
        self.assertIn("python3 scripts/fetch_schedule_snapshot.py", text)
        self.assertIn("cp data/schedule_snapshot.json /tmp/schedule_snapshot.json", text)
        self.assertIn("cp /tmp/schedule_snapshot.json data/schedule_snapshot.json", text)
        self.assertIn("git add data/cbb.json data/schedule_snapshot.json", text)
        self.assertIn("pstats_2026.json", text)
        self.assertNotIn("build_players_props.py\n", text.split("Refresh schedule snapshot")[-1].split("Commit")[0])
        script = (ROOT / "scripts/fetch_schedule_snapshot.py").read_text()
        self.assertNotIn("build_players_props", script)
        self.assertIn("publish_snapshot", script)
        self.assertNotIn('open(CBB_JSON, "w")', script)
        page = (ROOT / "index.html").read_text() + (ROOT / "schedule-view.js").read_text()
        self.assertNotIn("site.api.espn.com", page)

    def test_accepts_truthful_364_of_365_and_refuses_bad_fetches(self):
        roster = teams()
        ok, reason = snap.accept_snapshot(good(), None, roster, NOW)
        self.assertTrue(ok, reason)
        self.assertEqual(snap.current_season(NOW), ("2026-27", 2027))
        days = snap.board_days(NOW)
        self.assertEqual(len(days), 29)
        self.assertEqual(days[0].isoformat(), "2026-10-24")
        self.assertEqual(days[-1].isoformat(), "2026-11-21")
        self.assertIn(datetime(2026, 11, 6).date(), days)

        wrong = good()
        wrong["season"] = "2025-26"
        self.assertEqual(snap.accept_snapshot(wrong, None, roster, NOW)[1], "season")

        claimed = good()
        claimed["unavailable"] = []
        claimed["linked"] = 365
        self.assertEqual(snap.accept_snapshot(claimed, None, roster, NOW)[1], "coverage")

        scored = good()
        scored["games"]["401920685"] = dict(scored["games"]["401920685"], kind="scheduled", homeScore=0, awayScore=0)
        self.assertEqual(snap.accept_snapshot(scored, None, roster, NOW)[1], "scores")

        model = good()
        model["dog_win_prob"] = 0.5
        self.assertEqual(snap.accept_snapshot(model, None, roster, NOW)[1], "model fields")

        thin = good(with_ids=list(range(100)))
        self.assertEqual(snap.accept_snapshot(thin, None, roster, NOW)[1], "with_games below floor")

        collapsed = good(with_ids=list(range(320)))
        self.assertEqual(snap.accept_snapshot(collapsed, good(), roster, NOW)[1], "with_games collapsed")

        failed = good(with_ids=list(range(340)))
        failed["failed"] = [{"tid": 1000 + i, "team": f"Team {i}", "reason": "URLError"} for i in range(340, 364)]
        self.assertEqual(snap.accept_snapshot(failed, None, roster, NOW)[1], "too many team fetch failures")
        covered = good()
        covered["failed"] = [{"tid": 1000, "team": "Team 0", "reason": "URLError"}]
        self.assertEqual(snap.accept_snapshot(covered, None, roster, NOW)[1], "failed team listed as covered")

    def test_refusal_keeps_previous_file_and_stale_is_36_hours(self):
        roster = teams()
        dest = Path("/tmp/cbb-schedule-publish-test.json")
        dest.write_text(json.dumps(good()))
        before = dest.read_bytes()
        bad = good()
        bad["games"]["401920685"]["homeScore"] = None
        ok, reason = snap.publish_snapshot(dest, bad, roster, NOW)
        self.assertFalse(ok)
        self.assertEqual(reason, "scores")
        self.assertEqual(dest.read_bytes(), before)
        fresh = good()
        fresh["fetched_at"] = "2026-11-07T12:00-05:00"
        ok, reason = snap.publish_snapshot(dest, fresh, roster, NOW)
        self.assertTrue(ok, reason)
        self.assertIn(b"2026-11-07T12:00-05:00", dest.read_bytes())
        self.assertFalse(snap.snapshot_is_stale("2026-11-07T12:00-05:00", NOW))
        self.assertTrue(snap.snapshot_is_stale("2026-11-05T12:00-05:00", NOW))
        self.assertTrue(snap.snapshot_is_stale(None, NOW))
        dest.unlink()
        leftover = Path(str(dest) + ".tmp")
        if leftover.exists():
            leftover.unlink()


if __name__ == "__main__":
    unittest.main()
