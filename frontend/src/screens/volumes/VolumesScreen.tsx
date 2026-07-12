import { useEffect, useState } from "react";
import { volumesApi, worksApi, annotationsApi, relationshipsApi, personsApi } from "../../api";
import type { Annotation, Person, Relationship, Repository, Volume, Work } from "../../api/types";
import { AnnotationDetailModal } from "../../components/AnnotationDetailModal";
import { AnnotationFormModal } from "../../components/AnnotationFormModal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ErrorModal } from "../../components/ErrorModal";
import { WorkDetailModal } from "../../components/WorkDetailModal";
import { WorkFormModal } from "../../components/WorkFormModal";
import { isContributorRole } from "../../utils/workRoles";
import { VolumeForm } from "./VolumeForm";

const WORK_ROLE_LABELS: Record<string, string> = {
  "مؤلف": "المؤلف",
  "ناسخ": "الناسخ",
  "منسوخ له": "منسوخ له",
};

interface ConfirmState {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface Props {
  /** A volume to open automatically (e.g. arriving from بحث عن مجلد on التتبع). */
  pendingVolumeId?: number | null;
  onPendingVolumeConsumed?: () => void;
}

export function VolumesScreen({ pendingVolumeId, onPendingVolumeConsumed }: Props = {}) {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Volume | null>(null);
  const [loadError, setLoadError] = useState("");
  const [repoFilter, setRepoFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const [works, setWorks] = useState<Work[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  // Volume form
  const [volumeFormMode, setVolumeFormMode] = useState<"none" | "new" | "edit">("none");

  // Work form
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [viewingWork, setViewingWork] = useState<Work | null>(null);

  // Annotation form
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [viewingAnnotation, setViewingAnnotation] = useState<Annotation | null>(null);

  // Confirm modal
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  // Delete error
  const [deleteError, setDeleteError] = useState("");

  const personMap = new Map(persons.map((p) => [p.id, p.preferred_name]));

  const filteredVolumes = volumes.filter((v) => {
    if (repoFilter !== "all" && v.repository_id !== repoFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (v.repository_volume_number != null && String(v.repository_volume_number).includes(q)) ||
      v.serial.toLowerCase().includes(q)
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

  useEffect(() => {
    if (pendingVolumeId == null) return;
    const vol = volumes.find((v) => v.id === pendingVolumeId);
    if (vol) {
      void selectVolume(vol);
      onPendingVolumeConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVolumeId, volumes]);

  async function selectVolume(v: Volume) {
    setSelected(v);
    setVolumeFormMode("none");
    setShowWorkForm(false);
    setShowAnnotationForm(false);
    setViewingWork(null);
    setViewingAnnotation(null);
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
      `هل تريد حذف «${work.title}»؟ لن يمكن حذف العنوان إذا كان مرتبطاً بقيود أو أشخاص — أزل الروابط أولاً.`,
      async () => {
        dismissConfirm();
        try {
          await worksApi.delete(work.id);
          await refreshVolume();
        } catch (err) {
          setDeleteError(String(err));
        }
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
        try {
          await annotationsApi.delete(a.id);
          if (selected) {
            const [ann, rels] = await Promise.all([
              annotationsApi.listForVolume(selected.id),
              relationshipsApi.listForVolume(selected.id),
            ]);
            setAnnotations(ann);
            setRelationships(rels);
          }
        } catch (err) {
          setDeleteError(String(err));
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
        try {
          await volumesApi.delete(selected.id);
          setSelected(null);
          setWorks([]);
          setAnnotations([]);
          setRelationships([]);
          setVolumes(await volumesApi.list());
        } catch (err) {
          setDeleteError(String(err));
        }
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
        try {
          await relationshipsApi.delete(r.id);
          if (selected) setRelationships(await relationshipsApi.listForVolume(selected.id));
        } catch (err) {
          setDeleteError(String(err));
        }
      },
      true
    );
  }

  async function removeWorkRelationship(r: Relationship) {
    const roleLabel = WORK_ROLE_LABELS[r.role] ?? r.role;
    const person = personMap.get(r.person_id) ?? `#${r.person_id}`;
    // "سيصبح X مجهولاً" only holds when this is the work's sole مؤلف/ناسخ/منسوخ له —
    // once ناسخ can be a list or the role is المساهم, removing one row doesn't
    // make the work's scribe/contributor "unknown", it just drops that one credit.
    const otherScribesOnWork = workRelationships.filter(
      (other) => other.id !== r.id && other.work_id === r.work_id && other.role === "ناسخ"
    ).length;
    const simpleRemoval = isContributorRole(r.role) || (r.role === "ناسخ" && otherScribesOnWork > 0);
    const message = simpleRemoval
      ? `هل تريد إزالة «${person}» كـ${roleLabel} لهذا العنوان؟`
      : `هل تريد إزالة «${person}» كـ${roleLabel} لهذا العنوان؟ سيصبح ${roleLabel} مجهولاً.`;
    askConfirm(
      "إزالة الرابط",
      message,
      async () => {
        dismissConfirm();
        try {
          await relationshipsApi.delete(r.id);
          if (selected) setRelationships(await relationshipsApi.listForVolume(selected.id));
        } catch (err) {
          setDeleteError(String(err));
        }
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
  const selectedRepo = selected ? repos.find((r) => r.id === selected.repository_id) : undefined;

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
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <select
            className="select"
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">كل الخزائن</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="text"
            placeholder="بحث برقم المجلد…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", fontSize: 15, fontWeight: 500 }}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filteredVolumes.length === 0 ? (
            <p className="empty-state">
              {search.trim() || repoFilter !== "all" ? "لا توجد نتائج" : "لا توجد مجلدات بعد."}
            </p>
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "var(--font-size-body)", fontWeight: 600, color: "var(--color-text)" }}>
                        {v.repository_volume_number != null ? `رقم ${v.repository_volume_number}` : "—"}
                      </div>
                      <div style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", marginTop: 2 }}>
                        {repoName(v.repository_id)}
                      </div>
                    </div>
                    <span className="serial-badge" style={{ flexShrink: 0 }}>{v.serial}</span>
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
            {/* ── بيانات المجلد (summary header) ─────────── */}
            <header
              style={{
                marginBottom: "var(--space-6)",
                paddingBottom: "var(--space-5)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "var(--space-4)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span className="serial-badge" style={{ fontSize: 16 }}>
                    {selected.serial}
                  </span>
                  <h2 style={{ fontSize: "var(--font-size-section)", fontWeight: 600, marginTop: "var(--space-3)", marginBottom: 0 }}>
                    {selectedRepo?.name ?? "—"}
                    {selectedRepo?.location && (
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 400,
                          color: "var(--color-text-muted)",
                          marginInlineStart: "var(--space-2)",
                        }}
                      >
                        · {selectedRepo.location}
                      </span>
                    )}
                  </h2>
                  {selectedRepo?.notes && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-muted)",
                        marginTop: "var(--space-1)",
                        maxWidth: 640,
                        lineHeight: 1.7,
                      }}
                    >
                      {selectedRepo.notes}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
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

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2) var(--space-7)",
                  marginTop: "var(--space-4)",
                }}
              >
                <MetaItem
                  label="رقم المجلد في الخزانة"
                  value={
                    selected.repository_volume_number != null
                      ? String(selected.repository_volume_number)
                      : null
                  }
                />
                <MetaItem
                  label="عدد الأوراق"
                  value={selected.folio_count != null ? `${selected.folio_count} ورقة` : null}
                />
              </div>

              {selected.notes && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    ملاحظات
                  </span>
                  <p style={{ fontSize: 14, maxWidth: 640, lineHeight: 1.7 }}>{selected.notes}</p>
                </div>
              )}
            </header>

            {/* ── العناوين (Works) ───────────────────────── */}
            <section style={{ marginBottom: "var(--space-7)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-3)",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span
                  className="section-heading"
                  style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}
                >
                  العناوين
                  {works.length > 0 && (
                    <span style={{ fontWeight: 500, marginInlineStart: "var(--space-2)" }}>
                      · {works.length}
                    </span>
                  )}
                </span>
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

              {viewingWork && (
                <WorkDetailModal
                  work={viewingWork}
                  relationships={workRelationships}
                  personMap={personMap}
                  onEdit={() => {
                    setEditingWork(viewingWork);
                    setShowWorkForm(true);
                    setViewingWork(null);
                  }}
                  onClose={() => setViewingWork(null)}
                  onRemoveRelationship={removeWorkRelationship}
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
                        <tr
                          key={w.id}
                          onClick={() => setViewingWork(w)}
                          style={{ cursor: "pointer" }}
                        >
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWork(w);
                                setShowWorkForm(true);
                              }}
                            >
                              تعديل
                            </button>
                            <button
                              className="btn btn-danger btn-compact"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteWork(w);
                              }}
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
            </section>

            {/* ── القيود (Annotations) ───────────────────── */}
            <section style={{ marginBottom: "var(--space-7)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-3)",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span
                  className="section-heading"
                  style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}
                >
                  القيود
                  {annotations.length > 0 && (
                    <span style={{ fontWeight: 500, marginInlineStart: "var(--space-2)" }}>
                      · {annotations.length}
                    </span>
                  )}
                </span>
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

              {viewingAnnotation && (
                <AnnotationDetailModal
                  annotation={viewingAnnotation}
                  works={works}
                  relationships={volumeRelationships}
                  personMap={personMap}
                  onEdit={() => {
                    setEditingAnnotation(viewingAnnotation);
                    setShowAnnotationForm(true);
                    setViewingAnnotation(null);
                  }}
                  onClose={() => setViewingAnnotation(null)}
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
                        <tr
                          key={a.id}
                          onClick={() => setViewingAnnotation(a)}
                          style={{ cursor: "pointer" }}
                        >
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteRelationship(r);
                                      }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditAnnotation(a);
                              }}
                            >
                              تعديل
                            </button>
                            <button
                              className="btn btn-danger btn-compact"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAnnotation(a);
                              }}
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
            </section>
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

      {/* Delete error */}
      {deleteError && (
        <ErrorModal title="تعذّر الحذف" message={deleteError} onClose={() => setDeleteError("")} />
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span
        style={{
          display: "block",
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginBottom: 2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{value ?? "—"}</span>
    </div>
  );
}
