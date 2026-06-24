"""HTTP-level tests for /annotations endpoints.

Scenario: a manuscript carries a وقف inscription linked to a specific
work, plus a standalone ownership stamp with no work link. Tests cover
routing, status codes, response shape, and the PATCH endpoint which has
no service-layer test yet.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import annotations as ann_svc
from src.services import persons as person_svc
from src.services import relationships as rel_svc


@pytest.fixture
def scene(session):
    repo = vol_svc.create_repository(session, "2001", "خزانة القيود")
    vol = vol_svc.create_volume(session, repo.id, folio_count=60)
    work = work_svc.create_work(session, vol.id, title="رسالة الوقف")
    # Annotation linked to a work
    waqf = ann_svc.create_annotation(
        session, vol.id, "وقف",
        work_id=work.id,
        text_as_written="وقف هذا الكتاب على طلاب العلم",
    )
    # Standalone ownership annotation (no work link)
    milkiyya = ann_svc.create_annotation(
        session, vol.id, "تملك",
        text_as_written="ملكه محمد بن عبدالله",
    )
    return {"vol": vol, "work": work, "waqf": waqf, "milkiyya": milkiyya}


# ── List annotations for volume ───────────────────────────────────────────────

def test_list_annotations_for_volume_200(client, scene):
    r = client.get(f"/annotations/by-volume/{scene['vol'].id}")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2
    types = {i["annotation_type"] for i in items}
    assert types == {"وقف", "تملك"}


def test_list_annotations_work_id_null_for_standalone(client, scene):
    """The standalone تملك annotation must have work_id = null."""
    r = client.get(f"/annotations/by-volume/{scene['vol'].id}")
    assert r.status_code == 200
    milkiyya = next(i for i in r.json() if i["annotation_type"] == "تملك")
    assert milkiyya["work_id"] is None


def test_list_annotations_empty_volume_returns_empty(client, session):
    repo = vol_svc.create_repository(session, "2002", "خزانة فارغة")
    vol = vol_svc.create_volume(session, repo.id)
    r = client.get(f"/annotations/by-volume/{vol.id}")
    assert r.status_code == 200
    assert r.json() == []


# ── Get single annotation ─────────────────────────────────────────────────────

def test_get_annotation_200(client, scene):
    r = client.get(f"/annotations/{scene['waqf'].id}")
    assert r.status_code == 200
    data = r.json()
    assert data["annotation_type"] == "وقف"
    assert data["text_as_written"] == "وقف هذا الكتاب على طلاب العلم"
    assert data["work_id"] == scene["work"].id
    assert "image_location" in data
    assert "notes" in data


def test_get_annotation_404(client):
    r = client.get("/annotations/999999")
    assert r.status_code == 404
    assert any(ord(c) > 0x600 for c in r.json()["detail"])


# ── PATCH annotation ──────────────────────────────────────────────────────────

def test_patch_annotation_type(client, scene):
    """Change annotation type from تملك to إهداء (both seeded)."""
    r = client.patch(
        f"/annotations/{scene['milkiyya'].id}",
        json={"annotation_type": "إهداء"},
    )
    assert r.status_code == 200
    assert r.json()["annotation_type"] == "إهداء"


def test_patch_annotation_text(client, scene):
    r = client.patch(
        f"/annotations/{scene['milkiyya'].id}",
        json={"text_as_written": "ملكه سعيد بن خلفان السيابي"},
    )
    assert r.status_code == 200
    assert r.json()["text_as_written"] == "ملكه سعيد بن خلفان السيابي"


def test_patch_annotation_link_work(client, scene):
    """A standalone annotation can be linked to a work retroactively."""
    r = client.patch(
        f"/annotations/{scene['milkiyya'].id}",
        json={"work_id": scene["work"].id},
    )
    assert r.status_code == 200
    assert r.json()["work_id"] == scene["work"].id


def test_patch_annotation_null_work_id_is_noop(client, scene):
    """Sending null for work_id has no effect (exclude_none=True in handler).

    The API uses exclude_none=True so null fields are ignored. Once a
    work link is set it can only be changed to another work_id, not cleared.
    """
    r = client.patch(
        f"/annotations/{scene['waqf'].id}",
        json={"work_id": None},
    )
    assert r.status_code == 200
    # work_id is unchanged — still linked to the original work
    assert r.json()["work_id"] == scene["work"].id


def test_patch_annotation_invalid_type_422(client, scene):
    """Annotation type not in vocab is rejected."""
    r = client.patch(
        f"/annotations/{scene['milkiyya'].id}",
        json={"annotation_type": "نوع-مخترع-بالكلية"},
    )
    assert r.status_code == 422


def test_patch_annotation_404(client):
    r = client.patch("/annotations/999999", json={"annotation_type": "تملك"})
    assert r.status_code == 404


# ── DELETE annotation ─────────────────────────────────────────────────────────

def test_delete_annotation_204_standalone(client, session, scene):
    extra = ann_svc.create_annotation(session, scene["vol"].id, "إهداء")
    r = client.delete(f"/annotations/{extra.id}")
    assert r.status_code == 204


def test_delete_annotation_422_when_used_as_evidence(client, session, scene):
    """Annotation cited as evidence for a relationship cannot be deleted."""
    person = person_svc.create_person(session, preferred_name="ابن النضر")
    rel_svc.link_person_to_volume(
        session, person.id, scene["vol"].id,
        role="مالك",
        evidence_annotation_id=scene["milkiyya"].id,
    )
    r = client.delete(f"/annotations/{scene['milkiyya'].id}")
    assert r.status_code == 422
    assert any(ord(c) > 0x600 for c in r.json()["detail"])
