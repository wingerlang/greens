import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StrengthWorkout, StrengthLogImportResult, PersonalBest, StrengthStats } from '../models/strengthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';

// ============================================
// Strength Page - Main Component
// ============================================

export function StrengthPage() {
    const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
    const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
    const [stats, setStats] = useState<StrengthStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<StrengthLogImportResult | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<StrengthWorkout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { token } = useAuth();

    // Fetch data on mount
    const fetchData = useCallback(async () => {
        console.log('[StrengthPage] fetchData called, token:', token ? 'exists' : 'missing');
        if (!token) {
            console.log('[StrengthPage] No token, skipping fetch');
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            console.log('[StrengthPage] Starting fetch calls...');
            const [workoutsRes, pbsRes, statsRes] = await Promise.all([
                fetch('/api/strength/workouts', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/strength/pbs', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/strength/stats', { headers: { Authorization: `Bearer ${token}` } })
            ]);

            console.log('[StrengthPage] Responses:', workoutsRes.status, pbsRes.status, statsRes.status);

            if (workoutsRes.ok) {
                const data = await workoutsRes.json();
                console.log('[StrengthPage] Workouts:', data.workouts?.length || 0);
                setWorkouts(data.workouts || []);
            }
            if (pbsRes.ok) {
                const data = await pbsRes.json();
                setPersonalBests(data.personalBests || []);
            }
            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data.stats);
            }
        } catch (e) {
            console.error('[StrengthPage] Failed to fetch strength data:', e);
        } finally {
            console.log('[StrengthPage] Setting loading to false');
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle file import
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !token) return;

        setImporting(true);
        setImportResult(null);

        try {
            const text = await file.text();
            const res = await fetch('/api/strength/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ csv: text })
            });

            const result = await res.json();
            setImportResult(result);

            if (result.success) {
                await fetchData();
            }
        } catch (e) {
            console.error('Import failed:', e);
            setImportResult({ success: false, errors: ['Import failed'], workoutsImported: 0, workoutsUpdated: 0, workoutsSkipped: 0, exercisesDiscovered: 0, personalBestsFound: 0 });
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2">💪 Styrketräning</h1>
                    <p className="text-slate-400">Dina pass, övningar och personliga rekord.</p>
                </div>
                <div className="flex gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleImport}
                        className="hidden"
                        id="csv-import"
                    />
                    <label
                        htmlFor="csv-import"
                        className={`px-5 py-2.5 rounded-xl font-bold cursor-pointer transition-all ${importing
                            ? 'bg-slate-700 text-slate-400'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                            }`}
                    >
                        {importing ? '⏳ Importerar...' : '📥 Importera CSV'}
                    </label>
                </div>
            </header>

            {/* Import Result */}
            {importResult && (
                <div className={`p-4 rounded-xl border ${importResult.success ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-red-950/30 border-red-500/30 text-red-200'}`}>
                    {importResult.success ? (
                        <p>✅ Import klar! {importResult.workoutsImported} nya pass, {importResult.workoutsUpdated} uppdaterade, {importResult.exercisesDiscovered} nya övningar, {importResult.personalBestsFound} PBs.</p>
                    ) : (
                        <p>❌ Import misslyckades: {importResult.errors?.join(', ')}</p>
                    )}
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Totalt pass" value={stats.totalWorkouts} />
                    <StatCard label="Pass denna vecka" value={stats.workoutsThisWeek} />
                    <StatCard label="Total volym" value={`${Math.round(stats.totalVolume / 1000)}t`} />
                    <StatCard label="Volym denna månad" value={`${Math.round(stats.volumeThisMonth / 1000)}t`} />
                </div>
            )}

            {/* Personal Bests */}
            {personalBests.length > 0 && (
                <section>
                    <h2 className="text-xl font-bold text-white mb-4">🏆 Personliga Rekord</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {personalBests.slice(0, 8).map(pb => (
                            <div key={pb.id} className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
                                <p className="text-xs text-amber-400 uppercase font-bold truncate">{pb.exerciseName}</p>
                                <p className="text-2xl font-black text-white">{pb.value} kg</p>
                                <p className="text-xs text-slate-500">{pb.reps} reps @ {pb.weight} kg</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Workouts List */}
            <section>
                <h2 className="text-xl font-bold text-white mb-4">📋 Träningspass</h2>
                {loading ? (
                    <div className="text-center text-slate-500 py-12">Laddar...</div>
                ) : workouts.length === 0 ? (
                    <div className="text-center text-slate-500 py-12 bg-slate-900/50 rounded-2xl border border-white/5">
                        <p className="text-4xl mb-4">🏋️</p>
                        <p>Inga pass ännu. Importera din StrengthLog CSV!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {workouts.map(workout => (
                            <WorkoutCard
                                key={workout.id}
                                workout={workout}
                                onClick={() => setSelectedWorkout(workout)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Workout Detail Modal */}
            {selectedWorkout && (
                <WorkoutDetailModal
                    workout={selectedWorkout}
                    onClose={() => setSelectedWorkout(null)}
                />
            )}
        </div>
    );
}

// ============================================
// Sub Components
// ============================================

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-xs text-slate-500 uppercase">{label}</p>
        </div>
    );
}

function WorkoutCard({ workout, onClick }: { workout: StrengthWorkout; onClick: () => void }) {
    const topExercises = workout.exercises.slice(0, 3).map(e => e.exerciseName).join(', ');

    return (
        <div
            className="bg-slate-900/50 border border-white/5 rounded-xl p-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
            onClick={onClick}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-white font-bold">{workout.name}</p>
                    <p className="text-xs text-slate-500">{workout.date} • {workout.uniqueExercises} övningar • {workout.totalSets} set</p>
                </div>
                <div className="text-right">
                    <p className="text-emerald-400 font-bold">{Math.round(workout.totalVolume / 1000)}t volym</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{topExercises}</p>
                </div>
            </div>
        </div>
    );
}

function WorkoutDetailModal({ workout, onClose }: { workout: StrengthWorkout; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white">{workout.name}</h2>
                        <p className="text-slate-400 font-mono">{workout.date}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl">×</button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-white">{workout.uniqueExercises}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Övningar</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-white">{workout.totalSets}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Set</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-white">{workout.totalReps}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Reps</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-emerald-400">{Math.round(workout.totalVolume / 1000)}t</p>
                        <p className="text-[10px] text-slate-500 uppercase">Volym</p>
                    </div>
                </div>

                {/* Body weight if available */}
                {workout.bodyWeight && (
                    <p className="text-sm text-slate-400">Kroppsvikt: {workout.bodyWeight} kg</p>
                )}

                {/* Exercises */}
                <div className="space-y-4">
                    {workout.exercises.map((exercise, i) => (
                        <div key={i} className="bg-slate-800/30 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-white">{exercise.exerciseName}</h3>
                                <span className="text-xs text-emerald-400">{exercise.totalVolume ? `${Math.round(exercise.totalVolume)} kg vol` : ''}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                                <span className="text-slate-500 font-bold">Set</span>
                                <span className="text-slate-500 font-bold">Reps</span>
                                <span className="text-slate-500 font-bold">Vikt</span>
                                <span className="text-slate-500 font-bold">Volym</span>
                                {exercise.sets.map((set, j) => (
                                    <React.Fragment key={j}>
                                        <span className="text-slate-400">{set.setNumber}</span>
                                        <span className="text-white font-bold">{set.reps}</span>
                                        <span className="text-white">{set.weight} kg</span>
                                        <span className="text-slate-400">{set.reps * set.weight}</span>
                                    </React.Fragment>
                                ))}
                            </div>
                            {exercise.topSet && (
                                <p className="text-xs text-amber-400 mt-2">⭐ Top set: {exercise.topSet.reps} × {exercise.topSet.weight} kg</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                    Stäng
                </button>
            </div>
        </div>
    );
}
