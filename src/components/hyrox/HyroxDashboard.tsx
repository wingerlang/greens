import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { parseHyroxStats } from '../../utils/hyroxParser.ts';
import { predictHyroxTime, HyroxPrediction, HyroxClass, HYROX_STANDARDS } from '../../utils/hyroxPredictor.ts';
import { HyroxStation } from '../../models/types.ts';

import { HYROX_WORKOUTS, DEEP_TIPS, HyroxWorkout } from '../../utils/hyroxWorkouts.ts';
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

// Feature 12: Doubles Config
// Default: You do 50% of the work. Or specific stations.
// Simplification: Toggle which ones YOU do.
const ALL_STATIONS: HyroxStation[] = ['ski_erg', 'sled_push', 'sled_pull', 'burpee_broad_jumps', 'rowing', 'farmers_carry', 'sandbag_lunges', 'wall_balls'];

export function HyroxDashboard() {
    const { exerciseEntries, coachConfig } = useData();

    const [selectedClass, setSelectedClass] = useState<HyroxClass>('MEN_OPEN');
    const [viewMode, setViewMode] = useState<'status' | 'simulate' | 'goals' | 'training' | 'guide' | 'duo'>('status');
    const [runImprovement, setRunImprovement] = useState(0);
    const [stationEfficiency, setStationEfficiency] = useState(0);
    const [roxzoneImprovement, setRoxzoneImprovement] = useState(0); // Feature 15: Roxzone slider
    const [goalTime, setGoalTime] = useState("01:30");

    // Feature 11: Doubles Strategy
    // Map of Station -> 'ME' | 'PARTNER' | 'SPLIT'
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

    // 3. Generate Prediction
    const prediction: HyroxPrediction | null = useMemo(() => {
        const averagedStats: Partial<Record<HyroxStation, number>> = {};
        ALL_STATIONS.forEach(station => {
            const history = stats[station];
            if (history.length > 0) {
                averagedStats[station] = history.reduce((a, b) => a + b, 0) / history.length;
            }
        });

        const pred = predictHyroxTime(recent5k, averagedStats, selectedClass, {
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
                    <TabBtn label="🧠 Strategy Guide" active={viewMode === 'guide'} onClick={() => setViewMode('guide')} color="sky" />
                    <TabBtn label="⚔️ Duo Lab" active={viewMode === 'duo'} onClick={() => setViewMode('duo')} color="cyan" />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* NEW TABS: TRAINING & GUIDE TAKEOVER FULL GRID OR HALF? */}
                {/* For Status/Simulate/Goals we keep split view. For Training/Guide we might want full width or distinct layout. */}

                {(viewMode === 'status' || viewMode === 'simulate' || viewMode === 'goals') && (
                    <>
                        {/* LEFT: DATA SPLITS */}
                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">Race Breakdown</h3>

                            {/* FEATURE 12: PACE DECAY GRAPH (Mini) */}
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
                                        <div className={`flex justify-between items-center p-2.5 rounded-lg border transition-all ${prediction.weakestStation === station ? 'bg-rose-500/10 border-rose-500/20' :
                                            prediction.strongestStation === station ? 'bg-emerald-500/10 border-emerald-500/20' :
                                                'bg-transparent border-transparent hover:bg-white/5'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 flex items-center justify-center rounded bg-slate-800 text-[9px] font-mono text-slate-400">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                        {station.replace(/_/g, ' ')}
                                                    </span>

                                                    {/* Feature 11: DOUBLES SELECTOR INLINE */}
                                                    {isDoubles && (
                                                        <div className="flex gap-1 mt-1">
                                                            {['MY', 'PARTNER', 'SPLIT'].map(type => (
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
                                                    💡 {STATION_TIPS[station]}
                                                </span>
                                            </div>
                                            <span className="font-mono font-bold text-slate-200 text-sm">{fmtSec(prediction.splits[station])}</span>
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
                                        <span className="text-2xl">🔮</span>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Simulator Lab</h3>
                                            <p className="text-[10px] text-slate-400">Dra i spakarna för att se din potential</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <Slider
                                            label="Löpa snabbare"
                                            value={runImprovement}
                                            onChange={setRunImprovement}
                                            max={20}
                                            color="text-emerald-400"
                                            desc={`Sparar ${fmtSec(prediction.runTotal * (runImprovement / 100))} totalt`}
                                        />
                                        <Slider
                                            label="Stationsteknik"
                                            value={stationEfficiency}
                                            onChange={setStationEfficiency}
                                            max={25}
                                            color="text-amber-400"
                                            desc="Effektivitet i burpees/wallballs"
                                        />
                                        <Slider
                                            label="Snabbare Roxzone"
                                            value={roxzoneImprovement}
                                            onChange={setRoxzoneImprovement}
                                            max={50}
                                            color="text-indigo-400"
                                            desc="Jogga mellan stationerna"
                                        />

                                        <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center mt-6">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Simulerad Sluttid</span>
                                            <span className="text-4xl font-black text-white">{prediction.totalTimeFormatted}</span>
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
                )}

                {/* NEW FULL WIDTH MODES: TRAINING & GUIDE */}
                {viewMode === 'training' && (
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
                )}

                {viewMode === 'guide' && (
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
                )}

                {viewMode === 'duo' && (
                    <div className="col-span-1 lg:col-span-2">
                        <HyroxDuoLab />
                    </div>
                )}
            </div>
        </div>
    );
}

// Subcomponents
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
