import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';

export function SettingsPage() {
    const { user, logout } = useAuth();
    const { settings, updateSettings } = useSettings();

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-32">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white/90">
                Inställningar
            </h1>

            <div className="grid gap-6">
                {/* Account Section */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span>👤</span> Konto
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <div className="font-bold text-white">{user?.name}</div>
                                <div className="text-sm text-slate-400">{user?.email}</div>
                            </div>
                            <button onClick={logout} className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-sm font-bold transition-colors">
                                Logga ut
                            </button>
                        </div>
                    </div>
                </section>

                {/* Appearance Section */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span>🎨</span> Utseende
                    </h2>
                    <div className="grid gap-4">
                        <label className="flex items-center justify-between p-4 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                            <span className="font-medium text-slate-200">Mörkt läge</span>
                            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.theme === 'dark' ? 'bg-sky-500 justify-end' : 'bg-slate-700 justify-start'}`}
                                onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>
                                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </label>
                    </div>
                </section>

                {/* Data & Privacy */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span>🛡️</span> Integritet & Data
                    </h2>
                    <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-xl">
                            <h3 className="font-bold text-white mb-2">Exportera Data</h3>
                            <p className="text-sm text-slate-400 mb-4">Ladda ner all din data i JSON-format.</p>
                            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors">
                                Exportera
                            </button>
                        </div>

                        <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                            <h3 className="font-bold text-rose-400 mb-2">Danger Zone</h3>
                            <p className="text-sm text-rose-300/70 mb-4">Radera kontot och all data permanent via adminpanelen.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
