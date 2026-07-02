# ADR 0002: نوع القيد and الدور bypass vocab validation for "غير ذلك" entries

**Status:** Accepted

## Context

Both fields are normally populated from the `vocab` table (categories `annotation_type`, `role`) and validated server-side against it. We're adding a **غير ذلك** option that reveals a free-text field so the researcher can record a type/role not yet in the curated list.

Two options were considered for what happens to that typed value:

- **Add it to `vocab` permanently** (`add_value` already exists, unused) — reusable in future dropdowns, but the app has no UI anywhere to delete a vocab value (`deactivate_value`/`DELETE /vocab/{category}/{value}` exist server-side but are never called from the frontend). A typo or one-off entry would sit in the dropdown forever with no way to clean it up short of editing the SQLite file directly.
- **True free text** — the typed value is stored only on that record, is not added to `vocab`, and does not reappear as a dropdown option later.

## Decision

Use true free text. `validate_value()` is no longer called for `annotation_type` (in `create_annotation`/`update_annotation`) or `role` (in `link_person_to_work`/`link_person_to_volume`) — these two fields become plain, unvalidated strings at the API layer. The `vocab` table still supplies the dropdown's suggested options; it's just no longer an enforced constraint for these two categories.

## Consequences

- No new vocab-management UI needed for now. If recurring "other" values later justify promoting them to real vocab entries, that's a manual `vocab` table edit (or a future settings feature) — not automatic.
- Free-text values are not deduplicated/normalized — the researcher can accidentally create near-duplicate strings (e.g. "وقفية جزئية" vs "وقفيه جزئيه"). Accepted trade-off for a single-researcher tool over building a vocab manager just for this.
- If a value repeats often enough to justify becoming a real vocab option, someone needs to add it to `vocab` (via seed data or direct DB edit) — typing it as "other" repeatedly will not do that automatically.
