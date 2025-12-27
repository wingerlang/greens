import React, { useState, useMemo } from 'react';
import { ALL_WORKOUTS } from '../data/workouts/index.ts';
import { WorkoutCard } from '../components/workouts/WorkoutCard.tsx';
import { WorkoutDetailModal } from '../components/workouts/WorkoutDetailModal.tsx';
import { WorkoutDefinition } from '../models/workout.ts';
import { useNavigate } from 'react-router-dom';

export function WorkoutsPage() {
    const navigate = useNavigate();
    const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDefinition | null>(null);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

    const filteredWorkouts = useMemo(() => {
        return ALL_WORKOUTS.filter(w => {
            const matchesSearch = w.title.toLowerCase().includes(search.toLowerCase()) ||
                w.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));

            const matchesCategory = categoryFilter === 'ALL' || w.category === categoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [search, categoryFilter]);

    const categories = ['ALL', 'HYROX', 'RUNNING', 'STRENGTH', 'HYBRID'];

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 pb-32 space-y-8 animate-in fade-in">
            {/* HER0 */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-4xl">📚</span>
                        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Passdatabasen</h1>
                    </div>
                    <p className="text-slate-400 max-w-xl">
                        Samlingen av alla Hyrox-pass, Coach-pass och specialsnickrade grispass.
                        Välj ett pass, anpassa det och kör!
                    </p>
                </div>
                <button
                    onClick={() => navigate('/workouts/builder')}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all flex items-center gap-2"
                >
                    <span>⚡</span> Skapa Pass
                </button>
            </div>

            {/* FILTERS */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                <div className="relative flex-1 w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                    <input
                        type="text"
                        placeholder="Sök på pass, taggar eller typ..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-white focus:border-emerald-500 outline-none transition-colors"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${categoryFilter === cat
                                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* GRID */}
            {filteredWorkouts.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                    <div className="text-4xl mb-4">🌪️</div>
                    <h3 className="text-xl font-bold text-white">Inga pass hittades</h3>
                    <p className="text-slate-500">Testa att ändra dina sökfilter.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredWorkouts.map(workout => (
                        <WorkoutCard
                            key={workout.id}
                            workout={workout}
                            onClick={() => navigate(`/workouts/${workout.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
