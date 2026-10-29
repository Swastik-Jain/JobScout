import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Clock,
  Building2,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertCircle,
  FileText,
  BadgeCheck,
  CheckCircle2,
  Search,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTerminal } from '../contexts/TerminalContext';
import { ReviewModal } from '../components/ReviewModal';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Job {
  id: number;
  title: string;
  company: string;
  description: string;
  platform: string;
  url: string;
  location: string;
  salary_range: string;
  match_score: number;
  justification: string;
  key_requirements: string[];
}

interface AppRecord {
  id: number;
  job_id: number;
  job_title: string;
  company: string;
  platform: string;
  status: string;
  ats_score: number | null;
  applied_at: string | null;
}

// ─── Match Score Badge ────────────────────────────────────────────────────────
const ScoreBadge: React.FC<{ score: number; small?: boolean }> = ({ score, small }) => {
  const color =
    score >= 85
      ? 'bg-green-950/40 border-green-800/40 text-green-300'
      : score >= 70
      ? 'bg-yellow-950/40 border-yellow-800/40 text-yellow-300'
      : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-bold rounded-lg border ${
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${color}`}
    >
      <Sparkles size={small ? 9 : 11} />
      {Math.round(score)}%
    </span>
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

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'all' | 'india' | 'remote'>('all');
  const [seniorityFilter, setSeniorityFilter] = useState<'all' | 'entry' | 'experienced'>('all');

  // Modal & Selection state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeAppId, setActiveAppId] = useState<number | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

  const formatName = (str?: string) => {
    if (!str) return 'Candidate';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const filteredJobs = jobs.filter(job => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || job.title.toLowerCase().includes(q) || job.company.toLowerCase().includes(q);
    const loc = (job.location || '').toLowerCase();
    const isIndia = loc.includes('india') || loc.includes('bengaluru') || loc.includes('bangalore') || loc.includes('hyderabad') || loc.includes('pune') || loc.includes('mumbai') || loc.includes('delhi') || loc.includes('noida') || loc.includes('gurgaon');
    const isRemote = loc.includes('remote') || loc.includes('worldwide') || loc.includes('global');
    const matchesLoc =
      locationFilter === 'all' ||
      (locationFilter === 'india' && isIndia) ||
      (locationFilter === 'remote' && isRemote);

    const titleLower = job.title.toLowerCase();
    const isEntry = titleLower.includes('intern') || titleLower.includes('junior') || titleLower.includes('associate') || titleLower.includes('entry') || titleLower.includes('sde-1') || titleLower.includes('sde 1') || titleLower.includes('sde i');
    const matchesSeniority =
      seniorityFilter === 'all' ||
      (seniorityFilter === 'entry' && isEntry) ||
      (seniorityFilter === 'experienced' && !isEntry);

    return matchesQuery && matchesLoc && matchesSeniority;
  });

  useEffect(() => {
    loadSavedJobs();
    loadApplications();
  }, []);

  const loadSavedJobs = async () => {
    try {
      const res = await api.get('/jobs');
      setJobs(res.data || []);
    } catch {
      /* no jobs yet */
    }
  };

  const loadApplications = async () => {
    try {
      const res = await api.get('/applications');
      setApplications(res.data || []);
      const applied = new Set<number>(
        (res.data || [])
          .filter((a: AppRecord) => a.status === 'applied' || a.status === 'interviewing')
          .map((a: AppRecord) => a.job_id)
      );
      setAppliedIds(applied);
    } catch {
      /* no apps yet */
    }
  };

  // ── Scan for new jobs ──
  const handleScan = async () => {
    setScanning(true);
    clearLogs();
    setSelectedJob(null);
    setJobs([]);
    pushLog('[JobScout] Initializing ATS job discovery scanner...');
    pushLog('[JobScout] Querying verified company feeds for candidate match...');
    try {
      const res = await api.get('/fetch-jobs');
      const newJobs: Job[] = res.data || [];
      setJobs(newJobs);
      if (newJobs.length === 0) {
        pushLog('[JobScout] No active job listings found for your profile criteria.');
      } else {
        pushLog(`[JobScout] Loaded and ranked ${newJobs.length} verified opportunities.`);
      }
      await loadApplications();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Job scan failed.';
      pushLog(`[JobScout] Error: ${msg}`);
    } finally {
      setScanning(false);
    }
  };

  // ── Prepare Application (Legitimate Human-in-the-Loop) ──
  const handlePrepareJob = async (job: Job) => {
    setSelectedJob(job);
    pushLog(`[JobScout] Bookmarking ${job.title} @ ${job.company}...`);

    try {
      // 1. Save or retrieve application
      const saveRes = await api.post('/applications', { job_id: job.id });
      const appId = saveRes.data.id;
      setActiveAppId(appId);

      // 2. Trigger preparation in background
      await api.post(`/applications/${appId}/prepare`);
      pushLog(`[JobScout] Tailoring application materials (Resume, Cover Note, Q&A)...`);

      // 3. Open Review Modal
      setIsReviewOpen(true);
    } catch (err: any) {
      pushLog(`[JobScout] Failed to initiate application: ${err?.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {user ? `Welcome, ${formatName(user.name)}` : 'Dashboard'}
          </h2>
          <p className="text-zinc-400 mt-1 text-sm">Your career discovery & application command center.</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-blue-900/30 cursor-pointer"
        >
          <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Scanning Portals...' : 'Scan For Live Jobs'}
        </button>
      </div>

      {/* ── Metric Strip or Onboarding Checklist ── */}
      {jobs.length === 0 && applications.length === 0 ? (
        <div className="glass rounded-2xl p-6 border border-zinc-800/80 bg-gradient-to-br from-zinc-900/60 to-zinc-950/80">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Onboarding Checklist</h3>
              <p className="text-zinc-400 text-xs mt-0.5">Complete these steps to activate your career pipeline.</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40 font-semibold">
              Get Started
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
            {/* Step 1 */}
            <div className={`p-4 rounded-xl border transition-all ${user?.target_role ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-zinc-900/40 border-zinc-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-zinc-500 uppercase">Step 1</span>
                {user?.target_role ? <CheckCircle2 size={16} className="text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />}
              </div>
              <p className="text-sm font-semibold text-white">Target Role & Skills</p>
              <p className="text-xs text-zinc-400 mt-1">Set preferred job title and tech stack.</p>
              <Link to="/dashboard/profile" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3 font-medium">
                Edit Profile <ArrowRight size={11} />
              </Link>
            </div>

            {/* Step 2 */}
            <div className={`p-4 rounded-xl border transition-all ${(user?.github_repos || []).length > 0 ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-zinc-900/40 border-zinc-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-zinc-500 uppercase">Step 2</span>
                {(user?.github_repos || []).length > 0 ? <CheckCircle2 size={16} className="text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />}
              </div>
              <p className="text-sm font-semibold text-white">GitHub Repositories</p>
              <p className="text-xs text-zinc-400 mt-1">Ground resumes in verified personal codebases.</p>
              <Link to="/dashboard/profile" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3 font-medium">
                Verify Repos <ArrowRight size={11} />
              </Link>
            </div>

            {/* Step 3 */}
            <div className={`p-4 rounded-xl border transition-all ${jobs.length > 0 ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-blue-950/20 border-blue-800/40'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-blue-400 uppercase">Step 3</span>
                {jobs.length > 0 ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Sparkles size={16} className="text-blue-400 animate-pulse" />}
              </div>
              <p className="text-sm font-semibold text-white">Scan Verified Jobs</p>
              <p className="text-xs text-zinc-400 mt-1">Query live Greenhouse, Lever, and Ashby boards.</p>
              <button onClick={handleScan} disabled={scanning} className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3 font-medium cursor-pointer">
                Scan Now <ArrowRight size={11} />
              </button>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl border bg-zinc-900/40 border-zinc-800 opacity-70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-zinc-500 uppercase">Step 4</span>
                <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Tailor & Apply</p>
              <p className="text-xs text-zinc-500 mt-1">Generate grounded resumes and submit on ATS portals.</p>
              <span className="text-xs text-zinc-600 mt-3 block">Unlocks after scan</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Available Opportunities', value: jobs.length, sub: 'Active verified postings', color: 'text-blue-400' },
            { label: 'Applications Tracked', value: applications.length, sub: 'In pipeline', color: 'text-emerald-400' },
            {
              label: 'Submitted Applications',
              value: applications.filter(a => a.status === 'applied').length,
              sub: 'Legitimately submitted',
              color: 'text-purple-400',
            },
            {
              label: 'Avg ATS Alignment',
              value: jobs.length ? `${Math.round(jobs.reduce((s, j) => s + j.match_score, 0) / jobs.length)}%` : '—',
              sub: 'Keyword & semantic match',
              color: 'text-yellow-400',
            },
          ].map((m, i) => (
            <div key={i} className="glass rounded-xl p-4 border border-zinc-800/80">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{m.label}</p>
              <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Two-Column Main Stage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        {/* LEFT — Ranked Job Feed */}
        <div className="lg:col-span-8 glass rounded-2xl flex flex-col overflow-hidden border border-zinc-800/80">
          <div className="px-5 py-3.5 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles size={15} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Verified ATS Opportunities</h3>
              <span className="px-2 py-0.5 bg-blue-950/60 border border-blue-800/40 text-blue-300 text-xs font-mono rounded-full font-bold">
                {filteredJobs.length}
              </span>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter title or company..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-7 pr-3 py-1 bg-zinc-900 border border-zinc-700/60 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500 transition w-36 sm:w-44"
                />
              </div>

              <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 text-[11px]">
                {(['all', 'india', 'remote'] as const).map(loc => (
                  <button
                    key={loc}
                    onClick={() => setLocationFilter(loc)}
                    className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                      locationFilter === loc ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {loc === 'all' ? 'All' : loc === 'india' ? 'India' : 'Remote'}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 text-[11px]">
                {(['all', 'entry', 'experienced'] as const).map(sen => (
                  <button
                    key={sen}
                    onClick={() => setSeniorityFilter(sen)}
                    className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                      seniorityFilter === sen ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {sen === 'all' ? 'All' : sen === 'entry' ? 'Intern/Entry' : 'Mid/Sr'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
            {scanning ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <RefreshCw size={28} className="animate-spin text-blue-400 mb-3" />
                <p className="text-white font-medium text-sm">Querying Live ATS Boards...</p>
                <p className="text-zinc-500 text-xs mt-1">Ingesting direct feeds from Greenhouse, Lever, and Ashby</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-500 mb-3">
                  <AlertCircle size={22} />
                </div>
                <p className="text-zinc-300 font-semibold text-sm">
                  {jobs.length === 0 ? 'No live jobs loaded' : 'No jobs match your filter'}
                </p>
                <p className="text-zinc-500 text-xs mt-1 max-w-sm">
                  {jobs.length === 0
                    ? 'Click "Scan For Live Jobs" above to fetch active postings matching your skills and seniority level.'
                    : 'Try clearing your search query or switching to "All" locations.'}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredJobs.map((job, idx) => {
                  const isApplied = appliedIds.has(job.id);
                  const isSelected = selectedJob?.id === job.id;
                  const isExpanded = expandedJob === job.id;

                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`transition-colors ${isSelected ? 'bg-blue-950/20' : 'hover:bg-zinc-900/40'}`}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-400'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white text-sm font-semibold truncate">{job.title}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-zinc-400 text-xs">{job.company}</span>
                            {job.location && (
                              <span className="text-zinc-500 text-xs flex items-center gap-0.5">
                                <MapPin size={9} />
                                {job.location}
                              </span>
                            )}
                            <ScoreBadge score={job.match_score} small />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-zinc-500 hover:text-blue-400 transition"
                              title="Open original job posting"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}

                          {isApplied ? (
                            <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 rounded-lg text-xs font-semibold">
                              <BadgeCheck size={13} /> Applied
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePrepareJob(job)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 border border-blue-500'
                                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 hover:border-zinc-500'
                              }`}
                            >
                              <Zap size={12} className={isSelected ? 'text-white' : 'text-blue-400'} /> Prepare
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Justification & Requirements */}
                      {isExpanded && (
                        <div className="px-6 py-3 bg-zinc-950/60 border-t border-zinc-800/40 space-y-2 text-xs">
                          {job.justification && (
                            <p className="text-zinc-300 leading-relaxed">
                              <span className="text-zinc-500 font-semibold">Match Rationale: </span>
                              {job.justification}
                            </p>
                          )}
                          {job.key_requirements && job.key_requirements.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-zinc-500 font-semibold">Keywords: </span>
                              {job.key_requirements.map((req, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="px-2 py-0.5 rounded text-[11px] bg-zinc-900 border border-zinc-700/60 text-zinc-300"
                                >
                                  {req}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* RIGHT — Selected Job Detail Card */}
        <div className="lg:col-span-4 glass rounded-2xl flex flex-col overflow-hidden border border-blue-900/20 h-full">
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-2">
            <FileText size={15} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Application Preparation</h3>
          </div>

          <div className="flex-1 p-6 flex flex-col justify-between">
            {selectedJob ? (
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Target Position</span>
                  <h4 className="text-lg font-bold text-white mt-0.5">{selectedJob.title}</h4>
                  <p className="text-zinc-400 text-xs mt-0.5 flex items-center gap-1">
                    <Building2 size={11} /> {selectedJob.company} {selectedJob.location ? `· ${selectedJob.location}` : ''}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Match Quality</span>
                    <ScoreBadge score={selectedJob.match_score} />
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {selectedJob.justification || 'Analyzed against candidate profile skills and experience.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/30 text-xs text-blue-200 leading-relaxed">
                  <p className="font-semibold text-blue-300 mb-1">Human-in-the-Loop Workflow</p>
                  1. Tailors resume & cover letter without fabrication.<br />
                  2. Allows review and DOCX/MD download.<br />
                  3. Directs you to the legitimate portal to apply.
                </div>

                <button
                  onClick={() => handlePrepareJob(selectedJob)}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-zinc-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-primary/20"
                >
                  <Zap size={14} /> Review & Apply
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-2">
                <Zap size={28} className="text-zinc-700 mx-auto" />
                <p className="text-zinc-400 text-sm font-medium">No job selected</p>
                <p className="text-xs text-zinc-600">Select any opportunity on the left to prepare and review application materials.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Application Log ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock size={15} className="text-zinc-500" /> Application History
          </h3>
          <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs rounded-full">
            {applications.length} total
          </span>
        </div>

        <div className="glass rounded-xl overflow-hidden border border-zinc-800/80">
          {applications.length === 0 ? (
            <div className="py-10 text-center">
              <AlertCircle size={20} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-sm font-mono">No applications recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Role & Company</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">ATS Alignment</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr
                    key={app.id}
                    onClick={() => {
                      const matchedJob = jobs.find(j => j.id === app.job_id);
                      if (matchedJob) {
                        setSelectedJob(matchedJob);
                        setActiveAppId(app.id);
                        setIsReviewOpen(true);
                      }
                    }}
                    className="border-b border-zinc-800/40 hover:bg-zinc-800/20 cursor-pointer transition"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-white text-sm font-medium">{app.job_title}</p>
                      <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5">
                        <Building2 size={10} />
                        {app.company}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {app.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {app.ats_score ? <ScoreBadge score={app.ats_score} small /> : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-zinc-500 font-mono">
                      {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'In pipeline'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedJob && activeAppId && (
        <ReviewModal
          applicationId={activeAppId}
          job={selectedJob}
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          onStatusUpdated={() => loadApplications()}
        />
      )}
    </div>
  );
};
