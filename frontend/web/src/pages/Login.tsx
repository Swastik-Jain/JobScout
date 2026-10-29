import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint, Mail, Lock, ArrowRight, UserCircle, AlertCircle,
  FileText, Target, CheckCircle2, ShieldCheck, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    if (fieldErrors[key]) {
      setFieldErrors(fe => ({ ...fe, [key]: undefined }));
    }
  };

  const validate = () => {
    const errs: { name?: string; email?: string; password?: string } = {};
    if (!isLogin && !form.name.trim()) errs.name = 'Please enter your full name.';
    if (!form.email.trim()) {
      errs.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!form.password) {
      errs.password = 'Please enter your password.';
    } else if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setLoading(true);
    const cleanEmail = form.email.trim().toLowerCase();
    try {
      if (isLogin) {
        const profile = await login(cleanEmail, form.password);
        if (profile.profile_complete) {
          navigate('/jobs');
        } else {
          navigate('/onboarding');
        }
      } else {
        await register(form.name.trim(), cleanEmail, form.password);
        navigate('/onboarding');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        (err?.message === 'Network Error' || !err?.response
          ? 'Cannot connect to backend server. Please check your connection or CORS settings.'
          : (isLogin ? 'Invalid email or password.' : 'Registration failed. Please try again.'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <Target size={18} className="text-blue-400" />, text: 'Verified roles from official employer ATS feeds' },
    { icon: <FileText size={18} className="text-purple-400" />, text: 'Resumes tailored strictly from your real profile' },
    { icon: <ShieldCheck size={18} className="text-emerald-400" />, text: 'Honest materials — no fabricated experience' },
    { icon: <CheckCircle2 size={18} className="text-cyan-400" />, text: 'Pipeline tracking from saved to offer' },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left: Brand Panel ── */}
      <div className="hidden lg:flex flex-col w-[50%] relative overflow-hidden bg-zinc-950 border-r border-zinc-800/60 p-14 justify-between">
        {/* Glows */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-900/15 blur-[140px] rounded-full pointer-events-none -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-[350px] h-[350px] bg-purple-900/15 blur-[100px] rounded-full pointer-events-none translate-x-1/4 translate-y-1/4" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Fingerprint size={20} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">JobScout</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-6 relative z-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white leading-tight mb-3">
              Find verified roles. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Tailor honest applications.
              </span>
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
              Discover active job board listings, tailor your materials strictly from your confirmed experience, and keep your pipeline organized.
            </p>
          </div>

          <div className="space-y-3">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/40 flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <span className="text-zinc-300 text-sm font-medium">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-zinc-600 text-xs relative z-10">
          &copy; 2026 JobScout. Transparent job discovery, grounded tailoring & application tracking.
        </p>
      </div>

      {/* ── Right: Auth Form ── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
              <Fingerprint size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">JobScout</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1.5">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-zinc-400 text-sm mb-6">
            {isLogin
              ? 'Sign in to access your saved jobs and applications.'
              : 'Sign up to discover verified roles and tailor application materials.'}
          </p>

          {/* Tab Toggle */}
          <div className="flex bg-zinc-900/80 rounded-xl p-1 mb-6 border border-zinc-800 gap-1">
            {(['Login', 'Register'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { setIsLogin(tab === 'Login'); setError(null); setFieldErrors({}); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  (tab === 'Login') === isLogin
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-3.5 py-2.5 mb-5 text-xs"
              >
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Name (register only) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className={`relative border rounded-xl overflow-hidden transition-colors bg-zinc-900/60 ${fieldErrors.name ? 'border-red-500/70' : 'border-zinc-700/60 focus-within:border-blue-500'}`}>
                    <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="Full name"
                      className="w-full bg-transparent pl-11 pr-4 py-3 text-white text-sm outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  {fieldErrors.name && (
                    <p className="text-red-400 text-xs mt-1.5 pl-1">{fieldErrors.name}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className={`relative border rounded-xl overflow-hidden transition-colors bg-zinc-900/60 ${fieldErrors.email ? 'border-red-500/70' : 'border-zinc-700/60 focus-within:border-blue-500'}`}>
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="name@domain.com"
                  className="w-full bg-transparent pl-11 pr-4 py-3 text-white text-sm outline-none placeholder:text-zinc-600"
                />
              </div>
              {fieldErrors.email && (
                <p className="text-red-400 text-xs mt-1.5 pl-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className={`relative border rounded-xl overflow-hidden transition-colors bg-zinc-900/60 ${fieldErrors.password ? 'border-red-500/70' : 'border-zinc-700/60 focus-within:border-blue-500'}`}>
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  className="w-full bg-transparent pl-11 pr-11 py-3 text-white text-sm outline-none placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-red-400 text-xs mt-1.5 pl-1">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-4 py-3 mt-3 flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-900/30 text-sm gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};
