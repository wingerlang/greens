import React from 'react';
import { SimulationResult, SimulationStep } from './DuoLabLogic.ts';

interface Props {
    simulation: SimulationResult;
}

export function RaceFlowChart({ simulation }: Props) {
    const { trace, totalTime } = simulation;

    // Helper to get color
    const getColor = (assignedTo: string) => {
        switch (assignedTo) {
            case 'ME': return 'bg-cyan-500';
            case 'PARTNER': return 'bg-rose-500';
            case 'BOTH': return 'bg-purple-500'; // Mixed
            case 'SPLIT': return 'bg-emerald-500'; // Efficient split
            default: return 'bg-slate-700';
        }
    };

    return (
        <div className="space-y-4 select-none">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest text-center">Race Simulation Flow</h4>

            <div className="relative h-20 w-full bg-slate-900 rounded-xl overflow-hidden flex border border-white/5">
                {/* TIMELINE BARS */}
                {trace.map((step, i) => {
                    const duration = step.endTime - step.startTime;
                    const widthPct = (duration / totalTime) * 100;

                    return (
                        <div
                            key={i}
                            className={`h-full ${getColor(step.assignedTo)} relative group hover:brightness-110 transition-all`}
                            style={{ width: `${widthPct}%` }}
                        >
                            {/* HOVER TOOLTIP */}
                            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/90 text-white text-[10px] p-2 rounded whitespace-nowrap pointer-events-none z-10 border border-white/10">
                                <div className="font-bold uppercase">{step.stationId}</div>
                                <div>{(duration / 60).toFixed(1)} mins</div>
                                <div className="text-slate-400">{step.assignedTo}</div>
                            </div>
                        </div>
                    );
                })}

                {/* ENERGY OVERLAY LINE (Approximate) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                    <polyline
                        points={trace.map(s => {
                            const x = (s.endTime / totalTime) * 100;
                            const y = 100 - s.energyLevel; // Invert so 100 is top
                            return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="white"
                        strokeWidth="1"
                        strokeOpacity="0.5"
                        strokeDasharray="4 2"
                    />
                </svg>
            </div>

            {/* LEGEND */}
            <div className="flex justify-center gap-4 text-[10px] font-bold uppercase text-slate-500">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-cyan-500 rounded-full"></div> You</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-full"></div> Partner</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-500 rounded-full"></div> Both (Run)</div>
            </div>
        </div>
    );
}
