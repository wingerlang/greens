import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PlannedActivity, generateId } from '../../models/types.ts';
import { X, Zap, Plus, Trophy, AlertTriangle, Clock, Dumbbell, Timer } from 'lucide-react';
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
    const [formPace, setFormPace] = useState('05:30'); // Tempo in mm:ss per km

    // Ref to track which field was last changed by the user to prevent circular calculation loops
    const lastChanged = useRef<'pace' | 'duration' | 'distance' | 'preset' | null>(null);

    // Hyrox specific
    const [formIncludesRunning, setFormIncludesRunning] = useState(true);
    const [formHyroxFocus, setFormHyroxFocus] = useState<'hybrid' | 'strength' | 'cardio'>('hybrid');
    const [formStatus, setFormStatus] = useState<'PLANNED' | 'COMPLETED' | 'SKIPPED' | 'CHANGED'>('PLANNED');
    const [formStartTime, setFormStartTime] = useState('');
    const [formDate, setFormDate] = useState(selectedDate || '');

    const { exerciseEntries, plannedActivities, currentUser, updateCurrentUser, universalActivities } = useData();
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

    // Calculate run stats and presets for suggestions and default values
    const runStats = useMemo(() => {
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        // From exerciseEntries
        const exerciseRuns = exerciseEntries
            .filter(e =>
                (e.type === 'running') &&
                new Date(e.date) >= sixMonthsAgo &&
                new Date(e.date) <= now &&
                e.distance && e.distance > 0 &&
                !e.excludeFromStats
            )
            .map(e => ({
                date: new Date(e.date),
                distance: e.distance || 0,
                durationMinutes: (e as any).durationMinutes || 0,
                category: (e as any).category || 'EASY'
            }));

        // From universalActivities (Strava)
        const stravaRuns = (universalActivities || [])
            .filter(ua => {
                const actType = (ua.performance?.activityType as string || '').toLowerCase();
                return (
                    (actType === 'running' || actType === 'run') &&
                    new Date(ua.date) >= sixMonthsAgo &&
                    new Date(ua.date) <= now &&
                    (ua.performance?.distanceKm || 0) > 0
                );
            })
            .map(ua => ({
                date: new Date(ua.date),
                distance: ua.performance?.distanceKm || 0,
                durationMinutes: (ua.performance as any).durationMinutes || 0,
                category: (ua as any).category || 'EASY'
            }));

        // Combine and deduplicate
        const allRunsMap = new Map<string, { date: Date, distance: number, durationMinutes: number, category: string }>();
        [...exerciseRuns, ...stravaRuns].forEach(run => {
            const key = run.date.toISOString().split('T')[0];
            const existing = allRunsMap.get(key);
            if (!existing || run.distance > existing.distance) {
                allRunsMap.set(key, run);
            }
        });
        const allRuns = Array.from(allRunsMap.values());

        // Calculate average for recent 5 weeks
        const fiveWeeksAgo = new Date();
        fiveWeeksAgo.setDate(now.getDate() - 35);
        const recentRuns = allRuns.filter(r => r.date >= fiveWeeksAgo);
        const avgDistance = recentRuns.length >= 3
            ? recentRuns.reduce((sum, r) => sum + r.distance, 0) / recentRuns.length
            : null;

        // Find average "EASY" pace
        const easyRuns = allRuns.filter(r => r.category === 'EASY' && r.durationMinutes > 0 && r.distance > 0);
        const avgEasyPace = easyRuns.length > 0
            ? easyRuns.reduce((sum, r) => sum + (r.durationMinutes / r.distance), 0) / easyRuns.length
            : 5.5; // Default

        // Bucketing for presets
        const distanceBuckets: Record<string, { count: number, paceCount: number, totalPace: number }> = {};
        allRuns.forEach(run => {
            const rounded = (Math.round(run.distance * 2) / 2).toFixed(1);
            if (!distanceBuckets[rounded]) {
                distanceBuckets[rounded] = { count: 0, paceCount: 0, totalPace: 0 };
            }
            distanceBuckets[rounded].count += 1;
            if (run.durationMinutes && run.durationMinutes > 0 && run.distance > 0) {
                const pace = run.durationMinutes / run.distance;
                if (pace >= 3 && pace <= 12) {
                    distanceBuckets[rounded].totalPace += pace;
                    distanceBuckets[rounded].paceCount += 1;
                }
            }
        });

        const sortedDistances = Object.entries(distanceBuckets)
            .filter(([d, data]) => parseFloat(d) >= 2 && data.count >= 2)
            .sort((a, b) => b[1].count - a[1].count);

        const spacedDistances: typeof sortedDistances = [];
        sortedDistances.forEach(([d, data]) => {
            const dist = parseFloat(d);
            const tooClose = spacedDistances.some(([existingD]) =>
                Math.abs(parseFloat(existingD) - dist) < 1
            );
            if (!tooClose && spacedDistances.length < 5) {
                spacedDistances.push([d, data]);
            }
        });

        const frequentPresets = spacedDistances.length >= 2
            ? spacedDistances.map(([d, data]) => ({
                distance: parseFloat(d),
                count: data.count,
                avgPace: data.paceCount > 0 ? data.totalPace / data.paceCount : 5.5,
                label: `${d} km`,
                isDefault: false
            }))
            : [
                { distance: 5, count: 0, avgPace: 5.5, label: '5 km', isDefault: true },
                { distance: 7, count: 0, avgPace: 5.5, label: '7 km', isDefault: true },
                { distance: 10, count: 0, avgPace: 5.5, label: '10 km', isDefault: true },
                { distance: 15, count: 0, avgPace: 5.75, label: '15 km', isDefault: true },
                { distance: 21.1, count: 0, avgPace: 6.0, label: 'Halvmaraton', isDefault: true },
            ];

        return { allRuns, avgDistance, frequentPresets, avgEasyPace };
    }, [exerciseEntries, universalActivities]);

    // Smart Note Logic: Update "X km" in notes when distance changes
    useEffect(() => {
        if (formDistance && formNotes) {
            const regex = /(\d+(?:[.,]\d+)?)\s*km/i;
            const match = formNotes.match(regex);
            if (match) {
                const currentNoteDist = parseFloat(match[1].replace(',', '.'));
                const newDist = parseFloat(formDistance);
                if (Math.abs(currentNoteDist - newDist) > 0.1) {
                    const newNote = formNotes.replace(regex, `${formDistance} km`);
                    setFormNotes(newNote);
                }
            }
        }
    }, [formDistance]);

    // Auto-calculate duration from distance and pace
    useEffect(() => {
        // Only trigger if pace or distance was changed by user, or if it's a RUN
        if (formType === 'RUN' && formDistance && formPace && lastChanged.current !== 'duration') {
            const distKm = parseFloat(formDistance.replace(',', '.'));
            if (isNaN(distKm) || distKm <= 0) return;
            const paceParts = formPace.split(':');
            if (paceParts.length !== 2) return;
            const paceMinutes = parseInt(paceParts[0]) + parseInt(paceParts[1]) / 60;
            if (isNaN(paceMinutes) || paceMinutes <= 0) return;
            const totalMinutes = Math.round(distKm * paceMinutes);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const newDuration = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            if (newDuration !== formDuration) {
                setFormDuration(newDuration);
            }
        }
    }, [formDistance, formPace, formType]);

    // Auto-calculate pace from distance and duration
    useEffect(() => {
        // Only trigger if duration or distance was changed by user
        if (formType === 'RUN' && formDistance && formDuration && lastChanged.current !== 'pace') {
            const distKm = parseFloat(formDistance.replace(',', '.'));
            if (isNaN(distKm) || distKm <= 0) return;
            const [hours, minutes] = formDuration.split(':').map(Number);
            const totalMinutes = (hours * 60) + minutes;
            if (isNaN(totalMinutes) || totalMinutes <= 0) return;
            const paceDecimal = totalMinutes / distKm;
            const paceMins = Math.floor(paceDecimal);
            const paceSecs = Math.round((paceDecimal - paceMins) * 60);
            const newPace = `${paceMins.toString().padStart(2, '0')}:${paceSecs.toString().padStart(2, '0')}`;
            if (newPace !== formPace && !newPace.includes('NaN')) {
                setFormPace(newPace);
            }
        }
    }, [formDuration, formDistance, formType]);

    // Initialize Form on Open
    useEffect(() => {
        if (isOpen && selectedDate) {
            lastChanged.current = null; // Reset on open to allow initial auto-calculations if needed
            if (editingActivity) {
                setFormType(editingActivity.type === 'REST' ? 'REST' :
                    (editingActivity.category === 'STRENGTH' ? 'STRENGTH' :
                        (editingActivity.title.toLowerCase().includes('hyrox') ? 'HYROX' :
                            (editingActivity.type === 'BIKE' ? 'BIKE' : 'RUN'))));

                if (editingActivity.category === 'LONG_RUN') setRunSubCategory('LONG_RUN');
                else if (editingActivity.category === 'INTERVALS' || editingActivity.category === 'TEMPO') setRunSubCategory('INTERVALS');
                else if (editingActivity.category === 'RECOVERY') setRunSubCategory('RECOVERY');
                else setRunSubCategory('EASY');

                const durMatch = editingActivity.description?.match(/\((\d{2}:\d{2})\)$/);
                setFormDuration(durMatch ? durMatch[1] : '00:45');
                setFormDistance(editingActivity.estimatedDistance ? Number(editingActivity.estimatedDistance).toFixed(1) : '');
                setFormTonnage(editingActivity.tonnage ? editingActivity.tonnage.toString() : '');
                setFormMuscleGroups(editingActivity.muscleGroups || []);
                setFormNotes(editingActivity.description || '');
                setFormIntensity(editingActivity.targetHrZone <= 2 ? 'low' : editingActivity.targetHrZone >= 4 ? 'high' : 'moderate');
                setIsRace(editingActivity.isRace || false);
                setFormIncludesRunning(editingActivity.includesRunning ?? true);
                setFormHyroxFocus((editingActivity as any).hyroxFocus || 'hybrid');
                setFormStartTime(editingActivity.startTime || '');
                setFormStatus(editingActivity.status === 'DRAFT' ? 'PLANNED' : editingActivity.status as any);
                setFormDate(editingActivity.date || selectedDate || '');
            } else {
                setFormType('RUN');
                setRunSubCategory('EASY');
                setFormDuration('00:45');
                setFormDistance('');
                setFormTonnage('');
                setFormMuscleGroups([]);
                setFormNotes('');
                setFormIntensity('moderate');
                setIsRace(false);
                setFormIncludesRunning(true);
                setFormHyroxFocus('hybrid');
                setFormStartTime('');
                setFormStatus('PLANNED');
                setFormDate(selectedDate || '');
            }
        }
    }, [isOpen, selectedDate, editingActivity]);

    // Helper to handle Run Sub-category clicks
    const handleRunSubCategoryClick = (sub: 'EASY' | 'LONG_RUN' | 'INTERVALS' | 'RECOVERY') => {
        lastChanged.current = 'pace'; // Treat sub-category click as pace change for recovery
        setRunSubCategory(sub);
        if (sub === 'RECOVERY') {
            setFormIntensity('low');
            let basePaceDecimal = runStats.avgEasyPace;
            if (formPace) {
                const parts = formPace.split(':');
                if (parts.length === 2) {
                    basePaceDecimal = parseInt(parts[0]) + parseInt(parts[1]) / 60;
                }
            }
            const recoveryPaceDecimal = basePaceDecimal + 0.5;
            const mins = Math.floor(recoveryPaceDecimal);
            const secs = Math.round((recoveryPaceDecimal - mins) * 60);
            setFormPace(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        } else if (sub === 'INTERVALS') {
            setFormIntensity('high');
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
        if (!formDate) return;

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
            // If Hyrox is strength-focused, categorize as STRENGTH
            finalCategory = formHyroxFocus === 'strength' ? 'STRENGTH' : 'INTERVALS';
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
            date: formDate,
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
            hyroxFocus: formType === 'HYROX' ? formHyroxFocus : undefined,
            startTime: formStartTime || undefined, // Now available for all types

            targetPace: '',
            targetHrZone: formType === 'REST' ? 1 : (formIntensity === 'low' ? 2 : formIntensity === 'moderate' ? 3 : 4),
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 } as PlannedActivity['structure'],
            status: formStatus as any,
            isRace: isRace
        };

        onSave(activityData);
        onClose();
    };

    const handleApplySuggestion = (s: TrainingSuggestion) => {
        if (!formDate) return;

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
            date: formDate,
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            {editingActivity ? '✏️ Redigera' : `📅 Planera`}
                            <span className="text-slate-400">|</span>
                            <span className="text-blue-500">{formDate}</span>
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

                    {/* Smart Distance Presets - Always visible */}
                    {formType === 'RUN' && (
                        <div className="space-y-3">
                            {/* Average Distance Card - Only show if we have data */}
                            {runStats.avgDistance && !editingActivity && (
                                <div
                                    onClick={() => {
                                        lastChanged.current = 'distance';
                                        setFormDistance(runStats.avgDistance!.toFixed(1));
                                    }}
                                    className="group cursor-pointer p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <Trophy size={14} className="text-blue-500" />
                                            <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400">Din snittdistans</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm group-hover:scale-110 transition-transform">
                                            {runStats.avgDistance.toFixed(1)} km
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium">
                                        Baserat på senaste 5 veckor. <span className="italic underline decoration-blue-300">Sträva efter att slå detta!</span> 🚀
                                    </p>
                                </div>
                            )}

                            {/* Quick Distance Presets - Always visible */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={12} className="text-amber-500" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        {runStats.frequentPresets[0]?.isDefault ? 'Populära distanser' : 'Dina vanliga distanser'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {runStats.frequentPresets.map((preset: any) => (
                                        <button
                                            key={preset.distance}
                                            onClick={() => {
                                                lastChanged.current = 'preset';
                                                setFormDistance(preset.distance.toFixed(1));
                                                // Convert avgPace (min/km as decimal) to mm:ss format
                                                const paceMinutes = Math.floor(preset.avgPace);
                                                const paceSeconds = Math.round((preset.avgPace - paceMinutes) * 60);
                                                setFormPace(`${paceMinutes.toString().padStart(2, '0')}:${paceSeconds.toString().padStart(2, '0')}`);

                                                // Calculate duration and round UP to nearest 5 minutes
                                                const totalMinutes = preset.distance * preset.avgPace;
                                                const roundedUp = Math.ceil(totalMinutes / 5) * 5;
                                                const hours = Math.floor(roundedUp / 60);
                                                const mins = roundedUp % 60;
                                                setFormDuration(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
                                            }}
                                            className={`px-2.5 py-1.5 rounded-xl border text-sm font-bold transition-all hover:scale-105 ${formDistance === preset.distance.toFixed(1)
                                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                                                }`}
                                        >
                                            {preset.label}
                                            {preset.count > 0 && (
                                                <span className="ml-1.5 text-[10px] opacity-60">({preset.count}x)</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <div className="space-y-4">
                        {/* Status Selector */}
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Status</label>
                            <div className="flex gap-1.5">
                                {[
                                    { id: 'PLANNED', label: 'Planerat', color: 'blue' },
                                    { id: 'COMPLETED', label: 'Klart', color: 'emerald' },
                                    { id: 'SKIPPED', label: 'Överhoppat', color: 'slate' },
                                    { id: 'CHANGED', label: 'Bytt', color: 'amber' },
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setFormStatus(s.id as any)}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${formStatus === s.id
                                            ? `bg-${s.color}-500 text-white border-${s.color}-500 shadow-md`
                                            : `bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-${s.color}-300`
                                            }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Type Selector */}
                        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <button
                                onClick={() => setFormType('RUN')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'RUN' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Löpning
                            </button>
                            {(settings.trainingInterests?.strength ?? true) && (
                                <button
                                    onClick={() => setFormType('STRENGTH')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'STRENGTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Styrka
                                </button>
                            )}
                            {(settings.trainingInterests?.hyrox ?? true) && (
                                <button
                                    onClick={() => setFormType('HYROX')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'HYROX' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Hyrox
                                </button>
                            )}
                            <button
                                onClick={() => setFormType('REST')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'REST' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Vila
                            </button>
                        </div>

                        {/* Run Sub-Category Selector */}
                        {formType === 'RUN' && (
                            <div className="flex gap-1.5 pb-1">
                                {[
                                    { id: 'EASY', label: 'Distans', color: 'blue' },
                                    { id: 'LONG_RUN', label: 'Långpass', color: 'indigo' },
                                    { id: 'INTERVALS', label: 'Intervall/Tempo', color: 'rose' },
                                    { id: 'RECOVERY', label: 'Återhämtning', color: 'emerald' },
                                ].map((sub) => (
                                    <button
                                        key={sub.id}
                                        onClick={() => handleRunSubCategoryClick(sub.id as any)}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all border ${runSubCategory === sub.id
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
                            <div className="flex justify-between items-center mb-2">
                                {editingActivity && (
                                    <div className="flex-1 mr-4">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Flytta pass</label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsRace(!isRace)}
                                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${isRace ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-600 dark:text-yellow-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                >
                                    <Trophy size={16} className={isRace ? 'fill-yellow-500' : ''} />
                                    <span className="text-xs font-black uppercase">Tävling</span>
                                </button>
                            </div>
                        )}

                        {formType !== 'RUN' && editingActivity && (
                            <div className="mb-2">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Flytta pass</label>
                                <input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        )}

                        {formType !== 'REST' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Conditional Inputs based on Type */}
                                    {/* DISTANS + TEMPO for RUN/BIKE */}
                                    {formType === 'RUN' || formType === 'BIKE' ? (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Distans (km)</label>
                                            <div className="space-y-2">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={formDistance}
                                                    onChange={(e) => {
                                                        lastChanged.current = 'distance';
                                                        setFormDistance(e.target.value);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        const step = 0.5;
                                                        const current = parseFloat(formDistance) || 0;
                                                        if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            lastChanged.current = 'distance';
                                                            setFormDistance((current + step).toFixed(1));
                                                        } else if (e.key === 'ArrowDown' && current >= step) {
                                                            e.preventDefault();
                                                            lastChanged.current = 'distance';
                                                            setFormDistance((current - step).toFixed(1));
                                                        }
                                                    }}
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

                                    {/* TEMPO for RUN/BIKE - calculates duration automatically */}
                                    {(formType === 'RUN' || formType === 'BIKE') ? (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Tempo (min/km)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={formPace}
                                                    onChange={(e) => {
                                                        lastChanged.current = 'pace';
                                                        setFormPace(e.target.value);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        // Parse mm:ss into total seconds
                                                        const parts = formPace.split(':');
                                                        const totalSeconds = parts.length === 2
                                                            ? parseInt(parts[0]) * 60 + parseInt(parts[1])
                                                            : 330; // Default 5:30
                                                        const step = 5; // 5 second increments

                                                        let newSeconds = totalSeconds;
                                                        if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            newSeconds = totalSeconds - step; // Faster pace
                                                            if (newSeconds < 60) newSeconds = 60; // Min 1:00 min/km
                                                        } else if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            newSeconds = totalSeconds + step; // Slower pace
                                                            if (newSeconds > 900) newSeconds = 900; // Max 15:00 min/km
                                                        }

                                                        if (newSeconds !== totalSeconds) {
                                                            const mins = Math.floor(newSeconds / 60);
                                                            const secs = newSeconds % 60;
                                                            lastChanged.current = 'pace';
                                                            setFormPace(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
                                                        }
                                                    }}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    placeholder="05:30"
                                                />
                                                {formDistance && formPace && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500">
                                                        → {formDuration}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
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
                                    )}
                                </div>

                                {/* Intensity Selector for RUN/BIKE - moved to separate row */}
                                {(formType === 'RUN' || formType === 'BIKE') && (
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
                                )}

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

                                {/* Start Time - Available for all non-REST activity types */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Starttid (frivilligt)</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="time"
                                            value={formStartTime}
                                            onChange={e => setFormStartTime(e.target.value)}
                                            placeholder="08:00"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Hyrox Specific Inputs */}
                                {formType === 'HYROX' && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                        {/* Hyrox Focus Toggle */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Hyrox-fokus</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => setFormHyroxFocus('hybrid')}
                                                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formHyroxFocus === 'hybrid' ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-300'}`}
                                                >
                                                    Hybrid
                                                </button>
                                                <button
                                                    onClick={() => setFormHyroxFocus('strength')}
                                                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formHyroxFocus === 'strength' ? 'bg-purple-500 text-white border-purple-500' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-purple-300'}`}
                                                >
                                                    💪 Styrka
                                                </button>
                                                <button
                                                    onClick={() => setFormHyroxFocus('cardio')}
                                                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formHyroxFocus === 'cardio' ? 'bg-blue-500 text-white border-blue-500' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300'}`}
                                                >
                                                    🏃 Cardio
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-slate-500 italic">
                                                {formHyroxFocus === 'strength' ? 'Räknas som styrkepass i statistiken' :
                                                    formHyroxFocus === 'cardio' ? 'Räknas som cardiopass i statistiken' :
                                                        'Räknas som hybridpass i statistiken'}
                                            </p>
                                        </div>

                                        {/* Running Toggle */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-200">Inkluderar löpning?</span>
                                            <button
                                                onClick={() => setFormIncludesRunning(!formIncludesRunning)}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${formIncludesRunning ? 'bg-amber-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formIncludesRunning ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        {/* Distance - Only shows when running is included */}
                                        {formIncludesRunning && (
                                            <div className="space-y-1 animate-in slide-in-from-top-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Distans (km)</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={formDistance}
                                                        onChange={e => {
                                                            lastChanged.current = 'distance';
                                                            setFormDistance(e.target.value);
                                                        }}
                                                        placeholder="t.ex. 8"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">km</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tonnage - Inside Hyrox section */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tonnage (kg)</label>
                                            <div className="relative">
                                                <Dumbbell className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="number"
                                                    value={formTonnage}
                                                    onChange={e => setFormTonnage(e.target.value)}
                                                    placeholder="t.ex. 5000"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tonnage - Only for STRENGTH (Hyrox has its own inside the Hyrox section) */}
                                {formType === 'STRENGTH' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tonnage (kg)</label>
                                        <div className="relative">
                                            <Dumbbell className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="number"
                                                value={formTonnage}
                                                onChange={e => setFormTonnage(e.target.value)}
                                                placeholder="t.ex. 5000"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Duration Time Picker */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">⏱ Varaktighet (t.ex. 1h20m)</label>
                                    <div className="relative">
                                        <Timer className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="time"
                                            value={formDuration}
                                            onChange={e => { lastChanged.current = "duration"; setFormDuration(e.target.value); }}
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
