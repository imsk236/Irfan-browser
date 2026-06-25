import { useEffect, useState } from "react";

type UpdateState = "idle" | "available" | "downloading" | "ready";

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>("idle");
  const [version, setVersion] = useState("");
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!window.archive) return;

    const removeAvailable = window.archive.onUpdateAvailable?.((info) => {
      setVersion(info.version);
      setState("available");
    });

    const removeProgress = window.archive.onUpdateProgress?.((info) => {
      setPercent(info.percent);
      setState("downloading");
    });

    const removeDownloaded = window.archive.onUpdateDownloaded?.(() => {
      setState("ready");
    });

    return () => {
      removeAvailable?.();
      removeProgress?.();
      removeDownloaded?.();
    };
  }, []);

  if (state === "idle") return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#18230F",
      color: "#C8DFA0",
      direction: "rtl",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 20px",
      fontSize: 13,
      fontFamily: "var(--font-family)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    }}>
      {state === "available" && (
        <>
          <span style={{ flex: 1 }}>
            تحديث جديد متاح — الإصدار <strong style={{ color: "#D0E5A8" }}>{version}</strong>
          </span>
          <button
            onClick={() => window.archive?.downloadUpdate?.()}
            style={{
              background: "#4B6426",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              padding: "5px 14px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "var(--font-family)",
            }}
          >
            تنزيل التحديث
          </button>
          <button
            onClick={() => setState("idle")}
            aria-label="إغلاق"
            style={{
              background: "transparent",
              color: "rgba(195,215,165,0.6)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            ×
          </button>
        </>
      )}

      {state === "downloading" && (
        <>
          <span style={{ flex: 1 }}>جارٍ تنزيل التحديث…</span>
          <div style={{
            width: 140,
            height: 6,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 3,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: "100%",
              background: "#8BB552",
              borderRadius: 3,
              transform: `scaleX(${percent / 100})`,
              transformOrigin: "right center",
              transition: "transform 300ms ease",
            }} />
          </div>
          <span style={{ minWidth: 36, textAlign: "center", color: "#D0E5A8" }}>{percent}%</span>
        </>
      )}

      {state === "ready" && (
        <>
          <span style={{ flex: 1 }}>
            التحديث جاهز — أعد تشغيل التطبيق لتطبيق الإصدار <strong style={{ color: "#D0E5A8" }}>{version}</strong>
          </span>
          <button
            onClick={() => window.archive?.installUpdate?.()}
            style={{
              background: "#4B6426",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              padding: "5px 14px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "var(--font-family)",
            }}
          >
            إعادة التشغيل الآن
          </button>
          <button
            onClick={() => setState("idle")}
            aria-label="لاحقاً"
            style={{
              background: "transparent",
              color: "rgba(195,215,165,0.6)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
