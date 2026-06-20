"""Person: add nasab text field, person_wilayas table, drop removed columns

- Adds nasab (free-text nasab chain) to persons
- Creates person_wilayas junction table
- Drops identification_status, region_or_country, scholarly_affiliation, occupation_or_status
- Drops person_ancestors table (replaced by nasab free text)

Revision ID: 008_person_wilayas_nasab
Revises: 007_annotation_drop_date_fields
Create Date: 2026-06-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "008_person_wilayas_nasab"
down_revision: Union[str, None] = "007_annotation_drop_date_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PERSONS_DROP = [
    "identification_status",
    "region_or_country",
    "scholarly_affiliation",
    "occupation_or_status",
]


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Add nasab to persons
    existing_persons = {row[1] for row in bind.execute(text("PRAGMA table_info(persons)"))}
    if "nasab" not in existing_persons:
        op.add_column("persons", sa.Column("nasab", sa.Text, nullable=True))

    # 2. Drop removed columns from persons
    # FK enforcement must be OFF for batch_alter_table on SQLite — it internally
    # drops and recreates the table, which fails if referencing tables exist.
    cols_to_drop = [c for c in _PERSONS_DROP if c in existing_persons]
    if cols_to_drop:
        bind.execute(text("PRAGMA foreign_keys=OFF"))
        with op.batch_alter_table("persons") as batch_op:
            for col in cols_to_drop:
                batch_op.drop_column(col)
        bind.execute(text("PRAGMA foreign_keys=ON"))

    # 3. Create person_wilayas table
    existing_tables = {row[0] for row in bind.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
    if "person_wilayas" not in existing_tables:
        op.create_table(
            "person_wilayas",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("person_id", sa.Integer, sa.ForeignKey("persons.id"), nullable=False),
            sa.Column("wilaya", sa.Text, nullable=False),
        )

    # 4. Drop person_ancestors table
    if "person_ancestors" in existing_tables:
        op.drop_table("person_ancestors")


def downgrade() -> None:
    bind = op.get_bind()

    existing_persons = {row[1] for row in bind.execute(text("PRAGMA table_info(persons)"))}
    existing_tables = {row[0] for row in bind.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}

    # Restore person_ancestors
    if "person_ancestors" not in existing_tables:
        op.create_table(
            "person_ancestors",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("person_id", sa.Integer, sa.ForeignKey("persons.id"), nullable=False),
            sa.Column("position", sa.Integer, nullable=False),
            sa.Column("name", sa.Text, nullable=False),
        )

    # Drop person_wilayas
    if "person_wilayas" in existing_tables:
        op.drop_table("person_wilayas")

    # Restore dropped columns
    for col in _PERSONS_DROP:
        if col not in existing_persons:
            op.add_column("persons", sa.Column(col, sa.Text, nullable=True))

    # Drop nasab
    if "nasab" in existing_persons:
        with op.batch_alter_table("persons") as batch_op:
            batch_op.drop_column("nasab")
