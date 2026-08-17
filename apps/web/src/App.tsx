import { Center, Loader } from '@mantine/core';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { LocalLoginPage } from './pages/LocalLoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { FindingEditorPage } from './pages/FindingEditorPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { DesignsPage } from './pages/DesignsPage';
import { UsersPage } from './pages/UsersPage';
import { AccessPage } from './pages/AccessPage';
import { AuditPage } from './pages/AuditPage';
import { AccountPage } from './pages/AccountPage';
import { DashboardPage } from './pages/DashboardPage';
import { MfaSetupPage } from './pages/MfaSetupPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Center h="100vh">
        <Loader color="brandGreen" />
      </Center>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // MFA required on first access: without enrollment, only the setup screen.
  if (!user.mfaEnrolled) return <Navigate to="/mfa-setup" replace />;
  return <>{children}</>;
}

/** Setup screen gate: requires a session and no MFA yet (otherwise goes to the app). */
function MfaSetupGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Center h="100vh">
        <Loader color="brandGreen" />
      </Center>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.mfaEnrolled) return <Navigate to="/projects" replace />;
  return <MfaSetupPage />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/projects" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Public authentication routes */}
      <Route path="/login" element={<LoginPage />} />
      {/* UNDISCLOSED local admin route (break-glass) */}
      <Route path="/auth/local" element={<LocalLoginPage />} />
      {/* First access: mandatory MFA enrollment (outside the Layout) */}
      <Route path="/mfa-setup" element={<MfaSetupGate />} />

      {/* Authenticated area */}
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/findings/:findingId" element={<FindingEditorPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/designs"
          element={
            <AdminOnly>
              <DesignsPage />
            </AdminOnly>
          }
        />
        <Route
          path="/users"
          element={
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="/access"
          element={
            <AdminOnly>
              <AccessPage />
            </AdminOnly>
          }
        />
        <Route
          path="/audit"
          element={
            <AdminOnly>
              <AuditPage />
            </AdminOnly>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
