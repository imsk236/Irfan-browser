import { useState } from "react";
import { volumesApi } from "../api";
import { VocabSelect } from "./VocabSelect";
import { ErrorModal } from "./ErrorModal";
import type { Repository } from "../api/types";

interface Props {
  repo: Repository | null;
  onSaved: (repo: Repository) => void;
  onCancel: () => void;
}

export function RepoFormModal({ repo, onSaved, onCancel }: Props) {
  const isEdit = repo !== null;
  const [placeKey, setPlaceKey] = useState(repo?.place_key ?? "");
  const [name, setName] = useState(repo?.name ?? "");
  const [location, setLocation] = useState(repo?.location ?? "");
  const [notes, setNotes] = useState(repo?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !/^\d{4}$/.test(placeKey)) {
      setError("مفتاح الخزانة يجب أن يكون 4 أرقام بالضبط");
      return;
    }
    if (!name.trim()) {
      setError("اسم الخزانة مطلوب");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = isEdit
        ? await volumesApi.updateRepository(repo.id, {
            name: name.trim(),
            location: location || null,
            notes: notes.trim() || null,
          })
        : await volumesApi.createRepository({
            place_key: placeKey,
            name: name.trim(),
            location: location || null,
            notes: notes.trim() || null,
          });
      onSaved(saved);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="repo-modal-title">
      <div className="modal-box modal-box--form">
        <h2 className="modal-title" id="repo-modal-title">
          {isEdit ? "تعديل الخزانة" : "خزانة جديدة"}
        </h2>
        <form onSubmit={submit}>
          {error && <ErrorModal message={error} onClose={() => setError("")} />}

          {isEdit ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              <div className="field">
                <label>الاسم <span style={{ color: "var(--color-error)" }}>*</span></label>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="field">
                <label>الولاية</label>
                <VocabSelect
                  category="wilaya"
                  value={location}
                  onChange={setLocation}
                  placeholder="اختر الولاية…"
                />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>ملاحظات</label>
                <textarea
                  className="textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ minHeight: 60 }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              <div className="field">
                <label>المفتاح (4 أرقام) <span style={{ color: "var(--color-error)" }}>*</span></label>
                <input
                  className="input"
                  type="text"
                  pattern="\d{4}"
                  maxLength={4}
                  value={placeKey}
                  onChange={(e) => setPlaceKey(e.target.value)}
                  placeholder="0001"
                  autoFocus
                  required
                />
              </div>
              <div className="field">
                <label>الاسم <span style={{ color: "var(--color-error)" }}>*</span></label>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>الولاية</label>
                <VocabSelect
                  category="wilaya"
                  value={location}
                  onChange={setLocation}
                  placeholder="اختر الولاية…"
                />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>ملاحظات</label>
                <textarea
                  className="textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ minHeight: 60 }}
                />
              </div>
            </div>
          )}

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
    </div>
  );
}
