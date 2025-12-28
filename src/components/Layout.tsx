import React, { type ReactNode, useState, useEffect } from 'react';
import { Navigation } from './Navigation.tsx';
import { CommandCenter } from './weekly/CommandCenter.tsx';
import { GlobalExerciseModal } from './training/GlobalExerciseModal.tsx';
import { ExerciseType } from '../models/types.ts';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const [isOmniboxOpen, setIsOmniboxOpen] = useState(false);
    const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
    const [trainingModalDefaults, setTrainingModalDefaults] = useState<{ type?: ExerciseType; input?: string }>({});

    // This might be unused now if CommandCenter handles navigation directly, 
    // but we keep it for now if needed by legacy paths
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

    // Explicitly handle Escape to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOmniboxOpen && e.key === 'Escape') {
                setIsOmniboxOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOmniboxOpen]);

    return (
        <div className="min-h-screen flex flex-col relative">
            {isOmniboxOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsOmniboxOpen(false)}
                >
                    <div
                        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <CommandCenter
                            autoFocus={true}
                            onAfterAction={() => setIsOmniboxOpen(false)}
                            className="w-full !max-w-none !shadow-none !rounded-none border-none !bg-transparent"
                            overlayMode={true}
                        />
                        <div className="absolute top-4 right-4 z-[60]">
                            <div className="flex gap-2">
                                <kbd className="hidden md:inline-flex h-6 items-center gap-1 rounded border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-2 font-mono text-[10px] font-medium text-slate-400">
                                    ESC
                                </kbd>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
