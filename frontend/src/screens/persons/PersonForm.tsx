import { useEffect, useState } from "react";
import { personsApi, vocabApi } from "../../api";
import type { Person } from "../../api/types";

interface Props {
  person: Person | null;
  onSaved: () => void;
  onCancel: () => void;
}

const UNKNOWN_SENTINEL = "مجهول";
const OUTSIDE_OMAN = "خارج عُمان";

function WilayaPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    vocabApi.list("wilaya").then(setOptions).catch(() => setOptions([]));
  }, []);

  const isUnknown = selected.length === 1 && selected[0] === UNKNOWN_SENTINEL;

  function toggleUnknown() {
    if (isUnknown) {
      onChange([]);
    } else {
      onChange([UNKNOWN_SENTINEL]);
    }
  }

  function toggleWilaya(w: string) {
    if (selected.includes(w)) {
      onChange(selected.filter((s) => s !== w));
    } else {
      // Selecting a real wilaya clears مجهول
      onChange([...selected.filter((s) => s !== UNKNOWN_SENTINEL), w]);
    }
  }

  const chips = selected.filter((s) => s !== UNKNOWN_SENTINEL);

  return (
    <div>
      {/* مجهول toggle */}
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: "var(--space-3)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={isUnknown}
          onChange={toggleUnknown}
          style={{ accentColor: "var(--color-primary)" }}
        />
        مجهول
      </label>

      {!isUnknown && (
        <>
          {/* Selected chips */}
          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              {chips.map((w) => (
                <span
                  key={w}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    padding: "2px 8px",
                    background: "var(--color-primary)",
                    color: "#fff",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {w}
                  <button
                    type="button"
                    onClick={() => toggleWilaya(w)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                      fontSize: 14,
                    }}
                    aria-label={`إزالة ${w}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Wilaya dropdown picker */}
          <select
            className="select"
            value=""
            onChange={(e) => {
              if (e.target.value) toggleWilaya(e.target.value);
            }}
            style={{ fontSize: 13 }}
          >
            <option value="">إضافة ولاية…</option>
            <option value={OUTSIDE_OMAN}>{OUTSIDE_OMAN}</option>
            {options
              .filter((o) => !selected.includes(o))
              .map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
          </select>
        </>
      )}
    </div>
  );
}

export function PersonForm({ person, onSaved, onCancel }: Props) {
  const [preferredName, setPreferredName] = useState(person?.preferred_name ?? "");
  const [ism, setIsm] = useState(person?.ism ?? "");
  const [kunya, setKunya] = useState(person?.kunya ?? "");
  const [laqab, setLaqab] = useState(person?.laqab ?? "");
  const [nisba1, setNisba1] = useState(person?.nisba_1 ?? "");
  const [nisba2, setNisba2] = useState(person?.nisba_2 ?? "");
  const [knownAs, setKnownAs] = useState(person?.known_as ?? "");
  const [nasab, setNasab] = useState(person?.nasab ?? "");

  const [birthDateAsWritten, setBirthDateAsWritten] = useState(person?.birth_date_as_written ?? "");
  const [deathDateAsWritten, setDeathDateAsWritten] = useState(person?.death_date_as_written ?? "");
  const [birthPlace, setBirthPlace] = useState(person?.birth_place ?? "");
  const [deathPlace, setDeathPlace] = useState(person?.death_place ?? "");
  const [wilayas, setWilayas] = useState<string[]>(person?.wilayas ?? []);

  const [notes, setNotes] = useState(person?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPreferredName(person?.preferred_name ?? "");
    setIsm(person?.ism ?? "");
    setKunya(person?.kunya ?? "");
    setLaqab(person?.laqab ?? "");
    setNisba1(person?.nisba_1 ?? "");
    setNisba2(person?.nisba_2 ?? "");
    setKnownAs(person?.known_as ?? "");
    setNasab(person?.nasab ?? "");
    setBirthDateAsWritten(person?.birth_date_as_written ?? "");
    setDeathDateAsWritten(person?.death_date_as_written ?? "");
    setBirthPlace(person?.birth_place ?? "");
    setDeathPlace(person?.death_place ?? "");
    setWilayas(person?.wilayas ?? []);
    setNotes(person?.notes ?? "");
    setError("");
  }, [person?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        preferred_name: preferredName,
        ism: ism || undefined,
        kunya: kunya || undefined,
        laqab: laqab || undefined,
        nisba_1: nisba1 || undefined,
        nisba_2: nisba2 || undefined,
        known_as: knownAs || undefined,
        nasab: nasab || undefined,
        birth_date_as_written: birthDateAsWritten || undefined,
        death_date_as_written: deathDateAsWritten || undefined,
        birth_place: birthPlace || undefined,
        death_place: deathPlace || undefined,
        notes: notes || undefined,
      };

      let saved: Person;
      if (person) {
        saved = await personsApi.update(person.id, payload);
      } else {
        saved = await personsApi.create(payload);
      }

      await personsApi.setWilayas(saved.id, wilayas);

      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="modal-title">
        {person ? "تعديل السجل" : "شخص جديد"}
      </h2>

      {error && (
        <p style={{ color: "var(--color-error)", marginBottom: "var(--space-3)", fontSize: 14 }}>
          {error}
        </p>
      )}

      {/* الاسم المعتمد */}
      <div className="field">
        <label>
          الاسم المعتمد <span style={{ color: "var(--color-error)" }}>*</span>
        </label>
        <input
          className="input"
          type="text"
          value={preferredName}
          onChange={(e) => setPreferredName(e.target.value)}
          placeholder="أدخل الاسم كما تعرفه أنت"
          required
          autoFocus
        />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          يكفي هذا الحقل وحده — الحقول المفصّلة اختيارية
        </span>
      </div>

      {/* تفاصيل الاسم */}
      <div
        style={{
          fontWeight: 600,
          fontSize: "var(--font-size-label)",
          color: "var(--color-text-muted)",
          marginTop: "var(--space-4)",
          marginBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "var(--space-2)",
        }}
      >
        تفاصيل الاسم
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <div className="field">
          <label>الاسم (إسم)</label>
          <input className="input" type="text" value={ism} onChange={(e) => setIsm(e.target.value)} placeholder="مثال: محمد" />
        </div>
        <div className="field">
          <label>الكنية</label>
          <input className="input" type="text" value={kunya} onChange={(e) => setKunya(e.target.value)} placeholder="مثال: أبو عبد الله" />
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
        <div className="field">
          <label>المعروف بـ</label>
          <input className="input" type="text" value={knownAs} onChange={(e) => setKnownAs(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>سلسلة النسب</label>
          <input
            className="input"
            type="text"
            value={nasab}
            onChange={(e) => setNasab(e.target.value)}
            placeholder="مثال: بن عبد الله بن أحمد"
          />
        </div>
      </div>

      {/* معلومات تعريفية */}
      <div
        style={{
          fontWeight: 600,
          fontSize: "var(--font-size-label)",
          color: "var(--color-text-muted)",
          marginTop: "var(--space-5)",
          marginBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "var(--space-2)",
        }}
      >
        معلومات تعريفية
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <div className="field">
          <label>تاريخ الولادة (كما كُتب)</label>
          <input
            className="input"
            type="text"
            value={birthDateAsWritten}
            onChange={(e) => setBirthDateAsWritten(e.target.value)}
            placeholder="مثال: 450 هـ"
          />
        </div>
        <div className="field">
          <label>تاريخ الوفاة (كما كُتب)</label>
          <input
            className="input"
            type="text"
            value={deathDateAsWritten}
            onChange={(e) => setDeathDateAsWritten(e.target.value)}
            placeholder="مثال: 520 هـ"
          />
        </div>
        <div className="field">
          <label>مكان الولادة</label>
          <input className="input" type="text" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
        </div>
        <div className="field">
          <label>مكان الوفاة</label>
          <input className="input" type="text" value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>المنطقة (الولايات)</label>
          <WilayaPicker selected={wilayas} onChange={setWilayas} />
        </div>
      </div>

      {/* ملاحظات */}
      <div
        style={{
          fontWeight: 600,
          fontSize: "var(--font-size-label)",
          color: "var(--color-text-muted)",
          marginTop: "var(--space-5)",
          marginBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "var(--space-2)",
        }}
      >
        ملاحظات
      </div>
      <div className="field">
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أي ملاحظات إضافية عن هذا الشخص…"
          style={{ minHeight: 80 }}
        />
      </div>

      <div className="modal-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </form>
  );
}
