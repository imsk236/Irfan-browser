"""HTTP-level tests for /volumes and /volumes/repositories endpoints.

Covers routing, status codes, and response shape. Service-layer behaviour
(serial generation, concurrent allocation, etc.) is already tested in
test_volumes.py and test_repositories.py — no duplication here.

Scenario: a researcher registers the Muscat Royal Archive (place_key 0001),
adds a manuscript volume, edits it, and deletes it.
"""
import pytest
from src.services import volumes as svc


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def repo(session):
    return svc.create_repository(session, place_key="0001", name="خزانة مسقط الملكية")


@pytest.fixture
def volume(session, repo):
    return svc.create_volume(session, repo.id, folio_count=80, notes="مجلد اختبار")


# ── Repository list ───────────────────────────────────────────────────────────

def test_list_repositories_200(client, repo):
    r = client.get("/volumes/repositories")
    assert r.status_code == 200
    items = r.json()
    assert any(i["place_key"] == "0001" for i in items)
    assert all("id" in i and "place_key" in i and "name" in i for i in items)


def test_list_repositories_empty_200(client):
    """Empty archive returns an empty list, not 404."""
    r = client.get("/volumes/repositories")
    assert r.status_code == 200
    assert r.json() == []


# ── Volume GET ────────────────────────────────────────────────────────────────

def test_get_volume_200(client, volume):
    r = client.get(f"/volumes/{volume.id}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == volume.id
    assert data["serial"] == volume.serial
    assert data["folio_count"] == 80
    assert "repository_id" in data


def test_get_volume_404(client):
    r = client.get("/volumes/999999")
    assert r.status_code == 404
    detail = r.json()["detail"]
    # Error message should be in Arabic
    assert any(ord(c) > 0x600 for c in detail)


# ── next-document-number ──────────────────────────────────────────────────────

def test_next_document_number_fresh_repo(client, repo):
    r = client.get(f"/volumes/next-document-number?repository_id={repo.id}")
    assert r.status_code == 200
    assert r.json() == 1


def test_next_document_number_increments_after_create(client, repo):
    client.post("/volumes", json={"repository_id": repo.id})
    r = client.get(f"/volumes/next-document-number?repository_id={repo.id}")
    assert r.status_code == 200
    assert r.json() == 2


def test_next_document_number_404_unknown_repo(client):
    r = client.get("/volumes/next-document-number?repository_id=999999")
    assert r.status_code == 404


# ── Volume PATCH ──────────────────────────────────────────────────────────────

def test_patch_volume_folio_count(client, volume):
    r = client.patch(f"/volumes/{volume.id}", json={"folio_count": 250})
    assert r.status_code == 200
    assert r.json()["folio_count"] == 250


def test_patch_volume_serial_regenerates_on_repo_change(client, session, volume):
    repo2 = svc.create_repository(session, "0002", "خزانة صلالة")
    r = client.patch(f"/volumes/{volume.id}", json={"repository_id": repo2.id})
    assert r.status_code == 200
    assert r.json()["serial"].startswith("0002")


def test_patch_volume_404(client):
    r = client.patch("/volumes/999999", json={"folio_count": 10})
    assert r.status_code == 404


# ── Volume DELETE ─────────────────────────────────────────────────────────────

def test_delete_volume_204_no_dependents(client, repo):
    vol_r = client.post("/volumes", json={"repository_id": repo.id})
    vol_id = vol_r.json()["id"]
    r = client.delete(f"/volumes/{vol_id}")
    assert r.status_code == 204


def test_delete_volume_422_when_has_work(client, volume):
    client.post("/works", json={"volume_id": volume.id, "title": "رسالة في الأصول"})
    r = client.delete(f"/volumes/{volume.id}")
    assert r.status_code == 422
    assert any(ord(c) > 0x600 for c in r.json()["detail"])


def test_delete_volume_422_when_has_annotation_only(client, volume):
    """Volume with an annotation but no works is still blocked."""
    client.post("/annotations", json={
        "volume_id": volume.id,
        "annotation_type": "تملك",
    })
    r = client.delete(f"/volumes/{volume.id}")
    assert r.status_code == 422


def test_delete_volume_404(client):
    r = client.delete("/volumes/999999")
    assert r.status_code == 404
