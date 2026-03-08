import React, { useMemo, useState } from 'react';
import { ExerciseEntry, UniversalActivity, ExerciseSubType } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { formatSwedishDate, formatDuration } from '../../utils/dateUtils.ts';
import { AlertCircle, CheckCircle2, Trash2, Zap, ArrowRight, Activity, ShieldCheck, Info, RefreshCcw } from 'lucide-react';

interface Anomaly {
    id: string;
    type: 'duplicate' | 'quality' | 'integrity' | 'incomplete';
    severity: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    affectedActivities: ExerciseEntry[];
    suggestedAction?: {
        label: string;
        apply: () => Promise<void>;
    };
}

interface DataAnalysisViewProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
    setSelectedActivityId: (id: string | null) => void;
}

export const DataAnalysisView: React.FC<DataAnalysisViewProps> = ({ exerciseEntries, universalActivities, setSelectedActivityId }) => {
    const { token } = useAuth();
    const { updateExercise, deleteExercise } = useData();
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    const [isFixing, setIsFixing] = useState<string | null>(null);

    // Detection Engine
    const anomalies = useMemo(() => {
        const results: Anomaly[] = [];

        // Filter out components of a merge
        const filteredEntries = exerciseEntries.filter(e => {
            const ua = universalActivities.find(u => u.id === e.id);
            return !ua?.mergedIntoId && !(e as any).mergedIntoId;
        });

        // 1. DUPLICATE DETECTION (Stricter)
        const duplicatePairs = new Set<string>();
        filteredEntries.forEach((e1, i) => {
            if (!e1.distance || e1.distance < 0.1) return;

            for (let j = i + 1; j < filteredEntries.length; j++) {
                const e2 = filteredEntries[j];
                if (!e2.distance || e2.distance < 0.1) continue;

                // Heuristic: Same day, AND very close distance/duration
                const sameDay = e1.date.split('T')[0] === e2.date.split('T')[0];
                if (!sameDay) continue;

                const distDiff = Math.abs(e1.distance - e2.distance);
                const durDiff = Math.abs(e1.durationMinutes - e2.durationMinutes);

                // Very strict: same distance rounded to 1 decimal AND duration within 30s
                if (distDiff < 0.05 && durDiff < 0.5) {
                    const pairId = [e1.id, e2.id].sort().join('_');
                    if (!duplicatePairs.has(pairId)) {
                        duplicatePairs.add(pairId);
                        results.push({
                            id: `dup_${pairId}`,
                            type: 'duplicate',
                            severity: 'high',
                            title: 'Potentiell dubblett',
                            description: `Två identiska pass på ${e1.distance.toFixed(1)}km hittades den ${formatSwedishDate(e1.date)}. Är detta samma pass loggat två gånger?`,
                            affectedActivities: [e1, e2],
                            suggestedAction: {
                                label: 'Ta bort den senare',
                                apply: async () => {
                                    // Delete the one with the "higher" ID or later creation if indistinguishable
                                    await deleteExercise(e2.id);
                                }
                            }
                        });
                    }
                }
            }
        });

        // 2. HIERARCHICAL QUALITY DETECTION (Löpning -> Kvalité)
        const qualityKeywords: { kw: string[], type: ExerciseSubType, label: string }[] = [
            { kw: ['intervall', '5x3km', '10x100m', 'blandade intervaller', 'x', '*', 'tusingar'], type: 'interval', label: 'Intervaller' },
            { kw: ['tempo', 'snabbdistans', '5k @', 'miltest', 'test', '@', 'pacerun', 'snabb'], type: 'tempo', label: 'Tempo' },
            { kw: ['fartlek'], type: 'fartlek', label: 'Fartlek' },
            { kw: ['snabbdistans', 'max', '5k max', '10k max'], type: 'snabbdistans', label: 'Snabbdistans' }
        ];

        filteredEntries.forEach(e => {
            if (e.type !== 'running' || e.subType !== 'default') return;
            const text = ((e.title || '') + ' ' + (e.notes || '')).toLowerCase();

            for (const group of qualityKeywords) {
                if (group.kw.some(k => text.includes(k.toLowerCase()))) {
                    results.push({
                        id: `qual_${e.id}`,
                        type: 'quality',
                        severity: 'medium',
                        title: `Möjligt kvalitétspass: ${group.label}`,
                        description: `Passet "${e.title || 'Namnlöst'}" innehåller nyckelord som tyder på ${group.label.toLowerCase()}.`,
                        affectedActivities: [e],
                        suggestedAction: {
                            label: `Ändra till ${group.label}`,
                            apply: async () => {
                                await updateExercise(e.id, { subType: group.type });
                                // Persistence handled by parent/context if configured, 
                                // otherwise we'd need a fetch here like in ActivityDetailModal
                            }
                        }
                    });
                    break; // Only one quality suggestion per activity
                }
            }
        });

        // 3. INTEGRITY CONSTRAINTS
        filteredEntries.forEach(e => {
            const pace = e.distance ? e.durationMinutes / e.distance : 0;

            // Unreasonable Pace
            if (e.type === 'running' && pace > 0 && pace < 3.0 && (e.distance || 0) > 0.4) {
                results.push({
                    id: `int_pace_${e.id}`,
                    type: 'integrity',
                    severity: 'high',
                    title: 'Orimlig fart identifierad',
                    description: `Passet "${e.title || 'Namnlöst'}" har en snittfart på ${pace.toFixed(2)} min/km. Var det verkligen så snabbt?`,
                    affectedActivities: [e]
                });
            }

            // Unreasonable Duration
            if (e.durationMinutes > 1200) { // 20 hours
                results.push({
                    id: `int_dur_${e.id}`,
                    type: 'integrity',
                    severity: 'medium',
                    title: 'Extremt lång varaktighet',
                    description: `Passet är registrerat som ${Math.round(e.durationMinutes / 60)} timmar långt.`,
                    affectedActivities: [e]
                });
            }

            // High Heart Rate
            if ((e as any).heartRateAvg > 210 || (e as any).heartrateAvg > 210) {
                results.push({
                    id: `int_hr_${e.id}`,
                    type: 'integrity',
                    severity: 'high',
                    title: 'Ovanligt hög puls',
                    description: `Genomsnittspulsen (${(e as any).heartRateAvg || (e as any).heartrateAvg} bpm) verkar orimligt hög.`,
                    affectedActivities: [e]
                });
            }
        });

        // 4. INCOMPLETE DATA
        filteredEntries.forEach(e => {
            if (e.type === 'strength' && (!e.notes || e.notes.length < 5)) {
                results.push({
                    id: `inc_str_${e.id}`,
                    type: 'incomplete',
                    severity: 'low',
                    title: 'Tomt styrkepass',
                    description: `Styrkepasset den ${formatSwedishDate(e.date)} saknar övningar eller anteckningar.`,
                    affectedActivities: [e]
                });
            }
        });

        return results.filter(r => !processedIds.has(r.id));
    }, [exerciseEntries, universalActivities, processedIds, updateExercise, deleteExercise]);

    // Hidden or Excluded activities discoverability
    const hiddenActivities = useMemo(() => {
        return exerciseEntries.filter(e => {
            const ua = universalActivities.find(u => u.id === e.id);
            const perf = (e as any)._mergeData?.universalActivity?.performance || ua?.performance;
            return e.isHiddenInCalendar || perf?.isHiddenInCalendar || e.excludeFromStats;
        });
    }, [exerciseEntries, universalActivities]);

    // Health Score (0-100)
    const healthScore = useMemo(() => {
        const base = 100;
        const deductions = anomalies.reduce((acc, a) => {
            if (a.severity === 'high') return acc + 10;
            if (a.severity === 'medium') return acc + 5;
            return acc + 2;
        }, 0);
        return Math.max(0, base - deductions);
    }, [anomalies]);

    const handleFix = async (anomaly: Anomaly) => {
        if (!anomaly.suggestedAction) return;
        setIsFixing(anomaly.id);
        try {
            await anomaly.suggestedAction.apply();
            setProcessedIds(prev => new Set([...prev, anomaly.id]));
        } catch (e) {
            console.error('Fix failed:', e);
        } finally {
            setIsFixing(null);
        }
    };

    const handleDismiss = (id: string) => {
        setProcessedIds(prev => new Set([...prev, id]));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header / Health Meter */}
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl -mr-32 -mt-32 rounded-full" />

                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="space-y-2 text-center md:text-left">
                        <h2 className="text-3xl font-black text-white italic">Dataanalys & Kontroll</h2>
                        <p className="text-slate-400 text-sm max-w-md">
                            Här hittar vi anomalier, förbättringspotential och dolda mönster i din träningsdata för att hålla din logg i toppskick.
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="64" cy="64" r="58"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    className="text-slate-800"
                                />
                                <circle
                                    cx="64" cy="64" r="58"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    strokeDasharray={364}
                                    strokeDashoffset={364 - (364 * healthScore) / 100}
                                    strokeLinecap="round"
                                    className={`${healthScore > 80 ? 'text-emerald-500' : healthScore > 50 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-3xl font-black ${healthScore > 80 ? 'text-emerald-400' : healthScore > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {healthScore}%
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Hälsa</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Analyserade pass', value: exerciseEntries.length, icon: <Activity size={14} />, color: 'text-blue-400' },
                    { label: 'Identifierade brister', value: anomalies.length, icon: <AlertCircle size={14} />, color: 'text-amber-400' },
                    { label: 'Dubbletter', value: anomalies.filter(a => a.type === 'duplicate').length, icon: <Zap size={14} />, color: 'text-rose-400' },
                    { label: 'Kvalitét-förslag', value: anomalies.filter(a => a.type === 'quality').length, icon: <ShieldCheck size={14} />, color: 'text-emerald-400' }
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${stat.color}`}>
                            {stat.icon} {stat.label}
                        </div>
                        <div className="text-2xl font-black text-white">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Anomaly List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Zap size={16} className="text-amber-500" />
                        Aktuella åtgärder
                    </h3>
                    <button
                        onClick={() => setProcessedIds(new Set())}
                        className="text-[10px] font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        <RefreshCcw size={10} /> Återställ alla
                    </button>
                </div>

                {anomalies.length === 0 ? (
                    <div className="bg-slate-900/30 border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                            <CheckCircle2 size={32} />
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-lg">Allt ser perfekt ut!</h4>
                            <p className="text-slate-500 text-sm max-w-xs">Din träningslogg är ren och prydlig. Inga anomalier hittades just nu.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {anomalies.map(anomaly => (
                            <div
                                key={anomaly.id}
                                className={`group bg-slate-900 border ${anomaly.severity === 'high' ? 'border-rose-500/30' : anomaly.severity === 'medium' ? 'border-amber-500/30' : 'border-white/10'} rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden`}
                            >
                                {/* Background Icon */}
                                <div className="absolute -bottom-4 -right-4 opacity-[0.03] rotate-12 group-hover:scale-110 transition-transform duration-500">
                                    {anomaly.type === 'quality' && <ShieldCheck size={120} />}
                                    {anomaly.type === 'duplicate' && <Zap size={120} />}
                                    {anomaly.type === 'integrity' && <AlertCircle size={120} />}
                                </div>

                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${anomaly.severity === 'high' ? 'bg-rose-500' : anomaly.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                {anomaly.type === 'quality' ? 'Kategorisering' : anomaly.type === 'integrity' ? 'Datadefekt' : anomaly.type === 'duplicate' ? 'Dubblett' : 'Brister'}
                                            </span>
                                        </div>
                                        <h4 className="text-lg font-black text-white italic leading-tight">{anomaly.title}</h4>
                                    </div>
                                    <button
                                        onClick={() => handleDismiss(anomaly.id)}
                                        className="text-slate-600 hover:text-white transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <p className="text-slate-400 text-xs leading-relaxed">
                                    {anomaly.description}
                                </p>

                                {/* Affected Activity Preview */}
                                {anomaly.affectedActivities.length > 0 && (
                                    <div className="py-2 space-y-2">
                                        {anomaly.affectedActivities.map((act, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedActivityId(act.id)}
                                                className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-white/5 text-[10px] hover:bg-slate-700/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 font-mono">{formatSwedishDate(act.date)}</span>
                                                    <span className="text-white font-bold truncate max-w-[120px]">{act.title || 'Aktivitet'}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-emerald-400 font-bold">{act.distance}km</span>
                                                    <span className="text-slate-500">{formatDuration(act.durationMinutes * 60)}</span>
                                                    <ArrowRight size={10} className="text-slate-600" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {anomaly.suggestedAction && (
                                    <div className="pt-2">
                                        <button
                                            onClick={() => handleFix(anomaly)}
                                            disabled={isFixing === anomaly.id}
                                            className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase transition-all shadow-lg ${anomaly.type === 'quality'
                                                ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/20'
                                                : anomaly.type === 'duplicate'
                                                    ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                                                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/20'
                                                } disabled:opacity-50 disabled:scale-95`}
                                        >
                                            {isFixing === anomaly.id ? (
                                                <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    {anomaly.suggestedAction.label}
                                                    <ArrowRight size={14} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Hidden / Excluded Sessions Discoverability */}
            {hiddenActivities.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                        <ShieldCheck size={16} />
                        Dolda eller exkluderade pass
                    </h3>

                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-950/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Datum</th>
                                        <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Aktivitet</th>
                                        <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider">Åtgärd</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {hiddenActivities.map(act => (
                                        <tr key={act.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono">
                                                {formatSwedishDate(act.date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold">{act.title || 'Namnlös'}</span>
                                                    <span className="text-slate-500 text-[10px]">{act.distance || 0} km • {formatDuration(act.durationMinutes * 60)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-wrap gap-2">
                                                    {(act.isHiddenInCalendar || (act as any)._mergeData?.universalActivity?.performance?.isHiddenInCalendar) && (
                                                        <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full text-[9px] font-bold border border-rose-500/20">Dold i kalender</span>
                                                    )}
                                                    {act.excludeFromStats && (
                                                        <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-[9px] font-bold border border-amber-500/20">Exkluderad statistik</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedActivityId(act.id)}
                                                        className="p-2 text-slate-500 hover:text-white transition-colors"
                                                        title="Visa detaljer"
                                                    >
                                                        <ArrowRight size={16} />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            await updateExercise(act.id, {
                                                                isHiddenInCalendar: false,
                                                                excludeFromStats: false
                                                            });
                                                        }}
                                                        className="px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 rounded-lg text-[10px] font-black uppercase transition-all"
                                                    >
                                                        Återställ
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Quality Hierarchy Explainer */}
            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                    <Info size={32} />
                </div>
                <div className="space-y-1">
                    <h4 className="text-white font-bold uppercase text-xs tracking-widest">Tips: Kvalitétshierarki</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        Genom att tagga dina pass som <strong>Intervall</strong>, <strong>Tempo</strong> eller <strong>Fartlek</strong> grupperas de automatiskt under kategorin <span className="text-indigo-400 font-bold">Löpning &rarr; Kvalitét</span> i dina sammanfattningar. Det ger dig en bättre bild av din träningsfördelning.
                    </p>
                </div>
            </div>
        </div>
    );
};
