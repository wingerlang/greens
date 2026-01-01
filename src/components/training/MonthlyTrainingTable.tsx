import React, { useState, useMemo } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { MonthlyCalendarModal } from './MonthlyCalendarModal.tsx';

interface MonthlyTrainingTableProps {
    exercises: ExerciseEntry[];
    year: number;
}

type TabType = 'all' | 'running' | 'strength' | 'cycling' | 'swimming' | 'other';

export function MonthlyTrainingTable({ exercises, year }: MonthlyTrainingTableProps) {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

    const months = useMemo(() => [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ], []);

    const data = useMemo(() => {
        // Initialize monthly buckets
        const buckets = Array(12).fill(0).map(() => ({
            selected: {
                distance: 0,
                duration: 0,
                count: 0,
                tonnage: 0
            },
            categories: {
                cardio: { distance: 0, duration: 0, count: 0 },
                strength: { tonnage: 0, duration: 0, count: 0 },
                other: { duration: 0, count: 0 }
            },
            total: {
                count: 0,
                duration: 0
            }
        }));

        exercises.forEach(e => {
            const date = new Date(e.date);
            const month = date.getMonth();
            const type = e.type.toLowerCase().trim();

            // Total stats (all training)
            buckets[month].total.count++;
            buckets[month].total.duration += e.durationMinutes;

            // Category Aggregation for 'All' view - robust matching
            const cardioTags = ['running', 'löpning', 'run', 'löp', 'cycling', 'cykling', 'cycle', 'cyk', 'swimming', 'simning', 'swim', 'sim', 'hyrox'];
            const strengthTags = ['strength', 'styrka', 'gym', 'styrk'];

            const isCardio = cardioTags.some(t => type.includes(t));
            const isStrength = strengthTags.some(t => type.includes(t));

            if (isCardio) {
                buckets[month].categories.cardio.count++;
                buckets[month].categories.cardio.distance += e.distance || 0;
                buckets[month].categories.cardio.duration += e.durationMinutes;
            } else if (isStrength) {
                buckets[month].categories.strength.count++;
                buckets[month].categories.strength.tonnage += e.tonnage || 0;
                buckets[month].categories.strength.duration += e.durationMinutes;
            } else {
                buckets[month].categories.other.count++;
                buckets[month].categories.other.duration += e.durationMinutes;
            }

            // Selected Activity Stats (for individual tabs)
            let matchesTab = false;
            if (activeTab === 'running') matchesTab = type === 'running' || type === 'löpning';
            else if (activeTab === 'strength') matchesTab = type === 'strength' || type === 'styrka' || type === 'gym';
            else if (activeTab === 'cycling') matchesTab = type === 'cycling' || type === 'cykling';
            else if (activeTab === 'swimming') matchesTab = type === 'swimming' || type === 'simning';
            else if (activeTab === 'other') matchesTab = !['running', 'löpning', 'strength', 'styrka', 'cycling', 'cykling', 'swimming', 'simning', 'gym'].includes(type);

            if (matchesTab) {
                buckets[month].selected.count++;
                buckets[month].selected.duration += e.durationMinutes;
                buckets[month].selected.distance += e.distance || 0;
                buckets[month].selected.tonnage += e.tonnage || 0;
            }
        });

        return buckets;
    }, [exercises, activeTab]);

    // Format helpers
    const fmtDur = (min: number) => {
        if (min === 0) return '-';
        const h = Math.floor(min / 60);
        const m = Math.round(min % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const fmtDist = (km: number) => km > 0 ? km.toFixed(1).replace('.', ',') + ' km' : '-';

    const fmtPace = (dist: number, min: number) => {
        if (dist <= 0 || min <= 0) return '-';
        const paceDec = min / dist;
        const pMin = Math.floor(paceDec);
        const pSec = Math.round((paceDec % 1) * 60);
        return `${pMin}:${pSec.toString().padStart(2, '0')} min/km`;
    };

    const fmtTon = (ton: number) => ton > 0 ? (ton / 1000).toFixed(1).replace('.', ',') + ' ton' : '-';

    // Summary row
    const totals = useMemo(() => {
        return data.reduce((acc, curr) => ({
            selected: {
                distance: acc.selected.distance + curr.selected.distance,
                duration: acc.selected.duration + curr.selected.duration,
                count: acc.selected.count + curr.selected.count,
                tonnage: acc.selected.tonnage + curr.selected.tonnage,
            },
            categories: {
                cardio: {
                    distance: acc.categories.cardio.distance + curr.categories.cardio.distance,
                    duration: acc.categories.cardio.duration + curr.categories.cardio.duration,
                    count: acc.categories.cardio.count + curr.categories.cardio.count,
                },
                strength: {
                    tonnage: acc.categories.strength.tonnage + curr.categories.strength.tonnage,
                    duration: acc.categories.strength.duration + curr.categories.strength.duration,
                    count: acc.categories.strength.count + curr.categories.strength.count,
                },
                other: {
                    duration: acc.categories.other.duration + curr.categories.other.duration,
                    count: acc.categories.other.count + curr.categories.other.count,
                }
            },
            total: {
                count: acc.total.count + curr.total.count,
                duration: acc.total.duration + curr.total.duration
            }
        }), {
            selected: { distance: 0, duration: 0, count: 0, tonnage: 0 },
            categories: {
                cardio: { distance: 0, duration: 0, count: 0 },
                strength: { tonnage: 0, duration: 0, count: 0 },
                other: { duration: 0, count: 0 }
            },
            total: { count: 0, duration: 0 }
        });
    }, [data]);

    return (
        <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-sm">
            {/* Tabs */}
            <div className="flex gap-2 p-4 border-b border-white/5 bg-slate-900/50 overflow-x-auto">
                {[
                    { id: 'all', label: 'Allt', color: 'bg-amber-500' },
                    { id: 'running', label: 'Löpning', color: 'bg-emerald-500' },
                    { id: 'strength', label: 'Styrka', color: 'bg-indigo-500' },
                    { id: 'cycling', label: 'Cykel', color: 'bg-sky-500' },
                    { id: 'swimming', label: 'Simning', color: 'bg-cyan-500' },
                    { id: 'other', label: 'Övrigt', color: 'bg-slate-500' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${activeTab === tab.id
                            ? `${tab.color} text-white shadow-lg shadow-${tab.color}/20`
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Header */}
            <div className="grid grid-cols-[100px_1fr] bg-slate-900/80 text-xs uppercase font-bold text-slate-500 border-b border-white/10">
                <div className="p-3"></div> {/* Month col */}
                <div className="grid grid-cols-[1.6fr_0.4fr] divide-x divide-white/5">
                    <div className="text-center p-2 text-white/90">
                        {activeTab === 'all' ? 'Sammanställning' :
                            activeTab === 'running' ? 'Löpning' :
                                activeTab === 'strength' ? 'Styrka' :
                                    activeTab === 'cycling' ? 'Cykling' :
                                        activeTab === 'swimming' ? 'Simning' : 'Vald Aktivitet'}
                    </div>
                    <div className="text-center p-2 text-slate-500 text-[9px] bg-slate-900/30 flex items-center justify-center">TOTALT</div>
                </div>
            </div>

            {/* Sub-Header */}
            <div className="grid grid-cols-[100px_1fr] text-[10px] uppercase font-bold text-slate-500 bg-slate-900/30 border-b border-white/5">
                <div className="p-3">Månad</div>
                <div className="grid grid-cols-[1.6fr_0.4fr] divide-x divide-white/5">
                    {/* Specific Stats Columns */}
                    <div className={`grid ${activeTab === 'all' ? 'grid-cols-[2fr_2fr_1fr_1fr]' : activeTab === 'strength' ? 'grid-cols-4' : 'grid-cols-5'}`}>
                        {activeTab === 'all' ? (
                            <>
                                <div className="grid grid-cols-3 divide-x divide-white/5 border-r border-white/5">
                                    <div className="p-2 text-center text-emerald-500/70">Km</div>
                                    <div className="p-2 text-center text-emerald-500/70">H</div>
                                    <div className="p-2 text-center text-emerald-500/70">St</div>
                                </div>
                                <div className="grid grid-cols-3 divide-x divide-white/5 border-r border-white/5">
                                    <div className="p-2 text-center text-indigo-500/70">Ton</div>
                                    <div className="p-2 text-center text-indigo-500/70">H</div>
                                    <div className="p-2 text-center text-indigo-500/70">St</div>
                                </div>
                                <div className="p-2 text-right">Övrigt (h)</div>
                                <div className="p-2 text-right">% Andel</div>
                            </>
                        ) : activeTab === 'strength' ? (
                            <>
                                <div className="p-2 text-right">Volym</div>
                                <div className="p-2 text-right">Tid</div>
                                <div className="p-2 text-right">Pass</div>
                                <div className="p-2 text-right">Ton/Pass</div>
                            </>
                        ) : (
                            <>
                                <div className="p-2 text-right">Distans</div>
                                <div className="p-2 text-right">Tid</div>
                                <div className="p-2 text-right">Tempo</div>
                                <div className="p-2 text-right">Pass</div>
                                <div className="p-2 text-right">Km/Pass</div>
                            </>
                        )}
                    </div>
                    {/* Total Stats Columns */}
                    <div className="grid grid-cols-2 bg-slate-900/30 text-[9px]">
                        <div className="p-2 text-right">Pass</div>
                        <div className="p-2 text-right">Tid</div>
                    </div>
                </div>
            </div>

            {/* Rows with Collapsed Empty Months */}
            <div className="divide-y divide-white/5">
                {(() => {
                    const rows = [];
                    let emptyStart: number | null = null;

                    for (let i = 0; i < 12; i++) {
                        const row = data[i];
                        const isEmpty = row.total.count === 0 && row.selected.count === 0;

                        if (isEmpty) {
                            if (emptyStart === null) emptyStart = i;
                        } else {
                            // Flush any pending empty rows
                            if (emptyStart !== null) {
                                const end = i - 1;
                                const label = emptyStart === end
                                    ? months[emptyStart]
                                    : `${months[emptyStart]} – ${months[end]}`;

                                rows.push(
                                    <div key={`empty-${emptyStart}`} className="text-xs text-slate-600 bg-black/20 p-3 italic text-center">
                                        Ingen träning registrerad under {label}
                                    </div>
                                );
                                emptyStart = null;
                            }

                            // Render Data Row
                            // Check if month has race (across all years in provided set)
                            const hasRace = exercises.some(e =>
                                new Date(e.date).getMonth() === i &&
                                e.subType === 'race'
                            );

                            rows.push(
                                <div
                                    key={months[i]}
                                    onClick={() => setSelectedMonth(i)}
                                    className={`grid grid-cols-[100px_1fr] text-sm group hover:bg-white/[0.05] transition-colors cursor-pointer active:scale-[0.99] duration-100 ${hasRace ? 'bg-amber-500/5' : ''
                                        }`}
                                >
                                    <div className="p-3 text-slate-400 font-medium group-hover:text-white flex items-center gap-2">
                                        {hasRace && <span className="text-amber-400 animate-pulse text-xs">🏆</span>}
                                        {months[i]}
                                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-sky-400 transition-opacity">↗</span>
                                    </div>
                                    <div className="grid grid-cols-[1.6fr_0.4fr] divide-x divide-white/5 pointer-events-none">
                                        {/* Specific Data */}
                                        <div className={`grid ${activeTab === 'all' ? 'grid-cols-[2fr_2fr_1fr_1fr]' : activeTab === 'strength' ? 'grid-cols-4' : 'grid-cols-5'}`}>
                                            {activeTab === 'all' ? (
                                                <>
                                                    <div className="grid grid-cols-3 divide-x divide-white/5 border-r border-white/5 font-mono text-[11px]">
                                                        <div className="p-3 text-right text-emerald-400">
                                                            {row.categories.cardio.distance > 0 ? row.categories.cardio.distance.toFixed(1).replace('.', ',') : '-'}
                                                        </div>
                                                        <div className="p-3 text-right text-slate-300">
                                                            {row.categories.cardio.duration > 0 ? fmtDur(row.categories.cardio.duration) : '-'}
                                                        </div>
                                                        <div className="p-3 text-right text-slate-500">
                                                            {row.categories.cardio.count || '-'}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 divide-x divide-white/5 border-r border-white/5 font-mono text-[11px]">
                                                        <div className="p-3 text-right text-indigo-400">
                                                            {row.categories.strength.tonnage > 0 ? (row.categories.strength.tonnage / 1000).toFixed(1).replace('.', ',') : '-'}
                                                        </div>
                                                        <div className="p-3 text-right text-slate-300">
                                                            {row.categories.strength.duration > 0 ? fmtDur(row.categories.strength.duration) : '-'}
                                                        </div>
                                                        <div className="p-3 text-right text-slate-500">
                                                            {row.categories.strength.count || '-'}
                                                        </div>
                                                    </div>
                                                    <div className="p-3 text-right text-slate-500 font-mono text-[11px]">
                                                        {row.categories.other.duration > 0 ? fmtDur(row.categories.other.duration) : '-'}
                                                    </div>
                                                    <div className="p-3 text-right text-sky-500/50 font-mono text-[10px] font-bold">
                                                        {totals.total.count > 0 ? (row.total.count / totals.total.count * 100).toFixed(0) + '%' : '-'}
                                                    </div>
                                                </>
                                            ) : activeTab === 'strength' ? (
                                                <>
                                                    <div className="p-3 text-right text-indigo-300 font-mono">{fmtTon(row.selected.tonnage)}</div>
                                                    <div className="p-3 text-right font-mono">{fmtDur(row.selected.duration)}</div>
                                                    <div className="p-3 text-right font-mono">{row.selected.count || '-'} <span className="text-xs text-slate-600">st</span></div>
                                                    <div className="p-3 text-right text-slate-400 font-mono">
                                                        {row.selected.count > 0 ? ((row.selected.tonnage / 1000) / row.selected.count).toFixed(1) + ' t' : '-'}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="p-3 text-right text-emerald-300 font-mono">{fmtDist(row.selected.distance)}</div>
                                                    <div className="p-3 text-right font-mono">{fmtDur(row.selected.duration)}</div>
                                                    <div className="p-3 text-right text-slate-400 font-mono">{fmtPace(row.selected.distance, row.selected.duration)}</div>
                                                    <div className="p-3 text-right font-mono">{row.selected.count || '-'} <span className="text-xs text-slate-600">st</span></div>
                                                    <div className="p-3 text-right text-slate-400 font-mono">
                                                        {row.selected.count > 0 ? (row.selected.distance / row.selected.count).toFixed(1) + ' km' : '-'}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {/* Total Data */}
                                        <div className="grid grid-cols-2 bg-slate-900/30">
                                            <div className="p-3 text-right font-mono text-slate-300">{row.total.count || '-'} <span className="text-xs text-slate-600">st</span></div>
                                            <div className="p-3 text-right font-mono text-slate-300">{fmtDur(row.total.duration)}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    }

                    // Flush trailing empty rows
                    if (emptyStart !== null) {
                        const end = 11;
                        const label = emptyStart === end
                            ? months[emptyStart]
                            : `${months[emptyStart]} – ${months[end]}`;

                        rows.push(
                            <div key={`empty-${emptyStart}`} className="text-xs text-slate-600 bg-black/20 p-3 italic text-center">
                                Ingen träning registrerad under {label}
                            </div>
                        );
                    }

                    return rows;
                })()}

                {/* Footer Totals */}
                <div className="grid grid-cols-[100px_1fr] text-sm font-bold bg-white/5 border-t border-white/10">
                    <div className="p-3 text-white">Totalt:</div>
                    <div className="grid grid-cols-[1.6fr_0.4fr] divide-x divide-white/5">
                        <div className={`grid ${activeTab === 'all' ? 'grid-cols-[2fr_2fr_1fr_1fr]' : activeTab === 'strength' ? 'grid-cols-4' : 'grid-cols-5'}`}>
                            {activeTab === 'all' ? (
                                <>
                                    <div className="grid grid-cols-3 divide-x divide-white/5 border-r border-white/5">
                                        <div className="p-3 text-right text-emerald-400">
                                            {totals.categories.cardio.distance > 0 ? totals.categories.cardio.distance.toFixed(1).replace('.', ',') : '-'}
                                        </div>
                                        <div className="p-3 text-right text-slate-300">
                                            {totals.categories.cardio.duration > 0 ? fmtDur(totals.categories.cardio.duration) : '-'}
                                        </div>
                                        <div className="p-3 text-right text-slate-500">
                                            {totals.categories.cardio.count || '-'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 divide-x divide-white/5 border-r border-white/5">
                                        <div className="p-3 text-right text-indigo-400">
                                            {totals.categories.strength.tonnage > 0 ? (totals.categories.strength.tonnage / 1000).toFixed(1).replace('.', ',') : '-'}
                                        </div>
                                        <div className="p-3 text-right text-slate-300">
                                            {totals.categories.strength.duration > 0 ? fmtDur(totals.categories.strength.duration) : '-'}
                                        </div>
                                        <div className="p-3 text-right text-slate-500">
                                            {totals.categories.strength.count || '-'}
                                        </div>
                                    </div>
                                    <div className="p-3 text-right text-slate-500">
                                        {totals.categories.other.duration > 0 ? fmtDur(totals.categories.other.duration) : '-'}
                                    </div>
                                    <div className="p-3 text-right text-white">
                                        100%
                                    </div>
                                </>
                            ) : activeTab === 'strength' ? (
                                <>
                                    <div className="p-3 text-right text-indigo-400">{fmtTon(totals.selected.tonnage)}</div>
                                    <div className="p-3 text-right text-white">{fmtDur(totals.selected.duration)}</div>
                                    <div className="p-3 text-right text-white">{totals.selected.count} st</div>
                                    <div className="p-3 text-right text-slate-400">
                                        {totals.selected.count > 0 ? ((totals.selected.tonnage / 1000) / totals.selected.count).toFixed(1) + ' t' : '-'}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 text-right text-emerald-400">{fmtDist(totals.selected.distance)}</div>
                                    <div className="p-3 text-right text-white">{fmtDur(totals.selected.duration)}</div>
                                    <div className="p-3 text-right text-slate-400">{fmtPace(totals.selected.distance, totals.selected.duration)}</div>
                                    <div className="p-3 text-right text-white">{totals.selected.count} st</div>
                                    <div className="p-3 text-right text-slate-400">
                                        {totals.selected.count > 0 ? (totals.selected.distance / totals.selected.count).toFixed(1) + ' km' : '-'}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="grid grid-cols-2 bg-slate-900/30">
                            <div className="p-3 text-right text-white">{totals.total.count} st</div>
                            <div className="p-3 text-right text-white">{fmtDur(totals.total.duration)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedMonth !== null && (
                <MonthlyCalendarModal
                    monthIndex={selectedMonth}
                    year={year}
                    exercises={exercises}
                    onClose={() => setSelectedMonth(null)}
                />
            )}
        </div>
    );
}
