import React from 'react';
import { SystemDBModule } from '../components/admin/SystemDBModule.tsx';

export const AdminKVPage: React.FC = () => {
    return (
        <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            <header>
                <h1 className="text-3xl font-black tracking-tight text-white mb-2">System Database (KV)</h1>
                <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold opacity-50">Storage Explorer & Logs</p>
            </header>
            <SystemDBModule />
        </div>
    );
};
