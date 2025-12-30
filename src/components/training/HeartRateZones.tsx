/**
 * Heart Rate Zones Component
 * Visualizes time spent in different HR zones for running activities.
 */
import React, { useMemo } from 'react';

export interface HeartRateZonesProps {
    avgHeartRate: number;
    maxHeartRate?: number;  // User's max HR (defaults to 220 - age estimate)
    duration?: number;      // Activity duration in seconds
    age?: number;           // User age for HR zone calculation
}

// HR Zone definitions (% of max HR)
const ZONES = [
    { name: 'Z1', label: 'Återhämtning', minPct: 50, maxPct: 60, color: '#6b7280' },      // gray
    { name: 'Z2', label: 'Aerob bas', minPct: 60, maxPct: 70, color: '#22c55e' },         // green
    { name: 'Z3', label: 'Aerob uthållighet', minPct: 70, maxPct: 80, color: '#eab308' }, // yellow
    { name: 'Z4', label: 'Tröskel', minPct: 80, maxPct: 90, color: '#f97316' },           // orange
    { name: 'Z5', label: 'VO2 Max', minPct: 90, maxPct: 100, color: '#ef4444' },          // red
];

export function HeartRateZones({ avgHeartRate, maxHeartRate, duration, age = 30 }: HeartRateZonesProps) {
    // Calculate max HR if not provided (220 - age formula)
    const calculatedMaxHR = maxHeartRate || (220 - age);

    // Determine which zone the average HR falls into
    const zoneInfo = useMemo(() => {
        const hrPct = (avgHeartRate / calculatedMaxHR) * 100;

        for (const zone of ZONES) {
            if (hrPct >= zone.minPct && hrPct < zone.maxPct) {
                return { zone, hrPct };
            }
        }

        // If above Z5 max
        if (hrPct >= 100) {
            return { zone: ZONES[4], hrPct };
        }

        // If below Z1 min
        return { zone: ZONES[0], hrPct };
    }, [avgHeartRate, calculatedMaxHR]);

    // Format duration
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">❤️</span>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pulszon</h3>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-black" style={{ color: zoneInfo.zone.color }}>
                        {avgHeartRate}
                    </span>
                    <span className="text-sm text-slate-500 ml-1">bpm</span>
                </div>
            </div>

            {/* Zone Bar Visualization */}
            <div className="relative h-8 bg-slate-800 rounded-lg overflow-hidden flex">
                {ZONES.map((zone, idx) => {
                    const width = zone.maxPct - zone.minPct; // 10% each
                    const isActive = zone.name === zoneInfo.zone.name;
                    return (
                        <div
                            key={zone.name}
                            className={`relative transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`}
                            style={{
                                width: `${width}%`,
                                backgroundColor: zone.color,
                            }}
                        >
                            {isActive && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-black text-white drop-shadow-lg">
                                        {zone.name}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Current Position Marker */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
                    style={{
                        left: `${Math.min(100, Math.max(0, zoneInfo.hrPct - 50))}%`,
                        boxShadow: '0 0 10px rgba(255,255,255,0.8)'
                    }}
                />
            </div>

            {/* Zone Details */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-bold text-white">{zoneInfo.zone.label}</p>
                    <p className="text-xs text-slate-500">
                        {zoneInfo.zone.minPct}-{zoneInfo.zone.maxPct}% av max ({Math.round(calculatedMaxHR * zoneInfo.zone.minPct / 100)}-{Math.round(calculatedMaxHR * zoneInfo.zone.maxPct / 100)} bpm)
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-black" style={{ color: zoneInfo.zone.color }}>
                        {Math.round(zoneInfo.hrPct)}%
                    </p>
                    <p className="text-xs text-slate-500">av max HR</p>
                </div>
            </div>

            {/* Training Effect Summary */}
            <div className="text-xs text-slate-500 border-t border-white/5 pt-3">
                {zoneInfo.zone.name === 'Z1' && 'Lätt aktivitet för återhämtning. Bygger inte kondition.'}
                {zoneInfo.zone.name === 'Z2' && 'Optimal zon för fettförbränning och långdistansträning.'}
                {zoneInfo.zone.name === 'Z3' && 'Förbättrar aerob kapacitet. Marathontempo.'}
                {zoneInfo.zone.name === 'Z4' && 'Tröskelträning. Ökar laktattolerans.'}
                {zoneInfo.zone.name === 'Z5' && 'Maximal ansträngning. Förbättrar VO2 max.'}
            </div>

            {/* Max HR Info */}
            <div className="text-[10px] text-slate-600 flex items-center gap-1">
                <span>📊</span>
                <span>Beräknad max HR: {calculatedMaxHR} bpm (220 - ålder)</span>
            </div>
        </div>
    );
}

/**
 * Simplified inline HR zone badge for compact displays
 */
export function HeartRateZoneBadge({ avgHeartRate, maxHeartRate, age = 30 }: { avgHeartRate: number; maxHeartRate?: number; age?: number }) {
    const calculatedMaxHR = maxHeartRate || (220 - age);
    const hrPct = (avgHeartRate / calculatedMaxHR) * 100;

    const zone = ZONES.find(z => hrPct >= z.minPct && hrPct < z.maxPct) || ZONES[0];

    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: `${zone.color}20`, color: zone.color }}
        >
            ❤️ {zone.name} · {avgHeartRate} bpm
        </span>
    );
}
