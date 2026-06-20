"""Tests for the person archive appearances endpoint (API-002).

Service-layer tests that verify the appearances response contains the required
fields for the frontend مواضع ظهور الشخص في الأرشيف section.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import annotations as ann_svc
from src.services import persons as person_svc
from src.services import relationships as rel_svc
from src.services.trace import trace_scholar


@pytest.fixture
def archive_scene(session):
    """Create a minimal archive scene: repo → volume → work + annotation → person + relationships."""
    repo = vol_svc.create_repository(session, "8001", "خزانة الظهور")
    volume = vol_svc.create_volume(session, repo.id)
    work = work_svc.create_work(session, volume.id, title="عنوان ظهور")
    annotation = ann_svc.create_annotation(
        session, volume.id, "تملك", text_as_written="ملكه فلان"
    )
    person = person_svc.create_person(session, preferred_name="ابن الاختبار")

    # Work-level relationship with evidence annotation
    work_rel = rel_svc.link_person_to_work(
        session, person.id, work.id, role="مؤلف", confidence="مؤكد",
        evidence_annotation_id=annotation.id,
    )
    # Volume-level relationship without evidence
    vol_rel = rel_svc.link_person_to_volume(
        session, person.id, volume.id, role="مالك", confidence="مرجح",
    )

    return {
        "person": person,
        "volume": volume,
        "work": work,
        "annotation": annotation,
        "work_rel": work_rel,
        "vol_rel": vol_rel,
    }


def test_appearances_returns_list(session, archive_scene):
    person = archive_scene["person"]
    results = trace_scholar(session, person.id)
    assert isinstance(results, list)
    assert len(results) == 2


def test_appearances_include_serial(session, archive_scene):
    person = archive_scene["person"]
    volume = archive_scene["volume"]
    results = trace_scholar(session, person.id)
    serials = [r.serial for r in results]
    assert volume.serial in serials


def test_appearances_include_role(session, archive_scene):
    person = archive_scene["person"]
    results = trace_scholar(session, person.id)
    roles = {r.role for r in results}
    assert "مؤلف" in roles
    assert "مالك" in roles


def test_appearances_include_work_title(session, archive_scene):
    person = archive_scene["person"]
    work = archive_scene["work"]
    results = trace_scholar(session, person.id)
    work_rel_results = [r for r in results if r.level == "work"]
    assert len(work_rel_results) == 1
    assert work_rel_results[0].work_title == work.title


def test_appearances_include_confidence(session, archive_scene):
    person = archive_scene["person"]
    results = trace_scholar(session, person.id)
    confidences = {r.confidence for r in results}
    assert "مؤكد" in confidences
    assert "مرجح" in confidences


def test_appearances_include_evidence_annotation_type(session, archive_scene):
    """The evidence annotation's type is included so the frontend can label it."""
    person = archive_scene["person"]
    annotation = archive_scene["annotation"]
    results = trace_scholar(session, person.id)
    work_rels = [r for r in results if r.evidence_annotation_id == annotation.id]
    assert len(work_rels) == 1
    assert work_rels[0].evidence_annotation_type == annotation.annotation_type


def test_appearances_include_evidence_text(session, archive_scene):
    """The evidence text preview is included for the frontend side panel."""
    person = archive_scene["person"]
    annotation = archive_scene["annotation"]
    results = trace_scholar(session, person.id)
    work_rels = [r for r in results if r.evidence_annotation_id == annotation.id]
    assert work_rels[0].evidence_text == annotation.text_as_written


def test_appearances_sorted_by_role_then_serial(session, archive_scene):
    """Results are sorted by role then serial for predictable grouped display."""
    person = archive_scene["person"]
    results = trace_scholar(session, person.id)
    pairs = [(r.role, r.serial) for r in results]
    assert pairs == sorted(pairs)


def test_appearances_empty_for_unknown_person(session):
    """A person with no relationships returns an empty list."""
    person = person_svc.create_person(session, "شخص بلا روابط")
    results = trace_scholar(session, person.id)
    assert results == []


def test_appearances_via_http(client):
    """GET /persons/{id}/appearances returns 200 with a list."""
    repo_r = client.post("/volumes/repositories", json={"place_key": "8002", "name": "خزانة"})
    vol_r = client.post("/volumes", json={"repository_id": repo_r.json()["id"]})
    person_r = client.post("/persons", json={"preferred_name": "شخص HTTP"})
    client.post("/relationships", json={
        "person_id": person_r.json()["id"],
        "level": "volume",
        "volume_id": vol_r.json()["id"],
        "role": "مالك",
        "confidence": "مؤكد",
    })

    person_id = person_r.json()["id"]
    r = client.get(f"/persons/{person_id}/appearances")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    item = items[0]
    assert item["role"] == "مالك"
    assert item["serial"] == vol_r.json()["serial"]
    assert "evidence_annotation_type" in item
    assert "confidence" in item
