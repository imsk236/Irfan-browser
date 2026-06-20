# Implementation Audit — Omani Manuscript Archive

**Date:** 2026-06-10  
**Branch:** `main` (commit `d36b3b2`)  
**Auditor:** Claude Sonnet 4.6 (automated)

---

## 1. Executive Summary

The prototype is a working skeleton that proves the three-layer architecture (Electron → React → FastAPI → SQLite) and the serial-generation pipeline. However, **the data model is substantially incomplete**, the **approved visual design has not been applied**, and **automated tests are entirely absent**. The most critical gap is the `Person` ORM model, which is missing fourteen fields defined in the specification — meaning the bulk of biographical data the researcher needs to record cannot be stored or retrieved at all.

Findings total: **47** across all severity levels.

| Severity | Count |
|---|---|
| Blocker | 3 |
| High | 16 |
| Medium | 17 |
| Low | 11 |

The three areas requiring the most urgent attention before any feature work continues:

1. **Person model completeness** — fourteen fields missing; the entire biographical identification system is unusable.
2. **PRAGMA foreign_keys enforcement** — set only once at startup; all pooled database connections operate without referential integrity.
3. **Navigation shell and visual identity** — the current dark-green sidebar is the exact prototype the style guide instructs to replace; the approved logo is unused.

---

## 2. Repository Architecture Observed

```
irfan-browser/
  backend/
    main.py                     ← obsolete scaffold stub (prints "Hello from backend!")
    src/
      main.py                   ← FastAPI application entry point; port-signal IPC; WAL lock check
      db/
        engine.py               ← SQLAlchemy engine, session factory, init_db()
        models.py               ← ORM models (8 tables)
        seed.py                 ← Vocabulary seed (7 categories, missing person_identification_status)
      api/                      ← Thin FastAPI routers (volumes, works, annotations, persons,
                                   relationships, trace, export, vocab)
      services/                 ← Business logic layer (volumes, works, annotations, persons,
                                   relationships, trace, export, vocab)
      utils/
        arabic.py               ← normalize_arabic(): strip diacritics, unify hamza/taa marbuta/alef maqsura
        hijri.py                ← parse_hijri(): packed YYYYMMDD integer bounds
  frontend/
    src/
      api/                      ← Typed fetch wrappers (client.ts, index.ts, types.ts)
      components/               ← PersonField, VocabSelect, ConfidenceTag, SidePanel, Navigation
      screens/
        volumes/                ← VolumesScreen, VolumeForm, WorkForm
        annotations/            ← AnnotationsScreen
        persons/                ← PersonsScreen, PersonForm
        trace/                  ← TraceScreen
      styles/                   ← tokens.css, global.css, components.css
  electron/
    src/main.ts                 ← BrowserWindow creation; backend spawn; WAL lock dialog; IPC
    src/preload.ts              ← contextBridge: exposes getBackendPort()
  e2e_test.mjs                  ← Playwright end-to-end smoke test (8 checks)
  irfan_logo.png                ← Approved logo — unused by the application
```

**What works:** Volume/work/annotation CRUD, person search and creation (with `preferred_name` only), Arabic-tolerant matching via rapidfuzz, trace-a-scholar, vocab management, CSV/JSON export, Electron IPC bridge, WAL lock detection and dialog.

**What does not work or is not implemented:** Full person biographical card, person archive-appearances section, relationship browsing/editing on the volumes screen, repository management screen, top utility header, filter panel on trace screen, role-tab navigation, keyboard navigation in autocomplete, any automated tests.

---

## 3. Documentation Conflicts or Ambiguities

### CONF-001 — Confidence vocabulary values vs. display labels

- **Specification source:** `project_spec.md §6` vs. `ui_style_guide.md §13`
- **Conflict:** `project_spec.md` defines the controlled vocabulary values as `مؤكد، مرجح، محتمل`. `ui_style_guide.md §13` instructs to display confidence as `عالية، متوسطة، منخفضة` (literally "high, medium, low" rather than "confirmed, likely, possible"). These are different Arabic terms for different semantic registers.
- **Affected areas:** `ConfidenceTag` component, `vocab` seed data, all `confidence` columns in `person_relationships`.
- **Recommended resolution:** Clarify with the researcher which set of terms is preferred. If `مؤكد، مرجح، محتمل` are the stored values (as in the spec), the UI can map them to `عالية، متوسطة، منخفضة` for display without changing stored data.

### CONF-002 — Serial editability "resolved" note vs. VolumeForm behaviour

- **Specification source:** `project_spec.md §4.2` and `§9, item 4`
- **Ambiguity:** The spec says the researcher edits the components (`repository_id` + `document_number`) and the serial is regenerated. The `update_volume` service implements this. However, the `VolumeForm` does not expose `document_number` as an editable field. It is unclear whether the spec intends `document_number` to be directly editable by the researcher or only correctable by changing the repository. The note in §9 says "edit-the-components-and-regenerate" — components are plural, implying both are editable.
- **Recommended resolution:** Add `document_number` as a visible, editable field in `VolumeForm` for the update path only, with a warning that changing it regenerates the serial.

---

## 4. Data Model Problems

### DATA-001 — Person ORM model missing 14 fields from specification

- **Area:** Database schema
- **Severity:** Blocker
- **Specification source:** `project_spec.md §5` (persons table definition)
- **Expected behavior:** The `persons` table stores `identification_status`, `kunya`, `known_as`, `birth_date_as_written`, `birth_year_earliest`, `birth_year_latest`, `death_date_as_written`, `death_year_earliest`, `death_year_latest`, `birth_place`, `death_place`, `region_or_country`, `scholarly_affiliation`, and `occupation_or_status`.
- **Current behavior:** The `Person` ORM model (`backend/src/db/models.py:55–68`) contains only `id`, `preferred_name`, `ism`, `nisba_1`, `nisba_2`, `laqab`, `notes`. The entire biographical identification section of the person card is absent from the database.
- **Evidence:** `backend/src/db/models.py:55–68`. Searching for `identification_status`, `kunya`, `known_as`, `birth_date_as_written` across the entire codebase returns zero matches.
- **Relevant frontend file(s):** `frontend/src/api/types.ts:43–51`, `frontend/src/screens/persons/PersonForm.tsx`
- **Relevant backend file(s):** `backend/src/db/models.py`, `backend/src/api/persons.py`, `backend/src/services/persons.py`
- **Relevant database model or migration:** `Person` model; no migration system exists
- **Relevant test file(s):** Not applicable (no tests exist)
- **Recommended correction:** Add all fourteen missing columns to the `Person` SQLAlchemy model. Create a migration (once Alembic is added) that applies `ALTER TABLE persons ADD COLUMN …` for each field. Update Pydantic schemas, frontend TypeScript types, and the `PersonForm` component.
- **Risk of changing it:** High (requires migration for existing databases, updates across all Person-related layers)
- **Dependencies or prerequisites:** Requires Alembic migration setup (see DATA-004)
- **Suggested verification:** After migration, create a person with `death_date_as_written`, retrieve it via `GET /persons/{id}`, and confirm the field is returned.

---

### DATA-002 — `person_identification_status` vocabulary category missing from seed data

- **Area:** Database seed
- **Severity:** High
- **Specification source:** `project_spec.md §6`
- **Expected behavior:** The `vocab` table contains rows for category `person_identification_status` with values `معروف`, `غير مكتمل التعريف`, `مجهول`, `يحتاج إلى مراجعة`.
- **Current behavior:** `backend/src/db/seed.py` seeds seven vocab categories but omits `person_identification_status`. The `identification_status` field on `Person` (once added) will have no controlled options.
- **Evidence:** `backend/src/db/seed.py:3–42` — seven categories listed, `person_identification_status` absent.
- **Relevant frontend file(s):** `frontend/src/screens/persons/PersonForm.tsx`
- **Relevant backend file(s):** `backend/src/db/seed.py`
- **Relevant database model or migration:** `Vocab` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add four seed entries for `person_identification_status` to `VOCAB_SEED` in `seed.py`. Mark seed operations idempotent (already are via `INSERT OR IGNORE`).
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** After seed, call `GET /vocab/person_identification_status` and confirm four values returned.

---

### DATA-003 — `PRAGMA foreign_keys=ON` set only once at startup, not on every connection

- **Area:** Database engine configuration
- **Severity:** High
- **Specification source:** `coding_style_guide.md §8.5` — "Use database constraints for final protection"
- **Expected behavior:** Every SQLite connection from the pool enforces foreign-key constraints.
- **Current behavior:** `init_db()` (`backend/src/db/engine.py:23–35`) calls `PRAGMA foreign_keys=ON` on a single connection. SQLite PRAGMA settings are per-connection; new connections from the SQLAlchemy pool do not inherit this setting. The `event` symbol is imported in `models.py:4` but never used — a listener was evidently planned but not wired up.
- **Evidence:** `backend/src/db/engine.py:29–31`; `backend/src/db/models.py:4` (unused `event` import).
- **Relevant frontend file(s):** Not applicable
- **Relevant backend file(s):** `backend/src/db/engine.py`, `backend/src/db/models.py`
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `@event.listens_for(engine, "connect")` in `engine.py` to execute `PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;` on every new connection. Remove the one-time calls from `init_db()`.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Insert a `Volume` row with a non-existent `repository_id` via a second pooled connection; confirm it is rejected.

---

### DATA-004 — No database migration system

- **Area:** Database migrations
- **Severity:** High
- **Specification source:** `coding_style_guide.md §9.1` — "Every schema change requires a migration"
- **Expected behavior:** Schema changes are applied to existing databases via versioned, reversible migration scripts (e.g., Alembic).
- **Current behavior:** `init_db()` calls `Base.metadata.create_all(engine)`, which only creates missing tables on a fresh database. It does not add missing columns to existing tables. Any real researcher using the prototype will have an `archive.db` that will not receive the fourteen missing `Person` fields or any future schema additions.
- **Evidence:** `backend/src/db/engine.py:23–35`. No `alembic.ini`, no `alembic/` directory, no migration files found anywhere in the repository.
- **Relevant frontend file(s):** Not applicable
- **Relevant backend file(s):** `backend/src/db/engine.py`, `backend/pyproject.toml`
- **Relevant database model or migration:** All tables
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `alembic` to `pyproject.toml` dependencies. Run `alembic init migrations`. Create an initial migration from the current model, then create a second migration for the fourteen missing `Person` fields, with a backup step in the migration docstring.
- **Risk of changing it:** High (foundational change; all future schema work depends on it)
- **Dependencies or prerequisites:** Must be done before DATA-001 correction
- **Suggested verification:** Run `alembic upgrade head` on a copy of a real `archive.db`; validate row counts before and after.

---

### DATA-005 — `create_volume` uses `BEGIN DEFERRED` instead of `BEGIN IMMEDIATE`

- **Area:** Transaction isolation for serial allocation
- **Severity:** High
- **Specification source:** `project_spec.md §4.2` — "do this inside a transaction (`BEGIN IMMEDIATE` … `SELECT COALESCE(MAX(document_number),0)+1` … `INSERT` … `COMMIT`)"
- **Expected behavior:** The `document_number` allocation and insertion are wrapped in a `BEGIN IMMEDIATE` transaction so that concurrent connections cannot read the same max value and produce duplicate document numbers.
- **Current behavior:** `create_volume` in `backend/src/services/volumes.py:31–69` executes `SELECT MAX(document_number)` and then `session.add(volume)` under SQLAlchemy's default `BEGIN DEFERRED` transaction. Under the dual-machine sync scenario described in the spec, two sessions starting simultaneously can read the same max, compute the same next number, and one will fail with a UNIQUE constraint violation with a raw English error.
- **Evidence:** `backend/src/services/volumes.py:48–56`. No `BEGIN IMMEDIATE` or `text("BEGIN IMMEDIATE")` call anywhere.
- **Relevant frontend file(s):** Not applicable
- **Relevant backend file(s):** `backend/src/services/volumes.py`
- **Relevant database model or migration:** `volumes` table, UNIQUE(repository_id, document_number)
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Use SQLAlchemy's `with session.begin():` and execute `text("BEGIN IMMEDIATE")` explicitly before the `MAX` query, or use a `SAVEPOINT` approach. Wrap `SELECT MAX … INSERT` atomically.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** None
- **Suggested verification:** Simulate two concurrent requests against the same repository; confirm only one succeeds and the other raises a clean, Arabic error message.

---

### DATA-006 — Deletion of volumes/works does not check for dependent archival records

- **Area:** Delete behavior and data integrity
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §8.7` — "Prefer blocking deletion when dependent historical records exist. Never delete witness or relationship data silently."
- **Expected behavior:** Attempting to delete a volume that has annotations or person relationships produces a descriptive Arabic error explaining which records must be removed first.
- **Current behavior:** `delete_volume` (`backend/src/services/volumes.py:102–107`) and `delete_work` (`backend/src/services/works.py:50–54`) call `session.delete()` directly. SQLite FK enforcement (when properly enabled — see DATA-003) will raise a Python-level `IntegrityError`. The `integrity_error_handler` (`backend/src/main.py:52–55`) returns `str(exc.orig)` which is the raw English SQLite message. The user sees a technical English string, not a meaningful Arabic message.
- **Evidence:** `backend/src/services/volumes.py:102–107`; `backend/src/main.py:52–55`.
- **Relevant frontend file(s):** `frontend/src/screens/volumes/VolumesScreen.tsx:43–46`
- **Relevant backend file(s):** `backend/src/services/volumes.py`, `backend/src/services/works.py`, `backend/src/main.py`
- **Relevant database model or migration:** `volumes`, `works`, cascade relationships
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Before calling `session.delete()`, check for dependent records and raise `ValueError` with Arabic message. Fix `integrity_error_handler` to return a generic Arabic message rather than `str(exc.orig)`.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** DATA-003 (FK must be enforced first)
- **Suggested verification:** Create a volume with a work, attempt to delete the volume, confirm an Arabic error is returned.

---

## 5. Incorrect or Missing Fields

### FIELD-001 — Person Pydantic schemas and TypeScript types missing 14 fields

- **Area:** API contracts and frontend types
- **Severity:** Blocker
- **Specification source:** `project_spec.md §5`, `coding_style_guide.md §7.1`
- **Expected behavior:** `PersonCreate`, `PersonUpdate`, `PersonOut` in the API and `Person` in `frontend/src/api/types.ts` reflect all fields in the persons table.
- **Current behavior:** `backend/src/api/persons.py:9–57` and `frontend/src/api/types.ts:43–51` contain only `preferred_name`, `ism`, `nisba_1`, `nisba_2`, `laqab`, `notes`.
- **Evidence:** `backend/src/api/persons.py:9–57`; `frontend/src/api/types.ts:43–51`.
- **Relevant frontend file(s):** `frontend/src/api/types.ts`, `frontend/src/api/index.ts`
- **Relevant backend file(s):** `backend/src/api/persons.py`, `backend/src/services/persons.py`
- **Relevant database model or migration:** `persons` table (see DATA-001)
- **Relevant test file(s):** Not applicable
- **Recommended correction:** After adding fields to the ORM model (DATA-001), extend all three Pydantic classes and the TypeScript interface.
- **Risk of changing it:** High (requires coordinated update across backend schema, API, frontend types, and PersonForm)
- **Dependencies or prerequisites:** DATA-001, DATA-004
- **Suggested verification:** `POST /persons` with all spec fields, `GET /persons/{id}` and confirm all fields returned.

---

### FIELD-002 — PersonForm missing all biographical sections from specification

- **Area:** Person card UI (§7.2 of project_spec.md)
- **Severity:** Blocker
- **Specification source:** `project_spec.md §7.2.1–7.2.5`
- **Expected behavior:** The person creation/editing screen has four collapsible sections: Basic identity (preferred name + identification_status), Structured name details (ism, nasab chain, kunya, laqab, nisba, known_as), Name variants, Additional identifying information (birth/death dates, places, region, affiliation, occupation), and Notes. `حالة التعريف` is visible in the always-shown section.
- **Current behavior:** `frontend/src/screens/persons/PersonForm.tsx` implements: preferred name, a single collapsible section for ism/laqab/nisba1/nisba2/nasab chain, a single variant text input, and notes. Missing: `identification_status` dropdown, `kunya`, `known_as`, all birth/death fields, birth/death places, region, scholarly affiliation, occupation/status. The section structure does not follow the four-section layout from §7.8.
- **Evidence:** `frontend/src/screens/persons/PersonForm.tsx:76–161`.
- **Relevant frontend file(s):** `frontend/src/screens/persons/PersonForm.tsx`
- **Relevant backend file(s):** Not applicable (backend is the upstream blocker)
- **Relevant database model or migration:** `persons` table (DATA-001)
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Implement the four-section collapsible layout per §7.8. Add `VocabSelect` for `identification_status`. Add all missing fields under the appropriate sections.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** FIELD-001, DATA-001
- **Suggested verification:** Create a person with all fields populated; verify they persist and display.

---

### FIELD-003 — `saveVariant` prop in `PersonField` accepted but silently ignored

- **Area:** Person search and name variant capture
- **Severity:** Medium
- **Specification source:** `project_spec.md §7.4` — "When an existing person is selected, the newly typed manuscript spelling may be stored as a new `person_name_variant`"
- **Expected behavior:** When `saveVariant={true}` is passed to `PersonField` and the researcher selects an existing person, the text they typed (as a manuscript spelling) is saved as a new `PersonNameVariant` linked to that person.
- **Current behavior:** `PersonField` (`frontend/src/components/PersonField.tsx:19`) receives `saveVariant` but immediately aliases it to `_saveVariant` (unused prefix) and never calls `personsApi.addVariant`. The variant capture functionality is not implemented.
- **Evidence:** `frontend/src/components/PersonField.tsx:19` — `saveVariant: _saveVariant`; no call to `personsApi.addVariant` anywhere in the component.
- **Relevant frontend file(s):** `frontend/src/components/PersonField.tsx`, `frontend/src/screens/volumes/WorkForm.tsx:99` (uses `saveVariant`)
- **Relevant backend file(s):** `backend/src/api/persons.py:129–137`
- **Relevant database model or migration:** `person_name_variants` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** In `selectCandidate`, when `saveVariant` is true and `query !== c.preferred_name`, call `personsApi.addVariant(c.person_id, { written_form: query })` before resolving.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** In WorkForm, type a variant spelling of a known person, select the person; confirm `GET /persons/{id}/variants` returns the new variant.

---

### FIELD-004 — Work author cannot be edited or reviewed after initial creation

- **Area:** Work author relationship workflow
- **Severity:** Medium
- **Specification source:** `project_spec.md §7.5` — role-first questions during cataloging
- **Expected behavior:** When editing an existing work, the researcher can view and change the author relationship.
- **Current behavior:** `WorkForm` (`frontend/src/screens/volumes/WorkForm.tsx:97`) renders the author `PersonField` only when `!work` (new work only). Editing an existing work shows no author field. There is no existing-author display in the volumes detail view. No API call to retrieve current author relationships for a work.
- **Evidence:** `frontend/src/screens/volumes/WorkForm.tsx:97` — `{!work && (...)}`.
- **Relevant frontend file(s):** `frontend/src/screens/volumes/WorkForm.tsx`, `frontend/src/screens/volumes/VolumesScreen.tsx`
- **Relevant backend file(s):** `backend/src/api/relationships.py`
- **Relevant database model or migration:** `person_relationships` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** When editing a work, load existing relationships via `GET /relationships/by-volume/{volume_id}`, display the author, and allow replacing it.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** None
- **Suggested verification:** Create a work with an author, open edit form, confirm author is displayed.

---

## 6. Identifier-Generation Problems

### ID-001 — Volume creation uses `BEGIN DEFERRED` instead of `BEGIN IMMEDIATE`

*(Duplicate of DATA-005 — see above for full detail.)*

---

### ID-002 — `document_number` not exposed as an editable field in VolumeForm

- **Area:** Serial correction workflow
- **Severity:** Medium
- **Specification source:** `project_spec.md §4.2`, §9 item 4
- **Expected behavior:** The researcher edits `repository_id` and `document_number`; the serial regenerates from them. "The researcher edits the components (repository and document number); the serial is then regenerated automatically from them."
- **Current behavior:** `VolumeForm` (`frontend/src/screens/volumes/VolumeForm.tsx:86–168`) offers a `repository_id` select and shows the serial as read-only. `document_number` is not exposed, so the researcher cannot correct a wrong running count.
- **Evidence:** `frontend/src/screens/volumes/VolumeForm.tsx:86–168` — no `document_number` field rendered.
- **Relevant frontend file(s):** `frontend/src/screens/volumes/VolumeForm.tsx`
- **Relevant backend file(s):** `backend/src/services/volumes.py:72–91` (update_volume correctly handles document_number changes)
- **Relevant database model or migration:** `volumes` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add a `document_number` numeric input in `VolumeForm` for the edit path, with a note explaining it regenerates the serial. Render the serial as a read-only preview beneath.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Edit a volume's `document_number`; confirm serial badge updates to reflect the new number.

---

## 7. Backend and API Problems

### API-001 — `IntegrityError` handler returns raw English SQLite messages

- **Area:** Error handling
- **Severity:** High
- **Specification source:** `coding_style_guide.md §7.4`, §11.4 — "User-facing messages must be Arabic"
- **Expected behavior:** When a database integrity constraint is violated (duplicate serial, duplicate repository place_key, etc.), the API returns a structured JSON error with an Arabic message.
- **Current behavior:** `backend/src/main.py:52–55` — `detail = str(exc.orig) if exc.orig else "تعارض في البيانات"`. `exc.orig` is the raw Python `sqlite3.OperationalError` or `IntegrityError`, which contains English messages like `"UNIQUE constraint failed: repositories.place_key"`.
- **Evidence:** `backend/src/main.py:52–55`.
- **Relevant frontend file(s):** Any form that catches errors from the API
- **Relevant backend file(s):** `backend/src/main.py`
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Replace `str(exc.orig)` with constraint-aware Arabic messages. Map known constraint names (e.g., `UNIQUE constraint failed: volumes.serial`) to specific Arabic strings. Fall back to the generic Arabic message for unknown constraints.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** POST a duplicate `place_key`; confirm the response `detail` field is Arabic.

---

### API-002 — No endpoint to retrieve a person's archive appearances

- **Area:** Person profile — archive appearances section
- **Severity:** High
- **Specification source:** `project_spec.md §7.6` — "مواضع ظهور الشخص في الأرشيف"
- **Expected behavior:** The person profile screen can show all manuscript relationships for the selected person, grouped by context, with role, volume serial, work title, confidence, and evidence.
- **Current behavior:** `PersonsScreen` (`frontend/src/screens/persons/PersonsScreen.tsx:87–133`) shows only name, structured fields, name variants, and notes. The archive appearances section is entirely absent. The trace endpoint (`GET /trace/{person_id}`) provides this data but is not called from the persons screen.
- **Evidence:** `frontend/src/screens/persons/PersonsScreen.tsx:87–133` — no call to `traceApi.trace()` or `relationshipsApi.listForVolume()`.
- **Relevant frontend file(s):** `frontend/src/screens/persons/PersonsScreen.tsx`
- **Relevant backend file(s):** `backend/src/api/trace.py`
- **Relevant database model or migration:** `person_relationships` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** On selecting a person, call `traceApi.trace(person.id)` and render the results as a read-only archive appearances table per §7.6.
- **Suggested verification:** Create person → add relationship → open person detail → confirm appearances section renders.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None

---

### API-003 — No endpoints for repository read/update/delete

- **Area:** Repository management
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §7.2` (resource naming convention)
- **Expected behavior:** `GET /volumes/repositories/{id}`, `PATCH /volumes/repositories/{id}`, `DELETE /volumes/repositories/{id}` exist.
- **Current behavior:** `backend/src/api/volumes.py` only provides `POST /volumes/repositories` and `GET /volumes/repositories`. There is no way to edit or delete a repository, nor to fetch a single repository.
- **Evidence:** `backend/src/api/volumes.py:53–69`.
- **Relevant frontend file(s):** None (no repository management screen exists)
- **Relevant backend file(s):** `backend/src/api/volumes.py`, `backend/src/services/volumes.py`
- **Relevant database model or migration:** `repositories` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `update_repository` and `delete_repository` service functions; add corresponding router endpoints.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** `PATCH /volumes/repositories/1` with a new `name`; confirm change persists.

---

### API-004 — Export endpoints accept arbitrary, unvalidated file system paths from client

- **Area:** Security and file I/O
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §12.3` — "Treat file paths as untrusted input. Normalize and validate paths before reading or writing."
- **Expected behavior:** The backend validates that the provided export path is within an approved directory before writing files.
- **Current behavior:** `backend/src/api/export.py:15–31` passes `body.output_dir` directly to `svc.export_csv()` which calls `Path(output_dir).mkdir(parents=True, exist_ok=True)` and then writes files there. Any path the client submits is accepted.
- **Evidence:** `backend/src/services/export.py:16`, `backend/src/api/export.py:17`.
- **Relevant frontend file(s):** `frontend/src/screens/trace/TraceScreen.tsx:131–147` (uses `prompt()` for path)
- **Relevant backend file(s):** `backend/src/api/export.py`, `backend/src/services/export.py`
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Validate the path is absolute and not in sensitive system directories. For a desktop app, consider using an Electron `dialog.showOpenDialog` for folder selection rather than a plain text `prompt()`.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Attempt export to a path like `C:\Windows\System32\test`; confirm rejection.

---

### API-005 — `role`, `confidence`, `annotation_type`, and `work_type` not validated against vocab

- **Area:** Validation
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §10.1`; `project_spec.md §6` — values are "selected from dropdowns, never free-typed"
- **Expected behavior:** The service layer rejects values not present in the active vocabulary.
- **Current behavior:** `create_annotation` (`backend/src/services/annotations.py`), `create_work` (`backend/src/services/works.py`), and relationship services (`backend/src/services/relationships.py`) accept any string for these fields without checking the `vocab` table.
- **Evidence:** `backend/src/services/annotations.py:7–36` — no vocab lookup. `backend/src/services/relationships.py:36–74` — no vocab check for `role` or `confidence`.
- **Relevant frontend file(s):** Not applicable (frontend uses VocabSelect)
- **Relevant backend file(s):** `backend/src/services/annotations.py`, `backend/src/services/relationships.py`, `backend/src/services/works.py`
- **Relevant database model or migration:** `vocab` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add a shared `_validate_vocab(session, category, value)` helper that queries active vocab values and raises `ValueError` with Arabic message if not found.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** POST annotation with `annotation_type = "made-up-type"`; confirm 422.

---

### API-006 — Delete endpoints silently succeed for non-existent resource IDs

- **Area:** HTTP semantics
- **Severity:** Low
- **Specification source:** `coding_style_guide.md §7.3` — "204: successful deletion with no body; 404: record not found"
- **Expected behavior:** `DELETE /volumes/{id}` with a non-existent ID returns 404.
- **Current behavior:** `delete_volume`, `delete_work`, `delete_annotation` service functions check `if volume:` and silently return without deleting when the resource does not exist. The route returns 204 regardless.
- **Evidence:** `backend/src/services/volumes.py:102–107`; `backend/src/services/works.py:50–54`; `backend/src/services/annotations.py:68–72`.
- **Relevant frontend file(s):** Not applicable
- **Relevant backend file(s):** `backend/src/services/volumes.py`, `backend/src/services/works.py`, `backend/src/services/annotations.py`
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** In each delete service function, raise `ValueError` when the resource does not exist; convert to 404 in the route handler.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** `DELETE /volumes/99999`; confirm 404 response.

---

## 8. Form-Validation Problems

### VALIDATION-001 — `place_key` validation error is an English technical message

- **Area:** Form error messages
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §11.4` — "User-facing messages must be Arabic, clear, specific, actionable"
- **Expected behavior:** When an invalid `place_key` is submitted, the response contains an Arabic message such as "مفتاح المستودع يجب أن يتكون من أربعة أرقام بالضبط."
- **Current behavior:** `_validate_place_key` (`backend/src/services/volumes.py:10–12`) raises `ValueError(f"place_key must be exactly four ASCII digits, got: {place_key!r}")` — English, with a technical representation of the received value.
- **Evidence:** `backend/src/services/volumes.py:10–12`.
- **Relevant frontend file(s):** `frontend/src/screens/volumes/VolumeForm.tsx:59–63` (has Arabic frontend validation, but backend message shown on API failure)
- **Relevant backend file(s):** `backend/src/services/volumes.py`
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Replace the English error string with an Arabic one; do not include the raw `repr` of user input.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Submit `place_key = "AB12"`; confirm Arabic error in response.

---

### VALIDATION-002 — Mentioned persons cannot be added when editing an existing annotation

- **Area:** Annotation form — mentioned persons workflow
- **Severity:** Medium
- **Specification source:** `project_spec.md §7.7` — "the annotation form must allow adding multiple people"
- **Expected behavior:** The researcher can add or modify mentioned persons while editing an existing annotation.
- **Current behavior:** `AnnotationsScreen` (`frontend/src/screens/annotations/AnnotationsScreen.tsx:234`) wraps the mentioned persons panel in `{!editingAnnotation && (...)}`. When editing, the section is hidden entirely and no relationships can be added through the UI.
- **Evidence:** `frontend/src/screens/annotations/AnnotationsScreen.tsx:234`.
- **Relevant frontend file(s):** `frontend/src/screens/annotations/AnnotationsScreen.tsx`
- **Relevant backend file(s):** `backend/src/api/relationships.py`
- **Relevant database model or migration:** `person_relationships` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Remove the `!editingAnnotation` guard. For edits, pre-load existing `مذكور` relationships for display and allow additions and removals.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** Requires loading existing relationships from API on annotation edit
- **Suggested verification:** Create annotation with a mentioned person, re-open it for editing, confirm the person appears and a new person can be added.

---

### VALIDATION-003 — `PersonField` "create new" action does not require "none match" confirmation

- **Area:** Person identity — duplicate prevention
- **Severity:** Medium
- **Specification source:** `project_spec.md §7.3` — "The researcher selects an existing person or confirms that none match. A new person may be saved with only `preferred_name`. The candidate panel must appear before the final create action."
- **Expected behavior:** The researcher can see existing candidates and must explicitly confirm that no candidate matches before creating a new person.
- **Current behavior:** The "create new" option (`frontend/src/components/PersonField.tsx:106–109`) appears in the same dropdown alongside existing candidates. One click on this item immediately calls `personsApi.create()` without requiring explicit confirmation that the existing candidates were reviewed and rejected.
- **Evidence:** `frontend/src/components/PersonField.tsx:64–76` — `createNew()` function calls `personsApi.create()` directly.
- **Relevant frontend file(s):** `frontend/src/components/PersonField.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** `persons`, `person_name_variants` tables
- **Relevant test file(s):** Not applicable
- **Recommended correction:** When candidates exist, change the "create new" action to open an intermediate confirmation step showing the candidates with a "none of these match — create new" confirmation button.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** None
- **Suggested verification:** Type a name that matches an existing person; confirm "create new" requires an explicit second confirmation step.

---

### VALIDATION-004 — `VocabSelect` has no loading state; `required` field can submit before options load

- **Area:** Form UX and data integrity
- **Severity:** Low
- **Specification source:** `coding_style_guide.md §6.5` — loading states must be handled; `ui_style_guide.md §17` — Loading: "Restrained skeleton rows or inline status"
- **Expected behavior:** While vocab options are loading, the select is disabled with a visible loading indicator.
- **Current behavior:** `VocabSelect` (`frontend/src/components/VocabSelect.tsx`) starts with `options = []`. If the API is slow, the select shows only the placeholder option. The `required` attribute is present but the empty string is a valid `value=""` selection from the user's perspective until options load.
- **Evidence:** `frontend/src/components/VocabSelect.tsx:16–19`.
- **Relevant frontend file(s):** `frontend/src/components/VocabSelect.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `const [loading, setLoading] = useState(true)` to `VocabSelect`; disable the select while loading; show a brief Arabic inline message.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Throttle the API; confirm the select is disabled while vocab loads.

---

## 9. Navigation and Workflow Problems

### FLOW-001 — Person profile does not show archive appearances

*(Full detail under API-002 — the root cause is a missing API call in PersonsScreen.)*

---

### FLOW-002 — No repository management screen

- **Area:** Navigation and workflow
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §3.1` — frontend renders screens; implied by all repository-related operations
- **Expected behavior:** The researcher can browse, edit, and manage repositories from a dedicated screen.
- **Current behavior:** Repositories can only be created inline from `VolumeForm`. There is no navigation item or screen for listing and editing repositories.
- **Evidence:** `frontend/src/components/Navigation.tsx:10–14` — four items: volumes, annotations, persons, trace. No repository item. `frontend/src/screens/volumes/VolumeForm.tsx:58–84` — inline repo creation only.
- **Relevant frontend file(s):** `frontend/src/components/Navigation.tsx`
- **Relevant backend file(s):** `backend/src/api/volumes.py`
- **Relevant database model or migration:** `repositories` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add a "المستودعات" navigation item and a `RepositoriesScreen` with list-detail layout per §19. Requires API-003 completion first.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** API-003
- **Suggested verification:** Navigate to repositories screen, edit a repository name, confirm change persists.

---

### FLOW-003 — No UI to browse or manage existing person relationships on a volume

- **Area:** Volume and work relationship management
- **Severity:** High
- **Specification source:** `project_spec.md §7.5` — role-first person questions while cataloging; §7.6 — archive appearances
- **Expected behavior:** From the volumes screen, the researcher can see all person relationships (authorship, ownership, scribing) for the selected volume or work, and can add or remove them.
- **Current behavior:** `VolumesScreen` shows works in a table but no relationships. The `GET /relationships/by-volume/{volume_id}` endpoint exists but is never called from the frontend. `WorkForm` only assigns an author for new works.
- **Evidence:** `frontend/src/screens/volumes/VolumesScreen.tsx:130–189` — no relationship section. `frontend/src/api/index.ts:65–71` — `relationshipsApi.listForVolume()` defined but not used in `VolumesScreen`.
- **Relevant frontend file(s):** `frontend/src/screens/volumes/VolumesScreen.tsx`
- **Relevant backend file(s):** `backend/src/api/relationships.py`
- **Relevant database model or migration:** `person_relationships` table
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add a "الأشخاص المرتبطون" section to the volume detail panel showing relationships by role; allow adding new ones via role-first PersonField prompts.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** None
- **Suggested verification:** Add a scribe relationship for a work; confirm it appears under the volume detail.

---

### FLOW-004 — Export buttons gated inside the trace results block

- **Area:** Export workflow placement
- **Severity:** Medium
- **Specification source:** `project_spec.md §2.3` — "Full plain-file export (CSV + JSON) for longevity"
- **Expected behavior:** Export is always accessible from the UI regardless of trace state.
- **Current behavior:** `TraceScreen` (`frontend/src/screens/trace/TraceScreen.tsx:127–151`) renders export buttons only inside the `results.length > 0` conditional block. If a traced person has no relationships, or no person has been traced, export is inaccessible.
- **Evidence:** `frontend/src/screens/trace/TraceScreen.tsx:75` — `{results && !loading && results.length > 0 && (` wraps the export buttons.
- **Relevant frontend file(s):** `frontend/src/screens/trace/TraceScreen.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Move export controls outside the conditional, or add a dedicated "أدوات" section in the navigation. Also replace `window.prompt()` with an Electron-native `dialog.showOpenDialog` call via IPC.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Navigate to trace screen without selecting a person; confirm export buttons are visible.

---

### FLOW-005 — No unsaved changes warning before navigation or record change

- **Area:** Form safety
- **Severity:** Medium
- **Specification source:** `ui_style_guide.md §17` — "Unsaved: Warn before closing, navigating, or changing record"
- **Expected behavior:** If the researcher has unsaved edits in any form and clicks a navigation item or selects a different record, an Arabic warning is shown.
- **Current behavior:** No form in the application tracks "dirty" state. Clicking a navigation item while editing a volume silently discards unsaved changes.
- **Evidence:** Searched all screen and form files — no `beforeunload`, `isDirty`, or equivalent found.
- **Relevant frontend file(s):** All form components
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Track a `isDirty` flag in each form. Pass a `onBeforeNavigate` guard to the `Navigation` component.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** None
- **Suggested verification:** Edit a volume form, click another nav item, confirm Arabic warning dialog appears.

---

### FLOW-006 — Trace screen has no filter panel

- **Area:** Scholar trace filters
- **Severity:** High
- **Specification source:** `ui_style_guide.md §10` — "Left filter panel … Standard dropdown for repository/library. Paired date inputs for historical range. Compact checkboxes for roles."
- **Expected behavior:** The trace screen has a left panel with repository, date range, and role filters. Switching tabs preserves filters.
- **Current behavior:** `TraceScreen` (`frontend/src/screens/trace/TraceScreen.tsx`) has no filter panel. All results are shown without any filtering capability.
- **Evidence:** `frontend/src/screens/trace/TraceScreen.tsx` — no filter state, no filter UI.
- **Relevant frontend file(s):** `frontend/src/screens/trace/TraceScreen.tsx`
- **Relevant backend file(s):** `backend/src/api/trace.py` (would need query parameters added)
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add filter state (repository_id, date_range, roles) to `TraceScreen`. Pass to `traceApi.trace()` as query parameters (requires backend update). Render the left filter panel per §10.
- **Risk of changing it:** High (requires frontend UI + backend query changes)
- **Dependencies or prerequisites:** None
- **Suggested verification:** Filter by repository; confirm results are scoped.

---

### FLOW-007 — Trace results presented as stacked sections, not keyboard-navigable tabs

- **Area:** Role grouping presentation
- **Severity:** Medium
- **Specification source:** `ui_style_guide.md §11` — "Text-only tabs with counts in parentheses. Active tab uses olive text and 2–3px underline. Keyboard navigation is required."
- **Expected behavior:** Role groups are presented as clickable tabs with counts; keyboard navigation moves between tabs.
- **Current behavior:** `TraceScreen` renders each role group as a separate `<div>` with a styled heading. No tab component, no keyboard navigation between groups, no olive underline.
- **Evidence:** `frontend/src/screens/trace/TraceScreen.tsx:81–125`.
- **Relevant frontend file(s):** `frontend/src/screens/trace/TraceScreen.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Implement a `RoleTabs` component per §11 with `role="tablist"` and `role="tab"` semantics, keyboard navigation, and olive underline for active tab.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** None
- **Suggested verification:** Tab through role groups using arrow keys.

---

## 10. Arabic and RTL Problems

### RTL-001 — Navigation sidebar uses dark green background, violating the style guide

- **Area:** Navigation visual design
- **Severity:** High
- **Specification source:** `ui_style_guide.md §5.3, §7.1, §19.3, §25`
- **Expected behavior:** The navigation sidebar has a white background (`--color-surface: #FFFFFF`). An active item shows a very light olive tint (`--color-primary-100: #F1F4EA`) with a narrow 3px olive right-edge marker.
- **Current behavior:** `.nav-sidebar` (`frontend/src/components/Navigation.css:2`) uses `background: var(--color-primary)` which resolves to `#354e24` (dark forest green). The style guide §5.3 explicitly prohibits "a dark, full-height green sidebar." §19.3 identifies the dark green navigation as the prototype element to replace.
- **Evidence:** `frontend/src/components/Navigation.css:4`; `frontend/src/styles/tokens.css:3` — `--color-primary: #354e24`.
- **Relevant frontend file(s):** `frontend/src/components/Navigation.css`, `frontend/src/styles/tokens.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** `e2e_test.mjs` (visual test not present)
- **Recommended correction:** Change `.nav-sidebar` background to `--color-surface` (white). Change nav item text to `--color-text`. Change active state to light olive tint (`#F1F4EA`) with 3px `--color-primary-700` right-edge marker.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** UI-001 (token renaming should happen first)
- **Suggested verification:** Navigate the app; confirm sidebar is white with muted charcoal text.

---

### RTL-002 — Top utility header is entirely absent

- **Area:** Application shell structure
- **Severity:** High
- **Specification source:** `ui_style_guide.md §5.1, §6`
- **Expected behavior:** A horizontal utility bar (72–84px high) spans the top, containing: the archive logo and product name on the right, a repository/library selector in the center, and user avatar on the left.
- **Current behavior:** `App.tsx` renders only `<Navigation>` and `<main>`. There is no header element. The `irfan_logo.png` (at the repository root) is not referenced anywhere in the application.
- **Evidence:** `frontend/src/App.tsx:44–55` — no header component. `irfan_logo.png` exists but no `import` or `<img src=…>` references it in any frontend source file.
- **Relevant frontend file(s):** `frontend/src/App.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** `e2e_test.mjs:32` — checks `HTML lang=ar` but not header presence
- **Recommended correction:** Create a `Header` component containing the logo, product name, repository selector, and user area per §6. Import `irfan_logo.png` as the logo image. Add header to `App.tsx` above `<main>`.
- **Risk of changing it:** Medium (layout change affects all screens)
- **Dependencies or prerequisites:** None
- **Suggested verification:** Open the app; confirm logo, product name, and repository selector are visible in the header.

---

### RTL-003 — `irfan_logo.png` is completely unused

- **Area:** Brand identity
- **Severity:** Medium
- **Specification source:** `ui_style_guide.md §24` — "Full logo appears in the top utility header, launch screen, and About screen."
- **Expected behavior:** `irfan_logo.png` is displayed in the top utility header.
- **Current behavior:** The file exists at `irfan_logo.png` (repository root). A letter `'أ'` in a styled span is used instead in `Navigation.tsx:22–25`. The logo file is not imported or referenced anywhere.
- **Evidence:** `frontend/src/components/Navigation.tsx:22–25`; no `import irfanLogo` found in any source file.
- **Relevant frontend file(s):** `frontend/src/components/Navigation.tsx`, `frontend/src/App.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** After creating the Header component (RTL-002), import `irfan_logo.png` and render it as the header logo.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** RTL-002
- **Suggested verification:** Header shows the actual logo image instead of the letter 'أ'.

---

### RTL-004 — Navigation active item text/icon color is white-on-dark instead of olive-on-white

- **Area:** Navigation interaction states
- **Severity:** High
- **Specification source:** `ui_style_guide.md §7.2` — "Active: very light olive tint, olive text/icon, and 3px right-edge marker. No filled dark background."
- **Expected behavior:** Active nav item uses a very light olive tint background (≈`#F1F4EA`), olive text, and a 3px solid marker on the right edge.
- **Current behavior:** `.nav-item.active` (`Navigation.css:65–69`) applies `background: rgba(255, 255, 255, 0.15)` (semi-transparent white on dark green) and `color: #fff`. This is white text on dark green — the inverse of the approved design.
- **Evidence:** `frontend/src/components/Navigation.css:65–69`.
- **Relevant frontend file(s):** `frontend/src/components/Navigation.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** After fixing RTL-001, update `.nav-item.active` to use `background: var(--color-primary-100)` and `color: var(--color-primary-700)`.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** RTL-001
- **Suggested verification:** Click a nav item; confirm olive text and light olive background.

---

### RTL-005 — AnnotationsScreen volume selector missing right-edge selected marker

- **Area:** List selection indicator consistency
- **Severity:** Low
- **Specification source:** `ui_style_guide.md §12.1` — "Selected row: light olive tint plus narrow right marker"; §19.1 — "Selected item uses light olive tint and right-edge marker"
- **Expected behavior:** The selected volume in the annotations screen shows both the olive tint background and a 3px right-edge marker, consistent with the volumes and persons screens.
- **Current behavior:** The volume list in `AnnotationsScreen` (`frontend/src/screens/annotations/AnnotationsScreen.tsx:159–165`) applies only `background: var(--color-selected-bg)` for selected items — no `borderRight` marker.
- **Evidence:** `frontend/src/screens/annotations/AnnotationsScreen.tsx:162–163` — background set but no border.
- **Relevant frontend file(s):** `frontend/src/screens/annotations/AnnotationsScreen.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `borderRight: selected?.id === v.id ? "3px solid var(--color-selected-marker)" : undefined` inline or use a shared CSS class.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Select a volume in the annotations screen; confirm right-edge marker appears.

---

## 11. Visual-Design Problems

### UI-001 — Design token names and values diverge from the approved style guide

- **Area:** Design tokens
- **Severity:** Medium
- **Specification source:** `ui_style_guide.md §3.1–3.5`
- **Expected behavior:** The style guide tokens (`--color-primary-700`, `--color-page`, `--color-surface-muted`, `--color-text-muted`, `--color-border-strong`, etc.) are used throughout.
- **Current behavior:** `frontend/src/styles/tokens.css` defines a different token set: `--color-primary: #354e24`, `--color-highlight: #7e9e36`, `--color-bg: #f7f5ef`. The `--color-primary-700` (`#526B2D`), `--color-primary-600` (`#667F3A`), `--color-primary-100` (`#F1F4EA`), `--color-page` (`#FAF9F5`), `--color-surface-muted`, `--color-text-muted`, and `--color-border-strong` tokens are entirely absent.
- **Evidence:** `frontend/src/styles/tokens.css:1–51` — full token listing.
- **Relevant frontend file(s):** `frontend/src/styles/tokens.css`, `frontend/src/styles/global.css`, `frontend/src/styles/components.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Rename and adjust `tokens.css` to match the style guide token names exactly. Update all CSS references. Run the linter.
- **Risk of changing it:** Medium (affects all styled components)
- **Dependencies or prerequisites:** None
- **Suggested verification:** Grep for `--color-primary-700` in the codebase; confirm it resolves correctly.

---

### UI-002 — Spacing scale does not match the style guide

- **Area:** Spacing tokens
- **Severity:** Low
- **Specification source:** `ui_style_guide.md §3.3` — scale: `4·8·12·16·20·24·32·40·48`, nine tokens.
- **Expected behavior:** `--space-1` through `--space-9` with values `4px·8px·12px·16px·20px·24px·32px·40px·48px`.
- **Current behavior:** `tokens.css` defines seven tokens: `--space-1: 4px` through `--space-7: 48px` with values `4·8·12·16·24·32·48`. Missing `20px` (`--space-5`) and `40px` (`--space-8`); the spec's `--space-5: 20px` conflicts with the implementation's `--space-5: 24px`.
- **Evidence:** `frontend/src/styles/tokens.css:27–34`.
- **Relevant frontend file(s):** `frontend/src/styles/tokens.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `--space-5: 20px`, shift `--space-6: 24px`, `--space-7: 32px`, `--space-8: 40px`, `--space-9: 48px`. Update all uses.
- **Risk of changing it:** Medium (spacing values referenced throughout all CSS)
- **Dependencies or prerequisites:** None
- **Suggested verification:** Visual comparison at 1440px viewport.

---

### UI-003 — Page title font size is 28px instead of the specified 26px

- **Area:** Typography
- **Severity:** Low
- **Specification source:** `ui_style_guide.md §4.2` — "Application/page title: 26px, weight 600"
- **Expected behavior:** `h1` elements render at 26px.
- **Current behavior:** `--font-size-title: 28px` (`tokens.css:30`); `h1 { font-size: var(--font-size-title); }` (`global.css:32`) applies 28px.
- **Evidence:** `frontend/src/styles/tokens.css:30`; `frontend/src/styles/global.css:32`.
- **Relevant frontend file(s):** `frontend/src/styles/tokens.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Change `--font-size-title` to `26px`.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Measure `h1` computed font size in browser dev tools.

---

### UI-004 — Radius token set incomplete; only one `--radius` token defined

- **Area:** Border radius tokens
- **Severity:** Low
- **Specification source:** `ui_style_guide.md §3.4` — `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`
- **Expected behavior:** Three distinct radius tokens allow compact controls, standard inputs, and larger grouped panels to differ appropriately.
- **Current behavior:** `tokens.css` defines a single `--radius: 6px`. `--radius-sm` and `--radius-lg` are absent.
- **Evidence:** `frontend/src/styles/tokens.css:39`.
- **Relevant frontend file(s):** `frontend/src/styles/tokens.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `--radius-sm: 4px`, rename `--radius` to `--radius-md`, add `--radius-lg: 8px`.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Verify compact controls use `--radius-sm` and side panels use `--radius-lg`.

---

### UI-005 — Confidence indicator uses color as the only differentiator; no dot pattern

- **Area:** Confidence display
- **Severity:** Medium
- **Specification source:** `ui_style_guide.md §13` — "Three small dots beside [the text]. Filled olive dots represent confidence strength. Color must never be the only meaning."
- **Expected behavior:** Confidence is shown as Arabic text label plus a row of three dots: olive-filled for strength, gray-empty for remainder.
- **Current behavior:** `ConfidenceTag` (`frontend/src/components/ConfidenceTag.tsx`) renders a single `<span>` with one of three CSS color classes. No dots. Color is the sole visual differentiator.
- **Evidence:** `frontend/src/components/ConfidenceTag.tsx:11–13`; `frontend/src/styles/components.css:131–136`.
- **Relevant frontend file(s):** `frontend/src/components/ConfidenceTag.tsx`, `frontend/src/styles/components.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Implement three filled + empty small dots (e.g., SVG circles or CSS `::before`/`::after`) alongside the text label.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** CONF-001 resolution (confirm which labels to use)
- **Suggested verification:** Verify confidence is distinguishable without color (grayscale mode).

---

### UI-006 — Motion tokens incomplete; 160ms standard transition missing

- **Area:** Motion tokens
- **Severity:** Low
- **Specification source:** `ui_style_guide.md §3.5` — "Fast: 120ms, Standard: 160ms, Maximum: 180ms"
- **Expected behavior:** Three timing tokens exist for fast, standard, and maximum transitions.
- **Current behavior:** `tokens.css` defines `--transition-fast: 120ms` and `--transition-normal: 180ms` — skipping the 160ms standard.
- **Evidence:** `frontend/src/styles/tokens.css:44–45`.
- **Relevant frontend file(s):** `frontend/src/styles/tokens.css`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add `--transition-standard: 160ms ease`; rename `--transition-normal` to `--transition-max: 180ms ease`.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Audit all CSS transition usages after renaming.

---

### UI-007 — `window.confirm()` used for destructive confirmations instead of in-app modal

- **Area:** Destructive action confirmation
- **Severity:** Low
- **Specification source:** `ui_style_guide.md §16.3`, §20.2 — "Use modals only for destructive confirmation … Requires clear text confirmation for irreversible actions"
- **Expected behavior:** Deleting a work or annotation shows an in-app Arabic confirmation modal.
- **Current behavior:** `VolumesScreen.tsx:44` uses `confirm(\`حذف «${work.title}»؟\`)` and `AnnotationsScreen.tsx:126` uses `confirm("حذف هذا التقييد؟")` — both are browser-native JavaScript dialogs not consistent with the application design.
- **Evidence:** `frontend/src/screens/volumes/VolumesScreen.tsx:44`; `frontend/src/screens/annotations/AnnotationsScreen.tsx:126`.
- **Relevant frontend file(s):** Both screen files above
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Create a `ConfirmModal` component; replace all `confirm()` calls.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Click delete; confirm custom Arabic modal appears before deletion.

---

### UI-008 — Keyboard navigation absent from `PersonField` autocomplete

- **Area:** Accessibility
- **Severity:** Medium
- **Specification source:** `ui_style_guide.md §9.1, §22` — "Keyboard navigation is required. Autocomplete must expose active option and selection state."
- **Expected behavior:** Arrow keys move through candidates; Enter selects the focused candidate; Escape closes the dropdown; ARIA roles `combobox`, `listbox`, and `option` are present.
- **Current behavior:** `PersonField` (`frontend/src/components/PersonField.tsx:78–113`) renders a plain `<input>` and a `<div className="match-dropdown">` with `<div className="match-item">` children. No `onKeyDown`, no `aria-expanded`, no `role="option"`, no focused-item state.
- **Evidence:** `frontend/src/components/PersonField.tsx:78–113`.
- **Relevant frontend file(s):** `frontend/src/components/PersonField.tsx`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable
- **Recommended correction:** Add keyboard event handler tracking `activeIndex`; apply `aria-activedescendant`; add `role="combobox"` to input and `role="listbox"` / `role="option"` to dropdown.
- **Risk of changing it:** Medium
- **Dependencies or prerequisites:** None
- **Suggested verification:** Tab to a PersonField, type a name, navigate candidates with arrow keys, select with Enter.

---

## 12. Missing or Inadequate Tests

### TEST-001 — No backend unit or integration tests

- **Area:** Testing
- **Severity:** High
- **Specification source:** `coding_style_guide.md §13.2` — lists 14 high-priority test areas
- **Expected behavior:** `pytest` tests cover: serial generation, serial collision prevention, person name normalization, trace-a-scholar aggregation, evidence annotation consistency, witness preservation, export completeness, and more.
- **Current behavior:** No `.py` test files exist anywhere in the repository. No pytest configuration. No test coverage for any domain rule.
- **Evidence:** Searched `backend/**/*.py` — no file prefixed `test_` found. `backend/pyproject.toml:2–11` — no `pytest` dependency.
- **Relevant frontend file(s):** Not applicable
- **Relevant backend file(s):** All backend service and utility files
- **Relevant database model or migration:** All
- **Relevant test file(s):** Not applicable (none exist)
- **Recommended correction:** Add `pytest`, `pytest-asyncio`, and `httpx` (for FastAPI test client) to `pyproject.toml`. Create `backend/tests/` with at minimum: `test_volumes.py` (serial generation, collision), `test_persons.py` (normalization, search stages), `test_relationships.py` (evidence consistency), `test_trace.py` (aggregation).
- **Risk of changing it:** Low (additive)
- **Dependencies or prerequisites:** None
- **Suggested verification:** `uv run pytest backend/tests/` passes with no failures.

---

### TEST-002 — No frontend unit or component tests

- **Area:** Frontend testing
- **Severity:** High
- **Specification source:** `coding_style_guide.md §13.3`
- **Expected behavior:** Vitest or Jest with React Testing Library covers: form values survive validation errors, generated serials are read-only, person candidates appear while typing, keyboard navigation.
- **Current behavior:** `frontend/package.json` has no test framework. No test files exist under `frontend/src/`.
- **Evidence:** `frontend/package.json:6–10` — scripts: `dev`, `build`, `lint`, `preview`. No `test` script.
- **Relevant frontend file(s):** All component and screen files
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** Not applicable (none exist)
- **Recommended correction:** Add `vitest`, `@testing-library/react`, and `@testing-library/user-event` to `frontend/package.json`. Add `test` script. Write tests for `PersonField` autocomplete and `VolumeForm` serial display.
- **Risk of changing it:** Low (additive)
- **Dependencies or prerequisites:** None
- **Suggested verification:** `npm run test --workspace=frontend` passes.

---

### TEST-003 — `e2e_test.mjs` has hardcoded Windows user path and hardcoded port

- **Area:** End-to-end test portability
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §13.5` — "Tests must be deterministic, independent"
- **Expected behavior:** The test works on any machine without code modification.
- **Current behavior:** `e2e_test.mjs:5` — `const dir = 'C:\\Users\\alkin\\AppData\\Local\\Temp\\e2e_screenshots'` is hardcoded for a specific Windows user profile. Line 39 — `fetch('http://localhost:8765/vocab/role')` hardcodes the dev port.
- **Evidence:** `e2e_test.mjs:5`, `e2e_test.mjs:39`.
- **Relevant frontend file(s):** `e2e_test.mjs`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** `e2e_test.mjs`
- **Recommended correction:** Use `os.tmpdir()` for the screenshot directory; read the backend port from an environment variable or configuration.
- **Risk of changing it:** Low
- **Dependencies or prerequisites:** None
- **Suggested verification:** Run the test with a different Windows user account; confirm it works.

---

### TEST-004 — `e2e_test.mjs` does not cover the critical research workflow

- **Area:** End-to-end workflow coverage
- **Severity:** Medium
- **Specification source:** `coding_style_guide.md §13.4` — minimum critical workflow: repository → volume → work → annotation → person → relationship → trace → evidence
- **Expected behavior:** The end-to-end test exercises the complete cataloging path.
- **Current behavior:** The test covers: app load, vocab API, create repository, create volume, create person, trace screen search, annotations screen load. It does not create a work, add an annotation, create a person relationship, run a trace, or open evidence annotation. The annotation screen is only verified to contain certain text.
- **Evidence:** `e2e_test.mjs:26–148`.
- **Relevant frontend file(s):** `e2e_test.mjs`
- **Relevant backend file(s):** Not applicable
- **Relevant database model or migration:** Not applicable
- **Relevant test file(s):** `e2e_test.mjs`
- **Recommended correction:** Extend the test to: select the created volume, add a work, add an annotation, select the person in WorkForm, save the relationship, navigate to trace, select the person, verify the relationship appears, click "عرض التقييد", verify the side panel opens with the annotation text.
- **Risk of changing it:** Low (additive)
- **Dependencies or prerequisites:** TEST-003 (portability fixes first)
- **Suggested verification:** New test steps pass in CI.

---

## 13. Obsolete or Contradictory Implementation

### OBSOLETE-001 — `backend/main.py` is a scaffold stub unconnected to the application

- **Area:** Repository hygiene
- **Severity:** Low
- **Expected behavior:** Either removed or serves a documented purpose.
- **Current behavior:** `backend/main.py:1–6` contains only `def main(): print("Hello from backend!")`. The actual entry point is `backend/src/main.py`. This file cannot run the application.
- **Evidence:** `backend/main.py:1–6`.
- **Recommended correction:** Delete this file. The dev script already uses `python -m src.main`.
- **Risk of changing it:** Low

---

### OBSOLETE-002 — `frontend/src/App.css` is the Vite template stylesheet, not imported anywhere

- **Area:** Repository hygiene
- **Severity:** Low
- **Expected behavior:** Either removed or referenced from `App.tsx`.
- **Current behavior:** `App.css` contains Vite counter/hero component styles. `App.tsx` imports only `./styles/global.css` and `./styles/components.css` — not `App.css`.
- **Evidence:** `frontend/src/App.tsx:8–9`; `frontend/src/App.css` — Vite template content confirmed.
- **Recommended correction:** Delete `App.css`.
- **Risk of changing it:** Low

---

### OBSOLETE-003 — `frontend/src/assets/react.svg`, `vite.svg`, and `hero.png` are unused Vite template assets

- **Area:** Repository hygiene
- **Severity:** Low
- **Expected behavior:** These files are removed as they are not referenced by any application code.
- **Current behavior:** No `import` statement for `react.svg`, `vite.svg`, or `hero.png` exists in any source file.
- **Evidence:** `frontend/src/assets/` listing; grep for imports returns zero matches.
- **Recommended correction:** Delete all three files.
- **Risk of changing it:** Low

---

### OBSOLETE-004 — `event` imported in `models.py` but never used

- **Area:** Intended FK listener not implemented
- **Severity:** Low
- **Expected behavior:** The `event` import is either used for a connection-level PRAGMA listener (fixing DATA-003) or removed.
- **Current behavior:** `backend/src/db/models.py:4` — `event` imported but no `@event.listens_for` call anywhere in the file.
- **Evidence:** `backend/src/db/models.py:4`.
- **Recommended correction:** Wire up the FK PRAGMA listener (DATA-003 correction) or remove the import.
- **Risk of changing it:** Low

---

### OBSOLETE-005 — `electron/test_asar_main.js` is an uncommitted debug diagnostic script

- **Area:** Repository hygiene
- **Severity:** Low
- **Expected behavior:** Committed diagnostic scripts are either in a `scripts/` directory with documented purpose or removed.
- **Current behavior:** `electron/test_asar_main.js` (untracked per git status) contains only three `console.log` calls checking the Electron API. It has no test framework, no assertions, and no documented purpose.
- **Evidence:** `electron/test_asar_main.js:1–4`.
- **Recommended correction:** Delete the file or add it to `.gitignore`.
- **Risk of changing it:** Low

---

## 14. Recommended Implementation Order

### Phase 0 — Protect the Current State

**Issues addressed:** DATA-004, TEST-001 (partial baseline)

- Back up any existing `dev_archive.db` before touching the schema.
- Set up Alembic: `uv add alembic`; run `alembic init migrations`; generate an initial migration from the current schema as the baseline.
- Add `pytest` and a minimal passing test (serial format validation) so there is at least one test that can catch regressions.

**Verification before Phase 1:** `alembic upgrade head` on a copy of `dev_archive.db` produces no errors. `pytest` finds and passes the baseline test.

---

### Phase 1 — Data Integrity Blockers

**Issues addressed:** DATA-001, DATA-002, DATA-003, DATA-005, DATA-006

1. Wire up `event.listens_for(engine, "connect")` for FK PRAGMA (DATA-003) — no migration needed.
2. Generate and apply Alembic migration adding 14 fields to `persons` table (DATA-001).
3. Add `person_identification_status` seed rows (DATA-002).
4. Wrap `create_volume` in a `BEGIN IMMEDIATE` transaction (DATA-005).
5. Update delete service functions to check dependents before deleting (DATA-006).

**Principal files to change:** `backend/src/db/engine.py`, `backend/src/db/models.py`, `backend/src/db/seed.py`, `backend/src/services/volumes.py`, `backend/src/services/works.py`, `backend/src/services/annotations.py`.

**Dependencies:** Alembic must be configured (Phase 0).

**Verification before Phase 2:** All FK constraints enforced on new connections; 14 Person fields survive a round-trip through the API; seeded `person_identification_status` values returned by `GET /vocab/person_identification_status`.

---

### Phase 2 — Backend and Service Alignment

**Issues addressed:** FIELD-001, API-001, API-002, API-003, API-004, API-005, API-006, VALIDATION-001

1. Extend `PersonCreate`, `PersonUpdate`, `PersonOut` Pydantic models with 14 fields; extend `create_person` and `update_person` service methods (FIELD-001).
2. Replace raw SQLite messages in `integrity_error_handler` with Arabic text (API-001).
3. Add `GET /relationships/by-person/{person_id}` or use the trace endpoint from the persons screen (API-002).
4. Add repo `PATCH`/`DELETE` endpoints (API-003).
5. Add path validation to export endpoints (API-004).
6. Add vocab validation in service layer (API-005).
7. Fix delete endpoints to return 404 for non-existent IDs (API-006).
8. Replace English error strings in service layer with Arabic ones (VALIDATION-001).

**Principal files:** All `backend/src/api/*.py` and `backend/src/services/*.py`.

**Verification before Phase 3:** `PUT /persons/{id}` with all fields round-trips correctly; duplicate `place_key` returns Arabic 409; `DELETE /volumes/99999` returns 404.

---

### Phase 3 — Core Cataloging Workflow

**Issues addressed:** FIELD-002, FIELD-003, FIELD-004, ID-002, VALIDATION-002, VALIDATION-003, FLOW-002, FLOW-003, FLOW-004, FLOW-005, FLOW-007

1. Rebuild `PersonForm` with four collapsible sections per §7.2 (FIELD-002).
2. Implement `saveVariant` behavior in `PersonField` (FIELD-003).
3. Show author relationship when editing a work; allow replacement (FIELD-004).
4. Expose `document_number` field for volume editing (ID-002).
5. Allow mentioned persons when editing annotations (VALIDATION-002/003).
6. Add "none match" confirmation step to `PersonField` create flow (VALIDATION-003).
7. Add unsaved-changes warnings (FLOW-005).
8. Add person archive-appearances section to `PersonsScreen` (API-002/FLOW-001).
9. Extend relationships section on volumes screen (FLOW-003).
10. Move export controls out of the trace results conditional (FLOW-004).
11. Implement role tabs with keyboard navigation for trace results (FLOW-007).
12. Add repository management screen (FLOW-002).

**Principal files:** `frontend/src/screens/persons/PersonForm.tsx`, `frontend/src/screens/persons/PersonsScreen.tsx`, `frontend/src/screens/volumes/VolumesScreen.tsx`, `frontend/src/screens/volumes/WorkForm.tsx`, `frontend/src/screens/annotations/AnnotationsScreen.tsx`, `frontend/src/screens/trace/TraceScreen.tsx`, `frontend/src/api/types.ts`.

**Verification before Phase 4:** Full person card with all fields saves and reloads; editing a work shows its existing author; annotations screen allows adding people to existing annotations; trace results display as keyboard-navigable tabs.

---

### Phase 4 — Search and People System

**Issues addressed:** FIELD-003 (saveVariant full implementation), VALIDATION-003 (confirmation step), CONF-001 (confidence labels resolution)

1. Finalize variant-saving behaviour in `PersonField` with annotation source.
2. Resolve `CONF-001` (confidence labels) with researcher and update display accordingly.
3. Implement filter panel for the trace screen — frontend filters (FLOW-006), backend query parameters on `GET /trace/{person_id}`.

**Principal files:** `frontend/src/components/PersonField.tsx`, `frontend/src/screens/trace/TraceScreen.tsx`, `backend/src/api/trace.py`, `backend/src/services/trace.py`.

**Verification before Phase 5:** Typing a manuscript spelling and selecting a person saves a name variant; trace results filter correctly by repository and role.

---

### Phase 5 — UI and RTL Alignment

**Issues addressed:** RTL-001–005, UI-001–008, CONF-002 (partial)

1. Rename and correct all design tokens (UI-001, UI-002, UI-003, UI-004, UI-006).
2. Rebuild navigation sidebar with white background, correct active state (RTL-001, RTL-004).
3. Create `Header` component; import and display `irfan_logo.png` (RTL-002, RTL-003).
4. Implement confidence dots (UI-005).
5. Add keyboard navigation to `PersonField` autocomplete (UI-008).
6. Replace `window.confirm()` with `ConfirmModal` (UI-007).
7. Fix `AnnotationsScreen` volume list selection marker (RTL-005).

**Principal files:** `frontend/src/styles/tokens.css`, `frontend/src/components/Navigation.css`, `frontend/src/components/Navigation.tsx`, new `frontend/src/components/Header.tsx`, `frontend/src/components/ConfidenceTag.tsx`, `frontend/src/components/PersonField.tsx`.

**Verification before Phase 6:** The running app passes the style guide's acceptance checklist (§27): RTL, white nav, right-edge marker, logo in header, fine borders, compact tables, keyboard autocomplete, confidence with dots.

---

### Phase 6 — Testing and Packaging

**Issues addressed:** TEST-001–004, OBSOLETE-001–005

1. Add `pytest` + test suite for serial generation, normalization, evidence consistency, trace aggregation (TEST-001).
2. Add Vitest + React Testing Library; test PersonField, VolumeForm serial read-only behaviour (TEST-002).
3. Fix `e2e_test.mjs` path portability and port reference (TEST-003); extend to full workflow (TEST-004).
4. Delete obsolete files: `backend/main.py`, `frontend/src/App.css`, `frontend/src/assets/react.svg`, `frontend/src/assets/vite.svg`, `frontend/src/assets/hero.png`, `electron/test_asar_main.js` (OBSOLETE-001–005).
5. Verify packaged Electron build resolves asset paths correctly.
6. Verify `alembic upgrade head` applies cleanly from a fresh database and from the prototype's existing schema.

**Verification:** All three test suites pass; packaged installer launches cleanly on a clean machine; full e2e workflow from create repository to trace evidence runs without errors.

---

## 15. Files Reviewed

| File | Purpose |
|---|---|
| `docs/project_spec.md` | Authoritative product and data specification |
| `docs/ui_style_guide.md` | Visual and interaction specification |
| `docs/coding_style_guide.md` | Implementation quality and architecture specification |
| `backend/main.py` | Obsolete scaffold stub |
| `backend/src/main.py` | FastAPI application, IPC port signal, WAL lock check |
| `backend/src/db/engine.py` | SQLAlchemy engine and session factory |
| `backend/src/db/models.py` | ORM models (8 tables) |
| `backend/src/db/seed.py` | Vocabulary seed data |
| `backend/src/api/volumes.py` | Repositories and volumes API routes |
| `backend/src/api/works.py` | Works API routes |
| `backend/src/api/annotations.py` | Annotations API routes |
| `backend/src/api/persons.py` | Persons API routes |
| `backend/src/api/relationships.py` | Person relationships API routes |
| `backend/src/api/trace.py` | Trace-a-scholar API route |
| `backend/src/api/export.py` | CSV/JSON export API routes |
| `backend/src/api/vocab.py` | Vocabulary management API routes |
| `backend/src/services/volumes.py` | Volume and repository business logic |
| `backend/src/services/works.py` | Work business logic |
| `backend/src/services/annotations.py` | Annotation business logic |
| `backend/src/services/persons.py` | Person search and CRUD |
| `backend/src/services/relationships.py` | Relationship linking and evidence validation |
| `backend/src/services/trace.py` | Trace-a-scholar aggregation |
| `backend/src/services/export.py` | CSV and JSON export |
| `backend/src/services/vocab.py` | Vocabulary management |
| `backend/src/utils/arabic.py` | Arabic normalization |
| `backend/src/utils/hijri.py` | Hijri date parsing |
| `backend/pyproject.toml` | Python project configuration and dependencies |
| `frontend/index.html` | HTML entry point (lang=ar, dir=rtl, IBM Plex Sans Arabic) |
| `frontend/src/main.tsx` | React root |
| `frontend/src/App.tsx` | App shell: screen routing, Electron port initialization |
| `frontend/src/App.css` | Unused Vite template stylesheet |
| `frontend/src/api/client.ts` | Typed fetch wrapper |
| `frontend/src/api/index.ts` | Domain-organized API calls |
| `frontend/src/api/types.ts` | TypeScript interfaces for all API resources |
| `frontend/src/components/Navigation.tsx` | Navigation sidebar |
| `frontend/src/components/Navigation.css` | Navigation styles |
| `frontend/src/components/PersonField.tsx` | Arabic-tolerant person autocomplete |
| `frontend/src/components/VocabSelect.tsx` | Controlled vocabulary select |
| `frontend/src/components/ConfidenceTag.tsx` | Confidence display |
| `frontend/src/components/SidePanel.tsx` | Evidence side panel |
| `frontend/src/screens/volumes/VolumesScreen.tsx` | Volume list-detail screen |
| `frontend/src/screens/volumes/VolumeForm.tsx` | Volume create/edit form |
| `frontend/src/screens/volumes/WorkForm.tsx` | Work create/edit form with author field |
| `frontend/src/screens/annotations/AnnotationsScreen.tsx` | Annotation CRUD with mentioned persons |
| `frontend/src/screens/persons/PersonsScreen.tsx` | Person list-detail screen |
| `frontend/src/screens/persons/PersonForm.tsx` | Person create/edit card |
| `frontend/src/screens/trace/TraceScreen.tsx` | Scholar trace with evidence side panel |
| `frontend/src/styles/tokens.css` | Design tokens |
| `frontend/src/styles/global.css` | Global HTML/body styles |
| `frontend/src/styles/components.css` | Shared component styles |
| `frontend/package.json` | Frontend dependencies and scripts |
| `electron/src/main.ts` | Electron main process |
| `electron/src/preload.ts` | Context bridge (getBackendPort) |
| `electron/electron-builder.json` | Packaging configuration |
| `electron/package.json` | Electron scripts |
| `electron/test_asar_main.js` | Uncommitted debug script |
| `e2e_test.mjs` | Playwright end-to-end smoke test |
| `package.json` | Workspace root with dev/build/package scripts |
| `irfan_logo.png` | Approved logo — present but unused |
