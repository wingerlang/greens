
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AlertTriangle, Copy, Check, FileWarning } from 'lucide-react';

interface CodeIssue {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    file: string;
    relatedFile?: string;
    details?: string;
}

export function DeveloperAnalysis() {
    const { token } = useAuth();
    const [issues, setIssues] = useState<CodeIssue[]>([]);
    const [report, setReport] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/developer/analysis', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/developer/report', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json())
        ])
        .then(([analysisData, reportData]) => {
            setIssues(analysisData.issues || []);
            setReport(reportData.report || '');
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [token]);

    const handleCopy = () => {
        navigator.clipboard.writeText(report);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <div className="p-8 text-slate-400 animate-pulse">Running heuristic analysis...</div>;

    const highSeverity = issues.filter(i => i.severity === 'high');
    const mediumSeverity = issues.filter(i => i.severity === 'medium');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
            {/* Left: Issues List */}
            <div className="space-y-6 overflow-auto pr-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileWarning className="text-amber-400" />
                    Detected Issues
                </h2>

                {issues.length === 0 && (
                    <div className="p-4 bg-emerald-900/20 border border-emerald-800 rounded-lg text-emerald-400">
                        No major issues detected! Good job.
                    </div>
                )}

                {highSeverity.length > 0 && (
                     <div className="space-y-4">
                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Critical ({highSeverity.length})</h3>
                        {highSeverity.map((issue, i) => <IssueCard key={i} issue={issue} />)}
                    </div>
                )}

                {mediumSeverity.length > 0 && (
                     <div className="space-y-4">
                        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Warnings ({mediumSeverity.length})</h3>
                        {mediumSeverity.map((issue, i) => <IssueCard key={i} issue={issue} />)}
                    </div>
                )}
            </div>

            {/* Right: Agent Report */}
            <div className="flex flex-col h-full bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
                    <span className="font-mono text-sm text-slate-400">agent_report.md</span>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'COPIED' : 'COPY FOR AGENT'}
                    </button>
                </div>
                <textarea
                    readOnly
                    className="flex-1 w-full bg-slate-950 p-4 text-slate-300 font-mono text-sm resize-none focus:outline-none"
                    value={report}
                />
            </div>
        </div>
    );
}

function IssueCard({ issue }: { issue: CodeIssue }) {
    const color = issue.severity === 'high' ? 'border-red-500/50 bg-red-500/10' : 'border-amber-500/50 bg-amber-500/10';

    return (
        <div className={`p-4 rounded-lg border ${color}`}>
            <div className="flex items-start gap-3">
                <AlertTriangle size={18} className={issue.severity === 'high' ? 'text-red-400' : 'text-amber-400'} />
                <div>
                    <h4 className="font-semibold text-slate-200">{issue.message}</h4>
                    <p className="text-xs font-mono text-slate-400 mt-1">{issue.file}</p>
                    {issue.relatedFile && (
                         <p className="text-xs font-mono text-slate-500 mt-1">↳ {issue.relatedFile}</p>
                    )}
                    {issue.details && (
                        <p className="text-sm text-slate-400 mt-2 italic">"{issue.details}"</p>
                    )}
                </div>
            </div>
        </div>
    );
}
