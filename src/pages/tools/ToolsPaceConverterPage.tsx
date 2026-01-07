import React, { useState } from 'react';
import { convertPaceToTime, convertTimeToPace, formatSeconds } from '../../utils/runningCalculator.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useHealth } from '../../hooks/useHealth.ts';

export function ToolsPaceConverterPage() {
    const { user } = useAuth();
    const { exerciseEntries } = useHealth();

    // Pace state: MM and SS
    const [minutes, setMinutes] = useState(5);
    const [seconds, setSeconds] = useState(0);

    const paceSecondsPerKm = minutes * 60 + seconds;

    const distances = [
        { name: "400m", km: 0.4 },
        { name: "800m", km: 0.8 },
        { name: "1 km", km: 1 },
        { name: "1.5 km", km: 1.5 },
        { name: "3 km", km: 3 },
        { name: "5 km", km: 5 },
        { name: "10 km", km: 10 },
        { name: "Halvmaraton", km: 21.0975 },
        { name: "Maraton", km: 42.195 },
        { name: "50 km", km: 50 },
        { name: "50 miles", km: 80.4672 },
        { name: "100 km", km: 100 },
        { name: "100 miles", km: 160.934 }
    ];

    const pbs = React.useMemo(() => {
        if (!exerciseEntries || exerciseEntries.length === 0) return [];
        const found = [];
        const targets = [5, 10, 21.0975, 42.195];

        targets.forEach(dist => {
             const match = exerciseEntries
                .filter(e => e.type === 'running' && e.distance && Math.abs(e.distance - dist) < (dist * 0.05))
                .sort((a, b) => (a.durationMinutes - b.durationMinutes))[0];

             if (match && match.distance && match.durationMinutes) {
                 const pace = (match.durationMinutes * 60) / match.distance;
                 found.push({
                     name: dist > 40 ? 'Maraton' : dist > 20 ? 'Halvmaraton' : `${dist}km`,
                     pace,
                     date: match.date
                 });
             }
        });
        return found;
    }, [exerciseEntries]);

    const setPaceFromSeconds = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = Math.round(totalSeconds % 60);
        setMinutes(m);
        setSeconds(s);
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Pace Converter</h1>
                <p className="text-slate-400">Se hur lång tid olika distanser tar vid ett visst tempo.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Ditt tempo</h2>
                        {pbs.length > 0 && (
                            <select
                                onChange={(e) => setPaceFromSeconds(Number(e.target.value))}
                                className="bg-slate-950 border border-white/10 text-xs text-slate-400 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
                                defaultValue=""
                            >
                                <option value="" disabled>Hämta från PB</option>
                                {pbs.map((pb, idx) => (
                                    <option key={idx} value={pb.pace}>
                                        {pb.name} ({formatSeconds(pb.pace)}/km)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-400 mb-1">Minuter</label>
                            <input
                                type="number"
                                value={minutes}
                                onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center text-xl font-bold"
                            />
                        </div>
                        <div className="text-2xl font-bold text-slate-500 pb-3">:</div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-400 mb-1">Sekunder</label>
                            <input
                                type="number"
                                value={seconds}
                                onChange={(e) => setSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center text-xl font-bold"
                            />
                        </div>
                        <div className="text-slate-500 pb-4 pl-2 font-medium">/km</div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Tidtabell</h2>
                    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {distances.map(dist => {
                            const time = convertPaceToTime(dist.km, paceSecondsPerKm);
                            return (
                                <div key={dist.name} className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                                    <span className="font-medium text-slate-300">{dist.name}</span>
                                    <span className="font-bold text-emerald-400 font-mono text-lg">{formatSeconds(time)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
