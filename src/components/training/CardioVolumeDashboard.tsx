import React, { useMemo, useState } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import {
    ComposedChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    Line,
    ReferenceLine
} from 'recharts';
import {
    Footprints,
    TrendingUp,
    Clock,
    Waves,
    Heart,
    Zap,
    Activity
} from 'lucide-react';
import { formatActivityDuration } from '../../utils/durationFormatter.ts';
import { useData } from '../../context/DataContext.tsx';

interface CardioVolumeDashboardProps {
    exercises: ExerciseEntry[];
    universalActivities: UniversalActivity[];
}

type Grouping = 'day' | 'week' | '2week' | 'month';

function getISOWeekNumber(d: Date): number {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getMondayOfWeek(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1);
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
}

export function CardioVolumeDashboard({ exercises, universalActivities, plannedActivities = [] }: CardioVolumeDashboardProps) {
    const { performanceGoals } = useData();

    const [grouping, setGrouping] = useState<Grouping>('week');
    const [showTime, setShowTime] = useState(true);
    const [showDist, setShowDist] = useState(true);
    const [showRunning, setShowRunning] = useState(true);
    const [showOtherCardio, setShowOtherCardio] = useState(true);
    const [isRollingMode, setIsRollingMode] = useState(false);

    // Find weekly distance goal
    const weeklyGoal = useMemo(() => {
        const goal = performanceGoals?.find(g => 
            g.type === 'distance' && 
            g.period === 'weekly' && 
            g.status === 'active' &&
            g.targets.some(t => t.exerciseType === 'running' || !t.exerciseType)
        );
        if (!goal) return null;
        const target = goal.targets.find(t => t.exerciseType === 'running' || !t.exerciseType);
        return target?.value || null;
    }, [performanceGoals]);

    // Classify activity type
    const isRunning = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('cross') || t.includes('elliptical') || t.includes('stair') || t.includes('row') || t.includes('cardio')) return false;
        return t.includes('run') || t.includes('löp');
    };

    // Filter cardio activities
    const cardioData = useMemo(() => {
        if (!exercises || exercises.length === 0) return [];
        return exercises.filter(e => {
            const t = (e.type || '').toLowerCase();
            const isCardio = t.includes('run') || t.includes('löp') ||
                   t.includes('cycl') || t.includes('cyk') ||
                   t.includes('cardio') || t.includes('cross') ||
                   t.includes('row') || t.includes('sim') || t.includes('swim');
            if (!isCardio) return false;

            // Apply activity type filters
            const isRun = isRunning(t);
            if (isRun && !showRunning) return false;
            if (!isRun && !showOtherCardio) return false;
            return true;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [exercises, showRunning, showOtherCardio]);

    // Helper for current period
    const isCurrentPeriod = (groupKey: string, groupingType: Grouping): boolean => {
        const now = new Date();
        const todayKey = now.toISOString().split('T')[0];
        
        if (groupingType === 'day') {
            return groupKey === todayKey;
        } else if (groupingType === 'week') {
            const monday = getMondayOfWeek(now);
            return groupKey === monday.toISOString().split('T')[0];
        } else if (groupingType === '2week') {
            const wn = getISOWeekNumber(now);
            const pairIndex = Math.ceil(wn / 2);
            return groupKey === `${now.getFullYear()}-2W${pairIndex}`;
        } else if (groupingType === 'month') {
            return groupKey === `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        return false;
    };

    const groupedStats = useMemo(() => {
        if (cardioData.length === 0) return [];

        const groups: Record<string, {
            key: string; label: string; totalTime: number; totalDist: number;
            totalCals: number; count: number; hrSum: number; hrCount: number;
            plannedCount: number; plannedRaceCount: number; plannedDuration: number;
            isCurrent: boolean;
        }> = {};

        // 1. Basic daily grouping
        cardioData.forEach(e => {
            const d = new Date(e.date);
            if (isNaN(d.getTime())) return;
            const key = e.date;
            if (!groups[key]) {
                groups[key] = {
                    key, label: `${d.getDate()}/${d.getMonth() + 1}`,
                    totalTime: 0, totalDist: 0, totalCals: 0, count: 0,
                    hrSum: 0, hrCount: 0,
                    plannedCount: 0, plannedRaceCount: 0, plannedDuration: 0,
                    isCurrent: key === new Date().toISOString().split('T')[0]
                };
            }
            groups[key].totalTime += Number(e.durationMinutes || 0);
            groups[key].totalDist += Number(e.distance || 0);
            groups[key].totalCals += Number(e.caloriesBurned || 0);
            groups[key].count++;
            const hr = Number(e.heartRateAvg || 0);
            if (hr > 0) { groups[key].hrSum += hr; groups[key].hrCount++; }
        });

        // Add planned activities to daily buckets
        plannedActivities.forEach(a => {
            const key = a.date;
            if (!groups[key]) return; // Or create group if needed, but usually we only show days with data or current day
            
            if (a.status === 'PLANNED' || a.status === 'DRAFT') {
                if (a.category === 'RACE') {
                    groups[key].plannedRaceCount++;
                    groups[key].plannedDuration += (a.durationMinutes || 0);
                } else {
                    groups[key].plannedCount++;
                }
            }
        });

        const dailySorted = Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));

        if (isRollingMode) {
            let windowSize = 7;
            if (grouping === 'week') windowSize = 7;
            else if (grouping === '2week') windowSize = 14;
            else if (grouping === 'month') windowSize = 30;
            else if (grouping === 'day') windowSize = 1;

            const allDays: Record<string, typeof dailySorted[0]> = {};
            dailySorted.forEach(s => { allDays[s.key] = s; });

            const firstDate = new Date(dailySorted[0].key);
            const lastDate = new Date(dailySorted[dailySorted.length - 1].key);
            const result: any[] = [];

            for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                const window: any[] = [];
                for (let i = 0; i < windowSize; i++) {
                    const wd = new Date(d);
                    wd.setDate(wd.getDate() - i);
                    const wk = wd.toISOString().split('T')[0];
                    if (allDays[wk]) window.push(allDays[wk]);
                }

                result.push({
                    key,
                    label: `${d.getDate()}/${d.getMonth() + 1}`,
                    totalTime: window.reduce((s, c) => s + c.totalTime, 0),
                    totalDist: window.reduce((s, c) => s + c.totalDist, 0),
                    totalCals: window.reduce((s, c) => s + c.totalCals, 0),
                    count: window.reduce((s, c) => s + c.count, 0),
                    plannedCount: window.reduce((s, c) => s + c.plannedCount, 0),
                    plannedRaceCount: window.reduce((s, c) => s + c.plannedRaceCount, 0),
                    plannedDuration: window.reduce((s, c) => s + c.plannedDuration, 0),
                    hrSum: window.reduce((s, c) => s + c.hrSum, 0),
                    hrCount: window.reduce((s, c) => s + c.hrCount, 0),
                    isCurrent: key === new Date().toISOString().split('T')[0]
                });
            }
            return result.map((g, i, arr) => {
                const completedBefore = arr.slice(0, i).filter(x => !x.isCurrent);
                const win = completedBefore.slice(-4);
                return {
                    ...g,
                    avgHr: g.hrCount > 0 ? Math.round(g.hrSum / g.hrCount) : null,
                    rollingTime: win.length > 0 ? Math.round(win.reduce((s, c) => s + c.totalTime, 0) / win.length) : g.totalTime,
                    rollingDist: win.length > 0 ? Math.round(win.reduce((s, c) => s + c.totalDist, 0) / win.length * 10) / 10 : g.totalDist,
                };
            });
        }

        const calendarGroups: Record<string, any> = {};
        cardioData.forEach(e => {
            const d = new Date(e.date);
            let groupKey = '';
            let groupLabel = '';

            if (grouping === 'day') {
                groupKey = e.date;
                groupLabel = `${d.getDate()}/${d.getMonth() + 1}`;
            } else if (grouping === 'week') {
                const monday = getMondayOfWeek(d);
                groupKey = monday.toISOString().split('T')[0];
                groupLabel = `V${getISOWeekNumber(d)}`;
            } else if (grouping === '2week') {
                const wn = getISOWeekNumber(d);
                const pairIndex = Math.ceil(wn / 2);
                const w1 = (pairIndex - 1) * 2 + 1;
                groupKey = `${d.getFullYear()}-2W${pairIndex}`;
                groupLabel = `V${w1}-${w1 + 1}`;
            } else if (grouping === 'month') {
                groupKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                const m = d.toLocaleString('sv-SE', { month: 'short' });
                groupLabel = m.charAt(0).toUpperCase() + m.slice(1);
            }

            if (!calendarGroups[groupKey]) {
                calendarGroups[groupKey] = {
                    key: groupKey, label: groupLabel, totalTime: 0, totalDist: 0, totalCals: 0, count: 0, hrSum: 0, hrCount: 0,
                    plannedCount: 0, plannedRaceCount: 0, plannedDuration: 0,
                    isCurrent: isCurrentPeriod(groupKey, grouping)
                };
            }
            calendarGroups[groupKey].totalTime += Number(e.durationMinutes || 0);
            calendarGroups[groupKey].totalDist += Number(e.distance || 0);
            calendarGroups[groupKey].totalCals += Number(e.caloriesBurned || 0);
            calendarGroups[groupKey].count++;
            const hr = Number(e.heartRateAvg || 0);
            if (hr > 0) { calendarGroups[groupKey].hrSum += hr; calendarGroups[groupKey].hrCount++; }
        });

        // Add planned activities to calendar groups
        plannedActivities.forEach(a => {
            const d = new Date(a.date);
            let groupKey = '';
            if (grouping === 'day') groupKey = a.date;
            else if (grouping === 'week') groupKey = getMondayOfWeek(d).toISOString().split('T')[0];
            else if (grouping === '2week') groupKey = `${d.getFullYear()}-2W${Math.ceil(getISOWeekNumber(d) / 2)}`;
            else if (grouping === 'month') groupKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

            if (calendarGroups[groupKey] && (a.status === 'PLANNED' || a.status === 'DRAFT')) {
                if (a.category === 'RACE') {
                    calendarGroups[groupKey].plannedRaceCount++;
                    calendarGroups[groupKey].plannedDuration += (a.durationMinutes || 0);
                } else {
                    calendarGroups[groupKey].plannedCount++;
                }
            }
        });

        return Object.values(calendarGroups).sort((a, b) => a.key.localeCompare(b.key)).map((g, i, arr) => {
            const completedBefore = arr.slice(0, i).filter(x => !x.isCurrent);
            const win = completedBefore.slice(-4);
            return {
                ...g,
                avgHr: g.hrCount > 0 ? Math.round(g.hrSum / g.hrCount) : null,
                rollingTime: win.length > 0 ? Math.round(win.reduce((s, c) => s + c.totalTime, 0) / win.length) : g.totalTime,
                rollingDist: win.length > 0 ? Math.round(win.reduce((s, c) => s + c.totalDist, 0) / win.length * 10) / 10 : g.totalDist,
                label: g.isCurrent ? `${g.label}*` : g.label
            };
        });
    }, [cardioData, grouping, isRollingMode]);

    const chartData = useMemo(() => {
        return groupedStats.map(g => ({
            ...g,
            displayTime: showTime ? g.totalTime : null,
            displayDist: showDist ? g.totalDist : null,
            displayRollingTime: showTime ? g.rollingTime : null,
            displayRollingDist: showDist ? g.rollingDist : null,
        }));
    }, [groupedStats, showTime, showDist]);

    const totals = useMemo(() => {
        const base = cardioData.reduce((acc, e) => {
            const isRun = isRunning(e.type);
            return {
                time: acc.time + Number(e.durationMinutes || 0),
                dist: acc.dist + Number(e.distance || 0),
                cals: acc.cals + Number(e.caloriesBurned || 0),
                count: acc.count + 1,
                runDist: acc.runDist + (isRun ? Number(e.distance || 0) : 0),
                otherDist: acc.otherDist + (!isRun ? Number(e.distance || 0) : 0)
            };
        }, { time: 0, dist: 0, cals: 0, count: 0, runDist: 0, otherDist: 0 });

        const planned = plannedActivities.reduce((acc, a) => {
            if (a.status === 'PLANNED' || a.status === 'DRAFT') {
                if (a.category === 'RACE') {
                    acc.raceCount++;
                    acc.duration += (a.durationMinutes || 0);
                } else {
                    acc.sessionCount++;
                }
            }
            return acc;
        }, { sessionCount: 0, raceCount: 0, duration: 0 });

        return { ...base, planned };
    }, [cardioData, plannedActivities]);

    const boundaries = useMemo(() => {
        const lines: { x: string; type: 'month' | 'year'; label: string }[] = [];
        groupedStats.forEach((g, i) => {
            if (i === 0) return;
            const prev = new Date(groupedStats[i - 1].key);
            const curr = new Date(g.key);
            
            if (curr.getFullYear() !== prev.getFullYear()) {
                lines.push({ x: g.label, type: 'year', label: curr.getFullYear().toString() });
            } else if (curr.getMonth() !== prev.getMonth() && grouping !== 'month') {
                lines.push({ x: g.label, type: 'month', label: curr.toLocaleString('sv-SE', { month: 'short' }) });
            }
        });
        return lines;
    }, [groupedStats, grouping]);

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-10">
            {/* KPI STRIP */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-4 rounded-3xl hover:bg-slate-800/80 transition-all duration-300 group cursor-default">
                    <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 group-hover:text-purple-300 transition-colors"><Clock size={12} className="text-purple-500" /> Tid</div>
                    <div className="text-2xl font-black text-white font-mono">
                        {Math.floor(totals.time / 60)}<span className="text-xs text-slate-500 ml-0.5">h</span> {Math.round(totals.time % 60)}<span className="text-xs text-slate-500 ml-0.5">m</span>
                        {totals.planned.duration > 0 && (
                            <span className="text-xs text-slate-500 ml-1.5">
                                ({Math.floor((totals.time + totals.planned.duration) / 60)}h)
                            </span>
                        )}
                    </div>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-4 rounded-3xl hover:bg-slate-800/80 transition-all duration-300 group cursor-default">
                    <div className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 group-hover:text-teal-300 transition-colors"><Footprints size={12} className="text-teal-500" /> KM</div>
                    <div className="text-2xl font-black text-white font-mono">{totals.dist.toFixed(0)}<span className="text-xs text-slate-500 ml-0.5">km</span></div>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-4 rounded-3xl hover:bg-slate-800/80 transition-all duration-300 group cursor-default">
                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 group-hover:text-rose-400 transition-colors"><Zap size={12} className="text-rose-500" /> Löp</div>
                    <div className="text-2xl font-black text-white font-mono">{totals.runDist.toFixed(1)}<span className="text-xs text-slate-500 ml-0.5">km</span></div>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-4 rounded-3xl hover:bg-slate-800/80 transition-all duration-300 group cursor-default">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 group-hover:text-slate-300 transition-colors"><Activity size={12} className="text-slate-400" /> Övrigt</div>
                    <div className="text-2xl font-black text-white font-mono">{totals.otherDist.toFixed(1)}<span className="text-xs text-slate-500 ml-0.5">km</span></div>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-4 rounded-3xl hover:bg-slate-800/80 transition-all duration-300 group cursor-default">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 group-hover:text-indigo-400 transition-colors"><Waves size={12} className="text-indigo-500" /> Pass</div>
                    <div className="text-2xl font-black text-white font-mono">
                        {totals.count}<span className="text-xs text-slate-500 ml-0.5">x</span>
                        {(totals.planned.sessionCount > 0 || totals.planned.raceCount > 0) && (
                            <span className="text-xs text-sky-400 ml-1.5">
                                (+{totals.planned.sessionCount}{totals.planned.raceCount > 0 ? `, +${totals.planned.raceCount}` : ''})
                            </span>
                        )}
                    </div>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-4 rounded-3xl hover:bg-slate-800/80 transition-all duration-300 group cursor-default">
                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 group-hover:text-rose-400 transition-colors"><Heart size={12} fill="currentColor" /> Energi</div>
                    <div className="text-2xl font-black text-white font-mono">{Math.round(totals.cals / 1000)}<span className="text-xs text-slate-500 ml-0.5">k</span></div>
                </div>
            </div>

            {/* CHART SECTION */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none group-hover:bg-blue-500/20 transition-all duration-1000" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-1000" />

                <div className="flex flex-wrap items-center justify-between gap-6 mb-8 relative z-10">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                            {(['day', 'week', '2week', 'month'] as Grouping[]).map(g => (
                                <button key={g} onClick={() => setGrouping(g)}
                                    className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${grouping === g ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-500/25' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                                >
                                    {g === 'day' ? 'Dag' : g === 'week' ? 'Vecka' : g === '2week' ? '2V' : 'Månad'}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                            <button onClick={() => setShowTime(!showTime)}
                                className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center gap-2 ${showTime ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            ><Clock size={12} /> Tid</button>
                            <button onClick={() => setShowDist(!showDist)}
                                className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center gap-2 ${showDist ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            ><Footprints size={12} /> KM</button>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                            <button onClick={() => setShowRunning(!showRunning)}
                                className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center gap-2 ${showRunning ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            ><Zap size={12} /> Löp</button>
                            <button onClick={() => setShowOtherCardio(!showOtherCardio)}
                                className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center gap-2 ${showOtherCardio ? 'bg-slate-600 text-white shadow-lg shadow-slate-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            ><Activity size={12} /> Övrigt</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group/toggle" onClick={() => setIsRollingMode(!isRollingMode)}>
                            <div className={`w-10 h-5 rounded-full relative transition-all duration-300 ${isRollingMode ? 'bg-blue-500 shadow-lg shadow-blue-500/30' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-md ${isRollingMode ? 'left-6' : 'left-1'}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-white uppercase tracking-wider">Rullande</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    {grouping === 'week' ? 'Sista 7 dgr' : grouping === '2week' ? 'Sista 14 dgr' : grouping === 'month' ? 'Sista 30 dgr' : 'Sista dagen'}
                                </span>
                            </div>
                        </label>

                        <div className="flex items-center gap-4">
                            {showTime && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" /><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tid</span></div>}
                            {showDist && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal-500 shadow-sm shadow-teal-500/50" /><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">KM</span></div>}
                        </div>
                    </div>
                </div>

                <div className="h-64 w-[75%] mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis
                                yAxisId="left"
                                tick={{ fill: '#a855f7', fontSize: 9, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fill: '#14b8a6', fontSize: 9, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    backdropFilter: 'blur(10px)',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                                }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                labelStyle={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}
                                formatter={(value: any, name: string) => {
                                    if (value === null || value === undefined) return ['—', name];
                                    if (name === 'Tid' || name === 'Snitt Tid') return [formatActivityDuration(value), name];
                                    if (name === 'Distans' || name === 'Snitt KM') return [`${Number(value).toFixed(1)} km`, name];
                                    return [value, name];
                                }}
                            />
                             {weeklyGoal && showDist && grouping === 'week' && (
                                <ReferenceLine
                                    y={weeklyGoal}
                                    yAxisId="right"
                                    stroke="#14b8a6"
                                    strokeDasharray="10 10"
                                    strokeWidth={2}
                                    label={{ 
                                        value: `MÅL: ${weeklyGoal}k`, 
                                        position: 'right', 
                                        fill: '#14b8a6', 
                                        fontSize: 10, 
                                        fontWeight: 900,
                                        className: 'uppercase tracking-tighter'
                                    }}
                                />
                            )}
                            {boundaries.map((b, i) => (
                                <ReferenceLine
                                    key={i}
                                    x={b.x}
                                    yAxisId="left"
                                    stroke={b.type === 'year' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}
                                    strokeDasharray={b.type === 'year' ? 'none' : '3 3'}
                                    label={{ 
                                        value: b.label, 
                                        position: 'top', 
                                        fill: b.type === 'year' ? '#fff' : '#64748b', 
                                        fontSize: 8, 
                                        fontWeight: 900,
                                        className: 'uppercase'
                                    }}
                                />
                            ))}
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="displayTime"
                                name="Tid"
                                fill="url(#colorTime)"
                                stroke="#a855f7"
                                strokeWidth={2}
                                animationDuration={1500}
                                connectNulls={false}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="displayRollingTime"
                                name="Snitt Tid"
                                stroke="#a855f7"
                                strokeWidth={1}
                                strokeDasharray="5 5"
                                dot={false}
                                animationDuration={1500}
                                connectNulls
                            />
                            <Area
                                yAxisId="right"
                                type="monotone"
                                dataKey="displayDist"
                                name="Distans"
                                fill="url(#colorDist)"
                                stroke="#14b8a6"
                                strokeWidth={2}
                                animationDuration={1500}
                                connectNulls={false}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="displayRollingDist"
                                name="Snitt KM"
                                stroke="#14b8a6"
                                strokeWidth={1}
                                strokeDasharray="5 5"
                                dot={false}
                                animationDuration={1500}
                                connectNulls
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* TABLE SECTION */}
            {groupedStats.length > 0 && (
                <div className="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-[10px]">
                        <thead>
                            <tr className="bg-white/5 text-slate-500 uppercase font-black tracking-widest">
                                <th className="py-2.5 px-6">Period</th>
                                <th className="py-2.5 px-4 text-purple-400">Tid</th>
                                <th className="py-2.5 px-4 text-teal-400">Distans</th>
                                <th className="py-2.5 px-4 text-slate-400">Snitt (4p)</th>
                                <th className="py-2.5 px-4 text-right pr-6">Pass</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {groupedStats.slice().reverse().map((w) => (
                                <tr key={w.key} className={`hover:bg-white/5 transition-colors ${w.isCurrent ? 'bg-white/[0.02]' : ''}`}>
                                    <td className="py-2 px-6 font-bold text-white opacity-60">
                                        {w.label}
                                        {w.isCurrent && <span className="ml-2 text-[7px] font-bold text-amber-500 uppercase">Pågående</span>}
                                    </td>
                                    <td className="py-2 px-4 font-black text-white">{formatActivityDuration(w.totalTime)}</td>
                                    <td className="py-2 px-4 font-mono font-black text-teal-500">{w.totalDist.toFixed(1)} km</td>
                                    <td className="py-2 px-4 text-slate-500 italic text-[9px]">{formatActivityDuration(w.rollingTime)} / {w.rollingDist}k</td>
                                    <td className="py-2 px-4 pr-6 text-right font-bold text-slate-400">{w.count}x</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
