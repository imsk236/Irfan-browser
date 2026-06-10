interface Props {
  value: string;
}

const CLASS_MAP: Record<string, string> = {
  "مؤكد": "confirmed",
  "مرجح": "probable",
  "محتمل": "possible",
};

export function ConfidenceTag({ value }: Props) {
  const cls = CLASS_MAP[value] ?? "";
  return <span className={`confidence ${cls}`}>{value}</span>;
}
