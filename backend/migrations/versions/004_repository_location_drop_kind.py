"""Repository: add location (Omani wilaya), drop kind

Revision ID: 004_repository_location_drop_kind
Revises: 003_add_repository_volume_number
Create Date: 2026-06-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "004_repository_location_drop_kind"
down_revision: Union[str, None] = "003_add_repository_volume_number"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(repositories)"))}

    if "location" not in existing_cols:
        op.add_column("repositories", sa.Column("location", sa.Text, nullable=True))

    if "kind" in existing_cols:
        bind.execute(text("PRAGMA foreign_keys=OFF"))
        with op.batch_alter_table("repositories") as batch_op:
            batch_op.drop_column("kind")
        bind.execute(text("PRAGMA foreign_keys=ON"))


def downgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(repositories)"))}

    if "kind" not in existing_cols:
        op.add_column("repositories", sa.Column("kind", sa.Text, nullable=True))

    with op.batch_alter_table("repositories") as batch_op:
        batch_op.drop_column("location")
