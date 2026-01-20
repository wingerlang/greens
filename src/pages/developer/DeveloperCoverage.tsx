import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface CoverageRow {
    file: string;
    branch: string;
    line: string;
}

interface CoverageData {
    total: { branch: string; line: string };
    files: CoverageRow[];
    raw: string;
}

export function DeveloperCoverage() {
    const { token } = useAuth();
    const [data, setData] = useState<CoverageData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runCoverage = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/developer/coverage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to run coverage');
            setData(json);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const getCoverageColor = (percentStr: string) => {
        const p = parseFloat(percentStr);
        if (p >= 80) return 'text-emerald-400';
        if (p >= 50) return 'text-amber-400';
        return 'text-rose-400';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Code Coverage</h1>
                    <p className="text-slate-400">Run test suite and analyze coverage for src/utils and src/features.</p>
                </div>
                <button
                    onClick={runCoverage}
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <span className="animate-spin">⏳</span> Running Tests...
                        </>
                    ) : (
                        <>
                            <span>🚀</span> Run Analysis
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 whitespace-pre-wrap">
                    {error}
                </div>
            )}

            {data && (
                <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex gap-8">
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Total Line Coverage</div>
                            <div className={`text-4xl font-black ${getCoverageColor(data.total.line)}`}>
                                {data.total.line}%
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Total Branch Coverage</div>
                            <div className={`text-4xl font-black ${getCoverageColor(data.total.branch)}`}>
                                {data.total.branch}%
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900/50 text-slate-400 uppercase tracking-wider font-mono text-xs">
                                <tr>
                                    <th className="p-4">File</th>
                                    <th className="p-4 text-right">Line %</th>
                                    <th className="p-4 text-right">Branch %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {data.files.map((row) => (
                                    <tr key={row.file} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="p-4 font-mono text-slate-300">{row.file}</td>
                                        <td className={`p-4 text-right font-bold ${getCoverageColor(row.line)}`}>
                                            {row.line}%
                                        </td>
                                        <td className={`p-4 text-right font-bold ${getCoverageColor(row.branch)}`}>
                                            {row.branch}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
