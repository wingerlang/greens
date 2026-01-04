import React, { useMemo } from 'react';
import { calculateCooperVO2, predictRaceTime, formatSeconds, calculateVDOT } from '../../utils/runningCalculator.ts';

interface CooperRacePredictorProps {
    distance: number;
}

export function CooperRacePredictor({ distance }: CooperRacePredictorProps) {
    const vo2 = calculateCooperVO2(distance);

    // Predict times for standard distances
    // Uses the utility "predictRaceTime(vdot, distanceKm)"
    // Predict times for standard distances
    // Uses the utility "predictRaceTime(vdot, distanceKm)"
    const predictions = useMemo(() => {
        if (distance < 1000) return null; // Too short to predict meaningful

        // Calculate VDOT based on the Cooper performance (Distance in 12 min)
        // This is more accurate for race prediction than the simplified Cooper VO2 formula
        const vdot = calculateVDOT(distance / 1000, 12 * 60);

        return [
            { label: '5 km', time: predictRaceTime(vdot, 5) },
            { label: '10 km', time: predictRaceTime(vdot, 10) },
            { label: 'Halvmara', time: predictRaceTime(vdot, 21.0975) },
            { label: 'Maraton', time: predictRaceTime(vdot, 42.195) },
        ];
    }, [distance]);

    if (!predictions) return null;

    return (
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="text-emerald-400">⚡</span> Estimerade Tävlingstider
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {predictions.map((p) => {
                    const dist = p.label === 'Maraton' ? 42.195 : p.label === 'Halvmara' ? 21.0975 : parseFloat(p.label);
                    const secondsPerKm = p.time / dist;
                    const mins = Math.floor(secondsPerKm / 60);
                    const secs = Math.round(secondsPerKm % 60);

                    return (
                        <div key={p.label} className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                            <div className="text-xs text-slate-500 font-bold uppercase mb-1">{p.label}</div>
                            <div className="text-xl font-bold text-white font-mono">{formatSeconds(p.time)}</div>
                            <div className="text-[10px] text-slate-600">
                                {mins}:{secs.toString().padStart(2, '0')}/km
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="text-[10px] text-slate-600 mt-3 text-center italic">
                Baserat på Jack Daniels VDOT-formel via ditt Cooper-resultat ({vo2}). Förutsätter adekvat uthållighetsträning för distansen.
            </div>
        </div>
    );
}
