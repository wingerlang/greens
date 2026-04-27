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
    Heart
} from 'lucide-react';
import { formatActivityDuration } from '../../utils/durationFormatter.ts';

interface CardioVolumeDashboardProps {
    exercises: ExerciseEntry[];
    universalActivities: UniversalActivity[];
}

type Grouping = 'day' | 'rolling7' | 'week' | '2week' | 'month';

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

export function CardioVolumeDashboard({ exercises, universalActivities }: CardioVolumeDashboardProps) {
    const [grouping, setGrouping] = useState<Grouping>('week');
    const [showTime, setShowTime] = useState(true);
    const [showDist, setShowDist] = useState(true);
    const [showRunning, setShowRunning] = useState(true);
    const [showOtherCardio, setShowOtherCardio] = useState(true);
    const [rollingOnly, setRollingOnly] = useState(false);

    // Classify activity type
    const isRunning = (type: string) => {
        const t = type.toLowerCase();
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

    // Check if current period is incomplete (today falls within it)
    const isCurrentPeriod = (groupKey: string, groupingType: Grouping): boolean => {
        const now = new Date();
        if (groupingType === 'day') {
            return groupKey === now.toISOString().split('T')[0];
        } else if (groupingType === 'week') {
            const monday = getMondayOfWeek(now);
            return groupKey === monday.toISOString().split('T')[0];
        } else if (groupingType === '2week') {
            const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000);
            const biWeekIndex = Math.floor(dayOfYear / 14);
            return groupKey === `${now.getFullYear()}-2W${biWeekIndex}`;
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
            isCurrent: boolean;
        }> = {};

        cardioData.forEach(e => {
            const d = new Date(e.date);
            if (isNaN(d.getTime())) return;

            let groupKey = '';
            let groupLabel = '';

            if (grouping === 'day') {
                groupKey = e.date;
                groupLabel = `${d.getDate()}/${d.getMonth() + 1}`;
            } else if (grouping === 'week') {
                const monday = getMondayOfWeek(d);
                groupKey = monday.toISOString().split('T')[0];
                const wn = getISOWeekNumber(d);
                groupLabel = `V${wn}`;
            } else if (grouping === '2week') {
                // Pair up ISO weeks: V1-2, V3-4, V5-6, etc.
                const wn = getISOWeekNumber(d);
                const pairIndex = Math.ceil(wn / 2);
                const w1 = (pairIndex - 1) * 2 + 1;
                const w2 = w1 + 1;
                groupKey = `${d.getFullYear()}-2W${pairIndex}`;
                groupLabel = `V${w1}-${w2}`;
            } else if (grouping === 'month') {
                groupKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                const monthName = d.toLocaleString('sv-SE', { month: 'short' });
                groupLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`;
            } else if (grouping === 'rolling7') {
                groupKey = e.date;
                groupLabel = `${d.getDate()}/${d.getMonth() + 1}`;
            }

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    key: groupKey, label: groupLabel,
                    totalTime: 0, totalDist: 0, totalCals: 0, count: 0,
                    hrSum: 0, hrCount: 0,
                    isCurrent: isCurrentPeriod(groupKey, grouping)
                };
            }

            groups[groupKey].totalTime += Number(e.durationMinutes || 0);
            groups[groupKey].totalDist += Number(e.distance || 0);
            groups[groupKey].totalCals += Number(e.caloriesBurned || 0);
            groups[groupKey].count++;
            const hr = Number(e.heartRateAvg || 0);
            if (hr > 0) { groups[groupKey].hrSum += hr; groups[groupKey].hrCount++; }
        });

        const sorted = Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));

        if (grouping === 'rolling7') {
            // For rolling 7, we need to fill gaps and calculate 7-day sums
            const allDays: Record<string, typeof sorted[0]> = {};
            sorted.forEach(s => { allDays[s.key] = s; });

            const firstDate = new Date(sorted[0].key);
            const lastDate = new Date(sorted[sorted.length - 1].key);
            const result: any[] = [];

            for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                const window: typeof sorted = [];
                for (let i = 0; i < 7; i++) {
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

        return sorted.map((g, i, arr) => {
            // Rolling average excludes current incomplete period
            const completedBefore = arr.slice(0, i).filter(x => !x.isCurrent);
            const win = completedBefore.slice(-4);
            const rollingTime = win.length > 0 ? Math.round(win.reduce((s, c) => s + c.totalTime, 0) / win.length) : g.totalTime;
            const rollingDist = win.length > 0 ? Math.round(win.reduce((s, c) => s + c.totalDist, 0) / win.length * 10) / 10 : g.totalDist;

            return {
                ...g,
                avgHr: g.hrCount > 0 ? Math.round(g.hrSum / g.hrCount) : null,
                rollingTime,
                rollingDist,
                label: g.isCurrent ? `${g.label}*` : g.label
            };
        });
    }, [cardioData, grouping]);

    // Build chart data: control visibility via null values
    const chartData = useMemo(() => {
        return groupedStats.map(g => ({
            ...g,
            displayTime: showTime && !rollingOnly ? g.totalTime : null,
            displayDist: showDist && !rollingOnly ? g.totalDist : null,
            displayRollingTime: showTime ? g.rollingTime : null,
            displayRollingDist: showDist ? g.rollingDist : null,
        }));
    }, [groupedStats, showTime, showDist, rollingOnly]);

    const totals = useMemo(() => {
        // For rolling 7, totals are misleading if we sum the window sums, so use raw filtered data
        if (grouping === 'rolling7') {
            return cardioData.reduce((acc, e) => ({
                time: acc.time + Number(e.durationMinutes || 0),
                dist: acc.dist + Number(e.distance || 0),
                cals: acc.cals + Number(e.caloriesBurned || 0),
                count: acc.count + 1
            }), { time: 0, dist: 0, cals: 0, count: 0 });
        }
        return groupedStats.reduce((acc, w) => ({
            time: acc.time + w.totalTime,
            dist: acc.dist + w.totalDist,
            cals: acc.cals + w.totalCals,
            count: acc.count + w.count
        }), { time: 0, dist: 0, cals: 0, count: 0 });
    }, [groupedStats, cardioData, grouping]);

    // Calculate boundary markers (month/year changes)
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={10} /> Tid</div>
                    <div className="text-xl font-black text-white font-mono">{Math.floor(totals.time / 60)}<span className="text-xs text-slate-500 ml-0.5">h</span></div>
                </div>
                <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Footprints size={10} /> Distans</div>
                    <div className="text-xl font-black text-white font-mono">{totals.dist.toFixed(0)}<span className="text-xs text-slate-500 ml-0.5">km</span></div>
                </div>
                <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={10} /> Snitt/p</div>
                    <div className="text-xl font-black text-white font-mono">{(totals.dist / (groupedStats.length || 1)).toFixed(1)}<span className="text-xs text-slate-500 ml-0.5">km</span></div>
                </div>
                <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Waves size={10} /> Pass</div>
                    <div className="text-xl font-black text-white font-mono">{totals.count}<span className="text-xs text-slate-500 ml-0.5">x</span></div>
                </div>
                <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl">
                    <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-1">🔥 Energi</div>
                    <div className="text-xl font-black text-white font-mono">{Math.round(totals.cals / 1000)}<span className="text-xs text-slate-500 ml-0.5">k</span></div>
                </div>
            </div>

            {/* CHART SECTION */}
            <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                <div className="flex flex-wrap items-center gap-4 mb-6">
                    {/* Grouping */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
                        {(['day', 'rolling7', 'week', '2week', 'month'] as Grouping[]).map(g => (
                            <button key={g} onClick={() => setGrouping(g)}
                                className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${grouping === g ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                {g === 'day' ? 'Dag' : g === 'rolling7' ? '7d' : g === 'week' ? 'Vecka' : g === '2week' ? '2 Veckor' : 'Månad'}
                            </button>
                        ))}
                    </div>

                    {/* Metric Toggles */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
                        <button onClick={() => setShowTime(!showTime)}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${showTime ? 'bg-sky-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >Tid</button>
                        <button onClick={() => setShowDist(!showDist)}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${showDist ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >KM</button>
                    </div>

                    {/* Activity Type Toggles */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
                        <button onClick={() => { if (showOtherCardio) setShowRunning(!showRunning); else setShowRunning(!showRunning); }}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${showRunning ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >🏃 Löp</button>
                        <button onClick={() => { if (showRunning) setShowOtherCardio(!showOtherCardio); else setShowOtherCardio(!showOtherCardio); }}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${showOtherCardio ? 'bg-violet-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >🚴 Övrigt</button>
                    </div>

                    {/* Rolling Only Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setRollingOnly(!rollingOnly)}>
                        <div className={`w-8 h-4 rounded-full relative transition-all ${rollingOnly ? 'bg-amber-500' : 'bg-slate-700'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${rollingOnly ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300">Visa Snitt</span>
                    </label>

                    {/* Legend */}
                    <div className="flex items-center gap-4 ml-auto">
                        {showTime && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-sky-500" /><span className="text-[8px] font-black text-slate-500 uppercase">Tid</span></div>}
                        {showDist && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[8px] font-black text-slate-500 uppercase">KM</span></div>}
                        <div className="flex items-center gap-1.5"><div className="w-4 h-0 border-t border-dashed border-slate-500" /><span className="text-[8px] font-black text-slate-500 uppercase">Snitt 4p</span></div>
                        <div className="text-[7px] font-bold text-slate-600">* = pågående</div>
                    </div>
                </div>

                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
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
                                tick={{ fill: '#0ea5e9', fontSize: 9, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fill: '#10b981', fontSize: 9, fontWeight: 700 }}
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
                                stroke="#0ea5e9"
                                strokeWidth={2}
                                animationDuration={1500}
                                connectNulls={false}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="displayRollingTime"
                                name="Snitt Tid"
                                stroke="#0ea5e9"
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
                                stroke="#10b981"
                                strokeWidth={2}
                                animationDuration={1500}
                                connectNulls={false}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="displayRollingDist"
                                name="Snitt KM"
                                stroke="#10b981"
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
                                <th className="p-4 pl-6">Period</th>
                                <th className="p-4 text-sky-500">Tid</th>
                                <th className="p-4 text-emerald-500">Distans</th>
                                <th className="p-4 text-slate-400">Snitt (4p)</th>
                                <th className="p-4 text-right pr-6">Pass</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {groupedStats.slice().reverse().map((w) => (
                                <tr key={w.key} className={`hover:bg-white/5 transition-colors ${w.isCurrent ? 'bg-white/[0.02]' : ''}`}>
                                    <td className="p-4 pl-6 font-bold text-white opacity-60">
                                        {w.label}
                                        {w.isCurrent && <span className="ml-2 text-[7px] font-bold text-amber-500 uppercase">Pågående</span>}
                                    </td>
                                    <td className="p-4 font-black text-white">{formatActivityDuration(w.totalTime)}</td>
                                    <td className="p-4 font-mono font-black text-emerald-500">{w.totalDist.toFixed(1)} km</td>
                                    <td className="p-4 text-slate-500 italic">{formatActivityDuration(w.rollingTime)} / {w.rollingDist}k</td>
                                    <td className="p-4 pr-6 text-right font-bold text-slate-400">{w.count}x</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
