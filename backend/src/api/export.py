import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from ..db.engine import get_session
from ..services import export as svc

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    output_dir: str


@router.post("/csv")
def export_csv(body: ExportRequest):
    try:
        files = svc.export_csv(body.output_dir)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/json")
def export_json(body: ExportRequest):
    output_path = os.path.join(body.output_dir, "archive_dump.json")
    try:
        path = svc.export_json(output_path)
        return {"file": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
