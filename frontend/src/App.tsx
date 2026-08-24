import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './store/auth';
import { AppLayout } from './components/layout/AppLayout';
import { PageLoader } from './components/ui/Alert';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Patient pages
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { FindDoctorsPage } from './pages/patient/FindDoctorsPage';
import { BookAppointmentPage } from './pages/patient/BookAppointmentPage';
import { PatientAppointmentsPage } from './pages/patient/PatientAppointmentsPage';
import { AppointmentDetailPage } from './pages/patient/AppointmentDetailPage';
import { PatientMedicationsPage } from './pages/patient/PatientMedicationsPage';
import { PatientProfilePage } from './pages/patient/PatientProfilePage';

// Doctor pages
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { DoctorAppointmentsPage } from './pages/doctor/DoctorAppointmentsPage';
import { DoctorAppointmentDetailPage } from './pages/doctor/DoctorAppointmentDetailPage';
import { DoctorLeaveManagementPage } from './pages/doctor/DoctorLeaveManagementPage';
import { DoctorSchedulePage } from './pages/doctor/DoctorSchedulePage';
import { DoctorProfilePage } from './pages/doctor/DoctorProfilePage';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminDoctorsPage } from './pages/admin/AdminDoctorsPage';
import { AdminPatientsPage } from './pages/admin/AdminPatientsPage';
import { AdminAppointmentsPage } from './pages/admin/AdminAppointmentsPage';
import { AdminSpecializationsPage } from './pages/admin/AdminSpecializationsPage';
import { AdminSystemPage } from './pages/admin/AdminSystemPage';
import { AdminProfilePage } from './pages/admin/AdminProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Route Guards ──────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function RequireRole({
  role,
  children,
}: {
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (user?.role !== role) {
    const redirect =
      user?.role === 'ADMIN'
        ? '/admin'
        : user?.role === 'DOCTOR'
        ? '/doctor'
        : '/patient';
    return <Navigate to={redirect} replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'DOCTOR') return <Navigate to="/doctor" replace />;
  return <Navigate to="/patient" replace />;
}

// ─── App Router ────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* ── Patient Portal ──────────────────────────────────────── */}
      <Route
        path="/patient"
        element={
          <RequireAuth>
            <RequireRole role="PATIENT">
              <AppLayout>
                <PatientDashboard />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/patient/doctors"
        element={
          <RequireAuth>
            <RequireRole role="PATIENT">
              <AppLayout>
                <FindDoctorsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/patient/doctors/:doctorId"
        element={
          <RequireAuth>
            <RequireRole role="PATIENT">
              <AppLayout>
                <BookAppointmentPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/patient/appointments"
        element={
          <RequireAuth>
            <RequireRole role="PATIENT">
              <AppLayout>
                <PatientAppointmentsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/patient/appointments/:id"
        element={
          <RequireAuth>
            <RequireRole role="PATIENT">
              <AppLayout>
                <AppointmentDetailPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/patient/medications"
        element={
          <RequireAuth>
            <RequireRole role="PATIENT">
              <AppLayout>
                <PatientMedicationsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/patient/profile"
        element={
          <RequireAuth>
            <RequireRole role="PATIENT">
              <AppLayout>
                <PatientProfilePage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* ── Doctor Portal ───────────────────────────────────────── */}
      <Route
        path="/doctor"
        element={
          <RequireAuth>
            <RequireRole role="DOCTOR">
              <AppLayout>
                <DoctorDashboard />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/doctor/appointments"
        element={
          <RequireAuth>
            <RequireRole role="DOCTOR">
              <AppLayout>
                <DoctorAppointmentsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/doctor/appointments/:id"
        element={
          <RequireAuth>
            <RequireRole role="DOCTOR">
              <AppLayout>
                <DoctorAppointmentDetailPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/doctor/schedule"
        element={
          <RequireAuth>
            <RequireRole role="DOCTOR">
              <AppLayout>
                <DoctorSchedulePage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/doctor/leave"
        element={
          <RequireAuth>
            <RequireRole role="DOCTOR">
              <AppLayout>
                <DoctorLeaveManagementPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/doctor/profile"
        element={
          <RequireAuth>
            <RequireRole role="DOCTOR">
              <AppLayout>
                <DoctorProfilePage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* ── Admin Portal ─────────────────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/doctors"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AppLayout>
                <AdminDoctorsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/patients"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AppLayout>
                <AdminPatientsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/appointments"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AppLayout>
                <AdminAppointmentsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/specializations"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AppLayout>
                <AdminSpecializationsPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/system"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AppLayout>
                <AdminSystemPage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AppLayout>
                <AdminProfilePage />
              </AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '10px',
                fontFamily: 'Manrope, Inter, sans-serif',
                fontSize: '13px',
                fontWeight: '600',
                background: '#fff',
                color: '#0F172A',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
                padding: '12px 16px',
              },
              success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
