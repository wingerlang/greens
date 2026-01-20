import React, { useMemo, useState, useEffect } from 'react';
import { StrengthWorkout, PersonalBest, normalizeExerciseName } from '../../models/strengthTypes.ts';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area
} from 'recharts';
import { PRTimeline } from './PRTimeline';

interface PRResearchCenterProps {
    workouts: StrengthWorkout[];
    personalBests: PersonalBest[];
    onClose: () => void;
    onSelectWorkout?: (workout: StrengthWorkout) => void;
    inline?: boolean;
}

export function PRResearchCenter({ workouts, personalBests, onClose, onSelectWorkout, inline }: PRResearchCenterProps) {
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [isWeightPRMode, setIsWeightPRMode] = useState(false);

    // ESC to close - only if not inline
    useEffect(() => {
        if (inline) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, inline]);

    const allExerciseNames = useMemo(() => {
        const names = Array.from(new Set(personalBests.map(pb => pb.exerciseName)));
        return names.sort();
    }, [personalBests]);

    // --- GLOBAL ANALYTICAL TITAN ---
    const globalAnalysis = useMemo(() => {
        if (!workouts.length || !personalBests.length) return null;

        const sortedPBs = [...personalBests].sort((a, b) => a.date.localeCompare(b.date));
        const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

        // 1. Core Metrics
        let maxDrought = 0;
        let maxDroughtRange: [string, string] | null = null;
        for (let i = 1; i < sortedPBs.length; i++) {
            const diff = (new Date(sortedPBs[i].date).getTime() - new Date(sortedPBs[i - 1].date).getTime()) / (1000 * 3600 * 24);
            if (diff > maxDrought) {
                maxDrought = diff;
                maxDroughtRange = [sortedPBs[i - 1].date, sortedPBs[i].date];
            }
        }

        const prWorkoutIds = new Set(personalBests.map(pb => pb.workoutId));
        const prWorkoutIndices = sortedWorkouts.reduce((acc, w, idx) => {
            if (prWorkoutIds.has(w.id)) acc.push(idx);
            return acc;
        }, [] as number[]);

        let totalInterval = 0;
        let intervalCount = 0;
        for (let i = 1; i < prWorkoutIndices.length; i++) {
            totalInterval += (prWorkoutIndices[i] - prWorkoutIndices[i - 1]);
            intervalCount++;
        }

        // --- NORMALIZED CO-OCCURRENCE (Unique PR Weeks) ---
        const prWeeksMap = new Map<string, Set<string>>(); // week -> set of exercise names
        personalBests.forEach(pb => {
            const d = new Date(pb.date);
            const week = `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
            if (!prWeeksMap.has(week)) prWeeksMap.set(week, new Set());
            prWeeksMap.get(week)?.add(normalizeExerciseName(pb.exerciseName));
        });

        const totalPRWeeks = prWeeksMap.size;
        const synergyMap: Record<string, number> = {};
        const coExMap: Record<string, Set<string>> = {}; // exName -> set of weeks it appears in PR windows

        personalBests.forEach(pb => {
            const prDate = new Date(pb.date);
            const weekStart = new Date(prDate.getTime() - 7 * 24 * 3600000);
            const weekWorkouts = workouts.filter(w => new Date(w.date) >= weekStart && new Date(w.date) <= prDate);

            weekWorkouts.forEach(w => {
                const weekKey = `${new Date(w.date).getFullYear()}-W${Math.ceil(new Date(w.date).getDate() / 7)}`;
                w.exercises.forEach(ex => {
                    const normEx = normalizeExerciseName(ex.exerciseName);
                    if (normEx !== normalizeExerciseName(pb.exerciseName)) {
                        if (!coExMap[ex.exerciseName]) coExMap[ex.exerciseName] = new Set();
                        coExMap[ex.exerciseName].add(weekKey);
                    }
                });
            });
        });

        const topCoOccurrence = Object.entries(coExMap)
            .map(([name, weeks]) => ({
                name,
                count: weeks.size,
                pct: (weeks.size / (totalPRWeeks || 1)) * 100
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 2. Volume Wave
        const waveAnalysis = personalBests.map(pb => {
            const prDate = new Date(pb.date);
            const last14dVol = workouts.filter(w => {
                const d = new Date(w.date);
                return d >= new Date(prDate.getTime() - 14 * 24 * 3600000) && d < prDate;
            }).reduce((sum, w) => sum + w.totalVolume, 0) / 2;
            const last90dVol = workouts.filter(w => {
                const d = new Date(w.date);
                return d >= new Date(prDate.getTime() - 90 * 24 * 3600000) && d < prDate;
            }).reduce((sum, w) => sum + w.totalVolume, 0) / (90 / 7);
            return last14dVol > last90dVol * 1.1 ? 'spike' : (last14dVol < last90dVol * 0.9 ? 'deload' : 'linear');
        });

        const lastPRDate = sortedPBs[sortedPBs.length - 1].date;
        const daysSinceLastPR = Math.floor((new Date().getTime() - new Date(lastPRDate).getTime()) / (1000 * 3600 * 24));

        // 3. Top Sessions
        const prCountPerWorkout: Record<string, { count: number, name: string, date: string, id: string }> = {};
        personalBests.forEach(pb => {
            if (!prCountPerWorkout[pb.workoutId]) {
                prCountPerWorkout[pb.workoutId] = { count: 0, name: pb.workoutName || 'Pass', date: pb.date, id: pb.workoutId };
            }
            prCountPerWorkout[pb.workoutId].count++;
        });
        const topSessions = Object.values(prCountPerWorkout).sort((a, b) => b.count - a.count).slice(0, 4);

        // 4. Global Progress Timeline (simplified)
        const prDataMap: Record<string, number> = {};
        sortedPBs.forEach(pb => {
            const week = pb.date.substring(0, 7); // YYYY-MM
            prDataMap[week] = (prDataMap[week] || 0) + 1;
        });
        const weeklyPRData = Object.entries(prDataMap).map(([name, count]) => ({ name, count })).slice(-12);

        // 5. Styrkeökning (Topplista)
        const hierarchyMap: Record<string, { name: string, gain: number, current: number, start: number }> = {};
        personalBests.forEach(pb => {
            const norm = normalizeExerciseName(pb.exerciseName);
            if (!hierarchyMap[norm]) {
                const allForEx = personalBests.filter(p => normalizeExerciseName(p.exerciseName) === norm).sort((a, b) => a.date.localeCompare(b.date));
                if (allForEx.length > 1) {
                    const start = allForEx[0].value;
                    const end = allForEx[allForEx.length - 1].value;
                    const gain = start > 0 ? ((end - start) / start) * 100 : 0;
                    hierarchyMap[norm] = { name: pb.exerciseName, gain, current: end, start };
                }
            }
        });
        const recordHierarchy = Object.values(hierarchyMap).sort((a, b) => b.gain - a.gain).slice(0, 5);

        // 6. Strength Archetype (Rep distribution)
        const archetype = { low: 0, mid: 0, high: 0 };
        personalBests.forEach(pb => {
            if (pb.reps === undefined) return;
            if (pb.reps <= 3) archetype.low++;
            else if (pb.reps <= 8) archetype.mid++;
            else archetype.high++;
        });

        return {
            simple: {
                maxDrought: Math.round(maxDrought),
                maxDroughtRange,
                avgInterval: intervalCount > 0 ? (totalInterval / intervalCount).toFixed(1) : '3.2',
                frequency: (workouts.length / (sortedWorkouts.length > 0 ? (new Date(sortedWorkouts[sortedWorkouts.length - 1].date).getTime() - new Date(sortedWorkouts[0].date).getTime()) / (7 * 24 * 3600000) : 1)).toFixed(1),
                daysSinceLastPR
            },
            waveStats: {
                spike: (waveAnalysis.filter(w => w === 'spike').length / (waveAnalysis.length || 1)) * 100,
                deload: (waveAnalysis.filter(w => w === 'deload').length / (waveAnalysis.length || 1)) * 100,
                linear: (waveAnalysis.filter(w => w === 'linear').length / (waveAnalysis.length || 1)) * 100,
            },
            surgeProbability: ((personalBests.filter(pb => {
                const d = new Date(pb.date);
                return personalBests.some(p => p.id !== pb.id && new Date(p.date) > d && new Date(p.date) <= new Date(d.getTime() + 7 * 24 * 3600000));
            }).length / personalBests.length) * 100).toFixed(1),
            topCoOccurrence,
            topSessions,
            weeklyPRData,
            recordHierarchy,
            archetype
        };
    }, [workouts, personalBests]);

    // --- EXERCISE ANALYSIS ---
    const exerciseAnalysis = useMemo(() => {
        if (!selectedExercise) return null;
        const eName = selectedExercise;
        const normalizedEName = normalizeExerciseName(eName);

        const ePRsAll = personalBests
            .filter(pb => normalizeExerciseName(pb.exerciseName) === normalizedEName)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.orderIndex || 0) - (b.orderIndex || 0));

        // Interstitial Volume with Session Stat fallback
        const historyWithVolume = ePRsAll.map((pb, idx) => {
            const prevPb = ePRsAll[idx - 1];
            let sets = 0, reps = 0, tonnage = 0;
            let isSessionStat = false;

            if (!prevPb || (prevPb.workoutId === pb.workoutId && idx === 0)) {
                // First PR EVER or first in list - use current session stats
                const workout = workouts.find(w => w.id === pb.workoutId);
                const ex = workout?.exercises.find(e => normalizeExerciseName(e.exerciseName) === normalizedEName);
                if (ex) {
                    ex.sets.forEach(s => { sets++; reps += s.reps; tonnage += (s.weight * s.reps); });
                    isSessionStat = true;
                }
            } else if (prevPb.workoutId === pb.workoutId) {
                // Same-session multiple PRs - sets BETWEEN them
                const workout = workouts.find(w => w.id === pb.workoutId);
                const ex = workout?.exercises.find(e => normalizeExerciseName(e.exerciseName) === normalizedEName);
                if (ex) {
                    const pi = ex.sets.findIndex(s => s.weight === prevPb.weight && s.reps === prevPb.reps);
                    const ci = ex.sets.findIndex(s => s.weight === pb.weight && s.reps === pb.reps);
                    for (let i = pi + 1; i < ci; i++) {
                        sets++; reps += ex.sets[i].reps; tonnage += (ex.sets[i].weight * ex.sets[i].reps);
                    }
                    if (sets === 0) { // Fallback if no sets between (e.g. back to back sets)
                        ex.sets.forEach(s => { sets++; reps += s.reps; tonnage += (s.weight * s.reps); });
                        isSessionStat = true;
                    }
                }
            } else {
                // Different workouts
                workouts.filter(w => w.date >= prevPb.date && w.date <= pb.date).forEach(w => {
                    const ex = w.exercises.find(e => normalizeExerciseName(e.exerciseName) === normalizedEName);
                    if (ex) {
                        ex.sets.forEach((s, si) => {
                            const isP = w.id === prevPb.workoutId && si <= ex.sets.findIndex(p => p.weight === prevPb.weight && p.reps === prevPb.reps);
                            const isC = w.id === pb.workoutId && si >= ex.sets.findIndex(c => c.weight === pb.weight && c.reps === pb.reps);
                            if (!isP && !isC) { sets++; reps += s.reps; tonnage += (s.weight * s.reps); }
                        });
                    }
                });
            }

            return { ...pb, interstitial: { sets, reps, tonnage: Math.round(tonnage), isSessionStat } };
        });

        const displayHistory = isWeightPRMode ? historyWithVolume.filter(pb => pb.isHighestWeight) : historyWithVolume;

        // Preparation Profile
        const prDates = new Set(ePRsAll.map(p => p.date));
        const prepWorkouts: StrengthWorkout[] = [];
        const baselineWorkouts: StrengthWorkout[] = [];
        workouts.forEach(w => {
            if (!w.exercises.some(e => normalizeExerciseName(e.exerciseName) === normalizedEName)) return;
            const isPrep = Array.from(prDates).some(d => Math.abs((new Date(d).getTime() - new Date(w.date).getTime()) / (1000 * 3600 * 24)) <= 14);
            if (isPrep) prepWorkouts.push(w); else baselineWorkouts.push(w);
        });

        const getHabit = (s: StrengthWorkout[]) => {
            let ts = 0, tr = 0, tk = 0, c = 0;
            s.forEach(w => {
                const ex = w.exercises.find(e => normalizeExerciseName(e.exerciseName) === normalizedEName);
                if (ex) { c++; ex.sets.forEach(x => { ts++; tr += x.reps; tk += x.weight; }); }
            });
            return { sets: c > 0 ? (ts / c).toFixed(1) : '0', reps: ts > 0 ? (tr / ts).toFixed(1) : '0', kg: ts > 0 ? (tk / ts).toFixed(0) : '0' };
        };

        const chartData = ePRsAll.map(pb => ({ date: pb.date, e1rm: pb.value, weight: pb.weight }));

        return {
            history: displayHistory,
            prepProfile: { prep: getHabit(prepWorkouts), baseline: getHabit(baselineWorkouts) },
            daysSince: Math.floor((new Date().getTime() - new Date(ePRsAll[ePRsAll.length - 1].date).getTime()) / (1000 * 3600 * 24)),
            chartData,
            gain: ePRsAll.length > 1 ? (((ePRsAll[ePRsAll.length - 1].value - ePRsAll[0].value) / ePRsAll[0].value) * 100).toFixed(1) : '0'
        };
    }, [selectedExercise, isWeightPRMode, workouts, personalBests]);

    return (
        <div className={`flex flex-col md:flex-row overflow-hidden text-slate-200 ${inline
            ? 'h-[800px] bg-slate-900 border border-white/5 rounded-2xl shadow-2xl'
            : 'fixed inset-0 z-50 bg-slate-950 h-screen'
            }`}>
            {/* Sidebar - Wider for text */}
            <div className={`w-full md:w-72 border-r border-white/5 flex flex-col h-full shrink-0 ${inline ? 'bg-slate-900/50' : 'bg-slate-900'
                }`}>
                <div className={`p-3 border-b border-white/5 ${inline ? 'bg-slate-900/30' : 'bg-slate-900'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-lg text-sm">⚛️</div>
                            <h1 className="text-[10px] font-black text-white tracking-wider uppercase">PR-Lab</h1>
                        </div>
                        {!inline && (
                            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-red-600 flex items-center justify-center text-slate-500 hover:text-white transition-all text-xs" title="Stäng (ESC)">✕</button>
                        )}
                    </div>
                    <button
                        onClick={() => setSelectedExercise(null)}
                        className={`w-full text-left px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-3 ${!selectedExercise ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <span>📊</span> Overview
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    <p className="text-[9px] text-slate-600 font-black uppercase px-2 mb-3 tracking-widest">Exercise Research</p>
                    {allExerciseNames.map(name => (
                        <button
                            key={name}
                            onClick={() => setSelectedExercise(name)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all truncate border ${selectedExercise === name ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/5'}`}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                {!inline && (
                    <div className="p-3 border-t border-white/5 bg-slate-900">
                        <p className="text-[8px] text-slate-600 text-center">Tryck ESC för att stänga</p>
                    </div>
                )}
            </div>

            {/* Main Content - Data Dense */}
            <div className="flex-1 overflow-y-auto bg-slate-950 scroll-smooth">
                {!selectedExercise ? (
                    // --- GLOBAL ANALYTICS ---
                    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
                        <div className="flex justify-between items-center border-b border-white/10 pb-6">
                            <div>
                                <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">Global Analys</h2>
                                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1">Mönster och insikter från hela din träningshistorik</p>
                            </div>
                            <div className="text-right flex gap-4">
                                <div className="bg-white/5 px-3 py-2 rounded-2xl border border-white/5">
                                    <p className="text-[7px] text-emerald-500 font-extrabold uppercase mb-0.5">Last Peak</p>
                                    <p className="text-lg font-black text-white">{globalAnalysis?.simple.daysSinceLastPR} <span className="text-[7px] opacity-40 uppercase">dagar</span></p>
                                </div>
                                <div className="bg-white/5 px-3 py-2 rounded-2xl border border-white/5">
                                    <p className="text-[7px] text-blue-500 font-extrabold uppercase mb-0.5">Total PRs</p>
                                    <p className="text-lg font-black text-white">{personalBests.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Core Stats Row - Compact */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Stagnation Peak', val: globalAnalysis?.simple.maxDrought, sub: globalAnalysis?.simple.maxDroughtRange?.[0] + ' → ' + globalAnalysis?.simple.maxDroughtRange?.[1], suffix: 'd' },
                                { label: 'Mean Interval', val: globalAnalysis?.simple.avgInterval, sub: 'Average sessions between record events', suffix: 'ses' },
                                { label: 'PR Density', val: globalAnalysis?.simple.frequency, sub: 'Observed sessions/week in success windows', suffix: 'ses/v' },
                                { label: 'Surge Probability', val: globalAnalysis?.surgeProbability, sub: 'Prob. of 2nd PR within 7 days of 1st', suffix: '%' }
                            ].map(s => (
                                <div key={s.label} className="bg-slate-900 border border-white/5 p-5 rounded-2xl">
                                    <p className="text-[8px] text-slate-500 font-black uppercase mb-3 tracking-widest leading-none">{s.label}</p>
                                    <div className="flex items-baseline gap-1 mb-2">
                                        <p className="text-3xl font-black text-white">{s.val}</p>
                                        <span className="text-[10px] text-slate-600 font-black uppercase italic">{s.suffix}</span>
                                    </div>
                                    <p className="text-[8px] text-slate-600 font-bold leading-tight uppercase tracking-tighter truncate">{s.sub}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Distribution Graph */}
                            <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-[2rem] p-6 space-y-6 shadow-2xl">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">PR-historik (Antal rekord per månad)</h3>
                                    <span className="text-[8px] text-slate-600 font-bold uppercase">Senaste 12 månaderna</span>
                                </div>
                                <div className="h-64 mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={globalAnalysis?.weeklyPRData}>
                                            <defs>
                                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <XAxis dataKey="name" hide />
                                            <YAxis hide />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                                itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <section className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 space-y-4 shadow-2xl overflow-hidden">
                                <div className="ml-2 border-b border-white/5 pb-2">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Sammanhang</h3>
                                    <p className="text-[7px] text-slate-600 font-bold uppercase mt-1 leading-tight">Sannolikhet för rekord i samma träningsfönster (vecka)</p>
                                </div>
                                <div className="space-y-2">
                                    {globalAnalysis?.topCoOccurrence.map(item => (
                                        <div key={item.name} className="flex flex-col p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-slate-300 uppercase truncate pr-4">{item.name}</span>
                                                <span className="text-[10px] font-black text-blue-500 tracking-tighter">{item.pct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1 bg-black rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-600" style={{ width: `${item.pct}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Titan Hierarchy & Archetype Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-slate-900 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] p-4 border-b border-white/5">Styrkeökning: Topplista (Delta)</h3>
                                <table className="w-full text-left">
                                    <tbody className="divide-y divide-white/5 text-[9px]">
                                        {globalAnalysis?.recordHierarchy.map(item => (
                                            <tr key={item.name} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-extrabold text-white uppercase tracking-tight">{item.name}</p>
                                                    <p className="text-[7px] text-slate-600 font-bold mt-0.5">Peak e1RM: {item.current}kg</p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-black text-emerald-500">+{item.gain.toFixed(1)}%</span>
                                                        <span className="text-[7px] text-slate-700 font-black uppercase">Aggregate Improvement</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-6 shadow-2xl">
                                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 border-b border-white/5 pb-2">Styrkeprofil (Rep-fördelning)</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: 'POWER (1-3 REPS)', val: globalAnalysis?.archetype.low, color: 'text-blue-500' },
                                        { label: 'STRENGTH (4-8 REPS)', val: globalAnalysis?.archetype.mid, color: 'text-amber-500' },
                                        { label: 'TITAN (9+ REPS)', val: globalAnalysis?.archetype.high, color: 'text-emerald-500' }
                                    ].map(arc => (
                                        <div key={arc.label} className="text-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                            <p className={`text-2xl font-black ${arc.color}`}>{arc.val}</p>
                                            <p className="text-[7px] text-slate-500 font-black uppercase mt-2 leading-tight">{arc.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 space-y-4">
                                    <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest text-center italic">Calculated across {personalBests.length} unique performance vectors</p>
                                    <div className="h-2 bg-black rounded-full overflow-hidden flex">
                                        {(() => {
                                            const total = (globalAnalysis?.archetype.low || 0) + (globalAnalysis?.archetype.mid || 0) + (globalAnalysis?.archetype.high || 0);
                                            return (
                                                <>
                                                    <div className="h-full bg-blue-600" style={{ width: `${((globalAnalysis?.archetype.low || 0) / total) * 100}%` }} />
                                                    <div className="h-full bg-amber-600" style={{ width: `${((globalAnalysis?.archetype.mid || 0) / total) * 100}%` }} />
                                                    <div className="h-full bg-emerald-600" style={{ width: `${((globalAnalysis?.archetype.high || 0) / total) * 100}%` }} />
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- EXERCISE DRILL-DOWN ---
                    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
                        {/* Header Header */}
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 border-b border-white/10 pb-10">
                            <div>
                                <p className="text-blue-500 font-black uppercase text-[8px] tracking-[0.4em] mb-3">Detaljerad Övningsanalys</p>
                                <h2 className="text-6xl font-black text-white tracking-tighter italic uppercase">{selectedExercise}</h2>
                                <div className="flex gap-4 mt-4">
                                    <span className="text-slate-500 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase">{exerciseAnalysis?.daysSince} DAGAR SEDAN SENASTE REKORD</span>
                                    <span className="text-emerald-500 bg-emerald-500/10 border border-emerald-500/10 px-4 py-1.5 rounded-full text-[9px] font-black uppercase">+{exerciseAnalysis?.gain}% TOTAL ÖKNING</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-slate-900 px-5 py-4 rounded-3xl border border-white/5 shadow-2xl">
                                <span className={`text-[9px] font-black uppercase transition-colors ${!isWeightPRMode ? 'text-amber-500' : 'text-slate-600'}`}>Teoretiskt Max (e1RM)</span>
                                <button onClick={() => setIsWeightPRMode(!isWeightPRMode)} className="w-12 h-6 bg-black rounded-full relative p-1 transition-all border border-white/10">
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-all shadow-md ${isWeightPRMode ? 'translate-x-6 bg-blue-500' : 'translate-x-0'}`} />
                                </button>
                                <span className={`text-[9px] font-black uppercase transition-colors ${isWeightPRMode ? 'text-blue-500' : 'text-slate-600'}`}>Enbart Vikt-PR</span>
                            </div>
                        </div>

                        {/* Progression Chart */}
                        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden group">
                            <div className="flex justify-between items-center px-4 relative z-10">
                                <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Temporal Strength Progression Timeline</h3>
                                <div className="flex gap-4 text-[8px] font-bold uppercase">
                                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> e1RM Vector</span>
                                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /> Raw Weight</span>
                                </div>
                            </div>
                            <div className="h-64 mt-4 relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={exerciseAnalysis?.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide domain={['auto', 'auto']} />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                            itemStyle={{ fontWeight: 'bold' }}
                                        />
                                        <Line type="monotone" dataKey="e1rm" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" dataKey="weight" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <section className="space-y-4">
                            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] pb-2 border-b border-white/5 italic">Preparation Correlation (Pre-Record Habits)</h3>
                            <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-2xl">
                                {[
                                    { label: 'PREP INTENSITY', key: 'kg', suffix: 'kg' },
                                    { label: 'PREP VOLUME', key: 'sets', suffix: ' sets' },
                                    { label: 'MECHANICAL DENSITY', key: 'reps', suffix: ' reps/set' }
                                ].map(m => {
                                    const prep = exerciseAnalysis?.prepProfile.prep[m.key as keyof typeof exerciseAnalysis.prepProfile.prep];
                                    const base = exerciseAnalysis?.prepProfile.baseline[m.key as keyof typeof exerciseAnalysis.prepProfile.baseline];
                                    const diff = parseFloat(prep || '0') - parseFloat(base || '0');
                                    return (
                                        <div key={m.label} className="bg-black/20 p-6 rounded-[2rem] border border-white/[0.03] hover:border-blue-500/20 transition-all">
                                            <p className="text-[8px] text-blue-500 font-extrabold uppercase mb-2 tracking-widest">{m.label}</p>
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <p className="text-3xl font-black text-white italic">{prep}{m.suffix.split(' ')[0]}</p>
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${diff >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                                                </span>
                                            </div>
                                            <div className="space-y-2 pt-4 border-t border-white/5 text-[9px] font-bold uppercase tracking-tighter">
                                                <div className="flex justify-between items-center bg-blue-500/5 p-2 rounded-lg">
                                                    <span className="text-blue-400">Preparation Windows (14d)</span>
                                                    <span className="text-white">{prep}{m.suffix}</span>
                                                </div>
                                                <div className="flex justify-between items-center p-2">
                                                    <span className="text-slate-600">Global Average Baseline</span>
                                                    <span className="text-slate-500">{base}{m.suffix}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Archive Table - Super Compact */}
                        <section className="space-y-6 pb-12">
                            <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Historiskt Belastningsarkiv {isWeightPRMode && "(ENBART VIKT-REKORD)"}</h3>
                                <div className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter italic">Totalt {exerciseAnalysis?.history.length} rekord noterade</div>
                            </div>
                            <div className="bg-slate-900 border border-white/5 rounded-[2rem] overflow-x-auto shadow-2xl backdrop-blur-xl">
                                <table className="w-full min-w-[700px] text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                            <th className="px-4 py-4">Date</th>
                                            <th className="px-4 py-4">Load Data</th>
                                            <th className="px-4 py-4 text-right">e1RM Output</th>
                                            <th className="px-4 py-4 text-right">Delta</th>
                                            <th className="px-4 py-4 text-right bg-black/20">Preparatory Fuel (Acc.)</th>
                                            <th className="px-4 py-4 text-center">Audit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[10px] divide-y divide-white/10">
                                        {[...exerciseAnalysis?.history || []].reverse().map((item, idx, arr) => {
                                            const prev = arr[idx + 1];
                                            const diff = prev ? item.value - prev.value : 0;
                                            const pct = prev ? (diff / prev.value) * 100 : 0;
                                            return (
                                                <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                                                    <td className="px-4 py-3">
                                                        <p className="font-black text-white text-base tracking-tighter mb-0.5">{item.date}</p>
                                                        <p className="text-[8px] text-slate-600 font-black uppercase truncate max-w-[140px] tracking-tight">{item.workoutName}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-extrabold text-slate-300 text-sm mb-1">{item.reps || 0} × {item.weight}kg</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            <span className="text-[7px] text-slate-700 font-extrabold uppercase border border-slate-800 px-1.5 py-0.5 rounded italic whitespace-nowrap">Rekord #{idx + 1}</span>
                                                            {item.isHighestWeight && <span className="text-[7px] text-blue-500 font-black uppercase bg-blue-500/10 px-1.5 py-0.5 rounded italic whitespace-nowrap">Ny tyngsta vikt</span>}
                                                            {(!item.isHighestWeight || !isWeightPRMode) && <span className="text-[7px] text-amber-500 font-black uppercase bg-amber-500/10 px-1.5 py-0.5 rounded italic whitespace-nowrap">Ny e1RM-topp</span>}
                                                            {(item.reps || 0) > 12 && <span className="text-[7px] text-red-500 font-black uppercase bg-red-500/10 px-1.5 py-0.5 rounded italic border border-red-500/20">Låg precision ({'>'}12 reps)</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-5 text-right font-black text-amber-500 text-xl italic">{item.value}<span className="text-[8px] not-italic ml-0.5 opacity-50 uppercase tracking-tighter">kg</span></td>
                                                    <td className="px-4 py-3 text-right">
                                                        {prev ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-emerald-500 font-black text-sm">+{pct.toFixed(1)}%</span>
                                                                <span className="text-[7px] text-slate-700 font-mono font-bold tracking-tighter">+{diff.toFixed(1)}kg jmf. föregående</span>
                                                            </div>
                                                        ) : <span className="text-slate-800 font-black uppercase text-[8px] border-b border-slate-900 pb-0.5">Grunddata</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right bg-black/10">
                                                        <div className="flex flex-col items-end space-y-1">
                                                            <span className="font-black text-slate-300 text-sm italic">{item.interstitial.tonnage.toLocaleString()} kg Total</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[8px] text-blue-400 font-black uppercase">{item.interstitial.sets} SETS</span>
                                                                {item.interstitial.isSessionStat && <span className="text-[7px] text-emerald-600 font-extrabold uppercase bg-emerald-950 px-1 rounded-sm tracking-tighter">At Peak</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-5 text-center">
                                                        <button
                                                            onClick={() => onSelectWorkout?.(workouts.find(w => w.id === item.workoutId)!)}
                                                            className="w-11 h-11 rounded-[1rem] bg-slate-900 hover:bg-blue-600 flex items-center justify-center text-slate-700 hover:text-white transition-all shadow-xl border border-white/5 active:scale-95 group-hover:border-blue-500/20"
                                                        >
                                                            <span className="text-lg">→</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* PB Timeline Visualization */}
                        <PRTimeline workouts={workouts} exerciseName={selectedExercise} />
                    </div>
                )}
            </div>
        </div>
    );
}
