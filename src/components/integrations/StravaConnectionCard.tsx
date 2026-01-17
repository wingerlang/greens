import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';

import { StravaActivityImportModal } from './StravaActivityImportModal.tsx';

interface StravaAthlete {
    id: number;
    name: string;
    avatar: string;
    city: string;
    country: string;
    premium: boolean;
}

interface StravaStats {
    allTimeRuns: number;
    allTimeRides: number;
    allTimeSwims: number;
    ytdDistance: number;
}

interface StravaStatus {
    connected: boolean;
    athlete?: StravaAthlete;
    stats?: StravaStats;
    lastSync?: string;
    error?: string;
}

export function StravaConnectionCard() {
    const { token } = useAuth();
    const { refreshData } = useData();
    const { settings, updateSettings } = useSettings();
    const [status, setStatus] = useState<StravaStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Check connection status on mount
    useEffect(() => {
        checkStatus();

        // Check URL for callback results
        const params = new URLSearchParams(window.location.search);
        if (params.get('strava_connected') === 'true') {
            checkStatus();
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
        if (params.get('strava_error')) {
            setStatus({ connected: false, error: params.get('strava_error') || 'Connection failed' });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [token]);

    const checkStatus = async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/strava/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStatus(data);
        } catch (err) {
            setStatus({ connected: false });
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            // Get auth URL with session token as state
            const res = await fetch(`/api/strava/auth?state=${token}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else if (data.error) {
                setStatus({ connected: false, error: data.error });
            }
        } catch (err) {
            setStatus({ connected: false, error: 'Failed to start connection' });
        } finally {
            setConnecting(false);
        }
    };

    const handleSync = async () => {
        setIsImportModalOpen(true);
    };

    const handleDisconnect = async () => {
        if (!confirm('Är du säker på att du vill koppla bort Strava?')) return;

        try {
            await fetch('/api/strava/disconnect', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setStatus({ connected: false });
        } catch (err) {
            console.error('Disconnect failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-900 rounded-2xl border border-white/10 p-6 animate-pulse">
                <div className="h-6 bg-slate-800 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-slate-800 rounded w-2/3"></div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-orange-500/10 to-slate-900 rounded-2xl border border-orange-500/20 overflow-hidden">
            <StravaActivityImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />

            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-4">
                    {/* Strava Logo */}
                    <div className="w-12 h-12 rounded-xl bg-[#FC4C02] flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white">Strava</h3>
                        <p className="text-xs text-slate-400">
                            {status?.connected ? 'Ansluten' : 'Inte ansluten'}
                        </p>
                    </div>
                </div>

                {/* Status Badge */}
                <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${status?.connected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-white/10'
                    }`}>
                    {status?.connected ? '✓ Kopplad' : 'Ej kopplad'}
                </div>
            </div>

            {/* Connected State */}
            {status?.connected && status.athlete && (
                <div className="p-6 space-y-4">
                    {/* Athlete Info */}
                    <div className="flex items-center gap-4">
                        <img
                            src={status.athlete.avatar}
                            alt={status.athlete.name}
                            className="w-14 h-14 rounded-full border-2 border-orange-500/30"
                        />
                        <div>
                            <div className="font-bold text-white">{status.athlete.name}</div>
                            <div className="text-xs text-slate-400">
                                {status.athlete.city}, {status.athlete.country}
                                {status.athlete.premium && <span className="ml-2 text-orange-400">★ Premium</span>}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    {status.stats && (
                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-slate-950/50 rounded-xl p-3 text-center">
                                <div className="text-xl font-black text-orange-400">{status.stats.allTimeRuns}</div>
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Löprundor</div>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-3 text-center">
                                <div className="text-xl font-black text-blue-400">{status.stats.allTimeRides}</div>
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Cykelturer</div>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-3 text-center">
                                <div className="text-xl font-black text-cyan-400">{status.stats.allTimeSwims}</div>
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Simpass</div>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-3 text-center">
                                <div className="text-xl font-black text-emerald-400">{status.stats.ytdDistance}</div>
                                <div className="text-[9px] text-slate-500 uppercase font-bold">km i år</div>
                            </div>
                        </div>
                    )}

                    {/* Last Sync */}
                    {status.lastSync && (
                        <div className="text-[10px] text-slate-500 text-center">
                            Senast synkad: {new Date(status.lastSync).toLocaleString('sv-SE')}
                        </div>
                    )}

                    {/* Time Preference Toggle */}
                    <div className="bg-slate-950/30 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tidstyp</label>
                            <div className="flex bg-slate-900 p-1 rounded-lg border border-white/5">
                                <button
                                    onClick={() => updateSettings({ stravaTimePreference: 'moving' })}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${(settings.stravaTimePreference || 'moving') === 'moving'
                                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                            : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    Rörelsetid
                                </button>
                                <button
                                    onClick={() => updateSettings({ stravaTimePreference: 'elapsed' })}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${settings.stravaTimePreference === 'elapsed'
                                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                            : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    Total Tid
                                </button>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            {(settings.stravaTimePreference || 'moving') === 'moving'
                                ? 'Använder effektiv tid i rörelse för dina pass (pauser borträknade).'
                                : 'Använder total tid från start till mål inklusive alla pauser.'}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleDisconnect}
                            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-bold text-xs uppercase tracking-wider transition-all border border-white/5 hover:border-rose-500/30"
                        >
                            Koppla Bort
                        </button>
                        <button
                            onClick={handleSync}
                            className="flex-1 py-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold text-xs uppercase tracking-wider transition-all border border-orange-500/30"
                        >
                            Synka Nu
                        </button>
                    </div>
                </div>
            )}

            {/* Disconnected State */}
            {!status?.connected && (
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-400">
                        Koppla ditt Strava-konto för att automatiskt importera dina träningspass, löprundor, cykelturer och mer!
                    </p>

                    {/* Benefits */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="text-emerald-400">✓</span> Auto-import pass
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="text-emerald-400">✓</span> Distans & tempo
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="text-emerald-400">✓</span> Pulsdata
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="text-emerald-400">✓</span> Personliga rekord
                        </div>
                    </div>

                    {/* Error Message */}
                    {status?.error && (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-400">
                            ⚠️ {status.error}
                        </div>
                    )}

                    {/* Connect Button */}
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full py-4 rounded-xl bg-[#FC4C02] hover:bg-[#E34402] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {connecting ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Ansluter...
                            </>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                                </svg>
                                Koppla Strava
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
