/**
 * Client-side Heuristic Job Fraud Detection Library
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Fast, transparent pattern-matching rules that inspect job title,
 * company, platform, and description signals for scam/spam indicators.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Info,
  EyeOff,
  X,
} from 'lucide-react';

export type RiskLevel = 'BLOCKED' | 'WARNING' | 'SAFE' | 'SCANNING';

export interface ScamSignal {
  label: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface RiskAnalysis {
  level: RiskLevel;
  score: number; // 0-100, higher = riskier
  signals: ScamSignal[];
  summary: string;
}

export interface JobRiskInput {
  job_title?: string;
  title?: string;
  company?: string;
  description?: string;
  platform?: string;
  location?: string;
}

/**
 * Evaluates rule-based heuristic patterns against job metadata.
 */
export function analyzeJobScamRisk(job: JobRiskInput): RiskAnalysis {
  const signals: ScamSignal[] = [];
  let score = 0;

  const titleLower = (job.job_title || job.title || '').toLowerCase();
  const companyLower = (job.company || '').toLowerCase();
  const descLower = (job.description || '').toLowerCase();
  const platformLower = (job.platform || '').toLowerCase();

  // 1. High severity scam phrases
  const highRiskPhrases = [
    'work from home earn',
    'make money fast',
    'no experience required earn',
    'guaranteed income',
    'earn $5000 per week',
    'earn $3000',
    'earn $2000 daily',
    'unlimited income',
    'be your own boss',
    'mlm',
    'multi-level marketing',
    'crypto trading agent',
    'telegram job',
    'whatsapp recruiter',
    'pay registration fee',
    'registration fee required',
    'upfront payment',
    'send us your bank details',
    'mystery shopper',
  ];

  for (const phrase of highRiskPhrases) {
    if (descLower.includes(phrase) || titleLower.includes(phrase)) {
      signals.push({
        label: 'Scam Keyword Detected',
        severity: 'high',
        description: `High-risk phrase detected: "${phrase}". Legitimate employers never ask for registration fees or guarantee passive wealth.`,
      });
      score += 35;
      break;
    }
  }

  // 2. Suspicious contact channels
  if (descLower.includes('whatsapp') || descLower.includes('telegram') || descLower.includes('dm us')) {
    signals.push({
      label: 'Non-Professional Contact Channel',
      severity: 'high',
      description: 'Recruitment strictly via WhatsApp/Telegram DMs without verifiable corporate domains is a common scam vector.',
    });
    score += 30;
  }

  // 3. Unrealistic compensation claims
  const salaryMatch = descLower.match(/\$(\d[\d,]+)\s*(per\s*(day|week|hour)|\/day|\/week|\/hr)/);
  if (salaryMatch) {
    const amount = parseInt(salaryMatch[1].replace(/,/g, ''), 10);
    if (amount > 500) {
      signals.push({
        label: 'Unrealistic Salary Claim',
        severity: 'high',
        description: `Claimed rate of $${amount.toLocaleString()} ${salaryMatch[2]} is statistically anomalous for entry/general roles.`,
      });
      score += 30;
    }
  }

  // 4. Medium severity suspicious job categories
  const mediumRiskTitleWords = [
    'agent',
    'reshipping',
    'package handler',
    'parcel',
    'mystery shopper',
    'online tutor earn',
    'data entry earn',
  ];
  for (const word of mediumRiskTitleWords) {
    if (titleLower.includes(word)) {
      signals.push({
        label: 'Suspicious Job Category',
        severity: 'medium',
        description: `"${word}" roles correlate heavily with mule and reshipping fraud schemes.`,
      });
      score += 20;
      break;
    }
  }

  // 5. Missing employer information
  if (!job.company || companyLower === 'unknown' || companyLower === 'confidential' || companyLower.length < 2) {
    signals.push({
      label: 'Anonymous Employer',
      severity: 'medium',
      description: 'No verifiable corporate entity provided.',
    });
    score += 20;
  }

  // 6. Suspiciously short description
  if (job.description && job.description.length < 80) {
    signals.push({
      label: 'Extremely Brief Description',
      severity: 'medium',
      description: 'Job description is under 80 characters and lacks responsibilities or requirements.',
    });
    score += 15;
  }

  // 7. Low severity patterns
  if (!job.location) {
    signals.push({
      label: 'No Location Specified',
      severity: 'low',
      description: 'No work location or timezone specified.',
    });
    score += 5;
  }

  if (platformLower.includes('unknown') || platformLower === '') {
    signals.push({
      label: 'Unverified Platform',
      severity: 'low',
      description: 'Listing not sourced from a recognized corporate ATS.',
    });
    score += 5;
  }

  const clampedScore = Math.min(100, score);
  let level: RiskLevel;
  let summary: string;

  if (clampedScore >= 60) {
    level = 'BLOCKED';
    summary = 'Flagged as high-risk by heuristic analysis. Multiple suspicious patterns detected. Action is gated for protection.';
  } else if (clampedScore >= 25) {
    level = 'WARNING';
    summary = 'Shows caution indicators. Independently verify the employer portal before sharing sensitive candidate information.';
  } else {
    level = 'SAFE';
    summary = 'Passed heuristic keyword checks. Appears standard based on verified platform signals.';
  }

  return { level, score: clampedScore, signals, summary };
}

export const RiskBadge: React.FC<{ level: RiskLevel; score?: number; small?: boolean }> = ({ level, score, small }) => {
  const cfg = {
    BLOCKED: {
      icon: ShieldOff,
      label: 'HEURISTIC: BLOCKED',
      cls: 'bg-red-950/50 border-red-700/50 text-red-400',
    },
    WARNING: {
      icon: ShieldAlert,
      label: 'HEURISTIC: WARNING',
      cls: 'bg-yellow-950/50 border-yellow-700/50 text-yellow-400',
    },
    SAFE: {
      icon: ShieldCheck,
      label: 'HEURISTIC: SAFE',
      cls: 'bg-green-950/50 border-green-700/50 text-green-400',
    },
    SCANNING: {
      icon: Shield,
      label: 'SCANNING',
      cls: 'bg-blue-950/50 border-blue-700/50 text-blue-400',
    },
  }[level];

  const Icon = cfg.icon;
  return (
    <span
      title="Client-side heuristic pattern check against common recruitment fraud markers"
      className={`inline-flex items-center gap-1.5 border rounded-lg font-bold ${cfg.cls} ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <Icon size={small ? 10 : 12} />
      {cfg.label}
      {score !== undefined && !small && (
        <span className="opacity-70 font-normal">· {score}%</span>
      )}
    </span>
  );
};

export const RiskDonut: React.FC<{ score: number; level: RiskLevel }> = ({ score, level }) => {
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
          cx="40"
          cy="40"
          r={radius}
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

export const BlockOverlay: React.FC<{
  job: { job_title?: string; title?: string; company?: string };
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
      <div className="bg-red-950/40 border-b border-red-800/40 px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-900/50 border border-red-700/50 flex items-center justify-center shrink-0">
          <ShieldOff size={24} className="text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-0.5">
            ⛔ Heuristic Alert — Job Flagged
          </p>
          <h3 className="text-white font-bold text-base truncate">{job.job_title || job.title}</h3>
          <p className="text-zinc-400 text-sm">{job.company}</p>
        </div>
        <button onClick={onDismiss} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-center gap-5">
          <RiskDonut score={analysis.score} level="BLOCKED" />
          <div>
            <p className="text-red-300 font-semibold text-sm mb-1">High Scam Risk Detected</p>
            <p className="text-zinc-400 text-xs leading-relaxed">{analysis.summary}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Heuristic Flags</p>
          <div className="space-y-2">
            {analysis.signals.map((sig, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
                  sig.severity === 'high'
                    ? 'bg-red-950/30 border-red-800/30 text-red-300'
                    : sig.severity === 'medium'
                    ? 'bg-yellow-950/30 border-yellow-800/30 text-yellow-300'
                    : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-400'
                }`}
              >
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{sig.label}</p>
                  <p className="opacity-80 mt-0.5">{sig.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

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
        <p className="text-center text-xs text-zinc-600">Automated client-side heuristic rules. Always verify independently.</p>
      </div>
    </motion.div>
  </motion.div>
);

export const WarningModal: React.FC<{
  job: { job_title?: string; title?: string; company?: string };
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
          <h3 className="text-white font-bold text-sm truncate">{job.job_title || job.title}</h3>
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
