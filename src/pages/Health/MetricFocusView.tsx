import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { DaySnapshot, HealthStats } from '../../utils/healthAggregator.ts';

interface MetricFocusViewProps {
    type: 'sleep' | 'weight';
    snapshots: DaySnapshot[];
    stats: HealthStats;
    days: number;
}

export function MetricFocusView({ type, snapshots, stats, days }: MetricFocusViewProps) {
    const { weightEntries, updateWeightEntry, deleteWeightEntry, updateVitals } = useData();
    const { settings } = useSettings();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [editDate, setEditDate] = useState<string>('');
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    // Prepare table data
    const tableData = useMemo(() => {
        if (type === 'weight') {
            return weightEntries
                // Show entries that are within the current date range (approx) or just all recent ones
                // Better to show what's in the graph + any that might be hidden but relevant
                .filter(w => snapshots.some(s => s.date === w.date))
                .map(w => ({ id: w.id, date: w.date, value: w.weight, unit: 'kg' }));
        } else {
            return snapshots
                .filter(s => s.vitals.sleep > 0)
                .map(s => ({ id: s.date, date: s.date, value: s.vitals.sleep, unit: 'h' }))
                .reverse();
        }
    }, [type, weightEntries, snapshots]);

    const handleEdit = (item: { id: string, date: string, value: number }) => {
        setEditingId(item.id);
        setEditValue(item.value.toString());
        setEditDate(item.date);
    };

    const handleSave = () => {
        if (!editingId) return;
        const val = parseFloat(editValue);
        if (isNaN(val)) return;

        if (type === 'weight') {
            updateWeightEntry(editingId, val, editDate);
        } else {
            updateVitals(editDate, { sleep: val });
        }
        setEditingId(null);
    };

    const handleDelete = (id: string, date: string) => {
        if (!window.confirm('Vill du verkligen ta bort denna loggning?')) return;
        if (type === 'weight') {
            deleteWeightEntry(id);
        } else {
            updateVitals(date, { sleep: 0 });
        }
    };

    const isWeight = type === 'weight';
    const themeColor = isWeight ? '#f43f5e' : '#0ea5e9';

    // Graph Calculations
    const graphMeta = useMemo(() => {
        const validPoints = snapshots.map((s, i) => ({
            val: isWeight ? s.weight : s.vitals.sleep,
            date: s.date,
            i
        })).filter(p => p.val !== undefined && p.val > 0) as { val: number, date: string, i: number }[];

        if (validPoints.length === 0) return { min: 0, max: 10, range: 10, points: [] };

        let min = Math.min(...validPoints.map(p => p.val));
        let max = Math.max(...validPoints.map(p => p.val));

        // Add padding
        const padding = (max - min) * 0.2 || 2;
        min = Math.floor(min - padding);
        max = Math.ceil(max + padding);

        // Ensure sleep axis makes sense
        if (!isWeight) {
            min = Math.max(0, min);
            max = Math.max(12, max); // Always show up to 12h at least
        }

        const range = max - min;

        return {
            min,
            max,
            range,
            points: validPoints
        };
    }, [snapshots, isWeight]);

    const getY = (val: number) => 100 - ((val - graphMeta.min) / graphMeta.range) * 100;
    const getX = (index: number) => (index / (snapshots.length - 1)) * 100;

    return (
        <div className="metric-focus-view animate-in zoom-in-95 duration-300 flex flex-col gap-6">
            <div className="health-card glass overflow-hidden">
                <div className="card-header p-8 pb-0 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl" style={{ color: themeColor }}>
                            {isWeight ? 'Viktanalys' : 'Sömnanalys'}
                        </h2>
                        <p className="text-sm">
                            {isWeight ? 'Din resa mot målvikten.' : `Din återhämtning de senaste ${days} dagarna.`}
                        </p>
                    </div>
                </div>

                <div className="p-8 relative">
                    <div className="h-64 h-80-md w-full relative border-l border-b border-white/10 ml-6 mb-6">
                        {/* Y-Axis Labels */}
                        <div className="absolute -left-8 top-0 h-full flex flex-col justify-between text-[10px] text-slate-500 font-bold py-2">
                            <span>{graphMeta.max}</span>
                            <span>{Math.round(graphMeta.min + graphMeta.range / 2)}</span>
                            <span>{graphMeta.min}</span>
                        </div>

                        {/* Interactive Graph Area */}
                        <svg
                            className="w-full h-full z-10 overflow-visible"
                            preserveAspectRatio="none"
                            onMouseLeave={() => setHoverIndex(null)}
                        >
                            {/* Grid Lines */}
                            <line x1="0" y1="25%" x2="100%" y2="25%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                            <line x1="0" y1="75%" x2="100%" y2="75%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />

                            {/* Goal Line Sömn (8h) */}
                            {!isWeight && (
                                <line
                                    x1="0"
                                    y1={`${getY(8)}%`}
                                    x2="100%"
                                    y2={`${getY(8)}%`}
                                    stroke="#10b981"
                                    strokeWidth="1"
                                    strokeDasharray="4 2"
                                    opacity="0.5"
                                />
                            )}

                            {/* Data Rendering */}
                            {isWeight ? (
                                <>
                                    {/* Line Path */}
                                    <path
                                        d={graphMeta.points.length > 1 ?
                                            `M ${graphMeta.points.map(p => `${getX(p.i)}% ${getY(p.val)}%`).join(' L ')}`
                                            : ''}
                                        fill="none"
                                        stroke={themeColor}
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="drop-shadow-lg"
                                    />
                                    {/* Dots for all points */}
                                    {graphMeta.points.map((p, idx) => (
                                        <circle
                                            key={idx}
                                            cx={`${getX(p.i)}%`}
                                            cy={`${getY(p.val)}%`}
                                            r="4"
                                            fill="#1e293b"
                                            stroke={themeColor}
                                            strokeWidth="2"
                                        />
                                    ))}
                                </>
                            ) : (
                                // Sleep Bars
                                snapshots.map((s, i) => {
                                    const val = s.vitals.sleep || 0;
                                    if (val === 0) return null;
                                    return (
                                        <rect
                                            key={i}
                                            x={`${getX(i) - (40 / snapshots.length)}%`} // Center roughly
                                            y={`${getY(val)}%`}
                                            width={`${80 / snapshots.length}%`}
                                            height={`${100 - getY(val)}%`}
                                            fill={val >= 8 ? themeColor : 'rgba(14,165,233,0.4)'}
                                            rx="2"
                                        />
                                    );
                                })
                            )}

                            {/* Hover Overlay Columns */}
                            {snapshots.map((s, i) => (
                                <rect
                                    key={i}
                                    x={`${getX(i) - (50 / snapshots.length)}%`}
                                    y="0"
                                    width={`${100 / snapshots.length}%`}
                                    height="100%"
                                    fill="transparent"
                                    onMouseEnter={() => setHoverIndex(i)}
                                    className="cursor-crosshair hover:bg-white/5 transition-colors"
                                />
                            ))}

                            {/* Active Hover Tooltip */}
                            {hoverIndex !== null && snapshots[hoverIndex] && (
                                <g>
                                    <line
                                        x1={`${getX(hoverIndex)}%`}
                                        y1="0"
                                        x2={`${getX(hoverIndex)}%`}
                                        y2="100%"
                                        stroke="white"
                                        strokeOpacity="0.1"
                                    />
                                    {/* Tooltip implementation is easier in HTML overlay usually, but SVG works too */}
                                </g>
                            )}
                        </svg>

                        {/* HTML Tooltip Overlay */}
                        {hoverIndex !== null && snapshots[hoverIndex] && (
                            <div
                                className="absolute pointer-events-none z-50 bg-slate-900 border border-slate-700 p-2 rounded shadow-xl flex flex-col gap-1 min-w-[100px]"
                                style={{
                                    left: `${getX(hoverIndex)}%`,
                                    top: isWeight && snapshots[hoverIndex].weight ? `${getY(snapshots[hoverIndex].weight!)}%` : '50%',
                                    transform: 'translate(-50%, -120%)'
                                }}
                            >
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{snapshots[hoverIndex].date}</span>
                                <span className="text-lg font-black text-white">
                                    {isWeight ?
                                        (snapshots[hoverIndex].weight ? `${snapshots[hoverIndex].weight} kg` : 'Ingen vikt') :
                                        `${snapshots[hoverIndex].vitals.sleep || 0} h`
                                    }
                                </span>
                            </div>
                        )}

                        {/* X-Axis Labels */}
                        <div className="absolute w-full -bottom-6 flex justify-between text-[10px] text-slate-500 font-bold">
                            <span>{snapshots[0]?.date}</span>
                            <span>{snapshots[Math.floor(snapshots.length / 2)]?.date}</span>
                            <span>{snapshots[snapshots.length - 1]?.date}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 border-t border-white/5 bg-slate-950/40">
                    <div className="p-6 border-r border-white/5 text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {isWeight ? 'Startvikt' : 'Genomsnitt'}
                        </div>
                        <div className="text-xl font-black text-white">
                            {isWeight ? `${(snapshots.find(s => s.weight)?.weight || 0).toFixed(1)} kg` : `${stats.avgSleep.toFixed(1)}h`}
                        </div>
                    </div>
                    <div className="p-6 border-r border-white/5 text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {isWeight ? 'Nuvarande' : 'Mål-match'}
                        </div>
                        <div className="text-xl font-black" style={{ color: themeColor }}>
                            {isWeight
                                ? `${(tableData[0]?.value || 0).toFixed(1)} kg`
                                : `${Math.round((snapshots.filter(s => s.vitals.sleep >= 8).length / snapshots.length) * 100)}%`}
                        </div>
                    </div>
                    <div className="p-6 border-r border-white/5 text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {isWeight ? 'Trend' : 'Koffein avg'}
                        </div>
                        <div className={`text-xl font-black ${isWeight && stats.weightTrend > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {isWeight
                                ? `${stats.weightTrend > 0 ? '+' : ''}${stats.weightTrend.toFixed(1)} kg`
                                : `${stats.avgCaffeine.toFixed(1)}`}
                        </div>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-white/5 to-transparent text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Period</div>
                        <div className="text-xl font-black text-white">{days} Dagar</div>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="history-section glass p-6 rounded-2xl border border-white/5">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 opacity-60">Logghistorik</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] uppercase font-black text-slate-500 border-b border-white/5">
                                <th className="py-3 px-4">Datum</th>
                                <th className="py-3 px-4">Värde</th>
                                <th className="py-3 px-4 text-right">Åtgärder</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {tableData.map((item) => (
                                <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                    <td className="py-3 px-4 font-medium">
                                        {editingId === item.id ? (
                                            <input
                                                type="date"
                                                className="bg-slate-800 border-none rounded p-1 text-white text-xs"
                                                value={editDate}
                                                onChange={(e) => setEditDate(e.target.value)}
                                            />
                                        ) : item.date}
                                    </td>
                                    <td className="py-3 px-4">
                                        {editingId === item.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="bg-slate-800 border-none rounded p-1 text-white text-xs w-20"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                />
                                                <span className="text-[10px] opacity-40">{item.unit}</span>
                                            </div>
                                        ) : (
                                            <span className="font-black">{item.value} {item.unit}</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        {editingId === item.id ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleSave} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-500/30">Spara</button>
                                                <button onClick={() => setEditingId(null)} className="text-slate-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Avbryt</button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(item)} className="text-sky-400 hover:text-sky-300">
                                                    <EditIcon />
                                                </button>
                                                <button onClick={() => handleDelete(item.id, item.date)} className="text-rose-500 hover:text-rose-400">
                                                    <DeleteIcon />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function EditIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
}

function DeleteIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
}
