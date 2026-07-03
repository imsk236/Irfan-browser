import type { Relationship, Work } from "../api/types";
import { formatHijriDate } from "../utils/dates";

interface Props {
  work: Work;
  relationships: Relationship[];
  personMap: Map<number, string>;
  onEdit: () => void;
  onClose: () => void;
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

export function WorkDetailModal({ work, relationships, personMap, onEdit, onClose }: Props) {
  const rels = relationships.filter((r) => r.work_id === work.id);
  const authorRel = rels.find((r) => r.role === "مؤلف");
  const scribeRel = rels.find((r) => r.role === "ناسخ");
  const copiedForRel = rels.find((r) => r.role === "منسوخ له");
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
            <DetailRow label="الأوراق" value={folioRange} />
            <DetailRow label="التصنيف الموضوعي" value={topic} />
            <DetailRow label="مكان النسخ" value={work.copy_place} />
          </div>

          <DetailRow label="المطلع" value={work.incipit} />
          <DetailRow label="الخاتمة" value={work.explicit} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <DetailRow label="المؤلف" value={personName(authorRel)} />
            <DetailRow label="مصدر صلة المؤلف" value={authorRel?.evidence_source} />
            <DetailRow label="الناسخ" value={personName(scribeRel)} />
            <DetailRow label="مصدر صلة الناسخ" value={scribeRel?.evidence_source} />
            {copiedForRel && <DetailRow label="منسوخ له" value={personName(copiedForRel)} />}
            {copiedForRel && <DetailRow label="مصدر صلة منسوخ له" value={copiedForRel.evidence_source} />}
          </div>

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
