import React, { useState, useEffect } from 'react';
import { ExerciseDefinition } from '../../../../models/exercise.ts';
import { MuscleHierarchy } from '../../../../models/muscle.ts';
import { MusclePicker } from './MusclePicker.tsx';

interface ExerciseEditorModalProps {
    exercise?: ExerciseDefinition; // If undefined, we are creating
    hierarchy: MuscleHierarchy | null;
    onClose: () => void;
    onSave: (exercise: ExerciseDefinition) => Promise<boolean>;
}

export const ExerciseEditorModal: React.FC<ExerciseEditorModalProps> = ({ exercise, hierarchy, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<ExerciseDefinition>>({
        id: '',
        name_en: '',
        name_sv: '',
        primaryMuscles: [],
        secondaryMuscles: [],
        aliases: []
    });

    useEffect(() => {
        if (exercise) {
            setFormData(JSON.parse(JSON.stringify(exercise)));
        } else {
            // Generate a random ID for new items
            setFormData({
                id: `ex_${Date.now()}`,
                name_en: '',
                name_sv: '',
                primaryMuscles: [],
                secondaryMuscles: [],
                aliases: []
            });
        }
    }, [exercise]);

    // Escape to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validation
        if (!formData.name_en || !formData.name_sv) {
            alert("Både engelskt och svenskt namn krävs.");
            return;
        }
        await onSave(formData as ExerciseDefinition);
        // Parent handles closing on success
    };

    // Alias handling
    const [newAlias, setNewAlias] = useState('');
    const addAlias = () => {
        if (!newAlias.trim()) return;
        const currentAliases = formData.aliases || [];
        if (!currentAliases.includes(newAlias.trim())) {
            setFormData({ ...formData, aliases: [...currentAliases, newAlias.trim()] });
        }
        setNewAlias('');
    };
    const removeAlias = (alias: string) => {
        setFormData({ ...formData, aliases: (formData.aliases || []).filter(a => a !== alias) });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-slate-900">
                    <h3 className="text-xl font-bold text-white">
                        {exercise ? 'Redigera övning' : 'Ny övning'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <span className="sr-only">Close</span>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Engelskt Namn</label>
                                <input
                                    type="text"
                                    value={formData.name_en}
                                    onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                                    placeholder="e.g. Bench Press"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Svenskt Namn</label>
                                <input
                                    type="text"
                                    value={formData.name_sv}
                                    onChange={e => setFormData({ ...formData, name_sv: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                                    placeholder="e.g. Bänkpress"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">ID (Internal)</label>
                                <input
                                    type="text"
                                    value={formData.id}
                                    readOnly={!!exercise}
                                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-slate-500 font-mono text-sm"
                                />
                            </div>

                            {/* Aliases Section */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Alias / Varianter</label>
                                <p className="text-[10px] text-slate-500 mb-2">
                                    Används för att matcha historiska pass (t.ex. "Knäböj (stång)"). Lägg till exakta namn från importen.
                                </p>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={newAlias}
                                        onChange={e => setNewAlias(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                        placeholder="Lägg till alias..."
                                    />
                                    <button
                                        type="button"
                                        onClick={addAlias}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-bold text-sm transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.aliases?.map(alias => (
                                        <span key={alias} className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-xs font-mono border border-white/5">
                                            {alias}
                                            <button
                                                type="button"
                                                onClick={() => removeAlias(alias)}
                                                className="hover:text-rose-400 ml-1 font-bold"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Muskelkarta</label>
                            <div className="bg-slate-950 rounded-xl border border-white/10 p-4 h-[400px] overflow-y-auto">
                                <MusclePicker
                                    hierarchy={hierarchy}
                                    selectedPrimary={formData.primaryMuscles || []}
                                    selectedSecondary={formData.secondaryMuscles || []}
                                    onChange={(p, s) => setFormData({ ...formData, primaryMuscles: p, secondaryMuscles: s })}
                                />
                            </div>
                        </div>
                    </div>
                </form>

                <div className="px-6 py-4 border-t border-white/5 bg-slate-900 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-900 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all"
                    >
                        Spara Övning
                    </button>
                </div>
            </div>
        </div>
    );
}
