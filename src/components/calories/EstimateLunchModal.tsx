import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Flame, AlertCircle } from 'lucide-react';

interface EstimateDetails {
    name: string;
    caloriesMin: number;
    caloriesMax: number;
    caloriesAvg: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    uncertaintyEmoji?: string;
}

interface EstimateLunchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (details: EstimateDetails) => void;
}

export function EstimateLunchModal({ isOpen, onClose, onSave }: EstimateLunchModalProps) {
    const [name, setName] = useState('Utelunch');
    const [kcalMin, setKcalMin] = useState<string>('600');
    const [kcalMax, setKcalMax] = useState<string>('900');
    const [protein, setProtein] = useState<string>('');
    const [carbs, setCarbs] = useState<string>('');
    const [fat, setFat] = useState<string>('');
    const [isUncertain, setIsUncertain] = useState(true);

    const handleSave = () => {
        const min = parseInt(kcalMin) || 0;
        const max = parseInt(kcalMax) || min;
        const avg = Math.round((min + max) / 2);

        onSave({
            name: name || 'Lunch-estimering',
            caloriesMin: min,
            caloriesMax: max,
            caloriesAvg: avg,
            protein: protein ? parseFloat(protein) : undefined,
            carbs: carbs ? parseFloat(carbs) : undefined,
            fat: fat ? parseFloat(fat) : undefined,
            uncertaintyEmoji: isUncertain ? '🤷❓' : undefined
        });
        onClose();
        // Reset state
        setName('Utelunch');
        setKcalMin('600');
        setKcalMax('900');
        setProtein('');
        setCarbs('');
        setFat('');
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Snabbregistrera Estimering 🤷">
            <div className="space-y-6">
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 text-amber-200/80 text-sm">
                    <AlertCircle className="shrink-0" size={18} />
                    <p>Använd detta när du äter ute och inte har exakta råvaror. Systemet räknar på medelvärdet av ditt intervall.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Vad åt du?</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="T.ex. Vegansk buffé"
                            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Kcal (Min)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={kcalMin}
                                    onChange={(e) => setKcalMin(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 pl-10"
                                />
                                <Flame className="absolute left-3 top-3.5 text-slate-500" size={16} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Kcal (Max)</label>
                            <input
                                type="number"
                                value={kcalMax}
                                onChange={(e) => setKcalMax(e.target.value)}
                                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Macros (Optionellt)</h4>
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsUncertain(!isUncertain)}>
                                <span className="text-[10px] text-slate-500">Stor osäkerhet?</span>
                                <div
                                    className={`w-10 h-5 rounded-full relative transition-colors ${isUncertain ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isUncertain ? 'left-6' : 'left-1'}`} />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[9px] font-bold text-rose-400/70 uppercase mb-1">Protein</label>
                                <input
                                    type="number"
                                    value={protein}
                                    onChange={(e) => setProtein(e.target.value)}
                                    placeholder="g"
                                    className="w-full bg-slate-900 border border-white/5 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-rose-500/30"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-indigo-400/70 uppercase mb-1">Kolhydrater</label>
                                <input
                                    type="number"
                                    value={carbs}
                                    onChange={(e) => setCarbs(e.target.value)}
                                    placeholder="g"
                                    className="w-full bg-slate-900 border border-white/5 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/30"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-orange-400/70 uppercase mb-1">Fett</label>
                                <input
                                    type="number"
                                    value={fat}
                                    onChange={(e) => setFat(e.target.value)}
                                    placeholder="g"
                                    className="w-full bg-slate-900 border border-white/5 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-orange-500/30"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-[2] px-4 py-3 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-wider hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        Spara Estimering 🤷
                    </button>
                </div>
            </div>
        </Modal>
    );
}
