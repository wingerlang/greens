import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { getISODate } from '../../models/types.ts';

interface NutritionInsightsProps {
    onDateSelect?: (date: string) => void;
}

export function NutritionInsights({ onDateSelect }: NutritionInsightsProps) {
    const { mealEntries, recipes, foodItems, calculateDailyNutrition } = useData();
    const { settings } = useSettings();
    const [range, setRange] = React.useState<7 | 14 | 30>(7);

    // Calculate last N days of data
    const daysData = useMemo(() => {
        const days = [];
        for (let i = range as number; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = getISODate(date);
            const nutrition = calculateDailyNutrition(dateStr);

            days.push({
                date: dateStr,
                label: i === 0 ? 'Idag' : i === 1 ? 'Igår' : new Date(dateStr).toLocaleDateString('sv-SE', { weekday: 'short' }),
                calories: nutrition.calories,
                protein: nutrition.protein,
                isToday: i === 0
            });
        }
        return days;
    }, [mealEntries, recipes, foodItems, calculateDailyNutrition, range]);

    // Filter out incomplete days, and EXCLUDE TODAY for the average
    const completeDays = daysData.filter((d: any) => !d.isToday && !settings.incompleteDays?.[d.date]);

    // Safety check to avoid division by zero
    const divisor = completeDays.length || 1;

    const calorieAvegare = Math.round(completeDays.reduce((acc: number, d: any) => acc + d.calories, 0) / divisor);
    const proteinAverage = Math.round(completeDays.reduce((acc: number, d: any) => acc + d.protein, 0) / divisor * 10) / 10;

    const calorieGoal = settings.dailyCalorieGoal || 2000;
    const proteinGoal = settings.dailyProteinGoal || 150;

    // SVG Chart Constants
    const chartHeight = 100;
    const barWidth = 32;
    const gap = 8;

    // Scaling logic: Cap at 250% of goal to handle outliers visually
    const CALORIE_CAP_FACTOR = 2.5;
    const PROTEIN_CAP_FACTOR = 2.5;

    const maxCalDisplay = calorieGoal * CALORIE_CAP_FACTOR;
    const maxProtDisplay = proteinGoal * PROTEIN_CAP_FACTOR;

    const maxCal = Math.max(...daysData.map(d => d.calories), calorieGoal, 1);
    const maxProt = Math.max(...daysData.map(d => d.protein), proteinGoal, 1);

    // Scaling for chart rendering
    const calScale = Math.min(maxCal, maxCalDisplay);
    const protScale = Math.min(maxProt, maxProtDisplay);

    const chartWidth = daysData.length * (barWidth + gap);

    return (
        <div className="nutrition-insights p-4 bg-slate-900/50 rounded-2xl border border-slate-800 animate-fadeIn mt-4 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span>📈</span> Insikter & Trender
                </h3>
                <div className="flex gap-1 bg-slate-800/80 p-1 rounded-xl">
                    {[7, 14, 30].map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r as any)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${range === r ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            {r}d
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Calorie Trend */}
                <div className="trend-card">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <span className="text-xs text-slate-500 block">Kaloritrend ({completeDays.length} dgr)</span>
                            <span className="text-lg font-bold text-emerald-400">{calorieAvegare} <span className="text-xs font-normal text-slate-500">kcal snitt</span></span>
                        </div>
                        <span className="text-[10px] text-slate-500">Mål: {calorieGoal}</span>
                    </div>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible group/cal">
                        {/* Goal line */}
                        <line
                            x1="0" y1={chartHeight - (calorieGoal / calScale) * chartHeight}
                            x2={chartWidth} y2={chartHeight - (calorieGoal / calScale) * chartHeight}
                            stroke="#334155" strokeDasharray="4 2"
                        />
                        {daysData.map((day: any, i: number) => {
                            const actualH = (day.calories / calScale) * chartHeight;
                            const isCapped = day.calories > maxCalDisplay;
                            const h = Math.min(actualH, chartHeight);
                            const x = i * (barWidth + gap);
                            const isToday = day.isToday;
                            const isIncomplete = settings.incompleteDays?.[day.date];

                            return (
                                <g
                                    key={day.date}
                                    className="cursor-pointer group/bar transition-all duration-300"
                                    onClick={() => onDateSelect?.(day.date)}
                                    style={{ opacity: isIncomplete ? 0.3 : 1 }}
                                >
                                    <title>{`${day.date}: ${day.calories} kcal ${isIncomplete ? '(Inkomplett)' : ''}`}</title>
                                    <rect
                                        x={x} y={chartHeight - h}
                                        width={barWidth} height={h}
                                        fill={isToday ? '#10b981' : '#10b98144'}
                                        className="hover:fill-emerald-400 transition-colors duration-200"
                                        rx="4"
                                    />
                                    {isCapped && (
                                        <text
                                            x={x + barWidth / 2} y={chartHeight - h + 10}
                                            textAnchor="middle"
                                            className="text-[10px] fill-white font-bold pointer-events-none"
                                        >
                                            !
                                        </text>
                                    )}
                                    {isIncomplete && (
                                        <text
                                            x={x + barWidth / 2} y={chartHeight - h - 15}
                                            textAnchor="middle"
                                            className="text-[8px] fill-amber-500 font-bold"
                                        >
                                            ⚠️
                                        </text>
                                    )}
                                    <text
                                        x={x + barWidth / 2} y={chartHeight + 12}
                                        textAnchor="middle"
                                        className={`text-[8px] uppercase tracking-tighter transition-colors ${isToday ? 'fill-emerald-400 font-bold' : 'fill-slate-500'} group-hover/bar:fill-white`}
                                    >
                                        {day.label}
                                    </text>

                                    {/* Hover Value */}
                                    <text
                                        x={x + barWidth / 2} y={chartHeight - h - 4}
                                        textAnchor="middle"
                                        className="text-[8px] fill-emerald-300 font-bold opacity-0 group-hover/bar:opacity-100 transition-opacity"
                                    >
                                        {day.calories}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Protein Trend */}
                <div className="trend-card">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <span className="text-xs text-slate-500 block">Proteintrend ({completeDays.length} dgr)</span>
                            <span className="text-lg font-bold text-violet-400">{proteinAverage}g <span className="text-xs font-normal text-slate-500">snitt</span></span>
                        </div>
                        <span className="text-[10px] text-slate-500">Mål: {proteinGoal}g</span>
                    </div>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible group/prot">
                        {/* Goal line */}
                        <line
                            x1="0" y1={chartHeight - (proteinGoal / protScale) * chartHeight}
                            x2={chartWidth} y2={chartHeight - (proteinGoal / protScale) * chartHeight}
                            stroke="#334155" strokeDasharray="4 2"
                        />
                        {daysData.map((day: any, i: number) => {
                            const actualH = (day.protein / protScale) * chartHeight;
                            const isCapped = day.protein > maxProtDisplay;
                            const h = Math.min(actualH, chartHeight);
                            const x = i * (barWidth + gap);
                            const isToday = day.isToday;
                            const isIncomplete = settings.incompleteDays?.[day.date];

                            return (
                                <g
                                    key={day.date}
                                    className="cursor-pointer group/bar transition-all duration-300"
                                    onClick={() => onDateSelect?.(day.date)}
                                    style={{ opacity: isIncomplete ? 0.3 : 1 }}
                                >
                                    <title>{`${day.date}: ${day.protein}g protein`}</title>
                                    <rect
                                        x={x} y={chartHeight - h}
                                        width={barWidth} height={h}
                                        fill={isToday ? '#8b5cf6' : '#8b5cf644'}
                                        className="hover:fill-violet-400 transition-colors duration-200"
                                        rx="4"
                                    />
                                    {isCapped && (
                                        <text
                                            x={x + barWidth / 2} y={chartHeight - h + 10}
                                            textAnchor="middle"
                                            className="text-[10px] fill-white font-bold pointer-events-none"
                                        >
                                            !
                                        </text>
                                    )}
                                    <text
                                        x={x + barWidth / 2} y={chartHeight + 12}
                                        textAnchor="middle"
                                        className={`text-[8px] uppercase tracking-tighter transition-colors ${isToday ? 'fill-violet-400 font-bold' : 'fill-slate-500'} group-hover/bar:fill-white`}
                                    >
                                        {day.label}
                                    </text>

                                    {/* Hover Value */}
                                    <text
                                        x={x + barWidth / 2} y={chartHeight - h - 4}
                                        textAnchor="middle"
                                        className="text-[8px] fill-violet-300 font-bold opacity-0 group-hover/bar:opacity-100 transition-opacity"
                                    >
                                        {day.protein}g
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* Quick Tips & Facts */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Dagens Tips</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Kombinera <span className="text-amber-400">baljväxter</span> med <span className="text-sky-400">spannmål</span> för att få i dig alla essentiella aminosyror!
                    </p>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Prognos</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Baserat på veckan ligger du på <span className="text-emerald-400">{Math.round((calorieAvegare / calorieGoal) * 100)}%</span> av ditt kaloriemål.
                        {calorieAvegare < calorieGoal ? ' Ett litet överskott kan behövas för muskelbygge.' : ' Snyggt jobbat!'}
                    </p>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Mikro-koll</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Har du ätit <span className="text-rose-400">broccoli</span> eller <span className="text-rose-400">spenat</span> idag? Bra källor till både järn och kalcium för veganer.
                    </p>
                </div>
            </div>
        </div>
    );
}
