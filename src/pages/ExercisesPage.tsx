import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { HYROX_WORKOUTS } from '../utils/hyroxWorkouts.ts';

/**
 * A central database of all "known" exercises.
 * Sources:
 * 1. Hyrox Stations (Standard)
 * 2. Hyrox Workouts (Pre-defined)
 * 3. User History (StrengthSessions)
 * 4. User History (ExerciseEntries)
 */
export function ExercisesPage() {
    const { strengthSessions, exerciseEntries } = useData();
    const [search, setSearch] = useState('');

    const exercises = useMemo(() => {
        const unique = new Map<string, { source: string[], count: number, lastPerformed?: string }>();

        // 1. Add Hyrox Workouts
        HYROX_WORKOUTS.forEach(w => {
            const key = w.title;
            unique.set(key, { source: ['Hyrox', w.category], count: 0 });
        });

        // 2. Scan Strength Sessions
        strengthSessions.forEach(s => {
            s.exercises.forEach(ex => {
                const key = ex.name;
                const existing = unique.get(key) || { source: ['Strength'], count: 0 };
                existing.count++;
                if (!existing.lastPerformed || s.date > existing.lastPerformed) {
                    existing.lastPerformed = s.date;
                }
                unique.set(key, existing);
            });
        });

        // 3. Scan Exercise Entries
        exerciseEntries.forEach(e => {
            if (e.type === 'strength' || (e as any).name) {
                const key = (e as any).name || 'Unknown Strength';
                const existing = unique.get(key) || { source: ['Log'], count: 0 };
                existing.count++;
                if (!existing.lastPerformed || e.date > existing.lastPerformed) {
                    existing.lastPerformed = e.date;
                }
                unique.set(key, existing);
            }
        });

        return Array.from(unique.entries()).map(([name, data]) => ({
            name,
            ...data
        })).sort((a, b) => a.name.localeCompare(b.name));

    }, [strengthSessions, exerciseEntries]);

    const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-4 max-w-4xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Övningsdatabas</h1>
                <div className="text-sm text-slate-400 font-mono">
                    {filtered.length} övningar
                </div>
            </header>

            <div className="relative">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Sök övning..."
                    className="w-full bg-slate-800 border-none rounded-xl py-3 px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(ex => (
                    <div key={ex.name} className="bg-slate-900 p-4 rounded-xl border border-white/5 flex justify-between items-center group hover:border-amber-500/30 transition-all">
                        <div>
                            <h3 className="font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">{ex.name}</h3>
                            <div className="flex gap-2">
                                {ex.source.map(s => (
                                    <span key={s} className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/5">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500 font-mono mb-1">Pass</div>
                            <div className="text-xl font-black text-white">{ex.count}</div>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    Inga övningar hittades.
                </div>
            )}
        </div>
    );
}
