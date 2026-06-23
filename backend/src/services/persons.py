from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from rapidfuzz import process as rf_process, fuzz
from ..db.models import Person, PersonNameVariant, PersonRelationship, PersonWilaya
from ..utils.arabic import normalize_arabic
from .errors import ResourceNotFoundError
from .activity import log_activity

_FUZZY_SCORE_THRESHOLD = 75


@dataclass
class PersonMatch:
    person_id: int
    preferred_name: str
    written_form: str
    score: float
    match_type: str  # exact_written | exact_normalized | prefix | token | fuzzy


def find_candidates(session: Session, query: str, limit: int = 10) -> list[PersonMatch]:
    """Staged Arabic-tolerant person search. Returns ranked candidates."""
    if not query.strip():
        return []

    normalized_query = normalize_arabic(query)
    results: list[PersonMatch] = []
    seen_ids: set[int] = set()

    def add_match(person: Person, written: str, score: float, match_type: str):
        if person.id not in seen_ids:
            seen_ids.add(person.id)
            results.append(PersonMatch(
                person_id=person.id,
                preferred_name=person.preferred_name,
                written_form=written,
                score=score,
                match_type=match_type,
            ))

    all_variants = session.execute(
        select(PersonNameVariant).join(Person)
    ).scalars().all()

    for v in all_variants:
        if v.written_form == query:
            add_match(v.person, v.written_form, 100.0, "exact_written")

    for v in all_variants:
        if v.normalized_form and v.normalized_form == normalized_query:
            add_match(v.person, v.written_form, 99.0, "exact_normalized")

    all_persons = session.execute(select(Person)).scalars().all()
    for p in all_persons:
        if normalize_arabic(p.preferred_name) == normalized_query:
            add_match(p, p.preferred_name, 99.0, "exact_normalized")

    for v in all_variants:
        norm = v.normalized_form or normalize_arabic(v.written_form)
        if norm.startswith(normalized_query) and len(normalized_query) >= 2:
            add_match(v.person, v.written_form, 90.0, "prefix")

    query_tokens = set(normalized_query.split())
    for v in all_variants:
        norm = v.normalized_form or normalize_arabic(v.written_form)
        variant_tokens = set(norm.split())
        if query_tokens & variant_tokens:
            add_match(v.person, v.written_form, 80.0, "token")

    norm_map: dict[str, list[tuple[Person, str]]] = {}
    for v in all_variants:
        norm = v.normalized_form or normalize_arabic(v.written_form)
        norm_map.setdefault(norm, []).append((v.person, v.written_form))

    fuzzy_hits = rf_process.extract(
        normalized_query,
        list(norm_map.keys()),
        scorer=fuzz.WRatio,
        limit=limit * 2,
        score_cutoff=_FUZZY_SCORE_THRESHOLD,
    )
    for match_str, score, _ in fuzzy_hits:
        for person, written in norm_map[match_str]:
            add_match(person, written, float(score), "fuzzy")

    return results[:limit]


def create_person(
    session: Session,
    preferred_name: str,
    ism: str | None = None,
    nisba_1: str | None = None,
    nisba_2: str | None = None,
    laqab: str | None = None,
    nasab: str | None = None,
    notes: str | None = None,
    kunya: str | None = None,
    known_as: str | None = None,
    birth_date_as_written: str | None = None,
    birth_year_earliest: int | None = None,
    birth_year_latest: int | None = None,
    death_date_as_written: str | None = None,
    death_year_earliest: int | None = None,
    death_year_latest: int | None = None,
    birth_place: str | None = None,
    death_place: str | None = None,
) -> Person:
    person = Person(
        preferred_name=preferred_name,
        ism=ism, nisba_1=nisba_1, nisba_2=nisba_2, laqab=laqab, nasab=nasab, notes=notes,
        kunya=kunya, known_as=known_as,
        birth_date_as_written=birth_date_as_written,
        birth_year_earliest=birth_year_earliest,
        birth_year_latest=birth_year_latest,
        death_date_as_written=death_date_as_written,
        death_year_earliest=death_year_earliest,
        death_year_latest=death_year_latest,
        birth_place=birth_place,
        death_place=death_place,
    )
    session.add(person)
    session.flush()

    variant = PersonNameVariant(
        person_id=person.id,
        written_form=preferred_name,
        normalized_form=normalize_arabic(preferred_name),
    )
    session.add(variant)
    log_activity(session, "persons", person.id, "create", preferred_name)
    session.commit()
    session.refresh(person)
    return person


def add_name_variant(
    session: Session,
    person_id: int,
    written_form: str,
    source_annotation_id: int | None = None,
    notes: str | None = None,
) -> PersonNameVariant:
    variant = PersonNameVariant(
        person_id=person_id,
        written_form=written_form,
        normalized_form=normalize_arabic(written_form),
        source_annotation_id=source_annotation_id,
        notes=notes,
    )
    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


def update_person(session: Session, person_id: int, **kwargs) -> Person:
    person = session.get(Person, person_id)
    if not person:
        raise ResourceNotFoundError("الشخص غير موجود")
    for key, value in kwargs.items():
        setattr(person, key, value)
    if "preferred_name" in kwargs:
        session.execute(
            text(
                "INSERT OR IGNORE INTO person_name_variants"
                " (person_id, written_form, normalized_form)"
                " VALUES (:pid, :wf, :nf)"
            ),
            {"pid": person_id, "wf": kwargs["preferred_name"],
             "nf": normalize_arabic(kwargs["preferred_name"])},
        )
    log_activity(session, "persons", person_id, "update", person.preferred_name)
    session.commit()
    session.refresh(person)
    return person


def delete_person(session: Session, person_id: int) -> None:
    person = session.get(Person, person_id)
    if not person:
        raise ResourceNotFoundError("الشخص غير موجود")

    rels = session.execute(
        select(PersonRelationship).where(PersonRelationship.person_id == person_id)
    ).scalars().all()

    if rels:
        raise ValueError(
            f"لا يمكن حذف هذا الشخص لوجود {len(rels)} صلة مرتبطة به في الأرشيف. "
            "احذف الصلات أولاً ثم أعد المحاولة."
        )

    preferred_name = person.preferred_name
    session.execute(text("DELETE FROM person_name_variants WHERE person_id = :pid"), {"pid": person_id})
    session.execute(text("DELETE FROM person_wilayas WHERE person_id = :pid"), {"pid": person_id})
    session.execute(text("DELETE FROM persons WHERE id = :pid"), {"pid": person_id})
    log_activity(session, "persons", person_id, "delete", preferred_name)
    session.commit()


def get_person(session: Session, person_id: int) -> Person | None:
    return session.get(Person, person_id)


def list_persons(session: Session) -> list[Person]:
    return list(session.execute(select(Person).order_by(Person.preferred_name)).scalars().all())


def get_wilayas(session: Session, person_id: int) -> list[str]:
    rows = session.execute(
        select(PersonWilaya).where(PersonWilaya.person_id == person_id)
    ).scalars().all()
    return [r.wilaya for r in rows]


def set_wilayas(session: Session, person_id: int, wilayas: list[str]) -> None:
    """Replace all wilayas for a person. 'مجهول' is a valid sentinel value."""
    existing = session.execute(
        select(PersonWilaya).where(PersonWilaya.person_id == person_id)
    ).scalars().all()
    for row in existing:
        session.delete(row)
    for wilaya in wilayas:
        session.add(PersonWilaya(person_id=person_id, wilaya=wilaya))
    session.commit()
