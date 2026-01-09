import React, { type ReactNode, useState, useEffect } from 'react';
import { Navigation } from './Navigation.tsx';
import { Omnibox } from './Omnibox.tsx';
import { GlobalExerciseModal } from './training/GlobalExerciseModal.tsx';
import { NoccoOClock } from './NoccoOClock.tsx';
import { ExerciseType } from '../models/types.ts';
import { NutritionBreakdownModal } from './calories/NutritionBreakdownModal.tsx';
import { useData } from '../context/DataContext.tsx';
import { GlobalNotification } from './common/GlobalNotification.tsx';
import { Footer } from './Footer.tsx';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const [isOmniboxOpen, setIsOmniboxOpen] = useState(false);
    const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
    const [trainingModalDefaults, setTrainingModalDefaults] = useState<{ type?: ExerciseType; input?: string }>({});

    const handleOpenTraining = (defaults: { type?: ExerciseType; input?: string }) => {
        setTrainingModalDefaults(defaults);
        setIsOmniboxOpen(false);
        setIsTrainingModalOpen(true);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOmniboxOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const { recipes, foodItems, getFoodItem } = useData();
    const [nutritionBreakdownItem, setNutritionBreakdownItem] = useState<{ type: 'recipe' | 'foodItem'; referenceId: string; servings: number } | null>(null);

    // Handle 'breakdown' query param globally
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const breakdownId = params.get('breakdown');
        if (breakdownId) {
            const recipe = recipes.find(r => r.id === breakdownId);
            if (recipe) {
                setNutritionBreakdownItem({ type: 'recipe', referenceId: recipe.id, servings: 1 });
            } else {
                const food = foodItems.find(f => f.id === breakdownId);
                if (food) {
                    setNutritionBreakdownItem({ type: 'foodItem', referenceId: food.id, servings: 100 });
                }
            }
            // Clean up URL without reload
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', newUrl);
        }
    }, [recipes, foodItems]); // Dependencies on data to ensure we can find the item

    return (
        <div className="min-h-screen flex flex-col relative">
            <GlobalNotification />
            <NoccoOClock />
            {/* New Omnibox Component - handles its own overlay */}
            <Omnibox
                isOpen={isOmniboxOpen}
                onClose={() => setIsOmniboxOpen(false)}
                onOpenTraining={handleOpenTraining}
                onOpenNutrition={(item) => {
                    setIsOmniboxOpen(false);
                    setNutritionBreakdownItem(item);
                }}
            />

            <GlobalExerciseModal
                isOpen={isTrainingModalOpen}
                onClose={() => setIsTrainingModalOpen(false)}
                initialType={trainingModalDefaults.type}
                initialInput={trainingModalDefaults.input}
            />

            {nutritionBreakdownItem && (
                <NutritionBreakdownModal
                    item={nutritionBreakdownItem}
                    onClose={() => setNutritionBreakdownItem(null)}
                    recipes={recipes}
                    foodItems={foodItems}
                    getFoodItem={getFoodItem}
                />
            )}

            <Navigation onOpenOmnibox={() => setIsOmniboxOpen(true)} />
            <main className="flex-1 w-full max-w-[1536px] mx-auto p-3 md:p-6">
                {children}
            </main>
            <Footer />
        </div>
    );
}
