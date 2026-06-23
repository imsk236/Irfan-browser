from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import persons as svc
from ..services import trace as trace_svc
from ..services.errors import ResourceNotFoundError

router = APIRouter(prefix="/persons", tags=["persons"])


class PersonCreate(BaseModel):
    preferred_name: str
    ism: str | None = None
    nisba_1: str | None = None
    nisba_2: str | None = None
    laqab: str | None = None
    nasab: str | None = None
    notes: str | None = None
    kunya: str | None = None
    known_as: str | None = None
    birth_date_as_written: str | None = None
    birth_year_earliest: int | None = None
    birth_year_latest: int | None = None
    death_date_as_written: str | None = None
    death_year_earliest: int | None = None
    death_year_latest: int | None = None
    birth_place: str | None = None
    death_place: str | None = None


class PersonUpdate(BaseModel):
    preferred_name: str | None = None
    ism: str | None = None
    nisba_1: str | None = None
    nisba_2: str | None = None
    laqab: str | None = None
    nasab: str | None = None
    notes: str | None = None
    kunya: str | None = None
    known_as: str | None = None
    birth_date_as_written: str | None = None
    birth_year_earliest: int | None = None
    birth_year_latest: int | None = None
    death_date_as_written: str | None = None
    death_year_earliest: int | None = None
    death_year_latest: int | None = None
    birth_place: str | None = None
    death_place: str | None = None


class NameVariantAdd(BaseModel):
    written_form: str
    source_annotation_id: int | None = None
    notes: str | None = None


class WilayasUpdate(BaseModel):
    wilayas: list[str]


class NameVariantOut(BaseModel):
    id: int
    person_id: int
    written_form: str
    normalized_form: str | None
    source_annotation_id: int | None
    notes: str | None

    model_config = {"from_attributes": True}


class PersonOut(BaseModel):
    id: int
    preferred_name: str
    ism: str | None
    nisba_1: str | None
    nisba_2: str | None
    laqab: str | None
    nasab: str | None
    notes: str | None
    kunya: str | None
    known_as: str | None
    birth_date_as_written: str | None
    birth_year_earliest: int | None
    birth_year_latest: int | None
    death_date_as_written: str | None
    death_year_earliest: int | None
    death_year_latest: int | None
    birth_place: str | None
    death_place: str | None
    wilayas: list[str] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_wilayas(cls, person) -> "PersonOut":
        data = {
            col: getattr(person, col)
            for col in cls.model_fields
            if col != "wilayas" and hasattr(person, col)
        }
        data["wilayas"] = [w.wilaya for w in person.wilayas]
        return cls(**data)


class PersonMatchOut(BaseModel):
    person_id: int
    preferred_name: str
    written_form: str
    score: float
    match_type: str


class AppearanceOut(BaseModel):
    """Archive appearance of a person — used by the person profile screen."""
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


@router.get("/search", response_model=list[PersonMatchOut])
def search_persons(q: str = "", limit: int = Query(default=10, le=50)):
    """Arabic-tolerant person search — the inline matcher used in all person fields."""
    with get_session() as session:
        candidates = svc.find_candidates(session, q, limit=limit)
        return [PersonMatchOut(**vars(c)) for c in candidates]


@router.post("", response_model=PersonOut, status_code=201)
def create_person(body: PersonCreate):
    with get_session() as session:
        try:
            person = svc.create_person(session, **body.model_dump())
            return PersonOut.from_orm_with_wilayas(person)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=list[PersonOut])
def list_persons():
    with get_session() as session:
        persons = svc.list_persons(session)
        return [PersonOut.from_orm_with_wilayas(p) for p in persons]


@router.get("/{person_id}", response_model=PersonOut)
def get_person(person_id: int):
    with get_session() as session:
        person = svc.get_person(session, person_id)
        if not person:
            raise HTTPException(status_code=404, detail="الشخص غير موجود")
        return PersonOut.from_orm_with_wilayas(person)


@router.patch("/{person_id}", response_model=PersonOut)
def update_person(person_id: int, body: PersonUpdate):
    updates = body.model_dump(exclude_none=True)
    with get_session() as session:
        try:
            person = svc.update_person(session, person_id, **updates)
            return PersonOut.from_orm_with_wilayas(person)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{person_id}", status_code=204)
def delete_person(person_id: int):
    with get_session() as session:
        try:
            svc.delete_person(session, person_id)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.get("/{person_id}/wilayas", response_model=list[str])
def get_wilayas(person_id: int):
    with get_session() as session:
        return svc.get_wilayas(session, person_id)


@router.put("/{person_id}/wilayas", status_code=204)
def set_wilayas(person_id: int, body: WilayasUpdate):
    with get_session() as session:
        svc.set_wilayas(session, person_id, body.wilayas)


@router.get("/{person_id}/appearances", response_model=list[AppearanceOut])
def get_person_appearances(person_id: int):
    with get_session() as session:
        results = trace_svc.trace_scholar(session, person_id)
        return [AppearanceOut(**vars(r)) for r in results]


@router.get("/{person_id}/variants", response_model=list[NameVariantOut])
def list_name_variants(person_id: int):
    from sqlalchemy import select
    from ..db.models import PersonNameVariant
    with get_session() as session:
        variants = session.execute(
            select(PersonNameVariant).where(PersonNameVariant.person_id == person_id)
        ).scalars().all()
        return [NameVariantOut.model_validate(v) for v in variants]


@router.post("/{person_id}/variants", response_model=NameVariantOut, status_code=201)
def add_name_variant(person_id: int, body: NameVariantAdd):
    with get_session() as session:
        variant = svc.add_name_variant(
            session, person_id, body.written_form,
            source_annotation_id=body.source_annotation_id,
            notes=body.notes,
        )
        return NameVariantOut.model_validate(variant)
