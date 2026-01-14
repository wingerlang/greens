import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import {
    analyzeInterference,
    classifyActivity,
    formatDuration,
    SignalCategory,
    ConflictWarning
} from '../../utils/interferenceEngine.ts';
import {
    getISODate,
    WEEKDAYS
} from '../../models/types.ts';
import {
    AlertTriangle,
    Info,
    Dumbbell,
    Activity,
    Zap,
    Clock,
    Calendar,
    ArrowRight,
    CheckCircle2,
    BookOpen,
    TrendingUp,
    Timer,
    Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SignalTimelineChart } from '../../components/tools/SignalTimelineChart.tsx';

export function ToolsInterferencePage() {
    const { unifiedActivities, plannedActivities } = useData();

    // 1. Combine and Filter Data
    const { timelineData, warnings, todayChart, patternAnalysis } = useMemo(() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 7);

        const end = new Date(today);
        end.setDate(today.getDate() + 14);

        const startStr = getISODate(start);
        const endStr = getISODate(end);
        const todayStr = getISODate();

        // Filter History
        const history = unifiedActivities.filter(a => a.date >= startStr && a.date <= endStr).map(a => ({
            ...a,
            _source: 'HISTORY' as const,
            _id: a.id
        }));

        // Filter Plan
        const plan = plannedActivities
            .filter(a => a.date >= startStr && a.date <= endStr && a.status === 'PLANNED')
            .map(a => ({
                ...a,
                _source: 'PLAN' as const,
                _id: a.id
            }));

        // Merge
        const all = [...history, ...plan];

        // Run Analysis
        const warnings = analyzeInterference(all);

        // Group by Day for Rendering
        const grouped: Record<string, { date: string, activities: any[], warning?: ConflictWarning }> = {};

        // Initialize days
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const iso = getISODate(d);
            grouped[iso] = { date: iso, activities: [], warning: undefined };
        }

        all.forEach(act => {
            const d = act.date;
            if (grouped[d]) {
                grouped[d].activities.push(act);
            }
        });

        // Attach warnings
        warnings.forEach(w => {
            if (grouped[w.date]) {
                grouped[w.date].warning = w;
            }
        });

        // Today's chart data - use actual startTime if available
        const todayActivities = grouped[todayStr]?.activities || [];
        const todayChart = todayActivities.map(act => {
            // Parse startTime (HH:MM format) to hour number
            let timeHour = 12; // Default to noon
            if (act.startTime) {
                const [h] = act.startTime.split(':').map(Number);
                if (!isNaN(h)) timeHour = h;
            }
            return {
                time: timeHour,
                label: act.title || act.type || 'Aktivitet',
                signal: classifyActivity(act),
                source: act._source
            };
        });

        // Pattern Analysis
        const patternAnalysis = analyzePatterns(all);

        return {
            timelineData: Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)),
            warnings,
            todayChart,
            patternAnalysis
        };
    }, [unifiedActivities, plannedActivities]);

    // Near-term data (today + next 3 days)
    const nearTerm = useMemo(() => {
        const todayStr = getISODate();
        const todayIdx = timelineData.findIndex(d => d.date === todayStr);
        if (todayIdx === -1) return timelineData.slice(0, 4);
        return timelineData.slice(todayIdx, todayIdx + 4);
    }, [timelineData]);

    const formatDay = (iso: string) => {
        const d = new Date(iso);
        const today = getISODate();
        const diff = Math.ceil((d.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));

        const weekday = WEEKDAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
        const weekdaySv = {
            monday: 'Måndag', tuesday: 'Tisdag', wednesday: 'Onsdag',
            thursday: 'Torsdag', friday: 'Fredag', saturday: 'Lördag', sunday: 'Söndag'
        }[weekday] || '';

        if (iso === today) return 'Idag';
        if (diff === 1) return 'Imorgon';
        if (diff === -1) return 'Igår';
        return `${weekdaySv} ${d.getDate()}/${d.getMonth() + 1}`;
    };

    const getSignalBadge = (signal: SignalCategory) => {
        switch (signal) {
            case 'MTOR':
                return <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                    <Dumbbell size={10} /> mTOR
                </div>;
            case 'AMPK_HIGH':
                return <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded">
                    <Zap size={10} /> AMPK
                </div>;
            case 'AMPK_LOW':
                return <div className="flex items-center gap-1 text-[10px] font-bold text-sky-600 bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 rounded">
                    <Activity size={10} /> Lätt
                </div>;
            case 'HYBRID':
                return <div className="flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                    <Zap size={10} /> Hybrid
                </div>;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-full mb-2">
                    <Activity size={32} className="text-indigo-500" />
                </div>
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                    Signalanalys & Interferens
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                    Optimera dina resultat genom att undvika "The Interference Effect".
                </p>
            </div>

            {/* Near-Term Panel */}
            <section className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-200 dark:border-indigo-800/50 rounded-3xl p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Target size={20} className="text-indigo-500" />
                    Närtid (Idag + 3 dagar)
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {nearTerm.map(({ date, activities, warning }) => {
                        const isToday = date === getISODate();
                        return (
                            <div key={date} className={`p-4 rounded-xl transition-all ${warning
                                ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400'
                                : isToday
                                    ? 'bg-white dark:bg-slate-900 border-2 border-indigo-500'
                                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                                }`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {formatDay(date)}
                                        </div>
                                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                                            {date.split('-')[2]}
                                        </div>
                                    </div>
                                    {warning && <AlertTriangle size={18} className="text-amber-500 animate-pulse" />}
                                </div>

                                {activities.length === 0 ? (
                                    <p className="text-xs text-slate-400">Vila / Ingen träning</p>
                                ) : (
                                    <div className="space-y-2">
                                        {activities.slice(0, 3).map((act, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span className="text-xs font-medium truncate max-w-[100px]">
                                                    {act.title || act.type}
                                                </span>
                                                {getSignalBadge(classifyActivity(act))}
                                            </div>
                                        ))}
                                        {activities.length > 3 && (
                                            <span className="text-[10px] text-slate-400">+{activities.length - 3} fler</span>
                                        )}
                                    </div>
                                )}

                                {warning && (
                                    <div className="mt-3 pt-3 border-t border-amber-300 dark:border-amber-700">
                                        <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                                            ⚠ {warning.message}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Signal Timeline Chart */}
            {todayChart.length > 0 && (
                <SignalTimelineChart activities={todayChart} />
            )}

            {/* Pattern Analysis */}
            {patternAnalysis.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <TrendingUp size={20} className="text-purple-500" />
                        Mönsteranalys
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {patternAnalysis.map((pattern, i) => (
                            <div key={i} className={`p-4 rounded-xl border ${pattern.type === 'positive'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                : pattern.type === 'warning'
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
                                }`}>
                                <div className="flex items-start gap-3">
                                    {pattern.type === 'positive' ? (
                                        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                                    ) : pattern.type === 'warning' ? (
                                        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                                    ) : (
                                        <AlertTriangle className="text-rose-500 shrink-0" size={20} />
                                    )}
                                    <div>
                                        <h4 className="font-bold text-sm">{pattern.title}</h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                            {pattern.description}
                                        </p>
                                        {pattern.recommendation && (
                                            <p className="text-xs font-medium mt-2 text-indigo-600 dark:text-indigo-400">
                                                💡 {pattern.recommendation}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Timeline (Historical + Future) */}
            <section className="space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Calendar size={20} className="text-slate-500" />
                    Fullständig tidslinje
                </h2>

                <div className="grid gap-3">
                    {timelineData.map(({ date, activities, warning }) => {
                        const isToday = date === getISODate();
                        const hasActivity = activities.length > 0;

                        if (!hasActivity && !isToday) return null;

                        return (
                            <div key={date} className={`relative rounded-xl border transition-all ${warning
                                ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                                : isToday
                                    ? 'bg-white dark:bg-slate-900 border-indigo-500 ring-1 ring-indigo-500/50'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                }`}>
                                <div className="p-4">
                                    {/* Date Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${isToday ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                                }`}>
                                                {date.split('-')[2]}
                                            </div>
                                            <div>
                                                <h3 className="font-bold">{formatDay(date)}</h3>
                                                <p className="text-[10px] text-slate-400 font-mono">{date}</p>
                                            </div>
                                        </div>

                                        {warning && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold uppercase">
                                                <AlertTriangle size={12} />
                                                {warning.riskLevel}
                                            </div>
                                        )}
                                    </div>

                                    {/* Activities */}
                                    <div className="flex flex-wrap gap-2">
                                        {activities.length === 0 && (
                                            <p className="text-sm text-slate-400 italic">Vilodag</p>
                                        )}

                                        {activities.map((act, idx) => {
                                            const signal = classifyActivity(act);
                                            const isPlanned = act._source === 'PLAN';

                                            return (
                                                <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${signal === 'MTOR' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                                                    signal === 'AMPK_HIGH' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' :
                                                        signal === 'AMPK_LOW' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' :
                                                            signal === 'HYBRID' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                                                'bg-slate-100 dark:bg-slate-800 text-slate-600'
                                                    } ${isPlanned ? 'border border-dashed border-current opacity-70' : ''}`}>
                                                    {act.title || act.type}
                                                    {act.durationMinutes && (
                                                        <span className="text-[10px] opacity-70">
                                                            ({formatDuration(act.durationMinutes)})
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Warning Details */}
                                    {warning && (
                                        <div className="mt-3 p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                                            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                                                {warning.message}
                                            </p>
                                            <p className="text-[10px] text-amber-700 dark:text-amber-300/80 mt-1">
                                                {warning.suggestion}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Educational Footer */}
            <div className="bg-indigo-900 text-indigo-100 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-16 -mt-16"></div>

                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <BookOpen size={32} />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">Vetenskapen bakom interferens</h2>
                        <p className="leading-relaxed opacity-90">
                            <strong>mTOR</strong> (styrka) och <strong>AMPK</strong> (kondition) är biologiska "strömbrytare" som styr din anpassning.
                            Problemet: AMPK blockerar mTOR. Spring direkt efter styrka = mindre muskeltillväxt.
                        </p>

                        <div className="grid md:grid-cols-3 gap-4 pt-4">
                            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-400/20">
                                <h3 className="font-bold text-emerald-400 mb-2 flex items-center gap-2">
                                    <Timer size={16} /> Optimal separation
                                </h3>
                                <p className="text-sm opacity-80">6-24 timmar mellan pass för bäst anpassning.</p>
                            </div>
                            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-400/20">
                                <h3 className="font-bold text-amber-400 mb-2 flex items-center gap-2">
                                    <Clock size={16} /> Dubbelpass
                                </h3>
                                <p className="text-sm opacity-80">Styrka på morgon, kondition på kväll. Minst 4h mellanrum.</p>
                            </div>
                            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-400/20">
                                <h3 className="font-bold text-rose-400 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} /> Trippelpass
                                </h3>
                                <p className="text-sm opacity-80">Riskerar överträning. Endast för avancerade med god återhämtning.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper function for pattern analysis
interface PatternResult {
    type: 'positive' | 'warning' | 'danger';
    title: string;
    description: string;
    recommendation?: string;
}

function analyzePatterns(activities: any[]): PatternResult[] {
    const results: PatternResult[] = [];

    // Group by date
    const byDate: Record<string, any[]> = {};
    activities.forEach(a => {
        if (!byDate[a.date]) byDate[a.date] = [];
        byDate[a.date].push(a);
    });

    // Check each day
    Object.entries(byDate).forEach(([date, acts]) => {
        const signals = acts.map(a => classifyActivity(a));

        // Triple session check
        if (acts.length >= 3) {
            results.push({
                type: 'danger',
                title: `Trippelpass (${formatDay(date)})`,
                description: `${acts.length} träningspass samma dag kan leda till överträning och bristande återhämtning.`,
                recommendation: 'Överväg att flytta åtminstone ett pass till nästa dag.'
            });
        }

        // Double strength same muscles
        const strengthActs = acts.filter(a => classifyActivity(a) === 'MTOR');
        if (strengthActs.length >= 2) {
            const muscles1 = strengthActs[0].muscleGroups || [];
            const muscles2 = strengthActs[1].muscleGroups || [];
            const overlap = muscles1.filter((m: string) => muscles2.includes(m));

            if (overlap.length > 0) {
                results.push({
                    type: 'warning',
                    title: `Samma muskelgrupp två gånger`,
                    description: `Du tränar samma muskler (${overlap.join(', ')}) två gånger på ${formatDay(date)}.`,
                    recommendation: 'Dela upp i överkropp/underkropp eller separera med 48h.'
                });
            }
        }

        // Good pattern: Well-spaced sessions
        if (acts.length === 1 && signals.includes('MTOR')) {
            results.push({
                type: 'positive',
                title: `Optimalt styrkepass`,
                description: `Ensamt styrkepass på ${formatDay(date)} ger maximal mTOR-aktivering utan interferens.`
            });
        }
    });

    // Limit results
    return results.slice(0, 4);
}

function formatDay(iso: string): string {
    const d = new Date(iso);
    const today = getISODate();
    const diff = Math.ceil((d.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));

    if (iso === today) return 'idag';
    if (diff === 1) return 'imorgon';
    if (diff === -1) return 'igår';
    return `${d.getDate()}/${d.getMonth() + 1}`;
}
