import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal as TerminalIcon, X, Trash2, ShieldCheck, Zap } from 'lucide-react';
import { useTerminal } from '../../contexts/TerminalContext';

export const ActivityDrawer: React.FC = () => {
  const { logs, clearLogs, agentStatus, isDrawerOpen, setIsDrawerOpen } = useTerminal();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive while drawer is open
  useEffect(() => {
    if (isDrawerOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isDrawerOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, setIsDrawerOpen]);

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
          />

          {/* Sliding Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-zinc-950/95 border-l border-zinc-800 backdrop-blur-xl z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-black/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <TerminalIcon size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Agent Activity Log</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      {agentStatus !== 'idle' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          agentStatus !== 'idle' ? 'bg-blue-400' : 'bg-emerald-500'
                        }`}
                      />
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 capitalize">
                      {agentStatus === 'idle' ? 'Standby' : agentStatus}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-[11px] text-zinc-500 font-mono">{logs.length} events</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {logs.length > 0 && (
                  <button
                    onClick={clearLogs}
                    title="Clear logs"
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded-lg transition"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  title="Close activity log"
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Log Stream */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs leading-relaxed bg-black/30"
            >
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
                    <Zap size={18} />
                  </div>
                  <p className="text-zinc-400 font-medium text-xs">No active agent tasks</p>
                  <p className="text-zinc-600 text-[11px] mt-1 max-w-xs">
                    Discovery, matching, and resume tailoring actions will appear here in real time.
                  </p>
                </div>
              ) : (
                logs.map((log, idx) => {
                  const isError =
                    log.toLowerCase().includes('error') || log.toLowerCase().includes('failed');
                  const isSuccess =
                    log.toLowerCase().includes('loaded and ranked') ||
                    log.toLowerCase().includes('complete') ||
                    log.toLowerCase().includes('ready');
                  const isATS = log.includes('[ATSAgent]') || log.includes('[JobScout]');
                  const isApply = log.includes('[ApplyAgent]');
                  const isRepo = log.includes('[RepoAgent]');

                  const colorClass = isError
                    ? 'text-red-400'
                    : isSuccess
                    ? 'text-emerald-400'
                    : isATS
                    ? 'text-blue-400'
                    : isApply
                    ? 'text-cyan-400'
                    : isRepo
                    ? 'text-purple-400'
                    : 'text-zinc-300';

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 py-0.5 border-b border-zinc-900/60"
                    >
                      <span className="text-zinc-600 select-none shrink-0 mt-0.5">›</span>
                      <span className={`${colorClass} break-all`}>{log}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-zinc-800/80 bg-black/50 flex items-center justify-between text-[11px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Human-in-the-loop · Zero auto-submissions</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-600">v2.0</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
