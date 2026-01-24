import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { parseHyroxStats, HyroxStationStats, parseHyroxHistory } from '../../utils/hyroxParser.ts';
import { predictHyroxTime, HyroxPrediction, HyroxClass, HYROX_STANDARDS } from '../../utils/hyroxPredictor.ts';
import { HyroxStation, HyroxSessionSummary } from '../../models/types.ts';
import { HyroxStationDetailModal } from './HyroxStationDetailModal.tsx';

import { HYROX_WORKOUTS, DEEP_TIPS, HyroxWorkout } from '../../utils/hyroxWorkouts.ts';
import { HYROX_ENCYCLOPEDIA } from '../../utils/hyroxEncyclopedia.ts';
import { HyroxDuoLab } from './HyroxDuoLab.tsx';
import { HyroxRaceAnalysis } from './HyroxRaceAnalysis.tsx';

// Feature 1: Class Selector Options
const CLASSES: { id: HyroxClass; label: string }[] = [
    { id: 'MEN_OPEN', label: 'Men Open' },
    { id: 'WOMEN_OPEN', label: 'Women Open' },
    { id: 'MEN_PRO', label: 'Men Pro' },
    { id: 'WOMEN_PRO', label: 'Women Pro' },
    { id: 'DOUBLES_MEN', label: 'Doubles Men' },
    { id: 'DOUBLES_WOMEN', label: 'Doubles Women' },
    { id: 'DOUBLES_MIXED', label: 'Doubles Mixed' },
    { id: 'RELAY', label: 'Relay' },
];

const STATION_TIPS: Record<HyroxStation, string> = {
    ski_erg: "Håll armarna raka i starten av draget (använd lats). Gå inte ut för hårt första 200m.",
    sled_push: "Låga höfter, raka armar. Försök att inte stanna. Små snabba steg.",
    sled_pull: "Gå baklänges snabbt, använd kroppsvikten. Korta armtag, ingen biceps-curl.",
    burpee_broad_jumps: "Falla framåt, landa mjukt. Stega fram fötterna (step in) för att spara energi. Hoppa inte för långt.",
    rowing: "Långa drag. Håll tempot nere (lägre strock rate) men kraftfullt.",
    farmers_carry: "Snabba steg. Lås skulderbladen. Släpp INTE vikten (straffet att plocka upp är för dyrt).",
    sandbag_lunges: "Vila med säcken på axlarna om du måste stanna. Byt axel halvvägs.",
    wall_balls: "Håll bollen högt på bröstet. Andas ut när du kastar. Använd benen!",
    run_1km: "Detta är din 'vila'. Hitta en rytm. Gå inte i Roxzone.",
};

// Feature 7.0: Elite Splits (Mock/Approximate)
const ELITE_SPLITS = {
    ski_erg: 215, // 3:35
    sled_push: 120, // 2:00
    sled_pull: 180, // 3:00
    burpee_broad_jumps: 150, // 2:30
    rowing: 220, // 3:40
    farmers_carry: 60, // 1:00
    sandbag_lunges: 180, // 3:00
    wall_balls: 180, // 3:00
    run_1km: 180, // 3:00 (avg)
    roxzone: 240 // 4:00 (total)
};

const ALL_STATIONS: HyroxStation[] = ['ski_erg', 'sled_push', 'sled_pull', 'burpee_broad_jumps', 'rowing', 'farmers_carry', 'sandbag_lunges', 'wall_balls'];

export function HyroxDashboard() {
    const { unifiedActivities, coachConfig, strengthSessions, exercises } = useData();

    const [selectedClass, setSelectedClass] = useState<HyroxClass>('MEN_OPEN');
    // Feature 7.0: 'pro_stats' tab
    // Feature 7.0: 'pro_stats' tab
    const [viewMode, setViewMode] = useState<'status' | 'races' | 'workouts' | 'history' | 'simulate' | 'goals' | 'duo' | 'guide' | 'training' | 'pro_stats'>('status');
    const [runImprovement, setRunImprovement] = useState(0);
    const [stationEfficiency, setStationEfficiency] = useState(0);
    const [roxzoneImprovement, setRoxzoneImprovement] = useState(0);
    const [goalTime, setGoalTime] = useState('01:30');

    // History Table Sort
    const [sortField, setSortField] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Feature 6.0: Encyclopedia Modal
    const [selectedStation, setSelectedStation] = useState<HyroxStation | null>(null);

    // Feature 11: Doubles Strategy
    const [doublesStrategy, setDoublesStrategy] = useState<Record<string, 'ME' | 'PARTNER' | 'SPLIT'>>({});

    // Feature 12: Deep Analysis
    const [analyzingSessionId, setAnalyzingSessionId] = useState<string | null>(null);

    const isDoubles = selectedClass.includes('DOUBLES') || selectedClass === 'RELAY';

    const stats: Record<HyroxStation, HyroxStationStats> = useMemo(() => parseHyroxStats(unifiedActivities as any, strengthSessions, exercises), [unifiedActivities, strengthSessions, exercises]);
    const rawHyroxHistory = useMemo(() => parseHyroxHistory(unifiedActivities as any, strengthSessions, exercises), [unifiedActivities, strengthSessions, exercises]);

    const hyroxHistory = useMemo(() => {
        const sorted = [...rawHyroxHistory];
        sorted.sort((a, b) => {
            let valA: any = a[sortField as keyof HyroxSessionSummary];
            let valB: any = b[sortField as keyof HyroxSessionSummary];

            if (sortField === 'tonnage') {
                valA = a.totalTonnage || 0;
                valB = b.totalTonnage || 0;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [rawHyroxHistory, sortField, sortOrder]);

    const requestSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };
    const recent5k = useMemo(() => {
        if (coachConfig?.userProfile?.recentRaceTime) {
            const { distance, timeSeconds } = coachConfig.userProfile.recentRaceTime;
            const pace = timeSeconds / distance;
            const estimate5kSeconds = pace * 5;
            const m = Math.floor(estimate5kSeconds / 60);
            const s = Math.round(estimate5kSeconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
        return "22:30";
    }, [coachConfig]);

    // 2. Calculate Averages
    const averageStats = useMemo(() => {
        const statsObj: Partial<Record<HyroxStation, number>> = {};
        ALL_STATIONS.forEach(station => {
            const stationData = stats[station];
            if (stationData.times.length > 0) {
                statsObj[station] = stationData.times.reduce((a, b) => a + b, 0) / stationData.times.length;
            }
        });
        return statsObj;
    }, [stats]);

    // 3. Generate Prediction
    const prediction: HyroxPrediction | null = useMemo(() => {
        const pred = predictHyroxTime(recent5k, averageStats, selectedClass, {
            runGlobalImprovement: runImprovement,
            stationGlobalImprovement: stationEfficiency
        });

        // Apply Doubles Logic Overrides
        if (isDoubles && pred) {
            // Adjust Roxzone (Doubles have faster roxzone usually? Or chaos?)
            // Adjust Stations based on strategy
            let newStationSum = 0;
            const newSplits = { ...pred.splits };

            ALL_STATIONS.forEach(st => {
                const strat = doublesStrategy[st] || 'SPLIT';
                if (strat === 'PARTNER') {
                    // Assume partner is average (Baseline time for class)
                    // Or 10% faster than you? Let's use Class Baseline
                    // newSplits[st] = BASELINE... hard to get baseline back here without re-export
                    // Let's assume partner matches your predicted time for simplicity,
                    // BUT if you skip the station, you have ZERO fatigue accumulation?
                    // This model is too simple for fatigue.
                    // Just purely summing time:
                    newSplits[st] = pred.splits[st]; // Partner takes same time
                } else if (strat === 'SPLIT') {
                    // You do half.
                    newSplits[st] = pred.splits[st]; // Total time for station is same
                }
            });

            // If Relay/Doubles, running is split too.
            // Doubles: Both run together. So 8km total per person.
            // Relay: Split the runs.
        }

        // Apply Roxzone Slider
        const roxMod = 1 - (roxzoneImprovement / 100);
        pred.roxzone = pred.roxzone * roxMod;

        // Re-sum total
        let sum = pred.runTotal + pred.roxzone;
        ALL_STATIONS.forEach(s => sum += pred.splits[s]);
        pred.totalTimeSeconds = sum;
        pred.totalTimeFormatted = fmtSec(sum);

        return pred;
    }, [stats, recent5k, selectedClass, runImprovement, stationEfficiency, roxzoneImprovement, isDoubles, doublesStrategy]);

    if (!prediction) return <div>Data saknas</div>;

    const standards = HYROX_STANDARDS[selectedClass];

    // ------------------------------------------------------------------
    // FEATURE 7.0 LOGIC: ARCHETYPE & STATS
    // ------------------------------------------------------------------
    const runnerType = useMemo(() => {
        if (!prediction) return { title: 'Unknown', desc: 'No prediction data.', weakness: 'N/A' };
        const runRatio = prediction.runTotal / prediction.totalTimeSeconds;
        if (runRatio < 0.45) return { title: 'The Sled Dog 🐕', desc: 'Station Dominant. Your engine overcomes your running.', weakness: 'Pure Running Speed' };
        if (runRatio > 0.55) return { title: 'The Gazelle 🦌', desc: 'Running Dominant. You fly on the track but struggle with weights.', weakness: 'Heavy Sleds' };
        return { title: 'The Hybrid 🤖', desc: 'Perfectly Balanced. You are the ideal Hyrox athlete.', weakness: 'None (Jack of all trades)' };
    }, [prediction]);

    const pacingTargets = useMemo(() => {
        if (!prediction) return [];
        // Base pace from 5k form or prediction? Let's use prediction avg run pace
        const avgRunSec = prediction.runTotal / 8;
        // Coefficients of fatigue
        const mods = [0.95, 0.98, 1.05, 1.02, 1.00, 0.98, 1.10, 1.15];
        // 1 (fresh), 2 (ski), 3 (sled push - dead), 4 (sled pull - ok), 5 (bbj - ok), 6 (row - fresh legs), 7 (lunges - hell), 8 (wb - zombie)

        return mods.map((m, i) => ({
            run: i + 1,
            target: avgRunSec * m,
            note: i === 2 ? 'Post-Sled Survival' : i === 6 ? 'The Lunge Shuffle' : 'Steady'
        }));
    }, [prediction]);

    const fuelPlan = useMemo(() => {
        const totalMin = prediction.totalTimeSeconds / 60;
        const plan = [];
        if (totalMin > 70) plan.push({ at: 'Roxzone 4 (Post-BBJ)', what: '💧 Gel + Water', why: 'Halvvägs-boost' });
        if (totalMin > 90) plan.push({ at: 'Roxzone 6 (Post-Farm)', what: '⚡ Caffeine / Carb Drink', why: 'Kick inför Lunges' });
        plan.push({ at: 'Start', what: '🧂 Elektrolyter', why: 'Pre-load' });
        return plan.sort((a, b) => a.at === 'Start' ? -1 : 1);
    }, [prediction]);

    // ...

    return (
        <div className="space-y-6 max-w-5xl mx-auto text-slate-200">

            {/* HERO CARD & TABS */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-amber-500 text-slate-950 font-black px-3 py-1 rounded text-xs uppercase tracking-tighter shadow-amber-500/20 shadow-lg">v4.0</div>
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Hyrox <span className="text-slate-500">Predictor</span></h2>
                        </div>
                        <div className="flex items-center gap-4 mt-4 flex-wrap">
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value as HyroxClass)}
                                className="bg-slate-950 text-white text-sm font-bold px-4 py-2 rounded-xl border border-white/10 focus:border-amber-500 outline-none uppercase tracking-wide cursor-pointer hover:bg-slate-800 transition-colors shadow-lg"
                            >
                                {CLASSES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                            <div className="flex gap-2 text-[10px] text-slate-400 font-mono">
                                <span className="bg-slate-950/50 px-2 py-1.5 rounded border border-white/5">SP: {standards.sledPush}kg</span>
                                <span className="bg-slate-950/50 px-2 py-1.5 rounded border border-white/5">WB: {standards.wallBall}kg</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1 opacity-75">Estimerad Sluttid</span>
                        <div className="text-7xl font-black text-white tracking-tighter tabular-nums drop-shadow-xl leading-none">{prediction.totalTimeFormatted}</div>
                        <div className="mt-4 w-48 h-8 relative">
                            <svg viewBox="0 0 100 20" className="w-full h-full opacity-50">
                                <path d="M0,20 Q20,20 35,5 Q50,-10 65,5 Q80,20 100,20" fill="none" stroke="#64748b" strokeWidth="1" />
                                <line x1="10" y1="0" x2="10" y2="20" stroke="#10b981" strokeWidth="1" strokeDasharray="2 1" />
                                <line x1="50" y1="0" x2="50" y2="20" stroke="#64748b" strokeWidth="1" />
                                <circle cx={100 - prediction.percentile} cy="10" r="3" fill="#fbbf24" stroke="white" strokeWidth="1" />
                            </svg>
                            <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1 w-full">
                                <span>ELITE</span>
                                <span>AVG</span>
                                <span>SLOW</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-8 border-t border-white/5 pt-4 overflow-x-auto pb-1 scrollbar-none">
                    <TabBtn label="Status" active={viewMode === 'status'} onClick={() => setViewMode('status')} color="indigo" />
                    <TabBtn label="Tävlingar" active={viewMode === 'races'} onClick={() => setViewMode('races')} color="rose" />
                    <TabBtn label="Träningslab" active={viewMode === 'workouts'} onClick={() => setViewMode('workouts')} color="emerald" />
                    <TabBtn label="Simulator" active={viewMode === 'simulate'} onClick={() => setViewMode('simulate')} color="amber" />
                    <TabBtn label="Målpacing" active={viewMode === 'goals'} onClick={() => setViewMode('goals')} color="emerald" />
                    <TabBtn label="Duo Lab" active={viewMode === 'duo'} onClick={() => setViewMode('duo')} color="sky" />
                    <TabBtn label="Historik" active={viewMode === 'history'} onClick={() => setViewMode('history')} color="indigo" />
                    <TabBtn label="Guide" active={viewMode === 'guide'} onClick={() => setViewMode('guide')} color="slate" />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ... existing views ... */}

                {viewMode === 'pro_stats' && (
                    <>
                        {/* LEFT COLUMN: IDENTITY & ELITE COMPARE */}
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

                            {/* ARCHETYPE CARD */}
                            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl select-none group-hover:opacity-20 transition-opacity">
                                    {runnerType.title.split(' ')[2]}
                                </div>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Athlete Identity</h3>
                                <div className="relative z-10">
                                    <div className="text-4xl font-black text-white italic tracking-tighter mb-2">{runnerType.title}</div>
                                    <p className="text-sm text-slate-400 mb-4">{runnerType.desc}</p>
                                    <div className="inline-block bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded text-xs text-rose-400 font-bold uppercase">
                                        Weakness: {runnerType.weakness}
                                    </div>
                                </div>
                            </div>

                            {/* ELITE COMPARISON */}
                            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">The Ghost Protocol (vs Elite)</h3>
                                <div className="space-y-4">
                                    {['ski_erg', 'sled_push', 'burpee_broad_jumps', 'wall_balls'].map(st => (
                                        <div key={st}>
                                            <div className="flex justify-between text-xs font-bold mb-1 uppercase">
                                                <span className="text-slate-300">{st.replace(/_/g, ' ')}</span>
                                                <span className="text-slate-500">Elite: {fmtSec(ELITE_SPLITS[st as HyroxStation])}</span>
                                            </div>
                                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-amber-500" style={{ width: `${(ELITE_SPLITS[st as HyroxStation] / prediction.splits[st as HyroxStation]) * 100}%` }}></div>
                                            </div>
                                            <div className="text-right text-[10px] text-rose-400 font-mono mt-0.5">
                                                +{fmtSec(prediction.splits[st as HyroxStation] - ELITE_SPLITS[st as HyroxStation])}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: STRATEGY & PACING */}
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6">

                            {/* PACING TABLE */}
                            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <span>⏱️</span> Compromised Pacing
                                </h3>
                                <div className="grid gap-2">
                                    {pacingTargets.map((pt, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-slate-600 w-4">#{pt.run}</span>
                                                <span className="text-xs font-bold text-slate-400">{pt.note}</span>
                                            </div>
                                            <div className={`font-mono font-bold ${i === 2 || i === 6 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {fmtSec(pt.target)} /km
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* FUEL PLAN */}
                            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <span>⛽</span> Fuel Strategy
                                </h3>
                                <div className="relative border-l-2 border-emerald-500/20 ml-2 space-y-6">
                                    {fuelPlan.map((step, i) => (
                                        <div key={i} className="pl-6 relative">
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-emerald-500"></div>
                                            <div className="text-xs font-black text-emerald-500 uppercase tracking-wider mb-1">{step.at}</div>
                                            <div className="text-lg font-bold text-white mb-0.5">{step.what}</div>
                                            <p className="text-xs text-slate-400 italic">"{step.why}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {(viewMode === 'status' || viewMode === 'simulate' || viewMode === 'goals') && (
                    <>
                        {/* LEFT: DATA SPLITS */}
                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">Race Breakdown</h3>

                            {/* PACE DECAY GRAPH */}
                            <div className="mb-6 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Pace Decay Analysis</span>
                                <div className="flex items-end h-16 gap-1">
                                    {[1, 1.02, 1.05, 1.08, 1.10, 1.12, 1.15, 1.20].map((mod, i) => (
                                        <div key={i} className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/40 transition-colors rounded-t-sm relative group" style={{ height: `${20 + (mod - 1) * 200}%` }}>
                                            <div className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-black px-1 rounded text-white whitespace-nowrap">
                                                Run {i + 1}: {fmtSec((prediction.runTotal / 8) * mod)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between text-[8px] text-slate-600 mt-1 uppercase font-bold">
                                    <span>Run 1 (Fresh)</span>
                                    <span>Run 8 (Dead)</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                {/* Run Total Row */}
                                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/30 border border-white/5 mb-2">
                                    <span className="text-xs font-bold text-slate-300">🏃 TOTAL LÖPNING</span>
                                    <span className="font-mono font-bold text-white">{fmtSec(prediction.runTotal)}</span>
                                </div>

                                {ALL_STATIONS.map((station, idx) => (
                                    <div key={station} className="group relative">
                                        <div
                                            key={station}
                                            onClick={() => setSelectedStation(station)}
                                            className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-800 hover:border-amber-500/30 transition-all cursor-pointer group relative overflow-hidden"
                                        >
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-lg border border-amber-500/20 group-hover:scale-110 transition-transform">
                                                    {HYROX_ENCYCLOPEDIA[station]?.icon}
                                                </div>
                                                <div className="relative">
                                                    <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                                                        {HYROX_ENCYCLOPEDIA[station]?.title}
                                                    </span>

                                                    {/* Doubles/Relay Strategy Badge */}
                                                    {isDoubles && (
                                                        <div className="absolute -right-2 top-full mt-1 flex gap-1 items-center">
                                                            {['ME', 'PARTNER', 'SPLIT'].map(type => (
                                                                <button
                                                                    key={type}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDoublesStrategy(p => ({ ...p, [station]: type as any }));
                                                                    }}
                                                                    className={`text-[8px] px-1.5 py-0.5 rounded border ${(doublesStrategy[station] || 'SPLIT') === type
                                                                        ? 'bg-amber-500 text-black border-amber-500 font-bold'
                                                                        : 'border-slate-700 text-slate-500 hover:text-slate-300'
                                                                        }`}
                                                                >
                                                                    {type}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Hover Tip */}
                                                <span className="text-[9px] text-slate-500 hidden group-hover:inline-block absolute left-4 -bottom-2 bg-slate-900 px-2 py-0.5 border border-white/10 rounded-full z-10 whitespace-nowrap shadow-xl">
                                                    ℹ️ Klicka för detaljer & stats
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                                                    {fmtSec(prediction.splits[station])}
                                                </span>
                                                {/* Show difference from average if available? No, keep simple for now */}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: INTERACTIVE */}
                        <div className="space-y-6">

                            {viewMode === 'simulate' && (
                                <div className="bg-slate-900 border border-amber-500/20 rounded-3xl p-6 animate-in slide-in-from-right-4 fade-in">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl border border-amber-500/20">
                                            🧪
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Simulator Lab <span className="text-amber-500 text-[10px] ml-1">v2.0</span></h3>
                                            <p className="text-[10px] text-slate-400">Avancerad scenarioanalys</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        {/* Run Engine */}
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">🏃 Löpkapacitet</label>
                                                <span className="text-xs font-mono font-bold text-white">{runImprovement}% snabbare</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0" max="25" step="1"
                                                value={runImprovement}
                                                onChange={(e) => setRunImprovement(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                            <p className="text-[10px] text-slate-500 italic">Simulerar bättre kondition och högre tröskel.</p>
                                        </div>

                                        {/* Station Technician */}
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">🏋️ Stationseffektivitet</label>
                                                <span className="text-xs font-mono font-bold text-white">{stationEfficiency}% effektivare</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0" max="30" step="1"
                                                value={stationEfficiency}
                                                onChange={(e) => setStationEfficiency(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                            />
                                            <p className="text-[10px] text-slate-500 italic">Snabbare burpees, wallballs och utfall utan extra puls.</p>
                                        </div>

                                        {/* Roxzone Master */}
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">⚡ Roxzone Speed</label>
                                                <span className="text-xs font-mono font-bold text-white">{roxzoneImprovement}% snabbare</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0" max="60" step="1"
                                                value={roxzoneImprovement}
                                                onChange={(e) => setRoxzoneImprovement(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                            />
                                            <p className="text-[10px] text-slate-500 italic">Minimera "dötid" och gåvila mellan stationerna.</p>
                                        </div>

                                        {/* RESULT */}
                                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-amber-500/20 text-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors" />
                                            <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 relative z-10">Simulerad Sluttid</span>
                                            <span className="text-5xl font-black text-white relative z-10 tracking-tighter">
                                                {prediction.totalTimeFormatted}
                                            </span>
                                            {(() => {
                                                // Calculate baseline with 0% improvement
                                                const baseline = predictHyroxTime(
                                                    recent5k,
                                                    averageStats,
                                                    selectedClass,
                                                    { runGlobalImprovement: 0, stationGlobalImprovement: 0 }
                                                )?.totalTimeSeconds || 0;

                                                const diff = baseline - prediction.totalTimeSeconds;
                                                if (diff <= 30) return null; // Only show if meaningful difference

                                                return (
                                                    <div className="mt-2 text-xs text-emerald-400 font-bold relative z-10">
                                                        -{fmtSec(diff)} mot nuvarande
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {viewMode === 'status' && (
                                <div className="space-y-6">
                                    <div className="grid gap-4">
                                        <div className="bg-slate-900 p-5 rounded-2xl border border-white/5">
                                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Din Superkraft ⚡</h3>
                                            <div className="flex items-center gap-4">
                                                <div className="text-3xl">🏃</div>
                                                <div>
                                                    <div className="font-bold text-white text-lg leading-none mb-1">{prediction.strongestStation.replace(/_/g, ' ')}</div>
                                                    <p className="text-xs text-slate-400">Du är 15% snabbare än snittet här.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TRAINING SUMMARY (CLOSED LOOP) */}
                                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 text-8xl">🏋️</div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
                                            <span>📊</span> Träningsstatus
                                        </h3>
                                        <div className="space-y-4 relative z-10 max-h-[460px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                            {ALL_STATIONS.map(stId => {
                                                const sStats = stats[stId];
                                                if (sStats.totalSets === 0) return null;
                                                return (
                                                    <div key={stId} className={`p-4 rounded-2xl border transition-all ${stId === 'sled_push' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-950/50 border-white/5'}`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">{HYROX_ENCYCLOPEDIA[stId]?.icon || '💪'}</span>
                                                                <span className={`text-sm font-black uppercase tracking-tight ${stId === 'sled_push' ? 'text-emerald-400' : 'text-white'}`}>
                                                                    {stId.replace(/_/g, ' ')}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">{sStats.sessions.size} pass</span>
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            <div className="text-center">
                                                                <div className="text-[8px] text-slate-500 uppercase font-black">Sets</div>
                                                                <div className="text-sm font-bold text-slate-300">{sStats.totalSets}</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-[8px] text-slate-500 uppercase font-black">Reps</div>
                                                                <div className="text-sm font-bold text-slate-300">{sStats.totalReps || '-'}</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-[8px] text-slate-500 uppercase font-black">Längd</div>
                                                                <div className="text-sm font-bold text-slate-300">{sStats.totalDistance ? `${sStats.totalDistance}m` : '-'}</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-[8px] text-slate-500 uppercase font-black">Volym</div>
                                                                <div className="text-sm font-bold text-emerald-500">{(sStats.totalTonnage / 1000).toFixed(1)}t</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {Object.values(stats).every(s => s.totalSets === 0) && (
                                                <div className="text-center py-8 text-slate-500 italic text-sm">
                                                    Ingen historik hittades. Logga övningar i träningsdagboken för att se dem här!
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {viewMode === 'goals' && (
                                <div className="bg-slate-900 border border-emerald-500/20 rounded-3xl p-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-2xl border border-emerald-500/20">
                                            🎯
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Goal Pacing <span className="text-emerald-500 text-[10px] ml-1">Calculator</span></h3>
                                            <p className="text-[10px] text-slate-400">Vad krävs för att nå ditt mål?</p>
                                        </div>
                                    </div>

                                    <div className="mb-8">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Ditt Mål (hh:mm)</label>
                                        <input
                                            type="text"
                                            value={goalTime}
                                            onChange={(e) => setGoalTime(e.target.value)}
                                            className="bg-slate-950 text-white font-mono text-3xl font-black p-4 rounded-xl border border-white/10 w-full focus:border-emerald-500 outline-none text-center tracking-tighter"
                                        />
                                    </div>

                                    {/* Calculated Targets */}
                                    {(() => {
                                        const [h, m] = goalTime.split(':').map(Number);
                                        if (isNaN(h) || isNaN(m)) return null;
                                        const targetSeconds = (h * 60 * 60) + (m * 60);

                                        // Simple Model: 50% Running, 45% Stations, 5% Roxzone (Hypothetical efficient race)
                                        // Or better: use user's current ratio? 
                                        // Let's use a standard "Balanced Athlete" distribution:
                                        // Run: 54%, Stations: 40%, Rox: 6%
                                        const targetRunTotal = targetSeconds * 0.54;
                                        const targetStationTotal = targetSeconds * 0.40;
                                        const targetRox = targetSeconds * 0.06;

                                        const runPaceSec = targetRunTotal / 8; // per km
                                        const stationAvg = targetStationTotal / 8; // per station

                                        return (
                                            <div className="grid gap-4">
                                                <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 space-y-4">
                                                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest border-b border-emerald-500/10 pb-2">Kravspecifikation</h4>

                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-slate-300">🏃 Löpsnitt (8x1km)</span>
                                                        <span className="font-mono text-white font-bold">{fmtSec(runPaceSec)} /km</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-slate-300">🏋️ Stationssnitt</span>
                                                        <span className="font-mono text-white font-bold">{fmtSec(stationAvg)} /stn</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-slate-300">⚡ Roxzone (Total)</span>
                                                        <span className="font-mono text-amber-400 font-bold max-w-[100px] text-right truncate">Max {Math.round(targetRox / 60)} min</span>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Split Strategy</h4>
                                                    <div className="space-y-1 text-xs">
                                                        <p className="text-slate-400"><strong className="text-white">Start:</strong> Gå ut i {fmtSec(runPaceSec - 5)} tempo första 2km.</p>
                                                        <p className="text-slate-400"><strong className="text-white">Mitten:</strong> Håll {fmtSec(runPaceSec)} mellan Sled & Row.</p>
                                                        <p className="text-slate-400"><strong className="text-white">Slutet:</strong> Överlev lunges, töm tanken på Wall Balls.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </>
                )
                }

                {viewMode === 'races' && (
                    <div className="col-span-1 lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span>🏆</span> Hyrox Tävlingar & Fulla Simulationer
                            </h3>
                            <div className="grid gap-4">
                                {hyroxHistory.filter(s => s.isRace).map(session => (
                                    <div key={session.id} className="bg-slate-950/50 p-6 rounded-2xl border border-white/5 hover:border-rose-500/30 transition-all group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">{session.date}</div>
                                                <h4 className="text-lg font-black text-white uppercase tracking-tight">{session.name}</h4>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setAnalyzingSessionId(analyzingSessionId === session.id ? null : session.id)}
                                                    className={`text-[10px] font-black px-3 py-1 rounded transition-all ${analyzingSessionId === session.id ? 'bg-rose-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                                >
                                                    {analyzingSessionId === session.id ? 'STÄNG ANALYS' : 'DJUPANALYS'}
                                                </button>
                                                <div className="bg-rose-500 text-black text-[10px] font-black px-2 py-1 rounded flex items-center">RACE</div>
                                            </div>
                                        </div>

                                        {analyzingSessionId === session.id ? (
                                            <div className="pt-4 border-t border-white/10 mt-4">
                                                <HyroxRaceAnalysis session={session} />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                                    {ALL_STATIONS.map((st: HyroxStation) => {
                                                        const time = session.splits?.[st];
                                                        if (!time) return null;
                                                        return (
                                                            <div key={st} className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                <div className="text-[8px] text-slate-500 font-black uppercase mb-1">{st.replace(/_/g, ' ')}</div>
                                                                <div className="font-mono text-sm font-bold text-white">{fmtSec(time)}</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                {session.totalDuration && (
                                                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                                        <span className="text-xs text-slate-500 font-bold uppercase">Total Tid</span>
                                                        <span className="text-xl font-black text-white font-mono">{session.totalDuration} min</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                                {hyroxHistory.filter(s => s.isRace).length === 0 && (
                                    <div className="py-20 text-center text-slate-500">Inga tävlingar registrerade än.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'workouts' && (
                    <div className="col-span-1 lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-slate-900 border border-emerald-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span>🏋️</span> Träningssimulator (Log)
                            </h3>
                            <div className="space-y-4">
                                {hyroxHistory.filter(s => !s.isRace).map(session => (
                                    <div key={session.id} className="bg-slate-950/50 p-4 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-mono font-bold text-slate-500">{session.date}</span>
                                                <h4 className="text-sm font-black text-white uppercase tracking-tight">{session.name}</h4>
                                            </div>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${session.type === 'simulation' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                                {session.type === 'simulation' ? 'Custom Sim' : 'Strength'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {session.stations.map(st => (
                                                <div key={st} className="flex flex-col bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                                    <span className="text-[8px] text-slate-500 font-black uppercase">{st.replace(/_/g, ' ')}</span>
                                                    <span className="text-[10px] font-bold text-white">
                                                        {session.splits?.[st] ? (
                                                            <>
                                                                {session.stationDistances?.[st] && <span className="text-emerald-400 mr-1">{session.stationDistances[st]}m</span>}
                                                                {fmtSec(session.splits[st])}
                                                            </>
                                                        ) : session.totalTonnage ? 'Weight/Reps' : 'Check History'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {hyroxHistory.filter(s => !s.isRace).length === 0 && (
                                    <div className="py-20 text-center text-slate-500">Inga anpassade träningspass än.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {
                    viewMode === 'training' && (
                        <div className="col-span-1 lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                                <div>
                                    <h3 className="text-white font-bold">Övningsbank</h3>
                                    <p className="text-xs text-slate-400">Sök bland alla dina övningar och Hyrox-stationer</p>
                                </div>
                                <a href="/exercises" className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
                                    Gå till databas
                                </a>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {HYROX_WORKOUTS.map(workout => (
                                    <div key={workout.id} className="bg-slate-900 border border-white/5 rounded-3xl p-6 hover:border-amber-500/30 transition-all group relative flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex gap-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${workout.category === 'SIMULATION' ? 'bg-amber-500 text-black' :
                                                    workout.category === 'COMPROMISED' ? 'bg-rose-500 text-white' :
                                                        'bg-slate-800 text-slate-300'
                                                    }`}>{workout.category}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono">{workout.duration}</span>
                                        </div>
                                        <h3 className="text-lg font-black text-white mb-2 group-hover:text-amber-500 transition-colors">{workout.title}</h3>
                                        <p className="text-xs text-slate-400 mb-4 line-clamp-2">{workout.description}</p>

                                        <div className="bg-slate-950 p-4 rounded-xl border border-white/5 mb-4 space-y-1 flex-1">
                                            {workout.structure.slice(0, 4).map((line, i) => (
                                                <div key={i} className="text-[10px] text-slate-300 font-mono border-b border-white/5 last:border-0 pb-1 last:pb-0">{line}</div>
                                            ))}
                                            {workout.structure.length > 4 && <div className="text-[9px] text-slate-600 pt-1">... +{workout.structure.length - 4} more</div>}
                                        </div>

                                        <a href="/pass" className="w-full py-3 bg-white/5 hover:bg-amber-500 hover:text-black rounded-xl text-xs font-bold uppercase tracking-widest transition-all text-center block">
                                            Visa pass
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }

                {
                    viewMode === 'guide' && (
                        <div className="col-span-1 lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-slate-900 p-8 rounded-3xl border border-white/5">
                                    <div className="text-4xl mb-4">🧟</div>
                                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-4">Compromised Running</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                        Det största misstaget är att starta för hårt efter en station.
                                        Dina ben kommer vara stumma ("Compromised").
                                    </p>
                                    <ul className="space-y-2 text-sm text-slate-300">
                                        <li>🚨 <strong className="text-white">Post-Sled:</strong> De första 200m kommer kännas som att du springer i lera. Acceptera det. Öka farten gradvis.</li>
                                        <li>🚨 <strong className="text-white">Post-Lunges:</strong> "The Penguin Waddle". Ta korta steg. Försök inte sträcka ut steget förrän efter 400m.</li>
                                    </ul>
                                </div>

                                <div className="bg-slate-900 p-8 rounded-3xl border border-white/5">
                                    <div className="text-4xl mb-4">⚡</div>
                                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-4">Roxzone Mastery</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                        Roxzone är där tävlingen förloras. Många går och dricker vatten. Gör inte det.
                                    </p>
                                    <ul className="space-y-2 text-sm text-slate-300">
                                        <li>✅ <strong className="text-emerald-400">Gyllene Regeln:</strong> Ingen gåvila i Roxzone. Joggvila är 2x snabbare än gåvila.</li>
                                        <li>✅ <strong className="text-emerald-400">Vatten:</strong> Drick ENDAST om du måste (max 2 ggr/lopp). Det kostar 10-15 sekunder per stopp.</li>
                                    </ul>
                                </div>

                                <div className="bg-slate-900 border border-sky-500/20 rounded-3xl p-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">🍌</div>
                                    <h3 className="text-xl font-black text-white mb-6 relative z-10">{DEEP_TIPS.nutrition.title}</h3>
                                    <ul className="space-y-4 relative z-10">
                                        {DEEP_TIPS.nutrition.points.map((p, i) => (
                                            <li key={i} className="flex gap-4">
                                                <span className="bg-sky-500/20 text-sky-400 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                                                <p className="text-sm text-slate-300 leading-relaxed">{p}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="bg-slate-900 border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">⏱️</div>
                                    <h3 className="text-xl font-black text-white mb-6 relative z-10">{DEEP_TIPS.pacing.title}</h3>
                                    <ul className="space-y-4 relative z-10">
                                        {DEEP_TIPS.pacing.points.map((p, i) => (
                                            <li key={i} className="flex gap-4">
                                                <span className="bg-emerald-500/20 text-emerald-400 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                                                <p className="text-sm text-slate-300 leading-relaxed">{p}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                {viewMode === 'history' && (
                    <div className="col-span-1 lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span>📅</span> Alla Hyrox-pass
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <th className="pb-3 pl-2 cursor-pointer hover:text-white" onClick={() => requestSort('date')}>
                                                Datum {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="pb-3 cursor-pointer hover:text-white" onClick={() => requestSort('name')}>
                                                Pass {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="pb-3 text-center cursor-pointer hover:text-white" onClick={() => requestSort('type')}>
                                                Typ {sortField === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="pb-3">Stationer</th>
                                            <th className="pb-3 text-right pr-2 cursor-pointer hover:text-white" onClick={() => requestSort('tonnage')}>
                                                Volym/Tid {sortField === 'tonnage' && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {hyroxHistory.map((session) => (
                                            <tr key={session.id} className="group hover:bg-white/5 transition-colors">
                                                <td className="py-4 pl-2">
                                                    <span className="text-xs font-mono font-bold text-slate-400">{session.date}</span>
                                                </td>
                                                <td className="py-4">
                                                    <div className="text-xs font-black text-white uppercase tracking-tight">{session.name}</div>
                                                    {session.notes && <div className="text-[10px] text-slate-500 italic max-w-xs truncate">{session.notes}</div>}
                                                </td>
                                                <td className="py-4 text-center">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${session.type === 'simulation' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                                        {session.type === 'simulation' ? 'SIM' : 'STR'}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {session.stations.map(st => (
                                                            <span key={st} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                                                {st.replace(/_/g, ' ')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right pr-2">
                                                    {session.type === 'simulation' ? (
                                                        <span className="text-xs font-mono font-bold text-amber-400">{session.totalDuration} min</span>
                                                    ) : (
                                                        <span className="text-xs font-mono font-bold text-emerald-400">{Math.round((session.totalTonnage || 0) / 1000)}t+</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {hyroxHistory.length === 0 && (
                                    <div className="py-12 text-center text-slate-500 italic text-sm">
                                        Inga Hyrox-pass hittades i historiken.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'duo' && (
                    <div className="col-span-1 lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <HyroxDuoLab />
                    </div>
                )}

            </div>
            {/* End of Main Grid */}

            {/* MODAL */}
            {selectedStation && (
                <HyroxStationDetailModal
                    stationId={selectedStation}
                    onClose={() => setSelectedStation(null)}
                    stats={(() => {
                        const st = stats[selectedStation];
                        if (!st || st.history.length === 0) return undefined;
                        return {
                            pb: st.times.length > 0 ? Math.min(...st.times) : 0,
                            history: st,
                            average: st.times.length > 0 ? Math.round(st.times.reduce((a: number, b: number) => a + b, 0) / st.times.length) : 0
                        };
                    })()}
                />
            )}
        </div >
        // End of Main Container
    );
}

const TabBtn = ({ label, active, onClick, color }: any) => (
    <button onClick={onClick} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? `bg-${color}-500 text-white shadow-lg shadow-${color}-500/20` : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
        {label}
    </button>
);

const Slider = ({ label, value, onChange, max, color, desc }: any) => (
    <div>
        <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-slate-300">{label}</span>
            <span className={value > 0 ? color : 'text-slate-600'}>{value}%</span>
        </div>
        <input
            type="range" min="0" max={max} step="1"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white hover:accent-amber-400"
        />
        <p className="text-[10px] text-slate-500 mt-1.5">{desc}</p>
    </div>
);

const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};
