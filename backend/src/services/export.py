import csv
import json
import os
import sys
from pathlib import Path
from sqlalchemy import inspect, text
from ..db.engine import get_engine

_SENSITIVE_DIRS_WINDOWS = [
    Path(r"C:\Windows"),
    Path(r"C:\Program Files"),
    Path(r"C:\Program Files (x86)"),
    Path(r"C:\ProgramData"),
    Path(r"C:\System Volume Information"),
]

_SENSITIVE_DIRS_POSIX = [
    Path("/etc"), Path("/sys"), Path("/proc"),
    Path("/usr"), Path("/bin"), Path("/sbin"), Path("/dev"), Path("/boot"),
]


def validate_export_path(output_dir: str) -> Path:
    """Normalize and validate an export path.

    Raises ValueError (Arabic) for empty, non-absolute-after-resolve, or
    system-sensitive paths.
    """
    if not output_dir or not output_dir.strip():
        raise ValueError("مسار التصدير لا يمكن أن يكون فارغاً")

    path = Path(output_dir.strip()).resolve()

    sensitive = (
        _SENSITIVE_DIRS_WINDOWS if sys.platform == "win32" else _SENSITIVE_DIRS_POSIX
    )
    for blocked in sensitive:
        if path == blocked or path.is_relative_to(blocked):
            raise ValueError("لا يمكن التصدير إلى مسار النظام الحساس")

    return path


def export_csv(output_dir: str) -> list[str]:
    """Write one CSV file per table to output_dir. Returns list of file paths."""
    path = validate_export_path(output_dir)
    engine = get_engine()
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    path.mkdir(parents=True, exist_ok=True)
    written: list[str] = []

    with engine.connect() as conn:
        for table_name in table_names:
            rows = conn.execute(text(f"SELECT * FROM {table_name}")).mappings().all()
            if not rows:
                continue
            file_path = os.path.join(str(path), f"{table_name}.csv")
            with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            written.append(file_path)

    return written


def export_json(output_path: str) -> str:
    """Write a single JSON dump of all tables to output_path."""
    if not output_path or not output_path.strip():
        raise ValueError("مسار التصدير لا يمكن أن يكون فارغاً")

    resolved = Path(output_path.strip()).resolve()
    validate_export_path(str(resolved.parent))

    engine = get_engine()
    inspector = inspect(engine)
    _skip = {"alembic_version"}
    table_names = [t for t in inspector.get_table_names() if t not in _skip]

    dump: dict[str, list[dict]] = {}
    with engine.connect() as conn:
        for table_name in table_names:
            rows = conn.execute(text(f"SELECT * FROM {table_name}")).mappings().all()
            dump[table_name] = [dict(row) for row in rows]

    resolved.parent.mkdir(parents=True, exist_ok=True)
    with open(str(resolved), "w", encoding="utf-8") as f:
        json.dump(dump, f, ensure_ascii=False, indent=2)

    return str(resolved)
