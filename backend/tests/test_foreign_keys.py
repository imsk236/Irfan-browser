"""Tests that PRAGMA foreign_keys=ON is enforced on every new connection.

DATA-003 from the audit: the old engine.py set PRAGMA foreign_keys=ON only
once at startup.  The per-connection event listener added in Phase 1 must
ensure FK constraints apply even on connections the pool creates after the
initial startup call.
"""
import pytest
from sqlalchemy import text, create_engine, event
from sqlalchemy.exc import IntegrityError

from src.db.models import Base


def test_fk_enforced_on_new_connection(engine):
    """FK violation must be rejected even on a brand-new pooled connection."""
    with engine.connect() as conn:
        # Insert an annotation referencing a non-existent volume — must fail.
        with pytest.raises(IntegrityError):
            with conn.begin():
                conn.execute(
                    text(
                        "INSERT INTO annotations "
                        "(volume_id, annotation_type) "
                        "VALUES (9999, 'test')"
                    )
                )


def test_fk_enforced_across_multiple_connections(engine):
    """Each connection from the pool independently enforces FKs."""
    for _ in range(3):
        with engine.connect() as conn:
            with pytest.raises(IntegrityError):
                with conn.begin():
                    conn.execute(
                        text(
                            "INSERT INTO volumes "
                            "(repository_id, document_number, serial) "
                            "VALUES (9999, 1, '9999-0001')"
                        )
                    )


def test_fk_pragma_returns_on(engine):
    """PRAGMA foreign_keys should return 1 on connections from our engine."""
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA foreign_keys")).scalar_one()
    assert result == 1, "foreign_keys PRAGMA must be 1 (enabled)"


def test_without_listener_fk_not_enforced(raw_engine):
    """Without the per-connection listener, SQLite silently accepts FK violations.

    This test documents the baseline behaviour and proves that the listener
    (not SQLite's default) is what enforces FKs.
    """
    with raw_engine.connect() as conn:
        result = conn.execute(text("PRAGMA foreign_keys")).scalar_one()
    # Default SQLite behaviour is FK enforcement OFF (0)
    assert result == 0, "Without the listener, foreign_keys must be 0 (disabled)"


def test_valid_insert_accepted_with_fk_on(engine):
    """A properly linked insert is accepted when FKs are enforced."""
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text(
                    "INSERT INTO repositories (place_key, name) "
                    "VALUES ('0001', 'Test Repo')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO volumes (repository_id, document_number, serial) "
                    "VALUES (1, 1, '0001-0001')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO annotations (volume_id, annotation_type) "
                    "VALUES (1, 'تملك')"
                )
            )
