import React, { useState, useMemo, useEffect } from 'react';
import { X, Target, Activity, Dumbbell, Flame, Check, Edit3 } from 'lucide-react';
import { TrainingPeriod, PeriodFocus, PerformanceGoal } from '../../../models/types';
import { getPeriodTemplates } from './templates';
import { GoalTemplateRow } from './GoalTemplateRow';
import { useData } from '../../../context/DataContext';
import { SmartDurationPicker } from '../../common/SmartDurationPicker';
import { GoalModal } from '../GoalModal';

interface PeriodWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void; // Parent should handle refresh/navigation
}

type WizardStep = 1 | 2 | 3;

export const PeriodWizard: React.FC<PeriodWizardProps> = ({ isOpen, onClose, onSave }) => {
    const { addTrainingPeriod, addGoal, getLatestWeight, getLatestWaist } = useData();
    const [step, setStep] = useState<WizardStep>(1);

    // Step 1 State
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(''); // Empty = ongoing/custom logic in SmartPicker
    const [foci, setFoci] = useState<Set<PeriodFocus>>(new Set(['general']));

    // Step 2 State
    const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());

    // Step 3 State
    const [configuredGoals, setConfiguredGoals] = useState<Omit<PerformanceGoal, 'id' | 'createdAt' | 'periodId'>[]>([]);
    const [advancedEditIndex, setAdvancedEditIndex] = useState<number | null>(null);

    // Fetch user stats for templates
    const userStats = useMemo(() => ({
        weight: getLatestWeight(),
        waist: getLatestWaist()
    }), [getLatestWeight, getLatestWaist]);

    const availableTemplates = useMemo(() =>
        getPeriodTemplates(Array.from(foci), userStats),
        [foci, userStats]);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setName('');
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate('');
            setFoci(new Set(['general']));
            setSelectedTemplates(new Set());
            setConfiguredGoals([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (step === 1) {
            setStep(2);
        } else if (step === 2) {
            // Initialize configured goals from selected templates
            const goals = availableTemplates
                .filter(t => selectedTemplates.has(t.defaultKey))
                .map(t => ({
                    ...t.suggestedGoal,
                    startDate: startDate, // Inherit dates
                    endDate: endDate || undefined // Undefined if ongoing
                }));
            setConfiguredGoals(goals);
            setStep(3);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        const focusList = Array.from(foci);
        // 1. Create Period
        const period = await addTrainingPeriod({
            name,
            startDate,
            endDate: endDate || '2099-12-31', // Fallback for sorting, though UI shows "Ongoing"
            focusType: focusList[0] || 'general', // Primary focus for display (can be extended to array later)
            userId: 'current',
            description: `Träningsperiod med fokus på ${focusList.map(f => FOCUS_LABELS[f]).join(', ')}`
        });

        // 2. Create Goals
        for (const goal of configuredGoals) {
            await addGoal({
                ...goal,
                periodId: period.id,
                startDate: period.startDate,
                endDate: period.endDate
            });
        }

        onSave();
        onClose();
    };

    const toggleFocus = (key: PeriodFocus) => {
        const next = new Set(foci);
        if (next.has(key)) {
            // Don't allow empty set
            if (next.size > 1) next.delete(key);
        } else {
            next.add(key);
        }
        setFoci(next);
    };

    const toggleTemplate = (key: string) => {
        const next = new Set(selectedTemplates);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedTemplates(next);
    };

    const FOCUS_LABELS: Record<string, string> = {
        weight_loss: 'Viktminskning',
        strength: 'Styrka',
        endurance: 'Kondition',
        general: 'Hälsa',
        habit: 'Vanor'
    };

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pt-20">
                <div className="bg-[#1e1e24] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">

                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div>
                            <h2 className="text-xl font-bold text-white">Starta Träningsperiod</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`h-1.5 w-8 rounded-full ${step >= 1 ? 'bg-emerald-500' : 'bg-white/10'}`} />
                                <div className={`h-1.5 w-8 rounded-full ${step >= 2 ? 'bg-emerald-500' : 'bg-white/10'}`} />
                                <div className={`h-1.5 w-8 rounded-full ${step >= 3 ? 'bg-emerald-500' : 'bg-white/10'}`} />
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">

                        {/* STEP 1: Definition */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">Vad ska vi kalla perioden?</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                        placeholder="t.ex. Vinterdeff 2025"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">Startdatum</label>
                                        <SmartDurationPicker
                                            startDate={startDate}
                                            endDate={endDate}
                                            onChange={(s, e) => {
                                                setStartDate(s);
                                                setEndDate(e);
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-3">Välj Fokus (Flera möjliga)</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <FocusCard
                                                id="weight_loss"
                                                label="Deff / Vikt"
                                                icon={<Flame className="text-orange-400" />}
                                                selected={foci.has('weight_loss')}
                                                onClick={() => toggleFocus('weight_loss')}
                                            />
                                            <FocusCard
                                                id="strength"
                                                label="Styrka / Bygga"
                                                icon={<Dumbbell className="text-blue-400" />}
                                                selected={foci.has('strength')}
                                                onClick={() => toggleFocus('strength')}
                                            />
                                            <FocusCard
                                                id="endurance"
                                                label="Kondition"
                                                icon={<Activity className="text-emerald-400" />}
                                                selected={foci.has('endurance')}
                                                onClick={() => toggleFocus('endurance')}
                                            />
                                            <FocusCard
                                                id="general"
                                                label="Hälsa & Vanor"
                                                icon={<Target className="text-purple-400" />}
                                                selected={foci.has('general')}
                                                onClick={() => toggleFocus('general')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Suggestions */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-bold text-white">Rekommenderade Mål</h3>
                                    <p className="text-white/50 text-sm">
                                        Baserat på {Array.from(foci).map(f => FOCUS_LABELS[f]).join(' + ')}:
                                    </p>
                                </div>

                                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                                    {availableTemplates.map(template => (
                                        <div
                                            key={template.defaultKey}
                                            onClick={() => toggleTemplate(template.defaultKey)}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTemplates.has(template.defaultKey)
                                                ? 'bg-emerald-500/10 border-emerald-500/50'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedTemplates.has(template.defaultKey)
                                                    ? 'bg-emerald-500 border-emerald-500 text-black'
                                                    : 'border-white/30'
                                                    }`}>
                                                    {selectedTemplates.has(template.defaultKey) && <Check size={14} strokeWidth={3} />}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{template.label}</div>
                                                    <div className="text-sm text-white/50 mt-0.5">{template.description}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Configure */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-bold text-white">Sätt dina siffror</h3>
                                    <p className="text-white/50 text-sm">Justera målvärdena för din period.</p>
                                </div>

                                <div className="space-y-3">
                                    {configuredGoals.map((goal, index) => (
                                        <div key={index} className="flex gap-2">
                                            <div className="flex-1">
                                                <GoalTemplateRow
                                                    goal={goal}
                                                    onChange={(updated) => {
                                                        const newGoals = [...configuredGoals];
                                                        newGoals[index] = updated;
                                                        setConfiguredGoals(newGoals);
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => setAdvancedEditIndex(index)}
                                                className="px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-emerald-400 transition-colors"
                                                title="Avancerad redigering"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/10 flex justify-between">
                        {step > 1 ? (
                            <button
                                onClick={() => setStep(prev => (prev - 1) as WizardStep)}
                                className="px-6 py-2 rounded-lg font-medium text-white hover:bg-white/10 transition-colors"
                            >
                                Tillbaka
                            </button>
                        ) : (
                            <div /> // Spacer
                        )}

                        <button
                            onClick={handleNext}
                            disabled={step === 1 && !name}
                            className="px-6 py-2 rounded-lg font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {step === 3 ? 'Starta Period 🚀' : 'Nästa'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Advanced Edit Modal (Overlay) */}
            {advancedEditIndex !== null && (
                <GoalModal
                    isOpen={true}
                    onClose={() => setAdvancedEditIndex(null)}
                    onSave={(updated) => {
                        const newGoals = [...configuredGoals];
                        newGoals[advancedEditIndex] = {
                            ...updated,
                            // Ensure required missing keys from updated (which is partial in context of edit)
                            category: updated.category || 'training',
                            status: updated.status || 'active'
                        } as any;
                        setConfiguredGoals(newGoals);
                        setAdvancedEditIndex(null);
                    }}
                    cycles={[]} // Not needed here
                    editingGoal={{
                        ...configuredGoals[advancedEditIndex],
                        id: 'temp',
                        createdAt: new Date().toISOString()
                    } as PerformanceGoal}
                />
            )}
        </>
    );
};

const FocusCard: React.FC<{ id: string; label: string; icon: React.ReactNode; selected: boolean; onClick: () => void }> = ({ label, icon, selected, onClick }) => (
    <button
        onClick={onClick}
        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${selected
            ? 'bg-emerald-500/20 border-emerald-500 text-white'
            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
    >
        <div className="text-2xl mb-1">{icon}</div>
        <div className="text-sm font-medium">{label}</div>
    </button>
);
