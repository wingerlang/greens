import React, { useState } from 'react';
import { PlannedActivity } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';
import { formatSecondsToTime } from '../../utils/timeParser.ts';

interface CompressedActivityListProps {
    activities: PlannedActivity[];
}

export function CompressedActivityList({ activities }: CompressedActivityListProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { updatePlannedActivity, deletePlannedActivity } = useData();

    return (
        <div className="compressed-activity-list overflow-hidden rounded-2xl border border-white/5 bg-slate-900/40">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/5 bg-slate-950/40">
                        <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Datum</th>
                        <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Typ & Titel</th>
                        <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Dist (KM)</th>
                        <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Tid / Volym</th>
                        <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Tempo</th>
                        <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {activities.map((activity) => (
                        <React.Fragment key={activity.id}>
                            <tr
                                className={`group cursor-pointer transition-colors hover:bg-white/[0.02] ${expandedId === activity.id ? 'bg-indigo-500/5' : ''}`}
                                onClick={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
                            >
                                <td className="px-2 py-2 whitespace-nowrap">
                                    <span className="text-[10px] font-bold text-slate-400">{activity.date.split('-').slice(1).join('/')}</span>
                                </td>
                                <td className="px-2 py-2">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <span className={`text-[8px] font-black uppercase tracking-tighter ${activity.category === 'LONG_RUN' ? 'text-amber-400' :
                                                activity.category === 'INTERVALS' ? 'text-rose-400' : 'text-indigo-400'
                                                }`}>
                                                {activity.category.replace('_', ' ')}
                                            </span>
                                            {/* Strava Badge (simulated if name contains Strava, or if we had source field) */}
                                            {/* Assuming activity has source or we just rely on type */}
                                        </div>
                                        <span className="text-xs font-black text-white truncate max-w-[150px]">{activity.title}</span>
                                    </div>
                                </td>
                                <td className="px-2 py-2">
                                    <span className={`text-sm font-black ${activity.category === 'LONG_RUN' ? 'text-amber-400' : 'text-white'}`}>
                                        {activity.estimatedDistance}
                                    </span>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                    {/* Time or Tonnage */}
                                    {(activity as any).tonnage ? (
                                        <span className="text-xs font-black text-indigo-400">
                                            {((activity as any).tonnage / 1000).toFixed(1)} t
                                        </span>
                                    ) : (
                                        <span className="text-xs font-bold text-slate-300">
                                            {formatSecondsToTime(((activity.durationMinutes || 0) * 60))}
                                        </span>
                                    )}
                                </td>
                                <td className="px-2 py-2 tabular-nums">
                                    <span className="text-xs font-bold text-slate-300">{activity.targetPace}</span>
                                </td>
                                <td className="px-2 py-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${activity.status === 'COMPLETED' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} />
                                        <span className={`text-[9px] font-black uppercase tracking-tight ${activity.status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {activity.status === 'COMPLETED' ? 'Klar' : 'Plan'}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                            {expandedId === activity.id && (
                                <tr className="bg-slate-950/60">
                                    <td colSpan={5} className="px-6 py-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex flex-col md:flex-row gap-6">
                                            <div className="flex-1 space-y-3">
                                                <p className="text-xs text-slate-400 leading-relaxed italic">
                                                    "{activity.description}"
                                                </p>
                                                {activity.scientificBenefit && (
                                                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[9px] text-slate-300 font-bold uppercase tracking-tight">
                                                        🧠 {activity.scientificBenefit}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="shrink-0 flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deletePlannedActivity(activity.id); }}
                                                    className="p-3 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-white/5"
                                                    title="Ta bort"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        {/* Only show sets breakdown for interval/multi-set workouts */}
                                        {activity.structure.mainSet && activity.structure.mainSet.length > 0 &&
                                            (activity.structure.mainSet.length > 1 || (activity.structure.mainSet[0]?.reps || 1) > 1) && (
                                                <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-4">
                                                    {activity.structure.mainSet.map((s, i) => (
                                                        <div key={i} className="text-[10px] bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                                                            <span className="text-slate-500 font-black mr-2 uppercase tracking-tighter">Set {i + 1}:</span>
                                                            <span className="text-white font-black">{s.reps}x {s.distKm}km @ {s.pace}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
