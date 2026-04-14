import React from 'react';
import { History, Activity, Medal, TrendingUp, HeartPulse } from 'lucide-react';
import { UniversalActivity } from '../../../models/types.ts';
import { normalizeRaceTitle } from '../../training/races/utils.ts';
import { formatSwedishDate, formatSecondsToTime, formatPace } from '../../../utils/dateUtils.ts';

export const RaceHistoryCard = React.memo(({
    currentActivity,
    allActivities,
    onSelectActivity
}: {
    currentActivity: UniversalActivity;
    allActivities: UniversalActivity[];
    onSelectActivity?: (id: string | null) => void;
}) => {
    const currentTitle = normalizeRaceTitle(currentActivity.plan?.title || currentActivity.performance?.notes || (currentActivity.performance as any)?.title || '');
    if (!currentTitle || currentTitle.length < 3) return null;

    const currentDist = currentActivity.performance?.distanceKm || currentActivity.plan?.distanceKm || (currentActivity as any).distance || 0;

    const history = allActivities
        .filter(a =>
            a.id !== currentActivity.id &&
            normalizeRaceTitle(a.plan?.title || a.performance?.notes || (a.performance as any)?.title || '') === currentTitle &&
            (a.performance || a.plan)
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (history.length === 0) return (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 text-center space-y-2 mt-4">
            <div className="text-2xl mb-2">🏁</div>
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Första gången i {currentTitle.toUpperCase()}?</h4>
            <p className="text-[10px] text-slate-500">Vi hittade inga tidigare resultat med exakt samma namn i historiken.</p>
        </div>
    );

    return (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl shadow-indigo-500/5 mt-4">
            <h4 className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest flex items-center gap-2 mb-1">
                <History size={14} className="text-amber-400/80" /> Tidigare resultat: {currentTitle}
            </h4>

            <div className="space-y-3">
                {history.map((prev) => {
                    const prevPerf = prev.performance;
                    const prevDurSeconds = prevPerf?.durationMinutes ? prevPerf.durationMinutes * 60 : (prevPerf as any)?.elapsedTimeSeconds || 0;
                    const prevDist = prevPerf?.distanceKm || prev.plan?.distanceKm || (prev as any).distance || 0;
                    const currentDurSeconds = (currentActivity.performance?.durationMinutes || 0) * 60;
                    const diffTime = currentDurSeconds > 0 && prevDurSeconds > 0 ? currentDurSeconds - prevDurSeconds : null;

                    const isSameDistance = currentDist > 0 && prevDist > 0 && Math.abs(currentDist - prevDist) < 0.5;
                    const prevPace = prevDurSeconds > 0 && prevDist > 0 ? prevDurSeconds / prevDist : 0;
                    const prevHR = prevPerf?.avgHeartRate || (prevPerf as any)?.averageHeartrate || (prevPerf as any)?.avgHeartRate;
                    const prevPlacement = prevPerf?.raceDetails?.placement;

                    return (
                        <div key={prev.id} className="bg-slate-800/40 rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between group hover:bg-slate-800/60 transition-all cursor-pointer relative overflow-hidden shadow-sm flex-wrap gap-y-3"
                            onClick={() => onSelectActivity?.(prev.id)}>

                            {/* Left side: Date + Placement/Distance */}
                            <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-emerald-500/80 shrink-0" />
                                    <span className="text-[12px] font-bold text-white uppercase tracking-wider truncate">{normalizeRaceTitle(prev.plan?.title || (prev.performance as any)?.title || currentTitle)}</span>
                                    {isSameDistance && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded font-black uppercase">Samma distans</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[10px] font-semibold text-slate-400">{formatSwedishDate(prev.date)}</span>
                                    <span className="text-slate-700">•</span>
                                    <span className="text-[10px] font-bold text-emerald-400/90">{prevDist.toFixed(1)}k</span>
                                    {prevPlacement && (
                                        <>
                                            <span className="text-slate-700">•</span>
                                            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5"><Medal size={10} /> #{prevPlacement}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Right side: Time, Pace, HR */}
                            <div className="flex items-center gap-4">
                                {prevDurSeconds > 0 && (
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-bold text-white font-mono leading-none">{formatSecondsToTime(prevDurSeconds)}</span>
                                        </div>
                                        {diffTime !== null && isSameDistance && (
                                            <span className={`text-[8px] font-bold mt-1 flex items-center gap-0.5 ${diffTime < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                <TrendingUp size={8} className={diffTime < 0 ? 'text-emerald-500' : 'rotate-180 text-rose-500'} />
                                                {diffTime < 0 ? '-' : '+'}{formatSecondsToTime(Math.abs(diffTime))}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {prevPace > 0 && (
                                    <div className="flex flex-col border-l border-white/5 pl-3">
                                        <span className="text-sm font-bold text-slate-300 font-mono leading-none">{formatPace(prevPace).replace('/km', '')}<span className="text-[8px] text-slate-500 font-sans ml-0.5">/km</span></span>
                                    </div>
                                )}
                                {prevHR && prevHR > 0 ? (
                                    <div className="flex flex-col border-l border-white/5 pl-3">
                                        <span className="text-sm font-bold text-rose-400/90 font-mono flex items-center gap-1 leading-none">
                                            <HeartPulse size={12} className="opacity-80" /> {Math.round(prevHR)}
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
