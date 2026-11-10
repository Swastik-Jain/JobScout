import React, { useEffect, useState, useMemo } from 'react';
import { Building2, ExternalLink, MapPin, Loader2, Sparkles, FileText, ArrowRight, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { ReviewModal } from '../components/ReviewModal';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  description: string;
  platform: string;
  url?: string;
  link?: string;
  match_score?: number;
  justification?: string;
  key_requirements?: string[];
}

export const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeAppId, setActiveAppId] = useState<number | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [preparingId, setPreparingId] = useState<number | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'all' | 'india' | 'remote'>('all');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/fetch-jobs');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrepare = async (job: Job) => {
    setSelectedJob(job);
    setPreparingId(job.id);
    try {
      const saveRes = await api.post('/applications', { job_id: job.id });
      const appId = saveRes.data.id;
      setActiveAppId(appId);
      await api.post(`/applications/${appId}/prepare`);
      setIsReviewOpen(true);
    } catch (err) {
      console.error('Failed to prepare application:', err);
    } finally {
      setPreparingId(null);
    }
  };

  const getScoreColor = (score: number) => {
     if (score >= 85) return 'text-green-400 bg-green-400/10 border-green-400/20';
     if (score >= 70) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
     return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || job.title.toLowerCase().includes(q) || job.company.toLowerCase().includes(q);
      const loc = (job.location || '').toLowerCase();
      const isIndia = loc.includes('india') || loc.includes('bengaluru') || loc.includes('bangalore') || loc.includes('hyderabad') || loc.includes('pune') || loc.includes('mumbai') || loc.includes('delhi') || loc.includes('noida') || loc.includes('gurgaon');
      const isRemote = loc.includes('remote') || loc.includes('worldwide') || loc.includes('global');

      const matchesLoc =
        locationFilter === 'all'
          ? true
          : locationFilter === 'india'
          ? isIndia || (isRemote && !loc.includes('poland') && !loc.includes('spain') && !loc.includes('canada') && !loc.includes('us') && !loc.includes('usa'))
          : isRemote;

      return matchesQuery && matchesLoc;
    });
  }, [jobs, searchQuery, locationFilter]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Market Intelligence</h2>
          <p className="text-zinc-400 text-sm">AI-Ranked opportunities matching your verified profile.</p>
        </div>
        <button
          onClick={fetchJobs}
          disabled={loading}
          className="text-zinc-300 hover:text-white glass px-4 py-2 rounded-lg text-sm flex items-center transition-colors disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <Sparkles size={15} className={`mr-2 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning...' : 'Refresh Scan'}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between glass p-3 rounded-xl border border-zinc-800">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by role or company..."
            className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Filter size={13} className="text-zinc-500 mr-1 hidden sm:block" />
          {(['all', 'india', 'remote'] as const).map(loc => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer capitalize ${
                locationFilter === loc
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              {loc === 'all' ? 'All Roles' : loc === 'india' ? 'India / Remote' : 'Global Remote'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col flex-1 items-center justify-center p-20">
          <Loader2 className="animate-spin text-zinc-500 mb-4" size={32} />
          <span className="text-zinc-400 animate-pulse font-mono text-sm">JobScout is scanning live job portals...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredJobs.map((job, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              key={job.id || idx}
              className="glass p-6 rounded-xl relative overflow-hidden group glass-hover flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2.5 text-zinc-400 text-sm font-medium">
                    <span className={`px-2.5 py-1 rounded-lg border ${getScoreColor(job.match_score || 0)} text-xs items-center flex`}>
                      {job.match_score || 0}% Match
                    </span>
                    <span className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800/50 text-xs">
                      {job.platform}
                    </span>
                  </div>
                  <a href={job.url || job.link} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors p-1" title="Open Job Portal">
                    <ExternalLink size={18} />
                  </a>
                </div>
                
                <h3 className="text-xl font-semibold text-white mb-2.5 group-hover:text-blue-400 transition-colors">{job.title}</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-zinc-400 text-sm">
                    <Building2 size={16} className="mr-2.5 text-zinc-500" />
                    {job.company}
                  </div>
                  <div className="flex items-center text-zinc-400 text-sm">
                    <MapPin size={16} className="mr-2.5 text-zinc-500" />
                    {job.location}
                  </div>
                </div>
                
                <p className="text-zinc-400 text-sm line-clamp-3 leading-relaxed mb-4">
                  {job.description}
                </p>
                
                {job.justification && (
                  <div className="mb-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-xs text-blue-200">
                    <Sparkles size={13} className="inline mr-1.5 text-blue-400" />
                    {job.justification}
                  </div>
                )}
                
                {job.key_requirements && job.key_requirements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {job.key_requirements.map((req, i) => (
                      <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {req}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <button
                  onClick={() => handlePrepare(job)}
                  disabled={preparingId === job.id}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                    selectedJob?.id === job.id
                      ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-900/20'
                      : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-300 hover:text-white'
                  } disabled:opacity-50`}
                >
                  {preparingId === job.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <FileText size={13} />
                  )}
                  {preparingId === job.id ? 'Preparing...' : 'Prepare & Apply'}
                  <ArrowRight size={13} />
                </button>

                <a
                  href={job.url || job.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1"
                >
                  Direct Link <ExternalLink size={12} />
                </a>
              </div>
            </motion.div>
          ))}
          {filteredJobs.length === 0 && (
            <div className="text-zinc-500 col-span-2 text-center p-12 font-mono text-sm glass rounded-xl border border-zinc-800">
              No opportunities match the selected criteria.
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {selectedJob && activeAppId !== null && (
        <ReviewModal
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          applicationId={activeAppId}
          job={{
            id: selectedJob.id,
            title: selectedJob.title,
            company: selectedJob.company,
            url: selectedJob.url || selectedJob.link || '',
            location: selectedJob.location,
          }}
          onStatusUpdated={() => {
            // Optional callback
          }}
        />
      )}
    </div>
  );
};
