import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { UniversalActivity, StrengthSession } from '../../models/types.ts';
import { calculateEstimated1RM } from '../../utils/strengthCalculators.ts';
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
    Award
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
    squat: number;
    bench: number;
    deadlift: number;
    ohp: number;
    total: number;
    bwRatio: number;
    level: string;
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
    const { universalActivities, strengthSessions, getLatestWeight } = useData();
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
            const d1 = new Date(allActivities[i-1].date);
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
        const bests = { squat: 0, bench: 0, deadlift: 0, ohp: 0 };
        const bw = getLatestWeight() || 80; // Fallback to 80kg

        strengthSessions.forEach((s: StrengthSession) => {
            s.exercises.forEach(e => {
                const name = e.exerciseName.toLowerCase();
                let type: keyof typeof bests | null = null;

                if (name.includes('knäböj') || name.includes('squat')) type = 'squat';
                else if (name.includes('bänk') || name.includes('bench')) type = 'bench';
                else if (name.includes('marklyft') || name.includes('deadlift')) type = 'deadlift';
                else if (name.includes('militär') || name.includes('overhead') || name.includes('ohp')) type = 'ohp';

                if (type) {
                    e.sets.forEach(set => {
                        if (set.weight && set.reps) {
                            const e1rm = calculateEstimated1RM(set.weight, set.reps);
                            if (e1rm > bests[type!]) bests[type!] = e1rm;
                        }
                    });
                }
            });
        });

        const total = bests.squat + bests.bench + bests.deadlift;
        const ratio = total / bw;

        // Simple Level Logic
        let level = 'Nybörjare';
        if (ratio > 2.5) level = 'Motionär';
        if (ratio > 3.5) level = 'Atlet';
        if (ratio > 4.5) level = 'Avancerad';
        if (ratio > 5.5) level = 'Elit';

        return { ...bests, total, bwRatio: ratio, level };
    }, [strengthSessions, getLatestWeight]);

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
                longest_break_days: stats.longestGapDays
            },
            athlete_type: {
                cardio_hours: Math.round(stats.cardioMinutes / 60),
                strength_hours: Math.round(stats.strengthMinutes / 60),
                classification: stats.hybridRatio > 0.7 ? "Runner/Endurance" : stats.hybridRatio < 0.3 ? "Lifter/Strength" : "Hybrid Athlete"
            },
            strength_performance: {
                squat_1rm: Math.round(strengthProfile.squat),
                bench_1rm: Math.round(strengthProfile.bench),
                deadlift_1rm: Math.round(strengthProfile.deadlift),
                ohp_1rm: Math.round(strengthProfile.ohp),
                total: Math.round(strengthProfile.total),
                relative_strength: strengthProfile.bwRatio.toFixed(2),
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
                                <span>Styrka ({Math.round(stats.strengthMinutes/60)}h)</span>
                                <span>Cardio ({Math.round(stats.cardioMinutes/60)}h)</span>
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
                        <StrengthCard label="Knäböj" value={Math.round(strengthProfile.squat)} />
                        <StrengthCard label="Bänkpress" value={Math.round(strengthProfile.bench)} />
                        <StrengthCard label="Marklyft" value={Math.round(strengthProfile.deadlift)} />
                        <StrengthCard label="Militärpress" value={Math.round(strengthProfile.ohp)} />
                    </div>

                    <div className="p-6 bg-slate-950 rounded-2xl border border-white/5 text-center">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Total (SBD)</div>
                        <div className="text-4xl font-black text-white mb-1">{Math.round(strengthProfile.total)} kg</div>
                        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mt-2">
                            <Award className="w-3 h-3" />
                            Nivå: {strengthProfile.level} ({strengthProfile.bwRatio.toFixed(1)}x BW)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, icon }: { label: string, value: string, sub: string, icon: React.ReactNode }) {
    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center hover:border-white/10 transition-colors">
            <div className="mb-4 p-3 bg-slate-950 rounded-xl border border-white/5">
                {icon}
            </div>
            <div className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight">
                {value}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {label}
            </div>
            <div className="text-[10px] text-slate-600 font-medium">
                {sub}
            </div>
        </div>
    );
}

function StrengthCard({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-bold uppercase">{label}</span>
            <span className="text-xl font-bold text-white mt-1">{value} <span className="text-xs text-slate-600 font-normal">kg</span></span>
        </div>
    );
}
