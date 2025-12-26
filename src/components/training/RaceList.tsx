import React, { useMemo } from 'react';
import { ExerciseEntry } from '../../models/types.ts';

interface RaceListProps {
    exercises: ExerciseEntry[];
}

export function RaceList({ exercises }: RaceListProps) {
    const races = useMemo(() => {
        return exercises
            .filter(e => e.subType === 'race')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [exercises]);

    if (races.length === 0) {
        return (
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-8 text-center">
                <div className="text-2xl mb-2">🏆</div>
                <h3 className="text-white font-bold">Inga tävlingar registrerade än</h3>
                <p className="text-slate-500 text-sm mt-1">När du markerar ett pass som "Tävling" visas det här.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span className="text-amber-400">🏆</span> Tävlingshistorik
            </h2>

            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-950/50 text-slate-500 font-bold border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4">Datum</th>
                                <th className="px-6 py-4">Namn</th>
                                <th className="px-6 py-4">Distans</th>
                                <th className="px-6 py-4 text-right">Tid</th>
                                <th className="px-6 py-4 text-right">Tempo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {races.map((race) => {
                                const pace = race.distance && race.durationMinutes
                                    ? race.durationMinutes / race.distance
                                    : 0;
                                const paceMin = Math.floor(pace);
                                const paceSec = Math.round((pace % 1) * 60).toString().padStart(2, '0');

                                return (
                                    <tr key={race.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-mono text-slate-400 group-hover:text-white transition-colors">
                                            {race.date.split('T')[0]}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white group-hover:text-amber-400 transition-colors">
                                                {race.notes || 'Okänt lopp'}
                                            </div>
                                            <div className="text-xs text-slate-500 capitalize">{race.type}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {race.distance ? `${race.distance} km` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-300">
                                            {Math.floor(race.durationMinutes / 60)}h {Math.round(race.durationMinutes % 60)}m
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            {race.distance ? (
                                                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                    {paceMin}:{paceSec} /km
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
