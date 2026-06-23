import { useEffect, useState } from "react";
import { annotationsApi, relationshipsApi } from "../api";
import type { Annotation, Person, Work } from "../api/types";
import { VocabSelect } from "./VocabSelect";
import { PersonField } from "./PersonField";
import { PersonFormModal } from "./PersonFormModal";
import { FolioInput } from "./FolioInput";
import { ErrorModal } from "./ErrorModal";

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

  const [existingPersons, setExistingPersons] = useState<ExistingPerson[]>([]);
  const [removedRelIds, setRemovedRelIds] = useState<number[]>([]);
  const [pendingPersons, setPendingPersons] = useState<PendingPerson[]>([]);

  const [stagePerson, setStagePerson] = useState<SelectedPerson | null>(null);
  const [stageRole, setStageRole] = useState("مذكور");

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

  function addStagedPerson() {
    if (!stagePerson) return;
    const alreadyPending = pendingPersons.some((p) => p.person.person_id === stagePerson.person_id);
    const alreadyExisting = existingPersons.some((p) => p.personId === stagePerson.person_id);
    if (alreadyPending || alreadyExisting) return;
    setPendingPersons([...pendingPersons, { person: stagePerson, role: stageRole }]);
    setStagePerson(null);
    setStageRole("مذكور");
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
    // Include any person staged in the input but not yet added via the إضافة button
    const effectivePending = (() => {
      if (!stagePerson) return pendingPersons;
      const alreadyIn =
        pendingPersons.some((p) => p.person.person_id === stagePerson.person_id) ||
        existingPersons.some((p) => p.personId === stagePerson.person_id);
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
              <VocabSelect
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

          {/* Persons */}
          <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-surface-muted)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-3)" }}>
              أشخاص مرتبطون بهذا القيد
            </div>

            {existingPersons.length > 0 && (
              <ul style={{ listStyle: "none", marginBottom: "var(--space-3)" }}>
                {existingPersons.map((p) => (
                  <li key={p.relationshipId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-1) 0", fontSize: 14, borderBottom: "1px solid var(--color-border)" }}>
                    <span>
                      {p.name}
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 8 }}>{p.role}</span>
                    </span>
                    <button type="button" className="btn btn-danger btn-compact" onClick={() => removeExisting(p.relationshipId)}>
                      إزالة
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {pendingPersons.length > 0 && (
              <ul style={{ listStyle: "none", marginBottom: "var(--space-3)" }}>
                {pendingPersons.map((p, idx) => (
                  <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-1) 0", fontSize: 14, borderBottom: "1px solid var(--color-border)" }}>
                    <span>
                      {p.person.preferred_name}
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 8 }}>{p.role}</span>
                    </span>
                    <button type="button" className="btn btn-danger btn-compact" onClick={() => setPendingPersons(pendingPersons.filter((_, i) => i !== idx))}>
                      إزالة
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "var(--space-2)", alignItems: "end" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <PersonField
                  label="الشخص"
                  value={stagePerson}
                  onChange={setStagePerson}
                  saveVariant
                  onRequestCreate={setPersonModalName}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>الدور</label>
                <VocabSelect category="role" value={stageRole} onChange={setStageRole} />
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                disabled={!stagePerson}
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
