import { useEffect, useState } from "react";
import { annotationsApi, relationshipsApi } from "../api";
import type { Annotation, Person, Work } from "../api/types";
import { VocabSelectOrOther, VocabSelect } from "./VocabSelect";
import { PersonField } from "./PersonField";
import { PersonFormModal } from "./PersonFormModal";
import { FolioInput } from "./FolioInput";
import { ErrorModal } from "./ErrorModal";

// مؤلف/ناسخ/منسوخ له are assigned only via WorkForm's dedicated slots — never
// through a قيد (see CONTEXT.md's قيد entry).
const WORK_LEVEL_ROLES = ["مؤلف", "ناسخ", "منسوخ له"];

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

interface PendingPerson {
  person: SelectedPerson;
  role: string;
}

interface ExistingPerson {
  relationshipId: number;
  personId: number;
  name: string;
  role: string;
}

interface Props {
  volumeId: number;
  works: Work[];
  personMap: Map<number, string>;
  annotation: Annotation | null;
  folioCount?: number | null;
  onSaved: () => void;
  onCancel: () => void;
}

function LinkedPersonRow({ name, role, onRemove }: { name: string; role: string; onRemove: () => void }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        padding: "var(--space-2) 0",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
        <span
          style={{
            fontSize: "var(--font-size-body)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: "var(--font-size-meta)",
            color: "var(--color-text-muted)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "1px 8px",
          }}
        >
          {role}
        </span>
      </div>
      <button type="button" className="btn btn-danger btn-compact" style={{ flexShrink: 0 }} onClick={onRemove}>
        إزالة
      </button>
    </li>
  );
}

export function AnnotationFormModal({
  volumeId,
  works,
  personMap,
  annotation,
  folioCount,
  onSaved,
  onCancel,
}: Props) {
  const [workId, setWorkId] = useState(annotation?.work_id?.toString() ?? "");
  const [annotationType, setAnnotationType] = useState(annotation?.annotation_type ?? "");
  const [textAsWritten, setTextAsWritten] = useState(annotation?.text_as_written ?? "");
  const [imageLocation, setImageLocation] = useState(annotation?.image_location ?? "");
  const [notes, setNotes] = useState(annotation?.notes ?? "");

  // تاريخ القيد
  const [annotationYear, setAnnotationYear] = useState(annotation?.annotation_year?.toString() ?? "");
  const [annotationMonth, setAnnotationMonth] = useState(annotation?.annotation_month ?? "");
  const [annotationDay, setAnnotationDay] = useState(annotation?.annotation_day?.toString() ?? "");
  const [annotationWeekday, setAnnotationWeekday] = useState(annotation?.annotation_weekday ?? "");
  const [annotationTime, setAnnotationTime] = useState(annotation?.annotation_time ?? "");

  const [existingPersons, setExistingPersons] = useState<ExistingPerson[]>([]);
  const [removedRelIds, setRemovedRelIds] = useState<number[]>([]);
  const [pendingPersons, setPendingPersons] = useState<PendingPerson[]>([]);

  const [stagePerson, setStagePerson] = useState<SelectedPerson | null>(null);
  const [stageRole, setStageRole] = useState("مذكور");
  // Bumped after each successful add to remount PersonField — it keeps its own
  // internal search text, which otherwise keeps showing the just-added name
  // even though stagePerson has been cleared (looks selected, isn't).
  const [personFieldKey, setPersonFieldKey] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [personModalName, setPersonModalName] = useState<string | null>(null);

  useEffect(() => {
    if (!annotation) return;
    relationshipsApi.listForVolume(volumeId).then((rels) => {
      const linked = rels.filter((r) => r.evidence_annotation_id === annotation.id);
      setExistingPersons(
        linked.map((r) => ({
          relationshipId: r.id,
          personId: r.person_id,
          name: personMap.get(r.person_id) ?? `#${r.person_id}`,
          role: r.role,
        }))
      );
    });
  }, []);

  // True when the currently staged person+role combination is already linked
  // (either saved or pending) — used to grey out the إضافة button instead of
  // letting it silently no-op on click.
  const isStagedDuplicate = stagePerson
    ? pendingPersons.some((p) => p.person.person_id === stagePerson.person_id && p.role === stageRole) ||
      existingPersons.some((p) => p.personId === stagePerson.person_id && p.role === stageRole)
    : false;

  function addStagedPerson() {
    if (!stagePerson || isStagedDuplicate) return;
    setPendingPersons([...pendingPersons, { person: stagePerson, role: stageRole }]);
    setStagePerson(null);
    setStageRole("مذكور");
    setPersonFieldKey((k) => k + 1);
  }

  function removeExisting(relId: number) {
    setExistingPersons((prev) => prev.filter((p) => p.relationshipId !== relId));
    setRemovedRelIds((prev) => [...prev, relId]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!annotationType) {
      setError("نوع القيد مطلوب");
      return;
    }
    if (folioCount && imageLocation) {
      const m = imageLocation.match(/^(\d+)/);
      if (m && parseInt(m[1]) > folioCount) {
        setError(`رقم الورقة (${m[1]}) يتجاوز عدد الأوراق (${folioCount})`);
        return;
      }
    }

    // تاريخ القيد coherence: day requires month, month requires year
    if (annotationDay && !annotationMonth) {
      setError("لا يمكن إدخال التاريخ بدون شهر");
      return;
    }
    if (annotationMonth && !annotationYear) {
      setError("لا يمكن إدخال الشهر بدون سنة");
      return;
    }
    if (annotationYear) {
      const yr = parseInt(annotationYear);
      if (isNaN(yr) || yr < 1 || yr > 1500) {
        setError("السنة الهجرية يجب أن تكون بين 1 و 1500");
        return;
      }
    }
    if (annotationDay) {
      const d = parseInt(annotationDay);
      if (isNaN(d) || d < 1 || d > 30) {
        setError("التاريخ يجب أن يكون بين 1 و 30");
        return;
      }
    }
    // Include any person staged in the input but not yet added via the إضافة button
    const effectivePending = (() => {
      if (!stagePerson) return pendingPersons;
      const alreadyIn =
        pendingPersons.some((p) => p.person.person_id === stagePerson.person_id && p.role === stageRole) ||
        existingPersons.some((p) => p.personId === stagePerson.person_id && p.role === stageRole);
      return alreadyIn ? pendingPersons : [...pendingPersons, { person: stagePerson, role: stageRole }];
    })();

    setSaving(true);
    try {
      let saved: Annotation;
      const body = {
        volume_id: volumeId,
        annotation_type: annotationType,
        work_id: workId ? parseInt(workId) : undefined,
        text_as_written: textAsWritten || undefined,
        image_location: imageLocation || undefined,
        annotation_year: annotationYear ? parseInt(annotationYear) : undefined,
        annotation_month: annotationMonth || undefined,
        annotation_day: annotationDay ? parseInt(annotationDay) : undefined,
        annotation_weekday: annotationWeekday || undefined,
        annotation_time: annotationTime || undefined,
        notes: notes || undefined,
      };

      if (annotation) {
        saved = await annotationsApi.update(annotation.id, body);
        for (const relId of removedRelIds) {
          await relationshipsApi.delete(relId);
        }
      } else {
        saved = await annotationsApi.create(body);
      }

      for (const p of effectivePending) {
        await relationshipsApi.create({
          person_id: p.person.person_id,
          level: "volume",
          volume_id: volumeId,
          work_id: null,
          role: p.role,
          evidence_source: null,
          evidence_annotation_id: saved.id,
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

  function handlePersonCreated(person: Person) {
    setStagePerson({ person_id: person.id, preferred_name: person.preferred_name, written_form: person.preferred_name });
    setPersonModalName(null);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="نموذج القيد">
      <div className="modal-box modal-box--form modal-box--tall">
        <h2 className="modal-title">{annotation ? "تعديل القيد" : "قيد جديد"}</h2>

        <form onSubmit={submit}>
          {error && <ErrorModal message={error} onClose={() => setError("")} />}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="field">
              <label>نوع القيد <span style={{ color: "var(--color-error)" }}>*</span></label>
              <VocabSelectOrOther
                category="annotation_type"
                value={annotationType}
                onChange={setAnnotationType}
                placeholder="اختر النوع…"
                required
              />
            </div>

            <div className="field">
              <label>العنوان (اختياري)</label>
              <select className="select" value={workId} onChange={(e) => setWorkId(e.target.value)}>
                <option value="">ليس مرتبط بعنوان معين</option>
                {works.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>النص كما هو مكتوب (الشاهد)</label>
              <textarea
                className="textarea"
                value={textAsWritten}
                onChange={(e) => setTextAsWritten(e.target.value)}
                style={{ minHeight: 80 }}
              />
            </div>

            <div className="field">
              <label>موضع اللوحة</label>
              <FolioInput value={imageLocation} onChange={setImageLocation} folioCount={folioCount} />
            </div>
          </div>

          {/* تاريخ القيد */}
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
              تاريخ القيد
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
              <div className="field">
                <label>السنة (هـ)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="1500"
                  value={annotationYear}
                  onChange={(e) => setAnnotationYear(e.target.value)}
                  placeholder="مجهول"
                />
              </div>
              <div className="field">
                <label>الشهر</label>
                <VocabSelect
                  category="hijri_month"
                  value={annotationMonth}
                  onChange={setAnnotationMonth}
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
                  value={annotationDay}
                  onChange={(e) => setAnnotationDay(e.target.value)}
                  placeholder="مجهول"
                />
              </div>
              <div className="field">
                <label>اليوم</label>
                <VocabSelect
                  category="weekday"
                  value={annotationWeekday}
                  onChange={setAnnotationWeekday}
                  placeholder="مجهول"
                />
              </div>
              <div className="field">
                <label>الوقت</label>
                <input
                  className="input"
                  type="text"
                  value={annotationTime}
                  onChange={(e) => setAnnotationTime(e.target.value)}
                  placeholder="مجهول"
                />
              </div>
            </div>
          </div>

          {/* Persons */}
          <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-surface-muted)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-3)" }}>
              أشخاص مرتبطون بهذا القيد
            </div>

            {(existingPersons.length > 0 || pendingPersons.length > 0) && (
              <ul style={{ listStyle: "none", margin: 0, marginBottom: "var(--space-3)" }}>
                {existingPersons.map((p) => (
                  <LinkedPersonRow
                    key={`existing-${p.relationshipId}`}
                    name={p.name}
                    role={p.role}
                    onRemove={() => removeExisting(p.relationshipId)}
                  />
                ))}
                {pendingPersons.map((p, idx) => (
                  <LinkedPersonRow
                    key={`pending-${idx}`}
                    name={p.person.preferred_name}
                    role={p.role}
                    onRemove={() => setPendingPersons(pendingPersons.filter((_, i) => i !== idx))}
                  />
                ))}
              </ul>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "var(--space-2)", alignItems: "end" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <PersonField
                  key={personFieldKey}
                  label="الشخص"
                  value={stagePerson}
                  onChange={setStagePerson}
                  saveVariant
                  onRequestCreate={setPersonModalName}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>الدور</label>
                <VocabSelectOrOther category="role" value={stageRole} onChange={setStageRole} exclude={WORK_LEVEL_ROLES} />
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                disabled={!stagePerson || isStagedDuplicate}
                title={isStagedDuplicate ? "هذا الشخص مضاف بالفعل بهذا الدور" : undefined}
                onClick={addStagedPerson}
                style={{ marginBottom: 0 }}
              >
                إضافة
              </button>
            </div>
          </div>

          <div className="field" style={{ marginBottom: "var(--space-4)" }}>
            <label>ملاحظات</label>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
      </div>

      {personModalName !== null && (
        <PersonFormModal
          person={null}
          initialName={personModalName}
          onSaved={handlePersonCreated}
          onCancel={() => setPersonModalName(null)}
        />
      )}
    </div>
  );
}
