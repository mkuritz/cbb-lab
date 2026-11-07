import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from schedule_status import include_in_radar, public_scores, resolve_kind, score_num

NOW = datetime(2026, 11, 7, 16, 59, tzinfo=timezone.utc)
ROOT = Path(__file__).parents[1]


class ScheduleStatusTests(unittest.TestCase):
    def test_nov6_michigan_uconn_is_past_final_and_not_an_alert(self):
        status = {"name": "STATUS_FINAL", "state": "post", "completed": True, "description": "Final"}
        kind = resolve_kind(status, "2026-11-07T01:00Z", NOW)
        self.assertEqual(kind, "final")
        self.assertFalse(include_in_radar(kind))
        self.assertEqual(public_scores(kind, "77", {"displayValue": "85"}), (77, 85))

    def test_same_evening_et_game_stays_scheduled(self):
        # 2026-11-08T00:00Z is 7:00 PM ET on Nov 7, after the morning build.
        status = {"name": "STATUS_SCHEDULED", "state": "pre", "completed": False}
        kind = resolve_kind(status, "2026-11-08T00:00Z", NOW)
        self.assertEqual(kind, "scheduled")
        self.assertTrue(include_in_radar(kind))

    def test_past_scheduled_live_postponed_cancelled_and_zero_scores(self):
        scheduled = {"name": "STATUS_SCHEDULED", "state": "pre", "completed": False}
        self.assertEqual(resolve_kind(scheduled, "2026-11-07T01:00Z", NOW), "unknown")
        self.assertFalse(include_in_radar("unknown"))
        live = {"name": "STATUS_IN_PROGRESS", "state": "in", "completed": False}
        self.assertEqual(resolve_kind(live, "2026-11-07T18:00Z", NOW), "live")
        self.assertTrue(include_in_radar("live"))
        self.assertEqual(public_scores("live", 40, 38), (None, None))
        self.assertEqual(public_scores("scheduled", "0", "0"), (None, None))
        self.assertEqual(resolve_kind({"name": "STATUS_POSTPONED", "state": "pre"}, "2026-11-10T00:00Z", NOW), "postponed")
        self.assertEqual(resolve_kind({"name": "STATUS_CANCELED", "state": "post", "completed": True}, "2026-11-06T00:00Z", NOW), "cancelled")
        self.assertFalse(include_in_radar("postponed"))
        self.assertFalse(include_in_radar("cancelled"))
        self.assertIsNone(score_num(True))
        self.assertEqual(public_scores("final", "77", None), (None, None))

    def test_enrich_gates_alerts_on_status(self):
        text = (ROOT / "enrich_cbb_hub.py").read_text()
        self.assertIn("include_in_radar", text)
        self.assertIn("public_scores", text)
        self.assertIn("resolve_kind", text)


if __name__ == "__main__":
    unittest.main()
