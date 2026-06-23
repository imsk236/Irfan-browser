"""Add incipit (المطلع), explicit (الخاتمة), and title_source (مصدر العنوان) to works.

Revision ID: 011_work_incipit_explicit_title_source
Revises: 010_drop_confidence
Create Date: 2026-06-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "011_work_incipit_explicit_title_source"
down_revision: Union[str, None] = "010_drop_confidence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    cols = {row[1] for row in op.get_bind().execute(sa.text("PRAGMA table_info(works)"))}
    with op.batch_alter_table("works") as batch_op:
        if "incipit" not in cols:
            batch_op.add_column(sa.Column("incipit", sa.Text, nullable=True))
        if "explicit" not in cols:
            batch_op.add_column(sa.Column("explicit", sa.Text, nullable=True))
        if "title_source" not in cols:
            batch_op.add_column(sa.Column("title_source", sa.Text, nullable=True))


def downgrade() -> None:
    cols = {row[1] for row in op.get_bind().execute(sa.text("PRAGMA table_info(works)"))}
    with op.batch_alter_table("works") as batch_op:
        if "incipit" in cols:
            batch_op.drop_column("incipit")
        if "explicit" in cols:
            batch_op.drop_column("explicit")
        if "title_source" in cols:
            batch_op.drop_column("title_source")
