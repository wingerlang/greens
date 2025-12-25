import React from 'react';
import { useGarmin } from '../hooks/useGarmin.ts';
import { useData } from '../context/DataContext.tsx';

export function GarminPage() {
    const { isSyncing, lastSync, syncMetrics } = useGarmin();
    const { sleepSessions, intakeLogs, universalActivities } = useData();

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white/90">
                        Garmin <span className="text-sky-500">Connect</span>
                    </h1>
                    <p className="text-slate-400 mt-1 max-w-xl">
                        Synkronisera din sömn, träning och hälsodata direkt från Garmin. Data lagras lokalt och dedubliceras mot Strava.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => syncMetrics()}
                        disabled={isSyncing}
                        className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all
                            ${isSyncing
                                ? 'bg-slate-800 text-slate-500 cursor-wait'
                                : 'bg-sky-500 text-slate-900 hover:bg-sky-400 shadow-lg shadow-sky-500/20 hover:scale-105'
                            }`}
                    >
                        {isSyncing ? 'Synkroniserar...' : 'Synka Nu'}
                    </button>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${lastSync ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-700'}`}></div>
                        <span className="text-xl font-black text-white">{lastSync ? 'Ansluten' : 'Ej Ansluten'}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                        {lastSync ? `Senast: ${new Date(lastSync).toLocaleString()}` : 'Ingen synk utförd'}
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sömnsessioner</div>
                    <div className="text-3xl font-black text-white">{sleepSessions?.length || 0}</div>
                    <div className="text-xs text-sky-400 mt-1">Importerade sessioner</div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Aktiviteter</div>
                    <div className="text-3xl font-black text-white">{universalActivities?.length || 0}</div>
                    <div className="text-xs text-emerald-400 mt-1">Importerade pass</div>
                </div>
            </div>

            {/* Data Preview Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Sleep */}
                <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="font-bold text-white">Senaste Sömn</h3>
                        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Logg</span>
                    </div>
                    <div className="p-0">
                        {sleepSessions?.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-xs uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="p-4">Datum</th>
                                        <th className="p-4">Tid</th>
                                        <th className="p-4">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {sleepSessions.slice(0, 5).map(s => (
                                        <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-medium text-white">{s.date}</td>
                                            <td className="p-4 text-slate-400">{(s.durationSeconds / 3600).toFixed(1)}h</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${(s.score || 0) >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                                                        (s.score || 0) >= 60 ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-rose-500/20 text-rose-400'
                                                    }`}>
                                                    {s.score || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-slate-500 italic">Ingen sömndata importerad än.</div>
                        )}
                    </div>
                </div>

                {/* Configuration / Info */}
                <div className="space-y-4">
                    <div className="p-6 bg-sky-500/10 border border-sky-500/20 rounded-2xl">
                        <h3 className="font-bold text-sky-400 mb-2">ℹ️ Beta Integration</h3>
                        <p className="text-sm text-sky-200/80 leading-relaxed">
                            Denna integration använder en lokal mock-service tills vi har en godkänd Garmin Connect API-nyckel.
                            Klicka på "Synka Nu" för att importera testdata och verifiera flödena.
                        </p>
                    </div>

                    <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl">
                        <h3 className="font-bold text-white mb-4">Inställningar</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Prioritera Garmin GPS</span>
                                <div className="w-10 h-6 bg-emerald-500 rounded-full flex items-center px-1 justify-end cursor-pointer">
                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Importera Stress & Body Battery</span>
                                <div className="w-10 h-6 bg-slate-700 rounded-full flex items-center px-1 justify-start cursor-pointer">
                                    <div className="w-4 h-4 bg-white/50 rounded-full shadow-sm"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
