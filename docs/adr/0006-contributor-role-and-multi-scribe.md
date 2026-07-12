# ADR 0006: المساهم as a soft multi-role category; مؤلف stays single; ناسخ becomes a list

**Status:** Accepted

## Context

WorkForm enforces exactly one مؤلف per عنوان (`link_person_to_work` rejects linking
a second different person as مؤلف on the same work). Researchers need to credit
joint authorship, translators, narrators, compilers, and other contributors, and
need to credit more than one ناسخ on works copied by multiple hands.

Two paths were considered for joint authorship:

- Relax the single-مؤلف rule to allow N authors directly.
- Keep مؤلف as the single canonical-author slot, and add المساهم as a separate,
  optional, multi-person, work-level role category (with مؤلف مشارك as one of its
  role options) for anyone credited alongside the author without displacing them.

## Decision

Keep مؤلف single — no change to `link_person_to_work`'s restriction. Add المساهم
as a new work-level, multi-person role backed by its own vocab category
(`contributor_role`: الراوي، المترجم، الجامع، المرتب، المعلق، المستدرك، المصحح،
مؤلف مشارك) plus غير ذلك free text (ADR 0002 pattern — not persisted to vocab).
Separately, remove the frontend's single-scribe UI restriction on ناسخ (the
service layer never enforced it) so multiple co-ناسخ can be credited as a list.

## Consequences

- مؤلف remains the one canonical "who wrote this" fact. المساهم/مؤلف مشارك is an
  explicit, deliberately separate escape hatch for joint credit — it does not
  reopen the single-مؤلف invariant, and a future reader should not read مؤلف مشارك
  as "this work now has two مؤلف rows."
- ناسخ and المساهم both become lists; مؤلف and منسوخ له remain single slots.
- `export_pdf.py`'s `copyist_by_work` must join multiple ناسخ names instead of
  silently keeping only the last one seen — this was a latent bug even before
  this feature, now directly reachable through normal use.
