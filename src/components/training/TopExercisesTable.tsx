import React, { useState, useMemo } from 'react';
import { StrengthWorkout, PersonalBest, isBodyweightExercise, isTimeBasedExercise, getTimePBValue, isHyroxExercise, isWeightedDistanceExercise, isDistanceBasedExercise } from '../../models/strengthTypes.ts';
import { calculateEstimated1RM } from '../../utils/strengthCalculators.ts';

interface TopExercisesTableProps {
    workouts: StrengthWorkout[];
    personalBests?: PersonalBest[];
    onSelectExercise?: (name: string) => void;
}

export function TopExercisesTable({ workouts, personalBests = [], onSelectExercise }: TopExercisesTableProps) {
    const [sortBy, setSortBy] = useState<'name' | 'count' | 'sets' | 'reps' | 'volume' | 'pb'>('volume');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filter, setFilter] = useState<'all' | 'bw' | 'weighted' | 'cardio' | 'hyrox'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 100;

    const handleSort = (field: typeof sortBy) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    // Map exercise names to their best PB
    const pbMap = useMemo(() => {
        const map = new Map<string, PersonalBest>();

        personalBests.forEach(pb => {
            const key = pb.exerciseName.toLowerCase().trim();
            const existing = map.get(key);

            // Keep the highest 1RM PB
            if (!existing || (pb.type === '1rm' && pb.value > (existing.value || 0))) {
                map.set(key, pb);
            } else if (!existing || (pb.estimated1RM && pb.estimated1RM > (existing.estimated1RM || 0))) {
                map.set(key, pb);
            }
        });

        return map;
    }, [personalBests]);

    const exerciseStats = useMemo(() => {
        const stats: Record<string, {
            name: string;
            sets: number;
            reps: number;
            volume: number;
            count: number;
            isBW: boolean;
            isTimeBased: boolean;
            pb?: PersonalBest;
            estimated1RM: number;
            maxWeight: number;
            maxWeightDate?: string;
            maxTimeSeconds: number;
            maxTimeFormatted: string;
            isHyrox: boolean;
            isWeightedDistance: boolean;
            isDistanceBased: boolean;
            maxDistance: number;
            maxDistanceUnit: string;
        }> = {};

        workouts.forEach(w => {
            w.exercises.forEach(ex => {
                const key = ex.exerciseName.toLowerCase().trim();

                if (!stats[key]) {
                    const isBW = isBodyweightExercise(ex.exerciseName) || ex.sets.every(s => s.isBodyweight || s.weight === 0);
                    const isTime = isTimeBasedExercise(ex.exerciseName);
                    const pb = pbMap.get(key);

                    stats[key] = {
                        name: ex.exerciseName,
                        sets: 0,
                        reps: 0,
                        volume: 0,
                        count: 0,
                        isBW,
                        isTimeBased: isTime,
                        pb,
                        estimated1RM: pb?.estimated1RM || 0,
                        maxWeight: pb?.weight || 0,
                        maxWeightDate: pb?.date,
                        maxTimeSeconds: 0,
                        maxTimeFormatted: '',
                        isHyrox: isHyroxExercise(ex.exerciseName),
                        isWeightedDistance: isWeightedDistanceExercise(ex.exerciseName),
                        isDistanceBased: isDistanceBasedExercise(ex.exerciseName),
                        maxDistance: pb?.distance || 0,
                        maxDistanceUnit: pb?.distanceUnit || 'm'
                    };
                }

                // Track best e1RM and max weight from this exercise's sets
                ex.sets.forEach(set => {
                    // Track time for time-based exercises
                    if (stats[key].isTimeBased) {
                        const timeResult = getTimePBValue([set]);
                        if (timeResult && timeResult.seconds > stats[key].maxTimeSeconds) {
                            stats[key].maxTimeSeconds = timeResult.seconds;
                            stats[key].maxTimeFormatted = timeResult.formatted;
                            stats[key].maxWeightDate = w.date;
                        }
                    }

                    // Track weight for weighted exercises
                    // For bodyweight exercises, use only extraWeight for 1RM calculation
                    const calcWeight = stats[key].isBW
                        ? (set.extraWeight || 0)
                        : set.weight;
                    const displayWeight = stats[key].isBW
                        ? (set.extraWeight || 0)
                        : set.weight;

                    if (calcWeight > 0 && set.reps > 0) {
                        const est1RM = calculateEstimated1RM(calcWeight, set.reps);
                        if (est1RM > stats[key].estimated1RM) {
                            stats[key].estimated1RM = est1RM;
                        }
                        if (displayWeight > stats[key].maxWeight) {
                            stats[key].maxWeight = displayWeight;
                            stats[key].maxWeightDate = w.date;
                        }
                    } else if (stats[key].isBW && set.reps > 0 && (!set.extraWeight || set.extraWeight === 0)) {
                        // Pure bodyweight (no extra weight) - track max reps instead
                        // Don't update maxWeight/estimated1RM since there's no added weight
                    }
                });

                stats[key].sets += ex.sets.length;
                stats[key].reps += ex.sets.reduce((sum, s) => sum + s.reps, 0);

                // Smart Volume Calculation
                let volume = 0;
                if (stats[key].isWeightedDistance) {
                    volume = ex.sets.reduce((sum, s) => sum + (s.weight * (s.distance || 0)), 0);
                } else if (stats[key].isDistanceBased) {
                    volume = ex.sets.reduce((sum, s) => sum + (s.distance || 0), 0);
                } else {
                    volume = ex.totalVolume || 0;
                }
                stats[key].volume += volume;
                stats[key].count += 1;
            });
        });

        let result = Object.values(stats);

        // Apply equipment filter
        if (filter === 'bw') {
            result = result.filter(ex => ex.isBW);
        } else if (filter === 'weighted') {
            result = result.filter(ex => !ex.isBW && !ex.isTimeBased && !ex.isDistanceBased && !ex.isWeightedDistance && !ex.isHyrox);
        } else if (filter === 'cardio') {
            result = result.filter(ex => ex.isTimeBased || ex.isDistanceBased || ex.isWeightedDistance || ex.isHyrox);
        } else if (filter === 'hyrox') {
            result = result.filter(ex => ex.isHyrox);
        }

        // Apply search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(ex => ex.name.toLowerCase().includes(term));
        }

        // Apply sorting
        return result.sort((a, b) => {
            let mult = sortOrder === 'asc' ? 1 : -1;
            if (sortBy === 'name') return mult * a.name.localeCompare(b.name);
            if (sortBy === 'pb') {
                // Sort by max metric depending on type? mostly e1rm or maxWeight 
                return mult * (a.estimated1RM - b.estimated1RM);
            }
            // For other numeric fields
            // @ts-ignore - dynamic access to properties we know exist
            return mult * (a[sortBy] - b[sortBy]);
        });
    }, [workouts, sortBy, sortOrder, filter, searchTerm, pbMap]);

    const paginatedStats = useMemo(() => {
        const start = (page - 1) * pageSize;
        return exerciseStats.slice(start, start + pageSize);
    }, [exerciseStats, page]);

    const totalPages = Math.ceil(exerciseStats.length / pageSize);

    // Helper to format days ago as "2y4m sedan"
    const formatDaysAgoCompact = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'idag';
        if (diffDays === 1) return 'igår';
        if (diffDays < 7) return `${diffDays}d sedan`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}v sedan`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}m sedan`;

        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        return months > 0 ? `${years}y${months}m sedan` : `${years}y sedan`;
    };

    if (exerciseStats.length === 0 && !searchTerm) return null;

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4">
                <div className="flex gap-2 flex-wrap">
                    {[
                        { id: 'all', label: 'Alla' },
                        { id: 'bw', label: 'Kroppsvikt' },
                        { id: 'weighted', label: 'Fria vikter' },
                        { id: 'cardio', label: 'Cardio' },
                        { id: 'hyrox', label: 'Hyrox' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => {
                                setFilter(f.id as any);
                                setPage(1); // Reset page on filter change
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f.id
                                ? 'bg-white text-slate-900'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:w-64">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="Sök övning..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-slate-950/50">
                <table className="w-full text-xs">
                    <thead className="text-slate-500 font-bold bg-slate-900/90 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                            <th className="px-4 py-4 text-left cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                                Övning {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('pb')}>
                                e1RM / Max {sortBy === 'pb' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('count')}>
                                Gånger {sortBy === 'count' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('sets')}>
                                Set {sortBy === 'sets' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('reps')}>
                                Reps {sortBy === 'reps' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('volume')}>
                                Total volym {sortBy === 'volume' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedStats.map((ex, i) => (
                            <tr
                                key={ex.name}
                                className={`hover:bg-slate-800/30 ${onSelectExercise ? 'cursor-pointer' : ''}`}
                                onClick={() => onSelectExercise?.(ex.name)}
                            >
                                <td className="px-4 py-4 text-white font-black group">
                                    <span className="group-hover:text-blue-400 group-hover:underline transition-colors">{ex.name}</span>
                                    {ex.isBW && <span className="ml-2 text-[9px] text-slate-500 border border-white/10 px-1.5 py-0.5 rounded bg-slate-800">KV</span>}
                                    {(ex.isTimeBased || ex.isDistanceBased) && <span className="ml-2 text-[9px] text-cyan-500 border border-cyan-500/20 px-1.5 py-0.5 rounded bg-cyan-500/10">CARDIO</span>}
                                    {ex.isHyrox && <span className="ml-2 text-[9px] text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded bg-amber-500/10 tracking-wider">HYROX</span>}
                                    {ex.isWeightedDistance && <span className="ml-2 text-[9px] text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded bg-emerald-500/10">DIST</span>}
                                </td>
                                <td className="px-4 py-4 text-right">
                                    {/* Time-based exercises - show duration */}
                                    {ex.isTimeBased && ex.maxTimeSeconds > 0 ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-cyan-400 font-bold">{ex.maxTimeFormatted} <span className="text-[9px] text-slate-500">rekord</span></span>
                                            {ex.maxWeightDate && (
                                                <span className="text-[9px] text-slate-500">{formatDaysAgoCompact(ex.maxWeightDate)}</span>
                                            )}
                                        </div>
                                    ) : ex.isDistanceBased ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-cyan-400 font-bold">{ex.maxDistance > 0 ? ex.maxDistance + 'm' : '-'}</span>
                                            {ex.maxWeightDate && (
                                                <span className="text-[9px] text-slate-500">{formatDaysAgoCompact(ex.maxWeightDate)}</span>
                                            )}
                                        </div>
                                    ) : ex.isWeightedDistance && (ex.maxWeight > 0 || ex.maxDistance > 0) ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-emerald-400 font-bold">
                                                {ex.maxWeight}kg <span className="text-slate-400 text-[10px] font-normal">({ex.maxDistance}{ex.maxDistanceUnit})</span>
                                                <span className="text-[9px] text-slate-500 ml-1">PB</span>
                                            </span>
                                            {ex.maxWeightDate && (
                                                <span className="text-[9px] text-slate-500">{formatDaysAgoCompact(ex.maxWeightDate)}</span>
                                            )}
                                        </div>
                                    ) : ex.estimated1RM > 0 || ex.maxWeight > 0 ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                            {/* For bodyweight exercises, show actual 1RM (max reps) as primary */}
                                            {ex.isBW ? (
                                                <>
                                                    {ex.maxWeight > 0 && (
                                                        <span className="text-sky-400 font-bold">{ex.maxWeight}kg <span className="text-[9px] text-slate-500">1RM</span></span>
                                                    )}
                                                    {ex.estimated1RM > 0 && ex.estimated1RM !== ex.maxWeight && (
                                                        <span className="text-amber-400/60 font-bold text-xs">{ex.estimated1RM}kg <span className="text-[9px] text-slate-500">e1RM</span></span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {/* Weighted exercises - show e1RM as primary */}
                                                    {ex.estimated1RM > 0 && (
                                                        <span className="text-amber-400 font-bold">{ex.estimated1RM}kg <span className="text-[9px] text-slate-500">e1RM</span></span>
                                                    )}
                                                    {ex.maxWeight > 0 && ex.maxWeight !== ex.estimated1RM && (
                                                        <span className="text-sky-400 font-bold text-xs">{ex.maxWeight}kg <span className="text-[9px] text-slate-500">max</span></span>
                                                    )}
                                                </>
                                            )}
                                            {ex.maxWeightDate && (
                                                <span className="text-[9px] text-slate-500">{formatDaysAgoCompact(ex.maxWeightDate)}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-slate-600">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-right text-slate-400">{ex.count}</td>
                                <td className="px-4 py-4 text-right text-slate-500 hidden md:table-cell">{ex.sets > 0 ? ex.sets : '-'}</td>
                                <td className="px-4 py-4 text-right text-slate-500 hidden md:table-cell">{ex.reps > 0 ? ex.reps : '-'}</td>
                                <td className="px-4 py-4 text-right text-emerald-400 font-bold whitespace-nowrap">
                                    {(ex.isDistanceBased ? (ex.volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + 'km' :
                                        (ex.volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + 't')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <p className="text-[10px] text-slate-500">
                        Visar {Math.min((page - 1) * pageSize + 1, exerciseStats.length)}-{Math.min(page * pageSize, exerciseStats.length)} av {exerciseStats.length} övningar
                    </p>
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-white/5">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${page === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'}`}
                        >
                            ←
                        </button>
                        <span className="px-3 py-1 text-xs font-bold text-slate-400 border-x border-white/5">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${page === totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'}`}
                        >
                            →
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
