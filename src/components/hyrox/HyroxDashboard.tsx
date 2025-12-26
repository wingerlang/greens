import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { parseHyroxStats } from '../../utils/hyroxParser.ts';
import { predictHyroxTime, HyroxPrediction, HyroxClass, HYROX_STANDARDS } from '../../utils/hyroxPredictor.ts';
import { HyroxStation } from '../../models/types.ts';
import { HyroxStationDetailModal } from './HyroxStationDetailModal.tsx';

import { HYROX_WORKOUTS, DEEP_TIPS, HyroxWorkout } from '../../utils/hyroxWorkouts.ts';
import { HYROX_ENCYCLOPEDIA } from '../../utils/hyroxEncyclopedia.ts';
import { HyroxDuoLab } from './HyroxDuoLab.tsx';

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
    const { exerciseEntries, coachConfig } = useData();

    const [selectedClass, setSelectedClass] = useState<HyroxClass>('MEN_OPEN');
    // Feature 7.0: 'pro_stats' tab
    const [viewMode, setViewMode] = useState<'status' | 'simulate' | 'goals' | 'training' | 'guide' | 'duo' | 'pro_stats'>('status');
    const [runImprovement, setRunImprovement] = useState(0);
    const [stationEfficiency, setStationEfficiency] = useState(0);
    const [roxzoneImprovement, setRoxzoneImprovement] = useState(0);
    const [goalTime, setGoalTime] = useState("01:30");

    // Feature 6.0: Encyclopedia Modal
    const [selectedStation, setSelectedStation] = useState<HyroxStation | null>(null);

    // Feature 11: Doubles Strategy
    const [doublesStrategy, setDoublesStrategy] = useState<Record<string, 'ME' | 'PARTNER' | 'SPLIT'>>({});

    const isDoubles = selectedClass.includes('DOUBLES') || selectedClass === 'RELAY';

    // 1. Gather Data & 5k Form
    const stats = useMemo(() => parseHyroxStats(exerciseEntries), [exerciseEntries]);
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
            const history = stats[station];
            if (history.length > 0) {
                statsObj[station] = history.reduce((a, b) => a + b, 0) / history.length;
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
                    <TabBtn label="🔮 Simulator" active={viewMode === 'simulate'} onClick={() => setViewMode('simulate')} color="amber" />
                    <TabBtn label="🎯 Mål & Splits" active={viewMode === 'goals'} onClick={() => setViewMode('goals')} color="emerald" />
                    <TabBtn label="🏋️ Workouts" active={viewMode === 'training'} onClick={() => setViewMode('training')} color="rose" />
                    <TabBtn label="🧠 Strategy" active={viewMode === 'guide'} onClick={() => setViewMode('guide')} color="sky" />
                    <TabBtn label="⚔️ Duo Lab" active={viewMode === 'duo'} onClick={() => setViewMode('duo')} color="cyan" />
                    <TabBtn label="📊 Pro Stats" active={viewMode === 'pro_stats'} onClick={() => setViewMode('pro_stats')} color="indigo" />
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
                                <div className="grid gap-4">
                                    <div className="bg-slate-900 p-5 rounded-2xl border border-white/5">
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Din Superkraft ⚡</h3>
                                        <div className="flex items-center gap-4">
                                            <div className="text-3xl">🏃</div> {/* Should differ based on station, hardcoded for now or map icon */}
                                            <div>
                                                <div className="font-bold text-white text-lg leading-none mb-1">{prediction.strongestStation.replace(/_/g, ' ')}</div>
                                                <p className="text-xs text-slate-400">Du är 15% snabbare än snittet här.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Feature 14: Compare Levels */}
                                    <div className="bg-slate-900 p-5 rounded-2xl border border-white/5">
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Compare</h3>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between text-slate-400">
                                                <span>User Average</span>
                                                <span className="font-mono">01:35:00</span>
                                            </div>
                                            <div className="flex justify-between text-amber-500 font-bold">
                                                <span>YOU</span>
                                                <span className="font-mono">{prediction.totalTimeFormatted}</span>
                                            </div>
                                            <div className="flex justify-between text-emerald-500">
                                                <span>Elite Cutoff</span>
                                                <span className="font-mono">01:05:00</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {viewMode === 'goals' && (
                                <div className="bg-slate-900 border border-emerald-500/20 rounded-3xl p-6 animate-in fade-in slide-in-from-right-4">
                                    {/* ... Goals UI ... */}
                                    <div className="flex items-center gap-2 mb-6"> <span className="text-2xl">🎯</span> <h3 className="text-sm font-black text-white uppercase tracking-widest">Goal Pacing</h3> </div>
                                    <div className="mb-6"> <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Sätt ditt mål (hh:mm)</label> <input type="text" value={goalTime} onChange={(e) => setGoalTime(e.target.value)} className="bg-slate-950 text-white font-mono text-xl p-3 rounded-xl border border-white/10 w-full focus:border-emerald-500 outline-none text-center" /> </div>
                                    <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 space-y-3">
                                        <p className="text-xs text-slate-300 leading-relaxed"> För att klara <span className="text-white font-bold">{goalTime}</span> måste du snitta: </p>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2"> <span className="text-xs text-slate-400">Löpning (x8)</span> <span className="font-mono text-emerald-400 font-bold">5:15 /km</span> </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2"> <span className="text-xs text-slate-400">Roxzone (Total)</span> <span className="font-mono text-amber-400 font-bold">Max 4 min</span> </div>
                                        <div className="flex justify-between items-center"> <span className="text-xs text-slate-400">Stationer (Snitt)</span> <span className="font-mono text-slate-200 font-bold">4:00 /stn</span> </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )
                }

                {
                    viewMode === 'training' && (
                        <div className="col-span-1 lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {HYROX_WORKOUTS.map(workout => (
                                    <div key={workout.id} className="bg-slate-900 border border-white/5 rounded-3xl p-6 hover:border-amber-500/30 transition-all group">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${workout.category === 'SIMULATION' ? 'bg-amber-500 text-black' :
                                                workout.category === 'COMPROMISED' ? 'bg-rose-500 text-white' :
                                                    'bg-slate-800 text-slate-300'
                                                }`}>{workout.category}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">{workout.duration}</span>
                                        </div>
                                        <h3 className="text-lg font-black text-white mb-2 group-hover:text-amber-500 transition-colors">{workout.title}</h3>
                                        <p className="text-xs text-slate-400 mb-4 line-clamp-2">{workout.description}</p>

                                        <div className="bg-slate-950 p-4 rounded-xl border border-white/5 mb-4 space-y-1">
                                            {workout.structure.slice(0, 4).map((line, i) => (
                                                <div key={i} className="text-[10px] text-slate-300 font-mono border-b border-white/5 last:border-0 pb-1 last:pb-0">{line}</div>
                                            ))}
                                            {workout.structure.length > 4 && <div className="text-[9px] text-slate-600 pt-1">... +{workout.structure.length - 4} more</div>}
                                        </div>

                                        <button className="w-full py-2 bg-white/5 hover:bg-amber-500 hover:text-black rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
                                            Visa pass
                                        </button>
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
                    )
                }

                {
                    viewMode === 'duo' && (
                        <div className="col-span-1 lg:col-span-2">
                            <HyroxDuoLab />
                        </div>
                    )
                }
            </div >

            {/* MODAL */}
            {selectedStation && (
                <HyroxStationDetailModal
                    stationId={selectedStation}
                    onClose={() => setSelectedStation(null)}
                    stats={(() => {
                        // Assuming 'stats' is a Record<HyroxStation, number[]> available in this scope
                        // For example, it could be a state variable like:
                        // const [stats, setStats] = useState<Record<HyroxStation, number[]>>({});
                        // Or derived from props/context.
                        const history = stats[selectedStation] || [];
                        if (history.length === 0) return undefined;
                        return {
                            pb: Math.min(...history),
                            history: history,
                            average: Math.round(history.reduce((a, b) => a + b, 0) / (history.length || 1))
                        };
                    })()}
                />
            )}
        </div >
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
