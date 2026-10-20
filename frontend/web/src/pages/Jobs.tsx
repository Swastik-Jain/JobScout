import React, { useEffect, useState } from 'react';
import { Building2, ExternalLink, MapPin, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';

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

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await api.get('/fetch-jobs');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
     if (score >= 85) return 'text-green-400 bg-green-400/10 border-green-400/20';
     if (score >= 70) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
     return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Market Intelligence</h2>
          <p className="text-zinc-400">AI-Ranked opportunities matching your optimized profile.</p>
        </div>
        <button onClick={fetchJobs} className="text-zinc-300 hover:text-white glass px-4 py-2 rounded-lg text-sm flex items-center transition-colors">
          <Sparkles size={16} className="mr-2 text-blue-400" /> Refresh Scan
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col flex-1 items-center justify-center p-20">
          <Loader2 className="animate-spin text-zinc-500 mb-4" size={32} />
          <span className="text-zinc-400 animate-pulse font-mono text-sm">JobAgent is scanning LinkedIn, Indeed, etc...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobs.map((job, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={job.id || idx}
              className="glass p-6 rounded-xl relative overflow-hidden group glass-hover"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 text-zinc-400 text-base font-medium">
                  <span className={`px-3 py-1.5 rounded-lg border ${getScoreColor(job.match_score || 0)} text-sm items-center flex`}>
                    {job.match_score || 0}% Match
                  </span>
                  <span className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 text-sm">
                    {job.platform}
                  </span>
                </div>
                <a href={job.url || job.link} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors p-1">
                  <ExternalLink size={20} />
                </a>
              </div>
              
              <h3 className="text-2xl font-semibold text-white mb-3 group-hover:text-blue-400 transition-colors">{job.title}</h3>
              
              <div className="space-y-3 mb-5">
                <div className="flex items-center text-zinc-400 text-base">
                  <Building2 size={18} className="mr-3" />
                  {job.company}
                </div>
                <div className="flex items-center text-zinc-500 text-base">
                  <MapPin size={18} className="mr-3" />
                  {job.location}
                </div>
              </div>
              
              <p className="text-zinc-400 text-base line-clamp-3 leading-relaxed mb-4">
                {job.description}
              </p>
              
              {job.justification && (
                <div className="mb-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-200">
                  <Sparkles size={14} className="inline mr-2 text-blue-400" />
                  {job.justification}
                </div>
              )}
              
              {job.key_requirements && job.key_requirements.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {job.key_requirements.map((req, i) => (
                    <span key={i} className="text-xs font-mono px-2 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {req}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
          {jobs.length === 0 && <div className="text-zinc-500 col-span-2 text-center p-10 font-mono">No opportunities found in the current region.</div>}
        </div>
      )}
    </div>
  );
};
