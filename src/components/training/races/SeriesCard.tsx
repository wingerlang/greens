import React from 'react';
import { Trophy, Clock } from 'lucide-react';
import { ExerciseEntry } from '../../../models/types.ts';
import { RaceSeries } from './types.ts';

interface SeriesCardProps {
    series: RaceSeries;
    onSelect: () => void;
    setSelectedActivity: (activity: ExerciseEntry) => void;
    formatActivityDuration: (mins: number) => string;
}

export function SeriesCard({
    series,
    onSelect,
    setSelectedActivity,
    formatActivityDuration
}: SeriesCardProps) {
    return (
        <div 
            onClick={onSelect}
            className="group bg-slate-900/80 border border-white/10 rounded-3xl p-6 hover:border-amber-500/50 transition-all cursor-pointer shadow-xl shadow-black/40 flex flex-col justify-between"
        >
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-950 p-3 rounded-2xl border border-white/5 group-hover:border-amber-500/30 transition-colors">
                        <Trophy size={24} className="text-amber-500" />
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-white">{series.stats.count}x</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Starter</div>
                    </div>
                </div>
                <h3 className="text-lg font-black text-white leading-tight mb-2 group-hover:text-amber-500 transition-colors line-clamp-2">{series.name}</h3>
                <div className="flex flex-wrap gap-1.5 mb-6">
                    {series.stats.years.slice(-4).map(year => (
                        <span key={year} className="text-[9px] font-black text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-white/5">{year}</span>
                    ))}
                    {series.stats.years.length > 4 && <span className="text-[9px] font-black text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-white/5">+{series.stats.years.length - 4}</span>}
                </div>
            </div>

            <div className="space-y-4">
                {series.stats.byDistance && series.stats.byDistance.length > 0 ? (
                    series.stats.byDistance.map(distStats => (
                        <div key={distStats.distance} className="space-y-1.5 p-3.5 bg-slate-950/40 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1.5">
                                <span className="text-xs font-black text-amber-500 font-mono">{distStats.distance} km</span>
                                <span className="text-[9px] font-black text-slate-500 uppercase">{distStats.count}x start{distStats.count > 1 ? 'er' : ''}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Trophy size={11} className="text-amber-500/80" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Best</span>
                                </div>
                                <span className="text-xs font-black text-emerald-400 font-mono">{formatActivityDuration(distStats.pb.durationMinutes)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={11} className="text-slate-500" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Avg</span>
                                </div>
                                <span className="text-xs font-black text-slate-300 font-mono">{formatActivityDuration(distStats.avgDuration)}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <>
                        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trophy size={14} className="text-amber-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase">Personal Best</span>
                            </div>
                            <span className="text-sm font-black text-emerald-400 font-mono">{formatActivityDuration(series.stats.pb.durationMinutes)}</span>
                        </div>
                        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-slate-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase">Avg Time</span>
                            </div>
                            <span className="text-sm font-black text-slate-300 font-mono">{formatActivityDuration(series.stats.avgDuration)}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
