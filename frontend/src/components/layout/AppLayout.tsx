import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-vault-950 flex flex-col font-sans">
      <Navbar />




      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gradient-to-b from-vault-950 via-vault-900/40 to-vault-950">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
            </div>


        </main>
      </div>
    </div>
  );
};
