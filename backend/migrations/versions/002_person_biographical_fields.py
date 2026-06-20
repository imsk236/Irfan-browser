"""Add 14 biographical fields to persons table (project_spec.md §5)

All new columns are nullable so this migration is safe to run against any
existing database that has a persons table with existing rows.  SQLite does
not support NOT NULL ADD COLUMN without a DEFAULT, so all biographical fields
are optional at the database level — the application layer enforces required
fields where needed.

Revision ID: 002_person_biographical_fields
Revises: 001_baseline
Create Date: 2026-06-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision: str = "002_person_biographical_fields"
down_revision: Union[str, None] = "001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_COLUMNS = [
    ("identification_status", sa.Text),
    ("kunya", sa.Text),
    ("known_as", sa.Text),
    ("birth_date_as_written", sa.Text),
    ("birth_year_earliest", sa.Integer),
    ("birth_year_latest", sa.Integer),
    ("death_date_as_written", sa.Text),
    ("death_year_earliest", sa.Integer),
    ("death_year_latest", sa.Integer),
    ("birth_place", sa.Text),
    ("death_place", sa.Text),
    ("region_or_country", sa.Text),
    ("scholarly_affiliation", sa.Text),
    ("occupation_or_status", sa.Text),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {row[1] for row in bind.execute(text("PRAGMA table_info(persons)"))}

    for col_name, col_type in _NEW_COLUMNS:
        if col_name not in existing_cols:
            op.add_column("persons", sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    # SQLite does not support DROP COLUMN before version 3.35.0.
    # Alembic handles this via a table-rebuild strategy; we use batch mode.
    with op.batch_alter_table("persons") as batch_op:
        for col_name, _ in _NEW_COLUMNS:
            batch_op.drop_column(col_name)
