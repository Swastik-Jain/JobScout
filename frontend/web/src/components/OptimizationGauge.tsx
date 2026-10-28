import React from 'react';
import { motion } from 'framer-motion';

interface OptimizationGaugeProps {
  score: number;
  keywordScore?: number;
  structureScore?: number;
  parsingScore?: number;
}

export const OptimizationGauge: React.FC<OptimizationGaugeProps> = ({ 
  score, 
  keywordScore, 
  structureScore, 
  parsingScore 
}) => {
  // Use verified sub-metrics if provided by the ATS breakdown, or default to the validated base score
  const keywordsVal = keywordScore !== undefined ? Math.min(100, Math.max(0, keywordScore)) : score;
  const structureVal = structureScore !== undefined ? Math.min(100, Math.max(0, structureScore)) : score;
  const parsingVal = parsingScore !== undefined ? Math.min(100, Math.max(0, parsingScore)) : score;

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="glass rounded-xl p-8 flex flex-col items-center w-full">
      {/* Centered Minimalist Progress Ring */}
      <div className="relative w-56 h-56 flex justify-center items-center mb-8">
        <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
          {/* Background Ring */}
          <circle 
            cx="112" cy="112" r={radius} 
            className="stroke-zinc-800" 
            strokeWidth="8" 
            fill="transparent" 
          />
          {/* Animated Progress Ring */}
          <motion.circle
            cx="112" cy="112" r={radius}
            className="stroke-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]"
            strokeWidth="8" 
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Text */}
        <div className="flex flex-col items-center justify-center absolute inset-0 z-10">
          <motion.span 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-6xl font-bold text-white tracking-tighter"
          >
            {score}
          </motion.span>
          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mt-1">
            Score Rating
          </span>
        </div>
      </div>

      {/* Sub-Metrics: 3 Light-Grey Boxes */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 flex flex-col items-center justify-center">
          <span className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase mb-1">Keywords</span>
          <span className="text-white text-xl font-semibold">{keywordsVal}%</span>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 flex flex-col items-center justify-center">
          <span className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase mb-1">Structure</span>
          <span className="text-white text-xl font-semibold">{structureVal}%</span>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 flex flex-col items-center justify-center">
          <span className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase mb-1">Parsing</span>
          <span className="text-white text-xl font-semibold">{parsingVal}%</span>
        </div>
      </div>
    </div>
  );
};
