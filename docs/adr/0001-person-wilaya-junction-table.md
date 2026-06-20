# ADR 0001: person_wilayas junction table for region storage

**Status:** Implemented (migration `008_person_wilayas_nasab`)

## Context

A شخص record needs to store zero, one, or several Omani wilayas representing where the scholar was active or associated with. The existing `region_or_country` column is a single TEXT field.

Two options were considered:

- **JSON array in a column** — store `["صلالة", "مسقط"]` in a renamed column on `persons`. One migration, no new table.
- **Junction table** — `person_wilayas(person_id, wilaya)`, one row per wilaya.

## Decision

Use a junction table: `person_wilayas(person_id INTEGER FK → persons.id, wilaya TEXT)`.

The special string `"مجهول"` is stored as a sentinel row when the region is unknown. The option `"خارج عُمان"` is a regular pickable value. Mutually exclusive: if `"مجهول"` is present, no other rows exist for that person; selecting a real wilaya removes the `"مجهول"` sentinel.

## Rationale

The trace screen queries person appearances across volumes. Future filtering ("all scholars from صلالة") requires a real join. JSON parsing in SQLite is fragile and non-indexable.

## Consequences

- Migration needed to create the table and drop the old `region_or_country` column.
- New API endpoints: `GET /persons/{id}/wilayas` and `PUT /persons/{id}/wilayas`.
