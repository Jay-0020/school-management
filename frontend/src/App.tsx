import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastViewport } from "./components/ToastViewport";
import { AttendancePage } from "./pages/AttendancePage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamsPage } from "./pages/ExamsPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { FeesPage } from "./pages/FeesPage";
import { LeavePage } from "./pages/LeavePage";
import { LoginPage } from "./pages/LoginPage";
import { NoticesPage } from "./pages/NoticesPage";
import { PeoplePage } from "./pages/PeoplePage";
import { ProfilePage } from "./pages/ProfilePage";
import { PayrollPage } from "./pages/PayrollPage";
import { SchoolSetupPage } from "./pages/SchoolSetupPage";
import { SchoolworkPage } from "./pages/SchoolworkPage";
import { StudentsPage } from "./pages/StudentsPage";
import { TeachersPage } from "./pages/TeachersPage";
import { UsersPage } from "./pages/UsersPage";

export function App() {
  return (
    <>
      <ToastViewport />
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
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave"
        element={
          <ProtectedRoute>
            <LeavePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/people"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER"]}>
            <PeoplePage />
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
      <Route
        path="/exams"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER", "STUDENT", "PARENT"]}>
            <ExamsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payroll"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER"]}>
            <PayrollPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER"]}>
            <ExpensesPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
