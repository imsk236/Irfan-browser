"""Add topic_category and topic_subcategory to works table."""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "012_work_topic_classification"
down_revision: Union[str, None] = "011_work_incipit_explicit_title_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cols = {row[1] for row in op.get_bind().execute(sa.text("PRAGMA table_info(works)"))}
    with op.batch_alter_table("works") as batch_op:
        if "topic_category" not in cols:
            batch_op.add_column(sa.Column("topic_category", sa.Text, nullable=True))
        if "topic_subcategory" not in cols:
            batch_op.add_column(sa.Column("topic_subcategory", sa.Text, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("works") as batch_op:
        batch_op.drop_column("topic_subcategory")
        batch_op.drop_column("topic_category")
