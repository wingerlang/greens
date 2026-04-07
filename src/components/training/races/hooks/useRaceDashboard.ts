import { useState, useMemo, useEffect, useCallback } from 'react';
import { ExerciseEntry, UniversalActivity, PlannedActivity, User } from '../../../../models/types.ts';
import { isCompetition } from '../../../../utils/activityUtils.ts';
import { normalizeRaceTitle } from '../utils.ts';
import { 
    RaceSeries, 
    DashboardStats, 
    SortConfig, 
    ViewMode, 
    UpcomingViewMode, 
    SeriesSortMode 
} from '../types.ts';

interface UseRaceDashboardProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
    plannedActivities: PlannedActivity[];
    savePlannedActivities: (newList: PlannedActivity[]) => void;
    deletePlannedActivity: (id: string) => void;
    currentUser?: User | null;
    updateCurrentUser?: (u: Partial<User>) => void;
    filterStartDate?: string | null;
    filterEndDate?: string | null;
    subTab?: string;
    seriesId?: string;
}

export function useRaceDashboard({
    exerciseEntries,
    universalActivities,
    plannedActivities,
    savePlannedActivities,
    deletePlannedActivity,
    currentUser,
    updateCurrentUser,
    filterStartDate,
    filterEndDate,
    subTab,
    seriesId
}: UseRaceDashboardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
    const [editingRace, setEditingRace] = useState<PlannedActivity | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get('tab');
        if (urlTab === 'series' || urlTab === 'serier') return 'series';
        if (urlTab === 'tours' || urlTab === 'tourer') return 'tours';
        if (currentUser?.settings?.lastActiveRaceTab) return currentUser.settings.lastActiveRaceTab as ViewMode;
        return 'timeline';
    });
    const [upcomingViewMode, setUpcomingViewMode] = useState<UpcomingViewMode>('cozy');
    const [selectedSeries, setSelectedSeries] = useState<{ name: string, races: ExerciseEntry[] } | null>(null);
    const [seriesSort, setSeriesSort] = useState<SeriesSortMode>('count');
    const [filterPodium, setFilterPodium] = useState(false);

    // Sync Props to State
    useEffect(() => {
        if (!subTab) return;
        if (subTab === 'serier' || subTab === 'series') setViewMode('series');
        else if (subTab === 'tours' || subTab === 'tourer') setViewMode('tours');
        else setViewMode('timeline');
    }, [subTab]);

    const handleViewModeChange = useCallback((mode: ViewMode) => {
        setViewMode(mode);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', mode);
        window.history.replaceState({}, '', url.toString());
        if (currentUser && updateCurrentUser) {
            updateCurrentUser({ settings: { ...currentUser.settings, lastActiveRaceTab: mode } });
        }
    }, [currentUser, updateCurrentUser]);

    const handleSaveRace = useCallback((race: PlannedActivity) => {
        const exists = plannedActivities.some(a => a.id === race.id);
        const newList = exists ? plannedActivities.map(a => a.id === race.id ? race : a) : [...plannedActivities, race];
        savePlannedActivities(newList);
        setIsAddModalOpen(false);
        setEditingRace(null);
    }, [plannedActivities, savePlannedActivities]);

    const handleSaveBulk = useCallback((races: PlannedActivity[]) => {
        savePlannedActivities([...plannedActivities, ...races]);
        setIsBulkAddModalOpen(false);
    }, [plannedActivities, savePlannedActivities]);

    const handleDeleteRace = useCallback((id: string) => {
        deletePlannedActivity(id);
    }, [deletePlannedActivity]);

    const handleSort = useCallback((key: string) => {
        setSortConfig(p => ({
            key,
            direction: p.key === key && p.direction === 'desc' ? 'asc' : 'desc'
        }));
    }, []);

    const upcomingRaces = useMemo(() => {
        return plannedActivities
            .filter(a => isCompetition({ plan: a }) && a.status !== 'COMPLETED')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [plannedActivities]);

    const races = useMemo(() => {
        let items = exerciseEntries.filter(e => isCompetition(e));

        // Deduplication Logic
        const itemsByDate: Record<string, ExerciseEntry[]> = {};
        items.forEach(item => {
            const dateKey = item.date.split('T')[0];
            if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
            itemsByDate[dateKey].push(item);
        });

        const deduplicatedItems: ExerciseEntry[] = [];
        Object.values(itemsByDate).forEach(dayItems => {
            if (dayItems.length === 1) { deduplicatedItems.push(dayItems[0]); return; }
            const mergedItem = dayItems.find(i => (i.notes || '').includes('Merged from') || (i.title || '').includes('Merged from'));
            deduplicatedItems.push(mergedItem || dayItems[0]);
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

        if (filterPodium) {
            items = items.filter(r => r.raceDetails?.placement && r.raceDetails.placement <= 3);
        }

        return items.sort((a, b) => {
            let valA: any;
            let valB: any;
            if (sortConfig.key === 'placement') {
                valA = a.raceDetails?.placement || 999999;
                valB = b.raceDetails?.placement || 999999;
            } else if (sortConfig.key === 'distance') {
                valA = a.distance || 0;
                valB = b.distance || 0;
            } else {
                valA = a[sortConfig.key as keyof ExerciseEntry];
                valB = b[sortConfig.key as keyof ExerciseEntry];
            }
            if (valA === undefined) valA = 0;
            if (valB === undefined) valB = 0;
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [exerciseEntries, searchQuery, sortConfig, filterStartDate, filterEndDate, filterPodium]);

    const raceSeries = useMemo<RaceSeries[]>(() => {
        const groups: Record<string, ExerciseEntry[]> = {};
        const resolveTitle = (r: ExerciseEntry) => {
            if (r.title && !r.title.startsWith('Merged')) return r.title;
            const ua = universalActivities.find(u => u.id === r.id);
            if (ua?.mergeInfo?.isMerged && ua.mergeInfo.originalActivityIds?.length) {
                const components = universalActivities.filter(u => ua.mergeInfo!.originalActivityIds!.includes(u.id));
                const bestComp = components.find(c => c.plan?.title && !c.plan.title.startsWith('Merged'));
                if (bestComp) return bestComp.plan?.title || 'Okänd tävling';
            }
            return r.notes || r.type || 'Okänd Aktivitet';
        };

        races.forEach(r => {
            const normalized = normalizeRaceTitle(resolveTitle(r));
            const key = normalized.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });

        return Object.entries(groups).map(([name, groupRaces]) => {
            const pb = groupRaces.reduce((best, curr) => curr.durationMinutes < best.durationMinutes ? curr : best, groupRaces[0]);
            return {
                name, races: groupRaces,
                stats: { 
                    count: groupRaces.length, 
                    pb, 
                    avgDuration: groupRaces.reduce((sum, r) => sum + r.durationMinutes, 0) / groupRaces.length, 
                    years: Array.from(new Set(groupRaces.map(r => r.date.substring(0, 4)))).sort()
                }
            };
        }).sort((a, b) => {
            if (seriesSort === 'count') return b.races.length - a.races.length;
            if (seriesSort === 'name') return a.name.localeCompare(b.name);
            if (seriesSort === 'latest') return b.races.reduce((l, r) => r.date > l ? r.date : l, '').localeCompare(a.races.reduce((l, r) => r.date > l ? r.date : l, ''));
            return 0;
        });
    }, [races, universalActivities, seriesSort]);

    const stats = useMemo<DashboardStats>(() => {
        const totalDistance = races.reduce((sum, r) => sum + (r.distance || 0), 0);
        const grouped: Record<string, { count: number, projected: number }> = {};
        
        races.forEach(r => {
            const yr = r.date.substring(0, 4);
            grouped[yr] = grouped[yr] || { count: 0, projected: 0 };
            grouped[yr].count++;
        });
        
        upcomingRaces.forEach(r => {
            if (r.raceDetails?.isRegistered !== false) {
                const yr = r.date.substring(0, 4);
                grouped[yr] = grouped[yr] || { count: 0, projected: 0 };
                grouped[yr].projected++;
            }
        });

        const racesWithPlacement = races.filter(r => r.raceDetails?.placement);
        const goldCount = racesWithPlacement.filter(r => r.raceDetails?.placement === 1).length;
        const podiumCount = racesWithPlacement.filter(r => r.raceDetails?.placement! <= 3).length;
        const percentiles = racesWithPlacement.filter(r => r.raceDetails?.totalParticipants).map(r => (r.raceDetails!.placement! / r.raceDetails!.totalParticipants!) * 100);
        
        return {
            totalDistance, count: races.length, 
            chartData: Object.entries(grouped).map(([date, d]) => ({ date, ...d })).sort((a,b) => a.date.localeCompare(b.date)),
            goldCount, podiumCount,
            top10Count: percentiles.filter(p => p <= 10).length,
            avgPercent: percentiles.length ? percentiles.reduce((a,b)=>a+b,0)/percentiles.length : 0
        };
    }, [races, upcomingRaces]);

    // Handle initial seriesId from URL
    useEffect(() => {
        if (!seriesId) return;
        const match = raceSeries.find(s => s.name.toLowerCase() === decodeURIComponent(seriesId).toLowerCase());
        if (match) setSelectedSeries({ name: match.name, races: match.races });
    }, [seriesId, raceSeries]);

    return {
        searchQuery, setSearchQuery,
        sortConfig, handleSort,
        isAddModalOpen, setIsAddModalOpen,
        isBulkAddModalOpen, setIsBulkAddModalOpen,
        editingRace, setEditingRace,
        viewMode, handleViewModeChange,
        upcomingViewMode, setUpcomingViewMode,
        selectedSeries, setSelectedSeries,
        seriesSort, setSeriesSort,
        filterPodium, setFilterPodium,
        upcomingRaces, races, raceSeries, stats,
        handleSaveRace, handleSaveBulk, handleDeleteRace
    };
}
