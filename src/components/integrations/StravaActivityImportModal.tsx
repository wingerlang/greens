import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';

interface StravaActivity {
    id: number;
    name: string;
    type: string;
    start_date: string;
    elapsed_time: number;
    moving_time: number;
    distance: number;
    excludeFromStats?: boolean;
}

interface SyncDiffReport {
    newActivities: StravaActivity[];
    changedActivities: { strava: StravaActivity; changes: string[] }[];
    matchedCount: number;
    totalStrava: number;
}

interface StravaActivityImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialRange?: ScanRange;
}

const EXERCISE_ICONS: Record<string, string> = {
    Run: '🏃', TrailRun: '🏃',
    Ride: '🚴', VirtualRide: '🚴',
    Swim: '🏊',
    WeightTraining: '🏋️', Workout: '🏋️',
    Walk: '🚶', Hike: '🥾',
    Yoga: '🧘',
};

type ScanRange = '7days' | '30days' | 'year' | 'all';

export function StravaActivityImportModal({ isOpen, onClose, initialRange }: StravaActivityImportModalProps) {
    const { token } = useAuth();
    const { refreshData } = useData();

    // State
    const [step, setStep] = useState<'setup' | 'scanning' | 'review' | 'importing' | 'success'>('setup');
    const [scanRange, setScanRange] = useState<ScanRange>(initialRange || '30days');
    const [report, setReport] = useState<SyncDiffReport | null>(null);
    const [activeTab, setActiveTab] = useState<'new' | 'changed'>('new');

    // Selection
    const [selectedNew, setSelectedNew] = useState<Set<number>>(new Set());
    const [selectedChanged, setSelectedChanged] = useState<Set<number>>(new Set());
    const [importStats, setImportStats] = useState<{ created: number; updated: number }>({ created: 0, updated: 0 });

    const [elapsedTime, setElapsedTime] = useState(0);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('setup');
            setScanRange(initialRange || '30days');
            setReport(null);
            setSelectedNew(new Set());
            setSelectedChanged(new Set());
        }
    }, [isOpen, initialRange]);

    const handleScan = async () => {
        setStep('scanning');
        setElapsedTime(0);
        const timer = setInterval(() => setElapsedTime(t => t + 1), 1000);

        try {
            let fromDate: string | undefined;
            if (scanRange === '7days') {
                fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (scanRange === '30days') {
                fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            } else if (scanRange === 'year') {
                fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
            }
            // 'all' sends undefined -> backend scans everything

            const res = await fetch('/api/strava/scan', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fromDate })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setReport(data);

            // Auto-select "New", but not "Changed" (safety)
            setSelectedNew(new Set(data.newActivities.map((a: any) => a.id)));
            setSelectedChanged(new Set()); // User must explicitly opt-in for changes

            setStep('review');
            if (data.newActivities.length === 0 && data.changedActivities.length > 0) {
                setActiveTab('changed');
            }

        } catch (err) {
            console.error(err);
            alert('Scan failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
            setStep('setup');
        } finally {
            clearInterval(timer);
        }
    };

    const handleImport = async () => {
        if (!report) return;
        setStep('importing');

        try {
            const newToImport = report.newActivities.filter(a => selectedNew.has(a.id));
            const changedToImport = report.changedActivities.filter(a => selectedChanged.has(a.strava.id)).map(x => x.strava);

            // Batch 1: New
            if (newToImport.length > 0) {
                await fetch('/api/strava/import', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activities: newToImport, forceUpdate: false })
                });
            }

            // Batch 2: Changed (Force Update)
            if (changedToImport.length > 0) {
                await fetch('/api/strava/import', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activities: changedToImport, forceUpdate: true })
                });
            }

            setImportStats({ created: newToImport.length, updated: changedToImport.length });
            await refreshData();
            setStep('success');

            setTimeout(() => {
                onClose();
                // Reset state after close
                setStep('setup');
            }, 2500);

        } catch (err) {
            console.error(err);
            alert('Import failed');
            setStep('review');
        }
    };

    const toggleNew = (id: number) => {
        const next = new Set(selectedNew);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedNew(next);
    };

    const toggleChanged = (id: number) => {
        const next = new Set(selectedChanged);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedChanged(next);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay backdrop-blur-md bg-slate-950/80 fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 shadow-2xl rounded-3xl overflow-hidden w-full max-w-3xl flex flex-col h-[95vh] animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-slate-950 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <span className="text-[#FC4C02]">Strava</span> Sync 2.0
                        </h2>
                        <p className="text-slate-400 text-xs">Total History Control</p>
                    </div>
                    {step !== 'importing' && step !== 'scanning' && (
                        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto p-6">

                    {step === 'setup' && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="text-4xl mb-2">📡</div>
                                <h3 className="text-lg font-bold text-white">Redo att scanna?</h3>
                                <p className="text-slate-400 max-w-md mx-auto">
                                    Vi hämtar din historik från Strava och jämför med din databas. Inget sparas förrän du godkänner.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <button
                                    onClick={() => setScanRange('7days')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${scanRange === '7days' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="font-bold text-white">7 Dagar</div>
                                    <div className="text-xs text-slate-500 mt-1">För veckochecken.</div>
                                </button>
                                <button
                                    onClick={() => setScanRange('30days')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${scanRange === '30days' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="font-bold text-white">30 Dagar</div>
                                    <div className="text-xs text-slate-500 mt-1">Månadens pass.</div>
                                </button>
                                <button
                                    onClick={() => setScanRange('year')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${scanRange === 'year' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="font-bold text-white">12 Månader</div>
                                    <div className="text-xs text-slate-500 mt-1">Årsstatistik.</div>
                                </button>
                                <button
                                    onClick={() => setScanRange('all')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${scanRange === 'all' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="font-bold text-white">Allt</div>
                                    <div className="text-xs text-slate-500 mt-1">Totalhistorik.</div>
                                </button>
                            </div>

                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={handleScan}
                                    className="px-8 py-3 bg-[#FC4C02] hover:bg-[#E34402] text-white font-black uppercase tracking-wider rounded-full shadow-lg shadow-orange-500/20 transition-all transform hover:scale-105"
                                >
                                    Starta Scan
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'scanning' && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-6">
                            <div className="relative w-20 h-20">
                                <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-[#FC4C02] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white animate-pulse">Analyserar Strava...</h3>
                                <p className="text-slate-400 text-sm mt-2">Hämtar aktiviteter och jämför data.</p>
                                <p className="text-slate-500 font-mono text-xs mt-4">{elapsedTime}s</p>
                            </div>
                        </div>
                    )}

                    {step === 'review' && report && (
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between mb-6 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                <div className="flex gap-4 text-sm">
                                    <div><span className="text-slate-400">Totalt på Strava:</span> <span className="text-white font-bold">{report.totalStrava}</span></div>
                                    <div><span className="text-slate-400">Matchade (OK):</span> <span className="text-emerald-400 font-bold">{report.matchedCount}</span></div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-white/10 mb-4">
                                <button
                                    onClick={() => setActiveTab('new')}
                                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'new' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                                >
                                    Nya ({report.newActivities.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('changed')}
                                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'changed' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                                >
                                    Ändrade ({report.changedActivities.length})
                                </button>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-auto min-h-[300px]">
                                {activeTab === 'new' ? (
                                    <div className="space-y-2">
                                        {report.newActivities.length === 0 && <div className="text-slate-500 text-center py-10">Inga nya aktiviteter hittades.</div>}
                                        {report.newActivities.map(a => (
                                            <div key={a.id} onClick={() => toggleNew(a.id)} className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer ${selectedNew.has(a.id) ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950/30 border-white/5 hover:bg-slate-800'}`}>
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedNew.has(a.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600'}`}>✓</div>
                                                <div className="text-2xl">{EXERCISE_ICONS[a.type] || '⚡'}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-white text-sm truncate">{a.name}</div>
                                                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                                                        <span>📅 {new Date(a.start_date).toLocaleDateString()}</span>
                                                        <span>📏 {a.distance ? (a.distance / 1000).toFixed(2) : 0} km</span>
                                                        <span className="flex items-center gap-1">
                                                            ⏱️ <span className="text-emerald-400 font-medium">{(a.moving_time / 60).toFixed(1)}</span>
                                                            <span className="text-slate-600">/</span>
                                                            <span className="text-slate-500">{(a.elapsed_time / 60).toFixed(1)} min</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Exclude from PRs/Stats toggle */}
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const next = { ...report, newActivities: report.newActivities.map(na => na.id === a.id ? { ...na, excludeFromStats: !na.excludeFromStats } : na) };
                                                        setReport(next);
                                                    }}
                                                    className={`px-2 py-1 rounded border text-[10px] font-bold transition-all ${a.excludeFromStats ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-slate-800 border-white/5 text-slate-500 hover:text-slate-300'}`}
                                                    title="Markera som felaktig (exkludera från stats/PB)"
                                                >
                                                    {a.excludeFromStats ? 'EXKLUDERAD' : 'GILTIG'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {report.changedActivities.length === 0 && <div className="text-slate-500 text-center py-10">Inga ändringar hittades.</div>}
                                        {report.changedActivities.map(({ strava: s, changes }) => (
                                            <div key={s.id} onClick={() => toggleChanged(s.id)} className={`flex items-start gap-4 p-3 rounded-lg border cursor-pointer ${selectedChanged.has(s.id) ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/30 border-white/5 hover:bg-slate-800'}`}>
                                                <div className={`w-5 h-5 mt-1 rounded flex items-center justify-center border ${selectedChanged.has(s.id) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-600'}`}>✓</div>
                                                <div className="text-2xl">{EXERCISE_ICONS[s.type] || '⚡'}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-white text-sm truncate">{s.name}</div>
                                                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1 mb-2">
                                                        <span>📅 {new Date(s.start_date).toLocaleDateString()}</span>
                                                        <span className="flex items-center gap-1">
                                                            ⏱️ <span className="text-amber-400 font-medium">{(s.moving_time / 60).toFixed(1)}</span>
                                                            <span className="text-slate-600">/</span>
                                                            <span className="text-slate-500">{(s.elapsed_time / 60).toFixed(1)} min</span>
                                                        </span>
                                                    </div>
                                                    <div className="text-xs bg-black/30 p-2 rounded text-amber-300 font-mono">
                                                        {changes.map((c, i) => <div key={i}>• {c}</div>)}
                                                    </div>
                                                </div>

                                                {/* Exclude from PRs/Stats toggle */}
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const next = { ...report, changedActivities: report.changedActivities.map(ca => ca.strava.id === s.id ? { ...ca, strava: { ...ca.strava, excludeFromStats: !ca.strava.excludeFromStats } } : ca) };
                                                        setReport(next);
                                                    }}
                                                    className={`px-2 py-1 rounded border text-[10px] font-bold transition-all ${s.excludeFromStats ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-slate-800 border-white/5 text-slate-500 hover:text-slate-300'}`}
                                                    title="Markera som felaktig (exkludera från stats/PB)"
                                                >
                                                    {s.excludeFromStats ? 'EXKLUDERAD' : 'GILTIG'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                            <h3 className="text-xl font-bold text-white">Synkar...</h3>
                            <p className="text-slate-400">Uppdaterar din databas.</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="text-6xl mb-4">✅</div>
                            <h3 className="text-2xl font-bold text-white mb-2">Klart!</h3>
                            <p className="text-slate-400">
                                {importStats.created} nya importerade.<br />
                                {importStats.updated} uppdaterade/korrigerade.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {step === 'review' && (
                    <div className="p-4 bg-slate-950 border-t border-white/5 flex gap-4">
                        <button onClick={() => setStep('setup')} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">Backa</button>
                        <div className="flex-1"></div>
                        <div className="flex flex-col items-end justify-center mr-4 text-xs text-slate-400">
                            <span>{selectedNew.size} nya</span>
                            <span>{selectedChanged.size} uppdateringar</span>
                        </div>
                        <button
                            onClick={handleImport}
                            disabled={selectedNew.size === 0 && selectedChanged.size === 0}
                            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                        >
                            Synka Valda ({selectedNew.size + selectedChanged.size})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
