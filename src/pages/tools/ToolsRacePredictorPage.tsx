import React, { useState } from 'react';
import { calculateVDOT, predictRaceTime, calculateRiegelTime, formatSeconds } from '../../utils/runningCalculator.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useHealth } from '../../hooks/useHealth.ts';

export function ToolsRacePredictorPage() {
    const { user } = useAuth();
    const { exerciseEntries } = useHealth();

    const [distanceKm, setDistanceKm] = useState(5);
    const [timeStr, setTimeStr] = useState("25:00");
    const [algo, setAlgo] = useState<'vdot' | 'riegel'>('vdot');
    const [showExplainer, setShowExplainer] = useState(false);

    // Parse time string (MM:SS or HH:MM:SS) to seconds
    const parseTime = (str: string): number => {
        const parts = str.split(':').map(Number);
        if (parts.some(isNaN)) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    };

    const timeSeconds = parseTime(timeStr);
    const vdot = (timeSeconds > 0 && distanceKm > 0) ? calculateVDOT(distanceKm, timeSeconds) : 0;

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

    // Analysis Logic
    // Find best VDOT from history
    const analyzedPBs = React.useMemo(() => {
        if (!exerciseEntries || exerciseEntries.length === 0) return [];

        const standardDists = [5, 10, 21.0975, 42.195];
        const bests: { dist: number, time: number, vdot: number, date: string }[] = [];

        standardDists.forEach(dist => {
            // Find exercises close to this distance (within 2%)
            const matches = exerciseEntries.filter(e =>
                e.type === 'running' &&
                e.distance &&
                Math.abs(e.distance - dist) < (dist * 0.05) // 5% tolerance
            );

            if (matches.length > 0) {
                // Find fastest
                // If duration is missing, skip. Assuming durationMinutes is set.
                const fastest = matches.reduce((prev, curr) => {
                    if (!prev.durationMinutes) return curr;
                    if (!curr.durationMinutes) return prev;
                    return (curr.durationMinutes < prev.durationMinutes) ? curr : prev;
                });

                if (fastest.durationMinutes && fastest.distance) {
                    const seconds = fastest.durationMinutes * 60;
                    const v = calculateVDOT(fastest.distance, seconds);
                    bests.push({ dist, time: seconds, vdot: v, date: fastest.date });
                }
            }
        });

        return bests.sort((a, b) => b.vdot - a.vdot); // Highest VDOT first (best performance)
    }, [exerciseEntries]);

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Race Predictor</h1>
                <p className="text-slate-400">Estimerade tider baserat på din nuvarande form.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Ditt resultat</h2>
                            <div className="flex bg-slate-950 rounded-lg p-1 border border-white/5">
                                <button
                                    onClick={() => setAlgo('vdot')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${algo === 'vdot' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    VDOT
                                </button>
                                <button
                                    onClick={() => setAlgo('riegel')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${algo === 'riegel' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Riegel
                                </button>
                            </div>
                        </div>

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
                            {algo === 'vdot' ? (
                                <>
                                    <div className="text-sm text-slate-500 font-medium mb-1">DIN VDOT SCORE</div>
                                    <div className="text-5xl font-bold text-emerald-400">{vdot || '-'}</div>
                                </>
                            ) : (
                                <div className="text-sm text-slate-400">
                                    Riegels formel extrapolerar din tid med en uthållighetsfaktor.
                                </div>
                            )}
                        </div>
                    </div>

                    {analyzedPBs.length > 0 && (
                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Analys av din data</h2>
                            <p className="text-sm text-slate-400 mb-4">Vi hittade {analyzedPBs.length} personbästa i din logg.</p>

                            <div className="space-y-3">
                                {analyzedPBs.map((pb, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                        <div>
                                            <div className="text-white font-bold">{pb.dist >= 42 ? 'Maraton' : pb.dist >= 21 ? 'Halvmaraton' : `${pb.dist} km`}</div>
                                            <div className="text-xs text-slate-500">{pb.date}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-emerald-400 font-mono font-bold">VDOT {pb.vdot}</div>
                                            <div className="text-xs text-slate-400">{formatSeconds(pb.time)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 text-xs text-slate-500 italic">
                                {analyzedPBs[0].dist < analyzedPBs[analyzedPBs.length-1].dist
                                    ? "Du verkar prestera bättre på kortare distanser relativt sett."
                                    : "Du verkar ha en stark uthållighetsprofil."}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Förutsagda tider</h2>
                        <button
                            onClick={() => setShowExplainer(!showExplainer)}
                            className="text-xs text-slate-500 hover:text-white underline"
                        >
                            {showExplainer ? 'Dölj info' : 'Hur funkar det?'}
                        </button>
                    </div>

                    {showExplainer && (
                        <div className="bg-slate-950 p-4 rounded-xl text-sm text-slate-400 mb-4 animate-fade-in">
                            <p className="mb-2">
                                <strong className="text-white">VDOT (Jack Daniels):</strong> En måttstock på din löpkapacitet (VO2max-ekvivalent) baserat på prestation. Används ofta för att sätta träningszoner.
                            </p>
                            <p>
                                <strong className="text-white">Riegel:</strong> En enklare exponentiell formel (T2 = T1 * (D2/D1)^1.06) som antar en viss "trötthetsfaktor" när distansen ökar.
                            </p>
                        </div>
                    )}

                    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {vdot > 0 || (algo === 'riegel' && timeSeconds > 0) ? distances.map(dist => {
                            let predSeconds = 0;
                            if (algo === 'vdot' && vdot > 0) {
                                predSeconds = predictRaceTime(vdot, dist.km);
                            } else if (algo === 'riegel' && timeSeconds > 0) {
                                predSeconds = calculateRiegelTime(timeSeconds, distanceKm, dist.km);
                            }

                            if (!predSeconds) return null;

                            const paceSeconds = predSeconds / dist.km;
                            return (
                                <div key={dist.name} className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                                    <span className="text-sm font-medium text-slate-300">{dist.name}</span>
                                    <div className="text-right flex items-center gap-4">
                                        <div className="text-xs text-slate-500 w-16 text-right">{formatSeconds(paceSeconds)}/km</div>
                                        <div className="font-bold text-white font-mono w-16 text-right">{formatSeconds(predSeconds)}</div>
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
