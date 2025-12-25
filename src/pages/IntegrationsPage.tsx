import React, { useState } from 'react';
import { useGarmin } from '../hooks/useGarmin.ts';
import { StravaConnectionCard } from '../components/integrations/StravaConnectionCard.tsx';

export function IntegrationsPage() {
    const { isSyncing, lastSync, syncMetrics } = useGarmin();
    const [mockGarminConnected, setMockGarminConnected] = useState(false);

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-32">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white/90">
                Synk<span className="text-sky-500">ningar</span>
            </h1>

            <div className="grid gap-6">
                {/* Strava Section */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-orange-500/10 transition-colors"></div>

                    <div className="relative z-10">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black italic text-white flex items-center gap-3">
                                <span className="text-[#FC4C02]">STRAVA</span>
                            </h2>
                            <p className="text-slate-400 mt-1 max-w-xl">
                                Anslut för att importera löpning och cykling. Vi hämtar automatiskt nya pass och matchar dem mot ditt schema.
                            </p>
                        </div>

                        <StravaConnectionCard />
                    </div>
                </section>

                {/* Garmin Section */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-sky-500/10 transition-colors"></div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-black italic text-white flex items-center gap-3">
                                <span className="text-sky-500">GARMIN</span> CONNECT
                            </h2>
                            <p className="text-slate-400 mt-1 max-w-xl">
                                Synka sömn, vilopuls och HRV. Används för återhämtningsanalys.
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${lastSync ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    {lastSync ? 'Ansluten' : 'Ej Ansluten'}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    syncMetrics();
                                    setMockGarminConnected(true);
                                }}
                                disabled={isSyncing}
                                className={`px-5 py-2.5 rounded-lg font-bold uppercase tracking-wider text-sm transition-all border border-white/10
                                    ${isSyncing
                                        ? 'bg-slate-800 text-slate-500'
                                        : 'bg-white/5 hover:bg-sky-500/20 text-white hover:border-sky-500/50'
                                    }`}
                            >
                                {isSyncing ? 'Synkar...' : 'Synka Manuellt'}
                            </button>
                        </div>
                    </div>

                    {/* Garmin specific link */}
                    <div className="mt-6 pt-6 border-t border-white/5 flex justify-end">
                        <a href="/garmin" className="text-xs font-bold text-sky-400 hover:text-sky-300 uppercase tracking-widest flex items-center gap-1">
                            Visa detaljerad Garmin-data →
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
}
