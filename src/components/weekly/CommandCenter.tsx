import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { parseOmniboxInput, type OmniboxIntent } from '../../utils/nlpParser.ts';
import { MEAL_TYPE_LABELS, UNIT_LABELS } from '../../models/types.ts';
import './CommandCenter.css';

export function CommandCenter() {
    const {
        foodItems,
        recipes,
        addExercise,
        addMealEntry,
        addWeightEntry,
        calculateExerciseCalories,
        getLatestWeight
    } = useData();

    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const intent = useMemo(() => parseOmniboxInput(query), [query]);

    // Enhanced match logic for food/recipes
    const foodMatch = useMemo(() => {
        if (intent.type !== 'food') return null;
        const q = intent.data.query.toLowerCase();

        // Find exact or close match in recipes
        const recipeMatch = recipes.find(r => r.name.toLowerCase() === q || r.name.toLowerCase().includes(q));
        if (recipeMatch) return { type: 'recipe', item: recipeMatch };

        // Find match in food items
        const foodItemMatch = foodItems.find(f => f.name.toLowerCase() === q || f.name.toLowerCase().includes(q));
        if (foodItemMatch) return { type: 'foodItem', item: foodItemMatch };

        return null;
    }, [intent, foodItems, recipes]);

    const handleAction = () => {
        if (intent.type === 'exercise') {
            const calories = calculateExerciseCalories(
                intent.data.exerciseType,
                intent.data.duration,
                intent.data.intensity
            );
            addExercise({
                date: new Date().toISOString().split('T')[0],
                type: intent.data.exerciseType,
                durationMinutes: intent.data.duration,
                intensity: intent.data.intensity,
                caloriesBurned: calories
            });
            setQuery('');
        } else if (intent.type === 'weight') {
            addWeightEntry(intent.data.weight);
            setQuery('');
        } else if (intent.type === 'food' && foodMatch) {
            const servings = intent.data.quantity || (foodMatch.type === 'recipe' ? (foodMatch.item as any).servings || 1 : 100);
            addMealEntry({
                date: new Date().toISOString().split('T')[0],
                mealType: intent.data.mealType || 'snack',
                items: [{
                    type: foodMatch.type as any,
                    referenceId: foodMatch.item.id,
                    servings
                }]
            });
            setQuery('');
        }
    };

    return (
        <div className={`command-center ${isFocused ? 'is-active' : ''}`}>
            <div className="omnibox-wrapper">
                <div className="omnibox-icon">🪄</div>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    placeholder="Logga träning, mat eller vikt..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                />
                <div className="omnibox-shortcut">⏎ för att spara</div>
            </div>

            {query && (
                <div className="suggestion-panel animate-in fade-in slide-in-from-top-2 duration-300">
                    {intent.type === 'exercise' && (
                        <div className="suggestion-card exercise-card">
                            <div className="card-icon">🏃</div>
                            <div className="card-content">
                                <h3>Regga träning</h3>
                                <p>{intent.data.duration} min {intent.data.exerciseType} ({intent.data.intensity})</p>
                            </div>
                            <button className="confirm-btn" onClick={handleAction}>Spara</button>
                        </div>
                    )}

                    {intent.type === 'weight' && (
                        <div className="suggestion-card weight-card">
                            <div className="card-icon">⚖️</div>
                            <div className="card-content">
                                <h3>Uppdatera vikt</h3>
                                <p>Ny vikt: <strong>{intent.data.weight} kg</strong></p>
                            </div>
                            <button className="confirm-btn" onClick={handleAction}>Spara</button>
                        </div>
                    )}

                    {intent.type === 'food' && foodMatch && (
                        <div className="suggestion-card food-card">
                            <div className="card-icon">{foodMatch.type === 'recipe' ? '🍳' : '🥕'}</div>
                            <div className="card-content">
                                <h3>Regga {MEAL_TYPE_LABELS[intent.data.mealType || 'snack']}</h3>
                                <p>
                                    <span className="text-emerald-400">{intent.data.quantity || ''}{intent.data.unit || ''}</span> {foodMatch.item.name}
                                </p>
                            </div>
                            <button className="confirm-btn" onClick={handleAction}>Logga</button>
                        </div>
                    )}

                    {intent.type === 'food' && !foodMatch && (
                        <div className="suggestion-card search-card">
                            <div className="card-icon">🔍</div>
                            <div className="card-content">
                                <h3>Sök i databasen</h3>
                                <p>Hittade inget direkt för "{intent.data.query}"</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
