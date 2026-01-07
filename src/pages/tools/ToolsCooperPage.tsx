import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateCooperVO2, formatPace, formatSeconds, calculateVDOT, predictRaceTime } from '../../utils/runningCalculator.ts';
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

export function ToolsCooperPage() {
    const { userSettings, unifiedActivities } = useData();

    // State
    const [distance, setDistance] = useState(2400); // meters
    const [age, setAge] = useState(30);
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

                setDistance(Math.round(derivedDist));

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
    const vo2 = calculateCooperVO2(distance);
    const standard = useMemo(() => getCooperStandard(age, gender), [age, gender]);

    // Grade Details
    const details = useMemo(() => {
        if (!standard) return null;
        return getDetailedCooperGrade(distance, standard);
    }, [distance, standard]);

    // Pace Calculations
    const currentPace = distance > 0 ? 12 / (distance / 1000) : 0; // min/km

    // Next Level Logic
    // nextLevelDistance is the LOWER bound of the next level.
    const nextLevelThreshold = details?.nextLevel && standard
        ? (standard.levels[details.nextLevel.toLowerCase() as keyof typeof standard.levels] || 0)
        : 0;

    const distanceToNext = Math.max(0, nextLevelThreshold - distance);
    const nextLevelPace = nextLevelThreshold > 0 ? 12 / (nextLevelThreshold / 1000) : 0;

    // Pace Improvement
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

        if (distance < bad) return mapToSegment(distance, floor, bad);
        if (distance < average) return 20 + mapToSegment(distance, bad, average);
        if (distance < good) return 40 + mapToSegment(distance, average, good);
        if (distance < excellent) return 60 + mapToSegment(distance, good, excellent);

        const ceiling = excellent + 400;
        return 80 + mapToSegment(distance, excellent, ceiling);
    };

    const progress = getProgressPercent();

    return (
        <div className="space-y-8 animate-fade-in pb-20">
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
                                        value={distance}
                                        onChange={(e) => setDistance(Number(e.target.value))}
                                        step="10"
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-mono font-bold focus:outline-none focus:border-emerald-500 transition-colors group-hover:border-white/20"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">m</div>
                                </div>
                                <div className="mt-2 flex justify-between items-start text-xs">
                                    <span className="text-slate-500">
                                        Tempo: <strong className="text-emerald-300">{formatPace(currentPace)}</strong> min/km
                                    </span>
                                </div>
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
                    <CooperRacePredictor distance={distance} />
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
                                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Resultat</div>
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
                                            Du: {distance}m
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
                                            const pace = 12 / (threshold / 1000);
                                            const diff = distance - threshold;
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
                                                        {diff > 0 ? '+' : ''}{diff}m <span className="text-[10px] opacity-70">({diff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)</span>
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
                                                +{distance - standard.levels.bad}m
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
