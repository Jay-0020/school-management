import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AttendancePage } from "./pages/AttendancePage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FeesPage } from "./pages/FeesPage";
import { LoginPage } from "./pages/LoginPage";
import { NoticesPage } from "./pages/NoticesPage";
import { SchoolSetupPage } from "./pages/SchoolSetupPage";
import { SchoolworkPage } from "./pages/SchoolworkPage";
import { StudentsPage } from "./pages/StudentsPage";
import { TeachersPage } from "./pages/TeachersPage";
import { UsersPage } from "./pages/UsersPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/setup"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN"]}>
            <SchoolSetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"]}>
            <StudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teachers"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"]}>
            <TeachersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "TEACHER"]}>
            <AttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notices"
        element={
          <ProtectedRoute>
            <NoticesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN"]}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fees"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"]}>
            <FeesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schoolwork"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]}>
            <SchoolworkPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
