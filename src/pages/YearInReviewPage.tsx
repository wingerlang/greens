import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext.tsx';
import { calculatePerformanceScore } from '../utils/performanceEngine.ts';
import { formatDuration, formatSwedishDate, formatPace } from '../utils/dateUtils.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { WeeklyVolumeChart } from '../components/training/WeeklyVolumeChart.tsx';
import { WeeklyDistanceChart } from '../components/training/WeeklyDistanceChart.tsx';
import { UniversalActivity } from '../models/types.ts';

export function YearInReviewPage() {
    const { universalActivities, strengthSessions } = useData();
    const [selectedActivity, setSelectedActivity] = useState<UniversalActivity | null>(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // 1. Filter Data for the selected year
    const yearlyActivities = useMemo(() => {
        return universalActivities.filter(a => {
            const d = new Date(a.date);
            return d.getFullYear() === selectedYear;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [universalActivities, selectedYear]);

    // 1.1 Filter Strength Sessions for the selected year (Source of Truth for Strength)
    const yearlyStrengthSessions = useMemo(() => {
        return strengthSessions.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === selectedYear;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [strengthSessions, selectedYear]);

    // 2. Aggregate Stats
    const stats = useMemo(() => {
        let totalDist = 0;
        let totalTime = 0;
        let totalCals = 0;
        let totalSessions = yearlyActivities.length;
        let totalScore = 0;
        let scoreCount = 0;
        let totalPRs = 0;
        let runningPRs = 0;
        let strengthPRs = 0;
        let activeDays = new Set<string>();

        // Type Breakdown
        const typeMap = new Map<string, { count: number, time: number, dist: number }>();

        // Consistency
        let longestGap = 0;
        let lastDate: Date | null = null;

        yearlyActivities.forEach(a => {
            const dist = a.performance?.distanceKm || 0;
            const time = a.performance?.durationMinutes || 0;
            const cals = a.performance?.calories || 0;
            const score = calculatePerformanceScore({ ...a, durationMinutes: time, distance: dist, type: a.performance?.activityType } as any);
            const prs = a.performance?.prCount || 0;

            totalDist += dist;
            totalTime += time;
            totalCals += cals;
            totalPRs += prs;
            activeDays.add(a.date.split('T')[0]);

            const type = a.performance?.activityType || 'other';

            if (prs > 0) {
                if (type === 'running') runningPRs += prs;
                else if (type === 'strength') strengthPRs += prs;
            }

            if (score > 0) {
                totalScore += score;
                scoreCount++;
            }

            const curr = typeMap.get(type) || { count: 0, time: 0, dist: 0 };
            typeMap.set(type, {
                count: curr.count + 1,
                time: curr.time + time,
                dist: curr.dist + dist
            });

            // Gap Calculation
            const currentDate = new Date(a.date);
            if (lastDate) {
                const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > longestGap) {
                    longestGap = diffDays;
                }
            }
            lastDate = currentDate;
        });

        // Strength Specifics (using strengthSessions)
        let bestLift = { weight: 0, exercise: '', activity: null as UniversalActivity | null };
        let maxVolumeSession: any = null; // Use StrengthWorkout type effectively

        yearlyStrengthSessions.forEach(s => {
            // Find Best Lift
            s.exercises.forEach(e => {
                e.sets.forEach(set => {
                    const weight = set.weight || 0;
                    if (weight > bestLift.weight) {
                        bestLift = {
                            weight: weight,
                            exercise: e.exerciseName,
                            activity: {
                                id: s.id,
                                date: s.date,
                                source: 'strength',
                                performance: { activityType: 'strength' }
                            } as any
                        };
                    }
                });
            });

            // Find Max Volume Session
            if (!maxVolumeSession || (s.totalVolume || 0) > (maxVolumeSession.totalVolume || 0)) {
                maxVolumeSession = s;
            }
        });

        // Highlights
        const longestRun = yearlyActivities
            .filter(a => a.performance?.activityType === 'running')
            .sort((a, b) => (b.performance?.distanceKm || 0) - (a.performance?.distanceKm || 0))[0];

        const fastestRun = yearlyActivities
            .filter(a => a.performance?.activityType === 'running' && (a.performance?.distanceKm || 0) > 5) // Min 5km for pace record
            .sort((a, b) => {
                const paceA = (a.performance?.durationMinutes || 0) / (a.performance?.distanceKm || 1);
                const paceB = (b.performance?.durationMinutes || 0) / (b.performance?.distanceKm || 1);
                return paceA - paceB;
            })[0];

        const maxScore = yearlyActivities.reduce((max, a) => {
            const s = calculatePerformanceScore({ ...a, durationMinutes: a.performance?.durationMinutes || 0, distance: a.performance?.distanceKm } as any);
            return s > max.score ? { activity: a, score: s } : max;
        }, { activity: null as UniversalActivity | null, score: 0 });

        // Calculate Total Tonnage
        const totalTonnage = yearlyStrengthSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);

        return {
            totalDist,
            totalTime,
            totalCals,
            totalSessions,
            totalPRs,
            runningPRs,
            strengthPRs,
            avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
            activeDays: activeDays.size,
            types: Array.from(typeMap.entries()).map(([k, v]) => ({ name: k, ...v })),
            longestRun,
            fastestRun,
            maxScore,
            maxVolume: maxVolumeSession,
            bestLift,
            longestGap,
            totalTonnage
        };
    }, [yearlyActivities, yearlyStrengthSessions]);

    // 3. Monthly Breakdown Data
    const monthlyData = useMemo(() => {
        const months = Array(12).fill(0).map((_, i) => ({
            name: new Date(selectedYear, i, 1).toLocaleString('sv-SE', { month: 'short' }).replace('.', ''),
            fullDate: new Date(selectedYear, i, 1),
            dist: 0,
            time: 0,
            cals: 0,
            count: 0
        }));

        yearlyActivities.forEach(a => {
            const m = new Date(a.date).getMonth();
            if (months[m]) {
                months[m].dist += (a.performance?.distanceKm || 0);
                months[m].time += (a.performance?.durationMinutes || 0);
                months[m].cals += (a.performance?.calories || 0);
                months[m].count += 1;
            }
        });
        return months;
    }, [yearlyActivities, selectedYear]);

    // 4. Weekly Running Pace Data
    const weeklyPaceData = useMemo(() => {
        const weeks = new Map<number, { totalTime: number, totalDist: number }>();

        yearlyActivities.forEach(a => {
            if (a.performance?.activityType === 'running' && (a.performance.distanceKm || 0) > 0) {
                const d = new Date(a.date);
                // Simple week number calc
                const onejan = new Date(d.getFullYear(), 0, 1);
                const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);

                const curr = weeks.get(week) || { totalTime: 0, totalDist: 0 };
                weeks.set(week, {
                    totalTime: curr.totalTime + (a.performance.durationMinutes || 0),
                    totalDist: curr.totalDist + (a.performance.distanceKm || 0)
                });
            }
        });

        // Fill gaps 1-52
        return Array.from({ length: 52 }, (_, i) => {
            const week = i + 1;
            const data = weeks.get(week);
            if (!data || data.totalDist === 0) return { week, pace: null }; // Null for gaps
            return { week, pace: data.totalTime / data.totalDist }; // min/km
        });
    }, [yearlyActivities]);

    // 5. Avg Session Length per Week
    const avgSessionLengthData = useMemo(() => {
        const weeks = new Map<number, { totalTime: number, count: number }>();

        yearlyActivities.forEach(a => {
            const d = new Date(a.date);
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);

            const curr = weeks.get(week) || { totalTime: 0, count: 0 };
            weeks.set(week, {
                totalTime: curr.totalTime + (a.performance?.durationMinutes || 0),
                count: curr.count + 1
            });
        });

        return Array.from({ length: 52 }, (_, i) => {
            const week = i + 1;
            const data = weeks.get(week);
            if (!data || data.count === 0) return { week, avgDuration: 0 };
            return { week, avgDuration: Math.round(data.totalTime / data.count) };
        });
    }, [yearlyActivities]);

    // Strength Workouts for Volume Chart - Use direct source
    const strengthWorkoutsForChart = yearlyStrengthSessions;

    // 6. Heatmap Data (Calendar Grid)
    const calendarGrid = useMemo(() => {
        const start = new Date(selectedYear, 0, 1);
        const end = new Date(selectedYear, 11, 31);
        const days = [];
        let current = new Date(start);

        const activityMap = new Map();
        yearlyActivities.forEach(a => {
            const date = a.date.split('T')[0];
            const existing = activityMap.get(date) || 0;
            activityMap.set(date, existing + (a.performance?.durationMinutes || 0));
        });

        while (current <= end) {
            const iso = current.toISOString().split('T')[0];
            days.push({
                date: iso,
                minutes: activityMap.get(iso) || 0,
                dayOfWeek: current.getDay()
            });
            current.setDate(current.getDate() + 1);
        }
        return days;
    }, [yearlyActivities, selectedYear]);

    // Type Colors
    const COLORS = {
        running: '#10b981', // emerald-500
        cycling: '#06b6d4', // cyan-500
        strength: '#8b5cf6', // violet-500
        walking: '#f59e0b', // amber-500
        other: '#64748b'    // slate-500
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {selectedYear}
                    </h1>
                    <p className="text-slate-400 uppercase tracking-widest font-bold mt-2">Annual Performance Review</p>
                </div>

                <div className="flex gap-2">
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="bg-slate-900 border border-white/10 text-white font-bold rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                    >
                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </header>

            {/* HERO STATS */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">🏃</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Distans</p>
                    <p className="text-3xl font-black text-white">
                        {Math.round(stats.totalDist).toLocaleString()} <span className="text-lg text-emerald-400">km</span>
                    </p>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">⏱️</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Tid</p>
                    <p className="text-3xl font-black text-white">
                        {Math.round(stats.totalTime / 60).toLocaleString()} <span className="text-lg text-cyan-400">h</span>
                    </p>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">💪</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Muskelvolym</p>
                    <p className="text-3xl font-black text-white">
                        {Math.round(stats.totalTonnage / 1000).toLocaleString()} <span className="text-lg text-purple-400">ton</span>
                    </p>
                </div>

                {/* PR Split Card */}
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">🏆</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Satta PRs</p>
                    <div className="flex gap-4">
                        <div>
                            <p className="text-2xl font-black text-white">{stats.runningPRs}</p>
                            <p className="text-[10px] text-emerald-400 font-bold uppercase">Löpning</p>
                        </div>
                        <div className="w-[1px] bg-white/10"></div>
                        <div>
                            <p className="text-2xl font-black text-white">{stats.strengthPRs}</p>
                            <p className="text-[10px] text-purple-400 font-bold uppercase">Styrka</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">📊</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Antal Pass</p>
                    <p className="text-3xl font-black text-white">
                        {stats.totalSessions} <span className="text-lg text-indigo-400">st</span>
                    </p>
                </div>
            </div>

            {/* MAIN CHART SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Monthly Progress Chart */}
                <div className="lg:col-span-2 bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>📈</span> Årsutveckling & Volym
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="dist" stroke="#10b981" fontSize={12} tickLine={false} axisLine={false} unit="km" />
                                <YAxis yAxisId="time" orientation="right" stroke="#6366f1" fontSize={12} tickLine={false} axisLine={false} unit="h" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    formatter={(value: any, name: string) => [
                                        name === 'dist' ? `${Math.round(value)} km` : `${Math.round(value)} h`,
                                        name === 'dist' ? 'Distans' : 'Tid'
                                    ]}
                                    labelStyle={{ color: '#cbd5e1' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar yAxisId="dist" name="Distans (km)" dataKey="dist" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar yAxisId="time" name="Tid (h)" dataKey={(d) => d.time / 60} fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Distribution */}
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2 w-full">
                        <span>🍰</span> Fördelning
                    </h3>
                    <div className="w-full h-64 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.types}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                >
                                    {stats.types.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name.toLowerCase()] || COLORS.other} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }}
                                    formatter={(val: number) => [`${val} pass`, '']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-3xl font-black text-white">{Math.round(stats.totalTime / 60)}</span>
                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest">Timmar</span>
                        </div>
                    </div>
                    <div className="w-full space-y-2 mt-4">
                        {stats.types.sort((a, b) => b.count - a.count).slice(0, 4).map(t => (
                            <div key={t.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (COLORS as any)[t.name.toLowerCase()] || COLORS.other }}></div>
                                    <span className="capitalize text-slate-300">{t.name}</span>
                                </div>
                                <span className="font-bold text-slate-400">{t.count} ({Math.round(t.count / stats.totalSessions * 100)}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* NEW: Weekly Volume Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Strength Volume */}
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>💪</span> Volym per vecka (Styrka)
                    </h3>
                    <div className="w-full">
                        <WeeklyVolumeChart workouts={strengthWorkoutsForChart} fixedYear={selectedYear} />
                    </div>
                </div>

                {/* Running Distance */}
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>🏃</span> Distans per vecka (Löpning)
                    </h3>
                    <div className="w-full">
                        <WeeklyDistanceChart activities={yearlyActivities} fixedYear={selectedYear} />
                    </div>
                </div>
            </div>

            {/* Running Deep Dive: Weekly Pace & Session Length */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>⚡</span> Snitthastighet per vecka (Löpning)
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weeklyPaceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                                <XAxis dataKey="week" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis
                                    stroke="#10b981"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                    reversed={true}
                                    tickFormatter={(val) => `${Math.floor(val)}:${Math.round((val % 1) * 60).toString().padStart(2, '0')}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    formatter={(val: number) => [formatPace(val), 'Snittempo']}
                                    labelFormatter={(label) => `Vecka ${label}`}
                                />
                                <Line type="monotone" dataKey="pace" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>⏳</span> Genomsnittlig passlängd per vecka
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={avgSessionLengthData}>
                                <defs>
                                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                                <XAxis dataKey="week" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6366f1" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    formatter={(val: number) => [`${val} min`, 'Snittlängd']}
                                    labelFormatter={(label) => `Vecka ${label}`}
                                />
                                <Area type="monotone" dataKey="avgDuration" stroke="#6366f1" fillOpacity={1} fill="url(#colorDuration)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* HIGHLIGHTS CARDS */}
            <div>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span>🏆</span> Årets Höjdpunkter
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Longest Run */}
                    {stats.longestRun && (
                        <div
                            className="bg-gradient-to-br from-emerald-900/20 to-slate-900 border border-emerald-500/20 p-6 rounded-3xl cursor-pointer hover:border-emerald-500/50 transition-all group"
                            onClick={() => setSelectedActivity(stats.longestRun)}
                        >
                            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Längsta Löpning</p>
                            <p className="text-4xl font-black text-white mb-1 group-hover:scale-105 transition-transform origin-left">
                                {stats.longestRun.performance?.distanceKm?.toFixed(1)} km
                            </p>
                            <p className="text-slate-500 text-sm">{formatSwedishDate(stats.longestRun.date)}</p>
                        </div>
                    )}

                    {/* Fastest Run */}
                    {stats.fastestRun && (
                        <div
                            className="bg-gradient-to-br from-cyan-900/20 to-slate-900 border border-cyan-500/20 p-6 rounded-3xl cursor-pointer hover:border-cyan-500/50 transition-all group"
                            onClick={() => setSelectedActivity(stats.fastestRun)}
                        >
                            <p className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">Snabbaste Tempot ({'>'}5km)</p>
                            <p className="text-4xl font-black text-white mb-1 group-hover:scale-105 transition-transform origin-left">
                                {formatPace((stats.fastestRun.performance?.durationMinutes! * 60) / stats.fastestRun.performance?.distanceKm!)} <span className="text-lg text-slate-500">min/km</span>
                            </p>
                            <p className="text-slate-500 text-sm">{formatSwedishDate(stats.fastestRun.date)} • {stats.fastestRun.performance?.distanceKm?.toFixed(1)} km</p>
                        </div>
                    )}

                    {/* Best Lift - NEW */}
                    {stats.bestLift.weight > 0 && (
                        <div
                            className="bg-gradient-to-br from-purple-900/20 to-slate-900 border border-purple-500/20 p-6 rounded-3xl cursor-pointer hover:border-purple-500/50 transition-all group"
                        >
                            <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Tyngsta Lyftet</p>
                            <p className="text-3xl font-black text-white mb-1 group-hover:scale-105 transition-transform origin-left truncate" title={stats.bestLift.exercise}>
                                {stats.bestLift.exercise}
                            </p>
                            <p className="text-4xl font-black text-white">
                                {stats.bestLift.weight} <span className="text-lg text-slate-500">kg</span>
                            </p>
                        </div>
                    )}

                    {/* Heaviest Session - Using maxVolume from strengthSessions */}
                    {stats.maxVolume && (
                        <div
                            className="bg-gradient-to-br from-fuchsia-900/20 to-slate-900 border border-fuchsia-500/20 p-6 rounded-3xl cursor-pointer hover:border-fuchsia-500/50 transition-all group"
                            onClick={() => setSelectedActivity(null /* TODO: Open strength workout specific modal or detailed view? */)}
                        >
                            <p className="text-fuchsia-400 text-xs font-bold uppercase tracking-wider mb-2">Största Volympasset</p>
                            <p className="text-4xl font-black text-white mb-1 group-hover:scale-105 transition-transform origin-left">
                                {(stats.maxVolume.totalVolume / 1000).toFixed(1)} <span className="text-lg text-slate-500">ton</span>
                            </p>
                            <p className="text-slate-500 text-sm">Styrketräning • {formatSwedishDate(stats.maxVolume.date)}</p>
                        </div>
                    )}

                    {/* Top Score */}
                    {stats.maxScore.activity && (
                        <div
                            className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 p-6 rounded-3xl cursor-pointer hover:border-indigo-500/50 transition-all group"
                            onClick={() => setSelectedActivity(stats.maxScore.activity)}
                        >
                            <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">Bästa Prestation</p>
                            <p className="text-4xl font-black text-white mb-1 group-hover:scale-105 transition-transform origin-left">
                                {Math.round(stats.maxScore.score)} <span className="text-lg text-slate-500">poäng</span>
                            </p>
                            <p className="text-slate-500 text-sm capitalize">{stats.maxScore.activity.performance?.activityType} • {formatSwedishDate(stats.maxScore.activity.date)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* HEATMAP / CONTRIBUTION GRID */}
            <div>
                <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>🗓️</span> Aktivitetshistorik
                    </h3>
                    <div className="flex gap-4 text-sm text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>🔥</span> <span>Uppehåll: <span className="text-white font-bold">{stats.longestGap} dagar</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>📅</span> <span>Aktiva dagar: <span className="text-white font-bold">{stats.activeDays}</span></span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl overflow-hidden">
                    <div className="flex gap-[3px] overflow-x-auto pb-2">
                        {/* We group by weeks for columns */}
                        {Array.from({ length: 53 }).map((_, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-[3px]">
                                {Array.from({ length: 7 }).map((_, dayIndex) => {
                                    const dayData = calendarGrid[weekIndex * 7 + dayIndex];
                                    if (!dayData) return <div key={dayIndex} className="w-3 h-3 rounded-sm bg-transparent" />;

                                    const intensityClass =
                                        dayData.minutes === 0 ? 'bg-slate-800/50' :
                                            dayData.minutes < 30 ? 'bg-emerald-900' :
                                                dayData.minutes < 60 ? 'bg-emerald-700' :
                                                    dayData.minutes < 90 ? 'bg-emerald-500' :
                                                        'bg-emerald-300'; // Hot

                                    return (
                                        <div
                                            key={dayIndex}
                                            className={`w-3 h-3 rounded-sm ${intensityClass} hover:ring-2 hover:ring-white/50 transition-all`}
                                            title={`${dayData.date}: ${dayData.minutes} min`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal for viewing highlights */}
            {selectedActivity && (
                <ActivityDetailModal
                    activity={{ ...mapUniversalToLegacyEntry(selectedActivity)!, source: (selectedActivity as any).source || 'manual' }}
                    universalActivity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}
