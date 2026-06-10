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

  useEffect(() => {
    vocabApi.list(category).then(setOptions).catch(() => setOptions([]));
  }, [category]);

  return (
    <select
      id={id}
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}
