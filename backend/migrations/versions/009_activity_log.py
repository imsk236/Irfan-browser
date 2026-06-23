"""Dashboard: append-only activity_log table for the 12-month heatmap.

Each mutating API request records one or more rows with a shared commit_id
(UUID generated per HTTP request by the commit_id middleware). The calendar
groups rows by date(occurred_at, '+4 hours') — Muscat local time (UTC+4).

Revision ID: 009_activity_log
Revises: 008_person_wilayas_nasab
Create Date: 2026-06-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "009_activity_log"
down_revision: Union[str, None] = "008_person_wilayas_nasab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {
        row[0]
        for row in bind.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    }

    if "activity_log" not in existing_tables:
        op.create_table(
            "activity_log",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("commit_id", sa.Text, nullable=False),
            sa.Column("occurred_at", sa.Text, nullable=False),  # ISO8601 UTC
            sa.Column("table_name", sa.Text, nullable=False),
            sa.Column("record_id", sa.Integer, nullable=False),
            sa.Column("action", sa.Text, nullable=False),  # create | update | delete
            sa.Column("label", sa.Text),                   # display hint: serial, title, name…
        )
        op.create_index("idx_activity_log_occurred_at", "activity_log", ["occurred_at"])
        op.create_index("idx_activity_log_commit_id", "activity_log", ["commit_id"])


def downgrade() -> None:
    bind = op.get_bind()
    existing_tables = {
        row[0]
        for row in bind.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    }
    if "activity_log" in existing_tables:
        op.drop_index("idx_activity_log_commit_id", table_name="activity_log")
        op.drop_index("idx_activity_log_occurred_at", table_name="activity_log")
        op.drop_table("activity_log")
