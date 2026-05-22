import React, { useMemo } from 'react';
import { DailyVitals, FoodItem } from '../../../../models/types.ts';
import { useData } from '../../../../context/DataContext.tsx';

interface DashboardProtocolCardProps {
    density: 'compact' | 'slim' | 'cozy';
    isDone: boolean;
    onToggle: (id: string, e: React.MouseEvent) => void;
    protocol: { foodItemId: string; isRecipe?: boolean; timing: string; dose: string; isActive: boolean }[];
    foodItems: FoodItem[];
    recipes: any[];
    supplementsTaken: string[];
    onToggleSupplement: (protocolId: string) => void;
    onEditProtocol?: () => void;
}

export const DashboardProtocolCard: React.FC<DashboardProtocolCardProps> = ({
    density,
    isDone,
    onToggle,
    protocol,
    foodItems,
    recipes,
    supplementsTaken,
    onToggleSupplement,
    onEditProtocol
}) => {
    // Only show active protocol items
    const activeProtocol = useMemo(() => protocol.filter(p => p.isActive), [protocol]);
    
    // Group by timing
    const grouped = useMemo(() => {
        const groups: Record<string, typeof activeProtocol> = {};
        activeProtocol.forEach(p => {
            if (!groups[p.timing]) groups[p.timing] = [];
            groups[p.timing].push(p);
        });
        return groups;
    }, [activeProtocol]);

    // Timings ordered logically
    const order = ['Morgon', 'Förmiddag', 'Lunch', 'Innan träning', 'Under träning', 'Efter träning', 'Eftermiddag', 'Kväll', 'Innan sänggående', 'Vid behov'];
    const sortedTimings = Object.keys(grouped).sort((a, b) => {
        let iA = order.indexOf(a);
        let iB = order.indexOf(b);
        if (iA === -1) iA = 99;
        if (iB === -1) iB = 99;
        return iA - iB;
    });

    if (protocol.length === 0) {
        return (
            <div 
                className={`
                    relative overflow-hidden rounded-3xl border border-dashed border-slate-700 bg-slate-900/30
                    ${density === 'compact' ? 'p-3' : density === 'slim' ? 'p-4' : 'p-6'}
                    flex flex-col items-center justify-center gap-3 text-center min-h-[140px]
                `}
            >
                <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center text-xl mb-1">
                    💊
                </div>
                <div>
                    <h3 className="text-sm font-black text-white">Inget Protokoll</h3>
                    <p className="text-[10px] text-slate-500 max-w-[200px] mt-1">Du har inte skapat något dagligt rutin-protokoll än.</p>
                </div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onEditProtocol) onEditProtocol();
                    }}
                    className="mt-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    Skapa Protokoll
                </button>
            </div>
        );
    }

    if (activeProtocol.length === 0) return null;

    const totalSupplements = activeProtocol.length;
    const takenCount = activeProtocol.filter(p => supplementsTaken.includes(`${p.foodItemId}_${p.timing}`)).length;
    const progressPct = totalSupplements > 0 ? (takenCount / totalSupplements) * 100 : 0;

    return (
        <div 
            onClick={(e) => isDone ? onToggle('protocol', e) : undefined}
            className={`
                relative overflow-hidden rounded-3xl border transition-all duration-300
                ${isDone 
                    ? 'bg-emerald-500/10 border-emerald-500/30 opacity-70 cursor-pointer hover:opacity-100 hover:scale-[1.02]' 
                    : 'bg-slate-900 border-white/5 shadow-xl shadow-black/20'
                }
                ${density === 'compact' ? 'p-3' : density === 'slim' ? 'p-4' : 'p-6'}
                flex flex-col gap-4
            `}
        >
            <div className="flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg ${isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        💊
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Dagens Protokoll</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {takenCount} / {totalSupplements} Klara
                    </div>
                    <button 
                        onClick={(e) => onToggle('protocol', e)}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600 hover:bg-slate-700'}`}
                    >
                        ✓
                    </button>
                </div>
            </div>

            {!isDone && (
                <>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-purple-500 transition-all duration-500 ease-out" 
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <div className="space-y-4 z-10 custom-scrollbar max-h-64 overflow-y-auto pr-2">
                        {sortedTimings.map(timing => (
                            <div key={timing} className="space-y-2">
                                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1">{timing}</h4>
                                <div className="space-y-1.5">
                                    {grouped[timing].map(item => {
                                        const isRecipe = item.isRecipe;
                                        const entity = isRecipe ? recipes.find(r => r.id === item.foodItemId) : foodItems.find(f => f.id === item.foodItemId);
                                        if (!entity) return null;
                                        const protocolId = `${item.foodItemId}_${item.timing}`;
                                        const isTaken = supplementsTaken.includes(protocolId);

                                        return (
                                            <div 
                                                key={protocolId} 
                                                onClick={() => onToggleSupplement(protocolId)}
                                                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${isTaken ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800/50 border-white/5 hover:border-purple-500/30 hover:bg-slate-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isTaken ? 'bg-emerald-500 border-emerald-500 text-slate-900' : 'border-slate-600'}`}>
                                                        {isTaken && <span className="text-[10px] font-black">✓</span>}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            {isRecipe && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded font-black uppercase tracking-widest">Recept</span>}
                                                            <span className={`text-xs font-bold transition-colors ${isTaken ? 'text-emerald-400' : 'text-slate-200'}`}>{entity.name}</span>
                                                        </div>
                                                        <span className="text-[9px] text-slate-500 uppercase tracking-wider">{item.dose}</span>
                                                    </div>
                                                </div>
                                                {!isRecipe && (entity as FoodItem).supplementDetails?.purpose && (
                                                    <div className="hidden sm:block text-[9px] font-bold text-purple-400/50 uppercase tracking-widest truncate max-w-[80px]">
                                                        {(entity as FoodItem).supplementDetails!.purpose}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {isDone && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            )}
        </div>
    );
};
