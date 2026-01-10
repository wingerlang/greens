import React, { useState, useEffect } from 'react';
import { ExerciseType, ExerciseIntensity, ExerciseSubType } from '../../models/types.ts';
import { useNavigate } from 'react-router-dom';

const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
    { type: 'running', icon: '🏃', label: 'Löpning' },
    { type: 'cycling', icon: '🚴', label: 'Cykling' },
    { type: 'strength', icon: '🏋️', label: 'Styrka' },
    { type: 'walking', icon: '🚶', label: 'Promenad' },
    { type: 'swimming', icon: '🏊', label: 'Simning' },
    { type: 'yoga', icon: '🧘', label: 'Yoga' },
    { type: 'other', icon: '✨', label: 'Annat' },
];

const INTENSITIES: { value: ExerciseIntensity; label: string; color: string }[] = [
    { value: 'low', label: 'Låg', color: 'text-slate-400' },
    { value: 'moderate', label: 'Medel', color: 'text-emerald-400' },
    { value: 'high', label: 'Hög', color: 'text-rose-400' },
    { value: 'ultra', label: 'Max', color: 'text-purple-400' },
];

interface ExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
    smartInput: string;
    setSmartInput: (val: string) => void;
    effectiveExerciseType: ExerciseType;
    effectiveDuration: string;
    effectiveIntensity: ExerciseIntensity;
    exerciseForm: {
        type: ExerciseType;
        duration: string;
        intensity: ExerciseIntensity;
        notes: string;
        subType?: ExerciseSubType;
        tonnage?: string;
        distance?: string;
    };
    setExerciseForm: (val: any) => void;
    calculateCalories: (type: ExerciseType, duration: number, intensity: ExerciseIntensity) => number;
    isEditing?: boolean;
    onDelete?: () => void;
    activityId?: string | null;
}

export function ExerciseModal({
    isOpen,
    onClose,
    onSave,
    smartInput,
    setSmartInput,
    effectiveExerciseType,
    effectiveDuration,
    effectiveIntensity,
    exerciseForm,
    setExerciseForm,
    calculateCalories,
    isEditing,
    onDelete,
    activityId
}: ExerciseModalProps) {
    const navigate = useNavigate();

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2>{isEditing ? 'Redigera Träning' : 'Logga Träning'}</h2>
                    <button className="text-slate-500 hover:text-white" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={onSave} className="space-y-6">
                    {/* Smart Input field */}
                    <div className="input-group">
                        <label className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                            <span>🪄 Snabb-input</span>
                            <span className="text-[10px] text-slate-500 lowercase font-normal italic">t.ex. "30min löpning hög"</span>
                        </label>
                        <input
                            type="text"
                            value={smartInput}
                            onChange={(e) => setSmartInput(e.target.value)}
                            placeholder="Beskriv passet här..."
                            className="w-full bg-slate-950/50 border border-emerald-500/20 rounded-2xl p-4 text-white focus:border-emerald-500/50 transition-all outline-none"
                            autoFocus
                        />
                    </div>

                    {/* Derived Preview Tooltip-like area */}
                    {smartInput && (
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.icon}</span>
                                <div>
                                    <div className="text-xs font-bold text-slate-200">
                                        {EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.label}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {effectiveDuration} min • {INTENSITIES.find(i => i.value === effectiveIntensity)?.label} intensitet
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-emerald-400">-{calculateCalories(effectiveExerciseType, parseInt(effectiveDuration) || 0, effectiveIntensity)} kcal</div>
                                <div className="text-[10px] text-slate-500 italic">beräknat</div>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-white/5 pt-4 my-2" />

                    <div className="grid grid-cols-4 gap-2">
                        {EXERCISE_TYPES.map(t => (
                            <button
                                key={t.type}
                                type="button"
                                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${effectiveExerciseType === t.type ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-white/5 text-slate-400 opacity-60 hover:opacity-100'}`}
                                onClick={() => {
                                    setExerciseForm({ ...exerciseForm, type: t.type });
                                    setSmartInput(''); // Clear smart input if manually choosing
                                }}
                            >
                                <span className="text-xl">{t.icon}</span>
                                <span className="text-[10px] font-bold">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className={`grid ${['running', 'cycling', 'walking', 'swimming'].includes(effectiveExerciseType) ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                        <div className="input-group">
                            <label>Längd (min)</label>
                            <input
                                type="number"
                                value={effectiveDuration}
                                onChange={e => {
                                    setExerciseForm({ ...exerciseForm, duration: e.target.value });
                                    setSmartInput('');
                                }}
                                className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white"
                            />
                        </div>
                        {['running', 'cycling', 'walking', 'swimming'].includes(effectiveExerciseType) && (
                            <div className="input-group">
                                <label>Distans (km)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="-"
                                    value={exerciseForm.distance || ''}
                                    onChange={e => {
                                        setExerciseForm({ ...exerciseForm, distance: e.target.value });
                                        setSmartInput('');
                                    }}
                                    className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white border-emerald-500/20 focus:border-emerald-500/50"
                                />
                            </div>
                        )}
                        <div className="input-group">
                            <label>Intensitet</label>
                            <select
                                value={effectiveIntensity}
                                onChange={e => {
                                    setExerciseForm({ ...exerciseForm, intensity: e.target.value as ExerciseIntensity });
                                    setSmartInput('');
                                }}
                                className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none h-[46px]"
                            >
                                {INTENSITIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Advanced Metrics Row (Conditional) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="input-group">
                            <label>Kategori</label>
                            <select
                                value={exerciseForm.subType || 'default'}
                                onChange={e => setExerciseForm({ ...exerciseForm, subType: e.target.value as ExerciseSubType })}
                                className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none text-xs h-[46px]"
                            >
                                <option value="default">Standard</option>
                                <option value="interval">Intervaller</option>
                                <option value="long-run">Långpass</option>
                                <option value="race">Tävling</option>
                                <option value="tonnage">Styrka (Tonnage)</option>
                                <option value="competition">Tävlingsmoment</option>
                            </select>
                        </div>

                        {effectiveExerciseType === 'strength' && (
                            <div className="input-group">
                                <label>Tonnage (kg)</label>
                                <input
                                    type="number"
                                    placeholder="-"
                                    value={exerciseForm.tonnage || ''}
                                    onChange={e => setExerciseForm({ ...exerciseForm, tonnage: e.target.value })}
                                    className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white text-xs"
                                />
                            </div>
                        )}
                    </div>

                    <div className="input-group">
                        <label>Anteckningar (valfritt)</label>
                        <textarea
                            rows={2}
                            value={exerciseForm.notes}
                            onChange={e => setExerciseForm({ ...exerciseForm, notes: e.target.value })}
                            className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        {isEditing && (
                            <>
                                <button
                                    type="button"
                                    className="btn bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white"
                                    onClick={() => {
                                        if (confirm('Ta bort detta pass?')) onDelete?.();
                                    }}
                                >
                                    Radera
                                </button>
                                {activityId && (
                                    <button
                                        type="button"
                                        className="btn bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                                        onClick={() => {
                                            onClose();
                                            navigate(`/workouts/builder?fromActivity=${activityId}`);
                                        }}
                                    >
                                        Skapa Pass
                                    </button>
                                )}
                            </>
                        )}
                        <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Avbryt</button>
                        <button type="submit" className="btn btn-primary flex-1">{isEditing ? 'Spara Ändringar' : 'Spara Träning'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export { EXERCISE_TYPES, INTENSITIES };
