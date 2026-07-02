"""Tests that the API returns Arabic error messages for database conflicts.

Uses the FastAPI TestClient so the global IntegrityError handler is exercised.
"""
import pytest


def test_duplicate_place_key_returns_arabic_409(client):
    """Posting a duplicate place_key must return 409 with an Arabic message."""
    payload = {"place_key": "1001", "name": "خزانة أولى"}
    r1 = client.post("/volumes/repositories", json=payload)
    assert r1.status_code == 201

    r2 = client.post("/volumes/repositories", json=payload)
    assert r2.status_code == 409
    detail = r2.json()["detail"]
    assert "مفتاح" in detail, f"Expected Arabic message, got: {detail!r}"


def test_duplicate_place_key_message_is_not_english(client):
    """The 409 detail must not contain English SQLite error text."""
    payload = {"place_key": "1002", "name": "خزانة ثانية"}
    client.post("/volumes/repositories", json=payload)
    r = client.post("/volumes/repositories", json=payload)
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert "UNIQUE" not in detail, "Raw SQLite error leaked into response"
    assert "constraint" not in detail.lower(), "Raw SQLite error leaked"


def test_invalid_vocab_place_key_returns_422(client):
    """A non-four-digit place_key returns 422 with an Arabic message."""
    r = client.post("/volumes/repositories", json={"place_key": "AB12", "name": "ت"})
    assert r.status_code == 422
    assert "أرقام" in r.json()["detail"]


def test_custom_annotation_type_returns_201(client):
    """A custom (non-vocab) annotation_type is accepted as free text — see
    docs/adr/0002-annotation-type-role-free-text-other.md."""
    repo_r = client.post("/volumes/repositories", json={"place_key": "1004", "name": "م"})
    vol_r = client.post("/volumes", json={"repository_id": repo_r.json()["id"]})
    r = client.post(
        "/annotations",
        json={"volume_id": vol_r.json()["id"], "annotation_type": "نوع-مخترع"},
    )
    assert r.status_code == 201
    assert r.json()["annotation_type"] == "نوع-مخترع"


def test_custom_role_in_relationship_returns_201(client):
    """A custom (non-vocab) role is accepted as free text — see
    docs/adr/0002-annotation-type-role-free-text-other.md."""
    repo_r = client.post("/volumes/repositories", json={"place_key": "1005", "name": "م"})
    vol_r = client.post("/volumes", json={"repository_id": repo_r.json()["id"]})
    person_r = client.post("/persons", json={"preferred_name": "شخص"})
    r = client.post(
        "/relationships",
        json={
            "person_id": person_r.json()["id"],
            "level": "volume",
            "volume_id": vol_r.json()["id"],
            "role": "دور-مخترع",
        },
    )
    assert r.status_code == 201
    assert r.json()["role"] == "دور-مخترع"


