import React, { useState } from 'react';
import { calculateWilks, calculateIPFPoints } from '../../utils/strengthCalculators.ts';

export function ToolsStrengthStandardsPage() {
    const [weight, setWeight] = useState(80);
    const [total, setTotal] = useState(400); // Total of SBD
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [unit, setUnit] = useState<'wilks' | 'ipf'>('ipf');

    const score = unit === 'wilks'
        ? calculateWilks(weight, total, gender)
        : calculateIPFPoints(weight, total, gender);

    // Rough classification logic (Arbitrary but standard-ish ranges)
    const getLevel = (s: number, type: 'wilks' | 'ipf') => {
        if (type === 'wilks') {
            if (s < 200) return { label: 'Nybörjare', color: 'text-slate-400' };
            if (s < 300) return { label: 'Motionär', color: 'text-emerald-400' };
            if (s < 400) return { label: 'Avancerad', color: 'text-blue-400' };
            if (s < 500) return { label: 'Elit', color: 'text-amber-400' };
            return { label: 'Världsklass', color: 'text-rose-400' };
        } else {
            // IPF GL Points approx ranges
            if (s < 40) return { label: 'Nybörjare', color: 'text-slate-400' };
            if (s < 60) return { label: 'Motionär', color: 'text-emerald-400' };
            if (s < 80) return { label: 'Avancerad', color: 'text-blue-400' };
            if (s < 100) return { label: 'Elit', color: 'text-amber-400' };
            return { label: 'Världsklass', color: 'text-rose-400' };
        }
    };

    const level = getLevel(score, unit);

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Styrkestandard</h1>
                <p className="text-slate-400">Jämför din styrka oberoende av kroppsvikt (Wilks & IPF GL).</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit">
                    <h2 className="text-xl font-bold text-white mb-6">Dina lyft</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Totalvikt (kg)</label>
                            <input
                                type="number"
                                value={total}
                                onChange={(e) => setTotal(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="Summan av Böj, Bänk, Mark"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Kroppsvikt (kg)</label>
                            <input
                                type="number"
                                value={weight}
                                onChange={(e) => setWeight(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Kön</label>
                                <div className="flex bg-slate-950 rounded-xl border border-white/10 p-1">
                                    <button
                                        onClick={() => setGender('male')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'male' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Man
                                    </button>
                                    <button
                                        onClick={() => setGender('female')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'female' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Kvinna
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Formel</label>
                                <div className="flex bg-slate-950 rounded-xl border border-white/10 p-1">
                                    <button
                                        onClick={() => setUnit('ipf')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${unit === 'ipf' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        IPF
                                    </button>
                                    <button
                                        onClick={() => setUnit('wilks')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${unit === 'wilks' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Wilks
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 flex flex-col justify-center text-center">
                    <div className="mb-8">
                        <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">{unit === 'ipf' ? 'IPF GL POÄNG' : 'WILKS POÄNG'}</div>
                        <div className="text-6xl font-bold text-white mb-2">{score.toFixed(1)}</div>
                    </div>

                    <div className="border-t border-white/5 pt-8">
                        <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">NIVÅ</div>
                        <div className={`text-4xl font-bold ${level.color}`}>{level.label}</div>
                        <div className="text-xs text-slate-500 mt-2">
                            {unit === 'ipf' ? 'International Powerlifting Federation (2020)' : 'Wilks Coefficient (Legacy)'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
