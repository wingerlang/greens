import React from 'react';
import { Zap } from 'lucide-react';

export interface PowerZonesProps {
    avgWatts: number;
    ftp: number;           // Functional Threshold Power
    duration?: number;     // Activity duration in seconds
}

// Power Zone definitions (% of FTP) - Coggan's 7 Zones (Simplified to 6 for UI consistency)
const ZONES = [
    { name: 'Z1', label: 'Återhämtning', minPct: 0, maxPct: 55, color: '#6366f1' }, 
    { name: 'Z2', label: 'Uthållighet', minPct: 55, maxPct: 75, color: '#10b981' },    
    { name: 'Z3', label: 'Tempo', minPct: 75, maxPct: 90, color: '#eab308' }, 
    { name: 'Z4', label: 'Tröskel', minPct: 90, maxPct: 105, color: '#f97316' },      
    { name: 'Z5', label: 'VO2 Max', minPct: 105, maxPct: 120, color: '#ef4444' },     
    { name: 'Z6', label: 'Anaerob', minPct: 120, maxPct: 200, color: '#d946ef' },     
];

export function PowerZones({ avgWatts, ftp }: PowerZonesProps) {
    const wattPct = (avgWatts / Math.max(ftp, 1)) * 100;
    
    const zoneInfo = React.useMemo(() => {
        for (const zone of ZONES) {
            if (wattPct >= zone.minPct && wattPct < zone.maxPct) return { zone, wattPct };
        }
        if (wattPct >= 200) return { zone: ZONES[5], wattPct };
        return { zone: ZONES[0], wattPct };
    }, [avgWatts, ftp, wattPct]);

    return (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-6 shadow-xl relative overflow-hidden group">
            {/* Background Accents */}
            <div className="absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-10 transition-colors duration-1000" style={{ backgroundColor: zoneInfo.zone.color }}></div>
            
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-800/50 border border-white/5">
                        <Zap className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Wattzon</h3>
                        <p className="text-sm font-bold text-white capitalize">{zoneInfo.zone.label}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                        <span className="text-4xl font-black transition-colors duration-500" style={{ color: zoneInfo.zone.color }}>
                            {Math.round(avgWatts)}
                        </span>
                        <span className="text-sm font-bold text-slate-500">W</span>
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{Math.round(zoneInfo.wattPct)}% av FTP</p>
                </div>
            </div>

            {/* Premium Bar Visualization */}
            <div className="space-y-2 relative z-10">
                <div className="relative h-6 bg-slate-800/50 rounded-xl flex overflow-hidden border border-white/5 shadow-inner">
                    <div className="absolute inset-0 flex">
                        {ZONES.map((zone, idx) => {
                            // Scale the width visually to represent the range
                            const width = (zone.maxPct - zone.minPct) / 1.5; // Scaled for 150% visual width
                            const nextColor = idx < ZONES.length - 1 ? ZONES[idx + 1].color : zone.color;
                            return (
                                <div
                                    key={zone.name}
                                    className="h-full relative overflow-hidden flex flex-col items-center justify-center border-r border-white/5"
                                    style={{
                                        width: `${width}%`,
                                        background: zone.color,
                                        opacity: zone.name === zoneInfo.zone.name ? 1 : 0.4
                                    }}
                                >
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
                            left: `${Math.min(99, Math.max(1, (zoneInfo.wattPct / 1.5)))}%`,
                            boxShadow: `0 0 15px white, 0 0 30px ${zoneInfo.zone.color}`
                        }}
                    >
                        <div className="absolute inset-0 bg-white blur-[2px]"></div>
                    </div>
                </div>

                {/* Boundary Values */}
                <div className="grid grid-cols-6 gap-0 px-1 pt-1">
                    {ZONES.map((zone, idx) => {
                        const minWatts = Math.round(ftp * zone.minPct / 100);
                        const maxWatts = Math.round(ftp * zone.maxPct / 100);
                        const isActive = zone.name === zoneInfo.zone.name;
                        
                        return (
                            <div key={idx} className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-40'}`}>
                                <p className="text-[7px] font-black mb-0.5" style={{ color: zone.color }}>{zone.name}</p>
                                <span className={`text-[8px] font-mono font-black ${isActive ? 'text-white' : 'text-slate-500'}`}>
                                    {minWatts}-{maxWatts}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Profile Info Footer */}
            <div className="flex items-center justify-between text-[9px] font-bold">
                <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="uppercase tracking-widest">Baserat på din watt-profil</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-white/5">
                    <span className="text-[8px] opacity-70 uppercase">Din FTP</span>
                    <span className="font-mono text-white/80">{ftp} W</span>
                </div>
            </div>
        </div>
    );
}
