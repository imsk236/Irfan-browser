"""Annotation: drop date fields (dates not tracked on قيود)

Removes: date_as_written, date_earliest, date_latest, date_precision

Revision ID: 007_annotation_drop_date_fields
Revises: 006_work_copy_date_drop_type
Create Date: 2026-06-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "007_annotation_drop_date_fields"
down_revision: Union[str, None] = "006_work_copy_date_drop_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DATE_COLS = [
    ("date_as_written", sa.Text),
    ("date_earliest", sa.Integer),
    ("date_latest", sa.Integer),
    ("date_precision", sa.Text),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(annotations)"))}

    cols_to_drop = [name for name, _ in DATE_COLS if name in existing_cols]
    if cols_to_drop:
        with op.batch_alter_table("annotations") as batch_op:
            for col_name in cols_to_drop:
                batch_op.drop_column(col_name)


def downgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(annotations)"))}

    for col_name, col_type in DATE_COLS:
        if col_name not in existing_cols:
            op.add_column("annotations", sa.Column(col_name, col_type, nullable=True))
