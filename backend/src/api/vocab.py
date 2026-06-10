from fastapi import APIRouter
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import vocab as svc

router = APIRouter(prefix="/vocab", tags=["vocab"])


class VocabValueAdd(BaseModel):
    value: str


class VocabValueOut(BaseModel):
    category: str
    value: str
    sort_order: int
    is_active: bool


@router.get("/{category}", response_model=list[str])
def list_vocab(category: str):
    with get_session() as session:
        return svc.list_values(session, category)


@router.post("/{category}", status_code=201)
def add_vocab(category: str, body: VocabValueAdd):
    with get_session() as session:
        row = svc.add_value(session, category, body.value)
        return {"category": row.category, "value": row.value}


@router.delete("/{category}/{value}", status_code=204)
def deactivate_vocab(category: str, value: str):
    with get_session() as session:
        svc.deactivate_value(session, category, value)
