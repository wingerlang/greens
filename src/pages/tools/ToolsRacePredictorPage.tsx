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
            const d = a.performance?.distanceKm || 0;
            // Check if distance is within tolerance
            return d >= dist.km - dist.tolerance && d <= dist.km + dist.tolerance;
        });

        if (matches.length === 0) return;

        // Find the FASTEST match (highest speed = lowest time for normalized distance, or highest VDOT)
        let bestScore = -1;
        let bestEntry: PBAnalysis | null = null;

        matches.forEach(m => {
            const d = m.performance?.distanceKm || dist.km;
            const t = (m.performance?.durationMinutes || 0) * 60; // seconds
            if (t <= 0 || d <= 0) return;

            // Normalize time to exact distance? 
            // Better: Calculate VDOT for this specific performace
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
                    vdot: vdot
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
    const { universalActivities } = useData();
    const [improvementFactor, setImprovementFactor] = useState(0); // Percent -10 to +10

    // 1. Analyze Data
    const pbs = useMemo(() => {
        return analyzePBs(universalActivities || []);
    }, [universalActivities]);

    // 2. Find "Gold Standard" (Best VDOT)
    const bestPerformance = useMemo(() => {
        if (pbs.length === 0) return null;
        return pbs.reduce((prev, current) => (prev.vdot > current.vdot) ? prev : current);
    }, [pbs]);

    // 3. Calculate Predictions based on Best VDOT (+ adjustment)
    const predictions = useMemo(() => {
        if (!bestPerformance) return [];

        // Base VDOT from best performance
        // If improvement is +5%, does that mean Time -5% or VDOT +5%? 
        // Usually runners think in time. "If I get 2% faster".
        // VDOT is non-linear. Let's adjust the VDOT to correspond to X% faster time at standard distance?
        // Simpler: Adjust the VDOT directly by valid approximation or re-calculate.

        // Let's assume improvementFactor applies to VDOT roughly linearly for small ranges, 
        // or better: Adjust the base VDOT.
        // Jack Daniels: +1 VDOT is roughly 1.5-2% performance.

        // Better approach:
        // 1. Calculate Predicted Time for Distance X using Base VDOT.
        // 2. Apply Improvement Factor to that Time directly.

        const baseVDOT = bestPerformance.vdot;

        // Effect of improvement on VDOT:
        // If I want to be 1% faster, my VDOT needs to go up.
        // Let's apply the factor to the VDOT for the *source* calculation, then predict?
        // No, simplest user logic: "Show me times 2% faster".

        return DISTANCES.map(d => {
            const baseTime = predictRaceTime(baseVDOT, d.km); // seconds
            // Improvement factor: positive = faster (less time)
            // factor 2% => time * 0.98
            const adjustedTime = baseTime * (1 - (improvementFactor / 100));

            // Find specific PB for this distance if it exists
            const actualPB = pbs.find(p => p.distanceLabel === d.label);

            return {
                ...d,
                predictedSeconds: adjustedTime,
                basePredictedSeconds: baseTime,
                actualPB
            };
        });
    }, [bestPerformance, pbs, improvementFactor]);

    if (!universalActivities) return <div className="p-10 text-slate-400">Laddar...</div>;

    const getPerformanceColor = (actual: number, predicted: number) => {
        // lower is better
        const diff = actual - predicted; // distinct seconds
        if (diff <= -30) return 'text-emerald-400'; // Way faster than predicted!
        if (diff <= 10) return 'text-blue-400'; // Spot on
        return 'text-rose-400'; // Slower
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
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
                                    <span>🏆</span> Din Gold Standard
                                </div>
                                <h2 className="text-5xl font-black text-white mb-2">
                                    {bestPerformance.distanceLabel}
                                </h2>
                                <div className="text-3xl text-purple-400 font-mono font-bold mb-4">
                                    {formatSeconds(Math.round(bestPerformance.timeSeconds))}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                    <div className="flex flex-col">
                                        <span className="uppercase text-[10px] tracking-wider font-bold">VDOT</span>
                                        <span className="text-xl text-white font-bold">{bestPerformance.vdot}</span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="uppercase text-[10px] tracking-wider font-bold">Tempo</span>
                                        <span className="text-xl text-white font-bold">{formatPace(bestPerformance.pace)}</span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="uppercase text-[10px] tracking-wider font-bold">Datum</span>
                                        <span className="text-white">{bestPerformance.date}</span>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <Link
                                        to={`/activity/${bestPerformance.activityId}`}
                                        className="text-xs font-bold text-purple-400 hover:text-purple-300 underline underline-offset-4 decoration-purple-500/30"
                                    >
                                        Visa aktivitet &rarr;
                                    </Link>
                                </div>
                            </div>

                            {/* EXTRAPOLATION CONTROLS */}
                            <div className="bg-slate-950/50 rounded-2xl p-6 border border-white/5">
                                <label className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Simulera förbättring</span>
                                    <span className={`text-2xl font-black ${improvementFactor > 0 ? 'text-emerald-400' : improvementFactor < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
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
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono uppercase">
                                    <span>-10%</span>
                                    <span>0% (Nu)</span>
                                    <span>+20%</span>
                                </div>
                                <div className="mt-4 text-xs text-slate-400 leading-relaxed">
                                    Dra i reglaget för att se hur dina tider skulle se ut om du blev <strong>{Math.abs(improvementFactor)}%</strong> {improvementFactor >= 0 ? 'snabbare' : 'långsammare'}.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* THE MATRIX */}
                    <div className="grid lg:grid-cols-1 gap-6">
                        <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                                        <tr>
                                            <th className="px-6 py-4 text-left">Distans</th>
                                            <th className="px-6 py-4 text-right">Ditt PB</th>
                                            <th className="px-6 py-4 text-right text-purple-300">Prognos</th>
                                            <th className="px-6 py-4 text-right hidden sm:table-cell">Tempo (Pred)</th>
                                            <th className="px-6 py-4 text-right">Diff</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {predictions.map((row) => {
                                            const isActive = row.label === bestPerformance.distanceLabel;
                                            const hasPB = !!row.actualPB;

                                            const diffSeconds = hasPB ? row.actualPB!.timeSeconds - row.predictedSeconds : 0;
                                            const diffPercent = hasPB ? (diffSeconds / row.predictedSeconds) * 100 : 0;

                                            // VDOT implication of this row (if it has PB)
                                            // If actual PB is slower than predicted, it means VDOT is lower for this dist.

                                            return (
                                                <tr key={row.label} className={`group hover:bg-white/5 transition-colors ${isActive ? 'bg-purple-500/10' : ''}`}>
                                                    <td className="px-6 py-4 font-bold text-white">
                                                        {row.label}
                                                        {isActive && <span className="ml-2 text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">Best</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                                                        {row.actualPB ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-white">{formatSeconds(Math.round(row.actualPB.timeSeconds))}</span>
                                                                <span className="text-[10px] text-slate-500">{row.actualPB.date}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-700">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-purple-300 text-lg">
                                                        {formatSeconds(Math.round(row.predictedSeconds))}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-400 hidden sm:table-cell">
                                                        {formatPace(row.predictedSeconds / 60 / row.km)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono">
                                                        {hasPB ? (
                                                            <div className={getPerformanceColor(row.actualPB!.timeSeconds, row.basePredictedSeconds)}>
                                                                {diffSeconds > 0 ? '+' : ''}{formatSeconds(Math.abs(Math.round(diffSeconds)))}
                                                                {/* Interactive improvement diff if slider moved? No, keep diff static vs ACTUAL benchmark? 
                                                                    Actually user wants to see "If I improve X%, what is the time?" 
                                                                    The "Diff" column usually compares PB vs Original Prediction (to show weakness).
                                                                    Let's keep Diff comparing Actual vs Extrapolated? No, Actual vs Baseline is cleaner for analysis.
                                                                    Let's compare Actual vs PREDICTED (Extrapolated).
                                                                */}
                                                                <div className="text-[10px] opacity-60">
                                                                    {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-700 text-xs">Ingen data</span>
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
