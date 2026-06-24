#!/usr/bin/env python3
"""
seed_mock.py — Populates the manuscript archive with realistic Arabic mock data.
Run from the project root AFTER starting the full dev stack (npm run dev).
"""

import random
import sys

import requests

# Force UTF-8 output so Arabic prints correctly on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

random.seed(42)

BASE = "http://localhost:8765"

# ── Data pools ───────────────────────────────────────────────────────────────

REPOS = [
    {
        "place_key": "0001",
        "name": "خزانة مسقط الملكية",
        "location": "مسقط",
        "notes": "تضم مجموعة نفيسة من المخطوطات العُمانية",
    },
    {
        "place_key": "0002",
        "name": "مكتبة نزوى الخطية",
        "location": "نزوى",
        "notes": "خزانة عريقة تعود إلى القرن الثاني عشر الهجري",
    },
    {
        "place_key": "0003",
        "name": "دار المخطوطات العُمانية",
        "location": "صلالة",
        "notes": "تختص بمخطوطات جنوب الجزيرة العربية",
    },
]

VOL_NOTES = [
    "نسخة جيدة الخط",
    "بها بعض التلف في الأوراق الأولى",
    "مجلد مجموع يحتوي على عدة رسائل",
    "خط مغربي واضح",
    "أوراق متفرقة مرقمة حديثاً",
    "بعض الأوراق مطموسة",
    "نسخة كاملة في حالة جيدة",
    "مصلحة ومرمّمة في القرن الرابع عشر",
    "حواشي وتعليقات بخط مختلف",
    "نسخة مفهرسة في فهرس المكتبة القديم",
]

TITLES = {
    "فقه": [
        "كتاب في الطهارة والصلاة",
        "رسالة في أحكام الزكاة",
        "مختصر في الفرائض",
        "مسائل في البيوع والمعاملات",
        "الإيضاح في الفقه الإباضي",
        "منهج الطالبين",
        "شرح النيل",
        "رسالة في أحكام الصيام",
        "مختصر في الوصايا والمواريث",
        "الجامع في الفقه",
        "أجوبة المسائل الفقهية",
        "رسالة في الحج والعمرة",
        "أحكام النكاح والطلاق",
        "المختصر الكافي في الفقه",
        "تحفة الأحوذي في الفقه",
    ],
    "تفسير": [
        "تفسير سورة الكهف",
        "مختصر في علوم القرآن",
        "رسالة في الناسخ والمنسوخ",
        "البيان في تفسير القرآن",
        "تفسير الآيات المشكلة",
        "رسالة في المحكم والمتشابه",
        "إعجاز القرآن الكريم",
        "مختصر في التفسير الموضوعي",
    ],
    "نحو": [
        "رسالة في الإعراب",
        "شرح الآجرومية",
        "مختصر في علم الصرف",
        "الكافية في النحو",
        "شرح ألفية ابن مالك",
        "رسالة في التصريف",
        "مقدمة في النحو والصرف",
        "الفوائد النحوية",
    ],
    "تصوف": [
        "رسالة في السلوك",
        "آداب المريد",
        "منازل السائرين",
        "التذكرة في أحوال الآخرة",
        "مراقي السعادة",
        "رسالة في التوحيد والزهد",
        "منهج العارفين",
        "الأنوار الربانية",
    ],
    "تاريخ": [
        "تاريخ عُمان",
        "سير الأئمة العُمانيين",
        "ذكر أعيان العلماء",
        "طبقات الفقهاء",
        "أخبار الأئمة والولاة",
        "تراجم علماء عُمان",
        "حوادث ووقائع تاريخية",
        "ذيل السير والتراجم",
    ],
    "فلك": [
        "رسالة في معرفة الأوقات",
        "زيج الكواكب",
        "مختصر في الحساب",
        "الفرائض الحسابية",
        "رسالة في القبلة والمواقيت",
        "أحكام النجوم",
        "رسالة في علم الهيئة",
    ],
    "أصول": [
        "رسالة في أصول الفقه",
        "مختصر في علم الكلام",
        "الدليل والبرهان",
        "إيجاز الأدلة",
        "مقدمة في الأصول",
        "رسالة في القياس والاستدلال",
        "الأصول المعتمدة",
    ],
    "أدب": [
        "ديوان شعر عُماني",
        "رسالة في اللغة",
        "مختارات من الشعر العربي",
        "جمع الجوامع",
        "رسائل أدبية",
        "شرح الديوان",
        "مختارات من الأدب العربي",
        "الرسائل الإخوانية",
    ],
}

INCIPITS = [
    "بسم الله الرحمن الرحيم، أما بعد فهذا مختصر في علم جليل القدر عظيم النفع.",
    "بسم الله الرحمن الرحيم، أما بعد فيقول العبد الفقير إلى رحمة ربه القدير.",
    "بسم الله الرحمن الرحيم، أما بعد فقد سألني بعض الإخوان أن أجمع لهم رسالة في هذا الفن.",
    "بسم الله الرحمن الرحيم، أما بعد فهذه مسائل مختصرة في الباب المذكور.",
    "بسم الله الرحمن الرحيم، أما بعد فإن العلم أشرف ما اكتسبه الإنسان وأعلى ما به يُزدان.",
    "الحمد لله رب العالمين والصلاة والسلام على أشرف المرسلين، أما بعد فهذا كتاب مختصر.",
    "الحمد لله رب العالمين وبعد فهذه رسالة في المسائل التي يحتاج إليها طالب العلم.",
    "الحمد لله رب العالمين، وبعد فيقول المؤلف وفقه الله تعالى في هذا الباب.",
    "الحمد لله حمداً كثيراً، أما بعد فقد أردت أن أذكر في هذه الرسالة ما يتعلق بهذا العلم.",
    "الحمد لله الذي علّم الإنسان ما لم يعلم، أما بعد فهذا مختصر نافع في فنه.",
]

COPY_PLACES = [
    "نزوى", "مسقط", "صحار", "بهلاء", "الرستاق",
    "منح", "إزكي", "سمائل", "عبري", "القابل", "صور",
]

COPY_DATES_AS_WRITTEN = [
    "في شهر رجب من سنة ألف ومائتين وأربع وثلاثين",
    "في أواخر شعبان سنة ألف ومائة وسبع وثمانين",
    "في العشر الأوسط من محرم سنة ألف وثلاثمائة واثنين",
    "في غرة ذي القعدة سنة ألف وثلاثمائة وعشرين",
    "في نهاية ربيع الأول سنة ألف ومائتين وستين",
    "في شهر صفر المبارك سنة تسعمائة وخمس وستين",
    "في ليلة الجمعة من جمادى الآخرة سنة ألف وثلاثمائة وسبع",
    "في منتصف رمضان المعظم سنة ألف وستة وسبعين",
]

FIRST_NAMES = [
    "سعيد", "محمد", "عبدالله", "خلفان", "ناصر", "أحمد", "سليمان", "راشد",
    "حمد", "عامر", "موسى", "يوسف", "صالح", "نور الدين", "بدر الدين",
    "جمال الدين", "نجم الدين", "زين العابدين", "عبد العزيز", "علي",
    "إبراهيم", "عمر", "حمود", "سيف", "هلال",
]

NISBAS = [
    "الخليلي", "السالمي", "الإزكوي", "البهري", "النبهاني", "البوسعيدي",
    "الرشيدي", "الرقيشي", "المحروقي", "السيابي", "الحارثي", "الرواحي",
    "الكندي", "العبري", "المعمري", "الهاشمي", "الصوافي", "المنذري",
    "العلوي", "اليحمدي",
]

KUNYAS = [
    "أبو عبدالله", "أبو سعيد", "أبو يوسف", "أبو محمد",
    "أبو إسحاق", "أبو بكر", "أبو الفضل", "أبو علي",
]

LAQABS = [
    "العلامة", "الشيخ", "الإمام", "الحافظ",
    "الفقيه", "القاضي", "المفتي", "الزاهد",
]

SCHOLAR_PLACES = [
    "نزوى", "مسقط", "بهلاء", "الرستاق",
    "صحار", "إزكي", "سمائل", "منح", "عبري",
]

PERSON_NOTES = [
    "من أبرز علماء القرن الثاني عشر الهجري",
    "تتلمذ على يد عدد من كبار العلماء",
    "له مؤلفات عديدة في الفقه الإباضي",
    "اشتهر بحسن الخط والضبط",
    "رحل إلى المغرب وأخذ العلم عن علمائها",
    "من علماء القرن الثالث عشر الهجري المشهورين",
    "أخذ العلم عن شيوخ نزوى والرستاق",
    "عُرف بسعة العلم وحسن التعليم",
    "له إجازات من عدد من العلماء",
    "نشأ في بيت علم وفضل",
]

COPYIST_NOTES = [
    "ناسخ ماهر عمل في خزانة مسقط الملكية، يتميز خطه بالوضوح والإتقان",
    "ناسخ محترف عمل في مكتبة نزوى الخطية، يُعرف بدقة نسخه وجودة خطه",
    "كاتب متمكن عمل في دار المخطوطات العُمانية، يتسم خطه بالثبات والوضوح",
    "من المشهورين بحسن الخط، نسخ كثيراً من الكتب لخزانات عُمان",
    "ناسخ متمكن عُرف بإتقان الخط الأندلسي والمغربي",
    "خطاط ماهر تتلمذ على يد أساتذة الخط في نزوى",
    "ناسخ محترف اشتهر بنسخ كتب الفقه الإباضي",
    "من أهل الصنعة في الخط، نسخ لأعيان العلماء والأمراء",
    "ناسخ بارع عمل في عدة خزانات وله نسخ كثيرة متفرقة",
    "يتميز بجودة الخط وضبط النص وإتقان الشكل",
    "ناسخ متقن عمل أكثر من ثلاثين سنة في النسخ والتحبير",
    "خطه مميز يعرفه المختصون في المخطوطات العُمانية",
]

WILAYAS = [
    "مسقط", "نزوى", "صحار", "صلالة", "البريمي", "إبراء", "سمائل",
    "بهلاء", "الرستاق", "منح", "عبري", "مصيرة", "خصب", "صور", "القابل",
]

AUTHOR_EVIDENCE = [
    "فهرس الخزانة",
    "نسب إليه في مقدمة النسخة",
    "ذكره تلميذه في إجازته",
    "وردت نسبته في فهرس القرن الثالث عشر",
    "نص على تأليفه في آخر الكتاب",
]

COPYIST_EVIDENCE = [
    "صريح في آخر النسخة",
    "خطه معروف لدى المختصين",
    "نص على نسخه في الكولوفون",
]

ANN_NOTES = [
    "خط واضح",
    "متأخر عن زمن النسخ",
    "مطموس جزئياً",
    "بخط غير خط الناسخ",
    "في أعلى الصفحة الأولى",
    "في هامش الغلاف",
    "بمداد أسود",
    "بمداد أحمر",
]

TAMALLUK_TEXTS = [
    "ملكه {n} بحق الشراء الصحيح",
    "هذا الكتاب من ملك {n} لا يباع ولا يوهب",
    "انتقل إلى ملك {n} بطريق الإرث",
    "من كتب {n} المباركة",
    "ملكه {n} بعد أن اشتراه من صاحبه بثمن معلوم",
]

WAQF_TEXTS = [
    "وقف هذا الكتاب على طلاب العلم بـ{p}",
    "حبّسه {n} في سبيل الله تعالى",
    "وقف لا يجوز بيعه ولا هبته ولا رهنه، وقفه {n}",
    "وقفه {n} على من يتعلم ويعلّم",
    "تحبيس في سبيل الله، حبّسه {n} على مكتبة {p}",
]

IHDAA_TEXTS = [
    "أهداه {n1} إلى {n2} تقديراً لعلمه وفضله",
    "هدية من {n1} إلى صديقه {n2} بارك الله فيه",
    "أهداه {n1} إلى {n2} نفعه الله به",
]

# ── HTTP helpers ─────────────────────────────────────────────────────────────


def _req(method, path, data):
    try:
        r = getattr(requests, method)(f"{BASE}{path}", json=data, timeout=15)
        if not r.ok:
            print(f"  خطأ {r.status_code} في {method.upper()} {path}: {r.text[:300]}")
            return None
        return r.json()
    except Exception as exc:
        print(f"  خطأ في الاتصال بـ {path}: {exc}")
        return None


def post(path, data):
    return _req("post", path, data)


def put(path, data):
    return _req("put", path, data)


# ── Builders ─────────────────────────────────────────────────────────────────


def build_person():
    ism = random.choice(FIRST_NAMES)
    father = random.choice(FIRST_NAMES)
    nisba = random.choice(NISBAS)
    nasab = f"بن {father}"
    fmt = random.choice(["simple", "kunya", "laqab"])

    if fmt == "kunya":
        kunya = random.choice(KUNYAS)
        preferred = f"{kunya} {ism} {nasab} {nisba}"
    elif fmt == "laqab":
        laqab = random.choice(LAQABS)
        preferred = f"{laqab} {ism} {nasab} {nisba}"
    else:
        kunya = laqab = None
        preferred = f"{ism} {nasab} {nisba}"

    p = {"preferred_name": preferred, "ism": ism, "nasab": nasab, "nisba_1": nisba}
    if fmt == "kunya":
        p["kunya"] = kunya
    elif fmt == "laqab":
        p["laqab"] = laqab

    if random.random() < 0.7:
        p["birth_place"] = random.choice(SCHOLAR_PLACES)
    if random.random() < 0.7:
        p["death_place"] = random.choice(SCHOLAR_PLACES)

    birth_yr = None
    if random.random() < 0.7:
        birth_yr = random.randint(900, 1350)
        p["birth_year_earliest"] = birth_yr
    if random.random() < 0.7:
        base = birth_yr if birth_yr else random.randint(900, 1350)
        p["death_year_earliest"] = min(base + random.randint(30, 80), 1400)

    return p


def pick_work_count():
    r = random.random()
    if r < 0.06:
        return 1
    elif r < 0.21:
        return random.randint(12, 18)
    else:
        return random.randint(3, 8)


# ── Main ──────────────────────────────────────────────────────────────────────


def main():
    cnt = dict(repositories=0, volumes=0, works=0, persons=0, relationships=0, annotations=0)

    # 1. Persons ──────────────────────────────────────────────────────────────
    print("إنشاء الأشخاص...")
    persons = []
    total_persons = 60
    n_copyists = random.randint(8, 12)
    copyist_slots = set(random.sample(range(total_persons), n_copyists))
    unknown_slots = set(random.sample(range(total_persons), 5))
    outside_slots = set(
        random.sample([i for i in range(total_persons) if i not in unknown_slots], 3)
    )

    for i in range(total_persons):
        is_copyist = i in copyist_slots
        p = build_person()
        if is_copyist:
            p["notes"] = random.choice(COPYIST_NOTES)
        elif random.random() < 0.6:
            p["notes"] = random.choice(PERSON_NOTES)

        payload = {k: v for k, v in p.items() if v is not None}
        result = post("/persons", payload)
        if result:
            result["_copyist"] = is_copyist
            persons.append(result)
            cnt["persons"] += 1

            pid = result["id"]
            if i in unknown_slots:
                wilayas = ["مجهول"]
            elif i in outside_slots:
                wilayas = ["خارج عُمان"]
            else:
                wilayas = random.sample(WILAYAS, random.randint(1, 3))
            put(f"/persons/{pid}/wilayas", {"wilayas": wilayas})

    print(f"  ✓ {cnt['persons']} شخصاً")

    copyists = [p for p in persons if p["_copyist"]]
    scholars = [p for p in persons if not p["_copyist"]]

    # 2. Repositories ─────────────────────────────────────────────────────────
    print("إنشاء الخزائن...")
    repos = []
    for rd in REPOS:
        r = post("/volumes/repositories", rd)
        if r:
            repos.append(r)
            cnt["repositories"] += 1
    print(f"  ✓ {cnt['repositories']} خزانة")
    if not repos:
        sys.exit("لم يُنشأ أي خزانة — تحقق من تشغيل الخادم على المنفذ 8765.")

    # 3. Volumes + works + relationships + annotations ─────────────────────────
    print("إنشاء المجلدات والعناوين...")
    vol_per_repo = [40, 25, 15]
    total_vols = sum(vol_per_repo)
    vol_idx = 0

    for repo, n_vols in zip(repos, vol_per_repo):
        repo_id = repo["id"]

        for seq in range(1, n_vols + 1):
            vol_idx += 1

            vp = {
                "repository_id": repo_id,
                "folio_count": random.randint(40, 350),
                "repository_volume_number": seq,
            }
            if random.random() < 0.7:
                vp["notes"] = random.choice(VOL_NOTES)

            vol = post("/volumes", vp)
            if not vol:
                continue
            cnt["volumes"] += 1
            vid = vol["id"]
            print(f"  [{vol_idx}/{total_vols}] مجلد في {repo['name']}")

            # Works ────────────────────────────────────────────────────────────
            vol_work_ids = []
            n_works = pick_work_count()

            for _ in range(n_works):
                cat = random.choice(list(TITLES.keys()))
                title = random.choice(TITLES[cat])

                wp = {"volume_id": vid, "title": title, "topic_category": cat}
                if random.random() < 0.4:
                    wp["incipit"] = random.choice(INCIPITS)
                if random.random() < 0.6:
                    wp["copy_place"] = random.choice(COPY_PLACES)
                if random.random() < 0.7:
                    wp["copy_year"] = random.randint(950, 1380)
                    if random.random() < 0.2:
                        wp["copy_date_as_written"] = random.choice(COPY_DATES_AS_WRITTEN)

                wk = post("/works", wp)
                if not wk:
                    continue
                cnt["works"] += 1
                wid = wk["id"]
                vol_work_ids.append(wid)
                print(f"    [{cnt['works']}] {title}")

                # مؤلف — ~60 % of works
                if scholars and random.random() < 0.6:
                    r = post("/relationships", {
                        "person_id": random.choice(scholars)["id"],
                        "level": "work",
                        "work_id": wid,
                        "role": "مؤلف",
                        "evidence_source": random.choice(AUTHOR_EVIDENCE),
                    })
                    if r:
                        cnt["relationships"] += 1

                # ناسخ — ~30 % of works
                if copyists and random.random() < 0.3:
                    r = post("/relationships", {
                        "person_id": random.choice(copyists)["id"],
                        "level": "work",
                        "work_id": wid,
                        "role": "ناسخ",
                        "evidence_source": random.choice(COPYIST_EVIDENCE),
                    })
                    if r:
                        cnt["relationships"] += 1

                # مذكور — ~10 % of works
                if persons and random.random() < 0.1:
                    r = post("/relationships", {
                        "person_id": random.choice(persons)["id"],
                        "level": "work",
                        "work_id": wid,
                        "role": "مذكور",
                    })
                    if r:
                        cnt["relationships"] += 1

            # Volume-level relationships ────────────────────────────────────
            if persons and random.random() < 0.2:
                r = post("/relationships", {
                    "person_id": random.choice(persons)["id"],
                    "level": "volume",
                    "volume_id": vid,
                    "role": "مالك",
                })
                if r:
                    cnt["relationships"] += 1

            if persons and random.random() < 0.08:
                r = post("/relationships", {
                    "person_id": random.choice(persons)["id"],
                    "level": "volume",
                    "volume_id": vid,
                    "role": "واقف",
                })
                if r:
                    cnt["relationships"] += 1

            if persons and random.random() < 0.05:
                r = post("/relationships", {
                    "person_id": random.choice(persons)["id"],
                    "level": "volume",
                    "volume_id": vid,
                    "role": "مستعير",
                })
                if r:
                    cnt["relationships"] += 1

            if persons and random.random() < 0.04:
                r = post("/relationships", {
                    "person_id": random.choice(persons)["id"],
                    "level": "volume",
                    "volume_id": vid,
                    "role": "مقيّد",
                })
                if r:
                    cnt["relationships"] += 1

            # Annotations — 1–3 per volume ────────────────────────────────
            for _ in range(random.randint(1, 3)):
                # تملك weighted twice
                atype = random.choice(["تملك", "تملك", "وقف", "إهداء"])
                p1 = random.choice(persons) if persons else None
                p2 = random.choice(persons) if persons else None
                place = random.choice(COPY_PLACES)

                if atype == "تملك" and p1:
                    txt = random.choice(TAMALLUK_TEXTS).format(n=p1["preferred_name"])
                elif atype == "وقف" and p1:
                    txt = random.choice(WAQF_TEXTS).format(
                        n=p1["preferred_name"], p=place
                    )
                elif atype == "إهداء" and p1 and p2:
                    txt = random.choice(IHDAA_TEXTS).format(
                        n1=p1["preferred_name"], n2=p2["preferred_name"]
                    )
                else:
                    txt = None

                ap = {"volume_id": vid, "annotation_type": atype}
                if txt:
                    ap["text_as_written"] = txt
                if random.random() < 0.6:
                    ap["notes"] = random.choice(ANN_NOTES)
                # Link ~30 % of annotations to a specific work within the volume
                if vol_work_ids and random.random() < 0.3:
                    ap["work_id"] = random.choice(vol_work_ids)

                ann = post("/annotations", ap)
                if ann:
                    cnt["annotations"] += 1

    # 4. Summary ──────────────────────────────────────────────────────────────
    print()
    print("ملخص البيانات المُدخلة:")
    print(f"- الخزائن: {cnt['repositories']}")
    print(f"- المجلدات: {cnt['volumes']}")
    print(f"- العناوين: {cnt['works']}")
    print(f"- الأشخاص: {cnt['persons']}")
    print(f"- الروابط: {cnt['relationships']}")
    print(f"- القيود: {cnt['annotations']}")


if __name__ == "__main__":
    main()
