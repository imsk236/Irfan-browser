from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import works as svc

router = APIRouter(prefix="/works", tags=["works"])


class WorkCreate(BaseModel):
    volume_id: int
    title: str
    work_type: str | None = None
    start_unit: str | None = None
    end_unit: str | None = None
    notes: str | None = None


class WorkUpdate(BaseModel):
    title: str | None = None
    work_type: str | None = None
    start_unit: str | None = None
    end_unit: str | None = None
    notes: str | None = None


class WorkOut(BaseModel):
    id: int
    volume_id: int
    title: str
    work_type: str | None
    start_unit: str | None
    end_unit: str | None
    notes: str | None

    model_config = {"from_attributes": True}


@router.post("", response_model=WorkOut, status_code=201)
def create_work(body: WorkCreate):
    with get_session() as session:
        work = svc.create_work(
            session,
            volume_id=body.volume_id,
            title=body.title,
            work_type=body.work_type,
            start_unit=body.start_unit,
            end_unit=body.end_unit,
            notes=body.notes,
        )
        return WorkOut.model_validate(work)


@router.get("/by-volume/{volume_id}", response_model=list[WorkOut])
def list_works_for_volume(volume_id: int):
    with get_session() as session:
        works = svc.list_works_for_volume(session, volume_id)
        return [WorkOut.model_validate(w) for w in works]


@router.get("/{work_id}", response_model=WorkOut)
def get_work(work_id: int):
    with get_session() as session:
        work = svc.get_work(session, work_id)
        if not work:
            raise HTTPException(status_code=404, detail="الأثر غير موجود")
        return WorkOut.model_validate(work)


@router.patch("/{work_id}", response_model=WorkOut)
def update_work(work_id: int, body: WorkUpdate):
    updates = body.model_dump(exclude_none=True)
    with get_session() as session:
        try:
            work = svc.update_work(session, work_id, **updates)
            return WorkOut.model_validate(work)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{work_id}", status_code=204)
def delete_work(work_id: int):
    with get_session() as session:
        svc.delete_work(session, work_id)
