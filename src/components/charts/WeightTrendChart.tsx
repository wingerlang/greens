import React, { useMemo, useState } from 'react';
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
/**
 * ZigZag Trend Detection Algorithm
 * Refined to focus on meaningful weight changes and filter out noise.
 */
function calculateZigZagTrends(rawWeights: number[], rawDates: string[], maxSegments: number = 15): TrendSegment[] {
    if (rawWeights.length < 2) return [];

    // 0. Pre-processing: Consolidate same-day entries (average them) to reduce jitter
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
    // We use a significant threshold to ignore small fluctuations.
    const weightRange = Math.max(...weights) - Math.min(...weights);
    const threshold = Math.max(0.8, weightRange * 0.02); // Min 0.8kg or 2% of range

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
                lastPointIdx = i; // New peak
            } else if (weights[i] < weights[lastPointIdx] - threshold) {
                turningPoints.push(lastPointIdx);
                currentTrend = 'down';
                lastPointIdx = i;
            }
        } else if (currentTrend === 'down') {
            if (weights[i] < weights[lastPointIdx]) {
                lastPointIdx = i; // New trough
            } else if (weights[i] > weights[lastPointIdx] + threshold) {
                turningPoints.push(lastPointIdx);
                currentTrend = 'up';
                lastPointIdx = i;
            }
        }
    }
    turningPoints.push(weights.length - 1);
    turningPoints = [...new Set(turningPoints)].sort((a, b) => a - b);

    // 2. Aggressive Refinement Pass: Eliminate "flickering" short segments
    // We iterate until no more simple merges can be done or we reach segment target.
    let refinedPoints = [...turningPoints];
    let changed = true;
    while (changed && refinedPoints.length > 2) {
        changed = false;
        const newPoints: number[] = [refinedPoints[0]];

        for (let i = 1; i < refinedPoints.length - 1; i++) {
            const prevIdx = refinedPoints[i - 1];
            const currIdx = refinedPoints[i];
            const nextIdx = refinedPoints[i + 1];

            const prevW = weights[prevIdx];
            const currW = weights[currIdx];
            const nextW = weights[nextIdx];

            const segment1Change = currW - prevW;
            const segment2Change = nextW - currW;

            // Criteria for merging (removing the current turning point):
            // 1. Reversal is very small (< 1.2kg) AND next move is much larger
            // 2. The entire "zig-zag" is within a very short time window (e.g. 3 points in 3 days)
            // 3. To satisfy "10-20 segments max"

            const isVerySmallReversal = Math.abs(segment1Change) < threshold * 1.5;
            const isNoise = Math.abs(segment2Change) > Math.abs(segment1Change) * 1.5;
            const segmentDuration = nextIdx - prevIdx; // number of days/entries

            if ((isVerySmallReversal && isNoise) || refinedPoints.length > maxSegments + 2 || segmentDuration < 3) {
                // Skip 'i', effectively joining i-1 and i+1
                changed = true;
                // We'll skip this and the loop will handle the rest in next iteration
                i++;
                if (i < refinedPoints.length) {
                    newPoints.push(refinedPoints[i]);
                }
                continue;
            }
            newPoints.push(refinedPoints[i]);
        }

        // Ensure last point is always included
        if (newPoints[newPoints.length - 1] !== refinedPoints[refinedPoints.length - 1]) {
            newPoints.push(refinedPoints[refinedPoints.length - 1]);
        }

        if (newPoints.length === refinedPoints.length) changed = false;
        refinedPoints = newPoints;
    }

    // 3. Create Final Segments
    const finalSegments: TrendSegment[] = [];
    const stableThreshold = 0.5;

    for (let i = 0; i < refinedPoints.length - 1; i++) {
        const startIdx = refinedPoints[i];
        const endIdx = refinedPoints[i + 1];

        // We need to map back to the ORIGINAL raw indices if necessary, 
        // but since we consolidated days, we'll just map to the consolidated weights.
        // Actually, for the chart to look right with all original dots, we should map back.
        // For simplicity, let's just use the consolidated indices as representers of those days.

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

        // Map back to global indices for rawWeights/rawDates if needed.
        // But the chart uses sortedEntries which has raw date-keyed items.
        // Let's find the first and last raw index that matches these dates.
        const realStartIdx = rawDates.indexOf(dates[startIdx]);
        const realEndIdx = rawDates.lastIndexOf(dates[endIdx]);

        finalSegments.push({
            startIndex: realStartIdx,
            endIndex: realEndIdx,
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
    const [hoveredEntry, setHoveredEntry] = useState<WeightEntry | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [entries]);

    const dateRange = useMemo(() => {
        if (sortedEntries.length === 0) return { min: 0, max: 1 };
        const timestamps = sortedEntries.map(e => new Date(e.date).getTime());
        const min = Math.min(...timestamps);
        const max = Math.max(...timestamps);
        return { min, max: max === min ? min + 1 : max };
    }, [sortedEntries]);

    const getXPosition = (date: string): number => {
        const timestamp = new Date(date).getTime();
        return ((timestamp - dateRange.min) / (dateRange.max - dateRange.min)) * 100;
    };

    const xLabels = useMemo(() => {
        if (sortedEntries.length === 0) return [];
        const uniqueDates = [...new Set(sortedEntries.map(e => e.date))];
        if (uniqueDates.length <= 5) {
            return uniqueDates.map((date) => ({ label: date.slice(5), pos: getXPosition(date) }));
        }
        const step = Math.ceil(uniqueDates.length / 5);
        const labels: { label: string; pos: number }[] = [];
        for (let i = 0; i < uniqueDates.length; i += step) {
            labels.push({ label: uniqueDates[i].slice(5), pos: getXPosition(uniqueDates[i]) });
        }
        const lastDate = uniqueDates[uniqueDates.length - 1];
        if (!labels.find(l => l.pos === 100)) {
            labels.push({ label: lastDate.slice(5), pos: getXPosition(lastDate) });
        }
        return labels;
    }, [sortedEntries, dateRange]);

    // Detect ZigZag trend segments
    const trendSegments = useMemo(() => {
        if (sortedEntries.length < 2) return [];
        const weights = sortedEntries.map(e => e.weight);
        const dates = sortedEntries.map(e => e.date);
        return calculateZigZagTrends(weights, dates, 15);
    }, [sortedEntries]);

    const handleMouseEnter = (entry: WeightEntry, index: number, event: React.MouseEvent) => {
        setHoveredEntry(entry);
        setHoveredIndex(index);
        const rect = (event.target as SVGElement).closest('svg')?.getBoundingClientRect();
        if (rect) {
            setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top - 40 });
        }
    };

    const handleMouseLeave = () => {
        setHoveredEntry(null);
        setHoveredIndex(null);
        setHoverPos(null);
    };

    if (sortedEntries.length < 2) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50 min-h-[160px]">
                <span className="text-4xl mb-4">📊</span>
                <p className="text-sm text-center">Minst 2 viktmätningar behövs för trenden.</p>
                <p className="text-xs text-slate-500 mt-2">Loggade: {entries.length} mätning(ar)</p>
            </div>
        );
    }

    const weights = sortedEntries.map(d => d.weight);
    const minW = Math.min(...weights) - 0.5;
    const maxW = Math.max(...weights) + 0.5;
    const chartRange = maxW - minW || 1;

    const firstWeight = weights[0];
    const weightChange = currentWeight - firstWeight;

    const getCoords = (index: number) => {
        const entry = sortedEntries[index];
        const x = getXPosition(entry.date);
        const y = 100 - ((entry.weight - minW) / chartRange) * 100;
        return { x, y };
    };

    return (
        <div className="flex-1 flex flex-col h-full relative group">
            {/* Chart Area - Full fill */}
            <div className="flex-1 relative w-full min-h-[120px]">
                {/* Header Info - Overlay - Moved up slightly and added background to prevent overlap issues */}
                <div className="absolute -top-2 left-0 z-10 pointer-events-none p-1 rounded-lg">
                    <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-black text-white">
                            {currentWeight.toFixed(1)} <span className="text-sm text-slate-400">kg</span>
                        </div>
                        <div className={`text-sm font-bold ${weightChange > 0 ? 'text-rose-400' : weightChange < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                        <span>sedan {sortedEntries[0].date}</span>
                        {/* Trend Legend - Compact */}
                        <div className="flex gap-2 opacity-60">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ner</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Upp</span>
                        </div>
                    </div>
                </div>

                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible pt-16 pb-4">
                    {/* Grid lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" />
                    <line x1="0" y1="100" x2="100" y2="100" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />

                    {/* ZigZag trend segments */}
                    {trendSegments.map((seg, i) => {
                        const points: string[] = [];
                        for (let j = seg.startIndex; j <= seg.endIndex; j++) {
                            const { x, y } = getCoords(j);
                            points.push(`${x},${y}`);
                        }
                        const pathD = 'M ' + points.join(' L ');

                        return (
                            <path
                                key={i}
                                d={pathD}
                                fill="none"
                                stroke={TREND_COLORS[seg.trend]}
                                strokeWidth="2.5"
                                vectorEffect="non-scaling-stroke"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        );
                    })}

                    {/* Data Points - Very small, colored */}
                    {sortedEntries.map((d, i) => {
                        const { x, y } = getCoords(i);
                        const isHovered = hoveredIndex === i;

                        // Find which segment this point belongs to for coloring
                        const segment = trendSegments.find(s => i >= s.startIndex && i <= s.endIndex);
                        const color = segment ? TREND_COLORS[segment.trend] : '#64748b';

                        return (
                            <circle
                                key={`${d.date}-${i}`}
                                cx={x}
                                cy={y}
                                r={isHovered ? "1.5" : "0.5"}
                                fill={color}
                                stroke="none"
                                vectorEffect="non-scaling-stroke"
                                className="cursor-pointer transition-all"
                                onMouseEnter={(e) => handleMouseEnter(d, i, e)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => onEntryClick?.(d)}
                                style={{ pointerEvents: 'all' }}
                            />
                        );
                    })}
                </svg>

                {/* Tooltip with ZigZag trend info */}
                {hoveredEntry && hoverPos && hoveredIndex !== null && (() => {
                    const segment = trendSegments.find(s => hoveredIndex >= s.startIndex && hoveredIndex <= s.endIndex);
                    const isEndpoint = trendSegments.some(s => s.endIndex === hoveredIndex || s.startIndex === hoveredIndex);
                    const trendLabels = { loss: '🟢 Ner', gain: '🔴 Upp', stable: '🔵 Stabil' };

                    return (
                        <div
                            className="absolute bg-slate-800/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl z-50 pointer-events-none min-w-[100px]"
                            style={{ left: hoverPos.x, top: hoverPos.y, transform: 'translateX(-50%)' }}
                        >
                            <div className="text-xs font-bold text-white">{hoveredEntry.weight.toFixed(1)} kg</div>
                            <div className="text-[10px] text-slate-400">{hoveredEntry.date}</div>
                            {segment && (
                                <div className="mt-1 pt-1 border-t border-white/10">
                                    <div className="text-[9px] font-bold" style={{ color: TREND_COLORS[segment.trend] }}>
                                        {trendLabels[segment.trend]}: {(segment.endWeight - segment.startWeight).toFixed(1)} kg
                                    </div>
                                    <div className="text-[8px] text-slate-500">
                                        Trend: {sortedEntries[segment.startIndex]?.date} → {sortedEntries[segment.endIndex]?.date}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Y-axis labels - Integrated on the right side logic or keep left but better constrained */}
                <div className="absolute right-0 top-10 bottom-0 flex flex-col justify-between text-[9px] text-slate-500 font-mono py-1 pointer-events-none opacity-50">
                    <span>{maxW.toFixed(0)}</span>
                    <span>{((maxW + minW) / 2).toFixed(0)}</span>
                    <span>{minW.toFixed(0)}</span>
                </div>

                {/* X-axis labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-slate-500 font-medium pointer-events-none translate-y-full pt-1">
                    {xLabels.map((l, i) => (
                        <span key={i} style={{ position: 'absolute', left: `${l.pos}%`, transform: 'translateX(-50%)' }}>
                            {l.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
