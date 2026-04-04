import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataShared.ts';
import { Tour, TourFormData, RaceDefinition } from '../../models/types.ts';
import { X, Trophy, Search, Plus, Calendar, CheckCircle2, AlertCircle, MapPin, Layers, History } from 'lucide-react';
import { getISODate } from '../../models/types.ts';

interface CreateTourModalProps {
    onClose: () => void;
    editingTour?: Tour;
}

export function CreateTourModal({ onClose, editingTour }: CreateTourModalProps) {
    const { 
        raceDefinitions, 
        tours,
        plannedActivities,
        unifiedActivities,
        addTour, 
        updateTour,
        addRaceDefinition
    } = useData();

    // Helper: Normalize race names to identify duplicates and match definitions
    const normalizeRaceName = (name: string) => {
        let normalized = name.toLowerCase();
        // 1. Remove years (YYYY)
        normalized = normalized.replace(/\b(19|20)\d{2}\b/g, '');
        // 2. Remove distances (e.g., 34k, 21km, 1000m, 50 miles)
        normalized = normalized.replace(/\b\d+([,.]\d+)?\s*(km|k|m|mil|miles)\b/g, '');
        // 3. Remove "trailing junk" separators: " - ...", ", ..."
        normalized = normalized.split(/\s+[-–—]\s+/)[0];
        normalized = normalized.split(/,\s+/)[0];
        // 4. Remove emojis and special chars
        normalized = normalized.replace(/[\u{1F300}-\u{1FAFF}]/gu, '');
        normalized = normalized.replace(/['"()]/g, '');
        // 5. Cleanup whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();
        // 6. Capitalize for display
        return normalized.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    // Helper: Find upcoming date for a definition
    const getUpcomingDate = (def: RaceDefinition) => {
        const matches = plannedActivities.filter(a => {
            if (a.status === 'COMPLETED' || a.date < getISODate()) return false;
            const isRace = a.isRace || a.category === 'RACE';
            if (!isRace) return false;
            
            const title = (a.title || '').toLowerCase();
            const seriesName = a.raceDetails?.seriesName?.toLowerCase();
            const defName = def.name.toLowerCase();
            
            return title.includes(defName) || 
                   seriesName === defName || 
                   (def.aliases || []).some(alias => title.includes(alias.toLowerCase()));
        });
        
        if (matches.length === 0) return null;
        return matches.sort((a, b) => a.date.localeCompare(b.date))[0].date;
    };

    const [name, setName] = useState(editingTour?.name || '');
    const [date, setDate] = useState(editingTour?.date || getISODate());
    const [selectedActivityIds, setSelectedActivityIds] = useState<Record<string, string>>(editingTour?.selectedActivityIds || {});
    
    // Virtual IDs allow us to track selected races that don't have a definition yet
    const [selectedRaceIds, setSelectedRaceIds] = useState<Set<string>>(() => {
        if (editingTour) return new Set(editingTour.raceDefinitionIds || []);
        
        // AUTO-SELECT upcoming races from timeline
        const upcomingRaces = plannedActivities.filter(a => (a.isRace || a.category === 'RACE') && a.status !== 'COMPLETED' && a.date >= getISODate());
        const autoSelected = new Set<string>();
        
        upcomingRaces.forEach(a => {
            const norm = normalizeRaceName(a.title);
            const existing = raceDefinitions.find(d => d.name === norm || (d.aliases || []).includes(norm));
            if (existing) {
                autoSelected.add(existing.id);
            } else {
                autoSelected.add(`virtual_${norm}`);
            }
        });
        
        return autoSelected;
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [yearFilter, setYearFilter] = useState('Alla');

    const groupedDefinitions = useMemo(() => {
        const optionsList: Array<{ 
            def: { id: string, name: string, distance?: number, location?: string },
            date?: string,
            isVirtual: boolean, 
            activityId?: string,
            title?: string,
            type: 'upcoming' | 'past' | 'defined' | 'manual',
            tourId?: string,
            tourName?: string
        }> = [];

        // 1. Add all existing RaceDefinitions as base
        raceDefinitions.forEach(d => {
            optionsList.push({
                def: { id: d.id, name: d.name, distance: d.distance, location: d.location },
                isVirtual: false,
                type: 'defined'
            });
        });

        // 2. Add upcoming from timeline (upgrade to 'upcoming')
        const timelineRaces = plannedActivities
            .filter(a => (a.isRace || a.category === 'RACE') && a.status !== 'COMPLETED' && a.date >= getISODate());

        timelineRaces.forEach(a => {
            const norm = normalizeRaceName(a.title);
            const existing = raceDefinitions.find(d => d.name.toLowerCase() === norm.toLowerCase() || (d.aliases || []).some(al => al.toLowerCase() === norm.toLowerCase()));
            optionsList.push({
                def: existing ? { id: existing.id, name: existing.name, distance: existing.distance } : { id: `virtual_${norm}`, name: norm, distance: a.actualDistance || a.estimatedDistance },
                date: a.date,
                isVirtual: !existing,
                activityId: a.id,
                title: a.title,
                type: 'upcoming'
            });
        });

        // 3. Add past races from unifiedActivities 
        unifiedActivities.forEach(a => {
            const title = a.title || 'Okänt lopp';
            if (a.subType === 'race' || title.toLowerCase().includes('loppet') || title.toLowerCase().includes('race') || title.toLowerCase().includes('trail')) {
                const norm = normalizeRaceName(title);
                const existing = raceDefinitions.find(d => d.name.toLowerCase() === norm.toLowerCase() || (d.aliases || []).some(al => al.toLowerCase() === norm.toLowerCase()));
                optionsList.push({
                    def: existing ? { id: existing.id, name: existing.name, distance: existing.distance } : { id: `virtual_${norm}`, name: norm, distance: a.distance, location: a.location },
                    date: a.date,
                    isVirtual: !existing,
                    activityId: (a as any)._mergeData?.id || a.id,
                    title: title,
                    type: 'past'
                });
            }
        });

        // 1. Calculate assigned cups
        optionsList.forEach(opt => {
            const otherTour = tours.find(t => t.id !== editingTour?.id && t.raceDefinitionIds?.includes(opt.def.id));
            if (otherTour) {
                opt.tourId = otherTour.id;
                opt.tourName = otherTour.name;
            }
        });

        // 2. Helper to check selection status
        const isOptSelected = (o: any) => selectedRaceIds.has(o.def.id) && (o.activityId ? selectedActivityIds[o.def.id] === o.activityId : true);

        // 3. Ensure every ID in selectedRaceIds is represented, even if not in current activity lists
        const representedIds = new Set(optionsList.map(o => `${o.def.id}_${o.activityId || ''}`));
        Array.from(selectedRaceIds).forEach(rid => {
            const actId = selectedActivityIds[rid];
            const key = `${rid}_${actId || ''}`;
            
            if (!representedIds.has(key)) {
                const def = raceDefinitions.find(d => d.id === rid);
                optionsList.push({
                    def: def ? { id: def.id, name: def.name, distance: def.distance } : { id: rid, name: "Okänt lopp (Laddar...)", distance: 0 },
                    activityId: actId,
                    type: 'manual',
                    isVirtual: !def,
                    date: '',
                    title: def?.name || "Okänt lopp",
                });
                representedIds.add(key);
            }
        });

        // 4. Calculate available years
        const uniqueYears = Array.from(new Set(optionsList.map(o => o.date ? o.date.substring(0, 4) : '').filter(Boolean))).sort((a, b) => b.localeCompare(a));

        // 5. Filter search (only for non-selected lists)
        const searchFiltered = optionsList.filter(o => {
            const matchSearch = o.def.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               (o.title && o.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                               (o.def.location && o.def.location.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchYear = yearFilter === 'Alla' || (o.date && o.date.startsWith(yearFilter));
            return matchSearch && matchYear;
        });

        // 6. Group results
        const selected = optionsList.filter(isOptSelected)
             .sort((a, b) => a.def.name.localeCompare(b.def.name));

        const upcoming = searchFiltered.filter(o => o.type === 'upcoming' && !o.tourId && !isOptSelected(o))
             .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
             
        const available = searchFiltered.filter(o => o.type === 'past' && !o.tourId && !isOptSelected(o))
             .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.def.name.localeCompare(b.def.name));
             
        const assigned = searchFiltered.filter(o => !!o.tourId && !isOptSelected(o))
             .sort((a, b) => a.def.name.localeCompare(b.def.name));

        return { upcoming, available, assigned, selected, uniqueYears, allOptions: optionsList };
    }, [raceDefinitions, tours, plannedActivities, unifiedActivities, searchTerm, yearFilter, editingTour, selectedRaceIds, selectedActivityIds]);

    const toggleRace = (id: string, activityId?: string) => {
        const nextIds = new Set(selectedRaceIds);
        const nextInstances = { ...selectedActivityIds };

        if (nextIds.has(id)) {
            // Already tracking this RaceDefinition. Are they swapping instance, or toggling it entirely off?
            if (nextInstances[id] !== activityId) {
                if (activityId) nextInstances[id] = activityId;
                else delete nextInstances[id];
            } else {
                nextIds.delete(id);
                delete nextInstances[id];
            }
        } else {
            nextIds.add(id);
            if (activityId) {
                nextInstances[id] = activityId;
            }
        }
        setSelectedRaceIds(nextIds);
        setSelectedActivityIds(nextInstances);
    };

    const selectAllUpcoming = () => {
        const nextIds = new Set(selectedRaceIds);
        const nextInstances = { ...selectedActivityIds };
        groupedDefinitions.upcoming.forEach(u => {
            nextIds.add(u.def.id);
            if (u.activityId) nextInstances[u.def.id] = u.activityId;
        });
        setSelectedRaceIds(nextIds);
        setSelectedActivityIds(nextInstances);
    };

    const deselectAllUpcoming = () => {
        const nextIds = new Set(selectedRaceIds);
        const nextInstances = { ...selectedActivityIds };
        groupedDefinitions.upcoming.forEach(u => {
            nextIds.delete(u.def.id);
            delete nextInstances[u.def.id];
        });
        setSelectedRaceIds(nextIds);
        setSelectedActivityIds(nextInstances);
    };

    const handleSave = async () => {
        if (!name || !date) return;

        const finalRaceIds: string[] = [];

        // Resolve virtual IDs by creating definitions
        const instanceMapping: Record<string, string> = {};

        for (const id of Array.from(selectedRaceIds)) {
            let finalId = id;
            if (id.startsWith('virtual_')) {
                const normName = id.replace('virtual_', '');
                // Check if someone else created it during our session
                const existing = raceDefinitions.find(d => d.name.toLowerCase() === normName.toLowerCase());
                if (existing) {
                    finalId = existing.id;
                } else {
                    // Create new definition
                    const optInfo = groupedDefinitions.allOptions.find(u => u.def.id === id);
                    const newDef = addRaceDefinition({
                        name: normName,
                        distance: optInfo?.def.distance || 0,
                        aliases: [],
                        matches: [],
                        location: '',
                        website: '',
                        isCup: false
                    });
                    if (newDef?.id) finalId = newDef.id;
                }
            }

            finalRaceIds.push(finalId);
            if (selectedActivityIds[id]) {
                instanceMapping[finalId] = selectedActivityIds[id];
            }
        }

        const tourData: TourFormData = {
            name,
            date,
            raceDefinitionIds: finalRaceIds,
            selectedActivityIds: instanceMapping
        };

        if (editingTour) {
            updateTour(editingTour.id, tourData);
        } else {
            addTour(tourData);
        }
        onClose();
    };

    const renderRaceCard = (def: { id: string, name: string, distance?: number, location?: string }, options: { badge?: string, badgeType?: 'upcoming' | 'assigned', subText?: string, activityId?: string, title?: string } = {}) => {
        const isSelected = selectedRaceIds.has(def.id) && selectedActivityIds[def.id] === options.activityId;
        return (
            <button 
                key={`${def.id}-${options.activityId || 'base'}`}
                onClick={() => toggleRace(def.id, options.activityId)}
                className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950/50 border-white/5 hover:border-white/10'}`}
            >
                <div className="flex items-center gap-3 text-left w-full">
                    <div className={`shrink-0 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-white/20 group-hover:border-emerald-500/50'}`}>
                        {isSelected && <CheckCircle2 size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <div className={`font-black tracking-tight truncate text-xs ${isSelected ? 'text-white' : 'text-slate-300'}`}>{options.title || def.name}</div>
                            {options.badge && (
                                <div className={`shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                    options.badgeType === 'upcoming' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                                }`}>
                                    {options.badge}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                            {def.location && <span className="flex items-center gap-1"><MapPin size={10} /> {def.location}</span>}
                            {def.distance && <span className="flex items-center gap-1"><Layers size={10} /> {def.distance} km</span>}
                            {options.subText && <span className="text-slate-600 font-black italic">{options.subText}</span>}
                        </div>
                    </div>
                </div>
            </button>
        );
    };

    const hasRaces = groupedDefinitions.upcoming.length > 0 || groupedDefinitions.available.length > 0 || groupedDefinitions.assigned.length > 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-5xl h-[98dvh] md:h-[92vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Visual Flair */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-500" />

                {/* Header */}
                <div className="p-5 md:p-6 border-b border-white/5 flex justify-between items-start shrink-0">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest mb-1">
                            <Layers size={14} /> Tour Management
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white">
                            {editingTour ? 'Redigera Tour' : 'Skapa Ny Tour'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden p-3 md:p-5 flex flex-col gap-3">
                    
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                        <div className="col-span-2 md:col-span-1">
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block tracking-widest">Namn på Tour / Cup</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="T.ex. Vintercupen 2026"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:border-emerald-500/50 focus:outline-none transition-all text-base"
                            />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block tracking-widest">Startdatum / Referens</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:border-emerald-500/50 focus:outline-none transition-all text-base"
                            />
                        </div>
                    </div>

                    {/* Race Selector */}
                    <div className="flex-1 min-h-0 flex flex-col pt-2 border-t border-white/5 gap-2">
                        <div className="shrink-0 flex justify-between items-end">
                            <div>
                                <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                                    <Trophy size={16} className="text-slate-400" />
                                    Välj ingående lopp
                                </h3>
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    value={yearFilter}
                                    onChange={e => setYearFilter(e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/30"
                                >
                                    <option value="Alla">Alla år</option>
                                    {groupedDefinitions.uniqueYears.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                    <input 
                                        type="text"
                                        placeholder="Sök lopp..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="bg-slate-950 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/30 w-32 sm:w-auto"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 pb-4 custom-scrollbar space-y-4">
                            {!hasRaces && groupedDefinitions.selected.length === 0 && (
                                <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3 bg-slate-950/30 rounded-3xl border border-dashed border-white/5">
                                    <AlertCircle size={32} className="text-slate-700" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold">Inga lopp hittades</p>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-600">Planera lopp i kalendern eller skapa definitioner</p>
                                    </div>
                                </div>
                            )}

                            {/* Group 0: Selected */}
                            {groupedDefinitions.selected.length > 0 && (
                                <div className="space-y-3 bg-emerald-500/[0.03] p-4 rounded-3xl border border-emerald-500/30">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-[10px] uppercase font-black text-emerald-500 tracking-[0.2em] flex items-center gap-2">
                                            <CheckCircle2 size={12} /> Valda Lopp i Cupen ({groupedDefinitions.selected.length})
                                        </h4>
                                        <div className="text-[9px] font-black text-emerald-500/50 uppercase tracking-tighter">Klicka för att ta bort</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {groupedDefinitions.selected.map(o => renderRaceCard(o.def, { badge: o.type === 'defined' ? 'Definition' : o.date, badgeType: 'upcoming', activityId: o.activityId, title: o.title }))}
                                    </div>
                                </div>
                            )}

                            {/* Group 1: Upcoming */}
                            {groupedDefinitions.upcoming.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-[10px] uppercase font-black text-emerald-500 tracking-[0.2em] flex items-center gap-2">
                                            <Calendar size={12} /> Kommande Planerade Lopp
                                        </h4>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={selectAllUpcoming}
                                                className="text-[9px] font-black uppercase tracking-tighter text-emerald-500 hover:text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20"
                                            >
                                                Markera alla
                                            </button>
                                            <button 
                                                onClick={deselectAllUpcoming}
                                                className="text-[9px] font-black uppercase tracking-tighter text-rose-500 hover:text-rose-400 px-2 py-1 bg-rose-500/10 rounded-lg transition-colors border border-rose-500/20"
                                            >
                                                Avmarkera alla
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {groupedDefinitions.upcoming.map(({ def, date, activityId, title }) => renderRaceCard(def, { badge: date, badgeType: 'upcoming', activityId, title }))}
                                    </div>
                                </div>
                            )}

                            {/* Group 2: Available */}
                            {groupedDefinitions.available.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] flex items-center gap-2 mb-1">
                                        <History size={12} /> Historiska Lopp & Andra Val
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {groupedDefinitions.available.map(o => renderRaceCard(o.def, o.type === 'past' ? { badge: o.date, badgeType: 'assigned', activityId: o.activityId, title: o.title } : {activityId: o.activityId}))}
                                    </div>
                                </div>
                            )}

                            {/* Group 3: Assigned */}
                            {groupedDefinitions.assigned.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] uppercase font-black text-slate-600 tracking-[0.2em] flex items-center gap-2 mb-1">
                                        <AlertCircle size={12} /> Redan med i annan Cup
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                        {groupedDefinitions.assigned.map(o => renderRaceCard(o.def, { badge: 'I annan cup', subText: `Ingår redan i "${o.tourName}"`, activityId: o.activityId }))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 md:p-6 border-t border-white/5 bg-slate-950/50 flex justify-end gap-3 shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-400 hover:text-white font-bold transition-colors text-sm"
                    >
                        Avbryt
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!name || selectedRaceIds.size === 0}
                        className="px-7 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl transition-all transform active:scale-95 shadow-lg shadow-emerald-500/10 text-sm"
                    >
                        {editingTour ? 'Spara Ändringar' : 'Skapa Tour'}
                    </button>
                </div>
            </div>
        </div>
    );
}
