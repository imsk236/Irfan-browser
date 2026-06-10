import { useState } from "react";
import { traceApi, annotationsApi } from "../../api";
import type { TraceResult, Annotation } from "../../api/types";
import { PersonField } from "../../components/PersonField";
import { ConfidenceTag } from "../../components/ConfidenceTag";
import { SidePanel } from "../../components/SidePanel";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

// Group TraceResults by role
function groupByRole(results: TraceResult[]): Record<string, TraceResult[]> {
  return results.reduce((acc, r) => {
    (acc[r.role] ??= []).push(r);
    return acc;
  }, {} as Record<string, TraceResult[]>);
}

export function TraceScreen() {
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [results, setResults] = useState<TraceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelAnnotation, setPanelAnnotation] = useState<Annotation | null>(null);

  async function handlePersonSelect(person: SelectedPerson | null) {
    setSelectedPerson(person);
    if (!person) { setResults(null); return; }
    setLoading(true);
    try {
      const data = await traceApi.trace(person.person_id);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function openEvidence(annotationId: number) {
    const annotation = await annotationsApi.get(annotationId);
    setPanelAnnotation(annotation);
  }

  const grouped = results ? groupByRole(results) : {};
  const roleOrder = ["مؤلف", "ناسخ", "مالك", "مستعير", "واقف", "مقيّد", "مذكور"];
  const roles = Object.keys(grouped).sort((a, b) => {
    const ai = roleOrder.indexOf(a);
    const bi = roleOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div style={{ padding: "var(--space-5)", maxWidth: 860, height: "100%", overflowY: "auto" }}>
      <h1 style={{ marginBottom: "var(--space-5)" }}>تتبع عالم</h1>

      <div style={{ maxWidth: 480, marginBottom: "var(--space-6)" }}>
        <PersonField
          label="ابحث عن عالم"
          value={selectedPerson}
          onChange={handlePersonSelect}
        />
      </div>

      {loading && <p style={{ color: "var(--color-info)" }}>جارٍ البحث…</p>}

      {results && !loading && results.length === 0 && (
        <p style={{ color: "var(--color-info)" }}>
          لا توجد مخطوطات مرتبطة بهذا العالم.
        </p>
      )}

      {results && !loading && results.length > 0 && (
        <>
          <p style={{ marginBottom: "var(--space-4)", fontSize: 14, color: "var(--color-info)" }}>
            {results.length} نتيجة موزعة على {roles.length} أدوار
          </p>

          {roles.map((role) => (
            <div key={role} style={{ marginBottom: "var(--space-6)" }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: "var(--space-3)", paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-border)" }}>
                {role}
                <span style={{ fontWeight: 400, fontSize: 13, color: "var(--color-info)", marginRight: "var(--space-2)" }}>
                  ({grouped[role].length})
                </span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>الرمز</th>
                    <th>الأثر</th>
                    <th>الثقة</th>
                    <th>الدليل</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[role].map((r) => (
                    <tr key={r.relationship_id}>
                      <td><span className="serial-badge">{r.serial}</span></td>
                      <td style={{ fontSize: 13 }}>{r.work_title ?? "—"}</td>
                      <td><ConfidenceTag value={r.confidence} /></td>
                      <td>
                        {r.evidence_annotation_id ? (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: "2px 10px" }}
                            onClick={() => openEvidence(r.evidence_annotation_id!)}
                          >
                            عرض التقييد
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--color-info)" }}>
                            {r.evidence_source ?? "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Export buttons */}
          <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-4)", borderTop: "var(--border)" }}>
            <span style={{ fontSize: 14, marginInlineEnd: "var(--space-4)", color: "var(--color-info)" }}>تصدير الأرشيف الكامل:</span>
            <button className="btn btn-secondary" style={{ marginInlineEnd: "var(--space-3)" }}
              onClick={async () => {
                const dir = prompt("مسار مجلد الحفظ:");
                if (!dir) return;
                const { exportApi } = await import("../../api");
                const r = await exportApi.csv(dir);
                alert(`تم التصدير: ${r.files.length} ملف`);
              }}>
              تصدير CSV
            </button>
            <button className="btn btn-secondary"
              onClick={async () => {
                const dir = prompt("مسار مجلد الحفظ:");
                if (!dir) return;
                const { exportApi } = await import("../../api");
                const r = await exportApi.json(dir);
                alert(`تم الحفظ: ${r.file}`);
              }}>
              تصدير JSON
            </button>
          </div>
        </>
      )}

      {/* Evidence side panel */}
      {panelAnnotation && (
        <SidePanel title="التقييد الدليل" onClose={() => setPanelAnnotation(null)}>
          <div style={{ fontSize: 14 }}>
            <div style={{ marginBottom: "var(--space-4)" }}>
              <span style={{ fontSize: 12, color: "var(--color-info)" }}>نوع التقييد</span>
              <p style={{ marginTop: 2 }}>{panelAnnotation.annotation_type}</p>
            </div>

            {panelAnnotation.text_as_written && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <span style={{ fontSize: 12, color: "var(--color-info)" }}>النص الأصلي (الشاهد)</span>
                <p style={{ marginTop: 4, lineHeight: 1.8, padding: "var(--space-3)", background: "var(--color-bg)", borderRadius: "var(--radius)", border: "var(--border)", maxWidth: 360 }}>
                  {panelAnnotation.text_as_written}
                </p>
              </div>
            )}

            {panelAnnotation.date_as_written && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <span style={{ fontSize: 12, color: "var(--color-info)" }}>التاريخ</span>
                <p style={{ marginTop: 2 }}>{panelAnnotation.date_as_written}</p>
              </div>
            )}

            {panelAnnotation.image_location && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <span style={{ fontSize: 12, color: "var(--color-info)" }}>اللوحة</span>
                <p style={{ marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{panelAnnotation.image_location}</p>
              </div>
            )}

            {panelAnnotation.notes && (
              <div>
                <span style={{ fontSize: 12, color: "var(--color-info)" }}>ملاحظات</span>
                <p style={{ marginTop: 2 }}>{panelAnnotation.notes}</p>
              </div>
            )}
          </div>
        </SidePanel>
      )}
    </div>
  );
}
