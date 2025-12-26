import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StrengthWorkout, StrengthWorkoutExercise, StrengthLogImportResult, PersonalBest, StrengthStats, calculate1RM, normalizeExerciseName } from '../models/strengthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { PRResearchCenter } from '../components/training/PRResearchCenter.tsx';

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

    // Helpers
    const slugify = (text: string) => text.trim().replace(/\s+/g, '-');

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
    const [isResearchCenterOpen, setIsResearchCenterOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync selectedExercise with URL
    // Resolve selected exercise from URL (slug -> real name)
    const selectedExercise = React.useMemo(() => {
        if (!exerciseName) return null;
        if (workouts.length === 0) return exerciseName.replace(/-/g, ' '); // Fallback

        // Try to find exact match first (unlikely if slugified)
        // Then try to match slugified names
        for (const w of workouts) {
            for (const e of w.exercises) {
                if (slugify(e.exerciseName) === exerciseName) {
                    return e.exerciseName;
                }
            }
        }

        // Final fallback: just deslugify with spaces
        return exerciseName.replace(/-/g, ' ');
    }, [exerciseName, workouts]);

    // Handle modal close
    const handleCloseExercise = useCallback(() => {
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

    const availableYears = React.useMemo(() => {
        const years = new Set<number>();
        workouts.forEach(w => {
            const year = new Date(w.date).getFullYear();
            if (!isNaN(year)) years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
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

    // Prevent background scroll when Research Center is open
    React.useEffect(() => {
        if (isResearchCenterOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isResearchCenterOpen]);

    // Derive Personal Bests from workout history (ensures bodyweight-aware logic is applied to existing data)
    const derivedPersonalBests = React.useMemo(() => {
        const allPRs: PersonalBest[] = [];
        const currentE1RMBests = new Map<string, number>();
        const currentWeightBests = new Map<string, number>();

        // Sort by date ascending to process records in order
        const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

        sortedWorkouts.forEach(w => {
            w.exercises.forEach((ex, exIdx) => {
                const exName = normalizeExerciseName(ex.exerciseName);
                const exId = `ex-${exName.replace(/\s/g, '-')}`;

                ex.sets.forEach((set, setIdx) => {
                    const isBW = !!set.isBodyweight || set.weight === 0;
                    const calcWeight = isBW ? (set.extraWeight || 0) : set.weight;
                    if (calcWeight <= 0 && !isBW) return;

                    const est1RM = calculate1RM(calcWeight, set.reps);
                    const existingE1RMBest = currentE1RMBests.get(exName) || 0;
                    const existingWeightBest = currentWeightBests.get(exName) || 0;

                    const isE1RMPR = est1RM > existingE1RMBest;
                    const isWeightPR = calcWeight > existingWeightBest;

                    if (isE1RMPR || isWeightPR) {
                        const newPR: PersonalBest = {
                            id: `pb-${exId}-${w.id}-${allPRs.length}`,
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
                            previousBest: existingE1RMBest > 0 ? existingE1RMBest : undefined,
                            orderIndex: (exIdx * 100) + setIdx,
                            isActual1RM: set.reps === 1,
                            isHighestWeight: isWeightPR
                        };
                        allPRs.push(newPR);

                        if (isE1RMPR) currentE1RMBests.set(exName, est1RM);
                        if (isWeightPR) currentWeightBests.set(exName, calcWeight);
                    }
                });
            });
        });

        // Return all PRs sorted by date descending, then by orderIndex ascending for intra-workout accuracy
        return allPRs.sort((a, b) => {
            const dateComp = b.date.localeCompare(a.date);
            if (dateComp !== 0) return dateComp;
            return (a.orderIndex || 0) - (b.orderIndex || 0);
        });
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
        if (filteredWorkouts.length === 0) return null;

        return {
            volume: [...filteredWorkouts].sort((a, b) => b.totalVolume - a.totalVolume)[0],
            duration: [...filteredWorkouts].sort((a, b) => (b.duration || 0) - (a.duration || 0))[0],
            sets: [...filteredWorkouts].sort((a, b) => b.totalSets - a.totalSets)[0],
            reps: [...filteredWorkouts].sort((a, b) => b.totalReps - a.totalReps)[0],
            exercises: [...filteredWorkouts].sort((a, b) => b.uniqueExercises - a.uniqueExercises)[0],
        };
    }, [filteredWorkouts]);

    // Period-based stats
    const periodStats = React.useMemo(() => {
        const count = filteredWorkouts.length;
        const volume = filteredWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
        return { count, volume };
    }, [filteredWorkouts]);

    // Reset date filter
    const resetDateFilter = () => {
        setStartDate(null);
        setEndDate(null);
    };

    const hasDateFilter = startDate !== null || endDate !== null;

    return (
        <div className="pt-2 md:pt-4 p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2">💪 Styrketräning</h1>
                    <p className="text-slate-400">Dina pass, övningar och personliga rekord.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <button
                        onClick={() => setIsResearchCenterOpen(true)}
                        className="bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 active:scale-95"
                    >
                        <span>⚛️</span> Research Center
                    </button>
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

            {/* Advanced Temporal Controls */}
            {workouts.length > 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📅</span>
                            <div>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Datumfilter</h3>
                                <p className="text-[10px] text-slate-600 font-bold uppercase">Begränsa analysen till en specifik tidsperiod</p>
                            </div>
                        </div>
                        {hasDateFilter && (
                            <button
                                onClick={resetDateFilter}
                                className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-4 py-1.5 rounded-full font-black uppercase transition-all"
                            >
                                ✕ Återställ
                            </button>
                        )}
                    </div>

                    {/* Year Presets */}
                    <div className="flex flex-wrap gap-2">
                        {availableYears.map(year => (
                            <button
                                key={year}
                                onClick={() => {
                                    setStartDate(`${year}-01-01`);
                                    setEndDate(`${year}-12-31`);
                                }}
                                className={`text-[11px] font-black uppercase px-6 py-2 rounded-xl border transition-all ${startDate?.startsWith(year.toString()) && endDate?.startsWith(year.toString())
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10'
                                    }`}
                            >
                                {year}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                const now = new Date();
                                const sixMonthsAgo = new Date();
                                sixMonthsAgo.setMonth(now.getMonth() - 6);
                                setStartDate(sixMonthsAgo.toISOString().split('T')[0]);
                                setEndDate(now.toISOString().split('T')[0]);
                            }}
                            className={`text-[11px] font-black uppercase px-6 py-2 rounded-xl border transition-all ${hasDateFilter && !availableYears.some(y => startDate?.startsWith(y.toString()) && endDate?.startsWith(y.toString()))
                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10'
                                }`}
                        >
                            Senaste 6 mån
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <div className="w-full md:w-40 flex-shrink-0">
                            <label className="text-[9px] text-slate-500 uppercase font-black mb-1.5 block">Från</label>
                            <input
                                type="date"
                                value={startDate || dateRange.min}
                                min={dateRange.min}
                                max={endDate || dateRange.max}
                                onChange={(e) => setStartDate(e.target.value || null)}
                                className="w-full bg-slate-900 border border-white/5 text-white px-3 py-2 rounded-xl text-xs font-mono focus:border-blue-500/50 outline-none transition-colors"
                            />
                        </div>

                        {/* Visual Range Slider */}
                        <div className="flex-1 w-full px-2">
                            <label className="text-[9px] text-slate-500 uppercase font-black mb-3 block text-center tracking-widest opacity-60">Tidsaxel</label>
                            <div className="relative h-1.5 bg-slate-900 rounded-full border border-white/5">
                                {(() => {
                                    const min = Math.min(new Date(dateRange.min).getTime(), new Date(startDate || dateRange.min).getTime());
                                    const max = Math.max(new Date(dateRange.max).getTime(), new Date(endDate || dateRange.max).getTime());
                                    const start = new Date(startDate || dateRange.min).getTime();
                                    const end = new Date(endDate || dateRange.max).getTime();
                                    const left = ((start - min) / (max - min)) * 100;
                                    const width = ((end - start) / (max - min)) * 100;

                                    return (
                                        <div
                                            className="absolute h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                        />
                                    );
                                })()}
                                <input
                                    type="range"
                                    min={Math.min(new Date(dateRange.min).getTime(), new Date(startDate || dateRange.min).getTime())}
                                    max={Math.max(new Date(dateRange.max).getTime(), new Date(endDate || dateRange.max).getTime())}
                                    value={new Date(startDate || dateRange.min).getTime()}
                                    onChange={(e) => {
                                        const newStart = Math.min(parseInt(e.target.value), new Date(endDate || dateRange.max).getTime() - 86400000);
                                        setStartDate(new Date(newStart).toISOString().split('T')[0]);
                                    }}
                                    className={`absolute inset-0 w-full appearance-none bg-transparent cursor-pointer slider-thumb-dual ${new Date(startDate || dateRange.min).getTime() > (new Date(dateRange.max).getTime() + new Date(dateRange.min).getTime()) / 2 ? 'z-30' : 'z-20'}`}
                                    style={{ pointerEvents: 'auto' }}
                                />
                                <input
                                    type="range"
                                    min={Math.min(new Date(dateRange.min).getTime(), new Date(startDate || dateRange.min).getTime())}
                                    max={Math.max(new Date(dateRange.max).getTime(), new Date(endDate || dateRange.max).getTime())}
                                    value={new Date(endDate || dateRange.max).getTime()}
                                    onChange={(e) => {
                                        const newEnd = Math.max(parseInt(e.target.value), new Date(startDate || dateRange.min).getTime() + 86400000);
                                        setEndDate(new Date(newEnd).toISOString().split('T')[0]);
                                    }}
                                    className={`absolute inset-0 w-full appearance-none bg-transparent cursor-pointer slider-thumb-dual ${new Date(endDate || dateRange.max).getTime() <= (new Date(dateRange.max).getTime() + new Date(dateRange.min).getTime()) / 2 ? 'z-30' : 'z-20'}`}
                                    style={{ pointerEvents: 'auto' }}
                                />
                            </div>
                        </div>

                        <div className="w-full md:w-40 flex-shrink-0">
                            <label className="text-[9px] text-slate-500 uppercase font-black mb-1.5 block text-right">Till</label>
                            <input
                                type="date"
                                value={endDate || dateRange.max}
                                min={startDate || dateRange.min}
                                max={dateRange.max}
                                onChange={(e) => setEndDate(e.target.value || null)}
                                className="w-full bg-slate-900 border border-white/5 text-white px-3 py-2 rounded-xl text-xs font-mono text-right focus:border-blue-500/50 outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {hasDateFilter && (
                        <div className="pt-2 flex justify-between items-center text-[10px] font-black uppercase text-emerald-400">
                            <span>Siktet inställt på: {new Date(startDate || dateRange.min).toLocaleDateString('sv-SE')} → {new Date(endDate || dateRange.max).toLocaleDateString('sv-SE')}</span>
                            <span className="bg-emerald-500/10 px-3 py-1 rounded-full">{filteredWorkouts.length} pass fångade</span>
                        </div>
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
                    <StatCard label="Totalt pass" value={hasDateFilter ? periodStats.count : stats.totalWorkouts} />
                    <StatCard label="Pass denna vecka" value={stats.workoutsThisWeek} />
                    <StatCard label="Total volym" value={hasDateFilter ? `${Math.round(periodStats.volume / 1000)}t` : `${Math.round(stats.totalVolume / 1000)}t`} />
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
                            // Group PBs by exerciseName
                            const grouped = filteredPBs.reduce((acc, pb) => {
                                const key = pb.exerciseName;
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(pb);
                                return acc;
                            }, {} as Record<string, PersonalBest[]>);

                            // Sort groups by the date of their most recent PR
                            return Object.values(grouped)
                                .sort((a, b) => b[0].date.localeCompare(a[0].date))
                                .slice(0, 12) // Show more groups now that they are exercise-based
                                .map(pbs => {
                                    const latestPb = pbs[0];
                                    const exName = latestPb.exerciseName;

                                    return (
                                        <div
                                            key={exName}
                                            className={`bg-slate-900/40 border border-white/5 rounded-2xl p-5 transition-all hover:border-blue-500/30 hover:bg-slate-900/60 group relative overflow-hidden`}
                                        >
                                            {/* Glow effect */}
                                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-all rounded-full" />

                                            <div className="mb-4 flex justify-between items-start relative">
                                                <div className="flex-1 min-w-0">
                                                    <h3
                                                        className="text-sm font-black text-blue-400 uppercase truncate pr-4 cursor-pointer hover:text-blue-300 transition-colors"
                                                        onClick={() => navigate(`/styrka/${slugify(exName)}`)}
                                                        title={exName}
                                                    >
                                                        {exName}
                                                    </h3>
                                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                        Senaste: {latestPb.date}
                                                        <span className="ml-1 opacity-60">({formatDateRelative(latestPb.date)})</span>
                                                    </p>
                                                </div>
                                                <span className="bg-slate-800 text-slate-500 text-[9px] font-black px-2 py-1 rounded-full border border-white/5">
                                                    {pbs.length} REKORD
                                                </span>
                                            </div>

                                            <div className="space-y-4 relative">
                                                {pbs.slice(0, 3).map((singlePb, idx) => (
                                                    <div
                                                        key={singlePb.id}
                                                        className={`cursor-pointer pb-3 ${idx < Math.min(pbs.length, 3) - 1 ? 'border-b border-white/5' : ''}`}
                                                        onClick={() => navigate(`/styrka/${slugify(singlePb.exerciseName)}`)}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">{singlePb.weight} kg</p>
                                                                    {singlePb.isHighestWeight && <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">NY TOPP</span>}
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                                    {singlePb.reps} reps • {singlePb.estimated1RM} kg e1RM
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[9px] text-slate-600 font-black uppercase">{idx === 0 ? 'Aktuellt' : 'Tidigare'}</p>
                                                                <p className="text-[9px] text-slate-500 font-mono">{singlePb.date.split('-').slice(1).join('-')}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {pbs.length > 3 && (
                                                    <button
                                                        onClick={() => navigate(`/styrka/${slugify(exName)}`)}
                                                        className="w-full text-center py-2 text-[9px] text-slate-600 hover:text-white font-black uppercase transition-colors"
                                                    >
                                                        + {pbs.length - 3} fler rekord i historiken
                                                    </button>
                                                )}
                                            </div>

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
                            <WeeklyVolumeBars workouts={workouts} setStartDate={setStartDate} setEndDate={setEndDate} />
                        </div>
                    </section>
                )
            }

            {/* Training Quality & Continuity */}
            <div className="space-y-12">
                <TrainingBreaks workouts={workouts} filterRange={{ start: startDate, end: endDate }} />
                <LongestStreaks workouts={filteredWorkouts} />
            </div>

            {/* Best Workouts / Records Section */}
            {bestWorkouts && (
                <section>
                    <h2 className="text-xl font-bold text-white mb-4">🏅 Rekordpass {hasDateFilter ? '(Perioden)' : '(Alla tider)'}</h2>
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

            {/* Top Exercises by Volume */}
            {
                filteredWorkouts.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">🔥 Mest tränade övningar</h2>
                        <TopExercisesTable workouts={filteredWorkouts} onSelectExercise={(name) => navigate(`/styrka/${slugify(name)}`)} />
                    </section>
                )
            }

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

            {/* Exercise Detail Modal */}
            {selectedExercise && (
                <ExerciseDetailModal
                    exerciseName={selectedExercise}
                    workouts={workouts}
                    onClose={handleCloseExercise}
                    onSelectWorkout={w => setSelectedWorkout(w)}
                    isWorkoutModalOpen={!!selectedWorkout}
                />
            )}

            {/* Workout Detail Modal - last to be on top */}
            {
                selectedWorkout && (
                    <WorkoutDetailModal
                        workout={selectedWorkout}
                        onClose={() => setSelectedWorkout(null)}
                        onSelectExercise={(name) => {
                            setSelectedWorkout(null);
                            navigate(`/styrka/${slugify(name)}`);
                        }}
                        pbs={filteredPBs}
                    />
                )
            }

            {isResearchCenterOpen && (
                <PRResearchCenter
                    workouts={workouts}
                    personalBests={derivedPersonalBests}
                    onClose={() => setIsResearchCenterOpen(false)}
                    onSelectWorkout={(w) => setSelectedWorkout(w)}
                />
            )}
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

                <div className="space-y-4">
                    {(() => {
                        const aggregated: Record<string, StrengthWorkoutExercise> = {};
                        workout.exercises.forEach(ex => {
                            const exId = ex.exerciseId;
                            if (!aggregated[exId]) {
                                aggregated[exId] = { ...ex, sets: [...ex.sets] };
                            } else {
                                const current = aggregated[exId];
                                const baseSetCount = current.sets.length;
                                ex.sets.forEach((s, idx) => {
                                    current.sets.push({
                                        ...s,
                                        setNumber: baseSetCount + idx + 1
                                    });
                                });
                                current.totalVolume = (current.totalVolume || 0) + (ex.totalVolume || 0);
                                if (ex.topSet && (!current.topSet || ex.topSet.weight > current.topSet.weight)) {
                                    current.topSet = ex.topSet;
                                }
                            }
                        });

                        return Object.values(aggregated).map((exercise, i) => (
                            <div key={i} className="bg-slate-800/30 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <button
                                        onClick={() => onSelectExercise?.(exercise.exerciseName)}
                                        className="font-bold text-white hover:text-blue-400 hover:underline transition-colors text-left"
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
                                        });
                                    })()}
                                </div>
                                {exercise.topSet && (
                                    <p className="text-xs text-amber-400 mt-2">⭐ Top set: {exercise.topSet.reps} × {exercise.topSet.weight} kg</p>
                                )}
                            </div>
                        ));
                    })()}
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

function WeeklyVolumeBars({ workouts, setStartDate, setEndDate }: {
    workouts: StrengthWorkout[];
    setStartDate?: (d: string | null) => void;
    setEndDate?: (d: string | null) => void;
}) {
    const [range, setRange] = React.useState<'3m' | '6m' | '12m' | '2025' | 'all'>('12m');
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [pathData, setPathData] = React.useState<string>('');
    const dotRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
    const [layoutTick, setLayoutTick] = React.useState(0);

    // Group workouts by week and FILL GAPS
    const weeklyData = React.useMemo(() => {
        if (workouts.length === 0) return [];

        const weeks: Record<string, number> = {};
        const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

        const getLocalMidnight = (d: string | Date) => {
            const date = new Date(d);
            if (typeof d === 'string' && d.length === 10) {
                const [y, m, day] = d.split('-').map(Number);
                return new Date(y, m - 1, day);
            }
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        };

        const getDateKey = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const getSundayMidnight = (d: Date) => {
            const res = new Date(d);
            res.setDate(res.getDate() - res.getDay());
            res.setHours(0, 0, 0, 0);
            return res;
        };

        const now = getLocalMidnight(new Date());
        let minDate: Date;
        let maxDate = getLocalMidnight(sortedWorkouts[sortedWorkouts.length - 1].date);

        if (range === '3m') {
            minDate = new Date(now);
            minDate.setMonth(now.getMonth() - 3);
        } else if (range === '6m') {
            minDate = new Date(now);
            minDate.setMonth(now.getMonth() - 6);
        } else if (range === '12m') {
            minDate = new Date(now);
            minDate.setMonth(now.getMonth() - 12);
        } else if (range === '2025') {
            minDate = new Date(2025, 0, 1);
            const eoy = new Date(2025, 11, 31);
            maxDate = now < eoy ? now : eoy;
        } else {
            minDate = getLocalMidnight(sortedWorkouts[0].date);
        }

        const startOfFirstWeek = getSundayMidnight(minDate);
        let current = new Date(startOfFirstWeek);
        while (current <= maxDate) {
            weeks[getDateKey(current)] = 0;
            current.setDate(current.getDate() + 7);
        }

        workouts.forEach(w => {
            const date = getLocalMidnight(w.date);
            const weekStart = getSundayMidnight(date);
            const weekKey = getDateKey(weekStart);
            if (weeks[weekKey] !== undefined) {
                weeks[weekKey] += w.totalVolume;
            }
        });

        const data = Object.entries(weeks)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([week, volume]) => ({ week, volume }));

        return data.map((d, idx) => {
            const prev4 = data.slice(Math.max(0, idx - 3), idx + 1);
            const avg = prev4.reduce((sum, item) => sum + item.volume, 0) / prev4.length;
            return { ...d, rollingAvg: avg };
        });
    }, [workouts, range]);

    // Calculate Trend Line Path
    React.useLayoutEffect(() => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const pts: { x: number, y: number }[] = [];

        weeklyData.forEach((d, i) => {
            const dot = dotRefs.current.get(i);
            if (dot) {
                const rect = dot.getBoundingClientRect();
                const x = rect.left - containerRect.left + rect.width / 2;
                const y = rect.top - containerRect.top + rect.height / 2;
                pts.push({ x, y });
            }
        });

        if (pts.length > 1) {
            setPathData(`M ${pts.map(p => `${p.x} ${p.y}`).join(' L ')}`);
        } else {
            setPathData('');
        }
    }, [weeklyData, range, workouts, layoutTick]);

    // Update path on resize
    React.useEffect(() => {
        const obs = new ResizeObserver(() => setLayoutTick(t => t + 1));
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const maxVolume = Math.max(...weeklyData.map(d => d.volume), 1) * 1.15;
    const sortedByVolume = [...weeklyData].sort((a, b) => b.volume - a.volume);
    const top3Volumes = sortedByVolume.slice(0, 3).map(d => d.volume).filter(v => v > 0);

    if (weeklyData.length === 0) return <p className="text-slate-500">Inte nog med data för att visa trend.</p>;

    const currentYear = new Date().getFullYear();

    const containerWidth = weeklyData.length;
    const barGapClass = containerWidth > 150 ? 'gap-0.5' : containerWidth > 75 ? 'gap-1' : 'gap-1.5 md:gap-2';

    return (
        <div className="space-y-6">
            <div className="flex gap-2 mb-2">
                {[
                    { id: '3m', label: '3 mån', start: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split('T')[0]; } },
                    { id: '6m', label: '6 mån', start: () => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().split('T')[0]; } },
                    { id: '12m', label: '12 mån', start: () => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d.toISOString().split('T')[0]; } },
                    { id: '2025', label: '2025', start: () => '2025-01-01', end: () => '2025-12-31' },
                    { id: 'all', label: 'Alla', start: () => null, end: () => null }
                ].map(p => (
                    <button
                        key={p.id}
                        onClick={() => {
                            setRange(p.id as any);
                            setStartDate?.(p.start());
                            setEndDate?.(p.end?.() || null);
                        }}
                        className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all ${range === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className={`w-full h-40 flex items-end relative ${barGapClass} overflow-visible`} ref={containerRef}>
                {/* Rolling Average Continuous Dashed Line */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
                    <path
                        d={pathData}
                        stroke="rgba(59,130,246,0.5)"
                        strokeWidth="2.5"
                        fill="none"
                        strokeDasharray="8 6"
                        strokeLinecap="round"
                        className="transition-all duration-700"
                    />
                </svg>

                {(() => {
                    const items: React.ReactNode[] = [];
                    dotRefs.current.clear();
                    let gapBuffer: number[] = [];
                    let pendingYearMarkers: { index: number, year: number }[] = [];

                    const renderGap = (indices: number[], yearMarkers: { index: number, year: number }[]) => {
                        if (indices.length === 0) {
                            // If no gap but we have year markers, render them now
                            yearMarkers.forEach(ym => {
                                items.push(
                                    <div key={`year-${ym.year}`} className="flex-shrink-0 w-[1px] h-full bg-blue-500/20 relative mx-0.5">
                                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-blue-500/50 px-1 bg-blue-500/10 rounded">{ym.year}</span>
                                    </div>
                                );
                            });
                            return;
                        }

                        const hasBarsBefore = items.some(item => React.isValidElement(item) && String(item.key).includes('bar'));
                        const isLeadingGap = !hasBarsBefore;
                        const shouldSuppress = isLeadingGap && (range === 'all' || range === '12m' || range === '3m' || range === '6m');

                        if (shouldSuppress) return;

                        if (indices.length >= 4) {
                            items.push(
                                <div key={`break-${indices[0]}`} className="flex-shrink-0 flex flex-col items-center justify-center min-w-[32px] md:min-w-[40px] h-full border-x border-white/5 bg-slate-800/10 rounded-sm relative group/break">
                                    {/* Year Markers inside long gaps */}
                                    {yearMarkers.map(ym => {
                                        const relIndex = ym.index - indices[0];
                                        const leftPos = (relIndex / indices.length) * 100;
                                        return (
                                            <div key={`year-inner-${ym.year}`} className="absolute top-0 bottom-0 w-[1px] bg-blue-500/20 z-0" style={{ left: `${leftPos}%` }}>
                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-blue-500/30 px-1 bg-blue-500/5 rounded">{ym.year}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="text-[8px] text-amber-500/60 font-black uppercase tracking-widest whitespace-nowrap z-10">
                                        ← {indices.length} v →
                                    </div>
                                    {indices.map((idx, step) => {
                                        const d = weeklyData[idx];
                                        const avgHeight = (d.rollingAvg / maxVolume) * 100;
                                        return (
                                            <div
                                                key={`break-dot-${idx}`}
                                                ref={el => { if (el) dotRefs.current.set(idx, el); }}
                                                className="absolute w-1 h-1 pointer-events-none opacity-0"
                                                style={{
                                                    bottom: `${avgHeight}%`,
                                                    marginBottom: '16px',
                                                    left: `${(step / (indices.length - 1 || 1)) * 100}%`
                                                }}
                                            />
                                        );
                                    })}
                                    <div className="h-4" />
                                </div>
                            );
                        } else {
                            indices.forEach((idx, iInGap) => {
                                // Check if a year marker belongs BEFORE this index
                                const marker = yearMarkers.find(ym => ym.index === idx);
                                if (marker) {
                                    items.push(
                                        <div key={`year-${marker.year}`} className="flex-shrink-0 w-[1px] h-full bg-blue-500/20 relative mx-0.5">
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-blue-500/50 px-1 bg-blue-500/10 rounded">{marker.year}</span>
                                        </div>
                                    );
                                }

                                const d = weeklyData[idx];
                                const avgHeight = (d.rollingAvg / maxVolume) * 100;
                                const dateObj = new Date(d.week);
                                const weekLabel = dateObj.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

                                items.push(
                                    <div key={`cross-${idx}`} className="flex-1 min-w-[2px] max-w-[40px] flex flex-col items-center h-full justify-end group/cross relative">
                                        <div
                                            ref={el => { if (el) dotRefs.current.set(idx, el); }}
                                            className="absolute w-6 h-6 rounded-full bg-transparent z-30 cursor-pointer pointer-events-auto flex items-center justify-center group/trend hover:bg-blue-400/5 transition-colors"
                                            style={{ bottom: `${avgHeight}%`, marginBottom: '16px', transform: 'translateY(50%) translateX(-50%)', left: '50%' }}
                                        >
                                            <div className="opacity-0 group-hover/trend:opacity-100 group-hover/cross:hidden transition-opacity absolute bottom-full mb-4 bg-slate-900 border border-blue-500/30 p-2 rounded-lg shadow-2xl z-50 pointer-events-none whitespace-nowrap">
                                                <p className="text-[10px] font-black text-blue-400">Trend: {(d.rollingAvg / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t</p>
                                                <p className="text-[8px] text-slate-500 font-bold">{weekLabel}</p>
                                            </div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-20 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                                        </div>
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover/cross:opacity-100 transition-opacity bg-slate-900 border border-white/10 p-1.5 rounded text-[8px] text-slate-400 z-50 whitespace-nowrap pointer-events-none shadow-2xl">
                                            Ingen träning registrerad
                                        </div>
                                        <div className="h-4 flex items-center justify-center">
                                            <span className="text-[10px] text-red-500/30 font-bold group-hover/cross:text-red-500 transition-colors">×</span>
                                        </div>
                                    </div>
                                );
                            });
                        }
                    };

                    weeklyData.forEach(({ week, volume, rollingAvg }, i) => {
                        const isCurrentWeek = i === weeklyData.length - 1;
                        const dateObj = new Date(week);
                        const currYear = dateObj.getFullYear();
                        const prevYear = i > 0 ? new Date(weeklyData[i - 1].week).getFullYear() : currYear;
                        const isYearBreak = currYear !== prevYear;

                        if (isYearBreak) {
                            pendingYearMarkers.push({ index: i, year: currYear });
                        }

                        if (volume === 0 && !isCurrentWeek) {
                            gapBuffer.push(i);
                        } else {
                            renderGap(gapBuffer, pendingYearMarkers);
                            gapBuffer = [];
                            pendingYearMarkers = [];

                            const height = (volume / maxVolume) * 100;
                            const avgHeight = (rollingAvg / maxVolume) * 100;
                            const weekLabel = dateObj.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
                            const fullLabel = currYear !== currentYear ? `${weekLabel} ${currYear}` : weekLabel;
                            const rank = top3Volumes.indexOf(volume);
                            const isTop = rank !== -1 && volume > 0;
                            const topColors = ['bg-[#CFAF50]', 'bg-[#AAAAAA]', 'bg-[#AA8060]'];

                            items.push(
                                <div key={`bar-${week}`} className="flex-1 min-w-[2px] max-w-[40px] flex flex-col items-center h-full justify-end group/bar relative">
                                    <div
                                        ref={el => { if (el) dotRefs.current.set(i, el); }}
                                        className="absolute w-6 h-6 rounded-full bg-transparent z-30 cursor-pointer pointer-events-auto flex items-center justify-center group/trend hover:bg-blue-400/5 transition-colors"
                                        style={{ bottom: `${avgHeight}%`, marginBottom: '16px', transform: 'translateY(50%) translateX(-50%)', left: '50%' }}
                                    >
                                        <div className="opacity-0 group-hover/trend:opacity-100 group-hover/bar:hidden transition-opacity absolute bottom-full mb-4 bg-slate-900 border border-blue-500/30 p-2 rounded-lg shadow-2xl z-50 pointer-events-none whitespace-nowrap">
                                            <p className="text-[10px] font-black text-blue-400">Trend: {(rollingAvg / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t</p>
                                            <p className="text-[8px] text-slate-500 font-bold">{fullLabel}</p>
                                        </div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-20 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                                    </div>

                                    <div
                                        className="absolute z-50 opacity-0 group-hover/bar:opacity-100 transition-all pointer-events-none whitespace-nowrap bg-slate-900 border border-white/10 p-2 rounded-lg shadow-2xl"
                                        style={{
                                            bottom: `${height}%`,
                                            marginBottom: '24px',
                                            left: '50%',
                                            transform: 'translateX(-50%)'
                                        }}
                                    >
                                        <p className="text-[10px] font-black text-white">{fullLabel}</p>
                                        <p className="text-[10px] font-bold text-emerald-400">{(volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} ton</p>
                                        <p className="text-[8px] text-blue-400 font-bold">Trend: {(rollingAvg / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t</p>
                                    </div>

                                    <span className={`text-[7px] font-black transition-opacity mb-1 ${isCurrentWeek || isTop ? 'opacity-100' : 'text-slate-500 opacity-0 group-hover/bar:opacity-100'} ${isTop ? 'text-white' : 'text-emerald-400/80'}`}>
                                        {(volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}
                                    </span>
                                    <div
                                        className={`w-full rounded-t-[2px] transition-all duration-300 border-t border-white/5 flex-shrink-0 ${volume > 0 ? (isTop ? `${topColors[rank]} shadow-none` : (isCurrentWeek ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-slate-700/40 group-hover/bar:bg-slate-700')) : 'bg-slate-950/20 border-none'}`}
                                        style={{ height: `${Math.max(height, volume > 0 ? 1 : 0)}%`, minHeight: volume > 0 ? '1px' : '0px' }}
                                    />
                                    <div className="h-4 flex items-center">
                                        {(i % 4 === 0 || isCurrentWeek) && (
                                            <span className={`text-[8px] whitespace-nowrap ${isCurrentWeek ? 'text-white font-bold' : 'text-slate-600'}`}>{weekLabel}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                    });

                    renderGap(gapBuffer, pendingYearMarkers);
                    return items;
                })()}
            </div>
        </div>
    );
}

function LongestStreaks({ workouts }: { workouts: StrengthWorkout[] }) {
    const streaks = React.useMemo(() => {
        if (workouts.length === 0) return [];

        // Group by week key
        const weeksSet = new Set<string>();
        workouts.forEach(w => {
            const d = new Date(w.date);
            d.setDate(d.getDate() - d.getDay()); // Start of week
            weeksSet.add(d.toISOString().split('T')[0]);
        });

        const sortedWeeks = Array.from(weeksSet).sort();
        const results: { start: string, end: string, count: number }[] = [];

        if (sortedWeeks.length === 0) return [];

        let currentStreak = [sortedWeeks[0]];

        for (let i = 1; i < sortedWeeks.length; i++) {
            const prev = new Date(sortedWeeks[i - 1]);
            const curr = new Date(sortedWeeks[i]);
            const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 7) { // Consecutive week
                currentStreak.push(sortedWeeks[i]);
            } else {
                if (currentStreak.length >= 2) {
                    results.push({
                        start: currentStreak[0],
                        end: currentStreak[currentStreak.length - 1],
                        count: currentStreak.length
                    });
                }
                currentStreak = [sortedWeeks[i]];
            }
        }

        if (currentStreak.length >= 2) {
            results.push({
                start: currentStreak[0],
                end: currentStreak[currentStreak.length - 1],
                count: currentStreak.length
            });
        }

        return results.sort((a, b) => b.count - a.count);
    }, [workouts]);

    if (streaks.length === 0) return null;

    return (
        <section>
            <h2 className="text-xl font-bold text-white mb-4">🔥 Längsta streaks</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {streaks.slice(0, 3).map((s, i) => (
                    <div key={i} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/20 transition-all">
                        <div>
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Streak</p>
                            <p className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors">{s.count} veckor i rad</p>
                            <p className="text-[11px] text-emerald-500/60 mt-1 font-black uppercase tracking-wider">
                                {new Date(s.start).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} — {new Date(s.end).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="text-2xl opacity-20 group-hover:opacity-100 transition-opacity">⚡</div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function TrainingBreaks({ workouts, filterRange }: { workouts: StrengthWorkout[], filterRange?: { start: string | null, end: string | null } }) {
    const breaks = React.useMemo(() => {
        if (workouts.length < 2) return [];
        const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
        const res: { start: string, end: string, days: number }[] = [];

        for (let i = 0; i < sorted.length - 1; i++) {
            const d1 = new Date(sorted[i].date);
            const d2 = new Date(sorted[i + 1].date);
            const diffDays = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays >= 28) { // Gap of 4+ weeks
                // Check if break overlaps with current filter
                const s = filterRange?.start;
                const e = filterRange?.end;
                const bStart = sorted[i].date;
                const bEnd = sorted[i + 1].date;

                let include = true;
                if (s && bEnd < s) include = false;
                if (e && bStart > e) include = false;

                if (include) {
                    res.push({
                        start: bStart,
                        end: bEnd,
                        days: diffDays
                    });
                }
            }
        }
        return res.sort((a, b) => b.days - a.days); // Longest breaks first
    }, [workouts, filterRange]);

    if (breaks.length === 0) return null;

    return (
        <section>
            <h2 className="text-xl font-bold text-white mb-4">⏸️ Träningsuppehåll</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {breaks.slice(0, 6).map((b, i) => {
                    const formatDateStr = (dStr: string) => {
                        const d = new Date(dStr);
                        const year = d.getFullYear();
                        return `${d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} ${year}`;
                    };
                    return (
                        <div key={i} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-amber-500/20 transition-all">
                            <div>
                                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Uppehåll</p>
                                <p className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">{b.days} dagar</p>
                                <p className="text-[11px] text-blue-400 mt-1 font-black uppercase tracking-wider">
                                    {formatDateStr(b.start)} — {formatDateStr(b.end)}
                                </p>
                            </div>
                            <div className="text-2xl opacity-20 group-hover:opacity-100 transition-opacity">💤</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ============================================
// Top Exercises Table
// ============================================

function TopExercisesTable({ workouts, onSelectExercise }: { workouts: StrengthWorkout[]; onSelectExercise?: (name: string) => void }) {
    const [sortBy, setSortBy] = React.useState<'name' | 'count' | 'sets' | 'reps' | 'volume'>('volume');
    const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
    const [filter, setFilter] = React.useState<'all' | 'bw' | 'weighted'>('all');

    const handleSort = (field: typeof sortBy) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const exerciseStats = React.useMemo(() => {
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
                        className={`text-[10px] font-black uppercase px-4 py-2 rounded-full border transition-all ${filter === f.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-white/5 text-slate-500 hover:border-white/10'}`}
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
                                    <span className="text-slate-700 mr-2 font-mono">#{i + 1}</span>
                                    {ex.name}
                                    {ex.isBW && <span className="ml-2 text-[8px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded tracking-widest">BW</span>}
                                    {onSelectExercise && <span className="text-slate-700 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>}
                                </td>
                                <td className="px-4 py-4 text-right text-slate-400 font-mono">{ex.count}×</td>
                                <td className="px-4 py-4 text-right text-slate-400 font-mono">{ex.sets}</td>
                                <td className="px-4 py-4 text-right text-blue-400 font-bold font-mono">{ex.reps.toLocaleString()}</td>
                                <td className="px-4 py-4 text-right text-emerald-400 font-black font-mono">{(ex.volume / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}t</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
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

    // Safe slugify helper
    const slugify = (text: string) => text.trim().replace(/\s+/g, '-');

    // Deslugify logic (try to match against real names)
    // We don't have a list of all exercises here easily, BUT we can infer from properExerciseName passed in props OR derived

    // Actually, ExerciseDetailModal receives the REAL name. The logic for decoding URL should be in the parent.
    // So here we trust `exerciseName` is the real name.

    // Get all instances of this exercise across workouts
    const exerciseHistory = React.useMemo(() => {
        const history: { date: string; sets: number; reps: number; maxWeight: number; volume: number; est1RM: number; workout: StrengthWorkout }[] = [];

        workouts.forEach(w => {
            // Robust matching: Check both exact and normalized
            const exerciseEntries = w.exercises.filter(e =>
                e.exerciseName === exerciseName ||
                normalizeExerciseName(e.exerciseName) === normalizeExerciseName(exerciseName)
            );

            if (exerciseEntries.length > 0) {
                const allSets = exerciseEntries.flatMap(e => e.sets);
                const maxWeight = Math.max(...allSets.map(s => s.weight));
                const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
                const volume = exerciseEntries.reduce((sum, e) => sum + (e.totalVolume || 0), 0);

                // Find best set for 1RM estimate (bodyweight aware)
                const est1RMs = allSets.map(s => {
                    const isBW = s.isBodyweight || s.weight === 0;
                    const calcWeight = isBW ? (s.extraWeight || 0) : s.weight;
                    return calculate1RM(calcWeight, s.reps);
                });
                const best1RMValue = Math.max(...est1RMs);

                history.push({
                    date: w.date,
                    sets: allSets.length,
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
            // Robust matching: Check both exact and normalized
            const exerciseEntries = h.workout.exercises.filter(e =>
                e.exerciseName === exerciseName ||
                normalizeExerciseName(e.exerciseName) === normalizeExerciseName(exerciseName)
            );

            if (exerciseEntries.length === 0) return;

            // Flatten all sets from all entries in correct order
            const allSets = exerciseEntries.flatMap(e => e.sets);

            allSets.forEach(set => {
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
                                                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group relative h-full">
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
                                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
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
