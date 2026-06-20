import re
import sqlite3 as _sqlite3
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from ..db.models import Volume, Repository, Work, Annotation, PersonRelationship
from .errors import ResourceNotFoundError

_PLACE_KEY_RE = re.compile(r"^\d{4}$")
_SERIAL_RE = re.compile(r"^[0-9]{4}-[0-9]{4}$")


def _validate_place_key(place_key: str) -> None:
    if not _PLACE_KEY_RE.match(place_key):
        raise ValueError("مفتاح الخزانة يجب أن يتكون من أربعة أرقام بالضبط (مثال: 0001)")


def build_serial(place_key: str, document_number: int) -> str:
    serial = f"{place_key}-{document_number:04d}"
    if not _SERIAL_RE.match(serial):
        raise ValueError(f"Assembled serial {serial!r} does not match PPPP-DDDD format")
    return serial


def create_repository(
    session: Session, place_key: str, name: str, location: str | None = None, notes: str | None = None
) -> Repository:
    _validate_place_key(place_key)
    repo = Repository(place_key=place_key, name=name, location=location, notes=notes)
    session.add(repo)
    session.commit()
    session.refresh(repo)
    return repo


def get_repository(session: Session, repo_id: int) -> Repository:
    repo = session.get(Repository, repo_id)
    if not repo:
        raise ResourceNotFoundError("الخزانة غير موجودة")
    return repo


def update_repository(session: Session, repo_id: int, **kwargs) -> Repository:
    repo = session.get(Repository, repo_id)
    if not repo:
        raise ResourceNotFoundError("الخزانة غير موجودة")
    if "place_key" in kwargs and kwargs["place_key"] is not None:
        _validate_place_key(kwargs["place_key"])
    for k, v in kwargs.items():
        setattr(repo, k, v)
    session.commit()
    session.refresh(repo)
    return repo


def delete_repository(session: Session, repo_id: int) -> None:
    repo = session.get(Repository, repo_id)
    if not repo:
        raise ResourceNotFoundError("الخزانة غير موجودة")
    vol_count = session.execute(
        select(func.count()).select_from(Volume).where(Volume.repository_id == repo_id)
    ).scalar_one()
    if vol_count:
        raise ValueError(
            f"لا يمكن حذف هذه الخزانة لأنها تحتوي على {vol_count} مجلد. احذف المجلدات أولاً."
        )
    session.delete(repo)
    session.commit()


def next_document_number(session: Session, repository_id: int) -> int:
    repo = session.get(Repository, repository_id)
    if not repo:
        raise ResourceNotFoundError("الخزانة غير موجودة")
    max_num = session.execute(
        select(func.coalesce(func.max(Volume.document_number), 0))
        .where(Volume.repository_id == repository_id)
    ).scalar_one()
    return max_num + 1


def create_volume(
    session: Session,
    repository_id: int,
    repository_volume_number: int | None = None,
    folio_count: int | None = None,
    notes: str | None = None,
) -> Volume:
    """Create a volume with auto-assigned document_number.

    All SQL is issued through the raw DBAPI connection (BEGIN IMMEDIATE) before
    any session operation so that SQLAlchemy AUTOBEGIN has not yet opened a
    deferred transaction on the same physical connection.  This is critical when
    tests use StaticPool (all engine.connect() calls share one sqlite3.Connection).
    """
    from ..db.engine import get_engine
    engine = get_engine()
    serial: str | None = None

    try:
        with engine.connect() as sa_conn:
            dbapi_conn: _sqlite3.Connection = sa_conn.connection.driver_connection

            try:
                dbapi_conn.execute("BEGIN IMMEDIATE")
            except _sqlite3.OperationalError as e:
                msg = str(e).lower()
                if "locked" in msg or "busy" in msg:
                    raise ValueError("قاعدة البيانات مشغولة. أعد المحاولة لاحقاً.")
                raise

            try:
                cur = dbapi_conn.execute(
                    "SELECT place_key FROM repositories WHERE id = ?",
                    (repository_id,),
                )
                row = cur.fetchone()
                if not row:
                    dbapi_conn.rollback()
                    raise ResourceNotFoundError("الخزانة غير موجودة")
                place_key = row[0]

                cur = dbapi_conn.execute(
                    "SELECT COALESCE(MAX(document_number), 0) "
                    "FROM volumes WHERE repository_id = ?",
                    (repository_id,),
                )
                max_num = cur.fetchone()[0] or 0
                document_number = max_num + 1
                serial = build_serial(place_key, document_number)
                dbapi_conn.execute(
                    "INSERT INTO volumes "
                    "(repository_id, document_number, serial, "
                    " repository_volume_number, folio_count, notes) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (repository_id, document_number, serial,
                     repository_volume_number, folio_count, notes),
                )
                dbapi_conn.commit()
            except _sqlite3.IntegrityError:
                dbapi_conn.rollback()
                raise ValueError("تعارض في رقم الخزنة داخل هذه الخزانة.")
            except (ValueError, ResourceNotFoundError):
                raise
            except Exception:
                dbapi_conn.rollback()
                raise

    except (ValueError, ResourceNotFoundError):
        raise
    except _sqlite3.OperationalError as e:
        msg = str(e).lower()
        if "locked" in msg or "busy" in msg:
            raise ValueError("قاعدة البيانات مشغولة. أعد المحاولة لاحقاً.")
        raise

    session.expire_all()
    volume = session.execute(
        select(Volume).where(Volume.serial == serial)
    ).scalar_one()
    return volume


def update_volume(session: Session, volume_id: int, **kwargs) -> Volume:
    volume = session.get(Volume, volume_id)
    if not volume:
        raise ResourceNotFoundError("المجلد غير موجود")

    if "repository_id" in kwargs or "document_number" in kwargs:
        new_repo_id = kwargs.get("repository_id", volume.repository_id)
        new_doc_num = kwargs.get("document_number", volume.document_number)
        repo = session.get(Repository, new_repo_id)
        if not repo:
            raise ResourceNotFoundError("الخزانة غير موجودة")
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
    if not volume:
        raise ResourceNotFoundError("المجلد غير موجود")

    work_count = session.execute(
        select(func.count()).select_from(Work).where(Work.volume_id == volume_id)
    ).scalar_one()
    if work_count:
        raise ValueError(
            f"لا يمكن حذف هذا المجلد لأنه يحتوي على {work_count} عنوان. احذف العناوين أولاً."
        )

    annotation_count = session.execute(
        select(func.count()).select_from(Annotation).where(Annotation.volume_id == volume_id)
    ).scalar_one()
    if annotation_count:
        raise ValueError(
            f"لا يمكن حذف هذا المجلد لأنه يحتوي على {annotation_count} قيد. احذف القيود أولاً."
        )

    rel_count = session.execute(
        select(func.count()).select_from(PersonRelationship).where(
            PersonRelationship.volume_id == volume_id
        )
    ).scalar_one()
    if rel_count:
        raise ValueError(
            f"لا يمكن حذف هذا المجلد لأنه مرتبط بـ {rel_count} شخص. أزل الروابط أولاً."
        )

    session.delete(volume)
    session.commit()
