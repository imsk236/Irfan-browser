import { useState } from "react";
import { worksApi, relationshipsApi } from "../../api";
import { VocabSelect } from "../../components/VocabSelect";
import { PersonField } from "../../components/PersonField";
import type { Work } from "../../api/types";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

interface Props {
  volumeId: number;
  work: Work | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function WorkForm({ volumeId, work, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(work?.title ?? "");
  const [workType, setWorkType] = useState(work?.work_type ?? "");
  const [startUnit, setStartUnit] = useState(work?.start_unit ?? "");
  const [endUnit, setEndUnit] = useState(work?.end_unit ?? "");
  const [notes, setNotes] = useState(work?.notes ?? "");
  const [author, setAuthor] = useState<SelectedPerson | null>(null);
  const [confidence, setConfidence] = useState("مؤكد");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      let savedWork: Work;
      if (work) {
        savedWork = await worksApi.update(work.id, { title, work_type: workType || undefined, start_unit: startUnit || undefined, end_unit: endUnit || undefined, notes: notes || undefined });
      } else {
        savedWork = await worksApi.create({ volume_id: volumeId, title, work_type: workType || undefined, start_unit: startUnit || undefined, end_unit: endUnit || undefined, notes: notes || undefined });
      }

      // Role-first author linking — role is set silently from context
      if (author && !work) {
        await relationshipsApi.create({
          person_id: author.person_id,
          level: "work",
          work_id: savedWork.id,
          volume_id: null,
          role: "مؤلف",
          confidence,
          evidence_source: null,
          evidence_annotation_id: null,
          notes: null,
        });
      }

      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h4 style={{ marginBottom: "var(--space-4)", fontSize: 15 }}>{work ? "تعديل الأثر" : "أثر جديد"}</h4>

      {error && (
        <p style={{ color: "var(--color-error)", marginBottom: "var(--space-3)", fontSize: 14 }}>{error}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>عنوان الأثر <span style={{ color: "var(--color-error)" }}>*</span></label>
          <input className="input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="field">
          <label>نوع الأثر</label>
          <VocabSelect category="work_type" value={workType} onChange={setWorkType} placeholder="اختر النوع…" />
        </div>

        <div className="field">
          <label>الورقة الأولى</label>
          <input className="input" type="text" value={startUnit} onChange={(e) => setStartUnit(e.target.value)} placeholder="مثال: 1ي" />
        </div>

        <div className="field">
          <label>الورقة الأخيرة</label>
          <input className="input" type="text" value={endUnit} onChange={(e) => setEndUnit(e.target.value)} placeholder="مثال: 24س" />
        </div>
      </div>

      {/* Role-first author field — only shown for new works */}
      {!work && (
        <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-bg)", borderRadius: "var(--radius)", border: "var(--border)" }}>
          <PersonField label="من المؤلف؟" value={author} onChange={setAuthor} saveVariant />
          {author && (
            <div className="field" style={{ marginTop: "var(--space-3)" }}>
              <label>درجة الثقة</label>
              <VocabSelect category="confidence" value={confidence} onChange={setConfidence} />
            </div>
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
        <button type="button" className="btn btn-secondary" onClick={onCancel}>إلغاء</button>
      </div>
    </form>
  );
}
