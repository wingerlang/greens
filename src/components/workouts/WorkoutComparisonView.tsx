import React, { useMemo } from 'react';
import { WorkoutDefinition } from '../../models/workout.ts';
import { useData } from '../../context/DataContext.tsx';
import { ExerciseEntry, StrengthSession } from '../../models/types.ts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
    workout: WorkoutDefinition;
}

type MatchType = 'EXACT' | 'SUBSET' | 'SUPERSET' | 'OVERLAP' | 'SIMILAR_DIST';

interface MatchItem {
    id: string;
    date: string;
    type: MatchType;
    score: number; // 0-1, 1 is best
    data: ExerciseEntry | StrengthSession;
    details: string;
    diffs: {
        distance?: number;
        pace?: number;
        duration?: number;
    };
    pace?: number; // min/km
}

export function WorkoutComparisonView({ workout }: Props) {
    const { exerciseEntries, strengthSessions } = useData();

    // 1. EXTRACT WORKOUT SIGNATURE
    const signature = useMemo(() => {
        const isRun = workout.category === 'RUNNING';

        if (isRun) {
            let distance = 0;
            workout.exercises?.forEach(s => s.exercises.forEach(e => {
                if (typeof e.reps === 'string' && e.reps.includes('km')) {
                    distance += parseFloat(e.reps);
                }
            }));

            if (distance === 0) {
                const match = workout.title.match(/(\d+(?:,\d+|\.\d+)?)\s*km/i);
                if (match) distance = parseFloat(match[1].replace(',', '.'));
            }

            const duration = workout.durationMin || 60;
            const pace = distance > 0 ? duration / distance : 0;

            return { type: 'RUNNING', distance: distance || 5, duration, pace };
        } else {
            const exercises = new Set<string>();
            workout.exercises?.forEach(s => s.exercises.forEach(e => {
                if (e.name) exercises.add(e.name.toLowerCase().trim());
            }));
            return { type: 'STRENGTH', exercises };
        }
    }, [workout]);

    // 2. FIND MATCHES & CALCULATE DIFFS
    const matches = useMemo(() => {
        const results: MatchItem[] = [];

        if (signature.type === 'RUNNING') {
            const targetDist = signature.distance as number;
            const targetPace = signature.pace as number;
            const targetDuration = signature.duration as number;

            // Range: +/- 15% distance for "similar"
            const min = targetDist * 0.85;
            const max = targetDist * 1.15;

            exerciseEntries
                .filter(e => e.type === 'running' && e.distance)
                .forEach(e => {
                    const dist = e.distance!;
                    if (dist >= min && dist <= max) {
                        const pace = e.durationMinutes / dist;
                        const diffDist = dist - targetDist;
                        const diffPace = pace - targetPace;
                        const diffDur = e.durationMinutes - targetDuration;

                        // Ranking score (very subjective)
                        const distScore = 1 - (Math.abs(diffDist) / targetDist);
                        const paceScore = 1 - Math.min(1, Math.abs(diffPace) / targetPace);
                        const score = (distScore * 0.7) + (paceScore * 0.3);

                        results.push({
                            id: e.id,
                            date: e.date,
                            type: Math.abs(diffDist) < 0.1 ? 'EXACT' : 'SIMILAR_DIST',
                            score,
                            data: e,
                            details: `${dist.toFixed(1)} km`,
                            pace,
                            diffs: {
                                distance: diffDist,
                                pace: diffPace,
                                duration: diffDur
                            }
                        });
                    }
                });

        } else if (signature.type === 'STRENGTH') {
            const targetExercises = signature.exercises as Set<string>;
            const targetCount = targetExercises.size;
            if (targetCount === 0) return [];

            const checkMatch = (historyExercises: string[], item: ExerciseEntry | StrengthSession) => {
                const historySet = new Set(historyExercises.map(n => n.toLowerCase().trim()));
                const intersection = new Set([...targetExercises].filter(x => historySet.has(x)));
                const overlapCount = intersection.size;
                if (overlapCount === 0) return;

                const historyCount = historySet.size;
                let type: MatchType = 'OVERLAP';
                if (overlapCount === targetCount && historyCount === targetCount) type = 'EXACT';
                else if (overlapCount === targetCount && historyCount > targetCount) type = 'SUPERSET';
                else if (overlapCount === historyCount && targetCount > historyCount) type = 'SUBSET';

                const union = new Set([...targetExercises, ...historySet]);
                const score = overlapCount / union.size;

                if (score > 0.15 || overlapCount >= 2) {
                    results.push({
                        id: item.id,
                        date: item.date,
                        type,
                        score,
                        data: item,
                        details: `${overlapCount} av ${targetCount} övningar`,
                        diffs: {},
                    });
                }
            };

            strengthSessions.forEach(s => {
                const names = s.exercises.map(e => e.name);
                checkMatch(names, s);
            });
        }

        // Sort by Score Descending, then Date
        return results.sort((a, b) => (b.score - a.score) || new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [signature, exerciseEntries, strengthSessions]);

    // 3. TREND DATA (Top 10 matches by date)
    const trendData = useMemo(() => {
        if (signature.type !== 'RUNNING') return [];
        return [...matches]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-10)
            .map(m => ({
                datum: m.date.slice(5), // Short date
                tempo: m.pace,
                distans: (m.data as ExerciseEntry).distance,
                fullDate: m.date
            }));
    }, [matches, signature.type]);

    const formatPace = (pace: number) => {
        const mins = Math.floor(pace);
        const secs = Math.round((pace - mins) * 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const renderBadge = (type: MatchType) => {
        switch (type) {
            case 'EXACT': return <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-emerald-500/20">Perfekt</span>;
            case 'SUBSET': return <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-blue-500/20">Delmängd</span>;
            case 'SUPERSET': return <span className="bg-purple-500/20 text-purple-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-purple-500/20">Utökad</span>;
            case 'SIMILAR_DIST': return <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-indigo-500/20">Liknande</span>;
            default: return <span className="bg-slate-500/20 text-slate-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-slate-500/20">Match</span>;
        }
    };

    if (matches.length === 0) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-slate-900/10 mx-6 mt-6">
                <p className="text-slate-500 font-bold text-sm mb-2">Inga matchande pass hittades.</p>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest font-black opacity-50">
                    {signature.type === 'RUNNING' ? `Söker efter pass kring ${(signature as any).distance.toFixed(1)} km` : `Söker pass med liknande övningar`}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#080815]">
            {/* TREND CHART */}
            {signature.type === 'RUNNING' && trendData.length > 1 && (
                <div className="p-6 border-b border-white/5 bg-slate-900/10">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Trend (Tempo över tid)</h4>
                    <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="datum" hide />
                                <YAxis
                                    reversed
                                    domain={['auto', 'auto']}
                                    hide
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                                    formatter={(val: number) => [formatPace(val), 'Tempo']}
                                />
                                <ReferenceLine y={signature.pace} stroke="#6366f1" strokeDasharray="3 3" label={{ position: 'right', value: 'Mål', fill: '#6366f1', fontSize: 10 }} />
                                <Line type="monotone" dataKey="tempo" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* MATCH LIST */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Matchade Pass ({matches.length})</h3>
                    <div className="text-xs font-mono text-slate-600">
                        {signature.type === 'RUNNING' ? `${((signature as any).distance as number).toFixed(1)} km @ ${formatPace((signature as any).pace as number)}` : `${((signature as any).exercises as Set<string>).size} övningar`}
                    </div>
                </div>

                {matches.map(m => (
                    <div key={m.id} className="relative bg-slate-900/40 border border-white/5 p-5 rounded-3xl hover:border-indigo-500/40 transition-all group cursor-pointer overflow-hidden backdrop-blur-sm">
                        {/* SCORE INDICATOR */}
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500/20 group-hover:bg-indigo-500 transition-all" style={{ opacity: m.score }} />

                        <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col">
                                <span className="font-black text-white text-md tracking-tight leading-tight">
                                    {(m.data as any).title || "Löppass"}
                                </span>
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{m.date}</span>
                            </div>
                            {renderBadge(m.type)}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4 py-3 border-t border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Resultat</span>
                                <div className="text-sm font-black text-white">
                                    {m.details}
                                    {m.pace && <span className="text-indigo-400 ml-2">({formatPace(m.pace)})</span>}
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Diff vs Mål</span>
                                <div className={`text-sm font-black ${m.diffs.pace && m.diffs.pace < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {m.diffs.pace ? `${m.diffs.pace < 0 ? '-' : '+'}${formatPace(Math.abs(m.diffs.pace))}/km` : "-"}
                                </div>
                            </div>
                        </div>

                        {/* RANKING BAR */}
                        <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000" style={{ width: `${m.score * 100}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

