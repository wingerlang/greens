import React, { useState } from 'react';
import { calculateVDOT, predictRaceTime, formatSeconds } from '../../utils/runningCalculator.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export function ToolsRacePredictorPage() {
    const { user } = useAuth();
    const [distanceKm, setDistanceKm] = useState(5);
    const [timeStr, setTimeStr] = useState("25:00");

    // Parse time string (MM:SS or HH:MM:SS) to seconds
    const parseTime = (str: string): number => {
        const parts = str.split(':').map(Number);
        if (parts.some(isNaN)) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    };

    const timeSeconds = parseTime(timeStr);
    const vdot = timeSeconds > 0 && distanceKm > 0 ? calculateVDOT(distanceKm, timeSeconds) : 0;

    const distances = [
        { name: "800m", km: 0.8 },
        { name: "1500m", km: 1.5 },
        { name: "3 km", km: 3 },
        { name: "5 km", km: 5 },
        { name: "10 km", km: 10 },
        { name: "Halvmaraton", km: 21.0975 },
        { name: "Maraton", km: 42.195 },
        { name: "50 km", km: 50 },
        { name: "100 km", km: 100 }
    ];

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Race Predictor</h1>
                <p className="text-slate-400">Baserat på Jack Daniels VDOT-formel.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit">
                    <h2 className="text-xl font-bold text-white mb-6">Ditt resultat</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Distans</label>
                            <select
                                value={distanceKm}
                                onChange={(e) => setDistanceKm(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value={0.8}>800m</option>
                                <option value={1}>1 km</option>
                                <option value={1.5}>1500m</option>
                                <option value={3}>3 km</option>
                                <option value={5}>5 km</option>
                                <option value={10}>10 km</option>
                                <option value={21.0975}>Halvmaraton</option>
                                <option value={42.195}>Maraton</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Tid (MM:SS eller HH:MM:SS)</label>
                            <input
                                type="text"
                                value={timeStr}
                                onChange={(e) => setTimeStr(e.target.value)}
                                placeholder="25:00"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        <div className="text-sm text-slate-500 font-medium mb-1">DIN VDOT SCORE</div>
                        <div className="text-5xl font-bold text-emerald-400">{vdot || '-'}</div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Förutsagda tider</h2>
                    <div className="space-y-2">
                        {vdot > 0 ? distances.map(dist => {
                            const predSeconds = predictRaceTime(vdot, dist.km);
                            const paceSeconds = predSeconds / dist.km;
                            return (
                                <div key={dist.name} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                                    <span className="font-medium text-slate-300">{dist.name}</span>
                                    <div className="text-right">
                                        <div className="font-bold text-white">{formatSeconds(predSeconds)}</div>
                                        <div className="text-xs text-slate-500">{formatSeconds(paceSeconds)} /km</div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-10 text-slate-500">
                                Ange ett resultat för att se prognoser
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
