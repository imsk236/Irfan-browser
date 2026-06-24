import { useEffect, useState } from "react";
import { volumesApi, worksApi, annotationsApi, relationshipsApi, personsApi } from "../../api";
import type { Annotation, Person, Relationship, Repository, Volume, Work } from "../../api/types";
import { AnnotationFormModal } from "../../components/AnnotationFormModal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { WorkFormModal } from "../../components/WorkFormModal";
import { VolumeForm } from "./VolumeForm";

interface ConfirmState {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function VolumesScreen() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Volume | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [works, setWorks] = useState<Work[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  // Volume form
  const [volumeFormMode, setVolumeFormMode] = useState<"none" | "new" | "edit">("none");

  // Work form
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);

  // Annotation form
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  // Confirm modal
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const personMap = new Map(persons.map((p) => [p.id, p.preferred_name]));

  const filteredVolumes = volumes.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      v.serial.toLowerCase().includes(q) ||
      (v.repository_volume_number != null && String(v.repository_volume_number).includes(q))
    );
  });

  useEffect(() => {
    Promise.all([
      volumesApi.list(),
      volumesApi.listRepositories(),
      personsApi.list(),
    ]).then(([vols, repos, ppl]) => {
      setVolumes(vols);
      setRepos(repos);
      setPersons(ppl);
    }).catch((err) => setLoadError(String(err)));
  }, []);

  async function selectVolume(v: Volume) {
    setSelected(v);
    setVolumeFormMode("none");
    setShowWorkForm(false);
    setShowAnnotationForm(false);
    const [w, a, r] = await Promise.all([
      worksApi.listForVolume(v.id),
      annotationsApi.listForVolume(v.id),
      relationshipsApi.listForVolume(v.id),
    ]);
    setWorks(w);
    setAnnotations(a);
    setRelationships(r);
  }

  async function refreshVolume() {
    if (!selected) return;
    const [vols, w, a, r] = await Promise.all([
      volumesApi.list(),
      worksApi.listForVolume(selected.id),
      annotationsApi.listForVolume(selected.id),
      relationshipsApi.listForVolume(selected.id),
    ]);
    setVolumes(vols);
    const fresh = vols.find((v) => v.id === selected.id);
    if (fresh) setSelected(fresh);
    setWorks(w);
    setAnnotations(a);
    setRelationships(r);
  }

  async function handleVolumeSaved() {
    const [vols, freshRepos] = await Promise.all([
      volumesApi.list(),
      volumesApi.listRepositories(),
    ]);
    setVolumes(vols);
    setRepos(freshRepos);
    setVolumeFormMode("none");
    if (selected) {
      const fresh = vols.find((v) => v.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }

  async function handleWorkSaved() {
    setShowWorkForm(false);
    setEditingWork(null);
    if (selected) {
      const [w, r] = await Promise.all([
        worksApi.listForVolume(selected.id),
        relationshipsApi.listForVolume(selected.id),
      ]);
      setWorks(w);
      setRelationships(r);
      const updatedPersons = await personsApi.list();
      setPersons(updatedPersons);
    }
  }

  function askConfirm(title: string, message: string, onConfirm: () => void, danger = false) {
    setConfirmState({ title, message, danger, onConfirm });
  }

  function dismissConfirm() {
    setConfirmState(null);
  }

  async function deleteWork(work: Work) {
    askConfirm(
      "حذف العنوان",
      `هل تريد حذف «${work.title}»؟ سيؤدي ذلك إلى حذف العلاقات المرتبطة به.`,
      async () => {
        dismissConfirm();
        await worksApi.delete(work.id);
        await refreshVolume();
      },
      true
    );
  }

  async function deleteAnnotation(a: Annotation) {
    askConfirm(
      "حذف القيد",
      "هل تريد حذف هذا القيد؟",
      async () => {
        dismissConfirm();
        await annotationsApi.delete(a.id);
        if (selected) {
          const [ann, rels] = await Promise.all([
            annotationsApi.listForVolume(selected.id),
            relationshipsApi.listForVolume(selected.id),
          ]);
          setAnnotations(ann);
          setRelationships(rels);
        }
      },
      true
    );
  }

  async function deleteVolume() {
    if (!selected) return;
    askConfirm(
      "حذف المجلد",
      `هل تريد حذف المجلد «${selected.serial}»؟`,
      async () => {
        dismissConfirm();
        await volumesApi.delete(selected.id);
        setSelected(null);
        setWorks([]);
        setAnnotations([]);
        setRelationships([]);
        setVolumes(await volumesApi.list());
      },
      true
    );
  }

  async function deleteRelationship(r: Relationship) {
    askConfirm(
      "إزالة الشخص",
      "هل تريد إزالة هذا الارتباط؟",
      async () => {
        dismissConfirm();
        await relationshipsApi.delete(r.id);
        if (selected) setRelationships(await relationshipsApi.listForVolume(selected.id));
      },
      true
    );
  }

  function startNewAnnotation() {
    setEditingAnnotation(null);
    setShowAnnotationForm(true);
  }

  function startEditAnnotation(a: Annotation) {
    setEditingAnnotation(a);
    setShowAnnotationForm(true);
  }

  async function handleAnnotationSaved() {
    setShowAnnotationForm(false);
    setEditingAnnotation(null);
    if (selected) {
      const [a, r, updatedPersons] = await Promise.all([
        annotationsApi.listForVolume(selected.id),
        relationshipsApi.listForVolume(selected.id),
        personsApi.list(),
      ]);
      setAnnotations(a);
      setRelationships(r);
      setPersons(updatedPersons);
    }
  }

  const repoName = (id: number) => repos.find((r) => r.id === id)?.name ?? "—";

  // Volume-level relationships (not linked to specific work)
  const volumeRelationships = relationships.filter((r) => r.level === "volume");
  // Work-level relationships
  const workRelationships = relationships.filter((r) => r.level === "work");

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Volume list */}
      <div
        style={{
          width: 280,
          borderLeft: "1px solid var(--color-border)",
          overflowY: "auto",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 16 }}>المجلدات</h2>
          <button
            className="btn btn-primary btn-compact"
            onClick={() => {
              setSelected(null);
              setVolumeFormMode("new");
            }}
          >
            + مجلد جديد
          </button>
        </div>
        <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <input
            className="input"
            type="text"
            placeholder="بحث بالرمز أو الرقم…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filteredVolumes.length === 0 ? (
            <p className="empty-state">{search.trim() ? "لا توجد نتائج" : "لا توجد مجلدات بعد."}</p>
          ) : (
            <ul style={{ listStyle: "none" }}>
              {filteredVolumes.map((v) => (
                <li
                  key={v.id}
                  onClick={() => selectVolume(v)}
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--color-border)",
                    background: selected?.id === v.id ? "var(--color-selected-bg)" : undefined,
                    borderRight:
                      selected?.id === v.id ? "3px solid var(--color-selected-marker)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="serial-badge">{v.serial}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                    {repoName(v.repository_id)}
                    {v.repository_volume_number != null && (
                      <div>رقم المجلد: {v.repository_volume_number}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Volume detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        {/* New volume form */}
        {volumeFormMode === "new" && (
          <VolumeForm
            repos={repos}
            volume={null}
            onSaved={async () => {
              const [vols, freshRepos] = await Promise.all([
                volumesApi.list(),
                volumesApi.listRepositories(),
              ]);
              setVolumes(vols);
              setRepos(freshRepos);
              setVolumeFormMode("none");
            }}
            onCancel={() => setVolumeFormMode("none")}
          />
        )}

        {/* Edit volume form */}
        {volumeFormMode === "edit" && selected && (
          <VolumeForm
            repos={repos}
            volume={selected}
            onSaved={handleVolumeSaved}
            onCancel={() => setVolumeFormMode("none")}
          />
        )}

        {/* Volume detail view */}
        {selected && volumeFormMode === "none" && (
          <>
            {/* ── بيانات المجلد ─────────────────────────── */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "var(--space-3)",
                }}
              >
                <div>
                  <span className="serial-badge" style={{ fontSize: 18 }}>
                    {selected.serial}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={() => setVolumeFormMode("edit")}
                  >
                    تعديل
                  </button>
                  <button
                    className="btn btn-danger btn-compact"
                    onClick={() => deleteVolume()}
                  >
                    حذف
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>
                الخزانة: {repoName(selected.repository_id)}
                {selected.folio_count && ` · ${selected.folio_count} ورقة`}
                {selected.repository_volume_number != null && (
                  <div>رقم المجلد: {selected.repository_volume_number}</div>
                )}
              </div>
              {selected.notes && (
                <p style={{ fontSize: 14, maxWidth: 640, lineHeight: 1.7 }}>{selected.notes}</p>
              )}
            </div>

            {/* ── العناوين (Works) ───────────────────────── */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-3)",
                }}
              >
                <span className="section-heading" style={{ marginBottom: 0 }}>العناوين</span>
                <button
                  className="btn btn-secondary btn-compact"
                  onClick={() => {
                    setEditingWork(null);
                    setShowWorkForm(true);
                  }}
                >
                  + إضافة عنوان
                </button>
              </div>

              {showWorkForm && (
                <WorkFormModal
                  volumeId={selected.id}
                  work={editingWork}
                  relationships={workRelationships}
                  personMap={personMap}
                  folioCount={selected.folio_count}
                  onSaved={handleWorkSaved}
                  onCancel={() => {
                    setShowWorkForm(false);
                    setEditingWork(null);
                  }}
                />
              )}

              {works.length === 0 && !showWorkForm ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                  لا توجد عناوين مسجلة لهذا المجلد.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>العنوان</th>
                      <th>الأوراق</th>
                      <th>المؤلف</th>
                      <th>الناسخ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {works.map((w) => {
                      const authorRel = workRelationships.find(
                        (r) => r.work_id === w.id && r.role === "مؤلف"
                      );
                      const scribeRel = workRelationships.find(
                        (r) => r.work_id === w.id && r.role === "ناسخ"
                      );
                      const authorName = authorRel
                        ? (personMap.get(authorRel.person_id) ?? `#${authorRel.person_id}`)
                        : "مجهول";
                      const scribeName = scribeRel
                        ? (personMap.get(scribeRel.person_id) ?? `#${scribeRel.person_id}`)
                        : "مجهول";
                      return (
                        <tr key={w.id}>
                          <td>{w.title}</td>
                          <td>
                            {w.start_unit && w.end_unit
                              ? `${w.start_unit} – ${w.end_unit}`
                              : (w.start_unit ?? "—")}
                          </td>
                          <td style={{ fontSize: 13 }}>{authorName}</td>
                          <td style={{ fontSize: 13 }}>{scribeName}</td>
                          <td>
                            <button
                              className="btn btn-secondary btn-compact"
                              style={{ marginInlineEnd: 6 }}
                              onClick={() => {
                                setEditingWork(w);
                                setShowWorkForm(true);
                              }}
                            >
                              تعديل
                            </button>
                            <button
                              className="btn btn-danger btn-compact"
                              onClick={() => deleteWork(w)}
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── القيود (Annotations) ───────────────────── */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-3)",
                }}
              >
                <span className="section-heading" style={{ marginBottom: 0 }}>القيود</span>
                <button
                  className="btn btn-secondary btn-compact"
                  onClick={startNewAnnotation}
                >
                  + إضافة قيد
                </button>
              </div>

              {showAnnotationForm && selected && (
                <AnnotationFormModal
                  volumeId={selected.id}
                  works={works}
                  personMap={personMap}
                  annotation={editingAnnotation}
                  folioCount={selected.folio_count}
                  onSaved={handleAnnotationSaved}
                  onCancel={() => {
                    setShowAnnotationForm(false);
                    setEditingAnnotation(null);
                  }}
                />
              )}

              {annotations.length === 0 && !showAnnotationForm ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                  لا توجد قيود مسجلة لهذا المجلد.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>النوع</th>
                      <th>العنوان</th>
                      <th>الأشخاص</th>
                      <th>اللوحة</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {annotations.map((a) => {
                      const linkedRels = volumeRelationships.filter(
                        (r) => r.evidence_annotation_id === a.id
                      );
                      return (
                        <tr key={a.id}>
                          <td>{a.annotation_type}</td>
                          <td style={{ fontSize: 13 }}>
                            {a.work_id ? (works.find((w) => w.id === a.work_id)?.title ?? "—") : "—"}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {linkedRels.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {linkedRels.map((r) => (
                                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span>{personMap.get(r.person_id) ?? `#${r.person_id}`}</span>
                                    <span style={{ color: "var(--color-text-muted)" }}>({r.role})</span>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-compact"
                                      style={{ fontSize: 10, padding: "1px 4px" }}
                                      onClick={() => deleteRelationship(r)}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : "—"}
                          </td>
                          <td style={{ fontSize: 13 }}>{a.image_location ?? "—"}</td>
                          <td>
                            <button
                              className="btn btn-secondary btn-compact"
                              style={{ marginInlineEnd: 6 }}
                              onClick={() => startEditAnnotation(a)}
                            >
                              تعديل
                            </button>
                            <button
                              className="btn btn-danger btn-compact"
                              onClick={() => deleteAnnotation(a)}
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {loadError && (
          <p style={{ color: "var(--color-error)", padding: "var(--space-4)", fontSize: 14 }}>
            تعذّر الاتصال بقاعدة البيانات: {loadError}
          </p>
        )}
        {!loadError && !selected && volumeFormMode === "none" && (
          <p className="empty-state">اختر مجلداً من القائمة أو أضف مجلداً جديداً</p>
        )}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={dismissConfirm}
        />
      )}
    </div>
  );
}
