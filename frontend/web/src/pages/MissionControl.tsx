import React, { useEffect, useState, useCallback } from 'react';
import {
  Rocket, Clock, CheckCircle2,
  ShieldAlert, ShieldCheck, ShieldOff, Shield,
  AlertTriangle, ExternalLink,
  Building2, MapPin, Zap, ChevronDown, ChevronUp,
  Search, Filter, FileText,
  LayoutGrid, List, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { ReviewModal } from '../components/ReviewModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApplicationRecord {
  id: number;
  job_id: number;
  job_title: string;
  company: string;
  platform: string;
  status: string;
  ats_score: number;
  applied_at: string;
  url?: string;
  location?: string;
  description?: string;
  is_active_on_ats?: boolean;
}

import {
  type RiskAnalysis,
  analyzeJobScamRisk,
  RiskBadge,
  RiskDonut,
  BlockOverlay,
  WarningModal,
} from '../lib/fraudHeuristics';
// ─── Application Row ──────────────────────────────────────────────────────────
const ApplicationRow: React.FC<{
  app: ApplicationRecord;
  index: number;
  onRefresh?: () => void;
}> = ({ app, index, onRefresh }) => {
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [scanning, setScanning] = useState(true);
  const [showBlock, setShowBlock] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overridden, setOverridden] = useState(false);   // user forced view past block
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate async scanning delay for UX realism
    const delay = 300 + index * 80;
    const t = setTimeout(() => {
      const result = analyzeJobScamRisk(app);
      setAnalysis(result);
      setScanning(false);
    }, delay);
    return () => clearTimeout(t);
  }, [app, index]);

  const isStale =

    app.status.toLowerCase() === 'applied' &&
    app.applied_at &&
    Date.now() - new Date(app.applied_at).getTime() > 7 * 24 * 3600 * 1000;

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    try {
      setStatusError(null);
      await api.post(`/applications/${app.id}/transition`, { to_status: newStatus });
      onRefresh?.();
    } catch (err: any) {
      setStatusError(err?.response?.data?.detail || 'Invalid transition');
      setTimeout(() => setStatusError(null), 3500);
    }
  };

  const handleRowClick = () => {
    if (!analysis || overridden || warningAcknowledged) {
      setExpanded(e => !e);
      return;
    }
    if (analysis.level === 'BLOCKED') {
      setShowBlock(true);
    } else if (analysis.level === 'WARNING') {
      setShowWarning(true);
    } else {
      setExpanded(e => !e);
    }
  };

  const handleViewLink = (e: React.MouseEvent) => {
    if (!analysis || overridden || warningAcknowledged) return;
    if (analysis.level === 'BLOCKED') {
      e.preventDefault();
      setShowBlock(true);
    } else if (analysis.level === 'WARNING' && !warningAcknowledged) {
      e.preventDefault();
      setShowWarning(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showBlock && analysis && (
          <BlockOverlay
            job={app}
            analysis={analysis}
            onDismiss={() => setShowBlock(false)}
            onForceView={() => { setOverridden(true); setShowBlock(false); setExpanded(true); }}
          />
        )}
        {showWarning && analysis && (
          <WarningModal
            job={app}
            analysis={analysis}
            onDismiss={() => setShowWarning(false)}
            onProceed={() => { setWarningAcknowledged(true); setShowWarning(false); setExpanded(true); }}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`border-b border-zinc-800/40 transition-colors ${
          analysis?.level === 'BLOCKED' && !overridden
            ? 'bg-red-950/10 hover:bg-red-950/20'
            : analysis?.level === 'WARNING' && !warningAcknowledged
            ? 'bg-yellow-950/10 hover:bg-yellow-950/20'
            : 'hover:bg-zinc-800/20'
        }`}
      >
        {/* Main row */}
        <div
          onClick={handleRowClick}
          className="px-6 py-4 flex items-center gap-4 cursor-pointer select-none"
        >
          {/* Risk indicator strip */}
          <div className={`w-1 h-12 rounded-full shrink-0 ${
            scanning ? 'bg-blue-500 animate-pulse' :
            analysis?.level === 'BLOCKED' ? 'bg-red-500' :
            analysis?.level === 'WARNING' ? 'bg-yellow-500' :
            'bg-green-500'
          }`} />

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${
                analysis?.level === 'BLOCKED' && !overridden ? 'text-red-200' :
                analysis?.level === 'WARNING' && !warningAcknowledged ? 'text-yellow-200' :
                'text-white'
              }`}>
                {analysis?.level === 'BLOCKED' && !overridden ? (
                  <span className="blur-sm select-none">{app.job_title}</span>
                ) : app.job_title}
              </p>

              {/* Status transition dropdown */}
              <select
                value={app.status.toLowerCase()}
                onClick={e => e.stopPropagation()}
                onChange={handleStatusChange}
                className="px-2 py-0.5 rounded-lg border text-xs font-semibold bg-zinc-900 border-zinc-700 text-zinc-200 focus:outline-none cursor-pointer"
              >
                {['saved', 'prepared', 'applied', 'interviewing', 'accepted', 'declined', 'rejected', 'ghosted', 'withdrawn'].map(s => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>

              {isStale && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 border border-amber-800 text-amber-300">
                  7d+ Follow Up
                </span>
              )}

              {app.is_active_on_ats === false && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/60 border border-red-800 text-red-300">
                  Closed on ATS
                </span>
              )}

              {statusError && (
                <span className="text-red-400 text-xs font-medium">({statusError})</span>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); setReviewOpen(true); }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold transition"
              >
                <FileText size={12} /> Review & Apply
              </button>
            </div>

            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-zinc-400 text-xs flex items-center gap-1">
                <Building2 size={10} />
                {analysis?.level === 'BLOCKED' && !overridden
                  ? <span className="blur-sm select-none">{app.company}</span>
                  : app.company}
              </span>
              {app.location && (
                <span className="text-zinc-600 text-xs flex items-center gap-1">
                  <MapPin size={9} />{app.location}
                </span>
              )}
              <span className="text-zinc-600 text-xs">{app.platform}</span>
            </div>
          </div>

          {/* ATS Score */}
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-xs text-zinc-500 mb-0.5">ATS</p>
            <p className={`text-sm font-bold ${
              app.ats_score >= 85 ? 'text-green-400' :
              app.ats_score >= 70 ? 'text-yellow-400' : 'text-orange-400'
            }`}>{app.ats_score}%</p>
          </div>

          {/* Risk Badge */}
          <div className="shrink-0">
            {scanning ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-blue-700/50 bg-blue-950/30 rounded-lg text-xs text-blue-400 font-bold">
                <Shield size={11} className="animate-pulse" /> SCANNING
              </span>
            ) : analysis ? (
              <RiskBadge level={analysis.level} score={analysis.score} />
            ) : null}
          </div>

          {/* Expand */}
          <div className="text-zinc-600 shrink-0">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && analysis && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-5 ml-5 space-y-4">
                {/* Security analysis card */}
                <div className={`rounded-xl border p-4 space-y-3 ${
                  analysis.level === 'BLOCKED' ? 'bg-red-950/20 border-red-800/30' :
                  analysis.level === 'WARNING' ? 'bg-yellow-950/20 border-yellow-800/30' :
                  'bg-green-950/15 border-green-800/20'
                }`}>
                  <div className="flex items-center gap-3">
                    <RiskDonut score={analysis.score} level={analysis.level} />
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Security Analysis</p>
                      <RiskBadge level={analysis.level} score={analysis.score} />
                      <p className="text-xs text-zinc-400 mt-2 max-w-sm leading-relaxed">{analysis.summary}</p>
                    </div>
                  </div>

                  {analysis.signals.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Detected Signals</p>
                      {analysis.signals.map((sig, i) => (
                        <div key={i} className={`flex items-start gap-2 text-xs p-2.5 rounded-lg ${
                          sig.severity === 'high' ? 'bg-red-900/20 text-red-300' :
                          sig.severity === 'medium' ? 'bg-yellow-900/20 text-yellow-300' :
                          'bg-zinc-800/50 text-zinc-400'
                        }`}>
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold">{sig.label}: </span>
                            <span className="opacity-80">{sig.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {analysis.level === 'SAFE' && analysis.signals.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/10 rounded-lg p-2.5">
                      <ShieldCheck size={12} />
                      No scam signals detected. This application appears legitimate.
                    </div>
                  )}
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>Applied: {new Date(app.applied_at).toLocaleString('en-IN', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}</span>
                  {app.url && (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={handleViewLink}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink size={11} /> View Job Listing
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>


      {reviewOpen && (

        <ReviewModal
          applicationId={app.id}
          job={{
            id: app.job_id,
            title: app.job_title,
            company: app.company,
            url: app.url || '',
            location: app.location,
          }}
          isOpen={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onStatusUpdated={() => onRefresh?.()}
        />
      )}
    </>
  );
};

// ─── Kanban Definitions & Card ───────────────────────────────────────────────
const KANBAN_COLUMNS = [
  { id: 'saved', label: 'Saved', color: 'border-zinc-700 bg-zinc-900/60 text-zinc-300' },
  { id: 'prepared', label: 'Prepared', color: 'border-blue-700/60 bg-blue-950/40 text-blue-300' },
  { id: 'applied', label: 'Applied', color: 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300' },
  { id: 'interviewing', label: 'Interviewing', color: 'border-purple-700/60 bg-purple-950/40 text-purple-300' },
  { id: 'closed', label: 'Offer / Decided', color: 'border-zinc-800 bg-zinc-900/40 text-zinc-400' },
];

function getColumnForStatus(status: string): string {
  const s = (status || '').toLowerCase().trim();
  if (s === 'saved') return 'saved';
  if (s === 'prepared') return 'prepared';
  if (s === 'applied') return 'applied';
  if (s === 'interviewing') return 'interviewing';
  return 'closed'; // accepted, declined, rejected, ghosted, withdrawn
}

const KanbanCard: React.FC<{
  app: ApplicationRecord;
  analysis: RiskAnalysis;
  onRefresh: () => void;
  duplicateCompany: boolean;
  isStale: boolean;
}> = ({ app, analysis, onRefresh, duplicateCompany, isStale }) => {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setTransitioning(true);
      setStatusError(null);
      await api.patch(`/applications/${app.id}`, { status: newStatus });
      onRefresh();
    } catch (err: any) {
      setStatusError(err?.response?.data?.detail || 'Invalid transition');
      setTimeout(() => setStatusError(null), 3500);
    } finally {
      setTransitioning(false);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass p-4 rounded-xl border border-zinc-800/80 hover:border-zinc-700/80 space-y-3 transition group relative"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-white text-sm font-semibold leading-snug line-clamp-2">
              {app.job_title}
            </h4>
          </div>
          <p className="text-zinc-400 text-xs mt-1 flex items-center gap-1">
            <Building2 size={11} className="text-zinc-500 shrink-0" />
            <span className="truncate">{app.company}</span>
          </p>
          {app.location && (
            <p className="text-zinc-500 text-[11px] mt-0.5 flex items-center gap-1">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{app.location}</span>
            </p>
          )}
        </div>

        {/* Badges strip: ATS & Risk & Alerts */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {app.ats_score > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-zinc-900 border border-zinc-700/60 text-emerald-400">
              ATS {Math.round(app.ats_score)}%
            </span>
          )}
          <RiskBadge level={analysis.level} small />

          {isStale && (
            <span
              title="Applied > 7 days ago with no update"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/50 border border-amber-800/50 text-amber-300"
            >
              <Clock size={10} /> 7d+ Follow Up
            </span>
          )}

          {duplicateCompany && (
            <span
              title="Multiple applications detected for this company"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/40 border border-amber-800/40 text-amber-300"
            >
              <AlertTriangle size={10} /> Duplicate Co.
            </span>
          )}

          {app.is_active_on_ats === false && (
            <span
              title="Job posting has been closed on employer ATS"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/50 border border-red-800/50 text-red-300"
            >
              <AlertCircle size={10} /> Closed on ATS
            </span>
          )}
        </div>

        {statusError && (
          <p className="text-[11px] text-red-400 font-medium">{statusError}</p>
        )}

        {/* Actions bar */}
        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2">
          <select
            value={app.status.toLowerCase()}
            disabled={transitioning}
            onChange={e => handleStatusChange(e.target.value)}
            className="px-2 py-1 bg-zinc-900 border border-zinc-700/70 rounded-lg text-[11px] text-zinc-300 focus:outline-none cursor-pointer max-w-[110px]"
          >
            {['saved', 'prepared', 'applied', 'interviewing', 'accepted', 'declined', 'rejected', 'ghosted', 'withdrawn'].map(st => (
              <option key={st} value={st}>{st.toUpperCase()}</option>
            ))}
          </select>

          <button
            onClick={() => setReviewOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-semibold transition"
          >
            <FileText size={11} /> Review & Prep
          </button>
        </div>
      </motion.div>

      {reviewOpen && (
        <ReviewModal
          applicationId={app.id}
          job={{
            id: app.job_id,
            title: app.job_title,
            company: app.company,
            url: app.url || '',
            location: app.location,
          }}
          isOpen={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onStatusUpdated={() => onRefresh()}
        />
      )}
    </>
  );
};

// ─── Stats Card ───────────────────────────────────────────────────────────────
const StatsCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}> = ({ label, value, icon: Icon, color, sub }) => (
  <div className="glass p-5 rounded-xl flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={22} />
    </div>
    <div className="min-w-0">
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Main MissionControl ───────────────────────────────────────────────────────
export const MissionControl: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Risk stats (computed after analysis — updated per row but summarized here)
  const [riskCounts, setRiskCounts] = useState({ blocked: 0, warning: 0, safe: 0 });

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Try real application history first
      const appsRes = await api.get('/applications');
      const appsData: ApplicationRecord[] = appsRes.data || [];

      if (appsData.length > 0) {
        // Enrich with job details (url, location, description) from /jobs
        try {
          const jobsRes = await api.get('/jobs');
          const jobsMap = new Map<number, any>();
          (jobsRes.data || []).forEach((j: any) => jobsMap.set(j.id, j));
          setApplications(appsData.map(a => {
            const job = jobsMap.get(a.job_id);
            return {
              ...a,
              url: job?.url ?? a.url ?? '',
              location: job?.location ?? a.location ?? '',
              description: job?.description ?? a.description ?? '',
            };
          }));
        } catch {
          setApplications(appsData);
        }
      } else {
        setApplications([]);
      }
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Compute duplicate company applications
  const duplicateCompanyNames = React.useMemo(() => {
    const counts: Record<string, number> = {};
    applications.forEach(a => {
      if (a.company) {
        const key = a.company.trim().toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return new Set(
      Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .map(([comp]) => comp)
    );
  }, [applications]);

  // Compute stale applications (applied > 7 days ago without update)
  const staleApps = applications.filter(a =>
    a.status?.toLowerCase() === 'applied' &&
    a.applied_at &&
    Date.now() - new Date(a.applied_at).getTime() > 7 * 24 * 3600 * 1000
  );

  // Compute risk stats from analysis engine (run once after load)
  useEffect(() => {
    if (applications.length === 0) return;
    let blocked = 0, warning = 0, safe = 0;
    for (const app of applications) {
      const r = analyzeJobScamRisk(app);
      if (r.level === 'BLOCKED') blocked++;
      else if (r.level === 'WARNING') warning++;
      else safe++;
    }
    setRiskCounts({ blocked, warning, safe });
  }, [applications]);

  const statuses = ['All', ...Array.from(new Set(applications.map(a => a.status)))];

  // Count rows where the user actually reached applied, interview, or offer
  const appliedCount = applications.filter(a =>
    ['applied', 'interviewing', 'accepted'].includes(a.status?.toLowerCase())
  ).length;

  const filtered = applications.filter(app => {
    const matchSearch =
      app.job_title.toLowerCase().includes(search.toLowerCase()) ||
      app.company.toLowerCase().includes(search.toLowerCase()) ||
      (app.platform || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || app.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-8 pb-10">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Rocket size={26} className="text-blue-400" />
          <h2 className="text-4xl font-bold tracking-tight text-white">Mission Control</h2>
        </div>
        <p className="text-zinc-400 text-base ml-10">
          Track your applications with real-time fraud detection. Every job listing is automatically scanned for scam indicators.
        </p>
      </div>

      {/* ── Security Overview Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <StatsCard
          label="Total Applied"
          value={appliedCount}
          icon={CheckCircle2}
          color="bg-zinc-800/80 border-zinc-700/40 text-zinc-400"
          sub={`${applications.length} listings scanned`}
        />
        <StatsCard
          label="Blocked"
          value={riskCounts.blocked}
          icon={ShieldOff}
          color="bg-red-950/50 border-red-800/40 text-red-400"
          sub="High scam risk"
        />
        <StatsCard
          label="Warnings"
          value={riskCounts.warning}
          icon={ShieldAlert}
          color="bg-yellow-950/50 border-yellow-800/40 text-yellow-400"
          sub="Verify carefully"
        />
        <StatsCard
          label="Verified Safe"
          value={riskCounts.safe}
          icon={ShieldCheck}
          color="bg-green-950/50 border-green-800/40 text-green-400"
          sub="No flags detected"
        />
      </div>


      {/* ── Security Engine Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-5 py-3.5 bg-blue-950/30 border border-blue-800/30 rounded-xl"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-900/50 border border-blue-700/40 flex items-center justify-center shrink-0">
          <Zap size={16} className="text-blue-400" />
        </div>
        <div className="flex-1 text-sm">
          <span className="text-blue-300 font-semibold">Fraud Detection Engine Active</span>
          <span className="text-zinc-400 ml-2">
            · Real-time scam analysis across {applications.length} listing{applications.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-400 font-mono shrink-0">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          LIVE
        </div>
      </motion.div>

      {/* ── Follow-Up Reminder Alert Banner ── */}
      {staleApps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-200"
        >
          <Clock size={18} className="text-amber-400 shrink-0" />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-amber-300">Action Recommended:</span>{' '}
            You have <span className="font-bold underline">{staleApps.length} application(s)</span> in "Applied" status for over 7 days with no recruiter update. Consider sending a brief check-in.
          </div>
        </motion.div>
      )}

      {/* ── Applications List ── */}
      <div className="glass rounded-2xl overflow-hidden">

        {/* List header + controls */}
        <div className="px-6 py-5 border-b border-zinc-800/60 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-zinc-400" />
            Applications Log
            <span className="text-xs font-normal bg-zinc-800 border border-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">
              {filtered.length} of {applications.length}
            </span>
          </h3>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <LayoutGrid size={13} /> Kanban
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <List size={13} /> Table
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-700/60 w-48"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1">
              <Filter size={12} className="text-zinc-500" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 px-2 py-1.5 focus:outline-none"
              >
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Application rows */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-zinc-500 text-sm font-mono">Loading applications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-500">
              <ShieldCheck size={24} className="text-zinc-600" />
            </div>
            <div>
              <p className="text-zinc-200 font-semibold text-base">
                {applications.length === 0 ? 'No applications tracked yet' : 'No results match your filter'}
              </p>
              <p className="text-zinc-500 text-sm mt-1 max-w-md">
                {applications.length === 0
                  ? 'Save or prepare jobs from the dashboard feed to track your authentic application pipeline here.'
                  : 'Try adjusting your search query or status filter.'}
              </p>
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-6">
            {KANBAN_COLUMNS.map(col => {
              const colApps = filtered.filter(a => getColumnForStatus(a.status) === col.id);
              return (
                <div key={col.id} className="flex flex-col bg-zinc-950/40 rounded-xl border border-zinc-800/60 p-3 space-y-3 min-h-[420px]">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${col.color}`}>
                      {col.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                      {colApps.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[680px]">
                    {colApps.length === 0 ? (
                      <div className="h-28 flex items-center justify-center border border-dashed border-zinc-800/60 rounded-lg text-zinc-600 text-xs font-mono">
                        Empty
                      </div>
                    ) : (
                      colApps.map(app => {
                        const analysis = analyzeJobScamRisk(app);
                        const isStale =
                          app.status?.toLowerCase() === 'applied' &&
                          app.applied_at &&
                          Date.now() - new Date(app.applied_at).getTime() > 7 * 24 * 3600 * 1000;
                        const isDup = duplicateCompanyNames.has(app.company?.trim().toLowerCase());
                        return (
                          <KanbanCard
                            key={app.id}
                            app={app}
                            analysis={analysis}
                            onRefresh={fetchApplications}
                            duplicateCompany={isDup}
                            isStale={!!isStale}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="px-6 py-2.5 bg-zinc-900/40 border-b border-zinc-800/50 grid grid-cols-12 gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <div className="col-span-5">Role & Company</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 hidden sm:block">ATS</div>
              <div className="col-span-3 sm:col-span-3">Risk Level</div>
            </div>
            <AnimatePresence>
              {filtered.map((app, i) => (
                <ApplicationRow key={app.id} app={app} index={i} onRefresh={fetchApplications} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-zinc-500 p-4 bg-zinc-900/30 border border-zinc-800/40 rounded-xl">
        <p className="font-semibold text-zinc-400 mr-1">Security Legend:</p>
        <span className="flex items-center gap-1.5 text-red-400"><ShieldOff size={12} /> BLOCKED — High scam risk, interaction prevented</span>
        <span className="flex items-center gap-1.5 text-yellow-400"><ShieldAlert size={12} /> WARNING — Suspicious signals, verify before engaging</span>
        <span className="flex items-center gap-1.5 text-green-400"><ShieldCheck size={12} /> SAFE — No fraud indicators detected</span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(400%); }
        }
        .scan-line { animation: scan-line 1.5s infinite linear; }
      `}} />
    </div>
  );
};
