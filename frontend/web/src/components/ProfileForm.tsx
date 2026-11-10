import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  X,
  Check,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type { UserProfile, EducationEntry, ExperienceEntry, ProjectEntry } from '../types';
import { computeProfileStrength } from './ProfileStrengthMeter';

interface ProfileFormProps {
  initialData?: Partial<UserProfile>;
  confidence?: Record<string, number>;
  attentionFields?: string[];
  mode?: 'onboarding' | 'edit';
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
  draftKey?: string;
  submitLabel?: string;
}

const COMMON_SKILLS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'FastAPI',
  'Django',
  'PostgreSQL',
  'Docker',
  'AWS',
  'Git',
  'REST APIs',
  'Tailwind CSS',
  'SQL',
];

export const ProfileForm: React.FC<ProfileFormProps> = ({
  initialData = {},
  confidence = {},
  attentionFields = [],
  mode = 'onboarding',
  onSave,
  isSaving = false,
  onCancel,
  draftKey,
  submitLabel,
}) => {
  // ── Form State ──
  const [name, setName] = useState(initialData.name || '');
  const [headline, setHeadline] = useState(initialData.headline || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [targetRole, setTargetRole] = useState(initialData.target_role || 'Software Engineer');
  const [preferredLocation, setPreferredLocation] = useState(
    initialData.preferred_location || 'India, Remote'
  );
  const [seniorityLevel, setSeniorityLevel] = useState(
    initialData.seniority_level || 'Entry-Level / Fresher'
  );

  const [skills, setSkills] = useState<string[]>(initialData.skills || []);
  const [skillInput, setSkillInput] = useState('');

  const [education, setEducation] = useState<EducationEntry[]>(() => {
    if (initialData.education && initialData.education.length > 0) {
      return initialData.education.map((e: any) => ({
        degree: e.degree || '',
        institution: e.institution || '',
        year: e.year || e.graduation_year || e.grad_year || '',
      }));
    }
    return [{ degree: '', institution: '', year: '' }];
  });

  const [isFresher, setIsFresher] = useState(
    () => !initialData.experience || initialData.experience.length === 0
  );

  const [experience, setExperience] = useState<ExperienceEntry[]>(() => {
    if (initialData.experience && initialData.experience.length > 0) {
      return initialData.experience;
    }
    return [];
  });

  const [projects, setProjects] = useState<ProjectEntry[]>(() => {
    if (initialData.projects && initialData.projects.length > 0) {
      return initialData.projects;
    }
    return [];
  });

  const [githubUrl, setGithubUrl] = useState(initialData.github_url || '');
  const [linkedinUrl, setLinkedinUrl] = useState(initialData.linkedin_url || '');

  // Track attention markers that the user has reviewed / edited
  const [activeAttention, setActiveAttention] = useState<Set<string>>(new Set(attentionFields));
  const [draftRestored, setDraftRestored] = useState(false);

  // ── Restore Draft from LocalStorage on mount if available ──
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name !== undefined) setName(parsed.name);
        if (parsed.headline !== undefined) setHeadline(parsed.headline);
        if (parsed.phone !== undefined) setPhone(parsed.phone);
        if (parsed.target_role !== undefined) setTargetRole(parsed.target_role);
        if (parsed.preferred_location !== undefined) setPreferredLocation(parsed.preferred_location);
        if (parsed.seniority_level !== undefined) setSeniorityLevel(parsed.seniority_level);
        if (parsed.skills !== undefined) setSkills(parsed.skills);
        if (parsed.education !== undefined) setEducation(parsed.education);
        if (parsed.experience !== undefined) setExperience(parsed.experience);
        if (parsed.isFresher !== undefined) setIsFresher(parsed.isFresher);
        if (parsed.projects !== undefined) setProjects(parsed.projects);
        if (parsed.github_url !== undefined) setGithubUrl(parsed.github_url);
        if (parsed.linkedin_url !== undefined) setLinkedinUrl(parsed.linkedin_url);
        setDraftRestored(true);
      }
    } catch {
      /* ignore draft restore error */
    }
  }, [draftKey]);

  // When initialData changes (e.g. parsed from resume), merge it in
  useEffect(() => {
    if (initialData.name) setName(initialData.name);
    if (initialData.headline) setHeadline(initialData.headline);
    if (initialData.phone) setPhone(initialData.phone);
    if (initialData.target_role) setTargetRole(initialData.target_role);
    if (initialData.preferred_location) setPreferredLocation(initialData.preferred_location);
    if (initialData.seniority_level) setSeniorityLevel(initialData.seniority_level);
    if (initialData.skills && initialData.skills.length > 0) setSkills(initialData.skills);
    if (initialData.education && initialData.education.length > 0) {
      setEducation(
        initialData.education.map((e: any) => ({
          degree: e.degree || '',
          institution: e.institution || '',
          year: e.year || e.graduation_year || e.grad_year || '',
        }))
      );
    }
    if (initialData.experience && initialData.experience.length > 0) {
      setExperience(initialData.experience);
      setIsFresher(false);
    }
    if (initialData.projects && initialData.projects.length > 0) {
      setProjects(initialData.projects);
    }
    if (initialData.github_url) setGithubUrl(initialData.github_url);
    if (initialData.linkedin_url) setLinkedinUrl(initialData.linkedin_url);
  }, [initialData]);

  // Update attention set if props change
  useEffect(() => {
    if (attentionFields.length > 0) {
      setActiveAttention(new Set(attentionFields));
    }
  }, [attentionFields]);

  // ── Autosave Draft to LocalStorage ──
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftKey) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(() => {
      try {
        const payload = {
          name,
          headline,
          phone,
          target_role: targetRole,
          preferred_location: preferredLocation,
          seniority_level: seniorityLevel,
          skills,
          education,
          experience: isFresher ? [] : experience,
          isFresher,
          projects,
          github_url: githubUrl,
          linkedin_url: linkedinUrl,
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        /* storage full or disabled */
      }
    }, 400);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [
    name,
    headline,
    phone,
    targetRole,
    preferredLocation,
    seniorityLevel,
    skills,
    education,
    experience,
    isFresher,
    projects,
    githubUrl,
    linkedinUrl,
    draftKey,
  ]);

  const clearAttention = (field: string) => {
    setActiveAttention((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  // ── Skill Tag Handlers ──
  const addSkill = (skill: string) => {
    const clean = skill.trim();
    if (clean && !skills.includes(clean)) {
      setSkills((prev) => [...prev, clean]);
      clearAttention('skills');
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  // ── Education Handlers ──
  const updateEducation = (index: number, field: keyof EducationEntry, value: string) => {
    setEducation((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    clearAttention('education');
  };

  const addEducation = () => {
    setEducation((prev) => [...prev, { degree: '', institution: '', year: '' }]);
  };

  const removeEducation = (index: number) => {
    setEducation((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  // ── Experience Handlers ──
  const updateExperience = (index: number, field: keyof ExperienceEntry, value: string) => {
    setExperience((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    clearAttention('experience');
  };

  const addExperience = () => {
    setExperience((prev) => [
      ...prev,
      { company: '', role: '', duration: '', description: '' },
    ]);
    setIsFresher(false);
  };

  const removeExperience = (index: number) => {
    setExperience((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Project Handlers ──
  const updateProject = (index: number, field: keyof ProjectEntry, value: any) => {
    setProjects((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    clearAttention('projects');
  };

  const addProject = () => {
    setProjects((prev) => [
      ...prev,
      { name: '', description: '', tech_stack: [], live_url: '', repo_url: '' },
    ]);
  };

  const removeProject = (index: number) => {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Validation & Submit ──
  const currentProfileState: Partial<UserProfile> = {
    name,
    headline,
    phone,
    target_role: targetRole,
    preferred_location: preferredLocation,
    seniority_level: seniorityLevel,
    skills,
    education,
    experience: isFresher ? [] : experience,
    projects,
    github_url: githubUrl,
    linkedin_url: linkedinUrl,
  };

  const strength = computeProfileStrength(currentProfileState, isFresher);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strength.isReady) return;

    // Filter out blank education rows
    const cleanedEdu = education.filter(
      (e) => (e.institution.trim() || e.degree.trim()) && e.year.trim()
    );

    // Filter out blank experience
    const cleanedExp = isFresher
      ? []
      : experience.filter((exp) => exp.company.trim() || exp.role.trim());

    // Filter out blank projects
    const cleanedProj = projects.filter((p) => p.name.trim());

    const payload: Partial<UserProfile> = {
      name: name.trim(),
      headline: headline.trim() || undefined,
      phone: phone.trim() || undefined,
      target_role: targetRole.trim(),
      preferred_location: preferredLocation.trim(),
      seniority_level: seniorityLevel.trim(),
      skills,
      education: cleanedEdu,
      experience: cleanedExp,
      projects: cleanedProj,
      github_url: githubUrl.trim() || undefined,
      linkedin_url: linkedinUrl.trim() || undefined,
    };

    await onSave(payload);

    // Clean up draft on successful save
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
  };

  const isAttention = (field: string) =>
    activeAttention.has(field) ||
    (confidence[field] !== undefined && confidence[field] < 0.7);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {draftRestored && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-950/30 border border-blue-800/40 text-blue-300 text-xs">
          <span>Draft restored from your previous unsaved session.</span>
          <button
            type="button"
            onClick={() => {
              if (draftKey) localStorage.removeItem(draftKey);
              setDraftRestored(false);
            }}
            className="text-blue-400 hover:text-blue-200 underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Section: Target Role & Location (Required) ── */}
      <div className="glass p-6 rounded-2xl border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Briefcase size={16} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">Target Career & Preferences</h3>
              <p className="text-xs text-zinc-500">Core criteria used to match and rank job openings</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Required</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Role */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Target Role <span className="text-blue-400">*</span>
              </label>
              {isAttention('target_role') && (
                <span className="text-[10px] font-medium text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <AlertCircle size={10} /> Check this
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={targetRole}
              onFocus={() => clearAttention('target_role')}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Software Engineer, Frontend Developer, AI Engineer"
              className="w-full bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Preferred Location */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Preferred Location <span className="text-blue-400">*</span>
              </label>
              {isAttention('preferred_location') && (
                <span className="text-[10px] font-medium text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <AlertCircle size={10} /> Check this
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={preferredLocation}
              onFocus={() => clearAttention('preferred_location')}
              onChange={(e) => setPreferredLocation(e.target.value)}
              placeholder="e.g. Bengaluru, India, Remote"
              className="w-full bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Seniority Level */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Experience Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Entry-Level / Fresher', label: 'Entry-Level / Fresher' },
                { id: 'Mid-Level (2-5 yrs)', label: 'Mid-Level (2-5 yrs)' },
                { id: 'Senior (5+ yrs)', label: 'Senior (5+ yrs)' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setSeniorityLevel(lvl.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition cursor-pointer ${
                    seniorityLevel === lvl.id
                      ? 'bg-blue-600/20 border-blue-500/60 text-white font-semibold shadow-sm shadow-blue-900/30'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Skills (Required) ── */}
      <div className="glass p-6 rounded-2xl border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Sparkles size={16} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">Skills & Technologies</h3>
              <p className="text-xs text-zinc-500">Only list skills you have real experience with</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAttention('skills') && (
              <span className="text-[10px] font-medium text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertCircle size={10} /> Check this
              </span>
            )}
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Required</span>
          </div>
        </div>

        {/* Tag Input */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill(skillInput);
                }
              }}
              placeholder="Type a skill and press Enter or click Add (e.g. React, Python)"
              className="flex-1 bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
            <button
              type="button"
              onClick={() => addSkill(skillInput)}
              disabled={!skillInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {/* Active Skills List */}
          <div className="flex flex-wrap gap-2 min-h-10 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/60 items-center">
            {skills.length === 0 ? (
              <span className="text-xs text-zinc-500 italic">
                No skills added yet. Add at least 1 skill to complete your profile.
              </span>
            ) : (
              skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/30 text-blue-300 rounded-lg text-xs font-medium border border-blue-800/40 group"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-blue-400/80 hover:text-red-400 transition"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Quick Suggestions */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-zinc-500">Quick add popular skills:</span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SKILLS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s)}
                  className="px-2 py-0.5 rounded-md bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Education (Required with Grad Year) ── */}
      <div className="glass p-6 rounded-2xl border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <GraduationCap size={16} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">Education & Graduation Year</h3>
              <p className="text-xs text-zinc-500">Degree, institution, and graduation year are required</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAttention('education') && (
              <span className="text-[10px] font-medium text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertCircle size={10} /> Check this
              </span>
            )}
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Required</span>
          </div>
        </div>

        <div className="space-y-4">
          {education.map((edu, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3 relative group"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Degree / Field <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={edu.degree}
                    onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                    placeholder="e.g. B.Tech Computer Science"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Institution / University <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={edu.institution}
                    onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                    placeholder="e.g. IIT Delhi"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Graduation Year <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={edu.year}
                    onChange={(e) => updateEducation(idx, 'year', e.target.value)}
                    placeholder="e.g. 2025"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {education.length > 1 && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => removeEducation(idx)}
                    className="text-xs text-red-400/80 hover:text-red-300 flex items-center gap-1 transition"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addEducation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition cursor-pointer"
          >
            <Plus size={13} /> Add another degree
          </button>
        </div>
      </div>

      {/* ── Section: Experience (Optional / Fresher Toggle) ── */}
      <div className="glass p-6 rounded-2xl border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Briefcase size={16} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">Work Experience</h3>
              <p className="text-xs text-zinc-500">Optional for new graduates and entry-level talent</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAttention('experience') && !isFresher && (
              <span className="text-[10px] font-medium text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertCircle size={10} /> Check this
              </span>
            )}
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Optional</span>
          </div>
        </div>

        {/* Fresher Checkbox Toggle */}
        <label className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition select-none">
          <input
            type="checkbox"
            checked={isFresher}
            onChange={(e) => {
              setIsFresher(e.target.checked);
              if (e.target.checked) {
                clearAttention('experience');
              }
            }}
            className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-0 bg-zinc-800 cursor-pointer"
          />
          <div>
            <p className="text-xs font-semibold text-white">I don't have work experience yet (Fresher / Student)</p>
            <p className="text-[11px] text-zinc-400">
              Your profile will be complete and matched with entry-level and fresher-friendly opportunities.
            </p>
          </div>
        </label>

        {!isFresher && (
          <div className="space-y-4 pt-1">
            {experience.map((exp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                      placeholder="e.g. Acme Inc."
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={exp.role}
                      onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                      placeholder="e.g. Frontend Intern"
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Duration
                    </label>
                    <input
                      type="text"
                      value={exp.duration}
                      onChange={(e) => updateExperience(idx, 'duration', e.target.value)}
                      placeholder="e.g. Jun 2024 - Dec 2024"
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Key Highlights
                  </label>
                  <textarea
                    rows={2}
                    value={exp.description}
                    onChange={(e) => updateExperience(idx, 'description', e.target.value)}
                    placeholder="Summarize your main responsibilities and achievements"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => removeExperience(idx)}
                    className="text-xs text-red-400/80 hover:text-red-300 flex items-center gap-1 transition"
                  >
                    <Trash2 size={12} /> Remove role
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addExperience}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition cursor-pointer"
            >
              <Plus size={13} /> Add experience entry
            </button>
          </div>
        )}
      </div>

      {/* ── Section: Projects (Optional) ── */}
      <div className="glass p-6 rounded-2xl border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <FolderGit2 size={16} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">Projects</h3>
              <p className="text-xs text-zinc-500">Showcase your independent work or open-source projects</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Optional</span>
        </div>

        <div className="space-y-4">
          {projects.map((proj, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={proj.name}
                    onChange={(e) => updateProject(idx, 'name', e.target.value)}
                    placeholder="e.g. Distributed Task Queue"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Repository / Live URL
                  </label>
                  <input
                    type="url"
                    value={proj.repo_url || proj.live_url || ''}
                    onChange={(e) => updateProject(idx, 'repo_url', e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={proj.description}
                  onChange={(e) => updateProject(idx, 'description', e.target.value)}
                  placeholder="What does it do and what technologies did you use?"
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => removeProject(idx)}
                  className="text-xs text-red-400/80 hover:text-red-300 flex items-center gap-1 transition"
                >
                  <Trash2 size={12} /> Remove project
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition cursor-pointer"
          >
            <Plus size={13} /> Add project
          </button>
        </div>
      </div>

      {/* ── Section: Contact & Socials (Optional) ── */}
      <div className="glass p-6 rounded-2xl border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <User size={16} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">Contact & Profile Links</h3>
              <p className="text-xs text-zinc-500">Links will be added to your generated resumes and cover notes</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Optional</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Professional Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Full-Stack Engineer · React & Python"
              className="w-full bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              GitHub Profile URL
            </label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username"
              className="w-full bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              LinkedIn Profile URL
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className="w-full bg-zinc-900/70 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>
      </div>

      {/* ── Form Actions / Submit ── */}
      <div className="sticky bottom-4 z-20 glass p-4 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {!strength.isReady ? (
            <p className="text-xs text-amber-300 flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              Complete required fields ({strength.missingRequired.join(', ')}) to find jobs
            </p>
          ) : (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <Check size={14} className="shrink-0" />
              Profile ready · Materials are strictly grounded in your confirmed facts
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {mode === 'edit' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={!strength.isReady || isSaving}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition shadow-lg cursor-pointer ${
              strength.isReady && !isSaving
                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                {submitLabel || (mode === 'onboarding' ? 'Find Jobs' : 'Save Changes')}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};
