from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import trace as svc

router = APIRouter(prefix="/trace", tags=["trace"])


class TraceResultOut(BaseModel):
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


@router.get("", response_model=list[TraceResultOut])
def search(
    person_id: int | None = None,
    region: str | None = None,
    copy_place: str | None = None,
    title: str | None = None,
    number: str | None = None,
    repository_id: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
):
    """Unified البحث والتتبع search — شخص/منطقة العالم/مكان النسخ/عنوان/رقم/خزانة/سنة النسخ, all optional and combinable."""
    with get_session() as session:
        try:
            results = svc.trace_scholar(
                session,
                person_id=person_id,
                region=region,
                copy_place=copy_place,
                title=title,
                number=number,
                repository_id=repository_id,
                year_from=year_from,
                year_to=year_to,
            )
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        return [TraceResultOut(**vars(r)) for r in results]
