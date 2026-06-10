import re
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.models import Volume, Repository

_PLACE_KEY_RE = re.compile(r"^\d{4}$")
_SERIAL_RE = re.compile(r"^[0-9]{4}-[0-9]{4}$")


def _validate_place_key(place_key: str) -> None:
    if not _PLACE_KEY_RE.match(place_key):
        raise ValueError(f"place_key must be exactly four ASCII digits, got: {place_key!r}")


def build_serial(place_key: str, document_number: int) -> str:
    serial = f"{place_key}-{document_number:04d}"
    if not _SERIAL_RE.match(serial):
        raise ValueError(f"Assembled serial {serial!r} does not match PPPP-DDDD format")
    return serial


def create_repository(session: Session, place_key: str, name: str, kind: str, notes: str | None = None) -> Repository:
    _validate_place_key(place_key)
    repo = Repository(place_key=place_key, name=name, kind=kind, notes=notes)
    session.add(repo)
    session.commit()
    session.refresh(repo)
    return repo


def create_volume(
    session: Session,
    repository_id: int,
    library_shelfmark: str | None = None,
    folio_count: int | None = None,
    notes: str | None = None,
) -> Volume:
    """Create a volume with auto-assigned document_number.

    The UNIQUE(repository_id, document_number) constraint is the final
    guard against duplicates. The single-writer WAL check in the Electron
    shell prevents the concurrent-open scenario at a higher level.
    """
    repo = session.get(Repository, repository_id)
    if not repo:
        raise ValueError(f"Repository {repository_id} not found")

    max_num = session.execute(
        select(Volume.document_number)
        .where(Volume.repository_id == repository_id)
        .order_by(Volume.document_number.desc())
        .limit(1)
    ).scalar_one_or_none() or 0

    document_number = max_num + 1
    serial = build_serial(repo.place_key, document_number)

    volume = Volume(
        repository_id=repository_id,
        document_number=document_number,
        serial=serial,
        library_shelfmark=library_shelfmark,
        folio_count=folio_count,
        notes=notes,
    )
    session.add(volume)
    session.commit()
    session.refresh(volume)
    return volume


def update_volume(session: Session, volume_id: int, **kwargs) -> Volume:
    volume = session.get(Volume, volume_id)
    if not volume:
        raise ValueError(f"Volume {volume_id} not found")

    # If repository_id or document_number changes, regenerate serial
    if "repository_id" in kwargs or "document_number" in kwargs:
        new_repo_id = kwargs.get("repository_id", volume.repository_id)
        new_doc_num = kwargs.get("document_number", volume.document_number)
        repo = session.get(Repository, new_repo_id)
        if not repo:
            raise ValueError(f"Repository {new_repo_id} not found")
        kwargs["serial"] = build_serial(repo.place_key, new_doc_num)

    for key, value in kwargs.items():
        setattr(volume, key, value)

    session.commit()
    session.refresh(volume)
    return volume


def get_volume(session: Session, volume_id: int) -> Volume | None:
    return session.get(Volume, volume_id)


def list_volumes(session: Session) -> list[Volume]:
    return list(session.execute(select(Volume).order_by(Volume.serial)).scalars().all())


def delete_volume(session: Session, volume_id: int) -> None:
    volume = session.get(Volume, volume_id)
    if volume:
        session.delete(volume)
        session.commit()
