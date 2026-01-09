import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from '../../components/Layout';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { calculateEffectiveLoad, generateLoadInsights } from '../../utils/loadAnalysis.ts';
import { WeeklyLoadData } from '../../models/loadAnalysisTypes.ts';
import { ExerciseMapperModule } from '../../components/admin/ExerciseMapperModule';
import { GRANULAR_MUSCLES, MUSCLE_DISPLAY_NAMES } from '../../data/muscleList.ts';
import { MuscleGroup } from '../../models/strengthTypes.ts';

export default function ToolsLoadAnalysisPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [rawData, setRawData] = useState<any[]>([]); // StrengthSessions
    const [mappings, setMappings] = useState<Record<string, MuscleGroup>>({});
    const [unmapped, setUnmapped] = useState<string[]>([]);

    // Filters
    const [selectedMuscle, setSelectedMuscle] = useState<string>('');
    const [selectedExercise, setSelectedExercise] = useState<string>('');
    const [showAdmin, setShowAdmin] = useState(false);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Sessions
                const sessionsRes = await fetch('/api/strength/workouts');
                const sessionsJson = await sessionsRes.json();

                // Fetch Mappings
                const mapRes = await fetch('/api/exercises/map');
                const mapJson = await mapRes.json();

                if (sessionsJson && Array.isArray(sessionsJson.workouts)) {
                    setRawData(sessionsJson.workouts);
                }

                if (mapJson) {
                    setMappings(mapJson.mappings || {});
                    setUnmapped(mapJson.unmapped || []);
                }

            } catch (err) {
                console.error("Failed to fetch data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user]);

    // Derived Data: Available Exercises (filtered by muscle if selected)
    const availableExercises = useMemo(() => {
        const unique = new Set<string>();
        // Iterate mappings to find exercises that match the selected muscle
        // Or iterate rawData to find exercises used
        Object.entries(mappings).forEach(([name, muscle]) => {
            if (!selectedMuscle || muscle === selectedMuscle) {
                // We store normalized keys in mappings, but we might want display names?
                // The API unmapped logic returns display names.
                // But mappings key is normalized.
                // Let's rely on rawData for display names
            }
        });

        // Better: Scan rawData, normalize name, check mapping
        rawData.forEach(session => {
            session.exercises.forEach((ex: any) => {
                const norm = ex.exerciseName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ''); // Naive norm
                const muscle = mappings[norm];

                if (!selectedMuscle || muscle === selectedMuscle) {
                    unique.add(ex.exerciseName);
                }
            });
        });

        return Array.from(unique).sort();
    }, [rawData, mappings, selectedMuscle]);

    // Analysis Calculation
    const analysisResult = useMemo(() => {
        if (!rawData.length) return [];

        return calculateEffectiveLoad(
            rawData,
            mappings,
            {
                muscle: selectedMuscle || undefined,
                exercise: selectedExercise || undefined
            }
        );
    }, [rawData, mappings, selectedMuscle, selectedExercise]);

    // Insights
    const insight = useMemo(() => generateLoadInsights(analysisResult), [analysisResult]);

    // Save Mapping Handler
    const handleSaveMapping = async (name: string, muscle: MuscleGroup) => {
        try {
            const res = await fetch('/api/exercises/map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exerciseName: name, muscleGroup: muscle })
            });

            if (res.ok) {
                // Optimistic update
                const normalized = name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
                setMappings(prev => ({ ...prev, [normalized]: muscle }));
                setUnmapped(prev => prev.filter(u => u !== name));
            }
        } catch (err) {
            console.error("Failed to save mapping", err);
        }
    };

    if (isLoading) {
        return (
            <Layout title="Laddar data...">
                <div className="flex justify-center items-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Belastningsanalys">
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">Smart Belastning</h1>
                        <p className="text-slate-400 max-w-xl">
                            Analysera din "Effective Volume" – set som faktiskt räknas.
                            Vi filtrerar bort uppvärmning och jämför din volym mot din styrkeutveckling.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAdmin(!showAdmin)}
                        className="text-xs font-bold text-slate-500 hover:text-white border border-slate-700 rounded-full px-3 py-1 transition-colors"
                    >
                        {showAdmin ? 'Dölj Admin' : 'Hantera Övningar'} {unmapped.length > 0 && <span className="text-rose-500">•</span>}
                    </button>
                </div>

                {/* Admin Module */}
                {showAdmin && (
                    <div className="animate-slide-down">
                        <ExerciseMapperModule unmapped={unmapped} onSave={handleSaveMapping} />
                    </div>
                )}

                {/* Filters */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Muskelgrupp</label>
                        <select
                            value={selectedMuscle}
                            onChange={e => { setSelectedMuscle(e.target.value); setSelectedExercise(''); }}
                            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700"
                        >
                            <option value="">Alla muskler</option>
                            {GRANULAR_MUSCLES.map(m => (
                                <option key={m} value={m}>{MUSCLE_DISPLAY_NAMES[m]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Specifik Övning</label>
                        <select
                            value={selectedExercise}
                            onChange={e => setSelectedExercise(e.target.value)}
                            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700"
                            disabled={availableExercises.length === 0}
                        >
                            <option value="">
                                {selectedMuscle ? 'Alla övningar för ' + MUSCLE_DISPLAY_NAMES[selectedMuscle as MuscleGroup] : 'Alla övningar'}
                            </option>
                            {availableExercises.map(ex => (
                                <option key={ex} value={ex}>{ex}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Main Graph */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white">Volym vs Styrka</h3>
                            <p className="text-sm text-slate-500">Staplar = Effektiva Set (>75%), Linje = e1RM Trend</p>
                        </div>
                        {selectedExercise && (
                            <div className="text-right">
                                <span className="text-xs text-slate-500 block uppercase tracking-wider">Vald Övning</span>
                                <span className="text-lg font-bold text-blue-400">{selectedExercise}</span>
                            </div>
                        )}
                    </div>

                    <div className="h-[400px] w-full">
                        {analysisResult.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={analysisResult}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis
                                        dataKey="week"
                                        stroke="#64748b"
                                        tick={{fill: '#64748b', fontSize: 12}}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    {/* Left Axis: Volume */}
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#38bdf8"
                                        tick={{fill: '#38bdf8', fontSize: 12}}
                                        axisLine={false}
                                        tickLine={false}
                                        label={{ value: 'Effektiva Set', angle: -90, position: 'insideLeft', fill: '#38bdf8', fontSize: 10 }}
                                    />
                                    {/* Right Axis: Strength */}
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#f472b6"
                                        tick={{fill: '#f472b6', fontSize: 12}}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                        label={{ value: 'e1RM (kg)', angle: 90, position: 'insideRight', fill: '#f472b6', fontSize: 10 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        formatter={(value: number, name: string) => {
                                            if (name === 'effectiveSets') return [value, 'Effektiva Set'];
                                            if (name === 'maxE1RM') return [`${value} kg`, 'Toppstyrka (e1RM)'];
                                            return [value, name];
                                        }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                                    />
                                    <Bar
                                        yAxisId="left"
                                        dataKey="effectiveSets"
                                        fill="#38bdf8"
                                        radius={[4, 4, 0, 0]}
                                        barSize={20}
                                        fillOpacity={0.6}
                                    />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="maxE1RM"
                                        stroke="#f472b6"
                                        strokeWidth={3}
                                        dot={{r: 4, fill: '#f472b6', strokeWidth: 0}}
                                        activeDot={{r: 6, strokeWidth: 0}}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col justify-center items-center text-slate-500">
                                <span className="text-4xl mb-4">📊</span>
                                <p>Ingen data för vald period/övning.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Insight Panel */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-${insight.color.replace('text-', '')} to-transparent opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none`}></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-2xl">🤖</span>
                            <h3 className={`text-xl font-bold ${insight.color}`}>{insight.title}</h3>
                        </div>
                        <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">
                            {insight.message}
                        </p>

                        <div className="mt-6 flex gap-4 text-xs text-slate-500">
                             <div className="bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                                Analys baserad på senaste 4 veckorna
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
