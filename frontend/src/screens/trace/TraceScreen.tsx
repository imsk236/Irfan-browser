import { useEffect, useRef, useState } from "react";
import { traceApi, volumesApi } from "../../api";
import type { Repository, TraceResult } from "../../api/types";
import { PersonField } from "../../components/PersonField";
import { ConfirmModal } from "../../components/ConfirmModal";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

const ROLE_ORDER = ["مؤلف", "ناسخ", "مالك", "مستعير", "واقف", "مقيّد", "مذكور"];

function sortRoles(roles: string[]): string[] {
  return [...roles].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a);
    const bi = ROLE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function TraceScreen() {
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [results, setResults] = useState<TraceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);

  // Filters
  const [activeRole, setActiveRole] = useState<string>("الكل");
  const [repoFilter, setRepoFilter] = useState<string>("");

  // Export
  const [showExport, setShowExport] = useState(false);
  const [exportDir, setExportDir] = useState("");
  const [exportConfirm, setExportConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    volumesApi.listRepositories().then(setRepos).catch(() => {});
  }, []);

  async function handlePersonSelect(person: SelectedPerson | null) {
    setSelectedPerson(person);
    setActiveRole("الكل");
    setRepoFilter("");
    if (!person) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      setResults(await traceApi.trace(person.person_id));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Derive unique roles from results
  const allRoles = results
    ? sortRoles([...new Set(results.map((r) => r.role))])
    : [];

  // Client-side filtering
  const filtered = (results ?? []).filter((r) => {
    const roleOk = activeRole === "الكل" || r.role === activeRole;
    const repoOk =
      !repoFilter ||
      (() => {
        const repo = repos.find((rep) => rep.id.toString() === repoFilter);
        return repo ? r.serial.startsWith(repo.place_key) : true;
      })();
    return roleOk && repoOk;
  });

  // Count per role (unfiltered by role, but filtered by repo)
  function countForRole(role: string) {
    if (!results) return 0;
    return results.filter((r) => {
      const repoOk =
        !repoFilter ||
        (() => {
          const repo = repos.find((rep) => rep.id.toString() === repoFilter);
          return repo ? r.serial.startsWith(repo.place_key) : true;
        })();
      return r.role === role && repoOk;
    }).length;
  }

  function totalCount() {
    if (!results) return 0;
    return results.filter((r) => {
      const repoOk =
        !repoFilter ||
        (() => {
          const repo = repos.find((rep) => rep.id.toString() === repoFilter);
          return repo ? r.serial.startsWith(repo.place_key) : true;
        })();
      return repoOk;
    }).length;
  }

  // Keyboard navigation for tabs
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) {
    const tabs = ["الكل", ...allRoles];
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (tabIndex + 1) % tabs.length;
      setActiveRole(tabs[next]);
      const btns = tabsRef.current?.querySelectorAll<HTMLButtonElement>(".role-tab");
      btns?.[next]?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const prev = (tabIndex - 1 + tabs.length) % tabs.length;
      setActiveRole(tabs[prev]);
      const btns = tabsRef.current?.querySelectorAll<HTMLButtonElement>(".role-tab");
      btns?.[prev]?.focus();
    }
  }

  async function runExport(format: "csv" | "json") {
    if (!exportDir.trim()) return;
    try {
      const { exportApi } = await import("../../api");
      if (format === "csv") {
        const r = await exportApi.csv(exportDir.trim());
        setExportConfirm({
          title: "تم التصدير",
          message: `تم تصدير ${r.files.length} ملف إلى: ${exportDir}`,
          onConfirm: () => setExportConfirm(null),
        });
      } else {
        const r = await exportApi.json(exportDir.trim());
        setExportConfirm({
          title: "تم التصدير",
          message: `تم حفظ الملف: ${r.file}`,
          onConfirm: () => setExportConfirm(null),
        });
      }
    } catch (err) {
      setExportConfirm({
        title: "خطأ في التصدير",
        message: String(err),
        onConfirm: () => setExportConfirm(null),
      });
    }
  }

  const tabs = ["الكل", ...allRoles];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top search bar + export toggle */}
      <div
        style={{
          padding: "var(--space-5) var(--space-5) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-4)" }}>
          <div style={{ maxWidth: 480, flex: 1 }}>
            <h1 style={{ fontSize: 18, marginBottom: "var(--space-3)" }}>البحث والتتبع</h1>
            <PersonField
              label="ابحث عن عالم"
              value={selectedPerson}
              onChange={handlePersonSelect}
            />
          </div>

          {/* Export controls — always visible */}
          <div style={{ flexShrink: 0 }}>
            <button
              className="btn btn-secondary btn-compact"
              onClick={() => setShowExport(!showExport)}
              style={{ marginBottom: showExport ? "var(--space-2)" : 0 }}
            >
              {showExport ? "إخفاء التصدير" : "تصدير الأرشيف"}
            </button>
            {showExport && (
              <div
                style={{
                  position: "absolute",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  padding: "var(--space-4)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  zIndex: 10,
                  minWidth: 320,
                }}
              >
                <div className="field" style={{ marginBottom: "var(--space-3)" }}>
                  <label>مسار مجلد الحفظ</label>
                  <input
                    className="input"
                    type="text"
                    value={exportDir}
                    onChange={(e) => setExportDir(e.target.value)}
                    placeholder="/path/to/output"
                    dir="ltr"
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    className="btn btn-secondary btn-compact"
                    disabled={!exportDir.trim()}
                    onClick={() => runExport("csv")}
                  >
                    CSV
                  </button>
                  <button
                    className="btn btn-secondary btn-compact"
                    disabled={!exportDir.trim()}
                    onClick={() => runExport("json")}
                  >
                    JSON
                  </button>
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={() => setShowExport(false)}
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        {loading && (
          <p style={{ color: "var(--color-text-muted)" }}>جارٍ البحث…</p>
        )}

        {results && !loading && results.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>
            لا توجد مخطوطات مرتبطة بهذا العالم.
          </p>
        )}

        {results && !loading && results.length > 0 && (
          <>
            {/* Filters row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-4)",
                flexWrap: "wrap",
                gap: "var(--space-3)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {totalCount()} نتيجة
                {selectedPerson && ` لـ ${selectedPerson.preferred_name}`}
              </span>

              {/* Repository filter */}
              {repos.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <label
                    style={{ fontSize: 13, color: "var(--color-text-muted)" }}
                    htmlFor="repo-filter"
                  >
                    الخزانة:
                  </label>
                  <select
                    id="repo-filter"
                    className="select"
                    style={{ width: "auto", height: 34, fontSize: 13 }}
                    value={repoFilter}
                    onChange={(e) => setRepoFilter(e.target.value)}
                  >
                    <option value="">الكل</option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Role tabs */}
            <div
              ref={tabsRef}
              role="tablist"
              aria-label="التصفية حسب الدور"
              className="role-tabs"
            >
              {tabs.map((tab, idx) => {
                const count = tab === "الكل" ? totalCount() : countForRole(tab);
                return (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeRole === tab}
                    className={`role-tab ${activeRole === tab ? "active" : ""}`}
                    onClick={() => setActiveRole(tab)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    tabIndex={activeRole === tab ? 0 : -1}
                  >
                    {tab}
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        marginRight: 4,
                      }}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Results table */}
            {filtered.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", padding: "var(--space-4) 0" }}>
                لا توجد نتائج لهذا الفلتر.
              </p>
            ) : (
              <table className="data-table" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "37%" }} />
                  <col style={{ width: "15%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>الرمز</th>
                    <th>الدور</th>
                    <th>العنوان</th>
                    <th>نص الدليل</th>
                    <th>مصدر الصلة</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.relationship_id}>
                      <td>
                        <span className="serial-badge">{r.serial}</span>
                        {r.repository_volume_number != null && (
                          <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 4 }}>
                            ({r.repository_volume_number})
                          </span>
                        )}
                      </td>
                      <td>{r.role}</td>
                      <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.work_title ?? "—"}
                      </td>
                      <td
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={r.evidence_text ?? ""}
                      >
                        {r.evidence_text ? `«${r.evidence_text}»` : "—"}
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>
                        {r.evidence_source ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {!selectedPerson && !loading && (
          <p className="empty-state">ابحث عن عالم لعرض مواضع ظهوره في الأرشيف</p>
        )}
      </div>

      {exportConfirm && (
        <ConfirmModal
          title={exportConfirm.title}
          message={exportConfirm.message}
          confirmLabel="حسناً"
          cancelLabel="إغلاق"
          onConfirm={exportConfirm.onConfirm}
          onCancel={() => setExportConfirm(null)}
        />
      )}
    </div>
  );
}
