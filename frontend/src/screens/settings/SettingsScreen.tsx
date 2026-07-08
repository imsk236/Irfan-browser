import { useEffect, useRef, useState } from "react";
import { exportApi, volumesApi } from "../../api";
import type { Repository } from "../../api/types";
import { ConfirmModal } from "../../components/ConfirmModal";
import { RepoFormModal } from "../../components/RepoFormModal";

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_RESEARCHER = "irfan:researcher_name";
const LS_FOLDER = "irfan:export_folder";

function lsGet(key: string) {
  try { return localStorage.getItem(key) ?? ""; }
  catch { return ""; }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfirmState {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
}

type SettingsSection = "repositories" | "export" | "settings";

type ExportState = "idle" | "loading" | "success" | "error";

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`role-tab ${active ? "active" : ""}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function FolderPicker({
  value,
  onChange,
  placeholder = "اختر مجلداً…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const hasIpc = Boolean(window.archive?.openDirectory);

  async function pick() {
    const dir = await window.archive!.openDirectory();
    if (dir) onChange(dir);
  }

  return (
    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
      <input
        type="text"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          fontFamily: "monospace",
          fontSize: 12,
          direction: "ltr",
          textAlign: "left",
        }}
      />
      {hasIpc && (
        <button className="btn btn-secondary btn-compact" type="button" onClick={pick}>
          اختر
        </button>
      )}
    </div>
  );
}

interface ExportCardProps {
  format: string;
  title: string;
  subtitle: string;
  state: ExportState;
  message: string;
  onExport: () => void;
  children?: React.ReactNode;
}

function ExportCard({ format, title, subtitle, state, message, onExport, children }: ExportCardProps) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        background: "var(--color-surface)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <span
            style={{
              fontSize: "var(--font-size-meta)",
              fontWeight: 600,
              color: "var(--color-primary-700)",
              background: "var(--color-primary-100)",
              borderRadius: "var(--radius-sm)",
              padding: "2px 7px",
              letterSpacing: "0.04em",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {format}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--font-size-body)", marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", lineHeight: 1.5 }}>{subtitle}</div>
          </div>
        </div>
        <button
          className="btn btn-primary btn-compact"
          type="button"
          onClick={onExport}
          disabled={state === "loading"}
          style={{ flexShrink: 0, marginInlineStart: "var(--space-3)" }}
        >
          {state === "loading" ? "جارٍ التصدير…" : "تصدير"}
        </button>
      </div>

      {children}

      {state === "success" && (
        <div
          style={{
            fontSize: "var(--font-size-meta)",
            color: "#2a6b30",
            background: "#edf5ee",
            border: "1px solid #b8d9bb",
            borderRadius: "var(--radius-sm)",
            padding: "5px 10px",
            direction: "ltr",
            textAlign: "left",
            wordBreak: "break-all",
          }}
        >
          ✓ {message}
        </div>
      )}
      {state === "error" && (
        <div
          style={{
            fontSize: "var(--font-size-meta)",
            color: "var(--color-danger)",
            background: "#fdecea",
            border: "1px solid #f5c0ba",
            borderRadius: "var(--radius-sm)",
            padding: "5px 10px",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const [section, setSection] = useState<SettingsSection>("repositories");

  // Repositories state
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [repoModal, setRepoModal] = useState<{ repo: Repository | null } | null>(null);

  // Settings state
  const [researcherName, setResearcherName] = useState(() => lsGet(LS_RESEARCHER));
  const [defaultFolder, setDefaultFolder] = useState(() => lsGet(LS_FOLDER));
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Export state
  const [exportFolder, setExportFolder] = useState(() => lsGet(LS_FOLDER));
  const [pdfPath, setPdfPath] = useState("");

  const [jsonState, setJsonState] = useState<ExportState>("idle");
  const [jsonMsg, setJsonMsg] = useState("");
  const [excelState, setExcelState] = useState<ExportState>("idle");
  const [excelMsg, setExcelMsg] = useState("");
  const [pdfState, setPdfState] = useState<ExportState>("idle");
  const [pdfMsg, setPdfMsg] = useState("");

  // Database location state
  const [dbPath, setDbPath] = useState("");
  const [dbPending, setDbPending] = useState<{ path: string; existed: boolean } | null>(null);
  const [dbConflict, setDbConflict] = useState<{ path: string; foundPath: string } | null>(null);

  useEffect(() => {
    if (window.archive?.getDbPath) {
      window.archive.getDbPath().then(setDbPath);
    }
  }, []);

  // Keep exportFolder in sync when defaultFolder changes
  const prevDefault = useRef(defaultFolder);
  useEffect(() => {
    if (exportFolder === prevDefault.current) {
      setExportFolder(defaultFolder);
    }
    prevDefault.current = defaultFolder;
  }, [defaultFolder]);

  useEffect(() => { loadRepos(); }, []);

  async function loadRepos() {
    setLoading(true);
    setLoadError("");
    try { setRepos(await volumesApi.listRepositories()); }
    catch (err) { setLoadError(String(err)); }
    finally { setLoading(false); }
  }

  async function handleRepoSaved() { setRepoModal(null); await loadRepos(); }

  function askDelete(r: Repository) {
    setConfirmState({
      title: "حذف الخزانة",
      message: `هل تريد حذف خزانة «${r.name}»؟ لا يمكن حذفها إذا كانت تحتوي على مجلدات.`,
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try { await volumesApi.deleteRepository(r.id); await loadRepos(); }
        catch (err) {
          setConfirmState({ title: "تعذّر الحذف", message: String(err), onConfirm: () => setConfirmState(null) });
        }
      },
    });
  }

  function saveSettings() {
    lsSet(LS_RESEARCHER, researcherName);
    lsSet(LS_FOLDER, defaultFolder);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  async function doExportJson() {
    if (!exportFolder.trim()) { setJsonState("error"); setJsonMsg("اختر مجلد التصدير أولاً"); return; }
    setJsonState("loading"); setJsonMsg("");
    try {
      const { file } = await exportApi.json(exportFolder);
      setJsonState("success"); setJsonMsg(file);
    } catch (err) { setJsonState("error"); setJsonMsg(String(err)); }
  }

  async function doExportExcel() {
    if (!exportFolder.trim()) { setExcelState("error"); setExcelMsg("اختر مجلد التصدير أولاً"); return; }
    setExcelState("loading"); setExcelMsg("");
    try {
      const { file } = await exportApi.excel(exportFolder, lsGet(LS_RESEARCHER));
      setExcelState("success"); setExcelMsg(file);
    } catch (err) { setExcelState("error"); setExcelMsg(String(err)); }
  }

  async function doExportPdf() {
    let path = pdfPath.trim();
    if (!path) {
      if (window.archive?.savePdf) {
        const chosen = await window.archive.savePdf();
        if (!chosen) return;
        path = chosen;
        setPdfPath(path);
      } else {
        setPdfState("error"); setPdfMsg("اختر موقع حفظ الملف أولاً"); return;
      }
    }
    setPdfState("loading"); setPdfMsg("");
    try {
      if (window.archive?.exportPdf) {
        const { file } = await window.archive.exportPdf(path, lsGet(LS_RESEARCHER));
        setPdfState("success"); setPdfMsg(file);
      } else {
        setPdfState("error"); setPdfMsg("تصدير PDF غير متاح إلا داخل التطبيق");
      }
    } catch (err) { setPdfState("error"); setPdfMsg(String(err)); }
  }

  async function pickPdfPath() {
    if (!window.archive?.savePdf) return;
    const chosen = await window.archive.savePdf();
    if (chosen) setPdfPath(chosen);
  }

  async function chooseDbLocation() {
    if (!window.archive?.chooseDbLocation) return;
    const result = await window.archive.chooseDbLocation();
    if (!result || result.status === "unchanged") return;

    if (result.status === "conflict") {
      setDbConflict({ path: result.path, foundPath: result.foundPath });
      return;
    }

    await window.archive.confirmDbLocation?.(result.path);
    setDbPending({ path: result.path, existed: result.status === "adopt" });
  }

  async function resolveDbConflict(chosenPath: string) {
    if (!dbConflict) return;
    await window.archive?.confirmDbLocation?.(chosenPath);
    setDbPending({ path: chosenPath, existed: chosenPath === dbConflict.foundPath });
    setDbConflict(null);
  }

  async function restartApp() {
    await window.archive?.restartApp?.();
  }

  return (
    <div style={{ padding: "var(--space-5)", maxWidth: 860, overflowY: "auto", height: "100%" }}>
      <h1 style={{ marginBottom: "var(--space-5)" }}>ضبط الأرشيف</h1>

      {/* Section tabs */}
      <div role="tablist" className="role-tabs">
        <SectionTab label="الخزانات"  active={section === "repositories"} onClick={() => setSection("repositories")} />
        <SectionTab label="التصدير"   active={section === "export"}       onClick={() => setSection("export")} />
        <SectionTab label="الإعدادات" active={section === "settings"}     onClick={() => setSection("settings")} />
      </div>

      {/* ── الخزانات ─────────────────────────────────────────────── */}
      {section === "repositories" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <span className="section-heading" style={{ marginBottom: 0 }}>الخزانات</span>
            <button className="btn btn-primary btn-compact" onClick={() => setRepoModal({ repo: null })}>
              + خزانة جديدة
            </button>
          </div>

          {loadError ? (
            <p style={{ color: "var(--color-error)", fontSize: 14 }}>{loadError}</p>
          ) : loading ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>جارٍ التحميل…</p>
          ) : repos.length === 0 ? (
            <p className="empty-state">لا توجد خزانات مسجلة.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {repos.map((r) => (
                <div key={r.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: "var(--space-4)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: "var(--space-1)" }}>{r.name}</div>
                      <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                        <span style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "1px 6px", marginInlineEnd: "var(--space-2)", fontVariantNumeric: "tabular-nums" }}>
                          {r.place_key}
                        </span>
                        {r.location && r.location}
                      </div>
                      {r.notes && <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>{r.notes}</p>}
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-compact" type="button" onClick={() => setRepoModal({ repo: r })}>تعديل</button>
                      <button className="btn btn-danger btn-compact"    type="button" onClick={() => askDelete(r)}>حذف</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── التصدير ──────────────────────────────────────────────── */}
      {section === "export" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <span className="section-heading" style={{ marginBottom: 0 }}>التصدير</span>

          {/* Shared folder */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "var(--space-4)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--color-text-muted)" }}>
              مجلد التصدير — يُستخدم لـ JSON و Excel
            </div>
            <FolderPicker value={exportFolder} onChange={setExportFolder} placeholder="اختر مجلداً لحفظ ملفات التصدير…" />
          </div>

          {/* JSON */}
          <ExportCard
            format="JSON"
            title="نسخة احتياطية كاملة"
            subtitle="تصدير جميع البيانات كملف JSON للنسخ الاحتياطي أو الاستيراد"
            state={jsonState}
            message={jsonMsg}
            onExport={doExportJson}
          />

          {/* Excel */}
          <ExportCard
            format="Excel"
            title="فهرس المخطوطات"
            subtitle="ورقة بكل المصنَّفات (صف لكل مصنَّف) + ورقة منفصلة بالأشخاص، مع ترويسة أرشيف عرفان"
            state={excelState}
            message={excelMsg}
            onExport={doExportExcel}
          />

          {/* PDF */}
          <ExportCard
            format="PDF"
            title="الفهرس المطبوع"
            subtitle="كتالوج مُنسَّق: صفحة غلاف وبطاقة لكل مجلد تضم مصنَّفاته وأشخاصه، وفهرس الأشخاص في الختام"
            state={pdfState}
            message={pdfMsg}
            onExport={doExportPdf}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>
                موقع حفظ ملف PDF
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                <input
                  type="text"
                  className="input"
                  value={pdfPath}
                  onChange={(e) => setPdfPath(e.target.value)}
                  placeholder="اضغط «اختر» لتحديد موقع الحفظ…"
                  style={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: 12,
                    direction: "ltr",
                    textAlign: "left",
                  }}
                />
                {window.archive?.savePdf && (
                  <button className="btn btn-secondary btn-compact" type="button" onClick={pickPdfPath}>
                    اختر
                  </button>
                )}
              </div>
            </div>
          </ExportCard>
        </div>
      )}

      {/* ── الإعدادات ─────────────────────────────────────────────── */}
      {section === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <span className="section-heading" style={{ marginBottom: 0 }}>الإعدادات</span>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 480 }}>

            {/* Researcher name */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: "var(--space-2)" }}>
                اسم الباحث
              </label>
              <input
                type="text"
                className="input"
                value={researcherName}
                onChange={(e) => setResearcherName(e.target.value)}
                placeholder="يُستخدم في صفحة الغلاف وترويسة ملفات التصدير"
              />
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                يظهر في صفحة غلاف PDF وعناوين ملفات Excel
              </p>
            </div>

            {/* Default export folder */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: "var(--space-2)" }}>
                مجلد التصدير الافتراضي
              </label>
              <FolderPicker
                value={defaultFolder}
                onChange={setDefaultFolder}
                placeholder="يُملأ تلقائياً في صفحة التصدير…"
              />
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                يُستخدم تلقائياً عند فتح تبويب التصدير
              </p>
            </div>

            {/* Database location */}
            {window.archive?.getDbPath && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: "var(--space-2)" }}>
                  موقع قاعدة البيانات
                </label>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    direction: "ltr",
                    textAlign: "left",
                    wordBreak: "break-all",
                    background: "var(--color-surface-muted)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px 10px",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  {dbPath || "…"}
                </div>
                <button className="btn btn-secondary btn-compact" type="button" onClick={chooseDbLocation}>
                  نقل قاعدة البيانات إلى موقع آخر
                </button>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: "var(--space-2)", lineHeight: 1.6 }}>
                  يمكن نقل قاعدة البيانات إلى قرص خارجي لاستخدامها من أكثر من جهاز. استخدم القرص من جهاز واحد
                  في كل مرة، وأغلق البرنامج بالكامل قبل فصل القرص لتفادي تلف البيانات.
                </p>

                {dbConflict && (
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      fontSize: 13,
                      background: "#fdecea",
                      border: "1px solid #f5c0ba",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span>
                      يوجد بالفعل قاعدة بيانات أخرى على هذا القرص في موقع مختلف:
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, direction: "ltr", textAlign: "left", wordBreak: "break-all" }}>
                      {dbConflict.foundPath}
                    </span>
                    <span>
                      هل تقصد استخدام هذه القاعدة (على الأرجح أُعدَّت من جهاز آخر)، أم إنشاء قاعدة جديدة في الموقع الذي اخترته؟
                    </span>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button className="btn btn-primary btn-compact" type="button" onClick={() => resolveDbConflict(dbConflict.foundPath)}>
                        استخدام القاعدة الموجودة
                      </button>
                      <button className="btn btn-secondary btn-compact" type="button" onClick={() => resolveDbConflict(dbConflict.path)}>
                        إنشاء قاعدة جديدة هنا
                      </button>
                    </div>
                  </div>
                )}

                {dbPending && (
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      fontSize: 13,
                      background: "#fff8e6",
                      border: "1px solid #f0ddab",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span>
                      {dbPending.existed
                        ? "تم العثور على قاعدة بيانات موجودة في هذا الموقع. سيتم استخدامها بعد إعادة تشغيل البرنامج."
                        : "سيتم نسخ قاعدة البيانات الحالية إلى هذا الموقع بعد إعادة تشغيل البرنامج."}
                    </span>
                    <div>
                      <button className="btn btn-primary btn-compact" type="button" onClick={restartApp}>
                        إعادة التشغيل الآن
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <button className="btn btn-primary" type="button" onClick={saveSettings}>
                حفظ الإعدادات
              </button>
              {settingsSaved && (
                <span style={{ fontSize: "var(--font-size-label)", color: "#2a6b30" }}>
                  ✓ تم الحفظ
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {repoModal !== null && (
        <RepoFormModal repo={repoModal.repo} onSaved={handleRepoSaved} onCancel={() => setRepoModal(null)} />
      )}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
