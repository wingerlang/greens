import React from 'react';
import { Target, Moon, Wine, Weight, Ruler, Dumbbell } from 'lucide-react';

interface DailySummaryProps {
    calories: { current: number; target: number; };
    protein: { current: number; target: number; };
    trainingMinutes: number;
    burnedCalories?: number;
    measurementsCount: number;
    weighInDone: boolean;
    sleepHours: number;
    alcoholUnits: number;
    density?: 'compact' | 'normal';
}

export const DailySummaryCard: React.FC<DailySummaryProps> = ({
    calories,
    protein,
    trainingMinutes,
    burnedCalories = 0,
    measurementsCount,
    weighInDone,
    sleepHours,
    alcoholUnits,
    density = 'normal'
}) => {
    // Determine status for checkmarks
    const isCalorieGood = calories.current <= calories.target * 1.05; // Within 5% buffer? or just under? Let's say under or close.
    // User said "if positive progress".
    const isProteinGood = protein.current >= protein.target;
    const isTrainingGood = trainingMinutes > 0;
    const isSleepGood = sleepHours >= 7; // Arbitrary good sleep
    const isAlcoholGood = alcoholUnits === 0;

    const items = [
        {
            label: 'Kcal',
            value: `${Math.round(calories.current)}`,
            sub: `/ ${calories.target}`,
            icon: Target,
            isGood: isCalorieGood,
            color: 'text-slate-900 dark:text-white',
            bg: 'bg-slate-100 dark:bg-slate-800'
        },
        {
            label: 'Protein',
            value: `${Math.round(protein.current)}g`,
            sub: `/ ${protein.target}g`,
            icon: Dumbbell, // Reusing dumbbell for protein/strength context or maybe just text
            isGood: isProteinGood,
            color: 'text-slate-900 dark:text-white',
            bg: 'bg-slate-100 dark:bg-slate-800'
        },
        {
            label: 'Träning',
            value: (() => {
                const totalMins = Math.round(trainingMinutes);
                const h = Math.floor(totalMins / 60);
                const m = totalMins % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            })(),
            sub: burnedCalories > 0 ? `-${Math.round(burnedCalories)} kcal` : '',
            icon: Dumbbell,
            isGood: isTrainingGood,
            color: isTrainingGood ? 'text-emerald-600' : 'text-slate-500',
            bg: isTrainingGood ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-800',
            subColor: 'text-rose-500'
        },
        {
            label: 'Sömn',
            value: `${sleepHours}h`,
            sub: '',
            icon: Moon,
            isGood: isSleepGood,
            color: isSleepGood ? 'text-indigo-600' : 'text-slate-500',
            bg: isSleepGood ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800'
        },
        {
            label: 'Vikt',
            value: weighInDone ? 'Klar' : '-',
            sub: '',
            icon: Weight,
            isGood: weighInDone,
            color: weighInDone ? 'text-blue-600' : 'text-slate-500',
            bg: weighInDone ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'
        },
        {
            label: 'Mått',
            value: measurementsCount > 0 ? `${measurementsCount}st` : '-',
            sub: '',
            icon: Ruler,
            isGood: measurementsCount > 0,
            color: measurementsCount > 0 ? 'text-purple-600' : 'text-slate-500',
            bg: measurementsCount > 0 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-slate-100 dark:bg-slate-800'
        },
    ];

    return (
        <div className={`w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm ${density === 'compact' ? 'p-3 rounded-2xl' : 'p-6 rounded-[2rem]'}`}>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Daglig Sammanfattning</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {items.map((item, i) => (
                    <div key={i} className={`flex flex-col items-center justify-center p-2 rounded-xl border border-transparent transition-all ${item.bg}`}>
                        <div className="flex items-center gap-1 mb-1">
                            <item.icon size={12} className={item.color} />
                            {item.isGood && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </div>
                        <div className={`font-black ${density === 'compact' ? 'text-xs' : 'text-sm'} ${item.color}`}>
                            {item.value}
                        </div>
                        {item.sub && <div className={`text-[9px] font-bold ${item.subColor || 'text-slate-400'}`}>{item.sub}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};
