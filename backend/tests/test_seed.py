"""Tests for vocabulary seed data (DATA-002).

Verifies that all required categories are present after seed_vocab() runs,
and that re-running seed is idempotent.
"""
from sqlalchemy import text
from src.db.seed import seed_vocab, VOCAB_SEED, DEACTIVATED_CATEGORIES


_ACTIVE_CATEGORIES = {
    "role",
    "confidence",
    "knowledge_source",
    "annotation_type",
    "hijri_month",
    "weekday",
    "copy_time",
    "wilaya",
    "person_identification_status",
}

_DEACTIVATED_CATEGORIES = {
    "evidence_source",
    "work_type",
    "date_precision",
    "repository_kind",
}

_EXPECTED_IDENTIFICATION_STATUS = {
    "معروف",
    "غير مكتمل التعريف",
    "مجهول",
    "يحتاج إلى مراجعة",
}


def test_all_required_categories_seeded(engine):
    """seed_vocab must create all required active vocabulary categories."""
    with engine.connect() as conn:
        categories = {
            row[0]
            for row in conn.execute(
                text("SELECT DISTINCT category FROM vocab WHERE is_active = 1")
            ).fetchall()
        }
    assert _ACTIVE_CATEGORIES <= categories, (
        f"Missing categories: {_ACTIVE_CATEGORIES - categories}"
    )


def test_deactivated_categories_not_active(engine):
    """Deactivated categories must not appear as active rows in vocab.

    On a fresh test database, these categories have no rows at all (not seeded).
    On an upgraded production database, they exist with is_active=0.
    Either way, none should show up as is_active=1.
    """
    with engine.connect() as conn:
        active = {
            row[0]
            for row in conn.execute(
                text("SELECT DISTINCT category FROM vocab WHERE is_active = 1")
            ).fetchall()
        }
    overlap = _DEACTIVATED_CATEGORIES & active
    assert not overlap, (
        f"These categories should be inactive but are active: {overlap}"
    )


def test_person_identification_status_values(engine):
    """person_identification_status must contain all four approved values."""
    with engine.connect() as conn:
        values = {
            row[0]
            for row in conn.execute(
                text(
                    "SELECT value FROM vocab "
                    "WHERE category = 'person_identification_status' AND is_active = 1"
                )
            ).fetchall()
        }
    assert values == _EXPECTED_IDENTIFICATION_STATUS, (
        f"Values mismatch. Got: {values}"
    )


def test_person_identification_status_sort_order(engine):
    """Values must be ordered معروف=1, غير مكتمل=2, مجهول=3, يحتاج=4."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT value, sort_order FROM vocab "
                "WHERE category = 'person_identification_status' "
                "ORDER BY sort_order"
            )
        ).fetchall()
    values_in_order = [r[0] for r in rows]
    assert values_in_order == ["معروف", "غير مكتمل التعريف", "مجهول", "يحتاج إلى مراجعة"]


def test_seed_is_idempotent(engine):
    """Running seed_vocab twice does not create duplicate rows."""
    seed_vocab(engine)
    with engine.connect() as conn:
        count_before = conn.execute(text("SELECT COUNT(*) FROM vocab")).scalar_one()
    seed_vocab(engine)
    with engine.connect() as conn:
        count_after = conn.execute(text("SELECT COUNT(*) FROM vocab")).scalar_one()
    assert count_before == count_after, "seed_vocab must be idempotent"


def test_seed_constant_covers_all_active_categories():
    """VOCAB_SEED list contains at least one entry for every active category."""
    seeded_categories = {row[0] for row in VOCAB_SEED}
    assert _ACTIVE_CATEGORIES <= seeded_categories


def test_deactivated_categories_constant_is_correct():
    """DEACTIVATED_CATEGORIES constant matches expected set."""
    assert DEACTIVATED_CATEGORIES == _DEACTIVATED_CATEGORIES
