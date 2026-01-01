/**
 * GoalCelebration - Modal for celebrating completed goals
 */

import React, { useEffect, useState } from 'react';
import { GoalProgressRing } from './GoalProgressRing';
import type { PerformanceGoal } from '../../models/types';

interface GoalCelebrationProps {
    goal: PerformanceGoal;
    onClose: () => void;
    onNewGoal?: () => void;
}

// Confetti particle
interface Particle {
    id: number;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    color: string;
    delay: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function Confetti() {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        const newParticles: Particle[] = [];
        for (let i = 0; i < 50; i++) {
            newParticles.push({
                id: i,
                x: Math.random() * 100,
                y: -10 - Math.random() * 20,
                rotation: Math.random() * 360,
                scale: 0.5 + Math.random() * 0.5,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                delay: Math.random() * 0.5
            });
        }
        setParticles(newParticles);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                        left: `${p.x}%`,
                        backgroundColor: p.color,
                        transform: `scale(${p.scale}) rotate(${p.rotation}deg)`,
                        animation: `confetti-fall 3s ease-out ${p.delay}s forwards`
                    }}
                />
            ))}
            <style>{`
                @keyframes confetti-fall {
                    0% {
                        top: -5%;
                        opacity: 1;
                    }
                    100% {
                        top: 110%;
                        opacity: 0;
                        transform: rotate(720deg);
                    }
                }
            `}</style>
        </div>
    );
}

export function GoalCelebration({ goal, onClose, onNewGoal }: GoalCelebrationProps) {
    const [showConfetti, setShowConfetti] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowConfetti(false), 4000);
        return () => clearTimeout(timer);
    }, []);

    // ESC to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const getGoalIcon = () => {
        if (goal.icon) return goal.icon;
        switch (goal.type) {
            case 'frequency': return '🔢';
            case 'distance': return '🏃';
            case 'tonnage': return '🏋️';
            case 'streak': return '🔥';
            case 'milestone': return '🏆';
            case 'pb': return '⚡';
            case 'nutrition': return '🥗';
            case 'weight': return '⚖️';
            default: return '🎯';
        }
    };

    const getAchievementMessage = () => {
        switch (goal.type) {
            case 'streak':
                return `${goal.milestoneValue || 7} dagars streak uppnådd!`;
            case 'milestone':
                return `${goal.milestoneValue}${goal.milestoneUnit || ''} total!`;
            case 'pb':
                return `Nytt personbästa: ${goal.milestoneValue}${goal.milestoneUnit || 'kg'}!`;
            case 'weight':
                return `Målvikten ${goal.targetWeight}kg uppnådd!`;
            default:
                return 'Mål uppnått!';
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300"
            onClick={onClose}
        >
            {showConfetti && <Confetti />}

            <div
                className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/20 overflow-hidden animate-in zoom-in-95 duration-500"
                onClick={e => e.stopPropagation()}
            >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

                {/* Content */}
                <div className="relative p-8 text-center">
                    {/* Badge */}
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/30 animate-bounce">
                            <span className="text-5xl">{getGoalIcon()}</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
                        🎉 Grattis!
                    </h2>
                    <p className="text-lg text-emerald-400 font-bold mb-4">
                        {getAchievementMessage()}
                    </p>

                    {/* Goal name */}
                    <div className="inline-block px-4 py-2 bg-white/5 rounded-xl mb-6">
                        <span className="text-sm text-slate-400">
                            {goal.name}
                        </span>
                    </div>

                    {/* Progress ring */}
                    <div className="flex justify-center mb-8">
                        <GoalProgressRing
                            percentage={100}
                            size={100}
                            color="#10b981"
                        >
                            <span className="text-3xl">✓</span>
                        </GoalProgressRing>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="p-4 bg-white/5 rounded-xl">
                            <div className="text-2xl font-black text-white">
                                {goal.completedAt
                                    ? Math.ceil((new Date(goal.completedAt).getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24))
                                    : 0}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold">
                                Dagar
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-xl">
                            <div className="text-2xl font-black text-emerald-400">
                                100%
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold">
                                Avslutat
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        {onNewGoal && (
                            <button
                                onClick={onNewGoal}
                                className="flex-1 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 uppercase text-sm tracking-wider"
                            >
                                ✨ Nytt Mål
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all uppercase text-sm"
                        >
                            Stäng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
