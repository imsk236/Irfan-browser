import { useEffect, useState } from "react";
import { volumesApi, annotationsApi, personsApi, worksApi } from "../../api";
import type { Volume, Annotation, Person, Work } from "../../api/types";
import { AnnotationFormModal } from "../../components/AnnotationFormModal";

export function AnnotationsScreen() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<Volume | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  useEffect(() => {
    volumesApi.list().then(setVolumes);
  }, []);

  async function selectVolume(v: Volume) {
    setSelectedVolume(v);
    const [w, a, ppl] = await Promise.all([
      worksApi.listForVolume(v.id),
      annotationsApi.listForVolume(v.id),
      personsApi.list(),
    ]);
    setWorks(w);
    setAnnotations(a);
    setPersons(ppl);
  }

  function startNewAnnotation() {
    setEditingAnnotation(null);
    setShowForm(true);
  }

  function startEditAnnotation(a: Annotation) {
    setEditingAnnotation(a);
    setShowForm(true);
  }

  async function handleAnnotationSaved() {
    setShowForm(false);
    setEditingAnnotation(null);
    if (selectedVolume) {
      const [a, ppl] = await Promise.all([
        annotationsApi.listForVolume(selectedVolume.id),
        personsApi.list(),
      ]);
      setAnnotations(a);
      setPersons(ppl);
    }
  }

  async function deleteAnnotation(a: Annotation) {
    if (!confirm("حذف هذا القيد؟")) return;
    await annotationsApi.delete(a.id);
    if (selectedVolume) setAnnotations(await annotationsApi.listForVolume(selectedVolume.id));
  }

  const personMap = new Map(persons.map((p) => [p.id, p.preferred_name]));

  const workTitle = (id: number | null) =>
    id ? works.find((w) => w.id === id)?.title ?? "—" : "—";

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
        {!selectedVolume && <p className="empty-state">اختر مجلداً لعرض قيوده</p>}

        {selectedVolume && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <h2>قيود <span className="serial-badge">{selectedVolume.serial}</span></h2>
              <button className="btn btn-primary" onClick={startNewAnnotation}>+ قيد جديد</button>
            </div>

            {showForm && (
              <AnnotationFormModal
                volumeId={selectedVolume.id}
                works={works}
                personMap={personMap}
                annotation={editingAnnotation}
                onSaved={handleAnnotationSaved}
                onCancel={() => {
                  setShowForm(false);
                  setEditingAnnotation(null);
                }}
              />
            )}

            {/* Annotations table */}
            {annotations.length === 0 ? (
              <p style={{ color: "var(--color-info)", fontSize: 14 }}>لا توجد قيود مسجلة لهذا المجلد.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>العنوان</th>
                    <th>اللوحة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {annotations.map((a) => (
                    <tr key={a.id}>
                      <td>{a.annotation_type}</td>
                      <td style={{ fontSize: 13 }}>{workTitle(a.work_id)}</td>
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
