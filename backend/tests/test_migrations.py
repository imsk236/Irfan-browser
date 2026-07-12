"""Tests that the Alembic migration chain runs cleanly on a fresh database.

This test creates a temporary SQLite file (not the dev database), applies
all migrations from scratch, verifies the resulting schema, then drops
everything using downgrade.
"""
import os

import pytest
from sqlalchemy import create_engine, inspect, text


def _run_alembic(command: list[str], db_path: str) -> None:
    """Run an Alembic sub-command programmatically."""
    from alembic.config import Config
    from alembic import command as alembic_cmd

    ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    ini_path = os.path.normpath(ini_path)

    cfg = Config(ini_path)
    db_url = "sqlite:///" + db_path.replace("\\", "/")
    cfg.set_main_option("sqlalchemy.url", db_url)

    cmd_name = command[0]
    cmd_args = command[1:]

    if cmd_name == "upgrade":
        alembic_cmd.upgrade(cfg, cmd_args[0])
    elif cmd_name == "downgrade":
        alembic_cmd.downgrade(cfg, cmd_args[0])
    elif cmd_name == "stamp":
        alembic_cmd.stamp(cfg, cmd_args[0])
    else:
        raise ValueError(f"Unknown command: {cmd_name}")


@pytest.fixture
def temp_db(tmp_path):
    """Temporary SQLite DB file path, cleaned up after the test."""
    db_file = str(tmp_path / "test_migration.db")
    yield db_file
    for suffix in ("", "-wal", "-shm"):
        candidate = db_file + suffix
        if os.path.exists(candidate):
            try:
                os.remove(candidate)
            except PermissionError:
                pass


def test_upgrade_creates_all_tables(temp_db):
    """Running upgrade head on a blank DB creates all expected tables."""
    _run_alembic(["upgrade", "head"], temp_db)

    url = "sqlite:///" + temp_db.replace("\\", "/")
    engine = create_engine(url)
    tables = set(inspect(engine).get_table_names())
    engine.dispose()

    expected = {
        "alembic_version",
        "vocab",
        "repositories",
        "volumes",
        "persons",
        "person_wilayas",
        "person_name_variants",
        "works",
        "annotations",
        "person_relationships",
    }
    assert expected <= tables, f"Missing tables: {expected - tables}"


def test_upgrade_adds_person_fields(temp_db):
    """After upgrade head, persons table has nasab and not the dropped columns."""
    _run_alembic(["upgrade", "head"], temp_db)

    url = "sqlite:///" + temp_db.replace("\\", "/")
    engine = create_engine(url)
    with engine.connect() as conn:
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(persons)")).fetchall()}
    engine.dispose()

    assert "nasab" in cols
    dropped = {"identification_status", "region_or_country", "scholarly_affiliation", "occupation_or_status"}
    assert not (dropped & cols), f"Columns still present after migration: {dropped & cols}"


def test_upgrade_version_is_head(temp_db):
    """After upgrade head, alembic_version contains the latest revision."""
    _run_alembic(["upgrade", "head"], temp_db)

    url = "sqlite:///" + temp_db.replace("\\", "/")
    engine = create_engine(url)
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
    engine.dispose()

    assert len(version) == 1
    assert version[0][0] == "015_work_part_number"


def test_stamp_existing_db_then_upgrade(temp_db):
    """An existing DB (tables present, no alembic_version) can be stamped then upgraded."""
    from src.db.models import Base
    url = "sqlite:///" + temp_db.replace("\\", "/")
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    engine.dispose()

    _run_alembic(["stamp", "001_baseline"], temp_db)
    _run_alembic(["upgrade", "head"], temp_db)

    engine = create_engine(url)
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    engine.dispose()
    assert version == "015_work_part_number"


def test_upgrade_head_on_create_all_db_without_stamp(temp_db):
    """Simulates a production client db: created via Base.metadata.create_all()
    (no alembic_version table, never stamped), then init_db() calls upgrade
    head directly. Relies on every migration's existence-guarded upgrade()
    to no-op on tables/columns that already exist from create_all."""
    from src.db.models import Base
    url = "sqlite:///" + temp_db.replace("\\", "/")
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    engine.dispose()

    _run_alembic(["upgrade", "head"], temp_db)

    engine = create_engine(url)
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(persons)")).fetchall()}
    engine.dispose()

    assert version == "015_work_part_number"
    assert "nasab" in cols


def test_downgrade_to_baseline_drops_new_columns(temp_db):
    """Downgrading from 002 to 001 removes the biographical columns."""
    _run_alembic(["upgrade", "head"], temp_db)
    _run_alembic(["downgrade", "001_baseline"], temp_db)

    url = "sqlite:///" + temp_db.replace("\\", "/")
    engine = create_engine(url)
    with engine.connect() as conn:
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(persons)")).fetchall()}
    engine.dispose()

    new_cols = {
        "identification_status", "kunya", "known_as",
        "birth_date_as_written", "birth_year_earliest", "birth_year_latest",
        "death_date_as_written", "death_year_earliest", "death_year_latest",
        "birth_place", "death_place", "region_or_country",
        "scholarly_affiliation", "occupation_or_status",
    }
    assert not (new_cols & cols), f"Columns still present after downgrade: {new_cols & cols}"
