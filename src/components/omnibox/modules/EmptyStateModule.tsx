import React from 'react';
import { getCategoryEmoji } from '../OmniboxConstants.ts';

interface EmptyStateModuleProps {
    input: string;
    recentFoods: any[];
    popularFoods: any[];
    selectableItems: any[];
    selectedIndex: number;
    lockFood: (food: any) => void;
}

export const EmptyStateModule: React.FC<EmptyStateModuleProps> = ({
    input,
    recentFoods,
    popularFoods,
    selectableItems,
    selectedIndex,
    lockFood
}) => {
    return (
        <div className="px-2 py-2">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <span>🕐</span> Senast loggade
                    </div>
                    {recentFoods.map((item, idx) => {
                        const globalIdx = selectableItems.findIndex(sel => sel.itemType === 'recent' && sel.id === item.id);
                        return (
                            <div
                                key={item.id}
                                id={`omnibox-item-${globalIdx}`}
                                onClick={() => lockFood(item)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'hover:bg-white/5 text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-xs flex-shrink-0">
                                        {getCategoryEmoji(item.category)}
                                    </div>
                                    <div className="truncate font-medium text-xs">{item.name}</div>
                                </div>
                                <div className="text-[10px] text-slate-500 flex-shrink-0">
                                    {Math.round(item.calories * item.usageStats.avgGrams / 100)} <span className="opacity-50">kcal</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-1">
                    {popularFoods.length > 0 && (
                        <>
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span>🔥</span> Populärt {(() => {
                                    const lower = input.trim().toLowerCase();
                                    if (lower === 'frukost') return 'Frukost';
                                    if (lower === 'lunch') return 'Lunch';
                                    if (lower === 'middag') return 'Middag';
                                    if (lower === 'kvällsmål') return 'Kvällsmål';
                                    if (lower === 'mellanmål' || lower === 'snack') return 'Mellanmål';

                                    const hour = new Date().getHours();
                                    return (hour >= 5 && hour < 10) ? 'Frukost' :
                                        (hour >= 10 && hour < 14) ? 'Lunch' :
                                            (hour >= 17 && hour < 21) ? 'Middag' : 
                                            (hour >= 21 || hour < 5) ? 'Kvällsmål' : 'Mellanmål';
                                })()}
                            </div>
                            {popularFoods.map((item, idx) => {
                                const globalIdx = selectableItems.findIndex(sel => sel.itemType === 'popular' && sel.id === item.id);
                                return (
                                    <div
                                        key={item.id}
                                        id={`omnibox-item-${globalIdx}`}
                                        onClick={() => lockFood(item)}
                                        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                                            ? 'bg-indigo-500/20 text-indigo-400'
                                            : 'hover:bg-white/5 text-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-xs flex-shrink-0">
                                                {getCategoryEmoji(item.category)}
                                            </div>
                                            <div className="truncate font-medium text-xs">{item.name}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-500 flex-shrink-0">
                                            {item.usageStats.count}x
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
            <div className="px-2 py-1 text-[10px] text-slate-600 text-center mt-2 border-t border-white/5 pt-2">
                ↑↓ navigera • Enter för att logga
            </div>

            <div className="p-4 text-center text-slate-500 text-xs space-y-1 border-t border-white/5">
                <p>🍎 Sök råvaror: "kyckling", "havregryn", "ägg"</p>
                <p>⚖️ Logga vikt: "82.5kg"</p>
                <p>😴 Sömn: "7h sömn"</p>
                <p>🏋️ Träning: "löpning 30 min"</p>
                <p className="text-cyan-500/70">🧭 Navigera: skriv "/" för snabbnavigering</p>
            </div>
        </div>
    );
};
