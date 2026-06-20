"""Baseline schema — all tables as of prototype commit d36b3b2

This migration is safe to run against the existing dev_archive.db:
every CREATE TABLE uses IF NOT EXISTS.  If the dev database was created
before Alembic was introduced, stamp it at this revision first:

    uv run alembic stamp 001_baseline

Then apply the next migration:

    uv run alembic upgrade head

Revision ID: 001_baseline
Revises:
Create Date: 2026-06-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = inspect(bind).get_table_names()

    if "vocab" not in existing:
        op.create_table(
            "vocab",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("category", sa.Text, nullable=False),
            sa.Column("value", sa.Text, nullable=False),
            sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
            sa.UniqueConstraint("category", "value"),
        )

    if "repositories" not in existing:
        op.create_table(
            "repositories",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("place_key", sa.Text, nullable=False, unique=True),
            sa.Column("name", sa.Text, nullable=False),
            sa.Column("kind", sa.Text, nullable=False),
            sa.Column("notes", sa.Text),
        )

    if "volumes" not in existing:
        op.create_table(
            "volumes",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("repository_id", sa.Integer, sa.ForeignKey("repositories.id"), nullable=False),
            sa.Column("document_number", sa.Integer, nullable=False),
            sa.Column("serial", sa.Text, nullable=False, unique=True),
            sa.Column("library_shelfmark", sa.Text),
            sa.Column("folio_count", sa.Integer),
            sa.Column("notes", sa.Text),
            sa.UniqueConstraint("repository_id", "document_number"),
        )

    if "persons" not in existing:
        op.create_table(
            "persons",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("preferred_name", sa.Text, nullable=False),
            sa.Column("ism", sa.Text),
            sa.Column("nisba_1", sa.Text),
            sa.Column("nisba_2", sa.Text),
            sa.Column("laqab", sa.Text),
            sa.Column("notes", sa.Text),
        )

    if "person_ancestors" not in existing:
        op.create_table(
            "person_ancestors",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("person_id", sa.Integer, sa.ForeignKey("persons.id"), nullable=False),
            sa.Column("position", sa.Integer, nullable=False),
            sa.Column("name", sa.Text, nullable=False),
            sa.UniqueConstraint("person_id", "position"),
        )

    if "annotations" not in existing:
        op.create_table(
            "annotations",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("volume_id", sa.Integer, sa.ForeignKey("volumes.id"), nullable=False),
            sa.Column("work_id", sa.Integer, sa.ForeignKey("works.id")),
            sa.Column("annotation_type", sa.Text, nullable=False),
            sa.Column("text_as_written", sa.Text),
            sa.Column("date_as_written", sa.Text),
            sa.Column("date_earliest", sa.Integer),
            sa.Column("date_latest", sa.Integer),
            sa.Column("date_precision", sa.Text),
            sa.Column("image_location", sa.Text),
            sa.Column("notes", sa.Text),
        )

    if "person_name_variants" not in existing:
        op.create_table(
            "person_name_variants",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("person_id", sa.Integer, sa.ForeignKey("persons.id"), nullable=False),
            sa.Column("written_form", sa.Text, nullable=False),
            sa.Column("normalized_form", sa.Text),
            sa.Column("source_annotation_id", sa.Integer, sa.ForeignKey("annotations.id")),
            sa.Column("notes", sa.Text),
            sa.UniqueConstraint("person_id", "written_form"),
        )

    if "works" not in existing:
        op.create_table(
            "works",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("volume_id", sa.Integer, sa.ForeignKey("volumes.id"), nullable=False),
            sa.Column("title", sa.Text, nullable=False),
            sa.Column("work_type", sa.Text),
            sa.Column("start_unit", sa.Text),
            sa.Column("end_unit", sa.Text),
            sa.Column("notes", sa.Text),
        )

    if "person_relationships" not in existing:
        op.create_table(
            "person_relationships",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("person_id", sa.Integer, sa.ForeignKey("persons.id"), nullable=False),
            sa.Column("level", sa.Text, nullable=False),
            sa.Column("volume_id", sa.Integer, sa.ForeignKey("volumes.id")),
            sa.Column("work_id", sa.Integer, sa.ForeignKey("works.id")),
            sa.Column("role", sa.Text, nullable=False),
            sa.Column("confidence", sa.Text, nullable=False),
            sa.Column("evidence_source", sa.Text),
            sa.Column("evidence_annotation_id", sa.Integer, sa.ForeignKey("annotations.id")),
            sa.Column("notes", sa.Text),
            sa.CheckConstraint(
                "(level = 'work'   AND work_id   IS NOT NULL AND volume_id IS NULL) OR "
                "(level = 'volume' AND volume_id IS NOT NULL AND work_id   IS NULL)",
                name="ck_person_relationships_level",
            ),
        )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("person_relationships")
    op.drop_table("person_name_variants")
    op.drop_table("person_ancestors")
    op.drop_table("annotations")
    op.drop_table("works")
    op.drop_table("persons")
    op.drop_table("volumes")
    op.drop_table("repositories")
    op.drop_table("vocab")
