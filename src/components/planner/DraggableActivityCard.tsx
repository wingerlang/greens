import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { PlannedActivity } from '../../models/types.ts';
import { GripHorizontal, Dumbbell, Zap, Footprints, Flame } from 'lucide-react';

interface DraggableActivityCardProps {
    activity: PlannedActivity;
    compact?: boolean;
}

export function DraggableActivityCard({ activity, compact = false }: DraggableActivityCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: activity.id,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        opacity: isDragging ? 0.8 : 1,
        scale: isDragging ? 1.05 : 1,
    } : undefined;

    const getIcon = () => {
        if (activity.category === 'STRENGTH') return <Dumbbell size={14} />;
        if (activity.category === 'INTERVALS' || activity.category === 'TEMPO') return <Flame size={14} />;
        if (activity.category === 'LONG_RUN') return <Footprints size={14} />;
        return <Zap size={14} />;
    };

    const getColors = () => {
         if (activity.category === 'STRENGTH') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
         if (activity.category === 'LONG_RUN') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
         if (['INTERVALS', 'TEMPO'].includes(activity.category)) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
         return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                group relative select-none cursor-grab active:cursor-grabbing
                ${getColors()} border rounded-xl
                ${compact ? 'p-2' : 'p-3'}
                transition-all hover:shadow-lg hover:brightness-110
            `}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    {getIcon()}
                    <span className="text-[10px] font-black uppercase tracking-wider">{activity.category.replace('_', ' ')}</span>
                </div>
                <GripHorizontal size={14} className="opacity-0 group-hover:opacity-50" />
            </div>

            <div className="font-bold text-white text-xs leading-tight mb-1 truncate">
                {activity.title}
            </div>

            {!compact && (
                <div className="flex justify-between items-end text-[10px] text-slate-400 font-medium">
                    {activity.estimatedDistance > 0 ? (
                        <span>{activity.estimatedDistance} km</span>
                    ) : <span>60 min</span>}

                    {activity.targetPace !== '-' && (
                         <span>@{activity.targetPace}</span>
                    )}
                </div>
            )}
        </div>
    );
}
