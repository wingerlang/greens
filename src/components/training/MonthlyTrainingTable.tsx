import React, { useState, useMemo } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';

interface MonthlyTrainingTableProps {
    exercises: ExerciseEntry[];
    year: number;
    initialCalendarMonth?: number;
    initialCalendarDay?: number;
    onExerciseClick?: (exercise: ExerciseEntry) => void;
}

type TabType = 'all' | 'running' | 'strength' | 'cycling' | 'swimming' | 'other';

interface MonthBucket {
    period: string;
    year: number;
    monthIdx: number;
    selected: { distance: number; duration: number; count: number; tonnage: number; };
    categories: {
        cardio: { distance: number; duration: number; count: number; };
        strength: { tonnage: number; duration: number; count: number; };
        other: { duration: number; count: number; breakdown: Record<string, { duration: number, count: number }>; };
    };
    total: { count: number; duration: number; distance: number; tonnage: number; };
}

export function MonthlyTrainingTable({ exercises, year, initialCalendarMonth, initialCalendarDay, onExerciseClick }: MonthlyTrainingTableProps) {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
    const navigate = useNavigate();

    const handleToggleMonthSelection = (period: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelection = new Set(selectedMonths);
        if (newSelection.has(period)) {
            newSelection.delete(period);
        } else {
            newSelection.add(period);
        }
        setSelectedMonths(newSelection);
        if (newSelection.size > 0) setSelectionMode(true);
    };

    const handleExportSelected = () => {
        if (selectedMonths.size === 0) return;

        const selectedExercises = exercises.filter(e => {
            const d = new Date(e.date);
            const p = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            return selectedMonths.has(p);
        }).sort((a, b) => a.date.localeCompare(b.date));

        // Group by day for "one row per day"
        const byDay: Record<string, ExerciseEntry[]> = {};
        selectedExercises.forEach(ex => {
            if (!byDay[ex.date]) byDay[ex.date] = [];
            byDay[ex.date].push(ex);
        });

        const rows = Object.entries(byDay).map(([date, exs]) => {
            const summary = exs.map(ex => {
                const parts = [];
                const isRace = ex.subType === 'race' || ex.subType === 'competition' || ex.subType === 'simulation' || ex.subType === 'simulering';

                if (isRace) parts.push('[TÄVLING]');
                if (ex.extractedFromId) parts.push('[UTDRAG]');
                parts.push(`[${ex.type}]`);

                if (ex.distance) parts.push(`${ex.distance}km`);

                if (ex.durationMinutes) {
                    const h = Math.floor(ex.durationMinutes / 60);
                    const m = Math.floor(ex.durationMinutes % 60);
                    const s = Math.round((ex.durationMinutes % 1) * 60);
                    parts.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                }

                if (ex.tonnage) parts.push(`${(ex.tonnage / 1000).toFixed(1)}t`);
                if ((ex as any).averageHeartrate) parts.push(`${(ex as any).averageHeartrate}bpm`);
                if (ex.notes) parts.push(`(${ex.notes})`);
                return parts.join(' ');
            }).join(' | ');
            return `${date}: ${summary}`;
        });

        const sortedPeriods = Array.from(selectedMonths).sort();
        const finalHeader = `Träningsdata (${sortedPeriods.join(', ')})\n`;
        const finalStr = finalHeader + rows.join('\n');

        navigator.clipboard.writeText(finalStr);
        alert(`Kopierade ${rows.length} dagar med träning till urklipp för AI-analys!`);
    };

    // Remove old selectedMonth sync hook

    const months = useMemo(() => [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ], []);

    const data = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-indexed
        const currentPeriodStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

        const periodsFound = new Set<string>();

        // Strictly limit to the targeted year's months
        const maxMonth = year < currentYear ? 12 : (year === currentYear ? currentMonth : 0);
        for (let m = 1; m <= maxMonth; m++) {
            periodsFound.add(`${year}-${m.toString().padStart(2, '0')}`);
        }

        const sortedPeriods = Array.from(periodsFound).sort((a, b) => b.localeCompare(a)); // Descending (Dec -> Jan)

        const buckets: Record<string, MonthBucket & { hasRace: boolean }> = {};
        sortedPeriods.forEach(p => {
            const [y, m] = p.split('-').map(Number);
            buckets[p] = {
                period: p,
                year: y,
                monthIdx: m - 1,
                hasRace: false,
                selected: { distance: 0, duration: 0, count: 0, tonnage: 0 },
                categories: {
                    cardio: { distance: 0, duration: 0, count: 0 },
                    strength: { tonnage: 0, duration: 0, count: 0 },
                    other: { duration: 0, count: 0, breakdown: {} }
                },
                total: { count: 0, duration: 0, distance: 0, tonnage: 0 }
            };
        });

        const cardioTags = ['running', 'löpning', 'run', 'löp', 'cycling', 'cykling', 'cycle', 'cyk', 'swimming', 'simning', 'swim', 'sim', 'hyrox'];
        const strengthTags = ['strength', 'styrka', 'gym', 'styrk'];

        // Pre-filter exercises by year to avoid unnecessary processing
        const yearExercises = exercises.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === year;
        });

        yearExercises.forEach(e => {
            const date = new Date(e.date);
            const period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const bucket = buckets[period];
            if (!bucket) return;

            const type = e.type.toLowerCase().trim();
            const isCardio = cardioTags.some(t => type.includes(t));
            const isStrength = strengthTags.some(t => type.includes(t));

            if (e.subType === 'race') bucket.hasRace = true;

            bucket.total.count++;
            bucket.total.duration += e.durationMinutes;
            if (type.includes('run') || type.includes('löp')) {
                bucket.total.distance += e.distance || 0;
            }
            bucket.total.tonnage += e.tonnage || 0;

            if (isCardio) {
                bucket.categories.cardio.count++;
                if (type.includes('run') || type.includes('löp')) {
                    bucket.categories.cardio.distance += e.distance || 0;
                }
                bucket.categories.cardio.duration += e.durationMinutes;
            } else if (isStrength) {
                bucket.categories.strength.count++;
                bucket.categories.strength.tonnage += e.tonnage || 0;
                bucket.categories.strength.duration += e.durationMinutes;
            } else {
                bucket.categories.other.count++;
                bucket.categories.other.duration += e.durationMinutes;
                const displayType = type || 'Annat';
                if (!bucket.categories.other.breakdown[displayType]) {
                    bucket.categories.other.breakdown[displayType] = { duration: 0, count: 0 };
                }
                bucket.categories.other.breakdown[displayType].count++;
                bucket.categories.other.breakdown[displayType].duration += e.durationMinutes;
            }

            // Tab Selection Logic
            let matchesTab = false;
            if (activeTab === 'all') matchesTab = true;
            else if (activeTab === 'running') matchesTab = type.includes('run') || type.includes('löp');
            else if (activeTab === 'strength') matchesTab = isStrength;
            else if (activeTab === 'cycling') matchesTab = type.includes('cycl') || type.includes('cyk');
            else if (activeTab === 'swimming') matchesTab = type.includes('swim') || type.includes('sim');
            else if (activeTab === 'other') matchesTab = !isCardio && !isStrength;

            if (matchesTab) {
                bucket.selected.count++;
                bucket.selected.duration += e.durationMinutes;
                bucket.selected.distance += e.distance || 0;
                bucket.selected.tonnage += e.tonnage || 0;
            }
        });

        // Final Filter & Reverse Sorting
        return Object.values(buckets)
            .filter(b => {
                if (b.total.count > 0) return true;
                // Only show empty months if they belong to the current focus year AND aren't in the future
                if (b.year === year && b.period <= currentPeriodStr) return true;
                return false;
            })
            .sort((a, b) => b.period.localeCompare(a.period)); // Newest First (Desc)
    }, [exercises, year, activeTab]);

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
                    breakdown: Object.entries(curr.categories.other.breakdown).reduce((b, [k, v]) => {
                        b[k] = {
                            duration: (b[k]?.duration || 0) + v.duration,
                            count: (b[k]?.count || 0) + v.count
                        };
                        return b;
                    }, { ...acc.categories.other.breakdown })
                }
            },
            total: {
                count: acc.total.count + curr.total.count,
                duration: acc.total.duration + curr.total.duration,
                distance: acc.total.distance + curr.total.distance,
                tonnage: acc.total.tonnage + curr.total.tonnage,
            }
        }), {
            selected: { distance: 0, duration: 0, count: 0, tonnage: 0 },
            categories: {
                cardio: { distance: 0, duration: 0, count: 0 },
                strength: { tonnage: 0, duration: 0, count: 0 },
                other: { duration: 0, count: 0, breakdown: {} as Record<string, { duration: number, count: number }> }
            },
            total: { count: 0, duration: 0, distance: 0, tonnage: 0 }
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

                <div className="flex-1"></div>

                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setSelectionMode(!selectionMode);
                            if (selectionMode) setSelectedMonths(new Set());
                        }}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${selectionMode
                            ? 'bg-sky-500/10 border-sky-500/50 text-sky-400'
                            : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                            }`}
                    >
                        {selectionMode ? 'Avbryt Val' : 'Välj Månader'}
                    </button>
                    {selectionMode && selectedMonths.size > 0 && (
                        <button
                            onClick={handleExportSelected}
                            className="px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            Kopiera för AI ({selectedMonths.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[150px_1fr] bg-slate-900/80 text-xs uppercase font-bold text-slate-500 border-b border-white/10">
                <div className="p-3"></div> {/* Month col */}
                <div className="grid grid-cols-[1fr_300px] divide-x divide-white/5">
                    <div className="text-center p-2 text-white/90">
                        {activeTab === 'all' ? 'Sammanställning' :
                            activeTab === 'running' ? 'Löpning' :
                                activeTab === 'strength' ? 'Styrka' :
                                    activeTab === 'cycling' ? 'Cykling' :
                                        activeTab === 'swimming' ? 'Simning' : 'Vald Aktivitet'}
                    </div>
                    <div className="text-center p-2 text-slate-500 text-[9px] bg-slate-900/40 flex items-center justify-center tracking-[0.2em] font-black">TOTALT</div>
                </div>
            </div>

            {/* Sub-Header */}
            <div className="grid grid-cols-[150px_1fr] text-[10px] uppercase font-bold text-slate-500 bg-slate-900/30 border-b border-white/5">
                <div className="p-3 flex items-center gap-2 text-slate-400">
                    {selectionMode && (
                        <div
                            className="w-4 h-4 rounded border border-white/30 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                            onClick={() => {
                                if (selectedMonths.size === data.filter(r => r.total.count > 0).length) {
                                    setSelectedMonths(new Set());
                                } else {
                                    const allWithData = new Set<string>();
                                    data.forEach(r => { if (r.total.count > 0) allWithData.add(r.period); });
                                    setSelectedMonths(allWithData);
                                }
                            }}
                        >
                            <div className={`w-2 h-2 rounded-sm bg-sky-400 transition-all ${selectedMonths.size > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
                        </div>
                    )}
                    Månad
                    {activeTab !== 'all' && <span className="text-[8px] opacity-60 ml-1">(Filtrerat)</span>}
                </div>
                <div className="grid grid-cols-[1fr_300px] divide-x divide-white/5">
                    {/* Specific Stats Columns */}
                    <div className={`grid ${activeTab === 'all' ? 'grid-cols-[3fr_3fr_1.5fr_1.5fr]' : activeTab === 'strength' ? 'grid-cols-4' : 'grid-cols-5'}`}>
                        {activeTab === 'all' ? (
                            <>
                                <div className="p-2 text-right border-r border-white/5">
                                    <div className="font-bold mb-0.5 text-emerald-400 flex justify-end items-center gap-1"><span>🏃</span> Kondition</div>
                                    <div className="text-emerald-500/70">Distans <span className="text-slate-600">•</span> Tid <span className="text-slate-600">•</span> Pass</div>
                                </div>
                                <div className="p-2 text-right border-r border-white/5">
                                    <div className="font-bold mb-0.5 text-indigo-400 flex justify-end items-center gap-1"><span>💪</span> Styrka</div>
                                    <div className="text-indigo-500/70">Volym <span className="text-slate-600">•</span> Tid <span className="text-slate-600">•</span> Pass</div>
                                </div>
                                <div className="p-2 text-right border-r border-white/5">
                                    <div className="font-bold mb-0.5 text-slate-300 flex justify-end items-center gap-1"><span>🧩</span> Övrigt</div>
                                    <div className="text-slate-500/70">Tid <span className="text-slate-600">•</span> Pass</div>
                                </div>
                                <div className="p-2 text-right">
                                    <div className="font-bold mb-0.5 text-sky-400 flex justify-end items-center gap-1"><span>📊</span> Fördelning</div>
                                    <div className="text-sky-500/70">Andel av tid</div>
                                </div>
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
                    <div className="grid grid-cols-4 bg-slate-900/40 text-[9px]">
                        <div className="p-2 text-right">Pass</div>
                        <div className="p-2 text-right">Tid</div>
                        <div className="p-2 text-right">Distans</div>
                        <div className="p-2 text-right">Volym</div>
                    </div>
                </div>
            </div>

            {/* Rows with Collapsed Empty Months */}
            <div className="divide-y divide-white/5">
                {(() => {
                    const rows = [];
                    let emptyStart: number | null = null;

                    for (let i = 0; i < data.length; i++) {
                        const row = data[i];
                        const isEmpty = row.total.count === 0 && row.selected.count === 0;

                        if (isEmpty && !selectionMode) {
                            if (emptyStart === null) emptyStart = i;
                        } else {
                            // Flush any pending empty rows
                            if (emptyStart !== null) {
                                const end = i - 1;
                                const label = emptyStart === end
                                    ? `${months[data[emptyStart].monthIdx]} ${data[emptyStart].year}`
                                    : `${months[data[emptyStart].monthIdx]} ${data[emptyStart].year} – ${months[data[end].monthIdx]} ${data[end].year}`;

                                rows.push(
                                    <div key={`empty-${data[emptyStart].period}`} className="text-xs text-slate-600 bg-black/20 p-3 italic text-center">
                                        Ingen träning registrerad under {label}
                                    </div>
                                );
                                emptyStart = null;
                            }

                            // Render Data Row
                            rows.push(
                                <div
                                    key={row.period}
                                    onClick={(e) => {
                                        if (selectionMode) {
                                            handleToggleMonthSelection(row.period, e);
                                        } else {
                                            navigate({
                                                pathname: `/träning/${row.year}/${months[row.monthIdx].toLowerCase()}`,
                                                search: window.location.search
                                            }, { replace: true });
                                            
                                            // Scroll to top
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }}
                                    className={`grid grid-cols-[150px_1fr] text-sm group hover:bg-white/[0.05] transition-colors cursor-pointer active:scale-[0.99] duration-100 ${row.hasRace ? 'bg-amber-500/5' : ''
                                        } ${selectedMonths.has(row.period) ? 'bg-sky-500/10' : ''}`}
                                >
                                    <div className="p-3 text-slate-400 font-medium group-hover:text-white flex items-center gap-2 overflow-hidden shrink-0 border-r border-white/5">
                                        {selectionMode ? (
                                            <div
                                                onClick={(e) => handleToggleMonthSelection(row.period, e)}
                                                className={`shrink-0 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${selectedMonths.has(row.period)
                                                    ? 'bg-sky-500 border-sky-400 shadow-lg shadow-sky-500/20'
                                                    : 'bg-slate-800 border-white/10'
                                                    }`}
                                            >
                                                {selectedMonths.has(row.period) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        ) : (
                                            row.hasRace && <span className="text-amber-400 animate-pulse text-xs shrink-0">🏆</span>
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate">{months[row.monthIdx]}</span>
                                            {row.year !== year && <span className="text-[9px] text-slate-500 font-bold">{row.year}</span>}
                                        </div>
                                        {!selectionMode && <span className="opacity-0 group-hover:opacity-100 text-[10px] text-sky-400 transition-opacity whitespace-nowrap ml-auto px-1">↗</span>}
                                    </div>
                                    <div className="grid grid-cols-[1fr_300px] divide-x divide-white/5 pointer-events-none">
                                        {/* Specific Data */}
                                        <div className={`grid ${activeTab === 'all' ? 'grid-cols-[3fr_3fr_1.5fr_1.5fr]' : activeTab === 'strength' ? 'grid-cols-4' : 'grid-cols-5'}`}>
                                            {activeTab === 'all' ? (
                                                <>
                                                    <div className="p-3 text-right font-mono text-[11px] border-r border-white/5 whitespace-nowrap overflow-hidden text-ellipsis">
                                                        <span className="text-emerald-400 font-bold">{row.categories.cardio.distance > 0 ? row.categories.cardio.distance.toFixed(1).replace('.', ',') : '-'} km</span>
                                                        <span className="text-slate-600 mx-1.5">•</span>
                                                        <span className="text-slate-300">{row.categories.cardio.duration > 0 ? fmtDur(row.categories.cardio.duration) : '-'}</span>
                                                        <span className="text-slate-600 mx-1.5">•</span>
                                                        <span className="text-slate-500">{row.categories.cardio.count || '-'} st</span>
                                                    </div>
                                                    <div className="p-3 text-right font-mono text-[11px] border-r border-white/5 whitespace-nowrap overflow-hidden text-ellipsis">
                                                        <span className="text-indigo-400 font-bold">{row.categories.strength.tonnage > 0 ? (row.categories.strength.tonnage / 1000).toFixed(1).replace('.', ',') : '-'} ton</span>
                                                        <span className="text-slate-600 mx-1.5">•</span>
                                                        <span className="text-slate-300">{row.categories.strength.duration > 0 ? fmtDur(row.categories.strength.duration) : '-'}</span>
                                                        <span className="text-slate-600 mx-1.5">•</span>
                                                        <span className="text-slate-500">{row.categories.strength.count || '-'} st</span>
                                                    </div>
                                                    <div className="p-3 text-right text-slate-400 font-mono text-[11px] border-r border-white/5 relative group/other">
                                                        {row.categories.other.duration > 0 ? (
                                                            <>
                                                                <span className="text-slate-300 border-b border-dashed border-slate-600 cursor-help flex items-center justify-end gap-1.5 ml-auto w-fit">
                                                                    {fmtDur(row.categories.other.duration)} <span className="text-slate-600 mx-0.5">•</span> <span className="text-slate-500">{row.categories.other.count} st</span>
                                                                    <Info className="w-3 h-3 text-slate-500 group-hover/other:text-sky-400 transition-colors" />
                                                                </span>

                                                                {/* Premium Hover Modal */}
                                                                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/other:opacity-100 group-hover/other:translate-y-0 group-hover/other:pointer-events-auto transition-all duration-300 z-[100] text-left">
                                                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                                                                        <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                                                                            <Info className="w-4 h-4" />
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Övrig Träning</span>
                                                                            <span className="text-[9px] text-slate-500 font-bold">{months[i]} {year}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {Object.entries(row.categories.other.breakdown)
                                                                            .sort((a, b) => b[1].duration - a[1].duration)
                                                                            .map(([k, v]) => (
                                                                                <div key={k} className="flex flex-col gap-1.5">
                                                                                    <div className="flex justify-between items-center text-[11px]">
                                                                                        <span className="capitalize font-bold text-slate-200">{k}</span>
                                                                                        <span className="font-mono text-white bg-white/5 px-1.5 py-0.5 rounded">{fmtDur(v.duration)}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between items-center text-[9px]">
                                                                                        <span className="text-slate-500">{v.count} pass</span>
                                                                                        <span className="text-slate-400">{Math.round((v.duration / row.categories.other.duration) * 100)}%</span>
                                                                                    </div>
                                                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                                                        <div
                                                                                            className="h-full bg-sky-500/50 rounded-full"
                                                                                            style={{ width: `${(v.duration / row.categories.other.duration) * 100}%` }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                    </div>

                                                                    <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px]">
                                                                        <span className="text-slate-500 font-bold">Totalt Övrigt</span>
                                                                        <span className="text-sky-400 font-black">{fmtDur(row.categories.other.duration)}</span>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : '-'}
                                                    </div>
                                                    <div className="p-3 flex flex-col justify-center gap-1.5 relative group/dist cursor-help">
                                                        {row.total.duration > 0 ? (
                                                            <>
                                                                <div className="flex w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="bg-emerald-500" style={{ width: `${(row.categories.cardio.duration / row.total.duration) * 100}%` }} />
                                                                    <div className="bg-indigo-500" style={{ width: `${(row.categories.strength.duration / row.total.duration) * 100}%` }} />
                                                                    <div className="bg-slate-500" style={{ width: `${(row.categories.other.duration / row.total.duration) * 100}%` }} />
                                                                </div>
                                                                <div className="flex justify-between text-[9px] font-mono font-bold">
                                                                    <span className="text-emerald-500/70">{row.categories.cardio.duration > 0 ? Math.round((row.categories.cardio.duration / row.total.duration) * 100) + '%' : ''}</span>
                                                                    <span className="text-indigo-500/70">{row.categories.strength.duration > 0 ? Math.round((row.categories.strength.duration / row.total.duration) * 100) + '%' : ''}</span>
                                                                    <span className="text-slate-500/70">{row.categories.other.duration > 0 ? Math.round((row.categories.other.duration / row.total.duration) * 100) + '%' : ''}</span>
                                                                </div>

                                                                {/* Distribution Hover Modal */}
                                                                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/dist:opacity-100 group-hover/dist:translate-y-0 transition-all duration-300 z-[110]">
                                                                    <div className="text-[10px] font-black uppercase tracking-widest text-white mb-3 border-b border-white/10 pb-2">Tidsfördelning</div>
                                                                    <div className="space-y-2.5">
                                                                        {[
                                                                            { label: 'Kondition', color: 'bg-emerald-500', val: row.categories.cardio.duration, count: row.categories.cardio.count },
                                                                            { label: 'Styrka', color: 'bg-indigo-500', val: row.categories.strength.duration, count: row.categories.strength.count },
                                                                            { label: 'Övrigt', color: 'bg-slate-500', val: row.categories.other.duration, count: row.categories.other.count }
                                                                        ].map(cat => (
                                                                            <div key={cat.label} className="flex flex-col gap-1">
                                                                                <div className="flex justify-between items-center text-[10px]">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <div className={`w-1.5 h-1.5 rounded-full ${cat.color}`} />
                                                                                        <span className="text-slate-300 font-bold">{cat.label}</span>
                                                                                    </div>
                                                                                    <span className="font-mono text-white">{Math.round((cat.val / row.total.duration) * 100)}%</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[8px] text-slate-500 px-3">
                                                                                    <span>{cat.count} pass</span>
                                                                                    <span>{fmtDur(cat.val)}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-center text-slate-600 text-[10px]">-</div>
                                                        )}
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
                                        <div className="grid grid-cols-4 bg-slate-900/40 border-l border-white/5 relative overflow-hidden group-hover:bg-slate-900/60 transition-colors">
                                            <div className="p-3 text-right font-mono text-slate-300 flex flex-col justify-center">
                                                <span className="text-[11px] font-bold">{row.total.count || '-'}</span>
                                                <span className="text-[8px] text-slate-600 uppercase font-black tracking-tighter">pass</span>
                                            </div>
                                            <div className="p-3 text-right font-mono text-slate-300 flex flex-col justify-center">
                                                <span className="text-[11px] font-bold">{fmtDur(row.total.duration)}</span>
                                                <span className="text-[8px] text-slate-600 uppercase font-black tracking-tighter">h:m</span>
                                            </div>
                                            <div className="p-3 text-right font-mono text-emerald-400/80 flex flex-col justify-center">
                                                <span className="text-[11px] font-bold">{row.total.distance > 0 ? row.total.distance.toFixed(0) : '-'}</span>
                                                <span className="text-[8px] text-emerald-900 uppercase font-black tracking-tighter">km</span>
                                            </div>
                                            <div className="p-3 text-right font-mono text-indigo-400/80 flex flex-col justify-center">
                                                <span className="text-[11px] font-bold">{row.total.tonnage > 0 ? (row.total.tonnage / 1000).toFixed(0) : '-'}</span>
                                                <span className="text-[8px] text-indigo-900 uppercase font-black tracking-tighter">ton</span>
                                            </div>
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
                <div className="grid grid-cols-[150px_1fr] text-sm font-bold bg-white/5 border-t border-white/10">
                    <div className="p-3 text-white">Totalt:</div>
                    <div className="grid grid-cols-[1fr_300px] divide-x divide-white/5">
                        <div className={`grid ${activeTab === 'all' ? 'grid-cols-[3fr_3fr_1.5fr_1.5fr]' : activeTab === 'strength' ? 'grid-cols-4' : 'grid-cols-5'}`}>
                            {activeTab === 'all' ? (
                                <>
                                    <div className="p-3 text-right font-mono text-xs border-r border-white/5">
                                        <span className="text-emerald-400">{totals.categories.cardio.distance > 0 ? totals.categories.cardio.distance.toFixed(1).replace('.', ',') : '-'} km</span>
                                        <span className="text-slate-600 mx-1.5">•</span>
                                        <span className="text-slate-300">{totals.categories.cardio.duration > 0 ? fmtDur(totals.categories.cardio.duration) : '-'}</span>
                                        <span className="text-slate-600 mx-1.5">•</span>
                                        <span className="text-slate-500">{totals.categories.cardio.count || '-'} st</span>
                                    </div>
                                    <div className="p-3 text-right font-mono text-xs border-r border-white/5">
                                        <span className="text-indigo-400">{totals.categories.strength.tonnage > 0 ? (totals.categories.strength.tonnage / 1000).toFixed(1).replace('.', ',') : '-'} ton</span>
                                        <span className="text-slate-600 mx-1.5">•</span>
                                        <span className="text-slate-300">{totals.categories.strength.duration > 0 ? fmtDur(totals.categories.strength.duration) : '-'}</span>
                                        <span className="text-slate-600 mx-1.5">•</span>
                                        <span className="text-slate-500">{totals.categories.strength.count || '-'} st</span>
                                    </div>
                                    <div className="p-3 text-right text-slate-400 font-mono text-[11px] border-r border-white/5 relative group/other-total">
                                        {totals.categories.other.duration > 0 ? (
                                            <>
                                                <span className="text-slate-300 border-b border-dashed border-slate-600 cursor-help flex items-center justify-end gap-1.5 ml-auto w-fit">
                                                    {fmtDur(totals.categories.other.duration)} <span className="text-slate-600 mx-0.5">•</span> <span className="text-slate-500">{totals.categories.other.count} st</span>
                                                    <Info className="w-3 h-3 text-slate-500 group-hover/other-total:text-sky-400 transition-colors" />
                                                </span>

                                                {/* Premium Hover Modal */}
                                                <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/other-total:opacity-100 group-hover/other-total:translate-y-0 group-hover/other-total:pointer-events-auto transition-all duration-300 z-[100] text-left">
                                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                                                        <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                                                            <Info className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Total Övrig Träning</span>
                                                            <span className="text-[9px] text-slate-500 font-bold">Helår {year}</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {Object.entries(totals.categories.other.breakdown)
                                                            .sort((a, b) => b[1].duration - a[1].duration)
                                                            .map(([k, v]) => (
                                                                <div key={k} className="flex flex-col gap-1.5">
                                                                    <div className="flex justify-between items-center text-[11px]">
                                                                        <span className="capitalize font-bold text-slate-200">{k}</span>
                                                                        <span className="font-mono text-white bg-white/5 px-1.5 py-0.5 rounded">{fmtDur(v.duration)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-[9px]">
                                                                        <span className="text-slate-500">{v.count} pass</span>
                                                                        <span className="text-slate-400">{Math.round((v.duration / totals.categories.other.duration) * 100)}%</span>
                                                                    </div>
                                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-sky-500/50 rounded-full"
                                                                            style={{ width: `${(v.duration / totals.categories.other.duration) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>

                                                    <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-500 font-bold">Totalt Övrigt</span>
                                                        <span className="text-sky-400 font-black">{fmtDur(totals.categories.other.duration)}</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : '-'}
                                    </div>
                                    <div className="p-3 flex flex-col justify-center gap-1.5 relative group/dist-total cursor-help">
                                        {totals.total.duration > 0 ? (
                                            <>
                                                <div className="flex w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="bg-emerald-500" style={{ width: `${(totals.categories.cardio.duration / totals.total.duration) * 100}%` }} />
                                                    <div className="bg-indigo-500" style={{ width: `${(totals.categories.strength.duration / totals.total.duration) * 100}%` }} />
                                                    <div className="bg-slate-500" style={{ width: `${(totals.categories.other.duration / totals.total.duration) * 100}%` }} />
                                                </div>
                                                <div className="flex justify-between text-[9px] font-mono font-bold">
                                                    <span className="text-emerald-500/70">{totals.categories.cardio.duration > 0 ? Math.round((totals.categories.cardio.duration / totals.total.duration) * 100) + '%' : ''}</span>
                                                    <span className="text-indigo-500/70">{totals.categories.strength.duration > 0 ? Math.round((totals.categories.strength.duration / totals.total.duration) * 100) + '%' : ''}</span>
                                                    <span className="text-slate-500/70">{totals.categories.other.duration > 0 ? Math.round((totals.categories.other.duration / totals.total.duration) * 100) + '%' : ''}</span>
                                                </div>

                                                {/* Distribution Hover Modal (Footer) */}
                                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/dist-total:opacity-100 group-hover/dist-total:translate-y-0 transition-all duration-300 z-[110]">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-white mb-3 border-b border-white/10 pb-2">Total Tidsfördelning</div>
                                                    <div className="space-y-2.5">
                                                        {[
                                                            { label: 'Kondition', color: 'bg-emerald-500', val: totals.categories.cardio.duration, count: totals.categories.cardio.count },
                                                            { label: 'Styrka', color: 'bg-indigo-500', val: totals.categories.strength.duration, count: totals.categories.strength.count },
                                                            { label: 'Övrigt', color: 'bg-slate-500', val: totals.categories.other.duration, count: totals.categories.other.count }
                                                        ].map(cat => (
                                                            <div key={cat.label} className="flex flex-col gap-1">
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${cat.color}`} />
                                                                        <span className="text-slate-300 font-bold">{cat.label}</span>
                                                                    </div>
                                                                    <span className="font-mono text-white">{Math.round((cat.val / totals.total.duration) * 100)}%</span>
                                                                </div>
                                                                <div className="flex justify-between text-[8px] text-slate-500 px-3">
                                                                    <span>{cat.count} pass</span>
                                                                    <span>{fmtDur(cat.val)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center text-slate-600 text-[10px]">-</div>
                                        )}
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
                        <div className="grid grid-cols-4 bg-slate-900/50">
                            <div className="p-3 text-right text-white font-mono flex flex-col">
                                <span className="text-xs">{totals.total.count}</span>
                                <span className="text-[7px] text-slate-600 uppercase tracking-tighter">pass</span>
                            </div>
                            <div className="p-3 text-right text-white font-mono flex flex-col">
                                <span className="text-xs">{fmtDur(totals.total.duration)}</span>
                                <span className="text-[7px] text-slate-600 uppercase tracking-tighter">h:m</span>
                            </div>
                            <div className="p-3 text-right text-emerald-400 font-mono flex flex-col">
                                <span className="text-xs">{totals.total.distance.toFixed(0)}</span>
                                <span className="text-[7px] text-emerald-900 uppercase tracking-tighter">km</span>
                            </div>
                            <div className="p-3 text-right text-indigo-400 font-mono flex flex-col">
                                <span className="text-xs">{(totals.total.tonnage / 1000).toFixed(0)}</span>
                                <span className="text-[7px] text-indigo-900 uppercase tracking-tighter">ton</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
