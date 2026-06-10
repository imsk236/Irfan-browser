import { useEffect, useState } from "react";
import { volumesApi, worksApi } from "../../api";
import type { Volume, Work, Repository } from "../../api/types";
import { VolumeForm } from "./VolumeForm";
import { WorkForm } from "./WorkForm";

export function VolumesScreen() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selected, setSelected] = useState<Volume | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [showVolumeForm, setShowVolumeForm] = useState(false);
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);

  useEffect(() => {
    volumesApi.list().then(setVolumes);
    volumesApi.listRepositories().then(setRepos);
  }, []);

  async function selectVolume(v: Volume) {
    setSelected(v);
    setWorks(await worksApi.listForVolume(v.id));
  }

  async function handleVolumeSaved() {
    const updated = await volumesApi.list();
    setVolumes(updated);
    setShowVolumeForm(false);
    if (selected) {
      const fresh = updated.find((v) => v.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }

  async function handleWorkSaved() {
    if (!selected) return;
    setWorks(await worksApi.listForVolume(selected.id));
    setShowWorkForm(false);
    setEditingWork(null);
  }

  async function deleteWork(work: Work) {
    if (!confirm(`حذف «${work.title}»؟`)) return;
    await worksApi.delete(work.id);
    if (selected) setWorks(await worksApi.listForVolume(selected.id));
  }

  const repoName = (id: number) => repos.find((r) => r.id === id)?.name ?? "—";

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Volume list */}
      <div style={{ width: 320, borderLeft: "1px solid var(--color-border)", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: "var(--space-4)", borderBottom: "var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16 }}>المجلدات</h2>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setShowVolumeForm(true)}>
            + مجلد جديد
          </button>
        </div>
        {volumes.length === 0 ? (
          <p className="empty-state">لا توجد مجلدات بعد. أضف مجلداً جديداً.</p>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {volumes.map((v) => (
              <li
                key={v.id}
                onClick={() => selectVolume(v)}
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--color-border)",
                  background: selected?.id === v.id ? "var(--color-selected-bg)" : undefined,
                  borderRight: selected?.id === v.id ? "3px solid var(--color-selected-marker)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="serial-badge">{v.serial}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-info)", marginTop: 2 }}>
                  {repoName(v.repository_id)}
                  {v.library_shelfmark && ` · ${v.library_shelfmark}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Volume detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        {!selected && !showVolumeForm && (
          <p className="empty-state">اختر مجلداً من القائمة</p>
        )}

        {showVolumeForm && (
          <VolumeForm
            repos={repos}
            volume={null}
            onSaved={handleVolumeSaved}
            onCancel={() => setShowVolumeForm(false)}
          />
        )}

        {selected && !showVolumeForm && (
          <>
            <div style={{ marginBottom: "var(--space-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-4)" }}>
                <div>
                  <span className="serial-badge" style={{ fontSize: 18 }}>{selected.serial}</span>
                  {selected.library_shelfmark && (
                    <span style={{ marginRight: "var(--space-3)", color: "var(--color-info)", fontSize: 14 }}>
                      رقم المكتبة: {selected.library_shelfmark}
                    </span>
                  )}
                </div>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowVolumeForm(true)}>
                  تعديل
                </button>
              </div>
              <div style={{ fontSize: 14, color: "var(--color-info)", marginBottom: "var(--space-2)" }}>
                المستودع: {repoName(selected.repository_id)}
                {selected.folio_count && ` · ${selected.folio_count} ورقة`}
              </div>
              {selected.notes && (
                <p style={{ fontSize: 14, maxWidth: 640 }}>{selected.notes}</p>
              )}
            </div>

            {/* Works section */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                <span className="section-heading">الآثار</span>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { setEditingWork(null); setShowWorkForm(true); }}>
                  + إضافة أثر
                </button>
              </div>

              {showWorkForm && (
                <div style={{ marginBottom: "var(--space-5)", padding: "var(--space-4)", border: "var(--border)", borderRadius: "var(--radius)", background: "var(--color-surface)" }}>
                  <WorkForm
                    volumeId={selected.id}
                    work={editingWork}
                    onSaved={handleWorkSaved}
                    onCancel={() => { setShowWorkForm(false); setEditingWork(null); }}
                  />
                </div>
              )}

              {works.length === 0 && !showWorkForm ? (
                <p style={{ color: "var(--color-info)", fontSize: 14 }}>لا توجد آثار مسجلة لهذا المجلد.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>العنوان</th>
                      <th>النوع</th>
                      <th>الأوراق</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {works.map((w) => (
                      <tr key={w.id}>
                        <td>{w.title}</td>
                        <td>{w.work_type ?? "—"}</td>
                        <td>
                          {w.start_unit && w.end_unit ? `${w.start_unit} – ${w.end_unit}` : w.start_unit ?? "—"}
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 8px", marginInlineEnd: 6 }}
                            onClick={() => { setEditingWork(w); setShowWorkForm(true); }}>
                            تعديل
                          </button>
                          <button className="btn btn-danger" style={{ fontSize: 11, padding: "2px 8px" }}
                            onClick={() => deleteWork(w)}>
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
