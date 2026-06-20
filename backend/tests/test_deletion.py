"""Tests for deletion safety guards (DATA-006).

Verifies that delete_volume, delete_work, and delete_annotation raise
Arabic ValueError when dependent historical records exist, and succeed
when no dependents are present.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import annotations as ann_svc
from src.services import relationships as rel_svc


@pytest.fixture
def populated(session):
    """Create a fully-populated hierarchy: repo → volume → work → annotation → relationship."""
    repo = vol_svc.create_repository(session, "7001", "خزانة الحذف")
    volume = vol_svc.create_volume(session, repo.id)
    work = work_svc.create_work(session, volume.id, title="عنوان اختبار")
    annotation = ann_svc.create_annotation(session, volume.id, "تملك")

    from src.services import persons as person_svc
    person = person_svc.create_person(session, preferred_name="شخص اختبار")
    rel = rel_svc.link_person_to_volume(
        session, person.id, volume.id, role="مالك", confidence="مؤكد"
    )

    return {
        "repo": repo,
        "volume": volume,
        "work": work,
        "annotation": annotation,
        "person": person,
        "rel": rel,
    }


# ── Annotation deletion ────────────────────────────────────────────────────


def test_delete_annotation_blocked_when_used_as_evidence(session, populated):
    """delete_annotation raises ValueError when annotation is cited as evidence."""
    vol = populated["volume"]
    annotation = populated["annotation"]
    person = populated["person"]

    rel_svc.link_person_to_volume(
        session,
        person.id,
        vol.id,
        role="مذكور",
        confidence="محتمل",
        evidence_annotation_id=annotation.id,
    )

    with pytest.raises(ValueError, match="دليلاً"):
        ann_svc.delete_annotation(session, annotation.id)


def test_delete_annotation_blocked_when_name_variant_source(session, populated):
    """delete_annotation raises ValueError when annotation is source for a name variant."""
    annotation = populated["annotation"]
    person = populated["person"]

    from src.services import persons as person_svc
    person_svc.add_name_variant(
        session,
        person.id,
        written_form="تهجئة بديلة",
        source_annotation_id=annotation.id,
    )

    with pytest.raises(ValueError, match="تهجئة"):
        ann_svc.delete_annotation(session, annotation.id)


def test_delete_annotation_succeeds_when_no_dependents(session, populated):
    """Annotation with no dependents can be deleted without error."""
    vol = populated["volume"]
    standalone = ann_svc.create_annotation(session, vol.id, "إهداء")
    ann_svc.delete_annotation(session, standalone.id)
    assert ann_svc.get_annotation(session, standalone.id) is None


def test_delete_nonexistent_annotation_raises(session):
    """delete_annotation raises ValueError for a non-existent ID."""
    with pytest.raises(ValueError, match="القيد غير موجود"):
        ann_svc.delete_annotation(session, 99999)


# ── Work deletion ─────────────────────────────────────────────────────────


def test_delete_work_blocked_when_has_annotations(session, populated):
    """delete_work raises ValueError when work has linked annotations."""
    work = populated["work"]
    vol = populated["volume"]
    ann_svc.create_annotation(session, vol.id, "وقف", work_id=work.id)

    with pytest.raises(ValueError, match="قيد"):
        work_svc.delete_work(session, work.id)


def test_delete_work_blocked_when_has_relationships(session, populated):
    """delete_work raises ValueError when work has person relationships."""
    work = populated["work"]
    person = populated["person"]
    rel_svc.link_person_to_work(session, person.id, work.id, role="مؤلف", confidence="مؤكد")

    with pytest.raises(ValueError, match="شخص"):
        work_svc.delete_work(session, work.id)


def test_delete_work_succeeds_when_no_dependents(session, populated):
    """Work with no dependents can be deleted without error."""
    vol = populated["volume"]
    standalone_work = work_svc.create_work(session, vol.id, title="عنوان مستقل")
    work_svc.delete_work(session, standalone_work.id)
    assert work_svc.get_work(session, standalone_work.id) is None


def test_delete_nonexistent_work_raises(session):
    """delete_work raises ValueError for a non-existent ID."""
    with pytest.raises(ValueError, match="العنوان غير موجود"):
        work_svc.delete_work(session, 99999)


# ── Volume deletion ────────────────────────────────────────────────────────


def test_delete_volume_blocked_when_has_works(session, populated):
    """delete_volume raises ValueError when volume has works."""
    volume = populated["volume"]
    with pytest.raises(ValueError, match="عنوان"):
        vol_svc.delete_volume(session, volume.id)


def test_delete_volume_blocked_when_has_annotations(session, populated):
    """delete_volume raises ValueError when volume has annotations (works removed first)."""
    volume = populated["volume"]
    work = populated["work"]

    # Remove the work's relationships first so we can delete the work
    rel = populated["rel"]
    session.delete(rel)
    session.commit()

    work_svc.delete_work(session, work.id)

    # Volume still has the standalone annotation from fixture
    with pytest.raises(ValueError, match="قيد"):
        vol_svc.delete_volume(session, volume.id)


def test_delete_volume_blocked_when_has_relationships(session):
    """delete_volume raises ValueError when volume has person relationships."""
    from src.services import persons as person_svc
    repo = vol_svc.create_repository(session, "7002", "خزانة ب")
    volume = vol_svc.create_volume(session, repo.id)
    person = person_svc.create_person(session, "شخص آخر")
    rel_svc.link_person_to_volume(
        session, person.id, volume.id, role="مالك", confidence="مؤكد"
    )

    with pytest.raises(ValueError, match="شخص"):
        vol_svc.delete_volume(session, volume.id)


def test_delete_volume_succeeds_when_no_dependents(session):
    """Volume with no dependents can be deleted."""
    repo = vol_svc.create_repository(session, "7003", "خزانة ت")
    volume = vol_svc.create_volume(session, repo.id)
    vol_svc.delete_volume(session, volume.id)
    assert vol_svc.get_volume(session, volume.id) is None


def test_delete_nonexistent_volume_raises(session):
    """delete_volume raises ValueError for a non-existent ID."""
    with pytest.raises(ValueError, match="المجلد غير موجود"):
        vol_svc.delete_volume(session, 99999)
