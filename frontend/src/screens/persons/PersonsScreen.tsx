import { useEffect, useState } from "react";
import { personsApi } from "../../api";
import type { Person, NameVariant } from "../../api/types";
import { PersonForm } from "./PersonForm";

export function PersonsScreen() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [variants, setVariants] = useState<NameVariant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    personsApi.list().then(setPersons);
  }, []);

  async function selectPerson(p: Person) {
    setSelected(p);
    setVariants(await personsApi.listVariants(p.id));
    setShowForm(false);
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

  const filtered = persons.filter((p) =>
    p.preferred_name.includes(search) || (p.ism ?? "").includes(search)
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Person list */}
      <div style={{ width: 280, borderLeft: "1px solid var(--color-border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "var(--border)" }}>
          <input
            className="input"
            type="text"
            placeholder="بحث في الأشخاص…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: "var(--space-2)" }}
          />
          <button className="btn btn-primary" style={{ width: "100%", fontSize: 12 }}
            onClick={() => { setSelected(null); setShowForm(true); }}>
            + شخص جديد
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <p className="empty-state">لا توجد نتائج</p>
          ) : (
            <ul style={{ listStyle: "none" }}>
              {filtered.map((p) => (
                <li key={p.id} onClick={() => selectPerson(p)}
                  style={{
                    padding: "var(--space-3) var(--space-4)", cursor: "pointer",
                    borderBottom: "1px solid var(--color-border)",
                    background: selected?.id === p.id ? "var(--color-selected-bg)" : undefined,
                    borderRight: selected?.id === p.id ? "3px solid var(--color-selected-marker)" : undefined,
                  }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{p.preferred_name}</div>
                  {p.ism && <div style={{ fontSize: 12, color: "var(--color-info)" }}>{p.ism}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Person detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
        {showForm && (
          <PersonForm
            person={selected}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        )}

        {selected && !showForm && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-5)" }}>
              <h2>{selected.preferred_name}</h2>
              <button className="btn btn-secondary" style={{ fontSize: 12 }}
                onClick={() => setShowForm(true)}>تعديل</button>
            </div>

            {/* Structured fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
              {selected.ism && <div><span className="section-heading" style={{ fontSize: 11 }}>الاسم</span><p>{selected.ism}</p></div>}
              {selected.nisba_1 && <div><span className="section-heading" style={{ fontSize: 11 }}>النسبة الأولى</span><p>{selected.nisba_1}</p></div>}
              {selected.nisba_2 && <div><span className="section-heading" style={{ fontSize: 11 }}>النسبة الثانية</span><p>{selected.nisba_2}</p></div>}
              {selected.laqab && <div><span className="section-heading" style={{ fontSize: 11 }}>اللقب</span><p>{selected.laqab}</p></div>}
            </div>

            {/* Name variants */}
            <div style={{ marginBottom: "var(--space-5)" }}>
              <span className="section-heading">أشكال الاسم الموثقة</span>
              {variants.length === 0 ? (
                <p style={{ fontSize: 14, color: "var(--color-info)" }}>لا توجد أشكال مسجلة.</p>
              ) : (
                <table className="data-table" style={{ marginTop: "var(--space-3)" }}>
                  <thead>
                    <tr><th>المكتوب</th><th>المصدر</th></tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.id}>
                        <td>{v.written_form}</td>
                        <td style={{ fontSize: 13, color: "var(--color-info)" }}>
                          {v.source_annotation_id ? `تقييد #${v.source_annotation_id}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {selected.notes && (
              <div>
                <span className="section-heading">ملاحظات</span>
                <p style={{ fontSize: 14, maxWidth: 600 }}>{selected.notes}</p>
              </div>
            )}
          </>
        )}

        {!selected && !showForm && (
          <p className="empty-state">اختر شخصاً من القائمة أو أضف شخصاً جديداً</p>
        )}
      </div>
    </div>
  );
}
