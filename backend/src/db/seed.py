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
    ("role", "منسوخ له", 8),
    # confidence
    ("confidence", "مؤكد", 1),
    ("confidence", "مرجح", 2),
    ("confidence", "محتمل", 3),
    # knowledge_source (مصدر المعرفة) — replaces evidence_source for work-level relationships
    ("knowledge_source", "المجلد", 1),
    ("knowledge_source", "مصدر خارجي", 2),
    ("knowledge_source", "المفهرس", 3),
    # annotation_type
    ("annotation_type", "تملك", 1),
    ("annotation_type", "وقف", 2),
    ("annotation_type", "إهداء", 3),
    ("annotation_type", "ولادة", 4),
    ("annotation_type", "وفاة", 5),
    # hijri_month (fixed 12 months)
    ("hijri_month", "محرم", 1),
    ("hijri_month", "صفر", 2),
    ("hijri_month", "ربيع الأول", 3),
    ("hijri_month", "ربيع الثاني", 4),
    ("hijri_month", "جمادى الأولى", 5),
    ("hijri_month", "جمادى الثانية", 6),
    ("hijri_month", "رجب", 7),
    ("hijri_month", "شعبان", 8),
    ("hijri_month", "رمضان", 9),
    ("hijri_month", "شوال", 10),
    ("hijri_month", "ذو القعدة", 11),
    ("hijri_month", "ذو الحجة", 12),
    # weekday (fixed 7 days)
    ("weekday", "الأحد", 1),
    ("weekday", "الاثنين", 2),
    ("weekday", "الثلاثاء", 3),
    ("weekday", "الأربعاء", 4),
    ("weekday", "الخميس", 5),
    ("weekday", "الجمعة", 6),
    ("weekday", "السبت", 7),
    # copy_time — admin-extendable, initial values
    ("copy_time", "وقت الفجر", 1),
    ("copy_time", "وقت الضحى", 2),
    ("copy_time", "وقت الظهر", 3),
    ("copy_time", "وقت العصر", 4),
    ("copy_time", "وقت المغرب", 5),
    ("copy_time", "وقت العشاء", 6),
    ("copy_time", "الليل", 7),
    # wilaya — Omani wilayat (61 wilayat, alphabetical)
    ("wilaya", "آدم", 1),
    ("wilaya", "إبراء", 2),
    ("wilaya", "إزكي", 3),
    ("wilaya", "البريمي", 4),
    ("wilaya", "بخاء", 5),
    ("wilaya", "بدبد", 6),
    ("wilaya", "بدية", 7),
    ("wilaya", "بركاء", 8),
    ("wilaya", "بهلاء", 9),
    ("wilaya", "بوشر", 10),
    ("wilaya", "ثمريت", 11),
    ("wilaya", "جعلان بني بو حسن", 12),
    ("wilaya", "جعلان بني بو علي", 13),
    ("wilaya", "الجازر", 14),
    ("wilaya", "الحمراء", 15),
    ("wilaya", "خصب", 16),
    ("wilaya", "الخابورة", 17),
    ("wilaya", "دبا", 18),
    ("wilaya", "دلكوت", 19),
    ("wilaya", "الدقم", 20),
    ("wilaya", "رخيوت", 21),
    ("wilaya", "الرستاق", 22),
    ("wilaya", "سدح", 23),
    ("wilaya", "سمائل", 24),
    ("wilaya", "السيب", 25),
    ("wilaya", "السنينة", 26),
    ("wilaya", "السويق", 27),
    ("wilaya", "شليم وجزر الحلانيات", 28),
    ("wilaya", "شناص", 29),
    ("wilaya", "صحار", 30),
    ("wilaya", "صحم", 31),
    ("wilaya", "صلالة", 32),
    ("wilaya", "صور", 33),
    ("wilaya", "ضماء والطائيين", 34),
    ("wilaya", "ضنك", 35),
    ("wilaya", "طاقة", 36),
    ("wilaya", "عبري", 37),
    ("wilaya", "العامرات", 38),
    ("wilaya", "العوابي", 39),
    ("wilaya", "قريات", 40),
    ("wilaya", "القابل", 41),
    ("wilaya", "الكامل والوافي", 42),
    ("wilaya", "لوى", 43),
    ("wilaya", "محضة", 44),
    ("wilaya", "محوت", 45),
    ("wilaya", "مرباط", 46),
    ("wilaya", "المزيونة", 47),
    ("wilaya", "مسقط", 48),
    ("wilaya", "المصنعة", 49),
    ("wilaya", "مصيرة", 50),
    ("wilaya", "مضحى", 51),
    ("wilaya", "المضيبي", 52),
    ("wilaya", "مطرح", 53),
    ("wilaya", "مقشن", 54),
    ("wilaya", "منح", 55),
    ("wilaya", "نخل", 56),
    ("wilaya", "نزوى", 57),
    ("wilaya", "هيماء", 58),
    ("wilaya", "وادي المعاول", 59),
    ("wilaya", "وادي بني خالد", 60),
    ("wilaya", "ينقل", 61),
    # person_identification_status
    ("person_identification_status", "معروف", 1),
    ("person_identification_status", "غير مكتمل التعريف", 2),
    ("person_identification_status", "مجهول", 3),
    ("person_identification_status", "يحتاج إلى مراجعة", 4),
]

# Categories that are no longer used in new data entry but kept for historical records
DEACTIVATED_CATEGORIES = {"repository_kind", "work_type", "date_precision", "evidence_source"}


def seed_vocab(engine: Engine) -> None:
    with engine.connect() as conn:
        # Wilaya list is canonical — delete and re-insert to fix stale/wrong entries
        conn.execute(text("DELETE FROM vocab WHERE category = 'wilaya'"))

        for category, value, sort_order in VOCAB_SEED:
            conn.execute(
                text(
                    "INSERT OR IGNORE INTO vocab (category, value, sort_order, is_active) "
                    "VALUES (:category, :value, :sort_order, 1)"
                ),
                {"category": category, "value": value, "sort_order": sort_order},
            )
        # Deactivate old categories so they don't appear in new-entry dropdowns
        for category in DEACTIVATED_CATEGORIES:
            conn.execute(
                text("UPDATE vocab SET is_active = 0 WHERE category = :category"),
                {"category": category},
            )
        conn.commit()
