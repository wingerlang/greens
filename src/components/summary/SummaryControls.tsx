import React, { useState } from 'react';

interface SummaryControlsProps {
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
    onDownload: () => void;
    isDownloading: boolean;
}

export const SummaryControls: React.FC<SummaryControlsProps> = ({
    startDate,
    endDate,
    onDateChange,
    onDownload,
    isDownloading
}) => {

    const setPreset = (days: number | 'year' | 'last_year') => {
        const end = new Date();
        const start = new Date();

        if (typeof days === 'number') {
            start.setDate(end.getDate() - days);
        } else if (days === 'year') {
            start.setMonth(0, 1);
            start.setDate(1); // Jan 1st this year
        } else if (days === 'last_year') {
             start.setFullYear(start.getFullYear() - 1, 0, 1);
             end.setFullYear(end.getFullYear() - 1, 11, 31);
        }

        onDateChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    };

    return (
        <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-6">
            <div>
                <h3 className="text-lg font-bold text-white mb-4">Period</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button onClick={() => setPreset(30)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Senaste 30 dagarna</button>
                    <button onClick={() => setPreset(90)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Senaste 3 mån</button>
                    <button onClick={() => setPreset('year')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">I år</button>
                    <button onClick={() => setPreset('last_year')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Förra året</button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Startdatum</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => onDateChange(e.target.value, endDate)}
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-sm font-bold text-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Slutdatum</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => onDateChange(startDate, e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-sm font-bold text-white"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-white/10">
                <button
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isDownloading ? (
                        <span>Sparar...</span>
                    ) : (
                        <>
                            <span>Ladda ner bild</span>
                            <span className="text-lg">📸</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
