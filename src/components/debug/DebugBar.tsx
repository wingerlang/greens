import React, { useState, useEffect, useRef } from 'react';
import { useDebugInterceptor, RequestSummary, DebugProfile } from '../../hooks/useDebugInterceptor';
import { X, Database, Clock, Activity, List, ChevronRight, ChevronDown, Monitor, Cpu, Target, FileCode, Layers, Map as MapIcon, Globe } from 'lucide-react';
import { getComponentInfo, ComponentDebugInfo } from '../../utils/debug/fiber-inspector.ts';

// Dynamic import of pages for file map
const pageModules = import.meta.glob('/src/pages/**/*.tsx');
const pageFiles = Object.keys(pageModules);

export default function DebugBar() {
    // Only show in dev mode (localhost)
    if (!import.meta.env.DEV) return null;

    const { requests, latestId } = useDebugInterceptor();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [profile, setProfile] = useState<DebugProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'db' | 'memory' | 'ui' | 'structure'>('overview');

    // UI Inspector State
    const [isInspectMode, setIsInspectMode] = useState(false);
    const [inspectedElement, setInspectedElement] = useState<ComponentDebugInfo | null>(null);
    const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);

    // System Info
    const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
    const [activeModals, setActiveModals] = useState<string[]>([]);

    useEffect(() => {
        if (selectedId) {
            fetchDebugProfile(selectedId);
        }
    }, [selectedId]);

    // UI Inspector Effects
    useEffect(() => {
        if (!isInspectMode) {
            setHoveredRect(null);
            return;
        }

        const handleMouseOver = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target as HTMLElement;
            if (target && !target.closest('#debug-bar-root')) {
                setHoveredRect(target.getBoundingClientRect());
            }
        };

        const handleClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target as HTMLElement;
            if (target && !target.closest('#debug-bar-root')) {
                const info = getComponentInfo(target);
                if (info) {
                    setInspectedElement(info);
                    setIsInspectMode(false);
                    setIsOpen(true);
                    setActiveTab('ui');
                }
            }
        };

        window.addEventListener('mouseover', handleMouseOver, true);
        window.addEventListener('click', handleClick, true);

        return () => {
            window.removeEventListener('mouseover', handleMouseOver, true);
            window.removeEventListener('click', handleClick, true);
        };
    }, [isInspectMode]);

    // System Monitor (Route & Modals)
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentRoute(window.location.pathname);

            // Scan for likely modals
            // Looking for high z-index, fixed positioning, or role="dialog"
            const modals: string[] = [];
            document.querySelectorAll('[role="dialog"]').forEach(el => {
                const info = getComponentInfo(el as HTMLElement);
                modals.push(info?.name || 'Unknown Modal');
            });
            // Fallback heuristics for custom modals
            if (modals.length === 0) {
                 // Check for our specific common modal classes if role is missing
                 // This is heuristic-based
                 document.querySelectorAll('.fixed.inset-0.z-50').forEach(el => {
                     // Try to find a named child component
                     const info = getComponentInfo(el as HTMLElement);
                     if (info?.name && info.name !== 'div') {
                         modals.push(info.name);
                     }
                 });
            }
            setActiveModals(modals);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

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

    const currentRequest = requests[0];

    return (
        <div id="debug-bar-root" className="fixed bottom-0 left-0 right-0 z-[9999] font-mono text-xs">
            {/* Inspector Overlay */}
            {isInspectMode && hoveredRect && (
                <div
                    className="fixed pointer-events-none z-[10000] border-2 border-red-500 bg-red-500/10 transition-all duration-75"
                    style={{
                        top: hoveredRect.top,
                        left: hoveredRect.left,
                        width: hoveredRect.width,
                        height: hoveredRect.height,
                    }}
                >
                    <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold rounded-t shadow">
                        Click to Inspect
                    </div>
                </div>
            )}

            {/* Main Bar */}
            <div
                className="bg-slate-900 text-slate-300 border-t border-slate-700 h-10 flex items-center px-4 justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={(e) => {
                    // Don't toggle if clicking inspector button
                    if ((e.target as HTMLElement).closest('button')) return;
                    setIsOpen(!isOpen);
                }}
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold">DEV MODE</span>
                    </div>

                    {/* Inspector Toggle */}
                    <button
                        onClick={() => setIsInspectMode(!isInspectMode)}
                        className={`p-1.5 rounded ${isInspectMode ? 'bg-red-500 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                        title="Inspect Component (Click then hover UI)"
                    >
                        <Target size={16} />
                    </button>

                    <div className="h-4 w-px bg-slate-700 mx-2" />

                    {/* Quick Stats */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                         <div className="flex items-center gap-1">
                             <Globe size={12} />
                             <span className="truncate max-w-[150px] text-slate-300" title="Current Route">{currentRoute}</span>
                         </div>
                         {activeModals.length > 0 && (
                             <div className="flex items-center gap-1 text-yellow-500">
                                 <Layers size={12} />
                                 <span className="font-bold">{activeModals.length} Modal(s)</span>
                             </div>
                         )}
                    </div>

                    {currentRequest && (
                        <div className="flex items-center gap-3 border-l border-slate-700 pl-4 hidden md:flex">
                            <span className={`font-bold ${getMethodColor(currentRequest.method)}`}>{currentRequest.method}</span>
                            <span className="opacity-80 truncate max-w-[200px]">{currentRequest.url}</span>
                            <span className={`px-1.5 rounded ${getStatusColor(currentRequest.status)} text-slate-900 font-bold`}>
                                {currentRequest.status}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                     <span className="opacity-60 hidden sm:inline">{requests.length} requests</span>
                     {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </div>

            {/* Expanded Panel */}
            {isOpen && (
                <div className="bg-slate-900 border-t border-slate-700 h-[400px] flex text-slate-300">
                    {/* Sidebar List (Requests) */}
                    <div className="w-1/4 min-w-[200px] border-r border-slate-700 overflow-y-auto hidden sm:block">
                        {requests.map(req => (
                            <div
                                key={req.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedId(req.id); setActiveTab('overview'); }}
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
                    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
                        {/* Tabs */}
                        <div className="flex border-b border-slate-700 bg-slate-900 overflow-x-auto">
                            <TabButton active={activeTab === 'ui'} onClick={() => setActiveTab('ui')} icon={<Monitor size={14} />} label="Inspector" />
                            <TabButton active={activeTab === 'structure'} onClick={() => setActiveTab('structure')} icon={<MapIcon size={14} />} label="Files" />
                            <div className="w-px bg-slate-700 my-2 mx-1" />
                            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={14} />} label="Request" />
                            <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')} icon={<Database size={14} />} label={`DB ${profile ? `(${profile.logs.filter(l => l.type === 'kv').length})` : ''}`} />
                            <TabButton active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} icon={<Cpu size={14} />} label="Memory" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {activeTab === 'ui' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <h2 className="text-lg font-bold text-white mb-2">UI Inspector</h2>
                                        <button
                                            onClick={() => setIsInspectMode(true)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-2 text-xs"
                                        >
                                            <Target size={14} />
                                            <span>Pick Component</span>
                                        </button>
                                    </div>

                                    {inspectedElement ? (
                                        <div className="grid grid-cols-1 gap-4">
                                            <Card title="Selected Component">
                                                <Row label="Name" value={inspectedElement.name} highlight />
                                                <Row label="File" value={inspectedElement.filePath || 'Unknown'} />
                                                <Row label="Line" value={inspectedElement.lineNumber || 'Unknown'} />
                                            </Card>

                                            <Card title="Current Route Info">
                                                 <Row label="Path" value={currentRoute} />
                                                 <Row label="Active Modals" value={activeModals.join(', ') || 'None'} />
                                            </Card>

                                            {inspectedElement.props && (
                                                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                                                    <h3 className="font-bold mb-3 text-slate-400 uppercase tracking-wider text-[10px]">Props</h3>
                                                    <pre className="text-[10px] overflow-auto max-h-[200px] text-green-300">
                                                        {JSON.stringify(inspectedElement.props, (key, value) => {
                                                            if (typeof value === 'function') return '[Function]';
                                                            if (key === 'children') return '[React Children]';
                                                            return value;
                                                        }, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 opacity-50 border-2 border-dashed border-slate-800 rounded">
                                            <Target size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>Click "Pick Component" and select an element on the page to inspect it.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'structure' && (
                                <div className="space-y-4">
                                    <h2 className="text-lg font-bold text-white mb-2">Project Pages</h2>
                                    <p className="opacity-60 mb-4">List of all detected page components in <code>src/pages</code>.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {pageFiles.map(file => (
                                            <div key={file} className="bg-slate-900 p-2 rounded border border-slate-800 text-[10px] flex items-center gap-2 hover:border-blue-500 transition-colors group relative">
                                                <FileCode size={14} className="text-blue-400 shrink-0" />
                                                <span className="truncate" title={file}>{file.replace('/src/pages/', '')}</span>
                                                <span className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 bg-slate-800 px-1 rounded text-[8px] text-slate-400">
                                                    {file}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(activeTab === 'overview' || activeTab === 'db' || activeTab === 'memory') && !profile && (
                                <div className="flex items-center justify-center h-full opacity-30">Select a request from the sidebar</div>
                            )}

                            {activeTab === 'overview' && profile && (
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

                            {activeTab === 'db' && profile && (
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

                            {activeTab === 'memory' && profile && (
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
            className={`flex items-center gap-2 px-4 py-3 hover:bg-slate-800 transition-colors border-b-2 whitespace-nowrap ${active ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}
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
