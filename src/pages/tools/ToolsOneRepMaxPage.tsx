import React, { useState, useMemo } from 'react';
import { calculateAverage1RM, calculatePlateLoading, type Plate } from '../../utils/strengthCalculators.ts';
import { analyzeStrengthHistory } from '../../utils/strengthAnalysis.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useHealth } from '../../hooks/useHealth.ts';

export function ToolsOneRepMaxPage() {
    const { user } = useAuth();
    const { strengthSessions } = useHealth();

    // Core Calculator State
    const [weight, setWeight] = useState(100);
    const [reps, setReps] = useState(5);

    // Plate Loader State
    const [targetWeight, setTargetWeight] = useState(100);
    const [barWeight, setBarWeight] = useState(20);

    // Analysis State
    const [selectedExercise, setSelectedExercise] = useState('Squat');
    const [showAnalysis, setShowAnalysis] = useState(false);

    // Calculations
    const maxResults = calculateAverage1RM(weight, reps);
    const loadingResult = calculatePlateLoading(targetWeight, barWeight);

    // Analysis Logic
    const analysis = useMemo(() => {
        if (!strengthSessions || strengthSessions.length === 0) return null;
        return analyzeStrengthHistory(strengthSessions, selectedExercise);
    }, [strengthSessions, selectedExercise]);

    const commonExercises = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Pull Up', 'Dips'];

    const handleUseStats = (w: number, r: number) => {
        setWeight(w);
        setReps(r);
        setTargetWeight(calculateAverage1RM(w, r).average);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">1RM Kalkylator</h1>
                <p className="text-slate-400">Beräkna ditt max och se hur du ska lasta stången.</p>
            </div>

            {/* Analysis Section (Logged in users only) */}
            {user && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="text-2xl">📈</span> Din Träningsdata
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">Baserat på dina loggade styrkepass.</p>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
                                {commonExercises.map(ex => (
                                    <button
                                        key={ex}
                                        onClick={() => setSelectedExercise(ex)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                                            selectedExercise === ex
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                        }`}
                                    >
                                        {ex}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {analysis && analysis.totalWorkouts > 0 ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <StatCard
                                        label="Bästa Est. 1RM"
                                        value={`${Math.round(analysis.allTimeBest1RM?.estimated1RM || 0)} kg`}
                                        sub={`${analysis.allTimeBest1RM?.weight}kg x ${analysis.allTimeBest1RM?.reps}`}
                                        color="text-emerald-400"
                                    />
                                    <StatCard
                                        label="Senaste 3 mån"
                                        value={`${Math.round(analysis.recentBest1RM?.estimated1RM || 0)} kg`}
                                        sub={analysis.recentBest1RM ? `${analysis.recentBest1RM.weight}kg x ${analysis.recentBest1RM.reps}` : '-'}
                                        color="text-blue-400"
                                    />
                                    <StatCard label="Antal Pass" value={analysis.totalWorkouts} color="text-white" />
                                    <StatCard label="Totala Set" value={analysis.totalSets} color="text-slate-400" />
                                </div>

                                <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Prestationskurva (Bästa set)</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="text-xs text-slate-500 border-b border-white/5">
                                                    <th className="pb-2 pl-2">Reps</th>
                                                    <th className="pb-2">Vikt</th>
                                                    <th className="pb-2">Est. 1RM</th>
                                                    <th className="pb-2 text-right">Datum</th>
                                                    <th className="pb-2"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(r => {
                                                    const stat = analysis.bestRepMaxes[r];
                                                    if (!stat) return null;
                                                    const isBest = stat.estimated1RM === analysis.allTimeBest1RM?.estimated1RM;

                                                    return (
                                                        <tr key={r} className={`group hover:bg-white/5 transition-colors ${isBest ? 'bg-emerald-500/5' : ''}`}>
                                                            <td className="py-2 pl-2 font-bold text-white">{r}</td>
                                                            <td className="py-2 text-slate-300">{stat.weight} kg</td>
                                                            <td className={`py-2 font-mono font-bold ${isBest ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                                {Math.round(stat.estimated1RM)} kg
                                                            </td>
                                                            <td className="py-2 text-right text-xs text-slate-500">{stat.date}</td>
                                                            <td className="py-2 text-right pr-2">
                                                                <button
                                                                    onClick={() => handleUseStats(stat.weight, stat.reps)}
                                                                    className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    Använd
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-slate-950/30 rounded-2xl border border-white/5 border-dashed">
                                <div className="text-2xl mb-2">🤷‍♂️</div>
                                <div className="text-slate-400 font-medium">Ingen data hittades för {selectedExercise}</div>
                                <div className="text-xs text-slate-600 mt-1">Logga pass med exakt detta namn för att se statistik.</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Calculator */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 space-y-6">
                    <h2 className="text-xl font-bold text-white">Kalkylator</h2>

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
                                <div className="text-sm text-slate-500 font-medium mb-1">UPPSKATTAT MAX (1RM)</div>
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
                    <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {[100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map(pct => (
                            <div key={pct} className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className={`text-sm font-bold ${pct >= 90 ? 'text-white' : 'text-slate-400'}`}>{pct}%</span>
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

function StatCard({ label, value, sub, color }: { label: string, value: number | string, sub?: string, color: string }) {
    return (
        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
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
