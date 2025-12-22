import React, { useState, useEffect } from 'react';
import { PerformanceGoal, PerformanceGoalType, GoalPeriod, GoalTarget, ExerciseType, TrainingCycle } from '../../models/types.ts';

const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
    { type: 'running', icon: '🏃', label: 'Löpning' },
    { type: 'cycling', icon: '🚴', label: 'Cykling' },
    { type: 'strength', icon: '🏋️', label: 'Styrka' },
    { type: 'walking', icon: '🚶', label: 'Promenad' },
    { type: 'swimming', icon: '🏊', label: 'Simning' },
    { type: 'yoga', icon: '🧘', label: 'Yoga' },
    { type: 'other', icon: '✨', label: 'Annat' },
];

interface GoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (goal: Omit<PerformanceGoal, 'id' | 'createdAt'>) => void;
    cycles: TrainingCycle[];
    editingGoal?: PerformanceGoal | null;
}

export function GoalModal({ isOpen, onClose, onSave, cycles, editingGoal }: GoalModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<PerformanceGoalType>('frequency');
    const [period, setPeriod] = useState<GoalPeriod>('weekly');
    const [cycleId, setCycleId] = useState<string | undefined>(undefined);
    const [hasEndDate, setHasEndDate] = useState(false);
    const [endDate, setEndDate] = useState('');

    // Target inputs
    const [targetExerciseType, setTargetExerciseType] = useState<ExerciseType>('strength');
    const [targetCount, setTargetCount] = useState('3');
    const [targetValue, setTargetValue] = useState('');
    const [targetUnit, setTargetUnit] = useState('');

    // Smart input
    const [smartInput, setSmartInput] = useState('');

    // Reset on modal open/close
    useEffect(() => {
        if (isOpen && editingGoal) {
            setName(editingGoal.name);
            setType(editingGoal.type);
            setPeriod(editingGoal.period);
            setCycleId(editingGoal.cycleId);
            setHasEndDate(!!editingGoal.endDate);
            setEndDate(editingGoal.endDate || '');
            if (editingGoal.targets[0]) {
                setTargetExerciseType(editingGoal.targets[0].exerciseType || 'strength');
                setTargetCount(editingGoal.targets[0].count?.toString() || '');
                setTargetValue(editingGoal.targets[0].value?.toString() || '');
                setTargetUnit(editingGoal.targets[0].unit || '');
            }
        } else if (isOpen) {
            // Reset to defaults
            setName('');
            setType('frequency');
            setPeriod('weekly');
            setCycleId(undefined);
            setHasEndDate(false);
            setEndDate('');
            setTargetExerciseType('strength');
            setTargetCount('3');
            setTargetValue('');
            setTargetUnit('');
            setSmartInput('');
        }
    }, [isOpen, editingGoal]);

    // Smart input parsing
    useEffect(() => {
        if (!smartInput.trim()) return;

        const lower = smartInput.toLowerCase();

        // Pattern: "3x styrka/vecka"
        const freqMatch = lower.match(/(\d+)\s*x?\s*(löpning|löp|styrka|cykling|promenad|simning|yoga|annat)/);
        if (freqMatch) {
            setType('frequency');
            setTargetCount(freqMatch[1]);
            const typeMap: Record<string, ExerciseType> = {
                'löpning': 'running', 'löp': 'running',
                'styrka': 'strength',
                'cykling': 'cycling',
                'promenad': 'walking',
                'simning': 'swimming',
                'yoga': 'yoga',
                'annat': 'other'
            };
            setTargetExerciseType(typeMap[freqMatch[2]] || 'strength');
            setName(smartInput);
        }

        // Pattern: "50 km/vecka" or "4 ton/vecka"
        const volMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(km|ton|kcal)/);
        if (volMatch) {
            const value = volMatch[1];
            const unit = volMatch[2];
            setTargetValue(value);
            setTargetUnit(unit);
            if (unit === 'km') setType('distance');
            else if (unit === 'ton') setType('tonnage');
            else if (unit === 'kcal') setType('calories');
            setName(smartInput);
        }

        // Period detection - Swedish natural language patterns
        if (lower.includes('/dag') || lower.includes('om dagen') || lower.includes('per dag') || lower.includes(' dagen')) {
            setPeriod('daily');
        } else if (lower.includes('/vecka') || lower.includes('om veckan') || lower.includes('per vecka') || lower.includes('i veckan')) {
            setPeriod('weekly');
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
        const targets: GoalTarget[] = [{
            exerciseType: type === 'frequency' ? targetExerciseType : undefined,
            count: type === 'frequency' ? parseInt(targetCount) || 0 : undefined,
            value: type !== 'frequency' ? parseFloat(targetValue) || 0 : undefined,
            unit: type !== 'frequency' ? targetUnit : 'sessions'
        }];

        onSave({
            name: name || `${targetCount}x ${targetExerciseType}`,
            type,
            period,
            targets,
            cycleId,
            startDate: new Date().toISOString().split('T')[0],
            endDate: hasEndDate && endDate ? endDate : undefined
        });

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xl font-black text-white">
                        {editingGoal ? 'Redigera Mål' : 'Nytt Mål'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Definiera ditt tränings- eller kostmål
                    </p>
                </div>

                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Smart Input */}
                    <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                        <label className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider mb-2 block">
                            ✨ Smart Input
                        </label>
                        <input
                            type="text"
                            placeholder="t.ex. '3x styrka om dagen' eller 'löpning 50km per vecka'"
                            value={smartInput}
                            onChange={e => setSmartInput(e.target.value)}
                            className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl p-3 text-white text-sm focus:border-emerald-500 transition-all outline-none"
                        />
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Namn</label>
                        <input
                            type="text"
                            placeholder="t.ex. Veckoträning"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500/50 transition-all outline-none"
                        />
                    </div>

                    {/* Goal Type */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Typ</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { id: 'frequency', label: 'Frekvens', icon: '🔢' },
                                { id: 'distance', label: 'Distans', icon: '📏' },
                                { id: 'tonnage', label: 'Tonnage', icon: '🏋️' },
                                { id: 'calories', label: 'Kalorier', icon: '🔥' },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setType(opt.id as PerformanceGoalType)}
                                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${type === opt.id
                                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                        : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                                        }`}
                                >
                                    <span className="text-lg">{opt.icon}</span>
                                    <span className="text-[9px] font-bold uppercase">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Config */}
                    {type === 'frequency' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Aktivitet</label>
                                <select
                                    value={targetExerciseType}
                                    onChange={e => setTargetExerciseType(e.target.value as ExerciseType)}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                                >
                                    {EXERCISE_TYPES.map(t => (
                                        <option key={t.type} value={t.type}>{t.icon} {t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Antal</label>
                                <input
                                    type="number"
                                    value={targetCount}
                                    onChange={e => setTargetCount(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                                />
                            </div>
                        </div>
                    )}

                    {type !== 'frequency' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Värde</label>
                                <input
                                    type="number"
                                    placeholder="50"
                                    value={targetValue}
                                    onChange={e => setTargetValue(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Enhet</label>
                                <select
                                    value={targetUnit}
                                    onChange={e => setTargetUnit(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                                >
                                    <option value="km">km</option>
                                    <option value="ton">ton</option>
                                    <option value="kcal">kcal</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Period */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Period</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPeriod('weekly')}
                                    className={`flex-1 p-2 rounded-xl border text-xs font-bold ${period === 'weekly' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900/50 text-slate-400 border-white/5'
                                        }`}
                                >
                                    Vecka
                                </button>
                                <button
                                    onClick={() => setPeriod('daily')}
                                    className={`flex-1 p-2 rounded-xl border text-xs font-bold ${period === 'daily' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900/50 text-slate-400 border-white/5'
                                        }`}
                                >
                                    Dag
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Koppla till Period</label>
                            <select
                                value={cycleId || ''}
                                onChange={e => setCycleId(e.target.value || undefined)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm"
                            >
                                <option value="">Ingen (Tills vidare)</option>
                                {cycles.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* End Date Toggle */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={hasEndDate}
                            onChange={e => setHasEndDate(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <label className="text-xs text-slate-400">
                            Ange slutdatum (annars "Tills vidare")
                        </label>
                    </div>
                    {hasEndDate && (
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                        />
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-white/5 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white font-bold text-xs uppercase transition-all"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 uppercase text-xs tracking-wider"
                    >
                        {editingGoal ? 'Spara' : 'Skapa Mål'}
                    </button>
                </div>
            </div>
        </div>
    );
}
