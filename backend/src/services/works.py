from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.models import Work


def create_work(
    session: Session,
    volume_id: int,
    title: str,
    work_type: str | None = None,
    start_unit: str | None = None,
    end_unit: str | None = None,
    notes: str | None = None,
) -> Work:
    work = Work(
        volume_id=volume_id,
        title=title,
        work_type=work_type,
        start_unit=start_unit,
        end_unit=end_unit,
        notes=notes,
    )
    session.add(work)
    session.commit()
    session.refresh(work)
    return work


def update_work(session: Session, work_id: int, **kwargs) -> Work:
    work = session.get(Work, work_id)
    if not work:
        raise ValueError(f"Work {work_id} not found")
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
    if work:
        session.delete(work)
        session.commit()
