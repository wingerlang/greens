import React from 'react';
import { Modal } from '../common/Modal.tsx';
import { FoodItem, FoodCategory, Unit } from '../../models/types.ts';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface FoodItemDetailModalProps {
    item: FoodItem;
    onClose: () => void;
    frequency?: number;
    categoryLabels: Record<string, string>;
    unitLabels: Record<string, string>;
    creatorName: string;
}

export const FoodItemDetailModal: React.FC<FoodItemDetailModalProps> = ({
    item,
    onClose,
    frequency = 0,
    categoryLabels,
    unitLabels,
    creatorName
}) => {
    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'd MMM yyyy', { locale: sv });
        } catch (e) {
            return dateStr;
        }
    };

    const getImgSrc = (url: string) => {
        if (url.startsWith('http')) return url;
        return `/api/files/${url}`;
    };

    // Calculate macro percentages for visualization
    const totalMacros = item.protein + item.carbs + item.fat;
    const proteinPct = totalMacros > 0 ? (item.protein / totalMacros) * 100 : 0;
    const carbsPct = totalMacros > 0 ? (item.carbs / totalMacros) * 100 : 0;
    const fatPct = totalMacros > 0 ? (item.fat / totalMacros) * 100 : 0;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={item.name}
        >
            <div className="space-y-8">
                {/* Header Image & Basic Info */}
                <div className="relative group overflow-hidden rounded-2xl border border-white/5 bg-slate-800/50">
                    {item.imageUrl ? (
                        <div className="w-full h-56 relative">
                            <img
                                src={getImgSrc(item.imageUrl)}
                                alt={item.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 to-transparent" />
                        </div>
                    ) : (
                        <div className="w-full h-40 flex items-center justify-center bg-slate-800/50">
                            <span className="text-4xl opacity-20">🥗</span>
                        </div>
                    )}

                    <div className="absolute top-4 left-4 flex gap-2">
                        <span className="px-3 py-1 bg-emerald-500 text-slate-900 text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                            {categoryLabels[item.category] || item.category}
                        </span>
                        {item.isCooked && (
                            <span className="px-3 py-1 bg-amber-500 text-slate-900 text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                                Tillagad
                            </span>
                        )}
                    </div>
                </div>

                {/* Nutrition Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <NutritionCard
                        label="Kalorier"
                        value={Math.round(item.calories)}
                        unit="kcal"
                        icon="🔥"
                        color="text-emerald-400"
                        bgColor="bg-emerald-500/10"
                    />
                    <NutritionCard
                        label="Protein"
                        value={item.protein}
                        unit="g"
                        icon="💪"
                        color="text-blue-400"
                        bgColor="bg-blue-500/10"
                    />
                    <NutritionCard
                        label="Kolhydrater"
                        value={item.carbs}
                        unit="g"
                        icon="🥖"
                        color="text-amber-400"
                        bgColor="bg-amber-500/10"
                    />
                    <NutritionCard
                        label="Fett"
                        value={item.fat}
                        unit="g"
                        icon="🥑"
                        color="text-rose-400"
                        bgColor="bg-rose-500/10"
                    />
                </div>

                {/* Macro Distribution Bar */}
                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Macrofördelning</h3>
                        <span className="text-[10px] text-slate-500 font-mono italic">per 100g</span>
                    </div>
                    <div className="h-4 w-full flex rounded-full overflow-hidden bg-slate-800 border border-white/5 shadow-inner">
                        <div
                            style={{ width: `${proteinPct}%` }}
                            className="bg-blue-500 transition-all duration-1000 ease-out"
                            title={`Protein: ${proteinPct.toFixed(1)}%`}
                        />
                        <div
                            style={{ width: `${carbsPct}%` }}
                            className="bg-amber-500 transition-all duration-1000 ease-out"
                            title={`Kolhydrater: ${carbsPct.toFixed(1)}%`}
                        />
                        <div
                            style={{ width: `${fatPct}%` }}
                            className="bg-rose-500 transition-all duration-1000 ease-out"
                            title={`Fett: ${fatPct.toFixed(1)}%`}
                        />
                    </div>
                    <div className="flex gap-4 text-[10px] font-bold uppercase tracking-tighter">
                        <div className="flex items-center gap-1.5 text-blue-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Protein {proteinPct.toFixed(0)}%
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Kolh. {carbsPct.toFixed(0)}%
                        </div>
                        <div className="flex items-center gap-1.5 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Fett {fatPct.toFixed(0)}%
                        </div>
                    </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                    <MetaItem
                        label="Skapad av"
                        value={creatorName}
                        icon="👤"
                    />
                    <MetaItem
                        label="Skapad datum"
                        value={formatDate(item.createdAt)}
                        icon="📅"
                    />
                    <MetaItem
                        label="Användning"
                        value={`${frequency} gånger`}
                        icon="📈"
                        highlight
                    />
                </div>

                {/* Additional Details */}
                {(item.ingredients || item.brand || item.containsGluten) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
                        {item.ingredients && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <span>🧪</span> Ingredienser
                                </h3>
                                <p className="text-sm text-slate-300 leading-relaxed bg-slate-800/30 p-4 rounded-xl border border-white/5 italic">
                                    {item.ingredients}
                                </p>
                            </div>
                        )}
                        <div className="space-y-4">
                            {item.brand && (
                                <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Märke</span>
                                    <p className="text-lg font-black text-white">{item.brand}</p>
                                </div>
                            )}
                            {item.containsGluten !== undefined && (
                                <div className={`p-4 rounded-xl border flex items-center justify-between ${item.containsGluten ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                    <span className="text-xs font-bold uppercase tracking-wider">Glutenfri</span>
                                    <span className="font-black">{item.containsGluten ? 'NEJ ❌' : 'JA ✅'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const NutritionCard: React.FC<{ label: string, value: number, unit: string, icon: string, color: string, bgColor: string }> = ({
    label, value, unit, icon, color, bgColor
}) => (
    <div className={`${bgColor} border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-1 transition-transform hover:scale-105`}>
        <span className="text-lg">{icon}</span>
        <div className="flex flex-col items-center">
            <span className={`text-2xl font-black ${color}`}>{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{unit}</span>
        </div>
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">{label}</span>
    </div>
);

const MetaItem: React.FC<{ label: string, value: string, icon: string, highlight?: boolean }> = ({
    label, value, icon, highlight
}) => (
    <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-xl border border-white/5">
            {icon}
        </div>
        <div>
            <span className="block text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">{label}</span>
            <span className={`text-sm font-bold ${highlight ? 'text-emerald-400' : 'text-slate-200'}`}>{value}</span>
        </div>
    </div>
);
