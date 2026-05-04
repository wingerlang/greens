import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExerciseEntry } from '../../models/types.ts';
import { Activity, Flame, Clock, CalendarHeart, Dumbbell, Route, Zap, TrendingUp, ChevronRight, Plus, MessageSquare, PenSquare, StickyNote, AlertCircle, Heart, Thermometer, ShieldCheck } from 'lucide-react';
import { formatActivityDuration } from '../../utils/durationFormatter.ts';
import { formatSpeed } from '../../utils/dateUtils.ts';
import { useData } from '../../context/DataShared.ts';

interface DailyDetailModalProps {
    date: string;
    allExercises: ExerciseEntry[];
    onClose: () => void;
    onDateChange?: (newDate: string) => void;
    onExerciseClick?: (ex: ExerciseEntry) => void;
}

export function DailyDetailModal({ date, allExercises, onClose, onDateChange, onExerciseClick }: DailyDetailModalProps) {
    // Current day's exercises - filtering out hidden ones (e.g. sub-performances)
    const exercises = useMemo(() => {
        return allExercises.filter(e => {
            if (e.date !== date) return false;
            const perf = (e as any)._mergeData?.universalActivity?.performance;
            return !(e.isHiddenInCalendar || perf?.isHiddenInCalendar);
        });
    }, [allExercises, date]);

    // Find previous and next days with exercises
    const { prevDay, nextDay } = useMemo(() => {
        const sortedDates = Array.from(new Set(allExercises.map(e => e.date))).sort();
        const currentIndex = sortedDates.indexOf(date);

        let prev = null;
        let next = null;

        if (currentIndex > 0) {
            prev = sortedDates[currentIndex - 1];
        } else if (currentIndex === -1) {
            // Edge case: if current date has no exercises, find closest dates
            prev = [...sortedDates].reverse().find(d => d < date) || null;
            next = sortedDates.find(d => d > date) || null;
        }

        if (currentIndex !== -1 && currentIndex < sortedDates.length - 1) {
            next = sortedDates[currentIndex + 1];
        }

        return { prevDay: prev, nextDay: next };
    }, [allExercises, date]);

    // Key listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.getElementById('activity-detail-modal')) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && prevDay && onDateChange) onDateChange(prevDay);
            if (e.key === 'ArrowRight' && nextDay && onDateChange) onDateChange(nextDay);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, prevDay, nextDay, onDateChange]);

    const dateFormatted = new Date(date).toLocaleDateString('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const { getVitalsForDate, updateVitals } = useData();
    const vitals = getVitalsForDate(date);
    const [localNote, setLocalNote] = useState(vitals.notes || '');
    const [localIllness, setLocalIllness] = useState<'none' | 'mild' | 'moderate' | 'severe'>(vitals.illnessStatus || 'none');
    const [localIllnessDuration, setLocalIllnessDuration] = useState(1);
    const [isEditingNote, setIsEditingNote] = useState(false);

    // Sync note when date changes
    useEffect(() => {
        setLocalNote(vitals.notes || '');
        setLocalIllness(vitals.illnessStatus || 'none');
        setLocalIllnessDuration(1);
        setIsEditingNote(false);
    }, [date, vitals.notes, vitals.illnessStatus]);

    const handleSaveNote = () => {
        const startDate = new Date(date);
        for (let i = 0; i < localIllnessDuration; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // If i > 0, we might not want to overwrite existing notes for future days,
            // so we only update the illness status for future days unless they have no vitals yet.
            if (i === 0) {
                updateVitals(dateStr, { 
                    notes: localNote, 
                    illnessStatus: localIllness === 'none' ? undefined : localIllness 
                });
            } else {
                const existing = getVitalsForDate(dateStr);
                updateVitals(dateStr, {
                    ...existing,
                    illnessStatus: localIllness === 'none' ? undefined : localIllness
                });
            }
        }
        setIsEditingNote(false);
    };

    const stats = useMemo(() => {
        let calories = 0;
        let distance = 0;
        let distanceBreakdown = { run: 0, cycle: 0, row: 0, gymCardio: 0, walk: 0, climb: 0, other: 0 };
        let duration = 0;
        let tonnage = 0;
        let runCount = 0;
        let strengthCount = 0;
        let otherCount = 0;
        let totalElevation = 0;

        exercises.forEach(e => {
            const isRun = e.type.includes('run') || e.type.includes('löp') || (e.title && /run|löp/i.test(e.title));
            const isCycle = e.type.includes('cycle') || e.type.includes('cykel') || (e.title && /cycle|cykl/i.test(e.title));
            const isClimb = e.type === 'climbing' || e.type.includes('klätt') || (e.title && /klätt/i.test(e.title)) || (e.title && /climb/i.test(e.title) && !/stair/i.test(e.title));
            const isStrength = e.type.includes('strength') || e.type.includes('styrka') || (e.title && /strength|styrk|pull|push|legs|core/i.test(e.title));
            const isWalk = e.type.includes('walk') || e.type.includes('promenad') || (e.title && /walk|promenad/i.test(e.title));

            calories += e.caloriesBurned || 0;
            duration += e.durationMinutes || 0;
            if (e.distance && e.distance > 0) {
                distance += e.distance;
                const sw = (e as any)._mergeData?.strengthWorkout;
                let distributed = false;

                if (sw?.exercises && sw.exercises.length > 0) {
                    const internalBreakdown = { run: 0, cycle: 0, row: 0, gymCardio: 0, walk: 0, climb: 0, other: 0 };
                    let internalDist = 0;
                    sw.exercises.forEach((ex: any) => {
                        const exDist = ex.sets.reduce((s: number, set: any) => s + (set.distance || 0), 0) / 1000;
                        if (exDist > 0) {
                            internalDist += exDist;
                            const name = ex.exerciseName.toLowerCase();
                            if (name.includes('run') || name.includes('löp')) internalBreakdown.run += exDist;
                            else if (name.includes('cycl') || name.includes('cykel') || name.includes('cykling')) internalBreakdown.cycle += exDist;
                            else if (name.includes('row') || name.includes('rodd')) internalBreakdown.row += exDist;
                            else if (name.includes('klätt') || (name.includes('climb') && !name.includes('stair'))) internalBreakdown.climb += exDist;
                            else if (name.includes('walk') || name.includes('promenad')) internalBreakdown.walk += exDist;
                            else internalBreakdown.gymCardio += exDist; // Fallback for stair climber, elliptical, cross trainer, etc.
                        }
                    });

                    // If we found internal distances that roughly match the total distance (or it's the only one we have)
                    if (internalDist > 0 && Math.abs(internalDist - e.distance) < 2.0) {
                        distanceBreakdown.run += internalBreakdown.run;
                        distanceBreakdown.cycle += internalBreakdown.cycle;
                        distanceBreakdown.row += internalBreakdown.row;
                        distanceBreakdown.gymCardio += internalBreakdown.gymCardio;
                        distanceBreakdown.walk += internalBreakdown.walk;
                        distanceBreakdown.climb += internalBreakdown.climb;
                        distanceBreakdown.other += internalBreakdown.other;

                        const diff = e.distance - internalDist;
                        if (Math.abs(diff) > 0.1) distanceBreakdown.other += diff;

                        distributed = true;
                    }
                }

                if (!distributed) {
                    if (isRun) distanceBreakdown.run += e.distance;
                    else if (isCycle) distanceBreakdown.cycle += e.distance;
                    else if (isClimb) distanceBreakdown.climb += e.distance;
                    else if (e.type.includes('row') || /row|rodd/i.test(e.title || '')) distanceBreakdown.row += e.distance;
                    else if (isStrength || e.type.includes('cardio') || /cardio|cross\s*trainer/i.test(e.title || '')) distanceBreakdown.gymCardio += e.distance;
                    else if (isWalk) distanceBreakdown.walk += e.distance;
                    else distanceBreakdown.other += e.distance;
                }
            }
            if (e.tonnage) tonnage += e.tonnage;
            if (e.elevationGain) totalElevation += e.elevationGain;

            if (isRun) runCount++;
            else if (isStrength) strengthCount++;
            else otherCount++;
        });

        return { calories, distance, distanceBreakdown, duration, tonnage, runCount, strengthCount, otherCount, count: exercises.length, totalElevation };
    }, [exercises]);

    const fmtPace = (dist: number, min: number) => {
        if (dist <= 0 || min <= 0) return '-';
        const paceDec = min / dist;
        const pMin = Math.floor(paceDec);
        const pSec = Math.round((paceDec % 1) * 60);
        return `${pMin}:${pSec.toString().padStart(2, '0')} min/km`;
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 [backdrop-filter:blur(12px)] transition-opacity duration-300"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
            style={{ transform: 'translateZ(0)' }}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                style={{ transform: 'translateZ(0)' }}
            >
                {/* Header */}
                <header className="p-6 border-b border-white/5 relative shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors z-10"
                    >
                        ✕
                    </button>
                    <div className="flex items-center gap-4">
                        {onDateChange && prevDay && (
                            <button
                                onClick={() => onDateChange(prevDay)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                title="Föregående dag med träning (←)"
                            >
                                <ChevronRight className="w-5 h-5 rotate-180" />
                            </button>
                        )}
                        <h2 className="text-3xl font-black text-white capitalize flex items-center gap-3">
                            <CalendarHeart className="w-8 h-8 text-sky-400" />
                            {dateFormatted}
                        </h2>
                        {onDateChange && nextDay && (
                            <button
                                onClick={() => onDateChange(nextDay)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                title="Nästa dag med träning (→)"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <p className="text-slate-400 mt-2 ml-14 flex gap-2">
                        <span>{stats.count} Registrerade Pass</span>
                        <span className="text-slate-600">•</span>
                        <span>{Math.floor(stats.duration / 60)}h {Math.round(stats.duration % 60)}m Träningstid</span>
                    </p>
                </header>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    {/* Action Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                            onClick={() => {
                                const params = new URLSearchParams(window.location.search);
                                params.set('registerDate', date);
                                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
                                // We don't need navigate here since Layout.tsx listens to registerDate
                                // but we might need to trigger a re-render or pushState if not using URL change.
                                // Actually navigate is cleaner if we have it.
                            }}
                            className="bg-sky-500 hover:bg-sky-400 text-black font-bold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 active:scale-95"
                        >
                            <Plus size={18} strokeWidth={3} />
                            Skapa pass
                        </button>
                        <button
                            onClick={() => {
                                const params = new URLSearchParams(window.location.search);
                                params.set('createPost', 'true');
                                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-2 active:scale-95"
                        >
                            <MessageSquare size={18} />
                            Skapa inlägg
                        </button>
                        <button
                            onClick={() => setIsEditingNote(true)}
                            className={`font-bold py-3 px-4 rounded-2xl transition-all border flex items-center justify-center gap-2 active:scale-95 ${vitals.illnessStatus && vitals.illnessStatus !== 'none' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : vitals.notes ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/5'}`}
                        >
                            {vitals.illnessStatus && vitals.illnessStatus !== 'none' ? <Thermometer size={18} /> : <StickyNote size={18} />}
                            {(vitals.notes || vitals.illnessStatus) ? 'Ändra Status' : 'Logga Status'}
                        </button>
                    </div>

                    {/* Daily Note & Illness (If exists or editing) */}
                    {(vitals.notes || vitals.illnessStatus || isEditingNote) && (
                        <div className={`border rounded-2xl p-5 animate-in slide-in-from-top-2 duration-300 shadow-lg ${localIllness !== 'none' || (vitals.illnessStatus && vitals.illnessStatus !== 'none') ? 'bg-rose-500/5 border-rose-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${localIllness !== 'none' || (vitals.illnessStatus && vitals.illnessStatus !== 'none') ? 'text-rose-400' : 'text-amber-500'}`}>
                                    {localIllness !== 'none' || (vitals.illnessStatus && vitals.illnessStatus !== 'none') ? <Thermometer className="w-4 h-4" /> : <PenSquare className="w-4 h-4" />} 
                                    Hälsostatus & Notering
                                </h3>
                                {isEditingNote && (
                                    <div className="flex gap-3">
                                        <button onClick={() => setIsEditingNote(false)} className="text-xs font-bold text-slate-500 hover:text-white transition-colors">Avbryt</button>
                                        <button onClick={handleSaveNote} className="text-xs font-bold bg-white text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors shadow-sm">Spara</button>
                                    </div>
                                )}
                            </div>

                            {isEditingNote ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <button
                                            onClick={() => setLocalIllness('none')}
                                            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${localIllness === 'none' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20'}`}
                                        >
                                            <div className="flex justify-between items-center w-full">
                                                <span className="font-bold text-sm">Frisk</span>
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] opacity-70">Ingen sjukdom, redo att träna.</span>
                                        </button>
                                        <button
                                            onClick={() => setLocalIllness('mild')}
                                            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${localIllness === 'mild' ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20'}`}
                                        >
                                            <div className="flex justify-between items-center w-full">
                                                <span className="font-bold text-sm">Känning</span>
                                                <AlertCircle className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] opacity-70">Halsont/snorig. Endast lätt träning.</span>
                                        </button>
                                        <button
                                            onClick={() => setLocalIllness('moderate')}
                                            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${localIllness === 'moderate' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20'}`}
                                        >
                                            <div className="flex justify-between items-center w-full">
                                                <span className="font-bold text-sm">Sjuk</span>
                                                <Thermometer className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] opacity-70">Sjukdomsbild. Missar all träning.</span>
                                        </button>
                                        <button
                                            onClick={() => setLocalIllness('severe')}
                                            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${localIllness === 'severe' ? 'bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20'}`}
                                        >
                                            <div className="flex justify-between items-center w-full">
                                                <span className="font-bold text-sm">Allvarligt</span>
                                                <Thermometer className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] opacity-70">Sängliggande, feber eller infektion.</span>
                                        </button>
                                    </div>
                                    
                                    {localIllness !== 'none' && (
                                        <div className="flex items-center gap-3 bg-slate-950/30 p-3 rounded-xl border border-white/5">
                                            <span className="text-sm font-bold text-slate-300">Period (antal dagar):</span>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="30"
                                                value={localIllnessDuration} 
                                                onChange={(e) => setLocalIllnessDuration(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 w-20 text-white font-mono outline-none focus:border-sky-500/50"
                                            />
                                            <span className="text-xs text-slate-500">Appliceras från vald dag och framåt.</span>
                                        </div>
                                    )}

                                    <textarea
                                        autoFocus
                                        value={localNote}
                                        onChange={(e) => setLocalNote(e.target.value)}
                                        placeholder="Beskriv dagen... (t.ex. 'Skön känsla i benen', 'Börjar få ont i halsen')"
                                        className={`w-full bg-slate-950/50 border rounded-xl p-3 text-slate-200 placeholder:text-slate-600 outline-none transition-colors min-h-[100px] text-sm ${localIllness !== 'none' ? 'border-rose-500/30 focus:border-rose-500/50' : 'border-amber-500/30 focus:border-amber-500/50'}`}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {vitals.illnessStatus && vitals.illnessStatus !== 'none' && (
                                        <div className="flex items-center gap-2 text-sm font-bold bg-slate-900/50 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                                            {vitals.illnessStatus === 'mild' && <><AlertCircle className="w-4 h-4 text-amber-400" /><span className="text-amber-400">Mild känning (Kan träna lätt)</span></>}
                                            {vitals.illnessStatus === 'moderate' && <><Thermometer className="w-4 h-4 text-rose-400" /><span className="text-rose-400">Sjuk (Ingen träning)</span></>}
                                            {vitals.illnessStatus === 'severe' && <><Thermometer className="w-4 h-4 text-red-500" /><span className="text-red-500">Allvarligt sjuk (Sängliggande / Feber)</span></>}
                                        </div>
                                    )}
                                    {vitals.notes && (
                                        <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap flex gap-4">
                                            <div className={`w-1 h-auto rounded-full shrink-0 ${vitals.illnessStatus && vitals.illnessStatus !== 'none' ? 'bg-rose-500/30' : 'bg-amber-500/30'}`} />
                                            <p className="py-1">{vitals.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Top Level Summary Cards */}
                    {stats.count > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-start gap-2">
                                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><Activity className="w-5 h-5" /></span>
                                <div className="w-full">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total Distans</p>
                                    <p className="text-2xl font-black text-white">{stats.distance.toFixed(1)} <span className="text-xs text-slate-400">km</span></p>
                                    {stats.distance > 0 && (
                                        <div className="mt-2 flex flex-col gap-1 w-full text-[10px] uppercase font-bold text-slate-400 border-t border-white/10 pt-2">
                                            {stats.distanceBreakdown.run > 0 && <div className="flex justify-between w-full"><span>🏃 Löpning</span><span className="text-slate-300">{stats.distanceBreakdown.run.toFixed(1)} km</span></div>}
                                            {stats.distanceBreakdown.cycle > 0 && <div className="flex justify-between w-full"><span>🚴 Cykling</span><span className="text-slate-300">{stats.distanceBreakdown.cycle.toFixed(1)} km</span></div>}
                                            {stats.distanceBreakdown.row > 0 && <div className="flex justify-between w-full"><span>🛶 Rodd</span><span className="text-slate-300">{stats.distanceBreakdown.row.toFixed(1)} km</span></div>}
                                            {stats.distanceBreakdown.gymCardio > 0 && <div className="flex justify-between w-full"><span>🪜 Inomhus Cardio</span><span className="text-slate-300">{stats.distanceBreakdown.gymCardio.toFixed(1)} km</span></div>}
                                            {stats.distanceBreakdown.walk > 0 && <div className="flex justify-between w-full"><span>🚶 Promenad</span><span className="text-slate-300">{stats.distanceBreakdown.walk.toFixed(1)} km</span></div>}
                                            {stats.distanceBreakdown.climb > 0 && <div className="flex justify-between w-full"><span>🧗‍♂️ Klättring</span><span className="text-slate-300">{stats.distanceBreakdown.climb.toFixed(1)} km</span></div>}
                                            {stats.distanceBreakdown.other > 0 && <div className="flex justify-between w-full"><span>✨ Annat</span><span className="text-slate-300">{stats.distanceBreakdown.other.toFixed(1)} km</span></div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-start gap-2">
                                <span className="p-2 bg-orange-500/10 text-orange-400 rounded-xl"><Flame className="w-5 h-5" /></span>
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Kalorier</p>
                                    <p className="text-2xl font-black text-white flex items-center gap-1">
                                        {Math.round(stats.calories)}
                                        <span className="text-xs text-slate-400 font-bold">kcal</span>
                                        {exercises.some(e => e.isCalorieAdjusted) && (
                                            <span className="text-xs text-amber-500" title="Innehåller justerad kaloridata">✨</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-start gap-2">
                                <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><Dumbbell className="w-5 h-5" /></span>
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Styrkevolym</p>
                                    <p className="text-2xl font-black text-white">{(stats.tonnage / 1000).toFixed(1)} <span className="text-xs text-slate-400">ton</span></p>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-start gap-2">
                                <span className="p-2 bg-sky-500/10 text-sky-400 rounded-xl"><Clock className="w-5 h-5" /></span>
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Intensiv Tid</p>
                                    <p className="text-2xl font-black text-white">{Math.round(stats.duration)} <span className="text-xs text-slate-400">min</span></p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 text-center text-slate-500">
                            Ingen träning registrerad denna dag.
                        </div>
                    )}

                    {/* Exercise Breakdown */}
                    {exercises.length > 0 && (
                        <div>
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ChevronRight className="w-4 h-4" /> Passdetaljer
                            </h3>
                            <div className="grid gap-4">
                                {exercises.map((ex: ExerciseEntry, i: number) => {
                                    const isRun = ex.type.includes('run') || ex.type.includes('löp') || (ex.title && /run|löp/i.test(ex.title));
                                    const isStrength = ex.type.includes('strength') || ex.type.includes('styrka') || (ex.title && /strength|styrk|pull|push|legs|core/i.test(ex.title));
                                    const isCycle = ex.type.includes('cycle') || ex.type.includes('cykel') || (ex.type.includes('cykling')) || (ex.title && /cycle|cykl/i.test(ex.title));

                                    let Icon = Zap;
                                    let iconColor = 'text-slate-400';
                                    let bgColor = 'bg-slate-500/10';
                                    let borderColor = 'border-slate-500/20';

                                    if (isRun) {
                                        Icon = Route;
                                        iconColor = 'text-emerald-400';
                                        bgColor = 'bg-emerald-500/10';
                                        borderColor = 'border-emerald-500/20';
                                    } else if (isStrength) {
                                        Icon = Dumbbell;
                                        iconColor = 'text-indigo-400';
                                        bgColor = 'bg-indigo-500/10';
                                        borderColor = 'border-indigo-500/20';
                                    } else if (isCycle) {
                                        Icon = Activity;
                                        iconColor = 'text-sky-400';
                                        bgColor = 'bg-sky-500/10';
                                        borderColor = 'border-sky-500/20';
                                    }

                                    if (ex.subType === 'race') {
                                        iconColor = 'text-amber-400';
                                        bgColor = 'bg-amber-500/10';
                                        borderColor = 'border-amber-500/30';
                                    }

                                    return (
                                        <div
                                            key={ex.id || i}
                                            onClick={() => onExerciseClick?.(ex)}
                                            className={`p-5 rounded-2xl border ${borderColor} ${bgColor} flex flex-col md:flex-row gap-6 md:items-center cursor-pointer hover:brightness-110 transition-all`}
                                        >
                                            <div className="flex items-center gap-4 min-w-[200px]">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-slate-900 border border-white/5 ${iconColor}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-bold text-lg capitalize flex items-center gap-2">
                                                        {ex.subType === 'race' && '🏆 '}
                                                        {ex.extractedFromId && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-md border border-amber-500/30 uppercase font-black mr-1">Utdrag</span>}
                                                        {ex.title ? ex.title : ex.type.replace('strength', 'Styrketräning').replace('running', 'Löpning')}
                                                    </h4>
                                                    <p className="text-slate-400 text-sm">
                                                        {ex.startTime && <span className="text-slate-500 mr-1">{ex.startTime}</span>}
                                                        {formatActivityDuration(ex.durationMinutes)}
                                                        {ex.intensity && ` • ${ex.intensity}`}
                                                    </p>
                                                    {ex.notes && (
                                                        <p className="text-[10px] text-slate-500 mt-2 italic line-clamp-2 max-w-[250px] whitespace-pre-wrap">
                                                            {ex.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                                {(ex.distance ?? 0) > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black flex items-center gap-1">
                                                            {(isStrength || ex.type === 'cardio') ? <span title="Gym / Cardiomaskin">🪜 Distans</span> : 'Distans'}
                                                        </p>
                                                        <p className="text-white font-mono font-bold">{ex.distance!.toFixed(2)} km</p>
                                                    </div>
                                                )}
                                                {(ex.distance ?? 0) > 0 && (ex.durationMinutes ?? 0) > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{isCycle ? 'Hastighet' : 'Tempo'}</p>
                                                        <p className="text-white font-mono font-bold">
                                                            {isCycle ? formatSpeed((ex.durationMinutes! * 60) / ex.distance!) : fmtPace(ex.distance!, ex.durationMinutes!)}
                                                        </p>
                                                    </div>
                                                )}
                                                {ex.tonnage && ex.tonnage > 0 ? (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Volym</p>
                                                        <p className="text-white font-mono font-bold">{(ex.tonnage / 1000).toFixed(1)} ton</p>
                                                    </div>
                                                ) : null}
                                                {(ex as any)._mergeData?.universalActivity?.performance?.kudosCount > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Kudos</p>
                                                        <p className="text-orange-400 font-mono font-bold flex items-center gap-1">
                                                            👍 {(ex as any)._mergeData.universalActivity.performance.kudosCount}
                                                        </p>
                                                    </div>
                                                )}
                                                {(ex.caloriesBurned ?? 0) > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Kalorier</p>
                                                        <p className="text-white font-mono font-bold flex items-center gap-1">
                                                            <Flame className="w-3 h-3 text-orange-500" />
                                                            {Math.round(ex.caloriesBurned!)}
                                                            {ex.isCalorieAdjusted && (
                                                                <span className="text-xs text-amber-500" title={`Justerat från ${ex.originalCalories} kcal`}>✨</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                                {ex.heartRateAvg && ex.heartRateAvg > 0 ? (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Snittpuls</p>
                                                        <p className="text-rose-400 font-mono font-bold flex items-center gap-1">
                                                            <Heart className="w-3 h-3 text-rose-500/70" /> {Math.round(ex.heartRateAvg)}
                                                        </p>
                                                    </div>
                                                ) : null}
                                                {ex.elevationGain && ex.elevationGain > 0 ? (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Höjdmeter</p>
                                                        <p className="text-white font-mono font-bold flex items-center gap-1">
                                                            <TrendingUp className="w-3 h-3 text-sky-400" />
                                                            {Math.round(ex.elevationGain)} m
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
