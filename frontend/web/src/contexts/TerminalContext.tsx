import React, { createContext, useContext, useState, useCallback } from 'react';

export type AgentStatus = 'idle' | 'scanning' | 'tailoring' | 'analyzing';

interface TerminalContextValue {
  logs: string[];
  pushLog: (log: string) => void;
  clearLogs: () => void;
  agentStatus: AgentStatus;
  setAgentStatus: (status: AgentStatus) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export const useTerminal = (): TerminalContextValue => {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminal must be used inside TerminalProvider');
  return ctx;
};

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  const pushLog = useCallback((log: string) => {
    setLogs((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === log) return prev;
      return [...prev, log];
    });

    // Auto-detect status from log content
    const lower = log.toLowerCase();
    if (lower.includes('scanning') || lower.includes('querying') || lower.includes('initializing ats')) {
      setAgentStatus('scanning');
    } else if (lower.includes('tailoring') || lower.includes('structuring') || lower.includes('generating resume')) {
      setAgentStatus('tailoring');
    } else if (lower.includes('analyzing') || lower.includes('evaluating')) {
      setAgentStatus('analyzing');
    } else if (
      lower.includes('loaded and ranked') ||
      lower.includes('complete') ||
      lower.includes('finished') ||
      lower.includes('error:')
    ) {
      setAgentStatus('idle');
    }
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <TerminalContext.Provider
      value={{
        logs,
        pushLog,
        clearLogs,
        agentStatus,
        setAgentStatus,
        isDrawerOpen,
        setIsDrawerOpen,
        toggleDrawer,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
};
