from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import volumes as svc
from ..services.errors import ResourceNotFoundError

router = APIRouter(prefix="/volumes", tags=["volumes"])


class RepositoryCreate(BaseModel):
    place_key: str
    name: str
    location: str | None = None
    notes: str | None = None


class RepositoryUpdate(BaseModel):
    place_key: str | None = None
    name: str | None = None
    location: str | None = None
    notes: str | None = None


class RepositoryOut(BaseModel):
    id: int
    place_key: str
    name: str
    location: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class VolumeCreate(BaseModel):
    repository_id: int
    repository_volume_number: int | None = None
    folio_count: int | None = None
    notes: str | None = None


class VolumeUpdate(BaseModel):
    repository_id: int | None = None
    document_number: int | None = None
    repository_volume_number: int | None = None
    folio_count: int | None = None
    notes: str | None = None


class VolumeOut(BaseModel):
    id: int
    repository_id: int
    document_number: int
    serial: str
    repository_volume_number: int | None
    folio_count: int | None
    notes: str | None

    model_config = {"from_attributes": True}


@router.post("/repositories", response_model=RepositoryOut, status_code=201)
def create_repository(body: RepositoryCreate):
    with get_session() as session:
        try:
            repo = svc.create_repository(session, body.place_key, body.name, body.location, body.notes)
            return RepositoryOut.model_validate(repo)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.get("/repositories", response_model=list[RepositoryOut])
def list_repositories():
    from sqlalchemy import select
    from ..db.models import Repository
    with get_session() as session:
        rows = session.execute(select(Repository).order_by(Repository.place_key)).scalars().all()
        return [RepositoryOut.model_validate(r) for r in rows]


@router.get("/repositories/{repo_id}", response_model=RepositoryOut)
def get_repository(repo_id: int):
    with get_session() as session:
        try:
            repo = svc.get_repository(session, repo_id)
            return RepositoryOut.model_validate(repo)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.patch("/repositories/{repo_id}", response_model=RepositoryOut)
def update_repository(repo_id: int, body: RepositoryUpdate):
    updates = body.model_dump(exclude_none=True)
    with get_session() as session:
        try:
            repo = svc.update_repository(session, repo_id, **updates)
            return RepositoryOut.model_validate(repo)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.delete("/repositories/{repo_id}", status_code=204)
def delete_repository(repo_id: int):
    with get_session() as session:
        try:
            svc.delete_repository(session, repo_id)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.get("/next-document-number", response_model=int)
def next_document_number(repository_id: int):
    with get_session() as session:
        try:
            return svc.next_document_number(session, repository_id)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.post("", response_model=VolumeOut, status_code=201)
def create_volume(body: VolumeCreate):
    with get_session() as session:
        try:
            volume = svc.create_volume(
                session,
                repository_id=body.repository_id,
                repository_volume_number=body.repository_volume_number,
                folio_count=body.folio_count,
                notes=body.notes,
            )
            return VolumeOut.model_validate(volume)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=list[VolumeOut])
def list_volumes():
    with get_session() as session:
        volumes = svc.list_volumes(session)
        return [VolumeOut.model_validate(v) for v in volumes]


@router.get("/{volume_id}", response_model=VolumeOut)
def get_volume(volume_id: int):
    with get_session() as session:
        volume = svc.get_volume(session, volume_id)
        if not volume:
            raise HTTPException(status_code=404, detail="المجلد غير موجود")
        return VolumeOut.model_validate(volume)


@router.patch("/{volume_id}", response_model=VolumeOut)
def update_volume(volume_id: int, body: VolumeUpdate):
    updates = body.model_dump(exclude_none=True)
    with get_session() as session:
        try:
            volume = svc.update_volume(session, volume_id, **updates)
            return VolumeOut.model_validate(volume)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{volume_id}", status_code=204)
def delete_volume(volume_id: int):
    with get_session() as session:
        try:
            svc.delete_volume(session, volume_id)
        except ResourceNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
