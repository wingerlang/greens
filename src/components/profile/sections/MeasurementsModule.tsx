import React, { useState, useEffect } from 'react';
import { useData } from '../../../context/DataContext.tsx';
import { BodyMeasurementsSection } from './BodyMeasurementsSection.tsx';
import { BodyMeasurementEntry, BodyMeasurementType, WeightEntry } from '../../../models/types.ts';
import { formatSwedishDate } from '../../../utils/dateUtils.ts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface MeasurementsModuleProps {
    targetWeight?: number;
    height?: number;
}

const MEASUREMENT_TYPES: { id: BodyMeasurementType; label: string; unit: string }[] = [
    { id: 'waist', label: 'Midja', unit: 'cm' },
    { id: 'hips', label: 'Höft', unit: 'cm' },
    { id: 'chest', label: 'Bröst', unit: 'cm' },
    { id: 'arm_right', label: 'Biceps (H)', unit: 'cm' },
    { id: 'arm_left', label: 'Biceps (V)', unit: 'cm' },
    { id: 'thigh_right', label: 'Lår (H)', unit: 'cm' },
    { id: 'thigh_left', label: 'Lår (V)', unit: 'cm' },
    { id: 'calf_right', label: 'Vad (H)', unit: 'cm' },
    { id: 'calf_left', label: 'Vad (V)', unit: 'cm' },
    { id: 'shoulders', label: 'Axlar', unit: 'cm' },
    { id: 'neck', label: 'Nacke', unit: 'cm' },
    { id: 'forearm_right', label: 'Underarm (H)', unit: 'cm' },
    { id: 'forearm_left', label: 'Underarm (V)', unit: 'cm' },
];

export function MeasurementsModule({ targetWeight, height }: MeasurementsModuleProps) {
    const { getAuthToken } = useData();
    const [activeTab, setActiveTab] = useState<'weight' | 'measurements'>('weight');
    const [history, setHistory] = useState<BodyMeasurementEntry[]>([]);
    const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [newType, setNewType] = useState<BodyMeasurementType>('waist');
    const [newValue, setNewValue] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const token = getAuthToken();
        if (!token) return;

        try {
            // Load Measurements
            const mRes = await fetch('/api/measurements', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const mData = await mRes.json();
            if (mData.history) setHistory(mData.history);

            // Load Weight
            const wRes = await fetch('/api/user/weight', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const wData = await wRes.json();
            if (wData.history) setWeightHistory(wData.history);
        } catch (error) {
            console.error("Failed to load measurements:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newValue || !newDate) return;

        const entry: BodyMeasurementEntry = {
            id: crypto.randomUUID(),
            date: newDate,
            type: newType,
            value: parseFloat(newValue),
            createdAt: new Date().toISOString()
        };

        const token = getAuthToken();
        await fetch('/api/measurements', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entry)
        });

        setHistory(prev => [entry, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setIsAdding(false);
        setNewValue('');
    };

    // Chart Data Preparation
    const getChartData = () => {
        if (activeTab === 'weight') {
            return [...weightHistory]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(w => ({
                    date: w.date,
                    value: w.weight,
                    displayDate: formatSwedishDate(w.date)
                }));
        } else {
            // Filter by selected type in dropdown (reuse newType state for chart filtering?)
            // Actually, for chart, let's just pick the 'newType' (which acts as 'selected type' for view too)
            return [...history]
                .filter(h => h.type === newType)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(m => ({
                    date: m.date,
                    value: m.value,
                    displayDate: formatSwedishDate(m.date)
                }));
        }
    };

    const chartData = getChartData();
    const currentMeasurementLabel = MEASUREMENT_TYPES.find(t => t.id === newType)?.label;

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex bg-slate-900 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('weight')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'weight' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    ⚖️ Vikt
                </button>
                <button
                    onClick={() => setActiveTab('measurements')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'measurements' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    📏 Mått
                </button>
            </div>

            {/* Main Content Area */}
            <div className="grid md:grid-cols-3 gap-6">

                {/* Left: Summary / Entry (2 cols) */}
                <div className="md:col-span-2 space-y-6">

                    {/* Graph Section */}
                    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 h-[300px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                📈 {activeTab === 'weight' ? 'Viktutveckling' : `${currentMeasurementLabel} - Utveckling`}
                            </h3>
                            {activeTab === 'measurements' && (
                                <select
                                    value={newType}
                                    onChange={e => setNewType(e.target.value as BodyMeasurementType)}
                                    className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-700"
                                >
                                    {MEASUREMENT_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickFormatter={(val) => val.split(' ')[0] + ' ' + val.split(' ')[1]}
                                    minTickGap={30}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    domain={['auto', 'auto']}
                                    unit={activeTab === 'weight' ? ' kg' : ' cm'}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                />
                                {activeTab === 'weight' && targetWeight && (
                                    <ReferenceLine y={targetWeight} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Mål', fill: '#f59e0b', fontSize: 10 }} />
                                )}
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ fill: '#10b981', r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Weight Specifics */}
                    {activeTab === 'weight' && (
                        <BodyMeasurementsSection targetWeight={targetWeight || 0} height={height} />
                    )}

                    {/* Measurement List */}
                    {activeTab === 'measurements' && (
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-white">Historik ({currentMeasurementLabel})</h3>
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500/20"
                                >
                                    + Ny mätning
                                </button>
                            </div>

                            {isAdding && (
                                <div className="mb-4 p-4 bg-slate-800 rounded-xl animate-in fade-in slide-in-from-top-2 border border-emerald-500/30">
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Datum</label>
                                            <input
                                                type="date"
                                                value={newDate}
                                                onChange={e => setNewDate(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Värde (cm)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={newValue}
                                                onChange={e => setNewValue(e.target.value)}
                                                className="w-full bg-slate-900 border border-emerald-500 rounded-lg p-2 text-white text-sm outline-none"
                                                autoFocus
                                                placeholder="0.0"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-slate-400 text-xs hover:text-white">Avbryt</button>
                                        <button onClick={handleAdd} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600">Spara</button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {history.filter(h => h.type === newType).length === 0 ? (
                                    <div className="text-center text-slate-500 py-4 text-sm">Inga mätningar än.</div>
                                ) : (
                                    history.filter(h => h.type === newType).map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                            <span className="text-slate-400 text-sm">{formatSwedishDate(item.date)}</span>
                                            <span className="text-white font-bold">{item.value} cm</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Latest Stats Panel */}
                <div className="space-y-4">
                    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                        <h3 className="font-bold text-white mb-4 text-sm uppercase text-slate-500">Senaste Mätningar</h3>
                        <div className="space-y-3">
                            {MEASUREMENT_TYPES.map(type => {
                                const latest = history.find(h => h.type === type.id);
                                return (
                                    <div
                                        key={type.id}
                                        onClick={() => { setActiveTab('measurements'); setNewType(type.id); }}
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${newType === type.id && activeTab === 'measurements' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                                    >
                                        <span className="text-slate-300 text-sm">{type.label}</span>
                                        <span className={`font-bold ${latest ? 'text-white' : 'text-slate-600'}`}>
                                            {latest ? `${latest.value} ${type.unit}` : '-'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
