import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";

export function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const { settings: branding } = useBranding();
  const navigate = useNavigate();

  const forced = user?.mustChangePassword ?? false;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords don't match");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      await refreshUser();
      navigate("/");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not change password";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">
          {(branding?.shortName ?? branding?.name ?? "S").slice(0, 1)}
        </div>
        <h1 className="auth-title">{branding?.name ?? "School Portal"}</h1>
        <p className="muted">
          {forced ? "Set a new password to continue" : "Change your password"}
        </p>

        {forced && (
          <div
            role="alert"
            style={{
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fcd34d",
              borderRadius: 10,
              padding: "10px 12px",
              margin: "4px 0 14px",
              fontSize: 13,
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            🔒 <strong>Password update required.</strong> For your security, you
            must set a new password before you can continue using the portal.
          </div>
        )}

        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="inline-btn btn-block" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>

        {!forced && (
          <p className="hint" style={{ textAlign: "center" }}>
            <Link to="/">← Back to dashboard</Link>
          </p>
        )}
      </form>
    </div>
  );
}
