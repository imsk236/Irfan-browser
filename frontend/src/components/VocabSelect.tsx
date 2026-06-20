import { useEffect, useState } from "react";
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
