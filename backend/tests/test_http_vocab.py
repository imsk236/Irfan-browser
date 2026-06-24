"""HTTP-level tests for /vocab endpoints.

Scenario: a researcher adds a new custom role قارئ, deactivates it when
it is no longer needed, then re-activates it — verifying the soft-delete
and reactivation lifecycle. Also verifies seeded values are present and
that listing an unknown category returns an empty list, not 404.
"""


# ── GET vocab ─────────────────────────────────────────────────────────────────

def test_get_role_vocab_contains_seeded_values(client):
    r = client.get("/vocab/role")
    assert r.status_code == 200
    values = r.json()
    # Core seeded roles from seed.py
    assert "مؤلف" in values
    assert "ناسخ" in values
    assert isinstance(values, list)


def test_get_annotation_type_vocab(client):
    r = client.get("/vocab/annotation_type")
    assert r.status_code == 200
    assert "تملك" in r.json()


def test_get_unknown_category_returns_empty_list(client):
    """An unknown category returns [] not 404."""
    r = client.get("/vocab/فئة-غير-موجودة")
    assert r.status_code == 200
    assert r.json() == []


# ── POST vocab (add value) ────────────────────────────────────────────────────

def test_add_vocab_value_201(client):
    r = client.post("/vocab/role", json={"value": "قارئ"})
    assert r.status_code == 201
    data = r.json()
    assert data["value"] == "قارئ"
    assert data["category"] == "role"


def test_add_vocab_value_appears_in_list(client):
    client.post("/vocab/role", json={"value": "قارئ"})
    r = client.get("/vocab/role")
    assert "قارئ" in r.json()


def test_add_vocab_value_active_is_idempotent(client):
    """Adding an already-active value does not create a duplicate."""
    client.post("/vocab/role", json={"value": "قارئ"})
    r = client.post("/vocab/role", json={"value": "قارئ"})
    # Should succeed (reactivation/no-op), not 409
    assert r.status_code in (200, 201)
    # Value appears exactly once in list
    values = client.get("/vocab/role").json()
    assert values.count("قارئ") == 1


# ── DELETE vocab (deactivate) ─────────────────────────────────────────────────

def test_deactivate_vocab_204(client):
    r = client.delete("/vocab/role/مستعير")
    assert r.status_code == 204


def test_deactivated_value_absent_from_list(client):
    client.delete("/vocab/role/مستعير")
    assert "مستعير" not in client.get("/vocab/role").json()


def test_reactivation_restores_value(client):
    """DELETE then POST the same value re-activates it without conflict."""
    client.delete("/vocab/role/مستعير")
    r = client.post("/vocab/role", json={"value": "مستعير"})
    assert r.status_code == 201
    assert "مستعير" in client.get("/vocab/role").json()
