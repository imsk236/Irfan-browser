# ADR 0003: Reinstate dates on قيود, in a different shape

**Status:** Accepted

## Context

Migration `007_annotation_drop_date_fields` removed `date_as_written`, `date_earliest`, `date_latest`, and `date_precision` from `annotations`, with the stated rationale "dates not tracked on قيود." CONTEXT.md recorded this as settled: "Date fields dropped."

The researcher now needs to track تاريخ القيد (when a قيد was inscribed) to trace scholars across time, the same way تاريخ النسخ is already tracked on عناوين.

The dropped shape and the new requirement are not the same model:

- **Old (dropped) shape**: an uncertainty/range model — `date_as_written` (witness text), `date_earliest`/`date_latest` (Integer, a year range), `date_precision` (Text). Suited to inscriptions datable only approximately.
- **`تاريخ النسخ` shape** (still in use on `works`): a fully structured Hijri calendar — السنة (INTEGER), الشهر (12 fixed months), التاريخ (INTEGER 1–30), اليوم (7 fixed weekdays), الوقت (free text) — each component independently optional, so partial precision (e.g. year known, day unknown) is expressed by leaving individual components blank rather than by a range.

## Decision

Give `annotations` the same five structured components as `works`' تاريخ النسخ (not the old range/witness model), with two deliberate omissions:

- **No مكان field.** تاريخ النسخ's مكان النسخ is a geographic wilaya. قيود have no established practice of recording where they were physically inscribed, and موضع اللوحة already answers the "where" question that matters for a قيد (physical position in the book, not geography).
- **No separate verbatim witness field.** تاريخ النسخ has a (currently UI-dead) `copy_date_as_written` column. For قيود this would duplicate النص كما هو مكتوب, which already transcribes the full inscription — including any date — verbatim.

The block is always visible on the قيد form (not a collapsible/opt-in section), with every component defaulting to blank/**مجهول**, matching تاريخ النسخ's UX exactly.

## Consequences

- New migration adds five nullable columns to `annotations` (proposed names: `annotation_year`, `annotation_month`, `annotation_day`, `annotation_weekday`, `annotation_time`) rather than restoring the dropped columns — the shapes are incompatible, so this is a fresh migration, not a downgrade of `007`.
- الشهر and اليوم reuse the existing shared `hijri_month`/`weekday` vocab, same as تاريخ النسخ. الوقت is free text (matching the concurrent change that made تاريخ النسخ's الوقت free text instead of a vocab dropdown), so no new vocab category is needed.
- A future قيد type that *does* need range/uncertainty dating (reviving the old model) would need its own field set — this ADR does not restore that capability, it replaces it with a different one for a different need.
