import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import type { UserProfile } from '../types';

// Re-export types so existing imports from AuthContext still work
export type { ExperienceEntry, ProjectEntry, EducationEntry, GithubRepo, UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('jb_token'));
  const [isLoading, setIsLoading] = useState(true);

  /** Hydrate profile from server using stored token */
  const refreshProfile = useCallback(async () => {
    const stored = localStorage.getItem('jb_token');
    if (!stored) { setIsLoading(false); return; }
    try {
      const res = await api.get(`/profile/me?token=${stored}`);
      setUser(res.data);
    } catch {
      localStorage.removeItem('jb_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, profile } = res.data;
    localStorage.setItem('jb_token', t);
    setToken(t);
    setUser(profile);
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await api.post('/auth/register', { name, email, phone, password });
    const { token: t, profile } = res.data;
    localStorage.setItem('jb_token', t);
    setToken(t);
    setUser(profile);
  };

  const logout = () => {
    localStorage.removeItem('jb_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const stored = localStorage.getItem('jb_token');
    if (!stored) throw new Error('Not authenticated');
    await api.put(`/profile/me?token=${stored}`, data);
    // Re-fetch the full profile from server to guarantee UI shows persisted data
    await refreshProfile();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
