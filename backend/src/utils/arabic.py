import re
import unicodedata

# Arabic diacritic codepoints (tashkeel) + tatweel
_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭـ]")

# Hamza variants → bare alef
_HAMZA_MAP = str.maketrans("أإآٱ", "اااا")

# taa marbuta → haa
_TAA_MARBUTA = str.maketrans("ة", "ه")

# alef maqsura → yaa
_ALEF_MAQSURA = str.maketrans("ى", "ي")


def normalize_arabic(text: str) -> str:
    """Return a search-only normalized form of an Arabic string.

    Strips diacritics and tatweel, unifies hamza forms, maps ة→ه and ى→ي.
    The result is used exclusively for matching and ranking — it is never
    displayed and never replaces the original written form.
    """
    if not text:
        return ""
    text = _DIACRITICS.sub("", text)
    text = text.translate(_HAMZA_MAP)
    text = text.translate(_TAA_MARBUTA)
    text = text.translate(_ALEF_MAQSURA)
    # strip any remaining combining marks (general category Mn)
    text = "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")
    return text.strip()
