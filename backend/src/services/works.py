from sqlalchemy.orm import Session
from sqlalchemy import select, func
from ..db.models import Work, Annotation, PersonRelationship
from .errors import ResourceNotFoundError


def create_work(
    session: Session,
    volume_id: int,
    title: str,
    start_unit: str | None = None,
    end_unit: str | None = None,
    notes: str | None = None,
    copy_date_as_written: str | None = None,
    copy_year: int | None = None,
    copy_month: str | None = None,
    copy_day: int | None = None,
    copy_weekday: str | None = None,
    copy_time: str | None = None,
) -> Work:
    work = Work(
        volume_id=volume_id,
        title=title,
        start_unit=start_unit,
        end_unit=end_unit,
        notes=notes,
        copy_date_as_written=copy_date_as_written,
        copy_year=copy_year,
        copy_month=copy_month,
        copy_day=copy_day,
        copy_weekday=copy_weekday,
        copy_time=copy_time,
    )
    session.add(work)
    session.commit()
    session.refresh(work)
    return work


def update_work(session: Session, work_id: int, **kwargs) -> Work:
    work = session.get(Work, work_id)
    if not work:
        raise ResourceNotFoundError("العنوان غير موجود")
    for key, value in kwargs.items():
        setattr(work, key, value)
    session.commit()
    session.refresh(work)
    return work


def get_work(session: Session, work_id: int) -> Work | None:
    return session.get(Work, work_id)


def list_works_for_volume(session: Session, volume_id: int) -> list[Work]:
    return list(
        session.execute(select(Work).where(Work.volume_id == volume_id)).scalars().all()
    )


def delete_work(session: Session, work_id: int) -> None:
    work = session.get(Work, work_id)
    if not work:
        raise ResourceNotFoundError("العنوان غير موجود")

    annotation_count = session.execute(
        select(func.count()).select_from(Annotation).where(Annotation.work_id == work_id)
    ).scalar_one()
    if annotation_count:
        raise ValueError(
            f"لا يمكن حذف هذا العنوان لأنه مرتبط بـ {annotation_count} قيد. احذف القيود أولاً."
        )

    rel_count = session.execute(
        select(func.count()).select_from(PersonRelationship).where(
            PersonRelationship.work_id == work_id
        )
    ).scalar_one()
    if rel_count:
        raise ValueError(
            f"لا يمكن حذف هذا العنوان لأنه مرتبط بـ {rel_count} شخص. أزل الروابط أولاً."
        )

    session.delete(work)
    session.commit()
