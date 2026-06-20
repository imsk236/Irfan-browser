interface Props {
  value: string;
}

const CONFIDENCE_CONFIG: Record<string, { dots: number }> = {
  "مؤكد":  { dots: 3 },
  "مرجح":  { dots: 2 },
  "محتمل": { dots: 1 },
};

export function ConfidenceTag({ value }: Props) {
  const config = CONFIDENCE_CONFIG[value] ?? { dots: 0 };
  return (
    <span className="confidence-tag" aria-label={`الثقة: ${value}`}>
      <span className="confidence-dots" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`confidence-dot ${n <= config.dots ? "filled" : "empty"}`}
          />
        ))}
      </span>
      <span className="confidence-label">{value}</span>
    </span>
  );
}
