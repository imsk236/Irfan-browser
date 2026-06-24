import os
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from ..services import export as svc
from ..services import export_excel as excel_svc
from ..services import export_pdf as pdf_svc

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    output_dir: str
    researcher_name: str = ""


@router.post("/csv")
def export_csv(body: ExportRequest):
    try:
        files = svc.export_csv(body.output_dir)
        return {"files": files}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="فشل التصدير. تحقق من المسار والصلاحيات.")


@router.post("/json")
def export_json(body: ExportRequest):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    output_path = os.path.join(body.output_dir, f"ارشيف_عرفان_{timestamp}.json")
    try:
        path = svc.export_json(output_path)
        return {"file": path}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="فشل التصدير. تحقق من المسار والصلاحيات.")


@router.post("/excel")
def export_excel(body: ExportRequest):
    try:
        path = excel_svc.export_excel(body.output_dir, body.researcher_name)
        return {"file": path}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="فشل تصدير Excel. تحقق من المسار والصلاحيات.")


@router.get("/pdf-html", response_class=HTMLResponse)
def export_pdf_html(researcher: str = Query(default="")):
    try:
        html = pdf_svc.export_pdf_html(researcher)
        return HTMLResponse(content=html)
    except Exception as e:
        raise HTTPException(status_code=500, detail="فشل توليد ملف PDF.")
