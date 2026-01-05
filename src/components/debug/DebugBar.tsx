import React, { useState, useEffect } from 'react';
import { useDebugInterceptor, RequestSummary, DebugProfile } from '../../hooks/useDebugInterceptor';
import { X, Database, Clock, Activity, List, ChevronRight, ChevronDown, Monitor, Cpu } from 'lucide-react';

export default function DebugBar() {
    // Only show in dev mode
    if (!import.meta.env.DEV) return null;

    const { requests, latestId } = useDebugInterceptor();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [profile, setProfile] = useState<DebugProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'db' | 'memory'>('overview');

    // Auto-select latest if nothing selected? No, that might be annoying.

    useEffect(() => {
        if (selectedId) {
            fetchDebugProfile(selectedId);
        }
    }, [selectedId]);

    const fetchDebugProfile = async (id: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/debug/${id}`);
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!requests.length) return null;

    const currentRequest = requests[0];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] font-mono text-xs">
            {/* Main Bar */}
            <div
                className="bg-slate-900 text-slate-300 border-t border-slate-700 h-10 flex items-center px-4 justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold">LARAVEL INSPIRED</span>
                    </div>
                    {currentRequest && (
                        <div className="flex items-center gap-3 border-l border-slate-700 pl-4">
                            <span className={`font-bold ${getMethodColor(currentRequest.method)}`}>{currentRequest.method}</span>
                            <span className="opacity-80 truncate max-w-[300px]">{currentRequest.url}</span>
                            <span className={`px-1.5 rounded ${getStatusColor(currentRequest.status)} text-slate-900 font-bold`}>
                                {currentRequest.status}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                     <span className="opacity-60">{requests.length} requests</span>
                     {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </div>

            {/* Expanded Panel */}
            {isOpen && (
                <div className="bg-slate-900 border-t border-slate-700 h-[400px] flex text-slate-300">
                    {/* Sidebar List */}
                    <div className="w-1/4 border-r border-slate-700 overflow-y-auto">
                        {requests.map(req => (
                            <div
                                key={req.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedId(req.id); }}
                                className={`p-3 border-b border-slate-800 cursor-pointer hover:bg-slate-800 flex flex-col gap-1 ${selectedId === req.id ? 'bg-slate-800 border-l-4 border-l-blue-500' : ''}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className={`font-bold ${getMethodColor(req.method)}`}>{req.method}</span>
                                    <span className={`text-[10px] px-1 rounded ${getStatusColor(req.status)} text-slate-900`}>{req.status}</span>
                                </div>
                                <div className="truncate opacity-70" title={req.url}>{req.url}</div>
                                <div className="text-[10px] opacity-40 text-right">{new Date(req.timestamp).toLocaleTimeString()}</div>
                            </div>
                        ))}
                    </div>

                    {/* Detail View */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center h-full opacity-50">Loading profile...</div>
                        ) : profile ? (
                            <>
                                {/* Tabs */}
                                <div className="flex border-b border-slate-700 bg-slate-900">
                                    <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={14} />} label="Overview" />
                                    <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')} icon={<Database size={14} />} label={`Database (${profile.logs.filter(l => l.type === 'kv').length})`} />
                                    <TabButton active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} icon={<Cpu size={14} />} label="Memory" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
                                    {activeTab === 'overview' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <Card title="Request Info">
                                                <Row label="Method" value={profile.method} />
                                                <Row label="URL" value={profile.url} />
                                                <Row label="Status" value={profile.status} />
                                                <Row label="Time" value={new Date(profile.startTime).toLocaleString()} />
                                            </Card>
                                            <Card title="Performance">
                                                <Row label="Total Duration" value={`${profile.duration.toFixed(2)} ms`} highlight={profile.duration > 200} />
                                                <Row label="DB Queries" value={profile.logs.filter(l => l.type === 'kv').length} />
                                                <Row label="DB Time" value={`${profile.logs.reduce((acc, l) => acc + (l.type === 'kv' ? l.duration : 0), 0).toFixed(2)} ms`} />
                                            </Card>
                                            {profile.error && (
                                                <div className="col-span-2 p-4 bg-red-900/20 border border-red-900 text-red-400 rounded">
                                                    <h3 className="font-bold mb-1">Error</h3>
                                                    <pre>{profile.error}</pre>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'db' && (
                                        <div className="space-y-2">
                                            {profile.logs.filter(l => l.type === 'kv').length === 0 && <div className="opacity-50 italic">No database operations</div>}
                                            {profile.logs.filter(l => l.type === 'kv').map((log, idx) => (
                                                <div key={idx} className="bg-slate-900 border border-slate-800 rounded p-2 text-xs font-mono">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-blue-400 font-bold uppercase">{log.operation}</span>
                                                        <span className={`${log.duration > 10 ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                                                            {log.duration.toFixed(2)} ms
                                                        </span>
                                                    </div>
                                                    {log.key && <div className="opacity-70 break-all">{log.key}</div>}
                                                    {log.details && (
                                                        <div className="mt-2 p-2 bg-slate-950 rounded overflow-x-auto text-[10px]">
                                                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {activeTab === 'memory' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <Card title="Memory Delta (Backend)">
                                                <Row label="RSS" value={formatBytes(profile.memory.rss)} />
                                                <Row label="Heap Total" value={formatBytes(profile.memory.heapTotal)} />
                                                <Row label="Heap Used" value={formatBytes(profile.memory.heapUsed)} />
                                                <Row label="External" value={formatBytes(profile.memory.external)} />
                                            </Card>
                                            <div className="text-slate-500 text-[10px] col-span-2">
                                                * Values represent the change in memory usage during the request lifecycle.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full opacity-30">Select a request</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`flex items-center gap-2 px-4 py-3 hover:bg-slate-800 transition-colors border-b-2 ${active ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function Card({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
            <h3 className="font-bold mb-3 text-slate-400 uppercase tracking-wider text-[10px]">{title}</h3>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function Row({ label, value, highlight }: { label: string, value: any, highlight?: boolean }) {
    return (
        <div className="flex justify-between border-b border-slate-800 pb-1 last:border-0">
            <span className="opacity-60">{label}</span>
            <span className={highlight ? 'text-red-400 font-bold' : ''}>{value}</span>
        </div>
    );
}

function getMethodColor(method: string) {
    switch (method) {
        case 'GET': return 'text-blue-400';
        case 'POST': return 'text-green-400';
        case 'PUT': return 'text-yellow-400';
        case 'DELETE': return 'text-red-400';
        default: return 'text-slate-400';
    }
}

function getStatusColor(status: number) {
    if (status >= 500) return 'bg-red-500';
    if (status >= 400) return 'bg-orange-400';
    if (status >= 300) return 'bg-yellow-400';
    return 'bg-green-400';
}

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
