from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.models import Annotation
from ..utils.hijri import parse_hijri


def create_annotation(
    session: Session,
    volume_id: int,
    annotation_type: str,
    work_id: int | None = None,
    text_as_written: str | None = None,
    date_as_written: str | None = None,
    date_precision: str | None = None,
    image_location: str | None = None,
    notes: str | None = None,
) -> Annotation:
    date_earliest, date_latest = (None, None)
    if date_as_written:
        date_earliest, date_latest = parse_hijri(date_as_written)

    annotation = Annotation(
        volume_id=volume_id,
        work_id=work_id,
        annotation_type=annotation_type,
        text_as_written=text_as_written,
        date_as_written=date_as_written,
        date_earliest=date_earliest,
        date_latest=date_latest,
        date_precision=date_precision,
        image_location=image_location,
        notes=notes,
    )
    session.add(annotation)
    session.commit()
    session.refresh(annotation)
    return annotation


def update_annotation(session: Session, annotation_id: int, **kwargs) -> Annotation:
    annotation = session.get(Annotation, annotation_id)
    if not annotation:
        raise ValueError(f"Annotation {annotation_id} not found")

    if "date_as_written" in kwargs and kwargs["date_as_written"]:
        kwargs["date_earliest"], kwargs["date_latest"] = parse_hijri(kwargs["date_as_written"])

    for key, value in kwargs.items():
        setattr(annotation, key, value)

    session.commit()
    session.refresh(annotation)
    return annotation


def get_annotation(session: Session, annotation_id: int) -> Annotation | None:
    return session.get(Annotation, annotation_id)


def list_annotations_for_volume(session: Session, volume_id: int) -> list[Annotation]:
    return list(
        session.execute(
            select(Annotation).where(Annotation.volume_id == volume_id)
        ).scalars().all()
    )


def delete_annotation(session: Session, annotation_id: int) -> None:
    annotation = session.get(Annotation, annotation_id)
    if annotation:
        session.delete(annotation)
        session.commit()
