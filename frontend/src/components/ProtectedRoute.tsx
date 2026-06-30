import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../lib/types";

interface Props {
  children: ReactNode;
  roles?: Role[]; // if set, the user must hold one of these roles
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  // A pending password change is enforced server-side (the API 403s until it's
  // done), so route the user to the change-password screen instead of letting
  // them land on pages that would just error.
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
