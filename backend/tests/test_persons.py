"""Tests for person creation, update, and wilaya association."""
import pytest
from src.services import persons as svc


_BIOGRAPHICAL = {
    "kunya": "أبو عبد الله",
    "known_as": "ابن القاسم",
    "nasab": "بن أحمد بن إبراهيم",
    "birth_date_as_written": "٣٠٠ هـ",
    "birth_year_earliest": 9120101,
    "birth_year_latest": 9121231,
    "death_date_as_written": "٣٨٦ هـ",
    "death_year_earliest": 9960101,
    "death_year_latest": 9961231,
    "birth_place": "البصرة",
    "death_place": "بغداد",
}


def test_create_person_with_biographical_fields(session):
    """Person with biographical fields is created without error."""
    person = svc.create_person(
        session,
        preferred_name="محمد بن أحمد",
        ism="محمد",
        nisba_1="البغدادي",
        laqab="شيخ الإسلام",
        **_BIOGRAPHICAL,
    )
    assert person.id is not None
    for field, value in _BIOGRAPHICAL.items():
        assert getattr(person, field) == value, f"field {field!r} mismatch"


def test_create_person_preferred_name_only(session):
    """Creating a person with only preferred_name succeeds; all optional fields default to None."""
    person = svc.create_person(session, preferred_name="اسم الشخص")
    assert person.id is not None
    for field in _BIOGRAPHICAL:
        assert getattr(person, field) is None, f"field {field!r} should default to None"


def test_get_person_returns_all_fields(session):
    """Retrieved person includes all biographical fields."""
    created = svc.create_person(session, preferred_name="فاطمة", **_BIOGRAPHICAL)
    fetched = svc.get_person(session, created.id)
    assert fetched is not None
    for field, value in _BIOGRAPHICAL.items():
        assert getattr(fetched, field) == value, f"field {field!r} not retrieved correctly"


def test_update_person_fields(session):
    """update_person can modify biographical fields."""
    person = svc.create_person(session, preferred_name="علي بن محمد")
    svc.update_person(
        session,
        person.id,
        birth_place="مكة المكرمة",
        nasab="بن حسن بن علي",
        death_year_earliest=8500101,
        death_year_latest=8501231,
    )
    updated = svc.get_person(session, person.id)
    assert updated.birth_place == "مكة المكرمة"
    assert updated.nasab == "بن حسن بن علي"
    assert updated.death_year_earliest == 8500101


def test_update_person_clears_field_with_none(session):
    """Setting a field to None via update_person removes the value."""
    person = svc.create_person(session, preferred_name="عمر بن الخطاب", birth_place="مكة")
    assert person.birth_place == "مكة"
    svc.update_person(session, person.id, birth_place=None)
    updated = svc.get_person(session, person.id)
    assert updated.birth_place is None


def test_list_persons_includes_fields(session):
    """list_persons returns persons with their data intact."""
    svc.create_person(session, preferred_name="أحمد بن حنبل", nasab="بن حنبل بن هلال")
    persons = svc.list_persons(session)
    target = next((p for p in persons if p.preferred_name == "أحمد بن حنبل"), None)
    assert target is not None
    assert target.nasab == "بن حنبل بن هلال"


def test_preferred_name_is_required(session):
    """Calling create_person without preferred_name raises TypeError."""
    with pytest.raises(TypeError):
        svc.create_person(session)


def test_set_and_get_wilayas(session):
    """set_wilayas and get_wilayas store and retrieve wilaya associations."""
    person = svc.create_person(session, preferred_name="سعيد بن أحمد")
    svc.set_wilayas(session, person.id, ["مسقط", "صلالة"])
    result = svc.get_wilayas(session, person.id)
    assert set(result) == {"مسقط", "صلالة"}


def test_set_wilayas_replaces_existing(session):
    """Calling set_wilayas again replaces the previous wilayas."""
    person = svc.create_person(session, preferred_name="خالد بن سعيد")
    svc.set_wilayas(session, person.id, ["مسقط"])
    svc.set_wilayas(session, person.id, ["صلالة", "نزوى"])
    result = svc.get_wilayas(session, person.id)
    assert set(result) == {"صلالة", "نزوى"}


def test_set_wilayas_unknown_sentinel(session):
    """مجهول sentinel is stored and retrieved correctly."""
    person = svc.create_person(session, preferred_name="مجهول الهوية")
    svc.set_wilayas(session, person.id, ["مجهول"])
    result = svc.get_wilayas(session, person.id)
    assert result == ["مجهول"]


def test_set_wilayas_empty_clears(session):
    """Setting empty list removes all wilaya associations."""
    person = svc.create_person(session, preferred_name="شخص آخر")
    svc.set_wilayas(session, person.id, ["مسقط"])
    svc.set_wilayas(session, person.id, [])
    result = svc.get_wilayas(session, person.id)
    assert result == []
