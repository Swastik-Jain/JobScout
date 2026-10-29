import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useTerminal } from '../../contexts/TerminalContext';

export const Terminal: React.FC = () => {
  const { logs, clearLogs } = useTerminal();
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log when open
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <div className="border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md flex flex-col font-mono text-sm text-zinc-300 transition-all duration-300 ease-in-out">
      {/* ── Status Bar / Toggle Header ── */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2">
          <TerminalIcon size={13} className="text-zinc-500" />
          <span className="font-semibold tracking-wider text-zinc-400 text-xs">AGENT TERMINAL</span>
        </div>

        {/* Status chip */}
        <div className="ml-4 flex items-center gap-2 max-w-[500px] overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${logs.length > 0 ? 'bg-emerald-400' : 'bg-zinc-600'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${logs.length > 0 ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
          </span>
          <span className="text-xs text-zinc-500 font-sans">
            {logs.length > 0 ? (
              <span className="text-zinc-400 truncate">
                {isOpen ? `${logs.length} events logged` : latestLog}
              </span>
            ) : (
              'Standby'
            )}
          </span>
        </div>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-2">
          {logs.length > 0 && isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearLogs();
              }}
              title="Clear logs"
              className="p-1 hover:text-red-400 text-zinc-500 transition rounded"
            >
              <Trash2 size={12} />
            </button>
          )}
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 font-sans">
            {logs.length}
          </span>
          <button 
            type="button"
            className="p-1 text-zinc-400 hover:text-zinc-200 transition"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* ── Collapsible Body ── */}
      {isOpen && (
        <div ref={scrollRef} className="h-44 p-3 overflow-y-auto space-y-1 leading-relaxed bg-black/40">
          {logs.length === 0 ? (
            <div className="text-zinc-600 text-xs py-2">Waiting for agent activity...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex text-xs">
                <span className="text-zinc-700 mr-2 shrink-0">›</span>
                <span
                  className={
                    log.includes('[RepoAgent]') ? 'text-purple-400' :
                    log.includes('[ATSAgent]') ? 'text-blue-400' :
                    log.includes('[ApplyAgent]') ? 'text-cyan-400' :
                    log.includes('[JobFinderAgent]') || log.includes('[JobScout]') ? 'text-yellow-400' :
                    log.toLowerCase().includes('error') || log.toLowerCase().includes('failed') ? 'text-red-400' :
                    log.toLowerCase().includes('complete') || log.toLowerCase().includes('loaded and ranked') ? 'text-green-400' :
                    'text-zinc-400'
                  }
                >
                  {log}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
