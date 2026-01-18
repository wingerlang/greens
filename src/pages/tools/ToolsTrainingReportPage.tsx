import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { UniversalActivity, StrengthSession } from '../../models/types.ts';
import {
    calculateEstimated1RM,
    calculateIPFPoints
} from '../../utils/strengthCalculators.ts';
import {
    MATCH_PATTERNS,
    EXCLUDE_PATTERNS,
    MIN_WEIGHT_THRESHOLD,
    normalizeStrengthName
} from '../../utils/strengthConstants.ts';
import {
    getBestSetForPatterns,
    SourceInfo
} from '../../utils/strengthAnalysis.ts';
import {
    detectRunningPBs,
    formatTime,
    isCompetition
} from '../../utils/activityUtils.ts';
import { slugify } from '../../utils/formatters.ts';
import { Link } from 'react-router-dom';
import {
    Activity,
    Calendar,
    TrendingUp,
    Dumbbell,
    Heart,
    Brain,
    Copy,
    Check,
    ChevronDown,
    ChevronUp,
    Zap,
    Award,
    Trophy,
    ExternalLink
} from 'lucide-react';

// --- Types & Interfaces ---

interface TrainingStats {
    firstDate: Date | null;
    lastDate: Date | null;
    totalSessions: number;
    activeWeeks: number;
    totalWeeks: number;
    consistencyScore: number; // 0-100
    activeYears: number; // Based on active weeks
    calendarYears: number;
    gapYears: number; // Time lost to gaps
    longestGapDays: number;
    cardioMinutes: number;
    strengthMinutes: number;
    hybridRatio: number; // 0 (Pure Strength) to 1 (Pure Cardio)
}

interface StrengthProfile {
    squat: { val: number; erm: number; source?: SourceInfo };
    bench: { val: number; erm: number; source?: SourceInfo };
    deadlift: { val: number; erm: number; source?: SourceInfo };
    ohp: { val: number; erm: number; source?: SourceInfo };
    swings: { val: number; erm: number; source?: SourceInfo };
    biceps: { val: number; erm: number; source?: SourceInfo };
    total: number;
    bwRatio: number;
    level: string;
    ipfPoints: number;
}

interface RunningProfile {
    best5k: { time: string; date: string; id?: string };
    best10k: { time: string; date: string; id?: string };
    bestHalf: { time: string; date: string; id?: string };
    bestFull: { time: string; date: string; id?: string };
    longestRun: { dist: number; time: string; date: string; id?: string };
    competitions: number;
}

// --- Helpers ---

const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const GAP_THRESHOLD_DAYS = 28; // 4 weeks

function getISOWeek(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekKey(date: Date) {
    return `${date.getFullYear()}-W${getISOWeek(date)}`;
}

// --- Component ---

export function ToolsTrainingReportPage() {
    const { universalActivities, strengthSessions, getLatestWeight, userSettings } = useData();
    const [promptCopied, setPromptCopied] = useState(false);
    const [isPromptOpen, setIsPromptOpen] = useState(false);

    // 1. Process Timeline & Consistency
    const stats: TrainingStats = useMemo(() => {
        const allActivities = [...universalActivities].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        if (allActivities.length === 0) {
            return {
                firstDate: null, lastDate: null, totalSessions: 0,
                activeWeeks: 0, totalWeeks: 0, consistencyScore: 0,
                activeYears: 0, calendarYears: 0, gapYears: 0, longestGapDays: 0,
                cardioMinutes: 0, strengthMinutes: 0, hybridRatio: 0.5
            };
        }

        const first = new Date(allActivities[0].date);
        const last = new Date(allActivities[allActivities.length - 1].date);
        const totalWeeks = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / ONE_WEEK_MS));

        // Weekly Counts
        const weeks: Record<string, number> = {};
        let cardioMins = 0;
        let strengthMins = 0;

        allActivities.forEach(a => {
            const d = new Date(a.date);
            const k = getWeekKey(d);
            weeks[k] = (weeks[k] || 0) + 1;

            const type = a.performance?.activityType || 'other';
            const dur = a.performance?.durationMinutes || 0;

            if (['running', 'cycling', 'swimming', 'cardio'].includes(type)) {
                cardioMins += dur;
            } else if (['strength', 'weightlifting'].includes(type)) {
                strengthMins += dur;
            } else {
                // Default split if unknown
                strengthMins += dur / 2;
                cardioMins += dur / 2;
            }
        });

        // Active Weeks (>= 2 sessions)
        let activeWeeksCount = 0;
        Object.values(weeks).forEach(count => {
            if (count >= 2) activeWeeksCount++;
        });

        // Gap Analysis
        let maxGap = 0;
        for (let i = 1; i < allActivities.length; i++) {
            const d1 = new Date(allActivities[i - 1].date);
            const d2 = new Date(allActivities[i].date);
            const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24);
            if (diffDays > maxGap) maxGap = diffDays;
        }

        const activeYears = (activeWeeksCount * 7) / 365.25;
        const calendarYears = (last.getTime() - first.getTime()) / (1000 * 3600 * 24 * 365.25);
        const totalMins = cardioMins + strengthMins;

        return {
            firstDate: first,
            lastDate: last,
            totalSessions: allActivities.length,
            activeWeeks: activeWeeksCount,
            totalWeeks,
            consistencyScore: Math.round((activeWeeksCount / totalWeeks) * 100),
            activeYears,
            calendarYears,
            gapYears: Math.max(0, calendarYears - activeYears),
            longestGapDays: Math.round(maxGap),
            cardioMinutes: cardioMins,
            strengthMinutes: strengthMins,
            hybridRatio: totalMins > 0 ? cardioMins / totalMins : 0.5
        };
    }, [universalActivities]);

    // 2. Process Strength Profile
    const strengthProfile: StrengthProfile = useMemo(() => {
        const squat = getBestSetForPatterns(strengthSessions, MATCH_PATTERNS.squat, EXCLUDE_PATTERNS.squat);
        const bench = getBestSetForPatterns(strengthSessions, MATCH_PATTERNS.bench, EXCLUDE_PATTERNS.bench);
        const deadlift = getBestSetForPatterns(strengthSessions, MATCH_PATTERNS.deadlift, EXCLUDE_PATTERNS.deadlift);
        const ohp = getBestSetForPatterns(strengthSessions, MATCH_PATTERNS.ohp, EXCLUDE_PATTERNS.ohp);
        const swings = getBestSetForPatterns(strengthSessions, MATCH_PATTERNS.swings);
        const biceps = getBestSetForPatterns(strengthSessions, MATCH_PATTERNS.biceps);

        const bw = getLatestWeight() || 80;
        const total = Math.round(squat.maxEstimated1RM + bench.maxEstimated1RM + deadlift.maxEstimated1RM);
        const ratio = total / bw;
        const ipfPoints = calculateIPFPoints(bw, total, (userSettings as any)?.gender || 'male');

        let level = 'Nybörjare';
        if (ratio > 2.5) level = 'Motionär';
        if (ratio > 3.5) level = 'Atlet';
        if (ratio > 4.5) level = 'Avancerad';
        if (ratio > 5.5) level = 'Elit';

        return {
            squat: { val: squat.maxWeight, erm: squat.maxEstimated1RM, source: squat.heaviestSet || undefined },
            bench: { val: bench.maxWeight, erm: bench.maxEstimated1RM, source: bench.heaviestSet || undefined },
            deadlift: { val: deadlift.maxWeight, erm: deadlift.maxEstimated1RM, source: deadlift.heaviestSet || undefined },
            ohp: { val: ohp.maxWeight, erm: ohp.maxEstimated1RM, source: ohp.heaviestSet || undefined },
            swings: { val: swings.maxWeight, erm: swings.maxEstimated1RM, source: swings.heaviestSet || undefined },
            biceps: { val: biceps.maxWeight, erm: biceps.maxEstimated1RM, source: biceps.heaviestSet || undefined },
            total,
            bwRatio: ratio,
            level,
            ipfPoints
        };
    }, [strengthSessions, getLatestWeight, userSettings]);

    // 2.2 Process Running Profile
    const runningProfile: RunningProfile = useMemo(() => {
        return detectRunningPBs(universalActivities);
    }, [universalActivities]);

    // 3. Generate AI Prompt
    const generateAiPrompt = () => {
        const data = {
            meta: {
                reportDate: new Date().toISOString().split('T')[0],
                unit: "metric",
            },
            training_history: {
                start_date: stats.firstDate?.toISOString().split('T')[0],
                total_sessions: stats.totalSessions,
                active_years: stats.activeYears.toFixed(2),
                calendar_years: stats.calendarYears.toFixed(2),
                consistency_score: `${stats.consistencyScore}%`,
                active_weeks: stats.activeWeeks,
                longest_break_days: stats.longestGapDays,
                competitions: runningProfile.competitions
            },
            athlete_type: {
                cardio_hours: Math.round(stats.cardioMinutes / 60),
                strength_hours: Math.round(stats.strengthMinutes / 60),
                classification: stats.hybridRatio > 0.7 ? "Runner/Endurance" : stats.hybridRatio < 0.3 ? "Lifter/Strength" : "Hybrid Athlete"
            },
            running_performance: {
                best_5k: runningProfile.best5k.time,
                best_10k: runningProfile.best10k.time,
                best_half_marathon: runningProfile.bestHalf.time,
                longest_run_km: runningProfile.longestRun.dist.toFixed(1)
            },
            strength_performance: {
                squat: { heaviest_weight: Math.round(strengthProfile.squat.val), estimated_1rm: Math.round(strengthProfile.squat.erm) },
                bench: { heaviest_weight: Math.round(strengthProfile.bench.val), estimated_1rm: Math.round(strengthProfile.bench.erm) },
                deadlift: { heaviest_weight: Math.round(strengthProfile.deadlift.val), estimated_1rm: Math.round(strengthProfile.deadlift.erm) },
                ohp_erm: Math.round(strengthProfile.ohp.erm),
                kettlebell_swings_erm: Math.round(strengthProfile.swings.erm),
                bicep_curl_erm: Math.round(strengthProfile.biceps.erm),
                total_sbd_erm: Math.round(strengthProfile.total),
                relative_strength: strengthProfile.bwRatio.toFixed(2),
                ipf_points: strengthProfile.ipfPoints.toFixed(1),
                level: strengthProfile.level
            }
        };

        return `
Agera som en elittränare och fysiolog. Här är min träningsdata. Analysera min historik, identifiera svagheter och ge mig råd framåt.

DATA:
${JSON.stringify(data, null, 2)}

UPPGIFT:
1. Sammanfatta min "Träningsålder" vs verklig tid. Har jag varit konsekvent?
2. Analysera min styrkeprofil. Är jag balanserad? Vad laggar (Squat/Bench/Deadlift)?
3. Bedöm min "Hybrid-status". Tränar jag för mycket/lite av något?
4. Ge mig 3 konkreta fokusområden för nästa 12 veckor.
5. Ge mig en "Hård Sanning" om min träning baserat på datan.

Svara på Svenska. Håll det koncist, motiverande men ärligt.
`.trim();
    };

    const copyPrompt = () => {
        navigator.clipboard.writeText(generateAiPrompt());
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 2000);
    };

    if (!stats.firstDate) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-700">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-500/20">
                        <Brain className="w-3 h-3" />
                        Deep Analysis
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                        Ditt Tränings-DNA
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Ingen träningsdata hittades. Logga dina första pass för att låsa upp din analys.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-500/20">
                    <Brain className="w-3 h-3" />
                    Deep Analysis
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    Ditt Tränings-DNA
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    En djupdykning i din träningshistorik. Vi analyserar inte bara vad du gjort, utan vad det betyder.
                    Exportera datan till AI för personlig coaching.
                </p>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                <StatCard
                    label="Träningsålder"
                    value={`${stats.activeYears.toFixed(1)} År`}
                    sub={`${stats.calendarYears.toFixed(1)} kalenderår`}
                    icon={<Calendar className="w-5 h-5 text-indigo-400" />}
                />
                <StatCard
                    label="Antal Pass"
                    value={stats.totalSessions.toString()}
                    sub="Totalt registrerade"
                    icon={<Activity className="w-5 h-5 text-emerald-400" />}
                />
                <StatCard
                    label="Konsistens"
                    value={`${stats.consistencyScore}%`}
                    sub={`${stats.activeWeeks} aktiva veckor`}
                    icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
                />
                <StatCard
                    label="Längsta Uppehåll"
                    value={`${stats.longestGapDays} Dagar`}
                    sub="Borträknat från ålder"
                    icon={<Zap className="w-5 h-5 text-amber-400" />}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-2 gap-8">

                {/* Left: Athlete Profile */}
                <div className="space-y-8">
                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-pink-500/10 rounded-xl border border-pink-500/20">
                                <Heart className="w-5 h-5 text-pink-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Atletprofil</h2>
                        </div>

                        {/* Hybrid Bar */}
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm font-bold text-slate-400">
                                <span>Styrka ({Math.round(stats.strengthMinutes / 60)}h)</span>
                                <span>Cardio ({Math.round(stats.cardioMinutes / 60)}h)</span>
                            </div>
                            <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                    style={{ width: `${(1 - stats.hybridRatio) * 100}%` }}
                                />
                                <div
                                    className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                                    style={{ width: `${stats.hybridRatio * 100}%` }}
                                />
                            </div>
                            <div className="text-center pt-2">
                                <span className="text-xl font-bold text-white">
                                    {stats.hybridRatio > 0.7 ? "Uthållighetsatlet" : stats.hybridRatio < 0.3 ? "Styrkelyftare" : "Hybridatlet"}
                                </span>
                                <p className="text-xs text-slate-500 mt-1">
                                    Baserat på tidsfördelning av all träning
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* AI Prompt Section */}
                    <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-3xl p-8 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                                    <Brain className="w-5 h-5 text-indigo-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">AI Coach Analys</h2>
                                    <p className="text-xs text-indigo-300">Generera rapport för ChatGPT/Claude</p>
                                </div>
                            </div>
                            <button
                                onClick={copyPrompt}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
                            >
                                {promptCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {promptCopied ? "Kopierad!" : "Kopiera Prompt"}
                            </button>
                        </div>

                        <div className="relative z-10">
                            <button
                                onClick={() => setIsPromptOpen(!isPromptOpen)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/50 rounded-xl text-xs text-slate-400 font-mono border border-white/5 hover:bg-slate-950/80 transition-colors"
                            >
                                <span>Visa genererad data...</span>
                                {isPromptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {isPromptOpen && (
                                <textarea
                                    readOnly
                                    value={generateAiPrompt()}
                                    className="w-full h-64 mt-2 bg-slate-950/80 text-indigo-200/80 p-4 rounded-xl text-xs font-mono border border-white/5 focus:outline-none resize-none custom-scrollbar"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Strength Stats */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 h-fit">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <Dumbbell className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Styrkeprofil</h2>
                            <p className="text-xs text-slate-500">Baserat på dina bästa e1RM</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <StrengthCard label="Knäböj" data={strengthProfile.squat} />
                        <StrengthCard label="Bänkpress" data={strengthProfile.bench} />
                        <StrengthCard label="Marklyft" data={strengthProfile.deadlift} />
                        <StrengthCard label="Militärpress" data={strengthProfile.ohp} />
                    </div>

                    <div className="p-6 bg-slate-950 rounded-2xl border border-white/5 mb-8">
                        <div className="text-center mb-6">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total (SBD)</div>
                            <div className="text-5xl font-black text-white mb-2">{strengthProfile.total} <span className="text-lg text-slate-600">kg</span></div>
                            <div className="flex flex-col gap-2 items-center">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/20">
                                    <Award className="w-3 h-3" />
                                    Nivå: {strengthProfile.level} ({strengthProfile.bwRatio.toFixed(1)}x BW)
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                                    {strengthProfile.ipfPoints.toFixed(1)} IPF GL Points
                                </div>
                            </div>
                        </div>

                        {/* SBD Breakdown - Similar to Matchup Page */}
                        <div className="space-y-3 pt-6 border-t border-white/5">
                            {[
                                { label: 'Knäböj', data: strengthProfile.squat },
                                { label: 'Bänkpress', data: strengthProfile.bench },
                                { label: 'Marklyft', data: strengthProfile.deadlift }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{item.label}</span>
                                        <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                                            {item.data.source?.exerciseName || '-'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-sm font-black text-white">{Math.round(item.data.val > 0 ? item.data.val : item.data.erm)}</span>
                                            <span className="text-[10px] text-slate-600">kg</span>
                                        </div>
                                        <div className="text-[9px] font-mono text-slate-500">
                                            {item.data.val > 0 ? 'Faktisk' : 'e1RM'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Running Stats & Other Exercises */}
                <div className="flex flex-col gap-8">
                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <Trophy className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Löparprofil</h2>
                                <p className="text-xs text-slate-500">Dina snabbaste tider och uthållighet</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <RunningCard label="5 KM" data={runningProfile.best5k} />
                            <RunningCard label="10 KM" data={runningProfile.best10k} />
                            <RunningCard label="Halvmaraton" data={runningProfile.bestHalf} />
                            <RunningCard label="Maraton" data={runningProfile.bestFull} />
                            <RunningCard label="Längsta" value={`${runningProfile.longestRun.dist.toFixed(1)}km`} sub={runningProfile.longestRun.time} date={runningProfile.longestRun.date} />
                        </div>

                        <div className="p-6 bg-slate-950 rounded-2xl border border-white/5 text-center">
                            <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Tävlingar</div>
                            <div className="text-4xl font-black text-white mb-1">{runningProfile.competitions} st</div>
                            <div className="text-[10px] text-slate-500 mt-2">
                                Baserat på ord som "tävling" eller "lopp" i titeln
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                <Dumbbell className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Andra Övningar</h2>
                                <p className="text-xs text-slate-500">Kettlebell, Biceps och mer</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <StrengthCard label="KB Swings" data={strengthProfile.swings} />
                            <StrengthCard label="Bicepscurl" data={strengthProfile.biceps} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, icon }: { label: string, value: string, sub: string, icon: React.ReactNode }) {
    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center hover:border-white/10 transition-colors shadow-sm">
            <div className="mb-4 p-3 bg-slate-950 rounded-xl border border-white/5">
                {icon}
            </div>
            <div className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight">
                {value}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {label}
            </div>
            <div className="text-[10px] text-slate-600 font-medium leading-tight">
                {sub}
            </div>
        </div>
    );
}

function StrengthCard({ label, data }: { label: string, data: { val: number, erm: number, source?: SourceInfo } }) {
    const diff = data.erm - data.val;
    const hasSource = !!data.source;
    // Show Actual Weight (val) if > 0, otherwise show e1RM
    const displayVal = data.val > 0 ? data.val : data.erm;

    return (
        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col gap-2 group hover:border-emerald-500/30 transition-colors">
            <div className="flex justify-between items-start">
                <span className="text-xs text-slate-500 font-bold uppercase">{label}</span>
                {hasSource && (
                    <div className="flex gap-1">
                        {data.val > 0 ? (
                            <div className="text-[9px] bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded font-mono">FAKTISK</div>
                        ) : (
                            <div className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1 py-0.5 rounded font-mono">e1RM</div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{Math.round(displayVal)} <span className="text-xs text-slate-600 font-normal">kg</span></span>
                {diff > 0.5 && data.val > 0 && (
                    <span className="text-[10px] text-amber-500 font-bold">-{Math.round(diff)}kg mot e1RM</span>
                )}
            </div>
            {data.source && (
                <div className="text-[9px] text-slate-600 font-mono leading-tight mt-1 pt-2 border-t border-white/5">
                    <div>{data.source.exerciseName}</div>
                    <div className="flex justify-between mt-0.5">
                        <span>{data.source.weight}kg x {data.source.reps}</span>
                        <span>{data.source.date}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function RunningCard({ label, data, value, sub, date }: { label: string, data?: { time: string, date: string, id?: string }, value?: string, sub?: string, date?: string }) {
    const displayValue = value || data?.time || '-';
    const displaySub = sub || (data?.time === '-' ? '' : 'PB-Tid');
    const displayDate = date || data?.date || '';

    return (
        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col gap-2 group hover:border-blue-500/30 transition-colors">
            <div className="flex justify-between items-start">
                <span className="text-xs text-slate-500 font-bold uppercase">{label}</span>
                <Trophy className="w-3 h-3 text-blue-500/30 group-hover:text-blue-500 transition-colors" />
            </div>
            <div>
                <div className="text-2xl font-black text-white">{displayValue}</div>
                <div className="text-[10px] text-blue-400 font-bold uppercase">{displaySub}</div>
            </div>
            {displayDate && displayDate !== '-' && (
                <div className="text-[9px] text-slate-600 font-mono mt-1 pt-2 border-t border-white/5">
                    Förevigat {displayDate}
                </div>
            )}
        </div>
    );
}
