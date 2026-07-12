import { useEffect, useRef, useState } from "react";
import { traceApi, volumesApi, personsApi, worksApi, relationshipsApi } from "../../api";
import type { Repository, TraceResult, Person, Work, Relationship } from "../../api/types";
import { PersonField } from "../../components/PersonField";
import { VocabSelect } from "../../components/VocabSelect";
import { WorkDetailModal } from "../../components/WorkDetailModal";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

interface Props {
  onNavigateToVolume?: (volumeId: number) => void;
}

// Work-level fixed roles, then contributor_role vocab, then قيد role vocab (seed.py sort_order) — see ADR 0006.
const ROLE_ORDER = [
  "مؤلف", "مؤلف مشارك", "ناسخ", "كاتب", "منسوخ له",
  "الراوي", "المترجم", "الجامع", "المرتب", "المعلق", "المستدرك", "المصحح",
  "مالك", "شاري", "بائع", "واهب", "موهوب", "مُهْدِي", "مُهْدَى إليه",
  "مُعير", "مستعير", "واقف", "موقوف", "ناظر", "ناظر الوقف", "دلال",
  "مُطالِع", "مُعارض", "معروض عليه", "مُقابِل", "شاهد",
];

function sortRoles(roles: string[]): string[] {
  return [...roles].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a);
    const bi = ROLE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function TraceScreen({ onNavigateToVolume }: Props = {}) {
  // Unified filter panel state (ADR 0005 — one search, every field optional and combinable)
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [region, setRegion] = useState("");
  const [copyPlace, setCopyPlace] = useState("");
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [repoFilter, setRepoFilter] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const [results, setResults] = useState<TraceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeRole, setActiveRole] = useState<string>("الكل");
  const [repos, setRepos] = useState<Repository[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);

  // Result-detail modal (work-level rows only — see ADR 0005)
  const [viewingWork, setViewingWork] = useState<{ work: Work; relationships: Relationship[] } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    volumesApi.listRepositories().then(setRepos).catch(() => {});
    personsApi.list().then(setPersons).catch(() => {});
  }, []);

  const personMap = new Map(persons.map((p) => [p.id, p.preferred_name]));

  const hasAnyFilter =
    selectedPerson !== null || region !== "" || copyPlace !== "" || title.trim() !== "" ||
    number.trim() !== "" || repoFilter !== "" || yearFrom.trim() !== "" || yearTo.trim() !== "";

  async function handleSearch() {
    if (!hasAnyFilter) return;
    setLoading(true);
    setSearchError("");
    setActiveRole("الكل");
    try {
      const filters: Parameters<typeof traceApi.search>[0] = {};
      if (selectedPerson) filters.person_id = selectedPerson.person_id;
      if (region) filters.region = region;
      if (copyPlace) filters.copy_place = copyPlace;
      if (title.trim()) filters.title = title.trim();
      if (number.trim()) filters.number = number.trim();
      if (repoFilter) filters.repository_id = Number(repoFilter);
      if (yearFrom.trim()) filters.year_from = Number(yearFrom.trim());
      if (yearTo.trim()) filters.year_to = Number(yearTo.trim());
      setResults(await traceApi.search(filters));
    } catch (err) {
      console.error(err);
      // client.ts surfaces the server's Arabic `detail` as Error.message
      setSearchError(
        err instanceof Error && err.message ? err.message : "تعذّر إجراء البحث. حاول مرة أخرى."
      );
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSearch();
    }
  }

  async function handleRowClick(row: TraceResult) {
    if (row.work_id != null) {
      setModalLoading(true);
      try {
        const [work, relationships] = await Promise.all([
          worksApi.get(row.work_id),
          relationshipsApi.listForVolume(row.volume_id),
        ]);
        setViewingWork({ work, relationships });
      } catch {
        // work fetch failed — fall back to opening the volume itself
        onNavigateToVolume?.(row.volume_id);
      } finally {
        setModalLoading(false);
      }
    } else {
      onNavigateToVolume?.(row.volume_id);
    }
  }

  function handleWorkModalEdit() {
    if (viewingWork) onNavigateToVolume?.(viewingWork.work.volume_id);
    setViewingWork(null);
  }

  // Derive unique roles from results (placeholder rows have role=null and only show under "الكل")
  const allRoles = results
    ? sortRoles([...new Set(results.map((r) => r.role).filter((r): r is string => r != null))])
    : [];

  const filtered = (results ?? []).filter((r) => activeRole === "الكل" || r.role === activeRole);

  function countForRole(role: string) {
    if (!results) return 0;
    return results.filter((r) => r.role === role).length;
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
        <div style={{ marginBottom: "var(--space-4)" }}>
          <h1 style={{ fontSize: 18 }}>البحث والتتبع</h1>
        </div>

        {/* Unified filter panel — one search, every field optional and combinable (ADR 0005) */}
        <div onKeyDown={handleSearchKeyDown} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Row 1 — primary search terms */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <PersonField label="شخص" value={selectedPerson} onChange={setSelectedPerson} />
            <div className="field">
              <label htmlFor="trace-title" style={{ fontSize: 13, fontWeight: 500 }}>العنوان</label>
              <input
                id="trace-title"
                className="input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ابحث بعنوان العنوان…"
              />
            </div>
          </div>

          {/* Row 2 — narrowing filters + search action */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1.3fr 1.3fr 1fr 84px 84px auto",
              gap: "var(--space-3)",
              alignItems: "flex-end",
            }}
          >
            <div className="field">
              <label htmlFor="trace-region" style={{ fontSize: 13, fontWeight: 500 }}>منطقة العالم</label>
              <VocabSelect id="trace-region" category="wilaya" value={region} onChange={setRegion} placeholder="أي منطقة" />
            </div>
            <div className="field">
              <label htmlFor="trace-copy-place" style={{ fontSize: 13, fontWeight: 500 }}>مكان النسخ</label>
              <VocabSelect id="trace-copy-place" category="wilaya" value={copyPlace} onChange={setCopyPlace} placeholder="أي مكان" />
            </div>
            <div className="field">
              <label htmlFor="trace-repo" style={{ fontSize: 13, fontWeight: 500 }}>الخزانة</label>
              <select id="trace-repo" className="select" value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)}>
                <option value="">كل الخزائن</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="trace-number" style={{ fontSize: 13, fontWeight: 500 }}>الرقم</label>
              <input
                id="trace-number"
                className="input"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="التسلسلي أو رقم المجلد"
              />
            </div>
            <div className="field">
              <label htmlFor="trace-year-from" style={{ fontSize: 13, fontWeight: 500 }}>سنة من</label>
              <input
                id="trace-year-from"
                className="input"
                type="number"
                dir="ltr"
                style={{ textAlign: "left" }}
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="١٢٠٠"
              />
            </div>
            <div className="field">
              <label htmlFor="trace-year-to" style={{ fontSize: 13, fontWeight: 500 }}>سنة إلى</label>
              <input
                id="trace-year-to"
                className="input"
                type="number"
                dir="ltr"
                style={{ textAlign: "left" }}
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                placeholder="١٣٠٠"
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={!hasAnyFilter || loading}
              onClick={() => void handleSearch()}
            >
              بحث
            </button>
          </div>
        </div>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        {loading && (
          <p style={{ color: "var(--color-text-muted)" }}>جارٍ البحث…</p>
        )}

        {searchError && !loading && (
          <p style={{ color: "var(--color-danger)" }}>{searchError}</p>
        )}

        {!loading && !searchError && results && results.length === 0 && (
          <p className="empty-state">لا توجد نتائج مطابقة.</p>
        )}

        {!loading && !searchError && results && results.length > 0 && (
          <>
            <div style={{ marginBottom: "var(--space-4)" }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {filtered.length} نتيجة
              </span>
            </div>

            <div ref={tabsRef} role="tablist" aria-label="التصفية حسب الدور" className="role-tabs">
              {tabs.map((tab, idx) => {
                const count = tab === "الكل" ? results.length : countForRole(tab);
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
                    <tr
                      key={r.relationship_id ?? `ph-${r.volume_id}-${r.work_id}`}
                      onClick={() => void handleRowClick(r)}
                      style={{ cursor: "pointer", background: r.relationship_id == null ? "var(--color-surface-muted)" : undefined }}
                    >
                      <td>
                        <span className="serial-badge">{r.serial}</span>
                        {r.repository_volume_number != null && (
                          <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 4 }}>
                            ({r.repository_volume_number})
                          </span>
                        )}
                      </td>
                      <td>
                        {r.role ?? (
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: "var(--color-warning)",
                            background: "rgba(160, 113, 30, 0.10)", borderRadius: 999, padding: "2px 9px",
                          }}>
                            لا توجد علاقة مسجلة
                          </span>
                        )}
                      </td>
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

        {!results && !loading && !searchError && (
          <p className="empty-state">
            ابحث بشخص، منطقة، عنوان، رقم، خزانة، أو سنة النسخ — يمكن الجمع بين أكثر من معيار
          </p>
        )}
      </div>

      {modalLoading && (
        <div className="modal-backdrop">
          <p style={{ color: "#fff" }}>جارٍ التحميل…</p>
        </div>
      )}

      {viewingWork && (
        <WorkDetailModal
          work={viewingWork.work}
          relationships={viewingWork.relationships}
          personMap={personMap}
          onEdit={handleWorkModalEdit}
          onClose={() => setViewingWork(null)}
        />
      )}
    </div>
  );
}
