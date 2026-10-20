import React, { createContext, useContext, useState, useCallback } from 'react';

interface TerminalContextValue {
  logs: string[];
  pushLog: (log: string) => void;
  clearLogs: () => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export const useTerminal = (): TerminalContextValue => {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminal must be used inside TerminalProvider');
  return ctx;
};

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<string[]>([]);

  const pushLog = useCallback((log: string) => {
    setLogs(prev => [...prev, log]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <TerminalContext.Provider value={{ logs, pushLog, clearLogs }}>
      {children}
    </TerminalContext.Provider>
  );
};
