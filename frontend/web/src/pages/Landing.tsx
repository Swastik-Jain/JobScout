import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Target, CheckCircle2, Activity, Loader2, ShieldCheck, FileText } from 'lucide-react';
import { resolveApiUrl } from '../lib/api';

interface Stats {
  jobs_scanned: number;
  applications_submitted: number;
  avg_ats_score: number;
  platforms_active: number;
  system_status: string;
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

const StatCard: React.FC<{
  label: string;
  value: number | string;
  sub: React.ReactNode;
  valueClass?: string;
  animate?: boolean;
}> = ({ label, value, sub, valueClass = 'text-white', animate = true }) => {
  const numVal = typeof value === 'number' ? value : 0;
  const animated = useCountUp(animate ? numVal : 0);
  const display = typeof value === 'string' ? value : animated.toLocaleString();

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-7 relative overflow-hidden">
      <p className="text-zinc-500 text-xs font-mono uppercase mb-2">{label}</p>
      <p className={`text-4xl font-bold ${valueClass}`}>{display}</p>
      <div className="mt-3 flex items-center text-sm text-zinc-400">{sub}</div>
      {typeof value === 'string' && value === 'Operational' && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full pointer-events-none" />
      )}
    </div>
  );
};

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(resolveApiUrl('/api/stats'))
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setStats({
          jobs_scanned: 0,
          applications_submitted: 0,
          avg_ats_score: 0,
          platforms_active: 0,
          system_status: 'Operational',
        });
        setLoading(false);
      });
  }, []);

  const features = [
    {
      title: 'Verified Role Discovery',
      description:
        'Scans live Greenhouse, Lever, and Ashby portals directly. You see genuine, active postings without ghost jobs, outdated listings, or scraper spam.',
      icon: <Target className="text-blue-400 mb-4" size={28} />,
    },
    {
      title: 'Grounded Material Tailoring',
      description:
        'Tailors resumes, cover notes, and role-specific Q&A strictly using verified facts from your confirmed profile. Never fabricates skills or experience.',
      icon: <FileText className="text-purple-400 mb-4" size={28} />,
    },
    {
      title: 'Human-in-the-Loop Pipeline',
      description:
        'You stay in full control. Review tailored materials, open official employer portals to submit, and manage every stage in your application tracker.',
      icon: <CheckCircle2 className="text-emerald-400 mb-4" size={28} />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-900/80 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </span>
            <span className="text-white font-semibold text-base tracking-tight">JobScout</span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto w-full px-8 space-y-20 py-10 flex-1">
        {/* Hero Section */}
        <section className="relative text-center space-y-8 py-16 px-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-1.5 text-xs text-zinc-400 mb-4 backdrop-blur-md"
          >
            <ShieldCheck size={14} className="text-blue-400" />
            <span>Verified Company Openings & Grounded Tailoring</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-tight"
          >
            Find verified roles. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Tailor honest applications.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            JobScout indexes live ATS job boards, tailors your materials strictly from your confirmed experience, and gives you a clear tracker from first save to final offer.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10"
          >
            <button
              onClick={() => navigate('/login')}
              className="flex items-center px-7 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/30 text-sm cursor-pointer"
            >
              Get Started <ArrowRight className="ml-2" size={16} />
            </button>
          </motion.div>
        </section>

        {/* Value Proposition Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + idx * 0.1 }}
              className="glass p-8 rounded-2xl relative overflow-hidden group glass-hover space-y-2 border border-zinc-800/80"
            >
              {feature.icon}
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-zinc-400 leading-relaxed text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </section>

        {/* Live System Metrics */}
        <section id="metrics" className="border-t border-zinc-900/80 pt-16">
          <div className="flex items-center space-x-2 mb-8">
            <Activity className="text-zinc-500" size={20} />
            <h2 className="text-xl font-bold tracking-tight text-white">Platform Activity</h2>
            {loading && <Loader2 size={15} className="text-zinc-600 animate-spin ml-2" />}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-7 animate-pulse">
                  <div className="h-3 bg-zinc-800 rounded w-2/3 mb-4" />
                  <div className="h-10 bg-zinc-800 rounded w-1/2 mb-3" />
                  <div className="h-3 bg-zinc-800 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-5"
            >
              <StatCard
                label="Verified Jobs Indexed"
                value={stats!.jobs_scanned}
                sub={
                  stats!.jobs_scanned > 0 ? (
                    <span className="text-green-400 flex items-center gap-1 text-xs">
                      <CheckCircle2 size={13} /> Active in catalog
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-xs">Live ATS feed integration</span>
                  )
                }
              />
              <StatCard
                label="Applications Tracked"
                value={stats!.applications_submitted}
                sub={
                  stats!.applications_submitted > 0 ? (
                    <span className="text-blue-400 flex items-center gap-1 text-xs">
                      <CheckCircle2 size={13} /> In user pipelines
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-xs">Track saved to offer</span>
                  )
                }
                valueClass="text-blue-400"
              />
              <StatCard
                label="Avg Match Score"
                value={stats!.avg_ats_score}
                sub={
                  stats!.avg_ats_score > 0 ? (
                    <span className="text-green-400 flex items-center gap-1 text-xs">
                      <CheckCircle2 size={13} /> Profile alignment
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-xs">Based on verified skills</span>
                  )
                }
                valueClass={stats!.avg_ats_score >= 80 ? 'text-green-400' : stats!.avg_ats_score > 0 ? 'text-yellow-400' : 'text-zinc-500'}
              />
              <StatCard
                label="System Status"
                value={stats!.system_status}
                animate={false}
                sub={<span className="text-zinc-500 text-xs">ATS feeds operational</span>}
                valueClass="text-green-400"
              />
            </motion.div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 px-8 text-center text-xs text-zinc-500">
        &copy; 2026 JobScout. Transparent job discovery, grounded tailoring & application tracking.
      </footer>
    </div>
  );
};
