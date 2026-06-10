import { useEffect, useRef, useState } from "react";
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
  /** If true, when the user selects a match, the typed spelling is saved as a name variant */
  saveVariant?: boolean;
}

export function PersonField({ label, value, onChange, saveVariant: _saveVariant }: Props) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PersonMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    if (value) onChange(null); // clear selection when typing again

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setCandidates([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await personsApi.search(q);
        setCandidates(results);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function selectCandidate(c: PersonMatch) {
    onChange({ person_id: c.person_id, preferred_name: c.preferred_name, written_form: query || c.written_form });
    setQuery(c.preferred_name);
    setCandidates([]);
    setOpen(false);
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
    } catch (err) {
      alert(String(err));
    }
  }

  return (
    <div className="field" ref={containerRef} style={{ position: "relative" }}>
      <label>{label}</label>
      <input
        className="input"
        type="text"
        value={value ? value.preferred_name : query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (candidates.length > 0) setOpen(true); }}
        placeholder="ابحث عن شخص أو أدخل اسماً جديداً…"
        autoComplete="off"
      />
      {loading && (
        <span style={{ position: "absolute", left: 10, top: "50%", fontSize: 12, color: "var(--color-info)" }}>
          …
        </span>
      )}
      {open && (
        <div className="match-dropdown">
          {candidates.map((c) => (
            <div key={c.person_id} className="match-item" onClick={() => selectCandidate(c)}>
              <span className="match-item-name">{c.preferred_name}</span>
              {c.written_form !== c.preferred_name && (
                <span className="match-item-hint">مكتوب: {c.written_form}</span>
              )}
            </div>
          ))}
          {query.trim() && (
            <div className="match-item create-new" onClick={createNew}>
              + إنشاء شخص جديد: «{query.trim()}»
            </div>
          )}
        </div>
      )}
    </div>
  );
}
