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

Current chain: `001_baseline` → `002_person_biographical_fields` → `003_add_repository_volume_number` → `004_repository_location_drop_kind` → `005_volume_drop_library_shelfmark` → `006_work_copy_date_drop_type` → `007_annotation_drop_date_fields` → `008_person_wilayas_nasab`

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

Dropdowns backed by the `vocab` table use `<VocabSelect category="..." />`. Categories: `annotation_type`, `confidence`, `evidence_source`, `role`. Seed data in `backend/src/db/seed.py`.

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

## Releasing updates to the client

### How updates work

The app uses `electron-updater` pointed at GitHub Releases (`imsk236/Irfan-browser`). On launch (production only), the Electron main process checks for a newer release after a 3-second delay. If one exists, a banner appears in the Arabic UI guiding the user through download and restart. The client's database (`archive.db`) lives in `AppData\Roaming\com.irfan.manuscript-archive\` and is never touched by updates.

### Release pipeline

Pushing a `v*.*.*` git tag triggers `.github/workflows/release.yml` (GitHub Actions, `windows-latest`). The workflow:

1. Builds `backend.exe` via PyInstaller (`backend/backend.spec`)
2. Builds the frontend via Vite
3. Packages the Electron NSIS installer via `electron-builder --publish always`
4. Publishes the installer + `latest.yml` to GitHub Releases

The `GH_TOKEN` secret (repo scope) must exist in the repo's Actions secrets for publishing to work.

### Shipping a new version

```bash
# 1. Bump the version in electron/package.json (the version electron-builder reads)
#    Use one of:
npm version patch --workspace=electron --no-git-tag-version   # 0.2.0 → 0.2.1
npm version minor --workspace=electron --no-git-tag-version   # 0.2.0 → 0.3.0

# 2. Commit, tag, and push — the tag triggers the build
git add electron/package.json
git commit -m "chore: bump version to 0.2.1"
git tag v0.2.1
git push && git push --tags
```

Build takes ~10-15 minutes. Monitor at `github.com/imsk236/Irfan-browser/actions`.

### First delivery is always manual

Any client running a build older than v0.2.0 has no updater code. They must receive the new installer by hand once. After installing v0.2.0+, all future updates are automatic.

### Version numbers

- `electron/package.json` — the authoritative version; must match the git tag (e.g. `0.2.1` ↔ `v0.2.1`)
- Root `package.json` — npm workspace tooling only; does not affect the built app
- Never create tags manually; always use `npm version` + `git tag` so they stay in sync

### If the GitHub Actions build fails

Check the Actions log at `github.com/imsk236/Irfan-browser/actions`. Common causes:
- `GH_TOKEN` secret missing or expired → recreate at GitHub → Settings → Developer settings → Personal access tokens
- PyInstaller error → usually a missing hidden import; update `backend/backend.spec`
- `npm ci` lock file mismatch → run `npm install` locally and commit the updated `package-lock.json`

## Git workflow

### When to commit

Commit after each self-contained unit of work — not after every file save, and not only at the end of a session. Good commit points:

- A migration + its matching model/schema/service changes all pass tests
- A new screen or component is wired up end-to-end and visually correct
- A bug is fixed and the fix is verified
- A documentation update is complete
- A prototype milestone is reached (e.g. "prototype 2 complete")

Do **not** wait until "everything is done" — small, focused commits make it easy to bisect regressions and roll back individual changes without losing unrelated work.

### How to commit

Always run backend tests before committing backend changes:

```bash
cd backend && uv run pytest
```

Stage specific files rather than `git add .` to avoid accidentally committing `dev_archive.db`, `.env`, or screenshot dumps:

```bash
git add backend/src/... frontend/src/... docs/...
git commit -m "feat: describe what changed and why"
```

Commit message conventions:

| Prefix | Use |
|---|---|
| `feat:` | new feature or screen |
| `fix:` | bug fix |
| `refactor:` | code restructure with no behavior change |
| `test:` | adding or updating tests |
| `docs:` | documentation only |
| `migration:` | schema migration (pair with the model change in the same commit) |
| `chore:` | dependency updates, config, tooling |

Never commit: `dev_archive.db`, `archive.db`, `Tempshots/`, `.env`, `node_modules/`, `__pycache__/`, build output.

---

## Key domain concepts

- **Witness vs interpretation** — `*_as_written` fields are verbatim transcriptions (immutable evidence). Normalized/interpreted fields carry a confidence level.
- **Serial** — `PPPP-DDDD` format, auto-generated from `repository.place_key` + `volume.document_number`. Never hand-typed. Components editable; serial regenerates automatically.
- **رقم المجلد في الخزانة** — optional integer, the volume's number within the physical repository (`repository_volume_number` in DB), manually entered and separate from the serial.
- **Relationships** link persons to volumes or works via roles (مؤلف، ناسخ، مالك، مستعير، واقف، مقيّد، مذكور). The `level` field is `"volume"` or `"work"`.
- **Annotations (قيود)** are physical inscriptions on a manuscript — ownership marks, reading certificates, etc. They can be linked to a specific work within a volume. Dates are **not** tracked on قيود.
- **person_wilayas** — junction table linking a person to one or more Omani wilayas. Sentinel values: `"مجهول"` (unknown) and `"خارج عُمان"` (outside Oman).
