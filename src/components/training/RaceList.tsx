import React, { useState, useMemo, useEffect } from 'react';
import { ExerciseEntry, UniversalActivity, PlannedActivity, generateId, RaceDetails } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';
import { formatActivityDuration } from '../../utils/formatters.ts';
import { ActivityDetailModal } from '../activities/ActivityDetailModal.tsx';
import { RaceSeriesDetailModal } from './RaceSeriesDetailModal.tsx';
import { RaceSeriesManager } from './RaceSeriesManager.tsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';
import {
    Calendar,
    Plus,
    Trophy,
    Clock,
    X,
    MapPin,
    Target,
    CheckSquare,
    Download,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Timer,
    Medal,
    Pencil
} from 'lucide-react';
import { isCompetition } from '../../utils/activityUtils.ts';

interface RaceListProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
    filterStartDate?: string | null;
    filterEndDate?: string | null;
    subTab?: string;
    seriesId?: string;
}

export function RaceList({
    exerciseEntries = [],
    universalActivities = [],
    filterStartDate,
    filterEndDate,
    subTab,
    seriesId
}: RaceListProps) {
    const { plannedActivities, savePlannedActivities, deletePlannedActivity } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [selectedActivity, setSelectedActivity] = useState<ExerciseEntry | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingRace, setEditingRace] = useState<PlannedActivity | null>(null);

    // Initialize view mode based on subTab
    const [viewMode, setViewMode] = useState<'timeline' | 'series'>('timeline');
    const [selectedSeries, setSelectedSeries] = useState<{ name: string, races: ExerciseEntry[] } | null>(null);
    const [seriesSort, setSeriesSort] = useState<'count' | 'name' | 'latest'>('count');

    // Sync Props to State
    useEffect(() => {
        if (subTab === 'serier' || subTab === 'series') {
            setViewMode('series');
        } else {
            setViewMode('timeline');
        }
    }, [subTab]);


    // --- Planned Races ---
    const upcomingRaces = useMemo(() => {
        return plannedActivities
            .filter(a => isCompetition({ plan: a }) && a.status !== 'COMPLETED')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [plannedActivities]);

    const handleSaveRace = (race: PlannedActivity) => {
        const exists = plannedActivities.some(a => a.id === race.id);
        let newList;
        if (exists) {
            newList = plannedActivities.map(a => a.id === race.id ? race : a);
        } else {
            newList = [...plannedActivities, race];
        }
        savePlannedActivities(newList);
        setIsAddModalOpen(false);
        setEditingRace(null);
    };

    const handleEditClick = (race: PlannedActivity) => {
        setEditingRace(race);
        setIsAddModalOpen(true);
    };

    // --- History Races ---
    const races = useMemo(() => {
        let items = exerciseEntries.filter(e => isCompetition(e));


        // Deduplication Logic: Peer-review duplicates on the same day
        // User Preference: "Merged" activities are the master/correct ones.
        const itemsByDate: Record<string, ExerciseEntry[]> = {};

        items.forEach(item => {
            const dateKey = item.date.split('T')[0];
            if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
            itemsByDate[dateKey].push(item);
        });

        let deduplicatedItems: ExerciseEntry[] = [];

        Object.values(itemsByDate).forEach(dayItems => {
            if (dayItems.length === 1) {
                deduplicatedItems.push(dayItems[0]);
                return;
            }

            // Check if we have a "Merged" activity
            const mergedItem = dayItems.find(i =>
                (i.notes || '').includes('Merged from') ||
                (i.title || '').includes('Merged from')
            );

            if (mergedItem) {
                deduplicatedItems.push(mergedItem);
            } else {
                deduplicatedItems.push(...dayItems);
            }
        });

        items = deduplicatedItems;

        if (filterStartDate) items = items.filter(r => r.date >= filterStartDate);
        if (filterEndDate) items = items.filter(r => r.date <= filterEndDate);

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(r =>
                r.notes?.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q) ||
                r.title?.toLowerCase().includes(q) ||
                r.location?.toLowerCase().includes(q)
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

    // --- Grouping Logic ("Series") ---
    const raceSeries = useMemo(() => {
        const groups: Record<string, ExerciseEntry[]> = {};

        // Helper to resolve title (re-use logic)
        const resolveTitle = (r: ExerciseEntry) => {
            // 1. Prefer explicit title if it's not generic
            if (r.title && !r.title.startsWith('Merged')) return r.title;

            // 2. Resolve via UniversalActivity (look for Strava/Component titles)
            const ua = universalActivities.find(u => u.id === r.id);
            if (ua?.mergeInfo?.isMerged && ua.mergeInfo.originalActivityIds?.length) {
                const components = universalActivities.filter(u => ua.mergeInfo!.originalActivityIds!.includes(u.id));
                const bestComp = components.find(c => c.plan?.title && !c.plan.title.startsWith('Merged'));
                if (bestComp) return bestComp.plan?.title || 'Okänd tävling';
            }

            // 3. Fallback to notes/type (often contains "Merged from...")
            return r.notes || r.type || 'Okänd Aktivitet';
        };

        races.forEach(r => {
            const rawTitle = resolveTitle(r);
            // Advanced Normalization Pipeline
            let normalized = rawTitle.toLowerCase();

            // 1. Remove years (YYYY)
            normalized = normalized.replace(/\b(19|20)\d{2}\b/g, '');

            // 2. Remove distances (e.g., 34k, 21km, 1000m, 50 miles)
            normalized = normalized.replace(/\b\d+([,.]\d+)?\s*(km|k|m|mil|miles)\b/g, '');

            // 3. Remove "trailing junk" separators: " - ...", ", ..."
            normalized = normalized.split(/\s+[-–—]\s+/)[0];
            normalized = normalized.split(/,\s+/)[0];

            // 4. Remove emojis and special chars (parentheses, quotes)
            normalized = normalized.replace(/[\u{1F300}-\u{1FAFF}]/gu, '');
            normalized = normalized.replace(/['"()]/g, '');

            // 5. Cleanup whitespace
            normalized = normalized.replace(/\s+/g, ' ').trim();

            // Capitalize for display key
            const key = normalized.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); /* Simple capitalization */

            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });

        return Object.entries(groups)
            .map(([name, groupRaces]) => {
                const pb = groupRaces.reduce((best, curr) => {
                    if (!best) return curr;
                    return curr.durationMinutes < best.durationMinutes ? curr : best;
                }, null as ExerciseEntry | null);

                const avgDuration = groupRaces.reduce((sum, r) => sum + r.durationMinutes, 0) / groupRaces.length;

                return {
                    name,
                    races: groupRaces,
                    stats: {
                        count: groupRaces.length,
                        pb: pb!,
                        avgDuration,
                        years: groupRaces.map(r => r.date.substring(0, 4)).sort()
                    }
                };
            })
            .filter(g => g.races.length > 0)
            .sort((a, b) => {
                if (seriesSort === 'count') return b.races.length - a.races.length;
                if (seriesSort === 'name') return a.name.localeCompare(b.name);
                if (seriesSort === 'latest') {
                    const lastA = a.races.reduce((latest, r) => r.date > latest ? r.date : latest, '');
                    const lastB = b.races.reduce((latest, r) => r.date > latest ? r.date : latest, '');
                    return lastB.localeCompare(lastA);
                }
                return 0;
            });
    }, [races, universalActivities, seriesSort]);

    // Handle Deep Linking to Series
    useEffect(() => {
        if (seriesId && raceSeries.length > 0) {
            const decoded = decodeURIComponent(seriesId);
            const match = raceSeries.find(s => s.name.toLowerCase() === decoded.toLowerCase());
            if (match) {
                setSelectedSeries({ name: match.name, races: match.races });
            }
        }
    }, [seriesId, raceSeries]);

    // Statistics
    const stats = useMemo(() => {
        const totalDistance = races.reduce((sum, r) => sum + (r.distance || 0), 0);
        const totalMinutes = races.reduce((sum, r) => sum + r.durationMinutes, 0);

        const grouped: Record<string, number> = {};
        races.forEach(r => {
            const year = r.date.substring(0, 4);
            grouped[year] = (grouped[year] || 0) + 1;
        });

        const chartData = Object.entries(grouped)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { totalDistance, totalMinutes, count: races.length, chartData };
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

    const selectedUniversal = selectedActivity
        ? universalActivities.find(u => u.id === selectedActivity.id)
        : undefined;

    return (
        <div className="space-y-12">
            {/* --- UPPER SECTION: UPCOMING RACES --- */}
            <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3">
                            <Trophy className="text-amber-500" size={32} />
                            Kommande Tävlingar
                        </h2>
                        <p className="text-slate-400 mt-1">Förbered dig, planera dina mål och krossa motståndet.</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingRace(null);
                            setIsAddModalOpen(true);
                        }}
                        className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-105"
                    >
                        <Plus size={20} /> Planera Tävling
                    </button>
                </div>

                {upcomingRaces.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {upcomingRaces.map(race => (
                            <UpcomingRaceCard
                                key={race.id}
                                race={race}
                                onUpdate={handleSaveRace}
                                onDelete={deletePlannedActivity}
                                onEdit={handleEditClick}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-slate-900/30 rounded-3xl border-2 border-dashed border-white/5 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-50" />
                        <Trophy className="mx-auto text-slate-700 mb-4 group-hover:text-amber-500/50 transition-colors duration-500" size={64} />
                        <h3 className="text-xl font-bold text-white mb-2">Inga lopp inplanerade</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-6">"If you want to run, run a mile. If you want to experience a different life, run a marathon." – Emil Zátopek</p>
                        <button
                            onClick={() => {
                                setEditingRace(null);
                                setIsAddModalOpen(true);
                            }}
                            className="text-amber-400 font-bold hover:underline"
                        >
                            Lägg till ditt nästa mål nu →
                        </button>
                    </div>
                )}
            </div>

            {/* --- LOWER SECTION: HISTORY --- */}
            <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                            <Medal className="text-slate-400" size={24} />
                            Historik & Resultat
                        </h3>
                        <div className="flex gap-4 text-sm text-slate-400">
                            <span><strong className="text-white">{stats.count}</strong> lopp</span>
                            <span>•</span>
                            <span><strong className="text-white">{stats.totalDistance.toFixed(0)}</strong> km totalt</span>
                        </div>
                    </div>

                    <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">🔍</span>
                        <input
                            type="text"
                            placeholder="Sök tävlingshistorik..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-64 transition-all"
                        />
                    </div>
                </div>

                {/* History Stats Chart (Micro) */}
                {stats.chartData.length > 0 && (
                    <div className="mb-8 p-6 bg-slate-950/30 rounded-2xl border border-white/5 flex gap-8 items-center">
                        <div className="flex-1 h-32">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                                        itemStyle={{ color: '#fbbf24' }}
                                    />
                                    <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-black text-white">{stats.chartData[stats.chartData.length - 1]?.date}</div>
                            <div className="text-slate-500 text-xs uppercase tracking-widest font-bold">Senaste säsongen</div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 border-b border-white/5 mb-6 justify-between items-end">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`pb-3 text-sm font-bold transition-all ${viewMode === 'timeline' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}
                        >
                            Tidslinje
                        </button>
                        <button
                            onClick={() => setViewMode('series')}
                            className={`pb-3 text-sm font-bold transition-all ${viewMode === 'series' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}
                        >
                            Tävlingsserier
                        </button>
                    </div>

                    {viewMode === 'series' && (
                        <div className="flex bg-slate-950/50 p-1 rounded-lg border border-white/5 mb-2">
                            <button
                                onClick={() => setSeriesSort('count')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${seriesSort === 'count' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Flest lopp
                            </button>
                            <button
                                onClick={() => setSeriesSort('latest')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${seriesSort === 'latest' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Senaste
                            </button>
                            <button
                                onClick={() => setSeriesSort('name')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${seriesSort === 'name' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Namn (A-Ö)
                            </button>
                        </div>
                    )}
                </div>

                {viewMode === 'timeline' ? (
                    races.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 italic bg-slate-950/30 rounded-xl border border-white/5">
                            <p>Inga genomförda tävlingar hittades för vald period.</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-white/5 shadow-2xl shadow-black/20">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500 border-b border-white/5">
                                    <tr>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Datum <SortIcon colKey="date" /></th>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:text-white" onClick={() => handleSort('notes')}>Tävling <SortIcon colKey="notes" /></th>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:text-white" onClick={() => handleSort('location')}>Plats <SortIcon colKey="location" /></th>
                                        <th className="px-6 py-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('distance')}>Distans <SortIcon colKey="distance" /></th>
                                        <th className="px-6 py-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('durationMinutes')}>Tid <SortIcon colKey="durationMinutes" /></th>
                                        <th className="px-6 py-4 text-right">Tempo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 bg-slate-900/50">
                                    {races.map(race => {
                                        // Helper to resolve the best display title
                                        const getRaceTitle = (r: ExerciseEntry) => {
                                            // 1. Prefer explicit title if it's not generic
                                            if (r.title && !r.title.startsWith('Merged')) return r.title;

                                            // 2. Resolve via UniversalActivity
                                            const ua = universalActivities.find(u => u.id === r.id);
                                            if (ua?.mergeInfo?.isMerged && ua.mergeInfo.originalActivityIds?.length) {
                                                const components = universalActivities.filter(u => ua.mergeInfo!.originalActivityIds!.includes(u.id));
                                                // Prefer Strava title
                                                const stravaComp = components.find(c => c.performance?.source?.source === 'strava');
                                                if (stravaComp?.plan?.title) return stravaComp.plan.title;

                                                // Or any component with a non-merged title
                                                const bestComp = components.find(c => c.plan?.title && !c.plan.title.startsWith('Merged'));
                                                if (bestComp) return bestComp.plan?.title;
                                            }

                                            // 3. Fallback
                                            return r.notes || r.type || 'Okänd Aktivitet';
                                        };

                                        return (
                                            <tr
                                                key={race.id}
                                                className="hover:bg-amber-500/5 transition-colors cursor-pointer group"
                                                onClick={() => setSelectedActivity(race)}
                                            >
                                                <td className="px-6 py-4 font-mono text-slate-300">
                                                    {race.date.split('T')[0]}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-white group-hover:text-amber-400 transition-colors">
                                                    {getRaceTitle(race)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {race.location || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-300">
                                                    {race.distance ? `${race.distance.toFixed(1)} km` : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-amber-300">
                                                    {formatActivityDuration(race.durationMinutes)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-400">
                                                    {calcPace(race.distance, race.durationMinutes)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {raceSeries.map(series => (
                            <div
                                key={series.name}
                                onClick={() => setSelectedSeries({ name: series.name, races: series.races })}
                                className="bg-slate-900 border border-white/10 rounded-3xl p-6 hover:border-amber-500/30 transition-all flex flex-col h-full shadow-xl cursor-pointer group hover:bg-slate-800/50"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <h4 className="text-xl font-black text-white group-hover:text-amber-500 transition-colors">{series.name}</h4>
                                    <div className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded-lg text-xs font-black uppercase">
                                        {series.races.length} lopp
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold text-center mb-1">Personbästa</div>
                                        <div className="text-lg font-black text-white text-center font-mono">
                                            {formatActivityDuration(series.stats.pb.durationMinutes)}
                                        </div>
                                        <div className="text-[9px] text-slate-500 text-center font-bold mt-1">
                                            {series.stats.pb.date.substring(0, 4)}
                                        </div>
                                    </div>
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold text-center mb-1">Medeltid</div>
                                        <div className="text-lg font-bold text-slate-400 text-center font-mono">
                                            {formatActivityDuration(series.stats.avgDuration)}
                                        </div>
                                        <div className="text-[9px] text-slate-500 text-center font-bold mt-1">
                                            {series.stats.pb.distance ? `~${series.stats.pb.distance.toFixed(1)} km` : '-'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1 flex-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold px-2 py-1">
                                        <span>År / Datum</span>
                                        <span>Tid</span>
                                    </div>
                                    {series.races.sort((a, b) => b.date.localeCompare(a.date)).map(r => {
                                        const isPb = r.id === series.stats.pb.id;
                                        return (
                                            <button
                                                key={r.id}
                                                onClick={() => setSelectedActivity(r)}
                                                className={`w-full flex justify-between items-center p-2 rounded-lg text-sm transition-colors ${isPb ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20' : 'text-slate-300 hover:bg-white/5'}`}
                                            >
                                                <span className="font-mono">{r.date.substring(0, 10)}</span>
                                                <div className="flex items-center gap-2">
                                                    {isPb && <Trophy size={10} className="text-amber-500" />}
                                                    <span className="font-bold font-mono">{formatActivityDuration(r.durationMinutes)}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
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

            {selectedSeries && (
                <RaceSeriesDetailModal
                    seriesName={selectedSeries.name}
                    races={selectedSeries.races}
                    onClose={() => setSelectedSeries(null)}
                    onSelectRace={(race) => {
                        setSelectedSeries(null); // Close series modal
                        setSelectedActivity(race); // Open race detail
                    }}
                />
            )}

            {isAddModalOpen && (
                <AddRaceModal
                    activityToEdit={editingRace}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingRace(null);
                    }}
                    onSave={handleSaveRace}
                />
            )}
        </div>
    );
}

// --- SUB-COMPONENTS ---

function UpcomingRaceCard({
    race,
    onUpdate,
    onDelete,
    onEdit
}: {
    race: PlannedActivity,
    onUpdate: (r: PlannedActivity) => void,
    onDelete: (id: string) => void,
    onEdit: (r: PlannedActivity) => void
}) {
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
    const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);

    const daysLeft = useMemo(() => {
        const diff = new Date(race.date).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }, [race.date]);

    const addToCalendar = () => {
        const details = `
Plats: ${race.raceDetails?.logistics?.location || 'Ej angivet'}
Starttid: ${race.raceDetails?.logistics?.travelInfo || ''}
Mål A: ${race.raceDetails?.goals?.a || '-'}
Mål B: ${race.raceDetails?.goals?.b || '-'}
${race.description || ''}
        `.trim();

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:🏆 ${race.title}
DTSTART;VALUE=DATE:${race.date.replace(/-/g, '')}
DESCRIPTION:${details.replace(/\n/g, '\\n')}
LOCATION:${race.raceDetails?.logistics?.location || ''}
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${race.title.replace(/\s+/g, '_')}_race_day.ics`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const toggleChecklistItem = (id: string) => {
        if (!race.raceDetails?.checklist) return;
        const newChecklist = race.raceDetails.checklist.map(item =>
            item.id === id ? { ...item, checked: !item.checked } : item
        );
        onUpdate({
            ...race,
            raceDetails: {
                ...race.raceDetails,
                checklist: newChecklist
            }
        });
    };

    return (
        <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden relative group hover:border-amber-500/50 transition-all duration-300 shadow-xl shadow-black/40 flex flex-col">
            {/* Top Banner / Bib Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-1">
                <div className="bg-slate-900 rounded-t-[20px] p-5 relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">RACE DAY</div>
                            <h3 className="text-2xl font-black text-white leading-tight mb-2">{race.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                                <span className="flex items-center gap-1"><Calendar size={14} className="text-amber-500" /> {race.date}</span>
                                {race.raceDetails?.logistics?.location && (
                                    <span className="flex items-center gap-1"><MapPin size={14} className="text-amber-500" /> {race.raceDetails.logistics.location}</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-black text-white tabular-nums tracking-tighter">{daysLeft}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-500">Dagar kvar</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-5 flex-1 bg-slate-900/50">
                {/* Distance & Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Distans</div>
                        <div className="text-lg font-bold text-white">{race.estimatedDistance > 0 ? `${race.estimatedDistance} km` : '?'}</div>
                    </div>
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Starttid</div>
                        <div className="text-lg font-bold text-white">{race.startTime || 'TBD'}</div>
                    </div>
                </div>

                {/* Goals Section */}
                <div className={`bg-slate-950/30 rounded-xl border border-white/5 overflow-hidden transition-all ${isGoalsExpanded ? 'p-4' : 'p-0'}`}>
                    <button
                        onClick={() => setIsGoalsExpanded(!isGoalsExpanded)}
                        className={`w-full flex justify-between items-center p-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors ${isGoalsExpanded ? 'border-b border-white/5 mb-3 bg-white/5' : ''}`}
                    >
                        <span className="flex items-center gap-2">
                            <Target size={16} className="text-emerald-500" />
                            Målsättningar
                        </span>
                        {isGoalsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isGoalsExpanded && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs font-black">A</div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Dream Goal</div>
                                    <div className="text-white font-mono">{race.raceDetails?.goals?.a || '-'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-black">B</div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Realistic Goal</div>
                                    <div className="text-white font-mono">{race.raceDetails?.goals?.b || '-'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-black">C</div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Safe Goal</div>
                                    <div className="text-white font-mono">{race.raceDetails?.goals?.c || '-'}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Checklist Section */}
                <div className={`bg-slate-950/30 rounded-xl border border-white/5 overflow-hidden transition-all ${isChecklistExpanded ? 'p-4' : 'p-0'}`}>
                    <button
                        onClick={() => setIsChecklistExpanded(!isChecklistExpanded)}
                        className={`w-full flex justify-between items-center p-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors ${isChecklistExpanded ? 'border-b border-white/5 mb-3 bg-white/5' : ''}`}
                    >
                        <span className="flex items-center gap-2">
                            <CheckSquare size={16} className="text-blue-500" />
                            Packlista & Checklista
                        </span>
                        {isChecklistExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isChecklistExpanded && (
                        <div className="space-y-2">
                            {(race.raceDetails?.checklist || []).length === 0 && (
                                <div className="text-xs text-slate-500 italic text-center py-2">Inga punkter tillagda än.</div>
                            )}
                            {(race.raceDetails?.checklist || []).map(item => (
                                <label key={item.id} className="flex items-start gap-3 cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={item.checked}
                                        onChange={() => toggleChecklistItem(item.id)}
                                        className="mt-1 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
                                    />
                                    <span className={`text-sm ${item.checked ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
                                        {item.item}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-950 border-t border-white/5 flex justify-between items-center">
                <button
                    onClick={addToCalendar}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                    title="Lägg till i kalender"
                >
                    <Calendar size={14} /> ICS
                </button>
                <div className="flex gap-2">
                    {race.raceUrl && (
                        <a
                            href={race.raceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Gå till loppets hemsida"
                        >
                            <ExternalLink size={16} />
                        </a>
                    )}
                    <button
                        onClick={() => onEdit(race)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                        title="Redigera lopp"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(race.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Ta bort lopp"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function AddRaceModal({
    activityToEdit,
    onClose,
    onSave
}: {
    activityToEdit?: PlannedActivity | null,
    onClose: () => void,
    onSave: (activity: PlannedActivity) => void
}) {
    const [page, setPage] = useState<'basics' | 'details'>('basics');
    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        distance: '',
        startTime: '10:00',
        location: '',
        url: '',
        goalA: '',
        goalB: '',
        goalC: '',
        description: ''
    });

    // Populate form if editing
    useEffect(() => {
        if (activityToEdit) {
            setForm({
                title: activityToEdit.title,
                date: activityToEdit.date,
                distance: activityToEdit.estimatedDistance.toString(),
                startTime: activityToEdit.startTime || '10:00',
                location: activityToEdit.raceDetails?.logistics?.location || '',
                url: activityToEdit.raceUrl || '',
                goalA: activityToEdit.raceDetails?.goals?.a || '',
                goalB: activityToEdit.raceDetails?.goals?.b || '',
                goalC: activityToEdit.raceDetails?.goals?.c || '',
                description: activityToEdit.description || ''
            });
        }
    }, [activityToEdit]);

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = () => {
        if (!form.title || !form.date) return;

        const newActivity: PlannedActivity = {
            id: activityToEdit?.id || generateId(),
            title: form.title,
            date: form.date,
            startTime: form.startTime,
            type: 'RUN',
            category: 'RACE',
            isRace: true,
            raceUrl: form.url,
            description: form.description,
            estimatedDistance: parseFloat(form.distance) || 0,
            status: 'PLANNED',
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            targetPace: '',
            targetHrZone: 0,
            raceDetails: {
                goals: {
                    a: form.goalA,
                    b: form.goalB,
                    c: form.goalC
                },
                logistics: {
                    location: form.location
                },
                checklist: activityToEdit?.raceDetails?.checklist || [
                    { id: '1', item: 'Anmäld & Betald', checked: false, category: 'logistics' },
                    { id: '2', item: 'Boende bokat', checked: false, category: 'logistics' },
                    { id: '3', item: 'Transport planerad', checked: false, category: 'logistics' },
                    { id: '4', item: 'Energiplan spikad', checked: false, category: 'nutrition' },
                ]
            }
        };

        onSave(newActivity);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Trophy className="text-amber-500" />
                        {activityToEdit ? 'Redigera Tävling' : 'Planera Ny Tävling'}
                    </h3>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10 transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    {page === 'basics' ? (
                        <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loppets Namn</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none font-bold"
                                    placeholder="t.ex. Göteborgsvarvet 2026"
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
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Starttid</label>
                                    <input
                                        type="time"
                                        value={form.startTime}
                                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
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
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ort / Plats</label>
                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={e => setForm({ ...form, location: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                        placeholder="Göteborg"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Länk till loppet</label>
                                <input
                                    type="url"
                                    value={form.url}
                                    onChange={e => setForm({ ...form, url: e.target.value })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none text-sm"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                                <label className="block text-xs font-bold text-emerald-400 uppercase mb-1">Mål A (Drömmålet)</label>
                                <input
                                    type="text"
                                    value={form.goalA}
                                    onChange={e => setForm({ ...form, goalA: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                                    placeholder="t.ex. Sub 1:45"
                                />
                            </div>
                            <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-1">Mål B (Realistiskt)</label>
                                <input
                                    type="text"
                                    value={form.goalB}
                                    onChange={e => setForm({ ...form, goalB: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                                    placeholder="t.ex. Sub 1:50"
                                />
                            </div>
                            <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                                <label className="block text-xs font-bold text-amber-500 uppercase mb-1">Mål C (Minimimål)</label>
                                <input
                                    type="text"
                                    value={form.goalC}
                                    onChange={e => setForm({ ...form, goalC: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                    placeholder="t.ex. Ha kul och gå i mål"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Anteckningar / Strategi</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none h-20 resize-none"
                                    placeholder="Strategi, packning..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-950 flex gap-3">
                    {page === 'details' ? (
                        <button
                            onClick={() => setPage('basics')}
                            className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                        >
                            ← Tillbaka
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                        >
                            Avbryt
                        </button>
                    )}

                    {page === 'basics' ? (
                        <button
                            onClick={() => setPage('details')}
                            className="flex-1 px-6 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors border border-white/10 flex items-center justify-center gap-2"
                        >
                            Sätt Mål & Strategi →
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!form.title}
                            className="flex-1 px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 shadow-lg shadow-amber-500/20"
                        >
                            {activityToEdit ? 'Spara Ändringar' : 'Spara Tävling'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function calcPace(distValues: number | undefined, minutes: number) {
    if (!distValues || distValues <= 0) return '-';
    const paceDec = minutes / distValues;
    const pMin = Math.floor(paceDec);
    const pSec = Math.round((paceDec - pMin) * 60);
    if (pSec === 60) return `${pMin + 1}:00/km`;
    return `${pMin}:${pSec.toString().padStart(2, '0')}/km`;
}
