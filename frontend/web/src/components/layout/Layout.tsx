import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ActivityDrawer } from './ActivityDrawer';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-zinc-800">
      <Navbar />
      <div className="flex-1 flex flex-col relative">
        {/* Subtle ambient lighting */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-blue-600/5 blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 rounded-full bg-indigo-600/5 blur-[140px] pointer-events-none" />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
      <ActivityDrawer />
    </div>
  );
};
