import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { IconCheck } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";

const FEATURES = [
  "Students, staff & attendance in one place",
  "Fees, payroll & expense approvals",
  "Homework, notices & role-based access",
];

export function LoginPage() {
  const { login } = useAuth();
  const { settings: branding } = useBranding();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name = branding?.name ?? "School Portal";
  const mark = (branding?.shortName ?? name).slice(0, 1);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-brandside">
        <div className="auth-brand-top">
          <span className="auth-brand-mark">{mark}</span>
          <span className="auth-brand-name">{name}</span>
        </div>
        <div className="auth-brand-mid">
          <h2>School management, simplified.</h2>
          <ul className="auth-features">
            {FEATURES.map((f) => (
              <li key={f}>
                <IconCheck /> {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-brand-foot">
          {branding?.contactEmail ?? ""}
        </p>
      </aside>

      <main className="auth-formside">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-logo">{mark}</div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="muted">Sign in to {name}</p>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="inline-btn btn-block" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
