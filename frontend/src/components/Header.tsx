import "./Header.css";

export function Header() {
  return (
    <header className="app-header" role="banner">
      <div className="header-brand">
        <img
          src="/irfan_logo.png"
          alt="شعار أرشيف عرفان"
          className="header-logo"
        />
        <div className="header-name">
          <span className="header-name-ar">أرشيف عرفان</span>
          <span className="header-name-en">Irfan Archive</span>
        </div>
      </div>
      <div className="header-center" />
      <div className="header-end" />
    </header>
  );
}
