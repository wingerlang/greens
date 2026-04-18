/**
 * Heart Rate Zones Component
 * Visualizes time spent in different HR zones for running activities.
 */
import React, { useMemo } from 'react';
import { Heart } from 'lucide-react';

export interface HeartRateZonesProps {
    avgHeartRate: number;
    maxHeartRate?: number;  // User's max HR (defaults to 220 - age estimate)
    duration?: number;      // Activity duration in seconds
    age?: number;           // User age for HR zone calculation
}

// HR Zone definitions (% of max HR)
const ZONES = [
    { name: 'Z1', label: 'Återhämtning', minPct: 50, maxPct: 60, color: '#6366f1', gradient: 'from-indigo-500 to-indigo-600' }, 
    { name: 'Z2', label: 'Aerob bas', minPct: 60, maxPct: 70, color: '#10b981', gradient: 'from-emerald-500 to-emerald-600' },    
    { name: 'Z3', label: 'Tempo', minPct: 70, maxPct: 80, color: '#eab308', gradient: 'from-yellow-500 to-yellow-600' }, 
    { name: 'Z4', label: 'Tröskel', minPct: 80, maxPct: 90, color: '#f97316', gradient: 'from-orange-500 to-orange-600' },      
    { name: 'Z5', label: 'Anaerob / Max', minPct: 90, maxPct: 100, color: '#ef4444', gradient: 'from-red-500 to-red-600' },     
];

export function HeartRateZones({ avgHeartRate, maxHeartRate, duration, age = 30 }: HeartRateZonesProps) {
    const isEstimated = !maxHeartRate;
    const calculatedMaxHR = maxHeartRate || (220 - age);

    const zoneInfo = useMemo(() => {
        const hrPct = (avgHeartRate / calculatedMaxHR) * 100;
        for (const zone of ZONES) {
            if (hrPct >= zone.minPct && hrPct < zone.maxPct) return { zone, hrPct };
        }
        if (hrPct >= 100) return { zone: ZONES[4], hrPct };
        return { zone: ZONES[0], hrPct };
    }, [avgHeartRate, calculatedMaxHR]);

    return (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-6 shadow-xl relative overflow-hidden group">
            {/* Background Accents */}
            <div className="absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-10 transition-colors duration-1000" style={{ backgroundColor: zoneInfo.zone.color }}></div>
            
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-800/50 border border-white/5">
                        <Heart className="w-5 h-5 text-rose-500 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pulszon</h3>
                        <p className="text-sm font-bold text-white capitalize">{zoneInfo.zone.label}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                        <span className="text-4xl font-black transition-colors duration-500" style={{ color: zoneInfo.zone.color }}>
                            {avgHeartRate}
                        </span>
                        <span className="text-sm font-bold text-slate-500">BPM</span>
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{Math.round(zoneInfo.hrPct)}% av max</p>
                </div>
            </div>

            {/* Premium Bar Visualization */}
            <div className="space-y-2 relative z-10">
                <div className="relative h-6 bg-slate-800/50 rounded-xl flex overflow-hidden border border-white/5 shadow-inner">
                    {/* Blended Background */}
                    <div className="absolute inset-0 flex">
                        {ZONES.map((zone, idx) => {
                            const width = (zone.maxPct - zone.minPct) * 2;
                            const nextColor = idx < ZONES.length - 1 ? ZONES[idx + 1].color : zone.color;
                            return (
                                <div
                                    key={zone.name}
                                    className="h-full relative overflow-hidden flex flex-col items-center justify-center"
                                    style={{
                                        width: `${width}%`,
                                        background: `linear-gradient(to right, ${zone.color}dd, ${nextColor}dd)`,
                                        opacity: zone.name === zoneInfo.zone.name ? 1 : 0.4
                                    }}
                                >
                                    {/* Fast line/marker at end of zone */}
                                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/20 z-10"></div>
                                    
                                    {/* Zone Label inside bar if wide enough */}
                                    <span className="text-[7px] font-black text-white/50 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                                        {zone.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Cursor Position Marker */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl z-20 transition-all duration-1000 ease-out"
                        style={{
                            left: `${Math.min(99, Math.max(1, (zoneInfo.hrPct - 50) * 2))}%`,
                            boxShadow: `0 0 15px white, 0 0 30px ${zoneInfo.zone.color}`
                        }}
                    >
                        {/* Glow surrounding the cursor */}
                        <div className="absolute inset-0 bg-white blur-[2px]"></div>
                    </div>
                </div>

                {/* Boundary Values - Detailed below the bar */}
                <div className="grid grid-cols-5 gap-0 px-1 pt-1">
                    {ZONES.map((zone, idx) => {
                        const minBpm = Math.round(calculatedMaxHR * zone.minPct / 100);
                        const maxBpm = Math.round(calculatedMaxHR * zone.maxPct / 100);
                        const isActive = zone.name === zoneInfo.zone.name;
                        
                        return (
                            <div key={idx} className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-40'}`}>
                                <p className="text-[7px] font-black mb-0.5" style={{ color: zone.color }}>{zone.name}</p>
                                <span className={`text-[9px] font-mono font-black ${isActive ? 'text-white' : 'text-slate-500'}`}>
                                    {minBpm}-{maxBpm}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Training Description Card */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 transition-all hover:bg-white/[0.05]">
                <div className="flex items-start gap-3">
                    <span className="text-xl" style={{ filter: `drop-shadow(0 0 8px ${zoneInfo.zone.color}aa)` }}>
                        {zoneInfo.zone.name === 'Z1' ? '🧘' :
                         zoneInfo.zone.name === 'Z2' ? '🔋' :
                         zoneInfo.zone.name === 'Z3' ? '🏃' :
                         zoneInfo.zone.name === 'Z4' ? '🔥' : '💀'}
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                        {zoneInfo.zone.name === 'Z1' && 'Lätt aktivitet som främjar blodflöde och återhämtning. Mycket låg belastning på hjärtat.'}
                        {zoneInfo.zone.name === 'Z2' && 'Den mest effektiva zonen för att bygga din basuthållighet och förbättra kroppens förmåga att använda fett som bränsle.'}
                        {zoneInfo.zone.name === 'Z3' && 'Ökar din aeroba kraft och tolerans för fart under längre tid. Perfekt för maraton och tävlingsfart.'}
                        {zoneInfo.zone.name === 'Z4' && 'Träning precis vid din mjölksyratröskel. Mycket jobbigt, men extremt effektivt för att flytta din övre gräns.'}
                        {zoneInfo.zone.name === 'Z5' && 'Maximal intensitet för korta intervaller. Utvecklar din absoluta maxkapacitet (VO2-max).'}
                    </p>
                </div>
            </div>

            {/* Source Info Footer */}
            <div className="flex items-center justify-between text-[9px] font-bold">
                <div className="flex items-center gap-2 text-slate-600">
                    <div className={`w-1.5 h-1.5 rounded-full ${isEstimated ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                    <span className="uppercase tracking-widest">{isEstimated ? 'Estimerad maxpuls' : 'Profil-verifierad puls'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-white/5">
                    <span className="text-[8px] opacity-70">MAX</span>
                    <span className="font-mono text-white/80">{calculatedMaxHR} BPM</span>
                </div>
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
            <Heart className="w-2.5 h-2.5" /> {zone.name} · {avgHeartRate} bpm
        </span>
    );
}
