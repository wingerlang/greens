import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import {
    calculateWattsPerKg,
    estimateFtp,
    getCyclingLevel,
    getAssaultBikeLevel,
    analyzeAssaultBikePerformance,
    getBest20MinPower
} from '../../utils/cyclingCalculations';
import { CYCLING_POWER_PROFILE } from './data/cyclingStandards';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Bike, Wind, Trophy, Info, Activity, Dumbbell } from 'lucide-react';

export const ToolsCyclingPage: React.FC = () => {
    const { getLatestWeight, exerciseEntries, userSettings } = useData();
    const [activeTab, setActiveTab] = useState<'cycling' | 'assault'>('cycling');

    // Cycling State
    const [inputWatts, setInputWatts] = useState<string>('');
    const [isFtpInput, setIsFtpInput] = useState(true); // true = FTP input, false = 20min max input
    const [weight, setWeight] = useState<string>('80');
    const [gender, setGender] = useState<'male' | 'female'>('male');

    // Assault Bike State
    const [assaultTime, setAssaultTime] = useState<'1m' | '10m' | '20m'>('10m');
    const [assaultCals, setAssaultCals] = useState<string>('');

    // Load initial data
    useEffect(() => {
        const latestWeight = getLatestWeight();
        if (latestWeight) setWeight(latestWeight.toString());

        if (userSettings?.gender) {
            setGender(userSettings.gender === 'female' ? 'female' : 'male');
        }

        // Pre-fill cycling best if available
        const best20 = getBest20MinPower(exerciseEntries);
        if (best20) {
            setInputWatts(best20.watts.toString());
            setIsFtpInput(false); // It's 20min power, not FTP
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
        // Create chart data: Level labels vs W/kg thresholds
        // We reverse it so "World Class" is at top if vertical, or right if horizontal
        const data = standards.map(s => ({
            name: s.level,
            wKg: s.wKgFtp,
            userWKg: cyclingStats?.wKg || 0,
            isUser: false
        })).reverse();

        return data;
    }, [gender, cyclingStats]);

    // Assault Bike Analysis
    const assaultStats = useMemo(() => {
        const cals = parseFloat(assaultCals) || 0;
        if (!cals) return null;

        const level = getAssaultBikeLevel(cals, assaultTime, gender);
        const calsPerMin = assaultTime === '1m' ? cals : assaultTime === '10m' ? cals / 10 : cals / 20;

        return { level, calsPerMin: Math.round(calsPerMin * 10) / 10 };
    }, [assaultCals, assaultTime, gender]);

    const historicalAssault = useMemo(() => {
        return analyzeAssaultBikePerformance(exerciseEntries, gender);
    }, [exerciseEntries, gender]);

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

                    {/* Top Row: Historical Records */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: '1 min', data: historicalAssault.best1m, icon: '🔥' },
                            { label: '10 min', data: historicalAssault.best10m, icon: '⚡' },
                            { label: '20 min', data: historicalAssault.best20m, icon: '🚴' }
                        ].map((item) => (
                            <div key={item.label} className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                                <div className="absolute -right-4 -top-4 text-slate-800 group-hover:text-emerald-500/10 transition-colors">
                                    <Wind size={80} />
                                </div>
                                <div className="relative z-10">
                                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">{item.label} Rekord</div>
                                    {item.data ? (
                                        <>
                                            <div className="text-2xl font-bold text-white">{Math.round(item.data.totalCals)} <span className="text-sm font-medium text-slate-500">kcal</span></div>
                                            <div className="text-xs font-medium text-emerald-400 mt-1">{item.data.level}</div>
                                            <div className="text-[10px] text-slate-600 mt-2">{item.data.date.split('T')[0]}</div>
                                        </>
                                    ) : (
                                        <div className="text-sm text-slate-600 italic mt-2">Inga data hittades</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Calculator Area */}
                    <div className="grid md:grid-cols-2 gap-8">
                         <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-6">
                            <h3 className="text-xl font-bold text-white mb-4">Kalkylator</h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Test (Tid)</label>
                                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10">
                                        {(['1m', '10m', '20m'] as const).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setAssaultTime(t)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${assaultTime === t ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Resultat (Kalorier)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={assaultCals}
                                            onChange={(e) => setAssaultCals(e.target.value)}
                                            placeholder="Antal kalorier..."
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">kcal</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Output */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-center">
                             {assaultStats ? (
                                <div className="space-y-6 text-center">
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Prestationsnivå</div>
                                        <div className="text-3xl font-bold text-white flex items-center justify-center gap-3">
                                            <Trophy className="text-amber-400" size={32} />
                                            {assaultStats.level}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Snitt (kcal/min)</div>
                                            <div className="text-xl font-bold text-emerald-400">{assaultStats.calsPerMin}</div>
                                        </div>
                                        <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Total</div>
                                            <div className="text-xl font-bold text-white">{assaultCals}</div>
                                        </div>
                                    </div>
                                </div>
                             ) : (
                                <div className="flex flex-col items-center justify-center text-slate-500 space-y-4">
                                    <Wind size={48} className="opacity-20" />
                                    <p>Mata in resultat för att se nivå</p>
                                </div>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
