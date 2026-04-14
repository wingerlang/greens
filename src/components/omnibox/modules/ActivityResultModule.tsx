import React from 'react';
import { Trophy, ArrowRight, Calendar, Heart, Zap, History } from 'lucide-react';
import { ExerciseEntry } from '../../../models/types.ts';
import { isCompetition } from '../../../utils/activityUtils.ts';

interface ActivityResultModuleProps {
    results: ExerciseEntry[];
    selectableItems: any[];
    selectedIndex: number;
    setSelectedActivityId: (id: string | null) => void;
    onClose: () => void;
}

export const ActivityResultModule: React.FC<ActivityResultModuleProps> = ({
    results,
    selectableItems,
    selectedIndex,
    setSelectedActivityId,
    onClose
}) => {
    if (results.length === 0) return null;

    const formatPace = (secPerKm: number) => {
        if (!secPerKm || isNaN(secPerKm)) return '-';
        const mins = Math.floor(secPerKm / 60);
        const secs = Math.round(secPerKm % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="px-2 py-2">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span>🏃‍♂️</span> Aktiviteter ({results.length})
            </div>
            {results.map((activity) => {
                const globalIdx = selectableItems.findIndex(i => i.itemType === 'activity' && i.id === activity.id);
                const isRace = isCompetition(activity);
                
                const pace = (activity.durationMinutes * 60) / (activity.distance || 1);
                const hr = activity.heartRateAvg || (activity as any).averageHeartrate;

                return (
                    <div
                        key={activity.id}
                        id={`omnibox-item-${globalIdx}`}
                        onClick={() => {
                            setSelectedActivityId(activity.id);
                            onClose();
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'hover:bg-white/5 text-white'
                            }`}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${isRace ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                                {isRace ? <Trophy size={16} /> : <History size={16} />}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="font-medium truncate">{activity.title || activity.type}</div>
                                    {isRace && (
                                        <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                                            RACE
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} className="text-slate-600" />
                                        {new Date(activity.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                    {activity.distance && (
                                        <span className="flex items-center gap-1">
                                            <Zap size={10} className="text-slate-600" />
                                            {activity.distance.toFixed(1)} km
                                        </span>
                                    )}
                                    {activity.distance && activity.durationMinutes > 0 && (
                                        <span className="font-mono text-slate-400">
                                            {formatPace(pace)}/km
                                        </span>
                                    )}
                                    {hr && (
                                        <span className="flex items-center gap-1">
                                            <Heart size={10} className="text-rose-500/50" />
                                            {hr} bpm
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ArrowRight size={14} className={`opacity-0 ${globalIdx === selectedIndex ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity`} />
                    </div>
                );
            })}
        </div>
    );
};
