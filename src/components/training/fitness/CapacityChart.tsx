import React, { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { ExerciseEntry } from '../../../models/types.ts';
import { subDays } from 'date-fns';
import { calculateRiegelTime, formatSmartTime } from '../../../utils/runningCalculator.ts';
import { Info, HelpCircle, Activity, Heart, Clock, Medal, Zap, Check, ExternalLink, Trophy } from 'lucide-react';

export interface FitnessDatapoint {
    date: string;
    capacity5k: number | null;
    capacity10k: number | null;
    capacity21k: number | null;
    capacity42k: number | null;
    activitiesProcessed: number;
    bestActivityTitle?: string;
    isExtrapolated?: boolean;
    percentHRMax?: number;
    actualDistance?: number;
    actualDurationMinutes?: number;
    actualHr?: number;
    bestActivityId?: string;
    weeklyAvgVolume?: number;
    longRuns90dCount?: number;
    enduranceExponentUsed?: number;
}

interface CapacityChartProps {
    allRuns: ExerciseEntry[];
    calculationWindowDays: number;
    setCalculationWindowDays: (days: number) => void;
    onOpenActivity?: (id: string) => void;
}

function timeToStr(timeMin: number): string {
    const totalSecs = timeMin * 60;
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = Math.floor(totalSecs % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const isExtrapolated = payload.isExtrapolated;
    if (!isExtrapolated) {
        // Actual PB/performance: Solid dot with glow
        return (
            <g>
                <circle cx={cx} cy={cy} r={6} fill="#fff" stroke="#3b82f6" strokeWidth={2} className="shadow-2xl" />
                <circle cx={cx} cy={cy} r={2} fill="#3b82f6" />
            </g>
        );
    }
    // Extrapolated: Hollow dot
    return (
        <circle cx={cx} cy={cy} r={3} fill="#0f172a" stroke="#ffffff40" strokeWidth={1} />
    );
};

function CustomTooltipCapacity({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl space-y-2">
                <p className="font-black text-slate-200 text-xs uppercase tracking-wider">{label}</p>
                {data.bestActivityTitle && (
                    <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                        <div className={`p-1 rounded ${data.isExtrapolated ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {data.isExtrapolated ? <Heart size={12} /> : <Zap size={12} />}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                {data.isExtrapolated ? '💡 Extrapolerat från' : '🏆 Bästa pass'}
                            </p>
                            <p className="text-xs text-white truncate max-w-[180px] font-medium">{data.bestActivityTitle}</p>
                        </div>
                    </div>
                )}
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between gap-6 text-xs text-slate-300">
                            <span className="flex items-center gap-1">
                                <span style={{ backgroundColor: entry.color }} className="w-2 h-2 rounded-full" />
                                {entry.name}
                            </span>
                            <span className="font-bold font-mono text-white">{timeToStr(entry.value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
}

export function CapacityChart({ allRuns, calculationWindowDays, setCalculationWindowDays, onOpenActivity }: CapacityChartProps) {
    const [useActualOnly, setUseActualOnly] = React.useState(false);
    const [useEndurancePenalty, setUseEndurancePenalty] = React.useState(true);
    const [useTapering, setUseTapering] = React.useState(false);
    const [showInfo, setShowInfo] = React.useState(false);
    const [selectedDistance, setSelectedDistance] = React.useState<'capacity5k' | 'capacity10k' | 'capacity21k' | 'capacity42k' | 'all'>('capacity10k');
    const [selectedDp, setSelectedDp] = React.useState<FitnessDatapoint | null>(null);

    const maxUserHR = useMemo(() => {
        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
        const threeYearsAgoStr = threeYearsAgo.toISOString().split('T')[0];

        const recentRuns = allRuns.filter(r => r.date >= threeYearsAgoStr && r.heartRateMax);
        if (recentRuns.length === 0) return { value: 190, sourceTitle: 'Standard' };

        const sortedByHr = [...recentRuns].sort((a, b) => (b.heartRateMax || 0) - (a.heartRateMax || 0));
        const bestHrRun = sortedByHr[0];
        
        if (!bestHrRun.heartRateMax) return { value: 190, sourceTitle: 'Standard' };

        const runDate = new Date(bestHrRun.date);
        const now = new Date();
        const yearsPassed = (now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        const adjustedMax = Math.round(bestHrRun.heartRateMax + 1.5 - yearsPassed);
        return {
            value: adjustedMax,
            sourceDate: bestHrRun.date,
            sourceTitle: bestHrRun.title || 'Okänt pass',
            peakMeasured: bestHrRun.heartRateMax,
            yearsPassed: Math.round(yearsPassed * 10) / 10
        };
    }, [allRuns]);

    React.useEffect(() => {
        if (selectedDp) {
            setTimeout(() => {
                document.getElementById('capacity-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }, [selectedDp]);



    const formatPace = (minPerKm: number) => {
        const mins = Math.floor(minPerKm);
        const secs = Math.round((minPerKm - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')} min/km`;
    };

    // Calculate Capacity over time using Fitness Decay
    const capacityData = useMemo(() => {
        if (allRuns.length === 0) return [];

        const sortedRuns = [...allRuns].sort((a, b) => a.date.localeCompare(b.date));

        // 1. Pre-calculate raw capacity for ALL runs for performance
        const enrichedRuns = sortedRuns.map(run => {
            let estimateSecs = Infinity;
            let extrapolated10kSecs = Infinity;
            let isExtrapolatedEligible = false;

            if (run.distance! >= 3) {
                estimateSecs = calculateRiegelTime(run.durationMinutes * 60, run.distance!, 10);
            }




            if (run.distance! >= 1 && run.heartRateAvg && run.heartRateAvg > 80 && run.durationMinutes >= 15) {
                const minPerKm = run.durationMinutes / run.distance!;
                const speedMetersPerMin = 1000 / minPerKm;

                const maxHRValue = typeof maxUserHR === 'object' && 'value' in maxUserHR ? (maxUserHR as any).value : 190;
                const percentHRMax = run.heartRateAvg / maxHRValue;

                if (percentHRMax >= 0.65) {
                    // Effort Ceiling relative to distance
                    // 100% up to 2km, 92.8% at 10k, 88% at 21k, 84% at 42k
                    const getEffortCeiling = (d) => {
                        if (d <= 2) return 1.0;
                        if (d <= 10) return 1.0 - (d - 2) * 0.009; 
                        if (d <= 21) return 0.928 - (d - 10) * 0.004; 
                        return 0.88 - (d - 21) * 0.002; 
                    };
                    const effortCeiling = getEffortCeiling(run.distance || 10);
                    const relativeEffort = Math.min(1.0, percentHRMax / effortCeiling);

                    let estMaxSpeed = speedMetersPerMin / (0.5 + (0.5 * relativeEffort));
                    
                    // Interval Boost: 3.5% lift to offset recovery jogs drag
                    const isInterval = run.subType === 'interval' || run.title?.toLowerCase().includes('intervall') || run.title?.toLowerCase().includes('x');
                    if (isInterval) {
                        estMaxSpeed *= 1.035;
                    }

                    extrapolated10kSecs = (10000 / estMaxSpeed) * 60;
                    isExtrapolatedEligible = true;
                }
            }

            return {
                run,
                estimateSecs,
                extrapolated10kSecs,
                isExtrapolatedEligible,
                dateTimeMs: new Date(run.date).getTime()
            };
        });

        const dataPoints: FitnessDatapoint[] = [];
        const BASE_DECAY_RATE = 0.002; // 0.2% slower per day
        const GRACE_PERIOD = calculationWindowDays / 2; // e.g. 15 days if 30 selected
        const LOOKUP_LIMIT = Math.max(calculationWindowDays * 1.5, 90); // Look back at least 90 days

        const startDate = new Date(sortedRuns[0].date);
        const endDate = new Date(sortedRuns[sortedRuns.length - 1].date);

        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const currTimeMs = currentDate.getTime();

            let recentVolumeKm = 0;
            let volume90d = 0;
            let longRuns90dCount = 0;

            enrichedRuns.forEach(r => {
                if (r.run.date > dateStr) return;
                const ageDays = (currTimeMs - r.dateTimeMs) / (1000 * 60 * 60 * 24);
                if (ageDays >= 0 && ageDays <= 30) recentVolumeKm += r.run.distance || 0;
                if (ageDays >= 0 && ageDays <= 90) {
                    volume90d += r.run.distance || 0;
                    if (r.run.distance && r.run.distance >= 20) longRuns90dCount++;
                }
            });

            const weeklyAvgVolume = volume90d / (90 / 7);

            // Dampen Decay based on volume (50% discount max at 100km / 30 days)
            const volumeDiscount = Math.min(0.5, recentVolumeKm / 100); 
            const DECAY_RATE = BASE_DECAY_RATE * (1 - volumeDiscount);

            let best10kEstimateSecs = Infinity;
            let bestRun = null;
            let extrapolated10kSecs = Infinity;
            let extrapolatedRun: any = null;

            for (const item of enrichedRuns) {
                if (item.run.date > dateStr) continue; // Skip future runs

                const ageDays = (currTimeMs - item.dateTimeMs) / (1000 * 60 * 60 * 24);
                if (ageDays > LOOKUP_LIMIT) continue; // Out of window for this date

                const decayFactor = 1 + DECAY_RATE * Math.max(0, ageDays - GRACE_PERIOD);

                if (item.estimateSecs !== Infinity) {
                    const decayedSecs = item.estimateSecs * decayFactor;
                    if (decayedSecs < best10kEstimateSecs) {
                        best10kEstimateSecs = decayedSecs;
                        bestRun = item.run;
                    }
                }

                if (item.isExtrapolatedEligible) {
                    const decayedSecs = item.extrapolated10kSecs * decayFactor;
                    if (decayedSecs < extrapolated10kSecs) {
                        extrapolated10kSecs = decayedSecs;
                        extrapolatedRun = item.run;
                    }
                }
            }

            // Decision Logic
            let final10kSecs = best10kEstimateSecs;
            let isExtrapolated = false;

            if (useActualOnly) {
                final10kSecs = best10kEstimateSecs;
                isExtrapolated = false;
            } else {
                if (best10kEstimateSecs === Infinity && extrapolated10kSecs !== Infinity) {
                    final10kSecs = extrapolated10kSecs;
                    isExtrapolated = true;
                } else if (best10kEstimateSecs !== Infinity && extrapolated10kSecs !== Infinity) {
                    final10kSecs = Math.min(best10kEstimateSecs, extrapolated10kSecs);
                    isExtrapolated = extrapolated10kSecs < best10kEstimateSecs;
                }
            }

            const chosenRun = isExtrapolated ? extrapolatedRun : bestRun;

            if (final10kSecs !== Infinity && final10kSecs < (200 * 60)) {
                // Return standard calculations for plotted dots
                const estimate5kSecs = calculateRiegelTime(final10kSecs, 10, 5);
                const estimate21kSecs = calculateRiegelTime(final10kSecs, 10, 21.0975);
                const estimate42kSecs = calculateRiegelTime(final10kSecs, 10, 42.195);

                dataPoints.push({
                    date: dateStr,
                    capacity5k: estimate5kSecs / 60,
                    capacity10k: final10kSecs / 60,
                    capacity21k: estimate21kSecs / 60,
                    capacity42k: estimate42kSecs / 60,
                    activitiesProcessed: enrichedRuns.filter(r => r.run.date <= dateStr).length,
                    bestActivityTitle: chosenRun?.title || (chosenRun?.details ? chosenRun.details.substring(0, 30) : undefined),
                    bestActivityId: chosenRun?.id,
                    isExtrapolated: isExtrapolated,
                    percentHRMax: chosenRun?.heartRateAvg ? Math.round((chosenRun.heartRateAvg / (chosenRun.heartRateMax || 190)) * 100) : undefined,
                    actualDistance: chosenRun?.distance,
                    actualDurationMinutes: chosenRun?.durationMinutes,
                    actualHr: chosenRun?.heartRateAvg,
                    weeklyAvgVolume: Math.round(weeklyAvgVolume),
                    longRuns90dCount: longRuns90dCount,
                    enduranceExponentUsed: 1.06, // base for plots
                });
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Filter to sparser points for performance
        const filteredPoints: FitnessDatapoint[] = [];
        let lastLoggedDate = '';
        const limitDays = calculationWindowDays >= 90 ? 7 : 4; // 1 per week if long period

        for (const dp of dataPoints) {
            if (!lastLoggedDate) {
                filteredPoints.push(dp);
                lastLoggedDate = dp.date;
                continue;
            }

            const daysPassed = (new Date(dp.date).getTime() - new Date(lastLoggedDate).getTime()) / (24 * 60 * 60 * 1000);
            
            const lastDp = filteredPoints[filteredPoints.length - 1];
            const val1 = dp.capacity10k || 0;
            const val2 = lastDp.capacity10k || 0;
            const diff = Math.abs(val1 - val2);
            const isSpike = diff > 1.0; // Significant capacity shift (> 1 min 10k pace delta)

            if (daysPassed >= limitDays || isSpike) {
                filteredPoints.push(dp);
                lastLoggedDate = dp.date;
            }
        }

        return filteredPoints;
    }, [allRuns, calculationWindowDays, useActualOnly]);

    // recalculate sidebar values factoring details state local
    const sidebarDp = useMemo(() => {
        if (!selectedDp) return null;

        const base10kSecs = (selectedDp.capacity10k || 0) * 60;
        const taperBoost = useTapering && selectedDp.weeklyAvgVolume && selectedDp.weeklyAvgVolume >= 35 ? 0.985 : 1.0;
        const local10kSecs = base10kSecs * taperBoost;

        const calculateLocalSmartRiegel = (secs: number, curD: number, tagD: number) => {
            if (!useEndurancePenalty || tagD <= 12) return calculateRiegelTime(secs, curD, tagD);

            const reqVolume = tagD >= 42 ? 45 : tagD >= 20 ? 30 : 20;
            const reqLongRuns = tagD >= 42 ? 3 : tagD >= 20 ? 2 : 1;

            const volDeficit = Math.max(0, reqVolume - (selectedDp.weeklyAvgVolume || 0)) / reqVolume;
            const longRunDeficit = Math.max(0, reqLongRuns - (selectedDp.longRuns90dCount || 0)) / Math.max(1, reqLongRuns);

            const exp = 1.06 + (volDeficit * 0.08) + (longRunDeficit * 0.12);
            return Math.round(secs * Math.pow((tagD / curD), exp));
        };

        const local5kSecs = calculateLocalSmartRiegel(local10kSecs, 10, 5);
        const local21kSecs = calculateLocalSmartRiegel(local10kSecs, 10, 21.0975);
        const local42kSecs = calculateLocalSmartRiegel(local10kSecs, 10, 42.195);

        let finalExponent = 1.06;
        if (useEndurancePenalty && (selectedDp.weeklyAvgVolume || 0) > 0) {
            const maxReq = 45;
            const volDeficit = Math.max(0, maxReq - (selectedDp.weeklyAvgVolume || 0)) / maxReq;
            finalExponent = 1.06 + (volDeficit * 0.08);
        }

        return {
            ...selectedDp,
            capacity5k: local5kSecs / 60,
            capacity10k: local10kSecs / 60,
            capacity21k: local21kSecs / 60,
            capacity42k: local42kSecs / 60,
            enduranceExponentUsed: finalExponent,
            hasTaperApplied: taperBoost < 1.0
        };
    }, [selectedDp, useEndurancePenalty, useTapering]);

    React.useEffect(() => {
        if (capacityData.length > 0) {
            if (!selectedDp) {
                // Auto-select the last absolute data point
                setSelectedDp(capacityData[capacityData.length - 1]);
            } else {
                // Keep selected point sync'd if recalculations occur
                const match = capacityData.find(d => d.date === selectedDp.date);
                if (match) setSelectedDp(match);
            }
        }
    }, [capacityData, selectedDp?.date]);

    // Memoize the heavy graph to make sidebar setting toggles instant and isolated
    const memoizedChart = useMemo(() => {
        if (capacityData.length === 0) return null;
        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                    data={capacityData} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    onClick={(data) => {
                        if (data && data.activePayload) {
                            const dp = data.activePayload[0].payload;
                            setSelectedDp(prev => prev?.date === dp.date ? null : dp);
                        }
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#ffffff30"
                        tick={{ fill: '#ffffff50', fontSize: 11 }}
                        tickFormatter={(val) => {
                            const d = new Date(val);
                            return `${d.getDate()}/${d.getMonth()+1}`;
                        }}
                    />
                    <YAxis
                        stroke="#ffffff30"
                        tick={{ fill: '#ffffff50', fontSize: 12 }}
                        tickFormatter={(val) => timeToStr(val)}
                        domain={['auto', 'auto']}
                        reversed={true}
                    />
                    <Tooltip content={<CustomTooltipCapacity />} cursor={{ stroke: '#ffffff20', strokeWidth: 1 }} />
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                    
                    {(selectedDistance === 'all' || selectedDistance === 'capacity5k') && (
                        <Line type="monotone" dataKey="capacity5k" name="5 KM" stroke="#10b981" strokeWidth={selectedDistance === 'all' ? 2 : 3} dot={<CustomDot />} />
                    )}
                    {(selectedDistance === 'all' || selectedDistance === 'capacity10k') && (
                        <Line type="monotone" dataKey="capacity10k" name="10 KM" stroke="#3b82f6" strokeWidth={selectedDistance === 'all' ? 2 : 3} dot={<CustomDot />} />
                    )}
                    {(selectedDistance === 'all' || selectedDistance === 'capacity21k') && (
                        <Line type="monotone" dataKey="capacity21k" name="Halvmaraton" stroke="#6366f1" strokeWidth={selectedDistance === 'all' ? 2 : 3} dot={<CustomDot />} />
                    )}
                    {(selectedDistance === 'all' || selectedDistance === 'capacity42k') && (
                        <Line type="monotone" dataKey="capacity42k" name="Maraton" stroke="#a855f7" strokeWidth={selectedDistance === 'all' ? 2 : 3} dot={<CustomDot />} />
                    )}
                </LineChart>
            </ResponsiveContainer>
        );
    }, [capacityData, selectedDistance]);

    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 md:p-6 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        📈 Beräknad Löpkapacitet
                        <button 
                            onClick={() => setShowInfo(!showInfo)} 
                            className={`p-1 rounded-full transition-colors ${showInfo ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                        >
                            <HelpCircle size={16} />
                        </button>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Estimerade max-tider baserat på dina prestationer de senaste {calculationWindowDays} dagarna.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-800 border border-white/5 p-0.5 rounded-lg">
                        {[
                            { id: 'all', label: 'Alla' },
                            { id: 'capacity5k', label: '5K' },
                            { id: 'capacity10k', label: '10K' },
                            { id: 'capacity21k', label: 'Half' },
                            { id: 'capacity42k', label: 'Mara' }
                        ].map(d => (
                            <button 
                                key={d.id}
                                onClick={() => setSelectedDistance(d.id as any)}
                                className={`px-2 py-1 text-[9px] font-black uppercase rounded transition-all ${selectedDistance === d.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => setUseActualOnly(!useActualOnly)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${
                            useActualOnly 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-slate-800 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <div className={`w-3 h-3 rounded flex items-center justify-center border ${useActualOnly ? 'border-emerald-400 bg-emerald-400 text-slate-900' : 'border-slate-600'}`}>
                            {useActualOnly && <Check size={8} className="stroke-[4]" />}
                        </div>
                        Faktiska
                    </button>

                    <select
                        className="bg-slate-800 border border-white/5 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer focus:border-white/10"
                        value={calculationWindowDays}
                        onChange={(e) => setCalculationWindowDays(Number(e.target.value))}
                    >
                        <option value={30}>Senaste 30 dagarna</option>
                        <option value={60}>Senaste 60 dagarna</option>
                        <option value={90}>Senaste 90 dagarna</option>
                        <option value={180}>Senaste halvåret</option>
                    </select>
                </div>
            </div>

            {showInfo && (
                <div className="bg-blue-900/10 border border-white/5 rounded-xl p-4 text-xs text-slate-300 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                        <Info size={16} className="text-blue-400 shrink-0" />
                        <div>
                            <p className="font-bold text-white mb-1">Hur fungerar beräkningen?</p>
                            <p className="leading-relaxed">
                                Formeln tar det **bästa passet** i det glidande fönstret ({calculationWindowDays} dagar). 
                                Den extrapolerar dina tider till andra distanser med **Riegels formel** (för pass $\ge$ 3 km).
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 border-t border-white/[0.03] pt-2">
                        <Heart size={16} className="text-amber-500 shrink-0" />
                        <div>
                            <p className="font-bold text-white mb-1">Puls-extrapolering (💡)</p>
                            <p className="leading-relaxed">
                                För att gissa kapacitet från lättare pass räknar vi ut vad din fart motsvarar vid 100% max-puls. 
                                Vi kräver nu att passet är **minst 15 minuter** och att intensiteten är **minst 65% av max-puls** för stabilare data.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 border-t border-white/[0.03] pt-2">
                        <Activity size={16} className="text-indigo-400 shrink-0" />
                        <div>
                            <p className="font-bold text-white mb-1">Hur hanteras ålder på pass?</p>
                            <p className="leading-relaxed">
                                För att kurvan ska vara jämn tillämpas **fitness-decay**. Äldre pass blir max 0.2% långsammare per dag efter en grace-period ({calculationWindowDays / 2} dagar).
                            </p>
                            <p className="leading-relaxed mt-1 text-emerald-400 text-[11px] font-medium">
                                💡 **Volym-rabatt:** Om du underhåller din löpvolym (totalt km senaste 30 dagarna) bromsas försämringen (upp till 50% rabatt vid 100 km).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className={`${selectedDp ? 'lg:col-span-2' : 'lg:col-span-3'} h-[400px] w-full transition-all duration-300`}>
                    {capacityData.length > 0 ? memoizedChart : (
                        <div className="h-full flex items-center justify-center text-slate-500 italic bg-slate-800/50 rounded-2xl border border-white/5">
                            För lite data för att beräkna kapacitet i denna period.
                        </div>
                    )}
                </div>

                {sidebarDp && (
                    <div id="capacity-detail" className={`bg-slate-900 border ${!sidebarDp.isExtrapolated ? 'border-emerald-500/50 shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)]' : 'border-blue-500/40'} rounded-2xl p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 lg:slide-in-from-right-4 duration-300 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)]`}>
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-xl border border-white/5 text-[10px]">
                                <p className="font-bold text-slate-400">Inställningar för analys</p>
                                <div className="flex gap-1.5">
                                    <button 
                                        onClick={() => setUseEndurancePenalty(!useEndurancePenalty)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-black uppercase transition-all ${
                                            useEndurancePenalty ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-800 border-white/5 text-slate-500'
                                        }`}
                                    >
                                        Uthållighet
                                    </button>
                                    <button 
                                        onClick={() => setUseTapering(!useTapering)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-black uppercase transition-all ${
                                            useTapering && sidebarDp.weeklyAvgVolume && sidebarDp.weeklyAvgVolume >= 35 ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-slate-800 border-white/5 text-slate-500'
                                        }`}
                                    >
                                        Tapering
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-between items-start">
                                <div className="flex gap-3 items-center">
                                    <div className={`p-2 rounded-xl ${sidebarDp.isExtrapolated ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                        {sidebarDp.isExtrapolated ? <Heart size={24} /> : <Zap size={24} />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase">Analys för {sidebarDp.date}</p>
                                        {sidebarDp.bestActivityId && onOpenActivity ? (
                                            <p 
                                                className="text-base font-black text-white hover:text-blue-400 cursor-pointer transition-colors flex items-center gap-1 group/title"
                                                onClick={() => onOpenActivity(sidebarDp.bestActivityId!)}
                                            >
                                                {sidebarDp.bestActivityTitle || 'Okänt pass'}
                                                <ExternalLink size={14} className="opacity-0 group-hover/title:opacity-100 transition-opacity text-slate-500" />
                                            </p>
                                        ) : (
                                            <p className="text-base font-black text-white">{sidebarDp.bestActivityTitle || 'Okänt pass'}</p>
                                        )}
                                        {sidebarDp.actualDistance && sidebarDp.actualDurationMinutes && (
                                            <p className="text-xs text-slate-400">
                                                {sidebarDp.actualDistance.toFixed(1)} km ({formatPace(sidebarDp.actualDurationMinutes / sidebarDp.actualDistance)}) vid {Math.round(sidebarDp.actualDurationMinutes)} min 
                                                {sidebarDp.actualHr ? ` | medel-puls ${Math.round(sidebarDp.actualHr)}` : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedDp(null)}
                                    className="p-1.5 px-3 bg-slate-800 text-slate-400 rounded-xl hover:text-white hover:bg-slate-700 text-xs font-bold"
                                >
                                    Stäng
                                </button>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                <div className="p-2 bg-white/5 rounded-xl">
                                    <p className="text-[10px] font-black text-slate-500 uppercase">Typ</p>
                                    <p className="text-xs font-bold text-white">
                                        {selectedDp.isExtrapolated ? '⚡ Extrapolering' : '🏆 Direkt Resultat'}
                                    </p>
                                </div>
                                <div className="p-2 bg-white/5 rounded-xl">
                                    <p className="text-[10px] font-black text-slate-500 uppercase">Tempo</p>
                                    <p className="text-xs font-bold font-mono text-white">
                                        {selectedDp.actualDistance && selectedDp.actualDurationMinutes 
                                            ? formatPace(selectedDp.actualDurationMinutes / selectedDp.actualDistance) 
                                            : '-/km'}
                                    </p>
                                </div>
                                {selectedDp.percentHRMax && (
                                    <div className="p-2 bg-white/5 rounded-xl">
                                        <p className="text-[10px] font-black text-slate-500 uppercase">Intensitet</p>
                                        <p className="text-xs font-bold font-mono text-white">
                                            {selectedDp.percentHRMax}% <span className="text-[10px] opacity-60 text-slate-400">av max</span>
                                        </p>
                                    </div>
                                )}
                                {selectedDp.actualHr && selectedDp.percentHRMax && (
                                    <div className="p-2 bg-white/5 rounded-xl border border-emerald-500/10">
                                        <p className="text-[10px] font-black text-slate-500 uppercase">Max-puls Estimat</p>
                                        <p className="text-xs font-bold font-mono text-white">
                                            {Math.round(selectedDp.actualHr / (selectedDp.percentHRMax / 100))} <span className="text-[10px] opacity-60 text-slate-400">bpm</span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Kapacitets-prognos (Always Visible) */}
                            <div className="bg-slate-800/30 border border-white/5 rounded-xl p-3 space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                                    <Trophy size={12} className="text-amber-400" /> Beräknad Kapacitets-prognos
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-white/10 pt-2">
                                    {sidebarDp.capacity5k && (
                                        <div className="p-2 bg-white/5 rounded-lg text-center border border-white/5">
                                            <p className="text-[8px] text-slate-400 uppercase font-black">5 KM</p>
                                            <p className="font-mono text-white text-sm font-black">{timeToStr(sidebarDp.capacity5k)}</p>
                                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatPace(sidebarDp.capacity5k / 5)}</p>
                                        </div>
                                    )}
                                    {sidebarDp.capacity10k && (
                                        <div className="p-2 bg-white/5 rounded-lg text-center border border-white/5">
                                            <p className="text-[8px] text-slate-400 uppercase font-black">10 KM</p>
                                            <p className="font-mono text-white text-sm font-black">{timeToStr(sidebarDp.capacity10k)}</p>
                                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatPace(sidebarDp.capacity10k / 10)}</p>
                                        </div>
                                    )}
                                    {sidebarDp.capacity21k && (
                                        <div className="p-2 bg-white/5 rounded-lg text-center border border-white/5">
                                            <p className="text-[8px] text-slate-400 uppercase font-black">Halvmaraton</p>
                                            <p className="font-mono text-white text-sm font-black">{timeToStr(sidebarDp.capacity21k)}</p>
                                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatPace(sidebarDp.capacity21k / 21.0975)}</p>
                                        </div>
                                    )}
                                    {sidebarDp.capacity42k && (
                                        <div className="p-2 bg-white/5 rounded-lg text-center border border-white/5">
                                            <p className="text-[8px] text-slate-400 uppercase font-black">Maraton</p>
                                            <p className="font-mono text-white text-sm font-black">{timeToStr(sidebarDp.capacity42k)}</p>
                                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatPace(sidebarDp.capacity42k / 42.195)}</p>
                                        </div>
                                    )}
                                </div>

                                {sidebarDp.weeklyAvgVolume !== undefined && (
                                    <div className={`border-t border-white/10 pt-2 space-y-1.5 ${!useEndurancePenalty ? 'opacity-50' : ''}`}>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <p className="font-black text-slate-500 uppercase flex items-center gap-1">
                                                ⚖️ Uthållighets-faktor (90d) {!useEndurancePenalty && <span className="text-slate-600 text-[8px] font-bold">(AVSLAGEN)</span>}
                                            </p>
                                            <p className={`font-bold ${useEndurancePenalty && sidebarDp.enduranceExponentUsed && sidebarDp.enduranceExponentUsed > 1.06 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                Riegel Exp: {sidebarDp.enduranceExponentUsed?.toFixed(2) || '1.06'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="flex justify-between bg-white/5 px-2 py-1 rounded">
                                                <span className="text-slate-500 text-[9px]">Snittvolym:</span>
                                                <span className="font-bold text-white">{sidebarDp.weeklyAvgVolume} km/v</span>
                                            </div>
                                            <div className="flex justify-between bg-white/5 px-2 py-1 rounded">
                                                <span className="text-slate-500 text-[9px]">Långpass:</span>
                                                <span className="font-bold text-white">{sidebarDp.longRuns90dCount} st</span>
                                            </div>
                                        </div>
                                        {useEndurancePenalty && sidebarDp.enduranceExponentUsed && sidebarDp.enduranceExponentUsed > 1.06 && (
                                            <p className="text-[9px] text-amber-500/80 leading-tight">
                                                💡 Låg volym ökar exponenten. Predictions blir mer defensiva.
                                            </p>
                                        )}
                                        {useTapering && sidebarDp.weeklyAvgVolume && sidebarDp.weeklyAvgVolume >= 35 && (
                                            <p className="text-[9px] text-purple-400 leading-tight flex items-center gap-1">
                                                ✨ Tapering tillämpad: -1.5% tidspotential pga högvolym-block!
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                        {typeof maxUserHR === 'object' && 'sourceTitle' in maxUserHR && (
                            <div className="bg-slate-800/30 border border-white/5 rounded-xl p-3 mt-2 space-y-1">
                                <p className="font-black text-slate-500 uppercase flex items-center gap-1 text-[10px]">
                                    🫀 Max-puls källa
                                </p>
                                <p className="text-[10px] text-slate-300 leading-tight">
                                    Hämtad från <span className="text-white font-medium">{maxUserHR.sourceTitle}</span> ({maxUserHR.sourceDate}) där du nådde {maxUserHR.peakMeasured} bpm.
                                </p>
                                <p className="text-[10px] text-slate-400 leading-tight">
                                    Justering: +1.5 bpm - {maxUserHR.yearsPassed} bpm (ålder) = <span className="text-emerald-400 font-bold">{maxUserHR.value} bpm</span>
                                </p>
                            </div>
                        )}

                        {sidebarDp.actualDistance && sidebarDp.actualDurationMinutes && sidebarDp.percentHRMax && (
                            <div className="bg-white/5 border border-white/[0.05] rounded-xl p-3 text-xs opacity-90 space-y-2">
                                <p className="font-bold text-blue-400 flex items-center gap-1">💡 {sidebarDp.isExtrapolated ? 'Matematiken bakom extrapoleringen' : 'Matematiken bakom beräkningen'}:</p>
                                <div className="flex flex-col gap-2 text-slate-300">
                                    <div className="p-2 bg-slate-800/50 rounded-lg flex justify-between items-center">
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase font-black">1. ditt tempo</p>
                                        </div>
                                        <p className="font-mono text-white text-sm font-black">
                                            {formatPace(sidebarDp.actualDurationMinutes / sidebarDp.actualDistance)}
                                        </p>
                                    </div>
                                    
                                    <div className="p-2 bg-slate-800/50 rounded-lg flex justify-between items-center border border-blue-500/10">
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase font-black">2. uppskattad maxfart</p>
                                            <p className="text-[10px] text-slate-500">Vid 100% puls / Max effort</p>
                                        </div>
                                        {(() => {
                                            const speedMpm = 1000 / (sidebarDp.actualDurationMinutes / sidebarDp.actualDistance);
                                            const maxSpeedMpm = speedMpm / (0.5 + 0.5 * (sidebarDp.percentHRMax / 100));
                                            const maxPaceMinPerKm = 1000 / maxSpeedMpm;
                                            return (
                                                <p className="font-mono text-emerald-400 text-sm font-black">
                                                    {formatPace(maxPaceMinPerKm)}
                                                </p>
                                            );
                                        })()}
                                    </div>

                                    <div className="p-2 bg-slate-800/50 rounded-lg">
                                        <p className="text-[9px] text-slate-400 uppercase font-black mb-1">Formeln</p>
                                        <p className="font-mono text-blue-300 text-[11px] break-all">
                                            Speed / (0.5 + 0.5 * {sidebarDp.percentHRMax / 100})
                                        </p>
                                    </div>

                                    <div className="p-2 bg-blue-500/10 rounded-lg flex justify-between items-center">
                                         <p className="font-bold text-blue-400 flex items-center gap-1">Projicerad 10K-tid</p>
                                         <p className="font-mono text-white font-black text-base">
                                              {sidebarDp.capacity10k ? timeToStr(sidebarDp.capacity10k) : 'N/A'}
                                         </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
