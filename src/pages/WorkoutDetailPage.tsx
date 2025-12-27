import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ALL_WORKOUTS } from '../data/workouts/index.ts';
import { WorkoutAnalyzer } from '../components/workouts/WorkoutAnalyzer.tsx';
import { WorkoutComparisonView } from '../components/workouts/WorkoutComparisonView.tsx';

export function WorkoutDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'DETAILS' | 'HISTORY'>('DETAILS');

    const workout = useMemo(() => {
        return ALL_WORKOUTS.find(w => w.id === id);
    }, [id]);

    if (!workout) {
        return (
            <div className="flex h-screen items-center justify-center text-slate-500 bg-[#050510]">
                Passet kunde inte hittas.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050510] text-white pb-32 font-sans">
            {/* HERO HEADER */}
            <div className="relative h-80 overflow-hidden flex flex-col justify-end">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/10 via-slate-900/40 to-[#050510]"></div>
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full" />

                <div className="relative z-10 p-12 max-w-6xl mx-auto w-full">
                    <button onClick={() => navigate('/workouts')} className="group flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] mb-8 transition-all">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Tillbaka till biblioteket
                    </button>

                    <div className="flex items-center gap-4 mb-4">
                        <span className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                            {workout.category}
                        </span>
                        <span className="bg-white/5 text-slate-400 border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                            {workout.difficulty}
                        </span>
                    </div>

                    <h1 className="text-6xl md:text-7xl font-black italic uppercase tracking-tighter mb-4 bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
                        {workout.title}
                    </h1>
                    <p className="text-slate-400 max-w-3xl text-xl leading-relaxed font-medium">
                        {workout.description || "Ingen beskrivning tillgänglig för detta pass."}
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-12 grid grid-cols-1 lg:grid-cols-3 gap-16">

                {/* LEFT: ROUTINE */}
                <div className="lg:col-span-2 space-y-12">

                    {/* ACTION BAR */}
                    <div className="flex gap-6">
                        <button className="flex-[2] bg-white text-black font-black uppercase tracking-[0.2em] py-5 rounded-[2rem] hover:bg-slate-100 transition-all shadow-2xl shadow-white/5 flex items-center justify-center gap-3 active:scale-[0.98]">
                            <span className="text-lg">▶</span> Starta Passet
                        </button>
                        <button
                            onClick={() => navigate(`/workouts/builder?activityId=${workout.id}`)}
                            className="flex-1 bg-slate-900/50 text-white font-black uppercase tracking-[0.2em] py-5 px-8 rounded-[2rem] hover:bg-slate-800 transition-all border border-white/5 backdrop-blur-xl"
                        >
                            Redigera
                        </button>
                    </div>

                    {/* TABS */}
                    <div className="flex gap-8 border-b border-white/5">
                        {[
                            { id: 'DETAILS', label: 'Rutin & Övningar' },
                            { id: 'HISTORY', label: 'Historik & Jämförelse' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setViewMode(t.id as any)}
                                className={`text-[11px] font-black uppercase tracking-[0.2em] pb-5 border-b-2 transition-all ${viewMode === t.id ? 'text-white border-indigo-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* CONTENT */}
                    {viewMode === 'HISTORY' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <WorkoutComparisonView workout={workout} />
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {workout.exercises ? (
                                workout.exercises.map((section, idx) => (
                                    <div key={section.id || idx} className="bg-slate-900/20 border border-white/5 rounded-[2.5rem] p-10 hover:bg-slate-900/30 transition-all">
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-2xl font-black text-white italic tracking-tight">{section.title}</h3>
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sektion {idx + 1}</span>
                                        </div>
                                        <div className="space-y-6">
                                            {section.exercises.map((ex, i) => (
                                                <div key={ex.id || i} className="flex items-center gap-8 group">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-950/50 flex items-center justify-center text-xs font-black text-slate-500 border border-white/5 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-all">
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-black text-xl text-slate-200 group-hover:text-white transition-all mb-1 tracking-tight">{ex.name}</div>
                                                        <div className="flex gap-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                                            <div className="flex gap-2">
                                                                <span className="text-slate-700 font-black italic">SETS</span>
                                                                <span className="text-white">{ex.sets}</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <span className="text-slate-700 font-black italic">REPS</span>
                                                                <span className="text-white">{ex.reps}</span>
                                                            </div>
                                                            {ex.weight && (
                                                                <div className="flex gap-2">
                                                                    <span className="text-slate-700 font-black italic">LAST</span>
                                                                    <span className="text-indigo-400">{ex.weight}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-slate-900/20 border border-white/5 rounded-[2.5rem] p-10">
                                    <p className="text-slate-500 italic font-medium">Statisk struktur definierad. (Legacy format)</p>
                                    <ul className="list-none space-y-3 mt-6">
                                        {workout.staticStructure?.map((s, i) => (
                                            <li key={i} className="flex items-center gap-4 text-slate-300 font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT: INTELLIGENCE */}
                <div className="space-y-8">
                    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-4 shadow-3xl shadow-indigo-500/5 backdrop-blur-xl">
                        <div className="bg-slate-950/40 rounded-[2rem] p-2">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] p-6 pb-2">Pass-analys AI</h3>
                            <WorkoutAnalyzer workout={workout} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
