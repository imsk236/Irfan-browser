import { useEffect, useId, useRef, useState } from "react";
import { personsApi } from "../api";
import type { PersonMatch } from "../api/types";

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

interface Props {
  label: string;
  value: SelectedPerson | null;
  onChange: (person: SelectedPerson | null) => void;
  /** When true: if the typed spelling differs from preferred_name, save it as a name variant */
  saveVariant?: boolean;
  /** When provided, fires instead of inline quick-create — lets the parent open the full person form */
  onRequestCreate?: (name: string) => void;
}

export function PersonField({ label, value, onChange, saveVariant, onRequestCreate }: Props) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PersonMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingNew(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    setSearchError(null);
    setConfirmingNew(false);
    setActiveIndex(-1);
    if (value) onChange(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setCandidates([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await personsApi.search(q);
        setCandidates(results);
        setOpen(true);
      } catch {
        setCandidates([]);
        setSearchError('تعذّر البحث، حاول مرة أخرى');
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  async function selectCandidate(c: PersonMatch) {
    if (saveVariant && query.trim() && query.trim() !== c.preferred_name) {
      try {
        await personsApi.addVariant(c.person_id, { written_form: query.trim() });
      } catch {
        // Variant save is best-effort; do not block selection
      }
    }
    onChange({
      person_id: c.person_id,
      preferred_name: c.preferred_name,
      written_form: query || c.written_form,
    });
    setQuery(c.preferred_name);
    setCandidates([]);
    setOpen(false);
    setActiveIndex(-1);
    setConfirmingNew(false);
  }

  async function createNew() {
    const name = query.trim();
    if (!name) return;
    try {
      const person = await personsApi.create({ preferred_name: name });
      onChange({ person_id: person.id, preferred_name: person.preferred_name, written_form: name });
      setQuery(person.preferred_name);
      setCandidates([]);
      setOpen(false);
      setActiveIndex(-1);
      setConfirmingNew(false);
    } catch (err) {
      alert(String(err));
    }
  }

  function handleConfirmedCreate() {
    const name = query.trim();
    if (!name) return;
    if (onRequestCreate) {
      setOpen(false);
      setCandidates([]);
      setConfirmingNew(false);
      setActiveIndex(-1);
      onRequestCreate(name);
    } else {
      createNew();
    }
  }

  function handleCreateNewClick() {
    // Require explicit confirmation when candidates exist
    if (candidates.length > 0 && !confirmingNew) {
      setConfirmingNew(true);
    } else {
      handleConfirmedCreate();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    const total = candidates.length + (query.trim() ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < candidates.length) {
        selectCandidate(candidates[activeIndex]);
      } else if (activeIndex === candidates.length && query.trim()) {
        handleCreateNewClick();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setConfirmingNew(false);
      setActiveIndex(-1);
    }
  }

  const displayValue = value ? value.preferred_name : query;

  return (
    <div className="field" ref={containerRef} style={{ position: "relative" }}>
      <label htmlFor={`${listboxId}-input`}>{label}</label>
      <input
        id={`${listboxId}-input`}
        className="input"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        value={displayValue}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          if (candidates.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="ابحث عن شخص أو أدخل اسماً جديداً…"
        autoComplete="off"
        aria-label={label}
      />

      {searchError && (
        <p style={{ margin: 0, marginTop: 'var(--space-1)', fontSize: 'var(--font-size-meta)', color: 'var(--color-error)' }}>
          {searchError}
        </p>
      )}

      {loading && (
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-25%)",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
          aria-live="polite"
        >
          …
        </span>
      )}

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`نتائج البحث عن ${label}`}
          className="match-dropdown"
        >
          {candidates.map((c, i) => (
            <div
              key={c.person_id}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={activeIndex === i}
              className={`match-item ${activeIndex === i ? "active-option" : ""}`}
              onClick={() => selectCandidate(c)}
            >
              <span className="match-item-name">{c.preferred_name}</span>
              {c.written_form !== c.preferred_name && (
                <span className="match-item-hint">مكتوب: {c.written_form}</span>
              )}
            </div>
          ))}

          {query.trim() && (
            confirmingNew ? (
              <div
                id={`${listboxId}-opt-${candidates.length}`}
                className="match-item confirm-new"
                aria-selected={activeIndex === candidates.length}
              >
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                  هل أنت متأكد أن لا أحد من النتائج أعلاه يطابق الشخص المقصود؟
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-compact"
                    onClick={handleConfirmedCreate}
                  >
                    نعم، أنشئ شخصاً جديداً
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => setConfirmingNew(false)}
                  >
                    مراجعة النتائج
                  </button>
                </div>
              </div>
            ) : (
              <div
                id={`${listboxId}-opt-${candidates.length}`}
                role="option"
                aria-selected={activeIndex === candidates.length}
                className={`match-item create-new ${activeIndex === candidates.length ? "active-option" : ""}`}
                onClick={handleCreateNewClick}
              >
                + إنشاء شخص جديد: «{query.trim()}»
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
