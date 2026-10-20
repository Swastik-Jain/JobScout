import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, GitBranch, Link2, Pencil, Check, X, Plus, Trash2,
  Briefcase, FolderGit2, GraduationCap, Zap, Loader2, Link,
  ShieldCheck, RefreshCw, Star,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { GithubRepo, ExperienceEntry, ProjectEntry, EducationEntry } from '../types';
import { useTerminal } from '../contexts/TerminalContext';
import { resolveApiUrl } from '../lib/api';

// ─── Small helpers ────────────────────────────────────────────────────────────
const InputRow: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}> = ({ label, value, onChange, type = 'text', placeholder, icon }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">{label}</label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-zinc-900/60 border border-zinc-700/60 rounded-xl py-3 pr-4 text-white outline-none focus:border-blue-500/70 transition-colors text-sm ${icon ? 'pl-10' : 'pl-4'}`}
      />
    </div>
  </div>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}> = ({ icon, title, editing, onEdit, onSave, onCancel, saving }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <span className="text-blue-400">{icon}</span>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
    </div>
    <div className="flex gap-2">
      {editing ? (
        <>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-600/30">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Save
          </button>
          <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs font-medium transition-colors border border-zinc-700">
            <X size={12} /> Cancel
          </button>
        </>
      ) : (
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs font-medium transition-colors border border-zinc-700">
          <Pencil size={12} /> Edit
        </button>
      )}
    </div>
  </div>
);

const TagPill: React.FC<{ label: string; onRemove?: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-xs font-medium border border-blue-800/40">
    {label}
    {onRemove && (
      <button onClick={onRemove} className="hover:text-red-400 transition-colors ml-0.5">
        <X size={10} />
      </button>
    )}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { pushLog, clearLogs } = useTerminal();

  const [, setVerifiedRepos] = useState<{ repoName: string; comment: string; tech: string[] }[]>([]);

  // Editing flags
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Local drafts (one per section) ──
  const [draftInfo, setDraftInfo] = useState({ name: '', phone: '', headline: '', github_url: '', linkedin_url: '' });
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [draftExperience, setDraftExperience] = useState<ExperienceEntry[]>([]);
  const [draftProjects, setDraftProjects] = useState<ProjectEntry[]>([]);
  const [draftEducation, setDraftEducation] = useState<EducationEntry[]>([]);
  const [draftRepos, setDraftRepos] = useState<GithubRepo[]>([]);
  const [repoInput, setRepoInput] = useState('');
  const [repoAnalyzing, setRepoAnalyzing] = useState(false);

  // Hydrate drafts from user
  useEffect(() => {
    if (!user) return;
    setDraftInfo({
      name: user.name || '',
      phone: user.phone || '',
      headline: user.headline || '',
      github_url: user.github_url || '',
      linkedin_url: user.linkedin_url || '',
    });
    setDraftSkills(user.skills || []);
    setDraftExperience(user.experience?.length ? user.experience : []);
    setDraftProjects(user.projects?.length ? user.projects : []);
    setDraftEducation(user.education?.length ? user.education : []);
    setDraftRepos(user.github_repos?.length ? user.github_repos : []);
    // Restore any previously verified repos from stored data
    const verified = (user.github_repos || []).filter(r => r.verified && r.agent_comment);
    if (verified.length) {
      setVerifiedRepos(verified.map(r => ({
        repoName: r.name || r.url || '',
        comment: r.agent_comment || '',
        tech: r.tech || [],
      })));
    }
  }, [user]);

  const startEdit = (section: string) => setEditingSection(section);
  const cancelEdit = (section: string) => {
    setEditingSection(null);
    // Rehydrate that section from user
    if (!user) return;
    if (section === 'info') setDraftInfo({ name: user.name || '', phone: user.phone || '', headline: user.headline || '', github_url: user.github_url || '', linkedin_url: user.linkedin_url || '' });
    if (section === 'skills') setDraftSkills(user.skills || []);
    if (section === 'experience') setDraftExperience(user.experience || []);
    if (section === 'projects') setDraftProjects(user.projects || []);
    if (section === 'education') setDraftEducation(user.education || []);
    if (section === 'repos') setDraftRepos(user.github_repos || []);
  };

  const saveSection = async (section: string) => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (section === 'info') Object.assign(payload, draftInfo);
      if (section === 'skills') payload.skills = draftSkills;
      if (section === 'experience') payload.experience = draftExperience;
      if (section === 'projects') payload.projects = draftProjects;
      if (section === 'education') payload.education = draftEducation;
      if (section === 'repos') {
        // Flush any typed-but-not-yet-added repo URL before saving
        let reposToSave = draftRepos;
        if (repoInput.trim()) {
          reposToSave = [...draftRepos, { url: repoInput.trim() }];
          setDraftRepos(reposToSave);
          setRepoInput('');
        }
        payload.github_repos = reposToSave;
      }
      await updateProfile(payload);
      setEditingSection(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Repo Analysis ──────────────────────────────────────────────────────────
  const handleRepoSync = async () => {
    // Flush any pending input before syncing
    let links = draftRepos.map(r => r.url).filter(Boolean);
    if (repoInput.trim()) {
      links = [...links, repoInput.trim()];
      setDraftRepos(r => [...r, { url: repoInput.trim() }]);
      setRepoInput('');
    }
    if (!links.length) return;

    setRepoAnalyzing(true);
    clearLogs();

    try {
      const response = await fetch(resolveApiUrl('/profile/analyze-repos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_links: links, email: user?.email }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let resultData: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const json = line.replace('data: ', '').trim();
          if (!json) continue;
          try {
            const chunk = JSON.parse(json);
            if (chunk.type === 'log') pushLog(chunk.log);
            if (chunk.type === 'result') resultData = chunk.data;
            if (chunk.type === 'error') pushLog(chunk.message);
          } catch { /* ignore */ }
        }
      }

      if (resultData) {
        const newRepos = (resultData.repos || []).map((r: any) => ({
          url: r.url || links[0],
          name: r.name,
          description: r.agent_comment,
          tech: r.tech || [],
          complexity_score: r.complexity_score,
          agent_comment: r.agent_comment,
          verified: true,
        }));
        setDraftRepos(newRepos);
        await updateProfile({ github_repos: newRepos });

        setVerifiedRepos(newRepos.map((r: any) => ({
          repoName: r.name || r.url,
          comment: r.agent_comment || '',
          tech: r.tech || [],
        })));

        pushLog(`[RepoAgent] ➔ ✅ Intelligence sync complete. ${newRepos.length} repo(s) verified.`);
      }
    } catch (e) {
      pushLog('[RepoAgent] ➔ ❌ Sync failed. Check backend connection.');
    } finally {
      setRepoAnalyzing(false);
    }
  };



  // ── Onboarding state (new user with no data yet) ──
  const isNewUser = user && !user.headline && !user.skills?.length && !user.experience?.length;

  if (!user) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-zinc-500" size={32} />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      <div className="mb-2">
        <h2 className="text-4xl font-bold tracking-tight text-white">Profile</h2>
        <p className="text-zinc-400 text-base mt-1">Manage your profile — used by the AI to find and apply for jobs.</p>
      </div>

      {/* Onboarding hint */}
      {isNewUser && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-blue-950/40 border border-blue-700/30 rounded-xl px-5 py-3 text-blue-300 text-sm"
        >
          <Zap size={16} className="shrink-0 text-blue-400" />
          <span>👋 Complete your profile once — it's permanently saved and auto-loaded every time you log in.</span>
        </motion.div>
      )}

      {/* ── Profile Header ── */}
      <div className="glass rounded-xl p-6">
        <SectionHeader
          icon={<User size={18} />}
          title="Personal Info"
          editing={editingSection === 'info'}
          onEdit={() => startEdit('info')}
          onSave={() => saveSection('info')}
          onCancel={() => cancelEdit('info')}
          saving={saving}
        />
        {editingSection === 'info' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputRow label="Full Name" value={draftInfo.name} onChange={v => setDraftInfo(d => ({ ...d, name: v }))} placeholder="John Doe" icon={<User size={14} />} />
            <InputRow label="Phone" value={draftInfo.phone} onChange={v => setDraftInfo(d => ({ ...d, phone: v }))} placeholder="+91 98765 43210" icon={<Phone size={14} />} />
            <div className="md:col-span-2">
              <InputRow label="Headline" value={draftInfo.headline} onChange={v => setDraftInfo(d => ({ ...d, headline: v }))} placeholder="Full-Stack Engineer · Python · React" />
            </div>
            <InputRow label="GitHub URL" value={draftInfo.github_url} onChange={v => setDraftInfo(d => ({ ...d, github_url: v }))} placeholder="https://github.com/username" icon={<GitBranch size={14} />} />
            <InputRow label="LinkedIn URL" value={draftInfo.linkedin_url} onChange={v => setDraftInfo(d => ({ ...d, linkedin_url: v }))} placeholder="https://linkedin.com/in/username" icon={<Link2 size={14} />} />
          </div>
        ) : (
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600/40 to-purple-600/40 border border-zinc-700 flex items-center justify-center text-2xl font-bold text-white shrink-0">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white">{user.name || '—'}</h3>
              <p className="text-zinc-400 text-sm mt-0.5">{user.headline || <span className="italic text-zinc-600">No headline yet</span>}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><Mail size={12} />{user.email}</span>
                {user.phone && <span className="flex items-center gap-1.5"><Phone size={12} />{user.phone}</span>}
                {user.github_url && (
                  <a href={user.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors">
                    <GitBranch size={12} />{user.github_url.replace('https://github.com/', '')}
                  </a>
                )}
                {user.linkedin_url && (
                  <a href={user.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors">
                    <Link2 size={12} />LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Skills ── */}
      <div className="glass rounded-xl p-6">
        <SectionHeader
          icon={<Zap size={18} />}
          title="Core Skills"
          editing={editingSection === 'skills'}
          onEdit={() => startEdit('skills')}
          onSave={() => saveSection('skills')}
          onCancel={() => cancelEdit('skills')}
          saving={saving}
        />
        {editingSection === 'skills' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {draftSkills.map((s, i) => (
                <TagPill key={i} label={s} onRemove={() => setDraftSkills(sk => sk.filter((_, idx) => idx !== i))} />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
                    e.preventDefault();
                    setDraftSkills(s => [...s, skillInput.trim()]);
                    setSkillInput('');
                  }
                }}
                placeholder="Type a skill and press Enter..."
                className="flex-1 bg-zinc-900/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/70 transition-colors"
              />
              <button
                onClick={() => { if (skillInput.trim()) { setDraftSkills(s => [...s, skillInput.trim()]); setSkillInput(''); } }}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm border border-zinc-700 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {user.skills?.length ? user.skills.map((s, i) => <TagPill key={i} label={s} />) : (
              <p className="text-zinc-600 text-sm italic">No skills added yet.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Experience ── */}
      <div className="glass rounded-xl p-6">
        <SectionHeader
          icon={<Briefcase size={18} />}
          title="Experience"
          editing={editingSection === 'experience'}
          onEdit={() => startEdit('experience')}
          onSave={() => saveSection('experience')}
          onCancel={() => cancelEdit('experience')}
          saving={saving}
        />
        {editingSection === 'experience' ? (
          <div className="space-y-4">
            {draftExperience.map((exp, i) => (
              <div key={i} className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-700/40 space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-xs font-medium">Entry {i + 1}</span>
                  <button onClick={() => setDraftExperience(e => e.filter((_, idx) => idx !== i))} className="text-red-500/60 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputRow label="Company" value={exp.company} onChange={v => setDraftExperience(e => e.map((x, idx) => idx === i ? { ...x, company: v } : x))} placeholder="Google" />
                  <InputRow label="Role" value={exp.role} onChange={v => setDraftExperience(e => e.map((x, idx) => idx === i ? { ...x, role: v } : x))} placeholder="Software Engineer" />
                  <InputRow label="Duration" value={exp.duration} onChange={v => setDraftExperience(e => e.map((x, idx) => idx === i ? { ...x, duration: v } : x))} placeholder="Jan 2022 – Present" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Description</label>
                  <textarea
                    value={exp.description}
                    onChange={e => setDraftExperience(ex => ex.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                    rows={3}
                    placeholder="Key responsibilities and achievements..."
                    className="w-full bg-zinc-900/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/70 transition-colors resize-none"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => setDraftExperience(e => [...e, { company: '', role: '', duration: '', description: '' }])}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm border border-zinc-700 border-dashed transition-colors w-full justify-center"
            >
              <Plus size={14} /> Add Experience
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {user.experience?.length ? user.experience.map((exp, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-px bg-zinc-700 self-stretch mx-3 relative">
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
                <div className="pb-4 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{exp.role}</span>
                    <span className="text-zinc-500 text-xs">@</span>
                    <span className="text-blue-400 text-sm font-medium">{exp.company}</span>
                    <span className="text-zinc-500 text-xs ml-auto">{exp.duration}</span>
                  </div>
                  <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">{exp.description}</p>
                </div>
              </div>
            )) : <p className="text-zinc-600 text-sm italic">No experience entries yet.</p>}
          </div>
        )}
      </div>

      {/* ── Projects ── */}
      <div className="glass rounded-xl p-6">
        <SectionHeader
          icon={<FolderGit2 size={18} />}
          title="Projects"
          editing={editingSection === 'projects'}
          onEdit={() => startEdit('projects')}
          onSave={() => saveSection('projects')}
          onCancel={() => cancelEdit('projects')}
          saving={saving}
        />
        {editingSection === 'projects' ? (
          <div className="space-y-4">
            {draftProjects.map((proj, i) => (
              <div key={i} className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-700/40 space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-xs font-medium">Project {i + 1}</span>
                  <button onClick={() => setDraftProjects(p => p.filter((_, idx) => idx !== i))} className="text-red-500/60 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputRow label="Project Name" value={proj.name} onChange={v => setDraftProjects(p => p.map((x, idx) => idx === i ? { ...x, name: v } : x))} placeholder="Job Bot" />
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Tech Stack</label>
                    <input
                      type="text"
                      defaultValue={proj.tech_stack?.join(', ') || ''}
                      onBlur={e => {
                        const parsed = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                        setDraftProjects(p => p.map((x, idx) => idx === i ? { ...x, tech_stack: parsed } : x));
                      }}
                      placeholder="Python, FastAPI, React, PostgreSQL"
                      className="w-full bg-zinc-900/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/70 transition-colors"
                    />
                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {proj.tech_stack.map((t, ti) => (
                          <span key={ti} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/50 rounded text-xs">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <InputRow label="Live URL" value={proj.live_url || ''} onChange={v => setDraftProjects(p => p.map((x, idx) => idx === i ? { ...x, live_url: v } : x))} placeholder="https://..." icon={<Link size={12} />} />
                  <InputRow label="Repo URL" value={proj.repo_url || ''} onChange={v => setDraftProjects(p => p.map((x, idx) => idx === i ? { ...x, repo_url: v } : x))} placeholder="https://github.com/..." icon={<GitBranch size={12} />} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Description</label>
                  <textarea
                    value={proj.description}
                    onChange={e => setDraftProjects(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                    rows={2}
                    placeholder="What does this project do?"
                    className="w-full bg-zinc-900/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/70 transition-colors resize-none"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => setDraftProjects(p => [...p, { name: '', description: '', tech_stack: [], live_url: '', repo_url: '' }])}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm border border-zinc-700 border-dashed transition-colors w-full justify-center"
            >
              <Plus size={14} /> Add Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user.projects?.length ? user.projects.map((proj, i) => (
              <div key={i} className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-800/50 space-y-2">
                <h4 className="font-semibold text-white text-sm">{proj.name}</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">{proj.description}</p>
                {proj.tech_stack?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {proj.tech_stack.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs border border-zinc-700/50">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  {proj.live_url && <a href={proj.live_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Link size={10} />Live</a>}
                  {proj.repo_url && <a href={proj.repo_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><GitBranch size={10} />Repo</a>}
                </div>
              </div>
            )) : <p className="text-zinc-600 text-sm italic">No projects added yet.</p>}
          </div>
        )}
      </div>

      {/* ── GitHub Repos (Repository Intelligence Agent) ── */}
      <div className="glass rounded-xl p-6 border border-purple-900/20">
        <SectionHeader
          icon={<GitBranch size={18} />}
          title="GitHub Repositories"
          editing={editingSection === 'repos'}
          onEdit={() => startEdit('repos')}
          onSave={() => saveSection('repos')}
          onCancel={() => cancelEdit('repos')}
          saving={saving}
        />

        {editingSection === 'repos' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={repoInput}
                onChange={e => setRepoInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && repoInput.trim()) {
                    e.preventDefault();
                    setDraftRepos(r => [...r, { url: repoInput.trim() }]);
                    setRepoInput('');
                  }
                }}
                placeholder="https://github.com/username/repo"
                className="flex-1 bg-zinc-900/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500/70 transition-colors font-mono"
              />
              <button
                onClick={() => { if (repoInput.trim()) { setDraftRepos(r => [...r, { url: repoInput.trim() }]); setRepoInput(''); } }}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm border border-zinc-700 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            {draftRepos.map((repo, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${repo.verified ? 'border-purple-700/30 bg-purple-950/10' : 'border-zinc-700/40 bg-zinc-900/30'}`}>
                <GitBranch size={14} className={repo.verified ? 'text-purple-400' : 'text-zinc-500'} />
                <span className="flex-1 text-sm font-mono text-zinc-300 truncate">{repo.url}</span>
                {repo.verified && <ShieldCheck size={13} className="text-purple-400 shrink-0" />}
                <button onClick={() => setDraftRepos(r => r.filter((_, idx) => idx !== i))} className="text-red-500/60 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {draftRepos.length > 0 && (
              <button
                onClick={handleRepoSync}
                disabled={repoAnalyzing}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-purple-900/30 hover:bg-purple-800/40 disabled:opacity-60 text-purple-300 rounded-xl text-sm font-semibold border border-purple-700/30 transition-colors"
              >
                {repoAnalyzing ? (
                  <><span className="w-3 h-3 border border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> Analyzing with RepoAgent...</>
                ) : (
                  <><RefreshCw size={14} /> Sync & Analyze with RepoAgent</>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {user.github_repos?.length ? user.github_repos.map((repo, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${repo.verified ? 'border-purple-700/30 bg-purple-950/10' : 'border-zinc-700/40 bg-zinc-900/20'}`}>
                <GitBranch size={14} className={`mt-0.5 shrink-0 ${repo.verified ? 'text-purple-400' : 'text-zinc-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={repo.url} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-400 hover:text-blue-300 truncate">
                      {repo.name || repo.url}
                    </a>
                    {repo.verified && (
                      <span className="flex items-center gap-1 text-xs text-purple-400 font-medium">
                        <ShieldCheck size={11} /> Verified
                      </span>
                    )}
                    {repo.complexity_score && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <Star size={10} /> {repo.complexity_score}/10
                      </span>
                    )}
                  </div>
                  {repo.agent_comment && <p className="text-zinc-400 text-xs mt-1">{repo.agent_comment}</p>}
                  {repo.tech && repo.tech.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {repo.tech.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-center py-6">
                <GitBranch size={28} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-600 text-sm">No repos linked. Edit this section to add GitHub links.</p>
                <p className="text-zinc-700 text-xs mt-1">The RepoAgent will analyze and verify your skills automatically.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Education ── */}
      <div className="glass rounded-xl p-6">
        <SectionHeader
          icon={<GraduationCap size={18} />}
          title="Education"
          editing={editingSection === 'education'}
          onEdit={() => startEdit('education')}
          onSave={() => saveSection('education')}
          onCancel={() => cancelEdit('education')}
          saving={saving}
        />
        {editingSection === 'education' ? (
          <div className="space-y-4">
            {draftEducation.map((edu, i) => (
              <div key={i} className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-700/40 space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-xs font-medium">Entry {i + 1}</span>
                  <button onClick={() => setDraftEducation(e => e.filter((_, idx) => idx !== i))} className="text-red-500/60 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <InputRow label="Degree" value={edu.degree} onChange={v => setDraftEducation(e => e.map((x, idx) => idx === i ? { ...x, degree: v } : x))} placeholder="B.Tech CSE" />
                  <InputRow label="Institution" value={edu.institution} onChange={v => setDraftEducation(e => e.map((x, idx) => idx === i ? { ...x, institution: v } : x))} placeholder="IIT Delhi" />
                  <InputRow label="Year" value={edu.year} onChange={v => setDraftEducation(e => e.map((x, idx) => idx === i ? { ...x, year: v } : x))} placeholder="2020 – 2024" />
                </div>
              </div>
            ))}
            <button
              onClick={() => setDraftEducation(e => [...e, { degree: '', institution: '', year: '' }])}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm border border-zinc-700 border-dashed transition-colors w-full justify-center"
            >
              <Plus size={14} /> Add Education
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {user.education?.length ? user.education.map((edu, i) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
                <GraduationCap size={18} className="text-zinc-500 shrink-0" />
                <div>
                  <p className="text-white text-sm font-semibold">{edu.degree}</p>
                  <p className="text-zinc-400 text-xs">{edu.institution} · {edu.year}</p>
                </div>
              </div>
            )) : <p className="text-zinc-600 text-sm italic">No education entries yet.</p>}
          </div>
        )}
      </div>


    </div>
  );
};
