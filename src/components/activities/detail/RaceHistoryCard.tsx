import React from 'react';
import { History, Activity, Medal, TrendingUp, HeartPulse, ChevronDown, ChevronUp, Timer } from 'lucide-react';
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

    const [isExpanded, setIsExpanded] = React.useState(false);
    const [comparisonId, setComparisonId] = React.useState<string | null>(null);

    const currentDist = currentActivity.performance?.distanceKm || currentActivity.plan?.distanceKm || (currentActivity as any).distance || 0;

    const history = allActivities
        .filter(a =>
            normalizeRaceTitle(a.plan?.title || a.performance?.notes || (a.performance as any)?.title || '') === currentTitle &&
            (a.performance || a.plan)
        )
        .sort((a, b) => {
            const distA = a.performance?.distanceKm || a.plan?.distanceKm || (a as any).distance || 0;
            const distB = b.performance?.distanceKm || b.plan?.distanceKm || (b as any).distance || 0;
            
            const isSameA = Math.abs(currentDist - distA) < 1.0;
            const isSameB = Math.abs(currentDist - distB) < 1.0;
            
            if (isSameA && !isSameB) return -1;
            if (!isSameA && isSameB) return 1;
            
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

    if (history.length <= 1 && history[0]?.id === currentActivity.id) return (
        <div className="bg-slate-900/40 border border-white/5 rounded-lg p-4 text-center space-y-2 mt-4">
            <div className="text-xl mb-1">🏁</div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Första gången i {currentTitle.toUpperCase()}?</h4>
            <p className="text-[9px] text-slate-500">Vi hittade inga tidigare resultat med exakt samma namn i historiken.</p>
        </div>
    );

    const visibleHistory = isExpanded ? history : history.slice(0, 3);
    const selectedHistoryItem = history.find(h => h.id === comparisonId);

    return (
        <div className="bg-slate-900/40 border border-white/5 rounded-lg p-2.5 space-y-3 shadow-xl shadow-indigo-500/5 mt-4">
            <div className="flex items-center justify-between px-1">
                <h4 className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} className="text-amber-400/80" /> Tidigare resultat: {currentTitle}
                </h4>
                <div className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Personbästa & Historik</div>
            </div>

            <div className="space-y-2">
                {visibleHistory.map((prev, idx) => {
                    const prevPerf = prev.performance;
                    const prevDurSeconds = prevPerf?.durationMinutes ? prevPerf.durationMinutes * 60 : (prevPerf as any)?.elapsedTimeSeconds || 0;
                    const prevDist = prevPerf?.distanceKm || prev.plan?.distanceKm || (prev as any).distance || 0;
                    const currentDurSeconds = (currentActivity.performance?.durationMinutes || 0) * 60;
                    const diffTime = currentDurSeconds > 0 && prevDurSeconds > 0 ? currentDurSeconds - prevDurSeconds : null;

                    const isSameDistance = currentDist > 0 && prevDist > 0 && Math.abs(currentDist - prevDist) < 0.5;
                    const prevPace = prevDurSeconds > 0 && prevDist > 0 ? prevDurSeconds / prevDist : 0;
                    const prevHR = prevPerf?.avgHeartRate || (prevPerf as any)?.averageHeartrate || (prevPerf as any)?.avgHeartRate;
                    const prevPlacement = prevPerf?.raceDetails?.placement;

                    const isSelected = comparisonId === prev.id;
                    const isCurrent = prev.id === currentActivity.id;

                    return (
                        <div key={prev.id} className="flex flex-col gap-2">
                            <div className={`bg-slate-800/40 rounded-lg px-3 py-2 border transition-all cursor-pointer relative overflow-hidden shadow-sm flex items-center justify-between group flex-wrap gap-y-3 
                                ${isCurrent ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 hover:bg-slate-800/60'} 
                                ${isSelected ? 'ring-1 ring-emerald-500/50 bg-emerald-500/5' : ''}`}
                                onClick={() => !isCurrent && setComparisonId(isSelected ? null : prev.id)}>


                            {/* Left side: Date + Placement/Distance */}
                            <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className={`${isCurrent ? 'text-amber-500' : 'text-emerald-500/80'} shrink-0`} />
                                    <span className="text-[12px] font-bold text-white uppercase tracking-wider truncate">
                                        {isCurrent ? 'HÄR OCH NU' : normalizeRaceTitle(prev.plan?.title || (prev.performance as any)?.title || currentTitle)}
                                    </span>
                                    {isSameDistance && !isCurrent && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded font-black uppercase tracking-tighter">Samma distans</span>}
                                    {isCurrent && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ring-1 ring-amber-500/30">Laddat lopp</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[10px] font-semibold text-slate-400 italic">{formatSwedishDate(prev.date)}</span>
                                    <span className="text-slate-700">•</span>
                                    <span className="text-[10px] font-black text-emerald-400/90">{prevDist.toFixed(1)}k</span>
                                    {prevPlacement && (
                                        <>
                                            <span className="text-slate-700">•</span>
                                            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5 tracking-tighter"><Medal size={10} /> #{prevPlacement}</span>
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
                            
                            {/* Comparison Side Panel - Inside Current List */}
                            {isSelected && (
                                <RaceComparisonTable 
                                    current={currentActivity}
                                    comparing={prev}
                                    allActivities={allActivities}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {history.length > 3 && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex justify-center items-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-colors group"
                >
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest group-hover:text-white">
                        {isExpanded ? 'Visa färre' : `+ ${history.length - 3} fler lopp i serien`}
                    </span>
                    {isExpanded ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
                </button>
            )}
        </div>
    );
});

const RaceComparisonTable = ({ current, comparing, allActivities }: { current: UniversalActivity, comparing: UniversalActivity, allActivities: UniversalActivity[] }) => {
    // Helper for 8-week training stats
    const getTrainingStats = (activity: UniversalActivity) => {
        const activityDate = new Date(activity.date).getTime();
        const eightWeeksInMs = 8 * 7 * 24 * 60 * 60 * 1000;
        const startDate = activityDate - eightWeeksInMs;

        const prepActivities = allActivities.filter(a => {
            const d = new Date(a.date).getTime();
            return d >= startDate && d < activityDate;
        });

        const totalDistance = prepActivities.reduce((sum, a) => sum + (a.performance?.distanceKm || a.plan?.distanceKm || 0), 0);
        return {
            avgWeeklyDistance: totalDistance / 8,
            totalActivities: prepActivities.length
        };
    };

    const currentPrep = getTrainingStats(current);
    const compPrep = getTrainingStats(comparing);
    // Extract splits
    const currentSplits = current.performance?.splits || [];
    const compSplits = comparing.performance?.splits || [];

    if (currentSplits.length === 0 || compSplits.length === 0) {
        return (
            <div className="bg-slate-900 border border-white/5 rounded-lg p-4 text-center mt-1 mb-2">
                <p className="text-[10px] text-slate-500 italic">Ingen split-data tillgänglig för direkt jämförelse.</p>
                <button 
                  onClick={() => (window as any).location.href = `/activity/${comparing.id}`}
                  className="mt-2 text-[9px] text-emerald-400 font-bold uppercase hover:underline"
                >
                    Gå till passet för analys
                </button>
            </div>
        );
    }

    // Pre-calculate extremes individually for each activity
    let cFastestPace = Infinity, cSlowestPace = -Infinity;
    let cHighestHR = -Infinity, cLowestHR = Infinity;
    let pFastestPace = Infinity, pSlowestPace = -Infinity;
    let pHighestHR = -Infinity, pLowestHR = Infinity;
    
    currentSplits.forEach(s => {
        if (s.elapsedTime > 0) {
            if (s.elapsedTime < cFastestPace) cFastestPace = s.elapsedTime;
            if (s.elapsedTime > cSlowestPace) cSlowestPace = s.elapsedTime;
        }
        if (s.averageHeartrate) {
            if (s.averageHeartrate > cHighestHR) cHighestHR = s.averageHeartrate;
            if (s.averageHeartrate < cLowestHR) cLowestHR = s.averageHeartrate;
        }
    });

    compSplits.forEach(s => {
        if (s.elapsedTime > 0) {
            if (s.elapsedTime < pFastestPace) pFastestPace = s.elapsedTime;
            if (s.elapsedTime > pSlowestPace) pSlowestPace = s.elapsedTime;
        }
        if (s.averageHeartrate) {
            if (s.averageHeartrate > pHighestHR) pHighestHR = s.averageHeartrate;
            if (s.averageHeartrate < pLowestHR) pLowestHR = s.averageHeartrate;
        }
    });

    const maxSplits = Math.max(currentSplits.length, compSplits.length);
    let currentCumulativeSeconds = 0;
    let compCumulativeSeconds = 0;
    
    // Totals for average calculation
    let currentTotalHR = 0, currentHRCount = 0;
    let compTotalHR = 0, compHRCount = 0;

    // Average Pace for Footer
    const cAvgPace = (current.performance?.durationMinutes || 0) * 60 / (current.performance?.distanceKm || 1);
    const pAvgPace = (comparing.performance?.durationMinutes || 0) * 60 / (comparing.performance?.distanceKm || 1);
    const avgDiff = cAvgPace - pAvgPace;

    // Insights & Graph Logic
    const currentYear = new Date(current.date).getFullYear();
    const compYear = new Date(comparing.date).getFullYear();

    // Consistency Index (Standard Deviation of Pace)
    const calculateConsistency = (splits: any[]) => {
        if (splits.length < 2) return 0;
        const paces = splits.filter(s => s.elapsedTime > 0).map(s => s.elapsedTime);
        const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
        const variance = paces.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / paces.length;
        return Math.sqrt(variance);
    };

    const cConsistency = calculateConsistency(currentSplits);
    const pConsistency = calculateConsistency(compSplits);
    const consistencyDiff = pConsistency - cConsistency; // positive means current is more consistent (lower dev)

    // Fatigue Factor (Comparison of last 20% vs first 20%)
    const calculateFatigue = (splits: any[]) => {
        if (splits.length < 3) return 0;
        const count = Math.max(1, Math.floor(splits.length * 0.25));
        const first = splits.slice(0, count).reduce((a, b) => a + b.elapsedTime, 0) / count;
        const last = splits.slice(-count).reduce((a, b) => a + b.elapsedTime, 0) / count;
        return ((last / first) - 1) * 100; // % slowdown
    };

    const cFatigue = calculateFatigue(currentSplits);
    const pFatigue = calculateFatigue(compSplits);

    // Split Halves Logic
    const halfway = Math.floor(currentSplits.length / 2);
    const firstHalfSeconds = currentSplits.slice(0, halfway).reduce((a, b) => a + b.elapsedTime, 0);
    const secondHalfSeconds = currentSplits.slice(halfway).reduce((a, b) => a + b.elapsedTime, 0);
    
    const compHalfway = Math.floor(compSplits.length / 2);
    const compFirstHalfSeconds = compSplits.slice(0, compHalfway).reduce((a, b) => a + b.elapsedTime, 0);
    const compSecondHalfSeconds = compSplits.slice(compHalfway).reduce((a, b) => a + b.elapsedTime, 0);

    return (
        <div className="bg-slate-950/80 border border-white/10 rounded-lg overflow-hidden mt-1 mb-4 animate-in slide-in-from-top-2 p-1">
            <div className="p-2 bg-emerald-500/10 border-b border-white/5 flex items-center justify-between">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Timer size={10} /> Progressiv Analys & Grafer
                </span>
                <span className="text-[8px] text-slate-500 font-bold uppercase">{currentYear} vs {compYear}</span>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 p-2 items-start shrink-0">
                {/* Left: Table */}
                <div className="overflow-x-auto min-w-0 shrink-0">
                    <table className="w-fit text-left border-collapse">
                        <thead className="bg-black/40 text-[8px] font-black text-slate-500 uppercase">
                            <tr>
                                <th className="px-2 py-2 border-r border-white/5 text-center">KM</th>
                                <th className="px-3 py-2 border-r border-white/5 text-center" colSpan={2}>{currentYear}</th>
                                <th className="px-3 py-2 border-r border-white/5 text-center" colSpan={2}>{compYear}</th>
                                <th className="px-2 py-2 text-center border-r border-white/5">±M</th>
                                <th className="px-2 py-2 text-center border-r border-white/5">Puls</th>
                                <th className="px-2 py-2 text-right border-r border-white/5">Split +/-</th>
                                <th className="px-2 py-2 text-right">Tot +/-</th>
                            </tr>
                            <tr className="bg-black/20 text-[7px] tracking-tighter uppercase font-bold text-slate-600">
                                <th className="border-r border-white/5" />
                                <th className="px-1.5 text-center border-r border-white/5">Tempo</th>
                                <th className="px-1.5 text-center border-r border-white/5">Tid</th>
                                <th className="px-1.5 text-center border-r border-white/5">Tempo</th>
                                <th className="px-1.5 text-center border-r border-white/5">Tid</th>
                                <th className="px-1.5 text-center border-r border-white/5">Höjd N/H</th>
                                <th className="px-1.5 text-center border-r border-white/5">Puls</th>
                                <th className="px-1.5 text-right border-r border-white/5">+/-</th>
                                <th className="px-1.5 text-right">+/-</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {Array.from({ length: maxSplits }).map((_, idx) => {
                                const c = currentSplits[idx];
                                const p = compSplits[idx];
                                const km = idx + 1;
                                const isFifth = km % 5 === 0;

                                const cPace = c?.elapsedTime || 0;
                                const pPace = p?.elapsedTime || 0;
                                
                                currentCumulativeSeconds += cPace;
                                compCumulativeSeconds += pPace;

                                const cHR = c?.averageHeartrate;
                                const pHR = p?.averageHeartrate;
                                if (cHR) { currentTotalHR += cHR; currentHRCount++; }
                                if (pHR) { compTotalHR += pHR; compHRCount++; }

                                const diff = currentCumulativeSeconds - compCumulativeSeconds;
                                const splitDiff = cPace - pPace;
                                const isSlowerTotal = diff > 0;
                                const isSlowerSplit = splitDiff > 0;
                                const isPaceBetter = cPace > 0 && pPace > 0 && cPace < pPace;

                                if (!c && !p) return null;

                                return (
                                    <tr key={idx} className={`text-[10px] hover:bg-white/5 transition-colors ${isFifth ? 'bg-indigo-500/10 border-y border-indigo-500/20' : ''}`}>
                                        <td className={`px-2 py-1.5 text-center font-black ${isFifth ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'} border-r border-white/5`}>
                                            {km}
                                        </td>
                                        
                                        <td className={`px-2 py-1.5 text-center font-mono border-r border-white/5 ${isPaceBetter ? 'text-emerald-400 bg-emerald-500/5' : 'text-white'} ${cPace === cFastestPace ? 'ring-1 ring-amber-500/50 rounded-sm' : ''}`}>
                                            <div className="flex items-center justify-center gap-0.5">
                                                {c ? formatSecondsToTime(cPace) : '-'}
                                                {cPace === cFastestPace && <span className="text-[7px]">⚡</span>}
                                                {cPace === cSlowestPace && <span className="text-[7px]">🐢</span>}
                                            </div>
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-mono text-[9px] border-r border-white/5 ${!isSlowerTotal && diff !== 0 ? 'text-emerald-400/90' : 'text-slate-400'}`}>
                                            {c ? formatSecondsToTime(currentCumulativeSeconds) : '-'}
                                        </td>

                                        <td className={`px-2 py-1.5 text-center font-mono border-r border-white/5 ${!isPaceBetter && pPace > 0 && cPace > 0 ? 'text-emerald-400/70 bg-emerald-500/5' : 'text-slate-400'} ${pPace === pFastestPace ? 'ring-1 ring-white/20 rounded-sm' : ''}`}>
                                            <div className="flex items-center justify-center gap-0.5">
                                                {p ? formatSecondsToTime(pPace) : '-'}
                                                {pPace === pFastestPace && <span className="text-[7px]">⚡</span>}
                                                {pPace === pSlowestPace && <span className="text-[7px]">🐢</span>}
                                            </div>
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-mono text-[9px] border-r border-white/5 ${isSlowerTotal ? 'text-emerald-400/70' : 'text-slate-500'}`}>
                                            {p ? formatSecondsToTime(compCumulativeSeconds) : '-'}
                                        </td>

                                        <td className="px-2 py-1.5 text-center font-mono text-[9px] border-r border-white/5 italic">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span className="text-slate-400">{c?.elevationDiff !== undefined ? (c.elevationDiff > 0 ? '+' : '') + Math.round(c.elevationDiff) : '-'}</span>
                                                <span className="text-slate-700">|</span>
                                                <span className="text-slate-600">{p?.elevationDiff !== undefined ? (p.elevationDiff > 0 ? '+' : '') + Math.round(p.elevationDiff) : '-'}</span>
                                            </div>
                                        </td>

                                        <td className="px-2 py-1.5 text-center font-mono text-[9px] border-r border-white/5">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span className={`${cHR === cHighestHR ? 'text-rose-500 font-bold' : cHR === cLowestHR ? 'text-sky-400 font-bold' : 'text-rose-400/80'}`}>
                                                    {cHR ? Math.round(cHR) : '-'}
                                                </span>
                                                <div className="w-px h-2 bg-slate-800" />
                                                <span className={`${pHR === pHighestHR ? 'text-slate-300 font-bold' : pHR === pLowestHR ? 'text-sky-600 font-bold' : 'text-slate-500'}`}>
                                                    {pHR ? Math.round(pHR) : '-'}
                                                </span>
                                            </div>
                                        </td>

                                        <td className={`px-2 py-1.5 text-right font-mono text-[9px] border-r border-white/5 ${isSlowerSplit ? 'text-rose-400/70' : 'text-emerald-400/80'}`}>
                                            {cPace > 0 && pPace > 0 ? <>{isSlowerSplit ? '+' : '-'}{formatSecondsToTime(Math.abs(splitDiff))}</> : '-'}
                                        </td>

                                        <td className={`px-2 py-1.5 text-right font-mono font-black ${isSlowerTotal ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            <span className="mr-0.5 text-[8px]">{isSlowerTotal ? '▲' : '▼'}</span>{formatSecondsToTime(Math.abs(diff))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-black/60 text-[9px] border-t border-white/10">
                            <tr>
                                <td className="px-2 py-2 font-black text-slate-400 uppercase tracking-tighter border-r border-white/5">Total</td>
                                <td className="px-2 py-2 text-center text-white/50 font-mono text-[8px] border-r border-white/5">{formatPace(cAvgPace).replace('/km', '')}</td>
                                <td className="px-2 py-2 text-center text-white font-mono border-r border-white/5">{formatSecondsToTime((current.performance?.durationMinutes || 0) * 60)}</td>
                                <td className="px-2 py-2 text-center text-slate-500 font-mono text-[8px] border-r border-white/5">{formatPace(pAvgPace).replace('/km', '')}</td>
                                <td className="px-2 py-2 text-center text-slate-400 font-mono border-r border-white/5">{formatSecondsToTime((comparing.performance?.durationMinutes || 0) * 60)}</td>
                                <td className="px-2 py-2 text-center font-mono text-[8px] border-r border-white/5 text-slate-600">
                                    {current.performance?.elevationGain ? '+' + Math.round(current.performance.elevationGain) + 'm' : '-'}
                                    <span className="mx-1">|</span>
                                    {comparing.performance?.elevationGain ? '+' + Math.round(comparing.performance.elevationGain) + 'm' : '-'}
                                </td>
                                <td className="px-2 py-2 text-center font-mono text-[9px] border-r border-white/5">
                                    {currentHRCount > 0 ? Math.round(currentTotalHR / currentHRCount) : '-'} / {compHRCount > 0 ? Math.round(compTotalHR / compHRCount) : '-'}
                                </td>
                                <td className={`px-2 py-2 text-right font-mono text-[9px] border-r border-white/5 ${avgDiff > 0 ? 'text-rose-400/50' : 'text-emerald-400/60'}`}>
                                    {avgDiff !== 0 ? (avgDiff > 0 ? '+' : '-') + formatSecondsToTime(Math.abs(avgDiff)) : '-'}
                                </td>
                                <td className={`px-2 py-2 text-right font-black font-mono ${currentCumulativeSeconds > compCumulativeSeconds ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {currentCumulativeSeconds > compCumulativeSeconds ? '+' : '-'}{formatSecondsToTime(Math.abs(currentCumulativeSeconds - compCumulativeSeconds))}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Right: Charts & Stats */}
                <div className="flex-1 min-w-0 space-y-4 pr-2">
                    {/* SVG Split Graph */}
                    <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                        <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <TrendingUp size={10} /> Grafisk Jämförelse (Pace)
                        </h5>
                        <div className="h-[140px] w-full relative pt-2">
                            <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${maxSplits * 20} 100`} preserveAspectRatio="none">
                                {/* Grid lines */}
                                {[0, 25, 50, 75, 100].map(y => (
                                    <line key={y} x1="0" y1={y} x2={maxSplits * 20} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2,2" />
                                ))}
                                
                                {/* Historical Line - Background */}
                                <polyline
                                    fill="none"
                                    stroke="rgba(255,255,255,0.15)"
                                    strokeWidth="1"
                                    strokeDasharray="3,2"
                                    points={compSplits.map((s, i) => {
                                        const y = 100 - Math.min(95, Math.max(5, (s.elapsedTime - pFastestPace) / (pSlowestPace - pFastestPace || 1) * 90));
                                        return `${i * 20},${y}`;
                                    }).join(' ')}
                                />

                                {/* Current Line - Foreground (Pace) */}
                                <polyline
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={currentSplits.map((s, i) => {
                                        const y = 100 - Math.min(95, Math.max(5, (s.elapsedTime - cFastestPace) / (cSlowestPace - cFastestPace || 1) * 90));
                                        return `${i * 20},${y}`;
                                    }).join(' ')}
                                />
                                
                                {/* Pulse Line (Current) - Subtle Overlay */}
                                <polyline
                                    fill="none"
                                    stroke="rgba(244, 63, 94, 0.4)"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    points={currentSplits.filter(s => s.averageHeartrate).map((s, i) => {
                                        const hr = s.averageHeartrate || 0;
                                        // Map 100-200 bpm to graph height
                                        const y = 100 - Math.min(95, Math.max(5, (hr - 120) / (200 - 120) * 90));
                                        return `${i * 20},${y}`;
                                    }).join(' ')}
                                />

                                {/* Points */}
                                {currentSplits.map((s, i) => {
                                    const y = 100 - Math.min(95, Math.max(5, (s.elapsedTime - cFastestPace) / (cSlowestPace - cFastestPace || 1) * 90));
                                    return <circle key={i} cx={i * 20} cy={y} r="1.5" fill="#10b981" />;
                                })}
                            </svg>
                            <div className="absolute top-0 right-0 flex flex-col gap-1 items-end">
                                <span className="text-[7px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                                    <div className="w-2 h-0.5 bg-emerald-500 rounded-full" /> {currentYear} Pace
                                </span>
                                <span className="text-[7px] text-rose-400/60 font-bold uppercase flex items-center gap-1">
                                    <div className="w-2 h-0.5 bg-rose-500/40 rounded-full" /> {currentYear} Puls
                                </span>
                                <span className="text-[7px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                    <div className="w-2 h-0.5 bg-white/20 border-t border-dashed" /> {compYear} Pace
                                </span>
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between text-[7px] text-slate-600 font-bold">
                            <span>START</span>
                            <span>PROGRESSION (KM)</span>
                            <span>MÅL</span>
                        </div>
                    </div>

                    {/* Advanced Comparison Insights */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
                            <h6 className="text-[7px] font-black text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <TrendingUp size={10} /> Consistency Index
                            </h6>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-bold text-white font-mono">{Math.max(0, 100 - (cConsistency/2)).toFixed(1)}%</span>
                                <span className={`text-[8px] font-bold ${consistencyDiff > 0 ? 'text-emerald-400' : 'text-slate-500'} tracking-tighter`}>
                                    {consistencyDiff > 0 ? `+${(consistencyDiff/2).toFixed(1)}% bättre` : ''}
                                </span>
                            </div>
                            <p className="text-[7px] text-slate-500 mt-1 italic leading-tight">Mäter hur jämnt tempot har hållits över alla kilometrar.</p>
                        </div>

                        <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-2.5">
                            <h6 className="text-[7px] font-black text-rose-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <HeartPulse size={10} /> Heart Rate Drift
                            </h6>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-bold text-white font-mono">{cFatigue.toFixed(1)}%</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Slowdown</span>
                            </div>
                            <p className="text-[7px] text-slate-500 mt-1 italic leading-tight">Relation mellan effekt och puls mot slutet av loppet.</p>
                        </div>

                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <h6 className="text-[7px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                     Smart Performance Insights
                                </h6>
                                <span className="text-[7px] px-1.5 py-0.5 bg-indigo-500/10 rounded text-indigo-400 font-black uppercase">Beta</span>
                            </div>
                            <div className="space-y-2">
                                {/* Halves Comparison */}
                                <div className="grid grid-cols-2 gap-4 border-b border-indigo-500/10 pb-2 mb-2">
                                    <div className="space-y-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-black tracking-tighter">Första Halvan</span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-[10px] font-bold text-white font-mono">{formatSecondsToTime(firstHalfSeconds)}</span>
                                            <span className="text-[8px] text-slate-500 font-mono">({formatSecondsToTime(compFirstHalfSeconds)})</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-black tracking-tighter">Andra Halvan</span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className={`text-[10px] font-bold font-mono ${secondHalfSeconds <= firstHalfSeconds ? 'text-emerald-400' : 'text-amber-400'}`}>{formatSecondsToTime(secondHalfSeconds)}</span>
                                            <span className="text-[8px] text-slate-500 font-mono">({formatSecondsToTime(compSecondHalfSeconds)})</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 8-Week Prep Comparison */}
                                <div className="flex items-center justify-between text-[9px] bg-black/20 p-1.5 rounded border border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-[7px] text-indigo-400 font-black uppercase">8v Uppladdning</span>
                                        <span className="text-white font-bold">{currentPrep.avgWeeklyDistance.toFixed(0)}km/v <span className="text-slate-500 font-normal">({currentPrep.totalActivities} pass)</span></span>
                                    </div>
                                    <div className="text-right flex flex-col">
                                        <span className="text-[7px] text-slate-500 font-black uppercase italic">Jmf {compYear}</span>
                                        <span className="text-slate-400">{compPrep.avgWeeklyDistance.toFixed(0)}km/v <span className="text-slate-600 font-normal">({compPrep.totalActivities} pass)</span></span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-[9px] pt-1">
                                    <span className="text-slate-500">Pacing-strategi:</span>
                                    <span className={`font-black tracking-widest ${cFatigue < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {cFatigue < 0 ? 'NEGATIVE SPLIT ⚡' : 'POSITIVE SPLIT 🐢'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[9px]">
                                    <span className="text-slate-500">Formbesked:</span>
                                    <span className="font-bold text-white">
                                        {currentPrep.avgWeeklyDistance > compPrep.avgWeeklyDistance * 1.1 ? 'Bättre mängtträning' : avgDiff < 0 ? `Snabbare än ${compYear}` : `Bättre puls-effektivitet`}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[9px]">
                                    <span className="text-slate-500">Bästa 5k:</span>
                                    <span className="font-black text-white font-mono tracking-tighter">
                                        {formatSecondsToTime(Math.min(...Array.from({length: Math.max(0, currentSplits.length - 4)}).map((_, i) => 
                                            currentSplits.slice(i, i+5).reduce((a, b) => a + b.elapsedTime, 0)
                                        )) || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
