# Omani Manuscript Archive — Technical Specification

> Build-ready spec for an implementing agent. The product is a personal research archive for cataloging ~400 Omani manuscript volumes and tracing scholars across them. Read the whole document before scaffolding; the data model and the person-entry UX are the load-bearing parts.

---

## 1. Product goal

A single researcher catalogs manuscripts and later traces a scholar by name to retrieve **every script that scholar touched** in any capacity: authored, copied, owned, borrowed, endowed, annotated, or merely mentioned. The retrieval requirement drives the entire data model: person identity must be normalized so one scholar maps to all the variant name forms found across volumes.

Non-goal: codicological reconstruction. We catalog *works* inside *volumes*, not physical quires/units.

---

## 2. Users, scale, deployment

- **Users:** one researcher. No concurrent writers.
- **Machines:** two (home + work), used at different times, never simultaneously.
- **Scale:** ~400 volumes, multiple works/annotations/persons each. Total dataset is on the order of low tens of thousands of rows. This is small data; do not over-engineer for scale.
- **Locale:** Arabic UI, RTL layout throughout.
- **Entry:** fully manual. No OCR/import pipeline in v1.

### 2.1 Architecture (v1 — ship this)

- **Storage:** a single SQLite file = the entire archive.
- **App:** local desktop application. Three logical layers (UI / service / DB) but packaged as one installable app, no server process.
- **Sync:** the SQLite file lives in a folder that syncs between the two machines (user-managed cloud-sync folder). Enforce a **single-writer rule**: the app must detect and warn if the DB file appears open/locked elsewhere, because whole-file sync cannot merge concurrent edits.
- **Images:** manuscript photographs are external files on disk. The DB stores only a location reference string per annotation. **Never embed image binaries in the DB.**

### 2.2 Migration path (v2 — do not build now, but do not block it)

A later move to a hosted, multi-user setup (PostgreSQL + always-on backend + browser frontend) must be a config change, not a rewrite. Therefore:

- Use a standard ORM / parameterized SQL. **No SQLite-only features, no raw-file tricks.** Stay on the SQLite∩Postgres common subset.
- Keep the schema portable (see §5). The SQLite→Postgres migration must remain the standard, documented path.
- Keep images decoupled from the DB so only the small DB file migrates.

### 2.3 Data longevity (hard requirement)

The data must outlive the app. Provide a full export to plain files (CSV per table, plus a single JSON dump) that is readable without the application.

---

## 3. Core data principle: witness vs interpretation

Every fact is one of two kinds, and the schema must keep them separate:

- **Witness (`as_written`)** — transcribed verbatim from the page. Immutable evidence. Carries no confidence.
- **Interpretation** — a conclusion drawn by the researcher. Carries a confidence level and points back to the witness that supports it.

Concretely: a name as it appears in a manuscript is a witness; the assertion "this name = standard person X" is an interpretation. A date string copied off the page is a witness; the normalized date range is an interpretation. Annotation text is a witness; "this annotation proves person X owned the volume" is an interpretation (a relationship that cites the annotation).

---

## 4. Identity & the serial scheme

### 4.1 Surrogate keys for all linking

Every table has an auto-generated surrogate primary key (integer autoincrement or UUID). It is **never shown in the UI** and is never typed by the user. All foreign keys reference surrogate keys. This is what the user meant by removing the "silent identifier" as a visible field: there is no hand-managed `V000001`; the DB issues the key invisibly.

Consequence: the human-readable serial is just an attribute and **may be corrected later** (by editing its components, which regenerates it; see §4.2) without breaking any relationship.

### 4.2 The human-readable serial

Format, digits only, fixed width, hyphen separator:

```
PPPP-DDDD          e.g.  0001-0448
└┬─┘ └┬─┘
 │    └ document_number, zero-padded to 4, running count within the repository
 └ repository.place_key, zero-padded to 4
```

- `place_key` is assigned once per repository.
- `document_number` is a **per-repository running count the researcher controls** (not the library's shelfmark). Assigned as `MAX(document_number) for that repository + 1` at volume creation. To avoid duplicate assignment under accidental double-open or sync conflict, do this inside a transaction (`BEGIN IMMEDIATE` … `SELECT COALESCE(MAX(document_number),0)+1` … `INSERT` … `COMMIT`). The library's own shelfmark is stored separately as informational text.
- The serial is globally unique (enforced by a unique constraint on `volumes.serial`). The `UNIQUE(repository_id, document_number)` constraint is the final protection on the running count.
- **Serial editing policy (resolved):** `place_key`, `document_number`, and `serial` must never disagree. The researcher edits the components (repository and document number); the serial is then **regenerated automatically** from them. The serial is never hand-typed into a state that contradicts its parts.

---

## 5. Schema

SQLite dialect shown; keep it Postgres-compatible. Arabic UI labels noted in comments; column names are English snake_case. Vocabulary tables hold the controlled Arabic values as seed data (§6).

```sql
-- جهات الحفظ
CREATE TABLE repositories (
  id            INTEGER PRIMARY KEY,
  place_key     TEXT NOT NULL UNIQUE,        -- 4-digit string, e.g. '0001'
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,               -- FK-by-value -> vocab repository_kind (institution | personal)
  notes         TEXT
);

-- المجلدات
CREATE TABLE volumes (
  id                 INTEGER PRIMARY KEY,
  repository_id      INTEGER NOT NULL REFERENCES repositories(id),
  document_number    INTEGER NOT NULL,        -- running count within repository
  serial             TEXT NOT NULL UNIQUE,    -- assembled 'PPPP-DDDD', editable
  library_shelfmark  TEXT,                     -- the library's own number, informational
  folio_count        INTEGER,
  notes              TEXT,
  UNIQUE (repository_id, document_number)
);

-- الأشخاص (standard, normalized person record)
CREATE TABLE persons (
  id             INTEGER PRIMARY KEY,
  preferred_name TEXT NOT NULL,                -- required display name; allows fast "name only" create
  ism            TEXT,                            -- given name, e.g. محمد
  nisba_1        TEXT,
  nisba_2        TEXT,
  laqab          TEXT,                            -- optional. NOTE: kunya field intentionally removed
  notes          TEXT
);
-- preferred_name carries names that resist clean splitting, e.g. أبو محمد المعروف بابن النظر.
-- Structured fields (ism, nisba, laqab) stay optional and can be filled in later.

-- nasab chain of flexible depth (enables lineage queries in phase 2)
CREATE TABLE person_ancestors (
  id          INTEGER PRIMARY KEY,
  person_id   INTEGER NOT NULL REFERENCES persons(id),
  position    INTEGER NOT NULL,                -- 1 = father, 2 = grandfather, ...
  name        TEXT NOT NULL,
  UNIQUE (person_id, position)
);

-- witness name forms: every spelling of this person found in manuscripts
CREATE TABLE person_name_variants (
  id                 INTEGER PRIMARY KEY,
  person_id          INTEGER NOT NULL REFERENCES persons(id),
  written_form       TEXT NOT NULL,            -- as_written, immutable evidence
  normalized_form    TEXT,                     -- search/ranking key only; never replaces written_form
  source_annotation_id INTEGER REFERENCES annotations(id),  -- where this spelling was witnessed
  notes              TEXT,
  UNIQUE (person_id, written_form)             -- no duplicate spelling on the same person
);
-- written_form is NOT globally unique: two different people may genuinely share a written name.
-- normalized_form is for matching only (see §7.2). A variant should ideally cite its source
-- annotation so the evidence can be located on the page.

-- الآثار
CREATE TABLE works (
  id               INTEGER PRIMARY KEY,
  volume_id        INTEGER NOT NULL REFERENCES volumes(id),
  title            TEXT NOT NULL,
  -- NOTE: no author column. Authorship is a person_relationships row with role = مؤلف.
  -- One authoritative representation; supports multiple and uncertain authors with confidence.
  work_type        TEXT,                       -- vocab work_type
  start_unit       TEXT,
  end_unit         TEXT,
  notes            TEXT
);

-- التقييدات (primary historical source)
CREATE TABLE annotations (
  id              INTEGER PRIMARY KEY,
  volume_id       INTEGER NOT NULL REFERENCES volumes(id),
  work_id         INTEGER REFERENCES works(id),     -- nullable
  annotation_type TEXT NOT NULL,               -- vocab annotation_type
  text_as_written TEXT,                         -- witness
  date_as_written TEXT,                         -- witness, verbatim Hijri string
  date_earliest   INTEGER,                      -- interpretation: normalized sortable Hijri bound
  date_latest     INTEGER,                      -- interpretation
  date_precision  TEXT,                         -- vocab date_precision (day|month|year|decade|century|unknown)
  image_location  TEXT,                         -- اللوحة, e.g. '15ي', '15س'
  notes           TEXT
);

-- ارتباطات الأشخاص (heart of the archive)
CREATE TABLE person_relationships (
  id                    INTEGER PRIMARY KEY,
  person_id             INTEGER NOT NULL REFERENCES persons(id),
  level                 TEXT NOT NULL,          -- 'volume' | 'work'
  volume_id             INTEGER REFERENCES volumes(id),
  work_id               INTEGER REFERENCES works(id),
  role                  TEXT NOT NULL,          -- vocab role (incl. 'مذكور')
  confidence            TEXT NOT NULL,          -- vocab confidence
  evidence_source       TEXT,                   -- vocab evidence_source
  evidence_annotation_id INTEGER REFERENCES annotations(id),  -- the annotation that proves this link
  notes                 TEXT,
  CHECK (
    (level = 'work'   AND work_id   IS NOT NULL AND volume_id IS NULL) OR
    (level = 'volume' AND volume_id IS NOT NULL AND work_id   IS NULL)
  )
);

-- For a work-level relationship, the owning volume is reached via works.volume_id.
-- Do not store both work_id and volume_id on one row; at this scale there is no
-- performance reason to denormalize, and storing both invites contradictory states.
```

**Date normalization:** store `date_as_written` verbatim. Derive `date_earliest`/`date_latest` as comparable Hijri integers (e.g. packed `YYYYMMDD`, missing components expanded to the bound: a year-only date → earliest = YYYY0101, latest = YYYY1230). This lets range queries ("annotations 1050–1100 AH") work without faking precision. Hijri is primary; a Gregorian equivalent column may be added later as convenience.

**Evidence annotation consistency (service-layer rule):** a foreign key alone cannot guarantee the linked annotation belongs to the right place, so the service layer must validate it. For a work-level relationship, `evidence_annotation_id` must point to an annotation in the same work, or at least the same volume. For a volume-level relationship, the annotation must belong to that volume. When no annotation is linked, require an `evidence_source` value instead, or explicitly mark the link as an undocumented interpretation. This rule is mandatory; skipping it silently corrupts the evidence trail.

**Authorship is a relationship, not a column:** there is no author column on `works` and no free-text author. Authorship is recorded as a `person_relationships` row with `role = مؤلف`, which lets a work carry multiple or uncertain authors, each with its own confidence and evidence. If the researcher wants to limit a work to one author, enforce it in the service layer (a portable partial-unique rule on author-role rows for that work), not with a database constraint.

---

## 6. Controlled vocabularies (seed data)

Store in a single `vocab(category, value, sort_order)` table or one table per category — implementer's choice, but values are fixed and selected from dropdowns, never free-typed.

- `role`: مؤلف، ناسخ، مالك، مستعير، واقف، مقيّد، **مذكور**
- `confidence`: مؤكد، مرجح، محتمل
- `evidence_source`: قيد الفراغ، ظهرية الكتاب، تحليل الخط، قيد
- `work_type`: كتاب، رسالة، قصيدة، فتوى
- `annotation_type`: تملك، وقف، إهداء، ولادة، وفاة
- `date_precision`: يوم، شهر، سنة، عقد، قرن، مجهول
- `repository_kind`: مؤسسة، مكتبة شخصية

All categories must be admin-extendable (researcher can add new values later). **Vocabulary values that are already in use must never be physically deleted.** Carry an `is_active` flag instead: an inactive value stays valid for existing records but disappears from new-entry dropdowns. (Values remain stored by value as above; an ID-based vocabulary is deliberately out of scope to keep the prototype simple.)

---

## 7. UX requirements

RTL Arabic everywhere. Four primary screens: (1) catalog a volume + its works, (2) record annotations, (3) manage person records, (4) trace-a-scholar search.

### 7.1 Person entry is role-first (critical)

The storage model attaches people to works/volumes through a `person_relationships` row carrying a role. **The UI must never expose this as "add a person, then pick a role."** Instead the screen asks the role-appropriate question in plain language, and the role is set silently from context:

- On a work: **"who is the author?"** → writes a relationship with `role = مؤلف`.
- On a copy/scribe note: **"who copied this?"** → `role = ناسخ`.
- On a `تملك` annotation: **"who owned it?"** → `role = مالك`.
- …and so on per role/context.

The cataloger answers a natural question; the role, level, and FK wiring happen behind the scenes.

### 7.2 Inline person matching (the integrity guard)

In every person field above, as the user types, show existing `persons` ranked by match against their `person_name_variants` and standard name. This prevents creating a duplicate person record, which would silently split a scholar's scripts and corrupt the trace result.

Matching must be **Arabic-tolerant**: normalize before comparing — unify hamza forms, alef variants (أ/إ/آ/ا), taa marbuta vs haa (ة/ه), yaa/alef-maqsura (ي/ى), strip diacritics and tatweel. Store this as the `normalized_form` search key, but **normalization is for search and ranking only; it never replaces the written form** and the system never auto-merges two people on a fuzzy score. The user always chooses the identity.

Run candidates through a staged pipeline, strongest signal first: exact match on the written form, then exact match on the normalized form, then prefix match, then token match, then fuzzy similarity, and finally manual confirmation. Folding ة→ه and ى→ي widens the candidate net but can also pull in genuinely different names, which is exactly why the final identity decision stays with the researcher.

When the user selects an existing match, link to it (and optionally store the freshly typed spelling as a new `person_name_variant`). When they confirm none match, create a new person inline.

### 7.3 Person record richness is optional

A person may be as thin as one name or as rich as full nasab + nisbas + laqab. Entry must allow a fast "name only" create now, enrich later. Do not force structured fields at creation time.

### 7.4 Mentioned persons (`مذكور`)

A single annotation may name several non-party people. Allow the cataloger, while entering the annotation, to attach mentioned persons to the note; each creates a `person_relationships` row with `role = مذكور` and `evidence_annotation_id` set to that annotation. (See open question 9.3 on inline-vs-stepwise; default to attaching within the annotation form.)

---

## 8. Trace-a-scholar (primary read path)

Input: a selected standard person (found via the same Arabic-tolerant search). Output: all scripts linked to that person, **grouped by role**, where each result row shows:

- the volume serial and, where the link is at work level, the work title;
- the `role` and `level`;
- the `confidence`;
- the proving annotation (`evidence_annotation_id`), openable to its text and image location.

Results must aggregate across all of the person's name variants (because everything links via the surrogate `person_id`, this is automatic). A result list that silently omits matches is worse than none — correctness of this aggregation is the project's whole point.

Phase 2 (later, not v1): scholarly networks, lineage networks via `nisba`/`person_ancestors`, ownership chains, date-bounded queries. The schema already supports these; no v1 UI required.

---

## 9. Open questions / assumptions baked in

These were not finalized in design. Implement the stated default and surface them for the researcher to confirm.

1. **Data source vs holding place.** Current model assumes the place that holds the manuscript == the place the images came from (one `repository_id` on `volumes`). If these can differ, add `source_repository_id` to `volumes`. **Default:** single repository link.
2. **New-person creation flow.** **Default:** inline creation, but the matches panel is shown first so the user sees existing candidates before a new record is made.
3. **`مذكور` tagging flow.** **Default:** tag mentioned persons within the annotation entry form (not a separate later step).
4. **Serial editability.** Resolved: linking uses surrogate keys, so serials are safe to change. The chosen policy is edit-the-components-and-regenerate: the researcher edits repository/document number and the serial is rebuilt from them, so the three fields can never contradict. Confirm this matches the researcher's expectation.
5. **Photo access across two machines** is a deployment concern, not a schema one: images stay external; only `image_location` strings are in the DB. How the two machines reach the image files is left to the user's storage setup.

---

## 10. Non-functional summary

- Portable single-file SQLite; standard SQL/ORM only; SQLite∩Postgres subset.
- Single-writer guard for the synced-file model.
- Full plain-file export (CSV + JSON) for longevity.
- Images external; never embedded.
- All controlled vocabularies admin-extendable.
- Service-layer format validation: `place_key` is exactly four ASCII digits, zero-padded, no spaces; assembled serials must match `^[0-9]{4}-[0-9]{4}$`. Keep these checks in the service layer rather than the database, since cross-database pattern constraints vary.
- Zero data loss on serial/repository correction (guaranteed by surrogate-key linking).
