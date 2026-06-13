import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../lib/types";

interface Props {
  children: ReactNode;
  roles?: Role[]; // if set, the user must hold one of these roles
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
