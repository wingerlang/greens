import { useState, useMemo } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';
import { formatActivityDuration } from '../../utils/formatters.ts';
import { RaceSeriesDetailModal } from './RaceSeriesDetailModal.tsx';
import { TourManager } from './TourManager.tsx';
import { Trophy, Plus, Medal, Copy as CopyIcon, Search } from 'lucide-react';

// Modulära komponenter och hooks
import { useRaceDashboard } from './races/hooks/useRaceDashboard.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { UpcomingRaceCard, UpcomingRaceCardCompact, UpcomingRaceCardList } from './races/UpcomingRaceCards.tsx';
import { TimelineTable } from './races/TimelineTable.tsx';
import { SeriesCard } from './races/SeriesCard.tsx';
import { AddRaceModal, BulkAddRaceModal } from './races/RaceModals.tsx';
import { HistoryChart } from './races/HistoryChart.tsx';
import { RaceDashboardStats } from './races/RaceDashboardStats.tsx';

interface RaceListProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
    filterStartDate?: string | null;
    filterEndDate?: string | null;
    subTab?: string;
    seriesId?: string;
    onSelectActivity?: (id: string | null) => void;
}

export function RaceList(props: RaceListProps) {
    const { plannedActivities, savePlannedActivities, deletePlannedActivity, currentUser, updateCurrentUser } = useData();

    const allHistoryActivities = useMemo(() => {
        const entryKeys = new Set(props.exerciseEntries.map(e => `${e.date.split('T')[0]}_${(e.distance || 0).toFixed(2)}`));
        const stravaEntries = props.universalActivities
            .filter(ua => {
                const dist = ua.performance?.distanceKm || 0;
                const key = `${ua.date.split('T')[0]}_${dist.toFixed(2)}`;
                return !entryKeys.has(key);
            })
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);
        return [...props.exerciseEntries, ...stravaEntries];
    }, [props.exerciseEntries, props.universalActivities]);

    const {
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
    } = useRaceDashboard({ 
        ...props,
        exerciseEntries: allHistoryActivities,
        plannedActivities, 
        savePlannedActivities, 
        deletePlannedActivity, 
        currentUser, 
        updateCurrentUser 
    });

    return (
        <div className="space-y-12 pb-20">
            {/* --- UPCOMING --- */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 gap-6">
                    <div>
                        <h2 className="text-4xl font-black text-white flex items-center gap-3">
                            <Trophy className="text-amber-500" size={36} /> Kommande Tävlingar
                        </h2>
                        <p className="text-slate-400 mt-2 font-medium">Planera dina mål och krossa motståndet.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/10 shadow-inner">
                            {(['cozy', 'compact', 'list'] as const).map(mode => (
                                <button key={mode} onClick={() => setUpcomingViewMode(mode)} className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${upcomingViewMode === mode ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsBulkAddModalOpen(true)} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl border border-white/5 transition-all text-xs uppercase tracking-widest">Bulk</button>
                        <button onClick={() => { setEditingRace(null); setIsAddModalOpen(true); }} className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"><Plus size={20} /> Planera</button>
                    </div>
                </div>

                {upcomingRaces.length > 0 ? (
                    <div className={upcomingViewMode === 'cozy' ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"}>
                        {upcomingRaces.map(r => (
                            upcomingViewMode === 'cozy' ? (
                                <UpcomingRaceCard key={r.id} race={r} historyRaces={races} allActivities={allHistoryActivities} onUpdate={handleSaveRace} onDelete={handleDeleteRace} onEdit={(r) => { setEditingRace(r); setIsAddModalOpen(true); }} />
                            ) : upcomingViewMode === 'compact' ? (
                                <UpcomingRaceCardCompact key={r.id} race={r} historyRaces={races} onEdit={(r) => { setEditingRace(r); setIsAddModalOpen(true); }} />
                            ) : (
                                <UpcomingRaceCardList key={r.id} race={r} onEdit={(r) => { setEditingRace(r); setIsAddModalOpen(true); }} />
                            )
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-900/30 rounded-3xl border-2 border-dashed border-white/5">
                        <Trophy className="mx-auto text-slate-800 mb-4" size={64} />
                        <h3 className="text-xl font-bold text-white mb-2">Inga lopp inplanerade</h3>
                        <button onClick={() => setIsAddModalOpen(true)} className="text-amber-500 font-black hover:underline uppercase tracking-widest text-xs">Lägg till ditt nästa mål nu →</button>
                    </div>
                )}
            </div>

            {/* --- HISTORY --- */}
            <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-8 md:p-12 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Medal size={200} /></div>
                
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-12">
                    <RaceDashboardStats stats={stats} />
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                            <input type="text" placeholder="Sök tävlingshistorik..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all font-bold placeholder:text-slate-600" />
                        </div>
                        <button onClick={() => setFilterPodium(!filterPodium)} className={`p-4 rounded-2xl border transition-all ${filterPodium ? 'bg-amber-500 border-amber-400 text-slate-950' : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-white'}`} title="Visa endast pallplatser"><Medal size={20} /></button>
                        <button onClick={() => {
                            const csv = ['Datum,Titel,Distans,Tid,Placering'].concat(races.map(r => `${r.date},${r.title || r.notes},${r.distance || ''},${r.durationMinutes},${r.raceDetails?.placement || ''}`)).join('\n');
                            navigator.clipboard.writeText(csv);
                        }} className="p-4 bg-slate-950/50 hover:bg-slate-800 text-slate-500 hover:text-white rounded-2xl border border-white/10 transition-all"><CopyIcon size={20} /></button>
                    </div>
                </div>

                <HistoryChart chartData={stats.chartData} />

                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex gap-8">
                            {(['timeline', 'series', 'tours'] as const).map(mode => (
                                <button key={mode} onClick={() => handleViewModeChange(mode)} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all relative ${viewMode === mode ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
                                    {mode === 'timeline' ? 'Tidslinje' : mode === 'series' ? 'Serier' : 'Tourer'}
                                    {viewMode === mode && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-full animate-in zoom-in-95 duration-300" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {viewMode === 'timeline' ? (
                        <div className="bg-slate-950/30 rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
                             <TimelineTable races={races} upcomingRaces={upcomingRaces} handleEditClick={(r) => { setEditingRace(r); setIsAddModalOpen(true); }} setSelectedActivity={(a) => props.onSelectActivity?.(a.id)} universalActivities={props.universalActivities} sortConfig={sortConfig} handleSort={handleSort} />
                        </div>
                    ) : viewMode === 'series' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {raceSeries.map(s => <SeriesCard key={s.name} series={s} onSelect={() => setSelectedSeries({ name: s.name, races: s.races })} setSelectedActivity={(a) => props.onSelectActivity?.(a.id)} formatActivityDuration={formatActivityDuration} />)}
                        </div>
                    ) : (<TourManager />)}
                </div>
            </div>

            {/* MODALS */}
            {selectedSeries && <RaceSeriesDetailModal seriesName={selectedSeries.name} races={selectedSeries.races} onClose={() => setSelectedSeries(null)} onSelectRace={(r) => { setSelectedSeries(null); props.onSelectActivity?.(r.id); }} />}
            {isAddModalOpen && <AddRaceModal activityToEdit={editingRace} races={races} onClose={() => { setIsAddModalOpen(false); setEditingRace(null); }} onSave={handleSaveRace} />}
            {isBulkAddModalOpen && <BulkAddRaceModal onClose={() => setIsBulkAddModalOpen(false)} onSaveAll={handleSaveBulk} />}
        </div>
    );
}
