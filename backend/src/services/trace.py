from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.models import PersonRelationship, Work, Volume, Annotation


@dataclass
class TraceResult:
    relationship_id: int
    role: str
    level: str
    serial: str
    repository_volume_number: int | None
    work_id: int | None
    work_title: str | None
    evidence_annotation_id: int | None
    evidence_annotation_type: str | None
    evidence_text: str | None
    evidence_image_location: str | None
    evidence_source: str | None
    notes: str | None


def trace_scholar(session: Session, person_id: int) -> list[TraceResult]:
    """Return every manuscript link for a person, grouped by role.

    Because all relationships link via the surrogate person_id, all name
    variants aggregate automatically — this is the correctness guarantee
    the entire archive is built around.
    """
    rels = session.execute(
        select(PersonRelationship).where(PersonRelationship.person_id == person_id)
    ).scalars().all()

    results: list[TraceResult] = []
    for rel in rels:
        serial = ""
        repository_volume_number = None
        work_title = None

        if rel.level == "work" and rel.work_id:
            work = session.get(Work, rel.work_id)
            if work:
                work_title = work.title
                volume = session.get(Volume, work.volume_id)
                if volume:
                    serial = volume.serial
                    repository_volume_number = volume.repository_volume_number
        elif rel.level == "volume" and rel.volume_id:
            volume = session.get(Volume, rel.volume_id)
            if volume:
                serial = volume.serial
                repository_volume_number = volume.repository_volume_number

        evidence_text = None
        evidence_image = None
        evidence_annotation_type = None
        if rel.evidence_annotation_id:
            annotation = session.get(Annotation, rel.evidence_annotation_id)
            if annotation:
                evidence_text = annotation.text_as_written
                evidence_image = annotation.image_location
                evidence_annotation_type = annotation.annotation_type

        results.append(TraceResult(
            relationship_id=rel.id,
            role=rel.role,
            level=rel.level,
            serial=serial,
            repository_volume_number=repository_volume_number,
            work_id=rel.work_id,
            work_title=work_title,
            evidence_annotation_id=rel.evidence_annotation_id,
            evidence_annotation_type=evidence_annotation_type,
            evidence_text=evidence_text,
            evidence_image_location=evidence_image,
            evidence_source=rel.evidence_source,
            notes=rel.notes,
        ))

    # Sort by role then serial for a predictable grouped display
    results.sort(key=lambda r: (r.role, r.serial))
    return results
