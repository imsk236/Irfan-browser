from sqlalchemy import Engine, text

VOCAB_SEED = [
    # role
    ("role", "مؤلف", 1),
    ("role", "ناسخ", 2),
    ("role", "مالك", 3),
    ("role", "مستعير", 4),
    ("role", "واقف", 5),
    ("role", "مقيّد", 6),
    ("role", "مذكور", 7),
    # confidence
    ("confidence", "مؤكد", 1),
    ("confidence", "مرجح", 2),
    ("confidence", "محتمل", 3),
    # evidence_source
    ("evidence_source", "قيد الفراغ", 1),
    ("evidence_source", "ظهرية الكتاب", 2),
    ("evidence_source", "تحليل الخط", 3),
    ("evidence_source", "قيد", 4),
    # work_type
    ("work_type", "كتاب", 1),
    ("work_type", "رسالة", 2),
    ("work_type", "قصيدة", 3),
    ("work_type", "فتوى", 4),
    # annotation_type
    ("annotation_type", "تملك", 1),
    ("annotation_type", "وقف", 2),
    ("annotation_type", "إهداء", 3),
    ("annotation_type", "ولادة", 4),
    ("annotation_type", "وفاة", 5),
    # date_precision
    ("date_precision", "يوم", 1),
    ("date_precision", "شهر", 2),
    ("date_precision", "سنة", 3),
    ("date_precision", "عقد", 4),
    ("date_precision", "قرن", 5),
    ("date_precision", "مجهول", 6),
    # repository_kind
    ("repository_kind", "مؤسسة", 1),
    ("repository_kind", "مكتبة شخصية", 2),
]


def seed_vocab(engine: Engine) -> None:
    with engine.connect() as conn:
        for category, value, sort_order in VOCAB_SEED:
            conn.execute(
                text(
                    "INSERT OR IGNORE INTO vocab (category, value, sort_order, is_active) "
                    "VALUES (:category, :value, :sort_order, 1)"
                ),
                {"category": category, "value": value, "sort_order": sort_order},
            )
        conn.commit()
