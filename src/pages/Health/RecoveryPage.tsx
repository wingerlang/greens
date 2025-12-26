import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { InteractiveBodyMap } from '../../components/recovery/InteractiveBodyMap.tsx';
import { InjuryLogModal } from '../../components/recovery/InjuryLogModal.tsx';
import { RehabRoutineCard } from '../../components/recovery/RehabRoutineCard.tsx';
import { BodyPart, InjuryLog } from '../../models/types.ts';
import { StrengthWorkout } from '../../models/strengthTypes.ts';
import { calculateAcuteLoad, analyzeInjuryRisk } from '../../utils/loadCalculator.ts';
import { REHAB_ROUTINES } from '../../data/rehabRoutines.ts';

const API_BASE = 'http://localhost:8000';

export function RecoveryPage() {
    const { injuryLogs, recoveryMetrics } = useData();
    const { token } = useAuth();
    const { settings } = useSettings();

    // State
    const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([]);
    const [selectedPart, setSelectedPart] = useState<BodyPart | null>(null);
    const [editingLog, setEditingLog] = useState<InjuryLog | undefined>(undefined);

    // Fetch Strength Workouts for Load Calc
    useEffect(() => {
        if (!token) return;
        async function fetchHistory() {
            try {
                // Fetch last 30 days is enough for Acute Load (7d) + Trends
                const start = new Date();
                start.setDate(start.getDate() - 30);
                const startStr = start.toISOString().split('T')[0];
                const endStr = new Date().toISOString().split('T')[0];

                const res = await fetch(`${API_BASE}/api/strength/workouts?start=${startStr}&end=${endStr}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.workouts) setStrengthWorkouts(data.workouts);
            } catch (e) {
                console.error("Failed to fetch workouts for RecoveryCalc", e);
            }
        }
        fetchHistory();
    }, [token]);

    const activeInjuries = injuryLogs.filter(log => log.status === 'active' || log.status === 'recovering');

    // Computed Load & Risks
    const acuteLoad = useMemo(() => calculateAcuteLoad(strengthWorkouts), [strengthWorkouts]);
    const risks = useMemo(() => analyzeInjuryRisk(acuteLoad, injuryLogs), [acuteLoad, injuryLogs]);

    // Durability & Readiness Calculation
    const durabilityScore = useMemo(() => {
        // Durability = 100 - (InjurySeverity * Multiplier) - (OverloadPenalty)
        // This is a "Resilience" score. 
        const totalLoad = Object.values(acuteLoad).reduce((a, b) => a + b.load, 0) || 0;

        // 1. Injury Penalty
        const injuryPenalty = injuryLogs
            .filter(l => l.status === 'active' || l.status === 'recovering')
            .reduce((acc, log) => acc + (log.severity * 8), 0);

        // 2. Load Balance (Bonus for consistent training, Penalty for zero or extreme)
        let loadScore = 0;
        if (totalLoad > 50 && totalLoad < 300) loadScore = 10; // Sweet spot
        if (totalLoad === 0) loadScore = -10; // Inactive

        let score = 90 - injuryPenalty + loadScore;
        return Math.max(0, Math.min(100, Math.round(score)));
    }, [acuteLoad, injuryLogs]);

    const readinessColor = durabilityScore > 80 ? 'text-emerald-400' : durabilityScore > 50 ? 'text-amber-400' : 'text-rose-400';
    const durabilityLabel = durabilityScore > 90 ? 'Oskadlig' : durabilityScore > 75 ? 'Hållbar' : durabilityScore > 50 ? 'Sliten' : 'Skadebenägen';

    // Smart Suggestions Logic
    const suggestedRoutines = useMemo(() => {
        const relevant = new Set<string>();
        activeInjuries.forEach(injury => {
            REHAB_ROUTINES.filter(r => r.tags.includes(injury.bodyPart)).forEach(r => relevant.add(r.id));
        });
        risks.forEach(risk => {
            REHAB_ROUTINES.filter(r => r.tags.includes(risk.part)).forEach(r => relevant.add(r.id));
        });
        return REHAB_ROUTINES.filter(r => relevant.has(r.id));
    }, [activeInjuries, risks]);

    const displayRoutines = suggestedRoutines.length > 0 ? suggestedRoutines : REHAB_ROUTINES.slice(0, 2);

    const handleBodyPartClick = (part: BodyPart) => {
        const existing = activeInjuries.find(l => l.bodyPart === part);
        setEditingLog(existing);
        setSelectedPart(part);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24">
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-3xl">🩹</span>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Recovery & Injury Hub</h1>
                </div>
                <p className="text-slate-400 max-w-2xl">
                    Hantera återhämtning, logga skadekänningar och få rehab-förslag.
                    Din kropp är ditt viktigaste verktyg.
                </p>
            </header>

            {/* Risk Warnings */}
            {risks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-4">
                    {risks.map((risk, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 ${risk.level === 'critical' ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' :
                                risk.level === 'high' ? 'bg-orange-500/10 border-orange-500/30 text-orange-200' :
                                    'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            }`}>
                            <span className="text-2xl mt-0.5">{risk.level === 'critical' ? '🛑' : '⚠️'}</span>
                            <div>
                                <h3 className="font-bold text-white text-sm uppercase tracking-wide">{risk.part.replace('_', ' ')} Warning</h3>
                                <p className="text-sm font-medium leading-tight mt-1">{risk.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN: Stats & Body Map */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Stats / Durability Card */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Hållbarhet</h2>
                        <div className="flex items-center justify-center py-4">
                            <div className="text-center">
                                <span className={`text-6xl font-black ${readinessColor} tracking-tighter`}>{durabilityScore}%</span>
                                <p className={`text-sm mt-2 font-bold uppercase ${readinessColor} opacity-80`}>{durabilityLabel}</p>
                            </div>
                        </div>
                        {/* Load Summary */}
                        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-center">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Acute Load</span>
                                <span className="text-lg font-mono font-bold text-white">{Object.values(acuteLoad).reduce((a, b) => a + b.load, 0)}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Riskzoner</span>
                                <span className="text-lg font-mono font-bold text-rose-400">{risks.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Body Map */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex justify-center sticky top-24">
                        <InteractiveBodyMap
                            injuryLogs={injuryLogs}
                            acuteLoad={acuteLoad}
                            onBodyPartClick={handleBodyPartClick}
                        />
                    </div>
                </div>

                {/* RIGHT COLUMN: Active Issues & Smart Physio */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Active Issues List */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Aktiva Känningar</h2>
                            <span className="text-xs text-slate-500 font-bold uppercase">Klicka på kartan för att logga</span>
                        </div>

                        {activeInjuries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-4 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                                <span className="text-2xl mb-2 opacity-50">🛡️</span>
                                <p className="font-medium text-sm">Inga aktiva skador loggade.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeInjuries.map(log => (
                                    <div
                                        key={log.id}
                                        onClick={() => { setSelectedPart(log.bodyPart); setEditingLog(log); }}
                                        className="cursor-pointer group flex items-start gap-4 p-4 bg-slate-950/80 hover:bg-slate-900 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-all shadow-sm"
                                    >
                                        <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${log.severity > 7 ? 'bg-rose-500 animate-pulse' : log.severity > 4 ? 'bg-orange-500' : 'bg-amber-400'}`} />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-white capitalize text-lg leading-tight mb-1">
                                                    {log.bodyPart.replace('_', ' ')}
                                                </h3>
                                                <span className={`text-xs font-black px-2 py-0.5 rounded uppercase ${log.severity > 6 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                    Nivå {log.severity}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-2">
                                                {log.type} • {log.side}
                                            </p>
                                            {log.notes && (
                                                <p className="text-sm text-slate-300 line-clamp-2 italic">"{log.notes}"</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Physio AI - Suggested Routines */}
                    <div className="bg-gradient-to-br from-slate-900/80 to-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
                        <header className="mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                🧠 AI Fysio <span className="text-indigo-400 text-xs px-2 py-0.5 bg-indigo-500/10 rounded uppercase tracking-wider">BETA</span>
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">
                                {suggestedRoutines.length > 0
                                    ? "Rekommenderade rutiner baserat på din status och träning."
                                    : "Förebyggande rutiner för allmän hållbarhet."}
                            </p>
                        </header>

                        <div className="space-y-4">
                            {displayRoutines.map(routine => (
                                <RehabRoutineCard key={routine.id} routine={routine} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal for Logging */}
            {selectedPart && (
                <InjuryLogModal
                    bodyPart={selectedPart}
                    existingLog={editingLog}
                    onClose={() => { setSelectedPart(null); setEditingLog(undefined); }}
                />
            )}
        </div>
    );
}
