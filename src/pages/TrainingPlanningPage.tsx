import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { getTrainingSuggestions, TrainingSuggestion } from '../utils/trainingSuggestions.ts';
import {
    PlannedActivity,
    generateId,
    getISODate,
    getWeekStartDate,
    WEEKDAYS,
    Weekday,
    WEEKDAY_LABELS
} from '../models/types.ts';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Plus,
    Dumbbell,
    Activity,
    Zap,
    X,
    Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SHORT_WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export function TrainingPlanningPage() {
    const navigate = useNavigate();
    const {
        exerciseEntries,
        plannedActivities,
        savePlannedActivities,
        deletePlannedActivity
    } = useData();

    const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [formType, setFormType] = useState<'RUN' | 'STRENGTH' | 'HYROX' | 'BIKE'>('RUN');
    const [formDuration, setFormDuration] = useState('45');
    const [formDistance, setFormDistance] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formIntensity, setFormIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');

    // Navigation
    const handleWeekChange = (offset: number) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + (offset * 7));
        setCurrentWeekStart(getISODate(d));
    };

    // Get dates for current week
    const weekDates = useMemo(() => {
        const dates: { date: string, weekday: Weekday, label: string }[] = [];
        const start = new Date(currentWeekStart);
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const iso = getISODate(d);
            dates.push({
                date: iso,
                weekday: WEEKDAYS[i],
                label: SHORT_WEEKDAYS[i]
            });
        }
        return dates;
    }, [currentWeekStart]);

    // Smart Suggestions
    const suggestions = useMemo(() => {
        if (!selectedDate) return [];
        return getTrainingSuggestions(exerciseEntries, selectedDate);
    }, [selectedDate, exerciseEntries]);

    // Handlers
    const handleOpenModal = (date: string) => {
        setSelectedDate(date);
        setIsModalOpen(true);
        // Reset form
        setFormType('RUN');
        setFormDuration('45');
        setFormDistance('');
        setFormNotes('');
        setFormIntensity('moderate');
    };

    const handleSave = () => {
        if (!selectedDate) return;

        const newActivity: PlannedActivity = {
            id: generateId(),
            date: selectedDate,
            type: 'RUN', // Tech debt: Type is currently hardcoded to 'RUN' in PlannedActivity interface, using Category for others
            category: formType === 'RUN' ? 'EASY' :
                      formType === 'STRENGTH' ? 'STRENGTH' :
                      formType === 'HYROX' ? 'INTERVALS' : 'EASY', // Approximation
            title: formType === 'RUN' ? 'Löpning' :
                   formType === 'STRENGTH' ? 'Styrka' :
                   formType === 'HYROX' ? 'Hyrox' : 'Cykling',
            description: formNotes || `${formType} pass`,
            estimatedDistance: formDistance ? parseFloat(formDistance) : 0,
            targetPace: '',
            targetHrZone: formIntensity === 'low' ? 2 : formIntensity === 'moderate' ? 3 : 4,
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            status: 'PLANNED'
        };

        // Note: Currently PlannedActivity interface is strict on 'type: RUN'.
        // We are hijacking 'category' and 'title' to store the real type for this MVP.
        // Ideally we should update the PlannedActivity type definition to allow 'STRENGTH', etc.

        savePlannedActivities([newActivity]);
        setIsModalOpen(false);
    };

    const handleApplySuggestion = (s: TrainingSuggestion) => {
        if (!selectedDate) return;

        // Map suggestion type to form/model
        const type = s.type === 'REST' ? 'RUN' : s.type; // REST not fully supported yet, defaulting

        const newActivity: PlannedActivity = {
            id: generateId(),
            date: selectedDate,
            type: 'RUN',
            category: s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'HYROX' ? 'INTERVALS' : 'EASY',
            title: s.label,
            description: s.description,
            estimatedDistance: s.distance || 0,
            targetPace: '',
            targetHrZone: s.intensity === 'low' ? 2 : s.intensity === 'moderate' ? 3 : 4,
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            status: 'PLANNED'
        };

        savePlannedActivities([newActivity]);
        setIsModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-900 dark:text-white">
            {/* Header */}
            <div className="max-w-6xl mx-auto flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter">Planera Träning</h1>
                        <p className="text-sm text-slate-500 font-medium">Vecka {getWeekNumber(currentWeekStart)}</p>
                    </div>
                </div>

                <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
                    <button onClick={() => handleWeekChange(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="px-4 text-sm font-bold flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        {currentWeekStart}
                    </div>
                    <button onClick={() => handleWeekChange(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-7 gap-4">
                {weekDates.map((day) => {
                    const dayActivities = plannedActivities.filter(a => a.date === day.date && a.status !== 'COMPLETED');
                    const isToday = day.date === getISODate();

                    return (
                        <div key={day.date} className={`flex flex-col h-[400px] bg-white dark:bg-slate-900 rounded-2xl border ${isToday ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-200 dark:border-slate-800'} relative group`}>
                            {/* Header */}
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">{day.label}</span>
                                <span className={`text-xs font-bold ${isToday ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                                    {day.date.split('-')[2]}
                                </span>
                            </div>

                            {/* Activities */}
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                                {dayActivities.map(act => (
                                    <div key={act.id} className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl group/card relative hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                                                {act.title}
                                            </span>
                                            <button
                                                onClick={() => deletePlannedActivity(act.id)}
                                                className="text-slate-400 hover:text-rose-500 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-tight">
                                            {act.description}
                                        </p>
                                        {(act.estimatedDistance || 0) > 0 && (
                                            <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                <Activity size={10} />
                                                {act.estimatedDistance} km
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={() => handleOpenModal(day.date)}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                    <Plus size={20} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Planera</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Planning Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-tight">Planera {selectedDate}</h2>
                                <p className="text-xs text-slate-500 font-medium">Välj aktivitet eller använd förslag</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[80vh] overflow-y-auto">
                            {/* Suggestions */}
                            {suggestions.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap size={14} className="text-amber-500 fill-amber-500" />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Smarta Förslag</span>
                                    </div>
                                    <div className="space-y-2">
                                        {suggestions.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => handleApplySuggestion(s)}
                                                className="w-full p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-center justify-between group hover:scale-[1.02] transition-transform text-left"
                                            >
                                                <div>
                                                    <div className="text-xs font-black text-slate-900 dark:text-white mb-0.5">{s.label}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">{s.reason}</div>
                                                </div>
                                                <div className="p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm text-amber-500">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Manual Form */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                    <button
                                        onClick={() => setFormType('RUN')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'RUN' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Kondition
                                    </button>
                                    <button
                                        onClick={() => setFormType('STRENGTH')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'STRENGTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Styrka
                                    </button>
                                </div>

                                {formType === 'RUN' && (
                                     <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Distans (km)</label>
                                            <input
                                                type="number"
                                                value={formDistance}
                                                onChange={e => setFormDistance(e.target.value)}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                                                placeholder="ex. 5"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tid (min)</label>
                                            <input
                                                type="number"
                                                value={formDuration}
                                                onChange={e => setFormDuration(e.target.value)}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                                                placeholder="45"
                                            />
                                        </div>
                                     </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Anteckningar</label>
                                    <textarea
                                        value={formNotes}
                                        onChange={e => setFormNotes(e.target.value)}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none outline-none focus:ring-2 ring-emerald-500/20 text-sm font-medium h-24 resize-none"
                                        placeholder="Beskriv passet..."
                                    />
                                </div>

                                <button
                                    onClick={handleSave}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    Spara Pass
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function getWeekNumber(dateStr: string): number {
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
