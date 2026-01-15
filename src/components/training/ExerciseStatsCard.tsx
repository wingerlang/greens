/**
 * Exercise Stats Card Component
 * Displays statistics about exercises: most trained, recent, and progress.
 */

import React, { useState } from 'react';
import { type ExerciseStats, formatExerciseRecency } from '../../hooks/useExerciseStatistics.ts';

interface ExerciseStatsCardProps {
    mostTrainedExercises: ExerciseStats[];
    recentExercises: ExerciseStats[];
    totalVolume: number;
    totalSets: number;
    totalUniqueExercises: number;
    className?: string;
}

type TabType = 'most-trained' | 'recent';

export function ExerciseStatsCard({
    mostTrainedExercises,
    recentExercises,
    totalVolume,
    totalSets,
    totalUniqueExercises,
    className = ''
}: ExerciseStatsCardProps) {
    const [activeTab, setActiveTab] = useState<TabType>('most-trained');

    const formatVolume = (vol: number): string => {
        if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M kg`;
        if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k kg`;
        return `${vol} kg`;
    };

    const exercises = activeTab === 'most-trained' ? mostTrainedExercises : recentExercises;

    return (
        <div className={`glass-card p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-xl">📊</span>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">
                        Övningsstatistik
                    </h3>
                </div>
                <div className="flex gap-3 text-[10px]">
                    <div className="text-slate-500">
                        <span className="text-white font-bold">{totalUniqueExercises}</span> övningar
                    </div>
                    <div className="text-slate-500">
                        <span className="text-emerald-400 font-bold">{formatVolume(totalVolume)}</span> totalt
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-slate-900/50 rounded-lg p-1">
                <button
                    onClick={() => setActiveTab('most-trained')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === 'most-trained'
                            ? 'bg-violet-500/20 text-violet-400'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    🔥 Mest Tränat
                </button>
                <button
                    onClick={() => setActiveTab('recent')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === 'recent'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    🕐 Senast Tränat
                </button>
            </div>

            {/* Exercise List */}
            <div className="space-y-1.5">
                {exercises.slice(0, 8).map((exercise, index) => (
                    <ExerciseStatRow
                        key={exercise.normalizedName}
                        exercise={exercise}
                        rank={index + 1}
                        showRecency={activeTab === 'recent'}
                    />
                ))}

                {exercises.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs">
                        Ingen data tillgänglig
                    </div>
                )}
            </div>
        </div>
    );
}

interface ExerciseStatRowProps {
    exercise: ExerciseStats;
    rank: number;
    showRecency: boolean;
}

function ExerciseStatRow({ exercise, rank, showRecency }: ExerciseStatRowProps) {
    const recency = formatExerciseRecency(exercise.daysSinceLastTraining);

    return (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
            {/* Rank */}
            <div className={`
                w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black
                ${rank <= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-500'}
            `}>
                {rank}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">
                    {exercise.name}
                </div>
                {showRecency ? (
                    <div className={`text-[10px] ${recency.color}`}>
                        {recency.text}
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-500">
                        {exercise.sessionCount} pass • {exercise.totalSets} set
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="text-right">
                <div className="text-xs font-bold text-violet-400">
                    {exercise.best1RM > 0 ? `${exercise.best1RM} kg` : '-'}
                </div>
                <div className="text-[10px] text-slate-500">
                    e1RM
                </div>
            </div>
        </div>
    );
}

// Compact version for sidebar or smaller spaces
interface ExerciseStatsCompactProps {
    exercises: ExerciseStats[];
    title: string;
    icon: string;
}

export function ExerciseStatsCompact({ exercises, title, icon }: ExerciseStatsCompactProps) {
    return (
        <div className="p-3 bg-slate-800/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
                <span>{icon}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{title}</span>
            </div>
            <div className="space-y-1">
                {exercises.slice(0, 5).map((ex, i) => (
                    <div key={ex.normalizedName} className="flex items-center justify-between">
                        <span className="text-xs text-white truncate flex-1">{ex.name}</span>
                        <span className="text-[10px] text-violet-400 font-bold ml-2">
                            {ex.best1RM > 0 ? `${ex.best1RM}kg` : `${ex.totalSets}s`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
