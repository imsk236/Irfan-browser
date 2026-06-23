import { useEffect, useRef, useState } from "react";
import { traceApi, volumesApi } from "../../api";
import type { Repository, TraceResult, WilayaTraceResult } from "../../api/types";
import { PersonField } from "../../components/PersonField";
import { VocabSelect } from "../../components/VocabSelect";
import { ConfirmModal } from "../../components/ConfirmModal";
import { WilayaResults } from "./WilayaResults";

type Mode = "person" | "wilaya";

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
  // Mode
  const [mode, setMode] = useState<Mode>("person");

  // Person mode state
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [results, setResults] = useState<TraceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [activeRole, setActiveRole] = useState<string>("الكل");
  const [repoFilter, setRepoFilter] = useState<string>("");

  // Wilaya mode state
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [wilayaResults, setWilayaResults] = useState<WilayaTraceResult | null>(null);
  const [wilayaLoading, setWilayaLoading] = useState(false);

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

  function switchMode(newMode: Mode) {
    setMode(newMode);
    if (newMode === "person") {
      setSelectedWilaya("");
      setWilayaResults(null);
    } else {
      setSelectedPerson(null);
      setResults(null);
      setActiveRole("الكل");
      setRepoFilter("");
    }
  }

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

  async function handleWilayaSelect(wilaya: string) {
    setSelectedWilaya(wilaya);
    if (!wilaya) {
      setWilayaResults(null);
      return;
    }
    setWilayaLoading(true);
    try {
      setWilayaResults(await traceApi.traceWilaya(wilaya));
    } catch {
      setWilayaResults({ scholars: [], copies: [], repositories: [] });
    } finally {
      setWilayaLoading(false);
    }
  }

  function handleScholarClick(personId: number, preferredName: string) {
    switchMode("person");
    void handlePersonSelect({ person_id: personId, preferred_name: preferredName, written_form: preferredName });
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
      {/* Header */}
      <div
        style={{
          padding: "var(--space-5) var(--space-5) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        {/* Title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <div style={{ flexShrink: 0, position: "relative" }}>
            <button
              className="btn btn-secondary btn-compact"
              onClick={() => setShowExport(!showExport)}
            >
              {showExport ? "إخفاء التصدير" : "تصدير الأرشيف"}
            </button>
            {showExport && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "calc(100% + var(--space-2))",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  padding: "var(--space-4)",
                  boxShadow: "var(--shadow-dropdown)",
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
                  <button className="btn btn-secondary btn-compact" disabled={!exportDir.trim()} onClick={() => runExport("csv")}>CSV</button>
                  <button className="btn btn-secondary btn-compact" disabled={!exportDir.trim()} onClick={() => runExport("json")}>JSON</button>
                  <button className="btn btn-secondary btn-compact" onClick={() => setShowExport(false)}>إغلاق</button>
                </div>
              </div>
            )}
          </div>

          <h1 style={{ fontSize: 18 }}>البحث والتتبع</h1>
        </div>

        {/* Mode toggle + search field */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-3)", maxWidth: 560 }}>
          {/* Mode segmented control */}
          <div
            style={{
              display: "flex",
              flexShrink: 0,
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            <button
              className={`btn ${mode === "person" ? "btn-primary" : "btn-secondary"}`}
              style={{ borderRadius: 0, border: "none", borderRight: "1px solid var(--color-border-strong)", height: 40, fontSize: 13 }}
              onClick={() => switchMode("person")}
              aria-pressed={mode === "person"}
            >
              بحث عن عالم
            </button>
            <button
              className={`btn ${mode === "wilaya" ? "btn-primary" : "btn-secondary"}`}
              style={{ borderRadius: 0, border: "none", height: 40, fontSize: 13 }}
              onClick={() => switchMode("wilaya")}
              aria-pressed={mode === "wilaya"}
            >
              بحث عن ولاية
            </button>
          </div>

          {/* Search field */}
          <div style={{ flex: 1 }}>
            {mode === "person" ? (
              <PersonField
                label="ابحث عن عالم"
                value={selectedPerson}
                onChange={handlePersonSelect}
              />
            ) : (
              <div className="field">
                <label style={{ fontSize: 13, fontWeight: 500 }}>اختر ولاية</label>
                <VocabSelect
                  category="wilaya"
                  value={selectedWilaya}
                  onChange={handleWilayaSelect}
                  placeholder="اختر ولاية…"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>

        {/* ── Person mode ── */}
        {mode === "person" && (
          <>
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

                  {repos.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <label style={{ fontSize: 13, color: "var(--color-text-muted)" }} htmlFor="repo-filter">
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
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div ref={tabsRef} role="tablist" aria-label="التصفية حسب الدور" className="role-tabs">
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
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginRight: 4 }}>
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>

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
          </>
        )}

        {/* ── Wilaya mode ── */}
        {mode === "wilaya" && (
          <>
            {wilayaLoading && (
              <p style={{ color: "var(--color-text-muted)" }}>جارٍ البحث…</p>
            )}

            {wilayaResults && !wilayaLoading && (
              <WilayaResults
                key={selectedWilaya}
                wilaya={selectedWilaya}
                results={wilayaResults}
                onScholarClick={handleScholarClick}
              />
            )}

            {!selectedWilaya && !wilayaLoading && (
              <p className="empty-state">اختر ولاية لعرض ما يرتبط بها من علماء ونسخ وخزائن</p>
            )}
          </>
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
