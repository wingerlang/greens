import { useState, useMemo } from 'react';
import { calculateAverage1RM, calculatePlateLoading } from '../../utils/strengthCalculators.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { getPersonalRecords, PERCENTAGE_MAP } from '../../utils/strengthStatistics.ts';

export function ToolsOneRepMaxPage() {
    const { user } = useAuth();
    const { strengthSessions } = useData();
    const [weight, setWeight] = useState(100);
    const [reps, setReps] = useState(5);

    // Exercise Selection
    const [selectedExercise, setSelectedExercise] = useState<string>('');

    // Extract unique exercises for dropdown
    const availableExercises = useMemo(() => {
        const set = new Set<string>();
        strengthSessions.forEach(s => {
            s.exercises.forEach(e => set.add(e.exerciseName));
        });
        return Array.from(set).sort();
    }, [strengthSessions]);

    // Get Personal Records for selected exercise
    const personalRecords = useMemo(() => {
        if (!selectedExercise) return {};
        return getPersonalRecords(selectedExercise, strengthSessions);
    }, [selectedExercise, strengthSessions]);

    const handleUseMyData = () => {
        // If an exercise is selected, we could try to find the latest lift?
        // For now, let's just use the logic from the old version or user.lastLift
        // The original logic was mocked. Let's make it smart if an exercise is selected.
        if (selectedExercise && personalRecords) {
            // Find the "best" record (highest e1RM)
            const bestRep = Object.values(personalRecords).sort((a, b) => b.e1rm - a.e1rm)[0];
            if (bestRep) {
                setWeight(bestRep.weight);
                setReps(bestRep.reps);
            }
        }
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
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 space-y-6 relative">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Indata</h2>
                        {selectedExercise && (
                            <button
                                type="button"
                                onClick={handleUseMyData}
                                className="text-xs bg-white/5 hover:bg-white/10 text-emerald-400 px-3 py-1.5 rounded-lg font-medium transition-colors border border-emerald-500/20"
                                title="Använd mitt bästa rekord för denna övning"
                            >
                                Hämta bästa
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Exercise Selector */}
                        {user && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Övning (för historik)</label>
                                <select
                                    value={selectedExercise}
                                    onChange={(e) => setSelectedExercise(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">-- Välj övning (Valfritt) --</option>
                                    {availableExercises.map(ex => (
                                        <option key={ex} value={ex}>{ex}</option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                type="button"
                                onClick={() => setTargetWeight(maxResults.average)}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                Lasta detta
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Table - REPLACES OLD PERCENT TABLE */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 overflow-hidden flex flex-col">
                    <h2 className="text-xl font-bold text-white mb-4">Rep Max Tabell</h2>
                    <div className="flex-1 overflow-auto custom-scrollbar -mx-2 px-2">
                        <table className="w-full text-left border-collapse">
                            <thead>
                            <tr className="text-xs text-slate-500 border-b border-white/5">
                                <th className="py-2 px-2 font-medium">Reps</th>
                                <th className="py-2 px-2 font-medium">%</th>
                                <th className="py-2 px-2 font-medium">Vikt</th>
                                {selectedExercise && (
                                    <>
                                        <th className="py-2 px-2 font-medium text-right">Mitt PB</th>
                                        <th className="py-2 px-2 font-medium text-right">e1RM</th>
                                        <th className="py-2 px-2 font-medium text-right">Diff</th>
                                    </>
                                )}
                            </tr>
                            </thead>
                            <tbody className="text-sm">
                            {Array.from({ length: 15 }, (_, i) => i + 1).map(r => {
                                const pct = PERCENTAGE_MAP[r] || 0;
                                const calcWeight = Math.round(maxResults.average * (pct / 100));
                                const isInputRow = r === reps;
                                const myRecord = personalRecords[r];

                                // Diff calculation
                                let diffElem = null;
                                let myE1RM = null;

                                if (myRecord) {
                                    myE1RM = myRecord.e1rm;
                                    const diffVal = myE1RM - maxResults.average;
                                    const diffPct = ((myE1RM - maxResults.average) / maxResults.average) * 100;
                                    const isPositive = diffVal >= 0;

                                    diffElem = (
                                        <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
                                            {isPositive ? '+' : ''}{Math.round(diffPct)}%
                                        </span>
                                    );
                                }

                                return (
                                    <tr
                                        key={r}
                                        className={`
                                            border-b border-white/5 last:border-0 transition-colors
                                            ${isInputRow ? 'bg-emerald-500/10' : 'hover:bg-white/5'}
                                        `}
                                    >
                                        <td className="py-2 px-2 font-bold text-white">{r}</td>
                                        <td className="py-2 px-2 text-slate-400">{pct}%</td>
                                        <td className="py-2 px-2 font-mono text-emerald-400">{calcWeight} kg</td>
                                        {selectedExercise && (
                                            <>
                                                <td className="py-2 px-2 text-right text-white">
                                                    {myRecord ? `${myRecord.weight} kg` : '-'}
                                                </td>
                                                <td className="py-2 px-2 text-right text-slate-400">
                                                    {myE1RM ? `${myE1RM}` : '-'}
                                                </td>
                                                <td className="py-2 px-2 text-right font-medium">
                                                    {diffElem || '-'}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Formulas Breakdown - COMPACT VERSION */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Formler</h2>
                <div className="flex flex-wrap gap-3">
                    <CompactResultCard label="Epley" value={maxResults.epley} />
                    <CompactResultCard label="Brzycki" value={maxResults.brzycki} />
                    <CompactResultCard label="Lander" value={maxResults.lander} />
                    <CompactResultCard label="Lombardi" value={maxResults.lombardi} />
                    <CompactResultCard label="Mayhew" value={maxResults.mayhew} />
                    <CompactResultCard label="O'Conner" value={maxResults.oconner} />
                    <CompactResultCard label="Wathan" value={maxResults.wathan} />
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

function CompactResultCard({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-slate-950 px-4 py-2 rounded-lg border border-white/5 flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase font-bold">{label}:</span>
            <span className="text-sm font-bold text-white">{value}</span>
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
