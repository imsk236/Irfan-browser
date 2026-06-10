import { useState } from "react";
import { personsApi } from "../../api";
import type { Person } from "../../api/types";

interface Props {
  person: Person | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function PersonForm({ person, onSaved, onCancel }: Props) {
  const [preferredName, setPreferredName] = useState(person?.preferred_name ?? "");
  const [showStructured, setShowStructured] = useState(
    !!(person?.ism || person?.nisba_1 || person?.nisba_2 || person?.laqab)
  );
  const [ism, setIsm] = useState(person?.ism ?? "");
  const [nisba1, setNisba1] = useState(person?.nisba_1 ?? "");
  const [nisba2, setNisba2] = useState(person?.nisba_2 ?? "");
  const [laqab, setLaqab] = useState(person?.laqab ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  // Nasab chain
  const [ancestors, setAncestors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // New variant
  const [newVariant, setNewVariant] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        preferred_name: preferredName,
        ism: ism || undefined,
        nisba_1: nisba1 || undefined,
        nisba_2: nisba2 || undefined,
        laqab: laqab || undefined,
        notes: notes || undefined,
      };

      let savedPerson: Person;
      if (person) {
        savedPerson = await personsApi.update(person.id, payload);
      } else {
        savedPerson = await personsApi.create(payload);
      }

      if (ancestors.length > 0) {
        await personsApi.setAncestors(savedPerson.id, ancestors);
      }

      if (newVariant.trim()) {
        await personsApi.addVariant(savedPerson.id, { written_form: newVariant.trim() });
      }

      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  function addAncestor() {
    setAncestors([...ancestors, ""]);
  }

  function updateAncestor(i: number, value: string) {
    const updated = [...ancestors];
    updated[i] = value;
    setAncestors(updated);
  }

  return (
    <form onSubmit={submit}>
      <h3 style={{ marginBottom: "var(--space-4)" }}>{person ? "تعديل السجل" : "شخص جديد"}</h3>

      {error && (
        <p style={{ color: "var(--color-error)", marginBottom: "var(--space-3)", fontSize: 14 }}>{error}</p>
      )}

      <div className="field" style={{ marginBottom: "var(--space-4)" }}>
        <label>الاسم المعتمد <span style={{ color: "var(--color-error)" }}>*</span></label>
        <input className="input" type="text" value={preferredName}
          onChange={(e) => setPreferredName(e.target.value)}
          placeholder="أدخل الاسم كما تعرفه أنت"
          required />
        <span style={{ fontSize: 12, color: "var(--color-info)" }}>
          يكفي هذا الحقل وحده — الحقول المفصّلة اختيارية ويمكن تعبئتها لاحقاً
        </span>
      </div>

      {/* Progressive disclosure for structured fields */}
      <button type="button" className="btn btn-secondary" style={{ fontSize: 12, marginBottom: "var(--space-4)" }}
        onClick={() => setShowStructured(!showStructured)}>
        {showStructured ? "إخفاء التفاصيل" : "تفاصيل إضافية (اسم، نسبة، لقب…)"}
      </button>

      {showStructured && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)", padding: "var(--space-4)", background: "var(--color-bg)", borderRadius: "var(--radius)", border: "var(--border)" }}>
          <div className="field">
            <label>الاسم (الإسم)</label>
            <input className="input" type="text" value={ism} onChange={(e) => setIsm(e.target.value)} placeholder="مثال: محمد" />
          </div>
          <div className="field">
            <label>اللقب</label>
            <input className="input" type="text" value={laqab} onChange={(e) => setLaqab(e.target.value)} />
          </div>
          <div className="field">
            <label>النسبة الأولى</label>
            <input className="input" type="text" value={nisba1} onChange={(e) => setNisba1(e.target.value)} />
          </div>
          <div className="field">
            <label>النسبة الثانية</label>
            <input className="input" type="text" value={nisba2} onChange={(e) => setNisba2(e.target.value)} />
          </div>

          {/* Nasab chain */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-2)" }}>سلسلة النسب (الأب، الجد…)</div>
            {ancestors.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <span style={{ minWidth: 60, fontSize: 13, color: "var(--color-info)" }}>
                  {i === 0 ? "الأب" : i === 1 ? "الجد" : `الأصل ${i + 1}`}
                </span>
                <input className="input" type="text" value={a} onChange={(e) => updateAncestor(i, e.target.value)} />
              </div>
            ))}
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={addAncestor}>
              + إضافة جد
            </button>
          </div>
        </div>
      )}

      {/* Quick variant entry */}
      <div className="field" style={{ marginBottom: "var(--space-4)" }}>
        <label>شكل اسم إضافي (اختياري)</label>
        <input className="input" type="text" value={newVariant}
          onChange={(e) => setNewVariant(e.target.value)}
          placeholder="اكتب الاسم كما ورد في المخطوط" />
        <span style={{ fontSize: 12, color: "var(--color-info)" }}>
          سيُحفظ كشكل موثق للاسم المرتبط بهذا الشخص
        </span>
      </div>

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
