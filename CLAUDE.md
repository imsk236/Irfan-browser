# Omani Manuscript Archive — Developer Guide

## What this is

A single-researcher desktop app for cataloging ~400 Omani manuscript volumes and tracing scholars across them. Written in Electron + React/TypeScript (frontend) + Python FastAPI (backend) + SQLite. RTL Arabic UI throughout.

## Running the app

```bash
# Full dev stack (backend + frontend + electron, concurrently)
npm run dev

# Backend only (useful for API testing)
npm run dev:backend          # starts on port 8765, uses dev_archive.db

# Frontend only
npm run dev:frontend         # vite on :5173 (or next free port)
```

Backend tests:
```bash
cd backend
uv run pytest                # all tests, in-memory SQLite
uv run pytest tests/test_volumes.py   # specific file
```

## Architecture

```
/
├── electron/          # Electron main process (Node)
├── frontend/          # Vite + React + TypeScript
│   └── src/
│       ├── api/       # client.ts, index.ts, types.ts
│       ├── components/
│       └── screens/   # volumes/, persons/, trace/, settings/, annotations/
└── backend/           # Python FastAPI
    └── src/
        ├── api/       # FastAPI routers (one file per resource)
        ├── services/  # Business logic (one file per resource)
        ├── db/
        │   ├── models.py   # SQLAlchemy ORM models
        │   ├── engine.py   # Engine singleton, FK pragma, init_db
        │   └── seed.py     # Vocab seed data
        └── main.py    # App entrypoint, port discovery
```

**IPC:** The backend prints `BACKEND_PORT=<n>` to stdout on startup; the Electron main process reads this to know where to connect. On lock contention it prints `BACKEND_LOCKED` and exits 1.

**Frontend API base URL:** Set via `VITE_BACKEND_URL` env var, defaults to `http://localhost:8765`. Electron overrides it at runtime via `setBaseUrl()`.

## Database

- Single SQLite file (`archive.db` in production, `dev_archive.db` in dev)
- WAL mode enabled at startup (`PRAGMA journal_mode=WAL`)
- Foreign keys enforced per-connection via SQLAlchemy event listener

### Migrations (Alembic)

```bash
cd backend
uv run alembic upgrade head          # apply all pending migrations
uv run alembic revision -m "desc"    # create new migration (then edit it)
```

Migration files live in `backend/migrations/versions/`. Follow the established pattern:
- Use `PRAGMA table_info(<table>)` in `upgrade()` for idempotency
- Always use `op.batch_alter_table()` in `downgrade()` (SQLite requires it for column drops)
- All new columns must be `nullable=True` (SQLite can't ADD COLUMN NOT NULL without DEFAULT)

Current chain: `001_baseline` → `002_person_biographical_fields` → `003_add_repository_volume_number`

## Backend patterns

### Adding a field to a resource

1. Migration (`003_*.py` pattern)
2. ORM model (`db/models.py`)
3. Pydantic schemas — `Create`, `Update`, `Out` classes in `api/<resource>.py`
4. Service function — `update_*` uses a generic `setattr()` loop (no change needed). `create_volume` uses a **raw DBAPI INSERT** (BEGIN IMMEDIATE transaction for serial generation) — must update the SQL string and bind values manually.

### The create_volume special case

`services/volumes.py::create_volume` issues a raw `BEGIN IMMEDIATE` transaction via `engine.connect().connection.driver_connection` to atomically assign `document_number` and build the serial. Any new fields on volume creation must be added to both the function signature and the INSERT string. `update_volume` is a normal `setattr()` loop and needs no changes.

### TraceResult / Appearance

Both `AppearanceOut` (persons API) and `TraceResultOut` (trace API) are served by `services/trace.py::trace_scholar()`. The service builds `TraceResult` dataclasses; both output schemas mirror it. When adding a field that should appear in Persons or Trace screens, update all four: the dataclass, `trace_scholar()`, `AppearanceOut`, and `TraceResultOut`.

### Error handling

- `IntegrityError` is caught globally in `main.py` and mapped to Arabic user messages via `_arabic_integrity_detail()`
- Service-layer `ValueError` → HTTP 422, `ResourceNotFoundError` → HTTP 404
- Do not catch `IntegrityError` in individual service functions

## Frontend patterns

### API layer

`frontend/src/api/types.ts` — all shared TypeScript interfaces  
`frontend/src/api/index.ts` — typed API functions grouped by resource  
`frontend/src/api/client.ts` — bare `fetch` wrapper (GET/POST/PATCH/PUT/DELETE)

When adding a field: update the interface in `types.ts`, then the relevant API call in `index.ts`.

### Vocab fields

Dropdowns backed by the `vocab` table use `<VocabSelect category="..." />`. Categories: `repository_kind`, `work_type`, `annotation_type`, `date_precision`, `confidence`. Seed data in `backend/src/db/seed.py`.

### RTL / styling

All styles are RTL (`dir="rtl"` on `<html>`). Use `marginRight`/`marginLeft` carefully — prefer `marginInlineEnd`/`marginInlineStart` for directional spacing. Design tokens in `frontend/src/styles/tokens.css`, component classes in `components.css`.

## Testing

Tests use in-memory SQLite with `StaticPool` (critical: `create_volume`'s raw `engine.connect()` must see the same connection as the test session). The `engine` fixture patches `src.db.engine._engine` directly. Do not mock the database — tests hit the real schema.

```python
# Typical test structure
def test_something(client, session):
    # client = FastAPI TestClient
    # session = SQLAlchemy session, rolls back after test
```

## Key domain concepts

- **Witness vs interpretation** — `*_as_written` fields are verbatim transcriptions (immutable evidence). Normalized/interpreted fields carry a confidence level.
- **Serial** — `PPPP-DDDD` format, auto-generated from `repository.place_key` + `volume.document_number`. Never hand-typed. Components editable; serial regenerates automatically.
- **رقم المجلد في الخزانة** — optional integer, the volume's number within the physical repository (manually entered, separate from the serial).
- **رقم الخزنة** — the library's own shelfmark string (`library_shelfmark` in DB).
- **Relationships** link persons to volumes or works via roles (مؤلف، ناسخ، مالك، مستعير، واقف، مقيّد، مذكور). The `level` field is `"volume"` or `"work"`.
- **Annotations (قيود)** are physical inscriptions on a manuscript — ownership marks, reading certificates, etc. They can be linked to a specific work within a volume.
