"""Drop confidence column from person_relationships; evidence_source now encodes مصدر الصلة.

Revision ID: 010_drop_confidence
Revises: 009_activity_log
Create Date: 2026-06-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "010_drop_confidence"
down_revision: Union[str, None] = "009_activity_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("person_relationships") as batch_op:
        cols = {row[1] for row in op.get_bind().execute(sa.text("PRAGMA table_info(person_relationships)"))}
        if "confidence" in cols:
            batch_op.drop_column("confidence")


def downgrade() -> None:
    with op.batch_alter_table("person_relationships") as batch_op:
        cols = {row[1] for row in op.get_bind().execute(sa.text("PRAGMA table_info(person_relationships)"))}
        if "confidence" not in cols:
            batch_op.add_column(sa.Column("confidence", sa.Text, nullable=True))
