import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StrengthWorkout, StrengthLogImportResult, PersonalBest, StrengthStats, calculate1RM, normalizeExerciseName } from '../models/strengthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';

// ============================================
// Strength Page - Main Component
// ============================================

export function StrengthPage() {
    const { exerciseName } = useParams<{ exerciseName?: string }>();
    const navigate = useNavigate();
    const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
    const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
    const [stats, setStats] = useState<StrengthStats | null>(null);
    const [loading, setLoading] = useState(true);

    const formatDateRelative = (dateStr: string) => {
        const daysAgo = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo === 0) return 'Idag';
        if (daysAgo === 1) return 'Igår';
        if (daysAgo < 7) return `${daysAgo} dagar sedan`;
        if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} veckor sedan`;

        const months = Math.floor(daysAgo / 30);
        if (daysAgo < 365) return `${months} mån sedan`;

        const years = Math.floor(daysAgo / 365);
        const remainingMonths = Math.floor((daysAgo % 365) / 30);

        if (remainingMonths === 0) return `${years} år sedan`;
        return `${years} år ${remainingMonths} mån sedan`;
    };
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<StrengthLogImportResult | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<StrengthWorkout | null>(null);
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync selectedExercise with URL
    useEffect(() => {
        if (exerciseName) {
            setSelectedExercise(decodeURIComponent(exerciseName));
        } else {
            setSelectedExercise(null);
        }
    }, [exerciseName]);

    const handleCloseModal = useCallback(() => {
        navigate('/styrka');
    }, [navigate]);


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

    // Get date range bounds from workouts
    const dateRange = React.useMemo(() => {
        if (workouts.length === 0) return { min: '2020-01-01', max: new Date().toISOString().split('T')[0] };
        const dates = workouts.map(w => w.date).sort();
        return { min: dates[0], max: dates[dates.length - 1] };
    }, [workouts]);

    // Date filter state (null = show all)
    const [startDate, setStartDate] = React.useState<string | null>(null);
    const [endDate, setEndDate] = React.useState<string | null>(null);

    // Filter workouts by date range
    const filteredWorkouts = React.useMemo(() => {
        return workouts.filter(w => {
            if (startDate && w.date < startDate) return false;
            if (endDate && w.date > endDate) return false;
            return true;
        });
    }, [workouts, startDate, endDate]);

    // Derive Personal Bests from workout history (ensures bodyweight-aware logic is applied to existing data)
    const derivedPersonalBests = React.useMemo(() => {
        const pbsByExercise = new Map<string, PersonalBest>();

        // Sort by date ascending to process records in order
        const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

        sortedWorkouts.forEach(w => {
            w.exercises.forEach(ex => {
                const exId = `ex-${normalizeExerciseName(ex.exerciseName).replace(/\s/g, '-')}`;
                ex.sets.forEach(set => {
                    const isBW = !!set.isBodyweight || set.weight === 0;
                    const calcWeight = isBW ? (set.extraWeight || 0) : set.weight;
                    if (calcWeight <= 0 && !isBW) return;

                    const est1RM = calculate1RM(calcWeight, set.reps);
                    const existing = pbsByExercise.get(exId);

                    if (!existing || est1RM > existing.value) {
                        pbsByExercise.set(exId, {
                            id: `pb-${exId}`,
                            exerciseId: exId,
                            exerciseName: ex.exerciseName,
                            userId: w.userId,
                            type: '1rm',
                            value: est1RM,
                            weight: set.weight,
                            reps: set.reps,
                            isBodyweight: isBW,
                            extraWeight: set.extraWeight,
                            date: w.date,
                            workoutId: w.id,
                            workoutName: w.name,
                            estimated1RM: est1RM,
                            createdAt: w.date,
                            previousBest: existing?.value
                        });
                    }
                });
            });
        });

        return Array.from(pbsByExercise.values()).sort((a, b) => b.value - a.value);
    }, [workouts]);

    // Filter PBs by date range (using derived PBs to fix data issues)
    const filteredPBs = React.useMemo(() => {
        return derivedPersonalBests.filter(pb => {
            if (startDate && pb.date < startDate) return false;
            if (endDate && pb.date > endDate) return false;
            return true;
        });
    }, [derivedPersonalBests, startDate, endDate]);

    // Top Workouts (Best of all time in specific categories)
    const bestWorkouts = React.useMemo(() => {
        if (workouts.length === 0) return null;

        return {
            volume: [...workouts].sort((a, b) => b.totalVolume - a.totalVolume)[0],
            duration: [...workouts].sort((a, b) => (b.duration || 0) - (a.duration || 0))[0],
            sets: [...workouts].sort((a, b) => b.totalSets - a.totalSets)[0],
            reps: [...workouts].sort((a, b) => b.totalReps - a.totalReps)[0],
            exercises: [...workouts].sort((a, b) => b.uniqueExercises - a.uniqueExercises)[0],
        };
    }, [workouts]);

    // Reset date filter
    const resetDateFilter = () => {
        setStartDate(null);
        setEndDate(null);
    };

    const hasDateFilter = startDate !== null || endDate !== null;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2">💪 Styrketräning</h1>
                    <p className="text-slate-400">Dina pass, övningar och personliga rekord.</p>
                </div>
                <div className="flex gap-3 items-center">
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

            {/* Date Range Slider */}
            {workouts.length > 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-400 uppercase">📅 Datumfilter</h3>
                        {hasDateFilter && (
                            <button
                                onClick={resetDateFilter}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold"
                            >
                                ✕ Visa alla
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-500 uppercase block mb-1">Från</label>
                            <input
                                type="date"
                                value={startDate || dateRange.min}
                                min={dateRange.min}
                                max={endDate || dateRange.max}
                                onChange={(e) => setStartDate(e.target.value || null)}
                                className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded-lg text-sm"
                            />
                        </div>
                        <div className="text-slate-600 pt-5">→</div>
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-500 uppercase block mb-1">Till</label>
                            <input
                                type="date"
                                value={endDate || dateRange.max}
                                min={startDate || dateRange.min}
                                max={dateRange.max}
                                onChange={(e) => setEndDate(e.target.value || null)}
                                className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                    {hasDateFilter && (
                        <p className="text-xs text-emerald-400 mt-2">
                            Visar {filteredWorkouts.length} av {workouts.length} pass
                        </p>
                    )}
                </div>
            )}

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
            {filteredPBs.length > 0 && (
                <section>
                    <h2 className="text-xl font-bold text-white mb-4">🏆 Personliga Rekord (1RM & 1eRM)</h2>

                    {/* PB Grouped Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(() => {
                            // Group PBs by workoutId
                            const grouped = filteredPBs.reduce((acc, pb) => {
                                const key = pb.workoutId || pb.date;
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(pb);
                                return acc;
                            }, {} as Record<string, PersonalBest[]>);

                            return Object.values(grouped).slice(0, 8).map(pbs => {
                                const pb = pbs[0];
                                const pbWorkout = filteredWorkouts.find(w => w.id === pb.workoutId);
                                const timeAgoText = formatDateRelative(pb.date);

                                return (
                                    <div
                                        key={pb.workoutId || pb.date}
                                        className={`bg-slate-900/40 border border-white/5 rounded-2xl p-4 transition-all hover:border-white/10 hover:bg-slate-900/60 group`}
                                    >
                                        <div className="mb-3">
                                            <p className="text-[10px] text-slate-500 font-mono uppercase leading-none">{pb.date}</p>
                                            <p className="text-[9px] text-emerald-500 font-bold mt-1 opacity-80">{timeAgoText}</p>
                                        </div>

                                        <div className="space-y-3">
                                            {pbs.map(singlePb => (
                                                <div
                                                    key={singlePb.id}
                                                    className="cursor-pointer"
                                                    onClick={() => navigate(`/styrka/${encodeURIComponent(singlePb.exerciseName)}`)}
                                                >
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-xs text-amber-500 uppercase font-black truncate max-w-[120px]">{singlePb.exerciseName}</p>
                                                            <p className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">{singlePb.value} kg</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-500">
                                                                {singlePb.reps} × {singlePb.isBodyweight ? (
                                                                    <span className="bg-slate-800 text-slate-400 px-1 rounded text-[9px] py-0.5">KV{singlePb.extraWeight ? `+${singlePb.extraWeight}` : ''}</span>
                                                                ) : (
                                                                    `${singlePb.weight} kg`
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {pbWorkout && (
                                            <button
                                                onClick={() => setSelectedWorkout(pbWorkout)}
                                                className="w-full mt-4 pt-3 border-t border-white/5 text-[10px] text-slate-500 hover:text-white flex justify-between items-center transition-colors"
                                            >
                                                <span>{pbWorkout.name}</span>
                                                <span className="text-emerald-500">Visa pass →</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* Aggregate Trend Line */}
                    <div className="mt-6 bg-slate-900/40 border border-white/5 rounded-2xl p-5 overflow-hidden group">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Övergripande rekord-trend</h3>
                                <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold italic">Din totala styrka (Summan av alla personbästa 1eRM)</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5 text-[10px] text-amber-500 font-bold uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)] border border-white/20"></span>
                                    Totalstyrka (1RM index)
                                </span>
                            </div>
                        </div>
                        <div className="h-24 w-full relative">
                            <RecordTrendLine pbs={filteredPBs} />
                        </div>
                    </div>
                </section>
            )}

            {/* Weekly Volume Trend */}
            {
                filteredWorkouts.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">📈 Volym per vecka</h2>
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <WeeklyVolumeBars workouts={filteredWorkouts} />
                        </div>
                    </section>
                )
            }

            {/* Top Exercises by Volume */}
            {
                filteredWorkouts.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">🔥 Mest tränade övningar</h2>
                        <TopExercisesTable workouts={filteredWorkouts} onSelectExercise={(name) => navigate(`/styrka/${encodeURIComponent(name)}`)} />
                    </section>
                )
            }

            {/* Best Workouts / Records Section */}
            {bestWorkouts && (
                <section>
                    <h2 className="text-xl font-bold text-white mb-4">🏅 Rekordpass (Alla tider)</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.volume)}
                            className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center hover:bg-emerald-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[10px] text-emerald-500 font-black uppercase mb-1">Mest volym</p>
                            <p className="text-2xl font-black text-white">{Math.round(bestWorkouts.volume.totalVolume / 1000)}t</p>
                            <div className="mt-1">
                                <p className="text-[10px] text-slate-500 leading-none">{bestWorkouts.volume.date}</p>
                                <p className="text-[9px] text-emerald-500 opacity-60 font-bold mt-1">{formatDateRelative(bestWorkouts.volume.date)}</p>
                            </div>
                        </button>
                        {bestWorkouts.duration?.duration && bestWorkouts.duration.duration > 0 && (
                            <button
                                onClick={() => setSelectedWorkout(bestWorkouts.duration)}
                                className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center hover:bg-blue-500/20 transition-all group active:scale-95"
                            >
                                <p className="text-[10px] text-blue-500 font-black uppercase mb-1">Längst pass</p>
                                <p className="text-2xl font-black text-white">{bestWorkouts.duration.duration}m</p>
                                <div className="mt-1">
                                    <p className="text-[10px] text-slate-500 leading-none">{bestWorkouts.duration.date}</p>
                                    <p className="text-[9px] text-blue-500 opacity-60 font-bold mt-1">{formatDateRelative(bestWorkouts.duration.date)}</p>
                                </div>
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.sets)}
                            className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-center hover:bg-purple-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[10px] text-purple-500 font-black uppercase mb-1">Flest set</p>
                            <p className="text-2xl font-black text-white">{bestWorkouts.sets.totalSets} st</p>
                            <div className="mt-1">
                                <p className="text-[10px] text-slate-500 leading-none">{bestWorkouts.sets.date}</p>
                                <p className="text-[9px] text-purple-500 opacity-60 font-bold mt-1">{formatDateRelative(bestWorkouts.sets.date)}</p>
                            </div>
                        </button>
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.reps)}
                            className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center hover:bg-amber-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[10px] text-amber-500 font-black uppercase mb-1">Flest reps</p>
                            <p className="text-2xl font-black text-white">{bestWorkouts.reps.totalReps}</p>
                            <div className="mt-1">
                                <p className="text-[10px] text-slate-500 leading-none">{bestWorkouts.reps.date}</p>
                                <p className="text-[9px] text-amber-500 opacity-60 font-bold mt-1">{formatDateRelative(bestWorkouts.reps.date)}</p>
                            </div>
                        </button>
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.exercises)}
                            className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4 text-center hover:bg-pink-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[10px] text-pink-500 font-black uppercase mb-1">Variation</p>
                            <p className="text-2xl font-black text-white">{bestWorkouts.exercises.uniqueExercises} övn</p>
                            <div className="mt-1">
                                <p className="text-[10px] text-slate-500 leading-none">{bestWorkouts.exercises.date}</p>
                                <p className="text-[9px] text-pink-500 opacity-60 font-bold mt-1">{formatDateRelative(bestWorkouts.exercises.date)}</p>
                            </div>
                        </button>
                    </div>
                </section>
            )}

            {/* Workouts List */}
            <section>
                <h2 className="text-xl font-bold text-white mb-4">📋 Träningspass</h2>
                {loading ? (
                    <div className="text-center text-slate-500 py-12">Laddar...</div>
                ) : filteredWorkouts.length === 0 ? (
                    <div className="text-center text-slate-500 py-12 bg-slate-900/50 rounded-2xl border border-white/5">
                        <p className="text-4xl mb-4">🏋️</p>
                        <p>{hasDateFilter ? 'Inga pass i valt datumintervall' : 'Inga pass ännu. Importera din StrengthLog CSV!'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredWorkouts.map(workout => (
                            <WorkoutCard
                                key={workout.id}
                                workout={workout}
                                onClick={() => setSelectedWorkout(workout)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {
                selectedExercise && (
                    <ExerciseDetailModal
                        exerciseName={selectedExercise}
                        workouts={filteredWorkouts}
                        onClose={handleCloseModal}
                        onSelectWorkout={setSelectedWorkout}
                        isWorkoutModalOpen={!!selectedWorkout}
                    />
                )
            }

            {/* Workout Detail Modal - last to be on top */}
            {
                selectedWorkout && (
                    <WorkoutDetailModal
                        workout={selectedWorkout}
                        onClose={() => setSelectedWorkout(null)}
                        onSelectExercise={(name) => {
                            setSelectedWorkout(null);
                            navigate(`/styrka/${encodeURIComponent(name)}`);
                        }}
                        pbs={filteredPBs}
                    />
                )
            }
        </div >
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
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-purple-400 font-bold text-[10px] uppercase tracking-wider bg-purple-500/10 px-2 py-1 rounded">
                        💪 StrengthLog
                    </span>
                    <div>
                        <p className="text-white font-bold">{workout.name}</p>
                        <p className="text-xs text-slate-500">{workout.date} • {workout.uniqueExercises} övningar • {workout.totalSets} set</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-emerald-400 font-bold">{Math.round(workout.totalVolume / 1000)}t volym</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{topExercises}</p>
                </div>
            </div>
        </div>
    );
}

function WorkoutDetailModal({
    workout,
    onClose,
    onSelectExercise,
    pbs = []
}: {
    workout: StrengthWorkout;
    onClose: () => void;
    onSelectExercise?: (exerciseName: string) => void;
    pbs?: PersonalBest[];
}) {
    // ESC key to close
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc, true); // Use capture to handle it before others
        return () => window.removeEventListener('keydown', handleEsc, true);
    }, [onClose]);

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
                        <p className="text-xl font-black text-emerald-400">{(workout.totalVolume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t</p>
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
                                <button
                                    onClick={() => onSelectExercise?.(exercise.exerciseName)}
                                    className="font-bold text-white hover:text-blue-400 hover:underline transition-colors"
                                >
                                    {exercise.exerciseName}
                                </button>
                                <span className="text-xs text-emerald-400">{exercise.totalVolume ? `${(exercise.totalVolume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} ton` : ''}</span>
                            </div>
                            <div className="space-y-1">
                                <div className="grid grid-cols-5 gap-2 text-[10px] text-slate-500 font-black uppercase mb-2 px-3 border-b border-white/5 pb-1">
                                    <span className="pl-1">Set</span>
                                    <span>Reps</span>
                                    <span>Vikt</span>
                                    <span className="text-right">e1RM</span>
                                    <span className="text-right pr-2">Volym</span>
                                </div>
                                {(() => {
                                    const mappedSets = exercise.sets.map(s => {
                                        const isBW = s.isBodyweight || s.weight === 0;
                                        const calcWeight = isBW ? (s.extraWeight || 0) : s.weight;
                                        const est1RM = calculate1RM(calcWeight, s.reps);
                                        return { ...s, est1RM };
                                    });
                                    const maxEst1RM = Math.max(...mappedSets.map(s => s.est1RM));

                                    return mappedSets.map((set, j) => {
                                        const isPR = pbs.some(pb =>
                                            pb.workoutId === workout.id &&
                                            pb.exerciseName === exercise.exerciseName &&
                                            pb.weight === set.weight &&
                                            pb.reps === set.reps
                                        );
                                        const isBest1eRM = maxEst1RM > 0 && set.est1RM === maxEst1RM;
                                        const est1RM = set.est1RM;

                                        return (
                                            <div
                                                key={j}
                                                className={`grid grid-cols-5 gap-2 text-xs py-1.5 px-3 rounded-lg border border-transparent transition-colors ${isPR ? 'bg-amber-500/20 border-amber-500/30' : 'hover:bg-slate-800/40'}`}
                                            >
                                                <span className="text-slate-400 flex items-center">{set.setNumber}</span>
                                                <span className="text-white font-bold flex items-center">{set.reps} st</span>
                                                <div className="flex items-center gap-1.5 group/set relative truncate">
                                                    <span className="text-white truncate">
                                                        {set.isBodyweight || set.weight === 0 ? (
                                                            <span className="bg-slate-800 text-slate-400 px-1 rounded text-[10px] py-0.5">KV{set.extraWeight ? `+${set.extraWeight}` : ''}</span>
                                                        ) : (
                                                            `${set.weight} kg`
                                                        )}
                                                    </span>
                                                    {isPR && (
                                                        <span className="text-amber-500 text-[10px] flex-shrink-0" title="Personbästa!">⭐</span>
                                                    )}
                                                    {isBest1eRM && (
                                                        <span className="text-cyan-400 text-[10px] flex-shrink-0" title="Passets högsta 1eRM (kvalitetstopp!)">⚡</span>
                                                    )}
                                                </div>
                                                <span className="text-slate-500 flex items-center justify-end font-mono">{est1RM}<span className="text-[9px] ml-0.5 opacity-40">kg</span></span>
                                                <span className="text-slate-400 flex items-center justify-end font-mono">{Math.round(set.reps * (set.isBodyweight ? (workout.bodyWeight || 0) + (set.extraWeight || 0) : set.weight))}<span className="text-[9px] ml-0.5 opacity-50">kg</span></span>
                                            </div>
                                        );
                                    })
                                })()}
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

// ============================================
// Weekly Volume Chart
// ============================================

function WeeklyVolumeBars({ workouts }: { workouts: StrengthWorkout[] }) {
    // Group workouts by week
    const weeklyData = React.useMemo(() => {
        const weeks: Record<string, number> = {};

        workouts.forEach(w => {
            const date = new Date(w.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];
            weeks[weekKey] = (weeks[weekKey] || 0) + w.totalVolume;
        });

        return Object.entries(weeks)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12) // Show last 12 weeks (a full quarter)
            .map(([week, volume]) => ({ week, volume }));
    }, [workouts]);

    const maxVolume = Math.max(...weeklyData.map(d => d.volume), 1) * 1.1; // 10% buffer

    if (weeklyData.length === 0) return <p className="text-slate-500">Inte nog med data för att visa trend.</p>;

    return (
        <div className="flex items-end gap-1 md:gap-2 h-40">
            {weeklyData.map(({ week, volume }, i) => {
                const height = (volume / maxVolume) * 100;
                const weekLabel = new Date(week).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
                const isCurrentWeek = i === weeklyData.length - 1;

                return (
                    <div key={week} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className={`text-[9px] font-bold transition-opacity ${isCurrentWeek ? 'text-emerald-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100'}`}>
                            {(volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t
                        </span>
                        <div
                            className={`w-full rounded-t-md transition-all duration-500 border-t border-white/10 ${isCurrentWeek ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]' : 'bg-slate-700/50 group-hover:bg-slate-700'}`}
                            style={{ height: `${height}%`, minHeight: '2px' }}
                        />
                        <div className="h-4 flex items-center">
                            <span className={`text-[8px] whitespace-nowrap ${isCurrentWeek ? 'text-white font-bold' : 'text-slate-600'}`}>{weekLabel}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============================================
// Top Exercises Table
// ============================================

function TopExercisesTable({ workouts, onSelectExercise }: { workouts: StrengthWorkout[]; onSelectExercise?: (name: string) => void }) {
    const exerciseStats = React.useMemo(() => {
        const stats: Record<string, { name: string; sets: number; reps: number; volume: number; count: number }> = {};

        workouts.forEach(w => {
            w.exercises.forEach(ex => {
                if (!stats[ex.exerciseName]) {
                    stats[ex.exerciseName] = { name: ex.exerciseName, sets: 0, reps: 0, volume: 0, count: 0 };
                }
                stats[ex.exerciseName].sets += ex.sets.length;
                stats[ex.exerciseName].reps += ex.sets.reduce((sum, s) => sum + s.reps, 0);
                stats[ex.exerciseName].volume += ex.totalVolume || 0;
                stats[ex.exerciseName].count += 1;
            });
        });

        return Object.values(stats)
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 10);
    }, [workouts]);

    if (exerciseStats.length === 0) return null;

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-950 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="px-4 py-3 text-left">Övning</th>
                        <th className="px-4 py-3 text-right">Gånger</th>
                        <th className="px-4 py-3 text-right">Set</th>
                        <th className="px-4 py-3 text-right">Reps</th>
                        <th className="px-4 py-3 text-right">Total volym</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {exerciseStats.map((ex, i) => (
                        <tr
                            key={ex.name}
                            className={`hover:bg-slate-800/30 ${onSelectExercise ? 'cursor-pointer' : ''}`}
                            onClick={() => onSelectExercise?.(ex.name)}
                        >
                            <td className="px-4 py-3 text-white font-medium">
                                <span className="text-slate-600 mr-2">#{i + 1}</span>
                                {ex.name}
                                {onSelectExercise && <span className="text-slate-600 ml-2">→</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">{ex.count}×</td>
                            <td className="px-4 py-3 text-right text-slate-400">{ex.sets}</td>
                            <td className="px-4 py-3 text-right text-blue-400">{ex.reps}</td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-bold">{Math.round(ex.volume / 1000)}t kg</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ============================================
// Exercise Detail Modal
// ============================================

function ExerciseDetailModal({
    exerciseName,
    workouts,
    onClose,
    onSelectWorkout,
    isWorkoutModalOpen
}: {
    exerciseName: string;
    workouts: StrengthWorkout[];
    onClose: () => void;
    onSelectWorkout?: (workout: StrengthWorkout) => void;
    isWorkoutModalOpen?: boolean;
}) {
    // ESC key to close - only if workout modal is NOT open
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isWorkoutModalOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc, true); // Capture phase
        return () => window.removeEventListener('keydown', handleEsc, true);
    }, [onClose, isWorkoutModalOpen]);

    const [viewMode, setViewMode] = React.useState<'history' | 'prs'>('history');

    // Get all instances of this exercise across workouts
    const exerciseHistory = React.useMemo(() => {
        const history: { date: string; sets: number; reps: number; maxWeight: number; volume: number; est1RM: number; workout: StrengthWorkout }[] = [];

        workouts.forEach(w => {
            const ex = w.exercises.find(e => e.exerciseName === exerciseName);
            if (ex) {
                const maxWeight = Math.max(...ex.sets.map(s => s.weight));
                const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0);
                const volume = ex.totalVolume || 0;

                // Find best set for 1RM estimate (bodyweight aware)
                const est1RMs = ex.sets.map(s => {
                    const isBW = s.isBodyweight || s.weight === 0;
                    const calcWeight = isBW ? (s.extraWeight || 0) : s.weight;
                    return calculate1RM(calcWeight, s.reps);
                });
                const best1RMValue = Math.max(...est1RMs);

                history.push({
                    date: w.date,
                    sets: ex.sets.length,
                    reps: totalReps,
                    maxWeight,
                    volume,
                    est1RM: Math.round(best1RMValue),
                    workout: w
                });
            }
        });

        return history.sort((a, b) => a.date.localeCompare(b.date));
    }, [workouts, exerciseName]);

    // Calculate PR progression (Weight-PRs) - check every single set
    const prProgression = React.useMemo(() => {
        const prs: (PersonalBest & { workout: StrengthWorkout; daysSinceLast?: number; percentIncrease?: number })[] = [];
        let currentMax = 0;
        let lastPrDate: Date | null = null;

        exerciseHistory.forEach(h => {
            const ex = h.workout.exercises.find(e => e.exerciseName === exerciseName);
            if (!ex) return;

            ex.sets.forEach(set => {
                if (set.weight > currentMax) {
                    const currentDate = new Date(h.date);
                    let daysSinceLast: number | undefined;
                    let percentIncrease: number | undefined;

                    if (lastPrDate) {
                        daysSinceLast = Math.round((currentDate.getTime() - lastPrDate.getTime()) / (1000 * 60 * 60 * 24));
                    }

                    if (currentMax > 0) {
                        percentIncrease = ((set.weight - currentMax) / currentMax) * 100;
                    }

                    prs.push({
                        date: h.date,
                        weight: set.weight,
                        reps: set.reps,
                        volume: set.weight * set.reps,
                        workout: h.workout,
                        daysSinceLast,
                        percentIncrease,
                        isBodyweight: set.isBodyweight,
                        extraWeight: set.extraWeight
                    } as any);
                    currentMax = set.weight;
                    lastPrDate = currentDate;
                }
            });
        });

        return prs;
    }, [exerciseHistory, exerciseName]);

    const totalSets = React.useMemo(() => exerciseHistory.reduce((sum, h) => sum + h.sets, 0), [exerciseHistory]);
    const totalReps = React.useMemo(() => exerciseHistory.reduce((sum, h) => sum + h.reps, 0), [exerciseHistory]);
    const totalVolume = exerciseHistory.reduce((sum: number, h) => sum + h.volume, 0);

    // Find workout for Max 1RM
    const maxRecord = React.useMemo(() => {
        if (exerciseHistory.length === 0) return null;
        return exerciseHistory.reduce((prev, curr) => (curr.maxWeight > prev.maxWeight ? curr : prev), exerciseHistory[0]);
    }, [exerciseHistory]);
    const maxEver = maxRecord?.maxWeight || 0;

    const bestRecord = React.useMemo(() => {
        if (exerciseHistory.length === 0) return null;
        return exerciseHistory.reduce((prev, curr) => (curr.est1RM > prev.est1RM ? curr : prev), exerciseHistory[0]);
    }, [exerciseHistory]);
    const best1RM = bestRecord?.est1RM || 0;

    // Bounds for the chart
    const min1RM = Math.min(...exerciseHistory.map(h => h.est1RM), 0);
    const max1RM = Math.max(...exerciseHistory.map(h => h.est1RM), 1);

    // Safety for the chart: if min and max are the same, give some breathing room
    const chartMin = exerciseHistory.length === 1 ? min1RM * 0.5 : min1RM === max1RM ? min1RM * 0.9 : min1RM * 0.95;
    const chartMax = min1RM === max1RM ? max1RM * 1.1 : max1RM * 1.05;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white">{exerciseName}</h2>
                        <p className="text-slate-400 text-sm">{exerciseHistory.length} pass med denna övning</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onClose();
                        }}
                        className="text-slate-500 hover:text-white text-3xl p-1 -mt-2 transition-colors"
                        type="button"
                    >
                        ×
                    </button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-6 gap-2">
                    <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-white">{exerciseHistory.length}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Pass</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-white">{totalSets}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Set</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-white text-blue-400">{totalVolume > 1000 ? (totalVolume / 1000).toFixed(1) + 't' : totalVolume + 'kg'}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Total Volym</p>
                    </div>
                    <button
                        onClick={() => maxRecord && onSelectWorkout?.(maxRecord.workout)}
                        className="bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-2.5 text-center group/pb transition-all active:scale-[0.98]"
                    >
                        <p className="text-lg font-black text-emerald-400 group-hover/pb:text-emerald-300 transition-colors">{maxEver} kg</p>
                        <p className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1">
                            Max (1RM)
                            <span className="opacity-0 group-hover/pb:opacity-100 transition-opacity">→</span>
                        </p>
                    </button>
                    <button
                        onClick={() => bestRecord && onSelectWorkout?.(bestRecord.workout)}
                        className="bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-2.5 text-center group/pb transition-all active:scale-[0.98]"
                    >
                        <p className="text-lg font-black text-amber-400 group-hover/pb:text-amber-300 transition-colors">{best1RM} kg</p>
                        <p className="text-[9px] text-amber-500 uppercase font-bold flex items-center justify-center gap-1">
                            Bästa 1eRM
                            <span className="opacity-0 group-hover/pb:opacity-100 transition-opacity">→</span>
                        </p>
                    </button>
                </div>

                {/* Progression Chart */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                            {viewMode === 'history' ? (
                                <>
                                    <span>📈 Progression (1eRM)</span>
                                    <span className="text-[10px] text-slate-500 font-normal normal-case italic">(estimerat 1RM)</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-amber-500">🏆 Progression (1RM)</span>
                                    <span className="text-[10px] text-slate-500 font-normal normal-case italic">(faktiska rekordvikter)</span>
                                </>
                            )}
                        </h3>
                        <div className="flex bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('history')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Historik
                            </button>
                            <button
                                onClick={() => setViewMode('prs')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'prs' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Tyngsta lyft
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-white/5">
                        {(() => {
                            const isHistory = viewMode === 'history';
                            const activeData = isHistory
                                ? exerciseHistory.slice(-25)
                                : prProgression.slice(-25);

                            if (activeData.length < (isHistory ? 2 : 1)) {
                                return <p className="text-center text-slate-500 py-8">Inte nog med data för att visa progression.</p>;
                            }

                            // Calculate specific bounds for this view
                            const values = activeData.map((h: any) => isHistory ? h.est1RM : h.weight);
                            const minVal = Math.min(...values);
                            const maxVal = Math.max(...values);

                            const cMin = activeData.length === 1 ? minVal * 0.9 : minVal === maxVal ? minVal * 0.9 : minVal * 0.95;
                            const cMax = minVal === maxVal ? maxVal * 1.1 : maxVal * 1.05;
                            const range = (cMax - cMin) || 1;

                            return (
                                <>
                                    <div className="flex items-end gap-1.5 h-40 mb-6">
                                        {activeData.map((h, i) => {
                                            const val = isHistory ? (h as any).est1RM : (h as any).weight;
                                            const weight = (h as any).maxWeight || (h as any).weight;

                                            let heightPercent = ((val - cMin) / range) * 100;
                                            if (isNaN(heightPercent) || heightPercent < 15) heightPercent = 15;

                                            const isBest = isHistory
                                                ? (h as any).est1RM === best1RM
                                                : (h as any).weight === maxEver;

                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative h-full">
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md z-20 pointer-events-none border border-white/10 shadow-xl whitespace-nowrap">
                                                        <p className="font-bold">{val} kg {isHistory ? '(1eRM)' : '(Vikt)'}</p>
                                                        <p className="text-[9px] text-slate-400">{h.date}</p>
                                                    </div>
                                                    <div
                                                        className={`w-full relative transition-all duration-300 group-hover:brightness-110 ${isBest ? (isHistory ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]' : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]') : (isHistory ? 'bg-amber-500/60' : 'bg-emerald-500/60')} border-t border-white/5`}
                                                        style={{
                                                            height: `${heightPercent}%`,
                                                            minWidth: '4px',
                                                            borderRadius: '2px 2px 0 0'
                                                        }}
                                                    />
                                                    {/* Small date label for PRs if space allows (showing every few) */}
                                                    {!isHistory && (activeData.length < 12 || i % 3 === 0) && (
                                                        <span className="absolute -bottom-5 text-[8px] text-slate-500 whitespace-nowrap transform rotate-45 origin-left">
                                                            {h.date.split('-').slice(1).join('/')}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-500 mt-4 font-mono font-medium">
                                        <span>{activeData[0]?.date}</span>
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isHistory ? 'bg-amber-500/10 border-amber-500/10 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400'}`}>
                                            <span className={`w-2 h-2 rounded-full animate-pulse ${isHistory ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                            <span className="font-bold uppercase tracking-wider">
                                                {isHistory ? `Bästa 1eRM: ${best1RM} kg` : `Max-lyft: ${maxEver} kg`}
                                            </span>
                                        </div>
                                        <span>{activeData[activeData.length - 1]?.date}</span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-4">
                    {viewMode === 'history' ? (
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">📋 All Historik</h3>
                            <div className="bg-slate-800/30 rounded-2xl border border-white/5 overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-950/50 text-[10px] text-slate-400 uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold">Datum</th>
                                                <th className="px-4 py-3 text-right font-bold">Set</th>
                                                <th className="px-4 py-3 text-right font-bold">Reps</th>
                                                <th className="px-4 py-3 text-right font-bold">Max</th>
                                                <th className="px-4 py-3 text-right font-bold">Volym</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {exerciseHistory.slice().reverse().map(h => (
                                                <tr key={h.date} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => onSelectWorkout?.(h.workout)}
                                                            className="text-white font-mono text-xs hover:text-blue-400 hover:underline transition-colors"
                                                        >
                                                            {h.date}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-400 group-hover:text-white transition-colors">{h.sets}</td>
                                                    <td className="px-4 py-3 text-right text-blue-400 group-hover:text-blue-300 transition-colors">{h.reps}</td>
                                                    <td className="px-4 py-3 text-right text-white font-bold">{h.maxWeight} kg</td>
                                                    <td className="px-4 py-3 text-right text-emerald-400 group-hover:text-emerald-300 transition-colors">{Math.round(h.volume).toLocaleString()} kg</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-sm font-bold text-amber-500 uppercase mb-3 px-1 flex items-center gap-2">
                                <span>🏆 Tyngsta lyft (Vikt-PR)</span>
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">{prProgression.length} st</span>
                            </h3>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {(() => {
                                    // Group PRs by date/workout
                                    const groupedPRs = prProgression.reduce((acc, pr) => {
                                        const key = pr.workout.id || pr.date;
                                        if (!acc[key]) acc[key] = [];
                                        acc[key].push(pr);
                                        return acc;
                                    }, {} as Record<string, typeof prProgression>);

                                    const groups = Object.values(groupedPRs);

                                    // For the graph on this tab: Actual Weight PRs
                                    const weightChartData = prProgression.slice(-20);
                                    const maxWeightPR = Math.max(...weightChartData.map(p => p.weight || 0), 1);
                                    const minWeightPR = Math.min(...weightChartData.map(p => p.weight || 0), 0);
                                    const weightRange = (maxWeightPR - minWeightPR) || 1;
                                    const weightChartMin = minWeightPR * 0.95;
                                    const weightChartMax = maxWeightPR * 1.05;

                                    return (
                                        <div className="space-y-4">
                                            {/* Small line graph for weights */}
                                            {prProgression.length > 1 && (
                                                <div className="bg-slate-800/20 rounded-2xl border border-white/5 p-4 mb-4">
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-3 flex items-center gap-2">
                                                        <span>📊 Faktiska PR-vikter (Trend)</span>
                                                    </p>
                                                    <div className="flex items-end gap-1 h-16">
                                                        {weightChartData.map((p, i) => {
                                                            const h = (((p.weight || 0) - weightChartMin) / (weightChartMax - weightChartMin)) * 100;
                                                            return (
                                                                <div key={i} className="flex-1 group relative h-full flex items-end">
                                                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 text-[9px] text-white py-0.5 px-1.5 rounded border border-white/10 z-20 whitespace-nowrap">
                                                                        {p.weight || 0} kg
                                                                    </div>
                                                                    <div
                                                                        className="w-full bg-emerald-500/40 group-hover:bg-emerald-400/80 rounded-t-sm transition-all"
                                                                        style={{ height: `${Math.max(h, 15)}%`, minWidth: '4px' }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {groups.reverse().map((prs, groupIdx) => {
                                                    const sortedPrs = [...prs].sort((a, b) => (b.weight || 0) - (a.weight || 0));
                                                    const isMulti = prs.length > 1;

                                                    // Calculate days since the PREVIOUS GROUP
                                                    const prevGroup = groups[groups.length - groupIdx - 2];
                                                    let sessionDaysSince = 0;
                                                    if (prevGroup) {
                                                        const d1 = new Date(sortedPrs[0].date);
                                                        const d2 = new Date(prevGroup[0].date);
                                                        sessionDaysSince = Math.round(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                                                    }

                                                    const sessionHeader = (
                                                        <div className="px-3 py-1.5 flex justify-between items-center bg-slate-900/40">
                                                            <button
                                                                onClick={() => onSelectWorkout?.(sortedPrs[0].workout)}
                                                                className="text-[10px] text-slate-500 font-mono hover:text-blue-400 transition-colors flex items-center gap-1.5"
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                {sortedPrs[0].date}
                                                            </button>
                                                            {sessionDaysSince > 0 && (
                                                                <span className="text-[9px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-white/5">
                                                                    +{sessionDaysSince}d
                                                                </span>
                                                            )}
                                                        </div>
                                                    );

                                                    return (
                                                        <div
                                                            key={groupIdx}
                                                            className={`${isMulti ? 'bg-slate-800/30 border border-white/5 rounded-2xl overflow-hidden' : 'bg-slate-800/20 border-l-2 border-emerald-500 rounded-r-xl overflow-hidden'}`}
                                                        >
                                                            {isMulti && sessionHeader}
                                                            <div className={`${isMulti ? 'p-1 space-y-1' : 'flex items-center justify-between p-2 pl-3'}`}>
                                                                {!isMulti && (
                                                                    <div className="flex items-center gap-3 flex-1">
                                                                        <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-[9px] border border-emerald-500/10">
                                                                            #{prProgression.indexOf(prs[0]) + 1}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] text-slate-500 font-mono leading-none mb-1">{prs[0].date}</p>
                                                                            <div className="flex items-baseline gap-2">
                                                                                <p className="text-sm font-black text-white">{prs[0].weight} kg</p>
                                                                                <p className="text-[9px] text-slate-500 font-bold">{prs[0].reps} reps</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {isMulti && (() => {
                                                                    const mappedSets = sortedPrs.map((s: any) => {
                                                                        const isBW = s.isBodyweight || s.weight === 0;
                                                                        const calcWeight = isBW ? (s.extraWeight || 0) : s.weight;
                                                                        const est1RM = calculate1RM(calcWeight, s.reps);
                                                                        return { ...s, est1RM };
                                                                    });
                                                                    const maxEst1RM = Math.max(...mappedSets.map(s => s.est1RM));

                                                                    return mappedSets.map((pr: any, idx) => {
                                                                        const isBest1eRM = maxEst1RM > 0 && pr.est1RM === maxEst1RM;
                                                                        return (
                                                                            <div key={`${pr.date}-${pr.weight}-${idx}`} className="bg-slate-800/50 hover:bg-slate-800 rounded-xl px-3 py-2 flex items-center justify-between group transition-all">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-[10px] border border-emerald-500/10 flex-shrink-0">
                                                                                        #{prProgression.indexOf(pr) + 1}
                                                                                    </div>
                                                                                    <div>
                                                                                        <div className="flex items-baseline gap-2">
                                                                                            <p className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors leading-none">{pr.weight} kg</p>
                                                                                            <p className="text-[10px] text-slate-500 font-bold">{pr.reps} reps</p>
                                                                                            {isBest1eRM && (
                                                                                                <span className="text-cyan-400 text-[10px]" title="Högsta 1eRM för passet!">⚡</span>
                                                                                            )}
                                                                                        </div>
                                                                                        {((pr.percentIncrease !== undefined && pr.percentIncrease > 0) || pr.daysSinceLast !== undefined) && (
                                                                                            <p className="text-[9px] text-slate-500 font-bold mt-0.5 flex items-center gap-1.5">
                                                                                                {pr.percentIncrease !== undefined && pr.percentIncrease > 0 && (
                                                                                                    <span className="text-emerald-400">+{pr.percentIncrease.toFixed(1)}%</span>
                                                                                                )}
                                                                                                {pr.percentIncrease !== undefined && pr.percentIncrease > 0 && pr.daysSinceLast !== undefined && (
                                                                                                    <span className="opacity-20">•</span>
                                                                                                )}
                                                                                                {pr.daysSinceLast !== undefined && (
                                                                                                    <span>{pr.daysSinceLast}d sedan</span>
                                                                                                )}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className="text-xs font-bold text-emerald-400">{(pr.weight * pr.reps).toLocaleString()} kg</p>
                                                                                    <p className="text-[8px] text-slate-600 font-mono">1eRM: {pr.est1RM} kg</p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    });
                                                                })()}

                                                                {!isMulti && (
                                                                    <div className="text-right flex items-center gap-4">
                                                                        <div className="text-right">
                                                                            <p className="text-xs font-bold text-white leading-none">{((prs[0].weight || 0) * (prs[0].reps || 0)).toLocaleString()}kg</p>
                                                                            <div className="flex flex-col items-end mt-1">
                                                                                <p className="text-[8px] text-slate-500 font-mono">
                                                                                    1eRM: {(() => {
                                                                                        const isBW = prs[0].isBodyweight || prs[0].weight === 0;
                                                                                        const calcWeight = isBW ? (prs[0].extraWeight || 0) : (prs[0].weight || 0);
                                                                                        return calculate1RM(calcWeight, prs[0].reps || 0);
                                                                                    })()}kg
                                                                                </p>
                                                                                {((prs[0].percentIncrease !== undefined && prs[0].percentIncrease > 0) || prs[0].daysSinceLast !== undefined) && (
                                                                                    <p className="text-[8px] text-slate-600 font-bold flex items-center gap-1">
                                                                                        {prs[0].percentIncrease !== undefined && prs[0].percentIncrease > 0 && (
                                                                                            <span className="text-emerald-500/70">+{prs[0].percentIncrease.toFixed(1)}%</span>
                                                                                        )}
                                                                                        {prs[0].daysSinceLast !== undefined && (
                                                                                            <span>{prs[0].daysSinceLast}d</span>
                                                                                        )}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => onSelectWorkout?.(prs[0].workout)}
                                                                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-white transition-all transform hover:scale-110"
                                                                        >
                                                                            →
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {prProgression.length === 0 && (
                                    <p className="text-center text-slate-500 py-12 bg-slate-800/30 rounded-2xl border border-dashed border-white/10">Inga PR-data hittades.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onClose();
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] border border-white/5"
                    type="button"
                >
                    Stäng översikt
                </button>
            </div>
        </div>
    );
}

function RecordTrendLine({ pbs }: { pbs: PersonalBest[] }) {
    if (pbs.length < 2) return null;

    const sortedPbs = [...pbs].sort((a, b) => a.date.localeCompare(b.date));
    const exerciseBests: Record<string, number> = {};
    const timelineSlots: { date: string; value: number }[] = [];
    const dates = Array.from(new Set(sortedPbs.map(p => p.date))).sort();

    dates.forEach(date => {
        sortedPbs.filter(p => p.date === date).forEach(p => {
            exerciseBests[p.exerciseName] = p.value;
        });
        const currentSum = Object.values(exerciseBests).reduce((a, b) => a + b, 0);
        timelineSlots.push({ date, value: currentSum });
    });

    const displaySlots = timelineSlots.slice(-40);
    const maxVal = Math.max(...displaySlots.map(s => s.value), 1);
    const minVal = Math.min(...displaySlots.map(s => s.value), 0);
    const valRange = (maxVal - minVal) || 1;

    const width = 1000;
    const height = 100;
    const padding = 10;

    const points = displaySlots.map((s, i) => {
        const x = (i / (displaySlots.length - 1)) * width;
        const y = height - ((s.value - minVal) / valRange) * (height - padding * 2) - padding;
        return `${x},${y}`;
    }).join(' ');

    const lastSlot = displaySlots[displaySlots.length - 1];
    const firstSlot = displaySlots[0];

    return (
        <div className="relative w-full h-full flex items-center pr-12">
            {/* Y-Axis Labels */}
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-between text-[8px] text-slate-600 font-mono z-10 py-1">
                <span className="opacity-80 font-bold">{Math.round(maxVal)}</span>
                <span className="opacity-40">{Math.round(minVal)}</span>
            </div>

            <div className="w-full h-full relative group/chart">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgba(245, 158, 11, 0)" />
                            <stop offset="20%" stopColor="rgba(245, 158, 11, 0.5)" />
                            <stop offset="100%" stopColor="rgba(245, 158, 11, 1)" />
                        </linearGradient>
                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(245, 158, 11, 0.1)" />
                            <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
                        </linearGradient>
                    </defs>

                    {/* Area under curve */}
                    <path
                        d={`M 0,${height} ${points} L ${width},${height} Z`}
                        fill="url(#areaGradient)"
                    />

                    {/* Grid line at current value */}
                    <line
                        x1="0" y1={height - ((lastSlot.value - minVal) / valRange) * (height - padding * 2) - padding}
                        x2={width} y2={height - ((lastSlot.value - minVal) / valRange) * (height - padding * 2) - padding}
                        stroke="rgba(245,158,11,0.1)"
                        strokeDasharray="4 4"
                    />

                    <polyline
                        fill="none"
                        stroke="url(#trendGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                    />

                    {/* End point dot */}
                    <circle
                        cx={width}
                        cy={height - ((lastSlot.value - minVal) / valRange) * (height - padding * 2) - padding}
                        r="4"
                        fill="#f59e0b"
                        className="animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"
                    />
                </svg>

                {/* X-Axis Labels */}
                <div className="absolute -bottom-1 left-0 right-0 flex justify-between text-[7px] text-slate-700 font-mono uppercase tracking-tighter">
                    <span>{firstSlot.date}</span>
                    <span>{lastSlot.date}</span>
                </div>
            </div>

            {/* Current Value Pill */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-amber-500 text-slate-950 px-2 py-1 rounded-lg text-[10px] font-black shadow-[0_0_15px_rgba(245,158,11,0.4)] border border-amber-400">
                {Math.round(lastSlot.value)}
            </div>
        </div>
    );
}
