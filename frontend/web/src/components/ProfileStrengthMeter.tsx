import React from 'react';
import { CheckCircle2, Circle, Sparkles, AlertCircle } from 'lucide-react';
import type { UserProfile } from '../types';

interface ProfileStrengthMeterProps {
  profile: Partial<UserProfile>;
  isFresher?: boolean;
  className?: string;
}

export interface CompletionState {
  percentage: number;
  isReady: boolean;
  hasTargetRole: boolean;
  hasLocation: boolean;
  hasSkills: boolean;
  hasEducation: boolean;
  hasExperienceOrFresher: boolean;
  hasProjects: boolean;
  missingRequired: string[];
}

export function computeProfileStrength(profile: Partial<UserProfile>, isFresher = false): CompletionState {
  const hasTargetRole = Boolean(profile.target_role?.trim());
  const hasLocation = Boolean(profile.preferred_location?.trim());
  const hasSkills = Boolean(profile.skills && profile.skills.length > 0 && profile.skills.some((s) => s.trim()));

  const hasEducation = Boolean(
    profile.education &&
      profile.education.length > 0 &&
      profile.education.some((edu: any) => {
        const inst = edu.institution || '';
        const deg = edu.degree || '';
        const yr = edu.year || edu.graduation_year || edu.grad_year || '';
        return (inst.trim() || deg.trim()) && String(yr).trim();
      })
  );

  const hasExperienceOrFresher = Boolean(
    isFresher || (profile.experience && profile.experience.length > 0)
  );

  const hasProjects = Boolean(profile.projects && profile.projects.length > 0);

  // Missing required items
  const missingRequired: string[] = [];
  if (!hasTargetRole) missingRequired.push('Target Role');
  if (!hasLocation) missingRequired.push('Preferred Location');
  if (!hasSkills) missingRequired.push('At least 1 Skill');
  if (!hasEducation) missingRequired.push('Education with Graduation Year');

  // Compute percentage:
  // 4 required items: 20% each = 80%
  // Experience / Fresher: 10%
  // Projects: 5%
  // Headline / Contact: 5%
  let score = 0;
  if (hasTargetRole) score += 20;
  if (hasLocation) score += 20;
  if (hasSkills) score += 20;
  if (hasEducation) score += 20;
  if (hasExperienceOrFresher) score += 10;
  if (hasProjects) score += 5;
  if (profile.headline?.trim() || profile.phone?.trim()) score += 5;

  const isReady = missingRequired.length === 0;

  return {
    percentage: Math.min(100, score),
    isReady,
    hasTargetRole,
    hasLocation,
    hasSkills,
    hasEducation,
    hasExperienceOrFresher,
    hasProjects,
    missingRequired,
  };
}

export const ProfileStrengthMeter: React.FC<ProfileStrengthMeterProps> = ({
  profile,
  isFresher = false,
  className = '',
}) => {
  const state = computeProfileStrength(profile, isFresher);

  const barColor =
    state.percentage >= 80 && state.isReady
      ? 'bg-emerald-500'
      : state.percentage >= 50
      ? 'bg-blue-500'
      : 'bg-amber-500';

  return (
    <div className={`glass rounded-2xl p-5 border border-zinc-800 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className={state.isReady ? 'text-emerald-400' : 'text-blue-400'} />
          <h4 className="text-sm font-semibold text-white">Profile Strength</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-white">{state.percentage}%</span>
          {state.isReady ? (
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={11} /> Ready to match
            </span>
          ) : (
            <span className="text-[11px] font-medium text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle size={11} /> Required fields needed
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${barColor}`}
          style={{ width: `${state.percentage}%` }}
        />
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
            state.hasTargetRole
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              : 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
          }`}
        >
          {state.hasTargetRole ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <Circle size={13} className="text-zinc-600 shrink-0" />}
          <span className="truncate">Role (Req)</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
            state.hasLocation
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              : 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
          }`}
        >
          {state.hasLocation ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <Circle size={13} className="text-zinc-600 shrink-0" />}
          <span className="truncate">Location (Req)</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
            state.hasSkills
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              : 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
          }`}
        >
          {state.hasSkills ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <Circle size={13} className="text-zinc-600 shrink-0" />}
          <span className="truncate">Skills (Req)</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
            state.hasEducation
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              : 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
          }`}
        >
          {state.hasEducation ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <Circle size={13} className="text-zinc-600 shrink-0" />}
          <span className="truncate">Grad Year (Req)</span>
        </div>
      </div>

      {!state.isReady && state.missingRequired.length > 0 && (
        <p className="text-[11px] text-zinc-400 pt-1">
          Missing required for matching:{' '}
          <span className="text-amber-300 font-medium">{state.missingRequired.join(', ')}</span>
        </p>
      )}
    </div>
  );
};
