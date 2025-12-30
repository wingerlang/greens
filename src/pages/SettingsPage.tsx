import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useData } from '../context/DataContext.tsx';

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    training: { label: 'Träning', icon: '🏋️' },
    nutrition: { label: 'Kost', icon: '🥗' },
    health: { label: 'Hälsa', icon: '💤' },
    social: { label: 'Social', icon: '👥' },
    body: { label: 'Kropp', icon: '⚖️' },
};

export function SettingsPage() {
    const { user, logout } = useAuth();
    const { settings, updateSettings } = useSettings();
    const { users, updateCurrentUser, currentUser } = useData();

    // State for managing privacy overrides
    const [showAddOverride, setShowAddOverride] = React.useState(false);
    const [selectedUserId, setSelectedUserId] = React.useState<string>('');

    const privacy = currentUser?.privacy;
    const categoryOverrides = privacy?.categoryOverrides || {};

    // Get list of users to potentially add (excluding self and already added)
    const availableUsers = users.filter(
        u => u.id !== currentUser?.id && !categoryOverrides[u.id]
    );

    // Toggle a category override for a user
    const toggleCategoryOverride = (userId: string, category: string) => {
        if (!currentUser?.privacy) return;

        const currentOverrides = { ...categoryOverrides };
        const userOverrides = currentOverrides[userId] || {};
        const currentValue = userOverrides[category as keyof typeof userOverrides];

        // Cycle: undefined -> true -> false -> undefined
        let newValue: boolean | undefined;
        if (currentValue === undefined) newValue = true;
        else if (currentValue === true) newValue = false;
        else newValue = undefined;

        if (newValue === undefined) {
            delete (userOverrides as any)[category];
        } else {
            (userOverrides as any)[category] = newValue;
        }

        // Clean up empty override objects
        if (Object.keys(userOverrides).length === 0) {
            delete currentOverrides[userId];
        } else {
            currentOverrides[userId] = userOverrides;
        }

        updateCurrentUser({
            privacy: {
                ...currentUser.privacy,
                categoryOverrides: currentOverrides
            }
        });
    };

    // Add a new user to overrides
    const addUserOverride = () => {
        if (!selectedUserId || !currentUser?.privacy) return;

        const newOverrides = {
            ...categoryOverrides,
            [selectedUserId]: {} // Start with empty overrides
        };

        updateCurrentUser({
            privacy: {
                ...currentUser.privacy,
                categoryOverrides: newOverrides
            }
        });

        setSelectedUserId('');
        setShowAddOverride(false);
    };

    // Remove a user from overrides
    const removeUserOverride = (userId: string) => {
        if (!currentUser?.privacy) return;

        const newOverrides = { ...categoryOverrides };
        delete newOverrides[userId];

        updateCurrentUser({
            privacy: {
                ...currentUser.privacy,
                categoryOverrides: newOverrides
            }
        });
    };

    // Get user by ID
    const getUserById = (userId: string) => users.find(u => u.id === userId);

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

                {/* Per-Person Privacy Overrides */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span>🔐</span> Individuella Delningar
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                        Ge specifika personer tillgång till kategorier som annars är privata.
                        <span className="text-emerald-400"> ✓ = Tillåt</span>,
                        <span className="text-rose-400"> ✗ = Neka</span>,
                        <span className="text-slate-500"> ○ = Följ standard</span>
                    </p>

                    <div className="space-y-4">
                        {Object.entries(categoryOverrides).length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <div className="text-3xl mb-2">🔒</div>
                                <p>Inga individuella delningar ännu</p>
                            </div>
                        ) : (
                            Object.entries(categoryOverrides).map(([userId, overrides]) => {
                                const targetUser = getUserById(userId);
                                if (!targetUser) return null;

                                return (
                                    <div key={userId} className="p-4 bg-white/5 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                                    {targetUser.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white">{targetUser.name}</div>
                                                    <div className="text-xs text-slate-500">@{targetUser.handle || targetUser.username}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeUserOverride(userId)}
                                                className="px-3 py-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                            >
                                                Ta bort
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-5 gap-2">
                                            {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => {
                                                const value = (overrides as any)[key];
                                                const isAllowed = value === true;
                                                const isDenied = value === false;

                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => toggleCategoryOverride(userId, key)}
                                                        className={`flex flex-col items-center p-2 rounded-lg transition-all ${isAllowed
                                                                ? 'bg-emerald-500/20 border border-emerald-500/30'
                                                                : isDenied
                                                                    ? 'bg-rose-500/20 border border-rose-500/30'
                                                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                                            }`}
                                                        title={`${label}: ${isAllowed ? 'Tillåten' : isDenied ? 'Nekad' : 'Standard'}`}
                                                    >
                                                        <span className="text-lg mb-1">{icon}</span>
                                                        <span className={`text-xs font-medium ${isAllowed ? 'text-emerald-400' : isDenied ? 'text-rose-400' : 'text-slate-500'
                                                            }`}>
                                                            {isAllowed ? '✓' : isDenied ? '✗' : '○'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Add new override */}
                        {showAddOverride ? (
                            <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedUserId}
                                        onChange={e => setSelectedUserId(e.target.value)}
                                        className="flex-1 bg-slate-800 border-none rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                    >
                                        <option value="">Välj person...</option>
                                        {availableUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} (@{u.handle || u.username})</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={addUserOverride}
                                        disabled={!selectedUserId}
                                        className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Lägg till
                                    </button>
                                    <button
                                        onClick={() => { setShowAddOverride(false); setSelectedUserId(''); }}
                                        className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddOverride(true)}
                                className="w-full p-4 border border-dashed border-white/20 rounded-xl text-slate-400 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2"
                            >
                                <span>+</span> Lägg till person
                            </button>
                        )}
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
