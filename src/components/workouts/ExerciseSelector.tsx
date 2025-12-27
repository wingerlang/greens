import React, { useState, useMemo } from 'react';
import { HYROX_ENCYCLOPEDIA } from '../../utils/hyroxEncyclopedia.ts';
import { MUSCLE_MAP } from '../../data/muscleMap.ts';

interface Props {
    onSelect: (exerciseName: string) => void;
}

export function ExerciseSelector({ onSelect }: Props) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<'ALL' | 'STRENGTH' | 'CARDIO'>('ALL');

    // Aggregate unique exercises
    const uniqueExercises = useMemo(() => {
        const set = new Set<string>();

        // 1. From Muscle Map (Strength)
        Object.keys(MUSCLE_MAP).forEach(k => set.add(k));

        // 2. From Hyrox Encyclopedia
        Object.values(HYROX_ENCYCLOPEDIA).forEach(h => {
            if (h) set.add(h.title);
        });

        return Array.from(set).sort();
    }, []);

    const filtered = useMemo(() => {
        return uniqueExercises.filter(ex =>
            ex.toLowerCase().includes(search.toLowerCase())
        );
    }, [uniqueExercises, search]);

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-white/10">
            {/* HER0 */}
            <div className="p-4 border-b border-white/5 space-y-3">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Exercise Library</h3>

                <input
                    type="text"
                    placeholder="Search movements..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                />

                <div className="flex gap-2">
                    {['ALL', 'STRENGTH', 'CARDIO'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`flex-1 py-1 text-[9px] font-bold uppercase tracking-widest rounded ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filtered.map(ex => (
                    <button
                        key={ex}
                        onClick={() => onSelect(ex)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-white/5 flex items-center justify-between group transition-colors"
                    >
                        <span className="text-xs font-bold text-slate-300 group-hover:text-white truncate">{ex}</span>
                        <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 uppercase font-bold tracking-wider">+ ADD</span>
                    </button>
                ))}

                {filtered.length === 0 && (
                    <div className="p-8 text-center text-slate-600 text-[10px] italic">
                        No matches found.
                    </div>
                )}
            </div>
        </div>
    );
}
