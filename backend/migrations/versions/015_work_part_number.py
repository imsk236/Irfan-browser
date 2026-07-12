"""Add part_number to works table.

الأجزاء — optional integer, which part of a multi-part work this عنوان
represents (long books are often copied across several parts).

Revision ID: 015_work_part_number
Revises: 014_annotation_date
Create Date: 2026-07-08
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "015_work_part_number"
down_revision: Union[str, None] = "014_annotation_date"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cols = {row[1] for row in op.get_bind().execute(sa.text("PRAGMA table_info(works)"))}
    with op.batch_alter_table("works") as batch_op:
        if "part_number" not in cols:
            batch_op.add_column(sa.Column("part_number", sa.Integer, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("works") as batch_op:
        batch_op.drop_column("part_number")
