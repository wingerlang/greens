// Body Measurements Section with timestamped weight data
import React, { useState } from 'react';
import { useWeightHistory } from '../hooks/useWeightHistory.ts';
import { formatSwedishDate, getRelativeTime } from '../../../utils/dateUtils.ts';

interface BodyMeasurementsSectionProps {
    targetWeight: number;
    height?: number;
}

export function BodyMeasurementsSection({ targetWeight, height }: BodyMeasurementsSectionProps) {
    const { history, loading, latestWeight, previousWeight, weekTrend, logWeight } = useWeightHistory();
    const [showAddForm, setShowAddForm] = useState(false);
    const [newWeight, setNewWeight] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    const handleAddWeight = async () => {
        if (!newWeight) return;
        await logWeight(Number(newWeight), newDate);
        setNewWeight('');
        setShowAddForm(false);
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar mätdata...</div>;

    // Only calculate toGoal if targetWeight is a valid positive number
    const toGoal = (latestWeight && targetWeight && targetWeight > 0)
        ? latestWeight.weight - targetWeight
        : null;

    return (
        <div className="space-y-4">
            {/* Latest Weight - Big Display */}
            {latestWeight ? (
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl p-6 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Senaste Vikt</div>
                            <div className="text-white text-5xl font-black">{latestWeight.weight} <span className="text-2xl text-slate-400">kg</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-slate-400 text-xs">Registrerad</div>
                            <div className="text-white font-bold text-lg">{formatSwedishDate(latestWeight.date)}</div>
                            <div className="text-slate-500 text-xs">{getRelativeTime(latestWeight.date)}</div>
                        </div>
                    </div>

                    {/* Change indicators */}
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                        {previousWeight && (
                            <div className="text-center">
                                <div className="text-slate-500 text-xs uppercase">Sedan Förra</div>
                                <div className={`text-lg font-bold ${latestWeight.weight < previousWeight.weight ? 'text-emerald-400' : latestWeight.weight > previousWeight.weight ? 'text-red-400' : 'text-slate-400'}`}>
                                    {latestWeight.weight < previousWeight.weight ? '↓' : latestWeight.weight > previousWeight.weight ? '↑' : '→'}
                                    {Math.abs(latestWeight.weight - previousWeight.weight).toFixed(1)} kg
                                </div>
                            </div>
                        )}
                        {weekTrend !== null && (
                            <div className="text-center">
                                <div className="text-slate-500 text-xs uppercase">Senaste 7 Dagar</div>
                                <div className={`text-lg font-bold ${weekTrend < 0 ? 'text-emerald-400' : weekTrend > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {weekTrend < 0 ? '📉' : weekTrend > 0 ? '📈' : '➡️'} {weekTrend > 0 ? '+' : ''}{weekTrend.toFixed(1)} kg
                                </div>
                            </div>
                        )}
                        {toGoal !== null ? (
                            <div className="text-center">
                                <div className="text-slate-500 text-xs uppercase">Till Målvikt</div>
                                <div className={`text-lg font-bold ${toGoal <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {toGoal <= 0 ? '🎯 Uppnått!' : `${toGoal.toFixed(1)} kg kvar`}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center opacity-40">
                                <div className="text-slate-500 text-xs uppercase">Mål Saknas</div>
                                <div className="text-lg font-bold text-slate-400">
                                    --
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-800/50 rounded-2xl p-8 text-center border border-dashed border-slate-600">
                    <div className="text-4xl mb-3">⚖️</div>
                    <div className="text-slate-400 mb-4">Ingen vikt registrerad ännu</div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
                    >
                        + Registrera din första vikt
                    </button>
                </div>
            )}

            {/* Add Weight Form */}
            {showAddForm && (
                <div className="bg-slate-800/70 rounded-xl p-4 border border-slate-700">
                    <h4 className="text-white font-bold mb-3">Ny Viktregistrering</h4>
                    <div className="flex gap-3">
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Vikt (kg)"
                            value={newWeight}
                            onChange={e => setNewWeight(e.target.value)}
                            className="flex-1 bg-slate-900 rounded-lg p-3 text-white border border-white/10 focus:border-emerald-500 outline-none"
                            autoFocus
                        />
                        <input
                            type="date"
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            className="bg-slate-900 rounded-lg p-3 text-white border border-white/10"
                        />
                        <button onClick={handleAddWeight} className="px-5 py-3 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600">Spara</button>
                        <button onClick={() => setShowAddForm(false)} className="px-5 py-3 bg-slate-700 text-slate-300 rounded-lg font-bold hover:bg-slate-600">Avbryt</button>
                    </div>
                </div>
            )}

            {/* Quick Add Button */}
            {latestWeight && !showAddForm && (
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-3 bg-slate-800/50 text-slate-300 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                    <span>⚖️</span> Registrera ny vikt
                </button>
            )}

            {/* Other Measurements */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="text-slate-500 text-xs uppercase font-bold">Längd</div>
                    <div className="text-white text-2xl font-black">{height || '—'} <span className="text-sm text-slate-400">cm</span></div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="text-slate-500 text-xs uppercase font-bold">Målvikt</div>
                    <div className="text-amber-400 text-2xl font-black">{targetWeight ? targetWeight : '—'} <span className="text-sm text-slate-400">{targetWeight ? 'kg' : ''}</span></div>
                </div>
            </div>

            {/* Mini History */}
            {history.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-500 text-xs uppercase font-bold">Senaste Registreringar</span>
                        <a href="#weight-history" className="text-emerald-400 text-xs hover:underline">Visa all historik →</a>
                    </div>
                    <div className="space-y-1">
                        {Array.from(new Map(history.map(item => [item.date + (item.createdAt || ''), item])).values())
                            .slice(0, 5)
                            .map((h, i) => (
                                <div key={`${h.date}-${h.createdAt || i}`} className={`flex items-center justify-between p-2 rounded-lg ${i === 0 ? 'bg-emerald-500/10' : 'bg-slate-800/30'}`}>
                                    <span className="text-slate-400 text-sm">{formatSwedishDate(h.date)}</span>
                                    <span className={`font-bold ${i === 0 ? 'text-emerald-400' : 'text-white'}`}>{h.weight} kg</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
