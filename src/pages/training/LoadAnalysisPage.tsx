import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, Brush, ReferenceArea
} from 'recharts';
import { useMuscleLoadAnalysis } from '../../hooks/useMuscleLoadAnalysis.ts';
import exercisesData from '../../../data/exercises.json';
import musclesData from '../../../data/muscles.json';

// Types
import { MuscleHierarchy } from '../../models/muscle.ts';
const muscleHierarchy = musclesData as MuscleHierarchy;
const allExercises = exercisesData.exercises;

// Flat list of muscles for selector
const allMuscles = muscleHierarchy.categories.flatMap(c =>
    c.groups.flatMap(g =>
        g.children?.map(m => ({
            id: m.id,
            name: m.name,
            group: g.name
        })) || []
    )
);

export const LoadAnalysisPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // URL State
    const muscleId = searchParams.get('muscle');
    const exerciseId = searchParams.get('exercise');

    const [selectedMuscle, setSelectedMuscle] = useState<string | null>(muscleId);
    const [selectedExercise, setSelectedExercise] = useState<string | null>(exerciseId);

    // Range selection state
    const [selectedStartDate, setSelectedStartDate] = useState<string | null>(null);
    const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [rollingPeriod, setRollingPeriod] = useState<'day' | 'week' | 'month'>('day');

    const { stats, isLoading } = useMuscleLoadAnalysis(selectedMuscle, selectedExercise);

    // Compute rolling average data based on period
    const chartDataWithRolling = useMemo(() => {
        if (!stats?.chartData) return [];
        if (rollingPeriod === 'day') return stats.chartData;

        const windowSize = rollingPeriod === 'week' ? 7 : 30;
        return stats.chartData.map((point, idx, arr) => {
            const windowStart = Math.max(0, idx - windowSize + 1);
            const window = arr.slice(windowStart, idx + 1);
            const avg = window.reduce((sum, p) => sum + p.load, 0) / window.length;
            return { ...point, load: Math.round(avg) };
        });
    }, [stats?.chartData, rollingPeriod]);

    // Compute detailed data for selected range
    const selectedRangeData = useMemo(() => {
        if (!stats?.workoutDetailsByDate || (!selectedStartDate && !selectedEndDate)) return null;

        const startDate = selectedStartDate || selectedEndDate;
        const endDate = selectedEndDate || selectedStartDate;
        if (!startDate || !endDate) return null;

        // Ensure dates are in correct order
        const [fromDate, toDate] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];

        // Get all dates in range
        const datesInRange = Object.keys(stats.workoutDetailsByDate)
            .filter(date => date >= fromDate && date <= toDate)
            .sort();

        // Aggregate exercises and sets
        const exerciseMap: Record<string, { name: string; role: string; sets: Array<{ weight: number; reps: number; volume: number; e1rm: number; date: string; workoutId?: string }> }> = {};

        datesInRange.forEach(date => {
            stats.workoutDetailsByDate[date]?.forEach(exercise => {
                if (!exerciseMap[exercise.exerciseId]) {
                    exerciseMap[exercise.exerciseId] = {
                        name: exercise.exerciseName,
                        role: exercise.role,
                        sets: []
                    };
                }
                exercise.sets.forEach(set => {
                    exerciseMap[exercise.exerciseId].sets.push({
                        ...set,
                        date,
                        workoutId: exercise.workoutId
                    });
                });
            });
        });

        const totalVolume = Object.values(exerciseMap).reduce(
            (acc, ex) => acc + ex.sets.reduce((s, set) => s + set.volume, 0), 0
        );
        const totalSets = Object.values(exerciseMap).reduce((acc, ex) => acc + ex.sets.length, 0);

        return {
            fromDate,
            toDate,
            isSingleDay: fromDate === toDate,
            datesInRange,
            exercises: Object.values(exerciseMap),
            totalVolume,
            totalSets
        };
    }, [stats?.workoutDetailsByDate, selectedStartDate, selectedEndDate]);

    const handleMuscleChange = (id: string) => {
        setSelectedMuscle(id);
        setSelectedExercise(null);
        navigate(`/training/load?muscle=${id}`);
    };

    const handleExerciseChange = (id: string) => {
        setSelectedExercise(id);
        navigate(`/training/load?exercise=${id}${selectedMuscle ? `&muscle=${selectedMuscle}` : ''}`);
    };

    // Derived UI State
    const muscleName = allMuscles.find(m => m.id === selectedMuscle)?.name || selectedMuscle;
    const exerciseName = allExercises.find(e => e.id === selectedExercise)?.name_sv || selectedExercise;
    const pageTitle = selectedExercise
        ? `Analys: ${exerciseName}`
        : selectedMuscle
            ? `Belastningsanalys: ${muscleName}`
            : 'Belastningsanalys';

    // Helper to get exercises for current muscle
    const relevantExercises = selectedMuscle
        ? allExercises.filter(e => e.primaryMuscles.includes(selectedMuscle) || e.secondaryMuscles.includes(selectedMuscle))
        : allExercises;

    relevantExercises.sort((a, b) => a.name_sv.localeCompare(b.name_sv));

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{pageTitle}</h1>
                    <p className="text-slate-400">
                        Analysera volym och intensitet. {selectedMuscle && !selectedExercise && "(100% volym för primära, 50% för sekundära)"}
                    </p>
                </div>
            </div>

            {/* Controls - Pretty Visual Selector */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 space-y-6">
                {/* Muscle Selector */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">🎯 Muskelgrupp</label>
                        {selectedMuscle && (
                            <button
                                onClick={() => { setSelectedMuscle(null); setSelectedExercise(null); navigate('/training/load'); }}
                                className="text-xs text-slate-500 hover:text-white"
                            >
                                ✕ Rensa
                            </button>
                        )}
                    </div>

                    {(() => {
                        const groups = Array.from(new Set(allMuscles.map(m => m.group)));
                        return (
                            <div className="space-y-3">
                                {groups.map(group => (
                                    <div key={group}>
                                        <div className="text-[10px] uppercase text-slate-600 font-bold mb-1.5">{group}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {allMuscles.filter(m => m.group === group).map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => handleMuscleChange(m.id)}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${selectedMuscle === m.id
                                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-white/5'
                                                        }`}
                                                >
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* Exercise Selector */}
                {selectedMuscle && relevantExercises.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                💪 Övningar för {muscleName}
                                <span className="text-slate-600 ml-2">({relevantExercises.length})</span>
                            </label>
                            {selectedExercise && (
                                <button
                                    onClick={() => { setSelectedExercise(null); navigate(`/training/load?muscle=${selectedMuscle}`); }}
                                    className="text-xs text-slate-500 hover:text-white"
                                >
                                    ✕ Visa alla
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                            {relevantExercises.map(e => {
                                const isPrimary = e.primaryMuscles.includes(selectedMuscle);
                                return (
                                    <button
                                        key={e.id}
                                        onClick={() => handleExerciseChange(e.id)}
                                        className={`group relative px-3 py-2 text-xs font-medium rounded-xl transition-all ${selectedExercise === e.id
                                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                            : isPrimary
                                                ? 'bg-slate-800 text-white hover:bg-slate-700 border border-emerald-500/30'
                                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-white/5'
                                            }`}
                                    >
                                        <span className={`text-[9px] uppercase font-bold mr-1 ${selectedExercise === e.id ? 'text-blue-200' : isPrimary ? 'text-emerald-400' : 'text-slate-500'
                                            }`}>
                                            {isPrimary ? 'P' : 'S'}
                                        </span>
                                        {e.name_sv}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="h-96 flex items-center justify-center text-slate-500">Laddar analys...</div>
            ) : !stats ? (
                <div className="h-96 flex items-center justify-center text-slate-500 italic">Välj en muskel eller övning för att se data.</div>
            ) : (
                <div className="space-y-8">

                    {/* Metric Explanations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-sm">
                            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                <span className="text-orange-400">💪</span> Skillnad på 1RM & e1RM
                            </h3>
                            <p className="text-slate-400 leading-relaxed text-xs">
                                <span className="text-yellow-400 font-medium whitespace-nowrap">1RM</span>: Faktiskt vikt lyft för 1 repetition.<br />
                                <span className="text-orange-400 font-medium whitespace-nowrap">e1RM</span>: <i>Estimated 1RM</i>. Beräknas som <code className="bg-slate-800 px-1 rounded">Vikt * (1 + Reps/30)</code>. Gör det möjligt att jämföra t.ex. 5 reps på 80kg med 3 reps på 85kg.
                            </p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-sm">
                            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                <span className="text-blue-400">📅</span> Vad är Frekvens?
                            </h3>
                            <p className="text-slate-400 leading-relaxed text-xs">
                                Genomsnittligt antal pass per vecka där denna muskel/övning aktiverats.
                                Beräknas som totalt antal pass genom antal veckor mellan första och sista passet i intervallet.
                            </p>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                            <div className="text-xs text-slate-500 font-bold uppercase mb-1">Total Volym</div>
                            <div className="text-2xl font-bold text-white">{(stats.totalTonnage / 1000).toFixed(1)} ton</div>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                            <div className="text-xs text-slate-500 font-bold uppercase mb-1">Antal Set</div>
                            <div className="text-2xl font-bold text-white">{stats.totalSets}</div>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                            <div className="text-xs text-slate-500 font-bold uppercase mb-1">Bästa e1RM</div>
                            <div className="text-2xl font-bold text-orange-400">{stats.bestE1RM}kg</div>
                            <div className="text-[10px] text-slate-600">Högsta beräknade styrka</div>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5" title="Hur ofta du tränar denna muskel/övning per vecka i genomsnitt">
                            <div className="text-xs text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                                Frekvens
                                <span className="text-[10px] text-slate-600">ⓘ</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-400">{stats.frequencyPerWeek}x</div>
                            <div className="text-[10px] text-slate-600">
                                /vecka ({stats.totalSessions} pass)
                            </div>
                        </div>
                    </div>

                    {/* Matched Exercises Debug Section */}
                    {stats.matchedExercises && stats.matchedExercises.length > 0 && (
                        <div className="bg-slate-900 p-4 rounded-2xl border border-white/5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">🔗 Matchade övningar</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {stats.matchedExercises.map((m, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg text-sm">
                                        <div className="flex-1">
                                            <span className="text-slate-300">"{m.original}"</span>
                                            <span className="text-slate-500 mx-2">→</span>
                                            <span className="text-emerald-400 font-medium">{m.matchedTo}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="text-slate-500" title="Matchningsregel">{m.reason}</span>
                                            <span className="bg-slate-700 px-2 py-0.5 rounded text-white">{m.sets} set</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Load Graph */}
                    <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">
                                Belastning & Styrka
                                {rollingPeriod !== 'day' && <span className="text-emerald-400 text-sm ml-2">
                                    ({rollingPeriod === 'week' ? '7d' : '30d'} snitt)
                                </span>}
                            </h2>
                            <div className="flex items-center gap-2">
                                <div className="flex bg-slate-800 rounded-lg p-0.5">
                                    {(['day', 'week', 'month'] as const).map(period => (
                                        <button
                                            key={period}
                                            onClick={() => setRollingPeriod(period)}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${rollingPeriod === period
                                                ? 'bg-emerald-500 text-white'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            {period === 'day' ? 'Dag' : period === 'week' ? 'Vecka' : 'Månad'}
                                        </button>
                                    ))}
                                </div>
                                {(selectedStartDate || selectedEndDate) && (
                                    <button
                                        onClick={() => { setSelectedStartDate(null); setSelectedEndDate(null); }}
                                        className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-full"
                                    >
                                        ✕ Rensa
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">💡 Klicka på en punkt eller dra i brushen nedan för tidsval. Streckad linje visar din faktiska högsta vikt.</p>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartDataWithRolling}
                                    onMouseDown={(e) => {
                                        if (e?.activeLabel) {
                                            setSelectedStartDate(e.activeLabel);
                                            setSelectedEndDate(null);
                                            setIsSelecting(true);
                                        }
                                    }}
                                    onMouseMove={(e) => {
                                        if (isSelecting && e?.activeLabel) {
                                            setSelectedEndDate(e.activeLabel);
                                        }
                                    }}
                                    onMouseUp={() => {
                                        setIsSelecting(false);
                                        if (!selectedEndDate && selectedStartDate) {
                                            setSelectedEndDate(selectedStartDate);
                                        }
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                        tickFormatter={(val) => val.slice(5)}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#10b981"
                                        tick={{ fill: '#10b981', fontSize: 10 }}
                                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#f59e0b"
                                        tick={{ fill: '#f59e0b', fontSize: 10 }}
                                        tickFormatter={(val) => `${val}kg`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(val: number, name: string, props: any) => {
                                            if (name === 'load') return [`${Math.round(val)} kg`, '📊 Volym'];
                                            if (name === 'maxWeight') {
                                                const payload = props.payload;
                                                const maxWeightEx = payload?.maxWeightExercise;
                                                const maxWeightOrig = payload?.maxWeightOriginal;
                                                const isWeightPB = payload?.isWeightPB;

                                                let valueStr = `${val} kg`;
                                                if (isWeightPB) valueStr += ' 🏆';

                                                if (maxWeightEx && !selectedExercise && isWeightPB) {
                                                    return [`${maxWeightEx}: ${maxWeightOrig}kg (vikt) → ${val}kg (vikt-PB) 🏆`, '🏆 PB'];
                                                }
                                                return [valueStr, '🏋️ Högsta vikt'];
                                            }
                                            if (name === 'e1rm') {
                                                const payload = props.payload;
                                                const isE1RMPB = payload?.isPB;
                                                const isWeightPB = payload?.isWeightPB;
                                                const isActual = payload?.isActual1RM;
                                                const exName = payload?.pbExerciseName;
                                                const repsCount = payload?.pbReps;
                                                const wLifted = payload?.pbWeight;
                                                const maxWeightEx = payload?.maxWeightExercise;
                                                const maxWeightOriginal = payload?.maxWeightOriginal;

                                                let label = isActual ? '💪 1RM' : '💪 e1RM';
                                                let valueStr = `${Math.round(val)} kg`;

                                                if (isE1RMPB) {
                                                    valueStr += ' 🏆';
                                                    if (exName && !selectedExercise) {
                                                        const pbType = isActual ? '1RM' : 'e1RM';
                                                        valueStr = `${exName}: ${repsCount}×${wLifted}kg → ${Math.round(val)}kg (${pbType}) 🏆`;
                                                        label = '🏆 PB';
                                                    }
                                                }

                                                return [valueStr, label];
                                            }
                                            return [val, name];
                                        }}
                                        labelFormatter={(label) => `📅 ${label}`}
                                    />
                                    <Legend
                                        wrapperStyle={{ paddingTop: 10 }}
                                        formatter={(value) => {
                                            if (value === 'load') return 'Volym';
                                            if (value === 'e1rm') return '1RM / e1RM';
                                            if (value === 'maxWeight') return 'Max vikt';
                                            return value;
                                        }}
                                    />
                                    {selectedStartDate && selectedEndDate && (
                                        <ReferenceArea
                                            x1={selectedStartDate <= selectedEndDate ? selectedStartDate : selectedEndDate}
                                            x2={selectedStartDate <= selectedEndDate ? selectedEndDate : selectedStartDate}
                                            fill="#10b981"
                                            fillOpacity={0.2}
                                            stroke="#10b981"
                                            strokeOpacity={0.5}
                                        />
                                    )}
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="load"
                                        stroke="#10b981"
                                        strokeWidth={1.5}
                                        dot={{ r: 2, fill: '#10b981' }}
                                        activeDot={{ r: 5, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                                        name="load"
                                    />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="maxWeight"
                                        stroke="#6366f1"
                                        strokeWidth={1.5}
                                        strokeDasharray="5 5"
                                        dot={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (payload?.isWeightPB && !payload?.isPB) {
                                                return <circle key={`wpt-${payload.date}`} cx={cx} cy={cy} r={4} fill="#6366f1" stroke="#fff" strokeWidth={1} />;
                                            }
                                            return <g key={`nd-${payload?.date || 'x'}`} />;
                                        }}
                                        name="maxWeight"
                                    />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="e1rm"
                                        stroke="#f59e0b"
                                        strokeWidth={2.5}
                                        name="e1rm"
                                        dot={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (payload?.isPB) {
                                                return (
                                                    <g key={`pb-${payload.date}`}>
                                                        <circle cx={cx} cy={cy} r={10} fill="#f59e0b" stroke="#0f172a" strokeWidth={2} />
                                                        <text x={cx} y={cy - 1} textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontSize={8} fontWeight="bold">
                                                            {payload.pbReps}r
                                                        </text>
                                                        <text x={cx} y={cy - 18} textAnchor="middle" fill="#f59e0b" fontSize={8} fontWeight="bold">
                                                            PB
                                                        </text>
                                                    </g>
                                                );
                                            }
                                            if (!payload?.e1rm) return <g key={`empty-${payload?.date || 'x'}`} />;
                                            return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={2} fill="#f59e0b" />;
                                        }}
                                        activeDot={{ r: 6, fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2 }}
                                    />
                                    <Brush
                                        dataKey="date"
                                        height={30}
                                        stroke="#10b981"
                                        fill="#1e293b"
                                        tickFormatter={(val) => val.slice(5)}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Max Weight Bar Chart */}
                    <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-2">🏋️ Max vikt per pass</h2>
                        <p className="text-xs text-slate-500 mb-4">Visar den tyngsta vikten du kört varje träningsdag</p>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartDataWithRolling}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 9 }}
                                        tickFormatter={(val) => val.slice(5)}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                        tickFormatter={(val) => `${val}kg`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                        formatter={(val: number) => [`${val} kg`, 'Max vikt']}
                                        labelFormatter={(label) => `📅 ${label}`}
                                    />
                                    <Bar
                                        dataKey="maxWeight"
                                        fill="#6366f1"
                                        radius={[4, 4, 0, 0]}
                                        name="Max vikt"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Selected Range Drill-Down Panel */}
                    {selectedRangeData && (
                        <div className="bg-slate-900 p-6 rounded-3xl border border-emerald-500/30 shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        📊 {selectedRangeData.isSingleDay ? 'Dag' : 'Period'}:
                                        <span className="text-emerald-400 font-mono">
                                            {selectedRangeData.isSingleDay
                                                ? selectedRangeData.fromDate
                                                : `${selectedRangeData.fromDate} → ${selectedRangeData.toDate}`
                                            }
                                        </span>
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {selectedRangeData.datesInRange.length} träningsdagar •
                                        {selectedRangeData.totalSets} set •
                                        {(selectedRangeData.totalVolume / 1000).toFixed(1)} ton volym
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {selectedRangeData.exercises.map((exercise, idx) => (
                                    <div key={idx} className="bg-slate-800/50 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${exercise.role === 'primary' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    exercise.role === 'target' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-slate-600/50 text-slate-400'
                                                    }`}>
                                                    {exercise.role === 'primary' ? 'P' : exercise.role === 'target' ? 'T' : 'S'}
                                                </span>
                                                <h3 className="font-bold text-white">{exercise.name}</h3>
                                            </div>
                                            <span className="text-sm text-slate-400">{exercise.sets.length} set</span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-slate-500 uppercase">
                                                        <th className="text-left py-1 pr-4">Datum</th>
                                                        <th className="text-right py-1 pr-4">Vikt</th>
                                                        <th className="text-right py-1 pr-4">Reps</th>
                                                        <th className="text-right py-1 pr-4">Vol</th>
                                                        <th className="text-right py-1">e1RM</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {exercise.sets.map((set, setIdx) => (
                                                        <tr key={setIdx} className="text-white border-t border-white/5 hover:bg-slate-700/30">
                                                            <td className="py-1.5 pr-4">
                                                                {set.workoutId ? (
                                                                    <button
                                                                        onClick={() => navigate(`/training/strength/${set.workoutId}`)}
                                                                        className="text-blue-400 hover:text-blue-300 underline font-mono"
                                                                    >
                                                                        {set.date.slice(5)} →
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => navigate(`/training?date=${set.date}`)}
                                                                        className="text-slate-400 hover:text-white font-mono"
                                                                    >
                                                                        {set.date.slice(5)}
                                                                    </button>
                                                                )}
                                                            </td>
                                                            <td className="text-right py-1.5 pr-4 font-bold">{set.weight}kg</td>
                                                            <td className="text-right py-1.5 pr-4">{set.reps}</td>
                                                            <td className="text-right py-1.5 pr-4 text-slate-400">{Math.round(set.volume)}kg</td>
                                                            <td className="text-right py-1.5 text-emerald-400 font-bold">{set.e1rm}kg</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}

                                {selectedRangeData.exercises.length === 0 && (
                                    <div className="text-center text-slate-500 py-8">
                                        Ingen matchande träning hittades för denna period.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Intensity Histogram */}
                    <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-2">Intensitetsfördelning</h2>
                        <p className="text-sm text-slate-400 mb-6">
                            Hur nära ditt "tillfälliga max" (6 mån rullande) du har tränat.
                            <br /><span className="text-xs opacity-70">*Baserat på sets där e1RM kan beräknas.</span>
                        </p>

                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.intensityData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis
                                        dataKey="range"
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#ffffff05' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Bar dataKey="sets" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Antal Set" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
