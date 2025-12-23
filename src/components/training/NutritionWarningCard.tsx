import React, { useState } from 'react';
import { NutritionWarning, QuickNutritionItem, QUICK_NUTRITION_ITEMS } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';

interface NutritionWarningCardProps {
    warning: NutritionWarning;
    onDismiss?: (id: string) => void;
}

const SEVERITY_STYLES = {
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'ℹ️', text: 'text-blue-400' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: '⚠️', text: 'text-amber-400' },
    critical: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: '🚨', text: 'text-rose-400' }
};

const WARNING_TYPE_LABELS: Record<NutritionWarning['type'], string> = {
    leg_run_conflict: 'Ben + Löpning Konflikt',
    calorie_deficit: 'Kaloriunderskott',
    recovery_needed: 'Återhämtning Krävs',
    hydration_reminder: 'Vätskevarning',
    post_run_nutrition: 'Återhämtningsnäring'
};

export function NutritionWarningCard({ warning, onDismiss }: NutritionWarningCardProps) {
    const styles = SEVERITY_STYLES[warning.severity];

    if (warning.dismissed) return null;

    return (
        <div className={`nutrition-warning p-3 rounded-xl ${styles.bg} border ${styles.border} flex items-start gap-3`}>
            <span className="text-xl mt-0.5">{styles.icon}</span>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}>
                        {WARNING_TYPE_LABELS[warning.type]}
                    </div>
                    {onDismiss && (
                        <button
                            onClick={() => onDismiss(warning.id)}
                            className="text-slate-500 hover:text-white text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <p className="text-xs text-slate-300 mt-1">{warning.message}</p>
                {warning.suggestedAction && (
                    <p className="text-[10px] text-slate-500 mt-2 italic">💡 {warning.suggestedAction}</p>
                )}
            </div>
        </div>
    );
}

// ============================================
// Post-Run Nutrition Modal
// ============================================

interface PostRunNutritionModalProps {
    isOpen: boolean;
    onClose: () => void;
    activityId?: string;
    distanceKm: number;
    durationMinutes: number;
    onLogNutrition?: (items: QuickNutritionItem[]) => void;
}

export function PostRunNutritionModal({ isOpen, onClose, distanceKm, durationMinutes, onLogNutrition }: PostRunNutritionModalProps) {
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    if (!isOpen) return null;

    const toggleItem = (id: string) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleLog = () => {
        const items = QUICK_NUTRITION_ITEMS.filter(i => selectedItems.includes(i.id));
        onLogNutrition?.(items);
        onClose();
    };

    const totalCalories = selectedItems.reduce((sum, id) => {
        const item = QUICK_NUTRITION_ITEMS.find(i => i.id === id);
        return sum + (item?.calories || 0);
    }, 0);

    const totalCarbs = selectedItems.reduce((sum, id) => {
        const item = QUICK_NUTRITION_ITEMS.find(i => i.id === id);
        return sum + (item?.carbs || 0);
    }, 0);

    const estimatedBurn = Math.round(distanceKm * 70); // ~70 kcal/km rough estimate

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-black text-white">🥤 Återhämtningsnäring</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Logga snabbt efter passet</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
                </div>

                {/* Run Summary */}
                <div className="flex gap-4 mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div>
                        <div className="text-[9px] text-slate-500 uppercase">Distans</div>
                        <div className="text-lg font-black text-emerald-400">{distanceKm.toFixed(1)} km</div>
                    </div>
                    <div>
                        <div className="text-[9px] text-slate-500 uppercase">Tid</div>
                        <div className="text-lg font-black text-white">{durationMinutes} min</div>
                    </div>
                    <div>
                        <div className="text-[9px] text-slate-500 uppercase">~Förbränt</div>
                        <div className="text-lg font-black text-amber-400">{estimatedBurn} kcal</div>
                    </div>
                </div>

                {/* Quick Items */}
                <div className="space-y-2 mb-4">
                    <div className="text-[9px] font-black text-slate-500 uppercase mb-2">Snabbval</div>
                    {['post', 'during', 'pre'].map(timing => (
                        <div key={timing} className="space-y-1">
                            <div className="text-[8px] text-slate-600 uppercase tracking-widest">
                                {timing === 'post' ? 'Efter' : timing === 'during' ? 'Under' : 'Före'}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_NUTRITION_ITEMS.filter(i => i.timing === timing).map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all ${selectedItems.includes(item.id)
                                                ? 'bg-emerald-500 text-white ring-2 ring-emerald-400/50'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        {item.name}
                                        <span className="text-[8px] opacity-70 ml-1">({item.calories}kcal)</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Summary */}
                {selectedItems.length > 0 && (
                    <div className="p-3 bg-white/5 rounded-xl mb-4 flex justify-between items-center">
                        <div>
                            <span className="text-xs text-slate-400">Valt: </span>
                            <span className="text-sm font-black text-white">{totalCalories} kcal</span>
                            <span className="text-xs text-slate-500 ml-2">({totalCarbs}g kolhydrater)</span>
                        </div>
                        {totalCalories < estimatedBurn * 0.5 && (
                            <span className="text-[9px] text-amber-400 font-bold">⚠️ Lågt</span>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 text-slate-500 text-[10px] font-bold uppercase hover:text-white transition-all"
                    >
                        Hoppa över
                    </button>
                    <button
                        onClick={handleLog}
                        disabled={selectedItems.length === 0}
                        className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-400 disabled:opacity-40 transition-all active:scale-95"
                    >
                        Logga näring
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================
// Conflict Detection Utility
// ============================================

export function detectNutritionWarnings(
    plannedActivities: { date: string; category: string; estimatedDistance?: number }[],
    strengthSessions: { date: string; muscleGroups: string[] }[],
    mealCalories: Record<string, number>
): NutritionWarning[] {
    const warnings: NutritionWarning[] = [];

    plannedActivities.forEach(activity => {
        const dateStr = activity.date;

        // Check for leg + run conflict
        const hasLegDay = strengthSessions.some(
            s => s.date === dateStr && s.muscleGroups.includes('legs')
        );
        if (hasLegDay && activity.category !== 'RECOVERY') {
            warnings.push({
                id: `leg_run_${dateStr}`,
                type: 'leg_run_conflict',
                date: dateStr,
                message: `Du har planerat ben-styrka och ${activity.category} samma dag. Överväg att sprida ut belastningen.`,
                severity: 'warning',
                suggestedAction: 'Flytta löppasset eller styrkepasset till en annan dag.'
            });
        }

        // Check for calorie deficit on hard days
        const dailyCal = mealCalories[dateStr] || 0;
        const estimatedBurn = (activity.estimatedDistance || 5) * 70;
        if (activity.category === 'LONG_RUN' || activity.category === 'INTERVALS') {
            if (dailyCal < estimatedBurn + 1500) {
                warnings.push({
                    id: `cal_deficit_${dateStr}`,
                    type: 'calorie_deficit',
                    date: dateStr,
                    message: `Kaloriintaget (${dailyCal} kcal) kan vara lågt för ett ${activity.category} pass (~${estimatedBurn} kcal förbränt).`,
                    severity: dailyCal < 1200 ? 'critical' : 'warning',
                    suggestedAction: 'Ät en extra måltid eller energigel före/under passet.'
                });
            }
        }

        // Hydration reminder for long runs
        if ((activity.estimatedDistance || 0) > 15) {
            warnings.push({
                id: `hydrate_${dateStr}`,
                type: 'hydration_reminder',
                date: dateStr,
                message: `Långpass över 15km — kom ihåg att planera för vätskeintag under passet.`,
                severity: 'info',
                suggestedAction: 'Ta med dig vattenflaska eller planera rutt förbi vattenkälla.'
            });
        }
    });

    return warnings;
}
