"""Tests that DELETE endpoints return 404 for non-existent resource IDs (API-006).

Uses the FastAPI TestClient so route-level exception handling is exercised.
"""
import pytest


# ── Volumes ───────────────────────────────────────────────────────────────────

def test_delete_nonexistent_volume_returns_404(client):
    r = client.delete("/volumes/99999")
    assert r.status_code == 404
    assert "المجلد" in r.json()["detail"]


def test_delete_nonexistent_work_returns_404(client):
    r = client.delete("/works/99999")
    assert r.status_code == 404
    assert "العنوان" in r.json()["detail"]


def test_delete_nonexistent_annotation_returns_404(client):
    r = client.delete("/annotations/99999")
    assert r.status_code == 404
    assert "القيد" in r.json()["detail"]


def test_delete_nonexistent_repository_returns_404(client):
    r = client.delete("/volumes/repositories/99999")
    assert r.status_code == 404
    assert "الخزانة" in r.json()["detail"]


def test_delete_nonexistent_relationship_returns_404(client):
    r = client.delete("/relationships/99999")
    assert r.status_code == 404
    assert "الربط" in r.json()["detail"]


# ── Volumes with dependents still return 422, not 404 ────────────────────────

def test_delete_volume_with_work_returns_422(client):
    """Deleting a volume that has works must return 422 (business rule), not 404."""
    repo_r = client.post("/volumes/repositories", json={"place_key": "7001", "name": "خزانة"})
    vol_r = client.post("/volumes", json={"repository_id": repo_r.json()["id"]})
    client.post("/works", json={"volume_id": vol_r.json()["id"], "title": "عنوان"})

    r = client.delete(f"/volumes/{vol_r.json()['id']}")
    assert r.status_code == 422
    assert "عنوان" in r.json()["detail"]
