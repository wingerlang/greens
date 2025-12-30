import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { getISODate, generateId } from '../models/types.ts';

/**
 * Nocco 'o Clock Component
 * 
 * Logic:
 * - 07:55 - 08:00: Show countdown timer.
 * - 08:00 - 08:05: Show "It's Nocco 'o clock" text (fade in) + Action Button.
 * - Action: Register a Nocco energy drink.
 */
export function NoccoOClock() {
    const { addMealEntry, addFoodItem, foodItems, mealEntries } = useData();
    const [now, setNow] = useState(new Date());
    const [hasRegisteredToday, setHasRegisteredToday] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Check if we already registered a Nocco today
    useEffect(() => {
        const today = getISODate(now);
        const hasNocco = mealEntries.some(m =>
            m.date === today &&
            m.items.some(i => {
                if (i.type === 'foodItem') {
                    const item = foodItems.find(f => f.id === i.referenceId);
                    return item?.name.toLowerCase().includes('nocco');
                }
                return false;
            })
        );
        setHasRegisteredToday(hasNocco);
    }, [mealEntries, now, foodItems]);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Debugging/Dev: Uncomment to test at specific times
    // const currentHour = 12;
    // const currentMinute = 57;

    const isCountdownPhase = currentHour === 7 && currentMinute >= 45;
    const isActionPhase = currentHour === 8 && currentMinute < 5;

    // Don't show anything if outside windows or already registered (optional: could allow multiple)
    if ((!isCountdownPhase && !isActionPhase) || hasRegisteredToday) {
        return null;
    }

    const handleRegisterNocco = () => {
        // Find or create Nocco food item
        let noccoItem = foodItems.find(f => f.name.toLowerCase() === 'nocco');
        let noccoId = noccoItem?.id;

        if (!noccoItem) {
            const newItem = addFoodItem({
                name: 'Nocco',
                calories: 15,
                protein: 3,
                carbs: 0,
                fat: 0,
                unit: 'pcs',
                category: 'beverages'
            });
            noccoId = newItem.id;
        }

        if (noccoId) {
            // Add to snack
            addMealEntry({
                date: getISODate(now),
                mealType: 'snack',
                items: [{
                    type: 'foodItem',
                    referenceId: noccoId,
                    servings: 1
                }]
            });

            // Optimistic update
            setHasRegisteredToday(true);
        }
    };

    if (isCountdownPhase) {
        // Calculate time until 08:00
        // Target: Today 08:00:00
        const target = new Date(now);
        target.setHours(8, 0, 0, 0);
        const diffMs = target.getTime() - now.getTime();
        const diffSecs = Math.ceil(diffMs / 1000);
        const mins = Math.floor(diffSecs / 60);
        const secs = diffSecs % 60;

        return (
            <div className="fixed bottom-6 right-6 z-50 animate-pulse bg-slate-900/80 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full font-mono text-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] backdrop-blur-md">
                T-minus {mins}:{secs.toString().padStart(2, '0')} 🕒
            </div>
        );
    }

    if (isActionPhase) {
        return (
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
                <div
                    className="pointer-events-auto flex flex-col items-center gap-6 animate-in fade-in slide-in-from-left duration-1000 fill-mode-forwards"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_0_25px_rgba(56,189,248,0.5)] italic tracking-tighter">
                        IT'S NOCCO 'O CLOCK
                    </h1>

                    <button
                        onClick={handleRegisterNocco}
                        className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl overflow-hidden shadow-2xl transition-all hover:scale-105 active:scale-95"
                    >
                        <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -skew-x-12" />
                        <span className="relative flex items-center gap-3 text-xl font-bold text-white uppercase tracking-wider">
                            🥤 Tagit en Nocco
                        </span>
                    </button>

                    <p className="text-blue-200/50 font-mono text-sm">(Gäller fram till 08:05)</p>
                </div>
            </div>
        );
    }

    return null;
}
