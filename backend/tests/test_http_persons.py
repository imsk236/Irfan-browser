"""HTTP-level tests for /persons endpoints.

Scenario: entering scholar ابن النضر البهلوي, assigning him to Omani wilayas,
adding name variants from different manuscript hands, and deleting a
temporary entry. Tests cover routing, status codes, and response shape.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import persons as person_svc
from src.services import relationships as rel_svc


@pytest.fixture
def person(session):
    return person_svc.create_person(
        session,
        preferred_name="ابن النضر البهلوي",
        kunya="أبو عبدالله",
        laqab="العلامة",
        birth_place="نزوى",
    )


@pytest.fixture
def person_with_rel(session):
    """Person who has a relationship — cannot be deleted."""
    repo = vol_svc.create_repository(session, "3001", "خزانة الاختبار")
    vol = vol_svc.create_volume(session, repo.id)
    p = person_svc.create_person(session, preferred_name="مرتبط بمخطوطة")
    rel_svc.link_person_to_volume(session, p.id, vol.id, role="مالك")
    return p


# ── GET person ────────────────────────────────────────────────────────────────

def test_get_person_200(client, person):
    r = client.get(f"/persons/{person.id}")
    assert r.status_code == 200
    data = r.json()
    assert data["preferred_name"] == "ابن النضر البهلوي"
    assert data["kunya"] == "أبو عبدالله"
    assert data["laqab"] == "العلامة"
    assert data["birth_place"] == "نزوى"
    assert "wilayas" in data
    assert isinstance(data["wilayas"], list)


def test_get_person_404(client):
    r = client.get("/persons/999999")
    assert r.status_code == 404
    assert any(ord(c) > 0x600 for c in r.json()["detail"])


# ── PATCH person ──────────────────────────────────────────────────────────────

def test_patch_person_birth_place(client, person):
    r = client.patch(f"/persons/{person.id}", json={"birth_place": "مسقط"})
    assert r.status_code == 200
    assert r.json()["birth_place"] == "مسقط"


def test_patch_person_preferred_name_creates_variant(client, person):
    """Changing preferred_name keeps the old name as a variant."""
    r = client.patch(
        f"/persons/{person.id}",
        json={"preferred_name": "النضر البهلوي"},
    )
    assert r.status_code == 200
    assert r.json()["preferred_name"] == "النضر البهلوي"

    variants_r = client.get(f"/persons/{person.id}/variants")
    forms = [v["written_form"] for v in variants_r.json()]
    assert "ابن النضر البهلوي" in forms


def test_patch_person_null_field_is_noop(client, person):
    """Sending null for a field has no effect (exclude_none=True in handler).

    The API uses exclude_none=True so null values are ignored — only an
    explicit non-null value overwrites an existing field.
    """
    r = client.patch(f"/persons/{person.id}", json={"birth_place": None})
    assert r.status_code == 200
    # birth_place is unchanged — still set to نزوى from the fixture
    assert r.json()["birth_place"] == "نزوى"


def test_patch_person_404(client):
    r = client.patch("/persons/999999", json={"birth_place": "مسقط"})
    assert r.status_code == 404


# ── DELETE person ─────────────────────────────────────────────────────────────

def test_delete_person_204_orphan(client):
    r_p = client.post("/persons", json={"preferred_name": "شخص مؤقت"})
    r = client.delete(f"/persons/{r_p.json()['id']}")
    assert r.status_code == 204


def test_delete_person_422_when_has_relationship(client, person_with_rel):
    r = client.delete(f"/persons/{person_with_rel.id}")
    assert r.status_code == 422
    assert any(ord(c) > 0x600 for c in r.json()["detail"])


# ── Wilayas ───────────────────────────────────────────────────────────────────

def test_get_wilayas_empty(client, person):
    r = client.get(f"/persons/{person.id}/wilayas")
    assert r.status_code == 200
    assert r.json() == []


def test_put_wilayas_and_get(client, person):
    client.put(
        f"/persons/{person.id}/wilayas",
        json={"wilayas": ["مسقط", "صلالة"]},
    )
    r = client.get(f"/persons/{person.id}/wilayas")
    assert r.status_code == 200
    assert set(r.json()) == {"مسقط", "صلالة"}


def test_put_wilayas_replaces_previous(client, person):
    """Second PUT completely replaces the first set."""
    client.put(f"/persons/{person.id}/wilayas", json={"wilayas": ["نزوى", "صحار"]})
    client.put(f"/persons/{person.id}/wilayas", json={"wilayas": ["مسقط"]})
    r = client.get(f"/persons/{person.id}/wilayas")
    assert r.json() == ["مسقط"]


def test_put_wilayas_sentinel_majhoul(client, person):
    """Sentinel value مجهول (unknown) is accepted."""
    r = client.put(
        f"/persons/{person.id}/wilayas",
        json={"wilayas": ["مجهول"]},
    )
    assert r.status_code == 204


def test_put_wilayas_clear_by_empty_list(client, person):
    """Sending an empty list removes all wilayas."""
    client.put(f"/persons/{person.id}/wilayas", json={"wilayas": ["مسقط"]})
    client.put(f"/persons/{person.id}/wilayas", json={"wilayas": []})
    r = client.get(f"/persons/{person.id}/wilayas")
    assert r.json() == []


# ── Name variants ─────────────────────────────────────────────────────────────

def test_list_variants_includes_auto_variant(client, person):
    """Preferred name is auto-created as a variant on person creation."""
    r = client.get(f"/persons/{person.id}/variants")
    assert r.status_code == 200
    forms = [v["written_form"] for v in r.json()]
    assert "ابن النضر البهلوي" in forms


def test_add_variant_201(client, person):
    r = client.post(
        f"/persons/{person.id}/variants",
        json={"written_form": "ابن النضر"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["written_form"] == "ابن النضر"
    assert "normalized_form" in data


def test_add_variant_duplicate_409(client, person):
    """Adding the same written_form twice returns a conflict error."""
    client.post(f"/persons/{person.id}/variants", json={"written_form": "نضر"})
    r = client.post(f"/persons/{person.id}/variants", json={"written_form": "نضر"})
    assert r.status_code == 409


# ── Search ────────────────────────────────────────────────────────────────────

def test_search_returns_match(client, person):
    r = client.get("/persons/search?q=ابن النضر")
    assert r.status_code == 200
    results = r.json()
    assert len(results) >= 1
    match = results[0]
    assert "person_id" in match
    assert "score" in match
    assert "match_type" in match
    assert "preferred_name" in match


def test_search_empty_query_returns_empty(client, person):
    r = client.get("/persons/search?q=")
    assert r.status_code == 200
    assert r.json() == []


def test_search_no_match_returns_empty(client, person):
    r = client.get("/persons/search?q=شخص-لا-وجود-له-إطلاقاً")
    assert r.status_code == 200
    assert r.json() == []
