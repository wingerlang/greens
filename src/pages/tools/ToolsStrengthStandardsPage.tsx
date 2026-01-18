import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateWilks, calculateIPFPoints, calculateEstimated1RM } from '../../utils/strengthCalculators.ts';
import { slugify } from '../../utils/formatters.ts';
import { useData } from '../../context/DataContext.tsx';
import { ExerciseEntry } from '../../models/types.ts';
import {
    MATCH_PATTERNS as GLOBAL_MATCH,
    EXCLUDE_PATTERNS as GLOBAL_EXCLUDE,
    MIN_WEIGHT_THRESHOLD as GLOBAL_MIN,
    normalizeStrengthName
} from '../../utils/strengthConstants.ts';

// Standard multipliers for levels (Male Reference roughly)
// Beginner, Novice, Intermediate, Advanced, Elite
const STANDARDS = {
    male: {
        squat: [1.2, 1.5, 2.0, 2.5, 3.0],
        bench: [0.8, 1.0, 1.5, 2.0, 2.2],
        deadlift: [1.5, 2.0, 2.5, 3.0, 3.5],
        ohp: [0.5, 0.7, 0.9, 1.1, 1.3]
    },
    female: {
        squat: [0.8, 1.0, 1.3, 1.6, 2.0],
        bench: [0.5, 0.7, 0.9, 1.2, 1.5],
        deadlift: [1.0, 1.3, 1.8, 2.2, 2.6],
        ohp: [0.35, 0.5, 0.65, 0.8, 0.95]
    }
};

// Calculated Total (SBD) Standards
// Sum of Squat + Bench + Deadlift standards for each level
const TOTAL_STANDARDS = {
    male: Array.from({ length: 5 }, (_, i) =>
        STANDARDS.male.squat[i] + STANDARDS.male.bench[i] + STANDARDS.male.deadlift[i]
    ),
    female: Array.from({ length: 5 }, (_, i) =>
        STANDARDS.female.squat[i] + STANDARDS.female.bench[i] + STANDARDS.female.deadlift[i]
    )
};

const LEVEL_LABELS = ['Nybörjare', 'Motionär', 'Atlet', 'Avancerad', 'Elit', 'Världsklass'];
const LEVEL_COLORS = [
    'from-slate-600 to-slate-500', // Beginner
    'from-emerald-600 to-emerald-500', // Novice
    'from-blue-600 to-blue-500', // Intermediate
    'from-violet-600 to-violet-500', // Advanced
    'from-amber-500 to-yellow-400', // Elite
    'from-rose-600 to-rose-500' // World Class
];

// Helper to normalize text for matching - Now using global helper
const normalize = normalizeStrengthName;

const MATCH_PATTERNS = GLOBAL_MATCH;
const EXCLUDE_PATTERNS = GLOBAL_EXCLUDE;
const MIN_WEIGHT_THRESHOLD = GLOBAL_MIN;

export function ToolsStrengthStandardsPage() {
    const { getLatestWeight, strengthSessions, userSettings } = useData();

    // Inputs
    const [weight, setWeight] = useState(80);
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [unit, setUnit] = useState<'wilks' | 'ipf'>('ipf');
    const [showEstimated, setShowEstimated] = useState(false);

    // Lifts State - separate tracking for Actual vs Estimated
    const [lifts, setLifts] = useState({
        squat: {
            weight: 0,
            erm: 0,
            actual: 0, // Heaviest weight lifted
            exerciseName: '', // Name from the best eRM set (usually the main one)
            bestSetERM: { weight: 0, reps: 0, date: '' },
            bestSetWeight: { weight: 0, reps: 0, date: '' },
            sessionId: '', // Link to session of eRM (default)
            checked: false
        },
        bench: { weight: 0, erm: 0, actual: 0, exerciseName: '', bestSetERM: { weight: 0, reps: 0, date: '' }, bestSetWeight: { weight: 0, reps: 0, date: '' }, sessionId: '', checked: false },
        deadlift: { weight: 0, erm: 0, actual: 0, exerciseName: '', bestSetERM: { weight: 0, reps: 0, date: '' }, bestSetWeight: { weight: 0, reps: 0, date: '' }, sessionId: '', checked: false },
        ohp: { weight: 0, erm: 0, actual: 0, exerciseName: '', bestSetERM: { weight: 0, reps: 0, date: '' }, bestSetWeight: { weight: 0, reps: 0, date: '' }, sessionId: '', checked: false }
    });

    // --- AUTO-DETECTION EFFECT ---
    useEffect(() => {
        // 1. Detect Bodyweight
        const currentBw = getLatestWeight();
        if (currentBw) setWeight(currentBw);

        // Safety check for gender existence on settings
        const settingsGender = (userSettings as any)?.gender;
        if (settingsGender && (settingsGender === 'male' || settingsGender === 'female')) {
            setGender(settingsGender);
        }

        // 2. Detect Lifts
        const newLifts = { ...lifts };
        let hasUpdates = false;

        (['squat', 'bench', 'deadlift', 'ohp'] as const).forEach(key => {
            const patterns = MATCH_PATTERNS[key];
            const excludes = EXCLUDE_PATTERNS[key];
            const minWeight = MIN_WEIGHT_THRESHOLD[key];

            let maxERM = 0;
            let maxWeight = 0; // Heaviest lift regardless of reps

            let bestName = ''; // Name associated with the best eRM (usually the most representative)
            let bestSessionId = ''; // Linked session

            let bestSetERM = { weight: 0, reps: 0, date: '' };
            let bestSetWeight = { weight: 0, reps: 0, date: '' };

            // Use strengthSessions which contains detailed set data
            strengthSessions.forEach(session => {
                session.exercises.forEach(exercise => {
                    const normName = normalize(exercise.exerciseName || '');

                    // Check patterns match AND exclusions don't match
                    const matchesPattern = patterns.some(p => normName.includes(p));
                    const matchesExclusion = excludes.some(e => normName.includes(e));

                    if (matchesPattern && !matchesExclusion) {
                        exercise.sets.forEach(set => {
                            const w = set.weight || 0;
                            const r = set.reps || 0;

                            // CRITICAL: Must meet minimum weight threshold to avoid garbage data
                            if (w >= minWeight && r > 0) {
                                // 1. Calculate eRM (Best Limit Strength Potential)
                                const est = calculateEstimated1RM(w, r);
                                if (est > maxERM) {
                                    maxERM = est;
                                    bestName = exercise.exerciseName;
                                    bestSessionId = session.id;
                                    bestSetERM = { weight: w, reps: r, date: session.date };
                                }

                                // 2. Actual Heaviest Lift (User defined "Actual 1RM")
                                // "Highest weight ever lifted, even if 2RM"
                                if (w > maxWeight) {
                                    maxWeight = w;
                                    bestSetWeight = { weight: w, reps: r, date: session.date };
                                }
                            }
                        });
                    }
                });
            });

            // Only update if we found valid data above minimum threshold
            if (maxERM > 0 || maxWeight > 0) {
                // Determine what to display based on toggle
                // If showEstimated: maxERM
                // If NOT showEstimated: maxWeight (Actual Heaviest)
                // Fallback: If maxWeight is 0 (impossible if maxERM>0 usually), use maxERM
                const valToSet = showEstimated ? Math.round(maxERM) : (maxWeight > 0 ? maxWeight : Math.round(maxERM));

                newLifts[key] = {
                    weight: valToSet,
                    erm: Math.round(maxERM),
                    actual: maxWeight, // Storing maxWeight as "actual"
                    exerciseName: bestName || 'Unknown',
                    sessionId: bestSessionId, // Link to eRM session (usually most impressive)
                    bestSetERM,
                    bestSetWeight,
                    checked: true
                };
                hasUpdates = true;
            } else {
                // Reset if no valid data found
                newLifts[key] = {
                    weight: 0, erm: 0, actual: 0, exerciseName: '', sessionId: '', checked: false,
                    bestSetERM: { weight: 0, reps: 0, date: '' },
                    bestSetWeight: { weight: 0, reps: 0, date: '' }
                };
                hasUpdates = true;
            }
        });

        if (hasUpdates) setLifts(newLifts);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strengthSessions, userSettings]); // Re-run if settings (gender) changes too

    // Effect to handle toggle change without re-scanning (optimize?) 
    // Actually, simpler to just re-apply preferences if user toggles.
    useEffect(() => {
        setLifts(prev => {
            const next = { ...prev };
            (['squat', 'bench', 'deadlift', 'ohp'] as const).forEach(k => {
                // If user hasn't manually messed with it too much? 
                // We just switch the value to the other source if available.
                if (showEstimated) {
                    next[k].weight = next[k].erm;
                } else {
                    next[k].weight = next[k].actual || next[k].erm;
                }
            });
            return next;
        });
    }, [showEstimated]);

    const handleLiftChange = (key: keyof typeof lifts, val: number) => {
        setLifts(prev => ({ ...prev, [key]: { ...prev[key], weight: val } }));
    };

    // Calculate Total & Score
    const total = lifts.squat.weight + lifts.bench.weight + lifts.deadlift.weight;
    const score = unit === 'wilks'
        ? calculateWilks(weight, total, gender)
        : calculateIPFPoints(weight, total, gender);

    // Determines level index (0-5)
    const getLevelIndex = (val: number, standardArr: number[]) => {
        const ratio = val / weight;
        let idx = 0;
        for (let i = 0; i < standardArr.length; i++) {
            if (ratio >= standardArr[i]) idx = i + 1;
        }
        return Math.min(idx, 5);
    };

    // Get stats for visualization
    const getLiftStats = (key: keyof typeof lifts) => {
        const val = lifts[key].weight;
        const eRM = lifts[key].erm;
        const std = STANDARDS[gender][key];
        const levelIdx = getLevelIndex(val, std);

        // Next goal
        const nextRatio = std[Math.min(levelIdx, std.length - 1)];
        const nextWeight = Math.round(nextRatio * weight);

        return {
            val,
            eRM,
            levelLabel: LEVEL_LABELS[levelIdx],
            levelColor: LEVEL_COLORS[levelIdx],
            levelIdx,
            ratio: val / weight,
            nextWeight,
            nextLabel: LEVEL_LABELS[Math.min(levelIdx + 1, 5)],
            percentToNext: Math.min(100, Math.max(0, (val / (std[levelIdx] * weight)) * 100)) // Approximation
        };
    };

    // Calculate Recommendation (Easies gain)
    const focusRecommendation = useMemo(() => {
        let best: { lift: 'squat' | 'bench' | 'deadlift' | 'ohp'; diff: number; nextLabel: string; pct: number } | null = null;
        (['squat', 'bench', 'deadlift', 'ohp'] as const).forEach(lift => {
            const { val, nextWeight, nextLabel, levelIdx } = getLiftStats(lift);
            if (levelIdx >= 5) return; // World Class

            // Calculate diff
            const diff = Math.max(0, nextWeight - val);
            // "Easiness" = relative increase needed? Or absolute kg?
            // 5kg on bench is harder than 5kg on deadlift. 
            // Use Percentage increase: diff / val
            const pctIncrease = val > 0 ? diff / val : 100;

            if (!best || pctIncrease < best.pct) {
                best = { lift, diff, nextLabel, pct: pctIncrease };
            }
        });
        return best;
    }, [lifts, weight, gender]);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="text-center md:text-left">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">
                    Styrkestandard
                </h1>
                <p className="text-slate-400 max-w-2xl">
                    Analysera din styrka mot globala standarder. Vi har automatiskt hämtat dina bästa lyft från din historik.
                </p>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid lg:grid-cols-12 gap-6">

                {/* LEFT: Inputs & Core Settings */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Settings Card */}
                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Profil & Inställningar</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Kroppsvikt (kg)</label>
                                <input
                                    type="number"
                                    value={weight}
                                    onChange={(e) => setWeight(Number(e.target.value))}
                                    className="w-full bg-slate-950 border-b border-white/10 px-0 py-2 text-xl font-bold text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Kön</label>
                                <div className="flex gap-1 bg-slate-950 rounded-lg p-1">
                                    <button onClick={() => setGender('male')} className={`flex-1 rounded p-1 text-xs font-bold ${gender === 'male' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>Man</button>
                                    <button onClick={() => setGender('female')} className={`flex-1 rounded p-1 text-xs font-bold ${gender === 'female' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>Kvinna</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mb-2">
                            <button onClick={() => setUnit('ipf')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${unit === 'ipf' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>IPF GL</button>
                            <button onClick={() => setUnit('wilks')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${unit === 'wilks' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Wilks</button>
                        </div>
                    </div>

                    {/* Lifts Input Card */}
                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span>Dina Max</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${showEstimated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                                    {showEstimated ? 'Estimerat' : 'Faktiskt'}
                                </span>
                            </h3>
                            <button
                                onClick={() => setShowEstimated(!showEstimated)}
                                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                                {showEstimated ? 'Visa Faktiskt 1RM' : 'Visa e1RM'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {(['squat', 'bench', 'deadlift', 'ohp'] as const).map(lift => {
                                const detected = showEstimated ? lifts[lift].erm : (lifts[lift].actual || lifts[lift].erm);
                                const isModified = lifts[lift].weight !== detected && detected > 0;
                                const liftLabel = lift === 'ohp' ? 'Militärpress' : lift === 'bench' ? 'Bänkpress' : lift === 'squat' ? 'Knäböj' : 'Marklyft';

                                // Source info depends on what mode we are in
                                const sourceSet = showEstimated ? lifts[lift].bestSetERM : lifts[lift].bestSetWeight;
                                const sourceValid = sourceSet && sourceSet.weight > 0;

                                return (
                                    <div key={lift} className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                {lifts[lift].exerciseName ? (
                                                    <Link
                                                        to={`/styrka/${slugify(lifts[lift].exerciseName)}`}
                                                        className="text-xs text-emerald-400 font-bold uppercase hover:text-emerald-300 transition-colors"
                                                    >
                                                        {liftLabel} →
                                                    </Link>
                                                ) : (
                                                    <div className="text-xs text-slate-400 font-bold uppercase">{liftLabel}</div>
                                                )}
                                                <div className="text-[10px] text-slate-500">
                                                    {lifts[lift].exerciseName ? (
                                                        <span title={lifts[lift].exerciseName}>{lifts[lift].exerciseName.substring(0, 20)}{lifts[lift].exerciseName.length > 20 ? '...' : ''}</span>
                                                    ) : (
                                                        <span className="italic">Ingen data</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="relative flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    step="2.5"
                                                    value={lifts[lift].weight}
                                                    onChange={(e) => handleLiftChange(lift, parseFloat(e.target.value) || 0)}
                                                    className="w-20 bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-right text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                                                />
                                                <span className="text-xs text-slate-500">kg</span>
                                                {isModified && (
                                                    <button
                                                        onClick={() => handleLiftChange(lift, detected)}
                                                        className="text-slate-500 hover:text-emerald-400 p-1 transition-colors"
                                                        title={`Återställ till ${detected}kg`}
                                                    >
                                                        ↺
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* DEBUG INFO: Source of PB */}
                                        {sourceValid && (
                                            <div className="text-[9px] text-slate-500 font-mono text-right border-t border-white/5 pt-1 mt-0.5">
                                                Källa ({showEstimated ? 'eRM' : 'Max'}): {sourceSet.weight}kg x {sourceSet.reps} ({sourceSet.date})
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                                <div className="text-sm text-slate-400 font-medium">Total (SBD)</div>
                                <div className="text-3xl font-black text-white">{total} <span className="text-base font-normal text-slate-500">kg</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Visualizations */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* Hero Score Card */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-white/5 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="text-center md:text-left z-10">
                            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-2">
                                {score.toFixed(1)}
                            </h2>
                            <div className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-1">
                                {unit.toUpperCase()} POÄNG
                            </div>
                            <div className="text-xs text-center text-slate-500 font-mono mt-3">
                                {unit === 'wilks' ? 'Wilks Koefficient' : 'IPF GL Points'}
                            </div>
                        </div>

                        {/* Recommendation Card */}
                        {focusRecommendation && (() => {
                            const rec = focusRecommendation;
                            const liftName = rec.lift === 'ohp' ? 'Militärpress' : rec.lift === 'bench' ? 'Bänkpress' : rec.lift === 'squat' ? 'Knäböj' : 'Marklyft';
                            return (
                                <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-3xl p-6 flex flex-col justify-center">
                                    <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">💡 Snabbaste vägen upp</h3>
                                    <div className="text-white">
                                        <span className="text-slate-400">Öka </span>
                                        <strong className="text-xl capitalize text-indigo-300">{liftName}</strong>
                                        <span className="text-slate-400"> med </span>
                                        <strong className="text-xl text-white">{Math.round(rec.diff)}kg</strong>
                                    </div>
                                    <div className="text-xs text-indigo-400/70 mt-1">
                                        För att nå nivå <strong className="text-indigo-300 uppercase">{rec.nextLabel}</strong>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Level Badge */}
                        <div className="relative z-10 w-full md:w-auto">
                            <div className="bg-slate-950/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center min-w-[200px]">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">NUVARANDE NIVÅ</div>
                                {(() => {
                                    // Calculate level based on SBD Total Standards
                                    // We sum the individual lift ratio standards to get the total ratio standard
                                    const sbdRatio = total / weight;
                                    const stds = TOTAL_STANDARDS[gender];

                                    let totalLevelIdx = 0;
                                    for (let i = 0; i < stds.length; i++) {
                                        if (sbdRatio >= stds[i]) totalLevelIdx = i + 1;
                                    }
                                    totalLevelIdx = Math.min(totalLevelIdx, 5);

                                    return (
                                        <div className={`text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br ${LEVEL_COLORS[totalLevelIdx]} mb-2`}>
                                            {LEVEL_LABELS[totalLevelIdx]}
                                        </div>
                                    );
                                })()}
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 w-3/4 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bars for Each Lift */}
                    <div className="grid gap-4">
                        {(['squat', 'bench', 'deadlift', 'ohp'] as const).map(lift => {
                            const stats = getLiftStats(lift);
                            const maxVal = Math.max(stats.val * 1.5, STANDARDS[gender][lift][4] * weight);

                            return (
                                <div key={lift} className="bg-slate-900 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group">
                                    <div className="flex justify-between items-end mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                {lifts[lift].exerciseName ? (
                                                    <Link to={`/styrka/${slugify(lifts[lift].exerciseName)}`} className="text-lg font-bold text-white capitalize hover:text-emerald-400 decoration-emerald-500/50 hover:underline transition-all">
                                                        {lift === 'ohp' ? 'Militärpress' : lift === 'bench' ? 'Bänkpress' : lift === 'squat' ? 'Knäböj' : 'Marklyft'}
                                                    </Link>
                                                ) : (
                                                    <span className="text-lg font-bold text-white capitalize">{lift === 'ohp' ? 'Militärpress' : lift === 'bench' ? 'Bänkpress' : lift === 'squat' ? 'Knäböj' : 'Marklyft'}</span>
                                                )}
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-gradient-to-r ${stats.levelColor} text-white/90`}>
                                                    {stats.levelLabel}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                Starkare än <span className="text-emerald-400 font-bold">{Math.min(99, Math.round(stats.ratio * 25))}%</span> av motionärer (est.)
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-white">{stats.val} <span className="text-sm font-medium text-slate-500">kg</span></div>
                                            <div className="text-[10px] text-slate-500">{stats.ratio.toFixed(2)}x BW</div>
                                        </div>
                                    </div>

                                    {/* The Visual Bar */}
                                    <div className="relative h-6 bg-slate-800 rounded-full w-full mb-2 flex">
                                        {/* Segmented Levels (for hover) */}
                                        {LEVEL_COLORS.map((color, i) => {
                                            // Calculate absolute kg range for this level
                                            // Level 0: 0 -> Standards[0]
                                            const prevReq = i === 0 ? 0 : STANDARDS[gender][lift][i - 1] * weight;
                                            const nextReq = i < 5 ? STANDARDS[gender][lift][i] * weight : maxVal * 1.2; // Extend last segment

                                            // Calculate width percentage relative to maxVal
                                            // We clamp start and end to [0, maxVal] visual range
                                            const startKg = prevReq;
                                            const endKg = Math.min(maxVal, nextReq);

                                            // If segment starts after maxVal (e.g. user is weak, scale is small, elit is far out), dont render?
                                            // Actually maxVal is dynamic based on user or standard, so standards fit usually.
                                            // But maxVal is at least Elite.

                                            const widthKg = Math.max(0, endKg - startKg);
                                            const widthPct = (widthKg / maxVal) * 100;

                                            if (widthPct <= 0) return null;

                                            return (
                                                <div
                                                    key={i}
                                                    className={`h-full bg-gradient-to-r ${color} relative group/segment border-r border-slate-900/10 hover:brightness-110 transition-all cursor-crosshair first:rounded-l-full last:rounded-r-full`}
                                                    style={{ width: `${widthPct}%` }}
                                                >
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/segment:block z-30 whitespace-nowrap">
                                                        <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-white/10 shadow-xl backdrop-blur-md">
                                                            <div className="font-bold text-emerald-400 mb-0.5">{LEVEL_LABELS[i]}</div>
                                                            <div className="text-[10px] text-slate-300 font-mono">
                                                                {Math.round(prevReq)} - {Math.round(nextReq)} kg
                                                            </div>
                                                        </div>
                                                        {/* Arrow */}
                                                        <div className="w-2 h-2 bg-slate-900 border-r border-b border-white/10 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* User Marker with Hover */}
                                        <div
                                            className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] z-20 transition-all duration-500 group/marker cursor-pointer rounded-full"
                                            style={{ left: `${Math.min(98, Math.max(1, (stats.val / maxVal) * 100))}%` }}
                                        >
                                            {/* Marker Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/marker:block z-40 whitespace-nowrap">
                                                <div className="bg-slate-950 text-white text-xs px-4 py-3 rounded-xl border border-white/20 shadow-2xl">
                                                    <div className="font-black text-lg text-white mb-1">{stats.val}kg</div>
                                                    <div className="text-[10px] text-slate-400 mb-2">Ditt nuvarande 1RM</div>
                                                    {lifts[lift].sessionId && (
                                                        <Link
                                                            to={`/styrka/${slugify(lifts[lift].exerciseName)}`}
                                                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                                                        >
                                                            Se övning →
                                                        </Link>
                                                    )}
                                                </div>
                                                <div className="w-3 h-3 bg-slate-950 border-r border-b border-white/20 transform rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
                                            </div>
                                        </div>

                                        {/* Potential Marker (eRM) - if eRM > 1RM */}
                                        {stats.eRM > stats.val && (
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/60 z-10 border-l border-dashed border-emerald-400"
                                                style={{ left: `${Math.min(100, (stats.eRM / maxVal) * 100)}%` }}
                                                title={`Estimerat potential: ${stats.eRM}kg`}
                                            ></div>
                                        )}
                                    </div>

                                    <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                                        <span>
                                            {stats.nextLabel && (
                                                <span className="text-emerald-500 font-bold">{Math.max(0, stats.nextWeight - stats.val)}kg till {stats.nextLabel}</span>
                                            )}
                                        </span>
                                        <span>{Math.round(maxVal)}kg+</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
