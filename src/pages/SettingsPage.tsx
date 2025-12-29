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

                {/* Goals Section */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span>🎯</span> Mål & Gränser
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4 p-4 bg-white/5 rounded-xl">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Kost</h3>
                            <div className="space-y-3">
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Kalorier (kcal)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.dailyCalorieGoal}
                                        onChange={e => updateSettings({ dailyCalorieGoal: parseInt(e.target.value) })}
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Protein (g)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.dailyProteinGoal}
                                        onChange={e => updateSettings({ dailyProteinGoal: parseInt(e.target.value) })}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-4 p-4 bg-white/5 rounded-xl">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Livsstil</h3>
                            <div className="space-y-3">
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Vatten (glas)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.dailyWaterGoal}
                                        onChange={e => updateSettings({ dailyWaterGoal: parseInt(e.target.value) })}
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Koffein-limit (mg)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.dailyCaffeineLimit}
                                        onChange={e => updateSettings({ dailyCaffeineLimit: parseInt(e.target.value) })}
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Alkohol (varda)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.dailyAlcoholLimitWeekday ?? ''}
                                        onChange={e => updateSettings({ dailyAlcoholLimitWeekday: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                        placeholder="Ingen"
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Alkohol (helg)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.dailyAlcoholLimitWeekend ?? ''}
                                        onChange={e => updateSettings({ dailyAlcoholLimitWeekend: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                        placeholder="Ingen"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-4 p-4 bg-white/5 rounded-xl">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Träning & Sömn</h3>
                            <div className="space-y-3">
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Träning (min/dag)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.dailyTrainingGoal}
                                        onChange={e => updateSettings({ dailyTrainingGoal: parseInt(e.target.value) })}
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className={`text-sm ${settings.dailySleepGoal && (settings.dailySleepGoal < 6 || settings.dailySleepGoal > 9) ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                                        Sömn (6-9h rekommenderas)
                                    </span>
                                    <input
                                        type="number"
                                        className={`bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm ${settings.dailySleepGoal && (settings.dailySleepGoal < 6 || settings.dailySleepGoal > 9) ? 'ring-1 ring-rose-500/50' : ''}`}
                                        value={settings.dailySleepGoal}
                                        onChange={e => updateSettings({ dailySleepGoal: parseFloat(e.target.value) })}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Physical Profile Section */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span>🧬</span> Fysisk Profil
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4 p-4 bg-white/5 rounded-xl">
                            <div className="space-y-3">
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Längd (cm)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.height || ''}
                                        onChange={e => updateSettings({ height: parseInt(e.target.value) || undefined })}
                                        placeholder="--"
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-slate-200 text-sm">Födelseår</span>
                                        {settings.birthYear && (
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                {new Date().getFullYear() - settings.birthYear} år gammal
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.birthYear || ''}
                                        onChange={e => updateSettings({ birthYear: parseInt(e.target.value) || undefined })}
                                        placeholder="YYYY"
                                        min="1900"
                                        max={new Date().getFullYear()}
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Vikt (kg)</span>
                                    <input
                                        type="number"
                                        className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                        value={settings.weight || ''}
                                        onChange={e => updateSettings({ weight: parseFloat(e.target.value) || undefined })}
                                        placeholder="--"
                                    />
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-slate-200 text-sm">Kön</span>
                                    <select
                                        className="bg-slate-800 border-none rounded-lg p-1 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                        value={settings.gender || ''}
                                        onChange={e => updateSettings({ gender: (e.target.value as any) || undefined })}
                                    >
                                        <option value="">Välj...</option>
                                        <option value="male">Man</option>
                                        <option value="female">Kvinna</option>
                                        <option value="other">Annat</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-blue-400 uppercase mb-1">BMI & BMR</h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Din längd och ålder används för att beräkna BMI på dashboarden samt ditt basala metabolismsbehov (BMR) för kalorimål.
                                </p>
                            </div>
                        </div>
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
