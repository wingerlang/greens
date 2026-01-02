import React, { useMemo, useState } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceArea,
    Area
} from 'recharts';

interface CycleYearChartProps {
    cycles: any[];
    weightEntries: any[];
    nutrition: any[];
    exercises: any[];
    zoomMonths: number;
    visibleMetrics: { calories: boolean; volume: boolean; workouts: boolean };
    filterStartDate?: string | null;
    filterEndDate?: string | null;
    onEditCycle?: (cycle: any) => void;
    onCreateCycleAfter?: (cycle: any) => void;
}

// Helper to get week number
function getWeekKey(date: Date, startDate: Date): number {
    const diffTime = date.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7);
}

// Format week label
function formatWeekLabel(weekNum: number, startDate: Date): string {
    const weekStart = new Date(startDate.getTime() + weekNum * 7 * 24 * 60 * 60 * 1000);
    return `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
}

export function CycleYearChart({
    cycles,
    weightEntries,
    nutrition,
    exercises,
    zoomMonths,
    visibleMetrics,
    filterStartDate,
    filterEndDate,
    onEditCycle,
    onCreateCycleAfter
}: CycleYearChartProps) {
    const [selectedCycle, setSelectedCycle] = useState<any>(null);

    // Calculate date range
    const today = new Date();
    const startDate = useMemo(() => {
        if (filterStartDate) return new Date(filterStartDate);

        // If no filter, fall back to zoom window
        const d = new Date(today);
        d.setMonth(today.getMonth() - zoomMonths);
        return d;
    }, [zoomMonths, filterStartDate, today]);

    const endDate = useMemo(() => {
        if (filterEndDate) return new Date(filterEndDate);

        // If no filter, fall back to zoom window
        const d = new Date(today);
        d.setMonth(today.getMonth() + zoomMonths);
        return d;
    }, [zoomMonths, filterEndDate, today]);

    // Transform data to weekly aggregates
    const chartData = useMemo(() => {
        const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const weeks: Record<number, { calories: number; calorieCount: number; tonnage: number; workouts: number; weight: number | null; date: Date }> = {};

        // Initialize weeks
        for (let i = 0; i <= totalWeeks; i++) {
            weeks[i] = {
                calories: 0,
                calorieCount: 0,
                tonnage: 0,
                workouts: 0,
                weight: null,
                date: new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000)
            };
        }

        // Aggregate nutrition (calories)
        nutrition.forEach(n => {
            const d = new Date(n.date);
            if (d >= startDate && d <= endDate) {
                const weekNum = getWeekKey(d, startDate);
                if (weeks[weekNum]) {
                    weeks[weekNum].calories += n.calories || 0;
                    weeks[weekNum].calorieCount++;
                }
            }
        });

        // Aggregate exercises (tonnage + workout count)
        exercises.forEach(e => {
            const d = new Date(e.date);
            if (d >= startDate && d <= endDate) {
                const weekNum = getWeekKey(d, startDate);
                if (weeks[weekNum]) {
                    weeks[weekNum].tonnage += (e.tonnage || 0) / 1000; // Convert to tons
                    weeks[weekNum].workouts++;
                }
            }
        });

        // Get weight (last entry per week)
        const sortedWeights = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date));
        sortedWeights.forEach(w => {
            const d = new Date(w.date);
            if (d >= startDate && d <= endDate) {
                const weekNum = getWeekKey(d, startDate);
                if (weeks[weekNum]) {
                    weeks[weekNum].weight = w.weight;
                }
            }
        });

        // Convert to array and calculate averages
        return Object.entries(weeks)
            .map(([weekNum, data]) => ({
                weekNum: parseInt(weekNum),
                label: formatWeekLabel(parseInt(weekNum), startDate),
                avgCalories: data.calorieCount > 0 ? Math.round(data.calories / data.calorieCount) : null,
                tonnage: data.tonnage > 0 ? Math.round(data.tonnage * 10) / 10 : null,
                workouts: data.workouts || null,
                weight: data.weight,
                date: data.date.toISOString().split('T')[0]
            }))
            .sort((a, b) => a.weekNum - b.weekNum);
    }, [nutrition, exercises, weightEntries, startDate, endDate]);

    // Cycle zones for reference areas
    const cycleZones = useMemo(() => {
        return cycles
            .filter(cycle => {
                const cycleStart = new Date(cycle.startDate);
                const cycleEnd = cycle.endDate ? new Date(cycle.endDate) : endDate;
                return cycleEnd >= startDate && cycleStart <= endDate;
            })
            .map(cycle => {
                const cycleStart = new Date(cycle.startDate);
                const cycleEnd = cycle.endDate ? new Date(cycle.endDate) : endDate;
                const startWeek = Math.max(0, getWeekKey(cycleStart, startDate));
                const endWeek = getWeekKey(cycleEnd, startDate);

                return {
                    ...cycle,
                    startWeek,
                    endWeek,
                    color: cycle.goal === 'deff' ? 'rgba(244, 63, 94, 0.15)' :
                        cycle.goal === 'bulk' ? 'rgba(16, 185, 129, 0.15)' :
                            'rgba(59, 130, 246, 0.15)'
                };
            });
    }, [cycles, startDate, endDate]);

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;

        return (
            <div className="bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-md">
                <div className="text-xs font-bold text-white mb-2">Vecka {label}</div>
                <div className="space-y-1">
                    {payload.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between gap-4 text-xs">
                            <span style={{ color: p.color }}>{p.name}</span>
                            <span className="font-bold text-white">
                                {p.value !== null ? p.value : '-'}
                                {p.name === 'Kcal' && ' kcal'}
                                {p.name === 'Vikt' && ' kg'}
                                {p.name === 'Ton' && 't'}
                                {p.name === 'Pass' && ' st'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="relative w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                >
                    {/* Cycle background zones */}
                    {cycleZones.map(zone => (
                        <ReferenceArea
                            key={zone.id}
                            x1={zone.startWeek}
                            x2={zone.endWeek}
                            fill={zone.color}
                            onClick={() => onEditCycle?.(zone)}
                            style={{ cursor: 'pointer' }}
                        />
                    ))}

                    <XAxis
                        dataKey="weekNum"
                        tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        interval={Math.max(1, Math.floor(chartData.length / 12))}
                        tickFormatter={(weekNum) => {
                            const item = chartData.find(d => d.weekNum === weekNum);
                            return item?.label || '';
                        }}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                    />

                    {/* Left Y-axis for calories */}
                    <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        width={40}
                    />

                    {/* Right Y-axis for weight */}
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: '#10b981', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 2', 'dataMax + 2']}
                        width={35}
                    />

                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />

                    <Legend
                        wrapperStyle={{ fontSize: '10px', fontWeight: '600' }}
                        formatter={(value) => <span className="text-slate-400">{value}</span>}
                    />

                    {/* Calorie bars */}
                    {visibleMetrics.calories && (
                        <Bar
                            yAxisId="left"
                            dataKey="avgCalories"
                            name="Kcal"
                            fill="rgba(129, 140, 248, 0.6)"
                            radius={[4, 4, 0, 0]}
                        />
                    )}

                    {/* Tonnage area */}
                    {visibleMetrics.volume && (
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="tonnage"
                            name="Ton"
                            fill="rgba(251, 191, 36, 0.2)"
                            stroke="#fbbf24"
                            strokeWidth={2}
                        />
                    )}

                    {/* Workout count */}
                    {visibleMetrics.workouts && (
                        <Bar
                            yAxisId="left"
                            dataKey="workouts"
                            name="Pass"
                            fill="rgba(34, 197, 94, 0.6)"
                            radius={[4, 4, 0, 0]}
                        />
                    )}

                    {/* Weight line */}
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="weight"
                        name="Vikt"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
                        connectNulls
                    />
                </ComposedChart>
            </ResponsiveContainer>

            {/* Cycle labels */}
            <div className="absolute top-2 left-12 right-12 h-6 pointer-events-none">
                {cycleZones.map(zone => {
                    const totalWeeks = chartData.length;
                    const startPct = (zone.startWeek / totalWeeks) * 100;
                    const widthPct = ((zone.endWeek - zone.startWeek) / totalWeeks) * 100;

                    if (widthPct < 8) return null;

                    return (
                        <div
                            key={zone.id}
                            className="absolute h-full flex items-center overflow-hidden pointer-events-auto cursor-pointer hover:opacity-70 transition-opacity"
                            style={{
                                left: `${startPct}%`,
                                width: `${widthPct}%`,
                            }}
                            onClick={() => onEditCycle?.(zone)}
                        >
                            <span
                                className="text-[9px] font-black uppercase tracking-wider px-1 truncate"
                                style={{
                                    color: zone.goal === 'deff' ? '#f43f5e' :
                                        zone.goal === 'bulk' ? '#10b981' : '#3b82f6'
                                }}
                            >
                                {zone.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
