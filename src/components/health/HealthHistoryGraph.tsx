import React, { useState, useMemo } from 'react';

export interface GraphSnapshot {
    date: string;
    weight?: number;
    waist?: number;
    chest?: number;
    vitals?: {
        sleep?: number;
    };
}

interface HealthHistoryGraphProps {
    snapshots: GraphSnapshot[];
    days: number;
    height?: string;
    showSleep?: boolean;
    primaryMetric: 'weight' | 'sleep';
    themeColor?: string;
}

export function HealthHistoryGraph({
    snapshots,
    days,
    height = 'h-[400px] md:h-[600px]',
    showSleep = false,
    primaryMetric = 'weight',
    themeColor = '#f43f5e'
}: HealthHistoryGraphProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const isWeight = primaryMetric === 'weight';
    const isSleep = primaryMetric === 'sleep';

    // Advanced Graph Calculations (Simplified from MetricFocusView)
    const graphMeta = useMemo(() => {
        const validPoints = snapshots.map((s, i) => {
            let val = 0;
            if (isWeight) val = s.weight || 0;
            else if (isSleep) val = s.vitals?.sleep || 0;
            return { val, date: s.date, i };
        }).filter(p => p.val !== undefined && p.val > 0) as { val: number, date: string, i: number }[];

        const cmValues: number[] = [];
        snapshots.forEach(s => {
            if (s.waist) cmValues.push(s.waist);
            if (s.chest) cmValues.push(s.chest);
        });

        if (validPoints.length === 0 && cmValues.length === 0) {
            return { min: 0, max: 10, range: 10, points: [], trendPoints: [], cmMin: 0, cmMax: 10, cmRange: 10 };
        }

        // Left Axis (KG or Sleep Hours)
        let min = validPoints.length > 0 ? Math.min(...validPoints.map(p => p.val)) : 70;
        let max = validPoints.length > 0 ? Math.max(...validPoints.map(p => p.val)) : 80;
        const padding = (max - min) * 0.2 || 2;
        min = Math.floor(min - padding);
        max = Math.ceil(max + padding);
        if (isSleep) {
            min = Math.max(0, min);
            max = Math.max(12, max);
        }
        const range = max - min;

        // Right Axis (CM)
        let cmMin = cmValues.length > 0 ? Math.min(...cmValues) : 70;
        let cmMax = cmValues.length > 0 ? Math.max(...cmValues) : 110;
        const cmPadding = (cmMax - cmMin) * 0.2 || 5;
        cmMin = Math.floor(cmMin - cmPadding);
        cmMax = Math.ceil(cmMax + cmPadding);
        const cmRange = cmMax - cmMin;

        // Calculate Trend Line (Moving Average - 7 points)
        const trendPoints = snapshots.map((s, i) => {
            if (!isWeight) return null;
            const windowSize = 7;
            const pastWeights = snapshots
                .slice(Math.max(0, i - windowSize + 1), i + 1)
                .filter(snap => snap.weight !== undefined)
                .map(snap => snap.weight!);
            if (pastWeights.length === 0) return null;
            const avg = pastWeights.reduce((a, b) => a + b, 0) / pastWeights.length;
            return { val: avg, i };
        }).filter(p => p !== null) as { val: number, i: number }[];

        return {
            min, max, range,
            cmMin, cmMax, cmRange,
            points: validPoints,
            trendPoints
        };
    }, [snapshots, isWeight, isSleep]);

    const getY = (val: number) => 100 - ((val - graphMeta.min) / graphMeta.range) * 100;
    const getYCm = (val: number) => 100 - ((val - graphMeta.cmMin) / graphMeta.cmRange) * 100;
    const getX = (index: number) => (index / (snapshots.length - 1)) * 100;

    return (
        <div className="relative w-full">
            <div className={`${height} w-full relative flex gap-6`}>
                {/* Y-Axis Labels (Left - KG/Sleep) */}
                <div className="absolute -left-10 top-0 bottom-0 w-8 flex flex-col items-end text-[10px] text-slate-500 font-bold pointer-events-none">
                    <span className="absolute top-0 transform -translate-y-1/2">{graphMeta.max}</span>
                    <span className="absolute top-1/2 transform -translate-y-1/2">{Math.round(graphMeta.min + graphMeta.range / 2)}</span>
                    <span className="absolute bottom-0 transform translate-y-1/2">{graphMeta.min}</span>
                </div>

                {/* Y-Axis Labels (Right - CM) */}
                {isWeight && (
                    <div className="absolute -right-10 top-0 bottom-0 w-8 flex flex-col items-start text-[10px] text-slate-500 font-bold pointer-events-none">
                        <span className="absolute top-0 transform -translate-y-1/2">{graphMeta.cmMax}</span>
                        <span className="absolute top-1/2 transform -translate-y-1/2">{Math.round(graphMeta.cmMin + graphMeta.cmRange / 2)}</span>
                        <span className="absolute bottom-0 transform translate-y-1/2">{graphMeta.cmMin}</span>
                        <span className="absolute -top-6 left-0 text-[8px] font-black uppercase text-slate-600">CM</span>
                    </div>
                )}
                {isWeight && <div className="absolute -left-10 -top-6 text-[8px] font-black uppercase text-slate-600">KG</div>}

                {/* SVG Graph */}
                <svg
                    className="w-full h-full z-10 overflow-visible"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoverIndex(null)}
                >
                    {/* Grid Lines */}
                    <line x1="0" y1="0%" x2="100%" y2="0%" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="100%" x2="100%" y2="100%" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                    {/* Secondary Metrics (Waist/Chest) */}
                    {isWeight && (
                        <>
                            {/* Chest (Indigo) */}
                            {snapshots.filter(s => s.chest).length > 1 && (
                                <path
                                    d={`M ${snapshots.map((s, i) => s.chest ? `${getX(i)} ${getYCm(s.chest)}` : null).filter(p => p).join(' L ')}`}
                                    fill="none"
                                    stroke="#6366f1"
                                    strokeWidth="2"
                                    strokeOpacity="0.4"
                                    strokeLinecap="round"
                                />
                            )}
                            {/* Waist (Emerald) */}
                            {snapshots.filter(s => s.waist).length > 1 && (
                                <path
                                    d={`M ${snapshots.map((s, i) => s.waist ? `${getX(i)} ${getYCm(s.waist)}` : null).filter(p => p).join(' L ')}`}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    strokeOpacity="0.6"
                                    strokeLinecap="round"
                                />
                            )}
                        </>
                    )}

                    {/* Primary Data */}
                    {isWeight ? (
                        <>
                            {/* Trend Line (Solid) */}
                            {graphMeta.trendPoints.length > 1 && (
                                <path
                                    d={`M ${graphMeta.trendPoints.map(p => `${getX(p.i)} ${getY(p.val)}`).join(' L ')}`}
                                    fill="none"
                                    stroke={themeColor}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="drop-shadow-lg opacity-90"
                                />
                            )}
                            {/* Raw Data Line (Dashed) */}
                            {graphMeta.points.length > 1 && (
                                <path
                                    d={`M ${graphMeta.points.map(p => `${getX(p.i)} ${getY(p.val)}`).join(' L ')}`}
                                    fill="none"
                                    stroke={themeColor}
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                    strokeOpacity="0.5"
                                    strokeLinecap="round"
                                />
                            )}
                            {/* Dots */}
                            {graphMeta.points.map((p, idx) => (
                                <circle key={idx} cx={`${getX(p.i)}%`} cy={`${getY(p.val)}%`} r="3" fill="#1e293b" stroke={themeColor} strokeWidth="2" />
                            ))}
                        </>
                    ) : (
                        // Sleep Bars
                        snapshots.map((s, i) => {
                            const val = s.vitals?.sleep || 0;
                            if (val === 0) return null;
                            return (
                                <rect
                                    key={i}
                                    x={`${getX(i) - (40 / snapshots.length)}%`}
                                    y={`${getY(val)}%`}
                                    width={`${80 / snapshots.length}%`}
                                    height={`${100 - getY(val)}%`}
                                    fill={val >= 8 ? themeColor : 'rgba(14,165,233,0.4)'}
                                    rx="2"
                                />
                            );
                        })
                    )}

                    {/* Tooltip Vertical Line */}
                    {hoverIndex !== null && (
                        <line x1={`${getX(hoverIndex)}%`} y1="0" x2={`${getX(hoverIndex)}%`} y2="100%" stroke="white" strokeOpacity="0.1" />
                    )}

                    {/* Hit areas */}
                    {snapshots.map((s, i) => (
                        <rect
                            key={i}
                            x={`${getX(i) - (50 / snapshots.length)}%`}
                            y="0"
                            width={`${100 / snapshots.length}%`}
                            height="100%"
                            fill="transparent"
                            onMouseEnter={() => setHoverIndex(i)}
                            className="cursor-crosshair hover:bg-white/5 transition-colors"
                        />
                    ))}
                </svg>

                {/* Tooltip */}
                {hoverIndex !== null && snapshots[hoverIndex] && (
                    <div
                        className="absolute pointer-events-none z-50 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl flex flex-col gap-1 min-w-[140px]"
                        style={{
                            left: `${getX(hoverIndex)}%`,
                            top: '10%',
                            transform: `translate(${hoverIndex > snapshots.length / 2 ? '-110%' : '10%'}, 0)`
                        }}
                    >
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-white/5 pb-1 mb-1">{snapshots[hoverIndex].date}</span>

                        {isWeight && (
                            <>
                                {snapshots[hoverIndex].weight && (
                                    <div className="flex justify-between items-baseline gap-4">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Vikt</span>
                                        <span className="text-sm font-black text-white">{snapshots[hoverIndex].weight} <span className="text-[9px] opacity-40">kg</span></span>
                                    </div>
                                )}
                                {snapshots[hoverIndex].waist && (
                                    <div className="flex justify-between items-baseline gap-4">
                                        <span className="text-[10px] font-bold text-emerald-500 uppercase">Midja</span>
                                        <span className="text-sm font-black text-emerald-400">{snapshots[hoverIndex].waist} <span className="text-[9px] opacity-40">cm</span></span>
                                    </div>
                                )}
                                {snapshots[hoverIndex].chest && (
                                    <div className="flex justify-between items-baseline gap-4">
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase">Bröst</span>
                                        <span className="text-sm font-black text-indigo-400">{snapshots[hoverIndex].chest} <span className="text-[9px] opacity-40">cm</span></span>
                                    </div>
                                )}
                                <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-white/5 flex justify-between">
                                    <span>Trend</span>
                                    <span className="text-white font-bold">{graphMeta.trendPoints.find(p => p.i === hoverIndex)?.val.toFixed(1) || '--'} kg</span>
                                </div>
                            </>
                        )}

                        {isSleep && (
                            <div className="flex justify-between items-baseline gap-4">
                                <span className="text-[10px] font-bold text-sky-500 uppercase">Sömn</span>
                                <span className="text-sm font-black text-white">{snapshots[hoverIndex].vitals?.sleep || 0} <span className="text-[9px] opacity-40">h</span></span>
                            </div>
                        )}
                    </div>
                )}

                {/* X-Axis Labels */}
                <div className="absolute w-full -bottom-6 h-6 flex font-bold text-[10px] text-slate-500">
                    {snapshots.map((s, i) => {
                        const isLast = i === snapshots.length - 1;
                        const isFirst = i === 0;
                        const isMiddle = i === Math.floor(snapshots.length / 2);
                        const show = isFirst || isLast || isMiddle;

                        if (!show) return null;

                        return (
                            <div
                                key={i}
                                className="absolute transform -translate-x-1/2 whitespace-nowrap"
                                style={{ left: `${getX(i)}%` }}
                            >
                                {s.date.slice(5)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
