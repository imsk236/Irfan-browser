interface HijriDateParts {
  year: number | null;
  month: string | null;
  day: number | null;
  weekday: string | null;
  time: string | null;
}

/** Formats a partial Hijri date (as used on تاريخ النسخ / تاريخ القيد) into one
 * display line, e.g. "الجمعة، ١٥ رمضان ١٤٤٠هـ، بعد العصر". Returns null when
 * every component is unrecorded. */
export function formatHijriDate({ year, month, day, weekday, time }: HijriDateParts): string | null {
  const datePart = [day, month, year != null ? `${year}هـ` : null].filter(Boolean).join(" ");
  const parts = [weekday, datePart || null, time].filter(Boolean);
  return parts.length > 0 ? parts.join("، ") : null;
}
