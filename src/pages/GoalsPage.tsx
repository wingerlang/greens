/**
 * GoalsPage - Dedicated page for comprehensive goal management
 * Route: /goals
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
    useActiveGoals,
    useCompletedGoals,
    useGoalsSummary,
    useGoalsByCategory,
    useTrainingStreak
} from '../hooks/useGoalProgress';
import { GoalProgressRing, MiniProgressRing } from '../components/goals/GoalProgressRing';
import { GoalCelebration } from '../components/goals/GoalCelebration';
import { GoalDetailModal } from '../components/goals/GoalDetailModal';
import { GoalModal } from '../components/training/GoalModal';
import { PeriodWizard } from '../components/training/period/PeriodWizard';
import { CompactGoalCard } from '../components/goals/CompactGoalCard';
import { useNavigate } from 'react-router-dom';
import type { PerformanceGoal, GoalCategory, PerformanceGoalType, GoalPeriod } from '../models/types';
import './GoalsPage.css';

// Category config
const CATEGORY_CONFIG: Record<GoalCategory, { label: string; icon: string; color: string }> = {
    training: { label: 'Träning', icon: '🏋️', color: '#10b981' },
    nutrition: { label: 'Kost', icon: '🥗', color: '#f59e0b' },
    body: { label: 'Kropp', icon: '⚖️', color: '#3b82f6' },
    lifestyle: { label: 'Livsstil', icon: '🧘', color: '#8b5cf6' }
};

// Goal type icons
const GOAL_TYPE_ICONS: Record<string, string> = {
    frequency: '🔢',
    distance: '📏',
    tonnage: '🏋️',
    calories: '🔥',
    streak: '🔥',
    milestone: '🏆',
    pb: '⚡',
    nutrition: '🥗',
    weight: '⚖️',
    measurement: '📐',
    combination: '🎯'
};

// Quick templates for common goals
interface GoalTemplate {
    name: string;
    icon: string;
    type: PerformanceGoalType;
    period: GoalPeriod;
    category: GoalCategory;
    targetCount?: number;
    targetValue?: number;
    targetUnit?: string;
    exerciseType?: string;
    description: string;
}

const GOAL_TEMPLATES: GoalTemplate[] = [
    {
        name: '3x Styrkepass',
        icon: '💪',
        type: 'frequency',
        period: 'weekly',
        category: 'training',
        targetCount: 3,
        exerciseType: 'strength',
        description: 'Tre styrkepass per vecka'
    },
    {
        name: '30 km Löpning',
        icon: '🏃',
        type: 'distance',
        period: 'weekly',
        category: 'training',
        targetValue: 30,
        targetUnit: 'km',
        exerciseType: 'running',
        description: 'Springa 30 km per vecka'
    },
    {
        name: '7 Dagars Streak',
        icon: '🔥',
        type: 'streak',
        period: 'daily',
        category: 'lifestyle',
        targetValue: 7,
        description: 'Träna varje dag i en vecka'
    },
    {
        name: '150g Protein',
        icon: '🌱',
        type: 'nutrition',
        period: 'daily',
        category: 'nutrition',
        targetValue: 150,
        targetUnit: 'g',
        description: 'Dagligt proteinmål'
    },
    {
        name: '10 000 kcal/vecka',
        icon: '🔥',
        type: 'calories',
        period: 'weekly',
        category: 'training',
        targetValue: 10000,
        targetUnit: 'kcal',
        description: 'Bränn 10 000 kcal per vecka'
    },
    {
        name: '5 Ton Lyftat',
        icon: '🏋️',
        type: 'tonnage',
        period: 'weekly',
        category: 'training',
        targetValue: 5,
        targetUnit: 'ton',
        description: 'Lyft 5 ton per vecka'
    },
    {
        name: 'Gå ner 5 kg',
        icon: '⚖️',
        type: 'weight',
        period: 'once',
        category: 'body',
        targetValue: 5,
        targetUnit: 'kg',
        description: 'Viktminskning på 3 månader'
    },
    {
        name: 'Minska midja',
        icon: '📐',
        type: 'measurement',
        period: 'once',
        category: 'body',
        targetValue: 5,
        targetUnit: 'cm',
        description: 'Minska midjemått med 5 cm'
    },
];

// Sorting options
type SortOption = 'progress' | 'deadline' | 'category' | 'name';

export function GoalsPage() {
    const { performanceGoals = [], trainingCycles = [], trainingPeriods = [], addGoal, updateGoal, deleteGoal } = useData();
    const navigate = useNavigate();

    // State
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPeriodWizardOpen, setIsPeriodWizardOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<PerformanceGoal | null>(null);
    const [celebratingGoal, setCelebratingGoal] = useState<PerformanceGoal | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('progress');
    const [sortAsc, setSortAsc] = useState(false);
    const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    // Derived state from URL - Source of Truth
    const viewingGoalId = searchParams.get('goal');
    const viewingGoal = useMemo(() =>
        viewingGoalId ? performanceGoals.find(g => g.id === viewingGoalId) || null : null,
        [viewingGoalId, performanceGoals]);

    // Active Training Period
    const activePeriod = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return trainingPeriods.find(p => p.startDate <= today && p.endDate >= today) || trainingPeriods[0];
    }, [trainingPeriods]);

    // Hooks
    const activeGoals = useActiveGoals();
    const completedGoals = useCompletedGoals();
    const summary = useGoalsSummary();
    const goalsByCategory = useGoalsByCategory();
    const trainingStreak = useTrainingStreak();

    // Filter and sort goals
    const filteredGoals = useMemo(() => {
        // Exclude goals that are part of an ACTIVE period (they are shown in the period card or separate section)
        // Actually, user requirement #8 says "Group them nicely", not hide them.
        // Let's separate them into "Period Goals" and "Loose Goals" if we are in 'all' view.

        let goals = selectedCategory === 'all'
            ? [...activeGoals]
            : activeGoals.filter(({ goal }) => goal.category === selectedCategory);

        // Sort
        goals.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'progress':
                    comparison = b.progress.percentage - a.progress.percentage;
                    break;
                case 'deadline':
                    const aDeadline = a.progress.daysRemaining ?? Infinity;
                    const bDeadline = b.progress.daysRemaining ?? Infinity;
                    comparison = aDeadline - bDeadline;
                    break;
                case 'category':
                    comparison = (a.goal.category || 'training').localeCompare(b.goal.category || 'training');
                    break;
                case 'name':
                    comparison = a.goal.name.localeCompare(b.goal.name);
                    break;
            }
            return sortAsc ? -comparison : comparison;
        });

        return goals;
    }, [activeGoals, selectedCategory, sortBy, sortAsc]);

    const handleEditGoal = (goal: PerformanceGoal) => {
        setEditingGoal(goal);
        setIsModalOpen(true);
    };

    const handleNewGoal = () => {
        setEditingGoal(null);
        setIsModalOpen(true);
    };

    const handleSaveGoal = (goalData: Omit<PerformanceGoal, 'id' | 'createdAt'>) => {
        if (editingGoal) {
            updateGoal(editingGoal.id, goalData);
        } else {
            addGoal({
                ...goalData,
                category: goalData.category || 'training',
                status: 'active'
            } as any);
        }
        setIsModalOpen(false);
    };

    const handleCompleteGoal = (goal: PerformanceGoal) => {
        updateGoal(goal.id, {
            status: 'completed',
            completedAt: new Date().toISOString().split('T')[0]
        });
        setCelebratingGoal(goal);
    };

    const handleDeleteGoal = (goalId: string) => {
        setDeletingGoalId(goalId);
    };

    const confirmDeleteGoal = () => {
        if (deletingGoalId) {
            deleteGoal(deletingGoalId);
            setDeletingGoalId(null);
        }
    };

    const handleUseTemplate = (template: GoalTemplate) => {
        const goalData: any = {
            name: template.name,
            type: template.type,
            period: template.period,
            category: template.category,
            status: 'active',
            startDate: new Date().toISOString().split('T')[0],
            targets: [{
                exerciseType: template.exerciseType,
                count: template.targetCount,
                value: template.targetValue,
                unit: template.targetUnit
            }]
        };

        if (template.type === 'streak') {
            goalData.milestoneValue = template.targetValue;
        }

        addGoal(goalData);
        setShowTemplates(false);
    };

    const toggleSort = (option: SortOption) => {
        if (sortBy === option) {
            setSortAsc(!sortAsc);
        } else {
            setSortBy(option);
            setSortAsc(false);
        }
    };

    // Format progress numbers nicely
    const formatProgress = (current: number, target: number, unit?: string) => {
        const formatNum = (n: number) => {
            if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
            // If it's effectively an integer, show as integer
            if (Math.abs(n % 1) < 0.01) return Math.round(n).toString();
            if (n >= 10) return parseFloat(n.toFixed(1)).toString();
            return parseFloat(n.toFixed(2)).toString();
        };

        return `${formatNum(current)} / ${formatNum(target)}${unit ? ` ${unit}` : ''}`;
    };

    // Group goals by Period (only if All is selected)
    const { periodGoals, looseGoals } = useMemo(() => {
        if (selectedCategory !== 'all') return { periodGoals: [], looseGoals: filteredGoals };

        const periodMap = new Map<string, typeof filteredGoals>();
        const loose: typeof filteredGoals = [];

        filteredGoals.forEach(item => {
            // Check if goal has a period ID AND that period actually exists
            const pid = item.goal.periodId;
            const periodExists = pid && trainingPeriods.some(p => p.id === pid);

            if (periodExists && pid) {
                if (!periodMap.has(pid)) periodMap.set(pid, []);
                periodMap.get(pid)?.push(item);
            } else {
                // If periodId is missing OR points to a non-existent period (deleted), treat as loose
                loose.push(item);
            }
        });

        return {
            periodGoals: Array.from(periodMap.entries()).map(([id, items]) => {
                const period = trainingPeriods.find(p => p.id === id);
                return { period, items };
            }), // No filter needed as we pre-checked existence
            looseGoals: loose
        };
    }, [filteredGoals, selectedCategory, trainingPeriods]);

    return (
        <div className="goals-page pb-24">
            {/* Hero Section */}
            <header className="goals-hero relative">
                <div className="goals-hero-content">
                    <div className="goals-hero-text">
                        <h1>🎯 Mina Mål</h1>
                        <p className="goals-subtitle">
                            Spåra, uppnå och fira dina framsteg
                        </p>

                        {/* New Feature: Active Period Card */}
                        {activePeriod ? (
                            <button
                                onClick={() => navigate(`/training/period/${activePeriod.id}`)}
                                className="mt-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl hover:bg-emerald-500/20 transition-all text-left group"
                            >
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                    🚀
                                </div>
                                <div>
                                    <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Aktiv Period</div>
                                    <div className="font-bold text-white group-hover:text-emerald-300 transition-colors">{activePeriod.name}</div>
                                </div>
                                <div className="ml-auto text-emerald-400/50 group-hover:text-emerald-400">→</div>
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsPeriodWizardOpen(true)}
                                className="mt-4 inline-flex items-center gap-2 text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-white/70 hover:text-white transition-all"
                            >
                                ✨ Starta Träningsperiod
                            </button>
                        )}
                    </div>

                    {/* Summary Ring */}
                    <div className="goals-hero-ring">
                        <GoalProgressRing
                            percentage={summary.averageProgress}
                            size={140}
                            strokeWidth={10}
                        >
                            <div className="text-center">
                                <span className="text-3xl font-black text-white">
                                    {summary.activeCount}
                                </span>
                                <span className="block text-[10px] text-slate-500 uppercase font-bold">
                                    Aktiva
                                </span>
                            </div>
                        </GoalProgressRing>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="goals-summary-stats">
                    <div className="stat-card">
                        <span className="stat-icon">✅</span>
                        <div className="stat-content">
                            <span className="stat-value">{summary.completedCount}</span>
                            <span className="stat-label">Avklarade</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-icon">🎯</span>
                        <div className="stat-content">
                            <span className="stat-value">{summary.onTrackCount}</span>
                            <span className="stat-label">På rätt spår</span>
                        </div>
                    </div>
                    <div className="stat-card streak">
                        <span className="stat-icon">🔥</span>
                        <div className="stat-content">
                            <span className="stat-value">{trainingStreak.current}</span>
                            <span className="stat-label">Dagars Streak</span>
                        </div>
                        {trainingStreak.best > trainingStreak.current && (
                            <span className="stat-best" title="Personbästa">
                                🏆 {trainingStreak.best}
                            </span>
                        )}
                    </div>
                    <div className="stat-card">
                        <span className="stat-icon">📈</span>
                        <div className="stat-content">
                            <span className="stat-value">{Math.round(summary.averageProgress)}%</span>
                            <span className="stat-label">Snitt Progress</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Category Tabs */}
            <div className="goals-category-tabs">
                <button
                    className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                >
                    <span className="tab-icon">📋</span>
                    <span className="tab-label">Alla</span>
                    <span className="tab-count">{activeGoals.length}</span>
                </button>
                {(Object.keys(CATEGORY_CONFIG) as GoalCategory[]).map(cat => (
                    <button
                        key={cat}
                        className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                        style={{ '--accent': CATEGORY_CONFIG[cat].color } as React.CSSProperties}
                    >
                        <span className="tab-icon">{CATEGORY_CONFIG[cat].icon}</span>
                        <span className="tab-label">{CATEGORY_CONFIG[cat].label}</span>
                        <span className="tab-count">
                            {goalsByCategory[cat]?.length || 0}
                        </span>
                    </button>
                ))}
            </div>

            {/* Active Goals Grid */}
            <section className="goals-section">
                <div className="section-header">
                    <h2>Aktiva Mål</h2>
                    <div className="section-controls">
                        {/* Sort buttons */}
                        <div className="sort-controls">
                            <span className="sort-label">Sortera:</span>
                            <button
                                className={`sort-btn ${sortBy === 'progress' ? 'active' : ''}`}
                                onClick={() => toggleSort('progress')}
                            >
                                📊 {sortBy === 'progress' && (sortAsc ? '↑' : '↓')}
                            </button>
                            <button
                                className={`sort-btn ${sortBy === 'deadline' ? 'active' : ''}`}
                                onClick={() => toggleSort('deadline')}
                            >
                                ⏰ {sortBy === 'deadline' && (sortAsc ? '↑' : '↓')}
                            </button>
                            <button
                                className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
                                onClick={() => toggleSort('name')}
                            >
                                Aa {sortBy === 'name' && (sortAsc ? '↑' : '↓')}
                            </button>
                        </div>
                        <button
                            className="template-btn"
                            onClick={() => setShowTemplates(!showTemplates)}
                        >
                            ✨ Mallar
                        </button>
                        <button className="add-goal-btn" onClick={handleNewGoal}>
                            + Nytt Mål
                        </button>
                        <button
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm transition-colors"
                            onClick={() => setIsPeriodWizardOpen(true)}
                        >
                            🚀 Starta Period
                        </button>
                    </div>
                </div>

                {/* Quick Templates */}
                {showTemplates && (
                    <div className="templates-grid">
                        {GOAL_TEMPLATES.map((template, i) => (
                            <button
                                key={i}
                                className="template-card"
                                onClick={() => handleUseTemplate(template)}
                            >
                                <span className="template-icon">{template.icon}</span>
                                <div className="template-info">
                                    <span className="template-name">{template.name}</span>
                                    <span className="template-desc">{template.description}</span>
                                </div>
                                <span className="template-badge" style={{
                                    background: CATEGORY_CONFIG[template.category].color + '20',
                                    color: CATEGORY_CONFIG[template.category].color
                                }}>
                                    {template.period === 'daily' ? '/dag' : '/vecka'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {filteredGoals.length > 0 ? (
                    <div className="space-y-8">
                        {/* 1. Period Groups (if any) */}
                        {periodGoals.map(({ period, items }) => (
                            <div key={period!.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div
                                    className="flex justify-between items-center mb-3 cursor-pointer group"
                                    onClick={() => navigate(`/training/period/${period!.id}`)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
                                        <div>
                                            <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                {period!.name}
                                            </h3>
                                            <div className="text-[10px] text-white/50 uppercase tracking-wide">
                                                {period!.focusType} Period
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                        Visa Dashboard →
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {items.map(({ goal }) => (
                                        <CompactGoalCard
                                            key={goal.id}
                                            goal={goal}
                                            onClick={() => setSearchParams({ goal: goal.id })}
                                            onEdit={handleEditGoal}
                                            onDelete={handleDeleteGoal}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* 2. Loose Goals */}
                        {looseGoals.length > 0 && (
                            <div>
                                {periodGoals.length > 0 && (
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 ml-1">Övriga Mål</h3>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {looseGoals.map(({ goal, progress }) => (
                                        <div
                                            key={goal.id}
                                            className={`goal-card ${progress.isComplete ? 'complete' : ''} ${!progress.isOnTrack && !progress.isComplete ? 'off-track' : ''}`}
                                            style={{ '--accent': CATEGORY_CONFIG[goal.category || 'training'].color } as React.CSSProperties}
                                            onClick={() => setSearchParams({ goal: goal.id })}
                                        >
                                            {/* Category badge */}
                                            <div className="goal-category-badge">
                                                {CATEGORY_CONFIG[goal.category || 'training'].icon}
                                            </div>

                                            {/* Progress Ring - Smaller */}
                                            <div className="goal-ring">
                                                <GoalProgressRing
                                                    percentage={progress.percentage}
                                                    size={60}
                                                    strokeWidth={5}
                                                    color={CATEGORY_CONFIG[goal.category || 'training'].color}
                                                >
                                                    <span className="text-sm">{GOAL_TYPE_ICONS[goal.type] || '🎯'}</span>
                                                </GoalProgressRing>
                                            </div>

                                            {/* Goal Info */}
                                            <div className="goal-info">
                                                <h3 className="goal-name">{goal.name}</h3>
                                                {goal.description && (
                                                    <p className="text-[10px] text-slate-500 mb-2 line-clamp-2">{goal.description}</p>
                                                )}
                                                <div className="goal-meta flex-col gap-1 mb-3">
                                                    <span className="text-2xl font-black text-white tracking-tight">
                                                        {formatProgress(
                                                            progress.current,
                                                            progress.target
                                                        )}
                                                        <span className="text-sm font-bold text-slate-500 ml-1">
                                                            {goal.targets[0]?.unit || (goal.type === 'frequency' ? 'pass' : '')}
                                                        </span>
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                        {goal.type === 'frequency'
                                                            ? (goal.period === 'weekly' ? 'i veckan' : 'totalt')
                                                            : (goal.period === 'weekly' ? 'per vecka' : 'kvar att göra')
                                                        }
                                                    </span>
                                                </div>

                                                {/* Progress bar with percentage */}
                                                <div className="goal-progress-container">
                                                    <div className="goal-progress-bar">
                                                        <div
                                                            className="goal-progress-fill"
                                                            style={{ width: `${(progress.percentage && !isNaN(progress.percentage)) ? Math.min(100, progress.percentage) : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="goal-percentage">{(progress.percentage && !isNaN(progress.percentage)) ? Math.round(progress.percentage) : 0}%</span>
                                                </div>

                                                {/* Status badges */}
                                                <div className="goal-badges">
                                                    {progress.isComplete && (
                                                        <span className="badge badge-complete">✓ Klart</span>
                                                    )}
                                                    {!progress.isOnTrack && !progress.isComplete && (
                                                        <span className="badge badge-warning">⚠️ Halkar efter</span>
                                                    )}
                                                    {progress.daysRemaining !== undefined && progress.daysRemaining <= 3 && !progress.isComplete && (
                                                        <span className="badge badge-urgent">
                                                            ⏰ {progress.daysRemaining}d kvar
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Absolute X button for quick delete */}
                                            <button
                                                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors z-10"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                                                title="Ta bort mål"
                                            >
                                                ✕
                                            </button>

                                            {/* Actions */}
                                            <div className="goal-actions">
                                                {progress.isComplete && (
                                                    <button
                                                        className="action-btn celebrate"
                                                        onClick={(e) => { e.stopPropagation(); handleCompleteGoal(goal); }}
                                                    >
                                                        🎉 Fira
                                                    </button>
                                                )}
                                                <button
                                                    className="action-btn edit"
                                                    onClick={(e) => { e.stopPropagation(); handleEditGoal(goal); }}
                                                    title="Redigera"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                                                    title="Ta bort"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="goals-empty">
                        <span className="empty-icon">🎯</span>
                        <h3>Inga aktiva mål</h3>
                        <p>Skapa ditt första mål eller välj från mallarna!</p>
                        <div className="empty-actions">
                            <button
                                className="template-btn large"
                                onClick={() => setShowTemplates(true)}
                            >
                                ✨ Välj Mall
                            </button>
                            <button className="add-goal-btn large" onClick={handleNewGoal}>
                                + Skapa Mål
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
                <section className="goals-section completed">
                    <button
                        className="section-header collapsible"
                        onClick={() => setShowCompleted(!showCompleted)}
                    >
                        <h2>
                            ✅ Avklarade Mål
                            <span className="count">({completedGoals.length})</span>
                        </h2>
                        <span className={`chevron ${showCompleted ? 'open' : ''}`}>▼</span>
                    </button>

                    {showCompleted && (
                        <div className="completed-goals-list">
                            {completedGoals.map(goal => (
                                <div key={goal.id} className="completed-goal-item">
                                    <MiniProgressRing percentage={100} color="#10b981" />
                                    <div className="completed-goal-info">
                                        <span className="completed-goal-name">{goal.name}</span>
                                        <span className="completed-goal-date">
                                            Avslutat {goal.completedAt || goal.endDate || '—'}
                                        </span>
                                    </div>
                                    <span className="completed-goal-icon">
                                        {GOAL_TYPE_ICONS[goal.type]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Floating Action Button */}
            <button className="goals-fab" onClick={handleNewGoal} title="Nytt mål">
                <span>+</span>
            </button>

            {/* Goal Modal */}
            <GoalModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveGoal}
                cycles={trainingCycles}
                editingGoal={editingGoal}
            />

            {/* Period Wizard */}
            <PeriodWizard
                isOpen={isPeriodWizardOpen}
                onClose={() => setIsPeriodWizardOpen(false)}
                onSave={() => {
                    // Refresh handled by context, maybe show celebration?
                }}
            />

            {/* Celebration Modal */}
            {celebratingGoal && (
                <GoalCelebration
                    goal={celebratingGoal}
                    onClose={() => setCelebratingGoal(null)}
                    onNewGoal={() => {
                        setCelebratingGoal(null);
                        handleNewGoal();
                    }}
                />
            )}

            {/* Goal Detail Modal */}
            {viewingGoal && (
                <GoalDetailModal
                    goal={viewingGoal}
                    onClose={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete('goal');
                        setSearchParams(newParams);
                    }}
                    onEdit={() => {
                        // Keep the URL param or remove it? Usually keep context or close detail to open edit.
                        // Let's close detail and open edit modal.
                        setEditingGoal(viewingGoal);
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete('goal');
                        setSearchParams(newParams);
                        setIsModalOpen(true);
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deletingGoalId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeletingGoalId(null)}>
                    <div
                        className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-2xl">🗑️</div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Ta bort mål?</h3>
                                <p className="text-sm text-slate-400">Detta kan inte ångras.</p>
                            </div>
                        </div>
                        <p className="text-slate-300">
                            Är du säker på att du vill ta bort detta mål? All progress och historik försvinner.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingGoalId(null)}
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={confirmDeleteGoal}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors"
                            >
                                Ja, ta bort
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
