import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ResumeUpload, type ParseResult } from '../components/ResumeUpload';
import { ProfileStrengthMeter } from '../components/ProfileStrengthMeter';
import { ProfileForm } from '../components/ProfileForm';
import type { UserProfile } from '../types';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const [parsedData, setParsedData] = useState<Partial<UserProfile>>({});
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [attentionFields, setAttentionFields] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const draftKey = `jb_onboarding_draft_${user?.id || 'candidate'}`;

  const handleResumeParsed = (result: ParseResult) => {
    const data = result.parsedData || {};

    // Map graduation_year to year for Education entries
    let mappedEdu = data.education || [];
    if (Array.isArray(mappedEdu)) {
      mappedEdu = mappedEdu.map((edu: any) => ({
        degree: edu.degree || '',
        institution: edu.institution || '',
        year: edu.year || edu.graduation_year || edu.grad_year || '',
      }));
    }

    setParsedData({
      name: data.name || user?.name || '',
      headline: data.headline || user?.headline || '',
      phone: data.phone || user?.phone || '',
      target_role: data.target_role || user?.target_role || 'Software Engineer',
      preferred_location: data.preferred_location || user?.preferred_location || 'India, Remote',
      skills: Array.isArray(data.skills) && data.skills.length > 0 ? data.skills : user?.skills || [],
      education: mappedEdu.length > 0 ? mappedEdu : user?.education || [],
      experience: Array.isArray(data.experience) ? data.experience : user?.experience || [],
      projects: Array.isArray(data.projects) ? data.projects : user?.projects || [],
      github_url: data.github_url || user?.github_url || '',
      linkedin_url: data.linkedin_url || user?.linkedin_url || '',
    });

    setConfidence(result.confidence || {});
    setAttentionFields(result.attentionFields || []);
  };

  const handleSaveProfile = async (confirmedData: Partial<UserProfile>) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateProfile(confirmedData);
      // Clean up localStorage draft
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      // Redirect to /jobs and initiate auto-scan
      navigate('/jobs', { state: { autoScan: true } });
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to save profile. Please retry.';
      setSaveError(msg);
      setIsSaving(false);
    }
  };

  const formatName = (str?: string) => {
    if (!str) return 'there';
    return str
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-zinc-900/80 bg-black/60 backdrop-blur-md px-6 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </span>
          <span className="text-white font-semibold text-base tracking-tight">JobScout</span>
          <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">
            Profile Setup
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span className="hidden sm:inline">Grounded Fact Guarantee · Zero Auto-Submit</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Step 1 of 2
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-xs text-zinc-500">Candidate Profile</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Welcome, {formatName(user?.name)}. Let's build your profile.
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            Upload your resume to autofill details, or complete the fields manually. JobScout uses
            these confirmed facts to match verified opportunities and tailor your application materials.
          </p>
        </motion.div>

        {/* Resume Upload Component */}
        <section className="space-y-2">
          <ResumeUpload onParsed={handleResumeParsed} />
        </section>

        {/* Profile Strength Meter */}
        <section>
          <ProfileStrengthMeter
            profile={{
              ...user,
              ...parsedData,
            }}
            isFresher={
              !parsedData.experience?.length && (!user?.experience || user.experience.length === 0)
            }
          />
        </section>

        {/* Save error message if present */}
        {saveError && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs">
            {saveError}
          </div>
        )}

        {/* Confirmed Profile Form */}
        <section className="pt-2">
          <ProfileForm
            initialData={{
              name: user?.name || '',
              headline: user?.headline || '',
              phone: user?.phone || '',
              target_role: user?.target_role || 'Software Engineer',
              preferred_location: user?.preferred_location || 'India, Remote',
              skills: user?.skills || [],
              education: user?.education || [],
              experience: user?.experience || [],
              projects: user?.projects || [],
              github_url: user?.github_url || '',
              linkedin_url: user?.linkedin_url || '',
              ...parsedData,
            }}
            confidence={confidence}
            attentionFields={attentionFields}
            mode="onboarding"
            draftKey={draftKey}
            submitLabel="Find Jobs"
            isSaving={isSaving}
            onSave={handleSaveProfile}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900/80 py-5 px-6 sm:px-8 text-center text-xs text-zinc-500">
        &copy; 2026 JobScout. All application materials strictly use your confirmed profile facts.
      </footer>
    </div>
  );
};
