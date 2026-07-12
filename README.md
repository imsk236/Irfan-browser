# أرشيف عرفان للمخطوطات — Omani Manuscript Archive

A desktop app for cataloging Omani manuscript volumes and tracing scholars across them. Built as a single-researcher tool for managing ~400 manuscripts, their contents, and the people (authors, scribes, owners) associated with them — with a fully right-to-left Arabic interface.

## Tech stack

- **Electron** — desktop shell
- **React + TypeScript** (Vite) — frontend UI
- **Python + FastAPI** — backend API
- **SQLite** (SQLAlchemy + Alembic) — storage and migrations

## Screenshots

<!-- TODO: add screenshots -->

## Running locally

```bash
npm install

# Full dev stack (backend + frontend + electron)
npm run dev
```

Backend tests:

```bash
cd backend
uv run pytest
```

## Status

Personal project, actively maintained.
