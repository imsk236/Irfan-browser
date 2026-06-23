import { Books, Users, MagnifyingGlass, Gear, SquaresFour } from "@phosphor-icons/react";
import "./Navigation.css";

export type Screen = "dashboard" | "volumes" | "persons" | "trace" | "settings";

interface Props {
  active: Screen;
  onNavigate: (screen: Screen) => void;
}

const NAV_ITEMS: { id: Screen; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard", label: "لوحة المتابعة",  Icon: SquaresFour },
  { id: "volumes",   label: "المجلدات",        Icon: Books },
  { id: "persons",   label: "الأشخاص",         Icon: Users },
  { id: "trace",     label: "البحث والتتبع",   Icon: MagnifyingGlass },
  { id: "settings",  label: "الإعدادات",        Icon: Gear },
];

export function Navigation({ active, onNavigate }: Props) {
  return (
    <nav className="nav-sidebar" aria-label="القائمة الرئيسية">
      <div className="nav-brand">
        <div className="nav-logo-wrap">
          <img
            src="/irfan_logo.png"
            alt="عرفان"
            className="nav-logo"
            aria-hidden="true"
          />
        </div>
        <span className="nav-brand-ar">أرشيف عرفان</span>
        <span className="nav-brand-en">Irfan Archive</span>
      </div>
      <ul className="nav-list" role="list">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <li key={id}>
            <button
              className={`nav-item ${active === id ? "active" : ""}`}
              onClick={() => onNavigate(id)}
              aria-current={active === id ? "page" : undefined}
            >
              <Icon
                size={17}
                weight={active === id ? "bold" : "regular"}
                className="nav-icon"
                aria-hidden="true"
              />
              <span className="nav-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
