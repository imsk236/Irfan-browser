"""Tests for volume serial generation, BEGIN IMMEDIATE allocation, and duplicate handling.

DATA-005 from the audit: create_volume must use BEGIN IMMEDIATE so that two
concurrent sessions cannot read the same MAX(document_number) and produce
duplicate serials.
"""
import threading
import pytest
from sqlalchemy.orm import sessionmaker

from src.services import volumes as svc


@pytest.fixture
def repo(session):
    """Create and return a test repository."""
    return svc.create_repository(
        session, place_key="9001", name="خزانة الاختبار"
    )


def test_serial_format(session, repo):
    """Created serial matches PPPP-DDDD format."""
    vol = svc.create_volume(session, repo.id)
    assert vol.serial == "9001-0001"


def test_serial_increments(session, repo):
    """Second volume in the same repository gets the next document number."""
    v1 = svc.create_volume(session, repo.id)
    v2 = svc.create_volume(session, repo.id)
    assert v1.document_number == 1
    assert v2.document_number == 2
    assert v1.serial == "9001-0001"
    assert v2.serial == "9001-0002"


def test_serial_independent_per_repository(session):
    """Each repository has its own independent document-number sequence."""
    repo_a = svc.create_repository(session, "9002", "خزانة أ")
    repo_b = svc.create_repository(session, "9003", "خزانة ب")

    va = svc.create_volume(session, repo_a.id)
    vb = svc.create_volume(session, repo_b.id)

    assert va.serial == "9002-0001"
    assert vb.serial == "9003-0001"


def test_create_volume_with_optional_fields(session, repo):
    """Optional fields are stored and retrieved correctly."""
    vol = svc.create_volume(
        session, repo.id,
        repository_volume_number=5,
        folio_count=120,
        notes="ملاحظة اختبارية",
    )
    fetched = svc.get_volume(session, vol.id)
    assert fetched.repository_volume_number == 5
    assert fetched.folio_count == 120
    assert fetched.notes == "ملاحظة اختبارية"


def test_create_volume_nonexistent_repository(session):
    """Creating a volume for a non-existent repository raises a ValueError."""
    with pytest.raises(ValueError, match="الخزانة غير موجودة"):
        svc.create_volume(session, repository_id=9999)


def test_concurrent_serial_allocation_no_duplicates(engine):
    """Concurrent volume creation must not produce duplicate serials.

    Two threads create volumes in the same repository simultaneously.
    With BEGIN IMMEDIATE, one will win and the other will either succeed
    with the next number or raise a ValueError (DB busy / unique conflict).
    No duplicate serials must appear in the database.
    """
    Session = sessionmaker(bind=engine)

    # Set up a repository first
    with Session() as setup_session:
        repo = svc.create_repository(setup_session, "8001", "خزانة التزامن")
        repo_id = repo.id

    errors: list[Exception] = []
    created_serials: list[str] = []
    lock = threading.Lock()

    def create_one():
        with Session() as s:
            try:
                vol = svc.create_volume(s, repo_id)
                with lock:
                    created_serials.append(vol.serial)
            except (ValueError, Exception) as e:
                with lock:
                    errors.append(e)

    threads = [threading.Thread(target=create_one) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # No duplicate serials regardless of how many threads won
    assert len(created_serials) == len(set(created_serials)), (
        f"Duplicate serials detected: {created_serials}"
    )
    # At least one thread must have succeeded
    assert len(created_serials) >= 1


def test_list_volumes_ordered_by_serial(session, repo):
    """list_volumes returns volumes sorted by serial string."""
    svc.create_volume(session, repo.id)
    svc.create_volume(session, repo.id)
    svc.create_volume(session, repo.id)

    vols = svc.list_volumes(session)
    serials = [v.serial for v in vols if v.repository_id == repo.id]
    assert serials == sorted(serials)


def test_update_volume_serial_regenerated(session, repo):
    """Changing document_number regenerates the serial correctly."""
    vol = svc.create_volume(session, repo.id)
    assert vol.serial == "9001-0001"

    updated = svc.update_volume(session, vol.id, document_number=42)
    assert updated.serial == "9001-0042"
    assert updated.document_number == 42
