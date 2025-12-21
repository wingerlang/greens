import React from 'react';

function addToWeek(map: any, d: Date, val: number, startDate: Date) {
    const diffTime = d.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7);

    if (!map[weekNum]) {
        const stableDate = new Date(startDate.getTime() + (weekNum * 7 * 24 * 60 * 60 * 1000));
        map[weekNum] = { sum: 0, count: 0, date: stableDate.toISOString() };
    }
    map[weekNum].sum += val;
    map[weekNum].count++;
}

export function CycleYearChart({
    cycles,
    weightEntries,
    nutrition,
    exercises,
    zoomMonths,
    visibleMetrics,
    onEditCycle,
    onCreateCycleAfter
}: {
    cycles: any[],
    weightEntries: any[],
    nutrition: any[],
    exercises: any[],
    zoomMonths: number,
    visibleMetrics: { calories: boolean, volume: boolean, workouts: boolean },
    onEditCycle?: (cycle: any) => void,
    onCreateCycleAfter?: (cycle: any) => void
}) {
    const [hoveredCycle, setHoveredCycle] = React.useState<any | null>(null);
    const [tooltipPos, setTooltipPos] = React.useState<{ x: number, y: number } | null>(null);

    // 1. Calculate Time Range (+- zoomMonths)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - zoomMonths);
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + zoomMonths);

    const getX = (dateStr: string | Date) => {
        const d = new Date(dateStr);
        const totalMs = endDate.getTime() - startDate.getTime();
        const currentMs = d.getTime() - startDate.getTime();
        return (currentMs / totalMs) * 100;
    };

    // 2. Weight Min/Max for scaling
    // Filter weights within the visual range for scaling calculation, but maybe allow a buffer?
    const visibleWeights = weightEntries.filter(w => {
        const d = new Date(w.date);
        return d >= startDate && d <= endDate;
    });

    // Fallback if no specific weights in range, use generic 70-90 or nearby
    const weights = visibleWeights.map(w => w.weight);
    const minWeight = weights.length ? Math.min(...weights) - 2 : 70;
    const maxWeight = weights.length ? Math.max(...weights) + 2 : 90;

    const getY = (weight: number) => {
        return 100 - ((weight - minWeight) / (maxWeight - minWeight)) * 100;
    };

    const sortedWeights = [...weightEntries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter(w => {
            const d = new Date(w.date);
            return d >= startDate && d <= endDate;
        });

    const weightPath = sortedWeights.map((w, i) => {
        const x = getX(w.date);
        const y = getY(w.weight);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Background Zones for Cycles (rendered first) */}
            {cycles.map(cycle => {
                const startX = Math.max(0, getX(cycle.startDate));
                const endX = cycle.endDate ? Math.min(100, getX(cycle.endDate)) : 100; // If no end date, assume infinity -> 100

                // If cycle is completely out of view?
                if (endX < 0 || startX > 100) return null;

                const width = Math.max(0.5, endX - startX);

                let color = 'rgba(59, 130, 246, 0.1)'; // Neutral (Blue)
                if (cycle.goal === 'deff') color = 'rgba(244, 63, 94, 0.1)'; // Cut (Rose)
                if (cycle.goal === 'bulk') color = 'rgba(16, 185, 129, 0.1)'; // Bulk (Emerald)

                return (
                    <g key={cycle.id}>
                        <rect
                            x={startX}
                            y="0"
                            width={width}
                            height="100"
                            fill={color}
                            className="cursor-pointer transition-all hover:opacity-80"
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                setHoveredCycle(cycle);
                            }}
                            onMouseLeave={() => setHoveredCycle(null)}
                            onClick={() => onEditCycle?.(cycle)}
                        />
                        {/* Always visible label if wide enough */}
                        {width > 10 && (
                            <text
                                x={startX + 1}
                                y="8"
                                fontSize="2.5"
                                fill="rgba(255,255,255,0.4)"
                                fontWeight="bold"
                                style={{ pointerEvents: 'none' }}
                            >
                                {cycle.name}
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Tooltip Portal/ForeignObject */}
            {hoveredCycle && tooltipPos && (
                <foreignObject x="0" y="0" width="100" height="100" style={{ pointerEvents: 'none', overflow: 'visible' }}>
                    <div
                        style={{
                            position: 'fixed',
                            left: tooltipPos.x,
                            top: tooltipPos.y,
                            transform: 'translate(-50%, -110%)',
                            zIndex: 50,
                            pointerEvents: 'auto' // Re-enable pointer events for buttons
                        }}
                        className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-4 w-64 backdrop-blur-md"
                        onMouseEnter={() => {/* Keep open */ }}
                        onMouseLeave={() => setHoveredCycle(null)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-white text-sm">{hoveredCycle.name}</h4>
                                <div className="text-[10px] text-slate-400 capitalize">{hoveredCycle.goal} • {hoveredCycle.startDate.split('T')[0]}</div>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${hoveredCycle.goal === 'deff' ? 'bg-rose-500' :
                                hoveredCycle.goal === 'bulk' ? 'bg-emerald-500' : 'bg-blue-500'
                                }`} />
                        </div>

                        {/* Mini Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-white/5 rounded p-2">
                                <span className="block text-[9px] text-slate-500 uppercase">Träning</span>
                                <span className="block text-xs font-bold text-white">
                                    {exercises.filter(e => {
                                        const d = new Date(e.date);
                                        const start = new Date(hoveredCycle.startDate);
                                        const end = hoveredCycle.endDate ? new Date(hoveredCycle.endDate) : new Date();
                                        return d >= start && d <= end;
                                    }).length} pass
                                </span>
                            </div>
                            <div className="bg-white/5 rounded p-2">
                                <span className="block text-[9px] text-slate-500 uppercase">Volym</span>
                                <span className="block text-xs font-bold text-white">
                                    {(exercises.filter(e => {
                                        const d = new Date(e.date);
                                        const start = new Date(hoveredCycle.startDate);
                                        const end = hoveredCycle.endDate ? new Date(hoveredCycle.endDate) : new Date();
                                        return d >= start && d <= end;
                                    }).reduce((acc, e) => acc + (e.tonnage || 0), 0) / 1000).toFixed(1)} ton
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold py-1.5 rounded transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditCycle?.(hoveredCycle);
                                }}
                            >
                                Redigera
                            </button>
                            <button
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold py-1.5 rounded transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateCycleAfter?.(hoveredCycle);
                                }}
                            >
                                + Nästa
                            </button>
                        </div>
                    </div>
                </foreignObject>
            )}

            {/* Today Line */}
            <line x1={getX(today)} y1="0" x2={getX(today)} y2="100" stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="4 4" strokeWidth="0.5" />

            {/* Data Bars (Weekly Averages/Sums) in Layers */}
            {(() => {
                const weeklyData: Record<number, {
                    date: string,
                    calories: number,
                    volume: number,
                    workouts: number,
                    days: number
                }> = {};

                const getWeekNum = (d: Date) => {
                    const diffTime = d.getTime() - startDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    return Math.floor(diffDays / 7);
                };

                const ensureWeek = (w: number, d: Date) => {
                    if (!weeklyData[w]) {
                        const stableDate = new Date(startDate.getTime() + (w * 7 * 24 * 60 * 60 * 1000));
                        weeklyData[w] = { date: stableDate.toISOString(), calories: 0, volume: 0, workouts: 0, days: 0 };
                    }
                };

                // 1. Calories
                if (visibleMetrics.calories) {
                    nutrition.forEach(n => {
                        const d = new Date(n.date);
                        if (d < startDate || d > endDate) return;
                        const w = getWeekNum(d);
                        ensureWeek(w, d);
                        weeklyData[w].calories += n.calories;
                        weeklyData[w].days++; // Rough average logic
                    });
                }
                // 2. Volume & Workouts
                if (visibleMetrics.volume || visibleMetrics.workouts) {
                    exercises.forEach(e => {
                        const d = new Date(e.date);
                        if (d < startDate || d > endDate) return;
                        const w = getWeekNum(d);
                        ensureWeek(w, d); // Ensure week exists even if no nutrition
                        if (visibleMetrics.volume) weeklyData[w].volume += (e.tonnage || 0);
                        if (visibleMetrics.workouts) weeklyData[w].workouts += 1;
                    });
                }

                // 3. Calculate Max Values for dynamic scaling
                const maxKcal = Math.max(4000, ...Object.values(weeklyData).map(d => d.calories > 0 ? (d.calories / (d.days || 1)) : 0));
                const maxVol = Math.max(20000, ...Object.values(weeklyData).map(d => d.volume));
                const maxWorkouts = Math.max(7, ...Object.values(weeklyData).map(d => d.workouts));

                // 4. Render Grid & Labels
                const RenderAxis = () => (
                    <g>
                        {/* Top Line (100%) */}
                        <line x1="0" y1="60" x2="100" y2="60" stroke="rgba(255,255,255,0.1)" strokeWidth="0.2" strokeDasharray="1 1" />

                        {/* Labels - High Visibility */}
                        {visibleMetrics.calories && (
                            <text x="0.5" y="58" fill="#e2e8f0" fontSize="3" fontWeight="900" style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.8)' }}>
                                {Math.round(maxKcal)} kcal
                            </text>
                        )}
                        {visibleMetrics.volume && (
                            <text x="30" y="58" fill="#fb7185" fontSize="3" fontWeight="900" style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.8)' }}>
                                {Math.round(maxVol / 1000)} ton
                            </text>
                        )}
                        {visibleMetrics.workouts && (
                            <text x="60" y="58" fill="#34d399" fontSize="3" fontWeight="900" style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.8)' }}>
                                {maxWorkouts} pass
                            </text>
                        )}
                    </g>
                );

                return (
                    <>
                        <RenderAxis />
                        {Object.values(weeklyData).map((data, i) => {
                            const x = getX(data.date);
                            if (x < 0 || x > 100) return null;

                            const avgKcal = data.days > 0 ? data.calories / data.days : 0;

                            return (
                                <g key={i}>
                                    {/* Calories - Wide Background Bar */}
                                    {visibleMetrics.calories && data.days > 0 && (
                                        <rect
                                            x={x - 0.8}
                                            y={100 - Math.min(40, (avgKcal / maxKcal) * 40)}
                                            width={1.6}
                                            height={Math.min(40, (avgKcal / maxKcal) * 40)}
                                            fill="rgba(255, 255, 255, 0.1)"
                                            rx="0.2"
                                        />
                                    )}

                                    {/* Volume - Thin Colored Bar */}
                                    {visibleMetrics.volume && data.volume > 0 && (
                                        <rect
                                            x={x - 0.2}
                                            y={100 - Math.min(50, (data.volume / maxVol) * 50)}
                                            width={0.4}
                                            height={Math.min(50, (data.volume / maxVol) * 50)}
                                            fill="rgba(244, 63, 94, 0.8)"
                                            rx="0.2"
                                        />
                                    )}

                                    {/* Workouts - Dots/Markers */}
                                    {visibleMetrics.workouts && data.workouts > 0 && (
                                        <circle
                                            cx={x}
                                            cy={100 - Math.min(40, (data.workouts / maxWorkouts) * 40)}
                                            r={0.8}
                                            fill="rgba(16, 185, 129, 0.9)"
                                        />
                                    )}
                                </g>
                            );
                        })}
                    </>
                );
            })()}

            {/* Grid Lines (Months) - Adjusted for Zoom Level */}
            {Array.from({ length: zoomMonths * 2 + 1 }).map((_, i) => {
                const d = new Date(startDate);
                d.setMonth(d.getMonth() + i);
                const x = getX(d.toISOString().split('T')[0]);
                // Only show if x is within bounds (0-100)
                if (x < 0 || x > 100) return null;

                return (
                    <g key={i}>
                        <line x1={x} y1="0" x2={x} y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.2" />
                        <text x={x + 1} y="95" fontSize="2" fill="rgba(255,255,255,0.3)">{d.toLocaleDateString('sv-SE', { month: 'short' })}</text>
                    </g>
                );
            })}

            {/* Weight Line */}
            <path
                d={weightPath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="0.5"
            />
            {/* Last Weight Dot */}
            {sortedWeights.length > 0 && (() => {
                const last = sortedWeights[sortedWeights.length - 1];
                const x = getX(last.date);
                const y = getY(last.weight);
                if (x >= 0 && x <= 100) {
                    return <circle cx={x} cy={y} r="1" fill="white" />;
                }
                return null;
            })()}
        </svg>
    );
}
