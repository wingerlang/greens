import React, { useState, useMemo } from 'react';
import { StrengthWorkout, PersonalBest, calculate1RM } from '../../models/strengthTypes.ts';

interface TopExercisesTableProps {
    workouts: StrengthWorkout[];
    personalBests?: PersonalBest[];
    onSelectExercise?: (name: string) => void;
}

export function TopExercisesTable({ workouts, personalBests = [], onSelectExercise }: TopExercisesTableProps) {
    const [sortBy, setSortBy] = useState<'name' | 'count' | 'sets' | 'reps' | 'volume' | 'pb'>('volume');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filter, setFilter] = useState<'all' | 'bw' | 'weighted'>('all');

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
            pb?: PersonalBest;
            estimated1RM: number;  // Estimated 1RM (calculated)
            maxWeight: number;     // Actual heaviest weight lifted
            maxWeightDate?: string;
        }> = {};

        workouts.forEach(w => {
            w.exercises.forEach(ex => {
                const key = ex.exerciseName.toLowerCase().trim();

                if (!stats[key]) {
                    const isBW = ex.sets.every(s => s.isBodyweight || s.weight === 0);
                    const pb = pbMap.get(key);

                    stats[key] = {
                        name: ex.exerciseName,
                        sets: 0,
                        reps: 0,
                        volume: 0,
                        count: 0,
                        isBW,
                        pb,
                        estimated1RM: pb?.estimated1RM || 0,
                        maxWeight: pb?.weight || 0,
                        maxWeightDate: pb?.date
                    };
                }

                // Track best e1RM and max weight from this exercise's sets
                ex.sets.forEach(set => {
                    if (set.weight > 0 && set.reps > 0) {
                        const est1RM = calculate1RM(set.weight, set.reps);
                        if (est1RM > stats[key].estimated1RM) {
                            stats[key].estimated1RM = est1RM;
                        }
                        if (set.weight > stats[key].maxWeight) {
                            stats[key].maxWeight = set.weight;
                            stats[key].maxWeightDate = w.date;
                        }
                    }
                });

                stats[key].sets += ex.sets.length;
                stats[key].reps += ex.sets.reduce((sum, s) => sum + s.reps, 0);
                stats[key].volume += ex.totalVolume || 0;
                stats[key].count += 1;
            });
        });

        let result = Object.values(stats);

        // Apply equipment filter
        if (filter === 'bw') {
            result = result.filter(ex => ex.isBW);
        } else if (filter === 'weighted') {
            result = result.filter(ex => !ex.isBW);
        }

        // Apply sorting
        return result.sort((a, b) => {
            let mult = sortOrder === 'asc' ? 1 : -1;
            if (sortBy === 'name') return mult * a.name.localeCompare(b.name);
            if (sortBy === 'pb') return mult * (a.estimated1RM - b.estimated1RM);
            return mult * (a[sortBy] - b[sortBy]);
        });
    }, [workouts, sortBy, sortOrder, filter, pbMap]);

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

    if (exerciseStats.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2">
                {[
                    { id: 'all', label: 'Alla övningar' },
                    { id: 'bw', label: 'Bara kroppsvikt' },
                    { id: 'weighted', label: 'Fria vikter / Maskin' }
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id as any)}
                        className={`text-[10px] font-black uppercase px-4 py-2 rounded-full border transition-all ${filter === f.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-sm">
                    <thead className="bg-slate-950 text-[10px] text-slate-500 uppercase font-black">
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
                        {exerciseStats.map((ex, i) => (
                            <tr
                                key={ex.name}
                                className={`hover:bg-slate-800/30 ${onSelectExercise ? 'cursor-pointer' : ''}`}
                                onClick={() => onSelectExercise?.(ex.name)}
                            >
                                <td className="px-4 py-4 text-white font-black group">
                                    <span className="group-hover:text-blue-400 group-hover:underline transition-colors">{ex.name}</span>
                                    {ex.isBW && <span className="ml-2 text-[9px] text-slate-500 border border-white/10 px-1.5 py-0.5 rounded bg-slate-800">KV</span>}
                                </td>
                                <td className="px-4 py-4 text-right">
                                    {ex.estimated1RM > 0 || ex.maxWeight > 0 ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                            {/* Estimated 1RM */}
                                            {ex.estimated1RM > 0 && (
                                                <span className="text-amber-400 font-bold">{ex.estimated1RM}kg <span className="text-[9px] text-slate-500">e1RM</span></span>
                                            )}
                                            {/* Actual max weight */}
                                            {ex.maxWeight > 0 && ex.maxWeight !== ex.estimated1RM && (
                                                <span className="text-sky-400 font-bold text-xs">{ex.maxWeight}kg <span className="text-[9px] text-slate-500">max</span></span>
                                            )}
                                            {/* Date */}
                                            {ex.maxWeightDate && (
                                                <span className="text-[9px] text-slate-500">{formatDaysAgoCompact(ex.maxWeightDate)}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-slate-600">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-right text-slate-400">{ex.count}</td>
                                <td className="px-4 py-4 text-right text-slate-500 hidden md:table-cell">{ex.sets}</td>
                                <td className="px-4 py-4 text-right text-slate-500 hidden md:table-cell">{ex.reps}</td>
                                <td className="px-4 py-4 text-right text-emerald-400 font-bold">{(ex.volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
