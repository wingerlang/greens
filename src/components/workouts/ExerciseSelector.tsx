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
        Object.keys(MUSCLE_MAP).forEach(k => set.add(k));
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
        <div className="flex flex-col h-full bg-[#080815]">
            {/* SEARCH & FILTERS */}
            <div className="p-8 border-b border-white/5 space-y-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Övningsbibliotek</h3>

                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Sök övningar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all placeholder-white/20"
                    />
                </div>

                <div className="flex gap-2">
                    {[
                        { id: 'ALL', label: 'Alla' },
                        { id: 'STRENGTH', label: 'Styrka' },
                        { id: 'CARDIO', label: 'Kondition' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as any)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === f.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {filtered.map(ex => (
                    <button
                        key={ex}
                        onClick={() => onSelect(ex)}
                        className="w-full text-left px-5 py-4 rounded-3xl hover:bg-white/5 border border-transparent hover:border-white/5 flex items-center justify-between group transition-all"
                    >
                        <div className="flex flex-col">
                            <span className="text-[13px] font-black text-slate-300 group-hover:text-white truncate transition-colors">{ex}</span>
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Basövning</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 font-black tracking-widest transition-all translate-x-2 group-hover:translate-x-0">LÄGG TILL</span>
                            <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-slate-700 font-bold group-hover:border-indigo-500 group-hover:text-indigo-500 transition-all">+</div>
                        </div>
                    </button>
                ))}

                {filtered.length === 0 && (
                    <div className="p-12 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest opacity-50">
                        Inga resultat hittades.
                    </div>
                )}
            </div>
        </div>
    );
}

