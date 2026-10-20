import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Profile } from './pages/Profile';
import { MissionControl } from './pages/MissionControl';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TerminalProvider } from './contexts/TerminalContext';

/** Redirects unauthenticated users to /login */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  if (!token) return <Navigate to="/login" replace />;
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
          </Routes>
        </Router>
      </TerminalProvider>
    </AuthProvider>
  );
}

export default App;
