"""Add repository_volume_number to volumes table

Optional integer representing the volume's number within the repository,
entered manually by the researcher (distinct from the auto-generated serial).

Revision ID: 003_add_repository_volume_number
Revises: 002_person_biographical_fields
Create Date: 2026-06-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "003_add_repository_volume_number"
down_revision: Union[str, None] = "002_person_biographical_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(volumes)"))}

    if "repository_volume_number" not in existing_cols:
        op.add_column("volumes", sa.Column("repository_volume_number", sa.Integer, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("volumes") as batch_op:
        batch_op.drop_column("repository_volume_number")
