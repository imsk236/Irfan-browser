import { useEffect, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  folioCount?: number | null;
}

function parseFolio(value: string): { num: string; side: "ي" | "س" } {
  if (!value) return { num: "", side: "ي" };
  const m = value.match(/^(\d+)([يس])$/);
  if (m) return { num: m[1], side: m[2] as "ي" | "س" };
  const numOnly = value.match(/^(\d+)$/);
  if (numOnly) return { num: numOnly[1], side: "ي" };
  return { num: "", side: "ي" };
}

export function FolioInput({ value, onChange, folioCount }: Props) {
  const [num, setNum] = useState(() => parseFolio(value).num);
  const [side, setSide] = useState<"ي" | "س">(() => parseFolio(value).side);

  useEffect(() => {
    const parsed = parseFolio(value);
    setNum(parsed.num);
    setSide(parsed.side);
  }, [value]);

  function handleNumChange(n: string) {
    setNum(n);
    onChange(n ? `${n}${side}` : "");
  }

  function handleSideChange(s: "ي" | "س") {
    setSide(s);
    if (num) onChange(`${num}${s}`);
  }

  const numInt = parseInt(num);
  const overCap = !!folioCount && !!num && !isNaN(numInt) && numInt > folioCount;

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          className="input"
          type="number"
          min="1"
          value={num}
          onChange={(e) => handleNumChange(e.target.value)}
          style={{ width: 80, borderColor: overCap ? "var(--color-error)" : undefined }}
        />
        <select
          className="select"
          value={side}
          onChange={(e) => handleSideChange(e.target.value as "ي" | "س")}
          disabled={!num}
          style={{ width: 90, opacity: !num ? 0.4 : 1 }}
        >
          <option value="ي">يمين</option>
          <option value="س">يسار</option>
        </select>
      </div>
      {overCap && (
        <span style={{ color: "var(--color-error)", fontSize: 12 }}>
          يتجاوز عدد الأوراق ({folioCount})
        </span>
      )}
    </div>
  );
}
