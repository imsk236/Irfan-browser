from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.models import PersonRelationship, Annotation, Work
from .errors import ResourceNotFoundError
from .vocab import validate_value

_AUTHOR_ROLE = "مؤلف"


def _validate_evidence_annotation(
    session: Session,
    evidence_annotation_id: int | None,
    volume_id: int | None,
    work_id: int | None,
) -> None:
    """Ensure the linked annotation belongs to the correct scope."""
    if evidence_annotation_id is None:
        return
    annotation = session.get(Annotation, evidence_annotation_id)
    if not annotation:
        raise ValueError("التقييد المشار إليه كدليل غير موجود")

    if work_id is not None:
        work = session.get(Work, work_id)
        if not work:
            raise ValueError("الأثر المشار إليه غير موجود")
        if annotation.volume_id != work.volume_id:
            raise ValueError("الدليل المستشهد به لا ينتمي إلى المجلد الصحيح")
    elif volume_id is not None:
        if annotation.volume_id != volume_id:
            raise ValueError("الدليل المستشهد به لا ينتمي إلى هذه المجلد")


def link_person_to_work(
    session: Session,
    person_id: int,
    work_id: int,
    role: str,
    confidence: str,
    evidence_source: str | None = None,
    evidence_annotation_id: int | None = None,
    notes: str | None = None,
) -> PersonRelationship:
    validate_value(session, "role", role)
    validate_value(session, "confidence", confidence)
    validate_value(session, "knowledge_source", evidence_source)
    _validate_evidence_annotation(session, evidence_annotation_id, None, work_id)

    if role == _AUTHOR_ROLE:
        existing_author = session.execute(
            select(PersonRelationship).where(
                PersonRelationship.work_id == work_id,
                PersonRelationship.role == _AUTHOR_ROLE,
            )
        ).scalar_one_or_none()
        if existing_author and existing_author.person_id != person_id:
            raise ValueError(
                "هذا الأثر مرتبط بمؤلف آخر بالفعل. أزل الربط الحالي أولاً إن أردت تغيير المؤلف."
            )

    rel = PersonRelationship(
        person_id=person_id,
        level="work",
        work_id=work_id,
        volume_id=None,
        role=role,
        confidence=confidence,
        evidence_source=evidence_source,
        evidence_annotation_id=evidence_annotation_id,
        notes=notes,
    )
    session.add(rel)
    session.commit()
    session.refresh(rel)
    return rel


def link_person_to_volume(
    session: Session,
    person_id: int,
    volume_id: int,
    role: str,
    confidence: str,
    evidence_source: str | None = None,
    evidence_annotation_id: int | None = None,
    notes: str | None = None,
) -> PersonRelationship:
    validate_value(session, "role", role)
    validate_value(session, "confidence", confidence)
    validate_value(session, "knowledge_source", evidence_source)
    _validate_evidence_annotation(session, evidence_annotation_id, volume_id, None)

    rel = PersonRelationship(
        person_id=person_id,
        level="volume",
        volume_id=volume_id,
        work_id=None,
        role=role,
        confidence=confidence,
        evidence_source=evidence_source,
        evidence_annotation_id=evidence_annotation_id,
        notes=notes,
    )
    session.add(rel)
    session.commit()
    session.refresh(rel)
    return rel


def delete_relationship(session: Session, relationship_id: int) -> None:
    rel = session.get(PersonRelationship, relationship_id)
    if not rel:
        raise ResourceNotFoundError("الربط غير موجود")
    session.delete(rel)
    session.commit()
