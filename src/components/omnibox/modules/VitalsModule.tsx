import React from 'react';
import { Droplets } from 'lucide-react';

interface VitalsModuleProps {
    intent: any;
    vitalInfo: any;
    draftVitalAmount: number | null;
    setDraftVitalAmount: (amount: number | null) => void;
    setIsManual: (isManual: boolean) => void;
    handleVitalsAction: () => void;
}

export const VitalsModule: React.FC<VitalsModuleProps> = ({
    intent,
    vitalInfo,
    draftVitalAmount,
    setDraftVitalAmount,
    setIsManual,
    handleVitalsAction
}) => {
    const VitalIcon = vitalInfo?.icon || Droplets;
    
    return (
        <div className="p-4 space-y-4">
            <div className={`px-3 py-2 ${vitalInfo.bg} border-l-4 ${vitalInfo.text.replace('text-', 'border-')} rounded-r-lg flex items-center gap-2`}>
                <VitalIcon size={16} className={vitalInfo.text} />
                <span className={`text-xs font-bold uppercase tracking-wider ${vitalInfo.text}`}>{vitalInfo.label}</span>
            </div>

            <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${vitalInfo.bg} ${vitalInfo.text} text-3xl`}>
                    <VitalIcon size={32} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="number"
                            value={draftVitalAmount || intent.data.amount || ''}
                            onChange={(e) => { setDraftVitalAmount(parseFloat(e.target.value)); setIsManual(true); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleVitalsAction();
                                }
                            }}
                            className="w-24 text-3xl font-black bg-transparent border-b-2 border-slate-600 focus:border-indigo-500 outline-none text-white text-center"
                            placeholder="0"
                        />
                        <span className="text-sm font-bold text-slate-400 uppercase">
                            {vitalInfo.unit}
                        </span>
                    </div>
                    <button
                        className={`text-white ${vitalInfo.bg.replace('/20', '')} hover:opacity-80 px-4 py-1.5 rounded-full text-xs font-bold`}
                        onClick={handleVitalsAction}
                    >
                        Spara
                    </button>
                </div>
            </div>
        </div>
    );
};
