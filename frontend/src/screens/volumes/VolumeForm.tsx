import { useState } from "react";
import { volumesApi } from "../../api";
import { RepoFormModal } from "../../components/RepoFormModal";
import { ErrorModal } from "../../components/ErrorModal";
import type { Volume, Repository } from "../../api/types";

interface Props {
  repos: Repository[];
  volume: Volume | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function VolumeForm({ repos, volume, onSaved, onCancel }: Props) {
  const [repositoryId, setRepositoryId] = useState(volume?.repository_id.toString() ?? "");
  const [repositoryVolumeNumber, setRepositoryVolumeNumber] = useState(volume?.repository_volume_number?.toString() ?? "");
  const [folioCount, setFolioCount] = useState(volume?.folio_count?.toString() ?? "");
  const [notes, setNotes] = useState(volume?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [localRepos, setLocalRepos] = useState<Repository[]>(repos);
  const [showRepoModal, setShowRepoModal] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!repositoryId) {
      setError("يجب اختيار الخزانة");
      return;
    }
    if (!folioCount) {
      setError("عدد الأوراق مطلوب");
      return;
    }
    const folioCountInt = parseInt(folioCount);
    if (isNaN(folioCountInt) || folioCountInt < 1) {
      setError("عدد الأوراق يجب أن يكون رقماً صحيحاً موجباً");
      return;
    }
    if (repositoryVolumeNumber) {
      const rvn = parseInt(repositoryVolumeNumber);
      if (isNaN(rvn) || rvn < 1) {
        setError("رقم المجلد في الخزانة يجب أن يكون رقماً صحيحاً موجباً");
        return;
      }
    }

    setSaving(true);
    try {
      if (volume) {
        await volumesApi.update(volume.id, {
          repository_id: parseInt(repositoryId),
          repository_volume_number: repositoryVolumeNumber ? parseInt(repositoryVolumeNumber) : undefined,
          folio_count: folioCount ? parseInt(folioCount) : undefined,
          notes: notes || undefined,
        });
      } else {
        await volumesApi.create({
          repository_id: parseInt(repositoryId),
          repository_volume_number: repositoryVolumeNumber ? parseInt(repositoryVolumeNumber) : undefined,
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

  function handleRepoSaved(repo: Repository) {
    setLocalRepos((prev) => [...prev, repo]);
    setRepositoryId(repo.id.toString());
    setShowRepoModal(false);
  }

  return (
    <>
      <form onSubmit={submit}>
        <h3 style={{ marginBottom: "var(--space-4)" }}>{volume ? "تعديل المجلد" : "مجلد جديد"}</h3>

        {error && <ErrorModal message={error} onClose={() => setError("")} />}

        {/* Serial display (read-only) */}
        {volume && (
          <div className="field" style={{ marginBottom: "var(--space-4)" }}>
            <label>الرمز التعريفي</label>
            <span className="serial-badge" style={{ fontSize: 16 }}>{volume.serial}</span>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              يُحدَّث تلقائياً عند تغيير الخزانة
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <div className="field">
            <label>الخزانة <span style={{ color: "var(--color-error)" }}>*</span></label>
            <select
              className="select"
              value={repositoryId}
              onChange={(e) => setRepositoryId(e.target.value)}
              required
            >
              <option value="">اختر خزانة…</option>
              {localRepos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.place_key})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              style={{ marginTop: 4 }}
              onClick={() => setShowRepoModal(true)}
            >
              + خزانة جديدة
            </button>
          </div>

          <div className="field">
            <label>رقم المجلد في الخزانة</label>
            <input
              className="input"
              type="number"
              min="1"
              value={repositoryVolumeNumber}
              onChange={(e) => setRepositoryVolumeNumber(e.target.value)}
            />
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              الرقم الذي وضعته الخزانة على المجلد (اختياري)
            </span>
          </div>

          <div className="field">
            <label>عدد الأوراق <span style={{ color: "var(--color-error)" }}>*</span></label>
            <input
              className="input"
              type="number"
              min="1"
              value={folioCount}
              onChange={(e) => setFolioCount(e.target.value)}
            />
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

      {showRepoModal && (
        <RepoFormModal
          repo={null}
          onSaved={handleRepoSaved}
          onCancel={() => setShowRepoModal(false)}
        />
      )}
    </>
  );
}
