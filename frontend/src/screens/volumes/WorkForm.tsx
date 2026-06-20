import { useState } from "react";
import { worksApi, relationshipsApi } from "../../api";
import { VocabSelect } from "../../components/VocabSelect";
import { PersonField } from "../../components/PersonField";
import type { Relationship, Work } from "../../api/types";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

interface Props {
  volumeId: number;
  work: Work | null;
  relationships?: Relationship[];
  personMap?: Map<number, string>;
  onSaved: () => void;
  onCancel: () => void;
}

export function WorkForm({ volumeId, work, relationships, personMap, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(work?.title ?? "");
  const [startUnit, setStartUnit] = useState(work?.start_unit ?? "");
  const [endUnit, setEndUnit] = useState(work?.end_unit ?? "");
  const [notes, setNotes] = useState(work?.notes ?? "");

  // Copy date fields
  const [copyDateAsWritten, setCopyDateAsWritten] = useState(work?.copy_date_as_written ?? "");
  const [copyYear, setCopyYear] = useState(work?.copy_year?.toString() ?? "");
  const [copyMonth, setCopyMonth] = useState(work?.copy_month ?? "");
  const [copyDay, setCopyDay] = useState(work?.copy_day?.toString() ?? "");
  const [copyWeekday, setCopyWeekday] = useState(work?.copy_weekday ?? "");
  const [copyTime, setCopyTime] = useState(work?.copy_time ?? "");

  // Author (مؤلف)
  const existingAuthorRel = work && relationships
    ? relationships.find((r) => r.work_id === work.id && r.role === "مؤلف") ?? null
    : null;
  const [replaceAuthor, setReplaceAuthor] = useState(false);
  const [author, setAuthor] = useState<SelectedPerson | null>(null);
  const [authorUnknown, setAuthorUnknown] = useState(false);
  const [authorSource, setAuthorSource] = useState("");

  // Scribe (ناسخ)
  const existingScribeRel = work && relationships
    ? relationships.find((r) => r.work_id === work.id && r.role === "ناسخ") ?? null
    : null;
  const [replaceScribe, setReplaceScribe] = useState(false);
  const [scribe, setScribe] = useState<SelectedPerson | null>(null);
  const [scribeUnknown, setScribeUnknown] = useState(false);
  const [scribeSource, setScribeSource] = useState("");

  // Copied for (منسوخ له — optional)
  const existingCopiedForRel = work && relationships
    ? relationships.find((r) => r.work_id === work.id && r.role === "منسوخ له") ?? null
    : null;
  const [replaceCopiedFor, setReplaceCopiedFor] = useState(false);
  const [copiedFor, setCopiedFor] = useState<SelectedPerson | null>(null);
  const [copiedForSource, setCopiedForSource] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate مؤلف: must pick a person OR check مجهول
    if (!work || replaceAuthor) {
      if (!author && !authorUnknown) {
        setError("المؤلف مطلوب. اختر شخصاً أو أشر إلى أنه مجهول.");
        return;
      }
    }
    // Validate ناسخ: must pick a person OR check مجهول
    if (!work || replaceScribe) {
      if (!scribe && !scribeUnknown) {
        setError("الناسخ مطلوب. اختر شخصاً أو أشر إلى أنه مجهول.");
        return;
      }
    }

    setSaving(true);
    try {
      let savedWork: Work;
      const workPayload = {
        title,
        start_unit: startUnit || undefined,
        end_unit: endUnit || undefined,
        copy_date_as_written: copyDateAsWritten || undefined,
        copy_year: copyYear ? parseInt(copyYear) : undefined,
        copy_month: copyMonth || undefined,
        copy_day: copyDay ? parseInt(copyDay) : undefined,
        copy_weekday: copyWeekday || undefined,
        copy_time: copyTime || undefined,
        notes: notes || undefined,
      };

      if (work) {
        savedWork = await worksApi.update(work.id, workPayload);
      } else {
        savedWork = await worksApi.create({ volume_id: volumeId, ...workPayload });
      }

      // Handle مؤلف
      const shouldSaveAuthor = !work || replaceAuthor;
      if (shouldSaveAuthor) {
        if (existingAuthorRel) {
          await relationshipsApi.delete(existingAuthorRel.id);
        }
        if (author && !authorUnknown) {
          await relationshipsApi.create({
            person_id: author.person_id,
            level: "work",
            work_id: savedWork.id,
            volume_id: null,
            role: "مؤلف",
            confidence: "مؤكد",
            evidence_source: authorSource || null,
            evidence_annotation_id: null,
            notes: null,
          });
        }
      }

      // Handle ناسخ
      const shouldSaveScribe = !work || replaceScribe;
      if (shouldSaveScribe) {
        if (existingScribeRel) {
          await relationshipsApi.delete(existingScribeRel.id);
        }
        if (scribe && !scribeUnknown) {
          await relationshipsApi.create({
            person_id: scribe.person_id,
            level: "work",
            work_id: savedWork.id,
            volume_id: null,
            role: "ناسخ",
            confidence: "مؤكد",
            evidence_source: scribeSource || null,
            evidence_annotation_id: null,
            notes: null,
          });
        }
      }

      // Handle منسوخ له (optional)
      const shouldSaveCopiedFor = !work || replaceCopiedFor;
      if (shouldSaveCopiedFor) {
        if (existingCopiedForRel) {
          await relationshipsApi.delete(existingCopiedForRel.id);
        }
        if (copiedFor) {
          await relationshipsApi.create({
            person_id: copiedFor.person_id,
            level: "work",
            work_id: savedWork.id,
            volume_id: null,
            role: "منسوخ له",
            confidence: "مؤكد",
            evidence_source: copiedForSource || null,
            evidence_annotation_id: null,
            notes: null,
          });
        }
      }

      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const existingAuthorName = existingAuthorRel
    ? (personMap?.get(existingAuthorRel.person_id) ?? `شخص #${existingAuthorRel.person_id}`)
    : null;
  const existingScribeName = existingScribeRel
    ? (personMap?.get(existingScribeRel.person_id) ?? `شخص #${existingScribeRel.person_id}`)
    : null;
  const existingCopiedForName = existingCopiedForRel
    ? (personMap?.get(existingCopiedForRel.person_id) ?? `شخص #${existingCopiedForRel.person_id}`)
    : null;

  function PersonRoleSection({
    roleLabel,
    required,
    existingName,
    replacing,
    onReplace,
    onCancelReplace,
    person,
    onPersonChange,
    unknown,
    onUnknownChange,
    source,
    onSourceChange,
    confidence,
    onConfidenceChange,
  }: {
    roleLabel: string;
    required: boolean;
    existingName: string | null;
    replacing: boolean;
    onReplace: () => void;
    onCancelReplace: () => void;
    person: SelectedPerson | null;
    onPersonChange: (p: SelectedPerson | null) => void;
    unknown: boolean;
    onUnknownChange: (v: boolean) => void;
    source: string;
    onSourceChange: (v: string) => void;
  }) {
    return (
      <div
        style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-surface-muted)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-2)" }}>
          {roleLabel} {required && <span style={{ color: "var(--color-error)" }}>*</span>}
        </div>

        {existingName && !replacing ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>{existingName}</span>
            <button type="button" className="btn btn-secondary btn-compact" onClick={onReplace}>
              تغيير
            </button>
          </div>
        ) : (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: "var(--space-2)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={unknown}
                onChange={(e) => {
                  onUnknownChange(e.target.checked);
                  if (e.target.checked) onPersonChange(null);
                }}
              />
              مجهول
            </label>

            {!unknown && (
              <PersonField
                label={`من ${roleLabel}؟`}
                value={person}
                onChange={onPersonChange}
                saveVariant
              />
            )}

            {!unknown && person && (
              <div className="field" style={{ marginTop: "var(--space-3)" }}>
                <label>مصدر المعرفة</label>
                <VocabSelect
                  category="knowledge_source"
                  value={source}
                  onChange={onSourceChange}
                  placeholder="كيف عرفنا؟"
                />
              </div>
            )}

            {work && replacing && (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                style={{ marginTop: "var(--space-2)" }}
                onClick={onCancelReplace}
              >
                إلغاء التغيير
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h4 style={{ marginBottom: "var(--space-4)", fontSize: 15 }}>
        {work ? "تعديل العنوان" : "عنوان جديد"}
      </h4>

      {error && (
        <p style={{ color: "var(--color-error)", marginBottom: "var(--space-3)", fontSize: 14 }}>
          {error}
        </p>
      )}

      {/* العنوان والأوراق */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>
            العنوان <span style={{ color: "var(--color-error)" }}>*</span>
          </label>
          <input
            className="input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>الورقة الأولى</label>
          <input
            className="input"
            type="text"
            value={startUnit}
            onChange={(e) => setStartUnit(e.target.value)}
            placeholder="مثال: 1ي"
          />
        </div>

        <div className="field">
          <label>الورقة الأخيرة</label>
          <input
            className="input"
            type="text"
            value={endUnit}
            onChange={(e) => setEndUnit(e.target.value)}
            placeholder="مثال: 24س"
          />
        </div>
      </div>

      {/* المؤلف */}
      <PersonRoleSection
        roleLabel="المؤلف"
        required
        existingName={existingAuthorName}
        replacing={replaceAuthor}
        onReplace={() => setReplaceAuthor(true)}
        onCancelReplace={() => { setReplaceAuthor(false); setAuthor(null); setAuthorUnknown(false); }}
        person={author}
        onPersonChange={setAuthor}
        unknown={authorUnknown}
        onUnknownChange={setAuthorUnknown}
        source={authorSource}
        onSourceChange={setAuthorSource}
      />

      {/* الناسخ */}
      <PersonRoleSection
        roleLabel="الناسخ"
        required
        existingName={existingScribeName}
        replacing={replaceScribe}
        onReplace={() => setReplaceScribe(true)}
        onCancelReplace={() => { setReplaceScribe(false); setScribe(null); setScribeUnknown(false); }}
        person={scribe}
        onPersonChange={setScribe}
        unknown={scribeUnknown}
        onUnknownChange={setScribeUnknown}
        source={scribeSource}
        onSourceChange={setScribeSource}
      />

      {/* منسوخ له (اختياري) */}
      <div
        style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-surface-muted)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-2)" }}>
          منسوخ له (اختياري)
        </div>
        {existingCopiedForName && !replaceCopiedFor ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>{existingCopiedForName}</span>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => setReplaceCopiedFor(true)}>
              تغيير
            </button>
          </div>
        ) : (
          <>
            <PersonField
              label="من نُسخ له؟"
              value={copiedFor}
              onChange={setCopiedFor}
              saveVariant
            />
            {copiedFor && (
              <div className="field" style={{ marginTop: "var(--space-3)" }}>
                <label>مصدر المعرفة</label>
                <VocabSelect
                  category="knowledge_source"
                  value={copiedForSource}
                  onChange={setCopiedForSource}
                  placeholder="كيف عرفنا؟"
                />
              </div>
            )}
            {work && replaceCopiedFor && (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                style={{ marginTop: "var(--space-2)" }}
                onClick={() => { setReplaceCopiedFor(false); setCopiedFor(null); }}
              >
                إلغاء التغيير
              </button>
            )}
          </>
        )}
      </div>

      {/* تاريخ النسخ */}
      <div
        style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-surface-muted)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-3)" }}>
          تاريخ النسخ (هجري)
        </div>
        <div className="field" style={{ marginBottom: "var(--space-3)" }}>
          <label>التاريخ كما هو مكتوب</label>
          <input
            className="input"
            type="text"
            value={copyDateAsWritten}
            onChange={(e) => setCopyDateAsWritten(e.target.value)}
            placeholder="مثال: ربيع الأول سنة 1200"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
          <div className="field">
            <label>السنة (هـ)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="1500"
              value={copyYear}
              onChange={(e) => setCopyYear(e.target.value)}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>الشهر</label>
            <VocabSelect
              category="hijri_month"
              value={copyMonth}
              onChange={setCopyMonth}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>التاريخ</label>
            <input
              className="input"
              type="number"
              min="1"
              max="30"
              value={copyDay}
              onChange={(e) => setCopyDay(e.target.value)}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>اليوم</label>
            <VocabSelect
              category="weekday"
              value={copyWeekday}
              onChange={setCopyWeekday}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>الوقت</label>
            <VocabSelect
              category="copy_time"
              value={copyTime}
              onChange={setCopyTime}
              placeholder="مجهول"
            />
          </div>
        </div>
      </div>

      <div className="field" style={{ marginBottom: "var(--space-4)" }}>
        <label>ملاحظات</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
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
