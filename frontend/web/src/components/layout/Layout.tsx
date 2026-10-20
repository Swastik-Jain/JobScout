import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Terminal } from './Terminal';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-zinc-800">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full relative">
        {/* Background glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-800/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-800/10 blur-[120px] pointer-events-none" />
        
        <main className="flex-1 overflow-y-auto p-7 relative z-10">
          <Outlet />
        </main>
        
        <div className="w-full relative z-20">
          <Terminal />
        </div>
      </div>
    </div>
  );
};
