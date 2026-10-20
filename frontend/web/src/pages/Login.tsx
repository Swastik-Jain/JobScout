import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint, Mail, Lock, ArrowRight, UserCircle, Phone, AlertCircle,
  BrainCircuit, Target, Rocket, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.phone, form.password);
      }
      navigate('/dashboard/profile');
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        (isLogin ? 'Invalid email or password.' : 'Registration failed. Email may already be in use.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <BrainCircuit size={20} className="text-purple-400" />, text: 'AI-powered resume optimization' },
    { icon: <Target size={20} className="text-blue-400" />, text: 'Autonomous job discovery & matching' },
    { icon: <Rocket size={20} className="text-green-400" />, text: 'One-click application deployment' },
    { icon: <ShieldCheck size={20} className="text-yellow-400" />, text: 'Real-time fraud detection engine' },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left: Brand Panel ── */}
      <div className="hidden lg:flex flex-col w-[55%] relative overflow-hidden bg-zinc-950 border-r border-zinc-800/60 p-16 justify-between">
        {/* Glows */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-900/15 blur-[140px] rounded-full pointer-events-none -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-900/15 blur-[100px] rounded-full pointer-events-none translate-x-1/4 translate-y-1/4" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Fingerprint size={22} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-xl tracking-tight">JobAgent</span>
            <span className="text-xs text-zinc-500 font-mono ml-2">v2.0</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-8 relative z-10">
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-white leading-tight mb-4">
              Your AI-powered<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                career co-pilot.
              </span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-md">
              Deploy specialized agents to optimize your resume, discover matching jobs, and automatically submit applications — 24/7.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-5 py-3.5"
              >
                <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/40 flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <span className="text-zinc-300 font-medium">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-zinc-600 text-sm relative z-10">
          &copy; 2025 JobAgent. All agent activity is logged & encrypted.
        </p>
      </div>

      {/* ── Right: Auth Form ── */}
      <div className="flex-1 flex items-center justify-center p-10 relative">
        {/* Mobile glow */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Fingerprint size={18} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl">JobAgent</span>
          </div>

          <h2 className="text-4xl font-bold text-white mb-2">
            {isLogin ? 'Welcome back' : 'Get started'}
          </h2>
          <p className="text-zinc-400 text-base mb-8">
            {isLogin
              ? 'Sign in to your agent dashboard.'
              : 'Create your profile — stored permanently and loaded every session.'}
          </p>

          {/* Tab Toggle */}
          <div className="flex bg-zinc-900/80 rounded-xl p-1 mb-8 border border-zinc-800 gap-1">
            {(['Login', 'Register'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { setIsLogin(tab === 'Login'); setError(null); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
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
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm"
              >
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name (register only) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Full Name</label>
                  <div className="relative border border-zinc-700/60 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors bg-zinc-900/60">
                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                      required={!isLogin}
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="John Doe"
                      className="w-full bg-transparent pl-12 pr-4 py-4 text-white text-base outline-none placeholder:text-zinc-600"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Phone (register only) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Phone</label>
                  <div className="relative border border-zinc-700/60 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors bg-zinc-900/60">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+91 98765 43210"
                      className="w-full bg-transparent pl-12 pr-4 py-4 text-white text-base outline-none placeholder:text-zinc-600"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative border border-zinc-700/60 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors bg-zinc-900/60">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="john@example.com"
                  className="w-full bg-transparent pl-12 pr-4 py-4 text-white text-base outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative border border-zinc-700/60 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors bg-zinc-900/60">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  className="w-full bg-transparent pl-12 pr-4 py-4 text-white text-base outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-4 py-4 mt-2 flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(37,99,235,0.25)] text-base gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};
