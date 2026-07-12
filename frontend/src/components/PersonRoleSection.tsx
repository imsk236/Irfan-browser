import { PersonField } from "./PersonField";
import { VocabSelectOrOther } from "./VocabSelect";
import { SOURCE_SENTINELS } from "../utils/workRoles";
import type { SourceSentinel } from "../utils/workRoles";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

/** Single-person role slot (المؤلف، الناسخ [before multi-ناسخ], منسوخ له). */
export function PersonRoleSection({
  roleLabel,
  required,
  existingName,
  replacing,
  onReplace,
  onCancelReplace,
  person,
  onPersonChange,
  unknown,
  onUnknownChange,
  source,
  onSourceChange,
  showCustom,
  onShowCustomChange,
  onRequestCreate,
  work,
}: {
  roleLabel: string;
  required: boolean;
  existingName: string | null;
  replacing: boolean;
  onReplace: () => void;
  onCancelReplace: () => void;
  person: SelectedPerson | null;
  onPersonChange: (p: SelectedPerson | null) => void;
  unknown: boolean;
  onUnknownChange: (v: boolean) => void;
  source: string;
  onSourceChange: (v: string) => void;
  showCustom: boolean;
  onShowCustomChange: (v: boolean) => void;
  onRequestCreate: (name: string) => void;
  work: unknown;
}) {
  const selectedOption = SOURCE_SENTINELS.includes(source as SourceSentinel)
    ? source
    : showCustom ? "مرجع آخر" : null;

  return (
    <div
      style={{
        marginBottom: "var(--space-4)",
        padding: "var(--space-3)",
        background: "var(--color-surface-muted)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-2)" }}>
        {roleLabel} {required && <span style={{ color: "var(--color-error)" }}>*</span>}
      </div>

      {existingName && !replacing ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14 }}>{existingName}</span>
          <button type="button" className="btn btn-secondary btn-compact" onClick={onReplace}>
            تغيير
          </button>
        </div>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: "var(--space-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={unknown}
              onChange={(e) => {
                onUnknownChange(e.target.checked);
                if (e.target.checked) onPersonChange(null);
              }}
            />
            مجهول
          </label>

          {!unknown && (
            <PersonField
              label={`من ${roleLabel}؟`}
              value={person}
              onChange={onPersonChange}
              saveVariant
              onRequestCreate={onRequestCreate}
            />
          )}

          {!unknown && person && (
            <div className="field" style={{ marginTop: "var(--space-3)" }}>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>مصدر الصلة</label>
              <div style={{ display: "flex", gap: "var(--space-5)", marginTop: "var(--space-1)" }}>
                {(["المخطوط", "المفهرس", "مرجع آخر"] as const).map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`source-${roleLabel}`}
                      checked={selectedOption === opt}
                      onChange={() => {
                        if (opt === "مرجع آخر") {
                          onShowCustomChange(true);
                          if (SOURCE_SENTINELS.includes(source as SourceSentinel)) {
                            onSourceChange("");
                          }
                        } else {
                          onShowCustomChange(false);
                          onSourceChange(opt);
                        }
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
              {showCustom && (
                <input
                  className="input"
                  type="text"
                  placeholder="اذكر المرجع…"
                  value={SOURCE_SENTINELS.includes(source as SourceSentinel) ? "" : source}
                  onChange={(e) => onSourceChange(e.target.value)}
                  style={{ marginTop: "var(--space-2)" }}
                  autoFocus
                />
              )}
            </div>
          )}

          {work && replacing && (
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              style={{ marginTop: "var(--space-2)" }}
              onClick={onCancelReplace}
            >
              إلغاء التغيير
            </button>
          )}
        </>
      )}
    </div>
  );
}

export interface PersonRoleListRow {
  key: string;
  relationshipId: number | null;
  person: SelectedPerson;
  role: string;
  source: string;
  onRemove: () => void;
}

function ListRow({ name, role, source, onRemove }: { name: string; role?: string; source: string; onRemove: () => void }) {
  return (
    <li
      style={{
        padding: "var(--space-2) 0",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
          <span
            style={{
              fontSize: "var(--font-size-body)",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          {role && (
            <span
              style={{
                flexShrink: 0,
                fontSize: "var(--font-size-meta)",
                color: "var(--color-text-muted)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: "1px 8px",
              }}
            >
              {role}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-danger btn-compact" style={{ flexShrink: 0 }} onClick={onRemove}>
          إزالة
        </button>
      </div>
      {source && (
        <div style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", marginTop: 2 }}>
          مصدر الصلة: {source}
        </div>
      )}
    </li>
  );
}

interface PersonRoleListSectionProps {
  sectionLabel: string;
  required: boolean;
  rows: PersonRoleListRow[];
  stagePerson: SelectedPerson | null;
  onStagePersonChange: (p: SelectedPerson | null) => void;
  /** Set for lists where every row has the same role (e.g. الناسخ) — hides the per-row role picker. */
  fixedRole?: string;
  /** Set for lists where each row picks its own role from a vocab category (e.g. المساهم). */
  roleVocabCategory?: string;
  stageRole: string;
  onStageRoleChange: (v: string) => void;
  stageSource: string;
  onStageSourceChange: (v: string) => void;
  stageShowCustomSource: boolean;
  onStageShowCustomSourceChange: (v: boolean) => void;
  personFieldKey: number;
  onAdd: () => void;
  addDisabled: boolean;
  addDisabledReason?: string;
  onRequestCreatePerson: (name: string) => void;
  /** Present only for lists that offer a مجهول fallback (e.g. الناسخ) — rendered only while the list is empty. */
  unknownOption?: { checked: boolean; onChange: (v: boolean) => void };
}

/** Multi-person role list (الناسخ [multi], المساهم) — add/remove rows, each with its own مصدر الصلة. */
export function PersonRoleListSection({
  sectionLabel,
  required,
  rows,
  stagePerson,
  onStagePersonChange,
  fixedRole,
  roleVocabCategory,
  stageRole,
  onStageRoleChange,
  stageSource,
  onStageSourceChange,
  stageShowCustomSource,
  onStageShowCustomSourceChange,
  personFieldKey,
  onAdd,
  addDisabled,
  addDisabledReason,
  onRequestCreatePerson,
  unknownOption,
}: PersonRoleListSectionProps) {
  const selectedSourceOption = SOURCE_SENTINELS.includes(stageSource as SourceSentinel)
    ? stageSource
    : stageShowCustomSource ? "مرجع آخر" : null;

  const showUnknownCheckbox = !!unknownOption && rows.length === 0;
  const hideAddUi = !!unknownOption?.checked;

  return (
    <div
      style={{
        marginBottom: "var(--space-4)",
        padding: "var(--space-3)",
        background: "var(--color-surface-muted)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-2)" }}>
        {sectionLabel} {required && <span style={{ color: "var(--color-error)" }}>*</span>}
      </div>

      {showUnknownCheckbox && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: "var(--space-2)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={unknownOption!.checked}
            onChange={(e) => unknownOption!.onChange(e.target.checked)}
          />
          مجهول
        </label>
      )}

      {!hideAddUi && (
        <>
          {rows.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, marginBottom: "var(--space-3)" }}>
              {rows.map((r) => (
                <ListRow
                  key={r.key}
                  name={r.person.preferred_name}
                  role={fixedRole ? undefined : r.role}
                  source={r.source}
                  onRemove={r.onRemove}
                />
              ))}
            </ul>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: fixedRole ? "1fr auto" : "2fr 1fr auto",
              gap: "var(--space-2)",
              alignItems: "end",
            }}
          >
            <div className="field" style={{ marginBottom: 0 }}>
              <PersonField
                key={personFieldKey}
                label={`من ${sectionLabel}؟`}
                value={stagePerson}
                onChange={onStagePersonChange}
                saveVariant
                onRequestCreate={onRequestCreatePerson}
              />
            </div>
            {!fixedRole && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>الدور</label>
                <VocabSelectOrOther
                  category={roleVocabCategory!}
                  value={stageRole}
                  onChange={onStageRoleChange}
                  placeholder="اختر الدور…"
                />
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              disabled={addDisabled}
              title={addDisabledReason}
              onClick={onAdd}
              style={{ marginBottom: 0 }}
            >
              إضافة
            </button>
          </div>

          {stagePerson && (
            <div className="field" style={{ marginTop: "var(--space-3)" }}>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>مصدر الصلة</label>
              <div style={{ display: "flex", gap: "var(--space-5)", marginTop: "var(--space-1)" }}>
                {(["المخطوط", "المفهرس", "مرجع آخر"] as const).map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`source-${sectionLabel}-stage`}
                      checked={selectedSourceOption === opt}
                      onChange={() => {
                        if (opt === "مرجع آخر") {
                          onStageShowCustomSourceChange(true);
                          if (SOURCE_SENTINELS.includes(stageSource as SourceSentinel)) onStageSourceChange("");
                        } else {
                          onStageShowCustomSourceChange(false);
                          onStageSourceChange(opt);
                        }
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
              {stageShowCustomSource && (
                <input
                  className="input"
                  type="text"
                  placeholder="اذكر المرجع…"
                  value={SOURCE_SENTINELS.includes(stageSource as SourceSentinel) ? "" : stageSource}
                  onChange={(e) => onStageSourceChange(e.target.value)}
                  style={{ marginTop: "var(--space-2)" }}
                  autoFocus
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
