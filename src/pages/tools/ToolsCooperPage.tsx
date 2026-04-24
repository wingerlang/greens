import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateCooperVO2, formatPace, formatSeconds, calculateVDOT, predictRaceTime, convertTimeToPace, parseSmartTime, formatSmartTime } from '../../utils/runningCalculator.ts';
import { useData } from '../../context/DataContext.tsx';
import {
    COOPER_STANDARDS,
    getCooperStandard,
    getDetailedCooperGrade,
    COOPER_LEVEL_COLORS,
    COOPER_LEVEL_TEXT_COLORS,
    type CooperLevel
} from './data/cooperStandards.ts';
import { CooperRacePredictor } from './CooperRacePredictor.tsx';

// Define the activity type locally if simpler, or use 'any' safely for now since unifiedActivities is likely complex
// unifiedActivities usually has a type. Let's rely on basic inference being clearer if we initialize null properly.
// But unifiedActivities comes from context. Let's use 'any' for the variable to avoid detailed type matching now.

export default function ToolsCooperPage() {
    const { userSettings, unifiedActivities } = useData();

    // State
    const [distInput, setDistInput] = useState("2400");
    const [timeInput, setTimeInput] = useState("12:00");
    const [paceInput, setPaceInput] = useState("5:00");

    const distance = parseFloat(distInput) || 0;
    const durationSecs = parseSmartTime(timeInput);

    const handleDistanceChange = (val: string) => {
        setDistInput(val);
        const d = parseFloat(val) || 0;
        const tSecs = parseSmartTime(timeInput);
        if (d > 0 && tSecs > 0) {
            const paceSecPerKm = (tSecs / d) * 1000;
            setPaceInput(formatSmartTime(paceSecPerKm));
        }
    };

    const handleTimeChange = (val: string) => {
        setTimeInput(val);
        const tSecs = parseSmartTime(val);
        const d = parseFloat(distInput) || 0;
        if (d > 0 && tSecs > 0) {
            const paceSecPerKm = (tSecs / d) * 1000;
            setPaceInput(formatSmartTime(paceSecPerKm));
        }
    };

    const handleTimeBlur = () => {
        const tSecs = parseSmartTime(timeInput);
        if (tSecs > 0) setTimeInput(formatSmartTime(tSecs));
    };

    const handlePaceChange = (val: string) => {
        setPaceInput(val);
        const pSecs = parseSmartTime(val);
        const d = parseFloat(distInput) || 0;
        if (d > 0 && pSecs > 0) {
            const tSecs = (d / 1000) * pSecs;
            setTimeInput(formatSmartTime(tSecs));
        }
    };

    const handlePaceBlur = () => {
        const pSecs = parseSmartTime(paceInput);
        if (pSecs > 0) setPaceInput(formatSmartTime(pSecs));
    };

    const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentSecs = parseSmartTime(timeInput);
            const delta = e.key === 'ArrowUp' ? 1 : -1;
            const step = e.shiftKey ? 10 : 1;
            const newSecs = Math.max(0, currentSecs + (delta * step));

            setTimeInput(formatSmartTime(newSecs));
            const d = parseFloat(distInput) || 0;
            if (d > 0 && newSecs > 0) {
                const paceSecPerKm = (newSecs / d) * 1000;
                setPaceInput(formatSmartTime(paceSecPerKm));
            }
        }
    };

    const handlePaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentSecs = parseSmartTime(paceInput);
            const delta = e.key === 'ArrowUp' ? 1 : -1;
            const step = e.shiftKey ? 10 : 1;
            const newSecs = Math.max(0, currentSecs + (delta * step));

            setPaceInput(formatSmartTime(newSecs));
            const d = parseFloat(distInput) || 0;
            if (d > 0 && newSecs > 0) {
                const tSecs = (d / 1000) * newSecs;
                setTimeInput(formatSmartTime(tSecs));
            }
        }
    };

    // Default age based on birthYear if available, otherwise 30
    const [age, setAge] = useState(() => {
        if (userSettings?.birthYear) {
            return new Date().getFullYear() - userSettings.birthYear;
        }
        return 30;
    });
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [showFullTable, setShowFullTable] = useState(true);
    const [prefillSource, setPrefillSource] = useState<{
        id: string,
        name: string,
        date: string,
        dist: number,
        duration: number, // seconds
        pace: string
    } | null>(null);
    const [recentCooperRuns, setRecentCooperRuns] = useState<any[]>([]);

    // Update age if userSettings load later
    useEffect(() => {
        if (userSettings?.birthYear && age === 30) {
            setAge(new Date().getFullYear() - userSettings.birthYear);
        }
    }, [userSettings?.birthYear]);

    // Prefill from Settings & Activities
    useEffect(() => {
        if (userSettings) {
            const settings = userSettings as any;
            if (settings.birthYear) {
                const calculatedAge = new Date().getFullYear() - Number(settings.birthYear);
                setAge(calculatedAge);
            }
            if (settings.gender === 'male' || settings.gender === 'female') {
                setGender(settings.gender);
            }
        }

        // Auto-detect best running performance
        if (unifiedActivities && unifiedActivities.length > 0) {
            const runs = unifiedActivities.filter(a => a.type === 'running' && (a.durationMinutes || 0) >= 10);

            // Find recent 12-min ish runs (between 11.5 and 12.5 mins)
            const cooperCandidates = runs.filter(r => {
                const dur = r.durationMinutes || 0;
                return dur >= 11.5 && dur <= 12.5;
            }).slice(0, 5); // Take top 5 recent

            setRecentCooperRuns(cooperCandidates);

            let bestVDOT = 0;
            // Explicitly type bestActivity as any to avoid 'never' inference
            let bestActivity: any = null;

            runs.forEach(run => {
                const durMin = run.durationMinutes || 0;
                const distKm = run.distance || 0;

                if (durMin > 0 && distKm > 0) {
                    const vdot = calculateVDOT(distKm, durMin * 60);
                    if (vdot > bestVDOT) {
                        bestVDOT = vdot;
                        bestActivity = run;
                    }
                }
            });

            if (bestVDOT > 0 && bestActivity) {
                // Now find the Cooper Distance (12 min) that matches this VDOT
                // We use a simple binary search against predictRaceTime to be consistent with the Predictor
                let low = 1500;
                let high = 5000;
                let derivedDist = 2400; // default fallout

                for (let i = 0; i < 15; i++) {
                    const mid = (low + high) / 2;
                    // predictRaceTime returns seconds for a distance
                    const predictedSeconds = predictRaceTime(bestVDOT, mid / 1000);
                    const diff = predictedSeconds - (12 * 60);

                    if (Math.abs(diff) < 1) { // Close enough (1 sec)
                        derivedDist = mid;
                        break;
                    }

                    // If predicted time > 12 mins, the distance (mid) is too long for 12 mins.
                    if (predictedSeconds > 12 * 60) {
                        high = mid;
                    } else {
                        low = mid;
                    }
                    derivedDist = mid;
                }

                setDistInput(Math.round(derivedDist).toString());
                setTimeInput("12:00");
                const pSecs = derivedDist > 0 ? (12 * 60) / (derivedDist / 1000) : 0;
                setPaceInput(formatSmartTime(pSecs));

                const durationSec = (bestActivity.durationMinutes || 0) * 60;
                const paceSecPerKm = durationSec / (bestActivity.distance || 1);

                setPrefillSource({
                    id: bestActivity.id || bestActivity.externalId || '',
                    name: bestActivity.title || 'Löpning',
                    date: bestActivity.date,
                    dist: bestActivity.distance || 0,
                    duration: durationSec,
                    pace: formatSeconds(Math.round(paceSecPerKm))
                });
            }
        }
    }, [userSettings, unifiedActivities]);

    // Calculations
    // Note: The Cooper test requires the distance covered in *exactly* 12 minutes.
    // If user enters e.g. 2500m in 10 minutes, their pace is 4:00/km.
    // In 12 minutes at that pace, they would cover: (12 / 10) * 2500 = 3000m.
    // We use this "adjusted 12-min distance" for the actual Cooper evaluation.
    const currentPaceDecimalMinPerKm = durationSecs > 0 ? (durationSecs / 60) / (distance / 1000 || 1) : 0;
    const adjusted12MinDistance = currentPaceDecimalMinPerKm > 0 ? (12 / currentPaceDecimalMinPerKm) * 1000 : 0;
    const evaluationDistance = durationSecs === 12 * 60 ? distance : adjusted12MinDistance;

    const vo2 = calculateCooperVO2(evaluationDistance);
    const standard = useMemo(() => getCooperStandard(age, gender), [age, gender]);

    // Grade Details
    const details = useMemo(() => {
        if (!standard) return null;
        return getDetailedCooperGrade(evaluationDistance, standard);
    }, [evaluationDistance, standard]);

    // Pace Calculations (decimal minutes / km)
    const currentPace = currentPaceDecimalMinPerKm;

    // Next Level Logic
    // nextLevelDistance is the LOWER bound of the next level.
    const nextLevelThreshold = details?.nextLevel && standard
        ? (standard.levels[details.nextLevel.toLowerCase() as keyof typeof standard.levels] || 0)
        : 0;

    const distanceToNext = Math.round(Math.max(0, nextLevelThreshold - evaluationDistance));

    // convertTimeToPace returns seconds per km. formatPace expects decimal minutes.
    const nextLevelPaceSec = convertTimeToPace(nextLevelThreshold / 1000, 12 * 60);
    const nextLevelPace = nextLevelPaceSec / 60; // Decimal minutes

    // Pace Improvement (against current pace, not exactly 12m limit if duration is different, but pace is pace)
    const paceImprovementRaw = Math.max(0, currentPace - nextLevelPace);
    // Suppress pace improvement if it's crazy high (e.g. > 4 min/km improvement needed)
    const showPaceImprovement = paceImprovementRaw < 4;

    // Progress Bar Setup
    // [Very Bad] [Bad] [Average] [Good] [Excellent]
    const getProgressPercent = () => {
        if (!standard) return 0;
        const { excellent, good, average, bad } = standard.levels;

        const mapToSegment = (val: number, min: number, max: number) => {
            const ratio = (val - min) / (max - min);
            return Math.min(20, Math.max(0, ratio * 20));
        };

        const floor = Math.max(0, bad - 400);

        if (evaluationDistance < bad) return mapToSegment(evaluationDistance, floor, bad);
        if (evaluationDistance < average) return 20 + mapToSegment(evaluationDistance, bad, average);
        if (evaluationDistance < good) return 40 + mapToSegment(evaluationDistance, average, good);
        if (evaluationDistance < excellent) return 60 + mapToSegment(evaluationDistance, good, excellent);

        const ceiling = excellent + 400;
        return 80 + mapToSegment(evaluationDistance, excellent, ceiling);
    };

    const progress = getProgressPercent();

    const handleQuickSelect = (run: any) => {
        const durationSec = (run.durationMinutes || 0) * 60;
        const paceSecPerKm = durationSec / (run.distance || 1);

        const d = run.distance || 0;
        const pSecs = d > 0 ? durationSec / d : 0;
        setDistInput(Math.round(d * 1000).toString());
        setTimeInput(formatSmartTime(durationSec));
        setPaceInput(formatSmartTime(pSecs));
        setPrefillSource({
            id: run.id || run.externalId || '',
            name: run.title || 'Löpning',
            date: run.date,
            dist: run.distance || 0,
            duration: durationSec,
            pace: formatSeconds(Math.round(paceSecPerKm))
        });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div className="text-center md:text-left">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-emerald-400 mb-2">
                    Coopers Test
                </h1>
                <p className="text-slate-400 max-w-2xl">
                    Analysera din 12-minuters kapacitet.
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN: Inputs */}
                <div className="space-y-6">
                    <div className="bg-slate-900/80 border border-emerald-500/20 rounded-3xl p-6 shadow-lg shadow-emerald-900/10">
                        <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4">Dina värden</h2>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Distans (meter)</label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        value={distInput}
                                        onChange={(e) => handleDistanceChange(e.target.value)}
                                        step="10"
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-mono font-bold focus:outline-none focus:border-emerald-500 transition-colors group-hover:border-white/20"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">m</div>
                                </div>
                                <div className="mt-4 flex flex-col md:flex-row gap-4">
                                    <div className="flex-1 bg-slate-950/50 p-4 rounded-2xl border border-white/5 relative">
                                        <div className="absolute top-0 right-0 p-2 opacity-10">⏱️</div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tid</label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={timeInput}
                                                onChange={(e) => handleTimeChange(e.target.value)}
                                                onBlur={handleTimeBlur}
                                                onKeyDown={handleTimeKeyDown}
                                                placeholder="t.ex. 12:00"
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white text-xl font-mono font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-slate-950/50 p-4 rounded-2xl border border-white/5 relative">
                                        <div className="absolute top-0 right-0 p-2 opacity-10">⚡</div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tempo (/km)</label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={paceInput}
                                                onChange={(e) => handlePaceChange(e.target.value)}
                                                onBlur={handlePaceBlur}
                                                onKeyDown={handlePaceKeyDown}
                                                placeholder="t.ex. 4:30"
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white text-xl font-mono font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {durationSecs !== 12 * 60 && (
                                    <div className="mt-2 text-[10px] text-amber-500/80 bg-amber-500/10 p-2 rounded-lg italic text-center">
                                        Omräknat till 12 min blir detta ca <strong>{Math.round(evaluationDistance)}m</strong>
                                    </div>
                                )}

                                {prefillSource && (
                                    <div className="mt-3 text-[10px] text-slate-500 bg-slate-950/50 p-3 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span>🪄</span>
                                            <span className="font-bold">Baserat på:</span>
                                        </div>
                                        <div className="pl-5 space-y-1">
                                            <div className="text-white font-medium truncate">
                                                {prefillSource.id ? (
                                                    <Link to={`/activity/${prefillSource.id}`} className="hover:text-emerald-400 underline decoration-slate-700 hover:decoration-emerald-400 transition-all">
                                                        {prefillSource.name}
                                                    </Link>
                                                ) : (
                                                    prefillSource.name
                                                )}
                                            </div>
                                            <div className="flex gap-3 text-slate-600">
                                                <span>{prefillSource.dist.toFixed(2)} km</span>
                                                <span>•</span>
                                                <span>{formatSeconds(prefillSource.duration)}</span>
                                                <span>•</span>
                                                <span>{prefillSource.pace}/km</span>
                                            </div>
                                            <div className="text-slate-700">{prefillSource.date}</div>
                                        </div>
                                    </div>
                                )}

                                {recentCooperRuns.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Snabbval (Senaste ~12 min)</label>
                                        <div className="space-y-2">
                                            {recentCooperRuns.map(run => (
                                                <button
                                                    key={run.id}
                                                    onClick={() => handleQuickSelect(run)}
                                                    className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-transparent hover:border-emerald-500/30 rounded-lg p-2 transition-all flex justify-between items-center group/btn"
                                                >
                                                    <div className="truncate pr-2">
                                                        <div className="text-sm font-bold text-white group-hover/btn:text-emerald-400 transition-colors truncate">{run.title || 'Löpning'}</div>
                                                        <div className="text-[10px] text-slate-500">{new Date(run.date).toLocaleDateString('sv-SE')}</div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-sm font-mono font-bold text-emerald-300">{(run.distance * 1000).toFixed(0)}m</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">{formatSeconds(Math.round((run.durationMinutes * 60) / run.distance))}/km</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ålder</label>
                                    <input
                                        type="number"
                                        value={age}
                                        onChange={(e) => setAge(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kön</label>
                                    <div className="flex bg-slate-950 rounded-xl border border-white/10 p-1">
                                        <button
                                            onClick={() => setGender('male')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${gender === 'male' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Man
                                        </button>
                                        <button
                                            onClick={() => setGender('female')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${gender === 'female' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Kvinna
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* VO2 Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
                        <div className="relative z-10">
                            <div className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1">Beräknat VO2Max</div>
                            <div className="text-5xl font-black text-white mb-2 tracking-tight">{vo2}</div>
                            <div className="text-xs text-slate-400">ml/kg/min</div>
                        </div>
                    </div>

                    {/* Predictions */}
                    <CooperRacePredictor distance={evaluationDistance} />
                </div>

                {/* RIGHT COLUMN: Results & Visualization */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Result Card */}
                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                        {/* Background Gradient based on result */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${details ? COOPER_LEVEL_COLORS[details.grade] : 'from-slate-800 to-slate-900'} opacity-10`}></div>

                        <div className="relative z-10">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                                <div>
                                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Resultat (vid 12 min)</div>
                                    <div className={`text-4xl md:text-6xl font-black ${details ? COOPER_LEVEL_TEXT_COLORS[details.grade] : 'text-white'} drop-shadow-2xl`}>
                                        {details?.grade || 'N/A'}
                                    </div>
                                    <div className="text-sm text-slate-400 mt-2">
                                        Jämfört med män {age}-{age + 9} år (Standard)
                                    </div>
                                </div>
                                <div className="text-right hidden md:block">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Nästa nivå</div>
                                    {details?.nextLevel ? (
                                        <div className={`text-2xl font-bold ${COOPER_LEVEL_TEXT_COLORS[details.nextLevel]}`}>
                                            {details.nextLevel}
                                        </div>
                                    ) : (
                                        <div className="text-2xl font-bold text-amber-400">Maxad!</div>
                                    )}
                                </div>
                            </div>

                            {/* Advanced Progress Bar - Neon Style */}
                            <div className="mb-10 select-none relative pt-6">
                                <div className="h-6 bg-slate-950 rounded-full relative overflow-hidden flex shadow-inner shadow-black/50">
                                    {/* Segments */}
                                    {['Very Bad', 'Bad', 'Average', 'Good', 'Excellent'].map((lvl) => (
                                        <div key={lvl} className={`flex-1 border-r border-slate-900/50 bg-gradient-to-r ${COOPER_LEVEL_COLORS[lvl as CooperLevel]} opacity-20 hover:opacity-30 transition-opacity`}></div>
                                    ))}

                                    {/* User Marker - Glowing Line */}
                                    <div
                                        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)] z-20 transition-all duration-700 ease-out"
                                        style={{ left: `${Math.min(99, Math.max(1, progress))}%` }}
                                    >
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 whitespace-nowrap shadow-xl shadow-black">
                                            Du: {Math.round(evaluationDistance)}m
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-emerald-500/30 rotate-45"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between mt-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">
                                    <span>Very Bad</span>
                                    <span>Bad</span>
                                    <span>Average</span>
                                    <span>Good</span>
                                    <span>Excellent</span>
                                </div>
                            </div>

                            {/* Insight / Next Steps */}
                            {details?.nextLevel && standard && (
                                <div className="bg-slate-950/80 rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row gap-6 items-center shadow-lg">
                                    <div className="flex-1">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-2 tracking-wider">För att nå {details.nextLevel}</div>
                                        <div className="text-lg text-white">
                                            Du behöver springa <strong className="text-emerald-400">{distanceToNext}m</strong> längre.
                                        </div>
                                    </div>
                                    <div className="h-px w-full md:w-px md:h-12 bg-white/10"></div>
                                    <div className="flex-1">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-2 tracking-wider">Tempojustering</div>
                                        {showPaceImprovement ? (
                                            <div className="text-lg text-white">
                                                Öka tempot till <strong className="text-emerald-400">{formatPace(nextLevelPace)}</strong> /km
                                                <span className="text-sm text-slate-500 ml-2">(-{Math.round((paceImprovementRaw || 0) * 60)}s/km)</span>
                                            </div>
                                        ) : (
                                            <div className="text-lg text-white italic">
                                                Öka distansen och farten successivt.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Enhanced Reference Table */}
                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                        <button
                            onClick={() => setShowFullTable(!showFullTable)}
                            className="w-full flex justify-between items-center text-left"
                        >
                            <span className="font-bold text-white flex items-center gap-2">
                                <span className="text-slate-500">📊</span> Tabell ({gender === 'male' ? 'Män' : 'Kvinnor'} {standard?.ageMin}-{standard?.ageMax} år)
                            </span>
                            <span className={`text-slate-400 transition-transform ${showFullTable ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {showFullTable && standard && (
                            <div className="mt-6 overflow-hidden rounded-xl border border-white/10 animate-fade-in-down">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold">Nivå</th>
                                            <th className="px-4 py-3 text-right font-bold">Distans</th>
                                            <th className="px-4 py-3 text-right font-bold hidden sm:table-cell">Tempo</th>
                                            <th className="px-4 py-3 text-right font-bold text-slate-500">Diff</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 bg-slate-900/50">
                                        {(['Excellent', 'Good', 'Average', 'Bad'] as const).map((lvl) => {
                                            const threshold = standard.levels[lvl.toLowerCase() as keyof typeof standard.levels];
                                            const paceSec = convertTimeToPace(threshold / 1000, 12 * 60);
                                            const pace = paceSec / 60; // decimal minutes
                                            const diff = evaluationDistance - threshold;
                                            const diffPercent = (diff / threshold) * 100;

                                            // Highlight active row broadly
                                            const isActive = details?.grade === lvl;

                                            return (
                                                <tr key={lvl} className={`transition-colors ${isActive ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}>
                                                    <td className={`px-4 py-3 font-bold ${COOPER_LEVEL_TEXT_COLORS[lvl]}`}>{lvl}</td>
                                                    <td className="px-4 py-3 text-right text-white font-mono">
                                                        &gt; {threshold} m
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-400 font-mono hidden sm:table-cell">
                                                        {formatPace(pace)}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-mono ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {diff > 0 ? '+' : ''}{Math.round(diff)}m <span className="text-[10px] opacity-70">({diff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr className={details?.grade === 'Very Bad' ? 'bg-red-500/10' : ''}>
                                            <td className={`px-4 py-3 font-bold ${COOPER_LEVEL_TEXT_COLORS['Very Bad']}`}>Very Bad</td>
                                            <td className="px-4 py-3 text-right text-white font-mono">
                                                &lt; {standard.levels.bad} m
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-400 font-mono hidden sm:table-cell">
                                                -
                                            </td>
                                            <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                                                {evaluationDistance < standard.levels.bad ? '-' : '+'}{Math.abs(Math.round(evaluationDistance - standard.levels.bad))}m
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


