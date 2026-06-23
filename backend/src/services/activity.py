"""Activity logging for the dashboard heatmap.

Each mutating API request is assigned a UUID commit_id by the middleware in
main.py. Service functions call log_activity() to record what changed. All
entries within one HTTP request share the same commit_id, so the dashboard
can count "one deliberate save = one action" even when several rows change.

Muscat local time (UTC+4) is applied in SQL queries — stored timestamps are
always UTC ISO-8601.
"""
from contextvars import ContextVar
from datetime import datetime, timezone

from sqlalchemy.orm import Session

_current_commit_id: ContextVar[str | None] = ContextVar("commit_id", default=None)


def set_commit_id(cid: str | None) -> None:
    _current_commit_id.set(cid)


def get_commit_id() -> str | None:
    return _current_commit_id.get()


def log_activity(
    session: Session,
    table_name: str,
    record_id: int,
    action: str,
    label: str | None = None,
) -> None:
    """Add an activity_log entry to the session (caller must commit).

    No-ops silently when no commit_id is set (tests that don't go through the
    HTTP middleware, or GET requests).
    """
    commit_id = _current_commit_id.get()
    if commit_id is None:
        return

    from ..db.models import ActivityLog
    session.add(ActivityLog(
        commit_id=commit_id,
        occurred_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        table_name=table_name,
        record_id=record_id,
        action=action,
        label=label,
    ))
