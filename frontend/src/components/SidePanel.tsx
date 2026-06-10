import { useEffect } from "react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function SidePanel({ title, onClose, children }: Props) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div className="side-panel-backdrop" onClick={onClose} />
      <aside className="side-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: 17 }}>{title}</h2>
          <button className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>
        {children}
      </aside>
    </>
  );
}
