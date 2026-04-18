import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { getISODate } from '../../models/types.ts';

interface NutritionInsightsProps {
    onDateSelect?: (date: string) => void;
}

export function NutritionInsights({ onDateSelect }: NutritionInsightsProps) {
    const { mealEntries, recipes, foodItems, calculateDailyNutrition, unifiedActivities, dailyVitals, selectedDate } = useData();
    const { settings } = useSettings();
    const [range, setRange] = React.useState<7 | 14 | 30>(7);

    // Calculate last N days that have measurements (not empty, not incomplete)
    const daysData = useMemo(() => {
        const foundDays = [];
        let measurementsFound = 0;
        let lookback = 0;
        const maxLookback = 180; // Hard cap at half a year back
        
        const todayStr = getISODate();
        
        while (measurementsFound < range && lookback < maxLookback) {
            const date = new Date();
            date.setDate(date.getDate() - lookback);
            const dateStr = getISODate(date);
            
            const entries = mealEntries.filter(e => e.date === dateStr);
            const isIncomplete = dailyVitals[dateStr]?.incomplete;
            const isToday = dateStr === todayStr;

            const nutrition = calculateDailyNutrition(dateStr);
            const dailyActivities = unifiedActivities.filter(a => a.date === dateStr && !a.excludeFromStats);
            const burned = dailyActivities.reduce((sum, a) => sum + (a.caloriesBurned || 0), 0);
            
            const hasData = entries.length > 0 && nutrition.calories > 0;
            const isComplete = !isIncomplete;

            // Only count towards 'range' if it's a valid complete measurement
            if (hasData && isComplete) {
                foundDays.push({
                    date: dateStr,
                    label: isToday ? 'Idag' : lookback === 1 ? 'Igår' : new Date(dateStr).toLocaleDateString('sv-SE', { weekday: 'short' }),
                    calories: nutrition.calories,
                    burned,
                    protein: nutrition.protein,
                    isToday,
                    isHistorical: !isToday,
                    isComplete: true
                });
                measurementsFound++;
            } else if (isToday) {
                foundDays.push({
                    date: dateStr,
                    label: 'Idag',
                    calories: nutrition.calories,
                    burned,
                    protein: nutrition.protein,
                    isToday: true,
                    isHistorical: false,
                    isEmpty: !hasData,
                    isComplete: false
                });
            }

            lookback++;
        }

        return foundDays.sort((a, b) => a.date.localeCompare(b.date));
    }, [mealEntries, recipes, foodItems, calculateDailyNutrition, range, dailyVitals, unifiedActivities]);

    // Filter for average: Only historical complete days (exclude today as it's partial/ongoing)
    const completeDays = daysData.filter((d: any) => !d.isToday && d.isComplete);
    const divisor = completeDays.length || 1;

    const calorieAvegare = Math.round(completeDays.reduce((acc: number, d: any) => acc + d.calories, 0) / divisor);
    const burnedAverage = Math.round(completeDays.reduce((acc: number, d: any) => acc + d.burned, 0) / divisor);
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

    // Maintenance Calculation (Physics-based)
    const age = settings.birthYear ? (new Date().getFullYear() - settings.birthYear) : 34;
    const height = settings.height || 180;
    const gender = settings.gender || 'male';
    const lastWeight = settings.weight || 75; // Simplification: use settings weight as baseline for trends
    const bmr = (10 * lastWeight) + (6.25 * height) - (5 * age) + (gender === 'female' ? -161 : 5);
    const pal = settings.metabolicBaselineMultiplier || 1.2;
    const maintenance = Math.round(bmr * pal);

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Calorie Trend */}
                <div className="trend-card bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <div className="flex items-center justify-between gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kaloritrend</span>
                                    <span className="text-[10px] font-bold text-slate-600">Snitt: <span className="text-emerald-400">{calorieAvegare} kcal</span></span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-bold text-slate-600 uppercase">Totalt: {Math.round(completeDays.reduce((acc, d) => acc + d.calories, 0))}</span>
                                    <span className="text-[9px] font-bold text-indigo-400 uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded">Netto snitt: {Math.round(calorieAvegare - burnedAverage)}</span>
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Mål: {calorieGoal}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible group/cal">
                        <line
                            x1="0" y1={chartHeight - (calorieGoal / calScale) * chartHeight}
                            x2={chartWidth} y2={chartHeight - (calorieGoal / calScale) * chartHeight}
                            stroke="#334155" strokeDasharray="4 2"
                        />
                        {daysData.map((day: any, i: number) => {
                            const val = day.calories || 0;
                            const actualH = (val / calScale) * chartHeight;
                            const h = Math.min(actualH, chartHeight);
                            const x = i * (barWidth + gap);
                            const isToday = day.isToday;
                            const opacity = day.isComplete || isToday ? 1 : 0.2;

                            return (
                                <g
                                    key={day.date}
                                    className="cursor-pointer group/bar transition-all duration-300"
                                    onClick={() => onDateSelect?.(day.date)}
                                    style={{ opacity }}
                                >
                                    <rect
                                        x={x} y={chartHeight - h}
                                        width={barWidth} height={h}
                                        fill={isToday ? '#10b981' : '#10b98144'}
                                        className="hover:fill-emerald-400 transition-colors duration-200"
                                        rx="4"
                                    />
                                    <text
                                        x={x + barWidth / 2} y={chartHeight - h - 5}
                                        textAnchor="middle"
                                        className="text-[9px] fill-emerald-400 font-black"
                                    >
                                        {val > 0 ? val : ''}
                                    </text>
                                    <text
                                        x={x + barWidth / 2} y={chartHeight + 12}
                                        textAnchor="middle"
                                        className={`text-[8px] uppercase tracking-tighter transition-colors ${isToday ? 'fill-emerald-400 font-bold' : 'fill-slate-500'} group-hover/bar:fill-white`}
                                    >
                                        {day.label}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Protein Trend */}
                <div className="trend-card bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <div className="flex items-center justify-between gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Proteintrend</span>
                                    <span className="text-[10px] font-black text-violet-400">{proteinAverage}g <span className="text-[8px] text-slate-600">snitt</span></span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-bold text-violet-500/70">{(proteinAverage / (settings.weight || 75)).toFixed(2)}g/kg</span>
                                    <div className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Mål: {proteinGoal}g</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible group/prot">
                        <line
                            x1="0" y1={chartHeight - (proteinGoal / protScale) * chartHeight}
                            x2={chartWidth} y2={chartHeight - (proteinGoal / protScale) * chartHeight}
                            stroke="#334155" strokeDasharray="4 2"
                        />
                        {daysData.map((day: any, i: number) => {
                            const val = day.protein || 0;
                            const actualH = (val / protScale) * chartHeight;
                            const h = Math.min(actualH, chartHeight);
                            const x = i * (barWidth + gap);
                            const isToday = day.isToday;
                            const opacity = day.isComplete || isToday ? 1 : 0.2;

                            return (
                                <g
                                    key={day.date}
                                    className="cursor-pointer group/bar transition-all duration-300"
                                    onClick={() => onDateSelect?.(day.date)}
                                    style={{ opacity }}
                                >
                                    <rect
                                        x={x} y={chartHeight - h}
                                        width={barWidth} height={h}
                                        fill={isToday ? '#8b5cf6' : '#8b5cf644'}
                                        className="hover:fill-violet-400 transition-colors duration-200"
                                        rx="4"
                                    />
                                    <text
                                        x={x + barWidth / 2} y={chartHeight - h - 5}
                                        textAnchor="middle"
                                        className="text-[9px] fill-violet-400 font-black"
                                    >
                                        {val > 0 ? val : ''}
                                    </text>
                                    <text
                                        x={x + barWidth / 2} y={chartHeight + 12}
                                        textAnchor="middle"
                                        className={`text-[8px] uppercase tracking-tighter transition-colors ${isToday ? 'fill-violet-400 font-bold' : 'fill-slate-500'} group-hover/bar:fill-white`}
                                    >
                                        {day.label}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Träningstrend */}
                <div className="trend-card bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Träningstrend</span>
                            <span className="text-xl font-black text-amber-400">+{burnedAverage} <span className="text-[10px] uppercase text-slate-500">kcal snitt</span></span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">Senaste {range}d</span>
                    </div>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible group/burn">
                        {daysData.map((day: any, i: number) => {
                            const val = day.burned || 0;
                            const maxBurn = Math.max(...daysData.map(d => d.burned), 100);
                            const h = (val / maxBurn) * chartHeight;
                            const x = i * (barWidth + gap);
                            const isToday = day.isToday;

                            return (
                                <g
                                    key={day.date}
                                    className="cursor-pointer group/bar transition-all duration-300"
                                    onClick={() => onDateSelect?.(day.date)}
                                >
                                    <rect
                                        x={x} y={chartHeight - h}
                                        width={barWidth} height={h}
                                        fill={isToday ? '#fbbf24' : '#fbbf2444'}
                                        className="hover:fill-amber-300 transition-colors duration-200"
                                        rx="4"
                                    />
                                    <text
                                        x={x + barWidth / 2} y={chartHeight - h - 5}
                                        textAnchor="middle"
                                        className="text-[9px] fill-amber-400 font-black"
                                    >
                                        {val > 0 ? val : '0'}
                                    </text>
                                    <text
                                        x={x + barWidth / 2} y={chartHeight + 12}
                                        textAnchor="middle"
                                        className={`text-[8px] uppercase tracking-tighter transition-colors ${isToday ? 'fill-amber-400 font-bold' : 'fill-slate-500'}`}
                                    >
                                        {day.label}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* Net Analysis Table */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/5 bg-white/5">
                <div className="px-5 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Netto-analys (Dagsöversikt)</span>
                    <span className="text-[9px] font-bold text-slate-500 italic">Maintenance (Bas): {maintenance} kcal</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                            <tr className="text-slate-500 bg-slate-950/20">
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px]">Dag / Datum</th>
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px]">Intag</th>
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px] text-amber-400">Träning</th>
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px] text-indigo-300">Bas</th>
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px]">Mål</th>
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px]">Diff (Mål)</th>
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px]">Diff (Bas)</th>
                                <th className="px-5 py-2 font-black uppercase tracking-widest text-[9px] text-right">Protein</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {daysData.filter(d => d.isComplete && !d.isToday).reverse().slice(0, 10).map(day => {
                                const net = day.calories - day.burned;
                                const balance = maintenance - net;
                                const diffGoal = net - calorieGoal;
                                const isSelected = selectedDate === day.date;

                                return (
                                    <tr 
                                        key={day.date} 
                                        onClick={() => onDateSelect?.(day.date)}
                                        className={`cursor-pointer transition-all duration-200 ${isSelected ? 'bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/50' : 'hover:bg-white/5'}`}
                                    >
                                        <td className="px-5 py-2 font-bold whitespace-nowrap">
                                            {day.label} <span className="text-[9px] font-normal text-slate-600 ml-1">{day.date.split('-').slice(1).join('/')}</span>
                                        </td>
                                        <td className={`px-5 py-2 font-black ${day.calories > calorieGoal ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {day.calories}
                                        </td>
                                        <td className="px-5 py-2 font-black text-amber-500">
                                            {day.burned > 0 ? `+${day.burned}` : '0'}
                                        </td>
                                        <td className="px-5 py-2 font-black text-indigo-300">
                                            {maintenance}
                                        </td>
                                        <td className="px-5 py-2 font-black text-slate-400">
                                            {calorieGoal}
                                        </td>
                                        <td className={`px-5 py-2 font-black ${diffGoal <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {diffGoal > 0 ? '+' : ''}{Math.round(diffGoal)}
                                        </td>
                                        <td className={`px-5 py-2 font-black ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {balance > 0 ? '+' : ''}{Math.round(balance)}
                                        </td>
                                        <td className={`px-5 py-2 font-black text-right ${day.protein >= proteinGoal ? 'text-violet-400' : 'text-slate-500'}`}>
                                            {day.protein}<span className="text-[8px] opacity-40 font-normal ml-0.5">g</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-950/40 border-t border-white/10">
                            <tr className="font-black text-[10px] uppercase tracking-widest">
                                <td className="px-5 py-3 text-slate-500">Snitt / Totalt</td>
                                <td className="px-5 py-3 text-emerald-400">{calorieAvegare} <span className="opacity-40 font-normal">avg</span></td>
                                <td className="px-5 py-3 text-amber-500">+{burnedAverage} <span className="opacity-40 font-normal">avg</span></td>
                                <td className="px-5 py-3 text-indigo-300">{maintenance} <span className="opacity-40 font-normal">avg</span></td>
                                <td className="px-5 py-3 text-slate-400">{calorieGoal}</td>
                                <td className={`px-5 py-3 ${completeDays.reduce((s, d) => s + (d.calories - d.burned - calorieGoal), 0) <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {Math.round(completeDays.reduce((s, d) => s + (d.calories - d.burned - calorieGoal), 0))} <span className="opacity-40 font-normal">sum</span>
                                </td>
                                <td className={`px-5 py-3 ${completeDays.reduce((s, d) => s + (maintenance - (d.calories - d.burned)), 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {Math.round(completeDays.reduce((s, d) => s + (maintenance - (d.calories - d.burned)), 0))} <span className="opacity-40 font-normal">sum</span>
                                </td>
                                <td className="px-5 py-3 text-right text-violet-400">{proteinAverage}g <span className="opacity-40 font-normal">avg</span></td>
                            </tr>
                        </tfoot>
                    </table>
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
