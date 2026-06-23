from sqlalchemy.orm import Session
from sqlalchemy import select, func
from ..db.models import Annotation, PersonRelationship, PersonNameVariant
from .errors import ResourceNotFoundError
from .vocab import validate_value
from .activity import log_activity


def create_annotation(
    session: Session,
    volume_id: int,
    annotation_type: str,
    work_id: int | None = None,
    text_as_written: str | None = None,
    image_location: str | None = None,
    notes: str | None = None,
) -> Annotation:
    validate_value(session, "annotation_type", annotation_type)

    annotation = Annotation(
        volume_id=volume_id,
        work_id=work_id,
        annotation_type=annotation_type,
        text_as_written=text_as_written,
        image_location=image_location,
        notes=notes,
    )
    session.add(annotation)
    session.flush()
    log_activity(session, "annotations", annotation.id, "create", annotation_type)
    session.commit()
    session.refresh(annotation)
    return annotation


def update_annotation(session: Session, annotation_id: int, **kwargs) -> Annotation:
    annotation = session.get(Annotation, annotation_id)
    if not annotation:
        raise ResourceNotFoundError("القيد غير موجود")

    if "annotation_type" in kwargs:
        validate_value(session, "annotation_type", kwargs["annotation_type"])

    for key, value in kwargs.items():
        setattr(annotation, key, value)

    log_activity(session, "annotations", annotation_id, "update", annotation.annotation_type)
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
    if not annotation:
        raise ResourceNotFoundError("القيد غير موجود")

    evidence_count = session.execute(
        select(func.count()).select_from(PersonRelationship).where(
            PersonRelationship.evidence_annotation_id == annotation_id
        )
    ).scalar_one()
    if evidence_count:
        raise ValueError(
            f"لا يمكن حذف هذا القيد لأنه مستشهد به دليلاً في {evidence_count} ربط. أزل الروابط أولاً."
        )

    variant_count = session.execute(
        select(func.count()).select_from(PersonNameVariant).where(
            PersonNameVariant.source_annotation_id == annotation_id
        )
    ).scalar_one()
    if variant_count:
        raise ValueError(
            f"لا يمكن حذف هذا القيد لأنه مصدر لـ {variant_count} تهجئة لاسم شخص. أزل التهجئات أولاً."
        )

    label = annotation.annotation_type
    session.delete(annotation)
    log_activity(session, "annotations", annotation_id, "delete", label)
    session.commit()
