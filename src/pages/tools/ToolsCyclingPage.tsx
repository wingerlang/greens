import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import {
    calculateWattsPerKg,
    estimateFtp,
    getCyclingLevel,
    analyzeAssaultBikePerformance,
    ASSAULT_BIKE_INTERVALS,
    AssaultBikeMath,
    extractFtpFromHistory,
    type AssaultInterval
} from '../../utils/cyclingCalculations';
import { CYCLING_POWER_PROFILE } from './data/cyclingStandards';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Bike, Wind, Trophy, Activity, Timer, Calculator, Zap, Flame, Gauge } from 'lucide-react';

export const ToolsCyclingPage: React.FC = () => {
    const { getLatestWeight, exerciseEntries, userSettings, strengthSessions } = useData();
    const [activeTab, setActiveTab] = useState<'cycling' | 'assault'>('cycling');

    // Cycling State
    const [inputWatts, setInputWatts] = useState<string>('');
    const [isFtpInput, setIsFtpInput] = useState(true); // true = FTP input, false = 20min max input
    const [weight, setWeight] = useState<string>('80');
    const [gender, setGender] = useState<'male' | 'female'>('male');

    // Assault Bike Calculator State
    const [calcWatts, setCalcWatts] = useState<string>('300');
    const [calcRpm, setCalcRpm] = useState<string>('60');
    const [calcSpeed, setCalcSpeed] = useState<string>('26'); // km/h
    const [calcCals, setCalcCals] = useState<string>('15'); // cals/min

    // Load initial data
    useEffect(() => {
        const latestWeight = getLatestWeight();
        if (latestWeight) setWeight(latestWeight.toString());

        if (userSettings?.gender) {
            setGender(userSettings.gender === 'female' ? 'female' : 'male');
        }

        // Pre-fill cycling best if available
        const bestFtp = extractFtpFromHistory(exerciseEntries);
        if (bestFtp) {
            setInputWatts(bestFtp.watts.toString());
            setIsFtpInput(true); // Extracted logic returns "FTP", whether estimated or explicit
        }
    }, [getLatestWeight, exerciseEntries, userSettings]);

    // Cycling Calculations
    const cyclingStats = useMemo(() => {
        const w = parseFloat(weight) || 0;
        const p = parseFloat(inputWatts) || 0;

        if (!w || !p) return null;

        const ftp = isFtpInput ? p : estimateFtp(p);
        const wKg = calculateWattsPerKg(ftp, w);
        const level = getCyclingLevel(wKg, 'ftp', gender);

        return { ftp, wKg, level };
    }, [weight, inputWatts, isFtpInput, gender]);

    const cyclingChartData = useMemo(() => {
        const standards = CYCLING_POWER_PROFILE[gender];
        const data = standards.map(s => ({
            name: s.level,
            wKg: s.wKgFtp,
            userWKg: cyclingStats?.wKg || 0,
            isUser: false
        })).reverse();

        return data;
    }, [gender, cyclingStats]);

    // Assault Bike Analysis
    const historicalAssault = useMemo(() => {
        return analyzeAssaultBikePerformance(exerciseEntries, strengthSessions, gender);
    }, [exerciseEntries, strengthSessions, gender]);

    // Assault Calculator Handlers
    const handleWattChange = (val: string) => {
        setCalcWatts(val);
        const w = parseFloat(val);
        if (!w) return;
        setCalcRpm(AssaultBikeMath.wattsToRpm(w).toFixed(1));
        setCalcCals(AssaultBikeMath.wattsToCalsPerMin(w).toFixed(1));
        const rpm = AssaultBikeMath.wattsToRpm(w);
        setCalcSpeed(AssaultBikeMath.rpmToSpeedKmh(rpm).toFixed(1));
    };

    const handleRpmChange = (val: string) => {
        setCalcRpm(val);
        const rpm = parseFloat(val);
        if (!rpm) return;
        setCalcWatts(AssaultBikeMath.rpmToWatts(rpm).toFixed(0));
        setCalcSpeed(AssaultBikeMath.rpmToSpeedKmh(rpm).toFixed(1));
        const w = AssaultBikeMath.rpmToWatts(rpm);
        setCalcCals(AssaultBikeMath.wattsToCalsPerMin(w).toFixed(1));
    };

    const handleSpeedChange = (val: string) => {
        setCalcSpeed(val);
        const s = parseFloat(val);
        if (!s) return;
        // speed = rpm * 0.43 => rpm = speed / 0.43
        const rpm = s / 0.43;
        setCalcRpm(rpm.toFixed(1));
        const w = AssaultBikeMath.rpmToWatts(rpm);
        setCalcWatts(w.toFixed(0));
        setCalcCals(AssaultBikeMath.wattsToCalsPerMin(w).toFixed(1));
    };

    const handleCalsChange = (val: string) => {
        setCalcCals(val);
        const c = parseFloat(val);
        if (!c) return;
        const w = AssaultBikeMath.calsPerMinToWatts(c);
        setCalcWatts(w.toFixed(0));
        setCalcRpm(AssaultBikeMath.wattsToRpm(w).toFixed(1));
        const rpm = AssaultBikeMath.wattsToRpm(w);
        setCalcSpeed(AssaultBikeMath.rpmToSpeedKmh(rpm).toFixed(1));
    };

    // Relevant Activities List
    const relevantActivities = useMemo(() => {
        if (activeTab === 'cycling') {
            return exerciseEntries
                .filter(e => e.type === 'cycling' || (e.averageWatts && e.averageWatts > 0))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
             // For Assault, we want summaries or Strength Sessions with Assault sets
             const relevantSummaryIds = new Set<string>();
             const list: {
                 id: string; date: string; title: string; type: string; details: string;
             }[] = [];

             // 1. Summaries
             exerciseEntries.forEach(e => {
                 const title = (e.title || '').toLowerCase();
                 const notes = (e.notes || '').toLowerCase();
                 if (['assault', 'air bike', 'echo'].some(k => title.includes(k) || notes.includes(k))) {
                     relevantSummaryIds.add(e.id);
                     list.push({
                         id: e.id,
                         date: e.date,
                         title: e.title || 'Cardio',
                         type: 'Cardio',
                         details: `${e.caloriesBurned} kcal, ${e.durationMinutes} min`
                     });
                 }
             });

             // 2. Strength Sessions
             strengthSessions.forEach(s => {
                  const hasAssault = s.exercises.some(ex => {
                      const name = (ex.exerciseName || '').toLowerCase();
                      return ['assault', 'air bike', 'echo'].some(k => name.includes(k));
                  });

                  if (hasAssault) {
                      // Find best set details
                      const sets: string[] = [];
                      s.exercises.forEach(ex => {
                          if (['assault', 'air bike', 'echo'].some(k => (ex.exerciseName || '').toLowerCase().includes(k))) {
                              ex.sets.forEach(set => {
                                  if (set.calories) sets.push(`${set.calories} kcal`);
                                  else if (set.distance) sets.push(`${set.distance}${set.distanceUnit || 'm'}`);
                                  else if (set.time) sets.push(`${set.time}`);
                              });
                          }
                      });

                      list.push({
                          id: s.id,
                          date: s.date,
                          title: s.name || 'Styrkepass',
                          type: 'Strength',
                          details: sets.slice(0, 3).join(', ') + (sets.length > 3 ? '...' : '')
                      });
                  }
             });

             return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
    }, [activeTab, exerciseEntries, strengthSessions]);

    return (
        <div className="max-w-4xl mx-auto pb-20 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Bike className="text-emerald-400" size={32} />
                        Cykling & Assault
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Analysera din prestation, räkna ut FTP och se hur du ligger till jämfört med standarder.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('cycling')}
                    className={`pb-4 px-4 font-medium transition-colors relative ${
                        activeTab === 'cycling' ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <span className="flex items-center gap-2"><Activity size={18} /> Lande/Stationär</span>
                    {activeTab === 'cycling' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-400 rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('assault')}
                    className={`pb-4 px-4 font-medium transition-colors relative ${
                        activeTab === 'assault' ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <span className="flex items-center gap-2"><Wind size={18} /> Assault Bike</span>
                    {activeTab === 'assault' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-400 rounded-t-full" />}
                </button>
            </div>

            {/* Content */}
            {activeTab === 'cycling' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Calculator Card */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-6">
                            <h3 className="text-xl font-bold text-white mb-4">Kalkylator</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vikt (kg)</label>
                                    <input
                                        type="number"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kön (för standarder)</label>
                                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10">
                                        <button
                                            onClick={() => setGender('male')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'male' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Man
                                        </button>
                                        <button
                                            onClick={() => setGender('female')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'female' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Kvinna
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Effekt (Watt)</label>
                                        <button
                                            onClick={() => setIsFtpInput(!isFtpInput)}
                                            className="text-xs text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/30"
                                        >
                                            {isFtpInput ? 'Har bara 20min max?' : 'Har exakt FTP?'}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={inputWatts}
                                            onChange={(e) => setInputWatts(e.target.value)}
                                            placeholder={isFtpInput ? "Din FTP (ex. 250)" : "Ditt 20min Max (ex. 265)"}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">W</div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">
                                        {isFtpInput
                                            ? "Ange din Functional Threshold Power."
                                            : "Vi drar av 5% från ditt 20-minutersvärde för att estimera FTP."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Results Card */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                            <h3 className="text-xl font-bold text-white mb-6">Analys</h3>

                            {cyclingStats ? (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Estim. FTP</div>
                                            <div className="text-3xl font-bold text-white">{cyclingStats.ftp} <span className="text-sm font-medium text-slate-500">W</span></div>
                                        </div>
                                        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Watt / kg</div>
                                            <div className="text-3xl font-bold text-emerald-400">{cyclingStats.wKg}</div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold mb-2">Nivå (Coggan Power Profile)</div>
                                        <div className="text-2xl font-bold text-white flex items-center gap-3">
                                            <Trophy className="text-amber-400" size={24} />
                                            {cyclingStats.level}
                                        </div>
                                        <div className="h-2 bg-slate-800 rounded-full mt-4 overflow-hidden relative">
                                            {/* Simplified Visual Bar */}
                                            <div
                                                className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000"
                                                style={{ width: `${Math.min(100, (cyclingStats.wKg / 6.0) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-medium uppercase">
                                            <span>Otränad</span>
                                            <span>Elit (6.0+)</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 min-h-[200px]">
                                    <Activity size={48} className="opacity-20" />
                                    <p>Ange värden för att se analys</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart Section */}
                    {cyclingStats && (
                        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-6">Power Profile (W/kg)</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={cyclingChartData}
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={12} domain={[0, 'auto']} />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={100} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                                            cursor={{fill: '#ffffff05'}}
                                        />
                                        <Bar dataKey="wKg" fill="#334155" radius={[0, 4, 4, 0]} barSize={20} name="Standard" />
                                        <ReferenceLine x={cyclingStats.wKg} stroke="#10b981" strokeWidth={2} label={{ position: 'top', value: 'DU', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Assault Bike Layout */}

                    {/* Historical Grid */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                             <Trophy size={20} className="text-amber-400" />
                             Mina Rekord
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {ASSAULT_BIKE_INTERVALS.map((interval) => {
                                const record = historicalAssault[interval.key];
                                return (
                                    <div key={interval.key} className="bg-slate-950/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-28 relative group hover:border-emerald-500/30 transition-all">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">{interval.label}</div>
                                        {record ? (
                                            <div>
                                                <div className="text-lg font-bold text-white">
                                                    {interval.type === 'time' ? Math.round(record.totalCals) : formatTime(record.durationMinutes * 60)}
                                                    <span className="text-[10px] font-medium text-slate-500 ml-1">
                                                        {interval.type === 'time' ? 'kcal' : 'min'}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-emerald-400 mt-0.5 truncate">{record.description}</div>
                                                <div className="text-[9px] text-slate-600 mt-1">{record.date.split('T')[0]}</div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-600 italic">Inget data</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Calculator Area */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                             <Calculator className="text-emerald-400" size={24} />
                             <h3 className="text-xl font-bold text-white">Konverterare</h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                             <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                    <Zap size={14} /> Watt
                                </label>
                                <input
                                    type="number"
                                    value={calcWatts}
                                    onChange={(e) => handleWattChange(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                                />
                             </div>
                             <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                    <Gauge size={14} /> RPM
                                </label>
                                <input
                                    type="number"
                                    value={calcRpm}
                                    onChange={(e) => handleRpmChange(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                                />
                             </div>
                             <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                    <Wind size={14} /> Km/h (Est)
                                </label>
                                <input
                                    type="number"
                                    value={calcSpeed}
                                    onChange={(e) => handleSpeedChange(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                                />
                             </div>
                             <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                    <Flame size={14} /> Kcal/min
                                </label>
                                <input
                                    type="number"
                                    value={calcCals}
                                    onChange={(e) => handleCalsChange(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                                />
                             </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-4 text-center">
                            Baserat på standardformler för Assault/Echo bike (Watts = 0.99 * RPM³ / 1260).
                        </p>
                    </div>

                </div>
            )}

            {/* Common: Relevant Activity List */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h3 className="text-xl font-bold text-white mb-6">Relevanta Aktiviteter</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-slate-500 border-b border-white/10">
                                <th className="py-3 px-4 font-bold uppercase">Datum</th>
                                <th className="py-3 px-4 font-bold uppercase">Titel</th>
                                <th className="py-3 px-4 font-bold uppercase">Typ</th>
                                <th className="py-3 px-4 font-bold uppercase text-right">
                                    {activeTab === 'cycling' ? 'Snittwatt / FTP' : 'Detaljer'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {relevantActivities.length > 0 ? (
                                relevantActivities.map((activity: any) => (
                                    <tr key={activity.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4 text-slate-400 font-mono">{activity.date.split('T')[0]}</td>
                                        <td className="py-3 px-4 text-white font-medium">{activity.title}</td>
                                        <td className="py-3 px-4 text-slate-400">
                                            {activeTab === 'cycling'
                                                ? (activity.type === 'cycling' ? 'Cykling' : 'Annat')
                                                : activity.type}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {activeTab === 'cycling' ? (
                                                <div className="flex flex-col items-end">
                                                    {activity.averageWatts && <span className="text-emerald-400 font-bold">{Math.round(activity.averageWatts)}W</span>}
                                                    {activity.title.toLowerCase().includes('ftp') && <span className="text-[10px] text-amber-400 font-bold uppercase">FTP TEST</span>}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">{activity.details}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                                        Inga relevanta aktiviteter hittades.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
