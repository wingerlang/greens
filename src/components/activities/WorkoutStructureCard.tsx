import React, { useMemo } from 'react';
import { ParsedWorkout, WorkoutSegment } from '../../models/analysisTypes.ts';
import { ExerciseEntry } from '../../models/types.ts';
import { formatDuration, formatPace } from '../../utils/dateUtils.ts';
import { calculatePerformanceScore } from '../../utils/performanceEngine.ts';
import { parseWorkout } from '../../utils/workoutParser.ts';
import { Zap, Trophy, Activity, Target } from 'lucide-react';

interface WorkoutStructureCardProps {
    title: string;
    description: string;
    subPerformances?: ExerciseEntry[];
}

const PerformanceSegment = ({ sub, segment }: { sub: ExerciseEntry; segment: WorkoutSegment }) => {
    const score = calculatePerformanceScore(sub);
    const paceSec = (sub.durationMinutes * 60) / (sub.distance || 1);

    return (
        <div className="relative flex flex-col gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 mb-3 shadow-lg shadow-amber-500/5 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 shadow-lg">
                        <Trophy size={16} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest leading-none">
                            Sparad Nyckelinsats
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">
                            {sub.title}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black text-white leading-none">{score}</div>
                    <div className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Greens Score</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Distans</span>
                    <span className="text-sm font-black text-white">{sub.distance?.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">km</span></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Tid</span>
                    <span className="text-sm font-black text-white">{formatDuration(sub.durationMinutes * 60)}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Tempo</span>
                    <span className="text-sm font-black text-white">{formatPace(paceSec).replace('/km', '')} <span className="text-[10px] font-normal text-slate-500">/km</span></span>
                </div>
            </div>

            <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-500 font-bold italic">Matcher segment: {segment.type} {segment.work.dist}m</span>
                <span className="text-amber-500 font-black flex items-center gap-1 uppercase tracking-widest">
                    <Zap size={8} className="fill-amber-500" /> Identifierad ✓
                </span>
            </div>
        </div>
    );
};

const SegmentRow = ({ segment, index }: { segment: WorkoutSegment; index: number }) => {
    const isInterval = segment.type === 'INTERVAL';
    const isRest = segment.type === 'REST';
    const isWarmup = segment.type === 'WARMUP';
    const isCooldown = segment.type === 'COOLDOWN';

    let bgColor = 'bg-slate-800/40';
    let borderColor = 'border-white/5';
    let icon = '⏱️';
    let textColor = 'text-slate-400';

    if (isInterval) {
        bgColor = 'bg-amber-500/5';
        borderColor = 'border-amber-500/20';
        icon = '⚡';
        textColor = 'text-amber-400';
    } else if (isRest) {
        bgColor = 'bg-slate-900/40';
        borderColor = 'border-white/5 opacity-50';
        icon = '💤';
        textColor = 'text-slate-500';
    } else if (isWarmup) {
        bgColor = 'bg-emerald-500/5';
        borderColor = 'border-emerald-500/20';
        icon = '🔥';
        textColor = 'text-emerald-400';
    } else if (isCooldown) {
        bgColor = 'bg-blue-500/5';
        borderColor = 'border-blue-500/20';
        icon = '🧊';
        textColor = 'text-blue-400';
    }

    return (
        <div className={`relative flex items-center gap-3 p-3 rounded-xl border ${borderColor} ${bgColor} mb-2 group hover:border-white/20 transition-all`}>
            <div className="w-6 h-6 flex items-center justify-center text-sm">{icon}</div>

            <div className="flex-1">
                <div className="flex items-baseline justify-between">
                    <h4 className={`text-[10px] font-black uppercase tracking-widest ${textColor}`}>
                        {segment.type} {segment.reps > 1 && <span className="text-white ml-2 opacity-50 group-hover:opacity-100 transition-opacity">x{segment.reps}</span>}
                    </h4>
                    {segment.work.pace && (
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                            Mål: {segment.work.pace.display}
                        </span>
                    )}
                </div>

                <div className="flex items-baseline gap-2 mt-0.5">
                    {segment.work.dist ? (
                        <span className="text-base font-black text-white">{segment.work.dist} <span className="text-[10px] font-normal text-slate-500">m</span></span>
                    ) : segment.work.time ? (
                        <span className="text-base font-black text-white">{Math.round(segment.work.time / 60)} <span className="text-[10px] font-normal text-slate-500">min</span></span>
                    ) : (
                        <span className="text-xs text-slate-500 italic">Ingen distans/tid</span>
                    )}
                </div>
            </div>

            {/* Recovery Pill */}
            {segment.recovery && (
                <div className="absolute -bottom-2 right-4 px-2 py-0.5 bg-slate-950 border border-white/10 rounded-full text-[9px] text-slate-500 font-black uppercase tracking-tighter shadow-sm">
                    {segment.recovery.type === 'distance' ? `${segment.recovery.value}m` : `${segment.recovery.value}s`} vila
                </div>
            )}
        </div>
    );
};

export function WorkoutStructureCard({ title, description, subPerformances = [] }: WorkoutStructureCardProps) {
    const parsed = useMemo(() => parseWorkout(title, description), [title, description]);

    if (!parsed || parsed.segments.length === 0) return null;

    // Helper to find if a segment matches a sub-performance
    const findMatchingPerformance = (segment: WorkoutSegment) => {
        if (!segment.work.dist) return null;

        // Exact distance match or very close (+/- 2%)
        return subPerformances.find(p => {
            const pDistMeters = (p.distance || 0) * 1000;
            return Math.abs(pDistMeters - segment.work.dist!) < (segment.work.dist! * 0.05); // Allow 5% variance
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <Target size={12} /> Pass-struktur & Analys
                </h3>
                <span className="text-[9px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full border border-white/5 font-black uppercase tracking-widest">
                    {parsed.classification}
                </span>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5 max-h-[500px] overflow-y-auto custom-scrollbar">
                {(() => {
                    const matchedIds = new Set<string>();
                    return parsed.segments.map((seg: WorkoutSegment, i: number) => {
                        const match = findMatchingPerformance(seg);
                        if (match && !matchedIds.has(match.id)) {
                            matchedIds.add(match.id);
                            return <PerformanceSegment key={i} segment={seg} sub={match} />;
                        }
                        // If this segment was a duplicate match, just skip it entirely
                        if (match && matchedIds.has(match.id)) {
                            return null;
                        }
                        return <SegmentRow key={i} segment={seg} index={i} />;
                    });
                })()}
            </div>

            <p className="text-[10px] text-slate-600 italic text-center">
                * Analyserat automatiskt från beskrivningen.
            </p>
        </div>
    );
}
