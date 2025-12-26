import React, { useState, useMemo } from 'react';
import { WorkoutDefinition } from '../../models/workout.ts';

interface Props {
    workout: WorkoutDefinition;
    onClose: () => void;
}

export function WorkoutDetailModal({ workout, onClose }: Props) {
    // Dynamic Inputs State
    const [inputs, setInputs] = useState<Record<string, number | string>>(() => {
        const defaults: Record<string, number | string> = {};
        workout.inputs?.forEach(input => {
            defaults[input.id] = input.defaultValue;
        });
        return defaults;
    });

    // Generate structure based on inputs (or use static)
    const structure = useMemo(() => {
        if (workout.generator) {
            return workout.generator(inputs);
        }
        return workout.staticStructure || [];
    }, [workout, inputs]);

    const handleInputChange = (id: string, value: string | number) => {
        setInputs(prev => ({ ...prev, [id]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>

                {/* HEADER */}
                <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-start">
                    <div>
                        <div className="flex gap-2 mb-2">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${workout.category === 'HYROX' ? 'bg-amber-500/20 text-amber-500' :
                                    workout.category === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-500' :
                                        'bg-indigo-500/20 text-indigo-500'
                                }`}>
                                {workout.category}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-0.5 border border-white/10 rounded">
                                {workout.difficulty}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">{workout.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-2xl">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-900">

                    {/* DESCRIPTION */}
                    <div>
                        <p className="text-slate-300 leading-relaxed text-sm">{workout.description}</p>
                        {workout.tips && (
                            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3">
                                <span className="text-xl">💡</span>
                                <p className="text-xs text-amber-200 mt-0.5 italic">{workout.tips}</p>
                            </div>
                        )}
                    </div>

                    {/* DYNAMIC INPUTS */}
                    {workout.inputs && workout.inputs.length > 0 && (
                        <div className="bg-slate-800/50 border border-white/5 p-4 rounded-xl space-y-4">
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span>🎛️</span> Anpassa Passet
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {workout.inputs.map(input => (
                                    <div key={input.id} className="flex flex-col gap-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 flex justify-between">
                                            {input.label}
                                            <span className="text-white">{inputs[input.id]} {input.unit}</span>
                                        </label>
                                        {input.type === 'slider' ? (
                                            <input
                                                type="range"
                                                min={input.min}
                                                max={input.max}
                                                step={input.step}
                                                value={inputs[input.id]}
                                                onChange={(e) => handleInputChange(input.id, Number(e.target.value))}
                                                className="accent-indigo-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                        ) : (
                                            <input
                                                type="number"
                                                value={inputs[input.id]}
                                                onChange={(e) => handleInputChange(input.id, Number(e.target.value))}
                                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-sm"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* WORKOUT STRUCTURE */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Passupplägg</h3>
                        <div className="space-y-2 font-mono text-sm">
                            {structure.map((line, i) => (
                                <div key={i} className="flex gap-3 items-start p-2 hover:bg-white/5 rounded transition-colors group">
                                    <span className="text-slate-600 font-bold select-none group-hover:text-slate-400">
                                        {(i + 1).toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-slate-200">{line}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                        Stäng
                    </button>
                    <button className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-emerald-500/20">
                        Spara / Logga Pass
                    </button>
                </div>
            </div>
        </div>
    );
}
