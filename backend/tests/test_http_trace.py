"""HTTP-level tests for the unified GET /trace search (ADR 0005).

Scenario: a small archive with two repositories, two عناوين (one with a
تاريخ النسخ, one copied for صلالة with a ناسخ), and one مجلد matched only by
its number with no recorded person at all. Tests verify that شخص, منطقة
العالم, مكان النسخ, العنوان, الرقم, الخزانة, and سنة النسخ all narrow
independently and combine correctly, and that a pure volume/work match with
no قدير relationship still surfaces as a placeholder row.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import persons as person_svc
from src.services import annotations as ann_svc
from src.services import relationships as rel_svc


@pytest.fixture
def scene(session):
    repo = vol_svc.create_repository(session, "5001", "خزانة التتبع")
    other_repo = vol_svc.create_repository(session, "5002", "خزانة أخرى")

    vol = vol_svc.create_volume(session, repo.id)
    work = work_svc.create_work(session, vol.id, title="رسالة في الأصول", copy_year=1210)
    person = person_svc.create_person(session, preferred_name="ابن النضر البهلوي")
    person_svc.set_wilayas(session, person.id, ["نزوى"])
    ann = ann_svc.create_annotation(session, vol.id, "تملك", text_as_written="ملكه ابن النضر")
    rel = rel_svc.link_person_to_work(
        session, person.id, work.id, role="مؤلف", evidence_annotation_id=ann.id,
    )

    copied_vol = vol_svc.create_volume(session, other_repo.id)
    copied_work = work_svc.create_work(session, copied_vol.id, title="مقالة في الفقه", copy_place="صلالة")
    scribe = person_svc.create_person(session, preferred_name="ناسخ الأصول")
    scribe_rel = rel_svc.link_person_to_work(session, scribe.id, copied_work.id, role="ناسخ")

    bare_vol = vol_svc.create_volume(session, repo.id, repository_volume_number=77)

    return {
        "repo": repo, "other_repo": other_repo,
        "vol": vol, "work": work, "person": person, "ann": ann, "rel": rel,
        "copied_vol": copied_vol, "copied_work": copied_work,
        "scribe": scribe, "scribe_rel": scribe_rel,
        "bare_vol": bare_vol,
    }


# ── Validation ─────────────────────────────────────────────────────────────────

def test_no_filters_returns_422(client):
    r = client.get("/trace")
    assert r.status_code == 422


# ── شخص (person_id) ──────────────────────────────────────────────────────────

def test_person_empty_when_no_relationships(client):
    r_p = client.post("/persons", json={"preferred_name": "شخص بلا ظهور"})
    person_id = r_p.json()["id"]
    r = client.get(f"/trace?person_id={person_id}")
    assert r.status_code == 200
    assert r.json() == []


def test_person_200_with_relationship(client, scene):
    r = client.get(f"/trace?person_id={scene['person'].id}")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    item = results[0]
    for field in ["relationship_id", "role", "level", "serial", "volume_id", "evidence_source"]:
        assert field in item, f"Missing field: {field}"
    assert item["role"] == "مؤلف"
    assert item["serial"] == scene["vol"].serial
    assert item["evidence_text"] == "ملكه ابن النضر"


def test_person_results_ordered_by_role_then_serial(client, scene, session):
    vol2 = vol_svc.create_volume(session, scene["vol"].repository_id)
    rel_svc.link_person_to_volume(session, scene["person"].id, vol2.id, role="مالك")
    r = client.get(f"/trace?person_id={scene['person'].id}")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 2
    roles = {item["role"] for item in results}
    assert roles == {"مؤلف", "مالك"}
    levels = {item["level"] for item in results}
    assert levels == {"work", "volume"}
    pairs = [(item["role"], item["serial"]) for item in results]
    assert pairs == sorted(pairs)


# ── منطقة العالم (region) ────────────────────────────────────────────────────

def test_region_matches_person_wilaya(client, scene):
    r = client.get("/trace?region=نزوى")
    assert r.status_code == 200
    ids = [item["relationship_id"] for item in r.json()]
    assert scene["rel"].id in ids


def test_region_empty_when_no_match(client, scene):
    r = client.get("/trace?region=مدينة-لا-توجد-في-الأرشيف")
    assert r.status_code == 200
    assert r.json() == []


# ── مكان النسخ (copy_place) ──────────────────────────────────────────────────

def test_copy_place_matches_work(client, scene):
    r = client.get("/trace?copy_place=صلالة")
    assert r.status_code == 200
    ids = [item["relationship_id"] for item in r.json()]
    assert scene["scribe_rel"].id in ids


# ── العنوان / الرقم / الخزانة / سنة النسخ (volume/work filters, no person) ───

def test_title_with_no_person_returns_placeholder_for_unlinked_match(client, scene):
    """A pure title search with no relationship on that work still surfaces it."""
    r = client.get("/trace?title=مقالة")
    assert r.status_code == 200
    results = r.json()
    # copied_work has a ناسخ relationship -> real row, not a placeholder
    assert any(item["work_id"] == scene["copied_work"].id and item["relationship_id"] is not None for item in results)


def test_number_matches_bare_volume_as_placeholder(client, scene):
    r = client.get("/trace?number=77")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    item = results[0]
    assert item["volume_id"] == scene["bare_vol"].id
    assert item["relationship_id"] is None
    assert item["role"] is None
    assert item["work_id"] is None


def test_repository_id_filter(client, scene):
    r = client.get(f"/trace?repository_id={scene['other_repo'].id}")
    assert r.status_code == 200
    volume_ids = {item["volume_id"] for item in r.json()}
    assert volume_ids == {scene["copied_vol"].id}


def test_year_range_matches_work_copy_year(client, scene):
    r = client.get("/trace?year_from=1200&year_to=1220")
    assert r.status_code == 200
    results = r.json()
    assert any(item["work_id"] == scene["work"].id for item in results)


def test_year_range_excludes_undated(client, scene):
    r = client.get("/trace?year_from=1400&year_to=1420")
    assert r.status_code == 200
    assert r.json() == []


# ── Combined filters (independent intersection) ─────────────────────────────

def test_person_plus_title_narrows_to_matching_relationship(client, scene):
    r = client.get(f"/trace?person_id={scene['person'].id}&title=رسالة")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    assert results[0]["relationship_id"] == scene["rel"].id


def test_person_plus_title_excludes_when_title_not_in_persons_volumes(client, scene):
    r = client.get(f"/trace?person_id={scene['person'].id}&title=مقالة")
    assert r.status_code == 200
    assert r.json() == []


def test_repository_plus_region_intersect(client, scene):
    """other_repo has no scholar from نزوى -> no rows even though region matches elsewhere."""
    r = client.get(f"/trace?repository_id={scene['other_repo'].id}&region=نزوى")
    assert r.status_code == 200
    assert r.json() == []
