# Coding Style Guide — Omani Manuscript Archive

This guide defines how code is written, reviewed, tested, and organized across the Omani Manuscript Archive.

It applies to:

- the React and TypeScript frontend;
- the Python and FastAPI backend;
- the Electron desktop wrapper;
- SQLite access and database migrations;
- automated tests;
- scripts and configuration files.

The project specification is the authority for domain behavior. The UI style guide is the authority for visual behavior. This guide controls implementation quality and code organization.

When existing code conflicts with this guide, improve it incrementally through focused, tested changes. Do not perform unrelated rewrites.

---

## 1. Core engineering principles

### 1.1 Optimize for correctness and longevity

This archive contains long-lived scholarly data. Prefer code that is:

- explicit;
- easy to review;
- easy to test;
- safe to migrate;
- difficult to misuse;
- portable between SQLite and PostgreSQL where required by the project specification.

Do not introduce complexity merely because a framework supports it.

### 1.2 One source of truth

A rule must have one authoritative implementation.

Examples:

- serial generation belongs in the backend domain/service layer;
- database constraints provide final integrity protection;
- controlled vocabulary values come from the vocabulary source;
- frontend validation may improve usability but does not replace backend validation;
- visual tokens come from the shared UI theme, not feature-specific hardcoded values.

Do not duplicate the same domain rule independently across multiple components or routes.

### 1.3 Small, focused changes

Each change should solve one clear problem or one closely related set of problems.

Do not combine:

- schema redesign;
- unrelated UI restyling;
- dependency upgrades;
- broad file renaming;
- feature implementation;

in one change unless they are inseparable.

### 1.4 Preserve working behavior

Before changing an existing feature:

1. understand its current behavior;
2. identify the specification or issue being corrected;
3. add or update tests where practical;
4. make the smallest coherent correction;
5. run the relevant checks;
6. report remaining risks.

Do not rewrite working modules only to make them look stylistically different.

---

## 2. Domain rule: witness and interpretation

The distinction between witness and interpretation is mandatory throughout the codebase.

### Witness

Witness data records what appears in the manuscript or source exactly as written.

Examples:

- `text_as_written`;
- `date_as_written`;
- `written_form`;
- manuscript image location.

Witness values must never be silently normalized, rewritten, or replaced by inferred values.

### Interpretation

Interpretation records a researcher conclusion.

Examples:

- linking a written name to a standard person;
- assigning authorship;
- assigning confidence;
- deriving normalized date bounds;
- deciding that an annotation proves ownership.

Interpretations must retain their confidence and evidence connection where required by the project specification.

### Naming rule

Use names that make the distinction clear:

```python
text_as_written = request.text_as_written
date_earliest = normalize_hijri_start(request.date_as_written)
interpreted_person_id = selected_person.id
```

Avoid ambiguous names:

```python
text = request.text
date = parse_date(request.date)
person = guessed_match
```

### No silent identity decisions

Arabic-tolerant matching may rank candidates, but code must never automatically merge two person records based only on normalized or fuzzy similarity.

The researcher makes the final identity decision.

---

## 3. Project architecture and boundaries

Use the existing top-level structure:

```text
project/
  backend/
  frontend/
  electron/
  docs/
  tests or feature-local test directories
```

The exact internal folders may evolve, but responsibilities must remain separated.

### 3.1 Frontend responsibilities

The frontend may:

- render screens and components;
- manage local presentation state;
- collect and validate user input for immediate feedback;
- call typed backend services;
- display loading, success, validation, and error states;
- apply the shared UI design system.

The frontend must not:

- access SQLite directly;
- allocate archive serials;
- enforce database uniqueness as the only protection;
- decide person identity automatically;
- contain authoritative domain rules;
- construct SQL;
- expose Node or Electron internals directly to React components.

### 3.2 Backend responsibilities

The backend must:

- validate all external input;
- enforce domain rules;
- perform transactions;
- generate identifiers;
- check evidence consistency;
- prevent duplicate database states;
- return stable request and response models;
- translate internal failures into safe application errors;
- own export and migration behavior.

API route handlers should remain thin. They should call service functions rather than containing business logic.

### 3.3 Data-access responsibilities

Repository or data-access modules must:

- execute database queries;
- map records to domain or persistence models;
- avoid UI behavior;
- avoid HTTP concerns;
- use parameterized queries or the approved ORM;
- participate in service-controlled transactions.

Database access functions should not silently commit when the caller needs multiple operations to succeed atomically.

### 3.4 Electron responsibilities

Electron code must:

- start and stop packaged application processes;
- create and manage windows;
- expose only narrow, approved APIs through preload;
- protect the renderer from unrestricted Node access;
- resolve packaging-safe asset and process paths;
- handle desktop lifecycle behavior.

React components must not import Electron main-process APIs.

Use a typed preload boundary where renderer-to-Electron communication is required.

### 3.5 Dependency direction

Preferred dependency direction:

```text
UI components
    ↓
frontend feature/service layer
    ↓
backend API
    ↓
domain services
    ↓
repositories / ORM
    ↓
database
```

Lower layers must not import higher layers.

---

## 4. Naming conventions

Names should explain purpose without requiring the reader to inspect the implementation.

Avoid abbreviations unless they are standard and unambiguous, such as `id`, `db`, `api`, or `url`.

Use the project’s domain vocabulary consistently:

- repository;
- volume;
- work;
- annotation;
- person;
- relationship;
- evidence;
- witness;
- confidence;
- serial.

Do not use several English names for the same domain concept.

---

## 5. Python conventions

### 5.1 Naming

Use:

- variables and functions: `lower_snake_case`;
- classes and exceptions: `PascalCase`;
- constants: `UPPER_SNAKE_CASE`;
- modules and packages: `lower_snake_case`;
- private helpers: leading underscore only when genuinely internal.

```python
def generate_volume_serial(place_key: str, document_number: int) -> str:
    ...
```

### 5.2 Type hints

Type hints are required for:

- public functions;
- service methods;
- route dependencies;
- repository methods;
- return values;
- non-obvious local structures.

Avoid `Any`. Use it only when integration boundaries make a precise type impractical, and document why.

Prefer:

```python
def find_person_candidates(query: str, limit: int = 10) -> list[PersonMatch]:
    ...
```

Avoid:

```python
def find_person_candidates(query, limit=10):
    ...
```

### 5.3 Functions

A function should do one coherent job.

Split a function when it combines unrelated concerns such as:

- input validation;
- database queries;
- domain decisions;
- response formatting.

Do not impose arbitrary line limits. Use cohesion and readability as the test.

### 5.4 Documentation

Public modules, domain services, non-obvious algorithms, and integration boundaries should have concise docstrings.

Small private helpers do not need docstrings when their name and type signature are sufficient.

Comments explain why a decision exists, not what a line already says.

```python
# Allocate inside the same transaction so two accidental app instances
# cannot receive the same repository-local document number.
document_number = repository.next_document_number(repository_id)
```

### 5.5 Formatting and linting

Use the formatter and linter configured by the repository.

Recommended defaults if the project has not selected tools:

- Ruff for linting and import organization;
- Ruff formatter or Black for formatting;
- mypy or Pyright for static type checking;
- pytest for tests.

Do not manually fight the configured formatter.

---

## 6. TypeScript and React conventions

### 6.1 Naming

Use:

- variables and functions: `camelCase`;
- React components: `PascalCase`;
- types and interfaces: `PascalCase`;
- hooks: `useCamelCase`;
- true constants: `UPPER_SNAKE_CASE`;
- files: follow one consistent project convention, preferably component names for components and `kebab-case` or `camelCase` for utilities.

```typescript
function buildPersonSearchQuery(input: string): PersonSearchQuery {
  // ...
}
```

### 6.2 Strict typing

TypeScript strict mode must remain enabled.

Do not use `any` unless there is a documented integration reason.

Prefer:

- `unknown` for untrusted values;
- discriminated unions for state;
- generated or shared API types;
- explicit nullable fields;
- typed event handlers;
- typed component props.

Distinguish:

- missing property;
- `null`;
- empty string;
- empty list.

These states are not interchangeable.

### 6.3 Components

Components should remain focused on rendering and interaction.

Move logic out of JSX when it:

- performs data transformation;
- implements a domain rule;
- is reused;
- requires independent tests;
- makes the render block difficult to scan.

Prefer composition over large configurable components with many boolean props.

Avoid components such as:

```typescript
<RecordPanel
  isPerson
  isEditable
  isCompact
  isAnnotationMode
  showEvidence
  useAlternativeHeader
/>
```

Create focused components or explicit variants instead.

### 6.4 React state

Keep state as close as possible to where it is used.

Do not copy server data into several independent state variables unless editing requires a draft model.

Use one authoritative form state for a form.

Derived values should normally be computed rather than stored.

### 6.5 Effects

Use effects for synchronization with external systems, not for ordinary derived values.

Effects must:

- declare correct dependencies;
- clean up subscriptions and timers;
- avoid hidden request loops;
- guard against stale asynchronous responses where relevant.

### 6.6 Forms

Forms must:

- preserve entered values after validation failure;
- display field errors near the field;
- prevent duplicate submissions;
- distinguish create and edit payloads;
- treat generated values such as archive serials as read-only;
- use natural Arabic labels defined by the product and UI specifications.

Frontend validation improves feedback. Backend validation remains authoritative.

### 6.7 Styling

Use the shared tokens and components defined by the UI style guide.

Do not:

- hardcode new colors inside feature components;
- invent spacing values outside the approved scale;
- recreate buttons and inputs per feature;
- use inline styles for normal layout;
- create duplicate RTL and LTR styles where CSS logical properties are sufficient.

Use `dir="ltr"` only on values that require it, such as serials and technical paths.

---

## 7. API design

### 7.1 Request and response models

Every endpoint must use explicit validated schemas.

Do not return raw ORM objects directly.

Response models should be stable and contain only fields the client needs.

### 7.2 Resource naming

Use consistent resource names and URL patterns.

Example:

```text
GET    /api/persons
POST   /api/persons
GET    /api/persons/{person_id}
PATCH  /api/persons/{person_id}
GET    /api/persons/{person_id}/relationships
```

Follow the project’s existing API convention when one is already established.

### 7.3 HTTP behavior

Use status codes consistently:

- `200` successful read or update;
- `201` successful creation;
- `204` successful deletion with no body;
- `400` malformed or invalid request;
- `404` record not found;
- `409` uniqueness or state conflict;
- `422` structured validation failure where used by the framework;
- `500` unexpected internal failure.

Do not expose stack traces, SQL, local paths, or internal exception details to the UI.

### 7.4 Error contract

Return structured errors with stable machine-readable codes.

Example:

```json
{
  "code": "VOLUME_SERIAL_CONFLICT",
  "message": "تعذر إنشاء الرقم التسلسلي لأن الرقم مستخدم بالفعل.",
  "field": "document_number"
}
```

User-facing messages are Arabic.

Logs and internal diagnostics may use English.

### 7.5 Compatibility

When changing an API:

- update frontend callers;
- update tests;
- update documentation;
- avoid changing unrelated response fields;
- provide a migration path if persisted clients or exports depend on the old shape.

---

## 8. Database conventions

### 8.1 Naming

Use:

- tables: plural `lower_snake_case`;
- columns: `lower_snake_case`;
- foreign keys: `<entity>_id`;
- indexes: descriptive names;
- constraints: descriptive names when the migration system supports them.

### 8.2 Keys

All relationships use surrogate primary keys.

Human-readable serials are attributes, not relationship keys.

Never expose internal primary keys as fields the user must type.

### 8.3 SQL safety

Use the approved ORM or parameterized SQL.

Never build SQL by concatenating user-provided values.

```python
cursor.execute(
    "SELECT * FROM persons WHERE preferred_name = ?",
    (preferred_name,),
)
```

### 8.4 Portability

Stay within the SQLite and PostgreSQL common subset when required by the project specification.

Do not introduce SQLite-only behavior without:

1. documenting why;
2. isolating it;
3. providing a PostgreSQL migration strategy.

### 8.5 Constraints

Application validation does not replace database constraints.

Use database constraints for final protection of:

- unique serials;
- repository-local document numbers;
- required foreign keys;
- relationship shape;
- other invariants that the database can express portably.

Use service validation for cross-record rules the database cannot cleanly express.

### 8.6 Transactions

Use a transaction whenever an operation must succeed or fail as one unit.

Required examples include:

- allocating and inserting a repository-local document number;
- changing a repository `place_key` and regenerating affected serials;
- creating an annotation and its linked person relationships;
- creating a person, first name variant, and first relationship;
- updating evidence links that must remain consistent;
- importing or exporting coordinated record sets where partial completion would be misleading.

Do not catch an exception and continue after part of a transactional workflow has failed.

### 8.7 Deletion

Do not rely on broad cascade deletion for archival evidence.

Deletion rules must follow the project specification.

Prefer:

- blocking deletion when dependent historical records exist;
- explicit archival/inactive states;
- carefully reviewed destructive operations.

Never delete witness or relationship data silently.

### 8.8 Timestamps

Use application-generated or database-generated timestamps consistently.

Store portable ISO 8601 values or the ORM’s portable datetime type.

Use UTC internally unless the specification requires another convention.

### 8.9 Queries

Avoid N+1 query patterns.

Use clear query functions for major read paths such as trace-a-scholar.

Correctness is more important than premature caching at this project’s scale.

---

## 9. Database migrations

### 9.1 Migration rules

Every schema change requires a migration.

Do not edit an already-applied migration merely to make history look cleaner.

A migration must:

- preserve existing archive data;
- be deterministic;
- be reversible where practical;
- document destructive or irreversible operations;
- work from the previous committed schema;
- be tested using a copy of realistic data.

### 9.2 Before destructive migrations

Before a migration that may rewrite or remove data:

1. create a backup of the SQLite database;
2. verify the backup can be opened;
3. run the migration on a copy;
4. validate row counts and important relationships;
5. only then run it on the working archive.

### 9.3 Seed data

Controlled vocabulary seed operations must be idempotent.

Running the seed process twice must not create duplicates.

Do not physically delete vocabulary values that are already referenced.

---

## 10. Validation and normalization

### 10.1 Boundary validation

Validate data when it enters the system:

- API requests;
- imported files;
- Electron messages;
- command-line scripts;
- migration inputs.

Do not trust values because they came from the frontend.

### 10.2 Serial validation

The backend owns serial construction and validation.

Rules include:

- `place_key` is exactly four ASCII digits;
- document number is a valid positive integer within the supported range;
- serial format is `PPPP-DDDD`;
- serial is regenerated from components;
- the serial is never independently editable.

### 10.3 Arabic name normalization

Normalization is for search and ranking only.

Keep the original written form unchanged.

Normalization functions should:

- be deterministic;
- be independently tested;
- document each character transformation;
- avoid locale-dependent hidden behavior;
- never merge records automatically.

### 10.4 Dates

Preserve the verbatim Hijri string separately from normalized bounds.

Do not fabricate missing precision.

A year-only witness must not be displayed as though an exact day was written.

---

## 11. Error handling and logging

### 11.1 Never fail silently

Every failure must result in one or more of:

- a clear user-visible message;
- a structured API error;
- an application log entry;
- a test failure;
- a rollback.

### 11.2 Exception handling

Catch exceptions only when the code can:

- add useful context;
- convert them into an application error;
- roll back safely;
- retry safely;
- release resources.

Do not use broad exception handling that hides programming errors.

Avoid:

```python
try:
    save_record()
except Exception:
    pass
```

### 11.3 Logs

Logs should include enough context to diagnose a failure without exposing sensitive manuscript content unnecessarily.

Prefer record identifiers and operation names over dumping entire request bodies.

Do not log:

- credentials;
- tokens;
- full database files;
- unnecessary witness text;
- local personal paths when avoidable.

### 11.4 User-facing messages

User-facing messages must be:

- Arabic;
- clear;
- specific;
- actionable where possible;
- free of raw technical details.

Example:

```text
تعذر حفظ المجلد لأن الرقم مستخدم في جهة الحفظ هذه. اختر رقمًا آخر ثم أعد المحاولة.
```

---

## 12. Security and desktop safety

### 12.1 Electron security

Use secure Electron defaults:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- narrow preload APIs;
- no arbitrary command execution from the renderer;
- validate all IPC payloads;
- do not load untrusted remote content.

### 12.2 Secrets and configuration

Never commit:

- `.env` files containing secrets;
- API keys;
- credentials;
- private sync paths;
- real archive databases;
- user-specific configuration.

Provide example configuration files without secrets where needed.

### 12.3 File paths

Treat file paths as untrusted input.

Normalize and validate paths before reading or writing.

Do not allow a renderer-controlled path to escape approved directories without explicit user selection and backend validation.

### 12.4 Dependencies

Add a dependency only when it provides clear value that cannot reasonably be achieved with existing tools.

Before adding one:

- check maintenance status;
- check license compatibility;
- check package size where relevant;
- check security history;
- confirm it works in packaged Electron builds.

---

## 13. Testing strategy

### 13.1 General rule

Every important domain rule requires an automated test.

A visual feature also requires a clear manual or screenshot acceptance check when automated coverage is insufficient.

### 13.2 Backend tests

Required high-priority coverage includes:

- repository and volume creation;
- serial generation;
- serial collision prevention;
- repository-local numbering;
- transaction rollback;
- person name normalization;
- duplicate-candidate ranking;
- evidence annotation consistency;
- person relationship level rules;
- trace-a-scholar aggregation;
- controlled vocabulary deactivation;
- witness preservation;
- export completeness;
- migration behavior.

### 13.3 Frontend tests

Test behavior, not internal component implementation.

High-priority cases include:

- form values survive validation errors;
- generated serials are read-only;
- person candidates appear while typing;
- selecting an existing person does not create a duplicate;
- loading, empty, error, and saved states;
- Arabic labels and RTL ordering;
- keyboard navigation of search and dropdowns;
- role-first person questions;
- trace result grouping.

### 13.4 End-to-end tests

End-to-end tests should cover complete research workflows.

Minimum critical workflow:

```text
create repository
→ create volume
→ add work
→ add annotation
→ identify or create person
→ create relationship with evidence
→ trace the person
→ open the proving annotation
```

Use isolated test data. Never run destructive end-to-end tests against the real archive database.

### 13.5 Test quality

Tests must be:

- deterministic;
- independent;
- clear about the behavior being protected;
- fast enough for normal development;
- explicit about test setup.

Avoid tests that depend on execution order or real clock time without controlling it.

### 13.6 Regression tests

Every fixed bug should receive a regression test when practical.

The test should fail before the fix and pass after it.

---

## 14. Accessibility and localization in code

### 14.1 Arabic first

User-facing strings should not be scattered through business logic.

Keep interface strings in a consistent localization structure, even if Arabic is the only v1 language.

### 14.2 Direction

Set the application document direction centrally.

Do not manually reverse arrays or DOM order merely to simulate RTL.

Use CSS logical properties and semantic document order.

Apply local LTR direction only to technical values such as:

- `0001-0448`;
- file paths;
- URLs;
- code;
- certain numeric date representations.

### 14.3 Accessible components

Interactive components must:

- use semantic elements;
- support keyboard use;
- expose labels;
- preserve visible focus;
- announce validation errors where appropriate.

Do not make a clickable `div` when a `button` or `a` element is correct.

---

## 15. Files, modules, and imports

### 15.1 Module size

There is no fixed maximum file length, but a file should have one clear responsibility.

Split files when unrelated concerns accumulate.

Do not split cohesive code into many tiny files that are harder to navigate.

### 15.2 Imports

Use consistent import ordering through the configured formatter or linter.

Avoid circular dependencies.

Prefer approved project aliases over long fragile relative paths when aliases are configured.

### 15.3 Public APIs

Modules should expose a small, deliberate public surface.

Do not export internal helpers merely to make tests easier. Test through the public behavior unless the helper contains a substantial independent algorithm.

### 15.4 Dead code

Delete dead code and commented-out implementations.

Git preserves history.

Temporary diagnostic code must not remain in committed production paths.

---

## 16. Performance

The archive is small enough that clarity should take priority over speculative optimization.

Optimize only when:

- a real operation is measurably slow;
- profiling identifies the cause;
- the improvement does not weaken correctness.

Appropriate optimizations may include:

- indexes for person search and relationship retrieval;
- eager loading to prevent N+1 queries;
- debounced frontend search;
- pagination or virtualization for genuinely long lists.

Do not add distributed caches, queues, or complex state systems without demonstrated need.

---

## 17. Git and commit discipline

### 17.1 Before editing

- confirm the active branch;
- confirm the working tree state;
- read the relevant specification and issue;
- identify affected tests;
- avoid overwriting unrelated user changes.

### 17.2 Commit scope

Commits should be focused and reviewable.

Examples:

```text
fix: generate volume serials transactionally
test: cover Arabic person-name normalization
ui: rebuild scholar trace shell from approved reference
docs: clarify repository place-key correction
```

### 17.3 Do not commit

Do not commit:

- real SQLite archive files;
- generated build output unless explicitly required;
- `node_modules`;
- credentials;
- local settings;
- editor-specific temporary files;
- screenshots containing private data unless approved.

### 17.4 Migrations

Commit a migration with the code that depends on it.

Do not leave the application expecting a schema that the repository cannot create.

---

## 18. Required checks before completion

Run the checks that apply to the changed area.

Typical checks include:

### Frontend

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

### Backend

Use the project’s configured commands for:

```text
format check
lint
type check
unit and integration tests
migration validation
```

### Electron

Verify:

- development startup;
- clean shutdown;
- packaged asset paths;
- preload API behavior;
- production build or package step where available.

### End-to-end

Run the relevant end-to-end workflow after changes that cross frontend, backend, or database boundaries.

Do not claim checks passed unless they were actually run.

Report skipped checks and the reason.

---

## 19. Agent implementation protocol

Coding agents working in this repository must follow this sequence.

### 19.1 Before modifying code

1. Read the relevant documents under `docs/`.
2. Inspect existing implementation and tests.
3. State the intended scope.
4. List the files expected to change.
5. Identify database or migration impact.
6. Ask for clarification only when a decision is genuinely unresolved.

### 19.2 During implementation

- make small coherent changes;
- preserve unrelated code;
- add tests with domain changes;
- do not invent fields;
- do not infer requirements solely from screenshots;
- do not replace approved assets;
- do not commit or push unless explicitly requested.

### 19.3 After implementation

Report:

- files changed;
- behavior changed;
- tests and checks run;
- migration impact;
- known limitations;
- unresolved specification conflicts.

Show the relevant diff or summary before broad follow-up work.

---

## 20. Review checklist

Before considering code complete, verify:

### Domain

- Is witness data kept separate from interpretation?
- Are person identity decisions left to the researcher?
- Are evidence relationships valid?
- Are serials generated from authoritative components?

### Architecture

- Is business logic outside UI components and route handlers?
- Are database operations isolated?
- Are Electron APIs exposed through a narrow boundary?
- Is there one source of truth for each rule?

### Data safety

- Is the operation transactional where required?
- Are constraints present?
- Is existing data preserved?
- Is a migration included when needed?
- Are destructive actions explicit?

### Code quality

- Are names clear?
- Are types precise?
- Are comments explaining reasons rather than restating code?
- Is dead code removed?
- Are dependencies justified?

### User experience

- Are messages Arabic and actionable?
- Are form values preserved on failure?
- Is keyboard access supported?
- Are loading, empty, saved, and error states handled?

### Verification

- Were relevant tests added or updated?
- Were linting, type checking, and builds run?
- Was the real end-to-end workflow tested where appropriate?
- Were skipped checks reported honestly?

---

## 21. Definition of done

A change is complete only when:

- it matches the project specification;
- it follows this coding guide;
- it does not contradict the UI style guide;
- data integrity is protected;
- relevant tests pass;
- relevant static checks pass;
- migration impact is handled;
- errors are visible and safe;
- documentation is updated when behavior changes;
- the implementation report states exactly what was and was not verified.
