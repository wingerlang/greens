import { useState, useMemo, useEffect } from 'react';
import { ExerciseEntry, UniversalActivity, PlannedActivity, generateId, RaceDetails } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';
import { formatActivityDuration } from '../../utils/formatters.ts';
import { ActivityDetailModal } from '../activities/ActivityDetailModal.tsx';
import { RaceSeriesDetailModal } from './RaceSeriesDetailModal.tsx';
import { RaceSeriesManager } from './RaceSeriesManager.tsx';
import { TourManager } from './TourManager.tsx';
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
    Copy as CopyIcon,
    Medal,
    Pencil
} from 'lucide-react';
import { isCompetition } from '../../utils/activityUtils.ts';

const isTrailRace = (title: string) => {
    const t = title.toLowerCase();
    return t.includes('trail') || t.includes('fjäll') || t.includes('skog') || t.includes('mountain') || t.includes('eco') || t.includes('kullamannen');
};

const isUltraRace = (title: string, distance: number = 0) => {
    return distance >= 42.5 || title.toLowerCase().includes('ultra') || title.toLowerCase().includes('100 miles');
};

const getDistanceStyle = (distance: number = 0) => {
    if (distance >= 42.5) return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'; // Ultra
    if (distance >= 42) return 'bg-rose-500/10 text-rose-400 border-rose-500/20'; // Marathon
    if (distance >= 21) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'; // Half
    if (distance >= 10) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // 10k
    if (distance >= 5) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'; // 5k
    return 'bg-slate-800 text-slate-300 border-white/5'; // Other
};

const formatRaceDateCompact = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '');
};

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
    const { plannedActivities, savePlannedActivities, deletePlannedActivity, currentUser, updateCurrentUser } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [selectedActivity, setSelectedActivity] = useState<ExerciseEntry | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
    const [editingRace, setEditingRace] = useState<PlannedActivity | null>(null);

    // Initialize view mode based on URL, Props, or Settings
    const [viewMode, setViewMode] = useState<'timeline' | 'series' | 'tours'>(() => {
        // 1. Check URL
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get('tab');
        if (urlTab === 'series' || urlTab === 'serier') return 'series';
        if (urlTab === 'tours' || urlTab === 'tourer') return 'tours';
        if (urlTab === 'timeline' || urlTab === 'lopp') return 'timeline';

        // 2. Check settings
        if (currentUser?.settings?.lastActiveRaceTab) {
            return currentUser.settings.lastActiveRaceTab;
        }

        return 'timeline';
    });
    const [upcomingViewMode, setUpcomingViewMode] = useState<'cozy' | 'compact' | 'list'>('cozy');
    const [selectedSeries, setSelectedSeries] = useState<{ name: string, races: ExerciseEntry[] } | null>(null);
    const [seriesSort, setSeriesSort] = useState<'count' | 'name' | 'latest'>('count');

    // Sync Props to State (if explicitly passed)
    useEffect(() => {
        if (!subTab) return;
        if (subTab === 'serier' || subTab === 'series') setViewMode('series');
        else if (subTab === 'tours' || subTab === 'tourer') setViewMode('tours');
        else setViewMode('timeline');
    }, [subTab]);

    // Handle View Mode changes (Persist to URL & Settings)
    const handleViewModeChange = (mode: 'timeline' | 'series' | 'tours') => {
        setViewMode(mode);

        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('tab', mode);
        window.history.replaceState({}, '', url.toString());

        // Update Settings
        if (currentUser && updateCurrentUser) {
            updateCurrentUser({
                settings: {
                    ...currentUser.settings,
                    lastActiveRaceTab: mode
                }
            });
        }
    };


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

    const handleBulkSaveRaces = (newRaces: PlannedActivity[]) => {
        // Only add races that don't already exist (or overwrite if we implement ID matching later)
        const newList = [...plannedActivities, ...newRaces];
        savePlannedActivities(newList);
        setIsBulkAddModalOpen(false);
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

        const grouped: Record<string, { count: number, projected: number }> = {};

        races.forEach(r => {
            const year = r.date.substring(0, 4);
            if (!grouped[year]) grouped[year] = { count: 0, projected: 0 };
            grouped[year].count += 1;
        });

        upcomingRaces.forEach(r => {
            if (r.raceDetails?.isRegistered !== false) {
                const year = r.date.substring(0, 4);
                if (!grouped[year]) grouped[year] = { count: 0, projected: 0 };
                grouped[year].projected += 1;
            }
        });

        const chartData = Object.entries(grouped)
            .map(([date, data]) => ({ date, count: data.count, projected: data.projected }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { totalDistance, totalMinutes, count: races.length, chartData };
    }, [races, upcomingRaces]);

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
                    <div className="flex justify-between w-full md:w-auto md:flex-1">
                        <div>
                            <h2 className="text-3xl font-black text-white flex items-center gap-3">
                                <Trophy className="text-amber-500" size={32} />
                                Kommande Tävlingar
                            </h2>
                            <p className="text-slate-400 mt-1">Förbered dig, planera dina mål och krossa motståndet.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4 md:mt-0">
                        <div className="flex gap-2 mr-4">
                            <button
                                onClick={() => {
                                    const json = JSON.stringify(upcomingRaces, null, 2);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'kommande_tavlingar.json';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Exportera kommande som JSON"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    const tsv = ['Datum	Titel	Plats	Distans	Dagar kvar'].concat(
                                        upcomingRaces.map(r => {
                                            const diff = new Date(r.date).getTime() - new Date().getTime();
                                            const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                            return `${r.date}	${r.title}	${r.raceDetails?.logistics?.location || ''}	${r.estimatedDistance}	${daysLeft}`;
                                        })
                                    ).join('\n');
                                    navigator.clipboard.writeText(tsv);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Kopiera kommande som tabell (TSV)"
                            >
                                <CopyIcon size={16} />
                            </button>
                        </div>
                        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 mr-4">
                            <button
                                onClick={() => setUpcomingViewMode('cozy')}
                                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${upcomingViewMode === 'cozy' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Cozy
                            </button>
                            <button
                                onClick={() => setUpcomingViewMode('compact')}
                                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${upcomingViewMode === 'compact' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Kompakt
                            </button>
                            <button
                                onClick={() => setUpcomingViewMode('list')}
                                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${upcomingViewMode === 'list' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Lista
                            </button>
                        </div>
                        <button
                            onClick={() => setIsBulkAddModalOpen(true)}
                            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-white/5 flex items-center gap-2"
                        >
                            Bulk-skapa
                        </button>
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
                </div>

                {upcomingRaces.length > 0 ? (
                    upcomingViewMode === 'cozy' ? (
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
                    ) : upcomingViewMode === 'compact' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {upcomingRaces.map(race => (
                                <UpcomingRaceCardCompact
                                    key={race.id}
                                    race={race}
                                    onEdit={handleEditClick}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-white/5 shadow-2xl shadow-black/20">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-500 border-b border-white/5">
                                    <tr>
                                        <th className="px-3 py-1.5 text-left">Datum</th>
                                        <th className="px-3 py-1.5 text-left">Tävling</th>
                                        <th className="px-3 py-1.5 text-left">Plats</th>
                                        <th className="px-3 py-1.5 text-right">Distans</th>
                                        <th className="px-3 py-1.5 text-right">Dagar kvar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 bg-slate-900/50">
                                    {upcomingRaces.map(race => {
                                        const diff = new Date(race.date).getTime() - new Date().getTime();
                                        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                        const isTrail = race.raceDetails?.isTrail ?? isTrailRace(race.title);
                                        const isVirtual = race.raceDetails?.isVirtual;
                                        const isUltra = isUltraRace(race.title, race.estimatedDistance);
                                        const distStyle = getDistanceStyle(race.estimatedDistance);

                                        return (
                                            <tr
                                                key={race.id}
                                                className="hover:bg-amber-500/5 transition-colors cursor-pointer group border-l-2 border-l-emerald-500/50 hover:border-l-emerald-400"
                                                onClick={() => handleEditClick(race)}
                                            >
                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-emerald-400">{formatRaceDateCompact(race.date)}</span>
                                                        <span className="text-[9px] text-slate-500 uppercase font-black">{race.date.substring(2, 4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1 text-xs">
                                                        {race.title}
                                                        {isUltra && <span className="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                                        {isTrail && !isUltra && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0 rounded border border-emerald-500/30 uppercase font-black tracking-widest">Trail</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                                    {isVirtual ? <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Virtuellt</span> : (race.raceDetails?.logistics?.location || '-')}
                                                </td>
                                                <td className="px-3 py-1.5 text-right">
                                                    {race.estimatedDistance > 0 ? (
                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold border ${distStyle} whitespace-nowrap`}>
                                                            {race.estimatedDistance.toFixed(1)} km
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-emerald-300 font-bold">
                                                    {daysLeft}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
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
                    <div className="flex justify-between w-full md:w-auto md:flex-1">
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
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const json = JSON.stringify(races, null, 2);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'historik_tavlingar.json';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Exportera som JSON"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    const tsv = ['Datum\tTitel\tDistans\tTid\tTyp\tPlats'].concat(
                                        races.map(r => `${r.date}\t${r.title || r.notes}\t${r.distance || ''}\t${r.durationMinutes}\t${r.type}\t${r.location || ''}`)
                                    ).join('\n');
                                    navigator.clipboard.writeText(tsv);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Kopiera som tabell (TSV)"
                            >
                                <CopyIcon size={16} />
                            </button>
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
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Bar dataKey="count" name="Genomförda" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} barSize={20} />
                                    <Bar dataKey="projected" name="Planerade" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
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
                            onClick={() => handleViewModeChange('timeline')}
                            className={`pb-3 text-sm font-bold transition-all ${viewMode === 'timeline' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}
                        >
                            Tidslinje
                        </button>
                        <button
                            onClick={() => handleViewModeChange('series')}
                            className={`pb-3 text-sm font-bold transition-all ${viewMode === 'series' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}
                        >
                            Tävlingsserier
                        </button>
                        <button
                            onClick={() => handleViewModeChange('tours')}
                            className={`pb-3 text-sm font-bold transition-all ${viewMode === 'tours' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}
                        >
                            Tourer (Cups)
                        </button>
                    </div>

                    {(viewMode === 'series' || viewMode === 'tours') && (
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
                    (races.length === 0 && upcomingRaces.length === 0) ? (
                        <div className="text-center py-12 text-slate-500 italic bg-slate-950/30 rounded-xl border border-white/5">
                            <p>Inga genomförda eller kommande tävlingar hittades för vald period.</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-white/5 shadow-2xl shadow-black/20">
                            <TimelineTable 
                                races={races} 
                                upcomingRaces={upcomingRaces} 
                                handleEditClick={handleEditClick} 
                                setSelectedActivity={setSelectedActivity} 
                                universalActivities={universalActivities}
                                sortConfig={sortConfig}
                                handleSort={handleSort}
                                formatRaceDateCompact={formatRaceDateCompact}
                                isTrailRace={isTrailRace}
                                isUltraRace={isUltraRace}
                                getDistanceStyle={getDistanceStyle}
                                formatActivityDuration={formatActivityDuration}
                                calcPace={calcPace}
                            />
                        </div>
                    )
                ) : viewMode === 'series' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {raceSeries.map(series => (
                            <SeriesCard 
                                key={series.name} 
                                series={series} 
                                onSelect={() => setSelectedSeries({ name: series.name, races: series.races })} 
                                setSelectedActivity={setSelectedActivity}
                                formatActivityDuration={formatActivityDuration}
                            />
                        ))}
                    </div>
                ) : (
                    <TourManager />
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
                    races={races}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingRace(null);
                    }}
                    onSave={handleSaveRace}
                />
            )}

            {isBulkAddModalOpen && (
                <BulkAddRaceModal
                    onClose={() => setIsBulkAddModalOpen(false)}
                    onSaveAll={handleBulkSaveRaces}
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

    const isTrail = isTrailRace(race.title);
    const isUltra = isUltraRace(race.title, race.estimatedDistance);
    const distStyle = getDistanceStyle(race.estimatedDistance);

    return (
        <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden relative group hover:border-amber-500/50 transition-all duration-300 shadow-xl shadow-black/40 flex flex-col">
            {/* Top Banner / Bib Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-1">
                <div className="bg-slate-900 rounded-t-[20px] p-5 relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="flex flex-wrap gap-2 mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">RACE DAY</span>
                                {isUltra && <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-0.5 rounded-md shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                {isTrail && !isUltra && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">Trail</span>}
                            </div>
                            <h3 className="text-2xl font-black text-white leading-tight mb-3">{race.title}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                                <span className="flex items-center gap-1"><Calendar size={14} className="text-amber-500" /> {formatRaceDateCompact(race.date)}</span>
                                {race.raceDetails?.logistics?.location && (
                                    <span className="flex items-center gap-1"><MapPin size={14} className="text-amber-500" /> <span className="truncate max-w-[150px]">{race.raceDetails.logistics.location}</span></span>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
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
                    <div className={`p-3 rounded-xl border flex flex-col justify-center items-center text-center ${distStyle}`}>
                        <div className="text-xs uppercase font-bold mb-1 opacity-70">Distans</div>
                        <div className="text-xl font-black">{race.estimatedDistance > 0 ? `${race.estimatedDistance} km` : '?'}</div>
                    </div>
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 flex flex-col justify-center items-center text-center">
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Starttid</div>
                        <div className="text-xl font-black text-white">{race.startTime || 'TBD'}</div>
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

function UpcomingRaceCardCompact({
    race,
    onEdit
}: {
    race: PlannedActivity,
    onEdit: (r: PlannedActivity) => void
}) {
    const daysLeft = useMemo(() => {
        const diff = new Date(race.date).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }, [race.date]);

    const isTrail = isTrailRace(race.title);
    const isUltra = isUltraRace(race.title, race.estimatedDistance);
    const distStyle = getDistanceStyle(race.estimatedDistance);

    return (
        <div
            onClick={() => onEdit(race)}
            className="bg-slate-900 border-l-2 border-l-emerald-500 border-y border-r border-white/5 rounded-xl p-4 hover:bg-slate-800 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
        >
            <div>
                <div className="flex gap-1.5 mb-2 items-center flex-wrap">
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase shadow-sm">{daysLeft} dagar</span>
                    {isUltra && <span className="text-[8px] font-black uppercase tracking-widest text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                    {isTrail && !isUltra && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Trail</span>}
                </div>
                <h4 className="text-white font-bold leading-tight group-hover:text-emerald-400 transition-colors line-clamp-2 text-sm mb-1">{race.title}</h4>
                <div className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-wide">{formatRaceDateCompact(race.date)}</div>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs">
                <span className="flex items-center gap-1 text-slate-400 max-w-[60%]">
                    <MapPin size={10} className="text-slate-500 shrink-0" />
                    <span className="truncate">{race.raceDetails?.logistics?.location || 'Mål'}</span>
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${distStyle}`}>
                    {race.estimatedDistance > 0 ? `${race.estimatedDistance}km` : '-'}
                </span>
            </div>
        </div>
    );
}

function AddRaceModal({
    activityToEdit,
    onClose,
    onSave,
    races
}: {
    activityToEdit?: PlannedActivity | null,
    onClose: () => void,
    onSave: (activity: PlannedActivity) => void,
    races: ExerciseEntry[]
}) {
    const [page, setPage] = useState<'basics' | 'details'>('basics');
    const [suggestedRace, setSuggestedRace] = useState<ExerciseEntry | null>(null);
    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        distance: '',
        startTime: '10:00',
        location: '',
        url: '',
        isRegistered: true,
        isVirtual: false,
        isTrail: false,
        goalC: '',
        description: '',
        type: 'RUN' as PlannedActivity['type'],
        subType: '' as string
    });

    // Watch title for historic matches
    useEffect(() => {
        if (form.title.length > 3 && !activityToEdit) {
            const query = form.title.toLowerCase().replace(/\d{4}/g, '').trim(); // Remove years like 2024
            const match = races.find(r => {
                const title = r.title || r.notes || '';
                return title.toLowerCase().includes(query);
            });
            setSuggestedRace(match || null);
        } else {
            setSuggestedRace(null);
        }
    }, [form.title, races, activityToEdit]);

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
                isRegistered: activityToEdit.raceDetails?.isRegistered ?? true,
                isVirtual: activityToEdit.raceDetails?.isVirtual ?? false,
                isTrail: activityToEdit.raceDetails?.isTrail ?? false,
                goalA: activityToEdit.raceDetails?.goals?.a || '',
                goalB: activityToEdit.raceDetails?.goals?.b || '',
                goalC: activityToEdit.raceDetails?.goals?.c || '',
                description: activityToEdit.description || '',
                type: activityToEdit.type || 'RUN',
                subType: activityToEdit.subType || ''
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
            type: form.type,
            category: form.type === 'RUN' ? 'RACE' : form.type === 'STRENGTH' ? 'STRENGTH' : 'CARDIO',
            subType: form.subType as any || undefined,
            isRace: form.type === 'RUN',
            raceUrl: form.url,
            description: form.description,
            estimatedDistance: parseFloat(form.distance) || 0,
            status: 'PLANNED',
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            targetPace: '',
            targetHrZone: 0,
            raceDetails: {
                isRegistered: form.isRegistered,
                isVirtual: form.isVirtual,
                isTrail: form.isTrail,
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
                        {form.type === 'RUN' ? <Trophy className="text-amber-500" /> : <Calendar className="text-indigo-500" />}
                        {activityToEdit ? 'Redigera' : 'Planera'} {form.type === 'RUN' ? 'Tävling' : 'Aktivitet'}
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
                                {suggestedRace && (
                                    <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex justify-between items-center animate-in slide-in-from-top-2">
                                        <div>
                                            <div className="text-xs font-bold text-amber-500">Du har sprungit detta förut!</div>
                                            <div className="text-[10px] text-amber-400/80">
                                                Senast: {suggestedRace.date} • {suggestedRace.distance?.toFixed(1) || '?'} km • {formatActivityDuration(suggestedRace.durationMinutes)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setForm(prev => ({
                                                    ...prev,
                                                    distance: suggestedRace.distance?.toString() || prev.distance,
                                                    location: suggestedRace.location || prev.location,
                                                    isVirtual: (suggestedRace.tags || []).includes('virtual'),
                                                    isTrail: (suggestedRace.tags || []).includes('trail') || isTrailRace(suggestedRace.title || '')
                                                }));
                                                setSuggestedRace(null);
                                            }}
                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-[10px] font-black uppercase rounded-md transition-colors shadow-sm"
                                        >
                                            Auto-ifyll
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Type Selector */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'RUN', label: 'Löpning', icon: '🏃' },
                                    { id: 'STRENGTH', label: 'Styrka', icon: '🏋️' },
                                    { id: 'CARDIO', label: 'Cardio', icon: '🚴' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setForm({ ...form, type: t.id as any, subType: '' })}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${form.type === t.id ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-white/10'}`}
                                    >
                                        <span className="text-xl">{t.icon}</span>
                                        <span className="text-[10px] font-bold uppercase">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* SubType Selector for Cardio */}
                            {form.type === 'CARDIO' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Välj Maskin/Typ</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                        {[
                                            { id: 'cycling', label: 'Cykel', icon: '🚴' },
                                            { id: 'cross-trainer', label: 'Crosstrainer', icon: '⛷️' },
                                            { id: 'rowing', label: 'Rodd', icon: '🚣' },
                                            { id: 'stair-master', label: 'Trappa', icon: '🪜' },
                                            { id: 'skierg', label: 'SkiErg', icon: '🎿' }
                                        ].map(st => (
                                            <button
                                                key={st.id}
                                                onClick={() => setForm({ ...form, subType: st.id })}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all whitespace-nowrap ${form.subType === st.id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-white/10'}`}
                                            >
                                                <span>{st.icon}</span>
                                                <span className="text-[10px] font-bold uppercase">{st.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                        disabled={form.isVirtual}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none disabled:opacity-50"
                                        placeholder={form.isVirtual ? "Virtuellt" : "Göteborg"}
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

                            {/* Race Type Flags */}
                            <div className="flex gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={form.isTrail}
                                        onChange={e => setForm({ ...form, isTrail: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                                    />
                                    <span className="text-sm text-slate-300 font-bold group-hover:text-emerald-400 transition-colors">Trail-lopp</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={form.isVirtual}
                                        onChange={e => {
                                            setForm({ ...form, isVirtual: e.target.checked, location: e.target.checked ? '' : form.location });
                                        }}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
                                    />
                                    <span className="text-sm text-slate-300 font-bold group-hover:text-purple-400 transition-colors">Virtuellt Lopp</span>
                                </label>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-white">Anmäld till loppet</h4>
                                    <p className="text-xs text-slate-400">Markera om du är formellt anmäld och har en startplats.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isRegistered}
                                        onChange={e => setForm({ ...form, isRegistered: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>

                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <h4 className="text-sm font-bold text-white">Målsättningar</h4>
                                <button
                                    onClick={() => {
                                        const dist = parseFloat(form.distance);
                                        if (isNaN(dist) || dist <= 0) {
                                            alert("Du måste ange en distans för att använda estimeringen.");
                                            return;
                                        }

                                        // 1. Find best comparable race
                                        const comps = races.filter(r => r.distance && Math.abs(r.distance - dist) / dist < 0.1 && r.durationMinutes > 0);
                                        comps.sort((a, b) => a.durationMinutes - b.durationMinutes);
                                        const pb = comps[0];

                                        if (pb) {
                                            const pbPaceDec = pb.durationMinutes / pb.distance!;

                                            // A Goal: 2.5% faster than PB
                                            const aPace = pbPaceDec * 0.975;
                                            const aTime = aPace * dist;

                                            // B Goal: PB
                                            const bTime = pb.durationMinutes;

                                            // C Goal: Finish or 5% slower
                                            const cTime = pb.durationMinutes * 1.05;

                                            setForm(prev => ({
                                                ...prev,
                                                goalA: `Sub ${formatActivityDuration(aTime)} (PB -2.5%)`,
                                                goalB: `Sub ${formatActivityDuration(bTime)} (Tidigare PB)`,
                                                goalC: `Sub ${formatActivityDuration(cTime)}`
                                            }));
                                        } else {
                                            // Naive extrapolation based on a general user profile
                                            // Assumes user is a ~5:00/km runner
                                            const basePaceDec = 5.0; // 5 min/km
                                            const targetDec = dist > 21 ? basePaceDec * 1.05 : (dist > 10 ? basePaceDec : basePaceDec * 0.95);

                                            setForm(prev => ({
                                                ...prev,
                                                goalA: `Sub ${formatActivityDuration((targetDec * 0.95) * dist)}`,
                                                goalB: `Sub ${formatActivityDuration(targetDec * dist)}`,
                                                goalC: 'Finish'
                                            }));
                                        }
                                    }}
                                    className="text-[10px] bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-2 py-1 rounded font-black uppercase tracking-wider transition-colors border border-indigo-500/30 flex items-center gap-1"
                                >
                                    <Clock size={10} /> Smart Estimate
                                </button>
                            </div>

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

const MONTH_MAP: Record<string, string> = {
    'jan': '01', 'januari': '01',
    'feb': '02', 'februari': '02',
    'mar': '03', 'mars': '03',
    'apr': '04', 'april': '04',
    'maj': '05',
    'jun': '06', 'juni': '06',
    'jul': '07', 'juli': '07',
    'aug': '08', 'augusti': '08',
    'sep': '09', 'sept': '09', 'september': '09',
    'okt': '10', 'oktober': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
};

function BulkAddRaceModal({
    onClose,
    onSaveAll
}: {
    onClose: () => void,
    onSaveAll: (activities: PlannedActivity[]) => void
}) {
    const [step, setStep] = useState<'input' | 'edit'>('input');
    const [rawText, setRawText] = useState('');
    const [parsedRaces, setParsedRaces] = useState<any[]>([]);

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleParse = () => {
        const lines = rawText.split('\n').filter(l => l.trim() !== '');
        const currentYear = new Date().getFullYear();
        const races = lines.map(line => {
            const match = line.trim().match(/^(\d{1,2})\s+([a-zA-ZåäöÅÄÖ]+)\s+(.+)$/);
            if (match) {
                const dayStr = match[1].padStart(2, '0');
                const monthStr = MONTH_MAP[match[2].toLowerCase()] || '01';
                return {
                    id: generateId(),
                    date: `${currentYear}-${monthStr}-${dayStr}`,
                    title: match[3],
                    distance: '',
                    location: '',
                    url: '',
                    isRegistered: false
                };
            }
            // Fallback for lines that don't match the standard format
            return {
                id: generateId(),
                date: `${currentYear}-01-01`,
                title: line.trim(),
                distance: '',
                location: '',
                url: '',
                isRegistered: false
            };
        });
        setParsedRaces(races);
        setStep('edit');
    };

    const updateRace = (id: string, field: string, value: any) => {
        setParsedRaces(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSave = () => {
        const finalRaces: PlannedActivity[] = parsedRaces.map(pr => {
            return {
                id: pr.id,
                title: pr.title,
                date: pr.date,
                startTime: '10:00',
                type: 'RUN',
                category: 'RACE',
                isRace: true,
                raceUrl: pr.url,
                description: '',
                estimatedDistance: parseFloat(pr.distance) || 0,
                status: 'PLANNED',
                structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
                targetPace: '',
                targetHrZone: 0,
                raceDetails: {
                    goals: {},
                    logistics: {
                        location: pr.location
                    },
                    checklist: [
                        { id: '1', item: 'Anmäld & Betald', checked: pr.isRegistered, category: 'logistics' },
                        { id: '2', item: 'Boende bokat', checked: false, category: 'logistics' },
                        { id: '3', item: 'Transport planerad', checked: false, category: 'logistics' },
                        { id: '4', item: 'Energiplan spikad', checked: false, category: 'nutrition' },
                    ]
                }
            };
        });
        onSaveAll(finalRaces);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950 rounded-t-3xl">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Trophy className="text-amber-500" />
                        Bulk-skapa Tävlingar
                    </h3>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10 transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {step === 'input' ? (
                        <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
                            <p className="text-slate-400 text-sm">
                                Klistra in din lista med tävlingar. Använd formatet <code className="text-amber-400 bg-amber-500/10 px-1 rounded">29 mars Genarps Trail</code> (ett lopp per rad).
                                Året sätts automatiskt till {new Date().getFullYear()}.
                            </p>
                            <textarea
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500 outline-none h-64 font-mono text-sm resize-none"
                                placeholder={"29 mars Genarps Trail\n12 april Hässleholmsloppet\n14 maj Bokskogstrailen"}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <p className="text-slate-400 text-sm">
                                Granska och fyll i detaljer. Klicka sen på Spara Alla längst ner.
                            </p>
                            <div className="bg-slate-950/50 rounded-xl border border-white/5 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                                        <thead className="bg-slate-950 text-xs uppercase text-slate-500 border-b border-white/5">
                                            <tr>
                                                <th className="px-4 py-3 font-bold">Datum</th>
                                                <th className="px-4 py-3 font-bold">Namn</th>
                                                <th className="px-4 py-3 font-bold">Distans (km)</th>
                                                <th className="px-4 py-3 font-bold">Plats</th>
                                                <th className="px-4 py-3 font-bold">Hemsida</th>
                                                <th className="px-4 py-3 font-bold text-center">Anmäld</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 bg-slate-900/50">
                                            {parsedRaces.map(race => (
                                                <tr key={race.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="date"
                                                            value={race.date}
                                                            onChange={e => updateRace(race.id, 'date', e.target.value)}
                                                            className="bg-transparent border-b border-transparent focus:border-amber-500 text-white outline-none w-32 font-mono text-xs focus:bg-slate-800 rounded px-1 transition-colors"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={race.title}
                                                            onChange={e => updateRace(race.id, 'title', e.target.value)}
                                                            className="bg-transparent border-b border-transparent focus:border-amber-500 text-white font-bold outline-none w-full min-w-[200px] focus:bg-slate-800 rounded px-1 transition-colors"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            value={race.distance}
                                                            onChange={e => updateRace(race.id, 'distance', e.target.value)}
                                                            className="bg-transparent border-b border-transparent focus:border-amber-500 text-white outline-none w-20 text-right font-mono focus:bg-slate-800 rounded px-1 transition-colors"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={race.location}
                                                            onChange={e => updateRace(race.id, 'location', e.target.value)}
                                                            className="bg-transparent border-b border-transparent focus:border-amber-500 text-white outline-none w-full min-w-[120px] focus:bg-slate-800 rounded px-1 transition-colors"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="url"
                                                            value={race.url}
                                                            onChange={e => updateRace(race.id, 'url', e.target.value)}
                                                            className="bg-transparent border-b border-transparent focus:border-amber-500 text-blue-400 outline-none w-full min-w-[150px] text-xs focus:bg-slate-800 rounded px-1 transition-colors"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={race.isRegistered}
                                                            onChange={e => updateRace(race.id, 'isRegistered', e.target.checked)}
                                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-950 rounded-b-3xl flex gap-3">
                    {step === 'edit' && (
                        <button
                            onClick={() => setStep('input')}
                            className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                        >
                            ← Tillbaka
                        </button>
                    )}
                    {step === 'input' ? (
                        <button
                            onClick={handleParse}
                            disabled={!rawText.trim()}
                            className="flex-1 px-6 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 border border-white/10"
                        >
                            Tolka {rawText ? rawText.split('\n').filter(l => l.trim() !== '').length : 0} Lopp →
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            className="flex-1 px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                        >
                            Spara {parsedRaces.length} Tävlingar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function TimelineTable({ 
    races, 
    upcomingRaces, 
    handleEditClick, 
    setSelectedActivity, 
    universalActivities,
    sortConfig,
    handleSort,
    formatRaceDateCompact,
    isTrailRace,
    isUltraRace,
    getDistanceStyle,
    formatActivityDuration,
    calcPace
}: any) {
    const SortIcon = ({ colKey }: { colKey: string }) => {
        if (sortConfig.key !== colKey) return <span className="opacity-20 ml-1">⇅</span>;
        return <span className="text-emerald-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <table className="w-full text-sm">
            <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-500 border-b border-white/5">
                <tr>
                    <th className="px-3 py-1.5 text-left cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Datum <SortIcon colKey="date" /></th>
                    <th className="px-3 py-1.5 text-left cursor-pointer hover:text-white" onClick={() => handleSort('notes')}>Tävling <SortIcon colKey="notes" /></th>
                    <th className="px-3 py-1.5 text-left cursor-pointer hover:text-white" onClick={() => handleSort('location')}>Plats <SortIcon colKey="location" /></th>
                    <th className="px-3 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('distance')}>Distans <SortIcon colKey="distance" /></th>
                    <th className="px-3 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('durationMinutes')}>Tid <SortIcon colKey="durationMinutes" /></th>
                    <th className="px-3 py-1.5 text-right">Tempo</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-900/50">
                {/* UPCOMING */}
                {upcomingRaces.map((race: any) => {
                    const diff = new Date(race.date).getTime() - new Date().getTime();
                    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    const isTrail = isTrailRace(race.title);
                    const isUltra = isUltraRace(race.title, race.estimatedDistance);
                    const distStyle = getDistanceStyle(race.estimatedDistance);
                    const isVirtual = race.raceDetails?.isVirtual;

                    return (
                        <tr
                            key={`planned-${race.id}`}
                            className="hover:bg-emerald-500/5 transition-colors cursor-pointer group bg-emerald-950/20"
                            onClick={() => handleEditClick(race)}
                        >
                            <td className="px-3 py-1.5 border-l-2 border-l-emerald-500/50 group-hover:border-l-emerald-400 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs font-bold text-emerald-400">{formatRaceDateCompact(race.date)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-black">{race.date.substring(2, 4)}</span>
                                </div>
                            </td>
                            <td className="px-3 py-1.5">
                                <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5 flex-wrap text-xs">
                                    <Target size={12} className="text-emerald-500 shrink-0" />
                                    <span className="truncate max-w-[200px]">{race.title} <span className="text-slate-500 font-normal text-[10px]">(Planerad)</span></span>
                                    {isUltra && <span className="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                    {isTrail && !isUltra && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0 rounded border border-emerald-500/30 uppercase font-black tracking-widest">Trail</span>}
                                    <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black text-[9px] whitespace-nowrap">{daysLeft} dagar</span>
                                </div>
                            </td>
                            <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                {isVirtual ? <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Virtuellt</span> : (race.raceDetails?.logistics?.location || '-')}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                                {race.estimatedDistance > 0 ? (
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${distStyle} whitespace-nowrap`}>
                                        {race.estimatedDistance.toFixed(1)} km
                                    </span>
                                ) : '-'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-500">-</td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-500">-</td>
                        </tr>
                    );
                })}

                {/* HISTORY */}
                {races.map((race: any) => {
                    const getRaceTitle = (r: ExerciseEntry) => {
                        if (r.title && !r.title.startsWith('Merged')) return r.title;
                        const ua = universalActivities.find(u => u.id === r.id);
                        if (ua?.mergeInfo?.isMerged && ua.mergeInfo.originalActivityIds?.length) {
                            const components = universalActivities.filter(u => ua.mergeInfo!.originalActivityIds!.includes(u.id));
                            const stravaComp = components.find(c => c.performance?.source?.source === 'strava');
                            if (stravaComp?.plan?.title) return stravaComp.plan.title;
                            const bestComp = components.find(c => c.plan?.title && !c.plan.title.startsWith('Merged'));
                            if (bestComp) return bestComp.plan?.title;
                        }
                        return r.notes || r.type || 'Okänd Aktivitet';
                    };

                    const resolvedTitle = getRaceTitle(race) || '';
                    const hasVirtualTag = (race.tags || []).includes('virtual') || resolvedTitle.toLowerCase().includes('virtual') || (race.location || '').toLowerCase().includes('virtuellt');
                    const isTrail = (race.tags || []).includes('trail') || isTrailRace(resolvedTitle);
                    const isVirtual = hasVirtualTag;
                    const isUltra = isUltraRace(resolvedTitle, race.distance);
                    const distStyle = getDistanceStyle(race.distance);

                    return (
                        <tr
                            key={race.id}
                            className="hover:bg-amber-500/5 transition-colors cursor-pointer group border-l-2 border-transparent hover:border-l-amber-500/50"
                            onClick={() => setSelectedActivity(race)}
                        >
                            <td className="px-3 py-1.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs font-bold text-slate-300">{formatRaceDateCompact(race.date)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-black">{race.date.substring(2, 4)}</span>
                                </div>
                            </td>
                            <td className="px-3 py-1.5">
                                <div className="font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1.5 flex-wrap text-xs">
                                    <span className="truncate max-w-[200px]">{resolvedTitle}</span>
                                    {isUltra && <span className="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                    {isTrail && !isUltra && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0 rounded border border-emerald-500/20 uppercase font-black tracking-widest">Trail</span>}
                                </div>
                            </td>
                            <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                {isVirtual ? <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Virtuellt</span> : (race.location || '-')}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                                {race.distance ? (
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${distStyle} whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity`}>
                                        {race.distance.toFixed(1)} km
                                    </span>
                                ) : '-'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-amber-300 text-xs">
                                {formatActivityDuration(race.durationMinutes)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-400 text-xs">
                                {calcPace(race.distance, race.durationMinutes)}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function SeriesCard({ series, onSelect, setSelectedActivity, formatActivityDuration }: any) {
    return (
        <div
            onClick={onSelect}
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
                {series.races.sort((a: any, b: any) => b.date.localeCompare(a.date)).map((r: any) => {
                    const isPb = r.id === series.stats.pb.id;
                    return (
                        <button
                            key={r.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedActivity(r);
                            }}
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
    );
}
