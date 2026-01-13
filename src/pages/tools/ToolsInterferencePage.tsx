import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import {
    analyzeInterference,
    classifyActivity,
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
    BicepsFlexed, // Using specific lucide icons if available, otherwise generic names
    Dumbbell,
    Activity,
    Zap,
    Clock,
    Calendar,
    ArrowRight,
    CheckCircle2,
    BookOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function ToolsInterferencePage() {
    const { unifiedActivities, plannedActivities } = useData();
    const [daysToShow, setDaysToShow] = useState(14); // 7 past, 7 future

    // 1. Combine and Filter Data
    const timelineData = useMemo(() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 7);

        const end = new Date(today);
        end.setDate(today.getDate() + 14);

        const startStr = getISODate(start);
        const endStr = getISODate(end);

        // Filter History
        const history = unifiedActivities.filter(a => a.date >= startStr && a.date <= endStr).map(a => ({
            ...a,
            _source: 'HISTORY',
            _id: a.id
        }));

        // Filter Plan
        const plan = plannedActivities
            .filter(a => a.date >= startStr && a.date <= endStr && a.status === 'PLANNED')
            .map(a => ({
                ...a,
                _source: 'PLAN',
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

        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    }, [unifiedActivities, plannedActivities]);

    const formatDay = (iso: string) => {
        const d = new Date(iso);
        const today = getISODate();
        const diff = Math.ceil((d.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));

        const weekday = WEEKDAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]; // types.ts has lowercase
        const weekdaySv = {
            monday: 'Måndag', tuesday: 'Tisdag', wednesday: 'Onsdag',
            thursday: 'Torsdag', friday: 'Fredag', saturday: 'Lördag', sunday: 'Söndag'
        }[weekday] || '';

        let label = `${weekdaySv} ${d.getDate()}/${d.getMonth() + 1}`;
        if (iso === today) label = 'Idag';
        else if (diff === 1) label = 'Imorgon';
        else if (diff === -1) label = 'Igår';

        return label;
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-slate-900 dark:text-slate-100">
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
                    Analysera krockar mellan uppbyggande (mTOR) och nedbrytande (AMPK) signaler.
                </p>
            </div>

            {/* Dashboard / Timeline */}
            <div className="grid gap-4">
                {timelineData.map(({ date, activities, warning }) => {
                    const isToday = date === getISODate();
                    const hasActivity = activities.length > 0;

                    if (!hasActivity && !isToday) return null; // Skip empty days unless today

                    return (
                        <div key={date} className={`relative rounded-2xl border transition-all ${
                            warning
                                ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                                : isToday
                                    ? 'bg-white dark:bg-slate-900 border-indigo-500 ring-1 ring-indigo-500/50'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}>
                            <div className="p-4 sm:p-6">
                                {/* Date Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${
                                            isToday ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                            {date.split('-')[2]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{formatDay(date)}</h3>
                                            <p className="text-xs text-slate-400 font-mono">{date}</p>
                                        </div>
                                    </div>

                                    {warning && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full text-xs font-bold uppercase tracking-wide animate-pulse">
                                            <AlertTriangle size={14} />
                                            {warning.riskLevel === 'HIGH' ? 'Hög Risk' : 'Varning'}
                                        </div>
                                    )}
                                </div>

                                {/* Activities List */}
                                <div className="space-y-3">
                                    {activities.length === 0 && (
                                        <p className="text-sm text-slate-400 italic py-2">Ingen träning registrerad.</p>
                                    )}

                                    {activities.map((act, idx) => {
                                        const signal = classifyActivity(act);
                                        const isPlanned = act._source === 'PLAN';

                                        let Badge = null;
                                        let colorClass = '';

                                        switch (signal) {
                                            case 'MTOR':
                                                Badge = <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">
                                                    <Dumbbell size={12} /> mTOR (Tillväxt)
                                                </div>;
                                                colorClass = 'border-l-4 border-emerald-500';
                                                break;
                                            case 'AMPK_HIGH':
                                                Badge = <div className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/30 px-2 py-1 rounded">
                                                    <Zap size={12} /> AMPK (Hög)
                                                </div>;
                                                colorClass = 'border-l-4 border-rose-500';
                                                break;
                                            case 'AMPK_LOW':
                                                Badge = <div className="flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-100 dark:bg-sky-900/30 px-2 py-1 rounded">
                                                    <Activity size={12} /> AMPK (Låg)
                                                </div>;
                                                colorClass = 'border-l-4 border-sky-500';
                                                break;
                                            case 'HYBRID':
                                                Badge = <div className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">
                                                    <Zap size={12} /> HYBRID (Hög)
                                                </div>;
                                                colorClass = 'border-l-4 border-purple-500';
                                                break;
                                            default:
                                                colorClass = 'border-l-4 border-slate-300 dark:border-slate-700';
                                        }

                                        return (
                                            <div key={idx} className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg ${colorClass}`}>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-sm">
                                                            {(act.title || act.type || 'Aktivitet').toUpperCase()}
                                                        </span>
                                                        {isPlanned && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 rounded">PLANERAD</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500">{act.description || act.notes || ''}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {Badge}
                                                    <span className="text-[10px] text-slate-400">
                                                        {act._source === 'PLAN' ? act.category : (act.durationMinutes ? `${act.durationMinutes} min` : '')}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Warning Content */}
                                {warning && (
                                    <div className="mt-4 p-4 bg-amber-100/50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                                        <div className="flex gap-3">
                                            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                                            <div className="space-y-2">
                                                <h4 className="font-bold text-amber-800 dark:text-amber-200">{warning.message}</h4>
                                                <p className="text-sm text-amber-700 dark:text-amber-300/80 leading-relaxed">
                                                    {warning.scientificExplanation}
                                                </p>
                                                <div className="flex items-start gap-2 text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/40 p-3 rounded-lg">
                                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                                    <span>{warning.suggestion}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Educational Footer */}
            <div className="bg-indigo-900 text-indigo-100 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-16 -mt-16"></div>

                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <BookOpen size={32} />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">Vetenskapen bakom "The Interference Effect"</h2>
                        <p className="leading-relaxed opacity-90">
                            När du tränar kondition aktiveras enzymet <strong>AMPK</strong> för att reglera energi och mitokondrier.
                            När du styrketränar aktiveras <strong>mTOR</strong> för att bygga muskler.
                        </p>
                        <p className="leading-relaxed opacity-90">
                            Problemet är att <strong>AMPK blockerar mTOR</strong>. Om du springer (höjer AMPK) direkt efter ett styrkepass
                            stänger du effektivt av den anabola signalen som styrketräningen skapade. Resultatet? Mindre muskeltillväxt.
                        </p>

                        <div className="grid md:grid-cols-2 gap-4 pt-4">
                            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-400/20">
                                <h3 className="font-bold text-emerald-400 mb-2">Optimal Ordning</h3>
                                <ul className="text-sm space-y-2 list-disc list-inside opacity-80">
                                    <li>Separera passen med minst 6-24 timmar.</li>
                                    <li>Om samma dag: Styrka på morgonen, cardio på kvällen.</li>
                                    <li>Eller: Styrka först, cardio sist (om direkt efter varandra).</li>
                                </ul>
                            </div>
                            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-400/20">
                                <h3 className="font-bold text-rose-400 mb-2">Riskzoner</h3>
                                <ul className="text-sm space-y-2 list-disc list-inside opacity-80">
                                    <li>Cardio (Hög puls) direkt efter Styrka.</li>
                                    <li>Cardio innan Styrka (tömmer glykogen + förtröttning).</li>
                                    <li>Tung styrka följt av Hyrox/CrossFit.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
