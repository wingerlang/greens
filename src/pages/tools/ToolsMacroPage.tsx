import React, { useState } from 'react';
import { calculateMacros } from '../../utils/healthCalculators.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export function ToolsMacroPage() {
    const { user } = useAuth();
    const [calories, setCalories] = useState(2500);
    const [dietType, setDietType] = useState('balanced');

    // Diet Presets (P/C/F)
    const diets: Record<string, { label: string, p: number, c: number, f: number, desc: string }> = {
        'balanced': { label: 'Balanserad', p: 30, c: 40, f: 30, desc: 'En jämn fördelning för allmän hälsa.' },
        'high_protein': { label: 'Hög Protein', p: 40, c: 35, f: 25, desc: 'Bra för muskelbyggnad och mättnad.' },
        'zone': { label: 'Zone', p: 30, c: 40, f: 30, desc: 'Balans för hormonell kontroll.' },
        'low_carb': { label: 'Lågkolhydrat', p: 40, c: 20, f: 40, desc: 'För de som är känsliga för kolhydrater.' },
        'keto': { label: 'Ketogen', p: 20, c: 5, f: 75, desc: 'Extremt lågt kolhydratintag för ketos.' },
    };

    const currentDiet = diets[dietType];
    const macros = calculateMacros(calories, currentDiet);

    const handleUseMyData = () => {
        // Mock fetch user TDEE/Goal calories
        // setCalories(user?.targetCalories || 2500);
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Makrofördelning</h1>
                <p className="text-slate-400">Räkna ut hur många gram du behöver av varje makroämne.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit relative">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Inställningar</h2>
                        <button
                            onClick={handleUseMyData}
                            className="text-xs bg-white/5 hover:bg-white/10 text-emerald-400 px-3 py-1.5 rounded-lg font-medium transition-colors border border-emerald-500/20"
                            title="Hämta kalorimål från din profil"
                        >
                            Hämta min data
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Dagligt kalorimål</label>
                            <input
                                type="number"
                                value={calories}
                                onChange={(e) => setCalories(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Kostupplägg</label>
                            <div className="grid gap-2">
                                {Object.entries(diets).map(([key, diet]) => (
                                    <button
                                        key={key}
                                        onClick={() => setDietType(key)}
                                        className={`flex flex-col text-left p-3 rounded-xl border transition-all ${dietType === key
                                            ? 'bg-emerald-500/10 border-emerald-500/50'
                                            : 'bg-slate-950 border-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="flex justify-between items-center w-full mb-1">
                                            <span className={`font-bold ${dietType === key ? 'text-emerald-400' : 'text-white'}`}>
                                                {diet.label}
                                            </span>
                                            <span className="text-xs font-mono text-slate-500">
                                                {diet.p}/{diet.c}/{diet.f}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500">{diet.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6">Resultat</h2>

                    <div className="space-y-6">
                        <div className="flex justify-center py-8">
                             {/* Simple CSS Pie Chart visualization or Bars */}
                             <div className="flex items-end gap-4 h-48 w-full max-w-xs mx-auto">
                                <MacroBar label="Protein" grams={macros.protein} color="bg-emerald-500" total={macros.protein + macros.carbs + macros.fat} />
                                <MacroBar label="Kolhydrater" grams={macros.carbs} color="bg-amber-500" total={macros.protein + macros.carbs + macros.fat} />
                                <MacroBar label="Fett" grams={macros.fat} color="bg-rose-500" total={macros.protein + macros.carbs + macros.fat} />
                             </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <MacroCard label="Protein" value={macros.protein} cal={macros.protein * 4} color="text-emerald-400" />
                            <MacroCard label="Kolhydrater" value={macros.carbs} cal={macros.carbs * 4} color="text-amber-400" />
                            <MacroCard label="Fett" value={macros.fat} cal={macros.fat * 9} color="text-rose-400" />
                        </div>

                        <div className="bg-slate-950 rounded-xl p-4 border border-white/5 text-center">
                             <div className="text-xs text-slate-500 mb-1">TOTALT</div>
                             <div className="text-2xl font-bold text-white">{calories} kcal</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MacroBar({ label, grams, color, total }: { label: string, grams: number, color: string, total: number }) {
    // Normalizing height visually (approximate)
    // Max reasonable grams usually 300-400. Let's cap at 400 for 100% height
    const heightPct = Math.min(100, (grams / 400) * 100);

    return (
        <div className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
            <div className="text-xs font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-auto">{label}</div>
            <div className="text-sm font-bold text-white">{grams}g</div>
            <div className={`w-full rounded-t-lg transition-all duration-500 ${color}`} style={{ height: `${Math.max(5, heightPct)}%` }}></div>
        </div>
    );
}

function MacroCard({ label, value, cal, color }: { label: string, value: number, cal: number, color: string }) {
    return (
        <div className="bg-slate-950 p-3 rounded-xl border border-white/5 text-center">
            <div className={`text-sm font-bold mb-1 ${color}`}>{label}</div>
            <div className="text-2xl font-bold text-white mb-1">{value}g</div>
            <div className="text-xs text-slate-500">{cal} kcal</div>
        </div>
    );
}
