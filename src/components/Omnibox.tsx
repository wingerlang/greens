
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
    onOpenTraining?: (defaults: { type?: ExerciseType; input?: string }) => void;
}

export function Omnibox({ isOpen, onClose, onOpenTraining }: OmniboxProps) {
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const { addWeightEntry, addExercise, updateVitals, getVitalsForDate } = useData();
    // We can use health data here if we want to show current status in the box?
    // For now, keep it simple: Input -> Action.

    const intent = parseOmniboxInput(input);
    const [showFeedback, setShowFeedback] = useState(false);

    useEffect(() => {
        if (showFeedback) {
            const timer = setTimeout(() => setShowFeedback(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [showFeedback]);

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
            const date = intent.date || new Date().toISOString().split('T')[0];
            addWeightEntry(intent.data.weight, date);

            setShowFeedback(true);
            setInput('');
            setTimeout(() => onClose(), 800);
            return;
        } else if (intent.type === 'vitals') {
            const date = intent.date || new Date().toISOString().split('T')[0];
            const updates: any = { updatedAt: new Date().toISOString() };

            if (intent.data.vitalType === 'sleep') updates.sleep = intent.data.amount;
            if (intent.data.vitalType === 'water') {
                const existing = getVitalsForDate(date);
                updates.water = (existing.water || 0) + intent.data.amount;
            }
            if (intent.data.vitalType === 'coffee' || intent.data.vitalType === 'nocco' || intent.data.vitalType === 'energy') {
                const existing = getVitalsForDate(date);
                updates.caffeine = (existing.caffeine || 0) + (intent.data.caffeine || 0);
            }
            if (intent.data.vitalType === 'steps') updates.steps = intent.data.amount;

            updateVitals(date, updates);
            setShowFeedback(true);
            setInput('');
            setTimeout(() => onClose(), 800);
            return;
        } else if (intent.type === 'exercise') {
            if (onOpenTraining) {
                onOpenTraining({
                    type: intent.data.exerciseType,
                    input: input
                });
                onClose();
                return;
            }

            const data = intent.data;
            if (data.exerciseType && data.duration && data.intensity) {
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
                    {showFeedback && (
                        <div className="absolute right-16 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full animate-in fade-in zoom-in duration-300">
                            ✨ Sparat!
                        </div>
                    )}
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
                                    <span>Logga vikt: <span className="font-bold">{intent.data.weight} kg</span> {intent.date && <span className="ml-1 text-slate-500 font-normal">({intent.date})</span>}</span>
                                </div>
                            )}
                            {intent.type === 'exercise' && (
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <span>🏋️</span>
                                    <span>Logga: <span className="font-bold capitalize">{intent.data.exerciseType}</span> • {intent.data.duration} min • {intent.data.intensity}{intent.data.distance ? ` • ${intent.data.distance} km` : ''}{intent.data.tonnage ? ` • ${Math.round(intent.data.tonnage / 1000)}t` : ''}</span>
                                </div>
                            )}
                            {intent.type === 'vitals' && (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3 text-emerald-400">
                                        <span>{intent.data.vitalType === 'sleep' ? '😴' : intent.data.vitalType === 'steps' ? '👟' : intent.data.vitalType === 'water' ? '💧' : '☕'}</span>
                                        <span>
                                            Logga: <span className="font-bold">
                                                {intent.data.vitalType === 'sleep' && `${intent.data.amount}h sömn`}
                                                {intent.data.vitalType === 'steps' && `${intent.data.amount.toLocaleString()} steg`}
                                                {intent.data.vitalType === 'water' && `${intent.data.amount} glas vatten`}
                                                {(intent.data.vitalType === 'coffee' || intent.data.vitalType === 'nocco' || intent.data.vitalType === 'energy') &&
                                                    `${intent.data.amount}x ${intent.data.vitalType}${intent.data.caffeine ? ` (${intent.data.caffeine}mg koffein)` : ''}`}
                                            </span>
                                            {intent.date && <span className="ml-2 text-slate-500 font-normal">({intent.date})</span>}
                                        </span>
                                    </div>
                                    {intent.data.vitalType === 'sleep' && intent.date && getVitalsForDate(intent.date).sleep > 0 && (
                                        <div className="flex items-center gap-2 text-rose-400 text-xs font-bold pl-8">
                                            <span>⚠️</span>
                                            <span>Du har redan loggat sömn för detta datum ({getVitalsForDate(intent.date).sleep}h).</span>
                                        </div>
                                    )}
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
