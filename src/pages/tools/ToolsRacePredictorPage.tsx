import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../context/DataContext.tsx';
import { calculateVDOT, predictRaceTime, formatSeconds, formatPace } from '../../utils/runningCalculator.ts';
import { UniversalActivity } from '../../models/types.ts';

// --- Constants & Types ---

const DISTANCES = [
    { label: '1 km', km: 1.0, tolerance: 0.1 },
    { label: '1 Mile', km: 1.609, tolerance: 0.1 },
    { label: '3 km', km: 3.0, tolerance: 0.15 }, // Cooper proxy
    { label: '5 km', km: 5.0, tolerance: 0.2 },
    { label: '10 km', km: 10.0, tolerance: 0.3 },
    { label: '15 km', km: 15.0, tolerance: 0.4 },
    { label: 'Halvmara', km: 21.0975, tolerance: 0.5 },
    { label: 'Maraton', km: 42.195, tolerance: 1.0 },
];

interface PBAnalysis {
    distanceLabel: string;
    distanceKm: number;
    activityId: string;
    activityName: string;
    date: string;
    timeSeconds: number;
    pace: number; // min/km (decimal)
    vdot: number;
    activity?: UniversalActivity;
}

// --- Helper Functions ---

function analyzePBs(activities: UniversalActivity[]): PBAnalysis[] {
    const pbs: PBAnalysis[] = [];

    // Filter for completed running activities that have performance data
    const runActivities = activities.filter(a =>
        a.status === 'COMPLETED' &&
        a.performance?.activityType === 'running' &&
        a.performance.durationMinutes > 0 &&
        (a.performance.distanceKm || 0) > 0
    );

    DISTANCES.forEach(dist => {
        // Find runs close to this distance
        // Logic: 
        // 1. Matches distance +/- tolerance?
        // 2. OR is a longer run where we might need split data? 
        //    (For V1, keep it simple: only activities that match the total distance roughly. 
        //     Advanced: parsing splits would be better but requires standardized split data structure).

        const matches = runActivities.filter(a => {
            let d = a.performance?.distanceKm || 0;
            // Handle potential meter/km confusion (if distance is > 500, assume meters)
            const normalizedD = d > 500 ? d / 1000 : d;
            return normalizedD >= dist.km - dist.tolerance && normalizedD <= dist.km + dist.tolerance;
        });

        if (matches.length === 0) return;

        // Find the FASTEST match (highest speed = lowest time for normalized distance, or highest VDOT)
        let bestScore = -1;
        let bestEntry: PBAnalysis | null = null;

        matches.forEach(m => {
            let d = m.performance?.distanceKm || dist.km;
            if (d > 500) d = d / 1000;
            const t = (m.performance?.durationMinutes || 0) * 60; // seconds
            if (t <= 0 || d <= 0) return;

            // Normalize time to exact distance
            const vdot = calculateVDOT(d, t);

            if (vdot > bestScore) {
                bestScore = vdot;
                // Normalize pace for display
                const pace = (t / 60) / d;

                // Use plan title or performance notes or fallback
                const name = m.plan?.title || m.performance?.notes || 'Löppass';

                bestEntry = {
                    distanceLabel: dist.label,
                    distanceKm: dist.km,
                    activityId: m.id,
                    activityName: name,
                    date: m.date,
                    timeSeconds: t,
                    pace: pace,
                    vdot: vdot,
                    activity: m
                };
            }
        });

        if (bestEntry) {
            pbs.push(bestEntry);
        }
    });

    return pbs;
}

export function ToolsRacePredictorPage() {
    const { universalActivities, getLatestWeight, weightEntries, coachConfig } = useData();
    const [improvementFactor, setImprovementFactor] = useState(0); // Percent -10 to +10
    const [weightAdjustment, setWeightAdjustment] = useState(0); // +/- kg
    const [baselineSource, setBaselineSource] = useState<string>('auto'); // 'auto', activityId, or 'manual'
    const [manualDistanceKm, setManualDistanceKm] = useState<number>(5);
    const [manualTimeStr, setManualTimeStr] = useState<string>('20:00');
    const [showWeightAnalysis, setShowWeightAnalysis] = useState(false);
    
    const currentWeight = getLatestWeight() || 75;
    const weightGoal = coachConfig?.preferences?.weightGoal;

    // Helper for manual time
    const parseManualTime = (str: string) => {
        const parts = str.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 1200;
    };

    // 1. Analyze Data
    const pbs = useMemo(() => {
        return analyzePBs(universalActivities || []);
    }, [universalActivities]);

    // 2. Find "Gold Standard" (Best VDOT) or selected baseline
    const bestPerformance = useMemo(() => {
        if (baselineSource === 'manual') {
            const timeSecs = parseManualTime(manualTimeStr);
            const vdot = calculateVDOT(manualDistanceKm, timeSecs);
            return {
                distanceLabel: 'Manuell',
                distanceKm: manualDistanceKm,
                activityId: 'manual',
                activityName: 'Manuell Inmatning',
                date: 'Nu',
                timeSeconds: timeSecs,
                pace: (timeSecs / 60) / manualDistanceKm,
                vdot
            };
        }
        if (baselineSource !== 'auto') {
            const selected = pbs.find(p => p.activityId === baselineSource);
            if (selected) return selected;
        }

        if (pbs.length === 0) return null;
        return pbs.reduce((prev, current) => (prev.vdot > current.vdot) ? prev : current);
    }, [pbs, baselineSource, manualDistanceKm, manualTimeStr]);

    const recordWeight = useMemo(() => {
        if (!bestPerformance || bestPerformance.activityId === 'manual' || !weightEntries || weightEntries.length === 0) return null;
        const recordDate = new Date(bestPerformance.date).getTime();
        if (isNaN(recordDate)) return null;
        
        let closest = weightEntries[0];
        let minDiff = Infinity;
        for (const entry of weightEntries) {
            const entryDate = new Date(entry.date).getTime();
            if (isNaN(entryDate)) continue;
            const diff = Math.abs(entryDate - recordDate);
            if (diff < minDiff) {
                minDiff = diff;
                closest = entry;
            }
        }
        
        // Return if within ~30 days
        if (minDiff <= 30 * 24 * 60 * 60 * 1000) {
            return closest.weight;
        }
        return null;
    }, [bestPerformance, weightEntries]);

    const diffPerKgSec = useMemo(() => {
        if (!bestPerformance) return 0;
        const baseVDOT = bestPerformance.vdot;
        const paceAtCurrentWeight = predictRaceTime(baseVDOT, 1);
        const vdotPlus1Kg = baseVDOT * (currentWeight / (currentWeight + 1));
        const paceAtPlus1Kg = predictRaceTime(vdotPlus1Kg, 1);
        return Math.abs(paceAtPlus1Kg - paceAtCurrentWeight);
    }, [bestPerformance, currentWeight]);

    // 3. Calculate Predictions based on Best VDOT (+ adjustment)
    const predictions = useMemo(() => {
        if (!bestPerformance) return [];

        const baseVDOT = bestPerformance.vdot;

        // Weight effect on VDOT: VDOT is roughly VO2max(ml/min) / Weight(kg). 
        // Assuming VO2max is constant, VDOT changes inversely with weight.
        const simulatedWeight = currentWeight + weightAdjustment;
        const weightFactor = simulatedWeight > 0 ? (currentWeight / simulatedWeight) : 1;
        const weightAdjustedVDOT = baseVDOT * weightFactor;

        return DISTANCES.map(d => {
            // Pure prediction without weight or arbitrary improvement
            const pureBaseTime = predictRaceTime(baseVDOT, d.km);

            // Use the weight adjusted VDOT for the adjusted prediction
            const baseTime = predictRaceTime(weightAdjustedVDOT, d.km); // seconds
            
            // Then apply pure % improvement factor to time
            const adjustedTime = baseTime * (1 - (improvementFactor / 100));

            // Find specific PB for this distance if it exists
            const actualPB = pbs.find(p => p.distanceLabel === d.label);

            return {
                ...d,
                purePredictedSeconds: pureBaseTime,
                predictedSeconds: adjustedTime,
                basePredictedSeconds: baseTime,
                actualPB
            };
        });
    }, [bestPerformance, pbs, improvementFactor, weightAdjustment, currentWeight]);

    if (!universalActivities) return <div className="p-10 text-slate-400">Laddar...</div>;

    const getPerformanceColor = (actual: number, predicted: number) => {
        // lower is better
        const diff = actual - predicted; // distinct seconds
        if (diff <= -30) return 'text-emerald-400'; // Way faster than predicted!
        if (diff <= 10) return 'text-blue-400'; // Spot on
        return 'text-rose-400'; // Slower
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* HERDER */}
            <div className="text-center md:text-left">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-600 mb-2">
                    Race Predictor Pro
                </h1>
                <p className="text-slate-400 max-w-2xl">
                    Baserat på din absolut bästa prestation.
                </p>
            </div>

            {bestPerformance ? (
                <>
                    {/* HERO CARD: Best Performance */}
                    <div className="relative overflow-hidden bg-slate-900 border border-purple-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(168,85,247,0.15)]">
                        <div className="absolute top-0 right-0 p-40 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                        <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-4 border border-purple-500/30">
                                    <span>🏆</span> Basnivå
                                </div>
                                <div className="mb-2">
                                    <select 
                                        value={baselineSource}
                                        onChange={(e) => setBaselineSource(e.target.value)}
                                        className="bg-slate-950 border border-purple-500/30 text-white rounded-lg px-3 py-2 text-sm font-bold w-full focus:outline-none focus:border-purple-400"
                                    >
                                        <option value="auto">Bästa VDOT (Auto)</option>
                                        {pbs.map(p => (
                                            <option key={p.activityId} value={p.activityId}>
                                                Ditt {p.distanceLabel} PB ({formatSeconds(Math.round(p.timeSeconds))})
                                            </option>
                                        ))}
                                        <option value="manual">Manuell inmatning...</option>
                                    </select>
                                </div>
                                
                                {baselineSource === 'manual' ? (
                                    <div className="flex gap-2 mb-4">
                                        <div className="flex-1">
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Distans (km)</label>
                                            <input 
                                                type="number" 
                                                value={manualDistanceKm} 
                                                onChange={(e) => setManualDistanceKm(Number(e.target.value))}
                                                className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white font-mono"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tid (mm:ss)</label>
                                            <input 
                                                type="text" 
                                                value={manualTimeStr} 
                                                onChange={(e) => setManualTimeStr(e.target.value)}
                                                placeholder="20:00"
                                                className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white font-mono"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <h2 className="text-4xl font-black text-white mb-2">
                                        {bestPerformance.distanceLabel} <span className="text-2xl text-purple-400 font-mono font-bold ml-2">{formatSeconds(Math.round(bestPerformance.timeSeconds))}</span>
                                    </h2>
                                )}

                                <div className="flex items-center gap-4 text-sm text-slate-400 mt-4">
                                    <div className="flex flex-col">
                                        <span className="uppercase text-[10px] tracking-wider font-bold">VDOT</span>
                                        <span className="text-xl text-white font-bold">{bestPerformance.vdot.toFixed(1)}</span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="uppercase text-[10px] tracking-wider font-bold">Tempo</span>
                                        <span className="text-xl text-white font-bold">{formatPace(bestPerformance.pace)}</span>
                                    </div>
                                    {baselineSource !== 'manual' && (
                                        <>
                                            <div className="w-px h-8 bg-white/10"></div>
                                            <div className="flex flex-col">
                                                <span className="uppercase text-[10px] tracking-wider font-bold">Datum</span>
                                                <span className="text-white text-xs mt-1">{bestPerformance.date}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {baselineSource !== 'manual' && bestPerformance.activityId !== 'manual' && (
                                    <div className="mt-4">
                                        <Link
                                            to={`/activity/${bestPerformance.activityId}`}
                                            className="text-[10px] font-bold text-purple-400 hover:text-purple-300 underline underline-offset-4 decoration-purple-500/30 uppercase tracking-wider"
                                        >
                                            Visa aktivitet &rarr;
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* EXTRAPOLATION CONTROLS */}
                            <div className="bg-slate-950/50 rounded-2xl p-5 border border-white/5 space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Viktanalys</span>
                                        <span className="text-[9px] text-slate-500">Växla mellan relativ och absolut vikt</span>
                                    </div>
                                    <button 
                                        onClick={() => setShowWeightAnalysis(!showWeightAnalysis)}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${showWeightAnalysis ? 'bg-purple-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showWeightAnalysis ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div>
                                    <label className="flex justify-between items-center mb-1">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                                {showWeightAnalysis ? 'Simulerad Vikt' : 'Viktförändring'}
                                            </span>
                                            {diffPerKgSec > 0 && (
                                                <span className="text-[9px] text-slate-500">Påverkar ditt tempo med ca <strong className="text-slate-400">{diffPerKgSec.toFixed(1)} sek</strong> per km/kg</span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            {showWeightAnalysis ? (
                                                <span className="text-lg font-black text-white">
                                                    {(currentWeight + weightAdjustment).toFixed(1)} kg
                                                </span>
                                            ) : (
                                                <span className={`text-lg font-black ${weightAdjustment < 0 ? 'text-emerald-400' : weightAdjustment > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                                    {weightAdjustment > 0 ? '+' : ''}{weightAdjustment} kg
                                                </span>
                                            )}
                                        </div>
                                    </label>
                                    <input
                                        type="range"
                                        min="-10"
                                        max="10"
                                        step="0.5"
                                        value={weightAdjustment}
                                        onChange={(e) => setWeightAdjustment(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                    
                                    {showWeightAnalysis && (
                                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {recordWeight && (
                                                <button 
                                                    onClick={() => setWeightAdjustment(recordWeight - currentWeight)}
                                                    className="p-2 rounded-xl bg-slate-900 border border-white/5 flex flex-col items-center hover:bg-white/5 transition-colors text-center"
                                                >
                                                    <span className="text-[8px] text-slate-500 uppercase font-bold">Vid rekord</span>
                                                    <span className="text-[11px] text-white font-bold">{recordWeight} kg</span>
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setWeightAdjustment(0)}
                                                className="p-2 rounded-xl bg-slate-900 border border-white/5 flex flex-col items-center hover:bg-white/5 transition-colors text-center"
                                            >
                                                <span className="text-[8px] text-slate-500 uppercase font-bold">Nuvarande</span>
                                                <span className="text-[11px] text-white font-bold">{currentWeight} kg</span>
                                            </button>
                                            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-col items-center text-center">
                                                <span className="text-[8px] text-purple-400 uppercase font-bold">Simulerad</span>
                                                <span className="text-[11px] text-white font-bold">{(currentWeight + weightAdjustment).toFixed(1)} kg</span>
                                            </div>
                                            {weightGoal && (
                                                <button 
                                                    onClick={() => setWeightAdjustment(weightGoal - currentWeight)}
                                                    className="p-2 rounded-xl bg-slate-900 border border-emerald-500/20 flex flex-col items-center hover:bg-white/5 transition-colors text-center"
                                                >
                                                    <span className="text-[8px] text-emerald-500 uppercase font-bold">Målvikt</span>
                                                    <span className="text-[11px] text-white font-bold">{weightGoal} kg</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-[9px] text-slate-500 mt-1 font-mono uppercase">
                                        <span className="text-emerald-500/50">-10kg</span>
                                        <div className="flex gap-2 items-center">
                                            {recordWeight && Math.abs(currentWeight - recordWeight) > 0.5 && (
                                                <button 
                                                    onClick={() => setWeightAdjustment(recordWeight - currentWeight)}
                                                    className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded transition-colors"
                                                    title={`Vikt vid rekordet (${recordWeight}kg)`}
                                                >
                                                    Rekordvikt
                                                </button>
                                            )}
                                            {weightAdjustment !== 0 && (
                                                <button onClick={() => setWeightAdjustment(0)} className="hover:text-white transition-colors">Nollställ</button>
                                            )}
                                            <span>Nu ({currentWeight}kg)</span>
                                        </div>
                                        <span className="text-rose-500/50">+10kg</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Godtycklig Förbättring</span>
                                        <span className={`text-lg font-black ${improvementFactor > 0 ? 'text-emerald-400' : improvementFactor < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                            {improvementFactor > 0 ? '+' : ''}{improvementFactor}%
                                        </span>
                                    </label>
                                    <input
                                        type="range"
                                        min="-10"
                                        max="20"
                                        step="0.5"
                                        value={improvementFactor}
                                        onChange={(e) => setImprovementFactor(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                    <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono uppercase">
                                        <span>-10%</span>
                                        <span>0%</span>
                                        <span>+20%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* THE MATRIX */}
                    <div className="grid lg:grid-cols-1 gap-6">
                        <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden lg:overflow-visible">
                            <div className="overflow-x-auto lg:overflow-visible">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950 text-slate-500 uppercase text-[9px] tracking-wider font-bold">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Distans</th>
                                            <th className="px-3 py-2 text-right">Ditt PB</th>
                                            <th className="px-3 py-2 text-right text-slate-300">Bas (Tid)</th>
                                            <th className="px-3 py-2 text-right text-purple-300">Justering (Tid)</th>
                                            <th className="px-3 py-2 text-right hidden sm:table-cell">Justering (Tempo)</th>
                                            <th className="px-3 py-2 text-right hidden md:table-cell" title="Tid om du håller exakt samma tempo som basnivån (Rak fart)">Rak Fart</th>
                                            <th className="px-3 py-2 text-right">Diff</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {predictions.map((row) => {
                                            const isActive = row.label === bestPerformance.distanceLabel;
                                            const hasPB = !!row.actualPB;

                                            const diffSeconds = hasPB ? row.actualPB!.timeSeconds - row.purePredictedSeconds : 0;
                                            const diffPercent = hasPB ? (diffSeconds / row.purePredictedSeconds) * 100 : 0;

                                            // VDOT implication of this row (if it has PB)
                                            // If actual PB is slower than predicted, it means VDOT is lower for this dist.

                                            return (
                                                <tr key={row.label} className={`group hover:bg-white/5 transition-colors ${isActive ? 'bg-purple-500/10' : ''}`}>
                                                    <td className="px-3 py-1.5 font-bold text-slate-200 text-xs">
                                                        {row.label}
                                                        {isActive && <span className="ml-1.5 text-[8px] bg-purple-500/80 text-white px-1 py-0.5 rounded uppercase">Bas</span>}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono relative">
                                                        {row.actualPB ? (
                                                            <div className="flex justify-end group/pb relative">
                                                                <Link to={`/activity/${row.actualPB.activityId}`} className="text-slate-300 text-[11px] font-bold hover:text-emerald-400 hover:underline transition-colors decoration-emerald-500/50 underline-offset-4">
                                                                    {formatSeconds(Math.round(row.actualPB.timeSeconds))}
                                                                </Link>
                                                                
                                                                {/* Tooltip */}
                                                                <div className="absolute bottom-full right-0 mb-3 w-64 bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] opacity-0 group-hover/pb:opacity-100 transition-all duration-200 z-[100] pointer-events-none scale-95 group-hover/pb:scale-100 text-left">
                                                                    <div className="text-[10px] text-emerald-400 font-bold uppercase mb-2 flex items-center gap-1.5"><span className="text-xs">🏆</span> PB Detaljer: {row.label}</div>
                                                                    <div className="text-white font-bold text-sm mb-1 line-clamp-1" title={row.actualPB.activityName}>{row.actualPB.activityName}</div>
                                                                    <div className="text-slate-400 text-[10px] mb-3 pb-3 border-b border-white/5">{row.actualPB.date}</div>
                                                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Distans</span>
                                                                            <span className="font-mono text-slate-200">{(row.actualPB.activity?.performance?.distanceKm || row.actualPB.distanceKm).toFixed(2)} km</span>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Tid</span>
                                                                            <span className="font-mono text-slate-200">{formatSeconds(row.actualPB.timeSeconds)}</span>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Tempo</span>
                                                                            <span className="font-mono text-slate-200">{formatPace(row.actualPB.pace)}</span>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] text-purple-400 uppercase font-bold tracking-wider">VDOT</span>
                                                                            <span className="font-mono text-purple-300 font-bold">{row.actualPB.vdot.toFixed(1)}</span>
                                                                        </div>
                                                                        {row.actualPB.activity?.performance?.averageHr && (
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] text-rose-500 uppercase font-bold tracking-wider">Snittpuls</span>
                                                                                <span className="font-mono text-rose-400">{Math.round(row.actualPB.activity.performance.averageHr)} bpm</span>
                                                                            </div>
                                                                        )}
                                                                        {row.actualPB.activity?.performance?.elevationGain && (
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] text-amber-500 uppercase font-bold tracking-wider">Höjd</span>
                                                                                <span className="font-mono text-amber-400">+{Math.round(row.actualPB.activity.performance.elevationGain)}m</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {row.actualPB.activity?.performance?.notes && (
                                                                        <div className="mt-3 pt-3 border-t border-white/5 italic text-slate-400 text-[10px] line-clamp-2">
                                                                            "{row.actualPB.activity.performance.notes}"
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-700 text-[11px]">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-300 text-sm">
                                                        {formatSeconds(Math.round(row.purePredictedSeconds))}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-purple-300 text-sm">
                                                        {formatSeconds(Math.round(row.predictedSeconds))}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-400 text-[11px] hidden sm:table-cell">
                                                        {formatPace(row.predictedSeconds / 60 / row.km)}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-500 text-[11px] hidden md:table-cell" title={`${formatPace(bestPerformance.pace)} min/km`}>
                                                        {formatSeconds(Math.round(bestPerformance.pace * row.km * 60))}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-[11px]">
                                                        {hasPB ? (
                                                            <div className={`flex items-center justify-end gap-1.5 ${getPerformanceColor(row.actualPB!.timeSeconds, row.purePredictedSeconds)}`}>
                                                                <span>{diffSeconds > 0 ? '+' : ''}{formatSeconds(Math.abs(Math.round(diffSeconds)))}</span>
                                                                <span className="text-[9px] opacity-60">
                                                                    ({diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-700">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-12 text-center border border-dashed border-slate-700 rounded-3xl">
                    <div className="text-4xl mb-4">🏃‍♂️💨</div>
                    <h3 className="text-xl font-bold text-white mb-2">Inga löp-data hittades</h3>
                    <p className="text-slate-400">Logga några löppass med distanser som 5km, 10km osv för att se prognoser!</p>
                </div>
            )}
        </div>
    );
}

export default ToolsRacePredictorPage;
