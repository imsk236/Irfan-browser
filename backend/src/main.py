"""FastAPI backend for the Omani Manuscript Archive.

Prints the bound port to stdout so the Electron main process can read it.
"""
import argparse
import asyncio
import os
import socket
import sys
import uuid
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from .db.engine import init_db
from .api import volumes, works, annotations, persons, relationships, trace, export, vocab, dashboard
from .services.activity import set_commit_id


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def _arabic_integrity_detail(exc: IntegrityError) -> str:
    """Map known SQLite constraint names to Arabic user-facing messages."""
    orig = str(exc.orig) if exc.orig else ""

    if "repositories.place_key" in orig:
        return "مفتاح المستودع مستخدم بالفعل. اختر مفتاحاً مختلفاً."
    if "volumes.serial" in orig:
        return "الرقم التسلسلي مكرر. لا يمكن إنشاء وثيقتين بالرقم نفسه."
    if "volumes.repository_id" in orig and "document_number" in orig:
        return "رقم الوثيقة مستخدم بالفعل في هذا المستودع."
    if "person_name_variants" in orig and "written_form" in orig:
        return "هذه التهجئة مسجلة بالفعل لهذا الشخص."
    if "vocab" in orig and ("category" in orig or "value" in orig):
        return "هذه القيمة موجودة بالفعل في القائمة."
    if "FOREIGN KEY" in orig:
        return "مرجع غير صالح: السجل المرتبط غير موجود."
    return "تعارض في البيانات"


def create_app() -> FastAPI:
    app = FastAPI(title="Omani Manuscript Archive API", docs_url="/docs", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def commit_id_middleware(request: Request, call_next):
        """Assign a UUID commit_id to every mutating request.

        The ContextVar is copied into the worker thread when FastAPI runs sync
        route handlers via run_in_executor, so service functions see the same
        value without extra plumbing.
        """
        if request.method in ("POST", "PATCH", "PUT", "DELETE"):
            set_commit_id(str(uuid.uuid4()))
        else:
            set_commit_id(None)
        return await call_next(request)

    app.include_router(volumes.router)
    app.include_router(works.router)
    app.include_router(annotations.router)
    app.include_router(persons.router)
    app.include_router(relationships.router)
    app.include_router(trace.router)
    app.include_router(export.router)
    app.include_router(vocab.router)
    app.include_router(dashboard.router)

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_request: Request, exc: IntegrityError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"detail": _arabic_integrity_detail(exc)},
        )

    return app


app = create_app()


def check_db_lock(db_path: str) -> bool:
    """Return True if the database is available, False if another writer holds it."""
    import sqlite3
    try:
        conn = sqlite3.connect(db_path, timeout=1)
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("ROLLBACK")
        conn.close()
        return True
    except sqlite3.OperationalError:
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="archive.db", help="Path to the SQLite database file")
    parser.add_argument("--port", type=int, default=0, help="Port (0 = auto)")
    args = parser.parse_args()

    os.environ["DB_PATH"] = args.db

    # WAL lock check — new file always passes
    if os.path.exists(args.db) and not check_db_lock(args.db):
        print("BACKEND_LOCKED", flush=True)
        sys.exit(1)

    port = args.port if args.port != 0 else find_free_port()

    async def _serve() -> None:
        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
        server = uvicorn.Server(config)

        async def _announce() -> None:
            while not server.started:
                await asyncio.sleep(0.05)
            print(f"BACKEND_PORT={port}", flush=True)

        await asyncio.gather(server.serve(), _announce())

    asyncio.run(_serve())


if __name__ == "__main__":
    main()
