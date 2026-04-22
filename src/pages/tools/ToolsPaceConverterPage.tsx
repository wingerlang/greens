import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    calculateVDOT,
    predictRaceTime,
    convertPaceToTime,
    formatSeconds,
    parseSmartTime,
    formatSmartTime,
    parseSmartDistance
} from '../../utils/runningCalculator.ts';
import { getBestEffortsForActivity } from '../../utils/performanceEngine.ts';
import { useData } from '../../context/DataContext.tsx';

const TARGET_DISTANCES = [
    { name: "400m", km: 0.4 },
    { name: "800m", km: 0.8 },
    { name: "1 km", km: 1 },
    { name: "1.5 km", km: 1.5 },
    { name: "3 km", km: 3 },
    { name: "5 km", km: 5 },
    { name: "10 km", km: 10 },
    { name: "Halvmaraton", km: 21.0975 },
    { name: "Maraton", km: 42.195 },
    { name: "50 km", km: 50 },
    { name: "50 miles", km: 80.4672 },
    { name: "100 km", km: 100 },
    { name: "100 miles", km: 160.934 }
];

const BASELINE_DISTANCES = [
    { name: "1 500m", km: 1.5 },
    { name: "3 000m", km: 3 },
    { name: "5 km", km: 5 },
    { name: "10 km", km: 10 },
    { name: "Halvmaraton", km: 21.0975 },
    { name: "Maraton", km: 42.195 }
];

export function ToolsPaceConverterPage() {
    const { unifiedActivities } = useData();

    // State
    const [paceInput, setPaceInput] = useState("5:00");
    const [mode, setMode] = useState<'exact' | 'predict'>('exact');
    const [baselineKm, setBaselineKm] = useState<number>(5);
    const [isCustomBaseline, setIsCustomBaseline] = useState<boolean>(false);
    const [baselineInput, setBaselineInput] = useState<string>("5");

    // Pace in seconds per km
    const paceSeconds = parseSmartTime(paceInput);

    // Handlers
    const handlePaceChange = (val: string) => {
        setPaceInput(val);
    };

    const handlePaceBlur = () => {
        const pSecs = parseSmartTime(paceInput);
        if (pSecs > 0) setPaceInput(formatSmartTime(pSecs));
    };

    const handlePaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentSecs = parseSmartTime(paceInput);
            const delta = e.key === 'ArrowUp' ? 1 : -1;
            const step = e.shiftKey ? 10 : 1;
            const newSecs = Math.max(0, currentSecs + (delta * step));
            setPaceInput(formatSmartTime(newSecs));
        }
    };

    // All-time best efforts across all activities
    const allTimeBests = useMemo(() => {
        if (!unifiedActivities || unifiedActivities.length === 0) return [];
        const targetDistances = [1, 2, 3, 5, 10, 21.0975, 42.195];
        const bestMap: Record<number, { name: string; km: number; timeSec: number; date: string; pace: number }> = {};

        for (const act of unifiedActivities) {
            if (act.performance?.excludeFromStats || (act as any).excludeFromStats) continue;
            const efforts = getBestEffortsForActivity(act);
            for (const effort of efforts) {
                const distKm = effort.distance / 1000;
                const matched = targetDistances.find(t => Math.abs(t - distKm) < 0.05);
                if (matched && effort.movingTime > 0) {
                    if (!bestMap[matched] || effort.movingTime < bestMap[matched].timeSec) {
                        bestMap[matched] = {
                            name: effort.name,
                            km: matched,
                            timeSec: effort.movingTime,
                            date: act.date,
                            pace: effort.movingTime / matched
                        };
                    }
                }
            }
        }
        return Object.values(bestMap).sort((a, b) => a.km - b.km);
    }, [unifiedActivities]);

    // Calculate Best / Quick select runs
    const bestActivities = useMemo(() => {
        if (!unifiedActivities || unifiedActivities.length === 0) return [];
        const running = unifiedActivities.filter(a => a.type === 'running' && (a.distance || 0) > 0 && (a.durationMinutes || 0) > 0 && !a.excludeFromStats);

        // Find best VDOT ones
        const withVDOT = running.map(r => ({
            ...r,
            vdot: calculateVDOT(r.distance || 0, (r.durationMinutes || 0) * 60)
        })).sort((a, b) => b.vdot - a.vdot);

        // Deduplicate similar distances to get a spread of PBs (e.g. 5k, 10k, 21k)
        const categories = [3, 5, 10, 21.1, 42.2];
        const pbs: any[] = [];

        categories.forEach(targetDist => {
            const match = withVDOT.find(r => Math.abs((r.distance || 0) - targetDist) < (targetDist * 0.1));
            if (match && !pbs.find(p => p.id === match.id)) {
                pbs.push(match);
            }
        });

        // Fill up to 5 with remaining best VDOTs
        for (const r of withVDOT) {
            if (pbs.length >= 5) break;
            if (!pbs.find(p => p.id === r.id)) {
                pbs.push(r);
            }
        }

        return pbs.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    }, [unifiedActivities]);

    const handleUseBestEffort = (best: { km: number; timeSec: number }) => {
        const pace = best.timeSec / best.km;
        setPaceInput(formatSmartTime(pace));
        setBaselineKm(best.km);
        setBaselineInput(best.km.toString());
        const nearestBaseline = BASELINE_DISTANCES.find(d => Math.abs(d.km - best.km) < 0.1);
        setIsCustomBaseline(!nearestBaseline);
        setMode('predict');
    };

    const handleQuickSelect = (run: any) => {
        const d = run.distance || 1;
        const durSecs = (run.durationMinutes || 0) * 60;
        const pace = durSecs / d;
        setPaceInput(formatSmartTime(pace));

        // Auto-match baseline distance if in predict mode
        if (mode === 'predict') {
            const nearestBaseline = [...BASELINE_DISTANCES].sort((a, b) => Math.abs(a.km - d) - Math.abs(b.km - d))[0];
            if (nearestBaseline && Math.abs(nearestBaseline.km - d) < 0.1) {
                setBaselineKm(nearestBaseline.km);
                setBaselineInput(nearestBaseline.km.toString());
                setIsCustomBaseline(false);
            } else {
                setBaselineKm(d);
                setBaselineInput(d.toString());
                setIsCustomBaseline(true);
            }
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="text-center md:text-left">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-emerald-400 mb-2">
                    Pace Converter 2.0
                </h1>
                <p className="text-slate-400 max-w-2xl">
                    Se hur lång tid olika distanser tar vid ett visst tempo. Välj VDOT-prediktion för att få realistiska tider anpassade för längre sträckor.
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN: Inputs */}
                <div className="space-y-6">
                    <div className="bg-slate-900/80 border border-emerald-500/20 rounded-3xl p-6 shadow-lg shadow-emerald-900/10">
                        <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4">Metod</h2>

                        <div className="flex bg-slate-950/50 rounded-xl p-1 mb-6 border border-white/5">
                            <button
                                onClick={() => setMode('exact')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'exact' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-white'}`}
                            >
                                Exakt Tempo
                            </button>
                            <button
                                onClick={() => setMode('predict')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'predict' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-white'}`}
                            >
                                VDOT Prediktion
                            </button>
                        </div>

                        <div className="space-y-5">
                            {mode === 'predict' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tempot gäller för distansen</label>
                                    <div className="flex gap-2 items-center">
                                        <select
                                            value={!isCustomBaseline && BASELINE_DISTANCES.find(d => d.km === baselineKm) ? baselineKm : 'custom'}
                                            onChange={(e) => {
                                                if (e.target.value === 'custom') {
                                                    setIsCustomBaseline(true);
                                                    setBaselineInput(baselineKm.toString());
                                                } else {
                                                    setIsCustomBaseline(false);
                                                    const newKm = Number(e.target.value);
                                                    setBaselineKm(newKm);
                                                    setBaselineInput(newKm.toString());
                                                }
                                            }}
                                            className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-amber-500 transition-colors"
                                        >
                                            {BASELINE_DISTANCES.map(d => (
                                                <option key={d.name} value={d.km}>{d.name}</option>
                                            ))}
                                            <option value="custom">Anpassad...</option>
                                        </select>
                                        {isCustomBaseline && (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={baselineInput}
                                                    placeholder="t.ex. 2500m"
                                                    onChange={(e) => {
                                                        setBaselineInput(e.target.value);
                                                        const parsed = parseSmartDistance(e.target.value);
                                                        if (parsed > 0) setBaselineKm(parsed);
                                                    }}
                                                    onBlur={() => {
                                                        const parsed = parseSmartDistance(baselineInput);
                                                        if (parsed > 0) {
                                                            setBaselineKm(parsed);
                                                            setBaselineInput(parsed.toString());
                                                        }
                                                    }}
                                                    className="w-32 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-lg font-bold focus:outline-none focus:border-amber-500 transition-colors"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">km</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 italic">
                                        Din VDOT beräknas utifrån tempo + distans och predicerar sedan realistiska tider på andra sträckor.
                                    </p>
                                </div>
                            )}

                            {/* BEST EFFORT PBs */}
                            {allTimeBests.length > 0 && (
                                <div className="pt-3 border-t border-white/5">
                                    <label className="block text-[10px] font-bold text-amber-500/80 uppercase tracking-wider mb-2">🏆 Dina bästa tider</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {allTimeBests.map(best => {
                                            const mins = Math.floor(best.timeSec / 60);
                                            const secs = Math.round(best.timeSec % 60);
                                            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                                            const label = best.km >= 42 ? 'Maraton' : best.km >= 21 ? 'HM' : best.km >= 1 ? `${best.km}k` : `${Math.round(best.km * 1000)}m`;
                                            return (
                                                <button
                                                    key={best.km}
                                                    onClick={() => handleUseBestEffort(best)}
                                                    className="bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 hover:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-amber-300 transition-all flex flex-col items-center min-w-[60px]"
                                                    title={`Bästa ${best.name} — ${best.date}`}
                                                >
                                                    <span className="text-[9px] text-amber-500/60 font-black uppercase">{label}</span>
                                                    <span className="font-mono">{timeStr}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tempo (/km)</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={paceInput}
                                        onChange={(e) => handlePaceChange(e.target.value)}
                                        onBlur={handlePaceBlur}
                                        onKeyDown={handlePaceKeyDown}
                                        placeholder="t.ex. 4:30"
                                        className={`w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-4 text-white text-3xl font-mono font-bold focus:outline-none transition-colors group-hover:border-white/20 ${mode === 'predict' ? 'focus:border-amber-500' : 'focus:border-emerald-500'}`}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold opacity-50">⚡</div>
                                </div>
                            </div>

                            {bestActivities.length > 0 && (
                                <div className="pt-2 border-t border-white/5">
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Hämta från tidigare pass</label>
                                    <div className="space-y-2">
                                        {bestActivities.map(run => {
                                            const d = run.distance || 0;
                                            const pace = ((run.durationMinutes || 0) * 60) / (d || 1);
                                            return (
                                                <button
                                                    key={run.id}
                                                    onClick={() => handleQuickSelect(run)}
                                                    className="w-full text-left bg-slate-950/30 hover:bg-slate-900 border border-white/5 rounded-lg p-2 text-xs flex justify-between items-center transition-colors group"
                                                >
                                                    <span className="text-slate-400 truncate max-w-[150px] group-hover:text-white transition-colors">
                                                        {d > 40 ? 'Maraton' : d > 20 ? 'Halvmaraton' : `${d.toFixed(1)} km`} ({run.date?.split('T')[0]})
                                                    </span>
                                                    <span className="text-emerald-400 font-mono font-bold">
                                                        {formatSmartTime(pace)}/km
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Table */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900/80 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h2 className="text-xl font-bold text-white">
                                Sluttider <span className={`text-sm ml-2 ${mode === 'predict' ? 'text-amber-400' : 'text-emerald-400'}`}>({mode === 'predict' ? 'Prediktion' : 'Exakt tempo'})</span>
                            </h2>
                            {mode === 'predict' && paceSeconds > 0 && (
                                <div className="text-xs bg-amber-500/10 text-amber-500/80 px-3 py-1 rounded-full font-bold">
                                    Uppskattat VDOT: {calculateVDOT(baselineKm, paceSeconds * baselineKm).toFixed(1)}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                            {(() => {
                                // Inject custom baseline distance into the table if it's not already there
                                const displayDistances = [...TARGET_DISTANCES];
                                if (!displayDistances.some(d => d.km === baselineKm)) {
                                    displayDistances.push({ name: `${baselineKm} km`, km: baselineKm });
                                }
                                // Sort ascending by distance
                                displayDistances.sort((a, b) => a.km - b.km);

                                return displayDistances.map(dist => {
                                    let timeSecs = 0;
                                    let distPace = paceSeconds;

                                    if (mode === 'exact') {
                                        timeSecs = convertPaceToTime(dist.km, paceSeconds);
                                    } else {
                                        if (paceSeconds > 0) {
                                            const vdot = calculateVDOT(baselineKm, paceSeconds * baselineKm);
                                            timeSecs = predictRaceTime(vdot, dist.km);
                                            distPace = timeSecs / dist.km;
                                        }
                                    }

                                    const isBaseline = mode === 'predict' && dist.km === baselineKm;
                                    const diffPaceSecs = distPace - paceSeconds;

                                    return (
                                        <div
                                            key={dist.name}
                                            className={`flex items-center px-4 py-3 rounded-xl transition-colors ${isBaseline ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                                        >
                                            <div className="w-1/3">
                                                <div className="flex flex-col">
                                                    <span className={`font-bold ${isBaseline ? 'text-amber-300' : 'text-slate-300'}`}>
                                                        {dist.name}
                                                        {isBaseline && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-500/60">Bas</span>}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-1/3 text-center">
                                                {mode === 'predict' && (
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-xs font-mono font-bold ${isBaseline ? 'text-amber-400' : 'text-slate-500'}`}>
                                                            {formatSmartTime(distPace)}/km
                                                        </span>
                                                        {!isBaseline && paceSeconds > 0 && baselineKm > 0 && (
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] font-bold text-slate-500/80">
                                                                    {dist.km > baselineKm ? '+' : ''}{((dist.km - baselineKm) / baselineKm * 100).toFixed(0)}% dist
                                                                </span>
                                                                <span className={`text-[10px] font-bold ${diffPaceSecs > 0 ? 'text-rose-400/80' : 'text-emerald-400/80'}`}>
                                                                    {diffPaceSecs > 0 ? '+' : ''}{((diffPaceSecs / paceSeconds) * 100).toFixed(1)}% fart
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="w-1/3 text-right">
                                                <span className={`font-black font-mono text-xl ${mode === 'predict' ? (isBaseline ? 'text-amber-400' : 'text-amber-200/80') : 'text-emerald-400'}`}>
                                                    {timeSecs > 0 ? formatSeconds(timeSecs) : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ToolsPaceConverterPage;
