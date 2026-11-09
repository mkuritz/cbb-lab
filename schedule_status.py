"""Game-status rules shared by the Upset Radar build.

Display code in schedule-view.js follows the same labels. Final scores are
kept only for a verified final. A scheduled tip that is already in the past
is unknown, not a current alert and not a made-up final.
"""
from datetime import datetime, timezone

FINAL = {"STATUS_FINAL", "STATUS_FINAL_OT", "STATUS_FULL_TIME"}
LIVE = {"STATUS_IN_PROGRESS", "STATUS_HALFTIME", "STATUS_END_PERIOD", "STATUS_END_OF_PERIOD"}
SCHEDULED = {"STATUS_SCHEDULED", "STATUS_PRE_GAME"}
POSTPONED = {"STATUS_POSTPONED"}
CANCELLED = {"STATUS_CANCELED", "STATUS_CANCELLED"}
DELAYED = {"STATUS_DELAYED", "STATUS_RAIN_DELAY"}
SUSPENDED = {"STATUS_SUSPENDED"}


def parse_start(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def score_num(value):
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, dict):
        value = value.get("displayValue", value.get("value"))
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not value.is_integer():
            return None
        if value < 0:
            return None
        return int(value)
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    return None


def kind_from_status(status_type):
    if not isinstance(status_type, dict):
        return "unknown"
    name = str(status_type.get("name") or "")
    desc = str(status_type.get("description") or status_type.get("detail") or "")
    state = str(status_type.get("state") or "")
    completed = status_type.get("completed") is True
    if name in CANCELLED:
        return "cancelled"
    if name in POSTPONED:
        return "postponed"
    if name in DELAYED:
        return "delayed"
    if name in SUSPENDED:
        return "suspended"
    if name in FINAL or (completed and desc.lower().startswith("final")):
        return "final"
    if name in LIVE or state == "in":
        return "live"
    if name in SCHEDULED or state == "pre":
        return "scheduled"
    return "unknown"


def resolve_kind(status_type, start_iso, now):
    """Collapse a stale 'scheduled' flag once the tip instant has passed."""
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    kind = kind_from_status(status_type)
    start = parse_start(start_iso)
    now_utc = now.astimezone(timezone.utc)
    if kind == "scheduled" and start is not None and start <= now_utc:
        return "unknown"
    if kind == "unknown" and start is not None and start > now_utc:
        return "scheduled"
    return kind


def public_scores(kind, home, away):
    if kind != "final":
        return None, None
    home_score, away_score = score_num(home), score_num(away)
    if home_score is None or away_score is None:
        return None, None
    return home_score, away_score


def include_in_radar(kind):
    """Forward-looking alerts only. Finals stay on the scoreboard, not here."""
    return kind in ("scheduled", "live")
