import React, { useState, useMemo } from 'react';

export type DurationPreset = 'ongoing' | '30d' | '3m' | '6m' | '12m' | 'custom' | 'end_of_month' | '1w';

interface SmartDurationPickerProps {
    startDate: string;
    endDate: string;
    onChange: (startDate: string, endDate: string) => void;
    allowOngoing?: boolean;
}

export const SmartDurationPicker: React.FC<SmartDurationPickerProps> = ({
    startDate,
    endDate,
    onChange,
    allowOngoing = true
}) => {
    const [preset, setPreset] = useState<DurationPreset>(() => {
        if (!endDate && allowOngoing) return 'ongoing';
        // Try to match dates to a preset logic, otherwise custom
        return 'custom';
    });

    const setDates = (p: DurationPreset) => {
        setPreset(p);
        const start = new Date(startDate);

        let newEnd = '';

        switch (p) {
            case 'ongoing':
                newEnd = '';
                break;
            case '1w':
                newEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case '30d':
                newEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case 'end_of_month':
                newEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0).toISOString().split('T')[0];
                break;
            case '3m':
                newEnd = new Date(start.getFullYear(), start.getMonth() + 3, start.getDate()).toISOString().split('T')[0];
                break;
            case '6m':
                newEnd = new Date(start.getFullYear(), start.getMonth() + 6, start.getDate()).toISOString().split('T')[0];
                break;
            case '12m':
                newEnd = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()).toISOString().split('T')[0];
                break;
            case 'custom':
                // Keep existing endDate or set to tomorrow if empty
                newEnd = endDate || new Date(start.getTime() + 86400000).toISOString().split('T')[0];
                break;
        }
        onChange(startDate, newEnd);
    };

    const handleStartChange = (val: string) => {
        onChange(val, endDate);
        // Re-apply preset logic if needed, but for simplicity let's keep it 'custom' if user messes with dates manually
        if (preset !== 'ongoing' && preset !== 'custom') {
            // Re-calculate end date based on new start date + current preset
            // We need a way to trigger that update.
            // Simple way: locally update endDate using the logic.
            // However, since we don't have the logic duplicated easily here without recursion, let's just switch to custom.
            setPreset('custom');
        }
    };

    const PRESETS: { id: DurationPreset; label: string; short: string }[] = [
        ...(allowOngoing ? [{ id: 'ongoing', label: 'Tills vidare', short: '∞' }] as const : []),
        { id: '1w', label: '1 vecka', short: '1v' },
        { id: '30d', label: '30 dagar', short: '30d' },
        { id: 'end_of_month', label: 'Månadens slut', short: 'Mån' },
        { id: '3m', label: '3 månader', short: '3m' },
        { id: '6m', label: '6 månader', short: '6m' },
        { id: '12m', label: '12 månader', short: '12m' },
        { id: 'custom', label: 'Anpassad', short: '📅' },
    ];

    const START_PRESETS = [
        { label: 'Idag', val: new Date().toISOString().split('T')[0] },
        { label: 'Imorgon', val: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
        {
            label: 'Måndag', val: (() => {
                const d = new Date();
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                const nextMon = new Date(d.setDate(diff + 7));
                return nextMon.toISOString().split('T')[0];
            })()
        },
        {
            label: '1:a i mån', val: (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 1);
                d.setDate(1);
                return d.toISOString().split('T')[0];
            })()
        }
    ];

    return (
        <div className="space-y-4">
            {/* Start Date */}
            <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500">Startdatum</label>
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                    {START_PRESETS.map(opt => (
                        <button
                            key={opt.label}
                            onClick={() => handleStartChange(opt.val)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-all ${
                                startDate === opt.val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                    : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartChange(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold"
                />
            </div>

            {/* Duration / End Date */}
            <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500">Varaktighet / Slutdatum</label>
                <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map(d => (
                        <button
                            key={d.id}
                            onClick={() => setDates(d.id)}
                            title={d.label}
                            className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                                preset === d.id
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                    : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                            }`}
                        >
                            {d.short}
                        </button>
                    ))}
                </div>

                {preset === 'custom' && (
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                            onChange(startDate, e.target.value);
                            setPreset('custom');
                        }}
                        min={startDate}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold mt-2"
                    />
                )}
            </div>
        </div>
    );
};
