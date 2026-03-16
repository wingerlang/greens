import React, { useMemo, useState } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import {
    X, Medal, Zap, Activity, Clock, TrendingUp, TrendingDown,
    Mountain, Coffee, Timer, Sparkles, RefreshCw, Trophy,
    Shield, Target, Heart, ChevronRight, ChevronLeft, MapPin, Star, Trophy as TrophyIcon
} from 'lucide-react';
import { formatTime, isCompetition } from '../../utils/activityUtils.ts';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ComposedChart, Line, Scatter, CartesianGrid } from 'recharts';
import { useData } from '../../context/DataContext.tsx';
import { useNavigate } from 'react-router-dom';
import { ActivityDetailModal } from '../activities/ActivityDetailModal.tsx';
import { ExerciseSubType } from '../../models/types.ts';

interface PBEvent {
    id: string;
    date: string;
    distance: number;
    durationSeconds: number;
    durationFormatted: string;
    bucketLabel: string;
    previousDurationSeconds?: number;
    improvementSeconds?: number;
    isRace: boolean;
    activity: ExerciseEntry;
}

interface PBAnalysisModalProps {
    pbEvent: PBEvent;
    allActivities: ExerciseEntry[];
    onClose: () => void;
}

export function PBAnalysisModal({ pbEvent, allActivities, onClose }: PBAnalysisModalProps) {
    const navigate = useNavigate();
    const [timeframeWeeks, setTimeframeWeeks] = useState(12);
    const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
    const { weightEntries, calculateDailyNutrition, exerciseEntries } = useData();

    // 1. Setup the dynamic window leading UP TO the PB date
    const analysisWindow = useMemo(() => {
        const pbDate = new Date(pbEvent.date).getTime();
        const timeframeMs = timeframeWeeks * 7 * 24 * 60 * 60 * 1000;
        const startDateMs = pbDate - timeframeMs;

        // Filter activities that happened in the timeframe strictly before or on the PB day
        const windowActivities = allActivities.filter(a => {
            const time = new Date(a.date).getTime();
            return time >= startDateMs && time <= pbDate;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let totalRunVolumeKm = 0;
        let totalRunTimeMin = 0;
        let totalActiveTimeMin = 0; // Total time all sports
        let totalElevationGain = 0;
        let maxElevationInOneRun = 0;
        let totalRunCount = 0;

        let qualityCount = 0; // Intervals, tempo, thresholds
        let longerDistCount = 0; // 14-20km (Längre Distans)
        let longRunCount = 0; // 20-40km (Långpass)
        let ultraLongRunCount = 0; // 40km+ (Överlångt)
        let distanceCount = 0; // Everything else

        let strengthCount = 0;
        let cyclingCount = 0;
        let otherCount = 0;

        const sessionsPerDay: Record<string, number> = {};
        const activeDays = new Set<string>();

        const races: ExerciseEntry[] = [];
        const qualitySessions: ExerciseEntry[] = [];
        const trainingRuns: ExerciseEntry[] = [];

        let fastestPaceSecPerKm = Infinity;
        let fastestRun: ExerciseEntry | null = null;

        // Weekly Volume chart data
        const weeklyVolume: Record<string, number> = {};
        const weeklyHealth: Record<string, { kcalTotal: number; weightSum: number; weightCount: number; strengthCount: number; raceCount: number; maxRaceDistance: number }> = {};

        for (let i = 0; i < timeframeWeeks; i++) {
            const weekKey = `Vecka -${timeframeWeeks - i}`;
            weeklyVolume[weekKey] = 0;
            weeklyHealth[weekKey] = { kcalTotal: 0, weightSum: 0, weightCount: 0, strengthCount: 0, raceCount: 0, maxRaceDistance: 0 };
        }

        // Pre-fill days for kcal
        for (let i = 0; i < timeframeWeeks * 7; i++) {
            const dateMs = pbDate - i * 24 * 60 * 60 * 1000;
            const dateStr = new Date(dateMs).toISOString().split('T')[0];
            const weeksBeforePB = Math.floor(i / 7);

            if (weeksBeforePB < timeframeWeeks) {
                const weekKey = `Vecka -${weeksBeforePB + 1}`;
                if (weeklyHealth[weekKey]) {
                    const nut = calculateDailyNutrition(dateStr);
                    if (nut && nut.calories > 0) {
                        weeklyHealth[weekKey].kcalTotal += nut.calories;
                    }
                }
            }
        }

        windowActivities.forEach(act => {
            const actTimeMs = new Date(act.date).getTime();
            const daysBeforePB = Math.floor((pbDate - actTimeMs) / (1000 * 60 * 60 * 24));
            const weeksBeforePB = Math.floor(daysBeforePB / 7);

            // Weekly aggregation
            if (weeksBeforePB < timeframeWeeks) {
                const weekKey = `Vecka -${weeksBeforePB + 1}`;
                const isRunning = act.type.toLowerCase().includes('run') || act.type.toLowerCase().includes('löpning');
                const isRace = isCompetition(act);

                if (isRunning) {
                    // STICKT LOGIC: If this is the PB activity itself, don't count it towards "Training Preparation"
                    if (act.id !== pbEvent.id) {
                        weeklyVolume[weekKey] = (weeklyVolume[weekKey] || 0) + (act.distance || 0);
                    }
                    if (isRace) {
                        weeklyHealth[weekKey].raceCount++;
                        const dist = act.distance || 0;
                        if (dist > (weeklyHealth[weekKey].maxRaceDistance || 0)) {
                            weeklyHealth[weekKey].maxRaceDistance = dist;
                        }
                    }
                }
                if (act.type.toLowerCase().includes('strength') || act.type.toLowerCase().includes('styrka') || act.type.toLowerCase() === 'weighttraining') {
                    weeklyHealth[weekKey].strengthCount++;
                }
            }

            // Frequency/Double Days
            const dateStr = act.date.substring(0, 10);
            sessionsPerDay[dateStr] = (sessionsPerDay[dateStr] || 0) + 1;
            activeDays.add(dateStr);
            totalActiveTimeMin += (act.durationMinutes || 0);

            const isRunning = act.type.toLowerCase().includes('run') || act.type.toLowerCase().includes('löpning');
            const isRace = isCompetition(act);

            if (isRace && isRunning) races.push(act);

            if (isRunning && act.distance && act.durationMinutes) {
                // DON'T include PB itself in these "lead-up" counters
                if (act.id === pbEvent.id) return;

                totalRunVolumeKm += act.distance;
                totalRunTimeMin += act.durationMinutes;
                totalElevationGain += (act.elevationGain || 0);
                totalRunCount++;

                const isQuality = act.title?.toLowerCase().includes('intervall') ||
                    act.notes?.toLowerCase().includes('intervall') ||
                    act.title?.toLowerCase().includes('tempo') ||
                    act.title?.toLowerCase().includes('tröskel') ||
                    act.subType === 'interval' || 
                    act.subType === 'tempo' || 
                    act.subType === 'race';

                if (!isRace) {
                    const enriched = { ...act, isQuality: !!isQuality };
                    trainingRuns.push(enriched);
                }
                
                const pace = (act.durationMinutes * 60) / act.distance;
                if (pace < fastestPaceSecPerKm && pace > 120) {
                    fastestPaceSecPerKm = pace;
                    fastestRun = act;
                }
                if ((act.elevationGain || 0) > maxElevationInOneRun) {
                    maxElevationInOneRun = act.elevationGain || 0;
                }

                if (!isRace) {
                    if (isQuality) {
                        qualityCount++;
                        qualitySessions.push(act);
                    } else if (act.distance >= 14) {
                        if (act.distance >= 40) ultraLongRunCount++;
                        else if (act.distance >= 20) longRunCount++;
                        else longerDistCount++;
                    } else {
                        distanceCount++;
                    }
                }
            } else {
                const lowType = act.type.toLowerCase();
                if (lowType.includes('strength') || lowType.includes('styrka') || lowType === 'weighttraining') {
                    strengthCount++;
                } else if (lowType.includes('cycle') || lowType.includes('cykel') || lowType === 'virtualride' || lowType === 'ride') {
                    cyclingCount++;
                } else {
                    otherCount++;
                }
            }
        });

        // Add Weight Entries
        weightEntries.forEach(w => {
            const wTimeMs = new Date(w.date).getTime();
            if (wTimeMs >= startDateMs && wTimeMs <= pbDate) {
                const daysBeforePB = Math.floor((pbDate - wTimeMs) / (1000 * 60 * 60 * 24));
                const weeksBeforePB = Math.floor(daysBeforePB / 7);
                if (weeksBeforePB < timeframeWeeks) {
                    const weekKey = `Vecka -${weeksBeforePB + 1}`;
                    if (weeklyHealth[weekKey]) {
                        weeklyHealth[weekKey].weightSum += w.weight;
                        weeklyHealth[weekKey].weightCount++;
                    }
                }
            }
        });

        // Calculate Longest Runs (Top 3)
        const top3LongRuns = [...trainingRuns]
            .sort((a, b) => (b.distance || 0) - (a.distance || 0))
            .slice(0, 3);

        // Fastest Run (Exclude Top Long and PB)
        trainingRuns.forEach(act => {
            if (act.id === pbEvent.id) return;
            if (top3LongRuns.length > 0 && act.id === top3LongRuns[0].id) return;
            const paceSec = (act.durationMinutes * 60) / (act.distance || 1);
            if (act.distance && act.distance >= 3 && paceSec < fastestPaceSecPerKm) {
                fastestPaceSecPerKm = paceSec;
                fastestRun = act;
            }
        });

        // Averages
        const avgWeeklyVol = totalRunVolumeKm / timeframeWeeks;
        let lastWeekVol = 0;
        let prevWeeksVolAvg = 0;
        if (timeframeWeeks > 1) {
            lastWeekVol = weeklyVolume['Vecka -1'] || 0;
            const prevTotal = Object.entries(weeklyVolume)
                .filter(([k]) => k !== 'Vecka -1')
                .reduce((sum, [, v]) => sum + v, 0);
            prevWeeksVolAvg = prevTotal / (timeframeWeeks - 1);
        }

        const avgPaceSecPerKm = totalRunCount > 0 ? (totalRunTimeMin * 60) / totalRunVolumeKm : 0;
        const doubleDaysCount = Object.values(sessionsPerDay).filter(count => count > 1).length;
        const avgSessionsPerWeek = Object.keys(sessionsPerDay).length / timeframeWeeks;
        const totalDaysInPeriod = timeframeWeeks * 7;
        const restDays = totalDaysInPeriod - activeDays.size;

        // Longest Streak
        const sortedActiveDays = Array.from(activeDays).sort();
        let longestStreak = 0;
        let currentStreak = 0;
        let lastDate: Date | null = null;
        sortedActiveDays.forEach(dateStr => {
            const d = new Date(dateStr);
            if (!lastDate) { currentStreak = 1; } else {
                const diffDays = Math.ceil(Math.abs(d.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) currentStreak++; else currentStreak = 1;
            }
            if (currentStreak > longestStreak) longestStreak = currentStreak;
            lastDate = d;
        });

        const peakVolumeWeek = Math.max(0, ...Object.values(weeklyVolume));
        const consistencyScore = (activeDays.size / totalDaysInPeriod) * 100;
        const qualityVol = qualitySessions.reduce((sum, s) => sum + (s.distance || 0), 0);
        const qualityRatio = totalRunVolumeKm > 0 ? (qualityVol / totalRunVolumeKm) * 100 : 0;

        // Pros & Cons
        const pros: string[] = [];
        const cons: string[] = [];
        if (longRunCount >= 3) pros.push("Bra uthållighetsgrund med regelbundna långpass"); else cons.push("Få långpass i perioden, potentiellt svag uthållighetsbas");
        if (qualityCount >= Math.floor(timeframeWeeks / 2)) pros.push("Konsekvent upprätthållande av kvalitetspass/fart"); else cons.push("Avsaknad av kontinuitet i kvalitetspass");
        if (strengthCount >= Math.floor(timeframeWeeks * 0.5)) pros.push("Bra skadeförebyggande rutin (styrke/alternativ träning)"); else if (strengthCount === 0) cons.push("Ingen styrketräning loggad (ökad skaderisk)");
        if (timeframeWeeks > 1 && lastWeekVol < prevWeeksVolAvg * 0.85) pros.push("Tydlig och vältajmad formtoppning (Tapering)"); else if (timeframeWeeks > 1 && lastWeekVol > prevWeeksVolAvg * 1.05) cons.push("Ingen tapering genomförd sista veckan");
        if (longestStreak >= 5) pros.push(`Stark kontinuitet i träningen (max-streak: ${longestStreak} dagar)`);
        if (restDays < timeframeWeeks) cons.push("Väldigt få vilodagar (potentiell underåterhämtning)");

        const rawChartData = Object.keys(weeklyVolume).sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])).map(key => ({
            week: key,
            vol: Math.round(weeklyVolume[key] * 10) / 10,
            raceCount: weeklyHealth[key].raceCount,
            maxRaceDistance: weeklyHealth[key].maxRaceDistance,
            weight: weeklyHealth[key].weightCount > 0 ? Math.round((weeklyHealth[key].weightSum / weeklyHealth[key].weightCount) * 10) / 10 : null,
            kcal: weeklyHealth[key].kcalTotal > 0 ? Math.round(weeklyHealth[key].kcalTotal / 7) : null
        }));

        const weightDataPoints = weightEntries.filter(w => new Date(w.date).getTime() >= startDateMs && new Date(w.date).getTime() <= pbDate);
        const hasHealthData = weightDataPoints.length >= 3;

        const longRunsList = trainingRuns.filter(r => (r.distance || 0) >= 20 && !(r as any).isQuality);
        const longerDistList = trainingRuns.filter(r => (r.distance || 0) >= 14 && (r.distance || 0) < 20 && !(r as any).isQuality);
        const easyRunsList = trainingRuns.filter(r => (r.distance || 0) < 14 && !(r as any).isQuality); // For "Andra Distans" OR Recovery subtiling if needed

        return {
            top3LongRuns, fastestRun: fastestRun as ExerciseEntry | null,
            races: races.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            qualityCount, distanceCount, longRunCount, longerDistCount, ultraLongRunCount,
            totalElevationGain, maxElevationInOneRun, fastestPaceSecPerKm, totalActiveTimeMin, restDays, activeDaysCount: activeDays.size, totalDaysInPeriod,
            longRunsList: longRunsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            longerDistList: longerDistList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            easyRunsList: easyRunsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            avgWeeklyVol, lastWeekVol, prevWeeksVolAvg, avgPaceSecPerKm,
            strengthCount, cyclingCount, otherCount, doubleDaysCount, avgSessionsPerWeek,
            chartData: rawChartData, hasHealthData,
            weightDataPoints: weightDataPoints.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            windowActivities, longestStreak, peakVolumeWeek, consistencyScore, qualityRatio,
            pros, cons,
            qualitySessions: qualitySessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            totalRunTimeMin,
            totalRunCount,
            totalRunVolumeKm
        };
    }, [pbEvent, allActivities, timeframeWeeks, weightEntries, calculateDailyNutrition]);

    const formatPace = (secPerKm: number) => {
        if (!isFinite(secPerKm) || secPerKm <= 0) return '-';
        const m = Math.floor(secPerKm / 60);
        const s = Math.round(secPerKm % 60);
        return `${m}:${s.toString().padStart(2, '0')}/km`;
    };

    const ActivityRow = ({ r, icon }: { r: ExerciseEntry; icon: React.ReactNode }) => {
        const [dYear, dMonth, dDay] = r.date.split('-');
        const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
        const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
        const paceSec = r.durationMinutes > 0 ? (r.durationMinutes * 60) / (r.distance || 1) : 0;

        return (
            <div
                key={r.id}
                className="flex justify-between items-center bg-white/5 rounded-lg p-2 hover:bg-white/10 cursor-pointer transition-colors border border-white/[0.03] hover:border-white/10"
                onClick={() => {
                    setSelectedDetailId(r.id);
                }}
            >
                <div className="overflow-hidden flex items-center gap-2">
                    <div className="p-1 rounded bg-slate-800 text-slate-300">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate" title={r.title || r.type}>
                            {r.title || r.type}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 flex-wrap">
                            <span>{r.date.substring(0, 10)}</span>
                            {r.distance && (
                                <span className={`text-[8px] font-black px-1.5 py-0.25 rounded-sm uppercase tracking-wider ${
                                    r.subType === 'interval' || r.title?.toLowerCase().includes('intervall') ? 'bg-amber-500/20 text-amber-500' :
                                    r.subType === 'tempo' || r.title?.toLowerCase().includes('tempo') ? 'bg-yellow-500/20 text-yellow-500' :
                                    (r as any).isQuality ? 'bg-orange-500/20 text-orange-400' :
                                    r.distance >= 40 ? 'bg-purple-500/20 text-purple-400' : 
                                    r.distance >= 20 ? 'bg-emerald-500/20 text-emerald-400' : 
                                    r.distance >= 14 ? 'bg-sky-500/20 text-sky-400' :
                                    r.distance <= 7 ? 'bg-indigo-500/20 text-indigo-400' :
                                    'bg-slate-500/20 text-slate-400'
                                }`}>
                                    {r.subType === 'interval' || r.title?.toLowerCase().includes('intervall') ? 'Intervall' :
                                     r.subType === 'tempo' || r.title?.toLowerCase().includes('tempo') ? 'Tempo' :
                                     (r as any).isQuality ? 'Kvalitét' :
                                     r.distance >= 40 ? 'Överlångt' : r.distance >= 20 ? 'Långpass' : r.distance >= 14 ? 'Längre Distans' : r.distance <= 7 ? 'Återhämtning' : 'Distans'}
                                </span>
                            )}
                            {isCompetition(r) && (
                                <span className="bg-red-500/20 text-red-500 text-[8px] font-black px-1.5 py-0.25 rounded-sm uppercase tracking-wider">
                                    Tävling
                                </span>
                            )}
                            {isCompetition(r) && r.distance && r.distance >= 45 && (
                                <span className="bg-fuchsia-500/20 text-fuchsia-400 text-[8px] font-black px-1.5 py-0.25 rounded-sm uppercase tracking-wider">
                                    Ultra
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end">
                    <div className="text-xs font-black text-white">{r.distance?.toFixed(1)} <span className="text-[9px] opacity-40">km</span></div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <span>{formatPace(paceSec)}</span>
                        {r.heartRateAvg !== undefined && r.heartRateAvg > 0 && (
                            <span className="flex items-center gap-0.5 text-rose-400">
                                <Heart size={10} className="stroke-[2.5]" />
                                {Math.round(r.heartRateAvg)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">{label}</p>
                    <div className="space-y-1.5">
                        <div className="flex justify-between gap-8">
                            <span className="text-xs text-slate-400">Volym:</span>
                            <span className="text-xs font-black text-white">{data.vol} km</span>
                        </div>
                        {data.raceCount > 0 && (
                            <div className="flex justify-between gap-8">
                                <span className="text-xs text-amber-500">Tävling:</span>
                                <span className="text-xs font-black text-amber-400">{data.maxRaceDistance} km</span>
                            </div>
                        )}
                        {data.weight && (
                            <div className="flex justify-between gap-8">
                                <span className="text-xs text-slate-400">Vikt:</span>
                                <span className="text-xs font-black text-white">{data.weight} kg</span>
                            </div>
                        )}
                        {data.kcal && (
                            <div className="flex justify-between gap-8">
                                <span className="text-xs text-rose-400">Snitt Kcal:</span>
                                <span className="text-xs font-black text-rose-300">{data.kcal}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const handleExportJson = () => {
        const exportData = {
            metadata: {
                generateDate: new Date().toISOString(),
                timeframeWeeks: timeframeWeeks,
                pbDate: pbEvent.date.substring(0, 10),
            },
            pbEvent: {
                title: pbEvent.activity?.title || pbEvent.bucketLabel,
                distance: pbEvent.distance,
                durationSeconds: pbEvent.durationSeconds,
                pace: formatPace(pbEvent.durationSeconds / pbEvent.distance),
                date: pbEvent.date.substring(0, 10)
            },
            summaryStats: {
                totalVolumeKm: Math.round(analysisWindow.totalRunVolumeKm),
                avgWeeklyVolKm: Math.round(analysisWindow.avgWeeklyVol),
                totalRuns: analysisWindow.totalRunCount,
                totalRunTimeHours: Math.floor(analysisWindow.totalRunTimeMin / 60),
                avgPace: formatPace(analysisWindow.avgPaceSecPerKm),
                totalElevationGain: Math.round(analysisWindow.totalElevationGain),
                maxElevationInOneRun: Math.round(analysisWindow.maxElevationInOneRun),
                consistencyScore: Math.round(analysisWindow.consistencyScore),
                activeDaysCount: analysisWindow.activeDaysCount,
                totalDaysInPeriod: analysisWindow.totalDaysInPeriod,
                longestStreakDays: analysisWindow.longestStreak,
                peakVolumeWeekKm: (analysisWindow.peakVolumeWeek || 0).toFixed(1),
                strengthCount: analysisWindow.strengthCount,
                cyclingCount: analysisWindow.cyclingCount,
                doubleDaysCount: analysisWindow.doubleDaysCount
            },
            distributionCounts: {
                races: analysisWindow.races.length,
                quality: analysisWindow.qualityCount,
                longRuns: analysisWindow.longRunCount,
                longerDistans: analysisWindow.longerDistCount,
                distans: analysisWindow.distanceCount
            },
            races: analysisWindow.races.map(r => ({
                date: r.date.substring(0, 10),
                title: r.title || r.type,
                distance: r.distance,
                pace: r.durationMinutes > 0 ? formatPace((r.durationMinutes * 60) / (r.distance || 1)) : '-',
                heartRateAvg: r.heartRateAvg,
                elevationGain: r.elevationGain
            })),
            top3LongRuns: analysisWindow.top3LongRuns.map(r => ({
                date: r.date.substring(0, 10),
                title: r.title || r.type,
                distance: r.distance,
                pace: r.durationMinutes > 0 ? formatPace((r.durationMinutes * 60) / (r.distance || 1)) : '-'
            })),
            weeklyTrends: analysisWindow.chartData,
            weightStats: analysisWindow.weightDataPoints ? analysisWindow.weightDataPoints.map(w => ({
                date: w.date.substring(0, 10),
                weight: w.weight
            })) : undefined
        };
        navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
        alert('All synlig data har kopierats till urklipp i JSON-format!');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-7xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-slate-900 border-b border-white/5 px-6 py-2 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] shrink-0">
                            {pbEvent.isRace ? <Medal size={16} /> : <Zap size={16} />}
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                            <h2 className="text-base font-black text-white">
                                {pbEvent.bucketLabel} Rekord
                            </h2>
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-black text-amber-400 font-mono">
                                    {pbEvent.durationFormatted}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium font-mono">
                                    ({formatPace(pbEvent.durationSeconds / pbEvent.distance)})
                                </span>
                                {pbEvent.improvementSeconds && pbEvent.improvementSeconds > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                        <TrendingDown size={10} />
                                        {formatTime(pbEvent.improvementSeconds)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-950/80 rounded-lg border border-white/5 p-0.5 scale-90">
                            {[4, 8, 12, 16].map(weeks => (
                                <button key={weeks} onClick={() => setTimeframeWeeks(weeks)} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded transition-all ${timeframeWeeks === weeks ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>{weeks}v</button>
                            ))}
                        </div>
                        <button onClick={handleExportJson} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" title="Exportera JSON till urklipp">
                            <div className="bg-amber-500/10 p-1 rounded-sm border border-amber-500/20"><Activity size={12} className="text-amber-500" /></div> JSON
                        </button>
                        <div className="hidden lg:block text-[10px] font-bold text-slate-500 uppercase">
                            Analys t.o.m. {pbEvent.date.substring(0, 10)}
                        </div>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg shrink-0">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {/* Compact Metrics Bar */}
                    {/* Compact Metrics Bar */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl flex flex-col justify-between">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Activity size={12} className="text-blue-500" /> Volym (Totalt & Snitt)</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-black text-white">{Math.round(analysisWindow.totalRunVolumeKm)} <span className="text-[10px] font-bold text-slate-500">km</span></span>
                                <span className="text-xs text-slate-400">({Math.round(analysisWindow.avgWeeklyVol)} km/v)</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 flex gap-1 items-center">
                                <span>{analysisWindow.totalRunCount} pass</span>
                                <span>•</span>
                                <span>{Math.floor(analysisWindow.totalRunTimeMin / 60)}h {Math.round(analysisWindow.totalRunTimeMin % 60)}m</span>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Zap size={12} className="text-amber-500" /> Snitt-tempo</div>
                            <div className="text-xl font-black text-white">{formatPace(analysisWindow.avgPaceSecPerKm)}</div>
                            <div className="text-[9px] text-slate-500 mt-1">
                                {analysisWindow.fastestPaceSecPerKm < Infinity && (
                                    <span>Topp: <span className="font-bold text-amber-400">{formatPace(analysisWindow.fastestPaceSecPerKm)}</span></span>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Mountain size={12} className="text-rose-500" /> Totalt Höjd</div>
                            <div className="text-xl font-black text-rose-400">{Math.round(analysisWindow.totalElevationGain)} <span className="text-[10px] font-bold text-slate-500">m+</span></div>
                            <div className="text-[9px] text-slate-500 mt-1">
                                {analysisWindow.maxElevationInOneRun > 0 && (
                                    <span>Max/pass: <span className="font-bold text-rose-400">{Math.round(analysisWindow.maxElevationInOneRun)} m</span></span>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><TrendingUp size={12} className="text-emerald-500" /> Kontinuitet</div>
                            <div className="text-xl font-black text-emerald-400">{Math.round(analysisWindow.consistencyScore)}%</div>
                            <div className="text-[9px] text-slate-500 mt-1 flex flex-wrap gap-1 leading-tight">
                                <span>{analysisWindow.totalDaysInPeriod}d totalt</span>
                                <span className="opacity-50">•</span>
                                <span className="text-emerald-400">{analysisWindow.activeDaysCount} träningsdagar</span>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><TrophyIcon size={12} className="text-indigo-500" /> Toppvecka</div>
                            <div className="text-xl font-black text-indigo-400">{(analysisWindow.peakVolumeWeek || 0).toFixed(1)} <span className="text-[10px] font-bold text-slate-500">km</span></div>
                        </div>
                    </div>

                    <div className="hidden flex flex-col md:flex-row gap-2 justify-between items-center bg-slate-800/20 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center bg-slate-950/80 rounded-lg border border-white/5 p-1">
                            {[4, 8, 12, 16].map(weeks => (
                                <button key={weeks} onClick={() => setTimeframeWeeks(weeks)} className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${timeframeWeeks === weeks ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>{weeks}v</button>
                            ))}
                        </div>
                        <div className="text-[9px] font-black text-slate-600 uppercase flex items-center gap-2"><Activity size={10} className="text-amber-500" /> Data fram till {pbEvent.date.substring(0, 10)}</div>
                    </div>

                    {/* 1. Mängd & Formtoppning (Narrower) */}
                    <div className="max-w-xl mx-auto w-full bg-slate-900/50 border border-white/5 p-3 px-4 rounded-xl">
                        <div className="flex justify-between items-baseline">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><TrendingUp size={12} className="text-blue-500" /> Mängd & Formtoppning</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xs font-black text-slate-400">Sista veckan:</span>
                                <span className="text-lg font-black text-white">{(analysisWindow.lastWeekVol || 0).toFixed(1)} <span className="text-xs font-bold text-slate-500">km</span></span>
                                {analysisWindow.prevWeeksVolAvg > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${analysisWindow.lastWeekVol < analysisWindow.prevWeeksVolAvg ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                        {analysisWindow.lastWeekVol < analysisWindow.prevWeeksVolAvg ? '-' : '+'}
                                        {(Math.abs((((analysisWindow.lastWeekVol - analysisWindow.prevWeeksVolAvg) / analysisWindow.prevWeeksVolAvg) * 100)) || 0).toFixed(0)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Variation, Frekvens & Passfördelning (Full Width Flex) */}
                    <div className="bg-slate-900/50 border border-white/5 p-3 px-4 rounded-xl flex flex-col md:flex-row justify-between gap-4 items-center">
                        <div>
                            <h3 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mb-2"><RefreshCw size={12} className="text-indigo-500" /> Variation & Frekvens</h3>
                            <div className="flex gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-500 font-black uppercase">Styrka</span>
                                    <span className="text-lg font-black text-amber-500">{analysisWindow.strengthCount} <span className="text-[10px] text-slate-600">st</span></span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-500 font-black uppercase">Cykling</span>
                                    <span className="text-lg font-black text-blue-400">{analysisWindow.cyclingCount} <span className="text-[10px] text-slate-600">st</span></span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-500 font-black uppercase">Dubbelpass</span>
                                    <span className="text-lg font-black text-white">{analysisWindow.doubleDaysCount} <span className="text-[10px] text-slate-600">st</span></span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="text-right">
                                <div className="text-[10px] font-black text-slate-500 uppercase mb-1 text-center md:text-right">Passfördelning</div>
                                <div className="flex gap-1.5 flex-wrap justify-center">
                                    <div className="bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded text-center">
                                        <div className="text-xs font-black text-amber-500">{analysisWindow.races.length}</div>
                                        <div className="text-[8px] font-bold text-amber-600 uppercase">Tävl</div>
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded text-center">
                                        <div className="text-xs font-black text-blue-400">{analysisWindow.qualityCount}</div>
                                        <div className="text-[8px] font-bold text-blue-500 uppercase">Kval</div>
                                    </div>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-center">
                                        <div className="text-xs font-black text-emerald-400">{analysisWindow.longRunCount}</div>
                                        <div className="text-[8px] font-bold text-emerald-500 uppercase">Lång</div>
                                    </div>
                                    <div className="bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded text-center">
                                        <div className="text-xs font-black text-sky-400">{analysisWindow.longerDistCount || 0}</div>
                                        <div className="text-[8px] font-bold text-sky-500 uppercase">Längre</div>
                                    </div>
                                    <div className="bg-slate-800/50 px-2 py-1 rounded text-center">
                                        <div className="text-xs font-black text-white">{analysisWindow.distanceCount}</div>
                                        <div className="text-[8px] font-bold text-slate-500 uppercase">Dist</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-500/5 border border-indigo-500/10 p-2 rounded-xl text-center min-w-[75px]">
                                <div className="text-[8px] font-bold text-indigo-400 uppercase mb-0.5">Längsta Streak</div>
                                <div className="text-lg font-black text-white leading-none">{analysisWindow.longestStreak}</div>
                                <div className="text-[8px] font-bold text-slate-500 uppercase">Dagar</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-amber-500 mb-2 flex items-center gap-1"><Medal size={12} /> Tävlingar ({analysisWindow.races.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.races.length > 0 ? analysisWindow.races.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<TrophyIcon size={12} className="text-amber-500" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga tävlingar loggade</div>}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-emerald-500 mb-2 flex items-center gap-1"><Star size={12} /> Långpass ({analysisWindow.longRunsList.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.longRunsList.length > 0 ? analysisWindow.longRunsList.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<Activity size={12} className="text-emerald-400" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga långpass {">= 20km"}</div>}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-sky-500 mb-2 flex items-center gap-1"><Clock size={12} className="text-sky-500" /> Längre Distans ({analysisWindow.longerDistList.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.longerDistList.length > 0 ? analysisWindow.longerDistList.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<Activity size={12} className="text-sky-400" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga distanser {"14-20km"}</div>}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-blue-500 mb-2 flex items-center gap-1"><Zap size={12} /> Kvalitétspass ({analysisWindow.qualitySessions.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.qualitySessions.length > 0 ? analysisWindow.qualitySessions.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<Zap size={12} className="text-blue-400" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga kvalitetspass hittades</div>}
                            </div>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4`}>
                        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl h-64 flex flex-col">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2"><TrendingUp size={12} className="text-emerald-500" /> Volym & Tävlingsdistans</div>
                            </h3>
                            <div className="flex-1 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={analysisWindow.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                        <XAxis dataKey="week" hide />
                                        <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="vol" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#volGradient)" />
                                        <Scatter dataKey="vol" shape={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (payload.raceCount > 0) {
                                                return (
                                                    <g>
                                                        <circle cx={cx} cy={cy} r={6} fill="#f59e0b" fillOpacity={0.3} />
                                                        <circle cx={cx} cy={cy} r={3} fill="#f59e0b" />
                                                        <text x={cx} y={cy - 12} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="black">{payload.maxRaceDistance}KM</text>
                                                    </g>
                                                );
                                            }
                                            return <g />;
                                        }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl h-64 flex flex-col">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Heart size={12} className="text-rose-500" /> Hälsokurva
                            </h3>
                            {analysisWindow.hasHealthData ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analysisWindow.chartData}>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="kcal" stroke="#f43f5e" fillOpacity={0.1} fill="#f43f5e" />
                                        <Line type="monotone" dataKey="weight" stroke="#fff" strokeWidth={1} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                                    {analysisWindow.weightDataPoints.length > 0 ? analysisWindow.weightDataPoints.map((w, i) => (
                                        <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded-lg text-xs">
                                            <span className="text-slate-500">{w.date.substring(0, 10)}</span>
                                            <span className="font-black text-white">{(w.weight || 0).toFixed(1)} kg</span>
                                        </div>
                                    )) : <div className="text-xs text-slate-500 italic text-center py-10">Ingen hälsodata hittades.</div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {selectedDetailId && (
                    <ActivityDetailModal 
                        activity={allActivities.find(e => e.id === selectedDetailId) as any}
                        onClose={() => setSelectedDetailId(null)}
                    />
                )}
            </div>
        </div>
    );
}
