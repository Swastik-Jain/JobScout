import React from 'react';
import { motion } from 'framer-motion';

interface OptimizationGaugeProps {
  score: number;
}

export const OptimizationGauge: React.FC<OptimizationGaugeProps> = ({ score }) => {
  // We mock sub-metrics based on the reference instruction, scaling them slightly by score if we wanted to true sync,
  // but to match the reference we'll display the values conceptually requested, maybe pivoting around the ATS score.
  // We use specific values 98, 89, 95 or a percentage of the actual score to simulate the reference.
  const keywordsScore = Math.min(100, Math.floor(score * 1.04));
  const structureScore = Math.max(0, Math.floor(score * 0.95));
  const parsingScore = Math.min(100, Math.floor(score * 1.01));

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
          <span className="text-white text-xl font-semibold">{keywordsScore}%</span>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 flex flex-col items-center justify-center">
          <span className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase mb-1">Structure</span>
          <span className="text-white text-xl font-semibold">{structureScore}%</span>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 flex flex-col items-center justify-center">
          <span className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase mb-1">Parsing</span>
          <span className="text-white text-xl font-semibold">{parsingScore}%</span>
        </div>
      </div>
    </div>
  );
};
