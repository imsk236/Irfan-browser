import { useEffect, useState } from "react";
import { personsApi } from "../../api";
import type { Appearance, Person } from "../../api/types";
import { normalizeArabic } from "../../utils/arabic";
import { PersonFormModal } from "../../components/PersonFormModal";

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block" }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  );
}

export function PersonsScreen() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [appearances, setAppearances] = useState<Appearance[] | null>(null);
  const [appearancesLoading, setAppearancesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    personsApi.list().then(setPersons);
  }, []);

  async function selectPerson(p: Person) {
    setSelected(p);
    setAppearances(null);
    setAppearancesLoading(true);
    try {
      setAppearances(await personsApi.appearances(p.id));
    } catch {
      setAppearances([]);
    } finally {
      setAppearancesLoading(false);
    }
  }

  async function handleSaved() {
    const updated = await personsApi.list();
    setPersons(updated);
    setShowForm(false);
    if (selected) {
      const fresh = updated.find((p) => p.id === selected.id);
      if (fresh) selectPerson(fresh);
    }
  }

  const q = normalizeArabic(search.trim());
  const filtered = persons.filter((p) => {
    if (!q) return true;
    return [p.preferred_name, p.ism, p.laqab, p.known_as, p.nisba_1, p.nisba_2, p.kunya, p.nasab]
      .some((f) => f && normalizeArabic(f).includes(q));
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Person list */}
      <div
        style={{
          width: 280,
          borderLeft: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
          <input
            className="input"
            type="text"
            placeholder="بحث في الأشخاص…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: "var(--space-2)" }}
          />
          <button
            className="btn btn-primary"
            style={{ width: "100%", fontSize: 12 }}
            onClick={() => {
              setSelected(null);
              setShowForm(true);
            }}
          >
            + شخص جديد
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <p className="empty-state">لا توجد نتائج</p>
          ) : (
            <ul style={{ listStyle: "none" }}>
              {filtered.map((p) => (
                <li
                  key={p.id}
                  onClick={() => selectPerson(p)}
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--color-border)",
                    background: selected?.id === p.id ? "var(--color-selected-bg)" : undefined,
                    borderRight:
                      selected?.id === p.id ? "3px solid var(--color-selected-marker)" : undefined,
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{p.preferred_name}</div>
                  {p.ism && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{p.ism}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Person detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        {selected && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "var(--space-5)",
              }}
            >
              <h2 style={{ marginBottom: 0 }}>{selected.preferred_name}</h2>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
                onClick={() => setShowForm(true)}
              >
                تعديل
              </button>
            </div>

            {/* Name details */}
            {(selected.ism || selected.kunya || selected.laqab || selected.nisba_1 || selected.known_as || selected.nasab) && (
              <div style={{ marginBottom: "var(--space-5)" }}>
                <span className="section-heading">تفاصيل الاسم</span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: "var(--space-3)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  <DetailRow label="الاسم (إسم)" value={selected.ism} />
                  <DetailRow label="الكنية" value={selected.kunya} />
                  <DetailRow label="اللقب" value={selected.laqab} />
                  <DetailRow label="النسبة الأولى" value={selected.nisba_1} />
                  <DetailRow label="النسبة الثانية" value={selected.nisba_2} />
                  <DetailRow label="المعروف بـ" value={selected.known_as} />
                  {selected.nasab && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <DetailRow label="سلسلة النسب" value={selected.nasab} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Biographical info */}
            {(selected.birth_date_as_written || selected.death_date_as_written ||
              selected.birth_place || selected.death_place || (selected.wilayas ?? []).length > 0) && (
              <div style={{ marginBottom: "var(--space-5)" }}>
                <span className="section-heading">معلومات تعريفية</span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "var(--space-3)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  <DetailRow label="تاريخ الولادة" value={selected.birth_date_as_written} />
                  <DetailRow label="تاريخ الوفاة" value={selected.death_date_as_written} />
                  <DetailRow label="مكان الولادة" value={selected.birth_place} />
                  <DetailRow label="مكان الوفاة" value={selected.death_place} />
                  {(selected.wilayas ?? []).length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block" }}>
                        المنطقة (الولايات)
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                        {(selected.wilayas ?? []).map((w) => (
                          <span
                            key={w}
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              background: "var(--color-surface-muted)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {selected.notes && (
              <div style={{ marginBottom: "var(--space-5)" }}>
                <span className="section-heading">ملاحظات</span>
                <p style={{ fontSize: 14, maxWidth: 600, marginTop: "var(--space-2)", lineHeight: 1.7 }}>
                  {selected.notes}
                </p>
              </div>
            )}

            {/* Appearances */}
            <div>
              <span className="section-heading">مواضع ظهور الشخص في الأرشيف</span>
              {appearancesLoading && (
                <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
                  جارٍ التحميل…
                </p>
              )}
              {!appearancesLoading && appearances !== null && appearances.length === 0 && (
                <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
                  لا توجد مواضع ظهور مسجلة لهذا الشخص.
                </p>
              )}
              {!appearancesLoading && appearances && appearances.length > 0 && (
                <table className="data-table" style={{ marginTop: "var(--space-3)", tableLayout: "fixed" }}>
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
                      <th>النص</th>
                      <th>مصدر الصلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appearances.map((a) => (
                      <tr key={a.relationship_id}>
                        <td>
                          <span className="serial-badge">{a.serial}</span>
                          {a.repository_volume_number != null && (
                            <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 4 }}>
                              ({a.repository_volume_number})
                            </span>
                          )}
                        </td>
                        <td>{a.role}</td>
                        <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.work_title ?? "—"}
                        </td>
                        <td
                          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={a.evidence_text ?? ""}
                        >
                          {a.evidence_text ? `«${a.evidence_text}»` : "—"}
                        </td>
                        <td style={{ color: "var(--color-text-muted)" }}>{a.evidence_source ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {!selected && (
          <p className="empty-state">اختر شخصاً من القائمة أو أضف شخصاً جديداً</p>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <PersonFormModal
          person={selected}
          onSaved={handleSaved}
          onDeleted={() => {
            setPersons((prev) => prev.filter((p) => p.id !== selected?.id));
            setSelected(null);
            setAppearances(null);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
