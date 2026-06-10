from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import persons as svc

router = APIRouter(prefix="/persons", tags=["persons"])


class PersonCreate(BaseModel):
    preferred_name: str
    ism: str | None = None
    nisba_1: str | None = None
    nisba_2: str | None = None
    laqab: str | None = None
    notes: str | None = None


class PersonUpdate(BaseModel):
    preferred_name: str | None = None
    ism: str | None = None
    nisba_1: str | None = None
    nisba_2: str | None = None
    laqab: str | None = None
    notes: str | None = None


class NameVariantAdd(BaseModel):
    written_form: str
    source_annotation_id: int | None = None
    notes: str | None = None


class AncestorsUpdate(BaseModel):
    ancestors: list[str]


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
    notes: str | None

    model_config = {"from_attributes": True}


class PersonMatchOut(BaseModel):
    person_id: int
    preferred_name: str
    written_form: str
    score: float
    match_type: str


@router.get("/search", response_model=list[PersonMatchOut])
def search_persons(q: str = "", limit: int = 10):
    """Arabic-tolerant person search — the inline matcher used in all person fields."""
    with get_session() as session:
        candidates = svc.find_candidates(session, q, limit=limit)
        return [PersonMatchOut(**vars(c)) for c in candidates]


@router.post("", response_model=PersonOut, status_code=201)
def create_person(body: PersonCreate):
    with get_session() as session:
        person = svc.create_person(
            session,
            preferred_name=body.preferred_name,
            ism=body.ism,
            nisba_1=body.nisba_1,
            nisba_2=body.nisba_2,
            laqab=body.laqab,
            notes=body.notes,
        )
        return PersonOut.model_validate(person)


@router.get("", response_model=list[PersonOut])
def list_persons():
    with get_session() as session:
        persons = svc.list_persons(session)
        return [PersonOut.model_validate(p) for p in persons]


@router.get("/{person_id}", response_model=PersonOut)
def get_person(person_id: int):
    with get_session() as session:
        person = svc.get_person(session, person_id)
        if not person:
            raise HTTPException(status_code=404, detail="الشخص غير موجود")
        return PersonOut.model_validate(person)


@router.patch("/{person_id}", response_model=PersonOut)
def update_person(person_id: int, body: PersonUpdate):
    updates = body.model_dump(exclude_none=True)
    with get_session() as session:
        try:
            person = svc.update_person(session, person_id, **updates)
            return PersonOut.model_validate(person)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


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


@router.put("/{person_id}/ancestors", status_code=204)
def set_ancestors(person_id: int, body: AncestorsUpdate):
    with get_session() as session:
        svc.set_ancestors(session, person_id, body.ancestors)
