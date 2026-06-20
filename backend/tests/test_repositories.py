"""Tests for repository read, update, and delete (API-003).

Service-layer tests — no HTTP stack involved.
"""
import pytest
from src.services import volumes as svc
from src.services.errors import ResourceNotFoundError


def _make_repo(session, place_key="6001", name="خزانة اختبار", location=None):
    return svc.create_repository(session, place_key, name, location)


# ── get_repository ────────────────────────────────────────────────────────────

def test_get_repository_returns_repo(session):
    repo = _make_repo(session)
    fetched = svc.get_repository(session, repo.id)
    assert fetched.id == repo.id
    assert fetched.place_key == "6001"


def test_get_nonexistent_repository_raises(session):
    with pytest.raises(ResourceNotFoundError, match="الخزانة غير موجودة"):
        svc.get_repository(session, 99999)


# ── update_repository ────────────────────────────────────────────────────────

def test_update_repository_name(session):
    repo = _make_repo(session)
    updated = svc.update_repository(session, repo.id, name="اسم جديد")
    assert updated.name == "اسم جديد"
    assert updated.place_key == "6001"  # unchanged


def test_update_repository_location(session):
    repo = _make_repo(session)
    updated = svc.update_repository(session, repo.id, location="مسقط")
    assert updated.location == "مسقط"


def test_update_repository_place_key_validation(session):
    repo = _make_repo(session)
    with pytest.raises(ValueError, match="أرقام"):
        svc.update_repository(session, repo.id, place_key="ABC1")


def test_update_nonexistent_repository_raises(session):
    with pytest.raises(ResourceNotFoundError, match="الخزانة غير موجودة"):
        svc.update_repository(session, 99999, name="اسم")


# ── delete_repository ────────────────────────────────────────────────────────

def test_delete_empty_repository_succeeds(session):
    repo = _make_repo(session)
    svc.delete_repository(session, repo.id)
    with pytest.raises(ResourceNotFoundError):
        svc.get_repository(session, repo.id)


def test_delete_repository_blocked_when_has_volumes(session):
    repo = _make_repo(session, place_key="6002")
    svc.create_volume(session, repo.id)
    with pytest.raises(ValueError, match="مجلد"):
        svc.delete_repository(session, repo.id)


def test_delete_nonexistent_repository_raises(session):
    with pytest.raises(ResourceNotFoundError, match="الخزانة غير موجودة"):
        svc.delete_repository(session, 99999)
