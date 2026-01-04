
import React from 'react';
import { Link } from 'react-router-dom';
import { PersonalBest } from '../../models/strengthTypes.ts';

interface PBHoverCardProps {
    pb: PersonalBest | null;
    rmMode: '1rm' | '1erm';
}

export function PBHoverCard({ pb, rmMode }: PBHoverCardProps) {
    if (!pb) return null;

    return (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl opacity-0 group-hover/pb:opacity-100 transition-opacity z-50 pointer-events-none group-hover/pb:pointer-events-auto">
            <div className="text-xs text-gray-500 uppercase font-bold mb-2 text-left">PB Detaljer</div>
            <div className="space-y-2 text-left">
                <div className="flex justify-between">
                    <span className="text-gray-400">Datum</span>
                    <span className="text-white font-bold">{new Date(pb.date).toLocaleDateString('sv-SE')}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Set</span>
                    <span className="text-white font-bold">{pb.weight} kg × {pb.reps} reps</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Typ</span>
                    <span className={`font-bold ${pb.isActual1RM ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {pb.isActual1RM ? '✓ Faktisk 1RM' : '≈ Estimerad (Epley)'}
                    </span>
                </div>
                {pb.workoutId && (
                    <div className="pt-2 border-t border-slate-700">
                        <Link
                            to={`/strength/${pb.workoutId}`}
                            className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-bold pointer-events-auto"
                        >
                            🔗 {pb.workoutName || 'Visa pass'}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
