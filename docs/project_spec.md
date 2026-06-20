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
- `document_number` is a **per-repository running count assigned automatically by the system** (not the library's shelfmark and not user-editable in the UI). Assigned as `MAX(document_number) for that repository + 1` at volume creation. To avoid duplicate assignment under accidental double-open or sync conflict, do this inside a transaction (`BEGIN IMMEDIATE` … `SELECT COALESCE(MAX(document_number),0)+1` … `INSERT` … `COMMIT`). The library's own shelfmark is stored separately as informational text.
- The serial is globally unique (enforced by a unique constraint on `volumes.serial`). The `UNIQUE(repository_id, document_number)` constraint is the final protection on the running count.
- **Serial editing policy (resolved):** `place_key`, `document_number`, and `serial` must never disagree. The researcher may change the **repository** (which changes the `place_key` component and regenerates the serial); `document_number` is system-assigned and not exposed as an editable field. The serial is never hand-typed into a state that contradicts its parts.

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
  id                    INTEGER PRIMARY KEY,
  preferred_name        TEXT NOT NULL,              -- الاسم المعتمد؛ الحقل الوحيد المطلوب
  identification_status TEXT,                       -- vocab person_identification_status
  ism                   TEXT,
  kunya                 TEXT,
  laqab                 TEXT,
  nisba_1               TEXT,
  nisba_2               TEXT,
  known_as              TEXT,                       -- الشهرة أو المعروف به
  birth_date_as_written TEXT,
  birth_year_earliest   INTEGER,
  birth_year_latest     INTEGER,
  death_date_as_written TEXT,
  death_year_earliest   INTEGER,
  death_year_latest     INTEGER,
  birth_place           TEXT,
  death_place           TEXT,
  region_or_country     TEXT,
  scholarly_affiliation TEXT,
  occupation_or_status  TEXT,
  notes                 TEXT
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
- `person_identification_status`: معروف، غير مكتمل التعريف، مجهول، يحتاج إلى مراجعة

All categories must be admin-extendable (researcher can add new values later). **Vocabulary values that are already in use must never be physically deleted.** Carry an `is_active` flag instead: an inactive value stays valid for existing records but disappears from new-entry dropdowns. (Values remain stored by value as above; an ID-based vocabulary is deliberately out of scope to keep the prototype simple.)

---

## 7. UX requirements

RTL Arabic everywhere. Person identity and manuscript relationships must be treated as separate concerns.

### 7.1 Person identity is independent from manuscript relationships

A person record describes the person as a normalized identity in the archive. It must not contain a permanent field for the person's relationship to a manuscript.

The create/edit person screen must not contain fields such as:

- علاقته بالمخطوط
- الدور
- الصفة في المخطوط
- المجلد المرتبط
- العنوان المرتبط
- القيد المرتبط

These relationships are created only from the relevant cataloging context:

- While entering a title, ask for the author, scribe, additional scribe, copy recipient, and other title-level roles.
- While entering an annotation, ask for the annotation writer and connected or mentioned persons.
- When a relationship applies to the whole volume, create it from the volume page.

The application derives the correct `person_relationships` row from the screen context. A person may hold different roles in different records, so no manuscript role is a permanent attribute of the person.

### 7.2 Person card

The create/edit person screen must be presented as one structured person card divided into logical sections. It must not be a long collection of unrelated fields spread across the page.

Most fields are optional. The researcher must be able to save a person using only the preferred name and enrich the record later.

#### 7.2.1 Basic identity

Always visible:

- **الاسم المعتمد** — required; the main display and search name.
- **حالة التعريف** — optional controlled vocabulary: معروف، غير مكتمل التعريف، مجهول، يحتاج إلى مراجعة.

The preferred name may be entered as one complete string. Structured fields are never required for initial creation.

#### 7.2.2 Structured name details

Optional and collapsed by default:

- الاسم الشخصي
- سلسلة النسب of flexible depth
- الكنية
- اللقب
- النسبة الأولى
- النسبة الثانية
- الشهرة أو المعروف به

The nasab chain uses repeatable rows so the researcher may add as many ancestors as needed. Structured fields must not automatically overwrite the preferred name.

#### 7.2.3 Name variants

A person may have any number of witnessed name forms. Each variant stores:

- the form exactly as written;
- an optional note;
- its source annotation when available.

Variants belong to the same normalized person and must not create separate person records. The system must never auto-merge people based only on similarity.

#### 7.2.4 Additional identifying information

Optional and collapsed by default:

- birth date or approximate birth range;
- death date or approximate death range;
- birth place;
- death place;
- region or country;
- scholarly affiliation or school, when the researcher chooses to record it;
- occupation, scholarly status, or another identifying description.

None of these fields is required to create a person.

#### 7.2.5 Notes

A free-text area for identification hypotheses, possible confusion with other persons, lineage comments, source disagreements, and matters requiring later review.

### 7.3 Fast person creation

The system must support a fast name-only flow:

1. The researcher types a name in a person field.
2. Existing candidates are shown before creation.
3. The researcher selects an existing person or confirms that none match.
4. A new person may be saved with only `preferred_name`.
5. Optional person-card sections may be completed immediately or later.

The candidate panel must appear before the final create action to reduce duplicate identities.

### 7.4 Inline Arabic-tolerant matching

In every person field, show existing persons ranked against both the preferred name and recorded name variants.

Normalize for search by unifying hamza and alef forms, folding taa marbuta/haa and yaa/alef-maqsura where appropriate, and removing diacritics and tatweel. Normalization is only a search and ranking aid; it never replaces the witnessed form and never causes an automatic merge.

Rank candidates in stages: exact written-form match, exact normalized match, prefix match, token match, fuzzy similarity, then manual confirmation. The researcher always makes the final identity decision.

When an existing person is selected, the newly typed manuscript spelling may be stored as a new `person_name_variant` with its evidence source.

### 7.5 Role-first questions during cataloging

Person relationships are entered naturally from the manuscript context. The UI asks role-specific questions rather than exposing raw relationship-table fields.

Examples:

- **من المؤلف؟** → `role = مؤلف`
- **من نسخ هذا العنوان؟** → `role = ناسخ`
- **لمن نُسخ؟** → `role = منسوخ له`
- **من كتب القيد؟** → `role = كاتب قيد`
- **من المالك؟** → `role = مالك`
- **من الأشخاص المذكورون أو المتصلون بالقيد؟** → one or more contextual relationships

The role, relationship level, and foreign-key wiring are derived from the screen and question context.

### 7.6 Person profile and archive appearances

After a person is saved, the person profile may show a read-only section titled **مواضع ظهور الشخص في الأرشيف**.

This section aggregates relationships created from volume, title, and annotation entry. It is not the primary place for creating those relationships.

Each result should show:

- role;
- volume serial;
- title name when applicable;
- annotation type or number when applicable;
- confidence;
- evidence source;
- a control to open the original record.

### 7.7 Mentioned and connected persons

A single annotation may contain several connected or merely mentioned persons. The annotation form must allow adding multiple people. Each selected person creates a separate relationship linked to that annotation, with the role appropriate to the context, such as `مذكور`, `بائع`, `مشترٍ`, or another controlled role.

### 7.8 Person-card layout

```text
شخص جديد

┌──────────────────────────────────────────────┐
│ الهوية الأساسية                             │
│ الاسم المعتمد *                              │
│ [                                           ]│
│ حالة التعريف                                 │
│ [اختر الحالة]                                │
├──────────────────────────────────────────────┤
│ تفاصيل الاسم                         [فتح]   │
├──────────────────────────────────────────────┤
│ صيغ الأسماء                          [+ إضافة]│
├──────────────────────────────────────────────┤
│ معلومات تعريفية إضافية               [فتح]   │
├──────────────────────────────────────────────┤
│ ملاحظات                                     │
│ [                                           ]│
└──────────────────────────────────────────────┘

[إلغاء] [حفظ الشخص]
```

Advanced sections are collapsed by default. The basic identity remains visible. The card should occupy a focused, readable content column and avoid excessive empty space.

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
4. **Serial editability.** Resolved: linking uses surrogate keys, so serials are safe to change. The chosen policy is edit-the-components-and-regenerate: the researcher may change the **repository** (the `place_key` component) and the serial regenerates automatically. `document_number` is system-assigned at creation and is not exposed for editing — the numeric suffix of the serial is therefore fixed once assigned.
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
