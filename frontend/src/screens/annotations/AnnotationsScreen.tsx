import { useEffect, useState } from "react";
import { volumesApi, annotationsApi, relationshipsApi } from "../../api";
import type { Volume, Annotation, Work } from "../../api/types";
import { worksApi } from "../../api";
import { VocabSelect } from "../../components/VocabSelect";
import { PersonField } from "../../components/PersonField";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

export function AnnotationsScreen() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<Volume | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  // Form state
  const [workId, setWorkId] = useState("");
  const [annotationType, setAnnotationType] = useState("");
  const [textAsWritten, setTextAsWritten] = useState("");
  const [dateAsWritten, setDateAsWritten] = useState("");
  const [datePrecision, setDatePrecision] = useState("");
  const [imageLocation, setImageLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [mentionedPersons, setMentionedPersons] = useState<SelectedPerson[]>([]);
  const [mentionConfidence] = useState("مؤكد");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    volumesApi.list().then(setVolumes);
  }, []);

  async function selectVolume(v: Volume) {
    setSelectedVolume(v);
    const [w, a] = await Promise.all([
      worksApi.listForVolume(v.id),
      annotationsApi.listForVolume(v.id),
    ]);
    setWorks(w);
    setAnnotations(a);
  }

  function startNewAnnotation() {
    setEditingAnnotation(null);
    setWorkId("");
    setAnnotationType("");
    setTextAsWritten("");
    setDateAsWritten("");
    setDatePrecision("");
    setImageLocation("");
    setNotes("");
    setMentionedPersons([]);
    setError("");
    setShowForm(true);
  }

  function startEditAnnotation(a: Annotation) {
    setEditingAnnotation(a);
    setWorkId(a.work_id?.toString() ?? "");
    setAnnotationType(a.annotation_type);
    setTextAsWritten(a.text_as_written ?? "");
    setDateAsWritten(a.date_as_written ?? "");
    setDatePrecision(a.date_precision ?? "");
    setImageLocation(a.image_location ?? "");
    setNotes(a.notes ?? "");
    setMentionedPersons([]);
    setError("");
    setShowForm(true);
  }

  async function submitAnnotation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVolume) return;
    setError("");
    setSaving(true);
    try {
      let saved: Annotation;
      const body = {
        volume_id: selectedVolume.id,
        annotation_type: annotationType,
        work_id: workId ? parseInt(workId) : undefined,
        text_as_written: textAsWritten || undefined,
        date_as_written: dateAsWritten || undefined,
        date_precision: datePrecision || undefined,
        image_location: imageLocation || undefined,
        notes: notes || undefined,
      };

      if (editingAnnotation) {
        saved = await annotationsApi.update(editingAnnotation.id, body);
      } else {
        saved = await annotationsApi.create(body);
      }

      // Attach mentioned persons — role = مذكور, evidence = this annotation
      for (const person of mentionedPersons) {
        await relationshipsApi.create({
          person_id: person.person_id,
          level: "volume",
          volume_id: selectedVolume.id,
          work_id: null,
          role: "مذكور",
          confidence: mentionConfidence,
          evidence_source: null,
          evidence_annotation_id: saved.id,
          notes: null,
        });
      }

      setAnnotations(await annotationsApi.listForVolume(selectedVolume.id));
      setShowForm(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnnotation(a: Annotation) {
    if (!confirm("حذف هذا التقييد؟")) return;
    await annotationsApi.delete(a.id);
    if (selectedVolume) setAnnotations(await annotationsApi.listForVolume(selectedVolume.id));
  }

  function addMentioned(person: SelectedPerson | null) {
    if (person && !mentionedPersons.find((p) => p.person_id === person.person_id)) {
      setMentionedPersons([...mentionedPersons, person]);
    }
  }

  const workTitle = (id: number | null) =>
    id ? works.find((w) => w.id === id)?.title ?? "—" : "—";

  function formatDateRange(a: Annotation) {
    if (!a.date_earliest && !a.date_latest) return null;
    const fmt = (n: number) => {
      const s = String(n).padStart(8, "0");
      return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6)}`;
    };
    if (a.date_earliest === a.date_latest) return fmt(a.date_earliest!);
    return `${fmt(a.date_earliest!)} – ${fmt(a.date_latest!)} هـ`;
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Volume selector */}
      <div style={{ width: 280, borderLeft: "1px solid var(--color-border)", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: "var(--space-4)", borderBottom: "var(--border)" }}>
          <h2 style={{ fontSize: 16 }}>اختر مجلداً</h2>
        </div>
        <ul style={{ listStyle: "none" }}>
          {volumes.map((v) => (
            <li key={v.id} onClick={() => selectVolume(v)}
              style={{
                padding: "var(--space-3) var(--space-4)", cursor: "pointer",
                borderBottom: "1px solid var(--color-border)",
                background: selectedVolume?.id === v.id ? "var(--color-selected-bg)" : undefined,
              }}>
              <span className="serial-badge">{v.serial}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Annotations */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        {!selectedVolume && <p className="empty-state">اختر مجلداً لعرض تقييداته</p>}

        {selectedVolume && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <h2>تقييدات <span className="serial-badge">{selectedVolume.serial}</span></h2>
              <button className="btn btn-primary" onClick={startNewAnnotation}>+ تقييد جديد</button>
            </div>

            {/* Annotation form */}
            {showForm && (
              <div style={{ marginBottom: "var(--space-5)", padding: "var(--space-5)", border: "var(--border)", borderRadius: "var(--radius)", background: "var(--color-surface)" }}>
                <form onSubmit={submitAnnotation}>
                  <h3 style={{ marginBottom: "var(--space-4)", fontSize: 15 }}>
                    {editingAnnotation ? "تعديل التقييد" : "تقييد جديد"}
                  </h3>
                  {error && <p style={{ color: "var(--color-error)", marginBottom: "var(--space-3)", fontSize: 14 }}>{error}</p>}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                    <div className="field">
                      <label>نوع التقييد <span style={{ color: "var(--color-error)" }}>*</span></label>
                      <VocabSelect category="annotation_type" value={annotationType} onChange={setAnnotationType}
                        placeholder="اختر النوع…" required />
                    </div>

                    <div className="field">
                      <label>الأثر (اختياري)</label>
                      <select className="select" value={workId} onChange={(e) => setWorkId(e.target.value)}>
                        <option value="">بدون أثر محدد</option>
                        {works.map((w) => (
                          <option key={w.id} value={w.id}>{w.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <label>النص كما هو مكتوب (الشاهد)</label>
                      <textarea className="textarea" value={textAsWritten} onChange={(e) => setTextAsWritten(e.target.value)}
                        style={{ minHeight: 100 }} />
                    </div>

                    <div className="field">
                      <label>التاريخ كما هو مكتوب</label>
                      <input className="input" type="text" value={dateAsWritten} onChange={(e) => setDateAsWritten(e.target.value)}
                        placeholder="مثال: رمضان 1200" />
                    </div>

                    <div className="field">
                      <label>دقة التاريخ</label>
                      <VocabSelect category="date_precision" value={datePrecision} onChange={setDatePrecision}
                        placeholder="اختر الدقة…" />
                    </div>

                    <div className="field">
                      <label>موضع اللوحة</label>
                      <input className="input" type="text" value={imageLocation} onChange={(e) => setImageLocation(e.target.value)}
                        placeholder="مثال: 15ي" />
                    </div>
                  </div>

                  {/* مذكور persons — attached within annotation form (spec §7.4) */}
                  {!editingAnnotation && (
                    <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-bg)", borderRadius: "var(--radius)", border: "var(--border)" }}>
                      <div style={{ marginBottom: "var(--space-3)", fontWeight: 600, fontSize: 14 }}>أشخاص مذكورون في هذا التقييد</div>
                      <PersonField label="إضافة شخص مذكور" value={null} onChange={addMentioned} />
                      {mentionedPersons.length > 0 && (
                        <ul style={{ listStyle: "none", marginTop: "var(--space-3)" }}>
                          {mentionedPersons.map((p) => (
                            <li key={p.person_id} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-1) 0", fontSize: 14 }}>
                              <span>{p.preferred_name}</span>
                              <button type="button" className="btn btn-danger" style={{ fontSize: 11, padding: "2px 8px" }}
                                onClick={() => setMentionedPersons(mentionedPersons.filter((mp) => mp.person_id !== p.person_id))}>
                                إزالة
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="field" style={{ marginBottom: "var(--space-4)" }}>
                    <label>ملاحظات</label>
                    <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "جارٍ الحفظ…" : "حفظ"}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>إلغاء</button>
                  </div>
                </form>
              </div>
            )}

            {/* Annotations table */}
            {annotations.length === 0 && !showForm ? (
              <p style={{ color: "var(--color-info)", fontSize: 14 }}>لا توجد تقييدات مسجلة لهذا المجلد.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>الأثر</th>
                    <th>التاريخ</th>
                    <th>اللوحة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {annotations.map((a) => (
                    <tr key={a.id}>
                      <td>{a.annotation_type}</td>
                      <td style={{ fontSize: 13 }}>{workTitle(a.work_id)}</td>
                      <td style={{ fontSize: 13 }}>
                        {a.date_as_written ?? "—"}
                        {formatDateRange(a) && (
                          <div style={{ fontSize: 11, color: "var(--color-info)" }}>
                            يُفسَّر كـ: {formatDateRange(a)}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{a.image_location ?? "—"}</td>
                      <td>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 8px", marginInlineEnd: 6 }}
                          onClick={() => startEditAnnotation(a)}>تعديل</button>
                        <button className="btn btn-danger" style={{ fontSize: 11, padding: "2px 8px" }}
                          onClick={() => deleteAnnotation(a)}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
