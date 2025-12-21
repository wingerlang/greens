import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { parseOmniboxInput } from '../../utils/nlpParser.ts';
import { type ExerciseType, type ExerciseIntensity, type MealType, MEAL_TYPE_LABELS } from '../../models/types.ts';
import './CommandCenter.css';

const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
    { type: 'running', icon: '🏃', label: 'Löpning' },
    { type: 'cycling', icon: '🚴', label: 'Cykling' },
    { type: 'strength', icon: '🏋️', label: 'Styrka' },
    { type: 'walking', icon: '🚶', label: 'Promenad' },
    { type: 'swimming', icon: '🏊', label: 'Simning' },
    { type: 'yoga', icon: '🧘', label: 'Yoga' },
    { type: 'other', icon: '✨', label: 'Annat' },
];

const INTENSITIES: { value: ExerciseIntensity; label: string }[] = [
    { value: 'low', label: 'Låg' },
    { value: 'moderate', label: 'Medel' },
    { value: 'high', label: 'Hög' },
    { value: 'ultra', label: 'Max' },
];

const VITAL_ICONS = {
    sleep: '💤',
    water: '💧',
    coffee: '☕',
    nocco: '⚡',
    energy: '🥤'
};

export function CommandCenter() {
    const {
        foodItems,
        recipes,
        addExercise,
        addMealEntry,
        addWeightEntry,
        calculateExerciseCalories,
        updateVitals,
        getVitalsForDate
    } = useData();

    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Draft states...
    const [draftType, setDraftType] = useState<ExerciseType | null>(null);
    const [draftDuration, setDraftDuration] = useState<number | null>(null);
    const [draftIntensity, setDraftIntensity] = useState<ExerciseIntensity | null>(null);
    const [draftQuantity, setDraftQuantity] = useState<number | null>(null);
    const [draftUnit, setDraftUnit] = useState<string | null>(null);
    const [draftMealType, setDraftMealType] = useState<MealType | null>(null);
    const [draftVitalType, setDraftVitalType] = useState<'sleep' | 'water' | 'coffee' | 'nocco' | 'energy' | null>(null);
    const [isManual, setIsManual] = useState(false);

    const intent = useMemo(() => parseOmniboxInput(query), [query]);

    // Update draft values from intent unless user is manually overriding
    useEffect(() => {
        if (!isManual) {
            if (intent.type === 'exercise') {
                setDraftType(intent.data.exerciseType);
                setDraftDuration(intent.data.duration);
                setDraftIntensity(intent.data.intensity);
            } else if (intent.type === 'food') {
                setDraftQuantity(intent.data.quantity || 1);
                setDraftUnit(intent.data.unit || 'g');
                setDraftMealType(intent.data.mealType || 'snack');
            } else if (intent.type === 'weight') {
                setDraftQuantity(intent.data.weight);
            } else if (intent.type === 'vitals') {
                setDraftVitalType(intent.data.vitalType);
                setDraftQuantity(intent.data.amount);
            }

            // Sync date from intent if present
            if (intent.date) {
                setSelectedDate(intent.date);
            }
        }
    }, [intent, isManual]);

    // Reset manual flag when query is empty
    useEffect(() => {
        if (!query) {
            setIsManual(false);
            setDraftType(null);
            setDraftDuration(null);
            setDraftIntensity(null);
            setDraftQuantity(null);
            setDraftUnit(null);
            setDraftMealType(null);
            setDraftVitalType(null);
        }
    }, [query]);

    const foodMatch = useMemo(() => {
        if (intent.type !== 'food') return null;
        const q = intent.data.query.toLowerCase();
        const recipeMatch = recipes.find(r => r.name.toLowerCase() === q || r.name.toLowerCase().includes(q));
        if (recipeMatch) return { type: 'recipe', item: recipeMatch };
        const foodItemMatch = foodItems.find(f => f.name.toLowerCase() === q || f.name.toLowerCase().includes(q));
        if (foodItemMatch) return { type: 'foodItem', item: foodItemMatch };
        return null;
    }, [intent, foodItems, recipes]);

    const handleAction = () => {
        const targetDate = selectedDate;

        if (intent.type === 'exercise') {
            const type = draftType || 'other';
            const duration = draftDuration || 30;
            const intensity = draftIntensity || 'moderate';
            const calories = calculateExerciseCalories(type, duration, intensity);
            addExercise({
                date: targetDate,
                type,
                durationMinutes: duration,
                intensity,
                caloriesBurned: calories
            });
            setQuery('');
        } else if (intent.type === 'weight') {
            addWeightEntry(draftQuantity || 0, targetDate);
            setQuery('');
        } else if (intent.type === 'food' && foodMatch) {
            addMealEntry({
                date: targetDate,
                mealType: draftMealType || 'snack',
                items: [{
                    type: foodMatch.type as any,
                    referenceId: foodMatch.item.id,
                    servings: draftQuantity || 1
                }]
            });
            setQuery('');
        } else if (intent.type === 'vitals' && draftVitalType) {
            const amount = draftQuantity || 0;
            const currentVitals = getVitalsForDate(targetDate);
            const updates: any = {};

            if (draftVitalType === 'sleep') {
                updates.sleep = amount;
            } else if (draftVitalType === 'water') {
                updates.water = (currentVitals.water || 0) + amount;
            } else { // coffee, nocco, energy
                updates.caffeine = (currentVitals.caffeine || 0) + amount;
                updates.water = (currentVitals.water || 0) + amount; // Counting as hydration too
            }

            updateVitals(targetDate, updates);
            setQuery('');
        }
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const isYesterday = selectedDate === new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const getDateLabel = () => {
        if (isToday) return 'Idag';
        if (isYesterday) return 'Igår';
        return selectedDate;
    };

    return (
        <div className={`command-center ${isFocused ? 'is-active' : ''}`}>
            <div className="omnibox-wrapper">
                <button
                    className={`date-picker-trigger ${!isToday ? 'active' : ''}`}
                    onClick={() => {
                        const newDate = isToday ? new Date(Date.now() - 86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                        setSelectedDate(newDate);
                    }}
                    title="Byt mellan idag/igår (eller klicka för att välja via input)"
                >
                    📅 {getDateLabel()}
                </button>
                <div className="omnibox-icon">🪄</div>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    placeholder="Logga träning, mat, kaffe eller sömn..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                />
                <div className="omnibox-shortcut">⏎ för att spara</div>
            </div>

            {query && (
                <div className="suggestion-panel animate-in fade-in slide-in-from-top-2 duration-300">
                    {intent.type === 'vitals' && (
                        <div className="suggestion-card vitals-card reflective">
                            <div className="card-header">
                                <span className="card-icon">
                                    {VITAL_ICONS[draftVitalType || 'water']}
                                </span>
                                <div className="card-title">
                                    <h3>Regga {draftVitalType === 'sleep' ? 'Sömn' : 'Vätska/Energi'}</h3>
                                    <p className="intent-summary">
                                        {draftQuantity} {draftVitalType === 'sleep' ? 'timmar' : (draftVitalType === 'coffee' ? 'koppar' : 'st')}
                                    </p>
                                </div>
                            </div>
                            <div className="reflective-inputs">
                                <div className="input-row flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step={draftVitalType === 'sleep' ? '0.5' : '1'}
                                            value={draftQuantity ?? ''}
                                            onChange={(e) => { setDraftQuantity(parseFloat(e.target.value)); setIsManual(true); }}
                                            className="reflective-field w-20"
                                        />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                                            {draftVitalType === 'sleep' ? 'Timmar' : 'Antal'}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                                        {getDateLabel()}
                                    </div>
                                </div>
                            </div>
                            <button className="confirm-btn" onClick={handleAction}>Spara {draftVitalType === 'sleep' ? 'Sömn' : 'Logg'}</button>
                        </div>
                    )}

                    {intent.type === 'exercise' && (
                        <div className="suggestion-card exercise-card reflective">
                            <div className="card-header">
                                <span className="card-icon">{EXERCISE_TYPES.find(t => t.type === draftType)?.icon || '🏃'}</span>
                                <div className="card-title">
                                    <h3>Regga träning</h3>
                                    <p className="intent-summary">{draftDuration} min {EXERCISE_TYPES.find(t => t.type === draftType)?.label}</p>
                                </div>
                            </div>

                            <div className="reflective-inputs">
                                <div className="input-row">
                                    <div className="type-chips">
                                        {EXERCISE_TYPES.map(t => (
                                            <button
                                                key={t.type}
                                                className={`chip ${draftType === t.type ? 'active' : ''}`}
                                                onClick={() => { setDraftType(t.type); setIsManual(true); }}
                                            >
                                                {t.icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="input-row">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={draftDuration || ''}
                                            onChange={(e) => { setDraftDuration(parseInt(e.target.value)); setIsManual(true); }}
                                            className="reflective-field w-16"
                                        />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Minuter</span>
                                    </div>
                                    <div className="intensity-selector">
                                        {INTENSITIES.map(i => (
                                            <button
                                                key={i.value}
                                                className={`intensity-btn ${draftIntensity === i.value ? 'active' : ''}`}
                                                onClick={() => { setDraftIntensity(i.value); setIsManual(true); }}
                                            >
                                                {i.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button className="confirm-btn" onClick={handleAction}>Spara Träning</button>
                        </div>
                    )}

                    {intent.type === 'weight' && (
                        <div className="suggestion-card weight-card reflective">
                            <div className="card-header">
                                <span className="card-icon">⚖️</span>
                                <div className="card-title">
                                    <h3>Uppdatera vikt</h3>
                                    <p>Ny vikt: <strong>{draftQuantity} kg</strong></p>
                                </div>
                            </div>
                            <div className="reflective-inputs">
                                <div className="input-row">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={draftQuantity || ''}
                                        autoFocus
                                        onChange={(e) => { setDraftQuantity(parseFloat(e.target.value)); setIsManual(true); }}
                                        className="reflective-field bigger text-center"
                                    />
                                    <span className="text-slate-400 font-bold">KG</span>
                                </div>
                            </div>
                            <button className="confirm-btn" onClick={handleAction}>Spara Vikt</button>
                        </div>
                    )}

                    {intent.type === 'food' && foodMatch && (
                        <div className="suggestion-card food-card reflective">
                            <div className="card-header">
                                <span className="card-icon">{foodMatch.type === 'recipe' ? '🍳' : '🥕'}</span>
                                <div className="card-title">
                                    <h3>Regga {MEAL_TYPE_LABELS[draftMealType || 'snack']}</h3>
                                    <p className="intent-summary">{foodMatch.item.name}</p>
                                </div>
                            </div>

                            <div className="reflective-inputs">
                                <div className="input-row">
                                    <div className="meal-type-chips">
                                        {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map(mt => (
                                            <button
                                                key={mt}
                                                className={`chip ${draftMealType === mt ? 'active' : ''}`}
                                                onClick={() => { setDraftMealType(mt); setIsManual(true); }}
                                            >
                                                {MEAL_TYPE_LABELS[mt]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="input-row flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={draftQuantity || ''}
                                            onChange={(e) => { setDraftQuantity(parseFloat(e.target.value)); setIsManual(true); }}
                                            className="reflective-field w-20"
                                        />
                                        <select
                                            value={draftUnit || 'g'}
                                            onChange={(e) => { setDraftUnit(e.target.value); setIsManual(true); }}
                                            className="reflective-select"
                                        >
                                            <option value="g">gram</option>
                                            <option value="st">st</option>
                                            <option value="port">port</option>
                                            <option value="ml">ml</option>
                                        </select>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-bold italic">
                                        {foodMatch.type === 'recipe' ? 'Hittade recept' : 'Hittade ingrediens'}
                                    </div>
                                </div>
                            </div>

                            <button className="confirm-btn" onClick={handleAction}>Logga Mat</button>
                        </div>
                    )}

                    {intent.type === 'food' && !foodMatch && (
                        <div className="suggestion-card search-card">
                            <div className="card-icon">🔍</div>
                            <div className="card-content">
                                <h3>Databas-sök</h3>
                                <p>Inget direkt svar för "{intent.data.query}"</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
