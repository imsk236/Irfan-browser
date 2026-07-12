"""
Generate a self-contained HTML catalog for printToPDF in Electron.
No external PDF library needed — Chromium renders it.
"""
import base64
import html
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

from ..db.engine import get_engine

_LOGO_PATH = Path(__file__).parent.parent / "assets" / "irfan_logo.png"


def _logo_data_uri() -> str:
    if _LOGO_PATH.exists():
        data = base64.b64encode(_LOGO_PATH.read_bytes()).decode()
        return f"data:image/png;base64,{data}"
    return ""


def _e(s) -> str:
    if s is None:
        return ""
    return html.escape(str(s))


def export_pdf_html(researcher_name: str = "") -> str:
    engine = get_engine()
    with engine.connect() as conn:
        volumes = list(conn.execute(text("""
            SELECT v.id, v.serial, v.folio_count, v.repository_volume_number, v.notes,
                   r.name AS repo_name
            FROM volumes v
            JOIN repositories r ON r.id = v.repository_id
            ORDER BY v.serial
        """)).mappings())

        works = list(conn.execute(text("""
            SELECT id, volume_id, title, topic_category, topic_subcategory,
                   copy_place, copy_date_as_written, copy_year, incipit
            FROM works
            ORDER BY volume_id, id
        """)).mappings())

        rels = list(conn.execute(text("""
            SELECT rel.volume_id, rel.work_id, rel.role, rel.level, p.preferred_name
            FROM person_relationships rel
            JOIN persons p ON p.id = rel.person_id
        """)).mappings())

        persons = list(conn.execute(text("""
            SELECT p.preferred_name, p.kunya, p.laqab,
                   p.birth_year_earliest, p.death_year_earliest,
                   GROUP_CONCAT(pw.wilaya, '، ') AS wilayas,
                   COUNT(DISTINCT rel.id) AS appearances
            FROM persons p
            LEFT JOIN person_wilayas pw ON pw.person_id = p.id
            LEFT JOIN person_relationships rel ON rel.person_id = p.id
            GROUP BY p.id
            ORDER BY p.preferred_name
        """)).mappings())

        stats = conn.execute(text("""
            SELECT
              (SELECT COUNT(*) FROM volumes) AS vol_count,
              (SELECT COUNT(*) FROM works)   AS work_count,
              (SELECT COUNT(*) FROM persons) AS person_count
        """)).mappings().one()

    works_by_vol: dict[int, list] = {}
    for w in works:
        works_by_vol.setdefault(w["volume_id"], []).append(w)

    copyist_by_work: dict[int, list[str]] = {}
    for rel in rels:
        if rel["role"] == "ناسخ" and rel["work_id"]:
            copyist_by_work.setdefault(rel["work_id"], []).append(rel["preferred_name"])

    persons_by_vol: dict[int, list] = {}
    for rel in rels:
        if rel["volume_id"]:
            persons_by_vol.setdefault(rel["volume_id"], []).append(rel)

    export_date = datetime.now().strftime("%Y-%m-%d")

    cards_html = "".join(
        _volume_card(vol, works_by_vol.get(vol["id"], []),
                     persons_by_vol.get(vol["id"], []), copyist_by_work)
        for vol in volumes
    )

    return _full_html(
        researcher_name=researcher_name,
        export_date=export_date,
        stats=stats,
        cards_html=cards_html,
        persons_html=_persons_table(persons),
    )


def _volume_card(vol, works, persons, copyist_by_work: dict) -> str:
    serial = _e(vol["serial"])
    repo = _e(vol["repo_name"])

    meta_parts = []
    if vol["folio_count"]:
        meta_parts.append(f"عدد الأوراق: {_e(vol['folio_count'])}")
    if vol["repository_volume_number"]:
        meta_parts.append(f"رقم المجلد في الخزانة: {_e(vol['repository_volume_number'])}")
    meta_html = f'<div class="card-meta">{" &nbsp;·&nbsp; ".join(meta_parts)}</div>' if meta_parts else ""

    # Works
    work_items = ""
    for i, w in enumerate(works, 1):
        details = []
        if w["topic_category"]:
            cat = _e(w["topic_category"])
            if w["topic_subcategory"]:
                cat += f" / {_e(w['topic_subcategory'])}"
            details.append(f"الموضوع: {cat}")
        if w["copy_date_as_written"]:
            details.append(f"النسخ: {_e(w['copy_date_as_written'])}")
        elif w["copy_year"]:
            details.append(f"النسخ: {_e(w['copy_year'])}")
        if w["copy_place"]:
            details.append(f"المكان: {_e(w['copy_place'])}")
        copyists = copyist_by_work.get(w["id"])
        if copyists:
            details.append(f"الناسخ: {_e('، '.join(copyists))}")

        detail_html = f'<div class="work-details">{" &nbsp;·&nbsp; ".join(details)}</div>' if details else ""

        incipit_text = w["incipit"] or ""
        incipit_html = ""
        if incipit_text:
            snippet = incipit_text[:120] + ("…" if len(incipit_text) > 120 else "")
            incipit_html = f'<div class="incipit">{_e(snippet)}</div>'

        work_items += f"""
        <div class="work-item">
          <span class="work-num">{i}</span>
          <div class="work-body">
            <div class="work-title">{_e(w['title'])}</div>
            {detail_html}{incipit_html}
          </div>
        </div>"""

    works_section = (
        f'<div class="works-section"><div class="section-label">المصنَّفات</div>{work_items}</div>'
        if work_items else ""
    )

    # Persons (deduplicated)
    seen: set = set()
    tags = ""
    for rel in persons:
        key = (rel["preferred_name"], rel["role"])
        if key not in seen:
            seen.add(key)
            tags += f'<span class="person-tag">{_e(rel["preferred_name"])} <span class="role-badge">{_e(rel["role"])}</span></span>'

    persons_section = (
        f'<div class="persons-section"><div class="section-label">الأشخاص</div>'
        f'<div class="persons-list">{tags}</div></div>'
        if tags else ""
    )

    notes_html = f'<div class="vol-notes">{_e(vol["notes"])}</div>' if vol["notes"] else ""

    return f"""
<div class="volume-card">
  <div class="card-header">
    <span class="serial">{serial}</span>
    <span class="repo-name">{repo}</span>
  </div>
  {meta_html}
  {works_section}
  {persons_section}
  {notes_html}
</div>"""


def _persons_table(persons) -> str:
    rows = ""
    for i, p in enumerate(persons):
        alt = ' class="alt"' if i % 2 == 1 else ""
        birth = _e(p["birth_year_earliest"]) or "—"
        death = _e(p["death_year_earliest"]) or "—"
        rows += (
            f'<tr{alt}>'
            f'<td>{_e(p["preferred_name"])}</td>'
            f'<td>{_e(p["kunya"])}</td>'
            f'<td>{_e(p["laqab"])}</td>'
            f'<td class="num">{birth}</td>'
            f'<td class="num">{death}</td>'
            f'<td>{_e(p["wilayas"])}</td>'
            f'<td class="num">{p["appearances"] or 0}</td>'
            f'</tr>'
        )

    return f"""
<div class="persons-index">
  <h2 class="index-title">فهرس الأشخاص</h2>
  <table class="persons-table">
    <thead>
      <tr>
        <th>الاسم المعتمد</th><th>الكنية</th><th>اللقب</th>
        <th>الميلاد</th><th>الوفاة</th><th>الولايات</th><th>الظهورات</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
</div>"""


_CSS = """
@page { size: A4; margin: 18mm 20mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'IBM Plex Sans Arabic', Arial, sans-serif;
  direction: rtl;
  font-size: 10pt;
  color: #1a1a1a;
  background: white;
  line-height: 1.55;
}

/* ── Cover ── */
.cover {
  page-break-after: always;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 90vh;
  text-align: center;
  gap: 10px;
  padding: 40px;
}
.cover-logo {
  font-size: 80pt;
  color: #2D3B2D;
  font-weight: 600;
  line-height: 1;
  margin-bottom: 6px;
}
.cover-logo-img {
  width: 130px;
  height: 130px;
  object-fit: contain;
  margin-bottom: 6px;
}
.cover-title-ar {
  font-size: 26pt;
  font-weight: 600;
  color: #2D3B2D;
}
.cover-title-en {
  font-size: 13pt;
  font-weight: 300;
  color: #666;
  letter-spacing: 0.12em;
  margin-bottom: 20px;
}
.cover-researcher {
  font-size: 13pt;
  color: #333;
  border-top: 2px solid #2D3B2D;
  border-bottom: 2px solid #2D3B2D;
  padding: 8px 40px;
  margin: 10px 0;
}
.cover-date { font-size: 10pt; color: #777; }
.cover-stats {
  font-size: 12pt;
  color: #444;
  display: flex;
  gap: 18px;
  align-items: center;
  margin-top: 10px;
}
.dot { color: #2D3B2D; font-weight: 600; }

/* ── Section headings ── */
.catalog-title, .index-title {
  font-size: 15pt;
  font-weight: 600;
  color: #2D3B2D;
  border-bottom: 2px solid #2D3B2D;
  padding-bottom: 4px;
  margin-bottom: 6mm;
  page-break-after: avoid;
}
.catalog-section { padding-top: 4mm; }

/* ── Volume card ── */
.volume-card {
  page-break-inside: avoid;
  border: 1px solid #c8c3b8;
  border-radius: 3px;
  margin-bottom: 5mm;
  overflow: hidden;
}
.card-header {
  background: #2D3B2D;
  color: white;
  padding: 4px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.serial {
  font-size: 11.5pt;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.repo-name { font-size: 8.5pt; opacity: 0.8; }
.card-meta {
  background: #f7f5ef;
  padding: 3px 10px;
  font-size: 8.5pt;
  color: #555;
  border-bottom: 1px solid #e0ddd5;
}

/* ── Works ── */
.works-section { padding: 5px 10px 4px; }
.section-label {
  font-size: 8pt;
  font-weight: 600;
  color: #2D3B2D;
  letter-spacing: 0.05em;
  margin-bottom: 3px;
  border-bottom: 1px solid #e8e4dc;
  padding-bottom: 2px;
  text-transform: uppercase;
}
.work-item {
  display: flex;
  gap: 6px;
  padding: 2px 0;
  align-items: flex-start;
}
.work-num { font-size: 8pt; color: #999; min-width: 14px; padding-top: 1px; }
.work-title { font-size: 9.5pt; font-weight: 500; }
.work-details { font-size: 8pt; color: #555; margin-top: 1px; }
.incipit { font-size: 7.5pt; color: #888; margin-top: 1px; font-style: italic; }

/* ── Persons ── */
.persons-section {
  padding: 4px 10px 5px;
  background: #faf9f5;
  border-top: 1px solid #e8e4dc;
}
.persons-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.person-tag {
  background: white;
  border: 1px solid #c8c3b8;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 8pt;
  white-space: nowrap;
}
.role-badge {
  color: #4A5E4A;
  font-size: 7pt;
  margin-inline-start: 3px;
}
.vol-notes {
  padding: 3px 10px;
  font-size: 8pt;
  color: #666;
  border-top: 1px dashed #e0ddd5;
  background: #fdfcf8;
}

/* ── Persons index ── */
.persons-index { page-break-before: always; }
.persons-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
}
.persons-table thead tr { background: #2D3B2D; color: white; }
.persons-table th, .persons-table td {
  padding: 4px 7px;
  border: 1px solid #d0ccc4;
  text-align: right;
}
.persons-table .num { text-align: center; }
.persons-table tbody tr.alt { background: #f7f5ef; }
"""


def _full_html(researcher_name: str, export_date: str, stats, cards_html: str, persons_html: str) -> str:
    researcher_html = (
        f'<div class="cover-researcher">{_e(researcher_name)}</div>'
        if researcher_name else ""
    )
    logo_uri = _logo_data_uri()
    logo_html = (
        f'<img class="cover-logo-img" src="{logo_uri}" alt="شعار أرشيف عرفان">'
        if logo_uri else '<div class="cover-logo">ع</div>'
    )
    return f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>{_CSS}</style>
</head>
<body>

<div class="cover">
  {logo_html}
  <h1 class="cover-title-ar">أرشيف عرفان للمخطوطات</h1>
  <h2 class="cover-title-en">IRFAN ARCHIVE OF MANUSCRIPTS</h2>
  {researcher_html}
  <div class="cover-date">{_e(export_date)}</div>
  <div class="cover-stats">
    <span>{stats['vol_count']} مجلداً</span>
    <span class="dot">·</span>
    <span>{stats['work_count']} مصنَّفاً</span>
    <span class="dot">·</span>
    <span>{stats['person_count']} شخصاً</span>
  </div>
</div>

<div class="catalog-section">
  <h2 class="catalog-title">فهرس المجلدات</h2>
  {cards_html}
</div>

{persons_html}

</body>
</html>"""
