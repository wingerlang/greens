import React, { useState, useEffect } from 'react';
import { PlannedActivity, generateId } from '../../models/types.ts';
import { X, Zap, Plus, Trophy, AlertTriangle, Clock } from 'lucide-react';
import { TrainingSuggestion } from '../../utils/trainingSuggestions.ts';
import { useSmartTrainingSuggestions } from '../../hooks/useSmartTrainingSuggestions.ts'; // Import the new hook!
import { useData } from '../../context/DataContext.tsx';

interface ActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string | null;
    editingActivity: PlannedActivity | null;
    onSave: (activity: PlannedActivity) => void;
    onDelete?: (id: string) => void;
    // Context data passed down to avoid prop drilling mania,
    // but in a real app we might just use useData inside here.
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
    const [formDuration, setFormDuration] = useState('00:45'); // Changed default to hh:mm format
    const [formDistance, setFormDistance] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formIntensity, setFormIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');
    const [isRace, setIsRace] = useState(false); // New Race Toggle

    // Long Run Settings
    const [showLongRunSettings, setShowLongRunSettings] = useState(false);
    const [longRunThreshold, setLongRunThreshold] = useState(20);

    const { exerciseEntries, plannedActivities, currentUser, updateCurrentUser } = useData();

    // Initialize Long Run Threshold from User Settings
    useEffect(() => {
        if (currentUser?.settings?.trainingPreferences?.longRunThreshold) {
            setLongRunThreshold(currentUser.settings.trainingPreferences.longRunThreshold);
        }
    }, [currentUser]);

    const saveLongRunSettings = () => {
        if (!currentUser) return;
        const newSettings = {
            ...currentUser.settings,
            trainingPreferences: {
                ...currentUser.settings.trainingPreferences,
                longRunThreshold: longRunThreshold
            }
        };
        updateCurrentUser({ settings: newSettings });
    };
    const hasExistingActivity = React.useMemo(() => {
        if (!selectedDate) return false;
        // Check planned (excluding current editing)
        const hasPlanned = plannedActivities.some(a =>
            a.date === selectedDate &&
            a.status !== 'COMPLETED' &&
            a.id !== editingActivity?.id
        );
        // Check completed
        const hasCompleted = exerciseEntries.some(e => e.date === selectedDate);
        return hasPlanned || hasCompleted;
    }, [selectedDate, plannedActivities, exerciseEntries, editingActivity]);

    // 2. Smart Suggestions Hook
    // We use the new hook here to get "Genius" suggestions
    const smartSuggestions = useSmartTrainingSuggestions(selectedDate, weeklyStats, goalProgress);

    // Initialize Form on Open
    useEffect(() => {
        if (isOpen && selectedDate) {
            if (editingActivity) {
                // Edit mode
                setFormType(editingActivity.type === 'REST' ? 'REST' :
                    (editingActivity.category === 'STRENGTH' ? 'STRENGTH' :
                        (editingActivity.title.toLowerCase().includes('hyrox') ? 'HYROX' :
                            (editingActivity.type === 'BIKE' ? 'BIKE' : 'RUN'))));

                // Format duration to hh:mm
                // First try to extract total duration. Since PlannedActivity structure is flexible,
                // we often inferred it. If 'durationMinutes' existed (it doesn't on PlannedActivity interface currently,
                // but we might want to check if it's stored in 'structure' or implicitly).
                // Let's assume description has it, or we default to 45.

                // A better approach: check regex in description " (45 min)" or similar? No, fragile.
                // Let's check if we can parse it from description if we saved it as `... (hh:mm)`
                const durMatch = editingActivity.description?.match(/\((\d{2}:\d{2})\)$/);

                if (durMatch) {
                    setFormDuration(durMatch[1]);
                } else {
                    // Fallback to 45 min
                    setFormDuration('00:45');
                }

                setFormDistance(editingActivity.estimatedDistance ? Number(editingActivity.estimatedDistance).toFixed(1) : '');
                setFormNotes(editingActivity.description || '');
                setFormIntensity(editingActivity.targetHrZone <= 2 ? 'low' : editingActivity.targetHrZone >= 4 ? 'high' : 'moderate');
                setIsRace(editingActivity.isRace || false);
            } else {
                // Create mode
                setFormType('RUN');
                setFormDuration('00:45');
                setFormDistance('');
                setFormNotes('');
                setFormIntensity('moderate');
                setIsRace(false);
            }
        }
    }, [isOpen, selectedDate, editingActivity]);

    const handleSave = () => {
        if (!selectedDate) return;

        // Parse hh:mm to minutes for internal logic/description if needed
        const [hours, minutes] = formDuration.split(':').map(Number);
        const totalMinutes = (hours * 60) + minutes;

        const activityData: PlannedActivity = {
            id: editingActivity?.id || generateId(),
            date: selectedDate,
            type: (formType === 'REST' ? 'REST' : 'RUN') as PlannedActivity['type'],
            category: (formType === 'RUN' ? (isRace ? 'TEMPO' : 'EASY') : // Map race to Tempo or just Keep as Easy?
                formType === 'STRENGTH' ? 'STRENGTH' :
                    formType === 'HYROX' ? 'INTERVALS' :
                        formType === 'REST' ? 'REST' : 'EASY') as PlannedActivity['category'],
            title: formType === 'RUN' ? (isRace ? 'TÄVLING 🏆' : 'Löpning') :
                formType === 'STRENGTH' ? 'Styrka' :
                    formType === 'HYROX' ? 'Hyrox' :
                        formType === 'REST' ? 'Vilodag' : 'Cykling',
            description: formNotes || `${formType === 'REST' ? 'Vila och återhämtning' : formType + ' pass'} (${formDuration})`,
            estimatedDistance: formType === 'RUN' && formDistance ? parseFloat(formDistance) : 0,
            targetPace: '', // Could calculate from dist/time
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

        const newActivity: PlannedActivity = {
            id: generateId(),
            date: selectedDate,
            type: (s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'REST' ? 'REST' : 'RUN') as PlannedActivity['type'],
            category: s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'REST' ? 'REST' : s.type === 'HYROX' ? 'INTERVALS' : 'EASY',
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
                                {smartSuggestions.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleApplySuggestion(s)}
                                        className="w-full p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-center justify-between group hover:scale-[1.02] transition-transform text-left"
                                    >
                                        <div>
                                            <div className="text-xs font-black text-slate-900 dark:text-white mb-0.5">{s.label}</div>
                                            <div className="text-[10px] text-slate-500 font-medium">{s.description}</div>
                                        </div>
                                        <div className="p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm text-amber-500">
                                            <Plus size={14} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Smart Average Preset (User Request) */}
                    {formType === 'RUN' && !editingActivity && (
                        <div className="mb-6">
                            {/* Calculation Logic Inline (or better, memoized above) */}
                            {(() => {
                                const history = exerciseEntries || []; // Using exerciseEntries as proxy for history if universalActivities not passed. 
                                // Wait, ActivityModal receives `weeklyStats` but not full history.
                                // We have `exerciseEntries` from useData().

                                // Filter running, last 5 weeks
                                const now = new Date();
                                const fiveWeeksAgo = new Date();
                                fiveWeeksAgo.setDate(now.getDate() - 35);

                                const recentRuns = exerciseEntries.filter(e =>
                                    (e.type === 'running') &&
                                    new Date(e.date) >= fiveWeeksAgo &&
                                    new Date(e.date) <= now &&
                                    !e.excludeFromStats
                                );

                                if (recentRuns.length < 3) return null; // Need some data

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
                            <button
                                onClick={() => setFormType('STRENGTH')}
                                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'STRENGTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Styrka
                            </button>
                            <button
                                onClick={() => setFormType('REST')}
                                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'REST' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Vila
                            </button>
                        </div>

                        {/* Race Toggle & Long Run Settings */}
                        {formType === 'RUN' && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setIsRace(!isRace)}
                                    className={`w-full p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${isRace ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-600 dark:text-yellow-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                >
                                    <Trophy size={16} className={isRace ? 'fill-yellow-500' : ''} />
                                    <span className="text-xs font-black uppercase">Tävling</span>
                                </button>

                                <button
                                    onClick={() => setShowLongRunSettings(!showLongRunSettings)}
                                    className={`w-full p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${showLongRunSettings ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                >
                                    <Clock size={16} />
                                    <span className="text-xs font-black uppercase">Långpass Inst.</span>
                                </button>
                            </div>
                        )}

                        {/* Long Run Settings Panel */}
                        {formType === 'RUN' && showLongRunSettings && (
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-xl space-y-3 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">Definition av Långpass</label>
                                    <span className="text-[10px] text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">Spara automatiskt</span>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative grow">
                                        <input
                                            type="number"
                                            value={longRunThreshold}
                                            onChange={(e) => setLongRunThreshold(parseInt(e.target.value) || 0)}
                                            onBlur={saveLongRunSettings}
                                            className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">km</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center max-w-[140px] leading-tight">
                                        Pass över denna distans räknas som långpass.
                                    </div>
                                </div>
                            </div>
                        )}

                        {formType !== 'REST' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
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
                </div>
            </div>
        </div>
    );
}
