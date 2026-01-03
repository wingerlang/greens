import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { BodyMeasurementType, BodyMeasurementEntry, getISODate, generateId } from '../../models/types.ts';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Line, LineChart, Legend } from 'recharts';

const MEASUREMENT_TYPES: Record<BodyMeasurementType, { label: string; unit: string; color: string; group: 'upper' | 'lower'; zone: { top: string; left: string; width: string; height: string } }> = {
    neck: { label: 'Nacke', unit: 'cm', color: '#94a3b8', group: 'upper', zone: { top: '16%', left: '42%', width: '16%', height: '5%' } },
    shoulders: { label: 'Axlar', unit: 'cm', color: '#38bdf8', group: 'upper', zone: { top: '23%', left: '25%', width: '50%', height: '8%' } },
    chest: { label: 'Bröst', unit: 'cm', color: '#60a5fa', group: 'upper', zone: { top: '31%', left: '30%', width: '40%', height: '10%' } },
    waist: { label: 'Midja', unit: 'cm', color: '#10b981', group: 'upper', zone: { top: '44%', left: '35%', width: '30%', height: '8%' } },
    hips: { label: 'Höft', unit: 'cm', color: '#34d399', group: 'lower', zone: { top: '50%', left: '32%', width: '36%', height: '9%' } },
    arm_left: { label: 'Vänster Arm', unit: 'cm', color: '#818cf8', group: 'upper', zone: { top: '34%', left: '72%', width: '14%', height: '12%' } },
    arm_right: { label: 'Höger Arm', unit: 'cm', color: '#818cf8', group: 'upper', zone: { top: '34%', left: '14%', width: '14%', height: '12%' } },
    forearm_left: { label: 'V. Underarm', unit: 'cm', color: '#a78bfa', group: 'upper', zone: { top: '52%', left: '78%', width: '10%', height: '14%' } },
    forearm_right: { label: 'H. Underarm', unit: 'cm', color: '#a78bfa', group: 'upper', zone: { top: '52%', left: '12%', width: '10%', height: '14%' } },
    thigh_left: { label: 'Vänster Lår', unit: 'cm', color: '#fbbf24', group: 'lower', zone: { top: '62%', left: '52%', width: '16%', height: '15%' } },
    thigh_right: { label: 'Höger Lår', unit: 'cm', color: '#fbbf24', group: 'lower', zone: { top: '62%', left: '32%', width: '16%', height: '15%' } },
    calf_left: { label: 'Vänster Vad', unit: 'cm', color: '#f87171', group: 'lower', zone: { top: '82%', left: '54%', width: '12%', height: '15%' } },
    calf_right: { label: 'Höger Vad', unit: 'cm', color: '#f87171', group: 'lower', zone: { top: '82%', left: '34%', width: '12%', height: '15%' } },
};

const DEFAULT_PINNED: BodyMeasurementType[] = ['waist', 'hips', 'chest', 'arm_right', 'thigh_right'];

export const BodyMeasurementsModule: React.FC = () => {
    const { bodyMeasurements, addBodyMeasurement, deleteBodyMeasurement } = useData();
    const [date, setDate] = useState(getISODate());

    // Quick Log State
    const [pinnedTypes, setPinnedTypes] = useState<BodyMeasurementType[]>(DEFAULT_PINNED);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [focusedType, setFocusedType] = useState<BodyMeasurementType | null>(null);

    // Filter available History
    const history = useMemo(() => {
        // Use a non-mutating sort for history
        return [...bodyMeasurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [bodyMeasurements]);

    // Graph Data Transformation
    const chartData = useMemo(() => {
        const dateMap = new Map<string, any>();
        history.forEach(entry => {
            const d = entry.date;
            if (!dateMap.has(d)) dateMap.set(d, { date: d });
            const current = dateMap.get(d);
            current[entry.type] = entry.value;
        });
        // Sort chart data as well
        return Array.from(dateMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [history]);

    const getLatestValue = (type: BodyMeasurementType) => {
        const entries = bodyMeasurements.filter(m => m.type === type);
        if (entries.length === 0) return undefined;
        // Sort to get the latest
        const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return sorted[0].value;
    };

    const handleSave = () => {
        let count = 0;
        Object.entries(inputValues).forEach(([type, val]) => {
            if (val) {
                addBodyMeasurement({
                    date,
                    type: type as BodyMeasurementType,
                    value: parseFloat(val),
                });
                count++;
            }
        });
        if (count > 0) {
            setInputValues({}); // Clear inputs on success
            // Optional: Show toast
        }
    };

    const handleSingleSave = (type: BodyMeasurementType) => {
        const val = inputValues[type];
        if (val) {
            addBodyMeasurement({
                date,
                type,
                value: parseFloat(val),
            });
            setInputValues(prev => {
                const next = { ...prev };
                delete next[type];
                return next;
            });
        }
    };

    const handleDelete = (id: string) => {
        if (confirm('Ta bort detta mätvärde?')) {
            deleteBodyMeasurement(id);
        }
    };

    const addPinnedType = (type: BodyMeasurementType) => {
        if (!pinnedTypes.includes(type)) {
            setPinnedTypes([...pinnedTypes, type]);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Visual Guide & Selection */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden h-[600px] flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90 pointer-events-none" />

                    <div className="relative w-full h-full max-w-[400px]">
                        <img
                            src="/measurement_guide.png"
                            alt="Body Measurement Guide"
                            className="w-full h-full object-contain opacity-60 drop-shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                        />

                        {/* Interactive Zones */}
                        {Object.entries(MEASUREMENT_TYPES).map(([type, info]) => (
                            <div
                                key={type}
                                className={`absolute cursor-pointer transition-all duration-300 border backdrop-blur-[1px]
                                    ${focusedType === type ? 'bg-emerald-500/30 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] z-20' : 'bg-transparent border-transparent hover:bg-white/10 hover:border-white/20 z-10'}
                                `}
                                style={{
                                    top: info.zone.top,
                                    left: info.zone.left,
                                    width: info.zone.width,
                                    height: info.zone.height,
                                    borderRadius: '50%'
                                }}
                                onMouseEnter={() => setFocusedType(type as BodyMeasurementType)}
                                onMouseLeave={() => setFocusedType(null)}
                                onClick={() => addPinnedType(type as BodyMeasurementType)}
                            >
                                {/* Tooltip Label on Hover/Focus */}
                                {(focusedType === type) && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded shadow-lg border border-slate-700 pointer-events-none">
                                        {info.label}
                                        {getLatestValue(type as BodyMeasurementType) && <span className="text-emerald-400 ml-1">({getLatestValue(type as BodyMeasurementType)} {info.unit})</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Input & Graph */}
            <div className="lg:col-span-2 space-y-6">
                {/* Quick Log Card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span>✏️</span> Logga Mätvärden
                        </h3>
                        {/* Add Row Dropdown */}
                        <div className="relative group">
                            <button className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider flex items-center gap-1 py-2">
                                + Lägg till rad
                            </button>
                            {/* Bridge element to fix hover gap */}
                            <div className="absolute right-0 top-full -mt-2 h-4 w-full bg-transparent z-40"></div>

                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-50 max-h-[300px] overflow-y-auto">
                                {Object.entries(MEASUREMENT_TYPES).map(([key, info]) => (
                                    <button
                                        key={key}
                                        onClick={() => addPinnedType(key as BodyMeasurementType)}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                                    >
                                        {info.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Date Input */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Datum</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none w-full md:w-auto"
                        />
                    </div>

                    {/* Dynamic Inputs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Group Render Logic */}
                        {['upper', 'lower'].map(group => {
                            const groupTypes = pinnedTypes.filter(t => MEASUREMENT_TYPES[t].group === group);
                            if (groupTypes.length === 0) return null;

                            return (
                                <div key={group} className="space-y-3 contents">
                                    {groupTypes.map(type => (
                                        <div
                                            key={type}
                                            className={`flex items-center gap-3 p-2 pl-3 rounded-xl border transition-all duration-300 ${focusedType === type ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-transparent hover:bg-slate-800/50'}`}
                                            onMouseEnter={() => setFocusedType(type)}
                                            onMouseLeave={() => setFocusedType(null)}
                                        >
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-900 shrink-0" style={{ backgroundColor: MEASUREMENT_TYPES[type].color }}>
                                                {type.substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-200 truncate">{MEASUREMENT_TYPES[type].label}</div>
                                            </div>

                                            {/* Input Area */}
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 relative">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        // Show latest value as placeholder or even pre-fill if desired. 
                                                        // User said: "Lägg senast värde i input-fältet" -> Put latest value in input field.
                                                        // Using placeholder for now to avoid accidental resubmission of old data, 
                                                        // but can check if user wants actual value. "i input-fältet" usually means value.
                                                        // Let's try defaultValue logic if empty.
                                                        placeholder={getLatestValue(type)?.toString() || "-"}
                                                        value={inputValues[type] || ''}
                                                        onChange={(e) => setInputValues({ ...inputValues, [type]: e.target.value })}
                                                        onFocus={() => setFocusedType(type)}
                                                        onBlur={() => setFocusedType(null)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-right text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                                    />
                                                </div>

                                                {/* Single Save */}
                                                <button
                                                    onClick={() => handleSingleSave(type)}
                                                    disabled={!inputValues[type]}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white disabled:opacity-0 disabled:pointer-events-none transition-all"
                                                    title={`Spara ${MEASUREMENT_TYPES[type].label}`}
                                                >
                                                    💾
                                                </button>

                                                <button
                                                    onClick={() => setPinnedTypes(pinnedTypes.filter(t => t !== type))}
                                                    className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-rose-400"
                                                    title="Ta bort rad"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                    >
                        Spara Alla
                    </button>
                </div>

                {/* Multi-Line Graph */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 h-[350px]">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Utveckling över tid</h4>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => val.split('202')[1] || val}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={['dataMin - 5', 'dataMax + 5']}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
                                    labelStyle={{ color: '#94a3b8', marginBottom: '0.25rem' }}
                                />
                                <Legend />
                                {Object.keys(MEASUREMENT_TYPES).map((type) => {
                                    // Only render line if data exists for this type
                                    if (history.some(h => h.type === type)) {
                                        return (
                                            <Line
                                                key={type}
                                                type="monotone"
                                                dataKey={type}
                                                name={MEASUREMENT_TYPES[type as BodyMeasurementType].label}
                                                stroke={MEASUREMENT_TYPES[type as BodyMeasurementType].color}
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: MEASUREMENT_TYPES[type as BodyMeasurementType].color }}
                                                activeDot={{ r: 5 }}
                                                connectNulls
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <span className="text-4xl mb-2">📉</span>
                            <p>Ingen data än</p>
                        </div>
                    )}
                </div>

                {/* History Table */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Datum</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Typ</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Värde</th>
                                    <th className="px-6 py-3 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {[...history].reverse().map((entry) => (
                                    <tr key={entry.id} className="hover:bg-white/[0.02]">
                                        <td className="px-6 py-4 text-slate-300 font-mono">{entry.date}</td>
                                        <td className="px-6 py-4 text-white font-medium">
                                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: MEASUREMENT_TYPES[entry.type].color }}></span>
                                            {MEASUREMENT_TYPES[entry.type].label}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-white">
                                            {entry.value} <span className="text-slate-500 font-normal text-xs">cm</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                className="text-slate-500 hover:text-rose-400 transition-colors"
                                                title="Ta bort"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
