import React from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { BodyMeasurementType } from '../../../models/types.ts';
import { MEASUREMENT_INFO } from '../OmniboxConstants.ts';

interface MeasurementModuleProps {
    intent: any;
    draftMeasurementType: BodyMeasurementType | null;
    draftMeasurementValue: number | null;
    draftMeasurementDate: string | null;
    isManual: boolean;
    setDraftMeasurementType: (type: BodyMeasurementType | null) => void;
    setDraftMeasurementValue: (value: number | null) => void;
    setIsManual: (isManual: boolean) => void;
    handleMeasurementAction: () => void;
}

export const MeasurementModule: React.FC<MeasurementModuleProps> = ({
    intent,
    draftMeasurementType,
    draftMeasurementValue,
    draftMeasurementDate,
    isManual,
    setDraftMeasurementType,
    setDraftMeasurementValue,
    setIsManual,
    handleMeasurementAction
}) => {
    return (
        <div className="p-4 space-y-4">
            <div className="px-3 py-2 bg-fuchsia-500/10 border-l-4 border-fuchsia-500 rounded-r-lg flex items-center gap-2">
                <Search size={16} className="text-fuchsia-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">Kroppsmått</span>
                {isManual && <span className="ml-auto text-[10px] uppercase font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">Manuellt ändrad</span>}
            </div>

            {/* Measurement Type Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {Object.entries(MEASUREMENT_INFO).map(([type, info]) => (
                    <button
                        key={type}
                        onClick={() => { setDraftMeasurementType(type as BodyMeasurementType); setIsManual(true); }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all min-w-[80px] ${(draftMeasurementType || intent.data.measurementType) === type
                            ? 'border-fuchsia-500 bg-fuchsia-500/20'
                            : 'border-transparent hover:bg-white/5'
                            }`}
                    >
                        <span className="text-2xl">{info.icon}</span>
                        <span className="text-[10px] font-bold text-slate-400 text-center">{info.label}</span>
                    </button>
                ))}
            </div>

            {/* Value Input */}
            <div className="bg-slate-800/50 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <span className="text-6xl">📏</span>
                </div>
                <div className="flex justify-between items-start mb-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Mått (cm)</label>
                    <span className="text-[10px] font-bold uppercase text-fuchsia-400">
                        📅 {draftMeasurementDate || intent.date || 'Idag'}
                    </span>
                </div>
                <div className="flex items-baseline gap-2">
                    <input
                        type="number"
                        step="0.1"
                        value={draftMeasurementValue || intent.data.value || ''}
                        onChange={(e) => { setDraftMeasurementValue(parseFloat(e.target.value)); setIsManual(true); }}
                        className="w-full text-5xl font-black bg-transparent border-b-2 border-slate-600 focus:border-fuchsia-500 outline-none text-white"
                        placeholder="0.0"
                    />
                    <span className="text-2xl font-bold text-slate-500">cm</span>
                </div>
            </div>

            <button
                className={`w-full py-3 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${(draftMeasurementType || intent.data.measurementType) && (draftMeasurementValue || intent.data.value)
                    ? 'bg-fuchsia-500 hover:bg-fuchsia-600 text-white shadow-fuchsia-500/20'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                onClick={handleMeasurementAction}
                disabled={!((draftMeasurementType || intent.data.measurementType) && (draftMeasurementValue || intent.data.value))}
            >
                <span>Spara mått</span>
                <ArrowRight size={16} />
            </button>
        </div>
    );
};
