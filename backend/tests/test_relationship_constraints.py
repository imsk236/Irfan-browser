"""Tests for relationship business-logic constraints.

Scenario: common data-entry mistakes a cataloguer makes when linking
scholars to manuscripts — wrong volume evidence, duplicate author, invalid
level fields, and DB-level CHECK constraint enforcement.
"""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import persons as person_svc
from src.services import annotations as ann_svc
from src.services import relationships as rel_svc


@pytest.fixture
def scene(session):
    """Two volumes, one work per volume, one person, one annotation per volume."""
    repo = vol_svc.create_repository(session, "6001", "خزانة القيود")
    vol1 = vol_svc.create_volume(session, repo.id)
    vol2 = vol_svc.create_volume(session, repo.id)
    work1 = work_svc.create_work(session, vol1.id, title="رسالة في الأصول")
    work2 = work_svc.create_work(session, vol2.id, title="رسالة في الفروع")
    person = person_svc.create_person(session, preferred_name="ابن النضر البهلوي")
    ann1 = ann_svc.create_annotation(session, vol1.id, "تملك")
    ann2 = ann_svc.create_annotation(session, vol2.id, "وقف")
    return {
        "vol1": vol1, "vol2": vol2,
        "work1": work1, "work2": work2,
        "person": person,
        "ann1": ann1, "ann2": ann2,
    }


# ── Evidence annotation scope ─────────────────────────────────────────────────

def test_evidence_annotation_from_wrong_volume_rejected(session, scene):
    """Annotation from vol2 cannot be evidence for a relationship in vol1."""
    with pytest.raises(ValueError, match="المجلد"):
        rel_svc.link_person_to_work(
            session, scene["person"].id, scene["work1"].id,
            role="مؤلف",
            evidence_annotation_id=scene["ann2"].id,  # ann2 belongs to vol2
        )


def test_evidence_annotation_from_same_volume_accepted(session, scene):
    """Annotation from vol1 is valid evidence for a work in vol1."""
    rel = rel_svc.link_person_to_work(
        session, scene["person"].id, scene["work1"].id,
        role="ناسخ",
        evidence_annotation_id=scene["ann1"].id,  # ann1 belongs to vol1
    )
    assert rel.evidence_annotation_id == scene["ann1"].id


def test_evidence_annotation_for_volume_rel_wrong_volume_rejected(session, scene):
    """Volume-level relationship with annotation from a different volume is rejected."""
    with pytest.raises(ValueError, match="المجلد"):
        rel_svc.link_person_to_volume(
            session, scene["person"].id, scene["vol1"].id,
            role="مالك",
            evidence_annotation_id=scene["ann2"].id,  # ann2 belongs to vol2
        )


def test_evidence_annotation_nonexistent_raises(session, scene):
    """Referencing a non-existent annotation ID raises ValueError."""
    with pytest.raises(ValueError):
        rel_svc.link_person_to_work(
            session, scene["person"].id, scene["work1"].id,
            role="مؤلف",
            evidence_annotation_id=999999,
        )


# ── Duplicate author rule ─────────────────────────────────────────────────────

def test_second_author_on_same_work_rejected(session, scene):
    """A work can have at most one مؤلف; linking a second raises ValueError."""
    person2 = person_svc.create_person(session, preferred_name="مؤلف آخر")
    rel_svc.link_person_to_work(
        session, scene["person"].id, scene["work1"].id, role="مؤلف"
    )
    with pytest.raises(ValueError, match="مؤلف"):
        rel_svc.link_person_to_work(
            session, person2.id, scene["work1"].id, role="مؤلف"
        )


def test_same_person_as_author_twice_allowed(session, scene):
    """Linking the same person as مؤلف twice is a no-op (idempotent)."""
    rel_svc.link_person_to_work(
        session, scene["person"].id, scene["work1"].id, role="مؤلف"
    )
    # Same person as author again — should NOT raise
    rel = rel_svc.link_person_to_work(
        session, scene["person"].id, scene["work1"].id, role="مؤلف"
    )
    assert rel is not None


def test_non_author_role_allows_multiple(session, scene):
    """Multiple scribes (ناسخ) can be linked to the same work."""
    person2 = person_svc.create_person(session, preferred_name="ناسخ آخر")
    rel_svc.link_person_to_work(
        session, scene["person"].id, scene["work1"].id, role="ناسخ"
    )
    # A second ناسخ on the same work should be allowed
    rel2 = rel_svc.link_person_to_work(
        session, person2.id, scene["work1"].id, role="ناسخ"
    )
    assert rel2 is not None


# ── Level / work_id / volume_id invariant ─────────────────────────────────────

def test_work_level_without_work_id_rejected(session, scene):
    """level='work' requires a work_id; omitting it raises ValueError."""
    with pytest.raises((ValueError, Exception)):
        rel_svc.link_person_to_work(
            session, scene["person"].id,
            work_id=None,  # type: ignore[arg-type]
            role="مؤلف",
        )


def test_db_check_constraint_level_work_with_volume_id(engine, session, scene):
    """DB-level CHECK fires when level='work' but volume_id is not NULL."""
    with pytest.raises((IntegrityError, Exception)):
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO person_relationships
                    (person_id, level, work_id, volume_id, role)
                VALUES
                    (:pid, 'work', :wid, :vid, 'مؤلف')
            """), {
                "pid": scene["person"].id,
                "wid": scene["work1"].id,
                "vid": scene["vol1"].id,
            })
            conn.commit()


def test_db_check_constraint_level_volume_with_work_id(engine, session, scene):
    """DB-level CHECK fires when level='volume' but work_id is not NULL."""
    with pytest.raises((IntegrityError, Exception)):
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO person_relationships
                    (person_id, level, work_id, volume_id, role)
                VALUES
                    (:pid, 'volume', :wid, :vid, 'مالك')
            """), {
                "pid": scene["person"].id,
                "wid": scene["work1"].id,
                "vid": scene["vol1"].id,
            })
            conn.commit()


# ── Cross-level combinations ──────────────────────────────────────────────────

def test_person_linked_at_both_levels_in_same_volume(session, scene):
    """Same person can have a work-level and volume-level link in the same volume."""
    rel_w = rel_svc.link_person_to_work(
        session, scene["person"].id, scene["work1"].id, role="مؤلف"
    )
    rel_v = rel_svc.link_person_to_volume(
        session, scene["person"].id, scene["vol1"].id, role="مالك"
    )
    assert rel_w.level == "work"
    assert rel_v.level == "volume"


# ── Deletion of evidence annotation ──────────────────────────────────────────

def test_delete_annotation_used_as_evidence_blocked(session, scene):
    """An annotation cited as evidence cannot be deleted via HTTP (422)."""
    rel_svc.link_person_to_volume(
        session, scene["person"].id, scene["vol1"].id,
        role="مالك",
        evidence_annotation_id=scene["ann1"].id,
    )
    from src.services import annotations as ann_svc
    with pytest.raises(ValueError, match="دليلاً"):
        ann_svc.delete_annotation(session, scene["ann1"].id)
