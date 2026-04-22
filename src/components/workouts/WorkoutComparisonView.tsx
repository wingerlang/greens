import React, { useMemo, useState } from 'react';
import { WorkoutDefinition } from '../../models/workout.ts';
import { useData } from '../../context/DataContext.tsx';
import { ExerciseEntry, StrengthSession } from '../../models/types.ts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Search, ArrowLeft } from 'lucide-react';

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
    const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

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
        if (!pace || isNaN(pace)) return "-";
        const mins = Math.floor(pace);
        const secs = Math.round((pace - mins) * 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // SEARCH RESULTS
    const searchResults = useMemo(() => {
        if (!searchQuery) return null;
        const q = searchQuery.toLowerCase();
        
        if (signature.type === 'RUNNING') {
            return exerciseEntries
                .filter(e => e.type === 'running' && (
                    (e.title && e.title.toLowerCase().includes(q)) ||
                    e.date.includes(q)
                ))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map(e => ({
                    id: e.id,
                    date: e.date,
                    type: 'SEARCH' as MatchType,
                    score: 1,
                    data: e,
                    details: `${e.distance?.toFixed(1) || 0} km`,
                    pace: e.distance ? e.durationMinutes / e.distance : 0,
                    diffs: {}
                } as MatchItem));
        } else {
            return strengthSessions
                .filter(s => (
                    (s.title && s.title.toLowerCase().includes(q)) ||
                    s.date.includes(q)
                ))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map(s => ({
                    id: s.id,
                    date: s.date,
                    type: 'SEARCH' as MatchType,
                    score: 1,
                    data: s,
                    details: `${s.exercises.length} övningar`,
                    diffs: {}
                } as MatchItem));
        }
    }, [searchQuery, exerciseEntries, strengthSessions, signature.type]);

    const renderBadge = (type: MatchType | 'SEARCH') => {
        switch (type) {
            case 'EXACT': return <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-emerald-500/20">Perfekt</span>;
            case 'SUBSET': return <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-blue-500/20">Delmängd</span>;
            case 'SUPERSET': return <span className="bg-purple-500/20 text-purple-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-purple-500/20">Utökad</span>;
            case 'SIMILAR_DIST': return <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-indigo-500/20">Liknande</span>;
            case 'SEARCH': return <span className="bg-amber-500/20 text-amber-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-amber-500/20">Sökresultat</span>;
            default: return <span className="bg-slate-500/20 text-slate-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-slate-500/20">Match</span>;
        }
    };

    const ComparisonRow = ({ label, a, b, unit, isText = false }: { label: string, a: any, b: any, unit: string, isText?: boolean }) => (
        <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-4 py-3 border-b border-white/5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <div className="text-center font-mono font-bold text-indigo-400 bg-indigo-500/10 py-1 rounded-lg">
                {isText ? a : Number(a).toFixed(1)} <span className="text-[10px] text-indigo-500/50">{unit}</span>
            </div>
            <div className="text-center font-mono font-bold text-slate-300 bg-slate-900/50 py-1 rounded-lg">
                {isText ? b : Number(b).toFixed(1)} <span className="text-[10px] text-slate-600">{unit}</span>
            </div>
        </div>
    );

    if (selectedMatch) {
        const isRun = signature.type === 'RUNNING';
        const past = selectedMatch.data as ExerciseEntry;
        
        return (
            <div className="flex flex-col h-full bg-[#080815] animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-slate-900/50">
                    <button onClick={() => setSelectedMatch(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-black text-white tracking-widest uppercase">Jämförelse</h3>
                        <span className="text-[10px] text-slate-500 font-bold">Dagens pass vs {past.date}</span>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* Headers */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="flex flex-col text-center p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Dagens Plan</span>
                            <span className="text-lg font-black text-white leading-tight">{workout.title || "Pass"}</span>
                        </div>
                        <div className="flex flex-col text-center p-5 bg-slate-900 border border-white/5 rounded-3xl">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{past.date}</span>
                            <span className="text-lg font-black text-white leading-tight">{past.title || "Tidigare Pass"}</span>
                        </div>
                    </div>
                    
                    {/* Metrics */}
                    {isRun && (
                        <div className="space-y-1">
                            <ComparisonRow label="Distans" a={(signature as any).distance} b={past.distance} unit="km" />
                            <ComparisonRow label="Tid" a={(signature as any).duration} b={past.durationMinutes} unit="min" />
                            <ComparisonRow label="Tempo" a={formatPace((signature as any).pace)} b={formatPace(selectedMatch.pace!)} unit="/km" isText />
                            <ComparisonRow label="Snittpuls" a={"-"} b={past.averageHeartRate || '-'} unit="bpm" isText />
                            <ComparisonRow label="Maxpuls" a={"-"} b={past.maxHeartRate || '-'} unit="bpm" isText />
                        </div>
                    )}
                    
                    {!isRun && (
                        <div className="space-y-1">
                            <ComparisonRow label="Övningar" a={(signature as any).exercises.size} b={(past as any).exercises?.length || 0} unit="st" />
                            {/* Strength specifics could go here */}
                        </div>
                    )}
                </div>
            </div>
        );
    }

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
            <div className="p-4 border-b border-white/5 bg-slate-900/30">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Sök pass (t.ex. tävling eller 2024)..."
                        className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    />
                </div>
            </div>

            {/* SEARCH RESULTS OR TREND CHART */}
            {searchResults ? (
                <div className="p-6 border-b border-white/5 bg-slate-900/10">
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Sökresultat</h4>
                    <div className="space-y-3">
                        {searchResults.length === 0 && <span className="text-slate-500 text-xs font-bold">Inga träffar.</span>}
                        {searchResults.map(m => (
                            <div key={m.id} onClick={() => setSelectedMatch(m)} className="flex items-center justify-between bg-slate-900/40 border border-white/5 p-3 rounded-xl hover:border-amber-500/40 transition-all cursor-pointer">
                                <div className="flex flex-col">
                                    <span className="font-bold text-white text-sm">{(m.data as any).title || "Pass"}</span>
                                    <span className="text-[9px] text-slate-500 font-bold">{m.date}</span>
                                </div>
                                {renderBadge(m.type)}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                signature.type === 'RUNNING' && trendData.length > 1 && (
                    <div className="p-6 border-b border-white/5 bg-slate-900/10">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Trend (Tempo över tid)</h4>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="datum" hide />
                                    <YAxis reversed domain={['auto', 'auto']} hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} formatter={(val: number) => [formatPace(val), 'Tempo']} />
                                    <ReferenceLine y={signature.pace} stroke="#6366f1" strokeDasharray="3 3" label={{ position: 'right', value: 'Mål', fill: '#6366f1', fontSize: 10 }} />
                                    <Line type="monotone" dataKey="tempo" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )
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
                    <div key={m.id} onClick={() => setSelectedMatch(m)} className="relative bg-slate-900/40 border border-white/5 p-5 rounded-3xl hover:border-indigo-500/40 transition-all group cursor-pointer overflow-hidden backdrop-blur-sm">
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

