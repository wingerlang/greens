import React, { useState, useMemo } from 'react';
import { ExerciseEntry, UniversalActivity, PlannedActivity, generateId } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';
import { formatActivityDuration } from '../../utils/formatters.ts';
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
import { Calendar, Plus, Trophy, Clock, X } from 'lucide-react';

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
    const { plannedActivities, savePlannedActivities, deletePlannedActivity } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [selectedActivity, setSelectedActivity] = useState<ExerciseEntry | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // --- Planned Races ---
    const upcomingRaces = useMemo(() => {
        return plannedActivities
            .filter(a => (a.isRace || a.category === 'RACE' || (a.title && a.title.toLowerCase().includes('tävling'))) && a.status !== 'COMPLETED')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [plannedActivities]);

    const getDaysUntil = (dateStr: string) => {
        const diff = new Date(dateStr).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    // --- History Races ---
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

        // Group by year for chart
        const grouped: Record<string, number> = {};
        races.forEach(r => {
            const year = r.date.substring(0, 4);
            grouped[year] = (grouped[year] || 0) + 1;
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

    const calcPace = (distValues: number | undefined, minutes: number) => {
        if (!distValues || distValues <= 0) return '-';
        const paceDec = minutes / distValues;
        const pMin = Math.floor(paceDec);
        const pSec = Math.round((paceDec - pMin) * 60);
        // Fix rounding error (60s -> +1 min)
        if (pSec === 60) return `${pMin + 1}:00/km`;
        return `${pMin}:${pSec.toString().padStart(2, '0')}/km`;
    };

    const selectedUniversal = selectedActivity
        ? universalActivities.find(u => u.id === selectedActivity.id)
        : undefined;

    return (
        <div className="space-y-8">
            {/* Upcoming Races Section */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Trophy className="text-amber-400" size={20} />
                            Kommande Tävlingar
                        </h3>
                        <p className="text-slate-400 text-sm">Dina planerade lopp och utmaningar.</p>
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                        <Plus size={16} /> Planera Tävling
                    </button>
                </div>

                {upcomingRaces.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                        {upcomingRaces.map(race => {
                            const daysLeft = getDaysUntil(race.date);
                            return (
                                <div key={race.id} className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 relative group hover:border-amber-500/60 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                            {race.category === 'RACE' ? 'Race' : 'Tävling'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold ${daysLeft < 7 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {daysLeft} dagar kvar
                                            </span>
                                            <button
                                                onClick={() => deletePlannedActivity(race.id)}
                                                className="text-slate-600 hover:text-rose-500 transition-colors"
                                                title="Ta bort"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-bold text-white mb-1">{race.title}</h4>
                                    <div className="flex flex-wrap gap-3 text-sm text-slate-400 mb-3">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {race.date}</span>
                                        {race.estimatedDistance > 0 && <span className="flex items-center gap-1">📏 {race.estimatedDistance} km</span>}
                                    </div>
                                    {race.description && (
                                        <p className="text-xs text-slate-500 line-clamp-2 italic border-l-2 border-slate-700 pl-2 mb-2">
                                            {race.description}
                                        </p>
                                    )}
                                    {race.raceUrl && (
                                        <a
                                            href={race.raceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                                        >
                                            🔗 Tävlingsinfo
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-dashed border-white/10 relative z-10">
                        <Trophy className="mx-auto text-slate-600 mb-2 opacity-50" size={32} />
                        <p className="text-slate-500 text-sm">Inga inplanerade tävlingar än.</p>
                    </div>
                )}

                {/* Decorative BG */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            </div>

            {/* History Section */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            📜 Historik & Resultat
                            <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">
                                {races.length} st
                            </span>
                        </h3>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                        <input
                            type="text"
                            placeholder="Sök i historik..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-slate-950/50 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-48"
                        />
                    </div>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl text-center">
                            <div className="text-2xl font-black text-amber-400">{stats.count}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-500">Lopp</div>
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
                        <div className="absolute top-2 left-4 text-[9px] font-black text-slate-600 uppercase tracking-widest z-10">Tävlingar per år</div>
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
                        <p>Inga genomförda tävlingar hittades för vald period.</p>
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
                                            {formatActivityDuration(race.durationMinutes)}
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
            </div>

            {selectedActivity && (
                <ActivityDetailModal
                    activity={{ ...selectedActivity, source: 'strava' }}
                    universalActivity={selectedUniversal}
                    onClose={() => setSelectedActivity(null)}
                />
            )}

            {isAddModalOpen && (
                <AddRaceModal onClose={() => setIsAddModalOpen(false)} onSave={savePlannedActivities} />
            )}
        </div>
    );
}

function AddRaceModal({ onClose, onSave }: { onClose: () => void, onSave: (activities: PlannedActivity[]) => void }) {
    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        distance: '',
        url: '',
        description: ''
    });

    const handleSubmit = () => {
        if (!form.title || !form.date) return;

        const newActivity: PlannedActivity = {
            id: generateId(),
            title: form.title,
            date: form.date,
            type: 'RUN', // Default
            category: 'RACE' as any, // Or just rely on isRace
            isRace: true,
            raceUrl: form.url,
            description: form.description,
            estimatedDistance: parseFloat(form.distance) || 0,
            status: 'PLANNED',
            structure: {
                warmupKm: 0,
                mainSet: [],
                cooldownKm: 0
            },
            targetPace: '',
            targetHrZone: 0
        };

        onSave([newActivity]);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Planera Ny Tävling</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Namn</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                            placeholder="t.ex. Göteborgsvarvet 2025"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Datum</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distans (km)</label>
                            <input
                                type="number"
                                value={form.distance}
                                onChange={e => setForm({ ...form, distance: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                placeholder="21.1"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Länk / URL (Valfritt)</label>
                        <input
                            type="url"
                            value={form.url}
                            onChange={e => setForm({ ...form, url: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                            placeholder="https://..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Beskrivning / Mål</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none h-24 resize-none"
                            placeholder="Måltid, strategi..."
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!form.title}
                            className="flex-1 py-3 rounded-xl bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition-colors disabled:opacity-50"
                        >
                            Spara Tävling
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
