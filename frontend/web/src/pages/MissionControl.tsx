import React, { useEffect, useState, useCallback } from 'react';
import {
  Rocket, Clock, CheckCircle2, AlertCircle,
  ShieldAlert, ShieldCheck, ShieldOff, Shield,
  EyeOff, X, AlertTriangle, ExternalLink,
  Building2, MapPin, Zap, Info, ChevronDown, ChevronUp,
  Search, Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

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
}

type RiskLevel = 'BLOCKED' | 'WARNING' | 'SAFE' | 'SCANNING';

interface ScamSignal {
  label: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface RiskAnalysis {
  level: RiskLevel;
  score: number; // 0-100, higher = riskier
  signals: ScamSignal[];
  summary: string;
}

// ─── Scam Detection Engine ────────────────────────────────────────────────────
/**
 * Client-side heuristic fraud detector.
 * Analyses title, company, description, platform, and salary signals
 * to produce a risk score and flag suspicious patterns.
 */
function analyzeJobScamRisk(job: ApplicationRecord): RiskAnalysis {
  const signals: ScamSignal[] = [];
  let score = 0;

  const titleLower = (job.job_title || '').toLowerCase();
  const companyLower = (job.company || '').toLowerCase();
  const descLower = (job.description || '').toLowerCase();
  const platformLower = (job.platform || '').toLowerCase();

  // ── HIGH severity patterns ──────────────────────────────────────────────────
  const highRiskPhrases = [
    'work from home earn', 'make money fast', 'no experience required earn',
    'guaranteed income', 'earn $5000 per week', 'earn $3000', 'earn $2000 daily',
    'unlimited income', 'be your own boss', 'mlm', 'multi-level marketing',
    'crypto trading agent', 'telegram job', 'whatsapp recruiter',
    'pay registration fee', 'registration fee required', 'upfront payment',
    'send us your bank details', 'mystery shopper',
  ];
  for (const phrase of highRiskPhrases) {
    if (descLower.includes(phrase) || titleLower.includes(phrase)) {
      signals.push({
        label: 'Scam Keyword Detected',
        severity: 'high',
        description: `High-risk phrase detected: "${phrase}". Legitimate jobs never ask for payment or promise unrealistic income.`,
      });
      score += 35;
      break;
    }
  }

  // ── Suspicious contact methods ──────────────────────────────────────────────
  if (descLower.includes('whatsapp') || descLower.includes('telegram') || descLower.includes('dm us')) {
    signals.push({
      label: 'Non-Professional Contact Channel',
      severity: 'high',
      description: 'Recruitment via WhatsApp/Telegram DMs is a common scam indicator.',
    });
    score += 30;
  }

  // ── Unrealistic salary ──────────────────────────────────────────────────────
  const salaryMatch = descLower.match(/\$(\d[\d,]+)\s*(per\s*(day|week|hour)|\/day|\/week|\/hr)/);
  if (salaryMatch) {
    const amount = parseInt(salaryMatch[1].replace(/,/g, ''));
    if (amount > 500) {
      signals.push({
        label: 'Unrealistic Salary Claim',
        severity: 'high',
        description: `Claimed rate of $${amount.toLocaleString()} ${salaryMatch[2]} is abnormally high and suspicious.`,
      });
      score += 30;
    }
  }

  // ── MEDIUM severity patterns ────────────────────────────────────────────────
  const mediumRiskTitleWords = [
    'agent', 'reshipping', 'package handler', 'parcel', 'mystery shopper',
    'online tutor earn', 'data entry earn',
  ];
  for (const word of mediumRiskTitleWords) {
    if (titleLower.includes(word)) {
      signals.push({
        label: 'Suspicious Job Category',
        severity: 'medium',
        description: `"${word}" roles are frequently associated with reshipping/mule scams.`,
      });
      score += 20;
      break;
    }
  }

  // ── Missing company info ──────────────────────────────────────────────────
  if (!job.company || companyLower === 'unknown' || companyLower === 'confidential' || companyLower.length < 2) {
    signals.push({
      label: 'Anonymous Employer',
      severity: 'medium',
      description: 'No verifiable company name provided. Legitimate employers are transparent about their identity.',
    });
    score += 20;
  }

  // ── Vague description ──────────────────────────────────────────────────────
  if (job.description && job.description.length < 80) {
    signals.push({
      label: 'Suspiciously Vague Description',
      severity: 'medium',
      description: 'The job description is unusually short and provides no real role details.',
    });
    score += 15;
  }

  // ── Email in description (harvesting) ──────────────────────────────────────
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(descLower) &&
    !descLower.includes('@company') && !descLower.includes('@linkedin')) {
    signals.push({
      label: 'Raw Email in Listing',
      severity: 'medium',
      description: 'Job postings containing raw email addresses may be harvesting contact information.',
    });
    score += 12;
  }

  // ── LOW severity patterns ───────────────────────────────────────────────────
  if (!job.location) {
    signals.push({
      label: 'No Location Provided',
      severity: 'low',
      description: 'No office location listed. Not necessarily fraudulent but reduces verifiability.',
    });
    score += 5;
  }

  if (platformLower.includes('unknown') || platformLower === '') {
    signals.push({
      label: 'Unknown Source Platform',
      severity: 'low',
      description: 'Job not sourced from a verified professional platform.',
    });
    score += 5;
  }

  // ── Determine risk level ────────────────────────────────────────────────────
  const clampedScore = Math.min(100, score);
  let level: RiskLevel;
  let summary: string;

  if (clampedScore >= 60) {
    level = 'BLOCKED';
    summary = 'This job has been flagged as high-risk. Multiple scam indicators detected. Interaction is blocked for your safety.';
  } else if (clampedScore >= 25) {
    level = 'WARNING';
    summary = 'This job shows suspicious characteristics. Proceed with caution and verify the employer independently.';
  } else {
    level = 'SAFE';
    summary = 'No major scam indicators detected. This job appears legitimate based on available signals.';
  }

  return { level, score: clampedScore, signals, summary };
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────
const RiskBadge: React.FC<{ level: RiskLevel; score?: number; small?: boolean }> = ({ level, score, small }) => {
  const cfg = {
    BLOCKED: {
      icon: ShieldOff,
      label: 'BLOCKED',
      cls: 'bg-red-950/50 border-red-700/50 text-red-400',
      dot: 'bg-red-500',
    },
    WARNING: {
      icon: ShieldAlert,
      label: 'WARNING',
      cls: 'bg-yellow-950/50 border-yellow-700/50 text-yellow-400',
      dot: 'bg-yellow-500',
    },
    SAFE: {
      icon: ShieldCheck,
      label: 'SAFE',
      cls: 'bg-green-950/50 border-green-700/50 text-green-400',
      dot: 'bg-green-500',
    },
    SCANNING: {
      icon: Shield,
      label: 'SCANNING',
      cls: 'bg-blue-950/50 border-blue-700/50 text-blue-400',
      dot: 'bg-blue-500 animate-pulse',
    },
  }[level];

  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-lg font-bold ${cfg.cls} ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
      <Icon size={small ? 10 : 12} />
      {cfg.label}
      {score !== undefined && !small && (
        <span className="opacity-70 font-normal">· {score}%</span>
      )}
    </span>
  );
};

// ─── Risk Score Donut ─────────────────────────────────────────────────────────
const RiskDonut: React.FC<{ score: number; level: RiskLevel }> = ({ score, level }) => {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = circumference - (score / 100) * circumference;

  const colors = {
    BLOCKED: '#f87171',
    WARNING: '#facc15',
    SAFE: '#4ade80',
    SCANNING: '#60a5fa',
  };

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#27272a" strokeWidth="8" />
        <motion.circle
          cx="40" cy="40" r={radius}
          fill="none"
          stroke={colors[level]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: strokeDash }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white leading-none">{score}</span>
        <span className="text-xs text-zinc-500 mt-0.5">risk</span>
      </div>
    </div>
  );
};

// ─── Block Overlay ────────────────────────────────────────────────────────────
const BlockOverlay: React.FC<{
  job: ApplicationRecord;
  analysis: RiskAnalysis;
  onDismiss: () => void;
  onForceView: () => void;
}> = ({ job, analysis, onDismiss, onForceView }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      className="w-full max-w-lg bg-zinc-900 border border-red-800/50 rounded-2xl shadow-2xl shadow-red-900/30 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-red-950/40 border-b border-red-800/40 px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-900/50 border border-red-700/50 flex items-center justify-center shrink-0">
          <ShieldOff size={24} className="text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-0.5">
            ⛔ Security Alert — Job Blocked
          </p>
          <h3 className="text-white font-bold text-base truncate">{job.job_title}</h3>
          <p className="text-zinc-400 text-sm">{job.company}</p>
        </div>
        <button onClick={onDismiss} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {/* Score + Summary */}
        <div className="flex items-center gap-5">
          <RiskDonut score={analysis.score} level="BLOCKED" />
          <div>
            <p className="text-red-300 font-semibold text-sm mb-1">High Scam Risk Detected</p>
            <p className="text-zinc-400 text-xs leading-relaxed">{analysis.summary}</p>
          </div>
        </div>

        {/* Signals */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Fraud Signals</p>
          <div className="space-y-2">
            {analysis.signals.map((sig, i) => (
              <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
                sig.severity === 'high'
                  ? 'bg-red-950/30 border-red-800/30 text-red-300'
                  : sig.severity === 'medium'
                  ? 'bg-yellow-950/30 border-yellow-800/30 text-yellow-300'
                  : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-400'
              }`}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{sig.label}</p>
                  <p className="opacity-80 mt-0.5">{sig.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-semibold transition-colors"
          >
            Go Back to Safety
          </button>
          <button
            onClick={onForceView}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 rounded-xl text-sm transition-colors"
          >
            <EyeOff size={14} /> View Anyway
          </button>
        </div>
        <p className="text-center text-xs text-zinc-600">This block is based on automated analysis. Always verify independently.</p>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Warning Modal ────────────────────────────────────────────────────────────
const WarningModal: React.FC<{
  job: ApplicationRecord;
  analysis: RiskAnalysis;
  onDismiss: () => void;
  onProceed: () => void;
}> = ({ job, analysis, onDismiss, onProceed }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
  >
    <motion.div
      initial={{ scale: 0.95, y: 15 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.95, y: 15 }}
      className="w-full max-w-md bg-zinc-900 border border-yellow-800/50 rounded-2xl shadow-2xl shadow-yellow-900/20 overflow-hidden"
    >
      <div className="bg-yellow-950/30 border-b border-yellow-800/30 px-6 py-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-yellow-900/40 border border-yellow-700/40 flex items-center justify-center shrink-0">
          <ShieldAlert size={20} className="text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-yellow-600 mb-0.5">⚠️ Caution Advised</p>
          <h3 className="text-white font-bold text-sm truncate">{job.job_title}</h3>
          <p className="text-zinc-400 text-xs">{job.company}</p>
        </div>
        <button onClick={onDismiss} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <RiskDonut score={analysis.score} level="WARNING" />
          <p className="text-zinc-300 text-xs leading-relaxed">{analysis.summary}</p>
        </div>

        <div className="space-y-1.5">
          {analysis.signals.map((sig, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-yellow-950/20 border border-yellow-800/20 rounded-lg text-xs text-yellow-200">
              <Info size={11} className="mt-0.5 shrink-0 text-yellow-500" />
              <span className="font-medium">{sig.label}:</span>
              <span className="text-zinc-400">{sig.description}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="flex-1 py-2.5 bg-yellow-700/40 hover:bg-yellow-700/60 border border-yellow-700/40 text-yellow-200 rounded-xl text-sm font-semibold transition-colors"
          >
            Proceed with Caution
          </button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Application Row ──────────────────────────────────────────────────────────
const ApplicationRow: React.FC<{ app: ApplicationRecord; index: number }> = ({ app, index }) => {
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [scanning, setScanning] = useState(true);
  const [showBlock, setShowBlock] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overridden, setOverridden] = useState(false);   // user forced view past block
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

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

  const statusStyles: Record<string, string> = {
    Applied: 'text-green-400 bg-green-400/10 border-green-400/20',
    Pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    Interview: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    Rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
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
              <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${statusStyles[app.status] || statusStyles.Pending}`}>
                {app.status}
              </span>
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

// ─── Simulation Dataset ───────────────────────────────────────────────────────
/**
 * Original 8-record simulation dataset used when no real API data is available.
 * Deterministically verified against analyzeJobScamRisk():
 *   3 SAFE · 2 WARNING · 3 BLOCKED
 * Used to showcase all fraud-detection states in the UI.
 */
function getSimulationDataset(): ApplicationRecord[] {
  const now = Date.now();
  return [
    // ── ✅ SAFE — score ~0 ────────────────────────────────────────────────────
    {
      id: 1, job_id: 101,
      job_title: 'Senior React Developer',
      company: 'TechCorp Inc.',
      platform: 'LinkedIn', status: 'Interview', ats_score: 88,
      applied_at: new Date(now - 3_600_000).toISOString(),
      location: 'Bangalore, India',
      url: 'https://www.linkedin.com/jobs/view/senior-react-developer-techcorp',
      description:
        'We are looking for an experienced React Developer with 5+ years building scalable '
        + 'web applications using React, TypeScript, and modern tooling. Competitive salary, '
        + 'remote-friendly, and a great engineering culture.',
    },
    {
      id: 3, job_id: 103,
      job_title: 'Full Stack Engineer',
      company: 'Startup Ventures',
      platform: 'Indeed', status: 'Applied', ats_score: 91,
      applied_at: new Date(now - 86_400_000).toISOString(),
      location: 'Remote',
      url: 'https://in.indeed.com/viewjob?jk=fullstack-startup-ventures',
      description:
        'Join our engineering team to build the next generation platform. We use Node.js, '
        + 'React, PostgreSQL, and AWS. Competitive salary and equity offered.',
    },
    {
      id: 5, job_id: 105,
      job_title: 'Backend Python Engineer',
      company: 'DataSystems Ltd',
      platform: 'Naukri', status: 'Applied', ats_score: 82,
      applied_at: new Date(now - 259_200_000).toISOString(),
      location: 'Hyderabad, India',
      url: 'https://www.naukri.com/job-listings-backend-python-datasystems',
      description:
        'Python backend engineer role with 3+ years of experience in FastAPI, Django, '
        + 'microservices architecture, and cloud deployments on GCP.',
    },

    // ── ⚠️ WARNING — score ~37–52 ─────────────────────────────────────────────
    // anonymous (+20) + raw email (+12) + vague desc <80 chars (+15) + no location (+5) = 52
    {
      id: 6, job_id: 106,
      job_title: 'Online Data Entry Coordinator',
      company: 'Confidential',
      platform: 'OLX', status: 'Pending', ats_score: 55,
      applied_at: new Date(now - 43_200_000).toISOString(),
      url: 'https://www.olx.in/item/data-entry-coordinator-ID34512',
      description: 'Data entry tasks. Contact: applynow.jobs2024@gmail.com for details.',
    },
    // "agent" in title (+20) + anonymous company (+20) + no location (+5) = 45
    {
      id: 7, job_id: 107,
      job_title: 'Social Media Brand Agent',
      company: '',
      platform: 'Facebook Jobs', status: 'Pending', ats_score: 42,
      applied_at: new Date(now - 129_600_000).toISOString(),
      url: 'https://www.facebook.com/jobs/social-media-brand-agent',
      description:
        'Manage social media accounts for our growing brand. Flexible hours, work from home. '
        + 'Contact our recruitment team for further details about compensation and role scope.',
    },

    // ── 🛑 BLOCKED — score ≥60 ────────────────────────────────────────────────
    // scam keyword (+35) + whatsapp (+30) + anonymous employer (+20) = 85
    {
      id: 2, job_id: 102,
      job_title: 'Work From Home Earn $3000 Weekly',
      company: 'Unknown',
      platform: 'Unknown', status: 'Applied', ats_score: 45,
      applied_at: new Date(now - 7_200_000).toISOString(),
      location: 'Remote (India)',
      url: 'https://earn3000weekly.info/apply',
      description:
        'No experience required earn guaranteed income working from home. '
        + 'Contact us on whatsapp immediately. Pay registration fee of $50 to get started.',
    },
    // "reshipping" in title (+20) + $500/day salary (+30) + telegram (+30) = 80
    {
      id: 4, job_id: 104,
      job_title: 'Package Reshipping Agent',
      company: 'GlobalShip Co',
      platform: 'Craigslist', status: 'Pending', ats_score: 30,
      applied_at: new Date(now - 172_800_000).toISOString(),
      url: 'https://craigslist.org/jobs/package-reshipping-agent',
      description:
        'Work from home reshipping packages earn $500/day. '
        + 'Reach out to our Telegram recruiter to get started immediately.',
    },
    // "crypto trading agent" (+35) + "dm us" (+30) + empty company (+20) + unknown platform (+5) = 90
    {
      id: 8, job_id: 108,
      job_title: 'Crypto Trading Agent — Unlimited Earnings',
      company: '',
      platform: 'Unknown', status: 'Applied', ats_score: 22,
      applied_at: new Date(now - 302_400_000).toISOString(),
      url: 'https://t.me/cryptotrading_earn',
      description:
        'Join our crypto trading agent network and earn unlimited income. '
        + 'Multi-level marketing opportunity. DM us on Instagram to onboard instantly.',
    },
  ];
}

// ─── Main MissionControl ───────────────────────────────────────────────────────
export const MissionControl: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [isDemo, setIsDemo] = useState(false);  // true when showing simulation data

  // Risk stats (computed after analysis — updated per row but summarized here)
  const [riskCounts, setRiskCounts] = useState({ blocked: 0, warning: 0, safe: 0 });

  // Convert a JobMatch from /jobs into an ApplicationRecord for display
  const jobMatchToAppRecord = (job: any, idx: number): ApplicationRecord => ({
    id: job.id ?? idx,
    job_id: job.id ?? idx,
    job_title: job.title ?? 'Unknown Role',
    company: job.company ?? 'Unknown',
    platform: job.platform ?? 'Unknown',
    status: 'Applied',
    ats_score: Math.round(job.match_score ?? 0),
    applied_at: job.created_at ?? new Date().toISOString(),
    location: job.location ?? '',
    description: job.description ?? '',
    url: job.url ?? '',
  });

  // Silently trigger the job finder agent in the background
  const triggerJobFetch = useCallback(async () => {
    try {
      await api.get('/fetch-jobs');
      // Re-load jobs after agent completes — replace simulation with real data
      const jobsRes = await api.get('/jobs');
      const jobs: any[] = jobsRes.data || [];
      if (jobs.length > 0) {
        setIsDemo(false);
        setApplications(jobs.map(jobMatchToAppRecord));
      }
    } catch (e) {
      console.warn('[MissionControl] Background job fetch failed:', e);
    }
  }, []);

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
          setIsDemo(false);
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
          setIsDemo(false);
          setApplications(appsData);
        }
      } else {
        // 2. No application history — use jobs from job_finder_agent directly
        const jobsRes = await api.get('/jobs');
        const jobs: any[] = jobsRes.data || [];
        if (jobs.length > 0) {
          setIsDemo(false);
          setApplications(jobs.map(jobMatchToAppRecord));
        } else {
          // 3. DB is empty — show simulation, trigger agent quietly in background
          setIsDemo(true);
          setApplications(getSimulationDataset());
          triggerJobFetch();
        }
      }
    } catch {
      // Network/auth error — still try /jobs as fallback
      try {
        const jobsRes = await api.get('/jobs');
        const jobs: any[] = jobsRes.data || [];
        if (jobs.length > 0) {
          setIsDemo(false);
          setApplications(jobs.map(jobMatchToAppRecord));
        } else {
          setIsDemo(true);
          setApplications(getSimulationDataset());
          triggerJobFetch();
        }
      } catch {
        // Full offline fallback — simulation only
        setIsDemo(true);
        setApplications(getSimulationDataset());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

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

  // Only count rows where the user actually applied (not just discovered jobs)
  const appliedCount = applications.filter(a => a.status === 'Applied' || a.status === 'Interview').length;

  const filtered = applications.filter(app => {
    const matchSearch =
      app.job_title.toLowerCase().includes(search.toLowerCase()) ||
      app.company.toLowerCase().includes(search.toLowerCase()) ||
      app.platform.toLowerCase().includes(search.toLowerCase());
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

      {/* ── Simulation Mode Banner (shown only when using synthetic data) ── */}
      {isDemo && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 px-5 py-4 bg-purple-950/30 border border-purple-700/30 rounded-xl"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-900/40 border border-purple-700/40 flex items-center justify-center shrink-0 mt-0.5">
            <Zap size={16} className="text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-purple-300 font-semibold text-sm">Simulation Mode — Fraud Detection Demo</p>
            <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">
              No real applications found. Showing <span className="text-white font-medium">8 synthetic listings</span>: &nbsp;
              <span className="text-green-400 font-medium">3 SAFE</span>,&nbsp;
              <span className="text-yellow-400 font-medium">2 WARNING</span>, and&nbsp;
              <span className="text-red-400 font-medium">3 BLOCKED</span> — to demonstrate all detection states.
              Click any row to see the full fraud analysis.
            </p>
          </div>
          <span className="text-xs font-bold font-mono px-2 py-1 bg-purple-900/40 border border-purple-700/40 text-purple-300 rounded-lg shrink-0">
            DEMO
          </span>
        </motion.div>
      )}

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
            · Scanning {applications.length} {isDemo ? 'simulated' : ''} application{applications.length !== 1 ? 's' : ''} for scam patterns in real-time
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-400 font-mono shrink-0">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          LIVE
        </div>
      </motion.div>

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

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-700/60 w-52"
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
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
            <AlertCircle size={24} className="text-zinc-700" />
            <p className="text-zinc-500 text-sm font-mono">
              {applications.length === 0
                ? isDemo
                  ? 'No real applications yet. The simulation above demonstrates fraud detection.'
                  : 'No results match your filter.'
                : 'No results match your filter.'}
            </p>
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
                <ApplicationRow key={app.id} app={app} index={i} />
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
