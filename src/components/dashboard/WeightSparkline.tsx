import React, { useState } from 'react';

interface WeightSparklineProps {
    data: number[];
    dates: string[];
    color?: string;
    onPointClick?: (index: number) => void;
}

/**
 * Interactive weight trend sparkline chart.
 * Shows data points that can be hovered for details and clicked for editing.
 */
export const WeightSparkline = ({
    data,
    dates,
    color = 'text-blue-500',
    onPointClick
}: WeightSparklineProps) => {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    if (data.length < 2) {
        return (
            <div className="h-[40px] w-full flex items-center justify-center text-[8px] text-slate-300 uppercase font-bold tracking-widest bg-slate-50/50 dark:bg-slate-800/20 rounded-xl">
                Trend saknas
            </div>
        );
    }

    // Calculate range with tighter padding for "scaled up" effect
    const min = Math.min(...data);
    const max = Math.max(...data);
    const padding = (max - min) * 0.05 || 0.2;
    const adjMin = min - padding;
    const adjMax = max + padding;
    const range = adjMax - adjMin || 1;

    const width = 100;
    const heightFixed = 60;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = heightFixed - ((v - adjMin) / range) * heightFixed;
        return { x, y, value: v, index: i };
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

    // Grid lines (3 horizontal lines)
    const gridLines = [adjMin, adjMin + range / 2, adjMax].map(val => {
        const y = heightFixed - ((val - adjMin) / range) * heightFixed;
        return { y, label: val.toFixed(1) };
    });

    return (
        <div
            className="w-full h-[80px] px-1 group/sparkline relative"
            onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setHoveredIdx(null)}
        >
            <svg
                viewBox={`0 0 ${width} ${heightFixed}`}
                preserveAspectRatio="none"
                className={`w-full h-full overflow-visible ${color}`}
            >
                {/* Horizontal Grid Lines */}
                {gridLines.map((line, i) => (
                    <g key={i} className="opacity-10">
                        <line x1="0" y1={line.y} x2={width} y2={line.y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
                        <text x="-2" y={line.y} fontSize="4" className="fill-slate-400 font-bold text-right" style={{ dominantBaseline: 'middle', textAnchor: 'end' }}>{line.label}</text>
                    </g>
                ))}

                {/* The Path */}
                <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    points={polylinePoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-sm transition-all duration-500"
                />

                {/* Interactive Data Points */}
                {points.map((p, i) => (
                    <g
                        key={i}
                        className="cursor-pointer"
                        onClick={() => onPointClick?.(i)}
                        onMouseEnter={() => setHoveredIdx(i)}
                    >
                        {/* Transparent hit area */}
                        <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
                        {/* The actual dot */}
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIdx === i ? "2.5" : "1.5"}
                            className={`fill-white stroke-current stroke-[2] transition-all ${hoveredIdx === i ? 'opacity-100' : 'opacity-0 group-hover/sparkline:opacity-100'}`}
                        />
                    </g>
                ))}
            </svg>

            {/* Hover Tooltip/Card */}
            {hoveredIdx !== null && (
                <div
                    className="absolute z-50 pointer-events-none bg-slate-900/90 dark:bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 dark:border-black/5 shadow-2xl flex flex-col gap-0.5 min-w-[80px]"
                    style={{
                        left: `${(hoveredIdx / (data.length - 1)) * 100}%`,
                        top: '0',
                        transform: `translate(${hoveredIdx > data.length / 2 ? '-100%' : '20%'}, -100%)`
                    }}
                >
                    <div className="text-[10px] font-black text-white/50 dark:text-black/50 uppercase tracking-widest">{dates[hoveredIdx]}</div>
                    <div className="text-sm font-black text-white dark:text-slate-900">{data[hoveredIdx].toFixed(1)} <span className="text-[10px] text-white/60 dark:text-slate-500">kg</span></div>
                </div>
            )}
        </div>
    );
};
