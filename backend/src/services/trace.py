from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from ..db.models import PersonRelationship, Work, Volume, Annotation, PersonWilaya


@dataclass
class TraceResult:
    relationship_id: int | None
    role: str | None
    level: str | None
    volume_id: int
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


def _year_range_condition(column, year_from: int | None, year_to: int | None):
    if year_from is not None and year_to is not None:
        return column.between(year_from, year_to)
    if year_from is not None:
        return column >= year_from
    return column <= year_to


def trace_scholar(
    session: Session,
    person_id: int | None = None,
    region: str | None = None,
    copy_place: str | None = None,
    title: str | None = None,
    number: str | None = None,
    repository_id: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
) -> list[TraceResult]:
    """Unified البحث والتتبع search — every filter is optional and combinable.

    Each filter narrows independently (intersected by id), same model as the
    volume/date filters previously in search_volumes (see ADR 0004): شخص
    (person_id) and منطقة العالم (region, via person_wilayas) narrow the
    candidate person set; العنوان/الرقم/الخزانة/مكان النسخ/سنة النسخ narrow
    the candidate volume set (سنة النسخ matches a linked عنوان's copy_year OR
    a linked قيد's annotation_year). Rows are relationships satisfying both
    constraints. When NO person constraint is active, every candidate volume
    (and, when عنوان is filtered, every matching عنوان within it) that has no
    qualifying relationship still emits a placeholder row (relationship_id,
    role, level all None) so it doesn't silently vanish — see ADR 0005. At
    least one filter is required. Undated works/annotations are excluded when
    a year range is active.

    Called with only person_id set (e.g. from GET /persons/{id}/appearances),
    this reduces exactly to the original trace_scholar behavior: every
    appearance of that person, no placeholders (a person filter is active).
    """
    title = title.strip() if title else None
    number = number.strip() if number else None

    if (
        person_id is None and not region and not copy_place and not title and not number
        and repository_id is None and year_from is None and year_to is None
    ):
        raise ValueError("يجب إدخال معيار بحث واحد على الأقل")

    # ── Candidate volumes (independent intersection) ──────────────────────────
    candidate_volume_sets: list[set[int]] = []

    if title:
        ids = session.execute(
            select(Work.volume_id).where(Work.title.ilike(f"%{title}%"))
        ).scalars().all()
        candidate_volume_sets.append(set(ids))

    if number:
        conditions = [Volume.serial.ilike(f"%{number}%")]
        if number.isdigit():
            conditions.append(Volume.repository_volume_number == int(number))
        ids = session.execute(select(Volume.id).where(or_(*conditions))).scalars().all()
        candidate_volume_sets.append(set(ids))

    if repository_id is not None:
        ids = session.execute(
            select(Volume.id).where(Volume.repository_id == repository_id)
        ).scalars().all()
        candidate_volume_sets.append(set(ids))

    if copy_place:
        ids = session.execute(
            select(Work.volume_id).where(Work.copy_place == copy_place)
        ).scalars().all()
        candidate_volume_sets.append(set(ids))

    if year_from is not None or year_to is not None:
        work_ids = session.execute(
            select(Work.volume_id).where(_year_range_condition(Work.copy_year, year_from, year_to))
        ).scalars().all()
        annotation_ids = session.execute(
            select(Annotation.volume_id).where(_year_range_condition(Annotation.annotation_year, year_from, year_to))
        ).scalars().all()
        candidate_volume_sets.append(set(work_ids) | set(annotation_ids))

    has_volume_filter = bool(candidate_volume_sets)
    candidate_volume_ids: set[int] = set()
    if has_volume_filter:
        candidate_volume_ids = set.intersection(*candidate_volume_sets)
        if not candidate_volume_ids:
            return []

    # ── Candidate persons (independent intersection) ──────────────────────────
    candidate_person_sets: list[set[int]] = []
    if person_id is not None:
        candidate_person_sets.append({person_id})
    if region:
        ids = session.execute(
            select(PersonWilaya.person_id).where(PersonWilaya.wilaya == region)
        ).scalars().all()
        candidate_person_sets.append(set(ids))

    has_person_filter = bool(candidate_person_sets)
    candidate_person_ids: set[int] = set()
    if has_person_filter:
        candidate_person_ids = set.intersection(*candidate_person_sets)
        if not candidate_person_ids:
            return []

    # ── Rows: relationships satisfying both constraints ───────────────────────
    rel_query = select(PersonRelationship)
    if has_person_filter:
        rel_query = rel_query.where(PersonRelationship.person_id.in_(candidate_person_ids))
    rels = session.execute(rel_query).scalars().all()

    results: list[TraceResult] = []
    seen_work_ids: set[int] = set()
    seen_volume_level_ids: set[int] = set()

    for rel in rels:
        serial = ""
        repository_volume_number = None
        work_title = None
        volume_id: int | None = None

        if rel.level == "work" and rel.work_id:
            work = session.get(Work, rel.work_id)
            if work:
                work_title = work.title
                volume_id = work.volume_id
                volume = session.get(Volume, work.volume_id)
                if volume:
                    serial = volume.serial
                    repository_volume_number = volume.repository_volume_number
        elif rel.level == "volume" and rel.volume_id:
            volume_id = rel.volume_id
            volume = session.get(Volume, rel.volume_id)
            if volume:
                serial = volume.serial
                repository_volume_number = volume.repository_volume_number

        if volume_id is None or (has_volume_filter and volume_id not in candidate_volume_ids):
            continue

        if rel.level == "work" and rel.work_id:
            seen_work_ids.add(rel.work_id)
        elif rel.level == "volume":
            seen_volume_level_ids.add(volume_id)

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
            volume_id=volume_id,
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

    # ── Placeholder rows: only when no person constraint is active ───────────
    if has_volume_filter and not has_person_filter:
        for vol_id in candidate_volume_ids:
            volume = session.get(Volume, vol_id)
            if not volume:
                continue

            if title:
                relevant_works = session.execute(
                    select(Work).where(Work.volume_id == vol_id, Work.title.ilike(f"%{title}%"))
                ).scalars().all()
            else:
                relevant_works = session.execute(
                    select(Work).where(Work.volume_id == vol_id)
                ).scalars().all()

            if relevant_works:
                for work in relevant_works:
                    if work.id in seen_work_ids:
                        continue
                    results.append(TraceResult(
                        relationship_id=None, role=None, level=None,
                        volume_id=vol_id,
                        serial=volume.serial,
                        repository_volume_number=volume.repository_volume_number,
                        work_id=work.id, work_title=work.title,
                        evidence_annotation_id=None, evidence_annotation_type=None,
                        evidence_text=None, evidence_image_location=None,
                        evidence_source=None, notes=None,
                    ))
            elif vol_id not in seen_volume_level_ids:
                results.append(TraceResult(
                    relationship_id=None, role=None, level=None,
                    volume_id=vol_id,
                    serial=volume.serial,
                    repository_volume_number=volume.repository_volume_number,
                    work_id=None, work_title=None,
                    evidence_annotation_id=None, evidence_annotation_type=None,
                    evidence_text=None, evidence_image_location=None,
                    evidence_source=None, notes=None,
                ))

    results.sort(key=lambda r: (r.role or "", r.serial))
    return results
