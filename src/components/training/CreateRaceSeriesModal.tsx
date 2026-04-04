import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { RaceDefinition, generateId, PlannedActivity } from '../../models/types.ts';
import { X, Trophy, Search, Plus, Calendar, MapPin, History, CheckCircle2, AlertCircle } from 'lucide-react';
import { getISODate } from '../../models/types.ts';

interface CreateRaceSeriesModalProps {
    onClose: () => void;
    editingDefinition?: RaceDefinition;
    defaultIsCup?: boolean;
}

export function CreateRaceSeriesModal({ onClose, editingDefinition, defaultIsCup }: CreateRaceSeriesModalProps) {
    const { 
        unifiedActivities, plannedActivities, 
        addRaceDefinition, updateRaceDefinition, 
        savePlannedActivities, currentUser 
    } = useData();

    const [name, setName] = useState(editingDefinition?.name || '');
    const [description, setDescription] = useState(editingDefinition?.description || '');
    const [isCup, setIsCup] = useState(editingDefinition?.isCup || defaultIsCup || false);
    const [distance, setDistance] = useState<number | undefined>(editingDefinition?.distance);
    const [location, setLocation] = useState(editingDefinition?.location || '');
    const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set(editingDefinition?.aliases || []));
    
    const [searchTerm, setSearchTerm] = useState('');
    const [duplicatedTitles, setDuplicatedTitles] = useState<Set<string>>(new Set());

    // 1. Get unique activity titles from history and planned
    const availableActivities = useMemo(() => {
        const titles = new Map<string, { type: 'past' | 'upcoming', date: string, distance?: number, location?: string }>();
        
        // Past activities (Race)
        unifiedActivities.forEach(a => {
            if (a.subType === 'race' || a.title?.toLowerCase().includes('loppet') || a.title?.toLowerCase().includes('race')) {
                const title = a.title || 'Namnlös';
                if (!titles.has(title) || a.date > titles.get(title)!.date) {
                    titles.set(title, { type: 'past', date: a.date, distance: a.distance, location: a.location });
                }
            }
        });

        // Upcoming activities
        plannedActivities.forEach(p => {
            const title = p.title;
            if (!titles.has(title) || p.date > titles.get(title)!.date) {
                titles.set(title, { type: 'upcoming', date: p.date, distance: p.estimatedDistance, location: p.raceDetails?.logistics?.location });
            }
        });

        return Array.from(titles.entries())
            .map(([title, data]) => ({ title, ...data }))
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [unifiedActivities, plannedActivities]);

    const filteredActivities = availableActivities.filter(a => 
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleTitle = (title: string, data: any) => {
        const next = new Set(selectedTitles);
        if (next.has(title)) {
            next.delete(title);
        } else {
            next.add(title);
            // Auto-fill metadata if empty
            if (!name) setName(title.replace(/\s\d{4}$/, '').trim()); // Strip year
            if (!distance && data.distance) setDistance(data.distance);
            if (!location && data.location) setLocation(data.location);
        }
        setSelectedTitles(next);
    };

    const handleDuplicate = (activity: any) => {
        if (!currentUser) return;

        // Duplicate logic: Date + 364 days (exact week match)
        const oldDate = new Date(activity.date);
        const newDate = new Date(oldDate.getTime() + (364 * 24 * 60 * 60 * 1000));
        const newDateStr = newDate.toISOString().split('T')[0];

        const newPlanned: PlannedActivity = {
            id: generateId(),
            userId: currentUser.id,
            title: activity.title.replace(/\d{4}/, newDate.getFullYear().toString()), // Update year in title
            description: '',
            date: newDateStr,
            type: 'RUN',
            category: 'RACE',
            status: 'PLANNED',
            estimatedDistance: activity.distance || 0,
            targetPace: '',
            targetHrZone: 0,
            structure: {
                warmupKm: 0,
                mainSet: [],
                cooldownKm: 0
            },
            raceDetails: {
                isRegistered: false,
                seriesName: name || activity.title,
                logistics: {
                    location: activity.location || ''
                }
            },
            createdAt: getISODate()
        };

        savePlannedActivities([...plannedActivities, newPlanned]);
        setDuplicatedTitles(prev => new Set(prev).add(activity.title));
    };

    const handleSave = () => {
        if (!name) return;

        const definition: Omit<RaceDefinition, 'id'> = {
            name,
            description,
            isCup,
            distance,
            location,
            aliases: Array.from(selectedTitles)
        };

        if (editingDefinition) {
            updateRaceDefinition(editingDefinition.id, definition);
        } else {
            addRaceDefinition(definition);
        }
        onClose();
    };

    // Check if an activity is "Old" (> 11 months)
    const isOld = (dateStr: string) => {
        const monthsAgo = (new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        return monthsAgo > 11;
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Visual Flair */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500" />

                {/* Header */}
                <div className="p-5 sm:p-8 border-b border-white/5 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-amber-500 font-black text-[10px] uppercase tracking-widest mb-2">
                            <Trophy size={14} /> Tävlingshantering
                        </div>
                        <h2 className="text-3xl font-black text-white">
                            {editingDefinition ? 'Redigera Serie' : 'Skapa Ny Serie'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Gruppera lopp och duplicera historiska utmaningar.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar">
                    
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-2 block tracking-widest">Namn på Serie / Cup</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="T.ex. Göteborgsvarvet eller Trailcupen"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-amber-500/50 focus:outline-none transition-all text-lg"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-2 block tracking-widest">Beskrivning</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Vad utmärker denna serie?"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm focus:border-amber-500/50 focus:outline-none transition-all h-20 resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-2 block tracking-widest">Distans (km)</label>
                            <input
                                type="number"
                                value={distance || ''}
                                onChange={e => setDistance(parseFloat(e.target.value) || undefined)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:border-amber-500/50 focus:outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block tracking-widest">Typ</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsCup(false)}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${!isCup ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-slate-950 border-white/10 text-slate-500'}`}
                                >
                                    Serie
                                </button>
                                <button 
                                    onClick={() => setIsCup(true)}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${isCup ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'bg-slate-950 border-white/10 text-slate-500'}`}
                                >
                                    Cup
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Race Selector */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <History size={18} className="text-slate-400" />
                                    Välj ingående lopp
                                </h3>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-tighter">Markerade lopp kommer tillhöra denna serie</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input 
                                    type="text"
                                    placeholder="Sök lopp..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/30"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                            {filteredActivities.map(activity => {
                                const isSelected = selectedTitles.has(activity.title);
                                const isDuplicateEligible = activity.type === 'past' && isOld(activity.date) && !duplicatedTitles.has(activity.title); return (
                                    <div 
                                        key={activity.title}
                                        className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/50 border-white/5 hover:border-white/10'}`}
                                    >
                                        <button 
                                            onClick={() => toggleTitle(activity.title, activity)}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-white/20'}`}>
                                                {isSelected && <CheckCircle2 size={14} />}
                                            </div>
                                            <div>
                                                <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-300'}`}>{activity.title}</div>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500"> <span className="flex items-center gap-0.5"><Calendar size={10} /> {activity.date}</span> {activity.location && <span className="flex items-center gap-0.5"><MapPin size={10} /> {activity.location}</span>}
                                                </div>
                                            </div>
                                        </button>

                                        {isDuplicateEligible && (
                                            <button onClick={() => handleDuplicate(activity)}
                                                className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-slate-950 text-[10px] font-black uppercase rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1"
                                            >
                                                <Plus size={10} /> Skapa för {new Date().getFullYear()}
                                            </button>
                                        )} {duplicatedTitles.has(activity.title) && (
                                            <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold uppercase">
                                                <CheckCircle2 size={12} /> Skapad!
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredActivities.length === 0 && (
                                <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                                    <AlertCircle size={24} />
                                    <p className="text-sm italic">Inga lopp hittades...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 sm:p-8 border-t border-white/5 bg-slate-950/50 flex justify-end gap-4">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-colors"
                    >
                        Avbryt
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!name}
                        className="px-8 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl transition-all transform active:scale-95 shadow-lg shadow-amber-500/10"
                    >
                        Spara Serie
                    </button>
                </div>
            </div>
        </div>
    );
}
