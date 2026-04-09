import { useState, useMemo } from 'react';
import { Calendar, MapPin, Trophy, Target, CheckSquare, Clock, ChevronDown, ChevronUp, ExternalLink, Pencil, X, Trees } from 'lucide-react';
import { PlannedActivity, ExerciseEntry } from '../../../models/types.ts';
import { normalizeRaceTitle, isTrailRace, isUltraRace, getDistanceStyle, formatRaceDateCompact, calcPace, getPlannedRaceTime, getAvgElevation } from './utils.ts';
import { formatActivityDuration } from '../../../utils/formatters.ts';
import { BarChart3 } from 'lucide-react';
import { PrepAnalysisModal } from '../PrepAnalysisModal.tsx';

interface UpcomingRaceCardProps {
    race: PlannedActivity;
    historyRaces?: ExerciseEntry[];
    allActivities?: ExerciseEntry[];
    onUpdate: (r: PlannedActivity) => void;
    onDelete: (id: string) => void;
    onEdit: (r: PlannedActivity) => void;
}

export function UpcomingRaceCard({
    race,
    historyRaces = [],
    allActivities = [],
    onUpdate,
    onDelete,
    onEdit
}: UpcomingRaceCardProps) {
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
    const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

    const historySummary = useMemo(() => {
        const normTitle = normalizeRaceTitle(race.title);
        const dist = race.estimatedDistance;
        if (!normTitle || !dist) return null;

        const matches = historyRaces.filter(h => {
            const hTitle = normalizeRaceTitle(h.title || h.notes || '');
            const hDist = h.distance || 0;
            const titleMatch = hTitle === normTitle;
            const distMatch = Math.abs(hDist - dist) / dist < 0.1;
            return titleMatch && distMatch;
        });
        
        if (matches.length === 0) return null;

        const pb = matches.reduce((best, curr) => curr.durationMinutes < best.durationMinutes ? curr : best, matches[0]);
        
        return {
            count: matches.length,
            pb: pb
        };
    }, [race.title, race.estimatedDistance, historyRaces]);

    const elevationInfo = useMemo(() => {
        if (race.raceDetails?.elevationGain) return { value: race.raceDetails.elevationGain, isEstimate: false };
        
        const avg = getAvgElevation(race.title, race.estimatedDistance, historyRaces);
        if (avg) return { value: avg, isEstimate: true };
        
        return null;
    }, [race.title, race.estimatedDistance, race.raceDetails?.elevationGain, historyRaces]);

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
    const plannedTime = getPlannedRaceTime(race);
    const plannedPace = calcPace(race.estimatedDistance, plannedTime);

    return (
        <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden relative group hover:border-amber-500/50 transition-all duration-300 shadow-xl shadow-black/40 flex flex-col">
            {/* Top Banner / Bib Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-1">
                <div className="bg-slate-900 rounded-t-[20px] p-5 relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="flex flex-wrap gap-2 mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">RACE DAY</span>
                                {historySummary && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <Trophy size={10} /> Sprunget {historySummary.count}x förut
                                    </span>
                                )}
                                {isUltra && <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-0.5 rounded-md shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                {isTrail && !isUltra && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1"><Trees size={10} /> Trail</span>}
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
                {historySummary && (
                    <div className="mx-5 mb-2 -mt-1 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center justify-between relative z-20">
                        <div className="flex items-center gap-2">
                             <Trophy size={12} className="text-amber-900" />
                             <span className="text-[10px] font-black text-amber-950 uppercase tracking-tight">Ditt personbästa här:</span>
                        </div>
                        <span className="text-xs font-black text-amber-950 font-mono">{formatActivityDuration(historySummary.pb.durationMinutes)}</span>
                    </div>
                )}
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-5 flex-1 bg-slate-900/50">
                {/* Distance & Info Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <div className={`p-2 rounded-xl border flex flex-col justify-center items-center text-center ${distStyle}`}>
                        <div className="text-[10px] uppercase font-bold mb-0.5 opacity-70">Distans</div>
                        <div className="text-base font-black">{race.estimatedDistance > 0 ? `${race.estimatedDistance}km` : '?'}</div>
                    </div>
                    <div className="bg-slate-950/50 p-2 rounded-xl border border-white/5 flex flex-col justify-center items-center text-center relative overflow-hidden">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Måltid</div>
                        <div className="text-base font-black text-white font-mono tabular-nums">{plannedTime ? formatActivityDuration(plannedTime) : 'TBD'}</div>
                        {plannedPace !== '-' && (
                            <div className="absolute top-1 right-2 text-[7px] font-black uppercase text-slate-600 bg-white/5 px-1 rounded-sm border border-white/5">
                                {plannedPace}
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-950/50 p-2 rounded-xl border border-white/5 flex flex-col justify-center items-center text-center relative overflow-hidden">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Höjd</div>
                        <div className={`text-base font-black font-mono tabular-nums ${elevationInfo?.isEstimate ? 'text-amber-500/80' : 'text-white'}`}>
                            {elevationInfo ? `${elevationInfo.value}m` : '?'}
                        </div>
                        {elevationInfo?.isEstimate && (
                            <div className="absolute top-1 right-2 text-[7px] font-black uppercase text-amber-600/60 bg-amber-500/5 px-1 rounded-sm border border-amber-500/10">
                                Est.
                            </div>
                        )}
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

                {/* Previous Results Expandable */}
                <div className={`bg-slate-950/30 rounded-xl border border-white/5 overflow-hidden transition-all ${isHistoryExpanded ? 'p-4' : 'p-0'}`}>
                    <button
                        onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        className={`w-full flex justify-between items-center p-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all ${isHistoryExpanded ? 'border-b border-white/5 mb-3 bg-white/5' : ''}`}
                    >
                        <span className="flex items-center gap-2">
                            <Clock size={16} className="text-blue-400" />
                            Tidigare Resultat
                        </span>
                        {isHistoryExpanded ? <ChevronDown className="rotate-180" size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isHistoryExpanded && (
                        <div className="space-y-2">
                            {(() => {
                                const normTitle = normalizeRaceTitle(race.title);
                                const dist = race.estimatedDistance;
                                const matchingHistory = historyRaces
                                    .filter(h => {
                                        const hTitle = normalizeRaceTitle(h.title || h.notes || '');
                                        const hDist = h.distance || 0;
                                        return hTitle === normTitle && Math.abs(hDist - dist) / dist < 0.1;
                                    })
                                    .sort((a, b) => b.date.localeCompare(a.date));

                                if (matchingHistory.length === 0) {
                                    return <div className="text-xs text-slate-500 italic text-center py-2">Inga tidigare resultat för denna distans.</div>;
                                }

                                return matchingHistory.map(h => (
                                    <div key={h.id} className="flex justify-between items-center p-2 rounded-lg bg-white/5 text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-slate-300 font-bold">{h.date}</span>
                                            <span className="text-[10px] text-slate-500">{h.distance?.toFixed(1) || '?'} km</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-emerald-400 font-black font-mono">{formatActivityDuration(h.durationMinutes)}</span>
                                            <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{calcPace(h.distance, h.durationMinutes)}</span>
                                        </div>
                                    </div>
                                ));
                            })()}
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
                    <button
                        onClick={() => setIsAnalysisOpen(true)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                        title="Visa träningsanalys inför detta lopp"
                    >
                        <BarChart3 size={16} /> Analys
                    </button>
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

            {isAnalysisOpen && (
                <PrepAnalysisModal
                    event={{
                        id: race.id,
                        date: race.date,
                        title: race.title,
                        distance: race.estimatedDistance,
                        isRace: true,
                        activity: race
                    }}
                    allActivities={allActivities}
                    onClose={() => setIsAnalysisOpen(false)}
                />
            )}
        </div>
    );
}

export function UpcomingRaceCardCompact({
    race,
    historyRaces = [],
    onEdit
}: {
    race: PlannedActivity,
    historyRaces?: ExerciseEntry[],
    onEdit: (r: PlannedActivity) => void
}) {
    const historySummary = useMemo(() => {
        const normTitle = normalizeRaceTitle(race.title);
        const dist = race.estimatedDistance;
        if (!normTitle || !dist) return null;
        
        const matches = historyRaces.filter(h => {
            const hTitle = normalizeRaceTitle(h.title || h.notes || '');
            const hDist = h.distance || 0;
            return hTitle === normTitle && Math.abs(hDist - dist) / dist < 0.1;
        });

        if (matches.length === 0) return null;

        const pb = matches.reduce((best, curr) => curr.durationMinutes < best.durationMinutes ? curr : best, matches[0]);
        
        return {
            count: matches.length,
            pb: pb
        };
    }, [race.title, race.estimatedDistance, historyRaces]);

    const daysLeft = useMemo(() => {
        const diff = new Date(race.date).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }, [race.date]);

    const isTrail = isTrailRace(race.title);
    const isUltra = isUltraRace(race.title, race.estimatedDistance);
    const distStyle = getDistanceStyle(race.estimatedDistance);
    const plannedTime = getPlannedRaceTime(race);
    const plannedPace = calcPace(race.estimatedDistance, plannedTime);

    const elevationInfo = useMemo(() => {
        if (race.raceDetails?.elevationGain) return { value: race.raceDetails.elevationGain, isEstimate: false };
        const avg = getAvgElevation(race.title, race.estimatedDistance, historyRaces);
        if (avg) return { value: avg, isEstimate: true };
        return null;
    }, [race.title, race.estimatedDistance, race.raceDetails?.elevationGain, historyRaces]);

    return (
        <div
            onClick={() => onEdit(race)}
            className="bg-slate-900 border-l-2 border-l-emerald-500 border-y border-r border-white/5 rounded-xl p-4 hover:bg-slate-800 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
        >
            <div>
                <div className="flex gap-1.5 mb-2 items-center flex-wrap">
                    <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-500/20 uppercase shadow-sm flex items-center gap-1">
                        <Calendar size={10} /> {daysLeft} dagar
                    </span>
                    {historySummary && (
                        <span className="flex items-center gap-1 text-blue-400 font-black text-[9px] uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            <Trophy size={10} /> {historySummary.count}x
                        </span>
                    )}
                    {isUltra && <span className="text-[8px] font-black uppercase tracking-widest text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                    {isTrail && !isUltra && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Trees size={10} /> Trail</span>}
                </div>
                <h4 className="text-white font-bold leading-tight group-hover:text-emerald-400 transition-colors line-clamp-2 text-sm mb-1">{race.title}</h4>
                <div className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-wide">{formatRaceDateCompact(race.date)}</div>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs">
                <span className="flex items-center gap-1 text-slate-400 max-w-[50%]">
                    <MapPin size={10} className="text-slate-500 shrink-0" />
                    <span className="truncate">{race.raceDetails?.logistics?.location || 'Mål'}</span>
                </span>
                <div className="flex gap-1.5 items-center">
                    {elevationInfo && (
                        <span className={`text-[10px] font-black font-mono ${elevationInfo.isEstimate ? 'text-amber-500/60' : 'text-slate-500'}`}>
                            {elevationInfo.value}m
                        </span>
                    )}
                    {plannedTime && (
                         <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-white font-mono tabular-nums leading-none mb-0.5">{formatActivityDuration(plannedTime)}</span>
                            {plannedPace !== '-' && <span className="text-[8px] font-bold text-slate-500 font-mono tracking-tighter leading-none">{plannedPace}</span>}
                        </div>
                    )}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${distStyle}`}>
                        {race.estimatedDistance > 0 ? `${race.estimatedDistance}km` : '-'}
                    </span>
                </div>
            </div>
        </div>
    );
}
export function UpcomingRaceCardList({
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
    const distStyle = getDistanceStyle(race.estimatedDistance);
    const plannedTime = getPlannedRaceTime(race);

    return (
        <div 
            onClick={() => onEdit(race)}
            className="col-span-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 md:p-6 hover:bg-slate-800 transition-all cursor-pointer group flex items-center justify-between gap-6"
        >
            <div className="flex items-center gap-6 min-w-0 flex-1">
                <div className="hidden md:flex flex-col items-center justify-center bg-slate-950 rounded-xl p-3 border border-white/5 min-w-[80px]">
                    <div className="text-2xl font-black text-white">{new Date(race.date).getDate()}</div>
                    <div className="text-[10px] font-black uppercase text-amber-500">{new Intl.DateTimeFormat('sv-SE', { month: 'short' }).format(new Date(race.date))}</div>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h4 className="text-xl font-black text-white group-hover:text-amber-500 transition-colors truncate">{race.title}</h4>
                        {isTrail && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1"><Trees size={12} /> Trail</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-600" /> {race.date}</span>
                        {race.raceDetails?.logistics?.location && (
                            <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-600" /> {race.raceDetails.logistics.location}</span>
                        )}
                        <span className="flex items-center gap-1.5 text-amber-500/80"><Clock size={14} /> {daysLeft} dagar kvar</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-6 shrink-0">
                {plannedTime && (
                    <div className="hidden sm:flex flex-col items-end">
                        <div className="text-[10px] font-black text-slate-500 uppercase">Måltid</div>
                        <div className="text-xl font-black text-white font-mono">{formatActivityDuration(plannedTime)}</div>
                    </div>
                )}
                <div className={`p-3 rounded-xl border text-center min-w-[90px] ${distStyle}`}>
                    <div className="text-[10px] font-black uppercase opacity-60">Distans</div>
                    <div className="text-lg font-black">{race.estimatedDistance}km</div>
                </div>
                <button className="p-3 bg-slate-950 rounded-xl border border-white/5 text-slate-500 group-hover:text-amber-500 transition-colors">
                    <Pencil size={18} />
                </button>
            </div>
        </div>
    );
}
