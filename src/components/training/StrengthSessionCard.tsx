import React, { useState } from 'react';
import { StrengthSession, StrengthExercise, StrengthMuscleGroup, generateId } from '../../models/types.ts';
import { formatActivityDuration } from '../../utils/formatters.ts';
import { useData } from '../../context/DataContext.tsx';

interface StrengthSessionCardProps {
    session?: StrengthSession;
    date: string;
    onSave?: (session: StrengthSession) => void;
    compact?: boolean;
}

const MUSCLE_GROUP_LABELS: Record<StrengthMuscleGroup, { label: string; emoji: string; color: string }> = {
    legs: { label: 'Ben', emoji: '🦵', color: 'text-rose-400 bg-rose-500/10' },
    core: { label: 'Core', emoji: '💪', color: 'text-amber-400 bg-amber-500/10' },
    upper: { label: 'Överkropp', emoji: '🏋️', color: 'text-blue-400 bg-blue-500/10' },
    full_body: { label: 'Helkropp', emoji: '🔥', color: 'text-violet-400 bg-violet-500/10' },
    mobility: { label: 'Rörlighet', emoji: '🧘', color: 'text-emerald-400 bg-emerald-500/10' }
};

const PRESET_WORKOUTS: { title: string; muscleGroups: StrengthMuscleGroup[]; exercises: Omit<StrengthExercise, 'id'>[] }[] = [
    {
        title: 'Benstyrka för löpare',
        muscleGroups: ['legs'],
        exercises: [
            { name: 'Knäböj', muscleGroups: ['legs'], sets: 3, reps: 10 },
            { name: 'Utfall', muscleGroups: ['legs'], sets: 3, reps: 12 },
            { name: 'Rumänsk marklyft', muscleGroups: ['legs'], sets: 3, reps: 10 },
            { name: 'Vadpress', muscleGroups: ['legs'], sets: 3, reps: 15 }
        ]
    },
    {
        title: 'Core & Stabilitet',
        muscleGroups: ['core'],
        exercises: [
            { name: 'Planka', muscleGroups: ['core'], sets: 3, reps: 60, notes: 'sekunder' },
            { name: 'Sidoplanka', muscleGroups: ['core'], sets: 2, reps: 45, notes: 'sek/sida' },
            { name: 'Dead bug', muscleGroups: ['core'], sets: 3, reps: 12 },
            { name: 'Höftlyft', muscleGroups: ['core'], sets: 3, reps: 15 }
        ]
    },
    {
        title: 'Löparstyrka helkropp',
        muscleGroups: ['full_body'],
        exercises: [
            { name: 'Goblet squat', muscleGroups: ['legs'], sets: 3, reps: 12 },
            { name: 'Push-ups', muscleGroups: ['upper'], sets: 3, reps: 15 },
            { name: 'Step-ups', muscleGroups: ['legs'], sets: 3, reps: 10 },
            { name: 'Planka', muscleGroups: ['core'], sets: 3, reps: 45, notes: 'sekunder' }
        ]
    }
];

export function StrengthSessionCard({ session, date, onSave, compact = false }: StrengthSessionCardProps) {
    const [isEditing, setIsEditing] = useState(!session);
    const [currentSession, setCurrentSession] = useState<Partial<StrengthSession>>(
        session || {
            date,
            title: '',
            muscleGroups: [],
            exercises: [],
            durationMinutes: 30,
            estimatedCalories: 150,
            source: 'manual'
        }
    );

    const handleSelectPreset = (preset: typeof PRESET_WORKOUTS[0]) => {
        setCurrentSession({
            ...currentSession,
            title: preset.title,
            muscleGroups: preset.muscleGroups,
            exercises: preset.exercises.map(e => ({ ...e, id: generateId() }))
        });
    };

    const handleSave = () => {
        if (!currentSession.title) return;
        const fullSession: StrengthSession = {
            id: session?.id || generateId(),
            date: currentSession.date || date,
            title: currentSession.title || 'Styrkepass',
            muscleGroups: currentSession.muscleGroups || [],
            exercises: currentSession.exercises || [],
            durationMinutes: currentSession.durationMinutes || 30,
            estimatedCalories: currentSession.estimatedCalories || 150,
            source: currentSession.source || 'manual'
        };
        onSave?.(fullSession);
        setIsEditing(false);
    };

    const toggleMuscleGroup = (group: StrengthMuscleGroup) => {
        const current = currentSession.muscleGroups || [];
        setCurrentSession({
            ...currentSession,
            muscleGroups: current.includes(group)
                ? current.filter(g => g !== group)
                : [...current, group]
        });
    };

    if (compact && session) {
        return (
            <div className="flex items-center gap-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="text-2xl">🏋️</div>
                <div className="flex-1">
                    <div className="text-xs font-black text-white">{session.title}</div>
                    <div className="flex gap-1 mt-1">
                        {session.muscleGroups.map(g => (
                            <span key={g} className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${MUSCLE_GROUP_LABELS[g].color}`}>
                                {MUSCLE_GROUP_LABELS[g].emoji} {MUSCLE_GROUP_LABELS[g].label}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-black text-violet-400">{session.durationMinutes}min</div>
                    <div className="text-[9px] text-slate-500">{session.estimatedCalories} kcal</div>
                </div>
            </div>
        );
    }

    return (
        <div className="strength-session-card glass-card p-4 border-violet-500/20 bg-violet-500/5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center text-xl">🏋️</div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Styrkepass</h3>
                        <p className="text-[9px] text-slate-500 font-bold">{date}</p>
                    </div>
                </div>
                {session && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="text-[9px] text-slate-500 hover:text-white uppercase font-bold">
                        Redigera
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-4">
                    {/* Presets */}
                    <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Snabbval</label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_WORKOUTS.map((preset, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSelectPreset(preset)}
                                    className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-[9px] font-bold hover:bg-violet-500/20 hover:text-violet-400 transition-all"
                                >
                                    {preset.title}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <input
                        type="text"
                        value={currentSession.title || ''}
                        onChange={e => setCurrentSession({ ...currentSession, title: e.target.value })}
                        placeholder="Namn på passet"
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-3 text-white font-bold text-sm focus:border-violet-500/50 outline-none"
                    />

                    {/* Muscle Groups */}
                    <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Muskelgrupper</label>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(MUSCLE_GROUP_LABELS) as StrengthMuscleGroup[]).map(group => (
                                <button
                                    key={group}
                                    onClick={() => toggleMuscleGroup(group)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${currentSession.muscleGroups?.includes(group)
                                        ? MUSCLE_GROUP_LABELS[group].color + ' ring-2 ring-white/20'
                                        : 'bg-slate-800 text-slate-500 hover:text-white'
                                        }`}
                                >
                                    {MUSCLE_GROUP_LABELS[group].emoji} {MUSCLE_GROUP_LABELS[group].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration & Calories */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Tid (min)</label>
                            <input
                                type="number"
                                value={currentSession.durationMinutes || 30}
                                onChange={e => setCurrentSession({ ...currentSession, durationMinutes: parseInt(e.target.value) })}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-lg p-2 text-white font-bold text-sm focus:border-violet-500/50 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Kalorier</label>
                            <input
                                type="number"
                                value={currentSession.estimatedCalories || 150}
                                onChange={e => setCurrentSession({ ...currentSession, estimatedCalories: parseInt(e.target.value) })}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-lg p-2 text-white font-bold text-sm focus:border-violet-500/50 outline-none"
                            />
                        </div>
                    </div>

                    {/* Exercises Preview */}
                    {currentSession.exercises && currentSession.exercises.length > 0 && (
                        <div className="p-3 bg-slate-900/50 rounded-xl">
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Övningar</label>
                            <ul className="space-y-1">
                                {currentSession.exercises.map((ex, i) => (
                                    <li key={i} className="text-xs text-slate-300 flex gap-2">
                                        <span className="text-slate-500">{i + 1}.</span>
                                        <span className="font-bold">{ex.name}</span>
                                        <span className="text-slate-500">{ex.sets}x{ex.reps}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Warning: Leg + Run */}
                    {currentSession.muscleGroups?.includes('legs') && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
                            <span className="text-lg">⚠️</span>
                            <div>
                                <div className="text-[10px] font-black text-rose-400 uppercase">Konfliktvarning</div>
                                <p className="text-[9px] text-slate-400">Ben-träning samma dag som löpning kan öka skaderisken.</p>
                            </div>
                        </div>
                    )}

                    {/* Save */}
                    <div className="flex justify-end gap-2 pt-2">
                        {session && (
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-500 text-[9px] font-bold uppercase">
                                Avbryt
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 bg-violet-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-violet-400 transition-all active:scale-95"
                        >
                            Spara Styrkepass
                        </button>
                    </div>
                </div>
            ) : session && (
                <div className="space-y-3">
                    <div className="text-lg font-black text-white">{session.title}</div>
                    <div className="flex flex-wrap gap-2">
                        {session.muscleGroups.map(g => (
                            <span key={g} className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg ${MUSCLE_GROUP_LABELS[g].color}`}>
                                {MUSCLE_GROUP_LABELS[g].emoji} {MUSCLE_GROUP_LABELS[g].label}
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-4 text-sm">
                        <div><span className="text-slate-500">Tid:</span> <span className="font-bold text-white">{formatActivityDuration(session.durationMinutes)}</span></div>
                        <div><span className="text-slate-500">Kcal:</span> <span className="font-bold text-violet-400">{session.estimatedCalories}</span></div>
                    </div>
                    {session.exercises.length > 0 && (
                        <ul className="space-y-1 pt-2 border-t border-white/5">
                            {session.exercises.map((ex, i) => (
                                <li key={i} className="text-xs text-slate-300 flex gap-2">
                                    <span className="text-slate-500">{i + 1}.</span>
                                    <span className="font-bold">{ex.name}</span>
                                    <span className="text-slate-500">{ex.sets}x{ex.reps}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
