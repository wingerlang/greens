import React, { useMemo, useState } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { X, CalendarDays, Activity, Flame, Clock, TrendingUp, TrendingDown, RefreshCw, Zap, Medal, Mountain, Star, Download, FileText, Coffee, Dumbbell, Scale, Copy, Sparkles } from 'lucide-react';
import { formatTime, isCompetition } from '../../utils/activityUtils.ts';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ComposedChart, Bar, Line, Scatter, Cell, CartesianGrid } from 'recharts';
import { useData } from '../../context/DataContext.tsx';

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
    const [timeframeWeeks, setTimeframeWeeks] = useState(12);
    const { weightEntries, calculateDailyNutrition } = useData();

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
        let totalRunCount = 0;

        let qualityCount = 0; // Intervals, tempo, thresholds
        let longRunCount = 0; // > 15km
        let longRunsOver21Count = 0; // > 21km
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
        const weeklyHealth: Record<string, { kcalTotal: number; weightSum: number; weightCount: number; strengthCount: number }> = {};

        for (let i = 0; i < timeframeWeeks; i++) {
            const weekKey = `Vecka -${timeframeWeeks - i}`;
            weeklyVolume[weekKey] = 0;
            weeklyHealth[weekKey] = { kcalTotal: 0, weightSum: 0, weightCount: 0, strengthCount: 0 };
        }

        // Pre-fill days for kcal
        for (let i = 0; i < timeframeWeeks * 7; i++) {
            const dateMs = pbDate - i * 24 * 60 * 60 * 1000;
            const dateStr = new Date(dateMs).toISOString().split('T')[0];
            const daysBeforePB = i;
            const weeksBeforePB = Math.floor(daysBeforePB / 7);

            if (weeksBeforePB < timeframeWeeks) {
                const weekKey = `Vecka -${weeksBeforePB + 1}`;
                const nut = calculateDailyNutrition(dateStr);
                if (nut && nut.calories > 0) {
                    weeklyHealth[weekKey].kcalTotal += nut.calories;
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
                if (act.type.toLowerCase().includes('run') || act.type.toLowerCase().includes('löpning')) {
                    weeklyVolume[weekKey] = (weeklyVolume[weekKey] || 0) + (act.distance || 0);
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
                totalRunVolumeKm += act.distance;
                totalRunTimeMin += act.durationMinutes;
                totalElevationGain += (act.elevationGain || 0);
                totalRunCount++;

                if (!isRace) {
                    trainingRuns.push(act);
                }

                // Quality/Intervals check
                const isQuality = act.title?.toLowerCase().includes('intervall') ||
                    act.notes?.toLowerCase().includes('intervall') ||
                    act.title?.toLowerCase().includes('tempo') ||
                    act.title?.toLowerCase().includes('tröskel');

                if (!isRace) {
                    if (isQuality) {
                        qualityCount++;
                        qualitySessions.push(act);
                    } else if (act.distance >= 15) {
                        longRunCount++;
                        if (act.distance > 21) longRunsOver21Count++;
                    } else {
                        distanceCount++;
                    }
                }
            } else {
                if (act.type.toLowerCase().includes('strength') || act.type.toLowerCase().includes('styrka') || act.type.toLowerCase() === 'weighttraining') {
                    strengthCount++;
                } else if (act.type.toLowerCase().includes('cycle') || act.type.toLowerCase().includes('cykel') || act.type.toLowerCase() === 'virtualride' || act.type.toLowerCase() === 'ride') {
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

        // Calculate Fastest Run (Exclude the absolute longest run and the PB itself to ensure variety)
        trainingRuns.forEach(act => {
            if (act.id === pbEvent.id) return; // Exclude PB!
            if (top3LongRuns.length > 0 && act.id === top3LongRuns[0].id) return;

            const paceSec = (act.durationMinutes * 60) / (act.distance || 1);
            if (act.distance && act.distance >= 3 && paceSec < fastestPaceSecPerKm) {
                fastestPaceSecPerKm = paceSec;
                fastestRun = act;
            }
        });

        // Calculate Averages and Tapering
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

        // Longest Active Streak
        const sortedActiveDays = Array.from(activeDays).sort();
        let longestStreak = 0;
        let currentStreak = 0;
        let lastDate: Date | null = null;

        sortedActiveDays.forEach(dateStr => {
            const d = new Date(dateStr);
            if (!lastDate) {
                currentStreak = 1;
            } else {
                const diffTime = Math.abs(d.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    currentStreak++;
                } else {
                    currentStreak = 1; // reset break
                }
            }
            if (currentStreak > longestStreak) longestStreak = currentStreak;
            lastDate = d;
        });

        // Peak Volume
        const peakVolumeWeek = Math.max(0, ...Object.values(weeklyVolume));

        // Auto-Generate AI Pros & Cons
        const pros: string[] = [];
        const cons: string[] = [];

        if (longRunCount >= 3) pros.push("Bra uthållighetsgrund med regelbundna långpass");
        else cons.push("Få långpass i perioden, potentiellt svag uthållighetsbas");

        if (qualityCount >= Math.floor(timeframeWeeks / 2)) pros.push("Konsekvent upprätthållande av kvalitetspass/fart");
        else cons.push("Avsaknad av kontinuitet i kvalitetspass");

        if (strengthCount >= Math.floor(timeframeWeeks * 0.5)) pros.push("Bra skadeförebyggande rutin (styrke/alternativ träning)");
        else if (strengthCount === 0) cons.push("Ingen styrketräning loggad (ökad skaderisk)");

        if (timeframeWeeks > 1 && lastWeekVol < prevWeeksVolAvg * 0.85) pros.push("Tydlig och vältajmad formtoppning (Tapering) sista veckan");
        else if (timeframeWeeks > 1 && lastWeekVol > prevWeeksVolAvg * 1.05) cons.push("Ingen tapering genomförd (tuff volym nära inpå rekordet)");

        if (longestStreak >= 5) pros.push(`Stark kontinuitet i träningen (max-streak: ${longestStreak} dagar)`);
        if (restDays < timeframeWeeks) cons.push("Väldigt få vilodagar (potentiell underåterhämtning)");

        // Format chart data (reverse so it reads chronologically left to right)
        const rawChartData = Object.entries(weeklyVolume)
            .reverse()
            .map(([week, vol]) => {
                const health = weeklyHealth[week];
                const avgWeight = health.weightCount > 0 ? health.weightSum / health.weightCount : null;
                const avgKcal = health.kcalTotal > 0 ? health.kcalTotal / 7 : null;
                return {
                    week,
                    vol: Math.round(vol * 10) / 10,
                    weight: avgWeight ? Math.round(avgWeight * 10) / 10 : null,
                    kcal: avgKcal ? Math.round(avgKcal) : null
                };
            });

        // Interpolate missing weights using a simple fill strategy (closest known, or linear between)
        let lastKnownWeight: number | null = null;
        rawChartData.forEach(d => { if (d.weight !== null) lastKnownWeight = d.weight; else if (lastKnownWeight !== null) d.weight = lastKnownWeight; });
        let nextKnownWeight: number | null = null;
        for (let i = rawChartData.length - 1; i >= 0; i--) {
            if (rawChartData[i].weight !== null && rawChartData[i].weight !== lastKnownWeight) {
                nextKnownWeight = rawChartData[i].weight;
            } else if (rawChartData[i].weight === null && nextKnownWeight !== null) {
                rawChartData[i].weight = nextKnownWeight;
            }
        }

        const chartData = rawChartData;

        // Has Health Data?
        const hasHealthData = chartData.some(d => d.weight !== null || d.kcal !== null);

        return {
            top3LongRuns,
            fastestRun: fastestRun as ExerciseEntry | null,
            races: races.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), // Newest first
            qualityCount,
            distanceCount,
            longRunCount,
            longRunsOver21Count,
            totalElevationGain,
            totalActiveTimeMin,
            restDays,
            avgWeeklyVol,
            lastWeekVol,
            prevWeeksVolAvg,
            avgPaceSecPerKm,
            strengthCount,
            cyclingCount,
            otherCount,
            doubleDaysCount,
            avgSessionsPerWeek,
            chartData,
            hasHealthData,
            windowActivities,
            longestStreak,
            peakVolumeWeek,
            pros,
            cons
        };
    }, [pbEvent, allActivities, timeframeWeeks]);

    const formatPace = (secPerKm: number) => {
        if (!isFinite(secPerKm) || secPerKm <= 0) return '-';
        const m = Math.floor(secPerKm / 60);
        const s = Math.round(secPerKm % 60);
        return `${m}:${s.toString().padStart(2, '0')}/km`;
    };

    const handleExportJSON = () => {
        const dataStr = JSON.stringify({ pbEvent, analysis: analysisWindow }, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `pb-analysis-${pbEvent.date.substring(0, 10)}.json`;

        let linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const generateTextSummary = () => {
        return `
PERSONBÄSTA ANALYS
Distans: ${pbEvent.bucketLabel}
Tid: ${pbEvent.durationFormatted} (${formatPace(pbEvent.durationSeconds / pbEvent.distance)})
Datum: ${pbEvent.date.substring(0, 10)}

TRÄNINIGSDATA (SENASTE ${timeframeWeeks} VECKORNA)
- Snittmängd (Löpning): ${Math.round(analysisWindow.avgWeeklyVol)} km/vecka
- Snitt-tempo: ${formatPace(analysisWindow.avgPaceSecPerKm)}
- Höjdstigning: ${Math.round(analysisWindow.totalElevationGain)} m
- Aktiv tränings tid: ${Math.round(analysisWindow.totalActiveTimeMin / 60)} timmar
- Vilodagar totalt: ${analysisWindow.restDays} dagar

PASSFÖRDELNING LÖPNING (Totalt antal pass)
- Distanspass: ${analysisWindow.distanceCount}
- Kvalitetspass (Intervall/Tempo): ${analysisWindow.qualityCount}
- Långpass (>15km): ${analysisWindow.longRunCount}
- Överlånga pass (>21km): ${analysisWindow.longRunsOver21Count}

FREKVENS OCH VARIATION
- Träningsfrekvens: ${analysisWindow.avgSessionsPerWeek.toFixed(1)} dagar/vecka
- Styrketräning: ${analysisWindow.strengthCount} pass
- Cykling: ${analysisWindow.cyclingCount} pass
- Övrig träning: ${analysisWindow.otherCount} pass
- Dubbelpass (dagar med >=2 pass): ${analysisWindow.doubleDaysCount} dagar

FORMTOPPNING (Tapering)
- Sista veckan volym: ${analysisWindow.lastWeekVol.toFixed(1)} km
- Snitt tidigare veckor: ${analysisWindow.prevWeeksVolAvg.toFixed(1)} km

NYCKELPASS (Topp 3 längsta)
${analysisWindow.top3LongRuns.map((r, i) => `${i + 1}. ${r.distance?.toFixed(1)} km - ${r.title || 'Långpass'} (${r.date.substring(0, 10)})
   Tempo: ${formatPace((r.durationMinutes * 60) / (r.distance || 1))}, Höjd: ${r.elevationGain || 0}m+, Snittpuls: ${(r as any).averageHeartrate || '-'} bpm`).join('\n')}

TÄVLINGAR
${analysisWindow.races.map(r => `- ${r.distance?.toFixed(1)} km - ${r.title || 'Tävling'} (${formatTime((r.durationMinutes || 0) * 60)})
   Tempo: ${formatPace((r.durationMinutes * 60) / (r.distance || 1))}, Höjd: ${r.elevationGain || 0}m+, Snittpuls: ${(r as any).averageHeartrate || '-'} bpm`).join('\n')}

AI EVALUERING (Pros & Cons)
Styrkor:
${analysisWindow.pros.map(p => `+ ${p}`).join('\n')}
Svagheter:
${analysisWindow.cons.map(c => `- ${c}`).join('\n')}
Djuplodande Statistik:
* Längsta träningsstreak: ${analysisWindow.longestStreak} dagar
* Peak Volymvecka: ${analysisWindow.peakVolumeWeek.toFixed(1)} km

ALLA PASS I PERIODEN
${analysisWindow.windowActivities.slice().reverse().map(act => {
            let actStr = `- ${act.date.substring(0, 10)}: ${act.title || 'Aktivitet'} (${act.type})`;
            if (act.distance && act.distance > 0) actStr += ` | ${act.distance.toFixed(1)} km`;
            if (act.durationMinutes) actStr += ` | ${formatTime(act.durationMinutes * 60)}`;
            if (act.distance && act.distance > 0) actStr += ` | ${formatPace((act.durationMinutes * 60) / act.distance)}`;
            if ((act as any).averageHeartrate) actStr += ` | Snittpuls: ${(act as any).averageHeartrate} bpm`;
            return actStr;
        }).join('\n')}
`.trim();
    };

    const handleExportText = () => {
        const text = generateTextSummary();
        const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text.trim());
        const exportFileDefaultName = `pb-analysis-${pbEvent.date.substring(0, 10)}.txt`;

        let linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-7xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-slate-900 border-b border-white/5 p-4 md:p-6 flex justify-between items-start sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)] shrink-0">
                            {pbEvent.isRace ? <Medal size={28} /> : <Zap size={28} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-xl md:text-2xl font-black text-white leading-none">
                                    {pbEvent.bucketLabel} Rekord
                                </h2>
                                <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-800 px-2 py-0.5 rounded">
                                    {pbEvent.date.substring(0, 10)}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span className="text-2xl md:text-3xl font-black text-amber-400 font-mono leading-none">
                                    {pbEvent.durationFormatted}
                                </span>
                                {pbEvent.improvementSeconds && pbEvent.improvementSeconds > 0 && (
                                    <span className="text-xs md:text-sm font-bold text-emerald-400 flex items-center gap-1">
                                        <TrendingDown size={14} />
                                        {formatTime(pbEvent.improvementSeconds)}
                                    </span>
                                )}
                                <span className="text-xs md:text-sm text-slate-500 font-medium">
                                    ({formatPace(pbEvent.durationSeconds / pbEvent.distance)})
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0">
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 custom-scrollbar">

                    {/* Timeframe Toggle */}
                    <div className="flex flex-col items-center">
                        <div className="text-slate-400 text-sm leading-relaxed max-w-2xl bg-slate-800/30 p-4 rounded-2xl border border-white/5 mx-auto text-center hidden md:block mb-4">
                            Denna analys tittar på din löpträning fram till <strong className="text-white">{pbEvent.date.substring(0, 10)}</strong>. Förstå vilka volymer och vanor som låg bakom detta personbästa.
                        </div>
                        <div className="flex items-center bg-slate-900/80 rounded-xl border border-white/5 p-1">
                            {[4, 8, 12, 16].map(weeks => (
                                <button
                                    key={weeks}
                                    onClick={() => setTimeframeWeeks(weeks)}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${timeframeWeeks === weeks
                                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {weeks} veckor
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Column 1: Mängd & Intensitet */}
                        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <TrendingUp size={14} className="text-blue-500" />
                                Mängd & Volym (Snitt {timeframeWeeks}v)
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Snittmängd (Löpning)</div>
                                    <div className="text-2xl font-black text-white">{Math.round(analysisWindow.avgWeeklyVol)} <span className="text-sm font-bold text-slate-500">km/vecka</span></div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Snitt-tempo (Löpning)</div>
                                    <div className="text-2xl font-black text-white">{formatPace(analysisWindow.avgPaceSecPerKm)}</div>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Formtoppning (Mängd sista veckan)</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-xl font-black text-white">{analysisWindow.lastWeekVol.toFixed(1)} <span className="text-sm font-bold text-slate-500">km</span></div>
                                        {analysisWindow.prevWeeksVolAvg > 0 && (
                                            <div className={`text-xs font-bold ${analysisWindow.lastWeekVol < analysisWindow.prevWeeksVolAvg ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {analysisWindow.lastWeekVol < analysisWindow.prevWeeksVolAvg ? '-' : '+'}
                                                {Math.abs((((analysisWindow.lastWeekVol - analysisWindow.prevWeeksVolAvg) / analysisWindow.prevWeeksVolAvg) * 100)).toFixed(0)}% vs snitt
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Passfördelning (Totalt)</div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="bg-white/5 p-2 rounded-lg text-center">
                                            <div className="text-lg font-black text-white">{analysisWindow.distanceCount}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase">Distans</div>
                                        </div>
                                        <div className="bg-blue-500/10 p-2 rounded-lg text-center border border-blue-500/20">
                                            <div className="text-lg font-black text-blue-400">{analysisWindow.qualityCount}</div>
                                            <div className="text-[9px] font-bold text-blue-500/80 uppercase">Kvalité</div>
                                        </div>
                                        <div className="bg-emerald-500/10 p-2 rounded-lg text-center border border-emerald-500/20">
                                            <div className="text-lg font-black text-emerald-400">{analysisWindow.longRunCount}</div>
                                            <div className="text-[9px] font-bold text-emerald-500/80 uppercase">Lång</div>
                                        </div>
                                        <div className="bg-rose-500/5 p-2 rounded-lg text-center border border-rose-500/10">
                                            <div className="text-lg font-black text-rose-400">{analysisWindow.longRunsOver21Count}</div>
                                            <div className="text-[9px] font-bold text-rose-500/80 uppercase">&gt; 21km</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Belastning & Vila */}
                        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-between">
                            <div>
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Mountain size={14} className="text-rose-500" />
                                    Total Belastning ({timeframeWeeks}v)
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Aktiv Träningstid</div>
                                        <div className="text-2xl font-black text-white">{Math.floor(analysisWindow.totalActiveTimeMin / 60)} <span className="text-sm text-slate-500 font-bold">tim</span> {Math.round(analysisWindow.totalActiveTimeMin % 60)} <span className="text-sm text-slate-500 font-bold">min</span></div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Total Höjdstigning</div>
                                        <div className="text-2xl font-black text-rose-400">{Math.round(analysisWindow.totalElevationGain)} <span className="text-sm text-slate-500 font-bold">m+</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5 mt-4">
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Coffee size={14} className="text-amber-500" />
                                    Återhämtning
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="text-2xl font-black text-amber-500">{analysisWindow.restDays}</div>
                                    <div className="text-xs text-slate-500 font-medium leading-tight">vilodagar<br />under {timeframeWeeks}v</div>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Variation & Frekvens */}
                        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <RefreshCw size={14} className="text-indigo-500" />
                                Frekvens & Variation ({timeframeWeeks}v)
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Träningsfrekvens</div>
                                    <div className="text-2xl font-black text-white">{analysisWindow.avgSessionsPerWeek.toFixed(1)} <span className="text-sm font-bold text-slate-500">dagar/v</span></div>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Alternativ Träning</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <div className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Styrka</div>
                                            <div className="text-xl font-black text-amber-500">{analysisWindow.strengthCount}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Cykel</div>
                                            <div className="text-xl font-black text-blue-400">{analysisWindow.cyclingCount}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Annat</div>
                                            <div className="text-xl font-black text-slate-400">{analysisWindow.otherCount}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Dubbelpass</div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-2xl font-black text-white">{analysisWindow.doubleDaysCount}</div>
                                        <div className="text-xs text-slate-500 font-medium leading-tight">dagar med ≥2<br />aktiviteter</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Highlights */}
                    <div className="space-y-4 pt-4">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                            <Star className="text-amber-500" size={20} />
                            Highlights i perioden
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Races */}
                            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col max-h-[300px]">
                                <div className="text-[10px] font-black uppercase text-amber-500 mb-3 flex items-center gap-1 shrink-0"><Medal size={12} /> Tävlingar ({analysisWindow.races.length})</div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    {analysisWindow.races.length > 0 ? (
                                        <div className="space-y-3">
                                            {analysisWindow.races.map(r => (
                                                <div key={r.id} className="flex justify-between items-center bg-white/5 rounded-lg p-2.5">
                                                    <div className="overflow-hidden mr-2">
                                                        <div className="text-sm font-bold text-white truncate">{r.title || 'Tävling'}</div>
                                                        <div className="text-[10px] text-slate-400">{r.date.substring(0, 10)}</div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-sm font-black text-amber-400">{r.distance?.toFixed(1)} km</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                            {formatTime((r.durationMinutes || 0) * 60)} • {formatPace(((r.durationMinutes || 0) * 60) / (r.distance || 1))}
                                                            {(r as any).averageHeartrate ? ` • ${(r as any).averageHeartrate} bpm` : ''}
                                                            {r.elevationGain ? ` • ${r.elevationGain}m+` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-500 italic py-2">Inga tävlingar i denna period.</div>
                                    )}
                                </div>
                            </div>

                            {/* Key Sessions */}
                            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col justify-start max-h-[300px] overflow-y-auto custom-scrollbar">
                                <div className="text-[10px] font-black uppercase text-emerald-500 mb-3 flex items-center gap-1"><Activity size={12} /> Topp 3 Långpass</div>
                                <div className="space-y-3 mb-4">
                                    {analysisWindow.top3LongRuns.length > 0 ? (
                                        analysisWindow.top3LongRuns.map((run, i) => (
                                            <div key={run.id} className="flex justify-between items-center bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/20">
                                                <div className="overflow-hidden mr-2">
                                                    <div className="text-[9px] font-black uppercase text-emerald-500">#{i + 1} Längsta</div>
                                                    <div className="text-sm font-bold text-white truncate" title={run.title}>{run.title || 'Långpass'}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-black text-emerald-400">{run.distance?.toFixed(1)} km</div>
                                                    <div className="text-[10px] text-slate-500 font-mono" title={run.date}>
                                                        {formatTime((run.durationMinutes || 0) * 60)} • {formatPace(((run.durationMinutes || 0) * 60) / (run.distance || 1))}
                                                        {(run as any).averageHeartrate ? ` • ${(run as any).averageHeartrate} bpm` : ''}
                                                        {run.elevationGain ? ` • ${run.elevationGain}m+` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-xs text-slate-500 italic py-2">Inga långpass registrerade.</div>
                                    )}
                                </div>

                                <div className="text-[10px] font-black uppercase text-blue-500 mb-3 flex items-center gap-1"><Zap size={12} /> Snabbaste Passet (Exkl. Längsta)</div>
                                {analysisWindow.fastestRun ? (
                                    <div className="flex justify-between items-center bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/20 mb-2">
                                        <div className="overflow-hidden mr-2">
                                            <div className="text-[9px] font-black uppercase text-blue-500">Snabbaste (&gt;3km)</div>
                                            <div className="text-sm font-bold text-white truncate" title={analysisWindow.fastestRun.title}>{analysisWindow.fastestRun.title || 'Tempo'}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-black text-blue-400">{formatPace((analysisWindow.fastestRun.durationMinutes * 60) / (analysisWindow.fastestRun.distance || 1))}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">
                                                {analysisWindow.fastestRun.distance?.toFixed(1)} km
                                                {(analysisWindow.fastestRun as any).averageHeartrate ? ` • ${(analysisWindow.fastestRun as any).averageHeartrate} bpm` : ''}
                                                {analysisWindow.fastestRun.elevationGain ? ` • ${analysisWindow.fastestRun.elevationGain}m+` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic py-2">Inga pass uppfyllde kriterierna.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis / Deep Metrics */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                            <Sparkles className="text-indigo-400" size={20} />
                            Genomsyrad AI-Analys
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Pros */}
                            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col">
                                <div className="text-[10px] font-black uppercase text-emerald-500 mb-3">Styrkor i Perioden</div>
                                <div className="space-y-2">
                                    {analysisWindow.pros.length > 0 ? analysisWindow.pros.map((pro, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                            <span className="text-emerald-500 font-bold mt-0.5">+</span>
                                            <span className="leading-snug">{pro}</span>
                                        </div>
                                    )) : <div className="text-xs text-slate-500 italic">Analysen hittade inga tydliga styrkor.</div>}
                                </div>
                            </div>
                            {/* Cons */}
                            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col">
                                <div className="text-[10px] font-black uppercase text-rose-500 mb-3">Svagheter / Risker</div>
                                <div className="space-y-2">
                                    {analysisWindow.cons.length > 0 ? analysisWindow.cons.map((con, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                            <span className="text-rose-500 font-bold mt-0.5">-</span>
                                            <span className="leading-snug">{con}</span>
                                        </div>
                                    )) : <div className="text-xs text-slate-500 italic">Analysen hittade inga tydliga svagheter.</div>}
                                </div>
                            </div>
                            {/* Deep Metrics */}
                            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col gap-4">
                                <div className="text-[10px] font-black uppercase text-indigo-400 mb-1">Djuplodande Statistik</div>
                                <div>
                                    <div className="text-xs text-slate-500 mb-1">Längsta Träningsstreak</div>
                                    <div className="text-xl font-black text-white">{analysisWindow.longestStreak} <span className="text-sm font-medium text-slate-500">dagar i sträck</span></div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 mb-1">Peak Volymvecka</div>
                                    <div className="text-xl font-black text-indigo-400">{analysisWindow.peakVolumeWeek.toFixed(1)} <span className="text-sm font-medium text-slate-500">km</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className={`grid grid-cols-1 ${analysisWindow.hasHealthData ? 'lg:grid-cols-2' : ''} gap-4`}>
                        {/* Chart: Volume Build-up */}
                        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl h-80 flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500" /> Volymuppbyggnad (Löpning KM)</div>
                                <span className="text-emerald-500">Vecka -{timeframeWeeks} &rarr; PB</span>
                            </h3>
                            <div className="flex-1 w-full min-h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analysisWindow.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="week"
                                            stroke="#475569"
                                            fontSize={10}
                                            tickFormatter={(val) => val.replace('Vecka ', 'V')}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            stroke="#475569"
                                            fontSize={10}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                                            labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}
                                            itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                            formatter={(value: number) => [`${value} km`, 'Volym']}
                                        />
                                        <Area type="monotone" dataKey="vol" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Chart: Health Curve (Weight + Kcal) */}
                        {analysisWindow.hasHealthData && (
                            <div className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl h-80 flex flex-col">
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2"><Scale size={14} className="text-rose-500" /> Hälsokurva (Snitt-kcal & Vikt)</div>
                                    <div className="flex items-center gap-3 text-[9px] font-bold">
                                        <span className="flex items-center gap-1 text-slate-400"><div className="w-2 h-2 bg-slate-700 rounded-full"></div> Kcal</span>
                                        <span className="flex items-center gap-1 text-rose-400"><div className="w-2 h-2 bg-rose-500 rounded-full"></div> Vikt</span>
                                    </div>
                                </h3>
                                <div className="flex-1 w-full min-h-[150px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={analysisWindow.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                            <XAxis
                                                dataKey="week"
                                                stroke="#475569"
                                                fontSize={10}
                                                tickFormatter={(val) => val.replace('Vecka ', 'V')}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis
                                                yAxisId="kcal"
                                                stroke="#475569"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                orientation="left"
                                            />
                                            <YAxis
                                                yAxisId="weight"
                                                stroke="#fb7185"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                orientation="right"
                                                domain={['dataMin - 1', 'dataMax + 1']}
                                                hide // Hide right axis to save space, tooltip handles reading
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                                                labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}
                                                formatter={(value: number, name: string) => {
                                                    if (name === 'kcal') return [`${value} kcal/dag`, 'Kalorier'];
                                                    if (name === 'weight') return [`${value} kg`, 'Vikt (Snitt)'];
                                                    if (name === 'strength') return [`${value} st`, 'Styrkepass'];
                                                    return [value, name];
                                                }}
                                            />
                                            {/* Kcal Bar */}
                                            <Bar yAxisId="kcal" dataKey="kcal" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                            {/* Weight Line */}
                                            <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#fb7185" strokeWidth={3} dot={{ r: 3, fill: '#fb7185', strokeWidth: 0 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Activity List */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                            <CalendarDays className="text-indigo-500" size={20} />
                            Alla Aktiviteter Inför
                        </h3>
                        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col">
                            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {analysisWindow.windowActivities.slice().reverse().map(act => (
                                    <div key={act.id} className="flex justify-between items-center bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-white/10 text-slate-400">
                                                {act.type.toLowerCase().includes('run') || act.type.toLowerCase().includes('löpning') ? <Flame size={16} className="text-amber-500" /> :
                                                    act.type.toLowerCase().includes('strength') || act.type.toLowerCase().includes('styrka') ? <Dumbbell size={16} className="text-blue-500" /> :
                                                        act.type.toLowerCase().includes('cycle') || act.type.toLowerCase().includes('cykel') || act.type.toLowerCase() === 'virtualride' || act.type.toLowerCase() === 'ride' ? <Activity size={16} className="text-emerald-500" /> :
                                                            <Activity size={16} />}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="text-sm font-bold text-white truncate max-w-[200px] md:max-w-xs">{act.title || 'Aktivitet'}</div>
                                                <div className="text-[10px] text-slate-400">{act.date.substring(0, 10)} {act.date.substring(11, 16)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-4 text-right shrink-0">
                                            {act.distance && act.distance > 0 ? (
                                                <div>
                                                    <div className="text-sm font-black text-white">{act.distance.toFixed(1)} km</div>
                                                    <div className="text-[10px] text-slate-500">{formatPace((act.durationMinutes * 60) / act.distance)}</div>
                                                </div>
                                            ) : null}
                                            <div>
                                                <div className="text-sm font-black text-slate-300">{formatTime((act.durationMinutes || 0) * 60)}</div>
                                                {(act as any).averageHeartrate ? (
                                                    <div className="text-[10px] text-rose-400 font-bold">{(act as any).averageHeartrate} bpm</div>
                                                ) : <div className="text-[10px] text-slate-600">-</div>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer / Export */}
                <div className="bg-slate-900 border-t border-white/5 p-4 flex justify-end gap-3 rounded-b-3xl flex-wrap">
                    <button
                        onClick={() => navigator.clipboard.writeText(generateTextSummary())}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
                    >
                        <Copy size={14} /> Kopiera till urklipp
                    </button>
                    <button
                        onClick={handleExportJSON}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
                    >
                        <Download size={14} /> Exportera som JSON
                    </button>
                    <button
                        onClick={handleExportText}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold rounded-lg transition-colors border border-amber-500/20"
                    >
                        <FileText size={14} /> Exportera Sammanfattning
                    </button>
                </div>
            </div>
        </div>
    );
}
