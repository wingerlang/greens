/**
 * GoalDetailModal - View and track goal progress with smart visualizations
 */

import React, { useMemo, useEffect } from 'react';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useData } from '../../context/DataContext';
import { useGoalProgress } from '../../hooks/useGoalProgress';
import { GoalProgressRing } from './GoalProgressRing';
import type { PerformanceGoal, GoalCategory, WeightEntry } from '../../models/types';
import { assessGoalDifficulty, calculateAheadBehind } from '../../utils/goalCalculations';

interface GoalDetailModalProps {
    goal: PerformanceGoal;
    onClose: () => void;
    onEdit?: () => void;
}

const CATEGORY_CONFIG: Record<GoalCategory, { label: string; icon: string; color: string }> = {
    training: { label: 'Träning', icon: '🏋️', color: '#10b981' },
    nutrition: { label: 'Kost', icon: '🥗', color: '#f59e0b' },
    body: { label: 'Kropp', icon: '⚖️', color: '#3b82f6' },
    lifestyle: { label: 'Livsstil', icon: '🧘', color: '#8b5cf6' }
};

export function GoalDetailModal({ goal, onClose, onEdit }: GoalDetailModalProps) {
    const { weightEntries = [], universalActivities = [], strengthSessions = [] } = useData();
    const progressData = useGoalProgress(goal);

    // Format helpers
    const formatDuration = (seconds: number) => {
        if (!seconds) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatSpeed = (secondsPerKm: number) => {
        if (!secondsPerKm || !isFinite(secondsPerKm)) return '—';
        const speed = 3600 / secondsPerKm;
        return `${speed.toFixed(1)} km/h`;
    };

    const formatAheadBehind = (val: number, unit?: string) => {
        if (unit === 's' || goal.type === 'speed') {
            const absVal = Math.abs(val);
            return `${val >= 0 ? '+' : '-'}${formatDuration(absVal)}`;
        }
        return `${val >= 0 ? '+' : ''}${val.toFixed(1)} ${unit || ''}`;
    };

    // Lock body scroll when modal is open
    useScrollLock(true);

    // Close on ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Fallback for null progress
    const progress = progressData || {
        percentage: 0,
        current: 0,
        target: 0,
        isComplete: false,
        isOnTrack: false,
        daysRemaining: undefined,
        trend: 'stable' as const,
        periodStart: new Date().toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0],
        linkedActivityId: undefined
    };

    // Map universal activities to exercise entries for analytics
    const exerciseEntries = useMemo(() => {
        return universalActivities.flatMap(ua => {
            if (!ua.performance) return [];
            return [{
                id: ua.id,
                date: ua.date,
                type: ua.performance.activityType || 'other',
                durationMinutes: ua.performance.durationMinutes,
                distance: ua.performance.distanceKm,
                caloriesBurned: ua.performance.calories || 0,
                intensity: 'moderate' // Default
            } as any]; // Cast to any or ExerciseEntry to avoid strict type checks on missing fields
        });
    }, [universalActivities]);

    // Calculate correct days remaining from goal dates
    const actualDaysRemaining = useMemo(() => {
        if (!goal.endDate) return undefined;
        const end = new Date(goal.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }, [goal.endDate]);

    // AI Analytics
    const difficulty = useMemo(() => assessGoalDifficulty(goal, exerciseEntries), [goal, exerciseEntries]);
    const aheadBehind = useMemo(() => calculateAheadBehind(goal, progress), [goal, progress]);


    // Days elapsed since goal start
    const daysElapsed = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(goal.startDate);
        startDate.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    }, [goal.startDate]);

    const categoryConfig = CATEGORY_CONFIG[goal.category || 'training'];

    // Get weight entries within goal period
    const relevantWeights = useMemo(() => {
        if (goal.type !== 'weight' && goal.type !== 'measurement') return [];

        const startDate = new Date(goal.startDate);
        const endDate = goal.endDate ? new Date(goal.endDate) : new Date();

        return weightEntries
            .filter(w => {
                const date = new Date(w.date);
                return date >= startDate && date <= endDate;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [weightEntries, goal]);

    // Calculate chart data for weight goals
    const weightChartData = useMemo(() => {
        if (goal.type !== 'weight' || !goal.startDate) return null;

        const startDate = new Date(goal.startDate);
        const endDate = goal.endDate ? new Date(goal.endDate) : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
        const startWeight = goal.milestoneProgress || (relevantWeights[0]?.weight) || 85;
        const targetWeight = goal.targetWeight || 80;

        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const chartWidth = 500;
        const chartHeight = 200;
        const padding = { top: 20, right: 30, bottom: 30, left: 50 };
        const graphWidth = chartWidth - padding.left - padding.right;
        const graphHeight = chartHeight - padding.top - padding.bottom;

        // Weight range
        const weights = [startWeight, targetWeight, ...relevantWeights.map(w => w.weight)];
        const minWeight = Math.min(...weights) - 2;
        const maxWeight = Math.max(...weights) + 2;
        const weightRange = maxWeight - minWeight;

        // Convert date to X position
        const dateToX = (date: Date) => {
            const days = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            return padding.left + (days / totalDays) * graphWidth;
        };

        // Convert weight to Y position
        const weightToY = (weight: number) => {
            return padding.top + graphHeight - ((weight - minWeight) / weightRange) * graphHeight;
        };

        // Trend line (dashed) from start weight to target
        const trendLine = {
            x1: dateToX(startDate),
            y1: weightToY(startWeight),
            x2: dateToX(endDate),
            y2: weightToY(targetWeight)
        };

        // Actual weight points
        const actualPoints = relevantWeights.map(w => ({
            x: dateToX(new Date(w.date)),
            y: weightToY(w.weight),
            weight: w.weight,
            date: w.date
        }));

        // Create path for actual weights
        let actualPath = '';
        if (actualPoints.length > 0) {
            actualPath = `M ${actualPoints[0].x} ${actualPoints[0].y}`;
            for (let i = 1; i < actualPoints.length; i++) {
                actualPath += ` L ${actualPoints[i].x} ${actualPoints[i].y}`;
            }
        }

        // Today marker
        const today = new Date();
        const todayX = Math.min(Math.max(dateToX(today), padding.left), chartWidth - padding.right);

        return {
            chartWidth,
            chartHeight,
            padding,
            graphWidth,
            graphHeight,
            minWeight,
            maxWeight,
            startDate,
            endDate,
            startWeight,
            targetWeight,
            trendLine,
            actualPoints,
            actualPath,
            todayX,
            weightToY,
            dateToX
        };
    }, [goal, relevantWeights]);

    // Calculate comprehensive weight statistics
    const weightStats = useMemo(() => {
        if ((goal.type !== 'weight' && goal.type !== 'measurement') || relevantWeights.length === 0) {
            return null;
        }

        const startWeight = goal.milestoneProgress || relevantWeights[0]?.weight || 0;
        const targetWeight = goal.targetWeight || 0;
        const currentWeight = relevantWeights[relevantWeights.length - 1]?.weight || startWeight;
        const firstWeight = relevantWeights[0]?.weight || startWeight;

        // Total change
        const totalChange = firstWeight - currentWeight;
        const isLoss = totalChange > 0;

        // Daily rate (kg/day)
        const actualDays = daysElapsed || 1;
        const dailyRate = totalChange / actualDays;
        const weeklyRate = dailyRate * 7;

        // Target calculations
        const targetDiff = Math.abs(targetWeight - startWeight);
        const progressToTarget = Math.abs(currentWeight - startWeight);
        const remainingToTarget = Math.abs(targetWeight - currentWeight);

        // Projected completion
        const daysToComplete = dailyRate !== 0 ? Math.ceil(remainingToTarget / Math.abs(dailyRate)) : 0;
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + daysToComplete);

        // Calorie deficit estimation
        // 1 kg of fat ≈ 7700 kcal
        const kcalPerKg = 7700;
        const dailyDeficit = Math.abs(dailyRate) * kcalPerKg;
        const totalCaloriesChange = Math.abs(totalChange) * kcalPerKg;

        // Required rate calculation (if end date exists)
        let requiredDailyRate = 0;
        let requiredDeficit = 0;
        if (goal.endDate && actualDaysRemaining && actualDaysRemaining > 0) {
            requiredDailyRate = remainingToTarget / actualDaysRemaining;
            requiredDeficit = requiredDailyRate * kcalPerKg;
        }

        // Trend (last 7 days vs average)
        const recentWeights = relevantWeights.slice(-7);
        const recentAvg = recentWeights.length > 0
            ? recentWeights.reduce((sum, w) => sum + w.weight, 0) / recentWeights.length
            : currentWeight;
        const overallAvg = relevantWeights.reduce((sum, w) => sum + w.weight, 0) / relevantWeights.length;
        const trend = recentAvg < overallAvg * 0.995 ? 'accelerating' :
            recentAvg > overallAvg * 1.005 ? 'slowing' : 'steady';

        return {
            startWeight,
            currentWeight,
            targetWeight,
            firstRecordedWeight: firstWeight,
            totalChange: Math.abs(totalChange),
            isLoss,
            dailyRate: Math.abs(dailyRate),
            weeklyRate: Math.abs(weeklyRate),
            remainingToTarget,
            progressPercent: targetDiff > 0 ? (progressToTarget / targetDiff) * 100 : 0,
            daysToComplete,
            projectedDate: projectedDate.toISOString().split('T')[0],
            dailyDeficit: Math.round(dailyDeficit),
            totalCaloriesChange: Math.round(totalCaloriesChange),
            requiredDailyRate,
            requiredDeficit: Math.round(requiredDeficit),
            trend,
            measurementCount: relevantWeights.length
        };
    }, [goal, relevantWeights, daysElapsed, actualDaysRemaining]);

    // Calculate chart data for activity-based goals (distance, frequency, tonnage, calories)
    const activityChartData = useMemo(() => {
        if (!['frequency', 'distance', 'tonnage', 'calories'].includes(goal.type)) return null;

        const startDate = new Date(goal.startDate);
        startDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // For ongoing goals, extend 30 days into future; otherwise use end date
        const endDate = goal.endDate
            ? new Date(goal.endDate)
            : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        endDate.setHours(0, 0, 0, 0);

        const targetValue = progress.target || 1;
        const chartWidth = 500;
        const chartHeight = 180;
        const padding = { top: 20, right: 30, bottom: 30, left: 55 };
        const graphWidth = chartWidth - padding.left - padding.right;
        const graphHeight = chartHeight - padding.top - padding.bottom;

        // Get activities in period
        const periodActivities = universalActivities
            .filter(a => {
                const aDate = new Date(a.date);
                aDate.setHours(0, 0, 0, 0);
                return aDate >= startDate && aDate <= today;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Build cumulative progress by date
        const dailyData: { date: Date; value: number; cumulative: number }[] = [];
        let cumulative = 0;

        // Group activities by date and calculate cumulative
        const dateGroups = new Map<string, number>();
        periodActivities.forEach(activity => {
            const dateKey = activity.date;
            let value = 0;

            const perf = activity.performance as any;
            switch (goal.type) {
                case 'frequency':
                    value = 1;
                    break;
                case 'distance':
                    value = perf?.distanceKm || 0;
                    break;
                case 'tonnage':
                    value = (perf?.tonnage || perf?.totalKg || 0) / 1000; // Convert to tons
                    break;
                case 'calories':
                    value = perf?.caloriesBurned || perf?.calories || 0;
                    break;
            }

            dateGroups.set(dateKey, (dateGroups.get(dateKey) || 0) + value);
        });

        // Convert to array with cumulative
        const sortedDates = [...dateGroups.keys()].sort();
        sortedDates.forEach(dateStr => {
            const value = dateGroups.get(dateStr) || 0;
            cumulative += value;
            dailyData.push({
                date: new Date(dateStr),
                value,
                cumulative
            });
        });

        // Calculate ranges
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const maxValue = Math.max(targetValue, cumulative * 1.1) || 1;

        // Convert functions
        const dateToX = (date: Date) => {
            const days = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            return padding.left + (days / totalDays) * graphWidth;
        };

        const valueToY = (value: number) => {
            return padding.top + graphHeight - (value / maxValue) * graphHeight;
        };

        // Create cumulative path
        let cumulativePath = '';
        if (dailyData.length > 0) {
            cumulativePath = `M ${dateToX(startDate)} ${valueToY(0)}`;
            dailyData.forEach(d => {
                cumulativePath += ` L ${dateToX(d.date)} ${valueToY(d.cumulative)}`;
            });
            // Extend to today
            if (dailyData.length > 0) {
                cumulativePath += ` L ${dateToX(today)} ${valueToY(cumulative)}`;
            }
        }

        // Target line (horizontal)
        const targetY = valueToY(targetValue);

        // Trend/projection line (if we have data)
        let projectionPath = '';
        if (dailyData.length >= 2) {
            const dailyRate = cumulative / Math.max(1, daysElapsed);
            const projectedEnd = cumulative + dailyRate * (actualDaysRemaining || 30);
            projectionPath = `M ${dateToX(today)} ${valueToY(cumulative)} L ${dateToX(endDate)} ${valueToY(projectedEnd)}`;
        }

        // Today marker
        const todayX = dateToX(today);

        return {
            chartWidth,
            chartHeight,
            padding,
            graphWidth,
            graphHeight,
            maxValue,
            targetValue,
            startDate,
            endDate,
            dailyData,
            cumulative,
            cumulativePath,
            projectionPath,
            targetY,
            todayX,
            dateToX,
            valueToY,
            isOngoing: !goal.endDate
        };
    }, [goal, universalActivities, progress.target, daysElapsed, actualDaysRemaining]);

    // Calculate Top Activities for Speed Goals
    const topSpeedActivities = useMemo(() => {
        if (goal.type !== 'speed') return [];
        const targetDist = goal.targets[0]?.distanceKm || 0;
        const targetType = goal.targets[0]?.exerciseType; // e.g. 'running'

        return universalActivities
            .filter(a => {
                const dist = a.performance?.distanceKm || 0;
                // Strict type check: must match goal's exercise type (if specified)
                // If goal has no type specified, allow all (fallback), but usually it should have one.
                const typeMatch = targetType ? a.performance?.activityType === targetType : true;

                return typeMatch && dist >= targetDist && a.performance?.durationMinutes;
            })
            .map(a => ({
                ...a,
                projectedTime: ((a.performance?.durationMinutes || 0) * 60) / (a.performance?.distanceKm || 1) * targetDist
            }))
            .sort((a, b) => a.projectedTime - b.projectedTime)
            .slice(0, 5); // Top 5
    }, [universalActivities, goal]);

    // "Backdated" current value for speed goals (if current is 0, show best historical)
    const effectiveCurrent = useMemo(() => {
        if (goal.type === 'speed' && progress.current === 0 && topSpeedActivities.length > 0) {
            return topSpeedActivities[0].projectedTime;
        }
        return progress.current;
    }, [goal.type, progress.current, topSpeedActivities]);

    // Format date for display
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    };

    // Format period label
    const getPeriodLabel = () => {
        switch (goal.period) {
            case 'daily': return '/dag';
            case 'weekly': return '/vecka';
            case 'monthly': return '/månad';
            default: return '';
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md animate-in fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-6 border-b border-white/5"
                    style={{ background: `linear-gradient(135deg, ${categoryConfig.color}15 0%, transparent 100%)` }}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <GoalProgressRing
                                percentage={progress.percentage}
                                size={80}
                                strokeWidth={6}
                                color={categoryConfig.color}
                            />
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">{goal.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded"
                                        style={{
                                            background: `${categoryConfig.color}20`,
                                            color: categoryConfig.color
                                        }}
                                    >
                                        {categoryConfig.icon} {categoryConfig.label}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {getPeriodLabel()}
                                    </span>
                                </div>
                                {progress.isComplete && progress.linkedActivityId && (
                                    <div className="mt-2">
                                        <a
                                            href={`/activity/${progress.linkedActivityId}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-[10px] font-bold px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full hover:bg-emerald-500/20 transition-all flex items-center gap-1 w-fit"
                                        >
                                            <span>🏆 Visa aktivitet</span>
                                            <span>→</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                    {/* Progress Summary */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 text-center">
                            <div className="text-3xl font-black text-white">{(progress.percentage && !isNaN(progress.percentage)) ? Math.round(progress.percentage) : 0}%</div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Progress</div>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 text-center">
                            <div className="text-3xl font-black text-white">
                                {goal.type === 'speed'
                                    ? formatDuration(effectiveCurrent)
                                    : effectiveCurrent.toFixed(goal.type === 'weight' ? 1 : 0)
                                }
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                {goal.type === 'speed' ? 'Bästa Tid' : `Nuvarande ${goal.targets[0]?.unit || ''}`}
                            </div>
                            {progress.current === 0 && goal.type === 'speed' && topSpeedActivities.length > 0 && (
                                <div className="text-[9px] text-slate-600 mt-1">(Historiskt bäst)</div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 text-center">
                            <div className="text-3xl font-black text-white">
                                {goal.type === 'speed' ? formatDuration(progress.target) : progress.target}
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                Mål {goal.targets[0]?.unit || ''}
                            </div>
                        </div>
                    </div>

                    {/* Top Activities List for Speed Goals */}
                    {goal.type === 'speed' && topSpeedActivities.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topplistan ({goal.targets[0]?.distanceKm}km)</h3>
                            <div className="space-y-1">
                                {topSpeedActivities.map((activity, idx) => (
                                    <a
                                        key={activity.id}
                                        href={`/activity/${activity.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-white/5 hover:bg-slate-900/60 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`text-sm font-bold w-6 text-center ${idx === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                                                #{idx + 1}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                    {formatDuration(activity.projectedTime)}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    {formatDate(activity.date)} • {activity.performance?.distanceKm}km <span className="text-slate-400">{
                                                        goal.targets[0]?.exerciseType === 'cycling'
                                                            ? `@ ${formatSpeed(((activity.performance?.durationMinutes || 0) * 60) / (activity.performance?.distanceKm || 1))}`
                                                            : `@ ${Math.floor(activity.performance?.durationMinutes || 0)}m`
                                                    }</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-lg text-slate-600 group-hover:text-white transition-colors">→</div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weight Chart */}
                    {weightChartData && (goal.type === 'weight' || goal.type === 'measurement') && (
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <span>📈</span> Viktutveckling
                            </h3>
                            <svg
                                viewBox={`0 0 ${weightChartData.chartWidth} ${weightChartData.chartHeight}`}
                                className="w-full h-auto"
                            >
                                {/* Grid lines */}
                                {[0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                    const y = weightChartData.padding.top + (1 - ratio) * weightChartData.graphHeight;
                                    const weight = weightChartData.minWeight + ratio * (weightChartData.maxWeight - weightChartData.minWeight);
                                    return (
                                        <g key={i}>
                                            <line
                                                x1={weightChartData.padding.left}
                                                y1={y}
                                                x2={weightChartData.chartWidth - weightChartData.padding.right}
                                                y2={y}
                                                stroke="rgba(255,255,255,0.05)"
                                                strokeWidth="1"
                                            />
                                            <text
                                                x={weightChartData.padding.left - 8}
                                                y={y + 4}
                                                fill="rgba(148,163,184,0.6)"
                                                fontSize="10"
                                                textAnchor="end"
                                            >
                                                {weight.toFixed(0)}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* Target weight line (horizontal dashed) */}
                                <line
                                    x1={weightChartData.padding.left}
                                    y1={weightChartData.weightToY(weightChartData.targetWeight)}
                                    x2={weightChartData.chartWidth - weightChartData.padding.right}
                                    y2={weightChartData.weightToY(weightChartData.targetWeight)}
                                    stroke="#10b981"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 4"
                                    opacity="0.5"
                                />
                                <text
                                    x={weightChartData.chartWidth - weightChartData.padding.right + 5}
                                    y={weightChartData.weightToY(weightChartData.targetWeight) + 4}
                                    fill="#10b981"
                                    fontSize="10"
                                    fontWeight="bold"
                                >
                                    Mål
                                </text>

                                {/* Trend line (dashed diagonal) */}
                                <line
                                    x1={weightChartData.trendLine.x1}
                                    y1={weightChartData.trendLine.y1}
                                    x2={weightChartData.trendLine.x2}
                                    y2={weightChartData.trendLine.y2}
                                    stroke={categoryConfig.color}
                                    strokeWidth="2"
                                    strokeDasharray="8 4"
                                    opacity="0.4"
                                />

                                {/* Today marker */}
                                <line
                                    x1={weightChartData.todayX}
                                    y1={weightChartData.padding.top}
                                    x2={weightChartData.todayX}
                                    y2={weightChartData.chartHeight - weightChartData.padding.bottom}
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="1"
                                    strokeDasharray="3 3"
                                />
                                <text
                                    x={weightChartData.todayX}
                                    y={weightChartData.chartHeight - 10}
                                    fill="rgba(255,255,255,0.5)"
                                    fontSize="9"
                                    textAnchor="middle"
                                >
                                    Idag
                                </text>

                                {/* Actual weight path */}
                                {weightChartData.actualPath && (
                                    <path
                                        d={weightChartData.actualPath}
                                        fill="none"
                                        stroke={categoryConfig.color}
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}

                                {/* Start point */}
                                <circle
                                    cx={weightChartData.trendLine.x1}
                                    cy={weightChartData.trendLine.y1}
                                    r="5"
                                    fill={categoryConfig.color}
                                    opacity="0.5"
                                />

                                {/* Actual weight points */}
                                {weightChartData.actualPoints.map((point, i) => (
                                    <g key={i}>
                                        <circle
                                            cx={point.x}
                                            cy={point.y}
                                            r="6"
                                            fill={categoryConfig.color}
                                            stroke="white"
                                            strokeWidth="2"
                                        />
                                        {/* Tooltip on hover would go here */}
                                    </g>
                                ))}

                                {/* Start date label */}
                                <text
                                    x={weightChartData.padding.left}
                                    y={weightChartData.chartHeight - 10}
                                    fill="rgba(148,163,184,0.6)"
                                    fontSize="9"
                                    textAnchor="start"
                                >
                                    {formatDate(goal.startDate)}
                                </text>

                                {/* End date label */}
                                {goal.endDate && (
                                    <text
                                        x={weightChartData.chartWidth - weightChartData.padding.right}
                                        y={weightChartData.chartHeight - 10}
                                        fill="rgba(148,163,184,0.6)"
                                        fontSize="9"
                                        textAnchor="end"
                                    >
                                        {formatDate(goal.endDate)}
                                    </text>
                                )}
                            </svg>

                            {/* Weight history list */}
                            {relevantWeights.length > 0 && (
                                <div className="mt-4 space-y-1">
                                    <div className="text-xs font-bold text-slate-400 mb-2">Vägningshistorik</div>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {relevantWeights.slice().reverse().map((w, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between text-xs p-2 bg-slate-900/50 rounded-lg"
                                            >
                                                <span className="text-slate-400">{formatDate(w.date)}</span>
                                                <span className="font-bold text-white">{w.weight} kg</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                    )}

                    {/* AI Insights & Stats */}
                    {!progress.isComplete && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Difficulty Rating */}
                            <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
                                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Svårighetsgrad</div>
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl font-black text-white">{difficulty.score}</div>
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-bold ${difficulty.color}`}>{difficulty.label}</span>
                                        <span className="text-[10px] text-slate-500">Baserat på historik</span>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight mt-1 px-1">
                                    Analys av dina {goal.type === 'speed' ? 'snabbaste lopp' : 'senaste prestationer'} jämfört med målet.
                                </div>
                            </div>

                            {/* Ahead/Behind Status */}
                            <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
                                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status</div>
                                <div className="flex items-center gap-3">
                                    <div className={`text-xl font-black ${aheadBehind.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatAheadBehind(calculateAheadBehind(goal, progress).value, goal.type === 'speed' ? 's' : goal.targets[0]?.unit)}
                                        {/* Note: calculateAheadBehind returns text "X unit ahead", we reconstruct or use value */}
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${aheadBehind.value >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                        style={{ width: `${Math.min(100, Math.abs(aheadBehind.value) * 10)}%` }} // Visual approximation
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Weight Statistics */}
                    {weightStats && (goal.type === 'weight' || goal.type === 'measurement') && (
                        <div className="p-4 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl border border-blue-500/10">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <span>📊</span> Viktstatistik
                            </h3>

                            {/* Main stats grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                                    <div className={`text-xl font-black ${weightStats.isLoss ? 'text-emerald-400' : 'text-purple-400'}`}>
                                        {weightStats.isLoss ? '-' : '+'}{weightStats.totalChange.toFixed(1)} kg
                                    </div>
                                    <div className="text-[9px] uppercase font-bold text-slate-500">Total förändring</div>
                                </div>
                                <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                                    <div className={`text-xl font-black ${weightStats.isLoss ? 'text-emerald-400' : 'text-purple-400'}`}>
                                        {weightStats.weeklyRate.toFixed(2)} kg
                                    </div>
                                    <div className="text-[9px] uppercase font-bold text-slate-500">Per vecka</div>
                                </div>
                                <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                                    <div className="text-xl font-black text-white">
                                        {weightStats.remainingToTarget.toFixed(1)} kg
                                    </div>
                                    <div className="text-[9px] uppercase font-bold text-slate-500">Kvar till mål</div>
                                </div>
                                <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                                    <div className="text-xl font-black text-white">
                                        {weightStats.measurementCount}
                                    </div>
                                    <div className="text-[9px] uppercase font-bold text-slate-500">Vägningar</div>
                                </div>
                            </div>

                            {/* Calorie deficit estimation */}
                            <div className="p-3 bg-slate-900/30 rounded-lg mb-3">
                                <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                                    <span>🔥</span> Kaloriunderskott (uppskattat)
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-lg font-black text-amber-400">
                                            ~{weightStats.dailyDeficit.toLocaleString()} kcal
                                        </div>
                                        <div className="text-[9px] uppercase text-slate-500">Dagligt snitt (hållit)</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-black text-white">
                                            ~{weightStats.totalCaloriesChange.toLocaleString()} kcal
                                        </div>
                                        <div className="text-[9px] uppercase text-slate-500">Totalt</div>
                                    </div>
                                </div>
                                {weightStats.requiredDeficit > 0 && (
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">
                                                Krävs för deadline:
                                            </span>
                                            <span className={`font-bold ${weightStats.requiredDeficit > weightStats.dailyDeficit * 1.2 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                ~{weightStats.requiredDeficit.toLocaleString()} kcal/dag
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Trend and projection */}
                            <div className="flex items-center justify-between text-xs p-2 bg-slate-900/30 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className={
                                        weightStats.trend === 'accelerating' ? '📈 text-emerald-400' :
                                            weightStats.trend === 'slowing' ? '📉 text-amber-400' : '➡️ text-slate-400'
                                    }>
                                        {weightStats.trend === 'accelerating' ? '📈' :
                                            weightStats.trend === 'slowing' ? '📉' : '➡️'}
                                    </span>
                                    <span className="text-slate-400">
                                        Trend: {weightStats.trend === 'accelerating' ? 'Accelererande' :
                                            weightStats.trend === 'slowing' ? 'Avtagande' : 'Stabil'}
                                    </span>
                                </div>
                                {weightStats.daysToComplete > 0 && (
                                    <span className="text-slate-500">
                                        Beräknat klart: {formatDate(weightStats.projectedDate)}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Frequency/Volume Progress */}
                    {(goal.type === 'frequency' || goal.type === 'distance' || goal.type === 'tonnage' || goal.type === 'calories') && (
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <span>📊</span>
                                {goal.type === 'frequency' ? 'Aktiviteter' :
                                    goal.type === 'distance' ? 'Distans' :
                                        goal.type === 'tonnage' ? 'Volym' : 'Kalorier'}
                                {activityChartData?.isOngoing && (
                                    <span className="text-[9px] uppercase text-slate-500 ml-auto">Tills vidare (+30 dagar)</span>
                                )}
                            </h3>

                            {/* Cumulative Progress Chart */}
                            {activityChartData && (
                                <svg
                                    viewBox={`0 0 ${activityChartData.chartWidth} ${activityChartData.chartHeight}`}
                                    className="w-full h-auto mb-4"
                                >
                                    {/* Grid lines */}
                                    {[0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                        const y = activityChartData.padding.top + (1 - ratio) * activityChartData.graphHeight;
                                        const val = ratio * activityChartData.maxValue;
                                        return (
                                            <g key={i}>
                                                <line
                                                    x1={activityChartData.padding.left}
                                                    y1={y}
                                                    x2={activityChartData.chartWidth - activityChartData.padding.right}
                                                    y2={y}
                                                    stroke="rgba(255,255,255,0.05)"
                                                    strokeWidth="1"
                                                />
                                                <text
                                                    x={activityChartData.padding.left - 8}
                                                    y={y + 4}
                                                    fill="rgba(148,163,184,0.6)"
                                                    fontSize="9"
                                                    textAnchor="end"
                                                >
                                                    {goal.type === 'frequency' ? val.toFixed(0) : val.toFixed(1)}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Target line (horizontal dashed) */}
                                    <line
                                        x1={activityChartData.padding.left}
                                        y1={activityChartData.targetY}
                                        x2={activityChartData.chartWidth - activityChartData.padding.right}
                                        y2={activityChartData.targetY}
                                        stroke="#10b981"
                                        strokeWidth="1.5"
                                        strokeDasharray="4 4"
                                        opacity="0.6"
                                    />
                                    <text
                                        x={activityChartData.chartWidth - activityChartData.padding.right + 5}
                                        y={activityChartData.targetY + 4}
                                        fill="#10b981"
                                        fontSize="9"
                                        fontWeight="bold"
                                    >
                                        Mål
                                    </text>

                                    {/* Projection line (dashed) */}
                                    {activityChartData.projectionPath && (
                                        <path
                                            d={activityChartData.projectionPath}
                                            fill="none"
                                            stroke={categoryConfig.color}
                                            strokeWidth="1.5"
                                            strokeDasharray="6 4"
                                            opacity="0.4"
                                        />
                                    )}

                                    {/* Today marker */}
                                    <line
                                        x1={activityChartData.todayX}
                                        y1={activityChartData.padding.top}
                                        x2={activityChartData.todayX}
                                        y2={activityChartData.chartHeight - activityChartData.padding.bottom}
                                        stroke="rgba(255,255,255,0.3)"
                                        strokeWidth="1"
                                        strokeDasharray="3 3"
                                    />
                                    <text
                                        x={activityChartData.todayX}
                                        y={activityChartData.chartHeight - 8}
                                        fill="rgba(255,255,255,0.5)"
                                        fontSize="8"
                                        textAnchor="middle"
                                    >
                                        Idag
                                    </text>

                                    {/* Cumulative progress path */}
                                    {activityChartData.cumulativePath && (
                                        <path
                                            d={activityChartData.cumulativePath}
                                            fill="none"
                                            stroke={categoryConfig.color}
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    )}

                                    {/* Activity points */}
                                    {activityChartData.dailyData.map((d, i) => (
                                        <circle
                                            key={i}
                                            cx={activityChartData.dateToX(d.date)}
                                            cy={activityChartData.valueToY(d.cumulative)}
                                            r="4"
                                            fill={categoryConfig.color}
                                            stroke="white"
                                            strokeWidth="1.5"
                                        />
                                    ))}

                                    {/* Start date label */}
                                    <text
                                        x={activityChartData.padding.left}
                                        y={activityChartData.chartHeight - 8}
                                        fill="rgba(148,163,184,0.6)"
                                        fontSize="8"
                                        textAnchor="start"
                                    >
                                        {formatDate(goal.startDate)}
                                    </text>

                                    {/* End date label */}
                                    <text
                                        x={activityChartData.chartWidth - activityChartData.padding.right}
                                        y={activityChartData.chartHeight - 8}
                                        fill="rgba(148,163,184,0.6)"
                                        fontSize="8"
                                        textAnchor="end"
                                    >
                                        {goal.endDate ? formatDate(goal.endDate) : '+30d'}
                                    </text>
                                </svg>
                            )}
                            <div className="relative h-8 bg-slate-800 rounded-lg overflow-hidden mb-4">
                                <div
                                    className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                                    style={{
                                        width: `${(progress.percentage && !isNaN(progress.percentage)) ? Math.min(100, progress.percentage) : 0}%`,
                                        background: `linear-gradient(90deg, ${categoryConfig.color} 0%, ${categoryConfig.color}80 100%)`
                                    }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold text-white drop-shadow-lg">
                                        {progress.current.toFixed(goal.type === 'frequency' ? 0 : 1)} / {progress.target} {goal.targets[0]?.unit || ''}
                                    </span>
                                </div>
                            </div>

                            {/* Remaining info */}
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">
                                    {progress.isComplete
                                        ? '✅ Målet uppnått!'
                                        : `${(progress.target - progress.current).toFixed(goal.type === 'frequency' ? 0 : 1)} ${goal.targets[0]?.unit || 'kvar'}`
                                    }
                                </span>
                                {progress.daysRemaining !== undefined && progress.daysRemaining > 0 && (
                                    <span className="text-slate-500">
                                        {progress.daysRemaining} dagar kvar
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Streak Progress */}
                    {goal.type === 'streak' && (
                        <div className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/5 rounded-xl border border-orange-500/20">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <span>🔥</span> Streak Progress
                            </h3>

                            <div className="flex items-center justify-center gap-1 flex-wrap">
                                {Array.from({ length: progress.target }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-6 h-6 rounded flex items-center justify-center text-xs ${i < progress.current
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-800 text-slate-600'
                                            }`}
                                    >
                                        {i < progress.current ? '🔥' : (i + 1)}
                                    </div>
                                ))}
                            </div>

                            <div className="text-center mt-4 text-sm text-slate-400">
                                {progress.current} av {progress.target} dagar
                            </div>
                        </div>
                    )}

                    {/* Goal Details */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-slate-900/30 rounded-lg">
                            <span className="text-slate-500">Startdatum</span>
                            <div className="text-white font-bold">{formatDate(goal.startDate)}</div>
                        </div>
                        {goal.endDate && (
                            <div className="p-3 bg-slate-900/30 rounded-lg">
                                <span className="text-slate-500">Slutdatum</span>
                                <div className="text-white font-bold">{formatDate(goal.endDate)}</div>
                            </div>
                        )}
                        {actualDaysRemaining !== undefined && (
                            <div className="p-3 bg-slate-900/30 rounded-lg">
                                <span className="text-slate-500">Dagar kvar</span>
                                <div className="text-white font-bold">{actualDaysRemaining}</div>
                            </div>
                        )}
                        <div className="p-3 bg-slate-900/30 rounded-lg">
                            <span className="text-slate-500">Status</span>
                            <div className={`font-bold ${progress.isOnTrack ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {progress.isComplete ? '✅ Klart' : progress.isOnTrack ? '✓ På spår' : '⚠️ Halkar efter'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 flex gap-3 justify-end">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors"
                        >
                            ✏️ Redigera
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl text-slate-400 hover:text-white text-sm font-bold transition-colors"
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div >
    );
}
