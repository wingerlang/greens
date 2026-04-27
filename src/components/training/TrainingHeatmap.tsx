import React, { useMemo, useState } from 'react';
import { UniversalActivity } from '../../models/types.ts';
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay, isSameDay, subDays, startOfWeek, addWeeks } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Calendar, Clock, MapPin, BarChart3 } from 'lucide-react';

interface TrainingHeatmapProps {
    activities: UniversalActivity[];
    years: number[];
}

export function TrainingHeatmap({ activities, years }: TrainingHeatmapProps) {
    const [metric, setMetric] = useState<'duration' | 'distance' | 'count'>('duration');

    const heatmapData = useMemo(() => {
        return years.map(year => {
            const startDate = startOfYear(new Date(year, 0, 1));
            const endDate = endOfYear(new Date(year, 11, 31));
            
            // Adjust start to the beginning of the week (Monday in Sweden)
            const firstMonday = startOfWeek(startDate, { weekStartsOn: 1 });
            const lastSunday = endOfYear(endDate);
            
            const days = eachDayOfInterval({ start: firstMonday, end: lastSunday });
            
            const yearActivities = activities.filter(a => new Date(a.date).getFullYear() === year);
            
            const dayMap = new Map<string, { duration: number, distance: number, count: number, activities: any[] }>();
            
            yearActivities.forEach(a => {
                const dateKey = a.date.split('T')[0];
                const existing = dayMap.get(dateKey) || { duration: 0, distance: 0, count: 0, activities: [] };
                existing.duration += a.performance?.durationMinutes || 0;
                existing.distance += a.performance?.distanceKm || 0;
                existing.count += 1;
                existing.activities.push(a);
                dayMap.set(dateKey, existing);
            });

            // Group into weeks
            const weeks: any[][] = [];
            let currentWeek: any[] = [];
            
            days.forEach((day, index) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const data = dayMap.get(dateKey) || { duration: 0, distance: 0, count: 0, activities: [] };
                
                currentWeek.push({
                    date: day,
                    dateKey,
                    ...data,
                    isCurrentYear: day.getFullYear() === year
                });
                
                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            });
            
            if (currentWeek.length > 0) weeks.push(currentWeek);

            // Find max for scaling
            let maxVal = 0;
            dayMap.forEach(v => {
                const val = metric === 'duration' ? v.duration : metric === 'distance' ? v.distance : v.count;
                if (val > maxVal) maxVal = val;
            });

            return { year, weeks, maxVal };
        });
    }, [activities, years, metric]);

    const getColor = (val: number, max: number) => {
        if (val === 0) return 'bg-slate-800/40';
        const intensity = max > 0 ? val / max : 0;
        if (intensity < 0.25) return 'bg-emerald-900/40';
        if (intensity < 0.5) return 'bg-emerald-700/60';
        if (intensity < 0.75) return 'bg-emerald-500/80';
        return 'bg-emerald-400';
    };

    const weekDays = ['Mån', '', 'Ons', '', 'Fre', '', 'Sön'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                    <Calendar size={20} className="text-emerald-500" /> Aktivitetsheatmap
                </h3>
                <div className="flex bg-slate-900 border border-white/10 rounded-xl p-1 gap-1">
                    {[
                        { id: 'duration', label: 'Tid', icon: <Clock size={12} /> },
                        { id: 'distance', label: 'Distans', icon: <MapPin size={12} /> },
                        { id: 'count', label: 'Antal', icon: <BarChart3 size={12} /> }
                    ].map(m => (
                        <button
                            key={m.id}
                            onClick={() => setMetric(m.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${metric === m.id ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <span className="opacity-80">{m.icon}</span>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {heatmapData.map(({ year, weeks, maxVal }) => (
                <div key={year} className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-6 overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <div className="text-xl font-black text-white italic">{year}</div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
                            <span>Mindre</span>
                            <div className="flex gap-1">
                                <div className="w-3 h-3 rounded-sm bg-slate-800/40"></div>
                                <div className="w-3 h-3 rounded-sm bg-emerald-900/40"></div>
                                <div className="w-3 h-3 rounded-sm bg-emerald-700/60"></div>
                                <div className="w-3 h-3 rounded-sm bg-emerald-500/80"></div>
                                <div className="w-3 h-3 rounded-sm bg-emerald-400"></div>
                            </div>
                            <span>Mer</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {/* Day Labels */}
                        <div className="flex flex-col gap-1 pr-2 pt-6">
                            {weekDays.map((d, i) => (
                                <div key={i} className="h-3 text-[9px] font-bold text-slate-600 flex items-center">{d}</div>
                            ))}
                        </div>

                        {/* The Grid */}
                        <div className="flex-1 overflow-x-auto no-scrollbar pb-2">
                            <div className="flex gap-1 min-w-max">
                                {weeks.map((week, wIdx) => {
                                    // Month label logic
                                    const firstDay = week[0].date;
                                    const showMonth = wIdx === 0 || firstDay.getDate() <= 7;
                                    const monthLabel = showMonth ? format(firstDay, 'MMM', { locale: sv }) : '';

                                    return (
                                        <div key={wIdx} className="flex flex-col gap-1">
                                            <div className="h-4 text-[9px] font-bold text-slate-500 uppercase text-center mb-1">
                                                {monthLabel}
                                            </div>
                                            {week.map((day : any, dIdx : number) => {
                                                const val = metric === 'duration' ? day.duration : metric === 'distance' ? day.distance : day.count;
                                                const nonWarmups = day.activities.filter((a: any) => {
                                                    const isWarmup = a.performance?.subType === 'warmup' || (a.performance?.notes || a.plan?.title || '').toLowerCase().includes('uppvärmning') || (a.performance?.notes || a.plan?.title || '').toLowerCase().includes('uppjogg');
                                                    return !isWarmup;
                                                });
                                                const hasDouble = nonWarmups.length >= 2;
                                                const hasTriple = nonWarmups.length >= 3;
                                                const tipText = `${format(day.date, 'PPPP', { locale: sv })}: ${val.toFixed(metric === 'count' ? 0 : 1)} ${metric === 'duration' ? 'min' : metric === 'distance' ? 'km' : 'pass'}`;
                                                
                                                return (
                                                    <div
                                                        key={dIdx}
                                                        className={`w-3 h-3 rounded-[3px] transition-all hover:ring-2 hover:ring-white/30 cursor-help relative flex items-center justify-center ${day.isCurrentYear ? getColor(val, maxVal) : 'opacity-0 pointer-events-none'}`}
                                                        title={hasDouble ? `${tipText} (${nonWarmups.length} riktiga pass)` : tipText}
                                                    >
                                                        {hasDouble && (
                                                            <div className={`w-1 h-1 rounded-full ${hasTriple ? 'bg-rose-400' : 'bg-amber-400'}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
