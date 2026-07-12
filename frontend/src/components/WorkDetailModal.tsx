import type { Relationship, Work } from "../api/types";
import { formatHijriDate } from "../utils/dates";
import { isContributorRole } from "../utils/workRoles";

interface Props {
  work: Work;
  relationships: Relationship[];
  personMap: Map<number, string>;
  onEdit: () => void;
  onClose: () => void;
  /** Omit to render read-only (no remove buttons), e.g. in trace/search views. */
  onRemoveRelationship?: (r: Relationship) => void;
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <span style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", display: "block" }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--font-size-body)", lineHeight: "var(--line-height-body)" }}>{value}</span>
    </div>
  );
}

function PersonDetailRow({
  label,
  value,
  rel,
  onRemove,
}: {
  label: string;
  value: string;
  rel: Relationship | undefined;
  onRemove?: (r: Relationship) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-2)" }}>
      <DetailRow label={label} value={value} />
      {rel && onRemove && (
        <button
          type="button"
          className="btn btn-danger btn-compact"
          style={{ fontSize: 11, padding: "2px 6px", flexShrink: 0 }}
          onClick={() => onRemove(rel)}
        >
          إزالة
        </button>
      )}
    </div>
  );
}

export function WorkDetailModal({ work, relationships, personMap, onEdit, onClose, onRemoveRelationship }: Props) {
  const rels = relationships.filter((r) => r.work_id === work.id);
  const authorRel = rels.find((r) => r.role === "مؤلف");
  const scribeRels = rels.filter((r) => r.role === "ناسخ");
  const copiedForRel = rels.find((r) => r.role === "منسوخ له");
  const contributorRels = rels.filter((r) => isContributorRole(r.role));
  const personName = (r: Relationship | undefined) =>
    r ? (personMap.get(r.person_id) ?? `#${r.person_id}`) : "مجهول";

  const folioRange =
    work.start_unit && work.end_unit
      ? `${work.start_unit} – ${work.end_unit}`
      : (work.start_unit ?? null);

  const topic = [work.topic_category, work.topic_subcategory].filter(Boolean).join(" / ") || null;

  const copyDate = formatHijriDate({
    year: work.copy_year,
    month: work.copy_month,
    day: work.copy_day,
    weekday: work.copy_weekday,
    time: work.copy_time,
  });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="تفاصيل العنوان">
      <div className="modal-box modal-box--form modal-box--tall">
        <h2 className="modal-title">{work.title}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <DetailRow label="مصدر العنوان" value={work.title_source} />
            <DetailRow label="رقم الجزء" value={work.part_number} />
            <DetailRow label="الأوراق" value={folioRange} />
            <DetailRow label="التصنيف الموضوعي" value={topic} />
            <DetailRow label="مكان النسخ" value={work.copy_place} />
          </div>

          <DetailRow label="المطلع" value={work.incipit} />
          <DetailRow label="الخاتمة" value={work.explicit} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <PersonDetailRow label="المؤلف" value={personName(authorRel)} rel={authorRel} onRemove={onRemoveRelationship} />
            <DetailRow label="مصدر صلة المؤلف" value={authorRel?.evidence_source} />
            {scribeRels.length > 0 ? (
              scribeRels.map((r) => (
                <div key={r.id} style={{ display: "contents" }}>
                  <PersonDetailRow label="الناسخ" value={personName(r)} rel={r} onRemove={onRemoveRelationship} />
                  <DetailRow label="مصدر صلة الناسخ" value={r.evidence_source} />
                </div>
              ))
            ) : (
              <PersonDetailRow label="الناسخ" value="مجهول" rel={undefined} />
            )}
            {copiedForRel && (
              <PersonDetailRow label="منسوخ له" value={personName(copiedForRel)} rel={copiedForRel} onRemove={onRemoveRelationship} />
            )}
            {copiedForRel && <DetailRow label="مصدر صلة منسوخ له" value={copiedForRel.evidence_source} />}
          </div>

          {contributorRels.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)" }}>المساهم</span>
              {contributorRels.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-2)" }}>
                  <div>
                    <span style={{ fontSize: "var(--font-size-body)" }}>{personName(r)}</span>
                    <span style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", marginInlineStart: "var(--space-2)" }}>
                      {r.role}{r.evidence_source ? ` — ${r.evidence_source}` : ""}
                    </span>
                  </div>
                  {onRemoveRelationship && (
                    <button
                      type="button"
                      className="btn btn-danger btn-compact"
                      style={{ fontSize: 11, padding: "2px 6px", flexShrink: 0 }}
                      onClick={() => onRemoveRelationship(r)}
                    >
                      إزالة
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <DetailRow label="تاريخ النسخ" value={copyDate} />
          <DetailRow label="ملاحظات" value={work.notes} />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary btn-compact" onClick={onEdit}>
            تعديل
          </button>
          <button type="button" className="btn btn-secondary btn-compact" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
