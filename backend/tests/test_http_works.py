"""HTTP-level tests for /works endpoints.

Scenario: cataloguing a jurisprudence treatise inside a manuscript —
title, incipit, explicit, copy year. Service-layer logic is covered in
test_deletion.py; these tests verify routing and response shape only.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import annotations as ann_svc


@pytest.fixture
def scene(session):
    repo = vol_svc.create_repository(session, "1001", "خزانة الأعمال")
    vol = vol_svc.create_volume(session, repo.id, folio_count=120)
    work = work_svc.create_work(
        session, vol.id,
        title="رسالة في الأصول",
        incipit="بسم الله الرحمن الرحيم",
        copy_year=1200,
        copy_place="نزوى",
    )
    return {"vol": vol, "work": work}


# ── List works for volume ─────────────────────────────────────────────────────

def test_list_works_for_volume_200(client, scene):
    r = client.get(f"/works/by-volume/{scene['vol'].id}")
    assert r.status_code == 200
    works = r.json()
    assert any(w["title"] == "رسالة في الأصول" for w in works)
    assert all("id" in w and "volume_id" in w and "title" in w for w in works)


def test_list_works_for_empty_volume_returns_empty_list(client, session):
    """Volume with no works returns [] not 404."""
    repo = vol_svc.create_repository(session, "1002", "خزانة فارغة")
    vol = vol_svc.create_volume(session, repo.id)
    r = client.get(f"/works/by-volume/{vol.id}")
    assert r.status_code == 200
    assert r.json() == []


# ── Get single work ───────────────────────────────────────────────────────────

def test_get_work_200(client, scene):
    r = client.get(f"/works/{scene['work'].id}")
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "رسالة في الأصول"
    assert data["copy_year"] == 1200
    assert data["copy_place"] == "نزوى"
    assert data["incipit"] == "بسم الله الرحمن الرحيم"


def test_get_work_optional_fields_null_when_unset(client, session, scene):
    """Optional fields not supplied at creation come back as null."""
    plain = work_svc.create_work(session, scene["vol"].id, title="عنوان مجرد")
    r = client.get(f"/works/{plain.id}")
    assert r.status_code == 200
    data = r.json()
    assert data["copy_year"] is None
    assert data["explicit"] is None
    assert data["topic_category"] is None


def test_get_work_404(client):
    r = client.get("/works/999999")
    assert r.status_code == 404
    assert any(ord(c) > 0x600 for c in r.json()["detail"])


# ── PATCH work ────────────────────────────────────────────────────────────────

def test_patch_work_title(client, scene):
    r = client.patch(f"/works/{scene['work'].id}", json={"title": "رسالة مُحدَّثة"})
    assert r.status_code == 200
    assert r.json()["title"] == "رسالة مُحدَّثة"


def test_patch_work_set_copy_year(client, scene):
    """copy_year can be updated to a new value."""
    r = client.patch(f"/works/{scene['work'].id}", json={"copy_year": 1350})
    assert r.status_code == 200
    assert r.json()["copy_year"] == 1350


def test_patch_work_null_copy_year_is_noop(client, scene):
    """Sending null for copy_year has no effect (exclude_none=True in handler).

    The API uses exclude_none=True so null fields are ignored — only an explicit
    integer value changes the field.
    """
    client.patch(f"/works/{scene['work'].id}", json={"copy_year": 1350})
    # Sending null does NOT clear copy_year — it stays at 1350
    r = client.patch(f"/works/{scene['work'].id}", json={"copy_year": None})
    assert r.status_code == 200
    assert r.json()["copy_year"] == 1350


def test_patch_work_404(client):
    r = client.patch("/works/999999", json={"title": "لا يوجد"})
    assert r.status_code == 404


# ── DELETE work ───────────────────────────────────────────────────────────────

def test_delete_work_204_standalone(client, scene):
    new_w = client.post("/works", json={
        "volume_id": scene["vol"].id, "title": "عنوان مستقل",
    })
    r = client.delete(f"/works/{new_w.json()['id']}")
    assert r.status_code == 204


def test_delete_work_422_when_has_annotation(client, scene):
    """Work linked to an annotation cannot be deleted."""
    client.post("/annotations", json={
        "volume_id": scene["vol"].id,
        "work_id": scene["work"].id,
        "annotation_type": "وقف",
    })
    r = client.delete(f"/works/{scene['work'].id}")
    assert r.status_code == 422
    assert any(ord(c) > 0x600 for c in r.json()["detail"])
