import React, { useState, useMemo } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { ActivityDetailModal } from '../activities/ActivityDetailModal.tsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';

interface RaceListProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
    filterStartDate?: string | null;
    filterEndDate?: string | null;
}

export function RaceList({
    exerciseEntries = [],
    universalActivities = [],
    filterStartDate,
    filterEndDate
}: RaceListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [selectedActivity, setSelectedActivity] = useState<ExerciseEntry | null>(null);

    // 1. Filter races & Search & Period
    const races = useMemo(() => {
        let items = exerciseEntries.filter(e => e.subType === 'race');

        // Apply Global Filter
        if (filterStartDate) items = items.filter(r => r.date >= filterStartDate);
        if (filterEndDate) items = items.filter(r => r.date <= filterEndDate);

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(r =>
                r.notes?.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q)
            );
        }

        return items.sort((a, b) => {
            let valA: any = a[sortConfig.key as keyof ExerciseEntry];
            let valB: any = b[sortConfig.key as keyof ExerciseEntry];

            if (valA === undefined) valA = 0;
            if (valB === undefined) valB = 0;

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [exerciseEntries, searchQuery, sortConfig, filterStartDate, filterEndDate]);

    // Statistics Calculation
    const stats = useMemo(() => {
        const totalDistance = races.reduce((sum, r) => sum + (r.distance || 0), 0);
        const totalMinutes = races.reduce((sum, r) => sum + r.durationMinutes, 0);

        // Group by month/year for chart
        const grouped: Record<string, number> = {};
        races.forEach(r => {
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            grouped[key] = (grouped[key] || 0) + 1;
        });

        const chartData = Object.entries(grouped)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            totalDistance,
            totalMinutes,
            count: races.length,
            chartData
        };
    }, [races]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const SortIcon = ({ colKey }: { colKey: string }) => {
        if (sortConfig.key !== colKey) return <span className="opacity-20 ml-1">⇅</span>;
        return <span className="text-emerald-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const fmtDur = (m: number) => {
        const h = Math.floor(m / 60);
        const min = m % 60;
        if (h === 0) return `${min} m`;
        return `${h}h ${min} m`;
    };

    const calcPace = (distValues: number | undefined, minutes: number) => {
        if (!distValues || distValues <= 0) return '-';
        const paceDec = minutes / distValues;
        const pMin = Math.floor(paceDec);
        const pSec = Math.round((paceDec - pMin) * 60);
        return `${pMin}:${pSec.toString().padStart(2, '0')}/km`;
    };

    const selectedUniversal = selectedActivity
        ? universalActivities.find(u => u.id === selectedActivity.id)
        : undefined;

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        🏆 Tävlingskalender
                        <span className="bg-amber-500/10 text-amber-500 text-xs px-2 py-0.5 rounded-full border border-amber-500/20">
                            {races.length} st
                        </span>
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Din historik av genomförda lopp.</p>
                </div>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="Sök tävling..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-slate-950/50 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-48"
                    />
                </div>
            </div>

            {/* Statistics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl text-center">
                        <div className="text-2xl font-black text-amber-400">{stats.count}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Tävlingar</div>
                    </div>
                    <div className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl text-center">
                        <div className="text-2xl font-black text-white">{stats.totalDistance.toFixed(1)}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Km totalt</div>
                    </div>
                    <div className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl text-center">
                        <div className="text-2xl font-black text-sky-400">{Math.round(stats.totalMinutes / 60)}h</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Tid totalt</div>
                    </div>
                </div>

                <div className="h-24 bg-slate-900/40 rounded-2xl border border-white/5 p-4 relative overflow-hidden">
                    <div className="absolute top-2 left-4 text-[9px] font-black text-slate-600 uppercase tracking-widest z-10">Tävlingar per månad</div>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.chartData} margin={{ top: 10, right: 0, left: -20, bottom: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                                itemStyle={{ color: '#fbbf24' }}
                            />
                            <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {races.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic bg-amber-500/5 rounded-xl border border-amber-500/10">
                    <p>Inga tävlingar hittades för vald period.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-white/5">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-950/80 text-xs uppercase font-bold text-slate-500 border-b border-white/5">
                            <tr>
                                <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Datum <SortIcon colKey="date" /></th>
                                <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort('notes')}>Namn <SortIcon colKey="notes" /></th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('distance')}>Distans <SortIcon colKey="distance" /></th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('durationMinutes')}>Tid <SortIcon colKey="durationMinutes" /></th>
                                <th className="px-4 py-3 text-right">Tempo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {races.map(race => (
                                <tr
                                    key={race.id}
                                    className="hover:bg-amber-500/5 transition-colors cursor-pointer group"
                                    onClick={() => setSelectedActivity(race)}
                                >
                                    <td className="px-4 py-3 font-mono text-slate-300">
                                        {race.date.split('T')[0]}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-white group-hover:text-amber-400 transition-colors">
                                        {race.notes || race.type}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                                        {race.distance ? `${race.distance.toFixed(1)} km` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-amber-300">
                                        {fmtDur(race.durationMinutes)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                                        {calcPace(race.distance, race.durationMinutes)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedActivity && (
                <ActivityDetailModal
                    activity={{ ...selectedActivity, source: 'strava' }}
                    universalActivity={selectedUniversal}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}
