"""Tests for annotation_type/role free-text acceptance and other vocab validation.

annotation_type and role are deliberately NOT validated against the vocab table
(see docs/adr/0002-annotation-type-role-free-text-other.md) so a "غير ذلك" custom
value can be entered on a قيد without being added to the vocab list. All tests
operate at the service layer using the session fixture so they are independent
of the HTTP stack.
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import annotations as ann_svc
from src.services import relationships as rel_svc
from src.services import persons as person_svc
from src.services.vocab import deactivate_value


def _make_volume(session):
    repo = vol_svc.create_repository(session, "5010", "م")
    return vol_svc.create_volume(session, repo.id)


# ── Annotation type ───────────────────────────────────────────────────────────

def test_custom_annotation_type_accepted(session):
    vol = _make_volume(session)
    ann = ann_svc.create_annotation(session, vol.id, "نوع-مخترع")
    assert ann.annotation_type == "نوع-مخترع"


def test_valid_annotation_type_accepted(session):
    vol = _make_volume(session)
    ann = ann_svc.create_annotation(session, vol.id, "تملك")
    assert ann.annotation_type == "تملك"


def test_inactive_annotation_type_still_accepted(session):
    deactivate_value(session, "annotation_type", "إهداء")
    vol = _make_volume(session)
    ann = ann_svc.create_annotation(session, vol.id, "إهداء")
    assert ann.annotation_type == "إهداء"


# ── Relationship role ─────────────────────────────────────────────────────────

def _make_person(session, name="شخص"):
    return person_svc.create_person(session, name)


def test_custom_role_accepted(session):
    vol = _make_volume(session)
    person = _make_person(session)
    rel = rel_svc.link_person_to_volume(session, person.id, vol.id, "دور-مخترع")
    assert rel.role == "دور-مخترع"


def test_valid_role_accepted(session):
    vol = _make_volume(session)
    person = _make_person(session)
    rel = rel_svc.link_person_to_volume(session, person.id, vol.id, "مالك")
    assert rel.id is not None


def test_evidence_source_free_text_accepted(session):
    vol = _make_volume(session)
    person = _make_person(session)
    rel = rel_svc.link_person_to_volume(
        session, person.id, vol.id, "مالك", evidence_source="ابن بطوطة"
    )
    assert rel.evidence_source == "ابن بطوطة"


def test_none_evidence_source_accepted(session):
    vol = _make_volume(session)
    person = _make_person(session)
    rel = rel_svc.link_person_to_volume(
        session, person.id, vol.id, "مالك", evidence_source=None
    )
    assert rel.evidence_source is None


def test_inactive_role_still_accepted(session):
    deactivate_value(session, "role", "مستعير")
    vol = _make_volume(session)
    person = _make_person(session)
    rel = rel_svc.link_person_to_volume(session, person.id, vol.id, "مستعير")
    assert rel.role == "مستعير"

