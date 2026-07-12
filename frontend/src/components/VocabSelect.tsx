import { useEffect, useRef, useState } from "react";
import { vocabApi } from "../api";

interface Props {
  category: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

interface OrOtherProps extends Props {
  /** Vocab values to hide from the dropdown (e.g. work-level-only roles). */
  exclude?: string[];
  /** Placeholder for the free-text input shown after choosing "غير ذلك". */
  otherPlaceholder?: string;
}

export function VocabSelect({ category, value, onChange, placeholder, required, disabled, id }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const opts = await vocabApi.list(category);
        setOptions(opts);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [category]);

  return (
    <select
      id={id}
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading
        ? <option value="">جارٍ التحميل…</option>
        : <>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </>
      }
    </select>
  );
}

const OTHER_SENTINEL = "__other__";

/**
 * Like VocabSelect, but appends a "غير ذلك" option that reveals a free-text
 * input. The typed value is NOT added to the vocab table — see
 * docs/adr/0002-annotation-type-role-free-text-other.md.
 */
export function VocabSelectOrOther({ category, value, onChange, placeholder, required, disabled, id, exclude, otherPlaceholder }: OrOtherProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherMode, setOtherMode] = useState(false);
  const detectedInitialOther = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const opts = await vocabApi.list(category);
        if (cancelled) return;
        const visibleOpts = exclude ? opts.filter((o) => !exclude.includes(o)) : opts;
        setOptions(visibleOpts);
        if (!detectedInitialOther.current) {
          detectedInitialOther.current = true;
          if (value && !visibleOpts.includes(value)) setOtherMode(true);
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [category]);

  function handleSelectChange(v: string) {
    if (v === OTHER_SENTINEL) {
      setOtherMode(true);
      onChange("");
    } else {
      onChange(v);
    }
  }

  if (otherMode) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <input
          id={id}
          className="input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder ?? "اكتب القيمة…"}
          required={required}
          disabled={disabled}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          disabled={disabled}
          onClick={() => { setOtherMode(false); onChange(""); }}
        >
          القائمة
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      className="select"
      value={value}
      onChange={(e) => handleSelectChange(e.target.value)}
      required={required}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading
        ? <option value="">جارٍ التحميل…</option>
        : <>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
            <option value={OTHER_SENTINEL}>غير ذلك</option>
          </>
      }
    </select>
  );
}
