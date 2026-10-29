import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Overview } from './pages/Overview';
import { Profile } from './pages/Profile';
import { MissionControl } from './pages/MissionControl';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TerminalProvider } from './contexts/TerminalContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowIncomplete?: boolean;
}

/**
 * Route Guard:
 * - Redirects unauthenticated users to /login
 * - Redirects incomplete profiles to /onboarding (unless allowIncomplete is true)
 * - Redirects complete profiles visiting /onboarding to /jobs
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowIncomplete = false }) => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;

  if (user) {
    if (!user.profile_complete && !allowIncomplete) {
      return <Navigate to="/onboarding" replace />;
    }
    if (user.profile_complete && allowIncomplete) {
      return <Navigate to="/jobs" replace />;
    }
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <TerminalProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/onboarding"
              element={
                <ProtectedRoute allowIncomplete={true}>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
            </Route>

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
              <Route path="profile" element={<Profile />} />
              <Route path="applications" element={<MissionControl />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </TerminalProvider>
    </AuthProvider>
  );
}

export default App;
