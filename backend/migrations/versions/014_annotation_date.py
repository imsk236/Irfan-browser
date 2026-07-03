"""Annotation: add structured تاريخ القيد fields

Five Hijri date components on annotations (all nullable — NULL means مجهول),
mirroring works' copy-date shape minus place and witness (see ADR 0003):
  annotation_year      INTEGER
  annotation_month     TEXT   one of the 12 Hijri month names
  annotation_day       INTEGER  1-30
  annotation_weekday   TEXT   one of the 7 Arabic weekday names
  annotation_time      TEXT   free text

Revision ID: 014_annotation_date
Revises: 013_work_copy_place
Create Date: 2026-07-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "014_annotation_date"
down_revision: Union[str, None] = "013_work_copy_place"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DATE_COLS = [
    ("annotation_year", sa.Integer),
    ("annotation_month", sa.Text),
    ("annotation_day", sa.Integer),
    ("annotation_weekday", sa.Text),
    ("annotation_time", sa.Text),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(annotations)"))}

    for col_name, col_type in DATE_COLS:
        if col_name not in existing_cols:
            op.add_column("annotations", sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(annotations)"))}

    for col_name, _ in reversed(DATE_COLS):
        if col_name in existing_cols:
            with op.batch_alter_table("annotations") as batch_op:
                batch_op.drop_column(col_name)
