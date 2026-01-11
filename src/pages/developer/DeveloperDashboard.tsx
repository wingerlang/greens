
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface ProjectStats {
    totalFiles: number;
    totalLines: number;
    filesByExtension: Record<string, number>;
    linesByExtension: Record<string, number>;
}

export function DeveloperDashboard() {
    const { token } = useAuth();
    const [stats, setStats] = useState<ProjectStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/developer/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setStats(data.stats))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="p-8 text-slate-400 animate-pulse">Scanning codebase...</div>;
    if (!stats) return <div className="p-8 text-red-400">Failed to load stats.</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Project Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Files" value={stats.totalFiles} />
                <StatCard title="Total Lines of Code" value={stats.totalLines.toLocaleString()} />
                <StatCard title="TypeScript Files" value={stats.filesByExtension['ts'] || 0} />
                <StatCard title="React Components" value={stats.filesByExtension['tsx'] || 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-emerald-400">Lines by Language</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.linesByExtension)
                            .sort(([,a], [,b]) => b - a)
                            .map(([ext, lines]) => (
                            <div key={ext} className="flex items-center justify-between">
                                <span className="text-slate-300 font-mono uppercase">.{ext}</span>
                                <div className="flex items-center gap-4">
                                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500"
                                            style={{ width: `${(lines / stats.totalLines) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-slate-400 text-sm w-16 text-right">{lines.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                 <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-blue-400">Files by Type</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.filesByExtension)
                            .sort(([,a], [,b]) => b - a)
                            .map(([ext, count]) => (
                            <div key={ext} className="flex items-center justify-between">
                                <span className="text-slate-300 font-mono uppercase">.{ext}</span>
                                <span className="text-slate-400 font-mono">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value }: { title: string, value: number | string }) {
    return (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
            <p className="text-3xl font-mono text-white mt-2">{value}</p>
        </div>
    );
}
