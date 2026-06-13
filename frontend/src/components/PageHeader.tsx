import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function PageHeader({ title }: { title: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <Link className="link" to="/">
        ← Dashboard
      </Link>
      <strong>{title}</strong>
      <span className="spacer" />
      <span className="muted">{user?.email}</span>
      <button className="link" onClick={logout}>
        Sign out
      </button>
    </header>
  );
}
