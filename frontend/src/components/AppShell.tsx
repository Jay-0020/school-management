import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import { useTheme } from "../context/ThemeContext";
import { navForRole } from "../lib/nav";
import {
  IconChevronDown,
  IconClose,
  IconKey,
  IconLogout,
  IconMenu,
  IconMoon,
  IconSun,
} from "./icons";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useBranding();
  const { theme, toggle } = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const groups = user ? navForRole(user.role) : [];
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="shell">
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="brand-logo" />
          ) : (
            <span className="brand-mark">{(settings?.shortName ?? "S").slice(0, 2)}</span>
          )}
          <span className="brand-name">{settings?.shortName ?? settings?.name ?? "School"}</span>
          <button className="icon-btn nav-close" onClick={() => setNavOpen(false)}>
            <IconClose />
          </button>
        </div>

        <nav className="nav">
          {groups.map((g, i) => (
            <div className="nav-group" key={g.label || i}>
              {g.label && <p className="nav-group-label">{g.label}</p>}
              {g.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                  onClick={() => setNavOpen(false)}
                >
                  <item.icon className="nav-icon" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn show-mobile" onClick={() => setNavOpen(true)}>
            <IconMenu />
          </button>
          <h1 className="page-title">{title}</h1>
          <span className="spacer" />

          <button className="icon-btn" onClick={toggle} title="Toggle theme">
            {theme === "light" ? <IconMoon /> : <IconSun />}
          </button>

          <div className="user-menu" ref={menuRef}>
            <button className="user-btn" onClick={() => setMenuOpen((o) => !o)}>
              <span className="avatar">{initials}</span>
              <span className="user-meta">
                <span className="user-email">{user?.email}</span>
                <span className="user-role">{user?.role}</span>
              </span>
              <IconChevronDown className="caret" />
            </button>
            {menuOpen && (
              <div className="menu-pop">
                <Link to="/change-password" className="menu-row" onClick={() => setMenuOpen(false)}>
                  <IconKey className="nav-icon" /> Change password
                </Link>
                <button className="menu-row" onClick={logout}>
                  <IconLogout className="nav-icon" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
