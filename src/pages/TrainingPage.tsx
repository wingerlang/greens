import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type ExerciseType,
    type ExerciseIntensity,
    getISODate,
    WEEKDAY_LABELS
} from '../models/types.ts';
import './TrainingPage.css';

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

export function TrainingPage() {
    const {
        exerciseEntries,
        weightEntries,
        addExercise,
        deleteExercise,
        addWeightEntry,
        getLatestWeight,
        calculateExerciseCalories,
        calculateBMR,
    } = useData();

    const { settings, updateSettings } = useSettings();

    const [selectedDate, setSelectedDate] = useState(getISODate());
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

    const [smartInput, setSmartInput] = useState('');
    const [weightInput, setWeightInput] = useState(getLatestWeight().toString());
    const [exerciseForm, setExerciseForm] = useState<{
        type: ExerciseType;
        duration: string;
        intensity: ExerciseIntensity;
        notes: string;
    }>({
        type: 'running',
        duration: '30',
        intensity: 'moderate',
        notes: ''
    });

    // ESC key support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsExerciseModalOpen(false);
                setIsWeightModalOpen(false);
            }
        };
        if (isExerciseModalOpen || isWeightModalOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExerciseModalOpen, isWeightModalOpen]);

    const parsedSmartInput = useMemo(() => {
        if (!smartInput) return null;
        const lower = smartInput.toLowerCase();

        // Type
        let type: ExerciseType | null = null;
        if (lower.includes('lö') || lower.includes('run')) type = 'running';
        else if (lower.includes('cy') || lower.includes('bik')) type = 'cycling';
        else if (lower.includes('st') || lower.includes('gym') || lower.includes('lyft')) type = 'strength';
        else if (lower.includes('ga') || lower.includes('prom') || lower.includes('walk')) type = 'walking';
        else if (lower.includes('si') || lower.includes('swi')) type = 'swimming';
        else if (lower.includes('yo')) type = 'yoga';

        // Duration
        const durationMatch = lower.match(/(\d+)\s*(min|h|t|m)?/);
        let duration: number | null = null;
        if (durationMatch) {
            duration = parseInt(durationMatch[1]);
            const unit = durationMatch[2];
            if (unit === 'h' || unit === 't') duration *= 60;
        }

        // Intensity
        let intensity: ExerciseIntensity | null = null;
        if (lower.includes('lätt') || lower.includes('låg') || lower.includes('slow')) intensity = 'low';
        else if (lower.includes('hög') || lower.includes('hårt') || lower.includes('hard') || lower.includes('tuff')) intensity = 'high';
        else if (lower.includes('max') || lower.includes('ultra')) intensity = 'ultra';
        else if (lower.includes('med') || lower.includes('norm')) intensity = 'moderate';

        return { type, duration, intensity };
    }, [smartInput]);

    // Derived states for form
    const effectiveExerciseType = parsedSmartInput?.type || exerciseForm.type;
    const effectiveDuration = parsedSmartInput?.duration?.toString() || exerciseForm.duration;
    const effectiveIntensity = parsedSmartInput?.intensity || exerciseForm.intensity;

    const dailyExercises = useMemo(() =>
        exerciseEntries.filter(e => e.date === selectedDate),
        [exerciseEntries, selectedDate]);

    const dailyBurned = useMemo(() =>
        dailyExercises.reduce((sum, e) => sum + e.caloriesBurned, 0),
        [dailyExercises]);

    const bmr = calculateBMR();
    const goalAdjustment = settings.trainingGoal === 'deff' ? -500 : settings.trainingGoal === 'bulk' ? 500 : 0;
    const tdee = bmr + dailyBurned + goalAdjustment;

    const handleAddExercise = (e: React.FormEvent) => {
        e.preventDefault();
        const duration = parseInt(effectiveDuration) || 0;
        const caloriesBurned = calculateExerciseCalories(effectiveExerciseType, duration, effectiveIntensity);

        addExercise({
            date: selectedDate,
            type: effectiveExerciseType,
            durationMinutes: duration,
            intensity: effectiveIntensity,
            caloriesBurned,
            notes: exerciseForm.notes
        });

        setIsExerciseModalOpen(false);
        setExerciseForm({ ...exerciseForm, notes: '' });
        setSmartInput('');
    };

    const handleAddWeight = (e: React.FormEvent) => {
        e.preventDefault();
        const weight = parseFloat(weightInput);
        if (!isNaN(weight)) {
            addWeightEntry(weight, selectedDate);
            setIsWeightModalOpen(false);
        }
    };

    return (
        <div className="training-page">
            <header className="page-header flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <h1>Träning & Fysik</h1>
                    <p className="page-subtitle">Optimera din förbränning och följ din trend</p>
                </div>

                {/* Permanent Smart Input Header */}
                <div className="flex-1 max-w-xl w-full">
                    <div className="relative group">
                        <div className="absolute -top-6 left-0 flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Snabb-logga pass</span>
                            <span className="text-[9px] text-slate-500 italic lowercase">t.ex. "45min löpning hög"</span>
                        </div>
                        <input
                            type="text"
                            value={smartInput}
                            onChange={(e) => setSmartInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && smartInput && handleAddExercise(e as any)}
                            placeholder="Vad har du tränat idag?"
                            className="w-full bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 text-white focus:border-emerald-500/30 transition-all outline-none shadow-2xl"
                        />
                        {smartInput && (
                            <button
                                onClick={handleAddExercise}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-slate-950 text-[10px] font-black px-4 py-2 rounded-xl hover:bg-emerald-400 transition-colors"
                            >
                                LOGGA
                            </button>
                        )}

                        {/* Inline Preview */}
                        {smartInput && (
                            <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.icon}</span>
                                    <div>
                                        <div className="text-[10px] font-black text-white">{EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.label}</div>
                                        <div className="text-[9px] text-slate-500">{effectiveDuration} min • {INTENSITIES.find(i => i.value === effectiveIntensity)?.label}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-emerald-400">-{calculateExerciseCalories(effectiveExerciseType, parseInt(effectiveDuration) || 0, effectiveIntensity)} kcal</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button className="btn btn-secondary !rounded-2xl" onClick={() => setIsWeightModalOpen(true)}>
                        ⚖️ Logga Vikt
                    </button>
                </div>
            </header>

            {/* Goal Selector */}
            <section className="goal-section mb-8">
                <div className="goal-cards">
                    {(['deff', 'neutral', 'bulk'] as const).map(goal => (
                        <button
                            key={goal}
                            className={`goal-card ${settings.trainingGoal === goal ? 'active' : ''}`}
                            onClick={() => updateSettings({ trainingGoal: goal })}
                        >
                            <span className="goal-icon">
                                {goal === 'deff' ? '🔥' : goal === 'neutral' ? '⚖️' : '💪'}
                            </span>
                            <div className="goal-info">
                                <span className="goal-label">{goal.toUpperCase()}</span>
                                <span className="goal-desc">
                                    {goal === 'deff' ? '-500 kcal' : goal === 'neutral' ? 'Balans' : '+500 kcal'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            <div className="training-grid">
                {/* Stats Dashboard */}
                <div className="stats-panel space-y-4">
                    <div className="stat-card premium-card">
                        <span className="stat-label">Dagens Kaloribehov</span>
                        <div className="stat-value-group">
                            <span className="stat-value text-emerald-400">{tdee}</span>
                            <span className="stat-unit">kcal</span>
                        </div>
                        <div className="stat-breakdown">
                            <span>BMR: {bmr}</span>
                            {dailyBurned > 0 && <span>+ Träning: {dailyBurned}</span>}
                            {goalAdjustment !== 0 && <span>+ Mål: {goalAdjustment}</span>}
                        </div>
                    </div>

                    {/* New Training Stats */}
                    <div className="stat-card bg-slate-900/50 border-white/5">
                        <span className="stat-label">Veckans Träning</span>
                        <div className="flex justify-between items-end mt-2">
                            <div>
                                <div className="text-lg font-black text-white">{exerciseEntries.filter(e => {
                                    const d = new Date(e.date);
                                    const now = new Date();
                                    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
                                    return d >= startOfWeek;
                                }).length} pass</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase">Denna vecka</div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black text-emerald-400">
                                    {Math.round(exerciseEntries.reduce((sum, e) => sum + e.caloriesBurned, 0) / (exerciseEntries.length || 1))}
                                </div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase">Snitt kcal/pass</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="text-[9px] text-slate-500 font-bold uppercase mb-2">Topp-aktivitet</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">
                                    {EXERCISE_TYPES.find(t => t.type === (
                                        Object.entries(exerciseEntries.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {} as Record<string, number>))
                                            .sort((a, b) => b[1] - a[1])[0]?.[0] as ExerciseType || 'other'
                                    ))?.icon}
                                </span>
                                <span className="text-xs font-bold text-white uppercase tracking-widest">
                                    {EXERCISE_TYPES.find(t => t.type === (
                                        Object.entries(exerciseEntries.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {} as Record<string, number>))
                                            .sort((a, b) => b[1] - a[1])[0]?.[0] as ExerciseType || 'other'
                                    ))?.label || 'Ingen data'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <span className="stat-label">Nuvarande Vikt</span>
                        <div className="stat-value-group">
                            <span className="stat-value">{getLatestWeight()}</span>
                            <span className="stat-unit">kg</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">Senast uppdaterad: {weightEntries[0]?.date || 'Aldrig'}</p>
                    </div>
                </div>

                {/* Log & Trends */}
                <div className="main-panel space-y-6">
                    {/* Weight Trend Placeholder (Simplified SVG) */}
                    <div className="content-card">
                        <h3 className="section-title">Viktutveckling</h3>
                        <div className="weight-chart h-48 flex items-center justify-center bg-slate-900/30 rounded-xl border border-white/5 relative overflow-hidden">
                            {weightEntries.length > 1 ? (
                                <svg className="w-full h-full p-4" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <path
                                        d={`M ${weightEntries.slice().reverse().map((w, i) => `${(i / (weightEntries.length - 1)) * 100} ${100 - ((w.weight - 60) / 40) * 100}`).join(' L ')}`}
                                        fill="none"
                                        stroke="var(--emerald-500)"
                                        strokeWidth="2"
                                        className="drop-shadow-glow"
                                    />
                                </svg>
                            ) : (
                                <span className="text-slate-500 text-sm italic">Logga mer vikt för att se trenden</span>
                            )}
                        </div>
                    </div>

                    {/* Exercise Log */}
                    <div className="content-card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="section-title">Träningsdagbok</h3>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-slate-800 border-none rounded-lg text-xs p-2 text-white"
                            />
                        </div>

                        <div className="exercise-list space-y-2">
                            {dailyExercises.length > 0 ? (
                                dailyExercises.map(ex => (
                                    <div key={ex.id} className="exercise-row p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{EXERCISE_TYPES.find(t => t.type === ex.type)?.icon}</span>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm">{EXERCISE_TYPES.find(t => t.type === ex.type)?.label}</span>
                                                    <span className={`text-[10px] font-bold uppercase ${INTENSITIES.find(i => i.value === ex.intensity)?.color}`}>
                                                        {INTENSITIES.find(i => i.value === ex.intensity)?.label}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500">{ex.durationMinutes} min • {ex.notes || 'Inga anteckningar'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-rose-400 font-bold text-sm">-{ex.caloriesBurned} kcal</span>
                                            <button
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all"
                                                onClick={() => deleteExercise(ex.id)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-600 italic text-sm">Ingen träning loggad för {selectedDate}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exercise Modal */}
            {isExerciseModalOpen && (
                <div className="modal-overlay" onClick={() => setIsExerciseModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2>Logga Träning</h2>
                            <button className="text-slate-500 hover:text-white" onClick={() => setIsExerciseModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleAddExercise} className="space-y-6">
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
                                        <div className="text-xs font-bold text-emerald-400">-{calculateExerciseCalories(effectiveExerciseType, parseInt(effectiveDuration) || 0, effectiveIntensity)} kcal</div>
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

                            <div className="grid grid-cols-2 gap-4">
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
                                <div className="input-group">
                                    <label>Intensitet</label>
                                    <select
                                        value={effectiveIntensity}
                                        onChange={e => {
                                            setExerciseForm({ ...exerciseForm, intensity: e.target.value as ExerciseIntensity });
                                            setSmartInput('');
                                        }}
                                        className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none"
                                    >
                                        {INTENSITIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                                    </select>
                                </div>
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
                                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsExerciseModalOpen(false)}>Avbryt</button>
                                <button type="submit" className="btn btn-primary flex-1">Spara Träning</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Weight Modal */}
            {isWeightModalOpen && (
                <div className="modal-overlay" onClick={() => setIsWeightModalOpen(false)}>
                    <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                        <h2>Uppdatera Vikt</h2>
                        <form onSubmit={handleAddWeight} className="space-y-4">
                            <div className="input-group">
                                <label>Vikt (kg)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weightInput}
                                        autoFocus
                                        onChange={e => setWeightInput(e.target.value)}
                                        className="w-full bg-slate-800 border-white/5 rounded-xl p-4 text-2xl font-black text-center text-white"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">KG</span>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsWeightModalOpen(false)}>Avbryt</button>
                                <button type="submit" className="btn btn-primary flex-1">Spara</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
