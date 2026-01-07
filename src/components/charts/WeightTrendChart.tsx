import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import { WeightEntry } from '../../models/types.ts';

interface WeightTrendChartProps {
    entries: WeightEntry[];
    currentWeight: number;
    onEntryClick?: (entry: WeightEntry) => void;
}

interface TrendSegment {
    startIndex: number;
    endIndex: number;
    trend: 'loss' | 'gain' | 'stable';
    startWeight: number;
    endWeight: number;
}

/**
 * ZigZag Trend Detection Algorithm
 * Refined to focus on meaningful weight changes and filter out noise.
 */
function calculateZigZagTrends(rawWeights: number[], rawDates: string[], maxSegments: number = 20): TrendSegment[] {
    if (rawWeights.length < 2) return [];

    // 0. Pre-processing: Consolidate same-day entries
    const dailyMap = new Map<string, { sum: number, count: number }>();
    for (let i = 0; i < rawWeights.length; i++) {
        const date = rawDates[i];
        const val = dailyMap.get(date) || { sum: 0, count: 0 };
        val.sum += rawWeights[i];
        val.count += 1;
        dailyMap.set(date, val);
    }

    const dates = Array.from(dailyMap.keys()).sort();
    const weights = dates.map(d => dailyMap.get(d)!.sum / dailyMap.get(d)!.count);

    if (weights.length < 2) return [];

    // 1. Initial Pass: Find local peaks and troughs
    const weightRange = Math.max(...weights) - Math.min(...weights);
    const threshold = Math.max(0.6, weightRange * 0.015); // Slightly more sensitive

    let turningPoints: number[] = [0];
    let lastPointIdx = 0;
    let currentTrend: 'up' | 'down' | null = null;

    for (let i = 1; i < weights.length; i++) {
        const diff = weights[i] - weights[lastPointIdx];

        if (currentTrend === null) {
            if (Math.abs(diff) >= threshold) {
                currentTrend = diff > 0 ? 'up' : 'down';
                lastPointIdx = i;
            }
        } else if (currentTrend === 'up') {
            if (weights[i] > weights[lastPointIdx]) {
                lastPointIdx = i;
            } else if (weights[i] < weights[lastPointIdx] - threshold) {
                turningPoints.push(lastPointIdx);
                currentTrend = 'down';
                lastPointIdx = i;
            }
        } else if (currentTrend === 'down') {
            if (weights[i] < weights[lastPointIdx]) {
                lastPointIdx = i;
            } else if (weights[i] > weights[lastPointIdx] + threshold) {
                turningPoints.push(lastPointIdx);
                currentTrend = 'up';
                lastPointIdx = i;
            }
        }
    }
    turningPoints.push(weights.length - 1);
    turningPoints = [...new Set(turningPoints)].sort((a, b) => a - b);

    // 2. Create Segments
    const finalSegments: TrendSegment[] = [];
    const stableThreshold = 3.5; // kg

    for (let i = 0; i < turningPoints.length - 1; i++) {
        const startIdx = turningPoints[i];
        const endIdx = turningPoints[i + 1];

        const startW = weights[startIdx];
        const endW = weights[endIdx];
        const change = endW - startW;

        let trend: 'loss' | 'gain' | 'stable';
        if (Math.abs(change) < stableThreshold) {
            trend = 'stable';
        } else if (change < 0) {
            trend = 'loss';
        } else {
            trend = 'gain';
        }

        finalSegments.push({
            startIndex: startIdx,
            endIndex: endIdx,
            trend,
            startWeight: startW,
            endWeight: endW
        });
    }

    return finalSegments;
}

const TREND_COLORS = {
    loss: '#10b981',   // Emerald green
    gain: '#ef4444',   // Red
    stable: '#3b82f6', // Blue
};

export function WeightTrendChart({ entries, currentWeight, onEntryClick }: WeightTrendChartProps) {
    // 1. Process entries: Sort and Unique by Date (taking the latest entry for a day if multiple)
    const sortedUniqueEntries = useMemo(() => {
        const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const unique = new Map<string, WeightEntry>();
        sorted.forEach(e => unique.set(e.date, e)); // Latest overwrites
        return Array.from(unique.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [entries]);

    const trendSegments = useMemo(() => {
        if (sortedUniqueEntries.length < 2) return [];
        return calculateZigZagTrends(sortedUniqueEntries.map(e => e.weight), sortedUniqueEntries.map(e => e.date));
    }, [sortedUniqueEntries]);

    // Check if we have measurement data
    const hasMeasurements = useMemo(() => {
        return sortedUniqueEntries.some(e => e.waist || e.chest);
    }, [sortedUniqueEntries]);

    // 2. Prepare Chart Data
    const chartData = useMemo(() => {
        return sortedUniqueEntries.map((e, idx) => {
            const point: any = {
                ...e,
                displayDate: e.date.slice(5),
                weight: e.weight,
                waist: e.waist || null,
                chest: e.chest || null,
            };

            // Populate trend-specific fields
            trendSegments.forEach(seg => {
                if (idx >= seg.startIndex && idx <= seg.endIndex) {
                    if (seg.trend === 'loss') point.lossWeight = e.weight;
                    if (seg.trend === 'gain') point.gainWeight = e.weight;
                    if (seg.trend === 'stable') point.stableWeight = e.weight;
                }
            });
            return point;
        });
    }, [sortedUniqueEntries, trendSegments]);

    if (sortedUniqueEntries.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center p-6 opacity-50 h-full">
                <span className="text-3xl mb-3">📊</span>
                <p className="text-xs text-center text-slate-400">Minst 2 viktmätningar behövs för trenden.</p>
            </div>
        );
    }

    const weights = sortedUniqueEntries.map(d => d.weight);
    const minW = Math.floor(Math.min(...weights) - 1);
    const maxW = Math.ceil(Math.max(...weights) + 1);
    const weightChange = currentWeight - weights[0];

    // Calculate CM axis range
    const cmValues = sortedUniqueEntries.flatMap(e => [e.waist, e.chest].filter(v => v != null)) as number[];
    const minCm = cmValues.length > 0 ? Math.floor(Math.min(...cmValues) - 5) : 70;
    const maxCm = cmValues.length > 0 ? Math.ceil(Math.max(...cmValues) + 5) : 120;

    // Get latest measurements for header
    const latestWaist = sortedUniqueEntries.filter(e => e.waist).slice(-1)[0]?.waist;
    const latestChest = sortedUniqueEntries.filter(e => e.chest).slice(-1)[0]?.chest;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 px-1">
                <div>
                    <div className="text-2xl font-black text-white">
                        {currentWeight.toFixed(1)} <span className="text-xs text-slate-500 font-bold">kg</span>
                        {latestWaist && (
                            <span className="ml-3 text-lg text-emerald-400">
                                {latestWaist} <span className="text-xs text-slate-500 font-bold">cm (midja)</span>
                            </span>
                        )}
                        {latestChest && (
                            <span className="ml-3 text-lg text-indigo-400">
                                {latestChest} <span className="text-xs text-slate-500 font-bold">cm (bröst)</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${weightChange > 0 ? 'bg-rose-500/10 text-rose-400' : weightChange < 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                        </span>
                        <span className="text-[9px] uppercase text-slate-500 tracking-wide">
                            sedan {sortedUniqueEntries[0].date}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3 text-[8px] uppercase font-bold text-slate-500 flex-wrap justify-end">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ner
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Upp
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> Stabil
                    </span>
                    {hasMeasurements && (
                        <>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Midja
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-indigo-400" /> Bröst
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 w-full min-h-0" style={{ height: 'calc(100% - 60px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: hasMeasurements ? 50 : 15, left: 5, bottom: 5 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                            vertical={false}
                        />

                        <XAxis
                            dataKey="displayDate"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            dy={5}
                            minTickGap={20}
                        />

                        {/* Left Y-Axis: Weight (kg) */}
                        <YAxis
                            yAxisId="weight"
                            domain={[minW, maxW]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            width={35}
                            tickFormatter={(v) => `${v} kg`}
                        />

                        {/* Right Y-Axis: Measurements (cm) */}
                        {hasMeasurements && (
                            <YAxis
                                yAxisId="cm"
                                orientation="right"
                                domain={[minCm, maxCm]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                width={40}
                                tickFormatter={(v) => `${v} cm`}
                            />
                        )}

                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl backdrop-blur">
                                            <div className="text-lg font-bold text-white">
                                                {data.weight.toFixed(1)} kg
                                            </div>
                                            {data.waist && (
                                                <div className="text-sm font-bold text-emerald-400">
                                                    {data.waist} cm <span className="text-xs text-slate-500">(midja)</span>
                                                </div>
                                            )}
                                            {data.chest && (
                                                <div className="text-sm font-bold text-indigo-400">
                                                    {data.chest} cm <span className="text-xs text-slate-500">(bröst)</span>
                                                </div>
                                            )}
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                {data.date}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        {/* Weight Trend Lines (Left Axis) */}
                        <Line
                            yAxisId="weight"
                            type="monotone"
                            dataKey="lossWeight"
                            stroke={TREND_COLORS.loss}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 5, fill: TREND_COLORS.loss }}
                            isAnimationActive={false}
                        />
                        <Line
                            yAxisId="weight"
                            type="monotone"
                            dataKey="gainWeight"
                            stroke={TREND_COLORS.gain}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 5, fill: TREND_COLORS.gain }}
                            isAnimationActive={false}
                        />
                        <Line
                            yAxisId="weight"
                            type="monotone"
                            dataKey="stableWeight"
                            stroke={TREND_COLORS.stable}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 5, fill: TREND_COLORS.stable }}
                            isAnimationActive={false}
                        />

                        {/* Measurement Lines (Right Axis) */}
                        {hasMeasurements && (
                            <>
                                <Line
                                    yAxisId="cm"
                                    type="monotone"
                                    dataKey="waist"
                                    stroke="#34d399"
                                    strokeWidth={2}
                                    strokeDasharray="4 2"
                                    dot={{ r: 3, fill: '#34d399' }}
                                    activeDot={{ r: 5, fill: '#34d399' }}
                                    isAnimationActive={false}
                                    connectNulls={true}
                                />
                                <Line
                                    yAxisId="cm"
                                    type="monotone"
                                    dataKey="chest"
                                    stroke="#818cf8"
                                    strokeWidth={2}
                                    strokeDasharray="4 2"
                                    dot={{ r: 3, fill: '#818cf8' }}
                                    activeDot={{ r: 5, fill: '#818cf8' }}
                                    isAnimationActive={false}
                                    connectNulls={true}
                                />
                            </>
                        )}

                        {/* Invisible dot layer for click interactions everywhere */}
                        <Line
                            yAxisId="weight"
                            type="monotone"
                            dataKey="weight"
                            stroke="none"
                            dot={{
                                fill: 'transparent',
                                strokeWidth: 0,
                                r: 4,
                                cursor: 'pointer'
                            }}
                            activeDot={false}
                        />

                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

