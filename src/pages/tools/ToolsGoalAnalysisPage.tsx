import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { 
    calculateVDOT, 
    predictRaceTime, 
    formatSeconds, 
    formatPace, 
    assessGoalFeasibility,
    predictWeightAdjustedVDOT,
    calculateWingsForLife,
    calculateRequiredWingsPace
} from '../../utils/runningCalculator.ts';
import { 
    Target, 
    TrendingUp, 
    Zap, 
    ArrowRight,
    Trophy,
    Flame,
    History,
    Thermometer,
    Mountain,
    Clock,
    Activity,
    Scale,
    ChevronDown,
    ChevronUp,
    Info,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Timer,
    Car
} from 'lucide-react';
import { 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    ReferenceLine,
    LineChart,
    Line
} from 'recharts';

const DISTANCES = [
    { id: '5k', label: '5 km', km: 5.0 },
    { id: '10k', label: '10 km', km: 10.0 },
    { id: 'half', label: 'Halvmara', km: 21.0975 },
    { id: 'marathon', label: 'Maraton', km: 42.195 },
    { id: '50k', label: '50 km', km: 50.0 },
    { id: '100k', label: '100 km', km: 100.0 },
    { id: 'wfl', label: 'Wings for Life', km: 0 },
];

const TIME_GOALS = [
    { id: '1h', label: '1h', seconds: 3600 },
    { id: '6h', label: '6h', seconds: 21600 },
    { id: '12h', label: '12h', seconds: 43200 },
    { id: '24h', label: '24h', seconds: 86400 },
];

export function ToolsGoalAnalysisPage() {
    const { universalActivities, getLatestWeight } = useData();
    
    // Core State
    const [selectedDistId, setSelectedDistId] = useState('marathon');
    const [isTimeGoal, setIsTimeGoal] = useState(false);
    const [targetTimeStr, setTargetTimeStr] = useState('02:50:00');
    const [targetKm, setTargetKm] = useState(42.2);
    
    // Tools State
    const [temp, setTemp] = useState(12); // Ideal temp
    const [altitude, setAltitude] = useState(0); 
    const [targetWeight, setTargetWeight] = useState(0);
    const [showAllSplits, setShowAllSplits] = useState(false);

    const isWFL = selectedDistId === 'wfl';
    const currentWeight = getLatestWeight() || 75;
    
    // Set initial target weight
    useEffect(() => {
        if (targetWeight === 0) setTargetWeight(currentWeight);
    }, [currentWeight]);

    const selectedDist = useMemo(() => 
        DISTANCES.find(d => d.id === selectedDistId) || DISTANCES[3]
    , [selectedDistId]);

    const selectedTimeGoal = useMemo(() => 
        TIME_GOALS.find(t => t.id === selectedDistId)
    , [selectedDistId]);

    const parseTimeToSeconds = (str: string) => {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    };

    // Personal Bests (Where am I?)
    const pbs = useMemo(() => {
        if (!universalActivities) return {};
        const res: Record<string, { time: number; name: string; date: string; vdot: number; distance: number }> = {};
        
        const runs = universalActivities.filter(a => 
            a.status === 'COMPLETED' && 
            a.performance?.activityType === 'running' &&
            (a.performance.distanceKm || 0) >= 0.8
        );

        runs.forEach(r => {
            const d = r.performance!.distanceKm || 0;
            const t = r.performance!.durationMinutes * 60;
            if (t <= 0 || d <= 0) return;
            
            const v = calculateVDOT(d, t);
            if (v > 95) return;

            // Find closest standard distance
            DISTANCES.forEach(dist => {
                if (dist.id === 'wfl') {
                    // For WFL, we look for activities that are explicitly marked or titled WFL
                    const title = (r.name || '').toLowerCase();
                    if (title.includes('wings for life')) {
                        if (!res[dist.id] || d > res[dist.id].distance) {
                            res[dist.id] = { time: t, name: r.name || 'WFL', date: r.date, vdot: v, distance: d };
                        }
                    }
                    return;
                }
                const diff = Math.abs(d - dist.km);
                if (diff < dist.km * 0.05) {
                    if (!res[dist.id] || t < res[dist.id].time) {
                        res[dist.id] = { time: t, name: r.name || 'Pass', date: r.date, vdot: v, distance: d };
                    }
                }
            });
        });
        return res;
    }, [universalActivities]);

    const bestPerformance = useMemo(() => {
        if (!universalActivities) return null;
        const runs = universalActivities.filter(a => 
            a.status === 'COMPLETED' && 
            a.performance?.activityType === 'running' &&
            (a.performance.distanceKm || 0) >= 3
        );
        let maxVDOT = 0;
        let source = null;
        runs.forEach(r => {
            const d = r.performance!.distanceKm || 0;
            const t = r.performance!.durationMinutes * 60;
            if (t <= 0 || d <= 0) return;
            const v = calculateVDOT(d, t);
            if (v > maxVDOT && v < 95) {
                maxVDOT = v;
                source = { vdot: v, name: r.name, date: r.date, distance: d, time: t };
            }
        });
        return source;
    }, [universalActivities]);

    const currentBestVDOT = bestPerformance?.vdot || 0;

    // Handle distance change
    useEffect(() => {
        if (selectedDistId === 'wfl') {
            setIsTimeGoal(false);
            // Default WFL goal: use PB distance if exists, otherwise current capacity
            if (pbs['wfl']) {
                setTargetKm(pbs['wfl'].distance);
            } else {
                // How far can I get with current VDOT?
                const pace = predictRaceTime(currentBestVDOT, 1);
                const wflRes = calculateWingsForLife(pace);
                setTargetKm(Math.round(wflRes.distance * 10) / 10);
            }
            return;
        }

        const timeGoal = TIME_GOALS.find(t => t.id === selectedDistId);
        if (timeGoal) {
            setIsTimeGoal(true);
            const pace = predictRaceTime(currentBestVDOT, 1);
            const dist = timeGoal.seconds / pace;
            setTargetKm(Math.round(dist * 10) / 10);
        } else {
            setIsTimeGoal(false);
            const dist = DISTANCES.find(d => d.id === selectedDistId);
            if (dist) {
                if (pbs[dist.id]) {
                    setTargetTimeStr(formatSeconds(Math.round(pbs[dist.id].time)));
                } else {
                    const predicted = predictRaceTime(currentBestVDOT, dist.km);
                    setTargetTimeStr(formatSeconds(Math.round(predicted)));
                }
            }
        }
    }, [selectedDistId, currentBestVDOT, pbs]);

    // Wings for Life Calculation Logic
    const wflResult = useMemo(() => {
        if (!isWFL) return null;
        const reqPace = calculateRequiredWingsPace(targetKm);
        const resAtCurrentVDOT = calculateWingsForLife(predictRaceTime(currentBestVDOT, 1));
        return { reqPace, resAtCurrentVDOT };
    }, [isWFL, targetKm, currentBestVDOT]);

    const targetSeconds = useMemo(() => {
        if (isWFL && wflResult) {
            const res = calculateWingsForLife(wflResult.reqPace);
            return res.time;
        }
        return isTimeGoal ? (selectedTimeGoal?.seconds || 0) : parseTimeToSeconds(targetTimeStr);
    }, [targetTimeStr, isTimeGoal, selectedTimeGoal, isWFL, wflResult]);

    const actualDistanceKm = useMemo(() => isTimeGoal || isWFL ? targetKm : selectedDist.km, [isTimeGoal, isWFL, targetKm, selectedDist]);

    const targetVDOT = useMemo(() => {
        if (targetSeconds <= 0 || actualDistanceKm <= 0) return 0;
        return calculateVDOT(actualDistanceKm, targetSeconds);
    }, [actualDistanceKm, targetSeconds]);

    const currentCapacityAtDist = useMemo(() => {
        if (isWFL) {
            // For WFL, "Capacity at distance" means how much time it takes to reach that distance at current pace
            return predictRaceTime(currentBestVDOT, actualDistanceKm);
        }
        return predictRaceTime(currentBestVDOT, actualDistanceKm);
    }, [currentBestVDOT, actualDistanceKm, isWFL]);

    // The Gap Analysis
    const gapAnalysis = useMemo(() => {
        const timeDiff = targetSeconds - currentCapacityAtDist;
        const percentDiff = (targetSeconds / currentCapacityAtDist - 1) * 100;
        const vdotGap = targetVDOT - currentBestVDOT;
        const feasibility = assessGoalFeasibility(currentBestVDOT, targetVDOT, 12);
        
        return { timeDiff, percentDiff, vdotGap, feasibility };
    }, [targetSeconds, currentCapacityAtDist, targetVDOT, currentBestVDOT]);

    // Environmental Impact
    const envImpactFactor = useMemo(() => {
        const heatImpact = Math.max(0, (temp - 12) * 0.005);
        const altImpact = (altitude / 1000) * 0.03;
        return 1 + heatImpact + altImpact;
    }, [temp, altitude]);

    // Weight Impact
    const weightAdjustedVDOT = useMemo(() => {
        return predictWeightAdjustedVDOT(currentBestVDOT, currentWeight, targetWeight);
    }, [currentBestVDOT, currentWeight, targetWeight]);

    const weightTimeBenefit = useMemo(() => {
        const baseTime = currentCapacityAtDist;
        const newTime = predictRaceTime(weightAdjustedVDOT, actualDistanceKm);
        return baseTime - newTime;
    }, [currentCapacityAtDist, weightAdjustedVDOT, actualDistanceKm]);

    // Training Paces
    const trainingPaces = useMemo(() => {
        if (targetVDOT <= 0) return null;
        const v = targetVDOT;
        return {
            easy: predictRaceTime(v * 0.70, 1),
            marathon: predictRaceTime(v * 0.82, 1),
            threshold: predictRaceTime(v * 0.88, 1),
            interval: predictRaceTime(v * 0.98, 1),
            yasso: predictRaceTime(v, 42.195) / 60
        };
    }, [targetVDOT]);

    const zonesChartData = useMemo(() => {
        if (!trainingPaces) return [];
        return [
            { name: 'Easy', pace: trainingPaces.easy, color: '#94a3b8' },
            { name: 'Marathon', pace: trainingPaces.marathon, color: '#10b981' },
            { name: 'Threshold', pace: trainingPaces.threshold, color: '#f59e0b' },
            { name: 'Interval', pace: trainingPaces.interval, color: '#ef4444' },
        ];
    }, [trainingPaces]);

    const splits = useMemo(() => {
        if (targetSeconds <= 0) return [];
        const kmMarkers = showAllSplits 
            ? Array.from({ length: Math.floor(actualDistanceKm) }, (_, i) => i + 1)
            : [5, 10, 21.1, 42.2].filter(k => k < actualDistanceKm);
        
        if (!kmMarkers.includes(actualDistanceKm)) kmMarkers.push(actualDistanceKm);
        
        const pace = targetSeconds / actualDistanceKm;
        return kmMarkers.sort((a, b) => a - b).map(km => ({
            km,
            label: km === 21.0975 ? 'Half' : km === 42.195 ? 'Marathon' : `${km} km`,
            time: km * pace
        }));
    }, [targetSeconds, actualDistanceKm, showAllSplits]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fade-in px-4">
            {/* Header: Goal Selection */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="space-y-6 flex-1">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20">
                                <Target className="text-emerald-500" size={24} />
                            </div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Race Analysis Hub</h1>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Distansmål</span>
                                <div className="flex flex-wrap gap-2">
                                    {DISTANCES.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => setSelectedDistId(d.id)}
                                            className={`px-3 py-2 text-[10px] font-black uppercase rounded-xl transition-all border-2 ${
                                                selectedDistId === d.id && !isTimeGoal
                                                    ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                                                    : 'bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'
                                            }`}
                                        >
                                            {d.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tidsmål (Distans på tid)</span>
                                <div className="flex flex-wrap gap-2">
                                    {TIME_GOALS.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setSelectedDistId(t.id)}
                                            className={`px-3 py-2 text-[10px] font-black uppercase rounded-xl transition-all border-2 ${
                                                selectedDistId === t.id
                                                    ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/20' 
                                                    : 'bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-auto bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                        {isWFL ? (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Måldistans (Innan catcher car)</label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number"
                                        step="0.5"
                                        value={targetKm}
                                        onChange={(e) => setTargetKm(Number(e.target.value))}
                                        className="w-full lg:w-64 bg-slate-950 border-2 border-white/5 rounded-2xl px-6 py-4 text-white font-mono font-black text-3xl focus:outline-none focus:border-amber-500 transition-all text-center"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xl font-black text-white">KM</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">WFL World Run</span>
                                    </div>
                                </div>
                            </div>
                        ) : isTimeGoal ? (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Måldistans (km)</label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number"
                                        step="0.1"
                                        value={targetKm}
                                        onChange={(e) => setTargetKm(Number(e.target.value))}
                                        className="w-full lg:w-64 bg-slate-950 border-2 border-white/5 rounded-2xl px-6 py-4 text-white font-mono font-black text-3xl focus:outline-none focus:border-sky-500 transition-all text-center"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xl font-black text-white">KM</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">på {selectedTimeGoal?.label}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Måltid (HH:MM:SS)</label>
                                <input 
                                    type="text"
                                    value={targetTimeStr}
                                    onChange={(e) => setTargetTimeStr(e.target.value)}
                                    className="w-full lg:w-64 bg-slate-950 border-2 border-white/5 rounded-2xl px-6 py-4 text-white font-mono font-black text-3xl focus:outline-none focus:border-emerald-500 transition-all text-center"
                                />
                                {pbs[selectedDistId] && (
                                    <div className="text-[9px] text-emerald-500/80 font-bold uppercase tracking-widest text-center mt-2 flex items-center justify-center gap-1.5">
                                        <Trophy size={10} /> Ditt PB: {formatSeconds(Math.round(pbs[selectedDistId].time))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Wings for Life Specific Context Card */}
            {isWFL && wflResult && (
                <div className="bg-amber-500/10 border-2 border-amber-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in zoom-in">
                    <div className="flex items-center gap-6">
                        <div className="bg-amber-500 p-4 rounded-3xl shadow-lg shadow-amber-500/20">
                            <Car className="text-slate-900" size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">Wings for Life World Run</h2>
                            <p className="text-slate-400 text-sm font-medium">Spring så långt du kan innan catcher car hinner ikapp.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-12">
                        <div className="text-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Krävd Pace</span>
                            <span className="text-3xl font-black text-white">{formatPace(wflResult.reqPace / 60)}</span>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Idag Kapacitet</span>
                            <span className="text-3xl font-black text-amber-500">{wflResult.resAtCurrentVDOT.distance.toFixed(1)}k</span>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Idag Tid</span>
                            <span className="text-3xl font-black text-white">{formatSeconds(wflResult.resAtCurrentVDOT.time)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Core Analysis Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* 1. REQUIRED */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 p-8 bg-emerald-500/5 rounded-full blur-2xl"></div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <div className="bg-emerald-500/10 p-1.5 rounded-xl">
                                <Target size={18} />
                            </div>
                            <h2 className="font-black uppercase text-sm tracking-widest">Vad Krävs?</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mål VDOT</span>
                                <span className="text-3xl font-black text-white">{targetVDOT.toFixed(1)}</span>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Måltempo</span>
                                <span className="text-3xl font-black text-white">{formatPace(targetSeconds / 60 / actualDistanceKm)}</span>
                            </div>
                        </div>
                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Flame size={16} className="text-orange-500" />
                                <span className="text-[11px] font-black text-slate-400 uppercase">Energiåtgång</span>
                            </div>
                            <span className="text-lg font-black text-white">{Math.round(actualDistanceKm * currentWeight * 0.98)} <span className="text-xs text-slate-500 uppercase">kcal</span></span>
                        </div>
                    </div>
                </div>

                {/* 2. CURRENT STATUS */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 p-8 bg-sky-500/5 rounded-full blur-2xl"></div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-2 text-sky-400">
                            <div className="bg-sky-500/10 p-1.5 rounded-xl">
                                <History size={18} />
                            </div>
                            <h2 className="font-black uppercase text-sm tracking-widest">Var Är Du Nu?</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bästa VDOT</span>
                                <span className="text-3xl font-black text-white">{currentBestVDOT.toFixed(1)}</span>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Kapacitet Idag</span>
                                <span className="text-3xl font-black text-slate-300">
                                    {isTimeGoal || isWFL
                                        ? `${(actualDistanceKm * (targetSeconds / currentCapacityAtDist)).toFixed(1)}km` 
                                        : formatSeconds(Math.round(currentCapacityAtDist))}
                                </span>
                            </div>
                        </div>
                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-1.5">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Baserat på bästa pass</span>
                            {bestPerformance ? (
                                <div className="flex justify-between items-center group/pass cursor-help" title={`Passet "${bestPerformance.name}" den ${bestPerformance.date} gav VDOT ${bestPerformance.vdot.toFixed(1)}`}>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[11px] font-bold text-white truncate max-w-[150px]">{bestPerformance.name}</span>
                                        <span className="text-[9px] text-slate-500 font-mono">{bestPerformance.distance.toFixed(1)}k på {formatSeconds(bestPerformance.time)}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-600 font-mono bg-slate-900 px-2 py-0.5 rounded border border-white/5">{bestPerformance.date}</span>
                                </div>
                            ) : (
                                <span className="text-[11px] text-slate-600 italic">Inget löppass hittat i historiken</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. THE GAP */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 p-8 bg-amber-500/5 rounded-full blur-2xl"></div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-2 text-amber-400">
                            <div className="bg-amber-500/10 p-1.5 rounded-xl">
                                <TrendingUp size={18} />
                            </div>
                            <h2 className="font-black uppercase text-sm tracking-widest">Hur Stor Diff?</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tids-diff</span>
                                <span className={`text-3xl font-black ${gapAnalysis.timeDiff > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {gapAnalysis.timeDiff > 0 ? '+' : ''}{formatSeconds(Math.abs(Math.round(gapAnalysis.timeDiff)))}
                                </span>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">VDOT-gap</span>
                                <span className="text-3xl font-black text-white">{gapAnalysis.vdotGap.toFixed(1)}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Rimlighets-prognos</span>
                                <span className={`text-xs font-black uppercase flex items-center gap-1.5 ${gapAnalysis.feasibility.probability > 0.8 ? 'text-emerald-400' : gapAnalysis.feasibility.probability > 0.4 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {gapAnalysis.feasibility.probability > 0.8 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                    {gapAnalysis.feasibility.probability > 0.8 ? 'Inom Räckhåll' : gapAnalysis.feasibility.probability > 0.4 ? 'Utmanande' : 'Behöver Mer Tid'}
                                </span>
                            </div>
                            <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
                                <div className={`h-full rounded-full transition-all duration-1000 ${gapAnalysis.feasibility.probability > 0.8 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : gapAnalysis.feasibility.probability > 0.4 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'}`} style={{ width: `${gapAnalysis.feasibility.probability * 100}%` }}></div>
                            </div>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter text-center">
                                Beräknad förbättring behövs: {gapAnalysis.feasibility.neededWeeklyImprovement.toFixed(2)} VDOT / vecka
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Environmental and Weight Analysis */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Environmental Adjustments */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-rose-500/10 p-2 rounded-xl">
                            <Thermometer className="text-rose-500" size={20} />
                        </div>
                        <h2 className="font-black text-white uppercase text-sm tracking-widest">Yttre Förutsättningar</h2>
                    </div>
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[11px] font-black text-slate-400 uppercase flex items-center gap-2">Temperatur <span className="text-slate-600">|</span> <span className="text-rose-400">{temp}°C</span></span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase italic">{temp === 12 ? 'Optimalt' : temp > 22 ? 'Värmebelastning' : 'Normalt'}</span>
                            </div>
                            <input 
                                type="range" min="0" max="40" value={temp} 
                                onChange={(e) => setTemp(Number(e.target.value))}
                                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[11px] font-black text-slate-400 uppercase flex items-center gap-2">Höjd <span className="text-slate-600">|</span> <span className="text-sky-400">{altitude}m</span></span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase italic">{altitude > 1000 ? 'Syrebrist' : 'Lågland'}</span>
                            </div>
                            <input 
                                type="range" min="0" max="4000" step="100" value={altitude} 
                                onChange={(e) => setAltitude(Number(e.target.value))}
                                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                        </div>
                        <div className="p-5 bg-rose-500/5 rounded-2xl border border-rose-500/10 flex justify-between items-center shadow-inner">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Justerad tid för dessa villkor</span>
                                <span className="text-3xl font-black text-rose-400 tabular-nums">{formatSeconds(Math.round(targetSeconds * envImpactFactor))}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Påverkan</span>
                                <span className="text-xl font-black text-rose-400">+{((envImpactFactor - 1) * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Weight Impact Analysis */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-indigo-500/10 p-2 rounded-xl">
                            <Scale className="text-indigo-400" size={20} />
                        </div>
                        <h2 className="font-black text-white uppercase text-sm tracking-widest">Viktens Effekt (What-if?)</h2>
                    </div>
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[11px] font-black text-slate-400 uppercase flex items-center gap-2">Målvikt <span className="text-slate-600">|</span> <span className="text-indigo-400">{targetWeight} kg</span></span>
                                <span className="text-[10px] font-bold text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded-full">{targetWeight < currentWeight ? `-${(currentWeight - targetWeight).toFixed(1)} kg` : targetWeight > currentWeight ? `+${(targetWeight - currentWeight).toFixed(1)} kg` : 'Nuvarande'}</span>
                            </div>
                            <input 
                                type="range" min={currentWeight - 15} max={currentWeight + 10} step="0.5" value={targetWeight} 
                                onChange={(e) => setTargetWeight(Number(e.target.value))}
                                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Teoretisk Ny VDOT</span>
                                <span className="text-2xl font-black text-white">{weightAdjustedVDOT.toFixed(1)}</span>
                                <span className="text-[10px] text-emerald-400 font-black block mt-1 uppercase tracking-tighter">
                                    { (weightAdjustedVDOT - currentBestVDOT) > 0 ? '+' : '' }{(weightAdjustedVDOT - currentBestVDOT).toFixed(1)} enheter
                                </span>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tidsvinst</span>
                                <span className="text-2xl font-black text-emerald-400">
                                    {weightTimeBenefit > 0 ? '-' : '+'}{formatSeconds(Math.abs(Math.round(weightTimeBenefit)))}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold block mt-1 uppercase tracking-tighter">Vid bibehållen styrka</span>
                            </div>
                        </div>
                        <div className="flex gap-2 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                            <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-slate-500 italic font-medium leading-relaxed">
                                Minskad kroppsvikt ökar din relativa syreupptagningsförmåga (VO2max) utan att motorn ändras. Detta ger en "gratis" hastighetsökning om muskelmassa bevaras.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Training Details & Splits */}
            <div className="grid lg:grid-cols-5 gap-6">
                {/* Left: Training Paces & Zones */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-emerald-500/10 p-2 rounded-xl">
                                <Clock className="text-emerald-500" size={20} />
                            </div>
                            <h2 className="font-black text-white uppercase text-sm tracking-widest">Träningsfarter för målet</h2>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                            {[
                                { label: 'Easy', pace: trainingPaces?.easy, icon: <Activity className="text-slate-400" size={14} />, desc: 'Grundtempo' },
                                { label: 'Threshold', pace: trainingPaces?.threshold, icon: <Zap className="text-amber-500" size={14} />, desc: 'Tröskel' },
                                { label: 'Marathon', pace: trainingPaces?.marathon, icon: <Target className="text-emerald-400" size={14} />, desc: 'Måltempo' },
                                { label: 'Interval', pace: trainingPaces?.interval, icon: <Flame className="text-rose-400" size={14} />, desc: 'VO2Max' },
                            ].map(p => (
                                <div key={p.label} className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col items-center text-center shadow-inner group hover:border-emerald-500/30 transition-colors">
                                    <div className="mb-2 group-hover:scale-110 transition-transform">{p.icon}</div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-tighter">{p.label}</span>
                                    <span className="text-xl font-black text-white tabular-nums">{formatPace(p.pace || 0)}</span>
                                    <span className="text-[8px] text-slate-600 font-bold uppercase mt-1">{p.desc}</span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="h-48 w-full bg-slate-950/30 rounded-2xl p-4 border border-white/5">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={zonesChartData} layout="vertical" margin={{ left: -20, right: 20 }}>
                                    <XAxis type="number" hide domain={['dataMin - 30', 'dataMax + 10']} />
                                    <YAxis dataKey="name" type="category" stroke="#475569" fontSize={9} fontWeight="bold" width={80} />
                                    <Bar dataKey="pace" radius={[0, 6, 6, 0]} barSize={16}>
                                        {zonesChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                                        ))}
                                    </Bar>
                                    <ReferenceLine x={targetSeconds / actualDistanceKm} stroke="#fff" strokeDasharray="4 4" label={{ position: 'top', value: 'MÅL', fill: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                         <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="bg-amber-500/10 p-1.5 rounded-lg">
                                        <Timer className="text-amber-500" size={16} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Yasso 800s</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-white">{Math.floor(trainingPaces?.yasso || 0)}:{(Math.round(((trainingPaces?.yasso || 0) % 1) * 60)).toString().padStart(2, '0')}</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">min för 800m</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-4 font-bold leading-relaxed">
                                    Ett klassiskt marathon-test. Klara 10 st 800m intervaller på denna tid för att verifiera din form.
                                </p>
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-colors"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="bg-rose-500/10 p-1.5 rounded-lg">
                                        <Flame className="text-rose-500" size={16} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vätskebehov</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-white">{Math.round(currentWeight * 0.012).toFixed(1)} - {Math.round(currentWeight * 0.018).toFixed(1)}</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Liter / timme</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-4 font-bold leading-relaxed">
                                    Estimerad svettförlust vid måltempo. Viktigt för din energi- och vätskeplan.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Splits Table */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden h-full shadow-2xl flex flex-col">
                        <div className="p-6 pb-4 flex items-center justify-between bg-slate-950/30 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/5 p-2 rounded-xl">
                                    <Clock size={16} className="text-slate-400" />
                                </div>
                                <h2 className="font-black text-white uppercase text-sm tracking-widest">Måltider per KM</h2>
                            </div>
                            <button 
                                onClick={() => setShowAllSplits(!showAllSplits)}
                                className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full transition-all border ${
                                    showAllSplits 
                                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                                }`}
                            >
                                {showAllSplits ? 'Färre' : 'Visa Alla KM'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-950/80 border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Distans</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ackumulerad Tid</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {splits.map((s, idx) => (
                                        <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${s.km === 5 || s.km === 10 || s.km === 21.0975 || s.km === 42.195 ? 'bg-emerald-500' : 'bg-slate-800'}`}></span>
                                                    <span className={`text-sm font-black ${s.km === actualDistanceKm ? 'text-emerald-400' : 'text-slate-200'}`}>{s.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-sm font-mono font-black ${s.km === actualDistanceKm ? 'text-emerald-400' : 'text-slate-400'} group-hover:text-white transition-colors`}>{formatSeconds(Math.round(s.time))}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Benchmarks Footer */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-emerald-500/5 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-sky-500/10 p-2.5 rounded-2xl">
                            <Trophy className="text-sky-500" size={24} />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Världsklass Benchmarks</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Sub 3 Club', vdot: 53.6, time: '2:59:59', color: 'text-slate-400' },
                            { label: 'Boston Qual.', vdot: 51.5, time: '3:05:00', color: 'text-amber-500/80' },
                            { label: 'Semi Pro / Elite', vdot: 68.0, time: '2:25:00', color: 'text-sky-400' },
                            { label: 'Ditt Mål', vdot: targetVDOT, time: isWFL ? `${actualDistanceKm.toFixed(1)}k` : isTimeGoal ? `${actualDistanceKm.toFixed(1)}k` : targetTimeStr, color: 'text-emerald-400' }
                        ].map(b => (
                            <div key={b.label} className="bg-slate-950/50 p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center shadow-inner hover:border-white/10 transition-colors">
                                <span className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">{b.label}</span>
                                <span className={`text-4xl font-black ${b.color} mb-1`}>{b.vdot.toFixed(1)}</span>
                                <span className="text-[10px] font-mono text-slate-500 font-bold tracking-widest mt-2">{b.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ToolsGoalAnalysisPage;
