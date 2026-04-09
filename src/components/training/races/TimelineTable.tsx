import { Target, Medal } from 'lucide-react';
import { ExerciseEntry, UniversalActivity, PlannedActivity } from '../../../models/types.ts';
import { formatRaceDateCompact, isTrailRace, isUltraRace, getDistanceStyle, calcPace, calcStifa, getAvgElevation } from './utils.ts';
import { formatActivityDuration } from '../../../utils/formatters.ts';

interface TimelineTableProps {
    races: ExerciseEntry[];
    upcomingRaces: PlannedActivity[];
    handleEditClick: (race: PlannedActivity) => void;
    setSelectedActivity: (activity: ExerciseEntry) => void;
    universalActivities: UniversalActivity[];
    sortConfig: { key: string, direction: 'asc' | 'desc' };
    handleSort: (key: string) => void;
}

export function TimelineTable({ 
    races, 
    upcomingRaces, 
    handleEditClick, 
    setSelectedActivity, 
    universalActivities,
    sortConfig,
    handleSort
}: TimelineTableProps) {
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
                    <th className="px-3 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('elevation')}>HM <SortIcon colKey="elevation" /></th>
                    <th className="px-3 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('stifa')}>STIFA <SortIcon colKey="stifa" /></th>
                    <th className="px-3 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('durationMinutes')}>Tid <SortIcon colKey="durationMinutes" /></th>
                    <th className="px-3 py-1.5 text-right">Tempo</th>
                    <th className="px-3 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('placement')}>Placering <SortIcon colKey="placement" /></th>
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
                    const estElev = !race.raceDetails?.elevationGain ? getAvgElevation(race.title, race.estimatedDistance, races) : null;
                    const displayElev = race.raceDetails?.elevationGain || estElev;
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
                            <td className={`px-3 py-1.5 text-right font-mono text-[10px] ${estElev ? 'text-amber-500/80' : 'text-slate-400'}`}>
                                {displayElev ? `${displayElev}m${estElev ? '*' : ''}` : '-'}
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono text-[10px] ${estElev ? 'text-amber-500/60' : 'text-slate-500'}`}>
                                {calcStifa(race.estimatedDistance, displayElev || undefined)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-500">-</td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-500">-</td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-500">-</td>
                        </tr>
                    );
                })}

                {/* HISTORY */}
                {races.map((race: any) => {
                    const getRaceTitle = (r: ExerciseEntry) => {
                        if (r.title && !r.title.startsWith('Merged')) return r.title;
                        const ua = universalActivities.find((u: UniversalActivity) => u.id === r.id);
                        if (ua?.mergeInfo?.isMerged && ua.mergeInfo.originalActivityIds?.length) {
                            const components = universalActivities.filter((u: UniversalActivity) => ua.mergeInfo!.originalActivityIds!.includes(u.id));
                            const stravaComp = components.find((c: UniversalActivity) => (c as any).performance?.source?.source === 'strava');
                            if (stravaComp?.plan?.title) return stravaComp.plan.title;
                        }
                        return r.notes || r.type;
                    };

                    const title = getRaceTitle(race);
                    const isTrail = isTrailRace(title);
                    const isUltra = isUltraRace(title, race.distance);
                    const distStyle = getDistanceStyle(race.distance);
                    
                    const placement = race.raceDetails?.placement;
                    const isPodium = placement && placement <= 3;
                    const isWin = placement === 1;

                    return (
                        <tr
                            key={race.id}
                            className={`hover:bg-white/5 transition-colors cursor-pointer group ${isWin ? 'bg-amber-500/5' : ''}`}
                            onClick={() => setSelectedActivity(race)}
                        >
                            <td className={`px-3 py-1.5 border-l-2 transition-colors whitespace-nowrap ${isWin ? 'border-l-amber-500' : 'border-l-transparent group-hover:border-l-amber-500'}`}>
                                <div className="flex items-center gap-1.5">
                                    <span className={`font-mono text-xs font-bold ${isWin ? 'text-amber-400' : 'text-slate-300'}`}>{formatRaceDateCompact(race.date)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-black">{race.date.substring(2, 4)}</span>
                                </div>
                            </td>
                            <td className="px-3 py-1.5">
                                <div className={`font-bold transition-colors flex items-center gap-1.5 flex-wrap text-xs ${isWin ? 'text-amber-400 group-hover:text-amber-300' : 'text-white group-hover:text-amber-500'}`}>
                                    <span className="truncate max-w-[200px]">{title}</span>
                                    {isWin && <Trophy size={10} className="text-amber-400" />}
                                    {isUltra && <span className="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest">Ultra</span>}
                                    {isTrail && !isUltra && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0 rounded border border-emerald-500/30 uppercase font-black tracking-widest">Trail</span>}
                                </div>
                            </td>
                            <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                {race.location || race.raceDetails?.logistics?.location || '-'}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                                {race.distance > 0 ? (
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${distStyle} whitespace-nowrap`}>
                                        {race.distance.toFixed(1)} km
                                    </span>
                                ) : '-'}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-300 font-mono text-[10px]">
                                {(race.elevationGain || race.raceDetails?.elevationGain) ? `${race.elevationGain || race.raceDetails.elevationGain}m` : '-'}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-500 font-mono text-[10px]">
                                {calcStifa(race.distance, race.elevationGain || race.raceDetails?.elevationGain)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-500 font-bold whitespace-nowrap">{formatActivityDuration(race.durationMinutes)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-500 text-[10px] whitespace-nowrap">{calcPace(race.distance, race.durationMinutes)}</td>
                            <td className="px-3 py-1.5 text-right">
                                {placement ? (
                                    <div className={`flex items-center justify-end gap-1 font-black ${isPodium ? 'text-amber-400' : 'text-slate-400'}`}>
                                        {isPodium && <Medal size={12} className={placement === 1 ? 'text-amber-400' : placement === 2 ? 'text-slate-300' : 'text-amber-700'} />}
                                        {placement}{race.raceDetails?.totalParticipants ? ` / ${race.raceDetails.totalParticipants}` : ''}
                                    </div>
                                ) : '-'}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
