# ADR 0008: Back up archive.db before every automatic migration

**Status:** Accepted

## Context

`init_db()` (`backend/src/db/engine.py`) runs `alembic upgrade head` automatically on every backend startup — Electron spawns the backend before the window ever opens, so this happens transparently on every launch, not just after an app update. That's convenient (schema changes ship silently with new versions) but risky: if a migration fails partway or misbehaves, there was no recovery path beyond a manual, out-of-band backup — and the one production `archive.db` holds the researcher's full catalogue of ~400 manuscript volumes.

Removing Alembic was considered and rejected: it's the only mechanism that lets 15 (and counting) generations of schema changes apply to a live database without wiping data, and the whole "adding a field to a resource" workflow in CLAUDE.md is built around it. The actual problem is narrower than "migrations are bad" — it's "auto-upgrade has no safety net."

## Decision

Before calling `alembic_command.upgrade(alembic_cfg, "head")`, copy `archive.db` (and its `-wal`/`-shm` sidecars, if present) to a single backup file next to it, overwriting any previous backup. Only the most recent backup is retained — not a rotating history, and not gated behind a "does a migration actually need to run" version check.

## Consequences

- Every launch pays the cost of one file copy, even when no migration is pending. For a single researcher's SQLite archive this is expected to be negligible.
- Only one backup generation exists at any time. If a bad migration goes unnoticed across two consecutive launches, the pre-migration state from the first launch is no longer recoverable through this mechanism — the researcher would need an external backup for that case.
- No config or UI surfaces the backup file; it's a silent safety net, not a feature. If retention needs ever grow (e.g. keeping N generations, or gating on an actual version check), that's a super­seding change to this ADR, not a variation of it.
