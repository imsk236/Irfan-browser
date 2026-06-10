"""FastAPI backend for the Omani Manuscript Archive.

Prints the bound port to stdout so the Electron main process can read it.
"""
import argparse
import os
import socket
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from .db.engine import init_db
from .api import volumes, works, annotations, persons, relationships, trace, export, vocab


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Omani Manuscript Archive API", docs_url="/docs", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(volumes.router)
    app.include_router(works.router)
    app.include_router(annotations.router)
    app.include_router(persons.router)
    app.include_router(relationships.router)
    app.include_router(trace.router)
    app.include_router(export.router)
    app.include_router(vocab.router)

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_request: Request, exc: IntegrityError) -> JSONResponse:
        detail = str(exc.orig) if exc.orig else "تعارض في البيانات"
        return JSONResponse(status_code=409, content={"detail": detail})

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
    print(f"BACKEND_PORT={port}", flush=True)

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
