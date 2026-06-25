import { useEffect, useState } from "react";
import { Navigation, type Screen } from "./components/Navigation";
import { UpdateBanner } from "./components/UpdateBanner";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { VolumesScreen } from "./screens/volumes/VolumesScreen";
import { PersonsScreen } from "./screens/persons/PersonsScreen";
import { TraceScreen } from "./screens/trace/TraceScreen";
import { SettingsScreen } from "./screens/settings/SettingsScreen";
import { setBaseUrl } from "./api/client";
import "./styles/global.css";
import "./styles/components.css";

declare global {
  interface Window {
    archive?: {
      getBackendPort: () => Promise<number>;
      openDirectory: () => Promise<string | null>;
      savePdf: () => Promise<string | null>;
      exportPdf: (outputPath: string, researcher: string) => Promise<{ file: string }>;
      onUpdateAvailable?: (cb: (info: { version: string }) => void) => () => void;
      onUpdateProgress?: (cb: (info: { percent: number }) => void) => () => void;
      onUpdateDownloaded?: (cb: () => void) => () => void;
      downloadUpdate?: () => Promise<void>;
      installUpdate?: () => Promise<void>;
    };
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      if (window.archive) {
        const port = await window.archive.getBackendPort();
        setBaseUrl(`http://127.0.0.1:${port}`);
      }
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        direction: "rtl",
        background: "var(--color-nav-bg)",
      }}>
        <div style={{ textAlign: "center" }}>
          <img
            src="/irfan_logo.png"
            alt="عرفان"
            style={{ width: 72, height: 72, marginBottom: 16, objectFit: "contain" }}
          />
          <div style={{ color: "var(--color-nav-brand-ar)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            أرشيف عرفان
          </div>
          <div style={{ color: "var(--color-nav-text)", fontSize: 13 }}>جارٍ التحميل…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", direction: "rtl", overflow: "hidden" }}>
      <UpdateBanner />
      <Navigation active={screen} onNavigate={setScreen} />
      <main
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-page)",
        }}
        role="main"
      >
        {screen === "dashboard" && <DashboardScreen onNavigate={setScreen} />}
        {screen === "volumes"   && <VolumesScreen />}
        {screen === "persons"   && <PersonsScreen />}
        {screen === "trace"     && <TraceScreen />}
        {screen === "settings"  && <SettingsScreen />}
      </main>
    </div>
  );
}

export default App;
