from fastapi import APIRouter
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import trace as svc

router = APIRouter(prefix="/trace", tags=["trace"])


class TraceResultOut(BaseModel):
    relationship_id: int
    role: str
    level: str
    confidence: str
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


@router.get("/{person_id}", response_model=list[TraceResultOut])
def trace_scholar(person_id: int):
    """Return all manuscript links for a scholar, sorted by role then serial."""
    with get_session() as session:
        results = svc.trace_scholar(session, person_id)
        return [TraceResultOut(**vars(r)) for r in results]
