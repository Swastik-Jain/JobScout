import React, { useState, useEffect, useMemo } from 'react';
import { usePDF } from '@react-pdf/renderer';
import {
  Save,
  Download,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { ResumeDocument } from './ResumeDocument';
import type {
  ResumeData,
  ResumeBasics,
  ResumeLink,
  ExperienceItem,
  ProjectItem,
  EducationItem,
} from '../../types';
import api from '../../lib/api';

interface ResumeStudioProps {
  applicationId: number;
  initial: ResumeData;
  onSaved: (version: any) => void;
}

function countWords(str: string): number {
  const trimmed = str.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function ResumeStudio({
  applicationId,
  initial,
  onSaved,
}: ResumeStudioProps) {
  const [resume, setResume] = useState<ResumeData>(initial);
  const [debouncedData, setDebouncedData] = useState<ResumeData>(initial);
  const [pageCount, setPageCount] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Debounce resume edits by 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedData(resume);
    }, 400);
    return () => clearTimeout(handler);
  }, [resume]);

  // Check if edited
  const isDirty = useMemo(() => {
    return JSON.stringify(resume) !== JSON.stringify(initial);
  }, [resume, initial]);

  // Count metric placeholders
  const metricPlaceholders = useMemo(() => {
    let count = 0;
    if (resume.summary?.includes('[add metric]')) count++;
    resume.experience?.forEach((e) => {
      e.bullets?.forEach((b) => {
        if (b.includes('[add metric]')) count++;
      });
    });
    resume.projects?.forEach((p) => {
      p.bullets?.forEach((b) => {
        if (b.includes('[add metric]')) count++;
      });
    });
    return count;
  }, [resume]);

  // PDF instance and dynamic update
  const [instance, update] = usePDF({
    document: <ResumeDocument data={debouncedData} onPages={setPageCount} />,
  });

  useEffect(() => {
    update(<ResumeDocument data={debouncedData} onPages={setPageCount} />);
  }, [debouncedData, update]);

  // Keep last good URL
  const [lastGoodUrl, setLastGoodUrl] = useState<string | null>(null);
  useEffect(() => {
    if (instance.url) {
      setLastGoodUrl(instance.url);
    }
  }, [instance.url]);

  const activePdfUrl = instance.url || lastGoodUrl;

  // Handle Save
  const handleSave = async () => {
    try {
      setSaving(true);
      setApiError(null);
      setSavedSuccess(false);

      const res = await api.put(`/applications/${applicationId}/resume`, resume);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      onSaved(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to save resume changes.';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Handle Download confirmation if metric placeholders remain
  const handleDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (metricPlaceholders > 0) {
      const confirmed = window.confirm(
        `${metricPlaceholders} bullets still contain [add metric]. Download anyway?`
      );
      if (!confirmed) {
        e.preventDefault();
      }
    }
  };

  // Field update helpers
  const updateBasics = (field: keyof ResumeBasics, value: any) => {
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        [field]: value,
      },
    }));
  };

  const addLink = () => {
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        links: [...(prev.basics.links || []), { label: 'Link', url: '' }],
      },
    }));
  };

  const updateLink = (index: number, field: keyof ResumeLink, value: string) => {
    setResume((prev) => {
      const newLinks = [...(prev.basics.links || [])];
      newLinks[index] = { ...newLinks[index], [field]: value };
      return {
        ...prev,
        basics: { ...prev.basics, links: newLinks },
      };
    });
  };

  const removeLink = (index: number) => {
    setResume((prev) => {
      const newLinks = [...(prev.basics.links || [])];
      newLinks.splice(index, 1);
      return {
        ...prev,
        basics: { ...prev.basics, links: newLinks },
      };
    });
  };

  // Skill Groups
  const addSkillGroup = () => {
    if (resume.skills.length >= 6) return;
    setResume((prev) => ({
      ...prev,
      skills: [...prev.skills, { category: 'Tools', items: [] }],
    }));
  };

  const updateSkillCategory = (index: number, category: string) => {
    setResume((prev) => {
      const newSkills = [...prev.skills];
      newSkills[index] = { ...newSkills[index], category };
      return { ...prev, skills: newSkills };
    });
  };

  const updateSkillItems = (index: number, itemsStr: string) => {
    const items = itemsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setResume((prev) => {
      const newSkills = [...prev.skills];
      newSkills[index] = { ...newSkills[index], items };
      return { ...prev, skills: newSkills };
    });
  };

  const removeSkillGroup = (index: number) => {
    setResume((prev) => {
      const newSkills = [...prev.skills];
      newSkills.splice(index, 1);
      return { ...prev, skills: newSkills };
    });
  };

  // Experience
  const addExperience = () => {
    setResume((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          role: 'Software Engineer',
          company: 'Company',
          location: '',
          start: '2023',
          end: 'Present',
          bullets: ['Built reliable backend workflows with measurable throughput improvements.'],
        },
      ],
    }));
  };

  const updateExperience = (index: number, field: keyof ExperienceItem, val: any) => {
    setResume((prev) => {
      const newExp = [...prev.experience];
      newExp[index] = { ...newExp[index], [field]: val };
      return { ...prev, experience: newExp };
    });
  };

  const addExpBullet = (expIndex: number) => {
    if ((resume.experience[expIndex]?.bullets?.length || 0) >= 4) return;
    setResume((prev) => {
      const newExp = [...prev.experience];
      const bullets = [...newExp[expIndex].bullets, ''];
      newExp[expIndex] = { ...newExp[expIndex], bullets };
      return { ...prev, experience: newExp };
    });
  };

  const updateExpBullet = (expIndex: number, bIndex: number, text: string) => {
    setResume((prev) => {
      const newExp = [...prev.experience];
      const bullets = [...newExp[expIndex].bullets];
      bullets[bIndex] = text;
      newExp[expIndex] = { ...newExp[expIndex], bullets };
      return { ...prev, experience: newExp };
    });
  };

  const removeExpBullet = (expIndex: number, bIndex: number) => {
    setResume((prev) => {
      const newExp = [...prev.experience];
      const bullets = [...newExp[expIndex].bullets];
      bullets.splice(bIndex, 1);
      newExp[expIndex] = { ...newExp[expIndex], bullets };
      return { ...prev, experience: newExp };
    });
  };

  const removeExperience = (index: number) => {
    setResume((prev) => {
      const newExp = [...prev.experience];
      newExp.splice(index, 1);
      return { ...prev, experience: newExp };
    });
  };

  // Projects
  const addProject = () => {
    if (resume.projects.length >= 4) return;
    setResume((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          name: 'Featured Project',
          tech: ['Python', 'FastAPI'],
          url: '',
          bullets: ['Engineered scalable microservices architecture.'],
        },
      ],
    }));
  };

  const updateProject = (index: number, field: keyof ProjectItem, val: any) => {
    setResume((prev) => {
      const newProj = [...prev.projects];
      newProj[index] = { ...newProj[index], [field]: val };
      return { ...prev, projects: newProj };
    });
  };

  const addProjBullet = (projIndex: number) => {
    if ((resume.projects[projIndex]?.bullets?.length || 0) >= 4) return;
    setResume((prev) => {
      const newProj = [...prev.projects];
      const bullets = [...newProj[projIndex].bullets, ''];
      newProj[projIndex] = { ...newProj[projIndex], bullets };
      return { ...prev, projects: newProj };
    });
  };

  const updateProjBullet = (projIndex: number, bIndex: number, text: string) => {
    setResume((prev) => {
      const newProj = [...prev.projects];
      const bullets = [...newProj[projIndex].bullets];
      bullets[bIndex] = text;
      newProj[projIndex] = { ...newProj[projIndex], bullets };
      return { ...prev, projects: newProj };
    });
  };

  const removeProjBullet = (projIndex: number, bIndex: number) => {
    setResume((prev) => {
      const newProj = [...prev.projects];
      const bullets = [...newProj[projIndex].bullets];
      bullets.splice(bIndex, 1);
      newProj[projIndex] = { ...newProj[projIndex], bullets };
      return { ...prev, projects: newProj };
    });
  };

  const removeProject = (index: number) => {
    setResume((prev) => {
      const newProj = [...prev.projects];
      newProj.splice(index, 1);
      return { ...prev, projects: newProj };
    });
  };

  // Education
  const addEducation = () => {
    setResume((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          degree: 'B.S. in Computer Science',
          institution: 'University',
          location: '',
          start: '2020',
          end: '2024',
          score: '',
        },
      ],
    }));
  };

  const updateEducation = (index: number, field: keyof EducationItem, val: any) => {
    setResume((prev) => {
      const newEdu = [...prev.education];
      newEdu[index] = { ...newEdu[index], [field]: val };
      return { ...prev, education: newEdu };
    });
  };

  const removeEducation = (index: number) => {
    setResume((prev) => {
      const newEdu = [...prev.education];
      newEdu.splice(index, 1);
      return { ...prev, education: newEdu };
    });
  };

  // Certifications
  const addCert = () => {
    setResume((prev) => ({
      ...prev,
      certifications: [...prev.certifications, ''],
    }));
  };

  const updateCert = (index: number, val: string) => {
    setResume((prev) => {
      const newC = [...prev.certifications];
      newC[index] = val;
      return { ...prev, certifications: newC };
    });
  };

  const removeCert = (index: number) => {
    setResume((prev) => {
      const newC = [...prev.certifications];
      newC.splice(index, 1);
      return { ...prev, certifications: newC };
    });
  };

  const downloadFilename = `${(resume.basics.name || 'Resume').replace(/\s+/g, '_')}_Resume.pdf`;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {/* Page Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-300">Pages: {pageCount}</span>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Resume exceeds one page</span>
            </div>
          )}

          {metricPlaceholders > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-950/50 border border-amber-700/60 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{metricPlaceholders} bullet(s) still need a metric</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> Saved!
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          <a
            href={activePdfUrl || '#'}
            download={downloadFilename}
            onClick={handleDownloadClick}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-medium transition bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 shadow-sm ${
              !activePdfUrl || instance.loading
                ? 'opacity-40 pointer-events-none'
                : 'cursor-pointer'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            {instance.loading ? 'Rendering PDF…' : 'Download PDF'}
          </a>
        </div>
      </div>

      {/* API Error Notification */}
      {apiError && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/80 flex items-center gap-2 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Tab toggle for < lg */}
      <div className="flex lg:hidden items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'edit'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            Edit Form
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            PDF Preview
          </button>
        </div>

        {activePdfUrl && (
          <a
            href={activePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Open in new tab <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Main 2-Column or Tabbed Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px] flex-1">
        {/* Left Column: Structured Form Editor */}
        <div
          className={`space-y-6 lg:col-span-6 overflow-y-auto pr-1 max-h-[75vh] ${
            activeTab === 'preview' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* 1. Basics */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Basic Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={resume.basics.name}
                  onChange={(e) => updateBasics('name', e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={resume.basics.email}
                  onChange={(e) => updateBasics('email', e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Phone</label>
                <input
                  type="text"
                  value={resume.basics.phone || ''}
                  onChange={(e) => updateBasics('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Location</label>
                <input
                  type="text"
                  value={resume.basics.location || ''}
                  onChange={(e) => updateBasics('location', e.target.value)}
                  placeholder="City, State / Remote"
                  className="w-full text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Links */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Links (GitHub, LinkedIn, Portfolio)</span>
                <button
                  type="button"
                  onClick={addLink}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Link
                </button>
              </div>

              {resume.basics.links?.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => updateLink(idx, 'label', e.target.value)}
                    placeholder="Label"
                    className="w-24 text-xs p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) => updateLink(idx, 'url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 text-xs p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(idx)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Summary (Optional) */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Professional Summary (Optional)
              </h3>
              {resume.summary ? (
                <button
                  type="button"
                  onClick={() => setResume((prev) => ({ ...prev, summary: null }))}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  Omit Section
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setResume((prev) => ({ ...prev, summary: '' }))}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Summary
                </button>
              )}
            </div>
            {resume.summary !== null && resume.summary !== undefined && (
              <textarea
                value={resume.summary}
                onChange={(e) => setResume((prev) => ({ ...prev, summary: e.target.value }))}
                rows={3}
                placeholder="2-3 concise sentences tailored to the target role..."
                className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500 leading-relaxed"
              />
            )}
          </div>

          {/* 3. Skills */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Skill Groups ({resume.skills.length}/6)
              </h3>
              {resume.skills.length < 6 && (
                <button
                  type="button"
                  onClick={addSkillGroup}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Group
                </button>
              )}
            </div>

            {resume.skills.map((group, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={group.category}
                    onChange={(e) => updateSkillCategory(idx, e.target.value)}
                    placeholder="Category (e.g. Languages)"
                    className="w-48 text-xs font-semibold p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeSkillGroup(idx)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={group.items.join(', ')}
                  onChange={(e) => updateSkillItems(idx, e.target.value)}
                  placeholder="Python, FastAPI, TypeScript (comma-separated)"
                  className="w-full text-xs p-1.5 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>

          {/* 4. Experience */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Work Experience
              </h3>
              <button
                type="button"
                onClick={addExperience}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3 h-3" /> Add Experience
              </button>
            </div>

            {resume.experience.map((exp, expIdx) => (
              <div key={expIdx} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Entry #{expIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeExperience(expIdx)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={exp.role}
                    onChange={(e) => updateExperience(expIdx, 'role', e.target.value)}
                    placeholder="Role Title"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => updateExperience(expIdx, 'company', e.target.value)}
                    placeholder="Company Name"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={exp.location || ''}
                    onChange={(e) => updateExperience(expIdx, 'location', e.target.value)}
                    placeholder="Location (Optional)"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={exp.start}
                      onChange={(e) => updateExperience(expIdx, 'start', e.target.value)}
                      placeholder="Start"
                      className="w-1/2 text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-zinc-500">–</span>
                    <input
                      type="text"
                      value={exp.end}
                      onChange={(e) => updateExperience(expIdx, 'end', e.target.value)}
                      placeholder="End"
                      className="w-1/2 text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Bullets */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Bullets ({exp.bullets?.length || 0}/4)
                    </span>
                    {(exp.bullets?.length || 0) < 4 && (
                      <button
                        type="button"
                        onClick={() => addExpBullet(expIdx)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                      >
                        <Plus className="w-3 h-3" /> Add Bullet
                      </button>
                    )}
                  </div>

                  {exp.bullets?.map((bullet, bIdx) => {
                    const words = countWords(bullet);
                    const isWordCountAmber = words < 12 || words > 25;
                    const hasMetricPlaceholder = bullet.includes('[add metric]');

                    return (
                      <div key={bIdx} className="space-y-1">
                        <div className="flex items-start gap-2">
                          <textarea
                            value={bullet}
                            onChange={(e) => updateExpBullet(expIdx, bIdx, e.target.value)}
                            rows={2}
                            placeholder="Past-tense action verb + what + how + result..."
                            className={`flex-1 text-xs p-2 rounded-lg bg-zinc-900 text-white focus:outline-none leading-relaxed transition ${
                              hasMetricPlaceholder
                                ? 'border border-amber-500 ring-1 ring-amber-500/60'
                                : 'border border-zinc-800 focus:border-blue-500'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => removeExpBullet(expIdx, bIdx)}
                            className="text-zinc-500 hover:text-red-400 p-1.5 mt-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px] px-1">
                          <span
                            className={
                              isWordCountAmber
                                ? 'text-amber-400 font-medium'
                                : 'text-zinc-500'
                            }
                          >
                            {words} words (recommended: 12–25)
                          </span>
                          {hasMetricPlaceholder && (
                            <span className="text-amber-400 font-semibold">
                              Contains [add metric]
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 5. Projects */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Projects ({resume.projects.length}/4)
              </h3>
              {resume.projects.length < 4 && (
                <button
                  type="button"
                  onClick={addProject}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Project
                </button>
              )}
            </div>

            {resume.projects.map((proj, projIdx) => (
              <div key={projIdx} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Project #{projIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeProject(projIdx)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={proj.name}
                    onChange={(e) => updateProject(projIdx, 'name', e.target.value)}
                    placeholder="Project Name"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={proj.url || ''}
                    onChange={(e) => updateProject(projIdx, 'url', e.target.value)}
                    placeholder="Repo or Live URL"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Tech Stack</label>
                  <input
                    type="text"
                    value={proj.tech ? proj.tech.join(', ') : ''}
                    onChange={(e) =>
                      updateProject(
                        projIdx,
                        'tech',
                        e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="Python, FastAPI, Redis (comma-separated)"
                    className="w-full text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Bullets */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Bullets ({proj.bullets?.length || 0}/4)
                    </span>
                    {(proj.bullets?.length || 0) < 4 && (
                      <button
                        type="button"
                        onClick={() => addProjBullet(projIdx)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                      >
                        <Plus className="w-3 h-3" /> Add Bullet
                      </button>
                    )}
                  </div>

                  {proj.bullets?.map((bullet, bIdx) => {
                    const words = countWords(bullet);
                    const isWordCountAmber = words < 12 || words > 25;
                    const hasMetricPlaceholder = bullet.includes('[add metric]');

                    return (
                      <div key={bIdx} className="space-y-1">
                        <div className="flex items-start gap-2">
                          <textarea
                            value={bullet}
                            onChange={(e) => updateProjBullet(projIdx, bIdx, e.target.value)}
                            rows={2}
                            placeholder="Action + what + how + result..."
                            className={`flex-1 text-xs p-2 rounded-lg bg-zinc-900 text-white focus:outline-none leading-relaxed transition ${
                              hasMetricPlaceholder
                                ? 'border border-amber-500 ring-1 ring-amber-500/60'
                                : 'border border-zinc-800 focus:border-blue-500'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => removeProjBullet(projIdx, bIdx)}
                            className="text-zinc-500 hover:text-red-400 p-1.5 mt-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px] px-1">
                          <span
                            className={
                              isWordCountAmber
                                ? 'text-amber-400 font-medium'
                                : 'text-zinc-500'
                            }
                          >
                            {words} words (recommended: 12–25)
                          </span>
                          {hasMetricPlaceholder && (
                            <span className="text-amber-400 font-semibold">
                              Contains [add metric]
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 6. Education */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Education
              </h3>
              <button
                type="button"
                onClick={addEducation}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3 h-3" /> Add Education
              </button>
            </div>

            {resume.education.map((edu, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Degree #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeEducation(idx)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                    placeholder="Degree (e.g. B.Tech Computer Science)"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={edu.institution}
                    onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                    placeholder="Institution"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={edu.location || ''}
                    onChange={(e) => updateEducation(idx, 'location', e.target.value)}
                    placeholder="Location (Optional)"
                    className="text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={edu.start || ''}
                      onChange={(e) => updateEducation(idx, 'start', e.target.value)}
                      placeholder="Start (Optional)"
                      className="w-1/2 text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-zinc-500">–</span>
                    <input
                      type="text"
                      value={edu.end}
                      onChange={(e) => updateEducation(idx, 'end', e.target.value)}
                      placeholder="End (e.g. 2024)"
                      className="w-1/2 text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={edu.score || ''}
                      onChange={(e) => updateEducation(idx, 'score', e.target.value)}
                      placeholder="Score / GPA (e.g. 8.9 CGPA)"
                      className="w-full text-xs p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 7. Certifications */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Certifications
              </h3>
              <button
                type="button"
                onClick={addCert}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3 h-3" /> Add Certification
              </button>
            </div>

            {resume.certifications.map((cert, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cert}
                  onChange={(e) => updateCert(idx, e.target.value)}
                  placeholder="Certification Name – Issuer (Year)"
                  className="flex-1 text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeCert(idx)}
                  className="text-zinc-500 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Live PDF Preview */}
        <div
          className={`lg:col-span-6 flex flex-col rounded-xl bg-zinc-900/40 border border-zinc-800 overflow-hidden shadow-inner ${
            activeTab === 'edit' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {instance.error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-300 font-semibold">
                PDF Render Error
              </p>
              <p className="text-xs text-zinc-400 max-w-sm">
                {String(instance.error)}
              </p>
            </div>
          ) : activePdfUrl ? (
            <iframe
              src={`${activePdfUrl}#toolbar=0&navpanes=0`}
              title="Resume Preview"
              className="w-full h-full min-h-[620px] rounded-xl border-none bg-white"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-400">Rendering live PDF preview…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
