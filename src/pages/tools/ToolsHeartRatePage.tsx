import React, { useState } from 'react';
import { calculateHrZone } from '../../utils/runningCalculator.ts';

export function ToolsHeartRatePage() {
    const [maxHr, setMaxHr] = useState(190);
    const [restingHr, setRestingHr] = useState(60);
    const [formula, setFormula] = useState<'karvonen' | 'max'>('karvonen');

    const zones = [
        { name: 'Zon 1', range: '50-60%', desc: 'Mycket lätt / Återhämtning', color: 'text-gray-400', bg: 'bg-gray-500/10' },
        { name: 'Zon 2', range: '60-70%', desc: 'Lätt / Distans', color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { name: 'Zon 3', range: '70-80%', desc: 'Medel / Tempo', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { name: 'Zon 4', range: '80-90%', desc: 'Hårt / Tröskel', color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { name: 'Zon 5', range: '90-100%', desc: 'Maximalt / Intervaller', color: 'text-rose-400', bg: 'bg-rose-500/10' },
    ];

    const getZoneLimit = (pct: number) => {
        if (formula === 'karvonen') {
            return calculateHrZone(maxHr, restingHr, pct);
        }
        return Math.round(maxHr * pct);
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Pulszoner</h1>
                <p className="text-slate-400">Räkna ut dina träningszoner.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Inställningar</h2>
                        <div className="flex bg-slate-950 rounded-lg p-1 border border-white/5">
                            <button
                                onClick={() => setFormula('karvonen')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${formula === 'karvonen' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                Karvonen
                            </button>
                            <button
                                onClick={() => setFormula('max')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${formula === 'max' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                % Maxpuls
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Maxpuls</label>
                            <input
                                type="number"
                                value={maxHr}
                                onChange={(e) => setMaxHr(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        {formula === 'karvonen' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Vilopuls</label>
                                <input
                                    type="number"
                                    value={restingHr}
                                    onChange={(e) => setRestingHr(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        )}
                        <div className="text-xs text-slate-500 mt-2">
                            {formula === 'karvonen'
                                ? 'Karvonen tar hänsyn till din vilopuls och är ofta mer exakt för vältränade individer.'
                                : 'Standard % av maxpuls är en enkel och vanlig metod.'}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    {zones.map((zone, idx) => {
                        const minPct = 0.5 + (idx * 0.1);
                        const maxPct = 0.6 + (idx * 0.1);
                        const minBpm = getZoneLimit(minPct);
                        const maxBpm = getZoneLimit(maxPct);

                        return (
                            <div key={zone.name} className={`flex items-center justify-between p-4 rounded-xl border border-white/5 ${zone.bg}`}>
                                <div>
                                    <div className={`font-bold ${zone.color}`}>{zone.name}</div>
                                    <div className="text-xs text-slate-400">{zone.desc}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-white">{minBpm}-{maxBpm}</div>
                                    <div className="text-xs text-slate-500">bpm</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
