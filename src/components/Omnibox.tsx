
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealth } from '../hooks/useHealth.ts';
import { useData } from '../context/DataContext.tsx';
import { parseOmniboxInput } from '../utils/nlpParser.ts';
import {
    ExerciseType,
    ExerciseIntensity,
} from '../models/types.ts';

interface OmniboxProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Omnibox({ isOpen, onClose }: OmniboxProps) {
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const { addWeightEntry, addExercise } = useData();
    // We can use health data here if we want to show current status in the box?
    // For now, keep it simple: Input -> Action.

    const intent = parseOmniboxInput(input);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleExecute = () => {
        if (!input.trim()) return;

        if (intent.type === 'navigate') {
            navigate(intent.data.path);
            onClose();
        } else if (intent.type === 'weight') {
            addWeightEntry(intent.data.weight, new Date().toISOString().split('T')[0]);
            onClose();
            // Show toast? relying on global toast or implicit success for now.
        } else if (intent.type === 'exercise') {
            const data = intent.data;
            if (data.exerciseType && data.duration && data.intensity) {
                // We need more data like calories.
                // In TrainingPage we calculate it. Here we might need a helper or use generic calc.
                // For now, let's redirect to training page with pre-filled state? 
                // Or implementing basic add using helper.
                // Re-using `calculateExerciseCalories` from useData would be best but hooks rules...
                // useData is already imported.
                // We need to access `addExercise` which takes `ExerciseEntry`.
                // But `addExercise` expects full object.
                // Let's defer complex exercise logging to "Redirect to Training" or improved logic later.
                // Actually, let's just navigate to training page with query param?
                // Or support simple cases.
                navigate('/training');
                onClose();
            }
        }
        setInput('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center gap-4 border-b border-white/5">
                    <span className="text-xl">✨</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-xl font-medium text-white placeholder-slate-500 outline-none"
                        placeholder="Vart vill du gå? Vad vill du logga?"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleExecute()}
                    />
                    <div className="flex gap-2">
                        <kbd className="hidden md:inline-flex h-6 items-center gap-1 rounded border border-white/10 bg-white/5 px-2 font-mono text-[10px] font-medium text-slate-400">
                            ESC
                        </kbd>
                    </div>
                </div>

                {/* Preview / Results Area */}
                <div className="bg-slate-950/50 p-2">
                    {input && (
                        <div className="px-2 py-2">
                            {intent.type === 'navigate' && (
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <span>➔</span>
                                    <span>Gå till <span className="font-bold capitalize">{intent.data.path.replace('/', '') || 'Hem'}</span></span>
                                </div>
                            )}
                            {intent.type === 'weight' && (
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <span>⚖️</span>
                                    <span>Logga vikt: <span className="font-bold">{intent.data.weight} kg</span></span>
                                </div>
                            )}
                            {intent.type === 'exercise' && (
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <span>🏋️</span>
                                    <span>Gå till Träning för att logga <span className="font-bold">{input}</span></span>
                                </div>
                            )}
                            {intent.type === 'search' && (
                                <div className="text-slate-500 italic text-sm px-2">
                                    Sök eller skriv kommando...
                                </div>
                            )}
                        </div>
                    )}
                    {!input && (
                        <div className="p-4 text-center text-slate-500 text-xs">
                            <p>Tips: Skriv "gå till recept" eller "82.5kg"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
