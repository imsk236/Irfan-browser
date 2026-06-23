"""Add copy_place to works table."""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "013_work_copy_place"
down_revision: Union[str, None] = "012_work_topic_classification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cols = {row[1] for row in op.get_bind().execute(sa.text("PRAGMA table_info(works)"))}
    with op.batch_alter_table("works") as batch_op:
        if "copy_place" not in cols:
            batch_op.add_column(sa.Column("copy_place", sa.Text, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("works") as batch_op:
        batch_op.drop_column("copy_place")
