"""HTTP-level tests for /trace endpoints.

Scenario: tracing all appearances of ابن النضر across the archive, then
exploring the مسقط wilaya to see its scholars, manuscript copies, and
repositories. Tests verify routing, status codes, and the shape of both
trace endpoints.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import persons as person_svc
from src.services import annotations as ann_svc
from src.services import relationships as rel_svc


@pytest.fixture
def scene(session):
    """Minimal archive: one scholar linked as مؤلف to one work."""
    repo = vol_svc.create_repository(session, "5001", "خزانة التتبع")
    vol = vol_svc.create_volume(session, repo.id)
    work = work_svc.create_work(session, vol.id, title="رسالة في الأصول")
    person = person_svc.create_person(session, preferred_name="ابن النضر البهلوي")
    ann = ann_svc.create_annotation(
        session, vol.id, "تملك", text_as_written="ملكه ابن النضر"
    )
    rel = rel_svc.link_person_to_work(
        session, person.id, work.id, role="مؤلف",
        evidence_annotation_id=ann.id,
    )
    return {
        "vol": vol, "work": work, "person": person,
        "ann": ann, "rel": rel,
    }


# ── GET /trace/{person_id} ────────────────────────────────────────────────────

def test_trace_person_empty_when_no_relationships(client):
    """A person with no relationships returns an empty list."""
    r_p = client.post("/persons", json={"preferred_name": "شخص بلا ظهور"})
    person_id = r_p.json()["id"]
    r = client.get(f"/trace/{person_id}")
    assert r.status_code == 200
    assert r.json() == []


def test_trace_person_200_with_relationship(client, scene):
    r = client.get(f"/trace/{scene['person'].id}")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    item = results[0]
    # All required TraceResultOut fields present
    for field in [
        "relationship_id", "role", "level", "serial",
        "evidence_annotation_type", "evidence_source",
    ]:
        assert field in item, f"Missing field: {field}"
    assert item["role"] == "مؤلف"
    assert item["serial"] == scene["vol"].serial


def test_trace_person_includes_evidence_text(client, scene):
    r = client.get(f"/trace/{scene['person'].id}")
    item = r.json()[0]
    assert item["evidence_text"] == "ملكه ابن النضر"
    assert item["evidence_annotation_type"] == "تملك"


def test_trace_person_results_ordered_by_role_then_serial(client, scene, session):
    """Add a second volume-level relationship; results must stay sorted."""
    vol2 = vol_svc.create_volume(session, scene["vol"].repository_id)
    rel_svc.link_person_to_volume(
        session, scene["person"].id, vol2.id, role="مالك"
    )
    r = client.get(f"/trace/{scene['person'].id}")
    assert r.status_code == 200
    pairs = [(item["role"], item["serial"]) for item in r.json()]
    assert pairs == sorted(pairs)


# ── GET /trace/wilaya ─────────────────────────────────────────────────────────

def test_trace_wilaya_200_structure(client):
    r = client.get("/trace/wilaya?name=مسقط")
    assert r.status_code == 200
    data = r.json()
    assert "scholars" in data
    assert "copies" in data
    assert "repositories" in data


def test_trace_wilaya_empty_when_no_data(client):
    """Wilaya with no linked persons, copies, or repos returns empty arrays."""
    r = client.get("/trace/wilaya?name=مدينة-لا-توجد-في-الأرشيف")
    assert r.status_code == 200
    data = r.json()
    assert data["scholars"] == []
    assert data["copies"] == []
    assert data["repositories"] == []


def test_trace_wilaya_scholars_after_person_wilaya_set(client, scene, session):
    """Scholar appears in wilaya trace after their wilaya is set."""
    person_svc.set_wilayas(session, scene["person"].id, ["مسقط"])
    r = client.get("/trace/wilaya?name=مسقط")
    assert r.status_code == 200
    scholars = r.json()["scholars"]
    assert any(s["person_id"] == scene["person"].id for s in scholars)
    # appearance_count must be a non-negative integer
    for s in scholars:
        assert isinstance(s["appearance_count"], int)
        assert s["appearance_count"] >= 0


def test_trace_wilaya_copies_after_work_copy_place_set(client, scene, session):
    """Work with copy_place matching the wilaya appears in copies."""
    from src.services import works as work_svc
    work_svc.update_work(session, scene["work"].id, copy_place="صلالة")
    # Link a ناسخ so the copier_name can be populated
    scribe = person_svc.create_person(session, preferred_name="ناسخ الأصول")
    rel_svc.link_person_to_work(session, scribe.id, scene["work"].id, role="ناسخ")
    r = client.get("/trace/wilaya?name=صلالة")
    assert r.status_code == 200
    copies = r.json()["copies"]
    assert any(c["work_id"] == scene["work"].id for c in copies)
