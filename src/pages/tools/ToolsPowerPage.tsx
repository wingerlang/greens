import React, { useState } from 'react';
import { estimateCardioCalories } from '../../utils/runningCalculator.ts';

export function ToolsPowerPage() {
    // Mode
    const [mode, setMode] = useState<'cycling' | 'running'>('cycling');

    // Inputs
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [power, setPower] = useState(200); // Watts
    const [weight, setWeight] = useState(80); // Kg
    const [speed, setSpeed] = useState(10); // km/h

    const durationSeconds = durationMinutes * 60;

    const calories = estimateCardioCalories(mode, durationSeconds, {
        powerWatts: power,
        weightKg: weight,
        speedKph: speed
    });

    const handleUseMyData = () => {
        // Mocking user data fetch
        // setWeight(user.weight || 80);
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Energiberäknare</h1>
                <p className="text-slate-400">Uppskatta kaloriförbrukning för cykling (Watt) och löpning.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit relative">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Parametrar</h2>
                        <button
                            onClick={handleUseMyData}
                            className="text-xs bg-white/5 hover:bg-white/10 text-emerald-400 px-3 py-1.5 rounded-lg font-medium transition-colors border border-emerald-500/20"
                            title="Hämta vikt från din profil"
                        >
                            Hämta min data
                        </button>
                    </div>

                    <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-white/5">
                        <button
                            onClick={() => setMode('cycling')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'cycling' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                        >
                            🚴 Cykling
                        </button>
                        <button
                            onClick={() => setMode('running')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'running' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                        >
                            🏃 Löpning
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Tid (minuter)</label>
                            <input
                                type="number"
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {mode === 'cycling' ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Effekt (Watt)</label>
                                <input
                                    type="number"
                                    value={power}
                                    onChange={(e) => setPower(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <div className="text-xs text-slate-500 mt-2">
                                    Beräknat på 24% verkningsgrad (normalt för cyklister).
                                </div>
                            </div>
                        ) : (
                            <>
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
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Hastighet (km/h)</label>
                                    <input
                                        type="number"
                                        value={speed}
                                        onChange={(e) => setSpeed(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 flex flex-col justify-center items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-3xl mb-4">
                        🔥
                    </div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">BERÄKNAD FÖRBRUKNING</div>
                    <div className="text-6xl font-bold text-white mb-2">{calories}</div>
                    <div className="text-xl font-medium text-emerald-400">kcal</div>

                    <div className="mt-8 pt-8 border-t border-white/5 w-full grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-slate-500 mb-1">Per timme</div>
                            <div className="text-lg font-bold text-white">
                                {Math.round(calories / (durationMinutes / 60))} <span className="text-xs font-normal text-slate-500">kcal/h</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-1">Joule (Arbete)</div>
                            <div className="text-lg font-bold text-white">
                                {mode === 'cycling' ? Math.round(power * durationSeconds / 1000) + ' kJ' : '-'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
