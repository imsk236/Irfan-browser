"""HTTP-level tests for /relationships endpoints.

Scenario: linking ابن النضر as مؤلف of a jurisprudence work at work level,
and separately marking him as مالك at volume level. Tests verify routing,
response shape, and that both relationship levels route correctly.

Business-logic constraints (duplicate author, evidence scope, level invariant)
are tested in test_relationship_constraints.py.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import persons as person_svc
from src.services import annotations as ann_svc
from src.services import relationships as rel_svc


@pytest.fixture
def scene(session):
    repo = vol_svc.create_repository(session, "4001", "خزانة الروابط")
    vol = vol_svc.create_volume(session, repo.id)
    work = work_svc.create_work(session, vol.id, title="رسالة في الفقه")
    person = person_svc.create_person(session, preferred_name="ابن النضر البهلوي")
    ann = ann_svc.create_annotation(
        session, vol.id, "تملك", text_as_written="ملكه ابن النضر"
    )
    # One pre-existing volume-level relationship for the list test
    rel = rel_svc.link_person_to_volume(session, person.id, vol.id, role="مالك")
    return {
        "vol": vol,
        "work": work,
        "person": person,
        "ann": ann,
        "rel": rel,
    }


# ── List relationships for volume ─────────────────────────────────────────────

def test_list_relationships_for_volume_200(client, scene):
    r = client.get(f"/relationships/by-volume/{scene['vol'].id}")
    assert r.status_code == 200
    rels = r.json()
    assert len(rels) >= 1
    first = rels[0]
    assert "id" in first
    assert "level" in first
    assert "person_id" in first
    assert "role" in first


def test_list_relationships_includes_both_levels(client, scene):
    """Work-level and volume-level relationships both appear in the list."""
    client.post("/relationships", json={
        "person_id": scene["person"].id,
        "level": "work",
        "work_id": scene["work"].id,
        "role": "مؤلف",
    })
    r = client.get(f"/relationships/by-volume/{scene['vol'].id}")
    levels = {rel["level"] for rel in r.json()}
    assert "work" in levels
    assert "volume" in levels


# ── Create relationship — work level ──────────────────────────────────────────

def test_create_relationship_work_level_201(client, scene):
    r = client.post("/relationships", json={
        "person_id": scene["person"].id,
        "level": "work",
        "work_id": scene["work"].id,
        "role": "مؤلف",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["level"] == "work"
    assert data["role"] == "مؤلف"
    assert data["work_id"] == scene["work"].id
    assert data["volume_id"] is None


def test_create_relationship_work_level_with_evidence(client, scene):
    r = client.post("/relationships", json={
        "person_id": scene["person"].id,
        "level": "work",
        "work_id": scene["work"].id,
        "role": "ناسخ",
        "evidence_annotation_id": scene["ann"].id,
    })
    assert r.status_code == 201
    assert r.json()["evidence_annotation_id"] == scene["ann"].id


def test_create_relationship_work_level_missing_work_id_422(client, scene):
    r = client.post("/relationships", json={
        "person_id": scene["person"].id,
        "level": "work",
        "role": "مؤلف",
    })
    assert r.status_code == 422


# ── Create relationship — volume level ────────────────────────────────────────

def test_create_relationship_volume_level_201(client, scene):
    person2 = client.post("/persons", json={"preferred_name": "شخص آخر"}).json()
    r = client.post("/relationships", json={
        "person_id": person2["id"],
        "level": "volume",
        "volume_id": scene["vol"].id,
        "role": "مذكور",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["level"] == "volume"
    assert data["volume_id"] == scene["vol"].id
    assert data["work_id"] is None


# ── Validation errors ─────────────────────────────────────────────────────────

def test_create_relationship_invalid_level_422(client, scene):
    r = client.post("/relationships", json={
        "person_id": scene["person"].id,
        "level": "مستوى-مخترع",
        "volume_id": scene["vol"].id,
        "role": "مالك",
    })
    assert r.status_code == 422


def test_create_relationship_invalid_role_422(client, scene):
    r = client.post("/relationships", json={
        "person_id": scene["person"].id,
        "level": "volume",
        "volume_id": scene["vol"].id,
        "role": "دور-غير-موجود",
    })
    assert r.status_code == 422
    assert any(ord(c) > 0x600 for c in r.json()["detail"])


# ── DELETE relationship ────────────────────────────────────────────────────────

def test_delete_relationship_204(client, scene):
    r = client.delete(f"/relationships/{scene['rel'].id}")
    assert r.status_code == 204


def test_delete_relationship_404(client):
    r = client.delete("/relationships/999999")
    assert r.status_code == 404
