from fastapi import APIRouter
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import trace as svc

router = APIRouter(prefix="/trace", tags=["trace"])


class TraceResultOut(BaseModel):
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


class WilayaScholarOut(BaseModel):
    person_id: int
    preferred_name: str
    appearance_count: int


class WilayaCopyOut(BaseModel):
    work_id: int
    work_title: str
    serial: str
    repository_volume_number: int | None
    copier_name: str | None


class WilayaRepositoryOut(BaseModel):
    repository_id: int
    name: str
    place_key: str
    volume_count: int


class WilayaTraceOut(BaseModel):
    scholars: list[WilayaScholarOut]
    copies: list[WilayaCopyOut]
    repositories: list[WilayaRepositoryOut]


# /wilaya must be registered before /{person_id} so FastAPI doesn't try to
# coerce the literal string "wilaya" as an integer person_id.
@router.get("/wilaya", response_model=WilayaTraceOut)
def trace_wilaya(name: str):
    """Return scholars, copied works, and repositories associated with a wilaya."""
    with get_session() as session:
        result = svc.trace_wilaya(session, name)
        return WilayaTraceOut(
            scholars=[WilayaScholarOut(**vars(s)) for s in result.scholars],
            copies=[WilayaCopyOut(**vars(c)) for c in result.copies],
            repositories=[WilayaRepositoryOut(**vars(r)) for r in result.repositories],
        )


@router.get("/{person_id}", response_model=list[TraceResultOut])
def trace_scholar(person_id: int):
    """Return all manuscript links for a scholar, sorted by role then serial."""
    with get_session() as session:
        results = svc.trace_scholar(session, person_id)
        return [TraceResultOut(**vars(r)) for r in results]
