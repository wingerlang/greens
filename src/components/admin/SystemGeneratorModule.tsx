import React, { useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { generateId, type MealType, type Recipe, type ExerciseType, type ExerciseIntensity } from '../../models/types.ts';

export function SystemGeneratorModule() {
    const {
        recipes,
        addMealEntry,
        addExercise,
        users,
        addUser,
        currentUser,
        updateVitals,
        mealEntries,
        exerciseEntries
    } = useData();

    const [isGenerating, setIsGenerating] = useState(false);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 50));

    const generateMyData = async () => {
        if (!currentUser) return;
        setIsGenerating(true);
        addLog('🚀 Startar generering av data för ' + currentUser.name + '...');

        // 1. Generate up to 30 days of history, preferring gaps
        const MAX_DAYS_TO_GENERATE = 30;
        let generatedDays = 0;

        let countMeals = 0;
        let countWorkout = 0;

        // Iterate backwards from yesterday, up to 60 days back
        for (let i = 1; i <= 60; i++) {
            if (generatedDays >= MAX_DAYS_TO_GENERATE) break;

            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            // Check if this day already has meal entries for the current user
            // Note: DataContext mealEntries might be empty initially if not loaded, but should be fine here
            const hasMealsForDay = mealEntries.some(entry => entry.date === dateStr);

            // Decide whether to generate data for this day
            // Prioritize empty days, but also fill up to MAX_DAYS_TO_GENERATE even if some days have data
            const shouldGenerateForDay = !hasMealsForDay || (generatedDays < MAX_DAYS_TO_GENERATE && Math.random() < 0.5);

            if (shouldGenerateForDay) {
                // Randomly skip some days to create more realistic gaps
                if (Math.random() > 0.8) continue;

                generatedDays++;

                // Generate Meals (3-4 per day)
                const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
                for (const mealType of meals) {
                    // Pick random recipe
                    if (recipes.length > 0 && Math.random() > 0.1) {
                        const recipe = recipes[Math.floor(Math.random() * recipes.length)];
                        addMealEntry({
                            date: dateStr,
                            mealType,
                            items: [{
                                type: 'recipe',
                                referenceId: recipe.id,
                                servings: 1
                            }]
                        });
                        countMeals++;
                    }
                }

                // Generate Exercise (3 times a week approx)
                if (Math.random() > 0.6) {
                    const types: ExerciseType[] = ['strength', 'running', 'walking', 'cycling'];
                    const type = types[Math.floor(Math.random() * types.length)];
                    addExercise({
                        date: dateStr,
                        type,
                        durationMinutes: Math.floor(Math.random() * 60) + 15, // 15-75 min
                        intensity: (['low', 'moderate', 'high'] as ExerciseIntensity[])[Math.floor(Math.random() * 3)],
                        caloriesBurned: Math.floor(Math.random() * 500) + 100
                    });
                    countWorkout++;
                }

                // Generate Vitals
                updateVitals(dateStr, {
                    water: Math.floor(Math.random() * 8),
                    sleep: Math.floor(Math.random() * 4) + 5, // 5-9 hours
                    caffeine: Math.floor(Math.random() * 300)
                });
            }
        }

        addLog(`✅ Klar! Skapade ${countMeals} måltider och ${countWorkout} träningspass över ${generatedDays} dagar.`);
        setIsGenerating(false);
    };

    const generateBots = () => {
        setIsGenerating(true);
        addLog('🤖 Skapar botar...');

        const bots = [
            { name: 'Fitness-Lisa', email: 'lisa@bot.com', role: 'user' },
            { name: 'Gym-Erik', email: 'erik@bot.com', role: 'user' },
            { name: 'Vegan-Anders', email: 'anders@bot.com', role: 'user' },
            { name: 'Crossfit-Sara', email: 'sara@bot.com', role: 'user' },
            { name: 'Löpar-Johan', email: 'johan@bot.com', role: 'user' }
        ];

        let created = 0;
        bots.forEach(bot => {
            if (!users.find(u => u.email === bot.email)) {
                addUser({
                    id: generateId(),
                    name: bot.name,
                    email: bot.email,
                    role: 'user',
                    plan: 'free',
                    settings: {
                        theme: 'dark',
                        visibleMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
                        dailyCalorieGoal: 2000 + Math.floor(Math.random() * 1000),
                        dailyProteinGoal: 150,
                        dailyCarbsGoal: 50,
                        dailyFatGoal: 30,
                        trainingGoal: 'neutral',
                        dailySleepGoal: 8,
                        dailyWaterGoal: 8
                    },
                    createdAt: new Date().toISOString()
                });
                created++;
            }
        });

        addLog(`✅ Skapade ${created} nya botar.`);
        setIsGenerating(false);
    };

    const clearAllData = () => {
        if (confirm('Är du helt säker? Detta raderar ALL data i localStorage.')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section className="bg-slate-900/50 rounded-3xl border border-slate-800 p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-3xl">🛠️</span>
                    <div>
                        <h2 className="text-xl font-bold text-white">System & Datagenerering</h2>
                        <p className="text-slate-400 text-sm">Verktyg för att populera databasen och stresstesta systemet.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Data Generator */}
                    <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-emerald-400 mb-1">Generera Min Historik</h3>
                                <p className="text-xs text-slate-400">Skapar 30 dagars måltids- och träningshistorik slumpmässigt.</p>
                            </div>
                            <span className="text-2xl">📅</span>
                        </div>
                        <button
                            onClick={generateMyData}
                            disabled={isGenerating}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {isGenerating ? 'Genererar...' : 'Kör Generering'}
                        </button>
                    </div>

                    {/* Bot Generator */}
                    <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-blue-400 mb-1">Skapa Bot-användare</h3>
                                <p className="text-xs text-slate-400">Lägger till 5 fiktiva användare för att testa tävlingar.</p>
                            </div>
                            <span className="text-2xl">🤖</span>
                        </div>
                        <button
                            onClick={generateBots}
                            disabled={isGenerating}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isGenerating ? 'Skapar...' : 'Skapa Botar'}
                        </button>
                    </div>
                </div>

                {/* Console Log */}
                <div className="mt-8 bg-slate-950 rounded-xl p-4 font-mono text-xs h-40 overflow-y-auto border border-slate-800">
                    <div className="text-slate-500 mb-2 uppercase tracking-widest font-bold">System Log</div>
                    {log.length === 0 && <span className="text-slate-700 opacity-50">Ingen aktivitet än...</span>}
                    {log.map((line, i) => (
                        <div key={i} className="text-emerald-400/80 mb-1 border-l-2 border-emerald-500/20 pl-2">
                            <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {line}
                        </div>
                    ))}
                </div>

                {/* Danger Zone */}
                <div className="mt-8 pt-8 border-t border-red-500/20">
                    <h3 className="text-red-500 font-bold mb-4 uppercase tracking-widest text-xs">Danger Zone</h3>
                    <button
                        onClick={clearAllData}
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-bold transition-all text-sm w-full md:w-auto"
                    >
                        🗑️ Rensa hela databasen (LocalStorage)
                    </button>
                </div>
            </section>
        </div>
    );
}
