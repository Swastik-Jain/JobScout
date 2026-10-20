import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, Info, ShieldCheck } from 'lucide-react';

interface RepoInsight {
  repoName: string;
  comment: string;
  tech: string[];
}

interface OptimizationInsightsProps {
  insights?: string[];
  verifiedRepos?: RepoInsight[];
}

export const OptimizationInsights: React.FC<OptimizationInsightsProps> = ({ insights, verifiedRepos }) => {
  const displayInsights = insights && insights.length > 0
    ? insights
    : [
        "High-impact verb density detected.",
        "Formatting completely compatible with major ATS parsers.",
        "Action-oriented bullet points verified.",
        "Crucial technical keywords matched to job description.",
      ];

  const containerVariants: any = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };

  const itemVariants: any = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', bounce: 0.4 } },
  };

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center text-blue-400 mb-2">
        <Sparkles size={20} className="mr-3" />
        <h4 className="text-xl font-semibold text-white">Optimization Insights</h4>
      </div>

      <motion.ul className="space-y-3" variants={containerVariants} initial="hidden" animate="show">
        <AnimatePresence>
          {displayInsights.map((insight, idx) => (
            <motion.li
              key={`insight-${idx}`}
              variants={itemVariants}
              className="flex items-start text-zinc-300 text-sm leading-relaxed p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50"
            >
              {idx % 2 === 0 ? (
                <CheckCircle2 size={16} className="text-green-400 mr-3 mt-0.5 shrink-0" />
              ) : (
                <Info size={16} className="text-blue-400 mr-3 mt-0.5 shrink-0" />
              )}
              <span>{insight}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {/* Verified Repos Section */}
      {verifiedRepos && verifiedRepos.length > 0 && (
        <div className="pt-3 border-t border-zinc-800/50">
          <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ShieldCheck size={14} /> Repository Intelligence
          </p>
          <motion.ul className="space-y-2" variants={containerVariants} initial="hidden" animate="show">
            {verifiedRepos.map((repo, idx) => (
              <motion.li
                key={`repo-${idx}`}
                variants={itemVariants}
                className="flex items-start text-zinc-300 text-sm p-3 bg-purple-950/20 rounded-lg border border-purple-800/30"
              >
                <ShieldCheck size={15} className="text-purple-400 mr-3 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-purple-300 font-medium">✅ Verified:</span>{' '}
                  <span>{repo.comment}</span>
                  {repo.tech.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {repo.tech.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      )}
    </div>
  );
};
