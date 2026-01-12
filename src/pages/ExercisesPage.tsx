import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { ExerciseDefinition } from '../models/exercise.ts';
import { useAuth } from '../context/AuthContext.tsx';

/**
 * User-facing Exercise Catalog
 * Displays all validated exercises from the database.
 */
export function ExercisesPage() {
    const { token } = useAuth();
    const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Fetch DB exercises
    useEffect(() => {
        const fetchExercises = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/exercises', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setExercises(data);
                }
            } catch (error) {
                console.error("Failed to fetch exercises", error);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchExercises();
    }, [token]);

    const filtered = useMemo(() => {
        return exercises.filter(e =>
            e.name_en.toLowerCase().includes(search.toLowerCase()) ||
            e.name_sv.toLowerCase().includes(search.toLowerCase()) ||
            e.aliases?.some(a => a.toLowerCase().includes(search.toLowerCase()))
        ).sort((a, b) => a.name_sv.localeCompare(b.name_sv));
    }, [exercises, search]);

    return (
        <div className="pt-2 md:pt-4 p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2">📚 Övningsbibliotek</h1>
                    <p className="text-slate-400">Vår samling av kvalitetssäkrade övningar.</p>
                </div>
                <Link
                    to="/exercises/muscles"
                    className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl font-bold text-sm hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/20"
                >
                    Utforska muskler ➔
                </Link>
            </header>

            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Sök på svenska, engelska eller alias..."
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all text-lg"
                />
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Laddar bibliotek...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-white/5">
                    Hittade inga övningar som matchar din sökning.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(ex => (
                        <div key={ex.id} className="bg-slate-900/80 border border-white/5 p-5 rounded-2xl hover:border-emerald-500/30 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xl">↗️</span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                                {ex.name_sv}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">
                                {ex.name_en}
                            </p>

                            <div className="flex flex-wrap gap-1.5 mt-auto">
                                {ex.primaryMuscles.map(m => (
                                    <span key={m} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase border border-emerald-500/20">
                                        {m}
                                    </span>
                                ))}
                                {ex.secondaryMuscles.slice(0, 2).map(m => (
                                    <span key={m} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold uppercase border border-white/5">
                                        {m}
                                    </span>
                                ))}
                            </div>

                            {ex.aliases && ex.aliases.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/5">
                                    <p className="text-[10px] text-slate-600 truncate">
                                        <span className="font-bold">Alias:</span> {ex.aliases.join(', ')}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
