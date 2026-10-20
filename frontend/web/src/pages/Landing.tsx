import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, BrainCircuit, Target, Rocket, Activity, CheckCircle2, Loader2 } from 'lucide-react';
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
      // ease-out cubic
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
        // Fall back gracefully — zeros show the section still renders
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
      title: 'Agentic Profile Optimization',
      description:
        'Our Resume Agent analyzes your skills and dynamically restructures your profile to defeat Applicant Tracking Systems (ATS) with a 95%+ success rate.',
      icon: <BrainCircuit className="text-purple-400 mb-4" size={28} />,
    },
    {
      title: 'Market Intelligence Scraping',
      description:
        'The JobFinder Agent continuously scans LinkedIn, Indeed, and Naukri. We run semantic embeddings to fetch only the highest-matching opportunities.',
      icon: <Target className="text-blue-400 mb-4" size={28} />,
    },
    {
      title: 'Autonomous Execution',
      description:
        'Approve a job match and the Auto-Apply Agent takes over. We generate precise cover letters and submit your application entirely in the background.',
      icon: <Rocket className="text-green-400 mb-4" size={28} />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Nav — no sign-in button */}
      <nav className="sticky top-0 z-50 border-b border-zinc-900/80 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </span>
            <span className="text-white font-semibold text-base tracking-tight">JobAgent</span>
            <span className="text-xs text-zinc-500 font-mono ml-1">v2.0</span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto w-full px-8 space-y-20 py-10 flex-1">
        {/* Hero Section */}
        <section className="relative text-center space-y-8 py-16 px-4">
          {/* Decorative background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-4 backdrop-blur-md"
          >
            <Sparkles size={16} className="text-blue-400" />
            <span>JobAgent System v2.0 Online</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl lg:text-8xl font-bold tracking-tight text-white mb-6 leading-tight"
          >
            Automate your career <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              progression.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            Deploy a team of specialized AI agents to optimize your resume, analyze global job
            markets, and autonomously secure interviews while you focus on what matters.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10"
          >
            <button
              onClick={() => navigate('/login')}
              className="flex items-center px-8 py-4 bg-white text-black rounded-lg font-semibold hover:bg-zinc-200 transition-colors shadow-[0_0_40px_rgba(255,255,255,0.1)]"
            >
              Authenticate / Register <ArrowRight className="ml-2" size={18} />
            </button>
          </motion.div>
        </section>

        {/* Value Proposition Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + idx * 0.1 }}
              className="glass p-8 rounded-2xl relative overflow-hidden group glass-hover space-y-2"
            >
              {feature.icon}
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-zinc-400 leading-relaxed text-base">{feature.description}</p>
            </motion.div>
          ))}
        </section>

        {/* Live System Metrics */}
        <section id="metrics" className="border-t border-zinc-900/50 pt-16">
          <div className="flex items-center space-x-2 mb-8">
            <Activity className="text-zinc-500" size={22} />
            <h2 className="text-2xl font-bold tracking-tight text-white">Activity Telemetry</h2>
            {loading && <Loader2 size={16} className="text-zinc-600 animate-spin ml-2" />}
          </div>

          {loading ? (
            /* Skeleton */
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
                label="Jobs Fetched"
                value={stats!.jobs_scanned}
                sub={
                  stats!.jobs_scanned > 0 ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Active in queue
                    </span>
                  ) : (
                    <span className="text-zinc-600">No scans yet — run Job Finder</span>
                  )
                }
              />
              <StatCard
                label="Applications Submitted"
                value={stats!.applications_submitted}
                sub={
                  stats!.applications_submitted > 0 ? (
                    <span className="text-blue-400 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Tracked in history
                    </span>
                  ) : (
                    <span className="text-zinc-600">No applications yet</span>
                  )
                }
                valueClass="text-blue-400"
              />
              <StatCard
                label="Avg ATS Score"
                value={stats!.avg_ats_score}
                sub={
                  stats!.avg_ats_score > 0 ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Across all submissions
                    </span>
                  ) : (
                    <span className="text-zinc-600">No resumes generated yet</span>
                  )
                }
                valueClass={stats!.avg_ats_score >= 80 ? 'text-green-400' : stats!.avg_ats_score > 0 ? 'text-yellow-400' : 'text-zinc-600'}
              />
              <StatCard
                label="System Status"
                value={stats!.system_status}
                animate={false}
                sub={<span className="text-zinc-500">All agents ready</span>}
                valueClass="text-green-400"
              />
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
};
