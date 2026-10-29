import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-zinc-900/80 bg-black/60 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </span>
          <span className="text-white font-semibold text-base tracking-tight">JobScout</span>
          <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">Onboarding</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Step 1 of 2</span>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Welcome{user?.name ? `, ${user.name}` : ''}. Let's set up your profile.
            </h1>
            <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">
              JobScout matches you with verified roles and tailors materials based strictly on your confirmed profile.
            </p>
          </div>

          <div className="glass p-8 rounded-2xl border border-zinc-800 space-y-6">
            <div className="border border-dashed border-zinc-700/80 hover:border-blue-500/60 rounded-xl p-8 text-center bg-zinc-900/40 transition group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Upload size={22} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Upload your existing resume</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                PDF or DOCX (up to 5MB). We extract your confirmed skills and education to autofill your profile.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500">Or continue with manual profile setup</span>
              <button
                onClick={() => navigate('/dashboard/profile')}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Enter Profile Manually <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900/80 py-4 px-8 text-center text-xs text-zinc-600">
        &copy; 2026 JobScout. Grounded application tailoring & tracking.
      </footer>
    </div>
  );
};
