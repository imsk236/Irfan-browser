from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import annotations as svc
from ..services.errors import ResourceNotFoundError

router = APIRouter(prefix="/annotations", tags=["annotations"])


class AnnotationCreate(BaseModel):
    volume_id: int
    annotation_type: str
    work_id: int | None = None
    text_as_written: str | None = None
    image_location: str | None = None
    notes: str | None = None


class AnnotationUpdate(BaseModel):
    annotation_type: str | None = None
    work_id: int | None = None
    text_as_written: str | None = None
    image_location: str | None = None
    notes: str | None = None


class AnnotationOut(BaseModel):
    id: int
    volume_id: int
    work_id: int | None
    annotation_type: str
    text_as_written: str | None
    image_location: str | None
    notes: str | None

    model_config = {"from_attributes": True}


@router.post("", response_model=AnnotationOut, status_code=201)
def create_annotation(body: AnnotationCreate):
    with get_session() as session:
        try:
            annotation = svc.create_annotation(
                session,
                volume_id=body.volume_id,
                annotation_type=body.annotation_type,
                work_id=body.work_id,
                text_as_written=body.text_as_written,
                image_location=body.image_location,
                notes=body.notes,
            )
            return AnnotationOut.model_validate(annotation)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.get("/by-volume/{volume_id}", response_model=list[AnnotationOut])
def list_annotations_for_volume(volume_id: int):
    with get_session() as session:
        annotations = svc.list_annotations_for_volume(session, volume_id)
        return [AnnotationOut.model_validate(a) for a in annotations]


@router.get("/{annotation_id}", response_model=AnnotationOut)
def get_annotation(annotation_id: int):
    with get_session() as session:
        annotation = svc.get_annotation(session, annotation_id)
        if not annotation:
            raise HTTPException(status_code=404, detail="القيد غير موجود")
        return AnnotationOut.model_validate(annotation)


@router.patch("/{annotation_id}", response_model=AnnotationOut)
def update_annotation(annotation_id: int, body: AnnotationUpdate):
    updates = body.model_dump(exclude_none=True)
    with get_session() as session:
        try:
            annotation = svc.update_annotation(session, annotation_id, **updates)
            return AnnotationOut.model_validate(annotation)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{annotation_id}", status_code=204)
def delete_annotation(annotation_id: int):
    with get_session() as session:
        try:
            svc.delete_annotation(session, annotation_id)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
