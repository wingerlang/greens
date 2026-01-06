import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PerformanceGoal, PerformanceGoalType, GoalPeriod, GoalTarget, ExerciseType, TrainingCycle, GoalCategory, WeightEntry } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useScrollLock } from '../../hooks/useScrollLock.ts';
import { calculateCalorieTarget, calculateVolumeStats } from '../../utils/smartGoalCalculations.ts';
import { NutritionWizard } from '../nutrition/NutritionWizard.tsx';
import { getActiveCalories } from '../../utils/calorieTarget.ts';
import { Sparkles, Flame, Target, Scale, Info } from 'lucide-react';

const EXERCISE_TYPES: { type: ExerciseType | undefined; icon: string; label: string }[] = [
    { type: undefined, icon: '🎯', label: 'All träning' },
    { type: 'running', icon: '🏃', label: 'Löpning' },
    { type: 'cycling', icon: '🚴', label: 'Cykling' },
    { type: 'strength', icon: '🏋️', label: 'Styrka' },
    { type: 'walking', icon: '🚶', label: 'Promenad' },
    { type: 'swimming', icon: '🏊', label: 'Simning' },
    { type: 'yoga', icon: '🧘', label: 'Yoga' },
    { type: 'other', icon: '✨', label: 'Annat' },
];

// Goal type options with categories
const GOAL_TYPES = [
    { id: 'frequency', label: 'Frekvens', icon: '🔢', desc: 'X gånger per period', category: 'training' },
    { id: 'distance', label: 'Distans', icon: '📏', desc: 'Springa/cykla X km', category: 'training' },
    { id: 'tonnage', label: 'Tonnage', icon: '🏋️', desc: 'Lyft X ton', category: 'training' },
    { id: 'calories', label: 'Kalorier', icon: '🔥', desc: 'Bränn X kcal', category: 'training' },
    { id: 'speed', label: 'Hastighet', icon: '⏱️', desc: 'X km på Y min', category: 'training' },
    { id: 'weight', label: 'Vikt', icon: '⚖️', desc: 'Kropsvikt upp/ner/stabil', category: 'body' },
    { id: 'measurement', label: 'Mått', icon: '📐', desc: 'Midja, höft, arm etc', category: 'body' },
    { id: 'streak', label: 'Streak', icon: '🔥', desc: 'Träna X dagar i rad', category: 'lifestyle' },
    { id: 'nutrition', label: 'Kost', icon: '🥗', desc: 'Protein, kalorier', category: 'nutrition' },
];

// Measurement types
const MEASUREMENT_TYPES = [
    { id: 'waist', label: 'Midja', icon: '📏' },
    { id: 'hip', label: 'Höft', icon: '📏' },
    { id: 'chest', label: 'Bröst', icon: '📏' },
    { id: 'arm', label: 'Överarm', icon: '💪' },
    { id: 'thigh', label: 'Lår', icon: '🦵' },
    { id: 'neck', label: 'Nacke', icon: '📏' },
];

// Weight direction options
type WeightDirection = 'down' | 'stable' | 'up';

// Duration preset type
type DurationPreset = '30d' | '3m' | '6m' | '12m' | 'custom' | 'ongoing';

interface GoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (goal: Omit<PerformanceGoal, 'id' | 'createdAt'>) => void;
    cycles: TrainingCycle[];
    editingGoal?: PerformanceGoal | null;
}

export function GoalModal({ isOpen, onClose, onSave, cycles, editingGoal }: GoalModalProps) {
    // Basic state
    const [name, setName] = useState('');
    const [type, setType] = useState<PerformanceGoalType>('frequency');
    const [period, setPeriod] = useState<GoalPeriod>('weekly');

    // Target inputs
    const [frequencyTargets, setFrequencyTargets] = useState<GoalTarget[]>([
        { exerciseType: 'strength', count: 3, unit: 'sessions' }
    ]);
    const [targetValue, setTargetValue] = useState('');
    const [targetUnit, setTargetUnit] = useState('km');

    // Speed goal specifics
    const [targetDistance, setTargetDistance] = useState('');
    const [targetTimeMinutes, setTargetTimeMinutes] = useState('');
    const [targetTimeSeconds, setTargetTimeSeconds] = useState('');

    // Weight goal specifics
    const [weightDirection, setWeightDirection] = useState<WeightDirection>('down');
    const [targetWeight, setTargetWeight] = useState('');
    const [currentWeight, setCurrentWeight] = useState('');
    const [weeklyRate, setWeeklyRate] = useState('0.5');

    // Measurement goal specifics
    const [measurementType, setMeasurementType] = useState('waist');
    const [measurementDirection, setMeasurementDirection] = useState<WeightDirection>('down');
    const [targetMeasurement, setTargetMeasurement] = useState('');
    const [currentMeasurement, setCurrentMeasurement] = useState('');

    // Combo goals (weight + measurement)
    const [includeWeight, setIncludeWeight] = useState(true);
    const [includeMeasurement, setIncludeMeasurement] = useState(false);

    // Duration / Period
    const [durationPreset, setDurationPreset] = useState<DurationPreset>('ongoing');
    const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState('');

    // Smart input
    const [smartInput, setSmartInput] = useState('');

    // Track if using new weight vs existing
    const [useExistingWeight, setUseExistingWeight] = useState(true);

    // Nutrition Wizard Integration
    const [showNutritionWizard, setShowNutritionWizard] = useState(false);
    const [calculatedMacros, setCalculatedMacros] = useState<{ calories: number, protein: number, carbs: number, fat: number } | null>(null);

    // Get data from context
    const { weightEntries = [], trainingPeriods = [], performanceGoals = [], calculateBMR, exerciseEntries = [] } = useData();
    const { settings, updateSettings } = useSettings();

    // Get latest weight entry
    const latestWeight = useMemo(() => {
        if (!weightEntries.length) return null;
        const sorted = [...weightEntries].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        return sorted[0];
    }, [weightEntries]);

    // Smart Stats
    const volumeStats = useMemo(() => {
        if (type === 'tonnage') return calculateVolumeStats(exerciseEntries, 'strength', 'ton');
        if (type === 'distance') return calculateVolumeStats(exerciseEntries, 'running', 'km'); // Assuming running
        return null;
    }, [type, exerciseEntries]);

    const calorieSmartData = useMemo(() => {
        if (type !== 'nutrition') return null;
        const bmr = calculateBMR();
        return calculateCalorieTarget(bmr, 'moderate', 'cut'); // Default to cut
    }, [type, calculateBMR]);

    // Format weight date nicely
    const formatWeightDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'idag';
        if (diffDays === 1) return 'igår';
        if (diffDays < 7) return `för ${diffDays} dagar sedan`;
        return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    };

    // Calculate end date based on preset
    const calculatedEndDate = useMemo(() => {
        const start = new Date(customStartDate);
        switch (durationPreset) {
            case '30d':
                return new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            case '3m':
                return new Date(start.getFullYear(), start.getMonth() + 3, start.getDate()).toISOString().split('T')[0];
            case '6m':
                return new Date(start.getFullYear(), start.getMonth() + 6, start.getDate()).toISOString().split('T')[0];
            case '12m':
                return new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()).toISOString().split('T')[0];
            case 'custom':
                return customEndDate;
            default:
                return '';
        }
    }, [durationPreset, customStartDate, customEndDate]);

    // Format date nicely
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Days until end
    const daysUntilEnd = useMemo(() => {
        if (!calculatedEndDate) return null;
        const end = new Date(calculatedEndDate);
        const now = new Date();
        return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }, [calculatedEndDate]);

    // Reset on modal open/close
    useEffect(() => {
        if (isOpen && editingGoal) {
            setName(editingGoal.name);
            setType(editingGoal.type);
            setPeriod(editingGoal.period);
            if (editingGoal.endDate) {
                setDurationPreset('custom');
                setCustomEndDate(editingGoal.endDate);
            } else {
                setDurationPreset('ongoing');
            }
            setCustomStartDate(editingGoal.startDate || new Date().toISOString().split('T')[0]);
            if (editingGoal.type === 'frequency') {
                setFrequencyTargets(editingGoal.targets);
            } else if (editingGoal.type === 'speed') {
                const t = editingGoal.targets[0];
                if (t) {
                    setTargetDistance(t.distanceKm?.toString() || '');
                    const totalSec = t.timeSeconds || 0;
                    const min = Math.floor(totalSec / 60);
                    const sec = totalSec % 60;
                    setTargetTimeMinutes(min.toString());
                    setTargetTimeSeconds(sec.toString());
                }
            } else if (editingGoal.targets[0]) {
                const target = editingGoal.targets[0];
                setTargetValue(target.value?.toString() || '');
                setTargetUnit(target.unit || '');
            }

            // Weight specific reset
            if (editingGoal.type === 'weight' || editingGoal.type === 'measurement') {
                setTargetWeight(editingGoal.targetWeight?.toString() || '');
                setWeeklyRate(editingGoal.targetWeightRate?.toString() || '0.5');
                const startW = editingGoal.milestoneProgress || (latestWeight?.weight || 75);
                setCurrentWeight(startW.toString());

                // Fixed direction calculation
                let direction: WeightDirection = 'stable';
                if (editingGoal.targetWeight) {
                    if (editingGoal.targetWeight < startW - 0.1) direction = 'down';
                    else if (editingGoal.targetWeight > startW + 0.1) direction = 'up';
                }
                setWeightDirection(direction);

                if (editingGoal.nutritionMacros) {
                    setCalculatedMacros({
                        calories: editingGoal.nutritionMacros.calories || 0,
                        protein: editingGoal.nutritionMacros.protein || 0,
                        carbs: editingGoal.nutritionMacros.carbs || 0,
                        fat: editingGoal.nutritionMacros.fat || 0
                    });
                }
            }
        } else if (isOpen) {
            setName('');
            setType('frequency');
            setPeriod('weekly');
            setDurationPreset('ongoing');
            setCustomStartDate(new Date().toISOString().split('T')[0]);
            setCustomEndDate('');
            setFrequencyTargets([{ exerciseType: 'strength', count: 3, unit: 'sessions' }]);
            setTargetValue('');
            setTargetUnit('km');
            setTargetDistance('');
            setTargetTimeMinutes('');
            setTargetTimeSeconds('');
            setSmartInput('');
            setWeightDirection('down');
            setTargetWeight('');
            setCurrentWeight('');
            setWeeklyRate('0.5');
            setMeasurementType('waist');
            setMeasurementDirection('down');
            setTargetMeasurement('');
            setCurrentMeasurement('');
            setIncludeWeight(true);
            setIncludeMeasurement(false);
        }
    }, [isOpen, editingGoal]);

    // Pre-fill weight when switching to weight goal type
    useEffect(() => {
        if ((type === 'weight' || type === 'measurement') && latestWeight && useExistingWeight && !currentWeight) {
            setCurrentWeight(latestWeight.weight.toString());
        }
    }, [type, latestWeight, useExistingWeight, currentWeight]);

    // Smart input parsing
    useEffect(() => {
        if (!smartInput.trim()) return;
        const lower = smartInput.toLowerCase();

        // Pattern: "3x styrka/vecka"
        const freqMatch = lower.match(/(\d+)\s*x?\s*(löpning|löp|styrka|cykling|promenad|simning|yoga|annat)/);
        if (freqMatch) {
            setType('frequency');
            const typeMap: Record<string, ExerciseType> = {
                'löpning': 'running', 'löp': 'running',
                'styrka': 'strength', 'cykling': 'cycling',
                'promenad': 'walking', 'simning': 'swimming',
                'yoga': 'yoga', 'annat': 'other'
            };
            setFrequencyTargets([{
                exerciseType: typeMap[freqMatch[2]] || 'strength',
                count: parseInt(freqMatch[1]),
                unit: 'sessions'
            }]);
            setName(smartInput);
        }

        // Pattern: "50 km/vecka"
        const volMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(km|ton|kcal)/);
        if (volMatch) {
            setTargetValue(volMatch[1]);
            setTargetUnit(volMatch[2]);
            if (volMatch[2] === 'km') setType('distance');
            else if (volMatch[2] === 'ton') setType('tonnage');
            else if (volMatch[2] === 'kcal') setType('calories');
            setName(smartInput);
        }

        // Period detection
        if (lower.includes('/dag') || lower.includes('om dagen') || lower.includes('per dag')) {
            setPeriod('daily');
        } else if (lower.includes('/vecka') || lower.includes('per vecka') || lower.includes('i veckan')) {
            setPeriod('weekly');
        } else if (lower.includes('/månad') || lower.includes('per månad') || lower.includes('i månaden')) {
            setPeriod('monthly');
        }
    }, [smartInput]);

    // ESC to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const handleSubmit = () => {
        let targets: GoalTarget[] = [];
        let category: GoalCategory = 'training';
        let goalName = name;

        // Build targets based on type
        switch (type) {
            case 'frequency':
                targets = frequencyTargets.map(t => ({
                    ...t,
                    count: parseInt(t.count as any) || 0,
                    unit: 'sessions'
                }));
                if (!goalName) {
                    goalName = targets.map(t => {
                        const et = EXERCISE_TYPES.find(e => e.type === t.exerciseType);
                        return `${t.count}x ${et?.label || 'Träning'}`;
                    }).join(' + ');
                }
                break;

            case 'distance':
            case 'tonnage':
            case 'calories':
                targets = [{
                    value: parseFloat(targetValue) || 0,
                    unit: targetUnit
                }];
                if (!goalName) goalName = `${targetValue} ${targetUnit}`;
                break;

            case 'speed':
                // Calculate total seconds
                const totalSeconds = (parseInt(targetTimeMinutes) || 0) * 60 + (parseInt(targetTimeSeconds) || 0);
                targets = [{
                    distanceKm: parseFloat(targetDistance),
                    timeSeconds: totalSeconds,
                    unit: 's'
                }];
                if (!goalName) {
                    const min = Math.floor(totalSeconds / 60);
                    const sec = totalSeconds % 60;
                    const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
                    const distStr = targetDistance;
                    goalName = `${distStr}km på ${timeStr}`;
                }
                break;

            case 'weight':
            case 'measurement':
                category = 'body';
                const weightTarget = includeWeight ? parseFloat(targetWeight) : undefined;
                const measureTarget = includeMeasurement ? parseFloat(targetMeasurement) : undefined;
                targets = [{
                    value: weightTarget || measureTarget || 0,
                    unit: includeWeight ? 'kg' : 'cm'
                }];
                if (!goalName) {
                    const parts = [];
                    if (includeWeight) {
                        const dirLabel = weightDirection === 'down' ? 'Gå ner' : weightDirection === 'up' ? 'Gå upp' : 'Håll';
                        parts.push(`${dirLabel} till ${targetWeight}kg`);
                    }
                    if (includeMeasurement) {
                        const mt = MEASUREMENT_TYPES.find(m => m.id === measurementType);
                        const dirLabel = measurementDirection === 'down' ? '↓' : measurementDirection === 'up' ? '↑' : '=';
                        parts.push(`${mt?.label || measurementType} ${dirLabel} ${targetMeasurement}cm`);
                    }
                    goalName = parts.join(' + ') || 'Kroppsmål';
                }
                break;

            case 'streak':
                const streakT = frequencyTargets[0];
                targets = [{
                    exerciseType: streakT.exerciseType,
                    count: parseInt(streakT.count as any) || 7,
                    unit: 'days'
                }];
                if (!goalName) {
                    const label = EXERCISE_TYPES.find(e => e.type === streakT.exerciseType)?.label || 'Träning';
                    goalName = `${streakT.count} dagars ${label}-streak`;
                }
                break;

            case 'nutrition':
                category = 'nutrition';
                targets = [{
                    value: parseFloat(targetValue) || 0,
                    unit: targetUnit,
                    nutritionType: targetUnit === 'g' ? 'protein' : 'calories'
                }];
                if (!goalName) goalName = `${targetValue}${targetUnit} protein`;
                break;
        }

        const goalData: Omit<PerformanceGoal, 'id' | 'createdAt'> = {
            name: goalName,
            type: type === 'measurement' ? 'weight' : type, // Map measurement to weight type
            period,
            targets,
            startDate: customStartDate,
            endDate: calculatedEndDate || undefined,
            category,
            status: editingGoal?.status || 'active',
            // Weight-specific fields
            targetWeight: type === 'weight' || type === 'measurement' ? parseFloat(targetWeight) || undefined : undefined,
            targetWeightRate: type === 'weight' ? parseFloat(weeklyRate) || undefined : undefined,
            milestoneProgress: type === 'weight' ? parseFloat(currentWeight) || undefined : undefined,
            nutritionMacros: calculatedMacros || undefined,
        };

        onSave(goalData);
        onClose();
    };

    useScrollLock(isOpen);

    if (!isOpen) return null;

    const isBodyGoal = type === 'weight' || type === 'measurement';

    const renderMacroBreakdown = () => {
        if (!calculatedMacros) return null;

        const totalMacros = calculatedMacros.protein + calculatedMacros.carbs + calculatedMacros.fat;
        const getPct = (val: number) => totalMacros > 0 ? Math.round((val / totalMacros) * 100) : 0;

        return (
            <div className="mt-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Kostberäkning</span>
                    </div>
                    <div className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                        LÄNKAD TILL HÄLSOGUIDEN
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                        <div className="text-2xl font-black text-white">{calculatedMacros.calories}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">kcal / dag</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="text-center px-2 py-1 bg-slate-900 border border-white/5 rounded-lg">
                            <div className="text-xs font-bold text-white">{calculatedMacros.protein}g</div>
                            <div className="text-[8px] text-slate-500 uppercase">Prot</div>
                        </div>
                        <div className="text-center px-2 py-1 bg-slate-900 border border-white/5 rounded-lg">
                            <div className="text-xs font-bold text-white">{calculatedMacros.carbs}g</div>
                            <div className="text-[8px] text-slate-500 uppercase">Kolh</div>
                        </div>
                        <div className="text-center px-2 py-1 bg-slate-900 border border-white/5 rounded-lg">
                            <div className="text-xs font-bold text-white">{calculatedMacros.fat}g</div>
                            <div className="text-[8px] text-slate-500 uppercase">Fett</div>
                        </div>
                    </div>
                </div>

                <div className="h-2 w-full bg-slate-950 rounded-full flex overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${getPct(calculatedMacros.protein)}%` }} />
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${getPct(calculatedMacros.carbs)}%` }} />
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${getPct(calculatedMacros.fat)}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                    <span>{getPct(calculatedMacros.protein)}% Protein</span>
                    <span>{getPct(calculatedMacros.carbs)}% Kolh</span>
                    <span>{getPct(calculatedMacros.fat)}% Fett</span>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md animate-in fade-in" onClick={onClose}>
            {showNutritionWizard ? (
                <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <NutritionWizard
                        initialWeight={parseFloat(currentWeight) || (latestWeight?.weight || undefined)}
                        initialTargetWeight={parseFloat(targetWeight)}
                        initialWeeks={(() => {
                            const startW = parseFloat(currentWeight) || (latestWeight?.weight || 75);
                            const targetW = parseFloat(targetWeight);
                            const rate = parseFloat(weeklyRate);
                            if (startW && targetW && rate > 0) {
                                return Math.round(Math.abs(startW - targetW) / rate);
                            }
                            return 12;
                        })()}
                        onSave={(profile) => {
                            if (profile.hasWeightGoal && profile.targetWeight) {
                                setTargetWeight(profile.targetWeight.toString());
                                if (profile.weeks) {
                                    // Calculate granular weekly rate based on wizard result
                                    const startW = parseFloat(currentWeight) || (latestWeight?.weight || 75);
                                    const diff = Math.abs(startW - profile.targetWeight);
                                    const rate = (diff / profile.weeks).toFixed(2);
                                    setWeeklyRate(rate);
                                    setDurationPreset('custom');
                                    // Calculate end date based on weeks
                                    const end = new Date();
                                    end.setDate(end.getDate() + (profile.weeks * 7));
                                    setCustomEndDate(end.toISOString().split('T')[0]);
                                }
                                setType('weight');
                            }

                            setTargetValue(profile.calories.toString());
                            setTargetUnit('kcal');
                            setCalculatedMacros({
                                calories: profile.calories,
                                protein: profile.protein,
                                carbs: profile.carbs,
                                fat: profile.fat
                            });
                            // If we save in wizard, also update global settings so it "slår överallt"
                            if (updateSettings) {
                                updateSettings({
                                    dailyCalorieGoal: profile.calories,
                                    dailyProteinGoal: profile.protein,
                                    dailyCarbsGoal: profile.carbs,
                                    dailyFatGoal: profile.fat,
                                    calorieMode: profile.calorieMode,
                                    fixedCalorieBase: profile.fixedCalorieBase
                                });
                            }
                            setShowNutritionWizard(false);
                            if (type !== 'weight' && !profile.hasWeightGoal) {
                                setType('nutrition');
                            }
                        }}
                        onCancel={() => setShowNutritionWizard(false)}
                    />
                </div>
            ) : (
                <div
                    className="w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 bg-gradient-to-r from-emerald-500/5 to-transparent">
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {editingGoal ? '✏️ Redigera Mål' : '🎯 Nytt Mål'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Definiera och spåra dina framsteg
                        </p>
                    </div>

                    <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                        {/* Smart Input */}
                        <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-purple-500/5 rounded-2xl border border-emerald-500/20">
                            <label className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider mb-2 flex items-center gap-2">
                                <span>✨</span> Smart Input
                                <span className="text-slate-500 normal-case">– skriv naturligt</span>
                            </label>
                            <input
                                type="text"
                                placeholder="t.ex. '3x styrka om veckan' eller '50km per månad'"
                                value={smartInput}
                                onChange={e => setSmartInput(e.target.value)}
                                className="w-full bg-slate-950/50 border border-emerald-500/30 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none placeholder:text-slate-600"
                            />
                        </div>

                        {/* Goal Type Selection */}
                        <div className="space-y-3">
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">1</span>
                                Välj måltyp
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {GOAL_TYPES.slice(0, 4).map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setType(opt.id as PerformanceGoalType)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${type === opt.id
                                            ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/20'
                                            : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:border-white/10'
                                            }`}
                                    >
                                        <span className="text-xl">{opt.icon}</span>
                                        <span className="text-[10px] font-bold uppercase">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {GOAL_TYPES.slice(4).map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setType(opt.id as PerformanceGoalType)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${type === opt.id
                                            ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                                            : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:border-white/10'
                                            }`}
                                    >
                                        <span className="text-xl">{opt.icon}</span>
                                        <span className="text-[10px] font-bold uppercase">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-600 italic pl-1">
                                {GOAL_TYPES.find(t => t.id === type)?.desc}
                            </p>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">2</span>
                                Namnge målet
                            </label>
                            <input
                                type="text"
                                placeholder="t.ex. 'Sommarform 2026' eller 'Styrka 3x'"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-3.5 text-white focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none"
                            />
                        </div>

                        {/* Target Configuration based on type */}
                        <div className="space-y-3">
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">3</span>
                                Konfigurera mål
                            </label>

                            {/* Frequency Config */}
                            {type === 'frequency' && (
                                <div className="space-y-4">
                                    {frequencyTargets.map((target, idx) => (
                                        <div key={idx} className="p-4 bg-slate-950/30 rounded-xl border border-white/5 space-y-4 relative">
                                            {frequencyTargets.length > 1 && (
                                                <button
                                                    onClick={() => {
                                                        const newTargets = [...frequencyTargets];
                                                        newTargets.splice(idx, 1);
                                                        setFrequencyTargets(newTargets);
                                                    }}
                                                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all text-xs"
                                                >
                                                    ✕
                                                </button>
                                            )}

                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 flex justify-between">
                                                    <span>Aktivitet</span>
                                                    {target.exerciseType === undefined && <span className="text-emerald-500">All träning</span>}
                                                </label>
                                                <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
                                                    {EXERCISE_TYPES.map(t => (
                                                        <button
                                                            key={t.label}
                                                            onClick={() => {
                                                                const newTargets = [...frequencyTargets];
                                                                newTargets[idx] = { ...target, exerciseType: t.type };
                                                                setFrequencyTargets(newTargets);
                                                            }}
                                                            title={t.label}
                                                            className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${target.exerciseType === t.type
                                                                ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                                                : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                                                                }`}
                                                        >
                                                            <span className="text-base">{t.icon}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-bold text-slate-500">Antal gånger</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="number"
                                                        value={target.count}
                                                        onChange={e => {
                                                            const newTargets = [...frequencyTargets];
                                                            newTargets[idx] = { ...target, count: parseInt(e.target.value) || 0 };
                                                            setFrequencyTargets(newTargets);
                                                        }}
                                                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-bold"
                                                    />
                                                    <span className="text-slate-500 font-bold text-sm uppercase">gånger</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => setFrequencyTargets([...frequencyTargets, { exerciseType: undefined, count: 1, unit: 'sessions' }])}
                                        className="w-full p-3 rounded-xl border border-dashed border-white/10 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-xs font-bold"
                                    >
                                        + Lägg till typ (t.ex. 2 löpning + 3 styrka)
                                    </button>
                                </div>
                            )}

                            {/* Volume Config (distance/tonnage/calories) */}
                            {(type === 'distance' || type === 'tonnage' || type === 'calories') && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/30 rounded-xl border border-white/5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Värde</label>
                                            <input
                                                type="number"
                                                placeholder="50"
                                                value={targetValue}
                                                onChange={e => setTargetValue(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Enhet</label>
                                            <select
                                                value={targetUnit}
                                                onChange={e => setTargetUnit(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                                            >
                                                {type === 'distance' && <option value="km">km</option>}
                                                {type === 'tonnage' && <option value="ton">ton</option>}
                                                {type === 'calories' && <option value="kcal">kcal</option>}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Smart Suggestions for Volume */}
                                    {volumeStats && (volumeStats.avg30d > 0) && (
                                        <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                            <div className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex justify-between">
                                                <span>Snitt (Veckovis)</span>
                                                <span>{volumeStats.avg30d.toFixed(1)} {volumeStats.unit} (30d)</span>
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                {[
                                                    { label: 'Samma', val: volumeStats.avg30d },
                                                    { label: '+10%', val: volumeStats.avg30d * 1.1 },
                                                    { label: '+15%', val: volumeStats.avg30d * 1.15 },
                                                    { label: '+30%', val: volumeStats.avg30d * 1.3 },
                                                ].map(opt => (
                                                    <button
                                                        key={opt.label}
                                                        onClick={() => setTargetValue(Math.round(opt.val).toString())}
                                                        className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs rounded border border-blue-500/20 whitespace-nowrap"
                                                    >
                                                        {opt.label} ({Math.round(opt.val)})
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Weight & Measurement Config */}
                            {isBodyGoal && (
                                <div className="space-y-4 p-4 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl border border-blue-500/10">
                                    {/* Toggle what to track */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setIncludeWeight(true); if (!includeMeasurement && type === 'measurement') setType('weight'); }}
                                            className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${includeWeight
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-slate-900/50 text-slate-400 border-white/5'
                                                }`}
                                        >
                                            <span>⚖️</span>
                                            <span className="font-bold text-sm">Vikt</span>
                                        </button>
                                        <button
                                            onClick={() => { setIncludeMeasurement(!includeMeasurement); if (!includeWeight) setIncludeWeight(true); }}
                                            className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${includeMeasurement
                                                ? 'bg-purple-500 text-white border-purple-500'
                                                : 'bg-slate-900/50 text-slate-400 border-white/5'
                                                }`}
                                        >
                                            <span>📐</span>
                                            <span className="font-bold text-sm">+ Mått</span>
                                        </button>
                                    </div>

                                    {/* Weight Section */}
                                    {includeWeight && (
                                        <div className="space-y-3 p-3 bg-slate-950/30 rounded-xl">
                                            <div className="flex justify-between items-center">
                                                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Viktmål</div>
                                                <button
                                                    onClick={() => setShowNutritionWizard(true)}
                                                    className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1 rounded-full font-bold flex items-center gap-1 border border-emerald-500/20 transition-all"
                                                >
                                                    ✨ Använd Hälsoguiden
                                                </button>
                                            </div>

                                            {/* Direction */}
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: 'down', label: 'Gå ner', icon: '📉', color: 'emerald' },
                                                    { id: 'stable', label: 'Håll vikten', icon: '➡️', color: 'blue' },
                                                    { id: 'up', label: 'Gå upp', icon: '📈', color: 'purple' },
                                                ].map(dir => (
                                                    <button
                                                        key={dir.id}
                                                        onClick={() => setWeightDirection(dir.id as WeightDirection)}
                                                        className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${weightDirection === dir.id
                                                            ? dir.color === 'emerald' ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                                                : dir.color === 'blue' ? 'bg-blue-500 text-white border-blue-500'
                                                                    : 'bg-purple-500 text-white border-purple-500'
                                                            : 'bg-slate-900/50 text-slate-400 border-white/5'
                                                            }`}
                                                    >
                                                        <span className="text-base">{dir.icon}</span>
                                                        <span>{dir.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Weight inputs */}
                                            <div className="space-y-3">
                                                {/* Pre-fill indicator */}
                                                {latestWeight && (
                                                    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${useExistingWeight
                                                        ? 'bg-blue-500/10 border-blue-500/20'
                                                        : 'bg-slate-900/50 border-white/5'
                                                        }`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-blue-400">⚖️</span>
                                                            <div className="text-xs">
                                                                <span className="text-slate-400">Senaste vägning: </span>
                                                                <span className="text-white font-bold">{latestWeight.weight} kg</span>
                                                                <span className="text-slate-500 ml-1">({formatWeightDate(latestWeight.date)})</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setUseExistingWeight(!useExistingWeight);
                                                                if (!useExistingWeight && latestWeight) {
                                                                    setCurrentWeight(latestWeight.weight.toString());
                                                                }
                                                            }}
                                                            className={`text-[10px] font-bold px-2 py-1 rounded ${useExistingWeight
                                                                ? 'text-blue-400'
                                                                : 'bg-emerald-500/20 text-emerald-400'
                                                                }`}
                                                        >
                                                            {useExistingWeight ? '✓ Använder' : '+ Ny vägning'}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Weight input fields */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                                                            Nu (kg)
                                                            {!useExistingWeight && (
                                                                <span className="text-emerald-400 text-[8px]">NY</span>
                                                            )}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            placeholder={latestWeight ? latestWeight.weight.toString() : "85"}
                                                            value={currentWeight}
                                                            onChange={e => {
                                                                setCurrentWeight(e.target.value);
                                                                // If user types a different weight, mark as new
                                                                if (latestWeight && e.target.value !== latestWeight.weight.toString()) {
                                                                    setUseExistingWeight(false);
                                                                }
                                                            }}
                                                            className={`w-full border rounded-lg p-2.5 text-white text-center font-bold ${!useExistingWeight
                                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                                : 'bg-slate-900 border-white/10'
                                                                }`}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500">Mål (kg)</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            placeholder="80"
                                                            value={targetWeight}
                                                            onChange={e => setTargetWeight(e.target.value)}
                                                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-center font-bold"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500">kg/vecka</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="2"
                                                                value={weeklyRate}
                                                                onChange={e => setWeeklyRate(e.target.value)}
                                                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-center font-bold pr-8"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold uppercase">±</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* New weight notice */}
                                                {!useExistingWeight && (
                                                    <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                        <span className="text-emerald-400">✨</span>
                                                        <span className="text-xs text-emerald-300">
                                                            En ny vägning på <strong>{currentWeight || '?'} kg</strong> kommer registreras
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Estimated time */}
                                            {currentWeight && targetWeight && (
                                                <div className="text-xs text-slate-500 text-center pt-2 border-t border-white/5 flex flex-col gap-2">
                                                    <div>
                                                        {(() => {
                                                            const diff = Math.abs(parseFloat(targetWeight) - parseFloat(currentWeight));
                                                            const rate = parseFloat(weeklyRate);
                                                            if (!rate || rate <= 0) return 'Stabil vikt';
                                                            const weeks = Math.ceil(diff / rate);
                                                            return `≈ ${weeks} veckor för att nå målet`;
                                                        })()}
                                                    </div>
                                                    {renderMacroBreakdown()}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Measurement Section */}
                                    {includeMeasurement && (
                                        <div className="space-y-3 p-3 bg-slate-950/30 rounded-xl">
                                            <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">Kroppsmått</div>

                                            {/* Measurement type */}
                                            <div className="grid grid-cols-6 gap-1.5">
                                                {MEASUREMENT_TYPES.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setMeasurementType(m.id)}
                                                        className={`p-2 rounded-lg border text-[10px] font-bold transition-all ${measurementType === m.id
                                                            ? 'bg-purple-500 text-white border-purple-500'
                                                            : 'bg-slate-900/50 text-slate-400 border-white/5'
                                                            }`}
                                                    >
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Direction */}
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: 'down', label: 'Minska', icon: '📉' },
                                                    { id: 'stable', label: 'Håll', icon: '➡️' },
                                                    { id: 'up', label: 'Öka', icon: '📈' },
                                                ].map(dir => (
                                                    <button
                                                        key={dir.id}
                                                        onClick={() => setMeasurementDirection(dir.id as WeightDirection)}
                                                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${measurementDirection === dir.id
                                                            ? 'bg-purple-500 text-white border-purple-500'
                                                            : 'bg-slate-900/50 text-slate-400 border-white/5'
                                                            }`}
                                                    >
                                                        <span>{dir.icon}</span>
                                                        <span>{dir.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Measurement inputs */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] uppercase font-bold text-slate-500">Nu (cm)</label>
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        placeholder="90"
                                                        value={currentMeasurement}
                                                        onChange={e => setCurrentMeasurement(e.target.value)}
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-center font-bold"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] uppercase font-bold text-slate-500">Mål (cm)</label>
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        placeholder="85"
                                                        value={targetMeasurement}
                                                        onChange={e => setTargetMeasurement(e.target.value)}
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-center font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Streak Config */}
                            {type === 'streak' && (
                                <div className="p-4 bg-gradient-to-br from-orange-500/5 to-red-500/5 rounded-xl border border-orange-500/10 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Aktivitet</label>
                                        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
                                            {EXERCISE_TYPES.map(t => (
                                                <button
                                                    key={t.label}
                                                    onClick={() => {
                                                        const newTargets = [...frequencyTargets];
                                                        newTargets[0] = { ...newTargets[0], exerciseType: t.type };
                                                        setFrequencyTargets(newTargets);
                                                    }}
                                                    title={t.label}
                                                    className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${frequencyTargets[0]?.exerciseType === t.type
                                                        ? 'bg-orange-500 text-white border-orange-500'
                                                        : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                                                        }`}
                                                >
                                                    <span className="text-base">{t.icon}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Dagar i rad</label>
                                        <input
                                            type="number"
                                            value={frequencyTargets[0]?.count}
                                            onChange={e => {
                                                const newTargets = [...frequencyTargets];
                                                newTargets[0] = { ...newTargets[0], count: parseInt(e.target.value) || 0 };
                                                setFrequencyTargets(newTargets);
                                            }}
                                            placeholder="7"
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-bold"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Nutrition Config */}
                            {type === 'nutrition' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-xl border border-green-500/10">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Värde</label>
                                            <input
                                                type="number"
                                                placeholder="150"
                                                value={targetValue}
                                                onChange={e => setTargetValue(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Typ</label>
                                            <select
                                                value={targetUnit}
                                                onChange={e => setTargetUnit(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                                            >
                                                <option value="g">🌱 Protein (g)</option>
                                                <option value="kcal">🔥 Kalorier (kcal)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Smart Calorie Estimate */}
                                    {calorieSmartData && targetUnit === 'kcal' && !calculatedMacros && (
                                        <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-bold text-emerald-400 uppercase">✨ Smart Estimat</span>
                                                <button
                                                    onClick={() => setTargetValue(calorieSmartData.target.toString())}
                                                    className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-1 rounded"
                                                >
                                                    Använd {calorieSmartData.target}
                                                </button>
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {calorieSmartData.explanation}
                                            </div>
                                        </div>
                                    )}

                                    {renderMacroBreakdown()}
                                </div>
                            )}


                            {/* Speed Config */}
                            {type === 'speed' && (
                                <div className="p-4 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-xl border border-blue-500/10 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Mål</label>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[9px] uppercase text-slate-400">Distans (km)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={targetDistance}
                                                    onChange={e => setTargetDistance(e.target.value)}
                                                    placeholder="5.0"
                                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-bold"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[9px] uppercase text-slate-400">Tid (mm:ss)</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={targetTimeMinutes}
                                                        onChange={e => setTargetTimeMinutes(e.target.value)}
                                                        placeholder="25"
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-bold"
                                                    />
                                                    <span className="self-center font-bold text-slate-500">:</span>
                                                    <input
                                                        type="number"
                                                        value={targetTimeSeconds}
                                                        onChange={e => setTargetTimeSeconds(e.target.value)}
                                                        placeholder="00"
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-center text-slate-500">
                                            Löphastighet: <strong>{targetDistance && targetTimeMinutes ? ((parseFloat(targetTimeMinutes) + (parseFloat(targetTimeSeconds) || 0) / 60) / parseFloat(targetDistance)).toFixed(2) : '-'}</strong> min/km
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Macro Summary (if linked to Nutrition Wizard) */}
                        {(calculatedMacros || (isBodyGoal && targetWeight)) && (
                            <div className="p-4 bg-slate-900/50 border border-emerald-500/20 rounded-2xl animate-in zoom-in-95 duration-500">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Sparkles size={12} />
                                        Hälsoguide-förslag
                                    </span>
                                    {calculatedMacros && (
                                        <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                                            {calculatedMacros.calories} kcal
                                        </span>
                                    )}
                                </div>
                                {calculatedMacros ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-2 bg-slate-950 rounded-lg border border-white/5 flex flex-col items-center">
                                            <span className="text-[8px] uppercase text-slate-500 font-bold">Protein</span>
                                            <span className="text-sm font-black text-emerald-400">{calculatedMacros.protein}g</span>
                                        </div>
                                        <div className="p-2 bg-slate-950 rounded-lg border border-white/5 flex flex-col items-center">
                                            <span className="text-[8px] uppercase text-slate-500 font-bold">Kolh.</span>
                                            <span className="text-sm font-black text-blue-400">{calculatedMacros.carbs}g</span>
                                        </div>
                                        <div className="p-2 bg-slate-950 rounded-lg border border-white/5 flex flex-col items-center">
                                            <span className="text-[8px] uppercase text-slate-500 font-bold">Fett</span>
                                            <span className="text-sm font-black text-rose-400">{calculatedMacros.fat}g</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-slate-500 italic px-1">
                                        Använd Hälsoguiden för att räkna ut exakta behov för att nå ditt mål.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Period & Duration */}
                        <div className="space-y-3">
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">4</span>
                                Tidsperiod
                            </label>

                            <div className="p-4 bg-slate-950/30 rounded-xl border border-white/5 space-y-4">
                                {/* Start Date Presets */}
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Startdatum</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'Idag', val: new Date().toISOString().split('T')[0] },
                                            { label: 'Imorgon', val: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
                                            {
                                                label: 'Måndag', val: (() => {
                                                    const d = new Date();
                                                    d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7);
                                                    return d.toISOString().split('T')[0];
                                                })()
                                            },
                                            {
                                                label: '1:a i mån', val: (() => {
                                                    const d = new Date();
                                                    d.setMonth(d.getMonth() + 1);
                                                    d.setDate(1);
                                                    return d.toISOString().split('T')[0];
                                                })()
                                            }
                                        ].map(opt => (
                                            <button
                                                key={opt.label}
                                                onClick={() => setCustomStartDate(opt.val)}
                                                className={`p-2 rounded-lg border text-xs font-bold transition-all ${customStartDate === opt.val
                                                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                                    : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => setCustomStartDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold mt-2"
                                    />
                                </div>

                                {!isBodyGoal && type !== 'streak' && type !== 'speed' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Upprepning</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { id: 'daily', label: 'Dagligen', icon: '📅' },
                                                { id: 'weekly', label: 'Veckovis', icon: '📆' },
                                                { id: 'monthly', label: 'Månadsvis', icon: '🗓️' },
                                                { id: 'once', label: 'Engångs', icon: '🎯' },
                                            ].map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setPeriod(p.id as GoalPeriod)}
                                                    className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${period === p.id
                                                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                                        : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                                                        }`}
                                                >
                                                    <span>{p.icon}</span>
                                                    <span>{p.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Duration presets */}
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Varaktighet</label>
                                    <div className="grid grid-cols-6 gap-1.5">
                                        {[
                                            { id: 'ongoing', label: 'Tills vidare', short: '∞' },
                                            { id: '30d', label: '30 dagar', short: '30d' },
                                            { id: '3m', label: '3 månader', short: '3m' },
                                            { id: '6m', label: '6 månader', short: '6m' },
                                            { id: '12m', label: '12 månader', short: '12m' },
                                            { id: 'custom', label: 'Anpassad', short: '📅' },
                                        ].map(d => (
                                            <button
                                                key={d.id}
                                                onClick={() => setDurationPreset(d.id as DurationPreset)}
                                                title={d.label}
                                                className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${durationPreset === d.id
                                                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                                    : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                                                    }`}
                                            >
                                                {d.short}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom date picker */}
                                {durationPreset === 'custom' && (
                                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/50 rounded-lg">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] uppercase font-bold text-slate-500">Startdatum</label>
                                            <input
                                                type="date"
                                                value={customStartDate}
                                                onChange={e => setCustomStartDate(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] uppercase font-bold text-slate-500">Slutdatum</label>
                                            <input
                                                type="date"
                                                value={customEndDate}
                                                onChange={e => setCustomEndDate(e.target.value)}
                                                min={customStartDate}
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Duration summary */}
                                {durationPreset !== 'ongoing' && calculatedEndDate && (
                                    <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-400">📆</span>
                                            <span className="text-sm text-white">
                                                {formatDate(customStartDate)} → {formatDate(calculatedEndDate)}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-400">
                                            {daysUntilEnd} dagar
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-6 border-t border-white/5 flex gap-3 justify-end bg-slate-950/50">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white font-bold text-sm transition-all"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-sm tracking-wide"
                        >
                            {editingGoal ? '💾 Spara' : '✨ Skapa Mål'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

