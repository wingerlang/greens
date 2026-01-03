import React from 'react';
import { PerformanceGoal, PerformanceGoalType } from '../../../models/types';

interface GoalTemplateRowProps {
    goal: Omit<PerformanceGoal, 'id' | 'createdAt' | 'periodId'>;
    onChange: (updated: Omit<PerformanceGoal, 'id' | 'createdAt' | 'periodId'>) => void;
}

export const GoalTemplateRow: React.FC<GoalTemplateRowProps> = ({ goal, onChange }) => {

    // Helper to get the primary value from targets
    const getPrimaryValue = () => {
        if (goal.type === 'weight') return goal.targetWeight || 0;
        if (goal.type === 'nutrition') return goal.targets[0]?.value || goal.nutritionMacros?.calories || 0;
        if (goal.targets && goal.targets.length > 0) return goal.targets[0].value || goal.targets[0].count || 0;
        return 0;
    };

    const getUnit = () => {
        if (goal.type === 'weight') return 'kg';
        if (goal.type === 'nutrition') return 'kcal';
        if (goal.type === 'streak') return goal.category === 'nutrition' ? 'dagar' : 'pass';
        if (goal.targets && goal.targets.length > 0) return goal.targets[0].unit || (goal.targets[0].count ? 'pass' : '');
        return '';
    };

    const handleChange = (val: string) => {
        const updated = { ...goal };
        const num = parseFloat(val);
        const safeVal = isNaN(num) ? 0 : num; // Or handle as null if model supports it, but keeping 0 for safety based on current types

        if (goal.type === 'weight') {
            updated.targetWeight = safeVal;
        } else if (goal.type === 'nutrition') {
            if (!updated.targets[0]) updated.targets[0] = { nutritionType: 'calories' };
            updated.targets[0].value = safeVal;
            updated.nutritionMacros = { ...updated.nutritionMacros, calories: safeVal };
        } else {
            if (!updated.targets[0]) updated.targets[0] = {};
            if (goal.type === 'frequency' || goal.type === 'streak') {
                updated.targets[0].count = safeVal;
            } else {
                updated.targets[0].value = safeVal;
            }
        }
        onChange(updated);
    };

    const iconMap: Record<string, string> = {
        weight: '⚖️',
        nutrition: '🥗',
        measurement: '📏',
        frequency: '📅',
        distance: '🏃',
        tonnage: '🏋️',
        streak: '🔥'
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full text-xl">
                {iconMap[goal.type] || '🎯'}
            </div>

            <div className="flex-1">
                <div className="text-sm font-medium text-white">{goal.name}</div>
                <div className="text-xs text-white/50 capitalize">{goal.period === 'once' ? 'Slutmål' : goal.period}</div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="number"
                    className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-emerald-500"
                    value={getPrimaryValue() || ''}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder="0"
                />
                <span className="text-xs text-white/50 w-8">{getUnit()}</span>
            </div>
        </div>
    );
};
