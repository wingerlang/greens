import React, { useEffect, useMemo } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { Activity, Flame, Clock, CalendarHeart, Dumbbell, Route, Zap, TrendingUp, ChevronRight } from 'lucide-react';
import { formatActivityDuration } from '../../utils/formatters.ts';

interface DailyDetailModalProps {
    date: string;
    allExercises: ExerciseEntry[];
    onClose: () => void;
    onDateChange?: (newDate: string) => void;
    onExerciseClick?: (ex: ExerciseEntry) => void;
}

export function DailyDetailModal({ date, allExercises, onClose, onDateChange, onExerciseClick }: DailyDetailModalProps) {
    // Current day's exercises
    const exercises = useMemo(() => {
        return allExercises.filter(e => e.date === date);
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

    // Compute Daily Stats
    const stats = useMemo(() => {
        let calories = 0;
        let distance = 0;
        let duration = 0;
        let tonnage = 0;
        let runCount = 0;
        let strengthCount = 0;
        let otherCount = 0;
        let totalElevation = 0;

        exercises.forEach(e => {
            calories += e.caloriesBurned || 0;
            duration += e.durationMinutes || 0;
            if (e.distance) distance += e.distance;
            if (e.tonnage) tonnage += e.tonnage;
            if (e.elevationGain) totalElevation += e.elevationGain;

            if (e.type.includes('run') || e.type.includes('löp')) runCount++;
            else if (e.type.includes('strength') || e.type.includes('styrka')) strengthCount++;
            else otherCount++;
        });

        return { calories, distance, duration, tonnage, runCount, strengthCount, otherCount, count: exercises.length, totalElevation };
    }, [exercises]);

    const fmtPace = (dist: number, min: number) => {
        if (dist <= 0 || min <= 0) return '-';
        const paceDec = min / dist;
        const pMin = Math.floor(paceDec);
        const pSec = Math.round((paceDec % 1) * 60);
        return `${pMin}:${pSec.toString().padStart(2, '0')} min/km`;
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
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
                    {/* Top Level Summary Cards */}
                    {stats.count > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-start gap-2">
                                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><Activity className="w-5 h-5" /></span>
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total Distans</p>
                                    <p className="text-2xl font-black text-white">{stats.distance.toFixed(1)} <span className="text-xs text-slate-400">km</span></p>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-start gap-2">
                                <span className="p-2 bg-orange-500/10 text-orange-400 rounded-xl"><Flame className="w-5 h-5" /></span>
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Kalorier</p>
                                    <p className="text-2xl font-black text-white">{Math.round(stats.calories)} <span className="text-xs text-slate-400">kcal</span></p>
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
                                {exercises.map((ex, i) => {
                                    const isRun = ex.type.includes('run') || ex.type.includes('löp');
                                    const isStrength = ex.type.includes('strength') || ex.type.includes('styrka');
                                    const isCycle = ex.type.includes('cycle') || ex.type.includes('cykling');

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
                                                        {ex.title ? ex.title : ex.type.replace('strength', 'Styrketräning').replace('running', 'Löpning')}
                                                    </h4>
                                                    <p className="text-slate-400 text-sm">
                                                        {formatActivityDuration(ex.durationMinutes)}
                                                        {ex.intensity && ` • ${ex.intensity}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                                {(ex.distance ?? 0) > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Distans</p>
                                                        <p className="text-white font-mono font-bold">{ex.distance!.toFixed(2)} km</p>
                                                    </div>
                                                )}
                                                {(ex.distance ?? 0) > 0 && (ex.durationMinutes ?? 0) > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Tempo</p>
                                                        <p className="text-white font-mono font-bold">{fmtPace(ex.distance!, ex.durationMinutes!)}</p>
                                                    </div>
                                                )}
                                                {ex.tonnage && ex.tonnage > 0 ? (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Volym</p>
                                                        <p className="text-white font-mono font-bold">{(ex.tonnage / 1000).toFixed(1)} ton</p>
                                                    </div>
                                                ) : null}
                                                {(ex.caloriesBurned ?? 0) > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Kalorier</p>
                                                        <p className="text-white font-mono font-bold flex items-center gap-1">
                                                            <Flame className="w-3 h-3 text-orange-500" />
                                                            {Math.round(ex.caloriesBurned!)}
                                                        </p>
                                                    </div>
                                                )}
                                                {ex.heartRateAvg && ex.heartRateAvg > 0 ? (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Snittpuls</p>
                                                        <p className="text-rose-400 font-mono font-bold flex items-center gap-1">
                                                            ♥ {Math.round(ex.heartRateAvg)}
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
        </div>
    );
}
