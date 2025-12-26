import React, { useMemo } from 'react';

export interface ActivityStats {
    type: string;
    count: number;
    distance: number;
    duration: number;
}

interface ActivityBreakdownProps {
    activities: { type: string; distance: number; duration: number }[];
}

export function ActivityBreakdown({ activities }: ActivityBreakdownProps) {
    const breakdown = useMemo(() => {
        const types: Record<string, ActivityStats> = {};

        activities.forEach(a => {
            const key = a.type.toLowerCase();
            if (!types[key]) {
                types[key] = { type: a.type, count: 0, distance: 0, duration: 0 };
            }
            types[key].count++;
            types[key].distance += a.distance || 0;
            types[key].duration += a.duration || 0;
        });

        // Group synonyms if needed (e.g. run/löpning) - relying on pre-processing or explicit mapping here for now
        // Assuming 'activities' passed in are already normalized or we group them here

        return Object.values(types).sort((a, b) => b.duration - a.duration);
    }, [activities]);

    if (breakdown.length === 0) return null;

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">🎯 Aktivitetstyper</h3>
            <div className="space-y-3">
                {breakdown.map((act, i) => (
                    <div key={act.type} className="flex items-center gap-3 group">
                        <span className="text-lg font-black text-slate-600 w-6 group-hover:text-slate-400 transition-colors">{i + 1}</span>
                        <div className="flex-1">
                            <div className="flex justify-between items-baseline">
                                <p className="text-white font-bold capitalize">{act.type}</p>
                                <span className="text-xs text-slate-500 font-mono">{Math.floor(act.duration / 60)}h {Math.round(act.duration % 60)}m</span>
                            </div>
                            <div className="flex gap-4 text-xs text-slate-500 mt-0.5">
                                <span>{act.count} pass</span>
                                <span className="text-emerald-400">{act.distance.toFixed(1)} km</span>
                                <span className="text-sky-400">{act.duration > 0 && act.distance > 0 ? (act.duration / act.distance).toFixed(1) + ' min/km' : ''}</span>
                            </div>
                            {/* Mini bar for proportion */}
                            <div className="h-0.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-sky-500/50 group-hover:bg-sky-500 transition-colors"
                                    style={{ width: `${(act.duration / breakdown[0].duration) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
