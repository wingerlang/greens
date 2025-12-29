import React, { type ReactNode, useState, useEffect } from 'react';
import { Navigation } from './Navigation.tsx';
import { Omnibox } from './Omnibox.tsx';
import { GlobalExerciseModal } from './training/GlobalExerciseModal.tsx';
import { ExerciseType } from '../models/types.ts';

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

    return (
        <div className="min-h-screen flex flex-col relative">
            {/* New Omnibox Component - handles its own overlay */}
            <Omnibox
                isOpen={isOmniboxOpen}
                onClose={() => setIsOmniboxOpen(false)}
                onOpenTraining={handleOpenTraining}
            />

            <GlobalExerciseModal
                isOpen={isTrainingModalOpen}
                onClose={() => setIsTrainingModalOpen(false)}
                initialType={trainingModalDefaults.type}
                initialInput={trainingModalDefaults.input}
            />
            <Navigation onOpenOmnibox={() => setIsOmniboxOpen(true)} />
            <main className="flex-1 w-full max-w-[1536px] mx-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
