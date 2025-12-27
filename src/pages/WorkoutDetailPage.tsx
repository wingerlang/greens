import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ALL_WORKOUTS } from '../data/workouts/index.ts';
import { WorkoutAnalyzer } from '../components/workouts/WorkoutAnalyzer.tsx';

export function WorkoutDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const workout = useMemo(() => {
        // In a real app, this would fetch from DB or Context
        // For now, we search ALL_WORKOUTS + Local Storage simulation
        return ALL_WORKOUTS.find(w => w.id === id);
    }, [id]);

    if (!workout) {
        return (
            <div className="flex h-screen items-center justify-center text-slate-500">
                Workout not found.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-32">
            {/* HERO HEADER */}
            <div className="relative h-64 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-slate-950"></div>
                <div className="absolute inset-x-0 bottom-0 p-8 max-w-5xl mx-auto">
                    <button onClick={() => navigate('/workouts')} className="text-slate-400 hover:text-white text-sm font-bold mb-4 uppercase tracking-widest">
                        ← Back to Library
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{workout.category}</span>
                        <span className="bg-slate-800 text-slate-400 border border-white/5 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{workout.difficulty}</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">{workout.title}</h1>
                    <p className="text-slate-400 max-w-2xl text-lg">{workout.description}</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-3 gap-12">

                {/* LEFT: ROUTINE */}
                <div className="lg:col-span-2 space-y-8">

                    {/* ACTION BAR */}
                    <div className="flex gap-4">
                        <button className="flex-1 bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-slate-200 transition-colors shadow-lg shadow-white/10 flex items-center justify-center gap-2">
                            <span>▶</span> Start Session
                        </button>
                        <button
                            onClick={() => navigate(`/workouts/builder?edit=${workout.id}`)}
                            className="bg-slate-800 text-white font-bold uppercase tracking-widest py-4 px-6 rounded-xl hover:bg-slate-700 transition-colors border border-white/5"
                        >
                            Edit
                        </button>
                    </div>

                    {/* SECTIONS */}
                    <div className="space-y-6">
                        {workout.exercises ? (
                            workout.exercises.map((section, idx) => (
                                <div key={section.id || idx} className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                                    <h3 className="text-xl font-black text-white italic mb-4">{section.title}</h3>
                                    <div className="space-y-4">
                                        {section.exercises.map((ex, i) => (
                                            <div key={ex.id || i} className="flex items-center gap-4 group">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-500 border border-white/5 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-colors">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors">{ex.name}</div>
                                                    <div className="flex gap-4 text-xs font-mono text-slate-500">
                                                        <span>{ex.sets} sets</span>
                                                        <span>x</span>
                                                        <span>{ex.reps} reps</span>
                                                        {ex.weight && <span className="text-indigo-400">@ {ex.weight}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            // Fallback for Legacy/Static Workouts
                            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                                <p className="text-slate-500 italic">Static structure defined. (Legacy format)</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
                                    {workout.staticStructure?.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: INTELLIGENCE */}
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-1 shadow-2xl shadow-indigo-500/5">
                        <div className="bg-slate-950/50 rounded-xl p-4 mb-1">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Workout Intelligence</h3>
                            <WorkoutAnalyzer workout={workout} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
