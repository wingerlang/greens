import React, { useState } from 'react';
import { RehabRoutine } from '../../models/types.ts';

interface RehabRoutineCardProps {
    routine: RehabRoutine;
    onStart?: () => void;
}

export function RehabRoutineCard({ routine, onStart }: RehabRoutineCardProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`
            bg-slate-900 border transition-all duration-300 rounded-xl overflow-hidden
            ${expanded ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'}
        `}>
            {/* Header / Summary */}
            <div
                onClick={() => setExpanded(!expanded)}
                className="p-5 cursor-pointer flex justify-between items-start gap-4"
            >
                <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                        {routine.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                {tag}
                            </span>
                        ))}
                        {routine.condition && (
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${routine.condition === 'pain' ? 'bg-rose-500/20 text-rose-400' :
                                    routine.condition === 'tightness' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-sky-500/20 text-sky-400'
                                }`}>
                                {routine.condition}
                            </span>
                        )}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{routine.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                        {routine.description}
                    </p>
                </div>

                <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-slate-500 mb-1">
                        <span className="text-lg">⏱️</span>
                        <span className="font-bold font-mono">{routine.estimatedDurationMin} min</span>
                    </div>
                    <button className={`p-2 rounded-full transition-transform duration-300 ${expanded ? 'rotate-180 bg-slate-800' : ''}`}>
                        👇
                    </button>
                </div>
            </div>

            {/* Expanded Content (Exercises) */}
            {expanded && (
                <div className="px-5 pb-5 animate-in slide-in-from-top-2 border-t border-slate-800/50 pt-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider">Övningar</h4>
                    <div className="space-y-3">
                        {routine.exercises.map((ex, i) => (
                            <div key={ex.id} className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h5 className="font-bold text-indigo-300 text-sm">{ex.name}</h5>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${ex.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-500' :
                                                ex.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                                            }`}>
                                            {ex.difficulty}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{ex.description}</p>
                                    <div className="mt-2 text-xs font-mono text-slate-500">
                                        Repeats: <span className="text-slate-300">{ex.reps}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={(e) => { e.stopPropagation(); onStart?.(); }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                        >
                            <span>▶️</span> Starta Passet
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
