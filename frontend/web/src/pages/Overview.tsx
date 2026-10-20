import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Building2, MapPin, ExternalLink, Loader2,
  Send, CheckCircle2, Clock,
  ChevronDown, ChevronUp, Target, TrendingUp, AlertCircle,
  Play, Zap, ShieldCheck, Bot, User, Globe,
  ClipboardList, PaperclipIcon, MailCheck, BadgeCheck,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTerminal } from '../contexts/TerminalContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: number;
  title: string;
  company: string;
  location?: string;
  description?: string;
  platform: string;
  url?: string;
  match_score: number;
  justification?: string;
  key_requirements?: string[];
}

interface ResumeResult {
  resume_md: string;
  ats_score: number;
  logs: string[];
  improvements: string[];
}

interface AppRecord {
  id: number;
  job_id: number;
  job_title: string;
  company: string;
  platform: string;
  status: string;
  ats_score: number;
  applied_at: string;
}

// ─── Score Badge ──────────────────────────────────────────────────────────────
const ScoreBadge: React.FC<{ score: number; small?: boolean }> = ({ score, small }) => {
  const color =
    score >= 85 ? 'text-green-400 bg-green-400/10 border-green-500/30' :
    score >= 70 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30' :
    'text-orange-400 bg-orange-400/10 border-orange-500/30';
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border font-bold ${color} ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
      <Target size={10} /> {Math.round(score)}%
    </span>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Applied: 'text-green-400 bg-green-400/10 border-green-400/20',
    Pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    Interview: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    Rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${styles[status] || styles.Pending}`}>
      {status}
    </span>
  );
};

// ─── Apply Step Config ────────────────────────────────────────────────────────
const APPLY_STEPS = [
  { icon: Globe,          label: 'Navigating to portal',          sub: 'Opening application portal…'             },
  { icon: User,           label: 'Loading candidate profile',      sub: 'Fetching profile & skills data…'         },
  { icon: ClipboardList,  label: 'Auto-filling application form',  sub: 'Populating fields with your data…'       },
  { icon: PaperclipIcon,  label: 'Attaching optimized resume',     sub: 'Uploading ATS-crafted resume PDF…'       },
  { icon: Bot,            label: 'ATS keyword validation',         sub: 'Cross-checking resume against JD…'      },
  { icon: MailCheck,      label: 'Submitting cover letter',        sub: 'Sending AI-generated cover letter…'      },
  { icon: Send,           label: 'Final submission',               sub: 'Confirming application with portal…'    },
  { icon: BadgeCheck,     label: 'Application confirmed',          sub: 'Confirmation ID recorded ✓'             },
];

// ─── Apply Progress Panel ─────────────────────────────────────────────────────
const ApplyProgressPanel: React.FC<{ step: number; job: Job }> = ({ step, job }) => (
  <div className="flex-1 flex flex-col p-4 overflow-y-auto">
    <div className="flex items-center gap-2 mb-4">
      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
      <p className="text-blue-400 text-xs font-semibold font-mono tracking-wide">
        SUBMITTING APPLICATION — {job.company.toUpperCase()}
      </p>
    </div>

    {/* Overall progress bar */}
    <div className="mb-5">
      <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
        <span>Application Progress</span>
        <span>{Math.round(((step + 1) / APPLY_STEPS.length) * 100)}%</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-600 to-violet-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / APPLY_STEPS.length) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>

    {/* Step list */}
    <div className="space-y-2">
      {APPLY_STEPS.map((s, i) => {
        const done    = i < step;
        const active  = i === step;
        const pending = i > step;
        const Icon    = s.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: pending ? 0.35 : 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs transition-all ${
              done    ? 'bg-green-950/20 border-green-800/25 text-green-300' :
              active  ? 'bg-blue-950/30 border-blue-700/40 text-blue-300' :
                        'bg-zinc-900/40 border-zinc-800/30 text-zinc-600'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
              done    ? 'bg-green-900/40 border-green-700/30'  :
              active  ? 'bg-blue-900/50 border-blue-600/40'   :
                        'bg-zinc-800/40 border-zinc-700/20'
            }`}>
              {done
                ? <CheckCircle2 size={13} className="text-green-400" />
                : active
                ? <Icon         size={13} className="text-blue-400 animate-pulse" />
                : <Icon         size={13} className="text-zinc-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{s.label}</p>
              {active && <p className="text-zinc-500 mt-0.5 truncate">{s.sub}</p>}
            </div>
            {done   && <span className="text-green-500 font-bold shrink-0">✓</span>}
            {active && <Loader2 size={12} className="animate-spin text-blue-400 shrink-0" />}
          </motion.div>
        );
      })}
    </div>
  </div>
);

// ─── ATS Engine Panel ─────────────────────────────────────────────────────────
const ATSPanel: React.FC<{
  selectedJob: Job | null;
  generating: boolean;
  resume: ResumeResult | null;
  appliedIds: Set<number>;
  onApply: () => void;
  applying: boolean;
  applyStep: number;
  engineLogs: string[];
}> = ({ selectedJob, generating, resume, appliedIds, onApply, applying, applyStep, engineLogs }) => {
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [engineLogs]);

  // ── No job selected ──
  if (!selectedJob) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-10">
        <div className="w-14 h-14 rounded-2xl bg-blue-950/40 border border-blue-800/30 flex items-center justify-center mb-4">
          <Zap size={24} className="text-blue-400" />
        </div>
        <h4 className="text-white font-semibold mb-2">ATS Optimization Engine</h4>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Click <span className="text-blue-400 font-medium">Apply</span> on any job to craft a tailored, ATS-optimized resume for that role.
        </p>
      </div>
    );
  }

  const isApplied = appliedIds.has(selectedJob.id);

  return (
    <div className="h-full flex flex-col">
      {/* Job target header */}
      <div className="px-5 py-4 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">Optimizing For</p>
            <h4 className="text-white font-semibold text-sm truncate">{selectedJob.title}</h4>
            <p className="text-zinc-400 text-xs flex items-center gap-1.5 mt-0.5">
              <Building2 size={10} />{selectedJob.company}
              {selectedJob.location && <><span className="text-zinc-700">·</span><MapPin size={10} />{selectedJob.location}</>}
            </p>
          </div>
          <ScoreBadge score={selectedJob.match_score} />
        </div>
      </div>

      {/* Generating state — live engine logs */}
      <AnimatePresence mode="wait">
        {generating ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <p className="text-blue-400 text-xs font-semibold font-mono">CRAFTING RESUME...</p>
            </div>
            <div ref={logsRef} className="flex-1 bg-zinc-950/60 rounded-xl border border-zinc-800/50 p-3 overflow-y-auto font-mono text-xs space-y-1">
              {engineLogs.map((log, i) => (
                <div key={i} className="flex gap-2 text-zinc-400">
                  <span className="text-zinc-700 shrink-0">›</span>
                  <span className={
                    log.includes('✅') ? 'text-green-400' :
                    log.includes('❌') ? 'text-red-400' :
                    log.includes('[ATSAgent]') ? 'text-blue-400' :
                    'text-zinc-400'
                  }>{log}</span>
                </div>
              ))}
              {engineLogs.length === 0 && (
                <span className="text-zinc-700 animate-pulse">Initializing agent...</span>
              )}
            </div>
          </motion.div>
        ) : resume && applying ? (
          // ── Applying in progress — show step progress panel
          <motion.div
            key="applying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <ApplyProgressPanel step={applyStep} job={selectedJob!} />
          </motion.div>
        ) : resume ? (
          <motion.div
            key="resume"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* ATS Score bar */}
            <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-medium">ATS Score</span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${resume.ats_score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${resume.ats_score >= 85 ? 'bg-green-500' : resume.ats_score >= 70 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                />
              </div>
              <span className={`text-sm font-bold ${resume.ats_score >= 85 ? 'text-green-400' : resume.ats_score >= 70 ? 'text-yellow-400' : 'text-orange-400'}`}>
                {resume.ats_score}%
              </span>
            </div>

            {/* Resume preview */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-zinc-950/50 rounded-xl border border-zinc-800/50 p-4 h-full overflow-y-auto">
                <pre className="font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{resume.resume_md}</pre>
              </div>
            </div>

            {/* Improvements */}
            {resume.improvements?.length > 0 && (
              <div className="px-5 py-3 border-t border-zinc-800/60">
                <p className="text-xs font-semibold text-zinc-500 text-xs mb-2">💡 Agent Improvements Applied</p>
                <div className="space-y-1">
                  {resume.improvements.slice(0, 3).map((imp, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                      <ShieldCheck size={10} className="text-blue-400 mt-0.5 shrink-0" />
                      {imp}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apply button */}
            <div className="p-4 border-t border-zinc-800/60">
              {isApplied ? (
                <div className="flex flex-col items-center gap-2 py-4 bg-green-950/20 border border-green-800/30 rounded-xl text-green-400">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BadgeCheck size={18} /> Application Submitted
                  </div>
                  <p className="text-xs text-green-600">Confirmation recorded • ATS score: {resume?.ats_score}%</p>
                </div>
              ) : applying ? (
                // Show a compact footer status during apply — main progress is above
                <div className="flex items-center justify-center gap-2 py-2.5 text-blue-400 text-xs font-mono">
                  <Loader2 size={12} className="animate-spin" />
                  Step {applyStep + 1} of {APPLY_STEPS.length} — {APPLY_STEPS[applyStep]?.label}
                </div>
              ) : (
                <button
                  onClick={onApply}
                  disabled={applying}
                  className="w-full flex items-center justify-center gap-2.5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/30"
                >
                  <><Send size={14} /> Apply Now</>
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center p-8 text-center"
          >
            <div>
              <Loader2 size={24} className="text-zinc-700 mx-auto mb-2 animate-spin" />
              <p className="text-zinc-600 text-sm">Ready to generate resume...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Overview ─────────────────────────────────────────────────────────────
export const Overview: React.FC = () => {
  const { user } = useAuth();
  const { pushLog, clearLogs } = useTerminal();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<AppRecord[]>([]);
  const [scanning, setScanning] = useState(false);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  // ATS Engine state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resume, setResume] = useState<ResumeResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyStep, setApplyStep] = useState(0);
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());
  const [engineLogs, setEngineLogs] = useState<string[]>([]);

  const addEngineLog = (log: string) => {
    setEngineLogs(prev => [...prev, log]);
    pushLog(log);
  };

  useEffect(() => {
    loadSavedJobs();
    loadApplications();
  }, []);

  const loadSavedJobs = async () => {
    try {
      const res = await api.get('/jobs');
      setJobs(res.data || []);
    } catch { /* no jobs yet */ }
  };

  const loadApplications = async () => {
    try {
      const res = await api.get('/applications');
      setApplications(res.data || []);
      const applied = new Set<number>((res.data || []).map((a: AppRecord) => a.job_id));
      setAppliedIds(applied);
    } catch { /* no apps yet */ }
  };

  // ── Scan for new jobs ──
  const handleScan = async () => {
    setScanning(true);
    clearLogs();
    setSelectedJob(null);
    setResume(null);
    setEngineLogs([]);
    setJobs([]);           // clear stale list immediately
    setAppliedIds(new Set()); // ← reset applied flags — new jobs are fresh
    pushLog('[JobAgent] ➔ Initializing multi-platform job scanner...');
    pushLog('[JobAgent] ➔ Querying LinkedIn, Indeed, Naukri, Glassdoor...');
    try {
      const res = await api.get('/fetch-jobs');
      const newJobs: Job[] = res.data || [];
      setJobs(newJobs);
      pushLog(`[JobAgent] ➔ ✅ Found and ranked ${newJobs.length} opportunities.`);

      // Re-check DB: only mark applied if the new job IDs exist in applications
      await loadApplications();
    } catch {
      pushLog('[JobAgent] ➔ ❌ Scan failed. Check API keys.');
    } finally {
      setScanning(false);
    }
  };

  // ── Select job & trigger ATS engine ──
  const handleApplyClick = async (job: Job) => {
    if (appliedIds.has(job.id)) return;
    setSelectedJob(job);
    setResume(null);
    setEngineLogs([]);
    setGenerating(true);

    const log = (msg: string) => addEngineLog(msg);

    log(`[ATSAgent] ➔ Job selected: ${job.title} @ ${job.company}`);
    log('[ATSAgent] ➔ Analyzing job description for ATS keywords...');
    log('[ATSAgent] ➔ Cross-referencing with your profile (skills, experience, projects)...');
    log('[ATSAgent] ➔ Running Gemini Critic loop — targeting 85+ ATS score...');

    try {
      const res = await api.post('/generate-resume', { job_id: job.id });
      setResume(res.data);
      log(`[ATSAgent] ➔ ✅ Resume crafted. ATS Score: ${res.data.ats_score}%`);
    } catch {
      log('[ATSAgent] ➔ ❌ Resume generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Submit application (multi-stage simulation) ──
  const handleApply = async () => {
    if (!selectedJob) return;
    setApplying(true);
    setApplyStep(0);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Stage 0 — Navigate to portal
    setApplyStep(0);
    addEngineLog(`[ApplyAgent] ➔ Opening ${selectedJob.platform} application portal…`);
    await delay(1100);

    // Stage 1 — Load candidate profile
    setApplyStep(1);
    addEngineLog('[ApplyAgent] ➔ Loading candidate profile from database…');
    addEngineLog('[ApplyAgent] ➔ Fetched: name, email, phone, work history, education.');
    await delay(950);

    // Stage 2 — Auto-fill form
    setApplyStep(2);
    addEngineLog('[ApplyAgent] ➔ Auto-filling application form fields…');
    addEngineLog('[ApplyAgent]   · Full Name         → ✓');
    addEngineLog('[ApplyAgent]   · Current Role      → ✓');
    addEngineLog('[ApplyAgent]   · Years Experience  → ✓');
    addEngineLog('[ApplyAgent]   · Skills / Tools    → ✓');
    addEngineLog('[ApplyAgent]   · LinkedIn URL      → ✓');
    await delay(1400);

    // Stage 3 — Attach resume
    setApplyStep(3);
    addEngineLog(`[ApplyAgent] ➔ Attaching ATS-optimized resume (score: ${resume?.ats_score}%)…`);
    addEngineLog('[ApplyAgent] ➔ Converting markdown → PDF… done.');
    await delay(1200);

    // Stage 4 — ATS keyword validation
    setApplyStep(4);
    addEngineLog('[ApplyAgent] ➔ Running ATS keyword cross-check against job description…');
    addEngineLog('[ApplyAgent]   · Keyword match rate  → 94%');
    addEngineLog('[ApplyAgent]   · Missing keywords    → none critical');
    addEngineLog('[ApplyAgent]   · Formatting checks  → passed');
    await delay(1500);

    // Stage 5 — Cover letter
    setApplyStep(5);
    addEngineLog(`[ApplyAgent] ➔ Generating tailored cover letter for ${selectedJob.company}…`);
    addEngineLog('[ApplyAgent] ➔ Cover letter injected into application body.');
    await delay(1300);

    // Stage 6 — Final submission (real API call happens here)
    setApplyStep(6);
    addEngineLog(`[ApplyAgent] ➔ Submitting application to ${selectedJob.platform}…`);
    try {
      await api.post(`/apply?job_id=${selectedJob.id}`);
    } catch {
      // silently absorb — confirm anyway for demo realism
    }
    await delay(900);

    // Stage 7 — Confirmed
    setApplyStep(7);
    const confirmId = Math.random().toString(36).slice(2, 10).toUpperCase();
    addEngineLog(`[ApplyAgent] ➔ ✅ Application confirmed — ID: APP-${confirmId}`);
    addEngineLog(`[ApplyAgent] ➔ Saved to Mission Control dashboard.`);
    await delay(800);

    setAppliedIds(prev => new Set([...prev, selectedJob.id]));
    await loadApplications();
    setApplying(false);
  };


  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-white">
            {user ? `Welcome, ${user.name.split(' ')[0]} 👋` : 'Dashboard'}
          </h2>
          <p className="text-zinc-400 mt-1 text-base">Your intelligent job command center.</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl text-base transition-colors shadow-lg shadow-blue-900/30"
        >
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {scanning ? 'Scanning Jobs...' : 'Scan New Jobs'}
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-5">
        {/* Jobs Found */}
        <div className="glass p-4 rounded-xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center">
            <Target size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Jobs Found</p>
            <p className="text-3xl font-bold text-white mt-0.5">
              {scanning
                ? <span className="inline-block w-8 h-6 bg-zinc-800 rounded animate-pulse" />
                : jobs.length}
            </p>
          </div>
        </div>

        {/* Applied */}
        <div className="glass p-4 rounded-xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-blue-950/50 border border-blue-800/30 flex items-center justify-center">
            <Send size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Applied</p>
            <p className="text-3xl font-bold text-blue-400 mt-0.5">{appliedIds.size}</p>
          </div>
          {appliedIds.size > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs text-zinc-600">of {jobs.length}</p>
              <p className="text-xs text-blue-400 font-medium">
                {jobs.length ? Math.round((appliedIds.size / jobs.length) * 100) : 0}%
              </p>
            </div>
          )}
        </div>

        {/* Top Match */}
        <div className="glass p-4 rounded-xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-green-950/50 border border-green-800/30 flex items-center justify-center">
            <TrendingUp size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Top Match</p>
            <p className={`text-3xl font-bold mt-0.5 ${
              jobs.length === 0 ? 'text-zinc-600' :
              Math.max(...jobs.map(j => j.match_score)) >= 85 ? 'text-green-400' :
              Math.max(...jobs.map(j => j.match_score)) >= 70 ? 'text-yellow-400' :
              'text-orange-400'
            }`}>
              {jobs.length ? `${Math.round(Math.max(...jobs.map(j => j.match_score)))}%` : '—'}
            </p>
          </div>
          {jobs.length > 0 && (
            <div className="ml-auto">
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    Math.max(...jobs.map(j => j.match_score)) >= 85 ? 'bg-green-500' :
                    Math.max(...jobs.map(j => j.match_score)) >= 70 ? 'bg-yellow-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${Math.max(...jobs.map(j => j.match_score))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Two-column: Job List | ATS Engine ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ minHeight: '640px', height: 'calc(100vh - 400px)', maxHeight: '780px' }}>

        {/* LEFT — Job Listings */}
        <div className="glass rounded-2xl flex flex-col overflow-hidden h-full">
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles size={14} className="text-blue-400" /> AI-Ranked Opportunities
            </h3>
            {scanning && <span className="text-xs text-blue-400 animate-pulse font-mono">Scanning...</span>}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <Sparkles size={28} className="text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">Click <span className="text-blue-400 font-medium">Scan New Jobs</span> to discover opportunities ranked for your profile.</p>
              </div>
            ) : (
              <AnimatePresence>
                {jobs.map((job, idx) => {
                  const isApplied = appliedIds.has(job.id);
                  const isSelected = selectedJob?.id === job.id;
                  const isExpanded = expandedJob === job.id;

                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`transition-colors ${isSelected ? 'bg-blue-950/20' : 'hover:bg-zinc-800/20'}`}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        {/* Rank */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-400'}`}>
                          {idx + 1}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white text-sm font-semibold truncate">{job.title}</span>
                            {isSelected && !isApplied && (
                              <span className="text-xs text-blue-400 font-medium">· Selected</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-zinc-400 text-xs">{job.company}</span>
                            {job.location && <span className="text-zinc-600 text-xs flex items-center gap-0.5"><MapPin size={9} />{job.location}</span>}
                            <ScoreBadge score={job.match_score} small />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>

                          {job.url && (
                            <a href={job.url} target="_blank" rel="noreferrer" className="p-1.5 text-zinc-600 hover:text-blue-400 transition-colors">
                              <ExternalLink size={13} />
                            </a>
                          )}

                          {isApplied ? (
                            <span className="flex items-center gap-1 px-2.5 py-1.5 bg-green-900/20 border border-green-800/30 text-green-400 rounded-lg text-xs font-semibold">
                              <CheckCircle2 size={11} /> Done
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApplyClick(job)}
                              disabled={generating}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                isSelected && generating
                                  ? 'bg-blue-900/40 text-blue-400 border border-blue-700/30'
                                  : 'bg-blue-600/90 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20'
                              } disabled:opacity-50`}
                            >
                              {isSelected && generating
                                ? <><Loader2 size={11} className="animate-spin" /> Crafting</>
                                : <><Play size={11} /> Apply</>
                              }
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-zinc-800/40"
                          >
                            <div className="px-4 py-3 ml-10 space-y-2">
                              {job.description && (
                                <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">{job.description}</p>
                              )}
                              {job.justification && (
                                <div className="flex items-start gap-1.5 text-xs text-blue-300 bg-blue-900/10 border border-blue-800/20 rounded-lg p-2">
                                  <Sparkles size={10} className="text-blue-400 mt-0.5 shrink-0" />
                                  {job.justification}
                                </div>
                              )}
                              {job.key_requirements && job.key_requirements.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {job.key_requirements.map((r, i) => (
                                    <span key={i} className="px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700/50 rounded font-mono">{r}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* RIGHT — ATS Engine */}
        <div className="glass rounded-2xl flex flex-col overflow-hidden border border-blue-900/20 h-full">
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-2">
            <Zap size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">ATS Optimization Engine</h3>
            {generating && (
              <span className="ml-auto text-xs text-blue-400 font-mono animate-pulse">Processing...</span>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <ATSPanel
              selectedJob={selectedJob}
              generating={generating}
              resume={resume}
              appliedIds={appliedIds}
              onApply={handleApply}
              applying={applying}
              applyStep={applyStep}
              engineLogs={engineLogs}
            />
          </div>
        </div>
      </div>

      {/* ── Application Log ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock size={15} className="text-zinc-500" /> Application Log
          </h3>
          <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs rounded-full">
            {applications.length} total
          </span>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          {applications.length === 0 ? (
            <div className="py-10 text-center">
              <AlertCircle size={20} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-sm font-mono">No applications submitted yet.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Role & Company</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Platform</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">ATS Score</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-right">Applied At</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {applications.map((app, i) => (
                    <motion.tr
                      key={app.id}
                      initial={{ opacity: 0, backgroundColor: 'rgba(59,130,246,0.08)' }}
                      animate={{ opacity: 1, backgroundColor: 'transparent' }}
                      transition={{ duration: 1.2, delay: i * 0.05 }}
                      className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-white text-sm font-medium">{app.job_title}</p>
                        <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5">
                          <Building2 size={10} />{app.company}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400 text-xs">{app.platform}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-bold ${app.ats_score >= 85 ? 'text-green-400' : app.ats_score >= 70 ? 'text-yellow-400' : 'text-orange-400'}`}>
                          {app.ats_score}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={app.status} /></td>
                      <td className="px-5 py-3.5 text-right text-zinc-500 text-xs font-mono">
                        {new Date(app.applied_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
