import React from 'react';
import type { ProgressionSuggestion, PlateauWarning, WeeklyVolumeRecommendation } from '../../utils/progressiveOverload.ts';
import { formatDateShort } from '../../utils/formatters.ts';

interface ProgressiveOverloadCardProps {
    suggestion: ProgressionSuggestion;
    compact?: boolean;
    onSelectWeight?: (weight: number, reps: number) => void;
}

/**
 * Enhanced pre-set nudge card with 1RM tracking and trend indicators
 */
export function ProgressiveOverloadCard({ suggestion, compact = false, onSelectWeight }: ProgressiveOverloadCardProps) {
    const {
        exerciseName,
        lastWeight,
        lastReps,
        lastDate,
        suggestedWeight,
        suggestedReps,
        current1RM,
        projected1RM,
        progressRate,
        isPlateaued,
        isCompound,
        isDistanceBased,
        lastDistance,
        suggestedDistance,
        progressTrend,
        primaryMessage,
        plateauMessage,
        tips
    } = suggestion;

    // Use shared formatDate from utils/formatters.ts
    const formatDate = formatDateShort;

    const getTrendIcon = () => {
        switch (progressTrend) {
            case 'improving': return '📈';
            case 'declining': return '📉';
            default: return '➡️';
        }
    };

    const getTrendColor = () => {
        switch (progressTrend) {
            case 'improving': return 'text-emerald-400';
            case 'declining': return 'text-rose-400';
            default: return 'text-slate-400';
        }
    };

    if (compact) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isPlateaued
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-emerald-500/10 border border-emerald-500/20'
                }`}>
                <span className="text-lg">{isPlateaued ? '⚠️' : getTrendIcon()}</span>
                <div className="flex-1">
                    <span className="text-slate-400">{formatDate(lastDate)}:</span>
                    <span className="font-bold text-white ml-1">
                        {isDistanceBased
                            ? `${lastDistance}m`
                            : `${lastWeight}kg × ${lastReps}`}
                    </span>
                    <span className="text-slate-500 mx-1">→</span>
                    <span className={`font-bold ${isPlateaued ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isDistanceBased
                            ? `${suggestedDistance}m`
                            : `${suggestedWeight}kg × ${lastReps}`}
                    </span>
                </div>
                {!isDistanceBased && <span className="text-[9px] text-slate-500 font-mono">{current1RM}kg 1RM</span>}
            </div>
        );
    }

    return (
        <div className={`rounded-xl p-4 ${isPlateaued
            ? 'bg-amber-500/10 border border-amber-500/20'
            : 'bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/20'
            }`}>
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isPlateaued ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                    }`}>
                    {isPlateaued ? '⚠️' : getTrendIcon()}
                </div>

                <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-white uppercase text-xs tracking-wider">
                                {isPlateaued ? 'Platå-varning' : 'Nästa Mål'}
                            </h3>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${isCompound ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                {isCompound ? 'Compound' : 'Isolation'}
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                            {exerciseName}
                        </span>
                    </div>

                    {/* Last Performance + 1RM */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{formatDate(lastDate)}:</span>
                            <span className="px-2 py-1 bg-slate-800 rounded-lg text-sm font-bold text-white">
                                {isDistanceBased
                                    ? `${lastDistance}m`
                                    : `${lastWeight}kg × ${lastReps}`}
                            </span>
                        </div>
                        {!isDistanceBased && (
                            <div className="flex items-center gap-1 text-[10px]">
                                <span className="text-slate-500">1RM:</span>
                                <span className="font-mono font-bold text-sky-400">{current1RM}kg</span>
                                <span className={getTrendColor()}>{getTrendIcon()}</span>
                                {progressRate !== 0 && (
                                    <span className={`${progressRate > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {progressRate > 0 ? '+' : ''}{progressRate}%/pass
                                    </span>
                                )}
                            </div>
                        )}
                        {isDistanceBased && (
                            <div className="flex items-center gap-1 text-[10px]">
                                <span className={getTrendColor()}>{getTrendIcon()}</span>
                            </div>
                        )}
                    </div>

                    {/* Suggestions */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        <button
                            onClick={() => isDistanceBased
                                ? onSelectWeight?.(0, 0) // Cannot set weight/reps for distance easily via this callback yet
                                : onSelectWeight?.(suggestedWeight, lastReps)
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 ${isPlateaued
                                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                }`}
                        >
                            {isDistanceBased ? (
                                <>🏃 {suggestedDistance}m (+2.5%)</>
                            ) : (
                                <>💪 {suggestedWeight}kg × {lastReps} <span className="ml-1 text-[9px] opacity-60">({projected1RM}kg 1RM)</span></>
                            )}
                        </button>
                        {!isDistanceBased && (
                            <button
                                onClick={() => onSelectWeight?.(lastWeight, suggestedReps)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 ${isPlateaued
                                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                    : 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                                    }`}
                            >
                                🔄 {lastWeight}kg × {suggestedReps}
                            </button>
                        )}
                    </div>

                    {/* Tips */}
                    {tips.length > 0 && (
                        <div className="space-y-1">
                            {tips.map((tip, i) => (
                                <p key={i} className="text-[10px] text-slate-400">{tip}</p>
                            ))}
                        </div>
                    )}

                    {/* Plateau Message */}
                    {isPlateaued && plateauMessage && (
                        <div className="mt-3 p-2 bg-amber-500/10 rounded-lg">
                            <p className="text-[10px] text-amber-400/80">{plateauMessage}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface PlateauWarningCardProps {
    warning: PlateauWarning;
    expanded?: boolean;
}

/**
 * Enhanced plateau warning with severity levels and action items
 */
export function PlateauWarningCard({ warning, expanded = false }: PlateauWarningCardProps) {
    const [isExpanded, setIsExpanded] = React.useState(expanded);
    const { exerciseName, weeksSinceProgress, recommendation, severity, message, actionItems, averageWeight, peakWeight, estimated1RM } = warning;

    const getSeverityConfig = () => {
        switch (severity) {
            case 'high': return { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: '🚨' };
            case 'medium': return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: '⚠️' };
            default: return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', icon: '💡' };
        }
    };

    const getRecommendationIcon = () => {
        switch (recommendation) {
            case 'deload': return '😴';
            case 'change_exercise': return '🔄';
            case 'add_volume': return '📊';
            case 'reduce_frequency': return '📅';
            default: return '⚠️';
        }
    };

    const config = getSeverityConfig();

    return (
        <div
            className={`p-3 ${config.bg} border ${config.border} rounded-xl cursor-pointer transition-all hover:scale-[1.01]`}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex items-center gap-3">
                <div className="text-2xl">{config.icon}</div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{exerciseName}</span>
                        <span className={`text-[9px] px-2 py-0.5 ${config.bg} ${config.text} rounded-full font-bold`}>
                            {weeksSinceProgress} pass utan framsteg
                        </span>
                        <span className="text-[9px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full font-bold">
                            {getRecommendationIcon()} {recommendation === 'deload' ? 'Deload' : recommendation === 'change_exercise' ? 'Byt övning' : recommendation === 'add_volume' ? 'Mer volym' : 'Mindre frekvens'}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{message}</p>
                </div>
                <div className="text-slate-500 text-xs">{isExpanded ? '▲' : '▼'}</div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
                <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-slate-800/50 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Snitt vikt</div>
                            <div className="text-sm font-bold text-white">{averageWeight}kg</div>
                        </div>
                        <div className="p-2 bg-slate-800/50 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Peak</div>
                            <div className="text-sm font-bold text-sky-400">{peakWeight}kg</div>
                        </div>
                        <div className="p-2 bg-slate-800/50 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Est. 1RM</div>
                            <div className="text-sm font-bold text-violet-400">{estimated1RM}kg</div>
                        </div>
                    </div>

                    {/* Action items */}
                    <div>
                        <h4 className="text-[9px] font-black text-slate-500 uppercase mb-2">Rekommenderade åtgärder</h4>
                        <ul className="space-y-1">
                            {actionItems.map((item, i) => (
                                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                    <span className="text-emerald-400">✓</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

interface VolumeRecommendationCardProps {
    recommendation: WeeklyVolumeRecommendation;
}

/**
 * Weekly volume recommendation card
 */
export function VolumeRecommendationCard({ recommendation }: VolumeRecommendationCardProps) {
    const { exerciseName, currentWeeklyVolume, previousWeeklyVolume, recommendation: rec, targetVolume, message } = recommendation;

    const getRecConfig = () => {
        switch (rec) {
            case 'increase': return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: '📈' };
            case 'decrease': return { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: '📉' };
            default: return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: '✅' };
        }
    };

    const config = getRecConfig();
    const change = ((currentWeeklyVolume - previousWeeklyVolume) / previousWeeklyVolume) * 100;

    return (
        <div className={`p-3 ${config.bg} border ${config.border} rounded-xl`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className="font-bold text-white text-sm">{exerciseName}</span>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-mono font-bold ${config.text}`}>
                        {currentWeeklyVolume.toLocaleString()}kg
                    </div>
                    <div className={`text-[9px] ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {change >= 0 ? '+' : ''}{Math.round(change)}% vs snitt (6v)
                    </div>
                </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">{message}</p>
        </div>
    );
}
