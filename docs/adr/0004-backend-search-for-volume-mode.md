# ADR 0004: بحث عن مجلد runs a backend query, not client-side fetch-all

**Status:** Accepted

## Context

Every existing list/search screen (VolumesScreen, PersonsScreen, and التتبع's بحث عن عالم / بحث عن ولاية modes) fetches its full dataset once and filters in-memory with `Array.filter` — workable at ~400 volumes. The new بحث عن مجلد mode (search a volume by title/number, narrowed by copy-date range and خزانة) doesn't fit that pattern: العنوان lives on `Work`, which today is only fetched per-volume on drill-down, never in bulk; and narrowing by year means checking `Work.copy_year` OR `Annotation.annotation_year` across a join that no in-memory dataset currently holds.

## Decision

بحث عن مجلد is served by a new backend endpoint that runs a real SQLAlchemy query — joining Volume → Work, Volume → Annotation, and Volume → Repository, with `WHERE` clauses on title, serial/repository_volume_number, repository_id, and copy_year/annotation_year — rather than expanding the frontend to bulk-fetch all works and annotations for client-side filtering.

## Consequences

- This is the first query-param-driven search/filter endpoint for volumes or works in the codebase. The only existing precedent, `GET /persons/search`, does Python-side fuzzy matching, not SQL `WHERE` clauses — a different technique for a different problem (name variants vs. structured fields). Future volume/work filters should extend this endpoint rather than reviving the bulk-fetch-and-filter pattern.
- Undated works/annotations are excluded from results when a year range is active — they can't be verified as in-range, so they're dropped rather than shown as possible matches.
- Does not change how VolumesScreen, PersonsScreen, or التتبع's existing بحث عن عالم / بحث عن ولاية modes filter — those remain client-side. This ADR governs only the new بحث عن مجلد path.
