import React, { useMemo } from 'react';
import { UniversalActivity, BestEffort } from '../../../models/types.ts';
import { Trophy, Timer, Calendar, ExternalLink, Zap } from 'lucide-react';
import { formatActivityDuration } from '../../../utils/formatters.ts';
import { getBestEffortsForActivity, PERFORMANCE_TARGETS } from '../../../utils/performanceEngine.ts';

interface YearlyBestListProps {
    activities: UniversalActivity[];
    onOpenActivity?: (id: string) => void;
}


export function YearlyBestList({ activities, onOpenActivity }: YearlyBestListProps) {
    const currentYear = new Date().getFullYear().toString();

    const yearlyBests = useMemo(() => {
        // 1. Get all running activities from this year
        const runningActivities = activities.filter(a => 
            a.date.startsWith(currentYear) && 
            a.performance?.activityType === 'running' &&
            !a.performance?.excludeFromStats
        );

        if (runningActivities.length === 0) return [];

        const usedActivityIds = new Set<string>();
        const results: Array<{ distance: string, effort: BestEffort, activityId: string }> = [];

        // 2. Iterate through target distances from longest to shortest
        for (const target of PERFORMANCE_TARGETS) {
            const effortsForDistance: Array<{ effort: BestEffort, activityId: string }> = [];

            for (const activity of runningActivities) {
                const bestEfforts = getBestEffortsForActivity(activity);
                const match = bestEfforts.find(be => 
                    be.name === target.name || 
                    be.name === target.stravaName ||
                    (be.distance >= (target.km * 0.98 * 1000) && be.distance <= (target.km * 1.02 * 1000))
                );

                if (match) {
                    effortsForDistance.push({ effort: match, activityId: activity.id });
                }
            }

            if (effortsForDistance.length === 0) continue;

            // Sort by moving time (fastest first)
            effortsForDistance.sort((a, b) => a.effort.movingTime - b.effort.movingTime);

            // Find the fastest activity that hasn't been used yet
            const bestAvailable = effortsForDistance.find(e => !usedActivityIds.has(e.activityId));

            if (bestAvailable) {
                results.push({
                    distance: target.name,
                    effort: bestAvailable.effort,
                    activityId: bestAvailable.activityId
                });
                usedActivityIds.add(bestAvailable.activityId);
            }
        }

        return results;
    }, [activities, currentYear]);

    if (yearlyBests.length === 0) {
        return (
            <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="text-slate-600" size={32} />
                </div>
                <h3 className="text-white font-bold mb-1">Inga årsbästa lagrade</h3>
                <p className="text-slate-500 text-xs max-w-xs mx-auto">
                    Koppla ditt Strava-konto och synkronisera dina pass för att se dina snabbaste tider för {currentYear}.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Trophy className="text-amber-400" size={20} />
                        Årsbästa {currentYear}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Dina snabbaste kilometertider (Max ett per pass)</p>
                </div>
                <div className="px-3 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full">
                    <span className="text-[10px] font-black text-amber-400 uppercase">{yearlyBests.length} REKORD</span>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {yearlyBests.map((item) => (
                    <button
                        key={item.distance}
                        onClick={() => onOpenActivity?.(item.activityId)}
                        className="group flex items-center justify-between p-4 bg-slate-950/40 hover:bg-white/5 border border-white/5 hover:border-amber-400/30 rounded-2xl transition-all text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-amber-400 transition-colors">
                                <Timer size={20} />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">
                                    {item.distance}
                                </div>
                                <div className="text-xl font-black text-white tracking-tight tabular-nums">
                                    {formatActivityDuration(item.effort.movingTime / 60)}
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            <div className="text-[9px] font-bold text-slate-600 flex items-center gap-1">
                                <Calendar size={10} />
                                {item.effort.startDate.split('T')[0]}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink size={12} className="text-amber-400/50" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
