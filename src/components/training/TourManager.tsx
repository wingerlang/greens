import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataShared.ts';
import { Tour, RaceDefinition, ExerciseEntry } from '../../models/types.ts';
import { 
    Trophy, 
    Calendar, 
    Plus, 
    ChevronRight, 
    CheckCircle2, 
    Circle, 
    Trash2, 
    Pencil,
    MapPin,
    Layers,
    TrendingUp
} from 'lucide-react';
import { CreateTourModal } from './CreateTourModal.tsx';
import { ActivityDetailModal } from '../activities/ActivityDetailModal.tsx';

export function TourManager() {
    const { 
        tours, 
        raceDefinitions, 
        unifiedActivities, 
        plannedActivities = [],
        users, // Get all users for the standings table
        deleteTour 
    } = useData();
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTour, setEditingTour] = useState<Tour | null>(null);
    const [selectedRaceActivity, setSelectedRaceActivity] = useState<any | null>(null);
    const [viewingStandings, setViewingStandings] = useState<Record<string, boolean>>({});
    const [standingsData, setStandingsData] = useState<Record<string, any[]>>({});
    const [isLoadingStandings, setIsLoadingStandings] = useState<Record<string, boolean>>({});

    const toggleStandings = async (tourId: string) => {
        const isCurrentlyViewing = viewingStandings[tourId];
        setViewingStandings(prev => ({ ...prev, [tourId]: !isCurrentlyViewing }));

        if (!isCurrentlyViewing && !standingsData[tourId]) {
            setIsLoadingStandings(prev => ({ ...prev, [tourId]: true }));
            try {
                const res = await fetch(`/api/tours/${tourId}/standings`);
                const data = await res.json();
                if (data.standings) {
                    setStandingsData(prev => ({ ...prev, [tourId]: data.standings }));
                }
            } catch (e) {
                console.error("Failed to fetch standings:", e);
            } finally {
                setIsLoadingStandings(prev => ({ ...prev, [tourId]: false }));
            }
        }
    };

    // Calculate points based on ranking within each race
    const getScoredStandings = (tour: Tour) => {
        const raw = standingsData[tour.id] || [];
        const raceIds = tour.raceDefinitionIds;
        
        // Group by race
        const byRace: Record<string, any[]> = {};
        raceIds.forEach(rid => {
            const results = raw.filter(r => r.raceDefinitionId === rid)
                .sort((a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0)); // Shortest time first
            byRace[rid] = results;
        });

        // Scoring system: 100, 80, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20...
        const pointsTable = [100, 80, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10];
        
        // Calculate points per user
        const userScores: Record<string, { total: number, races: Record<string, number> }> = {};
        
        Object.entries(byRace).forEach(([rid, results]) => {
            results.forEach((res, index) => {
                const points = pointsTable[index] || 5; // Default 5 points for completion beyond 20th
                if (!userScores[res.userId]) userScores[res.userId] = { total: 0, races: {} };
                userScores[res.userId].races[rid] = points;
                userScores[res.userId].total += points;
            });
        });

        return { byRace, userScores };
    };

    // Helper to find activities matching a race definition within a specific tour's timeframe
    const getRaceStatus = (defId: string, tour: Tour) => {
        const def = raceDefinitions.find(d => d.id === defId);
        if (!def) return { completed: false };

        const tourDate = tour.date;
        const tourYear = tourDate.split('-')[0];
        const selectedId = tour.selectedActivityIds?.[defId];
        
        // 1. Try to find the specific instance if selectedId exists
        let planned: any = null;
        let completed: any = null;

        if (selectedId) {
            // Check planned first
            planned = plannedActivities.find(p => p.id === selectedId);
            
            // Check completed (Universal or Unified)
            completed = unifiedActivities.find(a => 
                a.id === selectedId || 
                (planned?.externalId && (a.id === planned.externalId || a.externalId === planned.externalId))
            );
        }

        // 2. Fallback to name-based matching within the tour year if no specific instance found/selected
        if (!planned && !completed) {
            const matchStrings = [def.name.toLowerCase(), ...(def.aliases || []).map(a => a.toLowerCase())];
            const isMatch = (title: string) => {
                const t = title.toLowerCase();
                return matchStrings.some(ms => t.includes(ms));
            };

            planned = plannedActivities.find(p => 
                p.date.startsWith(tourYear) && 
                isMatch(p.title)
            );

            completed = unifiedActivities
                .filter(a => a.date.startsWith(tourYear) && isMatch(a.title || ''))
                .sort((a, b) => b.date.localeCompare(a.date))[0];
        }

        return {
            completed: !!completed,
            plannedInstance: planned,
            completedInstance: completed,
            displayDistance: completed?.distance || (completed as any)?.performance?.distanceKm || planned?.estimatedDistance || def.distance,
            displayDate: completed?.date || planned?.date,
            displayLocation: (completed as any)?.location || (completed as any)?.performance?.source?.location || planned?.raceDetails?.logistics?.location || def.location
        };
    };

    const sortedTours = useMemo(() => {
        return [...tours].sort((a, b) => b.date.localeCompare(a.date));
    }, [tours]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Actions */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <Trophy className="text-emerald-500" size={28} />
                        Mina Tourer & Cups
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Egenkomponerade race-serier med poäng och framsteg.</p>
                </div>
                <button 
                    onClick={() => {
                        setEditingTour(null);
                        setIsCreateModalOpen(true);
                    }}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95"
                >
                    <Plus size={20} /> Skapa Cup
                </button>
            </div>

            {/* Tours Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sortedTours.map(tour => {
                    const stats = tour.raceDefinitionIds.reduce((acc, id) => {
                        const status = getRaceStatus(id, tour);
                        if (status.completed) acc.completed++;
                        return acc;
                    }, { completed: 0, total: tour.raceDefinitionIds.length });

                    const progress = (stats.completed / (stats.total || 1)) * 100;

                    return (
                        <div 
                            key={tour.id}
                            className="group bg-slate-900 border border-white/10 rounded-[2rem] p-8 hover:border-emerald-500/30 transition-all shadow-2xl relative overflow-hidden flex flex-col"
                        >
                            {/* Background Glow */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/5 blur-[80px] rounded-full group-hover:bg-emerald-500/10 transition-all duration-700" />
                            
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em] mb-2">
                                        <TrendingUp size={12} /> Season {tour.date.substring(0, 4)}
                                    </div>
                                    <h4 className="text-3xl font-black text-white tracking-tight">{tour.name}</h4>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => toggleStandings(tour.id)}
                                        className={`p-3 rounded-2xl transition-all ${viewingStandings[tour.id] ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
                                        title="Poängtabell / Standings"
                                    >
                                        <Trophy size={18} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setEditingTour(tour);
                                            setIsCreateModalOpen(true);
                                        }}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm('Vill du verkligen ta bort denna tour?')) {
                                                deleteTour(tour.id);
                                            }
                                        }}
                                        className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-8 p-6 bg-slate-950/50 rounded-3xl border border-white/5">
                                <div className="flex justify-between items-end mb-3">
                                    <div className="text-sm font-bold text-slate-400">Genomförda lopp</div>
                                    <div className="text-2xl font-black text-white">{stats.completed} <span className="text-slate-600">/ {stats.total}</span></div>
                                </div>
                                <div className="h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                             {/* Race List / Standings Toggle */}
                            {!viewingStandings[tour.id] ? (
                                <div className="space-y-3 flex-1">
                                    {tour.raceDefinitionIds.slice(0, 8).map(id => {
                                        const def = raceDefinitions.find(d => d.id === id);
                                        const status = getRaceStatus(id, tour);
                                        if (!def) return null;

                                        const isTrail = def.name.toLowerCase().includes('trail') || status.plannedInstance?.raceDetails?.isTrail;
                                        const isUltra = (status.displayDistance || 0) > 45;

                                        return (
                                            <button 
                                                key={id} 
                                                onClick={() => {
                                                    if (status.completedInstance) setSelectedRaceActivity(status.completedInstance);
                                                }}
                                                className={`w-full flex items-center justify-between p-4 bg-slate-950/30 rounded-2xl border transition-all text-left ${status.completed ? 'border-emerald-500/10 hover:border-emerald-500/30 group/race' : 'border-white/5 hover:border-white/10'}`}
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className={`transition-all duration-500 shrink-0 ${status.completed ? 'text-emerald-500' : 'text-slate-700'}`}>
                                                        {status.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <div className={`text-sm font-black truncate ${status.completed ? 'text-white' : 'text-slate-500'}`}>{def.name}</div>
                                                            {isUltra && <span className="shrink-0 text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0.5 rounded border border-fuchsia-500/30 uppercase font-black">Ultra</span>}
                                                            {isTrail && !isUltra && <span className="shrink-0 text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/20 uppercase font-black">Trail</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                                                            {status.displayDate && <span className="flex items-center gap-1"><Calendar size={10} /> {status.displayDate}</span>}
                                                            {status.displayLocation && <span className="flex items-center gap-1 hidden sm:flex"><MapPin size={10} /> {status.displayLocation}</span>}
                                                            {!status.completed && status.plannedInstance && <span className="text-emerald-500/70 italic text-[9px]">(Planerad)</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-right shrink-0">
                                                    {status.displayDistance && <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter"><Layers size={10} className="inline mr-1" /> {status.displayDistance} km</div>}
                                                    {(status.completedInstance as any)?.performance?.durationMinutes && (
                                                        <div className="text-[10px] text-emerald-500 font-black tabular-nums">{(status.completedInstance as any).performance.durationMinutes}m</div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {tour.raceDefinitionIds.length > 8 && (
                                        <button 
                                            onClick={() => {
                                                setEditingTour(tour);
                                                setIsCreateModalOpen(true);
                                            }}
                                            className="w-full text-center py-3 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 rounded-xl border border-dashed border-white/10 transition-all"
                                        >
                                            + {tour.raceDefinitionIds.length - 8} fler lopp
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                                    {isLoadingStandings[tour.id] ? (
                                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                                            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            <div className="text-[10px] font-black uppercase tracking-widest">Hämtar resultat...</div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
                                            <table className="w-full border-separate border-spacing-y-2">
                                                <thead>
                                                    <tr>
                                                        <th className="text-left py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Deltagare</th>
                                                        {tour.raceDefinitionIds.map(rid => (
                                                            <th key={rid} className="text-center py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                                                                {raceDefinitions.find(d => d.id === rid)?.name.split(' ')[0] || 'Lopp'}
                                                            </th>
                                                        ))}
                                                        <th className="text-right py-2 px-3 text-[9px] font-black text-emerald-500 uppercase tracking-widest">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const { userScores } = getScoredStandings(tour);
                                                        const sortedUsers = (users || []).filter(u => userScores[u.id])
                                                            .sort((a, b) => (userScores[b.id]?.total || 0) - (userScores[a.id]?.total || 0));
                                                        
                                                        if (sortedUsers.length === 0) {
                                                            return (
                                                                <tr>
                                                                    <td colSpan={tour.raceDefinitionIds.length + 2} className="text-center py-12 text-slate-600 italic text-xs">
                                                                        Inga slutförda lopp än.
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }

                                                        return sortedUsers.map(user => (
                                                            <tr key={user.id} className="group/row">
                                                                <td className="bg-slate-950/40 rounded-l-xl p-3 border-l border-t border-b border-white/5">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-white overflow-hidden">
                                                                            {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : user.username[0].toUpperCase()}
                                                                        </div>
                                                                        <span className="text-xs font-bold text-white truncate max-w-[80px] sm:max-w-none">{user.name || user.username}</span>
                                                                    </div>
                                                                </td>
                                                                {tour.raceDefinitionIds.map(rid => (
                                                                    <td key={rid} className="bg-slate-950/40 p-3 border-t border-b border-white/5 text-center">
                                                                        {userScores[user.id]?.races[rid] ? (
                                                                            <span className="text-xs font-black text-emerald-400">+{userScores[user.id].races[rid]}</span>
                                                                        ) : (
                                                                            <span className="text-slate-800">—</span>
                                                                        )}
                                                                    </td>
                                                                ))}
                                                                <td className="bg-emerald-500/10 rounded-r-xl p-3 border-r border-t border-b border-emerald-500/20 text-right">
                                                                    <span className="text-sm font-black text-emerald-400">{userScores[user.id]?.total || 0}</span>
                                                                </td>
                                                            </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button 
                                onClick={() => {
                                    setEditingTour(tour);
                                    setIsCreateModalOpen(true);
                                }}
                                className="mt-8 w-full py-4 bg-slate-950/50 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/50 rounded-2xl text-slate-400 hover:text-emerald-400 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                Detaljer & Hantera <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    );
                })}

                {tours.length === 0 && (
                    <div className="col-span-2 py-24 text-center bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-white/5 group">
                        <Trophy className="mx-auto text-slate-800 mb-6 group-hover:text-emerald-500/30 transition-all duration-700" size={80} />
                        <h3 className="text-2xl font-black text-white mb-3">Inga tourer skapade än</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg font-medium">Skapa din första cup genom att välja ut lopp från din historik eller planering.</p>
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-slate-950 px-10 py-4 rounded-2xl font-black uppercase text-sm border border-emerald-500 transition-all active:scale-95 shadow-xl shadow-emerald-500/10"
                        >
                            Starta en Tour
                        </button>
                    </div>
                )}
            </div>

            {isCreateModalOpen && (
                <CreateTourModal 
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setEditingTour(null);
                    }}
                    editingTour={editingTour || undefined}
                />
            )}

            {selectedRaceActivity && (
                <ActivityDetailModal 
                    activity={selectedRaceActivity}
                    universalActivity={selectedRaceActivity}
                    onClose={() => setSelectedRaceActivity(null)}
                />
            )}
        </div>
    );
}
