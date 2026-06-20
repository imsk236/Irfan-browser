import "./Navigation.css";

export type Screen = "volumes" | "persons" | "trace" | "settings";

interface Props {
  active: Screen;
  onNavigate: (screen: Screen) => void;
}

const NAV_ITEMS: { id: Screen; label: string; icon: string }[] = [
  { id: "volumes",  label: "المجلدات",       icon: "▦" },
  { id: "persons",  label: "الأشخاص",        icon: "◉" },
  { id: "trace",    label: "البحث والتتبع",   icon: "◎" },
  { id: "settings", label: "الإعدادات",       icon: "⚙" },
];

export function Navigation({ active, onNavigate }: Props) {
  return (
    <nav className="nav-sidebar" aria-label="القائمة الرئيسية">
      <ul className="nav-list" role="list">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
              aria-current={active === item.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
