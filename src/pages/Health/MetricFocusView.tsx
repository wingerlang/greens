import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { DaySnapshot, HealthStats } from '../../utils/healthAggregator.ts';
import { WeightEntry, DailyVitals } from '../../models/types.ts';

interface MetricFocusViewProps {
    type: 'sleep' | 'weight';
    snapshots: DaySnapshot[];
    stats: HealthStats;
    days: number;
}

export function MetricFocusView({ type, snapshots, stats, days }: MetricFocusViewProps) {
    const { weightEntries, updateWeightEntry, deleteWeightEntry, updateVitals, addWeightEntry } = useData();
    const { settings } = useSettings();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [editDate, setEditDate] = useState<string>('');
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Prepare table data with grouping
    const groupedTableData = useMemo(() => {
        if (type === 'weight') {
            const raw = weightEntries
                .filter(w => snapshots.some(s => s.date === w.date));

            // Group by date
            const groups: { date: string, items: typeof raw }[] = [];
            raw.forEach(entry => {
                const existing = groups.find(g => g.date === entry.date);
                if (existing) {
                    existing.items.push(entry);
                } else {
                    groups.push({ date: entry.date, items: [entry] });
                }
            });

            return groups.map(g => {
                const avg = g.items.reduce((sum, item) => sum + item.weight, 0) / g.items.length;
                return {
                    date: g.date,
                    count: g.items.length,
                    average: avg,
                    items: g.items.map(i => ({ id: i.id, date: i.date, value: i.weight, unit: 'kg' }))
                };
            });
        } else {
            // Sleep is 1 entry per day (DailyVitals)
            return snapshots
                .filter(s => s.vitals.sleep > 0)
                .map(s => ({
                    date: s.date,
                    count: 1,
                    average: s.vitals.sleep || 0,
                    items: [{ id: s.date, date: s.date, value: s.vitals.sleep || 0, unit: 'h' }]
                }))
                .reverse();
        }
    }, [type, weightEntries, snapshots]);

    const handleEdit = (item: { id: string, date: string, value: number }) => {
        setEditingId(item.id);
        setEditValue(item.value.toString());
        setEditDate(item.date);
    };

    const handleNewEntry = (date: string) => {
        setEditingId('NEW_' + date);
        setEditValue('');
        setEditDate(date);

        // Auto-expand group if it exists
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.add(date);
            return next;
        });
    };

    const handleSave = async () => {
        if (!editingId) return;
        const val = parseFloat(editValue);
        if (isNaN(val)) return;

        if (editingId.startsWith('NEW_')) {
            // Create new entry
            if (type === 'weight') {
                await addWeightEntry(val, editDate);
            } else {
                updateVitals(editDate, { sleep: val });
            }
        } else {
            // Update existing
            if (type === 'weight') {
                updateWeightEntry(editingId, val, editDate);
            } else {
                updateVitals(editDate, { sleep: val });
            }
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

    const toggleGroup = (date: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    };

    const isWeight = type === 'weight';
    const themeColor = isWeight ? '#f43f5e' : '#0ea5e9';

    // Advanced Graph Calculations
    const graphMeta = useMemo(() => {
        const validPoints = snapshots.map((s, i) => ({
            val: isWeight ? s.weight : s.vitals.sleep,
            date: s.date,
            i
        })).filter(p => p.val !== undefined && p.val > 0) as { val: number, date: string, i: number }[];

        if (validPoints.length === 0) return { min: 0, max: 10, range: 10, points: [], trendPoints: [] };

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

        // Calculate Trend Line (Moving Average - 5 points)
        // Or simple exponential smoothing for smoother curve
        const trendPoints = snapshots.map((s, i) => {
            if (!isWeight) return null; // Only trend for weight for now

            // Get window of past valid weights
            const windowSize = 7;
            const pastWeights = snapshots
                .slice(Math.max(0, i - windowSize + 1), i + 1)
                .filter(snap => snap.weight !== undefined)
                .map(snap => snap.weight!);

            if (pastWeights.length === 0) return null;

            const avg = pastWeights.reduce((a, b) => a + b, 0) / pastWeights.length;
            return { val: avg, i };
        }).filter(p => p !== null) as { val: number, i: number }[];


        return {
            min,
            max,
            range,
            points: validPoints,
            trendPoints
        };
    }, [snapshots, isWeight]);

    // Comparison Stats
    const comparisonStats = useMemo(() => {
        if (!isWeight) return null;

        // Use the latest visible weight from the graph/snapshots as "Current"
        // This ensures what you see in the "Nuvarande" card matches the graph's end point.
        // Fallback to weightEntries[0] if no snapshots (e.g. empty range)
        const latestSnapshotWeight = snapshots.slice().reverse().find(s => s.weight !== undefined)?.weight;
        const latestWeight = latestSnapshotWeight ?? weightEntries[0]?.weight;

        if (!latestWeight) return null;

        const getDateWeight = (daysAgo: number) => {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysAgo);
            const dateStr = targetDate.toISOString().split('T')[0];

            // Find closest entry before or on this date
            // Since weightEntries are sorted desc, we look for first one <= dateStr
            return weightEntries.find(w => w.date <= dateStr)?.weight;
        };

        const prev7 = getDateWeight(7);
        const prev30 = getDateWeight(30);

        return {
            current: latestWeight,
            delta7: prev7 ? latestWeight - prev7 : 0,
            delta30: prev30 ? latestWeight - prev30 : 0,
            has7: !!prev7,
            has30: !!prev30
        };

    }, [weightEntries, snapshots, isWeight]);


    const getY = (val: number) => 100 - ((val - graphMeta.min) / graphMeta.range) * 100;
    const getX = (index: number) => (index / (snapshots.length - 1)) * 100;

    // Helper for multi-entry lookup
    const getEntriesForIndex = (index: number) => {
        const date = snapshots[index]?.date;
        if (!date) return [];
        if (isWeight) {
            return weightEntries.filter(w => w.date === date);
        }
        return []; // Sleep is single-entry
    };

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
                                    {/* Trend Line (Solid) */}
                                    {graphMeta.trendPoints.length > 1 && (
                                        <path
                                            d={`M ${graphMeta.trendPoints.map(p => `${getX(p.i)}% ${getY(p.val)}%`).join(' L ')}`}
                                            fill="none"
                                            stroke={themeColor}
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="drop-shadow-lg opacity-90"
                                        />
                                    )}

                                    {/* Raw Data Line (Dashed) */}
                                    <path
                                        d={graphMeta.points.length > 1 ?
                                            `M ${graphMeta.points.map(p => `${getX(p.i)}% ${getY(p.val)}%`).join(' L ')}`
                                            : ''}
                                        fill="none"
                                        stroke={themeColor}
                                        strokeWidth="2"
                                        strokeDasharray="4 4"
                                        strokeOpacity="0.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />

                                    {/* Dots for all points */}
                                    {graphMeta.points.map((p, idx) => (
                                        <circle
                                            key={idx}
                                            cx={`${getX(p.i)}%`}
                                            cy={`${getY(p.val)}%`}
                                            r="3"
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

                            {/* Hover/Click Overlay Columns */}
                            {snapshots.map((s, i) => (
                                <rect
                                    key={i}
                                    x={`${getX(i) - (50 / snapshots.length)}%`}
                                    y="0"
                                    width={`${100 / snapshots.length}%`}
                                    height="100%"
                                    fill="transparent"
                                    onMouseEnter={() => setHoverIndex(i)}
                                    // Only allow new entry if no data exists for this day
                                    onClick={() => (!isWeight || s.weight === undefined) && handleNewEntry(s.date)}
                                    className={`${(!isWeight || s.weight === undefined) ? 'cursor-pointer hover:bg-white/5' : ''} transition-colors`}
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
                                </g>
                            )}
                        </svg>

                        {/* HTML Tooltip Overlay */}
                        {hoverIndex !== null && snapshots[hoverIndex] && (
                            <div
                                className="absolute pointer-events-none z-50 bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl flex flex-col gap-1 min-w-[120px]"
                                style={{
                                    left: `${getX(hoverIndex)}%`,
                                    top: isWeight && snapshots[hoverIndex].weight ? `${getY(snapshots[hoverIndex].weight!)}%` : '50%',
                                    transform: 'translate(-50%, -120%)'
                                }}
                            >
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{snapshots[hoverIndex].date}</span>
                                {isWeight && getEntriesForIndex(hoverIndex!).length > 1 ? (
                                    <>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-black text-white">
                                                {snapshots[hoverIndex].weight} kg
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold">
                                                {getEntriesForIndex(hoverIndex!).length} mätningar
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            Trend: <span className="text-white font-bold">{graphMeta.trendPoints.find(p => p.i === hoverIndex)?.val.toFixed(1) || '--'} kg</span>
                                        </div>
                                        <div className="text-[9px] text-slate-600 mt-1 italic">
                                            Klicka för att se alla
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-black text-white">
                                                {isWeight ?
                                                    (snapshots[hoverIndex].weight ? `${snapshots[hoverIndex].weight} kg` : <span className="text-slate-500 text-sm font-normal">Klicka för att logga</span>) :
                                                    `${snapshots[hoverIndex].vitals.sleep || 0} h`
                                                }
                                            </span>
                                        </div>
                                    </>
                                )}
                                {isWeight && (
                                    <div className="text-[10px] text-slate-500">
                                        Trend: <span className="text-white font-bold">
                                            {graphMeta.trendPoints.find(p => p.i === hoverIndex)?.val.toFixed(1) || '--'} kg
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* X-Axis Labels */}
                        <div className="absolute w-full -bottom-6 h-6 relative font-bold text-[10px] text-slate-500">
                            {snapshots.map((s, i) => {
                                // Show every other label, but ALWAYS ensure the last one is visible
                                // Hide the second-to-last if it would overlap with the last (i.e. if length-2 is even)
                                const isLast = i === snapshots.length - 1;
                                const isSecondToLast = i === snapshots.length - 2;
                                const show = (i % 2 === 0 && !isSecondToLast) || isLast;

                                if (!show) return null;

                                return (
                                    <div
                                        key={i}
                                        className="absolute transform -translate-x-1/2 whitespace-nowrap"
                                        style={{ left: `${getX(i)}%` }}
                                    >
                                        {s.date.slice(5)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 border-t border-white/5 bg-slate-950/40">
                    <div className="p-6 border-r border-white/5 text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {isWeight ? 'Nuvarande' : 'Snitt'}
                        </div>
                        <div className="text-xl font-black text-white">
                            {isWeight
                                ? `${(comparisonStats?.current || 0).toFixed(1)} kg`
                                : `${stats.avgSleep.toFixed(1)}h`
                            }
                        </div>
                        {isWeight && (
                            <div className="text-[10px] text-slate-500 mt-1">Senaste logg</div>
                        )}
                    </div>

                    <div className="p-6 border-r border-white/5 text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {isWeight ? '7 Dagar' : 'Mål-match'}
                        </div>
                        <div className={`text-xl font-black ${isWeight ? ((comparisonStats?.delta7 || 0) <= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-sky-400'}`}>
                            {isWeight
                                ? `${(comparisonStats?.delta7 || 0) > 0 ? '+' : ''}${(comparisonStats?.delta7 || 0).toFixed(1)} kg`
                                : `${Math.round((snapshots.filter(s => s.vitals.sleep >= 8).length / snapshots.length) * 100)}%`
                            }
                        </div>
                        {isWeight && (
                            <div className="text-[10px] text-slate-500 mt-1">vs förra veckan</div>
                        )}
                    </div>

                    <div className="p-6 border-r border-white/5 text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            {isWeight ? '30 Dagar' : 'Koffein'}
                        </div>
                        <div className={`text-xl font-black ${isWeight ? ((comparisonStats?.delta30 || 0) <= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-emerald-400'}`}>
                            {isWeight
                                ? `${(comparisonStats?.delta30 || 0) > 0 ? '+' : ''}${(comparisonStats?.delta30 || 0).toFixed(1)} kg`
                                : `${stats.avgCaffeine.toFixed(1)}`
                            }
                        </div>
                        {isWeight && (
                            <div className="text-[10px] text-slate-500 mt-1">vs förra månaden</div>
                        )}
                    </div>

                    <div className="p-6 bg-gradient-to-br from-white/5 to-transparent text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Period</div>
                        <div className="text-xl font-black text-white">{days} Dagar</div>
                        {!isWeight && (
                            <div onClick={() => alert('Garmin synk startad (WIP)')} className="text-[10px] text-sky-400 mt-1 cursor-pointer hover:underline">
                                ↻ Synka Garmin
                            </div>
                        )}
                        {isWeight && (
                            <div className="text-[10px] text-slate-500 mt-1">Totalt: {stats.weightTrend > 0 ? '+' : ''}{stats.weightTrend.toFixed(1)} kg</div>
                        )}
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
                            {/* Logic for NEW ENTRY row */}
                            {editingId?.startsWith('NEW_') && (
                                <tr className="bg-emerald-500/5 border-b border-emerald-500/20 animate-in fade-in slide-in-from-top-2">
                                    <td className="py-3 px-4 text-emerald-400 font-bold">{editDate} (Ny)</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="0.1"
                                                autoFocus
                                                placeholder="0.0"
                                                className="bg-slate-800 border border-emerald-500/30 rounded p-1 text-white text-xs w-20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                            />
                                            <span className="text-[10px] opacity-40">{isWeight ? 'kg' : 'h'}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={handleSave} className="bg-emerald-500 text-slate-900 px-3 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-400 shadow-lg shadow-emerald-500/20">Spara</button>
                                            <button onClick={() => setEditingId(null)} className="text-slate-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-white/5">Avbryt</button>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {groupedTableData.map((group) => (
                                <React.Fragment key={group.date}>
                                    {/* Group Header Row */}
                                    <tr
                                        className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer select-none ${group.count > 1 ? 'bg-slate-800/20' : ''}`}
                                        onClick={() => group.count > 1 && toggleGroup(group.date)}
                                    >
                                        <td className="py-3 px-4 font-medium flex items-center gap-2">
                                            {group.count > 1 && (
                                                <span className={`text-[10px] text-slate-500 transition-transform ${expandedGroups.has(group.date) ? 'rotate-90' : ''}`}>▶</span>
                                            )}
                                            {group.date}
                                        </td>
                                        <td className="py-3 px-4">
                                            {group.count > 1 ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{group.average.toFixed(1)} {group.items[0].unit}</span>
                                                    <span className="text-[10px] bg-slate-700 px-1.5 rounded text-slate-400">{group.count} st</span>
                                                    <span className="text-[10px] text-slate-600">(Snitt)</span>
                                                </div>
                                            ) : (
                                                <span className="font-black">{group.items[0].value} {group.items[0].unit}</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {group.count === 1 && (
                                                // Single item actions
                                                <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(group.items[0]); }} className="text-sky-400 hover:text-sky-300">
                                                        <EditIcon />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(group.items[0].id, group.items[0].date); }} className="text-rose-500 hover:text-rose-400">
                                                        <DeleteIcon />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded Group Items OR Editing State */}
                                    {(expandedGroups.has(group.date) || group.count === 1) && group.items.map(item => {
                                        // If grouped single item, we handled display in header, but EDITING happens here?
                                        // Actually, if count=1 and NOT editing, we showed it in header.
                                        // If editing, we need the input.

                                        if (group.count === 1 && editingId !== item.id) return null; // Already shown in header

                                        return (
                                            <tr key={item.id} className={`${group.count > 1 ? 'bg-slate-900/50' : ''} border-b border-white/5`}>
                                                <td className="py-2 px-4 pl-8 text-xs text-slate-500">
                                                    {group.count > 1 ? `${item.date} (Logg)` : item.date}
                                                </td>
                                                <td className="py-2 px-4">
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
                                                        <span className="font-medium text-slate-300">{item.value} {item.unit}</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-4 text-right">
                                                    {editingId === item.id ? (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={handleSave} className="text-emerald-400 text-[10px] font-bold uppercase">Spara</button>
                                                            <button onClick={() => setEditingId(null)} className="text-slate-500 text-[10px] font-bold uppercase">Avbryt</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleEdit(item)} className="text-sky-400 hover:text-sky-300 scale-75">
                                                                <EditIcon />
                                                            </button>
                                                            <button onClick={() => handleDelete(item.id, item.date)} className="text-rose-500 hover:text-rose-400 scale-75">
                                                                <DeleteIcon />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
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
