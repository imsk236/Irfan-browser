import { useEffect, useState } from "react";
import { Navigation, type Screen } from "./components/Navigation";
import { VolumesScreen } from "./screens/volumes/VolumesScreen";
import { AnnotationsScreen } from "./screens/annotations/AnnotationsScreen";
import { PersonsScreen } from "./screens/persons/PersonsScreen";
import { TraceScreen } from "./screens/trace/TraceScreen";
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
        // Running inside Electron — get the port from the preload bridge
        const port = await window.archive.getBackendPort();
        setBaseUrl(`http://127.0.0.1:${port}`);
      }
      // In dev without Electron, defaults to localhost:8000 from client.ts
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", direction: "rtl" }}>
        <p style={{ color: "#354e24" }}>جارٍ التحميل…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", direction: "rtl" }}>
      <Navigation active={screen} onNavigate={setScreen} />
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {screen === "volumes" && <VolumesScreen />}
        {screen === "annotations" && <AnnotationsScreen />}
        {screen === "persons" && <PersonsScreen />}
        {screen === "trace" && <TraceScreen />}
      </main>
    </div>
  );
}

export default App;
