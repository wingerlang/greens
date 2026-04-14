import React, { useState } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { ExerciseEntry } from '../../../models/types.ts';
import { formatPace } from '../../../utils/dateUtils.ts';

export const SessionGroup = ({
    title,
    count,
    icon,
    items,
    formatDetail,
    onActivityClick
}: {
    title: string;
    count: number;
    icon: React.ReactNode;
    items: ExerciseEntry[];
    formatDetail: (act: ExerciseEntry) => React.ReactNode;
    onActivityClick?: (id: string) => void;
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="space-y-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between hover:bg-white/5 p-1 rounded transition-colors group"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-300">{count} st</span>
                    <ChevronDown size={12} className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {(isExpanded || (items.length <= 2 && title !== "Tävlingar")) && (
                <div className="space-y-1 sm:pl-4">
                    {items.slice(0, isExpanded ? 99 : 2).map(act => (
                        <div
                            key={act.id}
                            className="bg-white/5 p-1.5 rounded-lg flex items-center justify-between text-[11px] group cursor-pointer hover:bg-white/10 gap-3"
                            onClick={() => onActivityClick?.(act.id)}
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Calendar size={10} className="text-slate-500 shrink-0" />
                                <span className="text-slate-400 whitespace-nowrap">{new Date(act.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</span>
                                <span className="font-bold text-white truncate">{act.title || act.type}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {act.distance && act.durationMinutes && act.type?.toLowerCase().includes('run') && (
                                    <span className="text-[9px] font-mono text-slate-500 group-hover:text-amber-400/80 transition-colors">
                                        {formatPace((act.durationMinutes * 60) / act.distance).replace('/km', '')}<span className="text-[7px] ml-0.5">/km</span>
                                    </span>
                                )}
                                <div className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-white transition-colors">{formatDetail(act)}</div>
                            </div>
                        </div>
                    ))}
                    {items.length > 2 && !isExpanded && (
                        <div className="text-[9px] text-slate-600 italic text-center py-1">
                            +{items.length - 2} till...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
