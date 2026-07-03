import type { Annotation, Relationship, Work } from "../api/types";
import { formatHijriDate } from "../utils/dates";

interface Props {
  annotation: Annotation;
  works: Work[];
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

export function AnnotationDetailModal({ annotation, works, relationships, personMap, onEdit, onClose }: Props) {
  const linkedWork = annotation.work_id ? works.find((w) => w.id === annotation.work_id) : null;
  const linkedRels = relationships.filter((r) => r.evidence_annotation_id === annotation.id);

  const annotationDate = formatHijriDate({
    year: annotation.annotation_year,
    month: annotation.annotation_month,
    day: annotation.annotation_day,
    weekday: annotation.annotation_weekday,
    time: annotation.annotation_time,
  });

  const hasDetail =
    !!linkedWork?.title ||
    !!annotation.image_location ||
    !!annotation.text_as_written ||
    !!annotationDate ||
    linkedRels.length > 0 ||
    !!annotation.notes;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="تفاصيل القيد">
      <div className="modal-box modal-box--form modal-box--tall">
        <h2 className="modal-title">{annotation.annotation_type}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          {!hasDetail && (
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-body)" }}>
              لا تفاصيل إضافية مسجلة لهذا القيد.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <DetailRow label="العنوان المرتبط" value={linkedWork?.title} />
            <DetailRow label="موضع اللوحة" value={annotation.image_location} />
          </div>

          <DetailRow label="النص كما هو مكتوب" value={annotation.text_as_written} />
          <DetailRow label="تاريخ القيد" value={annotationDate} />

          {linkedRels.length > 0 && (
            <div>
              <span style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", display: "block", marginBottom: "var(--space-1)" }}>
                الأشخاص المرتبطون
              </span>
              <ul style={{ listStyle: "none" }}>
                {linkedRels.map((r) => (
                  <li key={r.id} style={{ fontSize: "var(--font-size-body)", padding: "2px 0" }}>
                    {personMap.get(r.person_id) ?? `#${r.person_id}`}
                    <span style={{ color: "var(--color-text-muted)" }}> ({r.role})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DetailRow label="ملاحظات" value={annotation.notes} />
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
