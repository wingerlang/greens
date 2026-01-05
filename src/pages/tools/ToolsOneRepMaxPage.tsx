import { useState, useMemo, useEffect } from 'react';
import { calculateAverage1RM, calculatePlateLoading } from '../../utils/strengthCalculators.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { getPersonalRecords, PERCENTAGE_MAP } from '../../utils/strengthStatistics.ts';
import { Search, X, Dumbbell, ChevronRight, Info } from 'lucide-react';

export function ToolsOneRepMaxPage() {
    const { user } = useAuth();
    const { strengthSessions } = useData();
    const [weight, setWeight] = useState(100);
    const [reps, setReps] = useState(5);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Exercise Selection
    const [selectedExercise, setSelectedExercise] = useState<string>('');

    // Extract unique exercises and sort by frequency
    const exerciseStats = useMemo(() => {
        const stats: Record<string, number> = {};
        strengthSessions.forEach(s => {
            if (!s.exercises) return;
            s.exercises.forEach(e => {
                const name = e.exerciseName;
                if (name) stats[name] = (stats[name] || 0) + 1;
            });
        });
        return Object.entries(stats)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([name, count]) => ({ name, count }));
    }, [strengthSessions]);

    // Filter exercises based on search term
    const filteredExercises = useMemo(() => {
        if (!searchTerm) return exerciseStats;
        return exerciseStats.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [exerciseStats, searchTerm]);

    // Get Personal Records for selected exercise
    const personalRecords = useMemo(() => {
        if (!selectedExercise) return {};
        // Use exact match for now
        return getPersonalRecords(selectedExercise, strengthSessions);
    }, [selectedExercise, strengthSessions]);

    // "Smart" Personal Records - Infer strength from higher reps
    const smartPersonalRecords = useMemo(() => {
        const STANDARD_REPS = [1, 2, 5, 8, 10, 12, 15];
        const prValues = Object.values(personalRecords);
        const records = new Map(prValues.map(pr => [pr.reps, pr]));
        // Store inferred records
        const inferred: Record<number, { weight: number, source: { weight: number, reps: number }, e1rm: number, inferred: boolean }> = {};

        STANDARD_REPS.forEach(targetRep => {
            if (records.has(targetRep)) return;

            // Find best source: heaviest weight lifted for reps > targetRep determines potential
            let bestSource = { weight: 0, reps: 0 };

            prValues.forEach(pr => {
                if (pr.reps > targetRep) {
                    if (pr.weight > bestSource.weight) {
                        bestSource = { weight: pr.weight, reps: pr.reps };
                    }
                }
            });

            if (bestSource.weight > 0) {
                inferred[targetRep] = {
                    weight: bestSource.weight,
                    source: bestSource,
                    e1rm: calculateAverage1RM(bestSource.weight, bestSource.reps).average,
                    inferred: true
                };
            }
        });
        return inferred;
    }, [personalRecords]);

    // Auto-populate when exercise changes
    useEffect(() => {
        if (selectedExercise) {
            // Check actual records first, then inferred
            const prValues = Object.values(personalRecords);
            const allRecords = [
                ...prValues.map(pr => ({ ...pr, e1rm: calculateAverage1RM(pr.weight, pr.reps).average, inferred: false })),
                ...Object.entries(smartPersonalRecords).map(([reps, data]) => ({ reps: Number(reps), ...data }))
            ];

            if (allRecords.length > 0) {
                const bestEntry = allRecords.sort((a, b) => b.e1rm - a.e1rm)[0];
                if (bestEntry) {
                    setWeight(bestEntry.weight);
                    setReps(bestEntry.reps);
                }
            }
        }
    }, [selectedExercise, smartPersonalRecords, personalRecords]);

    // Escape key listener for modal
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsModalOpen(false);
        };
        if (isModalOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isModalOpen]);

    // Plate Loader State
    const [targetWeight, setTargetWeight] = useState(100);
    const [barWeight, setBarWeight] = useState(20);

    const maxResults = calculateAverage1RM(weight, reps);
    const loadingResult = calculatePlateLoading(targetWeight, barWeight);

    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate table rows dynamically
    // RowItem now includes both formula-derived weight AND PB weight
    const tableRows = useMemo(() => {
        const STANDARD_REPS = [1, 2, 5, 8, 10, 12, 15];
        type RowItem = {
            reps: number;
            formulaWeight: number; // Weight derived from formula input
            pbWeight: number | null; // User's actual PB weight (if exists)
            e1rm: number;
            type: 'actual' | 'inferred' | 'calculated';
            source?: { weight: number, reps: number }
        };
        const rows: RowItem[] = [];
        const prValues = Object.values(personalRecords);

        // 1. Standard Reps - ALWAYS show, with both formula weight and PB
        STANDARD_REPS.forEach(r => {
            // Calculate formula-derived weight for this rep count
            const formulaWeight = Math.round(maxResults.average / (1 + r / 30));

            // Check for actual PB
            const actual = personalRecords[r];
            if (actual) {
                rows.push({
                    reps: r,
                    formulaWeight,
                    pbWeight: actual.weight,
                    type: 'actual',
                    e1rm: calculateAverage1RM(actual.weight, actual.reps).average
                });
                return;
            }

            // Check for inferred PB
            const inf = smartPersonalRecords[r];
            if (inf) {
                rows.push({
                    reps: r,
                    formulaWeight,
                    pbWeight: inf.weight,
                    type: 'inferred',
                    e1rm: inf.e1rm,
                    source: inf.source
                });
                return;
            }

            // No PB - show calculated only
            rows.push({
                reps: r,
                formulaWeight,
                pbWeight: null,
                type: 'calculated',
                e1rm: Math.round(formulaWeight * (1 + r / 30))
            });
        });

        // 2. High Reps (> 15) - From actual PBs
        const highReps = prValues.filter(pr => pr.reps > 15).sort((a, b) => a.reps - b.reps);

        const addHighRepRow = (pr: { reps: number, weight: number }) => {
            if (!rows.some(row => row.reps === pr.reps)) {
                const formulaWeight = Math.round(maxResults.average / (1 + pr.reps / 30));
                const e1rm = calculateAverage1RM(pr.weight, pr.reps).average;
                rows.push({ reps: pr.reps, formulaWeight, pbWeight: pr.weight, e1rm, type: 'actual' });
            }
        };

        if (isExpanded) {
            // Show ALL high reps
            highReps.forEach(addHighRepRow);
        } else {
            // Show Max + up to 4 others (prefer even)
            if (highReps.length > 0) {
                const maxRepObj = highReps[highReps.length - 1];
                const others = highReps.slice(0, -1);

                const evens = others.filter(r => r.reps % 2 === 0);
                const odds = others.filter(r => r.reps % 2 !== 0);

                let selected = [...evens].slice(-4);
                if (selected.length < 4) {
                    selected = [...selected, ...odds.slice(-(4 - selected.length))].sort((a, b) => a.reps - b.reps);
                }

                [...selected, maxRepObj].forEach(addHighRepRow);
            }
        }

        // 3. Intermediate Reps (e.g. 3, 4, 6, 7, 9, 11, 13, 14) - Only if Expanded
        if (isExpanded) {
            prValues.forEach(pr => {
                if (pr.reps <= 15 && !STANDARD_REPS.includes(pr.reps)) {
                    if (!rows.some(row => row.reps === pr.reps)) {
                        const formulaWeight = Math.round(maxResults.average / (1 + pr.reps / 30));
                        const e1rm = calculateAverage1RM(pr.weight, pr.reps).average;
                        rows.push({ reps: pr.reps, formulaWeight, pbWeight: pr.weight, e1rm, type: 'actual' });
                    }
                }
            });
        }

        return rows.sort((a, b) => a.reps - b.reps);
    }, [smartPersonalRecords, personalRecords, isExpanded, maxResults.average]);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">1RM Kalkylator</h1>
                <p className="text-slate-400">Beräkna ditt max och se hur du ska lasta stången.</p>
            </div>

            {/* Main Calculator */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 space-y-6 relative h-fit">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Indata & Formler</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Exercise Selector Button */}
                        {user && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Övning</label>
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setIsModalOpen(true);
                                    }}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-left text-white hover:bg-slate-800 transition-colors flex items-center justify-between group"
                                >
                                    <span className={selectedExercise ? 'text-white font-medium' : 'text-slate-500'}>
                                        {selectedExercise || 'Välj övning för historik...'}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Vikt (kg)</label>
                                <input
                                    type="number"
                                    value={weight}
                                    onChange={(e) => setWeight(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Reps</label>
                                <input
                                    type="number"
                                    value={reps}
                                    onChange={(e) => setReps(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-lg"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="flex items-end gap-2 mb-6">
                            <div className="flex-1">
                                <div className="text-sm text-slate-500 font-medium mb-1">DITT UPPSKATTADE MAX</div>
                                <div className="text-5xl font-black text-emerald-400 tracking-tight">{maxResults.average} <span className="text-2xl font-bold text-emerald-500/50">kg</span></div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTargetWeight(maxResults.average)}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold transition-colors border border-emerald-500/20"
                            >
                                Lasta detta
                            </button>
                        </div>

                        {/* Moved Formulas Here */}
                        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-3">Estimat enligt formler</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <CompactResultCard label="Epley" value={maxResults.epley} />
                                <CompactResultCard label="Brzycki" value={maxResults.brzycki} />
                                <CompactResultCard label="Lombardi" value={maxResults.lombardi} />
                                <CompactResultCard label="Mayhew" value={maxResults.mayhew} />
                                <CompactResultCard label="O'Conner" value={maxResults.oconner} />
                                <CompactResultCard label="Wathan" value={maxResults.wathan} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 overflow-hidden flex flex-col h-[600px]">
                    <h2 className="text-xl font-bold text-white mb-4">Rep Max Tabell</h2>
                    <div className="flex-1 overflow-auto custom-scrollbar -mx-2 px-2">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-900 z-10 shadow-lg shadow-slate-900/50">
                                <tr className="text-[10px] text-slate-500 border-b border-white/5 uppercase tracking-wider">
                                    <th className="py-2 px-2 font-black text-right">Reps</th>
                                    <th className="py-2 px-2 font-black text-right">Vikt</th>
                                    <th className="py-2 px-2 font-black text-right">PB</th>
                                    <th className="py-2 px-2 font-black text-right hidden sm:table-cell">e1RM</th>
                                    <th className="py-2 px-2 font-black text-right">%</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {tableRows.map(row => {
                                    const r = row.reps;
                                    const formulaWeight = row.formulaWeight;
                                    const pbWeight = row.pbWeight;
                                    const e1rm = row.e1rm;
                                    const isInputRow = r === reps;
                                    const isMyRecord = row.type === 'actual';
                                    const isInferred = row.type === 'inferred';

                                    // Diff calculation
                                    let diffElem = null;

                                    if (selectedExercise || isMyRecord || isInferred) {
                                        // Round for accurate comparison
                                        const actualDiffVal = Math.round(e1rm) - Math.round(maxResults.average);
                                        const diffPct = maxResults.average ? ((Math.round(e1rm) - Math.round(maxResults.average)) / Math.round(maxResults.average)) * 100 : 0;
                                        const isPositive = actualDiffVal >= 0;

                                        if (actualDiffVal === 0) {
                                            diffElem = <span className="text-[10px] font-bold text-slate-600">0%</span>;
                                        } else {
                                            diffElem = (
                                                <span className={`text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {isPositive ? '+' : ''}{Math.round(diffPct)}%
                                                </span>
                                            );
                                        }
                                    }

                                    return (
                                        <tr
                                            key={r}
                                            onClick={() => {
                                                setWeight(formulaWeight);
                                                setReps(r);
                                            }}
                                            className={`
                                            border-b border-white/5 last:border-0 transition-colors cursor-pointer group
                                            ${isInputRow ? 'bg-emerald-500/10' : 'hover:bg-white/5'}
                                        `}
                                        >
                                            <td className={`px-2 text-right font-black ${isInferred ? 'py-1 text-xs text-slate-400' : 'py-2 text-white group-hover:text-emerald-400 transition-colors'}`}>{r}</td>

                                            {/* Formula Weight Column */}
                                            <td className={`px-2 text-right font-mono ${isInferred ? 'py-1 text-xs text-slate-400' : 'py-2 text-sm text-white'}`}>
                                                {formulaWeight} <span className="text-[10px] text-slate-600 font-normal">kg</span>
                                            </td>

                                            {/* PB Column */}
                                            <td className={`px-2 text-right font-mono flex items-center justify-end gap-1 ${isInferred ? 'py-1 text-xs text-slate-400' : 'py-2 text-sm'}`}>
                                                {pbWeight !== null ? (
                                                    <>
                                                        {isInferred && (
                                                            <div
                                                                className="group/info relative cursor-help"
                                                                onClick={(e) => e.stopPropagation()}
                                                                title={`Härlett från ${row.source?.weight}kg × ${row.source?.reps}`}
                                                            >
                                                                <Info className="w-3 h-3 text-emerald-500/40 hover:text-emerald-400 transition-colors" />
                                                            </div>
                                                        )}
                                                        <span className={isMyRecord ? 'text-emerald-400 font-bold' : isInferred ? 'text-slate-400' : ''}>
                                                            {pbWeight} <span className="text-[10px] text-slate-600 font-normal">kg</span>
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-600">—</span>
                                                )}
                                            </td>

                                            <td className={`px-2 text-right font-mono text-slate-500 hidden sm:table-cell ${isInferred ? 'py-1 text-xs' : 'py-2 text-xs'}`}>
                                                {Math.round(e1rm)}
                                            </td>

                                            <td className={`px-2 text-right font-medium ${isInferred ? 'py-1' : 'py-2'}`}>
                                                {selectedExercise ? diffElem : <span className="text-slate-600 text-[10px]">{Math.round(maxResults.average ? (e1rm / maxResults.average) * 100 : 0)}%</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {(Object.values(personalRecords).length > 0 || tableRows.length < Object.values(personalRecords).length + 7) && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="w-full mt-2 py-1.5 text-[10px] text-center text-slate-500 hover:text-white hover:bg-white/5 rounded transition-colors uppercase tracking-wider font-medium border border-white/5"
                            >
                                {isExpanded ? 'Visa färre' : 'Visa alla'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Plate Loader */}
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Skivstångslastare</h2>
                            <p className="text-xs text-slate-500 mt-1">Visualisera hur du ska lasta stången</p>
                        </div>

                        <div className="flex items-center gap-4 bg-slate-950 p-2 rounded-xl border border-white/5">
                            <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 px-2">Målvikt</label>
                                <input
                                    type="number"
                                    value={targetWeight}
                                    onChange={(e) => setTargetWeight(Number(e.target.value))}
                                    className="bg-transparent text-white font-mono font-bold text-lg w-20 px-2 focus:outline-none"
                                />
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 px-2">Stång</label>
                                <select
                                    value={barWeight}
                                    onChange={(e) => setBarWeight(Number(e.target.value))}
                                    className="bg-transparent text-white font-bold text-sm focus:outline-none"
                                >
                                    <option value={20}>20 kg</option>
                                    <option value={15}>15 kg</option>
                                    <option value={10}>10 kg</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center items-center bg-slate-950 rounded-2xl p-8 py-24 border border-white/5 overflow-visible">
                        {/* The Barbell Visualization */}
                        <div className="flex items-center gap-0.5 mb-12 relative w-full justify-center max-w-4xl mx-auto">

                            {/* Sleeve Cap */}
                            <div className="h-8 w-4 bg-slate-400 rounded-l-sm border-r border-black/30 shadow-sm z-10"></div>

                            {/* Sleeve */}
                            <div className="flex items-center bg-slate-400 h-8 px-1 shadow-inner relative z-0">
                                {loadingResult.plates.length > 0 ? (
                                    loadingResult.plates.flatMap((plate) =>
                                        Array(plate.count).fill(plate)
                                    ).map((plate, idx) => (
                                        <div key={idx} className="flex items-center -ml-0.5 first:ml-0 relative group">
                                            {/* Plate */}
                                            <div
                                                className={`
                                                ${getPlateHeight(plate.weight)}
                                                w-3 md:w-5 lg:w-6 rounded-[2px] shadow-xl
                                                flex items-center justify-center
                                                ${getPlateColor(plate.weight)}
                                                transition-all hover:scale-110 z-10 hover:z-20
                                                ring-1 ring-black/40
                                            `}
                                            >
                                                {/* Side view of plate doesn't show text usually, but we can add tooltip */}
                                            </div>
                                            {/* Mobile Tooltip */}
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 border border-white/10 shadow-xl">
                                                {plate.weight} kg
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-12"></div>
                                )}
                                {/* Rest of sleeve */}
                                <div className="w-4 h-full"></div>
                            </div>

                            {/* Collar */}
                            <div className="h-10 w-4 bg-slate-500 rounded-sm shadow-lg z-20 mx-0.5 border-l border-white/10"></div>

                            {/* Bar Shaft - Dynamic Thickness */}
                            <div
                                className="w-full min-w-[100px] bg-slate-700 relative shadow-inner rounded-r-sm"
                                style={{
                                    height: barWeight >= 20 ? '16px' : barWeight >= 15 ? '12px' : '10px'
                                }}
                            >
                                {/* Knurling Texture */}
                                <div className="absolute inset-0 opacity-20 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzj//v37zwjjgzj//v37zwQAOTZDf9jH5wQAAAAASUVORK5CYII=')]"></div>
                            </div>

                        </div>

                        {/* Stats */}
                        <div className="flex gap-12 text-center">
                            <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Totalvikt</div>
                                <div className="text-4xl font-black text-white tracking-tighter">
                                    {targetWeight} <span className="text-lg text-slate-600 font-bold">kg</span>
                                </div>
                            </div>
                            <div className="w-px bg-white/10"></div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Per Sida</div>
                                <div className="text-4xl font-black text-emerald-400 tracking-tighter">
                                    {loadingResult.plates.reduce((acc, p) => acc + p.weight * p.count, 0)} <span className="text-lg text-emerald-600/50 font-bold">kg</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exercise Selection Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Dumbbell className="w-5 h-5 text-emerald-400" />
                                    Välj övning
                                </h3>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 border-b border-white/5">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Sök övning..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="overflow-y-auto p-2 custom-scrollbar flex-1">
                                <div className="space-y-1">
                                    {filteredExercises.map(({ name, count }) => (
                                        <button
                                            key={name}
                                            onClick={() => {
                                                setSelectedExercise(name);
                                                setIsModalOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${selectedExercise === name
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                                                }`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-500 font-mono bg-slate-950 px-2 py-1 rounded-md border border-white/5 group-hover:border-white/10 transition-colors">
                                                    x{count}
                                                </span>
                                                {selectedExercise === name && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
                                            </div>
                                        </button>
                                    ))}
                                    {filteredExercises.length === 0 && (
                                        <div className="text-center py-8 text-slate-500">
                                            Inga övningar hittades.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function CompactResultCard({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-slate-900/50 px-3 py-2 rounded-lg border border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
            <span className="text-lg font-bold text-white leading-none">{value}</span>
        </div>
    );
}

function getPlateColor(weight: number): string {
    // Added ring-1 and slight border adjustments for better distinction
    if (weight >= 25) return 'bg-red-600 border-red-800';
    if (weight >= 20) return 'bg-blue-600 border-blue-800';
    if (weight >= 15) return 'bg-yellow-500 border-yellow-700';
    if (weight >= 10) return 'bg-emerald-600 border-emerald-800';
    if (weight >= 5) return 'bg-slate-200 border-slate-400';
    if (weight >= 2.5) return 'bg-slate-700 border-slate-900';
    return 'bg-slate-500 border-slate-600';
}

function getPlateHeight(weight: number): string {
    if (weight >= 25) return 'h-48'; // 450mm
    if (weight >= 20) return 'h-48'; // 450mm
    if (weight >= 15) return 'h-40';
    if (weight >= 10) return 'h-32';
    if (weight >= 5) return 'h-24';
    return 'h-16';
}
