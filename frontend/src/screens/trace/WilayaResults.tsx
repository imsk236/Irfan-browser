import { useState } from "react";
import type { WilayaTraceResult } from "../../api/types";

type Tab = "scholars" | "copies" | "repositories";

interface Props {
  wilaya: string;
  results: WilayaTraceResult;
  onScholarClick: (personId: number, preferredName: string) => void;
}

export function WilayaResults({ wilaya, results, onScholarClick }: Props) {
  const { scholars, copies, repositories } = results;
  const total = scholars.length + copies.length + repositories.length;

  const [activeTab, setActiveTab] = useState<Tab>("scholars");

  return (
    <div>
      {/* Result count */}
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
        {total} نتيجة في ولاية {wilaya}
      </p>

      {/* Tabs — reuse role-tabs pattern */}
      <div role="tablist" aria-label="تصفية نتائج الولاية" className="role-tabs">
        <button
          role="tab"
          aria-selected={activeTab === "repositories"}
          className={`role-tab ${activeTab === "repositories" ? "active" : ""}`}
          onClick={() => setActiveTab("repositories")}
        >
          الخزائن
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginRight: 4 }}>
            ({repositories.length})
          </span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "copies"}
          className={`role-tab ${activeTab === "copies" ? "active" : ""}`}
          onClick={() => setActiveTab("copies")}
        >
          النسخ
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginRight: 4 }}>
            ({copies.length})
          </span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "scholars"}
          className={`role-tab ${activeTab === "scholars" ? "active" : ""}`}
          onClick={() => setActiveTab("scholars")}
        >
          العلماء
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginRight: 4 }}>
            ({scholars.length})
          </span>
        </button>
      </div>

      {/* Tab panels */}
      {activeTab === "scholars" && (
        <ScholarsPanel scholars={scholars} onScholarClick={onScholarClick} />
      )}
      {activeTab === "copies" && (
        <CopiesPanel copies={copies} />
      )}
      {activeTab === "repositories" && (
        <RepositoriesPanel repositories={repositories} />
      )}
    </div>
  );
}

function ScholarsPanel({ scholars, onScholarClick }: {
  scholars: WilayaTraceResult["scholars"];
  onScholarClick: (personId: number, preferredName: string) => void;
}) {
  if (scholars.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", padding: "var(--space-4) 0" }}>
        لا يوجد علماء مرتبطون بهذه الولاية.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {scholars.map((s) => (
        <li key={s.person_id}>
          <button
            onClick={() => onScholarClick(s.person_id, s.preferred_name)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              padding: "var(--space-3) var(--space-3)",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--color-border)",
              cursor: "pointer",
              fontFamily: "var(--font-family)",
              fontSize: "var(--font-size-body)",
              color: "var(--color-text)",
              textAlign: "right",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-100)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>‹</span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flex: 1, justifyContent: "space-between", marginRight: "var(--space-3)" }}>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {s.appearance_count} {s.appearance_count === 1 ? "مخطوطة" : "مخطوطات"}
              </span>
              <span style={{ fontWeight: 500 }}>{s.preferred_name}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CopiesPanel({ copies }: { copies: WilayaTraceResult["copies"] }) {
  if (copies.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", padding: "var(--space-4) 0" }}>
        لا توجد نسخ مسجّلة لهذه الولاية.
      </p>
    );
  }

  return (
    <table className="data-table" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "45%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "37%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>العنوان</th>
          <th>الرمز</th>
          <th>الناسخ</th>
        </tr>
      </thead>
      <tbody>
        {copies.map((c) => (
          <tr key={c.work_id}>
            <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.work_title}
            </td>
            <td>
              <span className="serial-badge">{c.serial}</span>
              {c.repository_volume_number != null && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginRight: 4 }}>
                  ({c.repository_volume_number})
                </span>
              )}
            </td>
            <td style={{ color: c.copier_name ? "var(--color-text)" : "var(--color-text-muted)" }}>
              {c.copier_name ?? "مجهول"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RepositoriesPanel({ repositories }: { repositories: WilayaTraceResult["repositories"] }) {
  if (repositories.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", padding: "var(--space-4) 0" }}>
        لا توجد خزائن مسجّلة في هذه الولاية.
      </p>
    );
  }

  return (
    <table className="data-table" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "55%" }} />
        <col style={{ width: "20%" }} />
        <col style={{ width: "25%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>اسم الخزانة</th>
          <th>المفتاح</th>
          <th>عدد المجلدات</th>
        </tr>
      </thead>
      <tbody>
        {repositories.map((r) => (
          <tr key={r.repository_id}>
            <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.name}
            </td>
            <td>
              <span className="serial-badge">{r.place_key}</span>
            </td>
            <td style={{ color: "var(--color-text-muted)" }}>
              {r.volume_count}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
