import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StrengthWorkout, StrengthWorkoutExercise, StrengthLogImportResult, PersonalBest, StrengthStats, calculate1RM, normalizeExerciseName } from '../models/strengthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { PRResearchCenter } from '../components/training/PRResearchCenter.tsx';
import { WeeklyVolumeChart } from '../components/training/WeeklyVolumeChart.tsx';
import { StrengthStreaks } from '../components/training/StrengthStreaks.tsx';
import { TrainingBreaks } from '../components/training/TrainingBreaks.tsx';
import { TopExercisesTable } from '../components/training/TopExercisesTable.tsx';
import { ExerciseDetailModal } from '../components/training/ExerciseDetailModal.tsx';
import { WorkoutDetailModal } from '../components/training/WorkoutDetailModal.tsx';
import { Tabs } from '../components/common/Tabs.tsx';
import { CollapsibleSection } from '../components/common/CollapsibleSection.tsx';
import { TrainingTimeStats } from '../components/training/TrainingTimeStats.tsx';
import { PlateauWarningCard, VolumeRecommendationCard } from '../components/training/ProgressiveOverloadCard.tsx';
import { getPlateauWarnings, getWeeklyVolumeRecommendations, getUnderperformers, type PlateauWarning, type Underperformer } from '../utils/progressiveOverload.ts';

// ============================================
// Strength Page - Main Component
// ============================================

export function StrengthPage() {
    const navigate = useNavigate();
    const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
    const [stats, setStats] = useState<StrengthStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<StrengthLogImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<StrengthWorkout | null>(null);
    const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
    const [isResearchCenterOpen, setIsResearchCenterOpen] = useState(false);

    // Helpers
    // Format as "16 juli 2025 (3 dagar sedan)"
    const formatDateFull = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const datePart = date.toLocaleDateString('sv-SE', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        let agoPart = '';
        if (diffDays === 0) agoPart = 'idag';
        else if (diffDays === 1) agoPart = 'igår';
        else if (diffDays < 7) agoPart = `${diffDays} dagar sedan`;
        else if (diffDays < 30) agoPart = `${Math.floor(diffDays / 7)} veckor sedan`;
        else if (diffDays < 365) agoPart = `${Math.floor(diffDays / 30)} mån sedan`;
        else {
            const years = Math.floor(diffDays / 365);
            const months = Math.floor((diffDays % 365) / 30);
            agoPart = months > 0 ? `${years} år ${months} mån sedan` : `${years} år sedan`;
        }

        return `${datePart} (${agoPart})`;
    };

    // Format as compact "3d", "2v", "2 år 4 mån"
    const formatDaysAgoCompact = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'idag';
        if (diffDays === 1) return 'igår';
        if (diffDays < 7) return `${diffDays}d sedan`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}v sedan`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} mån sedan`;

        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        return months > 0 ? `${years} år ${months} mån sedan` : `${years} år sedan`;
    };

    const formatDateRelative = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Idag';
        if (diffDays === 1) return 'Igår';
        if (diffDays < 7) return `${diffDays} dagar sedan`;
        return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
    };

    const slugify = (text: string) => text.trim().replace(/\s+/g, '-');

    // Check for exercise in URL
    const exerciseNameMatch = window.location.pathname.match(/\/styrka\/(.+)/);
    const exerciseSlug = exerciseNameMatch ? exerciseNameMatch[1] : null;

    const exerciseName = exerciseSlug ? decodeURIComponent(exerciseSlug) : null;

    const selectedExercise = useMemo(() => {
        if (!exerciseName) return null;

        // Exact match?
        // We need to find the REAL name from the slug
        // Iterate all workouts and find a match
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
    useEffect(() => {
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

    // Workout Search & Pagination
    const [workoutSearchTerm, setWorkoutSearchTerm] = useState('');
    const [workoutDisplayCount, setWorkoutDisplayCount] = useState(20);

    const searchedWorkouts = useMemo(() => {
        if (!workoutSearchTerm) return filteredWorkouts;
        const lower = workoutSearchTerm.toLowerCase();
        return filteredWorkouts.filter(w =>
            w.name.toLowerCase().includes(lower) ||
            w.exercises.some(e => e.exerciseName.toLowerCase().includes(lower))
        );
    }, [filteredWorkouts, workoutSearchTerm]);

    // Reset pagination when filter changes
    useEffect(() => {
        setWorkoutDisplayCount(20);
    }, [workoutSearchTerm, startDate, endDate]);

    const visibleWorkouts = searchedWorkouts.slice(0, workoutDisplayCount);

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

            {/* Progressive Overload - Plateau Warnings & Volume */}
            {workouts.length > 0 && (() => {
                const plateauWarnings = getPlateauWarnings(workouts, 3);
                const volumeRecs = getWeeklyVolumeRecommendations(workouts).filter(r => r.recommendation !== 'maintain');

                if (plateauWarnings.length === 0 && volumeRecs.length === 0) return null;

                return (
                    <section className="mt-8">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-xl">📈</span>
                            <div>
                                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Progressive Overload Assistant</h2>
                                <p className="text-[10px] text-slate-600 font-bold">Platåer, volym och rekommendationer</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Plateau Warnings */}
                            {plateauWarnings.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                        <span>⚠️</span> Övningar som stagnerat
                                    </h3>
                                    {plateauWarnings.slice(0, 4).map((warning, idx) => (
                                        <PlateauWarningCard key={idx} warning={warning} />
                                    ))}
                                </div>
                            )}

                            {/* Volume Recommendations */}
                            {volumeRecs.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                                        <span>📊</span> Volymanalys
                                    </h3>
                                    {volumeRecs.slice(0, 4).map((rec, idx) => (
                                        <VolumeRecommendationCard key={idx} recommendation={rec} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                );
            })()}

            {/* Training Time Analytics - 50% width */}
            <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <TrainingTimeStats
                    workouts={filteredWorkouts}
                    days={hasDateFilter ? 365 : 9999}
                    personalBests={personalBests}
                    dateRangeLabel={hasDateFilter && startDate && endDate ? `${new Date(startDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} - ${new Date(endDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Alla tider'}
                />
                {/* Placeholder for another module */}
                <div className="hidden md:block" />
            </section>

            {/* Personal Bests */}
            {/* Tabs for PBs and Trends */}
            <section className="mt-8">
                <Tabs
                    items={[
                        {
                            id: 'latest-records',
                            label: 'Senaste Rekord',
                            icon: '🏆',
                            content: (
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
                                            .slice(0, 12)
                                            .map(pbs => {
                                                const latestPb = pbs[0];
                                                const exName = latestPb.exerciseName;

                                                return (
                                                    <div
                                                        key={exName}
                                                        className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 transition-all hover:border-blue-500/30 hover:bg-slate-900/60 group relative overflow-hidden cursor-pointer"
                                                        onClick={() => navigate(`/styrka/${slugify(exName)}`)}
                                                    >
                                                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-all rounded-full" />
                                                        <div className="flex justify-between items-start mb-3 relative">
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-sm font-black text-blue-400 uppercase truncate pr-4" title={exName}>
                                                                    {exName}
                                                                </h3>
                                                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                    Senaste: {latestPb.date}
                                                                </p>
                                                            </div>
                                                            <span className="bg-slate-800 text-slate-500 text-[9px] font-black px-2 py-1 rounded-full border border-white/5">
                                                                {pbs.length} REKORD
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2 relative">
                                                            {pbs.slice(0, 3).map((singlePb, idx) => (
                                                                <div key={singlePb.id} className="flex justify-between items-center text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`font-black ${idx === 0 ? 'text-white text-lg' : 'text-slate-400'}`}>{singlePb.weight} kg</span>
                                                                        {singlePb.isHighestWeight && <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1 rounded font-bold uppercase">TOPP</span>}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-slate-500">{singlePb.reps} reps</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                    })()}
                                </div>
                            )
                        },
                        {
                            id: 'trend-line',
                            label: 'Trend',
                            icon: '📈',
                            content: (
                                <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Övergripande rekord-trend</h3>
                                            <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold italic">Din totala styrka (Summan av alla personbästa 1eRM)</p>
                                        </div>
                                    </div>
                                    <div className="h-48 w-full relative">
                                        <RecordTrendLine pbs={filteredPBs} />
                                    </div>
                                </div>
                            )
                        },
                        {
                            id: 'volume-overview',
                            label: 'Volym-Översikt',
                            icon: '📊',
                            content: (
                                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                                    <h2 className="text-xl font-bold text-white mb-4">📈 Volym per vecka</h2>
                                    <WeeklyVolumeChart workouts={workouts} setStartDate={setStartDate} setEndDate={setEndDate} />
                                </div>
                            )
                        },
                        {
                            id: 'underperformers',
                            label: 'Underpresterare',
                            icon: '📉',
                            content: (
                                <div className="space-y-4">
                                    <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">
                                            Övningar du tränar ofta men har flat utveckling — många set utan nya rekord
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {getUnderperformers(workouts, personalBests, 15).slice(0, 9).map(u => (
                                            <div
                                                key={u.exerciseName}
                                                className="bg-slate-900/40 border border-white/5 rounded-xl p-4 hover:border-amber-500/30 transition-all group"
                                            >
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() => navigate(`/styrka/${slugify(u.exerciseName)}`)}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-sm font-black text-white uppercase truncate pr-2 group-hover:text-amber-400 transition-colors">
                                                            {u.exerciseName}
                                                            {u.isBodyweight && <span className="ml-1 text-[8px] text-slate-500 border border-white/10 px-1 py-0.5 rounded bg-slate-800">KV</span>}
                                                            {u.isTimeBased && <span className="ml-1 text-[8px] text-cyan-500 border border-cyan-500/20 px-1 py-0.5 rounded bg-cyan-500/10">TID</span>}
                                                            {u.isHyrox && <span className="ml-1 text-[8px] text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded bg-amber-500/10 tracking-wider">HYROX</span>}
                                                        </h3>
                                                        <span className="text-[8px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-black uppercase shrink-0">
                                                            {u.setsSinceLastPB} set
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div>
                                                            <p className="text-xl font-black text-amber-400">{u.daysSinceLastPB || '—'}d</p>
                                                            <p className="text-[8px] text-slate-600 uppercase">sedan rekord</p>
                                                        </div>
                                                        {u.isTimeBased && u.maxTimeFormatted ? (
                                                            <div className="border-l border-white/5 pl-3">
                                                                <p className="text-lg font-black text-cyan-400">{u.maxTimeFormatted}</p>
                                                                <p className="text-[8px] text-slate-600 uppercase">rekord</p>
                                                            </div>
                                                        ) : u.isWeightedDistance && (u.e1RM || u.maxDistance) ? (
                                                            <div className="border-l border-white/5 pl-3">
                                                                <p className="text-lg font-black text-emerald-400">
                                                                    {u.e1RM}kg <span className="text-slate-500 text-xs font-normal">({u.maxDistance}{u.maxDistanceUnit})</span>
                                                                </p>
                                                                <p className="text-[8px] text-slate-600 uppercase">PB</p>
                                                            </div>
                                                        ) : u.e1RM && (
                                                            <div className="border-l border-white/5 pl-3">
                                                                <p className="text-lg font-black text-slate-400">{u.e1RM}kg</p>
                                                                <p className="text-[8px] text-slate-600 uppercase">{u.isBodyweight ? '1RM' : 'e1RM'}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] text-slate-500 italic mb-2">{u.message}</p>
                                                </div>
                                                {u.lastPBWorkoutId && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const workout = workouts.find(w => w.id === u.lastPBWorkoutId);
                                                            if (workout) setSelectedWorkout(workout);
                                                        }}
                                                        className="w-full mt-2 text-[9px] bg-slate-800/50 hover:bg-blue-600/20 text-slate-500 hover:text-blue-400 py-1.5 rounded-lg transition-all border border-white/5 font-bold uppercase"
                                                    >
                                                        📋 Visa senaste rekord-passet
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {getUnderperformers(workouts, personalBests, 15).length === 0 && (
                                        <div className="text-center text-slate-500 py-8">
                                            <p className="text-2xl mb-2">🎉</p>
                                            <p className="text-sm">Inga underpresterande övningar!</p>
                                            <p className="text-[10px] text-slate-600">Du gör framsteg i alla övningar du tränar regelbundet.</p>
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    ]}
                />
            </section>

            {/* Training Quality & Continuity */}
            <div className="space-y-12">
                <TrainingBreaks workouts={workouts} filterRange={{ start: startDate, end: endDate }} />
                <StrengthStreaks workouts={filteredWorkouts} />
            </div>

            {/* Best Workouts / Records Section */}
            {bestWorkouts && (
                <section>
                    <h2 className="text-lg font-bold text-white mb-3">🏅 Rekordpass {hasDateFilter ? '(Perioden)' : '(Alla tider)'}</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.volume)}
                            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center hover:bg-emerald-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[9px] text-emerald-500 font-black uppercase">Mest volym</p>
                            <p className="text-xl font-black text-white my-1">{Math.round(bestWorkouts.volume.totalVolume / 1000)}t</p>
                            <p className="text-[9px] text-slate-500">{bestWorkouts.volume.totalSets} set | {bestWorkouts.volume.uniqueExercises} övn</p>
                            <p className="text-[8px] text-emerald-500/60 mt-1">{formatDateFull(bestWorkouts.volume.date)}</p>
                        </button>
                        {bestWorkouts.duration?.duration && bestWorkouts.duration.duration > 0 && (
                            <button
                                onClick={() => setSelectedWorkout(bestWorkouts.duration)}
                                className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center hover:bg-blue-500/20 transition-all group active:scale-95"
                            >
                                <p className="text-[9px] text-blue-500 font-black uppercase">Längst pass</p>
                                <p className="text-xl font-black text-white my-1">{bestWorkouts.duration.duration}m</p>
                                <p className="text-[9px] text-slate-500">{bestWorkouts.duration.totalSets} set | {bestWorkouts.duration.uniqueExercises} övn</p>
                                <p className="text-[8px] text-blue-500/60 mt-1">{formatDateFull(bestWorkouts.duration.date)}</p>
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.sets)}
                            className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center hover:bg-purple-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[9px] text-purple-500 font-black uppercase">Flest set</p>
                            <p className="text-xl font-black text-white my-1">{bestWorkouts.sets.totalSets} st</p>
                            <p className="text-[9px] text-slate-500">{bestWorkouts.sets.uniqueExercises} övningar</p>
                            <p className="text-[8px] text-purple-500/60 mt-1">{formatDateFull(bestWorkouts.sets.date)}</p>
                        </button>
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.reps)}
                            className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center hover:bg-amber-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[9px] text-amber-500 font-black uppercase">Flest reps</p>
                            <p className="text-xl font-black text-white my-1">{bestWorkouts.reps.totalReps}</p>
                            <p className="text-[9px] text-slate-500">{bestWorkouts.reps.totalSets} set | {bestWorkouts.reps.uniqueExercises} övn</p>
                            <p className="text-[8px] text-amber-500/60 mt-1">{formatDateFull(bestWorkouts.reps.date)}</p>
                        </button>
                        <button
                            onClick={() => setSelectedWorkout(bestWorkouts.exercises)}
                            className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3 text-center hover:bg-pink-500/20 transition-all group active:scale-95"
                        >
                            <p className="text-[9px] text-pink-500 font-black uppercase">Variation</p>
                            <p className="text-xl font-black text-white my-1">{bestWorkouts.exercises.uniqueExercises} övn</p>
                            <p className="text-[9px] text-slate-500">{bestWorkouts.exercises.totalSets} set totalt</p>
                            <p className="text-[8px] text-pink-500/60 mt-1">{formatDateFull(bestWorkouts.exercises.date)}</p>
                        </button>
                    </div>
                </section>
            )}

            {/* Top Exercises by Volume */}
            {
                filteredWorkouts.length > 0 && (
                    <CollapsibleSection
                        id="top-exercises"
                        title="Mest tränade övningar"
                        icon="🔥"
                        className="mb-8"
                    >
                        <TopExercisesTable workouts={filteredWorkouts} personalBests={personalBests} onSelectExercise={(name) => navigate(`/styrka/${slugify(name)}`)} />
                    </CollapsibleSection>
                )
            }

            {/* Workouts List */}
            <CollapsibleSection
                id="recent-workouts"
                title="Träningspass"
                icon="📋"
                defaultOpen={true}
                className="mb-8"
            >
                {loading ? (
                    <div className="text-center text-slate-500 py-12">Laddar...</div>
                ) : filteredWorkouts.length === 0 ? (
                    <div className="text-center text-slate-500 py-12 bg-slate-900/50 rounded-2xl border border-white/5">
                        <p className="text-4xl mb-4">🏋️</p>
                        <p>{hasDateFilter ? 'Inga pass i valt datumintervall' : 'Inga pass ännu. Importera din StrengthLog CSV!'}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                            <input
                                type="text"
                                placeholder="Sök pass, övningar..."
                                value={workoutSearchTerm}
                                onChange={(e) => setWorkoutSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-white/5 text-white pl-10 pr-4 py-3 rounded-xl focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                            />
                            {workoutSearchTerm && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                                    {searchedWorkouts.length} träffar
                                </div>
                            )}
                        </div>

                        {visibleWorkouts.length === 0 ? (
                            <div className="text-center text-slate-500 py-12">
                                <p>Inga pass matchar din sökning.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {visibleWorkouts.map(workout => (
                                    <WorkoutCard
                                        key={workout.id}
                                        workout={workout}
                                        onClick={() => setSelectedWorkout(workout)}
                                    />
                                ))}
                            </div>
                        )}

                        {visibleWorkouts.length < searchedWorkouts.length && (
                            <button
                                onClick={() => setWorkoutDisplayCount(prev => prev + 20)}
                                className="w-full py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-white/5 transition-all font-bold uppercase text-xs tracking-wider"
                            >
                                Visa fler pass ({searchedWorkouts.length - visibleWorkouts.length} kvar)
                            </button>
                        )}
                    </div>
                )}
            </CollapsibleSection>

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
