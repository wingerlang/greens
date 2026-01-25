import React from 'react';
import { EXERCISE_TYPES } from '../training/ExerciseModal.tsx';

interface WeeklySummaryProps {
    selectedDate: string;
    activities: any[]; // Using any[] for now as types.ts is not fully imported here, can be refined
    history: any[];    // Unified history entries
}

export function WeeklySummary({ selectedDate, activities, history }: WeeklySummaryProps) {
    // Determine "Current Week" based on selectedDate
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];
    const sunday = new Date(d.setDate(diff + 6)).toISOString().split('T')[0];

    // Simple ISO week number
    const targetDate = new Date(monday);
    const jan4 = new Date(targetDate.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round((((targetDate.getTime() - jan4.getTime()) / 86400000) - 3 + ((jan4.getDay() + 6) % 7)) / 7);

    // Aggregate data for this calendar week
    const weekActivities = activities.filter(a => a.date >= monday && a.date <= sunday);
    const weekVolume = weekActivities.reduce((sum, a) => sum + (a.tonnage || 0), 0) / 1000;
    const weekDistance = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
    // const weekDuration = weekActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    // const weekWorkouts = weekActivities.length;

    // Calculate context label
    const currentWeekNum = (() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(d.setDate(diff));
        const jan4 = new Date(mon.getFullYear(), 0, 4);
        return 1 + Math.round((((mon.getTime() - jan4.getTime()) / 86400000) - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    })();

    let mainTitle = `Vecka ${weekNum} Summary`;
    if (weekNum === currentWeekNum) {
        mainTitle = 'NUVARANDE VECKA SUMMARY';
    }

    const rangeText = `${new Date(monday).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} - ${new Date(sunday).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`;
    const currentTime = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

    // Measurement Diffs
    const getDiff = (type: 'weight' | 'waist' | 'chest') => {
        const records = history
            .map(h => ({ date: h.date, value: h[type] }))
            .filter(r => r.value !== undefined && r.value !== null && r.value !== 0)
            .sort((a, b) => a.date.localeCompare(b.date)) as { date: string, value: number }[];

        if (records.length === 0) return null;

        const inWeek = records.filter(r => r.date >= monday && r.date <= sunday);
        if (inWeek.length === 0) {
            // If no measurements in week, we can't show a diff for the week, 
            // but we can show the current value if it exists
            const latestOverall = records[records.length - 1];
            return { diff: 0, current: latestOverall.value };
        }

        const latestInWeek = inWeek[inWeek.length - 1];
        const beforeWeek = records.filter(r => r.date < monday);

        if (beforeWeek.length > 0) {
            const baseline = beforeWeek[beforeWeek.length - 1];
            return { diff: latestInWeek.value - baseline.value, current: latestInWeek.value };
        } else if (inWeek.length > 1) {
            const baseline = inWeek[0];
            return { diff: latestInWeek.value - baseline.value, current: latestInWeek.value };
        }
        return { diff: 0, current: latestInWeek.value };
    };

    const wDiff = getDiff('weight');
    const waistDiff = getDiff('waist');
    const chestDiff = getDiff('chest');

    return (
        <div className="flex flex-col items-center">
            <div className="flex flex-col items-center mb-4">
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] opacity-70">
                    {mainTitle}
                </div>
                <div className="text-[9px] font-bold text-slate-400/60 uppercase tracking-widest mt-1">
                    {rangeText} • {currentTime}
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 w-full">
                {/* Running Box */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 md:px-4 py-3 flex flex-col items-center justify-center shadow-sm flex-1 min-w-0 hover:shadow-md transition-shadow">
                    <div className="text-xl mb-1">🏃‍♂️</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Löpning</div>
                    <div className="text-lg font-bold text-emerald-500">
                        {weekActivities.filter(a => a.type === 'running' || a.type === 'cycling' || a.type === 'walking').length} pass <span className="text-slate-300 mx-1">|</span> {Math.round(weekDistance)}km
                    </div>
                </div>

                {/* Strength Box */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 md:px-4 py-3 flex flex-col items-center justify-center shadow-sm flex-1 min-w-0 hover:shadow-md transition-shadow">
                    <div className="text-xl mb-1">💪</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Styrka</div>
                    <div className="text-lg font-bold text-indigo-500">
                        {weekActivities.filter(a => a.type === 'strength').length} pass <span className="text-slate-300 mx-1">|</span> {weekVolume.toFixed(1)} ton
                    </div>
                </div>

                {/* Measurement Diffs Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 md:px-4 py-3 flex flex-col items-center justify-center shadow-sm flex-1 min-w-0 hover:shadow-md transition-shadow">
                    <div className="text-xl mb-1">⚖️</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Framsteg</div>
                    <div className="grid grid-cols-3 gap-4 w-full">
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Vikt</span>
                            <span className={`text-xs font-black ${wDiff && wDiff.diff !== 0 ? (wDiff.diff < 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                {wDiff ? (wDiff.diff > 0 ? `+${wDiff.diff.toFixed(1)}` : wDiff.diff.toFixed(1)) : '-'}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Midja</span>
                            <span className={`text-xs font-black ${waistDiff && waistDiff.diff !== 0 ? (waistDiff.diff < 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                {waistDiff ? (waistDiff.diff > 0 ? `+${waistDiff.diff.toFixed(1)}` : waistDiff.diff.toFixed(1)) : '-'}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Bröst</span>
                            <span className={`text-xs font-black ${chestDiff && chestDiff.diff !== 0 ? (chestDiff.diff < 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                {chestDiff ? (chestDiff.diff > 0 ? `+${chestDiff.diff.toFixed(1)}` : chestDiff.diff.toFixed(1)) : '-'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
