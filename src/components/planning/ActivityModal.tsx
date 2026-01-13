import React, { useState, useEffect } from 'react';
import { PlannedActivity, generateId } from '../../models/types.ts';
import { X, Zap, Plus, Trophy, AlertTriangle, Clock, Dumbbell } from 'lucide-react';
import { TrainingSuggestion } from '../../utils/trainingSuggestions.ts';
import { useSmartTrainingSuggestions } from '../../hooks/useSmartTrainingSuggestions.ts';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';

interface ActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string | null;
    editingActivity: PlannedActivity | null;
    onSave: (activity: PlannedActivity) => void;
    onDelete?: (id: string) => void;
    weeklyStats: any;
    goalProgress: any;
}

export function ActivityModal({
    isOpen,
    onClose,
    selectedDate,
    editingActivity,
    onSave,
    onDelete,
    weeklyStats,
    goalProgress
}: ActivityModalProps) {


    // Internal Form State
    const [formType, setFormType] = useState<'RUN' | 'STRENGTH' | 'HYROX' | 'BIKE' | 'REST'>('RUN');
    // New: Sub-category state for UI chips (only for RUN)
    const [runSubCategory, setRunSubCategory] = useState<'EASY' | 'LONG_RUN' | 'INTERVALS' | 'RECOVERY'>('EASY');

    const [formDuration, setFormDuration] = useState('00:45');
    const [formDistance, setFormDistance] = useState('');
    const [formTonnage, setFormTonnage] = useState(''); // New Strength Input
    const [formMuscleGroups, setFormMuscleGroups] = useState<string[]>([]); // New Strength Input
    const [formNotes, setFormNotes] = useState('');
    const [formIntensity, setFormIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');
    const [isRace, setIsRace] = useState(false);

    // Hyrox specific
    const [formIncludesRunning, setFormIncludesRunning] = useState(true);
    const [formStartTime, setFormStartTime] = useState('');

    const { exerciseEntries, plannedActivities, currentUser, updateCurrentUser } = useData();
    const { settings } = useSettings();

    const hasExistingActivity = React.useMemo(() => {
        if (!selectedDate) return false;
        const hasPlanned = plannedActivities.some(a =>
            a.date === selectedDate &&
            a.status !== 'COMPLETED' &&
            a.id !== editingActivity?.id
        );
        const hasCompleted = exerciseEntries.some(e => e.date === selectedDate);
        return hasPlanned || hasCompleted;
    }, [selectedDate, plannedActivities, exerciseEntries, editingActivity]);

    // 2. Smart Suggestions Hook
    const smartSuggestions = useSmartTrainingSuggestions(selectedDate, weeklyStats, goalProgress);

    // Smart Note Logic: Update "X km" in notes when distance changes
    useEffect(() => {
        if (formDistance && formNotes) {
            // Regex to match "Xkm" or "X km" or "X.Xkm" etc
            // We only replace if the context looks like "5km löpning" or "10 km distans"
            const regex = /(\d+(?:[.,]\d+)?)\s*km/i;
            const match = formNotes.match(regex);

            if (match) {
                const currentNoteDist = parseFloat(match[1].replace(',', '.'));
                const newDist = parseFloat(formDistance);

                // Only update if difference is significant (avoid flickers)
                if (Math.abs(currentNoteDist - newDist) > 0.1) {
                    const newNote = formNotes.replace(regex, `${formDistance} km`);
                    setFormNotes(newNote);
                }
            }
        }
    }, [formDistance]);

    // Initialize Form on Open
    useEffect(() => {
        if (isOpen && selectedDate) {
            if (editingActivity) {
                // Edit mode
                setFormType(editingActivity.type === 'REST' ? 'REST' :
                    (editingActivity.category === 'STRENGTH' ? 'STRENGTH' :
                        (editingActivity.title.toLowerCase().includes('hyrox') ? 'HYROX' :
                            (editingActivity.type === 'BIKE' ? 'BIKE' : 'RUN'))));

                // Map category to Run Sub Category
                if (editingActivity.category === 'LONG_RUN') setRunSubCategory('LONG_RUN');
                else if (editingActivity.category === 'INTERVALS' || editingActivity.category === 'TEMPO') setRunSubCategory('INTERVALS');
                else if (editingActivity.category === 'RECOVERY') setRunSubCategory('RECOVERY');
                else setRunSubCategory('EASY');

                const durMatch = editingActivity.description?.match(/\((\d{2}:\d{2})\)$/);

                if (durMatch) {
                    setFormDuration(durMatch[1]);
                } else {
                    setFormDuration('00:45');
                }

                setFormDistance(editingActivity.estimatedDistance ? Number(editingActivity.estimatedDistance).toFixed(1) : '');
                setFormTonnage(editingActivity.tonnage ? editingActivity.tonnage.toString() : '');
                setFormMuscleGroups(editingActivity.muscleGroups || []);
                setFormNotes(editingActivity.description || '');
                setFormIntensity(editingActivity.targetHrZone <= 2 ? 'low' : editingActivity.targetHrZone >= 4 ? 'high' : 'moderate');
                setIsRace(editingActivity.isRace || false);
                setFormIncludesRunning(editingActivity.includesRunning ?? true);
                setFormStartTime(editingActivity.startTime || '');
            } else {
                // Create mode
                setFormType('RUN');
                setRunSubCategory('EASY');
                setFormDuration('00:45');
                setFormDistance('');
                setFormTonnage('');
                setFormMuscleGroups([]);
                setFormNotes('');
                setFormIntensity('moderate');
                setIsRace(false);
                setFormIncludesRunning(true); // Default to true for Hyrox
                setFormStartTime('');
            }
        }
    }, [isOpen, selectedDate, editingActivity]);

    // Helper to handle Run Sub-category clicks
    const handleRunSubCategoryClick = (sub: 'EASY' | 'LONG_RUN' | 'INTERVALS' | 'RECOVERY') => {
        setRunSubCategory(sub);

        // Auto-set Intensity & Title logic
        if (sub === 'RECOVERY') {
            setFormIntensity('low');
        } else if (sub === 'INTERVALS') {
            setFormIntensity('high');
        } else if (sub === 'LONG_RUN') {
            setFormIntensity('moderate');
            // If we have a threshold, maybe suggest it? Kept simple for now.
        } else {
            setFormIntensity('moderate');
        }
    };

    // Toggle Muscle Group Helper
    const toggleMuscleGroup = (muscle: string) => {
        setFormMuscleGroups(prev =>
            prev.includes(muscle)
                ? prev.filter(m => m !== muscle)
                : [...prev, muscle]
        );
    };

    const handleSave = () => {
        if (!selectedDate) return;

        // Parse hh:mm to minutes for internal logic/description if needed
        const [hours, minutes] = formDuration.split(':').map(Number);
        const totalMinutes = (hours * 60) + minutes;

        // Determine Final Category
        let finalCategory = 'EASY';
        if (formType === 'RUN') {
            if (isRace) finalCategory = 'TEMPO'; // Or specific RACE category if added later
            else finalCategory = runSubCategory;
        } else if (formType === 'STRENGTH') {
            finalCategory = 'STRENGTH';
        } else if (formType === 'HYROX') {
            finalCategory = 'INTERVALS';
        } else if (formType === 'REST') {
            finalCategory = 'REST';
        }

        // Determine Title
        let title = 'Löpning';
        if (formType === 'RUN') {
            if (isRace) title = 'TÄVLING 🏆';
            else if (runSubCategory === 'LONG_RUN') title = 'Långpass';
            else if (runSubCategory === 'INTERVALS') title = 'Intervaller';
            else if (runSubCategory === 'RECOVERY') title = 'Återhämtning';
            else title = 'Löpning';
        } else if (formType === 'STRENGTH') {
            title = 'Styrka';
        } else if (formType === 'HYROX') {
            title = 'Hyrox';
        } else if (formType === 'REST') {
            title = 'Vilodag';
        } else if (formType === 'BIKE') {
            title = 'Cykling';
        }

        const activityData: PlannedActivity = {
            id: editingActivity?.id || generateId(),
            date: selectedDate,
            type: (formType === 'REST' ? 'REST' : 'RUN') as PlannedActivity['type'],
            category: finalCategory as PlannedActivity['category'],
            title: title,
            description: formNotes || `${formType === 'REST' ? 'Vila och återhämtning' : title + ' pass'} (${formDuration})`,
            estimatedDistance: formType === 'RUN' && formDistance ? parseFloat(formDistance) : 0,

            // Hyrox & Strength
            tonnage: (formType === 'STRENGTH' || formType === 'HYROX') && formTonnage ? parseInt(formTonnage) : undefined,
            muscleGroups: formType === 'STRENGTH' ? formMuscleGroups as any : undefined,

            // Hyrox specific
            includesRunning: formType === 'HYROX' ? formIncludesRunning : undefined,
            startTime: formType === 'HYROX' ? formStartTime : undefined,

            targetPace: '',
            targetHrZone: formType === 'REST' ? 1 : (formIntensity === 'low' ? 2 : formIntensity === 'moderate' ? 3 : 4),
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 } as PlannedActivity['structure'],
            status: 'PLANNED' as const,
            isRace: isRace
        };

        onSave(activityData);
        onClose();
    };

    const handleApplySuggestion = (s: TrainingSuggestion) => {
        if (!selectedDate) return;

        // Map suggestion type to form category
        let category = 'EASY';
        if (s.type === 'STRENGTH') category = 'STRENGTH';
        else if (s.type === 'REST') category = 'REST';
        else if (s.type === 'HYROX') category = 'INTERVALS';
        else if (s.label.includes('Långpass')) category = 'LONG_RUN';
        else if (s.label.includes('Intervaller') || s.label.includes('Tempo') || s.label.includes('Kvalitet')) category = 'INTERVALS';
        else if (s.label.includes('Återhämtning')) category = 'RECOVERY';

        const newActivity: PlannedActivity = {
            id: generateId(),
            date: selectedDate,
            type: (s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'REST' ? 'REST' : 'RUN') as PlannedActivity['type'],
            category: category as PlannedActivity['category'],
            title: s.label,
            description: s.description,
            estimatedDistance: s.distance || 0,
            targetPace: '',
            targetHrZone: s.intensity === 'low' ? 2 : s.intensity === 'moderate' ? 3 : 4,
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            status: 'PLANNED'
        };

        onSave(newActivity);
        onClose();
    };

    // Get Suggestion Color
    const getSuggestionColor = (s: TrainingSuggestion) => {
        if (s.label.includes('Måljakt')) return 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400';
        if (s.type === 'STRENGTH') return 'from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400';
        if (s.label.includes('Återhämtning') || s.type === 'REST') return 'from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';
        if (s.label.includes('Intervaller') || s.label.includes('Tempo') || s.label.includes('Kvalitet') || s.intensity === 'high') return 'from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400';

        // Default (Distance/Vanlig)
        return 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            {editingActivity ? '✏️ Redigera' : `📅 Planera`}
                            <span className="text-slate-400">|</span>
                            <span className="text-blue-500">{selectedDate}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar grow">
                    {/* Double Session Warning */}
                    {hasExistingActivity && !editingActivity && (
                        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">Dubbelpass?</h4>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-tight mt-0.5">
                                    Det finns redan träning registrerad eller planerad på detta datum.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {!editingActivity && smartSuggestions.length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap size={14} className="text-amber-500 fill-amber-500" />
                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Smarta Förslag</span>
                            </div>
                            <div className="space-y-2">
                                {smartSuggestions
                                    .filter(s => {
                                        if (formType === 'STRENGTH') return s.type === 'STRENGTH';
                                        if (formType === 'RUN') return s.type === 'RUN' || s.type === 'REST';
                                        if (formType === 'HYROX') return s.type === 'HYROX' || s.type === 'STRENGTH' || s.type === 'RUN';
                                        return true;
                                    })
                                    .map(s => {
                                        const colorClasses = getSuggestionColor(s);
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => handleApplySuggestion(s)}
                                                className={`w-full p-3 bg-gradient-to-r border rounded-xl flex items-center justify-between group hover:scale-[1.02] transition-transform text-left ${colorClasses}`}
                                            >
                                                <div>
                                                    <div className="text-xs font-black mb-0.5">{s.label}</div>
                                                    <div className="text-[10px] opacity-80 font-medium">{s.description}</div>
                                                </div>
                                                <div className="p-1.5 bg-white/50 dark:bg-slate-800/50 rounded-full shadow-sm">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Smart Average Preset */}
                    {formType === 'RUN' && !editingActivity && (
                        <div className="mb-6">
                            {(() => {
                                const history = exerciseEntries || [];
                                const now = new Date();
                                const fiveWeeksAgo = new Date();
                                fiveWeeksAgo.setDate(now.getDate() - 35);

                                const recentRuns = exerciseEntries.filter(e =>
                                    (e.type === 'running') &&
                                    new Date(e.date) >= fiveWeeksAgo &&
                                    new Date(e.date) <= now &&
                                    !e.excludeFromStats
                                );

                                if (recentRuns.length < 3) return null;

                                const avgDistance = recentRuns.reduce((sum, r) => sum + (r.distance || 0), 0) / recentRuns.length;
                                const formattedAvg = avgDistance.toFixed(1);

                                return (
                                    <div
                                        onClick={() => setFormDistance(formattedAvg)}
                                        className="group cursor-pointer p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                <Trophy size={14} className="text-blue-500" />
                                                <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400">Din snittdistans</span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm group-hover:scale-110 transition-transform">
                                                {formattedAvg} km
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium">
                                            Baserat på dina senaste 5 veckor. <span className="italic underline decoration-blue-300">Sträva efter att slå detta!</span> 🚀
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Form */}
                    <div className="space-y-4">
                        {/* Type Selector */}
                        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <button
                                onClick={() => setFormType('RUN')}
                                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'RUN' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Löpning
                            </button>
                            {(settings.trainingInterests?.strength ?? true) && (
                                <button
                                    onClick={() => setFormType('STRENGTH')}
                                    className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'STRENGTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Styrka
                                </button>
                            )}
                            {(settings.trainingInterests?.hyrox ?? true) && (
                                <button
                                    onClick={() => setFormType('HYROX')}
                                    className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'HYROX' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Hyrox
                                </button>
                            )}
                            <button
                                onClick={() => setFormType('REST')}
                                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'REST' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Vila
                            </button>
                        </div>

                        {/* Run Sub-Category Selector */}
                        {formType === 'RUN' && (
                            <div className="flex flex-wrap gap-2 pb-1">
                                {[
                                    { id: 'EASY', label: 'Distans', color: 'blue' },
                                    { id: 'LONG_RUN', label: 'Långpass', color: 'indigo' },
                                    { id: 'INTERVALS', label: 'Intervall/Tempo', color: 'rose' },
                                    { id: 'RECOVERY', label: 'Återhämtning', color: 'emerald' },
                                ].map((sub) => (
                                    <button
                                        key={sub.id}
                                        onClick={() => handleRunSubCategoryClick(sub.id as any)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all border ${runSubCategory === sub.id
                                            ? `bg-${sub.color}-500 text-white border-${sub.color}-500 shadow-md transform scale-105`
                                            : `bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-${sub.color}-300`
                                            }`}
                                    >
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Race Toggle */}
                        {formType === 'RUN' && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setIsRace(!isRace)}
                                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${isRace ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-600 dark:text-yellow-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                >
                                    <Trophy size={16} className={isRace ? 'fill-yellow-500' : ''} />
                                    <span className="text-xs font-black uppercase">Tävling</span>
                                </button>
                            </div>
                        )}

                        {formType !== 'REST' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Conditional Inputs based on Type */}
                                    {formType === 'RUN' || formType === 'BIKE' || formType === 'HYROX' ? (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Distans (km)</label>
                                            <div className="space-y-2">
                                                <input
                                                    type="number"
                                                    value={formDistance}
                                                    onChange={(e) => setFormDistance(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    placeholder="0.0"
                                                />
                                            </div>
                                        </div>
                                    ) : formType === 'STRENGTH' ? (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Måltonnage</label>
                                            <div className="space-y-2 relative">
                                                <input
                                                    type="number"
                                                    value={formTonnage}
                                                    onChange={(e) => setFormTonnage(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
                                            </div>
                                        </div>
                                    ) : <div className="hidden md:block"></div>}

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Intensitet</label>
                                        <select
                                            value={formIntensity}
                                            onChange={(e) => setFormIntensity(e.target.value as any)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                                        >
                                            <option value="low">Låg (Zon 1-2)</option>
                                            <option value="moderate">Medel (Zon 3)</option>
                                            <option value="high">Hög (Zon 4-5)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Strength Specific Inputs */}
                                {formType === 'STRENGTH' && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2">

                                        {/* Presets */}
                                        <div className="flex gap-2">
                                            {[
                                                { label: 'PUSH', muscles: ['chest', 'shoulders', 'arms'] },
                                                { label: 'PULL', muscles: ['back', 'arms'] },
                                                { label: 'LEGS', muscles: ['legs'] },
                                                { label: 'FULL', muscles: ['legs', 'chest', 'back', 'shoulders', 'arms', 'core'] }
                                            ].map(preset => (
                                                <button
                                                    key={preset.label}
                                                    onClick={() => setFormMuscleGroups(preset.muscles)}
                                                    className="flex-1 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-[10px] font-black text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Muscle Group Selection */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Muskelgrupper</label>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { id: 'legs', label: 'Ben' },
                                                    { id: 'chest', label: 'Bröst' },
                                                    { id: 'back', label: 'Rygg' },
                                                    { id: 'arms', label: 'Armar' },
                                                    { id: 'shoulders', label: 'Axlar' },
                                                    { id: 'core', label: 'Mage/Core' }
                                                ].map((group) => (
                                                    <button
                                                        key={group.id}
                                                        onClick={() => toggleMuscleGroup(group.id)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${formMuscleGroups.includes(group.id)
                                                            ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-purple-300'
                                                            }`}
                                                    >
                                                        {group.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Hyrox Specific Inputs */}
                                {formType === 'HYROX' && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-200">Inkluderar löpning?</span>
                                            <button
                                                onClick={() => setFormIncludesRunning(!formIncludesRunning)}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${formIncludesRunning ? 'bg-amber-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formIncludesRunning ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tonnage (frivilligt)</label>
                                            <div className="relative">
                                                <Dumbbell className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="number"
                                                    value={formTonnage}
                                                    onChange={e => setFormTonnage(e.target.value)}
                                                    placeholder="t.ex. 5000"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Starttid (frivilligt)</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="time"
                                                    value={formStartTime}
                                                    onChange={e => setFormStartTime(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Duration Time Picker (HH:MM) */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tid (hh:mm)</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="time"
                                            value={formDuration}
                                            onChange={e => setFormDuration(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Anteckningar</label>
                            <textarea
                                value={formNotes}
                                onChange={e => setFormNotes(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium h-24 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                placeholder="Beskriv passet..."
                            />
                        </div>

                        <button
                            onClick={handleSave}
                            className={`w-full py-4 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${isRace ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-orange-500/20' : 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/20'
                                }`}
                        >
                            {editingActivity ? 'Uppdatera Pass' : (isRace ? 'Spara Tävling' : 'Spara Pass')}
                        </button>
                    </div>
                </div >
            </div >
        </div >
    );
}
