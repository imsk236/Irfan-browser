import { useState } from "react";
import { volumesApi } from "../../api";
import { VocabSelect } from "../../components/VocabSelect";
import type { Volume, Repository } from "../../api/types";

interface Props {
  repos: Repository[];
  volume: Volume | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function VolumeForm({ repos, volume, onSaved, onCancel }: Props) {
  const [repositoryId, setRepositoryId] = useState(volume?.repository_id.toString() ?? "");
  const [shelfmark, setShelfmark] = useState(volume?.library_shelfmark ?? "");
  const [folioCount, setFolioCount] = useState(volume?.folio_count?.toString() ?? "");
  const [notes, setNotes] = useState(volume?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Local repo list — initialised from props; updated when user creates a new repo inline
  const [localRepos, setLocalRepos] = useState<Repository[]>(repos);

  // New repository fields
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoPlaceKey, setNewRepoPlaceKey] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoKind, setNewRepoKind] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (volume) {
        await volumesApi.update(volume.id, {
          repository_id: parseInt(repositoryId),
          library_shelfmark: shelfmark || undefined,
          folio_count: folioCount ? parseInt(folioCount) : undefined,
          notes: notes || undefined,
        });
      } else {
        await volumesApi.create({
          repository_id: parseInt(repositoryId),
          library_shelfmark: shelfmark || undefined,
          folio_count: folioCount ? parseInt(folioCount) : undefined,
          notes: notes || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function createRepo() {
    if (!/^\d{4}$/.test(newRepoPlaceKey)) {
      setError("مفتاح المستودع يجب أن يكون 4 أرقام");
      return;
    }
    if (!newRepoName.trim()) {
      setError("اسم المستودع مطلوب");
      return;
    }
    if (!newRepoKind) {
      setError("نوع المستودع مطلوب");
      return;
    }
    try {
      const repo = await volumesApi.createRepository({
        place_key: newRepoPlaceKey,
        name: newRepoName,
        kind: newRepoKind,
        notes: null,
      });
      setLocalRepos((prev) => [...prev, repo]);
      setRepositoryId(repo.id.toString());
      setShowNewRepo(false);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <form onSubmit={submit}>
      <h3 style={{ marginBottom: "var(--space-4)" }}>{volume ? "تعديل المجلد" : "مجلد جديد"}</h3>

      {error && (
        <p style={{ color: "var(--color-error)", marginBottom: "var(--space-3)", fontSize: 14 }}>{error}</p>
      )}

      {/* Serial: display only, never editable directly */}
      {volume && (
        <div className="field" style={{ marginBottom: "var(--space-4)" }}>
          <label>الرمز التعريفي</label>
          <span className="serial-badge" style={{ fontSize: 16 }}>{volume.serial}</span>
          <span style={{ fontSize: 12, color: "var(--color-info)" }}>
            يُحدَّث تلقائياً عند تغيير المستودع أو الرقم
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="field">
          <label>المستودع <span style={{ color: "var(--color-error)" }}>*</span></label>
          <select className="select" value={repositoryId} onChange={(e) => setRepositoryId(e.target.value)} required>
            <option value="">اختر مستودعاً…</option>
            {localRepos.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({r.place_key})</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12, marginTop: 4 }}
            onClick={() => setShowNewRepo(!showNewRepo)}>
            {showNewRepo ? "إلغاء" : "+ مستودع جديد"}
          </button>
        </div>

        <div className="field">
          <label>رقم المكتبة (شلفمارك)</label>
          <input className="input" type="text" value={shelfmark} onChange={(e) => setShelfmark(e.target.value)} />
        </div>

        <div className="field">
          <label>عدد الأوراق</label>
          <input className="input" type="number" min="1" value={folioCount} onChange={(e) => setFolioCount(e.target.value)} />
        </div>
      </div>

      {showNewRepo && (
        <div style={{ padding: "var(--space-4)", border: "var(--border)", borderRadius: "var(--radius)", marginBottom: "var(--space-4)", background: "var(--color-bg)" }}>
          <h4 style={{ marginBottom: "var(--space-3)", fontSize: 14 }}>مستودع جديد</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
            <div className="field">
              <label>المفتاح (4 أرقام) *</label>
              <input className="input" type="text" pattern="\d{4}" maxLength={4} value={newRepoPlaceKey}
                onChange={(e) => setNewRepoPlaceKey(e.target.value)} placeholder="مثال: 0001" />
            </div>
            <div className="field">
              <label>الاسم *</label>
              <input className="input" type="text" value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} />
            </div>
            <div className="field">
              <label>النوع *</label>
              <VocabSelect category="repository_kind" value={newRepoKind} onChange={setNewRepoKind}
                placeholder="اختر النوع…" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={createRepo}>حفظ المستودع</button>
            </div>
          </div>
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
