import React, { useState } from 'react';
import { calculateAverage1RM, calculatePlateLoading, type Plate } from '../../utils/strengthCalculators.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export function ToolsOneRepMaxPage() {
    const { user } = useAuth();
    const [weight, setWeight] = useState(100);
    const [reps, setReps] = useState(5);

    const handleUseMyData = () => {
        // Mock data fetch for last lift
        // setWeight(user.lastLift || 100);
    };

    // Plate Loader State
    const [targetWeight, setTargetWeight] = useState(100);
    const [barWeight, setBarWeight] = useState(20);

    const maxResults = calculateAverage1RM(weight, reps);
    const loadingResult = calculatePlateLoading(targetWeight, barWeight);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">1RM Kalkylator</h1>
                <p className="text-slate-400">Beräkna ditt max och se hur du ska lasta stången.</p>
            </div>

            {/* Main Calculator */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 space-y-6 relative">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Indata</h2>
                        <button
                            onClick={handleUseMyData}
                            className="text-xs bg-white/5 hover:bg-white/10 text-emerald-400 px-3 py-1.5 rounded-lg font-medium transition-colors border border-emerald-500/20"
                            title="Hämta senaste pass"
                        >
                            Hämta min data
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Vikt (kg)</label>
                            <input
                                type="number"
                                value={weight}
                                onChange={(e) => setWeight(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Reps</label>
                            <input
                                type="number"
                                value={reps}
                                onChange={(e) => setReps(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <div className="text-sm text-slate-500 font-medium mb-1">DITT UPPSKATTADE MAX</div>
                                <div className="text-4xl font-bold text-emerald-400">{maxResults.average} kg</div>
                            </div>
                            <button
                                onClick={() => setTargetWeight(maxResults.average)}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                Lasta detta
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Procenttabell</h2>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {[100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map(pct => (
                            <div key={pct} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                                <span className={`font-bold ${pct >= 90 ? 'text-white' : 'text-slate-400'}`}>{pct}%</span>
                                <span className="font-mono text-emerald-400">{Math.round(maxResults.average * (pct / 100))} kg</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Formulas Breakdown */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Formler</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ResultCard label="Epley" value={maxResults.epley} />
                    <ResultCard label="Brzycki" value={maxResults.brzycki} />
                    <ResultCard label="Lander" value={maxResults.lander} />
                    <ResultCard label="Lombardi" value={maxResults.lombardi} />
                    <ResultCard label="Mayhew" value={maxResults.mayhew} />
                    <ResultCard label="O'Conner" value={maxResults.oconner} />
                    <ResultCard label="Wathan" value={maxResults.wathan} />
                </div>
            </div>

            {/* Plate Loader */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">Skivstångslastare</h2>
                <div className="grid md:grid-cols-3 gap-8">
                    <div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Målvikt (kg)</label>
                                <input
                                    type="number"
                                    value={targetWeight}
                                    onChange={(e) => setTargetWeight(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Stångvikt (kg)</label>
                                <select
                                    value={barWeight}
                                    onChange={(e) => setBarWeight(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value={20}>20 kg (Herr)</option>
                                    <option value={15}>15 kg (Dam)</option>
                                    <option value={10}>10 kg (Teknik)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col justify-center items-center bg-slate-950 rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center gap-1 mb-8 overflow-x-auto w-full justify-center px-4">
                            {/* Bar End */}
                            <div className="h-6 w-12 bg-slate-600 rounded-l-md border-r-2 border-slate-700 shadow-lg"></div>

                            {/* Plates */}
                            {loadingResult.plates.length > 0 ? (
                                loadingResult.plates.flatMap((plate) =>
                                    Array(plate.count).fill(plate)
                                ).map((plate, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-1 group relative">
                                        <div
                                            className={`
                                                ${getPlateHeight(plate.weight)}
                                                w-8 md:w-10 rounded-sm border border-black/20 shadow-xl
                                                flex items-center justify-center text-[10px] font-bold text-white/90
                                                transition-transform hover:-translate-y-1
                                                ${getPlateColor(plate.weight)}
                                            `}
                                        >
                                            <span className="rotate-90 whitespace-nowrap">{plate.weight}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-slate-500 text-sm font-medium italic px-4">Tom stång</div>
                            )}

                            {/* Bar Center */}
                            <div className="h-4 w-full min-w-[50px] bg-slate-700"></div>
                        </div>

                        <div className="flex gap-8 text-center">
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Per sida</div>
                                <div className="text-2xl font-bold text-white">
                                    {loadingResult.plates.reduce((acc, p) => acc + p.weight * p.count, 0)} kg
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Totalt</div>
                                <div className="text-2xl font-bold text-emerald-400">{targetWeight} kg</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ResultCard({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="text-lg font-bold text-white">{value} kg</div>
        </div>
    );
}

function getPlateColor(weight: number): string {
    if (weight >= 25) return 'bg-red-600';
    if (weight >= 20) return 'bg-blue-600';
    if (weight >= 15) return 'bg-yellow-500';
    if (weight >= 10) return 'bg-emerald-600';
    if (weight >= 5) return 'bg-white text-slate-900';
    if (weight >= 2.5) return 'bg-slate-800'; // Blackish for small plates usually
    return 'bg-slate-500';
}

function getPlateHeight(weight: number): string {
    if (weight >= 20) return 'h-48';
    if (weight >= 15) return 'h-40';
    if (weight >= 10) return 'h-32';
    if (weight >= 5) return 'h-24';
    return 'h-16';
}
