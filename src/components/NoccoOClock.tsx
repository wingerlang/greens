import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { getISODate, generateId } from '../models/types.ts';
import { X } from 'lucide-react';

/**
 * Nocco 'o Clock Component
 * 
 * Logic:
 * - 07:55 - 08:00: Show countdown timer.
 * - 08:00 - 08:05: Show "It's Nocco 'o clock" text (fade in) + Action Button.
 * - Action: Register a Nocco energy drink.
 */
export function NoccoOClock() {
    const { addMealEntry, addFoodItem, foodItems, mealEntries, updateVitals, userSettings, dailyVitals } = useData();
    const [now, setNow] = useState(new Date());
    const [hasRegisteredToday, setHasRegisteredToday] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
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
                    return item?.name.toLowerCase().includes('nocco') || item?.name.toLowerCase().includes('kaffe');
                }
                return false;
            })
        );
        setHasRegisteredToday(hasNocco);
    }, [mealEntries, now, foodItems]);

    // Check for persisted dismissal
    useEffect(() => {
        const today = getISODate(now);
        if (localStorage.getItem(`nocco_dismissed_${today}`)) {
            setIsDismissed(true);
        }
    }, [now]);


    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const isCountdownPhase = currentHour === 7 && currentMinute >= 45;
    const isActionPhase = currentHour === 8 && currentMinute < 5;

    // Feature toggle check
    if (userSettings.noccoOClockEnabled === false) return null;

    // Don't show anything if outside windows or already registered
    if ((!isCountdownPhase && !isActionPhase) || hasRegisteredToday || isDismissed) {
        return null;
    }

    const handleRegisterNocco = () => {
        const today = getISODate(now);

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
                category: 'beverages',
                extendedDetails: {
                    caffeine: 180
                }
            });
            noccoId = newItem.id;
        }

        if (noccoId) {
            // Add to snack
            addMealEntry({
                date: today,
                mealType: 'snack',
                items: [{
                    type: 'foodItem',
                    referenceId: noccoId,
                    servings: 1
                }]
            });

            // Update Vitals (Caffeine)
            const currentCaff = dailyVitals[today]?.caffeine || 0;
            updateVitals(today, { caffeine: currentCaff + 180 });

            // Dismiss
            setHasRegisteredToday(true);
        }
    };

    const handleRegisterCoffee = () => {
        const today = getISODate(now);

        // Find or create Coffee food item
        let coffeeItem = foodItems.find(f => f.name.toLowerCase() === 'kaffe' || f.name.toLowerCase() === 'coffee');
        let coffeeId = coffeeItem?.id;

        if (!coffeeItem) {
            const newItem = addFoodItem({
                name: 'Kaffe',
                calories: 2,
                protein: 0,
                carbs: 0.3,
                fat: 0,
                unit: 'cup',
                category: 'beverages',
                extendedDetails: {
                    caffeine: 80
                }
            });
            coffeeId = newItem.id;
        }

        if (coffeeId) {
            addMealEntry({
                date: today,
                mealType: 'breakfast', // Usually morning
                items: [{
                    type: 'foodItem',
                    referenceId: coffeeId,
                    servings: 1
                }]
            });

            // Update Vitals (Caffeine)
            const currentCaff = dailyVitals[today]?.caffeine || 0;
            updateVitals(today, { caffeine: currentCaff + 80 });

            setHasRegisteredToday(true);
        }
    };

    const handleDismiss = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsDismissed(true);
        // Persist dismissal for the day
        const today = getISODate(now);
        localStorage.setItem(`nocco_dismissed_${today}`, 'true');
    };



    if (isCountdownPhase) {
        // Calculate time until 08:00
        const target = new Date(now);
        target.setHours(8, 0, 0, 0);
        const diffMs = target.getTime() - now.getTime();
        const diffSecs = Math.ceil(diffMs / 1000);
        const mins = Math.floor(diffSecs / 60);
        const secs = diffSecs % 60;

        return (
            <div className="fixed bottom-6 right-6 z-50 animate-pulse bg-slate-900/80 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full font-mono text-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] backdrop-blur-md flex items-center gap-3">
                <span>T-minus {mins}:{secs.toString().padStart(2, '0')} 🕒</span>
                <button
                    onClick={handleDismiss}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    if (isActionPhase) {
        return (
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
                <div
                    className="pointer-events-auto flex flex-col items-center gap-6 animate-in fade-in slide-in-from-left duration-1000 fill-mode-forwards relative p-10"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* Backdrop Blur specifically behind the content if desired, or relying on overlay? 
                        User wants "Cancel" button. 
                    */}

                    <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_0_25px_rgba(56,189,248,0.5)] italic tracking-tighter text-center">
                        IT'S NOCCO 'O CLOCK
                    </h1>

                    <div className="flex gap-4">
                        <button
                            onClick={handleRegisterNocco}
                            className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl overflow-hidden shadow-2xl transition-all hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -skew-x-12" />
                            <span className="relative flex items-center gap-3 text-xl font-bold text-white uppercase tracking-wider">
                                🥤 Tagit en Nocco
                            </span>
                        </button>

                        <button
                            onClick={handleRegisterCoffee}
                            className="group relative px-8 py-4 bg-gradient-to-r from-amber-700 to-orange-800 rounded-2xl overflow-hidden shadow-2xl transition-all hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -skew-x-12" />
                            <span className="relative flex items-center gap-3 text-xl font-bold text-white uppercase tracking-wider">
                                ☕ Kaffe istället
                            </span>
                        </button>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="px-6 py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full font-bold text-sm transition-all backdrop-blur-sm border border-slate-700/50"
                    >
                        Avbryt / Ignorera
                    </button>

                    <p className="text-blue-200/50 font-mono text-sm">(Gäller fram till 08:05)</p>
                </div>
            </div>
        );
    }

    return null;
}
