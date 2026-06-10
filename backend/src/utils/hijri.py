"""Hijri date parsing: converts a free-text Hijri date string to
(date_earliest, date_latest) packed as YYYYMMDD integers.

Strategy: try several common Arabic date patterns. If nothing matches,
return the full-unknown bounds (0, 99991230).
"""
import re

# Arabic-Indic digit map
_ARABIC_INDIC = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

# Hijri month names → month number
_MONTH_NAMES: dict[str, int] = {
    "محرم": 1, "صفر": 2, "ربيع الأول": 3, "ربيع الثاني": 4,
    "ربيع 1": 3, "ربيع 2": 4,
    "جمادى الأولى": 5, "جمادى الأولى": 5, "جمادى الأول": 5,
    "جمادى الآخرة": 6, "جمادى الثانية": 6, "جمادى الثاني": 6,
    "رجب": 7, "شعبان": 8, "رمضان": 9,
    "شوال": 10, "ذو القعدة": 11, "ذي القعدة": 11,
    "ذو الحجة": 12, "ذي الحجة": 12,
}

_UNKNOWN = (0, 99991230)

# Hijri months have 29 or 30 days; use 30 as the safe upper bound
_LAST_DAY = 30


def _normalize_digits(s: str) -> str:
    return s.translate(_ARABIC_INDIC)


def _pack(year: int, month: int, day: int) -> int:
    return year * 10000 + month * 100 + day


def parse_hijri(date_as_written: str) -> tuple[int, int]:
    """Return (date_earliest, date_latest) as packed YYYYMMDD Hijri integers.

    Precision levels handled:
    - Year only         → (YYYY0101, YYYY1230)
    - Month + Year      → (YYYY MM 01, YYYY MM 30)
    - Day + Month + Year→ (YYYYMMDD, YYYYMMDD)
    - Unknown / no match→ (0, 99991230)
    """
    if not date_as_written:
        return _UNKNOWN

    text = _normalize_digits(date_as_written.strip())

    # Try day + month name + year, e.g. "12 رمضان 1200"
    for month_name, month_num in _MONTH_NAMES.items():
        pattern = rf"(\d{{1,2}})\s+{re.escape(month_name)}\s+(\d{{3,4}})"
        m = re.search(pattern, text)
        if m:
            day, year = int(m.group(1)), int(m.group(2))
            packed = _pack(year, month_num, day)
            return (packed, packed)

    # Try month name + year, e.g. "رمضان 1200"
    for month_name, month_num in _MONTH_NAMES.items():
        pattern = rf"{re.escape(month_name)}\s+(\d{{3,4}})"
        m = re.search(pattern, text)
        if m:
            year = int(m.group(1))
            return (_pack(year, month_num, 1), _pack(year, month_num, _LAST_DAY))

    # Try bare 3-4 digit year
    m = re.search(r"\b(\d{3,4})\b", text)
    if m:
        year = int(m.group(1))
        return (_pack(year, 1, 1), _pack(year, 12, _LAST_DAY))

    return _UNKNOWN
