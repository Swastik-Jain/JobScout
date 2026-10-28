import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  CheckCircle, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  FileText, 
  Layers, 
  HelpCircle, 
  AlertCircle,
  RotateCw,
  Edit3,
  Save
} from 'lucide-react';

import api, { resolveApiUrl } from '../lib/api';

interface ReviewModalProps {
  applicationId: number;
  job: {
    id?: number;
    title: string;
    company: string;
    url: string;
    location?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: (newStatus: string) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  applicationId,
  job,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'resume' | 'diff' | 'cover' | 'qa'>('resume');
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User editing state
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [editedResume, setEditedResume] = useState('');
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [editedCover, setEditedCover] = useState('');
  const [savingEdits, setSavingEdits] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get(`/applications/${applicationId}`);
      setDetails(res.data);
      const resResume = res.data.materials?.resume_md || res.data.base_resume_md || '';
      const resCover = res.data.materials?.cover_note || '';
      setEditedResume(resResume);
      setEditedCover(resCover);
      if (res.data.prep_status === 'preparing') {
        setPreparing(true);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdits = async (field: 'resume' | 'cover') => {
    try {
      setSavingEdits(true);
      setErrorMsg(null);
      const payload = field === 'resume' ? { resume_md: editedResume } : { cover_note: editedCover };
      await api.patch(`/applications/${applicationId}`, payload);
      if (field === 'resume') setIsEditingResume(false);
      if (field === 'cover') setIsEditingCover(false);
      await fetchDetails();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to save edits.');
    } finally {
      setSavingEdits(false);
    }
  };

  useEffect(() => {
    if (isOpen && applicationId) {
      fetchDetails();
    }
  }, [isOpen, applicationId]);

  // Poll while preparing
  useEffect(() => {
    let interval: any;
    if (preparing && isOpen) {
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/applications/${applicationId}/prepare/status`);
          if (res.data.prep_status === 'ready') {
            setPreparing(false);
            fetchDetails();
          } else if (res.data.prep_status === 'failed') {
            setPreparing(false);
            setErrorMsg(res.data.prep_error || 'Material preparation failed.');
          }
        } catch {
          setPreparing(false);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [preparing, isOpen, applicationId]);

  const handleTriggerPrepare = async (force: boolean = false) => {
    try {
      setPreparing(true);
      setErrorMsg(null);
      await api.post(`/applications/${applicationId}/prepare?force=${force}`);
    } catch (err: any) {
      setPreparing(false);
      setErrorMsg(err?.response?.data?.detail || 'Could not start preparation.');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleTransition = async (toStatus: string) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/applications/${applicationId}/transition`, {
        to_status: toStatus,
        note: toStatus === 'applied' ? 'Submitted application on external career portal.' : undefined,
      });
      onStatusUpdated(toStatus);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || `Cannot change status to ${toStatus}.`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const materials = details?.materials;
  const baseResume = details?.base_resume_md || '';
  const tailoredResume = materials?.resume_md || baseResume;
  const atsScore = materials?.ats_score ?? details?.job?.match_score ?? 70;
  const atsDetails = materials?.ats_details || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/40 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">{job.title}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                {details?.status || 'saved'}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">
              {job.company} {job.location ? `· ${job.location}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* ATS Score badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700/60">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs text-zinc-400 font-medium">ATS Score: </span>
                <span className="text-sm font-bold text-emerald-400">{Math.round(atsScore)}%</span>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800/60 flex items-center gap-2 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('resume')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
                activeTab === 'resume'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Tailored Resume
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
                activeTab === 'diff'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-4 h-4" /> Profile Diff
            </button>
            <button
              onClick={() => setActiveTab('cover')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
                activeTab === 'cover'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Cover Note
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
                activeTab === 'qa'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <HelpCircle className="w-4 h-4" /> Q&A Answers
            </button>
          </div>

          {/* Regeneration CTA */}
          <button
            onClick={() => handleTriggerPrepare(true)}
            disabled={preparing}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3 h-3 ${preparing ? 'animate-spin text-primary' : ''}`} />
            {preparing ? 'Tailoring…' : 'Regenerate'}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading || preparing ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-white font-medium">Tailoring Application Materials…</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Enforcing strict no-fabrication constraints against your ground-truth profile.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Tab 1: Tailored Resume */}
              {activeTab === 'resume' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 flex-wrap gap-2">
                    <div className="text-xs text-zinc-400">
                      Formula: <span className="text-zinc-300 font-mono">60% Keyword Match + 40% Semantic Alignment</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          if (isEditingResume) {
                            handleSaveEdits('resume');
                          } else {
                            setIsEditingResume(true);
                          }
                        }}
                        disabled={savingEdits}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                          isEditingResume
                            ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60 font-semibold'
                            : 'bg-zinc-900 border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        {isEditingResume ? <Save className="w-3.5 h-3.5 text-emerald-400" /> : <Edit3 className="w-3.5 h-3.5" />}
                        {isEditingResume ? (savingEdits ? 'Saving…' : 'Save Edits') : 'Edit Resume'}
                      </button>
                      {isEditingResume && (
                        <button
                          onClick={() => {
                            setIsEditingResume(false);
                            setEditedResume(tailoredResume);
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
                        >
                          Cancel
                        </button>
                      )}
                      <a
                        href={resolveApiUrl(`/applications/${applicationId}/export?format=docx`)}
                        download
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Export .DOCX
                      </a>
                      <a
                        href={resolveApiUrl(`/applications/${applicationId}/export?format=markdown`)}
                        download
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Export .MD
                      </a>
                      <button
                        onClick={() => handleCopy(editedResume || tailoredResume, 'resume')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                      >
                        {copiedSection === 'resume' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedSection === 'resume' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {atsDetails.matched_keywords && (
                    <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
                      <span className="text-xs font-semibold text-zinc-400">Matched ATS Keywords:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {atsDetails.matched_keywords.map((kw: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                            ✓ {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {isEditingResume ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-500">
                        Directly edit the markdown below. Changes will be saved as an updated version and update the ATS diff.
                      </div>
                      <textarea
                        value={editedResume}
                        onChange={e => setEditedResume(e.target.value)}
                        rows={16}
                        className="w-full p-4 bg-zinc-900/90 border border-primary/50 rounded-xl text-zinc-100 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary shadow-inner select-text"
                        placeholder="Edit markdown resume..."
                      />
                    </div>
                  ) : (
                    <pre className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-zinc-300 text-xs font-mono whitespace-pre-wrap leading-relaxed select-text">
                      {tailoredResume}
                    </pre>
                  )}
                </div>
              )}

              {/* Tab 2: Profile Diff */}
              {activeTab === 'diff' && (
                <div className="space-y-4">
                  <div className="text-xs text-zinc-400 p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                    Comparing your <span className="text-white font-medium">Deterministic Base Profile</span> against the <span className="text-primary font-medium">Job-Tailored Resume</span>. Only action verbs and bullet phrasing are tuned; all employers, degrees, and project identities remain identical.
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 mb-2">Base Profile Resume</h4>
                      <pre className="p-3 bg-zinc-900/30 border border-zinc-800 rounded-xl text-zinc-400 text-[11px] font-mono whitespace-pre-wrap h-96 overflow-y-auto">
                        {baseResume}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-primary mb-2">Tailored / Edited Version</h4>
                      <pre className="p-3 bg-zinc-900/30 border border-primary/20 rounded-xl text-zinc-200 text-[11px] font-mono whitespace-pre-wrap h-96 overflow-y-auto">
                        {editedResume || tailoredResume}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Cover Note */}
              {activeTab === 'cover' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 flex-wrap gap-2">
                    <p className="text-xs text-zinc-400">
                      Targeted 2-paragraph cover note tailored for {job.company}.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isEditingCover) {
                            handleSaveEdits('cover');
                          } else {
                            setIsEditingCover(true);
                          }
                        }}
                        disabled={savingEdits}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                          isEditingCover
                            ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60 font-semibold'
                            : 'bg-zinc-900 border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        {isEditingCover ? <Save className="w-3.5 h-3.5 text-emerald-400" /> : <Edit3 className="w-3.5 h-3.5" />}
                        {isEditingCover ? (savingEdits ? 'Saving…' : 'Save Note') : 'Edit Note'}
                      </button>
                      {isEditingCover && (
                        <button
                          onClick={() => {
                            setIsEditingCover(false);
                            setEditedCover(materials?.cover_note || '');
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(editedCover || materials?.cover_note || '', 'cover')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                      >
                        {copiedSection === 'cover' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedSection === 'cover' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {isEditingCover ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-500">
                        Edit your customized cover note before sending.
                      </div>
                      <textarea
                        value={editedCover}
                        onChange={e => setEditedCover(e.target.value)}
                        rows={8}
                        className="w-full p-4 bg-zinc-900/90 border border-primary/50 rounded-xl text-zinc-100 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary shadow-inner select-text"
                        placeholder="Edit cover note..."
                      />
                    </div>
                  ) : (
                    <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed select-text">
                      {materials?.cover_note || 'No cover note generated yet.'}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Q&A Drafts */}
              {activeTab === 'qa' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400">
                    Draft answers to common application form questions, synthesized strictly from your verified profile projects.
                  </p>
                  {(materials?.qa_drafts || []).map((qa: any, idx: number) => (
                    <div key={idx} className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary">{qa.question}</span>
                        <button
                          onClick={() => handleCopy(qa.answer, `qa-${idx}`)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                        >
                          {copiedSection === `qa-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed select-text">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer / Application Actions */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold flex items-center gap-2 transition"
            >
              <ExternalLink className="w-4 h-4 text-primary" /> Open Application Portal
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTransition('withdrawn')}
              disabled={actionLoading}
              className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              Not Applying
            </button>
            <button
              onClick={() => handleTransition('applied')}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-zinc-950 font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {actionLoading ? 'Saving…' : 'I Applied'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
