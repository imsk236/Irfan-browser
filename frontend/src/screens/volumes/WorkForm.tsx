import { useState, useEffect } from "react";
import { worksApi, relationshipsApi, vocabApi } from "../../api";
import { ErrorModal } from "../../components/ErrorModal";
import { VocabSelect } from "../../components/VocabSelect";
import { PersonField } from "../../components/PersonField";
import { PersonFormModal } from "../../components/PersonFormModal";
import { FolioInput } from "../../components/FolioInput";
import { PersonRoleSection, PersonRoleListSection } from "../../components/PersonRoleSection";
import type { PersonRoleListRow } from "../../components/PersonRoleSection";
import { SOURCE_SENTINELS, isContributorRole } from "../../utils/workRoles";
import type { Person, Relationship, Work } from "../../api/types";

const TOPIC_TAXONOMY: Record<string, string[]> = {
  "القرآن وعلومه": ["المصاحف", "أصول التفسير", "التفسير", "القراءات", "التجويد", "غريب القرآن", "إعراب القرآن", "رسم المصاحف"],
  "الحديث وعلومه": ["كتب الحديث", "شروح الحديث", "علم الرجال", "مصطلح الحديث", "غريب الحديث", "علوم الحديث"],
  "العقائد وأصول الدين": ["التوحيد وعلم الكلام", "مقالات الفرق", "الملل والنحل"],
  "الفقه وأصوله": ["الفقه العام", "أصول الفقه", "فقه المذاهب"],
  "اللغة العربية": ["المعاجم", "فقه اللغة", "النحو", "الصرف", "البلاغة", "العروض والقوافي", "الرسم والإملاء"],
  "الآداب": ["الشعر", "الرسائل", "الخطابة", "التقاريظ", "المقامات", "النقد", "شروح القصائد", "الأمثال", "الدراسات الأدبية", "الحكايات والملاحم", "الأحاجي والنوادر", "المذكرات"],
  "التاريخ والجغرافية": ["التاريخ العام", "التاريخ الخاص", "السيرة النبوية", "قصص الأنبياء", "التراجم", "السير", "الأنساب", "الرحلات", "جغرافية البلدان", "الخطط"],
  "العلوم البحتة": ["الرياضيات", "الفيزياء", "الكيمياء", "الفلك", "الملاحة البحرية", "الميقات", "علوم الأرض والمناخ", "علم الإنسان", "علم النبات", "علم الحيوان"],
  "العلوم التطبيقية": ["الطب", "الهندسة", "الزراعة", "تدبير المنزل", "الإدارة", "الصناعات", "البيطرة"],
  "الفلسفة والعلوم المتصلة بها": ["الفلسفة", "علم النفس", "علم المنطق", "آداب البحث والمناظرة", "الأخلاق", "السلوك", "التصوف", "الرقائق والمواعظ", "الأدعية والأذكار", "الخطب", "الفضائل"],
  "العلوم الاجتماعية": ["الاجتماع", "الأوزان والمكاييل", "الفنون العسكرية", "السياسة الشرعية", "التربية والتعليم", "النقود", "الحسبة", "السجلات"],
  "المعارف العامة والفنون": ["الفهرسة الوصفية (الببليوغرافيا)", "الفهارس", "كتب المختارات", "الحروف والأوفاق", "الرمل", "النجوم", "تعبير الرؤيا", "الفنون", "الخط وآلاته", "البيزرة", "الكتب المقدسة", "الديانات", "اللغات الأخرى", "المعارف العامة"],
};

function folioToInt(encoded: string): number | null {
  const m = encoded.match(/^(\d+)([يس])$/);
  if (!m) return null;
  return parseInt(m[1]) * 2 + (m[2] === "ي" ? 0 : 1);
}

interface SelectedPerson {
  person_id: number;
  preferred_name: string;
  written_form: string;
}

interface Props {
  volumeId: number;
  work: Work | null;
  relationships?: Relationship[];
  personMap?: Map<number, string>;
  folioCount?: number | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function WorkForm({ volumeId, work, relationships, personMap, folioCount, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(work?.title ?? "");
  const [partNumber, setPartNumber] = useState(work?.part_number?.toString() ?? "");
  const [titleSource, setTitleSource] = useState(work?.title_source ?? "");
  const [titleCustom, setTitleCustom] = useState(
    !!work?.title_source && !SOURCE_SENTINELS.includes(work.title_source as typeof SOURCE_SENTINELS[number])
  );
  const [incipit, setIncipit] = useState(work?.incipit ?? "");
  const [explicit, setExplicit] = useState(work?.explicit ?? "");
  const [topicCategory, setTopicCategory] = useState(work?.topic_category ?? "");
  const [topicSubcategory, setTopicSubcategory] = useState(work?.topic_subcategory ?? "");
  const [startUnit, setStartUnit] = useState(work?.start_unit ?? "");
  const [endUnit, setEndUnit] = useState(work?.end_unit ?? "");
  const [notes, setNotes] = useState(work?.notes ?? "");

  // Copy place + date fields
  const [copyPlace, setCopyPlace] = useState(work?.copy_place ?? "");
  const [wilayaOptions, setWilayaOptions] = useState<string[]>([]);
  const [copyYear, setCopyYear] = useState(work?.copy_year?.toString() ?? "");
  const [copyMonth, setCopyMonth] = useState(work?.copy_month ?? "");
  const [copyDay, setCopyDay] = useState(work?.copy_day?.toString() ?? "");
  const [copyWeekday, setCopyWeekday] = useState(work?.copy_weekday ?? "");
  const [copyTime, setCopyTime] = useState(work?.copy_time ?? "");

  useEffect(() => {
    vocabApi.list("wilaya").then(setWilayaOptions).catch(() => setWilayaOptions([]));
  }, []);

  // Author (مؤلف)
  const existingAuthorRel = work && relationships
    ? relationships.find((r) => r.work_id === work.id && r.role === "مؤلف") ?? null
    : null;
  const [replaceAuthor, setReplaceAuthor] = useState(false);
  const [author, setAuthor] = useState<SelectedPerson | null>(null);
  const [authorUnknown, setAuthorUnknown] = useState(false);
  const [authorSource, setAuthorSource] = useState("");
  const [authorCustom, setAuthorCustom] = useState(false);

  // Scribes (ناسخ — one or more, required)
  const existingScribeRels = work && relationships
    ? relationships.filter((r) => r.work_id === work.id && r.role === "ناسخ")
    : [];
  const [removedScribeRelIds, setRemovedScribeRelIds] = useState<number[]>([]);
  const [pendingScribes, setPendingScribes] = useState<{ person: SelectedPerson; source: string }[]>([]);
  const [scribeUnknown, setScribeUnknown] = useState(false);
  const [stageScribePerson, setStageScribePerson] = useState<SelectedPerson | null>(null);
  const [stageScribeSource, setStageScribeSource] = useState("");
  const [stageScribeCustom, setStageScribeCustom] = useState(false);
  const [scribePersonFieldKey, setScribePersonFieldKey] = useState(0);

  // Contributors (المساهم — zero or more, optional)
  const existingContributorRels = work && relationships
    ? relationships.filter((r) => r.work_id === work.id && isContributorRole(r.role))
    : [];
  const [removedContributorRelIds, setRemovedContributorRelIds] = useState<number[]>([]);
  const [pendingContributors, setPendingContributors] = useState<{ person: SelectedPerson; role: string; source: string }[]>([]);
  const [stageContributorPerson, setStageContributorPerson] = useState<SelectedPerson | null>(null);
  const [stageContributorRole, setStageContributorRole] = useState("");
  const [stageContributorSource, setStageContributorSource] = useState("");
  const [stageContributorCustom, setStageContributorCustom] = useState(false);
  const [contributorPersonFieldKey, setContributorPersonFieldKey] = useState(0);

  // Copied for (منسوخ له — optional)
  const existingCopiedForRel = work && relationships
    ? relationships.find((r) => r.work_id === work.id && r.role === "منسوخ له") ?? null
    : null;
  const [replaceCopiedFor, setReplaceCopiedFor] = useState(false);
  const [copiedFor, setCopiedFor] = useState<SelectedPerson | null>(null);
  const [copiedForSource, setCopiedForSource] = useState("");
  const [copiedForCustom, setCopiedForCustom] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [personModalSlot, setPersonModalSlot] = useState<"author" | "copiedFor" | "scribeStage" | "contributorStage" | null>(null);
  const [personModalName, setPersonModalName] = useState("");

  const scribeRows: PersonRoleListRow[] = [
    ...existingScribeRels
      .filter((r) => !removedScribeRelIds.includes(r.id))
      .map((r) => ({
        key: `existing-${r.id}`,
        relationshipId: r.id,
        person: { person_id: r.person_id, preferred_name: personMap?.get(r.person_id) ?? `شخص #${r.person_id}`, written_form: "" },
        role: "ناسخ",
        source: r.evidence_source ?? "",
        onRemove: () => setRemovedScribeRelIds((prev) => [...prev, r.id]),
      })),
    ...pendingScribes.map((p, idx) => ({
      key: `pending-${idx}`,
      relationshipId: null,
      person: p.person,
      role: "ناسخ",
      source: p.source,
      onRemove: () => setPendingScribes((prev) => prev.filter((_, i) => i !== idx)),
    })),
  ];

  const isStagedScribeDuplicate = stageScribePerson
    ? scribeRows.some((r) => r.person.person_id === stageScribePerson.person_id)
    : false;

  function addStagedScribe() {
    if (!stageScribePerson || isStagedScribeDuplicate) return;
    setPendingScribes((prev) => [...prev, { person: stageScribePerson, source: stageScribeSource }]);
    setStageScribePerson(null);
    setStageScribeSource("");
    setStageScribeCustom(false);
    setScribePersonFieldKey((k) => k + 1);
  }

  const contributorRows: PersonRoleListRow[] = [
    ...existingContributorRels
      .filter((r) => !removedContributorRelIds.includes(r.id))
      .map((r) => ({
        key: `existing-${r.id}`,
        relationshipId: r.id,
        person: { person_id: r.person_id, preferred_name: personMap?.get(r.person_id) ?? `شخص #${r.person_id}`, written_form: "" },
        role: r.role,
        source: r.evidence_source ?? "",
        onRemove: () => setRemovedContributorRelIds((prev) => [...prev, r.id]),
      })),
    ...pendingContributors.map((p, idx) => ({
      key: `pending-${idx}`,
      relationshipId: null,
      person: p.person,
      role: p.role,
      source: p.source,
      onRemove: () => setPendingContributors((prev) => prev.filter((_, i) => i !== idx)),
    })),
  ];

  const isStagedContributorDuplicate = stageContributorPerson && stageContributorRole
    ? contributorRows.some((r) => r.person.person_id === stageContributorPerson.person_id && r.role === stageContributorRole)
    : false;

  function addStagedContributor() {
    if (!stageContributorPerson || !stageContributorRole || isStagedContributorDuplicate) return;
    setPendingContributors((prev) => [...prev, { person: stageContributorPerson, role: stageContributorRole, source: stageContributorSource }]);
    setStageContributorPerson(null);
    setStageContributorRole("");
    setStageContributorSource("");
    setStageContributorCustom(false);
    setContributorPersonFieldKey((k) => k + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    if (partNumber) {
      const p = parseInt(partNumber);
      if (isNaN(p) || p < 1) {
        setError("رقم الجزء يجب أن يكون رقماً صحيحاً أكبر من صفر");
        return;
      }
    }

    // Copy date coherence: day requires month, month requires year
    if (copyDay && !copyMonth) {
      setError("لا يمكن إدخال التاريخ بدون شهر");
      return;
    }
    if (copyMonth && !copyYear) {
      setError("لا يمكن إدخال الشهر بدون سنة");
      return;
    }
    if (copyYear) {
      const yr = parseInt(copyYear);
      if (isNaN(yr) || yr < 1 || yr > 1500) {
        setError("السنة الهجرية يجب أن تكون بين 1 و 1500");
        return;
      }
    }
    if (copyDay) {
      const d = parseInt(copyDay);
      if (isNaN(d) || d < 1 || d > 30) {
        setError("التاريخ يجب أن يكون بين 1 و 30");
        return;
      }
    }

    // Validate مؤلف: must pick a person OR check مجهول
    if (!work || replaceAuthor) {
      if (!author && !authorUnknown) {
        setError("المؤلف مطلوب. اختر شخصاً أو أشر إلى أنه مجهول.");
        return;
      }
    }
    // Validate ناسخ: at least one scribe (existing, pending, or staged) OR مجهول
    const effectiveScribeCount = scribeRows.length + (stageScribePerson && !isStagedScribeDuplicate ? 1 : 0);
    if (effectiveScribeCount === 0 && !scribeUnknown) {
      setError("الناسخ مطلوب. أضف ناسخاً واحداً على الأقل أو أشر إلى أنه مجهول.");
      return;
    }

    // Validate folio ordering: 1ي < 1س < 2ي < 2س …
    if (startUnit && endUnit) {
      const sv = folioToInt(startUnit);
      const ev = folioToInt(endUnit);
      if (sv !== null && ev !== null && sv > ev) {
        setError("الورقة الأولى يجب أن تسبق الورقة الأخيرة أو تساويها.");
        return;
      }
    }
    // Validate folio cap against volume's folio_count
    if (folioCount) {
      if (startUnit) {
        const m = startUnit.match(/^(\d+)/);
        if (m && parseInt(m[1]) > folioCount) {
          setError(`رقم الورقة الأولى (${m[1]}) يتجاوز عدد الأوراق (${folioCount})`);
          return;
        }
      }
      if (endUnit) {
        const m = endUnit.match(/^(\d+)/);
        if (m && parseInt(m[1]) > folioCount) {
          setError(`رقم الورقة الأخيرة (${m[1]}) يتجاوز عدد الأوراق (${folioCount})`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      let savedWork: Work;
      const workPayload = {
        title,
        part_number: partNumber ? parseInt(partNumber) : undefined,
        title_source: titleSource || undefined,
        incipit: incipit || undefined,
        explicit: explicit || undefined,
        topic_category: topicCategory || undefined,
        topic_subcategory: topicSubcategory || undefined,
        start_unit: startUnit || undefined,
        copy_place: copyPlace || undefined,
        end_unit: endUnit || undefined,
        copy_year: copyYear ? parseInt(copyYear) : undefined,
        copy_month: copyMonth || undefined,
        copy_day: copyDay ? parseInt(copyDay) : undefined,
        copy_weekday: copyWeekday || undefined,
        copy_time: copyTime || undefined,
        notes: notes || undefined,
      };

      if (work) {
        savedWork = await worksApi.update(work.id, workPayload);
      } else {
        savedWork = await worksApi.create({ volume_id: volumeId, ...workPayload });
      }

      // Handle مؤلف
      const shouldSaveAuthor = !existingAuthorRel || replaceAuthor;
      if (shouldSaveAuthor) {
        if (existingAuthorRel) {
          await relationshipsApi.delete(existingAuthorRel.id);
        }
        if (author && !authorUnknown) {
          await relationshipsApi.create({
            person_id: author.person_id,
            level: "work",
            work_id: savedWork.id,
            volume_id: null,
            role: "مؤلف",
            evidence_source: authorSource || null,
            evidence_annotation_id: null,
            notes: null,
          });
        }
      }

      // Handle ناسخ (list) — include anything still sitting in the stage inputs
      const effectivePendingScribes = stageScribePerson && !isStagedScribeDuplicate
        ? [...pendingScribes, { person: stageScribePerson, source: stageScribeSource }]
        : pendingScribes;
      for (const relId of removedScribeRelIds) {
        await relationshipsApi.delete(relId);
      }
      for (const p of effectivePendingScribes) {
        await relationshipsApi.create({
          person_id: p.person.person_id,
          level: "work",
          work_id: savedWork.id,
          volume_id: null,
          role: "ناسخ",
          evidence_source: p.source || null,
          evidence_annotation_id: null,
          notes: null,
        });
      }

      // Handle المساهم (list, optional) — include anything still sitting in the stage inputs
      const effectivePendingContributors = stageContributorPerson && stageContributorRole && !isStagedContributorDuplicate
        ? [...pendingContributors, { person: stageContributorPerson, role: stageContributorRole, source: stageContributorSource }]
        : pendingContributors;
      for (const relId of removedContributorRelIds) {
        await relationshipsApi.delete(relId);
      }
      for (const p of effectivePendingContributors) {
        await relationshipsApi.create({
          person_id: p.person.person_id,
          level: "work",
          work_id: savedWork.id,
          volume_id: null,
          role: p.role,
          evidence_source: p.source || null,
          evidence_annotation_id: null,
          notes: null,
        });
      }

      // Handle منسوخ له (optional)
      const shouldSaveCopiedFor = !existingCopiedForRel || replaceCopiedFor;
      if (shouldSaveCopiedFor) {
        if (existingCopiedForRel) {
          await relationshipsApi.delete(existingCopiedForRel.id);
        }
        if (copiedFor) {
          await relationshipsApi.create({
            person_id: copiedFor.person_id,
            level: "work",
            work_id: savedWork.id,
            volume_id: null,
            role: "منسوخ له",
            evidence_source: copiedForSource || null,
            evidence_annotation_id: null,
            notes: null,
          });
        }
      }

      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const existingAuthorName = existingAuthorRel
    ? (personMap?.get(existingAuthorRel.person_id) ?? `شخص #${existingAuthorRel.person_id}`)
    : null;
  const existingCopiedForName = existingCopiedForRel
    ? (personMap?.get(existingCopiedForRel.person_id) ?? `شخص #${existingCopiedForRel.person_id}`)
    : null;

  return (
    <>
    <form onSubmit={submit}>
      <h4 style={{ marginBottom: "var(--space-4)", fontSize: 15 }}>
        {work ? "تعديل العنوان" : "عنوان جديد"}
      </h4>

      {error && <ErrorModal message={error} onClose={() => setError("")} />}

      {/* العنوان والأوراق */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>
            العنوان <span style={{ color: "var(--color-error)" }}>*</span>
          </label>
          <input
            className="input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          {title.trim() && (
            <div className="field" style={{ marginTop: "var(--space-3)" }}>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>مصدر العنوان</label>
              <div style={{ display: "flex", gap: "var(--space-5)", marginTop: "var(--space-1)" }}>
                {(["المخطوط", "المفهرس", "مرجع آخر"] as const).map((opt) => {
                  const selectedOption = SOURCE_SENTINELS.includes(titleSource as typeof SOURCE_SENTINELS[number])
                    ? titleSource
                    : titleCustom ? "مرجع آخر" : null;
                  return (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="title-source"
                        checked={selectedOption === opt}
                        onChange={() => {
                          if (opt === "مرجع آخر") {
                            setTitleCustom(true);
                            if (SOURCE_SENTINELS.includes(titleSource as typeof SOURCE_SENTINELS[number])) setTitleSource("");
                          } else {
                            setTitleCustom(false);
                            setTitleSource(opt);
                          }
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
              {titleCustom && (
                <input
                  className="input"
                  type="text"
                  placeholder="اذكر المرجع…"
                  value={SOURCE_SENTINELS.includes(titleSource as typeof SOURCE_SENTINELS[number]) ? "" : titleSource}
                  onChange={(e) => setTitleSource(e.target.value)}
                  style={{ marginTop: "var(--space-2)" }}
                  autoFocus
                />
              )}
            </div>
          )}
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>رقم الجزء</label>
          <input
            className="input"
            type="number"
            min="1"
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            style={{ maxWidth: 160 }}
          />
        </div>

        {/* المطلع — witness field: muted label, secondary visual weight */}
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)" }}>المطلع</label>
          <textarea
            className="textarea"
            value={incipit}
            onChange={(e) => setIncipit(e.target.value)}
            placeholder="أول كلمات النص كما هي مكتوبة…"
          />
        </div>

        {/* الخاتمة — witness field: muted label, secondary visual weight */}
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)" }}>الخاتمة</label>
          <textarea
            className="textarea"
            value={explicit}
            onChange={(e) => setExplicit(e.target.value)}
            placeholder="آخر كلمات النص كما هي مكتوبة…"
          />
        </div>

        <div className="field">
          <label>الورقة الأولى</label>
          <FolioInput value={startUnit} onChange={setStartUnit} folioCount={folioCount} />
        </div>

        <div className="field">
          <label>الورقة الأخيرة</label>
          <FolioInput value={endUnit} onChange={setEndUnit} folioCount={folioCount} />
        </div>
      </div>

      {/* التصنيف الموضوعي */}
      <div
        style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-surface-muted)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-3)" }}>
          التصنيف الموضوعي
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div className="field">
            <label>التقسيم العام</label>
            <select
              className="select"
              value={topicCategory}
              onChange={(e) => {
                setTopicCategory(e.target.value);
                setTopicSubcategory("");
              }}
            >
              <option value="">— اختر —</option>
              {Object.keys(TOPIC_TAXONOMY).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>التقسيم الفرعي</label>
            <select
              className="select"
              value={topicSubcategory}
              onChange={(e) => setTopicSubcategory(e.target.value)}
              disabled={!topicCategory}
            >
              <option value="">— اختر —</option>
              {(TOPIC_TAXONOMY[topicCategory] ?? []).map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* المؤلف */}
      <PersonRoleSection
        roleLabel="المؤلف"
        required
        existingName={existingAuthorName}
        replacing={replaceAuthor}
        onReplace={() => setReplaceAuthor(true)}
        onCancelReplace={() => { setReplaceAuthor(false); setAuthor(null); setAuthorUnknown(false); }}
        person={author}
        onPersonChange={setAuthor}
        unknown={authorUnknown}
        onUnknownChange={setAuthorUnknown}
        source={authorSource}
        onSourceChange={setAuthorSource}
        showCustom={authorCustom}
        onShowCustomChange={setAuthorCustom}
        onRequestCreate={(name) => { setPersonModalSlot("author"); setPersonModalName(name); }}
        work={work}
      />

      {/* الناسخ (يمكن إضافة أكثر من واحد) */}
      <PersonRoleListSection
        sectionLabel="الناسخ"
        required
        rows={scribeRows}
        stagePerson={stageScribePerson}
        onStagePersonChange={setStageScribePerson}
        fixedRole="ناسخ"
        stageRole="ناسخ"
        onStageRoleChange={() => {}}
        stageSource={stageScribeSource}
        onStageSourceChange={setStageScribeSource}
        stageShowCustomSource={stageScribeCustom}
        onStageShowCustomSourceChange={setStageScribeCustom}
        personFieldKey={scribePersonFieldKey}
        onAdd={addStagedScribe}
        addDisabled={!stageScribePerson || isStagedScribeDuplicate}
        addDisabledReason={isStagedScribeDuplicate ? "هذا الشخص مضاف بالفعل كناسخ" : undefined}
        onRequestCreatePerson={(name) => { setPersonModalSlot("scribeStage"); setPersonModalName(name); }}
        unknownOption={scribeRows.length === 0 ? { checked: scribeUnknown, onChange: setScribeUnknown } : undefined}
      />

      {/* المساهم */}
      <PersonRoleListSection
        sectionLabel="المساهم"
        required={false}
        rows={contributorRows}
        stagePerson={stageContributorPerson}
        onStagePersonChange={setStageContributorPerson}
        roleVocabCategory="contributor_role"
        stageRole={stageContributorRole}
        onStageRoleChange={setStageContributorRole}
        stageSource={stageContributorSource}
        onStageSourceChange={setStageContributorSource}
        stageShowCustomSource={stageContributorCustom}
        onStageShowCustomSourceChange={setStageContributorCustom}
        personFieldKey={contributorPersonFieldKey}
        onAdd={addStagedContributor}
        addDisabled={!stageContributorPerson || !stageContributorRole || isStagedContributorDuplicate}
        addDisabledReason={isStagedContributorDuplicate ? "هذا الشخص مضاف بالفعل بهذا الدور" : undefined}
        onRequestCreatePerson={(name) => { setPersonModalSlot("contributorStage"); setPersonModalName(name); }}
      />

      {/* منسوخ له (اختياري) */}
      <div
        style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-surface-muted)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-2)" }}>
          منسوخ له (اختياري)
        </div>
        {existingCopiedForName && !replaceCopiedFor ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>{existingCopiedForName}</span>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => setReplaceCopiedFor(true)}>
              تغيير
            </button>
          </div>
        ) : (
          <>
            <PersonField
              label="من نُسخ له؟"
              value={copiedFor}
              onChange={setCopiedFor}
              saveVariant
              onRequestCreate={(name) => { setPersonModalSlot("copiedFor"); setPersonModalName(name); }}
            />
            {copiedFor && (
              <div className="field" style={{ marginTop: "var(--space-3)" }}>
                <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>مصدر الصلة</label>
                <div style={{ display: "flex", gap: "var(--space-5)", marginTop: "var(--space-1)" }}>
                  {(["المخطوط", "المفهرس", "مرجع آخر"] as const).map((opt) => {
                    const selected = SOURCE_SENTINELS.includes(copiedForSource as typeof SOURCE_SENTINELS[number])
                      ? copiedForSource
                      : copiedForCustom ? "مرجع آخر" : null;
                    return (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="source-copiedFor"
                          checked={selected === opt}
                          onChange={() => {
                            if (opt === "مرجع آخر") {
                              setCopiedForCustom(true);
                              if (SOURCE_SENTINELS.includes(copiedForSource as typeof SOURCE_SENTINELS[number])) setCopiedForSource("");
                            } else {
                              setCopiedForCustom(false);
                              setCopiedForSource(opt);
                            }
                          }}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
                {copiedForCustom && (
                  <input
                    className="input"
                    type="text"
                    placeholder="اذكر المرجع…"
                    value={SOURCE_SENTINELS.includes(copiedForSource as typeof SOURCE_SENTINELS[number]) ? "" : copiedForSource}
                    onChange={(e) => setCopiedForSource(e.target.value)}
                    style={{ marginTop: "var(--space-2)" }}
                    autoFocus
                  />
                )}
              </div>
            )}
            {work && replaceCopiedFor && (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                style={{ marginTop: "var(--space-2)" }}
                onClick={() => { setReplaceCopiedFor(false); setCopiedFor(null); }}
              >
                إلغاء التغيير
              </button>
            )}
          </>
        )}
      </div>

      {/* تاريخ النسخ */}
      <div
        style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-surface-muted)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--space-3)" }}>
          بيانات النسخ
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
          <div className="field">
            <label>السنة (هـ)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="1500"
              value={copyYear}
              onChange={(e) => setCopyYear(e.target.value)}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>الشهر</label>
            <VocabSelect
              category="hijri_month"
              value={copyMonth}
              onChange={setCopyMonth}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>التاريخ</label>
            <input
              className="input"
              type="number"
              min="1"
              max="30"
              value={copyDay}
              onChange={(e) => setCopyDay(e.target.value)}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>اليوم</label>
            <VocabSelect
              category="weekday"
              value={copyWeekday}
              onChange={setCopyWeekday}
              placeholder="مجهول"
            />
          </div>
          <div className="field">
            <label>الوقت</label>
            <input
              className="input"
              type="text"
              value={copyTime}
              onChange={(e) => setCopyTime(e.target.value)}
              placeholder="مجهول"
            />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>مكان النسخ</label>
            <select
              className="select"
              value={copyPlace}
              onChange={(e) => setCopyPlace(e.target.value)}
            >
              <option value="">— غير محدد —</option>
              <option value="مجهول">مجهول</option>
              <option value="خارج عُمان">خارج عُمان</option>
              {wilayaOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="field" style={{ marginBottom: "var(--space-4)" }}>
        <label>ملاحظات</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          إلغاء
        </button>
      </div>

    </form>

    {personModalSlot !== null && (
      <PersonFormModal
        person={null}
        initialName={personModalName}
        onSaved={(person: Person) => {
          const selected = { person_id: person.id, preferred_name: person.preferred_name, written_form: person.preferred_name };
          if (personModalSlot === "author") setAuthor(selected);
          else if (personModalSlot === "copiedFor") setCopiedFor(selected);
          else if (personModalSlot === "scribeStage") setStageScribePerson(selected);
          else setStageContributorPerson(selected);
          setPersonModalSlot(null);
        }}
        onCancel={() => setPersonModalSlot(null)}
      />
    )}
    </>
  );
}
