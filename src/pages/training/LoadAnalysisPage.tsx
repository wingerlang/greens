import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
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

    const { stats, isLoading } = useMuscleLoadAnalysis(selectedMuscle, selectedExercise);

    const handleMuscleChange = (id: string) => {
        setSelectedMuscle(id);
        setSelectedExercise(null);
        navigate(`/training/load?muscle=${id}`);
    };

    const handleExerciseChange = (id: string) => {
        setSelectedExercise(id);
        // If exercise implies a muscle (Primary), maybe set that too?
        // Or just navigate.
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

    // Sort relevant exercises by name
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

            {/* Controls */}
            <div className="grid md:grid-cols-2 gap-4 bg-slate-900 p-4 rounded-2xl border border-white/5">
                {/* Muscle Selector */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Muskelgrupp</label>
                    <select
                        className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-emerald-500"
                        value={selectedMuscle || ''}
                        onChange={(e) => handleMuscleChange(e.target.value)}
                    >
                        <option value="">-- Välj muskel --</option>
                        {allMuscles.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.name} ({m.group})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Exercise Selector */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Specifik Övning (Valfritt)</label>
                    <select
                        className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                        value={selectedExercise || ''}
                        onChange={(e) => handleExerciseChange(e.target.value)}
                    >
                        <option value="">-- Alla övningar för muskeln --</option>
                        {relevantExercises.map(e => (
                            <option key={e.id} value={e.id}>
                                {e.name_sv}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="h-96 flex items-center justify-center text-slate-500">Laddar analys...</div>
            ) : !stats ? (
                <div className="h-96 flex items-center justify-center text-slate-500 italic">Välj en muskel eller övning för att se data.</div>
            ) : (
                <div className="space-y-8">

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
                        {/* Placeholders for trends */}
                        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 hidden md:block opacity-50">
                            <div className="text-xs text-slate-500 font-bold uppercase mb-1">Snitt/Pass</div>
                            <div className="text-2xl font-bold text-white">-</div>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 hidden md:block opacity-50">
                            <div className="text-xs text-slate-500 font-bold uppercase mb-1">Frekvens</div>
                            <div className="text-2xl font-bold text-white">-</div>
                        </div>
                    </div>

                    {/* Load Graph */}
                    <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-6">Belastning över tid (Volym)</h2>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                        tickFormatter={(val) => val.slice(5)} // Show MM-DD
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(val: number) => [`${Math.round(val)} kg`, 'Volym']}
                                        labelFormatter={(label) => label}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="load"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 6, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Intensity Histogram */}
                    <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-2">Intensitetsfördelning</h2>
                        <p className="text-sm text-slate-400 mb-6">
                            Hur nära ditt "tillfälliga max" (6 mån rullande) du har tränat.
                            <br/><span className="text-xs opacity-70">*Baserat på sets där e1RM kan beräknas.</span>
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
                                    {/* Optionally add Tonnage as a line or second bar? */}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
