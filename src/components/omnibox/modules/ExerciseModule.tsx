import React from 'react';
import { Dumbbell, Flame, ArrowRight } from 'lucide-react';
import { ExerciseType, ExerciseIntensity } from '../../../models/types.ts';
import { EXERCISE_TYPES, INTENSITIES } from '../OmniboxConstants.ts';

interface ExerciseModuleProps {
    intent: any;
    draftType: ExerciseType | null;
    draftDuration: number | null;
    draftIntensity: ExerciseIntensity | null;
    isManual: boolean;
    setDraftType: (type: ExerciseType | null) => void;
    setDraftDuration: (duration: number | null) => void;
    setDraftIntensity: (intensity: ExerciseIntensity | null) => void;
    setIsManual: (isManual: boolean) => void;
    handleExerciseAction: () => void;
}

export const ExerciseModule: React.FC<ExerciseModuleProps> = ({
    intent,
    draftType,
    draftDuration,
    draftIntensity,
    isManual,
    setDraftType,
    setDraftDuration,
    setDraftIntensity,
    setIsManual,
    handleExerciseAction
}) => {
    return (
        <div className="p-4 space-y-4">
            <div className="px-3 py-2 bg-orange-500/10 border-l-4 border-orange-500 rounded-r-lg flex items-center gap-2">
                <Dumbbell size={16} className="text-orange-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Träning</span>
                {isManual && <span className="ml-auto text-[10px] uppercase font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">Manuellt ändrad</span>}
            </div>

            {/* Exercise Type Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {EXERCISE_TYPES.map(t => (
                    <button
                        key={t.type}
                        onClick={() => { setDraftType(t.type); setIsManual(true); }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all min-w-[70px] ${(draftType || intent.data.exerciseType) === t.type
                            ? 'border-orange-500 bg-orange-500/20'
                            : 'border-transparent hover:bg-white/5'
                            }`}
                    >
                        <span className="text-2xl">{t.icon}</span>
                        <span className="text-[10px] font-bold text-slate-400">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Duration & Intensity */}
            <div className="flex items-center gap-6 p-4 bg-slate-800/50 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Flame size={64} />
                </div>

                <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Tid (min)</label>
                    <input
                        type="number"
                        value={draftDuration || intent.data.duration || ''}
                        onChange={(e) => { setDraftDuration(parseFloat(e.target.value)); setIsManual(true); }}
                        className="w-full text-3xl font-black bg-transparent border-b-2 border-slate-600 focus:border-orange-500 outline-none text-white"
                        placeholder="30"
                    />

                    {/* Extra Details Row */}
                    <div className="flex flex-wrap gap-3 mt-3">
                        {intent.data.distance && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 rounded-lg text-blue-300">
                                <span className="text-xs">📏</span>
                                <span className="text-xs font-bold">{intent.data.distance} km</span>
                            </div>
                        )}
                        {(intent.data.heartRateAvg || intent.data.heartRateMax) && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/20 rounded-lg text-rose-300">
                                <span className="text-xs">❤️</span>
                                <span className="text-xs font-bold">
                                    {intent.data.heartRateAvg && `${intent.data.heartRateAvg} bpm`}
                                    {intent.data.heartRateMax && ` (max ${intent.data.heartRateMax})`}
                                </span>
                            </div>
                        )}
                        {intent.data.subType && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-lg text-slate-300">
                                <span className="text-xs">🏷️</span>
                                <span className="text-xs font-bold capitalize">{intent.data.subType}</span>
                            </div>
                        )}
                        {intent.data.notes && (
                            <div className="w-full mt-2 text-xs text-slate-400 italic border-l-2 border-slate-600 pl-2">
                                "{intent.data.notes}"
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Intensitet</label>
                    <div className="flex flex-col gap-1">
                        {INTENSITIES.map(i => (
                            <button
                                key={i.value}
                                onClick={() => { setDraftIntensity(i.value); setIsManual(true); }}
                                className={`text-xs p-1.5 rounded-lg border transition-all ${(draftIntensity || intent.data.intensity) === i.value
                                    ? 'bg-orange-500/20 border-orange-500 text-orange-400 font-bold'
                                    : 'border-transparent text-slate-500 hover:bg-white/5'
                                    }`}
                            >
                                {i.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                className={`w-full py-3 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${(draftType || intent.data.exerciseType) && (draftDuration || intent.data.duration)
                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                onClick={handleExerciseAction}
                disabled={!((draftType || intent.data.exerciseType) && (draftDuration || intent.data.duration))}
            >
                <span>Logga pass</span>
                <ArrowRight size={16} />
            </button>
        </div>
    );
};
