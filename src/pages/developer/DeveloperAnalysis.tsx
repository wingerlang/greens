
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AlertTriangle, Copy, Check, FileWarning, Settings, Sliders, Layers, Search, GitMerge } from 'lucide-react';

interface CodeIssue {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    file: string;
    relatedFile?: string;
    details?: string;
}

interface DuplicateFunction {
    nameA: string;
    nameB: string;
    fileA: string;
    fileB: string;
    similarity: number;
}

interface SimilarFilePair {
    fileA: string;
    fileB: string;
    similarity: number;
    sharedTerms: string[];
}

export function DeveloperAnalysis() {
    const { token } = useAuth();
    const [issues, setIssues] = useState<CodeIssue[]>([]);
    const [duplicates, setDuplicates] = useState<DuplicateFunction[]>([]);
    const [clusters, setClusters] = useState<SimilarFilePair[]>([]);
    const [report, setReport] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'issues' | 'duplicates' | 'clusters'>('issues');
    const [maxLines, setMaxLines] = useState<number>(300);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        const savedMaxLines = localStorage.getItem('dev_tools_max_lines');
        if (savedMaxLines) setMaxLines(parseInt(savedMaxLines, 10));
    }, []);

    const handleMaxLinesChange = (val: string) => {
        const num = parseInt(val, 10);
        if (!isNaN(num)) {
            setMaxLines(num);
            localStorage.setItem('dev_tools_max_lines', num.toString());
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetch('/api/developer/analysis', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/developer/functions', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/developer/similarity', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/developer/report', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json())
        ])
        .then(([analysisData, funcsData, simData, reportData]) => {
            setIssues(analysisData.issues || []);
            setDuplicates(funcsData.duplicates || []);
            setClusters(simData.clusters || []);
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

    const filteredIssues = issues.filter(issue => {
        if (issue.type === 'large_file') {
            const match = issue.message.match(/(\d+) lines/);
            if (match) {
                const lines = parseInt(match[1], 10);
                return lines > maxLines;
            }
        }
        return true;
    });

    return (
        <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
            {/* Header / Settings Bar */}
            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center gap-6">
                     <div className="flex items-center gap-2 text-white font-semibold mr-4">
                        <FileWarning className="text-amber-400" />
                        <span>Analysis</span>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2">
                        <TabButton
                            active={activeTab === 'issues'}
                            onClick={() => setActiveTab('issues')}
                            icon={<AlertTriangle size={14} />}
                            label="Issues"
                            count={filteredIssues.length}
                        />
                         <TabButton
                            active={activeTab === 'duplicates'}
                            onClick={() => setActiveTab('duplicates')}
                            icon={<GitMerge size={14} />}
                            label="Function Duplicates"
                            count={duplicates.length}
                        />
                         <TabButton
                            active={activeTab === 'clusters'}
                            onClick={() => setActiveTab('clusters')}
                            icon={<Layers size={14} />}
                            label="Code Similarity"
                            count={clusters.length}
                        />
                    </div>
                </div>

                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${showSettings ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    <Settings size={14} />
                    Settings
                </button>
            </div>

            {showSettings && (
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <Sliders size={14} />
                        Configuration
                    </h3>
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-slate-400">
                            Max Lines per File:
                        </label>
                        <input
                            type="number"
                            value={maxLines}
                            onChange={(e) => handleMaxLinesChange(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white w-24 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-500 italic">
                            Files larger than this will be flagged.
                        </span>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-auto">
                {activeTab === 'issues' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        <IssuesList issues={filteredIssues} />
                        <AgentReport report={report} onCopy={handleCopy} copied={copied} />
                    </div>
                )}

                {activeTab === 'duplicates' && <DuplicatesList duplicates={duplicates} />}

                {activeTab === 'clusters' && <ClustersList clusters={clusters} />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count: number }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                active
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
        >
            {icon}
            {label}
            {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-400/30 text-indigo-100' : 'bg-slate-700 text-slate-300'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function IssuesList({ issues }: { issues: CodeIssue[] }) {
    const highSeverity = issues.filter(i => i.severity === 'high');
    const mediumSeverity = issues.filter(i => i.severity === 'medium');

    return (
        <div className="space-y-6 overflow-auto pr-2">
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
    );
}

function DuplicatesList({ duplicates }: { duplicates: DuplicateFunction[] }) {
    if (duplicates.length === 0) {
        return <div className="p-8 text-center text-slate-500 italic">No similar functions found.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {duplicates.map((d, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                        <div className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded font-mono">
                            {(d.similarity * 100).toFixed(0)}% Match
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <div className="font-mono text-sm text-white font-semibold truncate" title={d.nameA}>{d.nameA}</div>
                            <div className="text-xs text-slate-500 truncate" title={d.fileA}>{d.fileA}</div>
                        </div>
                        <div className="flex justify-center text-slate-600"><GitMerge size={16} className="rotate-90" /></div>
                        <div>
                            <div className="font-mono text-sm text-white font-semibold truncate" title={d.nameB}>{d.nameB}</div>
                            <div className="text-xs text-slate-500 truncate" title={d.fileB}>{d.fileB}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ClustersList({ clusters }: { clusters: SimilarFilePair[] }) {
    if (clusters.length === 0) {
         return <div className="p-8 text-center text-slate-500 italic">No file clusters found.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clusters.map((c, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-slate-300 font-medium text-sm">Semantic Similarity</h4>
                        <span className="text-emerald-400 text-xs font-mono">{(c.similarity * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex flex-col gap-2 mb-3">
                        <div className="bg-slate-900 px-3 py-2 rounded border border-slate-700 text-xs font-mono text-slate-400 truncate">
                            {c.fileA}
                        </div>
                        <div className="bg-slate-900 px-3 py-2 rounded border border-slate-700 text-xs font-mono text-slate-400 truncate">
                            {c.fileB}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {c.sharedTerms.map(term => (
                            <span key={term} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                                {term}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function AgentReport({ report, onCopy, copied }: { report: string, onCopy: () => void, copied: boolean }) {
    return (
        <div className="flex flex-col h-full bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
                <span className="font-mono text-sm text-slate-400">agent_report.md</span>
                <button
                    onClick={onCopy}
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
