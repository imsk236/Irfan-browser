import csv
import json
import os
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from ..db.engine import get_engine


def export_csv(output_dir: str) -> list[str]:
    """Write one CSV file per table to output_dir. Returns list of file paths."""
    engine = get_engine()
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    written: list[str] = []

    with engine.connect() as conn:
        for table_name in table_names:
            rows = conn.execute(text(f"SELECT * FROM {table_name}")).mappings().all()
            if not rows:
                continue
            file_path = os.path.join(output_dir, f"{table_name}.csv")
            with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            written.append(file_path)

    return written


def export_json(output_path: str) -> str:
    """Write a single JSON dump of all tables to output_path."""
    engine = get_engine()
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    dump: dict[str, list[dict]] = {}
    with engine.connect() as conn:
        for table_name in table_names:
            rows = conn.execute(text(f"SELECT * FROM {table_name}")).mappings().all()
            dump[table_name] = [dict(row) for row in rows]

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dump, f, ensure_ascii=False, indent=2)

    return output_path
