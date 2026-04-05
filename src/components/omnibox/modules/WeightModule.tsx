import React from 'react';

interface WeightModuleProps {
    intent: any;
    handleExecute: () => void;
}

export const WeightModule: React.FC<WeightModuleProps> = ({
    intent,
    handleExecute
}) => {
    return (
        <div className="flex items-center gap-3 text-emerald-400 px-4 py-4">
            <span className="text-2xl">⚖️</span>
            <span className="text-lg">Logga vikt: <span className="font-bold">{intent.data.weight} kg</span></span>
            {intent.date && <span className="ml-2 text-slate-500 font-normal">({intent.date})</span>}
            <button
                className="ml-auto bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
                onClick={handleExecute}
            >
                Spara
            </button>
        </div>
    );
};
