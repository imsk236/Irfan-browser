from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import select
from rapidfuzz import process as rf_process, fuzz
from ..db.models import Person, PersonNameVariant, PersonAncestor
from ..utils.arabic import normalize_arabic

_FUZZY_SCORE_THRESHOLD = 75


@dataclass
class PersonMatch:
    person_id: int
    preferred_name: str
    written_form: str
    score: float
    match_type: str  # exact_written | exact_normalized | prefix | token | fuzzy


def find_candidates(session: Session, query: str, limit: int = 10) -> list[PersonMatch]:
    """Staged Arabic-tolerant person search. Returns ranked candidates.

    The service never auto-merges — it returns matches for the user to decide.
    """
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

    # Stage 1: exact match on written_form
    for v in all_variants:
        if v.written_form == query:
            add_match(v.person, v.written_form, 100.0, "exact_written")

    # Stage 2: exact match on normalized_form
    for v in all_variants:
        if v.normalized_form and v.normalized_form == normalized_query:
            add_match(v.person, v.written_form, 99.0, "exact_normalized")

    # Also match against preferred_name (normalized)
    all_persons = session.execute(select(Person)).scalars().all()
    for p in all_persons:
        if normalize_arabic(p.preferred_name) == normalized_query:
            add_match(p, p.preferred_name, 99.0, "exact_normalized")

    # Stage 3: prefix match on normalized_form
    for v in all_variants:
        norm = v.normalized_form or normalize_arabic(v.written_form)
        if norm.startswith(normalized_query) and len(normalized_query) >= 2:
            add_match(v.person, v.written_form, 90.0, "prefix")

    # Stage 4: token overlap
    query_tokens = set(normalized_query.split())
    for v in all_variants:
        norm = v.normalized_form or normalize_arabic(v.written_form)
        variant_tokens = set(norm.split())
        if query_tokens & variant_tokens:
            add_match(v.person, v.written_form, 80.0, "token")

    # Stage 5: fuzzy similarity via rapidfuzz
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
    notes: str | None = None,
) -> Person:
    """Fast-path create: only preferred_name is required."""
    person = Person(
        preferred_name=preferred_name,
        ism=ism, nisba_1=nisba_1, nisba_2=nisba_2, laqab=laqab, notes=notes,
    )
    session.add(person)
    session.flush()

    # Auto-add the preferred_name as a name variant
    variant = PersonNameVariant(
        person_id=person.id,
        written_form=preferred_name,
        normalized_form=normalize_arabic(preferred_name),
    )
    session.add(variant)
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
        raise ValueError(f"Person {person_id} not found")
    for key, value in kwargs.items():
        setattr(person, key, value)
    session.commit()
    session.refresh(person)
    return person


def get_person(session: Session, person_id: int) -> Person | None:
    return session.get(Person, person_id)


def list_persons(session: Session) -> list[Person]:
    return list(session.execute(select(Person).order_by(Person.preferred_name)).scalars().all())


def set_ancestors(session: Session, person_id: int, ancestors: list[str]) -> None:
    """Replace the full nasab chain for a person."""
    existing = session.execute(
        select(PersonAncestor).where(PersonAncestor.person_id == person_id)
    ).scalars().all()
    for row in existing:
        session.delete(row)

    for i, name in enumerate(ancestors, start=1):
        session.add(PersonAncestor(person_id=person_id, position=i, name=name))
    session.commit()
