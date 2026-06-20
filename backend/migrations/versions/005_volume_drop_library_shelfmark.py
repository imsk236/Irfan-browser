"""Volume: drop library_shelfmark (superseded by repository_volume_number)

Revision ID: 005_volume_drop_library_shelfmark
Revises: 004_repository_location_drop_kind
Create Date: 2026-06-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "005_volume_drop_library_shelfmark"
down_revision: Union[str, None] = "004_repository_location_drop_kind"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(volumes)"))}

    if "library_shelfmark" in existing_cols:
        with op.batch_alter_table("volumes") as batch_op:
            batch_op.drop_column("library_shelfmark")


def downgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(volumes)"))}

    if "library_shelfmark" not in existing_cols:
        op.add_column("volumes", sa.Column("library_shelfmark", sa.Text, nullable=True))
