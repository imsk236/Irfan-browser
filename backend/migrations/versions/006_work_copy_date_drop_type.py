"""Work: add structured copy-date fields, drop work_type

Six Hijri copy-date components (all nullable — NULL means مجهول):
  copy_date_as_written  TEXT   verbatim witness from the manuscript
  copy_year             INTEGER
  copy_month            TEXT   one of the 12 Hijri month names
  copy_day              INTEGER  1–30
  copy_weekday          TEXT   one of the 7 Arabic weekday names
  copy_time             TEXT   controlled vocab (e.g. وقت الضحى)

Revision ID: 006_work_copy_date_drop_type
Revises: 005_volume_drop_library_shelfmark
Create Date: 2026-06-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "006_work_copy_date_drop_type"
down_revision: Union[str, None] = "005_volume_drop_library_shelfmark"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COPY_DATE_COLS = [
    ("copy_date_as_written", sa.Text),
    ("copy_year", sa.Integer),
    ("copy_month", sa.Text),
    ("copy_day", sa.Integer),
    ("copy_weekday", sa.Text),
    ("copy_time", sa.Text),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(works)"))}

    for col_name, col_type in COPY_DATE_COLS:
        if col_name not in existing_cols:
            op.add_column("works", sa.Column(col_name, col_type, nullable=True))

    if "work_type" in existing_cols:
        with op.batch_alter_table("works") as batch_op:
            batch_op.drop_column("work_type")


def downgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(works)"))}

    if "work_type" not in existing_cols:
        op.add_column("works", sa.Column("work_type", sa.Text, nullable=True))

    for col_name, _ in reversed(COPY_DATE_COLS):
        if col_name in existing_cols:
            with op.batch_alter_table("works") as batch_op:
                batch_op.drop_column(col_name)
