import { useEffect, useState } from "react";
import { volumesApi } from "../../api";
import type { Repository } from "../../api/types";
import { ConfirmModal } from "../../components/ConfirmModal";
import { RepoFormModal } from "../../components/RepoFormModal";

interface ConfirmState {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
}

type SettingsSection = "repositories" | "vocab" | "export";

function SectionTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`role-tab ${active ? "active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function SettingsScreen() {
  const [section, setSection] = useState<SettingsSection>("repositories");
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [repoModal, setRepoModal] = useState<{ repo: Repository | null } | null>(null);

  useEffect(() => {
    loadRepos();
  }, []);

  async function loadRepos() {
    setLoading(true);
    setLoadError("");
    try {
      setRepos(await volumesApi.listRepositories());
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRepoSaved() {
    setRepoModal(null);
    await loadRepos();
  }

  function askDelete(r: Repository) {
    setConfirmState({
      title: "حذف الخزانة",
      message: `هل تريد حذف خزانة «${r.name}»؟ لا يمكن حذفها إذا كانت تحتوي على مجلدات.`,
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await volumesApi.deleteRepository(r.id);
          await loadRepos();
        } catch (err) {
          setConfirmState({
            title: "تعذّر الحذف",
            message: String(err),
            onConfirm: () => setConfirmState(null),
          });
        }
      },
    });
  }

  return (
    <div style={{ padding: "var(--space-5)", maxWidth: 860, overflowY: "auto", height: "100%" }}>
      <h1 style={{ fontSize: 20, marginBottom: "var(--space-5)" }}>الإعدادات</h1>

      {/* Section tabs */}
      <div role="tablist" className="role-tabs" style={{ marginBottom: "var(--space-5)" }}>
        <SectionTab label="الخزانات" active={section === "repositories"} onClick={() => setSection("repositories")} />
        <SectionTab label="القيم المنضبطة" active={section === "vocab"} onClick={() => setSection("vocab")} />
        <SectionTab label="التصدير" active={section === "export"} onClick={() => setSection("export")} />
      </div>

      {/* ── الخزانات ────────────────────────────────── */}
      {section === "repositories" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-4)",
            }}
          >
            <span className="section-heading" style={{ marginBottom: 0 }}>الخزانات</span>
            <button
              className="btn btn-primary btn-compact"
              onClick={() => setRepoModal({ repo: null })}
            >
              + خزانة جديدة
            </button>
          </div>

          {/* Repos list */}
          {loadError ? (
            <p style={{ color: "var(--color-error)", fontSize: 14 }}>{loadError}</p>
          ) : loading ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>جارٍ التحميل…</p>
          ) : repos.length === 0 ? (
            <p className="empty-state">لا توجد خزانات مسجلة.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {repos.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    background: "var(--color-surface)",
                    padding: "var(--space-4)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: "var(--space-1)" }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                        <span
                          style={{
                            background: "var(--color-surface-muted)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-sm)",
                            padding: "1px 6px",
                            marginInlineEnd: "var(--space-2)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {r.place_key}
                        </span>
                        {r.location && r.location}
                      </div>
                      {r.notes && (
                        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
                          {r.notes}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => setRepoModal({ repo: r })}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-compact"
                        onClick={() => askDelete(r)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── القيم المنضبطة (placeholder) ─────────────── */}
      {section === "vocab" && (
        <div>
          <span className="section-heading">القيم المنضبطة</span>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
            إدارة القيم المنضبطة (أنواع القيود، حالات التعريف، درجات الثقة، الوقت…) — قيد التطوير.
          </p>
        </div>
      )}

      {/* ── التصدير (placeholder) ────────────────────── */}
      {section === "export" && (
        <div>
          <span className="section-heading">التصدير</span>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
            إعدادات التصدير — قيد التطوير. استخدم واجهة البحث والتتبع لتصدير البيانات.
          </p>
        </div>
      )}

      {repoModal !== null && (
        <RepoFormModal
          repo={repoModal.repo}
          onSaved={handleRepoSaved}
          onCancel={() => setRepoModal(null)}
        />
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
