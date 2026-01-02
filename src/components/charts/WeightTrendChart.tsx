import React, { useMemo, useState } from 'react';
import { WeightEntry } from '../../models/types.ts';

interface WeightTrendChartProps {
    entries: WeightEntry[];
    currentWeight: number;
    onEntryClick?: (entry: WeightEntry) => void;
}

export function WeightTrendChart({ entries, currentWeight, onEntryClick }: WeightTrendChartProps) {
    const [hoveredEntry, setHoveredEntry] = useState<WeightEntry | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [entries]);

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

    // Calculate date range for proper X positioning
    const dateRange = useMemo(() => {
        if (sortedEntries.length === 0) return { min: 0, max: 1 };
        const timestamps = sortedEntries.map(e => new Date(e.date).getTime());
        const min = Math.min(...timestamps);
        const max = Math.max(...timestamps);
        return { min, max: max === min ? min + 1 : max }; // Avoid div by zero
    }, [sortedEntries]);

    // Get X position based on date (0-100)
    const getXPosition = (date: string): number => {
        const timestamp = new Date(date).getTime();
        return ((timestamp - dateRange.min) / (dateRange.max - dateRange.min)) * 100;
    };

    // Create SVG path using date-based X positioning
    const pathPoints = sortedEntries.map((d) => {
        const x = getXPosition(d.date);
        const y = 100 - ((d.weight - minW) / chartRange) * 100;
        return `${x},${y}`;
    }).join(' L ');

    // Generate X-axis labels (more labels for better readability)
    const xLabels = useMemo(() => {
        // Get unique dates
        const uniqueDates = [...new Set(sortedEntries.map(e => e.date))];

        if (uniqueDates.length <= 5) {
            return uniqueDates.map((date) => ({
                label: date.slice(5), // MM-DD
                pos: getXPosition(date)
            }));
        }
        // Show ~5 evenly spaced labels
        const step = Math.ceil(uniqueDates.length / 5);
        const labels: { label: string; pos: number }[] = [];
        for (let i = 0; i < uniqueDates.length; i += step) {
            labels.push({
                label: uniqueDates[i].slice(5), // MM-DD
                pos: getXPosition(uniqueDates[i])
            });
        }
        // Always add last
        const lastDate = uniqueDates[uniqueDates.length - 1];
        if (!labels.find(l => l.pos === 100)) {
            labels.push({
                label: lastDate.slice(5),
                pos: getXPosition(lastDate)
            });
        }
        return labels;
    }, [sortedEntries, dateRange]);

    const handleMouseEnter = (entry: WeightEntry, event: React.MouseEvent) => {
        setHoveredEntry(entry);
        const rect = (event.target as SVGElement).closest('svg')?.getBoundingClientRect();
        if (rect) {
            setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top - 30 });
        }
    };

    const handleMouseLeave = () => {
        setHoveredEntry(null);
        setHoverPos(null);
    };

    return (
        <div className="flex-1 p-4 flex flex-col h-full">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="text-2xl font-black text-white">
                        {currentWeight.toFixed(1)} <span className="text-sm text-slate-400">kg</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-bold ${weightChange > 0 ? 'text-rose-400' : weightChange < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                        </span>
                        <span className="text-[10px] text-slate-500">
                            sedan {sortedEntries[0].date}
                        </span>
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 relative min-h-[160px] w-full">
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full overflow-visible"
                >
                    {/* Grid lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2" />
                    <line x1="0" y1="100" x2="100" y2="100" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />

                    {/* Gradient fill */}
                    <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={weightChange <= 0 ? "#10b981" : "#ef4444"} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={weightChange <= 0 ? "#10b981" : "#ef4444"} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area */}
                    <path
                        d={`M 0,100 L ${pathPoints} L 100,100 Z`}
                        fill="url(#weightGradient)"
                    />

                    {/* Line */}
                    <path
                        d={`M ${pathPoints}`}
                        fill="none"
                        stroke={weightChange <= 0 ? "#10b981" : "#ef4444"}
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Data Points with hover/click */}
                    {sortedEntries.map((d, i) => {
                        const x = getXPosition(d.date);
                        const y = 100 - ((d.weight - minW) / chartRange) * 100;
                        const isHovered = hoveredEntry?.date === d.date && hoveredEntry?.weight === d.weight;

                        return (
                            <circle
                                key={`${d.date}-${i}`}
                                cx={x}
                                cy={y}
                                r={isHovered ? "2" : "1"}
                                fill={isHovered ? (weightChange <= 0 ? "#10b981" : "#ef4444") : "white"}
                                stroke={weightChange <= 0 ? "#10b981" : "#ef4444"}
                                strokeWidth={isHovered ? "1" : "0.5"}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-pointer transition-all"
                                onMouseEnter={(e) => handleMouseEnter(d, e)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => onEntryClick?.(d)}
                                style={{ pointerEvents: 'all' }}
                            />
                        );
                    })}
                </svg>

                {/* Tooltip on Hover */}
                {hoveredEntry && hoverPos && (
                    <div
                        className="absolute bg-slate-800 border border-white/10 rounded-lg px-3 py-2 shadow-xl z-50 pointer-events-none"
                        style={{ left: hoverPos.x, top: hoverPos.y, transform: 'translateX(-50%)' }}
                    >
                        <div className="text-xs font-bold text-white">{hoveredEntry.weight.toFixed(1)} kg</div>
                        <div className="text-[10px] text-slate-400">{hoveredEntry.date}</div>
                        {onEntryClick && <div className="text-[9px] text-emerald-400 mt-1">Klicka för detaljer</div>}
                    </div>
                )}

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 -ml-6 flex flex-col justify-between text-[9px] text-slate-500 font-mono py-1 h-full pointer-events-none">
                    <span>{maxW.toFixed(0)}</span>
                    <span>{((maxW + minW) / 2).toFixed(0)}</span>
                    <span>{minW.toFixed(0)}</span>
                </div>

                {/* X-axis labels (multiple) */}
                <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[9px] text-slate-500 font-medium pointer-events-none">
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
