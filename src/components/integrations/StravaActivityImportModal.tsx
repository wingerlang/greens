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
    average_heartrate?: number;
    average_speed?: number;
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
    /** If true, auto-start scan immediately using smart range */
    autoStart?: boolean;
}

const EXERCISE_ICONS: Record<string, string> = {
    Run: '🏃', TrailRun: '🏃',
    Ride: '🚴', VirtualRide: '🚴',
    Swim: '🏊',
    WeightTraining: '🏋️', Workout: '🏋️',
    Walk: '🚶', Hike: '🥾',
    Yoga: '🧘',
};

type ScanRange = 'smart' | '7days' | '30days' | 'year' | 'all';

export function StravaActivityImportModal({ isOpen, onClose, initialRange, autoStart = false }: StravaActivityImportModalProps) {
    const { token } = useAuth();
    const { refreshData, exerciseEntries } = useData();

    // State
    const [step, setStep] = useState<'setup' | 'scanning' | 'review' | 'importing' | 'success'>('setup');
    const [scanRange, setScanRange] = useState<ScanRange>(initialRange || 'smart');
    const [report, setReport] = useState<SyncDiffReport | null>(null);
    const [activeTab, setActiveTab] = useState<'new' | 'changed'>('new');

    // Selection
    const [selectedNew, setSelectedNew] = useState<Set<number>>(new Set());
    const [selectedChanged, setSelectedChanged] = useState<Set<number>>(new Set());
    const [importStats, setImportStats] = useState<{ created: number; updated: number }>({ created: 0, updated: 0 });

    const [elapsedTime, setElapsedTime] = useState(0);
    const [autoStartTriggered, setAutoStartTriggered] = useState(false);

    // Compute smart fromDate based on the latest activity's date
    const getSmartFromDate = (): string => {
        if (!exerciseEntries || exerciseEntries.length === 0) {
            // No activities at all — scan last 30 days
            return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }
        // Find the most recent activity date
        let latestDate = new Date(0);
        for (const entry of exerciseEntries) {
            const d = new Date(entry.date);
            if (d > latestDate) latestDate = d;
        }
        // Go 1 day before the latest activity to catch any same-day activities
        const fromDate = new Date(latestDate.getTime() - 24 * 60 * 60 * 1000);
        return fromDate.toISOString();
    };

    const getFromDateForRange = (range: ScanRange): string | undefined => {
        switch (range) {
            case 'smart': return getSmartFromDate();
            case '7days': return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            case '30days': return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            case 'year': return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
            case 'all': return undefined;
        }
    };

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('setup');
            setScanRange(initialRange || 'smart');
            setReport(null);
            setSelectedNew(new Set());
            setSelectedChanged(new Set());
            setAutoStartTriggered(false);
        }
    }, [isOpen, initialRange]);

    // Auto-start scan if autoStart is true
    useEffect(() => {
        if (isOpen && autoStart && !autoStartTriggered && step === 'setup') {
            setAutoStartTriggered(true);
            handleScan();
        }
    }, [isOpen, autoStart, autoStartTriggered, step]);

    const handleScan = async () => {
        setStep('scanning');
        setElapsedTime(0);
        const timer = setInterval(() => setElapsedTime(t => t + 1), 1000);

        try {
            const fromDate = getFromDateForRange(scanRange);

            const res = await fetch('/api/strava/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ fromDate })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setReport(data);

            // Auto-select "New", but not "Changed" (safety)
            setSelectedNew(new Set(data.newActivities.map((a: any) => a.id)));
            setSelectedChanged(new Set()); // User must explicitly opt-in for changes

            // If there are ONLY new activities (no changed), auto-import them immediately
            if (data.newActivities.length > 0 && data.changedActivities.length === 0) {
                // Auto-import new activities directly
                await autoImport(data);
            } else if (data.newActivities.length === 0 && data.changedActivities.length === 0) {
                // Nothing to sync — show success immediately
                setImportStats({ created: 0, updated: 0 });
                setStep('success');
                setTimeout(() => {
                    onClose();
                    setStep('setup');
                }, 2000);
            } else {
                setStep('review');
                if (data.newActivities.length === 0 && data.changedActivities.length > 0) {
                    setActiveTab('changed');
                }
            }

        } catch (err) {
            console.error(err);
            alert('Scan failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
            setStep('setup');
        } finally {
            clearInterval(timer);
        }
    };

    const autoImport = async (data: SyncDiffReport) => {
        setStep('importing');
        try {
            if (data.newActivities.length > 0) {
                await fetch('/api/strava/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ activities: data.newActivities, forceUpdate: false })
                });
            }

            setImportStats({ created: data.newActivities.length, updated: 0 });
            await refreshData();
            setStep('success');

            setTimeout(() => {
                onClose();
                setStep('setup');
            }, 2500);
        } catch (err) {
            console.error(err);
            // Fall back to review step so user can see what happened
            setStep('review');
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
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ activities: newToImport, forceUpdate: false })
                });
            }

            // Batch 2: Changed (Force Update)
            if (changedToImport.length > 0) {
                await fetch('/api/strava/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
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

    // Compute smart date label for display
    const formatLocalDuration = (minutes: number) => {
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    const formatLocalPace = (speedMs: number | undefined, type: string) => {
        if (!speedMs || speedMs <= 0) return null;
        
        // Running/Walking: min/km
        if (type === 'Run' || type === 'TrailRun' || type === 'Walk' || type === 'Hike') {
            const paceMinPerKm = 1000 / speedMs / 60;
            const mins = Math.floor(paceMinPerKm);
            const secs = Math.round((paceMinPerKm % 1) * 60);
            return `${mins}:${secs.toString().padStart(2, '0')}/km`;
        }
        
        // Cycling/Other: km/h
        return `${(speedMs * 3.6).toFixed(1)} km/h`;
    };

    const smartDateLabel = (() => {
        if (!exerciseEntries || exerciseEntries.length === 0) return 'senaste 30 dagarna';
        let latestDate = new Date(0);
        for (const entry of exerciseEntries) {
            const d = new Date(entry.date);
            if (d > latestDate) latestDate = d;
        }
        const daysAgo = Math.ceil((Date.now() - latestDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysAgo <= 1) return 'sedan igår';
        return `senaste ${daysAgo} dagarna`;
    })();

    return (
        <div className="modal-overlay backdrop-blur-md bg-slate-950/80 fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 shadow-2xl rounded-3xl overflow-hidden w-full max-w-3xl flex flex-col h-[95vh] animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-slate-950 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <span className="text-[#FC4C02]">Strava</span> Sync
                        </h2>
                        <p className="text-slate-400 text-xs">
                            {step === 'setup' && `Smart sync — ${smartDateLabel}`}
                            {step === 'scanning' && 'Söker nya aktiviteter...'}
                            {step === 'review' && 'Granska innan import'}
                            {step === 'importing' && 'Importerar...'}
                            {step === 'success' && 'Synk klar!'}
                        </p>
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
                                <h3 className="text-lg font-bold text-white">Synka med Strava</h3>
                                <p className="text-slate-400 max-w-md mx-auto text-sm">
                                    Klicka för att hämta nya aktiviteter. Synk startar automatiskt från senaste passets datum.
                                </p>
                            </div>

                            {/* Smart Sync — Primary Action */}
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={handleScan}
                                    className="px-10 py-4 bg-[#FC4C02] hover:bg-[#E34402] text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-500/20 transition-all transform hover:scale-105 flex items-center gap-3 text-lg"
                                >
                                    <span className="text-2xl">⚡</span>
                                    Smart Sync
                                </button>
                            </div>

                            <p className="text-center text-slate-500 text-[10px] uppercase tracking-wider">
                                Synkar {smartDateLabel}
                            </p>

                            {/* Advanced: Range Selection (collapsed) */}
                            <details className="mt-6">
                                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 text-center uppercase tracking-wider">
                                    Avancerat — Välj tidsperiod manuellt
                                </summary>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                    <button
                                        onClick={() => setScanRange('7days')}
                                        className={`p-3 rounded-xl border-2 text-left transition-all text-sm ${scanRange === '7days' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="font-bold text-white">7 Dagar</div>
                                    </button>
                                    <button
                                        onClick={() => setScanRange('30days')}
                                        className={`p-3 rounded-xl border-2 text-left transition-all text-sm ${scanRange === '30days' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="font-bold text-white">30 Dagar</div>
                                    </button>
                                    <button
                                        onClick={() => setScanRange('year')}
                                        className={`p-3 rounded-xl border-2 text-left transition-all text-sm ${scanRange === 'year' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="font-bold text-white">12 Månader</div>
                                    </button>
                                    <button
                                        onClick={() => setScanRange('all')}
                                        className={`p-3 rounded-xl border-2 text-left transition-all text-sm ${scanRange === 'all' ? 'border-[#FC4C02] bg-[#FC4C02]/10' : 'border-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="font-bold text-white">Allt</div>
                                    </button>
                                </div>
                                <div className="flex justify-center pt-4">
                                    <button
                                        onClick={handleScan}
                                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-sm"
                                    >
                                        Starta Scan
                                    </button>
                                </div>
                            </details>
                        </div>
                    )}

                    {step === 'scanning' && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-6">
                            <div className="relative w-20 h-20">
                                <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-[#FC4C02] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white animate-pulse">Söker på Strava...</h3>
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
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 font-medium uppercase tracking-wider">
                                                        <span>{new Date(a.start_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                        <span>{EXERCISE_ICONS[a.type] || '⚡'} {a.type}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-2 mt-2 items-center">
                                                        <span className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                            <span className="text-slate-500 text-[10px]">📏</span>
                                                            <span className="font-bold text-white">{a.distance ? (a.distance / 1000).toFixed(1) : 0}</span>
                                                            <span className="text-slate-500 text-[10px]">km</span>
                                                        </span>
                                                        <span className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                            <span className="text-slate-500 text-[10px]">⏱️</span>
                                                            <span className="font-bold text-emerald-400">{formatLocalDuration(a.moving_time / 60)}</span>
                                                            <span className="text-slate-500 text-[10px]">({formatLocalDuration(a.elapsed_time / 60)})</span>
                                                        </span>
                                                        {a.average_speed && (
                                                            <span className="flex items-center gap-1.5 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/10">
                                                                <span className="text-sky-500 text-[10px]">⚡</span>
                                                                <span className="font-bold text-sky-400 font-mono tracking-tighter">{formatLocalPace(a.average_speed, a.type)}</span>
                                                            </span>
                                                        )}
                                                        {a.average_heartrate && (
                                                            <span className="flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/10">
                                                                <span className="text-rose-500 text-[10px]">❤️</span>
                                                                <span className="font-bold text-rose-400 font-mono tracking-tighter">{Math.round(a.average_heartrate)}</span>
                                                                <span className="text-rose-500 text-[10px]">bpm</span>
                                                            </span>
                                                        )}
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
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 font-medium uppercase tracking-wider mb-2">
                                                        <span>{new Date(s.start_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                        <span>{EXERCISE_ICONS[s.type] || '⚡'} {s.type}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-2 mb-3 items-center">
                                                        <span className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                            <span className="text-slate-500 text-[10px]">⏱️</span>
                                                            <span className="font-bold text-amber-400">{formatLocalDuration(s.moving_time / 60)}</span>
                                                            <span className="text-slate-500 text-[10px]">({formatLocalDuration(s.elapsed_time / 60)})</span>
                                                        </span>
                                                        {s.average_speed && (
                                                            <span className="flex items-center gap-1.5 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/10">
                                                                <span className="text-sky-500 text-[10px]">⚡</span>
                                                                <span className="font-bold text-sky-400 font-mono tracking-tighter">{formatLocalPace(s.average_speed, s.type)}</span>
                                                            </span>
                                                        )}
                                                        {s.average_heartrate && (
                                                            <span className="text-rose-500/10 flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/10">
                                                                <span className="text-rose-500 text-[10px]">❤️</span>
                                                                <span className="font-bold text-rose-400 font-mono tracking-tighter">{Math.round(s.average_heartrate)}</span>
                                                                <span className="text-rose-500 text-[10px]">bpm</span>
                                                            </span>
                                                        )}
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
                                {importStats.created > 0 && <>{importStats.created} nya importerade.<br /></>}
                                {importStats.updated > 0 && <>{importStats.updated} uppdaterade.<br /></>}
                                {importStats.created === 0 && importStats.updated === 0 && 'Allt är redan synkat! 👌'}
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
