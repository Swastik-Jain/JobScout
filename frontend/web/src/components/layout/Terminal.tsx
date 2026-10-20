import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { useTerminal } from '../../contexts/TerminalContext';

export const Terminal: React.FC = () => {
  const { logs } = useTerminal();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-40 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex flex-col font-mono text-sm text-zinc-300">
      <div className="flex items-center px-6 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <TerminalIcon size={14} className="mr-3 text-zinc-500" />
        <span className="font-semibold tracking-wider text-zinc-400 text-xs">AGENT ACTIVITY TERMINAL</span>
        {logs.length > 0 && (
          <span className="ml-auto text-zinc-600 text-xs">{logs.length} entries</span>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-1 leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-zinc-600 animate-pulse text-xs">Waiting for agent activity...</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="flex text-xs">
              <span className="text-zinc-700 mr-2 shrink-0">›</span>
              <span
                className={
                  log.includes('[RepoAgent]') ? 'text-purple-400' :
                  log.includes('[ATSAgent]') ? 'text-blue-400' :
                  log.includes('[ApplyAgent]') ? 'text-cyan-400' :
                  log.includes('[JobAgent]') ? 'text-yellow-400' :
                  log.includes('❌') || log.includes('Error') ? 'text-red-400' :
                  log.includes('✅') || log.includes('complete') ? 'text-green-400' :
                  'text-zinc-400'
                }
              >
                {log}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
