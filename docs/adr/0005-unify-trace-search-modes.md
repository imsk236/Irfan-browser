# ADR 0005: Merge بحث عن عالم / ولاية / مجلد into one appearance-shaped search

**Status:** Accepted
**Supersedes:** ADR 0004 (the standalone بحث عن مجلد mode described there is retired; its filters survive as fields in the unified panel)

## Context

البحث والتتبع had three separate modes, each a separate backend query with a separate result shape: `trace_scholar(person_id)` → one row per `PersonRelationship` (appearance-shaped); `trace_wilaya(name)` → three separate ranked/aggregate lists (scholars by appearance_count, works by copy_place, repositories by volume_count); `search_volumes(...)` → one row per matching volume (volume-shaped, no person required). The three-button toggle meant the researcher had to know in advance which kind of thing they were looking for before they could start searching.

`trace_wilaya`'s single "wilaya" input actually queried three unrelated geographic fields at once — `person_wilayas.wilaya` (a scholar's own region), `Work.copy_place` (where a manuscript was physically copied), and `Repository.location` (where a خزانة sits) — conflated under one term because each produced a separate output list. Merging into one query forced them apart.

## Decision

Replace all three with a single query, exposed as one filter panel with no mode toggle: شخص (person_id), منطقة العالم (person's region, split out from مكان النسخ), العنوان, الرقم, خزانة (repository_id), مكان النسخ (work's copy place, split out from منطقة العالم), and سنة النسخ range — all optional, all combined with AND (each filter narrows the same candidate set independently, extending the intersection model from ADR 0004). At least one filter is required.

The result grain is **appearance-shaped** (one row per `PersonRelationship`), generalizing بحث عن عالم's shape rather than بحث عن مجلد's, even though this means a pure title/number/date/خزانة search (no person criteria) — بحث عن مجلد's original use case — must emit a placeholder row (no role, no evidence) for a matching مجلد/عنوان that has no relationship satisfying the person criteria, so it doesn't silently vanish from results.

`trace_scholar` is generalized in place (new params default to `None`) rather than duplicated into a new function, because `GET /persons/{id}/appearances` (PersonsScreen's person-detail view) calls it directly and the archive's central concept is the scholar/appearance — per CLAUDE.md, "trace scholars (persons) across volumes and wilayas" is the whole point of the tool. `trace_wilaya` and `search_volumes` have no callers outside `api/trace.py` and are retired outright; their query logic is absorbed into the generalized function.

بحث عن ولاية's two ranked/aggregate views (scholars by appearance_count, repositories by volume_count) are dropped, not reframed as a derived summary. البحث والتتبع is a search tool — find specific things matching criteria — not a ranking/browsing tool.

## Consequences

- `trace_scholar(session, person_id)` (used by `/persons/{id}/appearances`) keeps its exact narrow-call output — it's the same function called with every new param left `None`.
- `trace_wilaya` and `search_volumes` (and their Pydantic `Out` models / `traceApi` client methods) are deleted, not deprecated-in-place — nothing outside `api/trace.py` calls them.
- The three-button segmented control and `WilayaResults` component are removed from `TraceScreen.tsx`.
- Losing the ranked/aggregate views is a deliberate scope narrowing: a researcher who wants "who is most represented in this region" no longer has a one-click view for it.
- A pure volume/work search (no person criteria) can return placeholder rows with no role/evidence — the UI must render that state distinctly from a real appearance.
- Clicking a result row opens **WorkDetailModal in place** (same component VolumesScreen already uses for a عنوان) when the row has a `work_id` — full عنوان detail without leaving البحث والتتبع. A row with no `work_id` (a volume-level relationship, e.g. مالك/واقف recorded on the مجلد itself, or a placeholder row matched only by number/خزانة/date) has no عنوان to show in that modal, so it falls back to the existing `pendingVolumeId` cross-navigation into VolumesScreen instead — the mechanism already built for بحث عن مجلد.
