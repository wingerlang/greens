import React, { useState, useMemo } from 'react';
import { StrengthWorkout } from '../../models/strengthTypes.ts';

interface TopExercisesTableProps {
    workouts: StrengthWorkout[];
    onSelectExercise?: (name: string) => void;
}

export function TopExercisesTable({ workouts, onSelectExercise }: TopExercisesTableProps) {
    const [sortBy, setSortBy] = useState<'name' | 'count' | 'sets' | 'reps' | 'volume'>('volume');
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

    const exerciseStats = useMemo(() => {
        const stats: Record<string, { name: string; sets: number; reps: number; volume: number; count: number, isBW: boolean }> = {};

        workouts.forEach(w => {
            w.exercises.forEach(ex => {
                if (!stats[ex.exerciseName]) {
                    const isBW = ex.sets.every(s => s.isBodyweight || s.weight === 0);
                    stats[ex.exerciseName] = { name: ex.exerciseName, sets: 0, reps: 0, volume: 0, count: 0, isBW };
                }
                stats[ex.exerciseName].sets += ex.sets.length;
                stats[ex.exerciseName].reps += ex.sets.reduce((sum, s) => sum + s.reps, 0);
                stats[ex.exerciseName].volume += ex.totalVolume || 0;
                stats[ex.exerciseName].count += 1;
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
            return mult * (a[sortBy] - b[sortBy]);
        });
    }, [workouts, sortBy, sortOrder, filter]);

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
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('count')}>
                                Gånger {sortBy === 'count' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('sets')}>
                                Set {sortBy === 'sets' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('reps')}>
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
                                <td className="px-4 py-4 text-right text-slate-400">{ex.count}</td>
                                <td className="px-4 py-4 text-right text-slate-500">{ex.sets}</td>
                                <td className="px-4 py-4 text-right text-slate-500">{ex.reps}</td>
                                <td className="px-4 py-4 text-right text-emerald-400 font-bold">{(ex.volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
