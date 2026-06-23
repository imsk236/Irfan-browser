from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import relationships as svc
from ..services.errors import ResourceNotFoundError

router = APIRouter(prefix="/relationships", tags=["relationships"])


class RelationshipCreate(BaseModel):
    person_id: int
    level: str  # 'work' | 'volume'
    work_id: int | None = None
    volume_id: int | None = None
    role: str
    evidence_source: str | None = None
    evidence_annotation_id: int | None = None
    notes: str | None = None


class RelationshipOut(BaseModel):
    id: int
    person_id: int
    level: str
    work_id: int | None
    volume_id: int | None
    role: str
    evidence_source: str | None
    evidence_annotation_id: int | None
    notes: str | None

    model_config = {"from_attributes": True}


@router.post("", response_model=RelationshipOut, status_code=201)
def create_relationship(body: RelationshipCreate):
    with get_session() as session:
        try:
            if body.level == "work":
                if body.work_id is None:
                    raise HTTPException(status_code=422, detail="work_id مطلوب لمستوى الأثر")
                rel = svc.link_person_to_work(
                    session,
                    person_id=body.person_id,
                    work_id=body.work_id,
                    role=body.role,
                    evidence_source=body.evidence_source,
                    evidence_annotation_id=body.evidence_annotation_id,
                    notes=body.notes,
                )
            elif body.level == "volume":
                if body.volume_id is None:
                    raise HTTPException(status_code=422, detail="volume_id مطلوب لمستوى المجلد")
                rel = svc.link_person_to_volume(
                    session,
                    person_id=body.person_id,
                    volume_id=body.volume_id,
                    role=body.role,
                    evidence_source=body.evidence_source,
                    evidence_annotation_id=body.evidence_annotation_id,
                    notes=body.notes,
                )
            else:
                raise HTTPException(status_code=422, detail="level يجب أن يكون 'work' أو 'volume'")

            return RelationshipOut.model_validate(rel)
        except HTTPException:
            raise
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.get("/by-volume/{volume_id}", response_model=list[RelationshipOut])
def list_relationships_for_volume(volume_id: int):
    from sqlalchemy import select
    from ..db.models import PersonRelationship, Work
    with get_session() as session:
        volume_rels = session.execute(
            select(PersonRelationship).where(
                PersonRelationship.level == "volume",
                PersonRelationship.volume_id == volume_id,
            )
        ).scalars().all()
        work_ids = session.execute(
            select(Work.id).where(Work.volume_id == volume_id)
        ).scalars().all()
        work_rels = session.execute(
            select(PersonRelationship).where(
                PersonRelationship.level == "work",
                PersonRelationship.work_id.in_(work_ids),
            )
        ).scalars().all()
        all_rels = list(volume_rels) + list(work_rels)
        return [RelationshipOut.model_validate(r) for r in all_rels]


@router.delete("/{relationship_id}", status_code=204)
def delete_relationship(relationship_id: int):
    with get_session() as session:
        try:
            svc.delete_relationship(session, relationship_id)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
