from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from ..db.models import PersonRelationship, Work, Volume, Annotation, Person, PersonWilaya, Repository


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


@dataclass
class WilayaScholar:
    person_id: int
    preferred_name: str
    appearance_count: int


@dataclass
class WilayaCopy:
    work_id: int
    work_title: str
    serial: str
    repository_volume_number: int | None
    copier_name: str | None


@dataclass
class WilayaRepository:
    repository_id: int
    name: str
    place_key: str
    volume_count: int


@dataclass
class WilayaTrace:
    scholars: list[WilayaScholar]
    copies: list[WilayaCopy]
    repositories: list[WilayaRepository]


def trace_wilaya(session: Session, wilaya_name: str) -> WilayaTrace:
    """Return all scholars, copied works, and repositories associated with a wilaya."""

    # Scholars: persons whose person_wilayas includes this wilaya
    person_ids = session.execute(
        select(PersonWilaya.person_id).where(PersonWilaya.wilaya == wilaya_name)
    ).scalars().all()

    scholars: list[WilayaScholar] = []
    for pid in person_ids:
        person = session.get(Person, pid)
        if not person:
            continue
        count = session.execute(
            select(func.count()).select_from(PersonRelationship).where(
                PersonRelationship.person_id == pid
            )
        ).scalar() or 0
        scholars.append(WilayaScholar(
            person_id=pid,
            preferred_name=person.preferred_name,
            appearance_count=count,
        ))
    scholars.sort(key=lambda s: -s.appearance_count)

    # Copies: works whose copy_place equals this wilaya
    works_with_place = session.execute(
        select(Work).where(Work.copy_place == wilaya_name)
    ).scalars().all()

    copies: list[WilayaCopy] = []
    for work in works_with_place:
        volume = session.get(Volume, work.volume_id)
        if not volume:
            continue
        copier_rel = session.execute(
            select(PersonRelationship).where(
                PersonRelationship.work_id == work.id,
                PersonRelationship.role == "ناسخ",
                PersonRelationship.level == "work",
            )
        ).scalar_one_or_none()
        copier_name = None
        if copier_rel:
            copier = session.get(Person, copier_rel.person_id)
            if copier:
                copier_name = copier.preferred_name
        copies.append(WilayaCopy(
            work_id=work.id,
            work_title=work.title,
            serial=volume.serial,
            repository_volume_number=volume.repository_volume_number,
            copier_name=copier_name,
        ))
    copies.sort(key=lambda c: (c.serial, c.work_title))

    # Repositories: repos whose location equals this wilaya
    repos = session.execute(
        select(Repository).where(Repository.location == wilaya_name)
    ).scalars().all()

    repositories: list[WilayaRepository] = []
    for repo in repos:
        count = session.execute(
            select(func.count()).select_from(Volume).where(
                Volume.repository_id == repo.id
            )
        ).scalar() or 0
        repositories.append(WilayaRepository(
            repository_id=repo.id,
            name=repo.name,
            place_key=repo.place_key,
            volume_count=count,
        ))
    repositories.sort(key=lambda r: r.name)

    return WilayaTrace(scholars=scholars, copies=copies, repositories=repositories)
