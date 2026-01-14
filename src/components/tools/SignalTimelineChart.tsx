import React from 'react';
import { SignalCategory } from '../../utils/interferenceEngine.ts';

interface SignalPoint {
    time: number; // 0-24 hours
    label: string;
    signal: SignalCategory;
    source: 'HISTORY' | 'PLAN';
}

interface Props {
    activities: SignalPoint[];
    showOptimalWindow?: boolean;
}

/**
 * SignalTimelineChart - Visual representation of mTOR/AMPK signals over 24 hours
 * 
 * Shows:
 * - Activity markers at their time position
 * - Signal decay curves (mTOR ~6h, AMPK ~3-6h)
 * - Interference zones when signals overlap
 */
export function SignalTimelineChart({ activities, showOptimalWindow = true }: Props) {
    // Constants for signal decay (hours)
    const MTOR_WINDOW = 6; // Protein synthesis peak window
    const AMPK_WINDOW = 4; // AMPK interference window

    // Sort activities by time
    const sorted = [...activities].sort((a, b) => a.time - b.time);

    // Calculate interference zones
    const getInterferenceZones = () => {
        const zones: { start: number; end: number; type: 'interference' | 'suboptimal' }[] = [];

        const mtorActs = sorted.filter(a => a.signal === 'MTOR');
        const ampkActs = sorted.filter(a => a.signal === 'AMPK_HIGH' || a.signal === 'HYBRID');

        mtorActs.forEach(mtor => {
            ampkActs.forEach(ampk => {
                const gap = Math.abs(ampk.time - mtor.time);
                if (gap < MTOR_WINDOW) {
                    // Interference detected
                    zones.push({
                        start: Math.min(mtor.time, ampk.time),
                        end: Math.max(mtor.time, ampk.time),
                        type: gap < 3 ? 'interference' : 'suboptimal'
                    });
                }
            });
        });

        return zones;
    };

    const interferenceZones = getInterferenceZones();

    // Get color for signal type
    const getSignalColor = (signal: SignalCategory) => {
        switch (signal) {
            case 'MTOR': return 'bg-emerald-500';
            case 'AMPK_HIGH': return 'bg-rose-500';
            case 'AMPK_LOW': return 'bg-sky-400';
            case 'HYBRID': return 'bg-purple-500';
            default: return 'bg-slate-400';
        }
    };

    const getSignalLabel = (signal: SignalCategory) => {
        switch (signal) {
            case 'MTOR': return 'Styrka';
            case 'AMPK_HIGH': return 'Kondition';
            case 'AMPK_LOW': return 'Lätt';
            case 'HYBRID': return 'Hyrox';
            default: return '';
        }
    };

    // Time markers for the axis
    const timeMarkers = [0, 6, 12, 18, 24];

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Signaltidslinje (24h)
            </h3>

            {/* Chart Container */}
            <div className="relative h-32">
                {/* Background gradient zones */}
                <div className="absolute inset-0 flex">
                    <div className="flex-1 bg-gradient-to-t from-slate-100/50 to-transparent dark:from-slate-700/20 rounded-l-lg" />
                    <div className="flex-1 bg-gradient-to-t from-slate-100/50 to-transparent dark:from-slate-700/20" />
                    <div className="flex-1 bg-gradient-to-t from-slate-100/50 to-transparent dark:from-slate-700/20" />
                    <div className="flex-1 bg-gradient-to-t from-slate-100/50 to-transparent dark:from-slate-700/20 rounded-r-lg" />
                </div>

                {/* Interference zones */}
                {interferenceZones.map((zone, i) => (
                    <div
                        key={i}
                        className={`absolute top-0 bottom-8 ${zone.type === 'interference'
                                ? 'bg-red-500/20 border-l-2 border-r-2 border-red-400'
                                : 'bg-amber-500/10 border-l border-r border-amber-300'
                            }`}
                        style={{
                            left: `${(zone.start / 24) * 100}%`,
                            width: `${((zone.end - zone.start) / 24) * 100}%`
                        }}
                    >
                        <div className={`absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase px-1 rounded ${zone.type === 'interference' ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
                            }`}>
                            {zone.type === 'interference' ? '⚠ Konflikt' : 'Suboptimal'}
                        </div>
                    </div>
                ))}

                {/* mTOR signal decay curves */}
                {sorted.filter(a => a.signal === 'MTOR').map((act, i) => (
                    <div
                        key={`mtor-${i}`}
                        className="absolute h-16 opacity-30"
                        style={{
                            left: `${(act.time / 24) * 100}%`,
                            width: `${(MTOR_WINDOW / 24) * 100}%`,
                            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.6) 0%, rgba(16, 185, 129, 0) 100%)',
                            top: '10%'
                        }}
                    />
                ))}

                {/* Activity markers */}
                {sorted.map((act, i) => (
                    <div
                        key={i}
                        className="absolute flex flex-col items-center group"
                        style={{ left: `${(act.time / 24) * 100}%`, transform: 'translateX(-50%)' }}
                    >
                        {/* Marker */}
                        <div className={`w-4 h-4 rounded-full ${getSignalColor(act.signal)} ring-2 ring-white dark:ring-slate-900 shadow-lg ${act.source === 'PLAN' ? 'ring-dashed opacity-70' : ''
                            }`} />

                        {/* Label */}
                        <div className="mt-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {act.label}
                        </div>

                        {/* Tooltip */}
                        <div className="absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {getSignalLabel(act.signal)} @ {act.time}:00
                            {act.source === 'PLAN' && ' (Planerad)'}
                        </div>
                    </div>
                ))}

                {/* Timeline axis */}
                <div className="absolute bottom-0 left-0 right-0 h-6 flex justify-between items-end border-t border-slate-200 dark:border-slate-700">
                    {timeMarkers.map(hour => (
                        <div key={hour} className="flex flex-col items-center">
                            <div className="w-px h-2 bg-slate-300 dark:bg-slate-600" />
                            <span className="text-[10px] text-slate-400 font-mono mt-1">{hour.toString().padStart(2, '0')}:00</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-400">mTOR (Styrka)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <span className="text-slate-600 dark:text-slate-400">AMPK Hög (Kondition)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-sky-400" />
                    <span className="text-slate-600 dark:text-slate-400">AMPK Låg (Återhämtning)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-slate-600 dark:text-slate-400">Hybrid (Hyrox)</span>
                </div>
            </div>
        </div>
    );
}
