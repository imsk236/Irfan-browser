import "./Navigation.css";

export type Screen = "volumes" | "annotations" | "persons" | "trace";

interface Props {
  active: Screen;
  onNavigate: (screen: Screen) => void;
}

const NAV_ITEMS: { id: Screen; label: string }[] = [
  { id: "volumes", label: "المجلدات" },
  { id: "annotations", label: "التقييدات" },
  { id: "persons", label: "الأشخاص" },
  { id: "trace", label: "تتبع عالم" },
];

export function Navigation({ active, onNavigate }: Props) {
  return (
    <nav className="nav-sidebar">
      <div className="nav-logo">
        <span className="nav-logo-mark">أ</span>
        <span className="nav-logo-text">أرشيف إرفان</span>
      </div>
      <ul className="nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
