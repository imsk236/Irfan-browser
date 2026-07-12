# ADR 0007: Simplify the database relocation safety net

**Status:** Accepted

## Context

The custom database location feature (Settings → "اختر موقع قاعدة البيانات") lets the researcher move `archive.db` out of `AppData\Roaming` and onto an external drive or synced folder, so the archive can travel with them or be shared across machines. To guard against silently ending up with two diverging copies of the database, the original implementation added two defensive layers:

1. `findExistingArchiveDb` — a bounded recursive walk of the *entire drive* (depth- and entry-limited) whenever a new location was chosen, looking for a stray `archive.db` anywhere else on that drive and surfacing a "conflict" choice if one turned up.
2. A retry/fallback/quit dialog loop in `resolveDbPath`, triggered every time the configured custom path's folder wasn't reachable at startup (e.g. the external drive wasn't plugged in), looping until the researcher retried, chose the default temporarily, or quit the app.

Both were built for a multi-device sync workflow. In practice they were a significant source of complexity and friction for what is a single-researcher, largely single-machine app.

## Decision

Drop the whole-drive conflict scan and the startup retry-dialog loop. Keep the cheaper checks that don't require scanning or blocking:

- When choosing a new location, if the target folder already contains `archive.db`, adopt it as-is (a plain `existsSync` check — no searching elsewhere on the drive). Otherwise copy the currently active database there.
- If the configured custom path is unreachable at startup, silently fall back to the default `AppData` path for that session only, and log it. The config file (`dbPath`) is left untouched, so the next launch tries the custom path again in case the drive is reconnected.

## Consequences

- The app no longer warns the researcher if two divergent `archive.db` files end up existing across different drives/folders — that failure mode is possible again. Accepted as a reasonable trade for removing the drive-walk and blocking dialogs.
- `findExistingArchiveDb` and the multi-choice "قاعدة البيانات غير موجودة" retry dialog are removed entirely from `electron/src/main.ts`.
- A missing custom drive no longer blocks app launch — the researcher gets working access to the default database instead of being stuck at a dialog.
