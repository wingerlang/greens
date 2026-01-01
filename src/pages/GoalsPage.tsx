/**
 * GoalsPage - Dedicated page for comprehensive goal management
 * Route: /goals
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { GoalModal } from '../components/training/GoalModal';
import type { PerformanceGoal, GoalCategory } from '../models/types';
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
    combination: '🎯'
};

export function GoalsPage() {
    const navigate = useNavigate();
    const { performanceGoals = [], trainingCycles = [], addGoal, updateGoal, deleteGoal } = useData();

    // State
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<PerformanceGoal | null>(null);
    const [celebratingGoal, setCelebratingGoal] = useState<PerformanceGoal | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);

    // Hooks
    const activeGoals = useActiveGoals();
    const completedGoals = useCompletedGoals();
    const summary = useGoalsSummary();
    const goalsByCategory = useGoalsByCategory();
    const trainingStreak = useTrainingStreak();

    // Filter goals by category
    const filteredGoals = useMemo(() => {
        if (selectedCategory === 'all') return activeGoals;
        return activeGoals.filter(({ goal }) => goal.category === selectedCategory);
    }, [activeGoals, selectedCategory]);

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
            // Add default category and status for new goals
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
        if (confirm('Är du säker på att du vill ta bort detta mål?')) {
            deleteGoal(goalId);
        }
    };

    return (
        <div className="goals-page">
            {/* Hero Section */}
            <header className="goals-hero">
                <div className="goals-hero-content">
                    <div className="goals-hero-text">
                        <h1>🎯 Mina Mål</h1>
                        <p className="goals-subtitle">
                            Spåra, uppnå och fira dina framsteg
                        </p>
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
                    <button className="add-goal-btn" onClick={handleNewGoal}>
                        + Nytt Mål
                    </button>
                </div>

                {filteredGoals.length > 0 ? (
                    <div className="goals-grid">
                        {filteredGoals.map(({ goal, progress }) => (
                            <div
                                key={goal.id}
                                className={`goal-card ${progress.isComplete ? 'complete' : ''} ${!progress.isOnTrack ? 'off-track' : ''}`}
                                style={{ '--accent': CATEGORY_CONFIG[goal.category || 'training'].color } as React.CSSProperties}
                            >
                                {/* Category badge */}
                                <div className="goal-category-badge">
                                    {CATEGORY_CONFIG[goal.category || 'training'].icon}
                                </div>

                                {/* Progress Ring */}
                                <div className="goal-ring">
                                    <GoalProgressRing
                                        percentage={progress.percentage}
                                        size={80}
                                        strokeWidth={6}
                                        color={CATEGORY_CONFIG[goal.category || 'training'].color}
                                    >
                                        <span className="text-lg">{GOAL_TYPE_ICONS[goal.type] || '🎯'}</span>
                                    </GoalProgressRing>
                                </div>

                                {/* Goal Info */}
                                <div className="goal-info">
                                    <h3 className="goal-name">{goal.name}</h3>
                                    <div className="goal-meta">
                                        <span className="goal-progress">
                                            {progress.current.toFixed(1)} / {progress.target}
                                            {goal.targets[0]?.unit ? ` ${goal.targets[0].unit}` : ''}
                                        </span>
                                        <span className="goal-period">
                                            {goal.period === 'daily' ? '/dag' :
                                                goal.period === 'weekly' ? '/vecka' :
                                                    goal.period === 'monthly' ? '/månad' : 'totalt'}
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="goal-progress-bar">
                                        <div
                                            className="goal-progress-fill"
                                            style={{ width: `${Math.min(100, progress.percentage)}%` }}
                                        />
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
                                            <span className="badge badge-urgent">⏰ {progress.daysRemaining}d kvar</span>
                                        )}
                                        {goal.streakCurrent && goal.streakCurrent > 0 && (
                                            <span className="badge badge-streak">🔥 {goal.streakCurrent}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="goal-actions">
                                    {progress.isComplete && (
                                        <button
                                            className="action-btn celebrate"
                                            onClick={() => handleCompleteGoal(goal)}
                                        >
                                            🎉 Fira
                                        </button>
                                    )}
                                    <button
                                        className="action-btn edit"
                                        onClick={() => handleEditGoal(goal)}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="action-btn delete"
                                        onClick={() => handleDeleteGoal(goal.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="goals-empty">
                        <span className="empty-icon">🎯</span>
                        <h3>Inga aktiva mål</h3>
                        <p>Skapa ditt första mål för att börja spåra dina framsteg!</p>
                        <button className="add-goal-btn large" onClick={handleNewGoal}>
                            + Skapa Mål
                        </button>
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
            <button className="goals-fab" onClick={handleNewGoal}>
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
        </div>
    );
}
