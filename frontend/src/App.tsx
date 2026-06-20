import { useEffect, useState } from "react";
import { Navigation, type Screen } from "./components/Navigation";
import { Header } from "./components/Header";
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
    };
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>("volumes");
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
        background: "var(--color-page)",
      }}>
        <p style={{ color: "var(--color-text-muted)" }}>جارٍ التحميل…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", direction: "rtl" }}>
      <Header />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
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
          {screen === "volumes"  && <VolumesScreen />}
          {screen === "persons"  && <PersonsScreen />}
          {screen === "trace"    && <TraceScreen />}
          {screen === "settings" && <SettingsScreen />}
        </main>
      </div>
    </div>
  );
}

export default App;
